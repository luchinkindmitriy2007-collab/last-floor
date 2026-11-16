import Phaser from 'phaser';
import { DEPTH, hex } from './Constants.js';
import { normalizeText } from './PixelFont.js';
import { fxRand } from './Random.js';

/** Визуальные эффекты: частицы, телеграфы атак, всплывающие числа. */
export class FxSystem {
  constructor(scene) {
    this.scene = scene;
    this.emitters = new Map();
  }

  emitter(color, kind = 'burst') {
    const key = `${kind}:${color}`;
    if (this.emitters.has(key)) return this.emitters.get(key);
    const cfg = {
      burst: { lifespan: { min: 250, max: 500 }, speed: { min: 30, max: 110 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: 60 },
      dust: { lifespan: { min: 300, max: 600 }, speed: { min: 6, max: 22 }, scale: { start: 1, end: 0.2 }, alpha: { start: 0.55, end: 0 }, gravityY: -10 },
      trail: { lifespan: 220, speed: { min: 0, max: 8 }, scale: { start: 1, end: 0 }, alpha: { start: 0.9, end: 0 } },
      glow: { lifespan: { min: 400, max: 900 }, speed: { min: 10, max: 40 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: -30, blendMode: 'ADD' }
    }[kind];
    const e = this.scene.add.particles(0, 0, 'dot', { ...cfg, tint: color, emitting: false });
    e.setDepth(kind === 'dust' ? DEPTH.SHADOW + 1 : DEPTH.FX);
    this.emitters.set(key, e);
    return e;
  }

  burst(x, y, color = 0xffffff, n = 8) { this.emitter(color, 'burst').explode(n, x, y); }
  glowBurst(x, y, color, n = 12) { this.emitter(color, 'glow').explode(n, x, y); }
  dust(x, y, n = 2) { this.emitter(0x8a8292, 'dust').explode(n, x + fxRand(-3, 3), y); }
  trail(x, y, color) { this.emitter(color, 'trail').explode(1, x, y); }

  hitSpark(x, y, color = 0xffffff) {
    const s = this.scene.add.image(x, y, 'spark').setTint(color).setDepth(DEPTH.FX + 5).setBlendMode(Phaser.BlendModes.ADD).setScale(1.5).setRotation(fxRand(0, 1));
    this.scene.tweens.add({ targets: s, scale: 0.2, alpha: 0, duration: 140, onComplete: () => s.destroy() });
    this.burst(x, y, color, 5);
  }

  ring(x, y, radius, color, dur = 300, from = 0.2) {
    const r = this.scene.add.image(x, y, 'ring').setTint(color).setDepth(DEPTH.FX).setBlendMode(Phaser.BlendModes.ADD).setScale(from);
    this.scene.tweens.add({ targets: r, scale: (radius * 2) / 64, alpha: { from: 1, to: 0 }, duration: dur, ease: 'Cubic.Out', onComplete: () => r.destroy() });
  }

  slashAt(x, y, angle, anim = 'slash_anim', scale = 1) {
    const s = this.scene.add.sprite(x, y, anim.replace('_anim', ''), 0).setRotation(angle).setDepth(DEPTH.FX).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
    s.play(anim);
    s.once('animationcomplete', () => s.destroy());
  }

  afterimage(sprite) {
    const g = this.scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name).setOrigin(sprite.originX, sprite.originY).setFlipX(sprite.flipX).setAlpha(0.45).setTintFill(0x9ad8ff).setDepth(sprite.depth - 1).setAngle(sprite.angle);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  floatText(x, y, str, color = '#ffffff', big = false) {
    if (!this.scene.settings?.damageNumbers && /^\d+!?$/.test(String(str))) return;
    const t = this.scene.add.bitmapText(x + fxRand(-4, 4), y, 'px', normalizeText(str)).setOrigin(0.5).setTint(hex(color)).setDepth(DEPTH.FX + 20);
    if (big) t.setScale(1.5);
    this.scene.tweens.add({ targets: t, y: y - 16, duration: 550, ease: 'Cubic.Out' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 350, duration: 250, onComplete: () => t.destroy() });
  }

  /** Восклицательный знак над врагом — сигнал атаки ближнего боя. */
  warnMark(target, ch = '!') {
    const t = this.scene.add.bitmapText(target.x, target.y - 20, 'px', ch).setOrigin(0.5).setTint(ch === '!' ? 0xff5a5a : 0xffe08a).setDepth(DEPTH.FX + 10);
    this.scene.tweens.add({ targets: t, scale: { from: 2, to: 1 }, duration: 150 });
    return { destroy: () => t.destroy(), update: () => t.setPosition(target.x, target.y - 20 * target.scaleY) };
  }

  /** Нарастающее свечение — сигнал выстрела/заклинания. */
  chargeGlow(target, color, dur, yOff = -8, scale = 1) {
    const g = this.scene.add.image(target.x, target.y + yOff, 'glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.FX).setScale(0.05);
    this.scene.tweens.add({ targets: g, scale: 0.55 * scale, duration: dur * 1000, ease: 'Quad.In' });
    const iv = this.scene.time.addEvent({ delay: 60, loop: true, callback: () => this.emitter(color, 'glow').explode(1, g.x + fxRand(-10, 10), g.y + fxRand(-10, 10)) });
    return { destroy: () => { g.destroy(); iv.remove(); }, update: () => g.setPosition(target.x, target.y + yOff) };
  }

  /** Линия рывка. setAngle позволяет довести прицел во время замаха. */
  lineTelegraph(target, angle, length, width = 10) {
    const r = this.scene.add.rectangle(target.x, target.y, length, width, 0xff3a3a).setOrigin(0, 0.5).setAlpha(0.18).setDepth(DEPTH.SHADOW + 2).setRotation(angle);
    const edge = this.scene.add.rectangle(target.x, target.y, length, 1, 0xff7a7a).setOrigin(0, 0.5).setAlpha(0.7).setDepth(DEPTH.SHADOW + 2).setRotation(angle);
    this.scene.tweens.add({ targets: [r], alpha: 0.4, duration: 120, yoyo: true, repeat: -1 });
    return {
      destroy: () => { r.destroy(); edge.destroy(); },
      update: () => { r.setPosition(target.x, target.y); edge.setPosition(target.x, target.y); },
      setAngle: (a) => { r.setRotation(a); edge.setRotation(a); }
    };
  }

  /** Круг на земле, который заполняется к моменту удара. */
  circleTelegraph(x, y, radius, dur, color = 0xff4a4a, inner = 0) {
    const s = (radius * 2) / 64;
    const outline = this.scene.add.image(x, y, 'ring_thin').setTint(color).setScale(s).setAlpha(0.8).setDepth(DEPTH.SHADOW + 2);
    const fill = this.scene.add.image(x, y, 'disc').setTint(color).setScale(inner ? (inner * 2) / 64 : 0.05).setAlpha(0.22).setDepth(DEPTH.SHADOW + 1);
    this.scene.tweens.add({ targets: fill, scale: s, duration: dur * 1000, ease: 'Linear' });
    return { destroy: () => { outline.destroy(); fill.destroy(); } };
  }

  /** Круг призыва перед появлением врага. */
  spawnCircle(x, y, dur = 0.6, color = 0xb884ff) {
    const c = this.scene.add.image(x, y, 'ring_thin').setTint(color).setDepth(DEPTH.SHADOW + 1).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD);
    const g = this.scene.add.image(x, y - 2, 'glow').setTint(color).setDepth(DEPTH.FX).setScale(0.1).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: c, scale: 0.15, angle: 180, duration: dur * 1000 });
    this.scene.tweens.add({ targets: g, scale: 0.5, alpha: { from: 0.4, to: 1 }, duration: dur * 1000, onComplete: () => { c.destroy(); this.scene.tweens.add({ targets: g, alpha: 0, scale: 0.8, duration: 200, onComplete: () => g.destroy() }); } });
    this.glowBurst(x, y, color, 6);
  }

