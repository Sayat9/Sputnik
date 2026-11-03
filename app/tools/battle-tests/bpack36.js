// v106 (03.11): прокрутка магазина при выборе, копание само бросает к20 (экран раскопок), ранги героев (значки, перенос, повышение в Академии).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 400, height: 760 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  // --- магазин: прокрутка ---
  const S = await p.evaluate(async () => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, gold: 500 })]; state.townUnlocked = true; saveChar();
    await loadTown(); Town.open('forge');
    const els = [...document.querySelectorAll('#townov *')].filter(e => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible');
    const sc = els.find(e => e.querySelector('[data-t="stock"]')) || els[0]; if (!sc) return { none: true };
    sc.scrollTop = 9999; const y = sc.scrollTop; const btns = [...sc.querySelectorAll('[data-t="stock"]')]; btns[btns.length - 1].click();
    const els2 = [...document.querySelectorAll('#townov *')].filter(e => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible');
    const sc2 = els2.find(e => e.className === sc.className); const y2 = sc2 ? sc2.scrollTop : -1; Town.close(); return { y, y2, cls: sc.className };
  });
  ok('магазин: выбор предмета не сбрасывает прокрутку', !S.none && S.y > 0 && Math.abs(S.y2 - S.y) < 2, S);
  // --- копание ---
  const D = await p.evaluate(async () => {
    newRun(); location.hash = 'labyrinth'; const c = state.party[0]; addToBag(c, { t: 'g', id: 'shovel', qty: 1 }); const u0 = pickShovel().e.uses;
    window.__digFast = true; dgUi.phase = 'dig'; dgUi.sr = { pick: null, luck: null }; rerender();
    const scr = { pic: !!document.querySelector('.dig-ov .ev-pic'), go: !!document.querySelector('[data-dg="dig-go"]'), grid: !!document.querySelector('.dig-ov .roll-grid') };
    document.querySelector('[data-dg="dig-go"]').click(); await new Promise(r => setTimeout(r, 200));
    const sh = pickShovel(); return { scr, res: dgUi.res && { t: dgUi.res.title, pic: dgUi.res.pic, n: dgUi.res.lines.length }, phase: dgUi.phase, uses: sh ? sh.e.uses : 0, u0, resPic: !!document.querySelector('.res-pic .ev-pic') };
  });
  ok('копать: экран раскопок с картинкой и кнопкой, без сетки чисел', D.scr.pic && D.scr.go && !D.scr.grid, D);
  ok('копать: кубик брошен сам, награда выдана, лопата потрачена', D.res && /Раскопки/.test(D.res.t) && D.res.n > 0 && D.uses === D.u0 - 1, D);
  ok('итог раскопок с картинкой', D.res && D.res.pic === 'dig' && D.resPic, D);
  // --- ранги ---
  const K = await p.evaluate(async () => {
    dgUi.res = null; dgUi.phase = 'menu'; const c = state.party[0]; delete c.rank; delete c.rankMig; delete c.deep; delete c.slainCls;
    const r0 = heroRank(c); journal().seenFloor2 = true; seenKeys('hobgoblin', []); journal().known.hobgoblin.xpDone = 'x';
    rankMigrate(); const r1 = heroRank(c);
    openHero('p0'); const chip = !!document.querySelector('#heroov .rank-chip svg');
    const ready7a = rankReady(c, 7); state.run.floor = 3; rankTrack(['ember-reaper']); const ready7b = rankReady(c, 7);
    await loadTown(); Town.open('academy'); document.querySelector('[data-t="atab"][data-k="rank"]').click();
    const btn = document.querySelector('[data-t="rankup"]'); const en = btn && !btn.disabled; btn && btn.click(); const r2 = heroRank(c); Town.close();
    return { r0, r1, chip, ready7a, ready7b, en, r2, party: partyRank(), b9: rankBadge(9).includes('<svg'), b8: rankBadge(8) !== rankBadge(9) };
  });
  ok('по умолчанию 9 ранг', K.r0 === 9, K);
  ok('кто был на 2 этаже и убил 8 класс — сразу 8 ранг', K.r1 === 8, K);
  ok('значок ранга в окне героя, значки 9 и 8 разные', K.chip && K.b9 && K.b8, K);
  ok('7 ранг: только после 3 этажа и монстра 7 класса', !K.ready7a && K.ready7b, K);
  ok('Академия → Ранг → «Повысить» даёт 7 ранг; ранг отряда 7', K.en && K.r2 === 7 && K.party === 7, K);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
