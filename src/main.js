import './style.css';
import { beginLogin, handleRedirectIfPresent, isLoggedIn, clearTokens } from './spotify/auth.js';
import { loadDiscoveryQueue } from './spotify/api.js';
import { SidechainPlayer } from './spotify/player.js';
import { charactersWithUnlockState, registerRunResult } from './game/characters.js';
import { ROOMS, difficultyForRoom, randDigits } from './game/rounds.js';

const app = document.getElementById('app');

const state = {
  screen: 'loading', // loading | title | characters | game | result
  error: null,
  selectedCharacterId: 'the-summit',
  queue: [],
  queueIndex: 0,
  player: null,
  run: null, // { room, zombie, score, streak, roundsThisRoom }
  lastResult: null,
};

function render() {
  if (state.screen === 'loading') return renderLoading();
  if (state.screen === 'title') return renderTitle();
  if (state.screen === 'characters') return renderCharacters();
  if (state.screen === 'game') return renderGame();
  if (state.screen === 'result') return renderResult();
}

function renderLoading() {
  app.innerHTML = `
    <div class="stage">
      <div class="screen">
        <div class="logo" style="font-size:clamp(28px,9vw,42px)">SIDECHAIN<br>MASSACRE</div>
        <div class="tagline">warming up the sound system…</div>
      </div>
    </div>`;
}

function renderTitle() {
  app.innerHTML = `
    <div class="stage">
      <div class="screen">
        <div class="logo" style="font-size:clamp(28px,9vw,42px)">SIDECHAIN<br>MASSACRE</div>
        <div class="tagline">The red room is packed and something's wrong with the crowd. A number flashes on the beat — memorize it, type it, keep moving before they get to you.</div>
        ${state.error ? `<div class="errorBox">${escapeHtml(state.error)}</div>` : ''}
        ${
          isLoggedIn()
            ? `<button class="btn btn-primary" id="continueBtn">Choose Your Fighter</button>
               <button class="btn btn-ghost" id="logoutBtn">Log out of Spotify</button>`
            : `<button class="btn btn-primary" id="loginBtn">Connect Spotify</button>
               <div class="tagline" style="font-size:10px">Needs Spotify Premium — this plays real tracks through your own account.</div>`
        }
      </div>
    </div>`;

  document.getElementById('loginBtn')?.addEventListener('click', async () => {
    try {
      await beginLogin();
    } catch (e) {
      state.error = e.message;
      render();
    }
  });
  document.getElementById('continueBtn')?.addEventListener('click', () => {
    state.screen = 'characters';
    render();
  });
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearTokens();
    render();
  });
}

function renderCharacters() {
  const chars = charactersWithUnlockState();
  app.innerHTML = `
    <div class="stage">
      <div class="screen">
        <div class="logo" style="font-size:22px">CHOOSE YOUR FIGHTER</div>
        <div class="charGrid">
          ${chars
            .map(
              (c) => `
            <div class="charCard ${c.unlocked ? '' : 'locked'} ${c.id === state.selectedCharacterId ? 'selected' : ''}" data-id="${c.id}" data-unlocked="${c.unlocked}">
              <div class="portrait ${c.portraitClass}"></div>
              <div class="name">${c.name}</div>
              <div class="sub">${c.unlocked ? c.blurb : c.subtitle}</div>
            </div>`
            )
            .join('')}
        </div>
        ${state.error ? `<div class="errorBox">${escapeHtml(state.error)}</div>` : ''}
        <button class="btn btn-secondary" id="dropInBtn">Drop In</button>
        <button class="btn btn-ghost" id="backBtn">Back</button>
      </div>
    </div>`;

  app.querySelectorAll('.charCard').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.unlocked !== 'true') return;
      state.selectedCharacterId = el.dataset.id;
      render();
    });
  });
  document.getElementById('backBtn').addEventListener('click', () => {
    state.screen = 'title';
    render();
  });
  document.getElementById('dropInBtn').addEventListener('click', startGame);
}

// ---------------- Game screen + logic ----------------

