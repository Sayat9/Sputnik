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
  await c.evaluate(() => { location.hash = 'town'; }); await c.waitForTimeout(600);
  const step = async (sel, label) => { const el = await c.$(sel); if (!el) { console.log('нет', label, sel); return false; } await el.scrollIntoViewIfNeeded(); await el.tap(); await c.waitForTimeout(350); return true; };
  await c.evaluate(() => { openHero('hC'); heroUi.tab = 'inv'; renderHero(); }); await c.waitForTimeout(500);
  const coinBtn0 = !!(await c.$('[data-hx="coin-toggle"]'));          // монет 0 — кнопки «Передать» у монет нет
  const before = await h.evaluate(() => ({ c: state.party[2].bag.reduce((s, e) => s + (e.qty || 1), 0), d: state.party[3].bag.reduce((s, e) => s + (e.qty || 1), 0), a: state.party[0].bag.reduce((s, e) => s + (e.qty || 1), 0) }));
  await step('[data-hbag="0"]', 'предмет');
  const st1 = await c.evaluate(() => ({ sel: heroUi && heroUi.sel, panel: !!document.querySelector('.sel-panel'), coin: !!document.querySelector('.coin-panel') }));
  await step('.sel-panel [data-hx="give-toggle"]', 'передать');
  const tg = await c.evaluate(() => [...document.querySelectorAll('.sel-panel [data-hx="give"]')].map(x => x.dataset.to + ':' + x.textContent));
  await step('.sel-panel [data-hx="give"][data-to="hD"]', 'своему'); await c.waitForTimeout(800);
  await step('[data-hbag="0"]', 'предмет2'); await step('.sel-panel [data-hx="give-toggle"]', 'передать2'); await c.evaluate(() => { window.__t = []; const o = window.toast; window.toast = m => { window.__t.push(m); o && o(m); }; }); await step('.sel-panel [data-hx="give"][data-to="hA"]', 'ведущему'); await c.waitForTimeout(1500); 0 && console.log('тосты', JSON.stringify(await c.evaluate(() => window.__t)), JSON.stringify(await c.evaluate(() => ({ sel: heroUi.sel, give: heroUi.give, panel: !!document.querySelector('.sel-panel [data-hx="give"]') }))));
  const after = await h.evaluate(() => ({ c: state.party[2].bag.reduce((s, e) => s + (e.qty || 1), 0), d: state.party[3].bag.reduce((s, e) => s + (e.qty || 1), 0), a: state.party[0].bag.reduce((s, e) => s + (e.qty || 1), 0) }));
  // монеты чужому герою
  await h.evaluate(() => { state.party[2].gold = 7; saveChar(); NetGlue.pushAll(); }); await c.waitForTimeout(800);
  await c.evaluate(() => { heroUi.coin = true; heroUi.coinAmt = 5; renderHero(); }); await c.waitForTimeout(200);
  await step('[data-hx="coin-give"][data-to="hA"]', 'монеты ведущему'); await c.waitForTimeout(1500);
  const gold = await h.evaluate(() => ({ c: goldOf(state.party[2]), a: goldOf(state.party[0]) }));
  const R2 = [];
  const chk = (n, v, x) => { R2.push(!!v); console.log(v ? '  ✓' : '  ✗', n, v ? '' : JSON.stringify(x)); };
  chk('без монет нет кнопки передачи монет', !coinBtn0, coinBtn0);
  chk('игрок открыл предмет — панель действий', st1.sel === 0 && st1.panel, st1);
  chk('передал своему второму герою', after.d > before.d, { before, after });
  chk('передал герою ведущего', after.a > before.a && after.c + after.d + after.a === before.c + before.d + before.a, { before, after });
  chk('монеты герою ведущего', gold.a === 5 && gold.c === 2, gold);
  chk('нет ошибок', !errs.length, errs);
  console.log(`проверок: ${R2.length} не прошли: ${R2.filter(x => !x).length}`);
  await c.screenshot({ path: '/tmp/claude-0/give.png' });
  console.log(errs); await b.close();
})();
