// Parallax Miami night: afterglow sky, half-set sun, ocean glitter,
// three cached skyline silhouette layers, drifting clouds and gulls.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LAYER_W = 2048;
const LAYER_H = 420;

function makeSkyline(seed, { color, minH, maxH, windowAlpha, neon }) {
  const c = document.createElement('canvas');
  c.width = LAYER_W;
  c.height = LAYER_H;
  const ctx = c.getContext('2d');
  const rand = rng(seed);
  let x = 0;
  while (x < LAYER_W) {
    const w = 46 + rand() * 110;
    const h = minH + rand() * (maxH - minH);
    const top = LAYER_H - h;
    ctx.fillStyle = color;
    ctx.fillRect(x, top, w, h);

    // rooftop silhouette details
    const d = rand();
    ctx.fillStyle = color;
    if (d < 0.25) {
      ctx.fillRect(x + w * 0.42, top - 16, 3, 16); // antenna
    } else if (d < 0.4) {
      ctx.beginPath(); // water tank
      ctx.arc(x + w * 0.5, top - 7, 9, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x + w * 0.5 - 9, top - 7, 18, 7);
    } else if (d < 0.5) {
      ctx.fillRect(x + w * 0.2, top - 8, w * 0.6, 8); // setback
    }

    // windows
    if (windowAlpha > 0) {
      for (let wy = top + 10; wy < LAYER_H - 14; wy += 13) {
        for (let wx = x + 6; wx < x + w - 8; wx += 11) {
          if (rand() < 0.32) {
            const warm = rand();
            ctx.fillStyle = warm < 0.8
              ? `rgba(255, 214, 150, ${windowAlpha * (0.5 + rand() * 0.5)})`
              : `rgba(120, 235, 235, ${windowAlpha * 0.8})`;
            ctx.fillRect(wx, wy, 3, 4.5);
          }
        }
      }
    }

    // occasional neon glow blob on mid/near layers
    if (neon && rand() < 0.3) {
      const hue = [320, 180, 45, 275][Math.floor(rand() * 4)];
      const gx = x + w * (0.25 + rand() * 0.5);
      const gy = top + 14 + rand() * 26;
      const gr = 10 + rand() * 16;
      const grad = ctx.createRadialGradient(gx, gy, 1, gx, gy, gr);
      grad.addColorStop(0, `hsla(${hue}, 95%, 68%, 0.55)`);
      grad.addColorStop(1, `hsla(${hue}, 95%, 68%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      ctx.fill();
    }

    x += w + 2 + rand() * 16;
  }

  // palm silhouettes sprinkled along the base of the near layer
  if (neon === 'palms') {
    for (let i = 0; i < 26; i++) {
      const px = rand() * LAYER_W;
      drawPalmSil(ctx, px, LAYER_H, 22 + rand() * 20, color, rand);
    }
  }
  return c;
}

function drawPalmSil(ctx, x, baseY, h, color, rand) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  const lean = (rand() - 0.5) * 14;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 0.4, baseY - h * 0.6, x + lean, baseY - h);
  ctx.stroke();
  const tx = x + lean;
  const ty = baseY - h;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.42;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * h * 0.42, ty + Math.sin(a) * h * 0.42 - 4, tx + Math.cos(a) * h * 0.62, ty + Math.sin(a) * h * 0.62 + h * 0.14);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export class Background {
  constructor() {
    this.far = makeSkyline(101, { color: '#241040', minH: 60, maxH: 175, windowAlpha: 0.22, neon: false });
    this.mid = makeSkyline(202, { color: '#331653', minH: 95, maxH: 265, windowAlpha: 0.3, neon: true });
    this.near = makeSkyline(303, { color: '#43206b', minH: 130, maxH: 330, windowAlpha: 0.24, neon: 'palms' });

    const rand = rng(777);
    this.stars = Array.from({ length: 130 }, () => ({
      x: rand(), y: rand() * 0.62, r: 0.5 + rand() * 1.2, tw: rand() * 6,
    }));
    this.clouds = Array.from({ length: 6 }, () => ({
      x: rand(), y: 0.08 + rand() * 0.3, w: 120 + rand() * 220, speed: 2 + rand() * 5, a: 0.05 + rand() * 0.08,
    }));
    this.gulls = Array.from({ length: 3 }, (_, i) => ({
      x: rand() * 3000, y: 160 + rand() * 240, speed: 26 + rand() * 22, phase: i * 2.1,
    }));
  }

  draw(ctx, cam, cssW, cssH, t, groundY = 1500, mood = 'dusk') {
    const dawn = mood === 'dawn';
    // ---- sky ----
    const sky = ctx.createLinearGradient(0, 0, 0, cssH);
    const horizon = Math.max(cssH * 0.3, Math.min((groundY - cam.y) * cam.scale * 0.88 - 30, cssH + 90));
    const hFrac = Math.max(0.2, Math.min(horizon / cssH, 1));
    if (dawn) {
      sky.addColorStop(0, '#251a40');
      sky.addColorStop(Math.max(0, hFrac - 0.45), '#4e3370');
      sky.addColorStop(Math.max(0, hFrac - 0.18), '#b0577e');
      sky.addColorStop(Math.min(1, hFrac - 0.02), '#ffb36b');
      sky.addColorStop(Math.min(1, hFrac + 0.03), '#5a2b52');
      sky.addColorStop(1, '#241330');
    } else {
      sky.addColorStop(0, '#0d0620');
      sky.addColorStop(Math.max(0, hFrac - 0.45), '#221040');
      sky.addColorStop(Math.max(0, hFrac - 0.18), '#5a1a5e');
      sky.addColorStop(Math.min(1, hFrac - 0.02), '#b63a68');
      sky.addColorStop(Math.min(1, hFrac + 0.03), '#3a1548');
      sky.addColorStop(1, '#160a26');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cssW, cssH);
    const starDim = dawn ? 0.35 : 1;

    // stars
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      const sx = ((s.x * 1800 - cam.x * 0.03 * cam.scale) % cssW + cssW) % cssW;
      const sy = s.y * horizon * 0.85;
      const a = (0.35 + 0.4 * Math.sin(t * 1.4 + s.tw)) * starDim;
      ctx.globalAlpha = Math.max(0.05, a);
      ctx.fillRect(sx, sy, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // low sun with vapor bands (half set at dusk, rising at dawn)
    const sunX = cssW * 0.62 - cam.x * 0.02 * cam.scale;
    const sunR = Math.min(cssW, cssH) * 0.16;
    const sunY = horizon - sunR * (dawn ? 0.62 : 0.25);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cssW, horizon);
    ctx.clip();
    const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    if (dawn) {
      sg.addColorStop(0, '#fff4c8');
      sg.addColorStop(0.55, '#ffcf8a');
      sg.addColorStop(1, '#ff9d6b');
    } else {
      sg.addColorStop(0, '#ffd88a');
      sg.addColorStop(0.55, '#ff8b5e');
      sg.addColorStop(1, '#ff4fa3');
    }
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dawn ? 'rgba(122,58,102,0.55)' : 'rgba(90,26,94,0.9)';
    for (let i = 0; i < 4; i++) {
      const by = sunY - sunR * 0.15 + i * sunR * 0.26;
      ctx.fillRect(sunX - sunR - 4, by, sunR * 2 + 8, 2.5 + i * 1.5);
    }
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 2.6);
    glow.addColorStop(0, dawn ? 'rgba(255,190,130,0.38)' : 'rgba(255,140,110,0.28)');
    glow.addColorStop(1, 'rgba(255,140,110,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - sunR * 3, sunY - sunR * 3, sunR * 6, sunR * 6);
    ctx.restore();

    // ocean strip with glitter and sun column
    const oceanH = Math.max(10, cssH * 0.045);
    if (horizon < cssH) {
      const og = ctx.createLinearGradient(0, horizon, 0, horizon + oceanH);
      og.addColorStop(0, '#5a2a6e');
      og.addColorStop(1, '#2a123f');
      ctx.fillStyle = og;
      ctx.fillRect(0, horizon, cssW, oceanH);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffb07a';
      for (let i = 0; i < 40; i++) {
        const gx = sunX + Math.sin(i * 132.7) * sunR * (0.2 + (i % 5) * 0.14);
        const gy = horizon + ((i * 7.3 + t * 6) % oceanH);
        if (Math.sin(t * 3 + i) > 0) ctx.fillRect(gx, gy, 3 + (i % 3), 1);
      }
      ctx.globalAlpha = 1;
    }

    // clouds
    for (const c of this.clouds) {
      const cx = ((c.x * 2400 + t * c.speed - cam.x * 0.04 * cam.scale) % (cssW + c.w) + cssW + c.w) % (cssW + c.w) - c.w;
      const cy = c.y * horizon;
      ctx.fillStyle = dawn ? `rgba(255,205,160,${c.a * 0.9})` : `rgba(255,150,190,${c.a * 0.6})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, c.w * 0.5, c.w * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // gulls
    ctx.strokeStyle = 'rgba(20,10,34,0.85)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const g of this.gulls) {
      const gx = ((g.x + t * g.speed - cam.x * 0.12 * cam.scale) % (cssW + 200) + cssW + 200) % (cssW + 200) - 100;
      const gy = g.y * (horizon / 560) + Math.sin(t * 0.7 + g.phase) * 14;
      const f = Math.sin(t * 7 + g.phase) * 3.5;
      ctx.beginPath();
      ctx.moveTo(gx - 6, gy - f);
      ctx.quadraticCurveTo(gx, gy + 2, gx + 0.5, gy);
      ctx.quadraticCurveTo(gx + 1, gy + 2, gx + 7, gy - f);
      ctx.stroke();
    }

    // skyline layers
    this.drawLayer(ctx, this.far, cam, cssW, horizon, 0.08, 4);
    this.drawLayer(ctx, this.mid, cam, cssW, horizon, 0.2, 14);
    this.drawLayer(ctx, this.near, cam, cssW, horizon, 0.42, 30);

    // ground haze below near layer
    const hz = ctx.createLinearGradient(0, horizon, 0, cssH);
    hz.addColorStop(0, 'rgba(28,12,48,0)');
    hz.addColorStop(1, 'rgba(10,5,20,0.75)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizon, cssW, cssH - horizon);
  }

  drawLayer(ctx, layer, cam, cssW, horizon, f, sink) {
    const scl = Math.min(1.15, Math.max(0.6, cssW / 1300));
    const w = LAYER_W * scl;
    const h = LAYER_H * scl;
    const ox = ((cam.x * f * cam.scale) % w + w) % w;
    const y = horizon + sink - h;
    ctx.drawImage(layer, -ox, y, w, h);
    ctx.drawImage(layer, -ox + w, y, w, h);
    if (-ox + w * 2 < cssW) ctx.drawImage(layer, -ox + w * 2, y, w, h);
    // fill below the layer base down past screen bottom
    ctx.fillStyle = '#160a26';
    ctx.fillRect(0, y + h - 1, cssW, 600);
  }
}
