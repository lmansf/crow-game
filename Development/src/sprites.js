// Painted-sprite layer: swaps select procedural renderers for hand-painted
// images (the Canva/Ori-style art direction) when enabled. Strictly opt-in
// and fail-soft: with the toggle off, or an image missing, every renderer
// falls back to its procedural drawing - the shipped game never breaks on
// absent art.
//
// Toggle: load with ?art=painted (persists), ?art=procedural to revert.
// Assets: assets/sprites/<id>.png, produced by tools/make-sprites.js from
// raw Canva exports. Catalog and pose/size spec: docs/painted-sprites.md.

const CATALOG = [
  'crow-idle',        // grounded crow, profile facing right, wings folded
  'gull',             // vice gull, profile, wings mid-flap
  'shiny',            // golden shard
  'pickup-feather',   // glowing ability feather
  'gate-arch',        // flyway/zone door arch
  'perch',            // checkpoint roost
];

export const sprites = {
  on: false,
  images: new Map(),
  get(id) {
    return this.on ? this.images.get(id) : undefined;
  },
};

export function initSprites() {
  const q = new URLSearchParams(location.search).get('art');
  if (q === 'painted') localStorage.setItem('crow-art', 'painted');
  else if (q === 'procedural') localStorage.removeItem('crow-art');
  if (localStorage.getItem('crow-art') !== 'painted') return;
  sprites.on = true;
  for (const id of CATALOG) {
    const img = new Image();
    img.onload = () => sprites.images.set(id, img);
    img.onerror = () => { /* missing art: that renderer stays procedural */ };
    img.src = `assets/sprites/${id}.png`;
  }
}

// Draw an image centered on (cx, cy) at the given logical width, preserving
// aspect. flip mirrors horizontally around the center; rot is radians.
export function drawSprite(ctx, img, cx, cy, w, { flip = false, rot = 0 } = {}) {
  const h = w * (img.height / img.width);
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
