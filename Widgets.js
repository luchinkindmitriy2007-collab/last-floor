import Phaser from 'phaser';
import { normalizeText } from './PixelFont.js';
import { audio } from './AudioSystem.js';
import { hex, COLORS } from './Constants.js';

/** Пиксельный текст. color — '#rrggbb'. */
export function txt(scene, x, y, str, opts = {}) {
  const t = scene.add.bitmapText(x, y, 'px', normalizeText(str));
  t.setTint(hex(opts.color || COLORS.text));
  if (opts.scale) t.setScale(opts.scale);
  if (opts.origin !== undefined) Array.isArray(opts.origin) ? t.setOrigin(...opts.origin) : t.setOrigin(opts.origin);
  if (opts.maxWidth) t.setMaxWidth(opts.maxWidth);
  if (opts.depth !== undefined) t.setDepth(opts.depth);
  return t;
}
export function setTxt(t, str, color) {
  t.setText(normalizeText(str));
  if (color) t.setTint(hex(color));
  return t;
}

/** Перенос строк по словам для моноширинного шрифта (6 px на символ). */
export function wrap(str, maxChars) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if ((line + ' ' + word).trim().length > maxChars) { if (line) out.push(line); line = word; } else line = (line + ' ' + word).trim();
    }
    out.push(line);
  }
  return out.join('\n');
}

export function panel(scene, x, y, w, h, key = 'panel') {
  return scene.add.nineslice(x, y, key, undefined, w, h, 6, 6, 6, 6).setOrigin(0, 0);
}

export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, label, onClick, opts = {}) {
    super(scene, x, y);
    this.w = w; this.h = h;
    this.onClick = onClick;
    this.enabled = opts.enabled !== false;
    this.bg = scene.add.nineslice(0, 0, 'btn', undefined, w, h, 6, 6, 6, 6).setOrigin(0.5);
    this.hl = scene.add.nineslice(0, 0, 'btn_hl', undefined, w, h, 6, 6, 6, 6).setOrigin(0.5).setVisible(false);
    this.label = txt(scene, 0, -1, label, { origin: 0.5, color: opts.color });
    this.baseColor = opts.color || COLORS.text;
    this.add([this.bg, this.hl, this.label]);
    if (opts.icon) {
      this.icon = scene.add.image(-w / 2 + 10, 0, opts.icon.key, opts.icon.frame);
      this.add(this.icon);
      this.label.x += 6;
    }
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => { if (this.group) this.group.focus(this); else this.setFocused(true); });
    this.on('pointerout', () => { if (!this.group) this.setFocused(false); });
    this.on('pointerdown', () => this.press());
    scene.add.existing(this);
    this.setEnabled(this.enabled);
  }
  setFocused(f) {
    if (this.focused === f) return;
    this.focused = f;
    this.hl.setVisible(f && this.enabled);
    this.label.setTint(hex(!this.enabled ? COLORS.dim : f ? '#fff4c8' : this.baseColor));
    if (f && this.enabled) {
      audio.sfx('uiMove', { gap: 50 });
      this.scene.tweens.add({ targets: this, scaleX: 1.04, scaleY: 1.04, duration: 80, yoyo: true });
    }
  }
  setEnabled(e) {
    this.enabled = e;
    this.label.setTint(hex(e ? this.baseColor : COLORS.dim));
    this.bg.setAlpha(e ? 1 : 0.6);
    if (!e) this.hl.setVisible(false);
    return this;
  }
  setLabel(s, color) { setTxt(this.label, s, color); if (color) this.baseColor = color; return this; }
  press() {
    if (!this.enabled) { audio.sfx('deny'); return; }
    audio.sfx('uiOk');
    this.scene.tweens.add({ targets: this, scaleX: 0.95, scaleY: 0.95, duration: 50, yoyo: true });
    this.onClick && this.onClick(this);
  }
}

