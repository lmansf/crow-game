// Level registry. Add a district: import its data file and append it here.

import oceanDrive from './ocean-drive.js';
import brickellAscent from './brickell-ascent.js';
import wynwoodWalls from './wynwood-walls.js';

export const LEVELS = [oceanDrive, brickellAscent, wynwoodWalls];

// Shown as locked cards on the district select screen.
export const COMING_SOON = [
  { district: 4, name: 'Little Havana Nights' },
];

export function getLevelData(id) {
  return LEVELS.find((l) => l.id === id) || null;
}
