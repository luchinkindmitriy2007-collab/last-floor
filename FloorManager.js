// Прохождение этажа: печати на пути к выходу/боссу, переходы между этажами
// и главами, завершение игры после 30-го этажа.

import { audio } from './AudioSystem.js';
import { MAIN_FLOORS } from './FloorDatabase.js';

export class FloorManager {
  constructor(scene, layout, floorDb) {
    this.scene = scene;
    this.layout = layout;
    this.fdb = floorDb;
    this.cleared = 0;
    this.required = layout.sealRequired || 0;
    this.sealsOpen = this.required === 0;
    if (this.sealsOpen) scene.time.delayedCall(50, () => scene.world.breakSeals());
  }

  get floor() { return this.scene.run.floor; }
  get chapter() { return this.fdb.chapter(this.floor); }
  get isBossFloor() { return this.fdb.isBossFloor(this.floor); }

  /** Зачищена боевая комната: продвигаем печать. */
  onRoomCleared() {
    if (this.sealsOpen) return;
    this.cleared++;
    const left = this.required - this.cleared;
    if (left > 0) {
      this.scene.ui.toast(`Печать слабеет: осталось ${left}`, '#c8b8ff');
      return;
    }
    this.sealsOpen = true;
    this.scene.world.breakSeals();
    this.scene.nav.rebuild();
    audio.sfx('secret');
    this.scene.ui.banner(this.isBossFloor ? 'ПУТЬ К СТРАЖУ ОТКРЫТ' : 'ПЕЧАТЬ СНЯТА', '#c8b8ff', this.isBossFloor ? 'Арена ждёт' : 'Лестница наверх свободна');
    for (const r of this.layout.rooms) if (r.type === 'boss' || r.type === 'exit') r.seen = true;
  }

  sealText() {
    if (this.sealsOpen) return this.isBossFloor ? 'АРЕНА ОТКРЫТА' : 'ВЫХОД ОТКРЫТ';
    return `ПЕЧАТЬ ${this.cleared}/${this.required}`;
  }

  /** Подпись этажа для интерфейса. */
  label() {
    const f = this.floor;
    if (f > MAIN_FLOORS) return `ЭТАЖ ${f} · ∞`;
    return `ЭТАЖ ${f}/${MAIN_FLOORS} · ГЛ.${this.chapter.id}`;
  }
}
