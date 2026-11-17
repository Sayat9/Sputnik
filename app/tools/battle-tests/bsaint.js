// 17.11: Браслет каменной святой — призыв, −30 % ОЗ/маны призвавшего, статы и уровни, без еды/усталости/опыта/эссенций, смерть (браслет −1, вещи призвавшему), отзыв при выходе, бой.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const mk = (id, n) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 5, rank: 6 }); ensureKit(c); return c; };
    state.party = [mk('p0', 'Аргон'), mk('p1', 'Борис')]; newRun(); const run = state.run; const a = state.party[0];
    a.equip.charm = { t: 'g', id: 'saint-bracelet', qty: 1 }; const hp0 = maxHp(a), mp0 = maxMp(a);
    o.noTown = (() => { const r0 = state.run; state.run = null; const w = saintSummon(a); state.run = r0; return /лабиринте/.test(w); })();
    o.summon = saintSummon(a) === null && state.party.length === 3; const s = saintOf();
    o.drain = maxHp(a) === Math.floor(hp0 * 0.7) && maxMp(a) === Math.floor(mp0 * 0.7);
    const t = totals(s); o.stats = t.str.total === 30 && t.con.total === 30 && t.dex.total === 10 && t.int.total === 20 && s.level === 1;
    state.party[1].equip.charm = { t: 'g', id: 'saint-bracelet', qty: 1 }; o.oneOnly = /уже/.test(saintSummon(state.party[1]) || ''); delete state.party[1].equip.charm;
    ensureRun(); const st = run.status[s.id]; st.fat = 0; st.sat = 3; for (let i = 0; i < 9; i++) tick(); o.noFatigue = st.fat === 0 && st.sat === 3 && eatRations(s, 1) === 1;
    const x0 = s.xp || 0; addXpAll(50); o.noXp = (s.xp || 0) === x0 && s.level === 1; o.noEss = /\/0$/.test(essSlots(s));
    // уровни
    sackAdd('goblin', 9, 120); const d0 = derived(totals(s), s); o.lvl2 = saintLevelUp(s) === null && s.level === 2 && totals(s).str.total === 34 && findBracelet('p0').slvl === 2;
    o.lvl3need = /Нужно 100 камней 8/.test(saintLevelUp(s) || '');
    s.level = 3; const d3 = derived(totals(s), s); o.lvl3 = totals(s).con.total === 34 && d3.prot - d0.prot >= 2;
    s.level = 4; o.lvl4 = bigRace(s) && totals(s).str.total === 36 && totals(s).con.total === 36;
    s.level = 5; o.lvl5 = totals(s).str.total === 40 && totals(s).con.total === 40 && heroSpeedM(s) >= 12; s.level = 2;
    // бой: неуязвимость, +2 к атакам
    await loadBattle(); const B = Battle; B.cfg.fast = true; const S = B.newBattle({ list: ['hobgoblin'], zone: 'goblin', floor: 2, kind: 'hard', title: 'x' }); B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); S.phase = 'fight'; B.running = true;
    const su = S.units.find(u => u.hero && u.hero.saint), m = S.units.find(u => u.side === 'mon'); const h0 = su.hp;
    await B.applyDamage(m, su, [{ v: 7, dt: 'poison', label: 'яд' }], { src: m }); o.immuneDmg = su.hp === h0 && B.immuneTo(su, 'poisoned') && B.immuneTo(su, 'frightened');
    const ctx = { mods: [] }; B.P['stone-saint'].attackMods(su, ctx); o.hit2 = ctx.mods.some(x => x.v === 2);
    // 5 ур.: призвавший гибнет — святая умирает вместо него, браслет сломан, он встаёт с полными ОЗ
    const au = S.units.find(u => u.hero === a); su.level = 5; await B.applyDamage(m, au, [{ v: 999, dt: 'slashing', label: 'x' }], { src: m });
    o.lvl5save = au.alive && !au.down && au.hp === au.maxHp && !su.alive && a.equip.charm.bhp === 0 && !a.dead;
    su.level = 2; su.alive = true; su.dead = false; su.down = false; s.dead = false; a.equip.charm.bhp = 3; su.hp = su.maxHp;
    au.hp = 1; await B.applyDamage(m, au, [{ v: 999, dt: 'slashing', label: 'x' }], { src: m }); o.lvl2nosave = !au.alive && a.equip.charm.bhp === 3;
    a.dead = false; s.level = 2;
    B.running = false; B.S = null;
    // гибель: браслет −1, вещи призвавшему, уровень хранится
    addToBag(s, { t: 'g', id: 'torch', qty: 3 }); const torches0 = countGear(a, 'torch'); s.dead = true; buryFallen();
    o.fall = !saintOf() && findBracelet('p0').bhp === 2 && countGear(a, 'torch') === torches0 + 3 && state.party.length === 2 && maxHp(a) === hp0;
    o.keepLvl = saintSummon(a) === null && saintOf().level === 2;
    // отзыв вручную и при выходе: вещи остаются в браслете
    addToBag(saintOf(), { t: 'g', id: 'potion', qty: 2 }); saintRecall(a); o.recall = !saintOf() && findBracelet('p0').sdata && findBracelet('p0').sdata.bag.some(e => e.id === 'potion');
    saintSummon(a); o.backItems = countGear(saintOf(), 'potion') === 2; endRun(true); o.endRecall = !state.party.some(c => c.saint) && state.party.length === 2;
    // игра окончена считается без святой
    newRun(); saintSummon(a); state.party.filter(c => !c.saint).forEach(c => c.dead = true); o.gameOver = typeof gameOverCheck === 'function';
    return o;
  });
  let bad = 0; for (const [k, v] of Object.entries(r)) if (v !== true) { bad++; console.log('  ✗', k, v); }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad += errs.length; } console.log(`проверок: ${Object.keys(r).length}, не прошли: ${bad}`); await b.close();
})();
