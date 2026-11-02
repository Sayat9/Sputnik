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


  // Борису тоже назначим игрока-владельца-призрака нет; Аргон — игрока. Массовый спасбросок по обоим героям.
  const info = await h.evaluate(() => ({ owners: Battle.S.units.filter(u => u.side === 'hero').map(u => [u.name, u.hero && u.hero.owner]), auto: Battle.S.opts.autoHeroes, players: Object.keys(Net.players) }));
  console.log('герои/владельцы', JSON.stringify(info));
  await h.evaluate(() => { window.__msDone = false; Battle.massSave(Battle.S.units.filter(u => u.side === 'hero'), 'dex', 30, { title: 'Тест-ловушка' }).then(r => { window.__msDone = r.length; }); });
  await c.waitForFunction(() => !!document.querySelector('.bd-ov:not([hidden]):not(.watch)'), null, { timeout: 20000 }).catch(() => {});
  const cv = await c.evaluate(() => ({ own: !!document.querySelector('.bd-ov:not([hidden]):not(.watch)'), sum: !!document.getElementById('bnsum') && !document.getElementById('bnsum').hidden }));
  const hv = await h.evaluate(() => ({ sum: !!document.querySelector('.bt-sum') }));
  console.log('ведущий:', JSON.stringify(hv), 'игрок:', JSON.stringify(cv));
  ok('у игрока своё окно спасброска его героя (не общая сводка)', cv.own && !cv.sum, cv);
  ok('у ведущего нет общей сводки', !hv.sum, hv);
  for (let k = 0; k < 20; k++) {          // игрок проходит своё окно: «Бросить»/«Пропустить», затем «Далее»
    const done = await h.evaluate(() => window.__msDone); if (done) break;
    const lbl = await c.evaluate(() => { const bs = [...document.querySelectorAll('.bd-ov:not(.watch) button')].filter(e => e.getClientRects().length && !e.disabled); for (const re of [/^Далее/, /^ОК/, /^Принять/, /^Пропустить/, /^Бросить/]) { const b = bs.find(e => re.test(e.textContent.trim())); if (b) return b.textContent.trim(); } return null; });
    if (lbl) await c.locator('.bd-ov:not(.watch) button', { hasText: lbl }).first().click({ force: true }).catch(() => {});
    await c.waitForTimeout(700);
    if (k % 5 === 4) console.log('  кнопки игрока:', await c.evaluate(() => [...document.querySelectorAll('.bd-ov button')].filter(e => e.getClientRects().length).map(e => e.textContent.trim().slice(0, 20)).join('|')), 'ведущий ждёт:', await h.evaluate(() => [window.__msDone, (Battle.S.log || []).slice(-2).map(l => l.t || l.text).join(' / ')]));
  }
  { const md = await h.evaluate(() => [window.__msDone, Battle.S.units.filter(u => u.side === 'hero').length]); ok('после решения игрока ход продолжается (спасброски вернулись)', md[0] === md[1] && md[0] > 0, md); }
  await c.evaluate(() => Battle.UI.endTurn && Battle.UI.endTurn()); await h.waitForTimeout(500);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length, errs.slice(0, 3));
  await b.close(); process.exit(0);
})();
