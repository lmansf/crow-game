#!/usr/bin/env python3
"""Phase A asset crawler for the art-rework pipeline.

Walks the game's real asset surface and writes assets/manifest.json plus a
human-readable assets/manifest.csv, one row per asset, with category, biome
tags, priority tier, usage references, and lifecycle status.

Crow Game's structural reality: gameplay art is not files. Apart from menu
art and PWA icons, every character, tile, prop, background, and VFX is drawn
procedurally by canvas code. The manifest therefore inventories BOTH:
  - medium "file":       image files on disk (dimensions parsed from bytes)
  - medium "procedural": named draw/render functions in src/, the actual
                         unit of art in this engine (frame counts do not
                         apply; animation is continuous and code-driven)

Usage: python tools/asset-manifest.py   (from Development/ or anywhere)
"""

import csv
import json
import os
import re
import struct
import sys
from collections import Counter

DEV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(DEV, 'src')
LEVELS = os.path.join(DEV, 'levels')  # not a dir; levels live in src/levels
LEVELS = os.path.join(SRC, 'levels')
ASSETS = os.path.join(DEV, 'assets')

# ---------------------------------------------------------------- image files

def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    w, h = struct.unpack('>II', head[16:24])
    return w, h


def jpeg_size(path):
    with open(path, 'rb') as f:
        data = f.read()
    if data[:2] != b'\xff\xd8':
        return None
    i = 2
    while i < len(data) - 9:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack('>HH', data[i + 5:i + 9])
            return w, h
        i += 2 + struct.unpack('>H', data[i + 2:i + 4])[0]
    return None


def read_sources():
    out = {}
    for base, _, files in os.walk(SRC):
        for name in files:
            if name.endswith('.js'):
                p = os.path.join(base, name)
                out[os.path.relpath(p, DEV)] = open(p, encoding='utf-8').read()
    for name in ('index.html', 'style.css', 'sw.js', 'manifest.webmanifest'):
        p = os.path.join(DEV, name)
        if os.path.exists(p):
            out[name] = open(p, encoding='utf-8').read()
    return out


# ------------------------------------------------------------- categorisation

TILESET_FNS = {'drawBlock', 'drawBackdrop', 'drawWater', 'drawSewerWater', 'drawGround'}
INTERACTIVE_FNS = {
    'drawGoal', 'drawExitDoor', 'drawShopStall', 'drawPlatform', 'drawCable',
    'drawRail', 'drawVent', 'drawThermal', 'drawHook', 'drawWind', 'drawMural',
    'drawLilyPad', 'drawWireHazard', 'drawThornVine', 'drawPuzzleSwitch',
    'drawPuzzleDisplay', 'drawCage', 'drawCurio', 'drawBeamColumn', 'drawShiny',
    'drawPickup', 'drawCheckpoint', 'drawPerch',
}


def categorize(fn, rel):
    if 'enemies.js' in rel:
        return 'enemy_anim'
    if 'boss.js' in rel:
        return 'boss_anim'
    if 'player.js' in rel:
        return 'player_anim'
    if 'background.js' in rel:
        return 'background_layer'
    if 'particles.js' in rel or 'fx.js' in rel:
        return 'vfx_frames'
    if fn in TILESET_FNS:
        return 'tileset'
    if fn in INTERACTIVE_FNS:
        return 'prop_animated'
    if fn.startswith('render'):
        return 'prop_static'  # cached facade renderers (buildings)
    return None  # decided later by animation signature


