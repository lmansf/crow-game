# Perf Log - Graphics Overhaul

Method: debug harness (`?debug=1`) stepping the real frame path (physics + render) at 812x375 in headless Chromium.
Run-to-run noise under background load is +-1.5ms; deltas below that are reported as "below noise".
The runtime autoscaler (`fx.frame`) remains the guardrail on real devices: it sheds bloom, then lighting, under sustained >30ms frames, and every overhaul effect obeys its tier cap.

## Baseline (pre-overhaul)

| Scene | ms/frame |
| --- | --- |
| Skyway Mile Zero, storm + rain + coils (heaviest) | ~1.0 |
| Little Havana, night festival | ~1.2 |

## Effect costs (measured on the heaviest scene)

| Effect | Tier gate | Measured cost |
| --- | --- | --- |
| Trauma shake (translate + rotate) | low+ | below noise (two transforms) |
| Foreground occluder fringe | medium+ | below noise (2-3 cached drawImage) |
| Chromatic hit pulse | medium+ | below noise; ~0.3ms while active (2 quarter-res composites + 2 upscaled draws, <=140ms per hit) |
| Ambient density tiering | all | reduces work at low/medium |
| Film grain (pattern fill, overlay) | high | ~0.2ms |
| Directional wipe | low+ | below noise, only during transitions |

Sequential single-run comparisons showed off=1.02 / medium=1.00 / high=1.19 ms; an interleaved stationary A/B (4x150 frames per tier) showed off=3.08 / high=2.98 under background load - i.e. the tier delta is inside noise, and scene content dominates.

## Regression posture

- `?gfx=off` is the pinned A/B reference: it renders the exact pre-overhaul stack.
- The autoscaler cap per tier: off/medium/high allow the full stack (quality 2), low pins to lightmap-only (quality 1).
- On-device spot checks (mid-tier phone, each district, one boss fight) are required before any future effect raises these numbers; record them here.
