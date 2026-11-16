// Аудиосистема на WebAudio: процедурные звуковые эффекты и оригинальная
// генеративная музыка (секвенсор с опережающим планированием).
// Позже любой звук/трек можно заменить файлом OGG/MP3 через registerFile().

import { mulberry32 } from './Random.js';
import { log } from './Helpers.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Оригинальные треки: тональность, лад, гармония, характер.
const TRACKS = {
  menu: { bpm: 72, root: 50, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 4], arp: [0, 2, 4, 2, 7, 4, 2, 4], seed: 11, lead: 'bell', drums: 0, padVol: 0.16 },
  ruins: { bpm: 96, root: 45, scale: [0, 2, 3, 5, 7, 8, 11], chords: [0, 0, 5, 4, 0, 3, 5, 4], arp: [0, 4, 2, 4, 7, 4, 2, 4], seed: 23, lead: 'pluck', drums: 1, padVol: 0.12 },
  boss: { bpm: 138, root: 40, scale: [0, 1, 3, 5, 7, 8, 10], chords: [0, 0, 1, 0, 5, 3, 1, 0], arp: [0, 2, 4, 2, 0, 4, 2, 7], seed: 37, lead: 'saw', drums: 2, padVol: 0.1 },
  fire: { bpm: 108, root: 43, scale: [0, 1, 4, 5, 7, 8, 10], chords: [0, 1, 0, 5, 0, 1, 3, 1], arp: [0, 2, 4, 2, 0, 4, 2, 4], seed: 41, lead: 'saw', drums: 1, padVol: 0.1 },
  ice: { bpm: 84, root: 52, scale: [0, 2, 3, 7, 8], chords: [0, 3, 1, 4, 0, 3, 2, 4], arp: [0, 2, 4, 6, 4, 2, 4, 6], seed: 53, lead: 'bell', drums: 0, padVol: 0.16 },
  necro: { bpm: 76, root: 41, scale: [0, 1, 3, 5, 6, 8, 10], chords: [0, 0, 4, 3, 0, 1, 4, 3], arp: [0, 4, 2, 4, 0, 4, 1, 4], seed: 67, lead: 'pluck', drums: 1, padVol: 0.14 },
  crystal: { bpm: 100, root: 55, scale: [0, 2, 4, 6, 7, 9, 11], chords: [0, 3, 5, 4, 0, 3, 6, 4], arp: [0, 2, 4, 7, 4, 2, 7, 4], seed: 71, lead: 'bell', drums: 1, padVol: 0.13 },
  heart: { bpm: 90, root: 38, scale: [0, 1, 3, 5, 6, 8, 9], chords: [0, 1, 0, 6, 0, 1, 3, 6], arp: [0, 4, 0, 2, 0, 4, 1, 2], seed: 83, lead: 'saw', drums: 2, padVol: 0.12 },
  finale: { bpm: 150, root: 38, scale: [0, 1, 3, 5, 6, 8, 10], chords: [0, 0, 1, 1, 5, 5, 6, 1], arp: [0, 2, 4, 7, 4, 2, 0, 4], seed: 97, lead: 'saw', drums: 2, padVol: 0.12 },
  shrine: { bpm: 64, root: 52, scale: [0, 2, 4, 7, 9], chords: [0, 3, 4, 3], arp: [0, 2, 4, 2, 4, 2, 0, 2], seed: 5, lead: 'bell', drums: 0, padVol: 0.18 }
};

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.55;
    this.sfxVol = 0.8;
    this.current = null;
    this.lastPlay = new Map();
    this.noise = null;
    this.timer = null;
    this.ready = false;
    this.muted = false;
  }

  /** Создаёт контекст при первом взаимодействии пользователя (политика автозапуска браузеров). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = (this.muted || this.platformMuted) ? 0 : 1; this.master.connect(this.ctx.destination);
      this.comp = this.ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
      this.comp.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicVol * 0.5; this.musicGain.connect(this.comp);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.comp);
      // простая реверберация для атмосферы
      this.verb = this.ctx.createConvolver(); this.verb.buffer = this.impulse(2.2, 2.5);
      this.verbGain = this.ctx.createGain(); this.verbGain.gain.value = 0.28;
      this.verb.connect(this.verbGain); this.verbGain.connect(this.comp);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ready = true;
      if (this.pendingTrack) { const t = this.pendingTrack; this.pendingTrack = null; this.playMusic(t); }
    } catch (e) { log.warn('WebAudio недоступен', e); }
  }

  impulse(sec, decay) {
    const rate = this.ctx.sampleRate; const len = rate * sec;
    const b = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }

  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (this.ready) {
      this.musicGain.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.05);
      this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    }
  }

  /** Временное приглушение (например, на время показа рекламы). */
  duck(on) {
    this.muted = on;
    this.applyMaster();
  }

  /** Звук выключен площадкой (Playgama: audio_state_changed / пауза). */
  setPlatformMute(on) {
    this.platformMuted = on;
    this.applyMaster();
  }

  applyMaster() {
    const off = this.muted || this.platformMuted;
    if (this.ready) this.master.gain.setTargetAtTime(off ? 0 : 1, this.ctx.currentTime, 0.08);
  }

  // ------------------------------------------------------------ SFX
  env(gainNode, t, a, peak, dcy, sustain = 0.0001) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + a);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + dcy);
  }
  tone(type, f0, f1, dur, vol, { t = 0, a = 0.005, dest, verb = 0 } = {}) {
    const c = this.ctx; const now = c.currentTime + t;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    this.env(g, now, a, vol, dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    o.start(now); o.stop(now + a + dur + 0.05);
  }
  noiseHit(dur, vol, { t = 0, type = 'bandpass', f = 1200, q = 1, f1, dest, verb = 0 } = {}) {
    const c = this.ctx; const now = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, now); fl.Q.value = q;
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, now + dur);
    const g = c.createGain(); this.env(g, now, 0.003, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfxGain);
    if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    s.start(now, Math.random() * 0.5); s.stop(now + dur + 0.05);
  }

  sfx(name, opts = {}) {
    if (!this.ready || this.sfxVol <= 0) return;
    const now = performance.now();
    const minGap = opts.gap ?? 35;
    if (now - (this.lastPlay.get(name) || 0) < minGap) return;
    this.lastPlay.set(name, now);
    const p = opts.pitch || 1;
    const r = 1 + (Math.random() - 0.5) * 0.08;
    try {
      switch (name) {
        case 'swing': this.noiseHit(0.12, 0.35, { f: 2400 * p, f1: 700, q: 0.8 }); break;
        case 'throw': this.noiseHit(0.08, 0.22, { f: 3200 * r, f1: 1500, q: 1.5 }); this.tone('triangle', 900 * r, 1400, 0.06, 0.05); break;
        case 'magic': this.tone('sine', 520 * r, 980, 0.18, 0.16, { verb: 0.3 }); this.tone('triangle', 1040 * r, 1500, 0.12, 0.06, { t: 0.02 }); break;
        case 'hit': this.noiseHit(0.07, 0.4, { f: 900 * r * p, q: 1.2 }); this.tone('square', 180 * r * p, 90 * p, 0.07, 0.08); break;
        case 'crit': this.noiseHit(0.1, 0.5, { f: 1800, q: 2 }); this.tone('square', 320, 120, 0.1, 0.12); this.tone('sine', 1600, 2200, 0.08, 0.08, { t: 0.02 }); break;
        case 'enemyDie': this.noiseHit(0.22, 0.4, { f: 600 * r, f1: 150, q: 0.8 }); this.tone('square', 220 * r, 55, 0.2, 0.08); break;
        case 'hurt': this.tone('sawtooth', 300, 90, 0.22, 0.2); this.noiseHit(0.15, 0.35, { f: 500, q: 0.7 }); break;
        case 'pickup': this.tone('square', 880 * r, 880, 0.05, 0.08); this.tone('square', 1320 * r, 1320, 0.07, 0.08, { t: 0.05 }); break;
        case 'coin': this.tone('square', 1568 * r, 1568, 0.04, 0.06); this.tone('square', 2093 * r, 2093, 0.08, 0.06, { t: 0.045 }); break;
        case 'heal': [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.12, { t: i * 0.06, verb: 0.3 })); break;
        case 'chest': this.noiseHit(0.25, 0.3, { type: 'lowpass', f: 700 }); [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.12, { t: 0.12 + i * 0.07, verb: 0.4 })); break;
        case 'item': [659, 784, 988, 1319].forEach((f, i) => this.tone('square', f, f, 0.12, 0.07, { t: i * 0.07, verb: 0.3 })); this.tone('sine', 1976, 1976, 0.5, 0.06, { t: 0.3, verb: 0.5 }); break;
        case 'door': this.noiseHit(0.35, 0.35, { type: 'lowpass', f: 400, f1: 120 }); this.tone('square', 70, 50, 0.3, 0.12); break;
        case 'doorOpen': this.noiseHit(0.3, 0.25, { type: 'lowpass', f: 300, f1: 900 }); this.tone('triangle', 196, 294, 0.25, 0.08); break;
        case 'step': this.noiseHit(0.04, 0.05, { f: 400 * r, q: 1 }); break;
        case 'dash': this.noiseHit(0.18, 0.3, { f: 600, f1: 3000, q: 0.6 }); break;
        case 'barrier': this.tone('sine', 220, 440, 0.4, 0.16, { verb: 0.4 }); this.tone('triangle', 330, 660, 0.35, 0.08); break;
        case 'nova': this.noiseHit(0.5, 0.45, { type: 'lowpass', f: 2000, f1: 200 }); this.tone('sine', 140, 60, 0.45, 0.25); break;
        case 'explode': this.noiseHit(0.45, 0.6, { type: 'lowpass', f: 1500, f1: 100 }); this.tone('sine', 110, 40, 0.4, 0.3); break;
        case 'zap': this.noiseHit(0.12, 0.35, { f: 4000, q: 4 }); this.tone('sawtooth', 1200, 300, 0.1, 0.06); break;
        case 'shoot': this.tone('square', 600 * r, 300, 0.09, 0.06); break;
        case 'telegraph': this.tone('triangle', 700 * p, 900 * p, 0.12, 0.06); break;
        case 'charge': this.noiseHit(0.5, 0.35, { type: 'lowpass', f: 300, f1: 900 }); this.tone('sawtooth', 80, 160, 0.45, 0.12); break;
        case 'slam': this.noiseHit(0.6, 0.7, { type: 'lowpass', f: 800, f1: 60 }); this.tone('sine', 90, 30, 0.6, 0.45); break;
        case 'roar': this.tone('sawtooth', 110, 70, 0.9, 0.2, { verb: 0.5 }); this.noiseHit(0.9, 0.3, { type: 'lowpass', f: 600, f1: 200, verb: 0.4 }); break;
        case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.14, 0.08, { t: i * 0.06, verb: 0.4 })); break;
        case 'uiMove': this.tone('square', 660, 660, 0.03, 0.04); break;
        case 'uiOk': this.tone('square', 880, 1320, 0.07, 0.07); break;
        case 'uiBack': this.tone('square', 660, 440, 0.07, 0.06); break;
        case 'deny': this.tone('square', 200, 150, 0.15, 0.08); break;
        case 'buy': this.tone('square', 1046, 1046, 0.05, 0.07); this.tone('square', 1568, 1568, 0.1, 0.07, { t: 0.06 }); break;
        case 'secret': [440, 554, 659, 880, 1109].forEach((f, i) => this.tone('sine', f, f, 0.35, 0.1, { t: i * 0.1, verb: 0.6 })); break;
        case 'stairs': [784, 659, 523, 392].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.1, { t: i * 0.09, verb: 0.5 })); break;
        case 'victory': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.22, 0.08, { t: i * 0.12, verb: 0.5 })); break;
        case 'defeat': [392, 349, 311, 262].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.45, 0.12, { t: i * 0.3, verb: 0.6 })); break;
        case 'shield': this.tone('sine', 1200, 600, 0.2, 0.1); break;
        case 'bite': this.noiseHit(0.06, 0.35, { f: 2600 * r, q: 2 }); this.tone('square', 420 * r, 200, 0.06, 0.07); break;
        case 'fire': this.noiseHit(0.3, 0.35, { type: 'lowpass', f: 1800, f1: 400 }); break;
        case 'freeze': this.tone('sine', 1800 * r, 2600, 0.15, 0.08); this.noiseHit(0.2, 0.2, { type: 'highpass', f: 5000 }); break;
        case 'teleport': this.tone('sine', 300, 1200, 0.25, 0.1, { verb: 0.4 }); this.tone('triangle', 1200, 300, 0.2, 0.05, { t: 0.1 }); break;
        case 'summon': this.tone('sawtooth', 110, 220, 0.6, 0.08, { verb: 0.5 }); this.tone('sine', 330, 660, 0.5, 0.06, { t: 0.1, verb: 0.5 }); break;
        case 'shieldBlock': this.tone('square', 1500 * r, 900, 0.07, 0.07); this.noiseHit(0.05, 0.3, { f: 3000, q: 3 }); break;
        case 'wake': this.noiseHit(0.5, 0.35, { type: 'lowpass', f: 200, f1: 700 }); this.tone('sawtooth', 70, 110, 0.5, 0.1); break;
        case 'soul': this.tone('sine', 700 * r, 300, 0.4, 0.08, { verb: 0.6 }); break;
        case 'heal_enemy': [660, 880].forEach((f, i) => this.tone('sine', f, f, 0.2, 0.06, { t: i * 0.07, verb: 0.4 })); break;
        case 'beam': this.tone('sawtooth', 200, 180, 0.8, 0.1); this.noiseHit(0.8, 0.2, { f: 1200, q: 4 }); break;
        case 'bossIntro': this.tone('sawtooth', 55, 82, 1.4, 0.2, { verb: 0.6 }); this.noiseHit(1.2, 0.3, { type: 'lowpass', f: 300, f1: 900, verb: 0.5 }); [220, 233, 220].forEach((f, i) => this.tone('square', f, f, 0.3, 0.05, { t: 0.4 + i * 0.25, verb: 0.5 })); break;
        case 'heartbeat': this.tone('sine', 70, 40, 0.18, 0.4); this.tone('sine', 60, 35, 0.2, 0.3, { t: 0.18 }); break;
        case 'shatter': for (let i = 0; i < 6; i++) this.tone('triangle', 2000 + Math.random() * 2000, 1500, 0.15, 0.05, { t: i * 0.04 }); this.noiseHit(0.4, 0.4, { type: 'highpass', f: 3000 }); break;
        default: break;
      }
    } catch (e) { /* звук не критичен */ }
  }

  // ------------------------------------------------------------ Музыка
  playMusic(name) {
    if (!TRACKS[name]) return;
    if (!this.ready) { this.pendingTrack = name; return; }
    if (this.current && this.current.name === name) return;
    this.stopMusic(1.2);
    const tr = TRACKS[name];
    const bus = this.ctx.createGain(); bus.gain.value = 0.0001; bus.connect(this.musicGain);
    const vb = this.ctx.createGain(); vb.gain.value = 0.35; bus.connect(vb); vb.connect(this.verb);
    bus.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 1.5);
    const melody = this.composeMelody(tr);
    this.current = { name, tr, bus, step: 0, nextTime: this.ctx.currentTime + 0.1, melody };
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic(fade = 0.6) {
    if (!this.current || !this.ready) { this.current = null; return; }
    const { bus } = this.current;
    const t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => bus.disconnect(), fade * 1000 + 200);
    this.current = null;
    clearInterval(this.timer);
  }

  /** Мелодия строится один раз по seed трека — каждый раз одна и та же оригинальная тема. */
  composeMelody(tr) {
    const rnd = mulberry32(tr.seed);
    const notes = []; let deg = 4;
    for (let i = 0; i < 64; i++) {
      if (rnd() < 0.35) { notes.push(null); continue; }
      deg += Math.floor(rnd() * 5) - 2; deg = Math.max(0, Math.min(9, deg));
      notes.push(deg);
    }
    return notes;
  }

  schedule() {
    const cur = this.current; if (!cur || this.ctx.state !== 'running') return;
    const tr = cur.tr; const stepDur = 60 / tr.bpm / 2;
    while (cur.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(cur, cur.step, cur.nextTime, stepDur);
      cur.nextTime += stepDur; cur.step++;
    }
  }

  playStep(cur, step, t, sd) {
    const tr = cur.tr; const c = this.ctx; const bus = cur.bus;
    const bar = Math.floor(step / 8) % tr.chords.length; const s8 = step % 8;
    const chordDeg = tr.chords[bar];
    const sc = tr.scale; const L = sc.length;
    const deg2midi = (d) => tr.root + 12 + sc[((d % L) + L) % L] + 12 * Math.floor(d / L);
    const voice = (type, f, dur, vol, cutoff = 2400, attack = 0.01) => {
      const o = c.createOscillator(); const g = c.createGain(); const fl = c.createBiquadFilter();
      o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
    };
    // пэд — аккорд на такт
    if (s8 === 0) [0, 2, 4].forEach((k) => voice('triangle', NOTE(deg2midi(chordDeg + k) - 12), sd * 8.2, tr.padVol * 0.5, 900, 0.4));
    // бас
    if (s8 % 4 === 0 || (tr.drums === 2 && s8 % 2 === 0)) voice('square', NOTE(deg2midi(chordDeg) - 24), sd * 1.6, 0.11, 500);
    // арпеджио
    const ar = tr.arp[s8];
    voice(tr.lead === 'saw' ? 'sawtooth' : 'square', NOTE(deg2midi(chordDeg + ar)), sd * 0.9, 0.035, tr.lead === 'saw' ? 1800 : 1400);
    // мелодия (каждые 2 такта, на сильные доли)
    const mel = cur.melody[step % cur.melody.length];
    if (mel !== null && (bar % 2 === 1) && s8 % 2 === 0) {
      const type = tr.lead === 'bell' ? 'sine' : tr.lead === 'pluck' ? 'triangle' : 'square';
      voice(type, NOTE(deg2midi(mel) + 12), sd * (tr.lead === 'bell' ? 3 : 1.7), tr.lead === 'bell' ? 0.07 : 0.05, 3000);
    }
    // ударные
    if (tr.drums) {
      if (s8 === 0 || s8 === 4 || (tr.drums === 2 && s8 === 6)) {
        const o = c.createOscillator(); const g = c.createGain();
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.2);
      }
      if (s8 % 2 === 1 || tr.drums === 2) {
        const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
        const g = c.createGain(); g.gain.setValueAtTime(tr.drums === 2 ? 0.05 : 0.035, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + 0.06);
      }
      if (s8 === 4 && tr.drums === 2) {
        const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
        const g = c.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + 0.15);
      }
    }
  }
}

export const audio = new AudioSystem();
