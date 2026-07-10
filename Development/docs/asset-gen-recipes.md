# Asset Rework Recipes — Crow Game

How production-quality art is produced for this game, reproducibly.

**Engine reality (decided 2026-07-10):** Crow Game ships no gameplay image
assets. Every character, enemy, boss, tile, prop, background, and VFX is
procedural canvas code; `assets/manifest.json` (built by
`tools/asset-manifest.py`) is the single source of truth, one lifecycle row
per renderer or file. The rework direction approved by the owner is
**production quality via the procedural engine — code-only, no image
generation**. "Generation" below therefore means an art pass on a drawing
function, executed against these recipes.

The drop-in contract still applies, translated to code:

- **Geometry is the skeleton.** A renderer's coordinate anchors, sizes, and
  proportions (the body ellipse, the wing origin, the tile grid) are frozen.
  An art pass adds fidelity *around* them; it never moves them. Hitboxes and
  attachment points depend on this.
- **Zero data-format changes.** Level data keys, decor types, and renderer
  signatures stay as they are. Wanting a new parameter is an escalation.
- **Perf budget.** Per-frame renderers (player, enemies, decor) may add
  bounded strokes/fills but no unbounded per-pixel loops and no new per-frame
  allocations (`createLinearGradient` per draw is the existing idiom and is
  acceptable at current counts). Cached renderers (`renderBuilding`, drawn
  once to an offscreen canvas) may be lavish.

## Master style block

From `docs/art-bible.md` — every pass must serve the five pillars
(neon-noir, humid, hand-inked, alive, readable-first).

1. **Three-value form.** Every solid form reads in three values: core shadow,
   local mid, top-light. Two-stop gradients get a third stop or an overlaid
   occlusion/highlight pass. Value range stays inside the district's ambient
   so `fx.lighting` still owns the final exposure.
2. **Rim light law.** Foreground subjects carry a 1–2px rim on the light
   side, colored by the district's signature light (art-bible lighting
   table): D1 dusk pink `#ff4fa3`, D2 sodium gold, D3 dawn peach, D4 lantern
   amber, D5 storm cyan, D6 firefly green-gold. Shared/roaming subjects (the
   crow, enemies) use the violet ambient `#a98fff` at low alpha so they sit
   in every district.
3. **Ink silhouette.** A confident darker containment stroke
   (`rgba(6,4,12,~0.55)`, 1–1.5px) around key silhouettes — this is the
   "hand-inked" pillar and what keeps subjects readable over busier art.
4. **Texture as strokes, never noise.** Feathers, frond serrations, brick
   tonal patches, grime streaks: drawn as a small bounded set of curves and
   patches seeded by the existing `rng()` idiom, so texture is deterministic
   per instance. No photo textures, no random-per-frame shimmer.
5. **Glow idiom.** Neon/emissive = two-layer stroke in `lighter` composite:
   wide low-alpha halo + thin full-strength core (the codebase's existing
   pattern; reuse it, don't invent new bloom).
6. **Palette discipline.** Master tokens only (`#0b0614` ink, `#ff4fa3`
   pink, `#35e0e0` cyan, `#ffd166` gold, `#a98fff` violet) plus each
   district's `ambient`/`grade`/hue set. Gameplay-critical elements keep
   full saturation; environment sits desaturated. Grayscale rule from the
   art bible is a hard gate.

## Anchor set (Phase B)

The approved anchors below are the mandatory style reference for every
subsequent category pass. Contact sheets live in `docs/contact-sheets/`.

| Anchor | Renderer | Recipe applied |
| --- | --- | --- |
| Player crow (idle/all poses) | `src/player.js draw()/drawWing()` | three-value body, chest feather scallops, layered wing with separated primaries + covert row, ink silhouette, violet rim, glint beak |
| Vice gull | `src/enemies.js drawGull()` | filled wing shapes replacing stick strokes, grey mantle, three-value body, ink silhouette, beak gonys spot, tail wedge |
| Palm (prop) | `src/level.js drawPalm()` | filled serrated fronds with midribs replacing single strokes, trunk ring segments, dusk-pink rim, frond droop weight |
| Building facade + brick (tile cluster) | `src/level.js renderBuilding()/drawBlock()` | floor ledge banding, window sills + AC boxes, sill grime streaks, deco crown chevrons, brick tonal patches + damp base |
| Background slice | `src/background.js` | reference-only: already at target after the graphics overhaul; sets the exposure/haze context anchors must sit in |

## Category pipeline (Phases C–E, adapted)

Work priority order from the manifest (P0 → P1 → P2), batch ≤ 20 rows per
review. Per category: apply the master block + the closest anchor recipe,
then gate before flipping manifest status:

- **conformance (tools):** `tools/anchor-shots.js` captures fixed framings;
  geometry constants diffed against git to prove the skeleton is untouched;
  screenshots compared old-vs-new via `tools/make-contact-sheet.js`.
- **readability:** grayscale squint pass of combat framings — crow, hazards,
  pickups must separate; fix by lowering environment contrast, never by
  brightening gameplay elements past palette rules.
- **perf:** `docs/perf-log.md` methodology; a pass may not regress the
  autoscaler tier on the reference device settings.

Statuses in the manifest: `pending → generated (pass written) → conformed
(gates green) → integrated (merged) → approved (owner sign-off on sheet)`.

## Changelog

| Date | Change | Applies to |
| --- | --- | --- |
| 2026-07-10 | Pipeline direction locked: procedural, code-only. Master style block v1. Anchor recipes v1. | anchors batch 01 |
| 2026-07-10 | Batch 02 (Ocean Drive playfield): platform subtypes (awning stripe shading + mount arms, billboard three-value face + braces + rivets, fire-escape grate/railing/braces + lit lip, AC three-value + fan grill + drip, lifeguard hut planks/doorway/deck lip, pipe collars + damp belly), grass blade variation + neon blade, lamp base/bracket/glass housing/post rim, vent grill three values + ink, cable insulator bolts. 10 furniture renderers reviewed conformed-as-is (thermal, wires, shiny, pickup, perch, goal, water, sewer water, backdrop, car). | batch 02 |
