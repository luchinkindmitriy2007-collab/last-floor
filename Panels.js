import Phaser from 'phaser';
import { txt, setTxt, panel, Button, FocusGroup, wrap } from './Widgets.js';
import { saveSystem } from './SaveSystem.js';
import { audio } from './AudioSystem.js';
import { analytics } from './AnalyticsManager.js';
import { GD } from './GameData.js';
import { GAME_W, GAME_H, RARITY, COLORS, hex } from './Constants.js';
import { fmtTime } from './Helpers.js';

/** Модальное окно с затемнением и анимацией появления. */
export function createModal(scene, w, h, title, { depth = 9000, onClose } = {}) {
  const x = Math.round((GAME_W - w) / 2); const y = Math.round((GAME_H - h) / 2);
  const c = scene.add.container(0, 0).setDepth(depth);
  const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040a, 0.72).setOrigin(0).setInteractive();
  const box = scene.add.container(x, y);
  const bg = panel(scene, 0, 0, w, h, 'panel');
  box.add(bg);
  if (title) {
    const t = txt(scene, w / 2, 8, title, { origin: [0.5, 0], color: COLORS.gold });
    const line = scene.add.rectangle(10, 20, w - 20, 1, 0x5b4a6e).setOrigin(0);
    box.add([t, line]);
  }
  c.add([dim, box]);
  dim.setAlpha(0); scene.tweens.add({ targets: dim, alpha: 1, duration: 150 });
  box.setScale(0.9).setAlpha(0);
  box.x += w * 0.05; box.y += h * 0.05;
  scene.tweens.add({ targets: box, scale: 1, alpha: 1, x, y, duration: 180, ease: 'Back.Out' });
  const m = {
    root: c, box, x, y, w, h,
    add: (o) => { box.add(o); return o; },
    close: () => { if (m.closed) return; m.closed = true; m.group?.destroy(); c.destroy(); onClose && onClose(); }
  };
  return m;
}

/** Настройки: громкость, тряска, числа урона, полный экран, сброс. */
export function openSettings(scene, onClose) {
  const s = saveSystem.data.settings;
  const m = createModal(scene, 260, 196, 'Настройки', { depth: 9500, onClose });
  const rows = [];
  const pct = (v) => `${Math.round(v * 100)}%`;
  const mkRow = (y, label, get, change) => {
    m.add(txt(scene, 20, y, label, { origin: [0, 0.5] }));
    const val = m.add(txt(scene, 182, y, get(), { origin: 0.5, color: COLORS.gold }));
    const minus = m.add(new Button(scene, 150, y, 18, 14, '-', () => { change(-1); setTxt(val, get()); }));
    const plus = m.add(new Button(scene, 214, y, 18, 14, '+', () => { change(1); setTxt(val, get()); }));
    rows.push(minus, plus);
  };
  const vol = (key) => (d) => { s[key] = Math.round(Phaser.Math.Clamp(s[key] + d * 0.1, 0, 1) * 10) / 10; audio.setVolumes(s.music, s.sfx); if (key === 'sfx') audio.sfx('coin'); saveSystem.save(); };
  mkRow(36, 'Музыка', () => pct(s.music), vol('music'));
  mkRow(56, 'Звуки', () => pct(s.sfx), vol('sfx'));
  const toggle = (y, label, key) => {
    m.add(txt(scene, 20, y, label, { origin: [0, 0.5] }));
    const b = m.add(new Button(scene, 182, y, 64, 14, s[key] ? 'Вкл' : 'Выкл', () => { s[key] = !s[key]; b.setLabel(s[key] ? 'Вкл' : 'Выкл'); saveSystem.save(); }));
    rows.push(b);
  };
  toggle(76, 'Тряска экрана', 'shake');
  toggle(96, 'Числа урона', 'damageNumbers');
  toggle(116, 'Освещение', 'lighting');
  m.add(txt(scene, 20, 136, 'Полный экран', { origin: [0, 0.5] }));
  const fs = m.add(new Button(scene, 182, 136, 64, 14, scene.scale.isFullscreen ? 'Вкл' : 'Выкл', () => {
    if (scene.scale.isFullscreen) scene.scale.stopFullscreen(); else scene.scale.startFullscreen();
    scene.time.delayedCall(200, () => fs.setLabel(scene.scale.isFullscreen ? 'Вкл' : 'Выкл'));
  }));
  rows.push(fs);
  let resetArmed = false;
  const reset = m.add(new Button(scene, 76, 172, 100, 16, 'Сброс прогресса', () => {
    if (!resetArmed) { resetArmed = true; reset.setLabel('Точно? Ещё раз', '#ff5a5a'); return; }
    saveSystem.resetAll(); audio.sfx('defeat'); reset.setLabel('Сброшено', COLORS.dim); reset.setEnabled(false);
  }, { color: '#ff9a9a' }));
  const back = m.add(new Button(scene, 190, 172, 100, 16, 'Готово', () => m.close()));
  m.group = new FocusGroup(scene, [...rows, reset, back], { onBack: () => m.close() });
  m.group.focus(back);
  return m;
}

