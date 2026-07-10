// District 4: Little Havana Nights.
// Night falls mid-festival on Calle Ocho, travelled east to west:
//   paseo -> mercado (WIRE GRIND waits on the market arch)
//   -> Plaza de Domino, sealed by crowd fences, crossed on the light lines
//   -> the Tower Theater flytower -> EL GALLO DE ORO on the roof.
// Real-world anchors: the Tower Theater fin, Domino Park's pergola,
// and the painted roosters of Calle Ocho.

const G = 2000; // street level

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
  id: 'little-havana',
  name: 'Little Havana Nights',
  district: 4,
  blurb: 'Ride the light lines through the midnight festival.',
  completeHeading: 'EL GALLO DE ORO',
  sky: 'night',
  ambient: 'rgb(150,140,192)',
  grade: { top: 'rgba(20,8,50,0.20)', bottom: 'rgba(255,140,60,0.10)' },
  ambience: 'sparks',
  bloom: 0.4,
  weather: null,

  intro: [
    'Night falls mid-festival on Calle Ocho. Drums, lanterns, ten thousand voices: the painted wings you followed point straight through the party.',
    'Every rooftop bird knows the story: <span class="accent">EL GALLO DE ORO</span>, the golden rooster above the old theater, crows only at midnight.',
    'And the rooster knows where the city ends.',
    'Ride the light lines west. Midnight is close.',
  ],

  outro: [
    'Midnight. EL GALLO DE ORO throws back its golden head and crows over the whole festival.',
    '"The city ends where the river of cars begins, little crow."',
    '"Ride what tries to push you back, and follow it west."',
    'Below the marquee, the drums play on. One long crossing left.',
  ],

  width: 7600,
  height: 2400,
  groundY: G,
  spawn: { x: 7350, y: 1970 },
  initialAbilities: ['flap', 'glide', 'swoop', 'break', 'launch', 'soar', 'roll', 'grip', 'hook'],

  // mega-map doors: the underpass east of the paseo, the toll ramp
  // west past the theater lobby
  entries: {
    east: { x: 7310, y: 1970 },
    west: { x: 640, y: 1970 },
    hub: { x: 7330, y: 1970 },
  },
  exits: [
    { x: 7368, y: 1850, w: 50, h: 150, to: 'hall-underpass', entry: 'east', label: 'WYNWOOD', dir: 1 },
    { x: 505, y: 1850, w: 70, h: 150, to: 'hall-toll', entry: 'west', label: 'THE SKYWAY', dir: -1 },
    // the Rookery flyway, tucked between the sparkler and the paseo's end
    { x: 7205, y: 1850, w: 56, h: 150, to: 'the-rookery', entry: 'little-havana', label: 'THE ROOKERY', linger: true, vdir: 1 },
  ],

  // inert junk only the ray gun can lift
  curios: [
    { x: 4470, y: 1885, type: 'maraca' },
    { x: 5600, y: 1385, type: 'cafecito' },
  ],

  // room 1's locals: escaped pinata imps trot the paseo
  enemies: [
    { type: 'imp', x: 7150, y: 1985, range: 130 },
    { type: 'imp', x: 6500, y: 1985, range: 110 },
  ],

  // room 2: hall B's conga combo bars its west door
  puzzle: {
    switches: [
      { x: 5350, y: 1960, hue: 8 },
      { x: 5480, y: 1840, hue: 185 },
      { x: 5780, y: 1750, hue: 45 },
    ],
    order: [2, 0, 1],
    display: { x: 5290, y: 1620 },
    door: { x: 5200, y: 1830, w: 50, h: 170 },
  },

  // room 3: PINATA TORO has the plaza pit and the Wire Grind
  boss: {
    type: 'pinatabull',
    pattern: 'charge',
    x: 4000,
    y: 1962,
    arena: { x0: 3700, x1: 5100, top: 1400, floor: 2000 },
    drops: 'grind',
  },

  buildings: [
    { x: 7420, w: 180, h: 240, style: 'block', hue: 8, sign: 'AREPAS' },
    { x: 150, w: 350, h: 420, style: 'block', hue: 150, sign: 'CUBAOCHO' },
  ],

  extraSolids: [
    // mercado hall A (east): roof slab, east wall, west wall with open door
    { x: 6200, y: 1450, w: 800, h: 50, kind: 'steel' },
    { x: 6950, y: 1500, w: 50, h: 500, kind: 'steel' },
    { x: 6200, y: 1500, w: 50, h: 330, kind: 'steel' },
    // mercado hall B (west): roof slab, both walls with open doors
    { x: 5200, y: 1400, w: 900, h: 50, kind: 'steel' },
    { x: 5200, y: 1450, w: 50, h: 380, kind: 'steel' },
    { x: 6050, y: 1450, w: 50, h: 380, kind: 'steel' },
    // stalled cart between the halls: 22px roll gap beneath
    { x: 6106, y: 1832, w: 88, h: 146, kind: 'cart' },
    // market arch over the plaza gate (walkable top; GRIND waits here)
    { x: 5060, y: 1300, w: 200, h: 34, kind: 'steel' },
    // crowd fences seal the plaza street on both sides; the west side
    // is stage scaffolding with one slot only a light-line hop threads
    { x: 5140, y: 1580, w: 26, h: 420, kind: 'fence' },
    { x: 3640, y: 600, w: 26, h: 860, kind: 'steel' },
    { x: 3640, y: 1560, w: 26, h: 440, kind: 'fence' },
    // festival stage in the plaza
    { x: 4300, y: 1900, w: 300, h: 100, kind: 'steel' },
    // marquee ledge outside the flytower
    { x: 2400, y: 1420, w: 170, h: 26, kind: 'steel' },
    // Tower Theater: solid front of house (fin and marquee drawn on it);
    // the art reaches the street but the lobby doors are a walkway
    { x: 1200, y: 1100, w: 540, h: 810, artH: 900, kind: 'theaterfacade' },
    // flytower roof slabs, with the exit gap between them
    { x: 1740, y: 1100, w: 200, h: 60, kind: 'steel' },
    { x: 2200, y: 1100, w: 200, h: 60, kind: 'steel' },
    // flytower east wall with the stage door open below
    { x: 2340, y: 1160, w: 60, h: 640, kind: 'steel' },
    // the azotea garden: a rooftop patio floating over the paseo,
    // reached only by riding the return light lines home
    { x: 7100, y: 1160, w: 300, h: 26, kind: 'steel' },
  ],

  platforms: [
    // congas on the stage: land to bounce sky-high
    { x: 4360, y: 1868, w: 56, type: 'drum', bounce: 1060 },
    { x: 4480, y: 1868, w: 56, type: 'drum', bounce: 1060 },
    // mercado interior stalls
    { x: 5420, y: 1880, w: 120, type: 'ledge' },
    { x: 5720, y: 1790, w: 120, type: 'ledge' },
    { x: 6500, y: 1880, w: 120, type: 'ledge' },
    // flytower catwalk (a caged songbird waits here)
    { x: 1840, y: 1450, w: 120, type: 'ledge' },
  ],

  // festival light lines: intangible until WIRE GRIND
  rails: [
    { x1: 5150, y1: 1350, x2: 4720, y2: 1440 },
    { x1: 4640, y1: 1420, x2: 4160, y2: 1500 },
    { x1: 4080, y1: 1480, x2: 3720, y2: 1560 },
    { x1: 3560, y1: 1560, x2: 3100, y2: 1640 },
    { x1: 3020, y1: 1620, x2: 2620, y2: 1700 },
    // the return line home: hop off the arch's east side to catch it,
    // ride high over the mercado roofs to the azotea garden
    { x1: 5300, y1: 1150, x2: 6100, y2: 1230 },
    { x1: 6200, y1: 1100, x2: 7000, y2: 1180 },
  ],

  // pinatas hang from the party lines: latch and launch
  hooks: [
    { x: 7250, y: 1700, top: 1500, pinata: true },
    { x: 7050, y: 1550, top: 1330, pinata: true },
    // flytower zigzag: alternate launches climb the dark
    { x: 1950, y: 1750, top: 1160, pinata: true },
    { x: 2210, y: 1610, top: 1160, pinata: true },
    { x: 1950, y: 1470, top: 1160, pinata: true },
    { x: 2260, y: 1330, top: 1160, pinata: true },
  ],

  cables: [
    // a slack line above the paseo springs to a starlit stash
    { x: 7150, y: 1600, w: 220 },
    // the flytower's rigging line: the last spring out the roof gap
    { x: 1940, y: 1312, w: 200 },
  ],

  murals: [
    // painted hall wall: grip shortcut up to the mercado roof
    { x: 7000, y0: 1450, y1: 2000, dir: -1 },
  ],

  vents: [],

  hazards: [
    // downed wire guarding the caged songbird in hall A
    { x1: 6560, x2: 6700, y: 1978, sag: 6 },
  ],

  // sparkler fountains erupt on a cycle: cross between blooms
  timedHazards: [
    { type: 'sparkler', x: 7150, y: 1830, w: 44, h: 170, period: 3, offset: 0 },
    { type: 'sparkler', x: 5560, y: 1830, w: 44, h: 170, period: 3, offset: 1.2 },
    { type: 'sparkler', x: 2900, y: 1840, w: 44, h: 160, period: 3.2, offset: 0.4 },
  ],

  // three caged songbirds hidden across the festival
  cages: [
    { x: 6740, y: 1950 },
    { x: 4570, y: 1860 },
    { x: 1890, y: 1410 },
  ],

  pickups: [
    // grind now falls from PINATA TORO
  ],

  checkpoints: [
    { x: 7280, y: 2000 },
    { x: 5650, y: 1400 },
    { x: 4450, y: 1900 },
    { x: 2700, y: 2000 },
    { x: 2450, y: 2000 },
  ],

  goal: { x: 1550, y: 1100, text: 'EL GALLO' },

  backdrops: [
    { x: 6250, y: 1500, w: 700, h: 500, style: 'workshop' },
    { x: 5250, y: 1450, w: 800, h: 550, style: 'gallery' },
    { x: 1740, y: 1160, w: 660, h: 840, style: 'theater' },
  ],

  darkZones: [
    {
      x: 1740, y: 1160, w: 660, h: 840,
      lights: [
        { x: 1950, y: 1750, r: 140 },
        { x: 2210, y: 1610, r: 130 },
        { x: 1950, y: 1470, r: 130 },
        { x: 2260, y: 1330, r: 130 },
        { x: 2030, y: 1290, r: 130 },
        { x: 2370, y: 1900, r: 150 },
        { x: 1890, y: 1430, r: 120 },
        { x: 2070, y: 1150, r: 130 },
      ],
    },
  ],

  shinies: [
    // paseo
    ...line(6900, 2140 - 200, 7300, 4),
    [7180, 1560], [7290, 1560],
    ...arc(7180, 1250, 7330, 1250, 3, 40),
    // pinata chain into the mercado
    [7250, 1620], [7050, 1470],
    ...line(6300, 1400, 6900, 4),
    // hall A interior, past the wire
    ...line(6350, 2140 - 200, 6520, 3),
    [6740, 1900],
    // hall B roof and interior
    ...line(5300, 1350, 5950, 4),
    ...line(5350, 1940 - 110, 5800, 3),
    // the arch and pickup
    ...col(5160, 1290 - 110, 1160, 2),
    // the light lines (hop-trail west)
    ...diag(5140, 1330, 4730, 1420, 4),
    ...diag(4630, 1400, 4170, 1480, 4),
    ...diag(4070, 1460, 3730, 1540, 3),
    [3640, 1510],
    ...diag(3550, 1540, 3110, 1620, 4),
    ...diag(3010, 1600, 2630, 1680, 3),
    // stage and drums
    ...arc(4340, 1840, 4560, 1840, 3, 60),
    [4420, 1620], [4470, 1500],
    // street to the stage door
    ...line(2500, 2140 - 200, 3400, 4),
    // flytower climb
    ...col(2120, 1900, 1250, 5),
    [1890, 1380],
    // theater roof finale
    ...arc(1300, 1050, 1700, 1050, 4, 50),
    // the return line home
    ...diag(5350, 1120, 6050, 1200, 3),
    ...diag(6250, 1070, 6950, 1150, 3),
    // the azotea garden
    ...line(7140, 1120, 7360, 4),
    ...arc(7150, 1060, 7350, 1060, 3, 40),
  ],

  decor: [
    // azotea garden dressing
    { type: 'lantern', x: 7110, y: 1100, w: 280 },
    { type: 'palm', x: 7180, y: 1160, h: 70, lean: 0.3 },
    { type: 'rooster', x: 7330, y: 1160 },
    { type: 'lantern', x: 7040, y: 1740, w: 360 },
    { type: 'lantern', x: 6250, y: 1290, w: 700 },
    { type: 'lantern', x: 5260, y: 1240, w: 780 },
    { type: 'lantern', x: 4150, y: 1660, w: 560 },
    { type: 'rooster', x: 7395 },
    { type: 'rooster', x: 4800 },
    { type: 'rooster', x: 700 },
    { type: 'pergola', x: 3800, w: 330 },
    { type: 'palm', x: 7080, h: 120, lean: 0.4 },
    { type: 'car', x: 3050, hue: 8 },
    { type: 'lamp', x: 2850 },
    { type: 'palm', x: 3350, h: 115, lean: -0.5 },
    { type: 'lamp', x: 5000 },
    { type: 'palm', x: 550, h: 125, lean: 0.5 },
    { type: 'car', x: 850, hue: 45 },
    { type: 'lamp', x: 1000 },
  ],

  hints: [
    { x: 7300, y: 1900, text: 'the festival never sleeps' },
    { x: 7220, y: 1830, text: 'a garden waits above the party: the light lines run home' },
    { x: 6600, y: 1770, text: 'loose pinatas bite. swoop them into candy' },
    { x: 7150, y: 1760, text: 'sparklers bite when they bloom' },
    { x: 5500, y: 1920, text: 'the conga board keeps the combo' },
    { x: 4400, y: 1770, text: 'the plaza rumbles. something papier-mache is furious' },
    { x: 6800, y: 1900, text: 'pinatas hang from the party lines' },
    { x: 6150, y: 1920, text: 'a stalled cart: far too low to walk' },
    { x: 5160, y: 1180, text: 'the light lines hum with festival power' },
    { x: 4950, y: 1900, text: 'the plaza is packed: no way through the crowd' },
    { x: 4450, y: 1840, text: 'the drums remember the beat' },
    { x: 2700, y: 1930, text: 'stage door: propped open' },
    { x: 2100, y: 1940, text: 'the flytower goes up: follow the hooks' },
  ],
};
