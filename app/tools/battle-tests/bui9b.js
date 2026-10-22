// Все 35 навыков эссенций 2 этажа через настоящий интерфейс: выбор целей и клеток, листы броска, расход маны и времени.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
const only = process.argv[2] ? process.argv[2].split(',') : null;

async function driveSkill(p, log) {
  for (let i = 0; i < 120; i++) {
    const sheet = await p.$('.bd-ov:not(.out)'); if (sheet) { const t = await F.playSheet(p, { mode: i % 2 ? 'drag' : 'button' }); log.push('лист:' + t.length); continue; }
    const md = await F.handleModal(p, 'yes'); if (md) { log.push('модал:' + md.slice(0, 40)); await L.sleep(250); continue; }
    const st = await p.evaluate(() => ({ busy: Battle.UI.busy, pick: Battle.UI.pick ? { type: Battle.UI.pick.type, prompt: Battle.UI.pick.prompt, canOk: Battle.UI.pick.canOk } : null, mode: Battle.UI.mode,
      ids: [...(Battle.UI.targetIds || [])].map(id => { const u = Battle.byId(id); return u ? { id, x: u.x, y: u.y } : null; }).filter(Boolean), hl: [...Battle.UI.hl.entries()] }));
    if (st.mode !== 'hero') return 'mode:' + st.mode;
    if (st.pick) {
      log.push('pick:' + st.pick.type);
      const t = st.pick.type;
      if (t === 'unit') { const x = st.ids[0]; await L.tapCell(p, x.x, x.y); }
      else if (t === 'units') { for (const x of st.ids.slice(0, 2)) { await L.tapCell(p, x.x, x.y); await L.sleep(80); } await p.click('[data-ba="pick-ok"]'); }
      else if (t === 'cell' || t === 'move') {
        const c = st.hl.find(([k, c]) => /hl-(move|flee|ally|danger)/.test(c.join(' '))); if (!c) { log.push('нет клеток'); await p.click('[data-ba="pick-cancel"]'); }
        else { const [x, y] = c[0].split(',').map(Number); await L.tapCell(p, x, y); await L.sleep(120); const ok = await p.$('[data-ba="pick-ok"]:not([disabled])'); if (ok) await ok.click(); }
      }
      else if (t === 'area') { await p.click('[data-ba="pick-ok"]'); }
      else if (t === 'cube') { const c = st.hl.find(([k, c]) => /hl-reach/.test(c.join(' '))); const [x, y] = c[0].split(',').map(Number); await L.tapCell(p, x, y); await L.sleep(100); await p.click('[data-ba="pick-ok"]'); }
      else { log.push('неизвестный pick ' + t); await p.click('[data-ba="pick-cancel"]'); }
      await L.sleep(350); continue;
    }
    if (!st.busy) return 'готово';
    await L.sleep(150);
  }
  return 'застряло';
}

const ADJ = ['hobgoblin-brute', 'goblin-thief', 'dire-wolf', 'swamp-fang', 'dust-crawler', 'gravedigger', 'corpse-eater', 'giant-mole', 'plague-fat', 'crow', 'ash-spirit', 'mirror-dead', 'faceless-ringer', 'grey-shade', 'burrower', 'werewolf', 'ash-wraith', 'goblin-king', 'goblin-bomber', 'goblin-shaman', 'morok', 'goblin-assassin', 'hobgoblin-driver'];
const GEAR = { 'hobgoblin-brute': { main: 'mace' }, 'horned-hare': { main: 'spear' }, blackwing: { main: 'spear' }, 'goblin-assassin': { main: 'rapier' }, 'hobgoblin-thrower': { main: 'sword', bag: ['spear', 'spear'] }, 'bone-knight': { main: 'sword' } };
const NOTIME = ['hobgoblin-shield'];

