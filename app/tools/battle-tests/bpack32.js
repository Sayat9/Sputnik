// 31.10 (вечер): перетаскивание в окне героя, продажа оружия/брони (кузнец −10 %, магазин −20 %), лимит 4 заданий, сон в таверне 1 действие, невидимость.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, {});
  const R = [], ok = (n, c, x) => { R.push(!!c); if (!c) console.log('  ✗', n, '—', x == null ? '' : JSON.stringify(x)); };
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  // перетаскивание
  await p.evaluate(() => { const c = state.party[0]; c.bag = []; c.equip = {}; addToBag(c, { t: 'w', id: 'mace', qty: 1 }); openHero(c.id); heroUi.tab = 'inv'; renderHero(); });
  const box = async sel => p.evaluate(sel => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  const drag = async (a, z) => { const A = await box(a), Z = await box(z); await p.mouse.move(A.x, A.y); await p.mouse.down(); await p.mouse.move(A.x + 30, A.y + 30, { steps: 4 }); await p.mouse.move(Z.x, Z.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300); };
  await drag('#heroov [data-hbag="0"]', '#heroov [data-eqslot="main"]');
  const D1 = await p.evaluate(() => ({ main: state.party[0].equip.main && state.party[0].equip.main.id, bag: state.party[0].bag.length }));
  ok('предмет из рюкзака перетащен в ячейку: надет', D1.main === 'mace' && D1.bag === 0, D1);
  await drag('#heroov [data-hslot="main"]', '#heroov .packwrap');
  const D2 = await p.evaluate(() => ({ main: state.party[0].equip.main && state.party[0].equip.main.id, bag: state.party[0].bag.length }));
  ok('надетое перетащено в рюкзак: снято', !D2.main && D2.bag === 1, D2);
  await p.evaluate(() => closeHero());
  // продажа оружия и брони
  const S = await p.evaluate(async () => { await loadTown(); const c = state.party[0], o = {}; c.gold = 0;
    c.bag = [{ t: 'w', id: 'mace', qty: 1 }, { t: 'a', id: 'leather', qty: 1, steel: true }]; state.townUnlocked = true; state.run = null;
    Town.open('forge'); document.querySelector('[data-t="bag"][data-i="0"]').click(); document.querySelector('[data-t="sellall"]').click(); o.forge = c.gold;
    document.querySelector('[data-t="bag"][data-i="0"]').click(); document.querySelector('[data-t="sellall"]').click(); o.forgeSteel = c.gold - o.forge; Town.close();
    c.gold = 0; c.bag = [{ t: 'w', id: 'sword', qty: 1, steel: true }]; Town.open('shop'); document.querySelector('[data-t="bag"][data-i="0"]').click(); document.querySelector('[data-t="sellall"]').click(); o.shop = c.gold; o.bagLeft = c.bag.length; Town.close(); return o; });
  ok('кузнец берёт обычное оружие на 10 % ниже (10 → 9) и стальную броню (40 → 36)', S.forge === 9 && S.forgeSteel === 36, S);
  ok('магазин берёт стальной меч на 20 % ниже (25 → 20)', S.shop === 20 && S.bagLeft === 0, S);
  // лимит заданий и сон в таверне
  const Q = await p.evaluate(async () => { const b = questBoard(); b.list = []; for (let i = 0; i < 5; i++) b.list.push({ id: ++b.seq, mon: 'goblin', rare: false, need: 8, reward: 24, taken: false, runs: 0, age: 0 });
    Town.open('board'); for (let i = 0; i < 5; i++) { const btn = document.querySelector('[data-t="qaccept"]'); if (btn) btn.click(); } const taken = b.list.filter(q => q.taken).length; Town.close();
    const t0 = townClock().t; state.party.forEach(c => { c.gold = 50; }); Town.open('tavern'); const sl = document.querySelector('[data-t="tv"][data-k="sleep"]'); state.party.forEach(c => { const el = document.querySelector(`[data-t="tv"][data-k="sleep"][data-id="${c.id}"]`); if (el) el.click(); }); const pay = document.querySelector('[data-t="tpay"],[data-t="pay"],[data-t="tv-pay"]'); if (pay) pay.click(); Town.close(); return { taken, spent: townClock().t - t0, hadPay: !!pay }; });
  ok('одновременно принято не больше 4 заданий', Q.taken === 4, Q);
  ok('сон в таверне — 1 действие', Q.spent === 1, Q);
  // невидимость
  const V = await p.evaluate(() => { const B = Battle; B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); const S = B.S, h = B.heroes()[0], m = B.mons()[0]; S.cells = S.cells.map(r => r.map(() => '')); S.dark = false; S.phase = 'fight'; h.x = 3; h.y = 4; m.x = 3; m.y = 3;
    const before = [B.seenByParty(m), B.visibleTo(h, m)]; B.addStatus(m, 'hidden', { k: Infinity, data: { invis: true } }); const after = [B.seenByParty(m), B.visibleTo(h, m), B.attackTargets(h, B.attacksOf(h)[0]).includes(m)]; return { before, after }; });
  ok('невидимого монстра не видно и атаковать нельзя', V.before[0] && V.before[1] && !V.after[0] && !V.after[1] && !V.after[2], V);
  ok('ошибок нет', errs.length === 0, errs);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
