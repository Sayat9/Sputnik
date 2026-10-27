// Академия в городе: список курсов, покупка, закрепление за героем; создание героя с новыми расами; кузница с новым оружием.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true });
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], tactical: false });
  await p.evaluate(() => { state.run = null; state.townUnlocked = true; state.party.forEach(c => { c.gold = 2000; }); location.hash = 'town'; rerender(); });
  await p.waitForTimeout(300);
  await p.click('[data-bld="academy"]'); await p.waitForSelector('.tw-rows');
  let total = 0; for (const k of ['gather', 'monsters', 'medicine', 'nav', 'repair']) { await p.click(`[data-t="atab"][data-k="${k}"]`); total += await p.evaluate(() => document.querySelectorAll('.tw-row').length); }
  ok('академия: 5 вкладок знаний, 11 курсов', total === 11, total);
  await p.click('[data-t="atab"][data-k="nav"]');
  await L.shot(p, 'academy');
  const nav2 = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-t="learn"]')].find(x => x.dataset.id === 'nav2'); return b && b.disabled; });
  ok('навигатор 2 этажа закрыт без 1-го', nav2 === true);
  await p.click('[data-t="learn"][data-id="nav1"]');
  ok('навигатор 1 куплен', await p.evaluate(() => eduKnows(state.party[0], 'nav1') && !eduKnows(state.party[1], 'nav1')));
  ok('деньги списаны', await p.evaluate(() => goldOf(state.party[0]) + goldOf(state.party[1]) === 4000 - 400), await p.evaluate(() => goldOf(state.party[0]) + goldOf(state.party[1])));
  ok('навигатор 2 открылся', await p.evaluate(() => { const b = document.querySelector('[data-t="learn"][data-id="nav2"]'); return b && !b.disabled; }));
  await p.click('[data-t="atab"][data-k="gather"]'); await p.click('[data-t="learn"][data-id="herb"]');
  ok('курс трав у героя', await p.evaluate(() => findKnown(state.party[0], 'herb-heal') && !findKnown(state.party[1], 'herb-heal')));
  await p.click('[data-t="hero"]:nth-child(2)'); 
  ok('у второго героя курсов нет', await p.evaluate(() => document.querySelectorAll('.tw-row .tw-done').length) === 0);
  await L.shot(p, 'academy2');
  await p.click('[data-t="close"]');
  // расы в создании героя
  await p.evaluate(() => { forge.draft = newDraft(); });
  const names = await p.evaluate(() => RACES.map(r => r.name));
  ok('8 рас', names.length === 8, names);
  await p.evaluate(() => { const c = state.party[0]; c.race = 'gnome'; c.insp = undefined; saveChar && saveChar(); });
  ok('гном: переброс 2 в данных героя', await p.evaluate(() => inspMax(state.party[0]) === 2));
  console.log('проверок:', R.length, 'не прошли:', R.filter(r => !r.ok).length);
  await b.close();
})();
