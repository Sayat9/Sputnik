// Онлайн: ведущий и игрок на настоящем приложении (loopback): комната, роли, зеркало состояния, свои герои, ограничения.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' }); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
  await h.addInitScript(() => { localStorage.clear(); });
  await h.goto(URL + '?net=loopback'); await h.waitForTimeout(500);
  // ведущий: отряд из двух героев, в городе
  await h.evaluate(() => {
    const mk = (id, name) => { const c = Object.assign(clone(DEFAULT_CHAR), { id, name, example: false, level: 2 }); c.base = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }; c.equip = { main: { t: 'w', id: 'sword' } }; ensureKit(c); return c; };
    state.party = [mk('hA', 'Аргон'), mk('hB', 'Борис')]; state.townUnlocked = true; state.sessions = [{ n: 1, date: new Date().toISOString(), members: ['hA', 'hB'] }]; saveChar(); location.hash = 'town';
  });
  await h.waitForTimeout(300);
  const code = await h.evaluate(async () => { await loadNet(); return await NetGlue.startHost(); });
  ok('код комнаты', /^[A-Z0-9]{5}$/.test(code), code);
  // игрок
  await c.addInitScript(() => { localStorage.clear(); });
  await c.goto(URL + '?net=loopback&mode=player'); await c.waitForTimeout(800);
  ok('режим игрока', await c.evaluate(() => APP_MODE === 'player' && document.body.classList.contains('net-player')));
  ok('экран входа', await c.evaluate(() => !document.getElementById('netjoin').hidden));
  await c.fill('#nj-code', code); await c.fill('#nj-name', 'Вася'); await c.click('[data-nj="go"]');
  await c.waitForTimeout(1500);
  ok('игрок в сети', await c.evaluate(() => Net.status) === 'online', await c.evaluate(() => Net.status));
  ok('игрок видит отряд', await c.evaluate(() => state.party.length) === 2);
  ok('игрок следует за городом', await c.evaluate(() => location.hash) === '#town', await c.evaluate(() => location.hash));
  ok('ведущий видит игрока', await h.evaluate(() => Object.values(Net.players).filter(p => p.online).length) === 1);
  // назначение героя
  const pid = await h.evaluate(() => Object.keys(Net.players)[0]);
  await h.evaluate(pid => { state.party[0].owner = pid; saveChar(); NetGlue.pushAll(); }, pid);
  await c.waitForTimeout(700);
  ok('игрок видит своего героя', await c.evaluate(() => NetGlue.isMine(state.party[0])));
  // зеркало: ведущий меняет золото героя
  await h.evaluate(() => { state.party[1].gold = 77; saveChar(); });
  await c.waitForTimeout(700);
  ok('зеркало: золото чужого героя', await c.evaluate(() => state.party[1].gold) === 77, await c.evaluate(() => state.party[1].gold));
  // здание города зеркалится
  await h.evaluate(() => openBuilding('academy'));
  await c.waitForTimeout(1200);
  ok('игрок видит здание ведущего', await c.evaluate(() => !document.getElementById('townov').hidden && /Академия/.test(document.getElementById('townov').textContent)));
  await h.evaluate(() => Town.close());
  await c.waitForTimeout(800);
  ok('здание закрылось у игрока', await c.evaluate(() => document.getElementById('townov').hidden));
  // игрок меняет своего героя вне боя (выбрасывает паёк) → ведущий получает
  await c.evaluate(() => { openHero(state.party[0].id); });
  await c.waitForTimeout(300);
  const before = await h.evaluate(() => state.party[0].bag.length); globalThis.__b = before;
  await c.evaluate(() => { const c0 = state.party[0]; c0.bag.pop(); c0.gold = 5; saveChar(); });
  await c.waitForTimeout(800);
  ok('правка своего героя дошла до ведущего', await h.evaluate(() => state.party[0].gold) === 5 && await h.evaluate(() => state.party[0].bag.length) === before - 1);
  // игрок не может менять чужого и использовать функции ведущего
  await c.evaluate(() => openHero(state.party[1].id)); await c.waitForTimeout(200);
  ok('в меню героя нет кнопок ведущего', await c.evaluate(() => !document.querySelector('#heroov [data-hx="hp"],#heroov [data-hx="ess-add-toggle"],#heroov [data-hx="add-toggle"],#heroov [data-hadd]')));
  await c.evaluate(() => closeHero());
  ok('главный экран только просмотр', await c.evaluate(() => getComputedStyle(document.getElementById('view')).pointerEvents) === 'none');
  // переподключение и возврат сохранения
  await c.evaluate(() => { Net.link().close(); });
  await c.waitForTimeout(4500);
  ok('игрок переподключился', await c.evaluate(() => Net.status) === 'online', await c.evaluate(() => Net.status));
  ok('ведущий не потерял героя игрока', await h.evaluate(() => state.party[0].gold) === 5);
  // ведущий «откатился»: у героя игрока старые данные → при подключении вернётся версия игрока
  await h.evaluate(() => { state.party[0].gold = 0; state.party[0].nseq = 0; NetGlue.host.lastJ = {}; });
  await c.evaluate(() => { Net.link().close(); }); await c.waitForTimeout(4500);
  ok('сохранение игрока подтянулось', await h.evaluate(() => state.party[0].gold) === 5, await h.evaluate(() => state.party[0].gold));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length, errs.length ? [...new Set(errs)].slice(0, 6) : '');
  await b.close();
})();
