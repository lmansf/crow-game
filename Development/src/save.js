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
