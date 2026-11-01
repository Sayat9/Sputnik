// Погиб весь отряд → «Игра окончена» → «Начать заново»: партия в сохранениях, создание первого героя
const L = require('./bui_lib.js');
(async () => { const { b, p } = await L.launch(400, 860); await L.setup(p, { heroes: ['barb2', 'archer'], tactical: false });
  const R = [], ok = (n, c, x) => { R.push(!!c); console.log(c ? '  ✓' : '  ✗', n, c ? '' : '— ' + JSON.stringify(x)); };
  const o = await p.evaluate(async () => {
    const out = {}; newRun(); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    location.hash = 'labyrinth'; rerender();
    // один погиб — обычное «Погиб, вещи розданы», без конца игры
    const ev = { kind: 'hard', title: 't', raw: 10, n: 10, cause: 'event', list: ['goblin'], zone: 'goblin', border: false, key: tkey(state.run.pos.x, state.run.pos.y), outcome: null, killed: [], turn: 0, round: 1, tactical: true, floor: 1 };
    dgUi.enc = ev; state.party[0].dead = true; state.party[0].hp = 0; battleDone(ev, { outcome: 'win', killed: [0] });
    await new Promise(r => setTimeout(r, 200)); out.oneDead = { go: !document.getElementById('gameov').hidden, party: state.party.length };
    // погибли все
    const ev2 = { ...ev, key: ev.key }; dgUi.enc = ev2; state.party.forEach(c => { c.dead = true; c.hp = 0; }); battleDone(ev2, { outcome: 'flee', killed: [] });
    await new Promise(r => setTimeout(r, 200)); const g = document.getElementById('gameov');
    out.allDead = { go: !g.hidden, title: (g.querySelector('h1') || {}).textContent, heroes: g.querySelectorAll('.go-hero').length, btn: !!g.querySelector('[data-go-restart]') };
    g.querySelector('[data-go-restart]').click(); await new Promise(r => setTimeout(r, 300));
    out.after = { go: !g.hidden, party: state.party.length, run: !!state.run, forge: forge.open && forge.step, mode: forge.mode, save: readSaves().some(s => /Партия до гибели/.test(s.name || s.title || JSON.stringify(s).slice(0, 200))) };
    return out; });
  await p.screenshot({ path: '/tmp/claude-0/go.png' });
  console.log(JSON.stringify(o));
  ok('погиб один — игра продолжается', !o.oneDead.go && o.oneDead.party === 1, o.oneDead);
  ok('погибли все — экран «Игра окончена» с героями', o.allDead.go && /Игра окончена/.test(o.allDead.title) && o.allDead.heroes === 1 && o.allDead.btn, o.allDead);
  ok('«Начать заново» — партия в сохранениях, пусто, создание первого героя', !o.after.go && o.after.party === 0 && !o.after.run && o.after.forge === 'race' && o.after.save, o.after);
  ok('нет ошибок', !p.errs.length, p.errs);
  console.log(`проверок: ${R.length} не прошли: ${R.filter(x => !x).length}`); await b.close(); })();
