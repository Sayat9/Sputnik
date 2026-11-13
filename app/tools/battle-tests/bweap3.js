// 12.11: мана от Интеллекта, палочка и посох (магия за ману, только по прямой, «Крест»), моргенштерн («Замах»), цеп («цветок», «Притянуться»),
// тяжёлое оружие (попадание от Ловкости), метательные кинжалы, стальные стрелы, вес и размер, группы монстров, призраки и свет.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-weap2','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async () => {
    const out = { ok: [], fail: [] }; const T = (n, c, x) => (c ? out.ok : out.fail).push(n + (c ? '' : ' :: ' + (x === undefined ? '' : JSON.stringify(x))));
    const mkHero = (main, off, extra = {}, base) => {
      const c = Object.assign(clone(state.example), { id: 'h' + Math.random().toString(36).slice(2, 6), example: false, name: 'Тест', race: 'human', level: 3 }, extra);
      c.base = base || { str: 14, dex: 14, con: 14, int: 16, wis: 12, cha: 10 }; c.equip = { main: main ? (typeof main === 'string' ? { t: 'w', id: main } : main) : undefined, off: off ? { t: 'w', id: off } : undefined };
      delete c.bag; delete c.kit; delete c.hp; c.essences = []; try { ensureKit(c); } catch (e) {} c.mp = maxMp(c); return c;
    };
    const setup = async (main, off, mon = 'goblin', extra, base) => {
      state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false }; state.party = [mkHero(main, off, extra, base)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      const S = Battle.newBattle({ list: Array.isArray(mon) ? mon : [mon], zone: 'goblin', ambush: false, kind: 'hard', title: 'тест' }); S.opts.autoHeroes = true; Battle.placeHeroesDefault(S); Battle.placeMonsters(S); Battle.rollInitiative(); S.phase = 'fight';
      for (let y = 0; y < Battle.H; y++) for (let x = 0; x < Battle.W; x++) S.cells[y][x] = null;          // чистое поле
      const u = Battle.heroes()[0], m = Battle.mons()[0]; await Battle.startTurn(u); return { u, m, S, c: state.party[0] };
    };
    let pickCell = null;
    Battle.UI = { pickUnit: async o => (pickCell && o.objs && o.objs.length ? Battle.objAt(...o.objs[0].split(',').map(Number)) : Battle.byId(o.units[0])), toast() {}, fxText() {}, fxHit() {}, fxHeal() {}, fxMana() {}, refresh() {}, refreshNow() {}, animMove: async () => {}, animAttack: async () => {}, banner() {}, active: false, confirm: async () => false, choose: async o => o.options[0].id };
    const at = (u, x, y) => { u.x = x; u.y = y; }, dummy = m => { m.hp = m.maxHp = 400; m.ac = 1; m.prot = 0; m.pass = m.pass.filter(x => !x.startsWith('body')); };
    const mod = v => Math.floor((v - 10) / 2);
    const realRV = crypto.getRandomValues.bind(crypto), force = nat => { crypto.getRandomValues = a => { a[0] = nat - 1; return a; }; }, unforce = () => { crypto.getRandomValues = realRV; };
    // ---- мана
    { const c = mkHero('sword', null, { level: 1 }); const t = totals(c); T('мана 1 ур. = Интеллект', maxMp(c) === t.int.total, [maxMp(c), t.int.total]);
      c.level = 3; T('мана: +2 за уровень', maxMp(c) === t.int.total + 4, maxMp(c));
      c.mp = 0; const got = restMana(c); const exp = Math.ceil(maxMp(c) * (0.6 + 0.1 * mod(totals(c).wis.total))); T('отдых: мана от Мудрости (60 % + 10 % за модификатор)', got === exp, [got, exp]);
      const c2 = mkHero('sword', null, {}, { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }); c2.mp = 0; restMana(c2); T('Мудрость 18+: вся мана', c2.mp === maxMp(c2), [c2.mp, maxMp(c2)]); }
    // ---- каталог
    for (const id of ['wand', 'staff', 'morningstar', 'flail']) T('оружие в каталоге: ' + id, !!WEAPONS.find(w => w.id === id));
    T('описание: тяжёлое — попадание Ловкость, урон Сила', /попадание — Ловкость, урон — Сила/.test(weaponAbilText(WEAPONS.find(w => w.id === 'greatsword'))), weaponAbilText(WEAPONS.find(w => w.id === 'greatsword')));
    T('описание: палочка — Интеллект', weaponAbilText(WEAPONS.find(w => w.id === 'wand')) === 'Интеллект');
    T('вторая рука: к палочке — кинжал да, меч нет', offAllowed(WEAPONS.find(w => w.id === 'wand'), WEAPONS.find(w => w.id === 'dagger')) && !offAllowed(WEAPONS.find(w => w.id === 'wand'), WEAPONS.find(w => w.id === 'sword')));
    // ---- тяжёлое
    { const { u } = await setup('greatsword', null, 'goblin', {}, { str: 18, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }); const a = Battle.heroAttacks(u)[0];
      T('двуручный меч: попадание от Ловкости, урон от Силы', a.parts[0].l === 'Ловкость' && a.hit === mod(u.abil.dex) && a.dmg.b === mod(u.abil.str), [a.parts, a.hit, a.dmg]); Battle.S = null; }
    // ---- палочка
    { const { u, m } = await setup('wand', 'dagger'); dummy(m); at(u, 3, 6); at(m, 4, 2); const list = Battle.heroAttacks(u), a = list.find(x => x.magic), butt = list.find(x => x.butt), off = list.find(x => x.w && x.w.id === 'dagger');
      T('палочка: магический снаряд от Интеллекта, 1 мана, 6 клеток', a && a.hit === mod(u.abil.int) && a.mana === 1 && a.range[1] === 6 && a.dt === 'arcane' && a.dmg.s === 4, a && [a.hit, a.mana, a.range, a.dt]);
      T('палочка: удар вблизи от Ловкости', butt && butt.kind === 'melee' && butt.parts[0].l === 'Ловкость' && butt.dmg.b === 1 + mod(u.abil.dex), butt && [butt.parts, butt.dmg]);
      T('палочка + кинжал: кинжал отдельной атакой, без парного удара', !!off && !a.twin, list.map(x => x.id));
      T('палочка достаёт по диагонали', Battle.inAttackRange(u, m, a));
      const mp0 = u.mp, hp0 = m.hp; await Battle.runAttackBase(u, a); T('выстрел тратит 1 ману и ранит', u.mp === mp0 - 1 && m.hp < hp0, [mp0, u.mp, hp0, m.hp]);
      u.mp = 0; u.hero.mp = 0; u.t.action = 1; const opt = Battle.actionsFor(u).find(o => o.atk && o.atk.magic); T('без маны выстрел недоступен', opt && !opt.enabled && /маны/.test(opt.why), opt && opt.why);
      at(m, 3, 5); u.mp = 5; const ctx = Battle.attackCtx(u, m, a); T('враг вплотную — помеха, как у лука', ctx.dis.includes('враг вплотную'), ctx.dis); Battle.S = null; }
    // ---- посох
    { const { u, m } = await setup('staff', null, ['goblin', 'goblin', 'goblin']); const ms = Battle.mons(); ms.forEach(dummy); at(u, 3, 6); at(ms[0], 3, 2); at(ms[1], 4, 2); at(ms[2], 6, 0);
      const list = Battle.heroAttacks(u), a = list.find(x => x.magic && !x.special), plus = list.find(x => x.special === 'plus'), butt = list.find(x => x.butt);
      T('посох: луч 2к4 от Интеллекта, 8 клеток, только по прямой', a && a.dmg.n === 2 && a.dmg.s === 4 && a.range[1] === 8 && a.lines, a && [a.dmg, a.range, a.lines]);
      T('посох: по прямой — да, по диагонали и в стороне — нет', Battle.inAttackRange(u, ms[0], a) && !Battle.inAttackRange(u, ms[1], a) && !Battle.inAttackRange(u, ms[2], a));
      T('посох: удар вблизи 1к4 от Силы', butt && butt.dmg.s === 4 && butt.parts[0].l === 'Сила', butt && [butt.dmg, butt.parts]);
      T('«Крест» стоит двойную ману', plus && plus.mana === 2, plus && plus.mana);
      at(ms[1], 4, 2); at(ms[2], 2, 2); const hp = ms.map(x => x.hp), mp0 = u.mp; await Battle.runSpecial(u, plus);
      const d = ms.map((x, i) => hp[i] - x.hp); T('«Крест»: центр и два соседа ранены, мана −2', d[0] > 0 && d[1] > 0 && d[2] > 0 && u.mp === mp0 - 2, [d, mp0, u.mp]);
      T('«Крест»: соседи получают меньше центра', d[1] <= d[0] && d[2] <= d[0], d); Battle.S = null; }
    // ---- моргенштерн
    { const { u, m } = await setup('morningstar', 'shield', 'goblin', {}, { str: 16, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }); dummy(m); at(u, 3, 6); at(m, 3, 4);
      const list = Battle.heroAttacks(u), a = list.find(x => x.id === 'hand:morningstar'), sw = list.find(x => x.special === 'swing');
      T('моргенштерн: попадание от Ловкости, урон от Силы', a.parts[0].l === 'Ловкость' && a.dmg.b === mod(u.abil.str), [a.parts, a.dmg]);
      T('обычный удар на 2 клетки не достаёт, «Замах» достаёт', !Battle.inAttackRange(u, m, a) && Battle.inAttackRange(u, m, sw));
      const ctx = Battle.attackCtx(u, m, sw); T('«Замах»: −3 к броску, +2 урона', ctx.mods.some(x => x.v === -3) && sw.dmgBonus === 2, [ctx.mods, sw.dmgBonus]); Battle.S = null; }
    // ---- цеп
    { const { u, m, S } = await setup('flail', 'dagger', ['goblin', 'goblin']); const ms = Battle.mons(); ms.forEach(dummy); at(u, 3, 6); at(ms[0], 3, 2); at(ms[1], 0, 3);
      const list = Battle.heroAttacks(u), a = list.find(x => x.id === 'hand:flail'), off = list.find(x => x.w && x.w.id === 'dagger');
      T('цеп: попадание и урон от Ловкости, 1к4', a.parts[0].l === 'Ловкость' && a.dmg.b === mod(u.abil.dex) && a.dmg.s === 4, [a.parts, a.dmg]);
      T('цеп: 4 клетки по прямой', Battle.inAttackRange(u, ms[0], a)); T('цеп: 3 по диагонали — да', Battle.inAttackRange(u, ms[1], a));
      at(ms[1], 1, 3); T('цеп: не на линии — нет', !Battle.inAttackRange(u, ms[1], a)); at(ms[1], 3, 1); T('цеп: 5 по прямой — нет', !Battle.inAttackRange(u, ms[1], a));
      T('цеп + кинжал: без парного удара, кинжал отдельно', !a.twin && !!off);
      // задеть по пути
      at(ms[1], 3, 4); ms[1].ac = 1; const hp1 = ms[1].hp; const orig = 0; force(2); ms[0].ac = 30; await Battle.doAttack(u, ms[0], a, {}); unforce();
      T('цеп: низкий бросок задевает стоящего на пути', ms[1].hp < hp1, [hp1, ms[1].hp]);
      // притянуться
      at(ms[0], 0, 0); at(ms[1], 6, 0); S.cells[2][3] = 'rock'; const yk = Battle.heroAttacks(u).find(x => x.special === 'yank'); T('«Притянуться»: есть цель — камень на линии', yk && !yk.needTarget(u), yk && yk.needTarget(u));
      pickCell = true; force(18); u.t.action = 1; await Battle.runSpecial(u, yk); unforce();
      T('«Притянуться»: герой подлетел к камню (3 клетки)', u.x === 3 && u.y === 3, [u.x, u.y]);
      at(u, 3, 6); at(ms[1], 3, 5); const hpB = ms[1].hp, hu = u.hp; force(18); u.t.action = 1; await Battle.runSpecial(u, yk); unforce(); pickCell = null;
      T('«Притянуться»: врезался в стоящего на пути — оба ранены, герой на месте', ms[1].hp < hpB && u.hp < hu && u.y === 6, [hpB, ms[1].hp, hu, u.hp, u.y]); Battle.S = null; }
    // ---- метательные кинжалы и стрелы
    { const { u, m, c } = await setup('sword', null, 'goblin', {}, { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }); dummy(m); at(u, 3, 6); at(m, 3, 2);
      T('без кинжалов атаки броска нет', !Battle.heroAttacks(u).find(x => x.tdagger));
      addToBag(c, { t: 'g', id: 'throw-dagger', qty: 10 }); const a = Battle.heroAttacks(u).find(x => x.tdagger);
      T('бросок кинжала: 3 + Сила/8 клеток, от Ловкости, 1к6+1', a && a.range[1] === 3 + Math.floor(u.abil.str / 8) && a.hit === mod(u.abil.dex) && a.dmg.b === 1 + mod(u.abil.dex), a && [a.range, a.hit, a.dmg]);
      force(2); await Battle.doAttack(u, m, a, { onCommit: () => Battle.commitAttack(u, a, m) }); unforce();
      T('кинжал на 1–3 ломается', countGear(c, 'throw-dagger') === 9 && !Battle.S.drops.some(d => /dagger/.test(d.ammo || '')), [countGear(c, 'throw-dagger'), Battle.S.drops]);
      force(18); u.t.action = 1; await Battle.doAttack(u, m, a, { onCommit: () => Battle.commitAttack(u, a, m) }); unforce();
      T('высокий бросок: кинжал цел и лежит на поле, цель кровоточит', Battle.S.drops.some(d => d.ammo === 'throw-dagger') && !!Battle.has(m, 'bleeding'), [Battle.S.drops, m.conds.map(x => x.id)]);
      addToBag(c, { t: 'g', id: 'throw-dagger-steel', qty: 10 }); (c.ammoPref ||= {}).throw = 'throw-dagger-steel'; const a2 = Battle.heroAttacks(u).find(x => x.tdagger); T('стальные кинжалы по умолчанию: +1 урона', a2.dmg.b === a.dmg.b + 1, [a.dmg, a2.dmg]); Battle.S = null; }
    { const { u, m, c } = await setup('shortbow'); dummy(m); at(u, 3, 6); at(m, 3, 3); addToBag(c, { t: 'g', id: 'arrow', qty: 5 }); addToBag(c, { t: 'g', id: 'arrow-steel', qty: 5 }); (c.ammoPref ||= {}).bow = 'arrow-steel';
      const a = Battle.heroAttacks(u).find(x => x.ammo); T('стрел в сумме', Battle.arrowsLeft(u) === countGear(c, 'arrow') + 5, Battle.arrowsLeft(u));
      const n0 = countGear(c, 'arrow'); force(15); const r = await Battle.doAttack(u, m, a, { onCommit: () => Battle.commitAttack(u, a, m) }); unforce();
      T('по умолчанию ушла стальная стрела (+1 урона), обычные целы', countGear(c, 'arrow-steel') === 4 && countGear(c, 'arrow') === n0 && r.ctx.notes.includes('стальная стрела +1'), [countGear(c, 'arrow-steel'), countGear(c, 'arrow'), r.ctx.notes]);
      T('стальная стрела лежит на поле со своей меткой', Battle.S.drops.some(d => d.ammo === 'arrow-steel')); Battle.S = null; }
    // ---- группы, вес, размер
    const M = id => MONSTERS.find(x => x.id === id);
    T('группы: паук — звери/насекомые; плакальщица — нежить/призраки; пикси — элементали/феи; орк — гуманоиды/орки', monCat(M('web-spider')) === 'beast' && monSub(M('web-spider')) === 'bug' && monCat(M('mourner')) === 'undead' && monSub(M('mourner')) === 'ghost' && monSub(M('pixie')) === 'fairy' && monSub(M('orc-spear')) === 'orc' && monSub(M('goblin')) === 'goblin' && monSub(M('crow')) === 'bird', [monCat(M('web-spider')), monSub(M('web-spider')), monSub(M('mourner')), monSub(M('pixie')), monSub(M('orc-spear')), monSub(M('crow'))]);
    T('у всех монстров есть группа и подгруппа там, где она положена', MONSTERS.every(m => KIND_RU[monCat(m)] && (!["humanoid", "beast", "undead", "elemental"].includes(monCat(m)) || SUB_RU[monSub(m)])), MONSTERS.filter(m => !(KIND_RU[monCat(m)] && (!["humanoid", "beast", "undead", "elemental"].includes(monCat(m)) || SUB_RU[monSub(m)]))).map(m => m.id));
    T('вес и размер: крыса очень лёгкая и крошечная, колосс очень тяжёлый, Кель гигантский', monMass(M('rat')).wt === 1 && monMass(M('rat')).sz === 1 && monMass(M('crystal-colossus')).wt === 5 && monMass(M('kel-worm')).sz === 5, [monMass(M('rat')), monMass(M('crystal-colossus')), monMass(M('kel-worm'))]);
    { const { u, m } = await setup('sword', null, ['rat', 'crystal-colossus', 'hobgoblin', 'dark-bear']); const [rat, col, hob, bear] = Battle.mons();
      const f = [rat, col, hob, bear].map(x => Battle.forceVs(x)); T('проверки: крыса +8, колосс не сдвинуть, хобгоблин 0', f[0].mod === 8 && !f[0].immune && f[1].immune && f[2].mod === 0, f.map(x => [x.mod, x.immune]));
      at(u, 3, 6); at(col, 3, 4); const n = await Battle.push(col, u.x, u.y, 1); T('очень тяжёлого толчок не двигает', n === 0 && col.y === 4, [n, col.y]);
      at(hob, 5, 5); at(u, 5, 6); const n2 = await Battle.push(hob, u.x, u.y, 1); T('среднего — двигает', n2 === 1, n2); Battle.S = null; }
    { const { u, m } = await setup('sword', null, ['mourner', 'skeleton']); const [gh, sk] = Battle.mons(); gh.hp = gh.maxHp = 100; sk.hp = sk.maxHp = 100; sk.vuln = []; sk.resist = []; sk.pass = [];
      const a1 = await Battle.applyDamage(u, gh, [{ v: 10, dt: 'slash' }], {}); const a2 = await Battle.applyDamage(u, gh, [{ v: 10, dt: 'arcane' }], {});
      T('призрак: физический урон не проходит, магический — да', a1.total === 0 && a2.total === 10, [a1.total, a2.total]);
      const a3 = await Battle.applyDamage(u, sk, [{ v: 10, dt: 'radiant' }], { pure: true }); T('нежить: урон светом ×1,5', a3.total === 15, a3.total);
      T('нежить и элементали не кровоточат', Battle.noBlood(sk) && Battle.noBlood(gh)); Battle.S = null; }
    return out;
  });
  console.log(rep.ok.map(x => '  ✓ ' + x).join('\n')); if (rep.fail.length) console.log(rep.fail.map(x => '  ✗ ' + x).join('\n'));
  if (errs.length) console.log('ОШИБКИ:\n' + errs.join('\n'));
  console.log(`bweap3: ${rep.ok.length} ок, ${rep.fail.length} провалов, ошибок ${errs.length}`);
  await b.close(); process.exit(rep.fail.length || errs.length ? 1 : 0);
})();
