import './style.css';
import { CHARACTERS, spriteFrame } from './game/sprites.js';
import { Club, ROOMS, EXIT_MOVES, roomIndexAt, drawJumpscare } from './game/club.js';
import { answerSheet, addCredits, judge, hintText, MOVES, CREDIT_CAP, EMERGING_MULT } from './game/match.js';
import { buildPool, roundDetails, fetchCredits, useMock } from './data/tracks.js';

// ---------- tuning ----------
const HORDE_START = -6; // moves behind the player at the start
const HORDE_SEC_PER_MOVE = [10, 8.5, 7, 6, 5]; // by room: horde speeds up deeper in
const NOISE = 0.5; // wrong guess: horde lurches forward this many moves
const HINT_COST = 1.5;
const WALK_SPEED = 3; // moves per second when animating forward
const REVEAL_MS = 4000;

const ACCENT = getComputedStyle(document.documentElement).getPropertyValue('--sc-orange').trim() || '#ff5f15';
const app = document.getElementById('app');
const audio = new Audio();
audio.preload = 'auto';

const state = {
  screen: 'title',
  characterId: load('sm_char', 'summit'),
  pool: null,
  poolError: null,
  poolIndex: 0,
  run: null,
};

let poolPromise = null;
function ensurePool() {
  if (!poolPromise) {
    poolPromise = buildPool()
      .then((p) => { state.pool = p; state.poolError = null; return p; })
      .catch((e) => { state.poolError = e.message; poolPromise = null; throw e; });
  }
  return poolPromise;
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
const moveStr = (n) => (Number.isInteger(n) ? String(n) : n % 1 === 0.5 ? `${Math.floor(n) || ''}½` : n.toFixed(2).replace(/0$/, ''));
const character = () => CHARACTERS.find((c) => c.id === state.characterId) || CHARACTERS[0];

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
  if (state.screen === 'title') return renderTitle();
  if (state.screen === 'select') return renderSelect();
  if (state.screen === 'game') return renderGame();
  if (state.screen === 'end') return renderEnd();
}

function renderTitle() {
  app.innerHTML = `
    <main class="screen title">
      ${LOGO}
      <p class="tagline">The red room is packed and the crowd has turned. A track is playing. Name it, name the label, name the artist. Every right answer moves you closer to the exit.</p>
      <button class="btn primary" id="go">Enter the club</button>
      ${useMock() ? '<p class="mocknote">Mock mode: offline test tracks, no audio.</p>' : ''}
      ${ATTRIB}
    </main>`;
  document.getElementById('go').onclick = () => { state.screen = 'select'; render(); };
  ensurePool().catch(() => {});
}

function renderSelect() {
  app.innerHTML = `
    <main class="screen select">
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
  document.getElementById('back').onclick = () => { state.screen = 'title'; render(); };

  const start = document.getElementById('start');
  const errEl = document.getElementById('poolerr');
  const ready = () => { start.disabled = false; start.textContent = 'Start the run'; };
  if (state.pool) ready();
  else {
    ensurePool().then(ready).catch((e) => {
      errEl.hidden = false;
      errEl.textContent = `Couldn't load tracks from Deezer (${e.message}).`;
      start.disabled = false;
      start.textContent = 'Try again';
      start.onclick = () => { errEl.hidden = true; start.disabled = true; start.textContent = 'Loading tracks…'; ensurePool().then(() => { ready(); start.onclick = beginRun; }).catch(() => renderSelect()); };
    });
  }
  start.onclick = beginRun;
}

// Must run synchronously inside the click so browsers allow audio to start.
function beginRun() {
  if (!state.pool) return;
  const entry = state.pool[state.poolIndex % state.pool.length];
  audio.src = entry.preview;
  audio.play().catch(() => {});
  state.run = {
    player: 0,
    shown: 0,
    horde: HORDE_START,
    activeMs: 0,
    round: null,
    history: [],
    over: false,
    paused: true,
    firstEntry: entry,
  };
  state.screen = 'game';
  render();
}

// ---------- game ----------
let club = null;
let raf = 0;
let last = 0;

