// Unified keyboard + touch input.
// Gameplay reads intent (left/right/jumpHeld) plus short buffers for
// press events so jumps feel responsive on mobile.

const JUMP_BUFFER = 0.13;
const DASH_BUFFER = 0.16;

export const input = {
  left: false,
  right: false,
  jumpHeld: false,
  jumpBuf: 0,
  dashBuf: 0,
  usingTouch: false,
  locked: false,       // set during outros and death
  onPause: null,       // callback wired by main
  onMute: null,
  onAny: null,         // first-gesture hook (audio unlock)

  update(dt) {
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    if (this.dashBuf > 0) this.dashBuf -= dt;
  },

  pressJump() {
    this.jumpBuf = JUMP_BUFFER;
    this.jumpHeld = true;
  },

  pressDash() {
    this.dashBuf = DASH_BUFFER;
  },

  consumeJump() {
    if (this.jumpBuf > 0 && !this.locked) {
      this.jumpBuf = 0;
      return true;
    }
    return false;
  },

  consumeDash() {
    if (this.dashBuf > 0 && !this.locked) {
      this.dashBuf = 0;
      return true;
    }
    return false;
  },

  get moveX() {
    if (this.locked) return 0;
    return (this.right ? 1 : 0) - (this.left ? 1 : 0);
  },

  get holdingJump() {
    return this.jumpHeld && !this.locked;
  },

  clear() {
    this.left = this.right = this.jumpHeld = false;
    this.jumpBuf = this.dashBuf = 0;
  },
};

const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW', 'KeyZ'];
const DASH_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ', 'KeyK'];

export function initInput() {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.onAny?.();
    if (LEFT_KEYS.includes(e.code)) input.left = true;
    else if (RIGHT_KEYS.includes(e.code)) input.right = true;
    else if (JUMP_KEYS.includes(e.code)) { input.pressJump(); e.preventDefault(); }
    else if (DASH_KEYS.includes(e.code)) input.pressDash();
    else if (e.code === 'Escape' || e.code === 'KeyP') input.onPause?.();
    else if (e.code === 'KeyM') input.onMute?.();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });

  addEventListener('keyup', (e) => {
    if (LEFT_KEYS.includes(e.code)) input.left = false;
    else if (RIGHT_KEYS.includes(e.code)) input.right = false;
    else if (JUMP_KEYS.includes(e.code)) input.jumpHeld = false;
  });

  // Reveal touch controls the moment a finger touches the screen.
  addEventListener('pointerdown', (e) => {
    input.onAny?.();
    if (e.pointerType === 'touch' && !input.usingTouch) {
      input.usingTouch = true;
      document.body.classList.add('touch-mode');
      document.getElementById('touch-controls')?.classList.remove('hidden');
    }
  }, { capture: true });

  bindPad('.pad-left', {
    'btn-left': { down: () => { input.left = true; }, up: () => { input.left = false; } },
    'btn-right': { down: () => { input.right = true; }, up: () => { input.right = false; } },
  });
  bindPad('.pad-right', {
    'btn-dash': { down: () => { input.pressDash(); }, up: () => {} },
    'btn-jump': { down: () => { input.pressJump(); }, up: () => { input.jumpHeld = false; } },
  });
}

// Each pad routes its own pointers so thumbs are forgiven everything:
// a touch anywhere near a button snaps to the nearest one, sliding
// between buttons switches the hold without lifting, and drifting off
// a held button keeps it held until the finger lifts.
const GRAB_RANGE = 44;    // how far outside a button a fresh tap still lands
const SWITCH_RANGE = 16;  // how close to a neighbor a slide must get to switch

function distToRect(x, y, r) {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

function bindPad(sel, actions) {
  const pad = document.querySelector(sel);
  if (!pad) return;
  const btns = Object.keys(actions)
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const owner = new Map();  // pointerId -> button element
  const holds = new Map();  // button element -> Set of pointerIds

  const pick = (x, y, limit) => {
    let best = null;
    let bestD = Infinity;
    for (const el of btns) {
      if (el.classList.contains('locked')) continue;
      const d = distToRect(x, y, el.getBoundingClientRect());
      if (d < bestD) { bestD = d; best = el; }
    }
    return bestD <= limit ? best : null;
  };

  const press = (id, el) => {
    owner.set(id, el);
    let set = holds.get(el);
    if (!set) { set = new Set(); holds.set(el, set); }
    set.add(id);
    if (set.size === 1) {
      el.classList.add('pressed');
      actions[el.id].down();
    }
  };

  const release = (id) => {
    const el = owner.get(id);
    if (!el) return;
    owner.delete(id);
    const set = holds.get(el);
    set?.delete(id);
    if (!set || set.size === 0) {
      el.classList.remove('pressed');
      actions[el.id].up();
    }
  };

  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { pad.setPointerCapture?.(e.pointerId); } catch { /* capture is a nicety, never a requirement */ }
    const el = pick(e.clientX, e.clientY, GRAB_RANGE);
    if (el) press(e.pointerId, el);
  });

  pad.addEventListener('pointermove', (e) => {
    if (!owner.has(e.pointerId)) return;
    e.preventDefault();
    const el = pick(e.clientX, e.clientY, SWITCH_RANGE);
    if (el && el !== owner.get(e.pointerId)) {
      release(e.pointerId);
      press(e.pointerId, el);
    }
  });

  const lift = (e) => {
    e.preventDefault();
    release(e.pointerId);
  };
  pad.addEventListener('pointerup', lift);
  pad.addEventListener('pointercancel', lift);
  // if capture is torn away without an up/cancel, never leave a hold stuck
  // (release() is a no-op for pointers already lifted)
  pad.addEventListener('lostpointercapture', lift);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
}
