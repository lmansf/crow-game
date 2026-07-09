// Central ability registry: names, colors, toast copy, and HUD icons.
// Levels reference abilities by id in `initialAbilities` and pickups.

export const ABILITIES = {
  flap: {
    name: 'WING FLAP',
    color: '#35e0e0',
    toast: 'press {JUMP} again in mid-air',
    icon: '<svg viewBox="0 0 24 24"><path d="M4 14 Q12 6 20 14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6 19 Q12 12.5 18 19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  },
  glide: {
    name: 'GLIDE',
    color: '#ffd166',
    toast: 'hold {JUMP} while falling to ride the wind',
    icon: '<svg viewBox="0 0 24 24"><path d="M5 19 Q4 8 19 4 Q18 12 9 16 Z" fill="currentColor"/><path d="M6.5 17.5 L17 5.5" stroke="#0b0614" stroke-width="1.4"/></svg>',
  },
  swoop: {
    name: 'SWOOP',
    color: '#ff4fa3',
    toast: 'press {DASH} to dart forward, even in mid-air',
    icon: '<svg viewBox="0 0 24 24"><path d="M4 6 L11 12 L4 18 Z" fill="currentColor"/><path d="M12 6 L19 12 L12 18 Z" fill="currentColor"/></svg>',
  },
  break: {
    name: 'BEAK BREAK',
    color: '#ff9d5e',
    toast: 'swoop into cracked bricks to smash through',
    icon: '<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="13" rx="1.5" fill="currentColor"/><path d="M9.5 5.5 L11.5 10.5 L8.5 13.5 L12.5 18.5" stroke="#0b0614" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>',
  },
  launch: {
    name: 'LINE LAUNCH',
    color: '#a4f26b',
    toast: 'land on a slack cable to spring skyward',
    icon: '<svg viewBox="0 0 24 24"><path d="M4 19 Q12 14 20 19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M12 15 L12 5.5 M7.5 9.5 L12 5 L16.5 9.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  soar: {
    name: 'THERMAL SOAR',
    color: '#7ec8ff',
    toast: 'hold {JUMP} inside a thermal to ride it skyward',
    icon: '<svg viewBox="0 0 24 24"><path d="M6 20 Q14 18 13 12.5 Q12.3 8.5 16 7.5 Q18.8 6.8 18.8 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4 8 Q7 5.5 10 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  },
  roll: {
    name: 'ROLL',
    color: '#e8734d',
    toast: 'press {DASH} on the ground to tumble through low gaps',
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 4.5 A7.5 7.5 0 0 1 19.5 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  },
  grip: {
    name: 'PAINT GRIP',
    color: '#63e6a4',
    toast: 'hold into a painted wall to climb it',
    icon: '<svg viewBox="0 0 24 24"><rect x="14" y="4" width="6" height="16" rx="1.5" fill="currentColor"/><path d="M10 18 L10 7 M6.5 10.5 L10 7 L13.5 10.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  hook: {
    name: 'TALON HOOK',
    color: '#d9b8ff',
    toast: 'touch a hanging hook to latch on, then {JUMP} to launch',
    icon: '<svg viewBox="0 0 24 24"><path d="M12 3 L12 12 M12 12 a4.5 4.5 0 1 0 4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  },
  grind: {
    name: 'WIRE GRIND',
    color: '#f2e963',
    toast: 'land on a glowing wire to slide it, {JUMP} to hop off',
    icon: '<svg viewBox="0 0 24 24"><path d="M3 15 Q12 19 21 13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="13.2" r="3" fill="currentColor"/><path d="M12 10.2 L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  },
  wind: {
    name: 'TAILWIND',
    color: '#8ef0ff',
    toast: 'glide inside a gust to ride the wind highway',
    icon: '<svg viewBox="0 0 24 24"><path d="M3 8 H14 a3 3 0 1 0 -3 -3 M3 13 H19 a3 3 0 1 1 -3 3 M3 18 H11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  },
  flight: {
    name: 'TRUE FLIGHT',
    color: '#ffffff',
    toast: 'hold {JUMP} in the air to climb while your wings hold out',
    icon: '<svg viewBox="0 0 24 24"><path d="M12 20 L12 9 M4 12 Q12 2 20 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6.5 16 Q12 9 17.5 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  },
  raygun: {
    name: 'RAY GUN',
    color: '#7dff6a',
    toast: 'it does nothing. except lift the curious junk nobody else can',
    icon: '<svg viewBox="0 0 24 24"><path d="M4 13 L13 13 L13 17 L9 17 M13 13 L19 7 M17.5 5.5 L20.5 8.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="9" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/></svg>',
  },
};
