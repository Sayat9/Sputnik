// 13.11: игрок нажимает «Движение» и осматривает карту у себя; двигать отряд не может.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block', hasTouch: true }); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); console.log(`  ${v ? '✓' : '✗'} ${n}${v ? '' : ' ' + JSON.stringify(x === undefined ? '' : x)}`); };
  await h.addInitScript(() => { localStorage.clear(); });
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  await h.evaluate(() => {
    const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 1 }); c.base = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); return c; };
    state.party = [mk('hA', 'Аргон'), mk('hB', 'Борис')]; state.sessions = [{ n: 1, date: new Date().toISOString(), members: ['hA', 'hB'] }]; saveChar();
  });
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  await c.addInitScript(() => { localStorage.clear(); });
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(800);
  await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]'); await c.waitForTimeout(1500);
  await h.evaluate(() => { location.hash = 'labyrinth'; }); await h.waitForTimeout(800);
  await h.evaluate(() => { if (!state.run) newRun(); location.hash = 'labyrinth'; const inv = inventory(); inv.compass.owned = true; inv.compassOn = false; invItem('map').owned = true; saveChar(); rerender(); NetGlue.pushAll(); });
  await h.waitForTimeout(400); await h.evaluate(() => { if (dgUi.enc || dgUi.res) { dgUi.res = null; } rerender(); NetGlue.pushAll(); }); await c.waitForTimeout(1200);
  // разлом на клетке отряда
  await h.evaluate(() => { const r = state.run; r.day = 3; r.act = 1; state.party.forEach(c => { c.rank = 7; }); riftSync(); dgUi.res = null; Object.values(r.riftsF1.tiles).forEach(t => t.id = 'mine'); const k = Object.keys(r.riftsF1.tiles)[0].split(',').map(Number); r.pos = { x: k[0], y: k[1] }; r.visited && r.visited.push && 0; saveChar(); rerender(); });
  await h.waitForTimeout(300);
  const btn = await h.evaluate(() => { const b = document.querySelector('[data-sp="rift-enter"]'); return b ? b.innerText : null; });
  ok('кнопка «Войти в разлом» без названия разлома', btn && /Войти в разлом/.test(btn) && !/шахт/i.test(btn), btn);
  await h.click('[data-sp="rift-enter"]'); await h.waitForTimeout(300);
  ok('перед входом — подтверждение с предупреждением', await h.evaluate(() => !state.run.rift && /назад пути не будет/.test(document.body.innerText)));
  await h.click('[data-yn="1"]'); await h.waitForTimeout(400);
  const intro = await h.evaluate(() => ({ in: !!state.run.rift, lines: dgUi.res && dgUi.res.lines }));
  ok('вошли; в окне нет описания того, что внутри', intro.in && intro.lines.length === 1 && !/слиз|уровн|штол/i.test(intro.lines.join(' ')), intro);
  await h.evaluate(() => { dgUi.res = null; saveChar(); rerender(); NetGlue.pushAll(); }); await c.waitForTimeout(900);
  // игрок открывает схему разлома
  await c.click('[data-rift="map"]'); await c.waitForTimeout(300);
  ok('игрок открыл схему разлома у себя', await c.evaluate(() => !!document.querySelector('.rf-grid')) && await h.evaluate(() => !dgUi.riftMap));
  await c.click('.ph-head [data-rift="map"]'); await c.waitForTimeout(300);
  ok('игрок закрыл схему', await c.evaluate(() => !document.querySelector('.rf-grid')));
  // шаг ведущего: бросок виден обоим, потом встреча
  await h.evaluate(() => { Math.random = () => 0.05; const R = state.run.rift; const b = document.querySelector(`[data-rift="move"]`); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await h.waitForTimeout(500);
  ok('ведущий: идёт бросок к20, встреча ещё скрыта', await h.evaluate(() => !!dgUi.rroll && !!document.querySelector('.ev-roll') && !document.querySelector('.enc-list, [data-dg="enc-ok"], .enc-mons')), await h.evaluate(() => ({ rr: dgUi.rroll, enc: !!dgUi.enc })));
  await c.waitForTimeout(500);
  ok('игрок видит бросок', await c.evaluate(() => !!document.querySelector('.ev-roll')));
  await h.waitForTimeout(1500); await c.waitForTimeout(300);
  ok('итог броска виден игроку (картинка и число)', await c.evaluate(() => !!document.querySelector('.ev-roll .ev-pic') && /к20 = \d+/.test(document.querySelector('.ev-roll').innerText)), await c.evaluate(() => document.querySelector('.ev-roll') && document.querySelector('.ev-roll').innerText));
  await h.waitForTimeout(1600); await c.waitForTimeout(600);
  ok('после броска встреча открыта у ведущего и у игрока', await h.evaluate(() => !dgUi.rroll && !!dgUi.enc) && await c.evaluate(() => !!dgUi.enc && !document.querySelector('.ev-roll')), await c.evaluate(() => ({ enc: !!dgUi.enc, rr: dgUi.rroll })));
  ok('нет ошибок', !errs.length, errs);
  console.log(`проверок: ${R.length} не прошли: ${R.filter(x => !x).length}`); await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})();
