// Зыбучие пески (v123): карта 15×15, маяки (зов, минибоссы), Кель после обоих маяков; бой: зыбучий песок, урон «земля», колючая стойка, яд жала, Кель ныряет.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const r = await p.evaluate(() => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 5, rank: 7 })]; newRun(); const run = state.run; run.floor = 1; run.day = 3; run.act = 1;
    riftSync(); dgUi.res = null; Object.values(run.riftsF1.tiles).forEach(t => t.id = 'sand'); const k = Object.keys(run.riftsF1.tiles)[0].split(',').map(Number); run.pos = { x: k[0], y: k[1] }; riftEnter(); dgUi.res = null;
    const R = run.rift, [a, c] = R.beacons, o = { w: R.w, h: R.h, start: R.start, bOk: R.beacons.every(b => b.y <= 11 && !(b.x >= 6 && b.x <= 9 && b.y >= 6 && b.y <= 9)), bDist: Math.abs(a.x - c.x) + Math.abs(a.y - c.y), minis: R.beacons.map(b => b.mini).sort().join() };
    R.pos = { x: 7, y: 8 }; riftMove(7, 7); o.bossEarly = !dgUi.enc; dgUi.enc = null; dgUi.res = null;
    R.pos = { x: a.x, y: a.y + (a.y < 14 ? 1 : -1) }; R.visited = []; o.felt0 = a.felt; riftMove(a.x, a.y); o.felt = a.felt; o.noAutoFight = !dgUi.enc; dgUi.res = null;
    riftBeacon(); o.miniFight = dgUi.enc && dgUi.enc.list[0]; const e = dgUi.enc; dgUi.enc = null; riftFightDone(e, [0]); o.bDone = a.done;
    c.done = true; R.pos = { x: 7, y: 8 }; riftMove(7, 7); o.boss = dgUi.enc && dgUi.enc.list[0]; o.big10 = dgUi.enc && dgUi.enc.big10; dgUi.enc = null;
    o.ess = ['sand-vulture', 'sand-scorpion', 'worm-larva', 'sand-worm', 'big-stinger', 'pseudo-cactus', 'mirage-scorpion', 'dead-vulture', 'kel-worm'].every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id && m.rift === 'sand'));
    o.guard = MONSTERS.find(m => m.id === 'kel-worm').rank;
    return o;
  });
  ok('пустыня 15×15, старт внизу по центру', r.w === 15 && r.h === 15 && r.start.x === 7 && r.start.y === 14, r);
  ok('маяки: не в первых 3 рядах и не в центре 4×4, между ними ≥ 10 клеток, у каждого свой минибосс', r.bOk && r.bDist >= 10 && r.minis === 'dead-vulture,mirage-scorpion', r);
  ok('центр до маяков пуст (Кель не выходит)', r.bossEarly, r);
  ok('рядом с маяком — «далёкий зов»; на маяке бой не начинается сам', r.felt && r.noAutoFight, r);
  ok('«Раскачать маяк» — бой с минибоссом; победа топит маяк', !!r.miniFight && r.bDone, r);
  ok('после обоих маяков в центре — Кель, поле 10×10', r.boss === 'kel-worm' && r.big10, r);
  ok('9 монстров песков с эссенциями, Кель — страж', r.ess && r.guard === 'guardian', r);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const t = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 5 }); c.base = { str: 16, dex: 8, con: 14, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: 'longsword' } }; delete c.bag; delete c.kit; delete c.hp; return c; };
    state.run = state.run || {}; state.run.rift = null; state.party = [mk(0), mk(1)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    let S = B.newBattle({ list: ['pseudo-cactus', 'big-stinger', 'kel-worm'], zone: 'beast', floor: 1, place: 'Зыбучие пески', big10: true }); B.placeMonsters(S); S.phase = 'fight'; S.round = 1;
    out.size = B.W; out.sand = S.cells.flat().filter(c => c === 'quicksand').length;
    const h = B.heroes()[0]; let sunk = false; for (let i = 0; i < 10 && !sunk; i++) { B.removeStatus(h, 'sunk'); await B.sandEnter(h); sunk = !!B.has(h, 'sunk'); } out.sunk = sunk && B.speedOf(h) === 0; B.removeStatus(h, 'sunk');
    // урон землёй от «Сердца пустыни» у героя
    h.pass.push('kel-worm'); const tg = B.mons()[1], hp0 = tg.hp; const parts = [{ v: 3, dt: 'fire' }]; await B.applyDamage(h, tg, parts, { src: h }); out.earth = parts.some(p => p.dt === 'earth') && !!B.has(tg, 'slowed');
    // колючая стойка: +3 Защиты и ответный удар
    const cac = B.mons()[0]; const pr0 = cac.prot || 0; await B.A['pseudo-cactus'].run(cac, {}, { commit() {} }); out.stance = !!B.has(cac, 'spinestance');
    // Кель ныряет и выныривает
    const kel = B.mons()[2]; S.round = 3; kel.kelOut = 0; await B.P['body:kel-worm'].turnStartAsync(kel); out.kelUnder = !!B.has(kel, 'underground') && (S.zones || []).some(z => z.kind === 'kel');
    S.round = 4; await B.P['body:kel-worm'].turnStartAsync(kel); out.kelOut = !B.has(kel, 'underground') && !(S.zones || []).some(z => z.kind === 'kel');
    out.dtEarth = B.D ? B.D.DT.earth === 'земля' : (Battle.D && Battle.D.DT.earth === 'земля');
    return out;
  });
  ok('бой: поле 10×10, 4–6 клеток зыбучего песка', t.size === 10 && t.sand >= 4, t);
  ok('зыбучий песок: провал Ловкости — увяз (скорость 0)', t.sunk, t);
  ok('новый урон «земля»; «Сердце пустыни» добавляет урон землёй к умению и замедляет', t.dtEarth && t.earth, t);
  ok('псевдокактус встаёт в колючую стойку', t.stance, t);
  ok('Кель уходит под песок с подсветкой зоны и выныривает', t.kelUnder && t.kelOut, t);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
