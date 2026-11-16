import { TILE, ROOM_W, ROOM_H, SOLID_TILES, T } from './Constants.js';

const SOLID = new Set(SOLID_TILES);

/**
 * Навигация внутри текущей комнаты: поле потока (flow field) от клетки игрока.
 * Враги идут по градиенту, поэтому обходят колонны и ямы, а не застревают.
 * Отдельное поле для летающих (ямы не мешают).
 */
export class NavGrid {
  constructor(scene) {
    this.scene = scene;
    this.ground = new Int16Array(ROOM_W * ROOM_H);
    this.air = new Int16Array(ROOM_W * ROOM_H);
    this.walk = new Uint8Array(ROOM_W * ROOM_H);
    this.fly = new Uint8Array(ROOM_W * ROOM_H);
    this.refreshT = 0;
  }

  setRoom(ox, oy) {
    this.ox = ox; this.oy = oy;
    this.rebuild();
  }

  rebuild() {
    const layer = this.scene.world.ground;
    const tx0 = this.ox / TILE; const ty0 = this.oy / TILE;
    for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) {
      const t = layer.getTileAt(tx0 + x, ty0 + y);
      const idx = t ? t.index : T.WALL_TOP;
      const solid = SOLID.has(idx) || x === 0 || y === 0 || x === ROOM_W - 1 || y === ROOM_H - 1;
      this.fly[y * ROOM_W + x] = solid ? 0 : 1;
      this.walk[y * ROOM_W + x] = solid || idx === T.PIT ? 0 : 1;
    }
  }

  cell(wx, wy) { return [Math.floor((wx - this.ox) / TILE), Math.floor((wy - this.oy) / TILE)]; }

  update(dt, tx, ty) {
    this.refreshT -= dt;
    if (this.refreshT > 0) return;
    this.refreshT = 0.2;
    const [cx, cy] = this.cell(tx, ty);
    this.bfs(this.ground, this.walk, cx, cy);
    this.bfs(this.air, this.fly, cx, cy);
  }

  bfs(out, pass, cx, cy) {
    out.fill(-1);
    if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) return;
    const q = new Int16Array(ROOM_W * ROOM_H * 2);
    let h = 0; let t = 0;
    out[cy * ROOM_W + cx] = 0; q[t++] = cx; q[t++] = cy;
    while (h < t) {
      const x = q[h++]; const y = q[h++]; const d = out[y * ROOM_W + x];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= ROOM_W || ny >= ROOM_H) continue;
        const i = ny * ROOM_W + nx;
        if (out[i] !== -1 || !pass[i]) continue;
        if (dx && dy && (!pass[y * ROOM_W + nx] || !pass[ny * ROOM_W + x])) continue; // без срезания углов
        out[i] = d + 1; q[t++] = nx; q[t++] = ny;
      }
    }
  }

  /** Направление к игроку по полю потока. */
  dirFrom(wx, wy, flying) {
    const field = flying ? this.air : this.ground;
    const [cx, cy] = this.cell(wx, wy);
    if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) return null;
    let best = field[cy * ROOM_W + cx]; let bx = -1; let by = -1;
    if (best === -1) best = 9999;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx; const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= ROOM_W || ny >= ROOM_H) continue;
      const v = field[ny * ROOM_W + nx];
      if (v >= 0 && v < best) { best = v; bx = nx; by = ny; }
    }
    if (bx < 0) return null;
    const tx = this.ox + bx * TILE + 8; const ty = this.oy + by * TILE + 8;
    const len = Math.hypot(tx - wx, ty - wy) || 1;
    return { x: (tx - wx) / len, y: (ty - wy) / len };
  }

  /** Прямая видимость по тайлам (Брезенхем). */
  hasLOS(x0, y0, x1, y1, flying) {
    const pass = flying ? this.fly : this.walk;
    let [ax, ay] = this.cell(x0, y0); const [bx, by] = this.cell(x1, y1);
    const dx = Math.abs(bx - ax); const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1; const sy = ay < by ? 1 : -1;
    let err = dx + dy; let guard = 0;
    while (guard++ < 80) {
      if (ax < 0 || ay < 0 || ax >= ROOM_W || ay >= ROOM_H) return false;
      if (!pass[ay * ROOM_W + ax]) return false;
      if (ax === bx && ay === by) return true;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; ax += sx; }
      if (e2 <= dx) { err += dx; ay += sy; }
    }
    return false;
  }

  isWalkableWorld(wx, wy) {
    const [cx, cy] = this.cell(wx, wy);
    if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) return false;
    return !!this.walk[cy * ROOM_W + cx];
  }
}
