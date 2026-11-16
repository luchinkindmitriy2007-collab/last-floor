// Шаблоны комнат: выбор под тип комнаты и биом, зеркалирование, расчистка
// проходов у дверей и проверка проходимости (BFS). Чистая логика, без Phaser.

export const INNER_W = 28;
export const INNER_H = 13;
export const DOOR_CELLS = {
  N: [[13, 0], [14, 0]],
  S: [[13, 12], [14, 12]],
  W: [[0, 5], [0, 6]],
  E: [[27, 5], [27, 6]]
};
const BLOCKING = new Set(['#', 'b', 'o']);
const OPEN_CENTER = new Set(['combat', 'challenge']);

export class RoomGenerator {
  constructor(roomsData) { this.R = roomsData; }

  template(name) { return this.R.templates[name] || this.R.special[name]; }

  /** Список шаблонов для комнаты: общий + особые для биома. */
  candidates(room, biome) {
    const U = this.R.usage;
    if (room.type === 'boss') {
      const arena = biome?.arena;
      return arena && this.template(arena) ? [arena] : U.boss;
    }
    let list = (U[room.type] || U.combat).slice();
    const extra = this.R.biomeUsage?.[biome?.id]?.[room.type];
    if (extra) list = list.concat(extra);
    return list.filter((n) => this.template(n));
  }

  /** Подбирает шаблон, гарантируя проходимость. */
  assign(room, biome, rng) {
    const names = rng.shuffle(this.candidates(room, biome));
    for (const name of names) {
      for (const flip of rng.shuffle([[0, 0], [1, 0], [0, 1], [1, 1]])) {
        const grid = prepareTemplate(this.template(name), flip[0], flip[1], room);
        if (validateGrid(grid, room)) { room.template = name; room.grid = grid; return; }
      }
    }
    room.template = 'plain';
    room.grid = prepareTemplate(this.R.special.plain, 0, 0, room);
  }
}

/** Копирует шаблон, применяет зеркалирование и расчищает проходы у дверей. */
export function prepareTemplate(src, flipX, flipY, room) {
  let rows = src.map((r) => r.padEnd(INNER_W, '.').slice(0, INNER_W));
  if (flipX) rows = rows.map((r) => r.split('').reverse().join(''));
  if (flipY) rows = rows.slice().reverse();
  const g = rows.map((r) => r.split(''));
  const clear = (x0, y0, x1, y1) => {
    for (let y = Math.max(0, y0); y <= Math.min(INNER_H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(INNER_W - 1, x1); x++)
        if (BLOCKING.has(g[y][x])) g[y][x] = '.';
  };
  for (const dk of Object.keys(DOOR_CELLS)) {
    if (room.doors[dk] === null) continue;
    if (dk === 'N') clear(11, 0, 16, 2);
    if (dk === 'S') clear(11, 10, 16, 12);
    if (dk === 'W') clear(0, 4, 2, 7);
    if (dk === 'E') clear(25, 4, 27, 7);
  }
  if (!OPEN_CENTER.has(room.type)) clear(10, 3, 17, 9); // место для сундуков, алтарей, лестницы, босса
  return g.map((r) => r.join(''));
}

/** BFS: все двери (и центр для особых комнат) должны быть достижимы. */
export function validateGrid(grid, room) {
  const walk = (x, y) => x >= 0 && y >= 0 && x < INNER_W && y < INNER_H && !BLOCKING.has(grid[y][x]);
  const targets = [];
  for (const dk of Object.keys(DOOR_CELLS)) if (room.doors[dk] !== null) targets.push(...DOOR_CELLS[dk]);
  if (!OPEN_CENTER.has(room.type)) targets.push([13, 6]);
  if (!targets.length) return true;
  const [sx, sy] = targets[0];
  if (!walk(sx, sy)) return false;
  const seen = new Set([`${sx},${sy}`]); const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (!seen.has(k) && walk(nx, ny)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return targets.every(([x, y]) => seen.has(`${x},${y}`)) && seen.size > 120;
}

/** Проходимые клетки, связанные с дверями (для появления врагов). */
export function reachableCells(grid, room) {
  const walk = (x, y) => x >= 0 && y >= 0 && x < INNER_W && y < INNER_H && !BLOCKING.has(grid[y][x]);
  let start = null;
  for (const dk of Object.keys(DOOR_CELLS)) if (room.doors[dk] !== null) { start = DOOR_CELLS[dk][0]; break; }
  if (!start) start = [13, 6];
  const seen = new Set([`${start[0]},${start[1]}`]); const q = [start]; const out = [];
  while (q.length) {
    const [x, y] = q.shift(); out.push([x, y]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (!seen.has(k) && walk(nx, ny)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return out;
}
