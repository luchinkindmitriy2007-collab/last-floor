// Создаёт все игровые текстуры при загрузке. Каждая текстура регистрируется
// под постоянным ключом — позже её можно заменить PNG-спрайтшитом с тем же
// ключом и раскладкой кадров, не трогая игровой код.

import * as D from './SpriteDefs.js';
import { buildBestiaryTextures } from './BestiaryTextures.js';
import { drawRows, heroFrameRows, paintTileset, iconPalette, paintGlow, paintOrb, paintSlash, paintRing, paintDisc, paintPanel, shade } from './PixelPainter.js';

function canvasTex(scene, key, w, h) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.createCanvas(key, w, h);
}

/** Спрайтшит из набора кадров-строк. */
function sheet(scene, key, frames, fw, fh, palette) {
  const tex = canvasTex(scene, key, fw * frames.length, fh);
  const ctx = tex.getContext();
  frames.forEach((rows, i) => {
    drawRows(ctx, rows, Array.isArray(palette) ? palette[i] : palette, i * fw, 0);
    tex.add(i, 0, i * fw, 0, fw, fh);
  });
  tex.refresh();
  return tex;
}

function heroSheet(scene, key, cls, paletteKey = cls) {
  const H = D.HERO_HEADGEAR[cls] || null;
  const frames = [
    heroFrameRows(D.HERO_BODY, D.HERO_LEGS.stand, H, 0),
    heroFrameRows(D.HERO_BODY, D.HERO_LEGS.stand, H, 1),
    heroFrameRows(D.HERO_BODY, D.HERO_LEGS.stepA, H, 1),
    heroFrameRows(D.HERO_BODY, D.HERO_LEGS.stepB, H, 1)
  ];
  sheet(scene, key, frames, 16, 16, D.HERO_PALETTES[paletteKey]);
}

function bossSheet(scene) {
  const W = 34; const Hh = 30;
  const tex = canvasTex(scene, 'boss_gatekeeper', W * 3, Hh);
  const ctx = tex.getContext();
  const B = D.BOSS_PARTS;
  const draw = (ox, pal, armLift) => {
    drawRows(ctx, B.leg, pal, ox + 9, 21); drawRows(ctx, B.leg, pal, ox + 18, 21, true);
    drawRows(ctx, B.arm, pal, ox + 1, 9 - armLift); drawRows(ctx, B.arm, pal, ox + 26, 9 - armLift, true);
    drawRows(ctx, B.torso, pal, ox + 7, 9);
    drawRows(ctx, B.head, pal, ox + 10, 2);
  };
  draw(0, D.BOSS_PALETTE, 0);
  draw(W, D.BOSS_PALETTE, 3);
  draw(W * 2, D.BOSS_PALETTE_RAGE, 1);
  for (let i = 0; i < 3; i++) tex.add(i, 0, i * W, 0, W, Hh);
  tex.refresh();
}

/** Иконки предметов: каждому предмету — кадр 16×16 в общем атласе. */
export function buildItemIcons(scene, items) {
  const list = Object.values(items);
  const tex = canvasTex(scene, 'items', 16 * list.length, 16);
  const ctx = tex.getContext();
  list.forEach((it, i) => {
    const tpl = D.ICONS[it.icon] || D.ICONS.gem;
    drawRows(ctx, tpl, iconPalette(it.color, it.accent), i * 16 + 2, 2);
    tex.add(it.id, 0, i * 16, 0, 16, 16);
  });
  tex.refresh();
}

/** Иконки улучшений уровня (шаблон + цвет). */
export function buildUpgradeIcons(scene, upgrades) {
  const list = Object.values(upgrades);
  const tex = canvasTex(scene, 'upgrades', 16 * list.length, 16);
  const ctx = tex.getContext();
  list.forEach((u, i) => {
    drawRows(ctx, D.ICONS[u.icon] || D.ICONS.gem, iconPalette(u.color), i * 16 + 2, 2);
    tex.add(u.id, 0, i * 16, 0, 16, 16);
  });
  tex.refresh();
}

export function buildTileset(scene, biome) {
  const key = `tiles_${biome.id}`;
  const tex = canvasTex(scene, key, 16 * 19, 16);
  const n = paintTileset(tex.getContext(), biome, 1337);
  for (let i = 0; i < n; i++) tex.add(i, 0, i * 16, 0, 16, 16);
  tex.refresh();
  return key;
}

