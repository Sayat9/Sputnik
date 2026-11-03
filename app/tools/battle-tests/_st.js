const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500); for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const ids = process.argv.slice(2);
  const r = await p.evaluate(ids => { state.party = [Object.assign(clone(state.example), { id: 'p0', example: false })]; state.run = { floor: 3, pos: { x: 1, y: 1 }, status: {}, light: true };
    const S = Battle.newBattle({ list: ids, zone: 'orc', floor: 3 }); const out = Battle.mons().map(u => ({ id: u.ref, hp: u.maxHp, ac: u.ac, prot: u.prot, spd: u.speedC, abil: u.abil, atk: (u.atk || []).map(a => `${a.n} +${a.hit} ${a.dmg ? JSON.stringify(a.dmg) : ''}${a.multi ? ' x' + a.multi : ''}`), pass: u.pass })); Battle.S = null; return out; }, ids);
  for (const u of r) console.log(JSON.stringify(u)); await b.close(); })();
