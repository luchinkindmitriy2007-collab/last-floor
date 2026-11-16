// Анонимная аналитика. Персональные данные не собираются: только случайный
// идентификатор установки и игровые события. По умолчанию события остаются
// локально (агрегаты в сохранении); transport можно подключить к серверу
// аналитики, когда будет согласовано с политикой платформы.
//
// Метрики: DAU (уникальный день), D1/D7 (возврат относительно первого дня),
// длительность сессии, число забегов, средний этаж, частота rewarded-показов.

import { saveSystem } from './SaveSystem.js';
import { todayKey, uid, isDev, log } from './Helpers.js';

class AnalyticsImpl {
  constructor() {
    this.sessionStart = Date.now();
    this.queue = [];
    this.transport = null; // (events[]) => Promise — подключается позже
  }

  init() {
    const a = saveSystem.data.analytics;
    if (!a.installId) a.installId = uid();
    if (!a.firstSeen) a.firstSeen = todayKey();
    const today = todayKey();
    if (!a.days.includes(today)) a.days.push(today);
    if (a.days.length > 60) a.days.splice(0, a.days.length - 60);
    a.sessions++;
    saveSystem.save();
    this.track('session_start', { dayIndex: this.dayIndex(today) });
    const end = () => this.endSession();
    window.addEventListener('pagehide', end);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flushSessionTime(); });
  }

  dayIndex(day) {
    const a = saveSystem.data.analytics;
    return Math.round((new Date(day) - new Date(a.firstSeen)) / 86400000);
  }

  /** Локально вычисляемые показатели удержания этого игрока. */
  retention() {
    const a = saveSystem.data.analytics;
    const idx = a.days.map((d) => this.dayIndex(d));
    return { d1: idx.includes(1), d7: idx.includes(7), activeDays: a.days.length };
  }

  flushSessionTime() {
    const now = Date.now();
    const a = saveSystem.data.analytics;
    a.totalSessionMs += now - this.sessionStart;
    this.sessionStart = now;
    saveSystem.save();
  }

  endSession() { this.flushSessionTime(); this.track('session_end', {}); this.flush(); }

  track(name, props = {}) {
    const ev = { name, t: Date.now(), ...props };
    this.queue.push(ev);
    if (this.queue.length > 200) this.queue.shift();
    if (isDev()) log.info('analytics', name, props);
  }

  async flush() {
    if (!this.transport || !this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    try { await this.transport(batch); } catch { this.queue.unshift(...batch); }
  }

  summary() {
    const m = saveSystem.data.meta; const a = saveSystem.data.analytics;
    return {
      sessions: a.sessions,
      avgSessionMin: a.sessions ? +(a.totalSessionMs / a.sessions / 60000).toFixed(1) : 0,
      runs: m.totalRuns,
      bestFloor: m.bestFloor,
      adsPerRun: m.totalRuns ? +(a.adsWatched / m.totalRuns).toFixed(2) : 0,
      ...this.retention()
    };
  }
}

export const analytics = new AnalyticsImpl();
