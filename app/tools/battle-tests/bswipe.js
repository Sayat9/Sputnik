// Свайп в окне героя (03.11): разделы по кругу, за последним — следующий герой.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { state.party = [0, 1].map(i => Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i })); openHero('p0'); });
  const sw = async dx => { await p.mouse.move(200, 500); await p.mouse.down(); await p.mouse.move(200 + dx / 2, 505); await p.mouse.move(200 + dx, 510); await p.mouse.up(); await p.waitForTimeout(120); return p.evaluate(() => heroUi.id + ':' + heroUi.tab); };
  const seq = []; for (let i = 0; i < 3; i++) seq.push(await sw(-150)); seq.push(await sw(150)); seq.push(await sw(150));
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  ok('свайп влево: Инвентарь → Навыки → следующий герой (Данные); вправо — назад к предыдущему герою (Навыки)', JSON.stringify(seq) === JSON.stringify(['p0:inv', 'p0:skills', 'p1:stats', 'p0:skills', 'p0:inv']), seq);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
