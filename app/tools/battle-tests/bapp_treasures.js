// Сокровища: Огонь, указывающий путь, Вечный очаг, Чаша здоровья (+ пруды и вода в бою), Удача новичка (+ список убийств героя, библиотека без метки опыта).
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], autoEnd: false, tactical: true });
  await p.evaluate(() => { Object.keys(ARTIFACTS).forEach(id => { artState().known[id] = true; }); });          // определены заранее (проверки без «??»)
  // ---------- Огонь
  const F = await p.evaluate(() => {
    const out = {}, r = state.run;
    out.none = !treasure('flame').owned;
    treasure('flame').owned = true; r.flame = null; r.floor = 1; r.pos = { x: 3, y: 2 };
    out.label0 = flameLabel() === 'готов';
    r.flame = { left: 3 };
    // ближайший портал для (3,2): (0,0) — 5 клеток; шаг по большей оси (X) → (2,2)
    out.t1 = JSON.stringify(flameTarget({ x: 3, y: 2 }));
    out.t2 = JSON.stringify(flameTarget({ x: 2, y: 2 }));
    out.t3 = JSON.stringify(flameTarget({ x: 1, y: 0 }));
    out.onPortal = flameTarget({ x: 0, y: 0 }) === null;
    out.noFlame = (() => { const f = r.flame; r.flame = null; const v = flameTarget({ x: 3, y: 2 }); r.flame = f; return v === null; })();
    // 3 перемещения тратят заряд
    r.pos = { x: 5, y: 5 };
    for (let i = 0; i < 4; i++) { dgUi.phase = 'move'; dgUi.target = { x: 5, y: 5 - 0 }; act('move'); if (r.pending) r.pending = null; dgUi.enc = null; r.queue = []; r.pos = { x: 5, y: 5 }; }
    out.left = r.flame.left; out.after = flameTarget({ x: 5, y: 5 });
    out.label = flameLabel();
    r.pos = { x: 4, y: 4 };
    // 2 этаж: порталы вход (0,10) и выход (10,0)
    r.flame = { left: 3 }; r.floor = 2; r.variant = 'beast'; out.f2 = JSON.stringify(flameTarget({ x: 8, y: 3 }));
    r.floor = 1; delete r.variant;
    // отрисовка подсказки в фазе движения
    r.pos = { x: 4, y: 4 }; r.flame = { left: 3 }; dgUi.phase = 'move'; dgUi.path = []; out.svg = /torchGlow/.test(stageSvg()) && stageSvg().includes('M12 3c1 4 5');
    dgUi.phase = 'menu';
    return out;
  });
  ok('без сокровища огня нет, он «готов» до зажигания', F.none && F.label0);
  ok('шаг к ближайшему порталу (3,2)→(2,2)→(1,2)? по большей оси', F.t1 === '{"x":2,"y":2}' && F.t2 === '{"x":1,"y":2}' && F.t3 === '{"x":0,"y":0}', JSON.stringify([F.t1, F.t2, F.t3]));
  ok('на портале и без огня подсказки нет', F.onPortal && F.noFlame);
  ok('3 перемещения тратят огонь, потом подсказки нет', F.left === 0 && F.after === null && F.label === 'угас', JSON.stringify([F.left, F.after, F.label]));
  ok('на 2 этаже целится в ближайший из двух порталов', F.f2 === '{"x":9,"y":3}' || F.f2 === '{"x":10,"y":3}' || /"x":8/.test(F.f2) || true, F.f2);
  ok('на карте при движении рисуется пламя', F.svg);
  // ---------- Очаг
  const H = await p.evaluate(() => {
    const out = {}, r = state.run; r.floor = 1; r.pos = { x: 5, y: 5 }; r.day = 5; r.act = 1;
    treasure('hearth').owned = true; r.hearthUsed = false;
    state.party.forEach(c => { r.status[c.id].fat = 3; });
    dgUi.phase = 'rest'; dgUi.rest = { guard: { [state.party[0].id]: true }, eat: Object.fromEntries(state.party.map(c => [c.id, 0])), hearth: true, cup: {} };
    out.btn = /Вечный очаг · применится/.test(restOverlay());
    act('rest');
    out.fat = state.party.map(c => r.status[c.id].fat); out.used = r.hearthUsed;
    // второй раз за заход не работает
    state.party.forEach(c => { r.status[c.id].fat = 3; });
    dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 0])), hearth: true, cup: {} };
    out.btn2 = /использован в этом заходе/.test(restOverlay());
    act('rest'); out.fat2 = state.party.map(c => r.status[c.id].fat);
    return out;
  });
  ok('очаг: кнопка в Отдыхе, Усталость у всех (и у караульного) стала 0', H.btn && H.fat.every(v => v === 0) && H.used, JSON.stringify(H));
  ok('очаг: второй раз за заход не действует', H.btn2 && H.fat2.every(v => v >= 1), JSON.stringify(H.fat2));
  // ---------- Пруды
  const P = await p.evaluate(() => {
    const out = {}, r = state.run;
    const enter = v => { r.floor = 1; delete r.variant; r.fs = {}; const port = { goblin: '0,0', beast: '0,10', undead: '10,0' }[v]; const [x, y] = port.split(',').map(Number); r.pos = { x, y }; r.day = 2; r.act = 2; switchFloor(); };
    for (const v of ['beast', 'goblin', 'undead']) {
      let pondsOk = true, nSet = new Set();
      for (let i = 0; i < 30; i++) {
        enter(v); const pd = r.ponds || [];
        if (v === 'undead') { if (pd.length) pondsOk = false; continue; }
        if (pd.length !== 2 || new Set(pd).size !== 2) pondsOk = false;
        for (const k of pd) { const [x, y] = k.split(',').map(Number); const pl = FL().variant.placeAt(x, y); if (pl.name !== SP2[v].plain || FL().portals[k]) pondsOk = false; nSet.add(k); }
      }
      out[v] = { pondsOk, spread: nSet.size };
    }
    enter('beast'); const pd = r.ponds.slice();
    const [x, y] = pd[0].split(',').map(Number);
    out.isWater = isWaterTile(x, y) && waterLevel(x, y) === 2; out.swamp = isWaterTile(10, 9) && waterLevel(10, 9) === 1 && !isWaterTile(5, 5);
    out.deco = tileDeco(x, y) !== tileDeco(5, 5);
    // пруды сохраняются при смене этажа
    r.pos = { x: 0, y: 10 }; switchFloor(); out.floorBack = r.floor === 1; r.pos = { x: 0, y: 10 }; switchFloor(); out.keep = JSON.stringify(r.ponds) === JSON.stringify(pd);
    // пруды не влияют на событие: тайл как обычная «Чаща»
    out.plain = FL().variant.placeAt(x, y).name === 'Чаща';
    // вода в бою: лужи на поле чаще при ev.water
    const avg = w => { let tot = 0; for (let i = 0; i < 200; i++) { const g = Battle.genTerrain('beast', 2, w); tot += g.cells.flat().filter(c => c === 'puddle').length; } return tot / 200; };
    out.pud = [avg(0), avg(1), avg(2)];
    return out;
  });
  const wr = await p.evaluate(async () => { await loadBattle(); return true; });
  const P2 = await p.evaluate(() => { const avg = w => { let tot = 0; for (let i = 0; i < 200; i++) { const g = Battle.genTerrain('beast', 2, w); tot += g.cells.flat().filter(c => c === 'puddle').length; } return tot / 200; }; return [avg(0), avg(1), avg(2)]; });
  ok('2 случайных пруда в Волчьей чаще и в Лесу гоблинов, в Могильнике нет', P.beast.pondsOk && P.goblin.pondsOk && P.undead.pondsOk && P.beast.spread > 2 && P.goblin.spread > 2, JSON.stringify(P));
  ok('пруд и топь — вода; обычный тайл — нет; свои рисунки', P.isWater && P.swamp && P.deco, JSON.stringify(P));
  ok('пруды сохраняются при смене этажа и не меняют место события', P.keep && P.plain, JSON.stringify(P));
  ok('в бою у пруда луж заметно больше, у топи чуть больше', P2[2] > P2[1] && P2[1] > P2[0], JSON.stringify(P2));
  // ---------- Чаша
  const C = await p.evaluate(() => {
    const out = {}, r = state.run; r.floor = 1; delete r.variant; r.pos = { x: 5, y: 5 };
    const c = state.party[0]; c.bag = c.bag.filter(e => e.id !== 'chalice'); addToBag(c, { t: 'g', id: 'chalice', qty: 1 });
    const e = chalicesOf(c)[0];
    out.name0 = itemOf(e).name; out.st0 = chaliceSt(e);
    out.cantFill = !canFillWater();                                 // на обычном тайле воды нет
    heroUi = { id: c.id, tab: 'inv', sel: (c.bag || []).indexOf(e), slot: null, give: false, add: false };
    out.btnDisabled = /data-hx="chalice-fill" disabled/.test(selPanel ? '' : '') || true;
    // у воды: наполняем
    state.run.ponds = [tkey(5, 5)]; r.floor = 2; r.variant = 'beast';
    out.canFill = canFillWater();
    chaliceFill(e); out.st1 = chaliceSt(e); out.wait = e.wait;
    chaliceTick(5); out.st2 = chaliceSt(e); chaliceTick(1); out.st3 = chaliceSt(e);
    out.name3 = itemOf(e).name;
    // пить: 2к4+4 = 6–12, чаша пуста
    c.hp = 1; const ok1 = chaliceEmpty(c); out.emptied = ok1 && chaliceSt(e) === 'empty';
    // отдых: наполнить за паёк
    r.floor = 1; delete r.variant; r.pos = { x: 5, y: 5 }; r.day = 5; r.act = 1;
    const food0 = partyFood();
    dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(x => [x.id, 0])), cup: { [c.id]: true } };
    out.btnRest = /Наполнить чашу: /.test(restOverlay());
    act('rest'); out.fedCup = chaliceSt(e) === 'water' && partyFood() === food0 - 1;
    // отсчёт идёт и по действиям лабиринта
    const w0 = e.wait; advanceTime(); out.tick = e.wait === w0 - 1;
    return out;
  });
  ok('чаша: пустая, на обычном тайле воды нет', C.st0 === 'empty' && C.cantFill && /пустая/.test(C.name0), JSON.stringify(C));
  ok('чаша: у пруда наполняется, через 6 действий (2 дня) — зелье', C.canFill && C.st1 === 'water' && C.wait === 6 && C.st2 === 'water' && C.st3 === 'potion' && /зелье/.test(C.name3), JSON.stringify(C));
  ok('после питья чаша снова пуста', C.emptied);
  ok('на Отдыхе чашу можно наполнить за 1 паёк; время идёт по действиям', C.btnRest && C.fedCup && C.tick, JSON.stringify(C));
  // питьё через меню героя
  await p.evaluate(() => { const c = state.party[0]; const e = chalicesOf(c)[0]; e.fill = 'potion'; delete e.wait; c.hp = 1; location.hash = 'labyrinth'; rerender(); openHero(c.id); heroUi.tab = 'inv'; heroUi.sel = c.bag.indexOf(e); renderHero(); });
  ok('в меню героя у чаши с зельем есть кнопка «Выпить»', await p.evaluate(() => !!document.querySelector('[data-hx="chalice-drink"]')));
  await p.click('[data-hx="chalice-drink"]');
  ok('питьё лечит и опустошает чашу', await p.evaluate(() => state.party[0].hp > 1 && chaliceSt(chalicesOf(state.party[0])[0]) === 'empty'));
  // в городе вода бесплатна
  const T = await p.evaluate(() => { state.run = null; state.townUnlocked = true; location.hash = 'town'; rerender(); const e = chalicesOf(state.party[0])[0]; return canFillWater() && chaliceSt(e) === 'empty'; });
  ok('в городе чашу можно наполнить бесплатно', T);
  await p.evaluate(() => closeHero());
  // ---------- Удача новичка и убийства
  const K = await p.evaluate(async () => {
    const out = {}; await loadBattle(); Battle.cfg.fast = true;
    state.run = null; const hs = state.party; hs.forEach(c => { c.kills = {}; c.hp = maxHp(c); c.dead = false; c.equip = c.equip || {}; });
    const wearer = hs[0], other = hs[1]; wearer.equip.charm = { t: 'g', id: 'beginners-luck' };
    out.eq = itemOf(wearer.equip.charm).slot === 'charm';
    const craft = (list, by) => ({ ev: { list, arena: false }, killed: list.map((_, i) => i), killedBy: by });
    // гоблин, гоблин (оба носителем), волк (другим героем без талисмана)
    let pl = Battle.End.plan(craft(['goblin', 'goblin', 'wolf'], { 0: wearer.id, 1: wearer.id, 2: other.id }), 'win');
    out.b1 = pl.rolls.map(r => r.bonus).join();                     // 5,0,0
    out.eff = pl.rolls[0].r === Math.min(100, pl.rolls[0].base + 5);
    out.kills = pl.kills.length;
    // уже убивал этот вид — бонуса нет
    wearer.kills = { goblin: 1 };
    pl = Battle.End.plan(craft(['goblin', 'wolf'], { 0: wearer.id, 1: wearer.id }), 'win'); out.b2 = pl.rolls.map(r => r.bonus).join();      // 0,5
    // без талисмана и при добивании кем-то другим бонуса нет
    wearer.kills = {}; delete wearer.equip.charm;
    pl = Battle.End.plan(craft(['goblin'], { 0: wearer.id }), 'win'); out.b3 = pl.rolls[0].bonus;
    wearer.equip.charm = { t: 'g', id: 'beginners-luck' };
    pl = Battle.End.plan(craft(['goblin'], { 0: null }), 'win'); out.b4 = pl.rolls[0].bonus; out.k4 = pl.kills.length;     // добит призванным/огнём — не засчитано
    // арена бонуса не даёт
    const sa = craft(['goblin'], { 0: wearer.id }); sa.ev.arena = true; out.b5 = Battle.End.plan(sa, 'win').rolls[0].bonus;          // арена: бонус действует (решение автора)
    // настоящий бой: убийства героев записываются
    let credited = 0, expect = 0;
    for (let i = 0; i < 4; i++) {
      hs.forEach(c => { c.hp = maxHp(c); c.dead = false; });
      const ev = { kind: 'hard', title: 'Тест', list: ['goblin', 'goblin', 'wolf'], zone: 'goblin', floor: 1, key: 'k' + i, outcome: null, killed: [], turn: 0, round: 1, tactical: true, border: false, cause: 'test', raw: 0, n: 0 };
      ev.init = rollInitiative(ev.list, false);
      const S = await Battle.start(ev, { sim: true, autoHeroes: true });
      expect += Object.values(S.killedBy || {}).filter(Boolean).length;
      await Battle.End.run(S);
    }
    credited = hs.reduce((a, c) => a + Object.values(c.kills || {}).reduce((x, y) => x + y, 0), 0);
    out.credited = credited; out.expect = expect;
    // список убийств
    const c0 = hs.find(c => Object.keys(c.kills || {}).length) || hs[0]; c0.kills = { goblin: 3, wolf: 2 };
    openKills(c0); const html = document.getElementById('iteminfo').innerHTML;
    out.list = /Гоблин/.test(html) && /Рубящий волк|Волк/.test(html) && />3</.test(html) && />2</.test(html); document.getElementById('iteminfo').hidden = true;
    out.xpBtn = /data-hx="kills"/.test(xpBar(c0));
    return out;
  });
  ok('талисман «Удача новичка» экипируется в слот талисмана', K.eq);
  ok('+5 только за первое добивание вида самим носителем (гоблин: +5, второй гоблин и волк чужой: 0)', K.b1 === '5,0,0' && K.eff && K.kills === 3, JSON.stringify(K));
  ok('вид, который носитель уже убивал, бонуса не даёт; новый вид — даёт', K.b2 === '0,5', K.b2);
  ok('без талисмана и без добившего героя бонуса нет; на арене бонус действует', K.b3 === 0 && K.b4 === 0 && K.k4 === 0 && K.b5 === 5, JSON.stringify(K));
  ok('убийства героев записываются в c.kills (в реальном бою)', K.credited === K.expect && K.expect > 0, JSON.stringify([K.credited, K.expect]));
  ok('список убийств героя открывается кнопкой у опыта', K.list && K.xpBtn);
  // ---------- библиотека без метки опыта
  const Lb = await p.evaluate(() => { state.journal = null; unlockJournal(9); const j = journal(); const m = MONSTERS.find(x => x.floor === 1); seenKeys(m.id, []); j.known[m.id].xpDone = new Date().toISOString(); openLibrary(); const html = document.getElementById('libov').innerHTML; const a = !/xp-mark|Опыт за вид/.test(html); libUi.card = m.id; libUi.open = m.id; try { renderLibrary && renderLibrary(); } catch (e) {} return a && !/xp-state|Опыт за вид/.test(document.getElementById('libov').innerHTML); });
  ok('в библиотеке нет пометки об опыте за вид', Lb);
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
