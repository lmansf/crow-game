# Painted Sprites — the Canva Art Direction

Owner direction (2026-07-10): replace the procedural look with hand-painted
art generated in Canva — target feel **Ori and the Will of the Wisps**
(luminous, painterly), gameplay feel **Hollow Knight** (a separate tuning
pass), with **90s-style Easter eggs** scattered through the game. Scope for
now: characters, abilities, enemies, and reused objects — backdrops,
landscapes, and level design come later.

**Status 2026-07-11: painted is the DEFAULT look.** The anchor set (crow,
gull, shiny, feather, gate arch, perch) shipped; the bestiary, all seven
bosses, and the twelve curios are hooked and waiting on their images.
`?art=procedural` reverts (persists), `?art=painted` returns. Fail-soft
everywhere: a missing image just leaves that renderer procedural.

## How it works

- `src/sprites.js` — the painted-sprite layer, on by default
  (`?art=procedural` reverts, persists; `?art=painted` returns). Every
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

## Shipped sheets

- Anchor creatures (crow facing right + gull facing left): relayed via
  Drive 2026-07-10, sliced, in game (`drive-relay-1.jpg`).
- Anchor objects (shiny, feather, arch, perch): same day
  (`drive-relay-2.jpg`).

## Production sheets awaiting the Drive relay

Generated + exported 2026-07-11. To land them: open each design in Canva
(links below), Share → Download → JPG, then **Save to Google Drive** from
the phone; the next session pulls them from Drive, slices via
`slices.json`, and the already-shipped hooks light up with no code changes.

1. **Bestiary** — rat, iguana, imp, crab, snake in a row, facing right:
   https://www.canva.com/d/2IMqmUusQmD9KG0 (design DAHPEt6brT0)
2. **Bosses 1** — gull king, rat king, iguanodon:
   https://www.canva.com/d/yDJLMNF1Qb4Jvno (design DAHPEsl-5f8)
3. **Bosses 2** — piñata bull, king crab, snapper, night heron:
   https://www.canva.com/d/tvkV2JnT_yl35E1 (design DAHPEm8FTMg)
4. **Curios** — 12 ray-gun collectibles in a 4×3 grid:
   https://www.canva.com/d/om-xXD7LEiC49x4 (design DAHPEjBuV6s)

Sprite ids the hooks expect: `rat iguana imp crab snake`,
`boss-gullking boss-ratking boss-iguanodon boss-pinatabull boss-kingcrab
boss-snapper boss-heron`, and `curio-<type>` for
`flamingo cone duck dish bucket record maraca cafecito propeller token
egg shell`. Draw widths live in the hooks (enemies 34–64, bosses 100–138,
curios 26); export at 1600×2000 JPG q60 so the relay stays light.

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