const DECOR = {
  bones: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '..oo........oo..', '.owwooooooooWwo.', '..owWWWWWWWWWo..', '.owwo.....ooWwo.', '..oo..oo...oo...', '.....owwo.......', '......oo........'],
  skull: ['................', '................', '................', '................', '................', '................', '................', '................', '.....oooooo.....', '....owwwwwWo....', '...owddwwddWo...', '...owddwwddWo...', '...owwwddwwWo...', '....oWwdwdWo....', '.....oooooo.....', '................'],
  rubble: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '.......oooo.....', '......ossSSo....', '..ooo.osssSo.oo.', '.ossSoosSSSooSSo', '.osSSoossSSoSSSo', '..oooo.oooo.ooo.', '................'],
  vines: ['..mm.....m...m..', '..m.....mm...m..', '..mM.....m...M..', '...m.....M...m..', '...M.........m..', '...m.........M..', '...m............', '................', '................', '................', '................', '................', '................', '................', '................', '................']
};
const DECOR_PAL = { o: D.OUTLINE, w: '#d8d0b8', W: '#958b72', d: '#2a2030', s: '#6e6a74', S: '#45424c', m: '#4f8a3c', M: '#7cbf5a' };

export function buildAllTextures(scene, data) {
  // Герои и NPC
  heroSheet(scene, 'hero_guardian', 'guardian');
  heroSheet(scene, 'hero_ranger', 'ranger');
  heroSheet(scene, 'hero_mage', 'mage');
  heroSheet(scene, 'npc_merchant', 'ranger', 'merchant');
  heroSheet(scene, 'npc_explorer', null, 'explorer');

  // Враги
  sheet(scene, 'en_slime', D.SLIME.frames, 16, 16, D.ENEMY_PALETTES.slime);
  sheet(scene, 'en_slime_big', D.SLIME.frames, 16, 16, D.ENEMY_PALETTES.slime_big);
  sheet(scene, 'en_bat', D.BAT.frames, 16, 16, D.ENEMY_PALETTES.bat);
  sheet(scene, 'en_skeleton', D.SKELETON.frames, 16, 16, D.ENEMY_PALETTES.skeleton);
  sheet(scene, 'en_archer', D.SKELETON.frames, 16, 16, D.ENEMY_PALETTES.archer);
  sheet(scene, 'en_sentry', D.SENTRY.frames, 16, 16, D.ENEMY_PALETTES.sentry);
  sheet(scene, 'en_golem', D.GOLEM.frames, 16, 16, D.ENEMY_PALETTES.golem);
  sheet(scene, 'en_mimic', D.CHEST.frames, 16, 16, D.CHEST_PALETTES.mimic);
  bossSheet(scene);

  // Объекты
  sheet(scene, 'chest_wood', D.CHEST.frames, 16, 16, D.CHEST_PALETTES.wood);
  sheet(scene, 'chest_gold', D.CHEST.frames, 16, 16, D.CHEST_PALETTES.gold);
  sheet(scene, 'chest_cursed', D.CHEST.frames, 16, 16, D.CHEST_PALETTES.cursed);
  sheet(scene, 'fountain', D.FOUNTAIN.frames, 16, 16, D.FOUNTAIN_PALETTE);
  sheet(scene, 'fountain_dry', [D.FOUNTAIN.frames[0]], 16, 16, D.FOUNTAIN_DRY);
  sheet(scene, 'altar_blood', D.ALTAR.frames, 16, 16, D.ALTAR_PALETTES.blood);
  sheet(scene, 'altar_wish', D.ALTAR.frames, 16, 16, D.ALTAR_PALETTES.wish);
  sheet(scene, 'altar_spent', D.ALTAR.frames, 16, 16, D.ALTAR_PALETTES.spent);
  sheet(scene, 'torch', D.TORCH.frames, 8, 12, D.TORCH_PALETTE);
  sheet(scene, 'coin', D.COIN.frames, 8, 8, D.COIN_PALETTE);
  sheet(scene, 'heart', D.HEART.frames, 8, 8, D.HEART_PALETTE);
  sheet(scene, 'shard', D.SHARD.frames, 8, 8, D.SHARD_PALETTE);
  sheet(scene, 'note', D.NOTE.frames, 12, 12, D.NOTE_PALETTE);
  Object.entries(DECOR).forEach(([k, rows]) => sheet(scene, `decor_${k}`, [rows], 16, 16, DECOR_PAL));

  // Оружие в руках
  sheet(scene, 'wpn_sword', [D.ICONS.sword], 12, 12, iconPalette('#cfd8e4', '#d8ae4f'));
  sheet(scene, 'wpn_dagger', [D.ICONS.dagger], 12, 12, iconPalette('#b8e0c8', '#c9a24a'));
  sheet(scene, 'wpn_staff', [D.ICONS.staff], 12, 12, { ...iconPalette('#8a5a34', '#c49aff'), d: '#6a4226', l: '#ffffff' });

  // Пьедестал магазина
  const ped = canvasTex(scene, 'pedestal', 16, 16); const pc = ped.getContext();
  drawRows(pc, ['................', '................', '................', '................', '................', '................', '................', '................', '................', '...oooooooooo...', '..osssssssssSo..', '..oSSSSSSSSSSo..', '...ossssssSSo...', '...osdsssdsSo...', '..osssssssssSo..', '..oooooooooooo..'], { o: D.OUTLINE, s: '#8b6a4a', S: '#5a4230', d: '#c9a04a' });
  ped.refresh();

  // Тени
  const sh = canvasTex(scene, 'shadow', 14, 5); const sc = sh.getContext();
  sc.fillStyle = 'rgba(8,4,14,0.45)';
  [[3, 0, 8, 1], [1, 1, 12, 3], [3, 4, 8, 1]].forEach(([x, y, w, h]) => sc.fillRect(x, y, w, h));
  sh.refresh();
  const shb = canvasTex(scene, 'shadow_big', 30, 8); const sbc = shb.getContext();
  sbc.fillStyle = 'rgba(8,4,14,0.45)';
  [[6, 0, 18, 1], [2, 1, 26, 6], [6, 7, 18, 1]].forEach(([x, y, w, h]) => sbc.fillRect(x, y, w, h));
  shb.refresh();

  // Свет и свечения
  const glow = canvasTex(scene, 'glow', 64, 64); paintGlow(glow.getContext(), 64, '#ffffff'); glow.refresh();
  const light = canvasTex(scene, 'light', 128, 128); paintGlow(light.getContext(), 128, '#ffffff'); light.refresh();

  // Частицы
  const px = canvasTex(scene, 'dot', 2, 2); px.getContext().fillStyle = '#fff'; px.getContext().fillRect(0, 0, 2, 2); px.refresh();
  const px1 = canvasTex(scene, 'px1', 1, 1); px1.getContext().fillStyle = '#fff'; px1.getContext().fillRect(0, 0, 1, 1); px1.refresh();
  const spark = canvasTex(scene, 'spark', 5, 5); const spc = spark.getContext();
  spc.fillStyle = '#fff'; spc.fillRect(2, 0, 1, 5); spc.fillRect(0, 2, 5, 1); spark.refresh();

  // Снаряды
  const proj = canvasTex(scene, 'proj', 8 * 9, 8); const prc = proj.getContext();
  paintOrb(prc, 0, 8, '#b884ff', '#5a2aa0'); // 0 магический снаряд
  paintOrb(prc, 8, 6, '#7cff8a', '#2f8a4a'); // 1 вражеский сгусток
  paintOrb(prc, 16, 8, '#ff9a4a', '#a03a1a'); // 2 огонь
  paintOrb(prc, 24, 6, '#9ad8ff', '#2a6aa0'); // 3 лёд/ветер
  // 4 кинжал (горизонтальный)
  prc.fillStyle = D.OUTLINE; prc.fillRect(32, 3, 8, 3);
  prc.fillStyle = '#dff6ea'; prc.fillRect(34, 4, 5, 1);
  prc.fillStyle = '#c9a24a'; prc.fillRect(33, 3, 1, 3);
  prc.fillStyle = '#6a4a2a'; prc.fillRect(32, 4, 1, 1);
  // 5 костяная стрела
  prc.fillStyle = D.OUTLINE; prc.fillRect(40, 3, 8, 2);
  prc.fillStyle = '#e8e1cc'; prc.fillRect(41, 3, 6, 1);
  prc.fillStyle = '#ffb84a'; prc.fillRect(46, 2, 2, 3);
  paintOrb(prc, 48, 7, '#c08aff', '#5a2a9a'); // 6 душа / магия пустоты
  // 7 кристальный осколок (ромб)
  [[3, 1, 2, 1], [2, 2, 4, 1], [1, 3, 6, 2], [2, 5, 4, 1], [3, 6, 2, 1]].forEach(([x, y, w, h]) => { prc.fillStyle = '#a83a8a'; prc.fillRect(56 + x, y, w, h); });
  [[3, 2, 2, 1], [2, 3, 4, 2], [3, 5, 2, 1]].forEach(([x, y, w, h]) => { prc.fillStyle = '#ff8ad8'; prc.fillRect(56 + x, y, w, h); });
  prc.fillStyle = '#ffffff'; prc.fillRect(59, 3, 1, 1);
  paintOrb(prc, 64, 8, '#ff4a6a', '#5a0a2a'); // 8 сгусток сердца
  for (let i = 0; i < 9; i++) proj.add(i, 0, i * 8, 0, 8, 8);
  proj.refresh();

  // Щит защитника (дуга перед врагом)
  const sa = canvasTex(scene, 'shield_arc', 6, 16); const sac = sa.getContext();
  sac.fillStyle = '#ffffff';
  [[2, 0, 2, 2], [3, 2, 2, 3], [4, 5, 2, 6], [3, 11, 2, 3], [2, 14, 2, 2]].forEach(([x, y, w, h]) => sac.fillRect(x, y, w, h));
  sa.refresh();

  // Взмах оружием (5 кадров 32×32)
  const slashColors = { slash: '#cfe8ff', slash_red: '#ff8a7a', slash_green: '#a8ffb0' };
  Object.entries(slashColors).forEach(([key, color]) => {
    const t = canvasTex(scene, key, 32 * 5, 32); const c = t.getContext();
    for (let i = 0; i < 5; i++) { paintSlash(c, i * 32, 32, (i + 1) / 5, color); t.add(i, 0, i * 32, 0, 32, 32); }
    t.refresh();
  });

  // Кольца и диски (телеграфы атак, ударные волны)
  const ring = canvasTex(scene, 'ring', 64, 64); paintRing(ring.getContext(), 64, '#ffffff', 2); ring.refresh();
  const ringThin = canvasTex(scene, 'ring_thin', 64, 64); paintRing(ringThin.getContext(), 64, '#ffffff', 1); ringThin.refresh();
  const disc = canvasTex(scene, 'disc', 64, 64); paintDisc(disc.getContext(), 64, '#ffffff'); disc.refresh();

  // Панели интерфейса (9-slice)
  const panels = {
    panel: { base: '#1c1724', border: '#5b4a6e', light: '#2a2236', dark: '#120e18', corner: '#c9a04a' },
    panel_dark: { base: '#120e18', border: '#3a3046', light: '#1a1522', dark: '#0a080e' },
    btn: { base: '#2a2236', border: '#6b5a80', light: '#3a3048', dark: '#1a1424' },
    btn_hl: { base: '#3d2f52', border: '#e0b84a', light: '#55426f', dark: '#241a32', corner: '#fff0a0' },
    slot: { base: '#16121d', border: '#3e3450', light: '#1d1826', dark: '#0e0b13' }
  };
  Object.entries(panels).forEach(([k, st]) => { const t = canvasTex(scene, k, 24, 24); paintPanel(t.getContext(), st); t.refresh(); });

  // Значки мини-карты (7×7)
  const mm = canvasTex(scene, 'mm_icons', 7 * 12, 7); const mc = mm.getContext();
  const mmIcons = {
    combat: ['..o.o..', '.o.o.o.', '..ooo..', '...o...', '..o.o..', '.......', '.......'],
    chest: ['.......', '.ooooo.', '.o...o.', '.ooooo.', '.o...o.', '.ooooo.', '.......'],
    treasure: ['...o...', '..ooo..', '.ooooo.', 'ooooooo', '.ooooo.', '..ooo..', '...o...'],
    shop: ['..ooo..', '.o...o.', '..o....', '...o...', '....o..', '.o...o.', '..ooo..'],
    rest: ['...o...', '..ooo..', '.ooooo.', '.ooooo.', '..ooo..', '...o...', '.......'],
    event: ['..ooo..', '.o...o.', '....o..', '...o...', '...o...', '.......', '...o...'],
    challenge: ['.ooooo.', 'o.o.o.o', 'ooooooo', '.ooooo.', '.o.o.o.', '.......', '.......'],
    boss: ['o.o.o.o', 'ooooooo', 'o.ooo.o', 'ooooooo', '.ooooo.', '.......', '.......'],
    secret: ['.......', '..o.o..', '.......', '...o...', '.......', '..o.o..', '.......'],
    start: ['.......', '...o...', '..ooo..', '.ooooo.', '...o...', '...o...', '.......'],
    exit: ['oooo...', '...o...', '...ooo.', '.....o.', '.....oo', '......o', 'ooooooo'],
    miniboss: ['.o...o.', '.oo.oo.', '.ooooo.', 'oo.o.oo', '.ooooo.', '..o.o..', '.......']
  };
  Object.keys(mmIcons).forEach((k, i) => { drawRows(mc, mmIcons[k], { o: '#ffffff' }, i * 7, 0); mm.add(k, 0, i * 7, 0, 7, 7); });
  mm.refresh();

  // Значки HUD (8×8): способность, зелье, золото, этаж, осколки
  const hud = canvasTex(scene, 'hud_icons', 8 * 6, 8); const hc = hud.getContext();
  const hudIcons = {
    potion: [['..oo....', '..oo....', '.oRRo...', 'oRwRRo..', 'oRRRRo..', '.oooo...', '........', '........'], { o: D.OUTLINE, R: '#e8404a', w: '#ffc0c0' }],
    floor: [['oooooooo', 'o..o...o', 'o..o...o', 'oooooooo', 'o...o..o', 'o...o..o', 'oooooooo', '........'], { o: '#a7a0b5' }],
    skull: [['.oooooo.', 'owwwwwwo', 'owdwwdwo', 'owwwwwwo', '.owddwo.', '..oooo..', '........', '........'], { o: D.OUTLINE, w: '#e8e1cc', d: '#2a2030' }],
    clock: [['..oooo..', '.owwwwo.', 'owwdwwwo', 'owwdddwo', 'owwwwwwo', '.owwwwo.', '..oooo..', '........'], { o: D.OUTLINE, w: '#f2e6c9', d: '#2a2030' }],
    star: [['...o....', '..oyo...', 'ooyyyoo.', '.oyyyo..', '.oyoyo..', '.o...o..', '........', '........'], { o: D.OUTLINE, y: '#ffd24a' }],
    key: [['.ooo....', 'oyyyo...', 'oy.yoooo', 'oyyyyyyo', '.ooo.oyo', '.....o.o', '........', '........'], { o: D.OUTLINE, y: '#ffd24a' }]
  };
  Object.keys(hudIcons).forEach((k, i) => { drawRows(hc, hudIcons[k][0], hudIcons[k][1], i * 8, 0); hud.add(k, 0, i * 8, 0, 8, 8); });
  hud.refresh();

  // Иконки способностей классов (14×14)
  const ab = canvasTex(scene, 'ability_icons', 14 * 3, 14); const ac = ab.getContext();
  drawRows(ac, D.ICONS.shield, iconPalette('#5d8ad8', '#e8d070'), 1, 1);
  drawRows(ac, D.ICONS.feather, iconPalette('#7fd07a'), 15, 1);
  drawRows(ac, D.ICONS.orb, iconPalette('#b884ff', '#ffffff'), 29, 1);
  ['guardian', 'ranger', 'mage'].forEach((k, i) => ab.add(k, 0, i * 14, 0, 14, 14));
  ab.refresh();

  if (data) {
    buildItemIcons(scene, data.items);
    buildUpgradeIcons(scene, data.upgrades);
    Object.values(data.biomes).forEach((b) => buildTileset(scene, b));
  }

  if (data) buildBestiaryTextures(scene, data.biomes);

  // Фоновые элементы меню: башня и звёзды
  buildMenuArt(scene);
}

