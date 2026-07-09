// Easter egg: The Mothership.
// A green tractor beam over VIZCAYA's roof (Brickell) hauls the crow up
// here. Three chambers: the abduction bay, the specimen gallery, and
// the armory, where the RAY GUN waits. The gun does nothing - except
// lift the curious junk scattered across Miami that nothing else can.
// Hidden: no district card, no NEXT chaining. You find it or you don't.

function line(x0, y, x1, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y]);
  return pts;
}

export default {
  id: 'ufo',
  name: 'The Mothership',
  district: 0,
  connector: true,
  hidden: true,
  blurb: 'You were not supposed to find this.',
  sky: 'night',
  ambient: 'rgb(150,205,165)',
  grade: { top: 'rgba(10,60,30,0.22)', bottom: 'rgba(80,200,110,0.10)' },
  bloom: 0.45,
  ambience: 'motes',

  intro: [
    'The light is green. The pull is polite but firm.',
    'Welcome aboard, earth bird.',
  ],

  width: 2400,
  height: 1000,
  groundY: 860,
  spawn: { x: 300, y: 830 },
  initialAbilities: ['flap', 'glide'],

  entries: {
    beam: { x: 300, y: 820 },
  },
  exits: [
    // the beam-down pad in the armory floor
    { x: 2260, y: 700, w: 90, h: 160, to: 'brickell-ascent', entry: 'beamdown', label: 'BEAM DOWN', dir: -1 },
  ],

  buildings: [],

  extraSolids: [
    // hull ceiling
    { x: 0, y: 80, w: 2400, h: 60, kind: 'steel' },
    // bay/gallery bulkhead: crossed on the lift beam
    { x: 800, y: 300, w: 50, h: 560, kind: 'steel' },
    // gallery/armory bulkhead: opened by the console combo (puzzle door)
    // pedestal under the ray gun
    { x: 2020, y: 740, w: 80, h: 120, kind: 'steel' },
  ],

  // interior tractor lifts
  beams: [
    { x: 620, w: 100, base: 860, top: 200 },
    { x: 1700, w: 100, base: 860, top: 380 },
  ],

  // the console combo seals the armory
  puzzle: {
    switches: [
      { x: 940, y: 826, hue: 150 },
      { x: 1180, y: 610, hue: 185 },
      { x: 1450, y: 826, hue: 100 },
    ],
    order: [2, 0, 1],
    display: { x: 1200, y: 460 },
    // seals floor to ceiling: no flying over the armory bulkhead
    door: { x: 1600, y: 140, w: 50, h: 720 },
  },

  platforms: [
    // gallery inspection walkways
    { x: 1120, y: 640, w: 130, type: 'ledge' },
    { x: 1330, y: 540, w: 130, type: 'ledge' },
    // armory approach
    { x: 1840, y: 640, w: 120, type: 'ledge' },
  ],

  vents: [],
  hazards: [],
  cables: [],
  checkpoints: [
    { x: 460, y: 860 },
  ],

  pickups: [
    { x: 2060, y: 690, ability: 'raygun' },
  ],

  backdrops: [
    { x: 0, y: 0, w: 2400, h: 1000, style: 'ship' },
  ],

  decor: [
    // the collection so far
    { type: 'specimen', x: 1000, y: 860, h: 150, w: 70, item: 'palm' },
    { type: 'specimen', x: 1240, y: 860, h: 140, w: 90, item: 'car', hue: 185 },
    { type: 'specimen', x: 1480, y: 860, h: 150, w: 70, item: 'rooster' },
    { type: 'specimen', x: 1900, y: 860, h: 130, w: 70, item: 'gull' },
  ],

  shinies: [
    ...line(220, 800, 700, 4),
    ...line(900, 780, 1500, 5),
    [1180, 570], [1390, 500],
    ...line(1750, 700, 1980, 3),
    [2300, 640],
  ],

  hints: [
    { x: 350, y: 740, text: 'welcome aboard, earth bird' },
    { x: 670, y: 740, text: 'the lifts run on the same green light' },
    { x: 1240, y: 740, text: 'the specimens sleep. do not tap the glass' },
    { x: 1780, y: 740, text: 'the armory wants its combo' },
    { x: 2150, y: 620, text: 'take it. it does nothing. you will love it' },
  ],
};
