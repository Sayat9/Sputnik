// Онлайн: проверка версии игры при входе и исключение игрока ведущим.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['c', c]]) { p.on('pageerror', e => errs.push(n + ': ' + e.message)); await p.addInitScript(() => { const m = new Map(); Object.assign(Storage.prototype, { getItem(k) { return m.has(k) ? m.get(k) : null; }, setItem(k, v) { m.set(k, String(v)); }, removeItem(k) { m.delete(k); }, clear() { m.clear(); } }); }); }
  await h.addInitScript(() => { window.__TEST_BUILD = '2026-10-26 12:00'; });
  await c.addInitScript(() => { window.__TEST_BUILD = window.name || '2026-10-26 10:00'; });
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  const go = async () => { await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]'); await c.waitForTimeout(1500); };
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(700); await go();
  ok('другая версия: не вошёл', (await c.evaluate(() => Net.status)) !== 'online', await c.evaluate(() => Net.status));
  const msg = await c.evaluate(() => document.getElementById('nj-msg') && document.getElementById('nj-msg').textContent);
  ok('сообщение про несовпадение версий', /Версии игры не совпадают/.test(msg || ''), msg);
  ok('ведущий не получил игрока', (await h.evaluate(() => Object.values(Net.players).filter(p => p.online).length)) === 0);
  await c.evaluate(() => { window.name = '2026-10-26 12:00'; });
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(700); await go();
  ok('та же версия: вошёл', (await c.evaluate(() => Net.status)) === 'online', await c.evaluate(() => Net.status));
  // исключение
  const pid = await h.evaluate(() => Object.keys(Net.players)[0]);
  await h.evaluate(() => { window.confirm = () => true; });
  await h.evaluate(pid => NetGlue.kick(pid), pid); await c.waitForTimeout(1200);
  ok('исключённый вышел из комнаты', (await c.evaluate(() => Net.status)) === 'off', await c.evaluate(() => Net.status));
  ok('у ведущего его больше нет', (await h.evaluate(() => Object.keys(Net.players).length)) === 0);
  // вернуться исключённый не может (тот же pid)
  await c.evaluate(([code, pid]) => { Net.join(code, 'Вася', pid, () => ({ build: '2026-10-26 12:00' })); }, [code, pid]); await c.waitForTimeout(1500);
  ok('повторный вход запрещён', (await c.evaluate(() => Net.status)) !== 'online' && (await h.evaluate(() => Object.values(Net.players).filter(p => p.online).length)) === 0);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length, errs.length ? [...new Set(errs)].slice(0, 5) : '');
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})();
