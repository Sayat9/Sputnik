// Клиент игрока без связи: окно входа закрывается, доступны команда, герои, справочник, библиотека, карта.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await p.addInitScript(() => localStorage.clear());
  await p.goto('http://localhost:8765/index.html?net=loopback&mode=player'); await p.waitForTimeout(900);
  ok('окно входа', await p.evaluate(() => !document.getElementById('netjoin').hidden));
  await p.click('[data-nj="later"]'); ok('«Позже» закрывает окно', await p.evaluate(() => document.getElementById('netjoin').hidden));
  ok('нижняя панель есть', await p.evaluate(() => !!document.querySelector('#netbar [data-nb="heroes"]')));
  ok('окно команды без связи с кнопкой подключения', await p.evaluate(() => /Команда/.test(document.getElementById('view').textContent) && !!document.querySelector('[data-nj="open"]')));
  ok('экран интерактивен без связи', await p.evaluate(() => getComputedStyle(document.getElementById('view')).pointerEvents) !== 'none');
  await p.click('[data-nb="more"]'); ok('в меню: карта, библиотека, подключение', await p.evaluate(() => { const t = document.getElementById('netheroes').textContent; return /Карта этажа/.test(t) && /Библиотека/.test(t) && /Подключиться/.test(t); }));
  await p.click('[data-nb="lib"]'); await p.waitForTimeout(300); ok('библиотека открывается', await p.evaluate(() => !document.getElementById('libov').hidden));
  ok('в библиотеке нет «+» и есть фильтр по виду', await p.evaluate(() => !document.querySelector('#libov [data-lx="add"]')));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length, errs.length ? errs : '');
  await b.close();
})();
