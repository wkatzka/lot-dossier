// Response helpers shared by the API routes. CORS is open so the app works from any host or from a file on disk.
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return true; }
  return false;
}

function query(req) {
  if (req.query) return req.query;
  return Object.fromEntries(new URL(req.url, 'http://local').searchParams);
}

function send(res, status, body, cacheSeconds) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Public records change slowly; let the CDN cache successful lookups so repeat dossiers are instant.
  res.setHeader('Cache-Control', status === 200 && cacheSeconds ? `public, max-age=3600, s-maxage=${cacheSeconds}, stale-while-revalidate=86400` : 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = { cors, query, send };
