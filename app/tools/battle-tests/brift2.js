// Разломы (07.11): появление на 1 этаже с 7 ранга (день 3 – 2-е действие дня 4), портал в каждой зоне, вход, спуск в канализацию, страж, сундук, выход (+2 дня).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 4, rank: 8 })]; newRun(); const run = state.run; run.floor = 1; run.day = 3; run.act = 1;
    riftSync(); const noRank = !run.riftsF1;
    state.party[0].rank = 7; riftSync(); const tiles = Object.keys(run.riftsF1.tiles); const pop = dgUi.res && dgUi.res.pic; dgUi.res = null;
    const [tx, ty] = tiles[0].split(',').map(Number); run.pos = { x: tx, y: ty }; const btn = spButtons().map(x => x.id);
    spDo('rift-enter'); const R = run.rift; const inRift = !!R; dgUi.res = null;
    // дойти до спуска: двигаемся по двору (бои закрываем)
    let guard = 0; const go = (x, y) => { riftMove(x, y); dgUi.enc = null; dgUi.res = null; };
    while (R.pos.y < 4 && guard++ < 20) go(R.pos.x, R.pos.y + 1);
    while (R.pos.x !== R.descent.x && guard++ < 40) go(R.pos.x + Math.sign(R.descent.x - R.pos.x), R.pos.y);
    const inSewer = R.pos.y === 5;
    const dayInside = run.day;
    R.bossDead = true; R.pos = { ...R.boss }; riftChest(); const chest = dgUi.res && dgUi.res.title; dgUi.res = null;
    riftExit(); const after = { day: run.day, rift: !!run.rift, done: run.riftsF1.tiles[tiles[0]].done };
    run.day = 4; run.act = 3; riftSync(); const closed = run.riftsF1.closed;
    const ess = ['blood-slave', 'blood-bat', 'blood-ghoul', 'vampire-servant', 'blood-priest', 'blood-puddle', 'flesh-golem', 'abomination', 'death-knight'].every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id));
    return { noRank, n: tiles.length, pop, btn, inRift, inSewer, dayInside, chest, after, closed, ess };
  });
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  ok('на 8 ранге разломов нет', r.noRank, r);
  ok('на 7 ранге в 3-й день — по порталу в каждой из 4 зон и оповещение', r.n === 4 && r.pop === 'rift-open', r);
  ok('на портале — кнопка «Войти в разлом»', r.btn.includes('rift-enter') && r.inRift, r);
  ok('спуск из двора ведёт в канализацию; время этажа стоит', r.inSewer && r.dayInside === 3, r);
  ok('сундук стража после победы', r.chest === 'Сундук стража', r);
  ok('выход: +2 дня, портал использован', r.after.day === 5 && !r.after.rift && r.after.done, r);
  ok('после 2-го действия 4-го дня разломы закрываются', r.closed, r);
  ok('9 монстров крепости с эссенциями', r.ess, r);
  // экран разлома на месте карты (v115)
  const u = await p.evaluate(() => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 4, rank: 7 })]; newRun(); const run = state.run; run.floor = 1; run.day = 3; run.act = 1; run.arrive = false;
    riftSync(); dgUi.res = null; const k = Object.keys(run.riftsF1.tiles)[0].split(',').map(Number); run.pos = { x: k[0], y: k[1] }; spDo('rift-enter'); dgUi.res = null;
    location.hash = 'labyrinth'; dgUi.phase = 'menu'; route(); return { x: run.rift.pos.x, y: run.rift.pos.y };
  });
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => ({ svg: !!document.querySelector('#stage #rf-svg'), map: !!document.querySelector('#dg-svg'), pop: !!document.querySelector('.mapov'), go: document.querySelectorAll('#rf-svg [data-rift=move]').length, title: (document.querySelector('.rf-title') || {}).textContent }));
  await p.screenshot({ path: '/tmp/claude-0/-home-user/f8955059-a9de-5963-8c33-4491a2e868df/scratchpad/rift.png' });
  await p.locator('#rf-svg [data-rift=move]').first().dispatchEvent('click'); await p.waitForTimeout(200);
  const moved = await p.evaluate(() => state.run.rift.visited.length > 1);
  await p.evaluate(() => { dgUi.enc = null; dgUi.res = null; rerender(); });
  await p.click('[data-rift=map]'); await p.waitForTimeout(150);
  const sch = await p.evaluate(() => !!document.querySelector('.mapov .rf-grid'));
  ok('экран разлома на месте карты, без всплывающего окна', st.svg && !st.map && !st.pop && st.go >= 1 && st.title === 'Кровавая крепость', st);
  ok('шаг нажатием на соседний квадрат и схема по кнопке «Карта»', moved && sch, { moved, sch });
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
