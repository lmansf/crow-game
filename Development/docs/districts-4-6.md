# Districts 4 to 6: The Way Home (design reference)

Design-first specs for the final act, written before implementation.
Layout maps were shared as scaled schematics; the coordinates below are the build targets, tuned the same way districts 1 to 3 were (verify reach math in the debug harness before shipping).

## Arc decisions

- The final act grants ONE signature skill per district instead of three, and remixes the full existing kit hard.
  This caps the roster at 12 and gives each new mechanic room to carry a whole map.
- District 6 grants True Flight, the capstone the project README promised (Hopping, Gliding, Flying, Rolling).
  After completing District 6, Flight stays unlocked in every district as the post-game reward.
- Story continuity: D3's outro said "one district left" - that is Little Havana, the last CITY district.
  Beyond it lie the crossing (D5) and home (D6).
- Secret thread: three caged songbirds hidden in D4 can be freed; they reappear in D6's ending.

## District 4 - Little Havana Nights

World 7600 x 2400, groundY 2000, night, travel east to west.
Ambient warm festival night; lantern light sources everywhere; ambience: drifting lantern sparks.

**Story.**
Intro: night falls mid-festival on Calle Ocho; the painted wings point through the party; EL GALLO DE ORO, the golden rooster above the theater, crows only at midnight and knows where the city ends.
Outro: the rooster crows midnight: "The city ends where the river of cars begins. Ride what tries to push you back, and follow it west."
If all three songbirds were freed, they circle the marquee in the outro.

