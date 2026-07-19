const fs = require('fs');
const https = require('https');
const path = require('path');

const url = "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf";
const destFile = path.join(__dirname, "../src/lib/urdu-font-base64.ts");

console.log("Downloading Noto Naskh Arabic TTF...");

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed: HTTP ${res.statusCode}`);
    return;
  }

  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    console.log(`Downloaded: ${Math.round(buffer.length / 1024)} KB`);
    
    // Check if it's a TTF (starts with 00 01 00 00)
    const header = buffer.toString('hex', 0, 4);
    console.log("Font header:", header);

    const base64 = buffer.toString('base64');
    const tsCode = `// Auto-generated. Do not edit directly.
// Noto Naskh Arabic - TTF
export const FONT_AVAILABLE = true;
export const URDU_FONT_BASE64 = "${base64}";
`;
    fs.writeFileSync(destFile, tsCode);
    console.log(`Saved to: ${destFile}`);
    console.log(`Base64 size: ${Math.round(tsCode.length / 1024)} KB`);
  });
}).on('error', (err) => {
  console.error("Error downloading:", err);
});
