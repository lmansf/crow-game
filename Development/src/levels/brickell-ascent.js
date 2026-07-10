// District 2: Brickell Ascent.
// One tall map in three strata: storm drains -> downtown streets -> skyline.
// Each stratum hides the skill needed to climb into the next one:
//   drains  -> BEAK BREAK  (smash the cracked bulkhead sealing the shaft up)
//   streets -> LINE LAUNCH (spring up the cable chain to the rooftops)
//   skyline -> THERMAL SOAR (ride the thermals to the summit of EL FARO)

const G = 2400; // street level

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
  id: 'brickell-ascent',
  name: 'Brickell Ascent',
  district: 2,
  blurb: 'Storm drains to the skyline crown.',
  completeHeading: 'THE WAY HOME',
  ambient: 'rgb(178,164,216)',
  grade: { top: 'rgba(30,20,70,0.16)', bottom: 'rgba(120,200,255,0.08)' },
  ambience: 'motes',

  intro: [
    'Dawn broke rough. Two blocks out from The Roost, a squall slammed you into the gutter, and the gutter swallowed you whole.',
    'The flood spat you out somewhere under Downtown: dripping tunnels, humming junction boxes, water that glows.',
    'The city goes up from here. So do you.',
    'Drains. Streets. Skyline. <span class="accent">Home is past the glow.</span>',
  ],

  outro: [
    'From the crown of EL FARO, the city finally shows you its edges.',
    'Past the last highway lights, a dark green sea of sawgrass breathes in the night wind.',
    'The Everglades. Home.',
    'Rest your wings. At first light, you fly the last leg.',
  ],

  width: 3400,
  height: 3400,
  groundY: G,
  groundThickness: 120,
  groundSegments: [
    { x: 0, w: 2760 },
    { x: 2890, w: 510 },
  ],
  spawn: { x: 290, y: 3140 },
  initialAbilities: ['flap', 'glide', 'swoop'],

  // mega-map doors: back down the drain, and out over the rooftops
  entries: {
    west: { x: 210, y: 3160 },
    east: { x: 3226, y: 320 },
    beamdown: { x: 340, y: 1120 },
    hub: { x: 300, y: 3160 },
  },
  exits: [
    // hugs the cap, tucked in the nook under the stash alcove, so only a
    // deliberate walk-in trips it
    { x: 118, y: 3080, w: 26, h: 120, to: 'hall-drain', entry: 'east', label: 'OCEAN DRIVE', dir: -1 },
    { x: 3250, y: 210, w: 60, h: 140, to: 'hall-glideway', entry: 'west', label: 'THE GLIDE-WAY', dir: 1 },
    // the Rookery flyway, sunk into the sewer floor under the stash alcove
    { x: 330, y: 3050, w: 56, h: 150, to: 'the-rookery', entry: 'brickell-ascent', label: 'THE ROOKERY', linger: true, vdir: 1 },
    // the top of the green beam: not a door, an abduction
    { x: 160, y: -60, w: 120, h: 160, to: 'ufo', entry: 'beam', hidden: true },
  ],

  // easter egg: the beam hangs over VIZCAYA's secret roof
  beams: [
    { x: 160, w: 120, base: 1150, top: -100 },
  ],

  curios: [
    { x: 1650, y: 2825, type: 'duck' },
    { x: 2150, y: 1285, type: 'dish' },
  ],

  // room 1's locals: the drain rats own the dark
  enemies: [
    { type: 'rat', x: 600, y: 3188, range: 150 },
    // patrol edge + full 1.1s charge at 300px/s must stay short of the
    // boss arena wall at 1240: 880 + 330 = 1210
    { type: 'rat', x: 800, y: 3188, range: 80 },
  ],

  // room 2: the junction-box combo seals the drain early
  puzzle: {
    switches: [
      { x: 435, y: 3040, hue: 185 },
      { x: 700, y: 3040, hue: 45 },
      { x: 560, y: 3160, hue: 320 },
    ],
    order: [2, 0, 1],
    display: { x: 1030, y: 2800 },
    door: { x: 1000, y: 2520, w: 60, h: 680 },
  },

  // room 3: the Rat King rules the gallery, hoarding the Beak Break
  boss: {
    type: 'ratking',
    pattern: 'charge',
    x: 2100,
    y: 3166,
    arena: { x0: 1240, x1: 2240, top: 2520, floor: 3200 },
    drops: 'break',
  },

  // real downtown silhouettes behind the playable towers
  landmarks: [
    { type: 'freedomtower', x: 1000, w: 190, h: 1300 },   // the Freedom Tower's cupola crown
    { type: 'miamitower', x: 1690, w: 260, h: 1700 },     // Miami Tower's color-washed tiers
  ],

  buildings: [
    { x: 40, w: 360, h: 1250, style: 'deco', hue: 190, sign: 'VIZCAYA' },   // top 1150
    { x: 660, w: 300, h: 900, style: 'block', hue: 320, sign: 'METRO' },    // top 1500
    { x: 1260, w: 420, h: 1600, style: 'deco', hue: 45, sign: 'ARCADIA', flicker: true }, // top 800
    { x: 2000, w: 380, h: 1100, style: 'block', hue: 275, sign: 'PALMA' },  // top 1300
    { x: 2900, w: 420, h: 2050, style: 'tower', hue: 200, sign: 'EL FARO' }, // top 350
  ],

  // sewer masonry, the breakable bulkheads, and the manhole shaft
  extraSolids: [
    { x: 0, y: 3200, w: 3400, h: 200, kind: 'brick' },                       // sewer floor
    { x: 0, y: 2520, w: 120, h: 700, kind: 'brick' },                        // left cap
    { x: 3280, y: 2520, w: 120, h: 700, kind: 'brick' },                     // right cap
    { x: 600, y: 3080, w: 220, h: 120, kind: 'brick' },                      // ledge block
    { x: 1050, y: 2960, w: 160, h: 240, kind: 'brick' },                     // pillar
    { x: 1580, y: 2840, w: 280, h: 80, kind: 'brick' },                      // gallery
    { x: 2280, y: 2520, w: 90, h: 680, kind: 'brick', breakable: true },     // bulkhead to the shaft
    // the teased stash: an alcove up in the west wall, its mouth bricked
    // shut until Beak Break. the floor below stays open so the drain door
    // and the west entry never seal
    { x: 310, y: 2700, w: 70, h: 320, kind: 'brick', breakable: true },   // alcove mouth
    { x: 120, y: 3020, w: 190, h: 26, kind: 'brick' },                    // alcove floor
    // shaft walls hang from the street slab, flush with the manhole edges,
    // leaving a low passage along the floor into (and past) the shaft
    { x: 2690, y: 2520, w: 70, h: 400, kind: 'brick' },                      // shaft wall left
    { x: 2890, y: 2520, w: 80, h: 400, kind: 'brick' },                      // shaft wall right
    { x: 3050, y: 2860, w: 80, h: 340, kind: 'brick', breakable: true },     // secret stash wall
  ],

  platforms: [
    // sewer pipes and the gallery approach
    { x: 380, y: 3080, w: 110, type: 'pipe' },
    { x: 840, y: 2990, w: 110, type: 'pipe' },
    { x: 1330, y: 2900, w: 110, type: 'pipe' },
    // tunnel beyond the bulkhead
    { x: 2460, y: 3080, w: 100, type: 'pipe' },
    // shaft rungs up to the manhole (top rung centered under the hole)
    { x: 2762, y: 3040, w: 58, type: 'rung' },
    { x: 2830, y: 2920, w: 58, type: 'rung' },
    { x: 2762, y: 2800, w: 58, type: 'rung' },
    { x: 2830, y: 2680, w: 58, type: 'rung' },
    { x: 2790, y: 2540, w: 58, type: 'rung' },
    { x: 2790, y: 2470, w: 58, type: 'rung' },   // inside the manhole itself
    // street furniture
    { x: 690, y: 2280, w: 90, type: 'awning' },
    { x: 830, y: 2280, w: 90, type: 'awning' },
    { x: 1010, y: 2290, w: 110, type: 'busstop' },
    { x: 1268, y: 2185, w: 90, type: 'awning' },
    { x: 2010, y: 2260, w: 120, type: 'awning' },
    // parking garage decks (Line Launch waits on top)
    { x: 1700, y: 2280, w: 280, type: 'deck' },
    { x: 1700, y: 2160, w: 280, type: 'deck' },
    { x: 1700, y: 2040, w: 280, type: 'deck' },
    { x: 1700, y: 1920, w: 280, type: 'deck' },
    // skyline
    { x: 1290, y: 1120, w: 150, type: 'billboard', text: 'CAFETERIA', hue: 15 },
    { x: 1615, y: 660, w: 70, type: 'antenna' },
    { x: 2820, y: 560, w: 80, type: 'ledge' },
  ],

  // slack cables: perches until Line Launch, slingshots after
  cables: [
    { x: 980, y: 2150, w: 260 },   // street chain
    { x: 980, y: 1800, w: 260 },
    { x: 980, y: 1450, w: 260 },   // tops out on METRO's roof, or VIZCAYA for the daring
    { x: 1290, y: 1075, w: 150 },  // above the CAFETERIA billboard, up to ARCADIA's roof
  ],

  vents: [
    // thermals between PALMA and EL FARO: dead air until Thermal Soar
    { x: 2450, w: 110, base: G, top: 760, soarOnly: true },
    { x: 2700, w: 110, base: G, top: 480, soarOnly: true },
  ],

  hazards: [
    // all at shin height so walking zaps and hopping clears
    { x1: 430, x2: 570, y: 2380, sag: 10 },    // downed line on the west street
    { x1: 1330, x2: 1450, y: 780, sag: 8 },    // ARCADIA roof (roof at 800)
    { x1: 1480, x2: 1600, y: 772, sag: 8 },
    { x1: 2060, x2: 2200, y: 1280, sag: 8 },   // PALMA roof (roof at 1300)
    { x1: 2940, x2: 3040, y: 3180, sag: 6 },   // guards the sewer stash
  ],

  pickups: [
    // break now falls from the Rat King's hoard
    { x: 1840, y: 1865, ability: 'launch' },
    { x: 1650, y: 615, ability: 'soar' },
  ],

  checkpoints: [
    { x: 1470, y: 3200 },   // sewer gallery
    { x: 2560, y: 2400 },   // street by the manhole
    { x: 1150, y: 2400 },   // cable plaza
    { x: 760, y: 1500 },    // METRO roof
    { x: 1285, y: 800 },    // ARCADIA roof
    { x: 2320, y: 1300 },   // PALMA roof, before the thermals
  ],

  goal: { x: 3110, y: 350, text: 'EVERGLADES' },

  shinies: [
    // the teased stash alcove behind the cracked bricks
    ...line(160, 2990, 280, 3),
    [220, 2890],
    // drains
    ...line(380, 3150, 900, 4),
    [430, 3040], [890, 2950], [1370, 2860],
    ...arc(1000, 3060, 1240, 2930, 3, 30),
    ...line(1610, 2800, 1840, 3),
    ...line(2400, 3150, 2620, 3),
    ...col(2790, 3090, 2610, 4),
    ...line(3140, 3150, 3250, 3),
    [3200, 3060],
    // streets
    ...line(2340, 2350, 2620, 4),
    ...line(970, 2350, 1240, 3),
    [1065, 2240], [1313, 2135],
    [735, 2230], [875, 2230],
    [2070, 2210],
    ...col(1840, 2240, 1960, 3),
    [1100, 2080], [1100, 1730], [1100, 1380],
    // skyline
    ...line(700, 1440, 920, 3),
    ...diag(1250, 1350, 1340, 1160, 3),
    [1340, 1035], [1400, 1035],
    [1390, 690], [1540, 682],
    ...diag(1720, 850, 1980, 1240, 4),
    ...line(2050, 1240, 2350, 4),
    ...col(2505, 2250, 900, 5),
    ...col(2755, 1400, 560, 3),
    ...arc(2950, 300, 3300, 300, 5, 70),
    [3110, 240],
    // VIZCAYA secret, off the top cable
    ...line(120, 1100, 340, 3),
  ],

  darkZones: [
    {
      x: 0, y: 2520, w: 3400, h: 880,
      lights: [
        { x: 290, y: 2620, r: 160 },   // grate light over the spawn
        { x: 290, y: 2800, r: 110 },
        { x: 215, y: 2960, r: 120 },   // stash alcove glow behind the bricks
        { x: 700, y: 3160, r: 100 },
        { x: 1470, y: 3130, r: 130 },  // gallery perch
        { x: 1720, y: 2860, r: 140 },
        { x: 2320, y: 2980, r: 110 },  // bulkhead approach
        { x: 2800, y: 2700, r: 150 },  // manhole shaft glow
        { x: 3200, y: 3120, r: 110 },  // stash
      ],
    },
  ],

  decor: [
    // drains
    { type: 'grate', x: 240, y: 2520, w: 100, drop: 560 },
    { type: 'bigpipe', x: 150, y: 2660, w: 900 },
    { type: 'bigpipe', x: 1900, y: 2620, w: 1100 },
    { type: 'sewerwater', x: 140, y: 3200, w: 2100 },
    { type: 'sewerwater', x: 2400, y: 3200, w: 860 },
    // streets
    { type: 'car', x: 430, hue: 320 },
    { type: 'lamp', x: 520 },
    { type: 'palm', x: 990, h: 120, lean: 0.5 },
    { type: 'lamp', x: 1180 },
    { type: 'car', x: 1500, hue: 190 },
    { type: 'lamp', x: 1620 },
    { type: 'palm', x: 2430, h: 115, lean: -0.4 },
    { type: 'car', x: 2650, hue: 50 },
    { type: 'lamp', x: 2740 },
  ],

  hints: [
    { x: 300, y: 3130, text: 'the flood dropped you here' },
    { x: 430, y: 2980, text: 'cracked bricks overhead: something glitters behind' },
    { x: 560, y: 3120, text: 'the junction box wants its combo' },
    { x: 850, y: 2920, text: 'hop the pipes' },
    { x: 1700, y: 2760, text: 'something enormous scratches in the gallery dark' },
    { x: 2190, y: 2960, text: 'cracked bricks block the way' },
    { x: 2190, y: 2992, text: 'search above the pipes for a way through' },
    { x: 2805, y: 2500, text: 'kick between the walls to climb', kb: 'kick between the walls to climb' },
    { x: 2550, y: 2320, text: 'downtown: the way home is up' },
    { x: 1840, y: 2330, text: 'climb the parking garage' },
    { x: 1110, y: 2090, text: 'slack cables: perch on one' },
    { x: 2505, y: 1180, text: 'warm air rises between the towers' },
    { x: 260, y: 1060, text: 'the sky hums green over VIZCAYA' },
  ],
};
