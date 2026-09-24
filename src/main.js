import './style.css';
import { CHARACTERS, spriteFrame } from './game/sprites.js';
import { Club, ROOMS, EXIT_MOVES, roomIndexAt, drawJumpscare } from './game/club.js';
import { answerSheet, addCredits, judge, hintText, CREDIT_CAP } from './game/match.js';
import { buildPool, roundDetails, inWindow, fetchCredits, useMock } from './data/tracks.js';
import { MODES, modeById } from './data/modes.js';

// ---------- tuning ----------
const ROUND_MS = 20000; // max time per song
const PAYOUT = [
  { until: 5000, pct: 1 },
  { until: 10000, pct: 0.75 },
  { until: 14000, pct: 0.5 },
  { until: 17000, pct: 0.25 },
  { until: Infinity, pct: 0 }, // last 3 seconds: correct, but no move
];
const HORDE_START = -12; // moves behind the player at the start
const HORDE_SEC_PER_MOVE = [18, 16, 14, 12, 10]; // by room, then scaled by the mode's pace
// Wrong-guess noise and hint cost come from the mode (see modes.js).
const DANGER = { warn: 5, close: 3, critical: 1.5 }; // gap in moves between you and the horde
const WALK_SPEED = 3; // moves per second while animating forward
const REVEAL_MS = 3500;

const ACCENT = getComputedStyle(document.documentElement).getPropertyValue('--sc-orange').trim() || '#ff5f15';
const app = document.getElementById('app');
const audio = new Audio();
audio.preload = 'auto';

const state = {
  screen: 'title',
  modeId: load('sm_mode', 'fan'),
  characterId: load('sm_char', 'summit'),
  run: null,
};
const mode = () => modeById(state.modeId);
const character = () => CHARACTERS.find((c) => c.id === state.characterId) || CHARACTERS[0];

// ---------- pools + next-round prep ----------
const pools = {}; // modeId -> { list, index, promise }
let next = null; // { entry, details } ready to play
let nextPromise = null;

function ensurePool(m = mode()) {
  const p = (pools[m.id] ||= { list: null, index: 0, promise: null });
  if (p.list) return Promise.resolve(p);
  if (!p.promise) {
    p.promise = buildPool(m)
      .then((list) => { p.list = list; return p; })
      .catch((e) => { p.promise = null; throw e; });
  }
  return p.promise;
}

// Finds the next track that has a preview and falls inside the mode's year window.
let nextPromiseMode = null;
function prepareNext() {
  const m = mode();
  if (next && next.modeId === m.id) return Promise.resolve(next);
  next = null;
  if (nextPromise && nextPromiseMode === m.id) return nextPromise;
  nextPromiseMode = m.id;
  const p = (async () => {
    const pool = await ensurePool(m);
    for (let tries = 0; tries < 25; tries++) {
      const entry = pool.list[pool.index % pool.list.length];
      pool.index++;
      try {
        const details = await roundDetails(entry);
        if (!details.preview || !inWindow(details, m)) continue;
        if (state.modeId !== m.id) return null;
        next = { entry, details, modeId: m.id };
        return next;
      } catch {
        /* skip unplayable track */
      }
    }
    throw new Error('Could not find a playable track in this mode.');
  })();
  nextPromise = p;
  p.finally(() => { if (nextPromise === p) nextPromise = null; }).catch(() => {});
  return p;
}

function takeNext() {
  const n = next;
  next = null;
  prepareNext().catch(() => {});
  return n;
}

// ---------- helpers ----------
function load(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch {} }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (ms) => {
  ms = Math.max(0, ms);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
};
const secs = (ms) => (Math.max(0, ms) / 1000).toFixed(1) + 's';
const num = (n) => String(Number(n.toFixed(2)));
const payoutAt = (ms) => PAYOUT.find((p) => ms < p.until).pct;

