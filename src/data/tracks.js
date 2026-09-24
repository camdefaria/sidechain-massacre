// Builds the track pool from Deezer (via /api/deezer) and fetches per-round answer data.
// Trending = Deezer's Dance (113) and Electro (106) charts.
// Emerging = tracks off Deezer's newest editorial releases in those genres, or anything
// with a low Deezer popularity rank. Emerging tracks pay out 1.5x moves.

import { MOCK_POOL, mockDetails } from './mock.js';

export const GENRES = [113, 106]; // Dance, Electro
const EMERGING_RANK = 350000; // Deezer `rank` runs roughly 0..1,000,000

export const useMock = () => new URLSearchParams(location.search).has('mock');

async function dz(path, params = {}) {
  const qs = new URLSearchParams({ path, ...params });
  const r = await fetch(`/api/deezer?${qs}`);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error?.message || body?.error || `Deezer proxy ${r.status}`);
  return body;
}

function slim(t, source) {
  return {
    id: t.id,
    preview: t.preview,
    rank: t.rank ?? null,
    albumId: t.album?.id ?? null,
    cover: t.album?.cover_medium || null,
    source,
  };
}

export async function buildPool() {
  if (useMock()) return MOCK_POOL.map((t) => ({ ...t }));

  const trending = [];
  const emerging = [];

  const charts = await Promise.allSettled(GENRES.map((g) => dz(`chart/${g}/tracks`, { limit: 50 })));
  for (const c of charts) {
    if (c.status !== 'fulfilled') continue;
    for (const t of c.value.data || []) {
      if (!t.preview) continue;
      const s = slim(t, 'chart');
      (s.rank != null && s.rank < EMERGING_RANK ? emerging : trending).push(s);
    }
  }

  // New releases → a few tracks from each album
  try {
    const rel = await Promise.allSettled(GENRES.map((g) => dz(`editorial/${g}/releases`, { limit: 15 })));
    const albums = rel.flatMap((r) => (r.status === 'fulfilled' ? r.value.data || [] : []));
    shuffle(albums);
    const picks = albums.slice(0, 8);
    const tracks = await Promise.allSettled(picks.map((a) => dz(`album/${a.id}/tracks`, { limit: 3 })));
    tracks.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      for (const t of r.value.data || []) {
        if (!t.preview) continue;
        emerging.push({ ...slim(t, 'new-release'), albumId: picks[i].id, cover: picks[i].cover_medium || null });
      }
    });
  } catch (e) {
    console.warn('emerging releases failed', e);
  }

  const seen = new Set();
  const dedupe = (arr) => arr.filter((t) => (seen.has(t.id) ? false : seen.add(t.id)));
  const tr = shuffle(dedupe(trending));
  const em = shuffle(dedupe(emerging)).map((t) => ({ ...t, emerging: true }));

  // Roughly one emerging track in every three
  const pool = [];
  while (tr.length || em.length) {
    if (tr.length) pool.push(tr.shift());
    if (tr.length) pool.push(tr.shift());
    if (em.length) pool.push(em.shift());
  }
  if (!pool.length) throw new Error('Deezer returned no playable tracks.');
  return pool;
}

// Everything the matcher needs for one round. Fetched when the round starts so preview
// URLs stay fresh and the answers aren't sitting in memory for the whole run.
export async function roundDetails(entry) {
  if (useMock()) return mockDetails(entry);

  const track = await dz(`track/${entry.id}`);
  const albumId = track.album?.id || entry.albumId;
  const album = albumId ? await dz(`album/${albumId}`).catch(() => null) : null;

  const contributors = track.contributors || [];
  const main = contributors.filter((c) => c.role === 'Main').map((c) => c.name);
  const featured = contributors.filter((c) => c.role !== 'Main').map((c) => c.name);
  if (!main.length && track.artist?.name) main.push(track.artist.name);

  return {
    id: track.id,
    title: track.title,
    titleShort: track.title_short || track.title,
    titleVersion: track.title_version || '',
    mainArtists: main,
    featuredArtists: featured,
    label: album?.label || '',
    isrc: track.isrc || '',
    bpm: track.bpm > 40 ? track.bpm : 124,
    preview: track.preview || entry.preview,
    cover: album?.cover_medium || track.album?.cover_medium || entry.cover,
    link: track.link || `https://www.deezer.com/track/${track.id}`,
    emerging: !!entry.emerging,
  };
}

// Writers/producers/engineers from MusicBrainz. Resolves to [] on any miss.
export async function fetchCredits(isrc) {
  if (!isrc || useMock()) return [];
  try {
    const r = await fetch(`/api/credits?isrc=${encodeURIComponent(isrc)}`);
    const body = await r.json();
    return (body.credits || []).map((c) => c.name);
  } catch {
    return [];
  }
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
