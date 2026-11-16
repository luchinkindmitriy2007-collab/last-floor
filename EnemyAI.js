// Модели поведения обычных врагов. Каждая функция вызывается с this = враг
// (Enemy) и описывает конечный автомат по полю state. Параметры — из
// enemies.json (params), поэтому новый враг — это данные + при желании новая
// функция здесь. Перед каждой опасной атакой — видимый телеграф.

import { audio } from './AudioSystem.js';
import { fxRand } from './Random.js';
import { angleTo, dist } from './Helpers.js';

export const EnemyAI = {

  hopper(dt, p) {
    if (this.state === 'idle') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) {
        this.state = 'windup'; this.timer = this.P.windup;
        this.scene.tweens.add({ targets: this, scaleY: this.baseScaleY * 0.65, scaleX: this.baseScaleX * 1.3, duration: this.P.windup * 1000, ease: 'Sine.In' });
        this.telegraphTint(0xffffff);
      }
    } else if (this.state === 'windup') {
      if (this.timer <= 0) {
        this.state = 'hop'; this.timer = this.P.hopTime;
        let a = angleTo(this.x, this.y, p.x, p.y);
        if (!this.scene.nav.hasLOS(this.x, this.y, p.x, p.y, false)) { const d = this.scene.nav.dirFrom(this.x, this.y, false); if (d) a = Math.atan2(d.y, d.x); }
        this.hopA = a;
        this.setFlipX(Math.cos(a) < 0);
        this.scene.tweens.add({ targets: this, scaleY: this.baseScaleY * 1.25, scaleX: this.baseScaleX * 0.8, duration: 120, yoyo: true });
      }
    } else if (this.state === 'hop') {
      this.body.setVelocity(Math.cos(this.hopA) * this.P.hopSpeed, Math.sin(this.hopA) * this.P.hopSpeed);
      if (this.timer <= 0) {
        this.setScale(this.baseScaleX, this.baseScaleY); this.scene.fx.dust(this.x, this.y, 3);
        if (this.P.landHazard) this.scene.combat.addHazard(this.x, this.y, 16, this.P.landHazard, 3.5);
        if (this.P.web && Math.random() < 0.5) {
          const w = this.P.web; this.scene.combat.fireEnemy(this.x, this.y - 6, angleTo(this.x, this.y, p.x, p.y), w.projSpeed, Math.round(this.power() * 0.6), w.projFrame, { effect: w.effect });
        }
        this.enterIdle();
      }
    }
  },

  flyer(dt, p) {
    if (this.state === 'idle') {
      this.wanderA += dt * 2.2;
      const a = angleTo(this.x, this.y, p.x, p.y) + Math.sin(this.wanderA) * 1.1;
      const d = dist(this.x, this.y, p.x, p.y);
      const sp = this.speed * (d < 50 ? 0.4 : 1);
      this.body.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp);
      if (this.timer <= 0 && d < 150) {
        this.state = 'windup'; this.timer = this.P.windup;
        this.anims.timeScale = 3;
        this.telegraphTint(0xff6060);
        audio.sfx('telegraph', { pitch: 1.4 });
      }
    } else if (this.state === 'windup') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) { this.state = 'dive'; this.timer = 0.45; this.diveA = angleTo(this.x, this.y, p.x, p.y); }
    } else if (this.state === 'dive') {
      this.body.setVelocity(Math.cos(this.diveA) * this.P.diveSpeed, Math.sin(this.diveA) * this.P.diveSpeed);
      if (this.timer <= 0) { this.anims.timeScale = 1; this.enterIdle(); }
    }
  },

  melee(dt, p) {
    const d = dist(this.x, this.y, p.x, p.y);
    if (this.state === 'idle' || this.state === 'chase') {
      this.state = 'chase';
      if (this.walkAnim && !this.anims.isPlaying) this.play(this.walkAnim);
      this.steer(this.speed);
      if (d < this.P.range + 8 && this.scene.nav.hasLOS(this.x, this.y, p.x, p.y, false)) {
        this.state = 'windup'; this.timer = this.P.windup;
        this.body.setVelocity(0, 0);
        this.lungeA = angleTo(this.x, this.y, p.x, p.y);
        this.anims.pause();
        this.tele = this.scene.fx.warnMark(this);
        audio.sfx('telegraph');
        this.scene.tweens.add({ targets: this, x: this.x - Math.cos(this.lungeA) * 3, y: this.y - Math.sin(this.lungeA) * 3, duration: this.P.windup * 700 });
      }
    } else if (this.state === 'windup') {
      this.body.setVelocity(0, 0);
      if (Math.floor(this.timer * 14) % 2 === 0) this.setTintFill(0xff4a4a); else this.restoreTint();
      if (this.timer <= 0) {
        this.restoreTint(); this.clearTele();
        this.state = 'lunge'; this.timer = this.P.lungeTime;
        this.scene.fx.slashAt(this.x + Math.cos(this.lungeA) * 10, this.y - 4 + Math.sin(this.lungeA) * 10, this.lungeA, 'slash_red_anim', 0.8);
        audio.sfx('swing', { pitch: 0.7 });
        this.scene.combat.enemyMeleeArc(this, this.lungeA, this.P.range + 6);
      }
    } else if (this.state === 'lunge') {
      this.body.setVelocity(Math.cos(this.lungeA) * this.P.lungeSpeed, Math.sin(this.lungeA) * this.P.lungeSpeed);
      if (this.timer <= 0) { this.state = 'recover'; this.timer = this.P.recover; this.body.setVelocity(0, 0); this.anims.resume(); }
    } else if (this.state === 'recover') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) this.state = 'chase';
    }
  },

  shooter(dt, p) {
    const d = dist(this.x, this.y, p.x, p.y);
    const [near, far] = this.P.keep;
    if (this.state === 'idle') {
      const los = this.scene.nav.hasLOS(this.x, this.y, p.x, p.y, false);
      if (d < near) this.steer(this.speed * 1.1, true);
      else if (d > far || !los) this.steer(this.speed);
      else { this.wanderA += dt; const a = angleTo(this.x, this.y, p.x, p.y) + Math.PI / 2; const s = Math.sin(this.wanderA) * this.speed * 0.6; this.body.setVelocity(Math.cos(a) * s, Math.sin(a) * s); }
      if (this.timer <= 0 && los && d < far + 40) {
        this.state = 'windup'; this.timer = this.P.windup;
        this.body.setVelocity(0, 0);
        this.tele = this.scene.fx.chargeGlow(this, 0xffb84a, this.P.windup);
        audio.sfx('telegraph', { pitch: 0.9 });
      }
    } else if (this.state === 'windup') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) {
        this.clearTele();
        const lead = 0.25;
        const tx = p.x + p.body.velocity.x * lead * (d / this.P.projSpeed); const ty = p.y + p.body.velocity.y * lead * (d / this.P.projSpeed);
        const base = angleTo(this.x, this.y - 6, tx, ty);
        const n = this.P.count || 1; const spread = this.P.spread || 0;
        for (let i = 0; i < n; i++) {
          const a = n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1);
          this.scene.combat.fireEnemy(this.x, this.y - 6, a, this.P.projSpeed, this.power(), this.P.projFrame, { effect: this.P.effect, expireHazard: this.P.expireHazard });
        }
        audio.sfx(this.def.sfx || 'shoot');
        this.enterIdle();
      }
    }
  },

  turret(dt, p) {
    this.body.setVelocity(0, 0);
    if (this.state === 'idle') {
      if (this.timer <= 0) {
        this.state = 'windup'; this.timer = this.P.windup;
        this.tele = this.scene.fx.chargeGlow(this, 0x7cff8a, this.P.windup, -9);
        audio.sfx('telegraph', { pitch: 0.6 });
      }
    } else if (this.state === 'windup' && this.timer <= 0) {
      this.clearTele();
      this.turnOff = (this.turnOff || 0) + this.P.rotate;
      const n = this.P.burst + (this.elite ? 4 : 0);
      for (let i = 0; i < n; i++) {
        const a = this.turnOff + (Math.PI * 2 * i) / n;
        this.scene.combat.fireEnemy(this.x, this.y - 8, a, this.P.projSpeed, this.power(), this.P.projFrame);
      }
      audio.sfx('zap');
      this.enterIdle();
    }
  },

  charger(dt, p) {
    const d = dist(this.x, this.y, p.x, p.y);
    if (this.state === 'idle' || this.state === 'chase') {
      this.state = 'chase';
      if (this.walkAnim && !this.anims.isPlaying) this.play(this.walkAnim);
      this.steer(this.speed);
      if (this.timer <= 0 && d < this.P.detect && this.scene.nav.hasLOS(this.x, this.y, p.x, p.y, false)) {
        this.state = 'windup'; this.timer = this.P.windup;
        this.body.setVelocity(0, 0);
        this.chargeA = angleTo(this.x, this.y, p.x, p.y);
        this.tele = this.scene.fx.lineTelegraph(this, this.chargeA, 140 * this.scaleX / (this.def.scale || 1));
        audio.sfx('charge');
      }
    } else if (this.state === 'windup') {
      this.body.setVelocity(0, 0);
      // до последней трети разгона — подстраивается под цель, потом направление фиксируется
      if (this.timer > this.P.windup * 0.35) { this.chargeA = angleTo(this.x, this.y, p.x, p.y); this.tele?.setAngle(this.chargeA); }
      this.x += fxRand(-0.6, 0.6);
      if (Math.random() < 0.3) this.scene.fx.dust(this.x, this.y, 1);
      if (this.timer <= 0) { this.clearTele(); this.state = 'charge'; this.timer = this.P.chargeTime; this.setFlipX(Math.cos(this.chargeA) < 0); }
    } else if (this.state === 'charge') {
      this.body.setVelocity(Math.cos(this.chargeA) * this.P.chargeSpeed, Math.sin(this.chargeA) * this.P.chargeSpeed);
      if (Math.random() < 0.5) this.scene.fx.dust(this.x, this.y, 1);
      const b = this.body.blocked;
      if (b.left || b.right || b.up || b.down) {
        this.state = 'stun'; this.timer = this.P.stun;
        this.scene.cameras.main.shake(140, 0.006);
        audio.sfx('slam');
        this.scene.fx.stars(this);
        if (this.P.slam) this.scene.combat.enemyShockwave(this, this.P.slamRadius, this.power());
      } else if (this.timer <= 0) {
        if (this.P.slam) { this.state = 'stun'; this.timer = 0.6; this.scene.combat.enemyShockwave(this, this.P.slamRadius, this.power()); audio.sfx('slam'); }
        else this.enterIdle();
        this.timer = Math.max(this.timer, 0.5);
      }
    }
  },
  // ================================================================ новые архетипы

  /** Преследователь: бежит к цели, кусает в выпаде. Волки заходят с флангов. */
  chaser(dt, p) {
    const P = this.P; const d = dist(this.x, this.y, p.x, p.y);
    if (this.state === 'idle' || this.state === 'chase') {
      this.state = 'chase';
      if (P.flank && d > 70) {
        this.flankSide = this.flankSide || (Math.random() < 0.5 ? -1 : 1);
        const a = angleTo(p.x, p.y, this.x, this.y) + this.flankSide * 0.9;
        this.steerTo(p.x + Math.cos(a) * 46, p.y + Math.sin(a) * 46, this.speed);
      } else this.steer(this.speed);
      if (this.timer <= 0 && d < P.lungeRange + 10 && this.scene.nav.hasLOS(this.x, this.y, p.x, p.y, this.flying)) {
        this.state = 'windup'; this.timer = P.windup;
        this.lungeA = angleTo(this.x, this.y, p.x, p.y);
        this.telegraphTint(0xff5050);
        this.scene.tweens.add({ targets: this, scaleX: this.baseScaleX * 1.15, scaleY: this.baseScaleY * 0.85, duration: P.windup * 900, yoyo: true });
      }
    } else if (this.state === 'windup') {
      this.body.setVelocity(-Math.cos(this.lungeA) * 20, -Math.sin(this.lungeA) * 20);
      if (this.timer <= 0) {
        this.state = 'lunge'; this.timer = P.lungeTime;
        this.setFlipX(Math.cos(this.lungeA) < 0);
        audio.sfx(this.def.sfx || 'bite');
      }
    } else if (this.state === 'lunge') {
      this.body.setVelocity(Math.cos(this.lungeA) * P.lungeSpeed, Math.sin(this.lungeA) * P.lungeSpeed);
      if (this.timer <= 0) {
        if (P.double && !this.didDouble) { this.didDouble = true; this.state = 'windup'; this.timer = 0.15; this.lungeA = angleTo(this.x, this.y, p.x, p.y); return; }
        this.didDouble = false;
        this.state = 'recover'; this.timer = P.recover;
      }
    } else if (this.state === 'recover') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) { this.state = 'chase'; this.timer = 0.25; }
    }
  },

  /** Тяжёлый: медленно идёт, удар о землю с кругом-телеграфом (+кольцо снарядов, зона). */
  heavy(dt, p) {
    const P = this.P; const d = dist(this.x, this.y, p.x, p.y);
    if (this.state === 'idle' || this.state === 'chase') {
      this.state = 'chase';
      if (this.walkAnim && !this.anims.isPlaying) this.play(this.walkAnim);
      this.steer(this.speed);
      if (this.timer <= 0 && d < P.slamRange + 12) {
        this.state = 'windup'; this.timer = P.windup;
        this.body.setVelocity(0, 0);
        this.anims.pause();
        const r = P.radius * Math.max(1, this.scaleX * 0.8);
        this.slamR = r;
        this.tele = this.scene.fx.circleTelegraph(this.x, this.y - 2, r, P.windup, 0xff4a4a);
        this.scene.tweens.add({ targets: this, scaleY: this.baseScaleY * 1.15, duration: P.windup * 900, ease: 'Quad.In' });
        audio.sfx('telegraph', { pitch: 0.55 });
      }
    } else if (this.state === 'windup') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) {
        this.clearTele();
        this.setScale(this.baseScaleX * 1.15, this.baseScaleY * 0.85);
        this.scene.tweens.add({ targets: this, scaleX: this.baseScaleX, scaleY: this.baseScaleY, duration: 200 });
        this.scene.combat.enemyShockwave(this, this.slamR, this.power());
        if (this.scene.settings.shake) this.scene.cameras.main.shake(120, 0.005);
        audio.sfx(this.def.sfx || 'slam');
        if (P.ring) {
          const fire = (off) => { for (let i = 0; i < P.ring; i++) this.scene.combat.fireEnemy(this.x, this.y - 6, off + (Math.PI * 2 * i) / P.ring, P.projSpeed, Math.round(this.power() * 0.6), P.projFrame); };
          fire(fxRand(0, 1));
          if (P.ring2) this.scene.time.delayedCall(280, () => { if (this.alive) fire(Math.PI / P.ring + fxRand(0, 1)); });
        }
        if (P.hazard) this.scene.combat.addHazard(this.x, this.y, this.slamR * 0.55, P.hazard, 4);
        this.state = 'recover'; this.timer = P.recover;
      }
    } else if (this.state === 'recover') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) { this.anims.resume(); this.state = 'chase'; this.timer = 0.6; }
    }
  },

  /** Взрывной: подбегает, раскаляется (мигание + круг) и взрывается, оставляя зону. */
  exploder(dt, p) {
    const P = this.P; const d = dist(this.x, this.y, p.x, p.y);
    if (this.state === 'idle' || this.state === 'chase') {
      this.state = 'chase';
      this.steer(this.speed);
      if (d < P.fuseRange + 6) {
        this.state = 'fuse'; this.timer = P.fuse;
        this.tele = this.scene.fx.circleTelegraph(this.x, this.y, P.radius, P.fuse, 0xff6a2a);
        this.fuseX = this.x; this.fuseY = this.y;
        audio.sfx('telegraph', { pitch: 1.6 });
      }
    } else if (this.state === 'fuse') {
      this.body.setVelocity(0, 0);
      const k = 1 - this.timer / P.fuse;
      if (Math.floor(this.timer * (8 + k * 16)) % 2 === 0) this.setTintFill(0xffffff); else this.setTintFill(0xff4a2a);
      this.setScale(this.baseScaleX * (1 + k * 0.35), this.baseScaleY * (1 + k * 0.35));
      if (this.timer <= 0) { this.clearTele(); this.scene.combat.enemyExplode(this, P.radius, Math.round(this.power()), P.hazard); }
    }
  },

  /** Призыватель: держит дистанцию, призывает союзников (не больше cap), стреляет и/или лечит. */
  summoner(dt, p) {
    const P = this.P; const d = dist(this.x, this.y, p.x, p.y);
    if (this.state === 'idle') {
      const [near, far] = P.keep;
      if (d < near) this.steer(this.speed * 1.1, true);
      else if (d > far) this.steer(this.speed);
      else { this.wanderA += dt; const a = angleTo(this.x, this.y, p.x, p.y) + Math.PI / 2; const s = Math.sin(this.wanderA) * this.speed * 0.5; this.body.setVelocity(Math.cos(a) * s, Math.sin(a) * s); }
      if (P.shoot) {
        this.shootT = (this.shootT ?? fxRand(1, 2)) - dt;
        if (this.shootT <= 0 && this.scene.nav.hasLOS(this.x, this.y, p.x, p.y, false)) {
          this.shootT = fxRand(P.shoot.cd[0], P.shoot.cd[1]);
          this.fireFan(P.shoot, angleTo(this.x, this.y - 6, p.x, p.y));
        }
      }
      if (this.timer <= 0) {
        const mine = this.scene.combat.enemies.filter((e) => e.alive && e.summonedBy === this).length;
        const wounded = P.heal ? this.scene.combat.enemies.filter((e) => e.alive && e !== this && e.hp < e.maxHp * 0.7) : [];
        if (mine < P.cap || wounded.length) {
          this.state = 'channel'; this.timer = P.channel;
          this.body.setVelocity(0, 0);
          this.tele = this.scene.fx.chargeGlow(this, wounded.length ? 0x7cff8a : 0xb884ff, P.channel, -10, 1.2);
          audio.sfx('summon');
        } else this.timer = 1.2;
      }
    } else if (this.state === 'channel') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) {
        this.clearTele();
        const mine = this.scene.combat.enemies.filter((e) => e.alive && e.summonedBy === this).length;
        const n = Math.min(P.count, P.cap - mine);
        for (let i = 0; i < n; i++) {
          const a = fxRand(0, Math.PI * 2); const r = fxRand(24, 40);
          const pos = this.scene.room.clampToRoom(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
          this.scene.room.spawnEnemy(P.summon, pos.x, pos.y, { delay: i * 120, summoner: this });
        }
        if (P.heal) {
          for (const e of this.scene.combat.enemies) {
            if (!e.alive || e === this || dist(this.x, this.y, e.x, e.y) > 160) continue;
            e.hp = Math.min(e.maxHp, e.hp + P.heal);
            this.scene.fx.beam(this.x, this.y - 8, e.x, e.y - 6, 0x7cff8a);
            this.scene.fx.floatText(e.x, e.y - 16, `+${P.heal}`, '#7cff8a');
          }
        }
        this.enterIdle();
      }
    }
  },

  /** Защитник: щит спереди блокирует снаряды; встаёт между игроком и союзником; таранит щитом. */
  defender(dt, p) {
    const P = this.P; const d = dist(this.x, this.y, p.x, p.y);
    this.facing = angleTo(this.x, this.y, p.x, p.y);
    if (this.state === 'idle' || this.state === 'guard') {
      this.state = 'guard';
      const ward = this.scene.combat.enemies
        .filter((e) => e.alive && e !== this && e.def.role !== 'defender' && e.state !== 'spawn')
        .sort((a, b) => dist(this.x, this.y, a.x, a.y) - dist(this.x, this.y, b.x, b.y))[0];
      if (ward && d > 50) {
        const a = angleTo(ward.x, ward.y, p.x, p.y);
        this.steerTo(ward.x + Math.cos(a) * 30, ward.y + Math.sin(a) * 30, this.speed);
      } else this.steer(this.speed);
      if (this.timer <= 0 && d < P.bashRange + 12 && this.scene.nav.hasLOS(this.x, this.y, p.x, p.y, false)) {
        this.state = 'windup'; this.timer = P.windup;
        this.body.setVelocity(0, 0);
        this.bashA = this.facing;
        this.tele = this.scene.fx.lineTelegraph(this, this.bashA, Math.max(40, P.bashSpeed * P.bashTime + 10), 12);
        audio.sfx('telegraph', { pitch: 0.8 });
      }
    } else if (this.state === 'windup') {
      this.body.setVelocity(0, 0);
      if (this.timer > P.windup * 0.4) { this.bashA = this.facing; this.tele?.setAngle(this.bashA); }
      if (this.timer <= 0) { this.clearTele(); this.state = 'charge'; this.timer = P.bashTime; audio.sfx('dash'); }
    } else if (this.state === 'charge') {
      this.body.setVelocity(Math.cos(this.bashA) * P.bashSpeed, Math.sin(this.bashA) * P.bashSpeed);
      if (Math.random() < 0.4) this.scene.fx.dust(this.x, this.y, 1);
      if (this.timer <= 0) { this.state = 'recover'; this.timer = P.recover; }
    } else if (this.state === 'recover') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) { this.state = 'guard'; this.timer = 1.0; }
    }
    this.syncShield();
  },

  /** Телепорт: растворяется, метка на полу, появляется и атакует (кольцо / взмах / выстрел). */
  teleporter(dt, p) {
    const P = this.P;
    if (this.state === 'idle') {
      this.wanderA += dt * 1.5;
      const a = angleTo(this.x, this.y, p.x, p.y) + Math.PI / 2;
      const s = Math.sin(this.wanderA) * this.speed;
      this.body.setVelocity(Math.cos(a) * s, Math.sin(a) * s);
      if (this.timer <= 0) {
        this.state = 'fade'; this.timer = P.fade;
        this.body.setVelocity(0, 0);
        this.untouchable = true;
        this.scene.tweens.add({ targets: this, alpha: 0.05, duration: P.fade * 1000 });
        this.scene.fx.glowBurst(this.x, this.y - 6, this.def.texture.includes('shadow') ? 0x7a4aa8 : 0x9ad8ff, 10);
        audio.sfx('teleport');
        this.dest = this.scene.room.findSpotNear(p.x, p.y, P.range[0], P.range[1], this.flying);
        this.mark = this.scene.fx.spawnMark(this.dest.x, this.dest.y, P.fade + P.appear, P.attack === 'slash' ? 0xff4a4a : 0x9ad8ff);
      }
    } else if (this.state === 'fade') {
      if (this.timer <= 0) {
        this.setPosition(this.dest.x, this.dest.y);
        this.state = 'appear'; this.timer = P.appear;
        this.scene.tweens.add({ targets: this, alpha: 1, duration: P.appear * 900 });
      }
    } else if (this.state === 'appear') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) {
        this.untouchable = false;
        this.mark?.destroy(); this.mark = null;
        const a = angleTo(this.x, this.y, p.x, p.y);
        if (P.attack === 'ring') {
          for (let i = 0; i < P.count; i++) this.scene.combat.fireEnemy(this.x, this.y - 6, (Math.PI * 2 * i) / P.count + fxRand(0, 0.5), P.projSpeed, Math.round(this.power() * 0.8), P.projFrame, { effect: P.effect });
          audio.sfx('freeze');
        } else if (P.attack === 'slash') {
          this.scene.fx.slashAt(this.x + Math.cos(a) * 12, this.y - 4 + Math.sin(a) * 12, a, 'slash_red_anim', 1.3);
          this.scene.combat.enemyMeleeArc(this, a, P.slashRange);
          audio.sfx('swing', { pitch: 0.6 });
        } else this.fireFan(P, a);
        this.enterIdle();
      }
    }
  },

  /** Засада: неподвижна и неуязвима для обнаружения, пока игрок не подойдёт; затем — поведение then. */
  ambush(dt, p) {
    if (this.awake) return EnemyAI[this.P.then].call(this, dt, p);
    if (this.state !== 'dormant' && this.state !== 'wake') { this.state = 'dormant'; this.anims.pause(); }
    this.body.setVelocity(0, 0);
    if (this.state === 'dormant') {
      this.dormantT = (this.dormantT || 0) + dt;
      // просыпается от приближения, урона или спустя 10 с — комната не может «зависнуть»
      if (dist(this.x, this.y, p.x, p.y) < this.def.detect || this.hp < this.maxHp || this.dormantT > 10) {
        this.state = 'wake'; this.timer = this.P.wake;
        this.tele = this.scene.fx.warnMark(this);
        audio.sfx('wake');
        this.scene.tweens.add({ targets: this, x: this.x + 1.5, duration: 50, yoyo: true, repeat: Math.floor(this.P.wake * 8) });
      }
    } else if (this.timer <= 0) {
      this.clearTele();
      this.awake = true; this.anims.resume();
      this.restoreTint();
      this.state = 'idle'; this.timer = 0.2;
    }
  },

  /** Поддержка: держится позади, усиливает союзников (щит / лечение / ярость). */
  support(dt, p) {
    const P = this.P; const d = dist(this.x, this.y, p.x, p.y);
    if (this.state === 'idle') {
      const allies = this.scene.combat.enemies.filter((e) => e.alive && e !== this && e.state !== 'spawn' && e.def.role !== 'support');
      if (d < P.keep[0]) this.steer(this.speed * 1.2, true);
      else if (allies.length) {
        const cx = allies.reduce((s, e) => s + e.x, 0) / allies.length; const cy = allies.reduce((s, e) => s + e.y, 0) / allies.length;
        const a = angleTo(p.x, p.y, cx, cy);
        this.steerTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40, this.speed);
      } else if (d > P.keep[1]) this.steer(this.speed); else this.body.setVelocity(0, 0);
      if (P.shoot) {
        this.shootT = (this.shootT ?? fxRand(1, 2)) - dt;
        if (this.shootT <= 0) { this.shootT = fxRand(P.shoot.cd[0], P.shoot.cd[1]); this.fireFan(P.shoot, angleTo(this.x, this.y - 6, p.x, p.y)); }
      }
      if (this.timer <= 0) {
        const now = this.scene.time.now;
        const targets = allies.filter((e) => dist(this.x, this.y, e.x, e.y) < P.range && (P.mode === 'shield' ? !(e.shieldHp > 0) : P.mode === 'empower' ? !(e.empowerUntil > now) : e.hp < e.maxHp));
        if (targets.length) {
          this.state = 'channel'; this.timer = 0.6; this.body.setVelocity(0, 0);
          this.buffTargets = targets.slice(0, 3);
          this.tele = this.scene.fx.chargeGlow(this, P.mode === 'empower' ? 0xff4a6a : 0x8af0ff, 0.6, -10);
        } else this.timer = 1.0;
      }
    } else if (this.state === 'channel') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) {
        this.clearTele();
        for (const e of this.buffTargets) {
          if (!e.alive) continue;
          const col = P.mode === 'empower' ? 0xff4a6a : P.mode === 'heal' ? 0x7cff8a : 0x8af0ff;
          this.scene.fx.beam(this.x, this.y - 8, e.x, e.y - 6, col);
          if (P.mode === 'shield') e.addShield(Math.round(e.maxHp * P.amount));
          else if (P.mode === 'empower') e.empower(6);
          else e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * P.amount));
        }
        audio.sfx('heal_enemy');
        this.enterIdle();
      }
    }
  },

  /** Орбитальный стрелок: кружит вокруг цели и выпускает залпы. */
  orbiter(dt, p) {
    const P = this.P;
    this.orbitA = (this.orbitA ?? angleTo(p.x, p.y, this.x, this.y)) + dt * 0.7 * (this.orbitDir || (this.orbitDir = Math.random() < 0.5 ? -1 : 1));
    if (this.state === 'idle') {
      this.steerTo(p.x + Math.cos(this.orbitA) * P.orbit, p.y + Math.sin(this.orbitA) * P.orbit * 0.7, this.speed);
      if (this.timer <= 0) {
        this.state = 'windup'; this.timer = P.windup; this.body.setVelocity(0, 0);
        this.tele = this.scene.fx.chargeGlow(this, 0xb884ff, P.windup, -8);
        audio.sfx('telegraph', { pitch: 1.2 });
      }
    } else if (this.state === 'windup') {
      this.body.setVelocity(0, 0);
      if (this.timer <= 0) {
        this.clearTele();
        this.burstN = (this.burstN || 0) + 1;
        const base = angleTo(this.x, this.y - 6, p.x, p.y) + (this.burstN % 2 ? 0.12 : -0.12);
        this.fireFan({ count: P.burst, spread: 1.0, projFrame: P.projFrame, projSpeed: P.projSpeed }, base);
        this.enterIdle();
      }
    }
  }
};

/** Выполнить поведение врага (с поддержкой засад и неизвестных поведений). */
export function runBehavior(enemy, dt, p) {
  const fn = EnemyAI[enemy.def.behavior];
  if (fn) fn.call(enemy, dt, p);
  else { enemy.steer(enemy.speed); }
}
