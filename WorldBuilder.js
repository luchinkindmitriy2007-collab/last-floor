import Phaser from 'phaser';
import { TILE, ROOM_W, ROOM_H, ROOM_PX_W, ROOM_PX_H, T, SOLID_TILES, DEPTH, hex } from './Constants.js';
import { RNG } from './Random.js';

const DOOR_TILES = {
  N: { open: [[14, 0], [15, 0], [14, 1], [15, 1]], close: [[14, 1], [15, 1]] },
  S: { open: [[14, 15], [15, 15]], close: [[14, 15], [15, 15]] },
  W: { open: [[0, 7], [0, 8]], close: [[0, 7], [0, 8]] },
  E: { open: [[29, 7], [29, 8]], close: [[29, 7], [29, 8]] }
};

/** Строит тайлкарту всего этажа и управляет дверями/тайниками. */
export class WorldBuilder {
  constructor(scene, layout, biome) {
    this.scene = scene; this.layout = layout; this.biome = biome;
    const G = layout.gridSize;
    this.map = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: G * ROOM_W, height: G * ROOM_H });
    const key = `tiles_${biome.id}`;
    this.tileset = this.map.addTilesetImage(key, key, TILE, TILE, 0, 0);
    this.ground = this.map.createBlankLayer('ground', this.tileset).setDepth(DEPTH.FLOOR);
    this.pits = this.map.createBlankLayer('pits', this.tileset).setVisible(false);
    this.rng = new RNG(layout.floor * 7777 + 13);
    this.decor = [];
    for (const room of layout.rooms) this.buildRoom(room);
    this.ground.setCollision(SOLID_TILES);
    this.pits.setCollision([T.PIT]);
  }

  origin(room) { return { x: room.gx * ROOM_PX_W, y: room.gy * ROOM_PX_H, tx: room.gx * ROOM_W, ty: room.gy * ROOM_H }; }

  put(room, x, y, idx) {
    const o = this.origin(room);
    this.ground.putTileAt(idx, o.tx + x, o.ty + y);
    if (idx === T.PIT) this.pits.putTileAt(T.PIT, o.tx + x, o.ty + y);
    else this.pits.removeTileAt(o.tx + x, o.ty + y);
  }

  floorTile(y) {
    const r = this.rng.float();
    if (y === 2) return r < 0.5 ? T.FLOOR_SHADOW : T.FLOOR_SHADOW_B;
    if (r < 0.5) return T.FLOOR; if (r < 0.76) return T.FLOOR_B; if (r < 0.92) return T.FLOOR_C;
    if (r < 0.965) return T.FLOOR_MOSS; if (r < 0.98) return T.FLOOR_MOSS_HEAVY; return T.FLOOR_CRACK;
  }

  buildRoom(room) {
    const o = this.origin(room);
    for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) {
      let idx;
      if (y === 0 || y === ROOM_H - 1 || x === 0 || x === ROOM_W - 1) idx = T.WALL_TOP;
      else if (y === 1) idx = this.rng.chance(0.18) ? T.WALL_FACE_MOSS : T.WALL_FACE;
      else {
        const ch = room.grid[y - 2][x - 1];
        idx = { '#': T.PILLAR, b: T.PILLAR_BROKEN, o: T.PIT, m: T.FLOOR_MOSS_HEAVY, c: T.FLOOR_CRACK, x: T.RUNE }[ch] ?? this.floorTile(y);
        if (ch === 'm' && y === 2) idx = T.FLOOR_SHADOW;
      }
      this.put(room, x, y, idx);
    }
    // двери
    for (const [dk, id] of Object.entries(room.doors)) {
      if (id === null) continue;
      if (room.secretDoors[dk]) { DOOR_TILES[dk].close.forEach(([x, y]) => this.put(room, x, y, T.CRACKED_WALL)); continue; }
      DOOR_TILES[dk].open.forEach(([x, y]) => this.put(room, x, y, y === 0 ? T.FLOOR_SHADOW : this.floorTile(3)));
      this.doorFrame(room, dk);
      if (room.sealedDoors[dk]) this.makeSeal(room, dk);
    }
    // факелы на стене (не рядом с северной дверью)
    if (room.type !== 'secret') {
      for (const tx of [5, 24]) this.torch(o.x + tx * TILE + 8, o.y + TILE + 4);
    } else this.torch(o.x + 9 * TILE + 8, o.y + TILE + 4, 0x62d6ff);
    // декор: кости, черепа, обломки, лианы
    for (let i = 0; i < 6; i++) {
      const x = this.rng.int(2, 27); const y = this.rng.int(3, 13);
      const ch = room.grid[y - 2][x - 1];
      if (ch !== '.' && ch !== 'm' && ch !== 'c') continue;
      if (Math.abs(x - 14.5) < 3 || Math.abs(y - 7.5) < 2) continue;
      const kind = this.rng.pick(this.biome.decor || ['bones', 'skull', 'rubble']);
      this.decor.push(this.scene.add.image(o.x + x * TILE + 8, o.y + y * TILE + 8, `decor_${kind}`).setDepth(DEPTH.DECAL).setFlipX(this.rng.chance(0.5)));
    }
    for (let x = 2; x < 28; x++) {
      if (x >= 12 && x <= 17) continue;
      if (this.biome.style === 'moss' && this.rng.chance(0.12)) this.decor.push(this.scene.add.image(o.x + x * TILE + 8, o.y + TILE + 8, 'decor_vines').setDepth(DEPTH.DECAL).setFlipX(this.rng.chance(0.5)));
    }
  }

  doorFrame(room, dk) {
    // каменные косяки по бокам проёма — визуально выделяют выход
    const o = this.origin(room);
    const g = this.scene.add.graphics().setDepth(DEPTH.DECAL + 1);
    const P = this.biome.palette;
    g.fillStyle(hex(P.pillar), 1);
    if (dk === 'N') { g.fillRect(o.x + 13 * TILE + 12, o.y + 2, 4, 30); g.fillRect(o.x + 16 * TILE, o.y + 2, 4, 30); g.fillStyle(0x0d0a12, 1); g.fillRect(o.x + 14 * TILE, o.y, 32, 6); }
    if (dk === 'S') { g.fillRect(o.x + 13 * TILE + 12, o.y + 15 * TILE, 4, 16); g.fillRect(o.x + 16 * TILE, o.y + 15 * TILE, 4, 16); }
    if (dk === 'W') { g.fillRect(o.x, o.y + 7 * TILE - 4, 16, 4); g.fillRect(o.x, o.y + 9 * TILE, 16, 4); }
    if (dk === 'E') { g.fillRect(o.x + 29 * TILE, o.y + 7 * TILE - 4, 16, 4); g.fillRect(o.x + 29 * TILE, o.y + 9 * TILE, 16, 4); }
    // метка над проходом в особую комнату: испытание, мини-босс, выход, босс
    const target = this.layout.byId.get(room.doors[dk]);
    const MARK = { challenge: 0xff9a4a, boss: 0xff4a4a, miniboss: 0xff6ad0, exit: 0x7cff8a };
    if (target && target !== room && MARK[target.type]) {
      const pos = { N: [o.x + 15 * TILE, o.y + 10], S: [o.x + 15 * TILE, o.y + 15 * TILE - 6], W: [o.x + 22, o.y + 8 * TILE], E: [o.x + 29 * TILE - 6, o.y + 8 * TILE] }[dk];
      const icon = this.scene.add.image(pos[0], pos[1], 'mm_icons', target.type).setTint(MARK[target.type]).setDepth(DEPTH.DECAL + 2);
      this.scene.tweens.add({ targets: icon, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
    }
  }

  torch(x, y, color) {
    const tint = color ?? hex(this.biome.lightTint);
    const key = this.scene.textures.exists(`torch_${this.biome.id}`) ? `torch_${this.biome.id}` : 'torch';
    const s = this.scene.add.sprite(x, y, key, 0).setDepth(DEPTH.DECAL + 3);
    s.play({ key: `${key}_burn`, startFrame: this.rng.int(0, 2) });
    if (color) s.setTint(color);
    const glow = this.scene.add.image(x, y - 2, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setScale(0.9).setDepth(DEPTH.FX - 50);
    this.scene.tweens.add({ targets: glow, alpha: 0.22, scale: 0.8, duration: 300 + this.rng.int(0, 200), yoyo: true, repeat: -1 });
    this.scene.lighting.add({ x, y: y + 10, radius: 85, intensity: 0.9, flicker: true });
  }

  /** Печать на проходе к выходу/боссу: решётка + руна, пока не зачищено достаточно комнат. */
  makeSeal(room, dk) {
    DOOR_TILES[dk].close.forEach(([x, y]) => this.put(room, x, y, T.DOOR_BARS));
    const o = this.origin(room);
    const pos = { N: [o.x + 15 * TILE, o.y + 1.5 * TILE], S: [o.x + 15 * TILE, o.y + 15.5 * TILE], W: [o.x + 8, o.y + 8 * TILE], E: [o.x + 29 * TILE + 8, o.y + 8 * TILE] }[dk];
    const rune = this.scene.add.image(pos[0], pos[1], 'ring_thin').setTint(hex(this.biome.palette.rune)).setScale(0.45).setDepth(DEPTH.DECAL + 4).setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.scene.add.image(pos[0], pos[1], 'glow').setTint(hex(this.biome.palette.rune)).setScale(0.6).setAlpha(0.5).setDepth(DEPTH.DECAL + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: rune, angle: 360, duration: 4000, repeat: -1 });
    this.scene.tweens.add({ targets: glow, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });
    this.seals = this.seals || [];
    this.seals.push({ room, dk, rune, glow, pos });
  }

  /** Снять все печати этажа. */
  breakSeals() {
    for (const s of this.seals || []) {
      s.room.sealedDoors[s.dk] = false;
      DOOR_TILES[s.dk].close.forEach(([x, y]) => this.put(s.room, x, y, y === 0 ? T.FLOOR_SHADOW : T.FLOOR));
      this.scene.fx.glowBurst(s.pos[0], s.pos[1], hex(this.biome.palette.rune), 24);
      this.scene.fx.ring(s.pos[0], s.pos[1], 30, hex(this.biome.palette.rune), 500);
      this.scene.tweens.killTweensOf([s.rune, s.glow]);
      s.rune.destroy(); s.glow.destroy();
    }
    this.seals = [];
    this.ground.setCollision(SOLID_TILES);
  }

  setDoorsClosed(room, closed) {
    for (const [dk, id] of Object.entries(room.doors)) {
      if (id === null || room.secretDoors[dk] || room.sealedDoors[dk]) continue;
      DOOR_TILES[dk].close.forEach(([x, y]) => this.put(room, x, y, closed ? T.DOOR_BARS : (y === 0 ? T.FLOOR_SHADOW : T.FLOOR)));
    }
    this.ground.setCollision(SOLID_TILES);
  }

  breakSecret(room, dk) {
    DOOR_TILES[dk].open.forEach(([x, y]) => this.put(room, x, y, y === 0 ? T.FLOOR_SHADOW : T.FLOOR_CRACK));
    room.secretDoors[dk] = false;
    this.ground.setCollision(SOLID_TILES);
    // открыть путь и с другой стороны
    const other = this.layout.byId.get(room.doors[dk]);
    const opp = { N: 'S', S: 'N', W: 'E', E: 'W' }[dk];
    DOOR_TILES[opp].open.forEach(([x, y]) => this.put(other, x, y, y === 0 ? T.FLOOR_SHADOW : T.FLOOR));
    this.doorFrame(room, dk);
  }

  /** Мировые координаты центров тайлов секретной стены в комнате. */
  secretTiles(room) {
    const o = this.origin(room); const out = [];
    for (const [dk, s] of Object.entries(room.secretDoors)) {
      if (!s) continue;
      for (const [x, y] of DOOR_TILES[dk].close) out.push({ dk, x: o.x + x * TILE + 8, y: o.y + y * TILE + 8 });
    }
    return out;
  }
}
