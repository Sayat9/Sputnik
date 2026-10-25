// Онлайн: слой связи (Link, комнаты, RPC, куски, переподключение) на loopback между двумя страницами.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext(); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const p of [h, c]) { p.on('pageerror', e => errs.push(e.message)); await p.goto('http://localhost:8765/tools/battle-tests/README.md'); await p.addScriptTag({ path: '/home/user/app/assets/js/net.js' }); }
  const R = []; const ok = (n, v, x) => { R.push(v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await h.evaluate(async () => {
    Net.transport = 'loopback'; window.log = [];
    Net.handle('hello', (d, link) => { const p = Net.bind(link, d.pid || Net.newPid(), d.name); log.push('hello:' + p.name); return { pid: p.pid }; });
    Net.handle('echo', d => d); Net.handle('big', d => d.length);
    await Net.startHost({ code: 'TEST1' });
  });
  await c.evaluate(async () => {
    Net.transport = 'loopback'; window.got = [];
    Net.handle('view', d => { got.push(d); });
    Net.join('TEST1', 'Вася', null, () => ({ heroes: [1] }));
    await new Promise(r => setTimeout(r, 600));
  });
  ok('клиент онлайн', await c.evaluate(() => Net.status) === 'online', await c.evaluate(() => Net.status));
  ok('игрок у ведущего', await h.evaluate(() => Object.values(Net.players).length === 1 && Object.values(Net.players)[0].online));
  ok('echo', await c.evaluate(async () => (await Net.callHost('echo', { a: [1, 2, 'я'] })).a[2]) === 'я');
  ok('большое сообщение (куски)', await c.evaluate(async () => Net.callHost('big', 'x'.repeat(200000))) === 200000);
  const pid = await h.evaluate(() => Object.keys(Net.players)[0]);
  await h.evaluate(pid => Net.toPlayer(pid, 'view', { n: 1 }), pid);
  await c.waitForTimeout(200); ok('ведущий → игрок', await c.evaluate(() => got.length) === 1);
  ok('RPC ведущий → игрок', await (async () => { await c.evaluate(() => Net.handle('ask', d => d * 2)); return (await h.evaluate(pid => Net.callPlayer(pid, 'ask', 21), pid)) === 42; })());
  // обрыв и возврат
  await h.evaluate(pid => Net.players[pid].link.close(), pid);
  await c.waitForTimeout(3500);
  ok('переподключение', await c.evaluate(() => Net.status) === 'online', await c.evaluate(() => Net.status));
  ok('тот же игрок, не новый', await h.evaluate(() => Object.keys(Net.players).length) === 1);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length, errs.length ? errs : '');
  await b.close();
})();
