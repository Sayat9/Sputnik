// Прочность оружия и брони: износ в бою, поломка, амулеты, ремонт на ночлеге (наборы, дварфы, курсы), кузница, академия, дроп артефактов.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true });
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : JSON.stringify(extra)); };
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2', 'dwarf', 'archer'], autoEnd: false });
  // подмена кубика: window.__nat = N (0..19) даёт натуральное N+1 на любом d20; null — обычный случайный
  await p.evaluate(() => { const g = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = a => { if (window.__nat != null && a instanceof Uint32Array) { a[0] = window.__nat; return a; } return g(a); }; });

  // ---------- 1. константы, отображение ----------
  const K = await p.evaluate(() => {
    const o = {};
    o.max = [durMax({ t: 'w', id: 'sword' }), durMax({ t: 'w', id: 'sword', steel: true }), durMax({ t: 'w', id: 'sword', art: 'falling-star' }), durMax({ t: 'a', id: 'leather' }), durMax({ t: 'a', id: 'chainmail', steel: true })];
    o.dflt = durOf({ t: 'w', id: 'sword' });
    o.name = itemOf({ t: 'w', id: 'sword', dur: 0, broken: true }).name;
    o.live = itemOf({ t: 'w', id: 'sword', dur: 4 }).name;
    const c = state.party[0]; c.bag = []; c.equip = { main: { t: 'w', id: 'sword', dur: 7 } };
    showItemInfo(c.equip.main, c); o.info = document.getElementById('iteminfo').innerHTML;
    o.infoBuf = durLine({ t: 'w', id: 'sword', dur: 7, buf: 20 });
    o.infoBroken = durLine({ t: 'w', id: 'sword', dur: 0, broken: true });
    o.noDurForGear = durLine({ t: 'g', id: 'ration' }) === '';
    return o;
  });
  ok('прочность: 10 / 30 / 50 (обычное, стальное, артефакт, броня)', JSON.stringify(K.max) === '[10,30,50,10,30]', K.max);
  ok('нет поля dur = полная прочность', K.dflt === 10, K.dflt);
  ok('сломанное: « (сломано)» в названии', /\(сломано\)$/.test(K.name) && !/сломано/.test(K.live), [K.name, K.live]);
  ok('зажатие: окно показывает «Прочность 7/10»', /Прочность[^<]*<b>7\/10<\/b>/.test(K.info), K.info.slice(0, 400));
  ok('временная прочность амулета видна', /\+20 временной/.test(K.infoBuf), K.infoBuf);
  ok('в окне сломанного: «сломано, пользоваться нельзя»', /сломано, пользоваться нельзя/.test(K.infoBroken), K.infoBroken);
  ok('у расходников прочности нет', K.noDurForGear);
  await p.evaluate(() => { document.getElementById('iteminfo').hidden = true; });

  // ---------- 2. износ в бою: критический промах, натуральная 20 ----------
  const W = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const o = {};
    const setHero = (main, body, off) => { const c = state.party[0]; c.bag = []; c.equip = { main, ...(body ? { body } : {}), ...(off ? { off } : {}) }; return c; };
    const fight = list => { B.newBattle({ list: list || ['goblin'], zone: 'goblin', floor: 1 }); B.S.opts.autoHeroes = true; return { h: B.heroes()[0], m: B.S.units.find(u => u.side === 'mon') }; };
    const atkOf = (h, id) => B.heroAttacks(h).find(a => a.id === id);
    const rnd0 = Math.random;
    const withRoll = async (val, fn) => { window.__nat = Math.floor(val * 20); try { return await fn(); } finally { window.__nat = null; } };
    // меч, натуральная 1
    let c = setHero({ t: 'w', id: 'sword' }); let { h, m } = fight(); m.x = h.x; m.y = h.y - 1;
    await withRoll(0, () => B.doAttack(h, m, atkOf(h, 'hand:sword'), {}));
    o.crit1 = c.equip.main.dur;
    // натуральная 20 героя оружие не портит; обычный промах тоже
    await withRoll(0.999, () => B.doAttack(h, m, atkOf(h, 'hand:sword'), {})); o.nat20hero = c.equip.main.dur;
    m.hp = 999; m.maxHp = 999;
    // обычный промах (натуральная 2): не износ
    await withRoll(0.06, () => B.doAttack(h, m, atkOf(h, 'hand:sword'), {})); o.nat2 = c.equip.main.dur;
    // стальной меч: 30 → 29
    c = setHero({ t: 'w', id: 'sword', steel: true }); ({ h, m } = fight()); m.x = h.x; m.y = h.y - 1;
    await withRoll(0, () => B.doAttack(h, m, atkOf(h, 'hand:sword'), {})); o.steel = c.equip.main.dur;
    // артефактное оружие: 50 → 49
    c = setHero({ t: 'w', id: 'sword', art: 'echo-blade' }); ({ h, m } = fight()); m.x = h.x; m.y = h.y - 1;
    const aa = B.heroAttacks(h).find(a => /sword|echo/.test(a.id));
    if (aa) await withRoll(0, () => B.doAttack(h, m, aa, {})); o.art = c.equip.main.dur;
    // лук тоже портится
    c = setHero({ t: 'w', id: 'shortbow' }); ({ h, m } = fight()); m.x = h.x; m.y = h.y - 3;
    const bow = B.heroAttacks(h).find(a => /shortbow/.test(a.id));
    if (bow) await withRoll(0, () => B.doAttack(h, m, bow, {})); o.bow = c.equip.main.dur;
    // оружие во второй руке портится само, основное цело (атака «Второй рукой» строится по atk.slot === "off")
    c = setHero({ t: 'w', id: 'dagger' }, null, { t: 'w', id: 'dagger' }); ({ h, m } = fight());
    B.wearWeapon(h, { w: { id: 'dagger' }, slot: 'off', offhand: true }); o.off = [c.equip.main.dur, c.equip.off.dur];
    // кулак, факел и метание из пустой руки не портят ничего
    c = setHero({ t: 'w', id: 'sword' }); ({ h, m } = fight()); B.wearWeapon(h, { id: 'fist' }); B.wearWeapon(h, { w: null }); o.fist = c.equip.main.dur;
    // броня: натуральная 20 монстра
    c = setHero({ t: 'w', id: 'sword' }, { t: 'a', id: 'leather' }); ({ h, m } = fight()); m.x = h.x; m.y = h.y - 1;
    const matk = B.attacksOf(m)[0];
    await withRoll(0.999, () => B.doAttack(m, h, matk, {})); o.armor20 = c.equip.body.dur;
    await withRoll(0.9, () => B.doAttack(m, h, matk, {})); o.armor19 = c.equip.body.dur;         // натуральная 19 — не износ
    await withRoll(0.0, () => B.doAttack(m, h, matk, {})); o.armor1 = c.equip.body.dur;          // монстр промахнулся (1) — не износ
    // щит принимает износ, если надет вместо брони
    c = setHero({ t: 'w', id: 'sword' }, null, { t: 'w', id: 'shield' }); ({ h, m } = fight()); m.x = h.x; m.y = h.y - 1;
    await withRoll(0.999, () => B.doAttack(m, h, B.attacksOf(m)[0], {})); o.shield = c.equip.off.dur;
    // КД падает, когда доспех ломается
    c = setHero({ t: 'w', id: 'sword' }, { t: 'a', id: 'chainmail', dur: 1 }); ({ h, m } = fight()); m.x = h.x; m.y = h.y - 1;
    const ac0 = h.ac; await withRoll(0.999, () => B.doAttack(m, h, B.attacksOf(m)[0], {}));
    o.brk = { broken: !!(c.bag.concat(Object.values(c.equip)).find(e => e.id === 'chainmail' && e.broken)), acDrop: ac0 - h.ac, inBag: c.bag.some(e => e.id === 'chainmail' && e.broken), onBody: !!c.equip.body };
    return o;
  });
  ok('критический промах (1): меч 10 → 9', W.crit1 === 9, W.crit1);
  ok('натуральная 20 героя и обычный промах оружие не портят', W.nat20hero === 9 && W.nat2 === 9, [W.nat20hero, W.nat2]);
  ok('стальное оружие 30 → 29', W.steel === 29, W.steel);
  ok('артефактное оружие 50 → 49', W.art === 49, W.art);
  ok('лук тоже теряет прочность', W.bow === 9, W.bow);
  ok('оружие во второй руке портится само (основное цело)', W.off && W.off[0] == null && W.off[1] === 9 || (W.off && W.off[0] === 10 && W.off[1] === 9), W.off);
  ok('кулак и действие без оружия прочность не тратят', W.fist == null || W.fist === 10, W.fist);
  ok('натуральная 20 монстра: броня 10 → 9', W.armor20 === 9, W.armor20);
  ok('натуральная 19 и промах монстра броню не портят', W.armor19 === 9 && W.armor1 === 9, [W.armor19, W.armor1]);
  ok('без брони износ принимает щит', W.shield === 9, W.shield);
  ok('доспех на 1 прочности ломается: «(сломано)», уходит в рюкзак, КД падает', W.brk.broken && W.brk.inBag && !W.brk.onBody && W.brk.acDrop > 0, W.brk);

  // ---------- 3. поломка оружия: нельзя использовать ----------
  const BR = await p.evaluate(async () => {
    const B = Battle, o = {}, c = state.party[0], rnd0 = Math.random;
    c.bag = []; c.equip = { main: { t: 'w', id: 'sword', dur: 1 } };
    B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); B.S.opts.autoHeroes = true;
    const h = B.heroes()[0], m = B.S.units.find(u => u.side === 'mon'); m.x = h.x; m.y = h.y - 1; m.hp = m.maxHp = 999;
    window.__nat = Math.floor(0 * 20); try { await B.doAttack(h, m, B.heroAttacks(h).find(a => a.id === 'hand:sword'), {}); } finally { window.__nat = null; }
    o.main = c.equip.main || null; o.bag = c.bag.map(e => ({ id: e.id, broken: !!e.broken, dur: e.dur }));
    o.mainOf = B.mainOf(h) === null || B.mainOf(h) === undefined;
    o.attacks = B.heroAttacks(h).map(a => a.id);
    o.nameInBag = itemOf(c.bag[0]).name;
    // рюкзак полон: сломанное остаётся в руке, но не работает
    c.bag = Array.from({ length: bagSize(c) }, (_, i) => ({ t: 'w', id: 'dagger', qty: 1, steel: !(i % 2), salt: false, mark: i }));
    c.bag.forEach((e, i) => { e.id = ['dagger', 'spear', 'sword', 'mace'][i % 4]; e.steel = true; e.dur = 5 + (i % 3); });
    c.equip = { main: { t: 'w', id: 'sword', dur: 1 } };
    B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); B.S.opts.autoHeroes = true;
    const h2 = B.heroes()[0], m2 = B.S.units.find(u => u.side === 'mon'); m2.x = h2.x; m2.y = h2.y - 1; m2.hp = m2.maxHp = 999;
    window.__nat = Math.floor(0 * 20); try { await B.doAttack(h2, m2, B.heroAttacks(h2).find(a => a.id === 'hand:sword'), {}); } finally { window.__nat = null; }
    o.full = { inHand: !!(c.equip.main && c.equip.main.broken), usable: B.mainOf(h2) === null || B.mainOf(h2) === undefined, ids: B.heroAttacks(h2).map(a => a.id) };
    return o;
  });
  ok('меч на 1: критический промах ломает, рука пуста, меч в рюкзаке', !BR.main && BR.bag.length === 1 && BR.bag[0].broken && BR.bag[0].dur === 0, BR);
  ok('сломанное в рюкзаке подписано «(сломано)»', /\(сломано\)/.test(BR.nameInBag), BR.nameInBag);
  ok('сломанным оружием атаковать нельзя', BR.mainOf && !BR.attacks.includes('hand:sword'), BR.attacks);
  ok('рюкзак полон: сломанное остаётся в руке, но не работает', BR.full.inHand && BR.full.usable && !BR.full.ids.includes('hand:sword'), BR.full);

  // ---------- 4. экипировка сломанного, сохранение прочности ----------
  const EQ = await p.evaluate(() => {
    const o = {}, c = state.party[0];
    c.bag = [{ t: 'w', id: 'sword', qty: 1, dur: 0, broken: true }]; c.equip = {};
    openHero(c.id); heroUi.tab = 'inv'; renderHero(); heroUi.sel = 0; renderHero();
    const btn = document.querySelector('#heroov [data-hx="equip"][data-slot-to="main"]'); if (btn) btn.click();
    o.brokenEquipped = !!c.equip.main;
    c.bag = [{ t: 'w', id: 'sword', qty: 1, dur: 4, steel: true }]; heroUi.sel = 0; renderHero();
    const b2 = document.querySelector('#heroov [data-hx="equip"][data-slot-to="main"]'); if (b2) b2.click();
    o.dur = c.equip.main && c.equip.main.dur; o.steel = c.equip.main && c.equip.main.steel;
    const u = document.querySelector('#heroov [data-hx="unequip"]'); heroUi.slot = 'main'; renderHero(); const u2 = document.querySelector('#heroov [data-hx="unequip"]'); if (u2) u2.click();
    o.back = c.bag.find(e => e.id === 'sword'); closeHero();
    return o;
  });
  ok('сломанное надеть нельзя', EQ.brokenEquipped === false, EQ);
  ok('при экипировке и снятии прочность и сталь сохраняются', EQ.dur === 4 && EQ.steel === true && EQ.back && EQ.back.dur === 4 && EQ.back.steel === true, EQ);

  // ---------- 5. амулет несокрушимости ----------
  const UN = await p.evaluate(async () => {
    const B = Battle, o = {}, c = state.party[0], rnd0 = Math.random;
    c.bag = []; c.equip = { main: { t: 'w', id: 'sword' }, body: { t: 'a', id: 'leather' }, charm: { t: 'g', id: 'unbreakable-charm' } };
    B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); B.S.opts.autoHeroes = true;
    const h = B.heroes()[0], m = B.S.units.find(u => u.side === 'mon'); m.x = h.x; m.y = h.y - 1; m.hp = m.maxHp = 999;
    window.__nat = Math.floor(0 * 20); try { for (let i = 0; i < 3; i++) await B.doAttack(h, m, B.heroAttacks(h).find(a => a.id === 'hand:sword'), {}); } finally { window.__nat = null; }
    o.weapon = durOf(c.equip.main);
    window.__nat = Math.floor(0.999 * 20); try { await B.doAttack(m, h, B.attacksOf(m)[0], {}); } finally { window.__nat = null; }
    o.armor = durOf(c.equip.body);            // броня амулетом не защищена (решение автора: «всё оружие»)
    o.slot = GEAR['unbreakable-charm'].slot;
    return o;
  });
  ok('амулет несокрушимости: оружие не теряет прочность, броня теряет', UN.weapon === 10 && UN.armor === 9 && UN.slot === 'charm', UN);

  // ---------- 6. амулет прочности: +20 временных ----------
  const DU = await p.evaluate(async () => {
    const B = Battle, o = {}, c = state.party[0], rnd0 = Math.random;
    c.bag = [{ t: 'w', id: 'spear', qty: 1, dur: 3 }, { t: 'w', id: 'mace', qty: 1, dur: 0, broken: true }];
    c.equip = { main: { t: 'w', id: 'sword', dur: 2 }, body: { t: 'a', id: 'leather' }, charm: { t: 'g', id: 'durable-charm' } };
    B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); B.S.opts.autoHeroes = true;     // heroUnit вызывает durAmulet
    o.buf = [c.equip.main.buf, c.equip.body.buf, c.bag[0].buf, c.bag[1].buf];
    const h = B.heroes()[0], m = B.S.units.find(u => u.side === 'mon'); m.x = h.x; m.y = h.y - 1; m.hp = m.maxHp = 999;
    window.__nat = Math.floor(0 * 20); try { for (let i = 0; i < 3; i++) await B.doAttack(h, m, B.heroAttacks(h).find(a => a.id === 'hand:sword'), {}); } finally { window.__nat = null; }
    o.afterHits = { dur: c.equip.main.dur, buf: c.equip.main.buf, broken: !!c.equip.main.broken };      // 2 настоящих сняты первыми, потом временные
    o.shown = durLine(c.equip.main);
    // снять амулет, пока у вещи нет настоящей прочности → сразу ломается, повторное надевание не помогает
    delete c.equip.charm; durAmulet(c);
    o.afterRemove = { broken: !!(c.equip.main && c.equip.main.broken) || c.bag.some(e => e.id === 'sword' && e.broken), bufGone: c.equip.body.buf == null && c.bag[0].buf == null };
    o.spearOk = !c.bag[0].broken && c.bag[0].dur === 3;
    c.equip.charm = { t: 'g', id: 'durable-charm' }; durAmulet(c);
    o.swordStillBroken = c.bag.some(e => e.id === 'sword' && e.broken) || !!(c.equip.main && c.equip.main.broken);
    o.bufAgain = c.equip.body.buf;
    return o;
  });
  ok('амулет прочности: у целых вещей +20 временных, у сломанных нет', DU.buf[0] === 20 && DU.buf[1] === 20 && DU.buf[2] === 20 && DU.buf[3] == null, DU.buf);
  ok('износ: сначала настоящая прочность, временные отнимаются в последнюю очередь', DU.afterHits.dur === 0 && DU.afterHits.buf === 19 && !DU.afterHits.broken, DU.afterHits);
  ok('при 0 настоящей и временных >0 вещь не ломается и показывает +N', /\+19 временной/.test(DU.shown), DU.shown);
  ok('снять амулет: вещь без настоящей прочности ломается, остальные теряют только временные', DU.afterRemove.broken && DU.afterRemove.bufGone && DU.spearOk, DU.afterRemove);
  ok('снова надеть амулет: сломанная вещь не чинится, у целых опять +20', DU.swordStillBroken && DU.bufAgain === 20, DU);

  // ---------- 7. ремонт: числа ----------
  const RP = await p.evaluate(() => {
    const o = {}, hum = state.party[0], dw = state.party[1];
    const amt = c => ({ kit: repairAmount(c, 'repair-kit'), pro: repairAmount(c, 'repair-kit-pro'), whet: repairAmount(c, 'whetstone'), ham: repairAmount(c, 'daedalus-hammer') });
    o.hum0 = amt(hum); o.dw0 = amt(dw);
    state.academy = state.academy || {}; hum.edu = hum.edu || {}; dw.edu = dw.edu || {};
    const learn = (c, id) => { c.edu = c.edu || {}; c.edu[id] = true; };
    learn(hum, 'rep1'); learn(dw, 'rep1'); o.hum1 = amt(hum); o.dw1 = amt(dw);
    learn(hum, 'rep2'); learn(dw, 'rep2'); o.hum2 = amt(hum); o.dw2 = amt(dw);
    o.lvl = [repairLevel(hum), repairLevel(dw)];
    o.ops = [repairOps(hum, {}), repairOps(dw, {}), repairOps(dw, { fixFat: { [dw.id]: 1 } }), repairOps(dw, { fixFat: { [dw.id]: 2 } }), repairOps(hum, { fixFat: { [hum.id]: 3 } })];
    hum.edu = {}; dw.edu = {};
    return o;
  });
  ok('набор: обычные расы +3, дварф +5', RP.hum0.kit === 3 && RP.dw0.kit === 5, [RP.hum0, RP.dw0]);
  ok('продвинутый набор: 13 / 15', RP.hum0.pro === 13 && RP.dw0.pro === 15, [RP.hum0, RP.dw0]);
  ok('точильный камень как простой набор (3 / 5), молот Дедала как хороший (13 / 15)', RP.hum0.whet === 3 && RP.dw0.whet === 5 && RP.hum0.ham === 13 && RP.dw0.ham === 15, [RP.hum0, RP.dw0]);
  ok('«Ученик ремонта»: +3 обычным, +5 дварфам', RP.hum1.kit === 6 && RP.dw1.kit === 10 && RP.hum1.pro === 16 && RP.dw1.pro === 20, [RP.hum1, RP.dw1]);
  ok('«Мастер ремонта»: +9 обычным, +15 дварфам (вместо ученика)', RP.hum2.kit === 12 && RP.dw2.kit === 20 && RP.hum2.pro === 22 && RP.dw2.pro === 30 && JSON.stringify(RP.lvl) === '[2,2]', [RP.hum2, RP.dw2, RP.lvl]);
  ok('число починок за ночь: обычный 1, дварф 2 (+2 за каждую потраченную усталость)', JSON.stringify(RP.ops) === '[1,2,4,6,1]', RP.ops);

  // ---------- 8. ремонт на ночлеге: полный цикл через «Отдых» ----------
  const RS = await p.evaluate(() => {
    const o = {}, r = state.run, hum = state.party[0], dw = state.party[1], ar = state.party[2];
    const prep = () => {
      r.day = 3; r.act = 1; r.cd = r.cd || {};
      state.party.forEach(c => { c.bag = []; c.equip = {}; c.hp = 1; r.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; delete c.edu; addToBag(c, { t: 'g', id: 'ration', qty: 6 }); });
      hum.equip = { main: { t: 'w', id: 'sword', dur: 2 }, body: { t: 'a', id: 'leather', dur: 1 } };
      dw.equip = { main: { t: 'w', id: 'warhammer', dur: 1 }, off: { t: 'w', id: 'shield', dur: 3 } };
      ar.equip = { main: { t: 'w', id: 'shortbow', dur: 1, steel: true } };
      addToBag(hum, { t: 'g', id: 'repair-kit', qty: 5 }); addToBag(ar, { t: 'g', id: 'repair-kit-pro', qty: 2 });
    };
    const rest = (fix, extra = {}) => {
      dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 1])), ng: true, fix, fixBy: fix[0] && fix[0].by, fixFat: {}, ...extra };
      act('rest');
    };
    const kits = () => state.party.reduce((a, c) => a + countGear(c, 'repair-kit'), 0), pro = () => state.party.reduce((a, c) => a + countGear(c, 'repair-kit-pro'), 0);
    // а) обычный герой: 1 починка, набор тратится, +3
    prep(); rest([{ by: hum.id, hid: hum.id, src: 'eq:main', tool: 'repair-kit' }, { by: hum.id, hid: hum.id, src: 'eq:body', tool: 'repair-kit' }]);
    o.a = { sword: hum.equip.main.dur, leather: hum.equip.body.dur, kits: kits() };            // вторая починка не проходит: у обычного героя 1 ход
    // б) дварф чинит чужое и своё сразу двумя наборами (+5 каждому), усталость обычная
    prep(); rest([{ by: dw.id, hid: hum.id, src: 'eq:body', tool: 'repair-kit' }, { by: dw.id, hid: dw.id, src: 'eq:main', tool: 'repair-kit' }]);
    o.b = { leather: hum.equip.body.dur, hammer: dw.equip.main.dur, kits: kits(), fat: r.status[dw.id].fat, fatHum: r.status[hum.id].fat };
    // в) дварф: усталость на починку 1 → сон не снимает усталость; починок всё те же 2 + ещё 2
    prep(); r.status[dw.id].fat = 2;
    rest([{ by: dw.id, hid: hum.id, src: 'eq:main', tool: 'repair-kit' }, { by: dw.id, hid: hum.id, src: 'eq:body', tool: 'repair-kit' }, { by: dw.id, hid: dw.id, src: 'eq:off', tool: 'repair-kit' }, { by: dw.id, hid: dw.id, src: 'eq:main', tool: 'repair-kit' }], { fixFat: { [dw.id]: 1 } });
    o.c = { fat: r.status[dw.id].fat, sword: hum.equip.main.dur, shield: dw.equip.off.dur, hammer: dw.equip.main.dur, kits: kits() };
    // г) дварф: усталость 2 → не снимается и +1
    prep(); r.status[dw.id].fat = 1;
    rest([{ by: dw.id, hid: dw.id, src: 'eq:main', tool: 'repair-kit' }], { fixFat: { [dw.id]: 2 } });
    o.d = { fat: r.status[dw.id].fat };
    // д) продвинутый набор +13 / дварф +15, один набор уходит из рюкзака лучницы
    prep(); rest([{ by: hum.id, hid: ar.id, src: 'eq:main', tool: 'repair-kit-pro' }]);
    o.e = { bow: ar.equip.main.dur, pro: pro() };
    prep(); rest([{ by: dw.id, hid: ar.id, src: 'eq:main', tool: 'repair-kit-pro' }]);
    o.e2 = { bow: ar.equip.main.dur, pro: pro() };
    // е) сломанное чинится набором, получая прочность и снимая метку
    prep(); hum.equip.main = { t: 'w', id: 'sword', dur: 0, broken: true }; rest([{ by: hum.id, hid: hum.id, src: 'eq:main', tool: 'repair-kit' }]);
    o.f = { dur: hum.equip.main.dur, broken: !!hum.equip.main.broken, name: itemOf(hum.equip.main).name };
    // ж) обычный набор в рюкзаке: починка не выше максимума
    prep(); hum.equip.main.dur = 9; rest([{ by: hum.id, hid: hum.id, src: 'eq:main', tool: 'repair-kit' }]); o.g = hum.equip.main.dur;
    // з) курс ученик: набор +6
    prep(); hum.edu = { rep1: true }; rest([{ by: hum.id, hid: hum.id, src: 'eq:main', tool: 'repair-kit' }]); o.h = hum.equip.main.dur; hum.edu = {};
    // и) без наборов починка не происходит
    prep(); state.party.forEach(c => { c.bag = c.bag.filter(e => !/^repair/.test(e.id)); }); rest([{ by: hum.id, hid: hum.id, src: 'eq:main', tool: 'repair-kit' }]); o.i = hum.equip.main.dur;
    return o;
  });
  ok('ночлег: обычный герой чинит одну вещь на 3, набор тратится', RS.a.sword === 5 && RS.a.leather === 1 && RS.a.kits === 4, RS.a);
  ok('ночлег: дварф чинит сразу две вещи (чужую и свою) на 5 каждую', RS.b.leather === 6 && RS.b.hammer === 6 && RS.b.kits === 3, RS.b);
  ok('дварф без траты усталости: сон снимает усталость как обычно', RS.b.fat === 0 && RS.b.fatHum === 0, RS.b);
  ok('усталость на починку 1: сон не снимает усталость, починок 4 (+2)', RS.c.fat === 2 && RS.c.sword === 7 && RS.c.shield === 8 && RS.c.hammer === 6 && RS.c.kits === 1, RS.c);
  ok('усталость на починку 2: усталость растёт на 1', RS.d.fat === 2, RS.d);
  ok('продвинутый набор: +13 обычному, +15 дварфу', RS.e.bow === 14 && RS.e.pro === 1 && RS.e2.bow === 16 && RS.e2.pro === 1, [RS.e, RS.e2]);
  ok('сломанное оружие наборами чинится и снова годно', RS.f.dur === 3 && !RS.f.broken && !/сломано/.test(RS.f.name), RS.f);
  ok('починка не выше максимума', RS.g === 10, RS.g);
  ok('курс «Ученик ремонта»: набор даёт +6', RS.h === 8, RS.h);
  ok('без наборов починки нет', RS.i === 2, RS.i);

  // ---------- 9. артефакты-инструменты ----------
  const AT = await p.evaluate(() => {
    const o = {}, r = state.run, hum = state.party[0], dw = state.party[1];
    state.party.forEach(c => { c.bag = []; c.equip = {}; delete c.edu; r.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; addToBag(c, { t: 'g', id: 'ration', qty: 6 }); });
    hum.equip = { main: { t: 'w', id: 'sword', steel: true, dur: 1 } }; addToBag(hum, { t: 'g', id: 'whetstone', qty: 1 }); addToBag(dw, { t: 'g', id: 'daedalus-hammer', qty: 1 });
    r.day = 1; r.act = 1;
    const rest = fix => { dgUi.phase = 'rest'; dgUi.rest = { guard: {}, eat: Object.fromEntries(state.party.map(c => [c.id, 1])), ng: true, fix, fixBy: fix[0].by, fixFat: {} }; act('rest'); };
    rest([{ by: hum.id, hid: hum.id, src: 'eq:main', tool: 'whetstone' }]);
    o.w1 = hum.equip.main.dur; o.stone = countGear(hum, 'whetstone'); o.used = hum.bag.find(e => e.id === 'whetstone').used;
    // раз в 3 дня: на следующий день недоступен, через 3 — снова
    r.day = 2; o.w2avail = toolAvail('whetstone'); r.day = 4; r.act = 1; o.w3avail = toolAvail('whetstone');
    rest([{ by: hum.id, hid: hum.id, src: 'eq:main', tool: 'whetstone' }]); o.w3 = hum.equip.main.dur;
    // молот: +13 (дварф +15), раз в 2 дня
    r.day = 5; r.act = 1; hum.equip.main.dur = 1;
    rest([{ by: dw.id, hid: hum.id, src: 'eq:main', tool: 'daedalus-hammer' }]); o.h1 = hum.equip.main.dur; hum.equip.main.dur = 1;
    r.day = 6; o.hAvail = toolAvail('daedalus-hammer'); r.day = 7; o.hAvail2 = toolAvail('daedalus-hammer');
    o.cls = [GEAR.whetstone.cls, GEAR['daedalus-hammer'].cls]; o.notConsumed = countGear(dw, 'daedalus-hammer');
    return o;
  });
  ok('точильный камень: +3, не расходуется', AT.w1 === 4 && AT.stone === 1 && AT.used != null, AT);
  ok('точильный камень: раз в 3 дня', AT.w2avail === 0 && AT.w3avail === 1 && AT.w3 === 7, AT);
  ok('молот Дедала: +15 дварфу, раз в 2 дня, не расходуется', AT.h1 === 16 && AT.hAvail === 0 && AT.hAvail2 === 1 && AT.notConsumed === 1, AT);
  ok('классы артефактов: камень 9, молот 7', AT.cls[0] === 9 && AT.cls[1] === 7, AT.cls);

  // ---------- 10. амулеты конца дня ----------
  const AD = await p.evaluate(() => {
    const o = {}, r = state.run, [a, b, c] = state.party;
    state.party.forEach(x => { x.bag = []; x.equip = {}; });
    a.equip = { main: { t: 'w', id: 'sword', dur: 5 }, body: { t: 'a', id: 'leather', dur: 0, broken: true }, charm: { t: 'g', id: 'repair-charm' } };
    b.equip = { charm: { t: 'g', id: 'regen-charm' } }; b.hp = 3; b.mp = 0;
    c.equip = { charm: { t: 'g', id: 'mana-charm' } }; c.mp = 0;
    r.status[a.id] = { fat: 2, sat: 2, starve: 0, awake: 0 }; r.status[b.id] = { fat: 3, sat: 2, starve: 2, awake: 0 }; r.status[c.id] = { fat: 3, sat: 2, starve: 0, awake: 0 };
    r.day = 2; r.act = FL().acts; r.log = [];
    advanceTime();                                    // конец дня → амулеты
    o.day = r.day;
    o.repair = [a.equip.main.dur, a.equip.body.dur, !!a.equip.body.broken];
    o.regen = hpOf(b) - 3; o.mana = mpOf(c);
    b.equip.charm = { t: 'g', id: 'fatigue-charm' }; c.equip.charm = { t: 'g', id: 'hunger-charm' };
    const f0 = r.status[b.id].fat; amuletDayEnd(); o.fat = f0 - r.status[b.id].fat;
    o.hungry = r.status[c.id].sat; o.starve = r.status[b.id].starve;
    // не за мёртвого
    b.dead = true; const f1 = r.status[b.id].fat; amuletDayEnd(); o.dead = f1 === r.status[b.id].fat; b.dead = false;
    return o;
  });
  ok('конец дня: смена дня запустилась', AD.day === 3, AD.day);
  ok('амулет починки: вся экипировка +1 прочность (сломанная тоже оживает)', AD.repair[0] === 6 && AD.repair[1] === 1 && AD.repair[2] === false, AD.repair);
  ok('амулет регенерации: +2 ОЗ', AD.regen === 2, AD.regen);
  ok('амулет маны: +2 маны', AD.mana === 2, AD.mana);
  ok('амулет усталости: −1 Усталость в конце дня', AD.fat === 1, AD.fat);
  ok('амулет голода утоляет голод', AD.hungry >= 5, AD.hungry);
  ok('амулеты не работают на мёртвом', AD.dead);

  // ---------- 11. дроп и каталог артефактов ----------
  const DR = await p.evaluate(() => {
    const o = {}, ids = ['whetstone', 'daedalus-hammer', 'unbreakable-charm', 'repair-charm', 'durable-charm', 'regen-charm', 'mana-charm', 'fatigue-charm', 'hunger-charm'];
    const want = { whetstone: 9, 'daedalus-hammer': 7, 'unbreakable-charm': 6, 'repair-charm': 9, 'durable-charm': 8, 'regen-charm': 8, 'mana-charm': 9, 'fatigue-charm': 7, 'hunger-charm': 6 };
    o.pool = ids.every(id => (TREASURE_POOL[want[id]] || []).includes(id));
    o.cls = ids.every(id => ARTIFACTS[id] && ARTIFACTS[id].cls === want[id] && GEAR[id].cls === want[id]);
    o.slots = ['unbreakable-charm', 'repair-charm', 'durable-charm', 'regen-charm', 'mana-charm', 'fatigue-charm', 'hunger-charm'].every(id => GEAR[id].slot === 'charm');
    o.icons = ids.concat(['repair-kit', 'repair-kit-pro']).every(id => !!GEAR_ICON[id]);
    // реальные броски находки и сундука горнила: все новые встречаются (инвентарь отряда чистим — владение исключает предмет из выбора)
    const wipe = () => { state.party.forEach(c => { c.bag = []; c.equip = {}; }); Object.keys(TREASURES).forEach(id => { treasure(id).owned = false; }); };
    const seen = new Set();
    for (let i = 0; i < 8000; i++) { wipe(); try { treasureRoll(); } catch (e) { o.err = String(e); break; } for (const c of state.party) for (const e of c.bag) if (ids.includes(e.id)) seen.add(e.id); }
    o.seenRoll = ids.filter(id => seen.has(id));
    const seen2 = new Set(); for (let i = 0; i < 4000; i++) { wipe(); try { const x = fireChestRoll(true); if (x && x.id) seen2.add(x.id); } catch (e) { o.err2 = String(e); break; } }
    o.seenChest = ids.filter(id => seen2.has(id));
    wipe(); o.pick = {}; for (const cls of [9, 8, 7, 6]) { const s = new Set(); for (let i = 0; i < 600; i++) s.add(treasurePick(cls)); o.pick[cls] = [...s].filter(id => ids.includes(id)).sort(); }
    // получение: попадает в библиотеку артефактов, имя скрыто до определения
    const c = state.party[0]; c.bag = []; c.equip = {};
    addToBag(c, { t: 'g', id: 'durable-charm', qty: 1 }); o.inLib = !!artState().seen['durable-charm'];
    return o;
  });
  ok('все девять новых артефактов в стандартном дропе нужных классов', DR.pool, DR);
  ok('классы артефактов: 9/7/6/9/8/8/9/7/6', DR.cls);
  ok('амулеты носятся в слоте charm', DR.slots);
  ok('у всех новых предметов есть иконка', DR.icons);
  ok('выбор по классу выдаёт новые артефакты (9: 3, 8: 2, 7: 2, 6: 2)', DR.pick[9].length === 3 && DR.pick[8].length === 2 && DR.pick[7].length === 2 && DR.pick[6].length === 2, DR.pick);
  ok('реальный бросок находки: выпадают предметы 9, 8, 7 и 6 класса', DR.seenRoll.length >= 7 && !DR.err, [DR.seenRoll, DR.err]);
  ok('сундук горнила тоже может дать новые артефакты', DR.seenChest.length >= 3 && !DR.err2, [DR.seenChest, DR.err2]);
  ok('получение артефакта записывает его в библиотеку', DR.inLib);

  // ---------- 12. кузница: товары и вкладка «Починка» ----------
  await p.evaluate(() => { state.run = null; state.townUnlocked = true; state.party.forEach(c => { c.gold = 500; c.bag = []; c.equip = {}; }); location.hash = 'town'; rerender(); });
  await p.waitForTimeout(300);
  await p.click('[data-bld="forge"]'); await p.waitForSelector('.tw-shop');
  const base = await p.evaluate(() => [...document.querySelectorAll('.tw-slot')].map(s => s.getAttribute('aria-label')));
  ok('кузница: ремонтный набор ×5 за 10 и продвинутый ×5 за 50', base.some(x => /Ремонтный набор.*10 монет/.test(x)) && base.some(x => /Продвинутый ремонтный набор.*50 монет/.test(x)), base.slice(-3));
  await p.click('[data-t="stock"][data-id="repair5"]'); await p.click('[data-t="buy"][data-n="1"]');
  await p.click('[data-t="stock"][data-id="repairpro5"]'); await p.click('[data-t="buy"][data-n="1"]');
  const bought = await p.evaluate(() => { const c = state.party[0]; return { kit: countGear(c, 'repair-kit'), pro: countGear(c, 'repair-kit-pro'), gold: c.gold }; });
  ok('куплено 5 наборов и 5 продвинутых за 60 монет', bought.kit === 5 && bought.pro === 5 && bought.gold === 440, bought);
  await L.shot(p, 'dur-forge-base');

  await p.evaluate(() => {
    const c = state.party[0]; c.bag = [{ t: 'w', id: 'mace', qty: 1, dur: 0, broken: true }, { t: 'a', id: 'chainmail', qty: 1, steel: true, dur: 0, broken: true }, { t: 'w', id: 'spear', qty: 1, steel: true, dur: 0, broken: true }];
    c.equip = { main: { t: 'w', id: 'sword', dur: 4 }, body: { t: 'a', id: 'leather', dur: 9 }, off: { t: 'w', id: 'shield', dur: 10 } };
    c.gold = 100; state.party[1].gold = 0; state.party[2].gold = 0; rerender();
  });
  await p.click('[data-t="ftab"][data-k="fix"]'); await p.waitForSelector('[data-t="fixone"]');
  const fx = await p.evaluate(() => [...document.querySelectorAll('[data-t="fixone"]')].map(b => ({ k: b.dataset.k, price: +b.textContent.trim(), row: b.closest('.tw-row').textContent.replace(/\s+/g, ' ').trim() })));
  await L.shot(p, 'dur-forge-fix');
  const priceOf = k => (fx.find(x => x.k === k) || {}).price;
  ok('починка: целая вещь 5 монет', priceOf('eq:main') === 5 && priceOf('eq:body') === 5, fx);
  ok('починка: сломанная палица 20 % от 10 = 2, стальная кольчуга 20 % от 40 = 8, стальное копьё 20 % от 25 = 5', priceOf('bag:0') === 2 && priceOf('bag:1') === 8 && priceOf('bag:2') === 5, fx);
  ok('починка: щит на полной прочности в списке не показан', !fx.some(x => x.k === 'eq:off'), fx);
  ok('в строке видно «прочность 4/10» и «сломано»', fx.some(x => /4\/10/.test(x.row)) && fx.some(x => /сломано/.test(x.row)), fx.map(x => x.row));
  await p.click('[data-t="fixone"][data-k="bag:1"]');
  const f1 = await p.evaluate(() => { const c = state.party[0]; return { gold: c.gold, e: c.bag[1] }; });
  ok('кольчуга починена до максимума 30 за 8 монет', f1.gold === 92 && f1.e.dur === 30 && !f1.e.broken, f1);
  await p.click('[data-t="fixone"][data-k="eq:main"]');
  const f2 = await p.evaluate(() => { const c = state.party[0]; return { gold: c.gold, d: c.equip.main.dur }; });
  ok('меч 4/10 → 10/10 за 5', f2.gold === 87 && f2.d === 10, f2);
  await p.evaluate(() => { const c = state.party[0]; c.equip.main.dur = 3; c.equip.body.dur = 2; c.equip.off.dur = 5; rerender(); });
  await p.click('[data-t=\"ftab\"][data-k=\"fix\"]');
  const setBtn = await p.evaluate(() => { const b = document.querySelector('[data-t="fixset"]'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : null; });
  ok('кнопка комплекта: оружие + броня + второе оружие за 10', /\(3\)/.test(setBtn || '') && /10$/.test(setBtn || ''), setBtn);
  await p.click('[data-t="fixset"]');
  const f3 = await p.evaluate(() => { const c = state.party[0]; return { gold: c.gold, d: [c.equip.main.dur, c.equip.body.dur, c.equip.off.dur] }; });
  ok('комплект починен за 10 (3 вещи)', f3.gold === 77 && JSON.stringify(f3.d) === '[10,10,10]', f3);
  await p.evaluate(() => { const c = state.party[0]; c.gold = 1; c.bag[0].dur = 0; rerender(); });
  await p.click('[data-t=\"ftab\"][data-k=\"fix\"]');
  const dis = await p.evaluate(() => { const b = document.querySelector('[data-t="fixone"][data-k="bag:0"]'); return b && b.disabled; });
  ok('не хватает монет: кнопка недоступна', dis === true, dis);
  await p.evaluate(() => { const c = state.party[0]; c.gold = 0; state.party[1].gold = 0; state.party[2].gold = 40; rerender(); });
  await p.click('[data-t=\"ftab\"][data-k=\"fix\"]');
  await p.click('[data-t="fixone"][data-k="bag:0"]');
  const f4 = await p.evaluate(() => ({ e: state.party[0].bag[0], g: state.party.map(c => c.gold) }));
  ok('платит отряд, если у героя не хватает', !f4.e.broken && f4.e.dur === 10 && f4.g.reduce((a, x) => a + x, 0) === 38, f4);
  // артефакт: цена починки сломанного — 20 % его ценности
  const art = await p.evaluate(() => { const c = state.party[0]; c.gold = 9000; c.bag = [{ t: 'w', id: 'spear', qty: 1, art: 'thunder-spear', dur: 0, broken: true }]; c.equip = {}; return artValue('thunder-spear'); });
  await p.click('[data-t="ftab"][data-k="fix"]');
  const artPrice = await p.evaluate(() => { const b = document.querySelector('[data-t="fixone"][data-k="bag:0"]'); return b ? +b.textContent.trim() : null; });
  ok('сломанный артефакт: 20 % ценности', artPrice === Math.max(1, Math.round(art * 0.2)), [artPrice, art]);
  await p.click('[data-t="fixone"][data-k="bag:0"]');
  ok('артефакт после починки 50/50', await p.evaluate(() => state.party[0].bag[0].dur === 50 && !state.party[0].bag[0].broken));
  await p.click('[data-t="close"]');

  // ---------- 13. таверна: амулет починки ----------
  await p.evaluate(() => {
    state.run = null; state.townClock = state.townClock || {}; const c = state.party[0]; c.gold = 300; state.party[1].gold = 300;
    c.equip = { main: { t: 'w', id: 'sword', dur: 3 }, body: { t: 'a', id: 'leather', dur: 0, broken: true }, charm: { t: 'g', id: 'repair-charm' } };
    state.party[1].equip = { main: { t: 'w', id: 'warhammer', dur: 3 } };
    location.hash = 'town'; rerender();
  });
  await p.click('[data-bld="tavern"]'); await p.waitForSelector('.tw-rows');
  await p.click('[data-t="tv-all"]'); await p.click('[data-t="tv-pay"]');
  const tv = await p.evaluate(() => ({ sword: state.party[0].equip.main.dur, leather: state.party[0].equip.body.dur, broken: !!state.party[0].equip.body.broken, other: state.party[1].equip.main.dur }));
  ok('ночь в таверне: амулет починки +1 (и сломанное оживает), у остальных без изменений', tv.sword === 4 && tv.leather === 1 && !tv.broken && tv.other === 3, tv);

  await p.click('[data-t="close"]');
  // ---------- 14. академия ----------
  await p.evaluate(() => { state.run = null; const c = state.party[0]; c.gold = 6000; c.edu = {}; location.hash = 'town'; rerender(); });
  await p.click('[data-bld="academy"]'); await p.waitForSelector('.tw-rows');
  await p.click('[data-t="atab"][data-k="repair"]');
  const rows = await p.evaluate(() => [...document.querySelectorAll('.tw-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  ok('академия: группа «Ремонт» с двумя курсами', rows.length === 2 && /Ученик ремонта/.test(rows[0]) && /Мастер ремонта/.test(rows[1]), rows);
  await L.shot(p, 'dur-academy');
  const price = await p.evaluate(() => ({ r1: ACADEMY.find(k => k.id === 'rep1').price, r2: ACADEMY.find(k => k.id === 'rep2').price, need: ACADEMY.find(k => k.id === 'rep2').need }));
  ok('«Мастер ремонта» дороже «Ученика» и требует его', price.r2 > price.r1 * 2 && price.need === 'rep1', price);
  ok('«Мастер» без «Ученика» не продаётся (кнопка недоступна)', await p.evaluate(() => { const b = document.querySelector('[data-t="learn"][data-id="rep2"]'); return !!b && b.disabled && !eduKnows(state.party[0], 'rep2'); }));
  await p.click('[data-t="learn"][data-id="rep1"]');
  ok('«Ученик ремонта» выучен', await p.evaluate(() => eduKnows(state.party[0], 'rep1') && !eduKnows(state.party[1], 'rep1')));
  await p.click('[data-t="learn"][data-id="rep2"]');
  const learned = await p.evaluate(() => ({ m: eduKnows(state.party[0], 'rep2'), lvl: repairLevel(state.party[0]), gold: state.party[0].gold }));
  ok('после «Ученика» выучивается «Мастер»; золото списано', learned.m && learned.lvl === 2 && learned.gold === 6000 - price.r1 - price.r2, [learned, price]);
  await p.click('[data-t="close"]');

  // ---------- 15. сохранение/загрузка: поля прочности переживают перезапись ----------
  const SV = await p.evaluate(() => {
    const c = state.party[0]; c.equip = { main: { t: 'w', id: 'sword', dur: 6, buf: 20 }, charm: { t: 'g', id: 'durable-charm' } }; c.bag = [{ t: 'w', id: 'mace', qty: 1, dur: 0, broken: true }];
    saveChar(); const raw = JSON.parse(localStorage.getItem('sputnik.state.v2')); const q = raw.party[0];
    return { main: q.equip.main, bag: q.bag[0] };
  });
  ok('сохранение: dur, buf и broken записываются', SV.main.dur === 6 && SV.main.buf === 20 && SV.bag.broken === true && SV.bag.dur === 0, SV);

  ok('ошибок страницы нет', errs.length === 0, errs);
  const bad = R.filter(r => !r.ok).length;
  console.log(`${R.length - bad}/${R.length} проверок`);
  await b.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
