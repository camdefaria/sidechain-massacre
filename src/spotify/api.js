// Thin wrapper around the bits of the Spotify Web API this game needs.
// Deliberately avoids endpoints Spotify locked behind Extended Quota Mode approval
// (Recommendations, Audio Features/Analysis, Related Artists) — this uses Search +
// Playlist Items, which stay available in Development Mode.

import { getValidAccessToken } from './auth.js';

const API_BASE = 'https://api.spotify.com/v1';

async function apiFetch(path, options = {}) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not logged in to Spotify.');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Search terms that surface trending/emerging dance music without needing chart access
// Spotify doesn't expose via public API. Mix editorial-style queries for variety.
const DISCOVERY_QUERIES = [
  { label: 'Trending', q: 'genre:dance', sort: 'popular' },
  { label: 'Emerging', q: 'genre:"future house" OR genre:"tech house"', sort: 'new' },
  { label: 'Big Room', q: 'genre:"big room" OR genre:edm', sort: 'popular' },
];

export async function findPlaylists(query = 'dance edm', limit = 10) {
  const params = new URLSearchParams({ q: query, type: 'playlist', limit: String(limit) });
  const json = await apiFetch(`/search?${params.toString()}`);
  return (json.playlists?.items || []).filter(Boolean);
}

export async function getPlaylistTracks(playlistId, limit = 50) {
  const params = new URLSearchParams({
    limit: String(limit),
    fields: 'items(track(id,name,uri,duration_ms,popularity,preview_url,artists(name),album(name,images)))',
  });
  const json = await apiFetch(`/playlists/${playlistId}/tracks?${params.toString()}`);
  return (json.items || [])
    .map((item) => item.track)
    .filter((t) => t && t.uri && t.uri.startsWith('spotify:track:'));
}

// Builds a round's worth of candidate tracks by combining a couple of discovery queries.
// Falls back gracefully if one search comes back empty.
export async function loadDiscoveryQueue({ trackCount = 20 } = {}) {
  const collected = [];
  for (const dq of DISCOVERY_QUERIES) {
    try {
      const playlists = await findPlaylists(dq.q, 5);
      for (const pl of playlists) {
        if (collected.length >= trackCount) break;
        const tracks = await getPlaylistTracks(pl.id, 10);
        collected.push(...tracks.map((t) => ({ ...t, discoveredVia: dq.label, playlistName: pl.name })));
      }
    } catch (e) {
      console.warn(`Discovery query "${dq.label}" failed:`, e.message);
    }
    if (collected.length >= trackCount) break;
  }
  // de-dupe by track id
  const seen = new Set();
  return collected.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export async function getMe() {
  return apiFetch('/me');
}