function renderGame() {
  app.innerHTML = `
    <div class="stage">
      <div class="hud">
        <div class="rooms" id="rooms"></div>
        <div class="meterRow">
          <span class="meterLabel">EXIT &rarr;</span>
          <div class="meterTrack"><div class="meterFill" id="meterFill"></div><div class="meterZombie" id="meterZombie">&#129440;</div></div>
        </div>
        <div class="scoreRow">
          <span>STREAK <b id="streakVal">0</b></span>
          <span>SCORE <b id="scoreVal">0</b></span>
        </div>
        <div class="nowPlaying" id="nowPlaying">loading track…</div>
      </div>
      <div class="arena" id="arena">
        <div class="cue" id="cue">watch the drop</div>
        <div class="flashNum" id="flashNum">--</div>
      </div>
      <div class="inputRow">
        <input id="answerInput" type="text" inputmode="numeric" placeholder="type the number you saw…" maxlength="6" autocomplete="off" disabled>
        <button class="sendBtn" id="sendBtn" disabled>&#8626;</button>
      </div>
    </div>`;

  els.rooms = document.getElementById('rooms');
  ROOMS.forEach((name) => {
    const d = document.createElement('div');
    d.className = 'room';
    d.textContent = name;
    els.rooms.appendChild(d);
  });
  els.meterFill = document.getElementById('meterFill');
  els.meterZombie = document.getElementById('meterZombie');
  els.streakVal = document.getElementById('streakVal');
  els.scoreVal = document.getElementById('scoreVal');
  els.nowPlaying = document.getElementById('nowPlaying');
  els.arena = document.getElementById('arena');
  els.cue = document.getElementById('cue');
  els.flashNum = document.getElementById('flashNum');
  els.input = document.getElementById('answerInput');
  els.sendBtn = document.getElementById('sendBtn');

  els.sendBtn.addEventListener('click', submitAnswer);
  els.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAnswer(); });
  els.input.addEventListener('input', () => { els.input.value = els.input.value.replace(/[^0-9]/g, ''); });

  updateHud();
}

const els = {};
const round = { active: false, target: '', timers: [], hinted: false, digits: 2, windowStartTs: 0 };

function updateHud() {
  const run = state.run;
  const roomEls = els.rooms.children;
  for (let i = 0; i < roomEls.length; i++) {
    roomEls[i].classList.remove('done', 'now');
    if (i < run.room) roomEls[i].classList.add('done');
    else if (i === run.room) roomEls[i].classList.add('now');
  }
  els.meterFill.style.width = run.zombie + '%';
  els.meterZombie.style.left = Math.min(96, run.zombie) + '%';
  els.streakVal.textContent = run.streak;
  els.scoreVal.textContent = run.score;
}

function currentTrack() {
  return state.queue[state.queueIndex % Math.max(1, state.queue.length)];
}

async function startGame() {
  state.error = null;
  state.run = { room: 0, zombie: 0, score: 0, streak: 0, roundsThisRoom: 0 };
  state.screen = 'game';
  render();

  try {
    els.nowPlaying.textContent = 'finding tracks…';
    if (!state.queue.length) {
      state.queue = await loadDiscoveryQueue({ trackCount: 20 });
    }
    if (!state.queue.length) throw new Error('No tracks found from Spotify search — try again in a bit.');

    if (!state.player) {
      state.player = new SidechainPlayer();
      els.nowPlaying.textContent = 'connecting to Spotify…';
      await state.player.connect();
    }
    await playCurrentTrack();
  } catch (e) {
    state.error = e.message;
    state.screen = 'title';
    render();
    return;
  }

  nextRound();
}

async function playCurrentTrack() {
  const track = currentTrack();
  if (!track) return;
  els.nowPlaying.innerHTML = `now playing: <b>${escapeHtml(track.name)}</b> — ${escapeHtml(track.artists?.map((a) => a.name).join(', ') || '')}`;
  await state.player.playTrackUri(track.uri);
}

function clearRoundTimers() {
  round.timers.forEach(clearTimeout);
  round.timers = [];
}

function nextRound() {
  clearRoundTimers();
  const diff = difficultyForRoom(state.run.room);
  round.digits = diff.digits;
  round.hinted = false;
  els.cue.textContent = 'watch the drop';
  els.cue.classList.remove('live');
  els.flashNum.textContent = '?';
  els.flashNum.style.opacity = '0.25';
  els.input.value = '';
  els.input.disabled = true;
  els.sendBtn.disabled = true;

  const delay = 1200 + Math.random() * 1800;
  round.timers.push(setTimeout(() => showFlash(diff), delay));
}

