// Генерация этажа: граф комнат на сетке → типы комнат (выход/босс, сокровища,
// магазин, мини-босс, события…) → печати на входе к выходу → тайник →
// шаблоны с проверкой проходимости → волны врагов по правилам сложности.
// Не зависит от Phaser, детерминирован по seed.

import { RNG } from './Random.js';
import { DIRS } from './Constants.js';
import { FloorDatabase } from './FloorDatabase.js';
import { DifficultyManager } from './DifficultyManager.js';
import { RoomGenerator, prepareTemplate, validateGrid, reachableCells, INNER_W, INNER_H, DOOR_CELLS } from './RoomGenerator.js';

export { prepareTemplate, validateGrid, reachableCells, INNER_W, INNER_H, DOOR_CELLS };

const GRID = 11;
const HOSTILE = new Set(['combat', 'challenge']);

export class FloorGenerator {
  /** data: { chapters, rooms, enemies, biomes, events, bosses } */
  constructor(data) {
    this.data = data;
    this.fdb = new FloorDatabase(data.chapters);
    this.diff = new DifficultyManager(data.chapters, data.enemies, this.fdb);
    this.roomGen = new RoomGenerator(data.rooms);
  }

  generate(floor, seed) {
    const rng = new RNG((seed ^ (floor * 0x9e3779b1)) >>> 0);
    const cfg = this.fdb.config(floor, () => rng.float());
    for (let attempt = 0; attempt < 40; attempt++) {
      const layout = this.buildLayout(cfg, rng.fork(`layout${attempt}`));
      if (!layout) continue;
      this.assignTypes(layout, cfg, rng.fork('types'));
      this.addSeals(layout, cfg);
      this.addSecret(layout, cfg, rng.fork('secret'));
      const biome = this.data.biomes[cfg.biome];
      const trng = rng.fork('tpl');
      for (const room of layout.rooms) this.roomGen.assign(room, biome, trng);
      this.planEncounters(layout, cfg, floor, rng.fork('enc'));
      Object.assign(layout, { floor, biome: cfg.biome, cfg, chapter: cfg.chapter });
      return layout;
    }
    throw new Error(`FloorGenerator: не удалось построить этаж ${floor}`);
  }

