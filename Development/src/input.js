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

  bindHoldButton('btn-left', () => { input.left = true; }, () => { input.left = false; });
  bindHoldButton('btn-right', () => { input.right = true; }, () => { input.right = false; });
  bindHoldButton('btn-jump', () => { input.pressJump(); }, () => { input.jumpHeld = false; });
  bindHoldButton('btn-dash', () => { input.pressDash(); }, () => {});
}

function bindHoldButton(id, onDown, onUp) {
  const el = document.getElementById(id);
  if (!el) return;
  const down = (e) => {
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('pressed');
    onDown();
  };
  const up = (e) => {
    e.preventDefault();
    el.classList.remove('pressed');
    onUp();
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
