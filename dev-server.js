// Local stand-in for Vercel: serves public/ and the api/ functions on http://localhost:3000.
const http = require('http');
const fs = require('fs');
const path = require('path');

const routes = { '/api/original-document': require('./api/original-document'), '/api/projects': require('./api/projects'), '/api/public-research': require('./api/public-research'), '/api/survey-document': require('./api/survey-document'), '/api/surveys': require('./api/surveys'), '/api/plat-bundle': require('./api/plat-bundle'), '/api/hoa': require('./api/hoa'), '/api/parcel-docs': require('./api/parcel-docs'), '/api/plat-sheet': require('./api/plat-sheet'), '/api/notices': require('./api/notices'), '/api/packet-ocr': require('./api/packet-ocr'), '/api/watch': require('./api/watch') };
const port = +process.env.PORT || 3000;

http.createServer((req, res) => {
  const p = new URL(req.url, 'http://local').pathname;
  if (routes[p]) return routes[p](req, res);
  const file = path.join(__dirname, 'public', p === '/' ? 'welcome.html' : p);
  if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.woff2':'font/woff2'};
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log('Cornerpin dev server on http://localhost:' + port));
