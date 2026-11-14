// 14.11: «Коса последнего вздоха» (эффекты и выпадение), эссенции кладбища (крит 19, похищение жизни), аукцион — колба в рюкзак, короткие описания объектов поля.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const mk = (id, n, w) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 6, rank: 7 }); c.base = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }; c.equip = { main: { t: 'w', id: w } }; delete c.bag; delete c.kit; delete c.hp; ensureKit(c); return c; };
    state.party = [mk('p0', 'Аргон', 'sword'), mk('p1', 'Борис', 'greataxe')]; newRun(); await loadBattle(); const B = Battle; B.cfg.fast = true;
    const c = state.party[1]; c.equip.main = { t: 'w', id: 'greataxe', art: 'death-scythe' }; artState().known['death-scythe'] = true;
    o.item = itemOf(c.equip.main).name === 'Коса последнего вздоха' && /двойной урон/.test(itemOf(c.equip.main).note);
    const mkS = list => { const S = B.newBattle({ list, zone: 'undead', floor: 2, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); B.rollInitiative(); S.phase = 'fight'; B.running = true; return S; };
    const nat = n => { const g = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = a => { a[0] = n - 1; for (let i = 1; i < a.length; i++) a[i] = 0; return a; }; return () => { crypto.getRandomValues = g; }; };
    const setup = id => { const S = mkS([id]), u = S.units.find(x => x.hero && x.hero.id === c.id), m = S.units.find(x => x.side === 'mon'); m.x = u.x + 1; m.y = u.y; return { S, u, m, atk: B.attacksOf(u).find(a => a.w && a.w.artId === 'death-scythe' && a.mode === 'hand') }; };
    let { u, m, atk } = setup('skeleton-warrior'); m.maxHp = 200; m.hp = 45; let un = nat(15); await B.doAttack(u, m, atk, {}); un(); o.exec = !m.alive && u.scytheUsed;
    const m2 = B.monUnit('skeleton-warrior', -1); B.addUnit(m2); m2.x = u.x - 1; m2.y = u.y; m2.maxHp = 200; m2.hp = 45; un = nat(15); await B.doAttack(u, m2, atk, {}); un(); o.once = m2.alive;
    ({ u, m, atk } = setup('night-abbot')); m.hp = Math.floor(m.maxHp * 0.2); const before = m.hp; un = nat(15); const rb = await B.doAttack(u, m, atk, {}); un(); o.boss = m.alive && before - m.hp === rb.dealt * 2;
    ({ u, m, atk } = setup('skeleton-warrior')); u.scytheUsed = true; m.maxHp = 200; m.hp = 80; const S1 = B.S, l0 = S1.log.length; un = nat(15); await B.doAttack(u, m, atk, {}); un(); o.low = S1.log.slice(l0).some(l => /Последний вздох/.test(l.t));
    ({ u, m, atk } = setup('skeleton-warrior')); u.scytheUsed = true; u.pass.push('lesser-death'); m.maxHp = 200; m.hp = 80; un = nat(19); const rc = await B.doAttack(u, m, atk, {}); un(); o.crit19 = rc.crit;
    ({ u, m, atk } = setup('skeleton-warrior')); u.scytheUsed = true; u.pass.push('lesser-death'); m.maxHp = 200; m.hp = 150; un = nat(19); const rn = await B.doAttack(u, m, atk, {}); un(); o.noCritHealthy = !rn.crit;
    ({ u, m, atk } = setup('skeleton-warrior')); u.scytheUsed = true; u.pass.push('azik-lich'); u.hp = 10; m.maxHp = 200; m.hp = 150; un = nat(15); const rl = await B.doAttack(u, m, atk, {}); un(); o.steal = u.hp === 10 + Math.max(1, Math.floor(rl.dealt / 4));
    const mz = B.monUnit('azik-lich', -1); o.azikEss = mz.pass.includes('azik-lich') && !!ESSENCES['azik-lich'] && MONSTERS.find(x => x.id === 'azik-lich').essence === 'azik-lich';
    B.running = false; B.S = null;
    // выпадение косы с духа (шанс принудительно 100 %)
    const run = state.run; run.floor = 2; run.variant = 'undead'; run.day = 10; run.act = 1; run.pos = { x: 5, y: 5 }; riftSync(); dgUi.res = null; const k = Object.keys(run.riftsF2.tiles)[0].split(',').map(Number); run.pos = { x: k[0], y: k[1] }; riftEnter(); dgUi.res = null; VN_Q.length = 0; const vd = document.getElementById('vn-dlg'); if (vd) vd.remove();
    state.party.forEach(h => { (h.bag ||= []); }); c.equip.main = { t: 'w', id: 'greataxe' };
    const R = run.rift, rr = Math.random; Math.random = () => 0.01; gyFightDone(R, { gySpirit: true }, ['lesser-death']); Math.random = rr;
    o.drop = R.spiritDead && state.party.some(h => (h.bag || []).some(e => e.art === 'death-scythe')) && /Коса духа/.test(dgUi.res && dgUi.res.title || '');
    dgUi.res = null; Math.random = () => 0.01; R.spiritDead = false; gyFightDone(R, { gySpirit: true }, ['lesser-death']); Math.random = rr; o.unique = state.party.reduce((n, h) => n + (h.bag || []).filter(e => e.art === 'death-scythe').length, 0) === 1;
    run.rift = null; state.run = null; dgUi.res = null;
    // аукцион: эссенция — колба в рюкзак выбранного героя; полный рюкзак — отказ без списания
    await loadTown(); state.party.forEach(h => { h.rank = 9; h.gold = 5000; }); auctionRoll(); const sl = state.auction.slots.find(x => x.kind === 'ess');
    const h = state.party[0]; while ((h.bag || []).length < bagSize(h)) h.bag.push({ t: 'w', id: 'dagger' }); Town.open('auction');
    const i = state.auction.slots.indexOf(sl); const g0 = partyGold(); document.querySelector(`[data-t="lot-buy"][data-i="${i}"]`).click(); await new Promise(r => setTimeout(r, 100));
    o.fullBag = !sl.sold && partyGold() === g0 && /нет места/.test(document.querySelector('#townov').innerText);
    h.bag = h.bag.filter(e => e.id !== 'dagger'); document.querySelector(`[data-t="lot-buy"][data-i="${i}"]`).click(); await new Promise(r => setTimeout(r, 100));
    const fl = h.bag.find(e => e.id === 'ess-flask'); o.bought = sl.sold && !!fl && fl.ess === sl.id && partyGold() === g0 - sl.price && !(inventory().essStash || []).includes(sl.id) && /колба у/.test(document.querySelector('#townov').innerText);
    Town.close();
    // объекты поля: только свойства, без последствий разрушения и чисел
    const bad = Object.entries(Battle.D.terrain).filter(([, t]) => /взрыв|сломай|внутри|ожив|упад|к\d|Сл \d|ОЗ\)|шанс|уцелеет|отдать|после боя/i.test(t.note || '')).map(([k]) => k); o.terrain = bad.length === 0; o.terrainBad = bad;
    const items = Object.entries(GEAR).filter(([, g]) => !g.find && (g.note || '').length > 80).map(([k]) => k); o.itemsShort = items.length === 0; o.itemsLong = items;
    return o;
  });
  let bad = 0, n = 0; for (const [k, v] of Object.entries(r)) { if (typeof v !== 'boolean') continue; n++; if (!v) { bad++; console.log('  ✗', k); } else console.log('  ✓', k); }
  if (bad) console.log(JSON.stringify({ terrain: r.terrainBad, items: r.itemsLong }));
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad++; }
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
