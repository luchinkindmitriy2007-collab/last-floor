export const GAME_W = 480;
export const GAME_H = 270;
export const HUD_H = 14; // верхняя полоса интерфейса
export const TILE = 16;
export const ROOM_W = 30; // в тайлах (480 px)
export const ROOM_H = 16; // в тайлах (256 px)
export const ROOM_PX_W = ROOM_W * TILE;
export const ROOM_PX_H = ROOM_H * TILE;

export const SAVE_KEY = 'lastfloor.save';
export const SAVE_VERSION = 3;

// Индексы тайлов в процедурном тайлсете (порядок совпадает с paintTileset)
export const T = {
  FLOOR: 0, FLOOR_B: 1, FLOOR_C: 2, FLOOR_MOSS: 3, FLOOR_CRACK: 4,
  FLOOR_SHADOW: 5, FLOOR_SHADOW_B: 6,
  WALL_TOP: 7, WALL_FACE: 8, WALL_FACE_MOSS: 9,
  PILLAR: 10, PILLAR_BROKEN: 11, PIT: 12, DOOR_BARS: 13,
  CRACKED_WALL: 14, STAIRS: 15, CRACKED_TOP: 16, RUNE: 17, FLOOR_MOSS_HEAVY: 18
};
export const SOLID_TILES = [T.WALL_TOP, T.WALL_FACE, T.WALL_FACE_MOSS, T.PILLAR, T.PILLAR_BROKEN, T.DOOR_BARS, T.CRACKED_WALL, T.CRACKED_TOP];

export const DIRS = {
  N: { dx: 0, dy: -1, opp: 'S' },
  S: { dx: 0, dy: 1, opp: 'N' },
  W: { dx: -1, dy: 0, opp: 'E' },
  E: { dx: 1, dy: 0, opp: 'W' }
};

export const RARITIES = [
  { id: 'common', name: 'Обычный', color: '#c8c4bc', weight: 100 },
  { id: 'uncommon', name: 'Необычный', color: '#62c96e', weight: 55 },
  { id: 'rare', name: 'Редкий', color: '#4f94ea', weight: 24 },
  { id: 'epic', name: 'Эпический', color: '#b066ea', weight: 9 },
  { id: 'legendary', name: 'Легендарный', color: '#f5a63a', weight: 3 },
  { id: 'mythic', name: 'Мифический', color: '#ff4f6a', weight: 0.6 }
];
export const RARITY = Object.fromEntries(RARITIES.map((r, i) => [r.id, { ...r, tier: i }]));

export const ROOM_TYPES = {
  start: { name: 'Вход', icon: 'start' },
  combat: { name: 'Битва', icon: 'combat' },
  chest: { name: 'Сундук', icon: 'chest' },
  treasure: { name: 'Сокровищница', icon: 'treasure' },
  shop: { name: 'Торговец', icon: 'shop' },
  rest: { name: 'Отдых', icon: 'rest' },
  event: { name: 'Событие', icon: 'event' },
  challenge: { name: 'Испытание', icon: 'challenge' },
  secret: { name: 'Тайник', icon: 'secret' },
  boss: { name: 'Страж этажа', icon: 'boss' }
};

export const DEPTH = {
  FLOOR: 0, DECAL: 5, SHADOW: 8, ENTITY: 10, FX: 5000, LIGHT: 6000, OVERLAY: 7000
};

export const COLORS = {
  text: '#f2e6c9',
  dim: '#8f8698',
  gold: '#ffd24a',
  hp: '#e8404a',
  hpBack: '#3a1620',
  xp: '#62d6ff',
  good: '#7cff8a',
  bad: '#ff5a5a',
  panel: '#1c1724'
};

export const hex = (c) => parseInt(c.slice(1), 16);
