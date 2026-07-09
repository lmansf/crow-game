// The five connector hallways that stitch the districts into one world.
// Each is a short, safe, strongly themed corridor: the airlock between
// two zones, with doors at both ends and the next district's mood
// creeping in from the far side.

function line(x0, y, x1, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y]);
  return pts;
}

// shared skeleton: 1500 wide, ground at 700, a door at each end
function hallway(base) {
  return {
    connector: true,
    width: 1500,
    height: 900,
    groundY: 700,
    spawn: { x: 750, y: 670 },
    entries: {
      west: { x: 130, y: 664 },
      east: { x: 1370, y: 664 },
    },
    buildings: [],
    extraSolids: [],
    platforms: [],
    vents: [],
    hazards: [],
    pickups: [],
    checkpoints: [],
    decor: [],
    hints: [],
    shinies: [],
    ...base,
    // most districts are entered at their west edge going east; a district
    // travelled the other way (Little Havana) overrides the entry names
    exits: [
      { x: 4, y: 540, w: 60, h: 160, to: base.westTo, entry: base.westEntry || 'east', label: base.westLabel, dir: -1 },
      { x: 1436, y: 540, w: 60, h: 160, to: base.eastTo, entry: base.eastEntry || 'west', label: base.eastLabel, dir: 1 },
    ],
  };
}

export const hallDrain = hallway({
  id: 'hall-drain',
  name: 'Storm Drain Mouth',
  district: 1.5,
  blurb: 'The drains run all the way to Brickell.',
  westTo: 'ocean-drive', westLabel: 'OCEAN DRIVE',
  eastTo: 'brickell-ascent', eastLabel: 'BRICKELL',
  sky: 'dusk',
  ambient: 'rgb(150,148,188)',
  grade: { top: 'rgba(20,30,50,0.18)', bottom: 'rgba(60,160,130,0.08)' },
  bloom: 0.3,
  ambience: null,
  initialAbilities: ['flap', 'glide', 'swoop'],
  intro: [
    'The pelican said the fast way downtown is not over the towers.',
    'It is under them.',
  ],
  backdrops: [{ x: 0, y: 0, w: 1500, h: 700 }],
  darkZones: [
    {
      x: 0, y: 0, w: 1500, h: 700,
      lights: [
        { x: 130, y: 620, r: 200 },
        { x: 480, y: 300, r: 190 },
        { x: 1020, y: 300, r: 190 },
        { x: 1370, y: 620, r: 200 },
        { x: 750, y: 620, r: 170 },
      ],
    },
  ],
  extraSolids: [
    { x: 420, y: 0, w: 110, h: 300, kind: 'brick' },
    { x: 960, y: 0, w: 110, h: 300, kind: 'brick' },
  ],
  decor: [
    { type: 'grate', x: 450, y: 300, w: 60, drop: 400 },
    { type: 'grate', x: 990, y: 300, w: 60, drop: 400 },
    { type: 'bigpipe', x: 150, y: 380, w: 1200 },
    { type: 'sewerwater', x: 60, y: 700, w: 1380 },
  ],
  shinies: [...line(330, 640, 1170, 5)],
  hints: [{ x: 750, y: 560, text: 'the drains run all the way to Brickell' }],
});

export const hallGlideway = hallway({
  id: 'hall-glideway',
  name: 'The Glide-Way',
  district: 2.5,
  blurb: 'A catwalk over the whole city, dusk on one end and dawn on the other.',
  westTo: 'brickell-ascent', westLabel: 'BRICKELL',
  eastTo: 'wynwood-walls', eastLabel: 'WYNWOOD',
  sky: 'dusk',
  skyMix: { from: 'dusk', to: 'dawn', x0: 150, x1: 1350 },
  ambient: 'rgb(196,182,224)',
  grade: { top: 'rgba(60,20,90,0.12)', bottom: 'rgba(255,150,110,0.08)' },
  bloom: 0.32,
  ambience: 'motes',
  initialAbilities: ['flap', 'glide', 'swoop', 'break', 'launch', 'soar'],
  intro: [
    'From EL FARO\'s crown, a maintenance catwalk runs north over the whole sleeping city.',
    'Walk it long enough and dusk turns into dawn.',
  ],
  cables: [
    { x: 380, y: 560, w: 240 },
    { x: 880, y: 560, w: 240 },
  ],
  platforms: [
    { x: 700, y: 470, w: 80, type: 'antenna' },
  ],
  decor: [
    { type: 'mast', x: 240, w: 50, y0: 420 },
    { type: 'mast', x: 1210, w: 50, y0: 420 },
    { type: 'lamp', x: 560 },
    { type: 'lamp', x: 1000 },
  ],
  shinies: [...line(300, 630, 1200, 6), [500, 500], [1000, 500]],
  hints: [{ x: 750, y: 560, text: 'walk long enough and dusk becomes dawn' }],
});

