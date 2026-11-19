// 18.11: монстры 4 этажа (Башня) — создание, каждая активка, ключевые пассивки, автобои без ошибок, состав Башни (старых ≤ 30 %).
const { chromium } = require('playwright');
const N = +process.argv[2] || 2;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async (N) => { window.__dbg = [];
    const o = {}, IDS = F4_MON.map(x => x[0]);
    const mk = (id, n, lvl) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: lvl || 6, rank: 6 }); ensureKit(c); c.hp = maxHp(c); return c; };
    state.party = [mk('p0', 'А'), mk('p1', 'Б'), mk('p2', 'В')]; newRun();
    await loadBattle(); const B = Battle; B.cfg.fast = true;
    const field = list => { state.party.forEach(c => { c.dead = false; c.hp = maxHp(c); c.mp = maxMp(c); }); const S = B.newBattle({ list, zone: 'stone', floor: 4, kind: 'hard', title: 'x' }); B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); S.phase = 'fight'; B.running = true;
      for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) S.cells[y][x] = null; S.dark = false; S.objs = [];
      const hs = S.units.filter(u => u.side === 'hero'), ms = S.units.filter(u => u.side === 'mon'); ms.forEach(m => { B.removeStatus(m, 'hidden'); m.x = 20; m.y = 20; }); hs.forEach((h, i) => { h.x = 6; h.y = i; h.t = { move: 4, action: 1, bonus: 1, react: 1 }; });
      ms.forEach(m => { m.t = { move: 6, action: 1, bonus: 1, react: 1 }; m.cd = {}; }); return { S, hs, ms }; };
    const put = (u, x, y) => { u.x = x; u.y = y; };
    const use = async (u, id, picks) => { u.cd = {}; u.t = { move: 6, action: 1, bonus: 1, react: 1 }; return B.useActive(u, id, picks || {}); };
    // A. создание
    const bad = [];
    for (const id of IDS) { const { S, ms } = field([id]); const m = ms[0], f = MON_FOOT[id] || [1, 1]; if (!m || !m.atk.length || (m.w || 1) !== f[0] || (m.h || 1) !== f[1] || !B.A[id] || !B.P[id] || !(m.pass || []).includes(id)) bad.push(id); B.running = false; B.S = null; }
    o.create = bad.length ? bad : true;
    // B. способности
    const T = {}; const realSave = B.doSave; B.doSave = async () => ({ ok: false, total: 1 });          // проверки способностей: спасброски всегда проваливаются
    { const { S, hs, ms } = field(['creeping-vine']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 5); const vr = await use(m, 'creeping-vine', { unit: hs[0] }); T.vine = B.has(hs[0], 'restrained') || [vr, hs[0].conds.map(c => c.id), B.A['creeping-vine'].can(m), S.log.slice(-3).map(l => l.t)]; B.S = null; }
    { const { S, hs, ms } = field(['candle-stub']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 6); hs[0].abil.dex = 1; await use(m, 'candle-stub', { unit: hs[0] }); T.candleSlow = B.has(hs[0], 'slowed'); T.candleLit = (B.P['candle-stub'].turnStart(m), B.has(m, 'lit')); B.S = null; }
    { const { S, hs, ms } = field(['dust-moth']); const m = ms[0]; put(m, 6, 1); S.dark = true; S.torch = true; T.mothCan = B.A['dust-moth'].can(m) === true; await use(m, 'dust-moth'); T.mothTorch = !S.torch; B.S = null; }
    { const { S, hs, ms } = field(['wall-bug']); const m = ms[0]; put(m, 0, 5); S.cells[5][1] = null; S.cells[6][0] = 'cliff'; put(hs[0], 3, 5); hs.slice(1).forEach(h => put(h, 8, 8)); T.bugWall = B.protAura(m) === 2; await use(m, 'wall-bug', { unit: hs[0] }); T.bugLeap = B.dist(m, hs[0]) <= 1; B.S = null; }
    { const { S, hs, ms } = field(['harpy', 'harpy']); const [a, a2] = ms; put(a, 3, 3); put(a2, 6, 3); put(hs[0], 5, 3); hs.slice(1).forEach(h => put(h, 9, 9)); const hp0 = hs[0].hp; hs[0].abil.dex = 1;
      a.t = { meleeAttacked: true }; T.harpyFlyby = B.P.harpy.noProvoke(a) === true; a.t = null; await use(a, 'harpy', { cell: [4, 3] }); T.harpyCone = hs[0].hp < hp0; B.S = null; }
    { const { S, hs, ms } = field(['gargoyle']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 6); hs.slice(1).forEach(h => put(h, 9, 9)); m.atk.forEach(a => a.hit = 99); hs[0].abil.str = 1; await use(m, 'gargoyle', { unit: hs[0] }); T.gargDrop = B.dist(m, hs[0]) <= 1;
      const v1 = B.P.gargoyle.dmgFlat(m, { dt: 'slash', v: 5 }), v2 = B.P.gargoyle.dmgFlat(m, { dt: 'bludgeon', v: 5 }); T.gargSkin = v1 === -2 && v2 === 2; B.S = null; }
    { const { S, hs, ms } = field(['centaur-raider']); const m = ms[0]; put(m, 5, 4); put(hs[0], 5, 6); hs.slice(1).forEach(h => put(h, 9, 9)); await use(m, 'centaur-raider', { unit: hs[0] }); T.raider = B.dist(m, hs[0]) > 1 && !m.t.action;
      m.t.moved = 3; T.raiderRide = B.P['centaur-raider'].dmgBonusVs(m, { o: { ctx: { atk: { kind: 'ranged' } } } }) === 2; B.S = null; }
    { const { S, hs, ms } = field(['flytrap']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 7); hs.slice(1).forEach(h => put(h, 9, 9)); hs[0].abil.wis = 1; const d0 = B.dist(m, hs[0]); await use(m, 'flytrap'); T.nectar = B.dist(m, hs[0]) < d0;
      B.addStatus(hs[0], 'grappled', { k: Infinity, data: { by: m.id } }); T.sap = B.P.flytrap.dmgBonusVs(m, { tgt: hs[0], o: { ctx: {} } }) > 0; B.S = null; }
    { const { S, hs, ms } = field(['living-tome']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 5); put(hs[1], 4, 5); put(hs[2], 9, 9); hs[0].abil.dex = 1; hs[1].abil.dex = 1; const s0 = hs[0].hp + hs[1].hp; await use(m, 'living-tome', { units: [hs[0], hs[1]] }); T.tome = hs[0].hp + hs[1].hp < s0;
      const sc = { abil: 'wis', mods: [] }; B.P['living-tome'].saveMods(m, sc); T.tomeSave = sc.mods.some(x => x.v === 2); B.S = null; }
    { const { S, hs, ms } = field(['empty-armor']); const m = ms[0]; put(m, 3, 3); const ac0 = m.ac; await use(m, 'empty-armor'); T.plates = B.has(m, 'platedrop') && B.P['empty-armor'].acBonus(m) === -2;
      T.critOnce = B.P['empty-armor'].critGuard(m) === true && B.P['empty-armor'].critGuard(m) === false; B.S = null; }
    { const { S, hs, ms } = field(['sand-sentinel']); const m = ms[0]; put(m, 3, 3); S.round = 2; m.hpLog = [{ r: 1, hp: m.maxHp }]; m.hp = m.maxHp - 15; await use(m, 'sand-sentinel'); T.hourglass = m.hp === m.maxHp;
      put(hs[0], 3, 4); B.P['sand-sentinel'].onDamaged(m, { src: hs[0], o: { ctx: { melee: true } } }); T.sand = B.has(hs[0], 'slowed'); B.S = null; }
    { const { S, hs, ms } = field(['elder-harpy']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 6); hs.slice(1).forEach(h => put(h, 9, 9)); hs[0].abil.str = 1; await use(m, 'elder-harpy', { unit: hs[0] }); T.snatch = B.has(hs[0], 'prone') || hs[0].hp < hs[0].maxHp;
      B.addStatus(hs[0], 'prone', { k: Infinity }); put(m, hs[0].x, hs[0].y - 1); { const cx = { tgt: hs[0], extra: [] }; B.P['elder-harpy'].attackMods(m, cx); T.pinDown = cx.extra.length === 1 && cx.extra[0].s === 6; } B.S = null; }
    { const { S, hs, ms } = field(['gargoyle-guard', 'hobgoblin']); const [g, h] = ms; put(g, 3, 3); put(h, 4, 3); put(hs[0], 4, 4); hs.slice(1).forEach(x => put(x, 9, 9));
      const atk = B.attacksOf(hs[0])[0], ctx = B.attackCtx(hs[0], h, atk); T.guardAura = ctx.mods.some(x => /Хранитель порога/.test(x.l)); put(g, 1, 1); await use(g, 'gargoyle-guard', { unit: h }); T.waystand = B.has(h, 'waystand'); B.S = null; }
    { const { S, hs, ms } = field(['centaur-knight']); const m = ms[0]; put(m, 3, 1); put(hs[0], 3, 3); put(hs[1], 3, 4); put(hs[2], 9, 9); m.atk.forEach(a => a.hit = 99); const h0 = hs[0].hp, h1 = hs[1].hp; await use(m, 'centaur-knight', { unit: hs[0] }); T.pierce = hs[0].hp < h0 && hs[1].hp < h1;
      const hk = hs[0]; hk.pass.push('centaur-knight'); const c = hk.hero; c.equip.main = { t: 'w', id: 'spear' }; delete c.equip.off; const sp = B.atkFrom(hk, itemOf(c.equip.main), 'hand', c.equip.main, 'main'); T.longShaft = sp && !sp.stretch && sp.reach === 2;
      c.equip.main = { t: 'w', id: 'pike' }; const pk = B.atkFrom(hk, itemOf(c.equip.main), 'hand', c.equip.main, 'main'); T.pike3 = pk && pk.reach === 3; B.S = null; }
    { const { S, hs, ms } = field(['mech-horse']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 2); hs.slice(1).forEach(h => put(h, 9, 9)); hs[0].abil.dex = 1; T.horseBack = B.A['mech-horse'].can(m) === true; const h0 = hs[0].hp; await use(m, 'mech-horse', { unit: hs[0] }); T.kick = hs[0].hp < h0;
      const ctx = { o: { reaction: true }, dis: [] }; B.P['mech-horse'].acBonus(m, ctx); T.horseOA = ctx.dis.length === 1; B.S = null; }
    { const { S, hs, ms } = field(['siren-flower']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 6); hs.slice(1).forEach(h => put(h, 9, 9)); hs[0].abil.wis = 1; await use(m, 'siren-flower', { unit: hs[0] }); T.pollen = B.has(hs[0], 'pollen');
      const d0 = B.dist(m, hs[0]); await B.P['body:pollen-charmed'].turnStartAsync(hs[0]); T.pollenWalk = B.dist(m, hs[0]) < d0 && hs[0].t.action === 0;
      put(hs[1], 3, 5); const sc = { mods: [] }; B.P['siren-flower'].foeSaveAura(m, { u: hs[1], abil: 'wis', ctx: sc }); T.aroma = sc.mods.some(x => x.v === -2); B.S = null; }
    { const { S, hs, ms } = field(['glass-golem']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 4); put(hs[1], 3, 5); put(hs[2], 9, 9); hs.forEach(h => h.abil.con = 1); await use(m, 'glass-golem', { cell: [3, 4] }); T.blind = B.has(hs[0], 'blinded') || B.has(hs[1], 'blinded');
      const h0 = hs[0].hp; B.P['glass-golem'].onDamaged(m, { src: hs[0], o: { ctx: { melee: true } } }); await new Promise(r => setTimeout(r, 300)); T.shards = hs[0].hp < h0 || [h0, hs[0].hp, S.log.slice(-2).map(l => l.t)]; B.S = null; }
    { const { S, hs, ms } = field(['elder-gargoyle']); const m = ms[0]; put(m, 2, 2); put(hs[0], 6, 6); hs.slice(1).forEach(h => put(h, 9, 0)); hs[0].abil.con = 1; for (let i = 0; i < 6 && !B.has(hs[0], 'petrified'); i++) await use(m, 'elder-gargoyle', { unit: hs[0] });
      T.petrify = B.has(hs[0], 'petrified') && !B.canAct(hs[0]); B.S = null; }
    { const { S, hs, ms } = field(['steam-bull']); const m = ms[0]; put(m, 3, 3); put(hs[0], 3, 5); hs.slice(1).forEach(h => put(h, 9, 9)); hs[0].abil.con = 1; for (let i = 0; i < 4; i++) B.P['steam-bull'].turnStart(m); T.steam3 = B.steamOf(m) === 3;
      const h0 = hs[0].hp; await use(m, 'steam-bull', { cell: [3, 5] }); T.vent = hs[0].hp < h0 && B.steamOf(m) === 0; B.S = null; }
    { const { S, hs, ms } = field(['treant-warden']); const m = ms[0]; put(m, 2, 2); put(hs[0], 6, 5); hs.slice(1).forEach(h => put(h, 9, 0)); hs[0].abil.str = 1; await use(m, 'treant-warden', { cell: [6, 5] }); T.roots = hs[0].hp < hs[0].maxHp;
      m.hp = m.maxHp - 20; m.lastMoved = false; B.P['treant-warden'].turnStart(m); T.sap = m.hp === m.maxHp - 15; B.S = null; }
    { const { S, hs, ms } = field(['centaur-chief', 'centaur-raider']); const [c, r1] = ms; put(c, 3, 0); put(r1, 5, 0); put(hs[0], 4, 4); hs.slice(1).forEach(h => put(h, 9, 9));
      const ctx = { atk: { kind: 'ranged' }, notes: [] }; B.P['centaur-chief'].attackAura(c, { att: r1, ctx }); T.banner = ctx.dmgPlus === 2; c.atk.forEach(a => a.hit = 99); r1.atk.forEach(a => a.hit = 99); const h0 = hs[0].hp; await use(c, 'centaur-chief', { unit: hs[0] }); T.volley = hs[0].hp < h0 - 4 || !B.alive(hs[0]) || [h0, hs[0].hp, B.A['centaur-chief'].can(c), S.log.slice(-6).map(l => l.t)]; B.S = null; }
    { const { S, hs, ms } = field(['sphinx']); const m = ms[0]; S.riddleDone = false; B.sphinxRiddle(S); T.riddle = (!!S.riddle && (S.riddle.ok ? m.hp < m.maxHp : hs.every(h => h.riddleDis))) || [S.riddle, m.hp, m.maxHp, hs.map(h => h.riddleDis)];
      put(m, 3, 3); put(hs[0], 3, 5); hs[0].abil.wis = 1; B.addStatus(hs[1], 'hidden', { k: Infinity }); put(hs[1], 5, 3); await use(m, 'sphinx'); T.roar = !B.has(hs[1], 'hidden'); B.S = null; }
    B.doSave = realSave; B.running = false;
    const fails = Object.entries(T).filter(([, v]) => !(v === true || (v && typeof v === 'object' && v.id))).map(([k, v]) => k + (v !== false ? ':' + JSON.stringify(v) : '')); o.abilities = fails.length ? fails : true;
    // C. автобои без ошибок
    const err = []; const res = {};
    for (const id of IDS) { const L = MONSTERS.find(m => m.id === id).cls === 6 ? [id] : [id, id]; let win = 0;
      for (let i = 0; i < N; i++) { try { state.party = [mk('p0', 'А', 6), mk('p1', 'Б', 6), mk('p2', 'В', 6), mk('p3', 'Г', 6)]; const rr = await B.sim({ list: L.slice(), zone: 'stone', floor: 4, ambush: false, kind: 'hard', title: 't' }); if (rr.outcome === 'win') win++; } catch (e) { err.push(id + ': ' + String(e && e.message).slice(0, 120)); } B.S = null; }
      res[id] = win; }
    o.sims = err.length ? err.slice(0, 5) : true; o.simWins = res;
    // D. Башня: состав
    const pool = [...twPool(9), ...twPool(8), ...twPool(7)].map(m => m.id), minis = TW_MINIS, all = [...new Set([...pool, ...minis, ...TW_BOSSES, 'plain-shadow'])];
    const old = all.filter(id => MONSTERS.find(m => m.id === id).floor !== 4); o.oldShare = old.length / all.length <= 0.3 || [old.length, all.length];
    o.noAlpha = !minis.includes('alpha01') && !pool.includes('alpha01');
    o.kindPlant = monCat(MONSTERS.find(m => m.id === 'flytrap')) === 'plant' && KIND_RU.plant === 'Растения';
    return o;
  }, N);
  let bad = 0; for (const [k, v] of Object.entries(r)) if (v !== true && k !== 'simWins') { bad++; console.log('  ✗', k, JSON.stringify(v)); }
  console.log('победы:', JSON.stringify(r.simWins));
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad += errs.length; } console.log(`проверок: ${Object.keys(r).length - 1}, не прошли: ${bad}`); await b.close();
})();
