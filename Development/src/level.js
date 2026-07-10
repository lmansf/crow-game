// Level engine: builds collision + entities from a plain data object
// (see src/levels/) and renders the world.

import { audio } from './audio.js';
import { gfx } from './gfx.js';
import { particles } from './particles.js';
import { save } from './save.js';
import { ABILITIES } from './abilities.js';
import { Enemies } from './enemies.js';
import { Boss } from './boss.js';
import { LEVELS } from './levels/index.js';

// the junk only the ray gun cares about
const CURIO_NAMES = {
  flamingo: 'LAWN FLAMINGO',
  cone: 'TRAFFIC CONE',
  duck: 'RUBBER DUCK',
  dish: 'SATELLITE DISH',
  bucket: 'PAINT BUCKET',
  record: 'VINYL RECORD',
  maraca: 'LONE MARACA',
  cafecito: 'CAFECITO CUP',
  propeller: 'BOAT PROPELLER',
  token: 'TOLL TOKEN',
  egg: 'GATOR EGG (DO NOT SHAKE)',
  shell: 'CONCH SHELL',
};

let curioTotalCache = 0;
function curioTotal() {
  if (!curioTotalCache) {
    for (const l of LEVELS) curioTotalCache += (l.curios || []).length;
  }
  return curioTotalCache;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LAUNCH_VY = 1320;
// how long the crow must hold still inside a flyway gate before it travels
const LINGER_TIME = 0.6;

export class Level {
  constructor(data) {
    this.data = data;
    this.width = data.width;
    this.height = data.height;
    this.groundY = data.groundY;
    this.spawn = { ...data.spawn };

    // ---- collision ----
    this.solids = [];
    // ground: full slab by default, or thin segmented slabs (holes = manholes)
    this.groundSegs = data.groundSegments || [{ x: 0, w: data.width }];
    const thickness = data.groundThickness || this.height - this.groundY + 400;
    for (const seg of this.groundSegs) {
      this.solids.push({ x: seg.x, y: this.groundY, w: seg.w, h: thickness });
    }
    for (const b of data.buildings) {
      this.solids.push({ x: b.x, y: this.groundY - b.h, w: b.w, h: b.h, building: b });
    }
    // hand-placed structure blocks (sewer masonry, shafts, breakable bulkheads)
    for (const s of data.extraSolids || []) {
      this.solids.push({ ...s });
    }
    this.oneWays = [];
    for (const p of data.platforms) {
      const rect = { x: p.x, y: p.y, w: p.w, h: 14, plat: p };
      if (p.bounce) rect.bounce = p.bounce;
      if (p.solid) this.solids.push({ x: p.x, y: p.y, w: p.w, h: p.boxH || 40, plat: p });
      else this.oneWays.push(rect);
    }
    // lily pads: one-ways that sink underfoot and bob back up
    this.pads = (data.pads || []).map((p) => ({ ...p, t: 0, baseY: p.y }));
    for (const pd of this.pads) {
      pd.rect = { x: pd.x, y: pd.y, w: pd.w || 84, h: 14, pad: pd };
      this.oneWays.push(pd.rect);
    }
    // slack cables: perches by default, launchers with the Line Launch ability
    this.cables = (data.cables || []).map((c) => ({ ...c, sinkT: 0, chargeT: 0 }));
    for (const c of this.cables) {
      c.rect = { x: c.x, y: c.y, w: c.w, h: 14, cable: c };
      this.oneWays.push(c.rect);
    }

    this.vents = data.vents.map((v) => ({ ...v }));
    this.hazards = data.hazards.map((h) => ({ ...h, sag: h.sag ?? 14 }));
    this.darkZones = (data.darkZones || []).map((z) => ({ ...z }));
    this.murals = (data.murals || []).map((m) => ({ ...m }));
    this.hooks = (data.hooks || []).map((h) => ({ ...h, held: false }));
    this.backdrops = data.backdrops ? data.backdrops.map((b) => ({ ...b })) : this.darkZones;
    // grind rails, precomputed as unit segments
    this.rails = (data.rails || []).map((r) => {
      const dx = r.x2 - r.x1;
      const dy = r.y2 - r.y1;
      const len = Math.hypot(dx, dy) || 1;
      return { ...r, len, ux: dx / len, uy: dy / len };
    });
    this.winds = (data.winds || []).map((w) => ({ ...w }));
    this.waters = (data.waters || []).map((w) => ({ ...w }));
    this.timedHazards = (data.timedHazards || []).map((h) => ({ ...h, period: h.period || 2.5, offset: h.offset || 0 }));
    this.cages = (data.cages || []).map((c, i) => ({ ...c, i, opened: !!save.getFlag(`cage:${data.id}:${i}`) }));
    this.landmarks = (data.landmarks || []).map((l) => ({ ...l }));

    // mega-map plumbing: doors to neighbouring zones, and named arrival spots
    this.exits = (data.exits || []).map((e) => ({ ...e }));
    this.entries = data.entries || {};

    // tractor beams, and the ray gun's curios (already-lifted ones stay gone)
    this.beams = (data.beams || []).map((b) => ({ ...b }));
    this.curios = (data.curios || [])
      .map((c, i) => ({ ...c, i, ox: c.x, oy: c.y, got: false, t: 0, phase: Math.random() * 6 }))
      .filter((c) => !save.getFlag(`curio:${data.id}:${c.i}`));

    // critters, boss, and the district puzzle
    this.enemies = new Enemies(data);
    this.boss = data.boss ? new Boss(data.boss, this) : null;
    this.puzzle = null;
    if (data.puzzle) {
      this.puzzle = {
        switches: data.puzzle.switches.map((s) => ({ ...s, lit: false, cool: 0, touching: false })),
        order: data.puzzle.order,
        display: data.puzzle.display,
        progress: 0,
        solved: false,
        door: { ...data.puzzle.door, kind: data.puzzle.door.kind || 'steel' },
      };
      this.solids.push(this.puzzle.door);
    }

    this.shinies = data.shinies.map(([x, y], i) => ({ x, y, ox: x, oy: y, got: false, phase: i * 0.7 }));
    this.shinyTotal = this.shinies.length;

    this.pickups = data.pickups.map((p) => ({ ...p, got: false, phase: Math.random() * 6 }));
    this.checkpoints = data.checkpoints.map((c) => ({ ...c, active: false }));
    // connector hallways have no goal sign at all
    this.goal = data.goal ? { ...data.goal, lit: 0, reached: false } : null;
    this.decor = data.decor || [];
    this.hints = data.hints || [];

    // pre-render building facades
    for (const b of data.buildings) {
      b.cache = renderBuilding(b, this.groundY);
    }
  }

  // Everything in the scene that casts light, for the fx lightmap.
  getLights(cam, t, player) {
    const x0 = cam.x - 250;
    const x1 = cam.x + cam.viewW + 250;
    const out = [];
    for (const b of this.data.buildings) {
      if ((!b.sign && !b.blade) || b.x + b.w < x0 || b.x > x1) continue;
      out.push({
        x: b.blade ? b.x + b.w * 0.16 : b.x + b.w / 2,
        y: this.groundY - b.h + (b.blade ? 130 : b.signY ?? 44),
        r: Math.max(160, b.w * 0.55),
        color: `hsla(${b.hue}, 90%, 70%, 0.55)`,
      });
    }
    for (const d of this.decor) {
      if (d.type !== 'lamp' || d.x < x0 || d.x > x1) continue;
      out.push({ x: d.x + 24, y: (d.y || this.groundY) - 108, r: 140, color: 'rgba(255,215,150,0.6)' });
    }
    for (const p of this.pickups) {
      if (p.got || p.x < x0 || p.x > x1) continue;
      out.push({ x: p.x, y: p.y, r: 180, color: ABILITIES[p.ability].color + '99' });
    }
    for (const c of this.checkpoints) {
      if (!c.active || c.x < x0 || c.x > x1) continue;
      out.push({ x: c.x, y: c.y - 46, r: 150, color: 'rgba(255,79,163,0.5)' });
    }
    for (const hz of this.hazards) {
      if (hz.x2 < x0 || hz.x1 > x1) continue;
      out.push({ x: (hz.x1 + hz.x2) / 2, y: hz.y, r: 110, color: 'rgba(120,235,255,0.45)' });
    }
    if (player?.abilities.hook) {
      for (const hk of this.hooks) {
        if (hk.x < x0 || hk.x > x1) continue;
        out.push({ x: hk.x, y: hk.y, r: 90, color: 'rgba(217,184,255,0.45)' });
      }
    }
    for (const s of this.shinies) {
      if (s.got || s.x < x0 || s.x > x1) continue;
      out.push({ x: s.x, y: s.y, r: 48, color: 'rgba(255,209,102,0.5)' });
    }
    if (player?.abilities.grind) {
      for (const r of this.rails) {
        if (Math.max(r.x1, r.x2) < x0 || Math.min(r.x1, r.x2) > x1) continue;
        out.push({
          x: (r.x1 + r.x2) / 2,
          y: (r.y1 + r.y2) / 2,
          r: Math.min(230, r.len * 0.45),
          color: 'rgba(242,233,99,0.28)',
        });
      }
    }
    for (const d of this.decor) {
      if (d.type !== 'lantern' || d.x + d.w < x0 || d.x > x1) continue;
      out.push({ x: d.x + d.w / 2, y: d.y, r: Math.min(220, d.w * 0.7), color: 'rgba(255,170,90,0.4)' });
    }
    for (const h of this.timedHazards) {
      const st = h._st;
      if (!st || h.x + h.w < x0 || h.x > x1) continue;
      if (h.type === 'coil') {
        out.push({ x: h.x + h.w / 2, y: h.y + h.h / 2, r: 80 + st.charge * 80, color: `rgba(140,220,255,${0.12 + st.charge * 0.35})` });
      } else if (h.type === 'sparkler' && st.deadly) {
        out.push({ x: h.x + h.w / 2, y: h.y + h.h * 0.4, r: 170, color: 'rgba(255,200,120,0.55)' });
      }
    }
    for (const e of this.exits) {
      if (e.hidden || e.x + e.w < x0 || e.x > x1) continue;
      const sealed = e.lock && !save.getFlag(e.lock);
      out.push({
        x: e.x + e.w / 2, y: e.y + e.h / 2, r: sealed ? 120 : 180,
        color: sealed ? 'rgba(150,110,200,0.25)' : 'rgba(140,220,255,0.4)',
      });
    }
    if (this.data.shop) {
      const sp = this.data.shop;
      out.push({ x: sp.x, y: sp.y - 120, r: 260, color: 'rgba(255,205,130,0.55)' });
    }
    for (const b of this.beams) {
      if (b.x + b.w < x0 || b.x > x1) continue;
      out.push({ x: b.x + b.w / 2, y: Math.max(b.top + 200, cam.y + 120), r: 320, color: 'rgba(125,255,106,0.35)' });
      out.push({ x: b.x + b.w / 2, y: b.base - 60, r: 220, color: 'rgba(125,255,106,0.3)' });
    }
    if (player?.abilities.raygun) {
      for (const c of this.curios) {
        if (c.got || c.x < x0 || c.x > x1) continue;
        out.push({ x: c.x, y: c.y - 8, r: 60, color: 'rgba(125,255,106,0.4)' });
      }
    }
    if (this.puzzle) {
      for (const s of this.puzzle.switches) {
        if (s.x < x0 || s.x > x1) continue;
        out.push({ x: s.x, y: s.y, r: 90, color: `hsla(${s.hue}, 90%, 65%, ${s.lit ? 0.55 : 0.25})` });
      }
    }
    const g = this.goal;
    if (g && g.x > x0 && g.x < x1) {
      out.push({
        x: g.x,
        y: g.y - 110,
        r: 240 + g.lit * 280,
        color: g.lit > 0 ? 'rgba(255,120,190,0.75)' : 'rgba(200,180,255,0.28)',
      });
    }
    if (player && player.dead <= 0) {
      out.push({ x: player.x, y: player.y, r: 300, color: 'rgba(200,185,255,0.5)' });
    }
    return out;
  }

  // Sparse drifting ambience particles per district, density tiered by gfx.
  ambience(dt, cam) {
    const kind = this.data.ambience;
    if (!kind) return;
    const rate = (kind === 'petals' ? 5 : kind === 'motes' ? 4 : kind === 'sparks' ? 6 : 3) * gfx.ambientScale;
    if (Math.random() > dt * rate) return;
    const x = cam.x + Math.random() * cam.viewW;
    if (kind === 'sparks') {
      // festival embers drifting up off the lantern lines
      particles.burst(x, cam.y + cam.viewH * (0.4 + Math.random() * 0.6), {
        count: 1, color: `hsla(${28 + Math.random() * 24}, 95%, 64%, 0.8)`,
        speed: 22, life: 2.4, size: 1.6, gravity: -26,
      });
      return;
    }
    if (kind === 'fireflies') {
      particles.burst(x, this.groundY - 16 - Math.random() * 220, {
        count: 1, color: 'rgba(210,255,140,0.75)', speed: 14, life: 2.6, size: 1.8, gravity: -6,
      });
    } else if (kind === 'petals') {
      particles.burst(x, cam.y - 8, {
        count: 1, color: `hsla(${Math.floor(Math.random() * 360)}, 85%, 66%, 0.85)`,
        speed: 34, angle: Math.PI * 0.38, spread: 0.4, life: 3.2, size: 2.2, gravity: 26, glow: false,
      });
    } else {
      particles.burst(x, cam.y + Math.random() * cam.viewH, {
        count: 1, color: 'rgba(200,215,255,0.35)', speed: 8, life: 3, size: 1.4, gravity: -3, glow: false,
      });
    }
  }

  // Sequence puzzle: hit the neon pads in the order the display shows.
  updatePuzzle(dt, player, game, t) {
    const pz = this.puzzle;
    for (let i = 0; i < pz.switches.length; i++) {
      const s = pz.switches[i];
      if (s.cool > 0) s.cool -= dt;
      const touch = player.dead <= 0 && Math.abs(player.x - s.x) < 30 && Math.abs(player.y - s.y) < 36;
      if (touch && !s.touching && s.cool <= 0) {
        s.cool = 0.4;
        if (pz.order[pz.progress] === i) {
          pz.progress++;
          s.lit = true;
          audio.collect();
          particles.burst(s.x, s.y, { count: 8, color: `hsl(${s.hue}, 90%, 65%)`, speed: 130, life: 0.4, size: 2 });
          if (pz.progress >= pz.order.length) {
            pz.solved = true;
            pz.door.broken = true;
            audio.power();
            game.hitstop(0.15);
            game.camera?.shake(6, 0.3);
            game.ui.toast('NEON COMBO', 'the storm shutter slides open');
            particles.burst(pz.door.x + pz.door.w / 2, pz.door.y + pz.door.h / 3, { count: 22, color: '#35e0e0', speed: 260, life: 0.6, size: 2.4 });
          }
        } else {
          pz.progress = 0;
          for (const sw of pz.switches) sw.lit = false;
          audio.zap();
          game.flash(0.12);
        }
      }
      s.touching = touch;
    }
  }

  // The sky mood for this frame: a fixed name, or a mix that tracks the
  // player across the map (District 6 flies from night into dawn).
  skyMood(player) {
    const mix = this.data.skyMix;
    if (mix && player) {
      const span = mix.x1 - mix.x0;
      const k = span ? Math.max(0, Math.min(1, (player.x - mix.x0) / span)) : 0;
      return { from: mix.from, to: mix.to, k };
    }
    return this.data.sky || 'dusk';
  }

  // Is there grippable painted wall at this face position? dir is the side
  // the crow pushes toward (+1 = wall on the crow's right).
  muralAt(edgeX, y, dir) {
    for (const m of this.murals) {
      if (m.dir === dir && Math.abs(m.x - edgeX) < 6 && y > m.y0 && y < m.y1) return true;
    }
    return false;
  }

  smash(s, game) {
    if (s.broken) return;
    s.broken = true;
    audio.smash();
    game.hitstop(0.08);
    game.camera?.shake(7, 0.22);
    const cx = s.x + s.w / 2;
    for (let i = 0; i < 22; i++) {
      particles.burst(cx, s.y + ((i + 0.5) / 22) * s.h, {
        count: 1,
        color: i % 3 ? '#6e4a44' : '#3a2830',
        speed: 260,
        life: 0.7,
        size: 3,
        gravity: 900,
        glow: false,
      });
    }
  }

  update(dt, player, game, t) {
    // shinies: magnet + collect
    for (const s of this.shinies) {
      if (s.got) continue;
      const dx = player.x - s.x;
      const dy = player.y - s.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 90 * 90 && player.dead <= 0) {
        const d = Math.sqrt(d2) || 1;
        const pull = 620 * (1 - d / 90);
        s.x += (dx / d) * pull * dt;
        s.y += (dy / d) * pull * dt;
      }
      if (d2 < 32 * 32 && player.dead <= 0) {
        s.got = true;
        game.shinies++;
        save.addWallet(1); // every shiny is also coin for the Magpie
        audio.collect();
        particles.burst(s.x, s.y, { count: 8, color: '#ffd166', speed: 150, life: 0.4, size: 2.2, gravity: 100 });
        game.ui.setShinies(game.shinies, this.shinyTotal);
      }
    }

    // ability pickups
    for (const p of this.pickups) {
      if (p.got || player.dead > 0) continue;
      if (player.abilities[p.ability]) { p.got = true; continue; }
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      if (dx * dx + dy * dy < 42 * 42) {
        p.got = true;
        player.grant(p.ability);
        audio.power();
        game.hitstop(0.35);
        game.onAbility(p.ability);
        const col = ABILITIES[p.ability].color;
        particles.burst(p.x, p.y, { count: 26, color: col, speed: 300, life: 0.7, size: 2.6, gravity: 60 });
        particles.feathers(p.x, p.y, 6, 0);
      }
    }

    // checkpoints (neon perches)
    for (const c of this.checkpoints) {
      if (c.active || player.dead > 0) continue;
      const dx = player.x - c.x;
      const dy = player.y - (c.y - 30);
      if (Math.abs(dx) < 46 && Math.abs(dy) < 70) {
        c.active = true;
        game.checkpoint = { x: c.x, y: c.y - 26 };
        audio.perch();
        particles.burst(c.x, c.y - 46, { count: 12, color: '#ff4fa3', speed: 120, life: 0.6, size: 2 });
        game.ui.toast('PERCH CLAIMED', 'you will respawn here');
      }
    }

    // slack cables: spring the crow upward once Line Launch is learned
    for (const c of this.cables) {
      if (c.sinkT > 0) c.sinkT -= dt;
      if (player.groundPlat === c.rect && player.abilities.launch && player.dead <= 0) {
        c.chargeT += dt;
        if (c.chargeT > 0.09) {
          c.chargeT = 0;
          c.sinkT = 0.45;
          player.vy = -LAUNCH_VY;
          player.grounded = false;
          player.groundPlat = null;
          player.usedFlap = false;
          player.dashReady = true;
          player.flapT = 1;
          player.launchT = 0.5;
          audio.launch();
          game.hitstop(0.02);
          particles.burst(player.x, player.y + 14, { count: 10, color: '#a4f26b', speed: 170, angle: Math.PI / 2, spread: 1.2, life: 0.4, size: 2, gravity: -120 });
          particles.feathers(player.x, player.y + 6, 3, 0);
        }
      } else if (player.groundPlat !== c.rect) {
        c.chargeT = 0;
      }
    }

    // goal
    if (this.goal && !this.goal.reached && player.dead <= 0) {
      const g = this.goal;
      if (Math.abs(player.x - g.x) < 110 && player.y > g.y - 190 && player.y < g.y + 30) {
        g.reached = true;
        game.beginOutro();
      }
    }
    if (this.goal && this.goal.reached) {
      this.goal.lit = Math.min(1, this.goal.lit + dt * 0.45);
    }

    // vent steam / thermal shimmer
    for (const v of this.vents) {
      if (Math.random() < 0.5) {
        const col = v.soarOnly ? 'rgba(255,190,140,0.13)' : 'rgba(180,200,230,0.16)';
        particles.trail(v.x + Math.random() * v.w, v.base - Math.random() * (v.base - v.top) * 0.5, col);
      }
    }

    // dripping ceilings in the dark
    for (const z of this.darkZones) {
      if (Math.random() < dt * 5) {
        particles.burst(z.x + Math.random() * z.w, z.y + 8, {
          count: 1, color: 'rgba(150,210,230,0.5)', speed: 20,
          angle: Math.PI / 2, spread: 0.1, life: 0.9, size: 1.6, gravity: 600, glow: false,
        });
      }
    }

    // timed hazards: sparkler fountains, lightning coils, gator jaws
    for (const h of this.timedHazards) {
      const st = timedState(h, t);
      h._st = st;
      if (st.deadly && player.dead <= 0 && player.invuln <= 0) {
        const r = player.rect();
        if (r.x < h.x + h.w && r.x + r.w > h.x && r.y < h.y + h.h && r.y + r.h > h.y) {
          player.die(game);
        }
      }
    }

    // lily pads sink underfoot and bob back up once left alone
    for (const pd of this.pads) {
      const feet = player.y + player.h / 2;
      const stood = player.dead <= 0 && player.vy >= 0 &&
        player.x > pd.rect.x - 8 && player.x < pd.rect.x + pd.rect.w + 8 &&
        Math.abs(feet - pd.rect.y) < 6;
      pd.t = Math.max(0, Math.min(1.15, pd.t + (stood ? dt / 1.2 : -dt / 1.9)));
      if (pd.t >= 1) pd.rect.disabled = true;
      else if (pd.t < 0.25) pd.rect.disabled = false;
      pd.rect.y = pd.baseY + pd.t * pd.t * 30 + Math.sin(t * 1.4 + pd.x) * 1.5;
    }

    // the ray gun's one and only power: lifting the curious junk
    if (player.abilities.raygun && player.dead <= 0) {
      for (const c of this.curios) {
        if (c.got) continue;
        const dx = player.x - c.x;
        const dy = player.y - 6 - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) {
          c.t += dt;
          const d = Math.sqrt(d2) || 1;
          const pull = 220 + c.t * 340;
          c.x += (dx / d) * pull * dt;
          c.y += (dy / d) * pull * dt;
          if (Math.random() < 0.5) particles.trail(c.x, c.y, 'rgba(125,255,106,0.7)');
          if (d2 < 30 * 30) {
            c.got = true;
            save.setFlag(`curio:${this.data.id}:${c.i}`);
            const n = (save.getFlag('curios') || 0) + 1;
            save.setFlag('curios', n);
            audio.collect();
            audio.perch();
            particles.burst(c.x, c.y, { count: 14, color: '#7dff6a', speed: 190, life: 0.5, size: 2.2 });
            game.ui.toast('CURIO BEAMED UP', `${CURIO_NAMES[c.type] || c.type} - ${n} of ${curioTotal()} lifted`);
          }
        } else {
          // pull abandoned: the junk settles back where it belongs
          c.t = Math.max(0, c.t - dt * 2);
          c.x += (c.ox - c.x) * Math.min(1, 4 * dt);
          c.y += (c.oy - c.y) * Math.min(1, 4 * dt);
        }
      }
    }

    // critters, boss, puzzle
    this.enemies.update(dt, player, game, t);
    if (this.boss) this.boss.update(dt, player, game, t);
    if (this.puzzle && !this.puzzle.solved) this.updatePuzzle(dt, player, game, t);

    // zone doors: edge doors trip on contact; mid-level flyway gates ask for
    // a short deliberate linger so passing traffic never falls through them
    if (player.dead <= 0) {
      for (const e of this.exits) {
        const inside = player.x > e.x && player.x < e.x + e.w && player.y > e.y && player.y < e.y + e.h;
        if (!inside) {
          e.lingerT = 0;
          e.hinted = false;
          continue;
        }
        if (e.lock && !save.getFlag(e.lock)) {
          if (!e.hinted) {
            e.hinted = true;
            game.ui.toast('FLYWAY SEALED', e.lockHint || 'the Magpie sells the map fragment that opens this gate');
          }
          continue;
        }
        if (e.linger) {
          e.lingerT = (e.lingerT || 0) + dt;
          if (e.lingerT < LINGER_TIME) continue;
        }
        game.beginExit(e);
        break;
      }
    }

    // the Magpie's stall: step up to the counter to browse
    if (this.data.shop && player.dead <= 0) {
      const sp = this.data.shop;
      const near = Math.abs(player.x - sp.x) < 70 && Math.abs(player.y - (sp.y - 50)) < 100;
      if (near && !this.shopLatch) {
        this.shopLatch = true;
        game.openShop();
      } else if (!near) {
        this.shopLatch = false;
      }
    }

    // caged songbirds: brush the cage to spring the door
    for (const c of this.cages) {
      if (c.opened || player.dead > 0) continue;
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      if (dx * dx + dy * dy < 46 * 46) {
        c.opened = true;
        save.setFlag(`cage:${this.data.id}:${c.i}`);
        game.songbirds = (game.songbirds || 0) + 1;
        audio.perch();
        particles.feathers(c.x, c.y - 6, 4, 0);
        particles.burst(c.x, c.y - 10, { count: 12, color: '#ffe98a', speed: 170, life: 0.55, size: 2, gravity: -140 });
        const freedHere = this.cages.filter((cage) => cage.opened).length;
        game.ui.toast('SONGBIRD FREED', `${freedHere} of ${this.cages.length} cages opened tonight`);
      }
    }
  }

  // ------------------------------------------------ drawing
  draw(ctx, cam, t, player) {
    const x0 = cam.x - 60;
    const x1 = cam.x + cam.viewW + 60;

    // interior/underground backdrops first so the sky never shows through
    for (const z of this.backdrops) {
      drawBackdrop(ctx, z);
    }

    // background landmarks: behind the playfield, in front of the sky
    for (const lm of this.landmarks) {
      if (lm.x + (lm.w || 400) < x0 - 200 || lm.x > x1 + 200) continue;
      drawLandmark(ctx, lm, t, this.groundY);
    }

    this.drawGround(ctx, cam, x0, x1);

    // open water in the ground gaps
    for (const w of this.waters) {
      if (w.x + w.w < x0 || w.x > x1) continue;
      drawWater(ctx, w, t, x0, x1);
    }

    // buildings
    for (const s of this.solids) {
      const b = s.building;
      if (!b) continue;
      if (b.x + b.w < x0 || b.x > x1) continue;
      ctx.drawImage(b.cache, b.x - 12, this.groundY - b.h - 12);
      // animated broken-tube flicker on flagged signs
      if (b.flicker && b.signY !== undefined) {
        const on = Math.sin(t * 9 + b.x) > -0.2 && Math.sin(t * 2.3) > -0.6;
        if (!on) {
          ctx.fillStyle = 'rgba(10,6,18,0.72)';
          ctx.fillRect(b.x + 8, this.groundY - b.h + b.signY - 20, b.w - 16, 42);
        }
      }
    }

    // zone doors, behind the structure blocks
    for (const e of this.exits) {
      if (e.hidden || e.x + e.w < x0 - 60 || e.x > x1 + 60) continue;
      drawExitDoor(ctx, e, t, e.lock && !save.getFlag(e.lock));
    }

    // the Magpie's market stall
    if (this.data.shop) drawShopStall(ctx, this.data.shop, t);

    // structure blocks (sewer masonry, breakables)
    for (const s of this.solids) {
      if (!s.kind || s.broken || s.off) continue;
      if (s.x + s.w < x0 || s.x > x1) continue;
      drawBlock(ctx, s, t, player);
    }

    // puzzle furniture
    if (this.puzzle) {
      drawPuzzleDisplay(ctx, this.puzzle, t);
      for (const s of this.puzzle.switches) drawPuzzleSwitch(ctx, s, t);
    }

    // decor in front of buildings
    for (const d of this.decor) {
      if (d.x + (d.w || 0) < x0 - 120 || d.x > x1 + 120) continue;
      if (d.type === 'palm') drawPalm(ctx, d.x, d.y || this.groundY, d.h || 120, d.lean || 0, t);
      else if (d.type === 'car') drawCar(ctx, d.x, d.y || this.groundY, d.hue || 320);
      else if (d.type === 'grass') drawGrass(ctx, d.x, d.y || this.groundY, t);
      else if (d.type === 'lamp') drawLamp(ctx, d.x, d.y || this.groundY);
      else if (d.type === 'bigpipe') drawBigPipe(ctx, d);
      else if (d.type === 'mast') drawMast(ctx, d, this.groundY);
      else if (d.type === 'sewerwater') drawSewerWater(ctx, d, t);
      else if (d.type === 'grate') drawGrateBeam(ctx, d, t);
      else if (d.type === 'lantern') drawLanternString(ctx, d, t);
      else if (d.type === 'rooster') drawRooster(ctx, d.x, d.y || this.groundY);
      else if (d.type === 'pergola') drawPergola(ctx, d, this.groundY);
      else if (d.type === 'pylon') drawPylon(ctx, d);
      else if (d.type === 'radiomast') drawRadioMast(ctx, d, t);
      else if (d.type === 'osprey') drawOsprey(ctx, d, t);
      else if (d.type === 'truck') drawTruck(ctx, d.x, d.y, d.hue || 210, t);
      else if (d.type === 'reed') drawReeds(ctx, d.x, d.y || this.groundY, t);
      else if (d.type === 'boardwalk') drawBoardwalk(ctx, d, this.groundY);
      else if (d.type === 'flock') drawFlock(ctx, d, t);
      else if (d.type === 'archlegs') drawArchLegs(ctx, d, this.groundY);
      else if (d.type === 'crane') drawBargeCrane(ctx, d, t);
      else if (d.type === 'specimen') drawSpecimen(ctx, d, this.groundY, t);
    }

    // platforms
    for (const p of this.data.platforms) {
      if (p.x + p.w < x0 || p.x > x1) continue;
      drawPlatform(ctx, p, t);
    }

    // cables
    for (const c of this.cables) {
      if (c.x + c.w < x0 || c.x > x1) continue;
      drawCable(ctx, c, t, !!player?.abilities.launch);
    }

    // grind rails
    for (const r of this.rails) {
      if (Math.max(r.x1, r.x2) < x0 || Math.min(r.x1, r.x2) > x1) continue;
      drawRail(ctx, r, t, !!player?.abilities.grind);
    }

    // lily pads
    for (const pd of this.pads) {
      if (pd.x + pd.rect.w < x0 || pd.x > x1) continue;
      drawLilyPad(ctx, pd, t);
    }

    // wind zones: streaming gust ribbons
    for (const wz of this.winds) {
      if (wz.x + wz.w < x0 || wz.x > x1) continue;
      drawWind(ctx, wz, t, !!player?.abilities.wind);
    }

    // murals (grippable painted walls)
    for (const m of this.murals) {
      if (m.x < x0 - 20 || m.x > x1 + 20) continue;
      drawMural(ctx, m, t, !!player?.abilities.grip);
    }

    // crane hooks
    for (const hk of this.hooks) {
      if (hk.x < x0 - 40 || hk.x > x1 + 40) continue;
      drawHook(ctx, hk, t, !!player?.abilities.hook);
    }

    // vents and thermals
    for (const v of this.vents) {
      if (v.x + v.w < x0 || v.x > x1) continue;
      if (v.soarOnly) drawThermal(ctx, v, t, !!player?.abilities.soar);
      else drawVent(ctx, v, t);
    }

    // hazards: sagging live wires (or thorn vines out in the glades)
    for (const hz of this.hazards) {
      if (hz.x2 < x0 || hz.x1 > x1) continue;
      if (hz.thorn) drawThornVine(ctx, hz, t);
      else drawWireHazard(ctx, hz, t);
    }

    // timed hazards
    for (const h of this.timedHazards) {
      if (h.x + h.w < x0 - 40 || h.x > x1 + 40) continue;
      drawTimedHazard(ctx, h, t);
    }

    // songbird cages
    for (const c of this.cages) {
      if (c.x < x0 - 40 || c.x > x1 + 40) continue;
      drawCage(ctx, c, t);
    }

    // tractor beams, over the world but translucent
    for (const b of this.beams) {
      if (b.x + b.w < x0 || b.x > x1) continue;
      drawBeam(ctx, b, t);
    }

    // curios: the junk nobody but the ray gun cares about
    for (const c of this.curios) {
      if (c.got || c.x < x0 - 60 || c.x > x1 + 60) continue;
      drawCurio(ctx, c, t, !!player?.abilities.raygun);
    }

    // hints
    ctx.textAlign = 'center';
    for (const h of this.hints) {
      if (h.x < x0 || h.x > x1) continue;
      ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(220,210,240,0.62)';
      ctx.fillText(h.resolved || h.text, h.x, h.y);
    }

    // checkpoints
    for (const c of this.checkpoints) {
      if (c.x < x0 - 60 || c.x > x1 + 60) continue;
      drawPerch(ctx, c, t);
    }

    // shinies
    for (const s of this.shinies) {
      if (s.got || s.x < x0 - 40 || s.x > x1 + 40) continue;
      drawShiny(ctx, s, t);
    }

    // ability pickups
    for (const p of this.pickups) {
      if (p.got || p.x < x0 - 60 || p.x > x1 + 60) continue;
      drawPickup(ctx, p, t);
    }

    // critters and the boss
    this.enemies.draw(ctx, cam, t);
    if (this.boss) this.boss.draw(ctx, t);

    // goal sign
    if (this.goal) drawGoal(ctx, this.goal, t);
  }

  drawGround(ctx, cam, x0, x1) {
    if (this.data.groundStyle === 'marsh') {
      this.drawMarsh(ctx, cam, x0, x1);
      return;
    }
    const gy = this.groundY;
    const beachEnd = this.data.beachEnd || 0;
    const thick = this.data.groundThickness;
    const depth = thick || cam.viewH + 200;

    for (const seg of this.groundSegs) {
      const sx = Math.max(x0, seg.x);
      const ex = Math.min(x1, seg.x + seg.w);
      if (ex <= sx) continue;

      // asphalt with a subtle top sheen
      const ag = ctx.createLinearGradient(0, gy, 0, gy + 130);
      ag.addColorStop(0, '#332a4d');
      ag.addColorStop(1, '#1e1832');
      ctx.fillStyle = ag;
      ctx.fillRect(sx, gy, ex - sx, depth);
      if (thick) {
        // slab underside lip over the tunnels below
        ctx.fillStyle = '#0e0914';
        ctx.fillRect(sx, gy + thick - 8, ex - sx, 8);
      }
      // sidewalk band
      const wx = Math.max(sx, beachEnd);
      if (ex > wx) {
        ctx.fillStyle = '#3d3358';
        ctx.fillRect(wx, gy, ex - wx, 14);
        ctx.fillStyle = 'rgba(255,110,180,0.2)';
        ctx.fillRect(wx, gy, ex - wx, 3);
        // lane dashes
        ctx.fillStyle = 'rgba(230,220,250,0.16)';
        for (let lx = Math.max(Math.floor(sx / 90) * 90, beachEnd); lx < ex; lx += 90) {
          ctx.fillRect(lx, gy + 56, 38, 5);
        }
        // crosswalks
        ctx.fillStyle = 'rgba(230,220,250,0.08)';
        for (let cw = Math.max(Math.floor(sx / 760) * 760, beachEnd); cw < ex; cw += 760) {
          for (let i = 0; i < 5; i++) ctx.fillRect(cw + i * 16, gy + 18, 9, 30);
        }
        // manhole covers
        for (let mx = Math.max(Math.floor(sx / 470) * 470 + 230, beachEnd); mx < ex; mx += 470) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(mx, gy + 40, 15, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.07)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // wet-street neon reflections below each building sign
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.data.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.style === 'spire') continue;
      const rg = ctx.createLinearGradient(0, gy + 8, 0, gy + 116);
      rg.addColorStop(0, `hsla(${b.hue}, 90%, 60%, 0.12)`);
      rg.addColorStop(1, `hsla(${b.hue}, 90%, 60%, 0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(b.x - 30, gy + 8, b.w + 60, Math.min(108, depth - 12));
    }
    ctx.globalCompositeOperation = 'source-over';

    // beach sand
    if (beachEnd > 0 && x0 < beachEnd) {
      const sg = ctx.createLinearGradient(0, gy, 0, gy + 140);
      sg.addColorStop(0, '#8a6f70');
      sg.addColorStop(1, '#544054');
      ctx.fillStyle = sg;
      ctx.fillRect(x0, gy, Math.min(beachEnd, x1) - x0, depth);
      ctx.fillStyle = 'rgba(255,190,150,0.22)';
      ctx.fillRect(x0, gy, Math.min(beachEnd, x1) - x0, 4);
      ctx.fillStyle = 'rgba(255,230,210,0.3)';
      for (let sx = 40; sx < beachEnd; sx += 113) {
        if (sx > x0 && sx < x1) ctx.fillRect(sx, gy + 26 + (sx % 37), 4, 2);
      }
      // sand speckle
      ctx.fillStyle = 'rgba(255,235,205,0.1)';
      for (let px = Math.max(0, Math.floor(x0 / 17) * 17); px < Math.min(beachEnd, x1); px += 17) {
        ctx.fillRect(px + ((px * 7919) % 13), gy + 8 + ((px * 104729) % 96), 2, 2);
      }
    }
  }

  // Everglades hummocks: peat banks capped with sawgrass fringe.
  drawMarsh(ctx, cam, x0, x1) {
    const gy = this.groundY;
    const depth = cam.viewH + 240;
    for (const seg of this.groundSegs) {
      const sx = Math.max(x0, seg.x);
      const ex = Math.min(x1, seg.x + seg.w);
      if (ex <= sx) continue;
      const pg = ctx.createLinearGradient(0, gy, 0, gy + 180);
      pg.addColorStop(0, '#31402a');
      pg.addColorStop(0.12, '#26301f');
      pg.addColorStop(1, '#141a10');
      ctx.fillStyle = pg;
      ctx.fillRect(sx, gy, ex - sx, depth);
      // mossy top band
      ctx.fillStyle = '#48633a';
      ctx.fillRect(sx, gy, ex - sx, 7);
      ctx.fillStyle = 'rgba(150,200,110,0.25)';
      ctx.fillRect(sx, gy, ex - sx, 2.5);
      // grass tufts along the lip
      ctx.strokeStyle = '#3c5430';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let tx = Math.max(seg.x, Math.floor(sx / 26) * 26); tx < ex; tx += 26) {
        const h = 10 + ((tx * 7919) % 14);
        ctx.beginPath();
        ctx.moveTo(tx, gy + 2);
        ctx.quadraticCurveTo(tx + 3, gy - h * 0.6, tx + 6, gy - h);
        ctx.stroke();
      }
      // peat speckle
      ctx.fillStyle = 'rgba(120,150,90,0.08)';
      for (let px = Math.max(seg.x, Math.floor(sx / 23) * 23); px < ex; px += 23) {
        ctx.fillRect(px + ((px * 104729) % 11), gy + 14 + ((px * 7919) % 110), 3, 2);
      }
      // waterline stain at the bank edges
      ctx.fillStyle = 'rgba(20,40,45,0.5)';
      ctx.fillRect(sx, gy + 26, ex - sx, 5);
    }
  }

  // Darkness pass, drawn in screen space after the world: dark zones with
  // soft light holes around the crow, lamps, claimed perches, and pickups.
  drawDarkness(ctx, cam, player, cssW, cssH) {
    if (!this.darkZones.length) return;
    let any = false;
    for (const z of this.darkZones) {
      if (z.x < cam.x + cam.viewW && z.x + z.w > cam.x && z.y < cam.y + cam.viewH && z.y + z.h > cam.y) {
        any = true;
        break;
      }
    }
    if (!any) return;

    const RES = 0.5;
    const w = Math.ceil(cssW * RES);
    const h = Math.ceil(cssH * RES);
    if (!this._dark || this._dark.width !== w || this._dark.height !== h) {
      this._dark = document.createElement('canvas');
      this._dark.width = w;
      this._dark.height = h;
    }
    const d = this._dark.getContext('2d');
    d.clearRect(0, 0, w, h);
    const s = cam.scale * RES;
    const toX = (wx) => (wx - cam.x) * s;
    const toY = (wy) => (wy - cam.y) * s;

    d.fillStyle = 'rgba(4,2,10,0.88)';
    for (const z of this.darkZones) {
      d.fillRect(toX(z.x), toY(z.y), z.w * s, z.h * s);
    }

    d.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, wr) => {
      const r = Math.max(wr * s, 4);
      const g = d.createRadialGradient(toX(wx), toY(wy), r * 0.15, toX(wx), toY(wy), r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath();
      d.arc(toX(wx), toY(wy), r, 0, Math.PI * 2);
      d.fill();
    };
    if (player && player.dead <= 0) hole(player.x, player.y, 320);
    for (const z of this.darkZones) {
      for (const l of z.lights || []) hole(l.x, l.y, l.r);
    }
    for (const c of this.checkpoints) if (c.active) hole(c.x, c.y - 40, 190);
    for (const p of this.pickups) if (!p.got) hole(p.x, p.y, 170);
    d.globalCompositeOperation = 'source-over';

    ctx.drawImage(this._dark, 0, 0, cssW, cssH);
  }
}

// ------------------------------------------------ building facades

function renderBuilding(b, groundY) {
  const PAD = 12;
  const c = document.createElement('canvas');
  c.width = b.w + PAD * 2;
  c.height = b.h + PAD * 2;
  const ctx = c.getContext('2d');
  ctx.translate(PAD, PAD);
  const rand = rng(b.x * 7 + b.w);
  const hue = b.hue;

  // facade
  const fg = ctx.createLinearGradient(0, 0, 0, b.h);
  fg.addColorStop(0, `hsl(${hue}, 26%, 17%)`);
  fg.addColorStop(1, `hsl(${hue}, 30%, 9%)`);
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, b.w, b.h);

  // side shading for depth
  const side = ctx.createLinearGradient(0, 0, b.w, 0);
  side.addColorStop(0, 'rgba(255,255,255,0.05)');
  side.addColorStop(0.15, 'rgba(255,255,255,0)');
  side.addColorStop(0.85, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, b.w, b.h);

  if (b.style === 'deco') {
    ctx.fillStyle = `hsl(${hue}, 30%, 22%)`;
    ctx.fillRect(b.w * 0.5 - 9, 0, 18, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fillRect(b.w * 0.14, 0, 5, b.h);
    ctx.fillRect(b.w * 0.86 - 5, 0, 5, b.h);
  }

  if (b.muralArt) {
    paintMuralFacade(ctx, b, rand);
  } else {
    // windows: lit ones bleed light, dark ones reflect the sky
    const litHues = [45, 45, 45, 185, 320];
    const halos = [];
    for (let wy = 30; wy < b.h - 26; wy += 34) {
      for (let wx = 15; wx < b.w - 28; wx += 27) {
        if (b.style === 'deco' && wx > b.w * 0.5 - 22 && wx < b.w * 0.5 + 4) continue;
        const lit = rand() < 0.36;
        if (lit) {
          const lh = litHues[Math.floor(rand() * litHues.length)];
          ctx.fillStyle = `hsla(${lh}, 90%, ${62 + rand() * 16}%, ${0.5 + rand() * 0.4})`;
          halos.push([wx + 7.5, wy + 10.5, lh]);
        } else {
          const rg = ctx.createLinearGradient(0, wy, 0, wy + 21);
          rg.addColorStop(0, 'rgba(96,74,138,0.55)');
          rg.addColorStop(0.45, 'rgba(30,24,52,0.85)');
          rg.addColorStop(1, 'rgba(10,12,22,0.9)');
          ctx.fillStyle = rg;
        }
        ctx.fillRect(wx, wy, 15, 21);
        if (lit && rand() < 0.4) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(wx, wy + 9, 15, 2);
        }
        // sill catches the sky; grime washes down from some of them
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(wx - 1.5, wy + 21, 18, 1.6);
        if (rand() < 0.22) {
          const gg = ctx.createLinearGradient(0, wy + 22, 0, wy + 33);
          gg.addColorStop(0, 'rgba(0,0,0,0.18)');
          gg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gg;
          ctx.fillRect(wx + 1, wy + 22, 13, 11);
        }
        // the odd window unit humming under a sill
        if (rand() < 0.1) {
          ctx.fillStyle = `hsl(${hue}, 8%, 13%)`;
          ctx.fillRect(wx + 2, wy + 14, 11, 8);
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.beginPath();
          ctx.arc(wx + 7.5, wy + 18, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // floor ledges: a shadow line under every window row
    for (let wy = 30; wy < b.h - 26; wy += 34) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(0, wy + 24, b.w, 2.4);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fillRect(0, wy + 22.8, b.w, 1.2);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const [hx, hy, lh] of halos) {
      const hg = ctx.createRadialGradient(hx, hy, 2, hx, hy, 26);
      hg.addColorStop(0, `hsla(${lh}, 90%, 70%, 0.16)`);
      hg.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      ctx.fillStyle = hg;
      ctx.fillRect(hx - 26, hy - 26, 52, 52);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // baked ambient occlusion: parapet shadow and base grime
  const aoTop = ctx.createLinearGradient(0, 0, 0, 34);
  aoTop.addColorStop(0, 'rgba(0,0,0,0.34)');
  aoTop.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aoTop;
  ctx.fillRect(0, 0, b.w, 34);
  const aoBase = ctx.createLinearGradient(0, b.h - 70, 0, b.h);
  aoBase.addColorStop(0, 'rgba(0,0,0,0)');
  aoBase.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = aoBase;
  ctx.fillRect(0, b.h - 70, b.w, 70);

  // parapet
  ctx.fillStyle = `hsl(${hue}, 24%, 24%)`;
  ctx.fillRect(-4, -2, b.w + 8, 12);

  // deco crown: a chevron frieze under the parapet
  if (b.style === 'deco') {
    ctx.strokeStyle = `hsla(${hue}, 42%, 42%, 0.55)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const cw = 14;
    for (let cx2 = 8; cx2 + cw < b.w - 8; cx2 += cw) {
      ctx.moveTo(cx2, 24);
      ctx.lineTo(cx2 + cw / 2, 17);
      ctx.lineTo(cx2 + cw, 24);
    }
    ctx.stroke();
  }

  // neon trim: parapet edge + corners, layered for glow
  const neon = `hsl(${hue}, 95%, 64%)`;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `hsla(${hue}, 95%, 64%, 0.28)`;
  ctx.lineWidth = 7;
  neonPath(ctx, b);
  ctx.strokeStyle = neon;
  ctx.lineWidth = 2;
  neonPath(ctx, b);
  ctx.globalCompositeOperation = 'source-over';

  // vertical blade sign (the Colony's blue neon, and friends)
  if (b.blade) {
    const word = b.blade;
    const bx = b.w * 0.16;
    const bh = Math.min(b.h - 60, word.length * 42 + 30);
    b.signY = 60;
    ctx.fillStyle = '#141021';
    ctx.fillRect(bx - 17, 26, 34, bh);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `hsla(${b.hue}, 95%, 62%, 0.3)`;
    ctx.lineWidth = 6;
    ctx.strokeRect(bx - 17, 26, 34, bh);
    ctx.strokeStyle = `hsl(${b.hue}, 95%, 66%)`;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(bx - 17, 26, 34, bh);
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '800 28px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < word.length; i++) {
      const ly = 62 + i * 42;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `hsla(${b.hue}, 95%, 66%, 0.4)`;
      ctx.fillText(word[i], bx, ly + 1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `hsl(${b.hue}, 100%, 80%)`;
      ctx.fillText(word[i], bx, ly);
    }
  }

  // sign near the top
  if (b.sign) {
    const signY = b.style === 'tower' ? 74 : 44;
    b.signY = signY;
    const size = Math.min(30, ((b.w - 30) / b.sign.length) * 1.55);
    ctx.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `hsla(${hue}, 95%, 66%, 0.34)`;
    ctx.fillText(b.sign, b.w / 2, signY + 2);
    ctx.fillText(b.sign, b.w / 2, signY + 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `hsl(${hue}, 100%, 78%)`;
    ctx.fillText(b.sign, b.w / 2, signY);
  }

  // rooftop clutter silhouettes
  ctx.fillStyle = 'hsl(260, 15%, 12%)';
  if (b.style !== 'spire') {
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const cx = 20 + rand() * (b.w - 60);
      const kind = rand();
      if (kind < 0.4) ctx.fillRect(cx, -26, 34, 26);
      else if (kind < 0.7) { ctx.fillRect(cx, -44, 4, 44); ctx.fillRect(cx - 7, -44, 18, 3); }
      else { ctx.beginPath(); ctx.arc(cx, -10, 12, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - 12, -10, 24, 10); }
    }
  }

  if (b.style === 'spire') {
    // stopped clock face: frozen since the hurricane
    ctx.fillStyle = 'rgba(240,235,255,0.14)';
    ctx.beginPath();
    ctx.arc(b.w / 2, 54, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `hsl(${hue}, 80%, 66%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.w / 2, 54, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(240,235,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(b.w / 2, 54);
    ctx.lineTo(b.w / 2 + 9, 47);
    ctx.moveTo(b.w / 2, 54);
    ctx.lineTo(b.w / 2 - 4, 42);
    ctx.stroke();
  }

  return c;
}

// Bold Wynwood-style painted facade: color bands, a sun, waves, a flock.
function paintMuralFacade(ctx, b, rand) {
  const w = b.w;
  const h = b.h;
  const base = Math.floor(rand() * 360);
  const bands = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = `hsla(${(base + i * 42) % 360}, 68%, ${30 + i * 7}%, 0.92)`;
    ctx.fillRect(0, (h / bands) * i, w, h / bands + 2);
  }
  const sx = w * (0.3 + rand() * 0.4);
  const sy = h * (0.22 + rand() * 0.18);
  const sr = Math.min(w, h) * 0.2;
  ctx.fillStyle = `hsla(${(base + 180) % 360}, 85%, 62%, 0.95)`;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(sx, sy, sr + 12, 0, Math.PI * 2);
  ctx.stroke();
  // large overlapping color discs behind the waves
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `hsla(${(base + 120 + i * 60) % 360}, 75%, 60%, 0.35)`;
    ctx.beginPath();
    ctx.arc(w * (0.18 + rand() * 0.64), h * (0.42 + rand() * 0.3), Math.min(w, h) * (0.1 + rand() * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = `hsla(${(base + 90) % 360}, 80%, 72%, 0.8)`;
  ctx.lineCap = 'round';
  for (let row = 0; row < 3; row++) {
    const wy = h * (0.6 + row * 0.12) + rand() * 14;
    const amp = 11 + row * 5 + rand() * 6;
    const step = 30 + row * 8;
    const off = rand() * step;
    ctx.lineWidth = 6 + row * 1.5;
    ctx.beginPath();
    ctx.moveTo(-step + off, wy);
    for (let x = -step + off; x < w + step; x += step) {
      ctx.quadraticCurveTo(x + step * 0.25, wy - amp, x + step * 0.5, wy);
      ctx.quadraticCurveTo(x + step * 0.75, wy + amp, x + step, wy);
    }
    ctx.stroke();
  }
  // one big painted bird mid-wall
  const bigX = w * (0.4 + rand() * 0.2);
  const bigY = h * 0.52;
  const bigS = Math.min(w, h) * 0.17;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(bigX - bigS, bigY);
  ctx.quadraticCurveTo(bigX - bigS * 0.3, bigY - bigS * 0.85, bigX, bigY);
  ctx.quadraticCurveTo(bigX + bigS * 0.3, bigY - bigS * 0.85, bigX + bigS, bigY);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,14,28,0.85)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 9; i++) {
    const bx = w * (0.12 + rand() * 0.76);
    const by = h * (0.08 + rand() * 0.38);
    const s = 6 + rand() * 10;
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.quadraticCurveTo(bx - s * 0.3, by - s * 0.7, bx, by);
    ctx.quadraticCurveTo(bx + s * 0.3, by - s * 0.7, bx + s, by);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(15,10,22,0.25)';
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(rand() * w, h * (0.3 + rand() * 0.5), 3, 12 + rand() * 30);
  }
}

function neonPath(ctx, b) {
  ctx.beginPath();
  ctx.moveTo(-3, 10);
  ctx.lineTo(-3, -1);
  ctx.lineTo(b.w + 3, -1);
  ctx.lineTo(b.w + 3, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, 10);
  ctx.lineTo(2, Math.min(b.h, 240));
  ctx.moveTo(b.w - 2, 10);
  ctx.lineTo(b.w - 2, Math.min(b.h, 240));
  ctx.stroke();
}

// ------------------------------------------------ structure blocks

function drawBlock(ctx, s, t, player) {
  if (s.kind === 'steel') { drawSteel(ctx, s); return; }
  if (s.kind === 'shutter') { drawShutterWall(ctx, s); return; }
  if (s.kind === 'crate') { drawCrateBlock(ctx, s); return; }
  if (s.kind === 'container') { drawContainer(ctx, s); return; }
  if (s.kind === 'fence') { drawFence(ctx, s); return; }
  if (s.kind === 'cart') { drawCart(ctx, s); return; }
  if (s.kind === 'concrete') { drawConcrete(ctx, s); return; }
  if (s.kind === 'barge') { drawBarge(ctx, s, t); return; }
  if (s.kind === 'trunk') { drawTrunk(ctx, s); return; }
  if (s.kind === 'canopy') { drawCanopy(ctx, s); return; }
  if (s.kind === 'root') { drawRoot(ctx, s); return; }
  if (s.kind === 'theaterfacade') { drawTheaterFacade(ctx, s, t); return; }
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  g.addColorStop(0, '#3a2a33');
  g.addColorStop(1, '#241a24');
  ctx.fillStyle = g;
  ctx.fillRect(s.x, s.y, s.w, s.h);

  // mortar rows + offset brick joints
  ctx.strokeStyle = 'rgba(12,8,16,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let row = 0;
  for (let y = s.y + 18; y < s.y + s.h; y += 18) {
    ctx.moveTo(s.x, y);
    ctx.lineTo(s.x + s.w, y);
  }
  for (let y = s.y; y < s.y + s.h; y += 18, row++) {
    for (let bx = s.x + ((row % 2) * 16) + 8; bx < s.x + s.w - 4; bx += 32) {
      ctx.moveTo(bx, y + 2);
      ctx.lineTo(bx, Math.min(y + 16, s.y + s.h));
    }
  }
  ctx.stroke();

  // slime patches
  const rand = rng(s.x * 13 + s.y);
  ctx.fillStyle = 'rgba(70,160,120,0.13)';
  const patches = Math.max(2, (s.w * s.h) / 12000);
  for (let i = 0; i < patches; i++) {
    ctx.beginPath();
    ctx.ellipse(s.x + rand() * s.w, s.y + rand() * s.h, 12 + rand() * 18, 7 + rand() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // per-brick tonal variation, snapped to the mortar grid (bounded count)
  const tones = Math.max(3, (s.w * s.h) / 9000);
  for (let i = 0; i < tones; i++) {
    const trow = Math.floor(rand() * (s.h / 18));
    const tcol = Math.floor(rand() * (s.w / 32));
    const bx = s.x + tcol * 32 + ((trow % 2) * 16) + 8;
    const by = s.y + trow * 18 + 2;
    if (bx + 24 > s.x + s.w || by + 14 > s.y + s.h) continue;
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(8,5,12,0.16)';
    ctx.fillRect(bx, by, 24, 14);
  }

  // the drains stay damp: a wet sheen creeping up from the base
  if (s.h > 60) {
    const damp = ctx.createLinearGradient(0, s.y + s.h - 44, 0, s.y + s.h);
    damp.addColorStop(0, 'rgba(20,40,44,0)');
    damp.addColorStop(1, 'rgba(20,40,44,0.3)');
    ctx.fillStyle = damp;
    ctx.fillRect(s.x, s.y + s.h - 44, s.w, 44);
  }

  // ink edge holds the block together against busy neighbors
  ctx.strokeStyle = 'rgba(6,4,12,0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(s.x + 0.75, s.y + 0.75, s.w - 1.5, s.h - 1.5);

  // top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(s.x, s.y, s.w, 3);

  if (s.breakable) {
    // crack webs spaced down the wall so tall bulkheads read as damaged
    ctx.strokeStyle = 'rgba(240,225,215,0.45)';
    ctx.lineWidth = 1.8;
    const webs = Math.max(1, Math.round(s.h / 240));
    ctx.beginPath();
    for (let wIdx = 0; wIdx < webs; wIdx++) {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h * ((wIdx + 0.6) / (webs + 0.2));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.5 + wIdx;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * s.w * 0.42, cy + Math.sin(a) * Math.min(s.h * 0.18, 70));
        ctx.lineTo(cx + Math.cos(a + 0.35) * s.w * 0.55, cy + Math.sin(a + 0.3) * Math.min(s.h * 0.24, 100));
      }
    }
    ctx.stroke();
    // amber pulse once the crow can smash it
    if (player?.abilities.break) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,157,94,${0.25 + Math.sin(t * 4) * 0.15})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

function drawBackdrop(ctx, z) {
  if (z.style === 'gallery') {
    // warm gallery interior with framed art and track lights
    const g = ctx.createLinearGradient(0, z.y, 0, z.y + z.h);
    g.addColorStop(0, '#3b3046');
    g.addColorStop(1, '#2a2136');
    ctx.fillStyle = g;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    const rand = rng(z.x * 3 + 11);
    for (let fx = z.x + 60; fx < z.x + z.w - 120; fx += 150 + rand() * 90) {
      const fw = 60 + rand() * 50;
      const fh = 46 + rand() * 40;
      const fy = z.y + 40 + rand() * (z.h - fh - 120);
      ctx.fillStyle = '#1c1626';
      ctx.fillRect(fx - 4, fy - 4, fw + 8, fh + 8);
      ctx.fillStyle = `hsl(${Math.floor(rand() * 360)}, 45%, 38%)`;
      ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = `hsla(${Math.floor(rand() * 360)}, 60%, 60%, 0.5)`;
      ctx.beginPath();
      ctx.ellipse(fx + fw * (0.3 + rand() * 0.4), fy + fh * 0.5, fw * 0.22, fh * 0.3, rand(), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,14,30,0.9)';
    ctx.fillRect(z.x, z.y + 14, z.w, 6);
    for (let lx = z.x + 90; lx < z.x + z.w; lx += 180) {
      ctx.fillStyle = '#2a2136';
      ctx.fillRect(lx - 3, z.y + 20, 6, 10);
      const lg = ctx.createRadialGradient(lx, z.y + 34, 2, lx, z.y + 34, 60);
      lg.addColorStop(0, 'rgba(255,230,180,0.16)');
      lg.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, z.y + 34, 60, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (z.style === 'ship') {
    // mothership interior: dark hull, ribs, glow strips, and portholes
    // full of stars (and one of Miami, far below)
    const g = ctx.createLinearGradient(0, z.y, 0, z.y + z.h);
    g.addColorStop(0, '#101a16');
    g.addColorStop(0.5, '#16241e');
    g.addColorStop(1, '#0c1410');
    ctx.fillStyle = g;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    // ribs
    ctx.strokeStyle = 'rgba(60,110,80,0.35)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    for (let rx = z.x + 120; rx < z.x + z.w; rx += 300) {
      ctx.moveTo(rx, z.y);
      ctx.quadraticCurveTo(rx + 26, z.y + z.h / 2, rx, z.y + z.h);
    }
    ctx.stroke();
    // running glow strips
    for (const sy of [z.y + z.h * 0.22, z.y + z.h * 0.72]) {
      ctx.fillStyle = 'rgba(125,255,106,0.14)';
      ctx.fillRect(z.x, sy, z.w, 4);
    }
    // portholes
    for (let px = z.x + 210; px < z.x + z.w - 120; px += 420) {
      ctx.fillStyle = '#05070c';
      ctx.beginPath();
      ctx.arc(px, z.y + z.h * 0.4, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(125,255,106,0.4)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let s = 0; s < 5; s++) {
        ctx.fillRect(px - 22 + ((px * 13 + s * 29) % 44), z.y + z.h * 0.4 - 22 + ((px * 7 + s * 41) % 44), 1.6, 1.6);
      }
      // one porthole looks down on the neon grid
      if (((px / 420) | 0) % 3 === 1) {
        ctx.fillStyle = 'rgba(90,26,94,0.8)';
        ctx.beginPath();
        ctx.arc(px, z.y + z.h * 0.4 + 10, 20, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,79,163,0.5)';
        for (let s = 0; s < 6; s++) ctx.fillRect(px - 15 + s * 5.4, z.y + z.h * 0.4 + 12 + (s % 3) * 4, 3, 1.4);
      }
    }
    return;
  }
  if (z.style === 'theater') {
    // stage house: boards, tall crimson curtains, catwalks, work lights
    const g = ctx.createLinearGradient(0, z.y, 0, z.y + z.h);
    g.addColorStop(0, '#241522');
    g.addColorStop(1, '#170d16');
    ctx.fillStyle = g;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    // back curtain with vertical folds
    const ch = z.h * 0.66;
    const cg = ctx.createLinearGradient(0, z.y + z.h - ch, 0, z.y + z.h);
    cg.addColorStop(0, '#5a1626');
    cg.addColorStop(1, '#38101c');
    ctx.fillStyle = cg;
    ctx.fillRect(z.x + 20, z.y + z.h - ch, z.w - 40, ch);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let fx = z.x + 34; fx < z.x + z.w - 30; fx += 26) {
      ctx.fillRect(fx, z.y + z.h - ch, 9, ch);
    }
    ctx.fillStyle = 'rgba(255,190,120,0.1)';
    for (let fx = z.x + 26; fx < z.x + z.w - 30; fx += 26) {
      ctx.fillRect(fx, z.y + z.h - ch, 3, ch);
    }
    // fly catwalks
    ctx.strokeStyle = 'rgba(120,110,140,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const cy of [z.y + 60, z.y + 150]) {
      ctx.moveTo(z.x + 12, cy);
      ctx.lineTo(z.x + z.w - 12, cy);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,80,110,0.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let lx = z.x + 50; lx < z.x + z.w; lx += 90) {
      ctx.moveTo(lx, z.y);
      ctx.lineTo(lx, z.y + 150);
    }
    ctx.stroke();
    // work lights
    for (let lx = z.x + 90; lx < z.x + z.w - 40; lx += 200) {
      ctx.fillStyle = '#3a2a20';
      ctx.fillRect(lx - 4, z.y + 152, 8, 10);
      const lg = ctx.createRadialGradient(lx, z.y + 170, 3, lx, z.y + 170, 80);
      lg.addColorStop(0, 'rgba(255,200,130,0.22)');
      lg.addColorStop(1, 'rgba(255,200,130,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, z.y + 170, 80, 0, Math.PI * 2);
      ctx.fill();
    }
    // sandbag counterweights
    ctx.fillStyle = '#33241f';
    for (let sx = z.x + 70; sx < z.x + z.w; sx += 260) {
      ctx.fillRect(sx, z.y + 190, 12, 22);
      ctx.strokeStyle = 'rgba(120,110,140,0.3)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx + 6, z.y + 150);
      ctx.lineTo(sx + 6, z.y + 190);
      ctx.stroke();
    }
    return;
  }
  if (z.style === 'workshop') {
    // corrugated workshop interior with a tool wall and tarps
    const g = ctx.createLinearGradient(0, z.y, 0, z.y + z.h);
    g.addColorStop(0, '#2c2836');
    g.addColorStop(1, '#201c2a');
    ctx.fillStyle = g;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let lx = z.x + 24; lx < z.x + z.w; lx += 26) {
      ctx.moveTo(lx, z.y);
      ctx.lineTo(lx, z.y + z.h);
    }
    ctx.stroke();
    const rand = rng(z.x * 5 + 3);
    ctx.fillStyle = 'rgba(120,110,140,0.2)';
    for (let i = 0; i < 6; i++) {
      const tx = z.x + 40 + rand() * (z.w - 120);
      ctx.fillRect(tx, z.y + 40 + rand() * 40, 3 + rand() * 26, 8 + rand() * 30);
    }
    ctx.fillStyle = 'rgba(90,150,180,0.14)';
    ctx.beginPath();
    ctx.moveTo(z.x + z.w * 0.62, z.y + z.h);
    ctx.quadraticCurveTo(z.x + z.w * 0.68, z.y + z.h - 90, z.x + z.w * 0.76, z.y + z.h);
    ctx.fill();
    return;
  }
  const g = ctx.createLinearGradient(0, z.y, 0, z.y + z.h);
  g.addColorStop(0, '#1c1322');
  g.addColorStop(1, '#120b16');
  ctx.fillStyle = g;
  ctx.fillRect(z.x, z.y, z.w, z.h + 400);

  // faint tunnel arches
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 26;
  for (let x = z.x + 220; x < z.x + z.w; x += 420) {
    ctx.beginPath();
    ctx.arc(x, z.y + z.h, z.h * 0.72, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // background conduit runs along the ceiling
  ctx.fillStyle = 'rgba(90,80,110,0.16)';
  ctx.fillRect(z.x, z.y + 30, z.w, 13);
  ctx.fillRect(z.x, z.y + 52, z.w, 7);
}

function drawSteel(ctx, s) {
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  g.addColorStop(0, '#4a4458');
  g.addColorStop(1, '#332e42');
  ctx.fillStyle = g;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = 'rgba(12,8,20,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (s.w >= s.h) {
    for (let y = s.y + 10; y < s.y + s.h; y += 12) {
      ctx.moveTo(s.x, y);
      ctx.lineTo(s.x + s.w, y);
    }
  } else {
    for (let x = s.x + 10; x < s.x + s.w; x += 12) {
      ctx.moveTo(x, s.y);
      ctx.lineTo(x, s.y + s.h);
    }
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(s.x, s.y, s.w, 3);
}

function drawShutterWall(ctx, s) {
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  g.addColorStop(0, '#5a5468');
  g.addColorStop(1, '#3d3850');
  ctx.fillStyle = g;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = 'rgba(14,10,22,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = s.y + 8; y < s.y + s.h; y += 10) {
    ctx.moveTo(s.x, y);
    ctx.lineTo(s.x + s.w, y);
  }
  ctx.stroke();
  // bottom rail with handle: reads as a half-open rolling door
  ctx.fillStyle = '#171226';
  ctx.fillRect(s.x - 3, s.y + s.h - 8, s.w + 6, 8);
  ctx.fillStyle = '#8d83a3';
  ctx.fillRect(s.x + s.w / 2 - 8, s.y + s.h - 5, 16, 3);
}

function drawCrateBlock(ctx, s) {
  ctx.fillStyle = '#5a4432';
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = 'rgba(20,12,8,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x + s.w, s.y + s.h);
  ctx.moveTo(s.x + s.w, s.y);
  ctx.lineTo(s.x, s.y + s.h);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(s.x, s.y, s.w, 3);
}

function drawContainer(ctx, s) {
  const hue = s.hue ?? 15;
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  g.addColorStop(0, `hsl(${hue}, 45%, 34%)`);
  g.addColorStop(1, `hsl(${hue}, 45%, 22%)`);
  ctx.fillStyle = g;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = 'rgba(10,8,16,0.4)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = s.x + 12; x < s.x + s.w - 6; x += 14) {
    ctx.moveTo(x, s.y + 5);
    ctx.lineTo(x, s.y + s.h - 5);
  }
  ctx.stroke();
  ctx.strokeStyle = `hsl(${hue}, 40%, 16%)`;
  ctx.lineWidth = 3;
  ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(s.x, s.y, s.w, 3);
}

function drawMural(ctx, m, t, hasGrip) {
  const w = 14;
  const x = m.dir === 1 ? m.x : m.x - w;
  const rand = rng(m.x * 7 + m.y0);
  let y = m.y0;
  while (y < m.y1) {
    const bh = 40 + rand() * 90;
    ctx.fillStyle = m.style === 'moss'
      ? `hsla(${95 + Math.floor(rand() * 60)}, 48%, ${26 + rand() * 16}%, 0.92)`
      : `hsla(${Math.floor(rand() * 360)}, 75%, ${45 + rand() * 20}%, 0.85)`;
    ctx.fillRect(x, y, w, Math.min(bh, m.y1 - y));
    if (rand() < 0.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(x + w * (0.3 + rand() * 0.4), y + bh * 0.4, 3 + rand() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    y += bh;
  }
  // paint drips at the bottom edge
  ctx.fillStyle = 'rgba(20,14,28,0.35)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + 2 + i * 3.4, m.y1 - 4, 2, 4 + rand() * 8);
  }
  if (hasGrip) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(99,230,164,${0.3 + Math.sin(t * 3) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(m.dir === 1 ? m.x : m.x - 1, m.y0);
    ctx.lineTo(m.dir === 1 ? m.x : m.x - 1, m.y1);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawHook(ctx, hk, t, hasAbility) {
  if (hk.pinata) {
    drawPinata(ctx, hk, t, hasAbility);
    return;
  }
  const top = hk.top ?? hk.y - 240;
  // chain
  ctx.strokeStyle = '#3a3450';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hk.x, top);
  ctx.lineTo(hk.x, hk.y - 10);
  ctx.stroke();
  ctx.fillStyle = '#4a4462';
  for (let y = top + 8; y < hk.y - 12; y += 16) {
    ctx.beginPath();
    ctx.ellipse(hk.x, y, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // the hook itself
  ctx.strokeStyle = hasAbility ? '#d9b8ff' : '#6a5f8a';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hk.x, hk.y - 12);
  ctx.lineTo(hk.x, hk.y + 2);
  ctx.arc(hk.x - 7, hk.y + 2, 7, 0, Math.PI * 0.85);
  ctx.stroke();
  if (hasAbility && !hk.held) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(hk.x, hk.y, 2, hk.x, hk.y, 26);
    g.addColorStop(0, `rgba(217,184,255,${0.2 + Math.sin(t * 2.6 + hk.x) * 0.1})`);
    g.addColorStop(1, 'rgba(217,184,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hk.x, hk.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------ entity drawing

function drawPlatform(ctx, p, t) {
  if (p.type === 'awning') {
    const stripes = ['#ff4fa3', '#f4f0ff'];
    for (let i = 0; i < p.w; i += 18) {
      ctx.fillStyle = stripes[(i / 18) % 2 | 0];
      ctx.globalAlpha = 0.8;
      ctx.fillRect(p.x + i, p.y, Math.min(18, p.w - i), 10);
    }
    ctx.globalAlpha = 1;
    for (let i = 9; i < p.w; i += 18) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(p.x + i, p.y + 10, 9, 0, Math.PI);
      ctx.fill();
    }
  } else if (p.type === 'billboard') {
    ctx.strokeStyle = '#2c2440';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x + 14, p.y + 10);
    ctx.lineTo(p.x + 14, p.y + 74);
    ctx.moveTo(p.x + p.w - 14, p.y + 10);
    ctx.lineTo(p.x + p.w - 14, p.y + 74);
    ctx.stroke();
    ctx.fillStyle = '#171226';
    ctx.fillRect(p.x, p.y + 10, p.w, 46);
    ctx.strokeStyle = 'rgba(53,224,224,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 2, p.y + 12, p.w - 4, 42);
    if (p.text) {
      ctx.font = `800 ${Math.min(20, (p.w - 26) / p.text.length * 1.7)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const hue = p.hue ?? 185;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `hsla(${hue}, 95%, 66%, 0.4)`;
      ctx.fillText(p.text, p.x + p.w / 2, p.y + 40);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `hsl(${hue}, 100%, 80%)`;
      ctx.fillText(p.text, p.x + p.w / 2, p.y + 39);
    }
    ctx.fillStyle = '#3a3152';
    ctx.fillRect(p.x - 3, p.y, p.w + 6, 7);
  } else if (p.type === 'fireescape') {
    ctx.fillStyle = '#2e2745';
    ctx.fillRect(p.x, p.y, p.w, 5);
    ctx.strokeStyle = '#2e2745';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 4; i <= p.w - 4; i += 12) {
      ctx.moveTo(p.x + i, p.y - 16);
      ctx.lineTo(p.x + i, p.y);
    }
    ctx.moveTo(p.x, p.y - 16);
    ctx.lineTo(p.x + p.w, p.y - 16);
    ctx.stroke();
  } else if (p.type === 'ac') {
    ctx.fillStyle = '#33304a';
    ctx.fillRect(p.x, p.y, p.w, p.boxH || 40);
    ctx.fillStyle = '#221f36';
    for (let i = 6; i < p.w - 6; i += 9) ctx.fillRect(p.x + i, p.y + 8, 4, (p.boxH || 40) - 16);
    ctx.strokeStyle = 'rgba(120,235,235,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, (p.boxH || 40) - 1);
  } else if (p.type === 'antenna') {
    ctx.strokeStyle = '#453a63';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + p.w / 2, p.y);
    ctx.lineTo(p.x + p.w / 2, p.y + 140);
    ctx.moveTo(p.x + p.w / 2 - 16, p.y + 140);
    ctx.lineTo(p.x + p.w / 2, p.y + 90);
    ctx.moveTo(p.x + p.w / 2 + 16, p.y + 140);
    ctx.lineTo(p.x + p.w / 2, p.y + 90);
    ctx.stroke();
    ctx.fillStyle = '#3a3152';
    ctx.fillRect(p.x, p.y, p.w, 7);
    if (Math.sin(t * 2.4) > 0.55) {
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y - 8, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.type === 'hut') {
    ctx.strokeStyle = '#4a3a55';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(p.x + 12, p.y + 90);
    ctx.lineTo(p.x + 22, p.y + 34);
    ctx.moveTo(p.x + p.w - 12, p.y + 90);
    ctx.lineTo(p.x + p.w - 22, p.y + 34);
    ctx.stroke();
    ctx.fillStyle = '#c94f7c';
    ctx.fillRect(p.x + 8, p.y + 8, p.w - 16, 34);
    ctx.fillStyle = '#f4e3c2';
    ctx.fillRect(p.x + 8, p.y + 8, (p.w - 16) / 3, 34);
    ctx.fillStyle = 'rgba(12,10,24,0.8)';
    ctx.fillRect(p.x + p.w / 2 - 7, p.y + 16, 16, 18);
    ctx.fillStyle = '#35e0e0';
    ctx.fillRect(p.x - 4, p.y, p.w + 8, 8);
  } else if (p.type === 'pipe') {
    // fat sewer pipe, walkable on top
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + 22);
    g.addColorStop(0, '#4a4258');
    g.addColorStop(0.4, '#39324a');
    g.addColorStop(1, '#241f33');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(p.x - 4, p.y, p.w + 8, 22, 11);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(p.x - 2, p.y + 3, p.w + 4, 3);
    ctx.fillStyle = '#241f33';
    ctx.fillRect(p.x + 8, p.y - 2, 6, 26);
    ctx.fillRect(p.x + p.w - 14, p.y - 2, 6, 26);
  } else if (p.type === 'drum') {
    // conga drum: taut skin on top, tapered shell below
    const h = 46;
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + h);
    g.addColorStop(0, '#8a4a3a');
    g.addColorStop(1, '#4a2820');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 3);
    ctx.lineTo(p.x + p.w, p.y + 3);
    ctx.lineTo(p.x + p.w - 8, p.y + h);
    ctx.lineTo(p.x + 8, p.y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8dcc2';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + 3, p.w / 2, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const lx = p.x + 4 + ((p.w - 8) / 4) * i;
      ctx.moveTo(lx, p.y + 6);
      ctx.lineTo(p.x + 10 + ((p.w - 20) / 4) * i, p.y + h - 4);
    }
    ctx.stroke();
  } else if (p.type === 'rung') {
    ctx.fillStyle = '#4a4258';
    ctx.fillRect(p.x, p.y, p.w, 7);
    ctx.fillStyle = '#2a2440';
    ctx.fillRect(p.x + 4, p.y + 7, 5, 6);
    ctx.fillRect(p.x + p.w - 9, p.y + 7, 5, 6);
  } else if (p.type === 'deck') {
    // parking garage deck with support columns
    ctx.fillStyle = '#2a2440';
    ctx.fillRect(p.x + 26, p.y + 12, 7, 106);
    ctx.fillRect(p.x + p.w - 33, p.y + 12, 7, 106);
    ctx.fillStyle = '#413a5c';
    ctx.fillRect(p.x, p.y, p.w, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(p.x, p.y, p.w, 3);
    // guard rail
    ctx.strokeStyle = 'rgba(190,180,220,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + 2, p.y - 14);
    ctx.lineTo(p.x + p.w - 2, p.y - 14);
    for (let i = 8; i < p.w; i += 34) {
      ctx.moveTo(p.x + i, p.y - 14);
      ctx.lineTo(p.x + i, p.y);
    }
    ctx.stroke();
    // oil stains
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w * 0.35, p.y + 6, 16, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === 'busstop') {
    ctx.strokeStyle = '#453a63';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x + 10, p.y + 8);
    ctx.lineTo(p.x + 10, p.y + 110);
    ctx.moveTo(p.x + p.w - 10, p.y + 8);
    ctx.lineTo(p.x + p.w - 10, p.y + 110);
    ctx.stroke();
    // glass
    ctx.fillStyle = 'rgba(140,220,255,0.14)';
    ctx.fillRect(p.x + 12, p.y + 14, p.w - 24, 88);
    // bench
    ctx.fillStyle = '#3a3152';
    ctx.fillRect(p.x + 18, p.y + 78, p.w - 36, 6);
    // roof (the walkable part)
    ctx.fillStyle = '#35e0e0';
    ctx.fillRect(p.x - 5, p.y, p.w + 10, 8);
    ctx.fillStyle = 'rgba(11,6,20,0.85)';
    ctx.font = '800 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUS', p.x + p.w / 2, p.y + 7 + 0.5);
  } else {
    // plain ledge
    ctx.fillStyle = '#3a3152';
    ctx.fillRect(p.x, p.y, p.w, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(p.x, p.y + 9, p.w, 4);
  }
}

