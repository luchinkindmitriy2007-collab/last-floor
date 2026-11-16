import { platform } from './Platform.js';
import Phaser from 'phaser';
import { txt, Button, FocusGroup, panel } from './Widgets.js';
import { openSettings, openChronicle } from './Panels.js';
import { saveSystem } from './SaveSystem.js';
import { RunState } from './RunState.js';
import { audio } from './AudioSystem.js';
import { GD } from './GameData.js';
import { GAME_W, GAME_H, COLORS } from './Constants.js';
import { fxRand } from './Random.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.cameras.main.fadeIn(500, 7, 6, 11);
    this.buildBackground();
    this.buildMain();
    audio.playMusic('menu');
    platform.gameplayStopped();
    platform.gameReady();
    // первый клик/клавиша разблокирует звук и запустит музыку
    this.input.once('pointerdown', () => audio.playMusic('menu'));
  }

  buildBackground() {
    // небо с градиентом
    const sky = this.textures.exists('menu_sky') ? null : this.textures.createCanvas('menu_sky', GAME_W, GAME_H);
    if (sky) {
      const c = sky.getContext();
      const grd = c.createLinearGradient(0, 0, 0, GAME_H);
      grd.addColorStop(0, '#0a0814'); grd.addColorStop(0.6, '#161226'); grd.addColorStop(1, '#0c1a14');
      c.fillStyle = grd; c.fillRect(0, 0, GAME_W, GAME_H);
      // далёкие горы
      c.fillStyle = '#0e0c18';
      for (let x = 0; x < GAME_W; x++) { const h = 40 + Math.sin(x * 0.02) * 14 + Math.sin(x * 0.07) * 6; c.fillRect(x, GAME_H - h, 1, h); }
      c.fillStyle = '#090812';
      for (let x = 0; x < GAME_W; x++) { const h = 22 + Math.sin(x * 0.035 + 2) * 8 + Math.sin(x * 0.11) * 3; c.fillRect(x, GAME_H - h, 1, h); }
      sky.refresh();
    }
    this.add.image(0, 0, 'menu_sky').setOrigin(0);
    // звёзды
    for (let i = 0; i < 70; i++) {
      const s = this.add.rectangle(fxRand(0, GAME_W), fxRand(0, GAME_H * 0.6), 1, 1, 0xf2e6c9).setAlpha(fxRand(0.2, 0.9));
      this.tweens.add({ targets: s, alpha: 0.1, duration: fxRand(800, 2400), yoyo: true, repeat: -1, delay: fxRand(0, 2000) });
    }
    // башня со свечением
    const tx = 120;
    this.add.image(tx, GAME_H - 6, 'glow').setTint(0x7cff8a).setAlpha(0.12).setScale(4).setBlendMode(Phaser.BlendModes.ADD);
    const tower = this.add.image(tx, GAME_H + 4, 'tower').setOrigin(0.5, 1);
    const beacon = this.add.image(tx, GAME_H + 4 - 218, 'glow').setTint(0xb8ffc4).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8);
    this.tweens.add({ targets: beacon, scale: 1.2, alpha: 0.6, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    void tower;
    // туман и светлячки
    this.add.particles(0, 0, 'glow', {
      x: { min: 0, max: GAME_W }, y: { min: GAME_H - 40, max: GAME_H }, lifespan: 7000, speedX: { min: -6, max: 6 }, speedY: { min: -6, max: -1 },
      scale: { start: 0.6, end: 1.4 }, alpha: { start: 0.07, end: 0 }, tint: 0x9a8ab0, frequency: 220
    });
    this.add.particles(0, 0, 'px1', {
      x: { min: 30, max: 220 }, y: { min: 60, max: GAME_H }, lifespan: 4000, speed: { min: 4, max: 14 },
      alpha: { start: 1, end: 0 }, tint: [0x7cff8a, 0xd6ffb0], frequency: 260, blendMode: 'ADD'
    });
  }

  clearUI() { this.ui?.destroy(); this.group?.destroy(); }

  buildMain() {
    this.clearUI();
    const c = this.add.container(0, 0); this.ui = c;
    const title = txt(this, 352, 40, 'LAST FLOOR', { origin: 0.5, scale: 3, color: '#f2e6c9' });
    const sub = txt(this, 352, 64, 'БАШНЯ БЕЗ КОНЦА', { origin: 0.5, color: '#7cff8a' });
    const tglow = this.add.image(352, 42, 'glow').setTint(0x7cff8a).setAlpha(0.18).setScale(3.4, 0.9).setBlendMode(Phaser.BlendModes.ADD);
    c.add([tglow, title, sub]);
    this.tweens.add({ targets: title, y: 38, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const save = saveSystem.data;
    const run = RunState.deserialize(save.run);
    const items = [];
    const add = (label, fn, opts) => { const b = new Button(this, 352, 96 + items.length * 22, 150, 18, label, fn, opts); c.add(b); items.push(b); return b; };
    if (run) add(`Продолжить (этаж ${run.floor})`, () => this.startGame({ mode: 'continue', run }), { color: '#7cff8a' });
    add('Новый забег', () => this.buildClassSelect(!!run));
    add('Летопись', () => { this.group.disabled = true; openChronicle(this, () => { this.group.disabled = false; }); });
    add('Настройки', () => { this.group.disabled = true; openSettings(this, () => { this.group.disabled = false; this.buildMain(); }); });
    this.group = new FocusGroup(this, items);
    const meta = save.meta;
    c.add(txt(this, 352, 96 + items.length * 22 + 6, meta.bestFloor ? `Рекорд: этаж ${meta.bestFloor}   Осколки: ${meta.shards}` : 'Башня ждёт первого восхождения', { origin: 0.5, color: COLORS.dim }));
    c.add(txt(this, GAME_W - 4, GAME_H - 10, 'v0.3 · 30 этажей', { origin: [1, 0], color: '#4a4058' }));
    items.forEach((b, i) => { b.setAlpha(0); b.x += 20; this.tweens.add({ targets: b, alpha: 1, x: b.x - 20, duration: 250, delay: 150 + i * 70, ease: 'Cubic.Out' }); });
  }

  buildClassSelect(hasRun) {
    this.clearUI();
    const c = this.add.container(0, 0); this.ui = c;
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040a, 0.55).setOrigin(0));
    c.add(txt(this, GAME_W / 2, 18, 'Выберите героя', { origin: 0.5, scale: 2, color: COLORS.gold }));
    if (hasRun) c.add(txt(this, GAME_W / 2, 34, 'Текущий забег будет завершён', { origin: 0.5, color: '#ff9a9a' }));
    const ids = Object.keys(GD.classes);
    const cards = [];
    ids.forEach((id, i) => {
      const cl = GD.classes[id];
      const x = GAME_W / 2 + (i - 1) * 150; const y = 140;
      const card = this.add.container(x, y);
      const bg = this.add.nineslice(0, 0, 'panel', undefined, 140, 176, 6, 6, 6, 6);
      const glow = this.add.image(0, -44, 'glow').setTint([0x8ab8ff, 0x7cff8a, 0xb884ff][i]).setAlpha(0.3).setScale(1.2).setBlendMode(Phaser.BlendModes.ADD);
      const hero = this.add.sprite(0, -40, cl.texture, 0).setScale(3);
      hero.play(`hero_${id}_idle`);
      const weapon = this.add.image(14, -40, cl.weapon).setScale(2).setRotation(Math.PI / 4).setOrigin(0.2, 0.8);
      const name = txt(this, 0, -6, cl.name, { origin: 0.5, scale: 1, color: '#f2e6c9' });
      const role = txt(this, 0, 5, cl.role, { origin: 0.5, color: COLORS.dim });
      card.add([bg, glow, hero, weapon, name, role]);
      const bars = [['Атака', cl.rating.attack, 0xe05a4a], ['Защита', cl.rating.defense, 0x5d8ad8], ['Скорость', cl.rating.speed, 0x7cff8a]];
      bars.forEach(([lbl, v, col], j) => {
        card.add(txt(this, -60, 18 + j * 11, lbl, { color: COLORS.dim }));
        for (let k = 0; k < 5; k++) card.add(this.add.rectangle(4 + k * 11, 22 + j * 11, 9, 5, k < v ? col : 0x2a2236).setOrigin(0, 0.5));
      });
      card.add(txt(this, 0, 58, `${cl.ability.name}`, { origin: 0.5, color: '#9ad8ff' }));
      card.add(txt(this, 0, 64, wrapShort(cl.ability.desc, 21), { origin: [0.5, 0], color: COLORS.dim }));
      card.setSize(140, 176).setInteractive({ useHandCursor: true });
      card.on('pointerover', () => select(i));
      card.on('pointerdown', () => { select(i); confirm(); });
      card.hero = hero; card.bg = bg; card.glow = glow;
      c.add(card);
      cards.push(card);
    });
    let sel = Math.max(0, ids.indexOf(saveSystem.data.meta.lastClass));
    const select = (i) => {
      if (sel !== i) audio.sfx('uiMove');
      sel = i;
      cards.forEach((cd, j) => {
        const on = j === i;
        cd.bg.setTexture(on ? 'btn_hl' : 'panel');
        this.tweens.add({ targets: cd, scale: on ? 1.04 : 0.96, alpha: on ? 1 : 0.7, duration: 120 });
        cd.hero.play(on ? `hero_${ids[j]}_walk` : `hero_${ids[j]}_idle`, true);
      });
    };
    const confirm = () => {
      audio.sfx('uiOk');
      this.startGame({ mode: 'new', classId: ids[sel] });
    };
    select(sel);
    const back = new Button(this, 60, GAME_H - 16, 80, 16, 'Назад', () => this.buildMain());
    const go = new Button(this, GAME_W - 70, GAME_H - 16, 110, 16, 'В башню!', confirm, { color: '#7cff8a' });
    c.add([back, go]);
    this.group = new FocusGroup(this, [back, go], { onBack: () => this.buildMain() });
    this.group.focus(go);
    // стрелки влево/вправо выбирают героя
    const onKey = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') select((sel + ids.length - 1) % ids.length);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') select((sel + 1) % ids.length);
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') select(Number(e.code.slice(-1)) - 1);
    };
    this.group.move = () => {};
    this.input.keyboard.on('keydown', onKey);
    c.once('destroy', () => this.input.keyboard.off('keydown', onKey));
  }

  startGame(data) {
    if (this.starting) return;
    this.starting = true;
    if (data.mode === 'new') {
      saveSystem.data.run = null;
      data.run = new RunState({ classId: data.classId });
    }
    audio.stopMusic(0.6);
    this.cameras.main.fadeOut(400, 7, 6, 11);
    this.cameras.main.once('camerafadeoutcomplete', () => { this.starting = false; this.scene.start('Game', data); });
  }
}

function wrapShort(s, n) {
  const words = s.split(' '); const out = []; let line = '';
  for (const w of words) { if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
  out.push(line);
  return out.slice(0, 4).join('\n');
}
