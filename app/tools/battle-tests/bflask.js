// 10.11: колбы эссенций (выбор, отмена, подтверждение, бросок 14+, рюкзак, разбить, продажа), надбавки к цене эссенции, страж +5 опыта, удача новичка 1000, скрытие по рангу.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const P = await p.evaluate(() => { const ids = Object.keys(ESSENCES); const pick = f => ids.find(id => { const m = MONSTERS.find(x => x.id === essSource(id)); return m && f(m, ESSENCES[id]); });
    const norm = pick((m, e) => e.cls === 9 && rankOf(m) === 'normal' && !m.rift), rare = pick((m, e) => e.cls === 9 && rankOf(m) === 'rare' && !m.rift), rift = pick((m, e) => e.cls === 9 && rankOf(m) === 'normal' && m.rift), guard = pick((m, e) => e.cls === 7 && rankOf(m) === 'guardian' && m.rift);
    return { norm: essPrice(norm), rare: rare && essPrice(rare), rift: rift && essPrice(rift), guard: guard && essPrice(guard), luck: artValue('beginners-luck'), fp: essFlaskPrice(norm, false), fps: essFlaskPrice(norm, true) }; });
  ok('цена эссенции: обычная 9 — 50, редкая 55, разлом 60, страж разлома 7 — 1500', P.norm === 50 && P.rare === 55 && P.rift === 60 && P.guard === 1500, P);
  ok('эссенция в колбе: Башня 40, магазин 32', P.fp === 40 && P.fps === 32, P);
  ok('«Удача новичка» — 1000', P.luck === 1000, P);
  // экран итога: сохранить в колбу
  const fight = async (rolls) => { await p.evaluate(({ rolls }) => { state.run.floor = 1; state.party.forEach(c => { c.essences = []; c.bag = (c.bag || []).filter(e => !/flask/.test(e.id)); });
      addToBag(state.party[0], { t: 'g', id: 'flask-low', qty: 2 });
      const orig = window.__origRnd || Battle.rnd; window.__origRnd = orig; let i = 0, j = 0; Battle.rnd = n => (n === 100 ? 98 : n === 20 ? rolls[Math.min(j++, rolls.length - 1)] : orig(n)); }, { rolls });
    await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' }); await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
    await p.evaluate(() => { const B = Battle; B.S.outcome = 'win'; B.S.killed.push(0); B.mons().forEach(m => { m.alive = false; m.hp = 0; }); B.UI.endTurn && B.UI.endTurn(); });
    for (let i = 0; i < 60; i++) { if (await p.evaluate(() => !!document.querySelector('[data-ec="keep"]'))) break; await F.handleModal(p, 'yes'); await L.sleep(250); } };
  await fight([10]);
  const K = await p.evaluate(async () => { const kb = document.querySelector('[data-ec="keep"]'); const o = { enabled: kb && !kb.disabled }; kb.click(); await new Promise(r => setTimeout(r, 100));
    o.opts = [...document.querySelectorAll('[data-ef]')].map(x => x.dataset.ef); o.cancel = !!document.querySelector('.bt-esspick [data-eb]');
    document.querySelector('.bt-esspick [data-eb]').click(); o.back = !document.querySelector('.bt-esschoice').hidden;
    document.querySelector('[data-ec="keep"]').click(); await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-ef="flask-low"]').click(); await new Promise(r => setTimeout(r, 300));
    const yn = document.querySelector('[data-yn]'); o.ask = yn ? document.body.innerText.includes('Вы собираетесь использовать') : false; return o; });
  ok('«Сохранить» активна, список колб и «Отмена»', K.enabled && K.opts.includes('flask-low') && K.cancel && K.back, K);
  ok('подтверждение «Вы собираетесь использовать…»', K.ask, K);
  await p.evaluate(() => { const y = [...document.querySelectorAll('[data-yn]')].find(x => x.dataset.yn === '1'); y && y.click(); }); await L.sleep(400);
  const G = await p.evaluate(() => { const c = state.party.find(x => (x.bag || []).some(e => e.id === 'ess-flask')); const e = c && c.bag.find(x => x.id === 'ess-flask'); return { got: !!e, name: e && itemOf(e, c).name, from: e && e.from, left: state.party.reduce((a, c) => a + countGear(c, 'flask-low'), 0), w: e && itemOf(e, c).weight }; });
  ok('эссенция 9 класса в колбе (без броска), колба потрачена, подпись монстра', G.got && /Колба/.test(G.name) && G.from && G.left === 1 && G.w <= 0.1, G);
  await p.evaluate(() => { const d = document.querySelector('.bt-done'); if (d) d.click(); }); await L.sleep(600);
  // разбить и впитать
  const BR = await p.evaluate(async () => { const c = state.party.find(x => (x.bag || []).some(e => e.id === 'ess-flask')); const i = c.bag.findIndex(e => e.id === 'ess-flask'); const id = c.bag[i].ess; c.level = Math.max(1, c.level || 1); c.essences = [];
    openHero(c.id); heroUi.tab = 'inv'; heroUi.sel = i; renderHero && renderHero(); const btn = document.querySelector('[data-hx="essflask"]'); if (!btn) return { btn: false }; btn.click(); await new Promise(r => setTimeout(r, 200));
    const y = [...document.querySelectorAll('[data-yn]')].find(x => x.dataset.yn === '1'); y && y.click(); await new Promise(r => setTimeout(r, 200));
    return { btn: true, absorbed: (c.essences || []).includes(id), gone: !(c.bag || []).some(e => e.id === 'ess-flask') }; });
  ok('«Разбить и впитать» — эссенция у героя, колбы нет', BR.btn && BR.absorbed && BR.gone, BR);
  await p.evaluate(() => { const x = document.querySelector('[data-hx="close"], #heroov .hero-x'); x && x.click(); });
  // Башня: колбы по рангу; Академия: курсы скрыты
  const T = await p.evaluate(async () => { state.run = null; await loadTown(); state.party.forEach(c => c.rank = 9); Town.open('tower'); Town.state().tab = 'flask'; Town.refresh();
    const r9 = [...document.querySelectorAll('[data-t="flask-buy"]')].map(x => x.dataset.id); state.party.forEach(c => c.rank = 7); Town.refresh(); const r7 = [...document.querySelectorAll('[data-t="flask-buy"]')].map(x => x.dataset.id); Town.close();
    state.party.forEach(c => c.rank = 9); Town.open('academy'); Town.state().tab = 'nav'; Town.refresh(); const nav9 = [...document.querySelectorAll('[data-t="learn"]')].map(x => x.dataset.id); Town.close();
    Town.open('forge'); const steel9 = !!document.querySelector('[data-k="steel"]'); Town.close(); state.party.forEach(c => c.rank = 8);
    return { r9, r7, nav9, steel9 }; });
  ok('Башня: на 9 ранге только низкокачественная, на 7 — ещё слабая', T.r9.join() === 'flask-low' && T.r7.join() === 'flask-low,flask-weak', T);
  ok('9 ранг: навигатор 2/3 этажа и «Улучшенное» в кузнице скрыты', T.nav9.join() === 'nav1' && !T.steel9, T);
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
