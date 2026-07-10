# Art Bible - Crow Game

The look every visual change must serve.
Cited by the graphics overhaul phases; if an effect fights a pillar, the pillar wins.

## Visual pillars

1. **Neon-noir** - the city glows against deep indigo darkness; light is precious and placed, never flat.
2. **Humid** - haze bands, bloom, wet reflections; Miami air you can feel.
3. **Hand-inked** - clean vector silhouettes with confident curves; no photo textures, no gradients pretending to be paint.
4. **Alive** - something always drifts, sways, or flickers: petals, embers, rain, sign hum.
5. **Readable first** - the crow, hazards, and pickups always separate from the environment; juice never obscures play.

## Palette system

Master palette (also the UI and menu-art palette):

| Role | Color |
| --- | --- |
| Void / ink | `#0b0614` |
| Panel dusk | `#180e2a` |
| Neon pink (danger, accents, boss telegraphs) | `#ff4fa3` |
| Neon cyan (interactables, progress, water) | `#35e0e0` |
| Gold (rewards, shinies, warm light) | `#ffd166` |
| Violet glow (atmosphere) | `#a98fff` |

Per-district sub-palettes live in each level file (`ambient`, `grade`, sky mood); backgrounds sit in desaturated dusk violets, gameplay-critical elements keep the saturated accent colors.
**Grayscale rule:** the crow (near-black with light face) must contrast against every ambient; hazards read at full saturation plus motion; pickups pulse gold.
Any new environment art must pass a squint test against the district's darkest and brightest screens.

## Lighting mood per district

| District | Mood | Signature light |
| --- | --- | --- |
| 1 Ocean Drive | dusk pinks | hotel neon blades, beacon |
| 2 Brickell | night, sodium windows | drain glow, tower beacon |
| 3 Wynwood | dawn pastels | mural paint, crane lamps |
| 4 Little Havana | midnight festival | string lights, marquee |
| 5 Skyway | storm grey-blue | lightning, coil arcs |
| 6 River of Grass | night-to-dawn blend | fireflies, sunrise gold |

## Shape language

- **Crow:** compact teardrop body, sharp beak - the only silhouette with that profile.
- **Critters:** low, wide, skittering shapes; bosses are the same silhouette scaled up with a crown.
- **Environment:** rectilinear architecture with rounded neon trim; organic shapes (palms, sawgrass) only as silhouettes in background/foreground layers.
- **Foreground occluders:** pure near-black silhouettes, never detailed, never taller than a fifth of the screen.

## Technique references

- Hollow Knight: layered haze between parallax planes; restraint in ambient particle density.
- Ori: bloom reserved for emissives; color grading defines biome identity more than geometry does.
- Dead Cells: hit feedback stack (hit-stop + flash + directional particles) that never blocks input reading.