export const hallUnderpass = hallway({
  id: 'hall-underpass',
  name: 'The Painted Underpass',
  district: 3.5,
  blurb: 'Where the gallery walls end, the lantern light begins.',
  westTo: 'wynwood-walls', westLabel: 'WYNWOOD',
  eastTo: 'little-havana', eastLabel: 'CALLE OCHO', eastEntry: 'east',
  sky: 'dawn',
  skyMix: { from: 'dawn', to: 'night', x0: 150, x1: 1350 },
  ambient: 'rgb(190,170,200)',
  grade: { top: 'rgba(90,40,90,0.14)', bottom: 'rgba(255,150,80,0.09)' },
  bloom: 0.34,
  ambience: 'sparks',
  initialAbilities: ['flap', 'glide', 'swoop', 'break', 'launch', 'soar', 'roll', 'grip', 'hook'],
  intro: [
    'The muralists paint the underpass a little further every year.',
    'Tonight the paint runs out where the lanterns start.',
  ],
  backdrops: [{ x: 150, y: 260, w: 1200, h: 440, style: 'gallery' }],
  extraSolids: [
    { x: 150, y: 200, w: 1200, h: 60, kind: 'concrete' },
    { x: 150, y: 260, w: 40, h: 300, kind: 'shutter' },
    { x: 1310, y: 260, w: 40, h: 300, kind: 'shutter' },
  ],
  murals: [
    { x: 190, y0: 260, y1: 560, dir: -1 },
  ],
  decor: [
    { type: 'lantern', x: 800, y: 380, w: 460 },
    { type: 'rooster', x: 1240 },
    { type: 'palm', x: 320, h: 110, lean: 0.4 },
    { type: 'car', x: 520, hue: 320 },
  ],
  shinies: [...line(340, 630, 1160, 5), [750, 480]],
  hints: [{ x: 750, y: 560, text: 'the paint ends where the lanterns begin' }],
});

export const hallToll = hallway({
  id: 'hall-toll',
  name: 'The Toll Ramp',
  district: 4.5,
  blurb: 'The rain starts halfway up the ramp.',
  westTo: 'little-havana', westLabel: 'CALLE OCHO', westEntry: 'west',
  eastTo: 'skyway-mile-zero', eastLabel: 'THE SKYWAY',
  sky: 'night',
  skyMix: { from: 'night', to: 'storm', x0: 150, x1: 1350 },
  weather: 'rain',
  ambient: 'rgb(152,152,190)',
  grade: { top: 'rgba(20,40,80,0.18)', bottom: 'rgba(90,170,190,0.08)' },
  bloom: 0.3,
  ambience: null,
  initialAbilities: ['flap', 'glide', 'swoop', 'break', 'launch', 'soar', 'roll', 'grip', 'hook', 'grind'],
  intro: [
    'EL GALLO said the city ends where the river of cars begins.',
    'The on-ramp is empty. Everyone else already evacuated.',
  ],
  extraSolids: [
    { x: 560, y: 470, w: 380, h: 40, kind: 'concrete' },
  ],
  rails: [
    { x1: 560, y1: 466, x2: 940, y2: 466, style: 'guard' },
  ],
  decor: [
    { type: 'pylon', x: 640, y0: 510, y1: 700, w: 60 },
    { type: 'pylon', x: 820, y0: 510, y1: 700, w: 60 },
    { type: 'truck', x: 1080, y: 700, hue: 210 },
    { type: 'lamp', x: 380 },
    { type: 'lamp', x: 1240 },
  ],
  shinies: [...line(320, 630, 1180, 5), [700, 420], [820, 420]],
  hints: [{ x: 750, y: 560, text: 'the rain starts halfway up the ramp' }],
});

export const hallCauseway = hallway({
  id: 'hall-causeway',
  name: 'The Last Causeway',
  district: 5.5,
  blurb: 'The road gives up. The river of grass does not.',
  westTo: 'skyway-mile-zero', westLabel: 'THE SKYWAY',
  eastTo: 'river-of-grass', eastLabel: 'THE GLADES',
  sky: 'storm',
  skyMix: { from: 'storm', to: 'night', x0: 150, x1: 1350 },
  horizon: 'glades',
  groundStyle: 'marsh',
  ambient: 'rgb(148,166,162)',
  grade: { top: 'rgba(15,45,45,0.16)', bottom: 'rgba(110,190,130,0.08)' },
  bloom: 0.3,
  ambience: 'fireflies',
  initialAbilities: ['flap', 'glide', 'swoop', 'break', 'launch', 'soar', 'roll', 'grip', 'hook', 'grind', 'wind'],
  intro: [
    'Past MILE 0 the asphalt crumbles into peat, one pothole at a time.',
    'The storm stays behind with the city, as if it knows better.',
  ],
  decor: [
    { type: 'boardwalk', x: 420, w: 260 },
    { type: 'reed', x: 240, y: 700 },
    { type: 'reed', x: 760, y: 700 },
    { type: 'reed', x: 1140, y: 700 },
    { type: 'reed', x: 1330, y: 700 },
    { type: 'flock', x: 1050, y: 360, count: 6 },
  ],
  shinies: [...line(330, 630, 1170, 5), [1050, 460]],
  hints: [{ x: 750, y: 560, text: 'the road gives up here. you do not' }],
});
