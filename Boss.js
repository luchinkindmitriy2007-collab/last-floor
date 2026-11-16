import Phaser from 'phaser';
import { Enemy } from './Enemy.js';
import { BossAttacks } from './BossAI.js';
import { audio } from './AudioSystem.js';
import { fxRand } from './Random.js';
import { angleTo, dist } from './Helpers.js';
import { DEPTH, hex } from './Constants.js';

/**
 * Босс или мини-босс, полностью описанный данными (bosses.json):
 * фазы → набор атак из BossAI, анимации появления/гибели, цвет темы.
 */
export class Boss extends Enemy {
  constructor(scene, x, y, id, def, opts = {}) {
    super(scene, x, y, id, { ...def, body: [16, 8, 0, 0], params: {}, behavior: 'boss' }, { ...opts, aggro: true });
    this.bdef = def;
    this.isBoss = true;
    this.minor = !!def.minor;
    this.major = true; // показывает полосу здоровья
    const scale = def.scale || 1;
    this.setScale(scale); this.baseScaleX = scale; this.baseScaleY = scale;
    this.frameH = this.frame.height;
    this.setOrigin(0.5, 0.92);
    const [bw, bh, ox, oy] = def.body;
    // для мини-боссов на базе 16×16 смещение считается как у обычных врагов
    if ((def.frameW || 32) === 16) this.body.setSize(bw, bh).setOffset((16 - bw) / 2 + ox, 16 - bh - 2);
    else this.body.setSize(bw, bh).setOffset(ox, oy);
    this.body.setImmovable(true);
    this.kbResist = 1;
    this.flying = !!def.flying;
    this.shadow.setTexture('shadow_big').setScale(this.minor ? 0.6 * scale / 2 : 1);
    this.color = hex(def.color || '#ffffff');
    this.projFrame = def.projFrame ?? 1;
    this.mouthY = -Math.round(this.frameH * scale * 0.55);
    this.phase = 0;
    this.attackQueue = [];
    this.hasRageFrame = this.texture.frameTotal > 3; // 3 кадра + __BASE
    this.state = 'intro';
    this.invuln = 99;
    this.stop();
    if (this.walkAnim) this.anims.stop();
    this.light = scene.lighting.add({ x, y, radius: this.minor ? 50 : 80, intensity: 0.7, follow: this });
    this.intro();
  }

  get phaseDef() { return this.bdef.phases[this.phase]; }
  get speedMult() { return (this.phaseDef.speedMult || 1) * super.speedMult; }

  stop() { this.body.setVelocity(0, 0); }
  angleToPlayer() { return angleTo(this.x, this.y, this.target.x, this.target.y); }
  face(cosA) { if (this.bdef.turnToFace) this.setFlipX(cosA < 0); }
  shake(ms, k) { if (this.scene.settings.shake) this.scene.cameras.main.shake(ms, k); }
  windPose(on) {
    if (this.walkAnim || this.minor) { if (on) this.telegraphTint(this.color); return; }
    if (this.phase > 0 && this.hasRageFrame) this.setFrame(2);
    else this.setFrame(on ? 1 : 0);
  }

  // ------------------------------------------------------------ появление
  intro() {
    const s = this.scene; const type = this.bdef.intro || 'rise';
    const done = () => { this.state = 'walk'; this.invuln = 0; this.timer = 0.6; if (this.walkAnim) this.play(this.walkAnim); };
    s.time.delayedCall(10, () => audio.sfx(this.minor ? 'roar' : 'bossIntro'));
    if (type === 'rise') {
      this.setScale(this.baseScaleX, 0.05).setAlpha(1);
      const iv = s.time.addEvent({ delay: 60, repeat: 18, callback: () => s.fx.dust(this.x + fxRand(-14, 14), this.y, 3) });
      s.tweens.add({ targets: this, scaleY: this.baseScaleY, duration: 1300, ease: 'Back.Out', onComplete: () => { iv.remove(); this.shake(300, 0.01); done(); } });
    } else if (type === 'descend') {
      const y0 = this.y; this.y -= 140; this.setAlpha(1);
      this.shadow.setScale(0.2);
      s.tweens.add({ targets: this.shadow, scale: this.minor ? 0.6 : 1, duration: 1100 });
      s.tweens.add({ targets: this, y: y0, duration: 1100, ease: 'Quad.In', onComplete: () => { s.combat.enemyShockwave(this, 50, 0, true); this.shake(350, 0.014); audio.sfx('slam'); done(); } });
    } else if (type === 'materialize') {
      this.setAlpha(0);
      const iv = s.time.addEvent({ delay: 50, repeat: 26, callback: () => { const a = fxRand(0, Math.PI * 2); const p = s.add.image(this.x + Math.cos(a) * 60, this.y - 16 + Math.sin(a) * 40, 'dot').setTint(this.color).setDepth(DEPTH.FX).setBlendMode(Phaser.BlendModes.ADD); s.tweens.add({ targets: p, x: this.x, y: this.y - 16, alpha: 0.2, duration: 450, onComplete: () => p.destroy() }); } });
      s.tweens.add({ targets: this, alpha: 1, duration: 1400, onComplete: () => { iv.remove(); s.fx.ring(this.x, this.y - 16, 60, this.color, 400); done(); } });
    } else { // awaken: тёмный силуэт оживает пульсом
      this.setAlpha(1).setTintFill(0x1a0a14);
      let n = 0;
      const beat = () => {
        n++; audio.sfx('heartbeat');
        s.fx.ring(this.x, this.y - 16, 30 + n * 20, this.color, 400);
        this.shake(120, 0.006);
        if (n < 3) s.time.delayedCall(450, beat);
        else { this.clearTint(); s.cameras.main.flash(250, 255, 60, 90); done(); this.startPulse(); }
      };
      s.time.delayedCall(300, beat);
    }
  }

