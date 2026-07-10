// District bosses: a giant of the local critter guarding the new skill.
// Data: boss: { type, x, y, arena: { x0, x1, top, floor }, drops,
//               pattern: 'dive' | 'charge' }
// Every fight is a movement duel with the same verb: dodge the
// telegraphed attack, then stomp the stunned beast from above.
// Three stomps and the skill is yours.
//
// 'dive' (fliers): perch -> aim -> dive at your last position -> stun.
// 'charge' (grounders): lurk -> rear up -> charge to the far wall ->
// crash -> stun. Hop over the charge; the box is tight on purpose.

import { audio } from './audio.js';
import { particles } from './particles.js';

const BODY_H = {
  gullking: 26,
  ratking: 34,
  iguanodon: 30,
  pinatabull: 38,
  kingcrab: 32,
  snapper: 34,
};

export class Boss {
  constructor(data, level) {
    this.data = data;
    this.level = level;
    this.type = data.type;
    this.pattern = data.pattern || 'dive';
    this.homeX = data.x;
    this.homeY = data.y;
    this.arena = data.arena;
    this.drops = data.drops;
    this.bodyH = BODY_H[data.type] || 30;
    // arena walls exist from the start but stay phased out until triggered
    this.walls = [
      { x: data.arena.x0 - 46, y: data.arena.top, w: 46, h: data.arena.floor - data.arena.top, kind: 'steel', off: true },
      { x: data.arena.x1, y: data.arena.top, w: 46, h: data.arena.floor - data.arena.top, kind: 'steel', off: true },
    ];
    for (const w of this.walls) level.solids.push(w);
    this.reset();
  }

  reset() {
    if (this.state === 'dead') return;
    this.hp = 3;
    this.state = 'idle';
    this.stateT = 0;
    this.x = this.homeX;
    this.y = this.homeY;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.hitT = 0;
    for (const w of this.walls) w.off = true;
  }

  rage() {
    return 1 + (3 - this.hp) * 0.25; // faster with every hit taken
  }

  taunt(game) {
    const lines = {
      gullking: ['THE GULL KING', 'dodge the dive, then strike from above'],
      ratking: ['THE RAT KING', 'leap the charge, then strike from above'],
      iguanodon: ['EL IGUANODON', 'leap the lunge, then strike from above'],
      pinatabull: ['PINATA TORO', 'leap the charge, then strike from above'],
      kingcrab: ['THE KING CRAB', 'leap the scuttle, then strike from above'],
      snapper: ['THE ANCIENT SNAPPER', 'leap the charge, then strike its shell'],
    };
    const [title, sub] = lines[this.type] || ['THE BEAST', 'strike from above'];
    game.ui.toast(title, sub);
  }

  update(dt, player, game, t) {
    if (this.state === 'dead') return;
    this.stateT += dt;
    if (this.hitT > 0) this.hitT -= dt;
    const a = this.arena;

    if (this.state === 'idle') {
      // waiting: trigger when the crow sets foot in the arena
      if (this.pattern === 'dive') this.y = this.homeY + Math.sin(t * 1.3) * 3;
      if (player.dead <= 0 && player.grounded &&
          player.x > a.x0 + 40 && player.x < a.x1 - 40 && player.y > a.top && player.y < a.floor + 40) {
        this.state = 'perch';
        this.stateT = 0;
        for (const w of this.walls) w.off = false;
        audio.squawk();
        audio.smash();
        game.camera?.shake(8, 0.4);
        this.taunt(game);
      }
      return;
    }

    if (this.pattern === 'dive') this.updateDive(dt, player, game, t, a);
    else this.updateCharge(dt, player, game, t, a);

    // ---- the crow vs the beast ----
    if (player.dead > 0) return;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    if (this.state === 'stun') {
      // stomp: land on its head while it is down
      if (player.vy > 80 && Math.abs(dx) < 42 && dy > -66 && dy < -10 && this.hitT <= 0) {
        this.hp--;
        this.hitT = 0.6;
        player.vy = -700;
        player.usedFlap = false;
        player.dashReady = true;
        audio.bossHit();
        game.hitstop(0.1);
        game.camera?.shake(9, 0.3);
        particles.feathers(this.x, this.y - 20, 10, 0);
        particles.burst(this.x, this.y - 20, { count: 14, color: '#f0ece0', speed: 240, life: 0.5, size: 2.4 });
        if (this.hp <= 0) this.die(game);
        else {
          this.state = this.pattern === 'dive' ? 'climb' : 'perch';
          this.stateT = 0;
        }
      }
    } else if (this.deadlyNow() && player.invuln <= 0) {
      if (Math.abs(dx) < 36 && Math.abs(dy) < 28) player.die(game);
    }
  }