/** Группа кнопок с навигацией стрелками/WASD и подтверждением Enter/Space. */
export class FocusGroup {
  constructor(scene, buttons = [], { columns = 1, onBack } = {}) {
    this.scene = scene; this.buttons = []; this.columns = columns; this.index = 0; this.onBack = onBack;
    buttons.forEach((b) => this.add(b));
    this.keyHandler = (e) => this.onKey(e);
    scene.input.keyboard.on('keydown', this.keyHandler);
    scene.events.once('shutdown', () => this.destroy());
    if (this.buttons.length) this.focus(this.buttons.find((b) => b.enabled) || this.buttons[0]);
  }
  add(b) { b.group = this; this.buttons.push(b); return b; }
  focus(b) {
    this.buttons.forEach((x) => x.setFocused(x === b));
    this.index = this.buttons.indexOf(b);
  }
  move(d) {
    const n = this.buttons.length; if (!n) return;
    let i = this.index;
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (this.buttons[i].enabled && this.buttons[i].visible) break; }
    this.focus(this.buttons[i]);
  }
  onKey(e) {
    if (this.disabled) return;
    const k = e.code;
    if (k === 'ArrowDown' || k === 'KeyS') this.move(this.columns);
    else if (k === 'ArrowUp' || k === 'KeyW') this.move(-this.columns);
    else if (k === 'ArrowRight' || k === 'KeyD') this.move(1);
    else if (k === 'ArrowLeft' || k === 'KeyA') this.move(-1);
    else if (k === 'Enter' || k === 'Space' || k === 'KeyE') { const b = this.buttons[this.index]; if (b) b.press(); }
    else if (k === 'Escape' && this.onBack) { audio.sfx('uiBack'); this.onBack(); }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.input.keyboard.off('keydown', this.keyHandler);
  }
}

/** Плавное появление окна. */
export function popIn(scene, targets, delay = 0) {
  const arr = Array.isArray(targets) ? targets : [targets];
  arr.forEach((t, i) => {
    const sy = t.scaleY;
    t.setAlpha(0); t.scaleY = sy * 0.85;
    scene.tweens.add({ targets: t, alpha: 1, scaleY: sy, duration: 160, delay: delay + i * 30, ease: 'Back.Out' });
  });
}

/** Полоса (здоровье/опыт). */
export class Bar {
  constructor(scene, x, y, w, h, color, back = '#1a1220') {
    this.scene = scene; this.w = w; this.h = h;
    this.frame = scene.add.rectangle(x - 1, y - 1, w + 2, h + 2, 0x0d0a12).setOrigin(0);
    this.back = scene.add.rectangle(x, y, w, h, hex(back)).setOrigin(0);
    this.trail = scene.add.rectangle(x, y, w, h, 0xffffff).setOrigin(0).setAlpha(0.7);
    this.fill = scene.add.rectangle(x, y, w, h, hex(color)).setOrigin(0);
    this.shine = scene.add.rectangle(x, y, w, 1, 0xffffff).setOrigin(0).setAlpha(0.25);
    this.value = 1; this.trailValue = 1;
  }
  set(v) {
    v = Phaser.Math.Clamp(v, 0, 1);
    if (v < this.value) this.trailValue = Math.max(this.trailValue, this.value);
    this.value = v;
    this.fill.width = Math.round(this.w * v);
    this.shine.width = this.fill.width;
  }
  update(dt) {
    if (this.trailValue > this.value) this.trailValue = Math.max(this.value, this.trailValue - dt * 0.6);
    else this.trailValue = this.value;
    this.trail.width = Math.round(this.w * this.trailValue);
  }
  setVisible(v) { [this.frame, this.back, this.trail, this.fill, this.shine].forEach((o) => o.setVisible(v)); return this; }
  setDepth(d) { [this.frame, this.back, this.trail, this.fill, this.shine].forEach((o, i) => o.setDepth(d + i * 0.01)); return this; }
  setScrollFactor(f) { [this.frame, this.back, this.trail, this.fill, this.shine].forEach((o) => o.setScrollFactor(f)); return this; }
  destroy() { [this.frame, this.back, this.trail, this.fill, this.shine].forEach((o) => o.destroy()); }
}
