// Интерфейс: выбор, начатый ещё до меню хода («Вынырнуть» землекопа в начале хода), показывает подсказку и кнопки, и работает касанием клетки.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['fairy', 'barb2'], autoEnd: false });
  await p.evaluate(() => { const c = state.party[0]; c.name = 'Крот'; c.essences = ['burrower']; ensureKit(c); c.mp = maxMp(c); saveChar(); });
  await L.startFightPage(p, { list: ['mouse', 'mouse'], zone: 'beast' });
  await L.waitMode(p, 'place'); await p.click('[data-ba="place-go"]');
  const myTurn = async () => { for (let i = 0; i < 14; i++) { if (!(await F.waitHero(p, { tries: 160 }))) return false; if ((await p.evaluate(() => Battle.UI.turnUnit.name)) === 'Крот') return true; await F.dockClick(p, 'end'); await L.sleep(300); } return false; };
  ok('дошёл ход героя с эссенцией землекопа', await myTurn());
  await p.evaluate(() => { Battle.S.dark = false; const hs = Battle.heroes(), ms = Battle.mons(), u = Battle.UI.turnUnit; for (const row of Battle.S.cells) row.fill(''); Battle.S.objs.length = 0; u.x = 3; u.y = 5; hs.filter(h => h !== u).forEach(h => { h.x = 5; h.y = 6; }); ms[0].x = 3; ms[0].y = 1; ms[1].x = 5; ms[1].y = 1; ms.forEach(m => { m.maxHp = m.hp = 300; }); Battle.UI.refreshNow(); });
  // «Нырок под землю»
  await F.dockClick(p, 'skill'); await L.sleep(200);
  const el = await p.$('.bt-opt:not(.off)'); ok('навык доступен в меню', !!el);
  await el.click(); await L.sleep(300);
  const md = await F.handleModal(p, 'yes'); ok('подтверждение способности', !!md, md);
  await L.sleep(500);
  ok('герой под землёй', await p.evaluate(() => !!Battle.has(Battle.UI.turnUnit, 'underground')));
  if (await p.evaluate(() => Battle.UI.mode) === 'hero') { await F.dockClick(p, 'end'); await L.sleep(300); }
  // ждём начала его следующего хода: появится выбор клетки, пока режим ещё не «ход героя»
  let st = null;
  for (let i = 0; i < 120 && !st; i++) {
    st = await p.evaluate(() => (Battle.UI.pick && Battle.UI.mode !== 'hero') ? { type: Battle.UI.pick.type, mode: Battle.UI.mode, prompt: (document.querySelector('.bt-panel .bt-prompt') || {}).innerText || '', cancel: !!document.querySelector('.bt-panel [data-ba="pick-cancel"]'), hl: [...Battle.UI.hl.entries()].filter(([k, c]) => /hl-(move|flee|ally|danger)/.test(c.join(' '))).map(([k]) => k) } : null);
    if (!st) { const m = await L.mode(p); if (m === 'hero') { const nm = await p.evaluate(() => Battle.UI.turnUnit.name); if (nm !== 'Крот') { await F.dockClick(p, 'end'); } else break; } await F.handleModal(p, 'no'); const sh = await p.$('.bd-ov:not(.out)'); if (sh) await F.playSheet(p, { quiet: true }); await L.sleep(250); }
  }
  ok('выбор клетки начался до меню хода', !!st, JSON.stringify(await p.evaluate(() => ({ mode: Battle.UI.mode, pick: !!Battle.UI.pick, under: Battle.heroes().map(h => h.name + ':' + !!Battle.has(h, 'underground')) }))));
  if (st) {
    ok('тип выбора — клетка', st.type === 'cell', st.type);
    ok('на панели видна подсказка «Вынырнуть»', /Вынырнуть/i.test(st.prompt), st.prompt);
    ok('на панели есть «Отмена»', st.cancel);
    ok('клетки подсвечены', st.hl.length > 0);
    await L.shot(p, 'idle_pick_prompt');
    const [x, y] = st.hl[Math.floor(st.hl.length / 2)].split(',').map(Number);
    await L.tapCell(p, x, y); await L.sleep(200);
    const ok2 = await p.$('[data-ba="pick-ok"]:not([disabled])'); if (ok2) await ok2.click();
    await L.sleep(600);
    const after = await p.evaluate(() => { const u = Battle.heroes().find(h => h.name === 'Крот'); return { x: u.x, y: u.y, under: !!Battle.has(u, 'underground'), emerged: !!Battle.has(u, 'emerged'), mode: Battle.UI.mode, pick: !!Battle.UI.pick }; });
    ok('вынырнул на выбранной клетке', after.x === x && after.y === y && !after.under, JSON.stringify({ want: [x, y], after }));
    ok('первая атака с преимуществом (статус «вынырнул»)', after.emerged);
    ok('после выбора открылось меню хода', after.mode === 'hero' && !after.pick, JSON.stringify(after));
  }
  // «Отмена» тоже не вешает ход: вынырнет сама
  const errs = p.errs.slice();
  ok('нет ошибок страницы', !errs.length, errs.join(' | '));
  console.log('проверок:', R.length, 'не прошли:', R.filter(r => !r.ok).length);
  await b.close();
  process.exit(R.every(r => r.ok) ? 0 : 1);
})();