  deadlyNow() {
    if (this.pattern === 'dive') {
      return this.state === 'aim' || this.state === 'dive' || this.state === 'perch';
    }
    return this.state === 'charge'; // grounders only hurt mid-rush
  }

  updateDive(dt, player, game, t, a) {
    if (this.state === 'perch') {
      this.x += (this.homeX - this.x) * Math.min(1, 3 * dt);
      this.y += (this.homeY - this.y) * Math.min(1, 3 * dt);
      this.facing = player.x >= this.x ? 1 : -1;
      if (this.stateT > 1.0 / this.rage()) {
        this.state = 'aim';
        this.stateT = 0;
        audio.squawk();
      }
    } else if (this.state === 'aim') {
      this.facing = player.x >= this.x ? 1 : -1;
      this.x += Math.sin(t * 26) * this.stateT * 2.4;
      if (this.stateT > 1.1 / this.rage()) {
        this.state = 'dive';
        this.stateT = 0;
        const tx = Math.max(a.x0 + 60, Math.min(a.x1 - 60, player.x));
        this.diveTx = tx; // the landing spot is telegraphed on the floor
        const dx = tx - this.x;
        const dy = a.floor - 26 - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = 600 * this.rage();
        this.vx = (dx / len) * speed;
        this.vy = (dy / len) * speed;
      }
    } else if (this.state === 'dive') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y >= a.floor - 26) {
        this.y = a.floor - 26;
        this.state = 'stun';
        this.stateT = 0;
        audio.land();
        game.camera?.shake(6, 0.3);
        particles.dust(this.x, a.floor, 12);
      }
    } else if (this.state === 'stun') {
      if (this.stateT > 2.6) {
        this.state = 'climb';
        this.stateT = 0;
      }
    } else if (this.state === 'climb') {
      this.x += (this.homeX - this.x) * Math.min(1, 2.4 * dt);
      this.y += (this.homeY - this.y) * Math.min(1, 2.4 * dt);
      if (Math.abs(this.y - this.homeY) < 10) {
        this.state = 'perch';
        this.stateT = 0;
      }
    }
  }

  updateCharge(dt, player, game, t, a) {
    this.y = a.floor - this.bodyH; // grounders never leave the floor
    if (this.state === 'perch') {
      // catching its breath, shuffling back toward the arena middle so a
      // crow caught by the wall it crashed into always has room to slip out
      this.facing = player.x >= this.x ? 1 : -1;
      this.x += (this.homeX - this.x) * Math.min(1, 1.2 * dt);
      if (Math.abs(this.homeX - this.x) > 30 && Math.random() < 0.15) {
        particles.dust(this.x - this.facing * 16, a.floor, 1);
      }
      if (this.stateT > 1.0 / this.rage()) {
        this.state = 'aim';
        this.stateT = 0;
        audio.squawk();
      }
    } else if (this.state === 'aim') {
      // rears up, shaking harder as the rush loads
      this.facing = player.x >= this.x ? 1 : -1;
      this.x += Math.sin(t * 30) * this.stateT * 2;
      // the Toro snorts glitter while it loads (simulation side, so pausing
      // mid-aim never stockpiles frozen puffs)
      if (this.type === 'pinatabull' && Math.sin(t * 12) > 0) {
        particles.trail(this.x + this.facing * 60, this.y - 14, 'rgba(255,209,102,0.6)');
      }
      if (this.stateT > 0.9 / this.rage()) {
        this.state = 'charge';
        this.stateT = 0;
        this.vx = this.facing * 560 * this.rage();
        audio.dash();
      }
    } else if (this.state === 'charge') {
      this.x += this.vx * dt;
      if (Math.random() < 0.4) particles.dust(this.x - this.facing * 20, a.floor, 2);
      if (this.x <= a.x0 + 70 || this.x >= a.x1 - 70) {
        // full crash into the arena wall
        this.x = Math.max(a.x0 + 70, Math.min(a.x1 - 70, this.x));
        this.state = 'stun';
        this.stateT = 0;
        audio.smash();
        game.camera?.shake(8, 0.35);
        particles.dust(this.x + this.facing * 24, a.floor, 14);
      }
    } else if (this.state === 'stun') {
      if (this.stateT > 2.6) {
        this.state = 'perch';
        this.stateT = 0;
      }
    }
  }

  die(game) {
    this.state = 'dead';
    for (const w of this.walls) w.off = true;
    audio.bossDown();
    game.hitstop(0.4);
    game.camera?.shake(12, 0.6);
    particles.feathers(this.x, this.y, 22, 0);
    for (let i = 0; i < 3; i++) {
      particles.burst(this.x, this.y, { count: 16, color: ['#f0ece0', '#ffd166', '#ff4fa3'][i], speed: 300, life: 0.8, size: 2.6 });
    }
    // the prize falls where the beast fell
    this.level.pickups.push({ x: this.x, y: this.y - 60, ability: this.drops, got: false, phase: 0 });
  }

  draw(ctx, t) {
    if (this.state === 'dead') return;
    const e = this;
    // impact marker for dives
    if (this.pattern === 'dive' && e.state === 'dive' && e.diveTx) {
      const pulse = 0.5 + Math.sin(t * 16) * 0.3;
      ctx.strokeStyle = `rgba(232,60,75,${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(e.diveTx, this.arena.floor - 3, 34, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(e.diveTx, this.arena.floor - 3, 14, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // charge dust line telegraph
    if (this.pattern === 'charge' && e.state === 'aim' && e.stateT > 0.4) {
      ctx.strokeStyle = `rgba(232,60,75,${0.3 + Math.sin(t * 14) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x + e.facing * 30, this.arena.floor - 10);
      ctx.lineTo(e.facing > 0 ? this.arena.x1 - 60 : this.arena.x0 + 60, this.arena.floor - 10);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    // shadow for airborne moments
    if (this.pattern === 'dive' && (e.state === 'dive' || e.state === 'climb')) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, this.arena.floor - e.y - 4, 40, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.hitT > 0 && Math.sin(t * 50) > 0) ctx.globalAlpha = 0.55;
    const stunned = e.state === 'stun';
    switch (this.type) {
      case 'ratking': drawRatKing(ctx, e, t, stunned); break;
      case 'iguanodon': drawIguanodon(ctx, e, t, stunned); break;
      case 'pinatabull': drawPinataBull(ctx, e, t, stunned); break;
      case 'kingcrab': drawKingCrab(ctx, e, t, stunned); break;
      case 'snapper': drawSnapper(ctx, e, t, stunned); break;
      default: drawGullKing(ctx, e, t, stunned);
    }
    ctx.restore();

    // stun stars and health pips
    if (stunned) {
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + i * 2.1;
        ctx.fillStyle = 'rgba(255,233,138,0.85)';
        ctx.font = '700 13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('✦', e.x + Math.cos(a) * 34, e.y - 58 + Math.sin(a) * 8);
      }
    }
    if (e.state !== 'idle') {
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = i < e.hp ? 0.95 : 0.18;
        ctx.fillStyle = '#f0ece0';
        ctx.save();
        ctx.translate(e.x - 26 + i * 26, e.y - 78);
        ctx.rotate(-0.4);
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.quadraticCurveTo(0, -6, 11, 0);
        ctx.quadraticCurveTo(0, 6, -7, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------ the royal gallery

function drawGullKing(ctx, e, t, stunned) {
  const S = 3.1;
  ctx.scale(e.facing * S, S);
  if (stunned) ctx.rotate(0.5);
  const flap = e.state === 'dive' ? -0.6 : stunned ? 0.9 : Math.sin(t * (e.state === 'aim' ? 20 : 7)) * 0.7;
  // far wing: filled shape with ragged grey primaries befitting an old king
  ctx.fillStyle = '#c2bba8';
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.quadraticCurveTo(-12, -8 - flap * 9, -22, -4 - flap * 15);
  ctx.lineTo(-29, -2 - flap * 17);
  ctx.quadraticCurveTo(-13, 1 - flap * 3, -1, 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a7262';
  ctx.beginPath();
  ctx.moveTo(-21, -4.5 - flap * 15);
  ctx.lineTo(-30.5, -1.5 - flap * 17.5);
  ctx.lineTo(-18, -1 - flap * 12);
  ctx.closePath();
  ctx.fill();
  // ink silhouette under the main mass
  ctx.fillStyle = 'rgba(6,4,12,0.45)';
  ctx.beginPath();
  ctx.ellipse(0.5, 0, 15.2, 10, 0.05, 0, Math.PI * 2);
  ctx.fill();
  // body: three values, weathered mantle
  const g = ctx.createLinearGradient(0, -9, 0, 9);
  g.addColorStop(0, '#f4f0e4');
  g.addColorStop(0.55, '#ddd6c4');
  g.addColorStop(1, '#a8a292');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 9, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,142,124,0.5)';
  ctx.beginPath();
  ctx.ellipse(-3, -4, 8.5, 3.6, 0.08, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,114,98,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-1, 5);
  ctx.moveTo(3, -4);
  ctx.lineTo(7, -1);
  ctx.stroke();
  ctx.fillStyle = '#f4f0e4';
  ctx.beginPath();
  ctx.arc(11, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8a13c';
  ctx.beginPath();
  ctx.moveTo(15.5, -7.5);
  ctx.lineTo(24, -4.5);
  ctx.lineTo(15.5, -2.5);
  ctx.fill();
  // gonys spot and a battle scar over the brow
  ctx.fillStyle = '#c9503c';
  ctx.beginPath();
  ctx.arc(19.4, -3.4, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,114,98,0.7)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(8, -10.5);
  ctx.lineTo(10.5, -8);
  ctx.stroke();
  // near wing: lighter fill over the body
  ctx.fillStyle = '#efe9d8';
  ctx.beginPath();
  ctx.moveTo(2, -3);
  ctx.quadraticCurveTo(9, -8 - flap * 9, 18, -4 - flap * 13);
  ctx.lineTo(23, -2 - flap * 14.5);
  ctx.quadraticCurveTo(11, 1 - flap * 3, 3, 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a8272';
  ctx.beginPath();
  ctx.moveTo(17.5, -4.5 - flap * 13);
  ctx.lineTo(24, -1.5 - flap * 15);
  ctx.lineTo(16, -1 - flap * 10);
  ctx.closePath();
  ctx.fill();
  crown(ctx, 7.5, -11);
  ctx.fillStyle = e.state === 'aim' || e.state === 'dive' ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(12, -6.5, 2, 0, Math.PI * 2);
  ctx.fill();
}

function crown(ctx, x, y) {
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 1, y - 4);
  ctx.lineTo(x + 3, y - 1);
  ctx.lineTo(x + 5, y - 4.5);
  ctx.lineTo(x + 6.5, y - 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawRatKing(ctx, e, t, stunned) {
  const S = 3.2;
  ctx.scale(e.facing * S, S);
  if (stunned) ctx.rotate(-0.35);
  const rear = e.state === 'aim' ? -0.3 : 0;
  ctx.rotate(rear);
  const scurry = Math.sin(t * (e.state === 'charge' ? 36 : 14)) * 1.6;
  // ragged tail
  ctx.strokeStyle = '#8d7f92';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-11, 2);
  ctx.quadraticCurveTo(-22, 5 - scurry, -30, -3 + scurry);
  ctx.stroke();
  // ink silhouette under the main mass
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(1, -0.5, 15, 9.6, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // body: three values of sewer-king grey
  const g = ctx.createLinearGradient(0, -9, 0, 8);
  g.addColorStop(0, '#75687c');
  g.addColorStop(0.5, '#584d62');
  g.addColorStop(1, '#352d3e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13.5, 8.5, 0.08, 0, Math.PI * 2);
  ctx.fill();
  // mangy scars and matted fur tufts
  ctx.strokeStyle = 'rgba(20,14,24,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(-2, -1);
  ctx.moveTo(2, 3);
  ctx.lineTo(6, 5);
  ctx.moveTo(-9, 1);
  ctx.lineTo(-6, 2.6);
  ctx.moveTo(-2, -6.5);
  ctx.lineTo(1, -4.8);
  ctx.stroke();
  // ragged tail notches
  ctx.strokeStyle = 'rgba(20,14,24,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-18, 3.2);
  ctx.lineTo(-19.4, 1.4);
  ctx.moveTo(-24, 1.4);
  ctx.lineTo(-25.2, -0.6);
  ctx.stroke();
  // head, notched ear, snout with teeth
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(11, -3, 6.4, 5, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8d7f92';
  ctx.beginPath();
  ctx.moveTo(5, -8);
  ctx.lineTo(7, -12);
  ctx.lineTo(9, -8.5);
  ctx.lineTo(8, -7);
  ctx.fill();
  ctx.fillStyle = '#f0ece0';
  ctx.beginPath();
  ctx.moveTo(15, -1);
  ctx.lineTo(16, 2);
  ctx.lineTo(17.5, -0.5);
  ctx.fill();
  crown(ctx, 5, -10.5);
  ctx.fillStyle = e.state === 'charge' || e.state === 'aim' ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(12.5, -4.6, 1.7, 0, Math.PI * 2);
  ctx.fill();
  // skittering feet
  ctx.strokeStyle = '#3c3444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, 8);
  ctx.lineTo(-5 + scurry, 11);
  ctx.moveTo(6, 8);
  ctx.lineTo(6 - scurry, 11);
  ctx.stroke();
}

function drawIguanodon(ctx, e, t, stunned) {
  const S = 3.2;
  ctx.scale(e.facing * S, S);
  if (stunned) ctx.rotate(-0.3);
  const rear = e.state === 'aim' ? -0.35 : 0;
  ctx.rotate(rear);
  // great striped tail
  ctx.strokeStyle = '#3e6e3a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.quadraticCurveTo(-24, -3 + Math.sin(t * 2) * 3, -34, 5);
  ctx.stroke();
  ctx.strokeStyle = '#2a4c28';
  ctx.lineWidth = 5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.quadraticCurveTo(-24, -3 + Math.sin(t * 2) * 3, -34, 5);
  ctx.stroke();
  ctx.setLineDash([]);
  // ink silhouette under the main mass
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(1.5, -0.5, 15.6, 8.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // body: three ancient greens with scale speckles
  const g = ctx.createLinearGradient(0, -9, 0, 9);
  g.addColorStop(0, '#6cae5c');
  g.addColorStop(0.5, '#47803d');
  g.addColorStop(1, '#24451f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14.5, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,130,0.35)';
  for (const [sx2, sy2] of [[-8, -1], [-4, 3], [1, -2.4], [6, 1.6], [9, -1]]) {
    ctx.beginPath();
    ctx.arc(sx2, sy2, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  // tall spines rising from an inked ridge
  ctx.fillStyle = '#8ec26e';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 5.4 - 2.4, -6);
    ctx.lineTo(i * 5.4, -13);
    ctx.lineTo(i * 5.4 + 2.4, -6);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(26,42,22,0.6)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-13, -5.6);
  ctx.lineTo(13, -5.6);
  ctx.stroke();
  // head with grand dewlap (lit from the dawn above)
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(13.5, -2.5, 6.6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const dg = ctx.createLinearGradient(0, 2, 0, 12);
  dg.addColorStop(0, '#f2b654');
  dg.addColorStop(1, '#b8771e');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(10.5, 2);
  ctx.quadraticCurveTo(13.5, 12, 17.5, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,20,0.5)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(12, 3.5);
  ctx.lineTo(13.2, 8);
  ctx.moveTo(15.5, 3.5);
  ctx.lineTo(14.6, 8);
  ctx.stroke();
  crown(ctx, 10, -8.5);
  ctx.fillStyle = e.state === 'charge' || e.state === 'aim' ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(15, -4, 1.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawPinataBull(ctx, e, t, stunned) {
  const S = 3.4;
  ctx.scale(e.facing * S, S);
  if (stunned) ctx.rotate(0.4);
  const rear = e.state === 'aim' ? -0.25 : 0;
  ctx.rotate(rear);
  // ink silhouette under the papier-mache
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, -1, 15.4, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // fringed body in festival bands, shaded and paper-torn
  const stripes = [['#ff4fa3', '#c23a80'], ['#ffd166', '#cfa03e'], ['#35e0e0', '#22a3a3'], ['#a4f26b', '#76bd45']];
  for (let i = 0; i < 4; i++) {
    const bg2 = ctx.createLinearGradient(0, -11 + i * 3.4, 0, -1 + i * 3.4);
    bg2.addColorStop(0, stripes[i][0]);
    bg2.addColorStop(1, stripes[i][1]);
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.ellipse(0, -6 + i * 3.4, 14 - i * 1.2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,4,12,0.3)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([1.8, 2]);
    ctx.beginPath();
    ctx.ellipse(0, -6 + i * 3.4, 14 - i * 1.2, 5, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // sturdy legs
  ctx.strokeStyle = '#c9366f';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const step = e.state === 'charge' ? Math.sin(t * 30) * 4 : 0;
  ctx.beginPath();
  ctx.moveTo(-7, 6);
  ctx.lineTo(-7 + step, 13);
  ctx.moveTo(7, 6);
  ctx.lineTo(7 - step, 13);
  ctx.stroke();
  // bull head with paper horns
  ctx.fillStyle = '#ff8ab5';
  ctx.beginPath();
  ctx.ellipse(12.5, -8, 6.5, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f4f0ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(9, -12);
  ctx.quadraticCurveTo(7, -18, 11, -19);
  ctx.moveTo(15, -12.5);
  ctx.quadraticCurveTo(17, -18, 13.5, -19.5);
  ctx.stroke();
  // snorting snout
  ctx.fillStyle = '#c9366f';
  ctx.beginPath();
  ctx.ellipse(17.5, -6, 3.4, 2.6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // googly eye
  ctx.fillStyle = '#f4f0ff';
  ctx.beginPath();
  ctx.arc(12, -9.5, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.state === 'charge' ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(12.8, -9, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawKingCrab(ctx, e, t, stunned) {
  const S = 3.2;
  ctx.scale(e.facing * S, S);
  if (stunned) ctx.rotate(0.35);
  const clawUp = e.state === 'aim' || e.state === 'charge';
  // legs
  ctx.strokeStyle = '#b8503a';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  const skit = Math.sin(t * (e.state === 'charge' ? 30 : 12)) * 2.4;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(s * 7, 3);
    ctx.lineTo(s * 15, 8 + skit * s);
    ctx.moveTo(s * 9, 4);
    ctx.lineTo(s * 18, 10 - skit * s);
  }
  ctx.stroke();
  // ink silhouette under the shell
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, -2, 14.4, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // barnacled shell: three storm-wet values with a rain sheen
  const g = ctx.createLinearGradient(0, -10, 0, 8);
  g.addColorStop(0, '#f07a5a');
  g.addColorStop(0.5, '#c44a30');
  g.addColorStop(1, '#7e2a18');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -2, 13, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,235,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(-1, -4, 10, Math.PI * 1.2, Math.PI * 1.6);
  ctx.stroke();
  // barnacles: ringed, not just dots
  for (const [bx, by] of [[-5, -6], [3, -8], [7, -3], [-9, -2]]) {
    ctx.fillStyle = 'rgba(240,236,224,0.5)';
    ctx.beginPath();
    ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(94,31,18,0.6)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(bx, by, 2.1, 0, Math.PI * 2);
    ctx.stroke();
  }
  // royal claws with serrated pincers
  for (const s of [-1, 1]) {
    const cy = clawUp ? -15 : -7;
    const cg = ctx.createLinearGradient(0, cy - 4.2, 0, cy + 4.2);
    cg.addColorStop(0, '#f07a5a');
    cg.addColorStop(1, '#93321f');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(s * 13, cy, 5.4, 4.2, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5e1f12';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(s * 16, cy - 3);
    ctx.lineTo(s * 18.5, cy);
    ctx.moveTo(s * 15.2, cy - 1);
    ctx.lineTo(s * 17, cy + 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(6,4,12,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(s * 13, cy, 5.4, 4.2, s * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  crown(ctx, -3.4, -10.5);
  // eyestalks
  ctx.strokeStyle = '#5e1f12';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, -9);
  ctx.lineTo(-4.4, -14);
  ctx.moveTo(3, -9);
  ctx.lineTo(4.4, -14);
  ctx.stroke();
  ctx.fillStyle = clawUp ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(-4.6, -15, 1.8, 0, Math.PI * 2);
  ctx.arc(4.6, -15, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnapper(ctx, e, t, stunned) {
  const S = 3.4;
  ctx.scale(e.facing * S, S);
  if (stunned) {
    // flipped onto its shell, legs paddling the air
    ctx.rotate(Math.PI);
    ctx.translate(0, 4);
  }
  // legs
  ctx.strokeStyle = '#4a5c38';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  const pad = stunned ? Math.sin(t * 10) * 3 : (e.state === 'charge' ? Math.sin(t * 24) * 3 : 0);
  ctx.beginPath();
  ctx.moveTo(-8, 6);
  ctx.lineTo(-10 + pad, 11);
  ctx.moveTo(7, 6);
  ctx.lineTo(9 - pad, 11);
  ctx.stroke();
  // ink silhouette under the shell
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, -2, 15.4, 10.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // ancient shell: three mossy values with a dawn-gold rim
  const g = ctx.createLinearGradient(0, -11, 0, 8);
  g.addColorStop(0, '#68804e');
  g.addColorStop(0.5, '#48593a');
  g.addColorStop(1, '#2a3522');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -2, 14, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, -2, 12.6, 8.2, 0, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();
  // scute plates
  ctx.strokeStyle = 'rgba(20,26,16,0.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(i * 7, -10);
    ctx.lineTo(i * 7, 6);
  }
  ctx.moveTo(-12, -3);
  ctx.lineTo(12, -3);
  ctx.stroke();
  // moss and hanging algae wisps
  ctx.fillStyle = 'rgba(90,140,70,0.4)';
  ctx.beginPath();
  ctx.ellipse(-6, -8, 4, 2.4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5, -9.5, 3, 1.8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,140,70,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-11, 4);
  ctx.quadraticCurveTo(-11.6, 7, -10.6, 9);
  ctx.moveTo(-3, 6.6);
  ctx.quadraticCurveTo(-3.4, 9, -2.6, 10.6);
  ctx.stroke();
  // beaked head
  ctx.fillStyle = '#6a7c50';
  ctx.beginPath();
  ctx.ellipse(14, -2, 6, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#33402a';
  ctx.beginPath();
  ctx.moveTo(18, -4);
  ctx.lineTo(22, -1.5);
  ctx.lineTo(18, 1);
  ctx.fill();
  crown(ctx, 11, -6.5);
  ctx.fillStyle = e.state === 'charge' || e.state === 'aim' ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(15, -3.6, 1.7, 0, Math.PI * 2);
  ctx.fill();
}
