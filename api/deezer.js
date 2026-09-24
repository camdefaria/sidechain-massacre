// Server-side proxy to the public Deezer API. Deezer doesn't send CORS headers, so the
// browser can't call it directly. Only the handful of read-only paths the game needs are
// allowed through.
//
// Deezer's terms: attribution required ("Powered by Deezer" is shown in-game), and the
// OK for games is for non-commercial use.

const ALLOWED = [
  /^chart\/\d+\/tracks$/,
  /^editorial\/\d+\/releases$/,
  /^album\/\d+$/,
  /^album\/\d+\/tracks$/,
  /^track\/\d+$/,
  /^search$/,
];

const PASS_PARAMS = ['limit', 'index', 'q'];

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = (url.searchParams.get('path') || '').replace(/^\/+/, '');
    if (!ALLOWED.some((re) => re.test(path))) {
      return send(res, 400, { error: 'path not allowed' });
    }
    const upstream = new URL(`https://api.deezer.com/${path}`);
    for (const p of PASS_PARAMS) {
      const v = url.searchParams.get(p);
      if (v != null) upstream.searchParams.set(p, v);
    }
    const r = await fetch(upstream, { headers: { Accept: 'application/json' } });
    const body = await r.json();
    // Deezer reports errors inside a 200 body, e.g. { error: { type, message, code } }
    if (body && body.error) return send(res, 502, { error: body.error });
    // Charts/releases can be cached briefly at the edge. Preview URLs are signed and
    // expire, so keep this short.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return send(res, 200, body);
  } catch (e) {
    return send(res, 500, { error: String(e && e.message ? e.message : e) });
  }
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}
