// 09.11: игрок сам включает компас и открывает карту (кнопки в углу экрана лабиринта); у ведущего ничего не меняется.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block', hasTouch: true }); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); console.log(`  ${v ? '✓' : '✗'} ${n}${v ? '' : ' ' + JSON.stringify(x === undefined ? '' : x)}`); };
  await h.addInitScript(() => { localStorage.clear(); });
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  await h.evaluate(() => {
    const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 1 }); c.base = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); return c; };
    state.party = [mk('hA', 'Аргон'), mk('hB', 'Борис')]; state.sessions = [{ n: 1, date: new Date().toISOString(), members: ['hA', 'hB'] }]; saveChar();
  });
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  await c.addInitScript(() => { localStorage.clear(); });
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(800);
  await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]'); await c.waitForTimeout(1500);
  await h.evaluate(() => { location.hash = 'labyrinth'; }); await h.waitForTimeout(800);
  await h.evaluate(() => { if (!state.run) newRun(); location.hash = 'labyrinth'; const inv = inventory(); inv.compass.owned = true; inv.compassOn = false; invItem('map').owned = true; saveChar(); rerender(); NetGlue.pushAll(); });
  await h.waitForTimeout(400); await h.evaluate(() => { if (dgUi.enc || dgUi.res) { dgUi.res = null; } rerender(); NetGlue.pushAll(); }); await c.waitForTimeout(1200);
  ok('у игрока видна кнопка компаса', await c.evaluate(() => !!document.querySelector('[data-dg="compass"]')));
  await c.evaluate(() => document.querySelector('[data-dg="compass"]').click()); await c.waitForTimeout(400);
  ok('игрок включил компас у себя', await c.evaluate(() => !!document.getElementById('compass')));
  ok('у ведущего компас не включился', await h.evaluate(() => !inventory().compassOn && !document.getElementById('compass')));
  await h.evaluate(() => { NetGlue.pushAll(); }); await c.waitForTimeout(800);
  ok('обновление ведущего не гасит компас игрока', await c.evaluate(() => !!document.getElementById('compass')));
  await c.evaluate(() => document.querySelector('[data-dg="compass"]').click()); await c.waitForTimeout(300);
  ok('повторное нажатие убирает компас', await c.evaluate(() => !document.getElementById('compass')));
  await c.evaluate(() => document.querySelector('[data-dg="floormap"]').click()); await c.waitForTimeout(400);
  ok('кнопка карты открывает карту у игрока', await c.evaluate(() => { const o = document.getElementById('netmap'); return !!o && !o.hidden; }));
  ok('у ведущего карта не открылась', await h.evaluate(() => !dgUi.map));
  ok('нет ошибок', !errs.length, errs);
  console.log(`проверок: ${R.length} не прошли: ${R.filter(x => !x).length}`); await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})();
