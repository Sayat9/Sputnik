// Кровавая крепость (v116): жрец — печать сама при падении ОЗ врага ниже 60 % (откат 3), жертвенное лечение; голем — 5 временных ОЗ обновляются, огонь мешает; поганище — мясницкий крюк притягивает; Мордрейн — аура +2, страж (эссенция 71+).
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const o = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 4 }); c.base = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: 'longsword' } }; delete c.bag; delete c.kit; delete c.hp; return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const setup = list => { state.party = [mk(0), mk(1)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; }); const S = B.newBattle({ list, zone: 'undead', floor: 1 }); B.placeMonsters(S); S.phase = 'fight'; S.round = 1; return S; };
    // жрец
    let S = setup(['blood-priest']); let pr = B.mons()[0], h = B.heroes()[0]; h.x = pr.x; h.y = Math.min(pr.y + 2, 6);
    await B.applyDamage(pr, h, [{ v: Math.ceil(h.maxHp * 0.5), dt: 'slash' }], {}); out.seal1 = !!B.has(h, 'noheal');
    const h2 = B.heroes()[1]; h2.x = pr.x; h2.y = Math.min(pr.y + 3, 6); await B.applyDamage(pr, h2, [{ v: Math.ceil(h2.maxHp * 0.5), dt: 'slash' }], {}); out.sealCd = !B.has(h2, 'noheal');
    S.round = 4; h2.hp = h2.maxHp; await B.applyDamage(pr, h2, [{ v: Math.ceil(h2.maxHp * 0.5), dt: 'slash' }], {}); out.sealAgain = !!B.has(h2, 'noheal');
    out.priestActive = B.A['blood-priest'].time === 'bonus' && /Жертвенное/.test(ESSENCES['blood-priest'].active.name) && /Кровавая печать/.test(ESSENCES['blood-priest'].passive.name);
    // голем
    S = setup(['flesh-golem']); const g = B.mons()[0]; B.hookAll(g, 'turnStart', {}); const t1 = g.temp;
    await B.applyDamage(B.heroes()[0], g, [{ v: 4, dt: 'slash' }], {}); const t2 = g.temp, hpLoss = g.maxHp - g.hp;
    B.hookAll(g, 'turnStart', {}); const t3 = g.temp; B.hookAll(g, 'turnStart', {}); const t4 = g.temp;
    await B.applyDamage(B.heroes()[0], g, [{ v: 3, dt: 'fire' }], {}); B.hookAll(g, 'turnStart', {}); const t5 = g.temp;
    out.golem = { t1, t2, hpLoss, t3, t4, t5 };
    // поганище
    S = setup(['abomination']); const ab = B.mons()[0]; const hh = B.heroes()[0]; B.heroes()[1].x = 0; B.heroes()[1].y = 6;
    let pulled = 0, tries = 0; for (let i = 0; i < 12 && !pulled; i++) { tries++; hh.hp = hh.maxHp; hh.down = false; hh.x = ab.x; hh.y = Math.min(ab.y + 3, 6); if (B.occupant && B.occupant(hh.x, hh.y) && B.occupant(hh.x, hh.y) !== hh) hh.x = (ab.x + 1) % 7;
      hh.abil.dex = 1; hh.abil.str = 1; const d0 = B.dist(ab, hh); out.dbg = (out.dbg || []).concat([[hh.x, hh.y, ab.x, ab.y, d0]]); await B.A.abomination.run(ab, { unit: hh }, { commit() {} }); if (B.dist(ab, hh) === 1 && d0 > 1) pulled = 1; }
    out.hook = { pulled, tries, dbg: out.dbg, log: (B.S.log || []).slice(-6).map(l => l.t || l), name: ESSENCES.abomination.active.name };
    out.guard = MONSTERS.find(m => m.id === 'death-knight').rank;
    out.aura = /\+2 урона/.test(ESSENCES['death-knight'].passive.text);
    return out;
  });
  ok('жрец: печать сама, когда ОЗ героя упали ниже 60 %', o.seal1, o);
  ok('жрец: откат 3 раунда, потом снова', o.sealCd && o.sealAgain, o);
  ok('жрец: «Жертвенное лечение» — активка (доп. действие), «Кровавая печать» — пассивка', o.priestActive, o);
  ok('голем: 5 врем. ОЗ, урон 4 уходит в них, обновляются до 5 и не складываются', o.golem.t1 === 5 && o.golem.t2 < 5 && o.golem.hpLoss === 0 && o.golem.t3 === 5 && o.golem.t4 === 5, o.golem);
  ok('голем: после огня временные ОЗ не обновляются', o.golem.t5 < 5, o.golem);
  ok('поганище: «Мясницкий крюк» притягивает вплотную', o.hook.pulled && o.hook.name === 'Мясницкий крюк', o.hook);
  ok('Мордрейн — страж, аура +2', o.guard === 'guardian' && o.aura, o);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
