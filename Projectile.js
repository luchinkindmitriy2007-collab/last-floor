import Phaser from 'phaser';
import { angleDiff } from './Helpers.js';
import { DEPTH } from './Constants.js';

/** Снаряд из пула. Владелец 'player' или 'enemy'. */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'proj', 0);
    this.hitSet = new Set();
  }

  fire(cfg) {
    this.enableBody(true, cfg.x, cfg.y, true, true);
    this.setTexture('proj', cfg.frame ?? 0);
    this.cfg = cfg;
    this.owner = cfg.owner;
    this.damage = cfg.damage;
    this.crit = !!cfg.crit;
    this.pierce = cfg.pierce || 0;
    this.homing = cfg.homing || 0;
    this.life = cfg.life ?? 1.6;
    this.speed = cfg.speed;
    this.angle0 = cfg.angle;
    this.knock = cfg.knock ?? 60;
    this.hitSet.clear();
    this.setScale(cfg.scale || 1);
    this.setDepth(DEPTH.FX - 10);
    this.setBlendMode(cfg.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (cfg.tint) this.setTint(cfg.tint); else this.clearTint();
    this.body.setCircle(3, this.width / 2 - 3, this.height / 2 - 3);
    this.scene.physics.velocityFromRotation(cfg.angle, cfg.speed, this.body.velocity);
    this.rotation = cfg.rotate === false ? 0 : cfg.angle;
    this.spin = cfg.spin || 0;
    if (cfg.light && this.scene.lighting) this.light = this.scene.lighting.add({ x: cfg.x, y: cfg.y, radius: cfg.light, intensity: 0.7, follow: this });
    this.trailT = 0;
    return this;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.active) return;
    const dt = delta / 1000;
    this.life -= dt;
    if (this.life <= 0) { if (this.owner === 'enemy') this.scene.combat?.shotExpired(this); this.kill(true); return; }
    if (this.homing && this.owner === 'enemy') {
      const pl = this.scene.player;
      if (pl && pl.alive) {
        const cur = Math.atan2(this.body.velocity.y, this.body.velocity.x);
        const want = Math.atan2(pl.y - 4 - this.y, pl.x - this.x);
        const na = cur + Phaser.Math.Clamp(angleDiff(cur, want), -this.homing * dt, this.homing * dt);
        this.scene.physics.velocityFromRotation(na, this.speed, this.body.velocity);
      }
    } else if (this.homing && this.owner === 'player') {
      const target = this.scene.combat?.nearestEnemy(this.x, this.y, 140, this.hitSet);
      if (target) {
        const cur = Math.atan2(this.body.velocity.y, this.body.velocity.x);
        const want = Math.atan2(target.y - this.y, target.x - this.x);
        const na = cur + Phaser.Math.Clamp(angleDiff(cur, want), -this.homing * dt, this.homing * dt);
        this.scene.physics.velocityFromRotation(na, this.speed, this.body.velocity);
        if (!this.spin) this.rotation = na;
      }
    }
    if (this.spin) this.rotation += this.spin * dt;
    this.trailT -= dt;
    if (this.trailT <= 0 && this.cfg.trail) {
      this.trailT = 0.03;
      this.scene.fx?.trail(this.x, this.y, this.cfg.trail);
    }
  }

  kill(fade = false) {
    if (!this.active) return;
    if (fade && this.cfg?.trail) this.scene.fx?.burst(this.x, this.y, this.cfg.trail, 4, 30);
    this.disableBody(true, true);
    if (this.light) { this.scene.lighting?.remove(this.light); this.light = null; }
  }
}
