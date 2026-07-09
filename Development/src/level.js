// Level engine: builds collision + entities from a plain data object
// (see src/levels/) and renders the world.

import { audio } from './audio.js';
import { particles } from './particles.js';
import { ABILITIES } from './abilities.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LAUNCH_VY = 1320;

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
      if (p.solid) this.solids.push({ x: p.x, y: p.y, w: p.w, h: p.boxH || 40, plat: p });
      else this.oneWays.push(rect);
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

    this.shinies = data.shinies.map(([x, y], i) => ({ x, y, ox: x, oy: y, got: false, phase: i * 0.7 }));
    this.shinyTotal = this.shinies.length;

    this.pickups = data.pickups.map((p) => ({ ...p, got: false, phase: Math.random() * 6 }));
    this.checkpoints = data.checkpoints.map((c) => ({ ...c, active: false }));
    this.goal = { ...data.goal, lit: 0, reached: false };
    this.decor = data.decor || [];
    this.hints = data.hints || [];

    // pre-render building facades
    for (const b of data.buildings) {
      b.cache = renderBuilding(b, this.groundY);
    }
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
        audio.collect();
        particles.burst(s.x, s.y, { count: 8, color: '#ffd166', speed: 150, life: 0.4, size: 2.2, gravity: 100 });
        game.ui.setShinies(game.shinies, this.shinyTotal);
      }
    }

    // ability pickups
    for (const p of this.pickups) {
      if (p.got || player.dead > 0) continue;
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
    if (!this.goal.reached && player.dead <= 0) {
      const g = this.goal;
      if (Math.abs(player.x - g.x) < 110 && player.y > g.y - 190 && player.y < g.y + 30) {
        g.reached = true;
        game.beginOutro();
      }
    }
    if (this.goal.reached) {
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
  }

  // ------------------------------------------------ drawing
  draw(ctx, cam, t, player) {
    const x0 = cam.x - 60;
    const x1 = cam.x + cam.viewW + 60;

    // interior/underground backdrops first so the sky never shows through
    for (const z of this.backdrops) {
      drawBackdrop(ctx, z);
    }

    this.drawGround(ctx, cam, x0, x1);

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

    // structure blocks (sewer masonry, breakables)
    for (const s of this.solids) {
      if (!s.kind || s.broken) continue;
      if (s.x + s.w < x0 || s.x > x1) continue;
      drawBlock(ctx, s, t, player);
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

    // hazards: sagging live wires
    for (const hz of this.hazards) {
      if (hz.x2 < x0 || hz.x1 > x1) continue;
      drawWireHazard(ctx, hz, t);
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

    // goal sign
    drawGoal(ctx, this.goal, t);
  }

  drawGround(ctx, cam, x0, x1) {
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

  // windows
  const litHues = [45, 45, 45, 185, 320];
  for (let wy = 30; wy < b.h - 26; wy += 34) {
    for (let wx = 15; wx < b.w - 28; wx += 27) {
      if (b.style === 'deco' && wx > b.w * 0.5 - 22 && wx < b.w * 0.5 + 4) continue;
      const lit = rand() < 0.36;
      if (lit) {
        const lh = litHues[Math.floor(rand() * litHues.length)];
        ctx.fillStyle = `hsla(${lh}, 90%, ${62 + rand() * 16}%, ${0.5 + rand() * 0.4})`;
      } else {
        ctx.fillStyle = 'rgba(10,12,22,0.85)';
      }
      ctx.fillRect(wx, wy, 15, 21);
      if (lit && rand() < 0.4) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(wx, wy + 9, 15, 2);
      }
    }
  }

  // parapet
  ctx.fillStyle = `hsl(${hue}, 24%, 24%)`;
  ctx.fillRect(-4, -2, b.w + 8, 12);

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
    ctx.fillStyle = `hsla(${Math.floor(rand() * 360)}, 75%, ${45 + rand() * 20}%, 0.85)`;
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
  ctx.strokeStyle = '#1e2b2a';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.44 + sway * 0.01;
    const len = h * 0.52;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.6 - 6,
      topX + Math.cos(a) * len, topY + Math.sin(a) * len + len * 0.3
    );
    ctx.stroke();
  }
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
