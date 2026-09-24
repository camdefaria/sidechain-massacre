// Looks up behind-the-scenes credits (writers, producers, engineers, featured players)
// for a recording on MusicBrainz, using the ISRC Deezer gives us. MusicBrainz asks for a
// descriptive User-Agent and max 1 request per second, so the two calls are spaced out
// and results are cached at the edge for a day.
//
// Coverage is uneven: plenty of new dance releases aren't in MusicBrainz yet. The game
// treats credits as a bonus, never a requirement.

const UA = 'SidechainMassacre/0.2 ( https://sidechain-massacre.vercel.app )';
const MB = 'https://musicbrainz.org/ws/2';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const isrc = (url.searchParams.get('isrc') || '').trim().toUpperCase();
    if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc)) return send(res, 400, { error: 'bad isrc' });

    const lookup = await mb(`/isrc/${isrc}?fmt=json`);
    const recordingId = lookup?.recordings?.[0]?.id;
    if (!recordingId) return cached(res, { isrc, credits: [] });

    await sleep(1100);
    const rec = await mb(
      `/recording/${recordingId}?fmt=json&inc=artist-credits+artist-rels+work-rels+work-level-rels`
    );

    const credits = new Map(); // name -> Set(roles)
    const add = (name, role) => {
      if (!name) return;
      if (!credits.has(name)) credits.set(name, new Set());
      credits.get(name).add(role);
    };

    for (const ac of rec?.['artist-credit'] || []) add(ac?.artist?.name || ac?.name, 'artist');
    for (const rel of rec?.relations || []) {
      if (rel['target-type'] === 'artist') add(rel.artist?.name, rel.type);
      if (rel['target-type'] === 'work') {
        for (const wrel of rel.work?.relations || []) {
          if (wrel['target-type'] === 'artist') add(wrel.artist?.name, wrel.type);
        }
      }
    }

    return cached(res, {
      isrc,
      recordingId,
      credits: [...credits].map(([name, roles]) => ({ name, roles: [...roles] })),
    });
  } catch (e) {
    return send(res, 200, { credits: [], error: String(e && e.message ? e.message : e) });
  }
}

async function mb(path) {
  const r = await fetch(MB + path, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`MusicBrainz ${r.status}`);
  return r.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cached(res, obj) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
  return send(res, 200, obj);
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}
