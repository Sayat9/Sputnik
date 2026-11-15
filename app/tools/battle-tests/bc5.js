// 15.11: монстры 5 класса (огр, мать-кладка, пожиратель магии, наездник ужаса, вечный страж руин), тролль (размах 2×2), пороги характеристик 25+, «Магическая броня».
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const mk = (id, n, w, base) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 7, rank: 7 }); c.base = base || { str: 14, dex: 14, con: 14, int: 12, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: w } }; delete c.bag; delete c.kit; delete c.hp; ensureKit(c); return c; };
    state.party = [mk('p0', 'Аргон', 'dagger'), mk('p1', 'Борис', 'warhammer'), mk('p2', 'Вера', 'sword')]; newRun(); await loadBattle(); const B = Battle; B.cfg.fast = true;
    const mkS = list => { const S = B.newBattle({ list, zone: 'beast', floor: 2, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); B.rollInitiative(); S.phase = 'fight'; B.running = true; return S; };
    const H = S => S.units.filter(x => x.hero), M = (S, id) => S.units.find(x => x.side === 'mon' && x.ref === id); const ctl = { commit() {} };
    const fail = () => { const g = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = a => { a.fill(0); return a; }; return () => { crypto.getRandomValues = g; }; };
    const free = S => { for (const u of S.units) { u.x = -9; u.y = -9; } };
    // данные: КД и Защита по правилу
    const d = id => { const m = MONSTERS.find(x => x.id === id); return [m.dodge, m.prot]; };
    o.ac = d('troll').join() === '8,6' && d('ogre').join() === '5,6' && d('brood-mother')[0] === 7 && d('mana-devourer')[0] === 12 && d('dread-rider')[0] === 12 && d('ruin-guardian')[0] === 4;
    o.scale = ['ogre', 'brood-mother', 'mana-devourer', 'dread-rider', 'ruin-guardian'].every(id => ESSENCES[id] && ESSENCES[id].cls === 5 && MONSTERS.find(m => m.id === id).draft);
    // тролль: размах 2×2 в одну сторону — задевает двоих рядом, но не того, кто с другой стороны
    let S = mkS(['troll']), [h1, h2, h3] = H(S), t = M(S, 'troll'); free(S); t.x = 3; t.y = 3; h1.x = 5; h1.y = 3; h2.x = 5; h2.y = 4; h3.x = 2; h3.y = 3; [h1, h2, h3].forEach(h => { h.ac = 1; h.hp = h.maxHp; });
    await B.A.troll.run(t, {}, ctl); o.club2x2 = h1.hp < h1.maxHp && h2.hp < h2.maxHp && h3.hp === h3.maxHp;
    // огр: лёгкое оружие −5, тяжёлое — полный; дубина отбрасывает; землетрясение
    S = mkS(['ogre']); [h1, h2] = H(S); const og = M(S, 'ogre'); free(S); og.x = 3; og.y = 3; h1.x = 5; h1.y = 3; h2.x = 3; h2.y = 5;
    const dag = B.attacksOf(h1)[0], ham = B.attacksOf(h2)[0]; const hp0 = og.hp; await B.applyDamage(h1, og, [{ v: 12, dt: 'pierce', label: 'к' }], { src: h1, ctx: { atk: dag } }); const lightD = hp0 - og.hp;
    const hp1 = og.hp; await B.applyDamage(h2, og, [{ v: 12, dt: 'bludgeon', label: 'м' }], { src: h2, ctx: { atk: ham } }); const heavyD = hp1 - og.hp; o.ogreHide = heavyD - lightD === 5;
    const svc = { abil: 'str', adv: [] }; B.P['body:ogre'].saveMods(og, svc); o.ogreSteady = svc.adv.length === 1;
    h1.hp = h1.maxHp; const un = fail(); await B.A.ogre.run(og, {}, ctl); un(); o.quake = h1.hp < h1.maxHp && !!B.has(h1, 'prone');
    // мать-кладка: откладывает личинок, личинка принимает удар
    S = mkS(['brood-mother']); [h1] = H(S); const bm = M(S, 'brood-mother'); await B.P['body:brood-mother'].turnStartAsync(bm); const lv = S.units.filter(x => x.ref === 'brood-larva' && x.alive);
    o.larvae = lv.length === 2 && lv.every(l => l.noReward);
    lv[0].x = bm.x - 1; lv[0].y = bm.y; const bh = bm.hp, lh = lv[0].hp; await B.applyDamage(h1, bm, [{ v: 5, dt: 'slash', label: 'с' }], { src: h1, ctx: {} }); o.shield = bm.hp === bh && lv[0].hp < lh;
    // пожиратель: голод маны, глоток, невосприимчивость к 8 классу и половина от 7
    S = mkS(['mana-devourer']); [h1] = H(S); const dv = M(S, 'mana-devourer'); free(S); dv.x = 3; dv.y = 3; h1.x = 4; h1.y = 3; h1.mp = 10; dv.hp = dv.maxHp - 20; await B.P['body:mana-devourer'].turnStartAsync(dv); o.hunger = h1.mp === 6 && dv.hp === dv.maxHp - 16;
    const m0 = dv.hp; await B.applyDamage(h1, dv, [{ v: 10, dt: 'fire', label: 'нечто' }], { src: h1 }); await B.flushQueue(); o.gulp = dv.hp === m0 && h1.hp < h1.maxHp;
    h1.ess = ['crystal-smith', 'shard-hunter']; const m1 = dv.hp; await B.applyDamage(h1, dv, [{ v: 10, dt: 'fire', label: ESSENCES['crystal-smith'].active.name }], { src: h1 }); const m2 = dv.hp; await B.applyDamage(h1, dv, [{ v: 10, dt: 'fire', label: ESSENCES['shard-hunter'].active.name }], { src: h1 });
    o.immune = m1 === m2 && m2 - dv.hp === 5 ? true : [m0, m1, m2, dv.hp, dv.gulped];
    // магическая броня героя: урон способности −3, обычный удар — нет
    h1.mprot = 3; const hh = h1.hp = h1.maxHp; await B.applyDamage(dv, h1, [{ v: 8, dt: 'necrotic', label: 'спос' }], { src: dv }); const ab = hh - h1.hp; h1.hp = hh; await B.applyDamage(dv, h1, [{ v: 8, dt: 'necrotic', label: 'уд' }], { src: dv, ctx: { atk: { kind: 'melee' } } }); const at = hh - h1.hp; o.mprot = at - ab === 3;
    // наездник: метка, двойные кости, лечение снимает; пролёт задевает; местность не замедляет
    S = mkS(['dread-rider']); [h1, h2] = H(S); const dr = M(S, 'dread-rider'); free(S); B.P['body:dread-rider'].turnStart(dr); const mk1 = S.units.find(x => x.hero && B.has(x, 'deathmark')); o.mark = !!mk1;
    const cx = { tgt: mk1, extra: [], atk: dr.atk[0], mods: [] }; B.P['body:dread-rider'].attackMods(dr, cx); o.markDouble = cx.extra.length === 1; mk1.hp = mk1.maxHp - 5; B.heal(mk1, 3, mk1); o.markHeal = !B.has(mk1, 'deathmark');
    for (let y = 2; y <= 5; y++) for (let x = 0; x < B.W; x++) S.cells[y][x] = ''; dr.x = 0; dr.y = 3; h1.x = 2; h1.y = 3; h2.x = 3; h2.y = 3; h1.hp = h1.maxHp; h2.hp = h2.maxHp; dr.t.moved = 0; await B.A['dread-rider'].run(dr, { cell: [1, 3] }, ctl); o.ride = h1.hp < h1.maxHp && h2.hp < h2.maxHp && dr.x > 3;
    o.riderTerrain = B.stepCost(dr, 1, 1) === 1;
    // страж руин: −25 % урона, ×2 с руны, руны 4 шт., луч готовится
    S = mkS(['ruin-guardian']); [h1] = H(S); const rg = M(S, 'ruin-guardian'); B.onRound(); o.runes = (S.runes || []).length === 4;
    o.stone = B.P['body:ruin-guardian'].dmgTotal(rg, { total: 20, o: { ctx: {} } }) === 15;
    const [rx, ry] = S.runes[0]; h1.x = rx; h1.y = ry; const dc = { att: h1, notes: [] }; B.P['body:ruin-guardian'].defendMods(rg, dc); o.runeX2 = dc.runeHit === true && B.P['body:ruin-guardian'].dmgTotal(rg, { total: 20, o: { ctx: dc } }) === 40;
    S.round = 3; rg.beamR = 0; await B.P['body:ruin-guardian'].turnStartAsync(rg); o.beamPrep = !!rg.beam && !!B.has(rg, 'beamaim'); await B.P['body:ruin-guardian'].turnStartAsync(rg); o.beamFired = !rg.beam;
    // пороги характеристик 25+
    B.running = false; B.S = null; state.party = [mk('q0', 'Гром', 'sword', { str: 14, dex: 26, con: 26, int: 10, wis: 26, cha: 10 })]; newRun(); S = mkS(['hobgoblin']); const q = H(S)[0];
    o.thresholds = q.regen === 1 && q.mregen === 1 && q.leaper === true; q.hp = q.maxHp - 5; q.mp = 0; await B.startTurn(q); o.regenTick = q.hp === q.maxHp - 4 && q.mp === 1;
    let rock = null; for (let y = 0; y < B.H && !rock; y++) for (let x = 0; x < B.W && !rock; x++) { const c = S.cells[y][x]; if (c && D_obs(c)) rock = [x, y]; } function D_obs(c) { return B.D.terrain[c] && B.D.terrain[c].obstacle; }
    if (!rock) { S.cells[1][1] = 'rock'; rock = [1, 1]; } o.leap = B.canStand(q, rock[0], rock[1]); q.leaper = false; o.noLeap = !B.canStand(q, rock[0], rock[1]);
    B.running = false; B.S = null; return o;
  });
  let bad = 0; for (const [k, v] of Object.entries(r)) if (v !== true) { bad++; console.log('  ✗', k, v); }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad += errs.length; } console.log(`проверок: ${Object.keys(r).length}, не прошли: ${bad}`); await b.close();
})();
