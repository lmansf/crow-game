// Turns raw Canva exports into game-ready sprites.
//
//   node tools/make-sprites.js
//
// Reads assets/sprites-raw/slices.json:
//   { "<rawfile>.png": [ { "id": "crow-idle", "crop": [x, y, w, h], "width": 128 } ] }
//
// For each slice: crop the raw export, key out the flat background by
// flood-filling from the border (tolerance-matched to the sampled border
// color, so interior highlights survive), trim the transparent bounds,
// scale to the target width, and write assets/sprites/<id>.png.
//
// Requires playwright-core (used purely as a canvas host; no browser UI).

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const DEV = path.dirname(__dirname);
const RAW = path.join(DEV, 'assets', 'sprites-raw');
const OUT = path.join(DEV, 'assets', 'sprites');
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TOLERANCE = 34; // per-channel distance still counted as background

(async () => {
  const config = JSON.parse(fs.readFileSync(path.join(RAW, 'slices.json'), 'utf-8'));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage();

  for (const [rawName, slices] of Object.entries(config)) {
    const rawB64 = 'data:image/png;base64,' + fs.readFileSync(path.join(RAW, rawName)).toString('base64');
    for (const slice of slices) {
      const out = await page.evaluate(async ({ rawB64, slice, TOLERANCE }) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = rawB64; });
        const [sx, sy, sw, sh] = slice.crop;
        const c = document.createElement('canvas');
        c.width = sw; c.height = sh;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        const data = ctx.getImageData(0, 0, sw, sh);
        const px = data.data;
        // background reference: median of the border pixels
        const border = [];
        for (let x = 0; x < sw; x++) border.push(x * 4, (sw * (sh - 1) + x) * 4);
        for (let y = 0; y < sh; y++) border.push(y * sw * 4, (y * sw + sw - 1) * 4);
        const med = [0, 1, 2].map((ch) => {
          const vals = border.map((i) => px[i + ch]).sort((a, b) => a - b);
          return vals[vals.length >> 1];
        });
        const isBg = (i) =>
          Math.abs(px[i] - med[0]) < TOLERANCE &&
          Math.abs(px[i + 1] - med[1]) < TOLERANCE &&
          Math.abs(px[i + 2] - med[2]) < TOLERANCE;
        // optional erase rects (crop-local): paint over stray text/watermarks
        // with the background color so the flood removes them
        for (const [ex, ey, ew, eh] of slice.erase || []) {
          for (let y = Math.max(0, ey); y < Math.min(sh, ey + eh); y++) {
            for (let x = Math.max(0, ex); x < Math.min(sw, ex + ew); x++) {
              const i = (y * sw + x) * 4;
              px[i] = med[0]; px[i + 1] = med[1]; px[i + 2] = med[2];
            }
          }
        }
        // flood fill from every border pixel: only edge-connected background
        // is removed, so bright interior detail survives
        const seen = new Uint8Array(sw * sh);
        const stack = [];
        for (const i of border) if (isBg(i)) stack.push(i / 4);
        while (stack.length) {
          const p = stack.pop();
          if (seen[p]) continue;
          seen[p] = 1;
          px[p * 4 + 3] = 0;
          const x = p % sw;
          const y = (p / sw) | 0;
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
            const np = ny * sw + nx;
            if (!seen[np] && isBg(np * 4)) stack.push(np);
          }
        }
        ctx.putImageData(data, 0, 0);
        // trim transparent bounds
        let minX = sw, minY = sh, maxX = 0, maxY = 0;
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            if (px[(y * sw + x) * 4 + 3] > 8) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX <= minX) return null;
        const tw = maxX - minX + 1;
        const th = maxY - minY + 1;
        const targetW = slice.width || 128;
        const targetH = Math.round(targetW * (th / tw));
        const o = document.createElement('canvas');
        o.width = targetW; o.height = targetH;
        const octx = o.getContext('2d');
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(c, minX, minY, tw, th, 0, 0, targetW, targetH);
        return o.toDataURL('image/png');
      }, { rawB64, slice, TOLERANCE });
      if (!out) {
        console.warn(slice.id, ': slice came out empty, skipped');
        continue;
      }
      fs.writeFileSync(path.join(OUT, `${slice.id}.png`), Buffer.from(out.split(',')[1], 'base64'));
      console.log('wrote', `assets/sprites/${slice.id}.png`);
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
