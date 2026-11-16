// Доступ к описаниям врагов (public/data/enemies.json) с проверками.
// Характеристики хранятся в данных, поведение — в ai/EnemyAI.js.

import { GD } from './GameData.js';

export const ROLES = ['melee', 'ranged', 'heavy', 'swarm', 'exploder', 'summoner', 'defender', 'support', 'teleport', 'ambush'];

export const EnemyDatabase = {
  get(id) {
    const d = GD.enemies[id];
    if (!d) throw new Error(`EnemyDatabase: неизвестный враг «${id}»`);
    return d;
  },
  has(id) { return !!GD.enemies[id] && !id.startsWith('_'); },
  all() { return Object.entries(GD.enemies).filter(([k]) => !k.startsWith('_')).map(([id, d]) => ({ id, ...d })); },
  /** Обычные враги (без мини-боссов и особых), сгруппированные по главам. */
  byChapter(ch) { return this.all().filter((e) => e.chapter === ch && !e.miniboss); },
  role(id) { return GD.enemies[id]?.role || 'melee'; },

  /** Проверка, что у каждого врага есть текстура и известное поведение. */
  validate(scene, behaviors) {
    const problems = [];
    for (const e of this.all()) {
      if (scene && !scene.textures.exists(e.texture)) problems.push(`${e.id}: нет текстуры ${e.texture}`);
      if (behaviors && !behaviors[e.behavior]) problems.push(`${e.id}: нет поведения ${e.behavior}`);
      if (e.params?.then && behaviors && !behaviors[e.params.then]) problems.push(`${e.id}: нет поведения ${e.params.then}`);
      if (e.splitInto && !GD.enemies[e.splitInto.id]) problems.push(`${e.id}: splitInto ${e.splitInto.id}`);
      if (e.params?.summon && !GD.enemies[e.params.summon]) problems.push(`${e.id}: summon ${e.params.summon}`);
    }
    return problems;
  }
};
