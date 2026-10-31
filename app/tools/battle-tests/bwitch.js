// Ведьмин дом: вход с выбором, отдых и еда не из запасов (1 действие каждый), добровольный выход, выставление через день; тьма даёт −2 к обзору.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (n, c, x) => { R.push(!!c); if (!c) console.log('  ✗', n, '—', x == null ? '' : JSON.stringify(x)); };
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const yn = async v => { await p.waitForSelector('[data-yn]', { timeout: 3000 }); await p.click(`[data-yn="${v}"]`); await p.waitForTimeout(200); };
  await p.evaluate(() => {
    const r = state.run; r.floor = 2; r.variant = 'goblin'; r.pos = { x: 10, y: 0 }; r.day = 3; r.act = 1; switchFloor();
    r.pos = { x: 28, y: 1 }; state.party.forEach(c => { c.hp = 1; c.bag = []; r.status[c.id].fat = 2; r.status[c.id].sat = 0; });
    window.__ph = witchHouse();
  });
  await yn(0);
  const A = await p.evaluate(() => ({ act: state.run.act, hp: state.party[0].hp, log: state.run.log.slice(-1)[0].t }));
  ok('«Не входить»: ничего не потрачено, лог про мимо', A.act === 1 && A.hp === 1 && /мимо/.test(A.log), A);
  await p.evaluate(() => { window.__ph = witchHouse(); }); await yn(1);
  const B = await p.evaluate(() => ({ act: state.run.act, hp: state.party[0].hp, mp: state.party[0].mp === maxMp(state.party[0]), fat: state.run.status[state.party[0].id].fat, rations: state.party.reduce((a, c) => a + countGear(c, 'ration'), 0), sat: state.run.status[state.party[0].id].sat }));
  ok('первый отдых: 1 действие, лечит, усталость −2, паёк не нужен', B.act === 2 && B.hp > 1 && B.fat === 0 && B.rations === 0 && B.sat >= 2, B);
  await yn(1);
  ok('повторный отдых: ещё действие', await p.evaluate(() => state.run.act === 3));
  await yn(0);
  ok('добровольный выход оставляет в лесу, диалогов нет', await p.evaluate(() => !document.querySelector('[data-yn]') && /выходит/.test(state.run.log.slice(-1)[0].t)));
  await p.evaluate(() => { const r = state.run; r.act = 1; window.__ph = witchHouse(); }); await yn(1); await yn(1); await yn(1);
  await p.waitForTimeout(300);
  const C = await p.evaluate(() => ({ asking: !!document.querySelector('[data-yn]'), act: state.run.act, day: state.run.day, log: state.run.log.slice(-1)[0].t }));
  ok('третий отдых заканчивает день, диалога больше нет, выставляют за дверь', !C.asking && C.day === 4 && /выставляет/.test(C.log), C);
  // тьма: −2 к обзору, факел снимает штраф
  const D = await p.evaluate(() => {
    Battle.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); const S = Battle.S, h = Battle.heroes()[0];
    const base = Battle.sightRange(h); S.dark = true; S.torch = false; const dark = Battle.sightRange(h); S.torch = true; const lit = Battle.sightRange(h);
    return { base, dark, lit };
  });
  ok('тьма без факела −2, с факелом без штрафа', D.dark === D.base - 2 && D.lit === D.base, D);
  ok('ошибок нет', errs.length === 0, errs);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
