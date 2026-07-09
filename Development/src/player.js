// The crow: movement physics and procedural drawing.
// Abilities: hop + talon grip (innate), wing flap (double jump),
// glide (hold jump while falling), swoop (air dash).

import { input } from './input.js';
import { audio } from './audio.js';
import { particles } from './particles.js';

const G = 2300;
const MOVE = 345;
// gentler ramps: ~0.14s to top speed grounded, ~0.25s airborne, so the
// crow banks into moves instead of snapping to full speed
const ACCEL_GROUND = 2400;
const ACCEL_AIR = 1400;
const FRICTION = 2300;
const JUMP_V = 850;
const FLAP_V = 700;
const JUMP_CUT = 0.42;
const COYOTE = 0.1;
const TERMINAL = 1250;
const GLIDE_FALL = 135;
const WALL_SLIDE_MAX = 165;
const WALL_JUMP_VX = 410;
const WALL_JUMP_VY = 760;
const WALL_LOCK = 0.12;
const DASH_V = 920;
const DASH_TIME = 0.17;
const DASH_CD = 0.45;
const VENT_ACCEL = 3400;
const VENT_MAX_RISE = 470;
const ROLL_TIME = 0.42;
const ROLL_SPEED = 480;
const CLIMB_SPEED = 230;
const HOOK_RADIUS = 85;
const GRIND_BASE = 380;
const GRIND_MAX = 940;
const GRIND_SNAP = 20;
const FLY_RISE = -300;
const STAMINA_MAX = 3;

export class Player {
  constructor(spawn) {
    this.w = 30;
    this.h = 26;
    this.abilities = { flap: false, glide: false, swoop: false, break: false, launch: false, soar: false, roll: false, grip: false, hook: false, grind: false, wind: false, flight: false };
    this.respawnAt(spawn);
    this.facing = 1;
    this.animT = Math.random() * 10;
    this.blinkT = 2 + Math.random() * 3;
  }

  respawnAt(p) {
    this.x = p.x;
    this.y = p.y;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.wall = 0;
    this.coyote = 0;
    this.usedFlap = false;
    this.gliding = false;
    this.dashing = 0;
    this.dashCd = 0;
    this.dashReady = true;
    this.wallLock = 0;
    this.dead = 0;
    this.invuln = 1.2;
    this.flapT = 0;
    this.landT = 0;
    this.launchT = 0;
    this.inVent = false;
    this.runPhase = 0;
    this.groundPlat = null;
    this.h = 26;
    this.rolling = 0;
    this.rollPhase = 0;
    this.climbing = false;
    this.hooked = null;
    this.hookCd = 0;
    this.grindRail = null;
    this.grindCd = 0;
    this.windZone = null;
    this.flying = false;
    this.stamina = STAMINA_MAX;
    this.ghosts = [];
    this._ghostTick = 0;
  }

  tryUnroll(level) {
    const bottom = this.y + this.h / 2;
    const probe = { x: this.x - this.w / 2, y: bottom - 26, w: this.w, h: 26 };
    for (const s of level.solids) {
      if (s.broken || s.off) continue;
      if (probe.x < s.x + s.w && probe.x + probe.w > s.x && probe.y < s.y + s.h && probe.y + probe.h > s.y) {
        this.rolling = 0.1; // no headroom yet: stay tucked a beat longer
        return;
      }
    }
    this.h = 26;
    this.y = bottom - 13;
  }