  /** Луч от союзника к союзнику (лечение, щит, усиление). */
  beam(x0, y0, x1, y1, color) {
    const g = this.scene.add.graphics().setDepth(DEPTH.FX + 2).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(2, color, 0.9).lineBetween(x0, y0, x1, y1);
    g.lineStyle(1, 0xffffff, 0.9).lineBetween(x0, y0, x1, y1);
    this.glowBurst(x1, y1, color, 6);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
  }

  /** Метка на полу, где появится телепортирующийся враг. */
  spawnMark(x, y, dur, color) {
    const r = this.scene.add.image(x, y, 'ring_thin').setTint(color).setScale(0.5).setDepth(DEPTH.SHADOW + 2).setBlendMode(Phaser.BlendModes.ADD);
    const d = this.scene.add.image(x, y, 'disc').setTint(color).setScale(0.05).setAlpha(0.3).setDepth(DEPTH.SHADOW + 1);
    this.scene.tweens.add({ targets: r, scale: 0.22, angle: 180, duration: dur * 1000 });
    this.scene.tweens.add({ targets: d, scale: 0.4, duration: dur * 1000 });
    return { destroy: () => { r.destroy(); d.destroy(); } };
  }

  stars(target, yOff = -16) {
    const list = [];
    for (let i = 0; i < 3; i++) list.push(this.scene.add.image(target.x, target.y + yOff, 'spark').setTint(0xffe08a).setDepth(DEPTH.FX + 5));
    let t = 0;
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      t += 0.12;
      list.forEach((s, i) => { const a = t + (i * Math.PI * 2) / 3; s.setPosition(target.x + Math.cos(a) * 8, target.y + yOff + Math.sin(a) * 3); });
      if (!target.active || target.state !== 'stun' && !(target.sub === 'stun')) { list.forEach((s) => s.destroy()); ev.remove(); }
    } });
  }
}

