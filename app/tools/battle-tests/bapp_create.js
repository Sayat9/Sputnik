// Создание героя: чтение бонусов по нажатию, вторая перчатка/топор, бросок характеристик 4к6 ×8.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (n, c, x) => { R.push(c); if (!c) console.log('  ✗', n, x == null ? '' : x); };
  await L.setup(p, { heroes: ['barb2'], autoEnd: false });
  const out = await p.evaluate(async () => {
    const o = {};
    openForge('race', 'more');
    forge.draft = newDraft(); forge.step = 'race'; renderForge();
    const card = document.querySelector('[data-fx-race="barbarian"] [data-fx-info]');
    o.hasInfo = !!card;
    card.click();
    const ov = document.getElementById('fxinfo');
    o.infoShown = !!ov && !ov.hidden && /Великан/.test(ov.textContent);
    o.notSelected = forge.draft.race !== 'barbarian';
    ov.querySelector('[data-fxi-close]').click(); o.closed = ov.hidden;
    forge.draft.race = 'barbarian'; forge.step = 'weapon'; renderForge();
    document.querySelector('[data-fx-weapon="gloves"]').click();
    o.twinBtn = !!document.querySelector('[data-fx-knife]');
    document.querySelector('[data-fx-weapon="gloves"] [data-fx-info]').click();
    o.weaponInfo = document.getElementById('fxinfo') && !document.getElementById('fxinfo').hidden;
    document.querySelector('#fxinfo [data-fxi-close]').click();
    document.querySelector('[data-fx-weapon="axe"]').click(); o.axeTwin = !!document.querySelector('[data-fx-knife]');
    document.querySelector('[data-fx-knife]').click(); o.knife = forge.draft.knife === true;
    forge.step = 'identity'; renderForge();
    o.rollBtn = !!document.querySelector('[data-fx="roll-stats"]');
    document.querySelector('[data-fx="roll-stats"]').click();
    const d = forge.draft; o.pool6 = d.rolls && d.rolls.pool.length === 6 && d.rolls.rows.length === 8;
    o.sorted = d.rolls.pool.every((v, i, a) => !i || a[i - 1] >= v) && d.rolls.pool.every(v => v >= 3 && v <= 18);
    document.querySelector('[data-fx-chip="0"]').click(); document.querySelector('[data-fx-put="str"]').click();
    o.put = d.base.str === String(d.rolls.pool[0]);
    document.querySelector('[data-fx-chip="1"]').click(); document.querySelector('[data-fx-put="str"]').click();   // переназначение: значение вытесняет предыдущее
    o.re = d.base.str === String(d.rolls.pool[1]) && d.put.str === 1;
    return o;
  });
  for (const [k, v] of Object.entries(out)) ok(k, v === true, v);
  ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  const bad = R.filter(x => !x).length; console.log(`проверок: ${R.length}, не прошли: ${bad}`);
  await b.close(); process.exit(bad ? 1 : 0);
})();
