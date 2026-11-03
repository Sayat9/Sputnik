// Лагерь орков (3 этаж): данные, встречи, шатёр вождя, патрули, сокол-одиночка, способности в бою
const L = require('./bui_lib.js');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => { const { b, p } = await L.launch(400, 860); await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], tactical: false });
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const R = [], ok = (n, c, x) => { R.push(!!c); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + JSON.stringify(x)); };
  const o = await p.evaluate(async () => {
    const out = {}, ids = ["orc-wolf","orc-falcon","orc-scout","orc-spear","orc-thrower","orc-guard","orc-shaman","orc-executioner","orc-chief"];
    out.data = ids.every(id => { const m = MONSTERS.find(x => x.id === id); return m && m.floor === 3 && ESSENCES[id] && Battle.A[id] && Battle.P[id]; });
    newRun(); const r = state.run; r.floor = 3; delete r.variant; r.day = 9; r.pos = { x: 12, y: 3 }; state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    // встречи в лагере
    const seen = new Set(); let falcon = 0, n = 0; for (let i = 0; i < 300; i++) { const e = genEncounterRaw(12, 3, 9, 1 + (i % 12)); if (!e) continue; n++; e.list.forEach(id => seen.add(id)); if (e.falconAlone) falcon++;
      if (!e.falconAlone && (e.list.includes('orc-wolf') || e.list.includes('orc-falcon')) && !e.list.some(id => /orc-(scout|spear|thrower|guard|shaman|executioner)/.test(id))) out.beastAlone = e.list; }
    out.enc = { n, kinds: [...seen].sort(), falcon, zone: (genEncounterRaw(12, 3, 9, 5) || {}).zone };
    out.outside = genEncounterRaw(24, 6, 9, 5);          // Зона ловушек: монстров пока нет
    const ch = genEncounterRaw(15, 4, 9, 5); out.chief = ch && ch.list;
    // патрули
    const O = orcState(); out.patrols = O.patrols.length; const pt = O.patrols[0];
    r.pos = { x: pt.x, y: pt.y }; dgUi.enc = null; orcStep(pt.x, pt.y); out.caught = !!dgUi.enc && dgUi.enc.patrolId === pt.id && !!dgUi.enc.ambush;
    // засада: следующий патруль рядом → «Засада»
    dgUi.enc = null; const p2 = O.patrols[1]; r.pos = { x: p2.x + (p2.x < 19 ? 1 : -1), y: p2.y }; p2.met = null;
    window.askYesNo = async () => true; await orcPatrolNear(p2); out.ambush = !!dgUi.enc && !!dgUi.enc.heroAmbush && dgUi.enc.patrolId === p2.id;
    out.alarm = !!O.alarm;
    // итог боя с патрулём и вождём
    const e = dgUi.enc; e.outcome = 'win'; orcFightDone(e, ['orc-spear']); out.removed = !O.patrols.some(x => x.id === p2.id);
    orcFightDone({ outcome: 'win' }, ['orc-chief']); out.chiefDead = O.chiefDead && !(genEncounterRaw(15, 4, 9, 5) || { list: [] }).list.includes('orc-chief');
    dgUi.enc = null;
    // сокол-одиночка зовёт орков
    const B = Battle; B.cfg.fast = true;
    const S = B.newBattle({ list: ['orc-falcon'], zone: 'goblin', floor: 3, falconAlone: true }); B.placeMonsters(S); S.phase = 'fight';
    const f = B.mons()[0]; f.t = { move: 4, action: 1, bonus: 1, react: 1, moved: 0 };
    await B.hookAllAsync(f, 'turnStartAsync', {}); out.called = B.mons().length - 1; out.list = S.ev.list.slice(); B.S = null;
    return out; });
  console.log(JSON.stringify(o));
  ok('9 орков: монстр, эссенция, способности', o.data, o);
  ok('встречи в лагере: орки, сокол-одиночка иногда, зона боя — лагерь', o.enc.n > 200 && o.enc.kinds.length >= 7 && o.enc.falcon > 10 && o.enc.zone === 'goblin', o.enc);
  ok('волки и соколы без орков не встречаются (кроме сокола-разведчика)', !o.beastAlone, o.beastAlone);
  ok('в Пылающих землях встреч пока нет', !o.outside, o.outside);
  ok('шатёр вождя: вождь с охраной', o.chief && o.chief.includes('orc-chief'), o.chief);
  ok('3 патруля; наткнулся — бой (патруль первым)', o.patrols === 3 && o.caught, o);
  ok('патруль рядом → «Засада»: отряд первым, тревога для остальных', o.ambush && o.alarm, o);
  ok('разбитый патруль исчезает, убитый вождь больше не появляется', o.removed && o.chiefDead, o);
  ok('сокол-одиночка зовёт 2–3 орков', o.called >= 2 && o.called <= 3 && o.list.length === 1 + o.called, o);
  ok('нет ошибок', !p.errs.length, p.errs);
  console.log(`проверок: ${R.length} не прошли: ${R.filter(x => !x).length}`); await b.close(); })();
