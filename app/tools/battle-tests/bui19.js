// Кнопка «Назад»: отмена шага, меню боя, бой не закрывается.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  const h0 = await p.evaluate(() => history.length);
  await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  const back = async () => { await p.evaluate(() => history.back()); await L.sleep(350); };
  console.log('история до/после открытия боя:', h0, await p.evaluate(() => history.length));
  // 1) назад в простое → меню боя
  await back(); console.log('меню боя открыто:', await p.evaluate(() => !!document.querySelector('.bt-dlg.menu')), '| бой жив:', await p.evaluate(() => !!document.getElementById('battle')));
  // 2) назад в меню → закрывает меню
  await back(); console.log('меню закрыто:', await p.evaluate(() => document.querySelector('.bt-modal').hidden));
  // 3) назад при выборе цели → отмена выбора
  await F.dockClick(p, 'move'); await L.sleep(250); console.log('выбор клетки:', await p.evaluate(() => !!Battle.UI.pick));
  await back(); console.log('выбор отменён:', await p.evaluate(() => !Battle.UI.pick));
  // 4) назад при открытом списке → закрывает список
  await F.dockClick(p, 'other'); await L.sleep(200); await back(); console.log('список закрыт:', await p.evaluate(() => !Battle.UI.cat));
  // 5) назад на листе броска (до броска) → отмена
  await p.evaluate(() => { const a = Battle.heroes()[0], t = Battle.mons()[0]; window.__ses = Battle.Dice.session(a, { title: 'Тест', sub: '', att: a, tgt: t, anim: 'slash' }); window.__ses.d20({ mods: [], adv: [], dis: [], vs: { ac: 10, name: 'x' }, reroll: [], cancel: true }).then(r => { window.__res = r === null ? 'cancel' : 'rolled'; }); });
  await L.sleep(500); await back(); console.log('бросок отменён:', await p.evaluate(() => window.__res), '| лист закрыт:', await p.evaluate(() => !document.querySelector('.bd-ov:not(.out)')));
  // 6) конец боя закрывает запись истории
  await p.click('[data-bt="menu"]'); await L.sleep(200); await p.click('.bt-modal [data-m="gm"]'); await L.sleep(200); await p.click('.bt-modal [data-m="flee"]'); await L.sleep(300);
  await p.waitForSelector('.bt-done:not([hidden])', { timeout: 20000 }); await p.click('.bt-done'); await L.sleep(700);
  console.log('после боя: история', await p.evaluate(() => history.length), 'state:', await p.evaluate(() => JSON.stringify(history.state)), 'бой закрыт:', await p.evaluate(() => !document.getElementById('battle')));
  console.log('errs:', p.errs);
  await b.close();
})();