function buildMenuArt(scene) {
  const W = 120; const H = 220;
  const t = canvasTex(scene, 'tower', W, H); const c = t.getContext();
  const stone = '#2a2433'; const stoneL = '#3a3246'; const stoneD = '#17121e';
  // ствол башни, сужающийся кверху
  for (let y = 20; y < H; y++) {
    const half = Math.floor(18 + (y / H) * 22);
    const cx = W / 2;
    for (let x = cx - half; x < cx + half; x++) {
      const tx = (x - (cx - half)) / (half * 2);
      let col = tx < 0.25 ? stoneL : tx > 0.75 ? stoneD : stone;
      if ((y % 10 === 0) || ((Math.floor(y / 10) % 2 ? x + 5 : x) % 12 === 0)) col = shade(col, -0.25);
      c.fillStyle = col; c.fillRect(x, y, 1, 1);
    }
  }
  // зубцы и окна
  for (let x = 38; x < 82; x += 6) { c.fillStyle = stoneL; c.fillRect(x, 14, 4, 6); }
  c.fillStyle = stone; c.fillRect(36, 18, 48, 4);
  const win = (x, y) => { c.fillStyle = '#0b0910'; c.fillRect(x, y, 4, 7); c.fillStyle = '#7cff8a'; c.fillRect(x + 1, y + 2, 2, 4); c.fillStyle = '#d6ffb0'; c.fillRect(x + 1, y + 2, 1, 1); };
  [[58, 40], [48, 80], [68, 110], [54, 150], [64, 190]].forEach(([x, y]) => win(x, y));
  // шпиль со светом
  c.fillStyle = '#d6ffb0'; c.fillRect(59, 0, 2, 14); c.fillStyle = '#7cff8a'; c.fillRect(58, 4, 4, 2);
  t.refresh();
}
