/* Тактический бой: ядро — утилиты, поле 7×7, юниты, статусы, движение, укрытия.
   Атаки, урон, спасброски и ход — в конце файла и в battle-act.js. См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const W = 7, H = 7;
  B.W = W; B.H = H;
  B.cfg = { fast: false };                               // fast — без пауз и анимаций (симуляции)
  B.S = null;                                            // текущий бой

  /* ===== кубики и утилиты ===== */
  const rnd = n => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } };
  const d = s => 1 + rnd(s);
  const roll = (n, s) => { const rolls = []; let total = 0; for (let i = 0; i < n; i++) { const v = d(s); rolls.push(v); total += v; } return { rolls, total }; };
  const parseDice = str => {
    const m = /^(\d+)к(\d+)(?:([+−-])(\d+))?$/.exec(String(str).trim());
    if (!m) return { n: 0, s: 0, b: Number(str) || 0 };
    return { n: +m[1], s: +m[2], b: m[3] ? (m[3] === "+" ? 1 : -1) * +m[4] : 0 };
  };
  const fmtDice = x => `${x.n}к${x.s}${x.b ? (x.b > 0 ? "+" : "−") + Math.abs(x.b) : ""}`;
  const avgDice = x => x.n * (x.s + 1) / 2 + x.b;
  const sleep = ms => (B.cfg.fast || !ms) ? Promise.resolve() : new Promise(r => setTimeout(r, ms));
  const amod = s => Math.floor((s - 10) / 2);
  const sg = n => (n >= 0 ? "+" : "−") + Math.abs(n);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = arr => arr[rnd(arr.length)];
  const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = rnd(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  Object.assign(B, { rnd, d, roll, parseDice, fmtDice, avgDice, sleep, amod, sg, clamp, pick, shuffle });
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  B.ui = ui;
  const ABIL = ["str", "dex", "con", "int", "wis", "cha"];
  const ABIL_RU = { str: "Сила", dex: "Ловкость", con: "Телосложение", int: "Интеллект", wis: "Мудрость", cha: "Харизма" };
  B.ABIL_RU = ABIL_RU;
  const SKILL_ABIL = { athletics: "str", acrobatics: "dex", stealth: "dex", perception: "wis", medicine: "wis", survival: "wis", intimidation: "cha", deception: "cha", sleight: "dex", investigation: "int" };
  const SKILL_RU = { athletics: "Атлетика", acrobatics: "Акробатика", stealth: "Скрытность", perception: "Восприятие", medicine: "Медицина", survival: "Выживание", intimidation: "Запугивание", deception: "Обман", sleight: "Ловкость рук", investigation: "Расследование" };
  B.SKILL_ABIL = SKILL_ABIL; B.SKILL_RU = SKILL_RU;

  /* ===== журнал ===== */
  function log(text, cls) {
    const S = B.S; if (!S) return;
    S.log.push({ r: S.round, t: text, c: cls || "" });
    if (S.log.length > 80) S.log.shift();
    const u = ui(); if (u && u.onLog) u.onLog(text, cls);
  }
  B.log = log;

  /* ===== геометрия ===== */
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const key = (x, y) => x + "," + y;
  const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function footprint(u, x = u.x, y = u.y) { const out = []; for (let dy = 0; dy < u.size; dy++) for (let dx = 0; dx < u.size; dx++) out.push([x + dx, y + dy]); return out; }
  // Расстояние между юнитами (или юнитом в другой клетке) — минимум по клеткам, диагональ = 1.
  function dist(a, b, ax = a.x, ay = a.y) {
    let m = 99;
    for (const [x1, y1] of footprint(a, ax, ay)) for (const [x2, y2] of footprint(b)) m = Math.min(m, cheb(x1, y1, x2, y2));
    return m;
  }
  // Расстояние от юнита a до юнита b, как будто b стоит с якорем в (bx, by).
  function distAt(a, b, bx, by) {
    let m = 99;
    for (const [x1, y1] of footprint(a)) for (const [x2, y2] of footprint(b, bx, by)) m = Math.min(m, cheb(x1, y1, x2, y2));
    return m;
  }
  function distCell(u, x, y, ax = u.x, ay = u.y) { let m = 99; for (const [x1, y1] of footprint(u, ax, ay)) m = Math.min(m, cheb(x1, y1, x, y)); return m; }
  const units = () => (B.S ? B.S.units : []);
  const alive = u => u.alive && !u.fled && !u.escaped;
  const live = () => units().filter(alive);
  const enemiesOf = u => live().filter(o => o.side !== u.side);
  const alliesOf = u => live().filter(o => o.side === u.side && o.id !== u.id);
  function occupant(x, y, except) { return live().find(u => u !== except && footprint(u).some(([a, b]) => a === x && b === y)) || null; }
  const terrain = (x, y) => (inB(x, y) ? B.S.cells[y][x] : null);
  const tinfo = (x, y) => { const t = terrain(x, y); return t ? D.terrain[t] : null; };
  const obstacleAt = (x, y) => { const t = tinfo(x, y); return !!(t && t.obstacle); };
  Object.assign(B, { inB, key, cheb, DIRS, footprint, dist, distAt, distCell, alive, live, enemiesOf, alliesOf, occupant, terrain, tinfo, obstacleAt, units });

  /* ===== создание боя ===== */
  function rr(a, b) { return a + rnd(b - a + 1); }
  function connected(cells) {
    const free = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!(cells[y][x] && D.terrain[cells[y][x]].obstacle)) free.push([x, y]);
    if (!free.length) return false;
    const seen = new Set([key(...free[0])]), q = [free[0]];
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (inB(nx, ny) && !seen.has(key(nx, ny)) && !(cells[ny][nx] && D.terrain[cells[ny][nx]].obstacle)) { seen.add(key(nx, ny)); q.push([nx, ny]); } } }
    return seen.size === free.length;
  }
  function genTerrain(zone) {
    const zc = D.zones[zone] || D.zones.goblin;
    for (let attempt = 0; attempt < 30; attempt++) {
      const cells = Array.from({ length: H }, () => Array(W).fill(null));
      const objs = [];
      // препятствия: не в двух нижних рядах (там герои), в третьем снизу — не больше одного
      const nObst = rr(zc.nObst[0], zc.nObst[1]);
      let low = 0;
      for (let i = 0, tries = 0; i < nObst && tries < 60; tries++) {
        const x = rnd(W), y = rnd(5);
        if (cells[y][x]) continue;
        if (y === 4) { if (low >= 1) continue; low++; }
        cells[y][x] = pick(zc.obst); i++;
      }
      // украшения и опасности
      for (const [k, lo, hi, blob] of zc.feats) {
        const n = rr(lo, hi); if (!n) continue;
        const ymin = k === "fire" ? 2 : 1, ymax = k === "fire" ? 4 : 5;
        let placed = 0, tries = 0, seed = null;
        while (placed < n && tries < 80) {
          tries++;
          let x, y;
          if (blob && seed && rnd(4)) { const [dx, dy] = pick(DIRS); x = seed[0] + dx; y = seed[1] + dy; if (!inB(x, y) || y < ymin || y > ymax) continue; }
          else { x = rnd(W); y = ymin + rnd(ymax - ymin + 1); }
          if (cells[y][x]) continue;
          cells[y][x] = k; placed++; if (!seed || !blob) seed = [x, y]; else if (blob && rnd(3) === 0) seed = [x, y];
        }
      }
      // скрытые ловушки гоблинов в нейтральной зоне
      const nT = rr(zc.traps[0], zc.traps[1]);
      for (let i = 0, tries = 0; i < nT && tries < 40; tries++) {
        const x = rnd(W), y = 2 + rnd(3);
        if (cells[y][x] && cells[y][x] !== "mud" && cells[y][x] !== "stakes") continue;
        if (objs.some(o => o.x === x && o.y === y)) continue;
        objs.push({ id: "trap" + objs.length, kind: "trap", x, y, dc: 12, hidden: true, owner: "mon", dmg: "1к6", dt: "pierce" }); i++;
      }
      if (connected(cells)) return { cells, objs };
    }
    return { cells: Array.from({ length: H }, () => Array(W).fill(null)), objs: [] };
  }

  function parseSpeed(str) {
    const out = { walk: 0, fly: 0, climb: 0, swim: 0 }, re = /(лазание|полёт|плавание)?\s*(\d+(?:,\d+)?)\s*м/g;
    let m; const t = String(str || "");
    while ((m = re.exec(t))) { const v = parseFloat(m[2].replace(",", ".")); const k = m[1] === "полёт" ? "fly" : m[1] === "лазание" ? "climb" : m[1] === "плавание" ? "swim" : "walk"; out[k] = Math.max(out[k], v); }
    return out;
  }
  const cellsOfM = m => Math.floor(m / 1.5 + 1e-6);
  function parseSkills(senses) {
    const out = {}, re = /(Скрытность|Восприятие|Атлетика|Акробатика|Выживание|Медицина|Запугивание) ([+−-]\d+)/g; let m;
    while ((m = re.exec(senses || ""))) { const k = { "Скрытность": "stealth", "Восприятие": "perception", "Атлетика": "athletics", "Акробатика": "acrobatics", "Выживание": "survival", "Медицина": "medicine", "Запугивание": "intimidation" }[m[1]]; out[k] = parseInt(m[2].replace("−", "-"), 10); }
    return out;
  }

  /* ===== юниты ===== */
  let uidSeq = 1;
  function baseUnit(side) {
    return { id: "u" + (uidSeq++), side, x: 0, y: 0, size: 1, hp: 1, maxHp: 1, temp: 0, mp: 0, maxMp: 0, ac: 10, speedC: 6, flyC: 0, abil: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      pb: 2, level: 1, skills: {}, saveB: {}, initB: 0, conds: [], cd: {}, used: {}, turnsTaken: 0, t: { move: 0, action: 0, bonus: 0, react: 1 },
      alive: true, down: false, dead: false, fled: false, escaped: false, pass: [], ess: [], flags: {}, atk: [], seq: null, vuln: [], resist: [], immune: [], ctl: "auto", blind: 0, tremor: 0, dv: false, deathSaves: { ok: 0, fail: 0 } };
  }
  function heroUnit(c) {
    const u = baseUnit("hero"), t = totals(c), dv = derived(t, c), eb = essBonus(c), st = (state.run && state.run.status && state.run.status[c.id]) || { fat: 0 };
    Object.assign(u, { ref: c.id, hero: c, name: c.name, race: c.race, level: c.level, pb: dv.pb, ac: dv.ac, maxHp: maxHp(c), hp: hpOf(c), maxMp: dv.mana, mp: mpOf(c),
      speedC: cellsOfM(dv.speed), initB: eb.init, skills: eb.skills, saveB: eb.saves, ctl: "ui", fat: st.fat || 0, face: ART.race(c.race), dv: D.race[c.race] && D.race[c.race].dv });
    for (const k of ABIL) u.abil[k] = t[k].total;
    u.ess = (c.essences || []).filter(id => ESSENCES[id]);
    u.pass = [...u.ess, "race:" + c.race];
    if (u.ess.some(id => (ESSENCES[id].other || []).some(o => /^Тёмное зрение/.test(o)))) u.dv = true;
    u.insp = c.insp || 0;
    if (u.hp <= 0) { u.hp = 0; u.down = true; u.conds.push(mkStatus("unconscious", { k: Infinity }), mkStatus("prone", { k: Infinity })); }
    if (c.dead) { u.dead = true; u.alive = false; u.down = true; }
    return u;
  }
  function monUnit(id, idx) {
    const m = MONSTERS.find(x => x.id === id), cb = D.mon[id] || { atk: [], ai: { int: 1, role: "melee", focus: ["nearest"] } };
    const u = baseUnit("mon"), sp = parseSpeed(m.speed);
    Object.assign(u, { ref: id, idx, name: m.name, base: m.name, mon: m, cb, ai: cb.ai || {}, size: cb.size || (/^Большой/.test(m.size) ? 2 : 1), hp: parseInt(m.hp, 10), maxHp: parseInt(m.hp, 10), ac: parseInt(m.ac, 10),
      speedC: cellsOfM(sp.walk), flyC: cellsOfM(sp.fly), climbC: cellsOfM(sp.climb), atk: (cb.atk || []).map(a => ({ ...a, dmg: parseDice(a.dmg) })), seq: cb.seq || null, vuln: cb.vuln || [],
      skills: parseSkills(m.senses), initB: 0, face: ART.monsterFace(id), blind: cb.blind || 0, tremor: cb.tremor || 0, dv: /Тёмное зрение/.test(m.senses || ""), shield: !!cb.shield, rare: !!m.rare, cls: m.cls });
    ABIL.forEach((k, i) => { u.abil[k] = m.abil[i]; });
    if (m.essence && ESSENCES[m.essence]) u.ess = [m.essence];
    u.pass = [...u.ess, "body:" + id];
    return u;
  }
  Object.assign(B, { heroUnit, monUnit, parseSpeed, cellsOfM, genTerrain });

  /* ===== статусы ===== */
  // k — сколько границ хода владельца пройдёт до снятия (1 = до конца/начала его следующего хода), when — 'start' | 'end'.
  function mkStatus(id, o = {}) { return { id, k: o.k == null ? 1 : o.k, when: o.when || "end", src: o.src || null, data: o.data || {}, born: o.born || 0 }; }
  function has(u, id) { return u.conds.find(c => c.id === id) || null; }
  function addStatus(u, id, o = {}) {
    if (!D.status[id]) throw new Error("статус " + id);
    const ex = has(u, id);
    const st = mkStatus(id, o);
    if (st.k !== Infinity) st.k = u.turnsTaken + st.k;       // абсолютный номер хода владельца, на котором снимется
    if (ex) { if (o.refresh !== false) { ex.k = Math.max(ex.k, st.k); ex.data = { ...ex.data, ...st.data }; ex.src = st.src; } return ex; }
    u.conds.push(st);
    const g = ui(); if (g) g.refresh();
    return st;
  }
  function removeStatus(u, id) { const i = u.conds.findIndex(c => c.id === id); if (i >= 0) { u.conds.splice(i, 1); const g = ui(); if (g) g.refresh(); return true; } return false; }
  function tickStatuses(u, when) {
    const gone = [];
    u.conds = u.conds.filter(c => { if (c.when === when && c.k !== Infinity && u.turnsTaken >= c.k) { gone.push(c); return false; } return true; });
    return gone;
  }
  Object.assign(B, { mkStatus, has, addStatus, removeStatus, tickStatuses });

  /* ===== пассивки: вызов хуков эссенций, тела монстров и рас ===== */
  // Хук — функция в B.P[id][name](u, ctx). Возвращает значение (для sum-хуков суммируется).
  function hookAll(u, name, ctx) {
    const out = [];
    for (const id of u.pass) { const P = B.P && B.P[id]; if (P && P[name]) { const r = P[name](u, ctx); if (r !== undefined) out.push(r); } }
    return out;
  }
  const hookSum = (u, name, ctx) => hookAll(u, name, ctx).reduce((a, v) => a + (+v || 0), 0);
  const hookAny = (u, name, ctx) => hookAll(u, name, ctx).some(Boolean);
  Object.assign(B, { hookAll, hookSum, hookAny });

  /* ===== скорость и движение ===== */
  function speedOf(u) {
    let sp = Math.max(u.speedC, u.flyC);
    for (const c of u.conds) {
      if (["grappled", "restrained", "pinned", "trapped", "spearstop", "unconscious", "stable"].includes(c.id)) return 0;
    }
    for (const c of u.conds) if (c.id === "slowed") { if (c.data.mult != null) sp = Math.floor(sp * c.data.mult); if (c.data.add) sp += c.data.add; }
    sp += hookSum(u, "speedBonus", {});
    return Math.max(0, sp);
  }
  const isFlying = u => u.flyC > 0 && u.flyC >= u.speedC;
  function stepCost(u, x, y) {
    if (isFlying(u)) return 1;
    let c = 1;
    for (const [fx, fy] of footprint(u, x, y)) { const t = tinfo(fx, fy); if (t && t.cost) c = Math.max(c, t.cost); }
    return c;
  }
  function canPass(u, x, y, o = {}) {
    for (const [fx, fy] of footprint(u, x, y)) {
      if (!inB(fx, fy) || obstacleAt(fx, fy)) return false;
      const oc = occupant(fx, fy, u);
      if (oc && oc.side !== u.side && !o.through) return false;
    }
    return true;
  }
  function canStand(u, x, y) {
    for (const [fx, fy] of footprint(u, x, y)) { if (!inB(fx, fy) || obstacleAt(fx, fy)) return false; if (occupant(fx, fy, u)) return false; }
    return true;
  }
  // Карта достижимых клеток: key -> {x, y, cost, prev}. budget — запас движения в клетках.
  function pathMap(u, budget, o = {}) {
    const best = new Map(), start = { x: u.x, y: u.y, cost: 0, prev: null };
    best.set(key(u.x, u.y), start);
    const open = [start];
    while (open.length) {
      open.sort((a, b) => a.cost - b.cost);
      const cur = open.shift();
      if (cur.cost > best.get(key(cur.x, cur.y)).cost) continue;
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!canPass(u, nx, ny, o)) continue;
        if (o.avoid && o.avoid(nx, ny)) continue;
        const c = cur.cost + stepCost(u, nx, ny);
        if (c > budget) continue;
        const ex = best.get(key(nx, ny));
        if (!ex || c < ex.cost) { const nd = { x: nx, y: ny, cost: c, prev: cur }; best.set(key(nx, ny), nd); open.push(nd); }
      }
    }
    return best;
  }
  function reachable(u, budget, o = {}) {
    const m = pathMap(u, budget, o), out = new Map();
    for (const [k, v] of m) if ((v.x !== u.x || v.y !== u.y) && canStand(u, v.x, v.y)) out.set(k, v);
    return out;
  }
  function pathTo(map, x, y) { const out = []; let n = map.get(key(x, y)); while (n && n.prev) { out.unshift([n.x, n.y]); n = n.prev; } return out; }
  Object.assign(B, { speedOf, isFlying, stepCost, canPass, canStand, pathMap, reachable, pathTo });

  /* ===== досягаемость, дальность, линия, укрытия ===== */
  // Досягаемость ближнего боя юнита в клетках (наибольшая по атакам ближнего боя, не меньше 1).
  function meleeReach(u) {
    let r = 1;
    if (u.side === "mon") { for (const a of u.atk) if (a.kind === "melee") r = Math.max(r, a.reach || 1); }
    else r = Math.max(r, B.heroReach ? B.heroReach(u) : 1);
    return r;
  }
  function center(u) { return [u.x + (u.size - 1) / 2, u.y + (u.size - 1) / 2]; }
  // Клетки, через которые проходит линия между юнитами (без их собственных клеток).
  function lineCells(a, b) {
    const [ax, ay] = center(a), [bx, by] = center(b), n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 4));
    const seen = new Set(), out = [], fa = footprint(a).map(([x, y]) => key(x, y)), fb = footprint(b).map(([x, y]) => key(x, y));
    for (let i = 1; i < n; i++) {
      const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n), k = key(x, y);
      if (seen.has(k) || fa.includes(k) || fb.includes(k)) continue;
      seen.add(k); out.push([x, y]);
    }
    return out;
  }
  // Укрытие цели от атакующего: 0, 2 (половинное) или 5 (три четверти).
  function coverBetween(a, b) {
    let n = 0; for (const [x, y] of lineCells(a, b)) if (obstacleAt(x, y)) n++;
    return n >= 2 ? 5 : n === 1 ? 2 : 0;
  }
  const lineBlocked = (a, b) => lineCells(a, b).filter(([x, y]) => obstacleAt(x, y)).length >= 3;
  Object.assign(B, { meleeReach, center, lineCells, coverBetween, lineBlocked });

  /* ===== свет и тьма ===== */
  function lightAt(x, y) {
    const S = B.S; if (!S.dark) return true;
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) { const t = tinfo(cx, cy); if (t && t.light && cheb(x, y, cx, cy) <= t.light) return true; }
    for (const u of live()) if (has(u, "lit") && distCell(u, x, y) <= 2) return true;
    if (S.torch) return true;
    return false;
  }
  const inDark = u => B.S.dark && !lightAt(u.x, u.y);
  Object.assign(B, { lightAt, inDark });

  /* ===== состояние боя ===== */
  function newBattle(ev) {
    const zone = D.zones[ev.zone] ? ev.zone : "goblin";
    const S = { ev, zone, ambush: !!ev.ambush, dark: false, torch: false, units: [], order: [], turn: 0, round: 1, phase: "init", log: [], killed: [], objs: [], drops: [], opts: Object.assign({ showMonHp: false, autoSaves: false }, (state.settings && state.settings.battleOpts) || {}, { autoHeroes: false }), outcome: null, usedArrows: {}, thrown: [], started: Date.now() };
    try { S.dark = typeof inDarkness === "function" && !!(state.run && isDark(state.run.pos.x, state.run.pos.y)) && !(state.run && state.run.light); S.torch = !!(state.run && state.run.light); } catch (e) { S.dark = false; }
    const g = genTerrain(zone); S.cells = g.cells; S.objs = g.objs;
    uidSeq = 1;
    B.S = S;
    const heroes = (state.party || []).filter(c => !c.dead).map(heroUnit);
    heroes.forEach(h => { S.units.push(h); if (B.initUnit) B.initUnit(h); });
    const names = {};
    ev.list.forEach(id => { names[id] = (names[id] || 0) + 1; });
    const seen = {};
    ev.list.forEach((id, idx) => { const m = monUnit(id, idx); seen[id] = (seen[id] || 0) + 1; if (names[id] > 1) m.name = m.base + " " + seen[id]; S.units.push(m); if (B.initUnit) B.initUnit(m); });
    return S;
  }
  B.newBattle = newBattle;
  B.byId = id => units().find(u => u.id === id) || null;
  B.heroes = () => units().filter(u => u.side === "hero");
  B.mons = () => units().filter(u => u.side === "mon");
  B.cellFree = (u, x, y) => canStand(u, x, y);
})();
