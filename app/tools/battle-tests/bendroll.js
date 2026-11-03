// Игрок онлайн видит анимацию броска на эссенцию в окне итога (03.11): BN.showEnd с roll рисует кубики и результат.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html?mode=player'); await p.waitForTimeout(500);
  await p.evaluate(() => { window.Net = { role: 'client', handle() {}, on() {} }; });
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  await p.addStyleTag({ path: '/home/user/app/assets/css/battle.css' });
  await p.evaluate(() => Battle.Net.showEnd({ k: 'endscr', html: '<div class="bt-endscr fx-frame win"><h2>Победа!</h2></div>', roll: { d: [9, 6], ok: true, trav: false, r: 96, need: 93 } }));
  const mid = await p.evaluate(() => ({ canvas: !!document.querySelector('#bnend .bt-roll canvas'), res: document.querySelector('#bnend .bt-roll-res')?.textContent || '' }));
  await p.waitForTimeout(6000);
  const end = await p.evaluate(() => document.querySelector('#bnend .bt-roll-res')?.textContent || '');
  await p.screenshot({ path: '/tmp/claude-0/-home-user/f8955059-a9de-5963-8c33-4491a2e868df/scratchpad/endroll.png' });
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  ok('у игрока в окне итога есть кубики броска на эссенцию, результат появляется после анимации', mid.canvas && !mid.res && /96/.test(end) && /выпала/.test(end), { mid, end });
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
