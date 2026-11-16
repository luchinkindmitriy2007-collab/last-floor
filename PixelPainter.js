// Чистые функции рисования в canvas (без зависимостей от Phaser).
// Используются фабрикой текстур и инструментами предпросмотра.

import { mulberry32 } from './Random.js';

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  if (f >= 0) return rgbToHex([r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f]);
  return rgbToHex([r * (1 + f), g * (1 + f), b * (1 + f)]);
}
export function mix(a, b, t) {
  const A = hexToRgb(a); const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Рисует строковый спрайт. flip — зеркально по X. */
export function drawRows(ctx, rows, palette, ox = 0, oy = 0, flip = false) {
  const w = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + (flip ? w - 1 - x : x), oy + y, 1, 1);
    }
  });
}

/** Собирает кадр героя: тело + ноги + головной убор, со смещением «подпрыгивания». */
export function heroFrameRows(body, legs, headgear, bob) {
  let out = body.map((r, y) => (headgear && headgear[y] ? headgear[y] : r));
  if (bob) out = [...out.slice(1), '................'];
  out = out.slice(0, 13);
  while (out.length < 13) out.push('................');
  return [...out, ...legs];
}

/** Палитра иконки предмета из основного цвета. */
export function iconPalette(main, accent) {
  return { o: '#1a1220', m: main, l: shade(main, 0.45), d: shade(main, -0.4), a: accent || shade(main, 0.7) };
}

