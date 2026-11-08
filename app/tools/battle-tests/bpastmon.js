// Монстры «Чащи прошлого» (08.11): способности 9–7 класса, эссенции, встречи в разломе.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const NEW = ['moss-hedgehog', 'firefly-swarm', 'branded-critter', 'tree-lynx', 'chimera-hound', 'homunculus', 'alch-intern', 'lab-direwolf', 'senior-alch', 'mutant-boar', 'fled-chimera', 'swarm-mother', 'fallen-keeper', 'naturalist', 'luna'];
  const z = await p.evaluate(NEW => { state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, rank: 7 })]; newRun(); const run = state.run; run.floor = 2; run.variant = 'beast'; run.rift = riftBuild('past'); const R = run.rift;
    const seen = new Set(), lab = new Set(); for (let i = 0; i < 300; i++) { R.pos = { x: 2, y: 12 }; for (const s of ['easy', 'mid', 'hard']) pastGroup(R, s).forEach(id => seen.add(id)); R.pos = { x: 13, y: 1 }; pastGroup(R, 'hard').forEach(id => lab.add(id)); }
    return { ess: NEW.every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id && m.rift === 'past')), guard: ['fallen-keeper', 'naturalist', 'luna'].every(id => MONSTERS.find(m => m.id === id).rank === 'guardian'), seen: [...seen], lab: [...lab],
      old: ['wolf', 'crow', 'horned-hare', 'web-spider', 'dire-wolf', 'werewolf'].filter(id => seen.has(id) || lab.has(id)).length }; }, NEW);
  ok('15 новых монстров с эссенциями, 3 стража', z.ess && z.guard, z);
  ok('встречи: все новые 9–7 класса и старые звери (~30 %)', NEW.slice(0, 12).every(id => z.seen.includes(id) || z.lab.includes(id)) && z.old >= 5, z);
  ok('у лаборатории — лютоволки', z.lab.includes('lab-direwolf'), z);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const t = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {};
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 5 }); c.base = { str: 16, dex: 12, con: 14, int: 10, wis: 8, cha: 12 }; c.equip = { main: { t: 'w', id: 'longsword' } }; delete c.essences; c.essences = []; return c; };
    state.run = state.run || {}; state.run.rift = null; state.party = [mk(0), mk(1)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const fight = list => { const S = B.newBattle({ list, zone: 'beast', floor: 2 }); B.placeMonsters(S); S.phase = 'fight'; S.round = 1; return S; };
    const near = (u, t) => { const c = B.freeCellsNear(t, 1, u)[0]; u.x = c[0]; u.y = c[1]; };
    const C = { commit() {} };
    // ёж: иглы и клубок
    let S = fight(['moss-hedgehog']); let [hog] = B.mons(), h = B.heroes()[0]; near(h, hog); h.prot = 0; let hp = h.hp; await B.P['moss-hedgehog'].onDamagedAsync(hog, { src: h, o: { melee: true } }); out.spikes = h.hp === hp - 1;
    await B.A['moss-hedgehog'].run(hog, {}, C); out.curl = !!B.has(hog, 'curled') && B.P['moss-hedgehog'].immune(hog, { id: 'prone' }); hp = h.hp; await B.P['moss-hedgehog'].onDamagedAsync(hog, { src: h, o: { melee: true } }); out.spikes3 = h.hp < hp - 1; out.sp3v = hp - h.hp; out.prot = h.prot; out.temp = h.temp;
    // рой: вспышка, уязвим к огню
    S = fight(['firefly-swarm']); let [sw] = B.mons(); h = B.heroes()[0]; near(h, sw); let any = false; for (let i = 0; i < 10 && !any; i++) { await B.A['firefly-swarm'].run(sw, {}, C); any = B.heroes().some(x => B.has(x, 'dazzled')); } out.flash = any; out.fireVuln = B.P['body:firefly-swarm'].vulnerable(sw, { dt: 'fire' });
    // зверёк: кислотный хлопок при смерти
    S = fight(['branded-critter']); let [cr] = B.mons(); h = B.heroes()[0]; near(h, cr); hp = h.hp; B.kill(cr, h); if (B.flushQueue) await B.flushQueue(); out.pop = h.hp < hp;
    // пёс-химера: две атаки, с двумя оружиями нельзя
    S = fight(['chimera-hound']); let [ch] = B.mons(); h = B.heroes()[0]; near(h, ch); let atks = 0; const da = B.doAttack; B.doAttack = async (...a) => { atks++; return da(...a); }; await B.A['chimera-hound'].run(ch, { unit: h }, C); B.doAttack = da; out.double = atks === 2;
    // лютоволк: укус вызывает кровотечение, по кровоточащей +1к6
    S = fight(['lab-direwolf']); let [lw] = B.mons(); h = B.heroes()[0]; B.P['body:lab-direwolf'].onHitDealt(lw, { tgt: h }); out.bleed = !!B.has(h, 'bleeding'); const cx = { melee: true, tgt: h, extra: [] }; B.P['lab-direwolf'].attackMods(lw, cx); out.rend = cx.extra.length === 1;
    any = false; near(h, lw); for (let i = 0; i < 10 && !any; i++) { await B.A['lab-direwolf'].run(lw, {}, C); any = B.heroes().some(x => B.has(x, 'frightened')); } out.howl = any;
    // вепрь: таран бивнем отталкивает
    S = fight(['mutant-boar']); let [bo] = B.mons(); h = B.heroes()[0]; bo.x = 2; bo.y = 4; h.x = 5; h.y = 4; let pushed = false; for (let i = 0; i < 8 && !pushed; i++) { const x0 = h.x, y0 = h.y; bo.x = Math.max(0, h.x - 3); bo.y = h.y; await B.A['mutant-boar'].run(bo, { unit: h }, C); pushed = (h.x !== x0 || h.y !== y0) || h.hp < h.maxHp; } out.ram = pushed && B.P['mutant-boar'].immune(bo, { id: 'prone' });
    // химера: хвост кусает того, кто закончил ход рядом; рык +2 урона
    S = fight(['fled-chimera']); let [fc] = B.mons(); h = B.heroes()[0]; near(h, fc); hp = h.hp; for (let i = 0; i < 4; i++) { fc.tailRound = 0; await B.hookAllAsync(h, 'turnEndAsync', {}); } out.tail = h.hp < hp || !!B.has(h, 'poisoned'); await B.A['fled-chimera'].run(fc, {}, C); const cx2 = { melee: true, tgt: h, extra: [] }; B.P['past-roar'].attackMods(fc, cx2); out.roar = cx2.dmgPlus === 2;
    // матка: призыв двух роёв, мерцание соседей
    S = fight(['swarm-mother']); let [sm] = B.mons(); h = B.heroes()[0]; near(h, sm); const n0 = B.mons().length; await B.A['swarm-mother'].run(sm, {}, C); out.summon = B.mons().length === n0 + 2; B.P['swarm-mother'].turnEnd(sm); out.glare = !!B.has(h, 'glare');
    // алхимики: склянка по области; интерн/старший — бонус к зельям
    S = fight(['senior-alch', 'alch-intern']); let [sa, ai] = B.mons(); h = B.heroes()[0]; hp = B.heroes().map(x => x.hp + (B.has(x, 'stunned') ? 100 : 0) + (B.has(x, 'corroded') ? 100 : 0)).join(); for (let i = 0; i < 6; i++) await B.A['senior-alch'].run(sa, { cell: [h.x, h.y] }, C); out.vial = B.heroes().map(x => x.hp + (B.has(x, 'stunned') ? 100 : 0) + (B.has(x, 'corroded') ? 100 : 0)).join() !== hp;
    h.pass.push('senior-alch'); let bonus = 0; for (let i = 0; i < 5; i++) bonus += B.potionBonus(h, h); out.potion = bonus >= 5;
    // гомункул: раствор
    S = fight(['homunculus', 'lab-direwolf']); let [ho, w2] = B.mons(); await B.A.homunculus.run(ho, { unit: w2 }, C); out.sol = (w2.temp || 0) > 0;
    // рысь: прыжок
    S = fight(['tree-lynx']); let [ly] = B.mons(); const lx = ly.x, lyy = ly.y; await B.A['tree-lynx'].run(ly, {}, C); out.leap = ly.x !== lx || ly.y !== lyy;
    return out;
  });
  ok('мшистый ёж: иглы 1 / 3 в клубке, клубок защищает от падения', t.spikes && t.curl && t.spikes3, t);
  ok('светлячковый рой: вспышка слепит, уязвим к огню', t.flash && t.fireVuln, t);
  ok('клеймёный зверёк: кислотный хлопок при смерти', t.pop, t);
  ok('пёс-химера: двойной укус — 2 атаки', t.double, t);
  ok('лютоволк: кровотечение, +1к6 по кровоточащей, вой пугает', t.bleed && t.rend && t.howl, t);
  ok('вепрь-мутант: таран бивнем, иммунитет к падению', t.ram, t);
  ok('беглая химера: хвост и рык +2 урона', t.tail && t.roar, t);
  ok('матка роя: два роя и мерцание', t.summon && t.glare, t);
  ok('склянки алхимиков действуют; «Мастер зелий» усиливает зелья', t.vial && t.potion, t);
  ok('гомункул: укрепляющий раствор; рысь прыгает', t.sol && t.leap, t);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
