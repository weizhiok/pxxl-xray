const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const url = 'https://github.com/XTLS/Xray-core/releases/download/v25.10.15/Xray-linux-64.zip';
const zip = path.join(__dirname, 'xray.zip');
const bin = path.join(__dirname, 'xray');
function get(u, file) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(file);
    https.get(u, { headers: { 'User-Agent': 'setup' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        f.close(); try { fs.unlinkSync(file); } catch (e) {}
        return get(res.headers.location, file).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      res.pipe(f); f.on('finish', () => f.close(resolve));
    }).on('error', reject);
  });
}
(async () => {
  if (!fs.existsSync(bin)) {
    await get(url, zip);
    execSync('unzip -o -q xray.zip && chmod +x xray && rm -f xray.zip LICENSE README.md', { cwd: __dirname, stdio: 'inherit' });
  }
  console.log('setup ok');
})().catch((e) => { console.error(e); process.exit(1); });
