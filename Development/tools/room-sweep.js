// Phase E room sweep: capture every zone of the game at several camera
// positions and compose one atlas for review, so no demo-era art can hide
// in an unvisited corner. Also emits a grayscale strip of combat framings
// for the art bible's readability rule.
//
//   node tools/room-sweep.js <outDir> [serverUrl]

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const OUT = process.argv[2];
const URL = process.argv[3] || 'http://localhost:8123/index.html?debug=1&gfx=high';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!OUT) {
  console.error('usage: node tools/room-sweep.js <outDir> [serverUrl]');
  process.exit(2);
}

const LEVELS = [
  'ocean-drive', 'hall-drain', 'brickell-ascent', 'hall-glideway',
  'wynwood-walls', 'hall-underpass', 'little-havana', 'hall-toll',
  'skyway-mile-zero', 'hall-causeway', 'river-of-grass', 'ufo', 'the-rookery',
];
const SPOTS = [0.18, 0.5, 0.82];

// combat framings for the grayscale readability strip
const COMBAT = [
  { id: 'gulls', level: 'ocean-drive', player: [880, 1100] },
  { id: 'imps', level: 'little-havana', player: [7150, 1900] },
  { id: 'snakes', level: 'river-of-grass', player: [850, 2400] },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(URL);
  await page.waitForTimeout(600);

  const shots = [];
  for (const level of LEVELS) {
    for (let i = 0; i < SPOTS.length; i++) {
      await page.evaluate(({ level, u }) => {
        const cg = window.__cg;
        cg.game.launchLevel(level);
        cg.player.x = cg.level.width * u;
        cg.player.y = cg.level.spawn.y - 60;
        cg.player.vx = cg.player.vy = 0;
        cg.camera.snapTo(cg.player.x, cg.player.y, cg.level);
        cg.game.freeze = 99999;
      }, { level, u: SPOTS[i] });
      await page.waitForTimeout(280);
      const file = path.join(OUT, `${level}-${i}.png`);
      await page.screenshot({ path: file });
      shots.push({ level, i, file });
    }
    console.log('swept', level);
  }

  const gray = [];
  for (const c of COMBAT) {
    await page.evaluate(({ level, player }) => {
      const cg = window.__cg;
      cg.game.launchLevel(level);
      cg.player.x = player[0];
      cg.player.y = player[1];
      cg.camera.snapTo(cg.player.x, cg.player.y, cg.level);
      cg.game.freeze = 99999;
    }, c);
    await page.waitForTimeout(280);
    const file = path.join(OUT, `gray-${c.id}.png`);
    await page.screenshot({ path: file });
    gray.push({ ...c, file });
  }

  // ---- compose the atlas
  const b64 = (p2) => 'data:image/png;base64,' + fs.readFileSync(p2).toString('base64');
  const rows = LEVELS.map((lv) => `
    <div class="label">${lv}</div>
    ${SPOTS.map((_, i) => `<img src="${b64(path.join(OUT, `${lv}-${i}.png`))}">`).join('')}`).join('');
  const grayRow = gray.map((g) => `<figure><img class="gs" src="${b64(g.file)}"><figcaption>${g.id}</figcaption></figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #0b0614; color: #e8e2f2; font: 13px "Segoe UI", system-ui, sans-serif; }
    #sheet { padding: 24px 28px; width: fit-content; }
    h1 { font-size: 21px; letter-spacing: .18em; color: #35e0e0; margin: 0 0 2px; }
    h2 { font-size: 15px; letter-spacing: .18em; color: #ffd166; margin: 22px 0 8px; }
    .sub { color: #8d83a3; font-size: 11.5px; letter-spacing: .1em; margin-bottom: 14px; }
    .grid { display: grid; grid-template-columns: 130px repeat(3, auto); gap: 8px 10px; align-items: center; }
    .label { color: #a98fff; font-weight: 700; letter-spacing: .05em; }
    img { display: block; width: 380px; border: 1px solid rgba(169,143,255,.28); border-radius: 6px; }
    .gs { filter: grayscale(1); width: 400px; }
    figure { display: inline-block; margin: 0 10px 0 0; }
    figcaption { color: #8d83a3; letter-spacing: .1em; margin-top: 4px; }
  </style><div id="sheet">
    <h1>Full-game room sweep</h1>
    <div class="sub">${new Date().toISOString().slice(0, 10)} · every zone x 3 framings · tools/room-sweep.js</div>
    <div class="grid">${rows}</div>
    <h2>GRAYSCALE READABILITY (art-bible squint rule)</h2>
    <div>${grayRow}</div>
  </div>`;
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.setContent(html);
  await page.waitForTimeout(400);
  await page.locator('#sheet').screenshot({ path: path.join(OUT, 'atlas.png') });
  console.log('atlas written:', path.join(OUT, 'atlas.png'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
