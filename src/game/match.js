// Guess auto-detection. One text box; the guess is checked against every answer for the
// current track and the best unsolved match wins.
//
//   TRACK  +3   title within 1 typo. Version tags are ignored: anything after " - "
//               and brackets like (feat. X), (Extended Mix), [Radio Edit].
//   LABEL  +2   90% character match. "Records", "Recordings", "Music", "Ltd" etc. are
//               ignored, and "A / B" or "A under exclusive license to B" count as either.
//   ARTIST +1   a main artist, within 1 typo.
//   CREDIT +1/2 a featured artist, second main artist, or anyone MusicBrainz credits
//               (writer, producer, engineer...). Up to 3 per track.
//
// Emerging tracks multiply all of the above by 1.5.

export const MOVES = { track: 3, label: 2, artist: 1, credit: 0.5 };
export const CREDIT_CAP = 3;
export const EMERGING_MULT = 1.5;

export function normalize(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

const VERSION_WORDS =
  /\b(feat|ft|featuring|with|remix|mix|edit|version|remaster(ed)?|vip|extended|radio|original|dub|instrumental|live|acoustic|rework|bootleg|flip|club|sped|slowed)\b/i;

export function coreTitle(title) {
  let t = String(title || '');
  // drop bracketed version/feature tags
  t = t.replace(/[([{][^)\]}]*[)\]}]/g, (m) => (VERSION_WORDS.test(m) ? ' ' : m));
  // drop everything after a spaced hyphen or dash
  t = t.split(/\s[-–—]\s/)[0];
  return t.trim();
}

const LABEL_NOISE = new Set([
  'records', 'record', 'recordings', 'recording', 'music', 'musique', 'ltd', 'limited',
  'llc', 'inc', 'gmbh', 'bv', 'b', 'v', 'co', 'label', 'group', 'the', 'uk', 'us', 'p', 'c',
]);

export function coreLabel(label) {
  return normalize(label)
    .split(' ')
    .filter((w) => w && !LABEL_NOISE.has(w) && !/^(19|20)\d\d$/.test(w))
    .join(' ');
}

export function labelParts(label) {
  return String(label || '')
    .split(/\s*(?:\/|,|;|\bunder exclusive licen[cs]e to\b|\blicensed to\b|\bdistributed by\b)\s*/i)
    .map(coreLabel)
    .filter(Boolean);
}

export function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Within one typo. Very short answers (3 chars or fewer) must be exact.
function closeEnough(guess, answer) {
  if (!guess || !answer) return false;
  if (answer.length <= 3) return guess === answer;
  return lev(guess, answer) <= 1;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}

// Builds the answer sheet for a round.
export function answerSheet(d, credits = []) {
  const main = d.mainArtists.map(normalize).filter(Boolean);
  const creditNames = new Set();
  main.slice(1).forEach((n) => creditNames.add(n));
  d.featuredArtists.map(normalize).forEach((n) => n && creditNames.add(n));
  credits.map(normalize).forEach((n) => n && !main.includes(n) && creditNames.add(n));
  return {
    titles: [...new Set([normalize(coreTitle(d.titleShort)), normalize(coreTitle(d.title))])].filter(Boolean),
    labels: labelParts(d.label),
    mainArtists: main,
    credits: [...creditNames],
  };
}

export function addCredits(sheet, names) {
  for (const n of names.map(normalize)) {
    if (n && !sheet.mainArtists.includes(n) && !sheet.credits.includes(n)) sheet.credits.push(n);
  }
}

// state: { track:bool, label:bool, artist:bool, creditsHit:Set }
// returns { kind, moves, name? } or { kind:'dupe' } or { kind:'miss' }
export function judge(rawGuess, sheet, state, emerging = false) {
  const g = normalize(rawGuess);
  if (!g) return { kind: 'empty' };
  const mult = emerging ? EMERGING_MULT : 1;

  const gTitle = normalize(coreTitle(rawGuess));
  const hitTitle = sheet.titles.some((t) => closeEnough(g, t) || closeEnough(gTitle, t));
  const gl = coreLabel(rawGuess);
  const hitLabel = !!gl && sheet.labels.some((l) => similarity(gl, l) >= 0.9);
  const hitArtist = sheet.mainArtists.length && closeEnough(g, sheet.mainArtists[0]);
  const creditName = sheet.credits.find((c) => closeEnough(g, c));

  if (hitTitle && !state.track) return { kind: 'track', moves: MOVES.track * mult };
  if (hitLabel && !state.label) return { kind: 'label', moves: MOVES.label * mult };
  if (hitArtist && !state.artist) return { kind: 'artist', moves: MOVES.artist * mult };
  if (creditName && !state.creditsHit.has(creditName) && state.creditsHit.size < CREDIT_CAP) {
    return { kind: 'credit', moves: MOVES.credit * mult, name: creditName };
  }
  if (hitTitle || hitLabel || hitArtist || creditName) return { kind: 'dupe' };
  return { kind: 'miss' };
}

// "N____ S____ P_______" style hint for the title, plus the main artist's initials.
export function hintText(d) {
  const mask = (s) => s.split(/\s+/).map((w) => w[0] + '_'.repeat(Math.max(0, w.length - 1))).join(' ');
  const title = mask(coreTitle(d.titleShort));
  const artist = d.mainArtists[0] ? mask(d.mainArtists[0]) : '?';
  return `${title}  ·  by ${artist}`;
}
