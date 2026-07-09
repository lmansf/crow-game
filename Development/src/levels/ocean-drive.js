// District 1: Ocean Drive Rooftops.
// Levels are plain data: geometry, entities, and story text.
// To add a district, copy this file, tweak, and register it in levels/index.js.

const G = 1500; // street level

// --- shiny placement helpers ---
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
  id: 'ocean-drive',
  name: 'Ocean Drive Rooftops',
  district: 1,
  blurb: 'Beach to beacon across the neon rooftops.',
  completeHeading: 'THE ROOST',

  intro: [
    'The hurricane took you.',
    'It ripped you out of the Everglades, spun you across the bay, and dropped you on a beach that never sleeps.',
    'Word on the wire: the city birds gather at <span class="accent">THE ROOST</span>, high above Ocean Drive.',
    'Cross the rooftops. Grab everything shiny. Find it.',
    'The way home starts there.',
  ],

  outro: [
    'You found <span class="accent">THE ROOST</span>.',
    'Every lost bird in Miami lands here sooner or later.',
    'An old pelican nods at the dark horizon. "Everglades? Long way, kid. Rest those wings."',
    '"We fly at dawn."',
  ],

  width: 7200,
  height: 1620,
  groundY: G,
  beachEnd: 640,
  spawn: { x: 300, y: 1470 },

  buildings: [
    { x: 640, w: 430, h: 400, style: 'deco', hue: 340, sign: 'FLAMINGO' },
    { x: 1190, w: 470, h: 560, style: 'deco', hue: 185, sign: 'AZUL', flicker: true },
    { x: 1780, w: 400, h: 690, style: 'deco', hue: 45, sign: 'CORSAIR' },
    { x: 2440, w: 520, h: 760, style: 'block', hue: 275, sign: 'PALMERA' },
    { x: 3320, w: 460, h: 720, style: 'deco', hue: 15, sign: 'EL CUERVO' },
    { x: 3640, w: 140, h: 940, style: 'spire', hue: 15 },
    { x: 4340, w: 500, h: 640, style: 'block', hue: 150, sign: 'BISCAYNE' },
    { x: 4960, w: 440, h: 900, style: 'deco', hue: 25, sign: 'LUNA REY' },
    { x: 5880, w: 560, h: 940, style: 'block', hue: 290, sign: 'VICE PALMS' },
    { x: 6540, w: 520, h: 1300, style: 'tower', hue: 200 },
  ],

  platforms: [
    // beach: lifeguard tower (solid cabin, walkable roof)
    { x: 120, y: 1360, w: 120, type: 'hut', solid: true, boxH: 140 },
    // awning steps up the FLAMINGO's left face
    { x: 556, y: 1355, w: 90, type: 'awning' },
    { x: 548, y: 1215, w: 90, type: 'awning' },
    // gap 1 crossing
    { x: 1085, y: 1015, w: 110, type: 'awning' },
    // AZUL rooftop AC box (solid, hop up for the gap to CORSAIR)
    { x: 1560, y: 900, w: 70, type: 'ac', solid: true, boxH: 40 },
    // secret billboard above AZUL (wing flap required)
    { x: 1300, y: 760, w: 90, type: 'billboard', text: 'MOTEL', hue: 320 },
    // WING FLAP pickup billboard above CORSAIR
    { x: 1850, y: 700, w: 150, type: 'billboard', text: 'CAFE CUBANO', hue: 45 },
    // recovery awnings in the CORSAIR-PALMERA gap (right face of CORSAIR)
    { x: 2184, y: 1360, w: 66, type: 'fireescape' },
    { x: 2184, y: 1220, w: 66, type: 'fireescape' },
    { x: 2184, y: 1080, w: 66, type: 'fireescape' },
    { x: 2184, y: 940, w: 66, type: 'fireescape' },
    // TIKI billboard above PALMERA
    { x: 2620, y: 600, w: 120, type: 'billboard', text: 'TIKI', hue: 150 },
    // courtyard exit: fire escape up EL CUERVO's left wall
    { x: 3252, y: 1380, w: 68, type: 'fireescape' },
    { x: 3252, y: 1260, w: 68, type: 'fireescape' },
    { x: 3252, y: 1140, w: 68, type: 'fireescape' },
    { x: 3252, y: 1020, w: 68, type: 'fireescape' },
    { x: 3252, y: 900, w: 68, type: 'fireescape' },
    // street recovery below the glide gap: BISCAYNE's left wall
    { x: 4272, y: 1380, w: 68, type: 'fireescape' },
    { x: 4272, y: 1260, w: 68, type: 'fireescape' },
    { x: 4272, y: 1140, w: 68, type: 'fireescape' },
    { x: 4272, y: 1020, w: 68, type: 'fireescape' },
    { x: 4272, y: 900, w: 68, type: 'fireescape' },
    // COLADA billboard above BISCAYNE (ride the vent)
    { x: 4440, y: 620, w: 150, type: 'billboard', text: 'COLADA', hue: 185 },
    // chimney helper between BISCAYNE and LUNA REY
    { x: 4880, y: 730, w: 70, type: 'ledge' },
    // SWOOP pickup antenna above LUNA REY
    { x: 5150, y: 460, w: 80, type: 'antenna' },
    // street recovery in the swoop gap: LUNA REY's right wall
    { x: 5400, y: 1380, w: 68, type: 'fireescape' },
    { x: 5400, y: 1260, w: 68, type: 'fireescape' },
    { x: 5400, y: 1140, w: 68, type: 'fireescape' },
    { x: 5400, y: 1020, w: 68, type: 'fireescape' },
    { x: 5400, y: 900, w: 68, type: 'fireescape' },
    { x: 5400, y: 780, w: 68, type: 'fireescape' },
    { x: 5400, y: 660, w: 68, type: 'fireescape' },
    // tower chimney recovery ledges
    { x: 6460, y: 1100, w: 70, type: 'ledge' },
    { x: 6460, y: 800, w: 70, type: 'ledge' },
    { x: 6460, y: 500, w: 70, type: 'ledge' },
  ],

  vents: [
    { x: 3545, w: 70, base: 780, top: 500 },   // EL CUERVO roof, up to the spire
    { x: 4470, w: 70, base: 860, top: 590 },   // BISCAYNE roof, up to COLADA billboard
    { x: 6450, w: 80, base: G, top: 860 },     // tower chimney assist from street level
  ],

  hazards: [
    { x1: 5940, x2: 6100, y: 505, sag: 14 },
    { x1: 6140, x2: 6300, y: 492, sag: 14 },
  ],

  pickups: [
    { x: 1925, y: 655, ability: 'flap' },
    { x: 3710, y: 515, ability: 'glide' },
    { x: 5190, y: 415, ability: 'swoop' },
  ],

  checkpoints: [
    { x: 2560, y: 740 },
    { x: 4420, y: 860 },
    { x: 5905, y: 560 },
  ],

  goal: { x: 6800, y: 200 },

  shinies: [
    // beach and first climbs
    ...line(340, 1425, 560, 3),
    [600, 1300], [596, 1160], [700, 1055],
    ...line(770, 1050, 1010, 4),
    ...arc(1040, 1060, 1150, 970, 3, 40),
    // AZUL roof and hop to CORSAIR
    ...line(1260, 890, 1500, 4),
    [1592, 855],
    ...arc(1660, 850, 1810, 765, 3, 50),
    // up to the flap billboard
    [1885, 760], [1925, 712],
    // secret MOTEL billboard
    [1330, 725], [1360, 725],
    // flap gap to PALMERA
    ...arc(2200, 760, 2430, 695, 4, 70),
    ...line(2500, 690, 2900, 5),
    // TIKI billboard
    [2655, 560], [2700, 560],
    // courtyard street level
    ...line(3010, 1450, 3230, 4),
    [3150, 1330],
    // fire escape climb
    ...col(3286, 1340, 980, 4),
    // EL CUERVO roof and vent column
    ...line(3390, 730, 3520, 3),
    ...col(3580, 720, 555, 3),
    // glide gap (long descending trail)
    ...diag(3820, 570, 4300, 800, 6),
    // BISCAYNE roof and vent to COLADA
    ...line(4400, 810, 4700, 4),
    ...col(4505, 780, 680, 2),
    [4480, 580], [4550, 580],
    // chimney up to LUNA REY
    ...col(4905, 800, 630, 3),
    ...line(5040, 550, 5340, 4),
    // swoop gap
    ...diag(5450, 545, 5830, 520, 5),
    // VICE PALMS: weave the live wires
    [5910, 505], [6020, 448], [6120, 435], [6320, 500],
    // tower chimney
    ...col(6490, 1050, 450, 3),
    // summit crown
    ...arc(6600, 175, 7000, 175, 5, 70),
  ],

  decor: [
    { type: 'grass', x: 60 },
    { type: 'palm', x: 90, h: 130, lean: 0.6 },
    { type: 'palm', x: 430, h: 110, lean: -0.5 },
    { type: 'grass', x: 480 },
    { type: 'car', x: 2270, hue: 185 },
    { type: 'palm', x: 3030, h: 125, lean: 0.4 },
    { type: 'car', x: 3060, hue: 320 },
    { type: 'palm', x: 3180, h: 110, lean: -0.6 },
    { type: 'palm', x: 5560, h: 120, lean: 0.5 },
    { type: 'car', x: 5600, hue: 45 },
    { type: 'palm', x: 5760, h: 115, lean: -0.4 },
  ],

  hints: [
    { x: 300, y: 1395, text: '{MOVE} walk', kb: 'A / D walk' },
    { x: 180, y: 1290, text: '{JUMP} hop', kb: 'SPACE hop' },
    { x: 600, y: 1130, text: 'hop up the awnings' },
    { x: 1130, y: 930, text: 'hold into a wall to grip it, {JUMP} to kick off', kb: 'hold into a wall to grip it, SPACE to kick off' },
    { x: 3050, y: 1360, text: 'shinies hide at street level too' },
    { x: 3580, y: 760, text: 'AC updraft: ride it up' },
    { x: 6120, y: 400, text: 'live wires: hop over them' },
  ],
};
