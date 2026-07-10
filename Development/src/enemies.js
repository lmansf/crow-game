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
      else if (e.type === 'rat') this.updateRat(e, dt, player, t);
      else if (e.type === 'iguana') this.updateIguana(e, dt, player, t);
      else if (e.type === 'imp') this.updateImp(e, dt, player, t);
      else if (e.type === 'crab') this.updateCrab(e, dt, player, t);
      else if (e.type === 'snake') this.updateSnake(e, dt, player, t);

      // the crow's swoop drops a critter in one hit (a dead crow's frozen
      // dash timer must not keep killing during the death animation)
      if (player.dead <= 0 && player.dashing > 0 && Math.abs(player.x - e.x) < 42 && Math.abs(player.y - e.y) < 34) {
        e.dead = true;
        e.respawnT = RESPAWN;
        audio.smash();
        game.hitstop(0.05);
        if (e.type === 'imp') {
          // pinata imps burst into candy, naturally
          particles.burst(e.x, e.y, { count: 18, color: '#ffd166', speed: 240, life: 0.7, size: 2.4, gravity: 500 });
          particles.burst(e.x, e.y, { count: 10, color: '#ff4fa3', speed: 200, life: 0.6, size: 2, gravity: 500 });
        } else {
          particles.feathers(e.x, e.y, 7, player.facing);
          particles.burst(e.x, e.y, { count: 10, color: '#e8e2d2', speed: 200, life: 0.5, size: 2.2 });
        }
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

  // ---- ground critters ----

  updateRat(e, dt, player, t) {
    e.stateT += dt;
    const dx = player.x - e.x;
    const near = player.dead <= 0 && Math.abs(dx) < 220 && Math.abs(player.y - e.y) < 60;
    if (e.state === 'patrol') {
      e.x += e.facing * 90 * dt;
      if (e.x > e.ox + e.range) e.facing = -1;
      if (e.x < e.ox - e.range) e.facing = 1;
      if (near) { e.state = 'aim'; e.facing = dx >= 0 ? 1 : -1; e.stateT = 0; }
    } else if (e.state === 'aim') {
      // hunches for a beat so the rush is always telegraphed
      if (e.stateT > 0.35) { e.state = 'charge'; e.stateT = 0; }
    } else if (e.state === 'charge') {
      e.x += e.facing * 300 * dt;
      if (e.stateT > 1.1 || Math.abs(e.x - e.ox) > e.range + 160) { e.state = 'patrol'; e.stateT = 0; }
    }
  }

  updateIguana(e, dt, player, t) {
    e.stateT += dt;
    const dx = player.x - e.x;
    if (e.state === 'patrol') {
      // basking: barely moves
      if (player.dead <= 0 && Math.abs(dx) < 110 && Math.abs(player.y - e.y) < 50) {
        e.state = 'aim'; // rears up
        e.stateT = 0;
        e.facing = dx >= 0 ? 1 : -1;
      }
    } else if (e.state === 'aim') {
      if (e.stateT > 0.4) { e.state = 'dive'; e.stateT = 0; } // the lunge
    } else if (e.state === 'dive') {
      e.x += e.facing * 460 * dt;
      if (e.stateT > 0.3) { e.state = 'climb'; e.stateT = 0; }
    } else if (e.state === 'climb') {
      // waddles back to its basking spot
      e.x += (e.ox - e.x) * Math.min(1, 1.6 * dt);
      if (e.stateT > 1.2) { e.state = 'patrol'; e.stateT = 0; }
    }
  }

  updateImp(e, dt, player, t) {
    e.stateT += dt;
    const dx = player.x - e.x;
    const near = player.dead <= 0 && Math.abs(dx) < 260 && Math.abs(player.y - e.y) < 70;
    const speed = near ? 210 : 80;
    if (near) e.facing = dx >= 0 ? 1 : -1;
    else {
      if (e.x > e.ox + e.range) e.facing = -1;
      if (e.x < e.ox - e.range) e.facing = 1;
    }
    e.x += e.facing * speed * dt;
    e.y = e.oy - Math.abs(Math.sin(t * 9 + e.phase)) * 10; // wobble-hop
  }

  updateCrab(e, dt, player, t) {
    e.stateT += dt;
    if (e.state === 'patrol') {
      e.x += e.facing * 70 * dt;
      if (e.x > e.ox + e.range) e.facing = -1;
      if (e.x < e.ox - e.range) e.facing = 1;
      const dx = player.x - e.x;
      if (player.dead <= 0 && Math.abs(dx) < 90 && player.y - e.y > -120 && player.y < e.y + 20) {
        e.state = 'aim'; // claws up
        e.stateT = 0;
      }
    } else if (e.state === 'aim') {
      if (e.stateT > 0.35) { e.state = 'dive'; e.stateT = 0; e.vy = -300; }
    } else if (e.state === 'dive') {
      // snip-hop upward
      e.y += e.vy * dt;
      e.vy += 1400 * dt;
      if (e.y >= e.oy) { e.y = e.oy; e.state = 'patrol'; e.stateT = 0; }
    }
  }

  updateSnake(e, dt, player, t) {
    e.stateT += dt;
    const dx = player.x - e.x;
    if (e.state === 'patrol') {
      // coiled and waiting
      if (player.dead <= 0 && Math.abs(dx) < 130 && Math.abs(player.y - e.y) < 46) {
        e.state = 'aim';
        e.stateT = 0;
        e.facing = dx >= 0 ? 1 : -1;
      }
    } else if (e.state === 'aim') {
      if (e.stateT > 0.5) { e.state = 'dive'; e.stateT = 0; e.sx = e.x; }
    } else if (e.state === 'dive') {
      // the strike: head shoots out and snaps back
      const u = Math.min(1, e.stateT / 0.35);
      const reach = Math.sin(u * Math.PI) * 92;
      e.x = e.sx + e.facing * reach;
      if (u >= 1) { e.x = e.sx; e.state = 'climb'; e.stateT = 0; }
    } else if (e.state === 'climb') {
      if (e.stateT > 0.9) { e.state = 'patrol'; e.stateT = 0; } // re-coiling
    }
  }

  draw(ctx, cam, t) {
    const x0 = cam.x - 80;
    const x1 = cam.x + cam.viewW + 80;
    for (const e of this.list) {
      if (e.dead || e.x < x0 || e.x > x1) continue;
      if (e.type === 'gull') drawGull(ctx, e, t);
      else if (e.type === 'rat') drawRat(ctx, e, t);
      else if (e.type === 'iguana') drawIguana(ctx, e, t);
      else if (e.type === 'imp') drawImp(ctx, e, t);
      else if (e.type === 'crab') drawCrab(ctx, e, t);
      else if (e.type === 'snake') drawSnake(ctx, e, t);
    }
  }
}

