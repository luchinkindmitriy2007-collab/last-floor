import { GD } from './GameData.js';
import { audio } from './AudioSystem.js';
import { RARITY } from './Constants.js';

/**
 * Случайные события. Сценарии описаны в events.json набором операций
 * (ops), поэтому новые события добавляются без изменения кода.
 */
export class EventSystem {
  constructor(scene) { this.scene = scene; }

  open(room, it) {
    const s = this.scene;
    const ev = GD.events[room.eventId];
    if (room.eventUses === undefined) room.eventUses = ev.uses || 1;
    if (ev.veiled && !room.veiled) {
      const rng = s.rng.fork(`veil${room.id}`);
      const exclude = [...s.run.items];
      const picks = [0, 1, 2].map(() => { const item = s.items.roll(rng, { minRarity: 'uncommon', maxRarity: 'epic', luck: s.player.stats.luck, exclude }); exclude.push(item.id); return item; });
      const cursedIdx = rng.int(0, 2);
      room.veiled = picks.map((item, i) => ({ item, cursed: i === cursedIdx, curse: rng.pick(GD.curses) }));
    }
    const choices = ev.choices.map((c, i) => {
      let label = c.label; let enabled = true; let color;
      if (c.req?.gold && s.run.gold < c.req.gold) { enabled = false; label += ' (мало золота)'; }
      if (c.req?.potions && s.run.potions < c.req.potions) { enabled = false; label += ' (нет зелий)'; }
      const v = c.ops.find((o) => o.op === 'veiled');
      if (v && room.veiled) { const r = RARITY[room.veiled[v.index].item.rarity]; label = `${c.label}: ${r.name.toLowerCase()} предмет`; color = r.color; }
      return { label, enabled, color, index: i };
    });
    s.ui.choice({ title: ev.title, text: ev.text, choices, sprite: ev.sprite }, (idx) => this.apply(room, it, ev, ev.choices[idx]));
  }

  apply(room, it, ev, choice) {
    if (!choice) return;
    this.runOps(choice.ops, { room, it });
    if (choice.spend) {
      room.eventUses--;
      if (room.eventUses <= 0) {
        it.disable();
        if (ev.sprite.startsWith('altar_')) it.sprite.setTexture('altar_spent');
        if (ev.sprite === 'note' || ev.sprite === 'chest_cursed') it.destroy();
      }
    }
    this.scene.player.refreshStats();
    this.scene.saveMeta();
  }

  runOps(ops, ctx) {
    const s = this.scene; const run = s.run; const p = s.player;
    for (const o of ops) {
      switch (o.op) {
        case 'maxHpPct': run.bonusStats.maxHpPct = (run.bonusStats.maxHpPct || 0) + o.v; p.refreshStats(); break;
        case 'stat': run.bonusStats[o.stat] = (run.bonusStats[o.stat] || 0) + o.v; p.refreshStats(); break;
        case 'gold': run.gold = Math.max(0, run.gold + o.v); if (o.v > 0) { audio.sfx('coin'); s.ui.toast(`+${o.v} золота`, '#ffd24a'); } break;
        case 'heal': s.combat.healPlayer(Math.round(p.stats.maxHp * o.pct)); audio.sfx('heal'); break;
        case 'potion': run.potions = Math.max(0, run.potions + o.v); break;
        case 'shards': run.shardsBonus += o.v; break;
        case 'xp': s.gainXp(o.v); break;
        case 'toast': s.ui.toast(o.text, o.color); break;
        case 'item': {
          const item = s.items.roll(s.rng.fork(`evitem${ctx.room.id}${run.items.length}`), { minRarity: o.rarity, luck: p.stats.luck, exclude: run.items });
          s.grantItem(item, ctx.it.x, ctx.it.y);
          break;
        }
        case 'veiled': {
          const v = ctx.room.veiled[o.index];
          s.grantItem(v.item, ctx.it.x, ctx.it.y);
          if (v.cursed) {
            run.curses.push(v.curse.id);
            p.refreshStats();
            s.time.delayedCall(700, () => { s.ui.banner(v.curse.name.toUpperCase(), '#b066ea'); s.ui.toast(v.curse.desc, '#b066ea'); audio.sfx('defeat'); });
          } else s.time.delayedCall(700, () => s.ui.toast('Свёрток оказался чистым', '#7cff8a'));
          break;
        }
        case 'random': {
          const pick = s.rng.fork(`evr${ctx.room.id}${Date.now() % 1000}`).weighted(o.table);
          this.runOps(pick.ops, ctx);
          break;
        }
        case 'revealMap': s.revealMap(false); s.ui.toast('Карта этажа открыта', '#62d6ff'); break;
        case 'lore': this.revealLore(o.id); break;
        case 'spawn': s.room.ambush(o.enemy, ctx.it.x, ctx.it.y); break;
        default: console.warn('[LastFloor] Неизвестная операция события', o.op);
      }
    }
  }

  revealLore(id) {
    const s = this.scene;
    let loreId = id;
    if (id === 'random') {
      const pool = Object.keys(GD.lore).filter((k) => /^j\d+$/.test(k));
      const unseen = pool.filter((k) => !s.save.meta.lore[k]);
      loreId = (unseen.length ? unseen : pool)[Math.floor(Math.random() * (unseen.length || pool.length))];
    }
    const L = GD.lore[loreId];
    if (!L) return;
    const isNew = !s.save.meta.lore[loreId];
    s.save.meta.lore[loreId] = true;
    if (!s.run.lore.includes(loreId)) s.run.lore.push(loreId);
    audio.sfx('pickup');
    s.ui.lore(L.title, L.text, isNew);
    s.saveMeta();
  }
}
