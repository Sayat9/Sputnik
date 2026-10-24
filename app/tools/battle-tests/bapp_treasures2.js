// Игральные кубики, Серебряный колокольчик, Фляга странника, «Ещё раз», библиотека артефактов, определение в Башне магов, таблица находки сокровища (к20), очаг 9 класса.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], autoEnd: false, tactical: true });
  // ---------- классы и «??»
  const A = await p.evaluate(() => {
    const out = {}, r = state.run;
    out.hearth9 = TREASURES.hearth.cls === 9 && ARTIFACTS.hearth.cls === 9;
    out.cls = Object.entries(ARTIFACTS).map(([id, a]) => id + ':' + a.cls).join();
    state.artifacts = null; artSync();
    out.noneSeen = Object.keys(artState().seen).length === 0;
    giveTreasure('dice'); addToBag(state.party[0], { t: 'g', id: 'chalice', qty: 1 }); addToBag(state.party[0], { t: 'g', id: 'once-more', qty: 2 });
    out.seen = ['dice', 'chalice', 'once-more'].every(id => artState().seen[id]);
    out.name = artName('dice') === '??' && !artKnown('dice');
    const e = state.party[0].bag.find(x => x.id === 'chalice'); out.masked = itemOf(e).name === '??' && /Башне магов/.test(itemOf(e).note);
    out.maskedOnce = itemOf({ t: 'g', id: 'once-more' }).name === '??';
    return out;
  });
  ok('Вечный очаг — 9 класс', A.hearth9, A.cls);
  ok('артефакты попадают в библиотеку при получении (сокровище и предмет), название «??» и скрытое описание', A.noneSeen && A.seen && A.name && A.masked && A.maskedOnce, JSON.stringify(A));
  // ---------- библиотека артефактов
  await p.evaluate(() => { location.hash = 'labyrinth'; rerender(); openLibrary(); libUi.tab = 'artifacts'; renderLibrary(); });
  const Lb = await p.evaluate(() => ({ cards: document.querySelectorAll('#libov .mbox[data-lx="art"]').length, names: [...document.querySelectorAll('#libov .mbox[data-lx="art"] b')].map(x => x.textContent), ico: document.querySelectorAll('#libov .art-ico svg').length, tabs: [...document.querySelectorAll('#libov .lib-tabs [role=tab]')].map(x => x.textContent).join('|') }));
  ok('вкладка «Артефакты» показывает картинки и «??» без свойств', Lb.cards === 3 && Lb.names.every(n => n === '??') && Lb.ico === 3 && /Монстры\|Артефакты/.test(Lb.tabs), JSON.stringify(Lb));
  await p.click('#libov .mbox[data-lx="art"]');
  ok('карточка неопределённого артефакта: «??» и цена определения, эффекта нет', await p.evaluate(() => { const h = document.getElementById('iteminfo').innerHTML; return /\?\?/.test(h) && /Башне магов за 20/.test(h) && !/перебросить/.test(h); }));
  await p.evaluate(() => { document.getElementById('iteminfo').hidden = true; closeLibrary(); });
  // ---------- Башня магов: определение за деньги
  await p.evaluate(() => { state.run = null; state.townUnlocked = true; state.party.forEach(c => { c.gold = 0; }); state.party[0].gold = 25; location.hash = 'town'; rerender(); });
  await p.click('[data-bld="tower"]'); await p.waitForSelector('.tw-tabs');
  await p.click('[data-t="ttab"][data-k="art"]');
  const T = await p.evaluate(() => ({ rows: document.querySelectorAll('.tw-row').length, btns: [...document.querySelectorAll('[data-t="aid"]')].map(x => x.textContent.trim()) }));
  ok('в башне 3 неопределённых артефакта: 9 класс по 20, 8 класс (чаша) 80', T.rows === 3 && T.btns.join() === '20,20,80', JSON.stringify(T));
  await p.click('[data-t="aid"][data-id="dice"]');
  const T2 = await p.evaluate(() => ({ known: artKnown('dice'), gold: partyGold(), name: artName('dice'), sees: /Игральные кубики/.test(document.querySelector('.tw-rows').innerText) }));
  ok('определение списывает 20 монет и открывает название и свойства', T2.known && T2.gold === 5 && T2.name === 'Игральные кубики' && T2.sees, JSON.stringify(T2));
  ok('не хватает монет — кнопки недоступны', await p.evaluate(() => [...document.querySelectorAll('[data-t="aid"]')].every(b => b.disabled)));
  await p.click('[data-t="close"]');
  // ---------- таблица находки сокровища
  const D = await p.evaluate(() => {
    const out = {}, byD = {};
    state.run = null;
    for (let d = 1; d <= 20; d++) {
      state.party.forEach(c => { c.bag = []; c.equip = {}; }); state.sack = null; state.inventory = null; state.artifacts = null;
      const r = treasureRoll(d); byD[d] = { lines: r.lines.join('|'), sack: sackTotal(), bag: state.party.flatMap(c => c.bag.map(e => e.id + ':' + e.t)).join(), tr: Object.keys(TREASURES).filter(id => treasure(id).owned).join(), c8: (sack().items['c:8'] || { qty: 0 }).qty };
    }
    out.stones = [1, 8].map(d => byD[d].sack); out.c8 = [1, 8].map(d => byD[d].c8);
    out.sup = [9, 10, 11, 12, 13].map(d => byD[d].sack === 0 && byD[d].tr === '');
    out.armor = [14, 15, 16].every(d => /:a/.test(byD[d].bag));
    out.weapon = /:w/.test(byD[17].bag);
    out.t9 = [18, 19].every(d => (byD[d].tr && TREASURES[byD[d].tr].cls === 9) || /once-more/.test(byD[d].bag));
    out.t8 = (byD[20].tr && TREASURES[byD[20].tr].cls === 8) || /chalice|beginners-luck|flask/.test(byD[20].bag);
    out.byD = byD; return out;
  });
  ok('1 → 10 камней (без 8 класса), 8 → 15 камней (8 из них 8 класса)', D.stones[0] === 10 && D.stones[1] === 15 && D.c8[0] === 0 && D.c8[1] === 8, JSON.stringify([D.stones, D.c8]));
  ok('9–13 расходники, 14–16 броня, 17 оружие', D.sup.every(Boolean) && D.armor && D.weapon, JSON.stringify([D.sup, D.byD[14], D.byD[17]]));
  ok('18–19 — сокровище 9 класса, 20 — сокровище 8 класса', D.t9 && D.t8, JSON.stringify([D.byD[18], D.byD[19], D.byD[20]]));
  const D2 = await p.evaluate(() => {
    const cnt = {}; for (let i = 0; i < 3000; i++) { state.party.forEach(c => { c.bag = []; c.equip = {}; }); state.sack = null; state.inventory = null; state.artifacts = null; const r = treasureRoll(); cnt[r.d] = (cnt[r.d] || 0) + 1; }
    return { spread: Object.keys(cnt).length };
  });
  ok('все 20 исходов выпадают', D2.spread === 20, JSON.stringify(D2));
  const D3 = await p.evaluate(() => {
    state.party.forEach(c => { c.bag = []; c.equip = {}; }); state.sack = null; Object.keys(TREASURES).forEach(id => { treasure(id).owned = true; });
    addToBag(state.party[0], { t: 'g', id: 'chalice', qty: 1 }); addToBag(state.party[0], { t: 'g', id: 'beginners-luck', qty: 1 });
    const a = treasureRoll(18), b = treasureRoll(20);
    return { a: a.lines.join('|'), b: b.lines.join('|'), once: countGear(state.party[0], 'once-more') };
  });
  ok('если все сокровища уже есть, выдаётся «Ещё раз»', D3.once >= 2 && /неопознан/.test(D3.a), JSON.stringify(D3));
  // ---------- Кубики, колокольчик, фляга в лабиринте
  await p.evaluate(() => { location.hash = 'labyrinth'; rerender(); });
  const X = await p.evaluate(() => {
    const out = {}, r = state.run || (newRun(), state.run); r.floor = 1; r.pos = { x: 5, y: 5 }; r.day = 2; r.act = 1; r.cd = {}; r.pending = null; dgUi.enc = null;
    state.party.forEach(c => { c.hp = maxHp(c); c.dead = false; });
    ['dice', 'bell', 'flask'].forEach(id => { giveTreasure(id); artState().known[id] = true; });
    // кубики: нужна выбранная цифра, показывают событие, перебрасывают, откат 6 действий
    askRoll('move'); r.pending.pick = 3; const html1 = rollOverlay();
    out.preview = /Выпало: <b[^>]*>Тяжёлая встреча/.test(html1);
    out.btnOn = !/data-dg="dice-reroll" disabled/.test(html1);
    const left0 = cdLeft('dice', 6); out.cd0 = left0;
    // перебросить
    const skip = n => { const tt = (r.day - 1) * 3 + r.act - 1 + n; r.day = 1 + Math.floor(tt / 3); r.act = 1 + tt % 3; };
    out.rerollManual = (() => { const pn = r.pending; if (trReady('dice')) { pn.pick = null; cdSet('dice'); } return pn.pick === null && cdLeft('dice', 6) === 6; })();
    r.pending.pick = 3; out.btnOff = /data-dg="dice-reroll" disabled/.test(rollOverlay());
    out.cdText = cdText('dice');
    // откат идёт по действиям карты
    skip(5); out.cd5 = cdLeft('dice', 6); skip(1); out.cd6 = cdLeft('dice', 6); out.ready = trReady('dice');
    r.pending = null;
    // колокольчик: засада → обычная встреча, откат
    const e1 = { ambush: true, cause: 'move', title: 'Засада!' }; out.bell1 = bellSave(e1) && e1.ambush === false && e1.bell;
    const e2 = { ambush: true, cause: 'move', title: 'Засада!' }; out.bell2 = bellSave(e2) === false && e2.ambush === true;
    skip(6); const e3 = { ambush: true, cause: 'pass', title: 'x' }; out.bell3 = bellSave(e3) && !e3.ambush;
    const e4 = { ambush: false, cause: 'move', title: 'y' }; skip(6); out.bell4 = bellSave(e4) === false && trReady('bell');
    return out;
  });
  ok('кубики: показывают выпавшее событие и перебрасывают', X.preview && X.btnOn && X.rerollManual, JSON.stringify(X));
  ok('кубики: откат 6 действий на карте', X.cd0 === 0 && X.btnOff && X.cd5 === 1 && X.cd6 === 0 && X.ready, JSON.stringify(X));
  ok('колокольчик: засада становится встречей, откат; без засады не тратится', X.bell1 && X.bell2 && X.bell3 && X.bell4, JSON.stringify(X));
  // настоящая засада в событии и в отдыхе без караула
  const Y = await p.evaluate(() => {
    const out = {}, r = state.run; r.cd = {}; r.day = 5; r.act = 1; r.pos = { x: 3, y: 3 };
    state.party.forEach(c => { r.status[c.id].fat = 0; });
    askRoll('move'); r.pending.pick = 1; resolveRoll(); const ev = dgUi.enc;
    out.ev = ev && ev.kind === 'ambush' && ev.bell === true && ev.ambush === false && /колокольчик/.test(ev.title);
    out.init = !!(ev && ev.init); out.cd = cdLeft('bell', 6) === 6;
    dgUi.enc = null; r.cleared = {};
    return out;
  });
  ok('колокольчик в настоящем событии «Засада» (к20 = 1)', Y.ev && Y.init && Y.cd, JSON.stringify(Y));
  // фляга: на отдыхе один паёк возвращается
  const Fl = await p.evaluate(() => {
    const out = {}, r = state.run; r.cd = {}; r.day = 5; r.act = 1; r.pos = { x: 3, y: 3 }; dgUi.enc = null; r.pending = null; r.queue = []; state.party.forEach(c => { c.bag = []; addToBag(c, { t: 'g', id: 'ration', qty: 7 }); });
    state.party.forEach(c => { r.status[c.id].fat = 0; r.status[c.id].sat = 0; });
    const c0 = state.party[0], f0 = partyFood();
    dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 0])), flask: true, cup: {} }; dgUi.rest.eat[c0.id] = 2;
    out.btn = /Фляга странника · один паёк не тратится/.test(restOverlay());
    act('rest'); out.food = f0 - partyFood(); out.cd = cdLeft('flask', 6) > 0;
    // без еды (никто не ел) фляга не тратится
    r.cd = {}; r.pending = null; dgUi.enc = null; r.queue = [];
    dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 0])), flask: true, cup: {} }; act('rest'); out.unused = cdLeft('flask', 6) === 0;
    // откат: пока идёт, кнопка недоступна
    cdSet('flask'); dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 0])), cup: {} }; out.btnOff = /data-dg="flask-toggle" aria-pressed="false" disabled/.test(restOverlay());
    dgUi.phase = 'menu'; dgUi.rest = null;
    return out;
  });
  ok('фляга: на Отдыхе тратится 1 паёк вместо 2, откат 6 действий', Fl.btn && Fl.food === 1 && Fl.cd, JSON.stringify(Fl));
  ok('фляга: без съеденных пайков не тратится; пока откат — кнопка недоступна', Fl.unused && Fl.btnOff, JSON.stringify(Fl));
  // ---------- удача: призванные и арена
  const K = await p.evaluate(async () => {
    const out = {}; await loadBattle(); const hs = state.party; hs.forEach(c => { c.kills = {}; c.equip = c.equip || {}; });
    const w = hs[0]; w.equip.charm = { t: 'g', id: 'beginners-luck' };
    // убийство призванным: засчитывается хозяину
    const S = { ev: { list: ['goblin'], arena: false }, killed: [0], killedBy: { 0: w.id } };
    out.plan = Battle.End.plan(S, 'win').rolls[0].bonus;
    // проверяем сам учёт: kill() от призванного
    await Battle.start({ list: ['goblin'], zone: 'goblin', floor: 1, killed: [] }, { sim: true, autoHeroes: true });
    const B = Battle, Sx = B.S, heroU = B.heroes()[0], mon = B.mons()[0];
    const wolf = Object.assign({}, B.baseUnit('hero'), { summon: true, owner: heroU.id, hero: null, alive: true, name: 'Волк' });
    B.S.units.push(wolf); const hid = heroU.hero.id;
    mon.alive = true; mon.hp = 1; B.kill(mon, wolf); out.byWolf = Sx.killedBy && Sx.killedBy[mon.idx] === hid;
    return out;
  });
  ok('Удача новичка: на арене бонус есть, убийство призванным засчитывается хозяину', K.plan === 5 && K.byWolf, JSON.stringify(K));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
