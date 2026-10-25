const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 } }); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  await h.addInitScript(() => localStorage.clear()); await c.addInitScript(() => localStorage.clear());
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  await h.evaluate(() => {
    const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 2 }); c.base = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); return c; };
    state.party = [mk('hA', 'Аргон'), mk('hB', 'Борис')]; state.townUnlocked = true; state.sessions = [{ n: 1, date: new Date().toISOString(), members: ['hA', 'hB'] }]; saveChar();
  });
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(600);
  await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]'); await c.waitForTimeout(1200);
  await h.evaluate(() => { location.hash = 'labyrinth'; }); await h.waitForTimeout(800);
  await h.evaluate(() => { const i = invItem('map'); i.owned = true; saveChar(); });
  await c.waitForTimeout(1500);
  await c.screenshot({ path: '/tmp/battle-shots/net_lab.png' });
  await c.click('[data-nb="map"]'); await c.waitForTimeout(400); await c.screenshot({ path: '/tmp/battle-shots/net_map.png' });
  console.log('map open', await c.evaluate(() => !document.getElementById('netmap').hidden), errs);
  await b.close();
})();
