/**
 * Script to download NotoNastaliqUrdu TTF font for PDF embedding
 * Run: node scripts/download-urdu-font.cjs
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'lib', 'urdu-font-base64.ts');

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) { reject(new Error('Too many redirects')); return; }
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirect = res.headers.location.startsWith('http') 
          ? res.headers.location 
          : new URL(res.headers.location, url).href;
        console.log(`  Redirect -> ${redirect}`);
        fetchUrl(redirect, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function tryFonts(sources) {
  for (const { url, name } of sources) {
    try {
      console.log(`\nTrying: ${name}`);
      console.log(`URL: ${url}`);
      const buf = await fetchUrl(url);
      console.log(`Downloaded: ${(buf.length/1024).toFixed(0)} KB`);
      
      // Check if it's a valid font (TTF/OTF start with specific bytes)
      const header = buf.slice(0, 4).toString('hex');
      console.log(`File header: ${header}`);
      
      // TTF: 00010000, OTF: 4f54544f, woff: 774f4646, woff2: 774f4632
      if (buf.length > 50000) { // Must be at least 50KB for a real font
        return { buf, name };
      } else {
        console.log(`  Too small for a font, skipping`);
      }
    } catch(e) {
      console.log(`  Failed: ${e.message}`);
    }
  }
  return null;
}

async function main() {
  // Multiple sources for NotoNastaliqUrdu or Amiri TTF
  const sources = [
    // Amiri - good Arabic/Urdu support, available as TTF
    {
      name: 'Amiri Regular TTF (raw.githubusercontent.com)',
      url: 'https://raw.githubusercontent.com/alif-type/amiri/master/Amiri-Regular.ttf'
    },
    {
      name: 'Amiri TTF (fontsource CDN)',
      url: 'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.1.1/files/amiri-arabic-400-normal.woff2'
    },
    {
      name: 'Noto Naskh Arabic TTF (fontsource)',
      url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-naskh-arabic@5.1.0/files/noto-naskh-arabic-arabic-400-normal.ttf'
    },
    {
      name: 'Scheherazade New TTF',
      url: 'https://raw.githubusercontent.com/silnrsi/font-scheherazade/master/fonts/Scheherazade-Regular.ttf'
    },
  ];

  const result = await tryFonts(sources);
  
  if (!result) {
    console.error('\n❌ All font sources failed.');
    console.log('Creating placeholder - will handle Urdu via canvas rendering');
    
    const fallback = `// Urdu font placeholder - download failed
// The PDF module will fall back to alternative rendering for Urdu text
export const URDU_FONT_BASE64 = "";
export const URDU_FONT_FORMAT = "truetype";
export const FONT_AVAILABLE = false;
`;
    fs.writeFileSync(OUTPUT_FILE, fallback, 'utf8');
    return;
  }

  const { buf, name } = result;
  const base64 = buf.toString('base64');
  
  // Check format
  const header = buf.slice(0, 4).toString('hex');
  let format = 'truetype';
  if (header === '774f4632') format = 'woff2'; // Not usable in jsPDF directly
  else if (header === '774f4646') format = 'woff'; // Not usable
  else if (header === '4f54544f') format = 'opentype';
  
  console.log(`\nFont: ${name}`);
  console.log(`Format: ${format}`);
  console.log(`Size: ${(buf.length/1024).toFixed(0)} KB -> Base64: ${(base64.length/1024).toFixed(0)} KB`);
  
  const content = `// Auto-generated: Arabic/Urdu font in Base64 for PDF support
// Font: ${name}
// Format: ${format}
// License: Open Font License
// Note: If format is woff2, jsPDF cannot embed it directly.
export const URDU_FONT_BASE64 = "${base64}";
export const URDU_FONT_FORMAT = "${format}";
export const FONT_AVAILABLE = ${format === 'truetype' || format === 'opentype'};
`;
  
  fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
  console.log(`\n✅ Saved: ${OUTPUT_FILE}`);
}

main().catch(console.error);
