// Boot, game loop, and state machine.
// States: menus (DOM screens) -> playing -> outro -> complete.

import { initInput, input } from './input.js';
import { initSprites } from './sprites.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { particles } from './particles.js';
import { Camera } from './camera.js';
import { Background } from './background.js';
import { FX } from './fx.js';
import { gfx } from './gfx.js';
import { Player } from './player.js';
import { Level } from './level.js';
import { getLevelData } from './levels/index.js';
import { UI } from './ui.js';

const STEP = 1 / 120;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const flashEl = document.getElementById('flash');

const game = {
  mode: 'menu', // 'menu' | 'play' | 'outro' | 'complete'
  paused: false,
  levelId: null,
  level: null,
  player: null,
  checkpoint: null,
  shinies: 0,
  runTime: 0,
  freeze: 0,
  outroT: 0,
  time: 0,
  pan: null,
  ui: null,

  hitstop(t) {
    this.freeze = Math.max(this.freeze, t);
    if (gfx.chroma) fx.pulse(Math.min(1, t * 5));
  },

  flash(strength = 0.5) {
    flashEl.style.transition = 'none';
    flashEl.style.opacity = strength;
    requestAnimationFrame(() => {
      flashEl.style.transition = 'opacity 0.45s ease';
      flashEl.style.opacity = 0;
    });
  },

  launchLevel(id, opts = {}) {
    const data = getLevelData(id);
    if (!data) return;
    this.levelId = id;
    this.level = new Level(data);
    // mega-map arrivals come in through a named entry, carrying every
    // ability earned on the way here
    const entry = opts.entry && this.level.entries[opts.entry];
    const spawn = entry ? { ...entry } : this.level.spawn;
    this.player = new Player(spawn);
    // seam crossings keep the crow's stride so the swap reads as one world
    if (opts.momentum) {
      this.player.vx = opts.momentum.vx;
      this.player.facing = opts.momentum.facing;
    }
    save.setFlag(`seen:${id}`);
    for (const a of data.initialAbilities || []) this.player.grant(a);
    if (opts.carry) {
      for (const [a, owned] of Object.entries(opts.carry)) {
        if (owned) this.player.grant(a);
      }
    }
    // post-game reward: True Flight carries into every district
    if (save.getLevel('river-of-grass')?.completed && !this.player.abilities.flight) {
      this.player.grant('flight');
    }
    // the ray gun, once beamed down with, is yours forever
    if (save.getFlag('raygun') && !this.player.abilities.raygun) {
      this.player.grant('raygun');
    }
    this.checkpoint = { ...spawn };
    this.shinies = 0;
    this.runTime = 0;
    this.outroT = 0;
    this.freeze = 0;
    this.breakableHinted = false;
    this.mode = 'play';
    this.paused = false;
    input.locked = false;
    input.clear();
    particles.clear();
    resolveHints(this.level);
    camera.resize(innerWidth, innerHeight);
    camera.snapTo(this.player.x, this.player.y, this.level);
    this.ui.show(null);
    this.ui.setShinies(0, this.level.shinyTotal);
    const abilityOrder = [...new Set([
      ...(data.initialAbilities || []),
      ...Object.keys(opts.carry || {}).filter((a) => opts.carry[a]),
      ...data.pickups.map((p) => p.ability),
      ...(data.boss ? [data.boss.drops] : []),
      ...(this.player.abilities.raygun ? ['raygun'] : []),
      ...(this.player.abilities.flight ? ['flight'] : []),
    ])];
    this.ui.buildAbilitySlots(abilityOrder, this.player.abilities);
    if (opts.entry) {
      // a completed district's sign stays lit and never replays its outro
      if (this.level.goal && save.getLevel(id)?.completed) {
        this.level.goal.reached = true;
        this.level.goal.lit = 1;
      }
    }
  },

  // crossing a seam: swap zones instantly behind a short camera pan, so the
  // city reads as one continuous place - no fade, no loading beat
  beginExit(exit) {
    if (this.pan || this.mode !== 'play') return;
    const carry = { ...this.player.abilities };
    const momentum = { vx: this.player.vx, facing: this.player.facing };
    const snap = document.createElement('canvas');
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext('2d').drawImage(canvas, 0, 0);
    audio.glide(false);
    this.launchLevel(exit.to, { entry: exit.entry, carry, momentum });
    this.pan = { snap, t: 0, dur: 0.55, dx: exit.dir || 0, dy: exit.vdir || 0 };
    input.locked = true;
  },

  tickPan(dt) {
    if (!this.pan) return;
    this.pan.t += dt;
    if (this.pan.t >= this.pan.dur) {
      this.pan = null;
      if (this.mode === 'play') input.locked = false;
    }
  },

  quitToMenu() {
    this.mode = 'menu';
    this.paused = false;
    this.pan = null;
    audio.setPaused(false);
    input.locked = false;
    input.clear();
    this.ui.show('title');
  },

  // the Magpie's stall: browsing pauses the world under the shop overlay
  openShop() {
    if (this.mode !== 'play' || this.paused || this.pan) return;
    this.paused = true;
    audio.setPaused(true);
    audio.glide(false);
    this.ui.showShop();
  },

  closeShop() {
    if (this.mode !== 'play' || !this.paused) return;
    this.paused = false;
    audio.setPaused(false);
    this.ui.show(null);
  },

  togglePause(force) {
    if (this.mode !== 'play') return;
    if (this.pan) return; // no pausing mid seam-crossing
    this.paused = force !== undefined ? force : !this.paused;
    audio.setPaused(this.paused);
    audio.glide(false);
    if (this.paused) this.ui.showPause();
    else this.ui.show(null);
  },

  onAbility(ability) {
    this.ui.setAbility(ability);
    this.ui.abilityToast(ability);
    if (ability === 'raygun') save.setFlag('raygun');
  },

  onBlockedBreakable() {
    if (this.breakableHinted) return;
    this.breakableHinted = true;
    this.ui.toast('CRACKED BRICKS', 'too tough for beak and talon alone - a skill somewhere nearby can smash them');
  },

  onRespawn() {
    camera.snapTo(this.player.x, this.player.y, this.level);
    this.flash(0.15);
    this.level.boss?.reset();
  },

  beginOutro() {
    this.mode = 'outro';
    this.outroT = 0;
    input.locked = true;
    audio.glide(false);
    this.goalLettersLit = 0;
  },

  finishLevel() {
    this.mode = 'complete';
    const data = this.level.data;
    const timeMs = Math.round(this.runTime * 1000);
    save.recordRun(data.id, this.shinies, this.level.shinyTotal, timeMs);
    const stats = save.getLevel(data.id);
    this.ui.showComplete(data, this.shinies, this.level.shinyTotal, timeMs, stats);
  },
};

