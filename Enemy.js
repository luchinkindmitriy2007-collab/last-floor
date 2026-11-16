import Phaser from 'phaser';
import { DEPTH, hex } from './Constants.js';
import { audio } from './AudioSystem.js';
import { fxRand } from './Random.js';
import { angleTo, angleDiff, dist } from './Helpers.js';
import { runBehavior } from './EnemyAI.js';

/**
 * Враг с конечным автоматом поведения. Тип поведения задаётся в enemies.json
 * (behavior + params), поэтому новых врагов можно добавлять данными.
 * У каждой атаки есть различимый телеграф (вспышка, сжатие, линия, кольцо).
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, id, def, opts = {}) {
    super(scene, x, y, def.texture, 0);
    this.id = id; this.def = def; this.P = def.params || {};
    this.elite = !!opts.elite;
    this.isBoss = !!def.miniboss;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const f = opts.scaling || { hp: 1, dmg: 1 };
    const em = this.elite ? { hp: 1.9, dmg: 1.3 } : { hp: 1, dmg: 1 };
    this.maxHp = Math.round(def.hp * f.hp * em.hp);
    this.hp = this.maxHp;
    this.damage = Math.round(def.damage * f.dmg * em.dmg);
    this.speed = def.speed * (this.elite ? 1.1 : 1);
    this.flying = !!def.flying;
    this.armor = def.armor || 0;
    this.kbResist = def.knockbackResist || 0;
    const scale = (def.scale || 1) * (this.elite ? 1.15 : 1);
    this.setScale(scale);
    this.setOrigin(0.5, 0.8);
    const [bw, bh, ox, oy] = def.body;
    this.body.setSize(bw, bh).setOffset((16 - bw) / 2 + ox, 16 - bh - 2 + (oy > 4 ? 0 : 0));
    if (def.immovable) this.body.setImmovable(true);
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.SHADOW).setScale(scale * 0.9);
    if (def.tint) this.setTint(hex(def.tint));
    if (this.elite) {
      this.aura = scene.add.image(x, y, 'glow').setTint(0xd060ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(0.6 * scale).setDepth(DEPTH.ENTITY - 1);
    }
    this.state = 'spawn';
    this.timer = 0.35;
    this.knockV = new Phaser.Math.Vector2();
    this.knockT = 0;
    this.alive = true;
    this.hitFlash = 0;
    this.baseScaleX = scale; this.baseScaleY = scale;
    this.walkAnim = scene.anims.exists(`${def.texture}_walk`) ? `${def.texture}_walk` : scene.anims.exists(`${def.texture}_fly`) ? `${def.texture}_fly` : null;
    if (this.walkAnim) this.play(this.walkAnim);
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 250 });
    this.wanderA = fxRand(0, Math.PI * 2);
    this.tele = null;
    this.hpBar = null;
    // обнаружение: до встречи враг бродит; замечает игрока по радиусу, по урону или спустя время
    this.aggro = !!opts.aggro || def.behavior === 'turret' || def.behavior === 'ambush' || !!def.miniboss;
    this.aggroTimer = fxRand(2.5, 4);
    this.shieldHp = 0;
    this.empowerUntil = 0;
    if (def.shield) {
      this.shieldFx = scene.add.image(x, y, 'shield_arc').setDepth(DEPTH.ENTITY + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.75);
      this.shieldFx.setTint(hex(def.texture.includes('frozen') ? '#8ad8ff' : def.texture.includes('elite') ? '#ffd04a' : '#c8b8ff'));
    }
  }

  /** Урон с учётом усиления от поддержки. */
  power() { return Math.round(this.damage * (this.empowerUntil > this.scene.time.now ? 1.35 : 1)); }
  get speedMult() { return this.empowerUntil > this.scene.time.now ? 1.25 : 1; }

  addShield(amount) {
    this.shieldHp = Math.max(this.shieldHp, amount);
    if (!this.bubble) this.bubble = this.scene.add.image(this.x, this.y, 'ring_thin').setTint(0x8af0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.FX - 2);
    this.bubble.setScale(0.32 * this.scaleX).setVisible(true);
  }
  empower(sec) {
    this.empowerUntil = this.scene.time.now + sec * 1000;
    if (!this.rageAura) this.rageAura = this.scene.add.image(this.x, this.y, 'glow').setTint(0xff3a4a).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.ENTITY - 1);
    this.rageAura.setScale(0.55 * this.scaleX).setVisible(true);
  }

  /** Щит защитника блокирует удары с фронта (угол прилёта снаряда). */
  blocks(incomingAngle) {
    if (!this.def.shield || this.state === 'charge' || this.state === 'spawn') return false;
    const from = incomingAngle + Math.PI; // откуда летит
    const face = this.facing ?? angleTo(this.x, this.y, this.scene.player.x, this.scene.player.y);
    return Math.abs(angleDiff(face, from)) < Phaser.Math.DegToRad(this.def.shield) / 2;
  }
  syncShield() {
    if (!this.shieldFx) return;
    const a = this.facing ?? 0;
    this.shieldFx.setPosition(this.x + Math.cos(a) * 9 * this.scaleX, this.y - 6 + Math.sin(a) * 6).setRotation(a);
  }

  /** Залп веером (используется стрелками, призывателями, поддержкой). */
  fireFan(S, base) {
    const n = S.count || 1; const spread = S.spread || 0;
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1);
      this.scene.combat.fireEnemy(this.x, this.y - 6, a, S.projSpeed, this.power(), S.projFrame, { effect: S.effect });
    }
    audio.sfx('shoot');
  }

  /** Движение к произвольной точке: напрямую при видимости, иначе — по полю потока к игроку. */
  steerTo(tx, ty, speed) {
    const nav = this.scene.nav;
    let a;
    if (this.flying || nav.hasLOS(this.x, this.y, tx, ty, this.flying)) a = angleTo(this.x, this.y, tx, ty);
    else { const d = nav.dirFrom(this.x, this.y, this.flying); a = d ? Math.atan2(d.y, d.x) : angleTo(this.x, this.y, tx, ty); }
    const dd = dist(this.x, this.y, tx, ty);
    const sp = speed * this.speedMult * Math.min(1, dd / 12);
    this.body.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp);
  }

  wander(dt) {
    this.wanderA += dt * fxRand(-1.5, 1.5);
    const s = this.speed * 0.3;
    this.body.setVelocity(Math.cos(this.wanderA) * s, Math.sin(this.wanderA) * s);
  }

  get target() { return this.scene.player; }

  update(dt) {
    if (!this.alive) return;
    const p = this.target;
    this.timer -= dt;
    if (this.hitFlash > 0) { this.hitFlash -= dt; if (this.hitFlash <= 0) this.restoreTint(); }
    if (this.knockT > 0) {
      this.knockT -= dt;
      this.body.setVelocity(this.knockV.x, this.knockV.y);
      this.knockV.scale(0.82);
      this.syncVisuals();
      return;
    }
    if (this.state === 'spawn') { this.body.setVelocity(0, 0); if (this.timer <= 0) this.enterIdle(); this.syncVisuals(); return; }
    if (this.state === 'stun') { this.body.setVelocity(0, 0); if (this.timer <= 0) this.enterIdle(); this.syncVisuals(); return; }
    if (!p || !p.alive) { this.body.setVelocity(0, 0); this.syncVisuals(); return; }
    if (!this.aggro) {
      this.aggroTimer -= dt;
      if (dist(this.x, this.y, p.x, p.y) < (this.def.detect || 200) || this.hp < this.maxHp || this.aggroTimer <= 0) {
        this.aggro = true;
        const m = this.scene.fx.warnMark(this, '?'); this.scene.time.delayedCall(400, () => m.destroy());
      } else { this.wander(dt); this.syncVisuals(); return; }
    }
    runBehavior(this, dt, p);
    if (this.state !== 'charge' && this.state !== 'dive' && this.state !== 'hop' && this.state !== 'lunge') this.setFlipX(p.x < this.x);
    this.syncVisuals();
  }

  enterIdle() {
    this.state = 'idle';
    const r = this.P.rest || this.P.cd || this.P.diveCd || [0.6, 1.1];
    this.timer = fxRand(r[0], r[1]);
    this.clearTele();
  }

  restoreTint() { if (this.def.tint) this.setTint(hex(this.def.tint)); else this.clearTint(); }

  syncVisuals() {
    this.setDepth(DEPTH.ENTITY + this.y * 0.01);
    const lift = this.flying ? 8 + Math.sin(this.scene.time.now / 160 + this.wanderA) * 2 : 0;
    this.setDisplayOrigin(this.width / 2, this.height * 0.8 + lift / this.scaleY);
    this.shadow.setPosition(this.x, this.y + 2).setAlpha(this.flying ? 0.6 : 1);
    if (this.aura) this.aura.setPosition(this.x, this.y - 5 - lift).setAlpha(0.4 + Math.sin(this.scene.time.now / 200) * 0.15);
    if (this.hpBar) {
      const w = 14; const y = this.y - 18 * this.scaleY - lift;
      this.hpBar.bg.setPosition(this.x - w / 2, y);
      this.hpBar.fg.setPosition(this.x - w / 2, y).setSize(Math.max(0, (w * this.hp) / this.maxHp), 2);
    }
    if (this.tele && this.tele.update) this.tele.update();
    if (this.bubble) { this.bubble.setPosition(this.x, this.y - 6 * this.scaleY).setVisible(this.shieldHp > 0); }
    if (this.rageAura) this.rageAura.setPosition(this.x, this.y - 6).setVisible(this.empowerUntil > this.scene.time.now);
    if (this.shieldFx) { this.shieldFx.setVisible(this.state !== 'spawn'); this.syncShield(); }
  }

  // ---------------------------------------------------------------- движение
  steer(speed, away = false) {
    const p = this.target;
    const nav = this.scene.nav;
    let a;
    if (away) a = angleTo(p.x, p.y, this.x, this.y);
    else if (this.flying || nav.hasLOS(this.x, this.y, p.x, p.y, this.flying)) a = angleTo(this.x, this.y, p.x, p.y);
    else {
      const d = nav.dirFrom(this.x, this.y, this.flying);
      a = d ? Math.atan2(d.y, d.x) : angleTo(this.x, this.y, p.x, p.y);
    }
    // лёгкое расталкивание с соседями
    speed *= this.speedMult;
    let sx = Math.cos(a) * speed; let sy = Math.sin(a) * speed;
    for (const o of this.scene.combat.enemies) {
      if (o === this || !o.alive) continue;
      const dx = this.x - o.x; const dy = this.y - o.y; const d2 = dx * dx + dy * dy;
      if (d2 < 196 && d2 > 0.01) { const k = (196 - d2) / 196 * speed * 0.8; const d = Math.sqrt(d2); sx += (dx / d) * k; sy += (dy / d) * k; }
    }
    this.body.setVelocity(sx, sy);
  }

  telegraphTint(color = 0xff5050) {
    this.setTintFill(color);
    this.scene.time.delayedCall(70, () => { if (this.alive && this.hitFlash <= 0) this.restoreTint(); });
  }

  clearTele() { if (this.tele) { this.tele.destroy(); this.tele = null; } }

  showHpBar() {
    if (this.hpBar || this.isBoss) return;
    this.hpBar = {
      bg: this.scene.add.rectangle(0, 0, 14, 2, 0x1a1220).setOrigin(0).setDepth(DEPTH.FX + 1),
      fg: this.scene.add.rectangle(0, 0, 14, 2, this.elite ? 0xd060ff : 0xe8404a).setOrigin(0).setDepth(DEPTH.FX + 2)
    };
  }

  /** Отбрасывание с учётом сопротивления. */
  knockback(angle, force) {
    if (this.def.immovable) return;
    const f = force * (1 - this.kbResist);
    if (f < 5) return;
    if (this.state === 'charge') return;
    this.knockV.set(Math.cos(angle) * f, Math.sin(angle) * f);
    this.knockT = 0.12;
  }

  flash() { this.setTintFill(0xffffff); this.hitFlash = 0.07; }

  destroy(fromScene) {
    this.clearTele();
    this.shadow?.destroy(); this.aura?.destroy(); this.bubble?.destroy(); this.rageAura?.destroy(); this.shieldFx?.destroy(); this.mark?.destroy();
    if (this.hpBar) { this.hpBar.bg.destroy(); this.hpBar.fg.destroy(); }
    super.destroy(fromScene);
  }
}
