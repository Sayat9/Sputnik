// Интерфейс: призванные волки и двойники ходят под управлением игрока (решение автора): меню «Атака / Движение / Конец хода», бросок кубиками — как у героя.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2'], autoEnd: false });
  await p.evaluate(() => { const c = state.party[0]; c.essences = ['werewolf']; ensureKit(c); c.mp = maxMp(c); saveChar(); });
  await L.startFightPage(p, { list: ['goblin'], zone: 'goblin' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]');
  ok('дошёл ход героя', await F.waitHero(p, { tries: 160 }));
  await p.evaluate(() => { const B = Battle, S = B.S, u = B.UI.turnUnit; for (const row of S.cells) row.fill(''); S.objs.length = 0; u.x = 3; u.y = 5; const m = B.mons()[0]; m.x = 3; m.y = 2; m.maxHp = m.hp = 300; m.ac = 5; window.__w = B.spawnWolves(u, 2); B.UI.refreshNow(); });
  const info = await p.evaluate(() => ({ n: Battle.S.units.filter(u => u.summon && u.side === 'hero').length, hasAtk: Battle.S.units.filter(u => u.summon).every(u => u.atk && u.atk.length) }));
  ok('призваны волки с атаками', info.n >= 1 && info.hasAtk, JSON.stringify(info));
  await F.dockClick(p, 'end'); await L.sleep(300);
  // ждём ход волка
  let st = null;
  for (let i = 0; i < 200 && !st; i++) {
    st = await p.evaluate(() => (Battle.UI.mode === 'hero' && Battle.UI.turnUnit && Battle.UI.turnUnit.summon) ? { name: Battle.UI.turnUnit.name, dock: [...document.querySelectorAll('[data-ba="dock"]')].map(e => e.dataset.id) } : null);
    if (!st) { const m = await L.mode(p); if (m === 'hero') { await F.dockClick(p, 'end'); } await F.handleModal(p, 'no'); const sh = await p.$('.bd-ov:not(.out)'); if (sh) await F.playSheet(p, { quiet: true }); await L.sleep(200); }
  }
  ok('дошёл ход волка: игрок получил меню', !!st, JSON.stringify(st));
  if (st) {
    ok('в меню только Атака, Движение, Конец хода', st.dock.every(i => ['attack', 'move', 'end'].includes(i)) && st.dock.includes('attack') && st.dock.includes('move') && st.dock.includes('end'), st.dock.join(','));
    await L.shot(p, 'summon_turn');
    // движение на соседнюю клетку
    const before = await p.evaluate(() => { const u = Battle.UI.turnUnit; return { x: u.x, y: u.y, id: u.id, move: u.t.move }; });
    await F.dockClick(p, 'move'); await L.sleep(250);
    const hl = await p.evaluate(() => [...Battle.UI.hl.entries()].filter(([k, c]) => /hl-move/.test(c.join(' '))).map(([k]) => k));
    ok('у волка подсвечены клетки движения', hl.length > 0, hl.length);
    if (hl.length) {
      const [x, y] = hl[0].split(',').map(Number); await L.tapCell(p, x, y); await L.sleep(250);
      const okb = await p.$('[data-ba="pick-ok"]:not([disabled])'); if (okb) await okb.click(); await L.sleep(900);
      const after = await p.evaluate(() => { const u = Battle.byId(Battle.S.curId); return { x: u.x, y: u.y }; });
      ok('волк переместился по нажатию клетки', after.x !== before.x || after.y !== before.y, JSON.stringify({ before, after }));
    }
    if ((await L.mode(p)) === 'hero') {
      await F.dockClick(p, 'end'); await L.sleep(400);
    }
  }
  // второй ход волка: атака с броском кубиков игроком
  let st2 = null;
  for (let i = 0; i < 250 && !st2; i++) {
    st2 = await p.evaluate(() => (Battle.UI.mode === 'hero' && Battle.UI.turnUnit && Battle.UI.turnUnit.summon) ? Battle.UI.turnUnit.id : null);
    if (!st2) { const m = await L.mode(p); if (m === 'hero') { await F.dockClick(p, 'end'); } await F.handleModal(p, 'no'); const sh = await p.$('.bd-ov:not(.out)'); if (sh) await F.playSheet(p, { quiet: true }); await L.sleep(200); }
  }
  ok('снова дошёл ход волка', !!st2);
  if (st2) {
    await p.evaluate(() => { const B = Battle, u = B.UI.turnUnit, m = B.mons()[0]; for (const row of B.S.cells) row.fill(''); const c = B.freeCellsNear(u, 1, u)[0]; m.x = c[0]; m.y = c[1]; m.ac = 1; m.maxHp = m.hp = 300; B.UI.refreshNow(); B.UI.renderPanel(); });
    await F.dockClick(p, 'attack'); await L.sleep(300);
    const hp0 = await p.evaluate(() => Battle.mons()[0].hp);
    const opt = await p.$('.bt-opt:not(.off)'); if (opt) { await opt.click(); await L.sleep(300); }
    // выбор цели: если нужно — нажать врага
    const tgt = await p.evaluate(() => { const m = Battle.mons()[0]; return Battle.UI.pick ? { x: m.x, y: m.y } : null; });
    if (tgt) { await L.tapCell(p, tgt.x, tgt.y); await L.sleep(250); const okb = await p.$('[data-ba="pick-ok"]:not([disabled])'); if (okb) await okb.click(); await L.sleep(400); }
    for (let i = 0; i < 40; i++) { const sh = await p.$('.bd-ov:not(.out)'); if (sh) { await F.playSheet(p, { quiet: true }); break; } await L.sleep(150); }
    await L.sleep(800);
    const hp1 = await p.evaluate(() => Battle.mons()[0].hp);
    ok('атака волка прошла через окно броска, цель ранена', hp1 < hp0, hp0 + ' → ' + hp1);
  }
  console.log('errs:', p.errs.length ? p.errs.slice(0, 6) : 'нет');
  ok('нет ошибок страницы', !p.errs.length, p.errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close();
  process.exit(R.every(r => r.ok) ? 0 : 1);
})();
