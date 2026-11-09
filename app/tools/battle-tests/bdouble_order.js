// 09.11: погибший (рассеянный) двойник героя пропадает из шкалы ходов.
const L = require('./bui_lib.js'); const F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true }); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer'] });
  await L.startFightPage(p, { list: ['goblin', 'goblin'] });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  const ids = await p.evaluate(() => { const B = Battle, h = B.heroes()[0], cells = B.freeCellsNear(h, 3, h); B.makeDouble(h, cells[0]); B.makeDouble(h, cells[1]); B.UI.refresh(); return B.doublesOf(h).map(d => d.id); });
  await p.waitForTimeout(600);
  const inBar = () => p.evaluate(ids => ids.map(id => !!document.querySelector(`.bt-order [data-id="${id}"]`)), ids);
  const before = await inBar();
  await p.evaluate(ids => { const B = Battle; B.kill(B.byId(ids[0])); B.vanish(B.byId(ids[1]), 'рассеивается'); B.UI.refresh(); }, ids);
  await p.waitForTimeout(600); const R = { before, after: await inBar() };
  ok('двойники были в шкале', R.before && R.before.every(Boolean), R);
  ok('убитый и рассеянный — пропали', R.after && R.after.every(x => !x), R);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
