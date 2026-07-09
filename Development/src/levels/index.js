// Level registry. Add a district: import its data file and append it here.
// The LEVELS order is the world order: district, hallway, district...
// so the complete screen's NEXT button walks the whole mega map.

import oceanDrive from './ocean-drive.js';
import brickellAscent from './brickell-ascent.js';
import wynwoodWalls from './wynwood-walls.js';
import littleHavana from './little-havana.js';
import skywayMileZero from './skyway-mile-zero.js';
import riverOfGrass from './river-of-grass.js';
import { hallDrain, hallGlideway, hallUnderpass, hallToll, hallCauseway } from './hallways.js';

export const LEVELS = [
  oceanDrive,
  hallDrain,
  brickellAscent,
  hallGlideway,
  wynwoodWalls,
  hallUnderpass,
  littleHavana,
  hallToll,
  skywayMileZero,
  hallCauseway,
  riverOfGrass,
];

// Shown as locked cards on the district select screen.
export const COMING_SOON = [];

export function getLevelData(id) {
  return LEVELS.find((l) => l.id === id) || null;
}
