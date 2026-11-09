// Аудит: монстры 7 и 6 класса применяют свои способности (активки) в симуляциях боёв.
const L = require('./bui_lib.js');
(async () => { const { b, p } = await L.launch(400, 860); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], tactical: true, level: 6 });
  const R = await p.evaluate(async (only) => { await loadBattle(); const B = Battle; const used = {};
    const ua = B.useActive; B.useActive = async (u, id, pk, o) => { const r = await ua(u, id, pk, o); if (u.side === 'mon' && r) used[id] = (used[id] || 0) + 1; return r; };
    const list = MONSTERS.filter(m => (m.cls === 7 || m.cls === 6) && !m.stub0 && (!only || only.includes(m.id)));
    const out = [];
    for (const m of list) { const ess = m.essence || m.id; if (!B.A[ess] || B.A[ess].time === 'reaction') { out.push({ id: m.id, noActive: true }); continue; }
      let fights = 0, uses = 0, err = null;
      for (let i = 0; i < 4; i++) { state.party.forEach(c => { c.hp = maxHp(c); c.dead = false; c.mp = maxMp ? maxMp(c) : c.mp; }); const before = used[ess] || 0;
        try { await B.sim({ kind: 'hard', title: 't', list: [m.id], zone: m.zone || 'beast', floor: m.floor || 2, key: 't' + i, outcome: null, killed: [], turn: 0, round: 1, tactical: true }); } catch (e) { err = String(e).slice(0, 120); }
        if ((used[ess] || 0) > before) fights++; uses += (used[ess] || 0) - before; }
      out.push({ id: m.id, ess, fights, uses, err }); }
    return out; }, process.argv[2] ? process.argv[2].split(',') : null);
  for (const r of R) console.log(r.noActive ? `  · ${r.id}: без активки` : `  ${r.fights ? '✓' : '✗'} ${r.id} (${r.ess}): боёв с применением ${r.fights}/4, раз ${r.uses}${r.err ? ' ERR ' + r.err : ''}`);
  console.log('errs:', errs.slice(0, 3)); await b.close();
})();
