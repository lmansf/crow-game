# Crow Game

A 2D metroidvania set in Miami, in the lineage of *Metroid*, *Castlevania*, *Ori and the Will of the Wisps*, and *Hollow Knight*.

## Premise

You play as a crow washed from the Everglades into the city of Miami by a hurricane. The game is about **escaping the city to get back home to the Everglades**. Along the way you meet various birds, learn lessons, and complete quests.

## Core Mechanic

**Mobility is the primary lock-and-key mechanic.** Progress gates behind movement skills you unlock over the journey:

- Hopping
- Gliding
- Flying
- Rolling

New traversal abilities open up previously unreachable areas, in classic metroidvania fashion.

## Playable Game: Districts 1 to 6

`Development/` contains the full mobile-friendly game built with vanilla HTML5 canvas and ES modules (no dependencies, no build step).
You play a hurricane-blown crow collecting Shinies and unlocking movement abilities across six districts, rendered with a dynamic lightmap, bloom, per-district color grading (`src/fx.js`), mood skies (dusk, dawn, night, storm, and a night-to-dawn blend), and storm weather.
A presentation layer on top adds trauma-based camera shake, a chromatic hit pulse, film grain, a foreground occluder parallax fringe, and seamless camera-pan seam crossings between zones (all gated by the quality tiers in `src/gfx.js`; see `docs/graphics-audit.md` and `docs/art-bible.md`).

- **District 1 - Ocean Drive Rooftops**: beach to beacon across the neon rooftops, ending at THE ROOST.
- **District 2 - Brickell Ascent**: one tall map in three strata (storm drains, downtown streets, skyline), each hiding the skill needed to climb into the next, ending at the EVERGLADES sign on EL FARO's crown.
- **District 3 - Wynwood Walls**: a dawn hub-and-wings map through the gallery district, ending at THE FLOCK mural atop the MUSEO.
- **District 4 - Little Havana Nights**: a midnight festival on Calle Ocho, crossed on grindable light lines, ending at EL GALLO DE ORO above the theater (three caged songbirds hide along the way).
- **District 5 - Skyway Mile Zero**: a storm-lashed triple-decker interchange over a flooded canal, crossed by riding gust rivers, ending at the MILE 0 arch.
- **District 6 - River of Grass**: the Everglades finale from night into dawn, where the flock grants True Flight, ending at THE NEST. Finishing it unlocks Flight in every district.

Each district also features a recognizable piece of real Miami: the Colony Hotel's blue neon blade and a South Beach lifeguard tower (D1), the Freedom Tower and Miami Tower (D2), the Wynwood Walls gate (D3), the Tower Theater fin and Domino Park (D4), the Stiltsville shacks (D5), and the Shark Valley observation tower (D6).

The title screen and the city map's district nodes are dressed with a uniform synthwave art set (`Development/assets/`), generated in Canva to the game's palette; in-game rendering stays fully procedural.

### One connected world

The six districts are stitched into a single mega map by five short, themed connector hallways with glowing zone doors at both ends: the Storm Drain Mouth (D1-D2), the Glide-Way (D2-D3, dusk turns to dawn as you cross), the Painted Underpass (D3-D4), the Toll Ramp (D4-D5, the rain starts halfway), and the Last Causeway (D5-D6).
Crossing a seam never fades to black: the outgoing view and the incoming zone tile edge-to-edge and slide together as one short camera pan (a dissolve for the tractor beam), your momentum carries across, and every ability you have earned walks through with you - the city plays as one continuous place.
The complete screen's NEXT button follows the same path.

### The Rookery (hub) and the Magpie's shop

Beneath the city sits **THE ROOKERY**, a crow-run night market and the world's hub. Every district hides a low flyway gate near its start (the first one is sunk into the Ocean Drive dune); stand inside a gate and hold still for a beat, and the flyway carries you down to the market. From the Rookery, six gates lead back out - one per district.
Only the Ocean Drive gate starts open. The **Magpie's stall** in the middle of the market sells **map fragments** for shinies (every shiny you collect anywhere also lands in a persistent wallet): each fragment charts a district on the city map *and* unseals its Rookery gate, so shinies buy early access and fast travel across the whole city.

### One city map

The menu shows the whole world as a single map: the route snakes beach-to-glades through all six districts with the Rookery hanging beneath, dashed flyway lines marking which hub gates are open. Districts you have never visited (and hold no fragment for) stay uncharted silhouettes; visit a place or buy its fragment and it fills in with its art, name, and your best run.

### The three-room structure

Every district runs the same metroidvania loop: a short intro room with the district's unique critter and a visible tease of a locked reward, a sequence-puzzle chamber, a boss arena guarding the district's signature skill, and a return line that spends the new skill on the teased reward.

- **Room 1 (critters)**: vice gulls (D1), drain rats (D2), sunning iguanas (D3), pinata imps (D4), storm crabs (D5), and cottonmouth snakes (D6).
  Each telegraphs before it strikes, and a swoop drops any of them.
