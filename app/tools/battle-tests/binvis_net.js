// 09.11: бессрочные статусы (k: Infinity) переживают передачу боя по сети и автосохранение: JSON делал из Infinity null,
// и невидимость «Растворения» снималась на первом тике — героя продолжали бить, а значка невидимости не было.
const L = require('./bui_lib.js'); const F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true }); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer'] });
  await p.evaluate(() => { state.party.forEach(c => { c.essences = ['grey-shade']; c.level = 2; }); });
  await L.startFightPage(p, { list: ['goblin', 'goblin', 'goblin'] });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  const A = await p.evaluate(async () => {
    const B = Battle, cur = B.byId(B.S.order[B.S.turn]); await B.useActive(cur, 'grey-shade', {});
    B.restoreInto(B.S, JSON.parse(JSON.stringify(B.ser(B.S))));          // как ход игрока по сети
    const u = B.byId(cur.id); const h = u.conds.find(c => c.id === 'hidden');
    B.tickStatuses(u, 'end'); B.tickStatuses(u, 'start');
    const h2 = u.conds.find(c => c.id === 'hidden');
    return { id: cur.id, hp0: u.hp, k: h && h.k, after: !!(h2 && h2.data.invis) };
  });
  ok('после передачи по сети длительность «пока не снимут»', A.k === Infinity, A);
  ok('тик статусов не снимает невидимость', A.after, A);
  await L.sleep(800);
  ok('фишка показана невидимой', await p.evaluate(id => { const B = Battle, u = B.byId(id); return [...document.querySelectorAll('.bt-token.hidden-st')].some(e => e.textContent.includes(u.name)); }, A.id));
  // ход дальше: второй герой уходит в угол, гоблины ходят; Лею не бьют
  for (let i = 0; i < 6; i++) { await p.evaluate(id => { const B = Battle, c = B.byId(B.S.order[B.S.turn]); if (c && c.side === 'hero' && c.id !== id) { Battle.UI.endTurn && Battle.UI.endTurn(); } }, A.id); await L.sleep(2000); await F.handleModal(p, 'yes').catch(() => {});
    const back = await p.evaluate(id => Battle.S.order[Battle.S.turn] === id, A.id); if (back) break; }
  const R = await p.evaluate(id => { const B = Battle, u = B.byId(id); return { hp: u.hp, max: u.maxHp, hitHer: (B.S.log || []).some(x => /по Лея/.test(x.t || x.text || x)) }; }, A.id);
  ok('невидимого героя не атакуют', !R.hitHer && R.hp === A.hp0, { ...R, hp0: A.hp0 });
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
