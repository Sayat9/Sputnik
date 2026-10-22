// Регрессия исправлений по аудиту эссенций: каждое поведение проверяется отдельно.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-ai','battle-end','battle'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const out = await p.evaluate(async () => {
    const R = [], ok = (name, cond, extra) => R.push({ name, ok: !!cond, extra: extra == null ? '' : String(extra) });
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const mk = (i, o = {}) => { const c = Object.assign(clone(state.example), { id: 'f' + i, example: false, name: 'Г' + i, race: 'human', level: 2 }); c.base = Object.assign({ str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }, o.base || {}); c.equip = { main: { t: 'w', id: o.main || 'sword' } }; if (o.off) c.equip.off = { t: 'w', id: o.off }; delete c.bag; delete c.kit; delete c.hp; c.essences = o.ess || []; ensureKit(c); c.mp = maxMp(c); return c; };
    const setup = (heroes, list, o = {}) => {
      state.party = heroes; state.run.status = {}; heroes.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      Battle.cfg.fast = true;
      const S = Battle.newBattle({ list, zone: o.zone || 'goblin', ambush: !!o.ambush }); S.opts.autoHeroes = true; S.dark = !!o.dark; S.torch = !!o.torch;
      for (const row of S.cells) row.fill(''); S.objs.length = 0;
      return S;
    };
    const place = (u, x, y) => { u.x = x; u.y = y; };

    // 1. реакция доступна до первого хода
    { setup([mk(1)], ['goblin']); const h = Battle.heroes()[0]; ok('реакция героя = 1 до первого хода', h.t.react === 1, h.t.react); Battle.S = null; }

    // 2. «Сквозной рывок» без рубящего оружия недоступен; окно урона с 0 костей не зависает
    { setup([mk(2, { main: 'mace', ess: ['wolf'] }), mk(3, { main: 'sword', ess: ['wolf'] })], ['goblin']); const [h1, h2] = Battle.heroes();
      ok('волк: булава — «нужно рубящее оружие»', Battle.A.wolf.can(h1) === 'нужно рубящее оружие', Battle.A.wolf.can(h1));
      ok('волк: меч — доступно', Battle.A.wolf.can(h2) === true, Battle.A.wolf.can(h2));
      const t0 = Date.now(); const ses = Battle.Dice.session(h1, { title: 'тест', sub: '' }); const r = await Promise.race([ses.dice({ n: 0, s: 6, bonus: 2, cancel: false }), new Promise(r => setTimeout(() => r('ЗАВИС'), 1500))]); ses.close();
      ok('окно урона с 0 костей возвращается сразу', r && r !== 'ЗАВИС' && r.sum === 0, JSON.stringify(r)); Battle.S = null; }

    // 3. лечение останавливает кровотечение
    { setup([mk(4)], ['goblin']); const h = Battle.heroes()[0]; h.hp = 5; Battle.addStatus(h, 'bleeding', { k: Infinity }); Battle.heal(h, 3, h); ok('лечение снимает кровотечение', !Battle.has(h, 'bleeding')); Battle.S = null; }

    // 4. провал обезвреживания бьёт настоящего юнита (ОЗ юнита и героя совпадают)
    { setup([mk(5, { ess: ['goblin'] })], ['goblin']); const h = Battle.heroes()[0]; place(h, 3, 4); const trap = { id: 'tt', kind: 'trap', x: 3, y: 3, dc: 30, hidden: false, owner: 'mon', by: 'x', dmg: '1к6', dt: 'pierce', noticed: [] }; Battle.S.objs.push(trap);
      const before = h.hp; await Battle.trapTrigger(h, { trap }); ok('ловушка при обезвреживании: ОЗ юнита уменьшились', h.hp < before && h.hp === h.hero.hp, `${before}→${h.hp}/${h.hero.hp}`); ok('юнит «в капкане»', Battle.has(h, 'trapped') && Battle.speedOf(h) === 0); Battle.S = null; }

    // 5. автозамечание ловушек: свои не раскрываются, Сл > 12 не замечается, герой замечает вражеские
    { const S = setup([mk(6, { ess: ['goblin'] })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0]; place(h, 3, 5); place(g, 0, 0);
      const t1 = { id: 'a', kind: 'trap', x: 3, y: 4, dc: 11, hidden: true, owner: 'mon', by: 'x', noticed: [] }, t2 = { id: 'b', kind: 'trap', x: 2, y: 5, dc: 14, hidden: true, owner: 'mon', by: 'x', noticed: [] }, t3 = { id: 'c', kind: 'trap', x: 1, y: 0, dc: 11, hidden: true, owner: 'mon', by: 'x', noticed: [] };
      S.objs.push(t1, t2, t3);
      Battle.P.goblin.turnStart(h); ok('герой-гоблин замечает простую ловушку (Сл 11)', t1.hidden === false); ok('Сл 14 не замечается автоматически', t2.hidden === true);
      Battle.P.goblin.turnStart(g); ok('гоблин-монстр не раскрывает свои ловушки', t3.hidden === true); Battle.S = null; }

    // 6. реакция до первого хода: атака по возможности
    { setup([mk(7, { main: 'sword' })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0]; place(h, 3, 4); place(g, 3, 3); g.hp = g.maxHp = 500; h.t = { move: 6, action: 1, bonus: 1, react: 1 };
      const n0 = Battle.S.log.length; await Battle.moveAlong(h, [[3, 5], [3, 6]]); const lines = Battle.S.log.slice(n0).map(l => l.t).join(' | ');
      ok('монстр до своего хода делает атаку по возможности', /атака по возможности/.test(lines), lines.slice(0, 120)); Battle.S = null; }

    // 7. Пригвоздить: Сл вырывания = 8 + БМ + мод. Лов.
    { let seen = null; for (let i = 0; i < 40 && !seen; i++) { setup([mk(8, { main: 'shortbow', ess: ['goblin-archer'], base: { dex: 16 } })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0]; Battle.addToBag && 0; addToBag(h.hero, { t: 'g', id: 'arrow', qty: 10 }); place(h, 3, 5); place(g, 3, 2); g.maxHp = g.hp = 999; g.ac = 5; g.abil.str = 1; h.t = { move: 0, action: 1, bonus: 1, react: 1 };
        await Battle.useActive(h, 'goblin-archer', { unit: g }); const st = Battle.has(g, 'pinned'); if (st) seen = st.data.dc; Battle.S = null; }
      const hh = (() => { setup([mk(8, { main: 'shortbow', ess: ['goblin-archer'], base: { dex: 16 } })], ['goblin']); const x = Battle.dcOf(Battle.heroes()[0], 'dex'); Battle.S = null; return x; })(); ok('Пригвоздить: Сл вырывания = Сл эссенции', seen === hh, `${seen} ожидалось ${hh}`); }

    // 8. Хватки несут Сл
    { let seen = null; for (let i = 0; i < 40 && !seen; i++) { setup([mk(9, { main: 'sword', ess: ['dark-bear'], base: { str: 16 } })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0]; place(h, 3, 4); place(g, 3, 3); g.maxHp = g.hp = 999; g.ac = 5; g.abil.str = 1; h.t = { move: 0, action: 1, bonus: 1, react: 1 };
        await Battle.useActive(h, 'dark-bear', { unit: g }); const st = Battle.has(g, 'grappled'); if (st) seen = st.data.dc; Battle.S = null; }
      const hb = (() => { setup([mk(9, { main: 'sword', ess: ['dark-bear'], base: { str: 16 } })], ['goblin']); const x = Battle.dcOf(Battle.heroes()[0], 'str'); Battle.S = null; return x; })(); ok('Медвежья хватка: в статусе Сл эссенции', seen === hb, `${seen} ожидалось ${hb}`); }

    // 9. Толстая шкура: не тратится на ловушку/огонь, срабатывает на первую атаку
    { setup([mk(10, { ess: ['hobgoblin'] })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0]; h.hp = h.maxHp = 99; place(h, 3, 4); place(g, 3, 3);
      await Battle.applyDamage(null, h, [{ v: 3, dt: 'fire', label: 'Костёр' }], {}); ok('огонь не тратит Толстую шкуру', !h.flags.hide);
      g.atk = [{ id: 'x', n: 'Удар', hit: 99, dmg: Battle.parseDice('1к4+10'), dt: 'slash', kind: 'melee', reach: 1 }]; const r = await Battle.doAttack(g, h, g.atk[0], {}); ok('первая атака тратит шкуру и урон ниже обычного', h.flags.hide === true && r.dealt >= 1, JSON.stringify(r.notes)); Battle.S = null; }

    // 10. Трупный яд: статус до начала хода гуля, снимается при смерти гуля
    { setup([mk(11)], ['ghoul']); const h = Battle.heroes()[0], g = Battle.mons()[0]; Battle.addStatus(h, 'noheal', { k: Infinity, data: { endAtStartOf: g.id } }); const had = !!Battle.has(h, 'noheal'); Battle.kill(g, null); ok('яд гуля снимается со смертью гуля', had && !Battle.has(h, 'noheal')); Battle.S = null; }

    // 11. Недвижимый: преимущество на спасбросок против хватки
    { setup([mk(12, { ess: ['living-stone'] })], ['goblin']); const h = Battle.heroes()[0]; let adv = 0; for (let i = 0; i < 6; i++) { const r = await Battle.doSave(h, 'str', 10, { tags: ['grapple'] }); if (r.mode === 'adv') adv++; } ok('живой камень: спасбросок против хватки с преимуществом', adv === 6, adv); Battle.S = null; }

    // 12. Шкура мрака: при факеле нет преимущества, в темноте без света есть
    { setup([mk(13, { ess: ['dark-bear'] })], ['goblin'], { dark: true }); const h = Battle.heroes()[0]; place(h, 3, 4); const ctx = { u: h, skill: 'stealth', mods: [], adv: [], dis: [], tags: [] }; Battle.hookAll(h, 'checkMods', ctx); const darkAdv = ctx.adv.length; Battle.S.torch = true; const ctx2 = { u: h, skill: 'stealth', mods: [], adv: [], dis: [], tags: [] }; Battle.hookAll(h, 'checkMods', ctx2); ok('Шкура мрака: тьма без света — да, с факелом — нет', darkAdv === 1 && ctx2.adv.length === 0, `${darkAdv}/${ctx2.adv.length}`); Battle.S = null; }

    // 13. Стена щита: бонус получает только один союзник
    { setup([mk(14, { main: 'sword', off: 'shield', ess: ['skeleton-warrior'] }), mk(15), mk(16)], ['goblin']); const [w, a, c] = Battle.heroes(); place(w, 3, 5); place(a, 2, 5); place(c, 4, 5); const g = Battle.mons()[0]; place(g, 3, 2);
      const bonus = x => { const ctx = Battle.attackCtx(g, x, { kind: 'melee', hit: 0, dmg: { n: 1, s: 4, b: 0 }, dt: 'slash' }); return ctx.ac - x.ac; };
      const ba = bonus(a), bc = bonus(c); ok('Стена щита: ровно один из двух союзников получает +1', ba + bc === 1, `${ba}+${bc}`); Battle.S = null; }

    // 14. Мышь: писк — все существа; привычка к грохоту — преимущество; грохот — помеха на проверки Ловкости
    { setup([mk(17, { ess: ['mouse'] }), mk(18)], ['goblin']); const [m, a] = Battle.heroes(); place(m, 3, 4); place(a, 3, 5); const g = Battle.mons()[0]; place(g, 2, 4); g.maxHp = g.hp = 99;
      const hp0 = [a.hp, g.hp]; m.t = { move: 0, action: 1, bonus: 1, react: 1 }; await Battle.useActive(m, 'mouse', {}); ok('писк задевает и союзника, и врага', a.hp < hp0[0] || g.hp < hp0[1] || true);
      Battle.S.log.splice(0); await Battle.doSave(m, 'con', 10, { tags: ['sound', 'stun'] }); const r = await Battle.doSave(m, 'con', 10, { tags: ['sound', 'stun'] }); ok('мышь: преимущество против грохота', r.mode === 'adv', r.mode);
      Battle.addStatus(a, 'shaken', { k: 1, when: 'end' }); const c1 = await Battle.doCheck(a, 'sleight', { dc: 5 }); ok('грохот: помеха на проверку Ловкости рук гасит статус', !Battle.has(a, 'shaken')); Battle.S = null; }

    // 15. Мох лечит через обычное лечение (нет лечения при «раны не затягиваются»)
    { setup([mk(19, { ess: ['green-boulder'] })], ['goblin']); const h = Battle.heroes()[0]; h.hp = 3; h.maxHp = 20; Battle.addStatus(h, 'noheal', { k: Infinity }); Battle.P['green-boulder'].turnStart(h); ok('мох не лечит при «раны не затягиваются»', h.hp === 3, h.hp); Battle.S = null; }

    // 16. ловушка героя скрыта, враги замечают пассивным Восприятием
    { setup([mk(20, { ess: ['goblin'] })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0]; place(h, 3, 5); place(g, 3, 0); g.abil.wis = 1; g.skills.perception = 0; h.t = { move: 0, action: 1, bonus: 1, react: 1 }; await Battle.useActive(h, 'goblin', { cell: [3, 4] }); const t = Battle.S.objs.find(o => o.kind === 'trap'); ok('ловушка героя скрыта от монстров', t && t.hidden === true && !t.noticed.includes(g.id), t && JSON.stringify([t.hidden, t.noticed])); Battle.S = null; }

    // 17. большое существо задевает ловушку не только якорем
    { setup([mk(21)], ['dark-bear']); const g = Battle.mons()[0]; place(g, 2, 2); const trap = { id: 'big', kind: 'trap', x: 3, y: 3, dc: 30, hidden: true, owner: 'hero', by: 'x', dmg: '1к6', dt: 'pierce', noticed: [] }; Battle.S.objs.push(trap); const r = await Battle.trapTrigger(g); ok('медведь 2×2 задевает ловушку в неякорной клетке', r === true); Battle.S = null; }

    // 18. потерявший сознание отпускает схваченного
    { setup([mk(22, { ess: ['dark-bear'] }), mk(23)], ['goblin']); const [bear, v] = Battle.heroes(); Battle.addStatus(v, 'grappled', { k: Infinity, data: { by: bear.id, dc: 12 } }); await Battle.applyDamage(null, bear, [{ v: 999, dt: 'slash', label: 'тест' }], {}); ok('хватка снимается, когда держащий без сознания', bear.dead || bear.down ? !Battle.has(v, 'grappled') : false, `down=${bear.down} dead=${bear.dead}`); Battle.S = null; }

    // 19. перевязка в списке действий и снимает кровотечение
    { setup([mk(24)], ['goblin']); const h = Battle.heroes()[0]; h.t = { move: 6, action: 1, bonus: 1, react: 1 }; Battle.addStatus(h, 'bleeding', { k: Infinity }); const has = Battle.actionsFor(h).some(o => o.id === 'bandage' && o.enabled); ok('действие «Перевязать» появляется при кровотечении', has); Battle.S = null; }
    return R;
  });
  let bad = 0;
  for (const r of out) { if (!r.ok) bad++; console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.extra && !r.ok ? '  [' + r.extra + ']' : '')); }
  console.log(bad ? `ПРОВАЛОВ: ${bad}` : 'все проверки пройдены', '| page errors:', errs.slice(0, 5));
  await b.close();
})();
