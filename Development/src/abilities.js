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
};
