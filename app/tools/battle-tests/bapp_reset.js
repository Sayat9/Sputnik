// «Начать с нуля» в Сохранениях: двойное подтверждение, прежняя партия сохраняется в слот, всё остальное стирается, можно загрузить обратно.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  await p.evaluate(() => { state.party[0].gold = 77; giveTreasure('dice'); sackAdd('goblin', 9, 5); localStorage.removeItem(SAVES_KEY); openSaves(); });
  ok('кнопка «Начать с нуля» есть', await p.evaluate(() => /Начать с нуля/.test(document.getElementById('saveov').innerText)));
  await p.click('[data-save="reset"]');
  ok('первое нажатие только просит подтвердить', await p.evaluate(() => state.party.length === 2 && /Ещё раз/.test(document.getElementById('saveov').innerText)));
  await p.click('[data-save="reset"]');
  const A = await p.evaluate(() => ({ party: state.party.length, run: !!state.run, sack: sackTotal(), tr: treasure('dice').owned, sv: readSaves().map(x => x.name), hash: location.hash, saved: JSON.parse(localStorage.getItem(STATE_KEY)).party.length }));
  ok('герои, заход, сумка и сокровища стёрты и сохранены пустыми', A.party === 0 && !A.run && A.sack === 0 && !A.tr && A.saved === 0, JSON.stringify(A));
  ok('прежняя партия лежит в слоте «Партия до сброса»', A.sv.includes('Партия до сброса'), JSON.stringify(A.sv));
  const id = await p.evaluate(() => readSaves().find(x => x.name === 'Партия до сброса').id);
  await p.evaluate(id => { openSaves(); loadSave(id); }, id);
  ok('партию можно вернуть из слота', await p.evaluate(() => state.party.length === 2 && state.party[0].gold === 77 && sackTotal() === 5));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет'); ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