- **Room 2 (puzzles)**: a display board flashes a color order, and touching the pads in that order opens the way - the neon combo chamber (D1), the junction box (D2), the workshop door panel (D3), the conga board (D4), the lock gate (D5), and the cairn stones (D6).
  A wrong pad resets the sequence.
- **Room 3 (bosses)**: a giant of the local species walls you in.
  The Gull King dive-bombs a marked landing spot; the Rat King, El Iguanodon, the Pinata Toro, the King Crab, and the Ancient Snapper rear up and charge until they crash into an arena wall.
  Dodge the telegraphed attack, then stomp the stunned giant from above; three stomps drop the skill it guards.
- **The way back**: each skill opens a themed return line to the reward teased near the district's entrance - the penthouse vault over the beach (Swoop), the bricked stash alcove above the drain door (Beak Break), the stash off MUSEO's shoulder (Talon Hook), the rooftop azotea at the end of the festival light lines (Wire Grind), the osprey's old nest on the toll gantry ridden home on the westbound wind (Tailwind), and the heron roost across the cypress crowns (True Flight).

### An easter egg

Somewhere above downtown, the sky hums green.
Fly into the light and you will be politely abducted into a hidden bonus zone, and if you quest through it you will come home with a RAY GUN.
The ray gun does nothing - except tractor-lift the twelve pieces of curious junk scattered across Miami (a lawn flamingo, a gator egg, a lone maraca...) that nothing else in the game can touch.
Lifted curios are remembered forever.

### Run it

```
python "Crow Game/Development/tools/serve.py" [port]
```

This serves the `Development/` folder on `0.0.0.0` (default port 8123) with caching disabled, so reloads always pick up fresh code - handy when testing on a phone.
Any static file server works too:

```
python -m http.server 8123 --directory "Crow Game/Development"
```

Then open http://localhost:8123 (ES modules require http, not file://).
To play on your phone, open http://YOUR-PC-IP:8123 on the same wifi.

Add `?gfx=off|low|medium|high` to the URL to pick a graphics quality tier (default `high`); the choice persists in localStorage, and `?gfx=off` renders the exact pre-overhaul presentation.
A runtime autoscaler still sheds effects under sustained frame-time pressure, so weak devices stay smooth without touching this.

### Controls

- Desktop: A / D or arrows move, SPACE hops (press again mid-air to flap, hold while falling to glide), SHIFT swoops, ESC pauses, M mutes.
- Touch: on-screen arrows move, the big button hops / flaps / glides, the pink button swoops (appears locked until you find the ability).

### Abilities (metroidvania unlocks)

- Hop and Talon Grip (wall slide + wall kick) are innate.
- District 1: Wing Flap (double jump) and Glide are pickups; Swoop (dash) falls from the Gull King.
- District 2 starts with those three carried over and adds one new skill per stratum:
  - Beak Break (drains, won from the Rat King): swooping smashes cracked brick bulkheads, and one seals the only shaft up to the street.
  - Line Launch (streets): landing on a slack cable slingshots you upward, and a cable chain is the only way to the rooftops.
  - Thermal Soar (skyline): thermals between the towers only lift you once learned, and the summit needs them.
- District 3 adds one new skill per wing:
  - Roll (gallery row): press the dash button on the ground to tumble through low shutter gaps.
  - Paint Grip (container alley): hold into a painted mural wall to climb it.
  - Talon Hook (rooftops, won from El Iguanodon): touch a hanging crane hook to latch on, then jump to launch across the sky.
- The final act carries the full kit forward, and each district's boss guards its signature skill:
  - Wire Grind (District 4, the Pinata Toro): land on a festival light line to slide it, jump to hop between lines.
  - Tailwind (District 5, the King Crab): glide inside a gust field to ride it as a wind highway.
  - True Flight (District 6, the Ancient Snapper): hold jump in the air for sustained wingbeats while stamina lasts; stamina refills on any perch. After the credits, Flight stays unlocked in every district.

### Adding a level

Levels are plain data files.
Copy `Development/src/levels/ocean-drive.js`, edit the geometry and entities, and register the new file in `Development/src/levels/index.js`.
The save data and HUD pick it up automatically; to put it on the city map, give it a spot in `MAP_SPOTS` (`Development/src/ui.js`) and, if it should hang off the hub, a gate in `Development/src/levels/rookery.js`.

The original prototype is preserved as `Development/prototype-v0.html`.

### Marketing assets

`Marketing/ads/` holds a seven-size ad set (mobile banner through story format) with a `gallery.html` for browsing them.
The ads are rendered from the game's own art code by `Development/ads/index.html`.
To regenerate after art or copy changes, serve the game, open `/ads/`, and save each rendered canvas (right click, Save image as).

## Folders

- **Development/** — active work, prototypes, experiments
- **Staging/** — pre-release builds for testing
- **Production/** — shipped / release builds
- **Marketing/** — promotional assets (ad set, gallery)

## License

MIT.
Code, art, and story are free for anyone to use, modify, and redistribute; see [LICENSE](LICENSE).
