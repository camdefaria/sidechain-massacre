// Builds each mode's track pool from Deezer (via /api/deezer) and fetches per-round
// answer data. See modes.js for what each mode pulls.

import { MOCK_POOL, mockDetails } from './mock.js';

const EMERGING_RANK = 350000; // below this Deezer rank, a track counts as emerging (1.5x)

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

export async function buildPool(mode) {
  if (useMock()) return MOCK_POOL.map((t) => ({ ...t }));
  const r = await fetch(`/api/pool?mode=${encodeURIComponent(mode.id)}`);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error || `pool ${r.status}`);
  if (body.missing?.length) console.info(`[pool] not found on Deezer for ${mode.id}:`, body.missing);
  const list = shuffle((body.tracks || []).map((t) => ({ ...t, emerging: t.source === 'artist' && t.rank != null && t.rank < EMERGING_RANK })));
  if (!list.length) throw new Error('No playable tracks found for this mode.');
  return list;
}

// Everything the matcher needs for one round.
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
    releaseDate: track.release_date || album?.release_date || '',
    isrc: track.isrc || '',
    bpm: track.bpm > 40 ? track.bpm : 124,
    preview: track.preview || entry.preview,
    cover: album?.cover_medium || track.album?.cover_medium || entry.cover,
    link: track.link || `https://www.deezer.com/track/${track.id}`,
    emerging: !!entry.emerging,
  };
}

// True if the track's release year falls inside the mode's window.
export function inWindow(details, mode) {
  if (!mode.maxAgeYears) return true;
  const y = parseInt(String(details.releaseDate).slice(0, 4), 10);
  if (!y) return true; // unknown date: let it through rather than starve the pool
  return y >= new Date().getFullYear() - mode.maxAgeYears;
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
