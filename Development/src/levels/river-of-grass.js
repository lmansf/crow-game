// District 6: River of Grass.
// Past Mile 0 there are no streets: hummock islands in dark water,
// crossed west to east as night gives way to dawn.
//   mangrove maw (roots, gators, the moss trunk)
//   -> sawgrass sea (lily pads, thermals, the Shark Valley tower,
//      the guy-wire down into the flock thermal: TRUE FLIGHT)
//   -> the rookery (cypress flight gates) -> THE NEST. Home.
// Real-world anchor: the Shark Valley observation tower and its
// spiral ramp, deep in Everglades National Park.

const G = 2500; // waterline banks

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
  id: 'river-of-grass',
  name: 'River of Grass',
  district: 6,
  blurb: 'Fly the last miles home as night turns to dawn.',
  completeHeading: 'THE NEST',
  sky: 'night',
  skyMix: { from: 'night', to: 'dawn', x0: 600, x1: 7600 },
  horizon: 'glades',
  groundStyle: 'marsh',
  ambient: 'rgb(140,165,160)',
  grade: { top: 'rgba(10,45,40,0.18)', bottom: 'rgba(120,200,120,0.09)' },
  ambience: 'fireflies',
  bloom: 0.32,

  intro: [
    'Past Mile 0 the world goes quiet. No streets. No signs. No neon.',
    'Only the river of grass, breathing in the dark, exactly as you saw it from EL FARO\'s crown.',
    'Somewhere out there, past the gators and the cypress gates, is a nest in a tall tree.',
    'The sky is already turning. <span class="accent">Fly the last miles home.</span>',
  ],

  outro: [
    'THE NEST. The old cypress. The family, all of them, shouting your name at once.',
    'Three songbirds you freed from festival cages spiral down through the dawn to roost in the branches.',
    'A pelican and an osprey pass high overhead, west to east, like they are escorting the sun in.',
    'The hurricane took you. It could not keep you. Home.',
  ],

  width: 8400,
  height: 3000,
  groundY: G,
  groundThickness: 500,
  groundSegments: [
    { x: 300, w: 700 },
    { x: 1300, w: 800 },
    { x: 2400, w: 1000 },
    { x: 3900, w: 700 },
    { x: 5000, w: 600 },
    { x: 6100, w: 600 },
    { x: 7200, w: 1200 },
  ],
  spawn: { x: 450, y: 2470 },
  initialAbilities: ['flap', 'glide', 'swoop', 'break', 'launch', 'soar', 'roll', 'grip', 'hook', 'grind', 'wind'],

  // open water everywhere the hummocks are not
  waters: [
    { x: 0, y: 2510, w: 300, h: 490 },
    { x: 1000, y: 2510, w: 300, h: 490 },
    { x: 2100, y: 2510, w: 300, h: 490 },
    { x: 3400, y: 2510, w: 500, h: 490 },
    { x: 4600, y: 2510, w: 400, h: 490 },
    { x: 5600, y: 2510, w: 500, h: 490 },
    { x: 6700, y: 2510, w: 500, h: 490 },
  ],

  // the Shark Valley observation tower, out in the open water
  landmarks: [
    { type: 'sharktower', x: 4800, y0: 1000, y1: 2510 },
  ],

  buildings: [],

  extraSolids: [
    // mangrove root tunnels: 22px roll gaps
    { x: 660, y: 2100, w: 120, h: 378, kind: 'root' },
    { x: 2560, y: 2100, w: 120, h: 378, kind: 'root' },
    // the great moss trunk, climbable on its painted-by-nature west face
    { x: 1660, y: 1100, w: 90, h: 1400, kind: 'trunk' },
    { x: 1660, y: 1090, w: 300, h: 40, kind: 'canopy' },
    // the tower's observation deck
    { x: 4700, y: 1040, w: 200, h: 30, kind: 'concrete' },
    // cypress flight gate one (opening 1200-1700)
    { x: 6260, y: 1700, w: 80, h: 800, kind: 'trunk' },
    { x: 6260, y: 400, w: 80, h: 800, kind: 'trunk' },
    { x: 6260, y: 1660, w: 180, h: 40, kind: 'canopy' },
    // cypress flight gate two (opening 950-1250)
    { x: 6960, y: 1250, w: 80, h: 1260, kind: 'trunk' },
    { x: 6960, y: 250, w: 80, h: 700, kind: 'trunk' },
    { x: 6960, y: 1210, w: 180, h: 40, kind: 'canopy' },
    // the Home Tree and the nest bough
    { x: 7760, y: 750, w: 90, h: 1750, kind: 'trunk' },
    { x: 7690, y: 750, w: 230, h: 36, kind: 'canopy' },
  ],

  platforms: [
    // ramp ledges winding up the ranger tower (200px hops: jump+flap)
    { x: 4640, y: 2280, w: 90, type: 'ledge' },
    { x: 4880, y: 2080, w: 90, type: 'ledge' },
    { x: 4640, y: 1880, w: 90, type: 'ledge' },
    { x: 4880, y: 1680, w: 90, type: 'ledge' },
    { x: 4640, y: 1480, w: 90, type: 'ledge' },
    { x: 4880, y: 1280, w: 90, type: 'ledge' },
  ],

  // lily pads across the wide crossing: they sink underfoot
  pads: [
    { x: 3450, y: 2470, w: 84 },
    { x: 3620, y: 2450, w: 84 },
    { x: 3760, y: 2470, w: 84 },
  ],

  // the guy-wire from the tower deck down into the flock thermal
  rails: [
    { x1: 4900, y1: 1100, x2: 5560, y2: 1460, style: 'guy' },
  ],

  murals: [
    // moss stripe up the great trunk, ending exactly at the canopy top
    // so the lip-vault clears onto it
    { x: 1660, y0: 1090, y1: 2440, dir: 1, style: 'moss' },
  ],

  vents: [
    { x: 3000, w: 90, base: 2500, top: 1900, soarOnly: true },
    { x: 4200, w: 90, base: 2500, top: 1750, soarOnly: true },
    // the flock thermal (TRUE FLIGHT waits inside it)
    { x: 5450, w: 100, base: 2500, top: 1200, soarOnly: true },
    // dawn thermal up to the nest
    { x: 7500, w: 110, base: 2500, top: 800, soarOnly: true },
  ],

  hazards: [
    // thorn vines seal the low route under the second gate
    { x1: 6720, x2: 7180, y: 2330, sag: 6, thorn: true },
  ],

  // gator jaws lurk in the narrow crossings: safe while they gape
  timedHazards: [
    { type: 'jaws', x: 1060, y: 2380, w: 180, h: 120, period: 2, offset: 0 },
    { type: 'jaws', x: 2160, y: 2380, w: 180, h: 120, period: 2, offset: 0.7 },
  ],

  pickups: [
    { x: 5480, y: 1408, ability: 'flight' },
  ],

  checkpoints: [
    { x: 1900, y: 2500 },
    { x: 3980, y: 2500 },
    { x: 4770, y: 1040 },
    { x: 5300, y: 2500 },
    { x: 6330, y: 1660 },
    { x: 7030, y: 1210 },
  ],

  goal: { x: 7830, y: 750, text: 'THE NEST' },

  darkZones: [
    {
      x: 1300, y: 1700, w: 800, h: 800,
      lights: [
        { x: 1450, y: 2300, r: 150 },
        { x: 1900, y: 2450, r: 160 },
        { x: 1700, y: 1900, r: 130 },
      ],
    },
  ],

  shinies: [
    // mangrove maw
    ...line(400, 2450, 900, 4),
    [715, 2488],
    ...arc(1000, 2450, 1300, 2450, 3, 60),
    ...line(1350, 2450, 1580, 2),
    ...col(1648, 2350, 1150, 5),
    [1760, 1020], [1880, 1020],
    ...arc(2100, 2450, 2400, 2450, 3, 60),
    // sawgrass sea
    ...line(2500, 2450, 3300, 5),
    ...col(3045, 2400, 1950, 3),
    ...diag(3450, 2430, 3800, 2410, 3),
    ...line(3950, 2450, 4500, 3),
    ...col(4245, 2400, 1800, 3),
    ...diag(4660, 2240, 4900, 1240, 6),
    [4760, 1000], [4840, 1000],
    ...diag(4950, 1090, 5540, 1420, 5),
    ...col(5500, 2300, 1500, 4),
    ...line(5050, 2450, 5500, 3),
    // the rookery
    ...line(6100, 2450, 6240, 2),
    [6300, 1450], [6300, 1330], [6300, 1230],
    ...diag(6450, 1350, 6900, 1150, 4),
    [7000, 1200], [7000, 1080],
    ...diag(7150, 1150, 7450, 1000, 3),
    ...col(7550, 2300, 900, 4),
    ...arc(7700, 700, 7950, 700, 3, 40),
  ],

  decor: [
    { type: 'reed', x: 380, y: 2500 },
    { type: 'reed', x: 950, y: 2500 },
    { type: 'reed', x: 1350, y: 2500 },
    { type: 'reed', x: 2080, y: 2500 },
    { type: 'reed', x: 2450, y: 2500 },
    { type: 'reed', x: 3350, y: 2500 },
    { type: 'reed', x: 3940, y: 2500 },
    { type: 'reed', x: 4560, y: 2500 },
    { type: 'reed', x: 5060, y: 2500 },
    { type: 'reed', x: 5560, y: 2500 },
    { type: 'reed', x: 6140, y: 2500 },
    { type: 'reed', x: 6660, y: 2500 },
    { type: 'reed', x: 7250, y: 2500 },
    { type: 'reed', x: 8200, y: 2500 },
    { type: 'boardwalk', x: 2800, w: 300 },
    { type: 'boardwalk', x: 7280, w: 260 },
    { type: 'flock', x: 5500, y: 1550, count: 10 },
    { type: 'flock', x: 7900, y: 620, count: 6 },
  ],

  hints: [
    { x: 460, y: 2400, text: 'no streets now. only the river of grass' },
    { x: 720, y: 2420, text: 'roots grow low: tumble through' },
    { x: 1150, y: 2350, text: 'jaws in the water: cross while they gape' },
    { x: 1620, y: 2400, text: 'moss holds talons like paint once did' },
    { x: 3620, y: 2380, text: 'lily pads sink: keep moving' },
    { x: 4700, y: 2420, text: 'the old ranger tower still stands' },
    { x: 4940, y: 1060, text: 'a guy-wire runs east: ride it down' },
    { x: 5500, y: 2380, text: 'THE FLOCK rides the warm air' },
    { x: 6180, y: 2420, text: 'the cypress gates open only to true wings' },
    { x: 7080, y: 1160, text: 'rest here. the nest is close' },
  ],
};
