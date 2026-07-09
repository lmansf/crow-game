// Level registry. Add a district: import its data file and append it here.

import oceanDrive from './ocean-drive.js';
import brickellAscent from './brickell-ascent.js';

export const LEVELS = [oceanDrive, brickellAscent];

// Shown as locked cards on the district select screen.
export const COMING_SOON = [
  { district: 3, name: 'Wynwood Walls' },
  { district: 4, name: 'Little Havana Nights' },
];

export function getLevelData(id) {
  return LEVELS.find((l) => l.id === id) || null;
}
