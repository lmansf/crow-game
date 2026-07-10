// DOM layer: screens, HUD, toasts. The canvas never handles menu UI.

import { save } from './save.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { ABILITIES } from './abilities.js';
import { LEVELS } from './levels/index.js';
import { SHOP_ITEMS } from './shop.js';

// where each stop sits on the city map, in percent of the map box.
// The route snakes beach -> glades; the Rookery hangs underneath it all.
const MAP_SPOTS = {
  'ocean-drive': { x: 10, y: 70 },
  'brickell-ascent': { x: 25, y: 30 },
  'wynwood-walls': { x: 41, y: 58 },
  'little-havana': { x: 57, y: 24 },
  'skyway-mile-zero': { x: 72, y: 56 },
  'river-of-grass': { x: 89, y: 26 },
  'the-sleeping-port': { x: 81, y: 78 },
  'the-rookery': { x: 49, y: 92 },
};

const $ = (id) => document.getElementById(id);

function subGlyphs(text) {
  const touch = input.usingTouch;
  return text
    .replaceAll('{JUMP}', touch ? 'the big button' : 'SPACE')
    .replaceAll('{DASH}', touch ? 'the pink button' : 'SHIFT')
    .replaceAll('{MOVE}', touch ? 'the arrows' : 'A / D');
}

export class UI {
  constructor(game) {
    this.game = game;
    this.toastTimer = null;
    this.nextLevelId = null;

    $('btn-play').addEventListener('click', () => {
      audio.unlock();
      audio.ui();
      this.show('map');
      this.buildMap();
    });
    $('btn-map-back').addEventListener('click', () => {
      audio.ui();
      this.show('title');
    });
    $('btn-shop-close').addEventListener('click', () => {
      audio.ui();
      game.closeShop();
    });
    $('btn-story-go').addEventListener('click', () => {
      audio.unlock();
      audio.ui();
      this.show(null);
      game.launchLevel(this.pendingLevelId);
    });
    $('btn-pause').addEventListener('click', () => game.togglePause());
    $('btn-resume').addEventListener('click', () => game.togglePause());
    $('btn-restart').addEventListener('click', () => {
      audio.ui();
      game.togglePause(false);
      game.launchLevel(game.levelId);
    });
    $('btn-quit').addEventListener('click', () => {
      audio.ui();
      game.quitToMenu();
    });
    $('btn-replay').addEventListener('click', () => {
      audio.ui();
      this.show(null);
      game.launchLevel(game.levelId);
    });
    $('btn-next').addEventListener('click', () => {
      if (!this.nextLevelId) return;
      audio.ui();
      const next = LEVELS.find((l) => l.id === this.nextLevelId);
      this.pendingLevelId = next.id;
      this.showStory(next.intro);
    });
    $('btn-menu').addEventListener('click', () => {
      audio.ui();
      game.quitToMenu();
    });
    $('btn-mute').addEventListener('click', () => {
      audio.unlock();
      const muted = audio.toggleMute();
      $('btn-mute').classList.toggle('muted', muted);
    });
    $('btn-mute').classList.toggle('muted', save.muted);

    input.onMute = () => $('btn-mute').click();
  }

  show(name) {
    for (const s of ['title', 'map', 'story', 'pause', 'complete', 'shop']) {
      $(`screen-${s}`).classList.toggle('hidden', s !== name);
    }
    const inGame = name === null || name === 'pause';
    $('hud').classList.toggle('hidden', !inGame);
    document.body.classList.toggle('playing', name === null);
    this.updateRotateHint();
  }

  // The city as one map: a route snaking through the six districts with the
  // Rookery hanging beneath. Places you have not visited (and hold no
  // fragment for) stay uncharted silhouettes.
  buildMap() {
    $('map-wallet').textContent = `✦ ${save.wallet} shinies`;
    const wrap = $('city-map');
    wrap.innerHTML = '';

    const spots = LEVELS.filter((l) => MAP_SPOTS[l.id]);
    const revealed = (l) => l.id === 'ocean-drive' ||
      !!(save.getFlag(`seen:${l.id}`) || save.getFlag(`frag:${l.id}`) || save.getLevel(l.id)?.completed);

    const districts = spots.filter((l) => !l.hub).sort((a, b) => a.district - b.district);
    const hub = spots.find((l) => l.hub);
    // the walking route only threads districts a hallway actually reaches;
    // flyway-only places (the port) hang off the Rookery alone
    const walked = districts.filter((l) => !l.flyOnly);
    let svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">';
    for (let i = 0; i < walked.length - 1; i++) {
      const a = MAP_SPOTS[walked[i].id];
      const b = MAP_SPOTS[walked[i + 1].id];
      const on = revealed(walked[i]) && revealed(walked[i + 1]);
      svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="route${on ? ' on' : ''}"/>`;
    }
    for (const d of districts) {
      const a = MAP_SPOTS[hub.id];
      const b = MAP_SPOTS[d.id];
      const open = revealed(hub) && (d.id === 'ocean-drive' || save.getFlag(`frag:${d.id}`));
      svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="flyway${open ? ' on' : ''}"/>`;
    }
    svg += '</svg>';
    wrap.insertAdjacentHTML('beforeend', svg);

    for (const lvl of spots) {
      const spot = MAP_SPOTS[lvl.id];
      const known = revealed(lvl);
      const stats = save.getLevel(lvl.id);
      const node = document.createElement('button');
      node.className = `map-node${lvl.hub ? ' hub' : ''}${known ? '' : ' unknown'}`;
      node.style.left = spot.x + '%';
      node.style.top = spot.y + '%';
      const hasCard = known && !lvl.hub && lvl.district <= 6;
      const art = hasCard ? ` style="background-image:url('assets/card-${lvl.district}.jpg')"` : '';
      const meta = lvl.hub
        ? (known ? 'flyway gates · the Magpie' : 'rumors of a market under the city')
        : !known ? 'fragment sold at the Rookery'
        : stats ? `${stats.bestShinies}/${stats.shinyTotal} shinies · best ${fmtTime(stats.bestTimeMs)}`
        : lvl.blurb;
      node.innerHTML = `
        <span class="dot"${art}>${lvl.hub ? '✦' : !known ? '?' : lvl.flyOnly ? '⚓' : ''}</span>
        <span class="label">${known ? lvl.name : 'UNCHARTED'}</span>
        <span class="meta">${meta}</span>`;
      if (known) {
        node.addEventListener('click', () => {
          audio.ui();
          this.pendingLevelId = lvl.id;
          this.showStory(lvl.intro);
        });
      } else {
        node.disabled = true;
      }
      wrap.appendChild(node);
    }
  }

