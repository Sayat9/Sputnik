// Разлом 2 этажа «Гоблинград» (08.11): порталы в Лесу гоблинов, районы, тревога, патруль, маскировка, рынок, подкуп, таверна, притон, склады масла → пиромант, дворец.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const o = {}; const clr = () => { dgUi.enc = null; dgUi.res = null; };
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 5, rank: 7, gold: 100 })]; newRun(); const run = state.run;
    run.floor = 2; run.variant = 'goblin'; run.day = 10; run.act = 1; run.pos = { x: 5, y: 5 }; riftSync(); const tiles = Object.keys((run.riftsF2 || {}).tiles || {}); o.n = tiles.length; o.id = tiles.length && run.riftsF2.tiles[tiles[0]].id; clr();
    const [tx, ty] = tiles[0].split(',').map(Number); run.pos = { x: tx, y: ty }; spDo('rift-enter'); const R = run.rift; o.inRift = R && R.id === 'gcity'; o.intro = dgUi.res && dgUi.res.title; clr();
    o.layout = R.map['7,3'] === 'gate' && R.map['7,0'] === 'palace' && R.map['7,6'] === 'market' && R.map['4,6'] === 'tavern' && Object.values(R.map).filter(t => t === 'oil').length === 3 && Object.values(R.map).includes('den');
    o.minis = Object.values(R.minis).sort().join();
    // тревога: улица +1, казармы +2, крыша −1, трущобы 0
    R.alarm = 5; R.map['3,8'] = 'street'; R.pos = { x: 2, y: 8 }; R.visited.push('3,8'); riftMove(3, 8); clr(); o.street = R.alarm;
    R.alarm = 5; R.map['1,1'] = 'barracks'; R.pos = { x: 1, y: 2 }; R.map['1,2'] = 'barracks'; R.visited.push('1,1'); delete R.minis['1,1']; riftMove(1, 1); clr(); o.barr = R.alarm;
    R.alarm = 5; R.map['4,13'] = 'street'; R.pos = { x: 3, y: 13 }; R.visited.push('4,13'); riftMove(4, 13); clr(); o.slums = R.alarm;
    R.alarm = 5; R.map['10,6'] = 'roof'; R.map['10,7'] = 'roof'; R.pos = { x: 10, y: 7 }; R.visited.push('10,6'); riftMove(10, 6); clr(); o.roof = R.alarm;
    // патруль на 10
    R.alarm = 9; R.map['11,8'] = 'street'; R.pos = { x: 10, y: 8 }; R.map['10,8'] = 'street'; riftMove(11, 8); o.patrol = !!(dgUi.enc && dgUi.enc.gcPatrol) && R.alarm === 3; clr();
    // маскировка: плащи у всех → выбор вместо боя
    R.cloaks = 1; gcEncounter(R, 'Встреча', ['goblin', 'goblin']); o.pend = !!R.pend && !dgUi.enc; o.bar = /gc-disguise/.test(gcBar(R, R.pos.x, R.pos.y)); let peace = 0, caught = 0; for (let i = 0; i < 40; i++) { R.pend = { title: 'x', list: ['goblin'], o: {} }; gcDisguise(); if (dgUi.enc) caught++; else peace++; clr(); } o.disg = peace > 0 && caught > 0;
    R.pend = { title: 'x', list: ['goblin'], o: {} }; gcFightNow(); o.fightNow = !!dgUi.enc && !R.pend; clr();
    // плащи падают с гоблинов
    R.cloaks = 0; for (let i = 0; i < 40; i++) gcFightDone(R, {}, ['goblin']); o.cloaks = R.cloaks > 3;
    // рынок: покупка и подкуп
    R.pos = { x: 7, y: 6 }; const g0 = partyGold(); gcBuy('torch'); o.buy = partyGold() === g0 - 4; R.alarm = 6; gcBribe(); o.bribe = R.alarm === 3 && partyGold() === g0 - 19; clr(); R.alarm = 6; gcBribe(); o.bribeOnce = R.alarm === 6;
    // таверна −3 и слухи; притон −4
    R.alarm = 8; R.pos = { x: 4, y: 6 }; riftRest(); clr(); o.tavern = R.alarm === 5 && R.rumor;
    const den = Object.keys(R.map).find(k => R.map[k] === 'den').split(',').map(Number); R.alarm = 8; R.pos = { x: den[0], y: den[1] }; riftRest(); o.den = R.alarm === 4; clr();
    // склады масла → пиромант → ключ контрабандиста → дворец
    const oils = Object.keys(R.map).filter(k => R.map[k] === 'oil'); run.light = false; let [ox, oy] = oils[0].split(',').map(Number); R.pos = { x: ox, y: oy }; gcIgnite(); o.noTorch = !Object.keys(R.oilLit).length;
    run.light = true; run.torchLeft = 20; for (const k of oils) { const [x, y] = k.split(',').map(Number); R.pos = { x, y }; gcIgnite(); if (!dgUi.enc) clr(); } o.pyro = !!(dgUi.enc && dgUi.enc.gcPyro); const pe = dgUi.enc; clr();
    gcFightDone(R, pe, ['mad-pyromancer']); o.smuggler = R.smuggler;
    R.pos = { x: 7, y: 3 }; o.gateOk = !/disabled/.test(gcBar(R, 7, 3)); gcPalace(); o.king = !!(dgUi.enc && dgUi.enc.gcKing && dgUi.enc.dialog); const ke = dgUi.enc; clr();
    R.smuggler = false; o.gateLocked = /disabled/.test(gcBar(R, 7, 3)); R.seal = true; R.key = true; o.gateSK = !/disabled/.test(gcBar(R, 7, 3));
    gcFightDone(R, ke, ['gob-founder']); o.boss = R.bossDead; riftChest(); o.chest = dgUi.res && dgUi.res.title; clr();
    // экран
    location.hash = 'labyrinth'; route(); o.stage = !!document.getElementById('rf-svg'); o.pill = (document.querySelector('.rf-pill') || {}).textContent || '';
    R.pos = { x: 7, y: 14 }; riftExit(); o.exit = !run.rift && run.riftsF2.tiles[tiles[0]].done; o.temp = !run.rift;
    return o;
  });
  let n = 0, bad = 0; const ok = (t, c) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(r)}`); };
  ok('в Лесу гоблинов — 2 портала в Гоблинград', r.n === 2 && r.id === 'gcity' && r.inRift && r.intro === 'Гоблинград');
  ok('районы: ворота и дворец, рынок, таверна, притон, 3 склада масла; минибоссы капитан и инженер', r.layout && r.minis === 'chief-engineer,city-captain');
  ok('тревога: улица +1, казармы +2, трущобы 0, крыши −1', r.street === 6 && r.barr === 7 && r.slums === 5 && r.roof === 4);
  ok('на 10 — патруль, тревога падает до 3', r.patrol);
  ok('маскировка: с плащами — выбор, Харизма решает; «Напасть» начинает бой; плащи падают с гоблинов', r.pend && r.bar && r.disg && r.fightNow && r.cloaks);
  ok('рынок: покупка за монеты, подкуп −3 (раз на клетку)', r.buy && r.bribe && r.bribeOnce);
  ok('таверна −3 и слухи; притон −4', r.tavern && r.den);
  ok('склады масла: без факела нельзя; 3 пожара — Безумный пиромант', r.noTorch && r.pyro);
  ok('ключ контрабандиста открывает дворец; иначе — печать и ключ; бой с вождём и диалогом', r.smuggler && r.gateOk && r.king && r.gateLocked && r.gateSK);
  ok('после вождя — сундук', r.boss && r.chest === 'Сундук стража');
  ok('экран с тревогой и плащами; плащи/ключи временные — исчезают с выходом', r.stage && /тревога \d+\/10/.test(r.pill) && r.exit && r.temp);
  ok('нет ошибок страницы', !errs.length); if (errs.length) console.log(errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
