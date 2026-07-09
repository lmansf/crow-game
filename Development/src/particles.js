// Lightweight pooled particle system.
// Kinds: spark (glowing dot), feather (tumbling triangle), dust (soft puff).

const MAX = 520;
const pool = [];

// pre-rendered radial glow sprites, cached per color
const glowCache = new Map();
function glowSprite(color) {
  let c = glowCache.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 48;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(24, 24, 2, 24, 24, 24);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 48, 48);
    if (glowCache.size > 400) glowCache.clear();
    glowCache.set(color, c);
  }
  return c;
}

function spawn(p) {
  if (pool.length >= MAX) pool.shift();
  pool.push(p);
}

export const particles = {
  clear() {
    pool.length = 0;
  },

  burst(x, y, { count = 10, color = '#ffd166', speed = 220, spread = Math.PI * 2, angle = -Math.PI / 2, life = 0.6, size = 3, gravity = 300, glow = true } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.75);
      spawn({
        kind: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.6), t: 0,
        size: size * (0.6 + Math.random() * 0.8),
        color, gravity, glow,
      });
    }
  },

  feathers(x, y, count = 5, dir = 0) {
    for (let i = 0; i < count; i++) {
      spawn({
        kind: 'feather', x, y,
        vx: dir * 60 + (Math.random() - 0.5) * 160,
        vy: -40 - Math.random() * 110,
        life: 0.9 + Math.random() * 0.7, t: 0,
        size: 4 + Math.random() * 3,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        color: Math.random() < 0.35 ? '#5a4a8a' : '#23202e',
      });
    }
  },

  dust(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      spawn({
        kind: 'dust', x, y: y + 2,
        vx: (Math.random() - 0.5) * 130,
        vy: -15 - Math.random() * 45,
        life: 0.35 + Math.random() * 0.3, t: 0,
        size: 3.5 + Math.random() * 3,
        color: 'rgba(190,175,210,',
      });
    }
  },

  trail(x, y, color) {
    spawn({
      kind: 'spark', x, y,
      vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
      life: 0.35 + Math.random() * 0.2, t: 0,
      size: 2 + Math.random() * 2,
      color, gravity: 0, glow: true,
    });
  },

  update(dt) {
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.t += dt;
      if (p.t >= p.life) {
        pool.splice(i, 1);
        continue;
      }
      if (p.kind === 'feather') {
        p.vy = Math.min(p.vy + 260 * dt, 70);
        p.vx *= 1 - 1.4 * dt;
        p.rot += p.vrot * dt;
        p.x += p.vx * dt + Math.sin(p.t * 6 + p.rot) * 26 * dt;
        p.y += p.vy * dt;
      } else {
        p.vy += (p.gravity || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
  },

  draw(ctx) {
    for (const p of pool) {
      const k = 1 - p.t / p.life;
      if (p.kind === 'spark') {
        ctx.globalAlpha = k;
        if (p.glow) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = k * 0.55;
          const r = p.size * (0.5 + k * 0.5) * 3.2;
          ctx.drawImage(glowSprite(p.color), p.x - r, p.y - r, r * 2, r * 2);
          ctx.globalAlpha = k;
        }
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'feather') {
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.size, 0);
        ctx.quadraticCurveTo(0, -p.size * 0.7, p.size * 1.6, 0);
        ctx.quadraticCurveTo(0, p.size * 0.7, -p.size, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(169,143,255,0.5)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-p.size, 0);
        ctx.lineTo(p.size * 1.6, 0);
        ctx.stroke();
        ctx.restore();
      } else {
        // dust
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color + (0.35 * k) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + p.t * 2.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
};