/** Летопись: рекорды, страницы истории башни, бестиарий, коллекция предметов. */
export function openChronicle(scene, onClose) {
  const m = createModal(scene, 380, 230, 'Летопись башни', { depth: 9500, onClose });
  const meta = saveSystem.data.meta;
  const tabs = ['Рекорды', 'История', 'Бестиарий', 'Предметы'];
  let content = scene.add.container(0, 0); m.add(content);
  const tabButtons = tabs.map((t, i) => m.add(new Button(scene, 52 + i * 92, 36, 86, 15, t, () => show(i))));
  let page = 0;
  const show = (i) => {
    content.destroy(); content = scene.add.container(0, 0); m.add(content);
    tabButtons.forEach((b, j) => b.setLabel(tabs[j], j === i ? COLORS.gold : COLORS.text));
    const put = (o) => content.add(o);
    if (i === 0) {
      const a = analytics.summary();
      const lines = [
        ['Лучший этаж', meta.bestFloor ? `${meta.bestFloor} (глава ${meta.chapterReached || 1})` : '—'],
        ['Прохождений башни', `${meta.completions || 0}${meta.bestClearMs ? ` · лучшее время ${fmtTime(meta.bestClearMs)}` : ''}`],
        ['Боссы глав', `${Object.keys(meta.bossesDefeated || {}).length} из 6`],
        ['Забегов начато / завершено', `${meta.totalRuns} / ${meta.finishedRuns}`],
        ['Боссов повержено', meta.bossesKilled],
        ['Врагов побеждено', meta.enemiesKilled],
        ['Комнат исследовано', meta.roomsExplored],
        ['Тайников найдено', meta.secretsFound],

        ['Время в башне', fmtTime(meta.totalPlayMs)],
        ['Осколки башни', meta.shards],
        ['Лучший забег', meta.bestRun ? `этаж ${meta.bestRun.floor}, ${GD.classes[meta.bestRun.cls]?.name || ''}, ${meta.bestRun.kills} побед` : '—'],
        ['Мини-боссов', meta.minibossesKilled || 0]
      ];
      void a;
      lines.forEach(([k, v], j) => { put(txt(scene, 24, 56 + j * 12, k, { color: COLORS.dim })); put(txt(scene, 356, 56 + j * 12, String(v), { origin: [1, 0] })); });
    } else if (i === 1) {
      const ids = Object.keys(GD.lore);
      const found = ids.filter((id) => meta.lore[id]);
      put(txt(scene, 24, 56, `Найдено страниц: ${found.length} из ${ids.length}`, { color: COLORS.dim }));
      let y = 70;
      for (const id of ids) {
        const L = GD.lore[id];
        if (meta.lore[id]) {
          put(txt(scene, 24, y, L.title, { color: COLORS.gold }));
          const body = wrap(L.text, 56);
          put(txt(scene, 24, y + 10, body, { color: COLORS.text }));
          y += 14 + body.split('\n').length * 11;
        }
        if (y > 200) break;
      }
      if (!found.length) put(txt(scene, 24, 76, 'Исследуйте башню: дневники, записки и\nрассказы встречных раскроют её тайну.', { color: COLORS.dim }));
    } else if (i === 2) {
      const ids = Object.keys(GD.enemies).concat(Object.keys(GD.bosses).filter((k) => !GD.enemies[k]));
      const per = 12; const pages = Math.ceil(ids.length / per);
      page = Math.min(page, pages - 1);
      const known0 = ids.filter((id) => meta.bestiary[id] > 0).length;
      put(txt(scene, 24, 54, `Изучено: ${known0} из ${ids.length}   стр. ${page + 1}/${pages}`, { color: COLORS.dim }));
      const prev = new Button(scene, 290, 58, 18, 13, '<', () => { page = (page + pages - 1) % pages; show(2); });
      const next = new Button(scene, 314, 58, 18, 13, '>', () => { page = (page + 1) % pages; show(2); });
      put(prev); put(next);
      ids.slice(page * per, page * per + per).forEach((id, j) => {
        const def = GD.enemies[id] || GD.bosses[id];
        const known = meta.bestiary[id] > 0;
        const col = j % 3; const row = Math.floor(j / 3);
        const x = 24 + col * 118; const y = 70 + row * 34;
        const img = scene.add.image(x + 8, y + 10, def.texture, 0).setScale(def.texture.startsWith('boss') ? 0.6 : 1);
        const nm = def.name.length > 17 ? def.name.slice(0, 16) + '.' : def.name;
        if (!known) img.setTintFill(0x2a2236);
        put(img);
        put(txt(scene, x + 20, y + 2, known ? nm : '???', { color: known ? (GD.bosses[id] ? '#ff9a7a' : COLORS.text) : COLORS.dim }));
        put(txt(scene, x + 20, y + 13, known ? `${def.kind || (def.minor ? 'Мини-босс' : 'Босс')} · ${meta.bestiary[id]}` : 'не встречен', { color: COLORS.dim }));
      });
    } else {
      const list = Object.values(GD.items);
      const found = list.filter((it) => meta.itemsFound[it.id]).length;
      put(txt(scene, 24, 56, `Найдено: ${found} из ${list.length}`, { color: COLORS.dim }));
      const info = txt(scene, 24, 196, 'Наведите на предмет', { color: COLORS.dim, maxWidth: 330 });
      put(info);
      list.forEach((it, j) => {
        const x = 30 + (j % 16) * 21; const y = 80 + Math.floor(j / 16) * 22;
        const slot = scene.add.nineslice(x, y, 'slot', undefined, 19, 19, 4, 4, 4, 4);
        const known = meta.itemsFound[it.id];
        const icon = scene.add.image(x, y, 'items', it.id);
        if (!known) icon.setTintFill(0x2a2236);
        else slot.setTint(hex(RARITY[it.rarity].color));
        slot.setInteractive();
        slot.on('pointerover', () => setTxt(info, known ? `${it.name} (${RARITY[it.rarity].name.toLowerCase()}): ${it.desc}` : '??? — ещё не найден', known ? RARITY[it.rarity].color : COLORS.dim));
        put(slot); put(icon);
      });
    }
  };
  const close = m.add(new Button(scene, 340, 214, 60, 14, 'Назад', () => m.close()));
  m.group = new FocusGroup(scene, [...tabButtons, close], { columns: 1, onBack: () => m.close() });
  show(0);
  return m;
}
