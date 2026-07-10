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
  // batch 03: the bestiary (enemies at spawn pose, bosses idle in their dens)
  { id: 'enemy-rat', level: 'brickell-ascent', player: [700, 3140], rect: [500, 3080, 220, 160] },
  { id: 'enemy-iguana', level: 'wynwood-walls', player: [2780, 2170], rect: [2580, 2080, 220, 160] },
  { id: 'enemy-imp', level: 'little-havana', player: [7300, 1970], rect: [7050, 1870, 220, 170] },
  { id: 'enemy-crab', level: 'skyway-mile-zero', player: [500, 2370], rect: [600, 2280, 220, 160] },
  { id: 'enemy-snake', level: 'river-of-grass', player: [650, 2470], rect: [750, 2370, 220, 170] },
  { id: 'boss-gullking', level: 'ocean-drive', player: [5150, 560], rect: [5020, 330, 320, 260] },
  { id: 'boss-ratking', level: 'brickell-ascent', player: [1950, 3140], rect: [1940, 3020, 330, 240] },
  { id: 'boss-iguanodon', level: 'wynwood-walls', player: [3750, 1660], rect: [3740, 1520, 330, 240] },
  { id: 'boss-pinatabull', level: 'little-havana', player: [3850, 1950], rect: [3840, 1810, 330, 240] },
  { id: 'boss-kingcrab', level: 'skyway-mile-zero', player: [3850, 2360], rect: [3840, 2210, 330, 240] },
  { id: 'boss-snapper', level: 'river-of-grass', player: [5150, 2450], rect: [5140, 2310, 330, 240] },
  // batch 04: district props
  { id: 'prop-rooster', level: 'hall-underpass', player: [1200, 660], rect: [1120, 540, 260, 190] },
  { id: 'prop-pergola', level: 'little-havana', player: [3960, 1960], rect: [3760, 1800, 420, 230] },
  { id: 'prop-truck-pylon', level: 'hall-toll', player: [900, 660], rect: [580, 440, 680, 290] },
  { id: 'prop-boardwalk-reeds', level: 'hall-causeway', player: [420, 660], rect: [180, 480, 560, 250] },
  { id: 'prop-bigpipe', level: 'hall-drain', player: [700, 660], rect: [520, 320, 460, 220] },
  { id: 'prop-crane-mast', level: 'hall-glideway', player: [280, 620], rect: [140, 380, 340, 340] },
  { id: 'prop-radiomast-osprey', level: 'skyway-mile-zero', player: [4505, 1400], rect: [4360, 860, 320, 340] },
  { id: 'prop-archlegs', level: 'skyway-mile-zero', player: [7560, 1500], rect: [7460, 1120, 420, 320] },
  // batch 05: structural tiles + interiors
  { id: 'tile-steel', level: 'ocean-drive', player: [350, 620], rect: [150, 460, 420, 290] },
  { id: 'tile-shutter-crate', level: 'wynwood-walls', player: [2350, 2100], rect: [2240, 1960, 400, 240] },
  { id: 'tile-container', level: 'wynwood-walls', player: [4450, 2000], rect: [4220, 1740, 420, 320] },
  { id: 'tile-cart', level: 'little-havana', player: [6250, 1960], rect: [6040, 1760, 360, 260] },
  { id: 'tile-barge', level: 'skyway-mile-zero', player: [2650, 2250], rect: [2480, 2240, 360, 200] },
  { id: 'tile-trunk-canopy', level: 'river-of-grass', player: [6300, 1900], rect: [6140, 1480, 400, 320] },
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
