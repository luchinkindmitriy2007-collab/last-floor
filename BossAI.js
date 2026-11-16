// Библиотека атак боссов. Каждая атака: start(b, A) и update(b, dt, A) → true,
// когда атака завершена. A — параметры из bosses.json. Все опасные атаки
// имеют телеграф: круг, линию, свечение, метку на полу или тонкий луч.

import Phaser from 'phaser';
import { audio } from './AudioSystem.js';
import { fxRand } from './Random.js';
import { angleTo, dist } from './Helpers.js';
import { ROOM_PX_W, ROOM_PX_H, DEPTH, hex } from './Constants.js';

const fx = (b) => b.scene.fx;
const C = (b) => b.scene.combat;
const dmg = (b, k = 1) => Math.round(b.power() * k);

/** Расстояние от точки до отрезка. */
function distToSeg(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0; const dy = y1 - y0; const l2 = dx * dx + dy * dy || 1;
  const t = Phaser.Math.Clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1);
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

export const BossAttacks = {
  /** Удар о землю: круг заполняется, затем ударная волна (до нескольких колец). */
  slam: {
    start(b, A) { b.windPose(true); b.k = 0; b.t = A.windup; b.ringR = A.radius; b.tele = fx(b).circleTelegraph(b.x, b.y - 4, A.radius, A.windup, 0xff4a4a); audio.sfx('telegraph', { pitch: 0.5 }); },
    update(b, dt, A) {
      b.stop(); if ((b.t -= dt) > 0) return false;
      b.clearTele(); b.windPose(false);
      const inner = b.k ? b.ringR / 1.6 : 0;
      C(b).enemyShockwave(b, b.ringR, dmg(b), false, inner);
      if (A.hazard) for (let i = 0; i < 5; i++) { const a = (Math.PI * 2 * i) / 5; C(b).addHazard(b.x + Math.cos(a) * b.ringR * 0.6, b.y + Math.sin(a) * b.ringR * 0.6, 16, A.hazard, 4); }
      audio.sfx('slam'); b.shake(250, 0.012);
      b.k++;
      if (b.k < (A.rings || 1)) { const next = b.ringR * 1.6; b.tele = fx(b).circleTelegraph(b.x, b.y - 4, next, 0.5, 0xff4a4a, b.ringR); b.ringR = next; b.t = 0.5; return false; }
      return true;
    }
  },

  /** Таран по линии; удар о стену оглушает и роняет камни. trail — огненный след. */
  charge: {
    start(b, A) { b.sub = 'wind'; b.t = A.windup; b.chargeA = b.angleToPlayer(); b.tele = fx(b).lineTelegraph(b, b.chargeA, 260, 20); audio.sfx('charge'); },
    update(b, dt, A) {
      b.t -= dt;
      if (b.sub === 'wind') {
        b.stop();
        if (b.t > A.windup * 0.4) { b.chargeA = b.angleToPlayer(); b.tele?.setAngle(b.chargeA); }
        b.x += fxRand(-0.8, 0.8);
        if (b.t <= 0) { b.clearTele(); b.sub = 'go'; b.t = A.time; b.dashing = true; b.face(Math.cos(b.chargeA)); b.trailT = 0; }
        return false;
      }
      if (b.sub === 'go') {
        const sp = A.speed * b.speedMult;
        b.body.setVelocity(Math.cos(b.chargeA) * sp, Math.sin(b.chargeA) * sp);
        if (Math.random() < 0.7) fx(b).dust(b.x + fxRand(-8, 8), b.y, 2);
        if (A.trail && (b.trailT -= dt) <= 0) { b.trailT = 0.09; C(b).addHazard(b.x, b.y, 12, A.trail, 3.5); }
        const bl = b.body.blocked; const wall = bl.left || bl.right || bl.up || bl.down;
        if (wall || b.t <= 0) {
          b.stop(); b.dashing = false;
          if (wall) {
            b.shake(300, 0.012); audio.sfx('slam'); fx(b).stars(b, -26 * b.scaleY);
            if (A.debris) C(b).rockfall(A.debris + b.phase * 2, dmg(b, 0.7));
            b.sub = 'stun'; b.t = 1.0; b.state = 'stun';
            return false;
          }
          return true;
        }
        return false;
      }
      b.stop();
      if (b.t <= 0) { b.state = 'attack'; return true; }
      return false;
    }
  },

  /** Прицельные веера снарядов волнами. */
  volley: {
    start(b, A) { b.t = A.windup; b.k = 0; b.windPose(true); b.tele = fx(b).chargeGlow(b, b.color, A.windup, b.mouthY, 1.4); audio.sfx('telegraph', { pitch: 0.7 }); },
    update(b, dt, A) {
      b.stop(); if ((b.t -= dt) > 0) return false;
      if (b.k === 0) { b.clearTele(); b.windPose(false); }
      const base = angleTo(b.x, b.y + b.mouthY, b.target.x, b.target.y);
      const n = A.count + b.phase; const sp = A.spread;
      for (let i = 0; i < n; i++) {
        const a = base - sp / 2 + (sp * i) / Math.max(1, n - 1) + (b.k % 2 ? sp / Math.max(1, n - 1) / 2 : 0);
        C(b).fireEnemy(b.x, b.y + b.mouthY, a, A.speed, dmg(b, 0.6), A.frame ?? b.projFrame, { effect: A.effect, homing: A.homing });
      }
      audio.sfx('zap');
      b.k++; b.t = A.interval || 0.38;
      return b.k >= A.waves;
    }
  },

  /** Вращающаяся спираль из нескольких рукавов. chase — медленно идёт к игроку. */
  spiral: {
    start(b, A) { b.t = A.windup; b.sub = 'wind'; b.windPose(true); b.tele = fx(b).chargeGlow(b, b.color, A.windup, b.mouthY, 1.6); audio.sfx('telegraph', { pitch: 0.6 }); },
    update(b, dt, A) {
      b.t -= dt;
      if (b.sub === 'wind') { b.stop(); if (b.t <= 0) { b.clearTele(); b.sub = 'fire'; b.t = A.duration; b.spin = fxRand(0, 6); b.rate = 0; } return false; }
      if (A.chase) b.steerTo(b.target.x, b.target.y, A.chase); else b.stop();
      b.rate -= dt;
      if (b.rate <= 0) {
        b.rate = A.rate; b.spin += A.turn ?? 0.23;
        for (let i = 0; i < A.arms; i++) C(b).fireEnemy(b.x, b.y + b.mouthY, b.spin + (Math.PI * 2 * i) / A.arms, A.speed, dmg(b, 0.5), A.frame ?? b.projFrame, { effect: A.effect });
        audio.sfx('shoot', { gap: 90 });
      }
      if (b.t <= 0) { b.windPose(false); return true; }
      return false;
    }
  },

  /** Кольца снарядов; gap — «окно», через которое нужно пройти. */
  ring: {
    start(b, A) { b.t = A.windup; b.k = 0; b.windPose(true); b.tele = fx(b).chargeGlow(b, b.color, A.windup, b.mouthY, 1.5); audio.sfx('telegraph', { pitch: 0.8 }); },
    update(b, dt, A) {
      b.stop(); if ((b.t -= dt) > 0) return false;
      if (b.k === 0) { b.clearTele(); b.windPose(false); }
      const off = fxRand(0, Math.PI * 2) * (A.offset ? 0 : 1) + b.k * (A.offset || 0);
      const gapStart = A.gap ? Math.floor(fxRand(0, A.count)) : -99;
      for (let i = 0; i < A.count; i++) {
        if (A.gap && ((i - gapStart + A.count) % A.count) < A.gap) continue;
        C(b).fireEnemy(b.x, b.y + b.mouthY, off + (Math.PI * 2 * i) / A.count, A.speed, dmg(b, 0.55), A.frame ?? b.projFrame);
      }
      audio.sfx('zap'); fx(b).ring(b.x, b.y + b.mouthY, 20, b.color, 200);
      b.k++; b.t = A.interval || 0.5;
      return b.k >= (A.waves || 1);
    }
  },

  /** Призыв союзников (не больше cap живых). */
  summon: {
    start(b, A) {
      b.t = A.windup; b.windPose(true);
      b.tele = fx(b).chargeGlow(b, 0xb884ff, A.windup, b.mouthY, 1.6);
      b.spots = [];
      const alive = C(b).enemies.filter((e) => e.alive && e.summonedBy === b).length;
      const n = Math.max(0, Math.min(A.count, (A.cap || 4) - alive));
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / Math.max(1, n) + fxRand(-0.3, 0.3);
        b.spots.push(b.scene.room.clampToRoom(b.x + Math.cos(a) * 60, b.y + Math.sin(a) * 40));
      }
      audio.sfx('summon');
    },
    update(b, dt, A) {
      b.stop(); if ((b.t -= dt) > 0) return false;
      b.clearTele(); b.windPose(false);
      b.spots.forEach((s, i) => b.scene.room.spawnEnemy(A.enemy, s.x, s.y, { delay: i * 110, summoner: b }));
      return true;
    }
  },

  /** Дождь: круги-метки (часть — под игроком), затем удар и опасная зона. */
  rain: {
    start(b, A) {
      b.t = A.windup; b.windPose(true); b.k = 0; b.drops = [];
      b.tele = fx(b).chargeGlow(b, hex(A.color || '#ff8a3a'), A.windup, b.mouthY, 1.2);
      audio.sfx('telegraph', { pitch: 0.9 });
    },
    update(b, dt, A) {
      b.stop(); if ((b.t -= dt) > 0) return false;
      if (b.k === 0) { b.clearTele(); b.windPose(false); }
      const r = b.scene.room; const p = b.target;
      const onP = b.k < (A.onPlayer || 0);
      const x = onP ? p.x + p.body.velocity.x * 0.3 + fxRand(-10, 10) : r.ox + fxRand(40, ROOM_PX_W - 40);
      const y = onP ? p.y + p.body.velocity.y * 0.3 + fxRand(-8, 8) : r.oy + fxRand(50, ROOM_PX_H - 30);
      const col = hex(A.color || '#ff8a3a');
      const tele = fx(b).circleTelegraph(x, y, A.radius, A.delay, col);
      b.scene.time.delayedCall(A.delay * 1000, () => {
        tele.destroy();
        if (!b.scene || b.scene.ended) return;
        fx(b).glowBurst(x, y, col, 12); fx(b).ring(x, y, A.radius, col, 220); audio.sfx('explode', { gap: 60 });
        if (dist(x, y, p.x, p.y) < A.radius + 3) C(b).hurtPlayer(dmg(b, 0.75), null, {});
        if (A.hazard) C(b).addHazard(x, y, A.radius * 0.8, A.hazard, 3.5);
      });
      b.k++; b.t = A.interval;
      return b.k >= A.count + b.phase * 2;
    }
  },

  /** Лучи: тонкий прицел (телеграф), затем толстый луч; rotate — вращение. */
  beam: {
    start(b, A) {
      b.t = A.windup; b.sub = 'wind'; b.windPose(true);
      const base = A.aim ? b.angleToPlayer() : fxRand(0, Math.PI * 2);
      b.beams = Array.from({ length: A.count }, (_, i) => base + (Math.PI * 2 * i) / A.count);
      b.gfx = b.scene.add.graphics().setDepth(DEPTH.FX + 4).setBlendMode(Phaser.BlendModes.ADD);
      audio.sfx('charge');
    },
    update(b, dt, A) {
      b.stop(); b.t -= dt;
      const g = b.gfx; g.clear();
      const ox = b.x; const oy = b.y + b.mouthY; const L = 520;
      if (b.sub === 'wind') {
        if (A.aim && b.t > A.windup * 0.35) b.beams = b.beams.map((a, i) => b.angleToPlayer() + (Math.PI * 2 * i) / A.count);
        const flick = Math.floor(b.t * 20) % 2 ? 0.9 : 0.5;
        for (const a of b.beams) { g.lineStyle(1, b.color, flick); g.lineBetween(ox, oy, ox + Math.cos(a) * L, oy + Math.sin(a) * L); }
        if (b.t <= 0) { b.sub = 'fire'; b.t = A.duration; audio.sfx('beam'); b.shake(A.duration * 1000, 0.003); }
        return false;
      }
      if (A.rotate) b.beams = b.beams.map((a) => a + A.rotate * (b.phase ? 1.15 : 1) * dt);
      const p = b.target;
      for (const a of b.beams) {
        const x1 = ox + Math.cos(a) * L; const y1 = oy + Math.sin(a) * L;
        g.lineStyle(A.width, b.color, 0.55); g.lineBetween(ox, oy, x1, y1);
        g.lineStyle(Math.max(2, A.width * 0.4), 0xffffff, 0.9); g.lineBetween(ox, oy, x1, y1);
        if (p.alive && distToSeg(p.x, p.y - 4, ox, oy, x1, y1) < A.width / 2 + 3) C(b).hurtPlayer(dmg(b, 0.7), null, {});
      }
      if (Math.random() < 0.5) fx(b).glowBurst(ox, oy, b.color, 2);
      if (b.t <= 0) { g.destroy(); b.gfx = null; b.windPose(false); return true; }
      return false;
    }
  },

  /** Исчезновение и появление в другом месте, затем атака then. */
  teleport: {
    start(b, A) {
      b.sub = 'fade'; b.t = A.fade; b.untouchable = true; b.body.enable = false;
      b.scene.tweens.add({ targets: b, alpha: 0.05, duration: A.fade * 1000 });
      fx(b).glowBurst(b.x, b.y - 10, b.color, 20); audio.sfx('teleport');
      const p = b.target; const r = b.scene.room;
      if (A.near) b.dest = r.findSpotNear(p.x, p.y, 34, 46, true);
      else {
        let best = null;
        for (let i = 0; i < 10; i++) {
          const c = r.clampToRoom(r.ox + fxRand(70, ROOM_PX_W - 70), r.oy + fxRand(70, ROOM_PX_H - 50));
          if (dist(c.x, c.y, p.x, p.y) > 100) { best = c; break; }
        }
        b.dest = best || r.clampToRoom(r.cx, r.oy + 80);
      }
      b.mark = fx(b).spawnMark(b.dest.x, b.dest.y, A.fade + A.appear, b.color);
    },
    update(b, dt, A) {
      b.stop(); b.t -= dt;
      if (b.sub === 'fade' && b.t <= 0) {
        b.setPosition(b.dest.x, b.dest.y); b.sub = 'appear'; b.t = A.appear;
        b.scene.tweens.add({ targets: b, alpha: 1, duration: A.appear * 900 });
        return false;
      }
      if (b.sub === 'appear' && b.t <= 0) {
        b.mark?.destroy(); b.mark = null; b.untouchable = false; b.body.enable = true;
        fx(b).ring(b.x, b.y - 6, 30, b.color, 300);
        if (A.then) { b.chain(A.then); return false; }
        return true;
      }
      return false;
    }
  },

  /** Линии шипов от босса к игроку, по одной точке за раз. */
  spikes: {
    start(b, A) {
      b.t = A.windup; b.k = 0; b.windPose(true);
      const base = b.angleToPlayer();
      const lines = A.lines || 1;
      b.lineAngles = Array.from({ length: lines }, (_, i) => base + (i - (lines - 1) / 2) * 0.4);
      audio.sfx('telegraph', { pitch: 0.7 });
    },
    update(b, dt, A) {
      b.stop(); if ((b.t -= dt) > 0) return false;
      if (b.k === 0) b.windPose(false);
      const col = hex(A.color || '#ffffff'); const p = b.target;
      for (const a of b.lineAngles) {
        const d = 22 + b.k * A.step;
        const x = b.x + Math.cos(a) * d; const y = b.y + Math.sin(a) * d;
        const tele = fx(b).circleTelegraph(x, y, A.radius, 0.4, col);
        b.scene.time.delayedCall(400, () => {
          tele.destroy();
          if (!b.scene || b.scene.ended) return;
          fx(b).burst(x, y - 4, col, 8); fx(b).ring(x, y, A.radius, col, 160);
          if (dist(x, y, p.x, p.y) < A.radius + 3) C(b).hurtPlayer(dmg(b, 0.7), null, {});
          if (A.hazard && b.k % 2 === 0) C(b).addHazard(x, y, A.radius, A.hazard, 2.5);
        });
      }
      audio.sfx('hit', { gap: 40, pitch: 0.6 });
      b.k++; b.t = 0.07;
      return b.k >= A.count;
    }
  },

  /** Серия рывков; landRing — кольцо осколков после каждого приземления. */
  dashChain: {
    start(b, A) { b.k = 0; b.sub = 'wind'; b.t = A.windup; b.chargeA = b.angleToPlayer(); b.tele = fx(b).lineTelegraph(b, b.chargeA, A.speed * A.time + 16, 14); audio.sfx('telegraph'); },
    update(b, dt, A) {
      b.t -= dt;
      if (b.sub === 'wind') {
        b.stop();
        if (b.t > A.windup * 0.3) { b.chargeA = b.angleToPlayer(); b.tele?.setAngle(b.chargeA); }
        if (b.t <= 0) { b.clearTele(); b.sub = 'go'; b.t = A.time; b.dashing = true; b.face(Math.cos(b.chargeA)); audio.sfx(b.def.sfx || 'bite'); }
        return false;
      }
      b.body.setVelocity(Math.cos(b.chargeA) * A.speed * b.speedMult, Math.sin(b.chargeA) * A.speed * b.speedMult);
      if (Math.random() < 0.6) fx(b).dust(b.x, b.y, 1);
      if (b.t <= 0) {
        b.stop(); b.dashing = false;
        if (A.landRing) { for (let i = 0; i < A.landRing; i++) C(b).fireEnemy(b.x, b.y - 6, (Math.PI * 2 * i) / A.landRing, 100, dmg(b, 0.5), b.projFrame); fx(b).dust(b.x, b.y, 6); audio.sfx('slam'); }
        b.k++;
        if (b.k >= A.count + b.phase) return true;
        b.sub = 'wind'; b.t = A.windup * 0.8; b.chargeA = b.angleToPlayer();
        b.tele = fx(b).lineTelegraph(b, b.chargeA, A.speed * A.time + 16, 14);
      }
      return false;
    }
  },

  /** Волна вокруг босса + опасная зона кольцом. */
  nova: {
    start(b, A) { b.t = A.windup; b.windPose(true); b.tele = fx(b).circleTelegraph(b.x, b.y - 4, A.radius, A.windup, 0xff6a2a); audio.sfx('telegraph', { pitch: 0.4 }); },
    update(b, dt, A) {
      b.stop(); if ((b.t -= dt) > 0) return false;
      b.clearTele(); b.windPose(false);
      C(b).enemyShockwave(b, A.radius, dmg(b));
      if (A.hazard) for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 * i) / 8; C(b).addHazard(b.x + Math.cos(a) * A.radius * 0.7, b.y + Math.sin(a) * A.radius * 0.55, 18, A.hazard, 5); }
      audio.sfx('explode'); b.shake(250, 0.01);
      return true;
    }
  },

  /** Притяжение к боссу (вихрь из частиц), затем атака then. */
  pull: {
    start(b, A) { b.t = A.duration; b.windPose(true); audio.sfx('charge'); b.swirlT = 0; },
    update(b, dt, A) {
      b.stop(); b.t -= dt;
      const p = b.target;
      const a = angleTo(p.x, p.y, b.x, b.y);
      p.pull.set(Math.cos(a) * A.force, Math.sin(a) * A.force);
      if ((b.swirlT -= dt) <= 0) {
        b.swirlT = 0.05;
        const ang = fxRand(0, Math.PI * 2); const r = fxRand(80, 160);
        const s = b.scene.add.image(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r, 'dot').setTint(b.color).setDepth(DEPTH.FX).setBlendMode(Phaser.BlendModes.ADD);
        b.scene.tweens.add({ targets: s, x: b.x, y: b.y + b.mouthY, alpha: 0, duration: 500, onComplete: () => s.destroy() });
      }
      if (b.t <= 0) { b.windPose(false); if (A.then) { b.chain(A.then); return false; } return true; }
      return false;
    }
  }
};