function resolveHints(level) {
  for (const h of level.hints) {
    const raw = !input.usingTouch && h.kb ? h.kb : h.text;
    h.resolved = raw
      .replaceAll('{JUMP}', input.usingTouch ? 'tap the big button' : 'SPACE')
      .replaceAll('{DASH}', input.usingTouch ? 'the pink button' : 'SHIFT')
      .replaceAll('{MOVE}', input.usingTouch ? 'hold the arrows to' : 'A / D');
  }
}

const camera = new Camera();
const background = new Background();
const fx = new FX();
const panCanvas = document.createElement('canvas');
const panCtx = panCanvas.getContext('2d');
let dpr = 1;

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  camera.resize(innerWidth, innerHeight);
  if (game.level && game.player && game.mode !== 'menu') {
    camera.clamp(game.level);
  }
  game.ui?.updateRotateHint();
}

// ------------------------------------------------ loop

let last = performance.now();
let acc = 0;
let timerSecondShown = -1;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.1);
  fx.frame(now - last);
  last = now;
  game.time += dt;

  game.tickPan(dt);
  if (game.pan) {
    // world holds still while the camera pans across the seam
  } else if ((game.mode === 'play' || game.mode === 'outro') && !game.paused) {
    if (game.freeze > 0) {
      game.freeze -= dt;
    } else if (game.mode === 'play') {
      input.update(dt);
      acc = Math.min(acc + dt, STEP * 6);
      while (acc >= STEP) {
        game.player.update(STEP, game.level, game);
        game.level.update(STEP, game.player, game, game.time);
        acc -= STEP;
        // a seam swap mid-substep freezes the world for the pan
        if (game.mode !== 'play' || game.pan) break;
      }
      if (game.player.dead <= 0) game.runTime += dt;
      camera.follow(game.player, game.level, dt);
      game.level.ambience(dt, camera);

      const sec = Math.floor(game.runTime);
      if (sec !== timerSecondShown) {
        timerSecondShown = sec;
        game.ui.setTimer(sec);
      }
    } else {
      updateOutro(dt);
    }
    particles.update(dt);
  }

  render();
}

