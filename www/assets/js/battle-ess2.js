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
        if (!sv.ok) { addStatus(t, "restrained", { k: cfg.turns || Infinity, when: "end", data: { dc, by: u.id, net: { hp: 5, web: !!cfg.web }, web: !!cfg.web } }); log(`${t.name} опутан: ${cfg.web ? "паутина" : "сеть"}.`, "skill"); fx(t, "опутан", "bad"); }
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
    tgt(u) { const sp = shadowPath(u); if (!sp.cells.length) return { type: "self" };          // 09.11: двигаться некуда (окружён, скорость 0) — уходит в тень на месте
      return { type: "cell", prompt: "Уход в тень: куда (половина скорости, без атак по возможности)", cells: sp.cells.map(v => [v.x, v.y]), kind: "move", path: sp.map, optional: true }; },
    can(u) { return true; },          // 09.11: можно и стоя на месте (без перемещения)
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
  A["goblin-trapper"] = netAbility({ name: "Ловчая сеть", abil: "dex", save: "str", near: 2, far: 6, slowOnOk: true, turns: 2 });          // сеть держит не дольше 2 ходов цели (правка автора 02.11)          // успех: скорость вдвое меньше до конца её следующего хода

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
        if (!(await B.promptReaction({ unit: a, title: "Принять удар", text: `${c.att.name} атакует ${c.tgt.name}. Принять удар на себя? (${eb.mana} маны)` }))) return null;
        B.setMp(a, a.mp - eb.mana); B.setCd(a, "hobgoblin-shield", D.essCd["hobgoblin-shield"]);
      } else { if (a.cd["hobgoblin-shield"] > 0) return null; B.setCd(a, "hobgoblin-shield", D.essCd["hobgoblin-shield"] || 2); }
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
    { const gb = ui(); if (gb && gb.fxBoom) gb.fxBoom(cx, cy, 2); }
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
  const thiefRun = u => { u.flags.thief = true; };          // украл: дальше решает ИИ (battle-ai.js `shouldFlee`): ОЗ > 50 % — остаётся красть ещё, ≤ 50 % — бежит к краю и уходит на следующем ходу (автор 03.11)
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
      if (alive(u) && !u.down && distCell(u, w.x, w.y) <= 1) { w.holder = u.id; w.x = u.x; w.y = u.y; log(`${u.name} хватает ${((typeof itemOf === "function" && itemOf(w.item)) || { name: "оружие" }).name.toLowerCase()}.`, "skill"); if (u.side === "mon" && !u.summon) thiefRun(u); }
    },
  };
  A["goblin-thief"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Срезать кошель: у кого?", within(u, 1), cellsAround(u, 1), "debuff"); },
    can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit;
      const sv = await save(t, "dex", dcOf(u, "dex"), "Срезать кошель", ["steal"], u);
      if (sv.ok) { fx(t, "не вышло", ""); log(`${u.name} пытается срезать кошель у ${t.name}, но не выходит.`); return true; }
      // добыча (правка автора 02.11): у героя — оружие из руки (кроме щитов и перчаток) или один незакреплённый предмет из рюкзака (зелье, паёк, факел);
      // монстр-вор берёт оружие, если оно есть, и сразу удирает («Срезал и бежит»); у монстров предметов нет
      let got = null;
      if (t.hero) {
        const c = t.hero, hand = [["main", !t.disarmed], ["off", !t.disarmedOff]].filter(([sl, free]) => free && c.equip[sl] && !c.equip[sl].broken).map(([sl]) => [sl, itemOf(c.equip[sl])])
          .filter(([, it]) => it && it.kindOf === "weapon" && it.group !== "shield" && !["tower-shield", "gloves"].includes(it.id));
        const opts = (c.bag || []).filter(e => e.t === "g" && lootNames.includes(e.id));
        if (hand.length && (u.side === "mon" || !opts.length || B.rnd(2) === 0)) {
          const [sl, it] = hand.find(([s]) => s === "main") || hand[0];
          B.S.drops.push({ kind: "weapon", hero: c.id, slot: sl, item: c.equip[sl], x: u.x, y: u.y, holder: u.id });
          if (sl === "off") t.disarmedOff = true; else t.disarmed = true;
          got = it.name.toLowerCase();
        } else if (opts.length) { const e = opts[B.rnd(opts.length)]; if (takeGear(c, e.id, 1)) { got = GEAR[e.id].name.toLowerCase(); (u.loot ||= []).push({ id: e.id, from: c.id }); } }
      }
      if (got && u.side === "mon" && !u.summon) thiefRun(u);
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
  // «Укус в ноги» (правка автора 02.11): провал — 2 хода цели каждые 2 пройденные клетки проверка Телосложения, провал — 1к4 (в moveAlong, статус hamstrung)
  A["dire-wolf"] = attackRider({ name: "Укус в ноги", kind: "melee", abil: "str", save: "str", tags: [], aiBonus: 3,
    onFail: async (t, u) => { addStatus(t, "hamstrung", { k: 2, when: "end", src: u.id, data: { by: u.id, dc: dcOf(u, "str"), cells: 0 } }); log(`${u.name} прокусывает ноги ${t.name}: каждые 2 клетки пути — проверка Телосложения.`, "skill"); fx(t, "укус в ноги", "bad"); } });

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
  P["giant-mole"] = { noSurprise(u) { return enemiesOf(u).some(e => !B.isFlying(e)); },
    // 09.11: «Под землёй» (особенность вида) — закапывается действием (ИИ: battle-ai.js, moleDig), в начале своего хода выныривает в 4,5 м, первая атака с преимуществом
    attackMods(att, ctx) { if (has(att, "emerged")) { ctx.adv.push("вынырнул из-под земли"); ctx.consume.push([att, "emerged"]); } },
    async turnStartAsync(u) { if (has(u, "underground") && P.burrower) await P.burrower.turnStartAsync(u); } };          // существо на земле в 18 м (всё поле) не застанет врасплох: засада не отнимает у крота первый ход
  A["giant-mole"] = saveArea({ name: "Сотрясение", radius: 3, side: "all", ground: true, abil: "str", save: "dex", dmg: "3к6", dt: "bludgeon", half: true, anim: "blunt", tags: ["prone"],
    onFail: async (t, u) => { B.knock(t, u); addStatus(t, "slowed", { k: 1, when: "end", data: { mult: 0.5 } }); fx(t, "сбит с ног", "bad"); } });

  /* ----- Болотный клык (7) -----
     Эссенция: пассивка «Удар из маскировки» (атака по возможности из маскировки +5 и шанс кровотечения) и активка «Слиться с топью» (невидимость после трёх ходов без движения).
     Особенности самого монстра (P["body:swamp-fang"]): «Из-под воды» и уход под воду в топи, «Мёртвая хватка» — атака, раз за бой (решение автора 27.10: это особенность вида, не навык эссенции). */
  P["swamp-fang"] = {
    attackMods(att, ctx) {
      if (!(ctx.o && ctx.o.reaction)) return;                                                // только атака по возможности (враг отходит от тебя)
      if (!has(att, "hidden")) return;                                                       // только из маскировки: скрыт или невидим
      ctx.mods.push({ l: "Удар из маскировки", v: 5 }); ctx.ambushBleed = true;
    },
    async afterAttack(u, c) {
      if (!c.ambushBleed || !c.res || !c.res.hit || !c.tgt || c.tgt.isObj || c.tgt.side === u.side || !alive(c.tgt) || (B.noBlood && B.noBlood(c.tgt))) return;
      const sv = await B.doSave(c.tgt, "con", dcOf(u, "str"), { label: `кровотечение (${u.name})` });
      if (!sv.ok) { addStatus(c.tgt, "bleeding", { k: 3, when: "end", src: u.id }); log(`${c.tgt.name} истекает кровью (3 хода).`, "skill"); fx(c.tgt, "кровотечение", "bad"); }
    },
  };
  A["swamp-fang"] = {
    time: "bonus",
    tgt() { return { type: "self" }; },
    can(u) { const h = has(u, "hidden"); if (h && h.data.invis) return "уже невидим"; return (u.still || 0) >= 3 ? true : `нужно простоять три хода без движения (сейчас ${u.still || 0})`; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "hidden", { k: Infinity, data: { invis: true, swampStill: true } }); fx(u, "слился с топью", "good"); log(`${u.name} сливается с топью и становится невидимым.`, "skill"); return true; },
    ai(u) { return (u.still || 0) >= 3 && !has(u, "hidden") && enemiesOf(u).length ? { score: 3 } : null; },
  };
  P["body:swamp-fang"] = {
    attackMods(att, ctx) {
      if (has(att, "emerged")) { ctx.adv.push("атака с тыла"); ctx.consume.push([att, "emerged"]); }
      const f = has(att, "firstblood"); if (f) { ctx.consume.push([att, "firstblood"]); if (inWater(att)) ctx.adv.push("Из-под воды"); }
      if (ctx.atk && ctx.atk.n === "Мёртвая хватка") ctx.extra.push({ n: 2, s: 6, b: 0, dt: ctx.atk.dt, label: "Мёртвая хватка", critDouble: true });
    },
    async afterAttack(u, c) {
      if (!c.atk || c.atk.n !== "Мёртвая хватка") return;
      (u.used ||= {})["atk:" + c.atk.id] = true;                                              // раз за бой
      const t = c.tgt; if (!c.res || !c.res.hit || !t || t.isObj || t.side === u.side || !(alive(t) || t.down) || !alive(t)) return;
      const dc = dcOf(u, "str"), sv = await B.doSave(t, "str", dc, { label: "Мёртвая хватка", tags: ["grapple"] });
      if (!sv.ok) { addStatus(t, "grappled", { k: Infinity, data: { by: u.id, dc, skill: "athletics", dmg: "1к6", dt: c.atk.dt, tick: "holder" } }); log(`${u.name} вцепляется в ${t.name} мёртвой хваткой.`, "skill"); fx(t, "схвачен", "bad"); }
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
      if (manual(tgt) && !(await B.promptReaction({ unit: tgt, title: "Подмена", text: `${c.att.name} попадает по вам. Поменяться местами с двойником, и пусть удар примет он?` }))) return false;
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
    time: "action", blindOK: true,          // звонит и до того, как увидел героев (туман часовни)
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
    ai(u) { return enemiesOf(u).length && !B.doublesOf(u).length ? { score: 40 } : null; },          // 09.11: раньше оценка 4 всегда проигрывала удару — звонарь не звонил вовсе; теперь звонит, когда двойников нет (перезарядка 6)
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
  A["bone-knight"] = charge({ name: "Рывок мертвеца", dt: null, need: "нужен меч", noProvoke: true, pred: (a, u) => (u && u.side === "mon" && !u.hero) || SWORDS.includes(a.w ? a.w.id : a.id), extra: { n: 2, s: 6, label: "Рывок мертвеца" }, abil: "str", save: "str", tags: ["prone"],
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

  /* ===== Звон (3 этаж; решения автора 27.10) =====
     B.noise(u, n, why) — монстр или событие в бою поднимает шум; шкала общая с картой (f3Noise в index.html). Дошла до 20 — на поле приходит Хранитель Тишины (B.summonKeeper). */
  B.NOISE_BY_CLS = { 9: 1, 8: 2, 7: 4, 6: 7 };
  B.noise = function (u, n, why) {
    const S = B.S; if (!S || (S.floor || 1) < 3 || !(n > 0)) return;
    log(`${u.name}: звон! ${why || ""} (шум +${n})`, "skill"); fx(u, "звон", "bad");
    if (typeof f3Noise === "function") f3Noise(n, `${u.name}${why ? ": " + why : ""}`);
  };
  B.summonKeeper = function () {
    const S = B.S; if (!S) return null;
    const idx = S.units.filter(x => x.side === "mon").length, k = B.monUnit("silence-keeper", idx), tmp = { size: k.size, w: k.w, h: k.h, side: "mon", id: "tmpkeeper" };
    const cells = []; for (let y = 0; y < Math.min(3, B.H); y++) for (let x = 0; x < B.W; x++) if (B.canStand(k, x, y) && !live().some(o => o.x === x && o.y === y)) cells.push([x, y]);
    const c = cells.length ? cells[Math.floor(cells.length / 2)] : (B.freeCellsNear({ x: Math.floor(B.W / 2), y: 0, size: 1, side: "mon", id: "x" }, 4, tmp)[0] || [0, 0]);
    k.x = c[0]; k.y = c[1]; k.startCell = [k.x, k.y];
    if (S.ev && Array.isArray(S.ev.list)) S.ev.list.push("silence-keeper");
    B.addUnit(k, S.order[S.turn]);
    log("Из тишины выходит Хранитель Тишины: шум Звона созвал его.", "bad"); const g = ui(); if (g) { g.banner("Приходит Хранитель Тишины!"); g.fxText(k, "приходит", "bad"); }
    return k;
  };
  // Хранитель Тишины: ослабев (< 40 % ОЗ), за 3 своих хода не убитый — звонит (+7 шума); счёт идёт заново.
  P["body:silence-keeper"] = {
    turnEnd(u) {
      if (u.hp * 100 >= u.maxHp * 40 || !alive(u)) { if (u.flags) u.flags.keeperT = 0; return; }
      u.flags = u.flags || {}; u.flags.keeperT = (u.flags.keeperT || 0) + 1;
      if (u.flags.keeperT >= 3) { u.flags.keeperT = 0; B.noise(u, B.NOISE_BY_CLS[6], "ослабевший хранитель звонит"); }
    },
  };

  /* ===== свет и стартовые состояния ===== */
  const prevInit = B.initUnit;
  B.initUnit = function (u) {
    if (prevInit) prevInit(u);
    if (u.ref === "swamp-fang") addStatus(u, "firstblood", { k: Infinity });               // особенность вида: первая атака в бою из воды — с преимуществом (у героя с эссенцией её нет)
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
    speedBonus(u) { const tt = B.tinfo(u.x, u.y); let b = tt && tt.deep ? 2 : waterAt(u) ? 0 : -2; if (has(u, "coiled")) b -= Math.floor(Math.max(u.speedC, u.flyC) / 2); return b; },
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
  // Решение автора: в бою с глубинным змеем на поле озеро; вода подступает (каждый второй раунд одна соседняя клетка уходит под воду); змей, начавший ход в глубокой воде, бьёт внезапно (преимущество).
  const prevRoundLake = B.onRound;
  B.onRound = function (round) {
    if (prevRoundLake) prevRoundLake.apply(this, arguments);
    const S = B.S; if (!S || !S.lake || round % 2 !== 0) return;
    const cand = [];
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      if (S.cells[y][x] || B.obstacleAt(x, y)) continue;
      let near = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < B.W && Y < B.H && S.cells[Y][X] === "deep") near = true; }
      if (near && !live().some(o => o.x === x && o.y === y)) cand.push([x, y]);
    }
    if (!cand.length) return; const [cx, cy] = cand[B.rnd(cand.length)]; S.cells[cy][cx] = "deep";
    log("Вода подступает: ещё одна клетка уходит под воду.", "skill"); if (ui()) ui().refresh();
  };
  P["deep-serpent"].turnStartAsync = async function (u) { const tt = B.tinfo(u.x, u.y); if (u.side === "mon" && tt && tt.deep) { addStatus(u, "emerged", { k: 0, when: "end" }); fx(u, "из воды", "good"); } };
  P["deep-serpent"].attackMods = (function (old) { return function (att, ctx) { old(att, ctx); if (has(att, "emerged")) { ctx.adv.push("бьёт из воды"); ctx.consume.push([att, "emerged"]); } }; })(P["deep-serpent"].attackMods);
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
    else if (el === "lightning") { if (t.t) t.t.noReact = true; addStatus(t, "slowed", { k: 1, when: "end", data: { add: -2 } }); fx(t, "без реакций, медленнее", "bad"); }          // решение автора: молния ещё и замедляет (−3 м)
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
    log(`${u.name}: нестабильность — уязвимость к урону «${dt === "thunder" ? "ветром" : (D.DT[dt] || dt)}».`, "skill");
  };


  /* ===================== Лес гоблинов: крысы, крысиный король, гоблин-крысолов (черновик campaign/drafts.md) ===================== */
  const ratsOf = o => B.summonsOf(o).filter(s => s.kind === "rat");
  function spawnRat(owner, cell) {
    const S = B.S, w = B.monUnit("rat", -1); S.ratSeq = Math.max((S.ratSeq || 0), S.units.filter(x => x.ref === "rat").length) + 1;          // номер после крыс из списка встречи
    Object.assign(w, { summon: true, kind: "rat", owner: owner.id, side: owner.side, idx: null, ess: [], pass: ["body:rat"], auto: true, name: "Крыса " + S.ratSeq, base: "Крыса" });          // auto: призванные крысы ходят сами (ИИ), игрок их не водит
    w.ai = Object.assign({}, w.ai, { noFlee: true, fleeHp: null, morale: null, role: "swarm", focus: ["nearest", "weak"] });
    w.x = cell[0]; w.y = cell[1]; B.addUnit(w, owner.id); return w;
  }
  const tmpRat = owner => ({ size: 1, side: owner.side, id: "tmprat" });
  // n крыс в свободных клетках рядом с хозяином
  function summonRats(owner, n, r = 2) {
    const out = [], cells = B.freeCellsNear(owner, r, tmpRat(owner));
    for (let i = 0; i < n && i < cells.length; i++) out.push(spawnRat(owner, cells[i]));
    return out;
  }
  // «Стена крыс»: три крысы в ряд перед хозяином, лицом к ближайшему врагу
  function summonWall(owner, n) {
    const es = enemiesOf(owner); if (!es.length) return [];
    const e = es.sort((a, b) => dist(owner, a) - dist(owner, b))[0], dx = Math.sign(e.x - owner.x), dy = Math.sign(e.y - owner.y);
    const fx = owner.x + (dx || 0), fy = owner.y + (dy || 0), px = dy !== 0 && dx === 0 ? 1 : dx !== 0 && dy === 0 ? 0 : -dy, py = dy !== 0 && dx === 0 ? 0 : dx !== 0 && dy === 0 ? 1 : dx;
    const want = [[fx, fy], [fx + px, fy + py], [fx - px, fy - py]], out = [], t = tmpRat(owner), used = new Set();
    for (const [x, y] of want) if (out.length < n && B.inB(x, y) && B.canStand(t, x, y) && !live().some(o => o.x === x && o.y === y)) { out.push(spawnRat(owner, [x, y])); used.add(x + "," + y); }
    for (const c of B.freeCellsNear(owner, 3, t)) { if (out.length >= n) break; if (!used.has(c[0] + "," + c[1])) out.push(spawnRat(owner, c)); }
    return out;
  }
  // Зов дудки (особенность монстра, не часть эссенции): каждый свой ход бонусным действием ещё две крысы, пока рядом их меньше шести
  B.callRats = async function (u) {
    const have = ratsOf(u).length; if (have >= 6 || !B.timeOK(u, "bonus")) return false;
    const got = summonRats(u, Math.min(2, 6 - have), 3); if (!got.length) return false;
    B.spendTime(u, "bonus"); log(`${u.name} играет на дудке: прибегают крысы (${have + got.length}).`, "skill"); fx(u, "зов дудки", "good");
    if (ui()) ui().refresh(); return true;
  };

  /* Крыса (9) */
  P.rat = { resist(u, c) { return c.dt === "poison"; } };
  A.rat = {
    time: "bonus",
    tgt() { return { type: "self" }; },
    can(u) { return speedOf(u) > 0 ? true : "не может двигаться"; },
    async run(u, pk, ctl) { ctl.commit(); const ok = await stepMove(u, 2, { prompt: "Юркий рывок: на 3 м без атак по возможности", auto: cells => farthestSpot(u, cells), free: true }); if (ok) log(`${u.name} юркает в сторону.`, "skill"); return true; },
    ai(u) { return speedOf(u) > 0 && u.hp < u.maxHp * 0.6 && enemiesOf(u).some(e => dist(e, u) <= 1) ? { score: 2.5 } : null; },
  };
  /* Крысиный король (8) */
  P["rat-king"] = { defendMods(t, ctx) { if (ctx.o && ctx.o.reaction && alliesOf(t).filter(a => dist(a, t) <= 1 && alive(a) && !a.down).length >= 2) ctx.dis.push("Не тронь короля"); } };
  A["rat-king"] = {
    time: "action",
    tgt() { return { type: "self" }; },
    can(u) { return ratsOf(u).length < 2 ? true : "уже 2 крысы"; },
    async run(u, pk, ctl) { ctl.commit(); const got = summonRats(u, 2 - ratsOf(u).length); if (ui()) ui().banner(`${u.name}: Призыв стаи!`); log(`${u.name} зовёт крыс (${got.length}).`, "skill"); return true; },
    ai(u) { return ratsOf(u).length < 2 && enemiesOf(u).length ? { score: 3 } : null; },
  };
  /* Гоблин-крысолов (7): «Флейта» — вне боя (приложение), «Стена крыс» */
  P["rat-catcher"] = {};
  A["rat-catcher"] = {
    time: "action",
    tgt() { return { type: "self" }; },
    can(u) { return !enemiesOf(u).length ? "нет врагов" : ratsOf(u).length < 3 ? true : "уже 3 крысы"; },
    async run(u, pk, ctl) { ctl.commit(); const got = summonWall(u, 3 - ratsOf(u).length); if (ui()) ui().banner(`${u.name}: Стена крыс!`); log(`${u.name} выставляет стену крыс (${got.length}).`, "skill"); return true; },
    ai(u) { return ratsOf(u).length < 3 && enemiesOf(u).length ? { score: 3.5 } : null; },
  };
  const prevDownRats = B.onDown;
  B.onDown = function (u, dead) {
    if (prevDownRats) prevDownRats.apply(this, arguments);
    if (u.ref === "rat-catcher" && (dead || !u.alive)) {          // убили крысолова — крысы разбегаются
      const rs = live().filter(o => o.kind === "rat" && o.owner === u.id); rs.forEach(o => { o.flags.fleeing = true; });
      if (rs.length) log("Крысы разбегаются без своего крысолова.", "flee");
    }
  };

  /* ===== 3 этаж: Лагерь орков (утверждено автором 01.11; тексты — ESSENCES в index.html) ===== */
  Object.assign(D.essCd, { "orc-wolf": 2, "orc-falcon": 3, "orc-scout": 3, "orc-spear": 2, "orc-thrower": 3, "orc-guard": 4, "orc-shaman": 4, "orc-executioner": 3, "orc-chief": 4 });
  Object.assign(D.status, {
    shieldwall: { name: "Сомкнутый строй", good: true, ico: '<path d="M4 5h7v14H4zM13 5h7v14h-7z"/>', desc: "+2 к КД до начала хода вожака стражи." },
    warcry:     { name: "Боевой клич", good: true, ico: '<path d="M4 9v6h4l6 4V5L8 9z"/><path d="M17 8a5 5 0 010 8"/>', desc: "Преимущество на первую атаку." },
    hamstrung:  { name: "Прокушены ноги", good: false, ico: '<path d="M8 4v8l-3 8M14 4v8l3 8M6 12h10"/>', desc: "2 хода: за каждые 2 пройденные клетки — проверка Телосложения, провал — 1к4 урона." },
    hounded:    { name: "Загнан", good: false, ico: '<path d="M4 18l4-6 3 3 4-7 5 10"/>', desc: "Пока рядом загнавший волк, скорость вдвое меньше." },
    hawkmark:   { name: "Метка сокола", good: false, ico: '<path d="M12 3l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z"/>', desc: "Атаки по этой цели (со стороны метившего) получают +2 к попаданию." },
  });
  Object.assign(D.monTune, {
    "orc-wolf": { role: "swarm", circle: true, focus: ["weak", "nearest"], fleeHp: 0.3 },
    "orc-falcon": { role: "skirmisher", hitRun: true, flitter: true, focus: ["weak", "nearest"], fleeHp: 0.4 },
    "orc-scout": { role: "skirmisher", focus: ["weak", "hidden", "nearest"], fleeHp: 0.25 },
    "orc-spear": { role: "secondLine", focus: ["nearest"], fleeHp: 0.2 },
    "orc-thrower": { role: "ranged", keep: 2, ranged: "ifNoMelee", focus: ["weak", "nearest"], fleeHp: 0.2 },
    "orc-guard": { role: "brute", focus: ["attacker", "nearest"], noFlee: true },
    "orc-shaman": { role: "ranged", keep: 3, focus: ["cluster", "weak"], noFlee: true },
    "orc-executioner": { role: "brute", focus: ["runner", "weak", "nearest"], noFlee: true },
    "orc-chief": { role: "brute", focus: ["attacker", "nearest"], noFlee: true },
  });
  const allies = u => live().filter(o => o.side === u.side && o.id !== u.id && alive(o) && !o.down);
  const thrownAtk = u => B.attacksOf(u).find(a => a.thrown || / \(метнуть\)$/.test(a.n || "")) || null;

  /* Ездовой волк (9): «Погоня», «Рывок» */
  P["orc-wolf"] = { attackMods(att, ctx) { if (ctx.melee && att.t && att.t.moved >= 2) ctx.extra.push({ n: 1, s: 4, b: 0, dt: ctx.atk.dt, label: "Погоня" }); } };
  // «Загнать»: пока загнанный стоит рядом с волком, его скорость вдвое меньше (считается в speedOf через slowAura волка)
  P["orc-wolf"].slowAura = (e, { u }) => { const h = has(u, "hounded"); return h && h.data.by === e.id && alive(e) && !e.down && dist(e, u) <= 1 ? Math.ceil(Math.max(u.speedC, u.flyC) / 2) : 0; };
  A["orc-wolf"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Загнать: кого?", within(u, 1).filter(t => !has(t, "hounded")), cellsAround(u, 1), "debuff"); },
    can(u) { return within(u, 1).some(t => !has(t, "hounded")) ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit, sv = await save(t, "wis", dcOf(u, "dex"), "Загнать", ["slow"], u);
      if (!sv.ok) { addStatus(t, "hounded", { k: 2, when: "end", src: u.id, data: { by: u.id } }); log(`${u.name} загоняет ${t.name}: рядом с волком скорость вдвое меньше.`, "skill"); fx(t, "загнан", "bad"); }
      return true;
    },
    ai(u) { const ts = within(u, 1).filter(t => !has(t, "hounded")); return ts.length ? { unit: ts.sort((a, b) => (b.ranged ? 1 : 0) - (a.ranged ? 1 : 0))[0], score: 2.5 } : null; },
  };

  /* Сокол-разведчик (9): «Взгляд с высоты» (+1 к пассивному Восприятию; на карте — в приложении), «Метка с высоты» */
  P["orc-falcon"] = { passivePerception() { return 1; } };
  A["orc-falcon"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Метка с высоты: на кого?", within(u, 6), cellsAround(u, 6), "debuff"); },
    can(u) { return within(u, 6).length ? true : "некого метить"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit; addStatus(t, "hawkmark", { k: 2, when: "end", data: { side: u.side, by: u.id } });
      log(`${u.name} метит ${t.name}: атаки по нему +2.`, "skill"); fx(t, "метка", "bad"); return true;
    },
    ai(u) { const ts = within(u, 6).filter(t => !has(t, "hawkmark")); return ts.length && allies(u).length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 2.5 } : null; },
  };

  /* Орк-разведчик (8): «Тропа орков» (Скрытность с преимуществом у укрытия), «Бросок из тени» */
  const coverNear = u => { for (let y = u.y - 1; y <= u.y + 1; y++) for (let x = u.x - 1; x <= u.x + 1; x++) { const t = B.tinfo(x, y); if (t && (t.obstacle || t.cover || t.thicket || t.blocksSight)) return true; } return false; };
  P["orc-scout"] = { checkMods(u, ctx) { if (ctx.skill === "stealth" && coverNear(u)) ctx.adv.push("Тропа орков"); } };
  A["orc-scout"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Бросок из тени: на кого?", within(u, 3), cellsAround(u, 3), "attack"); },
    can(u) { return atkFor(u, "melee") ? (within(u, 3).length ? true : "никого в 3 клетках") : "нужна атака ближнего боя"; },
    async run(u, pk, ctl) {
      const t = pk.unit, a = atkFor(u, "melee"); if (!a) return false;
      const wasHidden = !!has(u, "hidden");
      if (dist(u, t) > 1) await stepMove(u, 2, { prompt: "Бросок из тени: куда прыгнуть?", auto: cells => cells.filter(c => distCell(t, c.x, c.y) <= 1).sort((p, q) => distCell(t, p.x, p.y) - distCell(t, q.x, q.y))[0] || cells.sort((p, q) => distCell(t, p.x, p.y) - distCell(t, q.x, q.y))[0] });
      if (dist(u, t) > 1 || !alive(t)) { ctl.commit(); log(`${u.name}: до цели не допрыгнуть.`); return true; }
      const r = await B.doAttack(u, t, a, { adv: wasHidden ? ["из тени"] : [], onCommit: () => { B.commitAttack(u, a, t); ctl.commit(); } });
      return !r.cancelled;
    },
    ai(u) { const a = atkFor(u, "melee"), ts = within(u, 3).filter(t => dist(u, t) > 1 || has(u, "hidden")); if (!ts.length || !a) return null; return { atk: a, targets: ts, bonus: has(u, "hidden") ? 4 : 2, attackAbility: true }; },          // прыжок к тем, до кого не дотянуться, или удар из скрытности
  };

  /* Орк-копейщик (8): «Частокол», «Отгон» */
  P["orc-spear"] = {
    async reactEnter(e, mover, from) {
      const a = atkFor(e, "melee"); if (!a) return; const r = a.reach || 1, S = B.S;
      if (dist(e, mover) > r || (from && B.distAt(e, mover, from[0], from[1]) <= r)) return;
      if (e.palisade === S.round) return; e.palisade = S.round;
      const v = roll(1, 4).total; log(`${e.name}: частокол — ${mover.name} напарывается (${v}).`, "skill");
      await B.applyDamage(e, mover, [{ v, dt: "pierce", label: "Частокол" }], { src: e });
    },
  };
  A["orc-spear"] = attackRider({ name: "Отгон", kind: "melee", aiBonus: 2.5,
    onHit: async (t, u) => { if (alive(t) && !t.down && t.size <= u.size) { await B.push(t, u.x, u.y, 1); fx(t, "отброшен", "bad"); } } });

  /* Орк-метатель топоров (8): «Широкий замах» (+2 клетки к метанию), «Град топоров» */
  const prevAttacksOf = B.attacksOf;
  B.attacksOf = u => { const list = prevAttacksOf(u); if (!u.pass || !u.pass.includes("orc-thrower")) return list;
    return list.map(a => (a.thrown || / \(метнуть\)$/.test(a.n || "")) && a.range ? { ...a, range: [a.range[0] + 2, a.range[1] + 2] } : a); };
  P["orc-thrower"] = {};
  A["orc-thrower"] = {
    time: "action",
    tgt(u) { const a = thrownAtk(u); const ts = a ? B.attackTargets(u, a) : []; return specUnit(u, "Град топоров: первая цель", ts, a ? B.rangeCells(u, a) : [], "attack"); },
    can(u) { const a = thrownAtk(u); if (!a) return "нужно метательное оружие"; return B.attackTargets(u, a).length ? true : "нет целей"; },
    async run(u, pk, ctl) {
      const a = thrownAtk(u); if (!a) return false; let committed = false;
      const commitOnce = () => { if (!committed) { committed = true; ctl.commit(); } };
      const r1 = await B.doAttack(u, pk.unit, { ...a, thrown: false }, { onCommit: commitOnce });
      if (r1.cancelled && !committed) return false;
      const ts = B.attackTargets(u, a); if (!ts.length) return true;
      const t2 = ts.includes(pk.unit) && !manual(u) ? pk.unit : await chooseTarget(u, ts, "Град топоров: второй бросок", "attack");
      if (t2) await B.doAttack(u, t2, { ...a, thrown: false }, { onCommit: commitOnce });
      return true;
    },
    ai(u) { const a = thrownAtk(u); if (!a) return null; const ts = B.attackTargets(u, a); return ts.length ? { atk: a, targets: ts, bonus: 4, attackAbility: true } : null; },
  };

  /* Вожак стражи (7): «Строй» (союзники в 2 клетках +1 КД), «Сомкнуть строй» */
  P["orc-guard"] = { acAura(a, { tgt }) { return tgt.id !== a.id && dist(a, tgt) <= 2 && alive(a) && !a.down ? 1 : 0; } };
  A["orc-guard"] = {
    time: "bonus",
    tgt() { return { type: "self" }; },
    can() { return true; },
    async run(u, pk, ctl) {
      ctl.commit(); const who = [u, ...allies(u).filter(o => dist(u, o) <= 1)];
      for (const o of who) addStatus(o, "shieldwall", { k: 1, when: "start", src: u.id, data: { endAtStartOf: u.id } });
      log(`${u.name}: сомкнуть строй! +2 КД (${who.length}).`, "skill"); if (ui()) ui().banner(`${u.name}: Сомкнуть строй!`); return true;
    },
    ai(u) { const n = allies(u).filter(o => dist(u, o) <= 1).length; return enemiesOf(u).some(e => dist(u, e) <= 3) && n >= 1 ? { score: 2 + n } : null; },
  };

  /* Шаманка костров (7): «Угли в руках» (+1к4 к огненным атакам), «Костёр» */
  P["orc-shaman"] = { dmgOut(src, { o }) { const dt = o && o.ctx && o.ctx.atk && o.ctx.atk.dt; return dt === "fire" ? roll(1, 4).total : 0; } };
  const bonfireCells = (x, y) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].filter(([cx, cy]) => B.inB(cx, cy) && !(B.tinfo(cx, cy) || {}).obstacle);
  A["orc-shaman"] = {
    time: "action",
    tgt(u) { const cells = cellsAround(u, 6); return { type: "cell", prompt: "Костёр: левый верхний угол квадрата 2 × 2", cells, kind: "area" }; },
    can() { return true; },
    async run(u, pk, ctl) {
      if (!pk.cell) return false; ctl.commit(); const S = B.S, cells = bonfireCells(pk.cell[0], pk.cell[1]);
      const rec = { until: S.round + 10, cells: cells.map(([x, y]) => ({ x, y, prev: S.cells[y][x] })) };
      for (const c of rec.cells) S.cells[c.y][c.x] = "fire";
      (S.bonfires ||= []).push(rec);
      for (const o of live()) if (cells.some(([x, y]) => footprint(o).some(([fx0, fy0]) => fx0 === x && fy0 === y))) { const h = has(o, "hidden"); if (h && h.data && h.data.invis) { removeStatus(o, "hidden"); log(`${o.name}: огонь выдаёт невидимку.`); } }
      log(`${u.name} разжигает костёр.`, "skill"); if (ui()) { ui().banner(`${u.name}: Костёр!`); ui().refresh(); } return true;
    },
    ai(u) {
      const es = enemiesOf(u).filter(e => dist(u, e) <= 6); if (!es.length) return null;
      let best = null; for (const e of es) for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const x = e.x + ox, y = e.y + oy, cs = bonfireCells(x, y);
        const hit = enemiesOf(u).filter(o => cs.some(([cx, cy]) => o.x === cx && o.y === cy)).length, own = allies(u).filter(o => cs.some(([cx, cy]) => o.x === cx && o.y === cy)).length;
        if (hit && !own && (!best || hit > best.hit)) best = { cell: [x, y], hit }; }
      return best ? { cell: best.cell, score: 4 + best.hit * 4 } : null;
    },
  };
  const prevRoundOrc = B.onRound;
  B.onRound = function (round) {
    if (prevRoundOrc) prevRoundOrc.apply(this, arguments);
    const S = B.S; if (!S || !S.bonfires) return;
    S.bonfires = S.bonfires.filter(r => { if (S.round < r.until) return true; for (const c of r.cells) if (S.cells[c.y][c.x] === "fire") S.cells[c.y][c.x] = c.prev || null; log("Костёр шаманки догорел."); return false; });
  };

  /* Цепной палач (7): «Тяжёлые цепи» (враги в 2 клетках −1 клетка скорости), «Захват цепью» */
  P["orc-executioner"] = { slowAura(e, { u }) { return alive(e) && !e.down && dist(e, u) <= 2 ? 1 : 0; } };
  A["orc-executioner"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Захват цепью: кого?", within(u, 2).filter(t => !has(t, "grappled")), cellsAround(u, 2), "debuff"); },
    can(u) { return within(u, 2).some(t => !has(t, "grappled")) ? true : "некого достать"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit; if (ui()) ui().banner(`${u.name}: Захват цепью!`);
      const sv = await save(t, "str", dcOf(u, "str"), "Захват цепью", ["grapple"], u);
      if (sv.ok) { log(`${t.name} сбрасывает цепь.`); return true; }
      if (dist(u, t) > 1 && t.size <= u.size) {
        const spots = B.freeCellsNear(u, 1, t).sort((p, q) => distCell(t, p[0], p[1]) - distCell(t, q[0], q[1]));
        if (spots.length) { t.x = spots[0][0]; t.y = spots[0][1]; fx(t, "притянут", "bad"); }
      }
      addStatus(t, "grappled", { k: Infinity, data: { by: u.id, dc: dcOf(u, "str") } }); log(`${u.name} притягивает ${t.name} цепью и держит.`, "skill");
      if (ui()) ui().refresh(); return true;
    },
    ai(u) { const ts = within(u, 2).filter(t => !has(t, "grappled")); if (!ts.length) return null; const far = ts.filter(t => dist(u, t) > 1); const t = (far.length ? far : ts).sort((a, b) => b.hp - a.hp)[0]; return { unit: t, score: far.length ? 12 : 7 }; },          // притянуть дальнего — важнее удара
  };

  // Сокол-одиночка: если его не убили до его первого хода, он зовёт орков (2–3 с верхнего края поля). Решение автора 26.10.
  B.spawnFoes = function (ids, near) {
    const S = B.S, got = [];
    for (const id of ids) {
      const m = B.monUnit(id, S.ev.list.length), tmp = { size: m.size, w: m.w, h: m.h, side: "mon", id: "tmp" };
      const cells = []; for (let y = 0; y < Math.min(2, B.H); y++) for (let x = 0; x < B.W; x++) if (B.canStand(tmp, x, y) && !live().some(o => footprint(o).some(([fx0, fy0]) => fx0 === x && fy0 === y))) cells.push([x, y]);
      const c = cells.length ? cells[Math.floor(Math.random() * cells.length)] : (B.freeCellsNear(near || { x: Math.floor(B.W / 2), y: 0, size: 1, side: "mon", id: "x" }, 3, tmp)[0]);
      if (!c) continue; m.x = c[0]; m.y = c[1]; S.ev.list.push(id); B.addUnit(m, S.order[S.turn]); got.push(m);
    }
    if (ui()) ui().refresh(); return got;
  };
  P["body:orc-falcon"] = {
    async turnStartAsync(u) {
      const S = B.S; if (!S.ev || !S.ev.falconAlone || S.falconCalled || u.side !== "mon") return; S.falconCalled = true;
      const n = 2 + (Math.random() < .5 ? 1 : 0), pool = ["orc-scout", "orc-spear", "orc-spear", "orc-thrower"], ids = []; for (let i = 0; i < n; i++) ids.push(pool[Math.floor(Math.random() * pool.length)]);
      log(`${u.name} пронзительно кричит — на зов бегут орки!`, "bad"); if (ui()) ui().banner("Сокол зовёт орков!");
      const got = B.spawnFoes(ids, u); log(`Прибежали: ${got.map(m => m.name).join(", ")}.`, "bad");
      if (u.t) u.t.action = 0;          // зов — это его действие
    },
  };
  /* Вождь орков (6): «Железная воля», «Боевой клич» */
  P["orc-chief"] = { saveMods(u, ctx) { if ((ctx.tags || []).some(t => /fright|fear|stun/.test(t))) ctx.adv.push("Железная воля"); } };
  A["orc-chief"] = {
    time: "bonus",
    tgt() { return { type: "self" }; },
    can(u) { return allies(u).some(o => dist(u, o) <= 4) ? true : "нет союзников рядом"; },
    async run(u, pk, ctl) {
      ctl.commit(); const who = allies(u).filter(o => dist(u, o) <= 4);
      for (const o of who) addStatus(o, "warcry", { k: 2, when: "end", src: u.id });
      log(`${u.name}: боевой клич! (${who.length})`, "skill"); if (ui()) ui().banner(`${u.name}: Боевой клич!`); return true;
    },
    ai(u) { const n = allies(u).filter(o => dist(u, o) <= 4).length; return n >= 1 && enemiesOf(u).length ? { score: 2 + n } : null; },
  };


  /* ===================== 3 этаж: Звон и Хор мёртвых, Храм изваяний (03.11; тексты — ESSENCES в index.html, допущения — campaign/drafts.md) ===================== */
  Object.assign(D.essCd, { "toll-beetle": 3, "echo-jackal": 2, "toll-rat": 2, "toll-guard": 4, shrieker: 3, "toll-bull": 3, "bell-ringer": 99, "toll-hunter": 99, "choir-dead": 4,
    "stone-acolyte": 2, "dust-cherub": 3, caryatid: 4, "marble-halberdier": 2, "marble-guardian": 4, "marble-saint": 3, "faceless-sculptor": 3 });
  Object.assign(D.status, {
    shieldhum: { name: "Гул щита", good: true, ico: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>', desc: "+2 к КД." },
    tollhum:   { name: "Гул", good: true, ico: '<path d="M5 12a7 7 0 0114 0M8 12a4 4 0 018 0"/>', desc: "+1 к КД до своего хода." },
    screeched: { name: "Оглушён визгом", good: false, atkDis: true, ico: '<path d="M4 9v6h4l6 4V5L8 9z"/><path d="M18 6l3 3M18 12h3M18 18l3-3"/>', desc: "Атакует с помехой." },
    sanded:    { name: "Песок в глазах", good: false, atkDis: true, ico: '<circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><path d="M4 18h16"/>', desc: "Следующая атака с помехой." },
    choirjoin: { name: "Единение хора", good: true, ico: '<circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M10 12h4"/>', desc: "+1 к КД, пока стоишь вплотную к участнику хора." },
    faithwall: { name: "Стена веры", good: true, ico: '<path d="M4 20V8l8-5 8 5v12z"/>', desc: "Сопротивление колющему, рубящему и дробящему урону." },
  });
  Object.assign(D.monTune, {
    "toll-beetle": { role: "swarm", focus: ["nearest"], fleeHp: 0.3 }, "echo-jackal": { role: "swarm", circle: true, focus: ["weak", "nearest"], fleeHp: 0.35 },
    "toll-rat": { role: "skirmisher", hitRun: true, focus: ["weak", "nearest"], fleeHp: 0.4 }, "toll-guard": { role: "brute", focus: ["nearest"], noFlee: true },
    shrieker: { role: "ranged", keep: 3, focus: ["cluster", "weak"], fleeHp: 0.3 }, "toll-bull": { role: "brute", focus: ["ranged", "weak", "nearest"], noFlee: true },
    "bell-ringer": { role: "secondLine", focus: ["weak", "nearest"], noFlee: true }, "toll-hunter": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
    "choir-dead": { role: "secondLine", keep: 3, focus: ["cluster", "nearest"], noFlee: true },
    "stone-acolyte": { role: "swarm", focus: ["nearest"], noFlee: true }, "dust-cherub": { role: "skirmisher", hitRun: true, flitter: true, focus: ["weak", "nearest"], fleeHp: 0.3 },
    caryatid: { role: "guardian", leash: 2, focus: ["nearest"], noFlee: true }, "marble-halberdier": { role: "secondLine", focus: ["nearest"], noFlee: true },
    "marble-guardian": { role: "brute", focus: ["attacker", "nearest"], noFlee: true }, "marble-saint": { role: "secondLine", focus: ["weak", "nearest"], noFlee: true },
    "faceless-sculptor": { role: "brute", focus: ["attacker", "nearest"], noFlee: true },
  });
  const friends = u => live().filter(o => o.side === u.side && o.id !== u.id && alive(o) && !o.down);
  const PHYS = ["pierce", "slash", "bludgeon"];

  /* Звонкий жучок (9): «Гудящий хитин» — первый полученный за бой урон −2; «Гул» — реакцией +1 КД до своего хода */
  P["toll-beetle"] = {
    dmgFlat(u, { v }) { if (u.flags.hitin || !(v > 0)) return 0; u.flags.hitin = true; return -Math.min(2, v); },
    defendMods(t, ctx) { if (t.side !== "mon" || has(t, "tollhum") || (t.cd && t.cd["toll-beetle"] > 0) || !t.t || !t.t.react) return; addStatus(t, "tollhum", { k: 1, when: "start" }); t.t.react = 0; B.setCd && B.setCd(t, "toll-beetle", D.essCd["toll-beetle"]); },
    acBonus(u) { return has(u, "tollhum") ? 1 : 0; },
  };
  A["toll-beetle"] = { time: "bonus", tgt() { return { type: "none" }; }, can(u) { return has(u, "tollhum") ? "уже гудит" : true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "tollhum", { k: 1, when: "start" }); log(`${u.name} гудит: +1 КД.`, "skill"); fx(u, "гул", "good"); return true; }, ai() { return null; } };

  /* Эхо-шакал (9): «Чуткий слух» (не застать врасплох), «Эхо» — союзник попал, шакал бьёт ту же цель вполсилы (реакция) */
  P["echo-jackal"] = {
    async allyHitAsync(a, att, tgt) {
      if (a.side !== "mon" || !a.t || !a.t.react || (a.cd && a.cd["echo-jackal"] > 0) || !alive(tgt) || tgt.down || !B.canSeeUnit(a, tgt)) return;
      const k = atkFor(a, "melee"); if (!k || dist(a, tgt) > (k.reach || 1)) return;
      a.t.react = 0; if (B.setCd) B.setCd(a, "echo-jackal", D.essCd["echo-jackal"]); log(`${a.name}: эхо — бьёт следом.`, "skill");
      await B.doAttack(a, tgt, k, { scale: 0.5, echo: true, noRedirect: true });
    },
  };
  A["echo-jackal"] = { time: "react", tgt() { return { type: "none" }; }, can() { return "срабатывает само, когда союзник попадает"; }, async run() { return false; }, ai() { return null; } };

  /* Колокольная крыса (9): «Чуткие усы» (ловушки рядом видны), «Колокольчик на хвосте» — спасбросок Мудрости, провал: без реакций до конца своего хода */
  P["toll-rat"] = {};
  Object.assign(D.status, { bellnoise: { name: "Отвлечён звоном", good: false, ico: '<path d="M12 4a5 5 0 015 5v4l2 3H5l2-3V9a5 5 0 015-5zM10 19a2 2 0 004 0"/>', desc: "Не может совершать реакции до конца своего хода." } });
  A["toll-rat"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Колокольчик на хвосте: кого отвлечь?", within(u, 4).filter(t => !has(t, "bellnoise")), cellsAround(u, 4), "debuff"); },
    can(u) { return within(u, 4).some(t => !has(t, "bellnoise")) ? true : "некого отвлечь"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit, sv = await save(t, "wis", dcOf(u, "dex"), "Колокольчик на хвосте", ["sound"], u);
      if (!sv.ok) { addStatus(t, "bellnoise", { k: 1, when: "end" }); if (t.t) t.t.react = 0; log(`${t.name} оборачивается на звон: без реакций до конца своего хода.`, "skill"); fx(t, "отвлечён", "bad"); } return true; },
    ai(u) { const ts = within(u, 4).filter(t => !has(t, "bellnoise")); return ts.length ? { unit: ts.sort((a, b) => dist(u, a) - dist(u, b))[0], score: 2 } : null; },
  };
  /* Гулкий страж (8): «Тяжёлая стойка» (не сдвинуть, не сбить), «Гул щита» +2 КД на 2 раунда */
  P["toll-guard"] = { immune(u, { id }) { return id === "prone"; }, saveMods(u, ctx) { if ((ctx.tags || []).some(t => ["shove", "push", "grapple"].includes(t))) ctx.adv.push("тяжёлая стойка"); }, acBonus(u) { return has(u, "shieldhum") ? 2 : 0; } };          // автор 03.11: сбить с ног нельзя, против сдвига — преимущество
  A["toll-guard"] = { time: "action", tgt() { return { type: "none" }; }, can(u) { return has(u, "shieldhum") ? "щит уже гудит" : true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "shieldhum", { k: 2, when: "end" }); log(`${u.name}: гул щита — +2 КД на 2 раунда.`, "skill"); fx(u, "гул щита", "good"); return true; },
    ai(u) { return !has(u, "shieldhum") && within(u, 1).length && u.hp < u.maxHp * 0.85 ? { score: 14 } : null; } };

  /* Визгун-голос (8): «Звонкий голос» (+2 клетки звуковым атакам), «Визг» — 2к6 звуком, спасбросок Мудрости Сл 12: провал — помеха на атаки */
  P["shrieker"] = {};
  A["shrieker"] = {
    time: "action",
    tgt(u) { const r = u.pass.includes("shrieker") ? 8 : 6; return specUnit(u, "Визг: в кого?", within(u, r), cellsAround(u, r), "attack"); },
    can(u) { const r = u.pass.includes("shrieker") ? 8 : 6; return within(u, r).length ? true : "нет целей"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit, sv = await save(t, "wis", 12, "Визг", ["sound"], u), d = roll(2, 6).total, v = sv.ok ? Math.floor(d / 2) : d;
      log(`${u.name} визжит на ${t.name}: ${v} звуком${sv.ok ? "" : ", атаки с помехой"}.`, "skill");
      await B.applyDamage(u, t, [{ v, dt: "thunder", label: "Визг" }], { src: u });
      if (!sv.ok && alive(t)) { addStatus(t, "screeched", { k: 1, when: "end" }); fx(t, "оглушён визгом", "bad"); }
      return true;
    },
    ai(u) { const ts = within(u, 8); return ts.length ? { unit: ts.sort((a, b) => b.hp - a.hp)[0], score: 3 } : null; },
  };

  /* Бронзовый бык (8): «Крепкий лоб» (разгон не прерывается), «Бронзовый разгон» — до 4 клеток по прямой, 2к6 + Сил, спасбросок Силы Сл 12 или сбит */
  P["toll-bull"] = {};
  A["toll-bull"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Бронзовый разгон: на кого?", within(u, 5).filter(t => dist(u, t) >= 2), cellsAround(u, 5), "attack"); },
    can(u) { return within(u, 5).some(t => dist(u, t) >= 2) ? true : "нужен разбег (цель в 2–5 клетках)"; },
    async run(u, pk, ctl) {
      const t = pk.unit; ctl.commit();
      await stepMove(u, 4, { prompt: "Разгон: куда?", auto: cells => cells.filter(c => distCell(t, c.x, c.y) <= 1).sort((p, q) => q.cost - p.cost)[0] || nearestToFoe(u, cells) });
      if (dist(u, t) > 1 || !alive(t)) { log(`${u.name}: разгон мимо.`); return true; }
      const v = roll(2, 6).total + amod(u.abil.str), sv = await save(t, "str", 12, "Бронзовый разгон", ["prone"], u);
      log(`${u.name} врезается в ${t.name}: ${v} дробящего${sv.ok ? "" : ", сбит с ног"}.`, "skill");
      await B.applyDamage(u, t, [{ v, dt: "bludgeon", label: "Разгон" }], { src: u, melee: true });
      if (!sv.ok && alive(t)) addStatus(t, "prone", { k: Infinity });
      return true;
    },
    ai(u) { const ts = within(u, 5).filter(t => dist(u, t) >= 2); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 4 } : null; },
  };

  /* Звонарь (7): «Эхо двойника» (+1 КД, пока жив двойник), «Резонанс колоколов» — два двойника с 1/3 ОЗ, раз за бой */
  P["bell-ringer"] = { acBonus(u) { return B.summonsOf(u).some(s => s.kind === "bellecho") ? 1 : 0; } };
  A["bell-ringer"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return u.kind === "bellecho" ? "двойник не зовёт двойников" : true; },
    async run(u, pk, ctl) {
      ctl.commit(); const cells = B.freeCellsNear(u, 2, { size: 1, side: u.side, id: "tmpb" }).slice(0, 2);
      for (const c of cells) {
        const d = B.monUnit(u.ref || "bell-ringer", -1), hp = Math.max(1, Math.ceil(u.maxHp / 3));
        Object.assign(d, { summon: true, kind: "bellecho", owner: u.id, side: u.side, idx: null, x: c[0], y: c[1] }); B.addUnit(d, u.id);
        Object.assign(d, { noReward: true, ess: [], pass: [], name: "Отзвук звонаря", base: "Отзвук звонаря", hp, maxHp: hp, seq: null, prot: 0, ac: Math.max(8, (d.ac || 10) - 2) });          // после addUnit (initUnit пересобирает бойца)
        d.atk = (d.atk || []).filter(k => k.kind === "melee").map(k => ({ ...k, dmg: { ...k.dmg, b: Math.max(0, (k.dmg.b || 0) - 3) } }));          // отзвук слабее: только ближний удар, урон −3 (мой подбор, 03.11)
        d.ai = Object.assign({}, d.ai, { noFlee: true, fleeHp: null, morale: null });
      }
      log(`${u.name}: резонанс колоколов — рядом встают ${cells.length} двойника.`, "skill"); fx(u, "двойники", "good"); return true;
    },
    ai(u) { return u.kind !== "bellecho" ? { score: 30 } : null; },
  };

  /* Охотник за звоном (7): эссенция работает вне боя (шум); в бою — обычный боец */
  P["toll-hunter"] = {};
  A["toll-hunter"] = { time: "action", tgt() { return { type: "none" }; }, can() { return "работает вне боя (шум Звона)"; }, async run() { return false; }, ai() { return null; } };

  /* Хор мёртвых (7): строй (+1 КД за каждого поющего вплотную, до +3), «Резонанс» (цепочка попаданий +1…+4), «Единение хора» */
  const choirN = u => friends(u).filter(o => dist(o, u) <= 1 && (o.ref === "choir-dead" || has(o, "choirjoin"))).length;
  P["body:choir-dead"] = { acBonus(u) { return Math.min(3, choirN(u)); } };
  const chainBonus = (src, tgt, o) => {
    if (o && o.__chain != null) return o.__chain;
    const S = B.S; let c = S.chain && S.chain[src.side], v = 0;
    if (c && c.tgt === tgt.id) { c.n = Math.min(4, c.n + 1); v = c.n; c.mem[src.id] = 1; }
    else if (c && c.mem[src.id]) { S.chain[src.side] = null; }
    if (o) o.__chain = v; return v;
  };
  P["choir-dead"] = {
    dmgOut(u, { tgt, o }) { const S = B.S; S.chain = S.chain || {}; const c = S.chain[u.side]; if (c && c.tgt === tgt.id) return chainBonus(u, tgt, o); S.chain[u.side] = { tgt: tgt.id, n: 0, mem: { [u.id]: 1 } }; if (o) o.__chain = 0; return 0; },
    dmgAura(a, { src, tgt, o }) { return chainBonus(src, tgt, o); },
    acBonus(u) { return has(u, "choirjoin") && u.ref !== "choir-dead" && friends(u).some(o => dist(o, u) <= 1 && has(o, "choirjoin")) ? 1 : 0; },
  };
  A["choir-dead"] = {
    time: "bonus", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); const g = [u, ...friends(u).filter(o => dist(o, u) <= 1)]; for (const o of g) addStatus(o, "choirjoin", { k: 3, when: "end" }); log(`${u.name}: единение хора (${g.length}).`, "skill"); fx(u, "хор", "good"); return true; },
    ai(u) { const n = friends(u).filter(o => dist(o, u) <= 1 && !has(o, "choirjoin")).length; return n ? { score: 1.5 + n } : null; },
  };

  /* ===== Храм изваяний ===== */
  const rubbleAt = (x, y, rounds) => { const S = B.S; if (!S.cells[y] || S.cells[y][x]) return; S.cells[y][x] = "rubble"; (S.rubble ||= []).push({ x, y, until: S.round + rounds }); };
  const prevRoundF3 = B.onRound;
  B.onRound = function (round) { if (prevRoundF3) prevRoundF3(round); const S = B.S; if (!S) return;
    if (S.rubble) S.rubble = S.rubble.filter(r => { if (r.until >= round) return true; if (S.cells[r.y] && S.cells[r.y][r.x] === "rubble") S.cells[r.y][r.x] = null; return false; });
    if (S.dust) S.dust = S.dust.filter(d => d.until >= round);
    for (const s of live()) if (s.expires && s.expires < round && alive(s)) { s.alive = false; s.gone = true; log(`${s.name} рассыпается.`); }
  };

  /* Каменный служка (9): «Каменная крошка» (крит по тебе −2), «Осколочный бросок» — 4 клетки, 1к6 + Сил, клетка цели — щебень на 2 раунда */
  P["stone-acolyte"] = { dmgFlat(u, { o, v }) { return o && o.crit && v > 1 ? -Math.min(2, v - 1) : 0; } };
  A["stone-acolyte"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Осколочный бросок: в кого?", within(u, 4).filter(t => dist(u, t) >= 2), cellsAround(u, 4), "attack"); },
    can(u) { return within(u, 4).some(t => dist(u, t) >= 2) ? true : "нет цели в 2–4 клетках"; },
    async run(u, pk, ctl) {
      const base = atkFor(u, "melee"), a = { id: "shard", n: "Осколочный бросок", hit: base ? base.hit : 3, dmg: { n: 1, s: 6, b: amod(u.abil.str) }, dt: "bludgeon", kind: "ranged", range: [4, 4] };
      const r = await B.doAttack(u, pk.unit, a, { onCommit: () => ctl.commit() });
      if (r && r.hit && alive(pk.unit)) { const t = pk.unit; for (const [x, y] of [[t.x + 1, t.y], [t.x - 1, t.y], [t.x, t.y + 1], [t.x, t.y - 1]]) rubbleAt(x, y, 2); }
      return !(r && r.cancelled);
    },
    ai(u) { const ts = within(u, 4).filter(t => dist(u, t) >= 2); return ts.length && !within(u, 1).length ? { unit: ts[0], score: 2 } : null; },
  };

  /* Пыльный херувим (9): «Песок в глаза» (первый попавший вблизи — помеха на следующую атаку), «Пыльная завеса» 2 × 2 на 2 раунда */
  P["dust-cherub"] = { onDamaged(u, { src, o }) { if (u.flags.sand || !src || !o || !o.melee) return; u.flags.sand = true; addStatus(src, "sanded", { k: 1, when: "end" }); fx(src, "песок в глаза", "bad"); } };
  A["dust-cherub"] = {
    time: "bonus", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) {
      ctl.commit(); const fr = friends(u).concat([u]).sort((a, b) => within(b, 1).length - within(a, 1).length)[0] || u, x0 = Math.min(B.W - 2, fr.x), y0 = Math.min(B.H - 2, fr.y);
      (B.S.dust ||= []).push({ cells: [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]], until: B.S.round + 2 });
      log(`${u.name} поднимает пыльную завесу.`, "skill"); fx(fr, "пыль", ""); const g = ui(); if (g) g.refresh(); return true;
    },
    ai(u) { return friends(u).some(o => within(o, 1).length) ? { score: 2.5 } : null; },
  };

  /* Кариатида (8): «Опора» (не двигалась в ход — +1 КД), «Обрушить свод» — радиус 1, Лов, 2к6 и сбит, щебень на 3 раунда */
  P["caryatid"] = { turnEnd(u) { u.flags.still = !(u.t && u.t.moved > 0); }, acBonus(u) { return u.flags.still ? 1 : 0; } };
  A["caryatid"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      ctl.commit(); const dc = dcOf(u, "str");
      for (const t of within(u, 1)) { const sv = await save(t, "dex", dc, "Обрушить свод", ["prone"], u), d = roll(2, 6).total, v = sv.ok ? Math.floor(d / 2) : d;
        await B.applyDamage(u, t, [{ v, dt: "bludgeon", label: "Обрушить свод" }], { src: u }); if (!sv.ok && alive(t)) addStatus(t, "prone", { k: Infinity }); }
      for (let y = u.y - 1; y <= u.y + 1; y++) for (let x = u.x - 1; x <= u.x + 1; x++) if (!live().some(o => o.x === x && o.y === y)) rubbleAt(x, y, 3);
      log(`${u.name} обрушивает свод.`, "skill"); return true;
    },
    ai(u) { const n = within(u, 1).length; return n >= 2 ? { score: 4 + n } : null; },
  };

  /* Мраморный алебардист (8): «Стойка» (вошедший в досягаемость: спасбросок Силы или остановлен), «Перехват древком» (реакция) */
  P["marble-halberdier"] = {
    async reactEnter(e, mover, from) {
      const a = atkFor(e, "melee"); if (!a || e.side === mover.side) return; const r = a.reach || 1;
      if (dist(e, mover) > r || (from && B.distAt(e, mover, from[0], from[1]) <= r) || e.stanceRound === B.S.round) return; e.stanceRound = B.S.round;
      const sv = await save(mover, "str", dcOf(e, "str"), "Стойка алебардиста", ["stop"], e);
      if (!sv.ok && mover.t) { mover.t.move = Math.max(0, (mover.t.move || 0) - 2); if (!mover.t.move) mover.halted = true; log(`${e.name}: стойка — ${mover.name} теряет 2 клетки движения.`, "skill"); fx(mover, "−2 клетки", "bad"); }          // автор 03.11: провал — −2 клетки движения
    },
  };
  const prevRedirect = B.redirectAttack;
  B.redirectAttack = async function (att, tgt, atk, o) {
    if (atk && atk.kind === "melee" && !o.echo) for (const h of friends(tgt)) {
      if (!h.pass.includes("marble-halberdier") || !h.t || !h.t.react || (h.cd && h.cd["marble-halberdier"] > 0)) continue;
      const k = atkFor(h, "melee"); if (!k || dist(h, att) > (k.reach || 1) || !B.canSeeUnit(h, att)) continue;
      h.t.react = 0; if (B.setCd) B.setCd(h, "marble-halberdier", D.essCd["marble-halberdier"]); log(`${h.name}: перехват древком!`, "skill");
      const r = await B.doAttack(h, att, k, { echo: true, noRedirect: true });
      if (r && r.hit) { o.dis = (o.dis || []).concat(["перехват древком"]); }
      if (!alive(att) || att.down) return null;
      break;
    }
    return prevRedirect ? prevRedirect(att, tgt, atk, o) : null;
  };
  A["marble-halberdier"] = { time: "react", tgt() { return { type: "none" }; }, can() { return "срабатывает само, когда враг в досягаемости бьёт союзника"; }, async run() { return false; }, ai() { return null; } };

  /* Мраморный страж (7): «Обет защиты» (раз в раунд половина урона союзника рядом — на себя), «Стена веры» */
  B.shareDamage = async function (src, tgt, total, o) {
    for (const g of friends(tgt)) {
      if (!g.pass.includes("marble-guardian") || dist(g, tgt) > 1 || g.vowRound === B.S.round || g.id === tgt.id) continue;
      g.vowRound = B.S.round; const k = Math.floor(total / 2); if (k <= 0) break;
      log(`${g.name}: обет защиты — принимает ${k} урона за ${tgt.name}.`, "skill");
      await B.applyDamage(src, g, [{ v: k, dt: "bludgeon", label: "Обет защиты" }], { src, shared: true, pure: true });
      return total - k;
    }
    return total;
  };
  P["marble-guardian"] = {};
  A["marble-guardian"] = {
    time: "action", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); const ally = friends(u).filter(o => dist(o, u) <= 1).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      addStatus(u, "faithwall", { k: 1, when: "start" }); if (ally) addStatus(ally, "faithwall", { k: 1, when: "start", data: { by: u.id } });
      log(`${u.name}: стена веры${ally ? " — и " + ally.name : ""}.`, "skill"); fx(u, "стена веры", "good"); return true; },
    ai(u) { return !has(u, "faithwall") && within(u, 1).length >= (friends(u).some(o => dist(o, u) <= 1) ? 1 : 2) ? { score: 18 } : null; },
  };

  /* Мраморная святая (7): «Ореол» (+1 к спасброскам союзников рядом), «Исцеляющий свет» 2к6 + Инт в 4 клетках */
  P["marble-saint"] = { saveAura(a, { u, ctx }) { if (u !== a && u.side === a.side && dist(a, u) <= 1) ctx.mods.push({ l: "Ореол", v: 1 }); } };
  A["marble-saint"] = {
    time: "action",
    tgt(u) { const fs = friends(u).concat([u]).filter(o => dist(o, u) <= 4 && o.hp < o.maxHp); return specUnit(u, "Исцеляющий свет: кого?", fs, cellsAround(u, 4), "buff"); },
    can(u) { return friends(u).concat([u]).some(o => dist(o, u) <= 4 && o.hp < o.maxHp) ? true : "все целы"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit, v = roll(2, 6).total + amod(u.abil.int), got = B.heal(t, v, u); log(`${u.name}: исцеляющий свет — ${t.name} +${got} ОЗ.`, "good"); fx(t, "+" + got, "good"); return true; },
    ai(u) { const t = friends(u).concat([u]).filter(o => dist(o, u) <= 4 && o.hp <= o.maxHp * 0.6).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; return t ? { unit: t, score: 16 } : null; },
  };

  /* Безликий скульптор (6): «Резец мастера» (призванные +3 ОЗ, +1 КД), «Изваять» — служка на 3 раунда; у камня/изваяния — кариатида */
  P["faceless-sculptor"] = {};
  const nearStone = u => { for (let y = u.y - 1; y <= u.y + 1; y++) for (let x = u.x - 1; x <= u.x + 1; x++) { const t = B.tinfo(x, y); if (t && (t.obstacle && /Изваяние|Валун|Сталагмит/.test(t.name || ""))) return [x, y]; } return null; };
  A["faceless-sculptor"] = {
    time: "action", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) {
      ctl.commit(); const st = nearStone(u), id = st ? "caryatid" : "stone-acolyte";
      const c = st && B.S.cells[st[1]] && B.S.cells[st[1]][st[0]] === "statue" ? (B.S.cells[st[1]][st[0]] = null, st) : B.freeCellsNear(u, 1, { size: 1, side: u.side, id: "tmps" })[0]; if (!c) return true;
      const m = B.monUnit(id, -1), mk = u.pass.includes("faceless-sculptor");
      Object.assign(m, { summon: true, kind: "carved", owner: u.id, side: u.side, idx: null, x: c[0], y: c[1], expires: B.S.round + 3 }); B.addUnit(m, u.id);
      const nm = id === "caryatid" ? "Ожившая кариатида" : "Изваянный служка"; Object.assign(m, { name: nm, base: nm, ess: [], noReward: true });
      if (mk) { m.maxHp += 3; m.hp += 3; m.ac += 1; }
      m.ai = Object.assign({}, m.ai, { noFlee: true, fleeHp: null, morale: null });
      log(`${u.name} изваивает: ${m.name} (3 раунда).`, "skill"); fx(m, "ожил", "bad"); return true;
    },
    ai(u) { const n = B.summonsOf(u).length; return n < 2 ? { score: n ? 18 : 40 } : null; },
  };

  /* ===== 2 этаж: гоблины под Угрозу (03.11) ===== */
  Object.assign(D.essCd, { "nasty-goblin": 2, "goblin-provoker": 4 });
  Object.assign(D.status, {
    taunted:  { name: "Раздразнён", good: false, ico: '<path d="M4 6h16v9H9l-5 4z"/><path d="M9 10h.01M15 10h.01"/>', desc: "Насмешник для него угрожающе важен: монстр скорее бьёт его, герой атакует других с помехой." },
    threatup: { name: "Задира", good: true, ico: '<path d="M4 9v6h4l6 4V5L8 9z"/>', desc: "Угроза +1: враги скорее бьют его." },
  });
  Object.assign(D.monTune, { "nasty-goblin": { role: "skirmisher", focus: ["weak", "nearest"], fleeHp: 0.4 }, "goblin-provoker": { role: "melee", focus: ["nearest"], fleeHp: 0.25 } });
  /* Противный гоблин (9): «Ловко на ногах», «Шутовская насмешка» */
  P["nasty-goblin"] = { saveMods(u, ctx) { if ((ctx.tags || []).includes("prone")) ctx.adv.push("ловко на ногах"); }, checkMods(u, ctx) { if ((ctx.tags || []).includes("prone")) ctx.adv.push("ловко на ногах"); } };
  A["nasty-goblin"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Шутовская насмешка: кого дразнить?", within(u, 6).filter(t => !has(t, "taunted")), cellsAround(u, 6), "debuff"); },
    can(u) { return within(u, 6).some(t => !has(t, "taunted")) ? true : "некого дразнить"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit, r = await save(t, "int", dcOf(u, "dex"), "Шутовская насмешка", ["taunt"], u);          // проверка Интеллекта — бросок Интеллекта против Сл
      if (r && r.ok) { log(`${t.name} не ведётся на насмешку ${u.name}.`); return true; }
      addStatus(t, "taunted", { k: 2, when: "end", data: { by: u.id, add: 1 } }); log(`${u.name} дразнит ${t.name}: Угроза насмешника для него +1 на 2 хода.`, "skill"); fx(t, "раздразнён", "bad"); return true;
    },
    ai(u) { const ts = within(u, 6).filter(t => !has(t, "taunted")); return ts.length ? { unit: ts.sort((a, b) => b.hp - a.hp)[0], score: 3 } : null; },
  };
  /* Гоблин-провокатор (8): «Вертлявый» (раз в раунд 16+ на к20 — попадание становится промахом), «Задиристый ор» */
  P["goblin-provoker"] = { async reactHit(u, ctx) { if (u.dodgeRound === B.S.round || (ctx.res && ctx.res.crit)) return false; u.dodgeRound = B.S.round; const d = roll(1, 20).total; if (d >= 16) { log(`${u.name} вертится и уходит от удара (${d}).`, "skill"); fx(u, "увернулся", "good"); return true; } return false; } };
  A["goblin-provoker"] = {
    time: "bonus", tgt() { return { type: "none" }; }, can(u) { return within(u, 2).length ? true : "никого в 2 клетках"; },
    async run(u, pk, ctl) {
      ctl.commit(); const es = within(u, 2);
      for (const t of es) { const v = roll(1, 4).total; await B.applyDamage(u, t, [{ v, dt: "thunder", label: "Задиристый ор" }], { src: u }); if (alive(t) && u.side === "mon") addStatus(t, "taunted", { k: 2, when: "end", data: { by: u.id, add: 1 } }); }
      addStatus(u, "threatup", { k: 2, when: "end", data: { add: 1 } });
      log(`${u.name} задиристо орёт: ${es.length} ${es.length === 1 ? "враг" : "врага"} получают звуком, Угроза +1 на 2 хода.`, "skill"); fx(u, "задира", "good"); return true;
    },
    ai(u) { return within(u, 2).length ? { score: 3 } : null; },
  };

  /* ===== 3 этаж: Охотничьи угодья (03.11) ===== */
  Object.assign(D.essCd, { "bone-ranger": 3, "thorn-hound": 3, "grey-vulture": 2, "pack-leader": 4, "stone-elk": 3, "iron-fox": 2, "glen-warden": 4, "tracker-hunter": 3, "keen-raven": 3, "silent-predator": 99 });
  Object.assign(D.status, {
    thornguard: { name: "Шипы наружу", good: true, ico: '<path d="M12 2l2 6 6-2-4 5 5 4-6 1 1 6-4-4-4 4 1-6-6-1 5-4-4-5 6 2z"/>', desc: "Защита +2 до начала своего хода." },
    packmark:   { name: "Цель стаи", good: false, ico: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', desc: "Стая бьёт с преимуществом." },
    packhowl:   { name: "Загонный вой", good: true, ico: '<path d="M4 9v6h4l6 4V5L8 9z"/>', desc: "+1 клетка скорости и +1 к попаданию." },
    elkwall:    { name: "Стеной", good: true, ico: '<path d="M4 20V6h16v14z"/>', desc: "Защита +2, не сдвинуть; соседям +2 Уворот от дальних атак." },
    irondust:   { name: "Железная пыль", good: false, ico: '<circle cx="8" cy="9" r="1"/><circle cx="14" cy="7" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="17" cy="12" r="1"/>', desc: "−2 к попаданию." },
    trailmark:  { name: "На следу", good: false, ico: '<path d="M7 18c0-3 2-4 2-7M15 18c0-3 2-4 2-7"/><circle cx="9" cy="8" r="2"/><circle cx="17" cy="8" r="2"/>', desc: "Следующая дальняя атака союзника следопыта по нему +2." },
    weakscent:  { name: "Чует слабого", good: true, ico: '<path d="M12 4c4 4 4 12 0 16-4-4-4-12 0-16z"/>', desc: "+2 к попаданию по целям с половиной ОЗ и меньше." },
  });
  Object.assign(D.monTune, {
    "bone-ranger": { role: "ranged", keep: 3, focus: ["weak", "nearest"], fleeHp: 0.3 }, "thorn-hound": { role: "swarm", circle: true, focus: ["weak", "nearest"], fleeHp: 0.3 },
    "grey-vulture": { role: "skirmisher", hitRun: true, focus: ["wounded", "weak"], fleeHp: 0.35 }, "pack-leader": { role: "swarm", focus: ["weak", "nearest"], fleeHp: 0.2 },
    "stone-elk": { role: "brute", focus: ["nearest"], noFlee: true }, "iron-fox": { role: "skirmisher", focus: ["weak", "nearest"], fleeHp: 0.3 },
    "glen-warden": { role: "brute", focus: ["attacker", "nearest"], noFlee: true }, "tracker-hunter": { role: "ranged", keep: 4, focus: ["weak", "nearest"], noFlee: true },
    "keen-raven": { role: "ranged", keep: 4, focus: ["weak", "nearest"], fleeHp: 0.25 }, "silent-predator": { role: "skirmisher", focus: ["weak", "nearest"], noFlee: true, hide: true },
  });
  const rangedAtk = u => B.attacksOf(u).find(a => a.kind === "ranged") || null;
  /* Костяной егерь (9) */
  P["bone-ranger"] = {
    turnEnd(u) { u.flags.shotLast = !!(u.t && u.t.shot); },
    attackMods(u, ctx) { if (ctx.atk && ctx.atk.kind === "ranged") { if (!u.flags.shotLast) ctx.mods.push({ l: "Терпеливый прицел", v: 2 }); if (u.t) u.t.shot = true; } },
  };
  A["bone-ranger"] = attackRider({ name: "Стрела в сустав", kind: "ranged", aiBonus: 2.5, onHit: async (t, u) => { if (!alive(t) || t.down) return; const sv = await save(t, "con", dcOf(u, "dex"), "Стрела в сустав", ["slow"], u); if (!sv.ok) { addStatus(t, "slowed", { k: 2, when: "end", data: { add: -2 } }); fx(t, "хромает", "bad"); } } });
  /* Шипастая гончая (9) */
  P["thorn-hound"] = {
    async onDamaged(u, { src, o }) {
      if (!src || !o || !o.melee || o.thorns || !alive(src)) return;
      await B.applyDamage(u, src, [{ v: 1, dt: "pierce", label: "Шипастая шкура" }], { src: u, thorns: true });
      const es = within(u, 1); if (es.length >= 2 && alive(u) && !u.down && !(u.cd && u.cd["thorn-hound"] > 0) && u.t && u.t.react) {
        u.t.react = 0; B.setCd(u, "thorn-hound", D.essCd["thorn-hound"]); addStatus(u, "thornguard", { k: 1, when: "start", data: { prot: 2 } }); log(`${u.name}: шипы наружу!`, "skill");
        for (const e of es) await B.applyDamage(u, e, [{ v: roll(1, 4).total, dt: "pierce", label: "Шипы наружу" }], { src: u, thorns: true });
      }
    },
  };
  A["thorn-hound"] = { time: "react", tgt() { return { type: "none" }; }, can() { return "срабатывает само, когда тебя окружили"; }, async run() { return false; }, ai() { return null; } };
  /* Сизый гриф (9) */
  P["grey-vulture"] = {
    dmgOut(u) { const t = B.tinfo(u.x, u.y); return (t && t.elevated) || B.isFlying(u) ? 2 : 0; },
    attackMods(u, ctx) { if (has(u, "weakscent") && ctx.tgt && ctx.tgt.hp <= ctx.tgt.maxHp / 2) ctx.mods.push({ l: "Чует слабого", v: 2 }); },
  };
  A["grey-vulture"] = { time: "bonus", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "weakscent", { k: 1, when: "end" }); fx(u, "чует слабого", "good"); return true; },
    ai(u) { return enemiesOf(u).some(e => e.hp <= e.maxHp / 2 && dist(u, e) <= 6) ? { score: 3 } : null; } };
  /* Вожак гончих (8) */
  P["pack-leader"] = {
    onHitDealt(u, { tgt }) { if (!tgt || (u.flags.packRound != null && B.S.round - u.flags.packRound < 3)) return; u.flags.packRound = B.S.round; addStatus(tgt, "packmark", { k: 1, when: "end", data: { by: u.id } }); fx(tgt, "цель стаи", "bad"); },
    attackAura(a, { att, tgt, ctx }) { const m = has(tgt, "packmark"); if (m && m.data && m.data.by === a.id && att.id !== a.id) ctx.adv.push("цель стаи"); if (has(att, "packhowl")) ctx.mods.push({ l: "Загонный вой", v: 1 }); },
  };
  A["pack-leader"] = { time: "bonus", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); const g = friends(u).filter(o => dist(o, u) <= 4); for (const o of g) addStatus(o, "packhowl", { k: 1, when: "end" }); log(`${u.name} воет: стая быстрее и точнее (${g.length}).`, "skill"); fx(u, "вой", "good"); return true; },
    ai(u) { return friends(u).filter(o => dist(o, u) <= 4).length >= 2 ? { score: 3 } : null; } };
  /* Каменный лось (8) */
  P["stone-elk"] = {
    async attackDone(u, { tgt, res, atk }) { if (res && res.hit && atk && atk.kind === "melee" && u.t && u.t.straight >= 2 && alive(tgt) && !tgt.down && tgt.size <= u.size) { await B.push(tgt, u.x, u.y, 1); fx(tgt, "отброшен", "bad"); } },
    saveMods(u, ctx) { if (has(u, "elkwall") && (ctx.tags || []).some(t => ["prone", "shove", "push"].includes(t))) ctx.adv.push("стеной"); },
    acAura(a, { tgt, ctx }) { return has(a, "elkwall") && tgt !== a && dist(a, tgt) <= 1 && ctx && ctx.atk && ctx.atk.kind !== "melee" ? 2 : 0; },
  };
  A["stone-elk"] = { time: "action", tgt() { return { type: "none" }; }, can(u) { return has(u, "elkwall") ? "уже стоит стеной" : true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "elkwall", { k: 1, when: "start", data: { prot: 2 } }); log(`${u.name} встаёт стеной.`, "skill"); fx(u, "стеной", "good"); return true; },
    ai(u) { return within(u, 1).length >= 2 && u.hp < u.maxHp * 0.7 ? { score: 12 } : null; } };
  /* Железная лиса (8) */
  P["iron-fox"] = {
    onMissedBy(u, { att, atk }) { if (atk && atk.kind === "melee" && att) u.flags.feint = att.id; },
    attackMods(u, ctx) { if (ctx.tgt && u.flags.feint === ctx.tgt.id) { ctx.adv.push("обманный финт"); u.flags.feint = null; } },
  };
  A["iron-fox"] = { time: "bonus",
    tgt(u) { return specUnit(u, "Железная пыль: в кого?", within(u, 3).filter(t => !has(t, "irondust")), cellsAround(u, 3), "debuff"); },
    can(u) { return within(u, 3).some(t => !has(t, "irondust")) ? true : "нет цели"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit, sv = await save(t, "con", dcOf(u, "dex"), "Железная пыль", ["blind"], u); if (!sv.ok) { addStatus(t, "irondust", { k: 1, when: "end", data: { atkMod: -2 } }); fx(t, "пыль в глазах", "bad"); } return true; },
    ai(u) { const ts = within(u, 3).filter(t => !has(t, "irondust")); return ts.length ? { unit: ts[0], score: 2.5 } : null; } };
  /* Рогатый страж лощин (7) */
  P["glen-warden"] = {
    attackMods(u, ctx) { if (u.t && !(u.t.moved > 0)) ctx.mods.push({ l: "Корни лощины", v: 1 }); },
    dmgOut(u) { return u.t && !(u.t.moved > 0) ? 1 : 0; },
  };
  A["glen-warden"] = { time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { ctl.commit(); const dc = dcOf(u, "str");
      for (const t of within(u, 1)) { const v = roll(2, 8).total + amod(u.abil.str), sv = await save(t, "str", dc, "Ветвистый удар", ["prone"], u); await B.applyDamage(u, t, [{ v, dt: "pierce", label: "Ветвистый удар" }], { src: u, melee: true }); if (!sv.ok && alive(t)) addStatus(t, "prone", { k: Infinity }); }
      log(`${u.name}: ветвистый удар.`, "skill"); return true; },
    ai(u) { const n = within(u, 1).length; return n >= 2 ? { score: 10 + n * 4 } : null; } };
  /* Следопыт-охотник (7) */
  P["tracker-hunter"] = { attackAura(a, { att, tgt, ctx }) { const m = has(tgt, "trailmark"); if (m && m.data && m.data.by === a.id && att.id !== a.id && ctx.atk && ctx.atk.kind === "ranged") { ctx.mods.push({ l: "На следу", v: 2 }); removeStatus(tgt, "trailmark"); } } };
  A["tracker-hunter"] = attackRider({ name: "Выстрел в след", kind: "ranged", aiBonus: 3, onHit: async (t, u) => { if (alive(t) && !t.down) { addStatus(t, "trailmark", { k: 2, when: "end", data: { by: u.id } }); fx(t, "на следу", "bad"); } } });
  /* Зоркий ворон (7): «Сторожевой» (у монстра — всегда; у героя — в Обороне), «Взгляд сверху» */
  P["keen-raven"] = {
    async reactEnter(e, mover, from) {
      if (e.side === mover.side || (e.side === "hero" && !has(e, "dodging")) || e.watchRound === B.S.round) return;
      const a = rangedAtk(e); if (!a || !mover.t || mover.t.startX == null) return;
      const d0 = B.distAt(e, mover, mover.t.startX, mover.t.startY); if (d0 <= 2 || d0 > (a.range ? a.range[0] : 6) || dist(e, mover) > (a.range ? a.range[0] : 6)) return;
      e.watchRound = B.S.round; e.t.react = 0; log(`${e.name}: сторожевой — перо в спину.`, "skill");
      await B.doAttack(e, mover, a, { bonusHit: -3, bonusLabel: "Сторожевой", echo: true, noRedirect: true });
    },
  };
  A["keen-raven"] = { time: "action", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); let n = 0;
      for (const e of enemiesOf(u)) if (dist(u, e) <= 4 && has(e, "hidden")) { removeStatus(e, "hidden"); n++; }
      for (const o of B.S.objs || []) if (o.kind === "trap" && o.owner !== u.side && Math.max(Math.abs(o.x - u.x), Math.abs(o.y - u.y)) <= 4) { o.noticed = o.noticed || []; for (const f of live().filter(x => x.side === u.side)) if (!o.noticed.includes(f.id)) o.noticed.push(f.id); o.hidden = false; n++; }
      log(`${u.name}: взгляд сверху — открыто ${n}.`, "skill"); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { return enemiesOf(u).some(e => dist(u, e) <= 4 && has(e, "hidden")) ? { score: 8 } : null; } };
  /* Тихий хищник (6): «Удар из тишины» */
  P["silent-predator"] = {
    turnEnd(u) { u.flags.stillLast = !(u.t && u.t.moved > 0); },
    attackMods(u, ctx) { if (has(u, "hidden") && ctx.tgt && ctx.tgt.flags && ctx.tgt.flags.stillLast) { ctx.autoCrit = true; ctx.notes.push("удар из тишины"); } },
  };
  A["silent-predator"] = { time: "action", tgt() { return { type: "none" }; }, can() { return "работает вне боя"; }, async run() { return false; }, ai() { return null; } };

  /* ===== 3 этаж: Пылающие земли (03.11; черновик) ===== */
  Object.assign(D.essCd, { "coal-beetle": 3, "ember-salamander": 2, "ash-executioner": 3, "brazier-golem": 4, "ember-reaper": 3, "magma-wyrm": 4, "forge-smith": 4 });
  Object.assign(D.monTune, {
    "coal-beetle": { role: "ranged", keep: 2, focus: ["nearest"], fleeHp: 0.3 }, "ember-salamander": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.3 }, "ash-executioner": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
    "brazier-golem": { role: "brute", focus: ["cluster", "nearest"], noFlee: true }, "ember-reaper": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
    "magma-wyrm": { role: "brute", focus: ["nearest"], noFlee: true }, "forge-smith": { role: "brute", focus: ["attacker", "nearest"], noFlee: true },
  });
  const fireAt = (x, y, rounds) => { const S = B.S; if (!S.cells[y] || x < 0 || x >= B.W) return; const c = S.cells[y][x]; if (c && c !== "fire" && !(D.terrain[c] || {}).flammable && c !== "rubble") return; S.cells[y][x] = "fire"; (S.tmpFire ||= []).push({ x, y, until: S.round + rounds }); };
  const fireNear = (u, r) => { for (let y = u.y - r; y <= u.y + r; y++) for (let x = u.x - r; x <= u.x + r; x++) if (B.S.cells[y] && B.S.cells[y][x] === "fire") return [x, y]; return null; };
  const prevRoundFire = B.onRound;
  B.onRound = function (round) { if (prevRoundFire) prevRoundFire(round); const S = B.S; if (!S || !S.tmpFire) return; S.tmpFire = S.tmpFire.filter(f => { if (f.until >= round) return true; if (S.cells[f.y] && S.cells[f.y][f.x] === "fire") S.cells[f.y][f.x] = null; return false; }); };
  const saveDmg = async (u, t, abil, dc, dice, dt, label, tags) => { const sv = await save(t, abil, dc, label, tags || [], u), d = roll(dice[0], dice[1]).total + (dice[2] || 0), v = sv.ok ? Math.floor(d / 2) : d; await B.applyDamage(u, t, [{ v, dt, label }], { src: u }); return sv; };
  /* Угольный жук (9): «Жаропрочный», «Плевок углём» */
  P["coal-beetle"] = { resist(u, { dt }) { return dt === "fire"; }, immune(u, { id }) { return id === "burning"; } };
  A["coal-beetle"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Плевок углём: в кого?", within(u, 4), cellsAround(u, 4), "attack"); },
    can(u) { return within(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) {
      const base = atkFor(u, "melee"), a = { id: "coal", n: "Плевок углём", hit: base ? base.hit : 3, dmg: { n: 1, s: 6, b: amod(u.abil.con) }, dt: "fire", kind: "ranged", range: [4, 4] };
      const r = await B.doAttack(u, pk.unit, a, { onCommit: () => ctl.commit() }); if (r && r.hit && pk.unit) fireAt(pk.unit.x, pk.unit.y, 2); const g = ui(); if (g) g.refresh(); return !(r && r.cancelled);
    },
    ai(u) { const ts = within(u, 4).filter(t => dist(u, t) >= 2); return ts.length ? { unit: ts[0], score: 3 } : null; },
  };
  /* Огненная саламандра (9): «Огненный след», «Хлёст хвостом» */
  P["ember-salamander"] = { turnStart(u) { u.trailFrom = [u.x, u.y]; }, turnEnd(u) { const f = u.trailFrom; u.trailFrom = null; if (f && (f[0] !== u.x || f[1] !== u.y)) { fireAt(f[0], f[1], 1); const g = ui(); if (g) g.refresh(); } } };
  A["ember-salamander"] = {
    time: "bonus",
    tgt(u) { return specUnit(u, "Хлёст хвостом: кого?", within(u, 1), cellsAround(u, 1), "attack"); },
    can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit || within(u, 1)[0]; if (!t) return true;
      const sv = await save(t, "dex", dcOf(u, "dex"), "Хлёст хвостом", ["push"], u);
      if (!sv.ok && alive(t)) { await B.applyDamage(u, t, [{ v: roll(1, 6).total, dt: "fire", label: "Хлёст хвостом" }], { src: u }); if (alive(t) && B.push) await B.push(t, u.x, u.y, 1); }
      log(`${u.name} хлещет хвостом.`, "skill"); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { const ts = within(u, 1); return ts.length ? { unit: ts[0], score: 4 } : null; },
  };
  /* Жаровня-голем (8): «Угли в чреве», «Опрокинуть жаровню» */
  P["brazier-golem"] = { turnStart(u) { if (fireNear(u, 1) && u.hp < u.maxHp) { B.heal(u, 2, u); fx(u, "+2", "good"); } } };
  A["brazier-golem"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 2).length ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = within(u, 2).sort((a, b) => dist(u, a) - dist(u, b))[0]; const dx = Math.sign(t.x - u.x), dy = Math.sign(t.y - u.y);
      const cells = [[u.x + dx, u.y + dy], dx && dy ? [u.x + dx, u.y] : [u.x + dx + (dy ? 1 : 0), u.y + dy + (dx ? 1 : 0)], dx && dy ? [u.x, u.y + dy] : [u.x + dx - (dy ? 1 : 0), u.y + dy - (dx ? 1 : 0)]];
      for (const [x, y] of cells) { fireAt(x, y, 3); for (const e of enemiesOf(u).filter(e => footprint(e).some(([a, b]) => a === x && b === y))) await saveDmg(u, e, "dex", dcOf(u, u.hero ? "int" : "con"), [2, 6], "fire", "Опрокинуть жаровню"); }          // у героя — от Интеллекта (эссенция под мага)
      log(`${u.name} опрокидывает жаровню.`, "skill"); const g = ui(); if (g) g.refresh(); return true;
    },
    ai(u) { return within(u, 1).length ? { score: 10 + within(u, 1).length * 3 } : null; },
  };
  /* Жнец углей (7): «Жатва жара», «Пепельная коса» */
  P["ember-reaper"] = { onHitDealt(u, { tgt }) { if (tgt && (tgt.down || !alive(tgt))) { u.temp = Math.max(u.temp || 0, 5); fx(u, "жатва", "good"); } } };
  A["ember-reaper"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) {
      const a = atkFor(u, "melee"); if (!a) return false; ctl.commit();
      for (const t of within(u, 1).slice(0, 2)) { const r = await B.doAttack(u, t, a, { extra: [{ n: 1, s: 6, b: 0, dt: "fire", label: "Пепельная коса" }], noRedirect: true }); if (r && r.hit && alive(t)) addStatus(t, "burning", { k: 2, when: "end" }); }
      return true;
    },
    ai(u) { return within(u, 1).length >= 2 ? { score: 20 } : null; },
  };
  /* Магмовый змей (7): «Раскалённая чешуя», «Лавовый плевок» */
  P["magma-wyrm"] = { onDamaged(u, { src, o }) { if (!src || !src.hero || !o || !o.melee || !o.ctx || !o.ctx.atk || src.scaleRound === B.S.round) return; src.scaleRound = B.S.round; if (B.wearWeapon) { B.wearWeapon(src, o.ctx.atk, 1); log(`${src.name}: оружие тупится о раскалённую чешую.`); } } };
  A["magma-wyrm"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Лавовый плевок: в сторону кого?", within(u, 4), cellsAround(u, 4), "attack"); },
    can(u) { return within(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) {
      ctl.commit(); const cells = B.lineCells(u, pk.unit).slice(0, 4).concat([[pk.unit.x, pk.unit.y]]);
      const hit = new Set(); for (const [x, y] of cells) { fireAt(x, y, 2); for (const e of enemiesOf(u)) if (!hit.has(e.id) && footprint(e).some(([a, b]) => a === x && b === y)) { hit.add(e.id); await saveDmg(u, e, "dex", dcOf(u, "con"), [2, 8], "fire", "Лавовый плевок"); } }
      log(`${u.name} плюётся лавой.`, "skill"); const g = ui(); if (g) g.refresh(); return true;
    },
    ai(u) { const ts = within(u, 4); return ts.length ? { unit: ts.sort((a, b) => b.hp - a.hp)[0], score: 14 } : null; },
  };
  /* Пепельный палач (7): «Палаческий замах», «Приговор» */
  const twoHandAtk = (u, a) => !!a && a.kind === "melee" && (u.hero ? !!(a.w && a.w.group !== "ranged" && typeof isTwoHandedWeapon === "function" && isTwoHandedWeapon(a.w)) : true);
  P["ash-executioner"] = { attackMods(u, ctx) { if (twoHandAtk(u, ctx.atk)) { ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; ctx.notes && ctx.notes.push("палаческий замах: +2 урона"); } } };
  A["ash-executioner"] = {
    time: "action",
    tgt(u) { return specUnit(u, "Приговор: кого?", within(u, 1), cellsAround(u, 1), "attack"); },
    can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false;
      const low = t.hp <= t.maxHp / 2; const r = await B.doAttack(u, t, a, { extra: low ? [{ n: 2, s: 6, b: 0, dt: a.dt || "slash", label: "Приговор" }] : [], onCommit: () => ctl.commit() });
      return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1).filter(t => t.hp <= t.maxHp / 2); return ts.length ? { unit: ts[0], score: 18 } : null; },
  };
  /* Кузнец горнила (6): «Закалённый удар», «Удар о наковальню» */
  P["forge-smith"] = {
    attackMods(u, ctx) { if (ctx.atk && ctx.atk.kind === "melee" && ctx.atk.dt === "bludgeon") ctx.extra.push({ n: 1, s: 4, b: 0, dt: "fire", label: "Закалённый удар" }); },
    onHitDealt(u, { tgt, res }) { if (res && res.crit && tgt && alive(tgt) && !tgt.down) addStatus(tgt, "prone", { k: Infinity }); },
  };
  A["forge-smith"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 2).length ? true : "никого в 2 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); for (const t of within(u, 2)) { const sv = await saveDmg(u, t, "con", dcOf(u, "str"), [2, 6], "bludgeon", "Удар о наковальню", ["stun"]); if (!sv.ok && alive(t)) addStatus(t, "stunned", { k: 1, when: "end" }); } log(`${u.name} бьёт о наковальню.`, "skill"); return true; },
    ai(u) { const n = within(u, 2).length; return n >= 2 ? { score: 12 + n * 4 } : null; },
  };

  /* ===== 3 этаж: Зона ловушек (03.11) ===== */
  Object.assign(D.essCd, { "trap-crab": 3, "wire-spider": 2, "bolt-golem": 3, "trap-master": 2, "boulder-beetle": 3, "trap-queen": 3 });
  Object.assign(D.monTune, {
    "trap-crab": { role: "brute", focus: ["nearest"], fleeHp: 0.25 }, "wire-spider": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.3 },
    "bolt-golem": { role: "ranged", keep: 3, focus: ["weak", "nearest"], noFlee: true }, "trap-master": { role: "ranged", keep: 3, focus: ["weak", "nearest"], fleeHp: 0.25 },
    "boulder-beetle": { role: "brute", focus: ["cluster", "nearest"], noFlee: true }, "trap-queen": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
  });
  const freeTrapCells = (u, r) => cellsAround(u, r).filter(([x, y]) => B.canStand({ ...u, size: 1, x, y, id: "tmp" }, x, y) && !B.S.objs.some(o => o.x === x && o.y === y) && !B.tinfo(x, y)?.obstacle);
  const setTrap = (u, x, y, o = {}) => { const tr = { id: "t" + Math.random().toString(36).slice(2, 7), kind: "trap", x, y, dc: o.dc || dcOf(u, "dex"), hidden: true, owner: u.side, by: u.id, dmg: o.dmg || "2к6", dt: "pierce", noticed: [], ...(o.wire ? { wire: true } : {}) };
    if (u.side === "hero") for (const e of enemiesOf(u)) if (B.passivePerceptionOf(e) >= tr.dc + 2) tr.noticed.push(e.id);
    B.S.objs.push(tr); return tr; };
  const myTraps = u => B.S.objs.filter(o => o.kind === "trap" && o.by === u.id);
  const nearestFoeCell = (u, cells) => { const es = enemiesOf(u); if (!es.length || !cells.length) return null; const near = es.reduce((a, b) => (dist(u, a) < dist(u, b) ? a : b)); return cells.sort((a, b) => distCell(near, a[0], a[1]) - distCell(near, b[0], b[1]))[0]; };
  /* Капкан-краб (9): «Вросший капкан», «Хват клешнёй» */
  P["trap-crab"] = {
    async reactEnter(e, mover, from) {
      if (e.side === mover.side || e.crabUsed || dist(e, mover) > 1 || (from && B.distAt(e, mover, from[0], from[1]) <= 1)) return; e.crabUsed = true;
      const sv = await save(mover, "dex", dcOf(e, "str"), "Вросший капкан", ["restrain"], e);
      if (!sv.ok && alive(mover)) { addStatus(mover, "restrained", { k: 1, when: "end" }); if (mover.t) mover.t.move = 0; mover.halted = true; log(`${e.name}: капкан защёлкнулся на ${mover.name}.`, "skill"); fx(mover, "в капкане", "bad"); }
    },
  };
  A["trap-crab"] = {
    time: "action", tgt(u) { return specUnit(u, "Хват клешнёй: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"); if (!a || !pk.unit) return false; const r = await B.doAttack(u, pk.unit, a, { onCommit: () => ctl.commit() }); if (r && r.hit && alive(pk.unit)) { addStatus(pk.unit, "restrained", { k: 2, when: "end" }); fx(pk.unit, "схвачен", "bad"); } return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1).filter(t => !has(t, "restrained")); return ts.length ? { unit: ts[0], score: 8 } : null; },
  };
  /* Проволочный паук (9): «Чуткие нити», «Растяжка» */
  P["wire-spider"] = { attackMods(u, ctx) { const t = ctx.tgt; if (t && (has(t, "prone") || has(t, "restrained") || has(t, "trapped"))) ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; } };
  A["wire-spider"] = {
    time: "bonus", secret: true,
    tgt(u) { return { type: "cell", prompt: "Растяжка: в какую клетку?", cells: freeTrapCells(u, 2) }; },
    can(u) { return myTraps(u).length >= 3 ? "уже 3 растяжки" : freeTrapCells(u, 2).length ? true : "нет места"; },
    async run(u, pk, ctl) { ctl.commit(); const [x, y] = pk.cell; setTrap(u, x, y, { dmg: "1к4", wire: true }); log(u.side === "hero" ? `${u.name} натягивает растяжку.` : `${u.name} возится у камней.`); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { if (myTraps(u).length >= 3) return null; const cell = nearestFoeCell(u, freeTrapCells(u, 2)); return cell ? { cell, score: 4 } : null; },
  };
  /* Самострел-голем (8): «Станковая стрельба», «Залп»; тело — «Неповоротливый» */
  P["bolt-golem"] = { turnStart(u) { u.standFrom = [u.x, u.y]; }, attackMods(u, ctx) { if (ctx.atk && ctx.atk.kind === "ranged" && u.standFrom && u.standFrom[0] === u.x && u.standFrom[1] === u.y) ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; } };
  P["body:bolt-golem"] = { defendMods(t, ctx) { if (ctx.atk && ctx.atk.kind === "melee") ctx.adv.push("неповоротлив вблизи"); } };
  A["bolt-golem"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 6).length ? true : "нет целей в 6 клетках"; },
    async run(u, pk, ctl) { const a = atkFor(u, "ranged"); if (!a) return false; ctl.commit(); for (const t of within(u, 6).slice(0, 3)) await B.doAttack(u, t, a, { noRedirect: true }); log(`${u.name}: залп.`, "skill"); return true; },
    ai(u) { const n = within(u, 6).length; return n >= 2 ? { score: 10 + n * 3 } : null; },
  };
  /* Мастер ловушек (7): «Скрытые механизмы», «Взвести ловушку»; монстр в начале боя прячет 3 ловушки */
  P["trap-master"] = { trapBonus() { return true; } };
  P["body:trap-master"] = { turnStart(u) { if (u.side !== "mon" || u.fieldSet) return; u.fieldSet = true; const es = enemiesOf(u); for (let k = 0; k < 3; k++) { const cells = []; for (const e of es) for (const c of cellsAround(e, 2)) if (B.canStand({ ...u, size: 1, x: c[0], y: c[1], id: "tmp" }, c[0], c[1]) && !B.S.objs.some(o => o.x === c[0] && o.y === c[1]) && dist({ x: c[0], y: c[1] }, e) >= 1) cells.push(c); if (!cells.length) break; const [x, y] = cells[Math.floor(Math.random() * cells.length)]; setTrap(u, x, y, { dmg: "2к6", dc: dcOf(u, "int") }); } log(`${u.name} что-то прячет в траве.`); } };
  A["trap-master"] = {
    time: "bonus", secret: true,
    tgt(u) { return { type: "cell", prompt: "Взвести ловушку: в какую клетку?", cells: freeTrapCells(u, 2) }; },
    can(u) { return myTraps(u).length >= 3 + (u.side === "mon" ? 3 : 0) ? "уже 3 ловушки" : freeTrapCells(u, 2).length ? true : "нет места"; },
    async run(u, pk, ctl) { ctl.commit(); const [x, y] = pk.cell; setTrap(u, x, y, { dmg: "2к6", dc: dcOf(u, "int") }); log(u.side === "hero" ? `${u.name} взводит ловушку.` : `${u.name} возится у земли.`); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { if (myTraps(u).length >= 6) return null; const cell = nearestFoeCell(u, freeTrapCells(u, 2)); return cell ? { cell, score: 3 } : null; },
  };
  /* Валун-жук (7): «Инерция», «Кувырок-таран» */
  P["boulder-beetle"] = { turnStart(u) { u.rollFrom = [u.x, u.y]; }, attackMods(u, ctx) { if (!ctx.atk || ctx.atk.kind !== "melee" || !u.rollFrom) return; const n = Math.min(4, Math.max(Math.abs(u.x - u.rollFrom[0]), Math.abs(u.y - u.rollFrom[1]))); if (n) ctx.dmgPlus = (ctx.dmgPlus || 0) + n; } };
  A["boulder-beetle"] = {
    time: "action", tgt(u) { return specUnit(u, "Кувырок-таран: на кого?", within(u, 5), cellsAround(u, 5), "attack"); }, can(u) { return within(u, 5).length ? true : "нет цели в 5 клетках"; },
    async run(u, pk, ctl) {
      ctl.commit(); const t = pk.unit; if (!t) return true; const line = B.lineCells(u, t).slice(0, 4), hit = new Set(); let last = null;
      for (const [x, y] of line) { const foes = enemiesOf(u).filter(e => !hit.has(e.id) && footprint(e).some(([a, b]) => a === x && b === y)); for (const e of foes) { hit.add(e.id); const sv = await saveDmg(u, e, "str", dcOf(u, "con"), [2, 6], "bludgeon", "Кувырок-таран"); if (!sv.ok && alive(e) && !e.down) addStatus(e, "prone", { k: Infinity }); } if (!foes.length && B.canStand(u, x, y)) last = [x, y]; else if (foes.length) break; }
      if (last) { u.x = last[0]; u.y = last[1]; } log(`${u.name} катится тараном.`, "skill"); const g = ui(); if (g) g.refresh(); return true;
    },
    ai(u) { const ts = within(u, 5).filter(t => dist(u, t) >= 2); return ts.length ? { unit: ts[0], score: 14 } : null; },
  };
  /* Королева ловушек (6): «Знаток механизмов», «Ловчий механизм»; тело — «Сменные механизмы» и 4 ловушки на старте */
  P["trap-queen"] = { trapImmune() { return true; } };
  P["body:trap-queen"] = {
    turnStart(u) {
      if (u.side === "mon" && !u.fieldSet) { u.fieldSet = true; const es = enemiesOf(u); for (let k = 0; k < 4; k++) { const e = es[k % Math.max(1, es.length)]; if (!e) break; const cells = cellsAround(e, 2).filter(([x, y]) => B.canStand({ ...u, size: 1, x, y, id: "tmp" }, x, y) && !B.S.objs.some(o => o.x === x && o.y === y)); if (!cells.length) continue; const [x, y] = cells[Math.floor(Math.random() * cells.length)]; setTrap(u, x, y, { dmg: "2к6", dc: dcOf(u, "int") }); } }
      removeStatus(u, "queenshell"); removeStatus(u, "queenlegs");
      if (B.S.round % 2) { addStatus(u, "queenshell", { k: 1, when: "start", data: { prot: 2 } }); fx(u, "панцирь", ""); } else { addStatus(u, "queenlegs", { k: 1, when: "start", data: { atkMod: 2 } }); fx(u, "паучьи лапы", ""); }
    },
  };
  A["trap-queen"] = {
    time: "action", tgt() { return { type: "none" }; },
    can(u) { return B.S.objs.some(o => o.kind === "trap") || u.side === "hero" ? true : "ловушек нет"; },
    async run(u, pk, ctl) {
      ctl.commit(); const traps = B.S.objs.filter(o => o.kind === "trap"), hit = new Set();
      for (const tr of traps) for (const e of enemiesOf(u)) if (!hit.has(e.id) && footprint(e).some(([x, y]) => Math.max(Math.abs(x - tr.x), Math.abs(y - tr.y)) <= 1)) { hit.add(e.id); await saveDmg(u, e, "dex", dcOf(u, "int"), [2, 6], "pierce", "Ловчий механизм"); }
      B.S.objs = B.S.objs.filter(o => !(o.kind === "trap" && traps.includes(o) && o.owner !== u.side));
      for (let k = 0; k < 2; k++) { const cell = nearestFoeCell(u, freeTrapCells(u, 3)); if (cell) setTrap(u, cell[0], cell[1], { dmg: "2к6", dc: dcOf(u, "int") }); }
      log(`${u.name}: щелчок — все механизмы срабатывают разом.`, "skill"); const g = ui(); if (g) g.refresh(); return true;
    },
    ai(u) { const traps = B.S.objs.filter(o => o.kind === "trap"); const n = enemiesOf(u).filter(e => traps.some(tr => Math.max(Math.abs(e.x - tr.x), Math.abs(e.y - tr.y)) <= 1)).length; return n ? { score: 10 + n * 6 } : null; },
  };

  /* ===== 3 этаж: Ведьмин лес (04.11) ===== */
  Object.assign(D.essCd, { mourner: 3, changeling: 2, "lost-trail": 3, "lost-wanderer": 3, scarecrow: 4, "witch-owl": 3, "failed-specimen": 3, "maid-shade": 3, "witch-cat": 3, "fog-lantern": 3 });
  Object.assign(D.monTune, {
    mourner: { role: "skirmish", focus: ["weak", "nearest"], noFlee: true }, changeling: { role: "swarm", circle: true, focus: ["nearest"], noFlee: true },
    "lost-trail": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.3 }, "lost-wanderer": { role: "brute", focus: ["attacker", "nearest"], noFlee: true },
    scarecrow: { role: "brute", focus: ["cluster", "nearest"], noFlee: true }, "witch-owl": { role: "skirmish", focus: ["weak"], fleeHp: 0.3 },
    "failed-specimen": { role: "brute", focus: ["nearest"], noFlee: true }, "maid-shade": { role: "skirmish", focus: ["weak", "nearest"], noFlee: true },
    "witch-cat": { role: "skirmish", focus: ["weak"], fleeHp: 0.25 }, "fog-lantern": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
  });
  const freeCellsIn = (x0, y0, r, u) => { const out = []; for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) if (x >= 0 && y >= 0 && x < B.W && y < B.H && B.canStand(u, x, y)) out.push([x, y]); return out; };
  const jumpTo = (u, cells) => { if (!cells.length) return false; const [x, y] = cells[Math.floor(Math.random() * cells.length)]; u.x = x; u.y = y; return true; };
  /* Плакальщица (9): «Привычка к скорби», «Плач по живым» */
  P.mourner = { saveMods(u, ctx) { if ((ctx.tags || []).includes("fear")) ctx.adv.push("привычка к скорби"); } };
  A.mourner = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 2).length ? true : "никого в 2 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); for (const t of within(u, 2)) { const sv = await save(t, "wis", dcOf(u, "wis"), "Плач по живым", ["fear"], u); if (!sv.ok && alive(t)) addStatus(t, "mourned", { k: 1, when: "end" }); } log(`${u.name} воет.`, "skill"); return true; },
    ai(u) { const n = within(u, 2).length; return n ? { score: 6 + n * 3 } : null; },
  };
  /* Подкидыш (9): «Едкая кровь», «Лопнуть пузырь»; тело — лопается при гибели */
  P.changeling = { async onDamaged(u, { src, o }) { if (!src || !o || !o.melee || u.acidRound === B.S.round || !alive(src)) return; u.acidRound = B.S.round; await B.applyDamage(u, src, [{ v: roll(1, 4).total, dt: "acid", label: "Едкая кровь" }], { src: u }); } };
  P["body:changeling"] = { onDeath(u) { for (const e of enemiesOf(u).filter(e => alive(e) && dist(u, e) <= 1)) B.applyDamage(u, e, [{ v: roll(1, 4).total, dt: "acid", label: "Слизь подкидыша" }], { src: u }); log(`${u.name} лопается едкой слизью.`); } };
  A.changeling = {
    time: "bonus", tgt() { return { type: "none" }; }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { ctl.commit(); for (const t of within(u, 1)) await saveDmg(u, t, "dex", dcOf(u, "con"), [1, 6], "acid", "Лопнуть пузырь"); return true; },
    ai(u) { const n = within(u, 1).length; return n ? { score: 4 + n * 2 } : null; },
  };
  /* Потерявшийся след (8): «Знаток троп» (вне боя), «Ложная тропа» */
  A["lost-trail"] = {
    time: "bonus", tgt(u) { return specUnit(u, "Ложная тропа: кого увести?", within(u, 4), cellsAround(u, 4), "attack"); }, can(u) { return within(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit; if (!t) return true; const sv = await save(t, "wis", dcOf(u, "wis"), "Ложная тропа", ["charm"], u);
      if (!sv.ok && alive(t) && B.push) { const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]][Math.floor(Math.random() * 8)]; await B.push(t, t.x - dx, t.y - dy, 2); log(`${t.name} уходит не туда.`); }
      const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { const ts = within(u, 4); return ts.length ? { unit: ts[0], score: 5 } : null; },
  };
  /* Заблудший путник (8): «Чужая память», «Тень удара» */
  P["lost-wanderer"] = {
    onDamaged(u, { src, o }) { if (!src || src === u) return; u.grudge = src.id; if (o && o.ctx && o.ctx.atk) u.lastHit = { src: src.id, atk: o.ctx.atk }; },
    attackMods(u, ctx) { if (ctx.tgt && ctx.tgt.id === u.grudge) { ctx.mods.push({ l: "Чужая память", v: 2 }); ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; u.grudge = null; } },
  };
  A["lost-wanderer"] = {
    time: "action", tgt() { return { type: "none" }; },
    can(u) { const h = u.lastHit, s = h && B.S.units.find(x => x.id === h.src); return s && alive(s) ? true : "по тебе ещё не били"; },
    async run(u, pk, ctl) { const h = u.lastHit, s = h && B.S.units.find(x => x.id === h.src); if (!s) return false; ctl.commit(); log(`${u.name} возвращает удар ${s.name}.`, "skill"); await B.doAttack(u, s, { ...h.atk, n: "Тень удара" }, { noRedirect: true }); return true; },
    ai(u) { const h = u.lastHit, s = h && B.S.units.find(x => x.id === h.src); return s && alive(s) && (h.atk.kind !== "melee" || dist(u, s) <= 1) ? { score: 12 } : null; },
  };
  /* Соломенное пугало (8): «Набито соломой», «Ужас полей» */
  P.scarecrow = { beforeZero(u, { o }) { if (u.strawUsed || (o && o.dt === "fire")) return false; u.strawUsed = true; log(`${u.name} поднимается: солома держит его.`, "skill"); fx(u, "встаёт", ""); return Math.max(1, Math.floor(u.maxHp / 2)); }, vulnerable(u, { dt }) { return dt === "fire"; } };
  A.scarecrow = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 2).length ? true : "никого в 2 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); for (const t of within(u, 2)) { const sv = await save(t, "wis", dcOf(u, "wis"), "Ужас полей", ["fear"], u); if (!sv.ok && alive(t)) addStatus(t, "frightened", { k: 1, when: "end", data: { by: u.id } }); } log(`${u.name} нагоняет ужас.`, "skill"); return true; },
    ai(u) { const n = within(u, 2).length; return n >= 2 ? { score: 8 + n * 3 } : null; },
  };
  /* Ведьмина сова (8): «Ночной дозор» (вне боя), «Метка совы» */
  A["witch-owl"] = {
    time: "bonus", tgt(u) { return specUnit(u, "Метка совы: кого?", within(u, 6), cellsAround(u, 6), "attack"); }, can(u) { return within(u, 6).length ? true : "нет цели в 6 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); if (pk.unit) { addStatus(pk.unit, "owlmark", { k: 1, when: "end" }); fx(pk.unit, "метка", "bad"); log(`${u.name} метит ${pk.unit.name}.`, "skill"); } return true; },
    ai(u) { const ts = within(u, 6).filter(t => !has(t, "owlmark")); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 7 } : null; },
  };
  /* Неудачный образец (8): «Нестабильная плоть», «Выплеск» */
  P["failed-specimen"] = {
    turnStart(u) { removeStatus(u, "mutarmor"); removeStatus(u, "packhowl"); u.mutDmg = false; u.mutAcid = false; const k = Math.floor(Math.random() * 4);
      if (k === 0) addStatus(u, "mutarmor", { k: 1, when: "start", data: { prot: 2 } }); else if (k === 1) addStatus(u, "packhowl", { k: 1, when: "start" }); else if (k === 2) u.mutDmg = true; else u.mutAcid = true;
      fx(u, ["наросты", "длинные ноги", "когти", "кислотная кожа"][k], ""); },
    attackMods(u, ctx) { if (u.mutDmg && ctx.atk && ctx.atk.kind === "melee") ctx.extra.push({ n: 1, s: 4, b: 0, dt: ctx.atk.dt || "slash", label: "Мутация" }); },
    resist(u, { dt }) { return dt === "acid" && u.mutAcid; },
  };
  A["failed-specimen"] = {
    time: "action", tgt(u) { return specUnit(u, "Выплеск: в сторону кого?", within(u, 3), cellsAround(u, 3), "attack"); }, can(u) { return within(u, 3).length ? true : "нет цели в 3 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit; if (!t) return true; const cells = B.lineCells(u, t).slice(0, 3).concat([[t.x, t.y]]), hit = new Set();
      for (const [x, y] of cells) for (const e of enemiesOf(u)) if (!hit.has(e.id) && footprint(e).some(([a, b]) => a === x && b === y)) { hit.add(e.id); await saveDmg(u, e, "dex", dcOf(u, "con"), [2, 6], "acid", "Выплеск"); }
      log(`${u.name} выплёскивает кислоту.`, "skill"); return true; },
    ai(u) { const ts = within(u, 3); return ts.length ? { unit: ts[0], score: 11 } : null; },
  };
  /* Тень служанки (7): «Сквозь стены», «Касание без тепла» */
  P["maid-shade"] = { passThrough: true };
  A["maid-shade"] = {
    time: "action", tgt(u) { return specUnit(u, "Касание без тепла: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; const r = await B.doAttack(u, t, a, { onCommit: () => ctl.commit() }); if (r && r.hit && alive(t) && !has(t, "chilled")) { addStatus(t, "chilled", { k: Infinity }); fx(t, "без тепла", "bad"); } return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1).filter(t => !has(t, "chilled")); return ts.length ? { unit: ts[0], score: 12 } : null; },
  };
  /* Ведьмин кот (7): «Девять жизней», «Тень за спиной»; тело — фамильяр (+2 к попаданию союзникам), невидим до первого удара */
  P["witch-cat"] = {
    async reactHit(u, ctx) { if ((u.lives ?? 2) <= 0 || (ctx.res && ctx.res.crit)) return false; u.lives = (u.lives ?? 2) - 1; const src = ctx.att || ctx.src;
      const cells = cellsAround(u, 1).filter(([x, y]) => B.canStand(u, x, y)).sort((a, b) => (src ? distCell(src, b[0], b[1]) - distCell(src, a[0], a[1]) : 0)); if (cells[0]) { u.x = cells[0][0]; u.y = cells[0][1]; }
      log(`${u.name} отскакивает — удар мимо (осталось уходов: ${u.lives}).`, "skill"); fx(u, "увернулся", "good"); const g = ui(); if (g) g.refresh(); return true; },
    attackMods(u, ctx) { if (ctx.tgt && u.pounceOn === ctx.tgt.id) { ctx.extra.push({ n: 1, s: 6, b: 0, dt: (ctx.atk && ctx.atk.dt) || "slash", label: "Тень за спиной" }); u.pounceOn = null; } },
  };
  P["body:witch-cat"] = {
    turnStart(u) { if (u.side === "mon" && !u.catHid) { u.catHid = true; addStatus(u, "hidden", { k: Infinity, data: { invis: true } }); } },
    attackMods(u) { removeStatus(u, "hidden"); },
    attackAura(a, { att, ctx }) { if (att && att !== a && att.side === a.side && a.side === "mon" && ctx && ctx.mods) ctx.mods.push({ l: "Фамильяр ведьмы", v: 2 }); },
  };
  A["witch-cat"] = {
    time: "bonus", tgt(u) { return specUnit(u, "Тень за спиной: к кому?", within(u, 4), cellsAround(u, 4), "attack"); }, can(u) { return within(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit; if (!t) return true; const cells = cellsAround(t, 1).filter(([x, y]) => B.canStand(u, x, y)).sort((a, b) => distCell(u, b[0], b[1]) - distCell(u, a[0], a[1]));
      if (cells[0]) { u.x = cells[0][0]; u.y = cells[0][1]; } u.pounceOn = t.id; log(`${u.name} оказывается за спиной ${t.name}.`, "skill"); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { const ts = within(u, 4).filter(t => dist(u, t) > 1); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 6 } : null; },
  };
  /* Мимик (6): «Бездонная пасть» (рюкзак +5, вне боя), «Клад мимика» (вне боя, один раз); тело — «Липкая шкура»: ударивший в ближнем бою прилипает */
  P.mimic = {};
  P["body:mimic"] = { async onDamaged(u, { src, o }) { if (!src || src.side === u.side || !o || !o.melee || !alive(src) || has(src, "restrained")) return; const sv = await save(src, "str", dcOf(u, "str"), "Липкая шкура", ["restrain"], u); if (!sv.ok && alive(src)) { addStatus(src, "restrained", { k: 1, when: "end" }); fx(src, "прилип", "bad"); log(`${src.name} прилипает к мимику.`); } } };
  /* Фонарщик тумана (6): «Фонарь проводника» (обзор, факел не нужен), «Шаг в туман»; тело — переносит себя и героев */
  A["fog-lantern"] = {
    time: "action", tgt(u) { return specUnit(u, "Шаг в туман: кого перенести?", within(u, 3), cellsAround(u, 3), "attack"); }, can(u) { return within(u, 3).length ? true : "нет цели в 3 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit; if (!t) return true; if (jumpTo(t, freeCellsIn(t.x, t.y, 3, t))) { if (t.t) t.t.react = 0; log(`${t.name} проваливается в туман.`, "skill"); fx(t, "в тумане", "bad"); } const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { const ts = within(u, 3); return ts.length ? { unit: ts[0], score: 5 } : null; },
  };
  P["body:fog-lantern"] = {
    turnStart(u) { if (u.side !== "mon") return; jumpTo(u, freeCellsIn(u.x, u.y, 4, u)); const hs = enemiesOf(u).filter(e => alive(e) && !e.down).sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
      for (const h of hs) if (jumpTo(h, freeCellsIn(h.x, h.y, 4, h))) fx(h, "туман переставил", "bad");
      log(`${u.name} шагает в туман: поле сместилось.`, "skill"); const g = ui(); if (g) g.refresh(); },
  };

  /* ===== Разлом «Кровавая крепость» (07.11) ===== */
  Object.assign(D.essCd, { "blood-slave": 3, "blood-bat": 3, "blood-ghoul": 3, "vampire-servant": 3, "blood-priest": 3, "blood-puddle": 3, "flesh-golem": 3, abomination: 4, "death-knight": 4 });
  Object.assign(D.monTune, {
    "blood-slave": { role: "swarm", circle: true, focus: ["nearest"], noFlee: true }, "blood-bat": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.3 },
    "blood-ghoul": { role: "brute", focus: ["weak", "nearest"], noFlee: true }, "vampire-servant": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
    "blood-priest": { role: "ranged", keep: 2, focus: ["nearest"], fleeHp: 0.3 }, "blood-puddle": { role: "brute", focus: ["nearest"], noFlee: true },
    "flesh-golem": { role: "brute", focus: ["nearest"], noFlee: true }, abomination: { role: "brute", focus: ["cluster", "nearest"], noFlee: true }, "death-knight": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
  });
  /* Раб крови (9) */
  P["blood-slave"] = { onDeath(u) { const a = alliesOf(u).filter(x => alive(x) && x !== u && dist(u, x) <= 1)[0]; if (a) { B.heal(a, roll(1, 6).total, u); fx(a, "подношение", "good"); } } };
  A["blood-slave"] = {
    time: "action", tgt(u) { return specUnit(u, "Укус отчаяния: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; const r = await B.doAttack(u, t, a, { extra: u.hp < u.maxHp / 2 ? [{ n: 1, s: 6, b: 0, dt: a.dt || "pierce", label: "Укус отчаяния" }] : [], onCommit: () => ctl.commit() }); return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1); return ts.length && u.hp < u.maxHp / 2 ? { unit: ts[0], score: 9 } : null; },
  };
  /* Летучая мышь-кровосос (9) */
  P["blood-bat"] = { onHitDealt(u) { if (u.suckRound === B.S.round) return; u.suckRound = B.S.round; B.heal(u, roll(1, 4).total, u); }, defendMods(t, ctx) { if (t.wingRound != null && t.wingRound >= B.S.round - 0 && t.wingUntil === B.S.round) ctx.dis.push("облако крыльев"); } };
  A["blood-bat"] = { time: "bonus", tgt() { return { type: "none" }; }, can() { return true; }, async run(u, pk, ctl) { ctl.commit(); u.wingRound = B.S.round; u.wingUntil = B.S.round; P["blood-bat"].turnStart = P["blood-bat"].turnStart || null; fx(u, "облако крыльев", "good"); return true; }, ai(u) { return u.hp < u.maxHp * 0.7 ? { score: 4 } : null; } };
  /* Кровавый гуль (8) */
  P["blood-ghoul"] = { async onHitDealt(u, { tgt, res }) { if (!tgt || !alive(tgt) || tgt.down || !(res && res.atk && res.atk.kind === "melee") || u.pinRound === B.S.round) return; u.pinRound = B.S.round; const sv = await save(tgt, "con", dcOf(u, "con"), "Парализующие когти", ["paralyze"], u); if (!sv.ok && alive(tgt)) { addStatus(tgt, "pinned", { k: 1, when: "end" }); fx(tgt, "оцепенел", "bad"); } } };
  A["blood-ghoul"] = {
    time: "action", tgt(u) { return specUnit(u, "Пожирание: кого?", within(u, 1).filter(t => t.hp < t.maxHp / 2), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).some(t => t.hp < t.maxHp / 2) ? true : "рядом нет раненых"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; const r = await B.doAttack(u, t, a, { extra: [{ n: 2, s: 6, b: 0, dt: a.dt || "slash", label: "Пожирание" }], onCommit: () => ctl.commit() }); if (r && r.hit) B.heal(u, 5, u); return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1).filter(t => t.hp < t.maxHp / 2); return ts.length ? { unit: ts[0], score: 16 } : null; },
  };
  /* Слуга вампиров (8) */
  P["vampire-servant"] = { attackMods(u, ctx) { if (B.S.round <= 2) { ctx.mods.push({ l: "Жажда", v: 2 }); ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; } } };
  A["vampire-servant"] = {
    time: "action", tgt(u) { return specUnit(u, "Вытягивание жизни: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; const r = await B.doAttack(u, t, a, { extra: [{ n: 1, s: 8, b: 0, dt: "necrotic", label: "Вытягивание жизни" }], onCommit: () => ctl.commit() }); if (r && r.hit) B.heal(u, roll(1, 8).total, u); return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1); return ts.length ? { unit: ts[0], score: u.hp < u.maxHp * 0.7 ? 14 : 8 } : null; },
  };
  /* Жрец крови (8): пассивка «Кровавая печать» (сама, откат 3 раунда), активка «Жертвенное лечение» (v116, решение автора) */
  P["blood-priest"] = { foeBloodied(u, { tgt }) {
    if (!tgt || !alive(tgt) || tgt.down || dist(u, tgt) > 4 || has(tgt, "noheal")) return;
    if (u.sealRound != null && B.S.round - u.sealRound < 3) return;
    u.sealRound = B.S.round; addStatus(tgt, "noheal", { k: 1, when: "end" }); fx(tgt, "печать крови", "bad"); log(`Кровавая печать: ${tgt.name} не может лечиться до конца своего следующего хода (${u.name}).`, "skill");
  } };
  const priestTargets = u => alliesOf(u).filter(x => alive(x) && !x.dead && x !== u && dist(u, x) <= 3 && (x.hp < x.maxHp || x.down));
  A["blood-priest"] = {
    time: "bonus", tgt(u) { return specUnit(u, "Жертвенное лечение: кого лечить?", priestTargets(u), B.cellsWithin(u, 3), "heal"); },
    can(u) { return u.hp <= 3 ? "слишком мало ОЗ" : priestTargets(u).length ? true : "некого лечить в 3 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); B.setHp(u, u.hp - 3); fx(u, "−3", "bad"); const h = roll(2, 4).total; B.heal(t, h, u); fx(t, `+${h}`, "good"); log(`${u.name} отдаёт 3 ОЗ своей крови: ${t.name} восстанавливает ${h}.`, "skill"); return true; },
    ai(u) { if (u.hp <= 8) return null; const ts = priestTargets(u).filter(x => x.hp < x.maxHp * 0.6).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp); return ts.length ? { unit: ts[0], score: 12 } : null; },
  };
  /* Кровавая лужа (8) */
  P["blood-puddle"] = { resist(u, { dt }) { return dt === "slash" || dt === "pierce"; } };
  A["blood-puddle"] = {
    time: "action", tgt(u) { return specUnit(u, "Поглотить: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit; if (!t) return true; const sv = await save(t, "str", dcOf(u, "con"), "Поглотить", ["restrain"], u); if (!sv.ok && alive(t)) { addStatus(t, "restrained", { k: 2, when: "end" }); await B.applyDamage(u, t, [{ v: roll(1, 6).total, dt: "acid", label: "Поглотить" }], { src: u }); fx(t, "поглощён", "bad"); } return true; },
    ai(u) { const ts = within(u, 1).filter(t => !has(t, "restrained")); return ts.length ? { unit: ts[0], score: 9 } : null; },
  };
  /* Голем плоти (7): «Сшитая плоть» — 5 временных ОЗ, не складываются, а обновляются до 5 в начале хода, если с прошлого хода не было урона огнём или кислотой (v116) */
  P["flesh-golem"] = { dmgFlat(u, { dt }) { if (dt === "fire" || dt === "acid") u.fleshBurned = true; return 0; },          // отмечаем огонь/кислоту даже если урон целиком съели временные ОЗ
    turnStart(u) { if (u.fleshBurned) { u.fleshBurned = false; fx(u, "плоть не срастается", "bad"); return; } if ((u.temp || 0) < 5) { u.temp = 5; u.tempSrc = "flesh"; fx(u, "5 врем. ОЗ", "good"); } } };
  A["flesh-golem"] = {
    time: "action", tgt(u) { return specUnit(u, "Мясной таран: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { ctl.commit(); const t = pk.unit; if (!t) return true; const sv = await saveDmg(u, t, "str", dcOf(u, "str"), [2, 6], "bludgeon", "Мясной таран"); if (!sv.ok && alive(t) && B.push) await B.push(t, u.x, u.y, 2); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { const ts = within(u, 1); return ts.length ? { unit: ts[0], score: 11 } : null; },
  };
  /* Поганище (7): «Смрад» (пассивка), «Мясницкий крюк» (v116): бросок крюка на 3 клетки — спасбросок Ловкости (провал — попал, 2к6 колющего), затем Силы (провал — притянут вплотную и ещё 1к8) */
  P.abomination = { resist(u, { dt }) { return dt === "poison"; },
    async turnStartAsync(u) { for (const t of within(u, 1)) { if (!alive(t) || t.down) continue; const sv = await save(t, "con", dcOf(u, "con"), "Смрад", ["poison"], u); if (!sv.ok && alive(t)) addStatus(t, "poisoned", { k: 1, when: "end" }); } } };
  const hookTargets = u => enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) <= 3 && !B.lineBlocked(u, t) && (!B.visibleTo || B.visibleTo(u, t)));
  A.abomination = {
    time: "action", tgt(u) { return specUnit(u, "Мясницкий крюк: в кого?", hookTargets(u), B.cellsWithin(u, 3), "attack"); }, can(u) { return hookTargets(u).length ? true : "нет цели в 3 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const dc = dcOf(u, "str");
      log(`${u.name} швыряет мясницкий крюк в ${t.name}.`, "skill");
      const s1 = await save(t, "dex", dc, "Мясницкий крюк: увернуться", [], u);
      if (s1.ok || !alive(t)) { fx(t, "увернулся", ""); return true; }
      await B.applyDamage(u, t, [{ v: roll(2, 6).total + Math.max(0, amod(u.abil.str)), dt: "pierce", label: "Мясницкий крюк" }], { src: u });
      if (!alive(t) || t.down) return true;
      const s2 = await save(t, "str", dc, "Мясницкий крюк: удержаться", ["push"], u);
      if (!s2.ok && alive(t)) { if (dist(u, t) > 1) await B.pullAdjacent(t, u); await B.applyDamage(u, t, [{ v: roll(1, 8).total, dt: "pierce", label: "Крюк рвёт плоть" }], { src: u }); fx(t, "притянут", "bad"); }
      return true; },
    ai(u) { const ts = hookTargets(u).sort((a, b) => dist(u, b) - dist(u, a)); return ts.length ? { unit: ts[0], score: 13 + (dist(u, ts[0]) > 1 ? 4 : 0) } : null; },
  };
  /* Мордрейн, низший рыцарь смерти (7, страж) */
  P["death-knight"] = { attackAura(a, { att, ctx }) { if (att && att !== a && att.side === a.side && dist(a, att) <= 2 && ctx) ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; } };
  A["death-knight"] = {
    time: "action", tgt(u) { return specUnit(u, "Удар смерти: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; const ex = roll(2, 8).total; const r = await B.doAttack(u, t, a, { extra: [{ n: 0, s: 0, b: ex, dt: "necrotic", label: "Удар смерти" }], onCommit: () => ctl.commit() }); if (r && r.hit) B.heal(u, Math.floor(ex / 2), u); return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 15 } : null; },
  };

  /* ===== Разлом «Ледяной грот» (07.11): холод, жаровни, 7 монстров ===== */
  // Холод героя хранится в общем объекте S.cold (по id героя) — он же у карты разлома. Растёт от ударов холодом ледяных тварей грота.
  const coldKey = u => u && u.side === "hero" && u.hero ? u.hero.id : null;
  const coldOf = u => { const k = coldKey(u); return k && B.S && B.S.cold ? (B.S.cold[k] || 0) : 0; };
  B.coldInit = u => { const c = coldOf(u); return c >= 8 ? -2 : c >= 4 ? -1 : 0; };
  B.coldSpd = u => { const c = coldOf(u); return c >= 8 ? 2 : c >= 6 ? 1 : 0; };
  const litNear = (u, r) => { const S = B.S; if (!S || u.x == null) return false; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = u.x + dx, y = u.y + dy; if (B.inB(x, y) && S.cells[y] && S.cells[y][x] === "brazierLit") return true; } return false; };
  const bigLit = () => { const S = B.S; return !!(S && S.bigBrazier && S.cells[S.bigBrazier.y][S.bigBrazier.x] === "bigBrazier"); };
  const syncFrost = u => { const c = coldOf(u); const st = has(u, "frost"); if (c > 0) { if (st) st.data.n = c; else addStatus(u, "frost", { k: Infinity, data: { n: c } }); } else if (st) removeStatus(u, "frost"); };
  B.addCold = async (u, n, why) => {
    const k = coldKey(u); if (!k || !B.S || !B.S.cold || !alive(u) || u.down) return;
    if (n > 0 && (litNear(u, 1) || bigLit())) return;          // у горящей жаровни холод не растёт; огромная жаровня греет всё поле
    let c = B.S.cold[k] || 0, dmg = 0; const cloak = gearOn(u, "back", "hide-cloak");
    for (let i = 0; i < Math.abs(n); i++) { if (n < 0) { c = Math.max(0, c - 1); continue; }
      if (cloak) { const ck = k + "~3", m = (B.S.cold[ck] || 0) + 1; B.S.cold[ck] = m % 3; if (m >= 3) { log(`${u.name}: плащ толстой шкуры удержал тепло.`, "good"); continue; } }          // каждый 3-й холод не прибавляется
      if (c >= 10) { dmg++; continue; } c++; if (c === 10) dmg++; }
    const was = B.S.cold[k] || 0; B.S.cold[k] = c; syncFrost(u);
    if (c !== was) { const st = [[4, "инициатива −1"], [6, "−1 клетка движения"], [8, "инициатива −2, движение −2"], [10, "окоченение"]].find(([t]) => was < t && c >= t); if (st) { log(`${u.name}: холод ${c}/10 — ${st[1]}.`, "bad"); fx(u, `холод ${c}`, "bad"); } }
    if (dmg) { log(`${u.name} коченеет: ${dmg} урона холодом${why ? " (" + why + ")" : ""}.`, "bad"); await B.applyDamage(null, u, [{ v: dmg, dt: "cold", label: "Окоченение" }], { pure: true }); }
  };
  B.coldHit = async (src, tgt, parts) => {
    if (!src || src.side !== "mon" || !src.mon || src.mon.rift !== "ice" || !B.S || !B.S.cold) return;
    if (!parts.some(p => p.dt === "cold")) return;
    await B.addCold(tgt, 1, src.name);
  };
  const prevColdHit = B.coldHit;
  B.coldHit = async (src, tgt, parts) => {          // Грольф: каждое его попадание +2 холода, любым уроном (автор 07.11)
    if (src && src.ref === "half-troll" && src.side === "mon" && B.S && B.S.cold) { await B.addCold(tgt, 2, src.name); return; }
    return prevColdHit(src, tgt, parts);
  };
  // Огромная жаровня у стража (автор 07.11): горит 2 раунда и гаснет; разжечь — действие героя рядом и 1 факел из его рюкзака; разожжённая снимает каждому герою 2 холода.
  const bigLight = async (S, who) => { const bb = S.bigBrazier; S.cells[bb.y][bb.x] = "bigBrazier"; bb.litRound = S.round; log(`${who ? who + " разжигает" : "Пылает"} огромную жаровню: тепло на 2 раунда, холод −2.`, "good"); for (const h of B.heroes()) if (alive(h) && !h.down) await B.addCold(h, -2); const g = ui(); if (g) g.refresh(); };
  B.iceActions = (u, out) => {          // подключается в battle-env.js (battle-weap.js переопределяет B.weapActions позже)
    const S = B.S, bb = S && S.bigBrazier;
    if (u.side === "hero" && u.hero && bb && S.cells[bb.y][bb.x] === "bigBrazierOut" && footprint(u).some(([x, y]) => Math.max(Math.abs(x - bb.x), Math.abs(y - bb.y)) <= 1)) {
      const torches = typeof countGear === "function" ? countGear(u.hero, "torch") : 0, act = B.timeOK(u, "action");
      out.push({ id: "bigbrazier", cat: "other", label: "Разжечь огромную жаровню", ico: "attack", sub: `действие и 1 факел (у героя: ${torches}): тепло на 2 раунда, всем героям −2 холода`, time: "action", enabled: !!act && torches > 0, why: !act ? "действие потрачено" : "нет факелов",
        run: async () => { if (!(typeof takeGear === "function" && takeGear(u.hero, "torch", 1))) return false; B.spendTime(u, "action"); await bigLight(S, u.name); return true; } });
    }
    return out;
  };
  B.coldTurnStart = async u => {
    const S = B.S; if (!S) return;
    for (const e of enemiesOf(u)) if (alive(e) && !e.down && e.pass && e.pass.includes("ice-spirit") && dist(u, e) <= 1) {          // «Морозная аура» (и у героя с эссенцией)
      await B.applyDamage(e, u, [{ v: roll(1, 4).total, dt: "cold", label: "Морозная аура" }], { src: e }); if (!alive(u) || u.down) return; }
    if (u.side === "hero") syncFrost(u);
    if (u.side !== "mon" || !u.mon || u.mon.rift !== "ice") return;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = u.x + dx, y = u.y + dy; if (B.inB(x, y) && S.cells[y] && S.cells[y][x] === "brazierLit") { S.cells[y][x] = "brazier"; log(`${u.name} дышит стужей на жаровню — пламя гаснет.`, "bad"); fx(u, "гасит жаровню", "bad"); } }
  };
  const prevColdTS = B.coldTurnStart;
  B.coldTurnStart = async u => {
    const S = B.S, bb = S && S.bigBrazier;
    if (bb) { if (bb.litRound == null && bigLit()) await bigLight(S); if (bigLit() && S.round - bb.litRound >= 2) { S.cells[bb.y][bb.x] = "bigBrazierOut"; log("Огромная жаровня прогорела и гаснет — нужен факел, чтобы разжечь её снова.", "bad"); const g = ui(); if (g) { g.banner("Жаровня погасла"); g.refresh(); } } }
    if (u.side === "hero" && S && S.opts && S.opts.autoHeroes && bb && S.cells[bb.y][bb.x] === "bigBrazierOut" && alive(u) && !u.down && B.iceActions) {          // прогон: герой рядом разжигает огромную жаровню
      const act = B.iceActions(u, []).find(a => a.id === "bigbrazier" && a.enabled); if (act) await act.run(); }
    if (has(u, "iced") && alive(u) && !u.down) { const st = has(u, "iced"); const sv = await save(u, "con", st.data.dc || 13, "Обледенение: стряхнуть лёд", [], null); if (sv.ok) { removeStatus(u, "iced"); log(`${u.name} стряхивает лёд.`, "good"); } }
    return prevColdTS(u);
  };
  const gearOn = (u, slot, id) => !!(u && u.hero && u.hero.equip && u.hero.equip[slot] && u.hero.equip[slot].id === id && !u.hero.equip[slot].broken);
  B.gearOn = gearOn;
  B.coldTurnEnd = async u => {
    if (u.side !== "hero" || !B.S || !B.S.cold) return;
    if (gearOn(u, "hands", "frost-gloves") || gearOn(u, "hands2", "frost-gloves")) { const gk = u.hero.id + "~g", m = (B.S.cold[gk] || 0) + 1; B.S.cold[gk] = m % 2; if (m >= 2) await B.addCold(u, -1); }          // рукавицы северянина: раз в 2 хода −1 холод
    const bb = B.S.bigBrazier;
    if (litNear(u, 1)) await B.addCold(u, -1);
  };
  // нарисованные картинки факелов и жаровен (assets/field/*.webp), когда они появятся в RASTER, заменяют SVG на поле боя
  for (const [t, f] of [["brazier", "brazier-off"], ["brazierLit", "brazier-on"], ["bigBrazier", "big-brazier-on"], ["bigBrazierOut", "big-brazier-off"]]) D.SVG[t] = `<image href="${typeof artPath === "function" ? artPath("field/" + f) : "assets/field/" + f + ".svg"}" x="0" y="0" width="100" height="100"/>`;          // рисунки assets/field/*.svg (07.11)
  Object.assign(D.essCd, { "ice-imp": 3, "frost-beetle": 3, "snow-hunter": 3, "ice-spirit": 3, "mammoth-calf": 3, "ice-deer": 4, "half-troll": 4 });
  Object.assign(D.monTune, {
    "ice-imp": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.25 }, "frost-beetle": { role: "brute", focus: ["cluster", "nearest"], noFlee: true },
    "snow-hunter": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.3 }, "ice-spirit": { role: "ranged", keep: 2, focus: ["nearest"], noFlee: true },
    "mammoth-calf": { role: "brute", focus: ["nearest"], noFlee: true }, "ice-deer": { role: "skirmish", focus: ["cluster", "nearest"], noFlee: true }, "half-troll": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
  });
  const foesIn = (u, r) => enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) <= r && !B.lineBlocked(u, t) && (!B.visibleTo || B.visibleTo(u, t)));
  /* Ледяной бесёнок (9) */
  P["ice-imp"] = { async onDamagedAsync(u, { src, o }) { if (!src || !alive(src) || !(o && o.melee) || u.spikeRound === B.S.round) return; u.spikeRound = B.S.round; await B.applyDamage(u, src, [{ v: roll(1, 4).total, dt: "cold", label: "Колючий иней" }], { src: u }); } };
  A["ice-imp"] = {
    time: "action", tgt(u) { return specUnit(u, "Ледяной плевок: в кого?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); log(`${u.name} плюётся льдом в ${t.name}.`, "skill"); const sv = await save(t, "dex", dcOf(u, "dex"), "Ледяной плевок", [], u);
      if (!sv.ok && alive(t)) { await B.applyDamage(u, t, [{ v: roll(1, 8).total, dt: "cold", label: "Ледяной плевок" }], { src: u }); if (alive(t)) addStatus(t, "slowed", { k: 2, when: "end", data: { add: -2 } }); } else fx(t, "увернулся", ""); return true; },
    ai(u) { const ts = foesIn(u, 4).filter(t => dist(u, t) > 1); return ts.length ? { unit: ts[0], score: 9 } : null; },
  };
  /* Инеевый жук (9) */
  P["frost-beetle"] = { dmgFlat(u, { v }) { if (!B.S || v <= 0 || u.shellRound === B.S.round) return 0; u.shellRound = B.S.round; return -2; } };
  A["frost-beetle"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { ctl.commit(); log(`${u.name} выдыхает морозное облако.`, "skill"); for (const t of within(u, 1)) { const sv = await saveDmg(u, t, "con", dcOf(u, "con"), [1, 6], "cold", "Морозное облако"); if (!sv.ok && alive(t)) addStatus(t, "frostbite", { k: 2, when: "end", data: { atkMod: -1 } }); } return true; },
    ai(u) { const n = within(u, 1).length; return n ? { score: 6 + n * 4 } : null; },
  };
  /* Снежный охотник (8) */
  P["snow-hunter"] = { defendMods(t, ctx) { if (B.S && B.S.round === 1 && ctx && ctx.dis) ctx.dis.push("белая маскировка"); } };
  A["snow-hunter"] = {
    time: "action", tgt(u) { return specUnit(u, "Прыжок из засады: на кого?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); log(`${u.name} прыгает на ${t.name}.`, "skill"); if (dist(u, t) > 1) await B.pullAdjacent(u, t); const sv = await save(t, "dex", dcOf(u, "dex"), "Прыжок из засады", [], u);
      if (!sv.ok && alive(t)) { await B.applyDamage(u, t, [{ v: roll(1, 10).total + Math.max(0, amod(u.abil.dex)), dt: "pierce", label: "Прыжок из засады" }], { src: u }); if (alive(t)) { addStatus(t, "slowed", { k: 2, when: "end", data: { mult: 0 } }); fx(t, "прижат к земле", "bad"); } } else fx(t, "увернулся", ""); return true; },
    ai(u) { const ts = foesIn(u, 4).filter(t => !has(t, "slowed")); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 11 } : null; },
  };
  /* Ледяной дух (8): «Морозная аура» — в B.coldTurnStart */
  P["ice-spirit"] = { resist(u, { dt }) { return dt === "cold"; } };
  P["body:ice-spirit"] = { vulnerable(u, { dt }) { return dt === "fire"; } };
  A["ice-spirit"] = {
    time: "action", tgt(u) { return specUnit(u, "Ледяное копьё: в кого?", foesIn(u, 6), B.cellsWithin(u, 6), "attack"); }, can(u) { return foesIn(u, 6).length ? true : "нет цели в 6 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); log(`${u.name} мечет ледяное копьё в ${t.name}.`, "skill"); const sv = await saveDmg(u, t, "con", dcOf(u, "int"), [2, 6], "cold", "Ледяное копьё"); if (!sv.ok && alive(t)) addStatus(t, "slowed", { k: 2, when: "end", data: { mult: 0.5 } }); return true; },
    ai(u) { const ts = foesIn(u, 6); return ts.length ? { unit: ts[0], score: 12 } : null; },
  };
  /* Детёныш мамонта (7): сборка «тяжёлое двуручное + холод» (v118, автор) */
  const heavyMelee = (u, atk) => !!atk && atk.kind === "melee" && (u.side !== "hero" || (atk.w && B.wprops && B.wprops(atk.w).two));
  P["mammoth-calf"] = { resist(u, { dt }) { return dt === "cold"; },
    attackMods(u, ctx) { if (!heavyMelee(u, ctx.atk)) return; ctx.extra.push({ n: 1, s: 6, b: 0, dt: "cold", label: "Морозный размах" });
      if (has(u, "icecharge")) ctx.extra.push({ n: 2, s: 6, b: 0, dt: "cold", label: "Ледяной натиск" }); },
    onHitDealt(u, { tgt, atk }) { if (!has(u, "icecharge") || !heavyMelee(u, atk) || !tgt || !alive(tgt) || tgt.down) return; B.queue(async () => { if (!alive(tgt) || tgt.down) return; const sv = await save(tgt, "str", dcOf(u, "str"), "Ледяной натиск", ["prone"], u); if (!sv.ok && alive(tgt)) { addStatus(tgt, "prone", { k: Infinity }); fx(tgt, "сбит с ног", "bad"); } }); } };
  A["mammoth-calf"] = {
    time: "bonus", tgt() { return { type: "none" }; },
    can(u) { if (has(u, "icecharge")) return "уже действует"; if (u.side === "hero") { const a = (B.heroAttacks ? B.heroAttacks(u) : []).find(x => heavyMelee(u, x)); if (!a) return "нужно двуручное оружие ближнего боя"; } return true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "icecharge", { k: Infinity, data: { endAtEndOf: u.id, endTurnNo: u.turnsTaken } }); fx(u, "ледяной натиск", "good"); log(`${u.name}: оружие покрывается льдом — до конца хода удары тяжёлым оружием +2к6 холодом и сбивают с ног.`, "skill"); return true; },
    ai(u) { return within(u, 1).length && !has(u, "icecharge") ? { score: 12 } : null; },
  };
  /* Сребророг (7): эссенция — доход (камни), монстр — осколки рогов (тело) */
  P["body:ice-deer"] = { onMissedBy(u, { att, atk }) { if (!att || !atk || atk.kind !== "melee" || !alive(att)) return; B.queue(async () => { if (alive(att)) await B.applyDamage(u, att, [{ v: roll(1, 4).total, dt: "pierce", label: "Хрустальные рога" }], { src: u }); }); } };
  P["ice-deer"] = {};          // «Рога-самоцветы» — вне боя (index.html: находки камней +1, лавочник платит за камни +10 %)
  A["ice-deer"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return foesIn(u, 2).length ? true : "никого в 2 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); log(`${u.name} ревёт — по пещере звенит лёд.`, "skill"); for (const t of foesIn(u, 2)) { const sv = await save(t, "wis", dcOf(u, "wis"), "Ледяной рёв", ["fear"], u); if (!sv.ok && alive(t)) { addStatus(t, "frightened", { k: 2, when: "end", data: { by: u.id } }); if (u.mon && u.mon.rift === "ice") await B.addCold(t, 1, "ледяной рёв"); } } return true; },
    ai(u) { const n = foesIn(u, 2).length; return n >= 1 ? { score: 8 + n * 4 } : null; },
  };
  /* Грольф, дикий полутролль (7, страж) */
  P["half-troll"] = { resist(u, { dt }) { return dt === "cold"; }, dmgFlat(u, { dt }) { if (dt === "fire") u.trollBurned = true; return 0; },
    turnStart(u) { if (u.trollBurned) { u.trollBurned = false; fx(u, "не срастается", "bad"); return; } if (u.hp < u.maxHp) { B.heal(u, 5, u); fx(u, "+5", "good"); } } };
  A["half-troll"] = {
    time: "action", tgt(u) { return specUnit(u, "Ледяная дубина: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; const r = await B.doAttack(u, t, a, { extra: [{ n: 2, s: 6, b: 0, dt: "cold", label: "Ледяная дубина" }], onCommit: () => ctl.commit() });
      if (r && r.hit && alive(t) && !t.down) { const sv = await save(t, "con", dcOf(u, "str"), "Ледяная дубина", [], u); if (!sv.ok && alive(t)) { addStatus(t, "iced", { k: Infinity, data: { dc: dcOf(u, "str") } }); fx(t, "обледенение", "bad"); log(`${t.name} покрывается льдом: −2 клетки движения, помеха на Силу и Ловкость, пока не стряхнёт (Телосложение в начале хода).`, "bad"); } } return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 15 } : null; },
  };
  /* ===== Разлом «Зыбучие пески» (07.11): зыбучий песок, урон «земля», 9 монстров ===== */
  // Зыбучий песок: вошёл — Ловкость Сл 12, провал — увяз до конца следующего хода; 3 хода подряд в песке — 1к6.
  B.sandEnter = async u => { if (!alive(u) || u.down || has(u, "sunk")) return; const sv = await save(u, "dex", 12, "Зыбучий песок", [], null); if (!sv.ok && alive(u)) { addStatus(u, "sunk", { k: 2, when: "end" }); fx(u, "увяз", "bad"); log(`${u.name} увязает в зыбучем песке.`, "bad"); } };
  const prevColdTE2 = B.coldTurnEnd;
  B.coldTurnEnd = async u => {
    const t = B.tinfo && B.tinfo(u.x, u.y);
    if (t && t.sand && !B.isFlying(u) && alive(u) && !u.down) { u.sandTurns = (u.sandTurns || 0) + 1; if (u.sandTurns >= 3) { log(`${u.name} тонет в песке.`, "bad"); await B.applyDamage(null, u, [{ v: roll(1, 6).total, dt: "bludgeon", label: "Зыбучий песок" }], { pure: true }); } }
    else u.sandTurns = 0;
    return prevColdTE2(u);
  };
  const prevRoundSand = B.onRound;
  B.onRound = function (round) { if (prevRoundSand) prevRoundSand.apply(this, arguments); const S = B.S; if (!S || !S.tmpSand) return;
    for (const [k, v] of Object.entries(S.tmpSand)) { if (--v.left <= 0) { const [x, y] = k.split(",").map(Number); if (S.cells[y] && S.cells[y][x] === "quicksand") S.cells[y][x] = v.old || ""; delete S.tmpSand[k]; } } };
  const freeNear = (u, t) => { for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [2, 0], [-2, 0], [0, -2]]) { const x = t.x + dx, y = t.y + dy; if (B.inB(x, y) && B.canStand(u, x, y)) return [x, y]; } return null; };
  Object.assign(D.essCd, { "sand-vulture": 3, "sand-scorpion": 3, "worm-larva": 3, "sand-worm": 3, "big-stinger": 3, "pseudo-cactus": 5, "mirage-scorpion": 4, "dead-vulture": 3, "kel-worm": 4 });
  Object.assign(D.monTune, {
    "sand-vulture": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.3 }, "sand-scorpion": { role: "brute", focus: ["nearest"], fleeHp: 0.25 },
    "worm-larva": { role: "brute", focus: ["nearest"], hide: true, still: true, noFlee: true }, "sand-worm": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
    "big-stinger": { role: "brute", focus: ["weak", "nearest"], noFlee: true }, "pseudo-cactus": { role: "brute", focus: ["nearest"], hide: true, still: true, noFlee: true },
    "mirage-scorpion": { role: "skirmish", focus: ["weak", "nearest"], noFlee: true }, "dead-vulture": { role: "brute", focus: ["weak", "nearest"], noFlee: true }, "kel-worm": { role: "brute", focus: ["cluster", "nearest"], noFlee: true },
  });
  /* Стервятник-падальщик (9) */
  P["sand-vulture"] = { attackMods(u, ctx) { if (ctx.tgt && ctx.tgt.hp < ctx.tgt.maxHp / 2 && ctx.adv) ctx.adv.push("чуткий нюх"); } };
  A["sand-vulture"] = {
    time: "action", tgt(u) { return specUnit(u, "Клевок в глаза: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; const r = await B.doAttack(u, t, a, { onCommit: () => ctl.commit() }); if (r && r.hit && alive(t) && !t.down) { const sv = await save(t, "con", dcOf(u, "dex"), "Клевок в глаза", [], u); if (!sv.ok) { addStatus(t, "pecked", { k: 2, when: "end" }); fx(t, "клевок в глаза", "bad"); } } return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1); return ts.length ? { unit: ts[0], score: 9 } : null; },
  };
  /* Малый скорпион (9) */
  P["sand-scorpion"] = { dmgFlat(u, { o, v }) { return o && o.ctx && o.ctx.atk && o.ctx.atk.kind === "ranged" && v > 0 ? -1 : 0; } };
  A["sand-scorpion"] = {
    time: "action", tgt(u) { return specUnit(u, "Ядовитое жало: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; const r = await B.doAttack(u, t, a, { extra: [{ n: 1, s: 6, b: 0, dt: "poison", label: "Ядовитое жало" }], onCommit: () => ctl.commit() }); if (r && r.hit && alive(t) && !t.down) { const sv = await save(t, "con", dcOf(u, "con"), "Ядовитое жало", ["poison"], u); if (!sv.ok && alive(t)) addStatus(t, "poisoned", { k: 2, when: "end" }); } return !(r && r.cancelled); },
    ai(u) { const ts = within(u, 1); return ts.length ? { unit: ts[0], score: 10 } : null; },
  };
  /* Личинка песчаного червя (9) — «Спячка в песке»: монстр прячется в начале боя (hide), герой с эссенцией — тоже (battle.js preStart) */
  P["worm-larva"] = {};
  A["worm-larva"] = {
    time: "action", tgt(u) { return specUnit(u, "Плевок песком: в кого?", foesIn(u, 3), B.cellsWithin(u, 3), "attack"); }, can(u) { return foesIn(u, 3).length ? true : "нет цели в 3 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const sv = await save(t, "dex", dcOf(u, "con"), "Плевок песком", [], u); if (!sv.ok && alive(t)) { addStatus(t, "blinded", { k: 2, when: "end" }); fx(t, "ослеплён", "bad"); } return true; },
    ai(u) { const ts = foesIn(u, 3).filter(t => !has(t, "blinded")); return ts.length ? { unit: ts[0], score: 8 } : null; },
  };
  /* Взрослый песчаный червь (8): пассивка эссенции «Сейсмическое чутьё»; у монстра — уход под песок (особенность) */
  P["sand-worm"] = { noSurprise() { return true; }, defendMods(t, ctx) { if (ctx && ctx.adv && ctx.att && dist(t, ctx.att) <= 3) ctx.adv = ctx.adv.filter(a => !/затаил|скрыт|невидим|маскир|из укрытия|не замечен/i.test(String(a))); } };
  const wormJump = async (u, t) => { const c = freeNear(u, t); if (!c) return false; removeStatus(u, "underground"); await B.teleport(u, c[0], c[1]); return true; };
  P["body:sand-worm"] = { async turnStartAsync(u) {
    const S = B.S; if (has(u, "underground")) { const ts = enemiesOf(u).filter(e => alive(e) && !e.down); const t = ts.sort((a, b) => a.hp - b.hp)[0]; if (t && await wormJump(u, t)) log(`${u.name} выныривает из песка рядом с ${t.name}!`, "bad"); else removeStatus(u, "underground"); u.wormOut = S.round; return; }
    if (S.round >= 2 && S.round - (u.wormOut || 0) >= 2 && !within(u, 1).length) { addStatus(u, "underground", { k: Infinity }); log(`${u.name} уходит под песок.`, "skill"); fx(u, "под песком", ""); B.spendTime(u, "action"); B.spendTime(u, "bonus"); if (u.t) u.t.move = 0; } } };
  A["sand-worm"] = {
    time: "action", tgt(u) { return specUnit(u, "Песчаный рывок: к кому?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); if (dist(u, t) > 1 && !(await wormJump(u, t))) { log(`${u.name}: рядом с ${t.name} негде вынырнуть.`); return true; }
      log(`${u.name} выныривает из песка под ${t.name}.`, "skill"); await B.applyDamage(u, t, [{ v: roll(2, 6).total, dt: "bludgeon", label: "Песчаный рывок" }], { src: u }); if (alive(t) && !t.down) { const sv = await save(t, "str", dcOf(u, "str"), "Песчаный рывок", ["prone"], u); if (!sv.ok && alive(t)) addStatus(t, "prone", { k: Infinity }); } return true; },
    ai(u) { const ts = foesIn(u, 4).filter(t => dist(u, t) > 1); return ts.length ? { unit: ts[0], score: 12 } : null; },
  };
  /* Большое жало (8) */
  P["big-stinger"] = { onHitDealt(u, { tgt }) { if (tgt && has(tgt, "poisoned") && !has(tgt, "slowed")) addStatus(tgt, "slowed", { k: 2, when: "end", data: { add: -1 } }); } };
  P["body:big-stinger"] = { onHitDealt(u, { tgt, atk }) { if (!tgt || !alive(tgt) || tgt.down || !atk || atk.kind !== "melee") return; B.queue(async () => { if (!alive(tgt) || tgt.down) return; await B.applyDamage(u, tgt, [{ v: roll(1, 6).total, dt: "poison", label: "Яд хвоста" }], { src: u, noAbilParts: true }); if (!alive(tgt) || tgt.down) return; const sv = await save(tgt, "con", dcOf(u, "con"), "Яд хвоста", ["poison"], u); if (!sv.ok && alive(tgt)) addStatus(tgt, "poisoned", { k: 2, when: "end" }); }); } };
  A["big-stinger"] = {
    time: "action", tgt(u) { return specUnit(u, "Пронзающий хвост: кого?", foesIn(u, 2), B.cellsWithin(u, 2), "attack"); }, can(u) { return foesIn(u, 2).length ? true : "нет цели в 2 клетках"; },
    async run(u, pk, ctl) { const a0 = atkFor(u, "melee"), t = pk.unit; if (!a0 || !t) return false; const a = { ...a0, reach: Math.max(2, a0.reach || 1), n: "Пронзающий хвост" }; u.pierceTail = true; const r = await B.doAttack(u, t, a, { onCommit: () => ctl.commit() }); u.pierceTail = false; return !(r && r.cancelled); },
    ai(u) { const ts = foesIn(u, 2); return ts.length ? { unit: ts.sort((a, b) => (b.prot || 0) - (a.prot || 0))[0], score: 11 } : null; },
  };
  const prevStingAtk = P["big-stinger"].attackMods;
  P["big-stinger"].attackMods = function (u, ctx) { if (prevStingAtk) prevStingAtk(u, ctx); if (u.pierceTail) ctx.protIgnore = (ctx.protIgnore || 0) + 2; };
  /* Псевдокактус (8) */
  P["pseudo-cactus"] = {
    async onDamagedAsync(u, { src, o, total }) {
      if (has(u, "spinestance") && o && (o.splash || o.area || (o.parts && o.parts.some(p => p.dt === "fire")) || (o.ctx && o.ctx.total >= 20))) { removeStatus(u, "spinestance"); log(`Колючая стойка ${u.name} сбита.`, "good"); }
      if (!src || !alive(src) || !(o && o.melee) || u.spikeRound2 === B.S.round) return; u.spikeRound2 = B.S.round; await B.applyDamage(u, src, [{ v: roll(1, 4).total, dt: "pierce", label: "Колючки" }], { src: u, noAbilParts: true }); },
    async hitTaken(u, { att, res }) { if (has(u, "spinestance") && res && res.total >= 20) { removeStatus(u, "spinestance"); log(`Колючая стойка ${u.name} сбита сильным ударом.`, "good"); } },
    attackDone: null,
  };
  // ответный удар в стойке: любой, кто атаковал кактус и стоит в его досягаемости, получает обычную атаку оружием
  const prevMissed = P["pseudo-cactus"].onMissedBy;
  const spineCounter = (u, att) => { if (!has(u, "spinestance") || !att || !alive(att) || att.side === u.side) return; B.queue(async () => { if (!alive(u) || u.down || !alive(att) || att.down || !has(u, "spinestance")) return; const a = atkFor(u, "melee"); if (!a || dist(u, att) > (a.reach || 1)) return; log(`${u.name} отвечает ударом из колючей стойки.`, "skill"); await B.doAttack(u, att, a, {}); }); };
  P["pseudo-cactus"].onMissedBy = function (u, c) { if (prevMissed) prevMissed(u, c); spineCounter(u, c && c.att); };
  const prevHT = P["pseudo-cactus"].hitTaken;
  P["pseudo-cactus"].hitTaken = async function (u, c) { await prevHT(u, c); spineCounter(u, c && c.att); };
  A["pseudo-cactus"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return has(u, "spinestance") ? "уже в стойке" : true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "spinestance", { k: Infinity, data: { prot: 3, endAtEndOf: u.id, endTurnNo: u.turnsTaken + 1 } }); fx(u, "колючая стойка", "good"); log(`${u.name} ощетинивается иглами: +3 Защиты и ответный удар каждому, кто атакует.`, "skill"); return true; },
    ai(u) { return within(u, 1).length >= 1 && !has(u, "spinestance") ? { score: 13 } : null; },
  };
  /* Миражный скорпион (7, минибосс): под скрытность + копьё/посох */
  P["mirage-scorpion"] = {
    reactHit(u, ctx) { if (u.mirageUsed) return false; u.mirageUsed = true; log(`${u.name}: удар уходит в песчаного двойника!`, "good"); fx(u, "мираж", "good"); return true; },
    attackMods(u, ctx) { const w = ctx.atk && ctx.atk.w; if (has(u, "hidden") && (u.side !== "hero" || (w && /spear|staff|pike/.test(w.id || "")))) ctx.mods.push({ l: "Песчаный двойник", v: 2 }); },
  };
  A["mirage-scorpion"] = {
    time: "bonus", tgt(u) { return { type: "cell", prompt: "Обманка: куда перенестись?", cells: B.cellsWithin(u, 3).filter(([x, y]) => B.canStand(u, x, y)), kind: "move" }; }, can() { return true; },
    async run(u, pk, ctl) { let c = pk.cell; if (!c) { const cs = B.cellsWithin(u, 3).filter(([x, y]) => B.canStand(u, x, y)); c = cs[Math.floor(Math.random() * cs.length)]; } if (!c) return false; ctl.commit(); await B.teleport(u, c[0], c[1]); addStatus(u, "hidden", { k: Infinity, data: { unseen: true, dc: 10 + dcOf(u, "dex") - 8 } }); fx(u, "растворился в мареве", "good"); log(`${u.name} растворяется в мареве.`, "skill"); return true; },
    ai(u) { return !has(u, "hidden") && u.hp < u.maxHp * 0.7 ? { score: 9 } : null; },
  };
  /* Стервятник мёртвых земель (7, минибосс): тяжёлое оружие с замахом */
  P["dead-vulture"] = {
    onHitDealt(u, { tgt, atk }) {
      if (!tgt || !heavyMelee(u, atk)) return;
      if (has(u, "hookreach") && alive(tgt) && !tgt.down && dist(u, tgt) > 1) B.queue(async () => { if (alive(tgt) && !tgt.down && dist(u, tgt) > 1) { await B.pullAdjacent(tgt, u); fx(tgt, "притянут", "bad"); } });
      const side = enemiesOf(u).find(e => e !== tgt && alive(e) && !e.down && dist(e, tgt) <= 1); if (!side || u.stormRound === B.S.round) return; u.stormRound = B.S.round;
      B.queue(async () => { if (alive(side) && !side.down) await B.applyDamage(u, side, [{ v: Math.max(1, Math.floor(roll(atk.dmg ? atk.dmg.n || 1 : 1, atk.dmg ? atk.dmg.s || 6 : 6).total / 2 + 1)), dt: atk.dt || "slash", label: "Крылья бури" }], { src: u, noAbilParts: true }); });
    },
  };
  A["dead-vulture"] = {
    time: "bonus", tgt() { return { type: "none" }; }, can(u) { return has(u, "hookreach") ? "уже действует" : true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "hookreach", { k: Infinity, data: { endAtEndOf: u.id, endTurnNo: u.turnsTaken } }); fx(u, "когти-крючья", "good"); log(`${u.name}: до конца хода досягаемость +1, задетого издалека притянет.`, "skill"); return true; },
    ai(u) { return !has(u, "hookreach") && !within(u, 1).length && foesIn(u, 6).length ? { score: 10 } : null; },          // 09.11: враг в пределах рывка (раньше — ровно в 3 м до движения, почти не срабатывало)
  };
  const prevAttacksOfSand = B.attacksOf;
  B.attacksOf = u => { const list = prevAttacksOfSand(u); return has(u, "hookreach") ? list.map(a => a.kind === "melee" ? { ...a, reach: (a.reach || 1) + 1 } : a) : list; };
  /* Кель адской пустыни (7, страж): эссенция — маг земли; монстр — ныряет и выныривает по подсвеченной зоне */
  P["kel-worm"] = { abilityParts(u, { tgt, parts, o }) { if (!tgt || tgt === u || tgt.side === u.side || o.kelDone || !parts.some(p => p.v > 0)) return; o.kelDone = true; parts.push({ v: roll(1, 6).total, dt: "earth", label: "Сердце пустыни" }); if (alive(tgt)) addStatus(tgt, "slowed", { k: 1, when: "end", data: { add: -1 } }); } };
  const kelZone = (S, cx, cy) => { const cells = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (B.inB(cx + dx, cy + dy)) cells.push([cx + dx, cy + dy]); return cells; };
  P["body:kel-worm"] = { async turnStartAsync(u) {
    const S = B.S;
    if (has(u, "underground") && u.kelMark) {
      const { x: cx, y: cy, cells } = u.kelMark; S.zones = (S.zones || []).filter(z => z.id !== "kel" + u.id); u.kelMark = null; removeStatus(u, "underground");
      let spot = null; for (let r = 1; r <= 4 && !spot; r++) for (let oy = -r; oy <= r && !spot; oy++) for (let ox = -r; ox <= r && !spot; ox++) { const x = cx - 1 + ox, y = cy - 1 + oy; if (x >= 0 && y >= 0 && B.canStand(u, x, y)) spot = [x, y]; }
      const victims = live().filter(o => o !== u && cells.some(([x, y]) => footprint(o).some(([fx2, fy]) => fx2 === x && fy === y)));
      if (spot) await B.teleport(u, spot[0], spot[1]);
      log(`${u.name} вырывается из песка!`, "bad"); const g = ui(); if (g) g.banner("Кель вынырнул!");
      for (const t of victims) if (alive(t) && t !== u) await saveDmg(u, t, "dex", dcOf(u, "str"), [3, 8], "bludgeon", "Кель выныривает");
      for (const t of live().filter(o => o !== u && o.side !== u.side && dist(u, o) <= 1)) if (alive(t)) await B.applyDamage(u, t, [{ v: roll(1, 8).total, dt: "bludgeon", label: "Удар телом" }], { src: u, splash: true, noAbilParts: true });
      u.kelOut = S.round; return;
    }
    if (S.round >= 2 && S.round - (u.kelOut || 0) >= 2 && !has(u, "underground")) {
      const ts = enemiesOf(u).filter(e => alive(e) && !e.down); if (!ts.length) return; const t = ts[Math.floor(Math.random() * ts.length)];
      const cells = kelZone(S, t.x, t.y); u.kelMark = { x: t.x, y: t.y, cells }; (S.zones ||= []).push({ id: "kel" + u.id, kind: "kel", cells });
      addStatus(u, "underground", { k: Infinity }); log(`${u.name} уходит под песок — земля дрожит у ${t.name} (подсвечено, где он вынырнет).`, "bad");
      B.spendTime(u, "action"); B.spendTime(u, "bonus"); if (u.t) u.t.move = 0;
    } } };
  A["kel-worm"] = {
    time: "action", tgt(u) { return specUnit(u, "Разлом земли: в сторону кого?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const S = B.S, c = B.center ? B.center(u) : { x: u.x, y: u.y }; const sx = Math.sign(t.x - u.x), sy = Math.sign(t.y - u.y); const cells = [];
      let x = u.x, y = u.y; for (let i = 0; i < 4; i++) { x += sx; y += sy; if (!B.inB(x, y)) break; cells.push([x, y]); }
      log(`${u.name} раскалывает землю!`, "skill");
      for (const o of live().filter(o => o !== u && o.side !== u.side && cells.some(([cx, cy]) => footprint(o).some(([fx2, fy]) => fx2 === cx && fy === cy)))) await saveDmg(u, o, "dex", dcOf(u, "int"), [3, 6], "earth", "Разлом земли");
      for (const [cx, cy] of cells) { const cur = S.cells[cy] && S.cells[cy][cx]; const ti = cur ? D.terrain[cur] : null; if (ti && ti.obstacle) continue; (S.tmpSand ||= {})[cx + "," + cy] = { old: cur || "", left: 2 }; S.cells[cy][cx] = "quicksand"; }
      const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { const ts = foesIn(u, 4); return ts.length >= 1 ? { unit: ts[0], score: 11 } : null; },
  };
  /* ===== Разлом «Зелёная шахта» (07.11): 13 монстров ===== */
  Object.assign(D.essCd, { "goblin-miner": 3, kobold: 3, slime: 3, "kobold-guard": 3, "goblin-blaster": 4, "acid-slime": 3, "stone-slime": 3, "split-slime": 4, "mine-ghost": 3, "cart-mimic": 3, "kobold-captain": 4, "goblin-foreman": 5, rimuru: 4 });
  Object.assign(D.monTune, {
    "goblin-miner": { role: "brute", focus: ["nearest"], fleeHp: 0.3 }, kobold: { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.3 }, slime: { role: "brute", focus: ["nearest"], noFlee: true },
    "kobold-guard": { role: "brute", focus: ["nearest"], noFlee: true }, "goblin-blaster": { role: "ranged", keep: 3, focus: ["cluster", "nearest"], fleeHp: 0.3 }, "acid-slime": { role: "brute", focus: ["nearest"], noFlee: true },
    "stone-slime": { role: "brute", focus: ["nearest"], noFlee: true }, "split-slime": { role: "brute", focus: ["nearest"], noFlee: true }, "mine-ghost": { role: "skirmish", focus: ["weak", "nearest"], noFlee: true },
    "cart-mimic": { role: "brute", focus: ["cluster", "nearest"], noFlee: true }, "kobold-captain": { role: "brute", focus: ["weak", "nearest"], noFlee: true }, "goblin-foreman": { role: "ranged", keep: 2, focus: ["cluster", "nearest"], noFlee: true }, rimuru: { role: "brute", focus: ["weak", "nearest"], noFlee: true },
  });
  const lineFrom = (u, t, n) => { const sx = Math.sign(t.x - u.x), sy = Math.sign(t.y - u.y), out = []; let x = u.x, y = u.y; for (let i = 0; i < n; i++) { x += sx; y += sy; if (!B.inB(x, y)) break; out.push([x, y]); } return out; };
  const unitsOn = (cells, side) => live().filter(o => o.side !== side && cells.some(([cx, cy]) => footprint(o).some(([fx2, fy]) => fx2 === cx && fy === cy)));
  /* Гоблин-шахтёр (9): «Шахтёрская сноровка» — вне боя (index.html digShouldWear) */
  P["goblin-miner"] = {};
  A["goblin-miner"] = {
    time: "action", tgt(u) { return specUnit(u, "Обвал кирки: в сторону кого?", foesIn(u, 2), B.cellsWithin(u, 2), "attack"); }, can(u) { return foesIn(u, 2).length ? true : "нет цели в 2 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); log(`${u.name} обрушивает свод киркой.`, "skill"); for (const o of unitsOn(lineFrom(u, t, 2), u.side)) { const sv = await saveDmg(u, o, "dex", dcOf(u, "str"), [1, 6], "bludgeon", "Обвал кирки"); if (!sv.ok && alive(o)) addStatus(o, "prone", { k: Infinity }); } return true; },
    ai(u) { const ts = foesIn(u, 2); return ts.length ? { unit: ts[0], score: 8 } : null; },
  };
  /* Кобольд (9) */
  P.kobold = { attackMods(u, ctx) { if (ctx.tgt && ctx.adv && alliesOf(u).some(a => a !== u && alive(a) && !a.down && dist(a, ctx.tgt) <= 1)) ctx.adv.push("стайная тактика"); } };
  A.kobold = {
    time: "action", tgt(u) { const cs = B.cellsWithin(u, 2).filter(([x, y]) => !B.occupant(x, y) && !(B.terrain(x, y))); return { type: "cell", prompt: "Камнепад: куда поставить ловушку?", cells: cs, kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) { let c = pk.cell; if (!c) { const cs = B.cellsWithin(u, 2).filter(([x, y]) => !B.occupant(x, y) && !B.terrain(x, y)); c = cs[Math.floor(Math.random() * cs.length)]; } if (!c) return false; ctl.commit(); setTrap(u, c[0], c[1], { dmg: "1к6" }); log(`${u.name} возится у стены штольни.`, "skill"); return true; },
    ai(u) { return foesIn(u, 4).length && !within(u, 1).length ? { score: 5 } : null; },
  };
  /* Слизь (9) */
  P.slime = { resist(u, { dt }) { return dt === "bludgeon"; } };
  A.slime = {
    time: "action", tgt(u) { return specUnit(u, "Липкий плевок: в кого?", foesIn(u, 3), B.cellsWithin(u, 3), "attack"); }, can(u) { return foesIn(u, 3).length ? true : "нет цели в 3 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const sv = await save(t, "dex", dcOf(u, "con"), "Липкий плевок", ["restrain"], u); if (!sv.ok && alive(t)) { addStatus(t, "restrained", { k: 2, when: "end" }); fx(t, "прилип", "bad"); } return true; },
    ai(u) { const ts = foesIn(u, 3).filter(t => !has(t, "restrained")); return ts.length ? { unit: ts[0], score: 8 } : null; },
  };
  /* Кобольд-страж (8) */
  P["kobold-guard"] = { slowAura(e, { u }) { return dist(e, u) <= 1 ? 1 : 0; }, immune(u, c) { return c && c.id === "push" && (u.side !== "hero" || (B.offOf && B.offOf(u) && /shield/.test(B.offOf(u).id || ""))); } };
  A["kobold-guard"] = {
    time: "action", tgt(u) { return specUnit(u, "Таран щитом: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const sv = await save(t, "str", dcOf(u, "str"), "Таран щитом", ["push"], u); if (!sv.ok && alive(t)) { if (B.push) await B.push(t, u.x, u.y, 1); if (alive(t)) addStatus(t, "prone", { k: Infinity }); fx(t, "сбит", "bad"); } return true; },
    ai(u) { const ts = within(u, 1).filter(t => !has(t, "prone")); return ts.length ? { unit: ts[0], score: 9 } : null; },
  };
  /* Гоблин-подрывник (8) */
  P["goblin-blaster"] = { abilityParts(u, { tgt, parts, o }) { if (!tgt || tgt.side === u.side || o.fuseDone || !parts.some(p => p.dt === "fire" && p.v > 0)) return; o.fuseDone = true; parts.push({ v: roll(1, 4).total, dt: "fire", label: "Короткий фитиль" }); } };
  const blast = async (u, t, dice, label) => { const cx = t.x, cy = t.y; log(`${u.name} швыряет ${label.toLowerCase()}.`, "skill"); const g = ui(); if (g && g.fxAbility) try { g.fxAbility(u, label); } catch (e) {}
    for (const o of live().filter(o => o !== u && footprint(o).some(([fx2, fy]) => Math.max(Math.abs(fx2 - cx), Math.abs(fy - cy)) <= 1))) await saveDmg(u, o, "dex", dcOf(u, "dex"), dice, "fire", label);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (B.inB(cx + dx, cy + dy) && B.terrain(cx + dx, cy + dy) === "dynamite" && B.hitObject) {} };
  A["goblin-blaster"] = {
    time: "action", tgt(u) { return specUnit(u, "Динамитная шашка: в кого?", foesIn(u, 3), B.cellsWithin(u, 3), "attack"); }, can(u) { return foesIn(u, 3).length ? true : "нет цели в 3 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); await blast(u, t, [1, 6, 2], "Динамитная шашка"); return true; },
    ai(u) { const ts = foesIn(u, 3).filter(t => dist(u, t) >= 2); return ts.length ? { unit: ts.sort((a, b) => live().filter(o => o.side === a.side && dist(o, a) <= 1).length - live().filter(o => o.side === b.side && dist(o, b) <= 1).length).pop(), score: 11 } : null; },
  };
  /* Кислотная слизь (8) */
  P["acid-slime"] = { async onDamagedAsync(u, { src, o }) { if (!src || !alive(src) || !(o && o.melee) || u.acidRound === B.S.round) return; u.acidRound = B.S.round; await B.applyDamage(u, src, [{ v: roll(1, 4).total, dt: "acid", label: "Едкая плоть" }], { src: u, noAbilParts: true }); } };
  A["acid-slime"] = {
    time: "action", tgt(u) { return specUnit(u, "Кислотный плевок: в кого?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const sv = await save(t, "dex", dcOf(u, "con"), "Кислотный плевок", [], u); if (!sv.ok && alive(t)) { await B.applyDamage(u, t, [{ v: roll(1, 6).total, dt: "acid", label: "Кислотный плевок" }], { src: u }); if (alive(t)) { const c = has(t, "corroded"); if (c) c.data.prot = (c.data.prot || 0) - 1; else addStatus(t, "corroded", { k: Infinity, data: { prot: -1 } }); fx(t, "броня разъедена", "bad"); } } else fx(t, "увернулся", ""); return true; },
    ai(u) { const ts = foesIn(u, 4); return ts.length ? { unit: ts.sort((a, b) => (b.prot || 0) - (a.prot || 0))[0], score: 10 } : null; },
  };
  /* Каменная слизь (8) */
  P["stone-slime"] = { speedBonus() { return -1; }, turnStart(u) { if (!has(u, "stonecrust")) addStatus(u, "stonecrust", { k: Infinity, data: { prot: 2 } }); } };
  A["stone-slime"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return has(u, "faithwall") ? "уже окаменел" : true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "faithwall", { k: Infinity, data: { endAtStartOf: u.id } }); addStatus(u, "slowed", { k: Infinity, data: { mult: 0, endAtStartOf: u.id } }); fx(u, "окаменел", "good"); log(`${u.name} каменеет: до своего хода физический урон вполовину.`, "skill"); return true; },
    ai(u) { return u.hp < u.maxHp * 0.6 && within(u, 1).length ? { score: 9 } : null; },
  };
  /* Делящаяся слизь (8): эссенция «Второе тело»; монстр делится от удара 8+ */
  P["split-slime"] = { beforeZero(u) { if (u.side !== "hero" || u.secondBody) return false; u.secondBody = true; log(`${u.name}: второе тело — встаёт с 5 ОЗ!`, "good"); fx(u, "второе тело", "good"); return 5; } };
  P["body:split-slime"] = { onDamaged(u, { total }) { if (total < 8 || !alive(u) || (u.splits || 0) >= 2) return; u.splits = (u.splits || 0) + 1; B.queue(async () => { if (!alive(u)) return; const m = B.monUnit("slime", -1), c = B.freeCellsNear(u, 1, m)[0]; if (!c) return; m.x = c[0]; m.y = c[1]; if (u.side === "hero") m.noReward = true; B.addUnit(m, B.S.order[B.S.turn]); log(`От ${u.name} отделяется малая слизь.`, "bad"); }); } };
  A["split-slime"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return B.freeCellsNear(u, 1, { size: 1, side: u.side, id: "x" }).length ? true : "нет места рядом"; },
    async run(u, pk, ctl) { ctl.commit(); const m = B.monUnit("slime", -1), c = B.freeCellsNear(u, 1, m)[0]; if (!c) return true; m.x = c[0]; m.y = c[1]; m.noReward = true;
      if (u.side === "hero") { m.side = "hero"; m.summon = true; m.auto = true; m.kind = "slime"; m.threat = 3; m.name = "Слизень-приманка"; }
      B.addUnit(m, B.S.order[B.S.turn]); if (u.side === "hero") { m.side = "hero"; m.threat = 3; } log(`${u.name} отпочковывает слизня.`, "skill"); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { return (u.buds || 0) < 1 && within(u, 1).length ? (u.buds = (u.buds || 0) + 1, { score: 6 }) : null; },
  };
  /* Рудничный призрак (8) */
  P["mine-ghost"] = { defendMods(t, ctx) { const S = B.S; if (S && S.dark && !S.torch && ctx && ctx.dis) ctx.dis.push("свет погибели"); } };
  P["body:mine-ghost"] = { attackMods(u, ctx) { const S = B.S; if (S && (S.torch || !S.dark) && ctx.dis) ctx.dis.push("боится света"); } };
  A["mine-ghost"] = {
    time: "action", tgt(u) { return specUnit(u, "Шёпот обвала: кого?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const sv = await save(t, "wis", dcOf(u, "cha"), "Шёпот обвала", ["fear"], u); if (!sv.ok && alive(t)) { addStatus(t, "frightened", { k: 2, when: "end", data: { by: u.id } }); fx(t, "испуган", "bad"); } return true; },
    ai(u) { const ts = foesIn(u, 4).filter(t => !has(t, "frightened")); return ts.length ? { unit: ts[0], score: 9 } : null; },
  };
  /* Вагонетка-мимик (8): «Двойное дно» — рюкзак (index.html bagSize); у монстра — руда при гибели */
  P["cart-mimic"] = {};
  P["body:cart-mimic"] = { onDeath(u) { const S = B.S; if (S) { (S.found ||= []).push({ t: "g", id: "stone-8", qty: 2 }); log("Из кузова вагонетки высыпается руда: 2 камня.", "good"); } } };
  A["cart-mimic"] = {
    time: "action", tgt(u) { return specUnit(u, "Наезд: на кого?", foesIn(u, 4).filter(t => dist(u, t) >= 2), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).some(t => dist(u, t) >= 2) ? true : "нет цели в 2–4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const cells = lineFrom(u, t, 4), vic = unitsOn(cells, u.side); log(`${u.name} с грохотом наезжает!`, "skill");
      for (const o of vic) { const sv = await save(o, "dex", dcOf(u, "str"), "Наезд", ["prone"], u); if (!sv.ok && alive(o)) { await B.applyDamage(u, o, [{ v: roll(1, 8).total, dt: "bludgeon", label: "Наезд" }], { src: u }); if (alive(o)) addStatus(o, "prone", { k: Infinity }); } }
      const c = freeNear(u, t); if (c) await B.teleport(u, c[0], c[1]); return true; },
    ai(u) { const ts = foesIn(u, 4).filter(t => dist(u, t) >= 2); return ts.length ? { unit: ts[0], score: 11 } : null; },
  };
  /* Глава стражи кобольдов (7, минибосс): танк */
  P["kobold-captain"] = { saveAura(a, { u, ctx }) { if (u !== a && u.side === a.side && dist(a, u) <= 2 && ctx && ctx.mods) ctx.mods.push({ l: "Командир штольни", v: 1 }); } };
  A["kobold-captain"] = {
    time: "action", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); for (const a of [u, ...alliesOf(u).filter(x => x !== u && alive(x) && dist(u, x) <= 1)]) { addStatus(a, "shieldlock", { k: Infinity, data: { prot: 2, endAtStartOf: u.id } }); fx(a, "щиты сомкнуты", "good"); } log(`${u.name}: «Сомкнуть щиты!»`, "skill"); return true; },
    ai(u) { const n = alliesOf(u).filter(x => x !== u && alive(x) && dist(u, x) <= 1).length; return within(u, 1).length && !has(u, "shieldlock") ? { score: 8 + n * 3 } : null; },
  };
  /* Главный прораб (7, минибосс): доход (вне боя) + призыв */
  P["goblin-foreman"] = {};
  P["body:goblin-foreman"] = { attackMods() {} };
  A["goblin-foreman"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return B.freeCellsNear(u, 2, { size: 1, side: u.side, id: "x" }).length ? true : "нет места рядом"; },
    async run(u, pk, ctl) { ctl.commit(); log(`${u.name}: «Свистать всех!»`, "skill"); const g = ui(); if (g) g.banner("Свистать всех!");
      if (u.side !== "hero") { const got = B.spawnFoes(["goblin-miner", "goblin-miner"], u);  return true; }
      const m = B.monUnit("goblin-miner", -1), c = B.freeCellsNear(u, 1, m)[0]; if (!c) return true; m.x = c[0]; m.y = c[1]; m.side = "hero"; m.summon = true; m.auto = true; m.kind = "miner"; m.noReward = true; m.name = "Шахтёр-помощник"; B.addUnit(m, B.S.order[B.S.turn]); m.side = "hero"; if (g) g.refresh(); return true; },
    ai(u) { return (u.calls || 0) < 1 ? (u.calls = 1, { score: 14 }) : null; },
  };
  /* Римуру, король слизи (7, страж) */
  P.rimuru = { dmgFlat(u, { dt, v }) { return (dt === "poison" || dt === "acid") && v > 0 ? -v : 0; }, turnStart(u) { if (u.hp < u.maxHp) { B.heal(u, 3, u); fx(u, "+3", "good"); } } };
  const rimBodies = u => B.S.units.filter(o => o !== u && !alive(o) && !o.fled && o.ref !== undefined && o.x != null && dist(u, o) <= 1 && !o.eaten);
  A.rimuru = {
    time: "action", tgt(u) { const bs = rimBodies(u); return { type: "none", prompt: bs.length ? `Поглотить: ${bs[0].name}` : "" }; }, can(u) { return rimBodies(u).length ? true : "рядом нет павших"; },
    async run(u, pk, ctl) { const b = rimBodies(u)[0]; if (!b) return false; ctl.commit(); b.eaten = true; const pid = b.ref && P[b.ref] ? b.ref : null; if (pid && !u.pass.includes(pid)) u.pass.push(pid);
      u.temp = Math.max(u.temp || 0, 5); log(`${u.name} поглощает ${b.name}${pid ? " и перенимает его силу" : ""}: +5 временных ОЗ.`, "skill"); fx(u, "поглощение", "good"); return true; },
    ai(u) { return rimBodies(u).length ? { score: 13 } : null; },
  };
  /* ===== Пылающие земли и Зона ловушек: новые 8 класса (07.11) — незавершённый клинок, пепельный сыч, заводной апельсин, маятниковый страж ===== */
  Object.assign(D.essCd, { "unfinished-blade": 3, "ash-owl": 4, "clockwork-orange": 4, "pendulum-guard": 3 });
  Object.assign(D.monTune, { "unfinished-blade": { role: "skirmish", focus: ["weak", "nearest"], noFlee: true }, "ash-owl": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.25 },
    "clockwork-orange": { role: "brute", focus: ["nearest"], noFlee: true }, "pendulum-guard": { role: "brute", focus: ["nearest"], noFlee: true } });
  const isBlade = (u, atk) => atk && atk.kind === "melee" && (u.side !== "hero" || (atk.w && /sword|dagger|rapier|scimitar|saber|blade|меч|кинжал|рапир|сабл|клин/i.test(`${atk.w.id} ${atk.w.name || ""}`)));
  P["unfinished-blade"] = {
    attackMods(u, ctx) { if (!isBlade(u, ctx.atk) || !ctx.tgt) return; if (u.ubTgt === ctx.tgt.id && u.ubStack) ctx.dmgPlus = (ctx.dmgPlus || 0) + Math.min(3, u.ubStack); },
    onHitDealt(u, { tgt, atk }) { if (!tgt || !isBlade(u, atk)) return; if (u.ubTgt === tgt.id) u.ubStack = Math.min(3, (u.ubStack || 0) + 1); else { u.ubTgt = tgt.id; u.ubStack = 1; } },
  };
  P["body:unfinished-blade"] = { attackMods(u, ctx) { if (B.S && B.S.round <= 3 && ctx.extra) ctx.extra.push({ n: 1, s: 4, b: 0, dt: "fire", label: "Раскалённый металл" }); }, vulnerable(u, { dt }) { return dt === "bludgeon" && B.S && B.S.round > 3; } };
  A["unfinished-blade"] = {
    time: "action", tgt(u) { const ts = enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) <= 4 && (!B.visibleTo || B.visibleTo(u, t))); return specUnit(u, "Раскалённый выпад: на кого?", ts, B.cellsWithin(u, 4), "attack"); },
    can(u) { return enemiesOf(u).some(t => alive(t) && !t.down && dist(u, t) <= 4) ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; ctl.commit(); if (dist(u, t) > 1) await B.pullAdjacent(u, t); if (dist(u, t) > 1) { log(`${u.name} не дотягивается до ${t.name}.`); return true; }
      const r = await B.doAttack(u, t, a, { extra: [{ n: 1, s: 6, b: 0, dt: "fire", label: "Раскалённый выпад" }] }); return true; },
    ai(u) { const ts = enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) >= 2 && dist(u, t) <= 4); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 12 } : null; },
  };
  P["ash-owl"] = { defendMods(t, ctx) { if (ctx && ctx.atk && ctx.atk.kind === "ranged" && t.t && (t.t.moved || 0) > 0 && ctx.dis) ctx.dis.push("пепельные крылья"); } };
  A["ash-owl"] = {
    time: "bonus", tgt(u) { return { type: "cell", prompt: "Пепельный вихрь: центр облака", cells: B.cellsWithin(u, 4), kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) { let c = pk.cell; if (!c) { const t = enemiesOf(u).filter(e => alive(e) && !e.down && dist(u, e) <= 4).sort((a, b) => (b.atk && b.atk.some ? 0 : 0) - 0)[0]; if (!t) return false; c = [t.x, t.y]; } ctl.commit();
      const cells = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (B.inB(c[0] + dx, c[1] + dy)) cells.push([c[0] + dx, c[1] + dy]);
      (B.S.dust ||= []).push({ cells, until: B.S.round + 2 }); log(`${u.name} поднимает вихрь пепла.`, "skill"); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { return enemiesOf(u).some(e => alive(e) && !e.down && dist(u, e) <= 4) && !(B.S.dust || []).some(d => d.until >= B.S.round) ? { score: 7 } : null; },
  };
  const orangeBoom = async (u, dice, label) => { if (u.boomed) return; u.boomed = true; const g = ui(); if (g) { g.banner(label); if (g.fxBoom) g.fxBoom(u.x, u.y, 1); } log(`${u.name} взрывается!`, "bad");
    for (const o of live().filter(o => o !== u && dist(u, o) <= 1)) if (alive(o)) await saveDmg(u, o, "dex", dcOf(u, "dex"), dice, "fire", label); };
  P["clockwork-orange"] = { initBonus() { return 2; }, speedBonus(u) { return B.S && B.S.round === 1 ? 2 : 0; } };
  P["body:clockwork-orange"] = {
    async turnStartAsync(u) { if (alive(u) && !u.down && enemiesOf(u).some(e => alive(e) && !e.down && dist(u, e) <= 1)) { await orangeBoom(u, [2, 6], "Заводной апельсин взрывается"); if (alive(u)) B.kill(u, null); } },
    onDeath(u) { if (u.boomed) return; B.queue(async () => { await orangeBoom(u, [1, 6], "Хлопок механизма"); }); },
  };
  A["clockwork-orange"] = {
    time: "action", tgt(u) { return specUnit(u, "Заводная бомба: в кого?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); log(`${u.name} выпускает заводную бомбу — она семенит к ${t.name}.`, "skill");
      for (const o of live().filter(o => o !== u && o.side !== u.side && footprint(o).some(([fx2, fy]) => Math.max(Math.abs(fx2 - t.x), Math.abs(fy - t.y)) <= 1))) if (alive(o)) await saveDmg(u, o, "dex", dcOf(u, "int"), [1, 6, 2], "fire", "Заводная бомба");
      return true; },
    ai(u) { return null; },
  };
  P["pendulum-guard"] = { async reactEnter(u, mover) { if (!mover || mover.side === u.side || !alive(mover) || mover.down || !alive(u) || u.down || u.pendRound === B.S.round) return; u.pendRound = B.S.round; const a = atkFor(u, "melee"); if (!a || dist(u, mover) > (a.reach || 1)) return; log(`${u.name} рубит маятником вошедшего ${mover.name}.`, "skill"); await B.doAttack(u, mover, a, {}); } };
  A["pendulum-guard"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { ctl.commit(); log(`${u.name} раскручивает лезвия.`, "skill"); for (const t of within(u, 1)) { const sv = await saveDmg(u, t, "dex", dcOf(u, "str"), [2, 6], "slash", "Режущий оборот"); if (!sv.ok && alive(t) && !(B.noBlood && B.noBlood(t))) addStatus(t, "bleeding", { k: 10, when: "end", src: u.id, data: { dice: "1к4" } }); } return true; },
    ai(u) { const n = within(u, 1).length; return n >= 1 ? { score: 7 + n * 4 } : null; },
  };
  /* ===== Разлом «Чаща прошлого» (08.11): монстры 9–7 класса ===== */
  Object.assign(D.essCd, { "moss-hedgehog": 4, "firefly-swarm": 4, "branded-critter": 3, "tree-lynx": 3, "chimera-hound": 3, homunculus: 4, "alch-intern": 3, "lab-direwolf": 4, "senior-alch": 3, "mutant-boar": 3, "fled-chimera": 4, "swarm-mother": 5 });
  Object.assign(D.monTune, {
    "moss-hedgehog": { role: "brute", focus: ["nearest"], noFlee: true }, "firefly-swarm": { role: "skirmish", focus: ["cluster", "nearest"], noFlee: true }, "branded-critter": { role: "skirmish", focus: ["weak", "nearest"], noFlee: true },
    "tree-lynx": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.25 }, "chimera-hound": { role: "brute", focus: ["nearest"], noFlee: true }, homunculus: { role: "ranged", keep: 3, focus: ["nearest"], fleeHp: 0.3 },
    "alch-intern": { role: "ranged", keep: 3, focus: ["cluster", "nearest"], fleeHp: 0.3 }, "lab-direwolf": { role: "brute", focus: ["weak", "nearest"], noFlee: true }, "senior-alch": { role: "ranged", keep: 3, focus: ["cluster", "nearest"], fleeHp: 0.2 },
    "mutant-boar": { role: "brute", focus: ["nearest"], noFlee: true }, "fled-chimera": { role: "brute", focus: ["weak", "nearest"], noFlee: true }, "swarm-mother": { role: "ranged", keep: 2, focus: ["nearest"], noFlee: true },
  });
  Object.assign(D.status, {
    curled: { name: "Клубок", good: true, ico: '<circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>', desc: "+3 Защиты, нельзя сбить с ног, скорость 0." },
    glare: { name: "Мерцание роя", good: false, ico: '<circle cx="12" cy="12" r="2"/><circle cx="6" cy="8" r="1.4"/><circle cx="18" cy="9" r="1.4"/><circle cx="8" cy="17" r="1.4"/><circle cx="17" cy="16" r="1.4"/>', desc: "−1 к атакам." },
    roar: { name: "Львиный рык", good: true, ico: '<path d="M4 9v6h4l6 4V5L8 9z"/><path d="M17 8a5 5 0 010 8"/>', desc: "+2 к урону." },
    mutagen: { name: "Мутаген", good: true, ico: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>', desc: "Мутаген в крови." },
  });
  const dualWield = u => u.side === "hero" && B.attacksOf(u).some(a => a.offhand);
  const pastHeavy = (u, a) => a && a.kind === "melee" && !a.offhand && (u.side !== "hero" || !a.w || (a.w.props || []).some(p => /Двуруч|Тяжёл/.test(p)));
  const temp = (u, rounds) => B.S.round + rounds;
  // зелья лечения: бонусы эссенций (гомункул, интерн, старший алхимик) — B.potionBonus вызывается из usePotion (battle-act.js)
  B.potionBonus = (u, t) => { let v = 0; const pas = id => (u.pass || []).includes(id), out = [];
    if (pas("homunculus") && t && t !== u) { const d = roll(1, 4).total; v += d; out.push(`ассистент +${d}`); }
    if (pas("senior-alch")) { const d = roll(1, 6).total; v += d; out.push(`мастер зелий +${d}`); }
    if (pas("alch-intern") && t === u) { const d4 = roll(1, 4).total; if (d4 === 1) { v -= 2; out.push("неопытная рука −2"); } else if (d4 === 4) { const d = roll(1, 6).total; v += d; out.push(`неопытная рука +${d}`); } }
    if (out.length) log(`${u.name}: ${out.join(", ")}.`, "skill"); return v; };
  B.potionReach = u => ((u.pass || []).includes("homunculus") ? 2 : 1);
  /* Мшистый ёж (9) */
  P["moss-hedgehog"] = { async onDamagedAsync(u, { src, o }) { if (!src || !alive(src) || !(o && o.melee)) return; const v = has(u, "dodging") || has(u, "curled") ? 3 : 1; await B.applyDamage(u, src, [{ v, dt: "pierce", label: "Иглы" }], { src: u }); },
    immune(u, { id }) { return id === "prone" && !!has(u, "curled"); } };
  A["moss-hedgehog"] = {
    time: "bonus", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "curled", { k: 1, when: "start", data: { prot: 3 } }); addStatus(u, "slowed", { k: 1, when: "start", data: { mult: 0 } }); fx(u, "клубок", "good"); log(`${u.name} сворачивается в колючий клубок.`, "skill"); return true; },
    ai(u) { return u.hp < u.maxHp * 0.6 && within(u, 1).length && !has(u, "curled") ? { score: 8 } : null; },
  };
  /* Светлячковый рой (9): боится огня и широких ударов */
  P["firefly-swarm"] = {};
  P["body:firefly-swarm"] = { vulnerable(u, { dt }) { return dt === "fire"; } };
  A["firefly-swarm"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return foesIn(u, 2).length ? true : "никого в 2 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); const g = ui(); if (g) g.banner("Слепящее мерцание"); log(`${u.name}: слепящее мерцание.`, "skill");
      for (const t of foesIn(u, 2)) { const sv = await save(t, "con", dcOf(u, "dex"), "Слепящее мерцание", ["blind"], u); if (!sv.ok && alive(t)) { addStatus(t, "dazzled", { k: 1, when: "end" }); fx(t, "ослеплён", "bad"); } } return true; },
    ai(u) { const n = foesIn(u, 2).length; return n ? { score: 6 + n * 3 } : null; },
  };
  /* Клеймёный зверёк (9) */
  P["branded-critter"] = { dmgFlat(u, { dt, v }) { return (dt === "poison" || dt === "acid") && v > 0 ? -Math.min(2, v) : 0; }, saveMods(u, ctx) { if (ctx.tags.some(t => /poison|acid/.test(t)) || /яд|кисл/i.test(ctx.label || "")) ctx.mods.push({ l: "Подопытный", v: 2 }); } };
  P["body:branded-critter"] = { onDeath(u) { B.queue(async () => { log(`${u.name} лопается кислотой!`, "bad"); for (const o of live().filter(o => o !== u && dist(u, o) <= 1)) if (alive(o)) await saveDmg(u, o, "dex", dcOf(u, "con"), [1, 6], "acid", "Кислотный хлопок"); }); } };
  A["branded-critter"] = {
    time: "action", tgt(u) { return specUnit(u, "Едкая слюна: в кого?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const sv = await save(t, "dex", dcOf(u, "con"), "Едкая слюна", ["acid"], u);
      if (!sv.ok && alive(t)) { await B.applyDamage(u, t, [{ v: roll(1, 8).total, dt: "acid", label: "Едкая слюна" }], { src: u }); if (alive(t)) { addStatus(t, "corroded", { k: 2, when: "end", data: { prot: -1 } }); fx(t, "броня разъедена", "bad"); } } else fx(t, "увернулся", ""); return true; },
    ai(u) { const ts = foesIn(u, 4).filter(t => dist(u, t) > 1); return ts.length ? { unit: ts[0], score: 9 } : null; },
  };
  /* Древесная рысь (8): «Из крон» — первая атака в 1-м раунде */
  P["tree-lynx"] = {
    attackMods(u, ctx) { if (B.S.round === 1 && !u.lynxDone && ctx.adv) ctx.adv.push("из крон"); },
    async attackDone(u, { tgt, res }) { if (B.S.round !== 1 || u.lynxDone) return; u.lynxDone = true; if (res && res.hit && tgt && alive(tgt) && !tgt.down) { const sv = await save(tgt, "str", dcOf(u, "dex"), "Из крон", ["prone"], u); if (!sv.ok && alive(tgt)) { B.knock(tgt, u); fx(tgt, "сбит с ног", "bad"); } } },
  };
  A["tree-lynx"] = {
    time: "bonus", tgt(u) { return { type: "cell", prompt: "Рысий прыжок: куда?", cells: B.cellsWithin(u, 3).filter(([x, y]) => B.canStand(u, x, y)), kind: "move" }; }, can() { return true; },
    async run(u, pk, ctl) { let c = pk.cell; if (!c) { const t = enemiesOf(u).filter(e => alive(e) && !e.down).sort((a, b) => a.hp - b.hp)[0]; const cs = B.cellsWithin(u, 3).filter(([x, y]) => B.canStand(u, x, y)); c = t ? cs.sort((p, q) => Math.max(Math.abs(p[0] - t.x), Math.abs(p[1] - t.y)) - Math.max(Math.abs(q[0] - t.x), Math.abs(q[1] - t.y)))[0] : cs[0]; } if (!c) return false; ctl.commit(); await B.teleport(u, c[0], c[1]); fx(u, "прыжок", "good"); log(`${u.name} прыгает.`, "skill"); return true; },
    ai(u) { return !within(u, 1).length && enemiesOf(u).some(e => alive(e) && !e.down && dist(u, e) <= 4) ? { score: 7 } : null; },
  };
  /* Пёс-химера (8) */
  P["chimera-hound"] = { attackMods(u, ctx) { if (ctx.melee && u.hp < u.maxHp / 2) ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; } };
  A["chimera-hound"] = {
    time: "action", tgt(u) { return specUnit(u, "Двойной укус: в кого?", within(u, 1), cellsAround(u, 1), "attack"); },
    can(u) { if (dualWield(u)) return "только с одним оружием"; return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; ctl.commit(); log(`${u.name}: двойной укус.`, "skill"); await B.doAttack(u, t, a, {});
      const t2 = alive(t) && !t.down ? t : within(u, 1).find(o => alive(o) && !o.down); if (t2) await B.doAttack(u, t2, { ...a, hit: (a.hit || 0) - 2 }, { noPass: true }); return true; },
    ai(u) { return within(u, 1).length ? { unit: within(u, 1)[0], score: 11 } : null; },
  };
  /* Гомункул-лаборант (8) */
  P.homunculus = {};
  A.homunculus = {
    time: "bonus", tgt(u) { const al = [u, ...alliesOf(u)].filter(a => alive(a) && !a.down && dist(u, a) <= 3); return { type: "unit", prompt: "Укрепляющий раствор: кому?", units: al.map(a => a.id), cells: [], kind: "heal", includeSelf: true }; }, can() { return true; },
    async run(u, pk, ctl) { const t = pk.unit || [u, ...alliesOf(u)].filter(a => alive(a) && !a.down && dist(u, a) <= 3).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (!t) return false; ctl.commit();
      const v = roll(1, 6).total + Math.max(0, amod(u.abil.int)); t.temp = Math.max(t.temp || 0, v); B.tmpPass(t, "past-solution", 2); fx(t, `+${v} врем. ОЗ`, "good"); log(`${u.name}: укрепляющий раствор — ${t.name} +${v} врем. ОЗ и +1 к атакам.`, "skill"); return true; },
    ai(u) { const al = alliesOf(u).filter(a => alive(a) && !a.down && dist(u, a) <= 3 && a.hp < a.maxHp * 0.8); return al.length ? { unit: al[0], score: 9 } : null; },
  };
  // временные «пассивки» на N раундов (баффы без собственных статусов)
  B.tmpPass = (t, id, rounds) => { if (!t.pass.includes(id)) t.pass.push(id); (t.tmpPass ||= {})[id] = B.S.round + rounds; };
  const tmpOn = (u, id) => !!(u.tmpPass && u.tmpPass[id] >= B.S.round);
  P["past-solution"] = { attackMods(u, ctx) { if (tmpOn(u, "past-solution")) ctx.mods.push({ l: "Раствор", v: 1 }); } };
  P["past-roar"] = { attackMods(u, ctx) { if (tmpOn(u, "past-roar")) ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; } };
  /* Склянки алхимиков: случайный эффект в 3×3 */
  const vialArea = c => { const out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push([c[0] + dx, c[1] + dy]); return out; };
  const inArea = (o, cells) => footprint(o).some(([x, y]) => cells.some(([cx, cy]) => cx === x && cy === y));
  const vial = async (u, c, big) => { const k = rnd3(), cells = vialArea(c), who = live().filter(o => alive(o) && inArea(o, cells)), g = ui();
    const name = ["огненная", "кислотная", "сонная"][k]; if (g) g.banner(`Склянка: ${name}`); log(`${u.name} бросает склянку — ${name}!`, "skill");
    for (const o of who) {
      if (k === 0) await saveDmg(u, o, "dex", dcOf(u, "int"), big ? [3, 6] : [2, 6], "fire", "Огненная склянка");
      else if (k === 1) { const sv = await saveDmg(u, o, "dex", dcOf(u, "int"), big ? [2, 6] : [2, 4], "acid", "Кислотная склянка"); if (!sv.ok && alive(o)) { addStatus(o, "corroded", { k: 2, when: "end", data: { prot: big ? -2 : -1 } }); fx(o, "броня разъедена", "bad"); } }
      else { const sv = await save(o, "con", dcOf(u, "int"), "Сонный газ", ["poison"], u); if (!sv.ok && alive(o)) { addStatus(o, "stunned", { k: 1, when: "end" }); fx(o, "уснул", "bad"); } }
    } return true; };
  const rnd3 = () => Math.floor(Math.random() * 3);
  const vialAI = (u, r) => { const ts = foesIn(u, r); if (!ts.length) return null; let best = null, bn = 0; for (const t of ts) { const n = enemiesOf(u).filter(o => alive(o) && Math.max(Math.abs(o.x - t.x), Math.abs(o.y - t.y)) <= 1).length - alliesOf(u).filter(o => alive(o) && Math.max(Math.abs(o.x - t.x), Math.abs(o.y - t.y)) <= 1).length * 2; if (n > bn) { bn = n; best = t; } } return best ? { cell: [best.x, best.y], score: 7 + bn * 3 } : null; };
  P["alch-intern"] = {};
  A["alch-intern"] = {
    time: "action", tgt(u) { return { type: "cell", prompt: "Склянка наугад: куда?", cells: B.cellsWithin(u, 3), kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) { const c = pk.cell; if (!c) return false; ctl.commit(); return vial(u, c, false); }, ai(u) { return vialAI(u, 3); },
  };
  /* Старший алхимик (7): в беде пьёт мутаген */
  P["senior-alch"] = {};
  P["body:senior-alch"] = { turnStart(u) { if (!u.mutDone && u.hp < u.maxHp / 2) { u.mutDone = true; addStatus(u, "mutagen", { k: Infinity }); fx(u, "мутаген!", "bad"); log(`${u.name} пьёт мутаген и звереет: +2 к урону.`, "skill"); } }, attackMods(u, ctx) { if (has(u, "mutagen")) ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; } };
  A["senior-alch"] = {
    time: "action", tgt(u) { return { type: "cell", prompt: "Склянка: куда?", cells: B.cellsWithin(u, 5), kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) { const c = pk.cell; if (!c) return false; ctl.commit(); return vial(u, c, true); }, ai(u) { return vialAI(u, 5); },
  };
  /* Лютоволк (7) */
  P["lab-direwolf"] = {
    attackMods(u, ctx) { if (ctx.melee && ctx.tgt && has(ctx.tgt, "bleeding") && ctx.extra) ctx.extra.push({ n: 1, s: 6, b: 0, dt: "pierce", label: "Рвущие клыки" }); },
    attackDone(u, { tgt, res }) { if (res && res.crit && tgt && alive(tgt) && !(B.noBlood && B.noBlood(tgt))) addStatus(tgt, "bleeding", { k: 10, when: "end", src: u.id, data: { dice: "1к4" } }); },
  };
  P["body:lab-direwolf"] = { onHitDealt(u, { tgt }) { if (tgt && alive(tgt) && !has(tgt, "bleeding") && !(B.noBlood && B.noBlood(tgt))) { addStatus(tgt, "bleeding", { k: 10, when: "end", src: u.id, data: { dice: "1к4" } }); fx(tgt, "кровотечение", "bad"); } } };
  A["lab-direwolf"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return foesIn(u, 3).length ? true : "никого в 3 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); const g = ui(); if (g) g.banner("Вой лаборатории"); log(`${u.name} воет.`, "skill");
      for (const t of foesIn(u, 3)) { const sv = await save(t, "wis", dcOf(u, "str"), "Вой лаборатории", ["frightened"], u); if (!sv.ok && alive(t)) { addStatus(t, "frightened", { k: 1, when: "end", data: { by: u.id } }); fx(t, "испуган", "bad"); } } return true; },
    ai(u) { const n = foesIn(u, 3).length; return n >= 2 && !u.howled ? (u.howled = true, { score: 10 + n * 2 }) : null; },
  };
  /* Вепрь-мутант (7) */
  P["mutant-boar"] = { attackMods(u, ctx) { if (pastHeavy(u, ctx.atk)) ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; }, immune(u, { id }) { return id === "prone"; } };
  A["mutant-boar"] = {
    time: "action", tgt(u) { const ts = enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) <= 4 && (!B.visibleTo || B.visibleTo(u, t))); return specUnit(u, "Таран бивнем: на кого?", ts, B.cellsWithin(u, 4), "attack"); },
    can(u) { return enemiesOf(u).some(t => alive(t) && !t.down && dist(u, t) <= 4) ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; ctl.commit(); if (dist(u, t) > 1) await B.pullAdjacent(u, t); if (dist(u, t) > 1) { log(`${u.name} не добегает до ${t.name}.`); return true; }
      log(`${u.name}: таран бивнем!`, "skill"); const r = await B.doAttack(u, t, a, { dmgPlus: 1 });
      if (r && r.hit && alive(t) && !t.down) { const n = await B.push(t, u.x, u.y, 1); if (n) fx(t, "отброшен", "bad"); else { await B.applyDamage(u, t, [{ v: roll(1, 6).total, dt: "bludgeon", label: "Удар о препятствие" }], { src: u }); const self = 1 + Math.floor(Math.random() * 2); await B.applyDamage(u, u, [{ v: self, dt: "bludgeon", label: "Отдача тарана" }], {}); fx(t, "врезался", "bad"); } }
      return true; },
    ai(u) { const ts = enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) >= 1 && dist(u, t) <= 4); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 12 } : null; },
  };
  /* Беглая химера (7): хвост кусает тех, кто закончил ход рядом */
  P["fled-chimera"] = {};
  const prevHAA = B.hookAllAsync;
  B.hookAllAsync = async function (u, name, ctx) { const out = await prevHAA(u, name, ctx);
    if (name === "turnEndAsync" && B.S && alive(u) && !u.down) for (const c of enemiesOf(u).filter(o => alive(o) && !o.down && (o.pass || []).includes("fled-chimera") && dist(o, u) <= 1 && o.tailRound !== B.S.round)) {
      c.tailRound = B.S.round; log(`Змеиный хвост ${c.name} кусает ${u.name}.`, "skill"); const sv = await saveDmg(c, u, "con", dcOf(c, "con"), [1, 6], "poison", "Змеиный хвост"); if (!sv.ok && alive(u)) { addStatus(u, "poisoned", { k: 1, when: "end" }); fx(u, "отравлен", "bad"); } }
    return out; };
  A["fled-chimera"] = {
    time: "bonus", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); const g = ui(); if (g) g.banner("Львиный рык"); log(`${u.name}: львиный рык!`, "skill");
      for (const o of [u, ...alliesOf(u)].filter(o => alive(o) && !o.down && dist(u, o) <= 2)) { B.tmpPass(o, "past-roar", 2); addStatus(o, "roar", { k: 2, when: "end" }); fx(o, "+2 урона", "good"); } return true; },
    ai(u) { return !u.roared && within(u, 2).length ? (u.roared = true, { score: 9 }) : null; },
  };
  /* Матка роя (7) */
  P["swarm-mother"] = { turnEnd(u) { for (const t of enemiesOf(u).filter(o => alive(o) && dist(u, o) <= 1)) addStatus(t, "glare", { k: 1, when: "end", data: { atkMod: -1 } }); } };
  P["past-timed"] = { turnStart(u) { if (u.dieAt && B.S.round >= u.dieAt && alive(u)) { log(`${u.name} рассеивается.`); B.kill(u, null); } } };
  A["swarm-mother"] = {
    time: "action", tgt() { return { type: "none" }; }, can(u) { return B.freeCellsNear(u, 2, { size: 1, side: u.side, id: "x" }).length ? true : "нет места рядом"; },
    async run(u, pk, ctl) { ctl.commit(); const g = ui(); if (g) g.banner("Призыв роя"); log(`${u.name} выпускает рой светлячков.`, "skill");
      if (u.side !== "hero") { const got = B.spawnFoes(["firefly-swarm", "firefly-swarm"], u); got.forEach(m => { m.dieAt = B.S.round + 3; m.pass.push("past-timed"); }); return true; }
      for (let i = 0; i < 2; i++) { const m = B.monUnit("firefly-swarm", -1), c = B.freeCellsNear(u, 1, m)[0]; if (!c) break; m.x = c[0]; m.y = c[1]; m.side = "hero"; m.summon = true; m.auto = true; m.noReward = true; m.name = "Рой-помощник"; m.dieAt = B.S.round + 3; m.pass.push("past-timed"); B.addUnit(m, B.S.order[B.S.turn]); m.side = "hero"; }
      if (g) g.refresh(); return true; },
    ai(u) { return (u.calls || 0) < 2 && B.S.round % 2 === 1 ? (u.calls = (u.calls || 0) + 1, { score: 11 }) : null; },
  };
  /* ===== Чаща прошлого: стражи 6 класса (хранитель, натуралист), Луна, корни, диалоги (08.11) ===== */
  Object.assign(D.essCd, { "fallen-keeper": 4, naturalist: 5, luna: 2 });
  Object.assign(D.monTune, { "fallen-keeper": { role: "brute", focus: ["cluster", "nearest"], noFlee: true }, naturalist: { role: "brute", focus: ["weak", "nearest"], noFlee: true }, luna: { role: "brute", focus: ["weak", "nearest"], noFlee: true } });
  D.terrain.roots = { name: "Корни", cost: 2, flammable: true, note: "Корни хранителя: труднопроходны 2 хода. Рубятся режущим оружием или сгорают от огня." };
  D.SVG.roots = '<path d="M10 90 Q30 60 18 20 M38 94 Q46 60 36 12 M64 94 Q56 58 70 14 M88 88 Q72 60 84 22 M14 54 Q50 40 88 58 M10 76 Q50 66 92 78" stroke="#7a4e24" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M20 34 Q50 26 80 36" stroke="#5a3616" stroke-width="5" fill="none"/>';
  const rootsAt = (x, y, rounds) => { const S = B.S; if (!S.cells[y] || x < 0 || x >= B.W) return; const c = S.cells[y][x]; if (c && c !== "bush" && c !== "roots" && !(D.terrain[c] || {}).thicket) return; S.cells[y][x] = "roots"; (S.tmpRoots ||= []).push({ x, y, until: S.round + rounds, prev: c === "roots" ? null : c }); };
  const clearRoots = (x, y) => { const S = B.S; if (S.cells[y] && S.cells[y][x] === "roots") { const rec = (S.tmpRoots || []).find(r => r.x === x && r.y === y); S.cells[y][x] = rec ? rec.prev || null : null; S.tmpRoots = (S.tmpRoots || []).filter(r => !(r.x === x && r.y === y)); } };
  const prevRoundRoots = B.onRound;
  B.onRound = function (round) { if (prevRoundRoots) prevRoundRoots(round); const S = B.S; if (!S || !S.tmpRoots) return; for (const r of S.tmpRoots.slice()) if (r.until < round) clearRoots(r.x, r.y); };
  const rootedBy = u => { const c = has(u, "restrained"); return c && c.data && c.data.roots ? c : null; };
  B.pastRoots = function (u, opts) { if (!u.hero || u.summon || !B.S) return opts;
    const near = []; for (let y = u.y - 1; y <= u.y + 1; y++) for (let x = u.x - 1; x <= u.x + 1; x++) if (B.S.cells[y] && B.S.cells[y][x] === "roots") near.push([x, y]);
    const stuck = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1)].filter(a => rootedBy(a));
    if (!near.length && !stuck.length) return opts;
    const blade = B.attacksOf(u).some(a => a.kind === "melee" && a.dt === "slash"), fire = has(u, "lit") || B.attacksOf(u).some(a => a.dt === "fire");
    const act = B.timeOK(u, "action") ? null : "действие потрачено", why = act || (blade || fire ? null : "нужно режущее оружие или огонь");
    opts.push({ id: "cut-roots", cat: "item", label: "Срубить корни", ico: "search", sub: "освобождает тебя и соседей, расчищает клетки рядом", time: "action", enabled: !why, why, run: async () => {
      B.spendTime(u, "action"); for (const [x, y] of near) clearRoots(x, y); for (const a of stuck) removeStatus(a, "restrained"); log(`${u.name} ${blade ? "рубит" : "жжёт"} корни.`, "skill"); fx(u, "корни срублены", "good"); const g = ui(); if (g) g.refresh(); return true; } });
    return opts; };
  // «Шприц мутагена» (эксклюзив сундука лаборатории): раз в день в бою, доп. действие
  B.pastSyr = function (u, opts) { const c = u.hero, r = typeof state !== "undefined" && state.run; if (!c || u.summon || !r || !(typeof countGear === "function" && countGear(c, "mutagen-syringe") > 0)) return opts;
    const day = `${r.floor}:${r.day}`, used = r.syrDay === day, bon = B.timeOK(u, "bonus") ? null : "доп. действие потрачено", why = used ? "уже использован сегодня" : bon;
    opts.push({ id: "syringe", cat: "item", label: "Шприц мутагена", ico: "potion", sub: "+2 Силы, регенерация 3 или тёмное зрение до конца боя", time: "bonus", enabled: !why, why, run: async () => {
      let ch = "str"; if (manual(u)) { const x = await B.UI.choose({ title: "Шприц мутагена: что вколоть?", options: [{ id: "str", label: "+2 к Силе" }, { id: "regen", label: "Регенерация 3 ОЗ в начале хода" }, { id: "dv", label: "Тёмное зрение" }] }); if (!x) return false; ch = x; }
      B.spendTime(u, "bonus"); r.syrDay = day;
      if (ch === "str") u.abil.str += 2; else if (ch === "regen") B.tmpPass(u, "past-syrregen", 99); else { u.dv = Math.max(u.dv || 0, 12); }
      log(`${u.name} вкалывает мутаген: ${({ str: "+2 к Силе", regen: "регенерация", dv: "тёмное зрение" })[ch]}.`, "skill"); fx(u, "мутаген", "good");
      if (Math.floor(Math.random() * 6) === 0) { const v = roll(1, 6).total; await B.applyDamage(u, u, [{ v, dt: "poison", label: "Побочный эффект мутагена" }], {}); }
      const g = ui(); if (g) g.refresh(); return true; } });
    return opts; };
  B.pastActions = (u, out) => B.pastSyr(u, B.pastRoots(u, out));          // подключается в конце battle-env.js (он переопределяет B.envActions позже)
  P["past-syrregen"] = { turnStart(u) { if (tmpOn(u, "past-syrregen") && alive(u) && !u.down && u.hp < u.maxHp) { B.heal(u, 3, u); fx(u, "+3", "good"); } } };
  /* Падший хранитель чащи (6, страж) */
  P["fallen-keeper"] = {};
  P["body:fallen-keeper"] = { dmgFlat(u, { dt }) { if (dt === "fire" && B.S) u.burnR = B.S.round; return 0; }, turnStart(u) { if (!alive(u) || u.hp >= u.maxHp) return; if (u.burnR != null && B.S.round - u.burnR <= 1) { fx(u, "огонь не даёт срастись", "bad"); return; } B.heal(u, 4, u); fx(u, "+4", "good"); } };
  A["fallen-keeper"] = {
    time: "action", tgt(u) { return { type: "cell", prompt: "Оплетающие корни: центр 3×3", cells: B.cellsWithin(u, 5), kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) { const c = pk.cell; if (!c) return false; ctl.commit(); const g = ui(); if (g) g.banner("Оплетающие корни"); log(`${u.name}: из земли рвутся корни!`, "skill");
      const cells = vialArea(c); for (const [x, y] of cells) rootsAt(x, y, 2);
      for (const o of live().filter(o => alive(o) && o.side !== u.side && inArea(o, cells))) { const sv = await saveDmg(u, o, "str", dcOf(u, "wis"), [2, 6], "bludgeon", "Оплетающие корни"); if (!sv.ok && alive(o)) { addStatus(o, "restrained", { k: 2, when: "end", data: { roots: true } }); fx(o, "опутан корнями", "bad"); } }
      if (g) g.refresh(); return true; },
    ai(u) { return vialAI(u, 5); },
  };
  /* Натуралист-химеролог (6, страж): три фазы; у героя — «Мутаген» на выбор */
  const natSay = (t) => B.say && B.say("naturalist", t);
  P.naturalist = {};
  P["body:naturalist"] = {
    turnStart(u) { const f = u.hp / u.maxHp, g = ui();
      if ((u.phase || 1) < 2 && f < 0.66) { u.phase = 2; B.heal(u, 8, u); if (g) g.banner("Натуралист вкалывает мутаген: полузверь"); log(`${u.name} вкалывает себе мутаген и обрастает шерстью.`, "bad"); fx(u, "полузверь", "bad"); }
      if ((u.phase || 1) < 3 && f < 0.33) { u.phase = 3; if (!u.pass.includes("fled-chimera")) u.pass.push("fled-chimera"); B.heal(u, 10, u); if (g) g.banner("Натуралист становится химерой"); log(`${u.name} превращается в химеру: змеиный хвост, львиная пасть.`, "bad"); fx(u, "химера", "bad"); } },
    attackMods(u, ctx) { if (ctx.melee || ctx.atk) ctx.dmgPlus = (ctx.dmgPlus || 0) + ((u.phase || 1) >= 3 ? 3 : (u.phase || 1) >= 2 ? 1 : 0); },
    speedBonus(u) { return (u.phase || 1) >= 2 ? 2 : 0; },
    onDeath(u) { natSay("мой мой малыш... он завершеннн"); },
  };
  P["past-claws"] = { attackMods(u, ctx) { if (tmpOn(u, "past-claws") && ctx.melee && ctx.extra) ctx.extra.push({ n: 1, s: 6, b: 0, dt: "slash", label: "Когти мутагена" }); } };
  P["past-regen"] = { turnStart(u) { if (tmpOn(u, "past-regen") && alive(u) && u.hp < u.maxHp) { B.heal(u, 5, u); fx(u, "+5", "good"); } } };
  P["past-mutend"] = { async turnStartAsync(u) { if (u.mutEnd && B.S.round >= u.mutEnd) { u.mutEnd = 0; const v = roll(1, 4).total; await B.applyDamage(u, u, [{ v, dt: "poison", label: "Отходняк мутагена" }], {}); log(`${u.name}: мутаген выветрился (−${v} ОЗ).`); } } };
  A.naturalist = {
    time: "bonus", tgt(u) { return u.side === "hero" ? { type: "none" } : { type: "cell", prompt: "Склянка: куда?", cells: B.cellsWithin(u, 5), kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) {
      if (u.side !== "hero") { const c = pk.cell; if (!c) return false; ctl.commit(); return vial(u, c, true); }
      let ch = "claws"; if (manual(u)) { const r = await B.UI.choose({ title: "Мутаген: что выбрать?", options: [{ id: "claws", label: "Когти: +1к6 к ближнему урону" }, { id: "hide", label: "Шкура: +2 Защиты" }, { id: "regen", label: "Регенерация: 5 ОЗ в начале хода" }] }); if (!r) return false; ch = r; } else ch = u.hp < u.maxHp * 0.5 ? "regen" : "claws";
      ctl.commit(); if (ch === "hide") addStatus(u, "mutagen", { k: 3, when: "end", data: { prot: 2 } }); else { addStatus(u, "mutagen", { k: 3, when: "end" }); B.tmpPass(u, ch === "claws" ? "past-claws" : "past-regen", 3); }
      u.mutEnd = B.S.round + 3; if (!u.pass.includes("past-mutend")) u.pass.push("past-mutend"); fx(u, "мутаген", "good"); log(`${u.name} вкалывает мутаген: ${({ claws: "когти", hide: "шкура", regen: "регенерация" })[ch]}.`, "skill"); return true; },
    ai(u) { return u.side === "hero" ? (u.hp < u.maxHp * 0.6 ? { score: 8 } : null) : vialAI(u, 5); },
  };
  /* Луна (6, финальный страж): оборотень ↔ огромный волк; регенерация, кроме раунда, когда ранили огнём */
  P.luna = { dmgFlat(u, { dt }) { if ((dt === "fire" || dt === "silver") && B.S) u.noRegenR = B.S.round; return 0; }, turnStart(u) { if (!alive(u) || u.down || u.hp >= u.maxHp || u.noRegenR === B.S.round) return; B.heal(u, 3, u); fx(u, "+3", "good"); } };
  P["body:luna"] = {
    turnStart(u) { const g = ui(); u.form ||= "were";
      if (!u.wolfOnce && u.hp <= u.maxHp / 2) { u.wolfOnce = true; u.form = "wolf"; u.formAt = B.S.round; if (g) g.banner("Луна становится огромным волком"); log(`${u.name} рвёт на себе остатки человеческого — перед вами огромный волк.`, "bad"); fx(u, "огромный волк", "bad"); }
      else if (u.wolfOnce && B.S.round - u.formAt >= 2) { u.form = u.form === "wolf" ? "were" : "wolf"; u.formAt = B.S.round; fx(u, u.form === "wolf" ? "волк" : "оборотень", "bad"); } },
    attackMods(u, ctx) { if (u.form === "wolf" && ctx.melee) ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; },
    speedBonus(u) { return u.form === "wolf" ? 2 : 0; },
    async attackDone(u, { tgt, res, atk }) { if (!tgt || !atk || atk.kind !== "melee") return;
      if (u.form === "wolf") { if (res && res.hit && alive(tgt) && !tgt.down) { const sv = await save(tgt, "str", dcOf(u, "str"), "Укус волка", ["prone"], u); if (!sv.ok && alive(tgt)) { B.knock(tgt, u); fx(tgt, "сбит с ног", "bad"); } } return; }
      if (res && res.hit && u.xtraR !== B.S.round && alive(tgt) && !tgt.down) { u.xtraR = B.S.round; await B.doAttack(u, tgt, { ...atk, hit: (atk.hit || 0) - 2 }, {}); } },          // вторые когти — только после попадания, −2
  };
  // форма героя (эссенция Луны): на 1 ход; до 10 очков Силы ↔ Ловкости, не ниже 9
  P["past-lunaform"] = {
    turnEnd(u) { const L = u.lunaT; if (!L) return; u.abil.str -= L.ds; u.abil.dex -= L.dd; u.lunaT = null; fx(u, "форма спала", ""); },
    speedBonus(u) { return u.lunaT && u.lunaT.form === "wolf" ? 1 : 0; },
    attackMods(u, ctx) { const L = u.lunaT; if (L && L.form === "were" && ctx.melee && dualWield(u)) ctx.mods.push({ l: "Оборотень (два оружия)", v: 2 }); },
    async attackDone(u, { tgt, res, atk }) { const L = u.lunaT; if (!L || !tgt || !atk || atk.kind !== "melee") return;
      if (L.form === "wolf" && res && res.hit && alive(tgt) && !tgt.down) { const sv = await save(tgt, "str", dcOf(u, "str"), "Укус волка", ["prone"], u); if (!sv.ok && alive(tgt)) { B.knock(tgt, u); fx(tgt, "сбит с ног", "bad"); } }
      if (L.form === "were" && !dualWield(u) && !L.extra && !atk.offhand && lightWeapon(atk) && alive(tgt) && !tgt.down) { L.extra = true; log(`${u.name}: вторая атака когтями оборотня.`, "skill"); await B.doAttack(u, tgt, atk, {}); } },
  };
  A.luna = {
    time: "bonus", tgt() { return { type: "none" }; }, can(u) { return u.side === "hero" ? (u.lunaT ? "форма уже принята" : true) : false; },
    async run(u, pk, ctl) { let form = u.abil.str >= u.abil.dex ? "wolf" : "were";
      if (manual(u)) { const r = await B.UI.choose({ title: "Трансформация: какая форма?", options: [{ id: "wolf", label: `Огромный волк: Ловкость → Сила (${Math.max(0, Math.min(10, u.abil.dex - 9))})` }, { id: "were", label: `Оборотень: Сила → Ловкость (${Math.max(0, Math.min(10, u.abil.str - 9))})` }] }); if (!r) return false; form = r; }
      ctl.commit(); const amt = Math.max(0, Math.min(10, (form === "wolf" ? u.abil.dex : u.abil.str) - 9)), ds = form === "wolf" ? amt : -amt, dd = -ds;
      u.abil.str += ds; u.abil.dex += dd; u.lunaT = { form, ds, dd }; if (!u.pass.includes("past-lunaform")) u.pass.push("past-lunaform");
      fx(u, form === "wolf" ? "огромный волк" : "оборотень", "good"); log(`${u.name}: трансформация — ${form === "wolf" ? `огромный волк (Сила +${amt})` : `оборотень (Ловкость +${amt})`} до конца хода.`, "skill"); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { return u.side === "hero" && within(u, 1).length ? { score: 9 } : null; },
  };
  /* Диалог как в новеллах (автор 08.11): портрет слева, текст справа; видят все (и мастер, и игроки по сети), каждый закрывает касанием */
  const DLG_START = { "nat-start": "ВЫ ПРИШЛИ ПОМЕШАТЬ МОЕМУ ШЕДЕВРУ!?", "king-start": "ГРАКХ ПОСТРОИЛ ЭТОТ ГОРОД НА ВАШИХ КОСТЯХ!" };
  B.say = (who, text) => { const S = B.S; if (!S) return; S.dlgKey ||= Math.random().toString(36).slice(2, 8); (S.dialogs ||= []).push({ n: S.dialogs.length + 1, who, text }); B.showDialogs(); };
  const dlgSeen = new Set(), dlgQ = [];
  const dlgOpen = () => { if (!dlgQ.length) return; if (typeof vnShow === "function") { const items = dlgQ.splice(0).map(d => { const m = (typeof MONSTERS !== "undefined" && MONSTERS.find(x => x.id === d.who)) || { name: d.who }; return { name: m.name, face: typeof ART !== "undefined" ? ART.monsterFace(d.who) : "", text: d.text }; }); vnShow(items); } };
  B.showDialogs = () => { const S = B.S; if (!S || !S.dialogs) return; for (const d of S.dialogs) { const k = `${S.dlgKey}:${d.n}`; if (dlgSeen.has(k)) continue; dlgSeen.add(k); dlgQ.push(d); } dlgOpen(); };
  if (typeof setInterval === "function" && typeof document !== "undefined") setInterval(() => { const S = B.S; if (!S || !B.running) return;
    if (S.phase === "fight" && S.ev && S.ev.dialog && !S.dlgStarted && !(B.Net && B.Net.mirroring)) { S.dlgStarted = true; B.say(S.ev.dialog.who, DLG_START[S.ev.dialog.start] || ""); }
    if (S.dialogs) B.showDialogs(); }, 400);
  /* ===== Гоблинград (08.11): монстры 9–6 класса ===== */
  Object.assign(D.essCd, { "goblin-merchant": 3, "goblin-lamplighter": 4, "city-hyena": 3, "goblin-pickpocket": 3, "goblin-arsonist": 3, "mad-goblin": 4, "city-guard": 3, "roof-archer": 4, "clockwork-hound": 3, "goblin-herald": 4, "temple-shaman": 3, "slum-thug": 3, "hob-sergeant": 4, "trollgob-porter": 3, "mad-berserker": 3, "city-captain": 4, "chief-engineer": 4, "mad-pyromancer": 4, "gob-founder": 4 });
  Object.assign(D.monTune, {
    "goblin-merchant": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.5 }, "goblin-lamplighter": { role: "brute", focus: ["nearest"], fleeHp: 0.3 }, "city-hyena": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.25 },
    "goblin-pickpocket": { role: "skirmish", focus: ["weak", "nearest"], fleeHp: 0.4 }, "goblin-arsonist": { role: "ranged", keep: 3, focus: ["cluster", "nearest"], fleeHp: 0.3 }, "mad-goblin": { role: "brute", focus: ["nearest"], noFlee: true },
    "city-guard": { role: "brute", focus: ["nearest"], noFlee: true }, "roof-archer": { role: "ranged", keep: 3, focus: ["weak", "nearest"], fleeHp: 0.25 }, "clockwork-hound": { role: "brute", focus: ["nearest"], noFlee: true },
    "goblin-herald": { role: "ranged", keep: 2, focus: ["nearest"], fleeHp: 0.3 }, "temple-shaman": { role: "ranged", keep: 3, focus: ["nearest"], fleeHp: 0.3 }, "slum-thug": { role: "brute", focus: ["weak", "nearest"], fleeHp: 0.25 },
    "hob-sergeant": { role: "brute", focus: ["nearest"], noFlee: true }, "trollgob-porter": { role: "brute", focus: ["cluster", "nearest"], noFlee: true }, "mad-berserker": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
    "city-captain": { role: "brute", focus: ["nearest"], noFlee: true }, "chief-engineer": { role: "brute", focus: ["cluster", "nearest"], noFlee: true }, "mad-pyromancer": { role: "ranged", keep: 3, focus: ["cluster", "nearest"], noFlee: true }, "gob-founder": { role: "brute", focus: ["weak", "nearest"], noFlee: true },
  });
  Object.assign(D.status, { gcstand: { name: "Последний рубеж", good: true, ico: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>', desc: "+3 Защиты." } });
  // кто последним ударил цель в этом раунде («Кровь основателя», «Корона основателя»)
  const prevDoAtk = B.doAttack;
  B.doAttack = async function (att, tgt, atk, o) { const r = await prevDoAtk(att, tgt, atk, o); if (r && r.hit && tgt && B.S) { tgt.lastHitR = B.S.round; tgt.lastHitBy = att.id; } return r; };
  const hitByAlly = (u, t) => t && B.S && t.lastHitR === B.S.round && t.lastHitBy && t.lastHitBy !== u.id && alliesOf(u).some(a => a.id === t.lastHitBy);
  B.initAura = u => ([u, ...alliesOf(u)].some(a => alive(a) && (a.pass || []).includes("hob-sergeant")) ? 2 : 0);          // «Муштра» (battle-rules.js, инициатива)
  B.protAura = t => ([t, ...alliesOf(t)].some(a => alive(a) && !a.down && (a.pass || []).includes("city-captain") && dist(a, t) <= 1 && a.hero && a.hero.equip && a.hero.equip.off && /shield/.test(a.hero.equip.off.id || "")) ? 1 : 0);          // «Щит и строй»
  const lineCells = (u, c, n) => { const dx = Math.sign(c[0] - u.x), dy = Math.sign(c[1] - u.y), out = []; for (let i = 1; i <= n; i++) { const x = u.x + dx * i, y = u.y + dy * i; if (B.inB(x, y)) out.push([x, y]); } return out; };
  const inCells = (o, cells) => footprint(o).some(([x, y]) => cells.some(([cx, cy]) => cx === x && cy === y));
  /* Гоблин-торговец (9) */
  P["goblin-merchant"] = {};
  A["goblin-merchant"] = { time: "bonus", tgt(u) { return specUnit(u, "Монетой в глаз: в кого?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const sv = await save(t, "dex", dcOf(u, "dex"), "Монетой в глаз", [], u); if (!sv.ok && alive(t)) { addStatus(t, "dazzled", { k: 1, when: "end" }); fx(t, "монета в глаз", "bad"); } else fx(t, "увернулся", ""); return true; },
    ai(u) { const ts = foesIn(u, 4); return ts.length ? { unit: ts[0], score: 7 } : null; } };
  /* Фонарщик (9) */
  P["goblin-lamplighter"] = {};
  A["goblin-lamplighter"] = { time: "action", tgt(u) { return { type: "cell", prompt: "Масло на мостовую: в какую сторону?", cells: cellsAround(u, 1).filter(([x, y]) => B.inB(x, y)), kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) { const c = pk.cell; if (!c) return false; ctl.commit(); const cells = lineCells(u, c, 3); for (const [x, y] of cells) fireAt(x, y, 2); log(`${u.name} разливает горящее масло.`, "skill");
      for (const o of live().filter(o => alive(o) && o.side !== u.side && inCells(o, cells))) await B.applyDamage(u, o, [{ v: roll(1, 6).total, dt: "fire", label: "Горящее масло" }], { src: u }); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { const t = foesIn(u, 3)[0]; return t ? { cell: [u.x + Math.sign(t.x - u.x), u.y + Math.sign(t.y - u.y)], score: 8 } : null; } };
  /* Сторожевая гиена (9) */
  P["city-hyena"] = { attackMods(u, ctx) { if (ctx.tgt && (has(ctx.tgt, "prone") || has(ctx.tgt, "restrained")) && ctx.extra) ctx.extra.push({ n: 1, s: 6, b: 0, dt: "pierce", label: "Добить упавшего" }); } };
  P["body:city-hyena"] = { async attackDone(u, { tgt, res }) { if (res && res.hit && tgt && alive(tgt) && !tgt.down && !has(tgt, "prone") && Math.random() < .4) { B.knock(tgt, u); fx(tgt, "сбит с ног", "bad"); } } };
  A["city-hyena"] = { time: "action", tgt(u) { return specUnit(u, "Хватка: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; ctl.commit(); const r = await B.doAttack(u, t, a, {}); if (r && r.hit && alive(t) && !t.down) { const sv = await save(t, "str", dcOf(u, "dex"), "Хватка", ["grapple"], u); if (!sv.ok && alive(t)) { addStatus(t, "grappled", { k: 1, when: "end", data: { by: u.id } }); fx(t, "схвачен", "bad"); } } return true; },
    ai(u) { return within(u, 1).length ? { unit: within(u, 1)[0], score: 8 } : null; } };
  /* Карманник (9): крадёт зелье, отдаёт при гибели */
  P["goblin-pickpocket"] = {};
  P["gc-nobonus"] = { turnStart(u) { if (tmpOn(u, "gc-nobonus") && u.t) { u.t.bonus = 0; fx(u, "без доп. действия", "bad"); } } };
  P["body:goblin-pickpocket"] = { onHitDealt(u, { tgt }) { const c = tgt && tgt.hero; if (!c || u.stole || typeof countGear !== "function") return; for (const id of ["potion-good", "potion", "torch"]) if (countGear(c, id) > 0 && takeGear(c, id, 1)) { u.stole = id; log(`${u.name} вытаскивает у ${tgt.name}: ${id === "torch" ? "факел" : "зелье"}!`, "bad"); fx(tgt, "обокрали", "bad"); break; } },
    onDeath(u) { if (u.stole && typeof giveParty === "function") { const id = u.stole; u.stole = null; B.queue(async () => { log(`Украденное возвращено: ${giveParty({ t: "g", id, qty: 1 })}.`); }); } } };
  A["goblin-pickpocket"] = { time: "action", tgt(u) { return specUnit(u, "Обчистить: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const sv = await save(t, "dex", dcOf(u, "dex"), "Обчистить", [], u); if (!sv.ok && alive(t)) { B.tmpPass(t, "gc-nobonus", 1); fx(t, "обчистили", "bad"); } else fx(t, "заметил", ""); return true; },
    ai(u) { return within(u, 1).length ? { unit: within(u, 1)[0], score: 6 } : null; } };
  /* Гоблин-поджигатель (9) */
  P["goblin-arsonist"] = { resist(u, { dt }) { return dt === "fire"; } };
  A["goblin-arsonist"] = { time: "action", tgt(u) { return { type: "cell", prompt: "Бутылка с маслом: куда?", cells: B.cellsWithin(u, 4), kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) { const c = pk.cell; if (!c) return false; ctl.commit(); fireAt(c[0], c[1], 2); log(`${u.name} швыряет горящую бутылку.`, "skill"); for (const o of live().filter(o => alive(o) && inCells(o, [c]))) await saveDmg(u, o, "dex", dcOf(u, "dex"), [1, 8], "fire", "Бутылка с маслом"); const g = ui(); if (g) g.refresh(); return true; },
    ai(u) { const t = foesIn(u, 4)[0]; return t ? { cell: [t.x, t.y], score: 9 } : null; } };
  /* Безумный гоблин (9) */
  P["mad-goblin"] = { immune(u, { id }) { return id === "frightened"; } };
  A["mad-goblin"] = { time: "action", tgt() { return { type: "none" }; }, can(u) { return foesIn(u, 2).length ? true : "никого в 2 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); log(`${u.name} безумно хохочет.`, "skill"); for (const t of foesIn(u, 2)) { const sv = await save(t, "wis", dcOf(u, "cha"), "Безумный хохот", ["frightened"], u); if (!sv.ok && alive(t)) { addStatus(t, "frightened", { k: 1, when: "end", data: { by: u.id } }); fx(t, "испуган", "bad"); } } return true; },
    ai(u) { const n = foesIn(u, 2).length; return n >= 2 && !u.laughed ? (u.laughed = true, { score: 9 }) : null; } };
  /* Городской стражник (8) */
  P["city-guard"] = { attackMods(u, ctx) { if (u.t && !(u.t.moved > 0)) ctx.mods.push({ l: "На посту", v: 2 }); } };
  A["city-guard"] = { time: "action", tgt(u) { const a = atkFor(u, "melee"), r = (a && a.reach) || 1; const ts = enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) <= Math.max(r, u.side === "hero" ? r : 2)); return specUnit(u, "Подсечка: кого?", ts, B.cellsWithin(u, 2), "attack"); },
    can(u) { return enemiesOf(u).some(t => alive(t) && !t.down && dist(u, t) <= 2) ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; ctl.commit(); const r = await B.doAttack(u, t, { ...a, reach: Math.max(a.reach || 1, u.side === "hero" ? (a.reach || 1) : 2) }, {}); if (r && r.hit && alive(t) && !t.down) { const sv = await save(t, "str", dcOf(u, "str"), "Подсечка алебардой", ["prone"], u); if (!sv.ok && alive(t)) { B.knock(t, u); fx(t, "сбит с ног", "bad"); } } return true; },
    ai(u) { const ts = enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) <= 2 && !has(t, "prone")); return ts.length ? { unit: ts[0], score: 10 } : null; } };
  /* Крышный лучник (8) */
  P["roof-archer"] = { attackMods(u, ctx) { if (ctx.atk && ctx.atk.kind === "ranged" && ctx.tgt && dist(u, ctx.tgt) > 1) ctx.mods.push({ l: "С высоты", v: 1 }); } };
  P["body:roof-archer"] = { attackMods(u, ctx) { if (B.S.round === 1 && ctx.atk && ctx.atk.kind === "ranged" && ctx.adv) ctx.adv.push("с крыши"); } };
  A["roof-archer"] = { time: "action", tgt(u) { return { type: "cell", prompt: "Град стрел: центр 3×3", cells: B.cellsWithin(u, 8), kind: "attack" }; }, can(u) { return u.side !== "hero" || B.attacksOf(u).some(a => a.kind === "ranged" && a.w && a.w.group === "ranged") ? true : "нужен лук"; },
    async run(u, pk, ctl) { const c = pk.cell; if (!c) return false; ctl.commit(); const cells = vialArea(c); log(`${u.name}: град стрел!`, "skill"); for (const o of live().filter(o => alive(o) && o.side !== u.side && inArea(o, cells))) await saveDmg(u, o, "dex", dcOf(u, "dex"), [1, 8], "pierce", "Град стрел"); return true; },
    ai(u) { return vialAI(u, 8); } };
  /* Механический пёс (8) */
  P["clockwork-hound"] = { dmgFlat(u, { v }) { return v > 0 ? -1 : 0; } };
  P["body:clockwork-hound"] = { onDeath(u) { B.queue(async () => { log(`${u.name} разлетается шестернями!`, "bad"); for (const o of live().filter(o => o !== u && dist(u, o) <= 1)) if (alive(o)) await saveDmg(u, o, "dex", dcOf(u, "con"), [1, 6], "pierce", "Шестерни"); }); } };
  A["clockwork-hound"] = { time: "bonus", tgt(u) { return { type: "cell", prompt: "Рывок на пружинах: куда?", cells: B.cellsWithin(u, 4).filter(([x, y]) => (x === u.x || y === u.y || Math.abs(x - u.x) === Math.abs(y - u.y)) && B.canStand(u, x, y)), kind: "move" }; }, can() { return true; },
    async run(u, pk, ctl) { let c = pk.cell; if (!c) { const t = enemiesOf(u).filter(e => alive(e) && !e.down).sort((a, b) => dist(u, a) - dist(u, b))[0]; if (!t) return false; c = B.freeCellsNear(t, 1, u)[0]; } if (!c) return false; ctl.commit(); await B.teleport(u, c[0], c[1]); fx(u, "рывок", "good"); return true; },
    ai(u) { return !within(u, 1).length && enemiesOf(u).some(e => alive(e) && !e.down && dist(u, e) <= 5) ? { score: 7 } : null; } };
  /* Гоблин-глашатай (8) */
  P["goblin-herald"] = { saveAura(a, { u, ctx }) { if (a !== u && dist(a, u) <= 3 && ctx && ctx.tags && ctx.tags.some(t => t === "frightened" || t === "charm")) ctx.mods.push({ l: "Голос площади", v: 1 }); } };
  P["gc-horn"] = { attackMods(u, ctx) { if (tmpOn(u, "gc-horn")) ctx.mods.push({ l: "Сигнал рога", v: 1 }); } };
  A["goblin-herald"] = { time: "bonus", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); const g = ui(); if (g) g.banner("Сигнал рога"); log(`${u.name} трубит в рог!`, "skill"); for (const o of [u, ...alliesOf(u)].filter(o => alive(o) && dist(u, o) <= 3)) B.tmpPass(o, "gc-horn", 2); if (B.S.ev) B.S.ev.gcHorn = true; return true; },
    ai(u) { return !u.horned ? (u.horned = true, { score: 10 }) : null; } };
  /* Шаман-жрец храма (8) */
  P["temple-shaman"] = {};
  P["gc-curse"] = { saveMods(u, ctx) { if (tmpOn(u, "gc-curse")) ctx.mods.push({ l: "Проклятие слабости", v: -2 }); } };
  P["body:temple-shaman"] = { turnStart(u) { if (B.S.round % 2) return; const al = alliesOf(u).filter(a => alive(a) && !a.down && dist(u, a) <= 4 && a.hp < a.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (al) { const v = roll(1, 8).total + 2; B.heal(al, v, u); fx(al, `+${v}`, "good"); log(`${u.name} лечит ${al.name} (+${v}).`, "skill"); } } };
  A["temple-shaman"] = { time: "action", tgt(u) { return specUnit(u, "Проклятие слабости: на кого?", foesIn(u, 5), B.cellsWithin(u, 5), "attack"); }, can(u) { return foesIn(u, 5).length ? true : "нет цели в 5 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const sv = await save(t, "wis", dcOf(u, "wis"), "Проклятие слабости", ["curse"], u); if (!sv.ok && alive(t)) { B.tmpPass(t, "gc-curse", 2); fx(t, "проклят", "bad"); } else fx(t, "устоял", ""); return true; },
    ai(u) { const ts = foesIn(u, 5).filter(t => !tmpOn(t, "gc-curse")); return ts.length ? { unit: ts[0], score: 8 } : null; } };
  /* Головорез (8) */
  P["slum-thug"] = { attackMods(u, ctx) { if (ctx.melee && ctx.extra && ctx.tgt && (B.S.round === 1 || (B.visibleTo && !B.visibleTo(ctx.tgt, u)))) ctx.extra.push({ n: 1, s: 8, b: 0, dt: "bludgeon", label: "Исподтишка" }); } };
  A["slum-thug"] = { time: "action", tgt(u) { return specUnit(u, "Оглушить: кого?", within(u, 1), cellsAround(u, 1), "attack"); }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; ctl.commit(); const r = await B.doAttack(u, t, a, {}); if (r && r.hit && alive(t) && !t.down) { const sv = await save(t, "con", dcOf(u, "str"), "Оглушить", ["stun"], u); if (!sv.ok && alive(t)) { addStatus(t, "stunned", { k: 1, when: "end" }); fx(t, "оглушён", "bad"); } } return true; },
    ai(u) { return within(u, 1).length ? { unit: within(u, 1)[0], score: 10 } : null; } };
  /* Хобгоблин-сержант (7) */
  P["hob-sergeant"] = { attackMods(u, ctx) { if (B.S.round === 1) ctx.mods.push({ l: "Муштра", v: 1 }); }, attackAura(a, { att, ctx }) { if (B.S.round === 1 && att !== a && ctx) ctx.mods.push({ l: "Муштра", v: 1 }); } };
  A["hob-sergeant"] = { time: "bonus", tgt(u) { const al = alliesOf(u).filter(a => alive(a) && !a.down && dist(u, a) <= 3 && enemiesOf(a).some(e => alive(e) && !e.down && dist(a, e) <= 1)); return { type: "unit", prompt: "В атаку! Кто бьёт?", units: al.map(a => a.id), cells: [], kind: "buff" }; },
    can(u) { return alliesOf(u).some(a => alive(a) && !a.down && dist(u, a) <= 3 && enemiesOf(a).some(e => alive(e) && !e.down && dist(a, e) <= 1)) ? true : "нет союзника рядом с врагом"; },
    async run(u, pk, ctl) { const a = pk.unit || alliesOf(u).find(x => alive(x) && !x.down && dist(u, x) <= 3 && enemiesOf(x).some(e => alive(e) && !e.down && dist(x, e) <= 1)); if (!a) return false; const atk = atkFor(a, "melee"), t = enemiesOf(a).find(e => alive(e) && !e.down && dist(a, e) <= 1); if (!atk || !t) return false; ctl.commit(); log(`${u.name}: «В атаку!» — ${a.name} бьёт.`, "skill"); await B.doAttack(a, t, atk, {}); return true; },
    ai(u) { return this.can(u) === true ? { score: 9 } : null; } };
  /* Тролегоблин-носильщик (7) */
  P["trollgob-porter"] = { dmgFlat(u, { dt, v }) { if (!(v > 0)) return 0; return dt === "fire" ? roll(1, 6).total : -2; } };
  P["body:trollgob-porter"] = { dmgFlat(u, { dt }) { if (dt === "fire" && B.S) u.burnR = B.S.round; return 0; }, turnStart(u) { if (!alive(u) || u.hp >= u.maxHp || (u.burnR != null && B.S.round - u.burnR <= 1)) return; B.heal(u, 3, u); fx(u, "+3", "good"); } };
  A["trollgob-porter"] = { time: "action", tgt() { return { type: "none" }; }, can(u) { return within(u, 1).length ? true : "никого рядом"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"); if (!a) return false; ctl.commit(); log(`${u.name}: размах засовом!`, "skill"); for (const t of within(u, 1).slice()) if (alive(t) && !t.down) await B.doAttack(u, t, a, {}); return true; },
    ai(u) { return within(u, 1).length >= 2 ? { score: 12 } : null; } };
  /* Безумный берсерк (7) */
  P["mad-berserker"] = { attackMods(u, ctx) { if (ctx.melee) { const q = Math.min(3, Math.floor((u.maxHp - u.hp) / (u.maxHp / 4))); if (q > 0) ctx.dmgPlus = (ctx.dmgPlus || 0) + q; } } };
  A["mad-berserker"] = { time: "action", tgt(u) { const ts = enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) <= 4); return specUnit(u, "Кровавый рывок: на кого?", ts, B.cellsWithin(u, 4), "attack"); }, can(u) { return enemiesOf(u).some(t => alive(t) && !t.down && dist(u, t) <= 4) ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const a = atkFor(u, "melee"), t = pk.unit; if (!a || !t) return false; ctl.commit(); if (dist(u, t) > 1) await B.pullAdjacent(u, t); if (dist(u, t) > 1) return true; await B.doAttack(u, t, a, { extra: [{ n: 1, s: 8, b: 0, dt: "slash", label: "Кровавый рывок" }] }); await B.applyDamage(u, u, [{ v: roll(1, 4).total, dt: "slash", label: "Кровавый рывок" }], {}); return true; },
    ai(u) { const ts = enemiesOf(u).filter(t => alive(t) && !t.down && dist(u, t) >= 2 && dist(u, t) <= 4); return ts.length ? { unit: ts.sort((a, b) => a.hp - b.hp)[0], score: 11 } : null; } };
  /* Капитан городской стражи (6, страж) */
  P["city-captain"] = {};
  P["body:city-captain"] = { turnStart(u) { if (B.S.round === 2 && !u.called) { u.called = true; const got = B.spawnFoes(["city-guard"], u);  log(`${u.name} зовёт стражника!`, "bad"); }
    if (!u.stand && u.hp < u.maxHp / 2) { u.stand = true; addStatus(u, "gcstand", { k: Infinity, data: { prot: 2 } }); fx(u, "последний рубеж", "bad"); log(`${u.name} уходит в глухую оборону: +2 Защиты.`, "bad"); } } };
  A["city-captain"] = { time: "action", tgt() { return { type: "none" }; }, can(u) { return u.side === "hero" ? true : false; },
    async run(u, pk, ctl) { ctl.commit(); addStatus(u, "gcstand", { k: 1, when: "start", data: { prot: 3 } }); addStatus(u, "threatup", { k: 1, when: "start" }); fx(u, "последний рубеж", "good"); log(`${u.name}: последний рубеж!`, "skill"); return true; },
    ai(u) { return u.side === "hero" && within(u, 1).length >= 2 ? { score: 8 } : null; } };
  /* Главный инженер (6, страж): шагоход = временные ОЗ */
  P["chief-engineer"] = {};
  P["body:chief-engineer"] = { turnStart(u) { if (!u.walker) { u.walker = true; u.temp = Math.max(u.temp || 0, 20); fx(u, "шагоход 20", "bad"); log(`${u.name} сидит в шагоходе: 20 временных ОЗ.`, "bad"); }
    if (B.S.round === 3 && !u.called) { u.called = true; const got = B.spawnFoes(["clockwork-hound"], u);  log(`${u.name} выпускает механического пса!`, "bad"); } } };
  A["chief-engineer"] = { time: "action", tgt(u) { return { type: "cell", prompt: "Залп шагохода: центр 3×3", cells: B.cellsWithin(u, 6), kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) { const c = pk.cell; if (!c) return false; ctl.commit(); const cells = vialArea(c), g = ui(); if (g) g.banner("Залп шагохода"); for (const o of live().filter(o => alive(o) && o.side !== u.side && inArea(o, cells))) await saveDmg(u, o, "dex", dcOf(u, "int"), [2, 6], "fire", "Залп шагохода"); return true; },
    ai(u) { return vialAI(u, 6); } };
  /* Безумный пиромант (6, страж, необязательный) */
  P["mad-pyromancer"] = { attackMods(u, ctx) { if (ctx.atk && ctx.atk.dt === "fire" && ctx.extra) ctx.extra.push({ n: 1, s: 6, b: 0, dt: "fire", label: "Чистое пламя" }); }, dmgFlat(u, { dt, v }) { return dt === "fire" && v > 0 ? -v : 0; }, immune(u, { id }) { return id === "burning"; } };
  P["body:mad-pyromancer"] = {
    turnStart(u) { const heroes = enemiesOf(u).filter(e => alive(e) && !e.down); for (let i = 0; i < 1 && heroes.length; i++) { const h = heroes[rnd(heroes.length)], c = cellsAround(h, 1)[Math.floor(Math.random() * 8)]; if (c) fireAt(c[0], c[1], 2); }
      if (!u.selfLit && u.hp < u.maxHp / 2) { u.selfLit = true; fx(u, "поджигает себя", "bad"); log(`${u.name} поджигает сам себя и хохочет!`, "bad"); } const g = ui(); if (g) g.refresh(); },
    async turnEndAsync(u) { if (!u.selfLit) return; for (const o of enemiesOf(u).filter(o => alive(o) && dist(u, o) <= 1)) await B.applyDamage(u, o, [{ v: roll(1, 4).total, dt: "fire", label: "Аура огня" }], { src: u }); },
  };
  A["mad-pyromancer"] = { time: "action", tgt(u) { return { type: "cell", prompt: "Огненный вал: в какую сторону?", cells: cellsAround(u, 1).filter(([x, y]) => B.inB(x, y)), kind: "attack" }; }, can() { return true; },
    async run(u, pk, ctl) { const c = pk.cell; if (!c) return false; ctl.commit(); const cells = lineCells(u, c, 4), g = ui(); if (g) g.banner("Огненный вал"); for (const [x, y] of cells) fireAt(x, y, 2);
      for (const o of live().filter(o => alive(o) && o.side !== u.side && inCells(o, cells))) await saveDmg(u, o, "dex", dcOf(u, "int"), [2, 6], "fire", "Огненный вал"); if (g) g.refresh(); return true; },
    ai(u) { const t = foesIn(u, 4).sort((a, b) => dist(u, a) - dist(u, b))[0]; return t ? { cell: [u.x + Math.sign(t.x - u.x), u.y + Math.sign(t.y - u.y)], score: 11 } : null; } };
  /* Вождь Гракх Основатель (6, финальный страж) */
  P["gob-founder"] = { attackMods(u, ctx) { if (ctx.tgt && ctx.extra && hitByAlly(u, ctx.tgt)) ctx.extra.push({ n: 1, s: 8, b: 0, dt: ctx.atk && ctx.atk.dt || "slash", label: "Кровь основателя" }); } };
  P["gc-clich"] = { attackMods(u, ctx) { if (tmpOn(u, "gc-clich")) { ctx.mods.push({ l: "Клич Гракха", v: 1 }); ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; } } };
  P["body:gob-founder"] = { attackAura(a, { att, ctx }) { if (att !== a && ctx && alive(a)) ctx.dmgPlus = (ctx.dmgPlus || 0) + 1; },
    turnStart(u) { if (!u.guard && u.hp < u.maxHp / 2) { u.guard = true; const got = B.spawnFoes(["hobgoblin-shield"], u);  log(`${u.name} зовёт личную гвардию!`, "bad"); } },
    onDeath(u) { if (B.say) B.say("gob-founder", "город… будет… помнить…"); } };
  A["gob-founder"] = { time: "bonus", tgt() { return { type: "none" }; }, can() { return true; },
    async run(u, pk, ctl) { ctl.commit(); const g = ui(); if (g) g.banner("Клич Гракха"); log(`${u.name}: клич Гракха!`, "skill"); for (const o of alliesOf(u).filter(o => alive(o) && !o.down && dist(u, o) <= 3)) { B.tmpPass(o, "gc-clich", 2); fx(o, "клич", "good"); } return true; },
    ai(u) { return !u.cried && alliesOf(u).some(o => alive(o) && dist(u, o) <= 3) ? (u.cried = true, { score: 10 }) : null; } };
  /* ===== Кладбище прошлого, часть 2 (13.11): склеп, церковь, дух смерти, Азик. Числа — черновик ===== */
  Object.assign(D.essCd, { "candle-acolyte": 3, "penitent-dead": 2, "dead-templar": 4, "buried-priest": 4, "lesser-death": 3, "night-abbot": 4 });
  Object.assign(D.monTune, {
    "candle-acolyte": { role: "skirmish", focus: ["weak", "nearest"], noFlee: true }, "penitent-dead": { role: "brute", focus: ["nearest"], noFlee: true }, "dead-templar": { role: "brute", focus: ["nearest"], noFlee: true },
    "buried-priest": { role: "brute", focus: ["cluster", "nearest"], noFlee: true }, "lesser-death": { role: "skirmish", focus: ["weak", "nearest"], noFlee: true }, "night-abbot": { role: "brute", focus: ["weak", "nearest"], noFlee: true }, "azik-lich": { role: "ranged", keep: 2, focus: ["weak", "nearest"], noFlee: true },
  });
  Object.assign(DLG_START, { "azik-start": "Ох, зря вы сюда полезли…" });
  const gyUndead = t => !!(t && t.mon && typeof monCat === "function" && ["undead", "spirit"].includes(monCat(t.mon)));
  const gyDarkFight = () => !!(B.S && B.S.dark && !B.S.torch);
  /* Свечной служка (9) */
  P["candle-acolyte"] = { attackMods(u, ctx) { if (gyDarkFight()) { ctx.mods.push({ l: "Огонёк во тьме", v: 1 }); ctx.dmgPlus = (ctx.dmgPlus || 0) + 1; } } };
  P["body:candle-acolyte"] = { onDeath(u) { if (B.inB(u.x, u.y)) { fireAt(u.x, u.y, 2); log(`${u.name} роняет свечу — пол загорается.`, "bad"); } } };
  A["candle-acolyte"] = { time: "bonus", tgt(u) { return specUnit(u, "Горячий воск: в кого?", foesIn(u, 2), B.cellsWithin(u, 2), "attack"); }, can(u) { return foesIn(u, 2).length ? true : "нет цели в 2 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); log(`${u.name} плещет горячим воском в ${t.name}.`, "skill"); await B.applyDamage(u, t, [{ v: roll(1, 4).total, dt: "fire", label: "Горячий воск" }], { src: u }); if (alive(t) && !t.down) { const sv = await save(t, "dex", dcOf(u, "dex"), "Горячий воск", [], u); if (!sv.ok) { addStatus(t, "fumbled", { k: 2, when: "end" }); fx(t, "воск в глаза", "bad"); } } return true; },
    ai(u) { const ts = foesIn(u, 2).filter(t => !has(t, "fumbled")); return ts.length ? { unit: ts[0], score: 6 } : null; } };
  /* Кающийся мертвец (8) */
  P["penitent-dead"] = { attackMods(u, ctx) { if (u.hp < u.maxHp / 2 && ctx.atk && ctx.atk.kind !== "ranged") ctx.dmgPlus = (ctx.dmgPlus || 0) + 2; if (u.scourge === B.S.round && ctx.extra) { ctx.extra.push({ n: 1, s: 8, b: 0, dt: ctx.atk && ctx.atk.dt || "slash", label: "Бичевание" }); u.scourge = -1; } } };
  A["penitent-dead"] = { time: "bonus", tgt() { return { type: "self" }; }, can(u) { return u.hp > 3 ? true : "слишком мало ОЗ"; },
    async run(u, pk, ctl) { ctl.commit(); await B.applyDamage(null, u, [{ v: 3, dt: "slash", label: "Бичевание" }], { noAbilParts: true, self: true }); if (alive(u) && !u.down) { u.scourge = B.S.round; fx(u, "бичевание", "skill"); } return true; },
    ai(u) { return u.hp > 8 && foesIn(u, 1).length && u.scourge !== B.S.round ? { score: 7 } : null; } };
  /* Мёртвый храмовник (7) */
  P["dead-templar"] = { attackMods(u, ctx) { if (ctx.tgt && ctx.extra && ctx.atk && u.hero && gyUndead(ctx.tgt)) ctx.extra.push({ n: 1, s: 6, b: 0, dt: "radiant", label: "Освящённая сталь" }); } };
  A["dead-templar"] = { time: "bonus", tgt(u) { return specUnit(u, "Вызов на поединок: кого?", foesIn(u, 4), B.cellsWithin(u, 4), "attack"); }, can(u) { return foesIn(u, 4).length ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); log(`${u.name} вызывает ${t.name} на поединок!`, "skill"); const sv = await save(t, "wis", dcOf(u, "str"), "Вызов на поединок", ["charm"], u); if (!sv.ok && alive(t)) { addStatus(t, "taunted", { k: 2, when: "end", data: { by: u.id } }); fx(t, "вызов", "bad"); } else fx(t, "устоял", ""); return true; },
    ai(u) { const ts = foesIn(u, 4).filter(t => !has(t, "taunted")).sort((a, b) => b.maxHp - a.maxHp); return ts.length ? { unit: ts[0], score: 8 } : null; } };
  /* Погребённый священник (6, склеп) */
  const gyKnell = async (u, r, dice, dt, label, fear) => { const g = ui(); if (g) g.banner(label); log(`${u.name}: ${label}!`, "skill");
    for (const o of enemiesOf(u).filter(o => alive(o) && !o.down && dist(u, o) <= r)) { const sv = await saveDmg(u, o, "wis", dcOf(u, "wis"), dice, dt, label, ["fear"]); if (fear && !sv.ok && alive(o) && !o.down) { addStatus(o, "frightened", { k: 1, when: "end", data: { by: u.id } }); fx(o, "испуг", "bad"); } } };
  P["buried-priest"] = {};
  P["body:buried-priest"] = { async turnStartAsync(u) { if (!alive(u) || u.down) return; const near = enemiesOf(u).filter(o => alive(o) && !o.down && dist(u, o) <= 1); if (!near.length) return; log(`Кадило ${u.name} чадит могильным дымом.`, "bad"); for (const o of near) await B.applyDamage(u, o, [{ v: roll(1, 6).total, dt: "necrotic", label: "Кадило" }], { src: u, noAbilParts: true }); } };
  A["buried-priest"] = { time: "action", tgt() { return { type: "none" }; }, can(u) { return enemiesOf(u).some(o => alive(o) && !o.down && dist(u, o) <= 3) ? true : "нет врагов в 3 клетках"; },
    async run(u, pk, ctl) { ctl.commit(); await gyKnell(u, 3, [3, 6], u.hero ? "radiant" : "necrotic", "Заупокойная", true); return true; },
    ai(u) { const n = enemiesOf(u).filter(o => alive(o) && !o.down && dist(u, o) <= 3).length; return n >= 2 ? { score: 9 + n * 2 } : null; } };
  /* Младший дух смерти (6, свет на кладбище) */
  P["lesser-death"] = { attackMods(u, ctx) { const t = ctx.tgt; if (t && ctx.extra && t.hp < t.maxHp / 2) ctx.extra.push({ n: 1, s: 8, b: 0, dt: "necrotic", label: "Последний вздох" }); if (u.beyond === B.S.round && ctx.adv) { ctx.adv.push("Шаг за грань"); u.beyond = -1; } } };
  P["body:lesser-death"] = { resist(u, { dt }) { return ["pierce", "slash", "bludgeon"].includes(dt); },
    async turnStartAsync(u) { if (!alive(u) || u.down || enemiesOf(u).some(o => alive(o) && !o.down && dist(u, o) <= 1)) return; const t = enemiesOf(u).filter(o => alive(o) && !o.down).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (!t) return; const c = B.freeCellsNear(t, 1, u)[0]; if (c) { log(`${u.name} скользит сквозь тьму к ${t.name}.`, "bad"); await B.teleport(u, c[0], c[1]); } } };
  A["lesser-death"] = { time: "bonus", tgt(u) { return specUnit(u, "Шаг за грань: к кому?", foesIn(u, 4).filter(t => B.freeCellsNear(t, 1, u).length), B.cellsWithin(u, 4), "attack"); }, can(u) { return u.side === "hero" && foesIn(u, 4).some(t => B.freeCellsNear(t, 1, u).length) ? true : "нет цели в 4 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; const c = dist(u, t) <= 1 ? [u.x, u.y] : B.freeCellsNear(t, 1, u)[0]; if (!c) return false; ctl.commit(); if (c[0] !== u.x || c[1] !== u.y) await B.teleport(u, c[0], c[1]); u.beyond = B.S.round; fx(u, "шаг за грань", "skill"); return true; },
    ai() { return null; } };
  /* Настоятель Вечной ночи (6, страж разлома) */
  P["night-abbot"] = { turnStart(u) { if (!alive(u) || u.down || !B.S || B.S.phase !== "fight") return; const t = [u, ...alliesOf(u)].filter(o => alive(o) && !o.down && dist(u, o) <= 3 && o.hp < o.maxHp && !has(o, "noheal")).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (t) { B.heal(t, roll(1, 4).total + 1, u); fx(t, "служба", "good"); } } };
  P["body:night-abbot"] = { turnStart(u) { if (!u.flock && u.hp < u.maxHp / 2) { u.flock = true; B.spawnFoes(["candle-acolyte", "candle-acolyte"], u); log(`${u.name} поднимает свою паству!`, "bad"); const g = ui(); if (g) g.banner("Паства"); } } };
  A["night-abbot"] = { time: "action", tgt(u) { return specUnit(u, "Анафема: на кого?", foesIn(u, 5), B.cellsWithin(u, 5), "attack"); }, can(u) { return foesIn(u, 5).length ? true : "нет цели в 5 клетках"; },
    async run(u, pk, ctl) { const t = pk.unit; if (!t) return false; ctl.commit(); const g = ui(); if (g) g.banner("Анафема"); const sv = await saveDmg(u, t, "wis", dcOf(u, "wis"), [3, 8], "necrotic", "Анафема", ["curse"]); if (!sv.ok && alive(t) && !t.down) { addStatus(t, "noheal", { k: 2, when: "end" }); fx(t, "анафема", "bad"); } return true; },
    ai(u) { const ts = foesIn(u, 5).filter(t => !has(t, "noheal")).sort((a, b) => b.hp - a.hp); return ts.length ? { unit: ts[0], score: 12 } : null; } };
  /* Азик, низший владыка мёртвых (6, секретный босс; эссенции нет) */
  P["body:azik-lich"] = { turnStart(u) { if (!alive(u) || u.down) return; const S = B.S; if (S.round >= 2 && S.round % 3 === 2 && u.raised !== S.round) { u.raised = S.round; if (enemiesOf(u).length && alliesOf(u).filter(o => alive(o)).length < 4) { B.spawnFoes(["skeleton", "zombie"], u); log(`${u.name} поднимает мертвецов из земли!`, "bad"); const g = ui(); if (g) g.banner("Владыка мёртвых"); } } },
    async turnStartAsync(u) { const S = B.S; if (!alive(u) || u.down || S.round % 3 !== 1 || u.grasp === S.round) return; const t = foesIn(u, 5).filter(o => !has(o, "restrained")).sort((a, b) => dist(u, b) - dist(u, a))[0]; if (!t) return; u.grasp = S.round;          // «Хватка могилы»: у Азика нет эссенции, поэтому способность — особенность тела
      const g = ui(); if (g) g.banner("Хватка могилы"); log(`${u.name}: Хватка могилы — ${t.name}!`, "bad"); const sv = await saveDmg(u, t, "con", 8 + (u.pb || 3) + amod(u.abil.int), [2, 8], "necrotic", "Хватка могилы", []); if (!sv.ok && alive(t) && !t.down) { addStatus(t, "restrained", { k: 1, when: "end" }); fx(t, "хватка", "bad"); } },
    onDeath(u) { if (B.say) B.say("azik-lich", "вечность… была… так близко…"); } };
  // «Отпевание» и «Последний вздох»: гибель врага рядом с носителем эссенции / добивание
  { const prevReg = B.regKill; B.regKill = function (u, by) {
      try { if (u && u.side === "mon" && B.S && B.S.phase === "fight") {
        for (const p of live().filter(h => h.side === "hero" && alive(h) && !h.down && (h.pass || []).includes("buried-priest") && dist(h, u) <= 3)) { for (const o of [p, ...alliesOf(p)].filter(o => alive(o) && !o.down && dist(p, o) <= 3)) B.heal(o, roll(1, 6).total, p); log(`Отпевание: ${p.name} и союзники рядом переводят дух.`, "good"); }
        const k = by && by.summon && by.owner ? B.byId(by.owner) : by; if (k && k.side === "hero" && alive(k) && (k.pass || []).includes("lesser-death") && k.maxMp) { B.setMp(k, k.mp + 2); fx(k, "+2 маны", "good"); }
      } } catch (e) { console.error("gy kill hook:", e); }
      return prevReg.apply(this, arguments); }; }
  B.fillActiveTimes();
})();