function portrait(canvas, sprite, scale = 5) {
  canvas.width = 12 * scale;
  canvas.height = 16 * scale;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  let f = 0;
  const draw = () => {
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(spriteFrame(sprite, f), 0, 0, 12 * scale, 16 * scale);
  };
  draw();
  return setInterval(() => { f = 1 - f; draw(); }, 420);
}

let timers = [];
function clearTimers() { timers.forEach(clearInterval); timers = []; }

const LOGO = `<h1 class="logo"><span>SIDECHAIN</span><span>MASSACRE</span></h1>`;
const ATTRIB = `<p class="attrib">Music previews and data from <a href="https://www.deezer.com" target="_blank" rel="noopener">Deezer</a>. Credits from <a href="https://musicbrainz.org" target="_blank" rel="noopener">MusicBrainz</a>.</p>`;

// ---------- screens ----------
function render() {
  clearTimers();
  ({ title: renderTitle, mode: renderMode, select: renderSelect, game: renderGame, end: renderEnd })[state.screen]();
}

function renderTitle() {
  app.innerHTML = `
    <main class="screen title">
      ${LOGO}
      <p class="tagline">The red room is packed and the crowd has turned. Name the music to get out.</p>
      <section class="howto" aria-labelledby="howto-h">
        <h2 id="howto-h">How to play</h2>
        <ol>
          <li><b>A song plays.</b> You get <b>20 seconds</b> per song.</li>
          <li><b>Type what you hear</b> in the box and hit Enter: the song title, the artist, or the record label. No need to say which, the game figures it out.</li>
          <li><b>Right answers move you toward the exit.</b> Song title +3, label +2, artist +1, a featured artist or credit +½. You can get all of them on one song.</li>
          <li><b>Be quick.</b> Answers in the first 5 seconds pay in full, then less. In the last 3 seconds a right answer counts but doesn't move you.</li>
          <li><b>The zombies never stop.</b> Wrong guesses and hints let them catch up. Watch the bar under the clock. Reach the exit before they reach you.</li>
        </ol>
        <p class="tips">Stuck? Hit <b>Hint</b> for the first letters, or <b>Skip</b> (Esc) to move to the next song.</p>
      </section>
      <button class="btn primary" id="go">Enter the club</button>
      ${useMock() ? '<p class="mocknote">Mock mode: offline test tracks, no audio.</p>' : ''}
      ${ATTRIB}
    </main>`;
  document.getElementById('go').onclick = () => { state.screen = 'mode'; render(); };
}

function renderMode() {
  app.innerHTML = `
    <main class="screen modes">
      <h2 class="h2">Select difficulty</h2>
      <ol class="modelist">
        ${MODES.map((m, i) => `
          <li>
            <button class="mode ${m.id === state.modeId ? 'on' : ''}" data-id="${m.id}">
              <span class="lvl">${i + 1} · ${esc(m.level)}</span>
              <span class="mname">${esc(m.name)}</span>
              <span class="mblurb">${esc(m.blurb)}</span>
            </button>
          </li>`).join('')}
      </ol>
      <div class="startrow">
        <button class="btn primary" id="cont">Choose character</button>
        <button class="btn ghost" id="back">Back</button>
      </div>
      ${ATTRIB}
    </main>`;
  app.querySelectorAll('.mode').forEach((b) => {
    b.onclick = () => {
      state.modeId = b.dataset.id;
      save('sm_mode', b.dataset.id);
      app.querySelectorAll('.mode').forEach((x) => x.classList.toggle('on', x === b));
    };
    b.ondblclick = () => document.getElementById('cont').click();
  });
  document.getElementById('back').onclick = () => { state.screen = 'title'; render(); };
  document.getElementById('cont').onclick = () => {
    state.screen = 'select';
    render();
  };
}

