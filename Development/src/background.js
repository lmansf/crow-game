// Parallax Miami sky: mood palettes (dusk, dawn, night, storm) with
// smooth mixing, sun or moon, ocean glitter, three cached skyline
// silhouette layers, drifting clouds, gulls, and storm weather.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LAYER_W = 2048;
const LAYER_H = 420;

// ---- mood palettes ----
// Every color is '#rrggbb'; alphas ride separately so moods can lerp.
const MOODS = {
  dusk: {
    sky: ['#0d0620', '#221040', '#5a1a5e', '#b63a68', '#3a1548', '#160a26'],
    starDim: 1, shoot: 1,
    sunA: 1, sunRise: 0.25,
    sun0: '#ffd88a', sun1: '#ff8b5e', sun2: '#ff4fa3',
    band: '#5a1a5e', bandA: 0.9,
    glow: '#ff8c6e', glowA: 0.28,
    ray: '#ff9682', rayA: 0.06,
    moon: 0,
    cloud: '#ff96be', cloudA: 0.6, cloudEdge: '#ffaa96', cloudEdgeA: 0.16,
    ocean0: '#5a2a6e', ocean1: '#2a123f', glitter: '#ffb07a',
    haze1: '#b63a68', haze1A: 0.11, haze2: '#3a1548', haze2A: 0.15,
    storm: 0,
  },
  dawn: {
    sky: ['#251a40', '#4e3370', '#b0577e', '#ffb36b', '#5a2b52', '#241330'],
    starDim: 0.35, shoot: 0,
    sunA: 1, sunRise: 0.62,
    sun0: '#fff4c8', sun1: '#ffcf8a', sun2: '#ff9d6b',
    band: '#7a3a66', bandA: 0.55,
    glow: '#ffbe82', glowA: 0.38,
    ray: '#ffd296', rayA: 0.1,
    moon: 0,
    cloud: '#ffcda0', cloudA: 0.9, cloudEdge: '#ffebbe', cloudEdgeA: 0.28,
    ocean0: '#7a4064', ocean1: '#3a1c3c', glitter: '#ffd0a0',
    haze1: '#ffaa78', haze1A: 0.12, haze2: '#96506e', haze2A: 0.13,
    storm: 0,
  },
  night: {
    sky: ['#040310', '#0c0824', '#1b1240', '#38225a', '#1a0f30', '#0b0616'],
    starDim: 1.4, shoot: 1,
    sunA: 0, sunRise: 0.62,
    sun0: '#fff4c8', sun1: '#ffcf8a', sun2: '#ff9d6b',
    band: '#38225a', bandA: 0.4,
    glow: '#ffbe82', glowA: 0,
    ray: '#ffd296', rayA: 0,
    moon: 1,
    cloud: '#b4aadc', cloudA: 0.5, cloudEdge: '#c8beea', cloudEdgeA: 0.12,
    ocean0: '#241d3e', ocean1: '#120c22', glitter: '#9ab0d8',
    haze1: '#3c2864', haze1A: 0.12, haze2: '#1e143c', haze2A: 0.15,
    storm: 0,
  },
  storm: {
    sky: ['#0a0d16', '#141b2c', '#233048', '#334a66', '#192436', '#0b101c'],
    starDim: 0.12, shoot: 0,
    sunA: 0, sunRise: 0.25,
    sun0: '#ffd88a', sun1: '#ff8b5e', sun2: '#ff4fa3',
    band: '#233048', bandA: 0.5,
    glow: '#ff8c6e', glowA: 0,
    ray: '#ff9682', rayA: 0,
    moon: 0,
    cloud: '#8ca0be', cloudA: 1.7, cloudEdge: '#aac8e6', cloudEdgeA: 0.2,
    ocean0: '#22334a', ocean1: '#101828', glitter: '#7a9ab8',
    haze1: '#50698c', haze1A: 0.13, haze2: '#28394f', haze2A: 0.16,
    storm: 1,
  },
};

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mixHex(a, b, k) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const m = ca.map((v, i) => Math.round(v + (cb[i] - v) * k));
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function mixPalette(a, b, k) {
  const out = {};
  for (const key of Object.keys(a)) {
    const va = a[key];
    const vb = b[key];
    if (typeof va === 'number') out[key] = va + (vb - va) * k;
    else if (Array.isArray(va)) out[key] = va.map((c, i) => mixHex(c, vb[i], k));
    else out[key] = mixHex(va, vb, k);
  }
  return out;
}

