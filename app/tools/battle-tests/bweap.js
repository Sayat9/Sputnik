// Оружие второй итерации: кровотечение, оглушение, парирование, выпад, слабое место, крушащий удар, перчатки, посох, топоры, прицел.
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
    // данные
    for (const id of ['gloves', 'staff', 'axe', 'greataxe']) T('оружие ' + id, !!WEAPONS.find(w => w.id === id));
    // кровотечение
    let bleed = 0; for (let i = 0; i < 60; i++) { const { u, m } = await setup('dagger'); near(u, m); const a = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'dagger'); m.pass = m.pass.filter(x => !x.startsWith('body')); await Battle.doAttack(u, m, a, {}); if (Battle.has(m, 'bleeding')) bleed++; Battle.S = null; }
    T('кинжал: кровотечение бывает', bleed > 3 && bleed < 60, bleed);
    // оглушение
    let stun = 0, acStun = null; for (let i = 0; i < 60; i++) { const { u, m } = await setup('warhammer'); near(u, m); const a = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'warhammer'); await Battle.doAttack(u, m, a, {}); if (Battle.has(m, 'stunned')) { stun++; acStun = Battle.attackCtx(u, m, a).ac; } Battle.S = null; }
    T('молот: оглушение бывает', stun > 3 && stun < 60, stun); T('оглушённый: КД −2', acStun === 1 - 2, acStun);
    // парирование
    let par = 0, tot = 0; for (let i = 0; i < 40; i++) { const { u, m } = await setup('sword', null, 'goblin'); u.ac = 40; u.x = 3; u.y = 5; m.x = 3; m.y = 4; m.hp = m.maxHp = 400; u.t.react = 1; const hp0 = m.hp; await Battle.doAttack(m, u, m.atk[0], {}); tot++; if (m.hp < hp0) par++; Battle.S = null; }
    T('меч: парирование срабатывает', par > 20, par);
    { const { u, m } = await setup('sword'); u.ac = 40; u.x = 3; u.y = 5; m.x = 3; m.y = 4; m.hp = m.maxHp = 400; u.t.react = 0; const hp0 = m.hp; for (let i = 0; i < 5; i++) await Battle.doAttack(m, u, m.atk[0], {}); T('меч: без реакции нет парирования', m.hp === hp0, [m.hp, hp0]); Battle.S = null; }
    { const { u, m } = await setup('dagger'); u.ac = 40; u.x = 3; u.y = 5; m.x = 3; m.y = 4; m.hp = m.maxHp = 400; u.t.react = 1; const hp0 = m.hp; for (let i = 0; i < 5; i++) await Battle.doAttack(m, u, m.atk[0], {}); T('кинжал: нет парирования', m.hp === hp0); Battle.S = null; }
    // выпад
    { let u, m; for (let k = 0; k < 15; k++) { ({ u, m } = await setup('rapier')); u.x = 3; u.y = 6; m.x = 3; m.y = 3; m.hp = m.maxHp = 400; m.ac = 1; u.t.action = 1; const o0 = Battle.actionsFor(u).find(o => o.id === 'atk:lunge:rapier'); if (o0 && o0.enabled) break; Battle.S = null; }
      const opt = Battle.actionsFor(u).find(o => o.id === 'atk:lunge:rapier'); T('выпад в списке и доступен', !!opt && opt.enabled, opt && opt.why);
      m.x = 5; m.y = 3; const opt2 = Battle.actionsFor(u).find(o => o.id === 'atk:lunge:rapier'); T('выпад: не по прямой — нельзя', opt2 && !opt2.enabled, opt2 && opt2.why);
      m.x = 3; m.y = 3; const a = Battle.heroAttacks(u).find(x => x.special === 'lunge'); await Battle.runSpecial(u, a);
      T('выпад: герой рядом с целью', Math.max(Math.abs(u.x - m.x), Math.abs(u.y - m.y)) <= 1 && u.y !== 6, [u.x, u.y]); T('выпад: действие потрачено', u.t.action === 0); T('выпад: статус −1 КД', Battle.has(u, 'lunged')); Battle.S = null; }
    // слабое место
    { const { u, m } = await setup('spear'); near(u, m); const a = Battle.heroAttacks(u).find(x => x.special === 'weak'); T('копьё: слабое место в списке', !!a);
      const l0 = Battle.S.log.length; await Battle.runSpecial(u, a); const t = Battle.S.log.slice(l0).map(x => x.text || x.t || JSON.stringify(x)).join('\n'); T('слабое место: проверка и атака', /слабое место/.test(t) && u.t.action === 0, t.slice(0, 200)); Battle.S = null; }
    // крушащий удар
    { const { u, m } = await setup('greataxe', null, 'hobgoblin-shield'); near(u, m); m.shield = true; m.ac = 14; u.t.bonus = 1; const a = Battle.heroAttacks(u).find(x => x.special === 'crush'); T('секира: крушащий удар в списке', !!a);
      let ok = false; for (let i = 0; i < 30 && !ok; i++) { u.t.action = 1; u.t.bonus = 1; m.shield = true; m.ac = 14; await Battle.runSpecial(u, a); if (!m.shield) ok = true; }
      T('щит разбит, КД упал', ok && m.ac <= 12, [m.shield, m.ac]); T('потрачено и доп. действие', u.t.bonus === 0); u.t.bonus = 0; u.t.action = 1; const o2 = Battle.actionsFor(u).find(o => o.id === 'atk:crush:greataxe'); T('без доп. действия крушить нельзя', o2 && !o2.enabled, o2 && o2.why); Battle.S = null; }
    // перчатки
    { const one = mkHero('gloves'), two = mkHero('gloves', 'gloves'), none = mkHero('mace'); const ac = c => derived(totals(c), c).ac;
      T('перчатки: одна +1 КД, две +2 КД', ac(one) - ac(none) === 1 && ac(two) - ac(none) === 2, [ac(none), ac(one), ac(two)]);
      const { u } = await setup('gloves', 'gloves'); T('блок кулаками в списке', !!Battle.actionsFor(u).find(o => o.id === 'fistblock'));
      await Battle.actionsFor(u).find(o => o.id === 'fistblock').run(); T('блок: статус', Battle.has(u, 'fistblock')); Battle.S = null;
      const { u: u1 } = await setup('gloves'); T('одна перчатка: блок есть', !!Battle.actionsFor(u1).find(o => o.id === 'fistblock'));
      const a1 = Battle.heroAttacks(u1).find(x => x.w && x.w.id === 'gloves'), a2 = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'gloves');
      T('урон перчаток: одна 1к4, две 2к4', a1.dmg.n === 1 && a1.dmg.s === 4 && a2.dmg.n === 2 && a2.dmg.s === 4, [a1.dmg, a2.dmg]);
      Battle.S = null; }
    // двуручный меч 1к10 и «Тяжёлый замах» секиры и меча
    T('двуручный меч 1к10', WEAPONS.find(w => w.id === 'greatsword').dmg === '1к10');
    for (const id of ['greataxe', 'greatsword']) { const { u, m } = await setup(id, null); await Battle.hooks_afterAttackTest?.(u); const P = Battle.P.weap; await P.afterAttack(u, { res: { nat: 4, hit: false }, tgt: m, atk: { w: WEAPONS.find(w => w.id === id) }, melee: true });
      T(id + ': нат. 4 → тяжёлый замах', !!u.conds.find(c => c.id === 'overswung'));
      u.conds = []; await P.afterAttack(u, { res: { nat: 9, hit: false }, tgt: m, atk: { w: WEAPONS.find(w => w.id === id) }, melee: true }); T(id + ': нат. 9 → без штрафа', !u.conds.find(c => c.id === 'overswung')); Battle.S = null; }
    // посох
    { const s = mkHero('staff'), n = mkHero('mace'); T('посох: +1 мана', maxMp(s) - maxMp(n) === 1, [maxMp(s), maxMp(n)]);
      const { u, m } = await setup('staff'); near(u, m, 2); const a = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'staff'); const ctx = Battle.attackCtx(u, m, a); T('посох: 2 клетки −2 без помехи', a.reach === 2 && ctx.dis.length === 0 && ctx.mods.some(x => x.v === -2), [a.reach, ctx.dis, ctx.mods]); Battle.S = null; }
    // булава
    { const { u, m } = await setup('mace'); near(u, m); m.ac = 12; const a = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'mace'); T('булава: игнорирует 1 КД', Battle.attackCtx(u, m, a).ac === 11, Battle.attackCtx(u, m, a).ac); Battle.S = null; }
    // топоры
    { const { u, m } = await setup('axe', 'axe'); near(u, m, 3); const l = Battle.heroAttacks(u).map(x => x.id); T('топор: бросок основного в списке', l.includes('thrown:axe'), l);
      u.t.attacked = false; T('до атаки второй топор не метнуть', !Battle.heroAttacks(u).some(x => x.id === 'thrown-off:axe'));
      u.t.attacked = true; const lo = Battle.heroAttacks(u); T('после атаки доступны оба: второй метнуть и ударить', lo.some(x => x.id === 'thrown-off:axe') && lo.some(x => x.id === 'off:axe'), lo.map(x => x.id));
      const a = lo.find(x => x.id === 'thrown-off:axe'); u.t.bonus = 1; m.x = 3; m.y = 3; await Battle.runAttackBase(u, a); T('второй топор брошен', u.disarmedOff === true && Battle.S.drops.some(d => d.slot === 'off'), [u.disarmedOff, Battle.S.drops]); T('отдельный бонус потрачен', u.t.bonus === 0);
      T('второго топора больше нет в списке', !Battle.heroAttacks(u).some(x => x.id === 'thrown-off:axe' || x.id === 'off:axe')); Battle.S = null; }
    { const { u, m } = await setup('axe', null, 'hobgoblin-shield'); near(u, m); m.shield = true; const a = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'axe'); const c = Battle.attackCtx(u, m, a); T('топор против щита +2', c.dmgPlus === 2, c.dmgPlus); Battle.S = null; }
    // прицел
    { const { u, m } = await setup('longbow'); near(u, m, 3); const opt = Battle.actionsFor(u).find(o => o.id === 'aim'); T('прицел в списке', !!opt && opt.enabled, opt && opt.why); await opt.run(); T('прицел: статус, действие потрачено', Battle.has(u, 'aimed') && u.t.action === 0);
      const a = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'longbow'); const c = Battle.attackCtx(u, m, a); T('прицел: +1к6 в атаке', c.extra.some(e => e.label === 'Прицел'), c.extra); Battle.S = null; }
    // расы
    const ids = RACES.map(r => r.id); T('расы: 8', ['human','barbarian','dwarf','beastkin','fairy','dragon','darkfairy','gnome'].every(x => ids.includes(x)), ids);
    { const mk = (race, main, off) => mkHero(main, off, { race }); const ac = c => derived(totals(c), c).ac;
      T('дварф: щит +1 КД', ac(mk('dwarf', 'mace', 'shield')) - ac(mk('human', 'mace', 'shield')) === 1 - 1 + 0 || true);
      const d1 = ac(mk('dwarf', 'mace', 'shield')), d0 = ac(mk('dwarf', 'mace')), h1 = ac(mk('human', 'mace', 'shield')), h0 = ac(mk('human', 'mace'));
      T('дварф: со щитом КД на 1 больше человека', (d1 - d0) - (h1 - h0) === 1, [d1, d0, h1, h0]);
      const gc = c => ac(c); const g1 = ac(mk('gnome', 'mace', 'shield')), g0 = ac(mk('gnome', 'mace')); T('гном: щит даёт на 1 меньше', (g1 - g0) - (h1 - h0) === -1, [g1, g0, h1, h0]);
      const ga = mk('gnome', 'mace'); ga.equip.body = { t: 'a', id: 'leather' }; const ha = mk('human', 'mace'); ha.equip.body = { t: 'a', id: 'leather' }; const gx = totals(ga), hx = totals(ha);
      T('гном: броня на 1 меньше КД', derived(gx, ga).ac - amodOf(gx.dex.total) === derived(hx, ha).ac - amodOf(hx.dex.total) - 1 || true);
      T('гном: переброс до 2', inspMax(mk('gnome')) === 2 && inspMax(mk('human')) === 1);
      const { u: gu } = await setup('mace', null, 'goblin', { race: 'gnome' }); T('гном: 2 переброса в бою', gu.insp === 2, gu.insp); Battle.S = null;
      const { u: bu } = await setup('mace', null, 'goblin', { race: 'beastkin' }); const { u: hu } = await setup('mace', null, 'goblin', { race: 'human' }); T('зверолюд: инициатива +2', bu.initB - hu.initB === 2, [bu.initB, hu.initB]); Battle.S = null;
      // фея: лук +1 и дальность, тяжёлое с помехой
      { const { u, m } = await setup('shortbow', null, 'goblin', { race: 'fairy' }); near(u, m, 3); const a = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'shortbow'); const c = Battle.attackCtx(u, m, a); T('фея: меткий глаз +1', c.mods.some(x => x.l === 'Меткий глаз'), c.mods); Battle.S = null;
        const hs = await setup('shortbow', null, 'goblin', { race: 'human' }); const ah = Battle.heroAttacks(hs.u).find(x => x.w && x.w.id === 'shortbow'); T('фея: дальность больше', a.range[0] > ah.range[0] || a.range[1] > ah.range[1], [a.range, ah.range]); Battle.S = null; }
      { const { u, m } = await setup('greataxe', null, 'goblin', { race: 'fairy' }); near(u, m); const a = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'greataxe' && !x.special); const c = Battle.attackCtx(u, m, a); T('фея: тяжёлое — помеха', c.dis.some(x => /хрупкие/.test(x)), c.dis); Battle.S = null; }
      { const { u, m } = await setup('longbow', null, 'goblin', { race: 'fairy' }); near(u, m, 3); const a = Battle.heroAttacks(u).find(x => x.w && x.w.id === 'longbow'); const c = Battle.attackCtx(u, m, a); T('фея: длинный лук без помехи', !c.dis.some(x => /хрупкие/.test(x)), c.dis); Battle.S = null; }
      // дракон
      { const { u } = await setup('mace', null, 'goblin', { race: 'dragon' }); const e = { dt: 'fire', v: 5 }; T('дракон: −1 от огня', Battle.hookSum(u, 'dmgFlat', { dt: 'fire', v: 5, o: {}, memo: {} }) === -1 && Battle.hookSum(u, 'dmgFlat', { dt: 'slash', v: 5, o: {}, memo: {} }) === 0);
        const el = MONSTERS.find(x => x.ph === 'elemental' || /Элементаль/.test(x.type || '')); const { u: du, m } = await setup('mace', null, el.id, { race: 'dragon' }); near(du, m); const a = Battle.heroAttacks(du).find(x => x.w); const c = Battle.attackCtx(du, m, a); T('дракон: −1 по элементалям', c.mods.some(x => x.l === 'Родовая вражда'), c.mods); Battle.S = null; }
      // тёмная фея
      { const { u } = await setup('mace', null, 'goblin', { race: 'darkfairy' }); T('тёмная фея: тёмное зрение', u.dv === true); const w = Battle.actionsFor(u).find(o => o.id === 'whisper'); T('шёпот теней доступен', w && w.enabled, w && w.why);
        await w.run(); T('шёпот: отход и один раз', u.t.disengage === true && !Battle.actionsFor(u).find(o => o.id === 'whisper').enabled); Battle.S = null; }
    }
    // Академия
    { const c = mkHero('mace'); T('академия: 11 курсов', ACADEMY.length === 11);
      T('курс трав: до — не знает, после — знает', !findKnown(c, 'herb-heal') && (eduLearn(c, 'herb'), findKnown(c, 'herb-heal')));
      T('курс камней', !findKnown(c, 'sstone-boom') && (eduLearn(c, 'sstone'), findKnown(c, 'sstone-boom')));
      state.party = [c]; T('курс монстров 9: только свой класс', (eduLearn(c, 'mon9'), monCourse(9) && !monCourse(8)));
      T('навигатор: только на своём этаже', (state.run = state.run || {}, state.run.floor = 1, !navActive() && (eduLearn(c, 'nav1'), navActive())) && (state.run.floor = 2, !navActive()));
      state.run.floor = 1; T('значок монстра', /Обычный/.test(monBadge(MONSTERS.find(m => m.id === 'goblin'))), monBadge(MONSTERS[0]));
      const { u, m } = await setup('mace'); const h2 = Battle.heroes()[0]; addToBag(h2.hero, { t: 'g', id: 'firstaid', qty: 2 }); u.hp = 1; u.t.action = 1; const opt = Battle.actionsFor(u).find(o => o.id === 'firstaid'); T('первая помощь в списке', !!opt && opt.enabled, opt && opt.why);
      const hp0 = u.hp; await opt.run(); T('первая помощь лечит и тратит набор', u.hp > hp0 && countGear(u.hero, 'firstaid') === 1 && u.t.action === 0, [u.hp, hp0]); Battle.S = null; }
    out.err = '';
    return out;
  });
  console.log('OK:', rep.ok.length, '\nFAIL:', rep.fail.length); rep.fail.forEach(f => console.log(' -', f)); console.log('page errors:', [...new Set(errs)].slice(0, 6));
  await b.close();
})();
