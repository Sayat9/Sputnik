// 09.11: Безликий звонарь применяет «Колокол теней» (раньше ИИ всегда выбирал удар: оценка 4 < двойной атаки; и не звонил, пока не видел героев).
const L = require('./bui_lib.js');
(async () => { const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], tactical: true, level: 5 });
  const R = await p.evaluate(async () => { await loadBattle(); const B = Battle; let fights = 0, used = 0; const ua = B.useActive; B.useActive = async (u, id, pk, o) => { const r = await ua(u, id, pk, o); if (id === 'faceless-ringer' && r) { used++; } return r; };
    for (let i = 0; i < 6; i++) { state.party.forEach(c => { c.hp = maxHp(c); c.dead = false; }); const before = used; await B.sim({ kind: 'hard', title: 't', list: ['faceless-ringer'], zone: 'undead', floor: 2, key: 't', outcome: null, killed: [], turn: 0, round: 1, tactical: true }); if (used > before) fights++; }
    return { fights, used }; });
  ok('звонарь звонит почти в каждом бою (≥ 5 из 6)', R.fights >= 5, R);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
