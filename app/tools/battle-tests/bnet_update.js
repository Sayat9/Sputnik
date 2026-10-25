// Окно обновления (с имитацией моста Android): вопрос → полоса прогресса → применение; и окно команды у игрока.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await p.addInitScript(() => { localStorage.clear(); window.applied = 0; window.SputnikApp = { steps: () => true, version: () => '1', pending: () => false, status: () => '', checkOnly() { setTimeout(() => window.sputnikUpdate('available', 5), 100); }, startDownload() { let i = 0; const t = setInterval(() => { i += 25; window.sputnikProgress(i); if (i >= 100) { clearInterval(t); window.sputnikUpdate('downloaded', 5); } }, 150); }, applyUpdate() { window.applied++; } }; });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(500);
  await p.evaluate(() => checkUpdate()); await p.waitForTimeout(500);
  ok('окно «Есть обновление»', await p.evaluate(() => !document.getElementById('updov').hidden && /Есть обновление/.test(document.getElementById('updov').textContent)));
  await p.screenshot({ path: '/tmp/battle-shots/upd_ask.png' });
  await p.click('[data-ud="no"]'); ok('«Позже» закрывает окно', await p.evaluate(() => document.getElementById('updov').hidden));
  await p.evaluate(() => checkUpdate()); await p.waitForTimeout(400); await p.click('[data-ud="yes"]'); await p.waitForTimeout(250);
  ok('полоса прогресса', await p.evaluate(() => !!document.getElementById('upd-bar') && /Установка/.test(document.getElementById('updov').textContent)));
  await p.screenshot({ path: '/tmp/battle-shots/upd_progress.png' });
  await p.waitForTimeout(1800);
  ok('после установки применяется', await p.evaluate(() => window.applied) >= 1, await p.evaluate(() => window.applied));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length, errs.length ? errs : '');
  await b.close();
})();
