// Доска: вкладки 8 и 7 класса по рангу; арена: монстры по рангу, без стражей и разломов (08.11).
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], tactical: true, level: 3 });
  const tabs = async rank => p.evaluate(async rk => { state.party.forEach(c => { c.rank = rk; }); state.run = null; state.townUnlocked = true; state.quests = null; postQuests(); location.hash = 'town'; rerender(); }, rank).then(async () => { const x = await p.$('[data-t="close"]'); if (x) await x.click().catch(() => {}); await p.click('[data-bld="board"]'); await p.waitForSelector('.tw-boardpanel'); return p.evaluate(() => [...document.querySelectorAll('.tw-qtabs [data-t="qtab"]')].map(x => x.innerText)); });
  ok('9 ранг: вкладок нет', (await tabs(9)).length === 0);
  ok('8 ранг: 9 и 8 класс', (await tabs(8)).join() === '9 класс,8 класс');
  const t7 = await tabs(7); ok('7 ранг: 9, 8, 7 класс', t7.join() === '9 класс,8 класс,7 класс', t7.join());
  await p.click('[data-t="qtab"][data-k="7"]'); await new Promise(r => setTimeout(r, 200));
  const s7 = await p.evaluate(() => [...document.querySelectorAll('.tw-sheetq:not(.news)')].map(x => x.innerText));
  ok('вкладка 7: задания на 7 класс', s7.length === 2 && s7.every(t => /7 класс/.test(t)), JSON.stringify(s7).slice(0, 200));
  const Q = await p.evaluate(() => { const c = {}; for (let i = 0; i < 200; i++) { state.quests = null; postQuests(); for (const q of questBoard().list) { const m = MONSTERS.find(x => x.id === q.mon); c.bad = (c.bad || 0) + (m.cls !== q.cls || m.rift || m.rank !== 'normal' ? 1 : 0); c[q.cls] = (c[q.cls] || 0) + 1; } } return c; });
  ok('задания: класс совпадает, без стражей и разломов', !Q.bad && Q[8] && Q[7], JSON.stringify(Q));
  const A = {};
  for (const r of [8, 7]) { const ids = new Set();
    for (let i = 0; i < 12; i++) { await p.evaluate(rk => { state.party.forEach(c => { c.rank = rk; }); state.arena = null; state.arenaLock = false; }, r); const x = await p.$('[data-t="close"]'); if (x) await x.click().catch(() => {}); await p.click('[data-bld="arena"]'); await p.waitForSelector('.tw-bout'); for (const id of await p.evaluate(() => state.arena.bouts.flatMap(b => [b.a, b.b]))) ids.add(id); }
    A[r] = await p.evaluate(list => { const ms = list.map(id => MONSTERS.find(m => m.id === id)); return { cls: [...new Set(ms.map(m => m.cls))].sort().join(), bad: ms.filter(m => m.rift || m.rank !== 'normal').map(m => m.id) }; }, [...ids]); }
  ok('арена 8 ранг: 8 и 9 класс', A[8].cls === '8,9' && !A[8].bad.length, JSON.stringify(A[8]));
  ok('арена 7 ранг: 7 и 8 класс', A[7].cls === '7,8' && !A[7].bad.length, JSON.stringify(A[7]));
  ok('нет ошибок страницы', !L.errors || !L.errors.length);
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`); await b.close();
})();
