// 3 этаж: Ведьмин лес (4 × 4 в правом верхнем углу): шаги уходят в случайную сторону, пройденное не запоминается, выход и босс — случайно.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : JSON.stringify(extra)); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const res = await p.evaluate(() => {
    const out = {}, r = state.run;
    r.floor = 2; r.variant = 'goblin'; r.pos = { x: 10, y: 0 }; r.day = 3; r.act = 1; switchFloor();
    out.floor = r.floor;
    // геометрия: ровно 16 клеток в углу 27..30 × 0..3
    let n = 0, bad = 0; for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) { const inV = x >= 27 && y <= 3; if (inVoid(x, y) !== inV) bad++; if (inV) { n++; if (zoneAt(x, y).place.name !== 'Ведьмин лес') bad++; } else if (zoneAt(x, y).kind === 'zone' && zoneAt(x, y).place.name === 'Ведьмин лес') bad++; }
    out.n = n; out.geoBad = bad; out.portalOutside = !inVoid(15, 0) && !inVoid(30, 15);
    // предупреждение у зоны: «неприглядный туман»
    r.pos = { x: 24, y: 1 }; r.pending = null; dgUi.phase = 'move'; dgUi.target = { x: 25, y: 1 }; act('move'); out.fogFar = (r.log || []).slice(-3).some(l => /неприглядный туман/.test(l.t || l));
    r.pending = null; dgUi.phase = 'move'; dgUi.target = { x: 26, y: 1 }; act('move'); out.fogNear = (r.log || []).slice(-4).some(l => /неприглядный туман/.test(l.t || l));
    // вход снаружи — обычный шаг; внутри — случайный
    r.pos = { x: 26, y: 1 }; r.visited = [tkey(26, 1)]; dgUi.phase = 'move'; dgUi.target = { x: 27, y: 1 }; const before = r.visited.length; act('move');
    out.entered = r.pos.x === 27 && r.pos.y === 1 && voidHere(); out.notVisited = !r.visited.includes('27,1');
    out.runOff = (() => { rerender(); const bt = document.querySelector('[data-act="run"]'); return !bt || bt.disabled; })();
    const dirs = new Set(), poss = new Set(); let exits = 0, boss = 0, escaped = 0, inside = 0;
    for (let i = 0; i < 400; i++) {
      r.pos = { x: 28, y: 1 }; r.day = 3; r.act = 1; r.pending = null; dgUi.res = null; dgUi.enc = null; dgUi.phase = 'move';
      const from = { ...r.pos }; dgUi.target = { x: 28, y: 0 }; act('move');
      dirs.add((r.pos.x - from.x) + ',' + (r.pos.y - from.y));
      if (!voidHere()) exits++; if (tkey(r.pos.x, r.pos.y) === F3_VOID.boss) boss++;
    }
    out.dirs = dirs.size;
    // длинное блуждание: рано или поздно выходит или встречает босса; позиция всегда в этаже; стадия не помнит пройденного
    let totalSteps = 0, outs = 0, bosses = 0; const stageOk = [];
    for (let w = 0; w < 30; w++) {
      r.pos = { x: 28, y: 1 }; r.pending = null; dgUi.res = null; r.day = 3; r.act = 1; let steps = 0;
      while (voidHere() && steps < 400) { dgUi.phase = 'move'; dgUi.target = { x: r.pos.x + 1, y: r.pos.y }; act('move'); steps++; if (dgUi.res) { bosses++; dgUi.res = null; } if (state.run.day > 20) { state.run.day = 3; } r.act = 1; r.pending = null; dgUi.enc = null; if (!inBounds(r.pos.x, r.pos.y)) { out.oob = true; break; } }
      totalSteps += steps; if (!voidHere()) outs++;
    }
    out.outs = outs; out.bosses = bosses; out.avg = Math.round(totalSteps / 30);
    // вид внутри: нет памяти (ни одного посещённого тайла внутри), в журнале сообщения о входе и выходе
    out.noMemory = !r.visited.some(k => { const [x, y] = k.split(',').map(Number); return inVoid(x, y); });
    r.pos = { x: 28, y: 1 }; location.hash = 'labyrinth'; dgUi.phase = 'menu'; dgUi.enc = null; dgUi.res = null; route();
    out.stageTiles = document.querySelectorAll('#dg-svg rect').length;
    out.log = (r.log || []).slice(-60).map(l => l.t || l).filter(s => /Ведьмин лес|Направление вернулось/.test(s)).length;
    // обычное движение вне зоны не затронуто
    r.pos = { x: 15, y: 15 }; dgUi.phase = 'move'; dgUi.target = { x: 16, y: 15 }; r.pending = null; act('move'); out.normal = r.pos.x === 16 && r.pos.y === 15;
    return out;
  });
  ok('3 этаж', res.floor === 3);
  ok('зона ровно 16 клеток в правом верхнем углу (27–30 × 0–3), порталы снаружи', res.n === 16 && res.geoBad === 0 && res.portalOutside, res);
  ok('вход в зону — обычный шаг, пройденное не запоминается', res.entered && res.notVisited && res.noMemory, res);
  ok('у границы Ведьмина леса — «впереди неприглядный туман» (не раньше)', res.fogNear && !res.fogFar, [res.fogNear, res.fogFar]);
  ok('бег внутри зоны отключён', res.runOff);
  ok('внутри направление случайное (все 4 стороны)', res.dirs >= 4, res.dirs);
  ok('блуждание заканчивается: выход бывает, до центра тоже доходят', res.outs >= 20 && res.bosses >= 1, [res.outs, res.bosses, res.avg]);
  ok('позиция остаётся внутри этажа', !res.oob);
  ok('вне зоны движение обычное', res.normal);
  ok('в журнале есть сообщения о Ведьмин лес', res.log >= 1, res.log);
  await p.evaluate(() => { const r = state.run; r.pending = null; r.queue = []; dgUi.enc = null; dgUi.res = null; dgUi.phase = 'menu'; r.pos = { x: 28, y: 1 }; rerender(); });
  await L.shot(p, 'void_stage');
  ok('нет ошибок страницы', p.errs.length === 0, p.errs.slice(0, 3));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x.ok).length, JSON.stringify({ avg: res.avg, outs: res.outs, bosses: res.bosses }));
  await b.close();
})();
