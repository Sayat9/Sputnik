// Сапоги скороходы (8), Экстракт попутного ветра (9), 3 уровень за 40 опыта, достижения за порталы.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860);
  const R = [], ok = (name, cond, extra) => { R.push({ name, ok: !!cond }); if (!cond) console.log('  ✗', name, '—', extra == null ? '' : JSON.stringify(extra)); };
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const res = await p.evaluate(() => {
    const out = {}, r = state.run;
    // ---- данные
    out.data = TREASURES.boots.cls === 8 && TREASURES.wind.cls === 9 && TREASURE_POOL[8].includes('boots') && TREASURE_POOL[9].includes('wind') && ARTIFACTS.boots.cls === 8 && ARTIFACTS.wind.cls === 9 && !!ARTIFACTS.boots.ico() && !!ARTIFACTS.wind.ico();
    giveTreasure('boots'); giveTreasure('wind');
    out.charges = treasure('wind').charges; out.owned = treasure('boots').owned && treasure('wind').owned;
    // ---- сапоги: Движение на 2 клетки
    const reset = (x, y) => { r.floor = 1; delete r.variant; r.pos = { x, y }; r.day = 3; r.act = 1; r.pending = null; r.queue = []; dgUi.res = null; dgUi.enc = null; dgUi.path = []; };
    reset(3, 3); r.boots = true; out.needs = [pathNeed('move'), pathNeed('run')];
    r.boots = false; out.needsOff = [pathNeed('move'), pathNeed('run')];
    r.boots = true; dgUi.phase = 'move'; dgUi.path = [{ x: 3, y: 4 }, { x: 3, y: 5 }]; dgUi.target = { x: 3, y: 5 }; act('move');
    out.move2 = r.pos.x === 3 && r.pos.y === 5 && r.bootsDay === 3 && !r.boots && r.act === 2;
    out.viaVisited = r.visited.includes('3,4') && r.visited.includes('3,5');
    out.onceDay = !bootsReady();
    r.boots = true; out.blocked = pathNeed('move') === 1 && !bootsOn();          // в тот же день второй раз нельзя
    // следующий день — снова доступны
    r.act = 3; advanceTime(); out.nextDay = bootsReady() && r.day === 4;
    // ---- сапоги: Бег на 3 клетки, одна пробегаемая клетка без проверки
    reset(3, 3); r.boots = true; const fat0 = state.party.map(c => r.status[c.id].fat);
    dgUi.phase = 'run'; dgUi.path = [{ x: 3, y: 4 }, { x: 3, y: 5 }, { x: 3, y: 6 }]; act('run');
    out.run3 = r.pos.y === 6 && r.bootsDay === 4 + 0 || r.bootsDay === 4;
    out.run3pos = [r.pos.x, r.pos.y];
    out.run3fat = state.party.every((c, i) => r.status[c.id].fat === Math.min(4, fat0[i] + 1));
    const q = [r.pending, ...(r.queue || [])].filter(Boolean); out.run3passes = q.filter(x => x.cause === 'pass').map(x => x.y);
    // обычный Бег 2 клетки: проверка пробежки на первой клетке
    reset(3, 3); r.bootsDay = r.day; dgUi.phase = 'run'; dgUi.path = [{ x: 3, y: 4 }, { x: 3, y: 5 }]; act('run');
    const q2 = [r.pending, ...(r.queue || [])].filter(Boolean); out.run2passes = q2.filter(x => x.cause === 'pass').map(x => x.y);
    // ---- экстракт ветра: Бег без Усталости и без проверок, тратит заряд
    reset(3, 3); r.bootsDay = r.day; r.wind = true; const f1 = state.party.map(c => r.status[c.id].fat), w0 = treasure('wind').charges;
    dgUi.phase = 'run'; dgUi.path = [{ x: 3, y: 4 }, { x: 3, y: 5 }]; act('run');
    const q3 = [r.pending, ...(r.queue || [])].filter(Boolean);
    out.windNoFat = state.party.every((c, i) => r.status[c.id].fat === f1[i]); out.windNoPass = !q3.some(x => x.cause === 'pass'); out.windCharge = treasure('wind').charges === w0 - 1 && !r.wind;
    // следующий Бег — уже обычный
    reset(3, 3); r.bootsDay = r.day; const f2 = state.party.map(c => r.status[c.id].fat); dgUi.phase = 'run'; dgUi.path = [{ x: 3, y: 4 }, { x: 3, y: 5 }]; act('run');
    out.windOnce = state.party.every((c, i) => r.status[c.id].fat === Math.min(4, f2[i] + 1));
    // заряды заканчиваются: артефакт расходуется
    treasure('wind').charges = 1; r.wind = true; reset(3, 3); r.bootsDay = r.day; dgUi.phase = 'run'; dgUi.path = [{ x: 3, y: 4 }, { x: 3, y: 5 }]; act('run');
    out.windGone = !treasure('wind').owned && treasure('wind').charges === 0;
    // ---- уровни
    const c0 = state.party[0]; c0.level = 1; c0.xp = 0; out.need = [xpNeed(c0)]; c0.level = 2; out.need.push(xpNeed(c0)); c0.level = 3; out.need.push(xpNeed(c0)); c0.level = 4; out.need.push(xpNeed(c0)); out.monXp = [9, 8, 7, 6, 5].map(c => monXp({ cls: c }));
    c0.level = 2; c0.xp = 38; addXpAll(1); out.lvl2 = [c0.level, c0.xp]; addXpAll(1); out.lvl3 = [c0.level, c0.xp];
    c0.level = 1; c0.xp = 19; addXpAll(1); out.lvl1to2 = [c0.level, c0.xp];
    state.party.forEach(c => { c.level = 1; c.xp = 0; });
    // ---- достижения
    r.ach = {}; reset(0, 0); r.day = 2; achCheck();
    out.ach1 = { xp: state.party.map(c => c.xp), done: !!r.ach.portal2, res: dgUi.res && dgUi.res.title };
    dgUi.res = null; achCheck(); out.ach1again = state.party.map(c => c.xp);
    reset(0, 0); r.ach = {}; r.day = 3; achCheck(); out.ach1late = !r.ach.portal2;
    reset(5, 5); r.ach = {}; r.day = 1; achCheck(); out.ach1notPortal = !r.ach.portal2;
    state.party.forEach(c => { c.level = 1; c.xp = 0; }); r.ach = {};
    r.floor = 2; r.variant = 'goblin'; r.pos = { x: 10, y: 0 }; r.day = 5; dgUi.res = null; achCheck();
    out.ach2 = { xp: state.party.map(c => c.xp), done: !!r.ach.portal3 };
    state.party.forEach(c => { c.level = 1; c.xp = 0; }); r.ach = {}; r.day = 6; achCheck(); out.ach2late = !r.ach.portal3 && state.party.every(c => c.xp === 0);
    r.pos = { x: 0, y: 10 }; r.day = 1; achCheck(); out.ach2entry = !r.ach.portal3 && !r.ach.portal2;          // портал вниз-назад не считается
    state.party.forEach(c => { c.level = 1; c.xp = 19; }); r.ach = {}; r.pos = { x: 10, y: 0 }; r.day = 4; achCheck();
    out.achLevelUp = state.party.every(c => c.level === 2 && c.xp === 1);
    return out;
  });
  ok('данные: оба артефакта в пулах, с иконкой и классом', res.data, res);
  ok('экстракт: 10 зарядов, оба получены', res.charges === 10 && res.owned, [res.charges, res.owned]);
  ok('сапоги: Движение 2 клетки, Бег 3 клетки; без сапог 1 и 2', JSON.stringify(res.needs) === '[2,3]' && JSON.stringify(res.needsOff) === '[1,2]', [res.needs, res.needsOff]);
  ok('Движение в сапогах: прошли 2 клетки, одно действие, раз в день', res.move2 && res.viaVisited && res.onceDay && res.blocked, res);
  ok('на следующий день сапоги снова готовы', res.nextDay);
  ok('Бег в сапогах: 3 клетки, +1 Усталость, проверка пробежки только на второй клетке', res.run3pos[1] === 6 && res.run3fat && JSON.stringify(res.run3passes) === '[5]', [res.run3pos, res.run3fat, res.run3passes]);
  ok('обычный Бег: проверка пробежки на первой клетке', JSON.stringify(res.run2passes) === '[4]', res.run2passes);
  ok('экстракт: Бег без Усталости и без проверок, один заряд', res.windNoFat && res.windNoPass && res.windCharge, res);
  ok('экстракт действует на один Бег', res.windOnce);
  ok('экстракт расходуется после 10 зарядов', res.windGone);
  ok('уровни: на 2-й 20 опыта, на 3-й 40, на 4-й 80', JSON.stringify(res.need) === '[20,40,80,80]', res.need);
  ok('опыт за первого убитого вида: 9→1, 8→2, 7→3, 6→4, 5→5', JSON.stringify(res.monXp) === '[1,2,3,4,5]', res.monXp);
  ok('3 уровень: 39 опыта — ещё 2, 40 — 3-й, остаток 0', JSON.stringify(res.lvl2) === '[2,39]' && JSON.stringify(res.lvl3) === '[3,0]' && JSON.stringify(res.lvl1to2) === '[2,0]', [res.lvl2, res.lvl3, res.lvl1to2]);
  ok('достижение «портал на 2 этаж до конца 2-го дня»: +2 опыта каждому, один раз', res.ach1.xp.every(x => x === 2) && res.ach1.done && /Достижение/.test(res.ach1.res || '') && res.ach1again.every(x => x === 2), res.ach1);
  ok('на 3-й день и не на портале — достижения нет', res.ach1late && res.ach1notPortal);
  ok('достижение «портал на 3 этаж до конца 5-го дня»: +2 опыта каждому', res.ach2.xp.every(x => x === 2) && res.ach2.done && res.ach2late && res.ach2entry, res.ach2);
  ok('достижение повышает уровень, если хватило опыта', res.achLevelUp);
  await L.shot(p, 'artboots');
  ok('нет ошибок страницы', p.errs.length === 0, p.errs.slice(0, 3));
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x.ok).length);
  await b.close();
})();
