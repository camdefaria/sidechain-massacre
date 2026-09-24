// Wraps Spotify's Web Playback SDK: turns this browser tab into a real Spotify Connect
// device so a logged-in Premium user hears actual full-track audio, licensed and streamed
// by Spotify itself. Requires: user has Premium, is logged in via auth.js, and this app's
// Client ID has the Web Playback SDK box checked in the Spotify Dashboard.

import { getValidAccessToken } from './auth.js';

let sdkLoadPromise = null;
function loadSdkScript() {
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = () => reject(new Error('Failed to load Spotify Web Playback SDK.'));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

export class SidechainPlayer {
  constructor() {
    this.player = null;
    this.deviceId = null;
    this.ready = false;
    this.onStateChange = null; // (state) => void, set by caller
  }

  async connect() {
    await loadSdkScript();
    return new Promise((resolve, reject) => {
      this.player = new window.Spotify.Player({
        name: 'Sidechain Massacre',
        getOAuthToken: (cb) => {
          getValidAccessToken().then((token) => cb(token));
        },
        volume: 0.8,
      });

      this.player.addListener('ready', ({ device_id }) => {
        this.deviceId = device_id;
        this.ready = true;
        resolve(device_id);
      });

      this.player.addListener('not_ready', () => {
        this.ready = false;
      });

      this.player.addListener('player_state_changed', (state) => {
        if (this.onStateChange) this.onStateChange(state);
      });

      this.player.addListener('initialization_error', ({ message }) => reject(new Error(message)));
      this.player.addListener('authentication_error', ({ message }) => reject(new Error(message)));
      this.player.addListener('account_error', ({ message }) =>
        reject(new Error(`${message} — Sidechain Massacre needs a Spotify Premium account for real playback.`))
      );

      this.player.connect();
    });
  }

  // Starts playback of a track (or list of track URIs) on this device.
  async playTrackUri(uri, positionMs = 0) {
    const token = await getValidAccessToken();
    if (!token || !this.deviceId) throw new Error('Player not ready.');
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(`Playback failed: ${res.status} ${text}`);
    }
  }

  async pause() {
    if (this.player) await this.player.pause();
  }

  async getCurrentPositionMs() {
    if (!this.player) return 0;
    const state = await this.player.getCurrentState();
    return state ? state.position : 0;
  }

  disconnect() {
    if (this.player) this.player.disconnect();
  }
}
