import Phaser from 'phaser';
import { DEPTH } from './Constants.js';
import { audio } from './AudioSystem.js';
import { fxRand } from './Random.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, cls, run) {
    super(scene, x, y, cls.texture, 0);
    this.cls = cls; this.run = run;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(8, 6).setOffset(4, 10);
    this.setOrigin(0.5, 0.75);
    this.shadow = scene.add.image(x, y + 4, 'shadow').setDepth(DEPTH.SHADOW);
    this.weapon = scene.add.image(x, y, cls.weapon).setOrigin(0.2, 0.8);
    this.alive = true;
    this.facing = 1;
    this.aimAngle = 0;
    this.lastMoveAngle = 0;
    this.attackTimer = 0;
    this.abilityTimer = 0;
    this.iframes = 0;
    this.rolling = 0;
    this.barrier = 0;
    this.shield = 0;
    this.buffs = [];
    this.roomStacks = {};
    this.vel = new Phaser.Math.Vector2();
    this.pull = new Phaser.Math.Vector2(); // внешняя сила (притяжение босса)
    this.slowUntil = 0; this.slowMult = 1; this.burnUntil = 0;
    this.swingDir = 1;
    this.stepT = 0;
    this.windT = 0;
    this.attackCount = 0;
    this.refreshStats(true);
    this.hp = run.hp ?? this.stats.maxHp;
    this.hp = Math.min(this.hp, this.stats.maxHp);
    this.light = scene.lighting.add({ x, y, radius: 110, intensity: 1, follow: this });
    this.play(`hero_${cls.id}_idle`);
  }

  refreshStats(initial = false) {
    const prevMax = this.stats?.maxHp;
    this.stats = this.scene.items.computeStats(this.run, this.cls);
    if (!initial && prevMax && this.stats.maxHp !== prevMax) {
      if (this.stats.maxHp > prevMax) this.hp += this.stats.maxHp - prevMax;
      this.hp = Math.min(this.hp, this.stats.maxHp);
    }
    this.scene.itemEffects = this.scene.items.effects(this.run);
  }

  buffValue(stat) {
    let v = this.roomStacks[stat] || 0;
    for (const b of this.buffs) if (b.stat === stat) v += b.value;
    return v;
  }
  addBuff(stat, value, dur) { this.buffs.push({ stat, value, until: this.scene.time.now + dur * 1000 }); }

  /** Урон основной атаки с учётом всех бонусов. */
  rollDamage(mult = 1) {
    const s = this.stats;
    const goldBonus = Math.min(0.3, Math.floor(this.run.gold / 10) * s.damagePerGold);
    let dmg = s.damageBase * (s.damageMult + goldBonus + this.buffValue('damage')) * mult;
    const crit = Math.random() < s.crit;
    if (crit) dmg *= s.critMult;
    dmg *= fxRand(0.92, 1.08);
    return { dmg: Math.max(1, Math.round(dmg)), crit };
  }
  attackCooldown() { return this.stats.attackCd / (1 + this.buffValue('atkSpeed')); }

  update(dt, controls) {
    if (!this.alive) return;
    const now = this.scene.time.now;
    this.buffs = this.buffs.filter((b) => b.until > now);
    this.attackTimer -= dt; this.abilityTimer -= dt; this.iframes -= dt;
    if (this.barrier > 0) { this.barrier -= dt; if (this.barrier <= 0) this.endBarrier(); }

    // --- движение
    const mv = controls.move();
    const moving = mv.x !== 0 || mv.y !== 0;
    let speed = this.stats.moveSpeed * (this.barrier > 0 ? 0.55 : 1) * (this.slowUntil > now ? this.slowMult : 1);
    if (this.rolling > 0) {
      this.rolling -= dt;
      speed *= this.cls.ability.speedMult;
      const a = this.rollAngle;
      this.body.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
      if (Math.random() < 0.6) this.scene.fx.afterimage(this);
      if (this.rolling <= 0) { this.setAngle(0); }
    } else {
      const tx = mv.x * speed; const ty = mv.y * speed;
      const k = moving ? 0.35 : 0.45;
      this.vel.x += (tx - this.vel.x) * k; this.vel.y += (ty - this.vel.y) * k;
      if (Math.abs(this.vel.x) < 1) this.vel.x = 0; if (Math.abs(this.vel.y) < 1) this.vel.y = 0;
      this.body.setVelocity(this.vel.x + this.pull.x, this.vel.y + this.pull.y);
    }
    this.pull.set(0, 0);
    if (moving) this.lastMoveAngle = Math.atan2(mv.y, mv.x);

    // --- прицел
    if (controls.usingMouse()) {
      const wp = controls.aimWorld(this.scene.cameras.main);
      this.aimAngle = Math.atan2(wp.y - (this.y - 4), wp.x - this.x);
    } else {
      const target = this.scene.combat.nearestEnemy(this.x, this.y, 170);
      this.aimAngle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.lastMoveAngle;
    }
    this.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
    this.setFlipX(this.facing < 0);

    // --- анимация
    const key = moving && this.rolling <= 0 ? 'walk' : 'idle';
    const anim = `hero_${this.cls.id}_${key}`;
    if (this.anims.currentAnim?.key !== anim) this.play(anim, true);
    if (moving) {
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.28; audio.sfx('step', { gap: 120 }); this.scene.fx.dust(this.x, this.y + 3, 2); }
    }

    // --- атака и способность
    if (controls.attackHeld() && this.attackTimer <= 0 && this.rolling <= 0) this.attack();
    if (controls.justPressed('ability') && this.abilityTimer <= 0) this.useAbility();
    if (controls.justPressed('potion')) this.drinkPotion();

    // --- эффекты «при движении» (Звезда ветров)
    if (moving) {
      this.windT -= dt;
      if (this.windT <= 0) {
        const eff = this.scene.itemEffects.find((e) => e.effect.on === 'move');
        if (eff) { this.windT = eff.effect.interval; this.scene.combat.windBlades(eff.effect.count, eff.effect.dmgPct); } else this.windT = 1;
      }
    }

    this.updateVisuals(dt);
  }

  updateVisuals() {
    this.setDepth(DEPTH.ENTITY + this.y * 0.01);
    this.shadow.setPosition(this.x, this.y + 3);
    // оружие держится в руке и смотрит в сторону прицела
    if (!this.swinging) {
      const hx = this.x + this.facing * 4; const hy = this.y - 2;
      this.weapon.setPosition(hx, hy);
      const base = this.cls.id === 'guardian' ? this.aimAngle + Math.PI / 4 - this.facing * 0.9 : this.aimAngle + Math.PI / 4;
      this.weapon.setRotation(base);
      this.weapon.setFlipX(false);
    }
    this.weapon.setDepth(this.depth + (Math.sin(this.aimAngle) < -0.3 ? -0.5 : 0.5));
    const blink = this.iframes > 0 && Math.floor(this.iframes * 20) % 2 === 0;
    this.setAlpha(blink ? 0.35 : 1);
    const now = this.scene.time.now;
    if (this.burnUntil > now) { if (!this.tintFill) this.setTint(0xffb08a); }
    else if (this.slowUntil > now) { if (!this.tintFill) this.setTint(0x9ad8ff); }
    else if (!this.tintFill && this.tintTopLeft !== 0xffffff) this.clearTint();
    this.weapon.setAlpha(this.alpha);
    if (this.barrierFx) this.barrierFx.setPosition(this.x, this.y - 5);
    if (this.shieldFx) { this.shieldFx.setVisible(this.shield > 0).setPosition(this.x, this.y - 5); }
  }

  attack(echo = false) {
    const cd = this.attackCooldown();
    if (!echo) this.attackTimer = cd;
    const a = this.aimAngle;
    const C = this.scene.combat;
    if (this.cls.attack.type === 'melee') {
      const range = this.cls.attack.range * this.stats.area;
      C.playerMelee(this.x, this.y - 3, a, range, this.cls.attack.arc, this.cls.attack.knockback);
      this.swingWeapon(a);
      audio.sfx('swing');
    } else if (this.cls.attack.type === 'throw') {
      const n = 1 + this.stats.extraProj;
      const spread = Phaser.Math.DegToRad(this.cls.attack.spread + (n - 1) * 7);
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? fxRand(-0.04, 0.04) : -spread / 2 + (spread * i) / (n - 1);
        C.firePlayer({ angle: a + off, speed: this.cls.attack.speed, frame: 4, mult: 1, knock: this.cls.attack.knockback, life: this.cls.attack.range / this.cls.attack.speed, trail: 0xbfe8d0 });
      }
      this.recoil(a);
      audio.sfx('throw');
    } else {
      C.firePlayer({ angle: a, speed: this.cls.attack.speed, frame: 0, mult: 1, homing: this.cls.attack.homing, knock: this.cls.attack.knockback, life: this.cls.attack.range / this.cls.attack.speed, light: 40, trail: 0xb884ff, scale: 1.1, additive: false });
      this.recoil(a);
      audio.sfx('magic');
    }
    if (!echo) {
      this.attackCount++;
      C.trigger('attack', {});
    }
  }

  echoAttack() { this.scene.time.delayedCall(110, () => { if (this.alive) this.attack(true); }); }

  swingWeapon(a) {
    this.swinging = true;
    this.swingDir *= -1;
    const from = a + Math.PI / 4 - this.swingDir * 1.6;
    const to = a + Math.PI / 4 + this.swingDir * 1.6;
    this.weapon.setPosition(this.x + Math.cos(a) * 4, this.y - 3 + Math.sin(a) * 4);
    this.weapon.setRotation(from);
    this.scene.tweens.add({
      targets: this.weapon, rotation: to, duration: 110, ease: 'Cubic.Out',
      onComplete: () => { this.swinging = false; }
    });
  }

  recoil(a) {
    this.scene.tweens.add({ targets: this.weapon, x: this.weapon.x - Math.cos(a) * 2, y: this.weapon.y - Math.sin(a) * 2, duration: 50, yoyo: true });
  }

  useAbility() {
    const ab = this.cls.ability;
    this.abilityTimer = ab.cd * (1 - this.stats.cdr);
    const C = this.scene.combat;
    if (ab.id === 'barrier') {
      this.barrier = ab.duration;
      audio.sfx('barrier');
      this.barrierFx = this.scene.add.image(this.x, this.y - 5, 'ring').setTint(0x8ab8ff).setScale(0.45).setDepth(DEPTH.FX).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: this.barrierFx, alpha: { from: 1, to: 0.5 }, duration: 200, yoyo: true, repeat: -1 });
    } else if (ab.id === 'roll') {
      const mv = this.scene.controls.move();
      this.rollAngle = (mv.x || mv.y) ? Math.atan2(mv.y, mv.x) : this.aimAngle;
      this.rolling = ab.duration;
      this.iframes = Math.max(this.iframes, ab.duration + 0.05);
      audio.sfx('dash');
      this.scene.tweens.add({ targets: this, angle: this.facing * 360, duration: ab.duration * 1000, onComplete: () => this.setAngle(0) });
    } else if (ab.id === 'nova') {
      const r = ab.radius * this.stats.area;
      C.nova(this.x, this.y - 3, r, ab.dmgMult, 0xb884ff);
      audio.sfx('nova');
    }
    C.trigger('ability', {});
  }

  endBarrier() {
    const ab = this.cls.ability;
    this.barrierFx?.destroy(); this.barrierFx = null;
    this.scene.combat.nova(this.x, this.y - 3, ab.radius * this.stats.area, ab.dmgMult, 0x8ab8ff);
    audio.sfx('nova');
  }

  drinkPotion() {
    if (this.run.potions <= 0) { audio.sfx('deny'); this.scene.ui?.toast('Нет зелий', '#8f8698'); return; }
    if (this.hp >= this.stats.maxHp) { audio.sfx('deny'); this.scene.ui?.toast('Здоровье полное', '#8f8698'); return; }
    this.run.potions--;
    this.run.stats.potionsUsed++;
    this.scene.combat.healPlayer(Math.round(this.stats.maxHp * 0.4));
    audio.sfx('heal');
  }

  addShield(n) {
    this.shield = Math.min(3, this.shield + n);
    if (!this.shieldFx) this.shieldFx = this.scene.add.image(this.x, this.y - 5, 'ring_thin').setTint(0xffe08a).setScale(0.4).setDepth(DEPTH.FX).setBlendMode(Phaser.BlendModes.ADD);
    audio.sfx('shield');
  }

  die() {
    this.alive = false;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.weapon.setVisible(false);
    this.barrierFx?.destroy(); this.shieldFx?.destroy();
    this.scene.tweens.add({ targets: this, angle: 90 * this.facing, alpha: 0.6, duration: 500, ease: 'Bounce.Out' });
  }

  destroy(fromScene) {
    this.shadow?.destroy(); this.weapon?.destroy(); this.barrierFx?.destroy(); this.shieldFx?.destroy();
    super.destroy(fromScene);
  }
}
