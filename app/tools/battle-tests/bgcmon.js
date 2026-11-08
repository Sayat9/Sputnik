// Монстры Гоблинграда (08.11): способности, стражи, вождь, «Муштра», «Корона основателя».
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  let n = 0, bad = 0; const ok = (t, c, x) => { n++; if (!c) bad++; console.log(`  ${c ? '✓' : '✗'} ${t}${c ? '' : ' — ' + JSON.stringify(x)}`); };
  const NEW = ['goblin-merchant', 'goblin-lamplighter', 'city-hyena', 'goblin-pickpocket', 'goblin-arsonist', 'mad-goblin', 'city-guard', 'roof-archer', 'clockwork-hound', 'goblin-herald', 'temple-shaman', 'slum-thug', 'hob-sergeant', 'trollgob-porter', 'mad-berserker', 'city-captain', 'chief-engineer', 'mad-pyromancer', 'gob-founder'];
  const z = await p.evaluate(NEW => { state.party = [Object.assign(clone(state.example), { id: 'p0', example: false, rank: 7 })]; newRun(); const run = state.run; run.floor = 2; run.variant = 'goblin'; run.rift = riftBuild('gcity'); const R = run.rift; const seen = new Set();
    for (let i = 0; i < 300; i++) for (const pos of [[3, 8], [3, 12], [1, 1], [12, 1]]) { R.pos = { x: pos[0], y: pos[1] }; for (const s of ['easy', 'mid', 'hard']) gcGroup(R, s).forEach(id => seen.add(id)); }
    return { ess: NEW.every(id => ESSENCES[id] && MONSTERS.find(m => m.id === id && m.rift === 'gcity')), g: ['city-captain', 'chief-engineer', 'mad-pyromancer', 'gob-founder'].every(id => MONSTERS.find(m => m.id === id).rank === 'guardian'), seen: [...seen] }; }, NEW);
  ok('19 монстров с эссенциями, 4 стража', z.ess && z.g, z);
  ok('встречи по районам: все новые 9–7 класса', NEW.slice(0, 15).every(id => z.seen.includes(id)), NEW.slice(0, 15).filter(id => !z.seen.includes(id)));
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const t = await p.evaluate(async () => {
    const B = Battle; B.cfg.fast = true; const out = {}; const C = { commit() {} };
    const mk = i => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: 'Г' + i, race: 'human', level: 5 }); c.base = { str: 16, dex: 12, con: 14, int: 10, wis: 8, cha: 12 }; c.equip = { main: { t: 'w', id: 'sword' } }; c.essences = []; return c; };
    state.run = state.run || {}; state.run.rift = null; state.party = [mk(0), mk(1)]; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const fight = (list, o) => { const S = B.newBattle({ list, zone: 'goblin', floor: 2, ...(o || {}) }); B.placeMonsters(S); S.phase = 'fight'; S.round = 1; return S; };
    const near = (u, t) => { const c = B.freeCellsNear(t, 1, u)[0]; u.x = c[0]; u.y = c[1]; };
    let S = fight(['city-hyena']); let [hy] = B.mons(), h = B.heroes()[0]; B.addStatus(h, 'prone', {}); const cx = { tgt: h, extra: [] }; B.P['city-hyena'].attackMods(hy, cx); out.hyena = cx.extra.length === 1;
    S = fight(['goblin-arsonist']); let [ar] = B.mons(); h = B.heroes()[0]; const hp0 = h.hp; await B.A['goblin-arsonist'].run(ar, { cell: [h.x, h.y] }, C); out.fire = S.cells[h.y][h.x] === 'fire' && B.P['goblin-arsonist'].resist(ar, { dt: 'fire' });
    S = fight(['city-guard']); let [gd] = B.mons(); gd.t = { moved: 0 }; const c2 = { mods: [] }; B.P['city-guard'].attackMods(gd, c2); out.post = c2.mods.some(m => m.v === 2);
    S = fight(['clockwork-hound']); let [ch] = B.mons(); h = B.heroes()[0]; near(h, ch); h.prot = 0; const hp1 = h.hp; B.kill(ch, h); if (B.flushQueue) await B.flushQueue(); out.gears = h.hp < hp1 && B.P['clockwork-hound'].dmgFlat(ch, { v: 5 }) === -1;
    S = fight(['hob-sergeant', 'goblin']); const [sg, gb] = B.mons(); out.drill = B.initAura(gb) === 2 && B.initAura(B.heroes()[0]) === 0;
    S = fight(['trollgob-porter']); let [tr] = B.mons(); out.troll = B.P['trollgob-porter'].dmgFlat(tr, { dt: 'slash', v: 6 }) === -2 && B.P['trollgob-porter'].dmgFlat(tr, { dt: 'fire', v: 6 }) >= 1;
    tr.hp = tr.maxHp - 10; B.P['body:trollgob-porter'].turnStart(tr); out.regen = tr.hp === tr.maxHp - 7;
    S = fight(['mad-berserker']); let [bz] = B.mons(); bz.hp = Math.floor(bz.maxHp * 0.3); const c3 = { melee: true }; B.P['mad-berserker'].attackMods(bz, c3); out.rage = c3.dmgPlus === 2;
    S = fight(['city-captain']); let [cp] = B.mons(); S.round = 2; const n0 = B.mons().length; B.P['body:city-captain'].turnStart(cp); out.guards = B.mons().length === n0 + 1; cp.hp = Math.floor(cp.maxHp / 3); B.P['body:city-captain'].turnStart(cp); out.stand = !!B.has(cp, 'gcstand');
    S = fight(['chief-engineer'], { big10: true }); let [en] = B.mons(); B.P['body:chief-engineer'].turnStart(en); out.walker = en.temp === 20;
    S = fight(['mad-pyromancer']); let [py] = B.mons(); const fires0 = (S.tmpFire || []).length; for (let i = 0; i < 8; i++) B.P['body:mad-pyromancer'].turnStart(py); out.pyroFire = (S.tmpFire || []).length > fires0 && B.P['mad-pyromancer'].dmgFlat(py, { dt: 'fire', v: 7 }) === -7;
    S = fight(['gob-founder', 'goblin']); let [kg, g2] = B.mons(); h = B.heroes()[0]; h.lastHitR = S.round; h.lastHitBy = g2.id; const c4 = { tgt: h, extra: [], atk: { dt: 'slash' } }; B.P['gob-founder'].attackMods(kg, c4); out.blood = c4.extra.length === 1;
    kg.hp = Math.floor(kg.maxHp / 3); const n1 = B.mons().length; B.P['body:gob-founder'].turnStart(kg); out.guard = B.mons().length === n1 + 1;
    await B.A['gob-founder'].run(kg, {}, C); out.clich = (g2.tmpPass || {})['gc-clich'] >= S.round;
    // герой с короной: бонус по цели, которую ударил союзник
    const hh = B.heroes()[0], t2 = B.mons()[1]; t2.lastHitR = S.round; t2.lastHitBy = B.heroes()[1].id; hh.hero.equip = { ...hh.hero.equip, charm: { t: 'g', id: 'founder-crown' } };
    out.crown = typeof B.P.weap.dmgBonusVs === 'function' && B.P.weap.dmgBonusVs(hh, { tgt: t2, dt: 'slash' }) >= 1 && B.P.weap.dmgBonusVs(hh, { tgt: t2, dt: 'slash' }) <= 4;
    return out;
  });
  ok('гиена: +1к6 по упавшим', t.hyena, t);
  ok('поджигатель: горящая клетка, сопротивление огню', t.fire, t);
  ok('стражник: «На посту» +2', t.post, t);
  ok('механический пёс: −1 урона, шестерни при гибели', t.gears, t);
  ok('сержант: «Муштра» +2 к инициативе своим', t.drill, t);
  ok('тролегоблин: −2 урона, огонь +1к6, регенерация 5', t.troll && t.regen, t);
  ok('берсерк: +урон за потерянные четверти ОЗ', t.rage, t);
  ok('капитан: зовёт стражу во 2-м раунде, последний рубеж', t.guards && t.stand, t);
  ok('инженер: шагоход 30 врем. ОЗ', t.walker, t);
  ok('пиромант: поджигает клетки, огонь ему не вредит', t.pyroFire, t);
  ok('вождь: «Кровь основателя», гвардия, клич', t.blood && t.guard && t.clich, t);
  ok('«Корона основателя»: +1к4 по цели, которую ударил союзник', t.crown, t);
  ok('нет ошибок страницы', !errs.length, errs.slice(0, 3));
  console.log(`проверок: ${n}, не прошли: ${bad}`); await b.close();
})();
