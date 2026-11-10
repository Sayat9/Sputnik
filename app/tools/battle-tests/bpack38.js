// v108 (03.11): тайм-менеджмент в Академии (I–IV), ранги курсов, курс монстров 8 класса закрыт на 9 ранге.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 400, height: 760 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const R = await p.evaluate(async () => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, gold: 9000, rank: 9 }), Object.assign(clone(state.example), { id: 'p1', example: false, gold: 0, rank: 9 })]; state.townUnlocked = true; saveChar();
    await loadTown(); const c = state.party[0], o = {};
    const learnBtn = id => { Town.open('academy'); const grp = ACADEMY.find(k => k.id === id).grp; document.querySelector(`[data-t="atab"][data-k="${grp}"]`).click(); const btn = document.querySelector(`[data-t="learn"][data-id="${id}"]`); const r = { dis: btn ? btn.disabled : null, txt: btn ? btn.textContent : null }; if (btn && !btn.disabled) btn.click(); Town.close(); return r; };
    o.mon8r9 = learnBtn('mon8'); o.wait0 = townGateWait();
    o.tm1 = learnBtn('tm1'); o.wait1 = townGateWait(); o.tm2r9 = learnBtn('tm2');
    c.rank = 8; o.tm2 = learnBtn('tm2'); o.wait2 = townGateWait();
    // ворота: после выхода 7 закрытых действий
    const tc = townClock(); tc.back = true; tc.t0 = tc.t; tc.t += 6; o.gate6 = gateInfo(); tc.t += 1; o.gate7 = gateInfo();
    // III: магазин и доска бесплатно
    c.rank = 7; o.tm3 = learnBtn('tm3'); const t0 = townClock().t; Town.open('shop'); document.querySelector('[data-t="stock"][data-id="torch"]').click(); document.querySelector('[data-t="buy"][data-n="1"]').click(); Town.close(); o.shopCost = townClock().t - t0;
    c.rank = 6; o.tm4 = learnBtn('tm4');
    o.lvlOther = (() => { const k = state.party[1]; return eduKnows(k, 'tm1'); })(); o.level = tmLevel();
    return o;
  });
  ok('курс монстров 8 класса скрыт на 9 ранге', !R.mon8r9.txt, R.mon8r9);
  ok('без курса до врат 5 действий; I — 6; II — 7', R.wait0 === 5 && R.wait1 === 6 && R.wait2 === 7, [R.wait0, R.wait1, R.wait2]);
  ok('II скрыт на 9 ранге, открыт на 8', !R.tm2r9.txt && !R.tm2.dis, [R.tm2r9, R.tm2]);
  ok('с II врата закрыты 7 действий, потом открыты', !R.gate6.open && R.gate7.open, [R.gate6, R.gate7]);
  ok('III: покупка в магазине не тратит городское действие', R.shopCost === 0, R.shopCost);
  ok('IV пока закрыт особым условием', R.tm4.dis, R.tm4);
  ok('действует, если курс знает кто-то в отряде (у второго героя курса нет, уровень отряда 3)', !R.lvlOther && R.level === 3, R);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
