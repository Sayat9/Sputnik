// 13.11: игрок нажимает «Движение» и осматривает карту у себя; двигать отряд не может.
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
  const pos0 = await h.evaluate(() => JSON.stringify(state.run.pos));
  await c.click('[data-act="move"]'); await c.waitForTimeout(300);
  ok('игрок нажал «Движение» — у него открылась карта осмотра', await c.evaluate(() => dgUi.phase === 'move' && dgUi.lookSelf && /Осмотр карты/.test(document.querySelector('.phase-pill').innerText) && !!document.querySelector('.zoom')));
  ok('у ведущего меню не изменилось', await h.evaluate(() => dgUi.phase === 'menu'));
  const z0 = await c.evaluate(() => dgUi.zoom); await c.click('[data-dg="zoom-in"]'); await c.waitForTimeout(200);
  ok('приближение работает у игрока', await c.evaluate(z0 => dgUi.zoom > z0, z0));
  const box = await c.evaluate(() => { const r = document.getElementById('dg-svg').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const sp0 = await c.evaluate(() => state.run.spin);
  await c.mouse.move(box.x + 100, box.y); await c.mouse.down(); await c.mouse.move(box.x + 60, box.y + 80, { steps: 5 }); await c.mouse.up(); await c.waitForTimeout(200);
  ok('карта вращается пальцем', await c.evaluate(sp0 => state.run.spin !== sp0, sp0));
  // нажатия по соседним квадратам отряд не двигают
  for (const [dx, dy] of [[60, 0], [-60, 0], [0, 60], [0, -60]]) { await c.mouse.click(box.x + dx, box.y + dy); await c.waitForTimeout(80); }
  await c.waitForTimeout(500);
  ok('нажатия по квадратам никого не двигают', (await h.evaluate(() => JSON.stringify(state.run.pos))) === pos0 && await c.evaluate(() => dgUi.path.length === 0 && dgUi.phase === 'move'));
  const cam = await c.evaluate(() => ({ s: state.run.spin, z: dgUi.zoom }));
  await h.evaluate(() => { NetGlue.pushAll(true); }); await c.waitForTimeout(900);
  ok('обновление ведущего не сбивает осмотр и камеру', await c.evaluate(cam => dgUi.phase === 'move' && dgUi.lookSelf && state.run.spin === cam.s && dgUi.zoom === cam.z, cam));
  await c.click('[data-dg="cancel"]'); await c.waitForTimeout(300);
  ok('«Закрыть» возвращает меню ведущего', await c.evaluate(() => dgUi.phase === 'menu' && !!document.querySelector('[data-act="move"]')));
  await h.evaluate(() => { document.querySelector('[data-act="move"]').click(); }); await h.waitForTimeout(300); await h.evaluate(() => NetGlue.pushAll()); await c.waitForTimeout(900);
  ok('ведущий выбирает путь — игрок видит это и может вращать, но не выбирать', await c.evaluate(() => dgUi.phase === 'move' && dgUi.look && !dgUi.lookSelf));
  ok('нет ошибок', !errs.length, errs);
  console.log(`проверок: ${R.length} не прошли: ${R.filter(x => !x).length}`); await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})();
