// Зелёная шахта (v124): 5 уровней, минибоссы на 2-м и 3-м, тёмный 4-й, страж на 5-м, раскопки; бой: динамит, стойка с факелом, слизи.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const r = await p.evaluate(() => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 5, rank: 7 })]; newRun(); const run = state.run; run.floor = 1; run.day = 3; run.act = 1; run.light = false;
    riftSync(); dgUi.res = null; Object.values(run.riftsF1.tiles).forEach(t => t.id = 'mine'); const k = Object.keys(run.riftsF1.tiles)[0].split(',').map(Number); run.pos = { x: k[0], y: k[1] }; riftEnter(); dgUi.res = null;
    const R = run.rift, o = { l1: [R.level, R.w, R.h, R.start.x, R.start.y], d1: R.descent.y <= 1 };
    const goDesc = () => { const d = R.descent; R.pos = { x: d.x, y: d.y + 1 < R.h ? d.y + 1 : d.y - 1 }; R.cleared = {}; riftMove(d.x, d.y); mineDescend(); dgUi.enc = null; dgUi.res = null; };
    goDesc(); o.l2 = R.level; o.mini2 = Object.values(R.minis)[0];
    goDesc(); o.l3 = R.level; o.mini3 = Object.values(R.minis)[0];
    goDesc(); o.l4 = [R.level, R.w, R.h, R.descent.y]; o.dark = mineDark(R); o.descHidden = riftMarkOf(R, R.descent.x, R.descent.y, true, true) !== 'descent';
    R.pos = { x: 3, y: 3 }; R.visited = []; riftMove(3, 2); o.darkFight = dgUi.enc ? !!dgUi.enc.dark : 'нет боя'; dgUi.enc = null; dgUi.res = null;
    goDesc(); o.l5 = [R.level, R.w, R.h]; R.pos = { x: 0, y: 1 }; riftMove(0, 0); o.boss = dgUi.enc && dgUi.enc.list[0]; dgUi.enc = null;
    // раскопки
    R.dug = {}; state.party[0].bag = [{ t: 'g', id: 'shovel', qty: 1, uses: 5 }]; state.sack = { items: {}, mig: true, mig2: true }; R.level = 1; riftDig(); dgUi.res = null;
    o.dug = Object.values(state.sack.items).reduce((a, it) => a + it.qty, 0); o.dugOnce = (() => { const before = o.dug; riftDig(); return Object.values(state.sack.items).reduce((a, it) => a + it.qty, 0) === before; })();
    o.ess = ['goblin-miner', 'kobold', 'slime', 'kobold-guard', 'goblin-blaster', 'acid-slime', 'stone-slime', 'split-slime', 'mine-ghost', 'cart-mimic', 'kobold-captain', 'goblin-foreman', 'rimuru'].every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id && m.rift === 'mine'));
    o.guard = MONSTERS.find(m => m.id === 'rimuru').rank;
    return o;
  });
  ok('уровень 1: 5×3, старт в центре нижнего ряда, спуск в дальних рядах', r.l1.join() === '1,5,3,2,2' && r.d1, r);
  ok('уровень 2 — глава стражи, уровень 3 — главный прораб', r.l2 === 2 && r.mini2 === 'kobold-captain' && r.l3 === 3 && r.mini3 === 'goblin-foreman', r);
  ok('уровень 4: 7×5, тёмный, спуск в дальнем ряду не виден без факела', r.l4.join() === '4,7,5,0' && r.dark && r.descHidden, r);
  ok('бой на 4-м уровне без факела — во тьме', r.darkFight === true || r.darkFight === 'нет боя', r);
  ok('уровень 5: коридор 1×3, в конце Римуру', r.l5.join() === '5,1,3' && r.boss === 'rimuru', r);
  ok('раскопки в шахте: камни, раз на клетку', r.dug >= 2 && r.dugOnce, r);
  ok('13 монстров шахты с эссенциями, Римуру — страж', r.ess && r.guard === 'guardian', r);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const t = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 5 }); c.base = { str: 16, dex: 8, con: 14, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: 'longsword' } }; delete c.bag; delete c.kit; delete c.hp; return c; };
    state.run = state.run || {}; state.run.rift = null; state.party = [mk(0), mk(1)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    let S = B.newBattle({ list: ['split-slime', 'rimuru'], zone: 'goblin', floor: 1, place: 'Зелёная шахта', mineLevel: 4 }); B.placeMonsters(S); S.phase = 'fight';
    const cells = S.cells.flat(); out.dyn = cells.filter(c => c === 'dynamite').length; out.stand = cells.filter(c => c === 'torchstand').length;
    const S2 = B.newBattle({ list: ['slime'], zone: 'goblin', floor: 1, place: 'Зелёная шахта', mineLevel: 2 }); out.stand2 = S2.cells.flat().filter(c => c === 'torchstand').length; B.S = S;
    // динамит взрывается
    let dx = -1, dy = -1; S.cells.forEach((row, y) => row.forEach((c, x) => { if (c === 'dynamite' && dx < 0) { dx = x; dy = y; } }));
    const h = B.heroes()[0]; const cand = [[dx, dy + 1], [dx, dy - 1], [dx + 1, dy], [dx - 1, dy]].find(([x, y]) => B.inB(x, y) && B.canStand(h, x, y)); h.x = cand[0]; h.y = cand[1]; const hp0 = h.hp;
    B.damageObject(dx, dy, 99, 'slash', h);
    if (B.flushQueue) await B.flushQueue();
    out.boom = S.cells[dy][dx] !== 'dynamite'; out.boomHurt = h.hp < hp0;
    // делящаяся слизь
    const sp = B.mons()[0], before = B.mons().length; await B.applyDamage(h, sp, [{ v: 9, dt: 'slash' }], { src: h }); if (B.flushQueue) await B.flushQueue(); out.split = B.mons().length > before;
    // Римуру поглощает павшего
    const rim = B.mons().find(m => m.ref === 'rimuru'), sl = B.mons().find(m => m.ref === 'slime'); if (sl) { const c = B.freeCellsNear(rim, 1, sl)[0]; B.kill(sl, h); if (c) { sl.x = c[0]; sl.y = c[1]; } }
    out.dbg = sl ? { alive: B.alive(sl), dead: sl.dead, x: sl.x, y: sl.y, rx: rim.x, ry: rim.y, d: B.dist(rim, sl), inUnits: B.S.units.includes(sl), ref: sl.ref, can: B.A.rimuru.can(rim) } : null; out.absorb = sl ? B.A.rimuru.can(rim) === true : 'нет слизи'; if (out.absorb === true) { await B.A.rimuru.run(rim, {}, { commit() {} }); out.absorbPass = rim.pass.includes('slime') && rim.temp >= 5; }
    return out;
  });
  ok('бой в шахте: 2–3 ящика динамита; стойка с факелом — только на 4-м уровне, одна', t.dyn >= 2 && t.stand === 1 && t.stand2 === 0, t);
  ok('ящик динамита взрывается и ранит стоящего рядом', t.boom && t.boomHurt, t);
  ok('делящаяся слизь от удара 8+ отделяет малую', t.split, t);
  ok('Римуру поглощает павшего рядом: его пассивка и 5 временных ОЗ', t.absorb === true && t.absorbPass, t);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
