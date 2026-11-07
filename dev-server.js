// Local stand-in for Vercel: serves public/ and the api/ functions on http://localhost:3000.
const http = require('http');
const fs = require('fs');
const path = require('path');

const routes = { '/api/hoa': require('./api/hoa'), '/api/parcel-docs': require('./api/parcel-docs'), '/api/plat-sheet': require('./api/plat-sheet'), '/api/notices': require('./api/notices'), '/api/packet-ocr': require('./api/packet-ocr'), '/api/watch': require('./api/watch') };
const port = +process.env.PORT || 3000;

http.createServer((req, res) => {
  const p = new URL(req.url, 'http://local').pathname;
  if (routes[p]) return routes[p](req, res);
  const file = path.join(__dirname, 'public', p === '/' ? 'index.html' : p);
  if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log('Cornerpin dev server on http://localhost:' + port));
