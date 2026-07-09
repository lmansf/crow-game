// Smooth-follow camera with facing lookahead and world clamping.

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.viewW = 900;
    this.viewH = 560;
    this.lookX = 0;
    this.shakeT = 0;
    this.shakeMag = 0;
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

    if (this.shakeT > 0) this.shakeT -= dt;
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

  shake(mag = 4, t = 0.18) {
    this.shakeMag = mag;
    this.shakeT = t;
  }

  applyShake(ctx) {
    if (this.shakeT > 0) {
      const m = this.shakeMag * (this.shakeT / 0.18);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
  }
}
