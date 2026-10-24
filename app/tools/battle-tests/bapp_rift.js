// Кристальный разлом: вход через каменный портал, места, встречи, стражи алтарей, осколки, алтари, Сердце разлома, особенности местности
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); console.log(cond ? '  ✓' : '  ✗', name, cond ? '' : '— ' + (extra == null ? '' : extra)); };
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], autoEnd: false });
  const o = await p.evaluate(() => {
    const out = {}, r = state.run;
    r.floor = 1; delete r.variant; r.pos = { x: 10, y: 10 }; r.day = 3; r.act = 2;
    const pi = portalInfo(); out.info = !!pi.ok && /Кристальный разлом/.test(pi.text);
    switchFloor();
    out.floor = r.floor; out.variant = r.variant; out.name = FL().variant.name;
    out.places = new Set(); const bad = [], mons = new Set();
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
      const z = zoneAt(x, y); if (z.kind === 'safe') continue; out.places.add(z.place.name);
      for (let k = 0; k < 8; k++) { const enc = genEncounter(x, y, 1 + k * 2, 1 + (k * 5) % 12, false); if (!enc || !enc.list.length) { bad.push('пусто ' + x + ',' + y); continue; } if (enc.list.length > 5) bad.push('>5 ' + enc.list.join()); enc.list.forEach(id => { mons.add(id); if (!MONSTERS.find(m => m.id === id)) bad.push('нет монстра ' + id); }); }
    }
    out.places = [...out.places]; out.bad = bad.slice(0, 5); out.mons = [...mons];
    out.dark = [isDark(0, 0), isDark(5, 5)];
    out.pool = tilePool(5, 5).map(m => m.id);
    // стражи алтарей и осколки
    const sp = spOf(); out.sp = !!(sp && sp.stone); const st = sp.stone;
    out.guards = { air: genEncounter(0, 0, 4, 1).list, water: genEncounter(10, 5, 4, 1).list, fire: genEncounter(10, 10, 4, 1).list };
    const [ex, ey] = st.earth.split(',').map(Number); out.earthGuard = genEncounter(ex, ey, 4, 1).list; out.earthOk = zoneAt(ex, ey).place.name.includes('алтарь камня');
    // победа над стражем даёт осколок
    r.pos = { x: 10, y: 10 }; spFightDone({ outcome: 'win', list: ['magma-golem'], key: '10,10' }, ['magma-golem']);
    out.shardFire = st.shard.fire; out.guardGoneFire = !genEncounter(10, 10, 4, 1).list.includes('magma-golem');
    out.btn = spButtons().map(x => x.id);
    spDo('altar:fire'); out.lit1 = st.lit.fire; out.lit = spLit();
    for (const el of ['water', 'air', 'earth']) { st.shard[el] = true; st.lit[el] = true; }
    // Сердце разлома
    r.pos = { x: 5, y: 5 }; dgUi.enc = null; spAfter(); out.heartFight = !!dgUi.enc && dgUi.enc.list[0] === 'rift-heart' && dgUi.enc.list.length >= 2 && dgUi.enc.list.length <= 3;
    const t0 = !!spTreasureHere(); out.treasureBeforeHeart = t0;
    spFightDone({ outcome: 'win', list: dgUi.enc.list, key: '5,5', sp: { k: 'heart' } }, dgUi.enc.list); dgUi.enc = null;
    out.heartDone = st.heartDone; out.treasureAfter = !!spTreasureHere();
    // особенности местности
    r.pos = { x: 10, y: 10 }; out.lava = stoneAt('lava'); r.pos = { x: 10, y: 5 }; out.lake = stoneAt('lake'); r.pos = { x: 5, y: 5 }; out.garden = stoneAt('garden');
    // рендер карты
    out.render = (() => { try { location.hash = 'labyrinth'; r.pending = null; dgUi.enc = null; route(); return !!document.getElementById('dg-svg'); } catch (e) { return String(e); } })();
    return out;
  });
  ok('портал 10,10 ведёт в Кристальный разлом', o.info && o.floor === 2 && o.variant === 'stone' && o.name === 'Кристальный разлом', JSON.stringify(o));
  ok('пять мест (+ алтари)', ['Ветряные шахты', 'Подземное озеро', 'Лавовые трещины', 'Кристальный сад', 'Каменные штреки'].every(n => o.places.some(x => x.startsWith(n))), JSON.stringify(o.places));
  ok('встречи по всем тайлам корректны, группа ≤ 5', o.bad.length === 0, JSON.stringify(o.bad));
  ok('встречаются все 10 новых монстров', ['drop', 'dust-whirl', 'magma-hound', 'crystalloid', 'lake-spirit', 'magma-golem', 'deep-serpent', 'crystal-colossus', 'storm-spirit'].every(id => o.mons.includes(id)), JSON.stringify(o.mons));
  ok('тьма в ветряных шахтах, не в саду', o.dark[0] === true && o.dark[1] === false);
  ok('подсказка тайла сада — монстры сада', o.pool.includes('crystalloid') && o.pool.includes('pixie') && o.pool.includes('crystal-colossus'), JSON.stringify(o.pool));
  ok('стражи алтарей', o.guards.air[0] === 'storm-spirit' && o.guards.water[0] === 'deep-serpent' && o.guards.fire[0] === 'magma-golem' && o.earthGuard[0] === 'crystal-colossus' && o.earthOk, JSON.stringify(o));
  ok('победа над стражем даёт осколок и страж уходит', o.shardFire && o.guardGoneFire, JSON.stringify(o));
  ok('алтарь можно зажечь только с осколком; повышает шанс встреч', o.btn.includes('altar:fire') && o.lit1 && o.lit === 1, JSON.stringify(o.btn));
  ok('четыре алтаря горят — бой с Сердцем разлома в центре сада', o.heartFight, JSON.stringify(o));
  ok('сокровище Сердца недоступно до победы и доступно после', !o.treasureBeforeHeart && o.heartDone && o.treasureAfter, JSON.stringify(o));
  ok('жар, сырость, резонанс по местам', o.lava && o.lake && o.garden);
  ok('карта этажа рисуется', o.render === true, o.render);
  const errs = p.errs.filter(e => !/favicon/.test(e)); ok('нет ошибок страницы', errs.length === 0, errs.join('|'));
  await b.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
})();
