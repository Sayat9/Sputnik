// Регрессия правок боя: скорость, местность, автозавершение хода, бросок оружия, колчан и поломка стрел.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
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
    const mk = (i, o = {}) => { const c = Object.assign(clone(state.example), { id: 'n' + i, example: false, name: 'Г' + i, race: 'human', level: 2 }); c.base = Object.assign({ str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }, o.base || {}); c.equip = { main: { t: 'w', id: o.main || 'sword' } }; if (o.off) c.equip.off = { t: 'w', id: o.off }; delete c.bag; delete c.kit; delete c.hp; c.essences = o.ess || []; ensureKit(c); c.mp = maxMp(c); return c; };
    const setup = (heroes, list, o = {}) => {
      state.party = heroes; state.run.status = {}; heroes.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      Battle.cfg.fast = true;
      const S = Battle.newBattle({ list, zone: o.zone || 'goblin', ambush: !!o.ambush }); S.opts.autoHeroes = true; S.dark = !!o.dark; S.torch = !!o.torch;
      for (const row of S.cells) row.fill(''); S.objs.length = 0;
      return S;
    };
    const place = (u, x, y) => { u.x = x; u.y = y; };
    // управляемые кубики: очередь значений для crypto.getRandomValues (d(20) = 1 + v % 20)
    const Q = [], realGRV = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', { configurable: true, writable: true, value: arr => { if (Q.length) { arr[0] = Q.shift(); return arr; } return realGRV(arr); } });
    const forceNat = nat => { Q.length = 0; Q.push(nat - 1, 0, 0, 0); };
    const arrowsIn = c => (c.bag || []).filter(e => e.t === 'g' && e.id === 'arrow').reduce((a, e) => a + e.qty, 0);

    /* ===== 1. скорость ===== */
    {
      const spd = c => { setup([c], ['goblin']); const v = Battle.speedOf(Battle.heroes()[0]); Battle.S = null; return v; };
      ok('герой 9 м: 4 клетки (было 6)', spd(mk(1)) === 4, spd(mk(1)));
      const fast = Object.values(ESSENCES).filter(e => (e.other || []).some(o => /^Скорость \+1,5 м/.test(o))).map(e => e.id);
      ok('есть эссенции со скоростью +1,5 м', fast.length >= 2, fast.join(','));
      ok('одна эссенция +1,5 м: 5 клеток', spd(mk(2, { ess: [fast[0]] })) === 5, spd(mk(2, { ess: [fast[0]] })));
      ok('две эссенции +1,5 м: 6 клеток — всё поле', spd(mk(3, { ess: [fast[0], fast[1]] })) === 6, spd(mk(3, { ess: [fast[0], fast[1]] })));
      ok('метры → клетки: 0→0, 1,5→1, 3→1, 6→2, 9→4, 12→6', [0, 1.5, 3, 6, 9, 12].map(Battle.cellsOfM).join() === '0,1,1,2,4,6', [0, 1.5, 3, 6, 9, 12].map(Battle.cellsOfM).join());
      const want = { goblin: 4, 'goblin-archer': 4, 'goblin-sword': 4, 'goblin-spear': 4, hobgoblin: 4, 'dark-bear': 6, 'skeleton-warrior': 4, 'stone-guardian': 2, wolf: 6, fox: 6, mouse: 2, bat: 6, zombie: 2, skeleton: 4, 'skeleton-archer': 4, ghoul: 4, 'living-stone': 1, pixie: 6, wisp: 4, 'green-boulder': 2 };
      const bad = [];
      for (const [id, n] of Object.entries(want)) { setup([mk(4)], [id]); const m = Battle.mons()[0]; if (Battle.speedOf(m) !== n) bad.push(`${id}=${Battle.speedOf(m)}≠${n}`); Battle.S = null; }
      ok('скорость монстров 1 этажа в клетках', !bad.length, bad.join(' '));
    }

    /* ===== 2. местность ===== */
    {
      const N = 500, res = {};
      for (const zone of Object.keys(Battle.D.zones)) {
        let thick = 0, cover5 = 0, badRows = 0, row4 = 0, thickRows = 0, disconnected = 0, empty = 0;
        for (let i = 0; i < N; i++) {
          const g = Battle.genTerrain(zone); let nTh = 0, nCov = 0, n = 0;
          for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
            const t = g.cells[y][x]; if (!t) continue; n++; const ti = Battle.D.terrain[t];
            if (ti.thicket) { nTh++; if (y < 1 || y > 5) thickRows++; }
            if (ti.obstacle || ti.cover) nCov++;
            if (ti.obstacle && y >= 5) badRows++;
            if (ti.obstacle && y === 4) row4++;
          }
          if (nTh) thick++; if (nCov >= 5) cover5++; if (!n) empty++;
        }
        res[zone] = { thick: thick / N, cover5: cover5 / N, badRows, row4, thickRows, empty };
      }
      const z = res;
      ok('заросли есть на большинстве полей каждой зоны (≥ 50 %)', Object.values(z).every(v => v.thick >= 0.5), JSON.stringify(Object.fromEntries(Object.entries(z).map(([k, v]) => [k, v.thick]))));
      ok('укрытий (препятствия, заросли, туман) ≥ 5 клеток на большинстве полей (≥ 70 %)', Object.values(z).every(v => v.cover5 >= 0.7), JSON.stringify(Object.fromEntries(Object.entries(z).map(([k, v]) => [k, v.cover5]))));
      ok('препятствий нет в двух нижних рядах', Object.values(z).every(v => v.badRows === 0), JSON.stringify(z));
      ok('заросли только в рядах 1–5', Object.values(z).every(v => v.thickRows === 0));
      ok('поля не пустые (генерация не откатывается)', Object.values(z).every(v => v.empty === 0));
      // заросли труднопроходные: вход стоит 2, даёт укрытие и позволяет прятаться
      const th = ['bush', 'thorns', 'shrooms'].map(id => Battle.D.terrain[id]);
      ok('заросли: цена 2, укрытие +2, можно прятаться', th.every(t => t.cost === 2 && t.cover === 2 && t.hide), JSON.stringify(th.map(t => [t.cost, t.cover, t.hide])));
      ok('у каждого вида зарослей есть рисунок', ['bush', 'thorns', 'shrooms'].every(id => Battle.D.SVG[id] && Battle.D.SVG[id].length > 100));
    }

    /* ===== 3. автозавершение хода ===== */
    {
      const S = setup([mk(10, { main: 'sword' })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0]; place(h, 3, 5); place(g, 0, 0);
      const T = o => { h.t = Object.assign({ move: 0, action: 0, bonus: 0, react: 1, dash: false, disengage: false, attacked: false, riteUsed: false, objUsed: false, moved: 0 }, o); return Battle.turnSpent(h); };
      ok('есть действие — ход не кончен', T({ action: 1, move: 4 }) === false);
      ok('действие и доп. действие потрачены — ход кончен', T({}) === true);
      ok('движение одно ход не продлевает', T({ move: 3 }) === true);
      ok('доп. действие без допустимых вариантов не продлевает ход', T({ bonus: 1 }) === true, JSON.stringify(Battle.actionsFor(h).filter(o => o.time === 'bonus' && o.enabled).map(o => o.id)));
      ok('зелье есть, но все здоровы — зелье ход не продлевает', h.hp === h.maxHp && Battle.actionsFor(h).some(o => o.id === 'potion' && o.enabled && o.useless) && T({ bonus: 1 }) === true);
      h.hp = Math.max(1, h.maxHp - 3); h.hero.hp = h.hp;
      ok('герой ранен и есть зелье — ход не кончен (доп. действие можно потратить)', T({ bonus: 1 }) === false);
      ok('Рывок: действие ушло, движение осталось — ход не кончен', T({ dash: true, move: 5 }) === false);
      ok('Рывок: движение кончилось — ход кончен', T({ dash: true, move: 0 }) === true);
      ok('Отход: движение осталось — ход не кончен', T({ disengage: true, move: 2 }) === false);
      ok('Отход, но некуда идти — ход кончен', (() => { place(h, 0, 6); for (const [x, y] of [[1, 6], [0, 5], [1, 5]]) S.cells[y][x] = 'rock'; const r = T({ disengage: true, move: 2 }); for (const [x, y] of [[1, 6], [0, 5], [1, 5]]) S.cells[y][x] = ''; return r === true; })());
      ok('герой без сознания — ход кончен', (() => { h.t.action = 1; h.down = true; const r = Battle.turnSpent(h); h.down = false; return r === true; })());
      ok('по умолчанию автоконец хода включён', Battle.S.opts.autoEnd === true);
      Battle.S = null;
    }

    /* ===== 4. выстрел: колчан и поломка стрелы ===== */
    {
      const lone = mk(20, { main: 'shortbow', base: { dex: 16 } });
      ok('лучнику ensureKit даёт колчан на 40 стрел одной ячейкой', arrowsIn(lone) === 40 && lone.bag.filter(e => e.id === 'arrow').length === 1, JSON.stringify(lone.bag.map(e => [e.id, e.qty])));
      ok('мечнику стрел не дают', arrowsIn(mk(21, { main: 'sword' })) === 0);
      const shoot = async (nat, ac = 12) => {
        const S = setup([mk(22, { main: 'shortbow', base: { dex: 16 } })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0];
        place(h, 3, 5); place(g, 3, 2); g.ac = ac; g.maxHp = g.hp = 500; h.t = { move: 0, action: 1, bonus: 1, react: 1 };
        const atk = Battle.heroAttacks(h).find(a => a.ammo), before = arrowsIn(h.hero);
        forceNat(nat);
        const r = await Battle.doAttack(h, g, atk, { cancelable: false, onCommit: () => Battle.commitAttack(h, atk, g) });
        Q.length = 0;
        const L = Battle.arrowLog(h.hero.id), lying = S.drops.filter(d => d.kind === 'arrow').length, text = Battle.S.log.slice(-2).map(l => l.t).join(' | ');
        return { S, h, g, r, L, lying, left: arrowsIn(h.hero), before, text, bonus: r.ctx ? r.ctx.mods.reduce((a, m) => a + m.v, 0) : null };
      };
      // атака героя: Лов 16 → +3, бонуса мастерства нет; КД 12 → попасть можно с 9 (вровень), 10 — выше на 1, 11 — выше на 2
      let x = await shoot(1);
      ok('1 на кубике: промах и стрела сломана', !x.r.hit && x.L.broken === 1 && x.lying === 0 && x.left === x.before - 1 && /стрела сломалась/.test(x.text), x.text);
      const bonus = x.bonus; ok('бонус атаки лучника +3 (бонуса мастерства нет)', bonus === 3, bonus);
      x = await shoot(4); ok('обычный промах: стрела цела и лежит на поле', !x.r.hit && x.L.broken === 0 && x.lying === 1 && /стрела упала на поле/.test(x.text), x.text);
      x = await shoot(8); ok('промах на 1 ниже КД: стрела цела и лежит на поле', !x.r.hit && x.L.broken === 0 && x.lying === 1, `${x.r.total} против ${x.r.ac}`);
      x = await shoot(9); ok('попадание вровень с КД: стрела ломается', x.r.hit && x.r.total === x.r.ac && x.L.broken === 1 && x.lying === 0 && /стрела сломалась/.test(x.text), `${x.r.total} против ${x.r.ac}: ${x.text}`);
      x = await shoot(10); ok('попадание на 1 выше КД: стрела ломается', x.r.hit && x.r.total - x.r.ac === 1 && x.L.broken === 1 && x.lying === 0, `${x.r.total} против ${x.r.ac}`);
      x = await shoot(11); ok('попадание на 2 выше КД: стрела цела', x.r.hit && x.r.total - x.r.ac === 2 && x.L.broken === 0 && x.lying === 1, `${x.r.total} против ${x.r.ac}`);
      x = await shoot(15); ok('хорошее попадание: стрела цела', x.r.hit && x.L.broken === 0 && x.lying === 1 && !/сломалась/.test(x.text));
      x = await shoot(20); ok('критическое попадание: стрела цела', x.r.hit && x.r.crit && x.L.broken === 0 && x.lying === 1);
      x = await shoot(20, 25); ok('20 попадает даже против КД 25 и стрела цела', x.r.hit && x.L.broken === 0 && x.lying === 1);
      x = await shoot(18, 25); ok('18 против КД 25: промах, стрела цела', !x.r.hit && x.L.broken === 0 && x.lying === 1);

      // доля поломок на много выстрелов: КД 12 → 1 (5 %) + 7 и 8 (10 %) = 15 %
      const S = setup([mk(23, { main: 'shortbow', base: { dex: 16 } })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0];
      place(h, 3, 5); place(g, 3, 2); g.ac = 12; g.maxHp = g.hp = 99999; const atk = Battle.heroAttacks(h).find(a => a.ammo); let broke = 0, N = 1500;
      for (let i = 0; i < N; i++) { addToBag(h.hero, { t: 'g', id: 'arrow', qty: 1 }); h.t = { move: 0, action: 1, bonus: 1, react: 1 }; g.hp = g.maxHp; Q.length = 0; await Battle.doAttack(h, g, atk, { cancelable: false, onCommit: () => Battle.commitAttack(h, atk, g) }); }
      const L = Battle.arrowLog(h.hero.id); broke = L.broken;
      ok(`доля сломанных стрел ≈ 15 % (получилось ${(100 * broke / N).toFixed(1)} %)`, Math.abs(broke / N - 0.15) < 0.03, `${broke}/${N}`);
      ok('счёт выстрелов совпадает', L.shot === N, L.shot);
      ok('целых стрел на поле = выстрелов − сломанных', S.drops.filter(d => d.kind === 'arrow').length === N - broke);
      Battle.S = null;
    }

    /* ===== 5. итог боя: стрелы и оружие ===== */
    {
      const play = async (outcome, nat, o = {}) => {
        const S = setup([mk(30, { main: o.main || 'shortbow', base: { dex: 16 } })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0];
        place(h, 3, 5); place(g, 3, 2); g.ac = 12; g.maxHp = g.hp = 999; h.t = { move: 0, action: 1, bonus: 1, react: 1 };
        const c = h.hero, start = arrowsIn(c);
        for (const n of nat) { h.t = { move: 0, action: 1, bonus: 1, react: 1 }; const atk = Battle.heroAttacks(h).find(a => a.ammo); forceNat(n); await Battle.doAttack(h, g, atk, { cancelable: false, onCommit: () => Battle.commitAttack(h, atk, g) }); Q.length = 0; }
        const L = Battle.arrowLog(c.id), lying = S.drops.filter(d => d.kind === 'arrow').length;
        Battle.End.cleanup(S, outcome);
        return { c, start, L, lying, now: arrowsIn(c), gear: (S.gear || []).map(g => g.t).join(' | ') };
      };
      // выстрелы: 1 (сломана), 4 (упала), 15 (цела), 7 (вровень, сломана), 20 (цела)
      const shots = [1, 4, 15, 9, 20];
      let r = await play('win', shots); ok('победа: целые стрелы вернулись, сломанные нет', r.now === r.start - 2 && r.L.broken === 2 && r.lying === 3, `${r.start}→${r.now}; ${r.gear}`);
      ok('итог боя называет выпущенные, подобранные и сломанные стрелы', /выпущено стрел 5, подобрано 3, сломано 2/.test(r.gear), r.gear);
      r = await play('retreat', shots); ok('монстры бежали: стрелы подобраны', r.now === r.start - 2, `${r.start}→${r.now}`);
      r = await play('flee', shots); ok('отряд бежал: стрелы остались на поле', r.now === r.start - 5 && /остал/.test(r.gear), `${r.start}→${r.now}; ${r.gear}`);
      r = await play('defeat', shots); ok('поражение: стрелы остались на поле', r.now === r.start - 5, `${r.start}→${r.now}`);
      r = await play('abort', shots); ok('переход на обычный экран: стрелы возвращаются', r.now === r.start - 2, `${r.start}→${r.now}`);
      // стрелы на поле не выпускаются, если ни разу не стрелял
      { const S = setup([mk(31, { main: 'shortbow' })], ['goblin']); Battle.End.cleanup(S, 'win'); ok('не стрелял — строки про стрелы нет', !(S.gear || []).length, JSON.stringify(S.gear)); Battle.S = null; }
    }

    /* ===== 6. бросок оружия ===== */
    {
      const throwIt = async (nat, o = {}) => {
        const S = setup([mk(40, { main: 'spear', off: o.off, base: { str: 16 } })], ['goblin']); const h = Battle.heroes()[0], g = Battle.mons()[0];
        place(h, 3, 5); place(g, 3, 3); g.ac = 12; g.maxHp = g.hp = o.hp || 999; h.t = { move: 4, action: 1, bonus: 1, react: 1 };
        const atk = Battle.heroAttacks(h).find(a => a.thrown); forceNat(nat);
        const r = await Battle.doAttack(h, g, atk, { cancelable: false, onCommit: () => Battle.commitAttack(h, atk, g) }); Q.length = 0;
        return { S, h, g, r, atk };
      };
      let x = await throwIt(15);
      ok('до броска у копейщика есть удар и метание', true);
      ok('после броска герой без оружия', x.h.disarmed === true && !x.h.hero.equip.main === false, `disarmed=${x.h.disarmed}`);
      ok('после броска остались только кулак (и факел)', Battle.heroAttacks(x.h).every(a => a.id === 'fist' || a.id === 'torchhit'), Battle.heroAttacks(x.h).map(a => a.id).join());
      ok('оружие лежит на земле в клетке цели', x.S.drops.length === 1 && x.S.drops[0].kind === 'weapon' && x.S.drops[0].x === 3 && x.S.drops[0].y === 3, JSON.stringify(x.S.drops));
      ok('в снаряжении героя копьё не стёрто (ничего не теряется при сбое)', x.h.hero.equip.main && x.h.hero.equip.main.id === 'spear');
      ok('досягаемость без оружия обычная', Battle.heroReach(x.h) === 1);
      ok('нельзя метнуть дважды: метательных атак нет', !Battle.heroAttacks(x.h).some(a => a.thrown));
      // подобрать оружие можно только стоя на клетке, где оно лежит (свободное действие, всплывает в панели)
      x.h.t = { move: 4, action: 1, bonus: 1, react: 1, objUsed: false }; place(x.h, 3, 4);
      let pk = Battle.actionsFor(x.h).find(o => o.id === 'pickup');
      ok('из соседней клетки подобрать нельзя — только стоя на оружии', !pk, pk && pk.id);
      x.g.alive = false; x.g.hp = 0;
      pk = Battle.actionsFor(x.h).find(o => o.id === 'pickup'); ok('даже когда цель убита, из соседней клетки не подобрать', !pk, pk && pk.id);
      place(x.h, 3, 3); pk = Battle.actionsFor(x.h).find(o => o.id === 'pickup');
      ok('на клетке с оружием есть свободное действие «Подобрать» (всплывающая кнопка)', pk && pk.enabled && pk.time === 'free' && pk.pop === true && /копьё/.test(pk.label), pk && (pk.why || pk.label));
      place(x.h, 3, 5); pk = Battle.actionsFor(x.h).find(o => o.id === 'pickup'); ok('дальше клетки от оружия подобрать нельзя (в 2 клетках)', !pk, pk && pk.id);
      place(x.h, 3, 3); pk = Battle.actionsFor(x.h).find(o => o.id === 'pickup');
      await pk.run(); ok('подобрал: оружие в руке, на земле пусто, действие и доп. действие не тронуты', x.h.disarmed === false && x.S.drops.length === 0 && x.h.t.action === 1 && x.h.t.bonus === 1);
      ok('чужое оружие под героем не подбирается', (() => { x.S.drops.push({ kind: 'weapon', hero: 'чужой', slot: 'main', item: { t: 'w', id: 'spear' }, x: 3, y: 3 }); const r = !Battle.actionsFor(x.h).some(o => o.id === 'pickup'); x.S.drops.length = 0; return r; })());
      ok('снова есть удар копьём и метание', Battle.heroAttacks(x.h).some(a => a.id === 'hand:spear') && Battle.heroAttacks(x.h).some(a => a.thrown), Battle.heroAttacks(x.h).map(a => a.id).join());
      // промах: тоже падает
      x = await throwIt(2); ok('промах: оружие тоже на земле, рука пуста', x.h.disarmed && x.S.drops.length === 1 && !x.r.hit);
      // итог боя
      const fin = async outcome => { const y = await throwIt(15); Battle.End.cleanup(y.S, outcome); return y; };
      let y = await fin('win'); ok('победа: оружие подобрано (копьё на месте)', y.h.hero.equip.main && y.h.hero.equip.main.id === 'spear' && /подбирает копьё/.test(y.S.gear.map(g => g.t).join('|')), JSON.stringify(y.S.gear));
      y = await fin('retreat'); ok('монстры бежали: оружие подобрано', y.h.hero.equip.main && y.h.hero.equip.main.id === 'spear');
      y = await fin('abort'); ok('переход на обычный экран: оружие на месте', y.h.hero.equip.main && y.h.hero.equip.main.id === 'spear');
      y = await fin('flee'); ok('отряд бежал: копьё осталось на поле', !y.h.hero.equip.main && /осталось на поле/.test(y.S.gear.map(g => g.t).join('|')), JSON.stringify(y.S.gear));
      y = await fin('defeat'); ok('поражение: копьё осталось на поле', !y.h.hero.equip.main);
      // щит в левой руке остаётся
      y = await throwIt(15, { off: 'shield' }); ok('метание копья не снимает щит', y.h.hero.equip.off && y.h.hero.equip.off.id === 'shield' && y.h.ac >= 12);
      Battle.S = null;
    }
    return R;
  });
  let bad = 0;
  for (const r of out) { if (!r.ok) bad++; console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.extra && !r.ok ? '  [' + r.extra + ']' : '')); }
  console.log(bad ? `ПРОВАЛОВ: ${bad}` : 'все проверки пройдены', '| проверок:', out.length, '| page errors:', errs.slice(0, 5));
  await b.close();
})();
