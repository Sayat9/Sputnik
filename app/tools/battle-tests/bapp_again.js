// «Ещё раз» (9 класс, одноразовый): после неудачного броска на эссенцию позволяет перебросить; без предмета кнопки нет; можно отказаться.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const runFight = async (rolls, opts = {}) => {
    await p.evaluate(({ rolls, give }) => {
      state.run.floor = 1; state.party.forEach(c => { c.essences = []; c.bag = (c.bag || []).filter(e => e.id !== 'once-more'); });
      if (give) addToBag(state.party[0], { t: 'g', id: 'once-more', qty: give });
      const orig = Battle.rnd || (n => Math.floor(Math.random() * n)); if (!window.__origRnd) window.__origRnd = orig;
      let i = 0; Battle.rnd = n => (n === 100 ? rolls[Math.min(i++, rolls.length - 1)] : window.__origRnd(n));
    }, { rolls, give: opts.give || 0 });
    await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' });
    await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
    await p.evaluate(() => { const B = Battle; B.S.outcome = 'win'; B.S.killed.push(0); B.mons().forEach(m => { m.alive = false; m.hp = 0; }); });
    await p.evaluate(() => { Battle.UI.endTurn && Battle.UI.endTurn(); });
  };
  const waitRes = async () => { for (let i = 0; i < 80; i++) { if (await p.evaluate(() => !!document.querySelector('.bt-roll-res.ok, .bt-roll-res.no'))) return; await F.handleModal(p, 'yes'); await L.sleep(250); } };
  // 1) провал, предмета нет — кнопки нет
  await runFight([0]); await waitRes();
  ok('без предмета после неудачи кнопки «Ещё раз» нет', await p.evaluate(() => /не выпала/.test(document.querySelector('.bt-roll-res').innerText) && ![...document.querySelectorAll('.bt-roll button')].some(b => /Ещё раз/.test(b.textContent))));
  await p.evaluate(() => { const d = document.querySelector('.bt-done'); if (d) d.click(); }); await L.sleep(700);
  // 2) провал, предмет есть, перебрасываем — успех
  await p.evaluate(() => { state.journal && null; });
  await runFight([0, 98], { give: 2 }); await waitRes();
  ok('после неудачи с предметом есть кнопка «Ещё раз · осталось 2»', await p.evaluate(() => [...document.querySelectorAll('.bt-roll button')].some(b => /Ещё раз.*осталось 2/.test(b.textContent))));
  await p.evaluate(() => [...document.querySelectorAll('.bt-roll button')].find(b => /Ещё раз/.test(b.textContent)).click());
  let seen = false; for (let i = 0; i < 40 && !seen; i++) { seen = await p.evaluate(() => !!document.querySelector('[data-ec="absorb"]')); if (!seen) await L.sleep(200); }
  ok('перебросок удался: выпала эссенция, предмет потрачен (остался 1)', seen && await p.evaluate(() => state.party.reduce((a, c) => a + countGear(c, 'once-more'), 0) === 1));
  await p.evaluate(() => document.querySelector('[data-ec="leave"]').click()); await L.sleep(200);
  await p.evaluate(() => { const d = document.querySelector('.bt-done'); if (d) d.click(); }); await L.sleep(700);
  // 3) провал, предмет есть, но игрок отказывается («Готово»)
  await runFight([0], { give: 1 }); await waitRes();
  await p.evaluate(() => document.querySelector('.bt-done').click()); await L.sleep(700);
  ok('отказ от переброса не тратит предмет', await p.evaluate(() => state.party.reduce((a, c) => a + countGear(c, 'once-more'), 0) === 1 && !state.party.some(c => (c.essences || []).length) && !(inventory().essStash || []).length));
  // 4) провал → ещё провал → предмета больше нет
  await runFight([0, 1, 2], { give: 1 }); await waitRes();
  await p.evaluate(() => [...document.querySelectorAll('.bt-roll button')].find(b => /Ещё раз/.test(b.textContent)).click()); await L.sleep(800);
  ok('второй провал: предмет потрачен, кнопки больше нет', await p.evaluate(() => state.party.reduce((a, c) => a + countGear(c, 'once-more'), 0) === 0 && ![...document.querySelectorAll('.bt-roll button')].some(b => /Ещё раз/.test(b.textContent)) && /не выпала/.test(document.querySelector('.bt-roll-res').innerText)));
  await p.evaluate(() => { const d = document.querySelector('.bt-done'); if (d) d.click(); }); await L.sleep(500);
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