// ------------------------------------------------------------------
// Процедурные тайлы биома (16×16). Возвращают массив canvas-тайлов
// в фиксированном порядке индексов (см. TILE в Constants).
// ------------------------------------------------------------------
export function paintTileset(ctx, biome, seed = 1) {
  const rnd = mulberry32(seed);
  const T = 16;
  const P = biome.palette;
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const jitter = (c, a = 0.06) => shade(c, (rnd() - 0.5) * 2 * a);

  // Плиты пола: 4 камня разного размера с фасками
  const floor = (ox, variant) => {
    rect(ox, 0, T, T, P.mortar);
    const layouts = [
      [[0, 0, 8, 7], [8, 0, 8, 9], [0, 7, 8, 9], [8, 9, 8, 7]],
      [[0, 0, 10, 8], [10, 0, 6, 8], [0, 8, 6, 8], [6, 8, 10, 8]],
      [[0, 0, 16, 6], [0, 6, 9, 10], [9, 6, 7, 10]],
      [[0, 0, 7, 8], [7, 0, 9, 8], [0, 8, 9, 8], [9, 8, 7, 8]]
    ];
    const lay = layouts[variant % layouts.length];
    for (const [x, y, w, h] of lay) {
      const base = jitter(P.floor[Math.floor(rnd() * P.floor.length)], 0.05);
      rect(ox + x, y, w - 1, h - 1, base);
      rect(ox + x, y, w - 1, 1, shade(base, 0.12));
      rect(ox + x, y, 1, h - 1, shade(base, 0.07));
      rect(ox + x, y + h - 2, w - 1, 1, shade(base, -0.15));
      for (let i = 0; i < (w * h) / 10; i++) {
        const sx = x + 1 + Math.floor(rnd() * (w - 3)); const sy = y + 1 + Math.floor(rnd() * (h - 3));
        px(ox + sx, sy, shade(base, rnd() < 0.5 ? -0.1 : 0.08));
      }
    }
  };
  const style = biome.style || 'moss';
  // акценты биома вместо мха: трещины с лавой, снег, кости, кристаллы, звёзды пустоты
  const addAccent = (ox, amount) => {
    if (style === 'moss' || style === 'snow') return addMoss(ox, amount);
    for (let i = 0; i < amount; i++) {
      const cx = 2 + Math.floor(rnd() * 12); const cy = 2 + Math.floor(rnd() * 12);
      if (style === 'lava') {
        let x = cx; let y = cy;
        for (let k = 0; k < 6; k++) { px(ox + x, y, k % 2 ? P.moss : P.mossLight); x += Math.floor(rnd() * 3) - 1; y += rnd() < 0.6 ? 1 : 0; x = Math.max(0, Math.min(15, x)); y = Math.min(15, y); }
        px(ox + cx, cy, '#fff0b0');
      } else if (style === 'bones') {
        if (rnd() < 0.5) { px(ox + cx, cy, '#d8d0b8'); px(ox + cx + 1, cy, '#d8d0b8'); px(ox + cx + 2, cy, '#a89e86'); }
        else { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (rnd() < 0.6) px(ox + Math.max(0, Math.min(15, cx + dx)), Math.max(0, Math.min(15, cy + dy)), rnd() < 0.3 ? P.mossLight : P.moss); }
      } else if (style === 'crystal') {
        const col = rnd() < 0.5 ? P.moss : P.mossLight;
        px(ox + cx, cy, '#ffffff'); px(ox + cx, Math.min(15, cy + 1), col); px(ox + cx, Math.min(15, cy + 2), shade(col, -0.35));
        if (rnd() < 0.5) { px(ox + Math.min(15, cx + 1), Math.min(15, cy + 1), col); px(ox + Math.min(15, cx + 1), Math.min(15, cy + 2), shade(col, -0.35)); }
      } else if (style === 'void') {
        px(ox + cx, cy, rnd() < 0.3 ? '#ffffff' : P.mossLight);
        if (rnd() < 0.3) { px(ox + Math.max(0, cx - 1), cy, P.moss); px(ox + Math.min(15, cx + 1), cy, P.moss); }
      }
    }
  };
  const addMoss = (ox, amount) => {
    for (let i = 0; i < amount; i++) {
      const cx = Math.floor(rnd() * 14) + 1; const cy = Math.floor(rnd() * 14) + 1;
      const r = 1 + Math.floor(rnd() * 2);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + rnd()) continue;
        const x = cx + dx; const y = cy + dy;
        if (x < 0 || y < 0 || x > 15 || y > 15) continue;
        px(ox + x, y, rnd() < 0.3 ? P.mossLight : P.moss);
      }
    }
  };
  const addCrack = (ox) => {
    let x = 3 + Math.floor(rnd() * 10); let y = 1;
    while (y < 15) {
      px(ox + x, y, P.mortar);
      if (rnd() < 0.4) px(ox + x + 1, y, shade(P.floor[0], -0.25));
      y++; x += Math.floor(rnd() * 3) - 1; x = Math.max(1, Math.min(14, x));
    }
  };

  // Кирпичная кладка стены (вид спереди)
  const wallFace = (ox, mossy) => {
    rect(ox, 0, T, T, P.mortar);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let bx = -off; bx < T; bx += 8) {
        const x0 = Math.max(0, bx); const x1 = Math.min(T, bx + 8) - 1;
        const y0 = row * 4;
        const base = jitter(P.brick, 0.07);
        rect(ox + x0, y0, x1 - x0, 3, base);
        rect(ox + x0, y0, x1 - x0, 1, shade(base, 0.16));
        px(ox + x1 - 1, y0 + 2, shade(base, -0.18));
      }
    }
    // тень у пола
    rect(ox, 14, T, 2, shade(P.mortar, -0.3));
    if (mossy && style !== 'moss' && style !== 'snow') { for (let i = 0; i < 3; i++) { const x = 1 + Math.floor(rnd() * 14); const y = Math.floor(rnd() * 12); px(ox + x, y, P.mossLight); px(ox + x, y + 1, P.moss); } }
    else if (mossy) for (let i = 0; i < 5; i++) {
      const x = Math.floor(rnd() * 16); const len = 2 + Math.floor(rnd() * 6);
      for (let y = 0; y < len; y++) px(ox + x, y, y === len - 1 ? P.mossLight : P.moss);
    }
  };
  // Верх стены (вид сверху)
  const wallTop = (ox) => {
    rect(ox, 0, T, T, P.wallTop);
    for (let i = 0; i < 26; i++) px(ox + Math.floor(rnd() * 16), Math.floor(rnd() * 16), shade(P.wallTop, rnd() < 0.5 ? 0.12 : -0.15));
    for (let y = 3; y < 16; y += 6) rect(ox, y, T, 1, shade(P.wallTop, -0.2));
  };
  // Колонна
  const pillar = (ox, broken) => {
    rect(ox + 2, 13, 12, 3, shade(P.mortar, -0.2));
    const top = broken ? 6 : 1;
    for (let x = 3; x < 13; x++) {
      const t = (x - 3) / 9;
      const c = t < 0.3 ? shade(P.pillar, 0.25) : t > 0.75 ? shade(P.pillar, -0.3) : P.pillar;
      rect(ox + x, top + 2, 1, 12 - top, c);
    }
    rect(ox + 2, top, 12, 3, shade(P.pillar, 0.15));
    rect(ox + 2, top, 12, 1, shade(P.pillar, 0.35));
    rect(ox + 2, 13, 12, 2, shade(P.pillar, -0.15));
    rect(ox + 2, top + 2, 12, 1, shade(P.pillar, -0.35));
    if (broken) { px(ox + 5, top, P.mortar); px(ox + 9, top, P.mortar); px(ox + 10, top + 1, P.mortar); }
    for (let i = 0; i < 4; i++) px(ox + 4 + Math.floor(rnd() * 8), top + 4 + Math.floor(rnd() * 7), P.moss);
    ctx.strokeStyle = '#1a1220';
  };
  // Яма
  const pit = (ox) => {
    if (style === 'lava') {
      rect(ox, 0, T, T, P.pitDeep);
      for (let i = 0; i < 10; i++) { const x = Math.floor(rnd() * 15); const y = 4 + Math.floor(rnd() * 11); rect(ox + x, y, 2, 1, P.pitEdge); }
      for (let i = 0; i < 4; i++) px(ox + Math.floor(rnd() * 16), 5 + Math.floor(rnd() * 10), '#fff0b0');
      rect(ox, 0, T, 3, '#2a1210'); rect(ox, 3, T, 1, '#6a2010');
      return;
    }
    if (style === 'void') {
      rect(ox, 0, T, T, '#000000');
      for (let i = 0; i < 5; i++) px(ox + Math.floor(rnd() * 16), 4 + Math.floor(rnd() * 12), rnd() < 0.5 ? '#ffffff' : P.mossLight);
      rect(ox, 0, T, 3, P.pitEdge); rect(ox, 3, T, 1, shade(P.pitEdge, -0.4));
      return;
    }
    rect(ox, 0, T, T, P.pitDeep);
    rect(ox, 0, T, 3, P.pitEdge);
    rect(ox, 3, T, 1, shade(P.pitEdge, -0.3));
    for (let i = 0; i < 6; i++) px(ox + Math.floor(rnd() * 16), 6 + Math.floor(rnd() * 9), shade(P.pitDeep, 0.15));
  };
  // Решётка двери
  const bars = (ox) => {
    floor(ox, 0);
    rect(ox, 0, T, T, 'rgba(10,8,14,0.55)');
    for (let x = 1; x < 16; x += 4) { rect(ox + x, 0, 2, 16, '#3a3640'); rect(ox + x, 0, 1, 16, '#77727f'); }
    rect(ox, 3, 16, 2, '#4a4650'); rect(ox, 11, 16, 2, '#4a4650'); rect(ox, 3, 16, 1, '#8a8592');
  };
  // Треснувшая стена (секрет)
  const cracked = (ox) => {
    wallFace(ox, false);
    ctx.fillStyle = P.mortar;
    let x = 7; for (let y = 1; y < 15; y++) { ctx.fillRect(ox + x, y, 1, 1); if (rnd() < 0.5) ctx.fillRect(ox + x + 1, y, 1, 1); x += Math.floor(rnd() * 3) - 1; }
    px(ox + 4, 5, P.mortar); px(ox + 5, 6, P.mortar); px(ox + 11, 9, P.mortar); px(ox + 12, 10, P.mortar);
  };
  // Лестница вниз
  const stairs = (ox) => {
    rect(ox, 0, T, T, P.pitDeep);
    for (let i = 0; i < 5; i++) {
      const y = 1 + i * 3; const inset = i;
      rect(ox + 1 + inset, y, 14 - inset * 2, 2, shade(P.floor[0], -0.1 - i * 0.12));
      rect(ox + 1 + inset, y, 14 - inset * 2, 1, shade(P.floor[0], 0.1 - i * 0.12));
    }
    rect(ox, 0, 1, 16, '#1a1220'); rect(ox + 15, 0, 1, 16, '#1a1220');
  };
  // Тень от стены на полу
  const shadowFloor = (ox, v) => { floor(ox, v); rect(ox, 0, T, 4, 'rgba(8,6,12,0.45)'); rect(ox, 4, T, 2, 'rgba(8,6,12,0.2)'); };
  // Ковёр/руна в центре
  const rune = (ox) => {
    floor(ox, 3);
    ctx.fillStyle = P.rune;
    [[7, 2], [8, 2], [5, 4], [10, 4], [4, 7], [11, 7], [4, 8], [11, 8], [5, 11], [10, 11], [7, 13], [8, 13], [7, 7], [8, 8], [7, 8], [8, 7]].forEach(([x, y]) => ctx.fillRect(ox + x, y, 1, 1));
  };

  const painters = [
    (o) => floor(o, 0), // 0 FLOOR
    (o) => floor(o, 1), // 1
    (o) => floor(o, 2), // 2
    (o) => { floor(o, 3); addAccent(o, 3); }, // 3 FLOOR_MOSS
    (o) => { floor(o, 0); addCrack(o); }, // 4 FLOOR_CRACK
    (o) => shadowFloor(o, 0), // 5 FLOOR_SHADOW
    (o) => shadowFloor(o, 1), // 6
    (o) => wallTop(o), // 7 WALL_TOP
    (o) => wallFace(o, false), // 8 WALL_FACE
    (o) => wallFace(o, true), // 9 WALL_FACE_MOSS
    (o) => pillar(o, false), // 10 PILLAR
    (o) => pillar(o, true), // 11 PILLAR_BROKEN
    (o) => pit(o), // 12 PIT
    (o) => bars(o), // 13 DOOR_BARS
    (o) => cracked(o), // 14 CRACKED_WALL
    (o) => stairs(o), // 15 STAIRS
    (o) => { wallTop(o); }, // 16 CRACKED_TOP (верх секретной стены)
    (o) => rune(o), // 17 RUNE
    (o) => { floor(o, 2); addAccent(o, 6); } // 18 FLOOR_MOSS_HEAVY
  ];
  painters.forEach((p, i) => { ctx.save(); p(i * T); ctx.restore(); });
  return painters.length;
}

