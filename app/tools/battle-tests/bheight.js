// Высота (возвышенности) и укрытия 2 этажа: бонус к атаке, заросли/надгробия, враги, затаившиеся в начале боя.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-ai','battle-end','battle'];
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
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'e' + i, example: false, name: 'Г' + i, race: 'human', level: 2 }); c.base = { str: 14, dex: 14, con: 12, int: 10, wis: 12, cha: 12 }; c.equip = { main: { t: 'w', id: 'sword' } }; delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); c.mp = maxMp(c); return c; };
    const setup = (n, list, zone, floor) => { const hs = Array.from({ length: n }, (_, i) => mk(i)); state.party = hs; state.run.status = {}; hs.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; }); B.cfg.fast = true; const S = B.newBattle({ list, zone, floor }); S.opts.autoHeroes = true; return S; };
    const clear = S => { for (const row of S.cells) row.fill(''); S.objs.length = 0; };
    // --- высота ---
    {
      const S = setup(1, ['goblin'], 'goblin', 1); clear(S);
      const H = B.heroes()[0], G = B.mons()[0], atk = B.heroAttacks(H).find(a => a.kind === 'melee');
      H.x = 3; H.y = 3; G.x = 3; G.y = 2; G.ac = 10;
      const base = B.attackCtx(H, G, atk).mods.reduce((a, m) => a + m.v, 0);
      S.cells[3][3] = 'hill'; const up = B.attackCtx(H, G, atk);
      ok('атакующий на возвышенности: +2 к броску', up.mods.reduce((a, m) => a + m.v, 0) === base + 2 && up.mods.some(m => /Высота/.test(m.l)));
      S.cells[3][3] = ''; S.cells[2][3] = 'hill'; const dn = B.attackCtx(H, G, atk);
      ok('цель на возвышенности: +2 к броску по ней', dn.mods.reduce((a, m) => a + m.v, 0) === base + 2);
      S.cells[3][3] = 'hill'; const both = B.attackCtx(H, G, atk);
      ok('оба на возвышенности: бонусы складываются (+4)', both.mods.reduce((a, m) => a + m.v, 0) === base + 4);
      // бонус действует и по герою (атака монстра)
      const gatk = G.atk && G.atk[0]; S.cells[2][3] = ''; S.cells[3][3] = 'hill';
      const gb = B.attackCtx(G, H, gatk).mods.some(m => /Высота/.test(m.l));
      ok('по герою на возвышении монстр тоже бьёт точнее', gb);
      ok('у возвышенности есть описание и рисунок', B.D.terrain.hill.note && B.D.SVG.hill && B.D.SVG.tomb);
    }
    // --- генерация ---
    const count = (S, t) => S.cells.flat().filter(c => c === t).length;
    const stat = (zone, floor, t, N = 200) => { let sum = 0, any = 0; for (let i = 0; i < N; i++) { const g = B.genTerrain ? B.genTerrain(zone, floor) : null; const n = g.cells.flat().filter(c => c === t).length; sum += n; if (n) any++; } return { sum, any }; };
    ok('genTerrain доступен', typeof B.genTerrain === 'function');
    if (B.genTerrain) {
      ok('возвышенности появляются во всех открытых зонах', ['goblin','beast','undead'].every(z => stat(z, 1, 'hill').any > 20), JSON.stringify(['goblin','beast','undead'].map(z => stat(z, 1, 'hill').any)));
      ok('в пещере возвышенностей нет', stat('stone', 1, 'hill').any === 0);
      ok('1 этаж: надгробий-укрытий (tomb) нет', stat('undead', 1, 'tomb').any === 0);
      ok('2 этаж: надгробия-укрытия есть в зоне нежити', stat('undead', 2, 'tomb').any > 150);
      const gt = stat('goblin', 1, 'thorns'), gt2 = stat('goblin', 2, 'thorns'), bb = stat('beast', 1, 'bush'), bb2 = stat('beast', 2, 'bush');
      ok('2 этаж: колючих зарослей у гоблинов больше, чем на 1-м', gt2.sum > gt.sum * 1.25, gt.sum + ' → ' + gt2.sum);
      ok('2 этаж: кустов у зверей больше, чем на 1-м', bb2.sum > bb.sum * 1.3, bb.sum + ' → ' + bb2.sum);
    }
    // --- затаившиеся враги ---
    const rate = (zone, list, floor, N = 60) => { let hid = 0, cov = 0, tot = 0, offcell = 0; for (let i = 0; i < N; i++) {
      const S = setup(2, list, zone, floor); B.placeHeroesDefault(S); B.placeMonsters(S); B.placeCoverMonsters(S);
      const cm = B.mons().filter(m => m.coverHide); cov += cm.length; tot += B.mons().length;
      offcell += cm.filter(m => { const t = B.tinfo(m.x, m.y); return !(t && t.hide); }).length;
      B.mons().forEach(m => { m.skills = Object.assign({}, m.skills, { stealth: 30 }); });                      // чтобы затаивание всегда удавалось
      S.phase = 'init'; const pre = B.preStart || null; if (pre) pre(S);
      hid += B.mons().filter(m => B.has(m, 'hidden')).length; }
      return { hid, cov, tot, offcell }; };
    ok('preStart доступен', typeof B.preStart === 'function');
    if (B.preStart) {
      const g2 = rate('goblin', ['goblin','goblin','goblin','goblin','goblin'], 2), g1 = rate('goblin', ['goblin','goblin','goblin','goblin','goblin'], 1);
      ok('1 этаж: никто не уходит в укрытие', g1.cov === 0 && g1.hid === 0, JSON.stringify(g1));
      ok('2 этаж, гоблины: в укрытие уходит часть врагов', g2.cov > 60 && g2.cov < g2.tot, JSON.stringify(g2));
      ok('все ушедшие стоят на клетках с укрытием', g2.offcell === 0, JSON.stringify(g2));
      ok('при удачной Скрытности они затаиваются', g2.hid >= g2.cov * 0.95, JSON.stringify(g2));
      const u2 = rate('undead', ['zombie','zombie','skeleton','skeleton'], 2), b2 = rate('beast', ['wolf','wolf','wolf','fox'], 2);
      ok('2 этаж, нежить: прячутся под надгробиями/в тумане', u2.cov > 40 && u2.offcell === 0, JSON.stringify(u2));
      ok('2 этаж, звери: прячутся в кустах', b2.cov > 40 && b2.offcell === 0, JSON.stringify(b2));
      // слабая скрытность не помогает против внимательного героя
      const S = setup(1, ['goblin','goblin','goblin'], 'goblin', 2); B.placeHeroesDefault(S); B.placeMonsters(S); B.placeCoverMonsters(S);
      B.mons().forEach(m => { m.abil.dex = 1; m.skills = {}; }); B.heroes()[0].skills.perception = 40;
      B.preStart(S); ok('при слабой Скрытности враг остаётся на виду', B.mons().every(m => !B.has(m, 'hidden')));
    }
    // --- затаившиеся враги не видны героям ---
    {
      const S = setup(1, ['goblin','goblin'], 'goblin', 2); clear(S);
      const H = B.heroes()[0], [G1, G2] = B.mons(); H.x = 3; H.y = 5; G1.x = 0; G1.y = 1; G2.x = 6; G2.y = 1;
      B.addStatus(G1, 'hidden', { k: Infinity, data: { unseen: true, dc: 12 } });
      ok('затаившийся враг не входит в список целей героя', !B.enemiesOf(H).includes(G1) && B.enemiesOf(H).includes(G2));
      ok('для монстров герой остаётся целью', B.enemiesOf(G1).includes(H));
      ok('в действиях героя есть «Осмотреться»', B.actionsFor(H).some(o => o.id === 'search'));
      H.skills = Object.assign({}, H.skills); H.pass = H.pass || [];
      B.spotHidden(H); ok('издалека (3+ клеток, не слышно) его не замечают', B.isUnseen(G1), H.x + ',' + H.y);
      G1.x = 3; G1.y = 4; B.spotHidden(H); ok('вплотную замечают сразу', !B.isUnseen(G1));
      ok('после этого он снова цель', B.enemiesOf(H).includes(G1));
      // по шороху: до 3 клеток и пассивное Восприятие не ниже Скрытности
      B.addStatus(G2, 'hidden', { k: Infinity, data: { unseen: true, dc: 1 } }); G2.x = 3; G2.y = 2; B.spotHidden(H);
      ok('в 3 клетках замечают, если пассивное Восприятие ≥ Скрытности', !B.isUnseen(G2));
      B.addStatus(G2, 'hidden', { k: Infinity, data: { unseen: true, dc: 99 } }); B.spotHidden(H);
      ok('при высокой Скрытности — нет', B.isUnseen(G2));
      // начал действовать — виден (в цикле хода)
      ok('функция revealHidden снимает невидимость', (B.revealHidden(G2), !B.isUnseen(G2)));
    }
    // --- полный бой 2 этажа без падений ---
    {
      let bad = 0, hiddenOnce = 0;
      for (let i = 0; i < 12; i++) {
        const zone = ['goblin','beast','undead'][i % 3], list = zone === 'goblin' ? ['goblin','goblin','goblin','goblin'] : zone === 'beast' ? ['wolf','wolf','fox'] : ['zombie','skeleton','skeleton'];
        const hs = [mk(0), mk(1)]; state.party = hs; state.run.status = {}; hs.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
        try { const S = await B.start({ list: list.slice(), zone, floor: 2, ambush: false, killed: [] }, { sim: true, autoHeroes: true }); if (!S.outcome) bad++; if (S.log.some(l => /затаил/.test(l.t))) hiddenOnce++; } catch (e) { bad++; }
      }
      ok('12 симуляций боя на 2 этаже завершились', bad === 0, bad);
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