function renderSelect() {
  const m = mode();
  app.innerHTML = `
    <main class="screen select">
      <p class="modetag">${esc(m.level)} · ${esc(m.name)}</p>
      <h2 class="h2">Choose who's getting out</h2>
      <div class="cards">
        ${CHARACTERS.map((c) => `
          <button class="card ${c.id === state.characterId ? 'on' : ''}" data-id="${c.id}">
            <canvas class="pix" data-sprite="${c.id}"></canvas>
            <span class="cname">${esc(c.name)}</span>
            <span class="cblurb">${esc(c.blurb)}</span>
          </button>`).join('')}
      </div>
      <div class="startrow">
        <button class="btn primary" id="start" disabled>Loading tracks…</button>
        <button class="btn ghost" id="back">Back</button>
      </div>
      <p class="err" id="poolerr" hidden></p>
      ${ATTRIB}
    </main>`;

  app.querySelectorAll('canvas[data-sprite]').forEach((cv) => {
    timers.push(portrait(cv, CHARACTERS.find((c) => c.id === cv.dataset.sprite)));
  });
  app.querySelectorAll('.card').forEach((b) => {
    b.onclick = () => {
      state.characterId = b.dataset.id;
      save('sm_char', b.dataset.id);
      app.querySelectorAll('.card').forEach((x) => x.classList.toggle('on', x === b));
    };
  });
  document.getElementById('back').onclick = () => { state.screen = 'mode'; render(); };

  const start = document.getElementById('start');
  const errEl = document.getElementById('poolerr');
  start.onclick = beginRun;
  const load = () => {
    start.disabled = true;
    start.textContent = 'Loading tracks…';
    errEl.hidden = true;
    prepareNext()
      .then(() => { start.disabled = false; start.textContent = 'Start the run'; start.onclick = beginRun; })
      .catch((e) => {
        errEl.hidden = false;
        errEl.textContent = `Couldn't load tracks from Deezer (${e.message}).`;
        start.disabled = false;
        start.textContent = 'Try again';
        start.onclick = load;
      });
  };
  load();
}

// Runs synchronously inside the click so the browser lets audio start.
function beginRun() {
  const first = takeNext();
  if (!first) return;
  audio.src = first.details.preview;
  audio.play().catch(() => {});
  state.run = {
    mode: mode(),
    player: 0,
    shown: 0,
    horde: HORDE_START,
    activeMs: 0,
    round: null,
    history: [],
    over: false,
    paused: true,
  };
  state.screen = 'game';
  render();
  startRound(first, true);
}

// ---------- game ----------
let club = null;
let raf = 0;
let last = 0;

function renderGame() {
  const ch = character();
  const zones = PAYOUT.map((p, i) => {
    const from = i ? PAYOUT[i - 1].until : 0;
    const to = Math.min(p.until, ROUND_MS);
    return `<span class="z z${i}" style="width:${((to - from) / ROUND_MS) * 100}%"></span>`;
  }).join('');
  app.innerHTML = `
    <main class="screen game">
      <header class="hud">
        <div class="stat"><span class="k">RUN</span><span class="v" id="runT">00:00.000</span></div>
        <div class="stat mid"><span class="k">${esc(state.run.mode.name)}</span><span class="v" id="roomN">COAT CHECK</span></div>
        <div class="stat right"><span class="k">CLOCK</span><span class="v" id="clockT">10.0s</span></div>
      </header>
      <div class="clock" aria-hidden="true"><div class="zones">${zones}</div><div class="needle" id="needle"></div></div>
      <div class="route" id="route">
        <span class="rlabel">ENTRANCE</span>
        <div class="rtrack">
          <div class="rgap" id="rgap"></div>
          <span class="rmark horde" id="rhorde" title="The horde"></span>
          <span class="rmark you" id="ryou" title="You"></span>
        </div>
        <span class="rlabel exit">EXIT</span>
        <span class="rstatus" id="rstatus">Safe for now</span>
      </div>
      <div class="stage">
        <canvas id="club" class="pix"></canvas>
        <div class="badge" id="emerging" hidden>EMERGING ×1.5</div>
        <div class="warnbanner" id="warn" hidden></div>
        <div class="reveal" id="reveal" hidden></div>
        <canvas id="scare" class="pix scare" hidden></canvas>
      </div>
      <ul class="legend" id="legend">
        <li data-k="track"><b>TRACK</b> +3</li>
        <li data-k="label"><b>LABEL</b> +2</li>
        <li data-k="artist"><b>ARTIST</b> +1</li>
        <li data-k="credit"><b>FEAT / CREDIT</b> +½ <i id="creditCount">0/${CREDIT_CAP}</i></li>
      </ul>
      <p class="payout">Answer in 0–5s for full moves · 5–10s 75% · 10–14s 50% · 14–17s 25% · last 3s you don't move</p>
      <form class="guess" id="guessForm" autocomplete="off">
        <input id="guess" placeholder="Name the track, label or artist" maxlength="120" disabled>
        <button type="button" class="btn small ghost" id="hintBtn">Hint</button>
        <button type="button" class="btn small ghost" id="skipBtn" title="Esc">Skip</button>
      </form>
      <div class="hintline" id="hintline"></div>
      <ol class="feed" id="feed"></ol>
      <div class="resume" id="resume" hidden><button class="btn primary" id="resumeBtn">Tap to start the music</button></div>
      <p class="attrib small">${esc(ch.name)} · Previews via Deezer</p>
    </main>`;

  club = new Club(document.getElementById('club'), { accent: ACCENT });
  document.getElementById('guessForm').onsubmit = (e) => { e.preventDefault(); submitGuess(); };
  document.getElementById('hintBtn').onclick = useHint;
  document.getElementById('skipBtn').onclick = () => endRound('skip');
  document.getElementById('resumeBtn').onclick = () => {
    document.getElementById('resume').hidden = true;
    audio.play().catch(() => {});
  };
  window.onkeydown = (e) => { if (e.key === 'Escape' && state.screen === 'game') endRound('skip'); };

  cancelAnimationFrame(raf);
  last = performance.now();
  raf = requestAnimationFrame(loop);
}

