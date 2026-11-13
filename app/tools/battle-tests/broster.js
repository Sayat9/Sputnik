// Запас героев на аккаунте (09.11): таверна → «Отряд и запас», бесплатно; герой уходит в запас и возвращается; запас живёт отдельно от партии.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], tactical: true, level: 3 });
  await p.evaluate(() => { localStorage.removeItem('sputnik.account.v1'); state.run = null; state.townUnlocked = true; state.party.forEach(c => { c.rank = 8; }); location.hash = 'town'; rerender(); });
  const t0 = await p.evaluate(() => townClock().t);
  await p.click('[data-bld="tavern"]'); await p.waitForSelector('.tw-tabs');
  await p.click('[data-t="ttab"][data-k="roster"]'); await p.waitForSelector('[data-t="rost-out"]');
  const n0 = await p.evaluate(() => document.querySelectorAll('[data-t="rost-out"]').length);
  ok('вкладка «Отряд и запас»: у каждого героя ведущего «В запас»', n0 === 2, n0);
  const id = await p.evaluate(() => state.party[1].id);
  await p.click(`[data-t="rost-out"][data-id="${id}"]`); await p.click('#rost-ask [data-ra="keep"]'); await p.waitForTimeout(200);
  const a = await p.evaluate(id => ({ party: state.party.length, res: JSON.parse(localStorage.getItem('sputnik.account.v1')).heroes.map(h => h.id), btnIn: !!document.querySelector(`[data-t="rost-in"][data-id="${id}"]`) }), id);
  ok('герой ушёл в запас (хранится на аккаунте)', a.party === 1 && a.res.includes(id) && a.btnIn, a);
  const last = await p.evaluate(() => state.party[0].id); await p.click(`[data-t="rost-out"][data-id="${last}"]`); await p.click('#rost-ask [data-ra="keep"]'); await p.waitForTimeout(200);
  ok('последнего героя убрать нельзя', await p.evaluate(() => state.party.length === 1 && /хотя бы один/.test(document.querySelector('.tw-msg') ? document.querySelector('.tw-msg').innerText : document.body.innerText)));
  // новая партия — запас остаётся
  const keep = await p.evaluate(() => { const before = reserveHeroes().length; const saved = JSON.stringify(state.party); state.party = []; const after = reserveHeroes().length; state.party = JSON.parse(saved); return before === 1 && after === 1; });
  ok('запас не зависит от партии', keep);
  await p.click(`[data-t="rost-in"][data-id="${id}"]`); await p.waitForTimeout(200);
  const c = await p.evaluate(id => ({ party: state.party.map(x => x.id).includes(id), res: reserveHeroes().length }), id);
  ok('герой вернулся из запаса в отряд', c.party && c.res === 0, c);
  await p.click('[data-t="close"]'); await p.waitForTimeout(200);
  ok('пересборка отряда бесплатна (городское действие не тратится)', await p.evaluate(t0 => townClock().t === t0, t0));
  ok('в заходе пересобрать нельзя', await p.evaluate(() => { state.run = { floor: 1 }; const w = heroToReserve(state.party[0].id); state.run = null; return /только в городе/.test(w); }));
  ok('нет ошибок страницы', !L.errors || !L.errors.length);
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`); await b.close();
})();
