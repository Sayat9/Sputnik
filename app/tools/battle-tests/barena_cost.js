// 09.11: арена — одно городское действие за посещение (ставки + бой), возврат после боя бесплатен;
// библиотека — каждое исследование тратит действие сразу; таверна — после арены сон можно, если врата откроются не раньше чем через 3 действия.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860); let n = 0, bad = 0; const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (t, c, d) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(d)}`); };
  await L.setup(p, { heroes: ['barb2', 'archer'], tactical: true });
  await p.evaluate(async () => { await loadBattle(); state.run = null; state.townUnlocked = true; state.arena = null; state.journal = null; unlockJournal(9); state.party.forEach(c => { c.rank = 8; c.gold = 100; }); townClock().t = 0; location.hash = 'town'; rerender(); });
  const T = () => p.evaluate(() => townClock().t);
  // --- арена
  await p.click('[data-bld="arena"]'); await p.waitForSelector('.tw-bout');
  await p.click('.tw-fighter[data-i="0"][data-s="a"]'); await p.click('[data-t="achip"][data-n="5"]'); await p.click('[data-t="abet"]');
  ok('ставка: посещение стоит 1', await p.evaluate(() => Town.state().cost) === 1);
  await p.click('[data-t="atab"][data-k="fight"]');
  await p.evaluate(() => { window.loadBattle = () => new Promise(() => {}); });
  await p.click('[data-t="afight"]'); await p.click('[data-t="afight"]');
  ok('ставка + бой = одно городское действие', await T() === 1, await T());
  await p.evaluate(() => Town.arenaDone({ list: ['goblin'] }, { killed: [0], plan: { arena: { total: 3 } } })); await p.waitForTimeout(800);
  await p.click('[data-t="atab"][data-k="bets"]'); await p.click('.tw-fighter[data-i="1"][data-s="a"]'); await p.click('[data-t="achip"][data-n="5"]'); await p.click('[data-t="abet"]');
  await p.click('[data-t="close"]');
  ok('возврат на арену после боя (и ставка там) бесплатен', await T() === 1, await T());
  // --- таверна после арены
  const tav = async () => { await p.evaluate(() => { location.hash = 'town'; rerender(); }); await p.click('[data-bld="tavern"]'); await p.waitForSelector('.tw-rows'); const r = await p.evaluate(() => [...document.querySelectorAll('[data-k="sleep"]')].every(x => x.disabled)); await p.evaluate(() => { Town.state().cost = 0; }); await p.click('[data-t="close"]'); return r; };
  await p.evaluate(() => { const c = townClock(); c.back = true; c.t0 = 0; c.t = 1; });          // врата через много действий
  const g1 = await p.evaluate(() => gateInfo()); ok('врата далеко (' + g1.left + '): сон после арены доступен', g1.left > 2 && !(await tav()), g1);
  await p.evaluate(() => { const c = townClock(); c.t = c.t0 + townGateWait() - 2; });
  const g2 = await p.evaluate(() => gateInfo()); ok('врата через ' + g2.left + ': сон закрыт', g2.left <= 2 && await tav(), g2);
  // --- библиотека
  await p.evaluate(() => { const c = townClock(); c.back = false; c.t = 10; location.hash = 'town'; rerender(); });
  await p.click('[data-bld="library"]'); await p.waitForSelector('[data-t="lr-cat"]');
  await p.click('[data-t="lr-cat"][data-k="monsters"]'); await p.click('[data-t="lr-hero"]'); await p.click('[data-t="lr-cls"][data-n="9"]');
  await p.evaluate(() => { window.__libDie = 20; }); await p.click('[data-t="lr-roll"]');
  ok('первая проверка сразу тратит действие (до выхода)', await T() === 11, await T());
  for (let i = 0; i < 6; i++) { const pk = await p.$('[data-t="lr-pick"]'); if (pk) await pk.click(); if (!(await p.$('[data-t="lr-roll"]'))) break; await p.click('[data-t="lr-roll"]'); }
  ok('остальные проверки того же исследования бесплатны', await T() === 11, await T());
  const n20 = await p.$('[data-t="lr-nat20"]'); if (n20) await n20.click();
  const rs = await p.$('[data-t="lr-restart"]'); if (rs) { await rs.click(); await p.click('[data-t="lr-hero"]'); await p.click('[data-t="lr-cls"][data-n="9"]'); await p.click('[data-t="lr-roll"]'); }
  ok('второе исследование — ещё одно действие', rs && await T() === 12, { t: await T(), rs: !!rs });
  await p.click('[data-t="close"]'); ok('выход из библиотеки не добавляет действий', await T() === 12, await T());
  ok('errs: нет', !errs.length, errs);
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
