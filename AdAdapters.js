// Адаптеры рекламных площадок. Игра общается только с AdManager,
// AdManager — только с адаптером. Чтобы подключить VK Play, нужно
// реализовать VKPlayAdapter по официальной документации платформы.
//
// Контракт адаптера:
//   name: string
//   init(): Promise<boolean>              — загрузка SDK, true если реклама доступна
//   isRewardedReady(): boolean            — можно ли сейчас показать rewarded
//   showRewarded(placement): Promise<'rewarded'|'closed'|'error'|'unavailable'>
//       'rewarded' — ТОЛЬКО если площадка подтвердила досмотр (колбэк/событие награды)
//   showInterstitial(placement): Promise<'shown'|'error'|'unavailable'>

/** Нет рекламы: игра полностью работает, кнопки рекламы скрыты. */
export class NullAdapter {
  constructor() { this.name = 'none'; }
  async init() { return false; }
  isRewardedReady() { return false; }
  async showRewarded() { return 'unavailable'; }
  async showInterstitial() { return 'unavailable'; }
}

/**
 * Тестовый адаптер для разработки (?ads=mock или localhost).
 * Показывает оверлей «рекламы» на 3 секунды; кнопкой «Закрыть» можно
 * прервать показ — тогда награда НЕ выдаётся (проверка честной логики).
 */
export class MockAdapter {
  constructor() { this.name = 'mock'; }
  async init() { return true; }
  isRewardedReady() { return true; }
  showRewarded(placement) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;background:rgba(5,4,8,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:#f2e6c9;font:16px monospace;gap:16px';
      let left = 3;
      el.innerHTML = `<div>ТЕСТОВАЯ РЕКЛАМА (${placement})</div><div id="lf-ad-t">${left}</div><button id="lf-ad-x" style="font:14px monospace;padding:6px 14px">Закрыть (без награды)</button>`;
      document.body.appendChild(el);
      const done = (r) => { clearInterval(iv); el.remove(); resolve(r); };
      el.querySelector('#lf-ad-x').onclick = () => done('closed');
      const iv = setInterval(() => {
        left--; const t = el.querySelector('#lf-ad-t'); if (t) t.textContent = left;
        if (left <= 0) done('rewarded');
      }, 1000);
    });
  }
  async showInterstitial() { return 'shown'; }
}

/**
 * VK Play — заготовка. Методы SDK намеренно НЕ вызываются: их имена и
 * сигнатуры нужно взять из актуальной официальной документации VK Play
 * для HTML5-игр после подтверждения доступа к рекламным форматам.
 *
 * Что сделать при интеграции:
 *  1. Подключить скрипт SDK площадки (index.html или динамически в init()).
 *  2. В init(): дождаться инициализации SDK, вернуть true при успехе.
 *  3. В showRewarded(): вызвать показ видео с вознаграждением и вернуть
 *     'rewarded' только в обработчике подтверждённого досмотра; при закрытии
 *     — 'closed'; при ошибке/отсутствии рекламы — 'error'/'unavailable'.
 *  4. Сообщить AdManager о паузе/возобновлении игры (это уже делается снаружи).
 */
export class VKPlayAdapter {
  constructor() { this.name = 'vkplay'; this.ready = false; }
  async init() {
    // TODO(VK Play): инициализация SDK по документации платформы.
    this.ready = false;
    return false;
  }
  isRewardedReady() { return this.ready; }
  async showRewarded() { return 'unavailable'; }
  async showInterstitial() { return 'unavailable'; }
}

/**
 * Playgama Bridge (https://github.com/playgama/bridge). Используются
 * только документированные методы bridge.advertisement:
 * showRewarded/showInterstitial и события REWARDED_STATE_CHANGED /
 * INTERSTITIAL_STATE_CHANGED (loading|opened|closed|rewarded|failed).
 * Награда — только если пришло состояние 'rewarded'.
 */
export class PlaygamaAdapter {
  constructor(bridge) { this.name = 'playgama'; this.bridge = bridge; this.pending = null; this.pendingInter = null; }
  async init() {
    const b = this.bridge; const ad = b && b.advertisement;
    if (!ad) return false;
    ad.on(b.EVENT_NAME.REWARDED_STATE_CHANGED, (state) => {
      const p = this.pending; if (!p) return;
      if (state === 'rewarded') p.rewarded = true;
      else if (state === 'closed') this.finish(p.rewarded ? 'rewarded' : 'closed');
      else if (state === 'failed') this.finish(p.rewarded ? 'rewarded' : 'error');
    });
    ad.on(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (state) => {
      const p = this.pendingInter; if (!p) return;
      if (state === 'closed' || state === 'failed') { this.pendingInter = null; clearTimeout(p.timer); p.resolve(state === 'closed' ? 'shown' : 'error'); }
    });
    return !!ad.isRewardedSupported || !!ad.isInterstitialSupported;
  }
  isRewardedReady() { return !!this.bridge.advertisement.isRewardedSupported && !this.pending; }
  finish(result) {
    const p = this.pending; if (!p) return;
    this.pending = null; clearTimeout(p.timer); p.resolve(result);
  }
  showRewarded(placement) {
    return new Promise((resolve) => {
      // страховка: если площадка не ответила за 3 минуты — без награды
      this.pending = { resolve, rewarded: false, timer: setTimeout(() => this.finish('error'), 180000) };
      try { this.bridge.advertisement.showRewarded(placement); } catch (e) { this.finish('error'); }
    });
  }
  showInterstitial(placement) {
    const ad = this.bridge.advertisement;
    if (!ad.isInterstitialSupported || this.pendingInter) return Promise.resolve('unavailable');
    return new Promise((resolve) => {
      // если показ не начнётся (например, сработал minimumDelay) — не ждём
      const p = { resolve, timer: setTimeout(() => { if (this.pendingInter === p) { this.pendingInter = null; resolve('unavailable'); } }, 2500) };
      this.pendingInter = p;
      const stopWait = (state) => { if (state === 'opened' && this.pendingInter === p) { clearTimeout(p.timer); p.timer = setTimeout(() => { if (this.pendingInter === p) { this.pendingInter = null; resolve('shown'); } }, 120000); } };
      ad.on(this.bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, stopWait);
      try { ad.showInterstitial(placement); } catch (e) { this.pendingInter = null; clearTimeout(p.timer); resolve('error'); }
    });
  }
}