// ------------------------------------------------------------------
// Эффекты
// ------------------------------------------------------------------
export function paintGlow(ctx, size, color = '#ffffff') {
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  const [R, G, B] = hexToRgb(color);
  g.addColorStop(0, `rgba(${R},${G},${B},1)`);
  g.addColorStop(0.35, `rgba(${R},${G},${B},0.55)`);
  g.addColorStop(1, `rgba(${R},${G},${B},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

/** Пиксельный «круг» с ободком — для снарядов. */
export function paintOrb(ctx, ox, d, core, rim) {
  const r = d / 2;
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
    const dx = x + 0.5 - r; const dy = y + 0.5 - r; const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > r) continue;
    ctx.fillStyle = dist > r - 1.2 ? rim : dist < r * 0.45 ? '#ffffff' : core;
    ctx.fillRect(ox + x, y, 1, 1);
  }
}

/** Дуга удара (кадры анимации взмаха). */
export function paintSlash(ctx, ox, size, t, color) {
  const cx = size / 2; const cy = size / 2;
  const R = size / 2 - 1;
  const span = Math.PI * 0.9;
  const start = -span / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - cx; const dy = y + 0.5 - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    const a = Math.atan2(dy, dx);
    if (a < start || a > start + span * Math.min(1, t * 1.4)) continue;
    const thick = 4 * (1 - Math.abs((a - start) / span - 0.5) * 1.6);
    if (d > R || d < R - Math.max(1, thick)) continue;
    const edge = d > R - 1.3;
    ctx.fillStyle = edge ? '#ffffff' : color;
    ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    ctx.fillRect(ox + x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

/** Пиксельное кольцо для ударных волн и телеграфов. */
export function paintRing(ctx, size, color, thickness = 2) {
  const r = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
    if (d <= r && d > r - thickness) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
  }
}

export function paintDisc(ctx, size, color) {
  const r = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (Math.hypot(x + 0.5 - r, y + 0.5 - r) <= r) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
  }
}

/** Рамка панели интерфейса (9-slice исходник 24×24). */
export function paintPanel(ctx, style) {
  const S = 24;
  const base = style.base; const border = style.border; const light = style.light; const dark = style.dark;
  ctx.fillStyle = base; ctx.fillRect(2, 2, S - 4, S - 4);
  ctx.fillStyle = '#0d0a12'; ctx.fillRect(1, 0, S - 2, 1); ctx.fillRect(1, S - 1, S - 2, 1); ctx.fillRect(0, 1, 1, S - 2); ctx.fillRect(S - 1, 1, 1, S - 2);
  ctx.fillStyle = border; ctx.fillRect(1, 1, S - 2, 1); ctx.fillRect(1, S - 2, S - 2, 1); ctx.fillRect(1, 1, 1, S - 2); ctx.fillRect(S - 2, 1, 1, S - 2);
  ctx.fillStyle = light; ctx.fillRect(2, 2, S - 4, 1);
  ctx.fillStyle = dark; ctx.fillRect(2, S - 3, S - 4, 1);
  if (style.corner) {
    ctx.fillStyle = style.corner;
    [[1, 1], [S - 3, 1], [1, S - 3], [S - 3, S - 3]].forEach(([x, y]) => { ctx.fillRect(x, y, 2, 2); });
    ctx.fillStyle = shade(style.corner, 0.5);
    [[1, 1], [S - 3, 1], [1, S - 3], [S - 3, S - 3]].forEach(([x, y]) => { ctx.fillRect(x, y, 1, 1); });
  }
}
