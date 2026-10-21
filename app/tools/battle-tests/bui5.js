const L = require('./bui_lib.js'), F = require('./bui_flow.js'), B = require('./bui_bot.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  await L.startFightPage(p, { list: ['goblin', 'goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]');
  let turns = 0, lastRound = 0;
  for (let guard = 0; guard < 200; guard++) {
    const ok = await F.waitHero(p, { tries: 200 });
    const m = await L.mode(p);
    if (m === 'result' || !ok) break;
    const info = await p.evaluate(() => ({ n: Battle.UI.turnUnit.name, r: Battle.S.round }));
    const log = await B.botTurn(p, { mode: turns % 2 ? 'drag' : 'button' });
    turns++; console.log(`ход ${turns} (р.${info.r}) ${info.n}:`, log.join(','));
    if (info.r !== lastRound) { lastRound = info.r; await L.shot(p, `20_round${info.r}`); }
  }
  console.log('режим:', await L.mode(p));
  await L.sleep(1500); await L.shot(p, '21_result_a');
  await L.sleep(2500); await L.shot(p, '22_result_b');
  await L.sleep(2500); await L.shot(p, '23_result_c');
  console.log('экран итога:', await p.evaluate(() => { const m = document.querySelector('.bt-modal'); return m && !m.hidden ? m.innerText.replace(/\n+/g, ' | ') : 'нет'; }));
  const done = await p.$('.bt-done:not([hidden])'); if (done) { await done.click(); await L.sleep(800); }
  console.log('после:', await p.evaluate(() => ({ battle: !!document.getElementById('battle'), enc: !!dgUi.enc, xp: state.party.map(c => c.xp), hp: state.party.map(c => c.hp), stones: JSON.stringify(state.party.map(c => (c.bag || []).filter(i => /stone/.test(i.id)))), ess: JSON.stringify(state.inventory.essStash || []) })));
  await L.shot(p, '24_after');
  console.log('errs:', p.errs);
  await b.close();
})();