(async () => {
  const ids = ['goblin-shaman', 'goblin-assassin', 'goblin-trapper', 'goblin-elder', 'hobgoblin-brute', 'hobgoblin-thrower', 'hobgoblin-driver', 'hobgoblin-shield', 'goblin-king', 'goblin-bomber', 'goblin-thief',
    'horned-hare', 'swamp-toad', 'burrower', 'crow', 'dire-wolf', 'web-spider', 'werewolf', 'giant-mole', 'swamp-fang', 'spider-queen', 'blackwing',
    'grey-shade', 'morok', 'whisperer', 'mirror-dead', 'faceless-ringer', 'dust-crawler', 'bone-hound', 'gravedigger', 'plague-fat', 'ash-spirit', 'bone-knight', 'corpse-eater', 'ash-wraith'];
  const report = [];
  for (const id of ids) {
    if (only && !only.includes(id)) continue;
    const { b, p } = await L.launch(400, 860);
    const rec = { id, log: [] };
    try {
      await L.setup(p, { heroes: ['barb2', 'dwarf'] });
      await p.evaluate(({ id, g }) => {
        const c = state.party[1]; c.name = 'Тест'; c.essences = [id]; c.equip = { main: { t: 'w', id: (g && g.main) || 'sword' } }; delete c.bag; delete c.kit; ensureKit(c);
        for (const w of (g && g.bag) || []) addToBag(c, { t: 'w', id: w });
        c.mp = maxMp(c); saveChar();
      }, { id, g: GEAR[id] });
      await L.startFightPage(p, { list: ['goblin', 'goblin'], zone: 'goblin' });
      await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]');
      for (let tries = 0; tries < 12; tries++) {
        const ok = await F.waitHero(p, { tries: 120 }); if (!ok) break;
        const name = await p.evaluate(() => Battle.UI.turnUnit.name);
        if (name === 'Тест') break;
        await F.dockClick(p, 'end'); await L.sleep(300);
      }
      await p.evaluate(({ adj, id }) => {
        const B = Battle, S = B.S, hs = B.heroes(), ms = B.mons();
        for (const row of S.cells) row.fill('');
        S.objs.length = 0;
        const t = hs.find(h => h.name === 'Тест'), g = hs.find(h => h.name === 'Грок');
        const place = (u, x, y) => { u.x = x; u.y = y; };
        if (adj) { place(t, 3, 4); place(g, 4, 5); place(ms[0], 3, 3); place(ms[1], 2, 3); }
        else { place(t, 3, 5); place(g, 5, 6); place(ms[0], 3, 2); place(ms[1], 5, 2); }
        ms.forEach(m => { m.maxHp = m.hp = 300; });
        if (id === 'goblin-shaman') { g.hp = g.hero.hp = Math.max(1, g.maxHp - 6); }
        if (id === 'hobgoblin-driver') { place(g, 2, 5); }
        B.UI.refreshNow();
      }, { adj: ADJ.includes(id), id });
      const info = await p.evaluate(() => { const u = Battle.UI.turnUnit; if (!u) return { n: null }; const o = Battle.actionsFor(u).find(o => o.cat === 'skill' && /^skill:/.test(o.id)); return { n: u.name, mp0: u.mp, opt: o ? { id: o.id, label: o.label, en: o.enabled, why: o.why, sub: o.sub, time: o.time } : null }; });
      rec.info = info;
      if (!info.opt) rec.log.push('нет навыка в меню');
      else if (!info.opt.en) rec.log.push('навык недоступен: ' + info.opt.why);
      else {
        await F.dockClick(p, 'skill'); await L.sleep(200);
        const el = await p.$('.bt-opt:not(.off)'); await el.click(); await L.sleep(350);
        rec.result = await driveSkill(p, rec.log);
        rec.after = await p.evaluate(id => { const u = Battle.UI.turnUnit; return u ? { mp: u.mp, t: u.t, cd: u.cd[id], hp: Battle.mons().map(m => m.hp + '/' + m.maxHp), log: Battle.S.log.slice(-6).map(l => l.t) } : null; }, id);
      }
      rec.errs = p.errs.slice();
    } catch (e) { rec.fail = String(e.message || e).slice(0, 200); rec.errs = p.errs.slice(); }
    const mana = (ESS => 0)();
    report.push(rec); await b.close();
  }
  // итог
  const meta = (await (async () => { const { b, p } = await L.launch(400, 860); await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(400); const r = await p.evaluate(() => Object.fromEntries(Object.keys(ESSENCES).map(id => [id, ESSENCES[id].active.mana]))); await b.close(); return r; })());
  let bad = 0;
  for (const r of report) {
    const o = r.info && r.info.opt, a = r.after, mana = meta[r.id];
    const spentMp = a && r.info ? r.info.mp0 - a.mp : null;
    const timeOK = a && o ? (o.time === 'action' ? a.t.action === 0 || r.id === 'blackwing' : o.time === 'bonus' ? a.t.bonus === 0 : true) : null;
    const problems = [];
    if (NOTIME.includes(r.id)) { if (o && o.en) problems.push('реакция не должна быть доступна из меню'); }
    else {
      if (!o) problems.push('нет навыка'); else if (!o.en) problems.push('недоступен: ' + o.why);
      else {
        if (r.result !== 'готово') problems.push('исход: ' + r.result);
        if (spentMp !== mana) problems.push(`мана ${spentMp} вместо ${mana}`);
        if (!timeOK) problems.push('время не потрачено ' + JSON.stringify(a && a.t));
      }
    }
    if (r.fail) problems.push('сбой: ' + r.fail);
    if (r.errs && r.errs.length) problems.push('ошибки страницы: ' + r.errs.slice(0, 2).join(' | '));
    if (problems.length) { bad++; console.log('✗', r.id, '—', problems.join('; '), '\n    лог:', (r.log || []).join(' / '), '\n    журнал:', a && a.log ? a.log.join(' | ') : ''); }
    else console.log('✓', r.id, `мана −${spentMp}`, (r.log || []).filter(x => /pick|модал/.test(x)).join(','));
  }
  console.log(`итого: ${report.length}, проблем: ${bad}`);
})();
