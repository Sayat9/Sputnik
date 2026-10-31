/* Тактический бой: эссенции 1 этажа. B.P — пассивки (хуки), B.A — активные способности.
   Одни и те же описания работают и у героев (мана, перезарядка, выбор целей игроком), и у монстров (раз за бой, выбор целей — ИИ). */
(function () {
  const B = window.Battle, D = B.D;
  const { roll, parseDice, fmtDice, amod, sg, clamp, log, dist, distAt, distCell, footprint, alive, live, enemiesOf, alliesOf, has, addStatus, removeStatus, speedOf, canAct, ABIL_RU } = B;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const dcOf = (u, ab) => 8 + u.pb + amod(u.abil[ab]);
  B.dcOf = dcOf;
  const isShieldHolder = u => (u.side === "mon" ? !!u.shield : !!(u.hero && ((u.hero.equip.off && itemOf(u.hero.equip.off) && itemOf(u.hero.equip.off).id === "shield") || (u.hero.equip.main && itemOf(u.hero.equip.main) && itemOf(u.hero.equip.main).id === "tower-shield"))));
  const within = (u, r) => enemiesOf(u).filter(e => dist(u, e) <= r && !has(e, "underground") && B.visibleTo(u, e));        // закопавшегося в землю выбрать нельзя
  const around = (u, r) => live().filter(o => o.id !== u.id && dist(u, o) <= r && !has(o, "underground"));      // все существа вокруг, включая союзников
  const cellsAround = (u, r) => { const out = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) { const dd = distCell(u, x, y); if (dd > 0 && dd <= r) out.push([x, y]); } return out; };
  const durEnd = (u, n = 1) => ({ endAtEndOf: u.id, endTurnNo: u.turnsTaken + n });
  // Подбор атаки для способностей «через атаку»: герой берёт оружие нужного вида, монстр — свою атаку.
  // needWeapon — только настоящее оружие героя (не кулак): «дробящим оружием», «колющим оружием».
  function atkFor(u, kind, dt, needWeapon) {
    let list = B.attacksOf(u).filter(a => a.kind === kind && !a.offhand && !a.thrown && !a.special && !(u.side === "hero" && a.id === "torchhit"));
    if (needWeapon && u.side === "hero") list = list.filter(a => a.w);
    if (u.side === "hero") list = list.filter(a => !a.ammo || B.arrowsLeft(u) > 0);
    if (dt) list = list.filter(a => a.dt === dt);
    if (u.side === "hero" && kind === "melee" && list.length > 1) list = list.filter(a => a.id !== "fist");
    return list.sort((a, b) => B.avgDice(b.dmg) - B.avgDice(a.dmg))[0] || null;
  }
  B.atkFor = atkFor;
  async function save(t, abil, dc, label, tags, from) { return B.doSave(t, abil, dc, { label, tags, from }); }
  const specUnit = (u, prompt, units, cells, kind = "attack") => ({ type: "unit", prompt, units: units.map(x => x.id), cells, kind });
  // Способность «атака + спасбросок цели». cfg: kind, dt, abil (характеристика Сл), save (спасброс цели), onFail(t,u,sv), onOk(t,u,sv), label.
  // cfg.extra {n, s, label} — дополнительные кости урона при попадании («+2к6»); cfg.weapon — нужно настоящее оружие; без cfg.save — только урон и cfg.onHit.
  function attackRider(cfg) {
    const atkOf = u => atkFor(u, cfg.kind, cfg.dt, cfg.weapon);
    const need = cfg.weaponText || (cfg.kind === "ranged" ? "нужен лук и стрелы" : cfg.weapon ? "нужно подходящее оружие" : "нужна атака ближнего боя");
    // «Дальность: 1,5 м» у всех ближних способностей: копьё с «Длинной рукой» и другое длинное оружие дальше соседней клетки не достают
    const reachOf = (u, a) => { const ts = B.attackTargets(u, a); return cfg.kind === "melee" ? ts.filter(t => dist(u, t) <= 1) : ts; };
    const objsOf = (u, a) => (u.side === "hero" && B.objectTargets && a ? B.objectTargets(u, a).filter(o => cfg.kind !== "melee" || distCell(u, o.x, o.y) <= 1) : []);
    return {
      tgt(u) { const a = atkOf(u); const ts = a ? reachOf(u, a) : []; const sp = specUnit(u, `${cfg.name}: выберите цель`, ts, a ? (cfg.kind === "melee" ? B.cellsWithin(u, 1) : B.rangeCells(u, a)) : []); sp.objs = objsOf(u, a).map(o => o.x + "," + o.y); if (a && cfg.kind !== "melee") sp.from = u; return sp; },
      can(u) { const a = atkOf(u); if (!a) return need; return reachOf(u, a).length || objsOf(u, a).length ? true : "нет целей"; },
      async run(u, pk, ctl) {
        const a = atkOf(u); if (!a) return false;
        const dc = cfg.abil ? dcOf(u, cfg.abil) : 0;
        const extra = cfg.extra ? [{ n: cfg.extra.n, s: cfg.extra.s, b: 0, dt: cfg.extra.dt || a.dt, label: cfg.extra.label || cfg.name, critDouble: true }] : null;
        const r = await B.doAttack(u, pk.unit, a, { extra, dc, onCommit: () => { B.commitAttack(u, a, pk.unit); ctl.commit(); }, rider: async res => {
          const t = res.tgt; if (!alive(t) && !t.down) return;
          if (!cfg.save) { if (cfg.onHit) await cfg.onHit(t, u, res); return; }
          const sv = await save(t, cfg.save, dc, cfg.name, cfg.tags);
          if (!sv.ok) await cfg.onFail(t, u, sv, res); else if (cfg.onOk) await cfg.onOk(t, u, sv, res);
        } });
        return !r.cancelled;
      },
      ai(u) {
        const a = atkOf(u); if (!a) return null;
        const ts = reachOf(u, a); if (!ts.length) return null;
        return { atk: a, targets: ts, bonus: (cfg.aiBonus || 3) + (cfg.extra ? cfg.extra.n * (cfg.extra.s + 1) / 2 : 0), attackAbility: true };
      },
    };
  }
  // Способность «спасбросок по области/целям». cfg: radius, side:'enemies'|'all', abil, save, dmg:'1к4', dt, half, onFail, onOk.
  function saveArea(cfg) {
    const pool = u => { const l = cfg.side === "all" ? around(u, cfg.radius) : within(u, cfg.radius); return cfg.ground ? l.filter(x => !B.isFlying(x)) : l; };          // ground — «все существа на земле»
    return {
      tgt(u) { return { type: cfg.choose ? "units" : "area", prompt: `${cfg.name}: подтвердите`, units: pool(u).map(x => x.id), cells: cellsAround(u, cfg.radius), min: 0, max: cfg.max || 9, kind: "area" }; },
      can(u) { return pool(u).length ? true : "никого рядом"; },
      async run(u, pk, ctl) {
        let ts = pk.units && cfg.side !== "all" ? pk.units.filter(x => alive(x) || x.down) : pool(u); if (cfg.max && ts.length > cfg.max) ts = ts.slice(0, cfg.max); if (!ts.length) return false;          // «все существа» — без выбора
        ctl.commit();
        const dc = dcOf(u, cfg.abil);
        let total = 0, rolls = null;
        if (cfg.dmg) {
          const dd = parseDice(cfg.dmg), ses = B.session(u, { kind: "damage", u, title: cfg.name, sub: `${u.name}: урон по области` });
          const r = await ses.dice({ label: `Урон ${cfg.dmg}`, n: dd.n, s: dd.s, bonus: dd.b, dt: cfg.dt, cancel: false, reroll: B.rerollOptions(u, "damage", { melee: false }) });
          total = r.sum + dd.b + (cfg.dt === "fire" ? B.hookSum(u, "abilityDmg", { dt: "fire" }) : 0);          // «Свои не горят»: +2 к огню способностей
          await ses.finish({ text: `${total} урона (${D.DT[cfg.dt]})`, anim: cfg.anim || B.animKind({ dt: cfg.dt, kind: "melee" }), dmg: total, tgt: ts[0] });
        }
        if (cfg.dmg && total > 0 && B.blastCells) B.blastCells(cellsAround(u, cfg.radius), total, cfg.dt, u);          // область ломает камни и кристаллы
        ui() && ui().banner(`${u.name}: ${cfg.name}!`);
        const svs = await B.massSave(ts, cfg.save, dc, { label: cfg.name, title: cfg.name, tags: cfg.tags, from: u });
        for (let i = 0; i < ts.length; i++) {
          const t = ts[i], sv = svs[i];
          if (cfg.dmg && total > 0) { const v = sv.ok ? (cfg.half ? Math.floor(total / 2) : 0) : total; if (v > 0) await B.applyDamage(u, t, [{ v, dt: cfg.dt, label: cfg.name }], { skill: true }); }
          if (alive(t) || t.down) { if (!sv.ok && cfg.onFail) await cfg.onFail(t, u, sv); if (sv.ok && cfg.onOk) await cfg.onOk(t, u, sv); }
        }
        return true;
      },
      ai(u) { const ts = pool(u).filter(t => cfg.side !== "all" || t.side !== u.side); if (!ts.length) return null; const bad = cfg.side === "all" ? around(u, cfg.radius).filter(t => t.side === u.side).length : 0; if (bad > ts.length) return null; return { units: cfg.max ? ts.slice(0, cfg.max) : ts, score: 2 + Math.min(ts.length, cfg.max || 9) * 2 - bad * 3 }; },
    };
  }

  /* ===================== АКТИВКИ ===================== */
  const A = (B.A = {});

  // Гоблин — ловушка на соседней клетке.
  A.goblin = {
    time: "action",
    tgt(u) { const cells = cellsAround(u, 1).filter(([x, y]) => B.canStand({ ...u, size: 1, x, y, id: "tmp" }, x, y) && !B.S.objs.some(o => o.x === x && o.y === y) && !B.tinfo(x, y)?.obstacle); return { type: "cell", prompt: "Ловушка: выберите соседнюю клетку", cells, kind: "trap" }; },
    can(u) { const n = B.S.objs.filter(o => o.by === u.id).length; return n >= 3 ? "уже 3 ловушки" : true; },
    async run(u, pk, ctl) {
      ctl.commit(); const [x, y] = pk.cell;
      const trap = { id: "t" + Math.random().toString(36).slice(2, 7), kind: "trap", x, y, dc: dcOf(u, "dex"), hidden: true, owner: u.side, by: u.id, dmg: "1к6", dt: "pierce", noticed: [] };
      // ловушка скрыта: враги замечают её Восприятием против Сл (пассивным)
      for (const e of enemiesOf(u)) if (B.passivePerceptionOf(e) >= trap.dc) { trap.noticed.push(e.id); if (e.side === "hero") trap.hidden = false; }
      B.S.objs.push(trap);
      log(`${u.name} ставит ловушку.`); ui() && (ui().fxText(u, "ловушка", ""), ui().refresh()); return true;
    },
    ai(u) {
      if (B.S.objs.filter(o => o.by === u.id).length >= 3) return null;
      const es = enemiesOf(u); if (!es.length) return null;
      const near = es.reduce((a, b) => (dist(u, a) < dist(u, b) ? a : b));
      if (dist(u, near) <= 1 || dist(u, near) > 5) return null;
      const spec = A.goblin.tgt(u); if (!spec.cells.length) return null;
      const cell = spec.cells.sort((a, b) => distCell(near, a[0], a[1]) - distCell(near, b[0], b[1]))[0];
      return { cell, score: 4 };
    },
  };
  A["goblin-archer"] = attackRider({ name: "Пригвоздить", kind: "ranged", abil: "dex", save: "str", tags: ["slow"], aiBonus: 4,
    onFail: async (t, u) => { addStatus(t, "pinned", { k: 1, when: "end", data: { dc: dcOf(u, "dex") } }); log(`${t.name} пригвождён.`); ui() && ui().fxText(t, "пригвождён", "bad"); },
    onOk: async t => { addStatus(t, "slowed", { k: 1, when: "end", data: { add: -2 } }); ui() && ui().fxText(t, "замедлен", "bad"); } });
  A["goblin-sword"] = {
    time: "action",
    tgt(u) { const a = atkFor(u, "melee", "slash"); const ts = within(u, 1); return { type: "units", prompt: "Размашистый удар: до 3 целей рядом", units: ts.map(x => x.id), cells: cellsAround(u, 1), min: 1, max: 3, kind: "attack" }; },
    can(u) { return atkFor(u, "melee", "slash") ? (within(u, 1).length ? true : "нет врагов рядом") : "нужно рубящее оружие"; },
    async run(u, pk, ctl) {
      const a = atkFor(u, "melee", "slash"); if (!a) return false; const ts = pk.units;
      const ses = B.session(u, { kind: "damage", u, title: "Размашистый удар", sub: `${u.name}: ${ts.length} цел.` });
      const r = await ses.dice({ label: `Урон оружия ${fmtDice(a.dmg)}`, n: a.dmg.n, s: a.dmg.s, bonus: a.dmg.b, dt: a.dt, cancel: true, reroll: B.rerollOptions(u, "damage", { melee: true }) });
      if (!r) { ses.close(); return false; }
      ctl.commit(); u.t.attacked = true;
      const total = r.sum + a.dmg.b; await ses.finish({ text: `${total} урона каждой цели при провале`, anim: "slash", dmg: total, tgt: ts[0] });
      const dc = dcOf(u, "str");
      const svs = await B.massSave(ts, "dex", dc, { label: "Размашистый удар", title: "Размашистый удар", from: u }); for (let i = 0; i < ts.length; i++) { const t = ts[i], sv = svs[i]; const v = sv.ok ? Math.floor(total / 2) : total; await B.applyDamage(u, t, [{ v, dt: "slash", label: a.n }], { melee: true, src: u, weapon: true }); }          // weapon: урон оружия (для «Лат из костей»)
      return true;
    },
    ai(u) { const ts = within(u, 1); const a = atkFor(u, "melee", "slash"); if (!a || ts.length < 2) return null; return { units: ts.slice(0, 3), score: ts.length * 3 }; },
  };
  A["goblin-spear"] = { time: "reaction", reaction: true,
    ai() { return null }, tgt() { return { type: "self" }; }, run: async () => false };
  A.hobgoblin = {
    time: "bonus",
    tgt(u) {
      const sp = Math.floor(speedOf(u) / 2), map = B.pathMap(u, sp, {});
      const cells = [...map.values()].filter(v => (v.x !== u.x || v.y !== u.y) && B.canStand(u, v.x, v.y)).map(v => [v.x, v.y]);
      return { type: "cell", prompt: "Рывок: куда (половина скорости, без провоцированных атак)", cells, kind: "move", path: map, optional: true };
    },
    can(u) { return speedOf(u) >= 2 ? true : "слишком медленный"; },
    async run(u, pk, ctl) {
      ctl.commit();
      if (pk.cell) { const map = B.pathMap(u, Math.floor(speedOf(u) / 2), {}); const path = B.pathTo(map, pk.cell[0], pk.cell[1]); const r = await B.moveAlong(u, path, { noProvoke: true }); u.t.moved += r.spent; }
      addStatus(u, "rush", { k: 0, when: "end" }); ui() && ui().fxText(u, "рывок", "good"); return true;
    },
    ai(u) { const es = enemiesOf(u); if (!es.length || !B.attacksOf(u).some(a => a.kind === "melee")) return null; const near = es.reduce((a, b) => (dist(u, a) < dist(u, b) ? a : b)); if (dist(u, near) <= 1) return null; return { target: near, score: 5 }; },
  };
  A["dark-bear"] = attackRider({ name: "Медвежья хватка", kind: "melee", abil: "str", save: "str", tags: ["grapple"], aiBonus: 5,
    onFail: async (t, u) => { addStatus(t, "grappled", { k: Infinity, data: { by: u.id, dc: dcOf(u, "str"), dmg: "1к6", dt: "bludgeon" } }); log(`${u.name} хватает ${t.name} — тот не может двигаться.`); ui() && ui().fxText(t, "схвачен", "bad"); } });
  A["skeleton-warrior"] = { time: "reaction", reaction: true, ai() { return null; }, tgt() { return { type: "self" }; }, run: async () => false };

  // Каменный сторож — обвал: куб 3 м (2×2 клетки) в пределах 6 клеток.
  A["stone-guardian"] = {
    time: "action",
    tgt(u) {
      const anchors = [];
      for (let y = 0; y < B.H - 1; y++) for (let x = 0; x < B.W - 1; x++) if (distCell(u, x, y) <= 6) anchors.push([x, y]);
      return { type: "cube", prompt: "Обвал: выберите куб 2×2 клетки", anchors, size: 2, kind: "area", okLabel: "Обвал!" };
    },
    can() { return true; },
    async run(u, pk, ctl) {
      ctl.commit(); const [ax, ay] = pk.cell;
      const inCube = o => footprint(o).some(([x, y]) => x >= ax && x < ax + 2 && y >= ay && y < ay + 2);
      const ts = live().filter(o => inCube(o) && !has(o, "underground"));                       // закопавшегося землекопа обвал не задевает
      const dd = parseDice("2к6"), ses = B.session(u, { kind: "damage", u, title: "Обвал", sub: `${u.name}: 2к6 дробящего` });
      const r = await ses.dice({ label: "Урон 2к6", n: 2, s: 6, bonus: 0, dt: "bludgeon", cancel: false, reroll: B.rerollOptions(u, "damage", {}) });
      const total = r.sum; await ses.finish({ text: `${total} урона`, anim: "blunt", dmg: total, tgt: ts[0] || u });
      ui() && ui().fxCube(ax, ay, 2);
      if (B.blastCells) B.blastCells([[ax, ay], [ax + 1, ay], [ax, ay + 1], [ax + 1, ay + 1]], total, "bludgeon", u);          // обвал ломает камни
      const dc = dcOf(u, "con");
      for (const t of ts) { const sv = await save(t, "dex", dc, "Обвал"); await B.applyDamage(u, t, [{ v: sv.ok ? Math.floor(total / 2) : total, dt: "bludgeon", label: "Обвал" }], {}); if (!sv.ok && (alive(t) || t.down)) { B.knock(t, u); ui() && ui().fxText(t, "сбит с ног", "bad"); } }
      return true;
    },
    ai(u) {
      let best = null;
      for (let y = 0; y < B.H - 1; y++) for (let x = 0; x < B.W - 1; x++) {
        if (distCell(u, x, y) > 6) continue;
        const ts = live().filter(o => footprint(o).some(([fx, fy]) => fx >= x && fx < x + 2 && fy >= y && fy < y + 2));
        const sc = ts.filter(o => o.side !== u.side).length * 3 - ts.filter(o => o.side === u.side).length * 4;
        if (sc > 0 && (!best || sc > best.score)) best = { cell: [x, y], score: sc };
      }
      return best;
    },
  };
  // Волк — сквозной рывок по прямой.
  function dashLines(u) {
    const out = [], sp = speedOf(u);
    for (const [dx, dy] of B.DIRS) {
      const path = [];
      for (let i = 1; i <= sp; i++) {
        const x = u.x + dx * i, y = u.y + dy * i;
        if (!B.inB(x, y) || !B.canPass(u, x, y, {}) || B.occupant(x, y, u)) break;
        path.push([x, y]);
        out.push({ end: [x, y], path: path.slice() });
      }
    }
    return out;
  }
  const dashVictims = (u, path) => { const seen = new Set(), out = []; for (const [x, y] of path) for (const o of enemiesOf(u)) if (!seen.has(o.id) && !has(o, "underground") && distCell(o, x, y) <= 1) { seen.add(o.id); out.push(o); } return out.slice(0, 2); };
  A.wolf = {
    time: "action",
    tgt(u) { const lines = dashLines(u); return { type: "cell", prompt: "Сквозной рывок: выберите конец прямой", cells: lines.map(l => l.end), kind: "move", lines }; },
    can(u) { if (u.side === "hero" && !atkFor(u, "melee", "slash")) return "нужно рубящее оружие"; return speedOf(u) > 0 && dashLines(u).length ? true : "некуда бежать"; },
    async run(u, pk, ctl) {
      const line = dashLines(u).find(l => l.end[0] === pk.cell[0] && l.end[1] === pk.cell[1]); if (!line) return false;
      const a = atkFor(u, "melee", "slash") || (u.side === "mon" ? atkFor(u, "melee") : null); if (!a) return false;       // урон рубящего оружия или когтей
      ctl.commit();
      const dd = a.dmg, dt = a.dt;
      const r = await B.moveAlong(u, line.path, { noProvoke: true }); u.t.moved += r.spent;
      const vs = dashVictims(u, line.path); if (!vs.length) return true;
      const ses = B.session(u, { kind: "damage", u, title: "Сквозной рывок", sub: `${u.name}: когти по ${vs.length} цел.` });
      const rr = await ses.dice({ label: `Урон ${fmtDice(dd)}`, n: dd.n, s: dd.s, bonus: dd.b, dt, cancel: false, reroll: B.rerollOptions(u, "damage", { melee: true }) });
      const total = rr.sum + dd.b; await ses.finish({ text: `${total} урона при провале`, anim: "slash", dmg: total, tgt: vs[0] });
      const dc = dcOf(u, "str");
      for (const t of vs) { const sv = await save(t, "dex", dc, "Сквозной рывок"); await B.applyDamage(u, t, [{ v: sv.ok ? Math.floor(total / 2) : total, dt, label: "Рывок" }], { melee: true, src: u }); }
      return true;
    },
    ai(u) {
      const lines = dashLines(u); let best = null;
      for (const l of lines) { const vs = dashVictims(u, l.path); if (!vs.length) continue; const sc = vs.length * 3 + (vs.some(v => v.hp < v.maxHp / 2) ? 2 : 0) - (enemiesOf(u).filter(e => distCell(e, l.end[0], l.end[1]) <= 1).length > 1 ? 1 : 0); if (!best || sc > best.score) best = { cell: l.end, score: sc }; }
      return best && best.score >= 3 ? best : null;
    },
  };
  // Лиса — обманный след.
  A.fox = {
    time: "bonus",
    tgt(u) { const ts = within(u, 6).filter(e => canAct(e)); return specUnit(u, "Обманный след: кого сбить со следа?", ts, cellsAround(u, 6), "debuff"); },
    can(u) { return within(u, 6).length ? true : "никого поблизости"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit;
      const sv = await save(t, "wis", dcOf(u, "dex"), "Обманный след");
      if (!sv.ok) { addStatus(t, "deceived", { k: Infinity, data: { by: u.id, ...durEnd(u, 1) } }); ui() && ui().fxText(t, "потерял след", "bad"); }
      return true;
    },
    ai(u) { const ts = within(u, 6).filter(e => canAct(e)); if (!ts.length) return null; const t = ts.reduce((a, b) => (dist(u, a) < dist(u, b) ? a : b)); return { unit: t, score: 4 }; },
  };
  A.mouse = saveArea({ name: "Громовой писк", radius: 1, side: "all", abil: "con", save: "con", dmg: "1к4", dt: "thunder", half: true, anim: "thunder", tags: ["sound", "stun"],
    onFail: async t => { addStatus(t, "shaken", { k: 1, when: "end" }); ui() && ui().fxText(t, "оглушён", "bad"); } });
  A.bat = {
    time: "bonus", tgt() { return { type: "self" }; },
    can(u) { return has(u, "envenomed") ? "уже готов" : true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "envenomed", { k: 0, when: "end" }); ui() && ui().fxText(u, "яд на клыках", "good"); return true; },
    ai(u) { if (!enemiesOf(u).length || has(u, "envenomed")) return null; return { score: 4 }; },
  };
  A.zombie = {
    time: "action",
    tgt(u) { return specUnit(u, "Мёртвая хватка: кого схватить?", within(u, 1), cellsAround(u, 1)); },
    can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit;
      const sv = await save(t, "str", dcOf(u, "str"), "Мёртвая хватка", ["grapple"]);
      if (!sv.ok) { addStatus(t, "grappled", { k: Infinity, data: { by: u.id, dc: dcOf(u, "str"), ...durEnd(u, 1) } }); log(`${u.name} вцепляется в ${t.name}.`); ui() && ui().fxText(t, "схвачен", "bad"); }
      return true;
    },
    ai(u) { const ts = within(u, 1).filter(t => !has(t, "grappled")); if (!ts.length) return null; return { unit: ts[0], score: 4 }; },
  };
  A.skeleton = saveArea({ name: "Треск костей", radius: 1, side: "enemies", abil: "con", save: "wis", tags: ["frightened"], choose: true, max: 1,
    onFail: async (t, u) => { addStatus(t, "frightened", { k: 1, when: "end", data: { by: u.id } }); ui() && ui().fxText(t, "испуган", "bad"); } });
  A["skeleton-archer"] = attackRider({ name: "Ледяная стрела", kind: "ranged", abil: "dex", save: "con", tags: ["cold"], aiBonus: 4,
    onFail: async (t, u) => { const r = roll(1, 4).total; log(`Ледяная стрела: +${r} холодом, ${t.name} замедлен.`); await B.applyDamage(u, t, [{ v: r, dt: "cold", label: "Холод" }], {}); if (alive(t) || t.down) { addStatus(t, "slowed", { k: 1, when: "end", data: { add: -2 } }); ui() && ui().fxText(t, "замедлен", "bad"); } } });
  A.ghoul = attackRider({ name: "Сковывающий укус", kind: "melee", abil: "dex", save: "con", tags: ["slow"], aiBonus: 3,
    onFail: async t => { addStatus(t, "slowed", { k: 1, when: "end", data: { mult: 0.5, disAtk: true } }); ui() && ui().fxText(t, "скован", "bad"); } });
  A["living-stone"] = attackRider({ name: "Сокрушающий удар", kind: "melee", abil: "str", save: "str", tags: ["prone"], aiBonus: 3,
    onFail: async (t, u) => { B.knock(t, u); ui() && ui().fxText(t, "сбит с ног", "bad"); } });
  A.pixie = {
    time: "action",
    tgt(u) { return specUnit(u, "Сонная пыльца: на кого?", within(u, 2), cellsAround(u, 2), "debuff"); },
    can(u) { return within(u, 2).length ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit;
      const sv = await save(t, "wis", dcOf(u, "cha"), "Сонная пыльца");
      if (!sv.ok) {
        if (t.side === "hero" && t.hero && state.run && state.run.status && state.run.status[t.hero.id]) { const st = state.run.status[t.hero.id]; st.fat = Math.min(4, st.fat + 1); t.fat = st.fat; log(`${t.name}: +1 уровень Усталости.`); }
        else addStatus(t, "weakened", { k: Infinity });
        addStatus(t, "sleepy", { k: Infinity }); ui() && ui().fxText(t, "клонит в сон", "bad");
      }
      return true;
    },
    ai(u) { const ts = within(u, 2).filter(t => !has(t, "sleepy")); if (!ts.length) return null; return { unit: ts[0], score: 4 }; },
  };
  A.wisp = saveArea({ name: "Вспышка", radius: 1, side: "all", abil: "dex", save: "con", dmg: "1к4", dt: "fire", half: true, anim: "fire",
    onFail: async t => { addStatus(t, "dazzled", { k: 1, when: "end" }); ui() && ui().fxText(t, "ослеплён", "bad"); } });
  A["green-boulder"] = saveArea({ name: "Цепкий мох", radius: 1, side: "enemies", abil: "con", save: "str", tags: ["slow"], choose: true,
    onFail: async t => { addStatus(t, "slowed", { k: 1, when: "end", data: { mult: 0.5 } }); ui() && ui().fxText(t, "замедлен", "bad"); } });

  /* ===================== ПАССИВКИ ===================== */
  const P = (B.P = {});
  // Гоблин: ловушки в 3 м замечаются сами.
  // Простые ловушки (Сл ≤ 12) чужой стороны в 3 м замечаются сами: в начале хода и при каждом шаге.
  function noticeTraps(u) {
    for (const t of B.S.objs) {
      if (t.kind !== "trap" || t.owner === u.side || t.dc > 12 || distCell(u, t.x, t.y) > 2) continue;
      if (u.side === "hero") { if (!t.hidden) continue; t.hidden = false; }
      else { t.noticed = t.noticed || []; if (t.noticed.includes(u.id)) continue; t.noticed.push(u.id); }
      log(`${u.name} замечает ловушку.`); ui() && ui().refresh();
    }
  }
  P.goblin = {
    turnStart(u) { noticeTraps(u); },
    onMoveStep(u) { noticeTraps(u); },
    checkMods(u, ctx) { if (ctx.tags.includes("trapsearch")) ctx.mods.push({ l: "Хитрость", v: 2 }); },
    actions(u) {
      const S = B.S, near = S.objs.filter(t => t.kind === "trap" && !t.hidden && distCell(u, t.x, t.y) <= 1);
      if (!near.length) return [];
      return [{ id: "disarm", cat: "skill", label: "Обезвредить ловушку", ico: "search", sub: "свободное действие · Ловкость с преимуществом", time: "free", enabled: !u.t.objUsed, why: "уже было", run: async () => {
        const t = near[0]; const r = await B.doCheck(u, "sleight", { title: "Обезвредить ловушку", label: `Сл ${t.dc}`, dc: t.dc, adv: ["Хитрость"], cancel: true });
        if (!r) return false; u.t.objUsed = true;
        if (r.ok) { S.objs.splice(S.objs.indexOf(t), 1); log(`${u.name} обезвреживает ловушку.`, "good"); } else { log(`${u.name} задевает ловушку!`); await B.trapTrigger(u, { trap: t }); }
        ui() && ui().refresh(); return true; } }];
    },
  };
  P["goblin-archer"] = { ignoreHalfCover(u, ctx) { return !ctx.melee; } };
  P["goblin-sword"] = {
    onHitDealt(att, ctx) { if (ctx.melee && ctx.atk.dt === "slash" && ctx.res.hit && (ctx.tgt.alive || ctx.tgt.down) && !has(ctx.tgt, "bleeding")) { addStatus(ctx.tgt, "bleeding", { k: Infinity, src: att.id }); ui() && ui().fxText(ctx.tgt, "кровотечение", "bad"); } },
  };
  // Копейщик: досягаемость и «Встречный удар» (реакция).
  P["goblin-spear"] = {
    async reactEnter(e, mover, from) {
      const A_ = B.A["goblin-spear"], eb = ESSENCES["goblin-spear"].active;
      const atk = atkFor(e, "melee", "pierce"); if (!atk) return;
      const r = atk.reach || 1;
      if (dist(e, mover) > r || (from && distAt(e, mover, from[0], from[1]) <= r)) return;
      if (e.side === "hero") { if (e.mp < eb.mana || e.cd["goblin-spear"] > 0) return; if (!(await B.promptReaction({ unit: e, title: "Встречный удар", text: `${mover.name} входит в вашу досягаемость. Ударить копьём? (${eb.mana} маны)` }))) return; }
      else { if (e.used["goblin-spear"]) return; }
      if (e.side === "hero") { B.setMp(e, e.mp - eb.mana); B.setCd(e, "goblin-spear", D.essCd["goblin-spear"] || 2); } else e.used["goblin-spear"] = true;
      e.t.react = 0; log(`${e.name}: встречный удар по ${mover.name}.`, "skill"); ui() && ui().banner(`${e.name}: встречный удар!`);
      await B.doAttack(e, mover, atk, { reaction: true, cancelable: false, rider: async res => {
        const sv = await save(res.tgt, "str", dcOf(e, "str"), "Встречный удар");
        if (!sv.ok) { addStatus(res.tgt, "spearstop", { k: 0, when: "end" }); ui() && ui().fxText(res.tgt, "остановлен", "bad"); }
      } });
    },
  };
  P.hobgoblin = {
    attackMods(att, ctx) { if (ctx.melee && has(att, "rush")) { ctx.mods.push({ l: "Рывок", v: 2 }); ctx.consume.push([att, "rush"]); } },
    dmgTotal(u, c) { if (u.flags.hide || !(c.o && c.o.ctx) || !(c.total > 0)) return c.total; u.flags.hide = true; if (c.total > 0) { const r = roll(1, 4).total; const nt = Math.max(1, c.total - r); c.notes.push(`толстая шкура −${c.total - nt}`); return nt; } return c.total; },
  };
  P["dark-bear"] = { checkMods(u, ctx) { if (ctx.skill === "stealth" && (B.inDark(u) || B.hideSpot(u) === "в тени")) ctx.adv.push("шкура мрака"); } };
  P["skeleton-warrior"] = {
    acAura(ally, c) {
      if (!isShieldHolder(ally) || !canAct(ally) || c.tgt.id === ally.id || dist(ally, c.tgt) > 1) return 0;
      const near = alliesOf(ally).filter(a => canAct(a) && dist(ally, a) <= 1).sort((a, b) => a.ac - b.ac || (a.id < b.id ? -1 : 1));
      return near[0] && near[0].id === c.tgt.id ? 1 : 0;                                  // «один союзник»: тот, кому броня нужнее
    },
    async reactHit(tgt, ctx) {
      if (!ctx.melee || !isShieldHolder(tgt) || !tgt.t.react) return false;
      const eb = ESSENCES["skeleton-warrior"].active;
      if (ctx.total - ctx.ac > 3) return false;
      if (tgt.side === "hero") { if (tgt.mp < eb.mana || tgt.cd["skeleton-warrior"] > 0) return false; if (!(await B.promptReaction({ unit: tgt, title: "Парирование щитом", text: `${ctx.att.name} попадает по вам. Отразить щитом? (${eb.mana} маны)` }))) return false; B.setMp(tgt, tgt.mp - eb.mana); B.setCd(tgt, "skeleton-warrior", D.essCd["skeleton-warrior"] || 2); }
      else { if (tgt.used["skeleton-warrior"]) return false; tgt.used["skeleton-warrior"] = true; }
      tgt.t.react = 0; log(`${tgt.name} парирует щитом!`, "skill"); return true;
    },
  };
  P["stone-guardian"] = { };           // чувство вибрации задаётся в initUnit
  P.wolf = {
    actions() { return []; },
  };
  P.fox = {
    onMiss(att, ctx) { if (ctx.hiddenData && !ctx.hiddenData.pen) { addStatus(att, "hidden", { k: Infinity, data: { pen: true } }); ui() && ui().fxText(att, "остался скрыт", "good"); } },
    attackMods(att, ctx) { const h = has(att, "hidden"); if (h && h.data.pen) ctx.mods.push({ l: "Из того же укрытия", v: -2 }); },
  };
  P.mouse = {
    resist(u, c) { return c.dt === "thunder"; },
    saveMods(u, ctx) { if (ctx.tags.includes("stun") || ctx.tags.includes("deaf") || ctx.tags.includes("sound")) ctx.adv.push("привычка к грохоту"); },
  };
  P.bat = {
    onHitDealt(att, ctx) {
      const ev = has(att, "envenomed"); if (!ev || !ctx.melee || !ctx.res.hit || !(ctx.tgt.alive || ctx.tgt.down)) return;
      removeStatus(att, "envenomed");
      const t = ctx.tgt; ctx.res.poison = async () => { const sv = await save(t, "con", dcOf(att, "dex"), "Ядовитый укус"); const r = roll(1, 4).total; await B.applyDamage(att, t, [{ v: r, dt: "poison", label: "Яд" }], {}); if (!sv.ok && (alive(t) || t.down)) { addStatus(t, "poisoned", { k: 1, when: "end" }); ui() && ui().fxText(t, "отравлен", "bad"); } };
    },
    async afterAttack(att, ctx) { if (ctx.res && ctx.res.poison) await ctx.res.poison(); },
  };
  P.zombie = {
    async beforeZero(u, c) {
      const o = c.o || {}; if (o.crit || o.dt === "radiant") return false;
      const flags = u.hero ? (u.hero.flags = u.hero.flags || {}) : u.flags; const n = flags.stubborn || 0;
      const dc = 5 + (o.taken || c.left) + 5 * n;
      const sv = await save(u, "con", dc, "Упрямая плоть");
      if (sv.ok) { flags.stubborn = n + 1; log(`${u.name}: упрямая плоть — остаётся на ногах!`, "good"); ui() && ui().fxText(u, "упрямая плоть", "good"); return true; }
      return false;
    },
  };
  P.skeleton = { dmgFlat(u, c) { return c.dt === "pierce" ? -2 : 0; }, dmgMin1(u, c) { return c.dt === "pierce"; } };
  P["skeleton-archer"] = { checkMods(u, ctx) { if (ctx.skill === "stealth" && u.t && !u.t.moved) ctx.adv.push("неподвижен"); } };
  P.ghoul = {
    onHitDealt(att, ctx) {
      if (!ctx.melee || !ctx.res.hit || !(ctx.tgt.alive || ctx.tgt.down) || !["claws", "bite", "fist"].includes(ctx.atk.id)) return;
      const t = ctx.tgt; ctx.res.venom = async () => { const sv = await save(t, "con", 8 + att.pb + amod(att.abil.con), "Трупный яд"); if (!sv.ok) { addStatus(t, "noheal", { k: Infinity, data: { endAtStartOf: att.id } }); ui() && ui().fxText(t, "не лечится", "bad"); } };
    },
    async afterAttack(att, ctx) { if (ctx.res && ctx.res.venom) await ctx.res.venom(); },
  };
  P["living-stone"] = { checkMods(u, ctx) { if (ctx.tags.some(t => ["grapple", "shove"].includes(t))) ctx.adv.push("недвижимый"); }, saveMods(u, ctx) { if (ctx.tags.some(t => ["prone", "grapple", "shove"].includes(t))) ctx.adv.push("недвижимый"); } };
  P.pixie = {
    turnEnd(u) { if (u.t && u.t.moved >= 2) { addStatus(u, "flicker", { k: 1, when: "start" }); ui() && ui().fxText(u, "мерцание", "good"); } },
  };
  P.wisp = {
    actions(u) {
      const lit = has(u, "lit");
      return [{ id: "wisplight", cat: "skill", label: lit ? "Погасить свет" : "Излучать свет", ico: "torch", sub: "свободное действие · тусклый свет 3 м", time: "free", enabled: true, run: async () => { if (lit) removeStatus(u, "lit"); else addStatus(u, "lit", { k: Infinity }); ui() && ui().refresh(); return true; } }];
    },
  };
  P["green-boulder"] = {
    turnStart(u) { if (u.hp >= 1 && u.hp <= u.maxHp / 2 && alive(u)) { log(`${u.name}: мох затягивает рану.`); B.heal(u, 1, u); } },
  };
  /* ----- тела монстров ----- */
  P["body:stone-guardian"] = { dmgFlat(u, c) { const w = c.o && c.o.ctx && c.o.ctx.atk && c.o.ctx.atk.w; return c.dt === "bludgeon" && w && ["mace", "warhammer"].includes(w.id) ? 2 : 0; } };
  P["body:living-stone"] = {
    defendMods(tgt, ctx) {
      const f = tgt.facing; if (!f) return;
      const vx = ctx.att.x - tgt.x, vy = ctx.att.y - tgt.y;
      if (vx * f[0] + vy * f[1] < 0 && ctx.d0 <= 1) { ctx.extra.push({ n: 1, s: 6, b: 0, dt: ctx.atk.dt, label: "Трещина в спине", critDouble: true }); ctx.notes.push("удар в спину"); }
    },
  };
  P["body:green-boulder"] = {
    turnStart(u) { for (const [dx, dy] of B.DIRS) { const x = u.x + dx, y = u.y + dy; if (B.inB(x, y) && !B.S.cells[y][x] && !B.occupant(x, y)) B.S.cells[y][x] = "moss"; } ui() && ui().refresh(); },
  };
  /* ----- расы ----- */
  P["race:barbarian"] = { saveMods(u, ctx) { if (ctx.tags.includes("frightened") || ctx.tags.includes("charm")) ctx.adv.push("дух воина"); } };
  P["race:beastkin"] = { saveMods(u, ctx) { if (ctx.tags.includes("sound")) ctx.dis.push("острые чувства"); } };


  // Чувства из эссенций и тела: слепое зрение, чувство вибрации.
  // Время активки: фабрики (saveArea, attackRider…) его не задают — берём из текста эссенции, иначе активка не тратила бы действие.
  B.fillActiveTimes = function () {
    for (const id of Object.keys(B.A)) {
      const A = B.A[id]; if (A.time) continue;
      const t = (ESSENCES[id] && ESSENCES[id].active && ESSENCES[id].active.time) || "";
      A.time = /^бонус/.test(t) ? "bonus" : /^реакц/.test(t) ? "reaction" : /^свобод/.test(t) ? "free" : "action";
    }
  };
  B.fillActiveTimes();
  B.isShieldHolder = isShieldHolder;
  B.ess = { atkFor, attackRider, saveArea, dashLines, dashVictims, specUnit, within, around, cellsAround, durEnd, save, dcOf, isShieldHolder };
  B.initUnit = function (u) {
    if (u.ess.includes("bat")) u.blind = Math.max(u.blind || 0, 2);
    if (u.ess.includes("stone-guardian")) u.tremor = Math.max(u.tremor || 0, 2);
  };
  // Реакция по запросу игроку (окно «Реакция»); у монстров — всегда согласие.
  B.promptReaction = async function (o) {
    const g = ui(); if (!g) return true;
    const who = o.unit ? (typeof o.unit === "string" ? B.byId(o.unit) : o.unit) : null, c = who && B.netCtl ? B.netCtl(who) : null;
    if (c === "remote") return B.Net.remoteReact(who, o);                           // игрок онлайн отвечает на своём телефоне
    if (c === "auto" && B.Net && B.Net.isClient()) return false;                     // чужой герой во время хода другого игрока (или игрок не в сети): реакцию не предлагаем
    return g.promptReaction(o);
  };
  B.promptOpportunity = async function (hero, mover) {
    const atk = B.meleeAttackOf(hero); if (!atk) return false;
    const g = ui(); if (!g) return true;
    return B.promptReaction({ title: "Атака по возможности", text: `${mover.name} покидает досягаемость ${hero.name}. Ударить? (${atk.n})`, yes: "Ударить", no: "Пропустить", unit: hero });
  };
})();
