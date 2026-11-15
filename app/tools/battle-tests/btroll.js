// 14.11: Пещерный тролль (5 класс) — регенерация, остановка огнём/кислотой, «Неубиваемый», едкая кровь, ярость; эссенция у героя.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const mk = (id, n, w) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 6, rank: 7 }); c.base = { str: 14, dex: 14, con: 14, int: 12, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: w } }; delete c.bag; delete c.kit; delete c.hp; ensureKit(c); return c; };
    state.party = [mk('p0', 'Аргон', 'sword'), mk('p1', 'Борис', 'longbow')]; newRun(); await loadBattle(); const B = Battle; B.cfg.fast = true;
    const S = B.newBattle({ list: ['troll'], zone: 'beast', floor: 2, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); B.rollInitiative(); S.phase = 'fight'; B.running = true;
    const [h, h2] = S.units.filter(x => x.hero), t = S.units.find(x => x.side === 'mon');
    o.size = t.w * t.h === 2 && t.maxHp >= 150 && t.ac === 8; o.draft = MONSTERS.find(m => m.id === 'troll').draft === true && ESSENCES.troll.cls === 5;
    t.hp = 100; await B.P['body:troll'].turnStartAsync(t); o.regen = t.hp === 125;
    await B.applyDamage(h, t, [{ v: 5, dt: 'fire', label: 'f' }], { src: h }); const hb = t.hp; await B.P['body:troll'].turnStartAsync(t); o.fireStops = t.hp === hb && !!B.has(t, 'trollburn');
    B.removeStatus(t, 'trollburn'); t.hp = 5; await B.applyDamage(h, t, [{ v: 50, dt: 'slash', label: 's' }], { src: h }); o.notDead = B.alive(t) && t.hp === 1 && !!B.has(t, 'trolldown') && !B.canAct(t);
    await B.P['body:troll'].turnStartAsync(t); o.rises = !B.has(t, 'trolldown') && t.hp === 26 && B.canAct(t);
    t.hp = 5; await B.applyDamage(h, t, [{ v: 3, dt: 'acid', label: 'a' }], { src: h }); await B.applyDamage(h, t, [{ v: 50, dt: 'slash', label: 's' }], { src: h }); o.diesWhenBlocked = !B.alive(t);
    // удар оружием с огнём (через атаку, не прямой урон) останавливает регенерацию
    B.alive(t) || true; { const S3 = B.newBattle({ list: ['troll'], zone: 'beast', floor: 2, kind: 'hard', title: 'x' }); S3.opts.autoHeroes = true; B.placeHeroesDefault(S3); B.placeMonsters(S3); B.preStart(S3); B.rollInitiative(); S3.phase = 'fight'; B.running = true;
      const hh = S3.units.find(x => x.hero), tt = S3.units.find(x => x.side === 'mon'); hh.pass.push('forge-smith'); hh.hero.equip.main = { t: 'w', id: 'warhammer' }; B.initUnit && B.initUnit(hh); tt.x = hh.x; tt.y = hh.y - 2; tt.ac = 1; let hit = false;
      for (let i = 0; i < 6 && !hit; i++) { const a = B.attacksOf(hh).find(a => a.dt === 'bludgeon') || B.attacksOf(hh)[0]; const r = await B.doAttack(hh, tt, { ...a, dt: 'bludgeon', kind: 'melee' }, {}); hit = r && r.hit; }
      o.attackFireStops = hit && !!B.has(tt, 'trollburn'); }
    // новый бой: кровь и ярость
    const S2 = B.newBattle({ list: ['troll'], zone: 'beast', floor: 2, kind: 'hard', title: 'x' }); S2.opts.autoHeroes = true; B.placeHeroesDefault(S2); B.placeMonsters(S2); B.preStart(S2); B.rollInitiative(); S2.phase = 'fight'; B.running = true;
    const [g1, g2] = S2.units.filter(x => x.hero), tr = S2.units.find(x => x.side === 'mon'); g1.x = tr.x; g1.y = tr.y + tr.h; g1.hp = g1.maxHp; const gh = g1.hp;
    await B.applyDamage(g1, tr, [{ v: 5, dt: 'slash', label: 's' }], { src: g1, melee: true, ctx: {} }); await B.flushQueue(); o.acidBlood = g1.hp < gh;
    tr.hp = Math.floor(tr.maxHp / 3); await B.P['body:troll'].turnStartAsync(tr); const ctx = { mods: [], adv: [], dis: [], extra: [] }; B.P['body:troll'].attackMods(tr, ctx); o.rage = !!B.has(tr, 'trollrage') && ctx.protIgnore === 99 && ctx.mods.some(m => m.v === 2);
    // размах дубиной: бьёт всех вокруг
    { g1.x = tr.x + tr.w; g1.y = tr.y; g2.x = tr.x + tr.w; g2.y = tr.y + 1; for (const u of S2.units) if (u !== g1 && u !== g2 && u !== tr) { u.x = -9; u.y = -9; } g1.ac = g2.ac = 1; g1.hp = g1.maxHp; g2.hp = g2.maxHp; const a1 = g1.hp, a2 = g2.hp; await B.A.troll.run(tr, {}, { commit() {} }); o.club = g1.hp < a1 && g2.hp < a2; g1.hp = g1.maxHp; }
    // эссенция у героя
    g2.pass.push('troll'); g2.hp = 10; B.P.troll.turnStart(g2); o.heroRegen = g2.hp === 17; await B.applyDamage(tr, g2, [{ v: 2, dt: 'fire', label: 'f' }], { src: tr }); const hh = g2.hp; B.P.troll.turnStart(g2); o.heroFireStops = g2.hp === hh;
    g2.mp = 10; g2.hp = 3; await B.applyDamage(tr, g2, [{ v: 40, dt: 'slash', label: 's' }], { src: tr }); o.rip = !g2.down && g2.hp === Math.floor(g2.maxHp / 2) && g2.mp === 4; g2.hp = 3; await B.applyDamage(tr, g2, [{ v: 40, dt: 'slash', label: 's' }], { src: tr }); o.ripOnce = g2.down || !B.alive(g2);
    B.running = false; B.S = null; return o;
  });
  let bad = 0; for (const [k, v] of Object.entries(r)) if (v !== true) { bad++; console.log('  ✗', k, v); }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad += errs.length; } console.log(`проверок: ${Object.keys(r).length}, не прошли: ${bad}`); await b.close();
})();
