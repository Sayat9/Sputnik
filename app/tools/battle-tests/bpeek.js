// 09.11: справочник в бою — меню боя «Справочник» сворачивает бой (бой идёт дальше), «Вернуться в бой» возвращает; кнопка «Герои» в нижнем меню ведущего.
const L = require('./bui_lib.js'); const F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true }); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer'] });
  ok('в нижнем меню есть «Герои» вместо «Заход»', await p.evaluate(() => { const t = document.querySelector('nav.tabs').innerText; return /Герои/.test(t) && !/Заход/.test(t); }));
  await p.evaluate(() => document.querySelector('nav.tabs [data-action="heroes"]').click()); await L.sleep(400);
  ok('«Герои» открывает окно героя (инвентарь доступен)', await p.evaluate(() => !document.getElementById('heroov').hidden && /Инвентарь/.test(document.getElementById('heroov').innerText)));
  await p.evaluate(() => { const x = document.querySelector('#heroov [data-hx="close"], #heroov .hero-x, #heroov [aria-label="Закрыть"]'); if (x) x.click(); else { heroUi = null; document.getElementById('heroov').hidden = true; } });
  await L.startFightPage(p, { list: ['goblin'] });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  const h0 = await p.evaluate(() => location.hash);
  await p.evaluate(() => Battle.UI.menu()); await L.sleep(300);
  await p.click('[data-m="peekref"]'); await L.sleep(500);
  ok('справочник виден, бой свёрнут', await p.evaluate(() => location.hash === '#ref' && getComputedStyle(document.getElementById('battle')).display === 'none' && !document.getElementById('bt-back').hidden));
  await p.click('#bt-back'); await L.sleep(500);
  ok('«Вернуться в бой» — бой снова на экране, ход тот же', await p.evaluate(h => location.hash === h && getComputedStyle(document.getElementById('battle')).display !== 'none' && Battle.UI.mode === 'hero', h0), h0);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
