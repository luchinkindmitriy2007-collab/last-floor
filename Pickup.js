import Phaser from 'phaser';
import { DEPTH, RARITY, hex } from './Constants.js';
import { fxRand } from './Random.js';

/** Подбираемые объекты: монеты, сердца, зелья, осколки, предметы. */
export class Pickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, kind, payload = {}) {
    const tex = { coin: 'coin', heart: 'heart', shard: 'shard', potion: 'hud_icons', item: 'items' }[kind];
    const frame = kind === 'potion' ? 'potion' : kind === 'item' ? payload.item.id : 0;
    super(scene, x, y, tex, frame);
    this.kind = kind;
    this.payload = payload;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setCircle(kind === 'item' ? 7 : 4, kind === 'item' ? 1 : 0, kind === 'item' ? 1 : 0);
    this.setDepth(DEPTH.ENTITY + y * 0.01 - 2);
    this.age = 0;
    this.collectDelay = payload.delay ?? 0.35;
    this.magnet = kind !== 'item';
    this.shadow = scene.add.image(x, y + 5, 'shadow').setScale(kind === 'item' ? 0.9 : 0.5).setDepth(DEPTH.SHADOW);
    if (payload.scatter) {
      const a = fxRand(0, Math.PI * 2); const s = fxRand(40, 110);
      this.body.setVelocity(Math.cos(a) * s, Math.sin(a) * s);
      this.body.setDrag(220, 220);
    }
    this.bobT = fxRand(0, 6);
    if (kind === 'item') {
      const r = RARITY[payload.item.rarity];
      this.glow = scene.add.image(x, y, 'glow').setTint(hex(r.color)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(0.7).setDepth(DEPTH.ENTITY - 1);
      this.beam = scene.add.rectangle(x, y - 30, 2, 60, hex(r.color)).setAlpha(r.tier >= 2 ? 0.35 : 0.15).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.ENTITY - 1);
      this.light = scene.lighting?.add({ x, y, radius: 40 + r.tier * 6, intensity: 0.8 });
      this.collectDelay = payload.delay ?? 0.6;
    }
    if (kind === 'coin') this.scene.tweens.add({ targets: this, scaleX: { from: 1, to: 0.2 }, duration: 380, yoyo: true, repeat: -1, delay: fxRand(0, 300) });
  }

  update(dt, player) {
    this.age += dt; this.bobT += dt * 4;
    const bob = this.kind === 'item' ? Math.sin(this.bobT * 0.6) * 2 - 3 : Math.abs(Math.sin(this.bobT)) * -1.5;
    this.shadow.setPosition(this.x, this.y + 5);
    this.setDisplayOrigin(this.width / 2, this.height / 2 - bob);
    if (this.glow) { this.glow.setPosition(this.x, this.y + bob); this.beam.setPosition(this.x, this.y - 28); this.glow.setAlpha(0.4 + Math.sin(this.bobT) * 0.1); }
    if (this.light) { this.light.x = this.x; this.light.y = this.y; }
    if (this.age < this.collectDelay || !player || !player.alive) return false;
    const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y + 4);
    if (this.magnet && (d < 44 || this.forceMagnet)) {
      const a = Math.atan2(player.y + 4 - this.y, player.x - this.x);
      const sp = 140 + (this.forceMagnet ? 120 : 0) + this.age * 30;
      this.body.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp);
    }
    if (this.kind === 'heart' && player.hp >= player.stats.maxHp) return false;
    return d < (this.kind === 'item' ? 12 : 9);
  }

  destroy(fromScene) {
    this.shadow?.destroy(); this.glow?.destroy(); this.beam?.destroy();
    if (this.light) this.scene?.lighting?.remove(this.light);
    super.destroy(fromScene);
  }
}
