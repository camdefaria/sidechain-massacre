# Sidechain Massacre

A lo-bit browser game. You're stuck in a red-lit club full of zombies in speedos. A real
dance track plays. Name it and your character moves toward the back exit. The horde
shambles after you the whole time.

## Modes

Picked on the title screen, before characters. Defined in `src/data/modes.js`.

| Mode | Level | Pool | Window |
| --- | --- | --- | --- |
| Fan.Clacker | Easy | The biggest dance-pop and EDM earworms | 10 years |
| FISHERman | Medium | Top-selling tech house earworms | 10 years |
| Tastemaker | Hard | Recognizable hits across dubstep, future bass, DnB, trance, hardstyle, house | 15 years |
| IDentifier | Veteran | Classic dance cuts plus Deezer's newest label releases (every third track) | no limit |

Each mode seeds its pool by searching public Deezer playlists. To hand-curate, paste
playlist IDs (the number in a deezer.com/playlist/ link) into that mode's `playlists`
array; those always load first. Harder modes also make the horde faster (`hordePace`).

## Scoring

Every song gets 20 seconds. How fast you answer sets the payout:

| Answer time | Payout |
| --- | --- |
| 0–5s | full moves |
| 5–10s | 75% |
| 10–14s | 50% |
| 14–17s | 25% |
| last 3s | correct, but no move |


Type any guess; the game works out what you meant. Base moves:

| Guess | Moves | Rule |
| --- | --- | --- |
| Track name | +3 | 1 typo allowed. " - Radio Edit", "(feat. X)", "(Remix)" and other version tags are ignored. |
| Label | +2 | 90% match. "Records", "Recordings", "Music", "Ltd" ignored. "A / B" or "A under exclusive license to B" count as either. |
| Main artist | +1 | 1 typo allowed. |
| Featured artist or credit | +½ | Featured artists, second main artists, and MusicBrainz credits (writers, producers, engineers). Up to 3 per track. |

- **Emerging** tracks (new releases or low Deezer popularity) pay 1.5x.
- A wrong guess makes noise and a hint costs ground; both are set per mode (easier modes cost less).
- 40 moves to the exit. Your score is escape time, counted only while the clock runs.
- Tuning lives at the top of `src/main.js` (horde speed, costs) and in
  `src/game/match.js` (move values).

## How it works

- `api/deezer.js`: Vercel function proxying a small allowlist of Deezer API paths
  (Deezer doesn't allow direct browser calls). Charts: Dance (113) and Electro (106).
- `api/credits.js`: looks up credits on MusicBrainz by ISRC. Coverage for new dance
  releases is uneven, so credits are a bonus.
- `src/data/tracks.js`: builds the track pool and fetches answers per round.
- `src/game/match.js`: fuzzy matching and scoring.
- `src/game/club.js`: the 320x180 pixel club, route, horde, lighting.
- `src/game/sprites.js`: hand-drawn 12x16 sprites for the five characters and the zombies.

## Local dev

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

Add `?mock` to the URL to play with offline test tracks (no audio, no network).

## Licensing notes

- Audio is Deezer's 30-second previews. Deezer's community guidance allows this for
  non-commercial games with attribution (shown in-game). Commercial use needs Deezer's
  sign-off.
- Spotify is no longer used: its Developer Policy prohibits games.
- Characters are original or archetype designs. Get sign-off before using any real
  artist's name or likeness.
