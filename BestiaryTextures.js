// Сборка кадров новых врагов/боссов/декора из BestiarySprites и создание
// текстур Phaser. Функции *Frames — чистые (используются и в предпросмотре).

import { ENEMY_ART, BOSS_ART, MINIBOSS_ART, DECOR_ART, BASES, BASE_OVERLAYS, BASE_LEGS2, M, overlay, bob } from './BestiarySprites.js';
import { SLIME, TORCH } from './SpriteDefs.js';
import { drawRows, shade } from './PixelPainter.js';

const pad16 = (rows) => rows.map((r) => (r || '').padEnd(16, '.').slice(0, 16));

/** Кадры врага: [кадр0, кадр1], палитра. */
export function enemyFrames(id) {
  const a = ENEMY_ART[id];
  if (!a) return null;
  let f0;
  let legs2 = a.legs2;
  if (a.frames) f0 = a.frames[0];
  else if (a.half) f0 = M(a.half);
  else if (a.base === 'slime') f0 = SLIME.frames[0];
  else {
    f0 = BASES[a.base];
    if (BASE_OVERLAYS[a.base]) f0 = overlay(f0, BASE_OVERLAYS[a.base]);
    legs2 = legs2 || BASE_LEGS2[a.base];
  }
  if (a.over) f0 = overlay(f0, a.over);
  f0 = pad16(f0);
  let f1;
  if (legs2) f1 = [...f0.slice(0, 16 - legs2.length), ...legs2];
  else if (a.flying) f1 = [...f0.slice(1), '................'];
  else f1 = bob(f0, 12);
  // разная поза: у второго кадра крылья/ноги, у летающих — подъём
  return { frames: [f0, pad16(f1)], pal: a.pal, w: 16, h: 16 };
}

/** Мини-босс: базовый враг + собственные детали (корона, рога, топор…). */
export function minibossFrames(id) {
  const m = MINIBOSS_ART[id];
  const base = enemyFrames(m.base);
  return { frames: base.frames.map((f) => pad16(overlay(f, m.over))), pal: { ...base.pal, ...m.pal }, w: 16, h: 16 };
}

/** Босс: обычный кадр, кадр атаки (свечение), кадр ярости. */
export function bossFrames(id) {
  const b = BOSS_ART[id];
  const rows = M(b.half);
  return {
    frames: [rows, rows, rows],
    pals: [b.pal, { ...b.pal, ...b.glow }, { ...b.pal, ...b.rage }],
    w: 32, h: rows.length
  };
}

function canvasTex(scene, key, w, h) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.createCanvas(key, w, h);
}

function sheet(scene, key, frames, w, h, pals) {
  const tex = canvasTex(scene, key, w * frames.length, h);
  const ctx = tex.getContext();
  frames.forEach((rows, i) => { drawRows(ctx, rows, Array.isArray(pals) ? pals[i] : pals, i * w, 0); tex.add(i, 0, i * w, 0, w, h); });
  tex.refresh();
}

export function buildBestiaryTextures(scene, biomes) {
  for (const id of Object.keys(ENEMY_ART)) {
    const f = enemyFrames(id);
    sheet(scene, `en_${id}`, f.frames, 16, 16, f.pal);
    if (!scene.anims.exists(`en_${id}_walk`)) scene.anims.create({ key: `en_${id}_walk`, frames: [0, 1].map((n) => ({ key: `en_${id}`, frame: n })), frameRate: ENEMY_ART[id].flying ? 7 : 5, repeat: -1 });
  }
  for (const id of Object.keys(MINIBOSS_ART)) {
    const f = minibossFrames(id);
    sheet(scene, `mb_${id}`, f.frames, 16, 16, f.pal);
    if (!scene.anims.exists(`mb_${id}_walk`)) scene.anims.create({ key: `mb_${id}_walk`, frames: [0, 1].map((n) => ({ key: `mb_${id}`, frame: n })), frameRate: 5, repeat: -1 });
  }
  for (const id of Object.keys(BOSS_ART)) {
    const f = bossFrames(id);
    sheet(scene, `boss_${id}`, f.frames, f.w, f.h, f.pals);
  }
  for (const [k, d] of Object.entries(DECOR_ART)) sheet(scene, `decor_${k}`, [d.rows], 16, 16, d.pal);
  // факелы с пламенем цвета биома
  for (const b of Object.values(biomes)) {
    const t = b.torch || {};
    const pal = { o: '#1a1220', y: t.light || '#d6ffb0', f: t.main || '#7cff8a', r: t.dark || '#2f9a4a', w: '#ffffff', m: '#6a5a4a', M: '#a08a6a' };
    sheet(scene, `torch_${b.id}`, TORCH.frames, 8, 12, pal);
    if (!scene.anims.exists(`torch_${b.id}_burn`)) scene.anims.create({ key: `torch_${b.id}_burn`, frames: [0, 1, 2].map((n) => ({ key: `torch_${b.id}`, frame: n })), frameRate: 8, repeat: -1 });
  }
}

export { shade };
