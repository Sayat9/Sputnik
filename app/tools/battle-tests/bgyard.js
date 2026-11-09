// Разлом 2 этажа «Кладбище прошлого», часть 1 (09.11): староста, таверна, день/ночь по 10 действий, поля без встреч, кладбище, светящиеся могилы.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false, master: true } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const clr = () => { dgUi.enc = null; dgUi.res = null; };
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 5, rank: 7 })]; newRun(); const run = state.run;
    run.floor = 2; run.variant = 'undead'; run.day = 10; run.act = 1; run.pos = { x: 5, y: 5 }; riftSync(); const tiles = Object.keys((run.riftsF2 || {}).tiles || {}); o.n = tiles.length; o.id = tiles.length && run.riftsF2.tiles[tiles[0]].id; clr();
    const [tx, ty] = tiles[0].split(',').map(Number); run.pos = { x: tx, y: ty }; spDo('rift-enter'); const R = run.rift; o.inRift = R && R.id === 'gyard';
    await new Promise(r => setTimeout(r, 400)); const d1 = document.getElementById('vn-dlg'); o.elder1 = !!d1 && /Староста Азик Эггерс/.test(d1.innerText) && /путники/.test(d1.innerText); if (d1) d1.click(); await new Promise(r => setTimeout(r, 250));
    const d2 = document.getElementById('vn-dlg'); o.elder2 = !!d2 && /скромная деревня/.test(d2.innerText); if (d2) d2.click(); await new Promise(r => setTimeout(r, 250)); clr();
    o.layout = R.map['0,14'] === 'tavern' && R.map['3,11'] === 'village' && R.map['0,0'] === 'crypt' && R.map['14,0'] === 'cathedral' && R.map['5,13'] === 'field' && R.map['10,4'] === 'grave' && R.pos.x === 0 && R.pos.y === 14;
    o.tavernBtn = /gy-tavern/.test(gyBar(R, 0, 14));
    // поля днём: без встреч
    let fights = 0; for (let i = 0; i < 30; i++) { R.pos = { x: 4, y: 13 }; R.visited = R.visited.filter(k => k !== '5,13'); riftMove(5, 13); if (dgUi.enc) fights++; clr(); } o.fieldsQuiet = fights === 0;
    // фазы: 10 действий день → ночь
    R.phase = 'day'; R.pt = 0; for (let i = 0; i < 10; i++) gyAdvance(1); o.night = R.phase === 'night' && R.pt === 0; for (let i = 0; i < 10; i++) gyAdvance(1); o.day = R.phase === 'day';
    // кладбище днём — реже и без 7 класса; ночью — чаще и с 7 классом
    const cnt = night => { R.phase = night ? 'night' : 'day'; let n = 0, c7 = 0; for (let i = 0; i < 300; i++) { R.phase = night ? 'night' : 'day'; R.pt = 0; R.pos = { x: 9, y: 4 }; R.map['10,4'] = 'grave'; R.visited = R.visited.filter(k => k !== '10,4'); delete R.cleared['10,4']; R.graves = [{ x: 0, y: 0, dug: false }]; riftMove(10, 4); if (dgUi.enc) { n++; if (dgUi.enc.list.some(id => MONSTERS.find(m => m.id === id).cls === 7)) c7++; } clr(); } return { n, c7 }; };
    const dd = cnt(false), nn = cnt(true); o.dayN = dd; o.nightN = nn; o.rates = dd.n < nn.n && dd.c7 === 0 && nn.c7 > 0;
    // таверна: 2 действия, полное восстановление и +5 временных ОЗ
    const c = state.party[0]; c.hp = 3; run.status[c.id].fat = 3; run.status[c.id].sat = 1; R.pos = { x: 0, y: 14 }; R.phase = 'day'; R.pt = 0; gyTavern(); clr();
    o.tavern = c.hp === maxHp(c) && c.tmpHp === 5 && run.status[c.id].fat === 0 && run.status[c.id].sat === 9 && R.pt === 2;
    // склеп и собор закрыты
    R.pos = { x: 4, y: 1 }; riftMove(3, 1); o.cryptClosed = R.pos.x === 4 && /заперты/.test((dgUi.res || {}).lines?.[0] || ''); clr();
    // светящиеся могилы: 3 раза, последнее имя — староста; копать — камни и мертвец 7 класса
    R.graves = []; R.phase = 'night'; let tries = 0; while (R.graves.length < 1 && tries++ < 400) { R.pos = { x: 9, y: 4 }; R.visited = R.visited.filter(k => k !== '10,4'); delete R.cleared['10,4']; riftMove(10, 4); clr(); }
    o.grave = R.graves.length === 1 && gyMarkOf(R, R.graves[0].x, R.graves[0].y, true, true) === 'gy_grave';
    const g = R.graves[0]; R.pos = { x: g.x, y: g.y }; gyRead(); o.name = (dgUi.res || {}).lines?.[0] || ''; clr();
    c.bag.push({ t: 'g', id: 'shovel', qty: 1, uses: 3 }); state.sack = null; const s0 = sackTotal(); gyDig(); o.dig = !!(dgUi.enc && dgUi.enc.gyGrave && dgUi.enc.list.some(id => MONSTERS.find(m => m.id === id).cls === 7)) && sackTotal() > s0 + 4; clr();
    R.graves.push({ x: 1, y: 1, name: GY_GRAVES[1], dug: true }, { x: 2, y: 2, name: GY_GRAVES[2], dug: true }); o.last = GY_GRAVES[2] === 'Азик Эггерс' && R.graves.length === 3;
    let more = 0; for (let i = 0; i < 200; i++) { R.pos = { x: 9, y: 4 }; R.visited = R.visited.filter(k => k !== '10,4'); delete R.cleared['10,4']; riftMove(10, 4); clr(); } o.max3 = R.graves.length === 3;
    location.hash = 'labyrinth'; route(); o.pill = (document.querySelector('.rf-pill') || {}).textContent || '';
    R.pos = { x: 0, y: 14 }; riftExit(); o.exit = !run.rift && c.tmpHp === undefined;
    // без режима мастера — портала нет
    state.settings.master = false; const r2 = state.run; r2.riftsF2 = null; r2.floor = 2; r2.variant = 'undead'; r2.day = 10; r2.act = 1; riftSync(); o.gated = !r2.riftsF2;
    return o;
  });
  let n = 0, bad = 0; const ok = (t, c) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(r)}`); };
  ok('Могильник (режим мастера): 2 портала в «Кладбище прошлого»', r.n === 2 && r.id === 'gyard' && r.inRift);
  ok('староста встречает двумя репликами, имя над окном', r.elder1 && r.elder2);
  ok('поселение 4×4 с таверной у портала, поля по диагонали, кладбище, склеп и собор по углам', r.layout && r.tavernBtn);
  ok('днём в полях встреч нет', r.fieldsQuiet);
  ok('день и ночь по 10 действий', r.night && r.day);
  ok(`кладбище: днём реже и без 7 класса (${r.dayN && r.dayN.n}), ночью чаще и с 7 классом (${r.nightN && r.nightN.n}, 7 кл. ${r.nightN && r.nightN.c7})`, r.rates);
  ok('таверна: 2 действия, ОЗ полностью, +5 временных, усталость 0, сытость полная', r.tavern);
  ok('склеп и собор закрыты', r.cryptClosed);
  ok('ночью — светящаяся могила; «Исследовать» — имя; «Копать» — камни и мертвец 7 класса', r.grave && /Марта Холл/.test(r.name) && r.dig);
  ok('могил не больше 3, последняя — староста', r.last && r.max3);
  ok('экран: фаза дня/ночи; выход снимает временные ОЗ', /день|ночь/.test(r.pill) && r.exit);
  ok('без режима мастера портал не открывается', r.gated);
  ok('нет ошибок страницы', !errs.length); if (errs.length) console.log(errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