def main():
    sources = read_sources()
    level_files = {rel: text for rel, text in sources.items() if rel.startswith(os.path.join('src', 'levels').replace(os.sep, '/')) or rel.startswith('src/levels')}
    rows = []

    # ---- 1. image files on disk
    for name in sorted(os.listdir(ASSETS)):
        path = os.path.join(ASSETS, name)
        if not os.path.isfile(path) or name.endswith(('.json', '.csv')):
            continue
        size = png_size(path) if name.endswith('.png') else jpeg_size(path)
        # literal references, plus the templated `card-${...}.jpg` form ui.js uses
        templated = re.sub(r'\d+', r'${', name) if re.search(r'\d', name) else None
        refs = sorted(rel for rel, text in sources.items()
                      if name in text or (templated and templated.split('.')[0] in text))
        category = 'ui_icon' if 'icon' in name else 'ui_panel'
        rows.append({
            'id': f'assets/{name}',
            'medium': 'file',
            'path': f'assets/{name}',
            'file': None, 'line': None,
            'width': size[0] if size else None,
            'height': size[1] if size else None,
            'pivot': 'n/a (DOM/CSS placement)',
            'category': category,
            'clip': None,
            'frames': None,
            'timing': None,
            'usage_refs': refs,
            'dead': not refs,
            'biomes': ['menu'],
            'tier': 'P2',
            'status': 'pending',
            'note': 'Canva menu art' if name.endswith('.jpg') else 'PWA icon (generated)',
        })

    # ---- 2. decor dispatch map (decor type -> renderer) for biome tagging
    decor_map = {}
    m_level = sources.get('src/level.js', '')
    for m in re.finditer(r"d\.type === '(\w+)'\)\s*(draw\w+)", m_level):
        decor_map[m.group(2)] = m.group(1)

    def biomes_for(token):
        """Which level files mention this entity/decor type."""
        out = []
        for rel, text in level_files.items():
            if re.search(r"type:\s*'" + re.escape(token) + "'", text):
                out.append(os.path.splitext(os.path.basename(rel))[0])
        return sorted(out)

    # ---- 3. procedural renderers
    fn_re = re.compile(r'^(?:export\s+)?function\s+((?:draw|render)[A-Z]\w*)\s*\(([^)]*)\)', re.M)
    all_src = {rel: text for rel, text in sources.items() if rel.endswith('.js') and rel.startswith('src')}
    entity_tokens = {  # renderer -> the data token that levels reference
        'drawGull': 'gull', 'drawRat': 'rat', 'drawIguana': 'iguana',
        'drawImp': 'imp', 'drawCrab': 'crab', 'drawSnake': 'snake',
        'drawGullKing': 'gullking', 'drawRatKing': 'ratking',
        'drawIguanodon': 'iguanodon', 'drawPinataBull': 'pinatabull',
        'drawKingCrab': 'kingcrab', 'drawSnapper': 'snapper',
    }
    for rel, text in sorted(all_src.items()):
        for m in fn_re.finditer(text):
            fn, params = m.group(1), m.group(2)
            line = text[:m.start()].count('\n') + 1
            calls = sum(t.count(fn + '(') for t in all_src.values()) - 1
            category = categorize(fn, rel)
            if category is None:
                category = 'prop_animated' if re.search(r'(^|,)\s*t\s*(,|$)', params) else 'prop_static'
            token = entity_tokens.get(fn) or decor_map.get(fn)
            biomes = biomes_for(token) if token else ['shared']
            if category == 'player_anim':
                biomes = ['all']
            tier = 'P2'
            if category in ('player_anim',):
                tier = 'P0'
            elif 'ocean-drive' in biomes:
                tier = 'P0'
            elif category in ('tileset', 'background_layer') and biomes == ['shared']:
                tier = 'P0'
            elif category in ('enemy_anim', 'boss_anim', 'vfx_frames') or biomes != ['shared']:
                tier = 'P1'
            rows.append({
                'id': f'{rel}::{fn}',
                'medium': 'procedural',
                'path': rel,
                'file': rel, 'line': line,
                'width': None, 'height': None,
                'pivot': 'code-defined origin (x, y args)',
                'category': category,
                'clip': token or fn.replace('draw', '').replace('render', ''),
                'frames': None,
                'timing': 'continuous (code-driven, no frames)',
                'usage_refs': [r for r, t2 in all_src.items() if fn + '(' in t2 and r != rel] or [rel],
                'dead': calls == 0,
                'biomes': biomes,
                'tier': tier,
                'status': 'pending',
                'note': '',
            })

    # ---- 4. class-method art the function regex cannot see. These are the
    # engine's layer/VFX/animation systems; rows are curated but verified
    # against the named methods and state fields in their source files.
    def method_line(rel, name):
        text = all_src.get(rel, '')
        m = re.search(r'^  ' + re.escape(name) + r'\s*\(', text, re.M)
        return text[:m.start()].count('\n') + 1 if m else None

    def curated(rel, name, category, clip, biomes, tier, note):
        rows.append({
            'id': f'{rel}::{name}',
            'medium': 'procedural',
            'path': rel, 'file': rel, 'line': method_line(rel, name),
            'width': None, 'height': None,
            'pivot': 'code-defined',
            'category': category, 'clip': clip, 'frames': None,
            'timing': 'continuous (code-driven, no frames)',
            'usage_refs': [rel], 'dead': False,
            'biomes': biomes, 'tier': tier, 'status': 'pending', 'note': note,
        })

    # background system: sky palettes per mood, three parallax silhouette
    # bands per horizon style, foreground occluders, rain
    for mood in ('dusk', 'dawn', 'night', 'storm'):
        curated('src/background.js', 'draw', 'background_layer', f'sky:{mood}',
                ['shared'], 'P0', f'{mood} sky palette: gradient, stars, sun/moon, clouds, haze bands')
    for band in ('far', 'mid', 'near'):
        curated('src/background.js', 'drawLayer', 'background_layer', f'city:{band}',
                ['shared'], 'P0', 'city skyline silhouette band (parallax)')
        curated('src/background.js', 'drawLayer', 'background_layer', f'glades:{band}',
                ['river-of-grass'], 'P1', 'everglades silhouette band (parallax)')
    curated('src/background.js', 'foreground', 'background_layer', 'foreground-occluders',
            ['shared'], 'P1', 'near-camera parallax fringe, city + glades variants')
    curated('src/background.js', 'rain', 'vfx_frames', 'rain-overlay',
            ['skyway-mile-zero'], 'P1', 'storm rain streaks')

    # particle + post-processing vocabulary
    for name, note in (('burst', 'radial spark burst (collect, impacts, boss hits)'),
                       ('feathers', 'crow feather puffs'),
                       ('dust', 'landing dust'),
                       ('trail', 'drifting trail motes (vents, curios)')):
        curated('src/particles.js', name, 'vfx_frames', name, ['shared'], 'P1', note)
    for name, note in (('lighting', 'dynamic lightmap composite'),
                       ('bloom', 'neon bloom'),
                       ('grain', 'film grain'),
                       ('chroma', 'chromatic hit pulse'),
                       ('grade', 'per-district color grade')):
        curated('src/fx.js', name, 'vfx_frames', name, ['shared'], 'P1', note)

    # player animation clips (state machine in player.js; drawn in draw())
    for clip in ('idle', 'run', 'hop', 'flap', 'glide', 'swoop', 'roll',
                 'grind', 'hook-hang', 'wall-grip', 'flight', 'death'):
        rows.append({
            'id': f'src/player.js::clip:{clip}',
            'medium': 'procedural',
            'path': 'src/player.js', 'file': 'src/player.js', 'line': None,
            'width': None, 'height': None,
            'pivot': 'player center (x, y), h/w in code',
            'category': 'player_anim', 'clip': clip, 'frames': None,
            'timing': 'continuous (state machine, no frames)',
            'usage_refs': ['src/player.js'], 'dead': False,
            'biomes': ['all'], 'tier': 'P0', 'status': 'pending',
            'note': 'crow body/wing pose blend for this state',
        })

    # ---- 5. inline UI art (SVG in the DOM) and the type stack
    html = sources.get('index.html', '')
    svg_count = html.count('<svg')
    rows.append({
        'id': 'index.html::inline-svg-icons',
        'medium': 'svg-inline',
        'path': 'index.html', 'file': 'index.html', 'line': None,
        'width': None, 'height': None, 'pivot': 'n/a',
        'category': 'ui_icon', 'clip': None, 'frames': svg_count,
        'timing': None, 'usage_refs': ['index.html'], 'dead': False,
        'biomes': ['menu'], 'tier': 'P2', 'status': 'pending',
        'note': f'{svg_count} inline SVG glyphs (HUD shiny, mute, pause, touch pad, favicon)',
    })
    rows.append({
        'id': 'style.css::screens-and-hud',
        'medium': 'css', 'path': 'style.css', 'file': 'style.css', 'line': None,
        'width': None, 'height': None, 'pivot': 'n/a',
        'category': 'ui_panel', 'clip': None, 'frames': None, 'timing': None,
        'usage_refs': ['index.html'], 'dead': False, 'biomes': ['menu'],
        'tier': 'P2', 'status': 'pending',
        'note': 'all menus/HUD are DOM+CSS; no panel images anywhere',
    })
    rows.append({
        'id': 'font-stack',
        'medium': 'system-font', 'path': '-', 'file': None, 'line': None,
        'width': None, 'height': None, 'pivot': 'n/a',
        'category': 'font/text', 'clip': None, 'frames': None, 'timing': None,
        'usage_refs': ['style.css', 'src/level.js'], 'dead': False,
        'biomes': ['all'], 'tier': 'P2', 'status': 'pending',
        'note': '"Segoe UI", system-ui - no font files shipped',
    })

    # ---------------------------------------------------------------- outputs
    # statuses are lifecycle state owned by the pipeline, not the crawler:
    # re-crawling must never reset them
    manifest_path = os.path.join(ASSETS, 'manifest.json')
    if os.path.exists(manifest_path):
        try:
            prev = {r['id']: r.get('status', 'pending')
                    for r in json.load(open(manifest_path, encoding='utf-8')).get('rows', [])}
            for r in rows:
                if r['id'] in prev:
                    r['status'] = prev[r['id']]
        except (ValueError, KeyError):
            pass  # unreadable previous manifest: start statuses fresh
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump({'generated_by': 'tools/asset-manifest.py', 'rows': rows}, f, indent=1)

    csv_path = os.path.join(ASSETS, 'manifest.csv')
    cols = ['id', 'medium', 'category', 'tier', 'status', 'width', 'height',
            'clip', 'timing', 'biomes', 'dead', 'usage_refs', 'note']
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            w.writerow([';'.join(r[c]) if isinstance(r[c], list) else r[c] for c in cols])

    # summary
    by_medium = Counter(r['medium'] for r in rows)
    by_cat = Counter(r['category'] for r in rows)
    by_tier = Counter(r['tier'] for r in rows)
    dead = [r['id'] for r in rows if r['dead']]
    print(f'{len(rows)} asset rows -> {os.path.relpath(manifest_path, DEV)}, {os.path.relpath(csv_path, DEV)}')
    print('by medium:', dict(by_medium))
    print('by category:', dict(sorted(by_cat.items())))
    print('by tier:', dict(sorted(by_tier.items())))
    print('dead/unreferenced:', dead if dead else 'none')
    return 0


if __name__ == '__main__':
    sys.exit(main())
