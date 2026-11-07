// Ведьмин лес (04.11): встречи в лесу и в полосе вокруг, Фонарщик в центре, прямой путь на день, потерявшийся след, клад мимика, сова, рюкзак мимика.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 3 })]; newRun(); const run = state.run; run.floor = 3; run.day = 5; f3();
    const ids = (x, y, n, k = 80) => { const out = new Set(); for (let i = 0; i < k; i++) { const e = genEncounterRaw(x, y, run.day, n); if (e) e.list.forEach(id => out.add(id)); } return [...out]; };
    const forest = ids(28, 1, 3), band = ids(25, 5, 3, 150), far = ids(15, 25, 3);
    const c = state.party[0]; const bag0 = bagSize(c); c.essences = ['mimic', 'witch-owl', 'lost-trail']; const bag1 = bagSize(c);
    c.mp = 50; heroUi = { id: 'p0', tab: 'skills' }; const st0 = oobState(c, 'mimic'); const sack0 = sackCount ? sackCount() : 0; OOB.mimic.run(c, run); const st1 = oobState(c, 'mimic'); const hoard = dgUi.res && dgUi.res.lines.length; dgUi.res = null;
    run.f3.lanternDay = run.day; const lp = lanternPathAt(28, 2) && lanternPathAt(28, 4) && !lanternPathAt(27, 2); run.f3.lanternDay = run.day - 1; const lp2 = !lanternPathAt(28, 2);
    const ess = ['mourner', 'changeling', 'lost-trail', 'lost-wanderer', 'scarecrow', 'witch-owl', 'failed-specimen', 'maid-shade', 'witch-cat', 'fog-lantern', 'mimic'].every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id));
    const spectral = ['mourner', 'lost-wanderer', 'maid-shade'].every(id => MONSTERS.find(m => m.id === id).spectral);
    return { forest, band, far, bag0, bag1, st0, st1, hoard, lp, lp2, ess, spectral };
  });
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  ok('11 монстров и эссенций леса, 3 призрака', r.ess && r.spectral, r);
  ok('в лесу — монстры леса', r.forest.length && r.forest.every(id => /mourner|changeling|wanderer|scarecrow|owl|shade|cat/.test(id)), r.forest);
  ok('в полосе вокруг — эксперименты и след вперемешку с зоной', r.band.some(id => /changeling|specimen|lost-trail/.test(id)), r.band);
  ok('вдали от леса экспериментов нет', !r.far.some(id => /changeling|specimen|lost-trail/.test(id)), r.far);
  ok('мимик: рюкзак +5 ячеек', r.bag1 === r.bag0 + 5, [r.bag0, r.bag1]);
  ok('клад мимика: один раз', !r.st0.why && r.st1.why === 'уже использовано' && r.hoard >= 5, r);
  ok('прямой путь фонарщика открыт на день, потом закрыт', r.lp && r.lp2, r);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
