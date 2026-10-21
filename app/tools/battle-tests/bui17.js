// Сенсорный ввод: тапы по полю и бросок кубика пальцем (CDP touch events).
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860, { dpr: 2, touch: true });
  const cdp = await p.context().newCDPSession(p);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place');
  // тап по клетке расстановки
  const c = await L.cellXY(p, 0, 6); await p.touchscreen.tap(c.x, c.y); await L.sleep(300);
  console.log('позиции:', JSON.stringify((await L.units(p)).filter(u => u.s === 'hero').map(u => [u.n, u.x, u.y])));
  await p.touchscreen.tap(...(await (async () => { const r = await p.$eval('[data-ba="place-go"]', e => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); return r; })()));
  await F.waitHero(p);
  // лист броска: бросок касанием
  await p.evaluate(() => { const a = Battle.heroes()[0], t = Battle.mons()[0]; window.__ses = Battle.Dice.session(a, { title: 'Меч', sub: 'тест', att: a, tgt: t, anim: 'slash' }); window.__ses.d20({ mods: [{ l: 'Сила', v: 4 }], adv: [], dis: [], vs: { ac: 12, name: 'Гоблин' }, reroll: [], cancel: true }).then(r => { window.__res = r; }); });
  await L.sleep(700);
  const r = await p.evaluate(() => { const c = document.querySelector('.bd-arena canvas').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
  const sx = r.x + r.w / 2, sy = r.y + r.h / 2 - 8;
  await touch('touchStart', sx, sy); await L.sleep(100);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', sx + i * 14, sy - i * 8); await L.sleep(16); }
  await L.shot(p, '110_touch_held');
  await touch('touchEnd');
  await L.sleep(2500);
  console.log('после касания:', await p.evaluate(() => ({ res: document.querySelector('.bd-res').textContent, ok: !document.querySelector('.bd-ok').hidden })));
  await L.shot(p, '111_touch_done');
  console.log('errs:', p.errs);
  await b.close();
})();
