// The Rookery: the hub under the city. A crow-run night market dug into
// an old utility vault, with a flyway gate to every district and the
// Magpie's stall in the middle selling map fragments. Gates are linger
// gates: stand inside one for a beat and it takes you.

function line(x0, y, x1, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y]);
  return pts;
}

// gate x-positions west to east, matching the city's own order; the port
// flyway hangs past the Glades gate at the market's dark end
const GATE = { OD: 250, BRI: 600, WYN: 950, HAV: 1650, SKY: 2000, GLA: 2350, PORT: 2700 };

export default {
  id: 'the-rookery',
  name: 'The Rookery',
  district: 0,
  hub: true,
  hidden: true, // never the NEXT stop after a district; you come here on purpose
  blurb: 'The market under the city. Every flyway starts here.',

  sky: 'night',
  ambient: 'rgb(158,146,186)',
  grade: { top: 'rgba(30,18,55,0.2)', bottom: 'rgba(255,160,90,0.08)' },
  bloom: 0.32,
  ambience: 'motes',

  intro: [
    'Under the city, the flock keeps a market no map admits to.',
    'Six flyway gates, one shrewd magpie, and everything shiny you ever dropped.',
    'They call it <span class="accent">THE ROOKERY</span>.',
  ],
  outro: [],

  width: 2950,
  height: 900,
  groundY: 700,
  spawn: { x: 1300, y: 670 },
  initialAbilities: ['flap', 'glide', 'swoop'],

  // arrivals land just outside the gate they flew in through
  entries: {
    'ocean-drive': { x: GATE.OD + 105, y: 664 },
    'brickell-ascent': { x: GATE.BRI + 105, y: 664 },
    'wynwood-walls': { x: GATE.WYN + 105, y: 664 },
    'little-havana': { x: GATE.HAV + 105, y: 664 },
    'skyway-mile-zero': { x: GATE.SKY + 105, y: 664 },
    'river-of-grass': { x: GATE.GLA + 105, y: 664 },
    'the-sleeping-port': { x: GATE.PORT + 105, y: 664 },
  },

  // the six flyways. Ocean Drive is the free one; the rest open with the
  // Magpie's map fragments
  exits: [
    { x: GATE.OD, y: 540, w: 70, h: 160, to: 'ocean-drive', entry: 'hub', label: 'OCEAN DRIVE', linger: true, vdir: -1 },
    { x: GATE.BRI, y: 540, w: 70, h: 160, to: 'brickell-ascent', entry: 'hub', label: 'BRICKELL', linger: true, vdir: -1, lock: 'frag:brickell-ascent' },
    { x: GATE.WYN, y: 540, w: 70, h: 160, to: 'wynwood-walls', entry: 'hub', label: 'WYNWOOD', linger: true, vdir: -1, lock: 'frag:wynwood-walls' },
    { x: GATE.HAV, y: 540, w: 70, h: 160, to: 'little-havana', entry: 'hub', label: 'CALLE OCHO', linger: true, vdir: -1, lock: 'frag:little-havana' },
    { x: GATE.SKY, y: 540, w: 70, h: 160, to: 'skyway-mile-zero', entry: 'hub', label: 'THE SKYWAY', linger: true, vdir: -1, lock: 'frag:skyway-mile-zero' },
    { x: GATE.GLA, y: 540, w: 70, h: 160, to: 'river-of-grass', entry: 'hub', label: 'THE GLADES', linger: true, vdir: -1, lock: 'frag:river-of-grass' },
    { x: GATE.PORT, y: 540, w: 70, h: 160, to: 'the-sleeping-port', entry: 'hub', label: 'THE PORT', linger: true, vdir: -1, lock: 'frag:the-sleeping-port' },
  ],

  shop: { x: 1300, y: 700 },

  buildings: [],
  extraSolids: [
    // stacked freight crates to perch on, either side of the stall
    { x: 1120, y: 590, w: 110, h: 110, kind: 'crate' },
    { x: 1150, y: 500, w: 80, h: 90, kind: 'crate' },
    { x: 1440, y: 610, w: 100, h: 90, kind: 'crate' },
  ],
  platforms: [],
  vents: [],
  hazards: [],
  pickups: [],
  checkpoints: [],

  backdrops: [{ x: 0, y: 0, w: 2950, h: 700 }],
  darkZones: [
    {
      x: 0, y: 0, w: 2950, h: 700,
      lights: [
        { x: GATE.OD + 35, y: 610, r: 210 },
        { x: GATE.BRI + 35, y: 610, r: 210 },
        { x: GATE.WYN + 35, y: 610, r: 210 },
        { x: GATE.HAV + 35, y: 610, r: 210 },
        { x: GATE.SKY + 35, y: 610, r: 210 },
        { x: GATE.GLA + 35, y: 610, r: 210 },
        { x: GATE.PORT + 35, y: 610, r: 210 },
        { x: 1300, y: 560, r: 300 },
        { x: 1300, y: 300, r: 240 },
      ],
    },
  ],

  decor: [
    { type: 'bigpipe', x: 100, y: 340, w: 2750 },
    { type: 'lantern', x: 1060, y: 420, w: 480 },
    { type: 'lantern', x: 380, y: 440, w: 420 },
    { type: 'lantern', x: 1760, y: 440, w: 420 },
    { type: 'lamp', x: 470 },
    { type: 'lamp', x: 1870 },
    { type: 'lamp', x: 2540 },
  ],

  shinies: [...line(420, 640, 1120, 4), ...line(1480, 640, 2180, 4), [2560, 640]],

  hints: [
    { x: 1300, y: 600, text: 'the Magpie sells map fragments: each one opens a flyway gate' },
    { x: 355, y: 600, text: 'stand inside a gate and hold still: the flyway does the rest' },
    { x: 2170, y: 600, text: 'shinies spend here. keep grabbing them out there' },
  ],
};
