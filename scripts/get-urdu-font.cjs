/**
 * Download NotoNastaliqUrdu TTF font for PDF embedding
 * Run: node scripts/get-urdu-font.cjs
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchAll(url, redir = 0) {
  return new Promise((resolve, reject) => {
    if (redir > 10) { reject(new Error('Too many redirects')); return; }
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        fetchAll(res.headers.location, redir + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    }).on('error', reject);
  });
}

var url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notonastaliqurdu/NotoNastaliqUrdu%5Bwght%5D.ttf';
var outFile = path.join(__dirname, '..', 'src', 'lib', 'urdu-font-base64.ts');

console.log('Downloading NotoNastaliqUrdu TTF...');
fetchAll(url).then(function(buf) {
  console.log('Downloaded: ' + Math.round(buf.length / 1024) + ' KB');
  var b64 = buf.toString('base64');
  var header = buf.slice(0, 4).toString('hex');
  console.log('Font header: ' + header);
  
  var lines = [
    '// NotoNastaliqUrdu Variable font - Base64 encoded for PDF Urdu text support',
    '// Source: Google Fonts (Open Font License)',
    '// Size: ' + Math.round(buf.length / 1024) + ' KB TTF -> ' + Math.round(b64.length / 1024) + ' KB Base64',
    'export const URDU_FONT_BASE64 = "' + b64 + '";',
    'export const URDU_FONT_FORMAT = "truetype";',
    'export const FONT_AVAILABLE = true;',
    ''
  ];
  
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log('Saved to: ' + outFile);
  console.log('Base64 size: ' + Math.round(b64.length / 1024) + ' KB');
}).catch(function(e) {
  console.error('Error: ' + e.message);
  process.exit(1);
});
