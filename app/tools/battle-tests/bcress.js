// 14.11: эссенции Кристального рудника у героя — каждая пассивка и активка в настоящем бою + «Камертон резонанса».
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  p.on('framenavigated', f => { if (f === p.mainFrame()) errs.push('nav ' + f.url()); });
  const r = await p.evaluate(async () => { window.__o = {};
    const o = window.__o; const mk = (id, n, w) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 6, rank: 7 }); c.base = { str: 14, dex: 14, con: 14, int: 12, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: w } }; delete c.bag; delete c.kit; delete c.hp; ensureKit(c); c.gold = 50; return c; };
    state.party = [mk('p0', 'Аргон', 'dagger'), mk('p1', 'Борис', 'longbow')]; newRun(); await loadBattle(); const B = Battle; B.cfg.fast = true;
    const mkS = list => { const S = B.newBattle({ list, zone: 'stone', floor: 2, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); B.rollInitiative(); S.phase = 'fight'; B.running = true; return S; };
    const heroes = S => S.units.filter(x => x.hero), mon = S => S.units.find(x => x.side === 'mon');
    const fail = () => { const g = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = a => { a.fill(0); return a; }; return () => { crypto.getRandomValues = g; }; };
    const ctl = { commit() {} }, give = (u, id) => { if (!u.pass.includes(id)) u.pass.push(id); };
    const near = (S, h, m, dx, dy) => { m.x = Math.min(B.W - 1, Math.max(0, h.x + dx)); m.y = Math.min(B.H - 1, Math.max(0, h.y + dy)); };
    let S, h, h2, m, un, ctx;
    // рудокоп: 3 врем. ОЗ, раскол киркой −1 Защиты (до −2)
    S = mkS(['hobgoblin']); [h] = heroes(S); m = mon(S); give(h, 'petrified-miner'); h.temp = 0; B.P['petrified-miner'].turnStart(h); o.minerTemp = h.temp === 3;
    near(S, h, m, 0, -1); m.ac = 1; for (let i = 0; i < 3; i++) await B.A['petrified-miner'].run(h, { unit: m }, ctl); const cr = B.has(m, 'cracked'); o.minerCrack = !!cr && cr.data.prot === -2;
    // крыса: кинжал игнорирует 1 Защиты, лук — нет; отскок 2 клетки
    give(h, 'crystal-rat'); ctx = { atk: B.attacksOf(h)[0], mods: [], adv: [], dis: [], extra: [] }; B.P['crystal-rat'].attackMods(h, ctx); const c2 = { atk: { kind: 'ranged', w: { props: [] }, n: 'Лук' }, mods: [] }; B.P['crystal-rat'].attackMods(h, c2); o.ratPierce = ctx.protIgnore === 1 && !c2.protIgnore;
    const cells = B.A['crystal-rat'].tgt(h).cells; const x0 = h.x, y0 = h.y; await B.A['crystal-rat'].run(h, { cell: cells[cells.length - 1] }, ctl); o.ratHop = (h.x !== x0 || h.y !== y0) && Math.max(Math.abs(h.x - x0), Math.abs(h.y - y0)) <= 2;
    // пони: рывок и 1 урона всем в 3×3
    S = mkS(['hobgoblin', 'hobgoblin']); [h, h2] = heroes(S); const ms = S.units.filter(x => x.side === 'mon'); give(h, 'mine-pony'); h.x = 2; h.y = 6; ms[0].x = 2; ms[0].y = 2; ms[1].x = 3; ms[1].y = 3; h2.x = 6; h2.y = 6;
    const hp0 = ms.map(x => x.hp); await B.A['mine-pony'].run(h, { cell: [2, 3] }, ctl); o.ponyDash = h.x === 2 && h.y === 3 && ms[0].hp === hp0[0] - 1 && ms[1].hp === hp0[1] - 1;
    // кузнец: +1 урона; наковальня союзнику +1к6 огнём
    give(h, 'crystal-smith'); ctx = { atk: { kind: 'melee' }, extra: [], mods: [] }; B.P['crystal-smith'].attackMods(h, ctx); o.smithPlus = ctx.dmgPlus === 1;
    h2.x = h.x + 1; h2.y = h.y; await B.A['crystal-smith'].run(h, { unit: h2 }, ctl); ctx = { atk: { kind: 'melee' }, extra: [], mods: [] }; for (const id of h2.pass) if (B.P[id] && B.P[id].attackMods) B.P[id].attackMods(h2, ctx); o.anvil = !!B.has(h2, 'anvil') && ctx.extra.some(e => e.dt === 'fire');
    // обвальник: стоял — +1 Защиты; обвал: метка и удар в начале хода
    S = mkS(['hobgoblin']); [h] = heroes(S); m = mon(S); give(h, 'rockfall'); B.P.rockfall.turnStart(h); await B.P.rockfall.turnEndAsync(h); o.rockChest = !!B.has(h, 'stonechest');
    near(S, h, m, 0, -3); const rh = m.hp; await B.A.rockfall.run(h, { cell: [m.x, m.y] }, ctl); o.rockMark = !!h.rfMark && S.zones.some(z => z.id === 'rf' + h.id); await B.P['body:rockfall'].turnStartAsync(h); o.rockFall = m.hp < rh && !h.rfMark;
    // трактирщица и алхимик: зелья себе
    S = mkS(['hobgoblin']); [h] = heroes(S); m = mon(S); un = fail(); const pb0 = B.potionBonus(h, h); give(h, 'crystal-innkeeper'); const pb1 = B.potionBonus(h, h); give(h, 'crystal-alchemist'); const pb2 = B.potionBonus(h, h); const pbOther = B.potionBonus(h, heroes(S)[1]); un();
    o.potions = pb1 - pb0 === 2 && pb2 - pb1 >= 3 && pbOther === B.potionBonus({ pass: [] }, null);
    near(S, h, m, 0, -3); const ih = m.hp; un = fail(); await B.A['crystal-innkeeper'].run(h, { unit: m }, ctl); un(); o.bottle = m.hp < ih && !!B.has(m, 'bottled');
    // надсмотрщик: окрик союзнику в 3 клетках; подогнать — +1 клетка и +2 урона
    S = mkS(['hobgoblin']); [h, h2] = heroes(S); give(h, 'crystal-overseer'); h2.x = h.x + 1; h2.y = h.y; ctx = { mods: [], adv: [], dis: [] }; B.P['crystal-overseer'].attackAura(h, { att: h2, ctx }); o.shout = ctx.mods.some(x => x.l === 'Окрик');
    const sp0 = B.speedOf(h2); await B.A['crystal-overseer'].run(h, { unit: h2 }, ctl); ctx = { mods: [] }; for (const id of h2.pass) if (B.P[id] && B.P[id].attackMods) B.P[id].attackMods(h2, ctx); o.urge = B.speedOf(h2) === sp0 + 1 && ctx.dmgPlus === 2;
    // осколочный охотник: дальние +1 и −1 Защиты; сквозной выстрел по линии
    give(h, 'shard-hunter'); ctx = { atk: { kind: 'ranged' } }; B.P['shard-hunter'].attackMods(h, ctx); o.shard = ctx.dmgPlus === 1 && ctx.protIgnore === 1;
    m = mon(S); m.x = h.x; m.y = h.y - 2; const sh = m.hp; await B.A['shard-hunter'].run(h, { cell: [h.x, h.y - 1] }, ctl); o.pierceShot = m.hp < sh;
    // Горн: удары наращивают Защиту до +3; раскол земли — урон и сбивание
    S = mkS(['hobgoblin']); [h] = heroes(S); m = mon(S); give(h, 'foreman-gorn'); for (let i = 0; i < 5; i++) await B.applyDamage(m, h, [{ v: 1, dt: 'slash', label: 't' }], { src: m, ctx: {} }); const shl = B.has(h, 'crystalshell'); o.shell = !!shl && shl.data.prot === 3;
    near(S, h, m, 0, -1); const gh = m.hp; un = fail(); await B.A['foreman-gorn'].run(h, {}, ctl); un(); o.quake = m.hp < gh && !!B.has(m, 'prone');
    // поющий кристалл: трата 3+ маны — волна 1к8 в 2 клетках (раз в ход), невидимых тоже; высокая нота
    S = mkS(['hobgoblin', 'hobgoblin']); [h] = heroes(S); const [ma, mb] = S.units.filter(x => x.side === 'mon'); give(h, 'singing-crystal'); h.mp = h.maxMp = 20; near(S, h, ma, 0, -1); near(S, h, mb, 1, -2); B.addStatus(mb, 'hidden', { k: Infinity, data: { invis: true } });
    const a0 = ma.hp, b0 = mb.hp; B.setMp(h, h.mp - 3); await B.flushQueue(); o.wave = ma.hp < a0 && mb.hp < b0; const a1 = ma.hp; B.setMp(h, h.mp - 3); await B.flushQueue(); o.waveOnce = ma.hp === a1; const a2 = ma.hp; B.setMp(h, h.mp - 2); await B.flushQueue(); o.waveSmall = ma.hp === a2;
    const n0 = ma.hp; un = fail(); await B.A['singing-crystal'].run(h, {}, ctl); un(); o.highNote = ma.hp < n0 && !!B.has(ma, 'stunned');
    // первородный кристалл: первый урон за раунд вдвое; кристаллизация — 3к8 и заключение
    S = mkS(['hobgoblin']); [h] = heroes(S); m = mon(S); give(h, 'primal-crystal'); h.hp = h.maxHp = 60; await B.applyDamage(m, h, [{ v: 10, dt: 'slash', label: 't' }], { src: m }); const d1 = 60 - h.hp; await B.applyDamage(m, h, [{ v: 10, dt: 'slash', label: 't' }], { src: m }); const d2 = 60 - h.hp - d1; o.skin = d1 < d2 && d1 <= 5;
    { S.round++; const hp1 = h.hp, a = B.attacksOf(m)[0]; h.ac = 1; let r = null; for (let i = 0; i < 6 && !(r && r.hit); i++) r = await B.doAttack(m, h, a, {}); const first = hp1 - h.hp; o.skinViaAttack = r && r.hit && h.skinRound === S.round; }
    near(S, h, m, 0, -3); const ph = m.hp; un = fail(); await B.A['primal-crystal'].run(h, { unit: m }, ctl); un(); o.encase = m.hp < ph && !!B.has(m, 'encased');
    // жадность: звон монет — помеха; торг в городе — цены
    near(S, h, m, 0, -2); B.removeStatus && B.removeStatus(m, 'encased'); un = fail(); await B.A['crystal-greed'].run(h, { unit: m }, ctl); un(); o.chime = !!B.has(m, 'coinchime') && B.D.status.coinchime.atkDis;
    // алхимик: раствор 3×3 — кислота и −1 клетка
    S = mkS(['hobgoblin']); [h] = heroes(S); m = mon(S); near(S, h, m, 0, -3); const sp1 = B.speedOf(m), ah = m.hp; un = fail(); await B.A['crystal-alchemist'].run(h, { cell: [m.x, m.y] }, ctl); un(); o.solution = m.hp < ah && B.speedOf(m) === Math.max(0, sp1 - 1);
    // Камертон резонанса: звук от носителя — стаки; действие n + n×1к4, раз за бой
    S = mkS(['hobgoblin']); [h] = heroes(S); m = mon(S); h.hero.equip.charm = { t: 'g', id: 'resonance-fork' }; m.hp = m.maxHp = 200;
    await B.applyDamage(h, m, [{ v: 1, dt: 'thunder', label: 'з' }], { src: h }); await B.applyDamage(h, m, [{ v: 1, dt: 'thunder', label: 'з' }], { src: h }); await B.applyDamage(h, m, [{ v: 1, dt: 'slash', label: 'р' }], { src: h }); o.stacks = m.forkStacks === 2;
    h.t.action = 1; let acts = B.weapActions(h), fa = acts.find(a => a.id === 'fork'); const fh = m.hp; o.forkBtn = !!fa && fa.enabled; await fa.run(); const dealt = fh - m.hp; o.forkDmg = dealt >= 4 && dealt <= 10 && m.forkStacks === 0;
    h.t.action = 1; acts = B.weapActions(h); fa = acts.find(a => a.id === 'fork'); o.forkOnce = !fa;
    B.running = false; B.S = null;
    // вне боя: пони +10 кг, жадность — цены магазина
    const c = state.party[0], cap0 = load(c).cap; c.essences = ['mine-pony']; o.ponyCarry = load(c).cap - cap0 > 10; c.essences = [];
    await loadTown(); const G = Town.goods, g = G.slice().sort((a, b) => b.price - a.price)[0], pr0 = g.price; c.essences = ['crystal-greed']; const pr1 = g.price; c.essences = []; o.greedShop = pr1 < pr0;
    return o;
  }).catch(async e => { errs.push(String(e.message).slice(0,100)); return {}; });
  if (!r) {}
  let bad = 0; for (const [k, v] of Object.entries(r)) { if (v !== true) { bad++; console.log('  ✗', k, v); } }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad += errs.length; }
  console.log(`проверок: ${Object.keys(r).length}, не прошли: ${bad}`); await b.close();
})();