async function startRound(nx, alreadyPlaying = false) {
  const run = state.run;
  run.paused = true;
  setInput(false);
  document.getElementById('hintline').textContent = '';
  if (!nx) {
    try {
      nx = next ? takeNext() : (await prepareNext(), takeNext());
    } catch (e) {
      feed(`Couldn't load the next track (${esc(e.message)}).`, 'miss');
      return setTimeout(() => startRound(), 2000);
    }
    if (!nx || run.over || state.run !== run) return;
  }
  if (!alreadyPlaying) {
    audio.src = nx.details.preview;
    audio.play().catch(() => { document.getElementById('resume').hidden = false; });
  }

  const d = nx.details;
  const r = {
    details: d,
    sheet: answerSheet(d),
    solved: { track: false, label: false, artist: false, creditsHit: new Set() },
    startedAt: 0,
    elapsed: 0,
    hinted: false,
    ended: false,
  };
  run.round = r;
  document.getElementById('emerging').hidden = !d.emerging;
  updateLegend();
  club.bpm = d.bpm;
  const creditsP = d._mockCredits ? Promise.resolve(d._mockCredits) : fetchCredits(d.isrc);
  creditsP.then((names) => { if (run.round === r) addCredits(r.sheet, names); });

  // The clock starts when sound actually starts
  const go = () => {
    if (run.round !== r || r.ended || run.over) return;
    r.startedAt = performance.now();
    run.paused = false;
    setInput(true);
  };
  audio.onplaying = null;
  if (useMock() || (!audio.paused && audio.currentTime > 0)) go();
  else audio.onplaying = () => { audio.onplaying = null; go(); };

  audio.onerror = () => {
    if (run.round !== r || r.ended) return;
    feed('That preview would not play. Next track.', 'miss');
    endRound('error', true);
  };
  if (!useMock()) {
    setTimeout(() => {
      if (run.round === r && !r.ended && !r.startedAt) document.getElementById('resume').hidden = false;
    }, 1800);
  }
}

function setInput(on) {
  const i = document.getElementById('guess');
  if (!i) return;
  i.disabled = !on;
  if (on) i.focus();
}

