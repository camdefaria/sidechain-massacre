# Sidechain Massacre

A rhythm/reflex browser game. A number flashes on the beat over a real track streamed
from your own Spotify account — memorize it, type it into the bubble, and keep moving
through the club before the crowd catches you.

## How it works

- **Login:** Spotify Authorization Code + PKCE (`src/spotify/auth.js`) — no client secret
  needed, safe for a public static site. Requires **Spotify Premium** to hear real audio.
- **Playback:** the Web Playback SDK (`src/spotify/player.js`) turns the browser tab into
  a real Spotify Connect device, so audio is licensed and streamed by Spotify itself.
- **Track discovery:** `src/spotify/api.js` searches for dance/EDM playlists and pulls
  tracks from them. Deliberately avoids the Recommendations / Audio Features endpoints,
  which Spotify now gates behind Extended Quota approval — this uses Search + Playlist
  Items, which work from day one in Development Mode.
- **Game loop:** `src/game/rounds.js` + the game screen in `src/main.js` — flash a number,
  type it fast, advance rooms, watch the zombie meter.
- **Characters:** `src/game/characters.js` — starter + unlockable roster, saved to
  `localStorage`. Current portraits are CSS-drawn placeholders (see "Next up" below).

## Local dev

```bash
npm install
cp .env.example .env   # fill in your Spotify Client ID
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173`). Make sure that exact URL +
`/callback` is registered as a Redirect URI in your Spotify app dashboard.

## Deploying to Vercel

1. Import this GitHub repo into Vercel (vercel.com → Add New → Project).
2. Framework preset: Vite (auto-detected).
3. Add environment variables in the Vercel project settings:
   - `VITE_SPOTIFY_CLIENT_ID` = your Spotify app's Client ID
   - `VITE_REDIRECT_URI` = `https://<your-vercel-domain>/callback`
4. Add that same `https://<your-vercel-domain>/callback` as a Redirect URI in the Spotify
   dashboard (Basic Information → Edit).
5. Deploy. `vercel.json` already routes all paths to `index.html` so `/callback` resolves
   correctly.

## Spotify app status

New apps start in **Development Mode**, capped at 25 allowlisted Spotify accounts (added
under the app's "User Management" tab by email — add your friends there to let them play
before going public). To open it up to anyone, apply for **Extended Quota Mode** from the
app dashboard once it's working end-to-end.

## Next up / open items

- Real zombie + club art. Portraits and the arena are placeholder CSS right now —
  swap in real images by dropping files under `public/` and pointing a character's
  `image` field (in `characters.js`) at them.
- Right-of-publicity note: using real DJs' likenesses (Dom Dolla, deadmau5, etc.) for a
  publicly distributed game carries some legal risk even as caricature/parody. Worth a
  second look before a wide public launch.
- Currently every round flashes a random number unrelated to the track's actual timeline.
  A tighter version could sync flashes to the track's beat grid, but Spotify's Audio
  Analysis endpoint (which exposes beat timestamps) is one of the ones now gated behind
  Extended Quota approval — revisit once that's granted.
