// Бросок кубика пальцем: зажать, потянуть, бросить.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  // сразу откроем лист броска напрямую (без боя), чтобы проверять физику
  await p.evaluate(() => { const a = Battle.heroes()[0], t = Battle.mons()[0]; window.__ses = Battle.Dice.session(a, { title: 'Меч', sub: 'тест', att: a, tgt: t, anim: 'slash' }); window.__r = window.__ses.d20({ mods: [{ l: 'Сила', v: 4 }], adv: [], dis: [], vs: { ac: 12, name: 'Гоблин' }, reroll: [{ label: 'Вдохновение', spend() {} }], cancel: true }).then(r => { window.__res = r; }); });
  await L.sleep(700);
  const r = await p.evaluate(() => { const c = document.querySelector('.bd-arena canvas').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
  console.log('арена:', JSON.stringify(r));
  const sx = r.x + r.w / 2, sy = r.y + r.h / 2 - 8;
  await p.mouse.move(sx, sy); await p.mouse.down(); await L.sleep(120);
  await L.shot(p, '50_held');
  for (let i = 1; i <= 10; i++) { await p.mouse.move(sx + i * 10, sy - i * 6); await L.sleep(14); }
  await L.shot(p, '51_dragged');
  console.log('до броска, результат:', await p.evaluate(() => window.__res || null));
  await p.mouse.up();
  const frames = [];
  for (let i = 0; i < 5; i++) { await L.sleep(i ? 160 : 60); const f = `${L.SHOTS}/52_fly_${i}.png`; await p.screenshot({ path: f, clip: { x: 0, y: 380, width: 400, height: 480 } }); frames.push(f); }
  await L.sleep(1800);
  console.log('после броска:', await p.evaluate(() => ({ res: document.querySelector('.bd-res').textContent, okVisible: !document.querySelector('.bd-ok').hidden, rr: !document.querySelector('.bd-reroll').disabled, x: !document.querySelector('.bd-x').hidden })));
  await L.shot(p, '53_settled');
  require('child_process').execSync(`montage ${frames.join(' ')} -tile 5x -geometry 200x240+2+2 -background '#222' ${L.SHOTS}/52_fly_sheet.png`);
  // переброс
  await p.click('.bd-reroll'); await L.sleep(300); await L.shot(p, '54_reroll_start');
  await L.sleep(2500);
  console.log('после переброса:', await p.evaluate(() => document.querySelector('.bd-res').textContent));
  await L.shot(p, '55_reroll_done');
  await p.click('.bd-ok'); await L.sleep(500);
  console.log('результат:', await p.evaluate(() => JSON.stringify(window.__res)));
  console.log('errs:', p.errs);
  await b.close();
})();
