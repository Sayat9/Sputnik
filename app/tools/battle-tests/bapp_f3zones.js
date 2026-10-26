// 3 этаж: зона ловушек (капкан, растяжка, катящийся валун, проверка внимательности и Ловкости) и преследователь охотничьих угодий («???»).
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : JSON.stringify(extra)); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const res = await p.evaluate(() => {
    const out = {}, r = state.run;
    r.floor = 2; r.variant = 'goblin'; r.pos = { x: 10, y: 0 }; r.day = 3; r.act = 1; switchFloor();
    const rn = Math.random;
    const setStat = (k, v) => state.party.forEach(c => { c.base[k] = v; });
    const hpAll = () => state.party.map(c => hpOf(c));
    // ---- ловушки: генерация
    const G = f3Gen(true); r.f3 = G; const keys = Object.keys(G.traps);
    out.trapsInZone = keys.every(k => isTrapZone(...k.split(',').map(Number)));
    out.density = keys.length;
    let zoneCells = 0; for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) if (isTrapZone(x, y)) zoneCells++;
    out.zoneCells = zoneCells;
    out.types = new Set(keys.map(k => G.traps[k].t)).size;
    out.hidden = keys.every(k => G.traps[k].seen === false);
    out.boulders = G.boulders.length; out.boulderInZone = G.boulders.every(b => isTrapZone(b.x, b.y));
    out.defaultNone = Object.keys(f3Gen().traps).length === 0 && f3Gen().boulders.length === 0;
    out.monocle = (() => { treasure('monocle').owned = true; const g = f3Gen(true); r.f3 = g; f3Step(20, 5); f3Step(21, 5); const all = Object.values(g.traps).every(t => t.seen); const marks = (() => { g.traps = { '23,5': { t: 'bear', seen: false } }; g.boulders = []; return f3Marks(22, 5, (a, b, i) => i).length; })(); treasure('monocle').owned = false; const marks2 = f3Marks(22, 5, (a, b, i) => i).length; return { all, marks, marks2, art: !!ARTIFACTS.monocle && ARTIFACTS.monocle.cls === 8 && TREASURE_POOL[8].includes('monocle') && TREASURES.monocle.cls === 8 }; })();
    // ---- проверка внимательности при входе
    const percep = (wis, rand) => { setStat('wis', wis); Math.random = rand || rn; const g = f3Gen(true); r.f3 = g; r.pos = { x: 20, y: 5 }; r.pending = null; dgUi.res = null; f3Step(20, 5); const before = Object.values(g.traps).filter(t => t.seen).length; f3Step(21, 5); Math.random = rn; const seen = Object.values(g.traps).filter(t => t.seen).length, total = Object.keys(g.traps).length; return { seen, total, before }; };
    out.pAll = percep(60); out.pNone = percep(1, () => 0);
    let partial = 0; for (let i = 0; i < 80; i++) { const o = percep(10); if (o.seen > 0 && o.seen < o.total) partial++; }
    out.partial = partial; setStat('wis', 10);
    out.resShown = (() => { r.f3 = f3Gen(true); f3Step(20, 5); dgUi.res = null; f3Step(21, 5); return !!dgUi.res; })();
    // повторное нахождение в зоне — проверки нет
    out.noRepeat = (() => { r.f3 = f3Gen(true); f3Step(20, 5); f3Step(21, 5); dgUi.res = null; f3Step(22, 5); return !dgUi.res || !/внимательност/i.test(JSON.stringify(dgUi.res)) ; })();
    // ---- срабатывание: плохая Ловкость — урон, ловушка исчезает; хорошая — обошли, ловушка остаётся
    const trapTest = (type, dex, rand) => { setStat('dex', dex); const g = f3Gen(true); g.boulders = []; g.traps = { '23,5': { t: type, seen: false } }; g.inZone = true; r.f3 = g; state.party.forEach(c => { c.hp = maxHp(c); }); const hp0 = hpAll(); Math.random = rand; dgUi.res = null; f3Step(23, 5); Math.random = rn; return { dmg: hpAll().some((h, i) => h < hp0[i]), left: !!g.traps['23,5'], pen: g.pen || 0, res: dgUi.res && dgUi.res.title }; };
    out.bearHit = trapTest('bear', 1, () => 0); out.bearMiss = trapTest('bear', 60, () => 0.95);
    out.wireHit = trapTest('wire', 1, () => 0); out.wireMiss = trapTest('wire', 60, () => 0.95);
    setStat('dex', 12);
    // ---- валун: 2 клетки за действие, отскок от края зоны, удар
    const bt = (() => { const g = f3Gen(true); g.traps = {}; g.inZone = true; g.boulders = [{ x: 25, y: 7, dx: 0, dy: 1 }]; r.f3 = g; r.pos = { x: 22, y: 5 }; r.pending = null; const o = []; for (let i = 0; i < 4; i++) { f3AfterAction('move'); o.push([g.boulders[0].x, g.boulders[0].y]); } return o; })();
    out.boulderPath = JSON.stringify(bt);
    out.boulderStaysIn = bt.every(([x, y]) => isTrapZone(x, y));
    out.hit = (() => { setStat('dex', 1); const g = f3Gen(true); g.traps = {}; g.inZone = true; g.boulders = [{ x: 24, y: 5, dx: -1, dy: 0 }]; r.f3 = g; r.pos = { x: 22, y: 5 }; state.party.forEach(c => { c.hp = maxHp(c); }); const hp0 = hpAll(); Math.random = () => 0; dgUi.res = null; f3AfterAction('move'); Math.random = rn; setStat('dex', 12); return { dmg: hpAll().some((h, i) => h < hp0[i]), moved: r.pos.x !== 22, res: dgUi.res && dgUi.res.title }; })();
    // ---- видимость: ловушки подсвечены, валун в радиусе 3, хищник в радиусе 3
    const up = (cx, cy, inner) => inner;
    const g2 = f3Gen(true); g2.traps = { '23,5': { t: 'bear', seen: true }, '24,5': { t: 'wire', seen: false } }; g2.boulders = [{ x: 25, y: 5, dx: 1, dy: 0 }, { x: 30, y: 9, dx: 0, dy: 1 }]; g2.hunt.mon = null; r.f3 = g2;
    out.marks = f3Marks(22, 5, up).length;   // 1 ловушка (видна) + 1 валун (в радиусе)
    g2.hunt.mon = { x: 22, y: 8 }; const m3 = f3Marks(22, 5, up).length; g2.hunt.mon = { x: 22, y: 9 }; const m4 = f3Marks(22, 5, up).length; out.hunterRadius = [m3, m4];
    // ---- охотничьи угодья
    r.f3 = f3Gen(true); const H = r.f3.hunt; r.pos = { x: 5, y: 20 }; out.isHunt = isHunt(5, 20) && !isHunt(15, 28) && !isHunt(15, 15) && !isHunt(28, 1);
    for (let i = 0; i < 8; i++) f3AfterAction('move');
    out.before9 = !H.mon && H.acts === 8; f3AfterAction('move');
    out.spawned = !!H.mon; out.anim = !!H.anim; out.logLearn = (r.log || []).slice(-3).some(l => /учуял след/.test(l.t || l));
    const dist0 = f3Bfs(f3HuntRef(r.pos)); const d0 = dist0[tkey(H.mon.x, H.mon.y)], maxD = Math.max(...Object.values(dist0)); out.farthest = d0 === maxD; out.spawnDist = d0;
    out.onHunt = isHunt(H.mon.x, H.mon.y);
    // шаг в день: 1; отдых — 2; сообщения
    const day = (rested) => { r.pos = { x: 5, y: 20 }; r.act = 3; r.day = 3; if (rested) H.rested = true; const before = f3Bfs(f3HuntRef(r.pos))[tkey(H.mon.x, H.mon.y)]; advanceTime(); const after = H.mon ? f3Bfs(f3HuntRef(r.pos))[tkey(H.mon.x, H.mon.y)] : 0; return before - after; };
    out.step1 = day(false); out.step2 = day(true);
    out.logWalk = (r.log || []).slice(-6).some(l => /идёт по следу/.test(l.t || l)); out.logRun = (r.log || []).slice(-8).some(l => /бежит по следу/.test(l.t || l));
    // граница: отряд ушёл в другую зону — хищник ждёт у границы, внутрь не заходит
    r.pos = { x: 15, y: 28 }; let waited = true; const seenTiles = new Set();
    for (let i = 0; i < 40; i++) { r.act = 3; r.day = 3; H.rested = true; advanceTime(); if (!H.mon) { waited = false; break; } seenTiles.add(tkey(H.mon.x, H.mon.y)); if (!isHunt(H.mon.x, H.mon.y)) waited = false; }
    out.waitBorder = waited && H.mon && Math.abs(H.mon.x - 15) <= 5 && H.mon.y >= 23; out.waitPos = H.mon && [H.mon.x, H.mon.y];
    // догнал: контакт, сброс до 3 дней, следующий раз ближе и быстрее
    r.pos = { x: H.mon.x, y: H.mon.y }; if (!isHunt(r.pos.x, r.pos.y)) out.badRef = true; r.act = 3; r.day = 3; advanceTime(); f3Step(r.pos.x, r.pos.y);
    out.contact = H.kills >= 1 && H.mon === null && H.acts === 0 && H.need === 9; out.res = dgUi.res && dgUi.res.title;
    r.pos = { x: 5, y: 20 }; for (let i = 0; i < 9; i++) f3AfterAction('move'); const d1 = f3Bfs(f3HuntRef(r.pos))[tkey(H.mon.x, H.mon.y)];
    out.closer = d1 < d0; out.d0d1 = [d0, d1];
    const b1 = f3Bfs(f3HuntRef(r.pos))[tkey(H.mon.x, H.mon.y)]; r.act = 3; r.day = 3; advanceTime(); const a1 = H.mon ? f3Bfs(f3HuntRef(r.pos))[tkey(H.mon.x, H.mon.y)] : 0; out.faster = (b1 - a1) >= 2;
    return out;
  });
  ok('на самой карте ловушек и валунов по умолчанию нет (они будут только в комнатах)', res.defaultNone);
  ok('Монокль Амона (8 класс): раскрывает все ловушки без проверки, показывает скрытые', res.monocle.all && res.monocle.marks === 1 && res.monocle.marks2 === 0 && res.monocle.art, res.monocle);
  ok('ловушки только в зоне, скрыты изначально, несколько видов', res.trapsInZone && res.hidden && res.types === 2, res);
  ok('плотность около 40% клеток зоны', res.density > res.zoneCells * .25 && res.density < res.zoneCells * .55, [res.density, res.zoneCells]);
  ok('три валуна, все в зоне', res.boulders === 3 && res.boulderInZone);
  ok('внимательность: высокая — подсвечены все, низкая — ни одной, средняя — часть', res.pAll.seen === res.pAll.total && res.pNone.seen === 0 && res.partial > 5, [res.pAll, res.pNone, res.partial]);
  ok('проверка внимательности — при входе в зону, один раз', res.pAll.before === 0 && res.resShown && res.noRepeat, res);
  ok('капкан/растяжка при плохой Ловкости: урон и ловушка исчезает; при хорошей — обошли', res.bearHit.dmg && !res.bearHit.left && res.wireHit.dmg && !res.wireHit.left && !res.bearMiss.dmg && res.bearMiss.left && !res.wireMiss.dmg && res.wireMiss.left, [res.bearHit, res.bearMiss, res.wireHit, res.wireMiss]);
  ok('капкан держит: потеряно действие', res.bearHit.pen === 1 && res.wireHit.pen === 0, [res.bearHit.pen, res.wireHit.pen]);
  ok('валун катится на 2 клетки за действие и отскакивает от края зоны', res.boulderPath === JSON.stringify([[25, 9], [25, 7], [25, 5], [25, 3]]) && res.boulderStaysIn, res.boulderPath);
  ok('валун при контакте бьёт и отбрасывает', res.hit.dmg && res.hit.moved, res.hit);
  ok('подсвеченные ловушки и валун в радиусе видны, скрытая ловушка — нет', res.marks === 2, res.marks);
  ok('хищник виден в радиусе 3 и не виден дальше', res.hunterRadius[0] === res.marks + 1 && res.hunterRadius[1] === res.marks, [res.marks, res.hunterRadius]);
  ok('охотничьи угодья — между зонами', res.isHunt);
  ok('после 3 суток (9 действий) хищник появляется: анимация и «??? учуял след»', res.before9 && res.spawned && res.anim && res.logLearn, res);
  ok('появляется на самом дальнем охотничьем тайле', res.farthest && res.onHunt, [res.spawnDist]);
  ok('шаг: 1 в день, 2 если отряд отдыхал; сообщения «идёт/бежит по следу»', res.step1 === 1 && res.step2 === 2 && res.logWalk && res.logRun, [res.step1, res.step2, res.logWalk, res.logRun]);
  ok('если отряд в другой зоне, хищник ждёт у границы и в неё не заходит', res.waitBorder, res.waitPos);
  ok('догнал: окно, счётчик сброшен до 3 дней', res.contact && res.res, res);
  ok('в следующий раз появляется ближе и ходит быстрее', res.closer && res.faster, res);
  const integ = await p.evaluate(() => { const r = state.run; r.f3 = f3Gen(true); r.f3.boulders = []; delete r.f3.traps['21,5']; r.day = 3; r.act = 1; r.pos = { x: 20, y: 5 }; r.pending = null; dgUi.res = null; dgUi.enc = null; dgUi.phase = 'move'; dgUi.target = { x: 21, y: 5 }; let err = ''; try { act('move'); } catch (e) { err = String(e); } return { err, pos: [r.pos.x, r.pos.y], res: dgUi.res && dgUi.res.title, act: r.act }; });
  ok('настоящий шаг в зону ловушек: проверка внимательности, действие прошло', !integ.err && integ.pos[0] === 21 && /Зона ловушек/.test(integ.res || '') && integ.act === 2, integ);
  await p.evaluate(() => { const r = state.run; r.f3 = f3Gen(true); r.pos = { x: 5, y: 20 }; location.hash = 'labyrinth'; dgUi.phase = 'menu'; dgUi.res = null; dgUi.enc = null; r.pending = null; r.f3.hunt.anim = { x: 5, y: 5, until: Date.now() + 2600 }; r.f3.hunt.mon = { x: 6, y: 20 }; route(); });
  await p.waitForTimeout(500); await L.shot(p, 'f3_hunt_anim');
  const ui = await p.evaluate(() => ({ anim: !!document.querySelector('.hunt-anim'), txt: (document.querySelector('.hunt-anim') || {}).innerText }));
  ok('анимация появления (оверлей 2–3 с)', ui.anim && /учуял след/.test(ui.txt || ''), ui);
  await p.waitForTimeout(2600);
  ok('анимация исчезает сама', await p.evaluate(() => !document.querySelector('.hunt-anim')));
  ok('нет ошибок страницы', p.errs.length === 0, p.errs.slice(0, 3));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x.ok).length);
  await b.close();
})();
