// The one-world compositor: stitches every district, hallway, the Rookery,
// and the Sleeping Port into a single continuous map of Miami - no zone
// doors, one coordinate space from the harbor to the Everglades.
//
// How: each existing level's data is offset into place along a shared
// street line (GY); Little Havana is mirrored (it was authored to be
// crossed westward); the walls where zone doors used to stand are carved
// open; and connective rooms are generated - the harbor cut, the drain
// drop, the midtown understreet, the roost well - so the city reads as one
// big place instead of a chain of rooms.
//
// The composed level registers as 'miami' and is the default game;
// ?world=0 falls back to the classic chained zones, untouched.

import oceanDrive from './ocean-drive.js';
import brickellAscent from './brickell-ascent.js';
import wynwoodWalls from './wynwood-walls.js';
import littleHavana from './little-havana.js';
import skywayMileZero from './skyway-mile-zero.js';
import riverOfGrass from './river-of-grass.js';
import { hallDrain, hallGlideway, hallUnderpass, hallToll, hallCauseway } from './hallways.js';
import theSleepingPort from './the-sleeping-port.js';
import rookery from './rookery.js';

const GY = 2600;          // the shared street line every district stands on
const WORLD_H = 3800;     // deep enough for the sewers and the market below

// ---------------------------------------------------------------- helpers

const X_KEYS = ['x', 'x0', 'x1', 'x2'];
const Y_KEYS = ['y', 'y0', 'y1', 'y2', 'top', 'base', 'floor'];

function offsetObj(o, dx, dy) {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map((v) => offsetObj(v, dx, dy));
  const out = { ...o };
  for (const k of X_KEYS) if (typeof out[k] === 'number') out[k] += dx;
  for (const k of Y_KEYS) if (typeof out[k] === 'number') out[k] += dy;
  for (const k of ['arena', 'display', 'door']) if (out[k]) out[k] = offsetObj(out[k], dx, dy);
  if (Array.isArray(out.switches)) out.switches = out.switches.map((s) => offsetObj(s, dx, dy));
  if (Array.isArray(out.lights)) out.lights = out.lights.map((s) => offsetObj(s, dx, dy));
  return out;
}

// mirror a level's data around its own width (Little Havana runs eastward now)
function mirror(data) {
  const W = data.width;
  const mx = (x, w = 0) => W - x - w;
  const d = JSON.parse(JSON.stringify(data));
  const rect = (o) => { if (typeof o.x === 'number') o.x = mx(o.x, o.w || 0); };
  const pt = (o) => { if (typeof o.x === 'number') o.x = mx(o.x); };
  for (const key of ['extraSolids', 'platforms', 'waters', 'timedHazards', 'backdrops', 'darkZones', 'winds', 'buildings', 'cables', 'vents', 'beams']) {
    (d[key] || []).forEach(rect);
  }
  for (const key of ['pickups', 'checkpoints', 'cages', 'curios', 'enemies', 'hooks', 'hints']) {
    (d[key] || []).forEach(pt);
  }
  (d.decor || []).forEach((o) => {
    if (typeof o.w === 'number') rect(o); else pt(o);
    if (typeof o.lean === 'number') o.lean = -o.lean;
  });
  (d.landmarks || []).forEach((o) => { if (typeof o.w === 'number') rect(o); else pt(o); });
  (d.darkZones || []).forEach((z) => (z.lights || []).forEach(pt));
  (d.hazards || []).forEach((h) => { const a = mx(h.x1), b = mx(h.x2); h.x1 = Math.min(a, b); h.x2 = Math.max(a, b); });
  (d.rails || []).forEach((r) => {
    const nx1 = mx(r.x2), nx2 = mx(r.x1), ny1 = r.y2, ny2 = r.y1;
    r.x1 = nx1; r.x2 = nx2; r.y1 = ny1; r.y2 = ny2;
  });
  (d.murals || []).forEach((m) => { m.x = mx(m.x); m.dir = -m.dir; });
  (d.groundSegments || []).forEach(rect);
  d.shinies = (d.shinies || []).map(([x, y]) => [mx(x), y]);
  if (d.spawn) pt(d.spawn);
  for (const e of Object.values(d.entries || {})) pt(e);
  (d.exits || []).forEach((e) => { rect(e); if (e.dir) e.dir = -e.dir; });
  if (d.puzzle) {
    d.puzzle.switches.forEach(pt);
    pt(d.puzzle.display);
    rect(d.puzzle.door);
  }
  if (d.boss) {
    pt(d.boss);
    const a = d.boss.arena;
    const nx0 = mx(a.x1);
    a.x1 = mx(a.x0);
    a.x0 = nx0;
  }
  if (d.goal) pt(d.goal);
  if (d.skyMix) {
    // the content at old x1 lands at new x0, so the skies swap ends too
    const a = mx(d.skyMix.x0), b = mx(d.skyMix.x1);
    d.skyMix.x0 = b; d.skyMix.x1 = a;
    const from = d.skyMix.from; d.skyMix.from = d.skyMix.to; d.skyMix.to = from;
  }
  // beachEnd means "sand west of this line" - a mirrored beach would need
  // sand on the east side, which the renderer can't express; drop it rather
  // than paint sand over the street
  if (typeof d.beachEnd === 'number') delete d.beachEnd;
  return d;
}

