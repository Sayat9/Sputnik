/* Тактический бой: расширения движка для эссенций 2 этажа — призванные существа (волки, двойники), зоны (рой, белая пыль),
   концентрация, тела павших, перенаправление атак, повторные спасброски, помощники перемещения. См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const { rnd, roll, amod, log, dist, distCell, footprint, alive, live, enemiesOf, alliesOf, has, addStatus, removeStatus } = B;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const sleep = ms => (B.cfg.fast ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));

  /* ===== общие помощники ===== */
  // Асинхронный вариант hookAll: хуки пассивок, которым нужны броски и окна.
  B.hookAllAsync = async function (u, name, ctx) {
    const out = [];
    for (const id of u.pass) { const P = B.P && B.P[id]; if (P && P[name]) { const r = await P[name](u, ctx); if (r !== undefined) out.push(r); } }
    return out;
  };
  // Сбить с ног: запоминаем, кто сбил («Глубокая яма» могильщика).
  B.knock = (t, src) => addStatus(t, "prone", { k: Infinity, data: { by: src ? src.id : null } });
  // Иммунитет к состоянию: свои пассивки (immune) и ауры союзников (immuneAura).
  B.immuneTo = function (u, id, o = {}) {
    if ((id === "bleeding" || id === "poisoned") && B.noBlood && u.side === "mon" && B.noBlood(u)) return true;          // нежить, элементали, конструкты, механизмы: нет кровотечения и отравления
    if (!B.P) return false;
    for (const pid of u.pass) { const P = B.P[pid]; if (P && P.immune && P.immune(u, { id, data: o.data || {} })) return true; }
    for (const a of alliesOf(u)) for (const pid of a.pass) { const P = B.P[pid]; if (P && P.immuneAura && P.immuneAura(a, { u, id, data: o.data || {} })) return true; }
    return false;
  };
  // Отложенные действия: эффекты, которые нельзя выполнить посреди броска (отдача, потеря концентрации).
  B.queue = fn => { const S = B.S; if (S) (S.q ||= []).push(fn); };
  B.flushQueue = async function () { const S = B.S; while (S && S.q && S.q.length) { const f = S.q.shift(); await f(); } };
  const isShieldHolder = u => !!(u.hero && ((u.hero.equip.off && itemOf(u.hero.equip.off) && itemOf(u.hero.equip.off).id === "shield") || (B.mainOf(u) && B.mainOf(u).id === "tower-shield")));
  B.isShieldBearer = u => (u.side === "mon" ? !!u.shield : isShieldHolder(u));
  const hasTowerShield = u => !!(u.hero && B.mainOf(u) && B.mainOf(u).id === "tower-shield") || (u.side === "mon" && !!u.shield && u.towerShield);
  B.hasTowerShield = hasTowerShield;
  const cellsWithin = (u, r) => { const out = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (distCell(u, x, y) <= r) out.push([x, y]); return out; };
  B.cellsWithin = cellsWithin;
  // Свободные клетки рядом с юнитом (по расстоянию от него), годные для появления нового существа.
  B.freeCellsNear = function (near, r, forUnit) {
    const out = [];
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      const dd = distCell(near, x, y); if (dd < 1 || dd > r) continue;
      if (!B.canStand(forUnit, x, y)) continue;
      const t = B.tinfo(x, y); if (t && t.hazard) continue;
      out.push([x, y, dd]);
    }
    return out.sort((a, b) => a[2] - b[2] || (a[1] - b[1]) || (a[0] - b[0]));
  };

  /* ===== призванные существа (волки, двойники) ===== */
  function insertOrder(newId, afterId) {
    const S = B.S, i = S.order.indexOf(afterId), at = i < 0 ? S.order.length : i + 1;
    S.order.splice(at, 0, newId); if (at <= S.turn && i >= 0) S.turn++;
  }
  B.addUnit = function (u, afterId) {
    const S = B.S; S.units.push(u); insertOrder(u.id, afterId);
    if (B.initUnit) B.initUnit(u);
    const g = ui(); if (g) g.refresh();
    return u;
  };
  B.doublesOf = owner => live().filter(d => d.kind === "double" && d.owner === owner.id);
  B.summonsOf = owner => live().filter(d => d.summon && d.owner === owner.id);
  // Призрачные волки героя (у монстра — настоящие рубящие волки). Статы рубящего волка; сражаются до конца боя.
  B.spawnWolves = function (owner, n) {
    const out = [], hero = owner.side === "hero";
    for (let i = 0; i < n; i++) {
      const w = B.monUnit("wolf", -1);
      Object.assign(w, { summon: true, kind: "wolf", owner: owner.id, side: owner.side, idx: null, ess: [], pass: ["body:wolf"], spectral: hero, name: (hero ? "Призрачный волк " : "Волк ") + (B.summonsOf(owner).filter(s => s.kind === "wolf").length + 1), base: hero ? "Призрачный волк" : "Волк" });
      w.ai = Object.assign({}, w.ai, { noFlee: true, fleeHp: null, morale: null, hide: false });
      const c = B.freeCellsNear(owner, 6, w)[0]; if (!c) continue;                          // дальность 9 м: ближайшая свободная клетка
      w.x = c[0]; w.y = c[1];
      B.addUnit(w, owner.id); out.push(w);
      log(`${w.name} прибегает на вой.`, "skill");
    }
    return out;
  };
  // Двойник: иллюзорная копия в свободной клетке рядом. КД как у хозяина, 1 ОЗ, исчезает от любого урона,
  // ходит после хозяина на его скорость и раз в ход бьёт его оружием вполсилы (психическая энергия).
  B.makeDouble = function (owner, cell, o = {}) {
    const S = B.S, u = B.baseUnit(owner.side);
    const atks = B.attacksOf(owner).filter(a => !a.offhand && !a.thrown && a.id !== "torchhit" && !(a.id === "fist" && B.attacksOf(owner).length > 1));
    const src = atks.sort((a, b) => B.avgDice(b.dmg) - B.avgDice(a.dmg))[0] || null;
    Object.assign(u, {
      summon: true, kind: "double", owner: owner.id, ghost: true, name: `Двойник · ${owner.name.split(" ")[0]}`, base: "Двойник", face: owner.face, size: 1,
      hp: 1, maxHp: 1, ac: owner.ac, speedC: Math.max(1, B.speedOf(owner) || owner.speedC || 1), abil: { ...owner.abil }, pb: owner.pb, level: owner.level,
      pass: ["body:double"], ess: [], bell: o.bell || 0, ttlRound: S.round + 10, ctl: "auto",
      atk: src ? [{ id: "double", n: "Двойник: " + src.n, hit: src.hit, dmg: { ...src.dmg }, dt: "psychic", kind: src.kind, reach: src.reach || 1, range: src.range, dmgMult: 0.5 }] : [],
      ai: { int: 1, role: src && src.kind === "ranged" ? "ranged" : "melee", keep: 2, focus: ["nearest"], noFlee: true },
    });
    u.x = cell[0]; u.y = cell[1];
    B.addUnit(u, owner.id);
    log(`${owner.name} создаёт двойника.`, "skill"); const g = ui(); if (g) g.fxText(u, "двойник", "good");
    return u;
  };
  // Исчезновение иллюзии (не гибель): без награды и без убитых.
  B.vanish = function (u, why) {
    if (!u.alive) return;
    u.alive = false; u.gone = true; u.hp = 0;
    log(`${u.name} ${why || "исчезает"}.`, "skill"); const g = ui(); if (g) { g.fxText(u, "исчез", ""); g.refresh(); }
    if (B.onDown) B.onDown(u, true);
  };

  /* ===== падение или смерть юнита: тела, двойники, зоны, концентрация ===== */
  B.onDown = function (u, dead) {
    const S = B.S; if (!S) return;
    if (dead && !u.summon) (S.bodies ||= []).push({ id: u.id, x: u.x, y: u.y, name: u.name, eaten: false });
    if (u.conc) { const c = u.conc; u.conc = null; if (c.onEnd) c.onEnd("упал"); }
    // двойники исчезают вместе с хозяином
    for (const d of live()) if (d.kind === "double" && d.owner === u.id && d.id !== u.id) B.vanish(d, "рассеивается");
    if (dead && S.zones) S.zones = S.zones.filter(z => z.follow !== u.id);                                                       // белая пыль висит вокруг упавшего, пока тот жив; с гибелью пепельника рассеивается
    for (const w of S.drops) if (w.holder === u.id) delete w.holder;                                                          // вор выронил схваченное
    for (const w of live()) if (w.conc && w.conc.target === u.id && w.id !== u.id) B.endConc(w, "цель пала");                   // цель проклятия пала — концентрация не нужна
    // отдача «Колокола теней»: у каждого звона свой счётчик — когда исчезает последний из его двойников
    if (u.kind === "double" && u.bell) {
      const owner = B.byId(u.owner), left = owner && owner.bellLeft;
      if (left && left[u.bell] > 0) {
        left[u.bell]--;
        if (left[u.bell] === 0) { delete left[u.bell]; if (alive(owner) && !owner.down) B.queue(async () => { log(`${owner.name}: отдача колокола.`, "bad"); const r = roll(2, 6).total; await B.applyDamage(null, owner, [{ v: r, dt: "psychic", label: "Отдача" }], {}); }); }
      }
    }
    const g = ui(); if (g) g.refresh();
  };
  // Конец раунда: истекают рои, облака и двойники (1 минута = 10 раундов).
  // «1 минута» кончается в начале хода хозяина в раунде создания + 10 — ровно 10 раундов, как в D&D (тот же счёт инициативы).
  B.expireOwned = function (u) {
    const S = B.S; if (!S) return;
    const r = S.round;
    if (S.zones) S.zones = S.zones.filter(z => !(z.owner === u.id && z.until != null && r >= z.until));
    S.objs = S.objs.filter(o => !(o.kind === "illusion" && o.by === u.id && r >= o.until));
    if (u.conc && u.conc.until != null && r >= u.conc.until) B.endConc(u, "прошла минута");
    for (const d of [...live()]) if (d.kind === "double" && d.owner === u.id && d.ttlRound != null && r >= d.ttlRound) B.vanish(d, "рассеивается");
  };
  B.onRound = function (round) {
    const S = B.S;
    if (S.zones) S.zones = S.zones.filter(z => z.until == null || z.until >= round);
    S.objs = S.objs.filter(o => o.kind !== "illusion" || o.until >= round);                                                    // иллюзия «Морока» держится 1 минуту
    for (const u of [...live()]) if (u.conc && u.conc.until != null && round > u.conc.until) B.endConc(u, "прошла минута");     // «Проклятие предков» не дольше минуты
    for (const u of [...live()]) if (u.kind === "double" && u.ttlRound != null && round > u.ttlRound) B.vanish(u, "рассеивается");
    const g = ui(); if (g) g.refresh();
  };

  /* ===== зоны: рой паучат, белая пыль ===== */
  // z: { kind, owner, cells | follow (id хозяина) + radius, until (раунд), dc, abil }
  B.addZone = function (z) { const S = B.S; (S.zones ||= []).push(z); const g = ui(); if (g) g.refresh(); return z; };
  B.zoneCells = function (z) {
    if (z.follow) { const o = B.byId(z.follow); return o && alive(o) ? cellsWithin(o, z.radius) : []; }
    return z.cells || [];
  };
  B.zonesAt = function (u, kind) {
    const S = B.S, out = [], fp = footprint(u);
    for (const z of S.zones || []) { if (kind && z.kind !== kind) continue; const zc = B.zoneCells(z); if (fp.some(([x, y]) => zc.some(([cx, cy]) => cx === x && cy === y))) out.push(z); }
    return out;
  };
  B.inZone = (u, kind) => B.zonesAt(u, kind).length > 0;
  // Любой огонь по рою уничтожает его.
  B.fireOn = function (u) {
    const S = B.S; if (!S || !S.zones || !S.zones.length) return;
    const hit = B.zonesAt(u, "swarm"); if (!hit.length) return;
    S.zones = S.zones.filter(z => !hit.includes(z)); log("Огонь уничтожает рой паучат.", "skill"); const g = ui(); if (g) g.refresh();
  };
  B.fireAtCells = function (cells) {
    const S = B.S; if (!S || !S.zones) return;
    const hit = S.zones.filter(z => z.kind === "swarm" && B.zoneCells(z).some(([x, y]) => cells.some(([cx, cy]) => cx === x && cy === y)));
    if (hit.length) { S.zones = S.zones.filter(z => !hit.includes(z)); log("Огонь уничтожает рой паучат.", "skill"); const g = ui(); if (g) g.refresh(); }
  };
  // Густая пыль «Белой пыли»: внутри видно только на 1,5 м.
  B.dustBlocks = function (att, tgt) { return B.S && B.S.zones && B.S.zones.length && dist(att, tgt) > 1 && (B.inZone(att, "dust") || B.inZone(tgt, "dust")); };
  // Начало хода существа внутри зоны и рядом с пассивными аурами.
  B.zonesTurnStart = async function (u) {
    const S = B.S;
    for (const z of [...(S.zones || [])]) {
      if (!alive(u)) break;
      if (!B.zonesAt(u).includes(z)) continue;
      const owner = B.byId(z.owner);
      if (z.kind === "swarm") {
        log(`${u.name} в рое паучат.`, "bad"); const r = roll(2, 4).total;
        await B.applyDamage(owner, u, [{ v: r, dt: "pierce", label: "Рой паучат" }], {});
        if (alive(u) && !u.down) { const sv = await B.doSave(u, "con", z.dc, { label: "Рой паучат", tags: ["poison"] }); if (!sv.ok) { addStatus(u, "poisoned", { k: 0, when: "end" }); const g = ui(); if (g) g.fxText(u, "отравлен", "bad"); } }          // k: 0 — снимется в конце этого хода
      } else if (z.kind === "dust" && u.id !== z.owner) {
        const sv = await B.doSave(u, "con", z.dc, { label: "Белая пыль", tags: ["poison"] });
        if (!sv.ok) { addStatus(u, "poisoned", { k: 0, when: "end" }); const g = ui(); if (g) g.fxText(u, "отравлен", "bad"); }
      }
    }
    for (const a of live()) for (const id of a.pass) { const P = B.P && B.P[id]; if (P && P.auraTurnStart && a.id !== u.id && alive(u)) await P.auraTurnStart(a, u); }
  };

  /* ===== концентрация ===== */
  B.startConc = function (u, key, onEnd) { if (u.conc) B.endConc(u, "новая концентрация"); u.conc = { key, onEnd }; };
  B.endConc = function (u, why) { const c = u.conc; if (!c) return; u.conc = null; if (c.onEnd) c.onEnd(why); };
  B.concCheck = async function (u, dmg) {
    if (!u.conc) return;
    const dc = Math.max(10, Math.floor(dmg / 2));
    const sv = await B.doSave(u, "con", dc, { label: "удержать концентрацию" });
    if (!sv.ok) { log(`${u.name} теряет концентрацию.`, "bad"); B.endConc(u, "потеряна"); }
  };

  /* ===== повторные спасброски в конце хода: проклятие, паралич, чужой голос ===== */
  B.endTurnSaves = async function (u) {
    const cu = has(u, "cursed");
    if (cu && alive(u)) {
      const sv = await B.doSave(u, "wis", cu.data.dc, { label: "проклятие предков" });
      if (sv.ok) { removeStatus(u, "cursed"); log(`${u.name} сбрасывает проклятие.`, "good"); const by = B.byId(cu.data.by); if (by && by.conc && by.conc.key === "goblin-elder") B.endConc(by, "цель освободилась"); }
    }
    const pa = has(u, "paralyzed");
    if (pa && alive(u)) {
      const sv = await B.doSave(u, pa.data.abil || "con", pa.data.dc, { label: "паралич" });
      if (sv.ok) { removeStatus(u, "paralyzed"); log(`${u.name} снова двигается.`, "good"); const g = ui(); if (g) g.fxText(u, "свободен", "good"); }
    }
    const lu = has(u, "lured");
    if (lu && alive(u)) {
      const sv = await B.doSave(u, "wis", lu.data.dc, { label: "чужой голос" });
      if (sv.ok) { removeStatus(u, "lured"); removeStatus(u, "fooled"); log(`${u.name} слышит обман.`, "good"); }
    }
  };
  // «Чужой голос»: в начале хода существо идёт к выбранной точке, тратя перемещение.
  B.lureStep = async function (u) {
    const lu = has(u, "lured"); if (!lu || !lu.data.to) return;
    const [tx, ty] = lu.data.to, map = B.pathMap(u, u.t.move, {});
    let best = null;
    for (const v of map.values()) { if (!B.canStand(u, v.x, v.y) && !(v.x === u.x && v.y === u.y)) continue; const dd = Math.max(Math.abs(v.x - tx), Math.abs(v.y - ty)); if (!best || dd < best.dd || (dd === best.dd && v.cost < best.cost)) best = { v, dd, cost: v.cost }; }
    if (best && (best.v.x !== u.x || best.v.y !== u.y)) {
      log(`${u.name} идёт на чужой голос.`, "skill");
      await B.moveAlong(u, B.pathTo(map, best.v.x, best.v.y), {});                           // своё перемещение: атаки по возможности возможны
    }
    u.t.move = 0;                                                                              // всё перемещение уходит на зов (стоять в точке — тоже зов)
  };

  /* ===== «Морок»: иллюзия проверяется каждым, кто увидел её впервые ===== */
  // Враги заклинателя, у которых до иллюзии есть линия, один раз делают проверку Проницательности; кто встал в её клетку — раскрыл её без проверки.
  B.illusionCheck = async function (u) {
    const S = B.S; if (!S || !S.objs.some(o => o.kind === "illusion")) return;
    for (const o of [...S.objs]) {
      if (o.kind !== "illusion" || (o.seen || []).includes(u.id) || u.side === o.owner || !alive(u) || u.down || has(u, "underground")) continue;
      (o.seen = o.seen || []).push(u.id);
      if (u.x === o.x && u.y === o.y) { log(`${u.name} проходит сквозь иллюзию и раскрывает её.`, "skill"); continue; }
      if (B.lineBlocked(u, { x: o.x, y: o.y, size: 1, id: "ill" })) { o.seen.pop(); continue; }                  // пока не видит — проверки нет
      const r = await B.doCheck(u, "insight", { title: "Морок", label: `Сл ${o.dc}`, dc: o.dc });
      if (r && !r.ok && B.fool) B.fool(u, B.byId(o.by), { data: { illusion: true, dc: o.dc } });
      else if (r) { const g = ui(); if (g) g.fxText(u, "видит насквозь", ""); }
    }
  };

  /* ===== перенаправление атак: двойник, «Принять удар» ===== */
  B.redirectAttack = async function (att, tgt, atk, o) {
    if (!B.P) return null;
    for (const id of tgt.pass) { const P = B.P[id]; if (P && P.redirect && alive(tgt)) { const nt = await P.redirect(tgt, { att, atk, o }); if (nt) return nt; } }
    for (const a of alliesOf(tgt)) for (const id of a.pass) { const P = B.P[id]; if (P && P.redirectAlly && alive(a) && B.canAct(a)) { const nt = await P.redirectAlly(a, { att, tgt, atk, o }); if (nt) return nt; } }
    return null;
  };
  // «Живая стена»: щитоносец между атакующим и союзником даёт половинное укрытие (+2).
  B.wallCover = function (att, tgt) {
    if (!B.P) return 0;
    for (const s of alliesOf(tgt)) {
      if (!s.pass.includes("hobgoblin-shield") || !B.canAct(s) || !B.isShieldBearer(s) || dist(s, tgt) > 1) continue;
      if (B.lineCells(att, tgt).some(([x, y]) => footprint(s).some(([fx, fy]) => fx === x && fy === y))) return 2;
    }
    return 0;
  };
  // Яркий свет: факел, костёр и кристаллы (обычный свет подземелья ярким не считается).
  B.brightAt = function (u) {
    const S = B.S; if (S.torch) return true;
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) { const t = B.tinfo(x, y); if (t && (t.hazard === "fire" || t.light) && distCell(u, x, y) <= (t.light || 2)) return true; }
    return false;
  };

  /* ===== перемещение без провоцирования: притянуть, телепорт ===== */
  B.pullAdjacent = async function (t, to) {
    let moved = 0;
    for (let i = 0; i < 6 && dist(t, to) > 1; i++) {
      const dx = Math.sign(to.x - t.x), dy = Math.sign(to.y - t.y), cands = [[dx, dy], [dx, 0], [0, dy]].filter(([a, b]) => a || b);
      let done = false;
      for (const [a, b] of cands) { const nx = t.x + a, ny = t.y + b; if (B.canStand(t, nx, ny)) { const from = [t.x, t.y]; t.x = nx; t.y = ny; moved++; const g = ui(); if (g) await g.animMove(t, from, [nx, ny]); B.breakGrapples(t); await B.terrainEnter(t); done = true; break; } }
      if (!done) break;
    }
    return moved;
  };
  B.teleport = async function (u, x, y) {
    const from = [u.x, u.y]; u.x = x; u.y = y;
    const g = ui(); if (g) await g.animMove(u, from, [x, y]);
    B.breakGrapples(u);                                                                 // унесло из рук того, кто держит
    await B.terrainEnter(u);
  };
})();
