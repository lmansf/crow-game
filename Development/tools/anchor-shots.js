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
const ONLY = process.argv[4] ? process.argv[4].split(',') : null; // id filter
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!OUT) {
  console.error('usage: node tools/anchor-shots.js <outDir> [serverUrl] [id,id,...]');
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
  // batch 02: Ocean Drive playfield furniture
  { id: 'plat-awnings', level: 'ocean-drive', player: [600, 1350], rect: [500, 1150, 260, 280] },
  { id: 'plat-billboard', level: 'ocean-drive', player: [1900, 800], rect: [1760, 560, 340, 260] },
  { id: 'plat-fireescape', level: 'ocean-drive', player: [2230, 1100], rect: [2120, 900, 200, 300] },
  { id: 'plat-ac', level: 'ocean-drive', player: [1560, 1000], rect: [1480, 800, 220, 180] },
  { id: 'prop-hut', level: 'ocean-drive', player: [300, 1470], rect: [80, 1290, 240, 220] },
  { id: 'prop-lamp', level: 'the-rookery', player: [470, 660], rect: [380, 480, 260, 240] },
  { id: 'prop-cable', level: 'hall-glideway', player: [500, 620], rect: [360, 480, 300, 200] },
  { id: 'vent-grill', level: 'ocean-drive', player: [3600, 740], rect: [3460, 560, 260, 240] },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(URL);
  await page.waitForTimeout(600);

  for (const a of ANCHORS) {
    if (ONLY && !ONLY.includes(a.id)) continue;
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
