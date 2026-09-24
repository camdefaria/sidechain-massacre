// The club: a 320x180 top-down pixel map, rendered to canvas and scaled up with crisp
// pixels. The player walks a fixed route from the coat check to the back exit; the horde
// shambles along the same route behind them.

import { ZOMBIE, SPEEDO_COLORS, spriteFrame, silhouette } from './sprites.js';

export const W = 320;
export const H = 180;
export const EXIT_MOVES = 40; // moves from coat check to the exit door

export const ROOMS = [
  { name: 'COAT CHECK', x0: 4, x1: 60, floor: '#150c0e' },
  { name: 'BAR', x0: 64, x1: 124, floor: '#180b0d' },
  { name: 'DANCE FLOOR', x0: 128, x1: 212, floor: '#1b0709' },
  { name: 'DARK ROOM', x0: 216, x1: 268, floor: '#0b0708' },
  { name: 'EXIT', x0: 272, x1: 316, floor: '#130d0c' },
];

// Route the player follows (feet position). Doors in the inner walls line up with it.
const ROUTE = [
  [30, 162], [30, 52], [96, 52], [96, 152], [190, 152], [190, 52], [242, 52], [242, 142], [304, 142],
];
const DOORS = [
  { x: 60, y: 52 }, { x: 124, y: 152 }, { x: 212, y: 52 }, { x: 268, y: 142 },
];

const segs = [];
let routeLen = 0;
for (let i = 0; i < ROUTE.length - 1; i++) {
  const [x0, y0] = ROUTE[i];
  const [x1, y1] = ROUTE[i + 1];
  const len = Math.hypot(x1 - x0, y1 - y0);
  segs.push({ x0, y0, x1, y1, len, start: routeLen });
  routeLen += len;
}

export function routePoint(moves) {
  const d = (moves / EXIT_MOVES) * routeLen;
  if (d <= 0) {
    // behind the start line: extend straight back (down, off the bottom edge)
    return { x: ROUTE[0][0], y: ROUTE[0][1] - d * 1, dir: 1 };
  }
  for (const s of segs) {
    if (d <= s.start + s.len) {
      const t = (d - s.start) / s.len;
      return { x: s.x0 + (s.x1 - s.x0) * t, y: s.y0 + (s.y1 - s.y0) * t, dir: s.x1 < s.x0 ? -1 : 1 };
    }
  }
  const last = ROUTE[ROUTE.length - 1];
  return { x: last[0], y: last[1], dir: 1 };
}

