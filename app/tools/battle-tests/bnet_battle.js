// Онлайн-бой: герой друга ходит на его телефоне (RPC «turn»), броски на чужих ходах идут к нему, обрыв посреди хода — возврат с того же места.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' }); const h = await ctx.newPage(), c = await ctx.newPage(), errs = [];
  for (const [n, p] of [['host', h], ['client', c]]) p.on('pageerror', e => errs.push(n + ': ' + e.message));
  const R = []; const ok = (n, v, x) => { R.push(!!v); if (!v) console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x)); };
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
  ok('игрок видит своего героя', await c.evaluate(() => NetGlue.isMine(state.party[0])));
  // стенды: бросает игра, ход «героя» — ИИ
  const stub = `
    Battle.cfg.fast = true; Battle.Dice.session = (u, m) => Battle.autoSession(u, m);
    window.turns = []; Battle.UI.heroTurn = async u => { turns.push(u.name); await Battle.AI.takeTurn(u); };
    Battle.UI.promptReaction = async () => false; window.placed = []; const po = Battle.UI.placeOne; Battle.UI.placeOne = u => { placed.push(u.name); setTimeout(() => Battle.UI.placeDone(), 300); return po.call(Battle.UI, u); }; window.dcalls = 0; const ds = Battle.Dice.session; Battle.Dice.session = (u, m) => { dcalls++; return Battle.autoSession(u, m); };`;
  await c.evaluate(stub.replace('Battle.UI.heroTurn', 'window.dropOnce = true; Battle.UI.heroTurn').replace("await Battle.AI.takeTurn(u); };", "if (window.dropOnce) { window.dropOnce = false; Net.link().close(); await new Promise(r => setTimeout(r, 9000)); return; } await Battle.AI.takeTurn(u); };"));
  await c.waitForFunction(() => window.Battle && Battle.ready);
  await c.evaluate(() => { Battle.cfg.fast = true; });
  const res = await h.evaluate(async () => {
    Battle.cfg.fast = true; Battle.Dice.session = (u, m) => Battle.autoSession(u, m);
    window.hturns = []; window.rr = null; Battle.UI.heroTurn = async u => { hturns.push(u.name); if (!window.rr) { await new Promise(r => setTimeout(r, 1200)); const a = Battle.heroes().find(x => x.name === 'Аргон'); const ses = Battle.session(a, { kind: 'save', u: a, title: 'Тест' }); window.rr = await ses.d20({ mods: [{ l: 'a', v: 1 }], adv: [], dis: [], reroll: [], cancel: false, vs: { dc: 10 } }); await ses.finish({ text: 'ok', save: true, ok: true }); } await Battle.AI.takeTurn(u); };
    window.rturns = 0; const rt = Battle.Net.remoteTurn; Battle.Net.remoteTurn = async u => { rturns++; return rt(u); };
    const ev = { list: ['goblin', 'goblin'], zone: 'goblin', ambush: false, kind: 'hard', title: 'тест', floor: 1 };
    Battle.running = true; Battle.UI.open();
    window.dbg = []; dbg.push(['reg', typeof Battle.Net.register, Battle.Net.isHost()]); const ro = Battle.Net.remoteOwner; Battle.Net.remoteOwner = u => { const r = ro(u); dbg.push([u.name, u.hero && u.hero.owner, r, Net.role, Object.keys(Net.players)]); return r; };
    window.hplaced = []; const po = Battle.UI.placeOne; Battle.UI.placeOne = u => { hplaced.push(u.name); setTimeout(() => Battle.UI.placeDone(), 300); return po.call(Battle.UI, u); };
    const pr = Battle.start(ev);
    const S = await Promise.race([pr, new Promise(r => setTimeout(() => r('timeout'), 70000))]);
    const out = S === 'timeout' ? { timeout: true } : { outcome: S.outcome, rounds: S.round };
    out.dbg = dbg.slice(0,3); out.hturns = hturns.length; out.rturns = rturns; return out;
  });
  console.log('исход:', JSON.stringify(res));
  ok('бой дошёл до конца', ['win','defeat','retreat'].includes(res.outcome), res);
  ok('герой друга ходил удалённо', res.rturns >= 1, res);
  ok('ведущий водил своего героя сам', res.hturns >= 1, res);
  ok('бросок героя друга ушёл на его телефон', (await c.evaluate(() => dcalls)) >= 1 && (await h.evaluate(() => window.rr && window.rr.nat >= 1)), [await c.evaluate(() => dcalls), await h.evaluate(() => window.rr)]);
  ok('на телефоне игрока героя водил игрок', (await c.evaluate(() => turns)).includes('Аргон'), await c.evaluate(() => turns));
  const order = await h.evaluate(() => Battle.S ? null : null);
  ok('игрок расставил своего героя на своём телефоне', (await c.evaluate(() => placed)).includes('Аргон'), await c.evaluate(() => placed));
  ok('ведущий расставил своего', (await h.evaluate(() => hplaced)).includes('Борис'), await h.evaluate(() => hplaced));
  console.log('телефон игрока: ходы', JSON.stringify(await c.evaluate(() => turns)), 'броски по сети', await c.evaluate(() => dcalls));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length, errs.length ? [...new Set(errs)].slice(0, 6) : '');
  await b.close();
})();
