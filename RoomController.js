import Phaser from 'phaser';
import { Enemy } from './Enemy.js';
import { Boss } from './Boss.js';
import { Interactable } from './Interactable.js';
import { GD } from './GameData.js';
import { audio } from './AudioSystem.js';
import { reachableCells } from './FloorGenerator.js';
import { TILE, ROOM_PX_W, ROOM_PX_H, RARITY, hex } from './Constants.js';
import { fxRand } from './Random.js';
import { dist } from './Helpers.js';

/** Логика комнат: вход, двери, волны, зачистка, содержимое, награды. */
export class RoomController {
  constructor(scene) {
    this.scene = scene;
    this.data = null;
    this.waveIndex = 0;
    this.active = false;
    this.pendingSpawns = 0;
    this.interactables = [];
  }

  get ox() { return this.data.gx * ROOM_PX_W; }
  get oy() { return this.data.gy * ROOM_PX_H; }
  get cx() { return this.ox + ROOM_PX_W / 2; }
  get cy() { return this.oy + 2 * TILE + 6.5 * TILE; }

  scaling() { return this.scene.difficulty.scaling(this.scene.run.floor); }

  /** Точка внутри проходимой части комнаты. */
  clampToRoom(x, y) {
    const cx = Phaser.Math.Clamp(x, this.ox + 28, this.ox + ROOM_PX_W - 28);
    const cy = Phaser.Math.Clamp(y, this.oy + 44, this.oy + ROOM_PX_H - 26);
    if (this.scene.nav.isWalkableWorld(cx, cy)) return { x: cx, y: cy };
    // ближайшая проходимая клетка по спирали
    for (let r = 16; r < 120; r += 16) for (let a = 0; a < 8; a++) {
      const tx = cx + Math.cos((a * Math.PI) / 4) * r; const ty = cy + Math.sin((a * Math.PI) / 4) * r;
      if (this.scene.nav.isWalkableWorld(tx, ty) && tx > this.ox + 20 && tx < this.ox + ROOM_PX_W - 20 && ty > this.oy + 40 && ty < this.oy + ROOM_PX_H - 20) return { x: tx, y: ty };
    }
    return { x: this.cx, y: this.cy };
  }

  /** Случайная проходимая точка на расстоянии [rmin, rmax] от (px, py). */
  findSpotNear(px, py, rmin, rmax, flying) {
    for (let i = 0; i < 16; i++) {
      const a = fxRand(0, Math.PI * 2); const r = fxRand(rmin, rmax);
      const x = px + Math.cos(a) * r; const y = py + Math.sin(a) * r;
      if (x < this.ox + 24 || x > this.ox + ROOM_PX_W - 24 || y < this.oy + 40 || y > this.oy + ROOM_PX_H - 22) continue;
      if (flying || this.scene.nav.isWalkableWorld(x, y)) return { x, y };
    }
    return this.clampToRoom(px + rmax, py);
  }

  // ---------------------------------------------------------------- содержимое
  buildContents(room) {
    const s = this.scene; const ox = room.gx * ROOM_PX_W; const oy = room.gy * ROOM_PX_H;
    const cx = ox + ROOM_PX_W / 2; const cy = oy + 2 * TILE + 6.5 * TILE;
    const add = (it) => { it.roomId = room.id; this.interactables.push(it); return it; };
    const rng = s.rng.fork(`room${room.id}`);
    if (room.type === 'chest') add(this.makeChest(cx, cy + 4, 'wood', { minRarity: 'common', maxRarity: 'epic' }, rng));
    if (room.type === 'treasure') add(this.makeChest(cx, cy + 4, 'gold', { minRarity: 'rare' }, rng));
    if (room.type === 'secret') {
      add(this.makeChest(cx + 24, cy + 4, 'gold', { minRarity: 'uncommon' }, rng));
      add(this.makeLore(cx - 24, cy + 4, 'secret_1'));
    }
    if (room.type === 'rest') add(this.makeFountain(cx, cy));
    if (room.type === 'shop') this.makeShop(room, cx, cy, rng).forEach(add);
    if (room.type === 'event') add(this.makeEvent(room, cx, cy));
    if (room.type === 'exit') { this.makeStairs(cx, cy + 4, false, room); add(this.makeLore(cx - 40, cy + 10, null)).floorNote = true; }
  }

