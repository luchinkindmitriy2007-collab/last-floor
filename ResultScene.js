import Phaser from 'phaser';
import { txt, setTxt, panel, Button, FocusGroup } from './Widgets.js';
import { saveSystem } from './SaveSystem.js';
import { adManager, PLACEMENTS } from './AdManager.js';
import { audio } from './AudioSystem.js';
import { GD } from './GameData.js';
import { GAME_W, GAME_H, RARITY, COLORS, hex } from './Constants.js';
import { fmtTime } from './Helpers.js';
import { RunState } from './RunState.js';

/** Экран завершения забега: статистика с анимацией, награды, rewarded-удвоение. */
export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) { this.data_ = data; }

  create() {
    const { run, shards, victory, claimId, completed } = this.data_;
    const st = run.stats;
    this.cameras.main.fadeIn(500, 7, 6, 11);
    this.add.rectangle(0, 0, GAME_W, GAME_H, victory ? 0x0c1410 : 0x120a10).setOrigin(0);
    this.add.particles(0, 0, 'dot', { x: { min: 0, max: GAME_W }, y: GAME_H + 4, lifespan: 5000, speedY: { min: -30, max: -10 }, alpha: { start: 0.6, end: 0 }, tint: victory ? 0xffd24a : 0x8a4050, frequency: 120 });
    audio.playMusic('menu');
    audio.sfx(victory ? 'victory' : 'defeat');

    const title = txt(this, GAME_W / 2, 22, completed ? 'БАШНЯ ПОКОРЕНА' : victory ? 'ПОБЕДА' : 'ЗАБЕГ ОКОНЧЕН', { origin: 0.5, scale: 3, color: victory ? '#ffd24a' : '#ff6a6a' });
    title.setAlpha(0); this.tweens.add({ targets: title, alpha: 1, scale: { from: 4, to: 3 }, duration: 500, ease: 'Back.Out' });
    const cls = GD.classes[run.classId];
    txt(this, GAME_W / 2, 44, `${cls.name} · этаж ${run.floor}${run.floor <= 30 ? '/30' : ''} · глава ${Math.min(6, Math.ceil(run.floor / 5))} · уровень ${run.level}`, { origin: 0.5, color: COLORS.dim });

    panel(this, 30, 56, 250, 170, 'panel');
    const rows = [
      ['Достигнут этаж', run.floor], ['Этажей пройдено', st.floorsCleared], ['Комнат пройдено', st.rooms], ['Врагов побеждено', st.kills], ['Из них элитных', st.eliteKills],
      ['Боссов', st.bossesKilled], ['Тайников', st.secrets], ['Предметов найдено', st.itemsFound], ['Нанесено урона', st.damageDealt],
      ['Золото собрано', st.goldEarned], ['Время', fmtTime(st.timeMs)]
    ];
    rows.forEach(([k, v], i) => {
      const y = 66 + i * 13;
      txt(this, 42, y, k, { color: COLORS.dim });
      const val = txt(this, 268, y, typeof v === 'number' ? '0' : v, { origin: [1, 0] });
      val.setAlpha(0);
      this.time.delayedCall(250 + i * 90, () => {
        val.setAlpha(1); audio.sfx('uiMove', { gap: 0 });
        if (typeof v === 'number') this.tweens.addCounter({ from: 0, to: v, duration: 400, onUpdate: (tw) => setTxt(val, `${Math.round(tw.getValue())}`) });
      });
    });

    // предметы забега
    panel(this, 290, 56, 160, 92, 'panel');
    txt(this, 370, 63, 'Снаряжение', { origin: [0.5, 0], color: COLORS.gold });
    run.items.slice(0, 18).forEach((id, i) => {
      const it = GD.items[id]; if (!it) return;
      const x = 304 + (i % 7) * 20; const y = 86 + Math.floor(i / 7) * 20;
      const s = this.add.nineslice(x, y, 'slot', undefined, 18, 18, 4, 4, 4, 4).setTint(hex(RARITY[it.rarity].color));
      const ic = this.add.image(x, y, 'items', id);
      [s, ic].forEach((o) => { o.setScale(0); this.tweens.add({ targets: o, scale: 1, duration: 250, delay: 600 + i * 60, ease: 'Back.Out' }); });
    });
    if (!run.items.length) txt(this, 370, 96, 'ничего не найдено', { origin: 0.5, color: COLORS.dim });

    // награда
    panel(this, 290, 152, 160, 74, 'panel');
    txt(this, 370, 159, 'Осколки башни', { origin: [0.5, 0], color: '#62d6ff' });
    this.add.image(340, 184, 'shard').setScale(2);
    const sh = txt(this, 352, 179, '0', { scale: 2, color: '#62d6ff' });
    this.time.delayedCall(1300, () => {
      this.tweens.addCounter({ from: 0, to: shards, duration: 700, onUpdate: (tw) => setTxt(sh, `+${Math.round(tw.getValue())}`), onComplete: () => audio.sfx('coin') });
    });
    txt(this, 370, 202, 'Золото не переносится', { origin: [0.5, 0], color: COLORS.dim });
    const total = txt(this, 370, 212, `Всего осколков: ${saveSystem.data.meta.shards}`, { origin: [0.5, 0], color: COLORS.dim });

    // кнопки
    const buttons = [];
    const adClaim = `${claimId}:ad_double`;
    if (adManager.canOffer(PLACEMENTS.RUN_END_DOUBLE) && !saveSystem.hasClaimed(adClaim) && shards > 0) {
      const ad = new Button(this, 98, GAME_H - 30, 150, 16, `▶ Удвоить (+${shards}) за рекламу`.replace('▶ ', ''), async () => {
        ad.setEnabled(false);
        const res = await adManager.showRewarded(PLACEMENTS.RUN_END_DOUBLE, adClaim, () => { saveSystem.data.meta.shards += shards; }, this.game);
        if (res.ok) { ad.setLabel('Награда получена!', '#7cff8a'); setTxt(sh, `+${shards * 2}`); setTxt(total, `Всего осколков: ${saveSystem.data.meta.shards}`); audio.sfx('item'); }
        else ad.setLabel(res.reason === 'closed' ? 'Просмотр прерван' : 'Реклама недоступна', COLORS.dim);
      }, { color: '#62d6ff' });
      buttons.push(ad);
    }
    buttons.push(new Button(this, 270, GAME_H - 12, 110, 16, 'Новый забег', () => this.go('Game', { mode: 'new', run: new RunState({ classId: run.classId }) }), { color: '#7cff8a' }));
    buttons.push(new Button(this, 390, GAME_H - 12, 100, 16, 'В меню', () => this.go('Menu')));
    this.group = new FocusGroup(this, buttons);
    this.group.focus(buttons[buttons.length - 2]);
  }

  go(scene, data) {
    if (this.leaving) return;
    this.leaving = true;
    audio.stopMusic(0.4);
    this.cameras.main.fadeOut(350, 7, 6, 11);
    this.cameras.main.once('camerafadeoutcomplete', async () => {
      // межстраничная реклама — только здесь, в естественной паузе между забегами
      await adManager.showInterstitial('between_runs', this.game);
      this.scene.start(scene, data);
    });
  }
}
