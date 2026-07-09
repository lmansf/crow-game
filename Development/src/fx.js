// Post-processing stack: lightmap, bloom, color grade, quality scaling.
// Pure Canvas2D, no ctx.filter dependency: bloom blur comes from
// multi-scale downsampling, so it works everywhere.

export class FX {
  constructor() {
    this.quality = 2; // 2 full, 1 lightmap only, 0 off
    this._slow = 0;
    this._light = document.createElement('canvas');
    this._bloomA = document.createElement('canvas');
    this._bloomB = document.createElement('canvas');
  }

  ensure(cssW, cssH) {
    const lw = Math.max(2, Math.ceil(cssW / 2));
    const lh = Math.max(2, Math.ceil(cssH / 2));
    if (this._light.width !== lw || this._light.height !== lh) {
      this._light.width = lw;
      this._light.height = lh;
      this._bloomA.width = Math.max(2, Math.ceil(cssW / 4));
      this._bloomA.height = Math.max(2, Math.ceil(cssH / 4));
      this._bloomB.width = Math.max(2, Math.ceil(cssW / 8));
      this._bloomB.height = Math.max(2, Math.ceil(cssH / 8));
    }
  }

  // Rolling performance check: drop features rather than frames.
  frame(dtMs) {
    if (dtMs > 30) this._slow++;
    else if (dtMs < 17) this._slow = Math.max(0, this._slow - 0.25);
    if (this._slow > 90 && this.quality > 0) {
      this.quality--;
      this._slow = 0;
    }
  }

  // Multiply an ambient tint over the frame, carving out additive lights.
  lighting(ctx, cam, cssW, cssH, ambient, lights) {
    if (this.quality < 1 || !ambient) return;
    this.ensure(cssW, cssH);
    const L = this._light;
    const l = L.getContext('2d');
    const s = cam.scale * (L.width / cssW);
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = ambient;
    l.fillRect(0, 0, L.width, L.height);
    l.globalCompositeOperation = 'lighter';
    for (const li of lights) {
      const x = (li.x - cam.x) * s;
      const y = (li.y - cam.y) * s;
      const r = li.r * s;
      if (x < -r || x > L.width + r || y < -r || y > L.height + r || r < 2) continue;
      const g = l.createRadialGradient(x, y, r * 0.08, x, y, r);
      g.addColorStop(0, li.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.globalAlpha = li.a ?? 1;
      l.fillStyle = g;
      l.beginPath();
      l.arc(x, y, r, 0, Math.PI * 2);
      l.fill();
    }
    l.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(L, 0, 0, cssW, cssH);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Soft additive glow of the whole frame via two downsample taps.
  bloom(ctx, canvas, cssW, cssH, strength = 0.34) {
    if (this.quality < 2) return;
    this.ensure(cssW, cssH);
    const A = this._bloomA;
    const B = this._bloomB;
    const a = A.getContext('2d');
    const b = B.getContext('2d');
    a.clearRect(0, 0, A.width, A.height);
    a.drawImage(canvas, 0, 0, A.width, A.height);
    b.clearRect(0, 0, B.width, B.height);
    b.drawImage(A, 0, 0, B.width, B.height);
    // bounce B back through A for a wider, softer kernel
    a.drawImage(B, 0, 0, A.width, A.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = strength;
    ctx.drawImage(A, 0, 0, cssW, cssH);
    ctx.globalAlpha = strength * 0.5;
    ctx.drawImage(B, 0, 0, cssW, cssH);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Per-district color wash: cool shadows above, warm light below.
  grade(ctx, cssW, cssH, spec) {
    if (this.quality < 1 || !spec) return;
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, spec.top);
    g.addColorStop(1, spec.bottom);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.globalCompositeOperation = 'source-over';
  }
}
