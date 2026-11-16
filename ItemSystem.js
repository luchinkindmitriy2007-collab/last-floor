// Предметы: расчёт характеристик, синергии/сеты, триггеры эффектов,
// выбор наград с учётом редкости и удачи.

import { RARITIES, RARITY } from './Constants.js';

const ADDITIVE = ['maxHp', 'maxHpPct', 'damage', 'atkSpeed', 'moveSpeed', 'crit', 'critMult', 'armor', 'pierce', 'extraProj', 'area', 'cdr', 'gold', 'luck', 'damagePerSpeed', 'damagePerGold', 'homing', 'reveal'];

export class ItemSystem {
  constructor(data) {
    this.items = data.items; // id → item
    this.sets = data.sets;
    this.curses = Object.fromEntries((data.curses || []).map((c) => [c.id, c]));
    this.upgrades = data.upgrades;
    this.prices = data.prices;
  }

  get(id) { return this.items[id]; }

  activeSets(run) {
    const counts = {};
    for (const id of run.items) { const s = this.items[id]?.set; if (s) counts[s] = (counts[s] || 0) + 1; }
    return Object.entries(counts).filter(([s, n]) => this.sets[s] && n >= this.sets[s].need).map(([s]) => s);
  }

  /** Сумма модификаторов из предметов, улучшений, проклятий, событий. */
  modifiers(run) {
    const m = Object.fromEntries(ADDITIVE.map((k) => [k, 0]));
    const addAll = (stats) => { if (stats) for (const [k, v] of Object.entries(stats)) m[k] = (m[k] || 0) + v; };
    for (const id of run.items) addAll(this.items[id]?.stats);
    for (const s of this.activeSets(run)) addAll(this.sets[s].stats);
    for (const u of run.upgrades) addAll(this.upgrades[u]?.stats);
    for (const c of run.curses) addAll(this.curses[c]?.stats);
    addAll(run.bonusStats);
    return m;
  }

  /** Итоговые характеристики героя для класса. */
  computeStats(run, cls) {
    const b = cls.stats;
    const m = this.modifiers(run);
    const moveMult = Math.max(0.5, 1 + m.moveSpeed);
    return {
      maxHp: Math.max(10, Math.round((b.maxHp + m.maxHp) * Math.max(0.3, 1 + m.maxHpPct))),
      damageBase: b.damage,
      damageMult: 1 + m.damage + Math.max(0, moveMult - 1) * 10 * m.damagePerSpeed,
      damagePerGold: m.damagePerGold,
      attackCd: b.attackCd / Math.max(0.4, 1 + m.atkSpeed),
      atkSpeedBonus: m.atkSpeed,
      moveSpeed: b.moveSpeed * moveMult,
      moveMult,
      crit: Math.min(0.75, b.crit + m.crit),
      critMult: b.critMult + m.critMult,
      armor: Math.min(0.75, b.armor + m.armor),
      pierce: Math.round(m.pierce),
      extraProj: Math.round(m.extraProj),
      area: Math.max(0.5, 1 + m.area),
      cdr: Math.min(0.6, m.cdr),
      goldMult: Math.max(0.1, 1 + m.gold),
      luck: m.luck,
      homing: m.homing > 0,
      reveal: m.reveal > 0
    };
  }

  /** Все активные эффекты-триггеры: [{key, effect, source}] */
  effects(run) {
    const out = [];
    run.items.forEach((id, i) => {
      const it = this.items[id];
      (it?.effects || []).forEach((e, j) => out.push({ key: `${id}#${i}.${j}`, effect: e, source: it }));
    });
    for (const s of this.activeSets(run)) (this.sets[s].effects || []).forEach((e, j) => out.push({ key: `set:${s}.${j}`, effect: e, source: this.sets[s] }));
    return out;
  }

  /** Случайный предмет. minTier — минимальная редкость, luck сдвигает шансы вверх. */
  roll(rng, { minRarity = 'common', maxRarity = 'mythic', luck = 0, exclude = [] } = {}) {
    const minT = RARITY[minRarity].tier; const maxT = RARITY[maxRarity].tier;
    const tiers = RARITIES.filter((r, i) => i >= minT && i <= maxT).map((r, i0) => ({ ...r, w: r.weight * (1 + luck * 0.18 * RARITY[r.id].tier) }));
    for (let attempt = 0; attempt < 6; attempt++) {
      const tier = rng.weighted(tiers);
      const pool = Object.values(this.items).filter((it) => it.rarity === tier.id && !exclude.includes(it.id));
      if (pool.length) return rng.pick(pool);
    }
    const any = Object.values(this.items).filter((it) => !exclude.includes(it.id) && RARITY[it.rarity].tier >= minT);
    return any.length ? rng.pick(any) : rng.pick(Object.values(this.items));
  }

  /** Три варианта улучшения уровня, с учётом класса. */
  rollUpgrades(rng, classId, count = 3) {
    const pool = Object.entries(this.upgrades).filter(([, u]) => !u.class || u.class === classId).map(([id, u]) => ({ id, ...u }));
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < 50) {
      const u = rng.weighted(pool);
      if (!out.find((x) => x.id === u.id)) out.push(u);
    }
    return out;
  }

  price(item) { return this.prices[item.rarity] || 50; }
}