function submitGuess() {
  const run = state.run;
  const r = run?.round;
  const input = document.getElementById('guess');
  const g = input.value.trim();
  if (!r || r.ended || run.paused || !g) return;
  input.value = '';
  if (g === '?') return useHint();

  const t = performance.now() - r.startedAt;
  const res = judge(g, r.sheet, r.solved, r.details.emerging);
  if (['track', 'label', 'artist', 'credit'].includes(res.kind)) {
    if (res.kind === 'credit') r.solved.creditsHit.add(res.name);
    else r.solved[res.kind] = true;
    const pct = payoutAt(t);
    const moves = res.moves * pct;
    const label = res.kind === 'credit' ? 'CREDIT' : res.kind.toUpperCase();
    if (moves > 0) {
      advance(moves);
      feed(`${label} +${num(moves)} at ${secs(t)}${pct < 1 ? ` (${pct * 100}%)` : ''}`, 'hit');
    } else {
      feed(`${label} right at ${secs(t)}, too late to move.`, 'dim');
    }
  } else if (res.kind === 'dupe') {
    feed('Already got that one.', 'dim');
  } else if (res.kind === 'miss') {
    run.horde += run.mode.noise;
    feed(`"${esc(g)}" isn't it. They heard you.`, 'miss');
    shake();
  }
  updateLegend();
  const s = r.solved;
  if (s.track && s.label && s.artist) setTimeout(() => endRound('cleared'), 500);
}

function useHint() {
  const r = state.run?.round;
  if (!r || r.hinted || state.run.paused || r.ended) return;
  r.hinted = true;
  state.run.horde += state.run.mode.hintCost;
  document.getElementById('hintline').textContent = hintText(r.details);
  feed(`Hint used. The horde gains ${num(state.run.mode.hintCost)}.`, 'miss');
}

function advance(m) {
  state.run.player = Math.min(EXIT_MOVES, state.run.player + m);
}

function endRound(why, silent = false) {
  const run = state.run;
  const r = run?.round;
  if (!r || r.ended || run.over) return;
  r.ended = true;
  run.paused = true;
  setInput(false);
  run.history.push({ details: r.details, solved: r.solved, why });
  if (run.player >= EXIT_MOVES) return; // the loop finishes the walk and ends the run
  if (silent) { audio.pause(); return startRound(); }
  if (why === 'time') feed("Time's up.", 'dim');
  showReveal(r); // the preview keeps playing under the reveal
}

function showReveal(r) {
  const el = document.getElementById('reveal');
  const d = r.details;
  const s = r.solved;
  const mark = (ok) => (ok ? '<em class="ok">got it</em>' : '<em class="no">missed</em>');
  el.innerHTML = `
    <div class="rcard">
      ${d.cover ? `<img src="${esc(d.cover)}" alt="">` : '<div class="nocover"></div>'}
      <div class="rtext">
        <p class="rk">That was</p>
        <p class="rtitle">${esc(d.title)} ${mark(s.track)}</p>
        <p class="rline">${esc(d.mainArtists.join(', '))} ${mark(s.artist)}${d.featuredArtists.length ? ` <span class="dim">with ${esc(d.featuredArtists.join(', '))}</span>` : ''}</p>
        <p class="rline">${esc(d.label || 'Label not listed')} ${d.label ? mark(s.label) : ''}${d.releaseDate ? ` <span class="dim">· ${esc(d.releaseDate.slice(0, 4))}</span>` : ''}</p>
        <p class="rlinks"><a href="${esc(d.link)}" target="_blank" rel="noopener">Listen on Deezer</a> <button class="linkbtn" id="nextBtn">Next track</button></p>
      </div>
    </div>`;
  el.hidden = false;
  let done = false;
  const go = (nx, playing = false) => {
    if (done || state.run?.over) return;
    done = true;
    el.hidden = true;
    startRound(nx, playing);
  };
  document.getElementById('nextBtn').onclick = () => {
    // a click is a user gesture, so starting audio here always works
    if (next) {
      const nx = takeNext();
      audio.src = nx.details.preview;
      audio.play().catch(() => {});
      return go(nx, true);
    }
    go();
  };
  setTimeout(() => go(), REVEAL_MS);
}

