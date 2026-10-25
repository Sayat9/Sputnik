// Онлайн-бой с настоящим интерфейсом игрока: зеркало боя, ход своего героя с меню, конец хода.
const { chromium } = require('playwright');
const R = [], ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' }); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));

  await h.addInitScript(() => localStorage.clear()); await c.addInitScript(() => localStorage.clear());
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  await h.evaluate(async () => {
    const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 3 }); c.base = { str: 16, dex: 12, con: 16, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); return c; };
    state.party = [mk('hA', 'Аргон'), mk('hB', 'Борис')]; state.townUnlocked = true; state.sessions = [{ n: 1, date: new Date().toISOString(), members: ['hA', 'hB'] }]; saveChar(); location.hash = 'labyrinth';
    await loadBattle();
  });
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(800);
  await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]'); await c.waitForTimeout(1500);
  const pid = await h.evaluate(() => Object.keys(Net.players)[0]);
  await h.evaluate(pid => { state.party[0].owner = pid; saveChar(); NetGlue.pushAll(true); }, pid);
  await c.waitForTimeout(800);
  await h.evaluate(() => {
    window.hturns = []; const orig = Battle.UI.heroTurn.bind(Battle.UI); Battle.UI.heroTurn = async u => { hturns.push(u.name); if (u.name === 'Борис') await Battle.AI.takeTurn(u); else { const m = Battle.S.units.find(m => m.side === 'mon' && m.hp > 0), cells = [[0,-1],[1,0],[-1,0],[0,1]].map(([a,b]) => [u.x+a,u.y+b]).filter(([x,y]) => x>=0&&y>=0&&x<7&&y<7&&!Battle.S.units.some(o => o.hp>0 && o.x===x && o.y===y)); if (m && cells.length) { m.x = cells[0][0]; m.y = cells[0][1]; } await orig(u); } };
    const od = Battle.Dice.session.bind(Battle.Dice); Battle.Dice.session = (u, m) => (u && u.side === 'hero' && u.name === 'Борис') || (u && u.side === 'mon') ? Battle.autoSession(u, m) : od(u, m);
    const ev = { list: ['goblin', 'goblin', 'goblin'], zone: 'goblin', ambush: false, kind: 'hard', title: 'тест', floor: 1 };
    Battle.running = true; Battle.UI.open(); setInterval(() => { if (Battle.UI.placeOnly) Battle.UI.placeDone(); }, 300); window.pr = Battle.start(ev);
  });
  await c.waitForFunction(() => window.Battle && Battle.UI && Battle.UI.placeOnly, null, { timeout: 30000 });
  await c.waitForTimeout(300); await c.screenshot({ path: '/tmp/battle-shots/net_place.png' });
  ok('у игрока панель расстановки с «Готово»', await c.evaluate(() => !!document.querySelector('.bt-panel [data-ba="place-go"]')));
  await c.click('.bt-panel [data-ba="place-go"]');
  // игрок: ждём свой ход с настоящим интерфейсом
  await c.waitForFunction(() => window.Battle && Battle.UI && Battle.UI.active && Battle.UI.mode === 'hero', null, { timeout: 45000 }).catch(async () => { console.log('застряли; клиент:', await c.evaluate(() => [Battle.UI.mode, document.body.innerText.replace(/\\s+/g, ' ').slice(-400)])); await c.screenshot({ path: '/tmp/battle-shots/net_stuck.png' }); await h.screenshot({ path: '/tmp/battle-shots/net_stuck_h.png' }); process.exit(1); });
  ok('у игрока открыт бой и режим хода', true);
  await c.waitForTimeout(500); await c.screenshot({ path: '/tmp/battle-shots/net_turn.png' });
  ok('в меню боя нет функций ведущего', await c.evaluate(() => { Battle.UI.menu(); const t = document.querySelector('.bt-modal').textContent; document.querySelector('.bt-modal').hidden = true; return !/Мастер: завершить|Авто-бой|Обычный экран/.test(t); }));
  const hasAttack = await c.evaluate(() => !!document.querySelector('.bt-panel [data-ba], .bt-panel button'));
  ok('панель действий есть', hasAttack);

  let alive = true; (async () => { while (alive) { try { await h.locator('button:text-is("Бросить")').first().click({ force: true, timeout: 600 }); } catch (e) {} try { await h.waitForTimeout(250); } catch (e) { return; } } })().catch(() => {});
  await h.evaluate(() => { window.__bat = 0; const o = Net.handlers.bat; Net.handlers.bat = (d, l, p) => { window.__bat++; window.__lastBat = d.snap && d.snap.units ? d.snap.units.filter(u => u.name === 'Аргон').map(u => [u.x, u.y]) : 'nosnap'; return o(d, l, p); }; });
  const lab = await c.evaluate(() => [...document.querySelectorAll('.bt-panel [data-ba], .bt-panel button')].filter(e => e.offsetParent).map(e => (e.dataset.ba || '') + '|' + e.textContent.trim().slice(0, 24)));
  console.log('кнопки игрока:', JSON.stringify(lab));
  const panel = () => c.evaluate(() => (document.querySelector('.bt-panel') || {}).innerText?.replace(/\s+/g, ' ').slice(0, 260));
  const btn = (tx) => c.evaluate(tx => { const e = [...document.querySelectorAll('.bt-panel button, .bt-panel [data-ba], .bt-modal button, .bt-dice button')].filter(e => e.offsetParent).find(e => e.textContent.trim().toLowerCase() === tx.toLowerCase()); if (e) e.click(); return !!e; }, tx);
  const S = () => c.evaluate(() => { const u = Battle.S.units.find(u => u.name === 'Аргон'); return [u.x, u.y, Battle.S.units.filter(m => m.side !== u.side && m.hp > 0).map(m => [m.name, m.x, m.y, m.hp])]; });
  const HS = () => h.evaluate(() => { const u = Battle.S.units.find(u => u.name === 'Аргон'); return [u.x, u.y]; });
  console.log('старт', JSON.stringify(await S()));
  // движение: к ближайшему врагу
  const [ux, uy, mons] = await S(); const m0 = mons.sort((a, b) => Math.abs(a[1] - ux) + Math.abs(a[2] - uy) - Math.abs(b[1] - ux) - Math.abs(b[2] - uy))[0];
  await btn('Движение'); await c.waitForTimeout(300);
  const tx = ux + Math.sign(m0[1] - ux), ty = uy + Math.sign(m0[2] - uy);
  const cell = await c.evaluate(([x, y]) => { const e = document.querySelector(`[data-x="${x}"][data-y="${y}"]`) || document.querySelector(`.bt-cell[data-c="${x},${y}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, [tx, ty]);
  console.log('клетка', tx, ty, cell, 'панель:', await panel());
  if (cell) { await c.mouse.click(cell[0], cell[1]); await c.waitForTimeout(300); console.log('после тапа:', await panel()); await btn('Идти'); await c.waitForTimeout(1200); }
  console.log('позиция у игрока', JSON.stringify((await S()).slice(0, 2)), 'у ведущего', JSON.stringify(await HS()));
  await c.screenshot({ path: '/tmp/battle-shots/net_play2.png' });
  console.log('режим', await c.evaluate(() => Battle.UI.mode), 'панель:', await panel());
  console.log('диагностика: BN.active', await h.evaluate(() => Battle.Net.active), 'pid', pid, 'turnActive клиента', await c.evaluate(() => Battle.Net.turnActive), 'cur ведущего', await h.evaluate(() => Battle.S.cur || Battle.S.turn && Battle.S.turn.id || Object.keys(Battle.S).slice(0, 12).join()));
  console.log('bat-сообщений на ведущем', await h.evaluate(() => [window.__bat, JSON.stringify(window.__lastBat)]));
  console.log('клиент: turnActive', await c.evaluate(() => [Battle.Net.turnActive, Net.status, typeof Battle.UI.refresh]));
  await c.evaluate(() => { Battle.UI.refresh(); }); await c.waitForTimeout(1200); console.log('после ручного refresh bat на ведущем', await h.evaluate(() => [window.__bat, JSON.stringify(window.__lastBat)]));
  for (let k = 0; k < 2; k++) { await c.waitForTimeout(700); console.log('  t+' + (k * .7 + 1.2).toFixed(1) + 'c ведущий', JSON.stringify(await HS()), 'игрок', JSON.stringify((await S()).slice(0, 2))); }
  await c.evaluate(() => { const u = Battle.S.units.find(u => u.name === 'Аргон'), m = Battle.S.units.find(m => m.side === 'mon' && m.hp > 0); const free = [[0,-1],[1,0],[-1,0],[0,1]].map(([a,b]) => [u.x+a,u.y+b]).find(([x,y]) => x>=0&&y>=0&&x<7&&y<7&&!Battle.S.units.some(o => o.hp>0 && o.x===x && o.y===y)); m.x = free[0]; m.y = free[1]; Battle.UI.refreshNow(); }); await c.waitForTimeout(500);
  await btn('Отмена'); await c.waitForTimeout(300); await btn('Атака'); await c.waitForTimeout(400);
  console.log('панель перед выбором:', await panel());
  console.log('позиция у ведущего позже', JSON.stringify(await HS()), 'игрока', JSON.stringify((await S()).slice(0, 2)));
  await c.evaluate(() => { const e = document.querySelector('.bt-panel [data-ba="opt"]'); if (e) e.click(); }); await c.waitForTimeout(400);
  console.log('после выбора оружия:', await panel());
  // цель: тапаем по ближайшему гоблину
  const tgt = await c.evaluate(() => { const u = Battle.S.units.find(u => u.name === 'Аргон'); const m = Battle.S.units.filter(m => m.side === 'mon' && m.hp > 0).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0]; const e = document.querySelector(`[data-x="${m.x}"][data-y="${m.y}"]`); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, m.name, Math.hypot(a => 0)]; });
  await c.mouse.click(tgt[0], tgt[1]); await c.waitForTimeout(600);
  console.log('после тапа по цели', tgt[2], ':', await panel());
  await c.screenshot({ path: '/tmp/battle-shots/net_play4.png' });
  await c.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.getClientRects().length && /^Бросить$/i.test(e.textContent.trim())), null, { timeout: 8000 }).then(() => console.log('у игрока открылось окно броска'), () => console.log('✗ окно броска у игрока не открылось'));
  await c.screenshot({ path: '/tmp/battle-shots/net_play4.png' });
  console.log('у ведущего видно окно броска игрока:', await h.evaluate(() => [...document.querySelectorAll('.bt-dice, .bt-modal, [class*=dice]')].filter(e => e.getClientRects().length).map(e => e.className.slice(0, 30) + ':' + e.innerText.replace(/\s+/g, ' ').slice(0, 60)).join(' | ')));
  await h.screenshot({ path: '/tmp/battle-shots/net_play4h.png' });
  await c.locator('button:text-is("Бросить")').first().click({ force: true }); await c.waitForTimeout(3500);
  console.log('после броска панель игрока:', await panel());
  const aft = await c.evaluate(() => [...document.querySelectorAll('button')].filter(e => e.getClientRects().length).map(e => e.textContent.trim().slice(0, 14)).filter(Boolean)); console.log('кнопки после:', JSON.stringify(aft));
  await c.screenshot({ path: '/tmp/battle-shots/net_play5.png' });
  let idle = 0;
  for (let k = 0; k < 14 && idle < 2; k++) {
    const lbl = await c.evaluate(() => { const l = [...document.querySelectorAll('button')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.top >= 0 && r.bottom <= innerHeight && /^(Бросить|Далее.*|Продолжить|Ок)$/i.test(e.textContent.trim()) && !e.disabled; }); const e = l[l.length - 1]; if (e) { e.click(); return e.textContent.trim(); } return ''; });
    idle = lbl ? 0 : idle + 1; await c.waitForTimeout(2000);
  }
  console.log('goblin hp у игрока/ведущего:', await c.evaluate(() => Battle.S.units.filter(m => m.side === 'mon').map(m => m.hp).join()), '/', await h.evaluate(() => Battle.S.units.filter(m => m.side === 'mon').map(m => m.hp).join()));
  await btn('Конец хода'); await c.waitForTimeout(2500);
  console.log('после «Конец хода» режим игрока', await c.evaluate(() => Battle.UI.mode), 'ходили на ведущем:', await h.evaluate(() => hturns.join()));
  console.log('log ведущего:', await h.evaluate(() => (Battle.S.log || []).slice(-4).map(l => typeof l === 'string' ? l : l.t || JSON.stringify(l)).join(' / ').slice(0, 400)));
  await c.screenshot({ path: '/tmp/battle-shots/net_play6.png' }); await h.screenshot({ path: '/tmp/battle-shots/net_play6h.png' });
  console.log('hp гоблинов (клиент):', await c.evaluate(() => JSON.stringify(Battle.S.units.filter(m => m.side === 'mon').map(m => [m.name, m.hp, m.maxHp]))), 'лог клиента:', await c.evaluate(() => (Battle.S.log || []).slice(-3).map(l => typeof l === 'string' ? l : l.t || JSON.stringify(l)).join(' / ')));
  const fin = await Promise.all([c, h].map(p => p.evaluate(() => ({ dead: Battle.S.units.filter(m => m.side === 'mon' && m.hp <= 0).length, pos: (u => [u.x, u.y])(Battle.S.units.find(u => u.name === 'Аргон')), mp: Battle.S.units.find(u => u.name === 'Аргон').mp }))));
  ok('ход игрока: положение совпало у обоих', JSON.stringify(fin[0].pos) === JSON.stringify(fin[1].pos), fin);
  ok('удар по гоблину засчитан у игрока и у ведущего', fin[0].dead >= 1 && fin[1].dead >= 1, fin);
  await btn('Конец хода'); await c.waitForTimeout(2500);
  ok('после «Конец хода» ход перешёл дальше', await c.evaluate(() => Battle.UI.mode) !== 'hero' || (await h.evaluate(() => Battle.S.turn)) !== undefined);
  alive = false;

  ok('нет ошибок страниц', errs.length === 0, [...new Set(errs)].slice(0, 6));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close();
})();
