// Level registry. Add a district: import its data file and append it here.

import oceanDrive from './ocean-drive.js';
import brickellAscent from './brickell-ascent.js';
import wynwoodWalls from './wynwood-walls.js';
import littleHavana from './little-havana.js';
import skywayMileZero from './skyway-mile-zero.js';
import riverOfGrass from './river-of-grass.js';

export const LEVELS = [oceanDrive, brickellAscent, wynwoodWalls, littleHavana, skywayMileZero, riverOfGrass];

// Shown as locked cards on the district select screen.
export const COMING_SOON = [];

export function getLevelData(id) {
  return LEVELS.find((l) => l.id === id) || null;
}
