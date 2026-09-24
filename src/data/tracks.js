// Builds each mode's track pool from Deezer (via /api/deezer) and fetches per-round
// answer data. See modes.js for what each mode pulls.

import { MOCK_POOL, mockDetails } from './mock.js';

const EMERGING_RANK = 350000; // below this Deezer rank, a track counts as emerging (1.5x)
const PLAYLISTS_PER_QUERY = 2;
const TRACKS_PER_PLAYLIST = 40;

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

  const found = [];
  const addTracks = (list, source) => {
    for (const t of list || []) {
      if (!t?.preview || t.readable === false) continue;
      if (mode.minRank && (t.rank ?? 0) < mode.minRank) continue;
      found.push(slim(t, source));
    }
  };

  // 1. hand-picked playlists
  const curated = await Promise.allSettled(
    mode.playlists.map((id) => dz(`playlist/${id}/tracks`, { limit: 100 }))
  );
  curated.forEach((r) => r.status === 'fulfilled' && addTracks(r.value.data, 'curated'));

  // 2. keyword-seeded playlists
  const searches = await Promise.allSettled(
    mode.queries.map((q) => dz('search/playlist', { q, limit: PLAYLISTS_PER_QUERY }))
  );
  const playlistIds = [
    ...new Set(searches.flatMap((r) => (r.status === 'fulfilled' ? (r.value.data || []).map((p) => p.id) : []))),
  ];
  const lists = await Promise.allSettled(
    playlistIds.map((id) => dz(`playlist/${id}/tracks`, { limit: TRACKS_PER_PLAYLIST }))
  );
  lists.forEach((r) => r.status === 'fulfilled' && addTracks(r.value.data, 'search'));

  // 3. Veteran mode: newest Dance/Electro releases as "artists to watch"
  const fresh = [];
  if (mode.newReleases) {
    const rel = await Promise.allSettled([113, 106].map((g) => dz(`editorial/${g}/releases`, { limit: 15 })));
    const albums = shuffle(rel.flatMap((r) => (r.status === 'fulfilled' ? r.value.data || [] : []))).slice(0, 8);
    const tr = await Promise.allSettled(albums.map((a) => dz(`album/${a.id}/tracks`, { limit: 2 })));
    tr.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      for (const t of r.value.data || []) {
        if (t.preview) fresh.push({ ...slim(t, 'new-release'), albumId: albums[i].id, cover: albums[i].cover_medium || null, emerging: true });
      }
    });
  }

  const seen = new Set();
  const pool = shuffle(found.filter((t) => (seen.has(t.id) ? false : seen.add(t.id)))).map((t) => ({
    ...t,
    emerging: t.rank != null && t.rank < EMERGING_RANK,
  }));
  // slot a new release in every fourth track
  const freshQ = shuffle(fresh.filter((t) => !seen.has(t.id)));
  for (let i = 3; i < pool.length && freshQ.length; i += 4) pool.splice(i, 0, freshQ.shift());

  if (!pool.length) throw new Error('Deezer returned no playable tracks for this mode.');
  return pool;
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
