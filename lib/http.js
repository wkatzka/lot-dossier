// Small fetch helpers for the document service (Node 18+ global fetch).
const UA = 'LotDossier/0.3 (+public-records due diligence)';

async function get(url, { timeout = 45000, headers = {}, method = 'GET', body } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { method, body, headers: { 'User-Agent': UA, ...headers }, signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
    return r;
  } finally {
    clearTimeout(t);
  }
}

async function text(url, opts) { return (await get(url, opts)).text(); }

// Large public files (meeting packets) come off the state server at ~1.7 MB/s per connection; fetching byte ranges in
// parallel gets ~15 MB/s. Small files and servers without range support use one plain request.
async function buffer(url, { maxBytes = 60e6, parts = 12, timeout = 60000 } = {}) {
  let len = 0, ranges = false;
  try {
    const h = await get(url, { method: 'HEAD', timeout: 15000 });
    len = +h.headers.get('content-length') || 0; ranges = /bytes/i.test(h.headers.get('accept-ranges') || '');
  } catch (e) { /* some servers refuse HEAD; fall through to GET */ }
  if (len > maxBytes) throw new Error(`${url} is ${Math.round(len / 1e6)} MB, over the ${Math.round(maxBytes / 1e6)} MB limit`);
  if (!ranges || len < 4e6) return Buffer.from(await (await get(url, { timeout })).arrayBuffer());
  const size = Math.ceil(len / parts);
  const chunks = await Promise.all(Array.from({ length: parts }, (_, i) =>
    get(url, { timeout, headers: { Range: `bytes=${i * size}-${Math.min(len, (i + 1) * size) - 1}` } }).then(r => r.arrayBuffer())));
  const out = Buffer.concat(chunks.map(c => Buffer.from(c)));
  if (out.length !== len) throw new Error(`range download of ${url} returned ${out.length} of ${len} bytes`);
  return out;
}

function decode(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

// Run promise-returning tasks with a concurrency cap.
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: String(e.message || e) }; } }
  }));
  return out;
}

module.exports = { get, text, buffer, decode, pool, UA };