// ---------------------------------------------------------------- compose

function compose() {
  const W = {
    id: 'miami',
    name: 'Miami',
    world: true,
    hidden: true,
    district: 0,
    blurb: 'All of it. One city, one sky.',
    intro: [
      'One city, one sky, one long way home.',
      'Everything between the harbor and the river of grass is wing-distance now.',
    ],
    outro: [],
    height: WORLD_H,
    groundY: GY,
    sky: 'dusk',
    ambient: 'rgb(170,160,210)',
    spawn: null,
    entries: {},
    exits: [],
    regions: [],
    goals: [],
    bosses: [],
    puzzles: [],
    groundSegments: [],
    buildings: [], extraSolids: [], platforms: [], vents: [], hazards: [],
    pickups: [], checkpoints: [], decor: [], hints: [], shinies: [],
    cables: [], rails: [], winds: [], waters: [], timedHazards: [], cages: [],
    landmarks: [], murals: [], hooks: [], backdrops: [], darkZones: [],
    beams: [], curios: [], enemies: [],
    // a fresh crow starts featherless, exactly like Ocean Drive's opening;
    // map arrivals deeper in carry that district's kit (handled in main.js)
    initialAbilities: [],
  };

  let cursor = 0;
  const placed = {};

  const MERGE_KEYS = ['extraSolids', 'platforms', 'vents', 'hazards', 'pickups',
    'checkpoints', 'hints', 'cables', 'rails', 'winds', 'waters', 'timedHazards',
    'murals', 'hooks', 'backdrops', 'darkZones', 'beams', 'enemies'];

  function place(id, src, opts = {}) {
    const data = opts.mirror ? mirror(src) : src;
    const dy = opts.gyLocal !== undefined
      ? (opts.gyWorld ?? GY) - opts.gyLocal
      : GY - data.groundY;
    const dx = opts.atX !== undefined ? opts.atX : cursor;
    placed[id] = { id, x: dx, dy, data, w: data.width };

    const segGy = data.groundY + dy;
    const thickness = opts.thickness ?? data.groundThickness ?? (WORLD_H - segGy);
    const segs = data.groundSegments || [{ x: 0, w: data.width }];
    for (const s of segs) {
      W.groundSegments.push({
        x: s.x + dx, w: s.w, gy: segGy, thickness,
        style: data.groundStyle,
        beachEnd: typeof data.beachEnd === 'number' ? data.beachEnd + dx : undefined,
      });
    }
    for (const b of data.buildings || []) {
      W.buildings.push({ ...b, x: b.x + dx, gy: segGy });
    }
    for (const key of MERGE_KEYS) {
      const skip = new Set(opts[`drop_${key}`] || []);
      (data[key] || []).forEach((o, i) => {
        if (!skip.has(i)) W[key].push(offsetObj(o, dx, dy));
      });
    }
    // cages and curios keep their home district's save keys, so freeing a
    // songbird counts in both the world and the classic zones
    (data.cages || []).forEach((c, i) => {
      W.cages.push({ ...offsetObj(c, dx, dy), flagKey: `cage:${id}:${i}` });
    });
    (data.curios || []).forEach((c, i) => {
      W.curios.push({ ...offsetObj(c, dx, dy), flagKey: `curio:${id}:${i}` });
    });
    for (const d of data.decor || []) {
      const o = offsetObj(d, dx, dy);
      if (o.y === undefined) o.y = segGy; // pin ground decor to this street
      o.gy = segGy;
      W.decor.push(o);
    }
    for (const lm of data.landmarks || []) {
      W.landmarks.push({ ...offsetObj(lm, dx, dy), gy: segGy });
    }
    W.shinies.push(...(data.shinies || []).map(([x, y]) => [x + dx, y + dy]));
    if (data.puzzle) W.puzzles.push(offsetObj(data.puzzle, dx, dy));
    if (data.boss) W.bosses.push(offsetObj(data.boss, dx, dy));
    if (data.goal) {
      W.goals.push({
        ...offsetObj(data.goal, dx, dy),
        district: id,
        final: !!opts.finalGoal,
        completeData: { id, name: data.name, completeHeading: data.completeHeading, outro: data.outro },
      });
    }
    if (data.spawn) W.entries[id] = offsetObj({ ...data.spawn }, dx, dy);

    if (data.shop) W.shop = offsetObj({ ...data.shop }, dx, dy);

    W.regions.push({
      id,
      name: data.name || null,
      district: data.district,
      x0: dx,
      x1: dx + data.width,
      gy: segGy,
      sky: data.sky || 'dusk',
      skyMix: data.skyMix ? { ...data.skyMix, x0: data.skyMix.x0 + dx, x1: data.skyMix.x1 + dx } : null,
      ambient: data.ambient || 'rgb(170,160,210)',
      grade: data.grade || null,
      bloom: data.bloom ?? 0.34,
      horizon: data.horizon || 'city',
      weather: data.weather || null,
      ambience: data.ambience || null,
      underground: !!opts.underground,
      uy0: opts.underground ? dy : 0,
      uy1: opts.underground ? dy + data.height : 0,
    });

    if (opts.atX === undefined) cursor += data.width;
    return placed[id];
  }

  const connective = (id, data, opts = {}) => place(id, {
    groundY: data.groundY ?? GY,
    width: data.width,
    height: data.height ?? 1400,
    buildings: [], extraSolids: [], platforms: [], vents: [], hazards: [],
    pickups: [], checkpoints: [], decor: [], hints: [], shinies: [],
    cables: [], rails: [], winds: [], waters: [], timedHazards: [], cages: [],
    landmarks: [], murals: [], hooks: [], backdrops: [], darkZones: [],
    beams: [], curios: [], enemies: [],
    ...data,
  }, opts);

  // split any street slab that spans [hx0, hx1) at ground level, leaving a
  // hole (for well mouths) or a thinned roof (for chambers below)
  function splitSlab(hx0, hx1, roofThickness = 0) {
    const out = [];
    for (const s of W.groundSegments) {
      if (s.gy !== GY || hx1 <= s.x || hx0 >= s.x + s.w) { out.push(s); continue; }
      if (hx0 > s.x) out.push({ ...s, w: hx0 - s.x });
      if (roofThickness > 0) out.push({ ...s, x: hx0, w: hx1 - hx0, thickness: roofThickness });
      if (hx1 < s.x + s.w) out.push({ ...s, x: hx1, w: s.x + s.w - hx1 });
    }
    W.groundSegments = out;
  }

  // ---------------- the chain, west to east ----------------

  // 1. The Sleeping Port: the epilogue district, physically on the map now
  place('the-sleeping-port', theSleepingPort, {
    // its own rookery flyway stone still works (handled as a warp below)
  });

  // 2. Government Cut: harbor water between port and beach, with a locked
  //    harbor gate the Magpie's PORT fragment opens
  connective('government-cut', {
    width: 900,
    sky: 'night',
    skyMix: { from: 'night', to: 'dusk', x0: 100, x1: 800 },
    ambient: 'rgb(152,154,194)',
    grade: { top: 'rgba(15,25,60,0.16)', bottom: 'rgba(90,140,200,0.08)' },
    bloom: 0.3,
    ambience: 'motes',
    groundSegments: [{ x: 0, w: 130 }, { x: 770, w: 130 }],
    waters: [{ x: 130, y: GY + 36, w: 640, h: WORLD_H - GY - 36 }],
    extraSolids: [
      // the Government Cut storm gate: tall enough that no mid-game kit can
      // fly over it - the Magpie's PORT fragment is the only way through
      { x: 44, y: GY - 1420, w: 46, h: 1420, kind: 'steel', lock: 'frag:the-sleeping-port' },
    ],
    platforms: [
      { x: 240, y: GY - 40, w: 70, type: 'ledge' },
      { x: 430, y: GY - 70, w: 70, type: 'ledge' },
      { x: 620, y: GY - 40, w: 70, type: 'ledge' },
    ],
    decor: [{ type: 'lamp', x: 100 }, { type: 'flock', x: 450, y: GY - 700, count: 5 }],
    hints: [
      { x: 450, y: GY - 160, text: 'government cut: the buoys mind the channel' },
      { x: 210, y: GY - 240, text: 'the storm gate answers to the PORT FRAGMENT' },
    ],
    shinies: [[275, GY - 110], [465, GY - 140], [655, GY - 110]],
  });

  // 3. Ocean Drive
  place('ocean-drive', oceanDrive);

  // 4. Storm Drain Mouth (street-grade drain corridor)
  place('hall-drain', hallDrain);

  // 5. The Drain Drop: an open culvert from street level down to the
  //    Brickell sewers - the join the old zone door used to teleport across
  connective('drain-drop', {
    width: 520,
    height: WORLD_H,
    sky: 'dusk',
    ambient: 'rgb(150,148,188)',
    grade: { top: 'rgba(20,30,50,0.18)', bottom: 'rgba(60,160,130,0.08)' },
    bloom: 0.3,
    groundSegments: [{ x: 150, w: 370 }], // street slab; mouth open at west
    groundThickness: 120,
    backdrops: [{ x: 0, y: GY + 120, w: 520, h: 880 }],
    darkZones: [{
      x: 0, y: GY + 120, w: 520, h: 880,
      lights: [
        { x: 110, y: GY + 260, r: 190 }, { x: 380, y: GY + 460, r: 190 },
        { x: 150, y: GY + 660, r: 190 }, { x: 340, y: GY + 790, r: 210 },
      ],
    }],
    extraSolids: [
      { x: 440, y: GY + 120, w: 80, h: 560, kind: 'brick' },  // east wall, opening at the floor
      { x: 0, y: GY + 800, w: 520, h: 200, kind: 'brick' },   // culvert floor
    ],
    platforms: [
      { x: 160, y: GY + 260, w: 58, type: 'rung' },
      { x: 300, y: GY + 430, w: 58, type: 'rung' },
      { x: 160, y: GY + 600, w: 58, type: 'rung' },
      { x: 320, y: GY + 730, w: 58, type: 'rung' },
    ],
    decor: [{ type: 'grate', x: 220, y: GY + 120, w: 60, drop: 500 }],
    hints: [{ x: 260, y: GY - 40, text: 'the culvert drops to the drains: mind the mouth' }],
    shinies: [[240, GY + 320], [240, GY + 540], [240, GY + 720]],
  });

  // 6. Brickell, hung so its sewer floor continues the culvert floor and -
  //    happily - its street lands exactly on the shared line
  const bri = place('brickell-ascent', brickellAscent, {
    gyLocal: 3200, gyWorld: GY + 800,
    drop_extraSolids: [1], // carve the old left cap wall (x 0..120 in the drains)
  });

  // 7. The Glide-Way: a true catwalk now, hanging off EL FARO's crown line
  const glide = place('hall-glideway', hallGlideway, {
    gyLocal: 700, gyWorld: bri.dy + 350,
    thickness: 60, // a catwalk, not a cliff: the street below stays open
  });

  // 8. Midtown understreet: the sleeping city under the catwalk, so a fall
  //    is a detour, not a death - walk on east into Wynwood
  {
    const gx = glide.x;
    const catY = glide.data.groundY + glide.dy;
    W.groundSegments.push({ x: gx, w: glide.w, gy: GY });
    W.buildings.push(
      { x: gx + 180, w: 300, h: 700, style: 'block', hue: 275, gy: GY },
      { x: gx + 640, w: 340, h: 900, style: 'deco', hue: 185, sign: 'MIDTOWN', gy: GY },
      { x: gx + 1120, w: 260, h: 620, style: 'block', hue: 45, gy: GY },
    );
    W.decor.push(
      { type: 'lamp', x: gx + 90, y: GY, gy: GY },
      { type: 'car', x: gx + 500, y: GY, hue: 200, gy: GY },
      { type: 'lamp', x: gx + 1420, y: GY, gy: GY },
    );
    W.platforms.push(
      { x: gx + 1330, y: catY + 420, w: 66, type: 'fireescape' },
      { x: gx + 1410, y: catY + 820, w: 66, type: 'fireescape' },
      { x: gx + 1330, y: catY + 1220, w: 66, type: 'fireescape' },
      { x: gx + 1410, y: catY + 1600, w: 66, type: 'fireescape' },
    );
    W.hints.push({ x: gx + 750, y: GY - 60, text: 'midtown sleeps under the catwalk' });
    W.shinies.push([gx + 340, GY - 60], [gx + 810, GY - 960], [gx + 1250, GY - 60]);
  }

  // 9-15. Wynwood -> the Glades, all on the shared street line
  const wyn = place('wynwood-walls', wynwoodWalls);
  place('hall-underpass', hallUnderpass);
  place('little-havana', littleHavana, { mirror: true });
  place('hall-toll', hallToll);
  place('skyway-mile-zero', skywayMileZero);
  place('hall-causeway', hallCauseway);
  const river = place('river-of-grass', riverOfGrass, { finalGoal: true });
  const worldWidth = cursor;

  // ---------------- the Rookery, physically under Wynwood ----------------
  const rk = place('the-rookery', rookery, {
    atX: wyn.x + 1400,
    gyLocal: 0, gyWorld: GY + 120, // market ceiling right under the street slab
    underground: true,
    thickness: 400,
  });
  // thin the street above the market to a roof, and punch the roost well.
  // The thinned range matches the market exactly: past either end the
  // street stays full-depth earth, so the market's open ends are walls,
  // not bottomless shafts.
  splitSlab(rk.x, rk.x + rk.w, 120);
  const wellX = rk.x + 1220; // drops in between the market's gates
  splitSlab(wellX, wellX + 120, 0);
  W.extraSolids.push(
    { x: wellX - 50, y: GY - 240, w: 50, h: 240, kind: 'brick' },
    { x: wellX + 120, y: GY - 240, w: 50, h: 240, kind: 'brick' },
  );
  W.platforms.push(
    { x: wellX + 30, y: GY + 200, w: 58, type: 'rung' },
    { x: wellX + 10, y: GY + 400, w: 58, type: 'rung' },
    { x: wellX + 30, y: GY + 580, w: 58, type: 'rung' },
  );
  W.hints.push({ x: wellX + 60, y: GY - 280, text: 'the roost well hums below the murals' });

  // ---------------- warps: the flyway network stays as fast travel -------
  for (const e of rookery.exits) {
    const dst = placed[e.to];
    if (!dst) continue;
    // land just outside the district's own hub gate, like the flyway always did
    const hub = dst.data.entries?.hub;
    const spot = hub
      ? { x: hub.x + dst.x, y: hub.y + dst.dy }
      : W.entries[e.to];
    if (!spot) continue;
    W.exits.push({
      x: e.x + rk.x, y: e.y + rk.dy, w: e.w, h: e.h,
      warp: true, tx: spot.x, ty: spot.y,
      label: e.label, linger: true, vdir: -1, lock: e.lock,
    });
  }
  for (const seg of Object.values(placed)) {
    if (seg.id === 'the-rookery') continue;
    for (const e of seg.data.exits || []) {
      if (e.to !== 'the-rookery') continue;
      const arrive = rookery.entries[seg.id];
      if (!arrive) continue;
      W.exits.push({
        x: e.x + seg.x, y: e.y + seg.dy, w: e.w, h: e.h,
        warp: true, tx: arrive.x + rk.x, ty: arrive.y + rk.dy,
        label: 'THE ROOKERY', linger: true, vdir: 1,
      });
    }
  }
  // the UFO's tractor beam keeps its portal (abductions get a pass)
  {
    const beam = brickellAscent.exits.find((e) => e.to === 'ufo');
    if (beam) W.exits.push(offsetObj({ ...beam }, bri.x, bri.dy));
    const bd = brickellAscent.entries.beamdown;
    if (bd) W.entries.beamdown = { x: bd.x + bri.x, y: bd.y + bri.dy };
  }

  W.width = worldWidth;
  W.spawn = { ...W.entries['ocean-drive'] };
  return W;
}

export const miami = compose();

// segment ids inside the composed world (used to reroute legacy exit
// targets like the UFO's beam-down when world mode is on)
export const WORLD_SEGMENTS = new Set([
  'ocean-drive', 'brickell-ascent', 'wynwood-walls', 'little-havana',
  'skyway-mile-zero', 'river-of-grass', 'the-sleeping-port', 'the-rookery',
  'hall-drain', 'hall-glideway', 'hall-underpass', 'hall-toll', 'hall-causeway',
]);

// One-world is the game now; ?world=0 falls back to the classic chained
// zones (persisted), ?world=1 returns to the big map.
export function worldOn() {
  try {
    return localStorage.getItem('crow-world') !== '0';
  } catch {
    return true;
  }
}

export function initWorldToggle() {
  try {
    const q = new URLSearchParams(location.search).get('world');
    if (q === '1') localStorage.removeItem('crow-world');
    else if (q === '0') localStorage.setItem('crow-world', '0');
  } catch { /* storage unavailable: the world stays on */ }
}
