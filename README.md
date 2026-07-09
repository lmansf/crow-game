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

- **District 1 - Ocean Drive Rooftops**: beach to beacon across the neon rooftops, ending at THE ROOST.
- **District 2 - Brickell Ascent**: one tall map in three strata (storm drains, downtown streets, skyline), each hiding the skill needed to climb into the next, ending at the EVERGLADES sign on EL FARO's crown.
- **District 3 - Wynwood Walls**: a dawn hub-and-wings map through the gallery district, ending at THE FLOCK mural atop the MUSEO.
- **District 4 - Little Havana Nights**: a midnight festival on Calle Ocho, crossed on grindable light lines, ending at EL GALLO DE ORO above the theater (three caged songbirds hide along the way).
- **District 5 - Skyway Mile Zero**: a storm-lashed triple-decker interchange over a flooded canal, crossed by riding gust rivers, ending at the MILE 0 arch.
- **District 6 - River of Grass**: the Everglades finale from night into dawn, where the flock grants True Flight, ending at THE NEST. Finishing it unlocks Flight in every district.

Each district also features a recognizable piece of real Miami: the Colony Hotel's blue neon blade and a South Beach lifeguard tower (D1), the Freedom Tower and Miami Tower (D2), the Wynwood Walls gate (D3), the Tower Theater fin and Domino Park (D4), the Stiltsville shacks (D5), and the Shark Valley observation tower (D6).

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

### Controls

- Desktop: A / D or arrows move, SPACE hops (press again mid-air to flap, hold while falling to glide), SHIFT swoops, ESC pauses, M mutes.
- Touch: on-screen arrows move, the big button hops / flaps / glides, the pink button swoops (appears locked until you find the ability).

### Abilities (metroidvania unlocks)

- Hop and Talon Grip (wall slide + wall kick) are innate.
- District 1 pickups: Wing Flap (double jump), Glide, and Swoop (dash).
- District 2 starts with those three carried over and adds one new skill per stratum:
  - Beak Break (drains): swooping smashes cracked brick bulkheads, and one seals the only shaft up to the street.
  - Line Launch (streets): landing on a slack cable slingshots you upward, and a cable chain is the only way to the rooftops.
  - Thermal Soar (skyline): thermals between the towers only lift you once learned, and the summit needs them.
- District 3 adds one new skill per wing:
  - Roll (gallery row): press the dash button on the ground to tumble through low shutter gaps.
  - Paint Grip (container alley): hold into a painted mural wall to climb it.
  - Talon Hook (rooftops): touch a hanging crane hook to latch on, then jump to launch across the sky.
- The final act carries the full kit forward and grants one signature skill per district:
  - Wire Grind (District 4): land on a festival light line to slide it, jump to hop between lines.
  - Tailwind (District 5): glide inside a gust field to ride it as a wind highway.
  - True Flight (District 6): hold jump in the air for sustained wingbeats while stamina lasts; stamina refills on any perch. After the credits, Flight stays unlocked in every district.

### Adding a level

Levels are plain data files.
Copy `Development/src/levels/ocean-drive.js`, edit the geometry and entities, and register the new file in `Development/src/levels/index.js`.
The district select screen, save data, and HUD pick it up automatically.

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
