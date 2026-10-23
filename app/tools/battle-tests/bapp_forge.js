// Кузница: цены (оружие 10, броня 15, сталь 25/40), стальные предметы дают +1 к атаке, урону и КД; метка steel не теряется при экипировке.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true });
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], tactical: true });
  await p.evaluate(() => { state.run = null; state.townUnlocked = true; state.party.forEach(c => { c.gold = 500; }); location.hash = 'town'; rerender(); });
  await p.waitForTimeout(300);
  await p.click('[data-bld="forge"]'); await p.waitForSelector('.tw-shop');
  const base = await p.evaluate(() => [...document.querySelectorAll('.tw-slot')].map(s => s.getAttribute('aria-label')));
  ok('обычное: 11 видов оружия и щитов + 3 брони', base.length === 14, base.length);
  ok('цены: оружие 10, броня 15', base.filter(x => /10 монет/.test(x)).length === 11 && base.filter(x => /15 монет/.test(x)).length === 3, JSON.stringify(base));
  await L.shot(p, 'forge-base');
  await p.click('[data-t="ftab"][data-k="steel"]');
  const steel = await p.evaluate(() => [...document.querySelectorAll('.tw-slot')].map(s => s.getAttribute('aria-label')));
  ok('улучшенное: оружие 25, броня 40', steel.length === 14 && steel.filter(x => /25 монет/.test(x)).length === 11 && steel.filter(x => /40 монет/.test(x)).length === 3, JSON.stringify(steel));
  await L.shot(p, 'forge-steel');
  await p.click('[data-t="stock"][data-id="sw:sword"]'); await p.click('[data-t="buy"][data-n="1"]');
  await p.click('[data-t="stock"][data-id="sa:chainmail"]'); await p.click('[data-t="buy"][data-n="1"]');
  await p.click('[data-t="stock"][data-id="sw:shield"]'); await p.click('[data-t="buy"][data-n="1"]');
  const bag = await p.evaluate(() => state.party[0].bag.filter(e => e.steel).map(e => e.id + ':' + e.t + ':' + state.party[0].gold));
  ok('стальные предметы в рюкзаке с меткой', bag.length === 3, JSON.stringify(bag));
  ok('списано 25 + 40 + 25', await p.evaluate(() => state.party[0].gold === 410));
  await p.click('[data-t="ftab"][data-k="base"]'); await p.click('[data-t="stock"][data-id="w:sword"]'); await p.click('[data-t="buy"][data-n="1"]');
  ok('обычный меч за 10', await p.evaluate(() => state.party[0].gold === 400 && state.party[0].bag.filter(e => e.id === 'sword').length === 2));
  await p.click('[data-t="close"]');
  // экипировка и бой
  const res = await p.evaluate(async () => {
    await loadBattle();
    const c = state.party[0], out = {};
    const steelSword = c.bag.find(e => e.id === 'sword' && e.steel), plain = c.bag.find(e => e.id === 'sword' && !e.steel), chain = c.bag.find(e => e.id === 'chainmail'), shield = c.bag.find(e => e.id === 'shield');
    out.name = itemOf(steelSword).name; out.chainName = itemOf(chain).name; out.chainAc = itemOf(chain).ac; out.shieldName = itemOf(shield).name;
    c.equip.main = { t: 'w', id: 'sword', steel: true }; c.equip.body = { t: 'a', id: 'chainmail', steel: true }; c.equip.off = { t: 'w', id: 'shield', steel: true };
    const t1 = totals(c), d1 = derived(t1, c);
    c.equip.main = { t: 'w', id: 'sword' }; c.equip.body = { t: 'a', id: 'chainmail' }; c.equip.off = { t: 'w', id: 'shield' };
    const d0 = derived(totals(c), c);
    out.acDiff = d1.ac - d0.ac;
    // атака
    state.run = { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false }; state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 };
    const mk = steel => { c.equip.main = { t: 'w', id: 'sword', ...(steel ? { steel: true } : {}) }; const S = Battle.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); const u = Battle.heroes()[0]; const a = Battle.heroAttacks(u).find(x => x.id === 'hand:sword'); return { hit: a.hit, b: a.dmg.b, parts: a.parts.map(q => q.l) }; };
    const s0 = mk(false), s1 = mk(true); out.hit = s1.hit - s0.hit; out.dmg = s1.b - s0.b; out.parts = s1.parts.includes('Сталь');
    // снятие и экипировка через меню сохраняют метку
    c.equip = { body: { t: 'g', id: 'clothes' } }; c.bag = [{ t: 'w', id: 'sword', qty: 1, steel: true }]; openHero('h0'); heroUi.tab = 'inv'; renderHero();
    heroUi.sel = 0; renderHero(); document.querySelector('#heroov [data-hx="equip"][data-slot-to="main"]').click();
    out.equipKept = c.equip.main && c.equip.main.steel === true;
    document.querySelector('#heroov [data-hslot="main"]') && document.querySelector('#heroov [data-hslot="main"]').click();
    document.querySelector('#heroov [data-hx="unequip"]').click();
    out.unequipKept = c.bag.some(e => e.id === 'sword' && e.steel === true);
    closeHero();
    return out;
  });
  ok('название стального меча', res.name === 'Стальной меч', res.name);
  ok('кольчуга +1 КД и название', res.chainName === 'Стальная кольчуга' && res.chainAc === '17', res.chainName + res.chainAc);
  ok('стальной щит: название', res.shieldName === 'Стальной щит', res.shieldName);
  ok('КД: кольчуга +1 и щит +1 = +2', res.acDiff === 2, res.acDiff);
  ok('стальной меч: +1 к атаке и +1 к урону', res.hit === 1 && res.dmg === 1 && res.parts, JSON.stringify(res));
  ok('метка сохраняется при экипировке и снятии', res.equipKept && res.unequipKept, JSON.stringify(res));
  // шопинг: колчан, паёк, компас по новым ценам
  await p.evaluate(() => { state.party[0].bag = []; state.party[0].gold = 100; rerender(); });
  await p.click('[data-bld="shop"]'); await p.waitForSelector('.tw-stock');
  await p.click('[data-t="stock"][data-id="arrow"]'); await p.click('[data-t="buy"][data-n="1"]');
  await p.click('[data-t="stock"][data-id="ration"]'); await p.click('[data-t="buy"][data-n="1"]');
  const sh = await p.evaluate(() => ({ g: state.party[0].gold, arrows: countGear(state.party[0], 'arrow'), rations: countGear(state.party[0], 'ration') }));
  ok('колчан 40 стрел за 20, 5 пайков за 1', sh.g === 79 && sh.arrows === 40 && sh.rations === 5, JSON.stringify(sh));
  await p.click('[data-t="close"]');
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
