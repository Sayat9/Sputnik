const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  await L.startFightPage(p, { list: ['goblin', 'goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]');
  console.log('герой:', await F.waitHero(p, { log: true }));
  const u0 = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { n: u.name, x: u.x, y: u.y }; }); console.log('ходит', JSON.stringify(u0));
  // подойдём к цели
  await F.dockClick(p, 'move'); await L.sleep(300);
  const t = await p.evaluate(() => { const mons = Battle.mons(); let best = null; for (const [k, cls] of Battle.UI.hl) { if (!cls.includes('hl-move') && !cls.includes('hl-danger')) continue; const [x, y] = k.split(',').map(Number); const dd = Math.min(...mons.map(m => Math.max(Math.abs(m.x - x), Math.abs(m.y - y)))); if (dd >= 1 && (!best || dd < best.dd)) best = { x, y, dd }; } return best; });
  await L.tapCell(p, t.x, t.y); await p.click('[data-ba="pick-ok"]'); await L.sleep(800);
  // 1) отмена на листе броска: ничего не должно потратиться
  const before = await p.evaluate(() => ({ t: JSON.stringify(Battle.UI.turnUnit.t), mh: Battle.mons().map(m => m.hp) }));
  await F.dockClick(p, 'attack'); await L.sleep(200); await p.click('.bt-opt:not(.off)'); await L.sleep(300);
  const tg = await p.evaluate(() => [...Battle.UI.targetIds].map(id => { const u = Battle.byId(id); return { x: u.x, y: u.y }; })[0]);
  await L.tapCell(p, tg.x, tg.y); await L.sleep(700);
  console.log('лист открыт:', await p.evaluate(() => !!document.querySelector('.bd-ov')));
  console.log('отмена:', await F.playSheet(p, { cancel: true }));
  await L.sleep(400);
  const after = await p.evaluate(() => ({ t: JSON.stringify(Battle.UI.turnUnit.t), mh: Battle.mons().map(m => m.hp), pick: !!Battle.UI.pick, busy: Battle.UI.busy, mode: Battle.UI.mode }));
  console.log('до:', JSON.stringify(before), '\nпосле:', JSON.stringify(after));
  // 2) атака с броском кнопкой
  await F.dockClick(p, 'attack'); await L.sleep(200); await p.click('.bt-opt:not(.off)'); await L.sleep(300);
  await L.tapCell(p, tg.x, tg.y); await L.sleep(700);
  const texts = await F.playSheet(p, { mode: 'button', shotName: '11_btn' });
  console.log('кнопка:', texts);
  await L.sleep(800);
  await L.shot(p, '12_after_attack');
  console.log('юниты:', JSON.stringify((await L.units(p)).map(u => [u.n, u.hp, u.mhp])));
  console.log('t:', await p.evaluate(() => JSON.stringify(Battle.UI.turnUnit.t)));
  console.log('errs:', p.errs);
  await b.close();
})();
