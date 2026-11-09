// 09.11: места и условия появления открываются по местам встреч (библиотека — всё, кроме разломов); монстры разломов скрыты в библиотеке;
// мана восстанавливается в городе; полоска ОЗ над фишкой окрашена; на арене нет редких монстров и монстров особых мест.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true }); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer'], tactical: false });
  const A = await p.evaluate(() => {
    state.journal = null; unlockJournal(8); unlockJournal(9);
    const bear = MONSTERS.find(m => m.id === 'dark-bear'), sec = id => monSections(MONSTERS.find(m => m.id === id)).find(x => x.k === 'spawn' || x.k === 'area');
    const saved = state.run;
    state.run = { ...(saved || {}), floor: 1, variant: null, rift: null }; seenPlaces('dark-bear');
    const s1 = monSections(bear).find(x => x.k === 'spawn'), a1 = monSections(bear).find(x => x.k === 'area');
    state.run = { ...(saved || {}), floor: 2, variant: 'beast', rift: null }; seenPlaces('dark-bear');
    const s2 = monSections(bear).find(x => x.k === 'spawn');
    state.run = saved;
    seenKeys('hobgoblin', ['spawn']); const h = monSections(MONSTERS.find(m => m.id === 'hobgoblin')).find(x => x.k === 'spawn');
    const rift = MONSTERS.find(m => m.rift && !m.draft), libHasRift = libMonsters().some(m => m.rift);
    seenKeys(rift.id, ['area']); const ra = monSections(rift).find(x => x.k === 'area');
    return { s1p: s1.partial, s1: s1.html, a1: a1.html, s2: s2.html, h: h.html, libHasRift, raPartial: ra.partial, ra: ra.html };
  });
  ok('встреча на 1 этаже: условие только 1 этажа', A.s1p && /1 этаж/.test(A.s1) && !/2 этаж/.test(A.s1), A);
  ok('встреча на 2 этаже дописывает место', /1 этаж/.test(A.s2) && /2 этаж, Волчья чаща/.test(A.s2), A);
  ok('библиотека открывает все этажи', /1 этаж/.test(A.h) && /2 этаж/.test(A.h), A.h);
  ok('монстры разломов не видны в библиотеке до встречи', !A.libHasRift, A);
  ok('разлом — секрет: библиотека его место не раскрывает', !A.raPartial && !/Разлом/.test(A.ra), A);
  const M = await p.evaluate(() => { const c = state.party[0]; state.run = state.run || { floor: 1, status: {} }; c.mp = 0; endRun(true); return { mp: c.mp, max: maxMp(c) }; });
  ok('в городе мана полная', M.mp === M.max && M.max > 0, M);
  await p.evaluate(() => { state.party.forEach(c => { c.rank = 8; }); location.hash = 'town'; rerender(); });
  await p.waitForTimeout(300); await p.click('[data-bld="arena"]'); await p.waitForFunction(() => window.Town && Town._B, null, { timeout: 8000 }); const ar = [];
  for (let k = 0; k < 25; k++) { await p.evaluate(() => { state.arena = null; Town._B.arena.render(); }); ar.push(...await p.evaluate(() => state.arena.bouts.flatMap(b => [b.a, b.b]))); }
  const bad2 = await p.evaluate(ids => ids.map(id => MONSTERS.find(m => m.id === id)).filter(m => m && (m.rare || (m.areas || []).some(a => /Туманная часовня/.test(a)))).map(m => m.id), ar);
  ok('на арене нет редких и монстров часовни', !bad2.length, { ar, bad2 });
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
