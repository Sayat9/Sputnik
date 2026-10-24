// Волчья чаща: руины зданий 2 × 2 у выходного портала — границы, события (находка чаще), таблицы поиска с предметами, встречи, отрисовка.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const A = await p.evaluate(() => {
    const out = {}, r = state.run;
    r.floor = 1; delete r.variant; r.pos = { x: 0, y: 10 }; r.day = 3; r.act = 2; switchFloor(); r.floor = 2; r.variant = 'beast';
    out.variant = r.variant;
    const ruins = [], other = [];
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) (isRuins(x, y) ? ruins : other).push(x + ',' + y);
    out.ruins = ruins.sort().join(' ');
    out.portalKind = zoneAt(10, 0).kind;
    out.bound = !isRuins(8, 0) && !isRuins(9, 2) && !isRuins(8, 1);
    // другие варианты руин не имеют
    for (const v of ['goblin', 'undead']) { r.variant = v; out['no_' + v] = [...Array(11).keys()].every(x => [...Array(11).keys()].every(y => !isRuins(x, y))); }
    r.variant = 'beast';
    // события: 1–12 без изменений, находка чаще
    const cnt = (ru) => { const m = {}; for (let n = 1; n <= 20; n++) { const k = eventOf(n, ru)[1]; m[k] = (m[k] || 0) + 1; } return m; };
    out.base = cnt(false); out.ruinsEv = cnt(true);
    out.sameMon = [1, 4, 9, 12].every(n => eventOf(n, false)[1] === eventOf(n, true)[1]);
    // таблицы поиска
    r.pos = { x: 9, y: 1 };
    out.keys = [searchKey('explore', null), searchKey('dig', null), searchKey('explore', {})];
    r.pos = { x: 5, y: 5 }; out.keysPlain = [searchKey('explore', null), searchKey('dig', null)];
    const itemShare = k => SEARCH_TABLE[k].reduce((a, row, i, t) => a + (['supplies', 'gear'].includes(row[1]) ? row[0] - (i ? t[i - 1][0] : 0) : 0), 0);
    out.items = [itemShare('explore'), itemShare('explore-ruins'), itemShare('dig'), itemShare('dig-ruins')];
    out.full = ['explore-ruins', 'dig-ruins'].every(k => SEARCH_TABLE[k][SEARCH_TABLE[k].length - 1][0] === 20);
    // награды: gear и supplies реально выдаются
    const lines = []; searchReward([20, 'gear'], { kind: 'explore' }, null, lines); searchReward([10, 'supplies'], { kind: 'explore' }, null, lines);
    out.lines = lines.length >= 2;
    // встречи в руинах
    r.day = 4; const bad = []; for (const [x, y] of [[9, 0], [9, 1], [10, 1]]) for (let k = 0; k < 20; k++) { const e = genEncounter(x, y, 4, 1 + (k % 12), false); if (!e || !e.list.length) bad.push(x + ',' + y); }
    out.bad = bad;
    // отрисовка карты и окна поиска
    location.hash = 'labyrinth'; r.pending = null; dgUi.enc = null; route(); out.render = !!document.getElementById('dg-svg') && document.getElementById('dg-svg').innerHTML.length > 1000;
    out.deco = tileDeco(9, 1).length > 20 && tileDeco(9, 1) !== tileDeco(5, 5);
    r.pos = { x: 9, y: 1 }; dgUi.phase = 'explore'; dgUi.sr = { pick: null, luck: null }; out.overlay = /Руины зданий/.test(searchOverlay());
    dgUi.phase = 'menu';
    return out;
  });
  ok('руины — ровно клетки 9–10 × 0–1 (без вылезания)', A.ruins === '10,0 10,1 9,0 9,1', A.ruins);
  ok('руин ровно 4 клетки, соседние клетки не руины', A.ruins.split(' ').length === 4 && A.bound, A.ruins);
  ok('сам выходной портал безопасен (зона «safe»)', A.portalKind === 'safe', A.portalKind);
  ok('в других вариантах руин нет', A.no_goblin && A.no_undead);
  ok('события 1–12 те же, находка в руинах вдвое чаще', A.sameMon && A.ruinsEv.find === 2 * A.base.find, JSON.stringify([A.base, A.ruinsEv]));
  ok('таблицы поиска руин подключены только в руинах', A.keys[0] === 'explore-ruins' && A.keys[1] === 'dig-ruins' && A.keys[2] === 'explore-special' && A.keysPlain.join() === 'explore,dig', JSON.stringify([A.keys, A.keysPlain]));
  ok('предметов в таблицах руин: 3 из 20 при исследовании (15 %) и 4 из 20 при раскопках (20 %) против 0', A.items[0] === 0 && A.items[2] === 0 && A.items[1] === 3 && A.items[3] === 4, JSON.stringify(A.items));
  ok('таблицы доходят до 20, награды выдаются', A.full && A.lines);
  ok('встречи в руинах генерируются', A.bad.length === 0, JSON.stringify(A.bad));
  ok('карта рисуется, у руин свои рисунки, окно поиска подписано', A.render && A.deco && A.overlay, JSON.stringify([A.render, A.deco, A.overlay]));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
