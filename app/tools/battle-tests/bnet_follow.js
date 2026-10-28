// Онлайн: экран ведущего не блокируется «режимом просмотра» игрока (врата и здания нажимаются после любой смены экрана),
// а у игрока удержание карточки героя открывает меню (на экране ведущего остальное только смотрится).
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block', hasTouch: true }); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await h.addInitScript(() => { localStorage.clear(); });
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  await h.evaluate(() => {
    const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 1 }); c.base = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); return c; };
    state.party = [mk('hA', 'Аргон'), mk('hB', 'Борис'), mk('hC', 'Вера'), mk('hD', 'Глеб')]; state.townUnlocked = false; state.sessions = [{ n: 1, date: new Date().toISOString(), members: ['hA', 'hB', 'hC', 'hD'] }]; saveChar(); location.hash = '';
  });
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  await c.addInitScript(() => { localStorage.clear(); });
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(800);
  await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]'); await c.waitForTimeout(1500);
  const pid = await h.evaluate(() => Object.keys(Net.players)[0]);
  await h.evaluate(pid => { state.party[2].owner = pid; state.party[3].owner = pid; saveChar(); NetGlue.pushAll(); }, pid);
  await c.waitForTimeout(600);

  // ведущий: смена экрана после подключения сети (как «Завершить» в отряде) и несколько заходов в лабиринт подряд
  await h.evaluate(() => { location.hash = 'town'; }); await h.waitForTimeout(800);
  ok('у ведущего нет режима просмотра после смены экрана', await h.evaluate(() => !document.body.classList.contains('net-follow') && getComputedStyle(document.getElementById('view')).pointerEvents !== 'none'));
  let entered = 0;
  for (let k = 0; k < 4; k++) {
    const pos = await h.evaluate(() => { const g = document.querySelector('[data-bld="gate"]'); g.scrollIntoView({ block: 'center' }); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await h.touchscreen.tap(pos.x, pos.y); await h.waitForTimeout(500);
    if (await h.evaluate(() => location.hash) === '#labyrinth') entered++;
    await h.evaluate(() => { location.hash = 'town'; }); await h.waitForTimeout(400);
  }
  ok('врата нажимаются каждый раз (4 из 4)', entered === 4, entered);
  ok('в лабиринте экран ведущего тоже отзывается', await (async () => { await h.evaluate(() => { location.hash = 'labyrinth'; }); await h.waitForTimeout(700); return h.evaluate(() => getComputedStyle(document.getElementById('view')).pointerEvents !== 'none' && !document.body.classList.contains('net-follow')); })());
  await h.evaluate(() => { location.hash = 'town'; }); await c.waitForTimeout(800);

  // игрок: экран ведущего только смотрит, но карточки героев удерживаются
  ok('у игрока включён режим просмотра', await c.evaluate(() => document.body.classList.contains('net-follow')));
  const cdp = await ctx.newCDPSession(c);
  const hold = async id => {
    const pos = await c.evaluate(id => { const e = document.querySelector(`[data-hero="${id}"]`); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20 }; }, id);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pos] }); await c.waitForTimeout(900);
    const r = await c.evaluate(() => ({ open: !document.getElementById('heroov').hidden && !!document.querySelector('#heroov .panel, #heroov .fx-frame'), sel: String(getSelection()).trim() }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.waitForTimeout(250);
    await c.evaluate(() => { try { closeHero(); } catch (e) {} });
    return r;
  };
  const own = await hold('hC'), foreign = await hold('hA');
  ok('удержание своего героя открывает меню', own.open && own.sel === '', own);
  ok('удержание чужого героя тоже открывает меню (только просмотр)', foreign.open && foreign.sel === '', foreign);
  ok('на экране игрока врата не нажимаются (вход выбирает ведущий)', await c.evaluate(() => { const g = document.querySelector('[data-bld="gate"]'); g.scrollIntoView({ block: 'center' }); const r = g.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(el && el.closest('[data-bld="gate"]')); }));
  ok('ошибок страницы нет', errs.length === 0, errs);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
