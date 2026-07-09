// Test-drive harness for the debug build (load the game with ?debug=1,
// then `await import('/tools/harness.js')` from the console).
// Exposes window.T: frame-stepped inputs for scripted playthroughs in
// hidden tabs, where requestAnimationFrame never fires.

const cg = window.__cg;
const I = cg.input;

const T = {
  P: () => cg.player,
  st(n = 1) {
    cg.game.paused = false;
    cg.step(1 / 120, n);
  },
  hold(d) { I.left = d < 0; I.right = d > 0; },
  up() { I.left = I.right = false; I.jumpHeld = false; },
  jump() { I.pressJump(); },
  dash() { I.pressDash(); },

  snap(tag) {
    const p = cg.player;
    return `${tag}: x=${p.x | 0} y=${p.y | 0} g=${p.grounded ? 1 : 0} rail=${p.grindRail ? 1 : 0} hook=${p.hooked ? 1 : 0} dead=${p.dead > 0 ? 1 : 0}`;
  },

  walkTo(x, frames = 1600) {
    for (let i = 0; i < frames; i++) {
      const d = x - cg.player.x;
      if (Math.abs(d) < 10) { this.up(); this.st(4); return `ok@${cg.player.x | 0},${cg.player.y | 0}`; }
      this.hold(Math.sign(d));
      this.st(1);
      if (cg.player.dead > 0) { this.up(); return `died@${cg.player.x | 0}`; }
    }
    this.up();
    return `timeout@${cg.player.x | 0},${cg.player.y | 0}`;
  },

  // run + jump toward dir; flap at the apex; optionally glide after.
  // Jump stays held through the flap so the hop is never jump-cut.
  hopFlap(dir, flapDelay = 'apex', frames = 320, glide = true) {
    this.hold(dir);
    this.st(6);
    this.jump();
    let flapped = false;
    for (let i = 0; i < frames; i++) {
      this.st(1);
      const p = cg.player;
      if (p.hooked || p.grindRail) { I.jumpBuf = 0; this.up(); this.st(2); return `latched@${p.x | 0},${p.y | 0}${p.hooked ? ' HOOK' : ' RAIL'}`; }
      if (!flapped && (flapDelay === 'apex' ? (i > 6 && p.vy > -140) : i === flapDelay)) {
        this.jump();
        flapped = true;
      }
      if (flapped && !glide && p.vy > 40) I.jumpHeld = false;
      if (i > 10 && p.grounded) { this.up(); return `landed@${p.x | 0},${p.y | 0}`; }
      if (p.dead > 0) { this.up(); return 'died'; }
    }
    this.up();
    return `air@${cg.player.x | 0},${cg.player.y | 0}`;
  },

  // launch off a hook toward dir; flap at the apex; counterDir steers
  // back against the launch once it has cleared (0 = keep drifting)
  hookLaunch(dir, counterDir = 0, counterAfter = 18, frames = 360) {
    const p = cg.player;
    if (!p.hooked) return 'not-hooked';
    this.hold(dir);
    this.jump();
    this.st(3);
    let flapped = false;
    for (let i = 0; i < frames; i++) {
      this.st(1);
      if (counterDir && i === counterAfter) this.hold(counterDir);
      if (!flapped && i > 6 && p.vy > -140) { this.jump(); flapped = true; }
      if (p.hooked) { I.jumpBuf = 0; this.up(); this.st(2); return `latched@${p.x | 0},${p.y | 0}`; }
      if (p.grindRail) { I.jumpBuf = 0; this.up(); return `rail@${p.x | 0},${p.y | 0}`; }
      if (i > 12 && (p.grounded || p.groundPlat)) { this.up(); return `landed@${p.x | 0},${p.y | 0}${p.groundPlat ? ' PLAT' : ''}`; }
      if (p.dead > 0) { this.up(); return `died@${p.x | 0}`; }
    }
    this.up();
    return `air@${p.x | 0},${p.y | 0}`;
  },

  // ride the current rail, hop near its far end, resolve on next contact
  grindRide(frames = 1200, hopAtU = 0.93, flapDelayAfterHop = 26) {
    const p = cg.player;
    if (!p.grindRail) return 'no-rail';
    const startRail = p.grindRail;
    let hopped = false;
    let flapped = false;
    let hopFrame = 0;
    for (let i = 0; i < frames; i++) {
      if (p.grindRail === startRail && !hopped) {
        const u = p.grindPos / startRail.len;
        if ((p.grindDir > 0 && u > hopAtU) || (p.grindDir < 0 && u < 1 - hopAtU)) {
          this.jump();
          hopped = true;
          hopFrame = i;
          this.hold(p.facing);
        }
      }
      this.st(1);
      if (hopped && !flapped && i === hopFrame + flapDelayAfterHop) { this.jump(); flapped = true; }
      if (hopped && i > hopFrame + 8) {
        if (p.grindRail && p.grindRail !== startRail) { I.jumpBuf = 0; this.up(); return `rail@${p.x | 0},${p.y | 0}`; }
        if (p.hooked) { I.jumpBuf = 0; this.up(); this.st(2); return `hook@${p.x | 0},${p.y | 0}`; }
        if (p.grounded || p.groundPlat) { this.up(); return `ground@${p.x | 0},${p.y | 0}`; }
      }
      if (p.dead > 0) { this.up(); return `died@${p.x | 0}`; }
    }
    this.up();
    return `timeout@${p.x | 0},${p.y | 0} rail=${!!p.grindRail}`;
  },

  // wait until the timed hazard nearest hx has just finished biting,
  // which is the widest safe window regardless of hazard type
  waitSafe(hx) {
    let h = null;
    for (const c of cg.level.timedHazards) {
      if (!h || Math.abs(c.x - hx) < Math.abs(h.x - hx)) h = c;
    }
    let sawDeadly = false;
    for (let i = 0; i < 2000; i++) {
      this.st(1);
      const st = h._st;
      if (!st) continue;
      if (st.deadly) sawDeadly = true;
      else if (sawDeadly) return 'safe';
    }
    return 'never-safe';
  },

  teleport(x, y) {
    const p = cg.player;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.dead = 0;
  },
};

window.T = T;
export default T;