function renderGame() {
  const ch = character();
  app.innerHTML = `
    <main class="screen game">
      <header class="hud">
        <div class="stat"><span class="k">RUN</span><span class="v" id="runT">00:00.000</span></div>
        <div class="stat mid"><span class="k">ROOM</span><span class="v" id="roomN">COAT CHECK</span></div>
        <div class="stat right"><span class="k">THIS TRACK</span><span class="v" id="trackT">00:00.000</span></div>
      </header>
      <div class="stage">
        <canvas id="club" class="pix"></canvas>
        <div class="badge" id="emerging" hidden>EMERGING ×1.5</div>
        <div class="reveal" id="reveal" hidden></div>
        <canvas id="scare" class="pix scare" hidden></canvas>
      </div>
      <ul class="legend" id="legend">
        <li data-k="track"><b>TRACK</b> +3</li>
        <li data-k="label"><b>LABEL</b> +2</li>
        <li data-k="artist"><b>ARTIST</b> +1</li>
        <li data-k="credit"><b>FEAT / CREDIT</b> +½ <i id="creditCount">0/${CREDIT_CAP}</i></li>
      </ul>
      <form class="guess" id="guessForm" autocomplete="off">
        <input id="guess" placeholder="Name the track, label or artist" maxlength="120" disabled>
        <button type="button" class="btn small ghost" id="hintBtn" title="Costs you ground">Hint</button>
        <button type="button" class="btn small ghost" id="skipBtn" title="Esc">Skip</button>
      </form>
      <div class="hintline" id="hintline"></div>
      <ol class="feed" id="feed"></ol>
      <div class="resume" id="resume" hidden><button class="btn primary" id="resumeBtn">Tap to keep the music going</button></div>
      <p class="attrib small">${ch.name} · Previews via Deezer</p>
    </main>`;

  club = new Club(document.getElementById('club'), { accent: ACCENT });
  const form = document.getElementById('guessForm');
  form.onsubmit = (e) => { e.preventDefault(); submitGuess(); };
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
  startRound(state.run.firstEntry);
}

async function startRound(entry) {
  const run = state.run;
  if (!entry) {
    entry = state.pool[state.poolIndex % state.pool.length];
    audio.src = entry.preview;
    audio.play().catch(() => { document.getElementById('resume').hidden = false; });
  }
  run.paused = true;
  const r = {
    entry,
    details: null,
    sheet: null,
    solved: { track: false, label: false, artist: false, creditsHit: new Set() },
    startedAt: 0,
    elapsed: 0,
    hinted: false,
    ended: false,
  };
  run.round = r;
  setInput(false);
  document.getElementById('hintline').textContent = '';
  document.getElementById('emerging').hidden = !entry.emerging;
  updateLegend();

  try {
    r.details = await roundDetails(entry);
  } catch (e) {
    feed(`Couldn't load that track (${e.message}). Next.`, 'miss');
    state.poolIndex++;
    return startRound();
  }
  if (run.round !== r) return;
  r.sheet = answerSheet(r.details);
  const creditsP = r.details._mockCredits ? Promise.resolve(r.details._mockCredits) : fetchCredits(r.details.isrc);
  creditsP.then((names) => { if (run.round === r) addCredits(r.sheet, names); });
  club.bpm = r.details.bpm;

  const go = () => {
    if (run.round !== r || r.ended) return;
    r.startedAt = performance.now();
    run.paused = false;
    setInput(true);
  };
  if (!audio.paused && audio.currentTime > 0) go();
  else {
    audio.onplaying = () => { audio.onplaying = null; go(); };
    // silent mock audio never "plays" in a meaningful way
    if (useMock()) setTimeout(go, 300);
  }
  if (useMock()) {
    audio.onended = null;
    setTimeout(() => { if (run.round === r) endRound('time'); }, 30000);
  } else {
    audio.onended = () => { if (run.round === r) endRound('time'); };
    // If the browser blocked playback, offer a tap to start it
    setTimeout(() => {
      if (run.round === r && !r.ended && audio.paused) document.getElementById('resume').hidden = false;
    }, 1500);
  }
  audio.onerror = () => {
    if (run.round !== r) return;
    if (r.details.preview && audio.src !== r.details.preview) {
      audio.src = r.details.preview;
      audio.play().catch(() => { document.getElementById('resume').hidden = false; });
    } else {
      feed('That preview would not play. Next track.', 'miss');
      endRound('error');
    }
  };
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
  if (!r || !r.sheet || run.paused || !g) return;
  if (g === '?') { input.value = ''; return useHint(); }
  input.value = '';

  const res = judge(g, r.sheet, r.solved, r.details.emerging);
  const t = fmt(performance.now() - r.startedAt);
  if (res.kind === 'track' || res.kind === 'label' || res.kind === 'artist') {
    r.solved[res.kind] = true;
    advance(res.moves);
    feed(`${res.kind.toUpperCase()} +${moveStr(res.moves)} at ${t}`, 'hit');
  } else if (res.kind === 'credit') {
    r.solved.creditsHit.add(res.name);
    advance(res.moves);
    feed(`CREDIT +${moveStr(res.moves)} at ${t}`, 'hit');
  } else if (res.kind === 'dupe') {
    feed('Already got that one.', 'dim');
  } else if (res.kind === 'miss') {
    run.horde += NOISE;
    feed(`"${esc(g)}" isn't it. They heard you.`, 'miss');
    shake();
  }
  updateLegend();
  const s = r.solved;
  if (s.track && s.label && s.artist) setTimeout(() => endRound('cleared'), 600);
}

