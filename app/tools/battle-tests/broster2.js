// Запас: выбор «оставить вещи на герое / забрать в отряд» (13.11)
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : JSON.stringify(extra)); };
  await L.setup(p, { heroes: ['barb2', 'archer'], tactical: true, level: 3 });
  await p.evaluate(() => { localStorage.removeItem('sputnik.account.v1'); state.run = null; state.townUnlocked = true; state.party.forEach(c => { c.rank = 8; }); const c = state.party[1]; c.gold = 55; addToBag(c, { t: 'g', id: 'torch', qty: 3 }); location.hash = 'town'; rerender(); });
  await p.click('[data-bld="tavern"]'); await p.waitForSelector('.tw-tabs'); await p.click('[data-t="ttab"][data-k="roster"]'); await p.waitForSelector('[data-t="rost-out"]');
  const id = await p.evaluate(() => state.party[1].id), snap = () => p.evaluate(id => { const c = state.party.find(x => x.id === id) || reserveHeroes().find(x => x.id === id); return JSON.stringify({ e: c.equip, b: c.bag, g: c.gold }); }, id);
  const s0 = await snap();
  await p.click(`[data-t="rost-out"][data-id="${id}"]`); await p.waitForSelector('#rost-ask');
  ok('окно выбора: оставить / забрать / отмена', await p.evaluate(() => ['keep', 'take', 'x'].every(k => document.querySelector(`#rost-ask [data-ra="${k}"]`))));
  await p.click('#rost-ask [data-ra="x"]'); await p.waitForTimeout(150);
  ok('отмена — герой остался в отряде', await p.evaluate(() => state.party.length === 2));
  await p.click(`[data-t="rost-out"][data-id="${id}"]`); await p.click('#rost-ask [data-ra="keep"]'); await p.waitForTimeout(200);
  ok('оставить: в запасе герой со всеми вещами и монетами', (await snap()) === s0 && await p.evaluate(() => state.party.length === 1));
  await p.click(`[data-t="rost-in"][data-id="${id}"]`); await p.waitForTimeout(200);
  ok('вернулся с теми же вещами', (await snap()) === s0 && await p.evaluate(() => state.party.length === 2));
  const g0 = await p.evaluate(() => goldOf(state.party[0]));
  await p.click(`[data-t="rost-out"][data-id="${id}"]`); await p.click('#rost-ask [data-ra="take"]'); await p.waitForTimeout(200);
  const t = await p.evaluate(({ id, g0 }) => { const h = reserveHeroes().find(x => x.id === id), a = state.party[0]; return { bag: (h.bag || []).length, main: !!h.equip.main, body: h.equip.body && h.equip.body.id, gold: h.gold, got: goldOf(a) - g0, bow: (a.bag || []).some(e => e.id === 'shortbow'), torch: (a.bag || []).some(e => e.id === 'torch') }; }, { id, g0 });
  ok('забрать: вещи и монеты у отряда, на герое только одежда', t.bag === 0 && !t.main && t.body === 'clothes' && !t.gold && t.got === 55 && t.bow && t.torch, t);
  // не влезло — остаётся на герое
  await p.click(`[data-t="rost-in"][data-id="${id}"]`); await p.waitForTimeout(200);
  const k = await p.evaluate(id => { const c = state.party.find(x => x.id === id), a = state.party.find(x => x.id !== id); c.bag = [{ t: 'w', id: 'sword' }, { t: 'w', id: 'mace' }]; while ((a.bag || []).length < bagSize(a) - 1) a.bag.push({ t: 'w', id: 'dagger' }); heroToReserve(id, true); const h = reserveHeroes().find(x => x.id === id); return { left: h.bag.length, full: a.bag.length === bagSize(a) }; }, id);
  ok('что не влезло в рюкзаки отряда — осталось на герое', k.left === 1 && k.full, k);
  ok('нет ошибок страницы', !L.errors || !L.errors.length);
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`); await b.close();
})();
