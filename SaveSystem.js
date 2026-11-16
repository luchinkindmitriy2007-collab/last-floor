// Надёжные сохранения: версия + контрольная сумма + резервная копия +
// миграции + защита от повторного начисления наград (ledger).

import { SAVE_KEY, SAVE_VERSION } from './Constants.js';
import { hashString } from './Random.js';
import { log } from './Helpers.js';

const BACKUP_KEY = `${SAVE_KEY}.bak`;
const CORRUPT_KEY = `${SAVE_KEY}.corrupt`;

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function pickStorage() {
  try {
    const t = '__lf_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch (e) {
    log.warn('localStorage недоступен (приватный режим или iframe). Прогресс будет храниться только до закрытия вкладки.', e);
    return memoryStorage();
  }
}

export function defaultSave() {
  return {
    meta: {
      shards: 0,
      totalRuns: 0,
      finishedRuns: 0,
      bestFloor: 0,
      bestRun: null,
      bossesKilled: 0,
      totalPlayMs: 0,
      roomsExplored: 0,
      enemiesKilled: 0,
      secretsFound: 0,
      itemsFound: {},
      rareItemsFound: 0,
      bestiary: {},
      lore: {},
      lastClass: 'guardian',
      chapterReached: 1,
      completions: 0,
      bestClearMs: 0,
      bossesDefeated: {},
      minibossesKilled: 0
    },
    settings: { music: 0.55, sfx: 0.8, shake: true, damageNumbers: true, lighting: true },
    run: null,
    ledger: [],
    analytics: { installId: null, firstSeen: null, days: [], sessions: 0, totalSessionMs: 0, adsWatched: 0, adsOffered: 0 }
  };
}

// Миграции: ключ — версия, ИЗ которой мигрируем.
const MIGRATIONS = {
  1: (d) => {
    // v1 → v2: добавлены настройки damageNumbers, ledger и бестиарий
    d.settings = { ...defaultSave().settings, ...(d.settings || {}) };
    d.ledger = Array.isArray(d.ledger) ? d.ledger : [];
    d.meta = { ...defaultSave().meta, ...(d.meta || {}) };
    d.meta.bestiary = d.meta.bestiary || {};
    return d;
  },
  2: (d) => {
    // v2 → v3: 30 этажей и 6 глав. Старый забег (этажи 1–3+) остаётся валидным:
    // этажи 1–5 теперь первая глава.
    d.meta = { ...defaultSave().meta, ...(d.meta || {}) };
    d.meta.bossesDefeated = d.meta.bossesDefeated || {};
    d.meta.chapterReached = Math.max(1, Math.min(6, Math.ceil((d.meta.bestFloor || 1) / 5)));
    return d;
  }
};

export class SaveSystem {
  /** Подменить хранилище (например, Bridge Storage площадки) до load(). */
  useStorage(storage) { if (storage) this.storage = storage; }

  constructor(storage) {
    this.storage = storage || pickStorage();
    this.data = null;
    this.dirty = false;
  }

  checksum(json) { return hashString(`lf|${json}|${SAVE_VERSION}`).toString(36); }

  parse(raw) {
    if (!raw) return null;
    try {
      const env = JSON.parse(raw);
      if (!env || typeof env !== 'object' || !env.data) return null;
      const json = JSON.stringify(env.data);
      if (env.sum !== this.checksum(json) && env.sum !== hashString(`lf|${json}|${env.v}`).toString(36)) {
        log.warn('Контрольная сумма сохранения не совпала');
        return null;
      }
      return env;
    } catch (e) {
      log.warn('Сохранение не читается как JSON', e);
      return null;
    }
  }

  load() {
    const rawMain = this.storage.getItem(SAVE_KEY);
    let env = this.parse(rawMain);
    if (!env && rawMain) {
      log.warn('Основное сохранение повреждено — пробую резервную копию');
      try { this.storage.setItem(CORRUPT_KEY, rawMain); } catch { /* нет места */ }
      env = this.parse(this.storage.getItem(BACKUP_KEY));
      if (env) log.info('Восстановлено из резервной копии');
    }
    let data = env ? env.data : defaultSave();
    let v = env ? env.v : SAVE_VERSION;
    while (v < SAVE_VERSION) {
      const m = MIGRATIONS[v];
      if (!m) { log.warn(`Нет миграции с версии ${v}`); break; }
      data = m(data); v++;
      log.info(`Сохранение мигрировано до v${v}`);
    }
    // гарантируем наличие всех полей
    const def = defaultSave();
    data.meta = { ...def.meta, ...data.meta };
    data.settings = { ...def.settings, ...data.settings };
    data.analytics = { ...def.analytics, ...data.analytics };
    data.ledger = data.ledger || [];
    this.data = data;
    if (!env || v !== (env && env.v)) this.save();
    return this.data;
  }

  save() {
    if (!this.data) return false;
    try {
      const json = JSON.stringify(this.data);
      const env = JSON.stringify({ v: SAVE_VERSION, ts: Date.now(), sum: this.checksum(json), data: this.data });
      const prev = this.storage.getItem(SAVE_KEY);
      if (prev && this.parse(prev)) this.storage.setItem(BACKUP_KEY, prev);
      this.storage.setItem(SAVE_KEY, env);
      this.dirty = false;
      return true;
    } catch (e) {
      log.error('Не удалось записать сохранение', e);
      return false;
    }
  }

  /** Однократное начисление награды. Возвращает false, если награда уже выдана. */
  claimOnce(claimId) {
    if (this.data.ledger.includes(claimId)) return false;
    this.data.ledger.push(claimId);
    if (this.data.ledger.length > 300) this.data.ledger.splice(0, this.data.ledger.length - 300);
    this.save();
    return true;
  }
  hasClaimed(claimId) { return this.data.ledger.includes(claimId); }

  resetAll() {
    this.data = defaultSave();
    this.save();
  }
}

export const saveSystem = new SaveSystem();
