// Anchor framing capture for the art-rework pipeline.
// Boots the game headless (?debug=1), stages each anchor (level, player
// position, frozen world), and saves a fixed world-rect crop per anchor.
// Run it before and after an art pass; feed both sets to
// tools/make-contact-sheet.js for the review sheet.
//
//   node tools/anchor-shots.js <outDir> [serverUrl]
//
// Requires a running dev server (tools/serve.py) and playwright-core with
// a chromium executable (CHROMIUM env var overrides the default path).

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const OUT = process.argv[2];
const URL = process.argv[3] || 'http://localhost:8123/index.html?debug=1&gfx=high';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!OUT) {
  console.error('usage: node tools/anchor-shots.js <outDir> [serverUrl]');
  process.exit(2);
}

// Each anchor: the level to load, where the crow stands, and the world-space
// rect to crop. Rects are fixed so before/after shots align pixel-for-pixel.
const ANCHORS = [
  { id: 'player-idle', level: 'ocean-drive', player: [300, 1470], rect: [210, 1370, 180, 150] },
  { id: 'enemy-gull', level: 'ocean-drive', player: [760, 1100], rect: [770, 920, 220, 180] },
  { id: 'prop-palm', level: 'ocean-drive', player: [300, 1470], rect: [20, 1300, 220, 210] },
  { id: 'tile-building', level: 'ocean-drive', player: [850, 1250], rect: [620, 1090, 470, 350] },
  { id: 'tile-brick', level: 'brickell-ascent', player: [500, 3140], rect: [330, 3010, 460, 200] },
  { id: 'bg-slice', level: 'ocean-drive', player: [2500, 1120], rect: [2200, 780, 620, 340] },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(URL);
  await page.waitForTimeout(600);

  for (const a of ANCHORS) {
    await page.evaluate(({ level, player }) => {
      const cg = window.__cg;
      cg.game.launchLevel(level);
      cg.player.x = player[0];
      cg.player.y = player[1];
      cg.player.vx = cg.player.vy = 0;
      cg.camera.snapTo(cg.player.x, cg.player.y, cg.level);
      cg.game.freeze = 99999; // hold the world; rendering continues
    }, a);
    await page.waitForTimeout(350); // let neon/glow settle a couple frames
    const clip = await page.evaluate(({ rect }) => {
      const cam = window.__cg.camera;
      return {
        x: (rect[0] - cam.x) * cam.scale,
        y: (rect[1] - cam.y) * cam.scale,
        width: rect[2] * cam.scale,
        height: rect[3] * cam.scale,
      };
    }, a);
    if (clip.x < 0 || clip.y < 0 || clip.x + clip.width > 1600 || clip.y + clip.height > 900) {
      console.warn(`${a.id}: crop leaves the viewport, clamping`, clip);
      clip.x = Math.max(0, clip.x);
      clip.y = Math.max(0, clip.y);
      clip.width = Math.min(clip.width, 1600 - clip.x);
      clip.height = Math.min(clip.height, 900 - clip.y);
    }
    const file = path.join(OUT, `${a.id}.png`);
    await page.screenshot({ path: file, clip });
    console.log('captured', file);
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
