// 14.11: Чаща прошлого — фото и ключ в дупле (раз за заход), подвал лаборатории на 3 этажа, Прототип Альфа-01, сыворотка силы.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, level: 5, rank: 7 })]; ensureKit(state.party[0]); addToBag(state.party[0], { t: 'g', id: 'ration', qty: 9 }); newRun(); const run = state.run;
    run.floor = 2; run.variant = 'beast'; run.day = 10; run.act = 1; run.pos = { x: 5, y: 5 }; riftSync(); dgUi.res = null; const k = Object.keys(run.riftsF2.tiles)[0].split(',').map(Number); run.pos = { x: k[0], y: k[1] }; riftEnter(); dgUi.res = null; const R = run.rift; location.hash = 'labyrinth';
    const hk = Object.keys(R.map).find(q => R.map[q] === 'hollow'); const [hx, hy] = hk.split(',').map(Number); R.pos = { x: hx, y: hy };
    const c = state.party[0], has = id => (c.bag || []).some(e => e && e.id === id), rr = Math.random;
    Math.random = () => 0.9; riftRest(); dgUi.enc = null; dgUi.res = null; o.noLuck = !has('family-photo') && !has('cellar-key');
    Math.random = () => 0.5; riftRest(); dgUi.enc = null; dgUi.res = null; o.photo60 = has('family-photo') && !has('cellar-key');
    Math.random = () => 0.1; riftRest(); dgUi.enc = null; dgUi.res = null; Math.random = rr; o.key30 = has('cellar-key') && c.bag.filter(e => e.id === 'family-photo').length === 1;
    o.weightless = GEAR['family-photo'].weight === 0 && GEAR['cellar-key'].weight === 0;
    openHero('p0'); heroUi.tab = 'inv'; heroUi.sel = c.bag.findIndex(e => e.id === 'family-photo'); renderHero(); const lb = document.querySelector('[data-hx="look"]'); o.lookBtn = !!lb; if (lb) lb.click(); await new Promise(r => setTimeout(r, 200));
    const ii = document.getElementById('iteminfo'); o.photoText = !ii.hidden && /С днём рождения, мой мальчик/.test(ii.innerText) && /учёный/.test(ii.innerText); ii.hidden = true; closeHero();
    // лаборатория: без натуралиста подвала нет; после — кнопка «Войти в подвал»
    const lk = Object.keys(R.map).find(q => R.map[q] === 'lab').split(',').map(Number); R.pos = { x: lk[0], y: lk[1] }; o.closed = !/lab-cellar/.test(pastBar(R, lk[0], lk[1]));
    R.natDead = true; o.btn = /Войти в подвал/.test(pastBar(R, lk[0], lk[1]));
    const win = () => { const e = dgUi.enc; e.outcome = 'win'; finishFight(e, e.list.map((x, i) => i)); };
    pastCellar(); o.f1 = dgUi.enc && dgUi.enc.list.every(id => id === 'lab-janitor'); win(); dgUi.res = null; o.btn2 = /спуститься на 2 этаж/.test(pastBar(R, lk[0], lk[1]));
    pastCellar(); o.f2 = dgUi.enc && dgUi.enc.list.includes('half-mech'); win(); dgUi.res = null;
    pastCellar(); o.f3 = dgUi.enc && dgUi.enc.list[0] === 'alpha01'; win(); o.serum = has('strength-serum') && /Прототип повержен/.test(dgUi.res && dgUi.res.title || ''); dgUi.res = null; o.noMore = !/lab-cellar/.test(pastBar(R, lk[0], lk[1]));
    // без ключа подвала не видно
    const keyIdx = c.bag.findIndex(e => e.id === 'cellar-key'); const keyE = c.bag.splice(keyIdx, 1)[0]; R.cellar = 0; o.needKey = !/lab-cellar/.test(pastBar(R, lk[0], lk[1])); c.bag.push(keyE);
    // сыворотка: +2 Силы, второй раз нельзя
    const s0 = totals(c).str.total; return { o, s0 };
  });
  await p.evaluate(() => { const c = state.party[0]; openHero('p0'); heroUi.tab = 'inv'; heroUi.sel = c.bag.findIndex(e => e.id === 'strength-serum'); renderHero(); }); await p.waitForTimeout(150);
  const btnTxt = await p.evaluate(() => (document.querySelector('[data-hx="eternal"]') || {}).innerText); await p.click('[data-hx="eternal"]'); await p.waitForTimeout(150); await p.click('[data-yn="1"]'); await p.waitForTimeout(250);
  const r2 = await p.evaluate(s0 => { const c = state.party[0], o = { serumUsed: totals(c).str.total === s0 + 2 && !c.bag.some(e => e.id === 'strength-serum') && c.flagsPerm.serum };
    addToBag(c, { t: 'g', id: 'strength-serum', qty: 1 }); heroUi.sel = c.bag.findIndex(e => e.id === 'strength-serum'); renderHero(); o.serumOnce = !!document.querySelector('[data-hx="eternal"][disabled]');
    closeHero(); const R = state.run.rift; R.bossDead = true; riftExit(); o.vanish = !c.bag.some(e => ['family-photo', 'cellar-key'].includes(e.id)) && c.bag.some(e => e.id === 'strength-serum'); return o; }, r.s0);
  const all = { ...r.o, verb: btnTxt === 'Вколоть', ...r2 }; let bad = 0, n = 0;
  for (const [k, v] of Object.entries(all)) { n++; if (!v) { bad++; console.log('  ✗', k); } else console.log('  ✓', k); }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad++; }
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
