# Painted Sprites — the Canva Art Direction

Owner direction (2026-07-10): replace the procedural look with hand-painted
art generated in Canva — target feel **Ori and the Will of the Wisps**
(luminous, painterly), gameplay feel **Hollow Knight** (a separate tuning
pass), with **90s-style Easter eggs** scattered through the game. Scope for
now: characters, abilities, enemies, and reused objects — backdrops,
landscapes, and level design come later.

## How it works (already shipped, default off)

- `src/sprites.js` — opt-in painted-sprite layer. Load the game with
  `?art=painted` to enable (persists; `?art=procedural` reverts). Every
  hooked renderer falls back to its procedural drawing when the toggle is
  off **or the image file is missing** — absent art can never break the game.
- Hooked so far (the anchor set): grounded crow (`crow-idle`), vice gull
  (`gull`), shinies (`shiny`), ability feathers (`pickup-feather`), zone/
  flyway doors (`gate-arch`), checkpoint perches (`perch`). Engine glow,
  telegraphs, lock boards, linger charge, labels, and stamina ring still
  draw on top — painted art replaces *bodies*, not game-state reads.
- `tools/make-sprites.js` — turns raw Canva PNG exports into game sprites:
  crop per `assets/sprites-raw/slices.json` (see `slices.example.json`),
  flood-key the flat background from the border (interior highlights
  survive), trim, scale, write `assets/sprites/<id>.png`.
- Airborne crow poses stay procedural until multi-pose sheets exist — the
  wing animation is the crow's soul; a single static sprite would flatten it.

## The blocker: this environment cannot download from Canva

Generation works (via the Canva connector) and the designs land in the
owner's Canva account — but the sandbox's network policy 403s every Canva
host, so exports cannot be pulled into the repo from here.

**Fix option A (best):** in the Claude Code environment settings, allow
these domains in the network policy, then any session can run the full
loop: `canva.com`, `www.canva.com`, `design.canva.ai`,
`export-download.canva.com`, `static.canva.com`.

**Fix option B (manual):** open a candidate below in Canva, pick/refine,
export as PNG (2048px wide, highest quality), drop the file into
`Development/assets/sprites-raw/`, describe the crops in `slices.json`,
run `node tools/make-sprites.js`, and test with `?art=painted`.

## Generated candidates awaiting review

Anchor sheet 1 — creatures (crow perched facing right + gull facing left,
flat pale background, crisp edges, no baked glow):

- https://www.canva.com/d/B75e3HAypyxtRyn
- https://www.canva.com/d/ekcOkf12qHvb31s
- https://www.canva.com/d/JkBVKNzKE21XuIh
- https://www.canva.com/d/rMUlf1Q08vD5Z8G

Anchor sheet 2 — objects (gold shard, luminous feather, glowing arch,
pink perch, in a row on flat pale background):

- https://www.canva.com/d/BipOBVhSP7otixX
- https://www.canva.com/d/NZMfABVao2kCh-W
- https://www.canva.com/d/t1REC-p6lF6eja0
- https://www.canva.com/d/GHDvIfoxCDxUyB_

## Prompt recipe (keep for every future sheet)

"…in the luminous hand-painted style of Ori and the Will of the Wisps —
soft painterly shading, rich color depth — on a plain flat solid pale grey
background (#EEEEEE), nothing else, no text, no words, no border, crisp
clean edges, **no outer glow, no drop shadows** (the engine adds glow),
dark-fantasy palette with violet / cyan / gold / pink accent light."
One subject (or a clearly separated row) per design; profile view; state
the facing direction explicitly.

## Sprite spec (anchor set)

| id | subject | facing in art | drawn width | replaces |
| --- | --- | --- | --- | --- |
| crow-idle | crow, wings folded, grounded | right | 48 | player body when grounded |
| gull | vice gull, wings mid-flap | left | 52 | drawGull body |
| shiny | gold faceted shard | n/a | 15 | drawShiny diamond |
| pickup-feather | luminous feather | any | 30 | drawPickup feather |
| gate-arch | glowing stone arch | n/a | stretched to door rect | drawExitDoor frame+tunnel |
| perch | pink roost pole | n/a | 42 | drawPerch armature |

After anchor approval, production order mirrors the manifest: remaining
enemies and bosses (per-creature sheets, 1–2 poses), the curio set, ability
icons at 2x, then the crow's airborne poses (glide / flap-up / flap-down /
swoop / roll) as one consistency-critical sheet.

## Easter eggs (90s-style) — seeded and planned

- ✅ Konami code on the title screen (↑↑↓↓←→←→BA): +100 shinies once,
  with a cheekier message on replays.
- Planned: a dev room behind a fake wall in the Rookery; "SEGA"-style
  startup squawk if you idle on the title 90s; a golden gull (1-in-100
  spawn) that drops 10 shinies; hidden crow graffiti initials in each
  district; the Magpie quoting cheat codes from games that never existed.
