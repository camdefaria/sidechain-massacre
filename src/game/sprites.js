// Hand-drawn 12x16 pixel sprites. Each character = 13 body rows + two 3-row leg frames
// (A/B) for a walk cycle. '.' is transparent; every other char maps to that sprite's
// palette.

const LEGS_STD_A = ['...pp..pp...', '...ss..ss...', '...ff..ff...'];
const LEGS_STD_B = ['...pp..pp...', '..ss....ss..', '..ff....ff..'];

export const CHARACTERS = [
  {
    id: 'summit',
    name: 'The Expert',
    blurb: 'Tank top, dark hair, the loudest shades in the building. First on the floor, last to leave.',
    body: [
      '...hhhhh....',
      '..hhhhhhh...',
      '..hhhhhhhh..',
      '..hssssssh..',
      '.gGMGggGMGg.',
      '..ssssssss..',
      '..sssmmsss..',
      '...ssssss...',
      '....ssss....',
      '..ssTTTTss..',
      '.s.TTTTTT.s.',
      '.s.TTTTTT.s.',
      '.S.pppppp.S.',
    ],
    legsA: LEGS_STD_A,
    legsB: LEGS_STD_B,
    palette: { h: '#1c1412', s: '#d9a07a', S: '#b9805c', g: '#101014', G: '#3cf2ff', M: '#ff3cc8', m: '#7a2e2e', T: '#f2efe9', p: '#1a1a22', f: '#f2efe9' },
  },
  {
    id: 'eiffel',
    name: 'Eiffel Tower Guy',
    blurb: 'Buzzcut, blackout shades, a mustache with its own booking agent.',
    body: [
      '............',
      '...bbbbbb...',
      '..bbbbbbbb..',
      '..bssssssb..',
      '..kkkkkkkk..',
      '..ssssssss..',
      '..sMMMMMMs..',
      '...ssmmss...',
      '....ssss....',
      '..TTTTTTTT..',
      '.sTTTwwTTTs.',
      '.s.TTTTTT.s.',
      '.S.jjjjjj.S.',
    ],
    legsA: ['...jj..jj...', '...jj..jj...', '...kk..kk...'],
    legsB: ['...jj..jj...', '..jj....jj..', '..kk....kk..'],
    palette: { b: '#6b4a2e', s: '#d4a07c', S: '#b07e5c', k: '#0b0b0d', M: '#4a2e18', m: '#7a3a2e', T: '#26262e', w: '#f2efe9', j: '#34405c' },
  },
  {
    id: 'priestess',
    name: 'High Priestess',
    blurb: 'Slicked back, mesh on, thigh-highs laced. The dark room is her living room.',
    body: [
      '....hhhh....',
      '...hhhhhh...',
      '..hhhhhhhh..',
      '..hsssssshh.',
      '..seessees.h',
      '..ssssssss.h',
      '...ssLLss.h.',
      '....ssss....',
      '..mMmMmMmM..',
      '.mMKKMMKKMm.',
      '.m.MmMmMm.m.',
      '.m.mMmMmM.m.',
      '.s.kkkkkk.s.',
    ],
    legsA: ['...BB..BB...', '...Bb..Bb...', '...BB..BB...'],
    legsB: ['...BB..BB...', '..Bb....Bb..', '..BB....BB..'],
    palette: { h: '#0e0b10', s: '#ecd6c8', e: '#6a1020', L: '#3d0610', m: '#4a4452', M: '#141218', K: '#34343e', k: '#0b0b0d', B: '#16161c', b: '#6a6a78' },
  },
  {
    id: 'hackie',
    name: 'Hackie Jollander',
    blurb: 'Silver track jacket, amber shades, gold hoops. Somehow still dry at 6am.',
    body: [
      '....hhhh....',
      '...hhhhhh...',
      '..hhhhhhhh..',
      '..hsssssshh.',
      '..rAArrAAr.h',
      '..ssssssss.h',
      '.osssmmssso.',
      '....ssss....',
      '..JJJJzJJJ..',
      '.JJJJJzJJJJ.',
      '.J.JJJzJJ.J.',
      '.J.JJJzJJ.J.',
      '.s.jjjjjj.s.',
    ],
    legsA: ['...jj..jj...', '...jj..jj...', '...ff..ff...'],
    legsB: ['...jj..jj...', '..jj....jj..', '..ff....ff..'],
    palette: { h: '#5b3a24', s: '#e8b99a', r: '#b32a1e', A: '#e0a63a', o: '#f2c14e', m: '#a8554a', J: '#b4bcc9', z: '#eef1f5', j: '#3b4a6b', f: '#f2efe9' },
  },
  {
    id: 'puppet',
    name: 'Daft Puppet',
    blurb: 'A robot on strings. Nobody knows who is working the controls.',
    strings: true,
    body: [
      '.....o......',
      '.....a......',
      '..RRRRRRRR..',
      '..RDDDDDDR..',
      '..REEDDEER..',
      '..RDDDDDDR..',
      '..RDggggDR..',
      '..RRRRRRRR..',
      '....kkkk....',
      '..SSSSSSSS..',
      '.SSSSwwSSSS.',
      '.S.SSSSSS.S.',
      '.R.SSSSSS.R.',
    ],
    legsA: ['...SS..SS...', '...SS..SS...', '...kk..kk...'],
    legsB: ['...SS..SS...', '..SS....SS..', '..kk....kk..'],
    palette: { o: '#ff6a1a', a: '#8a8f98', R: '#b8bec8', D: '#1b1d24', E: '#ff6a1a', g: '#5b6170', k: '#0b0b0d', S: '#1c1c24', w: '#e9edf2' },
  },
];

