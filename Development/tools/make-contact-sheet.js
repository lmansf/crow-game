// Composites before/after anchor captures into one review contact sheet.
//
//   node tools/make-contact-sheet.js <beforeDir> <afterDir> <out.png> [title]
//
// Every *.png present in beforeDir is paired with the same name in afterDir;
// missing pairs are skipped with a warning.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const [BEFORE, AFTER, OUTFILE, TITLE = 'Art rework — contact sheet'] = process.argv.slice(2);
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!BEFORE || !AFTER || !OUTFILE) {
  console.error('usage: node tools/make-contact-sheet.js <beforeDir> <afterDir> <out.png> [title]');
  process.exit(2);
}

const b64 = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');

(async () => {
  const rows = [];
  for (const name of fs.readdirSync(BEFORE).filter((n) => n.endsWith('.png')).sort()) {
    const after = path.join(AFTER, name);
    if (!fs.existsSync(after)) { console.warn('no after image for', name); continue; }
    rows.push({ id: name.replace('.png', ''), before: b64(path.join(BEFORE, name)), after: b64(after) });
  }
  if (!rows.length) { console.error('nothing to composite'); process.exit(1); }

  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #0b0614; color: #e8e2f2; font: 14px "Segoe UI", system-ui, sans-serif; }
    #sheet { padding: 26px 30px; width: fit-content; }
    h1 { font-size: 22px; letter-spacing: .18em; color: #35e0e0; margin: 0 0 4px; }
    .sub { color: #8d83a3; letter-spacing: .1em; font-size: 12px; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: 150px auto auto; gap: 12px 16px; align-items: center; }
    .head { color: #ffd166; letter-spacing: .2em; font-size: 12px; font-weight: 700; }
    .label { color: #a98fff; font-weight: 700; letter-spacing: .06em; }
    img { display: block; border: 1px solid rgba(169,143,255,.3); border-radius: 8px; max-width: 560px; }
  </style><div id="sheet"><h1>${TITLE}</h1>
  <div class="sub">${new Date().toISOString().slice(0, 10)} · fixed world-rect framings via tools/anchor-shots.js</div>
  <div class="grid"><div></div><div class="head">CURRENT</div><div class="head">REWORK</div>
  ${rows.map((r) => `<div class="label">${r.id}</div><img src="${r.before}"><img src="${r.after}">`).join('')}
  </div></div>`;

  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.setContent(html);
  await page.waitForTimeout(300);
  await page.locator('#sheet').screenshot({ path: OUTFILE });
  await browser.close();
  console.log('sheet written:', OUTFILE, `(${rows.length} anchors)`);
})().catch((e) => { console.error(e); process.exit(1); });
