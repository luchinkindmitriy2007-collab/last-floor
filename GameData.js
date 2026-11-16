// Реестр игровых данных, загруженных из public/data/*.json.
export const GD = {
  classes: {},
  enemies: {},
  bosses: {},
  items: {},
  sets: {},
  prices: {},
  upgrades: {},
  events: {},
  curses: [],
  lore: {},
  chapters: null,
  rooms: null,
  biomes: {}
};

export const DATA_FILES = ['classes', 'enemies', 'bosses', 'items', 'upgrades', 'events', 'chapters', 'rooms', 'biomes'];

export function ingest(cache) {
  const get = (k) => {
    const v = cache.json.get(k);
    if (!v) throw new Error(`Не загружен файл данных: data/${k}.json`);
    return v;
  };
  GD.classes = get('classes');
  const noDoc = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));
  GD.enemies = noDoc(get('enemies'));
  GD.bosses = noDoc(get('bosses'));
  const items = get('items');
  GD.items = Object.fromEntries(items.items.map((i) => [i.id, i]));
  GD.sets = items.sets;
  GD.prices = items.prices;
  GD.upgrades = Object.fromEntries(Object.entries(get('upgrades')).map(([id, u]) => [id, { id, ...u }]));
  const ev = get('events');
  GD.events = ev.events;
  GD.curses = ev.curses;
  GD.lore = ev.lore;
  GD.chapters = get('chapters');
  GD.rooms = get('rooms');
  GD.biomes = get('biomes');
  validate();
  return GD;
}

/** Ранняя проверка целостности данных — понятные ошибки вместо падений в игре. */
function validate() {
  const problems = [];
  for (const [id, it] of Object.entries(GD.items)) {
    if (!it.name || !it.rarity || !it.icon) problems.push(`предмет ${id}: нет name/rarity/icon`);
  }
  for (const c of GD.chapters.chapters) {
    if (!GD.biomes[c.biome]) problems.push(`глава ${c.id}: нет биома ${c.biome}`);
    if (!GD.bosses[c.boss]) problems.push(`глава ${c.id}: нет босса ${c.boss}`);
    for (const p of c.enemyPool) if (!GD.enemies[p.id]) problems.push(`глава ${c.id}: неизвестный враг ${p.id}`);
    for (const m of c.minibosses) if (!GD.bosses[m] && !GD.enemies[m]) problems.push(`глава ${c.id}: неизвестный мини-босс ${m}`);
  }
  if (problems.length) console.warn('[LastFloor] Проблемы в данных:\n' + problems.join('\n'));
}
