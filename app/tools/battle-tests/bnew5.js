// Щит/двуручное −2 Ловкости, вращающийся удар, побег Сл 5/7, короткий лук, нож в другой руке, переброс в сводке
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-ui','battle-menu','battle-end','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  await p.addStyleTag({ path: '/home/user/app/assets/css/battle.css' });
  const R = [], ok = (n, c, x) => { R.push({ n, ok: !!c }); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + (x == null ? '' : x)); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = (i, race, main, off) => { const c = Object.assign(clone(state.example), { id: "q" + i, example: false, name: "Г" + i, race, level: 2 }); delete c.bag; delete c.kit; delete c.hp; c.essences = []; c.equip = { main: main ? { t: "w", id: main } : undefined, off: off ? { t: "w", id: off } : undefined }; if (!main) delete c.equip.main; if (!off) delete c.equip.off; return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const A = mk(0, "human", "sword"), Bh = mk(1, "human", "sword", "shield"), C = mk(2, "barbarian", "greatsword"), D = mk(3, "barbarian", "greatsword"); C.giantGrip = true;
    const E = mk(4, "human", "shortbow", "dagger");
    state.party = [A, Bh, C, D, E]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const dx = c => totals(c).dex.total;
    out.dexA = dx(A); out.dexShield = dx(Bh); out.dexGiant = dx(C); out.dexTwo = dx(D);
    const S = B.newBattle({ list: ['goblin', 'goblin', 'goblin'], zone: 'goblin', floor: 1, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeMonsters(S); B.preStart(S); B.rollInitiative();
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) S.cells[y][x] = null; S.objs.length = 0;
    const hs = B.heroes(), ms = B.mons(), hC = hs[2], hE = hs[4];
    const gs = B.attacksOf(hC).find(a => a.w && a.w.id === 'greatsword'); out.spin = !!(gs && gs.spin); out.giantPen = gs && gs.penalty;
    out.bowRange = (() => { const a = B.attacksOf(hE).find(a => a.kind === 'ranged'); return a && a.range; })();
    out.bowKnife = B.attacksOf(hE).some(a => a.w && a.w.id === 'dagger');
    // скорость
    out.speed = hs[0].speedC;
    // вращающийся удар
    hC.x = 3; hC.y = 5; ms[0].x = 3; ms[0].y = 4; ms[1].x = 2; ms[1].y = 4; ms[2].x = 4; ms[2].y = 4;
    ms.forEach(m => { m.hp = m.maxHp = 500; m.ac = 1; });
    hs.forEach(h => { if (h !== hC) { h.x = 0; h.y = 6; } });
    const hp0 = ms.map(m => m.hp); hC.t.action = 1;
    const rr = await B.doAttack(hC, ms[0], Object.assign({}, gs), { onCommit() {}, scale: 0.75 }).catch(e => ({ err: String(e) })); out.rr = { hit: rr.hit, raw: rr.raw, dealt: rr.dealt, err: rr.err, nat: rr.nat };
    out.mainDealt = hp0[0] - ms[0].hp;
    return out;
  });
  ok('щит −2 Ловкости', o.dexShield === o.dexA - 2, JSON.stringify(o));
  ok('варвар с двуручным в одной руке −2 Ловкости', o.dexGiant === o.dexTwo - 2 || o.dexGiant === o.dexTwo - 2, JSON.stringify(o));
  ok('без штрафа к атаке у «Великана»', !o.giantPen, o.giantPen);
  ok('двуручный меч: вращающийся удар', o.spin);
  ok('короткий лук: 5 клеток', o.bowRange && o.bowRange[1] === 5, JSON.stringify(o.bowRange));
  ok('лук + нож: ближний удар ножом доступен', o.bowKnife);
  ok('нет ошибок страницы', errs.length === 0, errs.join('|'));
  console.log(JSON.stringify(o));
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