function showFlash(diff) {
  round.target = randDigits(round.digits);
  els.flashNum.textContent = round.target;
  els.flashNum.style.opacity = '1';
  els.cue.textContent = 'type it — go!';
  els.cue.classList.add('live');
  els.input.disabled = false;
  els.sendBtn.disabled = false;
  els.input.focus();
  round.windowStartTs = performance.now();
  round.active = true;

  round.timers.push(
    setTimeout(() => {
      if (round.active) els.flashNum.textContent = '••••'.slice(0, round.digits);
    }, diff.flashMs)
  );

  round.timers.push(
    setTimeout(() => {
      if (!round.active) return;
      round.hinted = true;
      els.flashNum.textContent = round.target[0] + '••'.slice(0, round.digits - 1);
      els.flashNum.style.opacity = '0.85';
      els.cue.textContent = "hint... it's costing you";
    }, diff.hintDelay)
  );
}

function submitAnswer() {
  if (!round.active) return;
  const val = els.input.value.trim();
  if (val === '') return;
  const elapsed = performance.now() - round.windowStartTs;
  round.active = false;
  clearRoundTimers();
  els.input.disabled = true;
  els.sendBtn.disabled = true;
  resolveRound(val === round.target, elapsed);
}

function flashArena(good) {
  els.arena.style.boxShadow = good ? '0 0 0 2px var(--acid) inset' : '0 0 0 2px var(--red) inset';
  setTimeout(() => { els.arena.style.boxShadow = 'none'; }, 260);
}

function resolveRound(correct, elapsedMs) {
  const run = state.run;
  if (correct) {
    const speedBonus = Math.max(0, 1 - elapsedMs / 4000);
    const base = 40 + Math.round(speedBonus * 60);
    const penalty = round.hinted ? Math.round(base * 0.5) : 0;
    const gained = base - penalty;
    run.score += gained;
    run.streak += 1;
    const advance = round.hinted ? 10 : elapsedMs < 900 ? 30 : elapsedMs < 1800 ? 22 : 16;
    run.zombie = Math.max(0, run.zombie - advance);
    els.cue.textContent = round.hinted ? `+${gained} · hint cost you` : `+${gained} nice!`;
    els.flashNum.textContent = round.target;
    flashArena(true);

    run.roundsThisRoom += 1;
    const neededHits = 2 + run.room;
    if (run.roundsThisRoom >= neededHits) {
      run.roundsThisRoom = 0;
      run.room += 1;
      run.zombie = Math.max(0, run.zombie - 20);
      state.queueIndex += 1;
      if (run.room >= ROOMS.length) {
        endGame(true);
        return;
      }
      playCurrentTrack().catch((e) => console.warn('track advance failed', e));
    }
  } else {
    run.streak = 0;
    run.zombie = Math.min(100, run.zombie + (round.hinted ? 22 : 32));
    els.cue.textContent = 'wrong — they heard that';
    els.flashNum.textContent = round.target;
    flashArena(false);
  }

  updateHud();
  if (run.zombie >= 100) {
    endGame(false);
    return;
  }
  setTimeout(nextRound, 950);
}

function endGame(won) {
  clearRoundTimers();
  round.active = false;
  state.player?.pause().catch(() => {});
  const runState = registerRunResult({ roomReached: state.run.room, escaped: won });
  state.lastResult = { won, score: state.run.score, streak: state.run.streak, room: state.run.room };
  state.screen = 'result';
  render();
}

function renderResult() {
  const r = state.lastResult;
  app.innerHTML = `
    <div class="stage">
      <div class="screen">
        <div class="resultTitle ${r.won ? 'win' : 'lose'}">${r.won ? 'ESCAPED' : 'CAUGHT'}</div>
        <div class="statLine">${r.won ? `You made it out through the ${ROOMS[ROOMS.length - 1]}.` : `They caught you in the ${ROOMS[r.room]}.`}</div>
        <div class="statLine">Score: <b>${r.score}</b> · Best streak: <b>${r.streak}</b></div>
        <button class="btn btn-primary" id="againBtn">Run It Back</button>
        <button class="btn btn-ghost" id="charsBtn">Change Character</button>
      </div>
    </div>`;
  document.getElementById('againBtn').addEventListener('click', startGame);
  document.getElementById('charsBtn').addEventListener('click', () => { state.screen = 'characters'; render(); });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- boot ----------------
(async function boot() {
  render();
  try {
    await handleRedirectIfPresent();
  } catch (e) {
    state.error = e.message;
  }
  state.screen = 'title';
  render();
})();
