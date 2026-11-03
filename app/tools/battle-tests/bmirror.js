// Здание ведущего у игрока (03.11): листать и переключать вкладки можно, покупать — нельзя; обновление от ведущего не сбивает вкладку игрока.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, name: 'Г0', gold: 500 })]; state.townUnlocked = true;
    await loadTown(); Town.open('forge'); const snap = JSON.parse(JSON.stringify(Town.state())); Town.close();
    Town.mirror(snap); await new Promise(r => setTimeout(r, 50));
    const host = document.getElementById('townov'), out = {};
    const tabs = [...host.querySelectorAll('[data-t="ftab"]')]; out.tabs = tabs.length;
    const sc = host.querySelector('.tw-scroll, .tw-shopcol'); out.pe = sc ? getComputedStyle(sc).pointerEvents : null; out.ov = sc ? getComputedStyle(sc).overflowY : null;
    if (tabs[1]) { tabs[1].click(); out.tab = Town.state().tab; }
    Town.mirror(snap); out.tabAfter = Town.state().tab;
    const st = host.querySelector('[data-t="stock"]'); if (st) st.click(); const buy = host.querySelector('[data-t="buy"]'); out.buyBtn = !!buy; const g0 = goldOf(state.party[0]); if (buy) buy.click(); out.goldSame = goldOf(state.party[0]) === g0;
    return out;
  });
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  ok('окно здания у игрока не заблокировано для пальца и листается', r.pe !== 'none' && r.ov !== 'hidden', r);
  ok('игрок сам переключает вкладку, обновление от ведущего её не сбивает', r.tabs > 1 && r.tab && r.tab === r.tabAfter, r);
  ok('купить игрок не может', r.goldSame, r);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
