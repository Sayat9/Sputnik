// Среда поля: полное укрытие и линия обзора, разрушаемые объекты, перехват снаряда, находки (травы, грибы, камни), сундуки.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const out = await p.evaluate(async () => {
    const R = [], ok = (name, cond, extra) => R.push({ name, ok: !!cond, extra: extra == null ? '' : String(extra) });
    const B = Battle;
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const Q = [], realGRV = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', { configurable: true, writable: true, value: arr => { if (Q.length) { arr[0] = Q.shift(); return arr; } return realGRV(arr); } });
    const F = (...rs) => { Q.length = 0; for (const r of rs) Q.push(r - 1); for (let i = 0; i < 80; i++) Q.push(9); };
    const mk = (i, o = {}) => { const c = Object.assign(clone(state.example), { id: 'e' + i, example: false, name: 'Г' + i, race: 'human', level: 2 }); c.base = { str: 14, dex: 16, con: 12, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: o.main || 'sword' } }; if (o.off) c.equip.off = { t: 'w', id: o.off }; delete c.bag; delete c.kit; delete c.hp; c.essences = o.ess || []; ensureKit(c); c.mp = maxMp(c); return c; };
    const setup = (specs, list, zone = 'goblin', floor = 1) => { const hs = specs.map((s, i) => mk(i, s)); state.party = hs; state.run.status = {}; hs.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; }); B.cfg.fast = true; const S = B.newBattle({ list, zone, floor }); S.opts.autoHeroes = true; if (!window.__keepEnv) { for (const row of S.cells) row.fill(''); S.objs.length = 0; } B.mons().forEach(m => { m.ac = 1; m.maxHp = m.hp = 300; }); return S; };
    const T = u => { B.S.curId = u.id; u.t = Object.assign({ move: B.speedOf(u), action: 1, bonus: 1, react: 1, dash: false, disengage: false, attacked: false, riteUsed: false, objUsed: false, moved: 0, startX: u.x, startY: u.y }, {}); };

    const logs = (n = 6) => B.S.log.slice(-n).map(l => l.t).join(' | ');
    // --- полное укрытие ---
    {
      const S = setup([{ main: 'shortbow' }], ['goblin']); const H = B.heroes()[0], G = B.mons()[0];
      H.x = 3; H.y = 5; G.x = 3; G.y = 1; S.cells[3][3] = 'palisade';
      ok('частокол: полное укрытие, закрывает обзор', B.sightBlockAt(3, 3) && !B.hasLOS(H, G));
      ok('за частоколом цель недоступна дальней атаке', !B.attackTargets(H, B.heroAttacks(H).find(a => a.kind === 'ranged')).includes(G));
      ok('клетки за стеной не видны отряду, перед ней — видны', !B.visionCells().has('3,1') && B.visionCells().has('3,4') && B.visionCells().has('3,3'));
      ok('враг за стеной не виден отряду', !B.seenByParty(G));
      G.x = 5; G.y = 1; ok('сбоку виден', B.seenByParty(G));
    }
    // --- объекты ---
    {
      const S = setup([{ main: 'sword' }, { main: 'warhammer' }], ['goblin']); const [H, W] = B.heroes(), G = B.mons()[0]; G.x = 0; G.y = 0;
      H.x = 3; H.y = 5; W.x = 5; W.y = 5; S.cells[4][3] = 'rock'; S.cells[4][5] = 'rock';
      const sw = B.heroAttacks(H).find(a => a.kind === 'melee' && a.w), hm = B.heroAttacks(W).find(a => a.kind === 'melee' && a.w);
      ok('соседний камень — цель атаки', B.objectTargets(H, sw).some(o => o.x === 3 && o.y === 4));
      ok('камень имеет КД и ОЗ', (() => { const o = B.objAt(3, 4); return o.ac === 12 && o.hp === 20; })());
      T(H); F(15, 4); await B.attackObject(H, sw, B.objAt(3, 4), {});
      ok('меч по камню: ОЗ камня упали (рубящий вполовину)', B.objAt(3, 4).hp < 20 && B.objAt(3, 4).hp >= 20 - 7, B.objAt(3, 4).hp);
      T(H); const hp0 = H.hp; F(2, 4); await B.attackObject(H, sw, B.objAt(3, 4), {});
      ok('низкий бросок мечом по камню: отдача в руку', H.hp < hp0, hp0 + ' → ' + H.hp);
      T(W); const hp1 = W.hp; F(2, 4); await B.attackObject(W, hm, B.objAt(5, 4), {});
      ok('молот: отдачи нет', W.hp === hp1);
      ok('молот считается тяжёлым', B.isHeavy(hm.w));
      B.damageObject(5, 4, 999, 'bludgeon', W); ok('разрушенный камень исчезает с поля', B.terrain(5, 4) === '');
      Q.length = 0; let n9 = 0, n8 = 0; for (let i = 0; i < 600; i++) { S.cells[1][1] = 'crystal'; S.found = []; B.damageObject(1, 1, 999, 'fire', H); n9 += S.found.filter(f => f.id === 'stone-9').length; }
      ok('кристалл: камни 9-го класса выпадают редко (≈15 %)', n9 > 40 && n9 < 160, n9);
      S.floor = 2; for (let i = 0; i < 600; i++) { S.cells[1][1] = 'crystal'; S.found = []; B.damageObject(1, 1, 999, 'fire', H); n9 += 0; n8 += S.found.filter(f => f.id === 'stone-8').length; }
      ok('2 этаж: появляются камни 8-го класса', n8 > 10 && n8 < 100, n8);
      S.cells[2][2] = 'rock'; const b = B.blastCells([[2, 2]], 30, 'fire', H); ok('взрыв разрушает объект в области', b === 1 && B.terrain(2, 2) === '');
      S.cells[2][2] = 'rock'; ok('яд объекту не вредит', B.damageObject(2, 2, 50, 'poison', H) === 0);
    }
    // --- перехват снаряда ---
    {
      const S = setup([{ main: 'shortbow' }, { main: 'sword' }], ['goblin']); const [H, A] = B.heroes(), G = B.mons()[0];
      H.x = 3; H.y = 5; A.x = 3; A.y = 3; G.x = 3; G.y = 0; G.ac = 30; A.ac = 5; A.hp = A.maxHp = 50;
      const bow = B.heroAttacks(H).find(a => a.kind === 'ranged'); T(H); const hp0 = A.hp; F(8, 4, 4);
      const r = await B.doAttack(H, G, bow, { cancelable: false });
      ok('низкий бросок: стрела задела союзника на линии', !r.hit && A.hp < hp0, hp0 + ' → ' + A.hp + ' | ' + logs(4));
      T(H); const hp1 = A.hp; F(18, 4, 4); await B.doAttack(H, G, bow, { cancelable: false });
      ok('высокий бросок (мимо по КД цели): никого не задевает', A.hp === hp1);
      A.ac = 40; T(H); F(8, 4, 4); await B.doAttack(H, G, bow, { cancelable: false });
      ok('если бросок не достаёт КД задетого — летит мимо', A.hp === hp1);
    }
    // --- находки ---
    {
      ok('15 находок, у каждой есть описание', Object.keys(FINDS).length === 15 && Object.keys(FINDS).every(id => GEAR[id].note));
      const S = setup([{ main: 'sword' }, { main: 'sword', ess: ['pixie'] }], ['goblin'], 'goblin', 1); const [H, K] = B.heroes();
      const c = H.hero;
      ok('без навыка эффект неизвестен: имя «Узколистая трава»', itemOf({ t: 'g', id: 'herb-heal' }, c).name === 'Узколистая трава' && !findKnown(c, 'herb-heal'));
      c.lore = ['herb']; ok('со знаниями — настоящее имя и описание', itemOf({ t: 'g', id: 'herb-heal' }, c).name === 'Целебная трава' && /ОЗ/.test(itemOf({ t: 'g', id: 'herb-heal' }, c).note)); c.lore = [];
      c.bag = []; addToBag(c, { t: 'g', id: 'herb-heal', qty: 3 }); ok('неизвестные лежат по одному на ячейку', c.bag.length === 3, c.bag.length);
      c.bag = []; c.lore = ['herb']; addToBag(c, { t: 'g', id: 'herb-heal', qty: 3 }); ok('известные — стопкой', c.bag.length === 1 && c.bag[0].qty === 3); c.lore = [];
      // зоны размещения
      const cnt = (zone, N = 150) => { const r = {}; for (let i = 0; i < N; i++) { const s2 = B.newBattle({ list: ['goblin'], zone, floor: 2 }); for (const o of s2.objs) if (o.kind === 'find') r[FINDS[o.fid].kind] = (r[FINDS[o.fid].kind] || 0) + 1; } return r; };
      window.__keepEnv = true;
      const g = cnt('goblin'), bz = cnt('beast'), un = cnt('undead'), st = cnt('stone');
      ok('грибы — только у гоблинов', g.mush > 20 && !g.herb && !g.sstone, JSON.stringify(g));
      ok('травы — у зверей и на погосте', bz.herb > 20 && un.herb > 20 && !bz.mush && !un.mush, JSON.stringify([bz, un]));
      ok('особые камни — у элементалей', st.sstone > 20 && !st.herb, JSON.stringify(st));
      // сбор
      const S3 = setup([{ main: 'sword', base: { wis: 14 } }], ['goblin']); const H3 = B.heroes()[0], G3 = B.mons()[0]; G3.x = 0; G3.y = 0; H3.x = 3; H3.y = 5; T(H3);
      S3.objs.push({ id: 'f1', kind: 'find', fid: 'mush-heal', x: 3, y: 4 }); H3.hero.bag = [];
      const opt = B.actionsFor(H3).find(o => o.id === 'gather:f1'); ok('рядом с находкой есть «Собрать»', !!opt && opt.enabled, opt && opt.label);
      ok('название по знаниям героя (без навыка — «Красный гриб»)', /Красный гриб/.test(opt.label), opt.label);
      F(1); await opt.run(); ok('провал проверки (натуральная 1): находка испорчена', !S3.objs.some(o => o.id === 'f1'));
      S3.objs.push({ id: 'f2', kind: 'find', fid: 'mush-heal', x: 3, y: 4 }); T(H3); F(20); await B.actionsFor(H3).find(o => o.id === 'gather:f2').run();
      ok('успех: гриб в рюкзаке, на поле его нет', H3.hero.bag.some(e => e.id === 'mush-heal') && !S3.objs.some(o => o.id === 'f2') && H3.t.action === 0);
      // применение
      T(H3); H3.hp = 3; const eat = B.actionsFor(H3).find(o => o.id === 'eat:mush-heal'); ok('есть «Съесть» (доп. действие)', !!eat && eat.time === 'bonus');
      F(6, 6); await eat.run(); ok('съел: ОЗ выросли, гриб потрачен', H3.hp > 3 && !H3.hero.bag.some(e => e.id === 'mush-heal') && H3.t.bonus === 0, H3.hp);
      H3.hero.bag = []; addToBag(H3.hero, { t: 'g', id: 'mush-boom', qty: 1 }); T(H3); H3.hp = H3.maxHp = 40; F(3, 3); await B.actionsFor(H3).find(o => o.id === 'eat:mush-boom').run();
      ok('пороховик: съевший получает урон', H3.hp < 40, H3.hp);
      H3.hero.bag = []; addToBag(H3.hero, { t: 'g', id: 'herb-mana', qty: 1 }); T(H3); H3.mp = 0; await B.actionsFor(H3).find(o => o.id === 'eat:herb-mana').run(); ok('серебрянка: мана +4', H3.mp === 4, H3.mp);
      ok('бросаемые есть у камней', !!FINDS['sstone-para'].throw && !!FINDS['mush-boom'].throw);
    }
    // --- сундуки ---
    {
      window.__keepEnv = true;
      let withThief = 0, plain = 0, plain1 = 0;
      for (let i = 0; i < 80; i++) { const s = B.newBattle({ list: ['goblin-thief'], zone: 'goblin', floor: 2 }); if (s.objs.some(o => o.kind === 'chest')) withThief++; }
      for (let i = 0; i < 300; i++) { const s = B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 2 }); if (s.objs.some(o => o.kind === 'chest')) plain++; const s1 = B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); if (s1.objs.some(o => o.kind === 'chest')) plain1++; }
      ok('с гоблином-вором сундук всегда', withThief === 80, withThief);
      ok('без вора на 2 этаже сундук редко', plain > 10 && plain < 90, plain);
      ok('на 1 этаже сундуков нет', plain1 === 0);
      window.__keepEnv = true;
      const S = B.newBattle({ list: ['goblin-thief'], zone: 'goblin', floor: 2 }); const ch = S.objs.find(o => o.kind === 'chest');
      ok('в сундуке всегда 2+ камня 9-го класса', ch.loot[0].id === 'stone-9' && ch.loot[0].qty >= 2, JSON.stringify(ch.loot));
      let s8 = 0, food = 0, pot = 0, map = 0; const N = 3000; for (let i = 0; i < N; i++) { const L = B.rollChest(2); if (L.some(x => x.id === 'stone-8')) s8++; if (L.some(x => x.id === 'ration')) food++; if (L.some(x => x.id === 'potion')) pot++; if (L.some(x => x.map)) map++; }
      ok('шансы: камни 8 > еда > зелья > карта', s8 > food && food > pot && pot > map && map > 0, [s8, food, pot, map].join('/'));
      window.__keepEnv = false;
    }
    // --- способность по одной цели бьёт объект ---
    {
      const S = setup([{ ess: ['hobgoblin-brute'], main: 'mace' }], ['goblin']); const H = B.heroes()[0], G = B.mons()[0]; G.x = 0; G.y = 0; H.x = 3; H.y = 5; S.cells[4][3] = 'rock'; T(H); H.mp = 20;
      const sp = B.A['hobgoblin-brute'].tgt(H); ok('в выборе цели способности есть объект', sp.objs && sp.objs.includes('3,4'), JSON.stringify(sp.objs));
      ok('способность доступна, когда рядом только камень', B.A['hobgoblin-brute'].can(H) === true);
      F(18, 6, 6, 6); await B.useActive(H, 'hobgoblin-brute', { unit: B.objAt(3, 4) });
      ok('способность ударила по камню: ОЗ камня упали', B.objAt(3, 4) ? B.objAt(3, 4).hp < 20 : true, logs(3));
    }
    // --- «Знаток трав» ---
    {
      const S = setup([{ main: 'sword', ess: ['goblin-shaman'], base: { wis: 14 } }], ['goblin']); const H = B.heroes()[0], G = B.mons()[0]; G.x = 0; G.y = 0; H.x = 3; H.y = 5; T(H); H.hero.bag = [];
      S.objs.push({ id: 'fx', kind: 'find', fid: 'herb-heal', x: 3, y: 4 }); const opt = B.actionsFor(H).find(o => o.id === 'gather:fx');
      ok('шаман видит настоящее имя находки', /Целебная трава/.test(opt.label), opt.label);
      F(20, 1, 1); await opt.run(); const got = H.hero.bag.reduce((a, e) => a + (e.id === 'herb-heal' ? e.qty : 0), 0);
      ok('собирает сразу 2–3 штуки', got >= 2 && got <= 3, got);
    }
    return { R };
  });
  const bad = out.R.filter(r => !r.ok);
  console.log(`проверок: ${out.R.length}, не прошли: ${bad.length}`);
  for (const r of bad) console.log('  ✗', r.name, '—', r.extra);
  if (process.env.VERBOSE) for (const r of out.R.filter(r => r.ok)) console.log('  ✓', r.name);
  console.log('page errors:', [...new Set(errs)].slice(0, 10));
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
