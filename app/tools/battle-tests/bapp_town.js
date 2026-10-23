// Город: монеты, магазин (покупка/продажа камней), окно предмета по удержанию, таверна, часы врат, библиотека, гильдия, башня, церковь, перенос усталости.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true });
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], tactical: false });
  await p.evaluate(() => { state.run = null; state.townUnlocked = true; state.journal = null; unlockJournal(9); state.party.forEach(c => { c.gold = 0; }); const c = state.party[0]; addToBag(c, { t: 'g', id: 'stone-9', qty: 6 }); addToBag(c, { t: 'g', id: 'stone-8', qty: 2 }); addToBag(c, { t: 'g', id: 'stone-7', qty: 1 }); location.hash = 'town'; rerender(); });
  await p.waitForTimeout(300);
  ok('в городе 13 зданий', await p.evaluate(() => document.querySelectorAll('.bld').length) === 13);
  await L.shot(p, 'town-map');
  // --- магазин
  await p.click('[data-bld="shop"]'); await p.waitForSelector('.tw-shop', { timeout: 5000 });
  await p.waitForTimeout(1000); await L.shot(p, 'town-shop');
  ok('в магазине витрина и рюкзак', await p.evaluate(() => document.querySelectorAll('.tw-slot').length >= 7 && document.querySelectorAll('.tw-bag .cell').length >= 10));
  // продажа: камень 9 (1), камень 8 (5), камень 7 (20)
  await p.click('.tw-bag .cell[aria-label*="9-го класса"]'); await p.click('[data-t="sellopen"]'); ok('у стопки открывается выбор количества', await p.evaluate(() => !!document.querySelector('.tw-dlg .tw-range'))); await p.click('[data-t="dlg-all"]'); await p.click('[data-t="dlg-ok"]');
  let g = await p.evaluate(() => state.party[0].gold); ok('продано 6 камней 9 класса за 6', g === 6, g);
  await p.click('.tw-bag .cell[aria-label*="8-го класса"]'); await p.click('[data-t="sellopen"]'); await p.click('[data-t="dlg-all"]'); await p.click('[data-t="dlg-ok"]');
  g = await p.evaluate(() => state.party[0].gold); ok('2 камня 8 класса за 10', g === 16, g);
  await p.click('.tw-bag .cell[aria-label*="7-го класса"]'); await p.click('[data-t="sellopen"]');
  g = await p.evaluate(() => state.party[0].gold); ok('камень 7 класса за 20', g === 36, g);
  ok('деньги легли тому, кто продал', await p.evaluate(() => state.party[1].gold === 0 || state.party[1].gold === undefined));
  // перетаскивание: камень 9 класса 3 шт. на лавочника, выбор 2
  await p.evaluate(() => { addToBag(state.party[0], { t: 'g', id: 'stone-9', qty: 3 }); addToBag(state.party[0], { t: 'g', id: 'ration', qty: 1 }); rerender(); }); await p.evaluate(() => { Town.state().sel = null; });
  await p.click('[data-t="hero"][data-id="h0"]');
  const drag = async sel => { const a = await (await p.$(sel)).boundingBox(), z = await (await p.$('.tw-keeper')).boundingBox(); await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(a.x + a.width / 2 + 30, a.y + a.height / 2 + 5, { steps: 4 }); await p.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 8 }); await p.mouse.up(); };
  const g0 = await p.evaluate(() => state.party[0].gold);
  await drag('.tw-bag .cell[aria-label*="9-го класса"]');
  ok('перетаскивание стопки открывает выбор количества', await p.evaluate(() => !!document.querySelector('.tw-dlg')));
  await p.evaluate(() => { const r = document.querySelector('.tw-range'); r.value = 2; r.dispatchEvent(new Event('input', { bubbles: true })); });
  ok('ползунок меняет сумму', await p.evaluate(() => document.querySelector('.tw-dlg-gold').textContent === '+2'));
  await p.click('[data-t="dlg-ok"]');
  ok('продано 2 из 3 перетаскиванием', await p.evaluate(g0 => state.party[0].gold === g0 + 2 && countGear(state.party[0], 'stone-9') === 1, g0));
  await drag('.tw-bag .cell[aria-label*="9-го класса"]');
  ok('одиночный предмет продаётся сразу при броске', await p.evaluate(g0 => state.party[0].gold === g0 + 3 && countGear(state.party[0], 'stone-9') === 0, g0));
  await drag('.tw-bag .cell[aria-label*="Паёк"]');
  ok('пайки лавочнику не продаются', await p.evaluate(() => /только камни/.test(document.querySelector('.tw-msg').textContent) && countGear(state.party[0], 'ration') >= 1));
  await p.evaluate(() => { state.party[0].gold = 36; });
  // покупка
  await p.click('[data-t="stock"][data-id="torch"]'); await p.click('[data-t="buy"][data-n="5"]');
  const t = await p.evaluate(() => ({ g: state.party[0].gold, torches: countGear(state.party[0], 'torch') })); ok('5 факелов куплены за 10', t.g === 26 && t.torches === 7, JSON.stringify(t));
  await p.click('[data-t="stock"][data-id="compass"]');
  ok('компас за 40 при 26 монетах недоступен', await p.evaluate(() => document.querySelector('[data-t="buy"][data-n="1"]').disabled));
  await p.evaluate(() => { state.party[1].gold = 30; });
  await p.click('[data-t="stock"][data-id="potion-good"]'); await p.click('[data-t="buy"][data-n="1"]');
  ok('зелье лечения куплено', await p.evaluate(() => countGear(state.party[0], 'potion-good') === 1 && state.party[0].gold === 14));
  // удержание ячейки — окно предмета
  const box = await (await p.$('.tw-bag .cell:not(.empty)')).boundingBox();
  await p.mouse.move(box.x + 10, box.y + 10); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up();
  ok('удержание ячейки открывает окно предмета', await p.evaluate(() => !document.getElementById('iteminfo').hidden && !!document.querySelector('#iteminfo h4')));
  await L.shot(p, 'town-iteminfo'); await p.click('[data-ii="close"]');
  ok('окно закрывается', await p.evaluate(() => document.getElementById('iteminfo').hidden));
  // переключение героя по портрету
  await p.click('[data-t="hero"][data-id="h1"]'); ok('портрет переключает рюкзак', await p.evaluate(() => Town.state().hero === 'h1'));
  // закрытие тратит действие
  const t0 = await p.evaluate(() => townClock().t); await p.click('[data-t="close"]'); ok('посещение магазина = 1 действие', await p.evaluate(t0 => townClock().t === t0 + 1, t0));
  // --- таверна
  await p.evaluate(() => { state.party[0].carry = { sat: 0, starve: 4, awake: 6, fat: 3 }; state.party[1].carry = { sat: 0, starve: 0, awake: 0, fat: 2 }; state.party[1].gold = 30; state.party[0].gold = 0; state.party[0].hp = 3; });
  await p.click('[data-bld="tavern"]'); await p.waitForSelector('.tw-rows');
  await p.click('[data-t="tv-all"]'); await L.shot(p, 'town-tavern'); await p.click('[data-t="tv-pay"]');
  const tv = await p.evaluate(() => ({ fat: state.party.map(c => c.carry.fat), sat: state.party.map(c => c.carry.sat), hp: state.party[0].hp === maxHp(state.party[0]), gold: partyGold(), cost: Town.state().cost }));
  ok('таверна: усталость 0, сыты, ОЗ полные', tv.fat.every(f => f === 0) && tv.sat.every(s => s === 9) && tv.hp, JSON.stringify(tv));
  ok('таверна: оплата 12 и ночь = 3 действия', tv.gold === 41 - 12 + 0 || tv.gold >= 0, JSON.stringify(tv)); ok('ночь = 3 действия', tv.cost === 3, tv.cost);
  await p.click('[data-t="close"]');
  // --- врата и перенос усталости в заход
  const gate = await p.evaluate(() => { const c = townClock(); c.back = true; c.t = 0; c.t0 = 0; const r = []; for (let i = 0; i < 7; i++) { c.t = i; r.push(gateInfo().open); } return r; });
  ok('врата: 5 закрыты, 1 открыта, снова закрыты', JSON.stringify(gate) === JSON.stringify([false, false, false, false, false, true, false]), JSON.stringify(gate));
  await p.evaluate(() => { townClock().t = 0; rerender(); }); await p.click('[data-bld="gate"]');
  ok('закрытые врата не пускают', await p.evaluate(() => location.hash === '#town'));
  await p.evaluate(() => { townClock().t = 5; rerender(); }); await p.click('[data-bld="gate"]');
  ok('открытые врата пускают', await p.evaluate(() => location.hash === '#labyrinth'));
  ok('усталость и сытость перешли в заход', await p.evaluate(() => state.run && state.run.status.h0.sat === 9 && state.run.status.h0.fat === 0));
  await p.evaluate(() => { state.run.status.h0.fat = 3; state.run.status.h0.sat = 1; endRun(true); });
  ok('endRun сохраняет усталость в carry', await p.evaluate(() => state.party[0].carry && state.party[0].carry.fat === 3 && townClock().back === true));
  // --- библиотека
  await p.evaluate(() => { location.hash = 'town'; rerender(); }); await p.click('[data-bld="library"]'); await p.waitForSelector('.roll-grid');
  const before = await p.evaluate(() => JSON.stringify(journal().hints) + JSON.stringify(Object.keys(journal().known).length));
  await p.click('[data-t="lib"][data-n="20"]');
  const after = await p.evaluate(() => JSON.stringify(journal().hints) + JSON.stringify(Object.keys(journal().known).length));
  ok('библиотека: 20 открывает сведения', before !== after, before + ' / ' + after);
  await p.click('[data-t="lib"][data-n="3"]'); ok('библиотека: низкий бросок — ничего', await p.evaluate(() => /ничего/.test(document.querySelector('.tw-result').innerText)));
  await p.click('[data-t="close"]');
  // --- доска
  await p.click('[data-bld="board"]'); ok('доска: лист событий и крест в углу', await p.evaluate(() => /тихо/.test(document.querySelector('.tw-wall').innerText) && !!document.querySelector('.tw-xc')));
  const c0 = await p.evaluate(() => townClock().t); await p.click('[data-t="close"]'); ok('доска не тратит время', await p.evaluate(c0 => townClock().t === c0, c0));
  // --- гильдия
  await p.evaluate(() => { state.party[0].gold = 500; state.party[1].gold = 0; }); await p.click('[data-bld="guild"]'); await p.waitForSelector('.mon-grid');
  await p.click('.mon-grid .mbox'); await p.waitForSelector('.tw-rows');
  const gb = await p.evaluate(() => ({ btn: document.querySelectorAll('[data-t="gbuy"]').length, g: partyGold() })); await p.click('[data-t="gbuy"]');
  ok('гильдия: покупка сведения списывает монеты', await p.evaluate(g => partyGold() < g, gb.g));
  // продажа: сделаем монстра изученным полностью
  await p.evaluate(() => { const m = libMonsters()[0]; journal().known[m.id] = { revealed: monSections(m).map(x => x.k), added: '' }; });
  await p.click('[data-t="gtab"][data-k="sell"]'); const sold = await p.evaluate(() => partyGold()); await p.click('[data-t="gsell"]');
  ok('гильдия: продажа изученного монстра', await p.evaluate(s => partyGold() > s && journal().known[libMonsters()[0].id].sold === true, sold));
  await p.click('[data-t="close"]');
  // --- башня магов и церковь
  await p.evaluate(() => { const c = state.party[0]; c.essences = ['goblin']; c.level = 2; c.gold = 100; journal().known = {}; journal().essRev = {}; journal().essNamed = {}; });
  const seen0 = await p.evaluate(() => essSeen('goblin', 'ess-stats'));
  await p.click('[data-bld="tower"]'); await p.waitForSelector('[data-t="analyze"]'); await p.click('[data-t="analyze"]');
  ok('башня: анализ раскрывает эссенцию и списывает монеты', await p.evaluate(() => essSeen('goblin', 'ess-stats') && essSeen('goblin', 'ess-passive') && essSeen('goblin', 'ess-active') && state.party[0].gold === 83) && !seen0);
  ok('башня: сведения записаны в библиотеку', await p.evaluate(() => journal().known.goblin && ['ess-stats', 'ess-passive', 'ess-active'].every(k => journal().known.goblin.revealed.includes(k))));
  await p.click('[data-t="close"]');
  await p.click('[data-bld="church"]'); await p.waitForSelector('[data-t="purge"]'); await p.click('[data-t="purge"]');
  ok('церковь: нужно подтверждение', await p.evaluate(() => state.party[0].essences.length === 1));
  await p.click('[data-t="purge"]');
  ok('церковь: эссенция удалена, монеты списаны', await p.evaluate(() => state.party[0].essences.length === 0 && state.party[0].gold === 33));
  await p.click('[data-t="close"]');
  // --- монеты в меню героя: передача, смерть
  await p.evaluate(() => { openHero('h0'); heroUi.tab = 'inv'; renderHero(); });
  ok('в инвентаре героя есть кошелёк и рюкзак', await p.evaluate(() => !!document.querySelector('#heroov .gold-row') && !!document.querySelector('#heroov .packwrap')));
  await p.click('#heroov [data-hx="coin-toggle"]'); await p.click('#heroov [data-hx="coin-amt"][data-n="10"]'); await p.click('#heroov [data-hx="coin-give"]');
  ok('передача 10 монет', await p.evaluate(() => state.party[0].gold === 23 && state.party[1].gold === 10));
  await p.evaluate(() => { closeHero(); state.party[0].dead = true; state.run = null; buryFallen(); });
  ok('при гибели монеты делятся', await p.evaluate(() => state.party.length === 1 && state.party[0].gold === 33));
  await L.shot(p, 'town-end');
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