function updateOutro(dt) {
  game.outroT += dt;
  const level = game.level;
  const goal = level.goal;
  goal.lit = Math.min(1, Math.max(goal.lit, (game.outroT - 0.5) / 2.2));

  // letter tick sounds as the sign lights
  const letters = Math.floor(goal.lit * 9);
  while (game.goalLettersLit < letters) {
    audio.goalLetter(game.goalLettersLit);
    game.goalLettersLit++;
  }

  // settle the crow onto the goal rooftop (goal.y is the roof line)
  const p = game.player;
  p.vx *= 1 - 3 * dt;
  p.vy += 2300 * dt;
  p.y += p.vy * dt;
  p.x += p.vx * dt;
  const roofY = level.goal.y;
  if (p.y > roofY - p.h / 2) {
    p.y = roofY - p.h / 2;
    p.vy = 0;
    p.grounded = true;
  }

  camera.easeTo(goal.x, goal.y - 120, level, dt);

  if (game.outroT > 1 && Math.random() < dt * 6) {
    particles.burst(
      goal.x + (Math.random() - 0.5) * 300,
      goal.y - 200 - Math.random() * 160,
      { count: 16, color: ['#ff4fa3', '#35e0e0', '#ffd166'][Math.floor(Math.random() * 3)], speed: 240, life: 0.9, size: 2.4, gravity: 220 }
    );
  }
  if (game.outroT === dt) audio.goal();
  if (Math.abs(game.outroT - 0.5) < dt) audio.goal();
  if (game.outroT > 4.4) game.finishLevel();
}

function render() {
  if (canvas.width === 0 || canvas.height === 0) return; // minimized or hidden window
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;

  const inWorld = game.level && game.mode !== 'menu';
  background.draw(
    ctx, camera, cssW, cssH, game.time,
    inWorld ? game.level.groundY : 1500,
    inWorld ? game.level.skyMood(game.player) : 'dusk',
    inWorld ? game.level.data.horizon || 'city' : 'city'
  );

  if (inWorld) {
    ctx.save();
    camera.applyShake(ctx, game.time);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);
    game.level.draw(ctx, camera, game.time, game.player);
    particles.draw(ctx);
    game.player.draw(ctx);
    ctx.restore();
    fx.lighting(ctx, camera, cssW, cssH, game.level.data.ambient, game.level.getLights(camera, game.time, game.player));
    game.level.drawDarkness(ctx, camera, game.player, cssW, cssH);
    fx.grade(ctx, cssW, cssH, game.level.data.grade);
    if (gfx.foreground && fx.quality >= 1) {
      background.foreground(ctx, camera, cssW, cssH, game.level.data.horizon || 'city');
    }
    if (game.level.data.weather === 'rain') {
      background.rain(ctx, camera, cssW, cssH, game.time);
    }
    if (gfx.chroma) fx.chroma(ctx, canvas, cssW, cssH);
  }
  fx.bloom(ctx, canvas, cssW, cssH, inWorld ? game.level.data.bloom ?? 0.34 : 0.3);
  if (gfx.grain) fx.grain(ctx, cssW, cssH);

  // vignette
  const v = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.42, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(5,2,12,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, cssW, cssH);

  // seam crossing: the just-rendered destination and a snapshot of where we
  // came from tile edge-to-edge and slide together, so the swap plays as one
  // continuous camera pan across the city (a dissolve when the travel has no
  // direction - the tractor beam).
  if (game.pan) {
    const p = Math.min(1, game.pan.t / game.pan.dur);
    const e = p * p * (3 - 2 * p);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = canvas.width;
    const H = canvas.height;
    if (game.pan.dx || game.pan.dy) {
      if (panCanvas.width !== W || panCanvas.height !== H) {
        panCanvas.width = W;
        panCanvas.height = H;
      }
      panCtx.setTransform(1, 0, 0, 1, 0, 0);
      panCtx.drawImage(canvas, 0, 0);
      ctx.drawImage(panCanvas, game.pan.dx * (1 - e) * W, game.pan.dy * (1 - e) * H);
      ctx.drawImage(game.pan.snap, -game.pan.dx * e * W, -game.pan.dy * e * H);
    } else {
      ctx.globalAlpha = 1 - e;
      ctx.drawImage(game.pan.snap, 0, 0);
      ctx.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------ boot

gfx.init();
fx.cap = gfx.fxCap;
initSprites();
initInput();
game.camera = camera;
game.ui = new UI(game);
input.onPause = () => game.togglePause();
input.onAny = () => audio.unlock();

addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 120));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'play' && !game.paused) game.togglePause(true);
});

resize();
game.ui.show('title');
requestAnimationFrame(frame);

// debug handle for automated testing: load with ?debug=1
if (location.search.includes('debug')) {
  window.__cg = {
    game,
    camera,
    input,
    get player() { return game.player; },
    get level() { return game.level; },
    // advance the simulation without rAF (hidden tabs suspend rAF)
    step(dt = STEP, frames = 1) {
      for (let i = 0; i < frames; i++) {
        game.time += dt;
        game.tickPan(dt);
        if (game.pan) {
          // world holds still mid seam-crossing
        } else if (game.mode === 'play' && !game.paused) {
          input.update(dt);
          game.player.update(dt, game.level, game);
          if (game.mode === 'play') game.level.update(dt, game.player, game, game.time);
          if (game.player.dead <= 0) game.runTime += dt;
          camera.follow(game.player, game.level, dt);
        } else if (game.mode === 'outro') {
          updateOutro(dt);
        }
        particles.update(dt);
      }
      render();
    },
  };
}
