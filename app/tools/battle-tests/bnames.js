// Номер у одинаковых монстров появляется, только когда видно нескольких.
const L = require('./bui_lib.js');
(async () => { const { b, p } = await L.launch(400, 860, {}); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await L.setup(p, { heroes: ['barb2'], autoEnd: false });
 const o = await p.evaluate(() => { const B = Battle; B.newBattle({ list: ['goblin', 'goblin', 'goblin'], zone: 'goblin', floor: 1 }); const S = B.S, h = B.heroes()[0], [a, c, d] = B.mons(); S.cells = S.cells.map(r => r.map(() => '')); S.dark = false; S.phase = 'fight'; h.x = 3; h.y = 6; a.x = 3; a.y = 3; c.x = 0; c.y = 0; d.x = 6; d.y = 0;
  B.syncNames(); const one = a.name; const noOthers = c.name; c.x = 3; c.y = 4; B.syncNames(); const two = [a.name, c.name]; c.x = 0; c.y = 0; B.syncNames(); const stay = a.name; S.phase = 'result'; B.syncNames(); return { one, noOthers, two, stay, res: d.name }; });
 const R = [], ok = (n, c, x) => { R.push(!!c); if (!c) console.log('  ✗', n, JSON.stringify(x)); };
 ok('виден один: без номера', o.one === 'Гоблин', o);
 ok('виден двое: с номерами', /Гоблин 1/.test(o.two[0]) && /Гоблин 2/.test(o.two[1]), o.two);
 ok('номер не пропадает', /Гоблин 1/.test(o.stay), o.stay);
 ok('в итоге у всех номера', /Гоблин 3/.test(o.res), o.res); ok('ошибок нет', !errs.length, errs);
 console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length); await b.close(); process.exit(R.every(Boolean) ? 0 : 1); })().catch(e => { console.error(e.message); process.exit(2); });
