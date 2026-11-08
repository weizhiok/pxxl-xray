const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const uuid = process.env.UUID || process.env.APP_KEY;
const wsPath = process.env.WSPATH || process.env.API_ROUTE || '/api/v1/sync';
const port = parseInt(process.env.PORT || '8080', 10);
if (!uuid) { console.error('UUID required'); process.exit(1); }

// Xray listens only on localhost (internal). The public HTTP server below
// reverse-proxies the VLESS WebSocket to it and serves a decoy site otherwise,
// so the domain looks like an ordinary personal website.
const xrayPort = 10000;

const bin = path.join(__dirname, 'web-worker');
if (!fs.existsSync(bin)) {
  try { execSync('node setup.js', { stdio: 'inherit', cwd: __dirname }); }
  catch (e) { process.exit(1); }
}
const cfg = {
  log: { loglevel: 'warning' },
  inbounds: [{
    listen: '127.0.0.1', port: xrayPort,
    protocol: 'vless',
    settings: { clients: [{ id: uuid }], decryption: 'none' },
    streamSettings: { network: 'ws', wsSettings: { path: wsPath } },
    sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] }
  }],
  outbounds: [
    { protocol: 'freedom', tag: 'direct', settings: { domainStrategy: 'UseIPv4' } },
    { protocol: 'blackhole', tag: 'block' }
  ],
  routing: {
    domainStrategy: 'IPIfNonMatch',
    rules: [
      { type: 'field', outboundTag: 'block', protocol: ['bittorrent'] },
      { type: 'field', outboundTag: 'block', ip: ['geoip:private'] },
      { type: 'field', outboundTag: 'block', domain: ['geosite:private'] }
    ]
  },
  dns: { servers: ['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query'], queryStrategy: 'UseIPv4' }
};
const cfgPath = path.join('/tmp', 'runtime-' + crypto.randomBytes(4).toString('hex') + '.json');
fs.writeFileSync(cfgPath, JSON.stringify(cfg));
const child = spawn(bin, ['run', '-c', cfgPath], { stdio: 'inherit', cwd: __dirname });
child.on('exit', (c) => process.exit(c || 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));

// --- Decoy website (camouflage): the domain reads as a normal personal site ---
const decoyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wei's Notes — A quiet place for code and coffee</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:0;color:#222;background:#fafafa}
header{max-width:720px;margin:0 auto;padding:64px 20px 8px}
h1{font-size:28px;margin:0 0 8px}
p.lead{color:#555;line-height:1.6}
main{max-width:720px;margin:0 auto;padding:8px 20px 64px}
article{border-top:1px solid #e5e5e5;padding:18px 0}
article h2{font-size:19px;margin:0 0 6px}
article h2 a{color:#1a73e8;text-decoration:none}
article time{color:#888;font-size:13px}
article p{color:#444;line-height:1.6;margin:8px 0 0}
footer{max-width:720px;margin:0 auto;padding:0 20px 48px;color:#999;font-size:13px}
</style>
</head>
<body>
<header>
<h1>Wei's Notes</h1>
<p class="lead">A quiet place for code, coffee, and the occasional half-finished side project. I write about the things I build and the things I break.</p>
</header>
<main>
<article><h2><a href="#">Notes on keeping a small server tidy</a></h2><time>Nov 2, 2026</time><p>Every few months I go through the same ritual: update the packages, prune the old containers, delete the logs nobody reads, and write down what changed so future-me doesn't have to guess.</p></article>
<article><h2><a href="#">A tiny static site, served from anywhere</a></h2><time>Oct 18, 2026</time><p>Sometimes the simplest stack is the right one. A handful of HTML files, no build step, no framework — just something that loads fast and stays up.</p></article>
<article><h2><a href="#">What I learned automating my backups</a></h2><time>Sep 27, 2026</time><p>Backups are boring until the day you need one. A short note on the little script that copies everything to a second disk every night, and why I finally trust it.</p></article>
</main>
<footer>© 2026 Wei's Notes · Made with plain HTML.</footer>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(decoyHtml);
});

server.on('upgrade', (req, socket, head) => {
  let pathname = '/';
  try { pathname = new URL(req.url || '/', 'http://localhost').pathname; } catch (e) { pathname = req.url || '/'; }
  if (pathname !== wsPath) { socket.destroy(); return; }
  const upstream = net.connect(xrayPort, '127.0.0.1', () => {
    const lines = [];
    lines.push(req.method + ' ' + req.url + ' HTTP/1.1');
    for (const [k, v] of Object.entries(req.headers)) lines.push(k + ': ' + v);
    upstream.write(lines.join('\r\n') + '\r\n\r\n');
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  upstream.on('error', () => { try { socket.destroy(); } catch (e) {} });
  socket.on('error', () => { try { upstream.destroy(); } catch (e) {} });
});

server.listen(port, '0.0.0.0', () => {
  console.log('public server listening on ' + port + '; xray on 127.0.0.1:' + xrayPort);
});
