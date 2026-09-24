# Sidechain Massacre

A lo-bit browser game. You're stuck in a red-lit club full of zombies in speedos. A real
dance track plays. Name it and your character moves toward the back exit. The horde
shambles after you the whole time.

## Scoring

Type any guess; the game works out what you meant.

| Guess | Moves | Rule |
| --- | --- | --- |
| Track name | +3 | 1 typo allowed. " - Radio Edit", "(feat. X)", "(Remix)" and other version tags are ignored. |
| Label | +2 | 90% match. "Records", "Recordings", "Music", "Ltd" ignored. "A / B" or "A under exclusive license to B" count as either. |
| Main artist | +1 | 1 typo allowed. |
| Featured artist or credit | +½ | Featured artists, second main artists, and MusicBrainz credits (writers, producers, engineers). Up to 3 per track. |

- **Emerging** tracks (new releases or low Deezer popularity) pay 1.5x.
- A wrong guess makes noise: the horde gains ½ a move. A hint costs 1½.
- 40 moves to the exit. Your score is escape time, counted only while tracks are playing.
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
