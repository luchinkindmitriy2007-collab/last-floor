import Phaser from 'phaser';
import { DATA_FILES, ingest, GD } from './GameData.js';
import { buildAllTextures } from './TextureFactory.js';
import { saveSystem } from './SaveSystem.js';
import { analytics } from './AnalyticsManager.js';
import { adManager } from './AdManager.js';
import { platform } from './Platform.js';
import { audio } from './AudioSystem.js';
import { log } from './Helpers.js';
import { GAME_W, GAME_H } from './Constants.js';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    const cx = GAME_W / 2; const cy = GAME_H / 2;
    this.add.bitmapText(cx, cy - 20, 'px', 'LAST FLOOR').setOrigin(0.5).setScale(2).setTint(0xf2e6c9);
    const barBg = this.add.rectangle(cx, cy + 10, 160, 6, 0x1c1724).setStrokeStyle(1, 0x5b4a6e);
    const bar = this.add.rectangle(cx - 79, cy + 10, 0, 4, 0x7cff8a).setOrigin(0, 0.5);
    const label = this.add.bitmapText(cx, cy + 22, 'px', 'ЗАГРУЗКА…').setOrigin(0.5).setTint(0x8f8698);
    this.load.on('progress', (p) => { bar.width = 158 * p; });
    this.load.on('loaderror', (f) => { log.error(`Ошибка загрузки ${f.key}: ${f.src}`); label.setText('ОШИБКА ЗАГРУЗКИ ДАННЫХ').setTint(0xff5a5a); });
    // window.LF_ASSET_BASE позволяет запускать игру без сборщика (tools/nobuild)
    this.load.setPath(window.LF_ASSET_BASE || '');
    for (const f of DATA_FILES) this.load.json(f, `data_${f}.json`);
    void barBg;
  }

  async create() {
    try {
      ingest(this.cache);
    } catch (e) {
      log.error(e);
      this.add.bitmapText(GAME_W / 2, GAME_H / 2 + 40, 'px', 'ДАННЫЕ ИГРЫ ПОВРЕЖДЕНЫ').setOrigin(0.5).setTint(0xff5a5a);
      return;
    }
    buildAllTextures(this, GD);
    this.createAnims();

    // Площадка (Playgama Bridge), если есть: initialize до старта игры
    await platform.init();
    if (platform.storage) saveSystem.useStorage(platform.storage);
    audio.setPlatformMute(!platform.audioEnabled);
    platform.onAudio((on) => audio.setPlatformMute(!on || platform.platformPaused));
    platform.onPause((paused) => {
      audio.setPlatformMute(paused || !platform.audioEnabled);
      if (paused) { this.game.events.emit('lf-flush-save'); this.game.loop.sleep(); } else this.game.loop.wake();
    });

    saveSystem.load();
    const s = saveSystem.data.settings;
    audio.setVolumes(s.music, s.sfx);
    analytics.init();
    await adManager.init();

    // Разблокировка звука при первом действии игрока
    const unlock = () => audio.unlock();
    this.input.on('pointerdown', unlock);
    this.input.keyboard.on('keydown', unlock);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    // Сохранение при сворачивании/закрытии вкладки
    const flush = () => this.game.events.emit('lf-flush-save');
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);

    this.scene.start('Menu');
  }

  createAnims() {
    const a = this.anims;
    const mk = (key, tex, frames, rate, repeat = -1) => {
      if (a.exists(key)) return;
      a.create({ key, frames: frames.map((f) => ({ key: tex, frame: f })), frameRate: rate, repeat });
    };
    for (const c of ['guardian', 'ranger', 'mage']) {
      mk(`hero_${c}_idle`, `hero_${c}`, [0, 1], 2.5);
      mk(`hero_${c}_walk`, `hero_${c}`, [0, 2, 0, 3], 9);
    }
    mk('npc_merchant_idle', 'npc_merchant', [0, 1], 2);
    mk('npc_explorer_idle', 'npc_explorer', [0, 1], 1.5);
    mk('en_bat_fly', 'en_bat', [0, 1], 8);
    mk('en_skeleton_walk', 'en_skeleton', [0, 1], 5);
    mk('en_archer_walk', 'en_archer', [0, 1], 5);
    mk('en_golem_walk', 'en_golem', [0, 1], 4);
    mk('torch_burn', 'torch', [0, 1, 2], 8);
    mk('fountain_flow', 'fountain', [0, 1], 3);
    mk('slash_anim', 'slash', [0, 1, 2, 3, 4], 30, 0);
    mk('slash_red_anim', 'slash_red', [0, 1, 2, 3, 4], 30, 0);
    mk('slash_green_anim', 'slash_green', [0, 1, 2, 3, 4], 30, 0);
  }
}
