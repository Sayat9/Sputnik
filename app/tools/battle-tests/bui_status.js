// Зажатие значка состояния — сноска с описанием и сроком.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]'); await F.waitHero(p);
  const missing = await p.evaluate(() => Object.entries(Battle.D.status).filter(([k, v]) => !v.desc).map(([k]) => k));
  ok('у всех состояний есть описание', !missing.length, missing.join(','));
  await p.evaluate(() => { const u = Battle.UI.turnUnit; Battle.addStatus(u, 'prone', { k: 2 }); Battle.UI.refreshNow(); Battle.UI.renderPanel(); });
  await L.sleep(300);
  const chip = await p.$('.bt-panel .bt-stchip'); ok('значок состояния в панели', !!chip);
  const box = await chip.boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await L.sleep(700); await p.mouse.up(); await L.sleep(300);
  const t = await p.evaluate(() => { const m = document.querySelector('.bt-modal'); return m && !m.hidden ? m.innerText : ''; });
  ok('зажатие открывает сноску: название, описание, срок', /Сбит/i.test(t) && /ход/.test(t), t.slice(0, 200));
  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет');
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
