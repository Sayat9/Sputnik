// Пакет 31.10: монстры 2 этажа в библиотеке, нет кнопки «Инвентарь» в исследовании, передача части стопки, «Купить несколько» с ползунком.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true });
  const R = [], ok = (n, c, x) => { R.push(!!c); if (!c) console.log('  ✗', n, '—', x == null ? '' : JSON.stringify(x)); };
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  // библиотека: монстр 2 этажа, записанный в журнал, виден
  const A = await p.evaluate(() => {
    const m2 = MONSTERS.find(m => m.floor === 2 && !m.dyn); unlockJournal(9);
    const before = libMonsters().some(m => m.id === m2.id); seenKeys(m2.id, ['area']); const after = libMonsters().some(m => m.id === m2.id);
    return { id: m2.id, before, after };
  });
  ok('монстр 2 этажа попадает в библиотеку после записи', !A.before && A.after, A);
  // нет кнопки «Инвентарь» в меню исследования
  await p.evaluate(() => { location.hash = 'labyrinth'; rerender(); });
  await p.waitForTimeout(400);
  ok('в меню исследования нет кнопки «Инвентарь»', await p.evaluate(() => !document.querySelector('[data-dg="inv"]') && !!document.querySelector('[data-dg="sup"]')));
  // передача части стопки
  const T = await p.evaluate(() => {
    const [a, c] = state.party; a.bag = []; c.bag = []; addToBag(a, { t: 'g', id: 'torch', qty: 5 });
    openHero(a.id); heroUi.tab = 'inv'; renderHero(); heroUi.sel = 0; renderHero();
    document.querySelector('#heroov [data-hx="give-toggle"]').click();
    document.querySelector('#heroov [data-hx="give-n"][data-d="-1"]').click(); document.querySelector('#heroov [data-hx="give-n"][data-d="-1"]').click();
    const txt = document.querySelector('#heroov .sel-panel').textContent.replace(/\s+/g, ' ');
    document.querySelector('#heroov [data-hx="give"]').click();
    const r = { txt: /3 из 5/.test(txt), a: countGear(a, 'torch'), c: countGear(c, 'torch') }; closeHero(); return r;
  });
  ok('передать можно часть стопки: 3 из 5', T.txt && T.a === 2 && T.c === 3, T);
  // «Купить несколько»
  await p.evaluate(() => { state.run = null; state.townUnlocked = true; state.party[0].gold = 30; state.party[1].gold = 0; location.hash = 'town'; rerender(); });
  await p.click('[data-bld="shop"]'); await p.waitForSelector('.tw-shop', { timeout: 5000 });
  await p.click('[data-t="stock"][data-id="torch"]'); await p.click('[data-t="bm-open"]');
  const S = await p.evaluate(() => { const r = document.querySelector('.tw-bm-range'); return { max: r && +r.max, ok: !!r }; });
  await p.evaluate(() => { const r = document.querySelector('.tw-bm-range'); r.value = 7; r.dispatchEvent(new Event('input', { bubbles: true })); });
  const S2 = await p.evaluate(() => ({ n: document.querySelector('.tw-bm-n').textContent, cost: document.querySelector('.tw-bm-cost').textContent }));
  await p.click('[data-t="bm-buy"]');
  const G = await p.evaluate(() => ({ g: state.party[0].gold, torches: countGear(state.party[0], 'torch') }));
  ok('окно покупки с ползунком, максимум по деньгам (30 монет / 2 = 15)', S.ok && S.max === 15, S);
  ok('ползунок меняет количество и цену', S2.n === '7' && /14/.test(S2.cost), S2);
  ok('куплено 7 факелов за 14 монет', G.g === 16 && G.torches >= 7, G);
  ok('ошибок нет', errs.length === 0, errs);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