**New skill: WIRE GRIND** (suggested color #f2e963).
Rails are polyline segments `rails: [{x1,y1,x2,y2}]`.
With the skill, landing on a rail snaps the crow to it and slides it (base 380 px/s in facing direction, gravity-accelerated downhill, decays uphill); jump releases with velocity plus a small pop.
Without the skill, rails are intangible.

**Zones and key coordinates.**
- Paseo (7000-7600): spawn (7350, 1970), arrival perch.
- Mercado (5200-7000): market halls at 5200-6100 (h 600) and 6200-7000 (h 550); pinata hooks at (6850,1700), (6600,1650), (6350,1600); roll gap under a stalled cart at ~6150; market arch platform 5100-5250 at y 1300; WIRE GRIND pickup (5175, 1250).
- Plaza de Domino (3600-5200): crowd fences at 3650 and 5150 seal the street (gate); rail chain: (5150,1350)-(4700,1450), (4650,1430)-(4150,1520), (4100,1500)-(3700,1580), then up: (3550,1560)-(3050,1450), (3000,1430)-(2560,1420) into the marquee; drum bounce props on the stage at 4200-4500; stage perch (4350, 1850).
- Teatro Oro (1200-3600): facade 1200-2400 (h 900, roof 1100); marquee platform 2400-2560 at 1420; backstage door in the east wall at ground; interior flytower 1500-2100 with vertical hook chain (1800,1750), (1950,1500), (1800,1300); interior is a dark zone with work lights.
- Roof finale: goal EL GALLO DE ORO at (1600, 1100), text 'EL GALLO'.

**Hazards.** Sparkler fountains: new timed hazard type (erupts on a cycle, telegraphed glow), plus one downed wire.
**Checkpoints.** Paseo, mercado roof (6250,1400), stage (4350,1850), backstage (1800, interior), marquee (2480,1400).
**Gate audit.** Fences seal the floor route; rails anchored above flap reach; flytower has no ledges, hooks only.
**New render kinds.** rail (catenary light-string with bulbs), pinata, drum, fence, lantern strings, crowd silhouette band, theater marquee.

## District 5 - Skyway Mile Zero

World 8000 x 2800; towpath groundY 2400, roadway deck y 1800, skyway deck y 1150; storm dusk, travel west (left to right on the map).
First district with weather: rain streaks, background lightning, gust fields.

**Story.**
Intro: the hurricane's tail catches up at the city's edge; the flooded canal below is the same water that swallowed the crow in Brickell.
The osprey on the radio mast: "Storms took my nest too. Ride what tries to push you back."
Outro at the MILE 0 arch: the storm breaks; behind, the city's glow; ahead, darkness with no neon in it, and stars.

**New skill: TAILWIND** (suggested color #8ef0ff).
Wind zones `winds: [{x,y,w,h,dir,strength}]`.
Without the skill, being airborne inside one applies oscillating push (net zero) plus mild downdraft: uncrossable.
With the skill, gliding inside locks into laminar boost: vx approaches dir * 620, vy held near -40 (a wind highway).

**Zones and key coordinates.**
- Toll Yard (400-1600): spawn (500, 2370); toll gantry frame up to y 1050; roll under toll arms.
- The Locks (1600-3400): canal pools (water hazard, ground holes) at 1900-2200, 2500-2800, 3000-3300; cracked lock bulkhead at 2450 (Beak Break); barge crane hooks at (2650,1500); underpass dark zone 1600-3400 between decks.
- Gantry Run (3400-5600): billboards at (3700,1500), (4100,1400), (4900,1300); radio mast column at 4500 from towpath to y 900; TAILWIND pickup (4550, 880), reached by the barge hook chain plus mast ledges; practice gust corridor (3600-4400, y 1500-1750, dir +1).
- Skyway Span (5600-7300): deck segments 5600-6100 and 6800-7300 at y 1150 (guardrail grind on their edges); gap one 6100-6800 crossed by gust river (5900-6800, y 1250-1500, dir +1); lightning coils on the deck at 6100 and 6700 (2.5s charge cycle, telegraphed); truck exhaust thermals from the roadway below (soar).
- Mile 0 (7300-8000): toll arch at 7650, goal (7650, 1100), text 'MILE 0'.

**Hazards.** Canal water (respawn), lightning coils (timed zap fields), plus wires.
**Checkpoints.** Toll deck (700,1800), locks east towpath (3350,2400), mast base (4500,1800), skyway west (5650,1150), skyway east (6900,1150).
**Gate audit.** Skyway gaps are 700 and 900 wide with downdraft edges: beyond any flap+glide reach; gusts unusable without Tailwind.
**New render kinds.** Concrete deck and pylons, guardrail (rail variant), billboard large, toll arch, lock gates, rain overlay, lightning bg flashes, coil.

## District 6 - River of Grass

World 8400 x 3000, waterline groundY 2500 with hummock ground segments (holes are open water); night at the west edge blending to full dawn at the east edge (sky mood mixes by player x).
No buildings anywhere: the biggest new-art district.

**Story.**
Intro: past Mile 0 there are no streets and no signs, only the river of grass breathing in the dark, exactly as seen from EL FARO's crown.
Midpoint: THE FLOCK from the Wynwood mural appears, real, streaming west on a dawn thermal; flying with them grants True Flight.
Outro at the Home Tree: the nest, the family; the freed songbirds from Little Havana arrive; the pelican and the osprey pass overhead. "Home."
Post-game: True Flight unlocked in all districts.

**New skill: TRUE FLIGHT** (suggested color #ffffff).
Hold jump for sustained wingbeats: vy approaches -300 while held, drawing a stamina meter (~2.5 s) that refills on any landing or perch.
Existing flap/glide unchanged; Flight consumes stamina only while climbing.

**Zones and key coordinates.**
- Hummock segments: 300-1000, 1300-2100, 2400-3400, 3900-4600, 5000-5600, 6100-6700, 7200-8400.
- Mangrove Maw (400-2600): spawn (450, 2470); root tunnels with 22px roll gaps at ~700 and ~1600; the great trunk column at 1700 up to y 1000 with a moss mural-grip stripe; gator jaws in the water gaps 1000-1300 and 2100-2400 (snap on a 2 s cycle: safe while open); firefly hollow dark zone under the canopy with a checkpoint (1900).
- Sawgrass Sea (2600-5400): sinking lily pads across the 3400-3900 gap (one-ways that submerge after ~1.2 s stood on); thermals at 3000 and 4200; ranger tower at 4800 (frame to y 1000) with a guy-wire grind from (4800,1100) down to (5600,1500); flock thermal column at 5500 (base water, top 1200); TRUE FLIGHT pickup (5500, 1500) inside it.
- The Rookery (5400-8400): cypress flight gates: paired trunks at 6300 (opening y 1200-1500) and 7000 (opening y 950-1250), heights only Flight sustains; thorn vine hazards on the low route; the Home Tree at 7800 (trunk to y 700, canopy, nest platform at 7850, y 750); goal THE NEST (7850, 750), text 'THE NEST'.

**Hazards.** Gator jaws (new: cyclic), open water, thorn vines (static).
**Checkpoints.** Mangrove hollow (1900), sawgrass east (3600), tower base (4800), the flock (5500, mid-air perch ring), gates (7000, high perch).
**Gate audit.** Flight gates sit 1000+ above any perch with no walls, hooks, rails, or winds nearby; stamina tuning must allow the gate climbs with ~30% margin.
**New render kinds.** Cypress trunk and canopy, hummock, mangrove root, lily pad, reed, boardwalk ruin, ranger tower frame, gator jaws, nest; background flock sprites; sky mood mixing (dusk to dawn interpolation in Background.draw).

## Build order suggestion

1. D4 (mostly existing systems plus rails and timed hazards).
2. D5 (wind system, weather overlays, water hazard).
3. D6 (organic render kit, gators, lily pads, Flight and stamina HUD, sky mixing, ending sequence).
