// 10.11: меню действий на карте не вылезает за рамку (особое место, тьма, портал, Копать, Алтарь); навигатор — +1 квадрат на карте этажа, стоп повторным нажатием; доска заданий — просто посмотреть бесплатно; повышение ранга — всем готовым.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(600);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const fit = () => p.evaluate(() => { const st = document.querySelector('.dg-over'); if (!st) return { none: true }; const r = st.getBoundingClientRect(), menu = st.querySelector('.dg-menu');
    const btns = [...st.querySelectorAll('.dg-menu .fx-btn, .dark-bar')]; st.scrollTop = 0; const top = btns[0].getBoundingClientRect().top;
    const over = btns.filter(x => x.scrollWidth > x.clientWidth + 2).map(x => x.textContent.trim().slice(0, 20));
    return { n: btns.length, topOK: top >= r.top - 1, scroll: st.scrollHeight > st.clientHeight + 1, overflowX: over, many: menu.classList.contains('many') }; });
  await p.evaluate(() => {
    const mk = (id, rank) => Object.assign(clone(state.example), { id, name: id, example: false, level: 5, rank });
    state.party = [mk('p0', 7), mk('p1', 7)]; newRun(); const run = state.run; run.floor = 1; run.arrive = false;
    const c = Math.floor(FLOOR1.size / 2); run.pos = { x: c, y: c }; run.day = 3; run.act = 1; location.hash = 'labyrinth'; dgUi.phase = 'menu'; route(); riftSync(); dgUi.res = null; dgUi.enc = null;
    state.party[0].bag = (state.party[0].bag || []).concat([{ t: 'g', id: 'shovel', qty: 1, uses: 3 }]); run.light = false; rerender();
  });
  await p.waitForTimeout(300);
  const A = await fit(); ok('1 этаж с алтарём и Копать: всё видно, текст не вылезает', !A.none && A.topOK && !A.overflowX.length, A);
  await p.screenshot({ path: '/tmp/claude-0/-home-user/f8955059-a9de-5963-8c33-4491a2e868df/scratchpad/menu1.png' });
  // 2 этаж: особое место + тьма
  await p.evaluate(() => { const run = state.run; run.floor = 2; run.variant = 'beast'; rerender(); });
  const B2 = await p.evaluate(() => { const r = state.run; let found = null; const n = FL().size; for (let y = 0; y < n && !found; y++) for (let x = 0; x < n && !found; x++) { r.pos = { x, y }; if (spButtons().length && isDark(x, y)) found = [x, y]; } if (!found) return null; r.light = false; dgUi.phase = 'menu'; rerender(); return found; });
  if (B2) { await p.waitForTimeout(200); const F2 = await fit(); ok('2 этаж: особое место + тьма — кнопки не уходят под край', F2.topOK && !F2.overflowX.length, { F2, B2 });
    await p.screenshot({ path: '/tmp/claude-0/-home-user/f8955059-a9de-5963-8c33-4491a2e868df/scratchpad/menu2.png' }); }
  else ok('2 этаж: нашлось особое место в темноте', false, 'нет клетки');
  // навигатор
  const N = await p.evaluate(() => { const r = state.run; r.floor = 1; r.rift = null; r.tier = null; r.boots = false; const a = [pathNeed('move'), pathNeed('run')]; eduLearn(state.party[1], 'nav1'); const b2 = [pathNeed('move'), pathNeed('run')]; r.floor = 2; const c2 = [pathNeed('move'), pathNeed('run')]; r.floor = 1; return { a, b2, c2 }; });
  ok('навигатор своего этажа: Движение 2, Бег 3; на чужом — 1 и 2', N.a.join() === '1,2' && N.b2.join() === '2,3' && N.c2.join() === '1,2', N);
  // доска заданий и ранг
  const T = await p.evaluate(async () => { state.run = null; location.hash = 'town'; route(); await loadTown(); const t0 = townClock().t; Town.open('board'); Town.close(); const t1 = townClock().t;
    state.party.forEach(c => { c.rank = 8; }); const ready = state.party.map(c => rankNext(c));
    const orig = window.rankReady; return { t0, t1, ready }; });
  ok('доска заданий: открыть и закрыть — без действия', T.t1 === T.t0, T);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
