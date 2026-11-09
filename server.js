// Placeholder website for ww's Pxxl container.
// Per ww's rule (2026-11-09): claimed containers do NOT run proxy nodes by
// default; a small website occupies the slot until a real use is decided.
const http = require('http');

const port = parseInt(process.env.PORT || '8080', 10);

const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ww 的小站 · Pxxl</title>
<style>
  body { margin:0; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; background:linear-gradient(135deg,#1e293b,#0f172a); color:#e2e8f0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .card { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:36px 40px; max-width:520px; margin:16px; }
  h1 { font-size:26px; margin:0 0 8px; }
  .sub { color:#94a3b8; margin:0 0 20px; line-height:1.7; }
  .row { display:flex; justify-content:space-between; padding:8px 0; border-top:1px solid rgba(255,255,255,.08); font-size:14px; }
  .row span:first-child { color:#94a3b8; }
  .dot { color:#4ade80; }
</style>
</head>
<body>
  <div class="card">
    <h1>🌐 ww 的小站</h1>
    <p class="sub">这个容器已经上线，站点先占个位置。<br>以后有具体用途时，这里会换成正式内容。</p>
    <div class="row"><span>平台</span><span>Pxxl 免费容器</span></div>
    <div class="row"><span>部署日期</span><span>2026-11-09</span></div>
    <div class="row"><span>状态</span><span><span class="dot">●</span> 运行中</span></div>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

server.listen(port, '0.0.0.0', () => {
  console.log('placeholder site listening on ' + port);
});