function drawCable(ctx, c, t, hasLaunch) {
  const sink = c.sinkT > 0 ? Math.sin(c.sinkT * 16) * c.sinkT * 46 : 0;
  const charge = c.chargeT > 0 ? 20 : 0;
  const sag = 17 + sink + charge;
  const midX = c.x + c.w / 2;

  ctx.strokeStyle = '#241f33';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.quadraticCurveTo(midX, c.y + sag * 2, c.x + c.w, c.y);
  ctx.stroke();
  ctx.strokeStyle = hasLaunch ? `rgba(164,242,107,${0.4 + Math.sin(t * 3.2) * 0.15})` : 'rgba(190,180,220,0.25)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y + 1);
  ctx.quadraticCurveTo(midX, c.y + 1 + sag * 2, c.x + c.w, c.y + 1);
  ctx.stroke();

  // end mounts
  ctx.fillStyle = '#453a63';
  ctx.fillRect(c.x - 6, c.y - 6, 8, 14);
  ctx.fillRect(c.x + c.w - 2, c.y - 6, 8, 14);
  // marker tags
  ctx.fillStyle = hasLaunch ? '#a4f26b' : '#6a5f8a';
  for (const u of [0.28, 0.72]) {
    const tx = c.x + c.w * u;
    const ty = c.y + sag * 2 * 4 * u * (1 - u) * 0.5 + 3;
    ctx.fillRect(tx - 2, ty, 4, 9);
  }
}

