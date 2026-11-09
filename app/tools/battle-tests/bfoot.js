// 09.11: размеры на поле — 2×1 (медведь и др. длинные звери), 2×2 только гиганты, звонарь и рослые гуманоиды 1×1; бои с 2×1 идут без ошибок.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], tactical: true, level: 4 });
  const F = await p.evaluate(async () => { await loadBattle(); const B = Battle; const f = id => { const u = B.monUnit(id, 0); return [u.w || u.size, u.h || u.size, u.size]; };
    return { bear: f('dark-bear'), ringer: f('faceless-ringer'), mammoth: f('mammoth-calf'), knight: f('bone-knight'), kel: f('kel-worm'), wolf: f('wolf'), elk: f('stone-elk'), boar: f('mutant-boar'), sc: f('mirage-scorpion'), fp2: B.footprint({ x: 2, y: 3, w: 1, h: 2, size: 2 }), fp: B.footprint({ x: 2, y: 3, w: 2, h: 1, size: 2 }) }; });
  ok('медведь 2×1, класс «большой»', F.bear.join() === '2,1,2', F);
  ok('звонарь и костяной рыцарь 1×1', F.ringer.join() === '1,1,1' && F.knight.join() === '1,1,1', F);
  ok('мамонтёнок 2×2, Кель 2×2, волк 1×1', F.mammoth.join() === '2,2,2' && F.kel.join() === '2,2,2' && F.wolf.join() === '1,1,1', F);
  ok('каменный лось и вепрь 1×2 (длинные), скорпион 2×1 (широкий)', F.elk.join() === '1,2,2' && F.boar.join() === '1,2,2' && F.sc.join() === '2,1,2', F);
  ok('клетки 1×2', JSON.stringify(F.fp2) === '[[2,3],[2,4]]', F.fp2);
  ok('клетки 2×1', JSON.stringify(F.fp) === '[[2,3],[3,3]]', F.fp);
  const R = await p.evaluate(async () => { const out = {}; for (const list of [['dark-bear'], ['mutant-boar', 'goblin'], ['big-stinger', 'mirage-scorpion'], ['swamp-fang', 'deep-serpent'], ['mammoth-calf'], ['stone-elk', 'ice-deer'], ['toll-bull', 'lab-direwolf', 'goblin'], ['magma-wyrm', 'silent-predator']]) {
      const ev = { kind: 'hard', title: 't', list, zone: 'beast', floor: 2, key: 't', outcome: null, killed: [], turn: 0, round: 1, tactical: true };
      try { const r = await Battle.sim(ev); const S = r.S; const occ = new Set(); let overlap = false; for (const u of S.units.filter(u => u.alive && !u.dead)) for (const [x, y] of Battle.footprint(u)) { const k = x + ',' + y; if (occ.has(k)) overlap = true; occ.add(k); if (x < 0 || y < 0 || x >= Battle.W || y >= Battle.H) overlap = true; }
        out[list.join('+')] = { o: r.outcome, rounds: r.rounds, overlap }; } catch (e) { out[list.join('+')] = { err: String(e) }; } } return out; });
  ok('бои с 2×1 и 2×2 доходят до конца без ошибок и наложений', Object.values(R).every(x => !x.err && x.o && !x.overlap), R);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
