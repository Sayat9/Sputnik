// Кнопка карты этажа в углу карты (02.11): видна только при карте текущего этажа (на 2 этаже — текущей части), открывает карту.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const st = () => p.evaluate(() => ({ btn: !!document.querySelector('[data-dg="floormap"]'), map: !!dgUi.map }));
  await p.evaluate(() => { const c = Object.assign(clone(state.example), { id: 'p1', example: false, name: 'Г' }); state.party = [c]; newRun(); dgUi = freshUi(); location.hash = 'labyrinth'; rerender(); });
  ok('1 этаж без карты — кнопки нет', !(await st()).btn);
  await p.evaluate(() => { invItem('map').owned = true; rerender(); });
  ok('1 этаж с картой — кнопка есть', (await st()).btn);
  await p.click('[data-dg="floormap"]'); await p.waitForTimeout(100);
  ok('кнопка открывает карту', (await st()).map);
  await p.evaluate(() => { dgUi.map = false; state.run.floor = 2; state.run.variant = 'goblin'; rerender(); });
  ok('2 этаж: карта 1 этажа не всплывает', !(await st()).btn);
  await p.evaluate(() => { invItem('map').owned = true; rerender(); });
  ok('2 этаж (гоблины) с картой — кнопка есть', (await st()).btn);
  await p.evaluate(() => { state.run.variant = 'beast'; rerender(); });
  ok('2 этаж другой части — карта гоблинов не всплывает', !(await st()).btn);
  await p.evaluate(() => { state.run.floor = 1; inventory().compass.owned = true; rerender(); }); await p.waitForTimeout(200); await p.screenshot({ path: '/tmp/claude-0/-home-user/f8955059-a9de-5963-8c33-4491a2e868df/scratchpad/mapbtn.png' });
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
