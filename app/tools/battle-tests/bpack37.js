// v107 (03.11): что открывает ранг отряда — библиотека, кузница, магазин, башня магов, арена, карты этажей в Академии.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 400, height: 760 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const R = await p.evaluate(async () => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, gold: 5000, rank: 9, essences: ['goblin', 'hobgoblin'] })]; state.townUnlocked = true; journal().tiers = [9, 8, 7]; saveChar();
    await loadTown(); const c = state.party[0];
    const price = (b, key) => { Town.open(b); const el = document.querySelector(`[data-t="stock"][data-id="${key}"]`); const v = el ? +el.getAttribute('aria-label').match(/(\d+) монет$/)[1] : null; Town.close(); return v; };
    const steelTab = () => { Town.open('forge'); const t = document.querySelector('[data-t="ftab"][data-k="steel"]'); const d = t.disabled; t.click(); const el = document.querySelector('[data-t="stock"][data-id="sw:sword"]'); const v = el ? +el.getAttribute('aria-label').match(/(\d+) монет$/)[1] : null; Town.close(); return { d, v }; };
    const lib = () => { Town.open('library'); const pick = (sel) => { const el = document.querySelector(sel); el && el.click(); }; pick('[data-t="lr-cat"]'); pick('[data-t="lr-hero"]'); const rows = [...document.querySelectorAll('.tw-row')].map(r => r.textContent.replace(/\s+/g, ' ').replace(/класс(?=Сл)/, 'класс ')); const btn8 = document.querySelector('[data-t="lr-cls"][data-n="8"]'); const o = { rows, b8: btn8 && !btn8.disabled }; Town.close(); return o; };
    const tower = () => { Town.open('tower'); const btns = [...document.querySelectorAll('.tw-row button')].map(x => x.textContent.trim() + (x.disabled ? '!' : '')); Town.close(); return btns; };
    const arena = () => { Town.open('arena'); const t = /8 ранга/.test(document.querySelector('#townov').textContent); Town.close(); return t; };
    const maps = () => { Town.open('academy'); document.querySelector('[data-t="atab"][data-k="maps"]').click(); const b = [...document.querySelectorAll('[data-t="buymap"]')].map(x => x.dataset.k + '=' + x.textContent.trim() + (x.disabled ? '!' : '')); Town.close(); return b; };
    const out = {};
    for (const rk of [9, 8, 7]) {
      c.rank = rk;
      out[rk] = { firstaid: price('shop', 'firstaid'), potion: price('shop', 'potion'), good: price('shop', 'potion-good'), compass: price('shop', 'compass'), sword: price('forge', 'w:sword'), steel: steelTab(), lib: lib(), tower: tower(), arenaLocked: arena(), maps: maps() };
    }
    c.rank = 9; c.bag = [{ t: 'g', id: 'potion', qty: 2 }]; const g0 = c.gold; Town.open('shop'); document.querySelector('[data-t="bag"][data-i="0"]').click(); document.querySelector('[data-t="sellall"]').click(); Town.close(); out.sell = c.gold - g0;
    c.rank = 8; const g1 = c.gold; Town.open('academy'); document.querySelector('[data-t="atab"][data-k="maps"]').click(); document.querySelector('[data-t="buymap"][data-k="2:goblin"]').click(); Town.close(); out.bought = !!inventory().maps['2:goblin']?.owned; out.paid = g1 - c.gold;
    return out;
  });
  const r9 = R[9], r8 = R[8], r7 = R[7];
  ok('магазин: 9 ранг +10 %, с 8-го обычные цены', r9.firstaid === 22 && r8.firstaid === 20 && r7.firstaid === 20, [r9.firstaid, r8.firstaid]);
  ok('хорошее зелье и компас — с 8 ранга, на 7-м −10 %', r9.good === null && r9.compass === null && r8.good === 12 && r7.good === 11, [r9.good, r8.good, r7.good, r8.compass, r7.compass]);
  ok('кузница: обычное оружие 11 → 10; стальное закрыто на 9, 25 на 8, 23 на 7', r9.sword === 11 && r8.sword === 10 && r9.steel.d && r8.steel.v === 25 && r7.steel.v === 23, [r9.sword, r8.sword, r9.steel, r8.steel, r7.steel]);
  ok('продажа лавочнику не дороже/дешевле от ранга (2 зелья = 6)', R.sell === 6, R.sell);
  ok('библиотека: 9 ранг — Сл 12 и 8 класс закрыт; 8 ранг — Сл 10/14; 7 ранг — Сл 8 класса 12, 7 класс 18', /9 класс Сл 12/.test(r9.lib.rows.join()) && !r9.lib.b8 && /9 класс Сл 10/.test(r8.lib.rows.join()) && /8 класс Сл 14/.test(r8.lib.rows.join()) && /8 класс Сл 12/.test(r7.lib.rows.join()) && /7 класс Сл 18/.test(r7.lib.rows.join()), [r9.lib.rows, r8.lib.rows, r7.lib.rows]);
  ok('башня: эссенция 8 класса закрыта на 9 ранге, открыта на 8-м', r9.tower.some(t => /8 ранг!/.test(t)) && !r8.tower.some(t => /ранг!/.test(t)), [r9.tower, r8.tower]);
  ok('арена закрыта до 8 ранга', r9.arenaLocked && !r8.arenaLocked, [r9.arenaLocked, r8.arenaLocked]);
  ok('карты: 1 этаж 50 на 9-м, 45 на 8-м; 2 этаж — с 8 ранга 200, на 7-м 180; 3 этаж 700 с 7-го', r9.maps.includes('1=50') && r9.maps.some(x => /^2:goblin=8 ранг!/.test(x)) && r8.maps.includes('1=45') && r8.maps.includes('2:goblin=200') && r7.maps.includes('2:goblin=180') && r7.maps.includes('3=700'), [r9.maps, r8.maps, r7.maps]);
  ok('покупка карты части 2 этажа', R.bought && R.paid === 200, R);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
