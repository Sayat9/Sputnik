// Экран наград: анимация двух d10 и выпадение эссенции (бросок принудительно 100).
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
const { execSync } = require('child_process');
(async () => {
  const { b, p } = await L.launch(400, 860);
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  await L.startFightPage(p, { list: ['goblin', 'wolf', 'goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  // меню → мастер → победа
  await p.click('[data-bt="menu"]'); await L.sleep(200);
  await L.shot(p, '30_menu');
  await p.click('.bt-modal [data-m="gm"]'); await L.sleep(200);
  await p.evaluate(() => { Battle.rnd = n => n - 1; });
  await p.click('.bt-modal [data-m="win"]'); await L.sleep(300);
  const files = [];
  for (let i = 0; i < 16; i++) { await L.sleep(i === 0 ? 700 : 280); const f = `${L.SHOTS}/31_end_${String(i).padStart(2, '0')}.png`; await p.screenshot({ path: f, clip: { x: 0, y: 150, width: 400, height: 560 } }); files.push(f); }
  require('child_process').execSync(`montage ${files.join(' ')} -tile 8x -geometry 200x280+2+2 -background '#222' ${L.SHOTS}/31_end_sheet.png`);
  console.log('итог:', await p.evaluate(() => { const m = document.querySelector('.bt-modal'); return m && !m.hidden ? m.innerText.replace(/\n+/g, ' | ') : 'нет'; }));
  await L.shot(p, '32_end_final');
  await p.click('.bt-done'); await L.sleep(700);
  console.log('ess:', await p.evaluate(() => JSON.stringify(state.inventory.essStash)), 'enc:', await p.evaluate(() => !!dgUi.enc));
  console.log('errs:', p.errs);
  await b.close();
})();