  buildLayout(cfg, rng) {
    const target = rng.int(cfg.rooms[0], cfg.rooms[1]);
    const grid = new Map();
    const key = (x, y) => `${x},${y}`;
    const rooms = [];
    const add = (gx, gy) => {
      const r = { id: rooms.length, gx, gy, type: 'combat', doors: { N: null, S: null, W: null, E: null }, secretDoors: {}, sealedDoors: {}, depth: 0 };
      grid.set(key(gx, gy), r); rooms.push(r); return r;
    };
    const link = (a, b, dir) => { a.doors[dir] = b.id; b.doors[DIRS[dir].opp] = a.id; };
    const neighbors = (x, y) => Object.values(DIRS).filter((d) => grid.has(key(x + d.dx, y + d.dy))).length;
    const c = Math.floor(GRID / 2);
    const start = add(c, c);
    let guard = 0;
    while (rooms.length < target && guard++ < 3000) {
      const base = rng.chance(0.55) ? rooms[rooms.length - 1 - rng.int(0, Math.min(2, rooms.length - 1))] : rng.pick(rooms);
      const dk = rng.pick(Object.keys(DIRS)); const d = DIRS[dk];
      const nx = base.gx + d.dx; const ny = base.gy + d.dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID || grid.has(key(nx, ny)) || neighbors(nx, ny) > 1) continue;
      link(base, add(nx, ny), dk);
    }
    if (rooms.length < target) return null;
    // петли — несколько маршрутов по этажу
    for (const r of rooms) for (const [dk, d] of Object.entries(DIRS)) {
      if (r.doors[dk] !== null) continue;
      const n = grid.get(key(r.gx + d.dx, r.gy + d.dy));
      if (n && n.id > r.id && rng.chance(cfg.loops * 0.5)) link(r, n, dk);
    }
    const byId = new Map(rooms.map((r) => [r.id, r]));
    const q = [start]; const seen = new Set([start.id]);
    while (q.length) {
      const r = q.shift();
      for (const id of Object.values(r.doors)) {
        if (id === null || seen.has(id)) continue;
        seen.add(id); const n = byId.get(id); n.depth = r.depth + 1; q.push(n);
      }
    }
    const deadEnds = rooms.filter((r) => r !== start && Object.values(r.doors).filter((v) => v !== null).length === 1);
    if (deadEnds.length < 2) return null;
    if (Math.max(...rooms.map((r) => r.depth)) < 3) return null;
    start.type = 'start';
    return { rooms, byId, startId: start.id, grid, deadEnds, gridSize: GRID };
  }

  assignTypes(layout, cfg, rng) {
    const { rooms, deadEnds } = layout;
    // выход (лестница) или арена босса — самый дальний тупик
    const exit = deadEnds.slice().sort((a, b) => b.depth - a.depth)[0];
    exit.type = cfg.exitType;
    layout.exitId = exit.id;
    if (cfg.exitType === 'boss') layout.bossId = exit.id;
    const preferDead = new Set(['treasure', 'miniboss', 'challenge', 'shop', 'chest']);
    let free = rooms.filter((r) => r.type === 'combat');
    let freeDead = rng.shuffle(deadEnds.filter((r) => r.type === 'combat'));
    for (const t of cfg.special) {
      if (free.length <= Math.ceil(rooms.length * 0.3)) break;
      let pick = null;
      if (preferDead.has(t) && freeDead.length) pick = freeDead.shift();
      else {
        const c = free.filter((r) => r.depth >= (t === 'rest' ? 2 : 1));
        if (c.length) pick = rng.pick(c);
      }
      if (!pick) continue;
      pick.type = t;
      if (t === 'miniboss') pick.miniboss = rng.pick(cfg.minibosses);
      free = free.filter((r) => r !== pick);
      freeDead = freeDead.filter((r) => r !== pick);
    }
    // первый бой — сразу возле входа
    const start = layout.byId.get(layout.startId);
    const near = Object.values(start.doors).filter((v) => v !== null).map((id) => layout.byId.get(id));
    if (!near.some((r) => r.type === 'combat')) {
      const c = near.find((r) => !['boss', 'exit', 'treasure', 'shop'].includes(r.type));
      if (c) { c.type = 'combat'; delete c.miniboss; }
    }
    const evIds = Object.keys(this.data.events.events);
    const used = new Set();
    for (const r of rooms) {
      if (r.type !== 'event') continue;
      const pool = evIds.filter((e) => !used.has(e));
      r.eventId = rng.pick(pool.length ? pool : evIds);
      used.add(r.eventId);
    }
  }

  /** Вход в комнату выхода/босса запечатан, пока не зачищена часть боевых комнат. */
  addSeals(layout, cfg) {
    const exit = layout.byId.get(layout.exitId);
    for (const [dk, id] of Object.entries(exit.doors)) {
      if (id === null) continue;
      const parent = layout.byId.get(id);
      parent.sealedDoors[DIRS[dk].opp] = true;
    }
    const hostile = layout.rooms.filter((r) => HOSTILE.has(r.type)).length;
    layout.sealRequired = hostile ? Math.max(1, Math.ceil(hostile * cfg.sealShare)) : 0;
  }

  addSecret(layout, cfg, rng) {
    if (!rng.chance(cfg.secretChance)) return;
    const { grid, rooms } = layout;
    const key = (x, y) => `${x},${y}`;
    const cands = [];
    for (const r of rooms) {
      if (['boss', 'exit', 'start'].includes(r.type)) continue;
      for (const [dk, d] of Object.entries(DIRS)) {
        const nx = r.gx + d.dx; const ny = r.gy + d.dy;
        if (nx < 0 || ny < 0 || nx >= layout.gridSize || ny >= layout.gridSize || grid.has(key(nx, ny))) continue;
        if (r.sealedDoors[dk]) continue;
        const nearExit = Object.values(DIRS).some((dd) => { const n = grid.get(key(nx + dd.dx, ny + dd.dy)); return n && (n.type === 'boss' || n.type === 'exit'); });
        if (!nearExit) cands.push({ r, dk, nx, ny });
      }
    }
    if (!cands.length) return;
    const c = rng.pick(cands);
    const s = { id: rooms.length, gx: c.nx, gy: c.ny, type: 'secret', doors: { N: null, S: null, W: null, E: null }, secretDoors: {}, sealedDoors: {}, depth: c.r.depth + 1 };
    rooms.push(s); grid.set(key(c.nx, c.ny), s); layout.byId.set(s.id, s);
    c.r.doors[c.dk] = s.id; c.r.secretDoors[c.dk] = true;
    s.doors[DIRS[c.dk].opp] = c.r.id;
    layout.secretId = s.id;
  }

  planEncounters(layout, cfg, floor, rng) {
    const D = this.diff;
    for (const room of layout.rooms) {
      room.waves = [];
      if (room.type === 'combat') {
        const n = rng.int(cfg.waves[0], cfg.waves[1]);
        for (let i = 0; i < n; i++) room.waves.push(D.buildWave(rng, floor, Math.max(2, Math.round(D.budget(floor, room.depth) * (i ? 0.85 : 1))), 0));
      } else if (room.type === 'challenge') {
        for (let i = 0; i < 3; i++) room.waves.push(D.buildWave(rng, floor, Math.round(D.budget(floor, 4) * 1.15), 0.25));
      } else if (room.type === 'miniboss') {
        const id = room.miniboss;
        const isBossDef = !!this.data.bosses?.[id];
        room.waves.push([{ id, boss: true, major: isBossDef, minor: true }]);
      } else if (room.type === 'boss') {
        room.waves.push([{ id: cfg.boss, boss: true, major: true }]);
      }
    }
  }
}
