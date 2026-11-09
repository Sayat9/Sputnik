// 09.11: крот-исполин зарывается (раненый и окружённый), выныривает в начале хода с преимуществом; ИИ монстров 7–6 класса применяет способности.
const L = require('./bui_lib.js');
(async () => { const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], tactical: true, level: 6 });
  const R = await p.evaluate(async () => { await loadBattle(); const B = Battle; B.cfg.fast = true; const r = {};
    const S = B.newBattle({ kind: 'hard', title: 't', list: ['giant-mole'], zone: 'beast', floor: 2, key: 'm', killed: [], tactical: true }); S.phase = 'fight'; S.round = 3;
    const u = S.units.find(x => x.side === 'mon'), hs = S.units.filter(x => x.side === 'hero'); S.objs = [];
    u.x = 3; u.y = 3; hs[0].x = 5; hs[0].y = 3; hs[1].x = 2; hs[1].y = 3; hs[2].x = 3; hs[2].y = 6;
    u.hp = Math.floor(u.maxHp * 0.3); u.t = { action: 1, bonus: 1, react: 1, move: 4 }; S.torch = false;
    await B.AI.takeTurn(u); r.dug = !!B.has(u, 'underground');
    await B.hookAllAsync(u, 'turnStartAsync', {}); r.up = !B.has(u, 'underground') && !!B.has(u, 'emerged');
    // способности по баллу: волколак при враге рядом выбирает призыв, а не удар
    const S2 = B.newBattle({ kind: 'hard', title: 't', list: ['werewolf'], zone: 'beast', floor: 2, key: 'w', killed: [], tactical: true }); S2.phase = 'fight';
    const w = S2.units.find(x => x.side === 'mon'), h = S2.units.find(x => x.side === 'hero'); w.x = 3; w.y = 3; h.x = 4; h.y = 3; w.t = { action: 1, bonus: 1, react: 1, move: 4 };
    const a1 = B.AI.bestAction(w, B.AI.profileOf(w)); r.ww = a1 && a1.kind + ':' + (a1.id || '');
    return r; });
  ok('раненый окружённый крот зарывается', R.dug, R);
  ok('в начале хода выныривает (первый удар с преимуществом)', R.up, R);
  ok('волколак зовёт волков, а не бьёт', R.ww === 'ability:werewolf', R);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
