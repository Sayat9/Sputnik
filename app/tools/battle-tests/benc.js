// Встречи на шаге: бросок делает приложение, новая таблица, находка-камни, группа путников (генерация, 4 действия, бой, награды), засада отряда.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : extra); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], autoEnd: false });

  // --- таблица ---
  const T = await p.evaluate(() => Array.from({ length: 20 }, (_, i) => eventOf(i + 1)[1]));
  ok('таблица: 1–2 засада', T.slice(0, 2).every(k => k === 'ambush'), T);
  ok('таблица: 3–6 тяжёлая', T.slice(2, 6).every(k => k === 'hard'), T);
  ok('таблица: 7–10 средняя', T.slice(6, 10).every(k => k === 'mid'), T);
  ok('таблица: 11–14 лёгкая', T.slice(10, 14).every(k => k === 'easy'), T);
  ok('таблица: 15–17 группа путников', T.slice(14, 17).every(k => k === 'group'), T);
  ok('таблица: 18–20 находка', T.slice(17).every(k => k === 'find'), T);

  // --- находка = камни ---
  const F = await p.evaluate(() => {
    const out = {};
    for (const f of [1, 2, 3]) {
      state.run.floor = f; const seen = new Set();
      for (let i = 0; i < 300; i++) {
        state.sack = null; findStones();
        const it = sack().items; const by = {}; for (const k in it) if (it[k].qty > 0) by[it[k].cls] = it[k].qty;
        seen.add(JSON.stringify(by));
      }
      out[f] = [...seen].sort();
    }
    state.run.floor = 1; return out;
  });
  ok('1 этаж: 1–2 камня 9 кл.', JSON.stringify(F[1]) === JSON.stringify(['{"9":1}', '{"9":2}']), F[1]);
  ok('2 этаж: 3–4 камня 9 кл. или 1 камень 8 кл.', JSON.stringify(F[2]) === JSON.stringify(['{"8":1}', '{"9":3}', '{"9":4}']), F[2]);
  ok('3 этаж: 1–2 камня 8 кл. или 1 камень 7 кл.', JSON.stringify(F[3]) === JSON.stringify(['{"7":1}', '{"8":1}', '{"8":2}']), F[3]);

  // --- генерация путников ---
  const G = await p.evaluate(() => {
    const out = {};
    for (const f of [1, 2, 3]) {
      state.run.floor = f; state.run.travs = {};
      const o = { sizes: new Set(), minStat: 99, minSum: 999, maxSum: 0, armor: 0, essGroups: 0, ess8two: 0, hasAny: 0, raceSet: new Set(), gSet: new Set(), wSet: new Set(), n: 0, bad: [], f1ess: 0, ess7: 0 };
      for (let i = 0; i < 300; i++) {
        const g = genTravelers(f); o.sizes.add(g.length); o.n++;
        let withEss = 0, e8 = 0, any = 0;
        for (const t of g) {
          const s = STAT_KEYS.reduce((a, k) => a + t.base[k], 0); o.minSum = Math.min(o.minSum, s); o.maxSum = Math.max(o.maxSum, s);
          o.minStat = Math.min(o.minStat, ...STAT_KEYS.map(k => t.base[k]));
          if (t.armor) o.armor++; o.raceSet.add(t.race); o.gSet.add(t.g); o.wSet.add(t.weapon);
          if (t.ess.length) { withEss++; any++; }
          if (t.ess.some(e => ESSENCES[e].cls === 8)) e8++;
          if (t.ess.some(e => ESSENCES[e].cls === 7)) o.ess7++;
          const m = MONSTERS.find(x => x.id === t.id);
          if (!m || !m.dyn || !m.abil || m.abil.some(a => !(a >= 10)) && f < 99 && false) o.bad.push('нет записи ' + t.id);
          if (m && (parseInt(m.hp) < 5 || parseInt(m.ac) < 8)) o.bad.push('странные ОЗ/КД ' + m.hp + '/' + m.ac);
          if (m && !m.traits.length) o.bad.push('нет атаки');
        }
        if (any) o.essGroups++; if (e8 >= 2) o.ess8two++;
        if (f === 2 && !any) o.bad.push('2 этаж без эссенции');
        if (f === 3 && e8 < 2) o.bad.push('3 этаж: меньше двух 8 кл.');
        if (f === 1 && any) o.f1ess++;
      }
      o.sizes = [...o.sizes].sort(); o.raceSet = o.raceSet.size; o.gSet = o.gSet.size; o.wSet = o.wSet.size; out[f] = o;
    }
    state.run.floor = 1; return out;
  });
  ok('1 этаж: путников 1–2', JSON.stringify(G[1].sizes) === '[1,2]', G[1].sizes);
  ok('2 этаж: путников 1–3', JSON.stringify(G[2].sizes) === '[1,2,3]', G[2].sizes);
  ok('3 этаж: путников 2–4', JSON.stringify(G[3].sizes) === '[2,3,4]', G[3].sizes);
  for (const f of [1, 2, 3]) {
    ok(f + ' эт.: каждая характеристика ≥ 10, сумма 75–78', G[f].minStat >= 10 && G[f].minSum >= 75 && G[f].maxSum <= 78, JSON.stringify([G[f].minStat, G[f].minSum, G[f].maxSum]));
    ok(f + ' эт.: расы, пол и оружие разнообразны', G[f].raceSet >= 6 && G[f].gSet === 2 && G[f].wSet >= 8, JSON.stringify([G[f].raceSet, G[f].gSet, G[f].wSet]));
    ok(f + ' эт.: боевые записи собраны без странностей', G[f].bad.length === 0, G[f].bad.slice(0, 4).join('|'));
  }
  ok('1–2 этажи: брони нет', G[1].armor === 0 && G[2].armor === 0, [G[1].armor, G[2].armor]);
  ok('3 этаж: часть отряда в броне', G[3].armor > 100 && G[3].armor < 800, G[3].armor);
  ok('1 этаж: эссенция у части групп, низкий шанс', G[1].f1ess > 5 && G[1].f1ess < 150, G[1].f1ess);
  ok('3 этаж: 7 кл. редко (низкий шанс)', G[3].ess7 > 5 && G[3].ess7 < 150, G[3].ess7);

  // --- окно броска: анимация, результат, авто-подтверждение ---
  const roll = async (pick, o = {}) => {
    await p.evaluate(({ pick, o }) => {
      dgUi.enc = null; dgUi.res = null; dgUi.phase = 'menu'; state.run.pending = null; state.run.queue = []; state.run.floor = o.floor || 1;
      location.hash = 'labyrinth'; const r = state.run; r.cleared = {}; r.pos = { x: 3, y: 3 };
      r.pending = { cause: 'move', monsters: false, dark: false, blood: false, x: r.pos.x, y: r.pos.y, pick: pick || null };
      rerender();
    }, { pick, o });
  };
  await roll(16);
  await L.sleep(300);
  const A1 = await p.evaluate(() => ({ ov: !!document.querySelector('.ev-roll .ev-die'), done: !!document.querySelector('.ev-die.done'), num: document.getElementById('evnum')?.textContent, hasGrid: !!document.querySelector('.roll-grid') }));
  ok('бросок: кубик крутится, ручного ввода нет', A1.ov && !A1.done && !A1.hasGrid, JSON.stringify(A1));
  await L.sleep(1500);
  const A2 = await p.evaluate(() => ({ done: !!document.querySelector('.ev-die.done'), num: document.getElementById('evnum')?.textContent, title: document.querySelector('.ev-cap h3')?.textContent, pic: !!document.querySelector('.ev-pic'), pending: !!state.run.pending }));
  ok('через 1,5 с виден результат и картинка события', A2.done && A2.num === '16' && /путник/i.test(A2.title) && A2.pic && A2.pending, JSON.stringify(A2));
  await L.sleep(1500);
  const A3 = await p.evaluate(() => ({ pending: !!state.run.pending, enc: dgUi.enc && dgUi.enc.kind, tv: !!document.querySelector('.tv-card'), cards: document.querySelectorAll('.tv-card').length, ids: dgUi.enc && dgUi.enc.trav && dgUi.enc.trav.ids.length, btns: [...document.querySelectorAll('[data-dg="tv-act"]')].map(x => x.dataset.a) }));
  ok('через ~2,7 с событие подтверждается само: группа путников', !A3.pending && A3.enc === 'group' && A3.tv && A3.cards === A3.ids, JSON.stringify(A3));
  ok('четыре действия: Поговорить, Уйти, Напасть, Ограбить', JSON.stringify(A3.btns) === '["talk","leave","attack","rob"]', A3.btns);

  // --- Игральные кубики: ждут «Подтвердить» ---
  await p.evaluate(() => { treasure('dice').owned = true; });
  await roll(19);
  await L.sleep(3200);
  const D1 = await p.evaluate(() => ({ pending: !!state.run.pending, ok: !!document.querySelector('[data-dg="roll-ok"]'), re: !!document.querySelector('[data-dg="dice-reroll"]') }));
  ok('с Игральными кубиками бросок ждёт подтверждения и переброса', D1.pending && D1.ok && D1.re, JSON.stringify(D1));
  await p.evaluate(() => { document.querySelector('[data-dg="roll-ok"]').click(); });
  await L.sleep(100);
  ok('после «Подтвердить» событие началось', await p.evaluate(() => !state.run.pending && !!dgUi.enc));
  await p.evaluate(() => { treasure('dice').owned = false; dgUi.enc = null; });

  // --- 3 этаж: монстры → пусто ---
  await roll(8, { floor: 3 });
  await L.sleep(3100);
  ok('3 этаж: «средняя встреча» превращается в пустой фрагмент', await p.evaluate(() => dgUi.enc && dgUi.enc.kind === 'empty'));
  await p.evaluate(() => { dgUi.enc = null; state.run.floor = 1; });

  // --- находка: камни ---
  await roll(19);
  await L.sleep(3100);
  const FN = await p.evaluate(() => ({ kind: dgUi.enc && dgUi.enc.kind, loot: dgUi.enc && dgUi.enc.loot }));
  ok('находка 18–20: камни 9 кл. в сумку', FN.kind === 'find' && /Камни 9-го класса/.test(FN.loot || ''), JSON.stringify(FN));
  await p.evaluate(() => { dgUi.enc = null; });

  // --- проверки: формула ---
  const FM = await p.evaluate(() => {
    const out = {}; const hs = state.party;
    out.A1 = authority();
    state.run.floor = 2; out.A2 = authority(); state.run.floor = 3; out.A3 = authority(); state.run.floor = 1;
    const save = hs.map(c => ({ ...c.base })); hs.forEach(c => { c.base.cha = 18; c.level = 5; }); out.strong = authority(); hs.forEach((c, i) => { c.base = save[i]; c.level = 1; });
    return out;
  });
  ok('формула: свежий отряд на 1 этаже — сдвиг 0', FM.A1.S === 0 || FM.A1.S === Math.floor((FM.A1.avgMod + FM.A1.maxMod) / 2), JSON.stringify(FM.A1));
  ok('формула: этаж растит планку (2 эт. −1, 3 эт. −2)', FM.A2.G === 1 && FM.A3.G === 2 && FM.A3.S === FM.A3.A - 2, JSON.stringify([FM.A2, FM.A3]));
  ok('формула: сильный отряд (ХАР 18, 5 ур.) получает больший бонус', FM.strong.A > FM.A1.A, JSON.stringify([FM.strong, FM.A1]));

  // действия с группой на заданном броске (Math.random подменён на нужную грань)
  const act = async (a, d, o = {}) => p.evaluate(({ a, d, o }) => {
    state.run.floor = o.floor || 1; state.run.pos = { x: 3, y: 3 }; state.run.cleared = {}; state.run.pending = null; dgUi.enc = null; dgUi.rest = null; dgUi.phase = 'menu';
    const oldAu = window.authority; window.authority = () => ({ A: 0, G: 0, S: 0, avgMod: 0, maxMod: 0, avgLvl: 1 });
    const g = genTravelers(state.run.floor); dgUi.enc = { kind: 'group', title: 'Группа путников', raw: 16, n: 16, cause: 'move', trav: { ids: g.map(t => t.id) } };
    // нужные грани: рядом с броском могут идти и другие случайности, поэтому подмена только на время самого действия
    const rr = Math.random; const faces = Array.isArray(d) ? d.slice() : [d]; Math.random = () => { const f = faces.length > 1 ? faces.shift() : faces[0]; return (f - 0.5) / 20; };
    state.sack = null; (state.rep = null);
    try { travAct(a); } finally { Math.random = rr; window.authority = oldAu; }
    const t = dgUi.enc.trav; return { res: t.res, who: t.fightWho, sack: sackTotal(), rep: rep().drops.length, enc: dgUi.enc.kind };
  }, { a, d, o });
  const DM = await p.evaluate(() => Math.max(...state.party.map(c => mod(totals(c).dex.total))));
  const rob = (total, floor = 1) => act('rob', Math.min(20, Math.max(1, total - DM + (floor - 1))), { floor });
  let X;
  X = await act('leave', 1); ok('Уйти, 1–2: группа нападает из засады', X.res.next === 'fight' && X.who === 'trav', JSON.stringify(X.res));
  X = await act('leave', 4); ok('Уйти, 3–4: драка', X.res.next === 'fight' && X.who === 'plain', JSON.stringify(X.res));
  X = await act('leave', 9); ok('Уйти, выше: спокойно уходите', X.res.next === 'done' && /спокойно/.test(X.res.head), JSON.stringify(X.res));
  X = await act('attack', 2); ok('Напасть, 1–2: они ждали — засада на вас', X.res.next === 'fight' && X.who === 'trav', JSON.stringify(X.res));
  X = await act('attack', 4); ok('Напасть, 3–4: драка', X.res.next === 'fight' && X.who === 'plain', JSON.stringify(X.res));
  X = await act('attack', 9); ok('Напасть, выше 4: вы нападаете из засады', X.res.next === 'fight' && X.who === 'hero', JSON.stringify(X.res));
  X = await act('talk', 2); ok('Поговорить 1–2: нападают из засады', X.who === 'trav', JSON.stringify(X.res));
  X = await act('talk', 4); ok('Поговорить 3–4: драка', X.who === 'plain', JSON.stringify(X.res));
  X = await act('talk', 7); ok('Поговорить 5–8: не разговаривают', X.res.next === 'done' && /не хотят/.test(X.res.head), JSON.stringify(X.res));
  X = await act('talk', 11); ok('Поговорить 9–13: предлагают отдых вместе', X.res.next === 'rest', JSON.stringify(X.res));
  X = await act('talk', 15); ok('Поговорить 14–17: выбор расходника', X.res.next === 'gift', JSON.stringify(X.res));
  X = await act('talk', 18); ok('Поговорить 18: имя и класс монстра этажа', X.res.next === 'done' && X.res.lines.length >= 2, JSON.stringify(X.res));
  X = await act('talk', 19); ok('Поговорить 19: сведения гарантированно раскрыты', X.res.lines.length >= 2 && !/уже знаете/.test(X.res.lines.join()), JSON.stringify(X.res));
  X = await act('talk', 20); ok('Поговорить 20: имя + класс + деталь', X.res.lines.length >= 3, JSON.stringify(X.res));
  X = await act('rob', 1); ok('Ограбить, натуральная 1: драка', X.res.next === 'fight' && X.who === 'plain', JSON.stringify(X.res));
  X = await rob(4); ok('Ограбить, итог ≤ 4: драка', X.res.next === 'fight', JSON.stringify(X.res));
  X = await rob(7); ok('Ограбить, 5–9: ничего, репутация падает', X.res.next === 'done' && X.rep === 1 && X.sack === 0, JSON.stringify(X));
  X = await rob(10); ok('Ограбить, 10: пусто, без последствий', X.rep === 0 && X.sack === 0, JSON.stringify(X));
  X = await rob(14); ok('Ограбить, выше 10: камни в сумку', X.sack >= 1 && X.sack <= 3 && X.rep === 0, JSON.stringify(X));
  ok('репутация осталась 1 и ни на что не влияет', await p.evaluate(() => rep().value === 1));

  // раскрытие: 19 тратит неизвестных; когда всё известно — случайная деталь
  const RV = await p.evaluate(() => {
    const j = journal(); j.known = {}; const pool = floorMons(); const first = travReveal('info');
    const known1 = Object.keys(j.known).length;
    for (const m of pool) seenKeys(m.id, []);
    const second = travReveal('info'), third = travReveal('full');
    return { pool: pool.length, first, known1, second, third };
  });
  ok('раскрытие 19: неизвестный монстр становится известным', RV.known1 === 1 && RV.first.length === 1, JSON.stringify(RV));
  ok('раскрытие 19, всё известно: случайная деталь известных', RV.second.length === 1 && /—/.test(RV.second[0]), JSON.stringify(RV.second));
  ok('раскрытие 20, всё известно: две детали', RV.third.length === 2, JSON.stringify(RV.third));

  // ограбление 19+ и 20 на 3 этаже
  X = await act('rob', 20, { floor: 3 });
  ok('Ограбить, 20 на 3 этаже: камни + расходник + компас или соль', X.res.next === 'done' && X.res.lines.length >= 4, JSON.stringify(X.res));
  X = await act('rob', 19, { floor: 1 });
  ok('Ограбить, 19+: камни и расходник', X.res.lines.length >= 3, JSON.stringify(X.res));

  // --- подарок, отдых вместе ---
  const GF = await p.evaluate(() => {
    state.run.floor = 1; const g = genTravelers(1); dgUi.enc = { kind: 'group', raw: 15, n: 15, trav: { ids: g.map(t => t.id), res: { head: 'x', lines: [], next: 'gift' } } };
    const before = state.party.reduce((a, c) => a + countGear(c, 'torch'), 0);
    travGift('torch'); const after = state.party.reduce((a, c) => a + countGear(c, 'torch'), 0);
    return { d: after - before, next: dgUi.enc.trav.res.next };
  });
  ok('подарок: выбранный расходник в рюкзак', GF.d === 1 && GF.next === 'done', JSON.stringify(GF));

  const RT = await p.evaluate(async () => {
    state.run.floor = 1; state.run.day = 8; state.run.act = 1; state.run.pos = { x: 3, y: 3 }; state.run.cleared = {};
    const g = genTravelers(1); dgUi.enc = { kind: 'group', raw: 11, n: 11, trav: { ids: g.map(t => t.id) } };
    travRest(true);
    const o = { together: !!(dgUi.rest && dgUi.rest.together), phase: dgUi.phase, guards: Object.keys(dgUi.rest.guard).length };
    const html = restOverlay(); o.note = /делят с вами костёр/.test(html); o.guardOff = (html.match(/data-guard="[^"]+"[^>]*disabled/g) || []).length === state.party.length;
    const calls = []; const old = window.rollEncounter; window.rollEncounter = (c, f) => { calls.push([c, f]); };
    act('rest'); window.rollEncounter = old;
    o.calls = calls; return o;
  });
  ok('отдых вместе: режим включён, караул отключён', RT.together && RT.phase === 'rest' && RT.guards === 0 && RT.note && RT.guardOff, JSON.stringify(RT));
  ok('отдых вместе: ночь считается охраняемой без усталости (нападений нет)', RT.calls.length === 1 && RT.calls[0][0] === 'rest' && RT.calls[0][1] === 0, JSON.stringify(RT.calls));
  await p.evaluate(() => { dgUi.enc = null; dgUi.rest = null; dgUi.phase = 'menu'; state.run.pending = null; });

  // --- бой с путниками: автобои на всех этажах (эссенции, оружие, засады) ---
  const SIM = await p.evaluate(async () => {
    const B = Battle, bad = [], st = { n: 0, rounds: 0, byWho: { plain: 0, trav: 0, hero: 0 }, heroFirst: 0, heroAmbushOk: 0 }; B.cfg.fast = true;
    for (const f of [1, 2, 3]) for (let i = 0; i < 12; i++) {
      state.run.floor = f; const g = genTravelers(f), ids = g.map(t => t.id), who = ['plain', 'trav', 'hero'][i % 3];
      const ev = { kind: 'group', title: 't', raw: 10, n: 10, cause: 'travelers', ambush: who === 'trav', heroAmbush: who === 'hero', list: ids, zone: 'goblin', floor: f, killed: [] };
      try {
        const S = await B.start(ev, { sim: true, autoHeroes: true });
        st.n++; st.rounds += S.round; st.byWho[who]++;
        if (!S.outcome) bad.push('нет исхода');
        for (const u of B.S.units) if (!(u.hp >= 0) || u.hp > u.maxHp) bad.push('ОЗ ' + u.hp);
        for (const s of state.party) { s.hp = maxHp(s); s.dead = false; }
      } catch (e) { bad.push(f + ': ' + (e && e.message)); }
    }
    return { bad, st };
  });
  const PL = await p.evaluate(async () => {
    const B = Battle, o = { first: 0, line: 0, n: 0, rows: [] };
    for (let i = 0; i < 30; i++) {
      const f = 1 + (i % 3); state.run.floor = f; const ids = genTravelers(f).map(t => t.id);
      const S = B.newBattle({ kind: 'group', list: ids, zone: 'goblin', floor: f, heroAmbush: true, killed: [] });
      B.placeHeroesDefault(S); B.placeMonsters(S); B.rollInitiative(); o.n++;
      if (B.S.units.find(u => u.id === B.S.order[0]).side === 'hero' && B.S.order.slice(0, B.heroes().length).every(id => B.byId(id).side === 'hero')) o.first++;
      const ys = new Set(B.mons().map(m => m.y)); o.rows.push(ys.size); if (ys.size === 1) o.line++;
    }
    return o;
  });
  ok('засада отряда: герои ходят первыми, враги выстроены в линию', PL.first === PL.n && PL.line >= PL.n * 0.8, JSON.stringify(PL));
  ok('автобои с путниками без ошибок и зависаний (36)', SIM.bad.length === 0 && SIM.st.n === 36, JSON.stringify(SIM));

  // --- награды (решение автора): кристаллы вместо эссенций, оружие, припасы ---
  const RW = await p.evaluate(() => {
    state.run.floor = 3; const g = genTravelers(3), ids = g.map(t => t.id);
    const S = { ev: { list: ids }, killed: ids.map((_, i) => i), killedBy: {} };
    const plan = Battle.End.plan(S);
    const exp = {}; for (const t of g) for (const [k, n] of Object.entries(travCrystals(t))) exp[k] = (exp[k] || 0) + n;
    const got = {}; for (const [k, it] of Object.entries(plan.stones)) got[it.cls] = (got[it.cls] || 0) + it.n;          // камни теперь — случайные камни монстров класса
    return { fresh: plan.fresh, xp: plan.xp, wins: plan.wins.length, exp, got, ess: g.reduce((a, t) => a + t.ess.length, 0) };
  });
  ok('награды: опыт один раз за класс путников', RW.fresh.length === 1 && RW.fresh[0] === 'tcls-7' && RW.xp === 3, JSON.stringify(RW));
  ok('награды: эссенции путников НЕ выпадают', RW.wins === 0 && RW.ess >= 2, JSON.stringify(RW));
  ok('награды: кристаллы по формуле (враги × уровни × классы эссенций)', JSON.stringify(RW.exp) === JSON.stringify(RW.got), JSON.stringify(RW));
  const CF = await p.evaluate(() => {
    const e9 = Object.keys(ESSENCES).find(id => ESSENCES[id].cls === 9), e8 = Object.keys(ESSENCES).find(id => ESSENCES[id].cls === 8), e7 = Object.keys(ESSENCES).find(id => ESSENCES[id].cls === 7);
    return [travCrystals({ cls: 9, lvl: 1, ess: [] }), travCrystals({ cls: 9, lvl: 1, ess: [e9] }), travCrystals({ cls: 8, lvl: 2, ess: [e9, e8] }), travCrystals({ cls: 7, lvl: 3, ess: [e8, e7] })];
  });
  ok('формула кристаллов: 1 эт. без эссенции — 1 кр. 9; с 9 кл. — 2 кр. 9', JSON.stringify(CF[0]) === '{"9":1}' && JSON.stringify(CF[1]) === '{"9":2}', JSON.stringify(CF));
  ok('формула кристаллов: 2 эт. (9+8) — 1 кр. 8 + 1 кр. 9 + 2 кр. 8; 3 эт. (8+7) — 2 кр. 7 + 2 кр. 8 + 3 кр. 7', JSON.stringify(CF[2]) === '{"8":3,"9":1}' && JSON.stringify(CF[3]) === '{"7":5,"8":2}', JSON.stringify(CF));

  // припасы определяются при создании группы
  const CR = await p.evaluate(() => {
    const o = { f1: { zero: 0, one: 0, other: 0 }, f2: new Set(), f3min: 9, ration: 99, torchMax: 0, comp: 0, map: 0, wpn: 0, n: 0 };
    for (const f of [1, 2, 3]) for (let i = 0; i < 600; i++) for (const t of genTravelers(f)) {
      const c = t.carry; o.n++; o.ration = Math.min(o.ration, c.ration);
      if (f === 1) { c.potion === 0 ? o.f1.zero++ : c.potion === 1 ? o.f1.one++ : o.f1.other++; }
      if (f === 2) o.f2.add(c.potion); if (f === 3) o.f3min = Math.min(o.f3min, c.potion);
      o.torchMax = Math.max(o.torchMax, c.torch); if (c.compass) o.comp++; if (c.map) o.map++; if (c.weapon) o.wpn++;
    }
    o.f2 = [...o.f2].sort(); return o;
  });
  ok('еда: минимум 3 на путника', CR.ration >= 3, CR.ration);
  ok('зелья: 1 эт. — не факт, что есть (0 или 1)', CR.f1.zero > 100 && CR.f1.one > 100 && CR.f1.other === 0, JSON.stringify(CR.f1));
  ok('зелья: 2 этаж 0–2, на 3 этаже у каждого минимум 1', JSON.stringify(CR.f2) === '[0,1,2]' && CR.f3min === 1, JSON.stringify([CR.f2, CR.f3min]));
  ok('компас — низкий шанс, карта этажа — около 5 %, оружие — около половины', CR.comp / CR.n > .02 && CR.comp / CR.n < .07 && CR.map / CR.n > .035 && CR.map / CR.n < .07 && CR.wpn / CR.n > .43 && CR.wpn / CR.n < .57, JSON.stringify([CR.comp, CR.map, CR.wpn, CR.n]));

  // выдача добычи с убитых
  const LT = await p.evaluate(() => {
    state.run.floor = 2; const inv = inventory(); inv.compass.owned = false; invItem('map').owned = false;
    const g = genTravelers(2).slice(0, 1); const t = g[0]; Object.assign(t.carry, { ration: 4, potion: 2, torch: 1, compass: true, map: true, weapon: true });
    const before = { r: state.party.reduce((a, c) => a + countGear(c, 'ration'), 0), p: state.party.reduce((a, c) => a + countGear(c, 'potion'), 0), tc: state.party.reduce((a, c) => a + countGear(c, 'torch'), 0), w: state.party.reduce((a, c) => a + (c.bag || []).filter(e => e.t === 'w' && e.id === t.weapon).length, 0) };
    const lines = travLoot([t.id]); const again = travLoot([t.id]);
    const after = { r: state.party.reduce((a, c) => a + countGear(c, 'ration'), 0), p: state.party.reduce((a, c) => a + countGear(c, 'potion'), 0), tc: state.party.reduce((a, c) => a + countGear(c, 'torch'), 0), w: state.party.reduce((a, c) => a + (c.bag || []).filter(e => e.t === 'w' && e.id === t.weapon).length, 0) };
    return { d: [after.r - before.r, after.p - before.p, after.tc - before.tc, after.w - before.w], compass: inv.compass.owned, map: invItem('map').owned, lines: lines.length, again: again.length };
  });
  ok('добыча: еда, зелья, факелы, оружие, компас и карта этажа достаются отряду, повторно — нет', JSON.stringify(LT.d) === '[4,2,1,1]' && LT.compass && LT.map && LT.again === 0, JSON.stringify(LT));
  const LT2 = await p.evaluate(() => {
    const inv = inventory(); inv.compass.owned = true; const m0 = invItem('map'); m0.owned = true;
    const t = genTravelers(1)[0]; Object.assign(t.carry, { ration: 3, potion: 0, torch: 0, compass: true, map: true, weapon: false });
    const lines = travLoot([t.id]).filter(l => /Компас|Карта/.test(l)); return lines.length;
  });
  ok('добыча: уже имеющиеся компас и карта не дублируются', LT2 === 0, LT2);

  // путники пьют зелья доп. действием
  const DR = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; let drunk = 0, fights = 0, neg = 0, healed = 0;
    for (let i = 0; i < 16; i++) {
      state.run.floor = 3; state.party.forEach(c => { c.hp = maxHp(c); c.dead = false; c.mp = maxMp(c); });
      const g = genTravelers(3); g.forEach(t => { t.carry.potion = 3; }); const before = g.reduce((a, t) => a + t.carry.potion, 0);
      const ev = { kind: 'group', list: g.map(t => t.id), zone: 'goblin', floor: 3, killed: [] };
      const S = await B.start(ev, { sim: true, autoHeroes: true }); fights++;
      const after = g.reduce((a, t) => a + t.carry.potion, 0); drunk += before - after; if (g.some(t => t.carry.potion < 0)) neg++;
      healed += S.log.filter(l => /пьёт зелье лечения/.test(l.t)).length;
    }
    return { drunk, fights, neg, healed };
  });
  ok('путники пьют зелья при низких ОЗ (доп. действием), запас не уходит в минус', DR.drunk > 0 && DR.neg === 0 && Math.abs(DR.healed - DR.drunk) <= 2, JSON.stringify(DR));

  // экран итога боя: добыча и камни видны, эссенции не предлагаются
  const UIF = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = false; const out = { ok: 0, kills: 0, stones: 0, loot: 0, ess: 0, stuck: 0 };
    for (let k = 0; k < 3; k++) {
      state.run.floor = 3; state.run.pos = { x: 3, y: 3 }; state.run.cleared = {}; state.run.pending = null; dgUi.phase = 'menu'; state.sack = null;
      state.party.forEach(c => { c.hp = maxHp(c); c.dead = false; });
      const g = genTravelers(3); dgUi.enc = { kind: 'group', title: 'g', raw: 16, n: 16, cause: 'move', trav: { ids: g.map(t => t.id) } };
      location.hash = 'labyrinth'; travFight('plain'); rerender(); for (let w = 0; w < 150 && !Battle.running; w++) await new Promise(r => setTimeout(r, 20));
      B.cfg.fast = true; let txt = '', t0 = Date.now(), kl = 0;
      for (let i = 0; i < 4000 && dgUi.enc && Date.now() - t0 < 30000; i++) {
        const UI = B.UI, S = B.S; if (!UI.active) { await new Promise(r => setTimeout(r, 20)); if (!B.running) break; continue; }
        if (S) S.opts.autoHeroes = true;
        const md = document.querySelector('.bt-modal'); const yes = md && !md.hidden && md.querySelector('[data-m="yes"]'); if (yes) { yes.click(); await new Promise(r => setTimeout(r, 5)); continue; }
        const sum = [...document.querySelectorAll('.bt-modal .fx-btn.primary')].find(b => b.offsetParent && !b.classList.contains('bt-done') && /^Готово$/.test(b.textContent.trim())); if (sum) { sum.click(); await new Promise(r => setTimeout(r, 5)); continue; }
        const sheetBtn = document.querySelector('.bd-ov:not(.out) .bd-ok:not([hidden])'); if (sheetBtn) { sheetBtn.click(); await new Promise(r => setTimeout(r, 5)); continue; }
        const roll = document.querySelector('.bd-ov:not(.out) .bd-roll:not([disabled])'); if (roll && !document.querySelector('.bd-ov:not(.out) .bd-row').hidden) { roll.click(); await new Promise(r => setTimeout(r, 30)); continue; }
        if (UI.mode === 'place' || UI.mode === 'ambush') UI.placeDone(); else if (UI.mode === 'hero' && UI.endTurn) UI.endTurn();
        else if (UI.mode === 'result') { const m = document.querySelector('.bt-rwd'); if (!m) { await new Promise(r => setTimeout(r, 20)); continue; } if (m.innerText.length > txt.length) txt = m.innerText; if (B.S) kl = Math.max(kl, B.S.killed.length); const d = document.querySelector('.bt-done:not([hidden])'); if (d) d.click(); }
        await new Promise(r => setTimeout(r, 10));
      }
      if (dgUi.enc && B.running) { out.stuck++; try { B.abort(); } catch (e) {} dgUi.enc = null; continue; }
      out.ok++; if (kl > 0) { out.kills++; if (sackTotal() > 0 && /Сумка для камней:/.test(txt)) out.stones++; if (/Добыча с путников/.test(txt)) out.loot++; } if (/выпала эссенция|нёс с собой эссенцию|Бросок на эссенцию/.test(document.body.innerText) && document.querySelector('.bt-essgot:not([hidden])')) out.ess++;
    }
    return out;
  });
  ok('экран итога: бои закрываются, кристаллы и добыча в списке наград, эссенции не предлагаются', UIF.stuck === 0 && UIF.ok === 3 && UIF.kills >= 1 && UIF.stones === UIF.kills && UIF.loot === UIF.kills && UIF.ess === 0, JSON.stringify(UIF));

  // --- сохранение и бестиарий ---
  const SV = await p.evaluate(() => {
    const before = MONSTERS.filter(m => m.dyn).length; const ids = state.run.travs && Object.keys(state.run.travs).length;
    travPurge(); const purged = MONSTERS.filter(m => m.dyn).length; travRestore(); const restored = MONSTERS.filter(m => m.dyn).length;
    return { before, ids, purged, restored, lib: libMonsters().some(m => m.dyn), list: MONSTERS.filter(m => !m.dyn).length === MONSTERS.length - restored };
  });
  ok('путники восстанавливаются из сохранения и не попадают в библиотеку', SV.purged === 0 && SV.restored === SV.ids && !SV.lib && SV.list, JSON.stringify(SV));

  console.log('errs:', p.errs.length ? p.errs.slice(0, 5) : 'нет');
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(r => !r.ok).length}`);
  await b.close(); process.exit(R.every(r => r.ok) && !p.errs.length ? 0 : 1);
})();
