// 3 этаж: встречи в Звоне и Храме (03.11) — бросок события даёт монстров зоны; охотник при шуме 10+; скульптор в сердце храма; вне описанных зон — пусто.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false })]; newRun(); const run = state.run; run.floor = 3; run.day = 5;
    const ids = (x, y, n) => { const out = new Set(); for (let i = 0; i < 60; i++) { const e = genEncounterRaw(x, y, run.day, n); if (e) e.list.forEach(id => out.add(id)); } return [...out]; };
    const toll = ids(15, 12, 3), tollEasy = ids(15, 12, 13), temple = ids(13, 26, 3), boss = genEncounterRaw(15, 28, 5, 3);
    f3().noise = 12; const hunt = ids(15, 12, 3).includes('toll-hunter'); f3().noise = 0;
    const empty = f3HasMon(24, 6), hasToll = f3HasMon(15, 12);
    return { toll, tollEasy, temple, boss: boss && boss.list, hunt, empty, hasToll, ess: ['toll-beetle', 'choir-dead', 'faceless-sculptor'].every(id => ESSENCES[id] && ESSENCES[id].active.name) };
  });
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  ok('Звон: тяжёлые встречи — монстры 7–8 класса зоны', r.toll.some(id => ['bell-ringer', 'choir-dead', 'toll-guard', 'shrieker', 'toll-bull'].includes(id)) && r.toll.every(id => /toll|echo|shrieker|bell|choir/.test(id)), r);
  ok('Звон: лёгкие встречи — только 9 класс', r.tollEasy.every(id => ['toll-beetle', 'echo-jackal', 'toll-rat'].includes(id)), r);
  ok('Храм: свои монстры', r.temple.length && r.temple.every(id => /acolyte|cherub|caryatid|halberdier|marble/.test(id)), r);
  ok('сердце храма — безликий скульптор', r.boss && r.boss[0] === 'faceless-sculptor', r);
  ok('охотник за звоном приходит при шуме 10+', r.hunt, r);
  ok('зона без описанных монстров — пусто; Звон — с монстрами', !r.empty && r.hasToll, r);
  ok('эссенции новых монстров на месте', r.ess, r);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
