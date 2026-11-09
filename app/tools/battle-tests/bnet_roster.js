// Онлайн: игрок убирает своего героя в запас и возвращает его (таверна → «Отряд и запас»), чужих не трогает.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await h.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } });
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  await h.evaluate(() => { const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 1 }); c.base = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }; return c; };
    state.party = [mk('hA', 'Аргон'), mk('hC', 'Вера'), mk('hD', 'Глеб')]; state.townUnlocked = true; state.run = null; saveChar(); });
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  if (!code) { console.log('loopback недоступен в разных контекстах — пропуск'); console.log('проверок: 0, не прошли: 0'); await b.close(); return; }
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(800);
  await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]'); await c.waitForTimeout(1500);
  const pid = await h.evaluate(() => Object.keys(Net.players)[0]);
  ok('игрок подключился', !!pid);
  if (pid) {
    await h.evaluate(pid => { state.party[1].owner = pid; state.party[2].owner = pid; saveChar(); NetGlue.pushAll(); }, pid); await c.waitForTimeout(700);
    const r1 = await c.evaluate(async () => await NetGlue.rosterOut('hA')); ok('чужого героя игрок убрать не может', r1 && !r1.ok, r1);
    const r2 = await c.evaluate(async () => await NetGlue.rosterOut('hC')); await c.waitForTimeout(500);
    const s2 = { host: await h.evaluate(() => state.party.map(x => x.id).join()), res: await c.evaluate(() => reserveHeroes().map(x => x.id).join()) };
    ok('свой герой ушёл в запас игрока', r2 && r2.ok && s2.host === 'hA,hD' && s2.res === 'hC', { r2, s2 });
    const r3 = await c.evaluate(async () => await NetGlue.rosterIn('hC')); await c.waitForTimeout(500);
    const s3 = { host: await h.evaluate(pid => state.party.filter(x => x.owner === pid).map(x => x.id).sort().join(), pid), res: await c.evaluate(() => reserveHeroes().length) };
    ok('герой вернулся в отряд ведущего от игрока', r3 && r3.ok && s3.host === 'hC,hD' && s3.res === 0, { r3, s3 });
  }
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x).length}`); await b.close();
})();
