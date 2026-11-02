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
    o.twinBtn = !!document.querySelector('[data-fx-knife]') && forge.draft.weapon === 'gloves' && !forge.draft.knife;          // пара — повторным нажатием; у одной перчатки есть карточка «Кинжал» во вторую руку
    document.querySelector('[data-fx-weapon="gloves"]').click();
    o.glovesTwin = forge.draft.knife === true && /×2/.test(document.querySelector('[data-fx-weapon="gloves"]').textContent) && /2к4/.test(document.querySelector('[data-fx-weapon="gloves"]').textContent) && document.querySelectorAll('.wpn-grid .race-card.off').length >= 3;
    document.querySelector('[data-fx-weapon="gloves"]').click();
    o.glovesOff = forge.draft.weapon === null && !forge.draft.knife;
    forge.draft.weapon = 'longbow'; renderForge(); o.bowKnife = !!document.querySelector('[data-fx-knife]'); forge.draft.weapon = null; renderForge();
    document.querySelector('[data-fx-weapon="gloves"] [data-fx-info]').click();
    o.weaponInfo = document.getElementById('fxinfo') && !document.getElementById('fxinfo').hidden;
    document.querySelector('#fxinfo [data-fxi-close]').click();
    document.querySelector('[data-fx-weapon="axe"]').click(); document.querySelector('[data-fx-weapon="axe"]').click(); o.knife = forge.draft.weapon === 'axe' && forge.draft.knife === true;
    forge.step = 'identity'; renderForge();
    // характеристики (02.11): бросок уже сделан при входе, минимум 9, остаток раздаётся стрелками/вводом, итог с расой ≤ 20, бросок не меняется при выходе
    const d = forge.draft;
    o.rolledOnEnter = !!(d.rolls && d.rolls.rows.length === STAT_ROLLS && d.rolls.rows.every(r => r.sum >= 10 && r.sum <= 18) && d.rolls.total === d.rolls.rows.reduce((a, r) => a + r.sum, 0));
    o.min9 = STAT_KEYS.every(k => d.base[k] === '9') && statLeft(d) === d.rolls.total - 54;
    o.totalShown = document.querySelector('.pool-total').textContent === String(d.rolls.total) && !document.querySelector('.roll-det').open;
    const plus = document.querySelector('[data-fx-step="str"][data-d="1"]'), minus = document.querySelector('[data-fx-step="str"][data-d="-1"]');
    o.minusOffAt9 = minus.disabled;
    plus.click(); plus.click(); o.arrows = d.base.str === '11' && document.getElementById('fx-left').textContent === String(statLeft(d));
    const cap = statMaxBase('str'); for (let i = 0; i < 30; i++) document.querySelector('[data-fx-step="str"][data-d="1"]').click();
    o.cap20 = +d.base.str === 20 && cap === 20;          // предел 20 — без бонуса расы (02.11)
    const tot = d.rolls.total; closeForge(); openForge('race', 'first'); forge.draft.race = 'human'; forge.draft.gender = 'm'; forge.draft.weapon = 'sword'; forge.step = 'identity'; renderForge();
    o.keptAfterReopen = forge.draft.rolls.total === tot;
    forge.draft.name = 'Тест'; finishDraft(); o.mustSpendAll = forge.errors.some(e => e.f === 'pool');
    const dd = forge.draft; let left = statLeft(dd); for (const k of STAT_KEYS) { const add = Math.min(left, statMaxBase(k) - 9); dd.base[k] = String(9 + add); left -= add; }
    finishDraft(); o.created = !forge.errors.length && state.party.some(c => c.name === 'Тест');
    o.newRollNext = (() => { openForge('race', 'more'); forge.draft.race = 'human'; forge.draft.gender = 'm'; forge.draft.weapon = 'sword'; forge.step = 'identity'; renderForge(); return !!forge.draft.rolls && forge.draft.rolls.at !== undefined; })();
    return o;
  });
  for (const [k, v] of Object.entries(out)) ok(k, v === true, v);
  ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  const bad = R.filter(x => !x).length; console.log(`проверок: ${R.length}, не прошли: ${bad}`);
  await b.close(); process.exit(bad ? 1 : 0);
})();