function useHint() {
  const r = state.run?.round;
  if (!r || !r.details || r.hinted || state.run.paused) return;
  r.hinted = true;
  state.run.horde += HINT_COST;
  document.getElementById('hintline').textContent = hintText(r.details);
  feed(`Hint used. The horde gains ${moveStr(HINT_COST)}.`, 'miss');
}

function advance(m) {
  state.run.player = Math.min(EXIT_MOVES, state.run.player + m);
}

function endRound(why) {
  const run = state.run;
  const r = run?.round;
  if (!r || r.ended || run.over) return;
  r.ended = true;
  run.paused = true;
  setInput(false);
  audio.onended = null;
  audio.pause();
  state.poolIndex++;
  run.history.push({ details: r.details, solved: { ...r.solved, credits: r.solved.creditsHit.size }, time: r.elapsed, why });
  if (run.player >= EXIT_MOVES) return; // loop handles the win once the walk finishes
  showReveal(r, () => startRound());
}

function showReveal(r, next) {
  const el = document.getElementById('reveal');
  const d = r.details;
  if (!d) return next();
  const s = r.solved;
  const mark = (ok) => (ok ? '<em class="ok">got it</em>' : '<em class="no">missed</em>');
  el.innerHTML = `
    <div class="rcard">
      ${d.cover ? `<img src="${esc(d.cover)}" alt="">` : '<div class="nocover"></div>'}
      <div class="rtext">
        <p class="rk">That was</p>
        <p class="rtitle">${esc(d.title)} ${mark(s.track)}</p>
        <p class="rline">${esc(d.mainArtists.join(', '))} ${mark(s.artist)}${d.featuredArtists.length ? ` <span class="dim">with ${esc(d.featuredArtists.join(', '))}</span>` : ''}</p>
        <p class="rline">${esc(d.label || 'Label not listed')} ${d.label ? mark(s.label) : ''}</p>
        <p class="rlinks"><a href="${esc(d.link)}" target="_blank" rel="noopener">Listen on Deezer</a> <button class="linkbtn" id="nextBtn">Next track</button></p>
      </div>
    </div>`;
  el.hidden = false;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    el.hidden = true;
    next();
  };
  document.getElementById('nextBtn').onclick = () => {
    // a click is a user gesture, so audio for the next track is guaranteed to start
    const entry = state.pool[state.poolIndex % state.pool.length];
    audio.src = entry.preview;
    audio.play().catch(() => {});
    done = true;
    el.hidden = true;
    startRound(entry);
  };
  setTimeout(go, REVEAL_MS);
}

function loop(now) {
  const run = state.run;
  if (state.screen !== 'game' || !run) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (!run.paused && !run.over) {
    run.activeMs += dt * 1000;
    const room = roomIndexAt(run.horde);
    run.horde += dt / HORDE_SEC_PER_MOVE[Math.max(0, room)];
    if (run.round && run.round.startedAt) run.round.elapsed = now - run.round.startedAt;
  }
  // walk the player toward their earned position
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
    danger: Math.max(0, Math.min(1, 1 - (run.shown - run.horde) / 6)),
  });

  document.getElementById('runT').textContent = fmt(run.activeMs);
  document.getElementById('trackT').textContent = fmt(run.round?.elapsed || 0);
  document.getElementById('roomN').textContent = ROOMS[roomIndexAt(run.shown)].name;
  raf = requestAnimationFrame(loop);
}

function caught() {
  const run = state.run;
  run.over = true;
  run.result = 'caught';
  audio.pause();
  setInput(false);
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
    run.history.push({ details: run.round.details, solved: { ...run.round.solved, credits: run.round.solved.creditsHit.size } });
  }
  const key = `sm_best_${state.characterId}`;
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
  const best = Number(load(`sm_best_${state.characterId}`, 0));
  const heard = run.history.filter((h) => h.details);
  app.innerHTML = `
    <main class="screen end">
      <h2 class="result ${won ? 'win' : 'lose'}">${won ? 'You got out' : 'They got you'}</h2>
      <p class="sub">${won ? `${esc(character().name)} made the back exit in <b>${fmt(run.activeMs)}</b>.${run.newBest ? ' New best.' : ''}` : `${esc(character().name)} went down in the ${esc(ROOMS[roomIndexAt(run.shown)].name.toLowerCase())}, ${moveStr(Math.max(0, EXIT_MOVES - run.player))} moves from the exit.`}</p>
      ${best ? `<p class="sub dim">Best escape with ${esc(character().name)}: ${fmt(best)}</p>` : ''}
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
        <button class="btn primary" id="again">Run it back</button>
        <button class="btn ghost" id="chars">Change character</button>
      </div>
      ${ATTRIB}
    </main>`;
  document.getElementById('again').onclick = beginRun;
  document.getElementById('chars').onclick = () => { state.screen = 'select'; render(); };
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
  const r = state.run?.round;
  const s = r?.solved;
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

// exported for quick console poking during development
window.__sm = { state, MOVES, EMERGING_MULT };
