// District 7: The Sleeping Port.
// The post-game epilogue: PortMiami at three in the morning, reached only
// through the Rookery's seventh flyway (the Magpie's priciest fragment) or
// by pressing on past THE NEST. Container yard, customs shed, gantry quay,
// and a cargo ship that never sailed - the Night Heron stalks its foredeck.

const G = 2200; // quay level

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
  id: 'the-sleeping-port',
  name: 'The Sleeping Port',
  district: 7,
  flyOnly: true, // no hallway touches it: the Rookery flyway is the only road
  blurb: 'The ships leave at 3am with everything the city ever lost.',
  completeHeading: 'THE LAST HORN',

  sky: 'night',
  horizon: 'city',
  ambient: 'rgb(148,150,190)',
  grade: { top: 'rgba(15,25,60,0.18)', bottom: 'rgba(90,140,200,0.08)' },
  bloom: 0.32,
  ambience: 'motes',

  intro: [
    'Home is warm. The nest is full. And still the wire hums a rumor south:',
    'the ships that leave PortMiami at three in the morning carry everything the city ever lost.',
    'The Magpie leans close over her maps. "One never left, dear. Bring me its <span class="accent">HORN</span>, and the flyways are yours forever."',
  ],

  outro: [
    'The horn sounds once, for no one, across the sleeping bay.',
    'Below you the cranes bow, the containers keep their secrets, and the Night Heron sulks off to fish.',
    'The Magpie will say she knew you could. The nest will say come home.',
    'You are rich in shinies and in sky. <span class="accent">BON VOYAGE.</span>',
  ],

  width: 7600,
  height: 2600,
  groundY: G,
  groundThickness: 130,
  // two quays; open harbor water everywhere else, all the way to the ship
  groundSegments: [
    { x: 0, w: 3600 },
    { x: 3900, w: 1500 },
  ],
  spawn: { x: 300, y: 2170 },
  initialAbilities: ['flap', 'glide', 'swoop', 'break', 'launch', 'soar', 'roll', 'grip', 'hook', 'grind', 'wind'],

  entries: {
    hub: { x: 170, y: 2170 },
  },
  exits: [
    // the seventh flyway, sunk into the gatehouse floor
    { x: 60, y: 2050, w: 60, h: 150, to: 'the-rookery', entry: 'the-sleeping-port', label: 'THE ROOKERY', linger: true, vdir: 1 },
  ],

  // the harbor takes what falls in it
  waters: [
    { x: 3600, y: 2236, w: 300, h: 364 },
    { x: 5400, y: 2236, w: 2200, h: 364 },
  ],

  // room 1's locals: wharf rats own the yard, gulls own the sky
  enemies: [
    { type: 'rat', x: 900, y: 2188, range: 140 },
    { type: 'rat', x: 1560, y: 2188, range: 100 },
    { type: 'gull', x: 2050, y: 1650, range: 260 },
    { type: 'gull', x: 4900, y: 1500, range: 240 },
    { type: 'crab', x: 4350, y: 2185, range: 120 },
  ],

  // room 2: the customs scanner wants its combo before the quay gate rolls
  puzzle: {
    switches: [
      { x: 2700, y: 2145, hue: 185 },
      { x: 2850, y: 2035, hue: 45 },
      { x: 3005, y: 2145, hue: 320 },
    ],
    order: [1, 0, 2],
    display: { x: 2852, y: 1900 },
    door: { x: 3160, y: 1780, w: 60, h: 420 },
  },

  // room 4: the Night Heron stalks the foredeck. Post-game crows already
  // fly; for fragment-bought early visitors, the heron teaches True Flight.
  boss: {
    type: 'heron',
    x: 6450,
    y: 1500,
    arena: { x0: 6150, x1: 6800, top: 1240, floor: 1990 },
    drops: 'flight',
  },

  // the customs house and the far city behind the quay
  buildings: [
    { x: 2560, w: 560, h: 420, style: 'block', hue: 200, sign: 'ADUANA' },
  ],
  landmarks: [
    { type: 'ship', x: 4300, w: 900 },
  ],

  extraSolids: [
    // the teased bosun's cache, high over the gatehouse: a sealed locker
    // you can only reach flying home off the ship
    { x: 340, y: 1200, w: 220, h: 22, kind: 'steel' },
    // container stair up the yard
    { x: 700, y: 2060, w: 120, h: 140, kind: 'container', hue: 200 },
    { x: 860, y: 1920, w: 120, h: 280, kind: 'container', hue: 330 },
    { x: 1020, y: 1780, w: 120, h: 420, kind: 'container', hue: 150 },
    { x: 1400, y: 2090, w: 110, h: 110, kind: 'crate' },
    // double stack mid-yard, live wire strung across its roofline
    { x: 1650, y: 1920, w: 120, h: 280, kind: 'container', hue: 45 },
    { x: 1790, y: 1920, w: 120, h: 280, kind: 'container', hue: 200 },
    { x: 2150, y: 2060, w: 120, h: 140, kind: 'container', hue: 320 },
    // yard boundary fence
    { x: 2400, y: 2050, w: 26, h: 150, kind: 'fence' },
    // the ship: hull riding the harbor, decks, and the bridge castle
    { x: 5700, y: 2100, w: 1760, h: 130, kind: 'barge' },
    { x: 5760, y: 1960, w: 460, h: 26, kind: 'steel' },      // aft deck
    { x: 5850, y: 1820, w: 120, h: 140, kind: 'container', hue: 150 },
    { x: 6100, y: 1990, w: 780, h: 26, kind: 'steel' },      // foredeck (arena floor)
    { x: 6960, y: 1500, w: 380, h: 600, kind: 'steel' },     // bridge castle
    { x: 7040, y: 1360, w: 220, h: 24, kind: 'steel' },      // castle roof walk
  ],

  platforms: [
    // gatehouse climb toward the cache tease
    { x: 240, y: 1900, w: 70, type: 'ledge' },
    { x: 420, y: 1620, w: 70, type: 'ledge' },
    // customs shed approach + the middle scanner pad
    { x: 2810, y: 2065, w: 90, type: 'ledge' },
    // quay side: catwalk rungs up to the crane beam
    { x: 3560, y: 1980, w: 58, type: 'rung' },
    { x: 3640, y: 1820, w: 58, type: 'rung' },
    { x: 3560, y: 1660, w: 58, type: 'rung' },
    { x: 3660, y: 1500, w: 58, type: 'rung' },
    // ship boarding: bollard hop at the quay's end
    { x: 5330, y: 2080, w: 70, type: 'ledge' },
    // bridge-castle ladder ledges
    { x: 6900, y: 1830, w: 64, type: 'fireescape' },
    { x: 6900, y: 1680, w: 64, type: 'fireescape' },
  ],

  // slack cable spans the first harbor gap; line launch springs it
  cables: [
    { x: 3560, y: 2050, w: 300 },
  ],

  // the gantry chain: hooks along the crane beam carry you over the water
  hooks: [
    { x: 3950, y: 1750, top: 1440 },
    { x: 4220, y: 1720, top: 1440 },
    { x: 4490, y: 1700, top: 1440 },
    { x: 4760, y: 1730, top: 1440 },
  ],

  // grind the crane beam, then the loading chute down toward the ship
  rails: [
    { x1: 3730, y1: 1450, x2: 4680, y2: 1450, style: 'guard' },
    { x1: 4900, y1: 1520, x2: 5360, y2: 1600 },
  ],

  // funnel updraft off the ship's boilers: soar it to the castle roof
  vents: [
    { x: 6880, w: 80, base: 1960, top: 1280, soarOnly: true },
  ],

  hazards: [
    // live wire strung across the double stack's roofline
    { x1: 1680, x2: 1860, y: 1892, sag: 8 },
  ],
  timedHazards: [
    // a shorting quay coil where the rails hand over
    { type: 'coil', x: 4990, y: 2040, w: 44, h: 160, period: 3, offset: 0.6 },
  ],

  pickups: [],

  checkpoints: [
    { x: 1900, y: 2200 },
    { x: 3350, y: 2200 },
    { x: 5150, y: 2200 },
    { x: 6050, y: 1960 },
  ],

  // the ship's horn atop the bridge castle
  goal: { x: 7150, y: 1360, text: 'BON VOYAGE' },

  shinies: [
    // yard floor and the container stair
    ...line(400, 2140, 660, 3),
    ...diag(760, 2010, 1080, 1740, 4),
    ...line(1180, 1720, 1560, 4),
    // live-wire stack roofline (hop the wire)
    [1700, 1840], [1840, 1840],
    ...line(1960, 2140, 2340, 4),
    // customs shed and scanner pads
    [2700, 2085], [2855, 1985], [3005, 2085],
    ...col(2860, 1840, 1660, 3),
    // cable spring over the first gap
    ...arc(3580, 2000, 3880, 2000, 4, 90),
    // catwalk rungs and the crane beam
    ...col(3600, 1940, 1520, 4),
    ...line(3780, 1410, 4640, 6),
    // the hook chain over the harbor
    ...diag(3960, 1680, 4770, 1660, 5),
    // rail handover and the chute down
    ...diag(4920, 1480, 5340, 1560, 4),
    // boarding and the aft deck
    ...line(5760, 1920, 6180, 4),
    // foredeck (the heron's ground)
    ...line(6220, 1940, 6740, 4),
    // funnel updraft column
    ...col(6920, 1880, 1400, 4),
    // castle roof and the bow horn
    ...arc(7060, 1310, 7300, 1310, 4, 50),
    // the bosun's cache, way back over the gatehouse
    ...line(370, 1160, 540, 4),
    ...arc(360, 1080, 550, 1080, 3, 40),
  ],

  decor: [
    { type: 'lamp', x: 500 },
    { type: 'lamp', x: 1980 },
    { type: 'lamp', x: 3280 },
    { type: 'truck', x: 2160, y: G, hue: 200 },
    { type: 'mast', x: 3700, w: 60, y0: 1400 },
    { type: 'mast', x: 4700, w: 60, y0: 1400 },
    { type: 'crane', x: 5480, y0: 1900, y1: 2200, reach: 110 },
    { type: 'bigpipe', x: 2560, y: 1850, w: 560 },
    { type: 'flock', x: 5600, y: 900, count: 7 },
  ],

  hints: [
    { x: 300, y: 2100, text: 'the port sleeps. the cranes do not' },
    { x: 170, y: 2000, text: 'the flyway home hums under the gatehouse' },
    { x: 480, y: 1560, text: 'a sealed cache glints over the gate: nothing walks up there' },
    { x: 1740, y: 1810, text: 'the stack is wired: hop it' },
    { x: 2850, y: 2100, text: 'customs wants its combo before the gate rolls' },
    { x: 3620, y: 2000, text: 'the cable springs, the rungs climb, the beam rides' },
    { x: 4350, y: 1620, text: 'chain the hooks: the harbor forgives nothing' },
    { x: 5900, y: 1900, text: 'something long-legged stalks the foredeck' },
    { x: 6900, y: 1900, text: 'the boilers still breathe: soar the funnel' },
  ],
};
