// После боя лабиринт должен работать как обычно.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  await L.startFightPage(p, { list: ['goblin', 'goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  // несколько кликов по панели боя (раньше они «заражали» экран лабиринта)
  await F.dockClick(p, 'attack'); await F.dockClick(p, 'attack'); await F.dockClick(p, 'move'); await p.click('[data-ba="pick-cancel"]');
  console.log('фаза во время боя:', await p.evaluate(() => dgUi.phase));
  await p.click('[data-bt="menu"]'); await L.sleep(200); await p.click('.bt-modal [data-m="gm"]'); await L.sleep(200); await p.click('.bt-modal [data-m="win"]'); await L.sleep(300);
  await p.waitForSelector('.bt-done:not([hidden])', { timeout: 20000 }); await p.click('.bt-done'); await L.sleep(800);
  console.log('после боя: фаза', await p.evaluate(() => dgUi.phase), '| enc', await p.evaluate(() => !!dgUi.enc), '| #battle', await p.evaluate(() => !!document.getElementById('battle')));
  console.log('кнопки лабиринта:', await p.evaluate(() => [...document.querySelectorAll('[data-act]')].map(e => e.dataset.act).join(',')));
  await L.shot(p, '130_lab_after');
  // реально пойти
  await p.click('[data-act="move"]'); await L.sleep(300);
  console.log('фаза после клика Движение:', await p.evaluate(() => dgUi.phase));
  console.log('run log:', await p.evaluate(() => state.run.log.slice(-2).map(l => l.t)));
  console.log('errs:', p.errs);
  await b.close();
})();
