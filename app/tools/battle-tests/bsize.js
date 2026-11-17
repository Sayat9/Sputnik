// 17.11: размер монстра по клеткам — 2×1/1×2 «большой» (Уворот −1), 2×2 и больше «очень большой» (−2); высота не даёт бонуса большим.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; await loadBattle(); const B = Battle;
    o.sameTable = JSON.stringify(MON_FOOT) === JSON.stringify(B.D.foot);
    const M = id => MONSTERS.find(m => m.id === id);
    o.pen = monSizePen(M('dark-bear')) === 1 && monSizePen(M('stone-elk')) === 1 && monSizePen(M('mammoth-calf')) === 2 && monSizePen(M('bone-knight')) === 0 && monSizePen(M('goblin')) === 0;
    const mk = (id, n) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 5 }); ensureKit(c); return c; };
    state.party = [mk('p0', 'А')]; newRun(); B.cfg.fast = true;
    const S = B.newBattle({ list: ['dark-bear', 'goblin'], zone: 'beast', floor: 1, kind: 'hard', title: 'x' }); B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); S.phase = 'fight';
    const h = S.units.find(u => u.side === 'hero'), bear = S.units.find(u => u.ref === 'dark-bear'), gob = S.units.find(u => u.ref === 'goblin');
    const hill = (x, y) => { S.cells[y][x] = 'hill'; };
    for (const u of [h, bear, gob]) hill(u.x, u.y);
    const has = (a, t, re) => B.attackCtx(a, t, (B.attacksOf(a)[0])).mods.some(m => re.test(m.l));
    o.smallElev = has(gob, h, /атакует сверху/) && has(h, gob, /цель на возвышении/);
    o.bigNoElev = !has(bear, h, /атакует сверху/) && !has(h, bear, /цель на возвышении/);
    B.running = false; B.S = null; return o;
  });
  let bad = 0; for (const [k, v] of Object.entries(r)) if (v !== true) { bad++; console.log('  ✗', k, v); }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad += errs.length; } console.log(`проверок: ${Object.keys(r).length}, не прошли: ${bad}`); await b.close();
})();
