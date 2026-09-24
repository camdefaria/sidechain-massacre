// Thin wrapper around the bits of the Spotify Web API this game needs.
// Deliberately avoids endpoints Spotify locked behind Extended Quota Mode approval or
// ownership restrictions (Recommendations, Audio Features/Analysis, Related Artists, and
// fetching tracks from playlists your app doesn't own — that last one returns a 403 as of
// Spotify's Nov 2024 policy change). Track Search has none of those restrictions, so
// discovery is built entirely on it.

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

// `genre:` and `year:` field filters ARE supported for track search (unlike playlist
// search, where they silently return nothing). Mix a few angles for variety; "Emerging"
// leans on a recent year range as a rough proxy for newer releases since there's no public
// "new/rising" flag on Track Search itself.
const DISCOVERY_QUERIES = [
  { label: 'Trending', q: 'genre:dance' },
  { label: 'Trending', q: 'genre:edm' },
  { label: 'Trending', q: 'genre:house' },
  { label: 'Emerging', q: 'genre:"future house" year:2025-2026' },
  { label: 'Emerging', q: 'genre:"tech house" year:2025-2026' },
  { label: 'Big Room', q: 'genre:"big room"' },
];

export async function searchTracks(query, limit = 20) {
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit) });
  const json = await apiFetch(`/search?${params.toString()}`);
  return (json.tracks?.items || []).filter((t) => t && t.uri && t.uri.startsWith('spotify:track:'));
}

// Builds a round's worth of candidate tracks by combining a few discovery queries.
// Falls back gracefully if one search comes back empty or errors.
export async function loadDiscoveryQueue({ trackCount = 20 } = {}) {
  const collected = [];
  for (const dq of DISCOVERY_QUERIES) {
    try {
      const tracks = await searchTracks(dq.q, 15);
      collected.push(...tracks.map((t) => ({ ...t, discoveredVia: dq.label })));
    } catch (e) {
      console.warn(`Discovery query "${dq.label}" (${dq.q}) failed:`, e.message);
    }
    if (collected.length >= trackCount) break;
  }
  // de-dupe by track id, then shuffle so replays don't always open with the same track
  const seen = new Set();
  const deduped = collected.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  for (let i = deduped.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deduped[i], deduped[j]] = [deduped[j], deduped[i]];
  }
  return deduped;
}

export async function getMe() {
  return apiFetch('/me');
}
