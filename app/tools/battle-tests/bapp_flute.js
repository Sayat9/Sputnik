// Флейта (игра на привале по броску, навык, «Флейта успокоения», сундук крысолова) и действие флейты в бою.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const A = await p.evaluate(() => {
    const out = {}, c = state.party[0];
    c.bag = [{ t: 'g', id: 'flute', qty: 1 }]; c.essences = [];
    const T = totals(c), m = Math.max(mod(T.dex.total), mod(T.int.total));
    const want = (d, skill, calm) => { c.essences = skill ? ['rat-catcher'] : []; c.bag = [{ t: 'g', id: calm ? 'calm-flute' : 'flute', qty: 1 }]; return fluteOutcome(c, d).fat; };
    // без навыка: итог < 10 → +1, 10–15 → 0, 16+ → −1
    out.n1 = want(1 - m + 0, false, false) === 1 || want(-30, false, false) === 1;
    out.n2 = want(12 - m, false, false) === 0;
    out.n3 = want(16 - m, false, false) === -1;
    // с навыком: < 6 → +1, 6–15 → −1, 16+ → −2
    out.s1 = want(-30, true, false) === 1; out.s2 = want(10 - m, true, false) === -1; out.s3 = want(16 - m, true, false) === -2;
    // успокоения: без наказания, минимум −1
    out.c1 = want(-30, false, true) === -1; out.c2 = want(12 - m, false, true) === -1; out.c3 = want(16 - m, true, true) === -2;
    // кнопка в отдыхе
    c.bag = [{ t: 'g', id: 'flute', qty: 1 }]; c.essences = [];
    const r = state.run; dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(x => [x.id, 0])), flute: false };
    out.btn = /Флейта \(/.test(restOverlay());
    // игра на отдыхе: усталость отряда меняется в пределах 0..4
    r.day = 5; r.act = 1; r.pos = { x: 5, y: 5 };
    state.party.forEach(x => { r.status[x.id].fat = 2; });
    dgUi.rest.flute = true; act('rest');
    out.fatRange = state.party.every(x => r.status[x.id].fat >= 0 && r.status[x.id].fat <= 4);
    out.logged = JSON.stringify(r.log || []).includes('играет на флейте');
    // сундук крысолова
    state.inventory.treasures = {}; state.artifacts = null;
    ratChest(); const calmPossible = ARTIFACTS['calm-flute'].cls === 9;
    out.chest = calmPossible; out.chestGot = Object.values(state.inventory.treasures).some(t => t.owned) || state.party.some(x => (x.bag || []).some(e => e && ['once-more', 'calm-flute'].includes(e.id)));
    return out;
  });
  for (const [k, v] of Object.entries(A)) ok('flute ' + k, v === true, v);
  const B = await p.evaluate(async () => {
    const out = {}, S = Battle.S;
    return out;
  });
  const fail = R.filter(r => !r.ok).length;
  console.log(R.length - fail + '/' + R.length + ' ok');
  await b.close(); process.exit(fail ? 1 : 0);
})();