function loop(now) {
  const run = state.run;
  if (state.screen !== 'game' || !run) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const r = run.round;

  if (!run.paused && !run.over) {
    run.activeMs += dt * 1000;
    const room = Math.max(0, roomIndexAt(run.horde));
    run.horde += dt / (HORDE_SEC_PER_MOVE[room] * run.mode.hordePace);
    if (r?.startedAt) {
      r.elapsed = now - r.startedAt;
      if (r.elapsed >= ROUND_MS) endRound('time');
    }
  }
  const walking = run.shown < run.player - 0.01;
  if (walking) run.shown = Math.min(run.player, run.shown + WALK_SPEED * dt);

  if (!run.over && run.horde >= run.shown && run.shown < EXIT_MOVES) return caught();
  if (!run.over && run.shown >= EXIT_MOVES) return escaped();

  const bpm = club.bpm || 124;
  const beatPos = (useMock() ? now / 1000 : audio.currentTime || now / 1000) * (bpm / 60);
  club.update(dt);
  club.draw({
    t: now / 1000,
    beat: beatPos % 1,
    beatCount: Math.floor(beatPos),
    player: { moves: run.shown, walking, sprite: character() },
    horde: { moves: run.horde },
    danger: Math.max(0, Math.min(1, (DANGER.warn - (run.shown - run.horde)) / (DANGER.warn - DANGER.critical))),
  });

  const el = r?.startedAt ? Math.min(ROUND_MS, r.elapsed) : 0;
  document.getElementById('runT').textContent = fmt(run.activeMs);
  const clock = document.getElementById('clockT');
  clock.textContent = secs(ROUND_MS - el);
  updateDanger(run);
  clock.dataset.zone = PAYOUT.findIndex((p) => el < p.until);
  document.getElementById('needle').style.left = `${(el / ROUND_MS) * 100}%`;
  document.getElementById('roomN').textContent = ROOMS[roomIndexAt(run.shown)].name;
  raf = requestAnimationFrame(loop);
}

function caught() {
  const run = state.run;
  run.over = true;
  run.result = 'caught';
  audio.pause();
  setInput(false);
  document.getElementById('reveal').hidden = true;
  const scare = document.getElementById('scare');
  drawJumpscare(scare);
  scare.hidden = false;
  document.querySelector('.stage').classList.add('shake');
  setTimeout(finish, 1400);
}

function escaped() {
  const run = state.run;
  run.over = true;
  run.result = 'escaped';
  audio.pause();
  if (run.round && !run.round.ended) {
    run.round.ended = true;
    run.history.push({ details: run.round.details, solved: run.round.solved });
  }
  const key = `sm_best_${run.mode.id}_${state.characterId}`;
  const best = Number(load(key, 0));
  run.newBest = !best || run.activeMs < best;
  if (run.newBest) save(key, String(Math.round(run.activeMs)));
  setTimeout(finish, 600);
}

function finish() {
  cancelAnimationFrame(raf);
  window.onkeydown = null;
  state.screen = 'end';
  render();
}

