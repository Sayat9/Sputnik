// Автосохранение боя: после перезагрузки страницы бой возвращается в тот же ход; «Главная» из справочника ведёт обратно в подземелье.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  await L.startFightPage(p, { list: ['goblin', 'goblin', 'wolf'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]');
  ok('дошёл ход героя', await F.waitHero(p, { tries: 160 }));
  const before = await p.evaluate(() => ({ round: Battle.S.round, cur: Battle.S.curId, mons: Battle.mons().map(m => m.id + ':' + m.hp + ':' + m.x + ',' + m.y), heroes: Battle.heroes().map(h => h.name + ':' + h.hp), snap: !!state.fightSnap }));
  ok('снимок боя сохранён', before.snap);
  // перезагрузка страницы
  await p.reload(); await p.waitForTimeout(1500);
  let st = null;
  for (let i = 0; i < 80 && !st; i++) { st = await p.evaluate(() => (window.Battle && Battle.running && Battle.S && Battle.UI && Battle.UI.active) ? { round: Battle.S.round, mons: Battle.mons().map(m => m.id + ':' + m.hp + ':' + m.x + ',' + m.y), heroes: Battle.heroes().map(h => h.name + ':' + h.hp), mode: Battle.UI.mode, hash: location.hash, heroLink: Battle.heroes().every(h => h.hero && h.hero === state.party.find(c => c.id === h.hero.id)) } : null).catch(() => null); if (!st) await L.sleep(250); }
  ok('бой восстановился после перезагрузки', !!st, JSON.stringify(st));
  if (st) {
    ok('тот же раунд, монстры на местах', st.round === before.round && JSON.stringify(st.mons) === JSON.stringify(before.mons), JSON.stringify([before.mons, st.mons]));
    ok('герои связаны с отрядом', st.heroLink);
    ok('экран — подземелье', st.hash === '#labyrinth');
    let m = null; for (let i = 0; i < 60 && m !== 'hero'; i++) { m = await L.mode(p); if (m !== 'hero') await L.sleep(250); }
    ok('снова ход игрока', m === 'hero', m);
    await F.dockClick(p, 'end'); await L.sleep(600);
    ok('бой продолжается после возврата', await p.evaluate(() => Battle.running));
  }
  // вкладки
  await p.evaluate(() => { location.hash = 'ref'; }); await L.sleep(300);
  await p.evaluate(() => document.querySelector('nav.tabs [data-tab=""]').click()); await L.sleep(300);
  ok('«Главная» из справочника ведёт в подземелье', await p.evaluate(() => location.hash === '#labyrinth'));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 6) : 'нет');
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
