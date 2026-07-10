// Smooth-follow camera with facing lookahead and world clamping.

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.viewW = 900;
    this.viewH = 560;
    this.lookX = 0;
    this.trauma = 0;
  }

  resize(cssW, cssH) {
    this.scale = Math.min(Math.max(Math.min(cssH / 520, cssW / 860), 0.5), 2.4);
    this.viewW = cssW / this.scale;
    this.viewH = cssH / this.scale;
  }

  snapTo(px, py, world) {
    this.lookX = 0;
    this.x = px - this.viewW / 2;
    this.y = py - this.viewH * 0.55;
    this.clamp(world);
  }

  follow(player, world, dt) {
    const targetLook = player.facing * 110 + player.vx * 0.12;
    this.lookX += (targetLook - this.lookX) * Math.min(1, 3 * dt);

    const tx = player.x + this.lookX - this.viewW / 2;
    // look slightly ahead of falls so the player can see landings
    const fallBias = player.vy > 250 ? Math.min((player.vy - 250) * 0.14, 130) : 0;
    const ty = player.y + fallBias - this.viewH * 0.55;

    const kx = 1 - Math.exp(-6.5 * dt);
    const ky = 1 - Math.exp(-5 * dt);
    this.x += (tx - this.x) * kx;
    this.y += (ty - this.y) * ky;
    this.clamp(world);

    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - 2.4 * dt);
  }

  easeTo(px, py, world, dt) {
    const k = 1 - Math.exp(-2.4 * dt);
    this.x += (px - this.viewW / 2 - this.x) * k;
    this.y += (py - this.viewH * 0.52 - this.y) * k;
    this.clamp(world);
  }

  clamp(world) {
    this.x = Math.max(0, Math.min(this.x, world.width - this.viewW));
    if (this.viewH >= world.height + 300) {
      this.y = world.height - this.viewH + 150; // tiny viewport in portrait: center-ish
    } else {
      this.y = Math.max(-320, Math.min(this.y, world.height - this.viewH));
    }
  }

  // Trauma pool: impacts add trauma, amplitude follows trauma squared so a
  // shake blooms hard and settles soft instead of decaying linearly.
  // Same signature as before, so every caller keeps working.
  shake(mag = 4, t = 0.18) {
    this.trauma = Math.min(1, this.trauma + Math.min(0.65, mag / 15) + t * 0.2);
  }

  applyShake(ctx, time = 0) {
    if (!(this.trauma > 0)) return;
    const s = this.trauma * this.trauma;
    const m = 13 * s;
    const t = time * 33;
    // layered incommensurate sines: smooth wander, no strobing
    const nx = Math.sin(t) * 0.62 + Math.sin(t * 1.73 + 4.2) * 0.38;
    const ny = Math.sin(t * 1.31 + 1.7) * 0.62 + Math.sin(t * 2.17 + 2.9) * 0.38;
    const rot = (Math.sin(t * 0.91 + 0.6) * 0.5 + Math.sin(t * 1.51) * 0.5) * 0.005 * s;
    ctx.translate(nx * m, ny * m);
    ctx.rotate(rot);
  }
}