export const ZOMBIE = {
  body: [
    '....hh.h....',
    '...zhzzhz...',
    '..zzzzzzzz..',
    '..zZzzzzZz..',
    '..zyZzzZyz..',
    '..zzzzzzzz..',
    '...zxXXxz...',
    '....zzzz....',
    'zzzzzzzzzzzz',
    '..zZzzzzZz..',
    '..zzzxzzzz..',
    '..zZzzzzxz..',
    '...pppppp...',
  ],
  legsA: ['...zz..zz...', '...zz..zz...', '...ZZ..ZZ...'],
  legsB: ['...zz..zz...', '..zz....zz..', '..ZZ....ZZ..'],
  palette: { h: '#2a2a24', z: '#8a9a78', Z: '#5d6b50', y: '#f5e663', x: '#8c1016', X: '#3a0508' },
};

export const SPEEDO_COLORS = ['#ff2d95', '#2d7bff', '#ffd21f', '#e0122c', '#18c96b', '#b44dff'];

// Pre-render each sprite frame to a tiny offscreen canvas once, so the game loop just
// blits images.
const cache = new Map();

function rowsFor(sprite, frame) {
  return [...sprite.body, ...(frame ? sprite.legsB : sprite.legsA)];
}

export function spriteFrame(sprite, frame = 0, overrides = {}, key = '') {
  const k = `${key || sprite.id || 'z'}:${frame}:${JSON.stringify(overrides)}`;
  if (cache.has(k)) return cache.get(k);
  const rows = rowsFor(sprite, frame);
  const c = document.createElement('canvas');
  c.width = 12;
  c.height = 16;
  const ctx = c.getContext('2d');
  const pal = { ...sprite.palette, ...overrides };
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || !pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  cache.set(k, c);
  return c;
}

// Solid-color silhouette, used for the player's rim light so they read on a dark floor.
export function silhouette(sprite, frame, color) {
  const k = `sil:${sprite.id || 'z'}:${frame}:${color}`;
  if (cache.has(k)) return cache.get(k);
  const src = spriteFrame(sprite, frame);
  const c = document.createElement('canvas');
  c.width = 12;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 12, 16);
  cache.set(k, c);
  return c;
}

export function validateSprites() {
  const all = [...CHARACTERS, { id: 'zombie', ...ZOMBIE }];
  const bad = [];
  for (const s of all) {
    for (const fr of [0, 1]) {
      rowsFor(s, fr).forEach((r, i) => {
        if (r.length !== 12) bad.push(`${s.id} frame${fr} row${i} len ${r.length}`);
      });
      if (rowsFor(s, fr).length !== 16) bad.push(`${s.id} frame${fr} has ${rowsFor(s, fr).length} rows`);
    }
  }
  return bad;
}
