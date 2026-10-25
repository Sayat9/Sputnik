// Бой: «Смена оружия» (основное действие, оружие из рюкзака), штраф двух двуручных у варвара, лук с кинжалом.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async () => {
    const out = { ok: [], fail: [] }; const T = (n, c, x) => (c ? out.ok : out.fail).push(n + (c ? '' : ' :: ' + (x === undefined ? '' : JSON.stringify(x))));
    const mkHero = (main, off, extra = {}) => {
      const c = Object.assign(clone(state.example), { id: 'h' + Math.random().toString(36).slice(2, 6), example: false, name: 'Тест', race: 'human', level: 3 }, extra);
      c.base = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }; c.equip = { main: main ? { t: 'w', id: main } : undefined, off: off ? { t: 'w', id: off } : undefined };
      delete c.bag; delete c.kit; delete c.hp; c.essences = []; try { ensureKit(c); } catch (e) {} addToBag(c, { t: 'g', id: 'arrow', qty: 20 }); c.mp = maxMp(c); return c;
    };
    const setup = async (main, off, mon = 'goblin', extra) => {
      state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false }; state.party = [mkHero(main, off, extra)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      const S = Battle.newBattle({ list: [mon], zone: 'goblin', ambush: false, kind: 'hard', title: 'тест' }); S.opts.autoHeroes = true; Battle.placeHeroesDefault(S); Battle.placeMonsters(S); Battle.rollInitiative(); S.phase = 'fight';
      const u = Battle.heroes()[0], m = Battle.mons()[0]; await Battle.startTurn(u); return { u, m, S };
    };
    Battle.UI = { pickUnit: async o => Battle.byId(o.units[0]), toast() {}, fxText() {}, fxHit() {}, refresh() {}, active: false, confirm: async () => false };
    const amodOf = v => Math.floor((v - 10) / 2); const near = (u, m, d = 1) => { u.x = 3; u.y = 5; m.x = 3; m.y = 5 - d; m.hp = m.maxHp = 400; m.ac = 1; m.size = 1; };
    const { u, m, S } = await setup('sword', null);
    const c = u.hero; addToBag(c, { t: 'w', id: 'greataxe', qty: 1 });
    const a = Battle.weapActions(u).find(x => x.id === 'swapweapon');
    T('действие «Смена оружия» есть', a && a.enabled, a);
    Battle.UI.choose = async o => o.options[0].id;
    const act0 = u.t.action; await a.run();
    T('в руке секира', c.equip.main.id === 'greataxe', c.equip.main);
    T('меч ушёл в рюкзак', c.bag.some(e => e.id === 'sword'));
    T('потрачено основное действие', act0 === 1 && u.t.action === 0);
    T('действие недоступно без основного действия', !Battle.weapActions(u).find(x => x.id === 'swapweapon').enabled);
    // варвар: два двуручных — большой штраф к Ловкости
    const b = Object.assign({}, c, { race: 'barbarian', giantGrip: true, equip: { main: { t: 'w', id: 'greatsword' }, off: { t: 'w', id: 'greataxe' } }, base: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 } });
    const one = Object.assign({}, b, { equip: { main: { t: 'w', id: 'greatsword' } } });
    T('два двуручных: Ловкость ещё −4', totals(one).dex.total - totals(b).dex.total === 4, [totals(one).dex.total, totals(b).dex.total]);
    // лук и кинжал: вторая рука не очищается
    const bow = Object.assign({}, c, { race: 'human', giantGrip: false, equip: { main: { t: 'w', id: 'shortbow' }, off: { t: 'w', id: 'dagger' } } });
    T('лук не считается двуручным для слота', twoHanded(bow) === false);
    return out;
  });
  for (const k of rep.ok) console.log('  ✓', k); for (const k of rep.fail) console.log('  ✗', k);
  console.log('errs:', errs.length ? errs.slice(0, 3) : 'нет');
  await b.close(); process.exit(rep.fail.length || errs.length ? 1 : 0);
})();
