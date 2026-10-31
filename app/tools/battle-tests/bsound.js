// Настройки: звук включён по умолчанию, переключатель работает, кнопки не выходят за экран телефона.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(360, 740, { touch: true });
  const R = [], ok = (n, c, x) => { R.push(!!c); if (!c) console.log('  ✗', n, '—', x == null ? '' : JSON.stringify(x)); };
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2'], autoEnd: false });
  await p.evaluate(() => { state.settings = {}; state.run = null; location.hash = ''; rerender(); });
  ok('звук включён по умолчанию', await p.evaluate(() => Sfx.on()));
  await p.click('[data-action="settings"]');
  const G = await p.evaluate(() => { const vw = innerWidth, bad = [...document.querySelectorAll('#setov button')].filter(b => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > vw + 0.5 || b.scrollWidth > b.clientWidth + 1; }).length; return { bad, txt: document.querySelector('[data-setk="sound"]').textContent }; });
  ok('все кнопки в пределах экрана 360 px', G.bad === 0, G);
  ok('в настройках звук «вкл»', /Звук: вкл/.test(G.txt), G.txt);
  await p.click('[data-setk="sound"]');
  ok('переключатель выключает звук', await p.evaluate(() => state.settings.sound === false && !Sfx.on()));
  await p.click('[data-setk="sound"]');
  ok('и включает обратно', await p.evaluate(() => Sfx.on()));
  ok('ошибок нет', errs.length === 0, errs);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
