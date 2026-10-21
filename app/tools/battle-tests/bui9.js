// Все навыки эссенций 1 этажа через настоящий интерфейс: выбор целей, листы броска, итог.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
const only = process.argv[2] ? process.argv[2].split(',') : null;

async function driveSkill(p, log) {
  for (let i = 0; i < 90; i++) {
    const sheet = await p.$('.bd-ov:not(.out)'); if (sheet) { const t = await F.playSheet(p, { mode: i % 2 ? 'drag' : 'button' }); log.push('лист:' + t.length); continue; }
    const md = await F.handleModal(p, 'yes'); if (md) { log.push('модал:' + md.slice(0, 40)); await L.sleep(250); continue; }
    const st = await p.evaluate(() => ({ busy: Battle.UI.busy, pick: Battle.UI.pick ? { type: Battle.UI.pick.type, prompt: Battle.UI.pick.prompt, ok: !!Battle.UI.pick.confirmable, canOk: Battle.UI.pick.canOk } : null, mode: Battle.UI.mode, ids: [...(Battle.UI.targetIds || [])].map(id => { const u = Battle.byId(id); return { x: u.x, y: u.y, side: u.side }; }), hl: [...Battle.UI.hl].map(([k, c]) => [k, c.join(' ')]) }));
    if (st.mode !== 'hero') return 'mode:' + st.mode;
    if (st.pick) {
      log.push('pick:' + st.pick.type);
      const t = st.pick.type;
      if (t === 'unit') { const x = st.ids[0]; await L.tapCell(p, x.x, x.y); }
      else if (t === 'units') { for (const x of st.ids.slice(0, 2)) { await L.tapCell(p, x.x, x.y); await L.sleep(80); } await p.click('[data-ba="pick-ok"]'); }
      else if (t === 'cell') {
        const c = st.hl.find(([k, c]) => /hl-(move|flee|ally)/.test(c)); if (!c) { log.push('нет клеток'); await p.click('[data-ba="pick-cancel"]'); }
        else { const [x, y] = c[0].split(',').map(Number); await L.tapCell(p, x, y); await L.sleep(100); const ok = await p.$('[data-ba="pick-ok"]:not([disabled])'); if (ok) await ok.click(); }
      }
      else if (t === 'area') { await p.click('[data-ba="pick-ok"]'); }
      else if (t === 'cube') { const c = st.hl.find(([k, c]) => /hl-reach/.test(c)); const [x, y] = c[0].split(',').map(Number); await L.tapCell(p, x, y); await L.sleep(100); await p.click('[data-ba="pick-ok"]'); }
      else { log.push('неизвестный pick ' + t); await p.click('[data-ba="pick-cancel"]'); }
      await L.sleep(350); continue;
    }
    if (!st.busy) return 'готово';
    await L.sleep(150);
  }
  return 'застряло';
}

