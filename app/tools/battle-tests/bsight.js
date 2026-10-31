// Обзор в бою: радиус 4, препятствие −1, высота и полёт +2, Ведьмин лес −2 без бонуса высоты, стена, монстры не атакуют невидимых.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, {});
  const R = [], ok = (n, c, x) => { R.push(!!c); if (!c) console.log('  ✗', n, '—', x == null ? '' : JSON.stringify(x)); };
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const A = await p.evaluate(() => {
    const B = Battle, o = {}; B.cfg.fast = true;
    B.newBattle({ list: ['goblin'], zone: 'goblin', floor: 1 }); const S = B.S, h = B.heroes()[0];
    S.cells = S.cells.map(r => r.map(() => null)); S.objs = []; S.dark = false;
    h.x = 3; h.y = 5; S.phase = 'fight';
    const seen = (x, y) => B.canSightCell(h, x, y);
    o.base = [seen(3, 1), seen(3, 0), seen(8, 5)];
    o.range = B.sightRange(h);
    // препятствие на линии: −1
    const t = Object.keys(B.D.terrain).find(k => B.D.terrain[k].obstacle);
    S.cells[3][3] = t; o.obst = [seen(3, 2), seen(3, 1)];
    S.cells[3][3] = null;
    // высота
    const hill = Object.keys(B.D.terrain).find(k => B.D.terrain[k].elevated); S.cells[5][3] = hill;
    o.hill = [B.sightRange(h), seen(3, 0)];
    // зона: Ведьмин лес −2, высоты нет
    S.sight = -2; S.noElev = true; o.void = [B.sightRange(h), seen(3, 3), seen(3, 2)];
    S.sight = 0; S.noElev = false; S.cells[5][3] = null;
    // полный блок
    const wall = Object.keys(B.D.terrain).find(k => B.D.terrain[k].block); S.cells[3][3] = wall; o.wall = seen(3, 2);
    S.cells[3][3] = null;
    // полёт
    h.flyC = 8; h.speedC = 6; o.fly = B.sightRange(h); h.flyC = 0;
    // монстр вне обзора не цель героя, герой вне обзора монстров не цель монстра
    const m = S.units.find(u => u.side === 'mon'); m.x = 3; m.y = 0; S.units.filter(u => u.side === 'hero').forEach(u => { u.x = 3; u.y = 6; });
    o.heroSeesMon = B.seenByParty(m); o.monSeesHero = B.visibleTo(m, h);
    m.x = 3; m.y = 4; o.near = [B.seenByParty(m), B.visibleTo(m, h)];
    return o;
  });
  ok('база: 4 клетки (3 в линии), 5 клеток дальше нельзя', A.range === 4 && A.base[0] && !A.base[1] && !A.base[2], A);
  ok('препятствие −1 к дальности', A.obst[0] && !A.obst[1], A.obst);
  ok('возвышенность +2', A.hill[0] === 6 && A.hill[1], A.hill);
  ok('Ведьмин лес: обзор 2 и без бонуса высоты', A.void[0] === 2 && A.void[1] === false || (A.void[0] === 2 && !A.void[2]), A.void);
  ok('стена закрывает обзор', A.wall === false, A.wall);
  ok('полёт +2', A.fly === 6, A.fly);
  ok('далёкий монстр не виден ни героям, ни он им', A.heroSeesMon === false && A.monSeesHero === false, A);
  ok('близкий виден обоим', A.near[0] && A.near[1], A.near);
  ok('ошибок нет', errs.length === 0, errs);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
