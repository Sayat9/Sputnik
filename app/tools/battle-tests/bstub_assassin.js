// 09.11: «Уход в тень» (ассасин) можно применить стоя на месте — даже когда двигаться некуда; «Упрямая плоть» (зомби) — перезарядка 2 хода.
const L = require('./bui_lib.js'); const F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true }); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer'] });
  await p.evaluate(() => { state.party.forEach(c => { c.essences = ['goblin-assassin', 'zombie']; c.level = 2; }); });
  await L.startFightPage(p, { list: ['goblin', 'goblin'] });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  const A = await p.evaluate(() => { const B = Battle, u = B.byId(B.S.order[B.S.turn]), Aa = B.A['goblin-assassin'];
    const free = Aa.tgt(u).type; addStatus = B.addStatus; B.addStatus(u, 'slowed', { k: Infinity, data: { mult: 0 } });
    const spd = B.speedOf ? B.speedOf(u) : null; const t2 = Aa.tgt(u);
    return { can: Aa.can(u), free, stuck: t2.type, spd }; });
  ok('навык доступен', A.can === true, A);
  ok('обычно — выбор клетки', A.free === 'cell', A);
  ok('двигаться некуда — применяется на месте', A.stuck === 'self', A);
  const used = await p.evaluate(async () => { const B = Battle, u = B.byId(B.S.order[B.S.turn]); const r = await B.useActive(u, 'goblin-assassin', {}); return { r, cd: u.cd['goblin-assassin'], log: B.S.log.slice(-2).map(x => x.t || x) }; });
  ok('без перемещения навык срабатывает (мана, перезарядка)', used.r === true && used.cd > 0, used);
  const Z = await p.evaluate(async () => { const B = Battle, u = B.mons()[0], P = B.P.zombie; u.t = u.t || {}; B.cfg.fast = true;
    const call = () => P.beforeZero(u, { o: { taken: -100 }, left: -100 });          // Сл ≤ 0 — спасбросок всегда успешен
    const a = await call(); const b2 = await call(); u.turnsTaken = (u.turnsTaken || 0) + 1; const c = await call(); u.turnsTaken += 1; const d = await call();
    return { a, b2, c, d }; });
  ok('упрямая плоть срабатывает', Z.a === true, Z);
  ok('сразу же второй раз — нет (перезарядка)', Z.b2 === false && Z.c === false, Z);
  ok('через 2 хода — снова работает', Z.d === true, Z);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
