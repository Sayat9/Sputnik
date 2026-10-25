// Настоящий PeerJS (WebRTC через публичный сервер рукопожатий): ведущий ↔ игрок. Может не пройти в изолированной сети.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const ctx = await b.newContext(); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const p of [h, c]) { p.on('pageerror', e => errs.push(e.message)); await p.goto('http://localhost:8765/tools/battle-tests/README.md'); await p.addScriptTag({ path: '/home/user/app/assets/vendor/peerjs.min.js' }); await p.addScriptTag({ path: '/home/user/app/assets/js/net.js' }); }
  await h.evaluate(async () => { Net.handle('hello', (d, link) => { const p = Net.bind(link, d.pid || Net.newPid(), d.name); return { pid: p.pid }; }); Net.handle('echo', d => d); await Net.startHost({ code: 'PEER' + Math.floor(Math.random() * 9) }); });
  const code = await h.evaluate(() => Net.code);
  const st = await c.evaluate(async code => { Net.join(code, 'Вася', null, () => ({})); for (let i = 0; i < 40; i++) { if (Net.status === 'online') break; await new Promise(r => setTimeout(r, 500)); } return Net.status; }, code);
  let echo = null; if (st === 'online') echo = await c.evaluate(async () => (await Net.callHost('echo', { x: 'ok' })).x);
  console.log('PeerJS:', st, echo, errs.slice(0, 2));
  await b.close();
})();