function drawGull(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.facing, 1);
  const diving = e.state === 'dive';
  const flap = diving ? -0.5 : Math.sin(t * (e.state === 'aim' ? 22 : 9) + e.phase) * 0.8;
  // far wing: a filled shape with separated grey primaries, not a stick
  ctx.fillStyle = '#b9b2a0';
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.quadraticCurveTo(-11, -7 - flap * 8, -20, -4 - flap * 14);
  ctx.lineTo(-26, -2 - flap * 16);
  ctx.quadraticCurveTo(-12, 1 - flap * 3, -1, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7d7565';
  ctx.beginPath();
  ctx.moveTo(-19, -4.5 - flap * 14);
  ctx.lineTo(-27.5, -1.5 - flap * 16.5);
  ctx.lineTo(-17, -1 - flap * 11);
  ctx.closePath();
  ctx.fill();
  // ink silhouette under the main mass
  ctx.fillStyle = 'rgba(6,4,12,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 9, diving ? 0.35 : 0.05, 0, Math.PI * 2);
  ctx.fill();
  // body: three values, grey mantle over the back
  const g = ctx.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, '#f4f0e4');
  g.addColorStop(0.55, '#ddd6c4');
  g.addColorStop(1, '#a8a292');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 8, diving ? 0.35 : 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,142,124,0.55)';
  ctx.beginPath();
  ctx.ellipse(-3, -3.5, 8, 3.4, diving ? 0.35 : 0.08, Math.PI, Math.PI * 2);
  ctx.fill();
  // tail wedge with a dark band
  ctx.fillStyle = '#ddd6c4';
  ctx.beginPath();
  ctx.moveTo(-11, -2);
  ctx.lineTo(-19, 1 + flap * 2);
  ctx.lineTo(-11, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#55503f';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-18, 0.4 + flap * 2);
  ctx.lineTo(-15.5, 2.2);
  ctx.stroke();
  // head + beak
  ctx.fillStyle = '#f4f0e4';
  ctx.beginPath();
  ctx.arc(10, -5, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8a13c';
  ctx.beginPath();
  ctx.moveTo(14, -6);
  ctx.lineTo(21, -4);
  ctx.lineTo(14, -2.5);
  ctx.fill();
  // gonys spot on the lower bill
  ctx.fillStyle = '#c9503c';
  ctx.beginPath();
  ctx.arc(17.6, -3.6, 0.8, 0, Math.PI * 2);
  ctx.fill();
  // near wing: lighter fill over the body
  ctx.fillStyle = '#eee8d8';
  ctx.beginPath();
  ctx.moveTo(2, -3);
  ctx.quadraticCurveTo(9, -7 - flap * 8, 16, -4 - flap * 12);
  ctx.lineTo(21, -2 - flap * 13.5);
  ctx.quadraticCurveTo(10, 1 - flap * 3, 3, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a8272';
  ctx.beginPath();
  ctx.moveTo(15.5, -4.5 - flap * 12);
  ctx.lineTo(22, -1.5 - flap * 14);
  ctx.lineTo(14, -1 - flap * 9);
  ctx.closePath();
  ctx.fill();
  // eye: red while hunting, with a ring
  ctx.fillStyle = e.state === 'aim' || diving ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(11, -5.5, 1.7, 0, Math.PI * 2);
  ctx.fill();
  if (e.state === 'aim' || diving) {
    ctx.strokeStyle = 'rgba(232,60,75,0.5)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(11, -5.5, 2.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // telegraph
  if (e.state === 'aim') {
    ctx.fillStyle = `rgba(232,60,75,${0.6 + Math.sin(t * 20) * 0.4})`;
    ctx.font = '800 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('!', e.x, e.y - 22);
  }
}

function telegraph(ctx, e, t, dy = -26) {
  if (e.state !== 'aim') return;
  ctx.fillStyle = `rgba(232,60,75,${0.6 + Math.sin(t * 20) * 0.4})`;
  ctx.font = '800 16px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('!', e.x, e.y + dy);
}

function drawRat(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.facing, 1);
  const scurry = Math.sin(t * (e.state === 'charge' ? 34 : 18) + e.phase) * 1.4;
  // tail
  ctx.strokeStyle = '#8d7f92';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  ctx.quadraticCurveTo(-20, 4 - scurry, -26, -2 + scurry);
  ctx.stroke();
  // ink silhouette under the main mass
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(1, -0.5, 13.4, 8, 0.12, 0, Math.PI * 2);
  ctx.fill();
  // body: three values of drain-grime grey
  const g = ctx.createLinearGradient(0, -8, 0, 6);
  g.addColorStop(0, '#75687c');
  g.addColorStop(0.5, '#5a4f64');
  g.addColorStop(1, '#3d3446');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 7 + scurry * 0.3, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // matted fur ticks along the flank
  ctx.strokeStyle = 'rgba(28,20,34,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-7, -3);
  ctx.lineTo(-4.4, -1.2);
  ctx.moveTo(-1.5, -5);
  ctx.lineTo(1, -3.2);
  ctx.moveTo(-4, 3);
  ctx.lineTo(-1.5, 4.6);
  ctx.stroke();
  // head + snout
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(10, -2, 6, 4.5, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8d7f92';
  ctx.beginPath();
  ctx.arc(6, -7, 2.6, 0, Math.PI * 2); // ear
  ctx.fill();
  ctx.fillStyle = '#4a3f54';
  ctx.beginPath();
  ctx.arc(6.4, -6.8, 1.3, 0, Math.PI * 2); // inner ear
  ctx.fill();
  // whiskers
  ctx.strokeStyle = 'rgba(220,210,230,0.35)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(14, -1.5);
  ctx.lineTo(19, -2.6);
  ctx.moveTo(14, -0.5);
  ctx.lineTo(19, 0.6);
  ctx.stroke();
  // eye: gleams when hunting
  ctx.fillStyle = e.state === 'charge' || e.state === 'aim' ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(11.5, -3.4, 1.4, 0, Math.PI * 2);
  ctx.fill();
  // feet skitter
  ctx.strokeStyle = '#453c4d';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-5, 6);
  ctx.lineTo(-5 + scurry, 9);
  ctx.moveTo(5, 6);
  ctx.lineTo(5 - scurry, 9);
  ctx.stroke();
  ctx.restore();
  telegraph(ctx, e, t, -22);
}

function drawIguana(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.facing, 1);
  const rear = e.state === 'aim' ? -0.35 : 0;
  ctx.rotate(rear);
  // tail with stripes
  ctx.strokeStyle = '#3e6e3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.quadraticCurveTo(-22, -2 + Math.sin(t * 2 + e.phase) * 3, -32, 4);
  ctx.stroke();
  // ink silhouette under the main mass
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(1.5, -0.5, 15, 7.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // body: three sun-warmed greens
  const g = ctx.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, '#6cae5c');
  g.addColorStop(0.5, '#4c8442');
  g.addColorStop(1, '#2c5228');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // scale speckles along the flank
  ctx.fillStyle = 'rgba(160,210,130,0.35)';
  for (const [sx2, sy2] of [[-7, -1], [-3, 2], [2, -2], [6, 1]]) {
    ctx.beginPath();
    ctx.arc(sx2, sy2, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // spines with an inked base
  ctx.fillStyle = '#8ec26e';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 5 - 2, -5);
    ctx.lineTo(i * 5, -10);
    ctx.lineTo(i * 5 + 2, -5);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(30,50,26,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12, -4.6);
  ctx.lineTo(12, -4.6);
  ctx.stroke();
  // head + dewlap (lit from above)
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(13, -2, 6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const dg = ctx.createLinearGradient(0, 2, 0, 9);
  dg.addColorStop(0, '#f2b654');
  dg.addColorStop(1, '#c07f22');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(11, 2);
  ctx.quadraticCurveTo(13, 9, 16, 2);
  ctx.fill();
  // eye
  ctx.fillStyle = e.state === 'dive' || e.state === 'aim' ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(14.5, -3.4, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  telegraph(ctx, e, t);
}

function drawImp(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.facing, 1);
  ctx.rotate(Math.sin(t * 9 + e.phase) * 0.14);
  // ink silhouette under the papier-mache
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, -1, 12, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // fringed papier-mache body in party stripes, each band shaded and
  // finished with a torn paper fringe
  const stripes = [['#ff4fa3', '#c23a80'], ['#ffd166', '#cfa03e'], ['#35e0e0', '#22a3a3']];
  for (let i = 0; i < 3; i++) {
    const bg2 = ctx.createLinearGradient(0, -8 + i * 3, 0, i * 3);
    bg2.addColorStop(0, stripes[i][0]);
    bg2.addColorStop(1, stripes[i][1]);
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.ellipse(0, -4 + i * 3, 11 - i * 1.4, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,4,12,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([1.6, 1.8]);
    ctx.beginPath();
    ctx.ellipse(0, -4 + i * 3, 11 - i * 1.4, 4.2, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // stubby legs
  ctx.strokeStyle = '#c9366f';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const step = Math.sin(t * 12 + e.phase) * 3;
  ctx.beginPath();
  ctx.moveTo(-5, 5);
  ctx.lineTo(-5 + step, 11);
  ctx.moveTo(5, 5);
  ctx.lineTo(5 - step, 11);
  ctx.stroke();
  // little donkey head
  ctx.fillStyle = '#ff8ab5';
  ctx.beginPath();
  ctx.ellipse(10, -9, 5, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9366f';
  ctx.beginPath();
  ctx.moveTo(8, -13);
  ctx.lineTo(9, -18);
  ctx.lineTo(11, -13);
  ctx.fill();
  // googly eye with a paper ring
  ctx.strokeStyle = 'rgba(6,4,12,0.4)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(11.6, -9.6, 2.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f4f0ff';
  ctx.beginPath();
  ctx.arc(11.6, -9.6, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#191325';
  ctx.beginPath();
  ctx.arc(12.2, -9.2, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrab(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const clawUp = e.state === 'aim' || e.state === 'dive';
  // legs
  ctx.strokeStyle = '#b8503a';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  const skit = Math.sin(t * 16 + e.phase) * 2;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(s * 6, 2);
    ctx.lineTo(s * 13, 6 + skit * s);
    ctx.moveTo(s * 8, 3);
    ctx.lineTo(s * 16, 8 - skit * s);
  }
  ctx.stroke();
  // ink silhouette under the shell
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, -2, 12.2, 8.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // storm-wet shell: three values and a rain sheen
  const g = ctx.createLinearGradient(0, -8, 0, 6);
  g.addColorStop(0, '#f07a5a');
  g.addColorStop(0.5, '#c74e36');
  g.addColorStop(1, '#93321f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -2, 11, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,20,14,0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -3, 7, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,235,255,0.35)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(-1, -4, 8.6, Math.PI * 1.2, Math.PI * 1.6);
  ctx.stroke();
  // shell speckles
  ctx.fillStyle = 'rgba(240,236,224,0.3)';
  for (const [bx2, by2] of [[-4, -5], [3, -6], [5, -1]]) {
    ctx.beginPath();
    ctx.arc(bx2, by2, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // claws with inked pincer splits
  for (const s of [-1, 1]) {
    const cy = clawUp ? -13 : -6;
    const cg = ctx.createLinearGradient(0, cy - 3.4, 0, cy + 3.4);
    cg.addColorStop(0, '#f07a5a');
    cg.addColorStop(1, '#a83a28');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(s * 11, cy, 4.4, 3.4, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a2a1c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(s * 13, cy - 2.4);
    ctx.lineTo(s * 15, cy);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(6,4,12,0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(s * 11, cy, 4.4, 3.4, s * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // eyestalks
  ctx.strokeStyle = '#7a2a1c';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3, -8);
  ctx.lineTo(-4, -12);
  ctx.moveTo(3, -8);
  ctx.lineTo(4, -12);
  ctx.stroke();
  ctx.fillStyle = clawUp ? '#e83c4b' : '#191325';
  ctx.beginPath();
  ctx.arc(-4, -13, 1.6, 0, Math.PI * 2);
  ctx.arc(4, -13, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  telegraph(ctx, e, t, -20);
}

function drawSnake(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.facing, 1);
  const striking = e.state === 'dive';
  const rearing = e.state === 'aim';
  // ink pool under the coil
  ctx.fillStyle = 'rgba(6,4,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(-4, 3, 13, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // coil
  ctx.strokeStyle = '#3a3328';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(-4, 4 - i * 2, 11 - i * 2.6, 4.5 - i, 0, 0, Math.PI * (striking ? 1.2 : 2));
    ctx.stroke();
  }
  // crossband markings over the coil
  ctx.strokeStyle = 'rgba(96,84,60,0.55)';
  ctx.lineWidth = 2;
  for (const [bx2, by2] of [[-12, 3], [-6, 6.5], [1, 5], [5, 2]]) {
    ctx.beginPath();
    ctx.moveTo(bx2, by2 - 2.4);
    ctx.lineTo(bx2 + 1.4, by2 + 2.4);
    ctx.stroke();
  }
  // neck + head
  const headY = rearing ? -18 : striking ? -8 : -10;
  const headX = striking ? 14 : 4;
  ctx.strokeStyle = '#3a3328';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.quadraticCurveTo(0, headY + 6, headX, headY);
  ctx.stroke();
  const hgr = ctx.createLinearGradient(headX - 3, headY - 4, headX + 3, headY + 4);
  hgr.addColorStop(0, '#4c4434');
  hgr.addColorStop(1, '#2c2820');
  ctx.fillStyle = hgr;
  ctx.beginPath();
  ctx.ellipse(headX + 3, headY, 5.5, 3.6, striking ? 0 : -0.3, 0, Math.PI * 2);
  ctx.fill();
  // flickering forked tongue while it sizes you up
  if (rearing && Math.sin(t * 14 + e.phase) > 0.2) {
    ctx.strokeStyle = '#e83c4b';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(headX + 8, headY);
    ctx.lineTo(headX + 12, headY - 1);
    ctx.moveTo(headX + 12, headY - 1);
    ctx.lineTo(headX + 14, headY - 2.6);
    ctx.moveTo(headX + 12, headY - 1);
    ctx.lineTo(headX + 14, headY + 0.4);
    ctx.stroke();
  }
  // the white mouth that names it
  if (striking || rearing) {
    ctx.fillStyle = '#f0ece0';
    ctx.beginPath();
    ctx.moveTo(headX + 5, headY - 2);
    ctx.lineTo(headX + 11, headY - 4);
    ctx.lineTo(headX + 11, headY + 4);
    ctx.lineTo(headX + 5, headY + 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e8a13c';
  ctx.beginPath();
  ctx.arc(headX + 2, headY - 1.6, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  telegraph(ctx, e, t, -30);
}