export function roomIndexAt(moves) {
  const { x } = routePoint(Math.max(0, moves));
  const i = ROOMS.findIndex((r) => x < r.x1 + 2);
  return i === -1 ? ROOMS.length - 1 : i;
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Club {
  constructor(canvas, { accent = '#ff5f15' } = {}) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.accent = accent;
    this.dark = document.createElement('canvas');
    this.dark.width = W;
    this.dark.height = H;
    this.spawnAmbient();
  }

  spawnAmbient() {
    this.ambient = [];
    const dance = ROOMS[2];
    for (let i = 0; i < 11; i++) {
      this.ambient.push({
        kind: 'dancer',
        x: rand(dance.x0 + 12, dance.x1 - 12),
        y: rand(70, 140),
        phase: Math.random(),
        speedo: pick(SPEEDO_COLORS),
      });
    }
    const wander = [[0, 2], [1, 2], [3, 3], [4, 1]];
    for (const [ri, n] of wander) {
      const r = ROOMS[ri];
      for (let i = 0; i < n; i++) {
        const z = { kind: 'wander', room: r, x: rand(r.x0 + 10, r.x1 - 10), y: rand(70, 170), speedo: pick(SPEEDO_COLORS), phase: Math.random() };
        z.tx = z.x;
        z.ty = z.y;
        this.ambient.push(z);
      }
    }
    this.hordeJitter = Array.from({ length: 6 }, () => ({ lat: rand(-6, 6), lag: rand(0, 1.6), phase: Math.random(), speedo: pick(SPEEDO_COLORS) }));
  }

  update(dt) {
    for (const z of this.ambient) {
      if (z.kind !== 'wander') continue;
      const dx = z.tx - z.x;
      const dy = z.ty - z.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) {
        z.tx = rand(z.room.x0 + 8, z.room.x1 - 8);
        z.ty = rand(40, 172);
      } else {
        const sp = 5 * dt;
        z.x += (dx / d) * sp;
        z.y += (dy / d) * sp;
      }
    }
  }

  // s: { t, beat (0..1 phase), beatCount, player:{moves, walking, sprite}, horde:{moves}, flash }
  draw(s) {
    const c = this.ctx;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#060305';
    c.fillRect(0, 0, W, H);

    this.drawRooms(c, s);
    this.drawProps(c, s);
    this.drawLights(c, s);

    // Entities, sorted by feet y so nearer figures overlap farther ones
    const ents = [];
    for (const z of this.ambient) ents.push({ y: z.y, draw: () => this.drawAmbient(c, z, s) });
    const hm = s.horde.moves;
    this.hordeJitter.forEach((j, i) => {
      const p = routePoint(hm - j.lag);
      const lurch = Math.sin((s.t * 3 + j.phase * 6) ) > 0 ? 1 : 0;
      ents.push({ y: p.y, draw: () => this.drawZombie(c, p.x + (p.dir === 0 ? 0 : 0) + (i % 2 ? j.lat : 0), p.y + (i % 2 ? 0 : j.lat * 0.6), lurch, j.speedo, p.dir, true, s) });
    });
    const pp = routePoint(s.player.moves);
    ents.push({ y: pp.y, draw: () => this.drawPlayer(c, pp, s) });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());

    this.drawDarkRoom(c, s, pp);
    this.drawVignette(c, s);
    this.drawLabels(c);
  }

  drawRooms(c, s) {
    for (const r of ROOMS) {
      c.fillStyle = r.floor;
      c.fillRect(r.x0, 18, r.x1 - r.x0, 158);
      // subtle floor tiles
      c.fillStyle = 'rgba(255,255,255,0.025)';
      for (let x = r.x0; x < r.x1; x += 8) {
        for (let y = 18; y < 176; y += 8) if (((x + y) / 8) % 2 === 0) c.fillRect(x, y, 8, 8);
      }
    }
    // dance floor light-up tiles, pulsing with the beat
    const df = ROOMS[2];
    for (let x = df.x0 + 8; x < df.x1 - 8; x += 12) {
      for (let y = 64; y < 140; y += 12) {
        const on = ((x + y + s.beatCount * 12) / 12) % 3 === 0;
        c.fillStyle = on ? `rgba(224,18,44,${0.18 + 0.2 * (1 - s.beat)})` : 'rgba(224,18,44,0.05)';
        c.fillRect(x, y, 10, 10);
      }
    }
    // walls
    c.fillStyle = '#2a1416';
    c.fillRect(0, 14, W, 4);
    c.fillRect(0, 176, W, 4);
    c.fillRect(0, 14, 4, 166);
    c.fillRect(316, 14, 4, 166);
    for (const d of DOORS) {
      c.fillRect(d.x, 18, 4, d.y - 18 - 11);
      c.fillRect(d.x, d.y + 11, 4, 176 - (d.y + 11));
    }
    // exit door
    c.fillStyle = '#2bd46b';
    c.fillRect(316, 131, 4, 22);
  }

  drawProps(c, s) {
    // coat check counter + hangers
    c.fillStyle = '#3a2224';
    c.fillRect(8, 22, 44, 8);
    c.fillStyle = '#6b5a50';
    for (let x = 10; x < 50; x += 5) c.fillRect(x, 31, 1, 4);
    // bar counter with bottles
    c.fillStyle = '#3a1c1e';
    c.fillRect(104, 70, 14, 70);
    const bottles = ['#2bd46b', '#e0a63a', '#b4bcc9', '#e0122c'];
    for (let y = 74; y < 136; y += 6) {
      c.fillStyle = bottles[(y / 6) % 4 | 0];
      c.fillRect(114, y, 2, 3);
    }
    // DJ booth + speaker stacks on the dance floor
    c.fillStyle = '#101014';
    c.fillRect(150, 22, 40, 12);
    c.fillStyle = this.accent;
    c.fillRect(160, 26, 3, 3);
    c.fillRect(177, 26, 3, 3);
    c.fillStyle = '#0c0c10';
    for (const x of [132, 200]) {
      c.fillRect(x, 22, 9, 16);
      c.fillStyle = '#26262e';
      const pump = 1 + Math.round((1 - s.beat) * 1.5);
      c.fillRect(x + 2, 26, 5, 5 + pump - 1);
      c.fillStyle = '#0c0c10';
    }
    // dark room chains
    c.fillStyle = '#2e2a2e';
    for (const x of [226, 236, 256]) for (let y = 18; y < 40; y += 3) c.fillRect(x, y, 1, 2);
    // EXIT sign
    c.fillStyle = '#0c2a16';
    c.fillRect(286, 120, 24, 8);
    c.fillStyle = '#2bd46b';
    c.font = '6px "Silkscreen", monospace';
    c.textBaseline = 'top';
    c.fillText('EXIT', 289, 121);
  }

  drawLights(c, s) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const pulse = 0.55 + 0.45 * (1 - s.beat);
    const lamps = [[30, 90, 50, 0.12], [94, 100, 55, 0.14], [170, 100, 70, 0.22 * pulse], [292, 150, 40, 0.1]];
    for (const [x, y, r, a] of lamps) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(224,18,44,${a})`);
      g.addColorStop(1, 'rgba(224,18,44,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // exit glow
    const g = c.createRadialGradient(316, 142, 0, 316, 142, 30);
    g.addColorStop(0, 'rgba(43,212,107,0.25)');
    g.addColorStop(1, 'rgba(43,212,107,0)');
    c.fillStyle = g;
    c.fillRect(286, 112, 34, 60);
    // strobe on every 4th beat
    if (s.beatCount % 4 === 0 && s.beat < 0.12) {
      c.fillStyle = 'rgba(255,40,60,0.10)';
      c.fillRect(ROOMS[2].x0, 18, ROOMS[2].x1 - ROOMS[2].x0, 158);
    }
    c.restore();
  }

  drawAmbient(c, z, s) {
    if (z.kind === 'dancer') {
      const bob = s.beat < 0.25 ? 1 : 0;
      const frame = (s.beatCount + Math.round(z.phase * 3)) % 2;
      this.drawZombie(c, z.x, z.y - bob, frame, z.speedo, frame ? 1 : -1, false, s);
    } else {
      const frame = Math.sin(s.t * 4 + z.phase * 6) > 0 ? 1 : 0;
      this.drawZombie(c, z.x, z.y, frame, z.speedo, z.tx < z.x ? -1 : 1, false, s);
    }
  }

  drawZombie(c, x, y, frame, speedo, dir, hunting, s) {
    const img = spriteFrame(ZOMBIE, frame, { p: speedo }, `z${speedo}`);
    // eyes flicker; hunters glow brighter
    this.blit(c, img, x, y, dir);
    if (hunting) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(245,230,99,${0.35 + 0.35 * Math.random()})`;
      const ex = Math.round(x - 6);
      const ey = Math.round(y - 16);
      c.fillRect(ex + 3, ey + 4, 1, 1);
      c.fillRect(ex + 8, ey + 4, 1, 1);
      c.restore();
    }
  }

  drawPlayer(c, p, s) {
    const sprite = s.player.sprite;
    const frame = s.player.walking ? (Math.floor(s.t * 8) % 2) : 0;
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(Math.round(p.x - 5), Math.round(p.y - 1), 10, 2);
    // rim light in brand orange so the player never gets lost in the crowd
    const rim = silhouette(sprite, frame, this.accent);
    c.globalAlpha = 0.85;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.blit(c, rim, p.x + dx, p.y + dy, p.dir);
    c.globalAlpha = 1;
    this.blit(c, spriteFrame(sprite, frame), p.x, p.y, p.dir);
    if (sprite.strings) {
      c.strokeStyle = 'rgba(230,230,235,0.45)';
      c.lineWidth = 1;
      const sway = Math.sin(s.t * 2) * 3;
      c.beginPath();
      for (const hx of [-5, 0, 5]) {
        const top = hx === 0 ? -16 : -5;
        c.moveTo(Math.round(p.x + hx) + 0.5, Math.round(p.y + top));
        c.lineTo(Math.round(p.x + hx + sway) + 0.5, 0);
      }
      c.stroke();
    }
  }

  blit(c, img, x, y, dir = 1) {
    const ix = Math.round(x - 6);
    const iy = Math.round(y - 16);
    if (dir < 0) {
      c.save();
      c.translate(ix + 12, iy);
      c.scale(-1, 1);
      c.drawImage(img, 0, 0);
      c.restore();
    } else {
      c.drawImage(img, ix, iy);
    }
  }

  drawDarkRoom(c, s, pp) {
    const r = ROOMS[3];
    const d = this.dark.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = 'rgba(0,0,0,0.88)';
    d.fillRect(r.x0, 18, r.x1 - r.x0, 158);
    d.globalCompositeOperation = 'destination-out';
    const g = d.createRadialGradient(pp.x, pp.y - 8, 2, pp.x, pp.y - 8, 26);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g;
    d.fillRect(pp.x - 30, pp.y - 38, 60, 60);
    c.drawImage(this.dark, 0, 0);
  }

  drawLabels(c) {
    c.font = '6px "Silkscreen", monospace';
    c.textBaseline = 'top';
    c.fillStyle = '#060305';
    c.fillRect(0, 0, W, 14);
    for (const r of ROOMS) {
      c.fillStyle = this.accent;
      c.globalAlpha = 0.9;
      const w = c.measureText(r.name).width;
      c.fillText(r.name, Math.round((r.x0 + r.x1) / 2 - w / 2), 4);
    }
    c.globalAlpha = 1;
  }

  drawVignette(c, s) {
    const g = c.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 200);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.55 + (s.danger || 0) * 0.3})`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    if (s.danger > 0.5) {
      c.fillStyle = `rgba(224,18,44,${(s.danger - 0.5) * 0.25 * (0.5 + 0.5 * Math.sin(s.t * 10))})`;
      c.fillRect(0, 0, W, H);
    }
  }
}

// Big pixel zombie face for the "caught" moment.
export function drawJumpscare(canvas, speedo = '#e0122c') {
  const c = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#1a0306';
  c.fillRect(0, 0, W, H);
  const img = spriteFrame(ZOMBIE, 0, { p: speedo }, `z${speedo}`);
  // head only (rows 0-7), scaled way up
  c.drawImage(img, 0, 0, 12, 8, W / 2 - 108, -6, 216, 144);
  c.fillStyle = 'rgba(140,16,22,0.35)';
  for (let i = 0; i < 40; i++) c.fillRect(Math.random() * W, Math.random() * H, 2, 4 + Math.random() * 18);
}
