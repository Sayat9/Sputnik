// Симуляции с любым снаряжением: все оружие, доспехи, пустые руки, лук без стрел, предметы в бою.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle-net','battle'];
const N = +process.argv[2] || 120;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async ({ N }) => {
    const out = { runs: 0, issues: [], err: [], outcomes: {}, weapons: WEAPONS.length };
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const races = ['barbarian', 'human', 'dwarf', 'beastkin', 'fairy', 'dragon'];
    const weaps = WEAPONS.filter(w => w.kind !== 'Боеприпасы' && w.group !== 'shield').map(w => w.id);
    const shields = WEAPONS.filter(w => w.group === 'shield').map(w => w.id);
    const armors = Object.keys(GEAR).filter(k => GEAR[k].kindOf === 'armor' || GEAR[k].slot === 'body');
    const gearIds = Object.keys(GEAR);
    const ess1 = Object.keys(ESSENCES).filter(id => MONSTERS.some(m => m.essence === id && m.floor === 1));
    const mons1 = MONSTERS.filter(m => m.floor === 1 && !m.draft);
    const mk = i => {
      const c = Object.assign(clone(state.example), { id: 'g' + i + Math.random().toString(36).slice(2, 5), example: false, name: 'Г' + i, race: pick(races), level: 1 + Math.floor(Math.random() * 4) });
      c.base = { str: 6 + Math.floor(Math.random() * 14), dex: 6 + Math.floor(Math.random() * 14), con: 8 + Math.floor(Math.random() * 10), int: 10, wis: 6 + Math.floor(Math.random() * 12), cha: 10 };
      c.equip = {};
      if (Math.random() < .9) c.equip.main = { t: 'w', id: pick(weaps) };
      if (Math.random() < .5) c.equip.off = { t: 'w', id: pick([...shields, ...weaps]) };
      if (Math.random() < .5 && armors.length) c.equip.body = { t: 'g', id: pick(armors) };
      c.giantGrip = Math.random() < .3;
      delete c.bag; delete c.kit; delete c.hp; c.essences = []; for (let k = 0; k < Math.min(c.level, Math.floor(Math.random() * 3)); k++) { const e = pick(ess1); if (!c.essences.includes(e)) c.essences.push(e); }
      try { ensureKit(c); } catch (e) {}
      if (Math.random() < .5) addToBag(c, { t: 'g', id: 'arrow', qty: 20 });
      for (let k = 0; k < 3; k++) if (Math.random() < .5) addToBag(c, { t: 'g', id: pick(gearIds), qty: 1 });
      c.mp = maxMp(c); return c;
    };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    for (let i = 0; i < N; i++) {
      const n = 1 + Math.floor(Math.random() * 4);
      state.party = Array.from({ length: n }, (_, k) => mk(k)); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: Math.floor(Math.random() * 3), sat: 3, starve: 0, awake: 0 }; });
      const species = pick(mons1), cnt = species.cls === 8 ? 1 : 1 + Math.floor(Math.random() * 3);
      const ev = { list: Array(cnt).fill(species.id), zone: pick(['goblin', 'beast', 'undead', 'stone']), ambush: Math.random() < .25, kind: 'hard', title: 'тест' };
      try {
        const r = await Battle.sim(ev); out.runs++; out.outcomes[r.outcome] = (out.outcomes[r.outcome] || 0) + 1;
        for (const u of r.S.units) { if (isNaN(u.hp) || u.hp < 0 || u.hp > u.maxHp) out.issues.push(`hp ${u.name} ${u.hp}/${u.maxHp}`); if (u.side === 'hero' && (isNaN(u.mp) || u.mp < 0)) out.issues.push(`мана ${u.name}`); }
        const a = r.log.filter(l => /NaN|undefined|\[object/.test(l.t)); if (a.length) out.issues.push('журнал: ' + a[0].t);
        Battle.S = null;
      } catch (e) { out.err.push(String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); Battle.S = null; }
    }
    out.issues = [...new Set(out.issues)].slice(0, 20); out.err = [...new Set(out.err)].slice(0, 10);
    return out;
  }, { N });
  console.log(JSON.stringify(rep, null, 1)); console.log('page errors:', [...new Set(errs)].slice(0, 6));
  await b.close();
})();
