// Level registry. Add a district: import its data file and append it here.

import oceanDrive from './ocean-drive.js';
import brickellAscent from './brickell-ascent.js';
import wynwoodWalls from './wynwood-walls.js';

export const LEVELS = [oceanDrive, brickellAscent, wynwoodWalls];

// Shown as locked cards on the district select screen.
// Designs for these live in Development/docs/districts-4-6.md.
export const COMING_SOON = [
  { district: 4, name: 'Little Havana Nights' },
  { district: 5, name: 'Skyway Mile Zero' },
  { district: 6, name: 'River of Grass' },
];

export function getLevelData(id) {
  return LEVELS.find((l) => l.id === id) || null;
}
