/* Тактический бой: эссенции 2 этажа (Лес гоблинов, Волчья чаща, Могильник белой пыли). B.P — пассивки (хуки), B.A — активные способности.
   Тексты и числа — ../campaign/rules.md, перезарядки — D.essCd (battle-data.js), допущения и вопросы автору — ../campaign/drafts.md.
   Общая механика (призванные существа, зоны, концентрация, тела, перенаправление атак) — battle-ext.js. См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const { roll, amod, sg, log, dist, distCell, footprint, alive, live, enemiesOf, alliesOf, has, addStatus, removeStatus, speedOf, canAct, fmtDice } = B;
  const { atkFor, attackRider, saveArea, specUnit, within, around, cellsAround, durEnd, save, dcOf } = B.ess;
  const A = B.A, P = B.P;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const fx = (u, text, cls) => { const g = ui(); if (g) g.fxText(u, text, cls || ""); };
  const manual = u => B.ctlOf(u) === "ui" && !!ui();                                  // выбор делает игрок (иначе — игра, как у монстров и в авто-бое)
  const TMP = u => ({ size: 1, side: u.side, id: "tmp" });                            // пробная фигура для поиска свободных клеток
  const bonusMana = id => ESSENCES[id].active.mana;

  /* ===== общие помощники ===== */
  // Выбор одной цели из списка: игрок нажимает на поле, иначе берём самую раненую.
  async function chooseTarget(u, ts, prompt, kind) {
    if (!ts.length) return null;
    if (ts.length === 1) return ts[0];
    if (manual(u)) { const t = await B.UI.pickUnit({ prompt, units: ts.map(x => x.id), cells: [], kind: kind || "attack" }); if (t) return t; }
    return ts.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  }
  // Перемещение по свободной клетке на часть скорости. Игрок выбирает клетку, игра — сама (o.auto(cells) → клетка). Возвращает true, если сдвинулись.
  async function stepMove(u, budget, o = {}) {
    if (budget <= 0 || !canAct(u) || speedOf(u) <= 0) return false;                      // опутанный или схваченный не двигается
    const map = B.pathMap(u, budget, {});
    const cells = [...map.values()].filter(v => (v.x !== u.x || v.y !== u.y) && B.canStand(u, v.x, v.y));
    if (!cells.length) return false;
    let dest = null;
    if (manual(u)) {
      const ch = await B.UI.pickCell({ prompt: o.prompt || "Перемещение (без атак по возможности)", cells: cells.map(v => [v.x, v.y]), kind: "move", path: map, optional: true });
      if (Array.isArray(ch)) dest = { x: ch[0], y: ch[1] };
    } else if (o.auto) dest = o.auto(cells);
    if (!dest) return false;
    const r = await B.moveAlong(u, B.pathTo(map, dest.x, dest.y), { noProvoke: o.provoke ? false : true });
    u.t.moved += r.spent;                                                                    // перемещение способностью — сверх обычного (решение автора), обычное не тратится
    return r.spent > 0;
  }
  // Клетка, дальше всего от врагов (для отхода ИИ), с небольшой любовью к укрытиям.
  function farthestSpot(u, cells) {
    const es = enemiesOf(u); if (!es.length) return null;
    let best = null;
    for (const v of cells) {
      const ghost = { ...u, x: v.x, y: v.y };
      const sc = Math.min(...es.map(e => dist(e, ghost))) * 2 + (B.hideSpot(ghost) ? 1.5 : 0) - (B.tinfo(v.x, v.y) && B.tinfo(v.x, v.y).hazard ? 9 : 0) - v.cost * 0.05;
      if (!best || sc > best.sc) best = { v, sc };
    }
    return best ? best.v : null;
  }
  // Лучшая клетка рядом с врагом для атаки (для ИИ): ближе к цели, чем сейчас.
  function nearestToFoe(u, cells) {
    const es = enemiesOf(u).filter(e => !has(e, "underground")); if (!es.length) return null;
    const cur = Math.min(...es.map(e => dist(e, u)));
    let best = null;
    for (const v of cells) {
      const ghost = { ...u, x: v.x, y: v.y }, dd = Math.min(...es.map(e => dist(e, ghost)));
      const sc = -dd * 2 - v.cost * 0.1 - (B.tinfo(v.x, v.y) && B.tinfo(v.x, v.y).hazard ? 9 : 0);
      if (dd < cur && (!best || sc > best.sc)) best = { v, sc };
    }
    return best ? best.v : null;
  }
  // «Обманут»: следующая атака и следующая проверка Восприятия или Проницательности — с помехой (rules.md → «Ключевые слова сборок»).
  function fool(t, by, o = {}) {
    if (!alive(t)) return;
    const st = addStatus(t, "fooled", { k: o.k || 1, when: "end", data: { by: by ? by.id : null, atkUsed: false, chkUsed: false, ...(o.data || {}) } });
    if (st) fx(t, "обманут", "bad");
  }
  B.fool = fool;
  // Прямые линии для рывков: клетки по прямой (8 направлений) на скорость юнита с учётом стоимости местности. Сквозь существ и препятствия не пройти.
  function straightLines(u) {
    const out = [], sp = speedOf(u);
    for (const [dx, dy] of B.DIRS) {
      const path = []; let cost = 0;
      for (let i = 1; i <= sp; i++) {
        const x = u.x + dx * i, y = u.y + dy * i;
        if (!B.inB(x, y) || !B.canPass(u, x, y, {}) || B.occupant(x, y, u)) break;
        cost += B.stepCost(u, x, y); if (cost > sp) break;
        path.push([x, y]); out.push({ end: [x, y], path: path.slice(), cost });
      }
    }
    return out;
  }
  // Рывок с атакой («Рывок с тараном», «Пике», «Рывок мертвеца»): движение по прямой на скорость, затем рукопашная атака подходящим оружием.
  // cfg: name, dt (тип урона оружия), weapon, pred(атака, юнит), need (текст, если оружия нет), noProvoke, extra {n,s}, abil/save/onFail/onOk, afterHit(u, res).
  function charge(cfg) {
    const atkOf = u => { const a = atkFor(u, "melee", cfg.dt, cfg.weapon !== false); return a && (!cfg.pred || cfg.pred(a, u)) ? a : null; };
    const lines = u => {
      const a = atkOf(u); if (!a || speedOf(u) <= 0) return [];
      return straightLines(u).filter(l => enemiesOf(u).some(e => !has(e, "underground") && dist(u, e, l.end[0], l.end[1]) <= (a.reach || 1)));
    };
    return {
      time: "action",
      tgt(u) { const ls = lines(u); return { type: "cell", prompt: `${cfg.name}: выберите, докуда бежать по прямой`, cells: ls.map(l => l.end), kind: "move", lines: ls }; },
      can(u) { if (!atkOf(u)) return cfg.need; if (speedOf(u) <= 0) return "скорость 0"; return lines(u).length ? true : "нет цели на прямой"; },
      async run(u, pk, ctl) {
        const a = atkOf(u); if (!a) return false;
        const line = lines(u).find(l => l.end[0] === pk.cell[0] && l.end[1] === pk.cell[1]); if (!line) return false;
        ctl.commit();
        const mv = await B.moveAlong(u, line.path, { noProvoke: !!cfg.noProvoke });
        u.t.moved += mv.spent;
        if (!alive(u) || u.down || !canAct(u)) return true;
        const ts = B.attackTargets(u, a); if (!ts.length) { log(`${u.name} добегает, но цели рядом нет.`); return true; }
        const tgt = await chooseTarget(u, ts, `${cfg.name}: кого бить?`);
        const extra = cfg.extra ? [{ n: cfg.extra.n, s: cfg.extra.s, b: 0, dt: a.dt, label: cfg.extra.label || cfg.name, critDouble: true }] : null;
        const dc = cfg.abil ? dcOf(u, cfg.abil) : 0;
        const res = await B.doAttack(u, tgt, a, { extra, cancelable: false, onCommit: () => B.commitAttack(u, a, tgt, { free: true }), rider: async r => {
          const t = r.tgt; if (!alive(t) && !t.down) return;
          if (cfg.save) { const sv = await save(t, cfg.save, dc, cfg.name, cfg.tags, u); if (!sv.ok) await cfg.onFail(t, u, sv, r); else if (cfg.onOk) await cfg.onOk(t, u, sv, r); }
          else if (cfg.onHit) await cfg.onHit(t, u, r);
        } });
        if (cfg.afterHit) await cfg.afterHit(u, res);
        return true;
      },
      ai(u) {
        const a = atkOf(u); if (!a) return null;
        let best = null;
        for (const l of lines(u)) {
          const ghost = { ...u, x: l.end[0], y: l.end[1] };
          for (const t of enemiesOf(u)) {
            if (has(t, "underground") || dist(ghost, t) > (a.reach || 1)) continue;
            const sc = B.AI.scoreAttack(ghost, a, t, B.AI.profileOf(u)) + (cfg.extra ? cfg.extra.n * (cfg.extra.s + 1) / 2 : 0) + 2;
            if (!best || sc > best.score) best = { cell: l.end, score: sc };
          }
        }
        return best;
      },
    };
  }
  // Сеть и паутина: спасбросок, провал — опутан (скорость 0, атаки по нему с преимуществом, его — с помехой). Освободиться: действие и проверка Силы или 5 урона по путам.
  function netAbility(cfg) {
    const targets = u => enemiesOf(u).filter(t => t.size <= 2 && !has(t, "underground") && !has(t, "restrained") && dist(u, t) <= cfg.far && !B.lineBlocked(u, t));
    return {
      time: "action",
      tgt(u) { return specUnit(u, `${cfg.name}: на кого?`, targets(u), B.cellsWithin(u, cfg.far), "debuff"); },
      can(u) { return targets(u).length ? true : "нет подходящих целей"; },
      async run(u, pk, ctl) {
        ctl.commit(); const t = pk.unit, dc = dcOf(u, cfg.abil);
        const adv = cfg.near != null && dist(u, t) > cfg.near ? ["издали бросать трудно"] : [];          // «3/9 м»: дальше первого числа цель спасается с преимуществом
        const sv = await B.doSave(t, cfg.save, dc, { label: cfg.name, tags: ["net"], adv, from: u });
        if (!sv.ok) { addStatus(t, "restrained", { k: Infinity, data: { dc, by: u.id, net: { hp: 5, web: !!cfg.web }, web: !!cfg.web } }); log(`${t.name} опутан: ${cfg.web ? "паутина" : "сеть"}.`, "skill"); fx(t, "опутан", "bad"); }
        else if (cfg.slowOnOk) { addStatus(t, "slowed", { k: 1, when: "end", data: { mult: 0.5 } }); fx(t, "замедлен", "bad"); }
        return true;
      },
      ai(u) {
        const ts = targets(u); if (!ts.length) return null;
        const t = ts.sort((a, b) => B.avgDice((B.attacksOf(b)[0] || { dmg: { n: 0, s: 0, b: 0 } }).dmg) - B.avgDice((B.attacksOf(a)[0] || { dmg: { n: 0, s: 0, b: 0 } }).dmg))[0];
        return { unit: t, score: 3.5 };
      },
    };
  }
  // Яма, топь: клетка с водой или грязью.
  const inWater = u => { const t = B.tinfo(u.x, u.y); return !!(t && t.wet) || B.terrain(u.x, u.y) === "mud"; };
  const soilHere = () => !!(D.zones[B.S.zone] && D.zones[B.S.zone].soil);
  const bodiesNear = u => (B.S.bodies || []).filter(b => !b.eaten && distCell(u, b.x, b.y) <= 1);
  const weaponAttacks = a => B.attacksOf(a).filter(x => !x.offhand && !x.thrown && x.id !== "torchhit" && !(a.hero && x.id === "fist"));

  /* ================================================================== */
  /*                         ЛЕС ГОБЛИНОВ (11)                          */
  /* ================================================================== */

  /* ----- Гоблин-шаман (9): «Под защитой духов», «Целебный наговор» ----- */
  P["goblin-shaman"] = {
    // «Знаток трав» (решение автора): преимущество и 2–3 штуки при сборе трав и грибов, опознаёт их (battle-env.js, findKnown в index.html); боевых хуков нет          // два шамана рядом не складываются
  };
  const healables = u => live().filter(t => dist(u, t) <= 6 && !t.dead && !t.fled && !has(t, "underground") && !B.lineBlocked(u, t) && (t.hp < t.maxHp || t.down) && (t.side === u.side || t.id === u.id) && (t.id === u.id || B.canSeeUnit(u, t)));          // «которое ты видишь»
  A["goblin-shaman"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Целебный наговор: кого лечить?", healables(u), B.cellsWithin(u, 6), "heal"); },
    can(u) { return healables(u).length ? true : "некого лечить"; },
    async run(u, pk, ctl) {
      const t = pk.unit, bonus = amod(u.abil.wis);
      const ses = B.session(u, { kind: "heal", u, title: "Целебный наговор", sub: `${u.name} → ${t.name}` });
      const r = await ses.dice({ label: `Лечение 1к6${bonus ? " " + sg(bonus) : ""}`, n: 1, s: 6, bonus, heal: true, cancel: true, reroll: B.rerollOptions(u, "heal") });
      if (!r) { ses.close(); return false; }
      ctl.commit();
      const got = B.heal(t, Math.max(0, r.sum + bonus), u);
      await ses.finish({ text: got ? `Восстановлено ${got} ОЗ` : "Лечение не подействовало", heal: true, tgt: t, dmg: got });
      return true;
    },
    ai(u) {
      const ts = healables(u).filter(t => t.down || t.hp <= t.maxHp * 0.7); if (!ts.length) return null;
      const t = ts.sort((a, b) => (a.down ? -1 : 0) - (b.down ? -1 : 0) || a.hp / a.maxHp - b.hp / b.maxHp)[0];
      return { unit: t, score: 3 + (1 - t.hp / t.maxHp) * 4 + (t.down ? 3 : 0) };
    },
  };

  /* ----- Гоблин-ассасин (8): «Нож в спину», «Уход в тень» ----- */
  // Лёгкое оружие — со свойством «Лёгкое» (кинжал; решение автора: ассасин держит максимум два лёгких клинка).
  const lightWeapon = a => a.kind === "melee" && !a.thrown && !a.offhand && a.id !== "fist" && a.id !== "torchhit" && (!a.w || (a.w.props || []).includes("Лёгкое"));          // у героя — только оружие со свойством «Лёгкое» (кинжал); атаки монстров — любые
  P["goblin-assassin"] = {
    attackMods(att, ctx) {
      if (att.cd.stab > 0 || !lightWeapon(ctx.atk)) return;
      const t = ctx.tgt, unaware = ctx.adv.includes("атакует из укрытия") || ctx.adv.includes("цель потеряла вас из виду") || has(t, "blinded") || has(t, "buried");
      if (!unaware) return;
      ctx.extra.push({ n: 1, s: 6, b: 0, dt: ctx.atk.dt, label: "Нож в спину", critDouble: true }); ctx.stab = true;
    },
    attackDone(att, ctx) { if (ctx.stab) { B.setCd(att, "stab", D.stabCd); if (ctx.res.hit) fx(att, "нож в спину", "good"); } },          // «первая атака» — перезарядка идёт и после промаха, и после убийства
  };
  // Клетки для «ухода в тень»: половина скорости; «hideSpot» — рядом укрытие, в котором можно спрятаться.
  const shadowPath = u => { const map = B.pathMap(u, Math.floor(speedOf(u) / 2), {}); return { map, cells: [...map.values()].filter(v => (v.x !== u.x || v.y !== u.y) && B.canStand(u, v.x, v.y)) }; };
  A["goblin-assassin"] = {
    time: "bonus",
    tgt(u) { const sp = shadowPath(u); return { type: "cell", prompt: "Уход в тень: куда (половина скорости, без атак по возможности)", cells: sp.cells.map(v => [v.x, v.y]), kind: "move", path: sp.map, optional: true }; },
    can(u) { return speedOf(u) >= 2 || B.hideSpot(u, { near: true }) ? true : "слишком медленный"; },
    async run(u, pk, ctl) {
      ctl.commit();
      if (pk.cell) { const sp = shadowPath(u), path = B.pathTo(sp.map, pk.cell[0], pk.cell[1]); const r = await B.moveAlong(u, path, { noProvoke: true }); u.t.moved += r.spent; }
      if (alive(u) && !u.down && B.hideSpot(u, { near: true })) await B.hideRoll(u, { seen: true, near: true, cancel: false, toast: false, title: "Уход в тень" });          // укрытие рядом (кусты, деревья, тень); прятаться можно, даже если видели
      else log(`${u.name} уходит в тень, но спрятаться негде.`);
      return true;
    },
    ai(u) {
      if (has(u, "hidden") || !enemiesOf(u).length) return null;
      const sp = shadowPath(u); let best = null;
      for (const v of sp.cells) {
        const ghost = { ...u, x: v.x, y: v.y }; if (!B.hideSpot(ghost, { near: true })) continue;
        const es = enemiesOf(u), sc = Math.min(...es.map(e => dist(e, ghost))) + (B.tinfo(v.x, v.y) && B.tinfo(v.x, v.y).hazard ? -9 : 0);
        if (!best || sc > best.sc) best = { v, sc };
      }
      if (!best) return null;
      const near = enemiesOf(u).filter(e => dist(e, u) <= 1).length;
      return { cell: [best.v.x, best.v.y], score: 2.5 + near * 1.5 };
    },
  };

  /* ----- Гоблин-зверолов (8): «Охотничий глаз», «Ловчая сеть» ----- */
  P["goblin-trapper"] = { trapImmune(u, c) { return c.trap.dc <= 12; } };                 // простые ловушки (Сл не выше 12) не срабатывают; выслеживание вне боя
  A["goblin-trapper"] = netAbility({ name: "Ловчая сеть", abil: "dex", save: "str", near: 2, far: 6, slowOnOk: true });          // успех: скорость вдвое меньше до конца её следующего хода

  /* ----- Главный шаман (8): «Голос старейшины», «Проклятие предков» ----- */
  P["goblin-elder"] = {
    saveAura(a, c) { if (canAct(a) && c.u.id !== a.id && dist(a, c.u) <= 6 && c.ctx.tags.includes("frightened")) c.ctx.adv.push("Голос старейшины"); },
  };
  const curseTargets = u => enemiesOf(u).filter(t => !has(t, "underground") && !has(t, "cursed") && !B.lineBlocked(u, t));
  A["goblin-elder"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Проклятие предков: на кого?", curseTargets(u), B.cellsWithin(u, 12), "debuff"); },
    can(u) { return curseTargets(u).length ? true : "нет подходящих целей"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit, dc = dcOf(u, "wis");
      const sv = await B.doSave(t, "wis", dc, { label: "Проклятие предков", tags: ["curse"], from: u });
      if (sv.ok) { fx(t, "устоял", ""); return true; }
      addStatus(t, "cursed", { k: Infinity, data: { dc, by: u.id } }); fx(t, "проклят", "bad"); log(`${t.name} проклят предками.`, "skill");
      B.startConc(u, "goblin-elder", why => {
        const c = has(t, "cursed"); if (c && c.data.by === u.id) removeStatus(t, "cursed");
        B.setCd(u, "goblin-elder", D.essCd["goblin-elder"]); log(`Проклятие на ${t.name} спадает (${why}).`);          // перезарядка идёт после окончания проклятия
      });
      u.conc.target = t.id; u.conc.until = B.S.round + 10; B.setCd(u, "goblin-elder", 999);
      return true;
    },
    state(u) { return u.conc && u.conc.key === "goblin-elder" ? { why: "проклятие ещё действует", cd: 999 } : { cd: D.essCd["goblin-elder"] }; },
    ready(u) { return u.side === "mon" && u.conc && u.conc.key === "goblin-elder" ? false : null; },
    ai(u) {
      const ts = curseTargets(u); if (!ts.length || (u.conc && u.conc.key === "goblin-elder")) return null;
      const dmg = t => Math.max(0, ...B.attacksOf(t).map(a => B.avgDice(a.dmg)));
      return { unit: ts.sort((a, b) => dmg(b) - dmg(a) || b.hp - a.hp)[0], score: 4.5 };
    },
  };

  /* ----- Хобгоблин-громила (8): «Тяжёлая рука», «Сокрушительный замах» ----- */
  P["hobgoblin-brute"] = {
    onHitDealt(att, ctx) {
      if (!ctx.melee || !ctx.res.hit || ctx.atk.dt !== "bludgeon" || !(ctx.atk.w || att.side === "mon")) return;
      const t = ctx.tgt; if (!t.alive || t.down || t.size > 1) return;                      // Средний размер или меньше
      ctx.res.post.push(async () => { if (!alive(t) || t.down) return; const n = await B.push(t, att.x, att.y, 1); if (n) { log(`${att.name} отталкивает ${t.name}.`); fx(t, "отброшен", "bad"); } });
    },
  };
  A["hobgoblin-brute"] = attackRider({ name: "Сокрушительный замах", kind: "melee", dt: "bludgeon", weapon: true, weaponText: "нужно дробящее оружие", abil: "str", save: "str", aiBonus: 3.5,
    onFail: async (t, u, sv, res) => {
      const r = roll(res.crit ? 2 : 1, 8).total; log(`Сокрушительный замах: +${r} урона, ${t.name} сбит с ног.`, "skill");
      await B.applyDamage(u, t, [{ v: r, dt: res.atk.dt, label: "Сокрушительный замах" }], { skill: true });
      if (alive(t) || t.down) { B.knock(t, u); fx(t, "сбит с ног", "bad"); }
    } });

  /* ----- Хобгоблин-метатель (8): «Полная перевязь», «Двойной бросок» ----- */
  // Метание из рюкзака, +1 урона и дальность +3 м реализованы в battle-act.js (atkFrom, heroAttacks); здесь — «Двойной бросок».
  P["hobgoblin-thrower"] = {};
  const throwPair = u => B.throwEntries(u).sort((a, b) => B.avgDice(b.dmg) - B.avgDice(a.dmg)).slice(0, 2);
  const throwTargets = u => { const pair = throwPair(u); return enemiesOf(u).filter(t => !has(t, "underground") && pair.some(a => B.inAttackRange(u, t, a))); };
  A["hobgoblin-thrower"] = {
    time: "action",
    tgt(u) { const ts = throwTargets(u), maxR = Math.max(...throwPair(u).map(a => a.range[1])); return { type: "units", prompt: "Двойной бросок: одна цель (оба броска в неё) или две", units: ts.map(x => x.id), cells: B.cellsWithin(u, maxR), min: 1, max: 2, kind: "attack" }; },
    can(u) { if (throwPair(u).length < 2) return "нужно два метательных оружия"; return throwTargets(u).length ? true : "нет целей"; },
    async run(u, pk, ctl) {
      const pair = throwPair(u); if (pair.length < 2) return false;
      const ts = (pk.units || []).filter(t => alive(t)); if (!ts.length) return false;
      let started = false;
      for (let i = 0; i < 2; i++) {
        let atk = pair[i], t = ts.length > 1 ? ts[i] : ts[0];
        if (!alive(t) && !t.down) {                                                      // цель пала от первого броска — второй летит в новую цель, выбранную в момент броска
          const left = enemiesOf(u).filter(x => !has(x, "underground") && (alive(x) || x.down) && B.inAttackRange(u, x, atk));
          t = left.length ? await chooseTarget(u, left, "Двойной бросок: цель пала — кого теперь?", "attack") : null;
          if (!t) { log(`${u.name}: цель уже пала, бросок пропадает.`); continue; }
        }
        if (!B.inAttackRange(u, t, atk)) { const other = pair[1 - i]; if (other && !other.used && B.inAttackRange(u, t, other)) atk = other; else { log(`${u.name}: до ${t.name} не добросить.`); continue; } }
        atk.used = true;
        const r = await B.doAttack(u, t, atk, { cancelable: !started, onCommit: () => { B.commitAttack(u, atk, t, { free: true }); if (!started) { started = true; ctl.commit(); } } });
        if (r.cancelled) return false;
        if (!alive(u) || u.down) break;
      }
      return started;
    },
    ai(u) {
      const pair = throwPair(u), ts = throwTargets(u); if (pair.length < 2 || !ts.length) return null;
      const pr = B.AI.profileOf(u), best = ts.map(t => ({ t, s: pair.reduce((a, k) => a + (B.inAttackRange(u, t, k) ? B.AI.scoreAttack(u, k, t, pr) : 0), 0) })).sort((a, b) => b.s - a.s)[0];
      return { units: [best.t], score: best.s * 0.6 + 1 };
    },
  };

  /* ----- Хобгоблин-загонщик (8): «Длинная рука», «Подгонять» ----- */
  P["hobgoblin-driver"] = {};                                                            // досягаемость кнута и цепа +1,5 м — в battle-act.js (longArm)
  // Куда лучше всего встать союзнику (в пределах cells), чтобы потом ударить: ИИ-выбор клетки.
  function bestSpot(a, cells) {
    const AI = B.AI, pr = AI.profileOf(a), atks = weaponAttacks(a), ox = a.x, oy = a.y; let best = null;
    for (const c of [{ x: ox, y: oy, cost: 0 }, ...cells].filter(c => !has(a, "frightened") || !B.frightenOK || B.frightenOK(a, c.x, c.y))) {          // испуганный не подходит к тому, кого боится
      a.x = c.x; a.y = c.y; let sc = -c.cost * 0.05;
      for (const atk of atks) for (const t of B.attackTargets(a, atk)) sc = Math.max(sc, AI.scoreAttack(a, atk, t, pr) - c.cost * 0.05);
      if (!best || sc > best.sc) best = { c, sc };
    }
    a.x = ox; a.y = oy;
    return best;
  }
  const drivable = u => alliesOf(u).filter(a => canAct(a) && a.t && a.t.react > 0 && dist(u, a) <= 6 && !has(a, "underground") && weaponAttacks(a).length);
  A["hobgoblin-driver"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Подгонять: кого?", drivable(u), B.cellsWithin(u, 6), "help"); },
    can(u) { return drivable(u).length ? true : "некого подгонять (нужен союзник с реакцией и оружием)"; },
    async run(u, pk, ctl) {
      const a = pk.unit; ctl.commit();
      log(`${u.name} подгоняет ${a.name}!`, "skill"); const g = ui(); if (g) g.banner(`${u.name} подгоняет ${a.name}!`);
      const budget = Math.floor(speedOf(a) / 2);
      if (budget > 0) {                                                                   // 1) перемещение на половину скорости (обычное, с атаками по возможности)
        const map = B.pathMap(a, budget, {}), cells = new Map();
        for (const [k, v] of map) if ((v.x !== a.x || v.y !== a.y) && B.canStand(a, v.x, v.y)) cells.set(k, v);
        let dest = null;
        if (cells.size) {
          if (manual(a)) { const ch = await B.UI.pickMove({ unit: a, cells, standCost: 0, budget }); if (ch && !ch.stay && ch.x != null) dest = ch; }
          else { const b = bestSpot(a, [...cells.values()]); if (b && (b.c.x !== a.x || b.c.y !== a.y)) dest = b.c; }
        }
        if (dest) await B.moveAlong(a, dest.path || B.pathTo(map, dest.x, dest.y));          // игрок мог проложить путь точками
      }
      if (!alive(a) || a.down || !canAct(a) || !(a.t.react > 0)) return true;           // 2) реакцией — одна атака оружием
      const atks = weaponAttacks(a).filter(x => B.attackTargets(a, x).length);
      if (!atks.length) { log(`${a.name} не дотягивается до врагов.`); return true; }
      let atk = atks[0];
      if (manual(a) && atks.length > 1) { const ch = await B.UI.choose({ title: `${a.name}: чем бить?`, options: atks.map(x => ({ id: x.id, label: x.n })) }); if (ch) atk = atks.find(x => x.id === ch) || atk; }
      const tgt = await chooseTarget(a, B.attackTargets(a, atk), `${a.name}: кого бить?`);
      a.t.react = 0;
      await B.doAttack(a, tgt, atk, { reaction: true, cancelable: false, onCommit: () => { if (a.hero) B.commitAttack(a, atk, tgt, { free: true }); } });
      return true;
    },
    ai(u) {
      let best = null;
      for (const a of drivable(u)) {
        const map = B.pathMap(a, Math.floor(speedOf(a) / 2), {}), cells = [...map.values()].filter(v => (v.x !== a.x || v.y !== a.y) && B.canStand(a, v.x, v.y)), b = bestSpot(a, cells);
        if (b && b.sc > 0 && (!best || b.sc > best.sc)) best = { a, sc: b.sc };
      }
      return best ? { unit: best.a, score: 2.5 + best.sc * 0.5 } : null;
    },
  };

  /* ----- Хобгоблин-щитоносец (8): «Живая стена», «Принять удар» ----- */
  // «Живая стена»: половинное укрытие союзникам позади — в B.wallCover (battle-ext.js), учтено в КД и в спасбросках Ловкости.
  P["hobgoblin-shield"] = {
    async redirectAlly(a, c) {
      const eb = ESSENCES["hobgoblin-shield"].active;
      if (!canAct(a) || !(a.t.react > 0) || dist(a, c.tgt) > 1) return null;
      if (a.side === "hero") {
        if (a.mp < eb.mana || a.cd["hobgoblin-shield"] > 0) return null;
        if (!(await B.promptReaction({ title: "Принять удар", text: `${c.att.name} атакует ${c.tgt.name}. Принять удар на себя? (${eb.mana} маны)` }))) return null;
        B.setMp(a, a.mp - eb.mana); B.setCd(a, "hobgoblin-shield", D.essCd["hobgoblin-shield"]);
      } else { if (a.used["hobgoblin-shield"]) return null; a.used["hobgoblin-shield"] = true; }
      a.t.react = 0;
      log(`${a.name} принимает удар вместо ${c.tgt.name}!`, "skill"); const g = ui(); if (g) g.banner(`${a.name} принимает удар!`);
      if (B.hasTowerShield(a)) c.o.reduce = { dice: "1к6", label: "ростовой щит" };
      return a;
    },
  };
  A["hobgoblin-shield"] = { time: "reaction", reaction: true, ai() { return null; }, tgt() { return { type: "self" }; }, run: async () => false };

  /* ----- Король гоблинов (7): «Пока король жив», «Боевой рёв» ----- */
  P["goblin-king"] = {
    immuneAura(k, c) { return c.id === "frightened" && canAct(k) && c.u.id !== k.id && dist(k, c.u) <= 12 && !B.lineBlocked(k, c.u); },
    attackAura(k, c) { if (canAct(k) && c.att.id !== k.id && dist(k, c.att) <= 12 && !B.lineBlocked(k, c.att) && !c.ctx.mods.some(m => m.l === "Пока король жив")) c.ctx.mods.push({ l: "Пока король жив", v: 1 }); },          // два короля не складываются
  };
  const roarPool = u => live().filter(o => o.id !== u.id && dist(u, o) <= 6 && !o.dead && !has(o, "underground"));
  A["goblin-king"] = {
    time: "bonus",
    tgt(u) { return { type: "units", prompt: "Боевой рёв: выберите существ в 9 м (враги пугаются, союзники получают временные ОЗ)", units: roarPool(u).map(x => x.id), cells: cellsAround(u, 6), min: 1, max: 9, kind: "area" }; },
    can(u) { return roarPool(u).length ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      const ts = (pk.units || []).filter(t => alive(t)); if (!ts.length) return false;
      ctl.commit(); const g = ui(); if (g) g.banner(`${u.name}: Боевой рёв!`);
      const dc = dcOf(u, "cha");
      const foes = ts.filter(t => t.side !== u.side), fsv = foes.length ? await B.massSave(foes, "wis", dc, { label: "Боевой рёв", title: "Боевой рёв", tags: ["frightened"], from: u }) : [];
      for (const t of ts) {
        if (t.side === u.side) { const r = roll(1, 6).total; if (r > (t.temp || 0)) { t.temp = r; t.tempSrc = "roar"; } addStatus(t, "roar", { k: Infinity, data: durEnd(u, 1) }); log(`${t.name}: ${r} временных ОЗ.`, "good"); fx(t, `+${r} врем. ОЗ`, "good"); }
        else { const sv = fsv[foes.indexOf(t)]; if (!sv.ok) { if (addStatus(t, "frightened", { k: Infinity, data: { by: u.id, ...durEnd(u, 1) } })) fx(t, "испуган", "bad"); } }
      }
      return true;
    },
    ai(u) {
      const pool = roarPool(u), foes = pool.filter(t => t.side !== u.side), friends = pool.filter(t => t.side === u.side && !t.down);
      if (!foes.length) return null;
      return { units: pool.filter(t => !t.down || t.side !== u.side), score: 1.5 + foes.length * 2 + friends.length * 0.8 };
    },
  };

  /* ----- Гоблин-подрывник (8→7): «Свои не горят», «Самодельная бомба» ----- */
  // Сфера радиусом 3 м = 2 клетки вокруг центра. Огонь по рою паучат уничтожает его.
  const BOMB_R = 2;
  const bombVictims = (cx, cy) => live().filter(x => !has(x, "underground") && distCell(x, cx, cy) <= BOMB_R);
  async function bombRoll(u, title) {
    const bonus = B.hookSum(u, "abilityDmg", { dt: "fire" });
    const ses = B.session(u, { kind: "damage", u, title, sub: `${u.name}: 3к6 огнём${bonus ? ` ${sg(bonus)}` : ""}` });
    const r = await ses.dice({ label: `Урон 3к6${bonus ? " " + sg(bonus) : ""}`, n: 3, s: 6, bonus, dt: "fire", cancel: false, reroll: B.rerollOptions(u, "damage", { melee: false }) });
    const total = r.sum + bonus; await ses.finish({ text: `${total} урона огнём`, anim: "fire", dmg: total, tgt: u });
    return total;
  }
  // Взрыв: cx, cy — центр, inHands — взорвалась в руках подрывника (он получает полный урон без спасброска).
  async function bombBlast(u, cx, cy, inHands) {
    const g = ui(); if (g) g.banner(inHands ? `${u.name}: бомба рвётся в руках!` : `${u.name}: бомба!`);
    log(inHands ? `${u.name}: бомба взрывается в руках!` : `Самодельная бомба взрывается в клетке ${cx + 1}:${cy + 1}.`, "skill");
    const total = await bombRoll(u, "Самодельная бомба"), dc = dcOf(u, "dex");
    const cells = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= BOMB_R) cells.push([x, y]);
    if (B.fireAtCells) B.fireAtCells(cells);
    if (B.blastCells) { const bc = []; for (let yy = cy - 2; yy <= cy + 2; yy++) for (let xx = cx - 2; xx <= cx + 2; xx++) if (B.inB(xx, yy) && Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) <= 2) bc.push([xx, yy]); B.blastCells(bc, total, "fire", u); }          // взрыв ломает камни и кристаллы
    for (const t of bombVictims(cx, cy)) {
      if (inHands && t.id === u.id) { await B.applyDamage(u, t, [{ v: total, dt: "fire", label: "Бомба в руках" }], { skill: true }); continue; }          // себе — полный урон без спасброска
      const sv = await save(t, "dex", dc, "Самодельная бомба", ["fire"], { x: cx, y: cy, size: 1, id: "blast" });
      await B.applyDamage(u, t, [{ v: sv.ok ? Math.floor(total / 2) : total, dt: "fire", label: "Бомба" }], { skill: true });
      if (!sv.ok && (alive(t) || t.down) && t.id !== u.id) { B.knock(t, u); fx(t, "сбит с ног", "bad"); }
      else if (!sv.ok && t.id === u.id && alive(t)) { B.knock(t, u); }
    }
  }
  P["goblin-bomber"] = {
    abilityDmg(u, c) { return c.dt === "fire" ? 2 : 0; },                                // «Урон огнём от твоих способностей и бомб +2»
    async hitTaken(u, c) { if (c.fused && c.res.hit) { removeStatus(u, "fuse"); await bombBlast(u, u.x, u.y, true); } },          // любое попадание по подрывнику с горящим фитилём
  };
  const bombCenters = () => { const out = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) out.push([x, y]); return out; };
  A["goblin-bomber"] = {
    time: "action",
    state(u) { return has(u, "fuse") ? { label: "Бросить бомбу", mana: 0, cd: 1, note: "фитиль горит" } : { label: "Поджечь фитиль", mana: bonusMana("goblin-bomber"), cd: 0, note: "затем бросок в свой следующий ход" }; },
    ready(u) { return has(u, "fuse") ? B.timeOK(u, "action") : null; },
    tgt(u) { return has(u, "fuse") ? { type: "cell", prompt: "Самодельная бомба: центр взрыва (радиус 3 м)", cells: bombCenters(u), kind: "trap", radius: BOMB_R } : { type: "self" }; },
    can() { return true; },
    async run(u, pk, ctl) {
      ctl.commit();
      if (!has(u, "fuse")) { addStatus(u, "fuse", { k: Infinity }); log(`${u.name} поджигает фитиль самодельной бомбы.`, "skill"); fx(u, "фитиль горит", "bad"); return true; }
      // бросок: сначала к20 — на 1–2 бомба рвётся в руках
      const ses = B.session(u, { kind: "check", u, title: "Нестабильная смесь", sub: `${u.name}: на 1–2 бомба рвётся в руках` });
      const r = await ses.d20({ label: "к20: на 1–2 бомба рвётся в руках", mods: [], adv: [], dis: [], vs: null, reroll: B.rerollOptions(u, "check"), cancel: false });
      const boom = r.nat <= 2;
      await ses.finish({ text: boom ? "Фитиль не выдержал!" : "Бомба летит", save: true, ok: !boom });
      removeStatus(u, "fuse");
      if (boom) await bombBlast(u, u.x, u.y, true); else await bombBlast(u, pk.cell[0], pk.cell[1], false);
      return true;
    },
    ai(u) {
      if (!has(u, "fuse")) { const es = enemiesOf(u).filter(e => dist(e, u) <= 6); return es.length ? { score: 2.5 + es.length * 0.5 } : null; }
      let best = null;
      for (const [x, y] of bombCenters(u)) {
        const vs = bombVictims(x, y), foes = vs.filter(t => t.side !== u.side), mine = vs.filter(t => t.side === u.side);
        const sc = foes.length * 3 + foes.filter(t => t.hp < t.maxHp / 2).length - mine.length * 4;
        if (foes.length && (!best || sc > best.score)) best = { cell: [x, y], score: sc };
      }
      return best && best.score >= 2 ? best : null;
    },
  };

  /* ----- Гоблин-вор (7): «Лёгкие ноги» и «Жадность», «Срезать кошель» ----- */
  const lootNames = ["ration", "potion", "torch"];
  P["goblin-thief"] = {
    speedBonus() { return 1; },                                                          // «Лёгкие ноги»: скорость +1,5 м
    // «Жадность»: в начале хода рядом лежит выпавшее оружие — спасбросок Мудрости Сл 12, провал: всё перемещение и действие уходят на то, чтобы это схватить.
    async turnStartAsync(u) {
      if (!canAct(u)) return;
      const items = B.S.drops.filter(w => w.kind === "weapon" && !w.holder && distCell(u, w.x, w.y) <= 2);
      if (!items.length) return;
      const sv = await B.doSave(u, "wis", 12, { label: "Жадность" });
      if (sv.ok) return;
      log(`${u.name}: жадность берёт верх!`, "bad"); fx(u, "жадность", "bad");
      const w = items.sort((a, b) => distCell(u, a.x, a.y) - distCell(u, b.x, b.y))[0], map = B.pathMap(u, u.t.move, {});
      let best = null;
      for (const v of map.values()) { if (!B.canStand(u, v.x, v.y) && !(v.x === u.x && v.y === u.y)) continue; const dd = Math.max(Math.abs(v.x - w.x), Math.abs(v.y - w.y)); if (!best || dd < best.dd || (dd === best.dd && v.cost < best.v.cost)) best = { v, dd }; }
      if (best && (best.v.x !== u.x || best.v.y !== u.y)) await B.moveAlong(u, B.pathTo(map, best.v.x, best.v.y));
      u.t.move = 0; u.t.action = 0;
      if (alive(u) && !u.down && distCell(u, w.x, w.y) <= 1) { w.holder = u.id; w.x = u.x; w.y = u.y; log(`${u.name} хватает ${((typeof itemOf === "function" && itemOf(w.item)) || { name: "оружие" }).name.toLowerCase()}.`, "skill"); }
    },
  };
  A["goblin-thief"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Срезать кошель: у кого?", within(u, 1), cellsAround(u, 1), "debuff"); },
    can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit;
      const sv = await save(t, "dex", dcOf(u, "dex"), "Срезать кошель", ["steal"], u);
      if (sv.ok) { fx(t, "не вышло", ""); return true; }
      // добыча: у героя — один незакреплённый предмет из рюкзака (зелье, паёк, факел); у монстра предметов нет
      let got = null;
      if (t.hero) {
        const opts = (t.hero.bag || []).filter(e => e.t === "g" && lootNames.includes(e.id));
        if (opts.length) { const e = opts[B.rnd(opts.length)]; if (takeGear(t.hero, e.id, 1)) { got = GEAR[e.id].name.toLowerCase(); (u.loot ||= []).push(e.id); } }
      }
      log(got ? `${u.name} срезает у ${t.name}: ${got}!` : `${u.name} ловко шарит по ${t.name}, но брать нечего.`, "skill"); fx(u, got ? "украл" : "пусто", got ? "good" : "");
      await stepMove(u, Math.floor(speedOf(u) / 2), { prompt: "Срезать кошель: куда отскочить (половина скорости, без атак по возможности)", auto: cells => farthestSpot(u, cells) });
      return true;
    },
    ai(u) { const ts = within(u, 1); if (!ts.length) return null; return { unit: ts[0], score: 3 }; },
  };

  /* ================================================================== */
  /*                         ВОЛЧЬЯ ЧАЩА (11)                           */
  /* ================================================================== */

  /* ----- Рогатый заяц (9): «Петляет», «Рывок с тараном» ----- */
  P["horned-hare"] = {
    // после рукопашной атаки, перед которой пробежал по прямой не меньше 6 м (4 клетки), можно отскочить на 3 м (2 клетки) без атак по возможности
    attackDone(u, c) {
      if (!c.melee || !u.t || u.t.straight < 4 || B.S.curId !== u.id) return;                   // бег перед атакой — в свой ход, не атака по возможности в чужой
      u.t.straight = 0; u.t.sdir = null;
      c.res.post.push(async () => {
        if (!alive(u) || u.down) return;
        const ok = await stepMove(u, 2, { prompt: "Петляет: отскочить на 3 м (без атак по возможности)", auto: cells => farthestSpot(u, cells), free: true });
        if (ok) log(`${u.name} петляет и отскакивает.`, "skill");
      });
    },
  };
  A["horned-hare"] = charge({ name: "Рывок с тараном", dt: "pierce", need: "нужно колющее оружие (копьё, пика)", noProvoke: false, extra: { n: 1, s: 6, label: "Таран" }, abil: "dex", save: "con", tags: ["bleed"],
    onFail: async (t, u) => { addStatus(t, "bleeding", { k: 10, when: "end", src: u.id, data: { dice: "1к4" } }); log(`${t.name} истекает кровью.`, "skill"); fx(t, "кровотечение", "bad"); } });

  /* ----- Болотная жаба (9): «Скользкая кожа», «Липкий язык» ----- */
  P["swamp-toad"] = {
    checkMods(u, c) { if (c.tags.includes("grapple")) c.adv.push("Скользкая кожа"); if (c.skill === "stealth" && inWater(u)) c.mods.push({ l: "Скрытность в топи", v: 1 }); },
    saveMods(u, c) { if (c.tags.includes("grapple")) c.adv.push("Скользкая кожа"); },
  };
  const tongueTargets = u => enemiesOf(u).filter(t => t.size <= 1 && !has(t, "underground") && !has(t, "grappled") && dist(u, t) <= 3 && !B.lineBlocked(u, t));
  A["swamp-toad"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Липкий язык: кого притянуть?", tongueTargets(u), B.cellsWithin(u, 3), "attack"); },
    can(u) { return tongueTargets(u).length ? true : "нет подходящих целей"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit, dc = dcOf(u, "dex");
      const sv = await save(t, "str", dc, "Липкий язык", ["grapple"], u);
      if (sv.ok) return true;
      if (dist(u, t) > 1) await B.pullAdjacent(t, u);
      if (alive(t) && dist(u, t) <= 1) { addStatus(t, "grappled", { k: Infinity, data: { by: u.id, dc } }); log(`${u.name} притягивает ${t.name} языком.`, "skill"); fx(t, "схвачен", "bad"); }
      else log(`${t.name} не удаётся притянуть вплотную.`);
      return true;
    },
    ai(u) { const ts = tongueTargets(u).filter(t => dist(u, t) > 1); if (!ts.length) return null; return { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 3.5 }; },
  };

  /* ----- Потайной землекоп (9): «Ямокоп», «Нырок под землю» ----- */
  P.burrower = {
    passivePerception() { return -5; },                                                  // плохое зрение: помеха на пассивное Восприятие
    checkMods(u, c) { if (c.skill === "perception") c.dis.push("плохое зрение"); },
    attackMods(att, ctx) { if (has(att, "emerged")) { ctx.adv.push("вынырнул из-под земли"); ctx.consume.push([att, "emerged"]); } },
    // Вынырнуть в начале своего хода: клетка в пределах 4,5 м (3 клетки), первая атака — с преимуществом
    async turnStartAsync(u) {
      if (!has(u, "underground")) return;
      removeStatus(u, "underground");
      const cells = B.cellsWithin(u, 3).filter(([x, y]) => B.canStand(u, x, y) && !(B.tinfo(x, y) && B.tinfo(x, y).hazard));
      let dest = null;
      if (cells.length) {
        if (manual(u)) { const ch = await B.UI.pickCell({ prompt: "Вынырнуть: выберите клетку в 4,5 м", cells, kind: "move" }); if (Array.isArray(ch)) dest = ch; }
        if (!dest) {
          const es = enemiesOf(u).filter(e => !has(e, "underground"));
          dest = es.length ? cells.map(c => ({ c, dd: Math.min(...es.map(e => dist(e, { ...u, x: c[0], y: c[1] }))) })).sort((a, b) => a.dd - b.dd)[0].c : cells[0];
        }
      }
      if (dest && (dest[0] !== u.x || dest[1] !== u.y)) await B.teleport(u, dest[0], dest[1]);
      u.t.move = speedOf(u);
      addStatus(u, "emerged", { k: 0, when: "end" }); log(`${u.name} выныривает из-под земли.`, "skill"); fx(u, "вынырнул", "good");          // k: 0 — преимущество только в этот ход
    },
  };
  A.burrower = {
    time: "bonus",
    tgt() { return { type: "self" }; },
    can(u) { if (speedOf(u) <= 0) return "скорость 0: схвачен или опутан"; return soilHere() ? true : "здесь нет рыхлого грунта"; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "underground", { k: Infinity }); log(`${u.name} закапывается.`, "skill"); fx(u, "под землёй", "good"); return true; },
    ai(u) {
      if (!soilHere() || !enemiesOf(u).length) return null;
      const near = enemiesOf(u).filter(e => dist(e, u) <= 2).length;
      return u.hp < u.maxHp * 0.6 || near >= 2 ? { score: 3 } : null;
    },
  };

  /* ----- Ворона (9): «Налёт», «В глаза» ----- */
  P.crow = {
    noProvoke(u) { return !!(u.t && u.t.meleeAttacked); },                               // после рукопашной атаки отход не провоцирует
    attackMods(att, ctx) { if (ctx.melee && has(att, "eyepeck")) { ctx.consume.push([att, "eyepeck"]); ctx.eyepeck = true; } },
    onHitDealt(att, ctx) { if (ctx.eyepeck && ctx.res.hit && (ctx.tgt.alive || ctx.tgt.down)) { if (addStatus(ctx.tgt, "dazzled", { k: 1, when: "end" })) fx(ctx.tgt, "клюнули в глаза", "bad"); } },
  };
  A.crow = {
    time: "bonus",
    tgt() { return { type: "self" }; },
    can(u) { if (has(u, "eyepeck")) return "уже готов"; return B.attacksOf(u).some(a => a.kind === "melee") ? true : "нужна атака ближнего боя"; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "eyepeck", { k: 0, when: "end" }); fx(u, "клюв наготове", "good"); return true; },          // «следующая рукопашная атака в этот ход»
    ai(u) { if (has(u, "eyepeck") || !enemiesOf(u).length || u.t.action < 1) return null; return { score: 3 }; },
  };

  /* ----- Матёрый волк (8): «Хватка стаи», «Сбить с ног» ----- */
  P["dire-wolf"] = { attackMods(att, ctx) { if (alliesOf(att).some(a => canAct(a) && dist(a, ctx.tgt) <= 1)) ctx.adv.push("Хватка стаи"); } };
  A["dire-wolf"] = attackRider({ name: "Сбить с ног", kind: "melee", abil: "str", save: "str", tags: ["prone"], aiBonus: 3,
    onFail: async (t, u) => { B.knock(t, u); fx(t, "сбит с ног", "bad"); } });

  /* ----- Паук-сетепряд (8): «Паучья хватка», «Паутина» ----- */
  P["web-spider"] = { immune(u, c) { return c.id === "restrained" && !!(c.data && c.data.web); } };          // паутина не сковывает; лазание по стенам — вне боя
  A["web-spider"] = netAbility({ name: "Паутина", abil: "dex", save: "dex", far: 6, web: true });

  /* ----- Волколак (7): «Стая вокруг», «Зов луны» ----- */
  P.werewolf = {
    dmgOut(u) { return Math.min(3, alliesOf(u).filter(a => !a.down && dist(a, u) <= 2).length); },          // +1 за каждого союзника в 3 м, не больше +3
    dmgAura(a, c) { return !a.down && c.src.id !== a.id && dist(a, c.src) <= 6 ? 1 : 0; },                    // союзники в 9 м бьют сильнее
  };
  A.werewolf = {
    time: "action",
    tgt() { return { type: "self" }; },
    can(u) { return B.freeCellsNear(u, 6, TMP(u)).length ? true : "некуда позвать волков"; },
    async run(u, pk, ctl) {
      ctl.commit(); const n = roll(1, 3).total;
      log(`${u.name} воет: на зов приходят волки (${n}).`, "skill"); const g = ui(); if (g) g.banner(`${u.name} воет — на зов бегут волки!`);
      B.spawnWolves(u, n); return true;
    },
    ai(u) { return enemiesOf(u).length ? { score: 6 } : null; },
  };

  /* ----- Крот-исполин (7): «Чует шаги», «Сотрясение» ----- */
  // Чувство вибрации 18 м, плохое зрение (3 м) и страх яркого света — через essenceTraits (battle-core.js) и attackCtx.
  P["giant-mole"] = { noSurprise(u) { return enemiesOf(u).some(e => !B.isFlying(e)); } };          // существо на земле в 18 м (всё поле) не застанет врасплох: засада не отнимает у крота первый ход
  A["giant-mole"] = saveArea({ name: "Сотрясение", radius: 3, side: "all", ground: true, abil: "str", save: "dex", dmg: "3к6", dt: "bludgeon", half: true, anim: "blunt", tags: ["prone"],
    onFail: async (t, u) => { B.knock(t, u); addStatus(t, "slowed", { k: 1, when: "end", data: { mult: 0.5 } }); fx(t, "сбит с ног", "bad"); } });

  /* ----- Болотный клык (7): «Из-под воды», «Мёртвая хватка» ----- */
  P["swamp-fang"] = {
    attackMods(att, ctx) {
      if (has(att, "emerged")) { ctx.adv.push("атака с тыла"); ctx.consume.push([att, "emerged"]); }
      const f = has(att, "firstblood"); if (!f) return; ctx.consume.push([att, "firstblood"]); if (inWater(att)) ctx.adv.push("Из-под воды");
    },
    // Решение автора: в бою в топи клык каждый ход уходит под воду и выныривает у цели с тыла (дальше от остальных героев и ближе к их краю поля), если никого не держит
    async turnStartAsync(u) {
      if (!B.S.bog || u.side !== "mon" || live().some(o => has(o, "grappled") && has(o, "grappled").data.by === u.id)) return;
      const es = enemiesOf(u).filter(e => !e.down && !has(e, "underground")); if (!es.length) return;
      const best = [];
      for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
        if (!B.canStand(u, x, y) || !(B.tinfo(x, y) && B.tinfo(x, y).bog)) continue;
        const near = es.filter(e => B.distAt(e, { ...u, x, y }, x, y) <= 1 || dist(e, { ...u, x, y }) <= 1); if (!near.length) continue;
        const t = near[0], others = es.filter(e => e !== t);
        const behind = (y + 0) - t.y;                                                                                             // «тыл» героев — нижний край поля
        const sc = behind * 2 + (others.length ? Math.min(...others.map(o => dist(o, { ...u, x, y }))) : 0) + (t.hp < t.maxHp ? 0.5 : 0);
        best.push({ x, y, sc });
      }
      if (!best.length) return;
      best.sort((a, b) => b.sc - a.sc); const d = best[0];
      if (d.x === u.x && d.y === u.y) return;
      log(`${u.name} уходит под воду и выныривает с тыла.`, "skill"); fx(u, "из топи", "good");
      await B.teleport(u, d.x, d.y); u.t.move = speedOf(u);
      addStatus(u, "emerged", { k: 0, when: "end" });
    },
  };
  A["swamp-fang"] = attackRider({ name: "Мёртвая хватка", kind: "melee", weapon: true, weaponText: "нужно оружие", abil: "str", save: "str", tags: ["grapple"], extra: { n: 2, s: 6 }, aiBonus: 4,
    onFail: async (t, u, sv, res) => { addStatus(t, "grappled", { k: Infinity, data: { by: u.id, dc: dcOf(u, "str"), skill: "athletics", dmg: "1к6", dt: res.atk.dt, tick: "holder" } }); log(`${u.name} вцепляется в ${t.name} мёртвой хваткой.`, "skill"); fx(t, "схвачен", "bad"); } });

  /* ----- Паучиха-матка (7): «Мать роя», «Рой паучат» ----- */
  P["spider-queen"] = {
    attackMods(att, ctx) { const t = ctx.tgt, web = has(t, "restrained"); if ((web && web.data.web) || B.zonesAt(t, "swarm").some(z => z.owner === att.id)) ctx.adv.push("Мать роя"); },
  };
  const cubeAnchors = u => { const out = []; for (let y = 0; y < B.H - 1; y++) for (let x = 0; x < B.W - 1; x++) if (distCell(u, x, y) <= 6) out.push([x, y]); return out; };
  A["spider-queen"] = {
    time: "action",
    tgt(u) { return { type: "cube", prompt: "Рой паучат: выберите куб 2×2 клетки", anchors: cubeAnchors(u), size: 2, kind: "area", okLabel: "Выпустить рой" }; },
    can() { return true; },
    async run(u, pk, ctl) {
      ctl.commit(); const [ax, ay] = pk.cell;
      B.addZone({ kind: "swarm", owner: u.id, cells: [[ax, ay], [ax + 1, ay], [ax, ay + 1], [ax + 1, ay + 1]], until: B.S.round + 10, dc: dcOf(u, "con") });
      log(`${u.name} выпускает рой паучат.`, "skill"); const g = ui(); if (g) g.fxCube(ax, ay, 2);
      return true;
    },
    ai(u) {
      let best = null;
      for (const [x, y] of cubeAnchors(u)) {
        const inCube = o => footprint(o).some(([fx2, fy2]) => fx2 >= x && fx2 < x + 2 && fy2 >= y && fy2 < y + 2);
        const foes = enemiesOf(u).filter(inCube).length, mine = alliesOf(u).filter(inCube).length + (inCube(u) ? 1 : 0);
        const sc = foes * 3 - mine * 4; if (sc > 0 && (!best || sc > best.score)) best = { cell: [x, y], score: sc };
      }
      return best;
    },
  };

  /* ----- Чернокрыл (7): «Вожак стаи», «Пике» ----- */
  P.blackwing = {
    onHitDealt(att, ctx) {
      if (!ctx.res.hit || !(ctx.tgt.alive || ctx.tgt.down)) return;
      const key = B.S.round + ":" + B.S.curId; if (att.flags.packTurn === key) return; att.flags.packTurn = key;          // раз в ход — в любой, в том числе в чужой
      addStatus(ctx.tgt, "packmark", { k: Infinity, data: { by: att.id, endAtStartOf: att.id } }); fx(ctx.tgt, "метка вожака", "bad");
    },
  };
  A.blackwing = charge({ name: "Пике", dt: "pierce", need: "нужно колющее оружие ближнего боя (копьё, рапира)", noProvoke: true, extra: { n: 2, s: 6, label: "Пике" },
    afterHit: async (u, res) => { if (res && res.ctx && res.ctx.adv.includes("атакует из укрытия") && alive(u) && !u.down) { u.t.action = 1; log(`${u.name} бьёт из скрытности — ещё одно действие!`, "skill"); fx(u, "ещё действие", "good"); } } });

  /* ================================================================== */
  /*                     МОГИЛЬНИК БЕЛОЙ ПЫЛИ (13)                      */
  /* ================================================================== */

  /* ----- Серая тень (9): «Тень в тени», «Растворение» ----- */
  const shadowSpot = u => (B.S.dark && !B.brightAt(u)) || B.terrain(u.x, u.y) === "fog";          // тусклый свет, тьма или туман; яркий свет (факел, костёр, кристалл) — нет
  P["grey-shade"] = {
    actions(u) {
      const hid = has(u, "hidden"), foesNear = enemiesOf(u).some(e => canAct(e) && dist(e, u) <= 1), bon = B.timeOK(u, "bonus");
      return [{ id: "shadowhide", cat: "skill", label: "Спрятаться в тени", ico: "hide", sub: "доп. действие · в тени или тумане укрытие не нужно", time: "bonus",
        enabled: bon && shadowSpot(u) && !hid && !foesNear, why: !bon ? "доп. действие потрачено" : !shadowSpot(u) ? "здесь не тень и не туман" : hid ? "уже скрыт" : "враг рядом",
        run: async () => !!(await B.hideRoll(u, { time: "bonus", anywhere: true, cancel: true, title: "Тень в тени" })) }];
    },
    async aiBonus(u) {
      if (!B.timeOK(u, "bonus") || has(u, "hidden") || !shadowSpot(u) || enemiesOf(u).some(e => canAct(e) && dist(e, u) <= 1) || !enemiesOf(u).length) return;
      await B.hideRoll(u, { time: "bonus", anywhere: true, cancel: false, toast: false, title: "Тень в тени" });
    },
  };
  A["grey-shade"] = {
    time: "bonus",
    tgt() { return { type: "self" }; },
    can(u) { const h = has(u, "hidden"); return h && h.data.invis ? "уже невидим" : true; },
    async run(u, pk, ctl) { ctl.commit(); const was = has(u, "hidden"); addStatus(u, "hidden", { k: Infinity, data: { invis: true, endAtStartOf: u.id, was: !!was && !was.data.invis } }); fx(u, "невидим", "good"); log(`${u.name} растворяется в воздухе.`, "skill"); return true; },          // was: до этого уже прятался — обычная скрытность переживёт невидимость
    ai(u) { return !has(u, "hidden") && enemiesOf(u).length ? { score: 3 } : null; },
  };

  /* ----- Морок (9): «Ложный образ», «Морок» ----- */
  P.morok = { onMissedBy(tgt, c) { fool(c.att, tgt); } };
  const illusionCells = u => { const out = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (distCell(u, x, y) <= 6 && B.canStand(TMP(u), x, y)) out.push([x, y]); return out; };
  A.morok = {
    time: "action",
    tgt(u) { return { type: "cell", prompt: "Морок: где появится иллюзия (предмет, звук или существо до Среднего)?", cells: illusionCells(u), kind: "trap" }; },
    can(u) { return illusionCells(u).length ? true : "некуда"; },
    async run(u, pk, ctl) {
      ctl.commit(); const [x, y] = pk.cell, dc = dcOf(u, "cha"), pt = { x, y, size: 1, id: "ill" };
      B.S.objs.push({ id: "ill" + B.rnd(1e6), kind: "illusion", x, y, owner: u.side, by: u.id, until: B.S.round + 10, dc, seen: [] });
      log(`${u.name} создаёт морок.`, "skill"); const g = ui(); if (g) { g.refresh(); g.banner(`${u.name} создаёт иллюзию`); }
      for (const t of enemiesOf(u)) await B.illusionCheck(t);                            // кто видит иллюзию — проверка Проницательности против Сл; остальные — когда увидят впервые (см. battle-ext.js)
      return true;
    },
    ai(u) {
      const es = enemiesOf(u).filter(e => !has(e, "underground")); if (!es.length) return null;
      let best = null;
      for (const c of illusionCells(u)) { const pt = { x: c[0], y: c[1], size: 1, id: "ill" }; const n = es.filter(e => !B.lineBlocked(e, pt) && !has(e, "fooled")).length; const sc = n * 2 - dist(u, { x: c[0], y: c[1], size: 1 }) * 0.1; if (n && (!best || sc > best.score)) best = { cell: c, score: sc }; }
      return best;
    },
  };

  /* ----- Шептун (8): «Шёпот в ухо», «Чужой голос» ----- */
  P.whisperer = {
    attackMods(att, ctx) { if (has(ctx.tgt, "fooled")) ctx.extra.push({ n: 1, s: 4, b: 0, dt: ctx.atk.dt, label: "Шёпот в ухо", critDouble: true }); },          // от обманутого можно прятаться без укрытия — в B.hideSpot
  };
  const lureTargets = u => enemiesOf(u).filter(t => !has(t, "underground") && !has(t, "lured"));
  A.whisperer = {
    time: "action",
    tgt(u) { return specUnit(u, "Чужой голос: чей разум обмануть?", lureTargets(u), B.cellsWithin(u, 12), "debuff"); },
    can(u) { return lureTargets(u).length ? true : "нет подходящих целей"; },
    async run(u, pk, ctl) {
      const t = pk.unit;
      const cells = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (B.canStand(t, x, y) && !(B.tinfo(x, y) && B.tinfo(x, y).obstacle)) cells.push([x, y]);
      let to = null;
      if (manual(u)) { const ch = await B.UI.pickCell({ prompt: `Чужой голос: куда ${t.name} пойдёт на зов?`, cells, kind: "move" }); if (!Array.isArray(ch)) return false; to = ch; }
      else {                                                                             // ИИ: зовёт подальше от своих, лучше на опасную клетку
        const mine = alliesOf(u).concat([u]);
        to = cells.map(c => ({ c, sc: Math.min(...mine.map(m => distCell(m, c[0], c[1]))) * 1.5 + ((B.tinfo(c[0], c[1]) || {}).hazard ? 4 : 0) + (B.S.objs.some(o => o.kind === "trap" && o.owner === u.side && o.x === c[0] && o.y === c[1]) ? 4 : 0) })).sort((a, b) => b.sc - a.sc)[0].c;
      }
      ctl.commit(); const dc = dcOf(u, "cha");
      const sv = await save(t, "wis", dc, "Чужой голос", ["charm"], u);
      if (!sv.ok) { fool(t, u, { k: 10 }); addStatus(t, "lured", { k: 10, when: "end", data: { to, dc, by: u.id } }); log(`${t.name} слышит чужой голос и идёт на зов.`, "skill"); fx(t, "манит голос", "bad"); }
      return true;
    },
    ai(u) { const ts = lureTargets(u).filter(t => !has(t, "fooled")); if (!ts.length) return null; return { unit: ts.sort((a, b) => b.hp - a.hp)[0], score: 3 }; },
  };

  /* ----- Зеркальный мертвец (8): «Кто из нас?», «Отражение» ----- */
  P["mirror-dead"] = {
    redirect(tgt, c) {
      const ds = B.doublesOf(tgt).filter(d => dist(d, tgt) <= 6); if (!ds.length) return null;
      const r = roll(1, 6).total; log(`${c.att.name} бросает к6 против ${tgt.name}: ${r}.`);
      if (r > 2) return null;
      log(`Атака уходит в двойника!`, "skill"); fx(tgt, "в двойника", "good");
      return ds.sort((a, b) => dist(c.att, a) - dist(c.att, b))[0];
    },
  };
  A["mirror-dead"] = {
    time: "bonus",
    tgt(u) { return { type: "cell", prompt: "Отражение: где появится двойник (рядом)?", cells: B.freeCellsNear(u, 1, TMP(u)).map(c => [c[0], c[1]]), kind: "trap" }; },
    can(u) { if (B.doublesOf(u).some(d => !d.bell)) return "двойник уже есть"; return B.freeCellsNear(u, 1, TMP(u)).length ? true : "некуда поставить двойника"; },
    async run(u, pk, ctl) { ctl.commit(); B.makeDouble(u, pk.cell); return true; },
    ai(u) {
      if (B.doublesOf(u).some(d => !d.bell) || !enemiesOf(u).length) return null;
      const cs = B.freeCellsNear(u, 1, TMP(u)); if (!cs.length) return null;
      const es = enemiesOf(u), c = cs.sort((a, b) => Math.min(...es.map(e => distCell(e, a[0], a[1]))) - Math.min(...es.map(e => distCell(e, b[0], b[1]))))[0];
      return { cell: [c[0], c[1]], score: 4 };
    },
  };

  /* ----- Безликий звонарь (7): «Подмена», «Колокол теней» ----- */
  P["faceless-ringer"] = {
    async reactHit(tgt, c) {
      const ds = B.doublesOf(tgt).filter(d => dist(d, tgt) <= 6);
      if (!ds.length || !canAct(tgt) || !(tgt.t.react > 0) || tgt.flags.swapRound === B.S.round) return false;          // раз в раунд реакцией
      if (manual(tgt) && !(await B.promptReaction({ title: "Подмена", text: `${c.att.name} попадает по вам. Поменяться местами с двойником, и пусть удар примет он?` }))) return false;
      const dbl = ds.sort((a, b) => dist(c.att, a) - dist(c.att, b))[0];
      tgt.t.react = 0; tgt.flags.swapRound = B.S.round;
      const px = tgt.x, py = tgt.y; tgt.x = dbl.x; tgt.y = dbl.y; dbl.x = px; dbl.y = py;
      log(`${tgt.name} меняется местами с двойником: удар попадает в иллюзию.`, "skill"); fool(c.att, tgt);
      B.vanish(dbl, "принимает удар и рассеивается");
      await B.terrainEnter(tgt);                                                         // новая клетка — её местность (костёр, ловушка) действует
      return "swap";
    },
    doubleAttacked(owner, c) { fool(c.att, owner); },                                    // кто атаковал двойника — обманут
  };
  A["faceless-ringer"] = {
    time: "action",
    tgt() { return { type: "self" }; },
    can(u) { return B.freeCellsNear(u, 1, TMP(u)).length ? true : "некуда поставить двойников"; },
    async run(u, pk, ctl) {
      ctl.commit(); let n = 0;
      const grp = (u.bellSeq = (u.bellSeq || 0) + 1);                                       // номер звона: отдача — когда исчезает последний двойник именно этого звона
      for (let i = 0; i < 2; i++) { const cs = B.freeCellsNear(u, 1, TMP(u)); if (!cs.length) break; B.makeDouble(u, [cs[0][0], cs[0][1]], { bell: grp }); n++; }
      if (n) (u.bellLeft ||= {})[grp] = n;
      log(`${u.name}: звон колокола — двойников ${n}!`, "skill"); const g = ui(); if (g) g.banner(`${u.name}: Колокол теней!`);
      if (n && alive(u) && !u.down) await B.hideRoll(u, { anywhere: true, seen: true, cancel: false, toast: false, title: "Колокол теней" });          // сразу пытается спрятаться, даже без укрытия
      return true;
    },
    ai(u) { return enemiesOf(u).length && !Object.keys(u.bellLeft || {}).length ? { score: 4 } : null; },
  };

  /* ----- Пыльный ползун (9): «Упорство мертвеца», «Горсть пыли» ----- */
  P["dust-crawler"] = {
    async beforeZero(u, c) {                                                             // раз за бой; не работает против излучения и критов
      const o = c.o || {}; if (u.flags.deadwill || o.crit || o.dt === "radiant") return false;
      u.flags.deadwill = true;                                                           // раз за бой — спасбросок, а не успешное спасение: отметка до броска
      const sv = await save(u, "con", 5 + (o.taken || c.left), "Упорство мертвеца");
      if (!sv.ok) return false;
      log(`${u.name}: упорство мертвеца — остаётся на ногах!`, "good"); fx(u, "упорство мертвеца", "good"); return true;
    },
  };
  A["dust-crawler"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Горсть пыли: кому в глаза?", within(u, 1), cellsAround(u, 1), "debuff"); },
    can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit; const sv = await save(t, "dex", dcOf(u, "dex"), "Горсть пыли", ["blind"], u); if (!sv.ok) { addStatus(t, "blinded", { k: 1, when: "end" }); fx(t, "ослеплён", "bad"); } return true; },
    ai(u) { const ts = within(u, 1).filter(t => !has(t, "blinded")); return ts.length ? { unit: ts[0], score: 3 } : null; },
  };

  /* ----- Костяная гончая (9): «По следу», «Загон» ----- */
  P["bone-hound"] = {};                                                                  // выслеживание — вне боя; чутьё на раненых — отметка на поле (battle-ui.js)
  const houndTargets = u => live().filter(t => t.id !== u.id && !t.dead && !has(t, "underground") && !B.lineBlocked(u, t));
  function houndStep(u, t) {
    const map = B.pathMap(u, Math.floor(speedOf(u) / 2), {});
    const cells = [...map.values()].filter(v => (v.x !== u.x || v.y !== u.y) && B.canStand(u, v.x, v.y));
    let best = null;
    for (const v of cells) { const dd = dist(t, { ...u, x: v.x, y: v.y }); if (!best || dd < best.dd || (dd === best.dd && v.cost < best.v.cost)) best = { v, dd }; }
    return best && best.dd < dist(u, t) ? { map, v: best.v } : null;
  }
  A["bone-hound"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Загон: к кому метнуться?", houndTargets(u).filter(t => houndStep(u, t)), B.cellsWithin(u, 12), "attack"); },
    can(u) { return houndTargets(u).some(t => houndStep(u, t)) ? true : "некуда сближаться"; },
    async run(u, pk, ctl) {
      const st = houndStep(u, pk.unit); if (!st) return false;
      ctl.commit(); const r = await B.moveAlong(u, B.pathTo(st.map, st.v.x, st.v.y), { noProvoke: true }); u.t.moved += r.spent; return true;
    },
    ai(u) {
      const es = enemiesOf(u).filter(e => !has(e, "underground") && dist(e, u) > 1 && houndStep(u, e)); if (!es.length) return null;
      return { unit: es.sort((a, b) => dist(u, a) - dist(u, b))[0], score: 3 };
    },
  };

  /* ----- Могильщик (8): «Глубокая яма», «Похоронить заживо» ----- */
  P.gravedigger = {};                                                                    // «Глубокая яма»: цена подъёма — B.standCost, кто сбил — B.knock
  const buryTargets = u => within(u, 1).filter(t => t.size <= 1 && !has(t, "buried"));
  A.gravedigger = {
    time: "action",
    tgt(u) { return specUnit(u, "Похоронить заживо: кого засыпать?", buryTargets(u), cellsAround(u, 1), "attack"); },
    can(u) { return buryTargets(u).length ? true : "никого подходящего рядом"; },
    async run(u, pk, ctl) {
      const t = pk.unit;
      const r = await B.contest(u, "athletics", t, B.bestDef(t), { title: "Похоронить заживо", cancel: true, onCommit: () => ctl.commit(), labelA: `засыпать: ${t.name}` });
      if (!r) return false;
      if (r.win) { addStatus(t, "buried", { k: 1, when: "end", data: { dc: r.a.total + 1, by: u.id } }); log(`${u.name} засыпает ${t.name} землёй.`, "skill"); fx(t, "засыпан", "bad"); }
      else fx(t, "устоял", "");
      return true;
    },
    ai(u) { const ts = buryTargets(u); return ts.length ? { unit: ts.sort((a, b) => B.avgDice((B.attacksOf(b)[0] || { dmg: { n: 0, s: 0, b: 0 } }).dmg) - B.avgDice((B.attacksOf(a)[0] || { dmg: { n: 0, s: 0, b: 0 } }).dmg))[0], score: 3 } : null; },
  };

  /* ----- Чумной толстяк (8): «Гнилая кровь», «Облако гнили» ----- */
  P["plague-fat"] = {
    async hitTaken(u, c) {                                                               // раз в ход (чей угодно), когда попадают рукопашной атакой
      const turnKey = B.S.round + ":" + B.S.curId;
      if (!c.melee || !c.res.hit || !(u.alive || u.down) || u.flags.rotTurn === turnKey) return;
      u.flags.rotTurn = turnKey;
      const sv = await save(c.att, "con", 10, "Гнилая кровь", ["poison"]);
      if (!sv.ok && alive(c.att)) { addStatus(c.att, "poisoned", { k: 1, when: "end" }); fx(c.att, "отравлен", "bad"); }
    },
  };
  A["plague-fat"] = saveArea({ name: "Облако гнили", radius: 2, side: "all", abil: "con", save: "con", dmg: "1к6", dt: "poison", half: true, anim: "poison", tags: ["poison"],
    onFail: async t => { addStatus(t, "poisoned", { k: 1, when: "end" }); fx(t, "отравлен", "bad"); } });

  /* ----- Пепельный дух (8): «Летучий прах», «Рассыпаться пеплом» ----- */
  P["ash-spirit"] = { passThrough: true };                                               // сквозь клетки других существ; падение вреда не наносит (падений в бою нет)
  const ashCells = u => { const out = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if ((x !== u.x || y !== u.y) && distCell(u, x, y) <= 6 && B.canStand(u, x, y) && !B.lineBlocked(u, { x, y, size: 1, id: "pt" })) out.push([x, y]); return out; };
  A["ash-spirit"] = {
    time: "action",
    tgt(u) { return { type: "cell", prompt: "Рассыпаться пеплом: где собраться (9 м, видимая клетка)?", cells: ashCells(u), kind: "move", radius: 1 }; },
    can(u) { return ashCells(u).length ? true : "некуда"; },
    async run(u, pk, ctl) {
      ctl.commit(); const [x, y] = pk.cell;
      log(`${u.name} рассыпается пеплом.`, "skill"); await B.teleport(u, x, y);
      if (!alive(u) || u.down) return true;
      const vs = live().filter(o => o.id !== u.id && !has(o, "underground") && dist(u, o) <= 1);
      if (!vs.length) return true;
      const bonus = B.hookSum(u, "abilityDmg", { dt: "fire" });
      const ses = B.session(u, { kind: "damage", u, title: "Рассыпаться пеплом", sub: `${u.name}: 1к6 огнём` });
      const r = await ses.dice({ label: `Урон 1к6${bonus ? " " + sg(bonus) : ""}`, n: 1, s: 6, bonus, dt: "fire", cancel: false, reroll: B.rerollOptions(u, "damage", {}) });
      const total = r.sum + bonus; await ses.finish({ text: `${total} урона огнём`, anim: "fire", dmg: total, tgt: vs[0] });
      const dc = dcOf(u, "dex");
      for (const t of vs) { const sv = await save(t, "dex", dc, "Рассыпаться пеплом", ["fire"], u); await B.applyDamage(u, t, [{ v: sv.ok ? Math.floor(total / 2) : total, dt: "fire", label: "Пепел" }], { skill: true }); }
      return true;
    },
    ai(u) {
      let best = null;
      for (const [x, y] of ashCells(u)) {
        const ghost = { ...u, x, y }, foes = enemiesOf(u).filter(e => dist(ghost, e) <= 1), mine = alliesOf(u).filter(a => dist(ghost, a) <= 1);
        const sc = foes.length * 2.5 - mine.length * 3 - ((B.tinfo(x, y) || {}).hazard ? 9 : 0) + (foes.length ? 0 : -9);
        if (foes.length && (!best || sc > best.score)) best = { cell: [x, y], score: sc };
      }
      return best && best.score > 1 ? best : null;
    },
  };

  /* ----- Костяной рыцарь (7): «Латы из костей», «Рывок мертвеца» ----- */
  P["bone-knight"] = {
    dmgFlat(u, c) {                                                                      // немагическое оружие: колющий и рубящий урон меньше на 2 (один раз на удар)
      if ((c.dt !== "pierce" && c.dt !== "slash") || !c.o || !(c.o.ctx || c.o.weapon) || c.memo.knight) return 0;
      c.memo.knight = 1; return -2;
    },
  };
  const SWORDS = ["sword", "greatsword", "shortsword", "longsword"];
  A["bone-knight"] = charge({ name: "Рывок мертвеца", dt: null, need: "нужен меч", noProvoke: true, pred: a => SWORDS.includes(a.w ? a.w.id : a.id), extra: { n: 2, s: 6, label: "Рывок мертвеца" }, abil: "str", save: "str", tags: ["prone"],
    onFail: async (t, u) => { if (alive(t) || t.down) { await B.push(t, u.x, u.y, 2); B.knock(t, u); log(`${t.name} отброшен и сбит с ног.`, "skill"); fx(t, "отброшен", "bad"); } } });

  /* ----- Трупоед (7): «Пожиратель», «Парализующий укус» ----- */
  async function gnaw(u, o = {}) {
    const bs = bodiesNear(u); if (!bs.length) return false;
    const ses = B.session(u, { kind: "heal", u, title: "Пожиратель", sub: `${u.name} вгрызается в ${bs[0].name}` });
    const r = await ses.dice({ label: "Лечение 1к8", n: 1, s: 8, bonus: 0, heal: true, cancel: !!o.cancel, reroll: B.rerollOptions(u, "heal") });
    if (!r) { ses.close(); return false; }
    B.spendTime(u, "bonus"); bs[0].eaten = true;
    const got = B.heal(u, r.sum, u);
    await ses.finish({ text: got ? `Восстановлено ${got} ОЗ` : "Раны не затянулись", heal: true, tgt: u, dmg: got });
    return true;
  }
  P["corpse-eater"] = {
    actions(u) {
      const bs = bodiesNear(u), bon = B.timeOK(u, "bonus");
      return [{ id: "gnaw", cat: "skill", label: "Пожрать павшего", ico: "heart", sub: "доп. действие · 1к8 ОЗ, с одного тела один раз", time: "bonus", enabled: bon && bs.length > 0, why: !bon ? "доп. действие потрачено" : "нет павшего рядом", run: () => gnaw(u, { cancel: true }) }];
    },
    async aiBonus(u) { if (B.timeOK(u, "bonus") && bodiesNear(u).length && u.hp <= u.maxHp - 3) await gnaw(u); },
  };
  A["corpse-eater"] = attackRider({ name: "Парализующий укус", kind: "melee", abil: "con", save: "con", tags: ["paralysis"], extra: { n: 1, s: 6 }, aiBonus: 4,
    onFail: async (t, u) => { if (addStatus(t, "paralyzed", { k: 10, when: "end", data: { dc: dcOf(u, "con"), abil: "con", by: u.id } })) { log(`${t.name} парализован!`, "skill"); fx(t, "парализован", "bad"); } } });

  /* ----- Пепельник (7): «Тлеющее тело», «Белая пыль» ----- */
  P["ash-wraith"] = {
    async auraTurnStart(a, u) {                                                          // начинающий ход в 1,5 м от пепельника получает 1к4 огнём
      if (!canAct(a) || dist(a, u) > 1) return;
      const r = roll(1, 4).total + B.hookSum(a, "abilityDmg", { dt: "fire" }); log(`${u.name} обжигается о тлеющее тело ${a.name}: ${r}.`);
      await B.applyDamage(a, u, [{ v: r, dt: "fire", label: "Тлеющее тело" }], {});
    },
  };
  A["ash-wraith"] = {
    time: "action",
    tgt() { return { type: "self" }; },
    can(u) { return (B.S.zones || []).some(z => z.kind === "dust" && z.owner === u.id) ? "пыль уже висит" : true; },
    async run(u, pk, ctl) {
      ctl.commit(); B.addZone({ kind: "dust", owner: u.id, follow: u.id, radius: 3, until: B.S.round + 10, dc: dcOf(u, "con") });
      log(`${u.name} поднимает белую пыль.`, "skill"); const g = ui(); if (g) g.banner(`${u.name}: Белая пыль!`);
      return true;
    },
    ai(u) { const es = enemiesOf(u).filter(e => dist(e, u) <= 6); return es.length && !(B.S.zones || []).some(z => z.kind === "dust" && z.owner === u.id) ? { score: 3 } : null; },
  };

  /* ===== свет и стартовые состояния ===== */
  const prevInit = B.initUnit;
  B.initUnit = function (u) {
    if (prevInit) prevInit(u);
    if (u.ess.includes("swamp-fang")) addStatus(u, "firstblood", { k: Infinity });         // первая атака в бою из воды — с преимуществом
    if (u.ess.includes("ash-wraith")) addStatus(u, "lit", { k: Infinity });               // светится тусклым светом на 3 м
  };


  /* ===================== Кристальный разлом (элементали, черновик campaign/drafts.md) ===================== */
  const ELEM = { fire: { dt: "fire", ru: "огонь" }, water: { dt: "cold", ru: "вода" }, lightning: { dt: "lightning", ru: "молния" }, wind: { dt: "thunder", ru: "ветер" }, earth: { dt: "bludgeon", ru: "камень" } };
  const ELEM_IDS = Object.keys(ELEM);
  const ignite = (t, src) => { if (has(t, "wet") || has(t, "burning")) return false; addStatus(t, "burning", { k: Infinity, data: { by: src ? src.id : null } }); fx(t, "горит", "bad"); return true; };
  const makeWet = t => { addStatus(t, "wet", { k: 1, when: "end" }); fx(t, "промок", ""); removeStatusSafe(t, "burning"); };
  const removeStatusSafe = (t, id) => { if (has(t, id)) removeStatus(t, id); };
  const turnKey = () => B.S.round + ":" + B.S.curId;
  const waterAt = u => { const t = B.tinfo(u.x, u.y); return !!(t && t.wet) || B.terrain(u.x, u.y) === "mud"; };
  const nearFire = u => {
    const S = B.S;
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) { const t = B.tinfo(x, y); if (t && t.hazard === "fire" && distCell(u, x, y) <= 2) return true; }
    if (S.torch && S.torchBy) { const h = B.byId(S.torchBy); if (h && dist(u, h) <= 2) return true; }
    return live().some(o => has(o, "burning") && dist(u, o) <= 1);
  };

  /* Капля (9) */
  P.drop = { defendMods(t, ctx) { if (ctx.o && ctx.o.reaction && ctx.melee) ctx.dis.push("Текучесть"); } };
  A.drop = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Обливание: на кого?", within(u, 1), cellsAround(u, 1), "debuff"); },
    can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit, sv = await save(t, "dex", dcOf(u, "con"), "Обливание");
      if (!sv.ok) {
        makeWet(t); const S = B.S;
        if (S.torch && !S.torchFixed && S.torchBy === t.id) { S.torch = false; log(`Факел ${t.name} гаснет.`, "bad"); if (ui()) ui().refresh(); }          // горящий факел гаснет
      }
      return true;
    },
    ai(u) { const ts = within(u, 1).filter(t => !has(t, "wet")); return ts.length ? { unit: ts.sort((a, b) => (B.S.torchBy === b.id) - (B.S.torchBy === a.id))[0], score: 3 } : null; },
  };

  /* Пыльный вихрь (9) */
  P["dust-whirl"] = { defendMods(t, ctx) { if (!ctx.melee && t.t && t.t.moved >= 2) ctx.dis.push("Сквозняк"); } };
  const gustLine = (u, t) => { const dx = Math.sign(t.x - u.x), dy = Math.sign(t.y - u.y), out = []; for (let k = 1; k <= 3; k++) out.push([u.x + dx * k, u.y + dy * k]); return out; };
  const gustVictims = (u, t) => { const cells = gustLine(u, t); return enemiesOf(u).filter(e => e.size <= 1 && !has(e, "underground") && footprint(e).some(([fx0, fy0]) => cells.some(([cx, cy]) => cx === fx0 && cy === fy0))); };
  A["dust-whirl"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Порыв: в какую сторону?", within(u, 3).filter(e => e.size <= 1), cellsAround(u, 3), "attack"); },
    can(u) { return within(u, 3).some(e => e.size <= 1) ? true : "никого на линии"; },
    async run(u, pk, ctl) {
      ctl.commit(); const cells = gustLine(u, pk.unit), vs = gustVictims(u, pk.unit), dc = dcOf(u, "dex");
      for (const [cx, cy] of cells) if (B.S.cells[cy] && B.S.cells[cy][cx] === "fire") B.S.cells[cy][cx] = null;          // гасит открытое пламя
      if (ui()) ui().banner(`${u.name}: Порыв!`);
      for (const t of vs) { const sv = await save(t, "str", dc, "Порыв", [], u); if (!sv.ok && alive(t)) await B.push(t, u.x, u.y, 2); }
      return true;
    },
    ai(u) { const ts = within(u, 3).filter(e => e.size <= 1); if (!ts.length) return null; const best = ts.map(t => ({ t, n: gustVictims(u, t).length })).sort((a, b) => b.n - a.n)[0]; return { unit: best.t, score: 2.5 + best.n }; },
  };

  /* Магмовый пёс (8) */
  P["magma-hound"] = { attackMods(att, ctx) { if (nearFire(att)) ctx.mods.push({ l: "Жаролюб", v: 1 }); } };
  A["magma-hound"] = attackRider({ name: "Огненный укус", kind: "melee", abil: "con", save: "con", extra: { n: 1, s: 6, dt: "fire", label: "Огненный укус" }, aiBonus: 3,
    onFail: async (t, u) => { ignite(t, u); } });

  /* Кристаллоид (8) */
  P.crystalloid = { dmgFlat(u, c) { return c.dt === "fire" || c.dt === "radiant" ? -2 : 0; } };
  A.crystalloid = saveArea({ name: "Вспышка граней", radius: 2, side: "enemies", abil: "con", save: "con", tags: ["blind"],
    onFail: async t => { addStatus(t, "blinded", { k: 1, when: "end" }); fx(t, "ослеплён", "bad"); } });

  /* Озёрный дух (8) */
  P["lake-spirit"] = {
    attackMods(att, ctx) { if (ctx.melee && att.flags.iceTurn !== turnKey() && ctx.atk && !ctx.atk.thrown) ctx.atk.dt = "cold"; },
    onHitDealt(att, c) {
      if (!c.melee || att.flags.iceTurn === turnKey() || !c.res.hit || c.res.hit === false) return;
      att.flags.iceTurn = turnKey(); const t = c.tgt; if (!t || !(alive(t) || t.down)) return;
      addStatus(t, "slowed", { k: 1, when: "end", data: { add: -2 } }); fx(t, "холод", "bad");
    },
  };
  const grabTargets = u => within(u, 6).filter(t => !has(t, "restrained") && !B.lineBlocked(u, t));
  A["lake-spirit"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Ледяная хватка: на кого?", grabTargets(u), B.cellsWithin(u, 6), "debuff"); },
    can(u) { return grabTargets(u).length ? true : "никого в 9 м"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit, dc = dcOf(u, "wis");
      const sv = await B.doSave(t, "str", dc, { label: "Ледяная хватка", dis: has(t, "wet") ? ["промок"] : [], from: u });
      const d = roll(1, 6).total, v = sv.ok ? Math.floor(d / 2) : d;
      await B.applyDamage(u, t, [{ v, dt: "cold", label: "Ледяная хватка" }], { skill: true });
      if (!sv.ok && (alive(t) || t.down)) { addStatus(t, "restrained", { k: Infinity, data: durEnd(t, 1) }); fx(t, "вмёрз", "bad"); }
      return true;
    },
    ai(u) { const ts = grabTargets(u); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 3 } : null; },
  };

  /* Магмовый голем (7) */
  P["magma-golem"] = {
    async hitTaken(u, c) {
      if (!c.melee || !c.res.hit || !c.atk || !(c.atk.dt === "slash" || c.atk.dt === "pierce") || !alive(c.att)) return;
      await B.applyDamage(u, c.att, [{ v: roll(1, 4).total, dt: "fire", label: "Брызги лавы" }], {});
    },
  };
  A["magma-golem"] = saveArea({ name: "Извержение", radius: 2, side: "enemies", abil: "con", save: "dex", dmg: "3к6", dt: "fire", half: true, anim: "fire",
    onFail: async (t, u) => { ignite(t, u); } });

  /* Глубинный змей (7) */
  P["deep-serpent"] = {
    speedBonus(u) { let b = waterAt(u) ? 0 : -2; if (has(u, "coiled")) b -= Math.floor(Math.max(u.speedC, u.flyC) / 2); return b; },
    attackMods(att, ctx) {
      const c = has(att, "coiled"); if (!c || !ctx.atk || ctx.atk.thrown) return;
      ctx.mods.push({ l: "Бросок из кольца", v: 2 }); ctx.extra.push({ n: 1, s: 8, b: 0, dt: ctx.atk.dt, label: "Бросок из кольца", critDouble: true }); ctx.consume.push([att, "coiled"]); att.flags.coilFull = true;
    },
    async afterAttack(att, c) {
      if (!c.res || !c.res.hit || !c.atk || c.atk.kind !== "melee" || att.flags.slideTurn === turnKey()) return;
      const reach = c.atk.reach || 1, ts = enemiesOf(att).filter(e => e.id !== c.tgt.id && alive(e) && !has(e, "underground") && dist(e, c.tgt) <= reach);
      if (!ts.length) { att.flags.coilFull = false; return; }
      att.flags.slideTurn = turnKey();
      const t = ts.sort((a, b) => a.hp - b.hp)[0], full = att.flags.coilFull; att.flags.coilFull = false;
      const v = Math.max(1, full ? c.res.dealt : Math.floor(c.res.dealt / 2));
      log(`${att.name}: скользящий удар задевает ${t.name}.`, "skill");
      await B.applyDamage(att, t, [{ v, dt: c.atk.dt, label: "Скользящий удар" }], { melee: true, src: att });
    },
  };
  A["deep-serpent"] = {
    time: "bonus",
    tgt() { return { type: "self" }; },
    can(u) { return has(u, "coiled") ? "уже свёрнут" : speedOf(u) > 0 ? true : "не может двигаться"; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "coiled", { k: Infinity }); log(`${u.name} сворачивается в кольца.`, "skill"); fx(u, "свернулся", "good"); return true; },
    ai(u) { if (has(u, "coiled")) return null; const es = enemiesOf(u); const near = Math.min(...es.map(e => dist(u, e))); return es.length && near >= 2 && near <= 4 ? { score: 3 } : null; },
  };

  /* Кристальный колосс (7) */
  P["crystal-colossus"] = { acAura(a, c) { return a.id !== c.tgt.id && dist(a, c.tgt) <= 6 ? 1 : 0; } };
  const cageTargets = u => within(u, 6).filter(t => !has(t, "encased") && !B.lineBlocked(u, t));
  A["crystal-colossus"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Кристальная тюрьма: на кого?", cageTargets(u), B.cellsWithin(u, 6), "debuff"); },
    can(u) { return cageTargets(u).length ? true : "никого в 9 м"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit, sv = await save(t, "dex", dcOf(u, "con"), "Кристальная тюрьма", [], u);
      if (!sv.ok) { addStatus(t, "encased", { k: Infinity, data: { hp: 10, ...durEnd(t, 1) } }); log(`${t.name} заключён в кристалл.`, "skill"); fx(t, "в кристалле", "bad"); }
      else { addStatus(t, "slowed", { k: 1, when: "end", data: { mult: 0.5 } }); fx(t, "замедлен", "bad"); }
      return true;
    },
    ai(u) { const ts = cageTargets(u); return ts.length ? { unit: ts.sort((a, b) => B.avgDice((B.attacksOf(b)[0] || { dmg: { n: 0, s: 0, b: 0 } }).dmg) - B.avgDice((B.attacksOf(a)[0] || { dmg: { n: 0, s: 0, b: 0 } }).dmg))[0], score: 3.5 } : null; },
  };

  /* Дух бури (7) */
  P["storm-spirit"] = {
    async hitTaken(u, c) { if (!c.melee || !c.res.hit || !alive(c.att)) return; await B.applyDamage(u, c.att, [{ v: roll(1, 4).total, dt: "lightning", label: "Грозовой заряд" }], {}); },          // у промокшего «промок» добавит ещё 1к4
  };
  const chainTargets = u => enemiesOf(u).filter(t => dist(u, t) <= 12 && !has(t, "underground") && !B.lineBlocked(u, t));
  A["storm-spirit"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Цепная молния: первая цель?", chainTargets(u), B.cellsWithin(u, 12), "attack"); },
    can(u) { return chainTargets(u).length ? true : "никого в 18 м"; },
    async run(u, pk, ctl) {
      ctl.commit(); const first = pk.unit, dc = dcOf(u, "wis"); if (ui()) ui().banner(`${u.name}: Цепная молния!`);
      const dis = t => (has(t, "wet") ? ["промок"] : []);
      let sv = await B.doSave(first, "dex", dc, { label: "Цепная молния", dis: dis(first), from: u }), d = roll(2, 8).total;
      await B.applyDamage(u, first, [{ v: sv.ok ? Math.floor(d / 2) : d, dt: "lightning", label: "Цепная молния" }], { skill: true });
      const next = enemiesOf(u).filter(t => t.id !== first.id && dist(t, first) <= 2 && !has(t, "underground")).sort((a, b) => dist(a, first) - dist(b, first)).slice(0, 2);
      for (const t of next) {
        sv = await B.doSave(t, "dex", dc, { label: "Цепная молния (скачок)", dis: dis(t), from: u });
        if (!sv.ok) await B.applyDamage(u, t, [{ v: roll(1, 8).total, dt: "lightning", label: "Цепная молния" }], { skill: true });
      }
      return true;
    },
    ai(u) { const ts = chainTargets(u); if (!ts.length) return null; const sc = ts.map(t => ({ t, n: enemiesOf(u).filter(o => o.id !== t.id && dist(o, t) <= 2).length + (has(t, "wet") ? 1 : 0) })).sort((a, b) => b.n - a.n)[0]; return { unit: sc.t, score: 3 + sc.n }; },
  };

  /* Сердце разлома (7, особый) */
  const elemEffect = async (t, el, src, cx, cy) => {
    if (!(alive(t) || t.down)) return;
    if (el === "fire") ignite(t, src);
    else if (el === "water") makeWet(t);
    else if (el === "lightning") { if (t.t) t.t.noReact = true; fx(t, "без реакций", "bad"); }
    else if (el === "wind") await B.push(t, cx, cy, 2);
    else if (el === "earth") { B.knock(t, src); fx(t, "сбит с ног", "bad"); }
  };
  P["rift-heart"] = {
    turnStart(u) { if (u.side === "mon") { const el = ELEM_IDS[B.rnd(5)]; u.flags.heartEl = el; log(`${u.name} выбирает стихию: ${ELEM[el].ru}.`, "skill"); fx(u, ELEM[el].ru, ""); } },
    attackMods(att, ctx) {
      if (!ctx.atk || ctx.atk.thrown) return;
      if (att.side === "mon") { const el = att.flags.heartEl; if (el) { ctx.extra.push({ n: 1, s: 4, b: 0, dt: ELEM[el].dt, label: "Стихия: " + ELEM[el].ru, critDouble: true }); ctx.heartEl = el; } }
      else { const t = ctx.tgt, vul = ELEM_IDS.find(e => t.vuln.includes(ELEM[e].dt)) || (has(t, "wet") ? "water" : "fire"); ctx.atk.dt = ELEM[vul].dt; ctx.heartEl = vul; }          // у героя игра сама берёт стихию, к которой цель уязвима (иначе огонь; по промокшему — холод)
    },
    async onHitDealt(att, c) {
      if (!c.heartEl || !c.res.hit || att.flags.elemTurn === turnKey()) return; att.flags.elemTurn = turnKey();
      const t = c.tgt; if (!t || !(alive(t) || t.down)) return;
      if (c.heartEl === "water") { addStatus(t, "slowed", { k: 1, when: "end", data: { add: -2 } }); fx(t, "холод", "bad"); }
      else if (c.heartEl === "wind") await B.push(t, att.x, att.y, 1);
      else if (c.heartEl !== "earth") await elemEffect(t, c.heartEl, att, att.x, att.y);
    },
  };
  const stormTargets = u => enemiesOf(u).filter(t => dist(u, t) <= 12 && !has(t, "underground") && !B.lineBlocked(u, t));
  A["rift-heart"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Шторм стихий: центр сферы?", stormTargets(u), B.cellsWithin(u, 12), "attack"); },
    can(u) { return stormTargets(u).length ? true : "никого в 18 м"; },
    async run(u, pk, ctl) {
      ctl.commit(); const c = pk.unit, el = u.flags.heartEl || ELEM_IDS[B.rnd(5)], dc = dcOf(u, "cha");
      const vs = live().filter(o => o.id !== u.id && !has(o, "underground") && dist(o, c) <= 2 && (o.side !== u.side || o.id === c.id));
      if (ui()) ui().banner(`${u.name}: Шторм стихий (${ELEM[el].ru})!`);
      const d = roll(2, 6).total;
      for (const t of vs.filter(x => x.side !== u.side)) {
        const sv = await save(t, "dex", dc, "Шторм стихий", [], u);
        await B.applyDamage(u, t, [{ v: sv.ok ? Math.floor(d / 2) : d, dt: ELEM[el].dt, label: "Шторм стихий" }], { skill: true });
        if (!sv.ok) await elemEffect(t, el, u, c.x, c.y);
      }
      return true;
    },
    ai(u) { const ts = stormTargets(u); if (!ts.length) return null; const sc = ts.map(t => ({ t, n: enemiesOf(u).filter(o => dist(o, t) <= 2).length })).sort((a, b) => b.n - a.n)[0]; return { unit: sc.t, score: 3 + sc.n * 1.5 }; },
  };
  // Нестабильность: в начале боя уязвимость к одной стихии (сопротивление к ней не действует).
  const prevInitRift = B.initUnit;
  B.initUnit = function (u) {
    if (prevInitRift) prevInitRift(u);
    if (!u.unstable) return;
    const dt = ["fire", "cold", "lightning", "thunder"][B.rnd(4)];
    u.resist = u.resist.filter(x => x !== dt); if (!u.vuln.includes(dt)) u.vuln.push(dt); u.unstableDt = dt;
    log(`${u.name}: нестабильность — уязвимость к урону «${D.DT[dt] || dt}».`, "skill");
  };

  B.fillActiveTimes();
})();
