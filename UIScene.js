import Phaser from 'phaser';
import { txt, setTxt, panel, Button, FocusGroup, Bar, wrap } from './Widgets.js';
import { createModal, openSettings } from './Panels.js';
import { GD } from './GameData.js';
import { audio } from './AudioSystem.js';
import { GAME_W, GAME_H, HUD_H, RARITY, COLORS, hex } from './Constants.js';
import { fmtPct } from './Helpers.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  init(data) { this.g = data.game; }

  bind(game) {
    this.g = game;
    this.closeAll();
    this.bossBar(null);
    this.minimapKey = '';
  }

  create() {
    this.modal = null;
    this.toasts = [];
    this.buildHud();
    this.events.on('shutdown', () => { this.modal?.close(); });
  }

  // ------------------------------------------------------------------ HUD
  buildHud() {
    panel(this, -4, -4, GAME_W + 8, HUD_H + 4, 'panel_dark');
    this.add.image(8, 7, 'heart');
    this.hpBar = new Bar(this, 15, 4, 78, 6, COLORS.hp, COLORS.hpBack);
    this.hpText = txt(this, 54, 3, '', { origin: [0.5, 0], color: '#ffffff' }).setScale(1);
    this.hpText.setDepth(5);
    this.lvlText = txt(this, 100, 3, '');
    this.xpBar = new Bar(this, 100, 11, 40, 1, COLORS.xp, '#0e1a24');
    this.add.image(152, 7, 'coin');
    this.goldText = txt(this, 159, 3, '', { color: COLORS.gold });
    this.add.image(194, 7, 'hud_icons', 'potion');
    this.potText = txt(this, 201, 3, '');
    this.floorText = txt(this, GAME_W - 6, 3, '', { origin: [1, 0], color: COLORS.dim });
    this.sealText = txt(this, 226, 3, '', { color: '#c8b8ff' });

    // способность (левый нижний угол игрового поля)
    const ay = GAME_H - 22;
    this.abilityBg = this.add.nineslice(16, ay, 'slot', undefined, 22, 22, 4, 4, 4, 4);
    this.abilityIcon = this.add.image(16, ay, 'ability_icons', 'guardian');
    this.abilityCd = this.add.rectangle(5, ay + 10, 22, 0, 0x05040a, 0.75).setOrigin(0, 1);
    this.abilityKey = txt(this, 30, ay + 2, 'SHIFT', { color: COLORS.dim });
    this.buffText = txt(this, 30, ay - 8, '', { color: '#c49aff' });

    // мини-карта
    this.mm = this.add.graphics();
    this.mmIcons = this.add.container(0, 0);

    // подсказка взаимодействия
    this.promptBg = this.add.nineslice(GAME_W / 2, GAME_H - 18, 'panel_dark', undefined, 120, 15, 5, 5, 5, 5).setVisible(false);
    this.promptText = txt(this, GAME_W / 2, GAME_H - 19, '', { origin: 0.5 });
    this.inspectText = txt(this, GAME_W / 2, GAME_H - 34, '', { origin: 0.5, color: COLORS.dim, maxWidth: 300 });

    // полоса босса
    this.bossBox = this.add.container(0, 0).setVisible(false);
    this.bossName = txt(this, GAME_W / 2, GAME_H - 40, '', { origin: 0.5, color: '#ff9a7a' });
    this.bossBarObj = new Bar(this, GAME_W / 2 - 110, GAME_H - 31, 220, 5, '#d8483a', '#2a1014');
    this.bossBarObj.setVisible(false);

    // виньетка урона
    this.vignette = this.add.graphics().setAlpha(0).setDepth(50);
    const v = this.vignette;
    for (let i = 0; i < 10; i++) { v.lineStyle(2, 0xc02030, 0.5 - i * 0.05); v.strokeRect(i * 2, HUD_H + i * 2, GAME_W - i * 4, GAME_H - HUD_H - i * 4); }

    this.toastLayer = this.add.container(0, 0).setDepth(60);
    this.bannerLayer = this.add.container(0, 0).setDepth(70);
  }

  update(time, delta) {
    const g = this.g; if (!g || !g.player || !g.sys.isActive() && !g.sys.isPaused()) return;
    const dt = delta / 1000;
    const p = g.player; const run = g.run;
    this.hpBar.set(p.hp / p.stats.maxHp); this.hpBar.update(dt);
    setTxt(this.hpText, `${Math.max(0, Math.ceil(p.hp))}/${p.stats.maxHp}`);
    setTxt(this.lvlText, `УР ${run.level}`);
    this.xpBar.set(run.xp / run.xpToNext()); this.xpBar.update(dt);
    setTxt(this.goldText, `${run.gold}`);
    setTxt(this.potText, `${run.potions}`);
    setTxt(this.floorText, g.floorMgr ? g.floorMgr.label() : `ЭТАЖ ${run.floor}`);
    if (g.floorMgr) setTxt(this.sealText, g.floorMgr.sealText(), g.floorMgr.sealsOpen ? '#7cff8a' : '#c8b8ff');
    // способность
    this.abilityIcon.setFrame(g.cls.id);
    const cdMax = g.cls.ability.cd * (1 - p.stats.cdr);
    const frac = Phaser.Math.Clamp(p.abilityTimer / cdMax, 0, 1);
    this.abilityCd.height = Math.round(20 * frac);
    this.abilityIcon.setAlpha(frac > 0 ? 0.6 : 1);
    if (frac <= 0 && this.lastFrac > 0) this.tweens.add({ targets: this.abilityBg, scale: 1.2, duration: 90, yoyo: true });
    this.lastFrac = frac;
    const buffs = [];
    if (p.barrier > 0) buffs.push('БАРЬЕР');
    if (p.shield > 0) buffs.push(`ЩИТ ×${p.shield}`);
    if (p.buffs.length) buffs.push(`УРОН ${fmtPct(p.buffValue('damage'))}`);
    if (p.roomStacks.atkSpeed) buffs.push(`АТК ${fmtPct(p.roomStacks.atkSpeed)}`);
    if (p.burnUntil > this.g.time.now) buffs.push('ГОРЕНИЕ');
    if (p.slowUntil > this.g.time.now) buffs.push('ЗАМЕДЛЕНИЕ');
    setTxt(this.buffText, buffs.join('  '));
    if (this.bossTarget) { this.bossBarObj.set(this.bossTarget.hp / this.bossTarget.maxHp); this.bossBarObj.update(dt); }
    this.drawMinimap();
  }

  drawMinimap(big = false, gfx = this.mm, iconLayer = this.mmIcons, origin) {
    const g = this.g; const L = g.layout; const cur = g.room.data;
    const key = `${cur.id}|${L.rooms.map((r) => `${r.seen ? 1 : 0}${r.visited ? 1 : 0}${r.cleared ? 1 : 0}${r.secretDoors ? Object.values(r.secretDoors).join('') : ''}`).join('')}`;
    if (!big && key === this.minimapKey) return;
    if (!big) this.minimapKey = key;
    gfx.clear(); iconLayer.removeAll(true);
    const cw = big ? 26 : 9; const ch = big ? 16 : 6; const gap = big ? 6 : 2;
    const seen = L.rooms.filter((r) => r.seen || r.visited);
    const minX = Math.min(...seen.map((r) => r.gx)); const maxX = Math.max(...seen.map((r) => r.gx));
    const minY = Math.min(...seen.map((r) => r.gy));
    const ox = origin ? origin.x - ((maxX - minX + 1) * (cw + gap)) / 2 : GAME_W - 6 - (maxX - minX + 1) * (cw + gap);
    const oy = origin ? origin.y : HUD_H + 4;
    const pos = (r) => [ox + (r.gx - minX) * (cw + gap), oy + (r.gy - minY) * (ch + gap)];
    if (!big) { const w = (maxX - minX + 1) * (cw + gap) + 4; const h = (Math.max(...seen.map((r) => r.gy)) - minY + 1) * (ch + gap) + 4; gfx.fillStyle(0x07060b, 0.55).fillRect(ox - 3, oy - 3, w, h); }
    // переходы
    gfx.lineStyle(1, 0x5b4a6e, 1);
    for (const r of seen) {
      const [x, y] = pos(r);
      for (const [dk, id] of Object.entries(r.doors)) {
        if (id === null || (r.secretDoors[dk])) continue;
        const o = L.byId.get(id); if (!(o.seen || o.visited)) continue;
        if (dk === 'E') gfx.lineBetween(x + cw, y + ch / 2, x + cw + gap, y + ch / 2);
        if (dk === 'S') gfx.lineBetween(x + cw / 2, y + ch, x + cw / 2, y + ch + gap);
      }
    }
    const typeColor = { boss: 0xe0404a, shop: 0xffd24a, treasure: 0xffd24a, chest: 0xd8a050, rest: 0x5fb0ff, event: 0xb884ff, challenge: 0xff9a4a, secret: 0x62d6ff, start: 0x7cff8a, exit: 0x7cff8a, miniboss: 0xff6ad0 };
    for (const r of seen) {
      const [x, y] = pos(r);
      const isCur = r === cur;
      const fill = isCur ? 0xf2e6c9 : r.visited ? (r.cleared || !['combat', 'challenge', 'boss'].includes(r.type) ? 0x4a405a : 0x6a3a44) : 0x221c2c;
      gfx.fillStyle(fill, 1).fillRect(x, y, cw, ch);
      gfx.lineStyle(1, isCur ? 0xffffff : 0x3a3046, 1).strokeRect(x - 0.5, y - 0.5, cw + 1, ch + 1);
      if (r.type !== 'combat' && typeColor[r.type] && (big || r.type !== 'start')) {
        const ic = this.add.image(x + cw / 2, y + ch / 2, 'mm_icons', r.type).setTint(isCur ? 0x1a1220 : typeColor[r.type]);
        if (!big) ic.setScale(0.72);
        iconLayer.add(ic);
      }
    }
    return { ox, oy };
  }

  setPrompt(text, inspectItem) {
    const show = !!text && !this.modal;
    this.promptBg.setVisible(show);
    this.promptText.setVisible(show);
    if (show) {
      setTxt(this.promptText, `[E] ${text}`);
      this.promptBg.width = Math.min(GAME_W - 20, this.promptText.width + 16);
    }
    if (show && inspectItem) { setTxt(this.inspectText, `${inspectItem.desc}`, RARITY[inspectItem.rarity].color); this.inspectText.setVisible(true); } else this.inspectText.setVisible(false);
  }

  // ------------------------------------------------------------------ уведомления
  toast(text, color = COLORS.text) {
    const t = txt(this, GAME_W / 2, HUD_H + 26, text, { origin: 0.5, color });
    const bg = this.add.nineslice(GAME_W / 2, HUD_H + 26, 'panel_dark', undefined, t.width + 14, 14, 5, 5, 5, 5).setAlpha(0.9);
    const c = this.add.container(0, 0, [bg, t]);
    this.toastLayer.add(c);
    this.toasts.push(c);
    this.toasts.forEach((o, i) => this.tweens.add({ targets: o, y: (this.toasts.length - 1 - i) * 15, duration: 120 }));
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 120 });
    this.time.delayedCall(2200, () => this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => { this.toasts = this.toasts.filter((x) => x !== c); c.destroy(); } }));
    if (this.toasts.length > 4) { const old = this.toasts.shift(); old.destroy(); }
  }

  banner(title, color = COLORS.text, sub) {
    this.bannerLayer.removeAll(true);
    const y = 82;
    const line = this.add.rectangle(GAME_W / 2, y + 8, 260, 1, hex(color)).setAlpha(0.7).setScale(0, 1);
    const t = txt(this, GAME_W / 2, y, title, { origin: 0.5, color, scale: 2 });
    const parts = [line, t];
    if (sub) parts.push(txt(this, GAME_W / 2, y + 16, sub, { origin: 0.5, color: COLORS.dim }));
    this.bannerLayer.add(parts);
    parts.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: parts, alpha: 1, duration: 250 });
    this.tweens.add({ targets: line, scaleX: 1, duration: 400, ease: 'Cubic.Out' });
    this.tweens.add({ targets: t, scale: { from: 2.4, to: 2 }, duration: 300, ease: 'Back.Out' });
    this.time.delayedCall(2200, () => this.tweens.add({ targets: parts, alpha: 0, duration: 400 }));
  }

  bossIntro(name, title) {
    this.banner(name.toUpperCase(), '#ff9a7a', title);
  }

  bossBar(e) {
    this.bossTarget = e && e.alive ? e : null;
    const v = !!this.bossTarget;
    this.bossBarObj.setVisible(v); this.bossName.setVisible(v);
    if (v) setTxt(this.bossName, (GD.bosses[e.id] || GD.enemies[e.id]).name);
  }

  damageVignette() {
    this.tweens.killTweensOf(this.vignette);
    this.vignette.setAlpha(0.9);
    this.tweens.add({ targets: this.vignette, alpha: 0, duration: 450 });
  }

  itemCard(item, firstTime) {
    const r = RARITY[item.rarity];
    const c = this.add.container(8, GAME_H - 82).setDepth(65);
    const desc = wrap(item.desc, 34);
    const h = 30 + desc.split('\n').length * 11;
    const bg = panel(this, 0, 0, 220, h, 'panel');
    const slot = this.add.nineslice(16, 16, 'slot', undefined, 22, 22, 4, 4, 4, 4).setTint(hex(r.color));
    const icon = this.add.image(16, 16, 'items', item.id);
    const name = txt(this, 32, 6, item.name, { color: r.color });
    const rar = txt(this, 32, 16, `${r.name}${firstTime ? ' · новое!' : ''} · ${item.type}`, { color: COLORS.dim });
    const d = txt(this, 8, 28, desc);
    c.add([bg, slot, icon, name, rar, d]);
    c.y = GAME_H - h - 30;
    c.x = -230;
    this.tweens.add({ targets: c, x: 8, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: icon, scale: { from: 2, to: 1 }, duration: 400, ease: 'Bounce.Out' });
    this.time.delayedCall(3600, () => this.tweens.add({ targets: c, x: -230, duration: 220, onComplete: () => c.destroy() }));
  }

  showControlsHint() {
    const lines = 'WASD — движение   ЛКМ/ПРОБЕЛ — атака   ПКМ/SHIFT — способность\nE — взаимодействие   Q — зелье   TAB — инвентарь   M — карта   ESC — пауза';
    const t = txt(this, GAME_W / 2, GAME_H - 56, lines, { origin: 0.5, color: COLORS.dim });
    t.setCenterAlign?.();
    const bg = this.add.nineslice(GAME_W / 2, GAME_H - 56, 'panel_dark', undefined, t.width + 16, 28, 5, 5, 5, 5).setAlpha(0.85);
    this.children.bringToTop(t);
    this.time.delayedCall(7000, () => this.tweens.add({ targets: [t, bg], alpha: 0, duration: 600, onComplete: () => { t.destroy(); bg.destroy(); } }));
  }

  // ------------------------------------------------------------------ модальные окна
  openModal(m, { pause = true } = {}) {
    if (this.modal) this.modal.close();
    this.modal = m;
    if (pause && this.g.sys.isActive()) { this.g.scene.pause(); this.pausedByModal = true; }
    const prevClose = m.close;
    m.close = () => {
      prevClose();
      if (this.modal === m) this.modal = null;
      if (this.pausedByModal && !this.modal) { this.pausedByModal = false; this.g.scene.resume(); this.g.controls?.poll(); }
    };
    return m;
  }

  closeAll() { if (this.modal) this.modal.close(); }

  /** Универсальный выбор: события, уровни, решения. cb(index). */
  choice(cfg, cb) {
    const n = cfg.choices.length;
    const textWrapped = cfg.text ? wrap(cfg.text, 54) : '';
    const textLines = textWrapped ? textWrapped.split('\n').length : 0;
    const h = 44 + textLines * 11 + n * 22;
    const m = this.openModal(createModal(this, 350, h, cfg.title));
    if (cfg.text) m.add(txt(this, 175, 28, textWrapped, { origin: [0.5, 0], color: COLORS.text }));
    const y0 = 36 + textLines * 11 + 8;
    const buttons = cfg.choices.map((c, i) => m.add(new Button(this, 175, y0 + i * 22, 320, 18, c.label, () => { m.close(); cb(c.index ?? i); }, { enabled: c.enabled !== false, color: c.color, icon: c.icon })));
    const canLeave = !cfg.upgrades;
    m.group = new FocusGroup(this, buttons, { onBack: canLeave ? () => { m.close(); cb(n - 1); } : null });
    return m;
  }

  lore(title, text, isNew) {
    const body = wrap(text, 52);
    const m = this.openModal(createModal(this, 330, 64 + body.split('\n').length * 11, title));
    m.add(txt(this, 165, 30, body, { origin: [0.5, 0] }));
    if (isNew) m.add(txt(this, 165, 22, 'Новая страница летописи', { origin: 0.5, color: '#62d6ff' })).setY(m.h - 30);
    const ok = m.add(new Button(this, 165, m.h - 14, 80, 15, 'Далее', () => m.close()));
    m.group = new FocusGroup(this, [ok], { onBack: () => m.close() });
  }

  openPause() {
    const m = this.openModal(createModal(this, 180, 150, 'Пауза'));
    const b = [
      new Button(this, 90, 38, 150, 17, 'Продолжить', () => m.close()),
      new Button(this, 90, 60, 150, 17, 'Инвентарь', () => { m.close(); this.openInventory(); }),
      new Button(this, 90, 82, 150, 17, 'Карта этажа', () => { m.close(); this.openMap(); }),
      new Button(this, 90, 104, 150, 17, 'Настройки', () => { m.group.disabled = true; openSettings(this, () => { m.group.disabled = false; }); }),
      new Button(this, 90, 128, 150, 17, 'Выйти в меню', () => { m.close(); this.g.quitToMenu(); }, { color: '#ff9a9a' })
    ].map((x) => m.add(x));
    m.group = new FocusGroup(this, b, { onBack: () => m.close() });
  }

  openMap() {
    const m = this.openModal(createModal(this, 400, 230, `Карта — этаж ${this.g.run.floor}. ${this.g.floorMgr?.sealText() || ''}`));
    const gfx = this.add.graphics(); const icons = this.add.container(0, 0);
    m.add(gfx); m.add(icons);
    this.drawMinimap(true, gfx, icons, { x: 200, y: 32 });
    const legend = [['boss', 'Босс', 0xe0404a], ['exit', 'Выход', 0x7cff8a], ['miniboss', 'Мини-босс', 0xff6ad0], ['treasure', 'Сокровища', 0xffd24a], ['shop', 'Торговец', 0xffd24a], ['rest', 'Отдых', 0x5fb0ff], ['event', 'Событие', 0xb884ff], ['challenge', 'Испытание', 0xff9a4a], ['secret', 'Тайник', 0x62d6ff]];
    legend.forEach(([k, label, col], i) => { const lx = 22 + (i % 5) * 72; const ly = 192 + Math.floor(i / 5) * 13; m.add(this.add.image(lx, ly + 4, 'mm_icons', k).setTint(col)); m.add(txt(this, lx + 7, ly, label, { color: COLORS.dim })); });
    const close = m.add(new Button(this, 370, 170, 44, 14, 'OK', () => m.close()));
    m.group = new FocusGroup(this, [close], { onBack: () => m.close() });
    const mk = this.input.keyboard.addKey('M');
    mk.once('down', () => { if (!m.closed) m.close(); });
  }

  openInventory() {
    const g = this.g; const run = g.run; const p = g.player; const st = p.stats;
    const m = this.openModal(createModal(this, 420, 236, `Инвентарь — ${g.cls.name}`));
    // характеристики
    const stats = [
      ['Здоровье', `${Math.ceil(p.hp)}/${st.maxHp}`],
      ['Урон', `${Math.round(st.damageBase * st.damageMult)}`],
      ['Атак в секунду', (1 / p.attackCooldown()).toFixed(2)],
      ['Скорость', `${Math.round(st.moveMult * 100)}%`],
      ['Шанс крита', `${Math.round(st.crit * 100)}%`],
      ['Урон крита', `×${st.critMult.toFixed(2)}`],
      ['Защита', `${Math.round(st.armor * 100)}%`],
      ['Перезарядка', `-${Math.round(st.cdr * 100)}%`],
      ['Пронзание', `${st.pierce}`],
      ['Удача', `${st.luck}`],
      ['Золото', `×${st.goldMult.toFixed(2)}`]
    ];
    m.add(txt(this, 16, 28, 'Характеристики', { color: COLORS.gold }));
    stats.forEach(([k, v], i) => { m.add(txt(this, 16, 40 + i * 11, k, { color: COLORS.dim })); m.add(txt(this, 150, 40 + i * 11, v, { origin: [1, 0] })); });
    m.add(txt(this, 16, 168, `Способность: ${g.cls.ability.name}`, { color: '#9ad8ff' }));
    m.add(txt(this, 16, 178, wrap(g.cls.ability.desc, 24).split('\n').slice(0, 3).join('\n'), { color: COLORS.dim }));

    // предметы
    m.add(txt(this, 168, 28, `Предметы (${run.items.length})`, { color: COLORS.gold }));
    const info = m.add(txt(this, 168, 168, run.items.length ? 'Наведите на предмет' : 'Пока пусто. Ищите сундуки,\nтайники и торговцев.', { color: COLORS.dim }));
    const showInfo = (title, color, body) => { setTxt(info, `${title}\n${wrap(body, 40)}`, color); };
    const slots = [];
    run.items.forEach((id, i) => {
      const it = GD.items[id]; const r = RARITY[it.rarity];
      const x = 180 + (i % 10) * 23; const y = 50 + Math.floor(i / 10) * 23;
      const slot = m.add(this.add.nineslice(x, y, 'slot', undefined, 21, 21, 4, 4, 4, 4).setTint(hex(r.color)));
      m.add(this.add.image(x, y, 'items', id));
      slot.setInteractive();
      slot.on('pointerover', () => showInfo(`${it.name} · ${r.name}`, r.color, it.desc));
      slots.push(slot);
    });
    // улучшения уровней, проклятия, сеты
    let y = 50 + Math.ceil(Math.max(1, run.items.length) / 10) * 23 + 4;
    if (run.upgrades.length) {
      m.add(txt(this, 168, y, 'Улучшения', { color: COLORS.gold })); y += 12;
      run.upgrades.forEach((u, i) => {
        const x = 176 + (i % 14) * 16;
        const ic = m.add(this.add.image(x, y + 6 + Math.floor(i / 14) * 16, 'upgrades', u));
        ic.setInteractive(); ic.on('pointerover', () => showInfo(GD.upgrades[u].name, GD.upgrades[u].color, GD.upgrades[u].desc));
      });
      y += 18 + Math.floor((run.upgrades.length - 1) / 14) * 16;
    }
    const sets = g.items.activeSets(run);
    const tags = [];
    sets.forEach((s) => tags.push([`Сет «${GD.sets[s].name}»: ${GD.sets[s].desc}`, '#ffd24a']));
    run.curses.forEach((c) => { const cu = GD.curses.find((x) => x.id === c); tags.push([`${cu.name}: ${cu.desc}`, '#b066ea']); });
    tags.slice(0, 4).forEach(([t, col], i) => m.add(txt(this, 168, y + i * 10, t, { color: col })));
    m.add(txt(this, 16, 222, `Зелья: ${run.potions}   Золото: ${run.gold}   Осколки за забег: ~${run.shardsBonus}`, { color: COLORS.dim }));
    const close = m.add(new Button(this, 390, 220, 44, 14, 'OK', () => m.close()));
    m.group = new FocusGroup(this, [close], { onBack: () => m.close() });
    const k = this.input.keyboard.addKey('TAB'); const k2 = this.input.keyboard.addKey('I');
    const shut = () => { if (!m.closed) m.close(); };
    k.once('down', shut); k2.once('down', shut);
  }
}
