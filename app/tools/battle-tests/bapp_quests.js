// Доска заданий: 2 задания за возвращение, принять/сдать, камни задания вместо обычных, продажа по цене камня, сгорание (камни → обычные), последний шанс.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], tactical: true, level: 3 });
  const A = await p.evaluate(async () => {
    const out = {}; await loadBattle();
    state.quests = null; state.party.forEach(c => { c.gold = 0; c.bag = (c.bag || []).filter(e => !(e.t === 'g' && /stone|qstone/.test(e.id))); });
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
  // --- вход в заход, принятие и падение камней
  const B = await p.evaluate(async () => {
    const out = {}, b = questBoard(); b.list = []; b.seq = 100; b.list.push({ id: 101, mon: 'goblin', rare: false, need: 8, reward: 24, taken: true, runs: 0, age: 0 });
    state.party.forEach(c => { c.hp = maxHp(c); c.dead = false; });
    const hs = state.party; state.run.status = {}; hs.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; c.bag = []; });
    Battle.cfg.fast = true;
    const qs = () => hs.reduce((a, c) => a + (c.bag || []).filter(e => e.id === 'qstone').reduce((x, e) => x + e.qty, 0), 0);
    const st = id => hs.reduce((a, c) => a + countGear(c, id), 0);
    // убийство гоблина по заданию: камень задания вместо обычного
    const S = await (async () => { const S_ = await Battle.start({ list: ['goblin', 'goblin'], zone: 'goblin', floor: 1, killed: [] }, { sim: true, autoHeroes: true }); await Battle.End.run(S_); return S_; })();
    const killed = S.killed.length;
    out.killed = killed; out.q1 = qs() === killed && st('stone-9') === 0;
    out.qinfo = hs.flatMap(c => c.bag).filter(e => e.id === 'qstone').every(e => e.qid === 101 && e.mon === 'goblin' && e.cls === 9);
    out.qname = (() => { const e = hs.flatMap(c => c.bag).find(e => e.id === 'qstone'); return !!e && itemOf(e).name === 'Камень задания: Гоблин'; })(); out.dbg = { outcome: S.outcome, bags: hs.map(c => (c.bag || []).map(e => e.id + (e.qid ? ':' + e.qid : '') + 'x' + e.qty)), active: !!questActive('goblin'), list: JSON.stringify(questBoard().list) };
    // другой вид — обычный камень
    const before = st('stone-9'); const S2 = await (async () => { const S_ = await Battle.start({ list: ['wolf'], zone: 'beast', floor: 1, killed: [] }, { sim: true, autoHeroes: true }); await Battle.End.run(S_); return S_; })();
    out.other = st('stone-9') - before === S2.killed.length && qs() === killed;
    // принятый, но runs >= 2 (последний шанс): камни уже не падают
    b.list[0].runs = 2; const q0 = qs(); await (async () => { const S_ = await Battle.start({ list: ['goblin'], zone: 'goblin', floor: 1, killed: [] }, { sim: true, autoHeroes: true }); await Battle.End.run(S_); return S_; })();
    out.noDropLast = qs() === q0; b.list[0].runs = 0;
    // не принятое задание камни не даёт
    b.list[0].taken = false; const q1 = qs(), s1 = st('stone-9'); const S3 = await (async () => { const S_ = await Battle.start({ list: ['goblin'], zone: 'goblin', floor: 1, killed: [] }, { sim: true, autoHeroes: true }); await Battle.End.run(S_); return S_; })();
    out.untaken = qs() === q1 && st('stone-9') - s1 === S3.killed.length; b.list[0].taken = true;
    return out;
  });
  ok('убито ' + B.killed + ': камни задания вместо обычных', B.q1, JSON.stringify(B)); ok('камень задания несёт номер, вид и класс', B.qinfo); ok('название «Камень задания: Гоблин»', B.qname);
  ok('другие виды — обычные камни', B.other); ok('в последний шанс камни не падают', B.noDropLast); ok('непринятое задание камней не даёт', B.untaken);
  // --- продажа в магазине по цене камня
  await p.evaluate(() => { state.run = null; state.townUnlocked = true; state.party.forEach(c => { c.gold = 0; }); const c = state.party[0]; c.bag = []; addToBag(c, { t: 'g', id: 'qstone', qid: 101, mon: 'goblin', cls: 9, qty: 3 }); addToBag(c, { t: 'g', id: 'stone-9', qty: 2 }); location.hash = 'town'; rerender(); });
  const st2 = await p.evaluate(() => state.party[0].bag.filter(e => e.id === 'qstone' || e.id === 'stone-9').length); ok('камни задания и обычные — разные стопки', st2 === 2, st2);
  await p.click('[data-bld="shop"]'); await p.waitForSelector('.tw-shop');
  await p.click('.tw-bag .cell[aria-label*="Камень задания"]'); await p.click('[data-t="sellopen"]'); await p.click('[data-t="dlg-all"]'); await p.click('[data-t="dlg-ok"]');
  ok('камни задания проданы по цене камня 9 класса (3 монеты)', await p.evaluate(() => state.party[0].gold === 3 && countGear(state.party[0], 'qstone') === 0));
  await p.click('[data-t="close"]');
  // --- доска: принять, сдать
  await p.evaluate(() => { const b = questBoard(); b.list = [{ id: 201, mon: 'wolf', rare: false, need: 8, reward: 24, taken: false, runs: 0, age: 0 }, { id: 202, mon: 'bat', rare: true, need: 3, reward: 24, taken: false, runs: 0, age: 0 }]; state.party.forEach(c => { c.gold = 0; c.bag = []; }); rerender(); });
  await p.click('[data-bld="board"]'); await p.waitForSelector('.tw-sheetq');
  ok('на доске 2 листа с кнопкой «Принять» и событиями', await p.evaluate(() => document.querySelectorAll('[data-t="qaccept"]').length === 2 && document.querySelectorAll('.tw-sheetq').length === 3 && !!document.querySelector('.tw-xc')));
  await p.screenshot({ path: '/tmp/battle-shots/board.png' });
  await p.click('[data-t="qaccept"][data-id="201"]');
  ok('задание принято всем отрядом', await p.evaluate(() => questBoard().list.find(q => q.id === 201).taken === true));
  ok('сдать нельзя без камней', await p.evaluate(() => document.querySelector('[data-t="qdone"][data-id="201"]').disabled));
  await p.evaluate(() => { addToBag(state.party[0], { t: 'g', id: 'qstone', qid: 201, mon: 'wolf', cls: 9, qty: 5 }); addToBag(state.party[1], { t: 'g', id: 'qstone', qid: 201, mon: 'wolf', cls: 9, qty: 5 }); });
  await p.click('[data-t="close"]'); await p.click('[data-bld="board"]'); await p.waitForSelector('.tw-sheetq');
  ok('камни у разных героев складываются: 10 из 8', await p.evaluate(() => /10 \/ 8/.test(document.querySelector('.tw-sheetq.taken').innerText)));
  await p.click('[data-t="qdone"][data-id="201"]');
  const done = await p.evaluate(() => ({ gold: partyGold(), q: questStones({ id: 201 }), st: state.party.reduce((a, c) => a + countGear(c, 'stone-9'), 0), left: questBoard().list.length }));
  ok('награда 24 поделена на отряд', done.gold === 24, JSON.stringify(done)); ok('лишние 2 камня стали обычными, камней задания нет', done.q === 0 && done.st === 2, JSON.stringify(done)); ok('задание снято с доски', done.left === 1);
  await p.click('[data-t="close"]');
  // --- срок: 2 захода и последний шанс, сгорание
  const T = await p.evaluate(() => {
    const out = {}, b = questBoard(); b.list = [{ id: 301, mon: 'fox', rare: false, need: 9, reward: 27, taken: false, runs: 0, age: 0 }, { id: 302, mon: 'goblin', rare: false, need: 8, reward: 24, taken: false, runs: 0, age: 0 }];
    b.list[0].taken = true; state.party.forEach(c => { c.bag = []; c.gold = 0; });
    addToBag(state.party[0], { t: 'g', id: 'qstone', qid: 301, mon: 'fox', cls: 9, qty: 4 }); addToBag(state.party[1], { t: 'g', id: 'qstone', qid: 301, mon: 'fox', cls: 9, qty: 3 });
    out.activeNow = !!questActive('fox');
    newRun(); endRun(true);                                         // заход 1
    let q = questBoard().list.find(x => x.id === 301); out.runs1 = q && q.runs === 1 && !!questActive('fox');
    newRun(); endRun(true);                                         // заход 2
    q = questBoard().list.find(x => x.id === 301); out.runs2 = q && q.runs === 2 && !questActive('fox');          // камни уже не падают, но сдать можно
    out.lastChanceKept = !!q && questStones(q) === 7;
    out.unacceptedGone = !questBoard().list.some(x => x.id === 302);
    newRun();                                                      // 3-й спуск: сгорело
    out.burnt = !questBoard().list.some(x => x.id === 301);
    out.converted = state.party.reduce((a, c) => a + countGear(c, 'stone-9'), 0) === 7 && state.party.reduce((a, c) => a + countGear(c, 'qstone'), 0) === 0;
    out.noQAfter = !questActive('fox');
    return out;
  });
  ok('принятое задание активно', T.activeNow); ok('после 1-го захода ещё активно', T.runs1); ok('после 2-го захода — последний шанс (камни не падают, сдать можно)', T.runs2 && T.lastChanceKept, JSON.stringify(T));
  ok('непринятое задание сорвано через заход', T.unacceptedGone); ok('на 3-м спуске задание сгорело', T.burnt); ok('камни задания стали обычными камнями того же ранга', T.converted, JSON.stringify(T)); ok('с этих монстров камни задания больше не падают', T.noQAfter);
  // --- сдача в последний шанс успевает
  const L2 = await p.evaluate(() => {
    const b = questBoard(); b.list = [{ id: 401, mon: 'fox', rare: false, need: 8, reward: 24, taken: true, runs: 2, age: 0 }]; state.party.forEach(c => { c.bag = []; c.gold = 0; });
    addToBag(state.party[0], { t: 'g', id: 'qstone', qid: 401, mon: 'fox', cls: 9, qty: 8 });
    const q = b.list[0]; const can = questStones(q) >= q.need; questTurnIn(q); return { can, gold: partyGold(), left: b.list.length };
  });
  ok('в последний шанс задание можно сдать', L2.can && L2.gold === 24 && L2.left === 0, JSON.stringify(L2));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