/**
 * Освещение: полупрозрачная тьма поверх комнаты, в которой «вырезаются»
 * мягкие пятна света (игрок, факелы, снаряды, сундуки).
 */
export class Lighting {
  constructor(scene, w, h, res = 0.25) {
    this.scene = scene;
    // Карта света считается в пониженном разрешении и растягивается без сглаживания:
    // в 8–16 раз меньше заполнения пикселей и «пиксельные» края света в стиле игры.
    this.res = res;
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(w * res), Math.ceil(h * res)).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.LIGHT).setScale(1 / res);
    this.stamps = [];
    this.lights = new Set();
    this.color = 0x06120c; this.alpha = 0.5;
    this.t = 0;
  }
  setAmbient(color, alpha) { this.color = color; this.alpha = alpha; }
  add(l) { l.intensity ??= 1; l.base = l.intensity; this.lights.add(l); return l; }
  remove(l) { this.lights.delete(l); }
  clear() { this.lights.clear(); }

  update(dt) {
    this.t += dt;
    const enabled = this.scene.settings?.lighting !== false;
    this.rt.setVisible(enabled);
    if (!enabled) return;
    const cam = this.scene.cameras.main;
    const sx = cam.scrollX; const sy = cam.scrollY; const w = cam.width; const h = cam.height;
    let n = 0;
    for (const l of this.lights) {
      if (l.follow) {
        if (!l.follow.active) { this.lights.delete(l); continue; }
        l.x = l.follow.x; l.y = l.follow.y - 6;
      }
      if (l.x < sx - l.radius || l.x > sx + w + l.radius || l.y < sy - l.radius || l.y > sy + h + l.radius) continue;
      let k = l.base;
      if (l.flicker) k *= 0.85 + Math.sin(this.t * 9 + l.x) * 0.08 + Math.sin(this.t * 23 + l.y) * 0.05;
      if (!this.stamps[n]) this.stamps[n] = this.scene.make.image({ key: 'light', add: false });
      this.stamps[n++].setPosition((l.x - sx) * this.res, (l.y - sy) * this.res).setScale((l.radius * 2 * this.res) / 128).setAlpha(Math.min(1, k));
    }
    // одна заливка + одно пакетное «вырезание» всех источников за кадр
    this.rt.clear();
    this.rt.fill(this.color, this.alpha);
    if (n) this.rt.erase(this.stamps.slice(0, n));
  }
}
