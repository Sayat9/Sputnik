// Особые места 2 этажа: воронье гнездо и чернокрыл, Туманная часовня, нижние ярусы, паутина и паучиха, сокровища, белая пыль, неупокоенные.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const res = await p.evaluate(() => {
    window.__RND = Math.random; const RND = Math.random, out = {}, r = state.run, E = (list, outcome = 'win', killed) => ({ list, outcome, killed: killed || (outcome === 'win' ? list.map((_, i) => i) : []), key: tkey(r.pos.x, r.pos.y), round: 1, turn: 0, init: [] });
    const go = (variant, x, y, day = 3, act = 1) => { r.floor = 2; r.variant = variant; r.sp = null; r.tier = null; r.pos = { x, y }; r.day = day; r.act = act; r.cleared = {}; r.pending = null; r.queue = []; dgUi.enc = null; dgUi.res = null; r.light = false; state.party.forEach(c => { r.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; c.hp = maxHp(c); c.dead = false; }); return spOf(); };
    // --- инициализация
    let sp = go('beast', 5, 5);
    const near = (a, bb) => Math.max(Math.abs(a[0] - bb[0]), Math.abs(a[1] - bb[1])) <= 1;
    const plainAround = at => { const [x, y] = at.split(',').map(Number); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X > 10 || Y > 10) continue; if (FL().portals[tkey(X, Y)] || FLOOR2.beast.placeAt(X, Y).name !== 'Чаща') return false; } return true; };
    out.nestPlain = true; for (let i = 0; i < 30; i++) { sp = go('beast', 5, 5); if (!plainAround(sp.nest.at)) out.nestPlain = false; }
    out.webCount = Object.keys(sp.web).length === 9;
    sp = go('undead', 5, 5); out.chapelAt = !!sp.chapel.at && FLOOR2.undead.placeAt(...sp.chapel.at.split(',').map(Number)).name === 'Курганы';
    // --- гнездо: бой на тайле, последняя ворона выжила -> тайное окно 6 действий
    sp = go('beast', 5, 5); const [nx, ny] = sp.nest.at.split(',').map(Number); r.pos = { x: nx, y: ny };
    const f1 = spEnter(); out.nestFight = f1 && dgUi.enc && dgUi.enc.list.length >= 3 && dgUi.enc.list.length <= 4 && dgUi.enc.list.every(i => i === 'crow') && dgUi.enc.sp.k === 'nest';
    const e1 = dgUi.enc; e1.outcome = 'retreat'; e1.killed = e1.list.slice(1).map((_, i) => i + 1); finishFight();
    out.nestCd = sp.nest.st === 'cd' && sp.nest.fought === true; out.nestNoMsg = !r.log.some(l => /далёкие крики/.test(l.t));
    // окно: j = absAct - t0 - 1
    const t0 = sp.nest.t0; const setJ = j => { const a = t0 + 1 + j; r.day = Math.floor((a - 1) / 3) + 1; r.act = ((a - 1) % 3) + 1; };
    setJ(0); out.j0 = spWindow() === 0; setJ(1); out.j1 = spWindow() === 1;
    const mkEnc = () => ({ list: ['wolf', 'wolf', 'fox'], zone: 'beast' });
    let en = mkEnc(); spCrows(en); out.crow1 = en.list.filter(i => i === 'crow').length === 1 && en.list.length === 3;
    setJ(5); en = mkEnc(); spCrows(en); out.crow2 = en.list.filter(i => i === 'crow').length === 2 && en.list.length === 3;
    setJ(3); en = { list: ['werewolf', 'wolf'], zone: 'beast' }; spCrows(en); out.crowBoss = !en.list.includes('crow');
    r.pos = { x: 5, y: 5 }; r.log.length = 0;
    for (const j of [2, 4, 5]) { setJ(j); spAfter(); } out.msgs = ['далёкие крики', 'чёрных перьев', 'Небо смотрит'].every(t => r.log.some(l => l.t.includes(t)));
    setJ(6); spAfter(); out.bw = dgUi.enc && dgUi.enc.sp && dgUi.enc.sp.k === 'blackwing' && dgUi.enc.list[0] === 'blackwing' && dgUi.enc.list.filter(i => i === 'crow').length === 4 && r.log.some(l => l.t.includes('Хор криков'));
    const e2 = dgUi.enc; e2.outcome = 'win'; e2.killed = e2.list.map((_, i) => i); finishFight();
    out.bwDone = sp.nest.st === 'done'; 
    // все вороны убиты -> ничего не запускается
    sp = go('beast', nx, ny, 3, 1); sp = spOf(); { const [x, y] = sp.nest.at.split(',').map(Number); r.pos = { x, y }; }
    spEnter(); const e3 = dgUi.enc; e3.outcome = 'win'; e3.killed = e3.list.map((_, i) => i); finishFight(); out.nestAllDead = sp.nest.st === 'none';
    // --- «Ворона прилетела с ...»
    sp = go('beast', 5, 5); const nest = sp.nest.at.split(',').map(Number);
    const ev = { kind: 'hard', title: 'x', list: ['crow', 'wolf'] }; startFight(ev, { x: 5, y: 5 }, { zone: 'beast', list: ev.list }); out.crowDir = /Ворона прилетела с (севера|юга|запада|востока)/.test(ev.note || '');
    dgUi.enc = null;
    // --- чует кровь
    sp = go('beast', 5, 5); out.bloodNo = spBlood() === false; state.party[0].hp = 1; out.bloodYes = spBlood() === true; askRoll('move'); out.bloodFlag = r.pending.blood === true; r.pending = null; state.party[0].hp = maxHp(state.party[0]);
    sp = go('goblin', 5, 5); state.party[0].hp = 1; out.bloodGoblin = spBlood() === false; state.party[0].hp = maxHp(state.party[0]);
    // --- ярусы пещеры
    sp = go('beast', 0, 0, 3, 1); let bt = spButtons(); out.caveBtn = bt.some(x => x.id === 'tier-in:cave');
    dgUi.spDo = 'tier-in:cave'; act('sp'); out.cave1 = r.tier && r.tier.n === 1 && dgUi.enc && dgUi.enc.list.every(i => i === 'bat' || i === 'burrower') && dgUi.enc.list.length >= 3 && dgUi.enc.sp.k === 'tier';
    out.tierNoMove = spButtons().every(x => x.id.startsWith('tier') || x.id === 'steal' || x.id === 'take');
    const c1 = dgUi.enc; c1.outcome = 'win'; c1.killed = c1.list.map((_, i) => i); finishFight(); out.cave1Done = sp.tierDone.cave1 === true;
    dgUi.spDo = 'tier-next'; act('sp'); out.cave2 = r.tier.n === 2 && dgUi.enc && dgUi.enc.list.join() === 'dark-bear';
    const c2 = dgUi.enc; c2.outcome = 'win'; c2.killed = [0]; finishFight();
    dgUi.spDo = 'tier-next'; act('sp'); out.cave3 = r.tier.n === 3 && dgUi.enc.list.join() === 'giant-mole' && !spButtons().some(x => x.id === 'tier-next');
    out.treasureLocked = spButtons().some(x => x.id === 'steal');
    const c3 = dgUi.enc; c3.outcome = 'win'; c3.killed = [0]; finishFight(); out.treasureOpen = spButtons().some(x => x.id === 'take');
    const s7 = () => (sack().items['c:7'] || { qty: 0 }).qty, stones0 = s7();
    dgUi.spDo = 'take'; act('sp'); out.stones = s7() - stones0 >= 2; out.got = sp.got['b-cave'] === true; dgUi.res = null;
    dgUi.spDo = 'tier-prev'; act('sp'); dgUi.enc = null; out.cavePrev = r.tier.n === 2; dgUi.spDo = 'tier-prev'; act('sp'); dgUi.enc = null; dgUi.spDo = 'tier-prev'; act('sp'); out.caveExit = r.tier === null;
    // зачищенный ярус пуст
    dgUi.enc = null; dgUi.spDo = 'tier-in:cave'; act('sp'); out.cave1Empty = !dgUi.enc && r.tier.n === 1; r.tier = null;
    // --- кража сокровища: провал -> бой, успех -> награда
    sp = go('beast', 5, 4, 3, 1); out.hillsSteal = spButtons().some(x => x.id === 'steal');
    state.party.forEach(c => { c.base.dex = 1; }); dgUi.spDo = 'steal'; Math.random = () => 0; act('sp'); out.stealFail = dgUi.enc && dgUi.enc.sp.k === 'guard' && dgUi.enc.ambush; Math.random = RND;
    return out;
  });
  const flat = {}; for (const k of Object.keys(res)) flat[k] = res[k];
  const nm = {
    nestPlain: 'гнездо — на обычной чаще, не вплотную к особому месту', webCount: 'паутина на 9 тайлах крон', chapelAt: 'часовня — на курганах',
    nestFight: 'на тайле гнезда 3–4 вороны', nestCd: 'последняя ворона выжила: окно запущено тайно', nestNoMsg: 'без сообщений в момент запуска', j0: 'окно: до 2-го действия j=0', j1: 'окно: j=1',
    crow1: 'в бою гарантированно одна ворона', crow2: 'в последние действия — две, группа не растёт', crowBoss: 'вороны не идут с особыми', msgs: 'сообщения 2, 4, 5 действия', bw: 'на 6-м действии бой с чернокрылом и 4 воронами',
    bwDone: 'после чернокрыла окно закрыто', nestAllDead: 'все вороны убиты: ничего не запускается', crowDir: '«Ворона прилетела с …»', bloodNo: 'чует кровь выключена у здоровых', bloodYes: 'ранен меньше половины: чует кровь', bloodFlag: 'флаг в броске события', bloodGoblin: 'только в Волчьей чаще',
    caveBtn: 'спуск из угла пещеры', cave1: 'ярус 1: летучки и землекопы', tierNoMove: 'в ярусе только действия яруса', cave1Done: 'ярус зачищен', cave2: 'ярус 2: тёмный медведь', cave3: 'ярус 3: крот-исполин, дальше спуска нет',
    treasureLocked: 'сокровище пока не отбито — только украсть', treasureOpen: 'после крота можно забрать', stones: 'камни 7 класса получены', got: 'сокровище помечено', cavePrev: 'подъём на ярус 2', caveExit: 'выход из пещеры', cave1Empty: 'зачищенный ярус пуст',
    hillsSteal: 'Волчьи холмы: сокровище в центре — можно украсть', stealFail: 'провал скрытности: засада охраны' };
  for (const [k, t] of Object.entries(nm)) ok(t, flat[k] === true, JSON.stringify(flat[k]));

  const res2 = await p.evaluate(async () => {
    const out = {}, r = state.run;
    const go = (variant, x, y, day = 3, act = 1) => { r.floor = 2; r.variant = variant; r.sp = null; r.tier = null; r.pos = { x, y }; r.day = day; r.act = act; r.cleared = {}; r.pending = null; r.queue = []; dgUi.enc = null; dgUi.res = null; r.light = false; state.party.forEach(c => { r.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; c.hp = maxHp(c); c.dead = false; c.base.dex = 14; }); return spOf(); };
    const done = (e, outcome, killed) => { e.outcome = outcome; e.killed = killed || e.list.map((_, i) => i); finishFight(); };
    // --- паутина и паучиха
    let sp = go('beast', 8, 4, 3, 1); let rnd0 = window.__RND || Math.random; window.__RND = rnd0;
    Math.random = () => 0; r.pos = { x: 9, y: 4 }; out.webSaveFail = spEnter() === false && sp.pen === 1; Math.random = rnd0; sp.pen = 0; dgUi.res = null;
    Math.random = () => 0.99; spEnter(); out.webSaveOk = sp.pen === 0; Math.random = rnd0; dgUi.res = null; dgUi.enc = null;
    out.burnNeedsLight = spButtons().find(x => x.id === 'burn').disabled === true;
    r.light = true; out.burnEnabled = spButtons().find(x => x.id === 'burn').disabled === false;
    for (const [x, y] of [[8, 4], [9, 4], [8, 5]]) { r.pos = { x, y }; dgUi.spDo = 'burn'; act('sp'); dgUi.enc = null; dgUi.res = null; }
    out.burned = sp.burned === 3 && sp.queen === 'chase' && sp.web['8,4'] === false;
    out.chaseRoll = (() => { r.pos = { x: 9, y: 5 }; Math.random = () => 0; spAfter(); Math.random = rnd0; return dgUi.enc && dgUi.enc.sp.k === 'queen' && dgUi.enc.list[0] === 'spider-queen'; })();
    done(dgUi.enc, 'flee', []); out.fleeGuard = sp.queen === 'guard'; dgUi.enc = null;
    r.pos = { x: 10, y: 6 }; out.queenAmbush = (() => { Math.random = () => 0.99; const f = spEnter(); Math.random = rnd0; return f && dgUi.enc.sp.k === 'queen' && dgUi.enc.ambush; })();
    done(dgUi.enc, 'win'); out.queenDead = sp.queen === 'dead'; dgUi.enc = null; dgUi.res = null;
    // погоня заканчивается: ушли далеко
    sp = go('beast', 2, 2); sp.queen = 'chase'; sp.chaseT0 = absAct(r); spAfter(); out.chaseFar = sp.queen === 'guard';
    sp = go('beast', 9, 5); sp.queen = 'chase'; sp.chaseT0 = absAct(r) - 3; spAfter(); out.chase3 = sp.queen === 'guard' && !dgUi.enc;
    // логово: пауки, потом сокровище
    sp = go('beast', 10, 5); sp.web = {}; out.lair = spEnter() && dgUi.enc.sp.k === 'lair' && dgUi.enc.list.every(i => i === 'web-spider') && dgUi.enc.list.length >= 4;
    done(dgUi.enc, 'win'); dgUi.enc = null; out.lairTreasure = spButtons().some(x => x.id === 'take') && sp.guard['b-spider'] === true;
    // --- Могильник: часовня
    sp = go('undead', 5, 5, 2, 1); const [cx, cy] = sp.chapel.at.split(',').map(Number); r.pos = { x: cx, y: cy }; r.act = 2;
    out.noBeaconMorning = !spButtons().some(x => x.id === 'tier-in:chapel');
    r.act = 3; spAfter(); out.beacon = spButtons().some(x => x.id === 'tier-in:chapel') && r.log.some(l => l.t.includes('маяк'));
    r.pos = { x: cx >= 3 ? cx - 3 : cx + 3, y: cy }; r.log.length = 0; sp.chapel.chime = 0; r.act = 3; spAfter(); out.chime = r.log.some(l => /Вы слышите звон (близко|недалеко|далеко|очень далеко) на (севере|юге|востоке|западе)/.test(l.t));
    r.pos = { x: cx, y: cy }; r.act = 1; dgUi.spDo = 'tier-in:chapel'; sp.chapel.entered = false; r.act = 3; act('sp'); dgUi.enc && 0;
    out.chapelIn = r.tier && r.tier.k === 'chapel' && r.tier.n === 1 && dgUi.enc && dgUi.enc.list.every(i => i === 'grey-shade' || i === 'morok') && dgUi.enc.list.length >= 2;
    done(dgUi.enc, 'win'); dgUi.enc = null;
    const want = [['whisperer', 'morok'], ['mirror-dead', 'grey-shade'], ['faceless-ringer']];
    out.chapelTiers = true;
    for (let n = 2; n <= 4; n++) { dgUi.spDo = 'tier-next'; act('sp'); if (!(r.tier.n === n && dgUi.enc && dgUi.enc.list.every(i => want[n - 2].includes(i)))) out.chapelTiers = false; if (n < 4) { done(dgUi.enc, 'win'); dgUi.enc = null; } }
    out.chapelTop = !spButtons().some(x => x.id === 'tier-next') && spButtons().some(x => x.id === 'steal');
    done(dgUi.enc, 'win'); dgUi.enc = null; out.chapelTreasure = spButtons().some(x => x.id === 'take'); dgUi.spDo = 'take'; act('sp'); out.chapelGot = sp.got['u-chapel'] === true; dgUi.res = null;
    // вышли и вернулись: маяк не пропадает, ярус пуст
    for (let i = 0; i < 4; i++) { dgUi.spDo = 'tier-prev'; act('sp'); dgUi.enc = null; }
    r.act = 1; out.beaconStays = r.tier === null && spButtons().some(x => x.id === 'tier-in:chapel');
    dgUi.spDo = 'tier-in:chapel'; act('sp'); out.chapelEmpty = !dgUi.enc; r.tier = null;
    // --- склеп
    sp = go('undead', 0, 0, 3, 1); dgUi.spDo = 'tier-in:crypt'; act('sp'); out.crypt1 = r.tier && dgUi.enc.list.every(i => i === 'ghoul' || i === 'plague-fat'); done(dgUi.enc, 'win'); dgUi.enc = null;
    dgUi.spDo = 'tier-next'; act('sp'); out.crypt2 = r.tier.n === 2 && dgUi.enc.list[0] === 'corpse-eater' && !spButtons().some(x => x.id === 'tier-next');
    // --- белая пыль
    sp = go('undead', 5, 5, 3, 1); r.day = 3; r.act = 3; advanceTime(); out.dustDay = r.day === 4 && !!dgUi.res && dgUi.res.title === 'Белая пыль';
    sp = go('undead', 5, 5, 3, 1); Math.random = () => 0; r.act = 3; dgUi.res = null; advanceTime(); Math.random = rnd0; out.dustFatigue = state.party.every(c => r.status[c.id].fat === 1);
    sp = go('undead', 9, 9, 3, 1); out.furnaceDc = (() => { Math.random = () => 0.5; r.act = 3; dgUi.res = null; advanceTime(); Math.random = rnd0; return /Сл 13/.test(dgUi.res && dgUi.res.roll); })();
    sp = go('goblin', 5, 5, 3, 1); r.act = 3; dgUi.res = null; advanceTime(); out.noDustGoblin = !dgUi.res;
    // --- следы, неупокоенные, ночь мертвецов
    sp = go('undead', 4, 4, 3, 1); r.cleared['4,4'] = absAct(r) - 3; out.tracks = isQuiet(r, '4,4') === false; r.cleared['4,4'] = absAct(r) - 2; out.tracksQuiet = isQuiet(r, '4,4') === true;
    r.floor = 1; r.cleared['4,4'] = absAct(r) - 4; out.quiet1 = isQuiet(r, '4,4') === true; r.floor = 2;
    sp = go('undead', 4, 4, 3, 1); { const e = { list: ['zombie', 'skeleton', 'ghoul'], outcome: 'win', killed: [0, 1, 2], key: '4,4', round: 1 }; dgUi.enc = e; finishFight(); }
    out.unqSet = sp.unq['4,4'] && sp.unq['4,4'].join() === 'zombie,skeleton'; out.cremBtn = spButtons().some(x => x.id === 'cremate');
    Math.random = () => 0; out.unqRise = spEnter() && dgUi.enc.sp.k === 'unq' && dgUi.enc.list.join() === 'zombie,skeleton'; Math.random = rnd0; dgUi.enc = null; sp.unq = {};
    sp.unq['4,4'] = ['zombie']; r.light = false; state.party[0].bag = [{ t: 'g', id: 'torch', qty: 2 }]; dgUi.spDo = 'cremate'; act('sp'); out.cremate = !sp.unq['4,4'] && countGear(state.party[0], 'torch') === 1;
    sp.unq['4,4'] = ['zombie']; Math.random = () => 0.99; out.unqNoRise = !spEnter() && !!sp.unq['4,4']; Math.random = rnd0;
    out.noMaskItem = !GEAR['dust-mask'];
    out.nightSame = (() => { r.day = 6; const o = window.askRoll; const hit = { cur: 0 }; window.askRoll = () => { hit.cur++; }; const N = 6000, m = {}; for (const v of ['undead', 'goblin']) { r.variant = v; r.pos = { x: 4, y: 4 }; hit.cur = 0; for (let i = 0; i < N; i++) rollEncounter('rest-noguard', 0); m[v] = hit.cur / N; } window.askRoll = o; return Math.abs(m.undead - m.goblin) < 0.04; })();
    // --- меню рендерится с кнопками особых действий
    sp = go('beast', 0, 0, 3, 1); try { location.hash = 'labyrinth'; route(); out.render = !!document.querySelector('[data-sp="tier-in:cave"]'); } catch (e) { out.render = String(e); }
    r.tier = { k: 'cave', n: 1 }; try { route(); out.renderTier = !!document.querySelector('[data-act="move"][disabled]') && !!document.querySelector('[data-sp="tier-prev"]'); } catch (e) { out.renderTier = String(e); } r.tier = null;
    // --- мир не сломан при переходе этажей: sp и tier сохраняются
    sp = go('beast', 0, 10, 3, 1); sp.marker = 7; r.pos = { x: 0, y: 10 }; switchFloor(); out.floor1Back = r.floor === 1; r.pos = { x: 0, y: 10 }; r.floor = 1; r.pos = { x: 0, y: 10 };
    return out;
  });
  const nm2 = { webSaveFail: 'паутина: провал — квадрат съест действие', webSaveOk: 'паутина: все прошли', burnNeedsLight: 'поджечь без факела нельзя', burnEnabled: 'с горящим факелом можно', burned: '3 тайла сожжены — паучиха проснулась',
    chaseRoll: 'погоня: к6 ≤ 3 — бой с паучихой', fleeGuard: 'побег от паучихи: она сторожит паутину', queenAmbush: 'вход в паутину при сторожащей паучихе — засада', queenDead: 'паучиха убита', chaseFar: 'ушли далеко — отстала', chase3: '3 действия — отстала',
    lair: 'логово: 4–5 пауков', lairTreasure: 'после логова можно забрать сокровище',
    noBeaconMorning: 'часовни нет не на 3-м действии', beacon: 'на 3-м действии на тайле — маяк', chime: 'звон: расстояние и сторона', chapelIn: 'ярус 1: серые тени и мороки', chapelTiers: 'ярусы 2–4 по таблице', chapelTop: 'вершина: сокровище только украсть, дальше подъёма нет',
    chapelTreasure: 'после звонаря можно забрать', chapelGot: 'сокровище часовни', beaconStays: 'маяк не пропадает', chapelEmpty: 'зачищенные ярусы пусты', crypt1: 'склеп ярус 1: гули и толстяки', crypt2: 'склеп дно: трупоед',
    dustDay: 'новые сутки: спасбросок пыли', dustFatigue: 'провал спасброска: +1 Усталость', furnaceDc: 'у печи Сл 13', noDustGoblin: 'в лесу гоблинов пыли нет',
    tracks: 'следы: зачищенный квадрат через сутки уже не пуст', tracksQuiet: 'следы: внутри суток пуст', quiet1: 'на 1 этаже пуст 2 дня', unqSet: 'убитые зомби и скелет запомнены', cremBtn: 'кнопка «Сжечь останки»', unqRise: 'мёртвые встают (к20 ≤ 5)', cremate: 'сожжение тратит факел', unqNoRise: 'к20 > 5 — не встали, останки ждут', noMaskItem: 'повязки нет', nightSame: 'ночь мертвецов убрана: шанс как везде',
    render: 'меню: кнопка спуска', renderTier: 'меню яруса: движение отключено', floor1Back: 'возврат на 1 этаж' };
  for (const [k, t] of Object.entries(nm2)) ok(t, res2[k] === true, JSON.stringify(res2[k]));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
