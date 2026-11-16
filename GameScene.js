import { platform } from './Platform.js';
import Phaser from 'phaser';
import { GD } from './GameData.js';
import { FloorGenerator } from './FloorGenerator.js';
import { WorldBuilder } from './WorldBuilder.js';
import { ItemSystem } from './ItemSystem.js';
import { CombatSystem } from './CombatSystem.js';
import { RoomController } from './RoomController.js';
import { EventSystem } from './EventSystem.js';
import { NavGrid } from './NavGrid.js';
import { FxSystem, Lighting } from './FxSystem.js';
import { Controls } from './Controls.js';
import { RunState } from './RunState.js';
import { saveSystem } from './SaveSystem.js';
import { audio } from './AudioSystem.js';
import { analytics } from './AnalyticsManager.js';
import { Player } from './Player.js';
import { FloorManager } from './FloorManager.js';
import { FloorDatabase, MAIN_FLOORS } from './FloorDatabase.js';
import { DifficultyManager } from './DifficultyManager.js';
import { BiomeManager } from './BiomeManager.js';
import { RNG } from './Random.js';
import { GAME_W, HUD_H, ROOM_PX_W, ROOM_PX_H, TILE, RARITY, hex } from './Constants.js';
import { log } from './Helpers.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.initData = data || {};
  }

  get save() { return saveSystem.data; }
  get settings() { return saveSystem.data.settings; }

  create() {
    const d = this.initData;
    this.run = d.run instanceof RunState ? d.run : new RunState({ classId: d.classId || 'guardian' });
    this.cls = GD.classes[this.run.classId];
    this.rng = new RNG(this.run.seed ^ (this.run.floor * 2654435761));
    this.items = new ItemSystem({ items: GD.items, sets: GD.sets, curses: GD.curses, upgrades: GD.upgrades, prices: GD.prices });
    this.itemEffects = [];
    this.hitstopDepth = 0;
    this.pendingLevels = 0;
    this.ended = false;
    this.playTimer = 0;
    platform.gameplayStarted();

    // --- этаж
    const gen = new FloorGenerator({ chapters: GD.chapters, rooms: GD.rooms, enemies: GD.enemies, biomes: GD.biomes, events: { events: GD.events }, bosses: GD.bosses });
    this.floors = gen.fdb;
    this.difficulty = gen.diff;
    this.layout = gen.generate(this.run.floor, this.run.seed);
    this.biome = BiomeManager.get(this.layout.biome);
    const cam = this.cameras.main;
    cam.setViewport(0, HUD_H, GAME_W, ROOM_PX_H).setBackgroundColor('#07060b').setRoundPixels(true);
    this.lighting = new Lighting(this, GAME_W, ROOM_PX_H);
    this.lighting.setAmbient(hex(this.biome.ambient.color), this.biome.ambient.alpha);
    this.fx = new FxSystem(this);
    this.world = new WorldBuilder(this, this.layout, this.biome);
    this.nav = new NavGrid(this);
    this.controls = new Controls(this);
    this.eventSys = new EventSystem(this);

    // --- игрок
    const start = this.layout.byId.get(this.layout.startId);
    const sx = start.gx * ROOM_PX_W + ROOM_PX_W / 2; const sy = start.gy * ROOM_PX_H + 9 * TILE;
    this.player = new Player(this, sx, sy, this.cls, this.run);
    this.combat = new CombatSystem(this);
    this.combat.setupColliders();
    this.room = new RoomController(this);
    for (const r of this.layout.rooms) this.room.buildContents(r);
    this.floorMgr = new FloorManager(this, this.layout, this.floors);

    cam.setScroll(start.gx * ROOM_PX_W, start.gy * ROOM_PX_H);
    this.room.enter(start, null);
    start.seen = true;
    if (this.player.stats.reveal || this.run.mapRevealed) this.revealMap(this.player.stats.reveal);

    // --- интерфейс
    if (!this.scene.isActive('UI')) this.scene.launch('UI', { game: this });
    else this.scene.get('UI').bind(this);
    this.ui = this.scene.get('UI');
    this.scene.bringToTop('UI');

    // --- контрольная точка: начало этажа
    if (d.mode === 'new') {
      this.save.meta.totalRuns++;
      this.save.meta.lastClass = this.run.classId;
      analytics.track('run_start', { cls: this.run.classId });
    }
    this.checkpoint();
    this.game.events.off('lf-flush-save');
    this.game.events.on('lf-flush-save', () => { if (!this.ended) { this.save.meta.totalPlayMs += this.playTimer; this.playTimer = 0; saveSystem.save(); } });
    this.events.once('shutdown', () => this.game.events.off('lf-flush-save'));

    cam.fadeIn(400, 7, 6, 11);
    this.time.delayedCall(250, () => {
      const ch = this.floors.chapter(this.run.floor);
      if (this.floors.isChapterStart(this.run.floor)) {
        this.ui?.banner(this.run.floor > MAIN_FLOORS ? `ГЛАВА ${ch.id} · ∞` : `ГЛАВА ${ch.id}`, this.biome.lightTint, `${ch.name}. ${ch.intro}`);
      } else this.ui?.banner(`ЭТАЖ ${this.run.floor}`, '#f2e6c9', this.floors.isBossFloor(this.run.floor) ? `${ch.name} — логово стража` : ch.name);
      if (this.run.floor === 1 && this.save.meta.totalRuns <= 2) this.ui?.showControlsHint();
    });
    log.info(`Этаж ${this.run.floor}: ${this.layout.rooms.length} комнат, seed ${this.run.seed}`);
  }

  // ------------------------------------------------------------------ цикл
  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    if (this.ended) { this.lighting.update(dt); return; }
    this.playTimer += delta;
    this.run.stats.timeMs += delta;
    this.controls.poll();

    if (this.controls.justPressed('pause')) { this.ui.openPause(); return; }
    if (this.controls.justPressed('inventory')) { this.ui.openInventory(); return; }
    if (this.controls.justPressed('map')) { this.ui.openMap(); return; }

    if (!this.transitioning) this.player.update(dt, this.controls);
    else this.player.body.setVelocity(0, 0);
    this.nav.update(dt, this.player.x, this.player.y);
    for (const e of this.combat.enemies) e.update(dt);
    this.combat.updatePickups(dt);
    this.combat.updateHazards(dt);
    this.lighting.update(dt);

    if (!this.transitioning) this.checkRoomChange();

    // взаимодействие
    const near = this.player.alive ? this.room.nearest(this.player.x, this.player.y) : null;
    this.ui.setPrompt(near ? near.promptText : null, near?.inspect);
    if (near && this.controls.justPressed('interact')) near.use();

    if (this.pendingLevels > 0 && !this.ui.modal && !this.transitioning && this.player.alive) this.openLevelUp();
  }

  checkRoomChange() {
    const p = this.player;
    const gx = Math.floor(p.x / ROOM_PX_W); const gy = Math.floor((p.y - 2) / ROOM_PX_H);
    const cur = this.room.data;
    if (gx === cur.gx && gy === cur.gy) return;
    const next = this.layout.rooms.find((r) => r.gx === gx && r.gy === gy);
    if (!next) return;
    const fromDir = gx > cur.gx ? 'W' : gx < cur.gx ? 'E' : gy > cur.gy ? 'N' : 'S';
    this.transitioning = true;
    this.combat.clearShots();
    // подобрать оставшиеся монеты прошлой комнаты
    this.combat.pickups.forEach((pk) => { if (pk.kind === 'coin' || pk.kind === 'heart') { this.combat.collect(pk); pk.destroy(); } });
    this.combat.pickups = this.combat.pickups.filter((pk) => pk.active);
    const nudge = { W: [10, 0], E: [-10, 0], N: [0, 12], S: [0, -12] }[fromDir];
    p.x += nudge[0]; p.y += nudge[1];
    this.tweens.add({
      targets: this.cameras.main, scrollX: next.gx * ROOM_PX_W, scrollY: next.gy * ROOM_PX_H, duration: 320, ease: 'Sine.InOut',
      onComplete: () => { this.transitioning = false; this.room.enter(next, fromDir); }
    });
  }

  hitstop(ms) {
    this.hitstopDepth++;
    this.physics.world.pause();
    this.time.delayedCall(ms, () => { this.hitstopDepth--; if (this.hitstopDepth <= 0 && !this.ended) this.physics.world.resume(); });
  }

  audioForRoom(room, hostile) {
    if ((room.type === 'boss' || room.type === 'miniboss') && hostile) audio.playMusic(room.type === 'boss' && this.floors.isFinalFloor(this.run.floor) ? 'finale' : 'boss');
    else if (room.type === 'rest' || room.type === 'secret' || room.type === 'shop') audio.playMusic('shrine');
    else audio.playMusic(BiomeManager.music(this.biome));
  }

  onHostileRoomCleared() { this.floorMgr.onRoomCleared(); }

  revealMap(includeSecret) {
    this.run.mapRevealed = true;
    for (const r of this.layout.rooms) if (r.type !== 'secret' || includeSecret) r.seen = true;
  }

  // ------------------------------------------------------------------ прогресс
  gainXp(n) {
    const run = this.run;
    run.xp += n;
    while (run.xp >= run.xpToNext()) {
      run.xp -= run.xpToNext();
      run.level++;
      this.pendingLevels++;
      audio.sfx('levelup');
      this.fx.glowBurst(this.player.x, this.player.y - 6, 0x62d6ff, 24);
      this.fx.ring(this.player.x, this.player.y - 4, 30, 0x62d6ff, 400);
    }
  }

  openLevelUp() {
    this.pendingLevels--;
    const opts = this.items.rollUpgrades(new RNG(this.run.seed + this.run.level * 31), this.run.classId, 3);
    this.ui.choice({
      title: `Уровень ${this.run.level}!`, text: 'Выберите улучшение на этот забег:', upgrades: opts,
      choices: opts.map((u) => ({ label: `${u.name} — ${u.desc}`, icon: { key: 'upgrades', frame: u.id }, color: u.color }))
    }, (i) => {
      const u = opts[i];
      this.run.upgrades.push(u.id);
      this.player.refreshStats();
      if (u.heal) {
        const amt = typeof u.heal === 'string' ? Math.round(this.player.stats.maxHp * parseFloat(u.heal) / 100) : u.heal;
        this.combat.healPlayer(amt);
      }
      this.ui.toast(u.name, u.color);
    });
  }

  grantItem(item, x, y) {
    const run = this.run; const meta = this.save.meta;
    const setsBefore = this.items.activeSets(run);
    run.items.push(item.id);
    run.stats.itemsFound++;
    const firstTime = !meta.itemsFound[item.id];
    meta.itemsFound[item.id] = true;
    if (RARITY[item.rarity].tier >= 2) meta.rareItemsFound++;
    this.player.refreshStats();
    if (this.player.stats.reveal) this.revealMap(true);
    audio.sfx('item');
    const col = hex(RARITY[item.rarity].color);
    this.fx.glowBurst(x ?? this.player.x, (y ?? this.player.y) - 6, col, 26);
    this.fx.ring(this.player.x, this.player.y - 4, 26, col, 400);
    this.ui.itemCard(item, firstTime);
    const setsAfter = this.items.activeSets(run);
    for (const s of setsAfter) if (!setsBefore.includes(s)) this.time.delayedCall(900, () => { this.ui.banner(`СЕТ «${GD.sets[s].name.toUpperCase()}»`, '#ffd24a', GD.sets[s].desc); audio.sfx('levelup'); });
    this.saveMeta();
  }

  saveMeta() {
    this.save.meta.totalPlayMs += this.playTimer; this.playTimer = 0;
    saveSystem.save();
  }

  /** Контрольная точка в начале этажа. */
  checkpoint() {
    this.run.hp = this.player.hp;
    this.save.run = this.run.serialize();
    this.save.meta.bestFloor = Math.max(this.save.meta.bestFloor, this.run.floor);
    this.save.meta.chapterReached = Math.max(this.save.meta.chapterReached || 1, Math.min(6, Math.ceil(Math.min(this.run.floor, MAIN_FLOORS) / 5)));
    saveSystem.save();
  }

  nextFloor() {
    if (this.ended) return;
    this.ended = true;
    audio.sfx('stairs');
    this.run.stats.floorsCleared++;
    this.run.floor++;
    this.run.hp = this.player.hp;
    this.run.counters = {};
    analytics.track('floor_reached', { floor: this.run.floor });
    this.cameras.main.fadeOut(500, 7, 6, 11);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ mode: 'floor', run: this.run });
    });
  }

  onPlayerDeath() {
    if (this.ended) return;
    this.ended = true;
    this.player.die();
    audio.stopMusic(1.5);
    audio.sfx('defeat');
    this.ui.closeAll();
    this.cameras.main.shake(300, 0.01);
    this.tweens.add({ targets: this.cameras.main, zoom: 1.4, duration: 1400, ease: 'Sine.InOut' });
    this.combat.enemies.forEach((e) => { if (e.body) e.body.setVelocity(0, 0); });
    this.time.delayedCall(1700, () => this.endRun(false));
  }

  /** Завершение забега: начисление постоянных наград ровно один раз. */
  endRun(victory) {
    this.ended = true;
    platform.gameplayStopped();
    const run = this.run; const meta = this.save.meta;
    const st = run.stats;
    const completed = victory && run.floor >= MAIN_FLOORS;
    const shards = Math.round(run.floor * 4 + st.kills * 0.15 + st.bossesKilled * 8 + st.secrets * 3 + run.shardsBonus + (victory ? 25 : 0) + (completed ? 80 : 0));
    const claimId = `run:${run.runId}:end`;
    const fresh = saveSystem.claimOnce(claimId);
    if (fresh) {
      meta.shards += shards;
      meta.finishedRuns++;
      if (completed) meta.completions = (meta.completions || 0) + 1;
      meta.totalPlayMs += this.playTimer; this.playTimer = 0;
      const score = run.floor * 1000 + st.kills;
      if (!meta.bestRun || score > meta.bestRun.score) meta.bestRun = { score, floor: run.floor, cls: run.classId, kills: st.kills, timeMs: st.timeMs, victory };
      if (completed && (!meta.bestClearMs || st.timeMs < meta.bestClearMs)) meta.bestClearMs = st.timeMs;
    }
    this.save.run = null;
    saveSystem.save();
    analytics.track('run_end', { floor: run.floor, kills: st.kills, victory, cls: run.classId });
    this.scene.stop('UI');
    this.scene.start('Result', { run: run.serialize(), shards, victory, completed: completed || run.completed, claimId, fresh });
  }

  /** Выход в меню с сохранением прогресса на начале этажа. */
  quitToMenu() {
    this.ended = true;
    this.saveMeta();
    this.scene.stop('UI');
    audio.stopMusic(0.5);
    this.scene.start('Menu');
  }
}
