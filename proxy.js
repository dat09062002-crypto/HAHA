// Chạy: node proxy.js  (cần Node 18 trở lên) rồi mở http://localhost:8080
// Phục vụ file tĩnh và chuyển tiếp các API chứng khoán để tránh lỗi CORS của trình duyệt.
const http = require('http'), fs = require('fs'), path = require('path');
const ALLOW = ['finfo-api.vndirect.com.vn', 'api-finfo.vndirect.com.vn', 'dchart-api.vndirect.com.vn', 'apipubaws.tcbs.com.vn'];
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const PORT = process.env.PORT || 8080;

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/proxy') {
    try {
      const t = new URL(u.searchParams.get('url'));
      if (t.protocol !== 'https:' || !ALLOW.includes(t.hostname)) { res.writeHead(403); return res.end('Host không được phép'); }
      const r = await fetch(t, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' } });
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' });
      return res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { res.writeHead(502); return res.end('Proxy lỗi: ' + e.message); }
  }
  const f = path.join(__dirname, path.normalize(u.pathname === '/' ? 'index.html' : u.pathname));
  if (!f.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Không tìm thấy'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(data);
  });
}).listen(PORT, () => console.log('Mở http://localhost:' + PORT));
