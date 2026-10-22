// Интерфейс: затаившийся враг не нарисован и не в порядке ходов; рядом с героем появляется («замечен»); «Осмотреться» его находит.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2'], autoEnd: false });
  await L.startFightPage(p, { list: ['goblin', 'goblin'], zone: 'goblin', floor: 2 });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]');
  ok('дошёл ход героя', await F.waitHero(p, { tries: 160 }));
  const vis = () => p.evaluate(() => { const B = Battle, ids = B.mons().map(m => m.id); return { tokens: ids.map(id => { const el = document.querySelector(`.bt-token[data-id="${id}"]`); return !!el && !el.hidden; }), order: ids.map(id => !!document.querySelector(`.bt-order [data-id="${id}"]`)) }; });
  await p.evaluate(() => { const B = Battle, S = B.S, u = B.UI.turnUnit; for (const r of S.cells) r.fill(''); u.x = 3; u.y = 5; const [a, c] = B.mons(); a.x = 3; a.y = 0; c.x = 5; c.y = 1; a.ac = 1; c.maxHp = c.hp = 300; B.removeStatus(a, 'hidden'); B.addStatus(c, 'hidden', { k: Infinity, data: { unseen: true, dc: 99 } }); B.UI.refreshNow(); B.UI.renderPanel(); });
  await L.sleep(300);
  let v = await vis(); ok('затаившийся не нарисован, остальной — да', v.tokens[0] && !v.tokens[1], JSON.stringify(v));
  ok('затаившегося нет в порядке ходов', v.order[0] && !v.order[1], JSON.stringify(v));
  const hasSearch = async () => p.evaluate(() => Battle.actionsFor(Battle.UI.turnUnit).some(o => o.id === 'search' && o.enabled));
  ok('«Осмотреться» доступно', await hasSearch());
  await p.evaluate(() => { const B = Battle, c = B.mons()[1], u = B.UI.turnUnit; c.x = u.x; c.y = u.y - 1; B.spotHidden(u); B.UI.refreshNow(); });
  await L.sleep(300); v = await vis(); ok('рядом с героем замечен: нарисован и в порядке ходов', v.tokens[1] && v.order[1], JSON.stringify(v));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 6) : 'нет');
  ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