  // The Magpie's stall: map fragments for shinies. Buying re-renders in
  // place; gates in the Rookery unlock the moment the flag lands.
  showShop() {
    $('shop-wallet').textContent = `✦ ${save.wallet} shinies`;
    const wrap = $('shop-items');
    wrap.innerHTML = '';
    for (const item of SHOP_ITEMS) {
      const owned = !!save.getFlag(item.flag);
      const row = document.createElement('button');
      row.className = `shop-item${owned ? ' owned' : ''}`;
      row.innerHTML = `
        <span class="what"><b>${item.name}</b><span>${item.desc}</span></span>
        <span class="price">${owned ? 'YOURS' : `✦ ${item.price}`}</span>`;
      if (owned) {
        row.disabled = true;
      } else {
        row.addEventListener('click', () => {
          if (!save.spend(item.price)) {
            audio.zap();
            row.classList.remove('nope');
            void row.offsetWidth; // restart the shake
            row.classList.add('nope');
            return;
          }
          save.setFlag(item.flag);
          audio.power();
          this.showShop();
        });
      }
      wrap.appendChild(row);
    }
    this.show('shop');
  }

  showStory(lines) {
    $('story-text').innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
    this.show('story');
  }

  showComplete(levelData, shinies, total, timeMs, stats) {
    $('complete-heading').textContent = levelData.completeHeading || levelData.goal.text || 'THE ROOST';
    $('complete-story').innerHTML = levelData.outro.map((l) => `<p>${l}</p>`).join('');
    $('complete-stats').innerHTML = `
      <div class="stat"><b>${shinies}/${total}</b><span>shinies</span>
        <span class="best">best ${stats.bestShinies}/${total}</span></div>
      <div class="stat"><b>${fmtTime(timeMs)}</b><span>time</span>
        <span class="best">best ${fmtTime(stats.bestTimeMs)}</span></div>`;

    const idx = LEVELS.findIndex((l) => l.id === levelData.id);
    let next = LEVELS[idx + 1];
    if (next && next.hidden) next = null; // easter eggs are not on the itinerary
    const btn = $('btn-next');
    if (next) {
      this.nextLevelId = next.id;
      btn.disabled = false;
      btn.textContent = `NEXT: ${next.name.toUpperCase()}`;
    } else {
      this.nextLevelId = null;
      btn.disabled = true;
      btn.textContent = 'HOME AT LAST';
    }
    this.show('complete');
  }

  showPause() {
    $('pause-controls').textContent = input.usingTouch
      ? 'arrows move, big button hops and glides, pink button swoops'
      : 'A/D move, SPACE hop and glide, SHIFT swoop, ESC pause, M mute';
    this.show('pause');
  }

  setShinies(n, total) {
    $('shiny-count').textContent = n;
    $('shiny-total').textContent = `/${total}`;
  }

  setTimer(seconds) {
    $('hud-timer').textContent = fmtTime(seconds * 1000);
  }

  // Build one HUD slot per ability this level uses, in unlock order.
  buildAbilitySlots(abilityIds, owned) {
    const wrap = $('ability-slots');
    wrap.innerHTML = '';
    for (const id of abilityIds) {
      const info = ABILITIES[id];
      if (!info) continue;
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.id = `slot-${id}`;
      slot.title = info.name;
      slot.innerHTML = info.icon;
      wrap.appendChild(slot);
      if (owned[id]) this.lightSlot(slot, info.color);
    }
    const btn = $('btn-dash');
    btn.classList.toggle('locked', !owned.swoop);
    btn.classList.remove('unlock-pulse');
  }

  lightSlot(slot, color) {
    slot.classList.add('on');
    slot.style.color = color;
    slot.style.borderColor = color + '99';
    slot.style.boxShadow = `0 0 10px ${color}59`;
  }

  setAbility(ability) {
    const slot = $(`slot-${ability}`);
    if (slot) this.lightSlot(slot, ABILITIES[ability].color);
    if (ability === 'swoop') {
      const btn = $('btn-dash');
      btn.classList.remove('locked');
      btn.classList.add('unlock-pulse');
    }
  }

  toast(title, sub, ms = 3200) {
    const el = $('toast');
    $('toast-title').textContent = subGlyphs(title);
    $('toast-sub').textContent = subGlyphs(sub);
    el.classList.remove('hidden', 'fade');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => el.classList.add('hidden'), 420);
    }, ms);
  }

  abilityToast(ability) {
    const info = ABILITIES[ability];
    this.toast(`${info.name} UNLOCKED`, info.toast, 4200);
  }

  updateRotateHint() {
    const portrait = innerHeight > innerWidth * 1.15;
    const show = portrait && input.usingTouch && document.body.classList.contains('playing');
    $('rotate-hint').classList.toggle('hidden', !show);
  }
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