  startPulse() {
    if (!this.bdef.pulse) return;
    this.scene.tweens.add({ targets: this, scaleX: this.baseScaleX * 1.05, scaleY: this.baseScaleY * 1.05, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  // ------------------------------------------------------------ цикл
  update(dt) {
    if (!this.alive) return;
    const p = this.target;
    this.timer -= dt; this.invuln -= dt;
    if (this.hitFlash > 0) { this.hitFlash -= dt; if (this.hitFlash <= 0) this.restoreTint(); }
    this.syncVisuals();
    this.setDisplayOrigin(this.width / 2, this.height * 0.92 + (this.flying ? 6 + Math.sin(this.scene.time.now / 300) * 3 : 0) / this.scaleY);
    this.shadow.setPosition(this.x, this.y + 1);
    if (this.state === 'intro' || this.state === 'dying') { this.stop(); return; }
    if (!p || !p.alive) { this.stop(); return; }

    const next = this.bdef.phases[this.phase + 1];
    if (next && this.hp / this.maxHp <= this.phaseDef.until) { this.enterPhase(this.phase + 1); return; }
    if (this.state === 'rage') { this.stop(); if (this.timer <= 0) this.nextAttack(); return; }

    if (this.atk) {
      const done = BossAttacks[this.atk.A.type].update(this, dt, this.atk.A);
      if (done) this.endAttack();
      return;
    }
    // ходьба между атаками
    if (!this.bdef.stationary && (this.bdef.speed || 0) > 0) {
      const d = dist(this.x, this.y, p.x, p.y);
      if (d > (this.minor ? 30 : 50)) this.steer(this.bdef.speed * (this.phaseDef.speedMult || 1));
      else this.stop();
      if (!this.bdef.turnToFace) this.setFlipX(false); else this.setFlipX(p.x < this.x);
    } else this.stop();
    if (this.timer <= 0) this.nextAttack();
  }

  nextAttack() {
    if (!this.attackQueue.length) {
      this.attackQueue = Phaser.Utils.Array.Shuffle(this.phaseDef.attacks.slice());
      if (this.attackQueue[0] === this.lastAttack) this.attackQueue.push(this.attackQueue.shift());
    }
    this.chain(this.attackQueue.shift());
  }

  /** Запустить атаку по имени (также для цепочек teleport → then). */
  chain(name) {
    const A = this.bdef.attacks[name];
    this.lastAttack = name;
    this.state = 'attack';
    this.clearTele();
    this.atk = { name, A };
    BossAttacks[A.type].start(this, A);
  }

  endAttack() {
    this.clearTele();
    this.atk = null; this.dashing = false;
    this.state = 'walk';
    this.windPose(false);
    const [a, b] = this.phaseDef.pause;
    this.timer = fxRand(a, b);
  }

  enterPhase(i) {
    this.phase = i;
    this.clearTele();
    if (this.gfx) { this.gfx.destroy(); this.gfx = null; }
    if (this.mark) { this.mark.destroy(); this.mark = null; }
    this.atk = null; this.dashing = false; this.untouchable = false; this.body.enable = true; this.setAlpha(1);
    this.attackQueue = [];
    this.state = 'rage'; this.timer = 1.4; this.invuln = 1.4;
    this.stop();
    this.windPose(false);
    if (this.minor || this.walkAnim) this.setTint(hex(this.bdef.rageColor || '#ff7a4a'));
    audio.sfx('roar');
    this.shake(600, 0.008);
    this.scene.cameras.main.flash(200, 255, 120, 80);
    const last = i === this.bdef.phases.length - 1;
    this.scene.ui?.banner(this.minor ? `${this.bdef.name.toUpperCase()} В ЯРОСТИ` : (last && this.bdef.phases.length > 2 ? 'ПОСЛЕДНЯЯ ФАЗА' : `${this.bdef.name.toUpperCase()}: ФАЗА ${i + 1}`), this.bdef.rageColor || '#ff7a4a');
    this.scene.combat.enemyShockwave(this, 80, 0, true);
    this.scene.combat.clearShots();
    if (this.light) this.light.color = hex(this.bdef.rageColor || '#ff7a4a');
    this.color = hex(this.bdef.rageColor || this.bdef.color);
  }

  restoreTint() {
    if ((this.minor || this.walkAnim) && this.phase > 0) this.setTint(hex(this.bdef.rageColor || '#ff7a4a'));
    else this.clearTint();
  }

  // ------------------------------------------------------------ гибель
  playDeath(onDone) {
    const s = this.scene; const type = this.bdef.death || 'crumble';
    this.state = 'dying';
    this.clearTele();
    if (this.gfx) { this.gfx.destroy(); this.gfx = null; }
    this.scene.tweens.killTweensOf(this);
    this.stop(); this.setTintFill(0xffffff);
    const n = this.minor ? 5 : 10;
    for (let i = 0; i < n; i++) {
      s.time.delayedCall(i * 120, () => {
        const x = this.x + fxRand(-16, 16) * this.scaleX * 0.6; const y = this.y + this.mouthY * fxRand(0.2, 1.6);
        s.fx.glowBurst(x, y, this.color, 14); s.fx.burst(x, y, 0xffffff, 6);
        audio.sfx('explode', { gap: 0 });
        this.setTintFill(i % 2 ? 0xffffff : this.color);
      });
    }
    s.time.delayedCall(n * 120, () => {
      this.clearTint();
      const end = () => { if (this.light) s.lighting.remove(this.light); onDone(); };
      if (type === 'shatter') {
        for (let i = 0; i < 30; i++) { const a = fxRand(0, Math.PI * 2); const sp = fxRand(40, 140); const sh = s.add.image(this.x, this.y + this.mouthY, 'proj', 7).setDepth(DEPTH.FX).setTint(this.color); s.tweens.add({ targets: sh, x: sh.x + Math.cos(a) * sp, y: sh.y + Math.sin(a) * sp, angle: fxRand(-360, 360), alpha: 0, duration: 900, onComplete: () => sh.destroy() }); }
        audio.sfx('shatter');
        s.tweens.add({ targets: this, alpha: 0, duration: 200, onComplete: end });
      } else if (type === 'dissolve') {
        s.tweens.add({ targets: this, alpha: 0, y: this.y - 20, duration: 1200, onComplete: end });
        const iv = s.time.addEvent({ delay: 40, repeat: 28, callback: () => s.fx.glowBurst(this.x + fxRand(-14, 14), this.y + this.mouthY * fxRand(0, 1.5), this.color, 2) });
        s.time.delayedCall(1250, () => iv.remove());
      } else if (type === 'burst') {
        s.fx.ring(this.x, this.y + this.mouthY, 120, this.color, 700);
        s.cameras.main.flash(300, 255, 240, 220);
        s.tweens.add({ targets: this, scaleX: this.scaleX * 1.4, scaleY: this.scaleY * 1.4, alpha: 0, duration: 450, onComplete: end });
      } else { // crumble
        s.tweens.add({ targets: this, scaleY: 0.05, duration: 1000, ease: 'Quad.In', onComplete: end });
        const iv = s.time.addEvent({ delay: 60, repeat: 16, callback: () => s.fx.dust(this.x + fxRand(-14, 14), this.y, 4) });
        s.time.delayedCall(1000, () => iv.remove());
      }
      this.shake(500, 0.012);
    });
  }

  destroy(fromScene) {
    if (this.light) this.scene?.lighting?.remove(this.light);
    if (this.gfx) this.gfx.destroy();
    super.destroy(fromScene);
  }
}
