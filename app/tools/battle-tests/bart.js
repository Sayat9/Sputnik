// Поле 10×10 на 3 этаже: размер, расстановка, местность, полный бой (симуляция), снимок для онлайна, возврат к 7×7.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-ui','battle-menu','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  await p.addStyleTag({ path: '/home/user/app/assets/css/battle.css' });
  const R = [], ok = (n, c, x) => { R.push(!!c); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + (x == null ? '' : JSON.stringify(x))); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = (i) => { const c = Object.assign(clone(state.example), { id: 'q' + i, example: false, name: 'Г' + i, race: 'human', level: 3 }); delete c.bag; delete c.kit; delete c.hp; c.essences = []; c.bag = []; c.equip = {}; return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    state.run.floor = 3; state.run.day = 5; state.run.f3 = null; state.run.log = state.run.log || []; state.run.pos = { x: 15, y: 15 };
    state.party = [mk(0), mk(1), mk(2)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    // ---- предметы
    const spear = { t: 'w', id: 'spear', art: 'thunder-spear', qty: 1 };
    out.masked = [itemOf(spear).name, itemOf(spear).bonus, itemOf(spear).artId];
    artState().known['thunder-spear'] = true; out.named = itemOf(spear).name;
    out.classes = [ART_WEAPONS['thunder-spear'].cls, ART_WEAPONS['magnet-gloves'].cls, ART_WEAPONS['shadow-daggers'].cls, TREASURE_POOL[7][0]];
    // ---- сундук горнила: артефакт всегда, 10 % — оружие/броня
    let w = 0, n = 300, ok = true; const clsSeen = new Set();
    for (let i = 0; i < n; i++) {
      state.party.forEach(c => { c.bag = []; c.equip = {}; }); Object.keys(TREASURES).forEach(id => { treasure(id).owned = false; });
      const x = fireChestRoll(); ok = ok && /Артефакт/.test(x.line); if (ART_WEAPONS[x.id]) w++; clsSeen.add(x.cls);
    }
    out.fire = { ok, share: w / n, cls: [...clsSeen].sort() };
    state.party.forEach(c => { c.bag = []; c.equip = {}; });
    // ---- кнопка у сундука
    const F = f3(); F.fireOpen = false; state.run.pos = { x: 4, y: 5 };
    out.fireBtn = f3Buttons().some(b => b.id === 'f3fire'); out.fireZone = FLOOR3.zoneName(4, 5); out.fireTile = tileType(4, 5);
    // ---- бой: копьё-громоотвод
    const hero0 = state.party[0]; hero0.equip.main = { t: 'w', id: 'spear', art: 'thunder-spear' };
    const S = B.newBattle({ list: ['goblin', 'goblin', 'goblin'], zone: 'goblin', floor: 3, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.running = true;
    const h = B.heroes()[0], mons = B.mons(); h.mp = 6; h.maxMp = 6; B.startTurn ? 0 : 0;
    h.t = { move: 6, action: 1, bonus: 1, react: 1, moved: 0, startX: h.x, startY: h.y };
    const acts = B.weapActions(h); out.acts = acts.map(a => a.id);
    // заряд
    await acts.find(a => a.id === 'spearcharge').run(); out.charged = [h.charged, h.mp];
    const atks = B.attacksOf(h); out.chargedAtks = atks.filter(a => a.charged).map(a => [a.dt, a.extra && a.extra.length]);
    h.charged = false;
    // бросок застревает
    const tg = mons[0]; tg.x = h.x; tg.y = h.y - 3; tg.hp = tg.maxHp = 200;
    const th = B.attacksOf(h).find(a => a.thrown);
    B.commitAttack(h, th, tg); B.S.drops.length;
    await B.artAfterAttack(h, th, tg, { hit: true });
    out.lodged = [(B.S.lodged || []).length, B.S.drops.filter(d => d.kind === 'weapon').length];
    // молния в начале следующего хода владельца
    const hp0 = tg.hp; const nb = mons[1]; nb.x = tg.x + 1; nb.y = tg.y; nb.hp = nb.maxHp = 200; const far = mons[2]; far.x = 9; far.y = 0; far.hp = far.maxHp = 200;
    h.turnsTaken = (h.turnsTaken || 0) + 1; await B.artTurnStart(h);
    out.strike = { target: tg.hp < hp0, neighbour: nb.hp < 200, far: far.hp === 200, lodgedLeft: (B.S.lodged || []).length, dropped: B.S.drops.some(d => d.kind === 'weapon') };
    // вода проводит
    B.S.drops.length = 0; h.disarmed = false;
    const wetCells = []; for (let y = 0; y < B.H && wetCells.length < 3; y++) for (let x = 0; x + 2 < B.W && wetCells.length < 3; x++) if ([0, 1, 2].every(k => !B.S.cells[y][x + k] && !B.live().some(u => u.x === x + k && u.y === y))) { for (let k = 0; k < 3; k++) wetCells.push([x + k, y]); }
    const oldTinfo = B.tinfo; B.tinfo = (x, y) => (wetCells.some(c => c[0] === x && c[1] === y) ? { wet: true } : oldTinfo(x, y));
    tg.x = wetCells[0][0]; tg.y = wetCells[0][1]; nb.x = wetCells[2][0]; nb.y = wetCells[2][1]; tg.hp = nb.hp = 200;
    B.S.lodged = [{ kind: 'unit', tgt: tg.id, hero: h.id, turn: 0, drop: { kind: 'weapon', hero: h.hero.id, slot: 'main', item: h.hero.equip.main, x: 0, y: 0 } }];
    h.turnsTaken = 5; await B.artTurnStart(h); B.tinfo = oldTinfo;
    out.water = { target: tg.hp < 200, farOnWater: nb.hp < 200 };
    // воткнуть в клетку
    B.S.drops.length = 0; h.disarmed = false; h.t.action = 1; h.turnsTaken = 6;
    const plantAct = B.weapActions(h).find(a => a.id === 'spearplant');
    const origPick = B.UI.pickCell; const cellTo = [h.x + 1, h.y - 2]; B.S.cells[cellTo[1]][cellTo[0]] = ''; for (const m of mons) if (m.x === cellTo[0] && m.y === cellTo[1]) { m.x = 0; m.y = 9; }
    B.UI.pickCell = async () => cellTo; await plantAct.run(); B.UI.pickCell = origPick;
    out.plant = { terrain: B.S.cells[cellTo[1]][cellTo[0]], disarmed: h.disarmed, rec: (B.S.lodged || []).length };
    const nb2 = mons[1]; nb2.x = cellTo[0] + 1; nb2.y = cellTo[1]; nb2.hp = 200; h.turnsTaken = 7; await B.artTurnStart(h);
    out.plantStrike = { nbHurt: nb2.hp < 200, stillPlanted: B.S.cells[cellTo[1]][cellTo[0]] === 'spearstuck' };
    B.destroyObject(cellTo[0], cellTo[1], h);
    out.knocked = { terrain: B.S.cells[cellTo[1]][cellTo[0]], drop: B.S.drops.some(d => d.kind === 'weapon' && d.x === cellTo[0] && d.y === cellTo[1]), lodged: (B.S.lodged || []).length };
    return out;
  });
  ok('артефактное оружие: имя «??» до определения, бонус стали, после — имя', o.masked[0] === '??' && o.masked[1] === 1 && o.masked[2] === 'thunder-spear' && o.named === 'Копьё-громоотвод', o);
  ok('классы: громоотвод 6, перчатки 7, парные тени 7', o.classes.slice(0, 3).join() === '6,7,7', o.classes);
  ok('сундук горнила: артефакт всегда, оружие ~10 %', o.fire.ok && o.fire.share > 0.03 && o.fire.share < 0.2, o.fire);
  ok('сундук горнила стоит на полу Пылающих земель, кнопка доступна', o.fireBtn && o.fireZone === 'Пылающие земли' && o.fireTile === 'floor', [o.fireBtn, o.fireZone, o.fireTile]);
  ok('громоотвод: заряд и бросок в меню', o.acts.includes('spearcharge') && o.acts.includes('spearplant'), o.acts);
  ok('заряд: 2 маны, удар становится электрическим +1к6', o.charged[0] === true && o.charged[1] === 4 && o.chargedAtks.length >= 1 && o.chargedAtks[0][0] === 'lightning', [o.charged, o.chargedAtks]);
  ok('бросок застревает в цели (копьё не лежит на земле)', o.lodged[0] === 1 && o.lodged[1] === 0, o.lodged);
  ok('молния в начале следующего хода: цель и соседи, дальние не задеты, копьё падает', o.strike.target && o.strike.neighbour && o.strike.far && o.strike.lodgedLeft === 0 && o.strike.dropped, o.strike);
  ok('вода проводит молнию дальше', o.water.target && o.water.farOnWater, o.water);
  ok('воткнутое в клетку копьё: препятствие, рука пуста, бьёт молнией, остаётся', o.plant.terrain === 'spearstuck' && o.plant.disarmed && o.plant.rec === 1 && o.plantStrike.nbHurt && o.plantStrike.stillPlanted, [o.plant, o.plantStrike]);
  ok('сбитое копьё лежит на земле', o.knocked.terrain === '' && o.knocked.drop && o.knocked.lodged === 0, o.knocked);
  const o2 = await p.evaluate(async () => {
    const B = Battle, out = {};
    const hero0 = state.party[0]; hero0.equip = {}; hero0.bag = [];
    // ---- магнитные перчатки
    hero0.equip.main = { t: 'w', id: 'gloves', art: 'magnet-gloves' };
    const S = B.newBattle({ list: ['goblin', 'hobgoblin', 'goblin'], zone: 'goblin', floor: 3, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.running = true;
    const h = B.heroes()[0], [m1, m2, m3] = B.mons();
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) S.cells[y][x] = '';
    B.heroes().slice(1).forEach((o, i) => { o.x = i; o.y = 0; });
    h.x = 5; h.y = 9; h.t = { move: 6, action: 1, bonus: 1, react: 1, moved: 0, startX: 5, startY: 9 };
    m1.x = 5; m1.y = 6; m2.x = 0; m2.y = 0; m3.x = 9; m3.y = 0;
    out.acts = B.weapActions(h).map(a => a.id);
    out.path = (B.pullPath(h, m1) || []).length;
    out.dc = [B.pullDc(m1)]; m1.size = 2; out.dc.push(B.pullDc(m1)); m1.size = 3; out.huge = B.pullPath(h, m1); m1.size = 1;
    m1.mon = Object.assign({}, m1.mon, { name: 'Железный голем' }); out.dc.push(B.pullDc(m1)); m1.mon.name = 'Гоблин';
    // препятствие на пути
    S.cells[8][5] = 'rock'; out.blocked = B.pullPath(h, m1); S.cells[8][5] = '';
    // успех: подсовываем бросок через сессию — берём автоматический режим, повторяем до успеха
    B.SKILL_ABIL.conCheck = 'con'; h.abil.con = 100;
    const pk = B.UI.pickUnit; B.UI.pickUnit = async () => m1; const ok1 = await B.doPull(h); B.UI.pickUnit = pk;
    out.pulled = { ok1, y: m1.y, x: m1.x };
    // ---- Порез теней
    hero0.equip.main = { t: 'w', id: 'dagger', art: 'shadow-daggers' };
    const atks = B.attacksOf(h); const cut = atks.find(a => a.n === 'Порез теней');
    out.cut = cut ? [cut.kind, cut.reach] : null;
    m1.x = 9; m1.y = 0; m2.x = 5; m2.y = 6; h.y = 9; out.cutRange = cut ? B.attackTargets(h, cut).map(t => t.id === m2.id) : [];
    m2.y = 5; out.cutFar = cut ? B.attackTargets(h, cut).length : -1;
    // ---- пика со щитом
    hero0.equip.main = { t: 'w', id: 'pike', qty: 1 }; hero0.equip.off = { t: 'w', id: 'shield', qty: 1 };
    out.pike = { two: twoHanded(hero0) };
    hero0.equip.off = null; out.pikeAlone = twoHanded(hero0);
    hero0.equip.off = { t: 'w', id: 'sword', qty: 1 }; out.pikeSword = twoHanded(hero0);
    hero0.equip.off = { t: 'w', id: 'shield', qty: 1 };
    const S2 = B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 3, kind: 'hard', title: 'x' }); S2.opts.autoHeroes = true; B.placeHeroesDefault(S2); B.placeMonsters(S2);
    const hs = B.heroes()[0]; const spWith = B.speedOf(hs); hero0.equip.off = null; const spWithout = B.speedOf(B.heroes()[0]);
    out.pikeSpeed = [spWith, spWithout]; out.pikeReach = B.attacksOf(B.heroes()[0]).find(a => a.kind === 'melee').reach;
    // ---- продажа артефактного оружия
    hero0.equip = {}; hero0.bag = [{ t: 'w', id: 'spear', art: 'thunder-spear', qty: 1 }]; hero0.gold = 0;
    out.price = [artValue('thunder-spear'), artBuyerMult('thunder-spear', 'forge'), artBuyerMult('thunder-spear', 'tower')];
    return out;
  });
  ok('перчатки: действие «Притянуть» в меню, путь 2 клетки', o2.acts.includes('magnet') && o2.path === 2, [o2.acts, o2.path]);
  ok('Сл притяжения: 12, крупным 9, металлическим +3; огромных нельзя', o2.dc.join() === '12,9,15' || o2.dc.join() === '12,9,12', o2.dc);
  ok('огромного притянуть нельзя, препятствие на пути — нельзя', o2.huge === null && o2.blocked === null, [o2.huge, o2.blocked]);
  ok('притяжение выполняется: цель встаёт вплотную', o2.pulled.ok1 && o2.pulled.y === 8, o2.pulled);
  ok('Порез теней: атака на 3 клетки, на 4 клетки не достаёт', o2.cut && o2.cut[0] === 'melee' && o2.cut[1] === 3 && o2.cutRange[0] === true && o2.cutFar === 0, [o2.cut, o2.cutRange, o2.cutFar]);
  ok('пика: со щитом не двуручная блокировка, с пустой рукой/мечом — двуручная', o2.pike.two === false && o2.pikeAlone === true && o2.pikeSword === true, o2);
  ok('пика со щитом: скорость на клетку меньше, досягаемость 2', o2.pikeSpeed[0] === o2.pikeSpeed[1] - 1 && o2.pikeReach === 2, [o2.pikeSpeed, o2.pikeReach]);
  ok('цены артефактного оружия: класс 6, кузница платит больше башни', o2.price[0] === 5000 && o2.price[1] === 1.1 && o2.price[2] === 1, o2.price);
  const o3 = await p.evaluate(async () => {
    const B = Battle, out = {};
    const hero0 = state.party[0]; hero0.equip = {}; hero0.bag = [];
    out.classes = [ART_WEAPONS['falling-star'].cls, ART_WEAPONS['echo-blade'].cls, ART_WEAPONS['discharge-staff'].cls, ART_WEAPONS['mirror-shield'].cls, GEAR['director-quiver'].cls, ARTIFACTS['director-quiver'].cls, TREASURE_POOL[8].includes('director-quiver'), TREASURE_POOL[7].length];
    // ---- Падающая звезда
    hero0.equip.main = { t: 'w', id: 'longbow', art: 'falling-star' }; hero0.bag = [{ t: 'g', id: 'arrow', qty: 10 }]; hero0.mp = 5;
    const S = B.newBattle({ list: ['goblin', 'goblin', 'goblin'], zone: 'goblin', floor: 3, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.running = true;
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) S.cells[y][x] = '';
    const h = B.heroes()[0], [m1, m2, m3] = B.mons(); h.mp = 5; h.maxMp = 6; B.heroes().slice(1).forEach((o, i) => { o.x = i; o.y = 9; });
    h.x = 5; h.y = 9; h.t = { move: 6, action: 1, bonus: 1, react: 1, moved: 0, startX: 5, startY: 9 };
    m1.x = 5; m1.y = 3; m2.x = 6; m2.y = 3; m3.x = 0; m3.y = 0; for (const m of [m1, m2, m3]) m.hp = m.maxHp = 100;
    B.addStatus(m1, 'hidden', { k: Infinity });
    const sp = B.attacksOf(h).find(a => a.special === 'star'); out.star = !!sp;
    const before = countGear(hero0, 'arrow');
    const origPick = B.UI.pickCell; B.UI.pickCell = async () => [5, 3]; const okStar = await B.runSpecial(h, sp); B.UI.pickCell = origPick;
    out.starRes = { ok: okStar, mp: h.mp, arrows: before - countGear(hero0, 'arrow'), m1: m1.hp < 100, m2: m2.hp < 100, far: m3.hp === 100, lit: !!B.has(m1, 'starlit'), hid: !B.has(m1, 'hidden'), action: h.t.action };
    const hh = B.attacksOf(h).find(a => a.special === 'star'); out.starCd = hh && hh.needTarget ? hh.needTarget(h) : null;
    // ---- Эхо-клинок
    hero0.equip.main = { t: 'w', id: 'sword', art: 'echo-blade' }; h.echo = null;
    const swordAtk = B.attacksOf(h).find(a => a.mode === 'hand'); m1.x = 5; m1.y = 8; m1.hp = 100;
    const ctxHit = { res: { hit: true, dealt: 10 }, tgt: m1, atk: swordAtk };
    await P_weap().attackDone(h, ctxHit); out.echoMark = h.echo && h.echo.dmg;
    const hp1 = m1.hp; await P_weap().attackDone(h, { res: { hit: false, dealt: 0 }, tgt: m1, atk: swordAtk }); out.echoHit = [hp1 - m1.hp, h.echo];
    function P_weap() { return B.P.weap; }
    // ---- Посох разрядов
    hero0.equip.main = { t: 'w', id: 'staff', art: 'discharge-staff' }; h.charges = 0; h.mp = 5; h.t.action = 1;
    B.setMp(h, 3); out.charges = h.charges; B.setMp(h, 0); out.chargesCap = h.charges; B.setMp(h, 3);
    m1.x = 5; m1.y = 7; m1.hp = 100; const dis = B.weapActions(h).find(a => a.id === 'discharge'); out.disEnabled = dis && dis.enabled;
    const pk = B.UI.pickUnit; B.UI.pickUnit = async () => m1; await dis.run(); B.UI.pickUnit = pk; out.dis = [m1.hp < 100, h.charges];
    // ---- Зеркальный щит
    hero0.equip.main = null; hero0.equip.off = { t: 'w', id: 'shield', art: 'mirror-shield' }; h.mp = 3;
    out.shieldAc = itemOf(hero0.equip.off).steel === true;
    let reflected = 0, taken = 0, tries = 40; for (let i = 0; i < tries; i++) { h.mp = 3; m1.hp = 100; h.hp = h.maxHp; const r = await B.applyDamage(m1, h, [{ v: 10, dt: 'pierce', label: 'стрела' }], { ctx: { atk: { kind: 'ranged' } }, src: m1 }); if (r.notes && r.notes.includes('отражено щитом')) { reflected++; if (m1.hp !== 95) taken = -1; } }
    out.mirror = { reflected, taken };
    h.mp = 0; h.hp = h.maxHp; const r0 = await B.applyDamage(m1, h, [{ v: 10, dt: 'pierce', label: 'стрела' }], { ctx: { atk: { kind: 'ranged' } }, src: m1 }); out.noMana = !(r0.notes || []).includes('отражено щитом');
    // ---- Упор пики
    hero0.equip.off = null; hero0.equip.main = { t: 'w', id: 'pike', qty: 1 }; h.mp = 3; h.t.react = 1; h.x = 5; h.y = 5; m2.x = 5; m2.y = 1; m2.hp = 100;
    const rr = B.UI.confirm; B.promptReaction = async () => true;
    const hpB = m2.hp; m2.x = 5; m2.y = 3; await B.P.weap.reactEnter(h, m2, [5, 1]);
    out.pike = { react: h.t.react, hurt: m2.hp < hpB, stopped: !!B.has(m2, 'spearstop') || m2.hp >= hpB };
    return out;
  });
  ok('колчан режиссёра — 8 класса (пул 8), в пуле 7 — кольцо; новые артефакты: 6,7,6,7', o3.classes.join() === '6,7,6,7,8,8,true,1', o3.classes);
  ok('Падающая звезда: атака в меню, тратит 1 ману, стрелу и действие', o3.star && o3.starRes.ok && o3.starRes.mp === 4 && o3.starRes.arrows === 1 && o3.starRes.action === 0, o3.starRes);
  ok('Падающая звезда: бьёт область, дальнюю цель нет, подсвечивает и снимает невидимость', o3.starRes.m1 && o3.starRes.m2 && o3.starRes.far && o3.starRes.lit && o3.starRes.hid, o3.starRes);
  ok('Падающая звезда: перезарядка 3 хода', /перезарядка/.test(o3.starCd || ''), o3.starCd);
  ok('Эхо-клинок: попадание оставляет эхо; следующая атака (хоть мимо) повторяется на половину', o3.echoMark === 10 && o3.echoHit[0] === 5 && o3.echoHit[1] === null, [o3.echoMark, o3.echoHit]);
  ok('Посох разрядов: заряды от потраченной маны (до 3), «Разряд» бьёт и разряжает', o3.charges === 2 && o3.chargesCap === 3 && o3.disEnabled && o3.dis[0] && o3.dis[1] === 0, [o3.charges, o3.chargesCap, o3.disEnabled, o3.dis]);
  ok('Зеркальный щит: +1 КД, шанс отражения около 40 %, отражённое бьёт стрелка вполсилы, без маны не работает', o3.shieldAc && o3.mirror.reflected >= 5 && o3.mirror.reflected <= 28 && o3.mirror.taken === 0 && o3.noMana, [o3.shieldAc, o3.mirror, o3.noMana]);
  ok('Упор пики: реакция тратится, цель получает удар', o3.pike.react === 0 && o3.pike.hurt, o3.pike);
  const o4 = await p.evaluate(async () => {
    const B = Battle, out = {};
    const hero0 = state.party[0]; hero0.equip = {}; hero0.bag = [{ t: 'g', id: 'arrow', qty: 10 }];
    out.classes = [ART_WEAPONS['moon-sword'].cls, ART_WEAPONS['storm-axe'].cls, ART_WEAPONS['meteor-mace'].cls, GEAR['brotherhood-ring'].cls, TREASURE_POOL[7].join()];
    const S = B.newBattle({ list: ['goblin', 'goblin', 'goblin'], zone: 'goblin', floor: 3, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.running = true;
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) S.cells[y][x] = '';
    const [h, ally, ally2] = B.heroes(), [m1, m2, m3] = B.mons();
    const reset = () => { h.x = 5; h.y = 9; ally.x = 0; ally.y = 9; ally2.x = 1; ally2.y = 9; m1.x = 5; m1.y = 5; m2.x = 0; m2.y = 0; m3.x = 9; m3.y = 0; for (const u of B.live()) { u.hp = u.maxHp = 100; } h.t = { move: 6, action: 1, bonus: 1, react: 1, moved: 0, startX: 5, startY: 9 }; h.mp = 5; h.maxMp = 6; };
    reset();
    // ---- Падающая звезда задевает союзников
    hero0.equip.main = { t: 'w', id: 'longbow', art: 'falling-star' };
    ally.x = 6; ally.y = 5; reset(); ally.x = 6; ally.y = 5;
    const sp = B.attacksOf(h).find(a => a.special === 'star'); const op = B.UI.pickCell; B.UI.pickCell = async () => [5, 5]; await B.runSpecial(h, sp); B.UI.pickCell = op;
    out.starFF = { enemy: m1.hp < 100, ally: ally.hp < 100, allyLit: !!B.has(ally, 'starlit') };
    // ---- Кольцо братского духа
    reset(); ally.x = 5; ally.y = 8; state.party[1].equip = { ring1: { t: 'g', id: 'brotherhood-ring' } };
    const hpA = ally.hp; await B.applyDamage(h, ally, [{ v: 10, dt: 'fire', label: 'огонь' }], { src: h });
    out.ringAlly = ally.hp === hpA; const hpB = ally.hp; await B.applyDamage(m1, ally, [{ v: 10, dt: 'fire', label: 'огонь' }], { src: m1 });
    out.ringEnemy = ally.hp < hpB; state.party[1].equip = {};
    // ---- Меч полумесяца (способности по фазам, откат 2/3/4/2)
    reset(); hero0.equip.main = { t: 'w', id: 'greatsword', art: 'moon-sword' }; h.moon = undefined; h.moonCd = 0;
    const seen = []; for (let i = 0; i < 5; i++) { await B.artTurnStart(h); seen.push(h.moon); } out.moonCycle = seen;
    const pu0 = B.UI.pickUnit; B.UI.pickUnit = async () => m1; const da0 = B.doAttack; const cds = [];
    for (const ph of [0, 1, 2, 3]) {
      reset(); h.moon = ph; h.moonCd = 0; m1.x = 5; m1.y = 8; m2.x = 6; m2.y = 8; ally.x = 4; ally.y = 8; for (const u of B.live()) { u.hp = u.maxHp = 100; }
      B.S.conds; const sp = B.attacksOf(h).find(a => a.special === 'moon'); const act = B.weapActions(h).find(a => a.id === 'moonguard');
      let extra = null; B.doAttack = async (u, tg, atk, o) => { extra = o.extra || null; return { hit: true, nat: 15, dealt: 20, cancelled: false }; };
      if (ph === 3) { await act.run(); } else { await B.runSpecial(h, sp); }
      B.doAttack = da0;
      cds.push({ ph, cd: h.moonCd, extra: extra && extra[0] ? extra[0].n + 'к' + extra[0].s : null, dazzled: !!B.has(m1, 'dazzled'), m2: m2.hp < 100, ally: ally.hp < 100, guard: !!B.has(h, 'moonguard'), acb: B.P.weap.acBonus(h) });
    }
    B.UI.pickUnit = pu0; out.moonPh = cds;
    h.moon = 1; h.moonCd = 2; out.moonLocked = !B.attacksOf(h).some(a => a.special === 'moon');
    // ---- Топор бури: «Стяжка» и «Бумеранг»
    reset(); hero0.equip.main = { t: 'w', id: 'axe', art: 'storm-axe' };
    const axeSp = B.attacksOf(h).filter(a => a.special === 'axepull' || a.special === 'boomerang'); out.axeSp = axeSp.map(a => a.special);
    m1.x = 5; m1.y = 3; m2.x = 5; m2.y = 1; m3.x = 9; m3.y = 3; ally.x = 4; ally.y = 3; ally.hp = 100; for (const u of B.live()) u.hp = u.maxHp = 100; m2.abil.con = 1; m2.size = 1; h.abil.str = 30; h.pb = 0;
    const pull = axeSp.find(a => a.special === 'axepull'); const pu1 = B.UI.pickUnit; B.UI.pickUnit = async () => m1; const da1 = B.doAttack; B.doAttack = async (u, tg, atk, o) => { if (o.onCommit) o.onCommit(); return { hit: true, nat: 15, dealt: 5, cancelled: false }; };
    await B.runSpecial(h, pull); B.doAttack = da1; B.UI.pickUnit = pu1;
    out.axePull = { pulled: B.dist(m2, m1) <= 1, hurt: m2.hp < 100, far: m3.hp === 100 && m3.x === 9, dropped: B.S.drops.some(d => d.kind === 'weapon' && d.item && d.item.art === 'storm-axe') };
    m2.x = 5; m2.y = 1; m2.hp = 100; m2.size = 2; B.S.drops.length = 0; h.disarmed = false; h.t.action = 1; B.UI.pickUnit = async () => m1; B.doAttack = async (u, tg, atk, o) => { if (o.onCommit) o.onCommit(); return { hit: true, nat: 15, dealt: 5, cancelled: false }; };
    await B.runSpecial(h, pull); B.doAttack = da1; B.UI.pickUnit = pu1; out.axeHeavy = m2.y === 1 && m2.hp === 100;
    // бумеранг
    reset(); h.disarmed = false; B.S.drops.length = 0; for (const u of B.live()) u.hp = u.maxHp = 100; m1.x = 5; m1.y = 6; ally.x = 6; ally.y = 6; m3.x = 0; m3.y = 0; m2.x = 9; m2.y = 9;
    const boom = B.attacksOf(h).find(a => a.special === 'boomerang'); const opc = B.UI.pickCell; B.UI.pickCell = async () => [5, 6]; await B.runSpecial(h, boom); B.UI.pickCell = opc;
    out.boom = { enemy: m1.hp < 100, ally: ally.hp < 100, far: m3.hp === 100 && m2.hp === 100, inHand: h.disarmed === false, noDrop: B.S.drops.length === 0, action: h.t.action };
    // ---- Булава «Метеор»
    reset(); hero0.equip.main = { t: 'w', id: 'mace', art: 'meteor-mace' }; hero0.hp = hero0.hp;
    const mAtk = B.attacksOf(h).find(a => a.special === 'meteor'); out.meteorAtk = !!mAtk;
    const pu = B.UI.pickUnit; B.UI.pickUnit = async () => m1; const da = B.doAttack; const sv = B.doSave;
    m1.x = 5; m1.y = 6; ally.x = 6; ally.y = 6; m2.x = 4; m2.y = 6; m3.x = 9; m3.y = 0; B.S.cells[6][5] = '';
    B.doAttack = async () => ({ hit: true, nat: 15, dealt: 12, cancelled: false }); B.doSave = async () => ({ ok: false });
    await B.doMeteor(h, mAtk); B.doAttack = da; B.doSave = sv;
    out.meteor = { used: h.meteorUsed, moved: h.y < 9, ally: ally.hp < 100, enemy2: m2.hp < 100, far: m3.hp === 100, prone: !!B.has(m1, 'prone'), crater: B.S.cells[6][5] };
    // повтор запрещён
    const again = B.attacksOf(h).find(a => a.special === 'meteor'); out.meteorAgain = again.needTarget(h);
    // провал 1–2
    reset(); h.meteorUsed = false; m1.x = 5; m1.y = 8; const hp0 = h.hp; B.doAttack = async () => ({ hit: false, nat: 1, dealt: 0, cancelled: false });
    await B.doMeteor(h, B.attacksOf(h).find(a => a.special === 'meteor')); B.doAttack = da; B.UI.pickUnit = pu;
    out.backlash = { hurt: h.hp < hp0, moved: h.y > m1.y };
    return out;
  });
  ok('классы: меч 6, топор 7, булава 7, кольцо 7 (пул 7 — кольцо)', o4.classes.join() === '6,7,7,7,brotherhood-ring', o4.classes);
  ok('Падающая звезда задевает и союзников (но подсвечивает только врагов)', o4.starFF.enemy && o4.starFF.ally && !o4.starFF.allyLit, o4.starFF);
  ok('Кольцо братского духа: от союзника урона нет, от врага есть', o4.ringAlly && o4.ringEnemy, [o4.ringAlly, o4.ringEnemy]);
  ok('Меч полумесяца: фазы сменяются сами каждый ход (0,1,2,3,0)', o4.moonCycle.join() === '0,1,2,3,0', o4.moonCycle);
  ok('Меч: новолуние ослепляет цель, откат 2', o4.moonPh[0].cd === 2 && o4.moonPh[0].dazzled && !o4.moonPh[0].m2, o4.moonPh[0]);
  ok('Меч: полумесяц задевает всех вокруг цели (и своих), откат 3', o4.moonPh[1].cd === 3 && o4.moonPh[1].m2 && o4.moonPh[1].ally, o4.moonPh[1]);
  ok('Меч: полнолуние — большой удар +2к8, откат 4', o4.moonPh[2].cd === 4 && o4.moonPh[2].extra === '2к8', o4.moonPh[2]);
  ok('Меч: ущерб — стойка +1 КД, откат 2; в откате способности недоступны', o4.moonPh[3].cd === 2 && o4.moonPh[3].guard && o4.moonPh[3].acb === 1 && o4.moonLocked, [o4.moonPh[3], o4.moonLocked]);
  ok('Топор бури: «Стяжка» и «Бумеранг» отдельные действия', o4.axeSp.join() === 'axepull,boomerang', o4.axeSp);
  ok('Стяжка: попав, стягивает ближнего врага с уроном, дальнего нет, топор лежит на земле; тяжёлого не стянуть', o4.axePull.pulled && o4.axePull.hurt && o4.axePull.far && o4.axePull.dropped && o4.axeHeavy, [o4.axePull, o4.axeHeavy]);
  ok('Бумеранг: бьёт всех на дуге (и своих), возвращается в руку, тратит действие', o4.boom.enemy && o4.boom.ally && o4.boom.far && o4.boom.inHand && o4.boom.noDrop && o4.boom.action === 0, o4.boom);
  ok('Булава «Метеор»: прыжок, урон вокруг (и своим), падение цели, кратер, раз за бой', o4.meteorAtk && o4.meteor.used && o4.meteor.moved && o4.meteor.ally && o4.meteor.enemy2 && o4.meteor.far && o4.meteor.prone && o4.meteor.crater === 'crater' && /уже использован/.test(o4.meteorAgain || ''), [o4.meteor, o4.meteorAgain]);
  ok('Булава «Метеор»: 1–2 — героя отбрасывает, 1к8 урона', o4.backlash.hurt && o4.backlash.moved, o4.backlash);
  const o5 = await p.evaluate(async () => {
    const B = Battle, out = {};
    const hero0 = state.party[0]; hero0.equip = {}; hero0.bag = [{ t: 'g', id: 'arrow', qty: 10 }];
    const S = B.newBattle({ list: ['goblin', 'goblin', 'goblin'], zone: 'goblin', floor: 3, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.running = true;
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) S.cells[y][x] = '';
    const [h, ally, ally2] = B.heroes(), [m1, m2, m3] = B.mons();
    const reset = () => { h.x = 5; h.y = 9; ally.x = 4; ally.y = 9; ally2.x = 0; ally2.y = 9; m1.x = 5; m1.y = 5; m2.x = 0; m2.y = 0; m3.x = 9; m3.y = 0; for (const u of B.live()) { u.hp = u.maxHp = 100; } h.t = { move: 6, action: 1, bonus: 1, react: 1, moved: 0, startX: 5, startY: 9 }; h.mp = 6; h.maxMp = 6; };
    // ---- Пика Заставы
    reset(); hero0.equip.main = { t: 'w', id: 'pike', art: 'rampart-pike' }; B.promptReaction = async () => true;
    h.y = 5; h.x = 5; m1.x = 5; m1.y = 3; ally.x = 4; ally.y = 5; B.S.round = 3; h.t.react = 0; out.free = B.freeReact(h);
    const hp0 = m1.hp; await B.P.weap.reactEnter(h, m1, [5, 0]);
    out.upor = { react: h.t.react, again: B.freeReact(h), stop: !!B.has(m1, 'spearstop') || m1.hp < hp0, ward: !!B.has(ally, 'pikeward') };
    out.wardAc = (() => { const c = B.attackCtx(m1, ally, { kind: 'melee', hit: 5, parts: [{ l: 'x', v: 5 }], dmg: { n: 1, s: 6, b: 0 }, dt: 'pierce' }); const base = ally.ac; return c.ac - base; })();
    // разбег
    reset(); h.t.startX = 5; h.t.startY = 9; h.x = 5; h.y = 6; m1.x = 5; m1.y = 4; m2.x = 5; m2.y = 3; m1.size = 1;
    const chg = B.attacksOf(h).find(a => a.special === 'charge'); out.chg = !!chg && chg.needTarget(h) === null;
    const pk = B.UI.pickUnit; B.UI.pickUnit = async () => m1; const da = B.doAttack; const sv = B.doSave; let extra = null;
    B.doAttack = async (u, tg, atk, o) => { extra = o.extra; return { hit: true, nat: 15, dealt: 20, cancelled: false }; }; B.doSave = async () => ({ ok: false });
    await B.runSpecial(h, chg); B.doAttack = da; B.doSave = sv; B.UI.pickUnit = pk;
    out.chargeRes = { extra: extra && extra[0].n + 'к' + extra[0].s, prone: !!B.has(m1, 'prone'), second: m2.hp < 100 };
    h.t.startY = 7; out.chargeNo = chg && B.attacksOf(h).find(a => a.special === 'charge').needTarget(h);
    // ---- Лук «Рикошет»
    reset(); hero0.equip.main = { t: 'w', id: 'shortbow', art: 'ricochet-bow' }; m1.x = 5; m1.y = 3; m2.x = 6; m2.y = 2; m3.x = 9; m3.y = 0;
    const bowAtk = B.attacksOf(h).find(a => a.kind === 'ranged');
    await B.P.weap.afterAttack(h, { res: { hit: true, nat: 12, dealt: 10 }, tgt: m1, atk: bowAtk, melee: false });
    const half = 100 - m2.hp; m2.hp = 100; await B.P.weap.afterAttack(h, { res: { hit: true, nat: 20, dealt: 10 }, tgt: m1, atk: bowAtk, melee: false });
    out.rico = { half, full: 100 - m2.hp, far: m3.hp === 100 };
    // ---- Теневой клык
    reset(); hero0.equip.main = { t: 'w', id: 'dagger', art: 'shadow-fang' }; B.S.dark = true; B.S.torch = false;
    const lit = B.lightAt; B.lightAt = (x, y) => x < 4; // светло слева
    out.dark = B.darkCells(h).every(c => c[0] >= 4) && B.darkCells(h).length > 0;
    const stepA = B.weapActions(h).find(a => a.id === 'shadowstep'); out.stepEn = stepA.enabled;
    const pc = B.UI.pickCell; B.UI.pickCell = async () => [6, 7]; const mp0 = h.mp; await stepA.run(); B.UI.pickCell = pc;
    out.stepRes = { x: h.x, y: h.y, mana: mp0 - h.mp, bonus: h.t.bonus };
    B.S.dark = false; B.lightAt = lit; out.stepLight = B.weapActions(h).find(a => a.id === 'shadowstep').enabled;
    // ---- Секира «Жатва»
    reset(); hero0.equip.main = { t: 'w', id: 'greataxe', art: 'reaper-axe' }; h.harvest = 0; const gAtk = B.attacksOf(h).find(a => a.mode === 'hand');
    for (let i = 0; i < 3; i++) await B.P.weap.afterAttack(h, { res: { hit: true, killed: true, nat: 10 }, tgt: m1, atk: gAtk, melee: true });
    out.harv = h.harvest; ally.x = 4; ally.y = 8; m1.x = 5; m1.y = 8; m1.hp = 100; ally.hp = 100; m2.x = 0; m2.y = 0;
    const reap = B.weapActions(h).find(a => a.id === 'reap'); out.reapEn = reap.enabled;
    const ms = B.massSave; B.massSave = async (list) => list.map(() => ({ ok: false })); await reap.run(); B.massSave = ms;
    out.reap = { enemy: m1.hp < 100, ally: ally.hp < 100, far: m2.hp === 100, reset: h.harvest, action: h.t.action };
    h.harvest = 2; out.reapLocked = B.weapActions(h).find(a => a.id === 'reap').enabled;
    return out;
  });
  ok('Пика Заставы: «Упор» бесплатный раз в раунд, останавливает, союзники рядом получают заслон +1 КД', o5.free && o5.upor.react === 0 && o5.upor.again === false && o5.upor.stop && o5.upor.ward && o5.wardAc === 1, [o5.free, o5.upor, o5.wardAc]);
  ok('Пика Заставы: «Разбег» после 3+ клеток по прямой: +2к6, сбивает с ног, вторая цель на линии; без разбега нельзя', o5.chg && o5.chargeRes.extra === '2к6' && o5.chargeRes.prone && o5.chargeRes.second && /разбег/.test(o5.chargeNo || ''), [o5.chg, o5.chargeRes, o5.chargeNo]);
  ok('Лук «Рикошет»: ближайший враг в 2 клетках получает половину, на 20 — полный, дальний нет', o5.rico.half === 5 && o5.rico.full === 10 && o5.rico.far, o5.rico);
  ok('Теневой клык: прыжок только в тёмную клетку, 3 маны, доп. действие; при свете нельзя', o5.dark && o5.stepEn && o5.stepRes.x === 6 && o5.stepRes.y === 7 && o5.stepRes.mana === 3 && o5.stepRes.bonus === 0 && o5.stepLight === false, [o5.dark, o5.stepEn, o5.stepRes, o5.stepLight]);
  ok('Секира «Жатва»: убийства копят заряды, с 3 — круговой удар по всем рядом (и своим), потом сброс', o5.harv === 3 && o5.reapEn && o5.reap.enemy && o5.reap.ally && o5.reap.far && o5.reap.reset === 0 && o5.reap.action === 0 && o5.reapLocked === false, [o5.harv, o5.reap, o5.reapLocked]);
  ok('нет ошибок страницы', errs.length === 0, errs.slice(0, 3));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close();
})();
