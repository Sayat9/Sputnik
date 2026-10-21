// Ходы монстров: баннеры, анимации, плавающий урон.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'] });
  await L.startFightPage(p, { list: ['goblin-archer', 'goblin-sword', 'wolf'], zone: 'goblin', ambush: true });
  await p.waitForFunction(() => Battle.UI.mode === 'ambush', null, { timeout: 20000 });
  await L.sleep(500); await L.shot(p, '150_ambush_panel');
  await p.click('[data-ba="place-go"]');
  // монстры ходят первыми в засаде: снимаем кадры
  const frames = [];
  for (let i = 0; i < 14; i++) { await L.sleep(450); const f = `${L.SHOTS}/151_mon_${String(i).padStart(2, '0')}.png`; await p.screenshot({ path: f, clip: { x: 0, y: 0, width: 400, height: 760 } }); frames.push(f); if ((await L.mode(p)) === 'hero') break; }
  require('child_process').execSync(`montage ${frames.join(' ')} -tile 7x -geometry 220x+2+2 -background '#222' ${L.SHOTS}/151_mon_sheet.png`);
  console.log('кадров:', frames.length, 'mode:', await L.mode(p));
  console.log('errs:', p.errs);
  await b.close();
})();
