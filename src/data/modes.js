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
    blurb: "Festival-sized EDM from the last 10 years. If it's been on a main stage, it's in here.",
    maxAgeYears: 10,
    minRank: 600000,
    hordePace: 1.6,
    noise: 0.25,
    hintCost: 0.75,
    playlists: [],
    queries: ['EDM anthems', 'EDM hits', 'festival anthems', 'big room', 'mainstage EDM'],
  },
  {
    id: 'fisher',
    name: 'FISHERman',
    level: 'Medium',
    blurb: 'Tech house that took over every college party of the last 10 years.',
    maxAgeYears: 10,
    minRank: 400000,
    hordePace: 1.3,
    noise: 0.4,
    hintCost: 1,
    playlists: [],
    queries: ['tech house anthems', 'tech house hits', 'tech house bangers', 'tech house party'],
  },
  {
    id: 'taste',
    name: 'Tastemaker',
    level: 'Hard',
    blurb: 'Dubstep, future bass, house and drum & bass from the last 15 years. Big names and the tier just under them.',
    maxAgeYears: 15,
    minRank: 200000,
    hordePace: 1.1,
    noise: 0.5,
    hintCost: 1.25,
    playlists: [],
    queries: ['dubstep classics', 'future bass', 'drum and bass anthems', 'bass music', 'house anthems', 'riddim dubstep'],
  },
  {
    id: 'id',
    name: 'IDentifier',
    level: 'Veteran',
    blurb: '20+ years of electronic music, plus new artists to watch. The horde moves fastest here.',
    maxAgeYears: null,
    minRank: 0,
    hordePace: 0.9,
    noise: 0.6,
    hintCost: 1.5,
    playlists: [],
    queries: ['techno', 'melodic techno', 'underground house', 'electronic classics', 'progressive house classics', 'uk garage'],
    newReleases: true, // mix in Deezer's newest Dance/Electro releases as "emerging"
  },
];

export const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];