(async () => {
  const ids = await (async () => { const { b, p } = await L.launch(400, 860); await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(400); await L.setup(p, {}); const r = await p.evaluate(() => Object.keys(ESSENCES).filter(id => MONSTERS.some(m => m.essence === id && m.floor === 1))); await b.close(); return r; })();
  console.log('эссенции 1 этажа:', ids.length, ids.join(','));
  const report = [];
  for (const id of ids) {
    if (only && !only.includes(id)) continue;
    const { b, p } = await L.launch(400, 860);
    const rec = { id, log: [] };
    try {
      await p.addInitScript(() => {});
      await L.setup(p, { heroes: ['barb2', 'dwarf'] });
      await p.evaluate(id => { const c = state.party[1]; c.name = 'Тест'; c.essences = [id]; if (/archer/.test(id)) { c.equip.main = { t: 'w', id: 'shortbow' }; delete c.equip.off; addBlock(c); } if (id === 'goblin-sword' || id === 'wolf') c.equip.main = { t: 'w', id: 'sword' }; c.mp = maxMp(c); state.party[0].name = 'Грок'; saveChar(); function addBlock(c) { addToBag(c, { t: 'g', id: 'arrow', qty: 20 }); } }, id);
      const mon = await p.evaluate(id => (MONSTERS.find(m => m.essence === id && m.floor === 1) || {}).id, id);
      const list = [mon || 'goblin', 'goblin'];
      await L.startFightPage(p, { list, zone: 'goblin' });
      await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]');
      let tries = 0;
      for (; tries < 12; tries++) {
        const ok = await F.waitHero(p, { tries: 120 }); if (!ok) break;
        const name = await p.evaluate(() => Battle.UI.turnUnit.name);
        if (name === 'Тест') break;
        await F.dockClick(p, 'end'); await L.sleep(300);
      }
      // расставим всех вплотную
      await p.evaluate(() => {
        const S = Battle.S, hs = Battle.heroes(), ms = Battle.mons();
        const clear = (x, y) => { S.cells[y][x] = ''; };
        const place = (u, x, y) => { clear(x, y); u.x = x; u.y = y; };
        const t = hs.find(h => h.name === 'Тест'), g = hs.find(h => h.name === 'Грок');
        place(t, 3, 4); place(g, 4, 5); place(ms[0], 3, 3); if (ms[1]) place(ms[1], 2, 3);
        for (let y = 2; y < 6; y++) for (let x = 1; x < 6; x++) if (!Battle.occupant(x, y)) { const c = S.cells[y][x]; if (c === 'rock' || c === 'boulder' || c === 'tent' || c === 'crate') S.cells[y][x] = ''; }
        Battle.UI.refreshNow();
      });
      const info = await p.evaluate(() => { const u = Battle.UI.turnUnit; if (!u) return { n: null, mp0: 0, opt: null }; const o = Battle.actionsFor(u).find(o => o.cat === 'skill'); return { n: u.name, mp0: u.mp, opt: o ? { id: o.id, label: o.label, en: o.enabled, why: o.why, sub: o.sub } : null, hasPassive: u.pass.length }; });
      rec.info = info;
      if (!info.opt) { rec.log.push('нет навыка в меню'); }
      else if (!info.opt.en) { rec.log.push('навык недоступен: ' + info.opt.why); }
      else {
        await F.dockClick(p, 'skill'); await L.sleep(200);
        const el = await p.$('.bt-opt:not(.off)'); await el.click(); await L.sleep(350);
        rec.result = await driveSkill(p, rec.log);
        rec.opt = info.opt; rec.after = await p.evaluate(() => { const u = Battle.UI.turnUnit; window.__chk = { t: JSON.stringify(u && u.t), cd: JSON.stringify(u && u.cd) }; return u ? { mp: u.mp, t: u.t, cd: u.cd, hp: Battle.mons().map(m => m.hp + '/' + m.maxHp), log: Battle.S.log.slice(-9).map(l => l.t) } : null; });
      }
      rec.errs = p.errs.slice();
    } catch (e) { rec.fail = String(e.message || e).slice(0, 200); rec.errs = p.errs.slice(); }
    const tm = rec.after && rec.info && rec.info.opt ? await p.evaluate(id => ({ time: Battle.A[id] && Battle.A[id].time }), id).catch(() => ({})) : {}; const spent = rec.after && rec.after.t ? (tm.time === 'action' ? rec.after.t.action === 0 : tm.time === 'bonus' ? rec.after.t.bonus === 0 : true) : null; console.log(spent === false ? '!!НЕ ПОТРАЧЕНО ВРЕМЯ' : '', id.padEnd(18), JSON.stringify(rec.info && rec.info.opt ? rec.info.opt.label : null), '|', rec.result || '', '|', rec.log.join(' '), rec.after ? '| mp ' + rec.info.mp0 + '→' + rec.after.mp + ' hp ' + rec.after.hp.join(',') : '', (process.env.SHOWLOG && rec.after ? '\n   ' + rec.after.log.join('\n   ') : ''), rec.fail ? 'FAIL ' + rec.fail : '', rec.errs && rec.errs.length ? 'ERRS ' + rec.errs.join(' ; ').slice(0, 300) : '');
    report.push(rec); await b.close();
  }
})();
