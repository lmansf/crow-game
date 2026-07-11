// Persistent progress and settings via localStorage.
// Everything degrades gracefully if storage is unavailable.

const KEY = 'crow-game-save-v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

let data = load();
data.levels = data.levels || {};
data.settings = data.settings || { muted: false };
data.flags = data.flags || {};
// the shiny wallet: spendable at the Rookery. Saves from before the
// wallet existed get credited for the shinies they already found.
if (typeof data.wallet !== 'number') {
  data.wallet = Object.values(data.levels).reduce((n, l) => n + (l.bestShinies || 0), 0);
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // private browsing or storage full: play session still works
  }
}

export const save = {
  getLevel(id) {
    return data.levels[id] || null;
  },

  // completion without run stats: the one-world map finishes districts
  // inline, where a whole-world time or shiny count would pollute the bests
  markCompleted(id) {
    const prev = data.levels[id] || {};
    if (prev.completed) return;
    data.levels[id] = { ...prev, completed: true };
    persist();
  },

  recordRun(id, shinies, shinyTotal, timeMs) {
    const prev = data.levels[id] || {};
    data.levels[id] = {
      completed: true,
      bestShinies: Math.max(prev.bestShinies || 0, shinies),
      shinyTotal,
      bestTimeMs: prev.bestTimeMs ? Math.min(prev.bestTimeMs, timeMs) : timeMs,
    };
    persist();
  },

  get wallet() {
    return data.wallet;
  },

  addWallet(n) {
    data.wallet += n;
    persist();
  },

  // spend from the wallet; returns false (and charges nothing) if short
  spend(n) {
    if (data.wallet < n) return false;
    data.wallet -= n;
    persist();
    return true;
  },

  // free-form progress flags (easter eggs, curio pickups, ...)
  getFlag(key) {
    return data.flags[key];
  },

  setFlag(key, value = true) {
    data.flags[key] = value;
    persist();
  },

  get muted() {
    return !!data.settings.muted;
  },

  set muted(v) {
    data.settings.muted = !!v;
    persist();
  },
};
