// Конфигурация каждого из 30 этажей строится из глав (chapters.json):
// глава = 5 этажей, последний этаж главы — арена босса.
// После 30-го этажа — бесконечный режим: главы повторяются по кругу с ростом сложности.

export const FLOORS_PER_CHAPTER = 5;
export const MAIN_FLOORS = 30;

export class FloorDatabase {
  constructor(chaptersData) {
    this.data = chaptersData;
    this.chapters = chaptersData.chapters;
    this.D = chaptersData.difficulty;
  }

  chapterIndex(floor) { return Math.floor((floor - 1) / FLOORS_PER_CHAPTER) % this.chapters.length; }
  chapter(floor) { return this.chapters[this.chapterIndex(floor)]; }
  sub(floor) { return ((floor - 1) % FLOORS_PER_CHAPTER) + 1; } // 1…5
  isBossFloor(floor) { return this.sub(floor) === FLOORS_PER_CHAPTER; }
  isEndless(floor) { return floor > MAIN_FLOORS; }
  isFinalFloor(floor) { return floor === MAIN_FLOORS; }
  isChapterStart(floor) { return this.sub(floor) === 1; }

  /** Полная конфигурация этажа для генератора. */
  config(floor, rngFloat = Math.random) {
    const ch = this.chapter(floor);
    const ci = this.chapterIndex(floor);
    const sub = this.sub(floor);
    const D = this.D;
    const boss = this.isBossFloor(floor);
    const special = ['treasure'];
    if (rngFloat() < D.shopChance) special.push('shop');
    if (rngFloat() < D.eventChance[0]) special.push('event');
    if (!boss && rngFloat() < D.minibossChance[ci]) special.push('miniboss');
    if (rngFloat() < D.challengeChance[ci]) special.push('challenge');
    if (rngFloat() < D.restChance || boss) special.push('rest'); // перед боссом отдых гарантирован
    if (rngFloat() < D.eventChance[1]) special.push('event');
    if (sub >= 3 && rngFloat() < 0.35) special.push('chest');
    const [r0, r1] = D.rooms[ci];
    return {
      floor, chapter: ch.id, chapterIndex: ci, sub, biome: ch.biome,
      rooms: [r0 + Math.floor(sub / 2), r1 + Math.floor(sub / 2)],
      waves: D.waves[ci],
      special,
      secretChance: D.secretChance[ci],
      loops: D.loops,
      exitType: boss ? 'boss' : 'exit',
      boss: boss ? ch.boss : null,
      minibosses: ch.minibosses,
      sealShare: D.sealShare,
      endless: this.isEndless(floor)
    };
  }
}
