# Graphics Audit - Crow Game

Phase 0 deliverable for the presentation overhaul.
Everything below was measured on the shipped code before the overhaul landed.

## Rendering stack

- Custom **Canvas2D** renderer, zero dependencies, no build step.
  One `requestAnimationFrame` loop in `src/main.js`; fixed 1/120 physics steps accumulate independently of render.
- World art is fully **procedural** (paths, gradients, per-entity draw functions).
  There are no sprite sheets, no atlases, and no texture memory beyond a handful of small cached offscreen canvases (skyline strips, lightmap, bloom taps).
- Existing post stack in `src/fx.js`, all Canvas2D composites (Safari-safe, no `ctx.filter`):
  half-res multiply **lightmap** fed by `level.getLights()`, two-tap downsample **bloom**, per-district overlay **color grade**, radial **vignette**, plus dark zones, sky moods, and a screen-space rain pass in `src/background.js`.
- A rolling **quality autoscaler** (`fx.frame`) drops the stack from full (2) to lightmap-only (1) to bare (0) under sustained frame-time pressure, and climbs back when performance recovers.
  This is the Canvas2D equivalent of dynamic resolution scaling; true internal-resolution scaling is not applicable because the renderer is vector-rate bound, not fill-rate bound, on the target devices.

## Asset inventory

- Zero raster gameplay assets.
  Menu-only art: seven JPGs in `assets/` (title backdrop + six district cards), ~570KB total, DOM-side only.
- Animation is procedural (transform-based squash/stretch, wing phases, ghost afterimages) - no skeletal or spritesheet formats anywhere.

## Performance baseline (pre-overhaul)

Measured through the debug harness (`?debug=1`, `tools/harness.js`) stepping the real frame path at 812x375; headless Chromium on the dev machine.
Wall time per frame includes physics + render.

| Scene | ms/frame |
| --- | --- |
| Skyway Mile Zero (storm, rain, coils, lights - heaviest) | ~1.0 |
| Little Havana (night, lantern lights, festival decor) | ~1.2 |

Note: the headless harness shows run-to-run noise of +-1.5ms under background load; deltas smaller than that are reported as "below noise".
Frame budget on a mid-tier phone is 16.6ms with ~8ms allowed for render; the desktop numbers above leave roughly an order of magnitude of headroom, and the autoscaler owns the long tail on weak devices.

## Upgrade ceiling

Canvas2D cannot do: normal-mapped 2D lighting, LUT color grading, real refraction/heat-distortion shaders, GPU-instanced particles, or KTX2/Basis textures.
Reaching those requires a **WebGL2 renderer migration (with WebGL1 fallback)** - proposed as its own milestone, not attempted here, per the prime directive that the game stays playable at every commit.
Everything implemented in this overhaul fits inside the current stack.

## Risk list

- `multiply`/`overlay` composites are the most expensive ops in the stack on mobile GPUs; every new effect must reuse the existing downsample surfaces rather than adding full-res passes. (The chromatic pulse rides the quarter-res bloom surface for exactly this reason.)
- The hidden-tab harness cannot capture real device frame pacing; on-device spot checks remain the source of truth for the 60fps claim, backed by the runtime autoscaler.
- Procedural art means "asset" changes are code changes: visual regressions are caught by eye and by the harness pixel probes, not by asset diffs.

## What the overhaul added (all presentation-only, all gated)

See `src/gfx.js` for the tier table and `docs/perf-log.md` for measured costs.

1. Quality tiers `off/low/medium/high` via `?gfx=` with localStorage persistence; `?gfx=off` reverts to the exact pre-overhaul presentation for A/B.
2. Trauma-based camera shake (squared falloff, layered-sine wander, micro-rotation) replacing linear random jitter; same `shake(mag, t)` API, zero gameplay-timing impact.
3. Momentary chromatic pulse on impact events, hooked off `game.hitstop` so no gameplay file changed; quarter-res RGB split, decays in ~140ms, never persistent.
4. Film grain at 3% overlay from a pre-rendered noise tile (high tier only).
5. Foreground occluder parallax fringe (palms/railfronds for city, sawgrass for glades) scrolling at 1.28x in front of the player, capped to the bottom ~19% of the screen so it never hides gameplay or touch targets.
6. Ambient biome particle density tiered per gfx level.
7. Directional room wipes on zone doors (follows the door's travel direction), replacing the flat crossfade; plain fade remains for undirected transitions and `gfx=off`.
