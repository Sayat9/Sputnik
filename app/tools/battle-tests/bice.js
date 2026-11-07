// Ледяной грот (v117): карта 3×15, холод на шагах (факел снимает, горит на 1 ход меньше), жаровни на карте, бои с холодом и жаровнями, Сердце этажа — алтарь.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const r = await p.evaluate(() => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 5, rank: 7 })]; newRun(); const run = state.run; run.floor = 1; run.day = 3; run.act = 1;
    riftSync(); dgUi.res = null; const k = Object.keys(run.riftsF1.tiles)[0]; run.riftsF1.tiles[k].id = 'ice'; const [x, y] = k.split(',').map(Number); run.pos = { x, y }; spDo('rift-enter'); dgUi.res = null;
    const R = run.rift, o = { id: R.id, w: R.w, h: R.h, braz: Object.keys(R.braziers).length, minis: Object.values(R.minis).sort().join(), cold0: R.cold.p0 };
    run.light = false; const go = (x, y) => { riftMove(x, y); dgUi.enc = null; dgUi.res = null; };
    R.minis = {}; R.braziers = {}; go(1, 1); go(1, 2); o.coldDark = R.cold.p0;
    run.light = true; run.torchLeft = 4; go(1, 3); o.torchAfter = run.torchLeft; o.coldTorch = R.cold.p0;
    run.light = false; R.cold.p0 = 10; const hp0 = hpOf(state.party[0]); R.visited = []; go(1, 4); o.hpCold = hp0 - hpOf(state.party[0]); o.cold10 = R.cold.p0;
    R.braziers[tkey(1, 5)] = { lit: false }; R.pos = { x: 1, y: 5 }; run.inv = run.inv; state.party[0].bag = [{ t: 'g', id: 'torch', qty: 2 }]; riftLightBrazier(); dgUi.res = null; o.lit = R.braziers[tkey(1, 5)].lit;
    R.cold.p0 = 5; go(1, 6); o.coldWarm = R.cold.p0;
    R.pos = { x: 1, y: 13 }; riftMove(1, 14); o.boss = dgUi.enc && dgUi.enc.list; o.bossEv = dgUi.enc && { cold: !!dgUi.enc.cold, big10: dgUi.enc.big10, bb: dgUi.enc.bigBrazier, place: dgUi.enc.place }; dgUi.enc = null;
    o.ess = ['ice-imp', 'frost-beetle', 'snow-hunter', 'ice-spirit', 'mammoth-calf', 'ice-deer', 'half-troll'].every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id && m.rift === 'ice'));
    o.guard = MONSTERS.find(m => m.id === 'half-troll').rank;
    // Сердце этажа
    run.rift = null; run.floor = 3; f3(); run.pos = { x: 15, y: 14 }; o.altar = f3Buttons().map(b => b.id).includes('f3altar');
    return o;
  });
  ok('Ледяной грот: 3×15, три жаровни, оба минибосса', r.id === 'ice' && r.w === 3 && r.h === 15 && r.braz === 3 && r.minis === 'ice-deer,mammoth-calf', r);
  ok('шаги без факела: холод +1 за шаг', r.cold0 === 0 && r.coldDark === 2, r);
  ok('с факелом холод −1, свежий факел горит на 1 ход меньше', r.coldTorch === 1 && r.torchAfter === 2, r);
  ok('на 10 холода — 1 урон, счётчик остаётся 10', r.hpCold === 1 && r.cold10 === 10, r);
  ok('жаровня зажигается факелом и греет соседние клетки', r.lit && r.coldWarm === 4, r);
  ok('страж — Грольф с огромной жаровней, поле 10×10, холод в бою', r.boss && r.boss[0] === 'half-troll' && r.bossEv.cold && r.bossEv.big10 && r.bossEv.bb, r);
  ok('7 монстров грота с эссенциями, Грольф — страж', r.ess && r.guard === 'guardian', r);
  ok('Сердце этажа: алтарь', r.altar, r);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const t = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 5 }); c.base = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: 'longsword' } }; delete c.bag; delete c.kit; delete c.hp; return c; };
    state.run = state.run || {}; state.run.rift = null; state.party = [mk(0), mk(1)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const cold = { p0: 3, p1: 0 }; const S = B.newBattle({ list: ['half-troll'], zone: 'stone', floor: 1, place: 'Ледяной грот', cold, big10: true, bigBrazier: true }); B.placeMonsters(S); S.phase = 'fight';
    out.size = B.W; out.braz = S.cells.flat().filter(c => c === 'brazier').length; out.big = !!S.bigBrazier;
    const h = B.heroes()[0], sp0 = B.speedOf ? B.speedOf(h) : null;
    S.cells[S.bigBrazier.y][S.bigBrazier.x] = 'bigBrazierOut';
    await B.addCold(h, 3); out.c6 = cold.p0; out.slow = sp0 - B.speedOf(h); out.frost = !!B.has(h, 'frost');
    await B.addCold(h, 5); out.c10 = cold.p0; out.hpLost = h.maxHp - h.hp;
    const tr = B.mons()[0]; const t2 = B.heroes()[1]; await B.applyDamage(tr, t2, [{ v: 2, dt: 'cold' }], { src: tr }); out.hitCold = cold.p1;
    S.cells[S.bigBrazier.y][S.bigBrazier.x] = 'bigBrazier'; await B.applyDamage(tr, t2, [{ v: 2, dt: 'cold' }], { src: tr }); out.warmBlock = cold.p1;
    // жаровня: факел зажигает, тварь гасит
    let bx = -1, by = -1; S.cells.forEach((row, y) => row.forEach((c, x) => { if (c === 'brazier' && bx < 0) { bx = x; by = y; } }));
    B.igniteAt(bx, by, 'тест'); out.lit = S.cells[by][bx] === 'brazierLit';
    const imp = B.monUnit('ice-imp', 1); imp.side = 'mon'; B.addUnit(imp); const cell = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => [bx+dx, by+dy]).find(([x,y]) => B.inB(x,y) && !S.cells[y][x] && !B.occupant(x,y)); imp.x = cell[0]; imp.y = cell[1];
    await B.coldTurnStart(imp); out.doused = S.cells[by][bx] === 'brazier';
    return out;
  });
  ok('бой: поле 10×10, 2–3 жаровни, огромная жаровня', t.size === 10 && t.braz >= 2 && t.big, t);
  ok('холод 6: −1 клетка движения, статус «Холод»', t.c6 === 6 && t.slow === 1 && t.frost, t);
  ok('холод 10: урон за каждую прибавку сверх', t.c10 === 10 && t.hpLost >= 2, t);
  ok('удар холодом ледяной твари студит; огромная жаровня не даёт холоду расти', t.hitCold === 2 && t.warmBlock === 2, t);
  ok('огонь зажигает жаровню, ледяная тварь рядом её гасит', t.lit && t.doused, t);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
