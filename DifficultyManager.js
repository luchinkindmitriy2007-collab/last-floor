// Сложность: масштабирование характеристик, шанс элиты, бюджет волн и
// сборка волн из ролей (не просто «больше здоровья», а другие комбинации).
//
// Главы 1: знакомство (рои, ближний бой); 2: новые атаки (огонь, взрывы, призыв);
// 3: взаимодействие (щитоносцы прикрывают стрелков, стаи); 4: больше элиты и
// опасных комнат; 5: сложные комбинации (поддержка + телепорты); 6: максимум.

export class DifficultyManager {
  constructor(chaptersData, enemies, floorDb) {
    this.C = chaptersData;
    this.D = chaptersData.difficulty;
    this.E = enemies;
    this.fdb = floorDb;
  }

  scaling(floor) {
    const D = this.D;
    let hp = 1 + D.hpPerFloor * (floor - 1);
    let dmg = 1 + D.dmgPerFloor * (floor - 1);
    if (floor > 30) { const x = floor - 30; hp += this.C.endless.hpPerFloor * x; dmg += this.C.endless.dmgPerFloor * x; }
    return { hp, dmg };
  }

  eliteChance(floor) { return Math.min(this.D.eliteMax, this.D.eliteBase + this.D.elitePerFloor * (floor - 1)); }

  budget(floor, depth = 2) {
    const D = this.D;
    const ci = this.fdb.chapterIndex(floor);
    const base = D.budgetBase + D.budgetPerFloor * Math.min(floor - 1, 29) + D.budgetPerChapter * ci;
    return Math.round(base * (0.75 + Math.min(depth, 5) * 0.07));
  }

  /** Пул врагов этажа: враги главы (с учётом from) + немного прошлой главы. */
  pool(floor) {
    const ci = this.fdb.chapterIndex(floor);
    const ch = this.C.chapters[ci];
    const sub = this.fdb.sub(floor);
    const own = ch.enemyPool.filter((p) => (p.from || 1) <= sub && this.E[p.id]);
    const mix = ch.mix || 0;
    let prev = [];
    if (ci > 0 && mix > 0) {
      const pc = this.C.chapters[ci - 1];
      const total = own.reduce((s, p) => s + p.w, 0);
      const pw = pc.enemyPool.filter((p) => this.E[p.id]);
      const ptotal = pw.reduce((s, p) => s + p.w, 0) || 1;
      prev = pw.map((p) => ({ id: p.id, w: (p.w / ptotal) * total * mix }));
    }
    return [...own, ...prev];
  }

  /** Волна врагов под бюджет с ограничениями по ролям. */
  buildWave(rng, floor, budget, extraElite = 0) {
    const ci = this.fdb.chapterIndex(floor);
    const caps = this.D.maxPerWave;
    const pool = this.pool(floor);
    const elite = this.eliteChance(floor) + extraElite;
    const wave = []; const roles = {};
    let b = budget; let guard = 0;
    const capOf = (role) => {
      if (role === 'support') return caps.support[ci];
      if (role === 'summoner') return caps.summoner[ci];
      if (role === 'ranged' || role === 'teleport') return caps.ranged[ci];
      return 99;
    };
    const add = (id) => {
      const role = this.E[id].role || 'melee';
      wave.push({ id, elite: rng.chance(elite) });
      roles[role] = (roles[role] || 0) + 1;
      b -= this.E[id].cost || 1;
    };
    while (b > 0 && guard++ < 60) {
      const opts = pool.filter((p) => {
        const e = this.E[p.id];
        const role = e.role || 'melee';
        if ((e.cost || 1) > b) return false;
        if ((roles[role] || 0) >= capOf(role)) return false;
        // поддержке и призывателям нужен кто-то впереди
        if ((role === 'support' || role === 'summoner') && wave.length === 0) return false;
        return true;
      });
      if (!opts.length) break;
      const p = rng.weighted(opts);
      add(p.id);
      // с 3-й главы защитник приводит с собой стрелка, которого прикрывает
      if (ci >= 2 && this.E[p.id].role === 'defender' && b > 0) {
        const ranged = pool.filter((q) => ['ranged', 'summoner'].includes(this.E[q.id].role) && (this.E[q.id].cost || 1) <= b);
        if (ranged.length) add(rng.weighted(ranged).id);
      }
    }
    if (!wave.length && pool.length) add(pool[0].id);
    return wave;
  }
}
