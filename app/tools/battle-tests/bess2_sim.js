// Автобои с эссенциями 2 этажа: каждая из 35 эссенций у героя, по несколько боёв; ищем исключения, нарушения инвариантов и проверяем, что ИИ применяет способность.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice','battle-ext','battle-act','battle-ess','battle-ess2','battle-weap','battle-env','battle-ai','battle-end','battle'];
const N = +process.argv[2] || 6;
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const rep = await p.evaluate(async ({ N, ONLY }) => {
    const out = { runs: 0, outcomes: {}, issues: [], err: [], used: {}, nouse: [] };
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const floor2 = [...new Set(MONSTERS.filter(m => m.floor === 2 && m.essence && ESSENCES[m.essence]).map(m => m.essence))];
    const list = (ONLY.length ? ONLY : floor2);
    const mons1 = MONSTERS.filter(m => m.floor === 1 && !m.draft);
    const zones = ["goblin", "beast", "undead", "stone"];
    const gearFor = id => {
      const g = { main: pick(["sword", "mace", "spear", "rapier", "warhammer"]), off: Math.random() < .4 ? "shield" : null, bag: [] };
      if (id === "bone-knight" || id === "goblin-assassin") g.main = id === "bone-knight" ? "sword" : "rapier";
      if (id === "hobgoblin-brute") g.main = "mace";
      if (id === "horned-hare" || id === "blackwing") g.main = "spear";
      if (id === "hobgoblin-thrower") { g.main = "sword"; g.bag = ["spear", "spear", "spear"]; }
      if (g.main === "greatsword") g.off = null;
      return g;
    };
    const mk = (i, ess) => {
      const c = Object.assign(clone(state.example), { id: "t" + i + Math.random().toString(36).slice(2, 5), example: false, name: "Герой" + i, race: pick(["barbarian", "human", "dwarf", "beastkin", "fairy", "dragon"]), level: 2 + Math.floor(Math.random() * 2) });
      c.base = { str: 10 + Math.floor(Math.random() * 6), dex: 10 + Math.floor(Math.random() * 6), con: 11 + Math.floor(Math.random() * 4), int: 10, wis: 9 + Math.floor(Math.random() * 6), cha: 10 + Math.floor(Math.random() * 4) };
      const g = gearFor(ess[0]);
      c.equip = { main: { t: "w", id: g.main } }; if (g.off) c.equip.off = { t: "w", id: g.off };
      delete c.bag; delete c.kit; delete c.hp; c.essences = ess.slice();
      ensureKit(c); for (const w of g.bag) addToBag(c, { t: "w", id: w });
      c.mp = maxMp(c); return c;
    };
    state.run = state.run || { floor: 1, pos: { x: 5, y: 5 }, status: {}, light: false };
    for (const id of list) {
      let used = 0, battles = 0;
      for (let i = 0; i < N; i++) {
        const heroes = [mk(0, [id]), mk(1, [pick(floor2)]), mk(2, [])];
        state.party = heroes; state.run.status = {}; heroes.forEach(c => { state.run.status[c.id] = { fat: Math.floor(Math.random() * 2), sat: 3, starve: 0, awake: 0 }; });
        const species = pick(mons1), cnt = species.cls === 8 ? 1 : 2 + Math.floor(Math.random() * 3);
        const ev = { list: Array(cnt).fill(species.id), zone: pick(zones), ambush: Math.random() < .2, kind: "hard", title: "тест" };
        try {
          const r = await Battle.sim(ev);
          out.runs++; battles++; out.outcomes[r.outcome] = (out.outcomes[r.outcome] || 0) + 1;
          const S = r.S, eb = ESSENCES[id].active;
          used += S.log.filter(l => l.c === "skill" && l.t.includes(`: ${eb.name}.`) ).length;
          for (const u of S.units) {
            if (isNaN(u.hp) || u.hp < 0 || u.hp > u.maxHp) out.issues.push(`${id}: hp ${u.name} ${u.hp}/${u.maxHp}`);
            if (u.hero && !u.summon && (u.hero.hp !== u.hp)) out.issues.push(`${id}: рассинхрон ОЗ ${u.name} ${u.hero.hp} vs ${u.hp}`);
            if (u.side === "hero" && !u.summon && u.mp < 0) out.issues.push(`${id}: мана ${u.name} ${u.mp}`);
            if (u.x < 0 || u.y < 0 || u.x >= 7 || u.y >= 7) out.issues.push(`${id}: вне поля ${u.name}`);
          }
          const occ = {}; for (const u of S.units.filter(u => u.alive && !u.fled && !u.escaped)) for (const [x, y] of Battle.footprint(u)) { const k = x + "," + y; if (occ[k]) out.issues.push(`${id}: две фигуры в ${k}: ${occ[k]} и ${u.name}`); occ[k] = u.name; if (Battle.obstacleAt(x, y)) out.issues.push(`${id}: ${u.name} в препятствии ${k}`); }
          if (r.rounds >= 60) out.issues.push(`${id}: слишком долгий бой: ${r.rounds} раундов (${species.id})`);
          if (S.log.some(l => /undefined|NaN/.test(l.t))) out.issues.push(`${id}: мусор в журнале: ${S.log.find(l => /undefined|NaN/.test(l.t)).t}`);
          Battle.S = null;
        } catch (e) { out.err.push(`${id}: ` + String(e && e.stack || e).split("\n").slice(0, 4).join(" | ")); Battle.S = null; }
      }
      out.used[id] = used;
      if (!used) out.nouse.push(id);
    }
    out.issues = [...new Set(out.issues)].slice(0, 40); out.err = [...new Set(out.err)].slice(0, 20);
    return out;
  }, { N, ONLY });
  console.log(JSON.stringify(rep, null, 1)); console.log('page errors:', [...new Set(errs)].slice(0, 10));
  await b.close();
})();
