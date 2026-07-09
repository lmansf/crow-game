// Small roaming enemies, one signature critter per district.
// Data: enemies: [{ type: 'gull', x, y, range }]
// Contact kills the crow; a swoop kills the critter (it respawns later).

import { audio } from './audio.js';
import { particles } from './particles.js';

const RESPAWN = 14;

export class Enemies {
  constructor(data) {
    this.list = (data.enemies || []).map((e) => ({
      ...e,
      ox: e.x,
      oy: e.y,
      range: e.range || 240,
      state: 'patrol',
      stateT: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      facing: 1,
      dead: false,
      respawnT: 0,
      phase: Math.random() * 7,
    }));
  }

  update(dt, player, game, t) {
    for (const e of this.list) {
      if (e.dead) {
        e.respawnT -= dt;
        if (e.respawnT <= 0) {
          e.dead = false;
          e.state = 'patrol';
          e.x = e.ox;
          e.y = e.oy;
        }
        continue;
      }
      if (e.type === 'gull') this.updateGull(e, dt, player, t);

      // the crow's swoop drops a critter in one hit
      if (player.dashing > 0 && Math.abs(player.x - e.x) < 42 && Math.abs(player.y - e.y) < 34) {
        e.dead = true;
        e.respawnT = RESPAWN;
        audio.smash();
        game.hitstop(0.05);
        particles.feathers(e.x, e.y, 7, player.facing);
        particles.burst(e.x, e.y, { count: 10, color: '#e8e2d2', speed: 200, life: 0.5, size: 2.2 });
        continue;
      }
      // touching a live critter is death
      if (player.invuln <= 0 && player.dead <= 0 &&
          Math.abs(player.x - e.x) < 26 && Math.abs(player.y - e.y) < 20) {
        player.die(game);
      }
    }
  }

  updateGull(e, dt, player, t) {
    e.stateT += dt;
    if (e.state === 'patrol') {
      const nx = e.ox + Math.sin(t * 0.8 + e.phase) * e.range;
      e.facing = nx >= e.x ? 1 : -1;
      e.x = nx;
      e.y = e.oy + Math.sin(t * 2.1 + e.phase) * 9;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      // spots the crow below: hover and take aim
      if (player.dead <= 0 && Math.abs(dx) < 240 && dy > -30 && dy < 540) {
        e.state = 'aim';
        e.stateT = 0;
      }
    } else if (e.state === 'aim') {
      e.y += Math.sin(t * 18) * 0.6; // agitated hover
      if (e.stateT > 0.55) {
        e.state = 'dive';
        e.stateT = 0;
        const dx = player.x - e.x;
        const dy = Math.max(60, player.y - e.y);
        const len = Math.hypot(dx, dy) || 1;
        e.vx = (dx / len) * 520;
        e.vy = (dy / len) * 520;
        e.facing = e.vx >= 0 ? 1 : -1;
        audio.squawk();
      }
    } else if (e.state === 'dive') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vy += 160 * dt;
      if (e.stateT > 1.05 || e.y > e.oy + 580) {
        e.state = 'climb';
        e.stateT = 0;
      }
    } else if (e.state === 'climb') {
      e.x += (e.ox - e.x) * Math.min(1, 2.2 * dt);
      e.y += (e.oy - e.y) * Math.min(1, 2.2 * dt);
      if (Math.abs(e.x - e.ox) < 14 && Math.abs(e.y - e.oy) < 14) {
        e.state = 'patrol';
        e.stateT = 0;
      }
    }
  }

  draw(ctx, cam, t) {
    const x0 = cam.x - 80;
    const x1 = cam.x + cam.viewW + 80;
    for (const e of this.list) {
      if (e.dead || e.x < x0 || e.x > x1) continue;
      if (e.type === 'gull') drawGull(ctx, e, t);
    }
  }
}

function drawGull(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.facing, 1);
  const diving = e.state === 'dive';
  const flap = diving ? -0.5 : Math.sin(t * (e.state === 'aim' ? 22 : 9) + e.phase) * 0.8;
  // wings
  ctx.strokeStyle = '#d8d2c2';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.quadraticCurveTo(-10, -6 - flap * 8, -20, -4 - flap * 14);
  ctx.moveTo(2, -2);
  ctx.quadraticCurveTo(8, -6 - flap * 8, 16, -4 - flap * 12);
  ctx.stroke();
  // grey wingtips
  ctx.strokeStyle = '#8a8272';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-20, -4 - flap * 14);
  ctx.lineTo(-26, -2 - flap * 16);
  ctx.stroke();
  // body
  const g = ctx.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, '#f0ece0');
  g.addColorStop(1, '#b8b2a2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 8, diving ? 0.35 : 0.05, 0, Math.PI * 2);
  ctx.fill();
  // head + beak
  ctx.fillStyle = '#f0ece0';
  ctx.beginPath();
  ctx.arc(10, -5, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8a13c';
  ctx.beginPath();
  ctx.moveTo(14, -6);
  ctx.lineTo(21, -4);
  ctx.lineTo(14, -2.5);
  ctx.fill();
  // eye: red while hunting
  ctx.fillStyle = e.state === 'aim' || diving ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(11, -5.5, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // telegraph
  if (e.state === 'aim') {
    ctx.fillStyle = `rgba(232,60,75,${0.6 + Math.sin(t * 20) * 0.4})`;
    ctx.font = '800 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('!', e.x, e.y - 22);
  }
}