// mood is a name ('dusk') or a mix descriptor ({ from, to, k })
function resolveMood(mood) {
  if (mood && typeof mood === 'object') {
    const a = MOODS[mood.from] || MOODS.dusk;
    const b = MOODS[mood.to] || MOODS.dawn;
    const k = Math.max(0, Math.min(1, mood.k || 0));
    if (k <= 0) return a;
    if (k >= 1) return b;
    return mixPalette(a, b, k);
  }
  return MOODS[mood] || MOODS.dusk;
}

// soft horizontal fog band peaking at yLine, fading upward over hgt
function hazeBand(ctx, cssW, yLine, hgt, color) {
  const g = ctx.createLinearGradient(0, yLine - hgt, 0, yLine);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, yLine - hgt, cssW, hgt + 26);
}

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

// bald cypress and sawgrass silhouettes for the Everglades layers
function makeGladeline(seed, { color, dense }) {
  const c = document.createElement('canvas');
  c.width = LAYER_W;
  c.height = LAYER_H;
  const ctx = c.getContext('2d');
  const rand = rng(seed);
  // low tree island humps
  let x = 0;
  while (x < LAYER_W) {
    const w = 140 + rand() * 320;
    const h = 26 + rand() * 60;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, LAYER_H, w / 2, h, 0, Math.PI, 0);
    ctx.fill();
    // cypress crowns poking out of the hump
    const trees = 1 + Math.floor(rand() * (dense ? 4 : 2));
    for (let i = 0; i < trees; i++) {
      const tx = x + w * (0.2 + rand() * 0.6);
      const th = 40 + rand() * 70;
      ctx.fillRect(tx - 2, LAYER_H - h - th * 0.7, 4, th * 0.7 + h * 0.5);
      ctx.beginPath();
      ctx.moveTo(tx - th * 0.28, LAYER_H - h - th * 0.55);
      ctx.quadraticCurveTo(tx, LAYER_H - h - th * 1.15, tx + th * 0.28, LAYER_H - h - th * 0.55);
      ctx.closePath();
      ctx.fill();
    }
    x += w + 60 + rand() * 200;
  }
  // sawgrass fringe along the base
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let gx = 0; gx < LAYER_W; gx += 7) {
    if (rand() < 0.5) continue;
    const gh = 8 + rand() * 18;
    ctx.beginPath();
    ctx.moveTo(gx, LAYER_H);
    ctx.lineTo(gx + (rand() - 0.5) * 8, LAYER_H - gh);
    ctx.stroke();
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
    // Everglades variants, used when a level asks for horizon: 'glades'
    this.gladeFar = makeGladeline(404, { color: '#1c2418', dense: false });
    this.gladeMid = makeGladeline(505, { color: '#242e1e', dense: true });
    this.gladeNear = makeGladeline(606, { color: '#2c3a24', dense: true });

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
    this.rainDrops = Array.from({ length: 130 }, (_, i) => ({
      x: rand(), y: rand(), layer: i % 2,
    }));
  }

  draw(ctx, cam, cssW, cssH, t, groundY = 1500, mood = 'dusk', horizonStyle = 'city') {
    const P = resolveMood(mood);
    // ---- sky ----
    const sky = ctx.createLinearGradient(0, 0, 0, cssH);
    const horizon = Math.max(cssH * 0.3, Math.min((groundY - cam.y) * cam.scale * 0.88 - 30, cssH + 90));
    const hFrac = Math.max(0.2, Math.min(horizon / cssH, 1));
    sky.addColorStop(0, P.sky[0]);
    sky.addColorStop(Math.max(0, hFrac - 0.45), P.sky[1]);
    sky.addColorStop(Math.max(0, hFrac - 0.18), P.sky[2]);
    sky.addColorStop(Math.min(1, hFrac - 0.02), P.sky[3]);
    sky.addColorStop(Math.min(1, hFrac + 0.03), P.sky[4]);
    sky.addColorStop(1, P.sky[5]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cssW, cssH);

    // storm: rolling background lightning
    if (P.storm > 0.02) {
      const cyc = t % 7.3;
      if (cyc < 0.42) {
        const k = 1 - cyc / 0.42;
        const flicker = Math.sin(cyc * 62) > -0.2 ? 1 : 0.35;
        ctx.fillStyle = `rgba(190,210,255,${0.15 * P.storm * k * flicker})`;
        ctx.fillRect(0, 0, cssW, horizon + 40);
        // a jagged bolt on some strikes
        const seed = Math.floor(t / 7.3);
        if (seed % 2 === 0 && cyc < 0.2) {
          const bx = ((seed * 631) % 997) / 997 * cssW;
          ctx.strokeStyle = `rgba(220,235,255,${0.7 * k * P.storm})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          let px = bx;
          let py = 0;
          ctx.moveTo(px, py);
          for (let i = 0; i < 7; i++) {
            px += (((seed * 7 + i * 13) % 9) - 4) * 14;
            py += horizon / 8;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
    }

    // stars, with cross flares on the brightest and the odd shooting star
    const starDim = P.starDim;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const sx = ((s.x * 1800 - cam.x * 0.03 * cam.scale) % cssW + cssW) % cssW;
      const sy = s.y * horizon * 0.85;
      const a = Math.min(0.95, (0.35 + 0.4 * Math.sin(t * 1.4 + s.tw)) * starDim);
      ctx.globalAlpha = Math.max(0.03, a);
      ctx.fillRect(sx, sy, s.r, s.r);
      if (i % 16 === 0) {
        ctx.globalAlpha = Math.max(0.02, a * 0.5);
        ctx.fillRect(sx - 3, sy, 7 + s.r, 1);
        ctx.fillRect(sx + s.r / 2, sy - 3, 1, 7);
      }
    }
    ctx.globalAlpha = 1;
    const shoot = t % 19;
    if (shoot < 0.7 && P.shoot > 0.5) {
      const u = shoot / 0.7;
      const seed = Math.floor(t / 19);
      const sx0 = ((seed * 761) % 997) / 997 * cssW;
      const sy0 = ((seed * 397) % 997) / 997 * horizon * 0.45;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - u)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx0 + cssW * 0.16 * u, sy0 + cssH * 0.09 * u);
      ctx.lineTo(sx0 + cssW * 0.16 * u - 42, sy0 + cssH * 0.09 * u - 19);
      ctx.stroke();
    }

    const sunX = cssW * 0.62 - cam.x * 0.02 * cam.scale;
    const sunR = Math.min(cssW, cssH) * 0.16;
    const sunY = horizon - sunR * P.sunRise;

    // moon (night skies)
    if (P.moon > 0.02) {
      const mx = cssW * 0.3 - cam.x * 0.015 * cam.scale;
      const my = horizon * 0.26;
      const mr = Math.min(cssW, cssH) * 0.045;
      ctx.globalAlpha = P.moon;
      ctx.globalCompositeOperation = 'lighter';
      const mg = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.4);
      mg.addColorStop(0, 'rgba(220,228,255,0.30)');
      mg.addColorStop(1, 'rgba(220,228,255,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#e8ecff';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      // waning shadow and mare
      ctx.fillStyle = 'rgba(150,158,196,0.55)';
      ctx.beginPath();
      ctx.arc(mx - mr * 0.42, my - mr * 0.2, mr * 0.3, 0, Math.PI * 2);
      ctx.arc(mx + mr * 0.2, my + mr * 0.34, mr * 0.2, 0, Math.PI * 2);
      ctx.arc(mx + mr * 0.34, my - mr * 0.36, mr * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // low sun with vapor bands (skipped entirely when the mood hides it)
    if (P.sunA > 0.02) {
      ctx.save();
      ctx.globalAlpha = P.sunA;
      ctx.beginPath();
      ctx.rect(0, 0, cssW, horizon);
      ctx.clip();
      const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
      sg.addColorStop(0, P.sun0);
      sg.addColorStop(0.55, P.sun1);
      sg.addColorStop(1, P.sun2);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(P.band, P.bandA);
      for (let i = 0; i < 4; i++) {
        const by = sunY - sunR * 0.15 + i * sunR * 0.26;
        ctx.fillRect(sunX - sunR - 4, by, sunR * 2 + 8, 2.5 + i * 1.5);
      }
      const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 2.6);
      glow.addColorStop(0, rgba(P.glow, Math.max(P.glowA, 0.01)));
      glow.addColorStop(1, rgba(P.glow, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - sunR * 3, sunY - sunR * 3, sunR * 6, sunR * 6);
      // god rays fanning up from the sun
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = (i - 2.5) * 0.34 + Math.sin(t * 0.05 + i * 1.7) * 0.05;
        const len = cssH * 0.95;
        const wdt = sunR * (0.5 + (i % 3) * 0.3);
        ctx.save();
        ctx.translate(sunX, sunY);
        ctx.rotate(a);
        const rg = ctx.createLinearGradient(0, 0, 0, -len);
        rg.addColorStop(0, rgba(P.ray, Math.max(P.rayA, 0.01)));
        rg.addColorStop(1, rgba(P.ray, 0));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-wdt / 2, -len);
        ctx.lineTo(wdt / 2, -len);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    // ocean strip with glitter under the brightest light
    const oceanH = Math.max(10, cssH * 0.045);
    if (horizon < cssH) {
      const og = ctx.createLinearGradient(0, horizon, 0, horizon + oceanH);
      og.addColorStop(0, P.ocean0);
      og.addColorStop(1, P.ocean1);
      ctx.fillStyle = og;
      ctx.fillRect(0, horizon, cssW, oceanH);
      const lightX = P.sunA >= P.moon ? sunX : cssW * 0.3 - cam.x * 0.015 * cam.scale;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = P.glitter;
      for (let i = 0; i < 40; i++) {
        const gx = lightX + Math.sin(i * 132.7) * sunR * (0.2 + (i % 5) * 0.14);
        const gy = horizon + ((i * 7.3 + t * 6) % oceanH);
        if (Math.sin(t * 3 + i) > 0) ctx.fillRect(gx, gy, 3 + (i % 3), 1);
      }
      ctx.globalAlpha = 1;
    }

    // layered clouds with lit undersides
    for (const c of this.clouds) {
      const speed = c.speed * (1 + P.storm * 5);
      const cx = ((c.x * 2400 + t * speed - cam.x * 0.04 * cam.scale) % (cssW + c.w) + cssW + c.w) % (cssW + c.w) - c.w;
      const cy = c.y * horizon;
      ctx.fillStyle = rgba(P.cloud, Math.min(0.5, c.a * P.cloudA));
      ctx.beginPath();
      ctx.ellipse(cx, cy, c.w * 0.5, c.w * 0.11, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - c.w * 0.24, cy + c.w * 0.03, c.w * 0.3, c.w * 0.08, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + c.w * 0.26, cy + c.w * 0.02, c.w * 0.26, c.w * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(P.cloudEdge, P.cloudEdgeA);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + c.w * 0.06, c.w * 0.42, c.w * 0.07, 0, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
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

    // silhouette layers with distance haze between them
    const glades = horizonStyle === 'glades';
    this.drawLayer(ctx, glades ? this.gladeFar : this.far, cam, cssW, horizon, 0.08, 4, glades ? '#10160c' : '#160a26');
    hazeBand(ctx, cssW, horizon + 8, 110, rgba(P.haze1, P.haze1A));
    this.drawLayer(ctx, glades ? this.gladeMid : this.mid, cam, cssW, horizon, 0.2, 14, glades ? '#10160c' : '#160a26');
    hazeBand(ctx, cssW, horizon + 18, 150, rgba(P.haze2, P.haze2A));
    this.drawLayer(ctx, glades ? this.gladeNear : this.near, cam, cssW, horizon, 0.42, 30, glades ? '#10160c' : '#160a26');

    // ground haze below near layer
    const hz = ctx.createLinearGradient(0, horizon, 0, cssH);
    hz.addColorStop(0, 'rgba(28,12,48,0)');
    hz.addColorStop(1, 'rgba(10,5,20,0.75)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizon, cssW, cssH - horizon);
  }

  drawLayer(ctx, layer, cam, cssW, horizon, f, sink, fill = '#160a26') {
    const scl = Math.min(1.15, Math.max(0.6, cssW / 1300));
    const w = LAYER_W * scl;
    const h = LAYER_H * scl;
    const ox = ((cam.x * f * cam.scale) % w + w) % w;
    const y = horizon + sink - h;
    ctx.drawImage(layer, -ox, y, w, h);
    ctx.drawImage(layer, -ox + w, y, w, h);
    if (-ox + w * 2 < cssW) ctx.drawImage(layer, -ox + w * 2, y, w, h);
    // fill below the layer base down past screen bottom
    ctx.fillStyle = fill;
    ctx.fillRect(0, y + h - 1, cssW, 600);
  }

  // Screen-space rain pass, drawn over the world during storms.
  rain(ctx, cam, cssW, cssH, t) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const layer of [
      { speed: 950, len: 15, alpha: 0.12, width: 1, slant: 0.22, par: 0.05 },
      { speed: 1400, len: 24, alpha: 0.2, width: 1.4, slant: 0.3, par: 0.12 },
    ]) {
      ctx.strokeStyle = `rgba(170,200,230,${layer.alpha})`;
      ctx.lineWidth = layer.width;
      ctx.beginPath();
      for (const drop of this.rainDrops) {
        if ((drop.layer === 0) !== (layer.par === 0.05)) continue;
        const fall = t * layer.speed;
        const drift = -fall * layer.slant - cam.x * layer.par * cam.scale;
        const x = ((drop.x * cssW * 1.4 + drift) % (cssW + 60) + cssW + 60) % (cssW + 60) - 30;
        const y = ((drop.y * cssH + fall) % (cssH + 50)) - 25;
        ctx.moveTo(x, y);
        ctx.lineTo(x - layer.len * layer.slant, y + layer.len);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
