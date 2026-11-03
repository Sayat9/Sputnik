// 3 этаж: Пылающие земли (встречи, кузнец), способности вне боя (ворон, охотник, хищник) — 03.11.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    state.party = [Object.assign(clone(state.example), { id: 'p0', example: false })]; newRun(); const run = state.run; run.floor = 3; run.day = 5;
    const ids = (x, y, n) => { const out = new Set(); for (let i = 0; i < 80; i++) { const e = genEncounterRaw(x, y, run.day, n); if (e) e.list.forEach(id => out.add(id)); } return [...out]; };
    const trap = ids(24, 6, 3), trapEasy = ids(24, 6, 13), queen = genEncounterRaw(25, 7, 5, 3);
    run.pos = { x: 25, y: 7 }; const b1 = f3Buttons().map(b => b.id); f3().queenDead = true; const b2 = f3Buttons().map(b => b.id); f3Do('f3trapchest'); const chest = dgUi.res && dgUi.res.title; const b3 = f3Buttons().map(b => b.id); dgUi.res = null; f3().queenDead = false;
    const fire = ids(3, 3, 3), easy = ids(3, 3, 13), boss = genEncounterRaw(5, 6, 5, 3);
    const c = state.party[0]; c.level = 3; c.essences = ['keen-raven', 'silent-predator', 'toll-hunter']; c.mp = 30;
    run.pos = { x: 3, y: 3 }; run.visited = [tkey(3, 3)];
    const before = oobState(c, 'keen-raven');
    heroUi = { id: 'p0', tab: 'skills' };
    const html = heroSkills(c), btns = (html.match(/data-hx="oob"/g) || []).length;
    const res = OOB['keen-raven'].run(c, run), opened = run.visited.length;
    OOB['silent-predator'].run(c, run); const quiet = quietOn();
    f3().noise = 7; OOB['toll-hunter'].run(c, run); const noise = f3().noise;
    return { b1, b2, b3, chest, trap, trapEasy, queen: queen && queen.list, trapEss: ['trap-crab', 'wire-spider', 'bolt-golem', 'trap-master', 'boulder-beetle', 'trap-queen'].every(id => ESSENCES[id]), fire, easy, boss: boss && boss.list, ess: ['coal-beetle', 'ember-salamander', 'ash-executioner', 'brazier-golem', 'ember-reaper', 'magma-wyrm', 'forge-smith'].every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id)), btns, before, opened, quiet, noise, res };
  });
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  ok('Пылающие земли: тяжёлые встречи — свои монстры', r.fire.length && r.fire.every(id => /coal|ember|brazier|magma|ash-exec/.test(id)), r);
  ok('Пылающие земли: лёгкие — только 9 класс', r.easy.every(id => ['coal-beetle', 'ember-salamander'].includes(id)), r);
  ok('горнило — кузнец + голем', r.boss && r.boss[0] === 'forge-smith', r);
  ok('6 монстров и эссенций', r.ess, r);
  ok('кнопки способностей вне боя у трёх эссенций', r.btns === 3, r);
  ok('ворон открывает соседние квадраты', r.opened > 1, r);
  ok('хищник: отряд тих', r.quiet, r);
  ok('охотник: шум −3', r.noise === 4, r);
  ok('Зона ловушек: свои монстры, лёгкие — 9 класс', r.trap.length && r.trap.every(id => /trap|wire|bolt|boulder/.test(id)) && r.trapEasy.every(id => ['trap-crab', 'wire-spider'].includes(id)), r);
  ok('мастерская — королева ловушек; 6 эссенций', r.queen && r.queen[0] === 'trap-queen' && r.trapEss, r);
  ok('сундук мастерской: сперва королева, после победы — сундук, открывается один раз', r.b1.includes('f3queen') && r.b2.includes('f3trapchest') && r.chest === 'Сундук мастерской' && !r.b3.some(x => /f3queen|f3trapchest/.test(x)), r);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
