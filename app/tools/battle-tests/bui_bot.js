// «Бот-игрок»: проходит ход героя через настоящий интерфейс (клики по DOM).
const L = require('./bui_lib.js'), F = require('./bui_flow.js');

async function ui(p, fn, a) { return p.evaluate(fn, a); }
async function pickTarget(p, prefer) {
  const tg = await p.evaluate(() => { const ids = [...(Battle.UI.targetIds || [])]; return ids.map(id => { const u = Battle.byId(id); return { id, x: u.x, y: u.y, hp: u.hp, side: u.side }; }); });
  if (!tg.length) return false;
  const t = prefer === 'weak' ? tg.sort((a, b) => a.hp - b.hp)[0] : tg[0];
  await L.tapCell(p, t.x, t.y); return true;
}
async function afterAction(p, o) {
  // ждём: лист броска / модал / возврат к меню
  for (let i = 0; i < 80; i++) {
    const sheet = await p.$('.bd-ov'); if (sheet) { await F.playSheet(p, o); continue; }
    const md = await F.handleModal(p, o.prefer || 'yes'); if (md) { await L.sleep(250); continue; }
    const st = await p.evaluate(() => ({ busy: Battle.UI.busy, pick: !!Battle.UI.pick, mode: Battle.UI.mode }));
    if (st.mode !== 'hero') return;
    if (!st.busy && !st.pick) return;
    if (st.pick) return;
    await L.sleep(150);
  }
}
// Один ход героя. Возвращает описание.
async function botTurn(p, o = {}) {
  const log = [];
  for (let step = 0; step < 10; step++) {
    if ((await L.mode(p)) !== 'hero') return log;
    const st = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { n: u.name, t: u.t, opts: Battle.actionsFor(u).map(a => ({ id: a.id, cat: a.cat, en: a.enabled, label: a.label, time: a.time })) }; });
    const atk = st.opts.filter(a => a.cat === 'attack' && a.en);
    if (st.t.action > 0 && atk.length && !o.noAttack) {
      await F.dockClick(p, 'attack'); await L.sleep(120);
      const idx = Math.min(atk.length - 1, o.attackIdx || 0);
      const els = await p.$$('.bt-opt:not(.off)'); if (!els.length) { await F.dockClick(p, 'attack'); break; }
      await els[Math.min(idx, els.length - 1)].click(); await L.sleep(250);
      const has = await p.evaluate(() => !!Battle.UI.pick);
      if (has) { const ok = await pickTarget(p, 'weak'); if (ok) { log.push('атака'); await L.sleep(500); await afterAction(p, { mode: o.mode, prefer: 'yes' }); await L.sleep(300); continue; } else { await p.click('[data-ba="pick-cancel"]'); } }
      else { await afterAction(p, { mode: o.mode }); log.push('атака?'); }
      // нет целей — идём к врагу
    }
    if (st.t.move > 0 && !o.noMove) {
      const spot = await p.evaluate(() => { const u = Battle.UI.turnUnit, mons = Battle.mons().filter(m => m.alive); if (!mons.length) return null; const cur = Math.min(...mons.map(m => Battle.distCell ? Math.max(Math.abs(m.x - u.x), Math.abs(m.y - u.y)) : 0)); return { cur }; });
      await F.dockClick(p, 'move'); await L.sleep(250);
      const best = await p.evaluate(() => { const u = Battle.UI.turnUnit, mons = Battle.mons().filter(m => m.alive); let best = null; for (const [k, cls] of Battle.UI.hl) { if (!cls.includes('hl-move') && !cls.includes('hl-danger')) continue; const [x, y] = k.split(',').map(Number); const dd = Math.min(...mons.map(m => Math.max(Math.abs(m.x - x), Math.abs(m.y - y)))); if (dd >= 1 && (!best || dd < best.dd)) best = { x, y, dd }; } return best; });
      if (best && spot && best.dd < spot.cur) { await L.tapCell(p, best.x, best.y); await L.sleep(150); await p.click('[data-ba="pick-ok"]'); log.push('шаг'); await L.sleep(600); await afterAction(p, { prefer: 'yes' }); }
      else { const c = await p.$('[data-ba="pick-cancel"]'); if (c) await c.click(); await L.sleep(150); o.noMove = true; }
      if (st.t.action <= 0) { }
      continue;
    }
    break;
  }
  if ((await L.mode(p)) === 'hero') { await F.dockClick(p, 'end'); log.push('конец'); }
  return log;
}
module.exports = { botTurn, afterAction, pickTarget };
