import Phaser from 'phaser';
import { Projectile } from './Projectile.js';
import { Pickup } from './Pickup.js';
import { audio } from './AudioSystem.js';
import { GD } from './GameData.js';
import { fxRand } from './Random.js';
import { angleTo, angleDiff, dist } from './Helpers.js';
import { DEPTH, ROOM_PX_W, ROOM_PX_H } from './Constants.js';

const HAZARD = {
  fire: { color: 0xff5a1a, rim: 0xffb040, alpha: 0.45, dps: 8 },
  ice: { color: 0x7ad8ff, rim: 0xe8fbff, alpha: 0.35, dps: 0 },
  curse: { color: 0x7a3ab0, rim: 0xc08aff, alpha: 0.45, dps: 9 },
  crystal: { color: 0xff6ad0, rim: 0xffd0f0, alpha: 0.4, dps: 8 },
  void: { color: 0x5a0a2a, rim: 0xff4a6a, alpha: 0.55, dps: 11 }
};

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.pickups = [];
    this.playerShots = scene.physics.add.group({ classType: Projectile, maxSize: 160, runChildUpdate: false });
    this.enemyShots = scene.physics.add.group({ classType: Projectile, maxSize: 320, runChildUpdate: false });
    this.hazards = [];
    this.statusT = 0;
  }

  get player() { return this.scene.player; }
  get run() { return this.scene.run; }

  setupColliders() {
    const s = this.scene; const w = s.world;
    s.physics.add.collider(this.player, w.ground);
    s.physics.add.collider(this.player, w.pits);
    this.enemyGroup = s.physics.add.group();
    s.physics.add.collider(this.enemyGroup, w.ground);
    s.physics.add.collider(this.enemyGroup, w.pits, null, (e) => !e.flying);
    s.physics.add.collider(this.playerShots, w.ground, (shot, tile) => this.shotHitWall(shot, tile));
    s.physics.add.collider(this.enemyShots, w.ground, (shot) => { this.scene.fx.burst(shot.x, shot.y, shot.cfg?.trail || 0x7cff8a, 3); this.shotExpired(shot); shot.kill(); });
    s.physics.add.overlap(this.playerShots, this.enemyGroup, (shot, e) => this.shotHitEnemy(shot, e));
    s.physics.add.overlap(this.enemyShots, this.player, (a, b) => { const shot = a instanceof Projectile ? a : b; this.shotHitPlayer(shot); });
    s.physics.add.overlap(this.enemyGroup, this.player, (a, b) => { const e = a === this.player ? b : a; this.contact(e); });
  }

  addEnemy(e) { this.enemies.push(e); this.enemyGroup.add(e); }

  nearestEnemy(x, y, range = 9999, exclude) {
    let best = null; let bd = range;
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn' || (exclude && exclude.has(e))) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------------------------------------------------------- атаки игрока
  firePlayer({ angle, speed, frame, mult = 1, homing = 0, knock = 50, life = 1.2, light, trail, scale, x, y, pierce = 0, additive, spin, noHooks = false }) {
    const p = this.player;
    const shot = this.playerShots.get(p.x, p.y);
    if (!shot) return null;
    const { dmg, crit } = p.rollDamage(mult);
    const sx = x ?? p.x + Math.cos(angle) * 6; const sy = y ?? p.y - 4 + Math.sin(angle) * 6;
    shot.fire({ x: sx, y: sy, angle, speed, frame, owner: 'player', damage: dmg, crit, pierce: p.stats.pierce + pierce, homing: homing + (p.stats.homing ? 1.2 : 0), knock, life, light, trail, scale, additive, spin, noHooks });
    return shot;
  }

  playerMelee(x, y, angle, range, arcDeg, knock) {
    const half = Phaser.Math.DegToRad(arcDeg) / 2;
    this.scene.fx.slashAt(x + Math.cos(angle) * range * 0.45, y + Math.sin(angle) * range * 0.45, angle, 'slash_anim', range / 22);
    let hits = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const ex = e.x; const ey = e.y - 5 * e.scaleY;
      const d = dist(x, y, ex, ey);
      const reach = range + (e.isBoss ? 14 : 5);
      if (d > reach) continue;
      if (d > 8 && Math.abs(angleDiff(angle, angleTo(x, y, ex, ey))) > half) continue;
      if (e.untouchable) continue;
      let { dmg, crit } = this.player.rollDamage();
      const inc = angleTo(x, y, ex, ey);
      if (e.blocks && e.blocks(inc)) { this.blocked(e, ex, ey); dmg = Math.round(dmg * 0.25); }
      this.damageEnemy(e, dmg, { crit, angle: inc, knock });
      hits++;
    }
    // разрушение треснувших стен
    for (const t of this.scene.world.secretTiles(this.scene.room.data)) {
      if (dist(x, y, t.x, t.y) < range + 10) { this.scene.room.breakSecret(t.dk); break; }
    }
    if (hits) this.scene.hitstop(hits > 2 ? 45 : 30);
    // отбивание вражеских снарядов широким взмахом
    this.enemyShots.getChildren().forEach((s) => {
      if (!s.active) return;
      if (dist(x, y, s.x, s.y) < range && Math.abs(angleDiff(angle, angleTo(x, y, s.x, s.y))) < half) { this.scene.fx.hitSpark(s.x, s.y, 0xcfe8ff); s.kill(); }
    });
  }

  shotHitWall(shot, tile) {
    if (!shot.active) return;
    if (tile && (tile.index === 14 || tile.index === 16)) {
      const room = this.scene.room;
      const t = this.scene.world.secretTiles(room.data).find((s) => Math.abs(s.x - (tile.pixelX + 8)) < 9 && Math.abs(s.y - (tile.pixelY + 8)) < 9);
      if (t) room.breakSecret(t.dk);
    }
    this.scene.fx.burst(shot.x, shot.y, 0xcfc6d8, 3);
    shot.kill();
  }

  shotHitEnemy(shot, e) {
    if (!shot.active || !e.alive || e.state === 'spawn' || e.untouchable || shot.hitSet.has(e)) return;
    shot.hitSet.add(e);
    const ang = Math.atan2(shot.body.velocity.y, shot.body.velocity.x);
    if (e.blocks && e.blocks(ang)) { this.blocked(e, shot.x, shot.y); shot.kill(); return; }
    this.damageEnemy(e, shot.damage, { crit: shot.crit, angle: Math.atan2(shot.body.velocity.y, shot.body.velocity.x), knock: shot.knock, noHooks: shot.cfg.noHooks });
    if (shot.pierce > 0) shot.pierce--; else shot.kill();
  }

  /** Главная функция урона по врагу. */
  damageEnemy(e, amount, { crit = false, angle = 0, knock = 0, noHooks = false, color } = {}) {
    if (!e.alive) return 0;
    if (e.invuln > 0 || e.untouchable) { this.scene.fx.floatText(e.x, e.y - 20, 'БЛОК', '#8f8698'); return 0; }
    let dmg = Math.max(1, Math.round(amount * (1 - (e.armor || 0))));
    if (e.shieldHp > 0) {
      const absorbed = Math.min(e.shieldHp, dmg);
      e.shieldHp -= absorbed; dmg -= absorbed;
      this.scene.fx.ring(e.x, e.y - 6, 12, 0x8af0ff, 160);
      if (e.shieldHp <= 0) { audio.sfx('shieldBlock'); this.scene.fx.glowBurst(e.x, e.y - 6, 0x8af0ff, 10); }
      if (dmg <= 0) { this.scene.fx.floatText(e.x, e.y - 16, 'ЩИТ', '#8af0ff'); return 0; }
    }
    e.hp -= dmg;
    e.flash();
    e.showHpBar();
    if (knock) e.knockback(angle, knock);
    this.run.stats.damageDealt += dmg;
    this.scene.fx.hitSpark(e.x + fxRand(-3, 3), e.y - 6 * e.scaleY, crit ? 0xffe08a : 0xffffff);
    this.scene.fx.floatText(e.x, e.y - 14 * e.scaleY, crit ? `${dmg}!` : `${dmg}`, color || (crit ? '#ffd24a' : '#ffffff'), crit);
    audio.sfx(crit ? 'crit' : 'hit', { pitch: e.isBoss ? 0.7 : (e.scaleX > 1.2 ? 0.8 : 1 + (e.id.length % 4) * 0.08) });
    if (e.major) this.scene.ui?.bossBar(e);
    if (!noHooks) this.trigger('hit', { enemy: e, damage: dmg });
    if (e.hp <= 0) this.killEnemy(e);
    return dmg;
  }

  /** silent — взорвался сам (без награды). */
  killEnemy(e, { silent = false } = {}) {
    if (!e.alive) return;
    e.alive = false;
    e.clearTele();
    e.body.enable = false;
    e.mark?.destroy(); e.mark = null;
    const def = e.def;
    const run = this.run;
    if (silent) {
      this.scene.tweens.add({ targets: e, alpha: 0, duration: 120, onComplete: () => { this.enemies = this.enemies.filter((x) => x !== e); e.destroy(); this.scene.room.checkCleared(); } });
      e.shadow.setVisible(false);
      return;
    }
    run.stats.kills++;
    if (e.elite) run.stats.eliteKills++;
    const meta = this.scene.save.meta;
    meta.enemiesKilled++;
    meta.bestiary[e.id] = (meta.bestiary[e.id] || 0) + 1;
    // опыт и добыча
    const sumK = e.summonedBy ? 0.4 : 1; // призванные дают меньше — иначе их можно «фармить»
    this.scene.gainXp(Math.max(1, Math.round(def.xp * (e.elite ? 2 : 1) * sumK)));
    const [g0, g1] = def.gold || [0, 0];
    let gold = e.summonedBy ? 0 : Math.round(fxRand(g0, g1 + 0.99) * (e.elite ? 2.2 : 1));
    this.dropGold(e.x, e.y, gold);
    if (Math.random() < (e.elite ? 0.35 : 0.05) + this.player.stats.luck * 0.01) this.spawnPickup(e.x, e.y, 'heart');
    if (def.dropItem) {
      const item = this.scene.items.roll(this.scene.rng.fork(`drop${run.stats.kills}`), { minRarity: def.dropItem, luck: this.player.stats.luck, exclude: run.items });
      this.spawnPickup(e.x, e.y, 'item', { item });
    }
    if (e.elite && Math.random() < 0.25) this.spawnPickup(e.x, e.y, 'shard', { value: 2 });
    // эффекты
    const color = deathColor(def.texture);
    this.scene.fx.burst(e.x, e.y - 6, color, e.isBoss ? 40 : 14);
    this.scene.fx.glowBurst(e.x, e.y - 6, 0xffffff, 6);
    audio.sfx('enemyDie');
    if (def.splitInto) {
      for (let i = 0; i < def.splitInto.count; i++) this.scene.room.spawnEnemy(def.splitInto.id, e.x + fxRand(-8, 8), e.y + fxRand(-6, 6), { instant: true });
    }
    this.trigger('kill', { enemy: e });
    if (e.isBoss) this.scene.room.onBossKilled(e);
    if (e.playDeath) { e.shadow.setVisible(false); e.playDeath(() => { this.enemies = this.enemies.filter((x) => x !== e); e.destroy(); this.scene.room.checkCleared(); }); return; }
    this.scene.tweens.add({
      targets: e, alpha: 0, scaleY: e.scaleY * 0.2, scaleX: e.scaleX * 1.4, duration: e.isBoss ? 900 : 200,
      onComplete: () => { this.enemies = this.enemies.filter((x) => x !== e); e.destroy(); this.scene.room.checkCleared(); }
    });
    e.shadow.setVisible(false);
    if (e.hpBar) { e.hpBar.bg.setVisible(false); e.hpBar.fg.setVisible(false); }
  }

  dropGold(x, y, gold) {
    if (gold <= 0) return;
    gold = Math.round(gold * this.player.stats.goldMult);
    const coins = Math.min(6, Math.max(1, Math.ceil(gold / 3)));
    let left = gold;
    for (let i = 0; i < coins; i++) {
      const v = i === coins - 1 ? left : Math.max(1, Math.floor(gold / coins));
      left -= v;
      if (v > 0) this.spawnPickup(x, y, 'coin', { value: v });
    }
  }

  spawnPickup(x, y, kind, payload = {}) {
    const p = new Pickup(this.scene, x, y, kind, { scatter: kind !== 'item', ...payload });
    this.scene.physics.add.collider(p, this.scene.world.ground);
    this.pickups.push(p);
    return p;
  }

  updatePickups(dt) {
    const pl = this.player;
    this.pickups = this.pickups.filter((p) => {
      if (!p.active) return false;
      if (p.update(dt, pl)) { this.collect(p); p.destroy(); return false; }
      return true;
    });
  }

  collect(p) {
    const run = this.run; const fx = this.scene.fx;
    if (p.kind === 'coin') { run.gold += p.payload.value; run.stats.goldEarned += p.payload.value; audio.sfx('coin'); fx.burst(p.x, p.y, 0xffd24a, 4); }
    if (p.kind === 'heart') { this.healPlayer(12); audio.sfx('pickup'); }
    if (p.kind === 'potion') { run.potions++; audio.sfx('pickup'); this.scene.ui.toast('+1 зелье', '#e8404a'); }
    if (p.kind === 'shard') { run.shardsBonus += p.payload.value || 1; audio.sfx('pickup'); fx.floatText(p.x, p.y - 8, `+${p.payload.value || 1} ОСКОЛ.`, '#62d6ff'); }
    if (p.kind === 'item') this.scene.grantItem(p.payload.item, p.x, p.y);
  }

  magnetAll() { this.pickups.forEach((p) => { if (p.kind !== 'item') p.forceMagnet = true; }); }

  // ---------------------------------------------------------- урон игроку
  contact(e) {
    if (!e.alive || e.untouchable || ['spawn', 'stun', 'dormant', 'wake', 'fade', 'intro', 'dying'].includes(e.state) || e.knockT > 0) return;
    const mult = e.dashing || e.state === 'charge' || e.state === 'dive' || e.state === 'hop' || e.state === 'lunge' ? 1 : 0.6;
    this.hurtPlayer(Math.round((e.power ? e.power() : e.damage) * mult), e, { melee: true });
  }

  enemyMeleeArc(e, angle, range) {
    const p = this.player;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < range + 6 && Math.abs(angleDiff(angle, angleTo(e.x, e.y, p.x, p.y))) < 1.1) this.hurtPlayer(e.power ? e.power() : e.damage, e, { melee: true });
  }

  shotHitPlayer(shot) {
    if (!shot.active) return;
    const p = this.player;
    if (p.rolling > 0) return;
    if (this.hurtPlayer(shot.damage, null, {})) { if (shot.cfg.effect) this.applyStatus(shot.cfg.effect); shot.kill(); }
    else if (p.iframes <= 0) shot.kill();
  }

  enemyShockwave(e, radius, damage, pushOnly = false, inner = 0) {
    this.scene.fx.ring(e.x, e.y - 4, radius, 0xffb070, 350);
    this.scene.fx.burst(e.x, e.y, 0x9a9c8a, 18);
    const p = this.player;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d <= radius + 4 && d >= inner - 4) {
      if (!pushOnly) this.hurtPlayer(damage, e, {});
      const a = angleTo(e.x, e.y, p.x, p.y);
      p.vel.x = Math.cos(a) * 260; p.vel.y = Math.sin(a) * 260;
    }
  }

  /** Обвал камней при ударе босса о стену: круги-телеграфы, затем удар. */
  rockfall(n, damage) {
    const r = this.scene.room;
    for (let i = 0; i < n; i++) {
      const target = i === 0 ? { x: this.player.x, y: this.player.y } : { x: r.ox + fxRand(48, ROOM_PX_W - 48), y: r.oy + fxRand(56, ROOM_PX_H - 40) };
      const delay = 200 + i * 120;
      this.scene.time.delayedCall(delay, () => {
        const tele = this.scene.fx.circleTelegraph(target.x, target.y, 14, 0.7, 0xffb070);
        this.scene.time.delayedCall(700, () => {
          tele.destroy();
          this.scene.fx.burst(target.x, target.y, 0x8a8c7c, 12);
          this.scene.fx.dust(target.x, target.y, 4);
          audio.sfx('hit', { gap: 0 });
          if (dist(target.x, target.y, this.player.x, this.player.y) < 16) this.hurtPlayer(damage, null, {});
        });
      });
    }
  }

  /** Возвращает true, если урон прошёл. */
  hurtPlayer(amount, source, { melee = false, dot = false } = {}) {
    const p = this.player;
    if (!p.alive || this.scene.godMode) return false;
    if (dot) {
      // урон от огня/зон не даёт неуязвимости и не сбивает щит
      p.hp -= amount; this.run.stats.damageTaken += amount;
      this.scene.fx.floatText(p.x, p.y - 16, `-${amount}`, '#ff9a5a');
      if (p.hp <= 0) { p.hp = 0; this.scene.onPlayerDeath(); }
      return true;
    }
    if (p.iframes > 0) return false;
    if (p.shield > 0) {
      p.shield--; p.iframes = 0.5;
      this.scene.fx.ring(p.x, p.y - 5, 18, 0xffe08a, 250);
      audio.sfx('shield');
      if (p.shield <= 0) { p.shieldFx?.destroy(); p.shieldFx = null; }
      return true;
    }
    let dmg = amount * (1 - p.stats.armor);
    if (p.barrier > 0) dmg *= 1 - p.cls.ability.reduce;
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg;
    p.iframes = 0.75;
    this.run.stats.damageTaken += dmg;
    this.run.tookDamage = true;
    this.scene.fx.floatText(p.x, p.y - 18, `-${dmg}`, '#ff5a5a', true);
    this.scene.fx.burst(p.x, p.y - 6, 0xe8404a, 10);
    p.setTintFill(0xff4040);
    this.scene.time.delayedCall(90, () => p.clearTint());
    audio.sfx('hurt');
    if (this.scene.settings.shake) this.scene.cameras.main.shake(120, 0.006);
    this.scene.ui?.damageVignette();
    this.trigger('hurt', { source, amount: dmg, melee });
    if (p.hp <= 0) {
      const rev = this.scene.itemEffects.find((e) => e.effect.do === 'revive');
      if (rev && !this.run.usedRevive) {
        this.run.usedRevive = true;
        p.hp = Math.round(p.stats.maxHp * rev.effect.value);
        p.iframes = 2;
        this.scene.fx.glowBurst(p.x, p.y, 0xff7a3a, 40);
        this.scene.fx.ring(p.x, p.y, 80, 0xff7a3a, 600);
        this.nova(p.x, p.y, 80, 2, 0xff7a3a);
        this.scene.ui.banner('ФЕНИКС ВОЗРОЖДАЕТ ВАС', '#ff7a3a');
        audio.sfx('levelup');
      } else {
        p.hp = 0;
        this.scene.onPlayerDeath();
      }
    }
    return true;
  }

  healPlayer(amount) {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(p.stats.maxHp, p.hp + amount);
    const got = Math.round(p.hp - before);
    if (got > 0) { this.scene.fx.floatText(p.x, p.y - 18, `+${got}`, '#7cff8a'); this.scene.fx.glowBurst(p.x, p.y - 4, 0x7cff8a, 6); }
  }

  // ---------------------------------------------------------- эффекты предметов
  trigger(event, ctx) {
    const list = this.scene.itemEffects; if (!list || !list.length) return;
    const run = this.run;
    for (const { key, effect: e } of list) {
      if (e.on !== event) continue;
      if (e.chance && Math.random() >= e.chance) continue;
      if (e.every) {
        run.counters[key] = (run.counters[key] || 0) + 1;
        if (run.counters[key] < e.every) continue;
        run.counters[key] = 0;
      }
      this.runAction(e, ctx);
    }
  }

  runAction(e, ctx) {
    const p = this.player; const base = p.stats.damageBase * p.stats.damageMult;
    switch (e.do) {
      case 'heal': this.healPlayer(e.value); break;
      case 'chain': this.chainLightning(ctx.enemy, Math.round(ctx.damage * e.dmgPct), e.targets); break;
      case 'explode': if (ctx.enemy) this.explode(ctx.enemy.x, ctx.enemy.y - 4, e.radius * p.stats.area, Math.round(base * e.dmgPct)); break;
      case 'thorns': if (ctx.source && ctx.melee && ctx.source.alive) this.damageEnemy(ctx.source, Math.round(ctx.amount * e.value), { noHooks: true, color: '#c8c4bc' }); break;
      case 'shield': p.addShield(e.value); break;
      case 'buff': p.addBuff(e.stat, e.value, e.dur); this.scene.fx.glowBurst(p.x, p.y - 4, 0x9a7af0, 8); break;
      case 'stack': p.roomStacks[e.stat] = Math.min(e.max, (p.roomStacks[e.stat] || 0) + e.value); break;
      case 'echo': p.echoAttack(); break;
      case 'nova': this.ringOfShards(p.x, p.y - 4, e.count, e.dmgPct); break;
      case 'shockwave': this.nova(p.x, p.y - 3, e.radius * p.stats.area, e.dmgPct, 0xc8c4a0); break;
      case 'phantom': this.phantom(p, e.radius * p.stats.area, e.dmgPct); break;
      case 'meteor': this.meteors(e.count, e.dmgPct); break;
      default: break;
    }
  }

  chainLightning(from, dmg, n) {
    if (!from) return;
    let cur = from; const hit = new Set([from]);
    for (let i = 0; i < n; i++) {
      const next = this.nearestEnemy(cur.x, cur.y, 90, hit);
      if (!next) break;
      hit.add(next);
      this.drawBolt(cur.x, cur.y - 6, next.x, next.y - 6);
      this.damageEnemy(next, Math.max(1, dmg), { noHooks: true, color: '#f0e060' });
      cur = next;
    }
    audio.sfx('zap');
  }

  drawBolt(x0, y0, x1, y1) {
    const g = this.scene.add.graphics().setDepth(DEPTH.FX + 3).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(1, 0xfff6a0, 1);
    g.beginPath(); g.moveTo(x0, y0);
    const n = 5;
    for (let i = 1; i < n; i++) g.lineTo(x0 + ((x1 - x0) * i) / n + fxRand(-4, 4), y0 + ((y1 - y0) * i) / n + fxRand(-4, 4));
    g.lineTo(x1, y1); g.strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  explode(x, y, r, dmg) {
    this.scene.fx.ring(x, y, r, 0xff8a3a, 280);
    this.scene.fx.glowBurst(x, y, 0xff8a3a, 14);
    audio.sfx('explode');
    for (const e of this.enemies) if (e.alive && e.state !== 'spawn' && dist(x, y, e.x, e.y) < r) this.damageEnemy(e, dmg, { noHooks: true, angle: angleTo(x, y, e.x, e.y), knock: 100, color: '#ff9a4a' });
  }

  /** Круговая волна вокруг игрока (способности, сердце голема). */
  nova(x, y, r, dmgMult, color) {
    this.scene.fx.ring(x, y, r, color, 320);
    this.scene.fx.glowBurst(x, y, color, 16);
    if (this.scene.settings.shake) this.scene.cameras.main.shake(100, 0.004);
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      if (dist(x, y, e.x, e.y - 4) > r + (e.isBoss ? 12 : 4)) continue;
      const { dmg, crit } = this.player.rollDamage(dmgMult);
      this.damageEnemy(e, dmg, { crit, angle: angleTo(x, y, e.x, e.y), knock: 200, noHooks: true });
    }
    this.enemyShots.getChildren().forEach((s) => { if (s.active && dist(x, y, s.x, s.y) < r) s.kill(); });
  }

  ringOfShards(x, y, count, dmgPct) {
    for (let i = 0; i < count; i++) this.firePlayer({ x, y, angle: (Math.PI * 2 * i) / count, speed: 200, frame: 3, mult: dmgPct, knock: 30, life: 0.7, trail: 0x9ad8ff, noHooks: true });
  }

  windBlades(count, dmgPct) {
    const p = this.player;
    for (let i = 0; i < count; i++) {
      const target = this.nearestEnemy(p.x, p.y, 200);
      const a = target ? angleTo(p.x, p.y, target.x, target.y) + (i - (count - 1) / 2) * 0.4 : fxRand(0, Math.PI * 2);
      this.firePlayer({ angle: a, speed: 230, frame: 3, mult: dmgPct, knock: 30, life: 0.9, trail: 0xd8f8ff, homing: 1.5, spin: 18, noHooks: true });
    }
  }

  phantom(p, r, dmgPct) {
    const ghost = this.scene.add.image(p.x, p.y, p.texture.key, p.frame.name).setOrigin(p.originX, p.originY).setTintFill(0xc08aff).setAlpha(0.7).setDepth(p.depth).setFlipX(p.flipX);
    this.scene.tweens.add({ targets: ghost, alpha: 0.3, duration: 150, yoyo: true, repeat: 2 });
    this.scene.time.delayedCall(700, () => {
      this.nova(ghost.x, ghost.y - 4, r, dmgPct, 0xc08aff);
      audio.sfx('explode');
      ghost.destroy();
    });
  }

  meteors(count, dmgPct) {
    const alive = this.enemies.filter((e) => e.alive && e.state !== 'spawn');
    for (let i = 0; i < count; i++) {
      const t = alive.length ? alive[i % alive.length] : null;
      const r = this.scene.room;
      const x = t ? t.x + fxRand(-12, 12) : r.ox + fxRand(60, ROOM_PX_W - 60);
      const y = t ? t.y + fxRand(-12, 12) : r.oy + fxRand(60, ROOM_PX_H - 60);
      this.scene.time.delayedCall(i * 140, () => {
        const tele = this.scene.fx.circleTelegraph(x, y, 22, 0.45, 0xffb040);
        this.scene.time.delayedCall(450, () => { tele.destroy(); this.explode(x, y, 26, Math.round(this.player.stats.damageBase * this.player.stats.damageMult * dmgPct)); });
      });
    }
    this.scene.ui.toast('Дождь метеоров!', '#ffb040');
  }

  blocked(e, x, y) {
    this.scene.fx.hitSpark(x, y, 0xcfe8ff);
    this.scene.fx.floatText(e.x, e.y - 18, 'БЛОК', '#cfe8ff');
    audio.sfx('shieldBlock');
    if (e.shieldFx) this.scene.tweens.add({ targets: e.shieldFx, alpha: { from: 1, to: 0.75 }, scale: { from: 1.4, to: 1 }, duration: 160 });
  }

  /** Снаряд разбился — может оставить опасную зону (наледь и т.п.). */
  shotExpired(shot) {
    if (shot.cfg?.expireHazard) this.addHazard(shot.x, shot.y, 12, shot.cfg.expireHazard, 3);
  }

  // ---------------------------------------------------------- опасные зоны и статусы
  /** Зона на полу: fire — горение, ice — замедление, curse/void/crystal — урон. */
  addHazard(x, y, r, type, dur = 4) {
    if (!type || this.hazards.length > 40) return;
    const look = HAZARD[type] || HAZARD.fire;
    const img = this.scene.add.image(x, y, 'disc').setTint(look.color).setAlpha(0).setScale((r * 2) / 64).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    const rim = this.scene.add.image(x, y, 'ring_thin').setTint(look.rim).setAlpha(0).setScale((r * 2) / 64).setDepth(4);
    this.scene.tweens.add({ targets: img, alpha: look.alpha, duration: 200 });
    this.scene.tweens.add({ targets: rim, alpha: 0.7, duration: 200 });
    const h = { x, y, r, type, until: this.scene.time.now + dur * 1000, img, rim, t: 0 };
    this.hazards.push(h);
    return h;
  }

  updateHazards(dt) {
    const now = this.scene.time.now; const p = this.player;
    this.statusT -= dt;
    const tick = this.statusT <= 0;
    if (tick) this.statusT = 0.5;
    let slowed = false;
    this.hazards = this.hazards.filter((h) => {
      const left = h.until - now;
      if (left <= 0) { h.img.destroy(); h.rim.destroy(); return false; }
      h.t += dt;
      const look = HAZARD[h.type];
      h.img.setAlpha(look.alpha * Math.min(1, left / 600) * (0.8 + Math.sin(h.t * 6) * 0.2));
      h.rim.setAlpha(Math.min(0.7, left / 600));
      if (Math.random() < dt * 6) this.scene.fx.emitter(look.rim, 'glow').explode(1, h.x + fxRand(-h.r, h.r) * 0.7, h.y + fxRand(-h.r, h.r) * 0.5);
      if (p.alive && p.rolling <= 0 && dist(h.x, h.y, p.x, p.y + 2) < h.r) {
        if (h.type === 'ice') slowed = true;
        else if (tick) {
          if (h.type === 'fire') this.applyStatus('burn');
          const dmg = Math.max(1, Math.round(look.dps * (1 + (this.run.floor - 1) * 0.03) * 0.5));
          this.hurtPlayer(dmg, null, { dot: true });
        }
      }
      return true;
    });
    if (slowed) this.applyStatus('chill');
    // горение
    if (p.burnUntil > now && tick) { this.hurtPlayer(Math.max(1, Math.round(2 + this.run.floor * 0.15)), null, { dot: true }); this.scene.fx.burst(p.x, p.y - 8, 0xff8a3a, 3); }
  }

  applyStatus(kind) {
    const p = this.player; const now = this.scene.time.now;
    if (kind === 'burn') p.burnUntil = now + 2000;
    if (kind === 'slow') { p.slowUntil = now + 1600; p.slowMult = 0.6; }
    if (kind === 'chill') { p.slowUntil = Math.max(p.slowUntil || 0, now + 350); p.slowMult = 0.55; }
  }

  clearHazards() { this.hazards.forEach((h) => { h.img.destroy(); h.rim.destroy(); }); this.hazards = []; }

  /** Взрыв врага-камикадзе. */
  enemyExplode(e, radius, damage, hazard) {
    this.scene.fx.ring(e.x, e.y - 4, radius, 0xff8a3a, 300);
    this.scene.fx.glowBurst(e.x, e.y - 4, hazard === 'curse' ? 0xb884ff : 0xff8a3a, 22);
    audio.sfx('explode');
    if (this.scene.settings.shake) this.scene.cameras.main.shake(150, 0.006);
    if (dist(e.x, e.y, this.player.x, this.player.y) < radius + 4) this.hurtPlayer(damage, e, {});
    // взрыв задевает и других врагов — можно этим пользоваться
    for (const o of this.enemies) if (o !== e && o.alive && o.state !== 'spawn' && dist(e.x, e.y, o.x, o.y) < radius) this.damageEnemy(o, Math.round(damage * 0.5), { noHooks: true, color: '#ff9a4a' });
    if (hazard) this.addHazard(e.x, e.y, radius * 0.7, hazard, 4);
    this.killEnemy(e, { silent: true });
  }

  fireEnemy(x, y, angle, speed, damage, frame = 1, opts = {}) {
    const s = this.enemyShots.get(x, y);
    if (!s) return;
    const trail = PROJ_TRAIL[frame];
    s.fire({ x, y, angle, speed, frame, owner: 'enemy', damage, life: 4, trail, light: 28, rotate: frame === 5 || frame === 7, effect: opts.effect, expireHazard: opts.expireHazard, homing: opts.homing || 0 });
    s.homingEnemy = opts.homing || 0;
    s.body.setCircle(2.5, s.width / 2 - 2.5, s.height / 2 - 2.5);
  }

  clearShots() {
    this.enemyShots.getChildren().forEach((s) => s.active && s.kill());
    this.playerShots.getChildren().forEach((s) => s.active && s.kill());
  }

  /** Использовано событием «Потерянный сундук» и т.п. */
  get anyAlive() { return this.enemies.some((e) => e.alive); }
}

export { GD };

const PROJ_TRAIL = { 1: 0x7cff8a, 2: 0xff9a4a, 3: 0x9ad8ff, 5: 0xffd8a0, 6: 0xc08aff, 7: 0xff8ad8, 8: 0xff4a6a };

function deathColor(tex) {
  if (/slime|wolf_alpha|ghost/.test(tex)) return tex.includes('fire') ? 0xff8a3a : tex.includes('ghost') ? 0xe8f4ff : 0x6cc04a;
  if (/fire|lava|demon|imp|ash|inferno|beetle/.test(tex)) return 0xff8a3a;
  if (/ice|frozen|wolf|snow/.test(tex)) return 0x9ad8ff;
  if (/crystal|sphere|blinker|guardian|brood/.test(tex)) return 0xff8ad8;
  if (/shadow|soul|void|twisted|devourer|reaper/.test(tex)) return 0x9a6ad8;
  if (/zombie/.test(tex)) return 0x8aa870;
  if (/bat/.test(tex)) return 0x6c4f8c;
  return 0xd8d0b8;
}
