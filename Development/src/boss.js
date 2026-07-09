// District bosses: a giant of the local critter guarding the new skill.
// Data: boss: { type: 'gullking', x, y, arena: { x0, x1, top, floor },
//               drops: 'swoop' }
// The fight is a movement duel: dodge the telegraphed dive, then stomp
// the stunned bird from above. Three stomps and the skill is yours.

import { audio } from './audio.js';
import { particles } from './particles.js';

export class Boss {
  constructor(data, level) {
    this.data = data;
    this.level = level;
    this.type = data.type;
    this.homeX = data.x;
    this.homeY = data.y;
    this.arena = data.arena;
    this.drops = data.drops;
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
    return 1 + (3 - this.hp) * 0.25; // faster with every feather lost
  }

  update(dt, player, game, t) {
    if (this.state === 'dead') return;
    this.stateT += dt;
    if (this.hitT > 0) this.hitT -= dt;
    const a = this.arena;

    if (this.state === 'idle') {
      // perched and waiting: trigger when the crow sets foot in the arena
      this.y = this.homeY + Math.sin(t * 1.3) * 3;
      if (player.dead <= 0 && player.grounded &&
          player.x > a.x0 + 40 && player.x < a.x1 - 40 && player.y > a.top && player.y < a.floor + 40) {
        this.state = 'perch';
        this.stateT = 0;
        for (const w of this.walls) w.off = false;
        audio.squawk();
        audio.smash();
        game.camera?.shake(8, 0.4);
        game.ui.toast('THE GULL KING', 'dodge the dive, then strike from above');
      }
      return;
    }

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
      // tracks the crow, shaking harder as the dive loads
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
      // face-down in the roof gravel: a generous stomp window
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

    // ---- the crow vs the king ----
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
          this.state = 'climb';
          this.stateT = 0;
        }
      }
    } else if ((this.state === 'aim' || this.state === 'dive' || this.state === 'perch') && player.invuln <= 0) {
      // the king only hurts while hunting; his groggy flight home is safe.
      // A hop clears the strike: the box is tight on purpose.
      if (Math.abs(dx) < 36 && Math.abs(dy) < 28) player.die(game);
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
    // the prize falls where the king fell
    this.level.pickups.push({ x: this.x, y: this.y - 60, ability: this.drops, got: false, phase: 0 });
  }

  draw(ctx, t) {
    if (this.state === 'dead') return;
    const e = this;
    // impact marker: where the dive will land
    if (e.state === 'dive' && e.diveTx) {
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
    const S = 3.1; // a giant of his kind
    ctx.save();
    ctx.translate(e.x, e.y);
    // shadow of consequence
    if (e.state === 'dive' || e.state === 'climb') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, this.arena.floor - e.y - 4, 40, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.scale(e.facing * S, S);
    if (e.hitT > 0 && Math.sin(t * 50) > 0) ctx.globalAlpha = 0.55;
    const stunned = e.state === 'stun';
    if (stunned) ctx.rotate(0.5);
    const flap = e.state === 'dive' ? -0.6 : stunned ? 0.9 : Math.sin(t * (e.state === 'aim' ? 20 : 7)) * 0.7;
    // wings
    ctx.strokeStyle = '#e0dac8';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.quadraticCurveTo(-11, -6 - flap * 9, -22, -4 - flap * 15);
    ctx.moveTo(2, -2);
    ctx.quadraticCurveTo(9, -6 - flap * 9, 18, -4 - flap * 13);
    ctx.stroke();
    ctx.strokeStyle = '#7a7262';
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(-22, -4 - flap * 15);
    ctx.lineTo(-29, -2 - flap * 17);
    ctx.stroke();
    // body
    const g = ctx.createLinearGradient(0, -9, 0, 9);
    g.addColorStop(0, '#f4f0e4');
    g.addColorStop(1, '#a8a292');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0.05, 0, Math.PI * 2);
    ctx.fill();
    // battle scars
    ctx.strokeStyle = 'rgba(122,114,98,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(-1, 5);
    ctx.moveTo(3, -4);
    ctx.lineTo(7, -1);
    ctx.stroke();
    // head, beak, crown
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
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(7.5, -11);
    ctx.lineTo(8.5, -15);
    ctx.lineTo(10.5, -12);
    ctx.lineTo(12.5, -15.5);
    ctx.lineTo(14, -11.5);
    ctx.closePath();
    ctx.fill();
    // eye
    ctx.fillStyle = e.state === 'aim' || e.state === 'dive' ? '#e83c4b' : '#191325';
    ctx.beginPath();
    ctx.arc(12, -6.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // stun stars and health feathers
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
