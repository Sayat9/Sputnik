// 09.11: окно врага в бою — если характеристики раскрыты в библиотеке, видны Уворот, Защита, статы, особенности (поведение; тело — если раскрыто) и эффекты.
const L = require('./bui_lib.js'); const F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { touch: true }); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer'] });
  await p.evaluate(() => { settings().master = false; state.journal = null; unlockJournal(9); });
  await L.startFightPage(p, { list: ['skeleton', 'skeleton'] });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  const txt = () => p.evaluate(() => { const B = Battle, m = B.mons()[0]; B.addStatus(m, 'prone', { k: 1 }); B.UI.inspect(m); const t = document.querySelector('.bt-dlg.insp').innerText; document.querySelector('.bt-dlg.insp [data-m="close"]').click(); return t; });
  const t0 = await txt();
  ok('ничего не раскрыто — нет Уворота и статов', !/Уворот/.test(t0) && !/Особенности/.test(t0), t0);
  ok('эффекты видны всегда', /Состояния/i.test(t0) && /Сбит с ног/.test(t0), t0);
  await p.evaluate(() => { seenKeys('skeleton', ['stats']); });
  const t1 = await txt();
  ok('характеристики раскрыты — Уворот, Защита, статы, атаки', /Уворот/.test(t1) && /Защита/.test(t1) && /Сил/.test(t1) && /Атаки/.test(t1), t1);
  const body = await p.evaluate(() => MONSTERS.find(m => m.id === 'skeleton').traits.filter(t => t[2] === 'body').map(t => t[0]));
  ok('тело без раскрытия раздела не видно', !body.length || !body.some(x => t1.includes(x)), { body });
  await p.evaluate(() => { seenKeys('skeleton', ['body']); });
  const t2 = await txt();
  ok('особенность тела после раскрытия видна', !body.length || body.every(x => t2.includes(x)), { body, t2 });
  const beh = await p.evaluate(() => MONSTERS.find(m => m.id === 'skeleton').traits.filter(t => t[2] === 'behavior').map(t => t[0]));
  ok('поведение видно с характеристиками', !beh.length || beh.every(x => t1.includes(x)), { beh });
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
