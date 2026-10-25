const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle'];
const scen = process.argv[2] || 'goblin,goblin,goblin';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const out = await p.evaluate(async scen => {
    const presets = [
      { race: 'barbarian', main: 'sword', off: 'shield', base: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 } },
      { race: 'human', main: 'shortbow', base: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 10 } },
      { race: 'dwarf', main: 'warhammer', off: 'shield', base: { str: 15, dex: 10, con: 16, int: 10, wis: 12, cha: 8 } },
    ];
    const mk = (h, i) => { const c = Object.assign(clone(state.example), { id: 'p' + i, example: false, name: ['Грок', 'Лея', 'Торин'][i], race: h.race, level: 1 }); c.base = { ...h.base }; c.equip = { main: { t: 'w', id: h.main } }; if (h.off) c.equip.off = { t: 'w', id: h.off }; delete c.bag; delete c.kit; delete c.hp; c.essences = []; ensureKit(c); if (/bow/.test(h.main)) addToBag(c, { t: 'g', id: 'arrow', qty: 20 }); c.mp = maxMp(c); return c; };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    state.party = presets.map(mk); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; });
    const list = scen.split(','); const m = MONSTERS.find(x => x.id === list[0]);
    const r = await Battle.sim({ list, zone: m.zone, ambush: false, kind: 'hard', title: 't' });
    return { outcome: r.outcome, rounds: r.rounds, log: r.log.map(l => l.t) };
  }, scen);
  console.log(out.outcome, out.rounds); console.log(out.log.slice(0, 70).join('\n'));
  await b.close();
})();
