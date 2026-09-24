// Offline test data for `?mock` mode (local development without network access).
// Invented tracks, silent audio. Never used in production.

const SILENT =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const TRACKS = [
  { id: 1, title: 'Night Shift Protocol - Extended Mix', titleShort: 'Night Shift Protocol', label: 'Placeholder Records Ltd', main: ['Test Artist'], feat: ['Guest Vox'], credits: ['Jane Writer'] },
  { id: 2, title: 'Red Room (feat. Somebody)', titleShort: 'Red Room', label: 'Fake Imprint Music', main: ['Mock DJ'], feat: ['Somebody'], credits: [] },
  { id: 3, title: 'Cloakroom', titleShort: 'Cloakroom', label: 'Nowhere Recordings', main: ['Duo A', 'Duo B'], feat: [], credits: ['Some Engineer'], emerging: true },
];

export const MOCK_POOL = TRACKS.map((t) => ({ id: t.id, preview: SILENT, rank: 500000, emerging: !!t.emerging }));

export function mockDetails(entry) {
  const t = TRACKS.find((x) => x.id === entry.id);
  return {
    id: t.id,
    title: t.title,
    titleShort: t.titleShort,
    titleVersion: '',
    mainArtists: t.main,
    featuredArtists: t.feat,
    label: t.label,
    isrc: '',
    bpm: 124,
    preview: SILENT,
    cover: null,
    link: '#',
    emerging: !!t.emerging,
    _mockCredits: t.credits,
  };
}
