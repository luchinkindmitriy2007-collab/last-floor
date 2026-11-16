// Биомы: палитра тайлов, освещение, музыка, декор, опасные зоны, арена босса.
import { GD } from './GameData.js';

export const BiomeManager = {
  get(id) { return GD.biomes[id] || GD.biomes.ruins; },
  forFloor(floorDb, floor) { return this.get(floorDb.chapter(floor).biome); },
  tilesetKey(biome) { return `tiles_${biome.id}`; },
  torchKey(biome) { return `torch_${biome.id}`; },
  music(biome) { return biome.music || 'ruins'; },
  arenaTemplate(biome) { return biome.arena || 'arena'; },
  decor(biome) { return biome.decor || ['bones', 'skull', 'rubble']; }
};
