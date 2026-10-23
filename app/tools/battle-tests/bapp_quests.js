// Доска заданий и сумка для камней: 2 задания за возвращение, камни по видам монстров в общей сумке, сдача из сумки, продажа с галочками и ползунками, сгорание задания (камни остаются), последний шанс.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], tactical: true, level: 3 });
  const A = await p.evaluate(async () => {
    const out = {}; await loadBattle();
    state.quests = null; state.party.forEach(c => { c.gold = 0; c.bag = (c.bag || []).filter(e => !(e.t === 'g' && /stone|qstone/.test(e.id))); state.sack = null; });
    endRun(true);                                                   // возвращение №1: на доске 2 задания
    const bq = () => questBoard().list;
    out.two = bq().length === 2;
    out.valid = bq().every(q => { const m = MONSTERS.find(x => x.id === q.mon); return m && m.cls === 9 && m.floor === 1 && !m.draft && !!m.rare === q.rare && (q.rare ? q.need >= 3 && q.need <= 5 : q.need >= 8 && q.need <= 10) && q.reward > 0 && !q.taken; });
    // много возвращений: диапазоны
    const seen = { n: new Set(), r: new Set() }; for (let i = 0; i < 300; i++) { state.quests = null; postQuests(); for (const q of questBoard().list) (q.rare ? seen.r : seen.n).add(q.need); }
    out.rangeN = [...seen.n].sort().join() === '10,8,9'.split(',').sort().join() || ([...seen.n].every(v => v >= 8 && v <= 10) && seen.n.size === 3);
    out.rangeR = [...seen.r].every(v => v >= 3 && v <= 5) && seen.r.size === 3;
    state.quests = null; postQuests(); newRun();                    // чистая доска и заход
    return out;
  });
  ok('на доске 2 задания после возвращения', A.two); ok('задание: 9 класс, 8–10 обычных или 3–5 редких', A.valid); ok('диапазон 8–10 (обычные)', A.rangeN); ok('диапазон 3–5 (редкие)', A.rangeR);
  // --- камни в сумке: по видам монстров
  const B = await p.evaluate(async () => {
    const out = {}, b = questBoard(); b.list = []; b.seq = 100; b.list.push({ id: 101, mon: 'goblin', rare: false, need: 8, reward: 24, taken: true, runs: 0, age: 0 });
    state.sack = null; state.party.forEach(c => { c.hp = maxHp(c); c.dead = false; c.bag = []; });
    state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    Battle.cfg.fast = true;
    const fight = async (list, zone) => { const S_ = await Battle.start({ list, zone, floor: 1, killed: [] }, { sim: true, autoHeroes: true }); await Battle.End.run(S_); return S_; };
    const S = await fight(['goblin', 'goblin'], 'goblin'); const k1 = S.killed.length;
    out.k1 = k1; out.sackGoblin = sackCount('goblin') === k1;
    out.noQstone = state.party.every(c => (c.bag || []).every(e => e.id !== 'qstone' && !/^stone-/.test(e.id)));
    const S2 = await fight(['wolf'], 'beast'); out.sackWolf = sackCount('wolf') === S2.killed.length && sackCount('goblin') === k1;
    // принятое и непринятое задание ничего не меняют: камни падают всегда
    b.list[0].runs = 2; const g0 = sackCount('goblin'); const S3 = await fight(['goblin'], 'goblin'); out.lastChance = sackCount('goblin') - g0 === S3.killed.length; b.list[0].runs = 0;
    b.list[0].taken = false; const g1 = sackCount('goblin'); const S4 = await fight(['goblin'], 'goblin'); out.untaken = sackCount('goblin') - g1 === S4.killed.length; b.list[0].taken = true;
    // найденные камни (без монстра) и камни 8 класса — отдельные строки
    addToBag(state.party[0], { t: 'g', id: 'stone-9', qty: 3 }); addToBag(state.party[1], { t: 'g', id: 'stone-8', qty: 2 });
    out.found = sack().items['c:9'].qty === 3 && sack().items['c:8'].qty === 2 && state.party.every(c => (c.bag || []).length === 0);
    out.rows = sackRows().map(r => r.name + ':' + r.cls + ':' + r.qty + ':' + r.price);
    out.sorted = sackRows().every((r, i, a) => !i || a[i - 1].cls >= r.cls);
    out.priceOk = sackRows().every(r => r.price === ({ 9: 1, 8: 5, 7: 20 })[r.cls]);
    return out;
  });
  ok('камни убитых гоблинов (' + B.k1 + ') легли в сумку по виду', B.sackGoblin, JSON.stringify(B)); ok('в рюкзаках камней и камней задания нет', B.noQstone);
  ok('волки — отдельная строка, гоблины не тронуты', B.sackWolf); ok('в последний шанс камни тоже падают', B.lastChance); ok('и по непринятому заданию', B.untaken);
  ok('найденные камни и камни 8 класса — отдельные строки, рюкзаки пусты', B.found, JSON.stringify(B.rows)); ok('список отсортирован по классу, цены 1/5/20', B.sorted && B.priceOk);
  // --- просмотр сумки (только чтение)
  await p.evaluate(() => { state.run = null; state.townUnlocked = true; state.party.forEach(c => { c.gold = 0; }); location.hash = 'town'; rerender(); openSack(); });
  ok('просмотр: колонки имя/класс/штук/цена выровнены в сетке', await p.evaluate(() => { const rows = [...document.querySelectorAll('.sk-row')]; if (!rows.length) return false; const xs = rows.map(r => [...r.children].map(c => Math.round(c.getBoundingClientRect().left))); return xs.every(x => x.join() === xs[0].join()) && getComputedStyle(rows[0]).display === 'grid'; }));
  await L.shot(p, 'sack-view'); await p.click('[data-ii="close"]');
  // --- магазин: окно продажи с галочками и ползунками
  await p.click('[data-bld="shop"]'); await p.waitForSelector('.tw-shop');
  ok('плитка сумки есть, сами камни в рюкзаке не продаются', await p.evaluate(() => !!document.querySelector('.tw-sacktile') && !document.querySelector('.tw-bag .cell[aria-label*="Камень"]')));
  await p.click('.tw-sacktile');
  const D = await p.evaluate(() => ({ rows: document.querySelectorAll('.tw-sk-row').length, chk: [...document.querySelectorAll('.tw-sk-chk')].every(c => c.checked), full: [...document.querySelectorAll('.tw-sk-range')].every(r => +r.value === +r.max), sell: !!document.querySelector('.tw-sk-foot [data-t="sk-sell"]'), total: document.querySelector('.tw-sk-total').innerText }));
  ok('окно продажи: все строки выбраны, ползунки на максимуме, кнопка внизу', D.rows >= 3 && D.chk && D.full && D.sell, JSON.stringify(D));
  ok('кнопка «Продать» зафиксирована (вне прокручиваемого списка)', await p.evaluate(() => !document.querySelector('.tw-sk-list').contains(document.querySelector('[data-t="sk-sell"]'))));
  await L.shot(p, 'sack-sell');
  ok('колонки окна продажи выровнены', await p.evaluate(() => { const rows = [...document.querySelectorAll('.tw-sk-row')]; const xs = rows.map(r => [...r.children].map(c => Math.round(c.getBoundingClientRect().left))); return xs.every(x => x.join() === xs[0].join()); }));
  // убрать галочку у волков, у гоблинов продать 2, у 8 класса — всё
  const before = await p.evaluate(() => ({ g: sackCount('goblin'), w: sackCount('wolf'), c8: sack().items['c:8'].qty, c9: sack().items['c:9'].qty, gold: state.party[0].gold }));
  await p.evaluate(() => { const row = k => document.querySelector(`.tw-sk-row[data-key="${k}"]`); row('m:wolf').querySelector('.tw-sk-chk').click(); const r = row('m:goblin').querySelector('.tw-sk-range'); r.value = 2; r.dispatchEvent(new Event('input', { bubbles: true })); });
  ok('итог пересчитан: гоблины 2×1 + найденные 9 кл. 3×1 + 8 кл. 2×5', await p.evaluate(() => /\+15/.test(document.querySelector('.tw-sk-total').innerText)), await p.evaluate(() => document.querySelector('.tw-sk-total').innerText));
  await p.click('[data-t="sk-sell"]');
  const after = await p.evaluate(() => ({ g: sackCount('goblin'), w: sackCount('wolf'), c8: (sack().items['c:8'] || {}).qty || 0, c9: (sack().items['c:9'] || {}).qty || 0, gold: state.party[0].gold }));
  ok('продано выбранное количество, отключённое осталось', after.g === before.g - 2 && after.w === before.w && after.c8 === 0 && after.c9 === 0 && after.gold === before.gold + 15, JSON.stringify({ before, after }));
  ok('в окне остались невыбранные/непроданные строки', await p.evaluate(() => document.querySelectorAll('.tw-sk-row').length >= 2));
  await p.click('[data-t="sk-close"]');
  // перетаскивание сумки на лавочника
  const drag = async sel => { const a = await (await p.$(sel)).boundingBox(), z = await (await p.$('.tw-keeper')).boundingBox(); await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(a.x + a.width / 2 + 30, a.y + a.height / 2 - 5, { steps: 4 }); await p.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 8 }); await p.mouse.up(); };
  await drag('.tw-sacktile');
  ok('перетаскивание сумки на лавочника открывает продажу', await p.evaluate(() => !!document.querySelector('.tw-sk')));
  await p.click('[data-t="sk-sell"]');
  ok('всё проданное: сумка пуста', await p.evaluate(() => sackTotal() === 0));
  ok('после продажи всего окно закрылось', await p.evaluate(() => !document.querySelector('.tw-sk')));
  await p.click('[data-t="close"]');
  // --- доска: принять, сдать из сумки
  await p.evaluate(() => { const b = questBoard(); b.list = [{ id: 201, mon: 'wolf', rare: false, need: 8, reward: 24, taken: false, runs: 0, age: 0 }, { id: 202, mon: 'bat', rare: true, need: 3, reward: 24, taken: false, runs: 0, age: 0 }]; state.party.forEach(c => { c.gold = 0; }); state.sack = null; sackAdd('wolf', 9, 5); rerender(); });
  await p.click('[data-bld="board"]'); await p.waitForSelector('.tw-sheetq');
  ok('на доске 2 листа с кнопкой «Принять» и событиями', await p.evaluate(() => document.querySelectorAll('[data-t="qaccept"]').length === 2 && document.querySelectorAll('.tw-sheetq').length === 3 && !!document.querySelector('.tw-xc')));
  ok('камни, добытые до принятия, считаются: 5 из 8', await p.evaluate(() => /5 \/ 8/.test(document.querySelector('.tw-sheetq').innerText)));
  await p.screenshot({ path: '/tmp/battle-shots/board.png' });
  await p.click('[data-t="qaccept"][data-id="201"]');
  ok('задание принято всем отрядом', await p.evaluate(() => questBoard().list.find(q => q.id === 201).taken === true));
  ok('сдать нельзя при нехватке камней', await p.evaluate(() => document.querySelector('[data-t="qdone"][data-id="201"]').disabled));
  await p.evaluate(() => { sackAdd('wolf', 9, 5); sackAdd('fox', 9, 4); });
  await p.click('[data-t="close"]'); await p.click('[data-bld="board"]'); await p.waitForSelector('.tw-sheetq');
  ok('в сумке 10 из 8', await p.evaluate(() => /10 \/ 8/.test(document.querySelector('.tw-sheetq.taken').innerText)));
  await p.click('[data-t="qdone"][data-id="201"]');
  const done = await p.evaluate(() => ({ gold: partyGold(), wolf: sackCount('wolf'), fox: sackCount('fox'), left: questBoard().list.length }));
  ok('награда 24 поделена на отряд', done.gold === 24, JSON.stringify(done)); ok('сдано 8 волчьих камней, 2 лишних и лисьи остались в сумке', done.wolf === 2 && done.fox === 4, JSON.stringify(done)); ok('задание снято с доски', done.left === 1, JSON.stringify(done));
  await p.click('[data-t="close"]');
  // --- срок: 2 захода и последний шанс, сгорание (камни остаются в сумке)
  const T = await p.evaluate(() => {
    const out = {}, b = questBoard(); b.list = [{ id: 301, mon: 'fox', rare: false, need: 9, reward: 27, taken: true, runs: 0, age: 0 }, { id: 302, mon: 'goblin', rare: false, need: 8, reward: 24, taken: false, runs: 0, age: 0 }];
    state.sack = null; sackAdd('fox', 9, 7);
    newRun(); endRun(true);
    let q = questBoard().list.find(x => x.id === 301); out.runs1 = q && q.runs === 1;
    newRun(); endRun(true);
    q = questBoard().list.find(x => x.id === 301); out.runs2 = q && q.runs === 2 && questStones(q) === 7;
    out.unacceptedGone = !questBoard().list.some(x => x.id === 302);
    newRun();
    out.burnt = !questBoard().list.some(x => x.id === 301); out.kept = sackCount('fox') === 7;
    return out;
  });
  ok('после 1-го захода задание держится', T.runs1); ok('после 2-го — последний шанс, камни на месте', T.runs2); ok('непринятое сорвано через заход', T.unacceptedGone);
  ok('на 3-м спуске задание сгорело, камни остались в сумке', T.burnt && T.kept, JSON.stringify(T));
  // --- сдача в последний шанс
  const L2 = await p.evaluate(() => {
    const b = questBoard(); b.list = [{ id: 401, mon: 'fox', rare: false, need: 8, reward: 24, taken: true, runs: 2, age: 0 }]; state.party.forEach(c => { c.gold = 0; }); state.sack = null; sackAdd('fox', 9, 8);
    const q = b.list[0]; const can = questStones(q) >= q.need; questTurnIn(q); return { can, gold: partyGold(), left: b.list.length, fox: sackCount('fox') };
  });
  ok('в последний шанс задание можно сдать', L2.can && L2.gold === 24 && L2.left === 0 && L2.fox === 0, JSON.stringify(L2));
  // --- перенос старых камней из рюкзаков в сумку
  const M = await p.evaluate(() => {
    state.sack = null; const c = state.party[0]; c.bag = [{ t: 'g', id: 'stone-9', qty: 4 }, { t: 'g', id: 'qstone', qid: 5, mon: 'goblin', cls: 9, qty: 3 }, { t: 'g', id: 'ration', qty: 2 }];
    sack(); return { bag: c.bag.map(e => e.id).join(), c9: sack().items['c:9'].qty, gob: sackCount('goblin') };
  });
  ok('старые камни и камни задания перенесены в сумку', M.bag === 'ration' && M.c9 === 4 && M.gob === 3, JSON.stringify(M));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
