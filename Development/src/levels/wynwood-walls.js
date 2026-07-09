// District 3: Wynwood Walls.
// A dawn hub-and-wings map through the gallery district:
//   gallery row (west wing)  -> ROLL       (tumble through low shutter gaps)
//   container alley (east)   -> PAINT GRIP (climb painted mural walls)
//   rooftops and crane yard  -> TALON HOOK (latch crane hooks, launch across)
// Built from the shared layout map: world 5800 x 2600, street at y 2200.

const G = 2200; // street level

function line(x0, y, x1, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y]);
  return pts;
}
function diag(x0, y0, x1, y1, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1);
    pts.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u]);
  }
  return pts;
}
function arc(x0, y0, x1, y1, n, lift) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1);
    pts.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - lift * 4 * u * (1 - u)]);
  }
  return pts;
}
function col(x, y0, y1, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([x, y0 + ((y1 - y0) * i) / Math.max(1, n - 1)]);
  return pts;
}

export default {
  id: 'wynwood-walls',
  name: 'Wynwood Walls',
  district: 3,
  blurb: 'Read the painted walls of the gallery district.',
  completeHeading: 'THE FLOCK',
  sky: 'dawn',
  ambient: 'rgb(238,226,232)',
  grade: { top: 'rgba(150,80,150,0.10)', bottom: 'rgba(255,180,100,0.12)' },
  ambience: 'petals',
  bloom: 0.28,

  intro: [
    'First light over the Magic City. You fly west, high and hopeful, until the wind sets you down in Wynwood: the painted district.',
    'Every wall here is a story. Gulls, herons, ibis: the artists paint the flocks that pass each year.',
    'Somewhere above these galleries is <span class="accent">THE FLOCK</span>: the mural that maps every flight home.',
    'Read the walls. Learn their tricks. Find your place in the picture.',
  ],

  outro: [
    'THE FLOCK covers the whole wall: a thousand painted birds streaming west, wingtip to wingtip.',
    'And there in the corner, wet and new: a small black bird with a bright eye.',
    'The muralist tips her cap. "Everglades is that way, friend. Follow the painted wings."',
    'One district left. Then home.',
  ],

  width: 5800,
  height: 2600,
  groundY: G,
  spawn: { x: 3000, y: 2170 },
  initialAbilities: ['flap', 'glide', 'swoop'],

  // the real WYNWOOD WALLS entrance gate anchors the hub courtyard
  landmarks: [
    { type: 'wynwoodgate', x: 2830, w: 340 },
  ],

  buildings: [
    { x: 800, w: 600, h: 1100, style: 'deco', hue: 275, sign: 'MUSEO' },    // top 1100, goal roof
    { x: 4700, w: 900, h: 900, style: 'block', hue: 15, sign: 'GALERIA', muralArt: true },  // top 1300, the great mural
  ],

  extraSolids: [
    // gallery row (warehouse A): steel shell with an open door on the hub side
    { x: 1400, y: 1750, w: 1200, h: 50, kind: 'steel' },                     // roof slab, walkable top
    { x: 1400, y: 1800, w: 40, h: 400, kind: 'steel' },                      // west wall
    { x: 2560, y: 1800, w: 40, h: 250, kind: 'steel' },                      // east wall, door open below
    { x: 1660, y: 1800, w: 40, h: 378, kind: 'shutter' },                    // inner shutter: 22px roll gap
    { x: 2440, y: 2090, w: 110, h: 110, kind: 'crate' },                     // first step to the shelves
    // workshop (warehouse B): roll under its west shutter, walk out the east door
    { x: 3400, y: 1700, w: 800, h: 60, kind: 'steel' },                      // roof slab, walkable top
    { x: 3400, y: 1760, w: 40, h: 418, kind: 'shutter' },                    // west shutter: 22px roll gap
    { x: 4160, y: 1760, w: 40, h: 290, kind: 'steel' },                      // east wall, door open below
    // crane jib over the hub (walkable catwalk; the mast is scenery so it
    // never blocks the street or the leap from the workshop roof)
    { x: 1900, y: 1230, w: 1800, h: 30, kind: 'steel' },
    // container stacks in the alley
    { x: 4260, y: 2060, w: 120, h: 140, kind: 'container', hue: 200 },
    { x: 4400, y: 1920, w: 120, h: 280, kind: 'container', hue: 330 },
    { x: 4540, y: 1780, w: 120, h: 420, kind: 'container', hue: 150 },
  ],

  platforms: [
    // gallery mezzanine shelves
    { x: 2280, y: 2050, w: 120, type: 'ledge' },
    { x: 2040, y: 1950, w: 120, type: 'ledge' },
    { x: 1790, y: 1870, w: 120, type: 'ledge' },
    // workshop workbench
    { x: 3700, y: 2100, w: 160, type: 'ledge' },
  ],

  // grippable painted walls: dir is the push direction (+1 = wall on the right)
  murals: [
    { x: 4700, y0: 1300, y1: 2200, dir: 1 },    // the great mural, GALERIA's west face
    { x: 1400, y0: 1100, y1: 1760, dir: -1 },   // MUSEO's east face, upper half only
  ],

  // crane hooks: latch and launch (top = chain anchor on the jib)
  hooks: [
    { x: 3250, y: 1600, top: 1260 },
    { x: 2990, y: 1590, top: 1260 },
    { x: 2730, y: 1580, top: 1260 },
    { x: 2470, y: 1580, top: 1260 },
    { x: 2210, y: 1580, top: 1260 },
  ],

  vents: [
    { x: 3900, w: 70, base: 1700, top: 1330 },   // workshop roof updraft, up toward the jib
  ],

  hazards: [
    { x1: 4230, x2: 4330, y: 2180, sag: 8 },     // downed line at the alley mouth
    { x1: 1480, x2: 1640, y: 2172, sag: 6 },     // crawl room: stay rolling
    { x1: 5000, x2: 5120, y: 1280, sag: 12 },    // GALERIA rooftop
  ],

  pickups: [
    { x: 1850, y: 1815, ability: 'roll' },
    { x: 4600, y: 1730, ability: 'grip' },
    { x: 3520, y: 1645, ability: 'hook' },
  ],

  checkpoints: [
    { x: 3000, y: 2200 },    // hub courtyard
    { x: 2250, y: 2200 },    // gallery floor
    { x: 4450, y: 2200 },    // alley
    { x: 3700, y: 1700 },    // workshop roof
    { x: 4850, y: 1300 },    // GALERIA roof
  ],

  goal: { x: 1080, y: 1100, text: 'THE FLOCK' },

  backdrops: [
    { x: 1440, y: 1800, w: 1120, h: 400, style: 'gallery' },
    { x: 3440, y: 1760, w: 720, h: 440, style: 'workshop' },
  ],

  shinies: [
    // hub courtyard
    ...line(2700, 2140, 3300, 4),
    // into the gallery
    [2495, 2030], [2340, 2000], [2100, 1900],
    ...line(1500, 1700, 2500, 5),
    // crawl room, under the live wire
    ...line(1490, 2186, 1630, 3),
    [1455, 2150],
    // workshop interior
    ...line(3500, 2140, 4100, 4),
    // alley and containers
    ...arc(4230, 2140, 4360, 2020, 3, 40),
    [4320, 2020], [4460, 1880],
    // the great mural climb
    ...col(4688, 2080, 1380, 6),
    // GALERIA roof
    ...line(4800, 1250, 5480, 5),
    // glide back west and the workshop roof
    ...diag(4650, 1360, 4280, 1640, 4),
    ...line(3500, 1650, 4100, 4),
    ...col(3935, 1620, 1420, 3),
    // jib catwalk (secret, via the vent)
    ...line(2050, 1185, 3550, 7),
    // the hook line
    ...line(2200, 1520, 3150, 5),
    // museo climb and crown
    ...col(1412, 1700, 1160, 4),
    ...arc(900, 1055, 1260, 1055, 5, 60),
    // museo street front
    ...line(300, 2140, 700, 3),
  ],

  decor: [
    { type: 'car', x: 300, hue: 320 },
    { type: 'palm', x: 520, h: 120, lean: 0.4 },
    { type: 'lamp', x: 660 },
    { type: 'palm', x: 2680, h: 125, lean: 0.5 },
    { type: 'lamp', x: 2770 },
    { type: 'car', x: 3100, hue: 275 },
    { type: 'mast', x: 3340, w: 60, y0: 1160 },
    { type: 'bigpipe', x: 3316, y: 2174, w: 108 },
    { type: 'palm', x: 3290, h: 110, lean: -0.5 },
    { type: 'lamp', x: 4480 },
    { type: 'palm', x: 5680, h: 120, lean: -0.4 },
  ],

  hints: [
    { x: 3000, y: 2090, text: 'wynwood: the painted district' },
    { x: 2450, y: 2040, text: 'the gallery is open: climb the shelves' },
    { x: 1750, y: 2120, text: 'a crawl space: far too low to walk' },
    { x: 3520, y: 2120, text: 'the workshop shutter is stuck half-open' },
    { x: 4450, y: 2050, text: 'stack by stack' },
    { x: 4780, y: 2090, text: 'painted walls remember talons' },
    { x: 3760, y: 1640, text: 'crane hooks hang over the courtyard' },
  ],
};