  rect() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  update(dt, level, game) {
    this.animT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.landT > 0) this.landT -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.wallLock > 0) this.wallLock -= dt;
    if (this.hookCd > 0) this.hookCd -= dt;
    if (this.grindCd > 0) this.grindCd -= dt;
    if (this.rolling > 0) {
      this.rolling -= dt;
      this.rollPhase += dt * 15;
      if (this.rolling <= 0) this.tryUnroll(level);
    }
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3.5;

    // afterimage trail while moving fast
    if (this.dashing > 0 || this.launchT > 0.1 || this.rolling > 0) {
      this._ghostTick += dt;
      if (this._ghostTick > 0.03) {
        this._ghostTick = 0;
        this.ghosts.push({ x: this.x, y: this.y, f: this.facing, t: 0 });
        if (this.ghosts.length > 8) this.ghosts.shift();
      }
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].t += dt;
      if (this.ghosts[i].t > 0.3) this.ghosts.splice(i, 1);
    }

    if (this.dead > 0) {
      this.dead -= dt;
      if (this.dead <= 0) {
        this.respawnAt(game.checkpoint);
        game.onRespawn();
      }
      return;
    }

    // hanging from a crane hook: sway until the player launches off
    if (this.hooked) {
      this.x = this.hooked.x + Math.sin(this.animT * 2) * 3;
      this.y = this.hooked.y + 16;
      this.vx = 0;
      this.vy = 0;
      this.stamina = STAMINA_MAX;
      if (input.consumeJump()) {
        const dir = input.moveX !== 0 ? input.moveX : this.facing;
        this.facing = dir >= 0 ? 1 : -1;
        this.hooked.held = false;
        this.hooked = null;
        this.hookCd = 0.4;
        this.vy = -500;
        this.vx = this.facing * 730;
        this.launchT = 0.35;
        this.usedFlap = false;
        this.dashReady = true;
        this.flapT = 1;
        audio.launch();
        particles.feathers(this.x, this.y, 3, this.facing);
      } else {
        return;
      }
    }

    // grinding a wire: slide along it until the crow hops off or it ends
    if (this.grindRail) {
      const r = this.grindRail;
      // gravity feeds downhill runs and bleeds uphill ones
      this.grindSpeed += r.uy * this.grindDir * G * 0.9 * dt;
      this.grindSpeed = Math.min(this.grindSpeed, GRIND_MAX);
      this.grindPos += this.grindSpeed * this.grindDir * dt;
      const offEnd = this.grindPos < 0 || this.grindPos > r.len;
      const at = Math.max(0, Math.min(r.len, this.grindPos));
      this.x = r.x1 + r.ux * at;
      this.y = r.y1 + r.uy * at - this.h / 2 - 3;
      this.vx = r.ux * this.grindSpeed * this.grindDir;
      this.vy = r.uy * this.grindSpeed * this.grindDir;
      if (this.vx !== 0) this.facing = this.vx > 0 ? 1 : -1;
      this.usedFlap = false;
      this.dashReady = true;
      this.stamina = STAMINA_MAX;
      if (Math.random() < 0.55) {
        particles.trail(this.x - this.facing * 8, this.y + this.h / 2 + 3, 'rgba(242,233,99,0.8)');
      }
      if (input.consumeJump()) {
        this.grindRail = null;
        this.grindCd = 0.25;
        this.vy = -560;
        this.flapT = 1;
        audio.jump();
        particles.dust(this.x, this.y + this.h / 2);
      } else if (offEnd || this.grindSpeed < 90) {
        // flew off the end, or stalled out on an uphill stretch
        this.grindRail = null;
        this.grindCd = 0.2;
        if (offEnd) this.vy -= 90;
      } else {
        return;
      }
    }

    const move = input.moveX;
    if (move !== 0 && this.wallLock <= 0) this.facing = move;

    // ---- horizontal ----
    if (this.dashing > 0) {
      this.dashing -= dt;
      this.vx = this.dashDir * DASH_V;
      this.vy = 0;
      particles.trail(this.x - this.dashDir * 12, this.y + (Math.random() - 0.5) * 12, 'rgba(255,79,163,0.85)');
    } else if (this.rolling > 0) {
      this.vx = this.rollDir * ROLL_SPEED;
    } else if (this.wallLock > 0) {
      // brief lockout after a wall kick so it actually launches
    } else if (move !== 0) {
      const accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;
      // steering never hard-clamps launch/kick momentum: excess speed decays.
      // The cap comes from the speed BEFORE this frame's accel, otherwise
      // steering input would outrun the decay and accelerate forever.
      const cap = Math.max(MOVE, Math.abs(this.vx) - 900 * dt);
      this.vx += move * accel * dt;
      this.vx = Math.max(-cap, Math.min(cap, this.vx));
    } else if (this.grounded) {
      const s = Math.sign(this.vx);
      this.vx -= s * FRICTION * dt;
      if (Math.sign(this.vx) !== s) this.vx = 0;
    } else {
      this.vx *= 1 - 1.1 * dt;
    }

    // ---- jumping (locked out while tumbling) ----
    if (this.rolling <= 0 && input.consumeJump()) {
      if (this.grounded || this.coyote > 0) {
        this.vy = -JUMP_V;
        this.grounded = false;
        this.coyote = 0;
        this.flapT = 1;
        audio.jump();
        particles.dust(this.x, this.y + this.h / 2);
      } else if (this.wall !== 0 && !this.grounded) {
        this.vy = -WALL_JUMP_VY;
        this.vx = -this.wall * WALL_JUMP_VX;
        this.facing = -this.wall;
        this.wallLock = WALL_LOCK;
        this.usedFlap = false;
        this.flapT = 1;
        audio.jump();
        particles.dust(this.x + this.wall * this.w / 2, this.y);
      } else if (this.abilities.flap && !this.usedFlap) {
        this.vy = -FLAP_V;
        this.usedFlap = true;
        this.flapT = 1;
        audio.flap();
        particles.feathers(this.x, this.y + 6, 3, -this.facing * 0.4);
        particles.burst(this.x, this.y + 10, { count: 6, color: 'rgba(169,143,255,0.9)', speed: 90, angle: Math.PI / 2, spread: 1.6, life: 0.35, size: 2, gravity: -60 });
      }
    }

    // variable jump height (never cut externally applied launches)
    if (this.launchT > 0) this.launchT -= dt;
    else if (!input.holdingJump && this.vy < -JUMP_CUT * JUMP_V) {
      this.vy = -JUMP_CUT * JUMP_V;
    }

    // ---- dash button: roll on the ground, swoop otherwise ----
    if (input.consumeDash() && this.dashCd <= 0 && this.dashing <= 0 && this.rolling <= 0) {
      if (this.grounded && this.abilities.roll) {
        this.rolling = ROLL_TIME;
        this.rollDir = move !== 0 ? move : this.facing;
        this.facing = this.rollDir;
        this.rollPhase = 0;
        this.h = 14;
        this.y += 6;
        this.dashCd = 0.25;
        audio.flap();
        particles.dust(this.x, this.y + this.h / 2);
      } else if (this.abilities.swoop && this.dashReady) {
        this.dashing = DASH_TIME;
        this.dashDir = move !== 0 ? move : this.facing;
        this.facing = this.dashDir;
        this.dashCd = DASH_CD;
        this.dashReady = this.grounded; // one air swoop until landing or wall touch
        audio.dash();
        game.hitstop(0.03);
      }
    }

    // ---- vents (updrafts); thermals only lift once Soar is learned ----
    this.inVent = false;
    const r = this.rect();
    for (const v of level.vents) {
      if (v.soarOnly && !this.abilities.soar) continue;
      if (r.x < v.x + v.w && r.x + r.w > v.x && this.y > v.top && this.y < v.base) {
        this.inVent = true;
        this.vy -= VENT_ACCEL * dt;
        if (this.vy < -VENT_MAX_RISE) this.vy = -VENT_MAX_RISE;
        this.usedFlap = false;
        this.dashReady = true;
        this.stamina = STAMINA_MAX;
      }
    }

    // ---- wind zones (gusts act on airborne birds only) ----
    this.windZone = null;
    if (!this.grounded) {
      const wr = this.rect();
      for (const wz of level.winds) {
        if (wr.x < wz.x + wz.w && wr.x + wr.w > wz.x && wr.y < wz.y + wz.h && wr.y + wr.h > wz.y) {
          this.windZone = wz;
          break;
        }
      }
    }

    // ---- gravity, mural climb, flight, glide, wall slide ----
    const pushingWall = this.wall !== 0 && move === this.wall;
    this.gliding = false;
    this.climbing = false;
    this.flying = false;
    if (this.dashing <= 0) {
      this.vy += G * dt;
      const onMural = !this.grounded && pushingWall && this.abilities.grip &&
        level.muralAt(this.x + this.wall * this.w / 2, this.y, this.wall);
      const ridingWind = this.windZone && this.abilities.wind && this.abilities.glide &&
        !this.grounded && input.holdingJump && this.rolling <= 0 && !onMural;
      if (onMural) {
        this.climbing = true;
        this.vy = Math.max(this.vy - G * 3.4 * dt, -CLIMB_SPEED);
        // vault over the lip when the paint runs out just above
        if (!level.muralAt(this.x + this.wall * this.w / 2, this.y - 34, this.wall)) {
          this.vy = -430;
          this.flapT = 1;
        }
        if (Math.random() < 0.35) {
          particles.trail(this.x + this.wall * this.w / 2, this.y + 8, `hsla(${Math.floor((this.animT * 140) % 360)}, 90%, 65%, 0.7)`);
        }
      } else if (ridingWind) {
        // Tailwind: the gust becomes a laminar highway. Falling is
        // arrested hard (the hold must overpower gravity per frame), but
        // upward bursts from jumps and flaps are allowed to play out.
        this.gliding = true;
        const target = this.windZone.dir * (this.windZone.strength || 620);
        const lift = this.windZone.lift ?? -40;
        this.vx += (target - this.vx) * Math.min(1, 12 * dt);
        this.vy += (lift - this.vy) * Math.min(1, (this.vy > lift ? 60 : 4) * dt);
        if (Math.random() < 0.4) {
          particles.trail(this.x - this.windZone.dir * 22, this.y + (Math.random() - 0.5) * 16, 'rgba(142,240,255,0.55)');
        }
      } else if (!this.grounded && pushingWall && this.vy > 0) {
        if (this.vy > WALL_SLIDE_MAX) this.vy = Math.max(WALL_SLIDE_MAX, this.vy - G * 3 * dt);
        if (Math.random() < 0.25) particles.trail(this.x + this.wall * this.w / 2, this.y + 8, 'rgba(190,175,210,0.4)');
      } else if (!this.grounded && this.abilities.flight && input.holdingJump && this.stamina > 0 && !this.inVent && this.rolling <= 0) {
        // True Flight: sustained wingbeats while stamina lasts. The pull
        // toward the climb rate must overpower gravity per frame; faster
        // upward bursts (flaps) are left to play out.
        this.flying = true;
        this.stamina -= dt;
        this.vy += (FLY_RISE - this.vy) * Math.min(1, (this.vy > FLY_RISE ? 60 : 4) * dt);
        if (Math.random() < 0.3) particles.trail(this.x - this.facing * 16, this.y + 8, 'rgba(255,255,255,0.45)');
      } else if (!this.grounded && this.abilities.glide && input.holdingJump && this.vy > 0 && !this.inVent && this.rolling <= 0 &&
                 !(this.windZone && !this.abilities.wind)) {
        // (untrained wings cannot hold a glide inside a gust field)
        this.gliding = true;
        if (this.vy > GLIDE_FALL) this.vy = Math.max(GLIDE_FALL, this.vy - G * 2.6 * dt);
      }
      // gusts batter untrained wings: speed is wrenched toward a churning
      // oscillation (never a net push forward) plus a downdraft
      if (this.windZone && !ridingWind && !this.grounded && !onMural) {
        const churn = Math.sin(this.animT * 7) * 240;
        this.vx += (churn - this.vx) * Math.min(1, 5 * dt);
        this.vy += 320 * dt;
        if (Math.random() < 0.25) particles.trail(this.x + (Math.random() - 0.5) * 26, this.y - 10, 'rgba(160,190,220,0.35)');
      }
      if (this.vy > TERMINAL) this.vy = TERMINAL;
    }

    // ---- crane hooks: latch on contact ----
    if (this.abilities.hook && !this.grounded && !this.hooked && this.hookCd <= 0 && this.dashing <= 0) {
      for (const hk of level.hooks) {
        const dx = this.x - hk.x;
        const dy = this.y - (hk.y + 10);
        if (dx * dx + dy * dy < HOOK_RADIUS * HOOK_RADIUS) {
          this.hooked = hk;
          hk.held = true;
          this.gliding = false;
          this.rolling = 0;
          this.h = 26;
          audio.wallGrab();
          particles.burst(hk.x, hk.y, { count: 6, color: '#d9b8ff', speed: 90, life: 0.3, size: 1.8 });
          break;
        }
      }
    }

    // ---- wire grind: snap onto a rail when falling across it ----
    if (this.abilities.grind && !this.grounded && !this.hooked && this.grindCd <= 0 &&
        this.dashing <= 0 && this.rolling <= 0 && this.vy > -60) {
      const fx = this.x;
      const fy = this.y + this.h / 2;
      for (const r of level.rails) {
        const u = Math.max(0, Math.min(1, ((fx - r.x1) * (r.x2 - r.x1) + (fy - r.y1) * (r.y2 - r.y1)) / (r.len * r.len)));
        const px = r.x1 + (r.x2 - r.x1) * u;
        const py = r.y1 + (r.y2 - r.y1) * u;
        const dx = fx - px;
        const dy = fy - py;
        if (dx * dx + dy * dy < GRIND_SNAP * GRIND_SNAP) {
          const along = this.vx * r.ux + this.vy * r.uy;
          this.grindDir = Math.abs(along) > 40 ? Math.sign(along) : (this.facing * r.ux >= 0 ? 1 : -1);
          this.grindSpeed = Math.max(GRIND_BASE, Math.abs(along));
          this.grindPos = u * r.len;
          this.grindRail = r;
          this.gliding = false;
          this.flying = false;
          this.x = px;
          this.y = py - this.h / 2 - 3;
          audio.wallGrab();
          particles.burst(px, py, { count: 7, color: '#f2e963', speed: 110, life: 0.3, size: 1.8 });
          break;
        }
      }
    }
    audio.glide(this.gliding || this.flying || (this.inVent && !this.grounded));

    // ---- integrate + collide ----
    const wasGrounded = this.grounded;
    const prevBottom = this.y + this.h / 2;
    this.grounded = false;
    this.wall = 0;

    // X axis: resolve to the shallower side so embedded states recover cleanly
    this.x += this.vx * dt;
    let rr = this.rect();
    for (const s of level.solids) {
      if (s.broken || s.off) continue;
      if (overlap(rr, s)) {
        if (s.breakable && this.dashing > 0) {
          if (this.abilities.break) {
            level.smash(s, game);
            continue; // keep swooping straight through the rubble
          }
          game.onBlockedBreakable();
        }
        const penRight = rr.x + rr.w - s.x;      // push left by this much
        const penLeft = s.x + s.w - rr.x;        // push right by this much
        if (penRight < penLeft) {
          this.x = s.x - this.w / 2;
          this.wall = 1;
        } else {
          this.x = s.x + s.w + this.w / 2;
          this.wall = -1;
        }
        this.vx = 0;
        if (this.dashing > 0) {
          this.dashing = 0;
          particles.burst(this.x + this.wall * this.w / 2, this.y, { count: 8, color: '#ff4fa3', speed: 160, life: 0.3, size: 2 });
        }
        this.dashReady = true;
        rr = this.rect();
      }
    }
    // keep wall contact info while stationary against a wall
    if (this.wall === 0 && move !== 0) {
      const probe = { x: rr.x + move * 2, y: rr.y + 2, w: rr.w, h: rr.h - 4 };
      for (const s of level.solids) {
        if (s.broken || s.off) continue;
        if (overlap(probe, s)) { this.wall = move; break; }
      }
    }

    // Y axis: same shallow-side rule (falling lands, rising bonks, embeds pop out)
    this.y += this.vy * dt;
    rr = this.rect();
    this.groundPlat = null;
    for (const s of level.solids) {
      if (s.broken || s.off) continue;
      if (overlap(rr, s)) {
        const penDown = rr.y + rr.h - s.y;       // push up by this much
        const penUp = s.y + s.h - rr.y;          // push down by this much
        if (penDown < penUp) {
          this.y = s.y - this.h / 2;
          this.grounded = true;
        } else {
          this.y = s.y + s.h + this.h / 2;
        }
        this.vy = 0;
        rr = this.rect();
      }
    }
    for (const p of level.oneWays) {
      if (p.disabled) continue;
      if (this.vy >= 0 && overlap(rr, p) && prevBottom <= p.y + 6) {
        if (p.bounce) {
          // drum skins and the like: spring instead of land
          this.y = p.y - this.h / 2;
          this.vy = -p.bounce;
          this.grounded = false;
          this.usedFlap = false;
          this.dashReady = true;
          this.stamina = STAMINA_MAX;
          this.flapT = 1;
          this.launchT = 0.22;
          audio.drum();
          particles.burst(this.x, p.y, { count: 8, color: '#ffb45e', speed: 140, angle: -Math.PI / 2, spread: 1.4, life: 0.35, size: 2 });
          rr = this.rect();
          continue;
        }
        this.y = p.y - this.h / 2;
        this.vy = 0;
        this.grounded = true;
        this.groundPlat = p;
        rr = this.rect();
      }
    }

    if (this.grounded) {
      if (!wasGrounded) {
        this.landT = 0.12;
        audio.land();
        if (this.vyPrev > 500) {
          particles.dust(this.x, this.y + this.h / 2, 8);
        }
      }
      this.coyote = COYOTE;
      this.usedFlap = false;
      this.dashReady = true;
      this.stamina = STAMINA_MAX;
      this.runPhase += Math.abs(this.vx) * dt * 0.06;
    } else {
      this.coyote -= dt;
    }
    if (this.wall !== 0) this.dashReady = true;
    this.vyPrev = this.vy;

    // glide sparkle trail
    if (this.gliding && Math.random() < 0.3) {
      particles.trail(this.x - this.facing * 16, this.y - 2, 'rgba(53,224,224,0.55)');
    }

    // ---- hazards ----
    if (this.invuln <= 0) {
      for (const hz of level.hazards) {
        if (this.x + this.w / 2 > hz.x1 && this.x - this.w / 2 < hz.x2) {
          const u = Math.max(0, Math.min(1, (this.x - hz.x1) / (hz.x2 - hz.x1)));
          const wy = hz.y + hz.sag * 4 * u * (1 - u);
          if (Math.abs(this.y - wy) < this.h / 2 + 6) {
            this.die(game);
            break;
          }
        }
      }
    }

    // ---- open water: one splash and the current takes you ----
    if (this.invuln <= 0 && this.dead <= 0) {
      for (const w of level.waters) {
        if (this.x > w.x && this.x < w.x + w.w && this.y + this.h / 2 > w.y + 10) {
          particles.burst(this.x, w.y + 6, { count: 12, color: 'rgba(140,220,220,0.9)', speed: 170, angle: -Math.PI / 2, spread: 1.2, life: 0.5, size: 2.4, gravity: 500 });
          this.die(game);
          break;
        }
      }
    }

    // world bounds
    if (this.x < this.w / 2) { this.x = this.w / 2; this.vx = Math.max(0, this.vx); }
    if (this.x > level.width - this.w / 2) { this.x = level.width - this.w / 2; this.vx = Math.min(0, this.vx); }
  }

  die(game) {
    if (this.dead > 0) return;
    this.dead = 0.85;
    this.gliding = false;
    audio.glide(false);
    audio.zap();
    game.flash(0.5);
    game.hitstop(0.12);
    particles.feathers(this.x, this.y, 9, 0);
    particles.burst(this.x, this.y, { count: 14, color: '#ffe9a8', speed: 260, life: 0.5, size: 2.5 });
  }

  grant(ability) {
    this.abilities[ability] = true;
    if (ability === 'flight') this.stamina = STAMINA_MAX;
  }

  // ------------------------------------------------ drawing
  draw(ctx) {
    if (this.dead > 0) return;

    const t = this.animT;

    // afterimages (world space, additive violet)
    if (this.ghosts.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(190,120,255,1)';
      for (const g of this.ghosts) {
        const k = 1 - g.t / 0.3;
        ctx.globalAlpha = k * 0.28;
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.scale(g.f, 1);
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
        ctx.moveTo(-2, -2);
        ctx.lineTo(-15, -13);
        ctx.lineTo(3, -4);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // soft violet aura
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 42);
    aura.addColorStop(0, 'rgba(150,130,255,0.16)');
    aura.addColorStop(1, 'rgba(150,130,255,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    if (this.invuln > 0 && Math.sin(t * 40) > 0.4) ctx.globalAlpha = 0.45;

    ctx.scale(this.facing, 1);

    // tumbling: a compact spinning ball of feathers
    if (this.rolling > 0) {
      ctx.rotate(this.rollPhase);
      const rb = ctx.createLinearGradient(0, -10, 0, 10);
      rb.addColorStop(0, '#262336');
      rb.addColorStop(1, '#100e17');
      ctx.fillStyle = rb;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `hsla(${(t * 34) % 360}, 80%, 70%, 0.3)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 7, 0.5, Math.PI * 0.2, Math.PI * 1.1);
      ctx.stroke();
      ctx.fillStyle = '#33303f';
      ctx.beginPath();
      ctx.moveTo(9, -3);
      ctx.lineTo(15, 0);
      ctx.lineTo(9, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    // pose
    let bodyRot = Math.max(-0.35, Math.min(0.35, this.vy / 2400)) * (this.grounded ? 0 : 1);
    let wingAngle, wingLen = 24, wingBend = 0;
    const running = this.grounded && Math.abs(this.vx) > 30;
    const wallSliding = (!this.grounded && this.wall !== 0 && this.vy >= 0) || this.climbing;

    if (this.hooked) {
      bodyRot = Math.sin(t * 2) * 0.08;
      wingAngle = 1.0;
      wingLen = 19;
    } else if (this.grindRail) {
      bodyRot = Math.max(-0.3, Math.min(0.3, this.vy / (Math.abs(this.vx) + 80))) * this.facing;
      wingAngle = 0.62;
      wingLen = 23;
    } else if (this.flying) {
      bodyRot = -0.14;
      wingAngle = -1.05 + Math.sin(t * 13) * 0.95;
      wingLen = 32;
      wingBend = 0.1;
    } else if (this.dashing > 0) {
      bodyRot = 0.08;
      wingAngle = 0.55;
      wingLen = 27;
      wingBend = -0.4;
    } else if (wallSliding) {
      bodyRot = 0.2;
      wingAngle = 0.9;
      wingLen = 18;
    } else if (this.gliding || (this.inVent && !this.grounded)) {
      wingAngle = -0.12 + Math.sin(t * 4.5) * 0.07;
      wingLen = 33;
      wingBend = 0.25;
      bodyRot = 0.03;
    } else if (!this.grounded) {
      if (this.flapT > 0) {
        this.flapT -= 0.045;
        wingAngle = -1.15 + Math.sin((1 - this.flapT) * Math.PI * 2) * 0.9;
        wingLen = 30;
      } else if (this.vy > 60) {
        wingAngle = -0.2 + Math.sin(t * 16) * 0.45; // flutter while falling
        wingLen = 26;
      } else {
        wingAngle = 0.2;
        wingLen = 24;
      }
    } else {
      wingAngle = 1.05; // folded
      wingLen = 19;
      if (running) wingAngle = 0.95 + Math.sin(this.runPhase * 2) * 0.06;
    }

    ctx.rotate(bodyRot);

    const bob = running ? Math.sin(this.runPhase * 2) * 1.6 : Math.sin(t * 2.2) * 0.8;
    const squash = this.landT > 0 ? 1 - this.landT * 1.6 : (this.vy < -200 ? 1.08 : 1);
    ctx.translate(0, bob);
    ctx.scale(2 - squash, squash);

    const BODY = '#191722';
    const BODY_HI = '#262336';
    const WING_FAR = '#131019';
    const WING_NEAR = '#1f1c2b';

    // tail fan
    ctx.fillStyle = BODY;
    ctx.save();
    ctx.rotate(-bodyRot * 1.4);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-10, -1);
      ctx.quadraticCurveTo(-20, i * 3.6 - 2, -27, i * 5 + (this.gliding ? 2 : 0));
      ctx.quadraticCurveTo(-19, i * 3 + 3, -9, 3);
      ctx.fill();
    }
    ctx.restore();

    // far wing
    drawWing(ctx, -2, -4, wingLen * 0.92, wingAngle + 0.22, wingBend, WING_FAR);

    // body
    const bg = ctx.createLinearGradient(0, -12, 0, 12);
    bg.addColorStop(0, BODY_HI);
    bg.addColorStop(0.5, BODY);
    bg.addColorStop(1, '#100e17');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // iridescent sheen that slowly cycles hue
    ctx.strokeStyle = `hsla(${(t * 34) % 360}, 80%, 70%, 0.28)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, -2.5, 11, 6.5, -0.12, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // head
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(11, -8, 7.6, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = '#33303f';
    ctx.beginPath();
    ctx.moveTo(16.5, -10.5);
    ctx.lineTo(27, -7);
    ctx.lineTo(16.5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,190,230,0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(17, -9.5);
    ctx.lineTo(25, -7.2);
    ctx.stroke();

    // eye (glowing, expressive)
    const blink = this.blinkT < 0 ? 0.15 : 1;
    ctx.fillStyle = '#f4f0ff';
    ctx.beginPath();
    ctx.ellipse(12.5, -9, 2.6, 2.6 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink > 0.5) {
      ctx.fillStyle = '#0b0614';
      ctx.beginPath();
      ctx.arc(13.3, -9, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(53,224,224,0.9)';
      ctx.beginPath();
      ctx.arc(13.8, -9.7, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // legs
    if (this.grounded) {
      ctx.strokeStyle = '#3b3547';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      const step = running ? Math.sin(this.runPhase * 2) * 4 : 0;
      ctx.beginPath();
      ctx.moveTo(-2, 8);
      ctx.lineTo(-3 + step, 13.5);
      ctx.moveTo(4, 8);
      ctx.lineTo(5 - step, 13.5);
      ctx.stroke();
    } else if (wallSliding) {
      ctx.strokeStyle = '#3b3547';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(11, 9);
      ctx.stroke();
    }

    // near wing
    drawWing(ctx, 1, -5, wingLen, wingAngle, wingBend, WING_NEAR);

    ctx.restore();
    ctx.globalAlpha = 1;

    // stamina ring while True Flight is spent (refills on any perch)
    if (this.abilities.flight && this.stamina < STAMINA_MAX - 0.03) {
      const k = Math.max(0, this.stamina / STAMINA_MAX);
      const low = k < 0.3;
      ctx.strokeStyle = 'rgba(20,14,34,0.6)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 30, 11, -Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      ctx.strokeStyle = low ? `rgba(255,110,110,${0.7 + Math.sin(t * 12) * 0.3})` : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(this.x, this.y - 30, 11, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * k);
      ctx.stroke();
    }
  }
}

function drawWing(ctx, sx, sy, len, angle, bend, color) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.4, -len * 0.28 - bend * 8, len, bend * 12);
  ctx.quadraticCurveTo(len * 0.62, len * 0.34, 4, len * 0.24);
  ctx.closePath();
  ctx.fill();
  // feather hint
  ctx.strokeStyle = 'rgba(169,143,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(len * 0.25, len * 0.05);
  ctx.quadraticCurveTo(len * 0.6, len * 0.02, len * 0.92, bend * 10);
  ctx.stroke();
  // splayed primaries on open wings
  if (len >= 26) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const u = 0.72 + i * 0.11;
      ctx.beginPath();
      ctx.moveTo(len * u, bend * 12 * u);
      ctx.lineTo(len * (u + 0.17), bend * 12 * u + (i - 1) * 2.6 + 3.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