function drawVent(ctx, v, t) {
  const g = ctx.createLinearGradient(0, v.top, 0, v.base);
  g.addColorStop(0, 'rgba(150,200,255,0)');
  g.addColorStop(0.75, 'rgba(150,200,255,0.07)');
  g.addColorStop(1, 'rgba(150,200,255,0.14)');
  ctx.fillStyle = g;
  ctx.fillRect(v.x, v.top, v.w, v.base - v.top);
  ctx.strokeStyle = 'rgba(170,215,255,0.35)';
  ctx.lineWidth = 2;
  const span = v.base - v.top;
  for (let i = 0; i < 4; i++) {
    const yy = v.base - ((t * 130 + i * span / 4) % span);
    const k = (v.base - yy) / span;
    ctx.globalAlpha = 0.5 * (1 - k);
    ctx.beginPath();
    ctx.moveTo(v.x + 8, yy + 8);
    ctx.lineTo(v.x + v.w / 2, yy);
    ctx.lineTo(v.x + v.w - 8, yy + 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#33304a';
  ctx.fillRect(v.x - 5, v.base - 16, v.w + 10, 16);
  ctx.fillStyle = '#221f36';
  for (let i = 3; i < v.w + 6; i += 8) ctx.fillRect(v.x - 5 + i, v.base - 13, 4, 10);
}

function drawThermal(ctx, v, t, hasSoar) {
  const dim = hasSoar ? 1 : 0.45;
  const pad = 26;
  const g = ctx.createLinearGradient(0, v.top, 0, v.base);
  g.addColorStop(0, 'rgba(255,170,120,0)');
  g.addColorStop(0.6, `rgba(255,170,120,${0.06 * dim})`);
  g.addColorStop(1, `rgba(255,140,110,${0.12 * dim})`);
  ctx.fillStyle = g;
  ctx.fillRect(v.x - pad, v.top, v.w + pad * 2, v.base - v.top);

  // big slow updraft ribbons
  ctx.strokeStyle = `rgba(255,190,140,${0.3 * dim})`;
  ctx.lineWidth = 2.5;
  const span = v.base - v.top;
  for (let i = 0; i < 5; i++) {
    const yy = v.base - ((t * 90 + i * span / 5) % span);
    const k = (v.base - yy) / span;
    const wob = Math.sin(t * 1.6 + i * 2) * 10;
    ctx.globalAlpha = 0.6 * (1 - k) * dim;
    ctx.beginPath();
    ctx.moveTo(v.x - 10 + wob, yy + 14);
    ctx.quadraticCurveTo(v.x + v.w / 2 + wob, yy - 8, v.x + v.w + 10 + wob, yy + 14);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // gulls circling the top of the column
  ctx.strokeStyle = `rgba(30,18,45,${0.85 * dim})`;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  const cx = v.x + v.w / 2;
  const cy = v.top + 60;
  for (let i = 0; i < 2; i++) {
    const a = t * 1.1 + i * Math.PI;
    const gx = cx + Math.cos(a) * 44;
    const gy = cy + Math.sin(a) * 16 + Math.sin(t * 2 + i) * 6;
    const f = Math.sin(t * 8 + i * 2) * 3.5;
    ctx.beginPath();
    ctx.moveTo(gx - 6, gy - f);
    ctx.quadraticCurveTo(gx, gy + 2, gx + 0.5, gy);
    ctx.quadraticCurveTo(gx + 1, gy + 2, gx + 7, gy - f);
    ctx.stroke();
  }
}

function drawWireHazard(ctx, hz, t) {
  const mid = (hz.x1 + hz.x2) / 2;
  ctx.strokeStyle = '#453a63';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hz.x1, hz.y - 8);
  ctx.lineTo(hz.x1, hz.y + 62);
  ctx.moveTo(hz.x2, hz.y - 8);
  ctx.lineTo(hz.x2, hz.y + 62);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, a] of [[5, 0.18], [1.8, 0.9]]) {
    ctx.strokeStyle = `rgba(120,235,255,${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(hz.x1, hz.y);
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const jitter = (Math.random() - 0.5) * 3.4;
      ctx.lineTo(hz.x1 + (hz.x2 - hz.x1) * u, hz.y + hz.sag * 4 * u * (1 - u) + jitter);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  if (Math.random() < 0.06) {
    const u = Math.random();
    particles.burst(hz.x1 + (hz.x2 - hz.x1) * u, hz.y + hz.sag * 4 * u * (1 - u), { count: 3, color: '#aef4ff', speed: 90, life: 0.25, size: 1.6 });
  }
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(mid, hz.y + 16);
  ctx.lineTo(mid - 8, hz.y + 30);
  ctx.lineTo(mid + 8, hz.y + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#191325';
  ctx.font = '800 11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('!', mid, hz.y + 28.5);
}

function drawShiny(ctx, s, t) {
  const bobY = s.y + Math.sin(t * 2.4 + s.phase) * 4;
  const sway = Math.abs(Math.sin(t * 2 + s.phase));
  ctx.save();
  ctx.translate(s.x, bobY);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
  g.addColorStop(0, 'rgba(255,209,102,0.5)');
  g.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.scale(0.35 + sway * 0.65, 1);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6.5, 0);
  ctx.lineTo(0, 8);
  ctx.lineTo(-6.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3d0';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6.5, 0);
  ctx.lineTo(-6.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (Math.sin(t * 3.1 + s.phase * 2) > 0.93) {
    ctx.strokeStyle = 'rgba(255,240,200,0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x - 11, bobY);
    ctx.lineTo(s.x + 11, bobY);
    ctx.moveTo(s.x, bobY - 11);
    ctx.lineTo(s.x, bobY + 11);
    ctx.stroke();
  }
}

function drawPickup(ctx, p, t) {
  const y = p.y + Math.sin(t * 1.8 + p.phase) * 6;
  const info = ABILITIES[p.ability];
  ctx.save();
  ctx.translate(p.x, y);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 40);
  g.addColorStop(0, info.color + '55');
  g.addColorStop(1, info.color + '00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = info.color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 22 * (0.4 + Math.abs(Math.sin(t * 1.1)) * 0.6), t * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.rotate(Math.sin(t * 1.5 + p.phase) * 0.25);
  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.moveTo(-10, 8);
  ctx.quadraticCurveTo(-10, -10, 12, -12);
  ctx.quadraticCurveTo(8, 2, -4, 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(11,6,20,0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-8, 8);
  ctx.lineTo(10, -10);
  ctx.stroke();
  ctx.restore();
  if (Math.random() < 0.12) {
    particles.trail(p.x + (Math.random() - 0.5) * 44, y + (Math.random() - 0.5) * 44, info.color + 'aa');
  }
}

function drawPerch(ctx, c, t) {
  const lit = c.active;
  const col = lit ? '#ff4fa3' : 'rgba(120,110,150,0.9)';
  ctx.strokeStyle = col;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x, c.y - 44);
  ctx.moveTo(c.x - 17, c.y - 44);
  ctx.lineTo(c.x + 17, c.y - 44);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c.x - 17, c.y - 48, 4, Math.PI * 0.5, Math.PI * 1.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c.x + 17, c.y - 48, 4, Math.PI * 1.4, Math.PI * 0.5);
  ctx.stroke();
  if (lit) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, c.y - 46, 2, c.x, c.y - 46, 34);
    g.addColorStop(0, 'rgba(255,79,163,0.4)');
    g.addColorStop(1, 'rgba(255,79,163,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y - 46, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < 0.05) particles.trail(c.x + (Math.random() - 0.5) * 20, c.y - 50, 'rgba(255,79,163,0.7)');
  } else if (Math.sin(t * 3) > 0.7) {
    ctx.fillStyle = 'rgba(255,79,163,0.55)';
    ctx.beginPath();
    ctx.arc(c.x, c.y - 52, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGoal(ctx, goal, t) {
  const { x, y } = goal;
  const lit = goal.lit;
  const word = goal.text || 'THE ROOST';
  const W = Math.max(250, word.length * 30 + 44);
  const H = 74;
  const top = y - 150;

  ctx.strokeStyle = '#2c2440';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - W / 2 + 26, y);
  ctx.lineTo(x - W / 2 + 26, top + H);
  ctx.moveTo(x + W / 2 - 26, y);
  ctx.lineTo(x + W / 2 - 26, top + H);
  ctx.stroke();

  ctx.fillStyle = '#141021';
  ctx.fillRect(x - W / 2, top, W, H);
  ctx.strokeStyle = lit > 0 ? `rgba(255,79,163,${0.4 + lit * 0.6})` : 'rgba(90,80,120,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x - W / 2 + 3, top + 3, W - 6, H - 6);

  const fontSize = Math.min(40, ((W - 44) / word.length) * 1.35);
  ctx.font = `800 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  const totalW = W - 44;
  const step = totalW / word.length;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const cx = x - totalW / 2 + step * (i + 0.5);
    const on = lit * word.length > i + 0.3;
    if (on) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,79,163,0.4)';
      ctx.fillText(ch, cx, top + 52);
      ctx.fillText(ch, cx, top + 52);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffc2e0';
    } else {
      ctx.fillStyle = 'rgba(70,60,95,0.9)';
    }
    ctx.fillText(ch, cx, top + 52);
  }

  if (lit > 0.9) {
    ctx.fillStyle = '#ffd166';
    for (let i = 0; i < 22; i++) {
      if ((i + Math.floor(t * 8)) % 3 !== 0) continue;
      const u = i / 21;
      ctx.beginPath();
      ctx.arc(x - W / 2 + 8 + u * (W - 16), top - 6, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - W / 2 + 8 + u * (W - 16), top + H + 6, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(0, top - 320, 0, top);
    beam.addColorStop(0, 'rgba(255,79,163,0)');
    beam.addColorStop(1, `rgba(255,79,163,${0.14 * lit})`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 30, top);
    ctx.lineTo(x - 110, top - 320);
    ctx.lineTo(x + 110, top - 320);
    ctx.lineTo(x + 30, top);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawPalm(ctx, x, baseY, h, lean, t) {
  const sway = Math.sin(t * 0.9 + x) * 3;
  const topX = x + lean * 18 + sway;
  const topY = baseY - h;
  ctx.strokeStyle = '#241832';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 8, baseY - h * 0.55, topX, topY);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    const u = i / 5;
    ctx.beginPath();
    ctx.moveTo(x + (topX - x) * u - 4, baseY - h * u);
    ctx.lineTo(x + (topX - x) * u + 4, baseY - h * u - 2);
    ctx.stroke();
  }
  // fronds: filled leaf shapes with midribs, drooping under their own weight
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.44 + sway * 0.01;
    const len = h * 0.52;
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len + len * 0.3;
    const mx = topX + Math.cos(a) * len * 0.55;
    const my = topY + Math.sin(a) * len * 0.55 - 6;
    ctx.fillStyle = i % 2 ? '#1b2927' : '#213430';
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx, my - 4, ex, ey);
    ctx.quadraticCurveTo(mx + 2, my + 8, topX, topY + 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(9,15,13,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }
  // dusk light catches the upper fronds
  ctx.strokeStyle = 'rgba(255,110,180,0.16)';
  ctx.lineWidth = 1.6;
  for (const i of [2, 3]) {
    const a = -Math.PI / 2 + (i - 3) * 0.44 + sway * 0.01;
    const len = h * 0.52;
    ctx.beginPath();
    ctx.moveTo(topX, topY - 1);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * len * 0.55, topY + Math.sin(a) * len * 0.55 - 8,
      topX + Math.cos(a) * len, topY + Math.sin(a) * len + len * 0.28
    );
    ctx.stroke();
  }
  // coconut cluster at the crown
  ctx.fillStyle = '#241a24';
  for (const [ox, oy] of [[-4, 4], [3, 5], [0, 8]]) {
    ctx.beginPath();
    ctx.arc(topX + ox, topY + oy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,110,180,0.25)';
  ctx.beginPath();
  ctx.arc(topX - 5, topY + 3, 1.1, 0, Math.PI * 2);
  ctx.fill();
  // trunk rim on the light side
  ctx.strokeStyle = 'rgba(255,110,180,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 3, baseY);
  ctx.quadraticCurveTo(x + lean * 8 + 3, baseY - h * 0.55, topX + 3, topY);
  ctx.stroke();
}

function drawCar(ctx, x, baseY, hue) {
  const y = baseY - 1;
  ctx.fillStyle = `hsl(${hue}, 45%, 26%)`;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 6, y - 15);
  ctx.quadraticCurveTo(x + 24, y - 30, x + 46, y - 26);
  ctx.quadraticCurveTo(x + 74, y - 26, x + 84, y - 15);
  ctx.lineTo(x + 92, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(140,220,255,0.25)';
  ctx.fillRect(x + 26, y - 25, 34, 9);
  ctx.fillStyle = '#0c0917';
  ctx.beginPath();
  ctx.arc(x + 22, y, 8, 0, Math.PI * 2);
  ctx.arc(x + 70, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `hsla(${hue}, 90%, 70%, 0.5)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 6, y - 14);
  ctx.quadraticCurveTo(x + 24, y - 29, x + 46, y - 25);
  ctx.stroke();
}

function drawGrass(ctx, x, baseY, t) {
  ctx.strokeStyle = '#2a3a34';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const gx = x + i * 5 - 10;
    const sway = Math.sin(t * 1.6 + gx) * 2;
    ctx.beginPath();
    ctx.moveTo(gx, baseY + 2);
    ctx.quadraticCurveTo(gx + sway, baseY - 8, gx + sway + i - 2, baseY - 15 - (i % 3) * 4);
    ctx.stroke();
  }
}

function drawLamp(ctx, x, baseY) {
  ctx.strokeStyle = '#2e2745';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - 96);
  ctx.quadraticCurveTo(x, baseY - 112, x + 20, baseY - 112);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.ellipse(x + 24, baseY - 110, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x + 24, baseY - 108, 3, x + 24, baseY - 108, 60);
  g.addColorStop(0, 'rgba(255,225,160,0.28)');
  g.addColorStop(1, 'rgba(255,225,160,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x + 24, baseY - 108, 60, 0, Math.PI * 2);
  ctx.fill();
  // light pool on the sidewalk
  const pool = ctx.createRadialGradient(x + 24, baseY, 2, x + 24, baseY, 46);
  pool.addColorStop(0, 'rgba(255,225,160,0.12)');
  pool.addColorStop(1, 'rgba(255,225,160,0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(x + 24, baseY + 2, 46, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function drawMast(ctx, d, groundY) {
  // decorative crane mast: lattice tower from the jib down to the street
  const x0 = d.x;
  const x1 = d.x + d.w;
  ctx.strokeStyle = '#3d3850';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x0 + 4, d.y0);
  ctx.lineTo(x0 + 4, groundY);
  ctx.moveTo(x1 - 4, d.y0);
  ctx.lineTo(x1 - 4, groundY);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#332e42';
  ctx.beginPath();
  for (let y = d.y0 + 10; y < groundY - 40; y += 80) {
    ctx.moveTo(x0 + 4, y);
    ctx.lineTo(x1 - 4, y + 40);
    ctx.moveTo(x1 - 4, y);
    ctx.lineTo(x0 + 4, y + 40);
    ctx.moveTo(x0 + 4, y);
    ctx.lineTo(x1 - 4, y);
  }
  ctx.stroke();
  // operator cab near the top
  ctx.fillStyle = '#4a4458';
  ctx.fillRect(x0 - 10, d.y0 + 46, d.w + 20, 34);
  ctx.fillStyle = 'rgba(255,220,150,0.5)';
  ctx.fillRect(x0 - 4, d.y0 + 54, 16, 12);
  // base plates
  ctx.fillStyle = '#332e42';
  ctx.fillRect(x0 - 8, groundY - 12, d.w + 16, 12);
}

function drawBigPipe(ctx, d) {
  const h = 26;
  const g = ctx.createLinearGradient(0, d.y, 0, d.y + h);
  g.addColorStop(0, '#443c56');
  g.addColorStop(0.45, '#332c44');
  g.addColorStop(1, '#211c30');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(d.x, d.y, d.w, h, 13);
  ctx.fill();
  ctx.fillStyle = '#211c30';
  for (let px = d.x + 40; px < d.x + d.w - 20; px += 120) {
    ctx.fillRect(px, d.y - 2, 8, h + 4);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(d.x + 4, d.y + 4, d.w - 8, 3);
}

function drawSewerWater(ctx, d, t) {
  const y = d.y;
  const g = ctx.createLinearGradient(0, y - 22, 0, y);
  g.addColorStop(0, 'rgba(60,220,170,0.05)');
  g.addColorStop(1, 'rgba(45,180,140,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(d.x, y - 22, d.w, 22);
  // moving surface glints
  ctx.strokeStyle = 'rgba(120,255,200,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = d.x; x < d.x + d.w; x += 46) {
    const wob = Math.sin(t * 1.8 + x * 0.05) * 3;
    ctx.moveTo(x + wob, y - 20);
    ctx.lineTo(x + wob + 18, y - 20);
  }
  ctx.stroke();
}

// ------------------------------------------------ timed hazards

// Where a hazard is in its cycle: charge is the telegraph build-up,
// deadly is the window that actually bites.
function timedState(h, t) {
  const u = ((((t + h.offset) % h.period) + h.period) % h.period) / h.period;
  if (h.type === 'coil') return { u, charge: Math.min(1, u / 0.72), deadly: u > 0.72 };
  if (h.type === 'jaws') return { u, charge: Math.max(0, (u - 0.4) / 0.15), deadly: u > 0.55 && u < 0.9 };
  return { u, charge: Math.min(1, u / 0.25), deadly: u > 0.25 && u < 0.62 }; // sparkler
}

function drawTimedHazard(ctx, h, t) {
  const st = h._st || timedState(h, t);
  if (h.type === 'sparkler') {
    // festival sparkler fountain: a tube that erupts on a cycle
    const bx = h.x + h.w / 2;
    const by = h.y + h.h;
    ctx.fillStyle = '#4a3a55';
    ctx.fillRect(bx - 9, by - 26, 18, 26);
    ctx.fillStyle = '#c94f7c';
    ctx.fillRect(bx - 9, by - 26, 18, 5);
    if (st.deadly) {
      ctx.globalCompositeOperation = 'lighter';
      const k = 1 - (st.u - 0.25) / 0.37;
      const fh = h.h * (0.65 + k * 0.35);
      const g = ctx.createLinearGradient(0, by - fh, 0, by);
      g.addColorStop(0, 'rgba(255,220,140,0)');
      g.addColorStop(0.7, 'rgba(255,190,110,0.5)');
      g.addColorStop(1, 'rgba(255,240,190,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - 4, by - 24);
      ctx.lineTo(bx - h.w / 2, by - fh);
      ctx.lineTo(bx + h.w / 2, by - fh);
      ctx.lineTo(bx + 4, by - 24);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        particles.trail(bx + (Math.random() - 0.5) * h.w * 0.8, by - Math.random() * fh, `hsla(${Math.round(30 + Math.random() * 30)}, 95%, 68%, 0.9)`);
      }
    } else if (st.charge > 0.4) {
      // fizzing telegraph before the eruption
      ctx.fillStyle = `rgba(255,220,150,${(st.charge - 0.4) * 1.2})`;
      ctx.beginPath();
      ctx.arc(bx, by - 28, 3 + st.charge * 3, 0, Math.PI * 2);
      ctx.fill();
      if (Math.random() < st.charge * 0.5) particles.trail(bx, by - 30, 'rgba(255,230,170,0.8)');
    }
    return;
  }
  if (h.type === 'coil') {
    // lightning coil bolted to the deck
    const bx = h.x + h.w / 2;
    const by = h.y + h.h;
    ctx.fillStyle = '#39324a';
    ctx.fillRect(bx - 6, by - 44, 12, 44);
    ctx.strokeStyle = '#4a4462';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(bx, by - 50 - i * 8, 12 - i * 2.4, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = st.deadly ? '#d5f4ff' : `rgba(140,220,255,${0.3 + st.charge * 0.6})`;
    ctx.beginPath();
    ctx.arc(bx, by - 76, 6, 0, Math.PI * 2);
    ctx.fill();
    if (st.deadly) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(160,230,255,0.9)';
      ctx.lineWidth = 2;
      for (let a = 0; a < 4; a++) {
        ctx.beginPath();
        let px = bx;
        let py = by - 76;
        ctx.moveTo(px, py);
        for (let s = 0; s < 5; s++) {
          px += (Math.random() - 0.5) * h.w * 0.7;
          py -= (h.y - (by - 76)) / -5 + (Math.random() - 0.5) * 16;
          py = Math.max(py - 14, h.y);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(bx, by - 70, 4, bx, by - 70, 60);
      g.addColorStop(0, 'rgba(170,235,255,0.5)');
      g.addColorStop(1, 'rgba(170,235,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by - 70, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    return;
  }
  // gator jaws lurking in the water gap
  const bx = h.x + h.w / 2;
  const surface = h.y + h.h;
  const open = st.deadly ? 0.08 : Math.max(0.14, 1 - st.charge);
  const rise = st.deadly ? 34 : st.charge * 26;
  const jy = surface - rise + 10;
  ctx.fillStyle = '#2e3b26';
  // snout (upper jaw) and lower jaw as two wedges that clap shut
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(bx, jy);
    ctx.rotate(dir * open * 0.9);
    ctx.beginPath();
    ctx.moveTo(-h.w * 0.42, 0);
    ctx.quadraticCurveTo(0, dir * -10, h.w * 0.42, dir * -6);
    ctx.lineTo(h.w * 0.42, dir * 6);
    ctx.quadraticCurveTo(0, dir * 10, -h.w * 0.42, dir * 8);
    ctx.closePath();
    ctx.fill();
    // teeth
    ctx.fillStyle = '#e8e4d0';
    for (let tx = -h.w * 0.34; tx < h.w * 0.4; tx += 13) {
      ctx.beginPath();
      ctx.moveTo(tx, dir * 5);
      ctx.lineTo(tx + 4, dir * (5 + 8));
      ctx.lineTo(tx + 8, dir * 5);
      ctx.fill();
    }
    ctx.fillStyle = '#2e3b26';
    ctx.restore();
  }
  // eyes above the waterline while lurking
  ctx.fillStyle = '#1e2818';
  ctx.beginPath();
  ctx.ellipse(bx - h.w * 0.3, surface - rise - 4, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = st.charge > 0.4 || st.deadly ? '#ffcf5e' : '#b8a24a';
  ctx.beginPath();
  ctx.arc(bx - h.w * 0.3, surface - rise - 5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (st.deadly && Math.random() < 0.4) {
    particles.trail(bx + (Math.random() - 0.5) * h.w * 0.6, surface - 6, 'rgba(150,220,210,0.6)');
  }
}

// ------------------------------------------------ new district furniture

function drawWater(ctx, w, t, x0, x1) {
  const sx = Math.max(w.x, x0 - 40);
  const ex = Math.min(w.x + w.w, x1 + 40);
  if (ex <= sx) return;
  const g = ctx.createLinearGradient(0, w.y, 0, w.y + Math.min(w.h, 260));
  g.addColorStop(0, 'rgba(30,70,80,0.92)');
  g.addColorStop(1, 'rgba(8,16,24,0.98)');
  ctx.fillStyle = g;
  ctx.fillRect(sx, w.y, ex - sx, w.h);
  // surface sheen and rolling glints
  ctx.fillStyle = 'rgba(140,220,220,0.3)';
  ctx.fillRect(sx, w.y, ex - sx, 2.5);
  ctx.strokeStyle = 'rgba(140,220,220,0.28)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let x = Math.floor(sx / 54) * 54; x < ex; x += 54) {
    const wob = Math.sin(t * 1.7 + x * 0.06) * 5;
    ctx.moveTo(x + wob, w.y + 7);
    ctx.lineTo(x + wob + 22, w.y + 7);
    if (((x / 54) | 0) % 2) {
      ctx.moveTo(x + 12 - wob, w.y + 16);
      ctx.lineTo(x + 26 - wob, w.y + 16);
    }
  }
  ctx.stroke();
}

function drawRail(ctx, r, t, has) {
  // support line
  ctx.strokeStyle = '#241f33';
  ctx.lineWidth = r.style === 'guard' ? 5 : 3.5;
  ctx.beginPath();
  ctx.moveTo(r.x1, r.y1);
  ctx.lineTo(r.x2, r.y2);
  ctx.stroke();
  if (r.style === 'guard') {
    // skyway guardrail: steel cap with posts
    ctx.strokeStyle = '#59526e';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(r.x1, r.y1 - 1.5);
    ctx.lineTo(r.x2, r.y2 - 1.5);
    ctx.stroke();
    ctx.strokeStyle = '#39324a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let u = 0.06; u < 1; u += 0.12) {
      const px = r.x1 + (r.x2 - r.x1) * u;
      const py = r.y1 + (r.y2 - r.y1) * u;
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + 16);
    }
    ctx.stroke();
  } else if (r.style === 'guy') {
    // bare guy-wire: just a taut cable with clamps
    ctx.fillStyle = '#4a4462';
    for (const u of [0.03, 0.97]) {
      ctx.fillRect(r.x1 + (r.x2 - r.x1) * u - 3, r.y1 + (r.y2 - r.y1) * u - 5, 6, 10);
    }
  } else {
    // festival light string: bulbs strung along the wire
    const n = Math.max(3, Math.round(r.len / 58));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const px = r.x1 + (r.x2 - r.x1) * u;
      const py = r.y1 + (r.y2 - r.y1) * u + 7;
      const hue = [8, 45, 130, 190, 300][i % 5];
      ctx.strokeStyle = '#241f33';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, py - 7);
      ctx.lineTo(px, py - 2);
      ctx.stroke();
      ctx.fillStyle = `hsla(${hue}, 90%, 64%, ${0.75 + Math.sin(t * 3 + i) * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(px, py + 2, 3.4, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (has) {
    // grind-ready shimmer along the top
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(242,233,99,${0.3 + Math.sin(t * 3.4 + r.x1) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x1, r.y1 - 3);
    ctx.lineTo(r.x2, r.y2 - 3);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawWind(ctx, wz, t, has) {
  const speed = (wz.strength || 620) * 0.55;
  const alpha = has ? 0.34 : 0.18;
  ctx.strokeStyle = `rgba(142,240,255,${alpha})`;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const rows = Math.max(2, Math.floor(wz.h / 46));
  ctx.beginPath();
  for (let ry = 0; ry < rows; ry++) {
    const y = wz.y + (ry + 0.5) * (wz.h / rows);
    const phase = ((t * speed * wz.dir + ry * 173) % wz.w + wz.w) % wz.w;
    for (let k = 0; k < 3; k++) {
      const x = wz.x + ((phase + k * wz.w / 3) % wz.w);
      const len = 34 + (ry % 3) * 14;
      if (x + len > wz.x + wz.w) continue;
      const wob = Math.sin(t * 2.4 + ry * 2 + k) * 5;
      ctx.moveTo(x, y + wob);
      ctx.quadraticCurveTo(x + len * 0.5, y + wob - 5 * wz.dir, x + len, y + wob);
    }
  }
  ctx.stroke();
}

function drawLilyPad(ctx, pd, t) {
  const r = pd.rect;
  const sunk = pd.t >= 1;
  ctx.globalAlpha = sunk ? 0.35 : 1;
  const w = r.w;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + 12);
  g.addColorStop(0, '#4a6b38');
  g.addColorStop(1, '#2c4223');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(r.x + w / 2, r.y + 6, w / 2, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // notch
  ctx.fillStyle = 'rgba(8,16,24,0.9)';
  ctx.beginPath();
  ctx.moveTo(r.x + w / 2, r.y + 6);
  ctx.lineTo(r.x + w * 0.86, r.y - 1);
  ctx.lineTo(r.x + w * 0.98, r.y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,230,140,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(r.x + w / 2, r.y + 5, w / 2 - 4, 5.4, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // sinking ripple
  if (pd.t > 0.25 && !sunk) {
    ctx.strokeStyle = `rgba(140,220,220,${(pd.t - 0.25) * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(r.x + w / 2, pd.baseY + 8, w / 2 + 10 * pd.t, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCage(ctx, c, t) {
  const y = c.y + Math.sin(t * 1.6 + c.x) * 2;
  // hanging ring
  ctx.strokeStyle = '#6a5f8a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x, y - 34);
  ctx.lineTo(c.x, y - 24);
  ctx.stroke();
  // dome cage
  ctx.strokeStyle = c.opened ? 'rgba(150,140,180,0.55)' : '#b8a878';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(c.x, y, 16, Math.PI, 0);
  ctx.lineTo(c.x + 16, y + 10);
  ctx.lineTo(c.x - 16, y + 10);
  ctx.closePath();
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(c.x + i * 6.4, i % 2 ? y - 13 : y - 15);
    ctx.lineTo(c.x + i * 6.4, y + 10);
    ctx.stroke();
  }
  ctx.fillStyle = c.opened ? 'rgba(150,140,180,0.5)' : '#b8a878';
  ctx.fillRect(c.x - 17, y + 10, 34, 3);
  if (c.opened) {
    // door swung open
    ctx.strokeStyle = 'rgba(150,140,180,0.55)';
    ctx.beginPath();
    ctx.moveTo(c.x + 14, y + 10);
    ctx.lineTo(c.x + 26, y + 2);
    ctx.stroke();
  } else {
    // the songbird inside, hopping
    const hop = Math.abs(Math.sin(t * 5 + c.x)) * 3;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.ellipse(c.x + 2, y + 3 - hop, 5, 4, 0, 0, Math.PI * 2);
    ctx.arc(c.x + 6.5, y - hop, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8a13c';
    ctx.beginPath();
    ctx.moveTo(c.x + 9, y - hop - 0.5);
    ctx.lineTo(c.x + 12, y - hop + 0.5);
    ctx.lineTo(c.x + 9, y - hop + 1.5);
    ctx.fill();
    // faint song notes
    if (Math.sin(t * 2.2 + c.x) > 0.86) {
      ctx.fillStyle = 'rgba(255,233,138,0.7)';
      ctx.font = '10px system-ui';
      ctx.fillText('♪', c.x + 20, y - 20);
    }
  }
}

function drawThornVine(ctx, hz, t) {
  ctx.strokeStyle = '#2c4223';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hz.x1, hz.y);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    ctx.lineTo(hz.x1 + (hz.x2 - hz.x1) * u, hz.y + hz.sag * 4 * u * (1 - u) + Math.sin(i * 4) * 4);
  }
  ctx.stroke();
  // thorns
  ctx.strokeStyle = '#4a6b38';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= steps * 2; i++) {
    const u = i / (steps * 2);
    const px = hz.x1 + (hz.x2 - hz.x1) * u;
    const py = hz.y + hz.sag * 4 * u * (1 - u) + Math.sin(i * 2) * 4;
    const dir = i % 2 ? 1 : -1;
    ctx.moveTo(px, py);
    ctx.lineTo(px + 3 * dir, py + 7 * dir);
  }
  ctx.stroke();
  // warning bloom
  ctx.fillStyle = '#c94f7c';
  const mid = (hz.x1 + hz.x2) / 2;
  ctx.beginPath();
  ctx.arc(mid, hz.y + hz.sag, 3.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrateBeam(ctx, d, t) {
  // grate bars in the ceiling
  ctx.fillStyle = '#0c0814';
  ctx.fillRect(d.x, d.y, d.w, 10);
  ctx.fillStyle = '#3a3152';
  for (let x = d.x + 4; x < d.x + d.w - 3; x += 12) {
    ctx.fillRect(x, d.y, 5, 10);
  }
  // shaft of pale light angling down
  const drop = d.drop || 480;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, d.y, 0, d.y + drop);
  g.addColorStop(0, `rgba(190,210,255,${0.16 + Math.sin(t * 0.8) * 0.03})`);
  g.addColorStop(1, 'rgba(190,210,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(d.x + 4, d.y + 10);
  ctx.lineTo(d.x + d.w - 4, d.y + 10);
  ctx.lineTo(d.x + d.w + 34, d.y + drop);
  ctx.lineTo(d.x - 34, d.y + drop);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------ final-act block kinds

function drawFence(ctx, s) {
  // crowd-control fencing stacked with festival barricades
  ctx.fillStyle = '#39324a';
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = '#59526e';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let y = s.y + 10; y < s.y + s.h; y += 26) {
    ctx.moveTo(s.x, y);
    ctx.lineTo(s.x + s.w, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,14,30,0.6)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let y = s.y + 2; y < s.y + s.h; y += 8) {
    ctx.moveTo(s.x + 2, y);
    ctx.lineTo(s.x + s.w - 2, y + 4);
  }
  ctx.stroke();
  // hazard stripe cap
  for (let x = s.x - 4; x < s.x + s.w + 4; x += 14) {
    ctx.fillStyle = ((x / 14) | 0) % 2 ? '#ffd166' : '#191325';
    ctx.fillRect(x, s.y - 5, Math.min(14, s.x + s.w + 4 - x), 5);
  }
}

function drawCart(ctx, s) {
  // stalled market cart: canopy, crates, and wheels
  ctx.fillStyle = '#4a3628';
  ctx.fillRect(s.x, s.y + 10, s.w, s.h - 26);
  ctx.strokeStyle = 'rgba(20,12,8,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(s.x + 1, s.y + 11, s.w - 2, s.h - 28);
  const stripes = ['#c94f7c', '#f4e3c2'];
  for (let i = 0; i < s.w; i += 16) {
    ctx.fillStyle = stripes[(i / 16) % 2 | 0];
    ctx.fillRect(s.x + i, s.y, Math.min(16, s.w - i), 10);
  }
  ctx.fillStyle = '#241f33';
  ctx.beginPath();
  ctx.arc(s.x + s.w * 0.25, s.y + s.h - 8, 9, 0, Math.PI * 2);
  ctx.arc(s.x + s.w * 0.75, s.y + s.h - 8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#59526e';
  ctx.beginPath();
  ctx.arc(s.x + s.w * 0.25, s.y + s.h - 8, 3, 0, Math.PI * 2);
  ctx.arc(s.x + s.w * 0.75, s.y + s.h - 8, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawConcrete(ctx, s) {
  // highway deck slab
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  g.addColorStop(0, '#4e4860');
  g.addColorStop(0.25, '#3d3850');
  g.addColorStop(1, '#292438');
  ctx.fillStyle = g;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(s.x, s.y, s.w, 3);
  // lane paint and expansion joints
  ctx.fillStyle = 'rgba(255,209,102,0.3)';
  for (let x = s.x + 30; x < s.x + s.w - 20; x += 84) {
    ctx.fillRect(x, s.y + 5, 34, 3);
  }
  ctx.strokeStyle = 'rgba(12,8,20,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = s.x + 120; x < s.x + s.w; x += 240) {
    ctx.moveTo(x, s.y);
    ctx.lineTo(x, s.y + s.h);
  }
  ctx.stroke();
  // drip stains on the fascia
  ctx.fillStyle = 'rgba(10,6,16,0.3)';
  for (let x = s.x + 40; x < s.x + s.w; x += 170) {
    ctx.fillRect(x, s.y + s.h - 14, 5, 14);
  }
}

function drawBarge(ctx, s, t) {
  const bob = Math.sin(t * 1.1 + s.x) * 2;
  ctx.save();
  ctx.translate(0, bob);
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  g.addColorStop(0, '#5a3a2a');
  g.addColorStop(1, '#33201a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(s.x - 8, s.y);
  ctx.lineTo(s.x + s.w + 8, s.y);
  ctx.lineTo(s.x + s.w - 6, s.y + s.h);
  ctx.lineTo(s.x + 6, s.y + s.h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(s.x - 8, s.y, s.w + 16, 5);
  // tire fenders
  ctx.strokeStyle = '#191325';
  ctx.lineWidth = 5;
  for (const u of [0.15, 0.5, 0.85]) {
    ctx.beginPath();
    ctx.arc(s.x + s.w * u, s.y + s.h * 0.55, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrunk(ctx, s) {
  // great cypress or mangrove trunk
  const g = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0);
  g.addColorStop(0, '#4a3a2c');
  g.addColorStop(0.4, '#3a2c22');
  g.addColorStop(1, '#241a14');
  ctx.fillStyle = g;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  // bark furrows
  ctx.strokeStyle = 'rgba(16,10,8,0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = s.x + 8; x < s.x + s.w - 4; x += 12) {
    ctx.moveTo(x, s.y);
    for (let y = s.y + 30; y < s.y + s.h; y += 60) {
      ctx.quadraticCurveTo(x + ((y / 60) % 2 ? 4 : -4), y - 30, x, y);
    }
  }
  ctx.stroke();
  // moss tufts on the flanks
  ctx.fillStyle = 'rgba(90,140,70,0.3)';
  for (let y = s.y + 26; y < s.y + s.h; y += 90) {
    ctx.beginPath();
    ctx.ellipse(s.x + 4, y, 7, 14, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // root flare at the base
  ctx.fillStyle = '#33261c';
  ctx.beginPath();
  ctx.moveTo(s.x - 14, s.y + s.h);
  ctx.quadraticCurveTo(s.x + 4, s.y + s.h - 46, s.x + 6, s.y + s.h - 120);
  ctx.lineTo(s.x + s.w - 6, s.y + s.h - 120);
  ctx.quadraticCurveTo(s.x + s.w - 4, s.y + s.h - 46, s.x + s.w + 14, s.y + s.h);
  ctx.closePath();
  ctx.fill();
}

function drawCanopy(ctx, s) {
  // walkable bough: a broad branch with foliage clouds
  ctx.fillStyle = '#3a2c22';
  ctx.fillRect(s.x, s.y + s.h * 0.4, s.w, s.h * 0.6);
  ctx.fillStyle = '#2c4223';
  for (let i = 0; i < 4; i++) {
    const u = (i + 0.5) / 4;
    ctx.beginPath();
    ctx.ellipse(s.x + s.w * u, s.y + 4, s.w * 0.19, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(150,200,110,0.22)';
  for (let i = 0; i < 4; i++) {
    const u = (i + 0.5) / 4;
    ctx.beginPath();
    ctx.ellipse(s.x + s.w * u - 4, s.y, s.w * 0.12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoot(ctx, s) {
  // arched mangrove root mass
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  g.addColorStop(0, '#3a2c22');
  g.addColorStop(1, '#221812');
  ctx.fillStyle = g;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = 'rgba(16,10,8,0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = s.x + 6; x < s.x + s.w; x += 14) {
    ctx.moveTo(x, s.y + 4);
    ctx.quadraticCurveTo(x + 7, s.y + s.h * 0.5, x - 3, s.y + s.h);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(90,140,70,0.25)';
  ctx.fillRect(s.x, s.y, s.w, 5);
}

function drawTheaterFacade(ctx, sIn, t) {
  // Calle Ocho's deco movie palace: cream facade, banded parapet,
  // and the lit vertical fin rising off the roof. The art may extend
  // below the solid (artH) so the lobby doors double as a walkway.
  const s = { x: sIn.x, y: sIn.y, w: sIn.w, h: sIn.artH || sIn.h };
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  g.addColorStop(0, '#8a7a68');
  g.addColorStop(0.5, '#6e5f52');
  g.addColorStop(1, '#4a3e38');
  ctx.fillStyle = g;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  // fluted pilasters
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (const u of [0.12, 0.5, 0.88]) {
    ctx.fillRect(s.x + s.w * u - 7, s.y + 30, 14, s.h - 30);
  }
  // stepped parapet bands
  ctx.fillStyle = '#9a8a74';
  ctx.fillRect(s.x - 5, s.y - 3, s.w + 10, 13);
  ctx.fillRect(s.x + s.w * 0.2, s.y - 12, s.w * 0.6, 9);
  // window slots
  ctx.fillStyle = 'rgba(20,16,30,0.75)';
  for (let wy = s.y + 60; wy < s.y + s.h - 220; wy += 90) {
    for (const u of [0.28, 0.72]) {
      ctx.fillRect(s.x + s.w * u - 11, wy, 22, 46);
    }
  }
  // grand marquee over the doors
  const my = s.y + s.h - 200;
  ctx.fillStyle = '#191325';
  ctx.fillRect(s.x - 26, my, s.w + 52, 62);
  ctx.strokeStyle = 'rgba(255,209,102,0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(s.x - 23, my + 3, s.w + 46, 56);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ESTA NOCHE: EL GALLO', s.x + s.w / 2, my + 40);
  // chasing marquee bulbs
  ctx.fillStyle = '#ffd166';
  for (let i = 0; i < 26; i++) {
    if ((i + Math.floor(t * 7)) % 3 === 0) continue;
    const u = i / 25;
    ctx.beginPath();
    ctx.arc(s.x - 20 + u * (s.w + 40), my - 4, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // entry doors
  ctx.fillStyle = 'rgba(30,20,18,0.9)';
  for (const u of [0.22, 0.5, 0.78]) {
    ctx.beginPath();
    ctx.moveTo(s.x + s.w * u - 24, s.y + s.h);
    ctx.lineTo(s.x + s.w * u - 24, s.y + s.h - 92);
    ctx.arc(s.x + s.w * u, s.y + s.h - 92, 24, Math.PI, 0);
    ctx.lineTo(s.x + s.w * u + 24, s.y + s.h);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,200,130,0.16)';
  for (const u of [0.22, 0.5, 0.78]) {
    ctx.beginPath();
    ctx.ellipse(s.x + s.w * u, s.y + s.h - 30, 34, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // the vertical TOWER fin, lit against the night
  const fx = s.x + s.w * 0.5;
  const fTop = s.y - 240;
  ctx.fillStyle = '#7a6a58';
  ctx.fillRect(fx - 21, fTop, 42, 240);
  ctx.fillStyle = '#9a8a74';
  ctx.fillRect(fx - 26, fTop, 8, 240);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,120,140,0.5)';
  ctx.lineWidth = 5;
  ctx.strokeRect(fx - 21, fTop, 42, 240);
  ctx.strokeStyle = '#ff7a8c';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(fx - 21, fTop, 42, 240);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffd9de';
  ctx.font = '800 30px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  const word = 'TOWER';
  for (let i = 0; i < word.length; i++) {
    const on = Math.sin(t * 1.4 - i * 0.8) > -0.75;
    ctx.globalAlpha = on ? 1 : 0.25;
    ctx.fillText(word[i], fx, fTop + 42 + i * 40);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------ final-act decor

function drawLanternString(ctx, d, t) {
  // paper lanterns swaying on a line from (x, y) to (x+w, y)
  const sag = d.sag ?? 26;
  ctx.strokeStyle = '#241f33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  ctx.quadraticCurveTo(d.x + d.w / 2, d.y + sag * 2, d.x + d.w, d.y);
  ctx.stroke();
  const n = Math.max(2, Math.round(d.w / 95));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const lx = d.x + d.w * u + Math.sin(t * 1.3 + i * 2.4) * 2;
    const ly = d.y + sag * 4 * u * (1 - u) + 13;
    const hue = [8, 40, 320, 165][i % 4];
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 30);
    g.addColorStop(0, `hsla(${hue}, 90%, 62%, 0.35)`);
    g.addColorStop(1, `hsla(${hue}, 90%, 62%, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `hsl(${hue}, 85%, 60%)`;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.5)';
    ctx.fillRect(lx - 2.5, ly - 3, 5, 6);
    ctx.fillStyle = '#241f33';
    ctx.fillRect(lx - 3, ly - 11, 6, 3);
  }
}

function drawRooster(ctx, x, baseY) {
  // one of the painted roosters of Calle Ocho
  ctx.fillStyle = '#59526e';
  ctx.fillRect(x - 20, baseY - 12, 40, 12);
  ctx.save();
  ctx.translate(x, baseY - 12);
  // body
  const g = ctx.createLinearGradient(0, -52, 0, 0);
  g.addColorStop(0, '#c94f7c');
  g.addColorStop(0.6, '#8a3a5e');
  g.addColorStop(1, '#5e2a48');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(-2, -26, 17, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // tail plumes
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `hsl(${[185, 45, 320, 150][i]}, 80%, 55%)`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -30);
    ctx.quadraticCurveTo(-30 - i * 4, -44 - i * 7, -22 - i * 6, -58 - i * 5);
    ctx.stroke();
  }
  // neck and head
  ctx.fillStyle = '#e8a13c';
  ctx.beginPath();
  ctx.moveTo(8, -34);
  ctx.quadraticCurveTo(15, -50, 12, -56);
  ctx.arc(12, -58, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // comb and wattle
  ctx.fillStyle = '#e83c4b';
  ctx.beginPath();
  ctx.arc(10, -66, 3.4, 0, Math.PI * 2);
  ctx.arc(14, -67, 3.4, 0, Math.PI * 2);
  ctx.arc(17, -64, 3, 0, Math.PI * 2);
  ctx.arc(14, -50, 3, 0, Math.PI * 2);
  ctx.fill();
  // beak and eye
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(18, -60);
  ctx.lineTo(25, -57.5);
  ctx.lineTo(18, -55);
  ctx.fill();
  ctx.fillStyle = '#191325';
  ctx.beginPath();
  ctx.arc(13.5, -59, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // painted wing swirl
  ctx.strokeStyle = '#35e0e0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-2, -26, 8, 0.4, Math.PI * 1.5);
  ctx.stroke();
  // legs
  ctx.strokeStyle = '#e8a13c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-4, -13);
  ctx.lineTo(-4, 0);
  ctx.moveTo(4, -13);
  ctx.lineTo(4, 0);
  ctx.stroke();
  ctx.restore();
}

function drawPergola(ctx, d, groundY) {
  // Domino Park: tiled pergola with game tables beneath
  const x = d.x;
  const w = d.w || 300;
  const top = groundY - 130;
  ctx.fillStyle = '#8a4a3a';
  ctx.fillRect(x - 8, top, w + 16, 10);
  ctx.fillStyle = '#c9705e';
  ctx.fillRect(x - 8, top, w + 16, 4);
  // slats
  ctx.fillStyle = 'rgba(20,12,10,0.5)';
  for (let sx = x + 8; sx < x + w; sx += 22) {
    ctx.fillRect(sx, top + 2, 8, 8);
  }
  // columns
  for (let ci = 0; ci <= 3; ci++) {
    const cx = x + (w / 3) * ci;
    ctx.fillStyle = '#e8dcc2';
    ctx.fillRect(cx - 6, top + 10, 12, groundY - top - 10);
    ctx.fillStyle = '#b8a878';
    ctx.fillRect(cx - 8, top + 10, 16, 5);
  }
  // domino tables
  for (let ti = 0; ti < 2; ti++) {
    const tx = x + w * (0.22 + ti * 0.45);
    ctx.fillStyle = '#3a3152';
    ctx.fillRect(tx - 26, groundY - 34, 52, 5);
    ctx.fillRect(tx - 3, groundY - 30, 6, 30);
    // tiles on the table
    ctx.fillStyle = '#f4f0ff';
    ctx.fillRect(tx - 14, groundY - 39, 9, 5);
    ctx.fillRect(tx - 2, groundY - 39, 9, 5);
    ctx.fillStyle = '#191325';
    ctx.fillRect(tx - 10, groundY - 38, 1.6, 3);
    ctx.fillRect(tx + 2, groundY - 38, 1.6, 3);
  }
}

function drawPylon(ctx, d) {
  // bridge pier holding a deck overhead
  const g = ctx.createLinearGradient(d.x, 0, d.x + d.w, 0);
  g.addColorStop(0, '#453f58');
  g.addColorStop(0.5, '#332e42');
  g.addColorStop(1, '#241f33');
  ctx.fillStyle = g;
  ctx.fillRect(d.x, d.y0, d.w, d.y1 - d.y0);
  ctx.fillStyle = '#4e4860';
  ctx.fillRect(d.x - 8, d.y0, d.w + 16, 14);
  ctx.fillRect(d.x - 6, d.y1 - 12, d.w + 12, 12);
  // streaks and a high-water stain
  ctx.fillStyle = 'rgba(10,6,16,0.35)';
  for (let x = d.x + 8; x < d.x + d.w; x += 22) {
    ctx.fillRect(x, d.y0 + 14, 4, (d.y1 - d.y0) * 0.5);
  }
  ctx.fillStyle = 'rgba(90,140,140,0.2)';
  ctx.fillRect(d.x, d.y1 - 90, d.w, 8);
}

function drawRadioMast(ctx, d, t) {
  // lattice radio mast with a blinking beacon
  const x = d.x;
  const top = d.y0;
  const base = d.y1;
  ctx.strokeStyle = '#453a63';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 14, base);
  ctx.lineTo(x - 5, top);
  ctx.moveTo(x + 14, base);
  ctx.lineTo(x + 5, top);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#332e42';
  ctx.beginPath();
  for (let y = base - 30; y > top + 20; y -= 44) {
    const k = (y - top) / (base - top);
    const half = 5 + 9 * k;
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y - 22);
    ctx.moveTo(x + half, y);
    ctx.lineTo(x - half, y - 22);
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y);
  }
  ctx.stroke();
  // dishes
  ctx.fillStyle = '#59526e';
  ctx.beginPath();
  ctx.ellipse(x - 10, top + 90, 5, 9, 0.5, 0, Math.PI * 2);
  ctx.ellipse(x + 10, top + 150, 5, 9, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // beacon
  if (Math.sin(t * 2.2) > 0.4) {
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(x, top - 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, top - 6, 2, x, top - 6, 30);
    g.addColorStop(0, 'rgba(255,90,90,0.4)');
    g.addColorStop(1, 'rgba(255,90,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, top - 6, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawOsprey(ctx, d, t) {
  // the storm-worn osprey, hunched on its perch
  const x = d.x;
  const y = d.y + Math.sin(t * 1.1) * 1.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(d.flip ? -1 : 1, 1);
  // body
  const g = ctx.createLinearGradient(0, -26, 0, 0);
  g.addColorStop(0, '#4a4038');
  g.addColorStop(1, '#2c2620');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -14, 11, 16, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // white breast
  ctx.fillStyle = '#d8d2c2';
  ctx.beginPath();
  ctx.ellipse(4, -10, 5.5, 10, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // head with the dark eye-stripe
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.arc(5, -30, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3028';
  ctx.beginPath();
  ctx.moveTo(-1, -33);
  ctx.quadraticCurveTo(5, -35, 11, -31);
  ctx.lineTo(11, -28);
  ctx.quadraticCurveTo(5, -31, -1, -29);
  ctx.fill();
  // hooked beak and eye
  ctx.fillStyle = '#2c2620';
  ctx.beginPath();
  ctx.moveTo(10, -31);
  ctx.quadraticCurveTo(16, -30, 14, -25);
  ctx.lineTo(10, -28);
  ctx.fill();
  ctx.fillStyle = '#ffcf5e';
  ctx.beginPath();
  ctx.arc(6.5, -30.5, 1.7, 0, Math.PI * 2);
  ctx.fill();
  // folded wing edge
  ctx.strokeStyle = '#1e1a16';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -22);
  ctx.quadraticCurveTo(-12, -10, -6, 2);
  ctx.stroke();
  // talons
  ctx.strokeStyle = '#8a8272';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(-2, 6);
  ctx.moveTo(4, 2);
  ctx.lineTo(4, 6);
  ctx.stroke();
  ctx.restore();
}

function drawTruck(ctx, x, baseY, hue, t) {
  const y = baseY - 1;
  // box truck idling in the storm
  ctx.fillStyle = `hsl(${hue}, 25%, 30%)`;
  ctx.fillRect(x, y - 52, 92, 44);
  ctx.fillStyle = `hsl(${hue}, 30%, 22%)`;
  ctx.fillRect(x + 92, y - 38, 34, 30);
  ctx.fillStyle = 'rgba(140,220,255,0.3)';
  ctx.fillRect(x + 112, y - 34, 12, 12);
  ctx.fillStyle = '#0c0917';
  ctx.beginPath();
  ctx.arc(x + 22, y, 9, 0, Math.PI * 2);
  ctx.arc(x + 72, y, 9, 0, Math.PI * 2);
  ctx.arc(x + 112, y, 9, 0, Math.PI * 2);
  ctx.fill();
  // headlight cone
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x + 126, 0, x + 190, 0);
  g.addColorStop(0, 'rgba(255,235,180,0.25)');
  g.addColorStop(1, 'rgba(255,235,180,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + 126, y - 22);
  ctx.lineTo(x + 196, y - 30);
  ctx.lineTo(x + 196, y - 2);
  ctx.lineTo(x + 126, y - 12);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // exhaust puffs
  if (Math.random() < 0.2) {
    particles.trail(x + 4, y - 56, 'rgba(180,180,200,0.25)');
  }
}

function drawReeds(ctx, x, baseY, t) {
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const gx = x + i * 7 - 21;
    const h = 34 + ((gx * 13) % 26);
    const sway = Math.sin(t * 1.2 + gx * 0.3) * 4;
    ctx.strokeStyle = i % 2 ? '#3c5430' : '#4a6b38';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(gx, baseY + 2);
    ctx.quadraticCurveTo(gx + sway * 0.5, baseY - h * 0.6, gx + sway, baseY - h);
    ctx.stroke();
    // seed head
    if (i % 3 === 0) {
      ctx.fillStyle = '#8a7a58';
      ctx.beginPath();
      ctx.ellipse(gx + sway, baseY - h - 4, 2.4, 7, sway * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBoardwalk(ctx, d, groundY) {
  // collapsed ranger boardwalk: leaning posts, missing planks
  const x = d.x;
  const w = d.w || 220;
  ctx.strokeStyle = '#4a3a2c';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let px = x; px < x + w; px += 46) {
    const lean = ((px * 7) % 10 - 5) * 0.04;
    ctx.moveTo(px, groundY);
    ctx.lineTo(px + lean * 40, groundY - 54 - ((px * 13) % 18));
  }
  ctx.stroke();
  ctx.fillStyle = '#5a4a38';
  for (let px = x; px < x + w - 40; px += 46) {
    if ((px / 46) % 3 === 2) continue; // missing plank
    ctx.save();
    ctx.translate(px + 23, groundY - 58);
    ctx.rotate(((px * 11) % 8 - 4) * 0.05);
    ctx.fillRect(-26, 0, 52, 7);
    ctx.restore();
  }
}

function drawFlock(ctx, d, t) {
  // the flock wheeling in a thermal column
  const cx = d.x;
  const cy = d.y;
  ctx.strokeStyle = 'rgba(30,22,38,0.9)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < (d.count || 9); i++) {
    const a = t * (0.5 + (i % 3) * 0.14) + i * 0.8;
    const rad = 60 + (i % 4) * 34;
    const gx = cx + Math.cos(a) * rad;
    const gy = cy + Math.sin(a) * rad * 0.36 - i * 26;
    const f = Math.sin(t * 6 + i * 1.7) * 4.5;
    const s = 1 + (i % 3) * 0.25;
    ctx.beginPath();
    ctx.moveTo(gx - 8 * s, gy - f);
    ctx.quadraticCurveTo(gx, gy + 3, gx + 0.5, gy);
    ctx.quadraticCurveTo(gx + 1, gy + 3, gx + 9 * s, gy - f);
    ctx.stroke();
  }
}

function drawArchLegs(ctx, d, groundY) {
  // monumental arch legs holding the MILE 0 deck
  for (const side of [0, 1]) {
    const x = d.x + side * (d.w - 46);
    const g = ctx.createLinearGradient(x, 0, x + 46, 0);
    g.addColorStop(0, '#4e4860');
    g.addColorStop(1, '#332e42');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 10, groundY);
    ctx.quadraticCurveTo(x + 8, d.y0 + 130, x + 8, d.y0);
    ctx.lineTo(x + 38, d.y0);
    ctx.quadraticCurveTo(x + 38, d.y0 + 150, x + 56, groundY);
    ctx.closePath();
    ctx.fill();
  }
  // crossbrace glow strip
  ctx.fillStyle = 'rgba(142,240,255,0.4)';
  ctx.fillRect(d.x + 8, d.y0 + 6, d.w - 16, 3);
}

function drawBargeCrane(ctx, d, t) {
  // small deck crane leaning over the water
  ctx.strokeStyle = '#453a63';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y1);
  ctx.lineTo(d.x, d.y0 + 20);
  ctx.lineTo(d.x + (d.reach || 90), d.y0);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#59526e';
  ctx.beginPath();
  ctx.moveTo(d.x, d.y0 + 20);
  ctx.lineTo(d.x + (d.reach || 90) * 0.6, d.y1 - 10);
  ctx.stroke();
  ctx.fillStyle = '#332e42';
  ctx.fillRect(d.x - 12, d.y1 - 8, 24, 8);
}

function drawPinata(ctx, hk, t, hasAbility) {
  const top = hk.top ?? hk.y - 200;
  const sway = Math.sin(t * 1.4 + hk.x * 0.02) * 3;
  // string
  ctx.strokeStyle = '#241f33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hk.x, top);
  ctx.quadraticCurveTo(hk.x + sway, (top + hk.y) / 2, hk.x + sway, hk.y - 14);
  ctx.stroke();
  ctx.save();
  ctx.translate(hk.x + sway, hk.y);
  ctx.rotate(sway * 0.03);
  // papier-mache star body with fringe rings
  const R = 15;
  for (let ring = 0; ring < 3; ring++) {
    ctx.fillStyle = `hsl(${[320, 45, 185][ring]}, 85%, ${60 - ring * 6}%)`;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = (i % 2 ? R * 0.5 : R) * (1 - ring * 0.22);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  // streamer tails off the points
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 10 - Math.PI / 2;
    ctx.strokeStyle = `hsl(${(i * 70 + 20) % 360}, 85%, 62%)`;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.quadraticCurveTo(
      Math.cos(a) * (R + 9) + sway, Math.sin(a) * (R + 9) + 6,
      Math.cos(a) * (R + 13) + sway * 1.5, Math.sin(a) * (R + 13) + 12
    );
    ctx.stroke();
  }
  ctx.restore();
  if (hasAbility && !hk.held) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(hk.x, hk.y, 2, hk.x, hk.y, 30);
    g.addColorStop(0, `rgba(217,184,255,${0.22 + Math.sin(t * 2.6 + hk.x) * 0.1})`);
    g.addColorStop(1, 'rgba(217,184,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hk.x, hk.y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------ mega-map furniture

function drawExitDoor(ctx, e, t, locked) {
  const cx = e.x + e.w / 2;
  const archY = e.y + Math.min(30, e.h * 0.2);
  // frame
  ctx.fillStyle = '#141021';
  ctx.beginPath();
  ctx.moveTo(e.x - 10, e.y + e.h);
  ctx.lineTo(e.x - 10, archY);
  ctx.arc(cx, archY, e.w / 2 + 10, Math.PI, 0);
  ctx.lineTo(e.x + e.w + 10, e.y + e.h);
  ctx.closePath();
  ctx.fill();
  // tunnel depth
  const g = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
  g.addColorStop(0, '#0a0614');
  g.addColorStop(1, locked ? '#171126' : '#1c1430');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y + e.h);
  ctx.lineTo(e.x, archY);
  ctx.arc(cx, archY, e.w / 2, Math.PI, 0);
  ctx.lineTo(e.x + e.w, e.y + e.h);
  ctx.closePath();
  ctx.fill();
  if (locked) {
    // boarded over: slats and a cold padlock, waiting on a map fragment
    ctx.strokeStyle = 'rgba(150,110,200,0.5)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 3; i++) {
      const y = e.y + e.h * (0.3 + i * 0.22);
      ctx.beginPath();
      ctx.moveTo(e.x + 4, y);
      ctx.lineTo(e.x + e.w - 4, y + 8);
      ctx.stroke();
    }
    const ly = e.y + e.h * 0.42;
    ctx.strokeStyle = 'rgba(200,170,255,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, ly - 4, 7, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,170,255,0.75)';
    ctx.fillRect(cx - 10, ly - 4, 20, 16);
    if (e.label) {
      ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(170,140,220,0.7)';
      ctx.fillText(e.label, cx, e.y - 22);
      ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('map fragment required', cx, e.y - 8);
    }
    return;
  }
  // a linger gate charging up: the arch fills with light as the crow settles
  if (e.linger && e.lingerT > 0) {
    const k = Math.min(1, e.lingerT / LINGER_TIME);
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createLinearGradient(0, e.y + e.h, 0, e.y + e.h - e.h * k);
    lg.addColorStop(0, 'rgba(140,220,255,0.5)');
    lg.addColorStop(1, 'rgba(140,220,255,0.05)');
    ctx.fillStyle = lg;
    ctx.fillRect(e.x, e.y + e.h - e.h * k, e.w, e.h * k);
    ctx.globalCompositeOperation = 'source-over';
  }
  // glowing rim
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(140,220,255,${0.5 + Math.sin(t * 2.2 + e.x) * 0.2})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y + e.h);
  ctx.lineTo(e.x, archY);
  ctx.arc(cx, archY, e.w / 2, Math.PI, 0);
  ctx.lineTo(e.x + e.w, e.y + e.h);
  ctx.stroke();
  // drifting chevrons inside (vertical gates drift upward instead)
  const dir = e.dir || 1;
  ctx.globalAlpha = 1;
  if (e.vdir) {
    for (let i = 0; i < 3; i++) {
      const u = ((t * 0.5 + i / 3) % 1);
      ctx.strokeStyle = `rgba(140,220,255,${0.5 * (1 - u)})`;
      ctx.lineWidth = 3;
      const py = e.y + e.h * 0.6 + (u - 0.5) * e.h * 0.4 * e.vdir;
      ctx.beginPath();
      ctx.moveTo(cx - 8, py + 5 * e.vdir);
      ctx.lineTo(cx, py - 4 * e.vdir);
      ctx.lineTo(cx + 8, py + 5 * e.vdir);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const u = ((t * 0.5 + i / 3) % 1);
      ctx.strokeStyle = `rgba(140,220,255,${0.5 * (1 - u)})`;
      ctx.lineWidth = 3;
      const px = cx + (u - 0.5) * e.w * 0.5 * dir;
      ctx.beginPath();
      ctx.moveTo(px - 5 * dir, e.y + e.h * 0.45 - 8);
      ctx.lineTo(px + 4 * dir, e.y + e.h * 0.45);
      ctx.lineTo(px - 5 * dir, e.y + e.h * 0.45 + 8);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // where it leads
  if (e.label) {
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(140,220,255,0.85)';
    const tag = e.vdir ? e.label : (dir === -1 ? '◂ ' : '') + e.label + (dir === -1 ? '' : ' ▸');
    ctx.fillText(tag, cx, e.y - 8);
  }
}

// the Magpie's stall: striped canopy, cluttered counter, one sharp-eyed bird
function drawShopStall(ctx, s, t) {
  const x = s.x;
  const base = s.y;
  const w = 190;
  const roofY = base - 170;
  // posts
  ctx.fillStyle = '#39324a';
  ctx.fillRect(x - w / 2, roofY + 10, 10, 160);
  ctx.fillRect(x + w / 2 - 10, roofY + 10, 10, 160);
  // counter
  ctx.fillStyle = '#241f33';
  ctx.fillRect(x - w / 2 - 8, base - 64, w + 16, 12);
  ctx.fillStyle = '#39324a';
  ctx.fillRect(x - w / 2, base - 52, w, 52);
  // canopy scallops
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#ff4fa3' : '#35e0e0';
    const sx = x - w / 2 - 10 + (i * (w + 20)) / 6;
    ctx.fillRect(sx, roofY - 6, (w + 20) / 6 + 1, 22);
    ctx.beginPath();
    ctx.arc(sx + (w + 20) / 12, roofY + 16, (w + 20) / 12, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = '#1c1430';
  ctx.fillRect(x - w / 2 - 10, roofY - 14, w + 20, 10);
  // sign over the canopy
  ctx.font = '800 17px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,209,102,${0.75 + Math.sin(t * 2.4) * 0.2})`;
  ctx.fillText('THE MAGPIE', x, roofY - 24);
  ctx.globalCompositeOperation = 'source-over';
  // trinkets glinting on the counter
  for (let i = 0; i < 5; i++) {
    const tx = x - w / 2 + 22 + i * ((w - 44) / 4);
    const glint = Math.sin(t * 3 + i * 1.9) > 0.55;
    ctx.fillStyle = glint ? '#ffe9a8' : '#ffd166';
    ctx.beginPath();
    ctx.arc(tx, base - 70 + (i % 2) * 3, glint ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // hanging map scrolls under the canopy
  ctx.fillStyle = '#d9cfae';
  for (const u of [-0.3, 0.32]) {
    ctx.fillRect(x + u * w - 7, roofY + 26 + Math.sin(t * 1.6 + u * 5) * 2, 14, 30);
    ctx.strokeStyle = '#8a7a5c';
    ctx.strokeRect(x + u * w - 7, roofY + 26 + Math.sin(t * 1.6 + u * 5) * 2, 14, 30);
  }
  // the Magpie herself, perched on the counter's edge
  const my = base - 76 + Math.sin(t * 2.1) * 1.5;
  ctx.fillStyle = '#12101c';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 - 26, my, 12, 9, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2ecff';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 - 29, my + 3, 6, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#12101c';
  ctx.beginPath();
  ctx.arc(x + w / 2 - 37, my - 6, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // long tail, beak, bright eye
  ctx.strokeStyle = '#12101c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 15, my - 2);
  ctx.lineTo(x + w / 2 + 2, my - 14);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 42, my - 7);
  ctx.lineTo(x + w / 2 - 48, my - 5);
  ctx.lineTo(x + w / 2 - 42, my - 3);
  ctx.fill();
  ctx.fillStyle = Math.sin(t * 0.9) > 0.94 ? '#12101c' : '#ffe9a8';
  ctx.beginPath();
  ctx.arc(x + w / 2 - 36, my - 7, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPuzzleSwitch(ctx, s, t) {
  // neon pad on a little stand
  ctx.fillStyle = '#39324a';
  ctx.fillRect(s.x - 4, s.y + 10, 8, 14);
  ctx.fillStyle = '#241f33';
  ctx.fillRect(s.x - 12, s.y + 22, 24, 4);
  const on = s.lit;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, on ? 34 : 20);
  g.addColorStop(0, `hsla(${s.hue}, 92%, 64%, ${on ? 0.6 : 0.28 + Math.sin(t * 3 + s.x) * 0.08})`);
  g.addColorStop(1, `hsla(${s.hue}, 92%, 64%, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s.x, s.y, on ? 34 : 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = on ? `hsl(${s.hue}, 95%, 72%)` : `hsla(${s.hue}, 60%, 45%, 0.9)`;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,240,255,0.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPuzzleDisplay(ctx, pz, t) {
  const d = pz.display;
  const n = pz.order.length;
  const w = n * 26 + 22;
  // board
  ctx.fillStyle = '#141021';
  ctx.fillRect(d.x - w / 2, d.y - 20, w, 40);
  ctx.strokeStyle = pz.solved ? 'rgba(164,242,107,0.9)' : 'rgba(53,224,224,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(d.x - w / 2 + 2, d.y - 18, w - 4, 36);
  if (pz.solved) {
    ctx.fillStyle = '#a4f26b';
    ctx.font = '800 18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('✓', d.x, d.y + 7);
    return;
  }
  // flash the combination on loop: step through the order, then rest
  const cycle = n * 0.8 + 1.2;
  const u = ((t % cycle) / 0.8) | 0;
  for (let i = 0; i < n; i++) {
    const s = pz.switches[pz.order[i]];
    const showing = u === i;
    const done = i < pz.progress;
    ctx.globalCompositeOperation = showing || done ? 'lighter' : 'source-over';
    ctx.fillStyle = showing ? `hsl(${s.hue}, 95%, 68%)`
      : done ? `hsla(${s.hue}, 95%, 68%, 0.75)`
      : `hsla(${s.hue}, 40%, 30%, 0.9)`;
    ctx.beginPath();
    ctx.arc(d.x - w / 2 + 24 + i * 26, d.y, showing ? 9 : 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------ the abduction

function drawBeam(ctx, b, t) {
  const cx = b.x + b.w / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // the column
  const g = ctx.createLinearGradient(cx - b.w / 2, 0, cx + b.w / 2, 0);
  g.addColorStop(0, 'rgba(125,255,106,0)');
  g.addColorStop(0.5, `rgba(125,255,106,${0.16 + Math.sin(t * 1.7) * 0.04})`);
  g.addColorStop(1, 'rgba(125,255,106,0)');
  ctx.fillStyle = g;
  ctx.fillRect(b.x - 10, b.top, b.w + 20, b.base - b.top);
  // hard edges
  ctx.strokeStyle = 'rgba(125,255,106,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x, b.top);
  ctx.lineTo(b.x, b.base);
  ctx.moveTo(b.x + b.w, b.top);
  ctx.lineTo(b.x + b.w, b.base);
  ctx.stroke();
  // rising rings
  const span = b.base - b.top;
  for (let i = 0; i < 6; i++) {
    const u = 1 - (((t * 160 + i * span / 6) % span) / span);
    const y = b.base - (1 - u) * span;
    ctx.globalAlpha = 0.5 * Math.sin(Math.PI * (1 - u));
    ctx.strokeStyle = 'rgba(180,255,160,0.8)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, y, b.w / 2 + 6 * Math.sin((1 - u) * 9), 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // drifting motes
  for (let i = 0; i < 4; i++) {
    const u = ((t * 0.24 + i / 4) % 1);
    ctx.fillStyle = `rgba(200,255,180,${0.7 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(t * 2 + i * 2.4) * b.w * 0.3, b.base - u * span, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // base glow where it meets the roof
  ctx.globalCompositeOperation = 'lighter';
  const bg = ctx.createRadialGradient(cx, b.base, 4, cx, b.base, b.w);
  bg.addColorStop(0, 'rgba(125,255,106,0.3)');
  bg.addColorStop(1, 'rgba(125,255,106,0)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(cx, b.base, b.w, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function drawCurio(ctx, c, t, hasGun) {
  const y = c.y + (c.t > 0 ? Math.sin(t * 22) * 1.6 : 0);
  ctx.save();
  ctx.translate(c.x, y);
  if (c.t > 0) ctx.rotate(Math.sin(t * 9) * 0.2);
  drawCurioIcon(ctx, c.type, t);
  ctx.restore();
  if (hasGun) {
    // the gun knows what it wants
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, y - 6, 2, c.x, y - 6, 26);
    g.addColorStop(0, `rgba(125,255,106,${0.25 + Math.sin(t * 3 + c.phase) * 0.1})`);
    g.addColorStop(1, 'rgba(125,255,106,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, y - 6, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (Math.sin(t * 2.2 + c.phase) > 0.9) {
    // a faint wink of strangeness for the unarmed
    ctx.fillStyle = 'rgba(200,255,180,0.5)';
    ctx.font = '600 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('?', c.x, y - 18);
  }
}

function drawCurioIcon(ctx, type, t) {
  switch (type) {
    case 'flamingo':
      ctx.strokeStyle = '#ff8ab5';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -12);
      ctx.stroke();
      ctx.fillStyle = '#ff8ab5';
      ctx.beginPath();
      ctx.ellipse(2, -15, 6, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(8, -19, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'cone':
      ctx.fillStyle = '#ff8a4d';
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-2, -16);
      ctx.lineTo(2, -16);
      ctx.lineTo(8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4f0ff';
      ctx.fillRect(-5, -8, 10, 3);
      break;
    case 'duck':
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.ellipse(0, -5, 7, 5, 0, 0, Math.PI * 2);
      ctx.arc(5, -10, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8a4d';
      ctx.fillRect(8, -10, 4, 2);
      break;
    case 'dish':
      ctx.fillStyle = '#b8b2c8';
      ctx.beginPath();
      ctx.ellipse(0, -8, 9, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8d83a3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(4, -14);
      ctx.moveTo(-3, 0);
      ctx.lineTo(0, -8);
      ctx.stroke();
      break;
    case 'bucket':
      ctx.fillStyle = '#8d83a3';
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.lineTo(6, -12);
      ctx.lineTo(4, 0);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#35e0e0';
      ctx.beginPath();
      ctx.ellipse(0, -12, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'record':
      ctx.fillStyle = '#191325';
      ctx.beginPath();
      ctx.arc(0, -8, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4fa3';
      ctx.beginPath();
      ctx.arc(0, -8, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'maraca':
      ctx.fillStyle = '#c9705e';
      ctx.fillRect(-1.5, -8, 3, 8);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.ellipse(0, -12, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'cafecito':
      ctx.fillStyle = '#f4f0ff';
      ctx.beginPath();
      ctx.moveTo(-5, -9);
      ctx.lineTo(5, -9);
      ctx.lineTo(3.4, 0);
      ctx.lineTo(-3.4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,226,242,0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(6, -5, 2.6, -1.2, 1.2);
      ctx.stroke();
      break;
    case 'propeller':
      ctx.fillStyle = '#b8b2c8';
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(0, -8);
        ctx.rotate((i / 3) * Math.PI * 2 + t * 0.4);
        ctx.beginPath();
        ctx.ellipse(0, -6, 2.6, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'token':
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, -7, 6.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6f2e';
      ctx.font = '800 8px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('0', 0, -4.4);
      break;
    case 'egg':
      ctx.fillStyle = '#f0ecd8';
      ctx.beginPath();
      ctx.ellipse(0, -7, 5.4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(90,120,80,0.5)';
      ctx.beginPath();
      ctx.arc(-2, -9, 1, 0, Math.PI * 2);
      ctx.arc(2, -5, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'shell':
      ctx.fillStyle = '#ffc2ce';
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.quadraticCurveTo(-8, -12, 0, -12);
      ctx.quadraticCurveTo(8, -12, 7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,90,110,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-4, -1);
      ctx.lineTo(-2, -10);
      ctx.moveTo(0, -1);
      ctx.lineTo(0, -11);
      ctx.moveTo(4, -1);
      ctx.lineTo(2, -10);
      ctx.stroke();
      break;
    default:
      ctx.fillStyle = '#b8b2c8';
      ctx.fillRect(-5, -10, 10, 10);
  }
}

function drawSpecimen(ctx, d, groundY, t) {
  // an abductee in a glass tube, bobbing in green suspension
  const x = d.x;
  const base = d.y || groundY;
  const h = d.h || 120;
  const w = d.w || 64;
  // pedestal
  ctx.fillStyle = '#2c3a36';
  ctx.fillRect(x - w / 2 - 8, base - 14, w + 16, 14);
  // tube glass + fluid
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, 'rgba(125,255,106,0.06)');
  g.addColorStop(0.5, 'rgba(125,255,106,0.16)');
  g.addColorStop(1, 'rgba(125,255,106,0.06)');
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, base - h, w, h - 14);
  ctx.strokeStyle = 'rgba(180,255,160,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - w / 2, base - h, w, h - 14);
  // cap
  ctx.fillStyle = '#2c3a36';
  ctx.fillRect(x - w / 2 - 6, base - h - 12, w + 12, 12);
  // the specimen, gently bobbing
  const bob = Math.sin(t * 1.1 + x) * 4;
  ctx.save();
  ctx.translate(x, base - h / 2 + bob);
  ctx.globalAlpha = 0.9;
  if (d.item === 'palm') {
    ctx.strokeStyle = '#24503a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(0, -6);
    ctx.stroke();
    ctx.strokeStyle = '#2e6e46';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(Math.cos(a) * 14, -6 + Math.sin(a) * 14, Math.cos(a) * 22, -2 + Math.sin(a) * 18);
      ctx.stroke();
    }
  } else if (d.item === 'car') {
    ctx.save();
    ctx.scale(0.42, 0.42);
    drawCar(ctx, -46, 16, d.hue || 320);
    ctx.restore();
  } else if (d.item === 'rooster') {
    ctx.save();
    ctx.scale(0.55, 0.55);
    drawRooster(ctx, 0, 36);
    ctx.restore();
  } else {
    // a very confused gull
    ctx.strokeStyle = '#d8d2c2';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(0, -8, 10, 0);
    ctx.stroke();
    ctx.fillStyle = '#f0ece0';
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#191325';
    ctx.beginPath();
    ctx.arc(4, 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // rising bubbles
  if (Math.random() < 0.12) {
    particles.burst(x + (Math.random() - 0.5) * w * 0.6, base - 20, {
      count: 1, color: 'rgba(180,255,160,0.5)', speed: 22, angle: -Math.PI / 2, spread: 0.2, life: 1.4, size: 1.6, gravity: -30, glow: false,
    });
  }
}

// ------------------------------------------------ landmarks
// Real Miami silhouettes drawn behind the playfield.

function drawLandmark(ctx, lm, t, groundY) {
  if (lm.type === 'miamitower') drawMiamiTower(ctx, lm, t, groundY);
  else if (lm.type === 'wynwoodgate') drawWynwoodGate(ctx, lm, groundY);
  else if (lm.type === 'stilthouse') drawStiltHouse(ctx, lm, t);
  else if (lm.type === 'ship') drawCruiseShip(ctx, lm, t);
  else if (lm.type === 'sharktower') drawSharkValleyTower(ctx, lm, t, groundY);
  else if (lm.type === 'freedomtower') drawFreedomTower(ctx, lm, t, groundY);
}

function drawMiamiTower(ctx, lm, t, groundY) {
  // I. M. Pei's tiered half-rounds, washed in changing light
  const x = lm.x;
  const w = lm.w || 250;
  const h = lm.h || 1500;
  const base = groundY;
  const hue = 185 + Math.sin(t * 0.13) * 55; // the slow color-change cycle
  ctx.fillStyle = '#171226';
  ctx.fillRect(x + w * 0.2, base - h * 0.55, w * 0.6, h * 0.55);
  // drawn bottom tier first so each dome above reads against the one below
  const tiers = [
    { yTop: base - h * 0.6, yBot: base - h * 0.28, half: w * 0.74, tone: '#1f1936' },
    { yTop: base - h * 0.82, yBot: base - h * 0.56, half: w * 0.6, tone: '#2a2348' },
    { yTop: base - h, yBot: base - h * 0.78, half: w * 0.46, tone: '#372e5c' },
  ];
  const cx = x + w / 2;
  // pass 1: tier bodies (bottom to top so setbacks read as steps)
  for (const tr of tiers) {
    ctx.fillStyle = tr.tone;
    ctx.beginPath();
    ctx.moveTo(cx - tr.half, tr.yBot);
    ctx.lineTo(cx - tr.half, tr.yTop + 24);
    ctx.arc(cx, tr.yTop + 24, tr.half, Math.PI, 0);
    ctx.lineTo(cx + tr.half, tr.yBot);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(240,240,255,0.10)';
    for (let wy = tr.yTop + 34; wy < tr.yBot - 8; wy += 26) {
      ctx.fillRect(cx - tr.half + 10, wy, tr.half * 2 - 20, 3);
    }
  }
  // pass 2: the neon rims on every dome, over everything, so the
  // color-change lighting traces all three setbacks
  ctx.globalCompositeOperation = 'lighter';
  for (const tr of tiers) {
    for (const [lw, a] of [[9, 0.16], [2.4, 0.85]]) {
      ctx.strokeStyle = `hsla(${hue}, 95%, 66%, ${a})`;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(cx, tr.yTop + 24, tr.half - 2, Math.PI, 0);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // mast
  ctx.strokeStyle = '#241d3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, groundY - h);
  ctx.lineTo(x + w / 2, groundY - h - 60);
  ctx.stroke();
  if (Math.sin(t * 2.1) > 0.2) {
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(x + w / 2, groundY - h - 64, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWynwoodGate(ctx, lm, groundY) {
  // the WYNWOOD WALLS entry: white wall, black gate, stencil letters
  const x = lm.x;
  const w = lm.w || 340;
  const hWall = 130;
  ctx.fillStyle = '#d8d2c8';
  ctx.fillRect(x, groundY - hWall, w, hWall);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x, groundY - hWall, w, 8);
  ctx.fillRect(x, groundY - 26, w, 26);
  // gate opening
  ctx.fillStyle = '#171226';
  ctx.fillRect(x + w / 2 - 44, groundY - 104, 88, 104);
  ctx.strokeStyle = 'rgba(220,210,200,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let gx = x + w / 2 - 36; gx < x + w / 2 + 40; gx += 12) {
    ctx.moveTo(gx, groundY - 100);
    ctx.lineTo(gx, groundY - 4);
  }
  ctx.stroke();
  // stencil lettering
  ctx.fillStyle = '#191325';
  ctx.font = '800 20px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WYNWOOD', x + w / 2, groundY - hWall + 34);
  ctx.fillText('WALLS', x + w / 2, groundY - hWall + 62);
  // spray accents
  for (const [ax, hue] of [[x + 36, 320], [x + w - 40, 185], [x + 60, 45]]) {
    ctx.fillStyle = `hsla(${hue}, 85%, 60%, 0.5)`;
    ctx.beginPath();
    ctx.arc(ax, groundY - 44 - (ax % 30), 12 + (ax % 9), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStiltHouse(ctx, lm, t) {
  // Stiltsville: a wooden shack standing in the bay haze
  const x = lm.x;
  const y = lm.y;
  const s = lm.scale || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = 0.8;
  // stilts
  ctx.strokeStyle = '#241d30';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const sx of [-42, -16, 16, 42]) {
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx * 1.08, 46);
  }
  ctx.stroke();
  // deck and cabin
  ctx.fillStyle = '#2c2438';
  ctx.fillRect(-56, -8, 112, 8);
  ctx.fillStyle = '#382d48';
  ctx.fillRect(-40, -52, 80, 44);
  // hip roof
  ctx.fillStyle = '#241d30';
  ctx.beginPath();
  ctx.moveTo(-50, -52);
  ctx.lineTo(-20, -72);
  ctx.lineTo(20, -72);
  ctx.lineTo(50, -52);
  ctx.closePath();
  ctx.fill();
  // one lit window
  ctx.fillStyle = 'rgba(255,214,150,0.75)';
  ctx.fillRect(-10, -40, 14, 12);
  // water lap lines at the stilts
  ctx.strokeStyle = 'rgba(140,220,220,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const sx of [-42, 16]) {
    const wob = Math.sin(t * 1.8 + sx) * 3;
    ctx.moveTo(sx - 12 + wob, 44);
    ctx.lineTo(sx + 12 + wob, 44);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCruiseShip(ctx, lm, t) {
  // a PortMiami cruise liner glowing through the rain
  const x = lm.x;
  const y = lm.y;
  const s = lm.scale || 1;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.6) * 1.5);
  ctx.scale(s, s);
  ctx.globalAlpha = 0.85;
  // hull
  ctx.fillStyle = '#1c1630';
  ctx.beginPath();
  ctx.moveTo(-190, 0);
  ctx.lineTo(190, 0);
  ctx.lineTo(168, 26);
  ctx.lineTo(-176, 26);
  ctx.closePath();
  ctx.fill();
  // superstructure decks
  ctx.fillStyle = '#262040';
  ctx.fillRect(-150, -46, 300, 46);
  ctx.fillRect(-120, -68, 230, 22);
  // funnel
  ctx.fillStyle = '#332a52';
  ctx.beginPath();
  ctx.moveTo(60, -68);
  ctx.lineTo(96, -68);
  ctx.lineTo(88, -96);
  ctx.lineTo(70, -96);
  ctx.closePath();
  ctx.fill();
  // rows of cabin lights
  ctx.fillStyle = 'rgba(255,214,150,0.55)';
  for (const dy of [-12, -34, -56]) {
    for (let lx = -170; lx < 180; lx += 13) {
      if ((lx * 7 + dy * 13) % 5 === 0) continue;
      ctx.fillRect(lx, dy, 5, 3.4);
    }
  }
  // waterline glow
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, 26, 0, 44);
  g.addColorStop(0, 'rgba(255,200,140,0.16)');
  g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-180, 26, 360, 18);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function drawSharkValleyTower(ctx, lm, t, groundY) {
  // the Shark Valley observation tower: concrete stem, round deck,
  // and the long spiral ramp curling up to it
  const x = lm.x;
  const top = lm.y0;
  const base = lm.y1 ?? groundY;
  // stem
  const g = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
  g.addColorStop(0, '#6e6858');
  g.addColorStop(0.5, '#5a5448');
  g.addColorStop(1, '#3e3a32');
  ctx.fillStyle = g;
  ctx.fillRect(x - 18, top + 30, 36, base - top - 30);
  // spiral ramp sweeping around the stem
  ctx.strokeStyle = '#6e6858';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(x - 150, base - 40);
  ctx.bezierCurveTo(x - 190, base - 170, x + 130, base - 230, x + 120, base - 340);
  ctx.bezierCurveTo(x + 110, base - 450, x - 120, base - 440, x - 90, top + 150);
  ctx.quadraticCurveTo(x - 70, top + 80, x - 20, top + 62);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,16,12,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 150, base - 46);
  ctx.bezierCurveTo(x - 190, base - 176, x + 130, base - 236, x + 120, base - 346);
  ctx.bezierCurveTo(x + 110, base - 456, x - 120, base - 446, x - 90, top + 144);
  ctx.stroke();
  // round observation deck
  ctx.fillStyle = '#5a5448';
  ctx.beginPath();
  ctx.ellipse(x, top + 34, 74, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6e6858';
  ctx.fillRect(x - 74, top + 10, 148, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.fillRect(x - 74, top + 10, 148, 4);
  // deck rail
  ctx.strokeStyle = '#3e3a32';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 72, top - 6);
  ctx.lineTo(x + 72, top - 6);
  for (let rx = x - 68; rx < x + 72; rx += 14) {
    ctx.moveTo(rx, top - 6);
    ctx.lineTo(rx, top + 10);
  }
  ctx.stroke();
}

function drawFreedomTower(ctx, lm, t, groundY) {
  // the Freedom Tower's wedding-cake crown, Mediterranean yellow
  const x = lm.x;
  const w = lm.w || 190;
  const h = lm.h || 1150;
  const base = groundY;
  ctx.fillStyle = '#3a2f28';
  ctx.fillRect(x, base - h * 0.62, w, h * 0.62);
  // window grid on the block
  ctx.fillStyle = 'rgba(255,214,150,0.12)';
  for (let wy = base - h * 0.6; wy < base - 60; wy += 34) {
    for (let wx = x + 12; wx < x + w - 14; wx += 24) {
      if ((wx * 7 + wy * 3) % 4 === 0) continue;
      ctx.fillRect(wx, wy, 8, 12);
    }
  }
  // tiered tower
  const cx = x + w / 2;
  const tiers = [
    { hw: w * 0.2, y0: base - h * 0.92, y1: base - h * 0.62 },
    { hw: w * 0.14, y0: base - h * 0.99, y1: base - h * 0.9 },
    { hw: w * 0.08, y0: base - h * 1.05, y1: base - h * 0.98 },
  ];
  for (const tr of tiers) {
    ctx.fillStyle = '#463a30';
    ctx.fillRect(cx - tr.hw, tr.y0, tr.hw * 2, tr.y1 - tr.y0);
    ctx.fillStyle = '#57483a';
    ctx.fillRect(cx - tr.hw - 6, tr.y1 - 8, tr.hw * 2 + 12, 8);
  }
  // amber floodwash on the crown
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, base - h * 1.05, 0, base - h * 0.6);
  g.addColorStop(0, 'rgba(255,190,110,0.3)');
  g.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - w * 0.24, base - h * 1.05, w * 0.48, h * 0.45);
  ctx.globalCompositeOperation = 'source-over';
  // cupola beacon
  ctx.fillStyle = '#ffd9a8';
  ctx.beginPath();
  ctx.arc(cx, base - h * 1.05 - 5, 4, 0, Math.PI * 2);
  ctx.fill();
}
