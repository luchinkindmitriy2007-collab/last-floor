// Слой платформы. Если игра запущена с Playgama Bridge (window.bridge),
// здесь выполняются обязательные требования площадки:
//  • bridge.initialize() до старта игры;
//  • 'game_ready' — когда игрок может играть (главное меню показано);
//  • 'gameplay_started' / 'gameplay_stopped' — начало и конец забега;
//  • пауза и выключение звука по сигналу платформы;
//  • сохранения через Bridge Storage (все ключи одним вызовом).
// Без Bridge (локально, другие площадки) всё работает как раньше.

import { log } from './Helpers.js';

const STORAGE_KEYS = ['lastfloor.save', 'lastfloor.save.bak'];

class PlatformImpl {
  constructor() {
    this.bridge = null;
    this.ready = false;
    this.readySent = false;
    this.listeners = { pause: [], audio: [] };
    this.platformPaused = false;
    this.audioEnabled = true;
  }

  get id() { return this.bridge ? this.bridge.platform.id : 'web'; }
  get language() { return this.bridge ? this.bridge.platform.language : (navigator.language || 'ru').slice(0, 2); }

  async init() {
    if (typeof window === 'undefined' || !window.bridge) return false;
    try {
      await window.bridge.initialize();
      this.bridge = window.bridge;
      const b = this.bridge;
      this.audioEnabled = b.platform.isAudioEnabled !== false;
      b.platform.on(b.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled) => { this.audioEnabled = !!enabled; this.listeners.audio.forEach((f) => f(this.audioEnabled)); });
      b.platform.on(b.EVENT_NAME.PAUSE_STATE_CHANGED, (paused) => { this.platformPaused = !!paused; this.listeners.pause.forEach((f) => f(this.platformPaused)); });
      this.storage = await this.loadStorage();
      this.ready = true;
      log.info(`Playgama Bridge ${b.version || ''}: платформа «${b.platform.id}», язык ${b.platform.language}`);
      return true;
    } catch (e) {
      log.warn('Playgama Bridge не инициализирован — игра работает без площадки', e);
      this.bridge = null;
      return false;
    }
  }

  onPause(fn) { this.listeners.pause.push(fn); }
  onAudio(fn) { this.listeners.audio.push(fn); }

  /** Сигнал «можно играть» — один раз, когда показано главное меню. */
  gameReady() {
    if (this.readySent || !this.bridge) return;
    this.readySent = true;
    this.bridge.platform.sendMessage('game_ready');
  }
  gameplayStarted() { if (!this.bridge || this.inGameplay) return; this.inGameplay = true; this.bridge.platform.sendMessage('gameplay_started'); }
  gameplayStopped() { if (!this.bridge || !this.inGameplay) return; this.inGameplay = false; this.bridge.platform.sendMessage('gameplay_stopped'); }

  /**
   * Синхронный адаптер хранилища для SaveSystem поверх Bridge Storage:
   * при старте все ключи читаются одним вызовом в память, запись —
   * отложенная и тоже одним вызовом для всех ключей.
   */
  async loadStorage() {
    const b = this.bridge;
    const mem = new Map();
    try {
      const values = await b.storage.get(STORAGE_KEYS);
      STORAGE_KEYS.forEach((k, i) => { const v = values?.[i]; if (v !== null && v !== undefined && v !== '') mem.set(k, typeof v === 'string' ? v : JSON.stringify(v)); });
    } catch (e) { log.warn('Bridge Storage: чтение не удалось', e); }
    let timer = null;
    const flush = () => {
      timer = null;
      const vals = STORAGE_KEYS.map((k) => (mem.has(k) ? mem.get(k) : ''));
      b.storage.set(STORAGE_KEYS, vals).catch((e) => log.warn('Bridge Storage: запись не удалась', e));
    };
    const schedule = () => { if (!timer) timer = setTimeout(flush, 300); };
    window.addEventListener('pagehide', () => { if (timer) { clearTimeout(timer); flush(); } });
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); if (STORAGE_KEYS.includes(k)) schedule(); },
      removeItem: (k) => { mem.delete(k); schedule(); }
    };
  }
}

export const platform = new PlatformImpl();
