// District 5: Skyway Mile Zero.
// The hurricane's tail catches up at the city's edge. A triple-decker
// interchange crossed west to east in a storm:
//   toll yard -> the locks (flooded canal) -> gantry run (TAILWIND on the
//   radio mast) -> the skyway span, crossed on gust rivers -> MILE 0.
// Real-world anchors: Stiltsville shacks in the water, and an osprey
// who has lost a nest to storms before.

const G = 2400; // towpath level

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
  id: 'skyway-mile-zero',
  name: 'Skyway Mile Zero',
  district: 5,
  blurb: 'Ride the storm across the last highway.',
  completeHeading: 'MILE 0',
  sky: 'storm',
  weather: 'rain',
  ambient: 'rgb(150,152,190)',
  grade: { top: 'rgba(20,40,80,0.20)', bottom: 'rgba(90,170,190,0.10)' },
  ambience: null,
  bloom: 0.3,

  intro: [
    'The hurricane\'s tail found you at the city\'s edge. Rain like gravel, and below the causeway, the flooded canal: the same water that swallowed you under Brickell.',
    'On the radio mast, an osprey rides the weather like it was born in it.',
    '"Storms took my nest too," she calls. "<span class="accent">Ride what tries to push you back.</span>"',
    'Past the last toll arch lies MILE 0. After that, no more streets.',
  ],

  outro: [
    'The storm breaks against the MILE 0 arch and gives up.',
    'Behind you: the whole glowing grid of the city that caught you.',
    'Ahead: darkness with no neon in it at all. Sawgrass. Stars.',
    'The osprey wheels overhead once, and is gone. The last crossing is yours alone.',
  ],

  width: 8000,
  height: 2800,
  groundY: G,
  groundThickness: 400,
  groundSegments: [
    { x: 0, w: 1900 },
    { x: 2200, w: 300 },
    { x: 2800, w: 200 },
    { x: 3300, w: 4700 },
  ],
  spawn: { x: 500, y: 2370 },
  initialAbilities: ['flap', 'glide', 'swoop', 'break', 'launch', 'soar', 'roll', 'grip', 'hook', 'grind'],

  // mega-map doors on the towpath at both ends
  entries: {
    west: { x: 150, y: 2370 },
    east: { x: 7830, y: 2370 },
  },
  exits: [
    { x: 0, y: 2250, w: 70, h: 150, to: 'hall-toll', entry: 'east', label: 'CALLE OCHO', dir: -1 },
    { x: 7930, y: 2250, w: 70, h: 150, to: 'hall-causeway', entry: 'west', label: 'THE GLADES', dir: 1 },
  ],

  // the flooded canal pools: one splash and it takes you
  waters: [
    { x: 1900, y: 2436, w: 300, h: 364 },
    { x: 2500, y: 2436, w: 300, h: 364 },
    { x: 3000, y: 2436, w: 300, h: 364 },
  ],

  // Stiltsville shacks standing out in the flood
  landmarks: [
    { type: 'stilthouse', x: 2050, y: 2410, scale: 0.75 },
    { type: 'stilthouse', x: 3150, y: 2418, scale: 0.6 },
  ],

  buildings: [],

  extraSolids: [
    // roadway deck (lower): two long slabs with a drop between them
    { x: 600, y: 1800, w: 2300, h: 40, kind: 'concrete' },
    { x: 3600, y: 1800, w: 3000, h: 40, kind: 'concrete' },
    // toll gantry: roof and arm leave a 22px roll gap on the deck
    { x: 940, y: 1450, w: 240, h: 30, kind: 'steel' },
    { x: 1010, y: 1480, w: 130, h: 298, kind: 'steel' },
    // cracked lock bulkhead seals the underpass towpath
    { x: 2440, y: 1840, w: 70, h: 560, kind: 'brick', breakable: true },
    // barge riding the middle pool
    { x: 2540, y: 2340, w: 220, h: 60, kind: 'barge' },
    // skyway deck (upper): two spans across the sky; the east span
    // reaches back under the gust river's mouth to catch riders
    { x: 5600, y: 1150, w: 400, h: 40, kind: 'concrete' },
    { x: 6800, y: 1150, w: 500, h: 40, kind: 'concrete' },
    // MILE 0 arch platform
    { x: 7580, y: 1100, w: 220, h: 40, kind: 'concrete' },
  ],

  platforms: [
    // toll gantry rungs up from the spawn
    { x: 500, y: 2260, w: 58, type: 'rung' },
    { x: 430, y: 2120, w: 58, type: 'rung' },
    { x: 500, y: 1980, w: 58, type: 'rung' },
    { x: 430, y: 1860, w: 58, type: 'rung' },
    // gantry run billboards on the roadway deck
    { x: 3700, y: 1500, w: 150, type: 'billboard', text: 'KEY WEST 160', hue: 185 },
    { x: 4100, y: 1400, w: 150, type: 'billboard', text: 'CAFECITO', hue: 45 },
    { x: 4900, y: 1300, w: 150, type: 'billboard', text: 'LAST EXIT', hue: 320 },
    // radio mast ladder up to TAILWIND
    { x: 4470, y: 1660, w: 58, type: 'rung' },
    { x: 4540, y: 1520, w: 58, type: 'rung' },
    { x: 4470, y: 1380, w: 58, type: 'rung' },
    { x: 4540, y: 1240, w: 58, type: 'rung' },
    { x: 4470, y: 1100, w: 58, type: 'rung' },
    { x: 4540, y: 980, w: 58, type: 'rung' },
    { x: 4460, y: 920, w: 120, type: 'ledge' },
    // catch ledge on the far side of the gust river
    { x: 6820, y: 1260, w: 80, type: 'ledge' },
  ],

  // guardrails on the skyway spans: grind past the coils
  // guardrails start past the landing zones, so touching down off the
  // thermal or the gust river never snaps you into a moving grind
  rails: [
    { x1: 5700, y1: 1146, x2: 6000, y2: 1146, style: 'guard' },
    { x1: 7040, y1: 1146, x2: 7300, y2: 1146, style: 'guard' },
  ],

  // gust fields: chaos to untrained wings, highways with TAILWIND
  winds: [
    { x: 4650, y: 1180, w: 800, h: 240, dir: 1 },
    // the gust rivers fill the whole gap, deck to water: untrained wings
    // cannot glide anywhere inside them
    { x: 5900, y: 900, w: 900, h: 1450, dir: 1 },
    { x: 7300, y: 900, w: 280, h: 1450, dir: 1 },
  ],

  hooks: [
    // barge crane hook over the middle pool
    { x: 2650, y: 2120, top: 1880 },
  ],

  vents: [
    // truck exhaust thermal up to the skyway
    { x: 5450, w: 100, base: 1800, top: 1230, soarOnly: true },
    // recovery draft: from the towpath back up to the roadway deck
    { x: 6350, w: 90, base: 2400, top: 1730, soarOnly: true },
  ],

  hazards: [
    { x1: 4050, x2: 4180, y: 1780, sag: 8 },
  ],

  // lightning coils on the skyway: charge, then bite
  timedHazards: [
    { type: 'coil', x: 5810, y: 1030, w: 60, h: 120, period: 2.5, offset: 0 },
    { type: 'coil', x: 7170, y: 1030, w: 60, h: 120, period: 2.5, offset: 1.1 },
  ],

  pickups: [
    { x: 4530, y: 880, ability: 'wind' },
  ],

  checkpoints: [
    { x: 700, y: 1800 },
    { x: 3400, y: 2400 },
    { x: 4380, y: 1800 },
    { x: 5650, y: 1150 },
    { x: 6950, y: 1150 },
  ],

  goal: { x: 7690, y: 1100, text: 'MILE 0' },

  darkZones: [
    {
      x: 1500, y: 1840, w: 1400, h: 560,
      lights: [
        { x: 1700, y: 2100, r: 150 },
        { x: 2100, y: 2350, r: 130 },
        { x: 2440, y: 2050, r: 140 },
        { x: 2650, y: 2300, r: 150 },
        { x: 2870, y: 2200, r: 140 },
      ],
    },
  ],

  shinies: [
    // toll yard
    ...line(250, 2350, 380, 2),
    ...col(480, 2250, 1900, 4),
    ...line(700, 1750, 900, 3),
    [1075, 1790],
    ...line(1300, 1750, 2100, 4),
    // the locks below
    ...line(1600, 2350, 2050, 3),
    ...arc(1900, 2380, 2200, 2380, 3, 50),
    [2650, 2290], [2650, 2060],
    [2550, 2350],
    ...line(2830, 2350, 2980, 2),
    ...arc(3000, 2380, 3300, 2380, 3, 50),
    ...line(3400, 2350, 3560, 2),
    // gantry run and the mast
    [3775, 1460], [4175, 1360], [4975, 1260],
    ...col(4505, 1700, 1000, 5),
    [4470, 850], [4590, 850],
    ...diag(4700, 1300, 5400, 1260, 4),
    // thermal and the skyway
    ...col(5500, 1750, 1300, 3),
    ...line(5650, 1100, 5950, 3),
    ...diag(6050, 1260, 6780, 1200, 5),
    ...line(6950, 1100, 7250, 3),
    ...diag(7350, 1250, 7530, 1190, 2),
    ...arc(7600, 1050, 7780, 1050, 3, 40),
  ],

  decor: [
    // bridge piers
    { type: 'pylon', x: 800, y0: 1840, y1: 2400, w: 70 },
    { type: 'pylon', x: 1600, y0: 1840, y1: 2400, w: 70 },
    { type: 'pylon', x: 2340, y0: 1840, y1: 2400, w: 60 },
    { type: 'pylon', x: 3900, y0: 1840, y1: 2400, w: 70 },
    { type: 'pylon', x: 4700, y0: 1840, y1: 2400, w: 70 },
    { type: 'pylon', x: 6300, y0: 1840, y1: 2400, w: 70 },
    { type: 'pylon', x: 5700, y0: 1190, y1: 2400, w: 80 },
    { type: 'pylon', x: 7000, y0: 1190, y1: 2400, w: 80 },
    { type: 'archlegs', x: 7560, y0: 1140, w: 260 },
    // the crane over the barge pool
    { type: 'crane', x: 2950, y0: 2100, y1: 2400, reach: 90 },
    // the radio mast, and the osprey on it
    { type: 'radiomast', x: 4505, y0: 900, y1: 1800 },
    { type: 'osprey', x: 4560, y: 918, flip: 1 },
    // stalled traffic
    { type: 'truck', x: 5250, y: 1800, hue: 210 },
    { type: 'truck', x: 4230, y: 1800, hue: 275 },
    { type: 'car', x: 1500, y: 1800, hue: 190 },
    { type: 'car', x: 3950, y: 1800, hue: 320 },
    { type: 'lamp', x: 1400, y: 1800 },
    { type: 'lamp', x: 2400, y: 1800 },
    { type: 'lamp', x: 3800, y: 1800 },
    { type: 'lamp', x: 6100, y: 1800 },
  ],

  hints: [
    { x: 500, y: 2300, text: 'the storm caught up: climb the gantry' },
    { x: 1075, y: 1730, text: 'toll arms never rise for birds' },
    { x: 1800, y: 2320, text: 'flood water: one splash and it takes you' },
    { x: 4380, y: 1740, text: 'the osprey rides the mast' },
    { x: 4620, y: 1120, text: 'ride what tries to push you back' },
    { x: 5480, y: 1740, text: 'truck exhaust rises hot' },
    { x: 6050, y: 1100, text: 'the gust river howls east' },
    { x: 7100, y: 1090, text: 'coils charge, then bite: time your run' },
  ],
};
