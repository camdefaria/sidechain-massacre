// Difficulty modes. Each mode's track pool comes from:
//   1. `playlists`: Deezer playlist IDs you hand-pick (put the number from a
//      deezer.com/playlist/<ID> link here). These always load first.
//   2. `queries`: keyword searches for public Deezer playlists, used to seed the pool
//      until the hand-picked lists are in.
// Tracks older than `maxAgeYears` are skipped (null = no limit). `minRank` keeps a mode
// to bigger records (Deezer rank runs roughly 0..1,000,000). `hordePace` scales how
// fast the zombies move: above 1 is slower, below 1 is faster. `noise` is what a wrong
// guess costs you (moves the horde gains); `hintCost` is the same for a hint.

export const MODES = [
  {
    id: 'fan',
    name: 'Fan.Clacker',
    level: 'Easy',
    blurb: 'Pure earworms. The biggest dance hits of the last 10 years, the ones you already know every word to.',
    maxAgeYears: 10,
    minRank: 700000,
    hordePace: 2.0,
    noise: 0.15,
    hintCost: 0.5,
    playlists: [],
    queries: ['dance hits', 'EDM hits', 'dance pop hits', 'party anthems', 'biggest dance songs', 'summer dance hits'],
  },
  {
    id: 'fisher',
    name: 'FISHERman',
    level: 'Medium',
    blurb: 'The top-selling tech house earworms of the last 10 years. Every one of them has closed a college party.',
    maxAgeYears: 10,
    minRank: 500000,
    hordePace: 1.6,
    noise: 0.3,
    hintCost: 0.75,
    playlists: [],
    queries: ['tech house top 100', 'tech house hits', 'best tech house', 'tech house bangers', 'tech house anthems'],
  },
  {
    id: 'taste',
    name: 'Tastemaker',
    level: 'Hard',
    blurb: 'Recognizable hits from all over the EDM map: dubstep, future bass, drum & bass, trance, hardstyle, house.',
    maxAgeYears: 15,
    minRank: 400000,
    hordePace: 1.35,
    noise: 0.4,
    hintCost: 1,
    playlists: [],
    queries: ['dubstep hits', 'future bass hits', 'drum and bass hits', 'trance anthems', 'hardstyle hits', 'melodic dubstep', 'house hits'],
  },
  {
    id: 'id',
    name: 'IDentifier',
    level: 'Veteran',
    blurb: 'Fresh label releases and classic dance cuts. Know your catalog.',
    maxAgeYears: null,
    minRank: 150000,
    hordePace: 1.1,
    noise: 0.5,
    hintCost: 1.25,
    playlists: [],
    queries: ['classic house anthems', 'dance classics', '90s dance classics', '2000s dance anthems', 'french house classics', 'progressive house classics'],
    newReleases: true, // Deezer's newest Dance/Electro releases, every third track
  },
];

export const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];
