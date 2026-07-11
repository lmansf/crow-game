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
import theSleepingPort from './the-sleeping-port.js';
import ufo from './ufo.js';
import rookery from './rookery.js';
import { miami } from './world.js';

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
  theSleepingPort, // the epilogue: no hallway reaches it, only the flyway
  ufo, // hidden: reachable only through the green light
  rookery, // the hub under everything, off the linear itinerary
];

export function getLevelData(id) {
  if (id === 'miami') return miami; // the composed one-world map
  return LEVELS.find((l) => l.id === id) || null;
}
