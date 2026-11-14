// 14.11: монстры мест Кладбища прошлого — механики способностей и встречи по местам.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: true, master: true, monDice: false } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const mk = (id, n, w) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 6, rank: 7 }); c.base = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }; c.equip = { main: { t: 'w', id: w } }; delete c.bag; delete c.kit; delete c.hp; ensureKit(c); return c; };
    state.party = [mk('p0', 'Аргон', 'sword'), mk('p1', 'Борис', 'greataxe')]; newRun(); await loadBattle(); const B = Battle; B.cfg.fast = true;
    const mkS = list => { const S = B.newBattle({ list, zone: 'undead', floor: 2, kind: 'hard', title: 'x' }); S.opts.autoHeroes = true; B.placeHeroesDefault(S); B.placeMonsters(S); B.preStart(S); B.rollInitiative(); S.phase = 'fight'; B.running = true; return S; };
    const hero = S => S.units.find(x => x.hero), mon = (S, id) => S.units.find(x => x.side === 'mon' && (x.ref === id || (x.mon && x.mon.id === id)));
    const fail = () => { const g = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = a => { a[0] = 0; for (let i = 1; i < a.length; i++) a[i] = 0; return a; }; return () => { crypto.getRandomValues = g; }; };
    // утопленница: тянет, держит, душит; гибель — отпускает
    let S = mkS(['well-drowned']), h = hero(S), m = mon(S, 'well-drowned'); m.x = h.x; m.y = h.y - 3; let un = fail(); await B.A['well-drowned'].run(m, { unit: h }, { commit() {} }); un();
    o.pull = B.dist(m, h) <= 1 && !!B.has(h, 'drowning') && B.speedOf(h) === 0;
    const hp0 = h.hp; un = fail(); await B.P['body:well-drowned'].turnStartAsync(m); un(); o.choke = h.hp < hp0;
    B.kill(m, null); o.release = !B.has(h, 'drowning');
    // ключник: прикован — скорость 0
    S = mkS(['keyholder']); h = hero(S); m = mon(S, 'keyholder'); m.x = h.x; m.y = h.y - 2; un = fail(); await B.A.keyholder.run(m, { unit: h }, { commit() {} }); un(); o.shackle = !!B.has(h, 'shackled') && B.speedOf(h) === 0;
    // надгробный страж: принимает 3 урона за соседа
    S = mkS(['tomb-guardian', 'zombie']); h = hero(S); const g = mon(S, 'tomb-guardian'), z = mon(S, 'zombie'); z.x = h.x; z.y = h.y - 1; g.x = z.x + 1; g.y = z.y; const zh = z.hp, gh = g.hp;
    await B.applyDamage(h, z, [{ v: 10, dt: 'slash', label: 't' }], { src: h, ctx: {}, melee: true }); o.wall = gh - g.hp >= 1 && zh - z.hp < 10;
    // плесень: уязвима к огню; червь растёт от гибели рядом; пёс зовёт мертвеца; упырь подкапывается
    S = mkS(['grave-mold', 'crypt-worm', 'chained-deadhound', 'ghoul-digger']); h = hero(S); const mold = mon(S, 'grave-mold'), worm = mon(S, 'crypt-worm'), dog = mon(S, 'chained-deadhound'), dig = mon(S, 'ghoul-digger');
    const mh = mold.hp; await B.applyDamage(h, mold, [{ v: 4, dt: 'fire', label: 'f' }], { src: h }); o.moldFire = mh - mold.hp === 8;
    mold.x = worm.x + 1; mold.y = worm.y; worm.hp = 10; B.kill(mold, h); o.worm = worm.hp > 10 && worm.feast === 1;
    const n0 = S.units.length; S.round = 1; B.P['body:chained-deadhound'].turnStart(dog); o.bark = S.units.length === n0 + 1; B.P['body:chained-deadhound'].turnStart(dog); o.barkOnce = S.units.length === n0 + 1;
    const far = S.units.filter(x => x.hero)[1] || h; far.hp = 3; dig.x = far.x; dig.y = Math.max(0, far.y - 4); S.round = 2; await B.P['body:ghoul-digger'].turnStartAsync(dig); o.dig = B.dist(dig, far) <= 1 && dig.digAdv;
    // жилец: первая атака с преимуществом
    S = mkS(['night-dweller']); h = hero(S); m = mon(S, 'night-dweller'); const ctx = { tgt: h, adv: [], extra: [], atk: { dt: 'slash' } }; B.P['night-dweller'].attackMods(m, ctx); const ctx2 = { tgt: h, adv: [], extra: [], atk: {} }; B.P['night-dweller'].attackMods(m, ctx2); o.face = ctx.adv.length === 1 && ctx.extra.length === 1 && ctx2.adv.length === 0;
    B.running = false; B.S = null;
    // встречи по местам
    const run = state.run; run.floor = 2; run.variant = 'undead'; run.day = 10; run.act = 1; run.pos = { x: 5, y: 5 }; riftSync(); dgUi.res = null; const k = Object.keys(run.riftsF2.tiles)[0].split(',').map(Number); run.pos = { x: k[0], y: k[1] }; riftEnter(); dgUi.res = null; const R = run.rift; R.phase = 'night';
    const seen = w => { const s = new Set(); for (let i = 0; i < 300; i++) gyGroup(R, ['easy', 'mid', 'hard'][i % 3], w).forEach(id => s.add(id)); return s; };
    const v = seen('village'), gr = seen('grave'), cr = seen('crypt');
    o.villageOwn = ['night-dweller', 'well-drowned', 'chained-deadhound'].every(id => v.has(id)); o.graveOwn = ['ghoul-digger', 'tomb-guardian'].every(id => gr.has(id)); o.cryptOwn = ['grave-mold', 'crypt-worm', 'keyholder'].every(id => cr.has(id));
    o.notInField = !['night-dweller', 'well-drowned', 'chained-deadhound', 'ghoul-digger', 'tomb-guardian', 'grave-mold', 'crypt-worm', 'keyholder'].some(id => seen('field').has(id));
    o.essences = ['night-dweller', 'well-drowned', 'chained-deadhound', 'ghoul-digger', 'tomb-guardian', 'grave-mold', 'crypt-worm', 'keyholder'].every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id && m.rift === 'gyard'));
    o.libHidden = !libMonsters().some(m => m.id === 'keyholder') || (journal().riftsDone || {}).gyard;
    o.serviceText = !/без броска/.test(ESSENCES['night-abbot'].passive.text);
    return o;
  });
  let bad = 0, n = 0; for (const [k, v] of Object.entries(r)) { n++; if (!v) { bad++; console.log('  ✗', k); } else console.log('  ✓', k); }
  if (errs.length) { console.log('ошибки:', errs.slice(0, 5)); bad++; }
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close(); process.exit(bad ? 1 : 0);
})();
