// Пакет 33: неизвестные камни → камни случайных монстров того же класса с этажа; последнее действие показывает результат; заставки «в лабиринт» / «в город».
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], tactical: false });
  const a = await p.evaluate(() => {
    const o = {}; state.sack = { items: {}, mig: true, mig2: true }; const r = state.run; r.floor = 1;
    const line = giveParty({ t: 'g', id: 'stone-9', qty: 5 });
    const rows = Object.values(state.sack.items); o.allMon = rows.every(it => it.mon) && rows.reduce((s, it) => s + it.qty, 0) === 5;
    o.floor1 = rows.every(it => { const m = MONSTERS.find(x => x.id === it.mon); return m && m.cls === 9 && m.floor === 1; });
    o.line = /Камни 9-го класса × 5 \(/.test(line); o.lineText = line;
    state.sack = { items: {}, mig: true, mig2: true }; r.floor = 2; r.variant = 'beast';
    addToBag(state.party[0], { t: 'g', id: 'stone-8', qty: 2 });
    const r2 = Object.values(state.sack.items); o.f2 = r2.reduce((s, it) => s + it.qty, 0) === 2 && r2.every(it => { const m = MONSTERS.find(x => x.id === it.mon); return m && m.cls === 8 && m.floor === 2; });
    // старые «Находки» в сохранении раздаются по монстрам
    state.sack = { items: { 'c:9': { mon: null, cls: 9, qty: 4 } }, mig: true }; sack();
    const r3 = Object.values(state.sack.items); o.mig = r3.every(it => it.mon) && r3.reduce((s, it) => s + it.qty, 0) === 4;
    return o; });
  ok('находка: 5 камней 9 класса → камни монстров 9 класса 1 этажа', a.allMon && a.floor1, JSON.stringify(a));
  ok('в журнале видно, чьи камни', a.line, a.lineText);
  ok('2 этаж: камни 8 класса → монстры 8 класса 2 этажа', a.f2);
  ok('старые «Находки» в сумке раздаются по монстрам', a.mig);
  // последнее действие: результат виден, потом заставка «в город»
  await p.evaluate(() => { const r = state.run; r.floor = 1; r.day = FL().days; r.act = FL().acts; location.hash = 'labyrinth'; dgUi = freshUi(); rerender(); });
  await L.sleep(200);
  await p.evaluate(() => { dgUi.res = { title: 'Исследование', roll: 'к20', lines: ['нашли что-то'] }; advanceTime(); });
  await L.sleep(150);
  const s1 = await p.evaluate(() => ({ run: !!state.run, res: !!document.querySelector('[data-dg="res-done"]'), travel: !!document.querySelector('[data-dg="travel-out"]'), hash: location.hash }));
  ok('после последнего действия отряд ещё в лабиринте и видит результат', s1.run && s1.res && !s1.travel && s1.hash === '#labyrinth', JSON.stringify(s1));
  await p.click('[data-dg="res-done"]'); await L.sleep(150);
  const s2 = await p.evaluate(() => ({ travel: !!document.querySelector('.travelov [data-dg="travel-out"]'), img: (document.querySelector('.travelov img') || {}).src || '', acts: act('move') === undefined && !!state.run.ending }));
  ok('после «Готово» — заставка «Время вышло» с картинкой', s2.travel && /events\/to-town/.test(s2.img), JSON.stringify(s2));
  await p.click('[data-dg="travel-out"]'); await L.sleep(200);
  const s3 = await p.evaluate(() => ({ run: state.run, hash: location.hash }));
  ok('«На Площадь измерений» — отряд в городе', !s3.run && s3.hash === '#town', JSON.stringify(s3));
  // вход через врата — заставка «в лабиринт»
  await p.evaluate(() => { const tc = townClock(); tc.back = false; rerender(); });
  await L.sleep(150);
  await p.evaluate(() => { const g = document.querySelector('[data-bld="gate"]'); g && g.click(); });
  await L.sleep(300);
  const s4 = await p.evaluate(() => ({ hash: location.hash, arrive: !!(state.run && state.run.arrive), img: (document.querySelector('.travelov img') || {}).src || '', open: (typeof gateInfo === 'function') ? gateInfo().open : null }));
  ok('врата: заставка «Врата лабиринта» с картинкой', s4.hash === '#labyrinth' && s4.arrive && /events\/to-labyrinth/.test(s4.img), JSON.stringify(s4));
  if (s4.arrive) { await p.click('[data-dg="travel-in"]'); await L.sleep(150); }
  ok('«В путь» закрывает заставку', await p.evaluate(() => !document.querySelector('.travelov') && !state.run.arrive));
  // уход по своей воле — тоже заставка
  await p.evaluate(() => { dgUi.confirm = 'leave'; document.body.insertAdjacentHTML('beforeend', '<button id="lv" data-dg="leave"></button>'); document.getElementById('lv').click(); });
  await L.sleep(150);
  const s5 = await p.evaluate(() => ({ t: (document.querySelector('.travelov h3') || {}).textContent, run: !!state.run }));
  ok('«Вернуться в город» — заставка «Возвращение в город»', s5.run && s5.t === 'Возвращение в город', JSON.stringify(s5));
  console.log('errs:', p.errs.length ? p.errs.join('\n') : 'нет');
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close();
})();
