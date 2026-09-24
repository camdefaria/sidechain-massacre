// Resolves a mode's hand-picked track list against Deezer and returns playable tracks.
// Runs server-side and is cached at the edge for 6 hours, so players don't each fire
// dozens of Deezer searches.

import { MODES } from '../src/data/modes.js';

const DZ = 'https://api.deezer.com';

const norm = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function dz(path, params = {}) {
  const u = new URL(DZ + '/' + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { Accept: 'application/json' } });
  const body = await r.json();
  if (body?.error) throw new Error(body.error.message || 'deezer error');
  return body;
}

// Deezer allows ~50 requests / 5s per IP. Run in small batches.
async function batched(items, fn, size = 8) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
    if (i + size < items.length) await new Promise((r) => setTimeout(r, 600));
  }
  return out;
}

const artistMatches = (t, want) => {
  const w = norm(want);
  const names = [t.artist?.name, ...(t.contributors || []).map((c) => c.name)].map(norm);
  return names.some((n) => n === w || n.includes(w) || w.includes(n));
};

async function resolveSeed(seed) {
  const [artist, title] = seed.split('|').map((s) => s.trim());
  const tries = [`artist:"${artist}" track:"${title}"`, `${artist} ${title}`];
  for (const q of tries) {
    const res = await dz('search', { q, limit: 10 });
    const hits = (res.data || []).filter((t) => t.preview && t.readable !== false && artistMatches(t, artist));
    const wantT = norm(title);
    const exact = hits.filter((t) => norm(t.title_short || t.title) === wantT || norm(t.title) === wantT);
    const pick = (exact.length ? exact : hits.filter((t) => norm(t.title).includes(wantT)))
      .sort((a, b) => (b.rank || 0) - (a.rank || 0))[0];
    if (pick) return pick;
  }
  return null;
}

async function artistTop(name, n) {
  const res = await dz('search/artist', { q: name, limit: 5 });
  const a = (res.data || []).find((x) => norm(x.name) === norm(name));
  if (!a) return [];
  const top = await dz(`artist/${a.id}/top`, { limit: 15 });
  return (top.data || []).filter((t) => t.preview && t.readable !== false).slice(0, n * 2);
}

const slim = (t, source) => ({
  id: t.id,
  preview: t.preview,
  rank: t.rank ?? null,
  albumId: t.album?.id ?? null,
  cover: t.album?.cover_medium || null,
  source,
});

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const mode = MODES.find((m) => m.id === url.searchParams.get('mode'));
    if (!mode) return send(res, 400, { error: 'unknown mode' });

    const tracks = [];
    const missing = [];

    const seeds = await batched(mode.seeds || [], resolveSeed);
    seeds.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) tracks.push(slim(r.value, 'seed'));
      else missing.push(mode.seeds[i]);
    });

    const arts = await batched(mode.artists || [], (a) => artistTop(a, mode.tracksPerArtist || 3), 5);
    arts.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.length) r.value.forEach((t) => tracks.push({ ...slim(t, 'artist'), artist: mode.artists[i] }));
      else missing.push(`artist: ${mode.artists[i]}`);
    });

    for (const pl of mode.playlists || []) {
      try {
        const p = await dz(`playlist/${pl}/tracks`, { limit: 100 });
        (p.data || []).filter((t) => t.preview).forEach((t) => tracks.push(slim(t, 'playlist')));
      } catch {
        missing.push(`playlist: ${pl}`);
      }
    }

    const seen = new Set();
    const list = tracks.filter((t) => (seen.has(t.id) ? false : seen.add(t.id)));
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return send(res, 200, { mode: mode.id, count: list.length, missing, tracks: list });
  } catch (e) {
    return send(res, 500, { error: String(e?.message || e) });
  }
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}
