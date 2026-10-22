// Симуляция боёв без интерфейса: грузим файлы боя в страницу приложения и гоняем Battle.sim.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-env','battle-ai','battle-end','battle'];
const N = +process.argv[2] || 40;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0,3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async ({ N }) => {
    const out = { runs: 0, outcomes: {}, issues: [], rounds: [], perMon: {}, heroDown: 0, err: [] };
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const races = ["barbarian", "human", "dwarf", "beastkin", "fairy", "dragon"];
    const weaps = ["spear", "mace", "warhammer", "sword", "rapier", "greatsword", "shortbow", "longbow"];
    const ess1 = Object.keys(ESSENCES).filter(id => MONSTERS.find(m => m.essence === id && m.floor === 1));
    const mons1 = MONSTERS.filter(m => m.floor === 1 && !m.draft);
    const zones = ["goblin", "beast", "undead", "stone"];
    const mk = i => {
      const c = Object.assign(clone(state.example), { id: "t" + i + Math.random().toString(36).slice(2, 5), example: false, name: "Герой" + i, race: pick(races), level: 1 + Math.floor(Math.random() * 3) });
      c.base = { str: 8 + Math.floor(Math.random() * 9), dex: 8 + Math.floor(Math.random() * 9), con: 10 + Math.floor(Math.random() * 6), int: 10, wis: 8 + Math.floor(Math.random() * 7), cha: 10 };
      c.equip = { main: { t: "w", id: pick(weaps) } };
      if (!["greatsword", "shortbow", "longbow"].includes(c.equip.main.id) && Math.random() < .5) c.equip.off = { t: "w", id: "shield" };
      delete c.bag; delete c.kit; delete c.hp; c.essences = []; for (let k = 0; k < Math.floor(Math.random() * 3); k++) { const e = pick(ess1); if (!c.essences.includes(e)) c.essences.push(e); }
      ensureKit(c); if (Math.random() < .4) addToBag(c, { t: "g", id: "torch", qty: 2 });
      c.mp = maxMp(c); return c;
    };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    for (let i = 0; i < N; i++) {
      const n = 1 + Math.floor(Math.random() * 4);
      state.party = Array.from({ length: n }, (_, k) => mk(k)); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: Math.floor(Math.random() * 3), sat: 3, starve: 0, awake: 0 }; });
      const species = pick(mons1), cnt = species.cls === 8 ? 1 : 1 + Math.floor(Math.random() * 3);
      const ev = { list: Array(cnt).fill(species.id), zone: pick(zones), ambush: Math.random() < .25, kind: "hard", title: "тест" };
      try {
        const r = await Battle.sim(ev);
        out.runs++; out.outcomes[r.outcome] = (out.outcomes[r.outcome] || 0) + 1; out.rounds.push(r.rounds);
        const pm = out.perMon[species.id] ||= { n: 0, win: 0, down: 0 }; pm.n++; if (r.outcome === "win") pm.win++;
        const S = r.S;
        for (const u of S.units) {
          if (isNaN(u.hp) || u.hp < 0 || u.hp > u.maxHp) out.issues.push(`hp ${u.name} ${u.hp}/${u.maxHp}`);
          if (u.hero && (u.hero.hp !== u.hp)) out.issues.push(`рассинхрон ОЗ ${u.name} ${u.hero.hp} vs ${u.hp}`);
          if (u.side === "hero" && u.mp < 0) out.issues.push(`мана ${u.name} ${u.mp}`);
          if (u.x < 0 || u.y < 0 || u.x >= 7 || u.y >= 7) out.issues.push(`вне поля ${u.name}`);
        }
        const occ = {}; for (const u of S.units.filter(u => u.alive && !u.fled && !u.escaped)) for (const [x, y] of Battle.footprint(u)) { const k = x + "," + y; if (occ[k]) out.issues.push(`две фигуры в ${k}: ${occ[k]} и ${u.name}`); occ[k] = u.name; if (Battle.obstacleAt(x, y)) out.issues.push(`${u.name} в препятствии ${k}`); }
        if (r.rounds >= 60) out.issues.push(`слишком долгий бой: ${r.rounds} раундов (${species.id})`);
        Battle.S = null;
      } catch (e) { out.err.push(String(e && e.stack || e).split("\n").slice(0, 4).join(" | ")); Battle.S = null; }
    }
    out.issues = [...new Set(out.issues)].slice(0, 30); out.err = [...new Set(out.err)].slice(0, 10);
    out.avgRounds = out.rounds.reduce((a, b) => a + b, 0) / (out.rounds.length || 1); delete out.rounds;
    return out;
  }, { N });
  console.log(JSON.stringify(rep, null, 1)); console.log('page errors:', [...new Set(errs)].slice(0, 10));
  await b.close();
})();
