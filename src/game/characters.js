// Playable characters. `portraitClass` maps to a CSS-drawn portrait in style.css —
// stylized caricatures, not photo likenesses. Swap in real art (PNG/SVG) later by
// setting `image` to a file under /public and it'll be used instead of the CSS portrait.
export const CHARACTERS = [
  {
    id: 'the-summit',
    name: 'The Summit',
    subtitle: 'starter',
    unlocked: true,
    portraitClass: 'portrait-summit',
    image: null,
    blurb: 'Tank top, dark hair, stupid-funny glasses. First one on the floor, last one to leave.',
  },
  {
    id: 'dolla',
    name: 'Dolla',
    subtitle: 'unlock: reach the Dance Floor',
    unlocked: false,
    unlockRoom: 2, // room index required to unlock
    portraitClass: 'portrait-dolla',
    image: null,
    blurb: 'Dark shades, thick mustache, brown buzzcut. Never rattled, never off-beat.',
  },
  {
    id: 'mau5head',
    name: 'Mau5head',
    subtitle: 'unlock: escape once',
    unlocked: false,
    unlockRoom: 5,
    portraitClass: 'portrait-mau5head',
    image: null,
    blurb: 'Big helmet, bigger drops. Nobody has seen his actual face.',
  },
  {
    id: 'marshmallow',
    name: 'Marshmallow',
    subtitle: 'unlock: escape once',
    unlocked: false,
    unlockRoom: 5,
    portraitClass: 'portrait-marshmallow',
    image: null,
    blurb: 'Soft on the outside, does not miss a cue.',
  },
  {
    id: 'sarah-l',
    name: 'Sarah L.',
    subtitle: 'unlock: 3 escapes',
    unlocked: false,
    unlockEscapes: 3,
    portraitClass: 'portrait-sarahl',
    image: null,
    blurb: 'Ponytail, headset mic energy, ruthless on the timing.',
  },
  {
    id: 'jackie-h',
    name: 'Jackie H.',
    subtitle: 'unlock: 3 escapes',
    unlocked: false,
    unlockEscapes: 3,
    portraitClass: 'portrait-jackieh',
    image: null,
    blurb: 'Came for the b2b, staying for the body count.',
  },
];

const SAVE_KEY = 'sm_unlocks';

export function loadUnlockState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : { unlockedIds: ['the-summit'], escapes: 0, bestRoom: 0 };
  } catch (e) {
    return { unlockedIds: ['the-summit'], escapes: 0, bestRoom: 0 };
  }
}

export function saveUnlockState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {}
}

// Call after a run ends with the room index reached (0-based) and whether the player escaped.
export function registerRunResult({ roomReached, escaped }) {
  const state = loadUnlockState();
  state.bestRoom = Math.max(state.bestRoom, roomReached);
  if (escaped) state.escapes += 1;

  for (const c of CHARACTERS) {
    if (state.unlockedIds.includes(c.id)) continue;
    const roomOk = c.unlockRoom != null && state.bestRoom >= c.unlockRoom;
    const escapeOk = c.unlockEscapes != null && state.escapes >= c.unlockEscapes;
    if (roomOk || escapeOk) state.unlockedIds.push(c.id);
  }
  saveUnlockState(state);
  return state;
}

export function charactersWithUnlockState() {
  const state = loadUnlockState();
  return CHARACTERS.map((c) => ({ ...c, unlocked: c.unlocked || state.unlockedIds.includes(c.id) }));
}
