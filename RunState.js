// Состояние одного забега. Сериализуется в контрольной точке (начало этажа).

import { uid } from './Helpers.js';

export class RunState {
  constructor(init = {}) {
    this.runId = init.runId || uid();
    this.seed = init.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.classId = init.classId || 'guardian';
    this.floor = init.floor || 1;
    this.hp = init.hp ?? null; // null = полное здоровье
    this.level = init.level || 1;
    this.xp = init.xp || 0;
    this.gold = init.gold || 0;
    this.potions = init.potions ?? 1;
    this.items = init.items || [];
    this.upgrades = init.upgrades || [];
    this.curses = init.curses || [];
    this.bonusStats = init.bonusStats || {}; // от событий (алтари и т.п.)
    this.usedRevive = init.usedRevive || false;
    this.counters = init.counters || {}; // счётчики эффектов предметов
    this.mapRevealed = false;
    this.stats = Object.assign({
      kills: 0, rooms: 0, damageTaken: 0, damageDealt: 0, goldEarned: 0, timeMs: 0,
      bossesKilled: 0, itemsFound: 0, secrets: 0, eliteKills: 0, floorsCleared: 0, potionsUsed: 0
    }, init.stats || {});
    this.lore = init.lore || [];
    this.shardsBonus = init.shardsBonus || 0;
    this.startedAt = init.startedAt || Date.now();
    this.completed = !!init.completed; // финальный босс побеждён, дальше — бесконечный режим
  }

  xpToNext() { return Math.round(18 + (this.level - 1) * 14 + Math.pow(this.level - 1, 1.6) * 4); }

  serialize() {
    return {
      runId: this.runId, seed: this.seed, classId: this.classId, floor: this.floor, hp: this.hp,
      level: this.level, xp: this.xp, gold: this.gold, potions: this.potions, items: this.items.slice(),
      upgrades: this.upgrades.slice(), curses: this.curses.slice(), bonusStats: { ...this.bonusStats },
      usedRevive: this.usedRevive, counters: {}, stats: { ...this.stats }, lore: this.lore.slice(),
      shardsBonus: this.shardsBonus, startedAt: this.startedAt, completed: this.completed
    };
  }

  static deserialize(obj) {
    if (!obj || typeof obj !== 'object' || !obj.runId || !obj.classId) return null;
    return new RunState(obj);
  }
}
