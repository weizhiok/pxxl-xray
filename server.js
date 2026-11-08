// Minimal Pxxl node: plain VLESS + WebSocket, no decoy site, no camouflage.
// This node is only for Muse's own use (via the VM egress proxy), so there is
// no need for a decoy website, reverse-proxy tricks, or traffic shaping.
// Pxxl terminates TLS at the edge; Xray here sees plain WebSocket.
// A tiny HTTP server listens on $PORT: it forwards WebSocket upgrades on the
// WSPATH to Xray, and answers anything else with a plain "OK" (so Pxxl's
// health check sees HTTP 200).
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

const uuid = process.env.UUID;
const wsPath = process.env.WSPATH || '/';
const port = parseInt(process.env.PORT || '8080', 10);
if (!uuid) { console.error('UUID required'); process.exit(1); }

const xrayPort = 10000;
const bin = path.join(__dirname, 'xray');
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
    streamSettings: { network: 'ws', wsSettings: { path: wsPath } }
  }],
  outbounds: [{ protocol: 'freedom' }]
};
const cfgPath = path.join('/tmp', 'runtime-' + crypto.randomBytes(4).toString('hex') + '.json');
fs.writeFileSync(cfgPath, JSON.stringify(cfg));
const child = spawn(bin, ['run', '-c', cfgPath], { stdio: 'inherit', cwd: __dirname });
child.on('exit', (c) => process.exit(c || 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
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
  console.log('listening on ' + port + '; xray vless+ws on 127.0.0.1:' + xrayPort + ' path ' + wsPath);
});
