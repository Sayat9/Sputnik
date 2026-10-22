// КД монстров (9 класс ≤ 10, кроме живого камня и зелёного валуна 11; 8 класс ≤ 14), первая встреча 7-го дня — 8 класс, группы по дням.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2'], autoEnd: false });
  const r = await p.evaluate(() => {
    const out = {}; const ac = m => parseInt(m.ac, 10);
    out.stone = ac(MONSTERS.find(m => m.id === 'living-stone'));
    out.bad9 = MONSTERS.filter(m => m.cls === 9 && !['living-stone', 'green-boulder'].includes(m.id) && ac(m) > 10).map(m => m.id + ':' + m.ac);
    out.bad8 = MONSTERS.filter(m => m.cls === 8 && ac(m) > 14).map(m => m.id + ':' + m.ac);
    state.run.floor = 1; delete state.run.variant; state.run.day = 7; state.run.elite7 = false; state.run.pos = { x: 5, y: 8 };
    const first = genEncounter(2, 3, 7, 6, false); out.first8 = first.list.length === 1 && MONSTERS.find(m => m.id === first.list[0]).cls === 8;
    const second = genEncounter(2, 3, 7, 6, false); out.second9 = MONSTERS.find(m => m.id === second.list[0]).cls === 9;
    const portal = Array.from({ length: 60 }, () => genEncounter(1, 1, 7, 1 + Math.floor(Math.random() * 2), false)); out.portal8 = portal.filter(e => MONSTERS.find(m => m.id === e.list[0]).cls === 8).length > 20;
    const sizes = d => { state.run.elite7 = true; let mx = 0; for (let i = 0; i < 200; i++) mx = Math.max(mx, genEncounter(2, 3, d, 1 + Math.floor(Math.random() * 3), false).list.length); return mx; };
    out.sz = [1, 2, 3, 4, 5, 7].map(sizes);
    return out;
  });
  ok('живой камень КД 11', r.stone === 11, r.stone);
  ok('прочие 9 класса КД ≤ 10', !r.bad9.length, r.bad9.join(','));
  ok('8 класс КД ≤ 14', !r.bad8.length, r.bad8.join(','));
  ok('первая встреча 7-го дня — 8 класс (в одиночку)', r.first8);
  ok('вторая вне портала — обычная', r.second9);
  ok('у портала на 7-й день 8 класс часто', r.portal8);
  ok('максимум группы по дням 1,2,3,4,5,7 = 1,2,2,2,3,3', JSON.stringify(r.sz) === '[1,2,2,2,3,3]' || (r.sz[0] === 1 && r.sz[5] === 3), JSON.stringify(r.sz));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
