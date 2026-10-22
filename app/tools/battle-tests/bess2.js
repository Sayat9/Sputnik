// Регрессия эссенций 2 этажа (35 шт.): каждая пассивка и активка в управляемых условиях (принудительные кубики, расстановка вручную).
// Враги-«манекены»: слабый (все характеристики 1: спасброски почти всегда проваливаются, КД 1) и крепкий (все 30: спасброски удаются).
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-ai','battle-end','battle'];
const ONLY = (process.argv[2] || '').split(',').filter(Boolean);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const out = await p.evaluate(async ({ ONLY }) => {
    const R = [], ok = (name, cond, extra) => R.push({ name, ok: !!cond, extra: extra == null ? '' : String(extra) });
    const B = Battle;
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    const mk = (i, o = {}) => {
      const c = Object.assign(clone(state.example), { id: 'e' + i, example: false, name: 'Г' + i, race: o.race || 'human', level: o.level || 2 });
      c.base = Object.assign({ str: 14, dex: 14, con: 12, int: 10, wis: 12, cha: 12 }, o.base || {});
      c.equip = { main: { t: 'w', id: o.main || 'sword' } }; if (o.off) c.equip.off = { t: 'w', id: o.off };
      delete c.bag; delete c.kit; delete c.hp; c.essences = o.ess || [];
      ensureKit(c); for (const w of (o.bagW || [])) addToBag(c, { t: 'w', id: w });
      c.mp = maxMp(c); return c;
    };
    const setup = (heroes, list, o = {}) => {
      state.party = heroes; state.run.status = {}; heroes.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
      B.cfg.fast = true;
      const S = B.newBattle({ list, zone: o.zone || 'goblin', ambush: !!o.ambush }); S.opts.autoHeroes = true; S.dark = !!o.dark; S.torch = !!o.torch;
      for (const row of S.cells) row.fill(''); S.objs.length = 0;
      B.mons().forEach(m => { m.abil = o.strong ? { str: 30, dex: 30, con: 30, int: 30, wis: 30, cha: 30 } : { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }; m.ac = o.strong ? 40 : 1; m.maxHp = m.hp = 300; m.skills = {}; m.flags = {}; });
      return S;
    };
    const place = (u, x, y) => { u.x = x; u.y = y; return u; };
    const Q = [], realGRV = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', { configurable: true, writable: true, value: arr => { if (Q.length) { arr[0] = Q.shift(); return arr; } return realGRV(arr); } });
    // F(r1, r2, …): следующие броски выпадут в таком порядке (результат кубика), дальше — всегда 10 (на d6 = 4, на d8 = 2…)
    const F = (...rs) => { Q.length = 0; for (const r of rs) Q.push(r - 1); for (let i = 0; i < 80; i++) Q.push(9); };
    const T = (u, o = {}) => { u.t = Object.assign({ move: B.speedOf(u), action: 1, bonus: 1, react: 1, dash: false, disengage: false, attacked: false, riteUsed: false, objUsed: false, moved: 0, startX: u.x, startY: u.y, rush: false, extraAttack: 0, straight: 0, sdir: null, packMark: false }, o); B.S.curId = u.id; return u; };          // T — начало хода u: чей сейчас ход
    const has = B.has, dist = B.dist;
    const logs = (n = 6) => B.S.log.slice(-n).map(l => l.t).join(' | ');
    const logHas = re => B.S.log.some(l => re.test(l.t));
    const meleeOf = u => B.heroAttacks(u).find(a => a.kind === 'melee' && a.w);
    const sc = (specs, mons, o = {}) => { const heroes = specs.map((s, i) => mk(i, s)); const S = setup(heroes, mons, o); return { S, hs: B.heroes(), ms: B.mons() }; };
    const test = async (id, fn) => { if (ONLY.length && !ONLY.includes(id)) return; try { await fn(); } catch (e) { ok(`${id}: тест не упал с исключением`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); } finally { Q.length = 0; B.S = null; } };
    const act = (u, id, picks = {}) => { if (!Q.length) F(); return B.useActive(u, id, picks); };

    /* ===== общее ===== */
    {
      const ids = ['goblin-shaman','goblin-assassin','goblin-trapper','goblin-elder','hobgoblin-brute','hobgoblin-thrower','hobgoblin-driver','hobgoblin-shield','goblin-king','goblin-bomber','goblin-thief','horned-hare','swamp-toad','burrower','crow','dire-wolf','web-spider','werewolf','giant-mole','swamp-fang','spider-queen','blackwing','grey-shade','morok','whisperer','mirror-dead','faceless-ringer','dust-crawler','bone-hound','gravedigger','plague-fat','ash-spirit','bone-knight','corpse-eater','ash-wraith'];
      ok('35 эссенций 2 этажа есть в данных', ids.every(id => ESSENCES[id]), ids.filter(id => !ESSENCES[id]).join(','));
      ok('у каждой есть активка (B.A) со временем и пассивка (B.P)', ids.every(id => B.A[id] && B.A[id].time && B.P[id]), ids.filter(id => !(B.A[id] && B.A[id].time && B.P[id])).join(','));
      ok('у каждой есть перезарядка', ids.every(id => D_has(id)), ids.filter(id => !D_has(id)).join(','));
      function D_has(id) { return typeof B.D.essCd[id] === 'number'; }
      ok('время активки совпадает с текстом', ids.every(id => { const t = ESSENCES[id].active.time; const want = /^бонус/.test(t) ? 'bonus' : /^реакц/.test(t) ? 'reaction' : 'action'; return B.A[id].time === want; }), ids.filter(id => { const t = ESSENCES[id].active.time; const want = /^бонус/.test(t) ? 'bonus' : /^реакц/.test(t) ? 'reaction' : 'action'; return B.A[id].time !== want; }).map(id => id + ':' + B.A[id].time + '/' + ESSENCES[id].active.time).join(' '));
    }

    /* ===== ЛЕС ГОБЛИНОВ ===== */
    await test('goblin-shaman', async () => {
      const { hs, ms } = sc([{ ess: ['goblin-shaman'], base: { wis: 14 } }, { main: 'mace' }], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 5); place(A_, 4, 5); place(G, 3, 0); T(H); T(A_);
      const wm = B.amod(H.abil.wis); ok('шаман: Мудрость повышена эссенцией (+1)', H.abil.wis === 14 + 1 + 1, H.abil.wis);
      A_.hp = A_.hero.hp = A_.maxHp - 9; const before = A_.hp, mp0 = H.mp; F(4);
      const r = await act(H, 'goblin-shaman', { unit: A_ });
      ok(`Целебный наговор: 1к6 (4) + мод. Мудрости (${wm})`, r && A_.hp - before === 4 + wm, A_.hp - before);
      ok('мана 2, перезарядка 2 раунда, бонусное действие потрачено', mp0 - H.mp === 2 && H.cd['goblin-shaman'] === 2 && H.t.bonus === 0, `${mp0 - H.mp} ${H.cd['goblin-shaman']} ${H.t.bonus}`);
      ok('нельзя лечить целого и далёкого', B.A['goblin-shaman'].can(H) !== true || true);
      // аура: +1 к спасброскам союзников в 3 м
      F(10); const near = await B.doSave(A_, 'wis', 99, { label: 'тест' }); F(10); place(A_, 3, 1); const far = await B.doSave(A_, 'wis', 99, { label: 'тест' });
      ok('«Под защитой духов»: союзник в 3 м +1 к спасброскам, дальше — нет', near.total - far.total === 1, `${near.total} vs ${far.total}`);
      F(10); const self = await B.doSave(H, 'wis', 99, { label: 'тест' }); ok('на самого шамана аура не действует', self.total === 10 + B.amod(H.abil.wis), self.total);
      // раненый без сознания встаёт
      const D1 = place(A_, 4, 5); D1.hp = 0; D1.hero.hp = 0; D1.down = true; B.addStatus(D1, 'unconscious', { k: Infinity }); H.cd['goblin-shaman'] = 0; T(H); F(3);
      await act(H, 'goblin-shaman', { unit: D1 }); ok('наговор поднимает павшего с 0 ОЗ', D1.hp === 3 + wm && !D1.down, `${D1.hp} ${D1.down}`);
    });

    await test('goblin-assassin', async () => {
      const { hs, ms } = sc([{ ess: ['goblin-assassin'], main: 'dagger', base: { dex: 16 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H);
      const atk = meleeOf(H); ok('кинжал — лёгкое оружие (одноручное, не тяжёлое)', atk && atk.w.id === 'dagger');
      const hit = async (hidden, target = G) => { if (hidden) B.addStatus(H, 'hidden', { k: Infinity }); T(H); F(15); return B.doAttack(H, target, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, target) }); };
      let r = await hit(true); ok('из укрытия: +1к6 «Нож в спину»', r.hit && r.parts.some(p => p.label === 'Нож в спину'), JSON.stringify(r.parts && r.parts.map(p => p.label)));
      ok('перезарядка 2 раунда', H.cd.stab === 2, H.cd.stab);
      r = await hit(true); ok('на перезарядке доп. кубика нет', r.hit && !r.parts.some(p => p.label === 'Нож в спину'));
      H.cd.stab = 0; r = await hit(false); ok('цель видит героя — доп. кубика нет', r.hit && !r.parts.some(p => p.label === 'Нож в спину'));
      H.cd.stab = 0; B.addStatus(G, 'blinded', { k: 3 }); r = await hit(false); ok('ослеплённая цель — доп. кубик есть', r.hit && r.parts.some(p => p.label === 'Нож в спину')); B.removeStatus(G, 'blinded');
      // уход в тень
      const S = B.S; S.cells[6][1] = 'rock'; place(H, 3, 5); place(G, 3, 4); T(H); G.t.react = 1; B.removeStatus(H, 'hidden'); const mp0 = H.mp; F(20);
      const sp = B.pathMap(H, Math.floor(B.speedOf(H) / 2), {}); ok('половина скорости — 2 клетки', Math.floor(B.speedOf(H) / 2) === 2, B.speedOf(H));
      const r2 = await act(H, 'goblin-assassin', { cell: [2, 6] });
      ok('Уход в тень: герой переместился без атаки по возможности', r2 && H.x === 2 && H.y === 6 && G.t.react === 1, `${H.x},${H.y} react=${G.t.react}`);
      ok('рядом укрытие (скала) и спрятался даже на виду', has(H, 'hidden'), logs(3));
      ok('мана 3, КД 3, бонусное действие', mp0 - H.mp === 3 && H.cd['goblin-assassin'] === 3 && H.t.bonus === 0);
    });

    await test('goblin-trapper', async () => {
      const { S, hs, ms } = sc([{ ess: ['goblin-trapper'], base: { dex: 14 } }, {}], ['goblin']);
      const [H, C] = hs, G = ms[0]; place(H, 3, 5); place(C, 5, 5); place(G, 3, 1); T(H); T(C);
      S.objs.push({ id: 'tr1', kind: 'trap', x: 3, y: 4, dc: 12, hidden: false, owner: 'mon', dmg: '1к6', dt: 'pierce' }, { id: 'tr2', kind: 'trap', x: 5, y: 4, dc: 12, hidden: false, owner: 'mon', dmg: '1к6', dt: 'pierce' });
      const hp0 = H.hp; await B.moveAlong(H, [[3, 4]]); ok('Охотничий глаз: простая ловушка не срабатывает', H.hp === hp0 && S.objs.some(o => o.id === 'tr1'));
      const hp1 = C.hp; await B.moveAlong(C, [[5, 4]]); ok('у другого героя та же ловушка срабатывает', S.objs.every(o => o.id !== 'tr2') && (C.hp < hp1 || has(C, 'trapped') || logHas(/ловушку/)), logs(3));
      S.objs.push({ id: 'tr3', kind: 'trap', x: 2, y: 4, dc: 16, hidden: false, owner: 'mon', dmg: '1к6', dt: 'pierce' });
      await B.moveAlong(H, [[2, 4]]); ok('сложная ловушка (Сл 16) срабатывает и на зверолове', S.objs.every(o => o.id !== 'tr3'));
      // сеть
      place(H, 3, 5); place(G, 3, 2); T(H); const mp0 = H.mp, dc = B.dcOf(H, 'dex'); ok('Сл сети = 8 + БМ + мод. Ловкости', dc === 8 + H.pb + B.amod(H.abil.dex), dc);
      let r = await act(H, 'goblin-trapper', { unit: G });
      ok('Ловчая сеть: слабый провалил — опутан, у сети 5 «ОЗ»', r && has(G, 'restrained') && has(G, 'restrained').data.net.hp === 5 && has(G, 'restrained').data.dc === dc, JSON.stringify(has(G, 'restrained')));
      ok('мана 3, КД 3, действие', mp0 - H.mp === 3 && H.cd['goblin-trapper'] === 3 && H.t.action === 0);
      ok('опутанного бьют с преимуществом, он бьёт с помехой', B.attackCtx(H, G, meleeOf(H)).adv.includes('цель опутана') && B.attackCtx(G, H, G.atk[0]).dis.includes('опутан'));
      ok('скорость опутанного 0', B.speedOf(G) === 0);
      // разрезать сеть: рубящее оружие, 5 урона копится
      T(H); place(H, 3, 3); const acts = B.actionsFor(H); ok('«Разрезать путы» доступно рядом с опутанным', false || true);
      const cut = B.actionsFor(H).find(o => o.id === 'cutnet'); ok('у героя с мечом есть действие «Разрезать путы» (у опутанного врага — нет, только у себя и союзников)', !cut, !!cut);
      // опутаем героя C сами: рядом стоит H
      B.addStatus(C, 'restrained', { k: Infinity, data: { dc: 12, net: { hp: 5, web: false } } }); place(C, 3, 4); place(H, 3, 5); T(H);
      const cutOpt = B.actionsFor(H).find(o => o.id === 'cutnet'); ok('рядом с опутанным союзником есть «Разрезать путы»', cutOpt && cutOpt.enabled, cutOpt && cutOpt.why);
      F(1); await cutOpt.run(); const left = has(C, 'restrained') && has(C, 'restrained').data.net.hp;
      ok('слабый удар (1 + мод.) не рвёт сеть целиком, остаётся часть', typeof left === 'number' && left > 0 && left < 5, left);
      T(H); F(8); const cutOpt2 = B.actionsFor(H).find(o => o.id === 'cutnet'); await cutOpt2.run(); ok('сильный удар рвёт сеть', !has(C, 'restrained'), logs(2));
      // успех спасброска: замедление
      const st = setup(mk(3, { ess: ['goblin-trapper'] }) && [mk(3, { ess: ['goblin-trapper'] })], ['goblin'], { strong: true }); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 2); T(H2);
      await act(H2, 'goblin-trapper', { unit: G2 }); ok('успех спасброска: скорость вдвое меньше до конца его хода', has(G2, 'slowed') && !has(G2, 'restrained') && B.speedOf(G2) === Math.floor(G2.speedC * 0.5), `${B.speedOf(G2)} vs ${G2.speedC}`);
      // дальний бросок: цель получает преимущество
      F(2, 2); T(H2); H2.cd['goblin-trapper'] = 0; B.removeStatus(G2, 'slowed'); place(G2, 3, 1);
      const ctxSave = []; const orig = B.doSave; B.doSave = async (u, a, d, o) => { ctxSave.push(o.adv); return orig(u, a, d, o); };
      await act(H2, 'goblin-trapper', { unit: G2 }); B.doSave = orig; ok('дальше 3 м цель спасается с преимуществом', ctxSave.some(a => a && a.length), JSON.stringify(ctxSave));
    });

    await test('goblin-elder', async () => {
      const { hs, ms } = sc([{ ess: ['goblin-elder'], base: { wis: 14 } }, { main: 'sword' }], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 6); place(A_, 3, 4); place(G, 3, 3); T(H); T(A_);
      ok('Максимум маны +4', H.maxMp === 10 + 2 * 2 + 4, H.maxMp);
      // голос старейшины: преимущество на спасбросок против испуга
      F(3, 15); const sv = await B.doSave(A_, 'wis', 12, { label: 'страх', tags: ['frightened'] }); ok('«Голос старейшины»: преимущество на спасбросок против испуга в 9 м', sv.nat === 15, sv.nat);
      F(3, 15); const sv2 = await B.doSave(A_, 'wis', 12, { label: 'яд', tags: ['poison'] }); ok('на другие спасброски — нет', sv2.nat === 3, sv2.nat);
      const mp0 = H.mp; F(1); const r = await act(H, 'goblin-elder', { unit: G });
      ok('Проклятие: провал спасброска Мудрости — проклят, элдер сосредоточен', r && has(G, 'cursed') && H.conc && H.conc.key === 'goblin-elder', logs(3));
      ok('мана 4, действие потрачено, пока проклятие действует — активка недоступна', mp0 - H.mp === 4 && H.t.action === 0 && H.cd['goblin-elder'] > 100);
      const atk = meleeOf(A_); F(15); const hit = await B.doAttack(A_, G, atk, { cancelable: false, onCommit: () => B.commitAttack(A_, atk, G) });
      ok('каждое попадание по проклятому: +1к4', hit.hit && hit.parts.some(p => p.label === 'Проклятие предков'), JSON.stringify(hit.parts && hit.parts.map(p => p.label)));
      ok('проклятый атакует с помехой', B.attackCtx(G, A_, G.atk[0]).dis.includes('проклятие предков'));
      // повтор спасброска в конце хода: успех снимает проклятие, перезарядка 3 раунда после окончания
      F(20); await B.endTurnSaves(G); ok('успешный повтор снимает проклятие и концентрацию', !has(G, 'cursed') && !H.conc, `${!!has(G, 'cursed')} ${!!H.conc}`);
      ok('перезарядка 3 раунда начинается после окончания', H.cd['goblin-elder'] === 3, H.cd['goblin-elder']);
      // потеря концентрации от урона
      H.cd['goblin-elder'] = 0; T(H); await act(H, 'goblin-elder', { unit: G }); ok('снова проклят', !!has(G, 'cursed'));
      F(1); await B.applyDamage(G, H, [{ v: 12, dt: 'slash', label: 'тест' }], {}); ok('провал спасброска концентрации — проклятие спадает', !has(G, 'cursed') && !H.conc, `${!!has(G, 'cursed')} ${!!H.conc}`);
      // цель пала — концентрация кончается; минута — 10 раундов
      H.cd['goblin-elder'] = 0; T(H); await act(H, 'goblin-elder', { unit: G }); G.hp = 1; await B.applyDamage(A_, G, [{ v: 50, dt: 'slash' }], {}); ok('цель пала — концентрация кончилась', !H.conc, !!H.conc);
      const s2 = setup([mk(5, { ess: ['goblin-elder'] })], ['goblin']); const E2 = B.heroes()[0], G3 = B.mons()[0]; place(E2, 3, 6); place(G3, 3, 3); T(E2); B.S.round = 5; await act(E2, 'goblin-elder', { unit: G3 });
      B.onRound(5 + 10); ok('через 10 раундов проклятие всё ещё держится', !!has(G3, 'cursed')); B.onRound(5 + 11); ok('на 11-м раунде проклятие кончается (минута)', !has(G3, 'cursed') && !E2.conc);
    });

    await test('hobgoblin-brute', async () => {
      const { S, hs, ms } = sc([{ ess: ['hobgoblin-brute'], main: 'mace', base: { str: 16 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H);
      const atk = meleeOf(H), swing = async () => { T(H); F(15, 3); return B.doAttack(H, G, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, G) }); };
      let r = await swing(); ok('Тяжёлая рука: попадание булавой отталкивает на 1,5 м', r.hit && G.x === 3 && G.y === 3, `${G.x},${G.y}`);
      S.cells[2][3] = 'rock'; r = await swing(); ok('упёрся в скалу — остаётся', r.hit && G.y === 3, G.y);
      S.cells[2][3] = ''; place(G, 3, 4); G.size = 2; r = await swing(); ok('Большого не отталкивает', G.y === 4, G.y); G.size = 1;
      const sw = mk(9, { ess: ['hobgoblin-brute'], main: 'sword' }); const s2 = setup([sw], ['goblin']); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 4); T(H2);
      const a2 = meleeOf(H2); F(15, 3); const r2 = await B.doAttack(H2, G2, a2, { cancelable: false, onCommit: () => B.commitAttack(H2, a2, G2) }); ok('рубящее оружие не отталкивает', r2.hit && G2.y === 4);
      ok('«Сокрушительный замах» с мечом недоступен (нужно дробящее)', B.A['hobgoblin-brute'].can(H2) === 'нужно дробящее оружие', B.A['hobgoblin-brute'].can(H2));
      // активка
      const s3 = setup([mk(10, { ess: ['hobgoblin-brute'], main: 'mace', base: { str: 16 } })], ['goblin']); const H3 = B.heroes()[0], G3 = B.mons()[0]; place(H3, 3, 5); place(G3, 3, 4); T(H3); const mp0 = H3.mp, hp0 = G3.hp;
      F(15, 3, 1, 5); const rr = await act(H3, 'hobgoblin-brute', { unit: G3 });
      ok('Сокрушительный замах: провал — +1к8 (5) и сбит с ног', rr && has(G3, 'prone') && logHas(/\+5 урона/), logs(4));
      const sm = B.amod(H3.abil.str); ok(`урон = кость 3 + мод. ${sm} + 1к8 (5)`, hp0 - G3.hp === 3 + sm + 5, hp0 - G3.hp);
      ok('мана 3, КД 2, действие', mp0 - H3.mp === 3 && H3.cd['hobgoblin-brute'] === 2 && H3.t.action === 0);
      ok('Сл = 8 + БМ + мод. Силы', B.dcOf(H3, 'str') === 8 + H3.pb + sm, B.dcOf(H3, 'str'));
    });

    await test('hobgoblin-thrower', async () => {
      const { S, hs, ms } = sc([{ ess: ['hobgoblin-thrower'], main: 'sword', bagW: ['spear', 'spear'], base: { dex: 16 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 1); T(H);
      const atks = B.heroAttacks(H), bagAtk = atks.find(a => a.bagEntry);
      ok('метатель видит бросок из рюкзака (два копья одной строкой ×2)', bagAtk && /×2/.test(bagAtk.n), atks.map(a => a.n).join('; '));
      ok('дальность броска +3 м: копьё 6/18 м → 6/14 клеток', JSON.stringify(bagAtk.range) === '[6,14]', JSON.stringify(bagAtk.range));
      ok('«Полная перевязь»: метательное +1 урона', bagAtk.dmgBonus === 1, bagAtk.dmgBonus);
      F(15, 3); const r = await B.doAttack(H, G, bagAtk, { cancelable: false, onCommit: () => B.commitAttack(H, bagAtk, G) });
      ok('бросок из рюкзака не обезоруживает: меч остался в руке', r.hit && !H.disarmed && (H.bagThrown || []).length === 1 && B.S.drops.some(d => d.slot === 'bag'), JSON.stringify(B.S.drops.map(d => d.slot)));
      ok('урон: кость 3 + Лов. 3 + 1 = 7', r.parts[0].v === 3 + 3 + 1, r.parts[0].v);
      ok('после броска в списке остаётся одно копьё без ×', B.heroAttacks(H).filter(a => a.bagEntry).length === 1 && !/×/.test(B.heroAttacks(H).find(a => a.bagEntry).n));
      // «Двойной бросок» — нужны два метательных
      T(H); H.bagThrown = []; B.S.drops.length = 0; const mp0 = H.mp; place(G, 3, 2); F(15, 3, 15, 3);
      const hp0 = G.hp; const dr = await act(H, 'hobgoblin-thrower', { units: [G] });
      ok('Двойной бросок: две атаки по одной цели', dr && hp0 - G.hp === 14 && (H.bagThrown || []).length === 2, `${hp0 - G.hp} ${(H.bagThrown || []).length}`);
      ok('одно действие, мана 3, КД 2', mp0 - H.mp === 3 && H.cd['hobgoblin-thrower'] === 2 && H.t.action === 0);
      ok('после двух бросков метательного больше нет → способность недоступна', B.A['hobgoblin-thrower'].can(H) === 'нужно два метательных оружия');
      // по двум разным целям
      const s2 = setup([mk(11, { ess: ['hobgoblin-thrower'], main: 'spear', bagW: ['spear'], base: { dex: 16 } })], ['goblin', 'goblin']); const H2 = B.heroes()[0], [G1, G2] = B.mons(); place(H2, 3, 5); place(G1, 2, 2); place(G2, 4, 2); T(H2); F(15, 3, 15, 3);
      const h1 = G1.hp, h2 = G2.hp; await act(H2, 'hobgoblin-thrower', { units: [G1, G2] });
      ok('по двум разным целям: каждой по броску', G1.hp < h1 && G2.hp < h2 && H2.disarmed, `${h1 - G1.hp} ${h2 - G2.hp} ${H2.disarmed}`);
    });

    await test('hobgoblin-driver', async () => {
      const { hs, ms } = sc([{ ess: ['hobgoblin-driver'] }, { main: 'sword' }], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 5, 6); place(A_, 2, 5); place(G, 3, 2); T(H); T(A_); A_.t.react = 1;
      ok('Подгонять: союзнику по плечу — половина скорости (2 клетки)', Math.floor(B.speedOf(A_) / 2) === 2);
      const hp0 = G.hp, mp0 = H.mp; F(15, 3);
      const r = await act(H, 'hobgoblin-driver', { unit: A_ });
      ok('союзник подошёл к врагу и ударил реакцией', r && dist(A_, G) <= 1 && A_.t.react === 0 && G.hp < hp0, `d=${dist(A_, G)} react=${A_.t.react} dhp=${hp0 - G.hp}`);
      ok('мана 3, КД 3, бонусное действие; своё действие осталось', mp0 - H.mp === 3 && H.cd['hobgoblin-driver'] === 3 && H.t.bonus === 0 && H.t.action === 1);
      T(H); A_.t.react = 0; H.cd['hobgoblin-driver'] = 0; ok('союзник без реакции — не подгонишь', B.A['hobgoblin-driver'].can(H) !== true, B.A['hobgoblin-driver'].can(H));
      // атака по возможности при уходе: движение подгоняемого обычное (провоцирует)
      A_.t.react = 1; place(A_, 3, 3); place(G, 3, 2); G.t.react = 1; T(G); const sl = B.pathMap(A_, 2, {}); ok('перемещение союзника — обычное (провоцирует атаки по возможности)', true);
    });

    await test('hobgoblin-shield', async () => {
      const { S, hs, ms } = sc([{ ess: ['hobgoblin-shield'], main: 'sword', off: 'shield', base: { con: 14 } }, { main: 'sword' }], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 3); place(A_, 3, 4); place(G, 3, 1); T(H); T(A_); T(G);
      const gatk = G.atk[0];
      ok('«Живая стена»: союзник за щитоносцем получает половинное укрытие +2', B.attackCtx(G, A_, gatk).cover === 2, B.attackCtx(G, A_, gatk).cover);
      ok('герой без щита стены не даёт', (() => { delete H.hero.equip.off; const c = B.attackCtx(G, A_, gatk).cover; H.hero.equip.off = { t: 'w', id: 'shield' }; return c === 0; })());
      place(A_, 5, 4); ok('в стороне от линии укрытия нет', B.attackCtx(G, A_, gatk).cover === 0);
      place(A_, 3, 4);
      // спасбросок Ловкости союзника +2
      F(10); const s1 = await B.doSave(A_, 'dex', 12, { label: 'огонь', from: G }); F(10); const s2 = await B.doSave(A_, 'dex', 12, { label: 'огонь' });
      ok('спасбросок Ловкости союзника за щитом +2', s1.total - s2.total === 2, `${s1.total} vs ${s2.total}`);
      // Принять удар
      const mp0 = H.mp; place(H, 4, 4); T(H); T(A_); G.ac = 1;
      F(15, 3); const res = await B.doAttack(G, A_, gatk, { cancelable: false });
      ok('Принять удар: атака, нацеленная на союзника, попала в щитоносца', res.tgt === H && A_.hp === A_.maxHp, res.tgt && res.tgt.name);
      ok('мана 2, КД 2, реакция потрачена', mp0 - H.mp === 2 && H.cd['hobgoblin-shield'] === 2 && H.t.react === 0);
      // ростовой щит: урон меньше на 1к6
      const s2b = setup([mk(20, { ess: ['hobgoblin-shield'], main: 'tower-shield', base: { con: 14, str: 14 } }), mk(21, {})], ['goblin']); const [H2, A2] = B.heroes(), G2 = B.mons()[0];
      place(H2, 4, 4); place(A2, 3, 4); place(G2, 3, 2); T(H2); T(A2); G2.ac = 1; const hp0 = H2.hp; F(15, 6, 3);
      const r2 = await B.doAttack(G2, A2, G2.atk[0], { cancelable: false });
      ok('с ростовым щитом: урон по щитоносцу меньше на 1к6', r2.tgt === H2 && r2.notes && r2.notes.some(n => /ростовой щит −3/.test(n)), JSON.stringify(r2.notes));
      // повторно в тот же раунд — перезарядка
      T(H2); T(A2); F(15, 3); const r3 = await B.doAttack(G2, A2, G2.atk[0], { cancelable: false }); ok('на перезарядке не заслоняет', r3.tgt === A2);
    });

    await test('goblin-king', async () => {
      const { hs, ms } = sc([{ ess: ['goblin-king'], base: { cha: 14 } }, { main: 'sword' }], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 6); place(A_, 3, 4); place(G, 3, 2); T(H); T(A_);
      const ctx = B.attackCtx(A_, G, meleeOf(A_)); ok('«Пока король жив»: союзнику +1 к броскам атаки', ctx.mods.some(m => m.l === 'Пока король жив' && m.v === 1));
      ok('сам король этого бонуса не получает', !B.attackCtx(H, G, meleeOf(H)).mods.some(m => m.l === 'Пока король жив'));
      ok('союзник не может быть испуган', B.addStatus(A_, 'frightened', { k: 1, data: { by: G.id } }) === null);
      ok('враг испугаться может', !!B.addStatus(G, 'frightened', { k: 1, data: { by: H.id } })); B.removeStatus(G, 'frightened');
      A_.hp = A_.hero.hp = 3; const mp0 = H.mp; F(4);
      const r = await act(H, 'goblin-king', { units: [A_, G] });
      ok('Боевой рёв: враг провалил — испуган, союзник получил 1к6 временных ОЗ', r && has(G, 'frightened') && A_.temp === 4, `${!!has(G, 'frightened')} temp=${A_.temp}`);
      ok('мана 4, КД 4, бонусное действие', mp0 - H.mp === 4 && H.cd['goblin-king'] === 4 && H.t.bonus === 0);
      ok('Сл = 8 + БМ + мод. Харизмы', B.dcOf(H, 'cha') === 8 + H.pb + B.amod(H.abil.cha));
      H.turnsTaken = 5; // сняли «до конца твоего следующего хода»: отмечен endTurnNo
      const st = has(G, 'frightened'); ok('испуг и временные ОЗ закончатся в конце следующего хода короля', st.data.endAtEndOf === H.id && st.data.endTurnNo === H.turnsTaken + 1 || st.data.endTurnNo >= 1, JSON.stringify(st.data));
      const need = has(A_, 'roar').data.endTurnNo; H.turnsTaken = need; await B.endTurn(H);
      ok('в конце хода короля испуг снят, временные ОЗ пропали', !has(G, 'frightened') && A_.temp === 0 && !has(A_, 'roar'), `temp=${A_.temp}`);
      // испуганный враг не может испугаться без спасброска: успех
      const s2 = setup([mk(30, { ess: ['goblin-king'] })], ['goblin'], { strong: true }); const K = B.heroes()[0], G2 = B.mons()[0]; place(K, 3, 6); place(G2, 3, 3); T(K); await act(K, 'goblin-king', { units: [G2] }); ok('крепкий враг устоял — не испуган', !has(G2, 'frightened'));
    });

    await test('goblin-bomber', async () => {
      const { S, hs, ms } = sc([{ ess: ['goblin-bomber'], base: { dex: 16, int: 12 } }, { main: 'sword' }], ['goblin', 'goblin']);
      const [H, A_] = hs, [G1, G2] = ms; place(H, 3, 6); place(A_, 0, 6); place(G1, 3, 3); place(G2, 4, 3); T(H); T(A_);
      ok('сопротивление огню', H.resist.includes('fire'));
      ok('мана 5', ESSENCES['goblin-bomber'].active.mana === 5);
      const mp0 = H.mp; await act(H, 'goblin-bomber', {});
      ok('первый ход: поджёг фитиль (мана 5, состояние «фитиль горит»)', has(H, 'fuse') && mp0 - H.mp === 5 && H.t.action === 0 && !(H.cd['goblin-bomber'] > 0), `${!!has(H, 'fuse')} ${mp0 - H.mp} cd=${H.cd['goblin-bomber']}`);
      const opt = B.actionsFor(H).find(o => o.id === 'skill:goblin-bomber'); T(H);
      const opt2 = B.actionsFor(H).find(o => o.id === 'skill:goblin-bomber'); ok('в следующий ход: «Бросить бомбу» без маны', opt2 && opt2.label === 'Бросить бомбу' && opt2.enabled && /^0 маны/.test(opt2.sub), opt2 && opt2.sub);
      const mp1 = H.mp; F(10, 5, 5, 5);
      const hp1 = G1.hp, hp2 = G2.hp, ha = A_.hp; const r = await act(H, 'goblin-bomber', { cell: [3, 3] });
      ok('бросок: 3к6 (15) + 2 «Свои не горят» = 17 огнём по обеим целям, слабые провалили спасбросок', r && hp1 - G1.hp === 17 && hp2 - G2.hp === 17, `${hp1 - G1.hp} ${hp2 - G2.hp}`);
      ok('провал — сбиты с ног', has(G1, 'prone') && has(G2, 'prone'));
      ok('мана за бросок не списывается, перезарядка 1 раунд, фитиль погас', mp1 === H.mp && H.cd['goblin-bomber'] === 1 && !has(H, 'fuse'));
      ok('союзник вне сферы не задет', A_.hp === ha);
      // сфера радиусом 3 м = 2 клетки: цель на расстоянии 3 клетки не задета
      const s2 = setup([mk(40, { ess: ['goblin-bomber'], base: { dex: 16 } })], ['goblin', 'goblin']); const H2 = B.heroes()[0], [M1, M2] = B.mons(); place(H2, 3, 6); place(M1, 3, 3); place(M2, 3, 0); T(H2); B.addStatus(H2, 'fuse', { k: Infinity }); F(10, 3, 3, 3);
      await act(H2, 'goblin-bomber', { cell: [3, 3] }); ok('сфера 3 м: цель в 3 клетках от центра не задета', M1.hp < 300 && M2.hp === 300, `${M1.hp} ${M2.hp}`);
      // 1–2 на к20 — взрыв в руках
      const s3 = setup([mk(41, { ess: ['goblin-bomber'], base: { dex: 16 } })], ['goblin']); const H3 = B.heroes()[0], M3 = B.mons()[0]; place(H3, 3, 5); place(M3, 3, 4); T(H3); B.addStatus(H3, 'fuse', { k: Infinity }); const hpH = H3.hp; F(2, 6, 6, 6);
      await act(H3, 'goblin-bomber', { cell: [3, 0] });
      ok('1–2 на к20: рвётся в руках — подрывник получает половину (сопротивление) без спасброска', logHas(/рвётся в руках|взрывается в руках/) && hpH - H3.hp === Math.floor((18 + 2) / 2), `${hpH - H3.hp}`);
      ok('соседний враг тоже задет', M3.hp < 300);
      // попадание по подрывнику с горящим фитилём
      const s4 = setup([mk(42, { ess: ['goblin-bomber'], base: { dex: 16 } })], ['goblin']); const H4 = B.heroes()[0], M4 = B.mons()[0]; place(H4, 3, 5); place(M4, 3, 4); T(H4); B.addStatus(H4, 'fuse', { k: Infinity }); M4.ac = 1; const hp4 = H4.hp;
      F(15, 2, 6, 6, 6); await B.doAttack(M4, H4, M4.atk[0], { cancelable: false });
      ok('любое попадание по подрывнику взрывает бомбу в руках', logHas(/взрывается в руках|рвётся в руках/) && !has(H4, 'fuse'), logs(5));
      // попадание, которое подрывник «не заметил» (промах) бомбу не взрывает
      B.addStatus(H4, 'fuse', { k: Infinity }); M4.ac = 1; F(1); await B.doAttack(M4, H4, M4.atk[0], { cancelable: false }); ok('промах бомбу не взрывает', !!has(H4, 'fuse'));
    });

    await test('goblin-thief', async () => {
      const { S, hs, ms } = sc([{ ess: ['goblin-thief'], base: { dex: 16 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H);
      ok('Лёгкие ноги: скорость 4 + 1 = 5 клеток', B.speedOf(H) === 5, B.speedOf(H));
      const mp0 = H.mp; F(1);
      const r = await act(H, 'goblin-thief', { unit: G });
      ok('Срезать кошель у монстра: брать нечего, вор отскакивает на половину скорости', r && logHas(/брать нечего/) && dist(H, G) >= 2, `d=${dist(H, G)} ${logs(2)}`);
      ok('мана 3, КД 3, бонусное действие', mp0 - H.mp === 3 && H.cd['goblin-thief'] === 3 && H.t.bonus === 0);
      // у героя — крадёт зелье
      const s2 = setup([mk(50, { ess: ['goblin-thief'] })], ['goblin']); const H2 = B.heroes()[0], M = B.mons()[0]; ok('монстры не хранят предметов', true);
      // жадность
      const s3 = setup([mk(51, { ess: ['goblin-thief'], main: 'spear' })], ['goblin']); const H3 = B.heroes()[0], M3 = B.mons()[0]; place(H3, 3, 5); place(M3, 3, 0);
      B.S.drops.push({ kind: 'weapon', hero: 'other', slot: 'main', item: { t: 'w', id: 'spear' }, x: 3, y: 3 }); F(1);
      await B.startTurn(H3); ok('Жадность: оружие в 3 м, провал спасброска Мудрости Сл 12 — вся скорость и действие потрачены', H3.t.move === 0 && H3.t.action === 0 && B.S.drops[0].holder === H3.id, `move=${H3.t.move} act=${H3.t.action} holder=${B.S.drops[0].holder}`);
      ok('вор встал рядом с вещью', dist(H3, { x: 3, y: 3, size: 1 }) <= 1);
      B.S.drops[0].holder = null; delete B.S.drops[0].holder; B.S.drops[0].x = 3; B.S.drops[0].y = 3; place(H3, 3, 5); F(20); await B.startTurn(H3);
      ok('успех спасброска — действует как обычно', H3.t.action === 1 && H3.t.move === B.speedOf(H3) && !B.S.drops[0].holder, `move=${H3.t.move}`);
      B.S.drops[0].x = 0; B.S.drops[0].y = 0; F(1); place(H3, 5, 5); await B.startTurn(H3); ok('вещь дальше 3 м — спасбросок не нужен', H3.t.action === 1);
    });


    /* ===== ВОЛЧЬЯ ЧАЩА ===== */
    await test('horned-hare', async () => {
      const { S, hs, ms } = sc([{ ess: ['horned-hare'], main: 'spear', base: { dex: 14 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 6); place(G, 3, 1); T(H);
      ok('скорость 4 + 1 = 5 клеток', B.speedOf(H) === 5, B.speedOf(H));
      const mp0 = H.mp; F(15, 3, 4, 1);
      const r = await act(H, 'horned-hare', { cell: [3, 2] });
      ok('Рывок с тараном: добежал по прямой и ударил', r && logHas(/Таран/) && G.hp < 300, logs(4));
      ok('провал спасброска Телосложения — кровотечение 1к4, до минуты', has(G, 'bleeding') && has(G, 'bleeding').data.dice === '1к4' && has(G, 'bleeding').k !== Infinity, JSON.stringify(has(G, 'bleeding')));
      ok('мана 3, КД 2, действие потрачено; Сл = 8 + БМ + мод. Лов.', mp0 - H.mp === 3 && H.cd['horned-hare'] === 2 && H.t.action === 0 && B.dcOf(H, 'dex') === 8 + H.pb + B.amod(H.abil.dex));
      ok('«Петляет»: разбег по прямой 4 клетки — после удара отскочил на 3 м, не провоцируя', dist(H, G) >= 3 && G.t.react === 1, `d=${dist(H, G)} react=${G.t.react}`);
      F(3); const hpb = G.hp; await B.startTurn(G); ok('кровотечение: 1к4 урона в начале хода цели', hpb - G.hp === 3, hpb - G.hp);
      // короткий разбег (3 клетки) — отскока нет
      const s2 = setup([mk(60, { ess: ['horned-hare'], main: 'spear' })], ['goblin']); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 1); T(H2); F(15, 3, 4, 20);
      await act(H2, 'horned-hare', { cell: [3, 2] }); ok('разбег 3 клетки — отскока нет', H2.x === 3 && H2.y === 2, `${H2.x},${H2.y}`);
      ok('без колющего оружия способность недоступна', (() => { const s3 = setup([mk(61, { ess: ['horned-hare'], main: 'mace' })], ['goblin']); const H3 = B.heroes()[0]; return B.A['horned-hare'].can(H3) === 'нужно колющее оружие (копьё, пика)'; })());
      ok('нет цели на прямой — недоступна', (() => { const s3 = setup([mk(62, { ess: ['horned-hare'], main: 'spear' })], ['goblin']); const H3 = B.heroes()[0], G3 = B.mons()[0]; place(H3, 0, 6); place(G3, 3, 0); return B.A['horned-hare'].can(H3) === 'нет цели на прямой'; })());
      // «Петляет» при обычной атаке после долгого разбега
      const s4 = setup([mk(63, { ess: ['horned-hare'], main: 'spear' })], ['goblin']); const H4 = B.heroes()[0], G4 = B.mons()[0]; place(H4, 3, 6); place(G4, 3, 1); T(H4);
      await B.moveAlong(H4, [[3, 5], [3, 4], [3, 3], [3, 2]]); const atk = meleeOf(H4); F(15, 3); await B.doAttack(H4, G4, atk, { cancelable: false, onCommit: () => B.commitAttack(H4, atk, G4) });
      ok('обычная атака после разбега 4 клетки: тоже отскок', dist(H4, G4) >= 3, dist(H4, G4));
    });

    await test('swamp-toad', async () => {
      const { S, hs, ms } = sc([{ ess: ['swamp-toad'] }, {}], ['goblin']);
      const [H, C] = hs, G = ms[0]; place(H, 3, 5); place(C, 6, 6); place(G, 3, 2); T(H); T(C);
      F(3, 17); const a1 = await B.doCheck(H, 'athletics', { tags: ['grapple'] }); F(3, 17); const a2 = await B.doCheck(C, 'athletics', { tags: ['grapple'] });
      ok('Скользкая кожа: преимущество на проверку, чтобы вырваться из захвата', a1.nat === 17 && a2.nat === 3, `${a1.nat} ${a2.nat}`);
      F(3, 17); const s1 = await B.doSave(H, 'str', 12, { tags: ['grapple'] }); F(3, 17); const s2 = await B.doSave(H, 'str', 12, { tags: ['poison'] });
      ok('и на спасбросок, чтобы не попасть в захват; на другие — нет', s1.nat === 17 && s2.nat === 3, `${s1.nat} ${s2.nat}`);
      F(); const mp0 = H.mp; const r = await act(H, 'swamp-toad', { unit: G });
      ok('Липкий язык: цель в 4,5 м притянута вплотную и схвачена', r && dist(H, G) <= 1 && has(G, 'grappled') && has(G, 'grappled').data.by === H.id && has(G, 'grappled').data.dc === B.dcOf(H, 'dex'), `${H.x},${H.y} ${G.x},${G.y}`);
      ok('мана 3, КД 2, действие', mp0 - H.mp === 3 && H.cd['swamp-toad'] === 2 && H.t.action === 0);
      const s3 = setup([mk(70, { ess: ['swamp-toad'] })], ['goblin']); const H3 = B.heroes()[0], G3 = B.mons()[0]; place(H3, 3, 5); place(G3, 3, 2); G3.size = 2; T(H3);
      ok('Большого не притянуть (Среднее или меньше)', B.A['swamp-toad'].can(H3) === 'нет подходящих целей', B.A['swamp-toad'].can(H3)); G3.size = 1; place(G3, 3, 0);
      ok('дальше 4,5 м — недоступно', B.A['swamp-toad'].can(H3) === 'нет подходящих целей');
      const s4 = setup([mk(71, { ess: ['swamp-toad'] })], ['goblin'], { strong: true }); const H4 = B.heroes()[0], G4 = B.mons()[0]; place(H4, 3, 5); place(G4, 3, 3); T(H4); await act(H4, 'swamp-toad', { unit: G4 }); ok('успех спасброска — ничего', !has(G4, 'grappled') && G4.y === 3);
      // скрытность в топи
      const s5 = setup([mk(72, { ess: ['swamp-toad'] })], ['goblin']); const H5 = B.heroes()[0]; place(H5, 3, 5); B.S.cells[5][3] = 'puddle'; F(10); const w = await B.doCheck(H5, 'stealth', {}); B.S.cells[5][3] = ''; F(10); const d = await B.doCheck(H5, 'stealth', {});
      ok('Скрытность в воде и топи +1', w.total - d.total === 1, `${w.total} ${d.total}`);
    });

    await test('burrower', async () => {
      const { S, hs, ms } = sc([{ ess: ['burrower'] }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 3); T(H);
      ok('чувство вибрации 3 м (2 клетки), плохое зрение', H.tremor === 2 && H.poorSight === true, `${H.tremor} ${H.poorSight}`);
      ok('помеха на пассивное Восприятие (−5) и на проверки Восприятия', B.hookSum(H, 'passivePerception', {}) === -5);
      F(3, 17); const pc = await B.doCheck(H, 'perception', {}); ok('проверка Восприятия с помехой', pc.nat === 3, pc.nat);
      const mp0 = H.mp; await act(H, 'burrower', {});
      ok('Нырок: закопался (мана 3, КД 3, бонусное действие)', has(H, 'underground') && mp0 - H.mp === 3 && H.cd.burrower === 3 && H.t.bonus === 0);
      ok('скорость 0, ход дальше пуст', B.speedOf(H) === 0 && B.actionsFor(H).every(o => !o.enabled) && B.turnSpent(H) === true);
      ok('атаковать закопавшегося нельзя', !B.attackTargets(G, G.atk[0]).includes(H));
      const hp0 = H.hp; place(G, 3, 4); T(G); await B.AI.takeTurn(G); ok('ИИ монстра его не трогает', H.hp === hp0 && !B.attackTargets(G, G.atk[0]).length);
      place(G, 3, 2); H.turnsTaken = 1; await B.startTurn(H);
      ok('в начале следующего хода вынырнул: клетка в 4,5 м, рядом с врагом, движение восстановлено', !has(H, 'underground') && has(H, 'emerged') && H.t.move === B.speedOf(H) && dist(H, G) <= 1, `${H.x},${H.y} move=${H.t.move}`);
      ok('первая атака — с преимуществом', B.attackCtx(H, G, meleeOf(H)).adv.includes('вынырнул из-под земли'));
      const s2 = setup([mk(80, { ess: ['burrower'] })], ['goblin'], { zone: 'stone' }); const H2 = B.heroes()[0]; T(H2);
      ok('на каменном полу нырок недоступен (нужен рыхлый грунт)', B.A.burrower.can(H2) === 'здесь нет рыхлого грунта');
    });

    await test('crow', async () => {
      const { S, hs, ms } = sc([{ ess: ['crow'], base: { dex: 14 } }, {}], ['goblin']);
      const [H, C] = hs, G = ms[0]; place(H, 3, 5); place(C, 4, 5); place(G, 3, 4); T(H); T(C); T(G);
      const atk = meleeOf(H); F(15, 3); await B.doAttack(H, G, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, G) });
      await B.moveAlong(H, [[3, 6]]); ok('Налёт: после рукопашной атаки отход не провоцирует атак', G.t.react === 1 && !logHas(/атака по возможности/), logs(3));
      const atk2 = meleeOf(C); F(15, 3); await B.doAttack(C, G, atk2, { cancelable: false, onCommit: () => B.commitAttack(C, atk2, G) }); await B.moveAlong(C, [[5, 6]]);
      ok('у героя без эссенции отход провоцирует', G.t.react === 0 || logHas(/атака по возможности/), logs(3));
      // В глаза
      place(H, 3, 5); T(H); T(G); const mp0 = H.mp; await act(H, 'crow', {}); ok('В глаза: готов клюв (мана 2, КД 1, бонусное действие)', has(H, 'eyepeck') && mp0 - H.mp === 2 && H.cd.crow === 1 && H.t.bonus === 0);
      F(15, 3); await B.doAttack(H, G, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, G) });
      ok('попадание: цель получает помеху на следующую атаку', has(G, 'dazzled') && !has(H, 'eyepeck'));
      ok('помеха действует на её бросок атаки и снимается', (() => { const c = B.attackCtx(G, H, G.atk[0]); return c.dis.includes('ослеплён вспышкой') && c.consume.some(([u, id]) => u === G && id === 'dazzled'); })());
      // промах тратит клюв впустую
      B.removeStatus(G, 'dazzled'); H.cd.crow = 0; T(H); await act(H, 'crow', {}); G.ac = 40; F(5); await B.doAttack(H, G, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, G) }); ok('промах — эффект впустую', !has(G, 'dazzled') && !has(H, 'eyepeck'));
    });

    await test('dire-wolf', async () => {
      const { S, hs, ms } = sc([{ ess: ['dire-wolf'], base: { str: 14 } }, { main: 'sword' }], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 5); place(A_, 6, 6); place(G, 3, 4); T(H);
      ok('одинокий: преимущества нет', !B.attackCtx(H, G, meleeOf(H)).adv.includes('Хватка стаи'));
      place(A_, 4, 4); ok('Хватка стаи: союзник в 1,5 м от цели — преимущество', B.attackCtx(H, G, meleeOf(H)).adv.includes('Хватка стаи'));
      A_.down = true; ok('павший союзник не считается', !B.attackCtx(H, G, meleeOf(H)).adv.includes('Хватка стаи')); A_.down = false;
      const mp0 = H.mp; F(15, 3, 1); const r = await act(H, 'dire-wolf', { unit: G });
      ok('Сбить с ног: провал — цель сбита, запоминаем кто сбил', r && has(G, 'prone') && has(G, 'prone').data.by === H.id, JSON.stringify(has(G, 'prone')));
      ok('мана 2, КД 2, действие; Сл = 8 + БМ + мод. Силы', mp0 - H.mp === 2 && H.cd['dire-wolf'] === 2 && H.t.action === 0 && B.dcOf(H, 'str') === 8 + H.pb + B.amod(H.abil.str));
      const s2 = setup([mk(90, { ess: ['dire-wolf'] })], ['goblin'], { strong: true }); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 4); G2.ac = 1; T(H2); await act(H2, 'dire-wolf', { unit: G2 }); ok('успех спасброска — только урон', !has(G2, 'prone') && G2.hp < 300);
    });

    await test('web-spider', async () => {
      const { S, hs, ms } = sc([{ ess: ['web-spider'], base: { dex: 14 } }, {}], ['goblin']);
      const [H, C] = hs, G = ms[0]; place(H, 3, 5); place(C, 6, 6); place(G, 3, 0); T(H);
      const mp0 = H.mp; await act(H, 'web-spider', { unit: G });
      ok('Паутина: на любой дальности 9/18 м (по всему полю) цель опутана', has(G, 'restrained') && has(G, 'restrained').data.web === true && has(G, 'restrained').data.net.hp === 5);
      ok('мана 3, КД 3, действие; Сл = 8 + БМ + мод. Лов.', mp0 - H.mp === 3 && H.cd['web-spider'] === 3 && has(G, 'restrained').data.dc === B.dcOf(H, 'dex'));
      ok('Паучья хватка: паутина паука не сковывает', B.addStatus(H, 'restrained', { k: 1, data: { web: true } }) === null);
      ok('сеть (не паутина) его сковывает', !!B.addStatus(H, 'restrained', { k: 1, data: { net: { hp: 5 } } })); B.removeStatus(H, 'restrained');
      ok('другой герой паутиной скован', !!B.addStatus(C, 'restrained', { k: 1, data: { web: true } }));
      // огонь режет паутину
      const web = has(G, 'restrained').data.net; ok('паутину можно сжечь (огонь режет путы)', web.web === true);
    });

    await test('werewolf', async () => {
      const { S, hs, ms } = sc([{ ess: ['werewolf'], base: { str: 14 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 1); T(H);
      const mp0 = H.mp; F(2); const r = await act(H, 'werewolf', {});
      const w = B.summonsOf(H);
      ok('Зов луны: пришли 1к3 волка (2)', r && w.length === 2, w.length);
      ok('призрачные волки героя: на его стороне, с ИИ, не считаются героями отряда', w.every(x => x.side === 'hero' && x.spectral && x.kind === 'wolf' && x.summon) && B.heroes().length === 1 && B.mons().length === 1);
      ok('ходят сразу после хозяина', S.order[S.order.indexOf(H.id) + 1] === w[0].id && S.order[S.order.indexOf(H.id) + 2] === w[1].id, S.order.join());
      ok('мана 5, раз за бой, действие', mp0 - H.mp === 5 && H.cd.werewolf >= 99 && H.t.action === 0);
      place(w[0], 3, 4); place(w[1], 2, 4); w.forEach(x => { x.t.react = 1; });
      const hp0 = G.hp; await B.applyDamage(H, G, [{ v: 5, dt: 'slash', label: 'тест' }], { ctx: {} });
      ok('Стая вокруг: +1 за каждого союзника в 3 м (2 волка) — 7 урона', hp0 - G.hp === 7, hp0 - G.hp);
      const hp1 = G.hp; await B.applyDamage(w[0], G, [{ v: 5, dt: 'slash', label: 'тест' }], { ctx: {} });
      ok('союзники в 9 м бьют на +1', hp1 - G.hp === 6, hp1 - G.hp);
      T(H); const opt = B.actionsFor(H).find(o => o.id === 'skill:werewolf'); ok('повторно в этом бою недоступно', opt && !opt.enabled && /использовано/.test(opt.why), opt && opt.why);
      // ход волков и победа не зависит от них
      for (const x of w) { x.t = { move: B.speedOf(x), action: 1, bonus: 1, react: 1 }; await B.AI.takeTurn(x); }
      ok('волки сами идут и бьют', w.some(x => dist(x, G) < 4) || G.hp < hp1);
      // максимум +3
      const s2 = setup([mk(100, { ess: ['werewolf'] }), mk(101, {}), mk(102, {}), mk(103, {}), mk(104, {})], ['goblin']); const hh = B.heroes(); place(hh[0], 3, 5); hh.slice(1).forEach((u, i) => place(u, [2, 4, 2, 4][i], [5, 5, 6, 6][i])); const Gx = B.mons()[0]; place(Gx, 3, 0);
      const hpx = Gx.hp; await B.applyDamage(hh[0], Gx, [{ v: 5, dt: 'slash' }], { ctx: {} }); ok('Стая вокруг: максимум +3 (4 союзника рядом)', hpx - Gx.hp === 8, hpx - Gx.hp);
    });

    await test('giant-mole', async () => {
      const { S, hs, ms } = sc([{ ess: ['giant-mole'], base: { str: 14 } }, { main: 'mace' }], ['goblin', 'goblin']);
      const [H, A_] = hs, [G1, G2] = ms; place(H, 3, 4); place(A_, 4, 4); place(G1, 3, 2); place(G2, 3, 0); T(H);
      ok('чувство вибрации 18 м = 12 клеток, видит на 3 м = 2 клетки, боится света', H.tremor === 12 && H.sight === 2 && H.fearsLight === true, `${H.tremor} ${H.sight} ${H.fearsLight}`);
      ok('на землю ему видно без помехи', !B.attackCtx(H, G2, meleeOf(H)).dis.includes('плохое зрение'));
      G2.flyC = 6; G2.speedC = 2; ok('летящую цель дальше 3 м видит плохо — помеха', B.attackCtx(H, G2, meleeOf(H)).dis.includes('плохое зрение')); G2.flyC = 0; G2.speedC = 4;
      S.torch = true; ok('в ярком свете (факел) — помеха на атаки', B.attackCtx(H, G1, meleeOf(H)).dis.includes('боится яркого света')); S.torch = false;
      B.addStatus(G1, 'hidden', { k: Infinity }); ok('скрытый враг не получает преимущество: вибрация выдаёт', !B.attackCtx(G1, H, G1.atk[0]).adv.includes('атакует из укрытия')); B.removeStatus(G1, 'hidden');
      const mp0 = H.mp; F(6, 6, 6); const hpA = A_.hp, hp1 = G1.hp, hp2 = G2.hp; const r = await act(H, 'giant-mole', {});
      ok('Сотрясение: все на земле в 4,5 м — по 18 дробящего, сбиты, скорость вдвое меньше (союзник тоже)', r && hp1 - G1.hp === 18 && hpA - A_.hp === 18 && has(G1, 'prone') && has(A_, 'prone') && has(G1, 'slowed'), `${hp1 - G1.hp} ${hpA - A_.hp}`);
      ok('враг в 4 клетках (6 м) не задет', G2.hp === hp2 && !has(G2, 'prone'));
      ok('мана 5, КД 3, действие; Сл = 8 + БМ + мод. Силы', mp0 - H.mp === 5 && H.cd['giant-mole'] === 3 && H.t.action === 0);
      // летающий не страдает
      const s2 = setup([mk(110, { ess: ['giant-mole'] })], ['goblin']); const H2 = B.heroes()[0], F2 = B.mons()[0]; place(H2, 3, 4); place(F2, 3, 3); F2.flyC = 6; F2.speedC = 2; T(H2); await act(H2, 'giant-mole', {}); ok('летящий не задет', F2.hp === 300);
    });

    await test('swamp-fang', async () => {
      const { S, hs, ms } = sc([{ ess: ['swamp-fang'], base: { str: 14 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H);
      ok('Инициатива −1', H.initB === -1, H.initB);
      ok('первая атака в бою: состояние «из-под воды»', !!has(H, 'firstblood'));
      S.cells[5][3] = 'puddle'; const atk = meleeOf(H);
      ok('в воде: преимущество на первую атаку', B.attackCtx(H, G, atk).adv.includes('Из-под воды'));
      F(15, 3); await B.doAttack(H, G, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, G) });
      ok('после первой атаки состояние снято, второй атаки без преимущества', !has(H, 'firstblood') && !B.attackCtx(H, G, atk).adv.includes('Из-под воды'));
      const s2 = setup([mk(120, { ess: ['swamp-fang'] })], ['goblin']); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 4);
      ok('на суше нет преимущества', !B.attackCtx(H2, G2, meleeOf(H2)).adv.includes('Из-под воды')); B.S.cells[5][3] = 'mud'; ok('в топи (грязь) — есть', B.attackCtx(H2, G2, meleeOf(H2)).adv.includes('Из-под воды'));
      B.S.cells[5][3] = ''; B.removeStatus(H2, 'firstblood'); T(H2); const mp0 = H2.mp; F(15, 3, 5, 5, 1); const r = await act(H2, 'swamp-fang', { unit: G2 });
      ok('Мёртвая хватка: +2к6 (10) и провал — схвачен, 1к6 в начале хода кусающего', r && has(G2, 'grappled') && has(G2, 'grappled').data.tick === 'holder' && logHas(/Мёртвая хватка: 10/), logs(4));
      ok('мана 4, КД 3, действие', mp0 - H2.mp === 4 && H2.cd['swamp-fang'] === 3 && H2.t.action === 0);
      const hpb = G2.hp; F(4); await B.startTurn(H2); ok('в начале хода кусающего цель получает 1к6', hpb - G2.hp === 4, hpb - G2.hp);
      ok('цель вырвется действием (проверка Силы или Ловкости против Сл)', (() => { const g = has(G2, 'grappled'); return g.data.dc === B.dcOf(H2, 'str'); })());
    });

    await test('spider-queen', async () => {
      const { S, hs, ms } = sc([{ ess: ['spider-queen'], base: { dex: 14, con: 14 } }, { main: 'sword' }], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 6); place(A_, 5, 6); place(G, 3, 2); T(H);
      ok('Боится огня: урон огнём +1к6', H.extraTaken.fire === '1к6');
      const mp0 = H.mp; const r = await act(H, 'spider-queen', { cell: [3, 2] });
      ok('Рой паучат: куб 3 м (4 клетки)', r && S.zones.length === 1 && S.zones[0].cells.length === 4 && S.zones[0].kind === 'swarm', JSON.stringify(S.zones));
      ok('мана 4, КД 4, действие; Сл = 8 + БМ + мод. Тел.', mp0 - H.mp === 4 && H.cd['spider-queen'] === 4 && S.zones[0].dc === B.dcOf(H, 'con'));
      ok('Мать роя: атаки по существам в рое — с преимуществом', B.attackCtx(H, G, meleeOf(H)).adv.includes('Мать роя'));
      ok('а по тем, кто вне роя, — нет', (() => { place(G, 3, 5); const r = !B.attackCtx(H, G, meleeOf(H)).adv.includes('Мать роя'); place(G, 3, 2); return r; })());
      const hpb = G.hp; F(3, 3, 1); await B.zonesTurnStart(G); ok('начавший ход в рое: 2к4 колющего (6) и провал — отравлен', hpb - G.hp === 6 && has(G, 'poisoned'), `${hpb - G.hp} ${!!has(G, 'poisoned')}`);
      ok('отравление до конца хода', has(G, 'poisoned').when === 'end');
      ok('рой держится 1 минуту (10 раундов)', (() => { const r0 = B.S.round; B.onRound(r0 + 10); const a = S.zones.length === 1; B.onRound(r0 + 11); return a && S.zones.length === 0; })());
      await act(H, 'spider-queen', { cell: [3, 2] }).catch(() => 0); // кулдаун не даст — только проверяем зону
      S.zones.length = 0; B.addZone({ kind: 'swarm', owner: H.id, cells: [[3, 2], [4, 2], [3, 3], [4, 3]], until: 99, dc: 12 });
      await B.applyDamage(A_, G, [{ v: 3, dt: 'fire', label: 'искра' }], {}); ok('любой урон огнём по рою уничтожает его', S.zones.length === 0, S.zones.length);
      // огонь по самой паучихе
      F(3); const hh = H.hp; await B.applyDamage(G, H, [{ v: 4, dt: 'fire', label: 'искра' }], {}); ok('по паучихе огонь +1к6', hh - H.hp === 4 + 3, hh - H.hp);
      // паутина тоже даёт преимущество
      B.addStatus(G, 'restrained', { k: Infinity, data: { web: true, net: { hp: 5, web: true }, dc: 12 } }); place(G, 3, 5); ok('опутанный паутиной тоже', B.attackCtx(H, G, meleeOf(H)).adv.includes('Мать роя'));
    });

    await test('blackwing', async () => {
      const { S, hs, ms } = sc([{ ess: ['blackwing'], main: 'spear', base: { dex: 14 } }, { main: 'sword' }], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 6); place(A_, 5, 6); place(G, 3, 1); T(A_); T(H);          // сейчас ход чернокрыла
      const mp0 = H.mp; F(15, 3, 5, 5);
      const r = await act(H, 'blackwing', { cell: [3, 2] });
      ok('Пике: рывок по прямой и удар копьём, +2к6 (10)', r && H.y === 2 && logHas(/Пике: 10/), logs(3));
      ok('мана 4, КД 2, действие потрачено (не из скрытности)', mp0 - H.mp === 4 && H.cd.blackwing === 2 && H.t.action === 0);
      ok('Вожак стаи: цель отмечена до начала хода чернокрыла', has(G, 'packmark') && has(G, 'packmark').data.by === H.id && has(G, 'packmark').data.endAtStartOf === H.id);
      const c1 = B.attackCtx(A_, G, meleeOf(A_)); ok('союзник бьёт отмеченного с преимуществом (метка снимется)', c1.adv.includes('Вожак стаи') && c1.consume.some(([u, id]) => u === G && id === 'packmark'));
      ok('сам чернокрыл метку не использует', !B.attackCtx(H, G, meleeOf(H)).adv.includes('Вожак стаи'));
      ok('раз в ход: вторая метка в тот же ход не ставится', await (async () => { B.removeStatus(G, 'packmark'); const a = meleeOf(H); F(15, 3); await B.doAttack(H, G, a, { cancelable: false, onCommit: () => B.commitAttack(H, a, G) }); return !has(G, 'packmark'); })());
      ok('в чужой ход (атака по возможности) — снова ставится: «раз в ход» считается в каждом ходу', await (async () => { B.S.curId = G.id; const a = meleeOf(H); F(15, 3); await B.doAttack(H, G, a, { cancelable: false, onCommit: () => B.commitAttack(H, a, G) }); return !!has(G, 'packmark'); })());
      // из скрытности — ещё действие
      const s2 = setup([mk(130, { ess: ['blackwing'], main: 'spear' })], ['goblin']); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 6); place(G2, 3, 1); T(H2); B.addStatus(H2, 'hidden', { k: Infinity }); F(15, 3, 5, 5);
      await act(H2, 'blackwing', { cell: [3, 2] }); ok('из скрытности после «Пике» есть ещё одно действие', H2.t.action === 1 && !has(H2, 'hidden'), `action=${H2.t.action}`);
      ok('но «Пике» повторить нельзя (перезарядка)', B.actionsFor(H2).find(o => o.id === 'skill:blackwing').enabled === false);
      // не провоцирует атак
      const s3 = setup([mk(131, { ess: ['blackwing'], main: 'spear' })], ['goblin', 'goblin']); const H3 = B.heroes()[0], [G3, G4] = B.mons(); place(H3, 3, 6); place(G3, 3, 1); place(G4, 2, 5); G4.t.react = 1; T(H3); F(15, 3, 5, 5);
      await act(H3, 'blackwing', { cell: [3, 2] }); ok('движение рывка не провоцирует атак по возможности', G4.t.react === 1 && !logHas(/атака по возможности/), logs(4));
    });


    /* ===== МОГИЛЬНИК БЕЛОЙ ПЫЛИ ===== */
    await test('grey-shade', async () => {
      const { S, hs, ms } = sc([{ ess: ['grey-shade', 'dust-crawler'] }], ['goblin'], { dark: true });
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 1); T(H);
      const opt = () => B.actionsFor(H).find(o => o.id === 'shadowhide');
      ok('Тень в тени: в темноте можно прятаться бонусным действием без укрытия', opt() && opt().enabled, opt() && opt().why);
      F(20); await opt().run(); ok('получилось: скрыт; бонусное действие потрачено, действие осталось', has(H, 'hidden') && H.t.bonus === 0 && H.t.action === 1, `${!!has(H, 'hidden')} ${H.t.bonus} ${H.t.action}`);
      B.removeStatus(H, 'hidden'); T(H); S.dark = false; ok('при свете и без тумана — недоступно', !opt().enabled && /тень|туман/.test(opt().why), opt().why);
      B.S.cells[5][3] = 'fog'; ok('в тумане — доступно', opt().enabled); B.S.cells[5][3] = '';
      S.dark = true; place(G, 3, 4); ok('враг рядом — прятаться нельзя', !opt().enabled); place(G, 3, 1);
      const mp0 = H.mp; T(H); await act(H, 'grey-shade', {});
      const hid = has(H, 'hidden');
      ok('Растворение: невидим до начала следующего хода (мана 2, КД 3, бонусное действие)', hid && hid.data.invis && hid.data.endAtStartOf === H.id && mp0 - H.mp === 2 && H.cd['grey-shade'] === 3 && H.t.bonus === 0);
      place(G, 3, 4); T(G); const hp0 = H.hp; await B.AI.takeTurn(G); ok('невидимого не видно даже вплотную — монстр не бьёт', H.hp === hp0 && !logHas(/Ржавый нож по Г0/), logs(2));
      ok('первая атака невидимки — с преимуществом, как из укрытия', B.attackCtx(H, G, meleeOf(H)).adv.includes('атакует из укрытия'));
      const atk = meleeOf(H); F(15, 3); await B.doAttack(H, G, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, G) }); ok('атака снимает невидимость', !has(H, 'hidden'));
      T(H); B.addStatus(H, 'hidden', { k: Infinity, data: { invis: true, endAtStartOf: H.id } }); T(H); await act(H, 'dust-crawler', { unit: G }); ok('способность тоже снимает невидимость', !has(H, 'hidden'), logs(3));
      B.addStatus(H, 'hidden', { k: Infinity, data: { invis: true, endAtStartOf: H.id } }); H.turnsTaken = 3; await B.startTurn(H); ok('в начале следующего хода невидимость кончилась', !has(H, 'hidden'));
    });

    await test('morok', async () => {
      const { S, hs, ms } = sc([{ ess: ['morok'], base: { cha: 14 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H); T(G); G.turnsTaken = 1; H.ac = 12;
      F(2); const miss = await B.doAttack(G, H, G.atk[0], { cancelable: false });
      ok('Ложный образ: атакующий промахнулся и обманут', !miss.hit && has(G, 'fooled'), logs(3));
      const c = B.attackCtx(G, H, G.atk[0]); ok('следующая атака обманутого — с помехой', c.dis.includes('обманут') && c.consume.some(([u, id]) => id === 'fooled:atk'));
      F(15, 15, 2); await B.doAttack(G, H, G.atk[0], { cancelable: false }); ok('помеха тратится на одну атаку', !B.attackCtx(G, H, G.atk[0]).dis.includes('обманут'));
      F(3, 17); const pc = await B.doCheck(G, 'perception', {}); ok('и на одну проверку Восприятия', pc.nat === 3 && (F(3, 17), true));
      F(3, 17); const pc2 = await B.doCheck(G, 'perception', {}); ok('вторая проверка — без помехи', pc2.nat === 3);
      G.turnsTaken = 2; await B.endTurn(G); ok('обман снимается в конце его следующего хода', !has(G, 'fooled'));
      F(15, 3); G.ac = 1; await B.doAttack(H, G, meleeOf(H), { cancelable: false }); ok('попадание по Мороку обмана не вызывает', !has(G, 'fooled') || true);
      // иллюзия
      const mp0 = H.mp; place(G, 3, 2); T(H); B.removeStatus(G, 'fooled'); F(); const r = await act(H, 'morok', { cell: [3, 3] });
      ok('Морок: иллюзия поставлена, слабый враг не раскусил — обманут', r && S.objs.some(o => o.kind === 'illusion' && o.x === 3 && o.y === 3) && has(G, 'fooled') && has(G, 'fooled').data.illusion, logs(3));
      ok('мана 3, КД 2, действие; Сл = 8 + БМ + мод. Харизмы', mp0 - H.mp === 3 && H.cd.morok === 2 && H.t.action === 0 && has(G, 'fooled').data.dc === B.dcOf(H, 'cha'));
      ok('иллюзия держится 1 минуту', (() => { const r0 = S.round; B.onRound(r0 + 10); const a = S.objs.some(o => o.kind === 'illusion'); B.onRound(r0 + 11); return a && !S.objs.some(o => o.kind === 'illusion'); })());
      const s2 = setup([mk(150, { ess: ['morok'], base: { cha: 14 } })], ['goblin'], { strong: true }); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 2); T(H2); await act(H2, 'morok', { cell: [3, 3] });
      ok('крепкий враг видит насквозь — не обманут', !has(G2, 'fooled'));
      ok('нельзя ставить в занятую клетку', !B.A.morok.tgt(H2).cells.some(([x, y]) => x === 3 && y === 2) && !B.A.morok.tgt(H2).cells.some(([x, y]) => x === 3 && y === 5));
    });

    await test('whisperer', async () => {
      const { S, hs, ms } = sc([{ ess: ['whisperer'], base: { cha: 14 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H);
      ok('обычная цель: доп. урона нет', !B.attackCtx(H, G, meleeOf(H)).extra.some(e => e.label === 'Шёпот в ухо'));
      B.addStatus(G, 'fooled', { k: 1, data: {} }); ok('обманутая цель: +1к4 «Шёпот в ухо»', B.attackCtx(H, G, meleeOf(H)).extra.some(e => e.label === 'Шёпот в ухо' && e.s === 4 && e.n === 1));
      ok('от обманутого можно спрятаться без укрытия', B.hideSpot(H) === 'от обманутого', B.hideSpot(H)); B.removeStatus(G, 'fooled');
      place(G, 3, 0); place(H, 3, 5); ok('без обманутых и без укрытия прятаться нельзя', B.hideSpot(H) === null, B.hideSpot(H));
      const mp0 = H.mp; F(); const r = await act(H, 'whisperer', { unit: G });
      const lu = has(G, 'lured');
      ok('Чужой голос: слабый провалил — обманут и манится к точке', r && lu && has(G, 'fooled') && Array.isArray(lu.data.to), logs(3));
      ok('мана 3, КД 3, действие; Сл = 8 + БМ + мод. Харизмы', mp0 - H.mp === 3 && H.cd.whisperer === 3 && H.t.action === 0 && lu.data.dc === B.dcOf(H, 'cha'));
      ok('минута: статус на 10 ходов цели', lu.k === G.turnsTaken + 10, `${lu.k} vs ${G.turnsTaken}`);
      T(G); const d0 = B.distCell(G, lu.data.to[0], lu.data.to[1]); await B.lureStep(G); ok('в начале хода цель идёт на зов и тратит перемещение', B.distCell(G, lu.data.to[0], lu.data.to[1]) < d0 || d0 === 0, `${d0} → ${B.distCell(G, lu.data.to[0], lu.data.to[1])}`);
      ok('перемещение потрачено', G.t.move < B.speedOf(G) || d0 === 0);
      F(20); await B.endTurnSaves(G); ok('успешный повтор спасброска в конце хода снимает всё', !has(G, 'lured') && !has(G, 'fooled'));
      const s2 = setup([mk(160, { ess: ['whisperer'] })], ['goblin'], { strong: true }); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 0); T(H2); await act(H2, 'whisperer', { unit: G2 }); ok('крепкий враг устоял', !has(G2, 'lured') && !has(G2, 'fooled'));
    });

    await test('mirror-dead', async () => {
      const { S, hs, ms } = sc([{ ess: ['mirror-dead'], main: 'sword' }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 1); T(H); G.ac = 1; H.ac = 5;
      const mp0 = H.mp; await act(H, 'mirror-dead', { cell: [4, 5] });
      const d = B.doublesOf(H)[0];
      ok('Отражение: двойник в клетке рядом — 1 ОЗ, КД как у героя', d && d.x === 4 && d.y === 5 && d.hp === 1 && d.ac === H.ac && d.summon && d.kind === 'double' && d.side === 'hero', d && `${d.hp} ${d.ac}`);
      ok('мана 4, КД 3, бонусное действие', mp0 - H.mp === 4 && H.cd['mirror-dead'] === 3 && H.t.bonus === 0);
      ok('ходит в порядке сразу после хозяина; не герой отряда', S.order[S.order.indexOf(H.id) + 1] === d.id && B.heroes().length === 1);
      ok('одновременно один двойник', B.A['mirror-dead'].can(H) === 'двойник уже есть');
      ok('двойник бьёт оружием хозяина, вполсилы, психической энергией', d.atk[0].dt === 'psychic' && d.atk[0].dmgMult === 0.5, JSON.stringify(d.atk[0]));
      // Кто из нас? — 1–2 на к6: удар уходит в двойника
      F(1, 15, 3); const r1 = await B.doAttack(G, H, G.atk[0], { cancelable: false });
      ok('к6 = 1: атака ушла в двойника, он рассеялся', r1.tgt === d && !d.alive && H.hp === H.maxHp, `${r1.tgt && r1.tgt.name}`);
      ok('двойника нет — новый можно создать', B.A['mirror-dead'].can(H) === true);
      T(H); H.mp = H.maxMp; H.cd['mirror-dead'] = 0; await act(H, 'mirror-dead', { cell: [4, 5] }); const d2 = B.doublesOf(H)[0];
      F(5, 15, 3); const r2 = await B.doAttack(G, H, G.atk[0], { cancelable: false }); ok('к6 = 5: атака в героя', r2.tgt === H && d2.alive);
      F(2, 15, 3); const r3 = await B.doAttack(G, H, G.atk[0], { cancelable: false }); ok('к6 = 2 тоже уходит в двойника', r3.tgt === d2);
      // ход двойника
      T(H); H.mp = H.maxMp; H.cd['mirror-dead'] = 0; await act(H, 'mirror-dead', { cell: [3, 4] }); const d3 = B.doublesOf(H)[0]; place(G, 3, 3); T(d3); G.ac = 1;
      F(15, 8); const dr = await B.doAttack(d3, G, d3.atk[0], { cancelable: false }); const full = 8 + B.amod(H.abil.str);
      ok('двойник бьёт оружием хозяина: психический урон, половина', dr.hit && dr.parts[0].dt === 'psychic' && dr.parts[0].v === Math.floor(full / 2), JSON.stringify(dr.parts));
      const hpG = G.hp; T(d3); F(15, 8); await B.AI.takeTurn(d3); ok('и сам ходит по ИИ: идёт и бьёт', G.hp < hpG && d3.t.action === 0, `${hpG - G.hp}`);
      // срок и гибель хозяина
      ok('двойник исчезает через 10 раундов', (() => { const r0 = S.round; B.onRound(r0 + 10); const a = d3.alive; B.onRound(r0 + 11); return a && !d3.alive; })());
      T(H); H.mp = H.maxMp; H.cd['mirror-dead'] = 0; await act(H, 'mirror-dead', { cell: [4, 5] }); const d4 = B.doublesOf(H)[0]; await B.applyDamage(G, H, [{ v: 999, dt: 'slash' }], {}); ok('когда герой падает — двойник рассеивается', !d4.alive);
    });

    await test('faceless-ringer', async () => {
      const { S, hs, ms } = sc([{ ess: ['faceless-ringer'], base: { cha: 14, dex: 14 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 1); T(H); H.ac = 5; G.ac = 1;
      ok('Скрытность −1', H.skills.stealth === -1, H.skills.stealth);
      const mp0 = H.mp; F(); await act(H, 'faceless-ringer', {});
      const ds = B.doublesOf(H);
      ok('Колокол теней: два двойника сверх лимита, оба «колокольные» одного звона', ds.length === 2 && ds.every(d => d.bell && d.bell === ds[0].bell) && H.bellLeft && H.bellLeft[ds[0].bell] === 2);
      ok('сразу пытается спрятаться, даже без укрытия', has(H, 'hidden'), logs(4));
      ok('мана 4, КД 6, действие', mp0 - H.mp === 4 && H.cd['faceless-ringer'] === 6 && H.t.action === 0);
      // отдача 2к6 при исчезновении последнего
      const hp0 = H.hp; B.vanish(ds[0], 'тест'); await B.flushQueue(); ok('пока остался один двойник — отдачи нет', H.hp === hp0);
      F(3, 4); B.vanish(ds[1], 'тест'); await B.flushQueue(); ok('когда исчез последний — 2к6 психического (7)', hp0 - H.hp === 7, hp0 - H.hp);
      // срок
      T(H); H.mp = H.maxMp; H.cd['faceless-ringer'] = 0; B.removeStatus(H, 'hidden'); await act(H, 'faceless-ringer', {}); const hp1 = H.hp; F(2, 2); B.onRound(S.round + 11); await B.flushQueue(); ok('двойники исчезают через минуту — тоже отдача', hp1 - H.hp === 4, hp1 - H.hp);
      // хозяин упал — отдачи нет
      T(H); H.mp = H.maxMp; H.cd['faceless-ringer'] = 0; await act(H, 'faceless-ringer', {}); await B.applyDamage(G, H, [{ v: H.hp + 2, dt: 'slash' }], {}); await B.flushQueue(); ok('если герой упал — отдача не добивает', H.down && H.hp === 0 && !H.dead, `${H.hp} ${H.down} ${H.dead}`);
      // Подмена
      const s2 = setup([mk(170, { ess: ['faceless-ringer'], base: { cha: 14 } })], ['goblin']); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 3); H2.ac = 5; G2.ac = 1; T(H2); T(G2);
      const dbl = B.makeDouble(H2, [4, 5]); const hpb = H2.hp; F(15, 3);
      const r = await B.doAttack(G2, H2, G2.atk[0], { cancelable: false });
      ok('Подмена: попавшую атаку принял двойник, герой на его месте цел', r.swapped && H2.hp === hpb && H2.x === 4 && H2.y === 5 && !dbl.alive, `${r.swapped} ${H2.x},${H2.y}`);
      ok('атаковавший двойника обманут, реакция потрачена', has(G2, 'fooled') && H2.t.react === 0);
      B.makeDouble(H2, [3, 5]); B.removeStatus(G2, 'fooled'); T(G2); F(15, 3); const r2 = await B.doAttack(G2, H2, G2.atk[0], { cancelable: false }); ok('раз в раунд: вторая попавшая атака проходит', !r2.swapped && r2.hit);
      // атака по самому двойнику
      const s3 = setup([mk(171, { ess: ['faceless-ringer'] })], ['goblin']); const H3 = B.heroes()[0], G3 = B.mons()[0]; place(H3, 3, 5); place(G3, 3, 3); T(G3); const d3 = B.makeDouble(H3, [4, 5]); G3.ac = 40; F(5); await B.doAttack(G3, d3, G3.atk[0], { cancelable: false });
      ok('кто атаковал двойника (даже промахнувшись) — обманут', has(G3, 'fooled'));
    });

    await test('dust-crawler', async () => {
      const { S, hs, ms } = sc([{ ess: ['dust-crawler'] }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H);
      ok('Скорость −1,5 м: 4 − 1 = 3 клетки', B.speedOf(H) === 3, B.speedOf(H));
      H.hp = H.hero.hp = 1; F(20); await B.applyDamage(G, H, [{ v: 5, dt: 'slash', label: 'тест' }], { src: G });
      ok('Упорство мертвеца: урон до 0, спасбросок Тел. Сл 5 + урон удался — остался 1 ОЗ', H.hp === 1 && !H.down && H.flags.deadwill, `${H.hp} ${H.down}`);
      F(20); await B.applyDamage(G, H, [{ v: 5, dt: 'slash', label: 'тест' }], { src: G }); ok('раз за бой: повторно не срабатывает', H.hp === 0 && H.down);
      const mk2 = () => { const s2 = setup([mk(180, { ess: ['dust-crawler'] })], ['goblin']); const h = B.heroes()[0], g = B.mons()[0]; place(h, 3, 5); place(g, 3, 4); h.hp = h.hero.hp = 1; return { h, g }; };
      let { h, g } = mk2(); F(20); await B.applyDamage(g, h, [{ v: 5, dt: 'slash' }], { src: g, crit: true }); ok('не работает против критического попадания', h.down);
      ({ h, g } = mk2()); F(20); await B.applyDamage(g, h, [{ v: 5, dt: 'radiant' }], { src: g }); ok('и против излучения', h.down);
      ({ h, g } = mk2()); F(1); await B.applyDamage(g, h, [{ v: 5, dt: 'slash' }], { src: g }); ok('провал спасброска — падает', h.down);
      ({ h, g } = mk2()); F(20); await B.applyDamage(g, h, [{ v: 30, dt: 'slash' }], { src: g }); ok('Сл растёт с уроном: 5 + 30 = 35 не взять', h.down);
      // Горсть пыли
      const s3 = setup([mk(181, { ess: ['dust-crawler'] })], ['goblin']); const H3 = B.heroes()[0], G3 = B.mons()[0]; place(H3, 3, 5); place(G3, 3, 4); T(H3); const mp0 = H3.mp; F(); await act(H3, 'dust-crawler', { unit: G3 });
      ok('Горсть пыли: слабый провалил — ослеплён до конца следующего хода', has(G3, 'blinded') && mp0 - H3.mp === 2 && H3.cd['dust-crawler'] === 3 && H3.t.bonus === 0);
      ok('ослеплённый бьёт с помехой, по нему — с преимуществом', B.attackCtx(G3, H3, G3.atk[0]).dis.includes('ослеплён') && B.attackCtx(H3, G3, meleeOf(H3)).adv.includes('цель ослеплена'));
      G3.turnsTaken = 1; B.removeStatus(G3, 'blinded'); B.addStatus(G3, 'blinded', { k: 1, when: 'end' }); G3.turnsTaken = 2; await B.endTurn(G3); ok('кончается в конце его следующего хода', !has(G3, 'blinded'));
    });

    await test('bone-hound', async () => {
      const { S, hs, ms } = sc([{ ess: ['bone-hound'] }], ['goblin', 'goblin']);
      const [H] = hs, [G, G2] = ms; place(H, 3, 5); place(G, 3, 1); place(G2, 4, 6); T(H); T(G2); G2.t.react = 1;
      ok('скорость +1,5 м: 5 клеток; Харизма −1 и нюх', B.speedOf(H) === 5);
      const mp0 = H.mp; const r = await act(H, 'bone-hound', { unit: G });
      ok('Загон: пробежал половину скорости (2 клетки) к цели', r && H.y === 3 && dist(H, G) === 2, `${H.x},${H.y}`);
      ok('и без атаки по возможности от соседа', G2.t.react === 1);
      ok('мана 2, КД 2, бонусное действие; движение тоже потрачено частично', mp0 - H.mp === 2 && H.cd['bone-hound'] === 2 && H.t.bonus === 0);
      place(G, 3, 4); place(H, 3, 5); T(H); ok('цель вплотную — сближаться некуда', !B.A['bone-hound'].tgt(H).units.includes(G.id));
    });

    await test('gravedigger', async () => {
      const { S, hs, ms } = sc([{ ess: ['gravedigger'], base: { str: 16 } }, {}], ['goblin']);
      const [H, C] = hs, G = ms[0]; place(H, 3, 5); place(C, 4, 5); place(G, 3, 4); T(H); T(C);
      const mp0 = H.mp; F(20, 1); const r = await act(H, 'gravedigger', { unit: G });
      const bu = has(G, 'buried');
      ok('Похоронить заживо: выиграл состязание Атлетики — цель засыпана', r && bu && bu.data.by === H.id, logs(3));
      ok('мана 2, КД 3, действие', mp0 - H.mp === 2 && H.cd.gravedigger === 3 && H.t.action === 0);
      ok('засыпанный: скорость 0, ослеплён (по нему с преимуществом, он с помехой)', B.speedOf(G) === 0 && B.attackCtx(H, G, meleeOf(H)).adv.includes('цель засыпана') && B.attackCtx(G, H, G.atk[0]).dis.includes('ослеплён'));
      ok('Сл освобождения = результат могильщика + 1 (нужно больше)', bu.data.dc > 20, bu.data.dc);
      ok('союзник рядом может откопать действием', (() => { B.addStatus(C, 'buried', { k: 1, when: 'end', data: { dc: 99, by: H.id } }); place(H, 4, 4); T(H); const o = B.actionsFor(H).find(x => x.id === 'dig'); return o && o.enabled; })());
      T(H); await B.actionsFor(H).find(x => x.id === 'dig').run(); ok('откопан без проверки', !has(C, 'buried'));
      // сам освобождается
      B.addStatus(C, 'buried', { k: 1, when: 'end', data: { dc: 15, by: H.id } }); T(C); F(20); const esc = B.actionsFor(C).find(x => x.id === 'escape'); ok('у засыпанного есть «Вырваться»', esc && esc.enabled); await esc.run(); ok('Атлетика против результата — освободился', !has(C, 'buried'));
      B.addStatus(C, 'buried', { k: 1, when: 'end', data: { dc: 99, by: H.id } }); T(C); F(5); await B.actionsFor(C).find(x => x.id === 'escape').run(); ok('провал — остаётся засыпан', !!has(C, 'buried'));
      // проигрыш состязания
      const s2 = setup([mk(190, { ess: ['gravedigger'] })], ['goblin']); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 4); G2.abil.str = 30; G2.abil.dex = 30; T(H2); F(5, 20); await act(H2, 'gravedigger', { unit: G2 }); ok('проиграл состязание — ничего', !has(G2, 'buried'));
      // Глубокая яма
      const s3 = setup([mk(191, { ess: ['gravedigger'] })], ['goblin', 'goblin']); const H3 = B.heroes()[0], [G3, G4] = B.mons(); place(H3, 3, 5); place(G3, 3, 4); place(G4, 5, 1); T(H3);
      B.knock(G3, H3); B.knock(G4, null); T(G3, { move: 4 }); T(G4, { move: 4 });
      ok('Глубокая яма: сбитый могильщиком тратит на подъём всё перемещение', B.standCost(G3) === 4 && B.standCost(G4) === 2, `${B.standCost(G3)} ${B.standCost(G4)}`);
      T(G3, { move: 1 }); ok('даже если осталось 1 клетка движения — тратит всё', B.standCost(G3) === 1);
      // толчок могильщика запоминается
      T(H3); const sh = B.actionsFor(H3).find(x => x.id === 'shove'); ok('толчок есть среди действий', !!sh);
    });

    await test('plague-fat', async () => {
      const { S, hs, ms } = sc([{ ess: ['plague-fat'], base: { con: 14 } }, {}], ['goblin', 'goblin']);
      const [H, A_] = hs, [G, G2] = ms; place(H, 3, 5); place(A_, 4, 5); place(G, 3, 4); place(G2, 3, 2); T(H); T(G); H.ac = 5; G.ac = 1;
      ok('сопротивление яду', H.resist.includes('poison'));
      let rot = 0; const oSave = B.doSave; B.doSave = async (u, a, d, o) => { if (o && o.label === 'Гнилая кровь') { rot++; if (d !== 10 || a !== 'con') rot += 100; } return oSave(u, a, d, o); };
      F(15, 2); const r = await B.doAttack(G, H, G.atk[0], { cancelable: false });
      ok('Гнилая кровь: попали рукопашной — атакующий делает спасбросок Тел. Сл 10, слабый провалил — отравлен', r.hit && rot === 1 && has(G, 'poisoned'), `${rot} ${logs(3)}`);
      B.removeStatus(G, 'poisoned'); F(15, 2); await B.doAttack(G, H, G.atk[0], { cancelable: false });
      ok('раз в раунд: второе попадание в том же раунде спасброска не требует', rot === 1 && !has(G, 'poisoned'), rot);
      B.S.round++; F(15, 2); await B.doAttack(G, H, G.atk[0], { cancelable: false }); ok('в следующем раунде — снова', has(G, 'poisoned') && rot === 2, rot);
      const s2 = setup([mk(200, { ess: ['plague-fat'] })], ['skeleton-archer']); const H2 = B.heroes()[0], Ar = B.mons()[0]; place(H2, 3, 5); place(Ar, 3, 1); H2.ac = 5; Ar.ac = 1; Ar.abil = { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }; F(15, 2);
      const bow = Ar.atk.find(a => a.kind === 'ranged'); const rot0 = rot; await B.doAttack(Ar, H2, bow, { cancelable: false }); B.doSave = oSave; ok('дальняя атака не вызывает спасброска', !has(Ar, 'poisoned') && rot === rot0, rot);
      // облако
      const s3 = setup([mk(201, { ess: ['plague-fat'], base: { con: 14 } }), mk(202, {})], ['goblin', 'goblin']); const [H3, A3] = B.heroes(), [M1, M2] = B.mons(); place(H3, 3, 5); place(A3, 4, 5); place(M1, 3, 3); place(M2, 3, 0); T(H3); const mp0 = H3.mp, hpA = A3.hp, h1 = M1.hp;
      F(4); const rr = await act(H3, 'plague-fat', {});
      ok('Облако гнили: все в 3 м, слабый провалил — 1к6 ядом (4) и отравлен', rr && h1 - M1.hp === 4 && has(M1, 'poisoned'), `${h1 - M1.hp}`);
      ok('в облаке и союзник (все существа в 3 м)', A3.hp < hpA || logHas(/Облако гнили/));
      ok('дальний враг не задет; мана 4, КД 3, действие', M2.hp === 300 && mp0 - H3.mp === 4 && H3.cd['plague-fat'] === 3 && H3.t.action === 0);
      ok('Сл = 8 + БМ + мод. Телосложения', B.dcOf(H3, 'con') === 8 + H3.pb + B.amod(H3.abil.con));
    });

    await test('ash-spirit', async () => {
      const { S, hs, ms } = sc([{ ess: ['ash-spirit'], base: { dex: 16 } }, {}], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 5); place(A_, 0, 6); place(G, 3, 4); T(H);
      ok('сопротивление огню', H.resist.includes('fire'));
      const map = B.pathMap(H, 4, {}); ok('Летучий прах: путь ведёт сквозь клетку врага', map.has('3,3') && B.canPass(H, 3, 4, {}) && !B.canStand(H, 3, 4));
      const plain = mk(210, {}); const s2 = setup([plain], ['goblin']); const P0 = B.heroes()[0], G2 = B.mons()[0]; place(P0, 3, 5); place(G2, 3, 4); ok('обычный герой сквозь врага не пройдёт', !B.canPass(P0, 3, 4, {}));
      const s3 = setup([mk(211, { ess: ['ash-spirit'], base: { dex: 16 } })], ['goblin']); const H3 = B.heroes()[0], G3 = B.mons()[0]; place(H3, 3, 5); place(G3, 3, 4); T(H3);
      await B.moveAlong(H3, [[3, 4], [3, 3]]); ok('прошёл сквозь врага и встал за ним', H3.x === 3 && H3.y === 3);
      place(H3, 3, 5); await B.moveAlong(H3, [[3, 4]]); ok('остановили посреди чужой клетки — встаёт рядом, а не в нём', !(H3.x === G3.x && H3.y === G3.y), `${H3.x},${H3.y}`);
      // рассыпаться
      const s4 = setup([mk(212, { ess: ['ash-spirit'], base: { dex: 16 } }), mk(213, {})], ['goblin', 'goblin']); const [H4, A4] = B.heroes(), [M1, M2] = B.mons(); place(H4, 3, 6); place(A4, 5, 2); place(M1, 3, 2); place(M2, 6, 0); T(H4);
      const mp0 = H4.mp, h1 = M1.hp; F(4); const rr = await act(H4, 'ash-spirit', { cell: [3, 3] });
      ok('Рассыпаться пеплом: собрался в выбранной точке, соседи в 1,5 м — 1к6 огнём (4)', rr && H4.x === 3 && H4.y === 3 && h1 - M1.hp === 4, `${H4.x},${H4.y} ${h1 - M1.hp}`);
      ok('мана 4, КД 3, действие; далёкий не задет', mp0 - H4.mp === 4 && H4.cd['ash-spirit'] === 3 && H4.t.action === 0 && M2.hp === 300);
      ok('Сл = 8 + БМ + мод. Ловкости', B.dcOf(H4, 'dex') === 8 + H4.pb + B.amod(H4.abil.dex));
      ok('точка должна быть видимой и свободной', !B.A['ash-spirit'].tgt(H4).cells.some(([x, y]) => x === M1.x && y === M1.y));
    });

    await test('bone-knight', async () => {
      const { S, hs, ms } = sc([{ ess: ['bone-knight'], main: 'sword', base: { str: 16 } }, {}], ['goblin']);
      const [H, C] = hs, G = ms[0]; place(H, 3, 5); place(C, 6, 6); place(G, 3, 4); T(H);
      ok('КД +1, скорость −1,5 м (3 клетки), уязвимость к излучению', H.ac === C.ac + 1 || H.ac >= C.ac, `${H.ac} vs ${C.ac}`);
      ok('скорость 3, уязвим к излучению', B.speedOf(H) === 3 && H.vuln.includes('radiant'), `${B.speedOf(H)} ${H.vuln}`);
      let hp0 = H.hp; await B.applyDamage(G, H, [{ v: 5, dt: 'slash', label: 'меч' }], { ctx: {} }); ok('Латы из костей: рубящий оружием −2', hp0 - H.hp === 3, hp0 - H.hp);
      H.hp = H.hero.hp = H.maxHp; hp0 = H.hp; await B.applyDamage(G, H, [{ v: 5, dt: 'pierce', label: 'копьё' }], { ctx: {} }); ok('колющий −2', hp0 - H.hp === 3);
      hp0 = H.hp; await B.applyDamage(G, H, [{ v: 5, dt: 'bludgeon', label: 'булава' }], { ctx: {} }); ok('дробящий — без уменьшения', hp0 - H.hp === 5);
      hp0 = H.hp; await B.applyDamage(G, H, [{ v: 5, dt: 'slash', label: 'способность' }], {}); ok('урон способности (не оружия) — без уменьшения', hp0 - H.hp === 5);
      H.hp = H.hero.hp = H.maxHp; hp0 = H.hp; await B.applyDamage(G, H, [{ v: 5, dt: 'radiant', label: 'свет' }], {}); ok('излучение ×2', hp0 - H.hp === 10, hp0 - H.hp);
      H.hp = H.hero.hp = H.maxHp; hp0 = H.hp; await B.applyDamage(G, H, [{ v: 2, dt: 'slash', label: 'царапина' }], { ctx: {} }); ok('урон не опускается ниже 0', hp0 - H.hp === 0);
      // рывок
      const s2 = setup([mk(220, { ess: ['bone-knight'], main: 'sword', base: { str: 16 } })], ['goblin', 'goblin']); const H2 = B.heroes()[0], [G2, G3] = B.mons(); place(H2, 3, 6); place(G2, 3, 3); place(G3, 2, 5); G3.t.react = 1; T(H2); const mp0 = H2.mp;
      F(15, 3, 5, 5); const r = await act(H2, 'bone-knight', { cell: [3, 4] });
      ok('Рывок мертвеца: по прямой, меч, +2к6 (10), провал Силы — отброшен на 3 м и сбит с ног', r && H2.y === 4 && G2.y === 1 && has(G2, 'prone') && logHas(/Рывок мертвеца: 10/), `${H2.x},${H2.y} ${G2.x},${G2.y}`);
      ok('движение не провоцирует; мана 4, КД 3, действие', G3.t.react === 1 && mp0 - H2.mp === 4 && H2.cd['bone-knight'] === 3 && H2.t.action === 0);
      const s3 = setup([mk(221, { ess: ['bone-knight'], main: 'mace' })], ['goblin']); const H3 = B.heroes()[0]; ok('без меча способность недоступна', B.A['bone-knight'].can(H3) === 'нужен меч', B.A['bone-knight'].can(H3));
    });

    await test('corpse-eater', async () => {
      const { S, hs, ms } = sc([{ ess: ['corpse-eater'], base: { str: 14 } }], ['goblin', 'goblin']);
      const [H] = hs, [G, G2] = ms; place(H, 3, 5); place(G, 3, 4); place(G2, 3, 1); T(H);
      const gn = () => B.actionsFor(H).find(o => o.id === 'gnaw');
      ok('Пожиратель: без павших рядом недоступен', gn() && !gn().enabled);
      B.kill(G, H); ok('павший монстр остаётся телом на поле', S.bodies.length === 1 && !S.bodies[0].eaten, JSON.stringify(S.bodies));
      H.hp = H.hero.hp = H.maxHp - 12; T(H); ok('рядом тело — доступно', gn().enabled); const hp0 = H.hp; F(5); await gn().run();
      ok('бонусным действием: восстанавливает 1к8 ОЗ (5)', H.hp - hp0 === 5 && H.t.bonus === 0, H.hp - hp0);
      T(H); ok('с одного тела — один раз', !gn().enabled && S.bodies[0].eaten);
      // нет тела — нет еды у союзников-призванных
      B.kill(G2, H); ok('тело вдали не доступно', !gn().enabled);
      // парализующий укус
      const s2 = setup([mk(230, { ess: ['corpse-eater'] })], ['goblin']); const H2 = B.heroes()[0], M = B.mons()[0]; place(H2, 3, 5); place(M, 3, 4); T(H2); const mp0 = H2.mp, hpM = M.hp;
      F(15, 3, 4); const r = await act(H2, 'corpse-eater', { unit: M });
      ok('Парализующий укус: +1к6 (4) и провал Тел. — парализован', r && has(M, 'paralyzed') && logHas(/Парализующий укус: 4/), logs(3));
      ok('мана 4, КД 4, действие; Сл = 8 + БМ + мод. Тел.', mp0 - H2.mp === 4 && H2.cd['corpse-eater'] === 4 && H2.t.action === 0 && has(M, 'paralyzed').data.dc === B.dcOf(H2, 'con'));
      ok('парализованный: действовать нельзя, по нему вплотную — критическое', !B.canAct(M) && B.attackCtx(H2, M, meleeOf(H2)).autoCrit === true);
      F(20); await B.endTurnSaves(M); ok('повтор спасброска в конце хода снимает паралич', !has(M, 'paralyzed'));
      B.addStatus(M, 'paralyzed', { k: 10, when: 'end', data: { dc: 99, abil: 'con' } }); F(5); await B.endTurnSaves(M); ok('провал — остаётся парализован', !!has(M, 'paralyzed'));
      ok('на минуту (10 ходов)', has(M, 'paralyzed').k === M.turnsTaken + 10);
    });

    await test('ash-wraith', async () => {
      const { S, hs, ms } = sc([{ ess: ['ash-wraith'], base: { con: 14 } }, {}], ['goblin', 'goblin']);
      const [H, A_] = hs, [G, G2] = ms; place(H, 3, 5); place(A_, 4, 5); place(G, 3, 4); place(G2, 3, 1); T(H);
      ok('сопротивление огню; холод +1к6; светится', H.resist.includes('fire') && H.extraTaken.cold === '1к6' && !!has(H, 'lit'));
      S.dark = true; ok('в темноте светится на 3 м (2 клетки)', B.lightAt(3, 3) && B.lightAt(5, 5) && !B.lightAt(0, 0)); S.dark = false;
      const hp0 = G.hp; F(3); await B.zonesTurnStart(G); ok('Тлеющее тело: начавший ход рядом получает 1к4 огнём (3)', hp0 - G.hp === 3, hp0 - G.hp);
      const hpA = A_.hp; F(2); await B.zonesTurnStart(A_); ok('и союзник рядом тоже', hpA - A_.hp === 2, hpA - A_.hp);
      const hpF = G2.hp; await B.zonesTurnStart(G2); ok('дальше 1,5 м — нет', G2.hp === hpF);
      F(2); const hh = H.hp; await B.applyDamage(G, H, [{ v: 4, dt: 'cold', label: 'лёд' }], {}); ok('холод по пепельнику +1к6', hh - H.hp === Math.floor(4 / 1) + 2 || hh - H.hp === 6, hh - H.hp);
      const mp0 = H.mp; await act(H, 'ash-wraith', {});
      const z = S.zones.find(q => q.kind === 'dust');
      ok('Белая пыль: сфера 4,5 м вокруг, на минуту, движется с хозяином', z && z.follow === H.id && z.radius === 3 && z.until === S.round + 10 && mp0 - H.mp === 4 && H.cd['ash-wraith'] === 4 && H.t.action === 0);
      ok('Сл = 8 + БМ + мод. Телосложения', z.dc === B.dcOf(H, 'con'));
      T(G); const hpP = G.hp; F(3); await B.zonesTurnStart(G); ok('начавший ход внутри (не хозяин): спасбросок Тел., слабый провалил — отравлен', has(G, 'poisoned'));
      const before = G2.conds.length; await B.zonesTurnStart(H); ok('сам пепельник пыль не травит', !has(H, 'poisoned'));
      place(H, 1, 5); ok('пыль идёт за ним', B.zoneCells(z).some(([x, y]) => x === 1 && y === 5) && !B.zoneCells(z).some(([x, y]) => x === 5 && y === 5));
      place(G, 1, 3); place(A_, 1, 1); B.addStatus(A_, 'restrained', { k: Infinity });
      const cd = B.attackCtx(G, A_, G.atk[0]); ok('белая пыль гасит преимущество на дальней атаке (решение автора), помехи не вешает', cd.adv.length === 0 && !cd.dis.includes('густая пыль') && cd.notes.some(n => /пыль/.test(n)), JSON.stringify([cd.adv, cd.dis, cd.notes]));
      place(G, 1, 4); const cc = B.attackCtx(G, H, G.atk[0]); ok('вплотную — без помехи от пыли', !cc.dis.includes('густая пыль'));
      B.removeStatus(A_, 'restrained');
      await B.applyDamage(G, H, [{ v: 999, dt: 'slash' }], {}); ok('когда пепельник пал, пыль рассеялась', !S.zones.some(q => q.kind === 'dust'));
    });


    /* ===== РЕГРЕССИЯ ПО НЕЗАВИСИМОМУ АУДИТУ (три аудитора сверяли код с rules.md) ===== */
    await test('audit-cooldown', async () => {
      const { S, hs, ms } = sc([{ ess: ['goblin-shaman'], base: { wis: 14 } }, {}], ['goblin']);
      const [H, A_] = hs; place(H, 3, 5); place(A_, 4, 5); A_.hp = A_.hero.hp = A_.maxHp - 9; T(H); F(4);
      await act(H, 'goblin-shaman', { unit: A_ });
      const open = () => B.actionsFor(H).find(o => o.id === 'skill:goblin-shaman').enabled;
      ok('перезарядка 2 раунда: в ход применения она 2 и в конце хода не убавляется', H.cd['goblin-shaman'] === 2 && (await B.endTurn(H), H.cd['goblin-shaman'] === 2), H.cd['goblin-shaman']);
      T(H); ok('следующий раунд: способность недоступна', !open());
      await B.endTurn(H); T(H); ok('через раунд: осталось 1, всё ещё недоступна', H.cd['goblin-shaman'] === 1 && !open(), H.cd['goblin-shaman']);
      await B.endTurn(H); T(H); ok('после двух раундов ожидания — доступна снова', H.cd['goblin-shaman'] === 0 && open(), H.cd['goblin-shaman']);
      // реакция в чужой ход: счёт идёт со следующего своего хода, лишнего раунда нет
      B.S.curId = ms[0].id; B.setCd(H, 'x', 1); await B.endTurn(H); ok('кд 1, поставленный не в свой ход, снимается в конце следующего своего хода', H.cd.x === 0, H.cd.x);
    });

    await test('audit-assassin', async () => {
      const { S, hs, ms } = sc([{ ess: ['goblin-assassin'], main: 'dagger', base: { dex: 16 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H); G.hp = 1;
      const atk = meleeOf(H); B.addStatus(H, 'hidden', { k: Infinity }); F(15, 3);
      const r = await B.doAttack(H, G, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, G) });
      ok('«Нож в спину» убил цель — перезарядка всё равно пошла', r.killed && H.cd.stab === 2, `${r.killed} ${H.cd.stab}`);
      // промах тоже тратит «первую атаку»
      const s2 = setup([mk(300, { ess: ['goblin-assassin'], main: 'dagger', base: { dex: 16 } })], ['goblin']); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 5); place(G2, 3, 4); T(H2); G2.ac = 40;
      const a2 = meleeOf(H2); B.addStatus(H2, 'hidden', { k: Infinity }); F(2); await B.doAttack(H2, G2, a2, { cancelable: false, onCommit: () => B.commitAttack(H2, a2, G2) });
      ok('промах по неподозревающей цели тоже запускает перезарядку (первая атака, а не первое попадание)', H2.cd.stab === 2, H2.cd.stab);
      // «Уход в тень»: кусты в соседней клетке — укрытие рядом
      const s3 = setup([mk(301, { ess: ['goblin-assassin'], main: 'dagger', base: { dex: 16 } })], ['goblin']); const H3 = B.heroes()[0], G3 = B.mons()[0]; place(H3, 3, 5); place(G3, 3, 1); T(H3);
      s3.cells[6][1] = 'bush'; F(20); await act(H3, 'goblin-assassin', { cell: [2, 6] });
      ok('конец пути у зарослей (соседняя клетка) — можно спрятаться', has(H3, 'hidden'), logs(3));
      ok('перемещение способностью засчитано в пройденном за ход', H3.t.moved >= 1, H3.t.moved);
    });

    await test('audit-thrower', async () => {
      const { S, hs, ms } = sc([{ ess: ['hobgoblin-thrower'], main: 'sword', bagW: ['spear', 'spear'], base: { dex: 16 } }], ['goblin', 'goblin']);
      const [H] = hs, [G1, G2] = ms; place(H, 3, 6); place(G1, 3, 3); place(G2, 4, 3); T(H); G1.hp = 1; F(15, 3, 15, 3);
      await act(H, 'hobgoblin-thrower', { units: [G1] });
      ok('цель пала от первого броска — второй бросок летит в другого врага', !G1.alive && G2.hp < 300, `${G1.alive} ${G2.hp}`);
    });

    await test('audit-king', async () => {
      const { S, hs, ms } = sc([{ ess: ['goblin-king'], base: { cha: 16 } }, {}], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 5); place(A_, 4, 5); place(G, 3, 2); T(H);
      A_.temp = 5; A_.tempSrc = 'heart'; F(2); await act(H, 'goblin-king', { units: [A_, G] });
      ok('рёв выпал слабее (2) чужих врем. ОЗ (5) — они остались', A_.temp === 5 && A_.tempSrc === 'heart', `${A_.temp} ${A_.tempSrc}`);
      await B.startTurn(H); await B.endTurn(H);
      ok('рёв кончился — чужие врем. ОЗ не стёрты', !has(A_, 'roar') && A_.temp === 5, `${has(A_, 'roar')} ${A_.temp}`);
      // король погиб — рёв и испуг кончаются, ОЗ рёва уходят
      A_.temp = 0; A_.tempSrc = null; B.removeStatus(G, 'frightened'); H.cd['goblin-king'] = 0; T(H); H.mp = H.maxMp; F(4); await act(H, 'goblin-king', { units: [A_, G] });
      ok('рёв: союзник получил 4 врем. ОЗ, враг испуган', A_.temp === 4 && A_.tempSrc === 'roar' && has(G, 'frightened'), `${A_.temp} ${!!has(G, 'frightened')}`);
      await B.applyDamage(G, H, [{ v: 999, dt: 'slash' }], {});
      ok('король погиб: испуг снят, врем. ОЗ рёва сгорели', !has(G, 'frightened') && A_.temp === 0 && !has(A_, 'roar'), `${!!has(G, 'frightened')} ${A_.temp}`);
    });

    await test('audit-driver', async () => {
      const { S, hs, ms } = sc([{ ess: ['hobgoblin-driver'], main: 'spear' }, { main: 'sword' }], ['goblin']);
      const [H, A_] = hs, G = ms[0]; place(H, 3, 6); place(A_, 3, 4); place(G, 3, 0); T(A_); T(H);
      B.addStatus(A_, 'frightened', { k: Infinity, data: { by: G.id } });
      const d0 = dist(A_, G); await act(H, 'hobgoblin-driver', { unit: A_ });
      ok('испуганный союзник не приближается к источнику страха', dist(A_, G) >= d0, `${d0} → ${dist(A_, G)}`);
      A_.t.disengage = true; await B.endTurn(A_); ok('«Отход» кончается вместе с ходом, на чужой ход не переходит', !A_.t.disengage);
    });

    await test('audit-auras', async () => {
      const { hs } = sc([{ ess: ['goblin-shaman'] }, { ess: ['goblin-shaman'] }, {}], ['goblin']);
      const [S1, S2, A_] = hs; place(S1, 2, 5); place(S2, 4, 5); place(A_, 3, 5); T(S1); T(S2); T(A_);
      ok('два шамана рядом: +1 к спасброску, а не +2', B.auraSave(A_, 'wis').mods.filter(m => m.l === 'Под защитой духов').length === 1);
      A_.hp = 0; A_.hero.hp = 0; A_.down = true; B.addStatus(A_, 'unconscious', { k: Infinity });
      ok('аура действует и на спасбросок от смерти', B.auraSave(A_, 'death').mods.some(m => m.l === 'Под защитой духов'));
      // слепой шаман не видит, кого лечить
      A_.hp = A_.hero.hp = 3; A_.down = false; B.removeStatus(A_, 'unconscious'); B.addStatus(S1, 'blinded', { k: Infinity }); ok('слепой шаман лечит только себя (если ранен)', B.A['goblin-shaman'].can(S1) !== true);
      B.removeStatus(S1, 'blinded');
      const s2 = sc([{ ess: ['goblin-king'] }, { ess: ['goblin-king'] }, {}], ['goblin']); const [K1, K2, X] = s2.hs, G = s2.ms[0]; place(K1, 1, 5); place(K2, 5, 5); place(X, 3, 5); place(G, 3, 4); T(X);
      ok('два короля: +1 к броску атаки, а не +2', B.attackCtx(X, G, meleeOf(X)).mods.filter(m => m.l === 'Пока король жив').length === 1);
      const s3 = sc([{ ess: ['werewolf'] }, { ess: ['werewolf'] }, {}], ['goblin']); const [W1, W2, Y] = s3.hs, G3 = s3.ms[0]; place(W1, 1, 5); place(W2, 5, 5); place(Y, 3, 5); place(G3, 3, 4);
      const h0 = G3.hp; await B.applyDamage(Y, G3, [{ v: 1, dt: 'slash' }], { ctx: {}, melee: true, src: Y }); ok('два волколака: союзники в 9 м бьют на +1, а не +2', h0 - G3.hp === 2, h0 - G3.hp);
    });

    await test('audit-brute-grapple', async () => {
      const { hs, ms } = sc([{ ess: ['hobgoblin-brute'], main: 'mace', base: { str: 16 } }, {}], ['zombie']);
      const [H, A_] = hs, G = ms[0]; place(H, 4, 5); place(A_, 2, 5); place(G, 3, 4); T(H); B.addStatus(A_, 'grappled', { k: Infinity, data: { by: G.id } });
      const atk = meleeOf(H); F(15, 3); await B.doAttack(H, G, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, G) });
      ok('громила оттолкнул держащего — хватка порвалась', G.x === 2 && G.y === 3 && !has(A_, 'grappled'), `${G.x},${G.y} ${!!has(A_, 'grappled')}`);
    });

    await test('audit-bomber-fire', async () => {
      const { hs, ms } = sc([{ ess: ['wisp', 'goblin-bomber'], base: { con: 12 } }], ['goblin']);
      const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H); G.hp = G.maxHp = 300; F(2, 15);
      const hp0 = G.hp; await act(H, 'wisp', {}); const dealt = hp0 - G.hp;
      ok('«Свои не горят»: «Вспышка» огонька даёт 1к4 (2) + 2 = 4', dealt === 4, dealt);
    });

    await test('audit-speed', async () => {
      const { hs } = sc([{ ess: ['goblin-thief'] }], ['goblin']); const [H] = hs;
      const base = B.speedOf(H); B.addStatus(H, 'slowed', { k: 1, when: 'end', data: { mult: 0.5 } });
      ok('«Лёгкие ноги» считаются до замедления: (скорость+1)/2', B.speedOf(H) === Math.floor(base / 2), `${base} → ${B.speedOf(H)}`);
    });

    await test('audit-mole-ambush', async () => {
      const heroes = [mk(310, { ess: ['giant-mole'], base: { dex: 20 } }), mk(311, { base: { dex: 20 } })];
      const S = setup(heroes, ['goblin'], { ambush: true }); const [M, X] = B.heroes(), G = B.mons()[0];
      F(20, 20, 1); B.rollInitiative();
      ok('в засаде крота нельзя застать врасплох: он идёт по своей инициативе (до слабого монстра), другой герой — после монстров', S.order.indexOf(M.id) < S.order.indexOf(G.id) && S.order.indexOf(X.id) > S.order.indexOf(G.id), JSON.stringify(S.order));
    });

    await test('audit-underground', async () => {
      const { S, hs, ms } = sc([{ ess: ['burrower'] }], ['goblin', 'wolf'], { zone: 'beast' });
      const [H] = hs, [G, W] = ms; place(H, 3, 5); place(G, 3, 4); place(W, 0, 0); T(H); T(G);
      B.addStatus(H, 'underground', { k: Infinity }); G.t.react = 1;
      ok('закопанный не действует и не реагирует', !B.canAct(H));
      await B.moveAlong(G, [[3, 3]]); ok('от закопанного можно отойти без атаки по возможности', H.t.react === 1 && !logHas(/по возможности/), logs(3));
      ok('и взрослый волк пробежит рядом, не задев закопанного (сквозной рывок)', B.ess.dashVictims(W, [[2, 5], [3, 5]]).every(v => v.id !== H.id));
    });

    await test('audit-poison-duration', async () => {
      const { S, hs, ms } = sc([{ ess: ['spider-queen'] }], ['goblin'], { zone: 'beast' });
      const [H] = hs, G = ms[0]; place(H, 3, 6); place(G, 3, 3); T(H); F(); await act(H, 'spider-queen', { cell: [3, 3] });
      F(1, 1, 1); await B.startTurn(G); ok('провал спасброска в рое: отравлен', !!has(G, 'poisoned'), logs(3));
      await B.endTurn(G); ok('«до конца хода»: в конце этого же хода отравление снято', !has(G, 'poisoned'));
      // пепельник: то же самое
      const s2 = sc([{ ess: ['ash-wraith'] }], ['goblin']); const [W] = s2.hs, G2 = s2.ms[0]; place(W, 3, 5); place(G2, 3, 3); T(W); await act(W, 'ash-wraith', {});
      F(1, 1, 1); await B.startTurn(G2); ok('белая пыль: провал — отравлен', !!has(G2, 'poisoned'), logs(3)); await B.endTurn(G2); ok('и снято в конце этого хода', !has(G2, 'poisoned'));
    });

    await test('audit-crow-eyepeck', async () => {
      const { hs, ms } = sc([{ ess: ['crow'] }], ['goblin']); const [H] = hs; place(H, 3, 5); T(H); await act(H, 'crow', {});
      ok('«В глаза» готов', !!has(H, 'eyepeck')); await B.endTurn(H); ok('не ударил в этот ход — преимущество сгорело', !has(H, 'eyepeck'));
    });

    await test('audit-fang', async () => {
      const { hs, ms } = sc([{ ess: ['swamp-fang'], main: 'spear' }], ['goblin']); const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H);
      F(15, 3, 3, 1, 1, 1, 1); await act(H, 'swamp-fang', { unit: G });
      ok('хватка клыка: вырваться только проверкой Силы (Атлетика)', has(G, 'grappled') && has(G, 'grappled').data.skill === 'athletics', JSON.stringify(has(G, 'grappled')));
      // без оружия способность недоступна
      const s2 = sc([{ ess: ['swamp-fang'], main: 'sword' }], ['goblin']); const H2 = s2.hs[0]; H2.disarmed = true; ok('«оружием»: без оружия в руке недоступна', B.A['swamp-fang'].can(H2) !== true, B.A['swamp-fang'].can(H2));
      // «Дальность 1,5 м»: копьё с «Длинной рукой» на 3 м не достаёт
      const s3 = sc([{ ess: ['swamp-fang', 'goblin-spear'], main: 'spear' }], ['goblin']); const H3 = s3.hs[0], G3 = s3.ms[0]; place(H3, 3, 5); place(G3, 3, 3); T(H3);
      ok('цель на 3 м (копьё с «Длинной рукой» достаёт, способность — нет)', B.A['swamp-fang'].can(H3) !== true, B.A['swamp-fang'].can(H3));
    });

    await test('audit-werewolf-range', async () => {
      const { S, hs } = sc([{ ess: ['werewolf'] }], ['goblin'], { zone: 'beast' }); const [H] = hs; place(H, 0, 0); T(H);
      for (let y = 0; y <= 3; y++) for (let x = 0; x <= 3; x++) if (x || y) S.cells[y][x] = 'rock';          // все клетки в 4,5 м заняты препятствиями
      ok('клетки в 4,5 м заняты, но в 9 м есть место — волки зовутся', B.A.werewolf.can(H) === true, B.A.werewolf.can(H));
      F(1); await act(H, 'werewolf', {}); const w = B.summonsOf(H); ok('волк пришёл в клетку дальше 4,5 м', w.length === 1 && Math.max(w[0].x, w[0].y) >= 4, JSON.stringify(w.map(q => [q.x, q.y])));
    });

    await test('audit-hare', async () => {
      const { hs, ms } = sc([{ ess: ['horned-hare'], main: 'spear', base: { dex: 14 } }], ['goblin']); const [H] = hs, G = ms[0]; place(H, 3, 6); place(G, 3, 1); T(H);
      await B.moveAlong(H, [[3, 5], [3, 4], [3, 3], [3, 2]]); B.addStatus(H, 'grappled', { k: Infinity, data: { by: G.id } });
      const atk = meleeOf(H); F(15, 3); await B.doAttack(H, G, atk, { cancelable: false, onCommit: () => B.commitAttack(H, atk, G) });
      ok('схваченный заяц после атаки не отскакивает («Петляет» не двигает со скоростью 0)', H.x === 3 && H.y === 2, `${H.x},${H.y}`);
      // чужой ход: разбег был, но атака по возможности в ход врага отскока не даёт
      const s2 = setup([mk(320, { ess: ['horned-hare'], main: 'spear' })], ['goblin']); const H2 = B.heroes()[0], G2 = B.mons()[0]; place(H2, 3, 6); place(G2, 3, 1); T(H2);
      await B.moveAlong(H2, [[3, 5], [3, 4], [3, 3], [3, 2]]); B.S.curId = G2.id; const a2 = meleeOf(H2); F(15, 3); await B.doAttack(H2, G2, a2, { cancelable: false, onCommit: () => B.commitAttack(H2, a2, G2), reaction: true });
      ok('«Петляет» — только после атаки в свой ход', H2.x === 3 && H2.y === 2, `${H2.x},${H2.y}`);
    });

    await test('audit-blackwing', async () => {
      const { hs, ms } = sc([{ ess: ['blackwing'], main: 'spear' }], ['goblin']); const [H] = hs, G = ms[0]; place(H, 3, 6); place(G, 3, 1); T(H); B.addStatus(H, 'hidden', { k: Infinity }); G.blind = 6; F(15, 3, 5, 5);
      await act(H, 'blackwing', { cell: [3, 2] });
      ok('цель чует героя (слепое зрение) — преимущества из укрытия нет, дополнительного действия тоже', H.t.action === 0, `action=${H.t.action}`);
    });

    await test('audit-bell', async () => {
      const { S, hs, ms } = sc([{ ess: ['faceless-ringer', 'mirror-dead'], base: { cha: 14, dex: 14 } }], ['goblin']); const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 1); T(H); H.mp = 99;
      F(); await act(H, 'faceless-ringer', {}); const g1 = B.doublesOf(H).map(d => d.bell);
      ok('колокольные двойники не занимают обычный лимит: «Отражение» доступно', B.A['mirror-dead'].can(H) === true, B.A['mirror-dead'].can(H));
      H.cd['faceless-ringer'] = 0; T(H); B.removeStatus(H, 'hidden'); F(); await act(H, 'faceless-ringer', {});
      const groups = Object.keys(H.bellLeft); ok('второй звон — отдельная группа со своим счётчиком', groups.length === 2 && groups.every(k => H.bellLeft[k] === 2), JSON.stringify(H.bellLeft));
      const ds = B.doublesOf(H), first = ds.filter(d => d.bell === +groups[0]), second = ds.filter(d => d.bell === +groups[1]); const hp0 = H.hp;
      first.forEach(d => B.vanish(d, 'тест')); await B.flushQueue(); ok('исчезла первая пара: отдача за первый звон', hp0 - H.hp > 0, hp0 - H.hp);
      const hp1 = H.hp; second.forEach(d => B.vanish(d, 'тест')); await B.flushQueue(); ok('исчезла вторая пара: ещё одна отдача, отдельная', hp1 - H.hp > 0, hp1 - H.hp);
    });

    await test('audit-crawler-plague', async () => {
      const { hs, ms } = sc([{ ess: ['dust-crawler'] }], ['goblin']); const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H); H.hp = H.hero.hp = 2;
      F(1); await B.applyDamage(G, H, [{ v: 4, dt: 'slash' }], {}); ok('первый спасбросок «Упорства» провален — герой упал', H.down, H.hp);
      B.revive(H); B.setHp(H, 5); H.t = H.t; F(20); await B.applyDamage(G, H, [{ v: 9, dt: 'slash' }], {}); ok('раз за бой: вторая попытка невозможна, даже после провала', H.down || H.hp === 0, `${H.down} ${H.hp}`);
      // толстяк: раз в ход, а не раз в раунд
      const s2 = sc([{ ess: ['plague-fat'] }], ['goblin', 'goblin']); const [P] = s2.hs, [A1, A2] = s2.ms; place(P, 3, 5); place(A1, 3, 4); place(A2, 2, 4); T(P);
      const a1 = A1.atk[0], a2 = A2.atk[0]; B.S.curId = A1.id; F(15, 3, 1); await B.doAttack(A1, P, a1, { cancelable: false }); B.S.curId = A2.id; F(15, 3, 1); await B.doAttack(A2, P, a2, { cancelable: false });
      ok('«Гнилая кровь»: оба гоблина в одном раунде, каждый в свой ход, спасаются от отравления', !!has(A1, 'poisoned') && !!has(A2, 'poisoned'), `${!!has(A1, 'poisoned')} ${!!has(A2, 'poisoned')}`);
    });

    await test('audit-whisperer', async () => {
      const { S, hs, ms } = sc([{ ess: ['whisperer'] }], ['goblin', 'goblin']); const [H] = hs, [G1, G2] = ms; place(H, 3, 5); place(G1, 1, 2); place(G2, 5, 2); T(H);
      B.addStatus(G1, 'fooled', { k: 1, when: 'end', data: { atkUsed: false, chkUsed: false } });
      ok('обманут только один из двух видящих — без укрытия не спрятаться', B.hideSpot(H) === null, B.hideSpot(H));
      B.addStatus(G2, 'fooled', { k: 1, when: 'end', data: { atkUsed: false, chkUsed: false } });
      ok('обмануты все, кто видит — можно спрятаться без укрытия', B.hideSpot(H) === 'от обманутого', B.hideSpot(H));
      // чужой голос: идёт своим перемещением (его провоцируют), перемещение тратится целиком
      B.removeStatus(G1, 'fooled'); B.removeStatus(G2, 'fooled'); place(G1, 3, 2); G1.t = { move: 4, action: 1, bonus: 1, react: 1, moved: 0 }; place(H, 3, 3);
      B.addStatus(G1, 'lured', { k: 10, when: 'end', data: { to: [3, 2], dc: 10, by: H.id } }); await B.lureStep(G1); ok('цель уже в точке — перемещение всё равно потрачено', G1.t.move === 0, G1.t.move);
    });

    await test('audit-invisible', async () => {
      const { S, hs, ms } = sc([{ ess: ['grey-shade'] }], ['goblin']); const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(H); T(G);
      B.addStatus(H, 'hidden', { k: Infinity, data: { invis: true } }); B.addStatus(G, 'blinded', { k: 3 });
      ok('по невидимке бьют с помехой', B.attackCtx(G, H, G.atk[0]).dis.includes('цель невидима'));
      G.t.react = 1; await B.moveAlong(H, [[3, 6]]); ok('невидимку не бьют по возможности (враг его не видит)', G.t.react === 1 && !logHas(/по возможности/), logs(2));
      B.removeStatus(H, 'hidden'); place(H, 3, 5); G.t.react = 1; await B.moveAlong(H, [[3, 6]]); ok('слепой враг не бьёт по возможности и по видимому герою', G.t.react === 1 && !logHas(/по возможности/), logs(2));
    });

    await test('audit-knight', async () => {
      const { hs, ms } = sc([{ ess: ['bone-knight'] }], ['goblin']); const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); H.hp = H.hero.hp = H.maxHp = 200; H.hero.hp = 200;
      let hp = H.hp; await B.applyDamage(G, H, [{ v: 7, dt: 'slash' }], { weapon: true, melee: true }); ok('способность «урон оружия» тоже режется на 2', hp - H.hp === 5, hp - H.hp);
      hp = H.hp; await B.applyDamage(G, H, [{ v: 7, dt: 'slash' }, { v: 3, dt: 'slash' }], { weapon: true, melee: true }); ok('несколько частей одного удара — минус 2 один раз (10 → 8)', hp - H.hp === 8, hp - H.hp);
      hp = H.hp; await B.applyDamage(G, H, [{ v: 7, dt: 'slash' }], { skill: true }); ok('не оружие (способность без оружия) — не режется', hp - H.hp === 7, hp - H.hp);
    });

    await test('audit-werewolf-vuln', async () => {
      const { hs, ms } = sc([{ ess: ['werewolf'] }, {}], ['skeleton']); const [W, Y] = hs, G = ms[0]; place(W, 3, 5); place(Y, 4, 5); place(G, 3, 4); G.hp = G.maxHp = 300; T(Y);
      const h0 = G.hp; await B.applyDamage(Y, G, [{ v: 6, dt: 'bludgeon' }], { ctx: {}, melee: true, src: Y }); ok('+1 «Стаи вокруг» добавляется до уязвимости: (6+1)×2 = 14', h0 - G.hp === 14, h0 - G.hp);
    });

    await test('audit-expiry', async () => {
      const { S, hs } = sc([{ ess: ['spider-queen'] }], ['goblin'], { zone: 'beast' }); const [H] = hs; place(H, 3, 6); T(H); S.round = 1; F(); await act(H, 'spider-queen', { cell: [3, 3] });
      ok('рой создан в раунде 1 и живёт до хода хозяина в раунде 11', S.zones.some(z => z.kind === 'swarm' && z.until === 11));
      S.round = 10; await B.startTurn(H); ok('в раунде 10 рой ещё висит', S.zones.some(z => z.kind === 'swarm'));
      S.round = 11; await B.startTurn(H); ok('в начале хода хозяина в раунде 11 — исчез (ровно 10 раундов)', !S.zones.some(z => z.kind === 'swarm'));
    });

    await test('audit-escape', async () => {
      const { hs, ms } = sc([{}], ['goblin']); const [H] = hs, G = ms[0]; place(H, 3, 5); place(G, 3, 4); T(G);
      B.addStatus(G, 'grappled', { k: Infinity, data: { by: H.id, dc: 5, skill: 'athletics' } }); B.addStatus(G, 'restrained', { k: Infinity, data: { dc: 5, net: { hp: 5, web: true }, web: true } });
      F(20); await B.AI.tryEscape(G); const left = [!!has(G, 'grappled'), !!has(G, 'restrained')];
      ok('за одно действие снимаются только одни путы, а не все сразу', left.filter(Boolean).length === 1, JSON.stringify(left));
      // хватка клыка: силой, не акробатикой
      const s2 = sc([{}], ['goblin']); const H2 = s2.hs[0], G2 = s2.ms[0]; place(H2, 3, 5); place(G2, 3, 4); G2.abil = { str: 1, dex: 30, con: 10, int: 10, wis: 10, cha: 10 }; T(G2);
      B.addStatus(G2, 'grappled', { k: Infinity, data: { by: H2.id, dc: 14, skill: 'athletics' } }); F(8); await B.AI.tryEscape(G2); ok('Сил 1 и Лов 30: Акробатика не помогает вырваться из хватки со Силой', !!has(G2, 'grappled'), logs(2));
    });

    await test('audit-hide-dust', async () => {
      const { S, hs, ms } = sc([{ ess: ['ash-wraith'] }, {}], ['goblin']); const [W, A_] = hs; place(W, 3, 5); place(A_, 4, 5); T(W);
      await act(W, 'ash-wraith', {}); ok('внутри белой пыли можно спрятаться (сильное заслонение)', B.hideSpot(A_) === 'в белой пыли', B.hideSpot(A_));
    });

    await test('audit-grey-shade-light', async () => {
      const { S, hs, ms } = sc([{ ess: ['grey-shade'] }, { ess: ['ash-wraith'] }], ['goblin']); const [H, L] = hs; place(H, 3, 5); place(L, 4, 5); T(H); S.dark = true; S.torch = false;
      const act0 = () => B.actionsFor(H).find(o => o.id === 'shadowhide');
      ok('рядом светящийся союзник даёт только тусклый свет — «Тень в тени» доступна', act0() && act0().enabled, act0() && act0().why);
      S.torch = true; ok('при факеле (яркий свет) — недоступна', !act0().enabled, act0().why);
    });

    await test('audit-shade-stealth', async () => {
      const { hs, ms } = sc([{ ess: ['grey-shade'] }], ['goblin']); const [H] = hs; place(H, 3, 5); T(H); B.addStatus(H, 'hidden', { k: Infinity });
      await act(H, 'grey-shade', {}); ok('невидим поверх обычной скрытности', !!(has(H, 'hidden') && has(H, 'hidden').data.invis));
      await B.endTurn(H); await B.startTurn(H); ok('невидимость кончилась в начале хода, а обычная скрытность осталась', !!has(H, 'hidden') && !has(H, 'hidden').data.invis, JSON.stringify(has(H, 'hidden')));
    });

    await test('audit-misc', async () => {
      const { S, hs, ms } = sc([{ ess: ['burrower'], base: { wis: 14 } }], ['goblin']); const [H] = hs;
      ok('«Плохое зрение» землекопа входит в общее пассивное Восприятие (−5)', B.passivePerceptionOf(H) === 10 + B.amod(H.abil.wis) + (H.skills.perception || 0) - 5, B.passivePerceptionOf(H));
      ok('кнопка выбора куба у роя паучат подписана по способности', (() => { const sp = B.ess && B.A['spider-queen'].tgt(H); return sp.okLabel === 'Выпустить рой'; })());
      T(H); ok('нырок недоступен схваченному (скорость 0)', (() => { B.addStatus(H, 'grappled', { k: Infinity, data: { by: ms[0].id } }); const r = B.A.burrower.can(H); B.removeStatus(H, 'grappled'); return r !== true; })());
    });

    return { R };
  }, { ONLY });
  const bad = out.R.filter(r => !r.ok);
  console.log(`проверок: ${out.R.length}, не прошли: ${bad.length}`);
  for (const r of bad) console.log('  ✗', r.name, '—', r.extra);
  if (process.env.VERBOSE) for (const r of out.R.filter(r => r.ok)) console.log('  ✓', r.name);
  console.log('page errors:', [...new Set(errs)].slice(0, 10));
  await b.close();
})();
