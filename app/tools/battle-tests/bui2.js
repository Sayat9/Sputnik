const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  await L.startFightPage(p, { list: ['goblin', 'goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place');
  // монстров на поле быть не должно
  console.log('видимых монстров при расстановке:', await p.evaluate(() => [...document.querySelectorAll('.bt-token.mon')].filter(e => !e.hidden).length));
  // поставим первого героя в крайнюю клетку (0,6)
  await L.tapCell(p, 0, 6); await L.sleep(300);
  console.log('позиции:', JSON.stringify((await L.units(p)).filter(u => u.s === 'hero').map(u => [u.n, u.x, u.y])));
  await L.shot(p, '02_place_moved');
  // нельзя ставить выше 3 нижних рядов
  await L.tapCell(p, 3, 2); await L.sleep(200);
  console.log('toast:', await p.evaluate(() => document.querySelector('.bt-toast').textContent));
  await p.click('[data-ba="place-go"]');
  await L.sleep(2500);
  await L.shot(p, '03_after_place');
  // ждём хода героя
  let m = await L.mode(p), tries = 0;
  while (m !== 'hero' && tries++ < 60) { await L.sleep(500); m = await L.mode(p); const md = await p.evaluate(() => { const mm = document.querySelector('.bt-modal'); return mm && !mm.hidden ? mm.innerText.slice(0, 80) : ''; }); if (md) { console.log('модал:', md); const btn = await p.$('.bt-modal [data-m]'); if (btn) await btn.click(); } }
  console.log('mode:', m);
  await L.shot(p, '04_hero_turn');
  console.log('юниты:', JSON.stringify(await L.units(p)));
  console.log('errs:', p.errs);
  await b.close();
})();
