// Spotify Authorization Code with PKCE — no client secret needed, safe for a public/static app.
// Docs: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || `${window.location.origin}/callback`;
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
].join(' ');

const STORAGE_KEY = 'sm_spotify_tokens';

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomVerifier(length = 64) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

async function challengeFromVerifier(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

function readTokens() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeTokens(tokens) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch (e) {
    // best-effort; game still works within this page load if storage is blocked
  }
}

export function clearTokens() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

export async function beginLogin() {
  if (!CLIENT_ID) {
    throw new Error('Missing VITE_SPOTIFY_CLIENT_ID — set it in your .env or Vercel project settings.');
  }
  const verifier = randomVerifier();
  const challenge = await challengeFromVerifier(verifier);
  sessionStorage.setItem('sm_pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function exchangeToken(body) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token request failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  const tokens = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || readTokens()?.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
  };
  writeTokens(tokens);
  return tokens;
}

// Call once on app boot. If the URL has ?code=..., completes login and cleans the URL.
export async function handleRedirectIfPresent() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) {
    window.history.replaceState({}, '', window.location.pathname);
    throw new Error(`Spotify login was cancelled or failed: ${error}`);
  }
  if (!code) return false;

  const verifier = sessionStorage.getItem('sm_pkce_verifier');
  sessionStorage.removeItem('sm_pkce_verifier');
  if (!verifier) return false;

  await exchangeToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });

  window.history.replaceState({}, '', window.location.pathname);
  return true;
}

async function refreshAccessToken(refresh_token) {
  return exchangeToken({
    grant_type: 'refresh_token',
    refresh_token,
    client_id: CLIENT_ID,
  });
}

// Returns a valid access token, refreshing if needed, or null if the user must log in again.
export async function getValidAccessToken() {
  let tokens = readTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expires_at - 15000) return tokens.access_token;
  if (!tokens.refresh_token) return null;
  try {
    tokens = await refreshAccessToken(tokens.refresh_token);
    return tokens.access_token;
  } catch (e) {
    clearTokens();
    return null;
  }
}

export function isLoggedIn() {
  return !!readTokens();
}
