import Phaser from 'phaser';
import { DEPTH, hex } from './Constants.js';
import { normalizeText } from './PixelFont.js';

/**
 * Объект, с которым можно взаимодействовать клавишей E: сундук, фонтан,
 * алтарь, товар, лестница, записка. Подсказка появляется рядом с игроком.
 */
export class Interactable {
  constructor(scene, x, y, { texture, frame = 0, anim, prompt, onUse, radius = 22, light, glow, label, labelColor = '#ffd24a', shadow = true, depthOffset = 0, scale = 1 }) {
    this.scene = scene; this.x = x; this.y = y;
    this.radius = radius; this.prompt = prompt; this.onUse = onUse; this.enabled = true;
    this.sprite = texture ? scene.add.sprite(x, y, texture, frame).setOrigin(0.5, 0.8).setDepth(DEPTH.ENTITY + y * 0.01 + depthOffset).setScale(scale) : null;
    if (anim && this.sprite) this.sprite.play(anim);
    if (shadow && this.sprite) this.shadow = scene.add.image(x, y + 1, 'shadow').setDepth(DEPTH.SHADOW).setScale(scale);
    if (glow) {
      this.glow = scene.add.image(x, y - 6, 'glow').setTint(glow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setScale(0.7).setDepth(DEPTH.ENTITY - 1);
      scene.tweens.add({ targets: this.glow, alpha: 0.18, duration: 900, yoyo: true, repeat: -1 });
    }
    if (light) this.light = scene.lighting.add({ x, y: y - 6, radius: light, intensity: 0.85 });
    if (label) this.label = scene.add.bitmapText(x, y - 24, 'px', normalizeText(label)).setOrigin(0.5).setTint(hex(labelColor)).setDepth(DEPTH.FX - 1);
  }

  get promptText() { return typeof this.prompt === 'function' ? this.prompt() : this.prompt; }

  use() { if (this.enabled && this.onUse) this.onUse(this); }

  disable(keepSprite = true) {
    this.enabled = false;
    this.label?.destroy(); this.label = null;
    if (this.glow) { this.scene.tweens.killTweensOf(this.glow); this.glow.destroy(); this.glow = null; }
    if (this.light) { this.scene.lighting.remove(this.light); this.light = null; }
    if (!keepSprite) { this.sprite?.destroy(); this.shadow?.destroy(); }
  }

  destroy() { this.disable(false); }
}
