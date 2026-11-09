// Разлом 2 этажа «Чаща прошлого» (08.11): порталы в Волчьей чаще, карта 15×15, корни по диагонали, след, ручей/дупло/поляна, таблички, ключи, лаборатория.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const o = {};
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 5, rank: 7 })]; newRun(); const run = state.run;
    run.floor = 2; run.variant = 'undead'; run.day = 10; run.act = 1; run.pos = { x: 5, y: 5 }; riftSync(); o.noGoblin = !run.riftsF2;
    run.variant = 'beast'; riftSync(); const tiles = Object.keys((run.riftsF2 || {}).tiles || {}); o.n = tiles.length; o.pop = dgUi.res && dgUi.res.pic; dgUi.res = null;
    const [tx, ty] = tiles[0].split(',').map(Number); run.pos = { x: tx, y: ty }; o.btn = spButtons().map(x => x.id).includes('rift-enter');
    spDo('rift-enter'); const R = run.rift; o.inRift = R && R.id === 'past'; o.intro = dgUi.res && dgUi.res.title; dgUi.res = null;
    o.start = R.pos.x === 0 && R.pos.y === 14; o.lab = R.map['14,0'] === 'lab'; o.keeper = R.map['7,7'] === 'keeper';
    o.roots = [...Array(15).keys()].every(i => i === 7 || R.map[i + ',' + i] === 'roots');
    o.types = [...new Set(Object.values(R.map))].sort().join();
    o.startSign = R.signs['0,14'] === 'start';
    // корни не пускают
    R.pos = { x: 3, y: 4 }; const before = { ...R.pos }; riftMove(4, 4); o.rootsBlock = R.pos.x === before.x && R.pos.y === before.y && /испорченной природы/.test((dgUi.res || {}).lines?.[0] || ''); dgUi.res = null;
    // след: шаг +1, факел +1, поляна +1; ручей −5; дупло −3 на привале
    state.party[0].edu = { nav1: true, nav2: true }; R.trail = 0; run.light = false;
    R.map['1,13'] = 'thicket'; R.pos = { x: 0, y: 13 }; R.visited.push('1,13'); riftMove(1, 13); dgUi.enc = null; dgUi.res = null; o.trail1 = R.trail;
    R.map['2,13'] = 'glade'; R.visited.push('2,13'); run.light = true; run.torchLeft = 9; riftMove(2, 13); dgUi.enc = null; dgUi.res = null; o.trail3 = R.trail - o.trail1; run.light = false;
    R.trail = 8; R.map['3,13'] = 'stream'; R.visited.push('3,13'); riftMove(3, 13); dgUi.enc = null; dgUi.res = null; o.stream = R.trail;
    R.trail = 5; R.map['3,12'] = 'hollow'; R.pos = { x: 3, y: 12 }; riftRest(); dgUi.enc = null; dgUi.res = null; o.hollow = R.trail;
    // погоня на 10
    R.trail = 9; R.map['4,12'] = 'thicket'; R.pos = { x: 4, y: 13 }; riftMove(4, 12); o.chase = !!(dgUi.enc && dgUi.enc.pastChase) && R.trail === 0; dgUi.enc = null; dgUi.res = null;
    // ключи с лютоволков → лаборатория
    pastFightDone(R, {}, ['lab-direwolf', 'lab-direwolf']); o.k2 = R.keys; pastFightDone(R, {}, ['lab-direwolf', 'lab-direwolf']); o.k3 = R.keys;
    R.keeperDead = true; R.pos = { x: 14, y: 1 }; R.map['14,1'] = 'thicket'; riftMove(14, 0); dgUi.enc = null; dgUi.res = null; o.atLab = pastTile(R, R.pos.x, R.pos.y) === 'lab';
    o.labSign = R.signs['14,0'] === 'lab';
    R.keys = 2; o.lockedBtn = /disabled/.test(pastBar(R, 14, 0)); R.keys = 3; o.openBtn = !/disabled/.test(pastBar(R, 14, 0));
    pastLabEnter(); o.natFight = !!(dgUi.enc && dgUi.enc.pastNat && dgUi.enc.dialog); dgUi.enc = null;
    pastFightDone(R, { pastNat: true }, ['naturalist']); o.natDead = R.natDead;
    for (let i = 0; i < 4; i++) { pastExplore(); dgUi.res = null; } o.explore = R.explore;
    pastLabDown(); o.luna = !!(dgUi.enc && dgUi.enc.pastLuna); dgUi.enc = null;
    pastFightDone(R, { pastLuna: true }, ['luna']); o.boss = R.bossDead; riftChest(); o.chest = dgUi.res && dgUi.res.title; dgUi.res = null;
    // хранитель: поражение — назад; победа — корни увядают
    R.keeperDead = false; R.pos = { x: 6, y: 7 }; R.prev = null; o.dbg = JSON.stringify({ enc: !!dgUi.enc, rift: !!run.rift, t: R.map['7,7'] }); riftMove(7, 7); o.keeperFight = !!(dgUi.enc && dgUi.enc.pastKeeper); o.dbg2 = JSON.stringify({ pos: R.pos, res: dgUi.res, end: run.ending, day: run.day, hp: state.party.map(c => c.hp) }); const e = dgUi.enc || {}; dgUi.enc = null; pastFightDone(R, e, []); o.pushedBack = R.pos.x === 6 && R.pos.y === 7;
    R.pos = { x: 6, y: 7 }; riftMove(7, 7); const e2 = dgUi.enc || {}; dgUi.enc = null; pastFightDone(R, e2, ['fallen-keeper']); o.withered = R.keeperDead && pastTile(R, 3, 3) === 'thicket';
    // заблудиться: без навигатора с низкой Мудростью шаг уходит в сторону чаще всего
    state.party[0].edu = {}; state.party[0].base.wis = 6; let lost = 0; for (let i = 0; i < 40; i++) { R.pos = { x: 5, y: 10 }; R.map['5,9'] = 'dense'; riftMove(5, 9); dgUi.enc = null; dgUi.res = null; if (!(R.pos.x === 5 && R.pos.y === 9)) lost++; } o.lost = lost;
    state.party[0].edu = { nav1: true, nav2: true }; let lost2 = 0; for (let i = 0; i < 20; i++) { R.pos = { x: 5, y: 10 }; riftMove(5, 9); dgUi.enc = null; dgUi.res = null; if (!(R.pos.x === 5 && R.pos.y === 9)) lost2++; } o.lost2 = lost2;
    // экран
    location.hash = 'labyrinth'; dgUi.enc = null; dgUi.res = null; route(); o.stage = !!document.getElementById('rf-svg'); o.pill = (document.querySelector('.rf-pill') || {}).textContent || '';
    R.pos = { x: 0, y: 14 }; route(); o.signBtn = !!document.querySelector('[data-rift="sign"]'); const sb = document.querySelector('[data-rift="sign"]'); if (sb) sb.click(); o.signTxt = (dgUi.res || {}).lines?.[0]; dgUi.res = null;
    riftExit(); o.exit = !run.rift && run.riftsF2.tiles[tiles[0]].done;
    run.day = 11; run.act = 3; riftSync(); o.closed = run.riftsF2.closed;
    return o;
  });
  let n = 0, bad = 0; const ok = (t, c) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(r)}`); };
  ok('в Могильнике (пока) разлома нет', r.noGoblin);
  ok('в Волчьей чаще на 7 ранге — 2 портала и оповещение', r.n === 2 && r.pop === 'rift-open');
  ok('вход в «Чащу прошлого», старт в левом нижнем углу', r.btn && r.inRift && r.start && r.intro === 'Чаща прошлого');
  ok('лаборатория справа вверху, хранитель в центре, корни по диагонали', r.lab && r.keeper && r.roots);
  ok('все типы клеток: ' + r.types, ['dense', 'glade', 'hollow', 'stream', 'thicket'].every(t => r.types.includes(t)));
  ok('корни не пускают — «Сила испорченной природы…»', r.rootsBlock);
  ok('след: шаг +1, факел и поляна ещё +2', r.trail1 === 1 && r.trail3 === 3);
  ok('ручей −5, дупло −3', r.stream === 4 && r.hollow === 2);
  ok('на 10 — погоня лютоволка, след сброшен', r.chase);
  ok('ключ-карты: не больше 3', r.k2 === 2 && r.k3 === 3);
  ok('лаборатория: табличка, без 3 карт закрыто', r.atLab && r.labSign && r.lockedBtn && r.openBtn);
  ok('бой с Натуралистом с диалогом → спуск', r.natFight && r.natDead && r.luna);
  ok('исследовать — только 3 раза', r.explore === 3);
  ok('после Луны — сундук', r.boss && r.chest === 'Сундук стража');
  ok('хранитель: не победили — отход назад; победили — корни увяли', r.keeperFight && r.pushedBack && r.withered);
  ok(`без навигатора теряются (${r.lost}/40), с «Навигатором 2» — нет (${r.lost2}/20)`, r.lost >= 8 && r.lost2 === 0);
  ok('экран разлома с пилюлей следа и ключей', r.stage && /след \d+\/10/.test(r.pill) && /ключ-карты/.test(r.pill));
  ok('табличка на старте: «ОН СЛЕДИТ ЗА НАМИ»', r.signBtn && r.signTxt === 'ОН СЛЕДИТ ЗА НАМИ');
  ok('выход, портал закрыт; разломы закрываются по времени', r.exit && r.closed);
  ok('нет ошибок страницы', !errs.length); if (errs.length) console.log(errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
