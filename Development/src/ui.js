// DOM layer: screens, HUD, toasts. The canvas never handles menu UI.

import { save } from './save.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { ABILITIES } from './abilities.js';
import { LEVELS, COMING_SOON } from './levels/index.js';

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
      this.show('levels');
      this.buildLevelCards();
    });
    $('btn-levels-back').addEventListener('click', () => {
      audio.ui();
      this.show('title');
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
    for (const s of ['title', 'levels', 'story', 'pause', 'complete']) {
      $(`screen-${s}`).classList.toggle('hidden', s !== name);
    }
    const inGame = name === null || name === 'pause';
    $('hud').classList.toggle('hidden', !inGame);
    document.body.classList.toggle('playing', name === null);
    this.updateRotateHint();
  }

  buildLevelCards() {
    const wrap = $('level-cards');
    wrap.innerHTML = '';
    for (const lvl of LEVELS) {
      const stats = save.getLevel(lvl.id);
      const card = document.createElement('button');
      card.className = 'level-card';
      card.innerHTML = `
        <div class="num">DISTRICT ${lvl.district}</div>
        <div class="name">${lvl.name}</div>
        <div class="meta">${stats
          ? `<span class="done">found</span> ${stats.bestShinies}/${stats.shinyTotal} shinies<br>best ${fmtTime(stats.bestTimeMs)}`
          : lvl.blurb}</div>`;
      card.addEventListener('click', () => {
        audio.ui();
        this.pendingLevelId = lvl.id;
        this.showStory(lvl.intro);
      });
      wrap.appendChild(card);
    }
    for (const cs of COMING_SOON) {
      const card = document.createElement('div');
      card.className = 'level-card locked';
      card.innerHTML = `
        <div class="num">DISTRICT ${cs.district}</div>
        <div class="name">${cs.name}</div>
        <div class="meta">coming soon</div>`;
      wrap.appendChild(card);
    }
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
    const next = LEVELS[idx + 1];
    const btn = $('btn-next');
    if (next) {
      this.nextLevelId = next.id;
      btn.disabled = false;
      btn.textContent = `NEXT: ${next.name.toUpperCase()}`;
    } else {
      this.nextLevelId = null;
      btn.disabled = true;
      btn.textContent = `DISTRICT ${levelData.district + 1} - COMING SOON`;
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
