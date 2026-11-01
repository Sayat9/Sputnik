// Призванные врагами крысы (крысолов) и мимик дают обычные награды: камни и броски на эссенцию
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const R = [], ok = (n, c, x) => { R.push(!!c); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + JSON.stringify(x)); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = { runs: [] };
    const mk = (i, main) => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 2 }); c.base = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: main } }; delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 2, pos: { x: 5, y: 5 }, status: {}, light: false };
    for (let i = 0; i < 6; i++) {
      state.party = [mk(0, 'greatsword'), mk(1, 'greatsword'), mk(2, 'longbow'), mk(3, 'spear')]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      const ev = { list: ['rat-catcher'], zone: 'goblin', floor: 2, kind: 'hard', title: 't' };
      const r = await B.sim(ev); const S = r.S;
      const deadRats = S.units.filter(u => u.kind === 'rat' && u.side === 'mon' && !u.alive).length;
      const plan = B.End.plan(S, r.outcome);
      out.runs.push({ outcome: r.outcome, deadRats, list: ev.list.length, ratsInPlan: plan.species.filter(x => x === 'rat').length, rolls: plan.rolls.length, stones: JSON.stringify(plan.stones) });
      B.S = null;
    }
    // повторная регистрация не дублирует
    state.party = [mk(0, 'greatsword')]; const S = B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); B.placeMonsters(S);
    const m = B.mons()[0]; const w = B.monUnit('rat', -1); Object.assign(w, { summon: true, side: 'mon', idx: null }); w.x = 0; w.y = 0; B.addUnit(w, m.id);
    B.regKill(w, null); B.regKill(w, null); out.dup = S.killed.length; out.lst = S.ev.list.slice();
    // призванный волк героя наград не даёт
    const h = B.heroes()[0], wolf = B.monUnit('wolf', -1); Object.assign(wolf, { summon: true, side: 'hero', owner: h.id, idx: null }); out.heroSum = B.regKill(wolf, null); B.S = null;
    return out;
  });
  console.log(JSON.stringify(o.runs));
  const withRats = o.runs.filter(r => r.deadRats > 0);
  ok('есть бои, где убиты призванные крысы', withRats.length > 0, o.runs);
  ok('убитые призванные крысы попадают в награды (вид, бросок на эссенцию)', withRats.every(r => r.ratsInPlan === r.deadRats && r.rolls >= r.deadRats), withRats);
  ok('повторная запись убийства не дублирует', o.dup === 1 && o.lst.join() === 'goblin,rat', o);
  ok('призванные героя наград не дают', o.heroSum === false, o.heroSum);
  ok('нет ошибок страницы', !errs.length, errs);
  console.log(`проверок: ${R.length} не прошли: ${R.filter(x => !x).length}`); await b.close();
})();
