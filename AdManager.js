// Единая точка работы с рекламой. Правила:
//  • rewarded показывается только по нажатию игрока;
//  • награда выдаётся только при подтверждённом досмотре и только один раз
//    (claimId записывается в ledger сохранения ДО выдачи, повтор невозможен);
//  • игра ставится на паузу и звук приглушается на время показа;
//  • частота ограничена кулдауном; реклама не нужна для прохождения.

import { NullAdapter, MockAdapter, VKPlayAdapter, PlaygamaAdapter } from './AdAdapters.js';
import { platform } from './Platform.js';
import { saveSystem } from './SaveSystem.js';
import { audio } from './AudioSystem.js';
import { analytics } from './AnalyticsManager.js';
import { log, isDev } from './Helpers.js';

export const PLACEMENTS = {
  RUN_END_DOUBLE: { id: 'run_end_double', cooldownSec: 0 },
  REWARD_ROOM: { id: 'reward_room', cooldownSec: 60 },
  SHELTER_BONUS: { id: 'shelter_bonus', cooldownSec: 300 },
  TEMP_BOOST: { id: 'temp_boost', cooldownSec: 180 }
};

class AdManagerImpl {
  constructor() {
    this.adapter = new NullAdapter();
    this.available = false;
    this.busy = false;
    this.lastShown = {};
  }

  async init() {
    const params = new URLSearchParams(location.search);
    const mode = params.get('ads') || (platform.bridge ? 'playgama' : isDev() ? 'mock' : 'vkplay');
    this.adapter = mode === 'mock' ? new MockAdapter()
      : mode === 'playgama' && platform.bridge ? new PlaygamaAdapter(platform.bridge)
      : mode === 'vkplay' ? new VKPlayAdapter() : new NullAdapter();
    try { this.available = await this.adapter.init(); } catch (e) { log.warn('Реклама не инициализирована', e); this.available = false; }
    if (!this.available) this.adapter = new NullAdapter();
    log.info(`AdManager: адаптер «${this.adapter.name}», доступность: ${this.available}`);
  }

  canOffer(placement) {
    if (!this.available || this.busy || !this.adapter.isRewardedReady()) return false;
    const last = this.lastShown[placement.id] || 0;
    return (Date.now() - last) / 1000 >= placement.cooldownSec;
  }

  /**
   * Показ рекламы с вознаграждением. grant() вызывается не более одного
   * раза на claimId и только после подтверждённого досмотра.
   */
  async showRewarded(placement, claimId, grant, game) {
    if (!this.canOffer(placement)) return { ok: false, reason: 'unavailable' };
    if (saveSystem.hasClaimed(claimId)) return { ok: false, reason: 'already_claimed' };
    this.busy = true;
    analytics.track('ad_start', { placement: placement.id });
    const pausedScenes = this.pauseGame(game);
    audio.duck(true);
    let result = 'error';
    try { result = await this.adapter.showRewarded(placement.id); } catch (e) { log.warn('Ошибка показа рекламы', e); }
    audio.duck(false);
    this.resumeGame(game, pausedScenes);
    this.busy = false;
    this.lastShown[placement.id] = Date.now();
    analytics.track('ad_result', { placement: placement.id, result });
    if (result !== 'rewarded') return { ok: false, reason: result };
    if (!saveSystem.claimOnce(claimId)) return { ok: false, reason: 'already_claimed' };
    saveSystem.data.analytics.adsWatched++;
    try { grant(); } finally { saveSystem.save(); }
    return { ok: true };
  }

  /** Межстраничная реклама в естественной паузе (между забегами). Без награды. */
  async showInterstitial(placementId, game) {
    if (!this.available || this.busy) return 'unavailable';
    this.busy = true;
    const paused = this.pauseGame(game);
    audio.duck(true);
    let r = 'error';
    try { r = await this.adapter.showInterstitial(placementId); } catch (e) { log.warn('Ошибка межстраничной рекламы', e); }
    audio.duck(false);
    this.resumeGame(game, paused);
    this.busy = false;
    if (r === 'shown') analytics.track('ad_interstitial', { placement: placementId });
    return r;
  }

  pauseGame(game) {
    if (!game) return [];
    const list = game.scene.getScenes(true).filter((s) => s.sys.settings.key !== 'UI');
    list.forEach((s) => s.scene.pause());
    return list;
  }
  resumeGame(game, list) { list.forEach((s) => s.scene.resume()); }
}

export const adManager = new AdManagerImpl();
