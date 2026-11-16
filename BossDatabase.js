// Боссы и мини-боссы (public/data/bosses.json).
import { GD } from './GameData.js';

export const BossDatabase = {
  get(id) {
    const d = GD.bosses[id];
    if (!d) throw new Error(`BossDatabase: неизвестный босс «${id}»`);
    return d;
  },
  has(id) { return !!GD.bosses[id] && !id.startsWith('_'); },
  all() { return Object.entries(GD.bosses).filter(([k]) => !k.startsWith('_')).map(([id, d]) => ({ id, ...d })); },
  majors() { return this.all().filter((b) => !b.minor); },
  minors() { return this.all().filter((b) => b.minor); },
  /** Мини-босс может быть врагом (golem_warden) или боссом с minor: true. */
  isMinibossId(id) { return (GD.bosses[id] && GD.bosses[id].minor) || (GD.enemies[id] && GD.enemies[id].miniboss); },
  name(id) { return (GD.bosses[id] || GD.enemies[id])?.name || id; },

  validate(scene, library) {
    const problems = [];
    for (const b of this.all()) {
      if (scene && !scene.textures.exists(b.texture)) problems.push(`${b.id}: нет текстуры ${b.texture}`);
      for (const [name, a] of Object.entries(b.attacks)) {
        if (!library[a.type]) problems.push(`${b.id}.${name}: нет типа атаки ${a.type}`);
        if (a.enemy && !GD.enemies[a.enemy]) problems.push(`${b.id}.${name}: нет врага ${a.enemy}`);
        if (a.then && !b.attacks[a.then]) problems.push(`${b.id}.${name}: нет атаки ${a.then}`);
      }
      for (const p of b.phases) for (const a of p.attacks) if (!b.attacks[a]) problems.push(`${b.id}: фаза ссылается на ${a}`);
    }
    return problems;
  }
};