function renderEnd() {
  const run = state.run;
  const won = run.result === 'escaped';
  const best = Number(load(`sm_best_${run.mode.id}_${state.characterId}`, 0));
  const heard = run.history.filter((h) => h.details);
  app.innerHTML = `
    <main class="screen end">
      <p class="modetag">${esc(run.mode.level)} · ${esc(run.mode.name)}</p>
      <h2 class="result ${won ? 'win' : 'lose'}">${won ? 'You got out' : 'They got you'}</h2>
      <p class="sub">${won ? `${esc(character().name)} made the back exit in <b>${fmt(run.activeMs)}</b>.${run.newBest ? ' New best.' : ''}` : `${esc(character().name)} went down in the ${esc(ROOMS[roomIndexAt(run.shown)].name.toLowerCase())}, ${num(Math.max(0, EXIT_MOVES - run.player))} moves from the exit.`}</p>
      ${best ? `<p class="sub dim">Best escape on ${esc(run.mode.name)} with ${esc(character().name)}: ${fmt(best)}</p>` : ''}
      ${heard.length ? `
        <h3 class="h3">What you heard tonight</h3>
        <ul class="heard">
          ${heard.map((h) => `
            <li>
              ${h.details.cover ? `<img src="${esc(h.details.cover)}" alt="">` : '<span class="nocover sm"></span>'}
              <span class="ht"><b>${esc(h.details.title)}</b><br>${esc(h.details.mainArtists.join(', '))}${h.details.label ? ` · ${esc(h.details.label)}` : ''}</span>
              <a href="${esc(h.details.link)}" target="_blank" rel="noopener">Deezer</a>
            </li>`).join('')}
        </ul>` : ''}
      <div class="startrow">
        <button class="btn primary" id="again" ${next ? '' : 'disabled'}>Run it back</button>
        <button class="btn ghost" id="chars">Change character</button>
        <button class="btn ghost" id="modes">Change difficulty</button>
      </div>
      ${ATTRIB}
    </main>`;
  const again = document.getElementById('again');
  again.onclick = beginRun;
  if (!next) prepareNext().then(() => { again.disabled = false; }).catch(() => {});
  document.getElementById('chars').onclick = () => { state.screen = 'select'; render(); };
  document.getElementById('modes').onclick = () => { state.screen = 'mode'; render(); };
}

// ---------- danger feedback ----------
function updateDanger(run) {
  const gap = run.shown - run.horde;
  const pct = (m) => `${Math.max(0, Math.min(100, (m / EXIT_MOVES) * 100))}%`;
  document.getElementById('ryou').style.left = pct(run.shown);
  document.getElementById('rhorde').style.left = pct(run.horde);
  const g = document.getElementById('rgap');
  g.style.left = pct(Math.max(0, run.horde));
  g.style.width = `calc(${pct(run.shown)} - ${pct(Math.max(0, run.horde))})`;

  const level = gap <= DANGER.critical ? 'critical' : gap <= DANGER.close ? 'close' : gap <= DANGER.warn ? 'warn' : 'safe';
  const status = {
    safe: `Safe for now · ${num(Math.max(0, gap))} moves ahead`,
    warn: `They're gaining · ${num(gap)} moves ahead`,
    close: `They're right behind you · ${num(gap)} moves`,
    critical: `RUN · ${num(Math.max(0, gap))} moves`,
  }[level];
  const el = document.getElementById('rstatus');
  el.textContent = status;
  const main = document.querySelector('.game');
  if (main.dataset.danger !== level) {
    main.dataset.danger = level;
    const w = document.getElementById('warn');
    if (level === 'close' || level === 'critical') {
      w.textContent = level === 'critical' ? 'THEY ARE ON YOU' : "THEY'RE RIGHT BEHIND YOU";
      w.hidden = false;
    } else {
      w.hidden = true;
    }
    if (level === 'close' || level === 'critical') shake();
  }
}

// ---------- ui bits ----------
function feed(html, cls = '') {
  const f = document.getElementById('feed');
  if (!f) return;
  const li = document.createElement('li');
  li.className = cls;
  li.innerHTML = html;
  f.prepend(li);
  while (f.children.length > 4) f.lastChild.remove();
}

function updateLegend() {
  const s = state.run?.round?.solved;
  document.querySelectorAll('#legend li').forEach((li) => {
    const k = li.dataset.k;
    const on = s && (k === 'credit' ? s.creditsHit.size >= CREDIT_CAP : s[k]);
    li.classList.toggle('done', !!on);
  });
  const cc = document.getElementById('creditCount');
  if (cc) cc.textContent = `${s ? s.creditsHit.size : 0}/${CREDIT_CAP}`;
}

function shake() {
  const st = document.querySelector('.stage');
  if (!st) return;
  st.classList.remove('shake');
  void st.offsetWidth;
  st.classList.add('shake');
}

render();
window.__sm = { state };