  makeChest(x, y, kind, roll, rng) {
    const it = new Interactable(this.scene, x, y, {
      texture: `chest_${kind}`, prompt: 'Открыть', light: kind === 'gold' ? 60 : 40, glow: kind === 'gold' ? 0xffd24a : 0xffb060,
      onUse: (self) => {
        self.disable(); self.sprite.setFrame(1);
        audio.sfx('chest');
        this.scene.fx.glowBurst(x, y - 8, 0xffe08a, 24);
        this.scene.cameras.main.shake(80, 0.003);
        this.scene.tweens.add({ targets: self.sprite, scaleY: 1.15, duration: 80, yoyo: true });
        const item = this.scene.items.roll(rng, { ...roll, luck: this.scene.player.stats.luck, exclude: this.scene.run.items });
        this.scene.time.delayedCall(250, () => {
          const p = this.scene.combat.spawnPickup(x, y - 10, 'item', { item, scatter: false });
          this.scene.tweens.add({ targets: p, y: y + 14, duration: 450, ease: 'Bounce.Out' });
          this.scene.combat.dropGold(x, y, kind === 'gold' ? 18 : 8);
          if (Math.random() < 0.3) this.scene.combat.spawnPickup(x, y, 'potion');
        });
      }
    });
    this.scene.tweens.add({ targets: it.sprite, y: y - 1, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return it;
  }

  makeFountain(x, y) {
    return new Interactable(this.scene, x, y, {
      texture: 'fountain', anim: 'fountain_flow', prompt: 'Испить (+50% здоровья)', light: 70, glow: 0x3f8ad0,
      onUse: (self) => {
        self.disable(); self.sprite.stop(); self.sprite.setTexture('fountain_dry');
        const p = this.scene.player;
        this.scene.combat.healPlayer(Math.round(p.stats.maxHp * 0.5));
        audio.sfx('heal');
        this.scene.fx.glowBurst(x, y - 8, 0x7cd8ff, 30);
        this.scene.ui.toast('Силы возвращаются', '#7cff8a');
      }
    });
  }

  makeLore(x, y, loreId) {
    return new Interactable(this.scene, x, y, {
      texture: 'note', prompt: 'Прочитать', glow: 0xefe1b8, radius: 18,
      onUse: (self) => { self.destroy(); this.scene.eventSys.revealLore(loreId || 'random'); }
    });
  }

  makeShop(room, cx, cy, rng) {
    const s = this.scene; const out = [];
    out.push(new Interactable(s, cx, cy - 34, { texture: 'npc_merchant', anim: 'npc_merchant_idle', prompt: 'Поговорить', light: 60, onUse: () => { audio.sfx('uiOk'); s.ui.toast('«Всё по честной цене. Почти.»', '#e3b04b'); } }));
    const picks = [];
    for (let i = 0; i < 2; i++) picks.push(s.items.roll(rng, { minRarity: i ? 'uncommon' : 'common', maxRarity: 'epic', luck: s.player.stats.luck, exclude: [...s.run.items, ...picks.map((p) => p.id)] }));
    const slots = [{ x: cx - 52, item: picks[0] }, { x: cx, item: picks[1] }, { x: cx + 52, potion: true }];
    for (const slot of slots) {
      const price = slot.potion ? GD.prices.potion : s.items.price(slot.item);
      s.add.image(slot.x, cy + 10, 'pedestal').setDepth(5 + (cy + 10) * 0.01);
      const it = new Interactable(s, slot.x, cy + 4, {
        texture: slot.potion ? 'hud_icons' : 'items', frame: slot.potion ? 'potion' : slot.item.id, shadow: false,
        label: `${price}`, glow: slot.potion ? 0xe8404a : hex(RARITY[slot.item.rarity].color), light: 30, depthOffset: 1,
        prompt: () => (slot.potion ? `Зелье лечения — ${price} зол.` : `${slot.item.name} — ${price} зол.`),
        onUse: (self) => {
          const run = s.run;
          if (run.gold < price) { audio.sfx('deny'); s.ui.toast('Не хватает золота', '#ff5a5a'); return; }
          run.gold -= price;
          audio.sfx('buy');
          self.destroy();
          if (slot.potion) { run.potions++; s.ui.toast('+1 зелье', '#e8404a'); } else s.grantItem(slot.item, slot.x, cy);
        }
      });
      it.inspect = slot.item;
      s.tweens.add({ targets: it.sprite, y: cy + 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      out.push(it);
    }
    return out;
  }

  makeEvent(room, x, y) {
    const ev = GD.events[room.eventId];
    const sprite = ev.sprite;
    const isNpc = sprite.startsWith('npc_');
    const it = new Interactable(this.scene, x, y, {
      texture: sprite, anim: isNpc ? `${sprite}_idle` : undefined, prompt: ev.title, light: 60,
      glow: sprite === 'altar_blood' ? 0xe0404a : sprite === 'altar_wish' ? 0x4ab0e0 : 0xb884ff,
      onUse: (self) => this.scene.eventSys.open(room, self)
    });
    return it;
  }

  // ---------------------------------------------------------------- вход в комнату
  enter(room, fromDir) {
    this.data = room;
    const s = this.scene;
    const first = !room.visited;
    room.visited = true;
    // соседей видно на мини-карте
    for (const [dk, id] of Object.entries(room.doors)) if (id !== null && !room.secretDoors[dk]) s.layout.byId.get(id).seen = true;
    if (first) { s.run.stats.rooms++; s.save.meta.roomsExplored++; }
    s.nav.setRoom(this.ox, this.oy);
    s.player.roomStacks = {};
    const hostile = ['combat', 'challenge', 'boss', 'miniboss'].includes(room.type) && !room.cleared;
    s.combat.clearHazards();
    s.audioForRoom(room, hostile);
    if (!hostile) return;
    // войти чуть глубже, чтобы закрыть дверь за спиной
    const push = { N: [0, 26], S: [0, -26], W: [26, 0], E: [-26, 0] }[fromDir] || [0, 0];
    s.tweens.add({ targets: s.player, x: s.player.x + push[0], y: s.player.y + push[1], duration: 200 });
    s.time.delayedCall(220, () => {
      s.world.setDoorsClosed(room, true);
      s.nav.rebuild();
      audio.sfx('door');
      s.cameras.main.shake(80, 0.003);
      this.waveIndex = 0;
      this.active = true;
      if (room.type === 'boss' || room.type === 'miniboss') this.bossIntro(room);
      else { s.combat.trigger('roomEnter', {}); this.spawnWave(); }
      if (room.type === 'challenge') s.ui.banner('ИСПЫТАНИЕ: 3 ВОЛНЫ', '#ff9a4a');
    });
  }

  bossIntro(room) {
    const s = this.scene;
    const w = room.waves[0][0];
    const def = w.major ? GD.bosses[w.id] : GD.enemies[w.id];
    s.ui.bossIntro(def.name, w.minor ? 'Мини-босс' : def.title || 'Страж');
    if (!w.major) audio.sfx('roar');
    if (room.type === 'boss') audio.playMusic(def.final ? 'finale' : 'boss');
    s.time.delayedCall(700, () => { s.combat.trigger('roomEnter', {}); this.spawnWave(); });
  }

  spawnWave() {
    const room = this.data; const s = this.scene;
    const wave = room.waves[this.waveIndex];
    if (!wave) return;
    const cells = reachableCells(room.grid, room).filter(([x, y]) => {
      const wx = this.ox + (x + 1) * TILE + 8; const wy = this.oy + (y + 2) * TILE + 8;
      return dist(wx, wy, s.player.x, s.player.y) > 90 && x > 0 && x < 27 && y > 0 && y < 12;
    });
    const rng = s.rng.fork(`wave${room.id}-${this.waveIndex}`);
    const pool = rng.shuffle(cells);
    wave.forEach((e, i) => {
      let x; let y;
      if (e.boss) { x = this.cx; y = this.oy + (GD.bosses[e.id]?.stationary ? 6 : 5.5) * TILE; }
      else { const c = pool[i % Math.max(1, pool.length)] || [13, 6]; x = this.ox + (c[0] + 1) * TILE + 8; y = this.oy + (c[1] + 2) * TILE + 8; }
      this.spawnEnemy(e.id, x, y, { elite: e.elite, major: e.major, delay: i * 90, instantBoss: e.boss });
    });
    if (this.waveIndex > 0) s.ui.toast(`Волна ${this.waveIndex + 1}/${room.waves.length}`, '#ff9a4a');
  }

  spawnEnemy(id, x, y, { elite = false, major = false, delay = 0, instant = false, summoner = null, instantBoss = false } = {}) {
    const s = this.scene;
    this.pendingSpawns++;
    const dur = instant || instantBoss ? 0 : 0.65;
    if (!instant && !instantBoss) s.time.delayedCall(delay, () => s.fx.spawnCircle(x, y, dur, elite ? 0xd060ff : 0xb884ff));
    s.time.delayedCall(delay + dur * 1000, () => {
      this.pendingSpawns--;
      if (!s.player.alive) return;
      let e;
      if (major) e = new Boss(s, x, y, id, GD.bosses[id], { scaling: this.scaling() });
      else e = new Enemy(s, x, y, id, GD.enemies[id], { elite, scaling: this.scaling() });
      if (instant) { e.state = 'idle'; e.timer = 0.4; e.setAlpha(1); e.aggro = true; }
      if (summoner) { e.summonedBy = summoner; e.aggro = true; }
      s.combat.addEnemy(e);
      if (e.isBoss) s.ui.bossBar(e);
      if (!s.save.meta.bestiary[id]) s.save.meta.bestiary[id] = s.save.meta.bestiary[id] || 0;
    });
  }

  /** Засада внутри мирной комнаты (мимик и т.п.). */
  ambush(id, x, y) {
    const s = this.scene; const room = this.data;
    room.waves = [[]]; this.waveIndex = 0; this.active = true; room.cleared = false;
    s.world.setDoorsClosed(room, true); s.nav.rebuild();
    audio.sfx('door');
    s.audioForRoom(room, true);
    this.spawnEnemy(id, x, y, { elite: true, delay: 200 });
  }

  checkCleared() {
    if (!this.active) return;
    const s = this.scene;
    if (this.pendingSpawns > 0 || s.combat.enemies.some((e) => e.alive)) return;
    const room = this.data;
    this.waveIndex++;
    if (this.waveIndex < room.waves.length) { s.time.delayedCall(700, () => this.spawnWave()); return; }
    this.active = false;
    room.cleared = true;
    s.world.setDoorsClosed(room, false);
    s.nav.rebuild();
    audio.sfx('doorOpen');
    s.combat.magnetAll();
    s.combat.trigger('roomClear', {});
    s.audioForRoom(room, false);
    if (room.type === 'challenge') {
      s.ui.banner('ИСПЫТАНИЕ ПРОЙДЕНО', '#ffd24a');
      this.interactables.push(this.makeChest(this.cx, this.cy + 4, 'gold', { minRarity: 'rare' }, s.rng.fork(`ch${room.id}`)));
      s.combat.spawnPickup(this.cx, this.cy, 'shard', { value: 3 });
    } else if (room.type === 'combat' && Math.random() < 0.18 + s.player.stats.luck * 0.03) {
      s.combat.spawnPickup(this.cx, this.cy, Math.random() < 0.6 ? 'heart' : 'potion');
    }
    if (room.type === 'combat' || room.type === 'challenge') s.onHostileRoomCleared();
    if (room.type === 'miniboss') s.onHostileRoomCleared(true);
    s.saveMeta();
  }

  onBossKilled(e) {
    const s = this.scene;
    if (e.minor || e.def.miniboss) return this.onMinibossKilled(e);
    s.run.stats.bossesKilled++;
    s.save.meta.bossesKilled++;
    s.save.meta.bossesDefeated[e.id] = (s.save.meta.bossesDefeated[e.id] || 0) + 1;
    s.ui.bossBar(null);
    s.cameras.main.shake(500, 0.01);
    s.cameras.main.flash(300, 255, 255, 220);
    audio.sfx('victory');
    s.combat.enemies.forEach((o) => { if (o !== e && o.alive) s.combat.killEnemy(o); });
    s.combat.clearShots();
    s.time.delayedCall(1100, () => {
      const room = this.data;
      const final = !!e.bdef?.final;
      s.ui.banner(`${e.bdef.name.toUpperCase()} ПОВЕРЖЕН${e.bdef.name.endsWith('а') ? 'А' : ''}`, '#ffd24a', final ? 'Башня затихает…' : `Глава ${s.layout.chapter} пройдена`);
      this.interactables.push(this.makeChest(this.cx - 40, this.cy + 10, 'gold', { minRarity: 'epic' }, s.rng.fork(`boss${room.id}`)));
      s.combat.healPlayer(Math.round(s.player.stats.maxHp * 0.3));
      s.combat.spawnPickup(this.cx, this.cy + 20, 'shard', { value: 6 + s.layout.chapter * 3 });
      s.combat.spawnPickup(this.cx + 10, this.cy + 20, 'potion');
      this.makeStairs(this.cx + 40, this.cy + 6, final);
      const loreId = `boss_${e.id}`;
      this.interactables.push(this.makeLore(this.cx, this.cy + 30, GD.lore[loreId] ? loreId : 'random'));
    });
  }

  onMinibossKilled(e) {
    const s = this.scene;
    s.save.meta.minibossesKilled = (s.save.meta.minibossesKilled || 0) + 1;
    s.ui.bossBar(null);
    audio.sfx('victory');
    s.combat.enemies.forEach((o) => { if (o !== e && o.alive && o.summonedBy === e) s.combat.killEnemy(o); });
    s.time.delayedCall(900, () => {
      s.ui.banner('МИНИ-БОСС ПОВЕРЖЕН', '#ff8ad8');
      this.interactables.push(this.makeChest(this.cx, this.cy + 6, 'gold', { minRarity: 'rare' }, s.rng.fork(`mb${this.data.id}`)));
      s.combat.spawnPickup(this.cx + 20, this.cy + 20, 'shard', { value: 3 });
      if (Math.random() < 0.5) s.combat.spawnPickup(this.cx - 20, this.cy + 20, 'heart');
    });
  }

  makeStairs(x, y, offerVictory, room) {
    const s = this.scene;
    void room;
    const tx = Math.floor(x / TILE); const ty = Math.floor(y / TILE);
    s.world.ground.putTileAt(15, tx, ty);
    s.fx.glowBurst(tx * TILE + 8, ty * TILE + 8, 0x7cff8a, 20);
    s.lighting.add({ x: tx * TILE + 8, y: ty * TILE + 8, radius: 60, intensity: 0.9, flicker: true });
    const it = new Interactable(s, tx * TILE + 8, ty * TILE + 12, {
      prompt: offerVictory ? 'Подняться к источнику' : (s.floors.isChapterStart(s.run.floor + 1) && s.run.floor < 30 ? `Глава ${s.layout.chapter + 1}: этаж ${s.run.floor + 1}` : `Подняться на этаж ${s.run.floor + 1}`), radius: 16, shadow: false,
      onUse: () => {
        if (offerVictory) {
          s.ui.choice({
            title: 'Сердце башни остановлено', text: 'Тридцать этажей позади. Источник желаний погас — или только притих. Завершить восхождение — или проверить, есть ли у башни ещё этажи?',
            choices: [{ label: 'Завершить восхождение (победа)', color: '#ffd24a' }, { label: 'Бесконечный режим: подняться выше' }]
          }, (i) => { if (i === 0) s.endRun(true); else { s.run.completed = true; s.nextFloor(); } });
          return;
        }
        s.nextFloor();
      }
    });
    this.interactables.push(it);
  }

  breakSecret(dk) {
    const s = this.scene;
    const room = this.data;
    if (!room.secretDoors[dk]) return;
    s.world.breakSecret(room, dk);
    s.nav.rebuild();
    const o = s.layout.byId.get(room.doors[dk]);
    o.seen = true;
    s.run.stats.secrets++;
    s.save.meta.secretsFound++;
    audio.sfx('secret');
    s.cameras.main.shake(200, 0.006);
    const t = { N: [this.cx, this.oy + 20], S: [this.cx, this.oy + ROOM_PX_H - 8], W: [this.ox + 8, this.oy + 8 * TILE], E: [this.ox + ROOM_PX_W - 8, this.oy + 8 * TILE] }[dk];
    s.fx.burst(t[0], t[1], 0x8a8890, 30);
    s.fx.glowBurst(t[0], t[1], 0x62d6ff, 20);
    s.ui.banner('ТАЙНИК ОБНАРУЖЕН', '#62d6ff');
  }

  /** Подсказка для ближайшего объекта. */
  nearest(px, py) {
    let best = null; let bd = 999;
    for (const it of this.interactables) {
      if (!it.enabled) continue;
      const d = dist(px, py, it.x, it.y);
      if (d < it.radius && d < bd) { bd = d; best = it; }
    }
    return best;
  }

  /** Анимация «появления» предмета (луч). */
  static beam(scene, x, y, color) {
    const b = scene.add.rectangle(x, y - 60, 6, 120, color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6).setDepth(5000);
    scene.tweens.add({ targets: b, scaleX: 0, alpha: 0, duration: 600, onComplete: () => b.destroy() });
    void fxRand;
  }
}
