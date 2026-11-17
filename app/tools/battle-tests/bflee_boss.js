// 17.11: побег из боя с боссом — сокровища нет, босс остаётся (3 этаж и разломы).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false, master: true } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const o = {}; const c = Object.assign(clone(state.example), { id: 'p0', name: 'А', example: false, level: 5 }); ensureKit(c); state.party = [c]; newRun(); const run = state.run; run.floor = 3;
    for (const [id, k] of [['faceless-sculptor', 'sculptorDead'], ['forge-smith', 'smithDead'], ['trap-queen', 'queenDead']]) {
      f3MonFightDone({ list: [id], killed: [0], outcome: 'flee' }); const a = !f3()[k];
      f3MonFightDone({ list: [id], killed: [0], outcome: 'win' }); o[id] = a && !!f3()[k];
    }
    run.rift = { minis: { '1,1': 'flesh-golem' }, done: {} };
    riftFightDone({ riftKey: '1,1', list: ['death-knight', 'flesh-golem'], outcome: 'flee' }, [0, 1]); o.riftFlee = !run.rift.bossDead && !run.rift.done['1,1'];
    riftFightDone({ riftKey: '1,1', list: ['death-knight', 'flesh-golem'], outcome: 'win' }, [0, 1]); o.riftWin = run.rift.bossDead && run.rift.done['1,1'];
    return o;
  });
  let bad = 0; for (const [k, v] of Object.entries(r)) if (v !== true) { bad++; console.log('  ✗', k, v); }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad += errs.length; } console.log(`проверок: ${Object.keys(r).length}, не прошли: ${bad}`); await b.close();
})();
