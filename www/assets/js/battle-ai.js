/* Тактический бой: ИИ монстров (и режим «Авто» героев).
   Интеллект поведения (ai.int): 0 — тупая нежить/камень (ближайшая цель), 1 — звери (инстинкты: раненые, слабые, свет),
   2 — хитрецы (укрытия, отход от лучников, фокус-огонь, мораль), 3 — тактики (вожаки). Роль и приоритеты целей — из D.mon[id].ai. */
(function () {
  const B = window.Battle, D = B.D;
  const { roll, amod, clamp, log, dist, distAt, distCell, footprint, alive, live, enemiesOf, alliesOf, has, addStatus, removeStatus, speedOf, canAct, sleep, pick, rnd } = B;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const AI = (B.AI = {});

  const profileOf = u => {
    if (u.side === "mon" || u.summon) return u.ai || { int: 1, role: "melee", focus: ["nearest"] };
    const ranged = B.attacksOf(u).some(a => a.kind === "ranged" && a.ammo && B.arrowsLeft(u) > 0);
    return { int: 2, role: ranged ? "ranged" : "melee", keep: ranged ? 2 : 0, focus: ["wounded", "weak", "nearest"], kite: ranged };
  };
  const seenBy = (u, t) => !(has(t, "hidden") && (dist(u, t) > 1 || has(t, "hidden").data.invis) && !(u.blind && dist(u, t) <= u.blind) && !(u.tremor && dist(u, t) <= u.tremor && !B.isFlying(t)));
  const targetsOf = u => enemiesOf(u).filter(t => seenBy(u, t) && !t.dead && !has(t, "underground"));
  const abilityReady = (u, id) => {
    const A = B.A && B.A[id], eb = ESSENCES[id] && ESSENCES[id].active; if (!A || !eb || A.reaction) return false;
    if (!B.timeOK(u, A.time)) return false;
    if (A.ready) { const r = A.ready(u); if (r != null) return !!r; }                     // способности в два хода: вторая половина доступна без маны и «раз за бой»
    if (u.side === "mon") return !u.used[id];
    return u.mp >= eb.mana && !(u.cd[id] > 0);
  };

  /* ===== оценка атаки ===== */
  function hitChance(ctx) {
    const need = ctx.ac - ctx.mods.reduce((s, m) => s + m.v, 0);
    let p = clamp((21 - need) / 20, 0.05, 0.95);
    const adv = ctx.adv.length > 0, dis = ctx.dis.length > 0;
    if (adv && !dis) p = 1 - (1 - p) * (1 - p); else if (dis && !adv) p = p * p;
    return p;
  }
  function focusBonus(u, t, pr) {
    let s = 0; const int = pr.int ?? 1; if (has(t, "bastion")) s += 6;          // провокация бастиона
    for (const f of pr.focus || ["nearest"]) {
      if (f === "wounded") s += (1 - t.hp / t.maxHp) * 4;
      else if (f === "weak") s += (1 - t.hp / t.maxHp) * 2 + (t.ac <= 11 ? 1.5 : 0);
      else if (f === "torch") s += (B.S.torchBy === t.id || (t.hero && countGear(t.hero, "torch") > 0 && B.S.torch) ? 4 : (t.hero && countGear(t.hero, "torch") > 0 ? 1 : 0));
      else if (f === "attacker") s += u.lastHitBy === t.id ? 4 : 0;
      else if (f === "runner") s += t.t && t.t.moved > 0 ? 3 : 0;
      else if (f === "prone") s += has(t, "prone") ? 3 : 0;
      else if (f === "cluster") s += alliesOf(t).filter(a => dist(a, t) <= 1).length * 1.2;
    }
    if (int >= 2 && t.hp < t.maxHp * 0.75) s += 1.5;                                   // фокус-огонь по уже раненому
    if (t.down) s -= 6;                                                                // упавшего добивают в последнюю очередь: сначала те, кто на ногах
    if (int >= 1 && has(t, "dodging")) s -= 1;
    return s;
  }
  function scoreAttack(u, atk, t, pr, o = {}) {
    const ctx = B.attackCtx(u, t, atk, o), p = hitChance(ctx);
    const avg = B.avgDice(atk.dmg) + (ctx.extra || []).reduce((a, e) => a + e.n * (e.s + 1) / 2, 0);
    let dmg = p * (avg + 0.05 * avg), kill = 0;
    if (t.hp <= avg * p) kill = 3 * p; else if (t.hp <= avg) kill = 1;
    if (t.down && !t.dead) { dmg *= 0.3; kill = 0; }                                    // добить можно, но выгоднее бить тех, кто ещё стоит
    return dmg + kill + focusBonus(u, t, pr) * 0.6;
  }
  // Лучшее действие из текущей позиции юнита: {kind, ...score}
  function bestAction(u, pr) {
    let best = null; const ts = targetsOf(u); if (!ts.length) return null;
    const attacks = B.attacksOf(u);
    const useRangedFirst = pr.ranged === "ifNoMelee";
    for (const atk of attacks) {
      if (atk.offhand || (atk.thrown && !(pr.throwWhenBroken && alliesOf(u).length === 0))) continue;
      if (atk.ammo && u.hero && B.arrowsLeft(u) < 1) continue;
      if (u.side === "hero" && atk.id === "torchhit") continue;
      for (const t of ts) {
        if (!B.inAttackRange(u, t, atk)) continue;
        let sc = scoreAttack(u, atk, t, pr);
        if (useRangedFirst && atk.kind === "ranged" && ts.some(x => B.inAttackRange(u, x, attacks.find(a => a.kind === "melee") || atk))) sc -= 2;     // гоблин: вблизи — нож, издали — праща
        if (u.seq && u.side === "mon") sc *= u.seq.length;
        if (!best || sc > best.score) best = { kind: "attack", atk, tgt: t, score: sc };
      }
    }
    for (const id of u.ess) {
      if (!abilityReady(u, id)) continue;
      const A = B.A[id]; if (A.time !== "action") continue;
      const r = A.ai && A.ai(u); if (!r) continue;
      let sc, picks = {};
      if (r.attackAbility) {
        let bt = null; for (const t of r.targets) { const s = scoreAttack(u, r.atk, t, pr); if (!bt || s > bt.s) bt = { t, s }; }
        if (!bt) continue; sc = bt.s + (r.bonus || 3); picks = { unit: bt.t };
      } else { sc = r.score; picks = { unit: r.unit, units: r.units, cell: r.cell }; }
      if (u.side === "hero") sc -= 1.5;                                                     // героям мана дорога: способность только если заметно лучше
      if (!best || sc > best.score) best = { kind: "ability", id, picks, score: sc };
    }
    return best;
  }

  /* ===== позиция ===== */
  function sideCover(u, es) { return es.length && es.every(e => B.coverBetween(e, u) >= 2) ? 1 : 0; }
  function posScore(u, es, pr, ctx) {
    const int = pr.int ?? 1; let s = 0;
    const near = es.length ? Math.min(...es.map(e => dist(u, e))) : 9;
    const t = B.tinfo(u.x, u.y), fly = B.isFlying(u);
    if (!fly && t && t.hazard && int >= 1) s -= 8;
    if (!fly && B.S.objs.some(o => o.kind === "trap" && o.x === u.x && o.y === u.y && !(o.owner === u.side) && (!o.hidden || (o.noticed || []).includes(u.id)))) s -= (u.ai && u.ai.trapSafe && u.side === "mon") ? 0 : 6;     // о скрытой ловушке знает только заметивший
    if (!fly && t && t.cost > 1) s -= 0.3;
    if (pr.role === "ranged" || pr.kite) {
      const keep = pr.keep || 3;
      if (near < keep) s -= (keep - near) * 2.2;
      if (int >= 2) { s += sideCover(u, es) * 1.5; if (B.hideSpot(u)) s += 0.5; }
    }
    if (pr.role === "skittish" || pr.role === "skirmisher") { if (int >= 2) s += sideCover(u, es) * 1; }
    if (pr.flitter) s += ctx.movedCells >= 2 ? 2 : 0;
    if (pr.leash != null && ctx.start && distCell(u, ctx.start[0], ctx.start[1]) > pr.leash) s -= 100;
    if (ctx.sentinelHold) s -= (ctx.movedCells || 0) * 6;
    if (int >= 1 && ctx.startPos) {                                                           // провоцированные атаки
      const oa = es.filter(e => canAct(e) && e.t.react && e.t !== undefined && dist(e, { ...u, x: ctx.startPos[0], y: ctx.startPos[1], size: u.size, id: u.id }) <= B.meleeReach(e) && dist(e, u) > B.meleeReach(e)).length;
      s -= oa * (int >= 2 ? 3 : 1.2);
    }
    if (int >= 2) { const thr = es.filter(e => canAct(e) && dist(e, u) <= B.meleeReach(e) + Math.min(3, speedOf(e))).length; s -= thr * 0.35; }
    if ((pr.focus || []).includes("cluster")) s += es.filter(e => dist(e, u) <= 1).length * 1.3;
    return s;
  }
  function frightenOK(u, x, y) {
    const f = has(u, "frightened"); if (!f) return true;
    const src = B.byId(f.data.by); if (!src || !alive(src)) return true;
    return distAt(src, { ...u, x: u.x, y: u.y }, x, y) >= dist(src, u);
  }
  B.frightenOK = frightenOK;

  /* ===== мораль ===== */
  async function moraleCheck(u, pr) {
    const m = pr.morale; if (!m || u.flags.fled || u.flags.moraleDone || pr.noFlee) return;
    const S = B.S, mons = B.mons();
    if (m.type === "pack") {
      const gone = mons.filter(x => !alive(x)).length;
      if (gone * 2 < mons.length || mons.length < 2) return;
    } else if (m.type === "alone") {
      if (mons.length < 2 || mons.filter(alive).length !== 1) return;
    }
    u.flags.moraleDone = true;
    const elder = alliesOf(u).some(a => a.pass.includes("goblin-elder") && canAct(a) && dist(a, u) <= 6);          // «Голос старейшины»: рядом с ним на проверку трусости — преимущество
    const dc = m.dc || 10, mod = (m.mod != null ? m.mod : amod(u.abil.wis)), adv = !!m.adv || elder;
    const d1 = roll(1, 20).total, d2 = adv ? roll(1, 20).total : null, nat = adv ? Math.max(d1, d2) : d1;
    const ok = nat + mod >= dc;
    log(`${u.name}: мораль — ${nat + mod} против Сл ${dc} — ${ok ? "держится" : "бежит!"}`, ok ? "" : "flee");
    if (!ok) { u.flags.fleeing = true; ui() && ui().fxText(u, "бежит!", "bad"); }
  }
  function shouldFlee(u, pr) {
    if (u.flags.fleeing) return true;
    if (pr.noFlee) return false;
    if (u.ref === "rat" && !u.summon && live().some(o => o.ref === "rat-catcher" && alive(o) && !o.down)) return false;          // пока рядом играет крысолов, крысы не бегут
    if (pr.fleeHp != null && u.hp <= u.maxHp * pr.fleeHp && u.hp < u.maxHp) { u.flags.fleeing = true; log(`${u.name} в панике!`, "flee"); ui() && ui().fxText(u, "бежит!", "bad"); return true; }
    return false;
  }
  async function fleeTurn(u) {
    const sp = u.t.move, dash = u.t.action > 0 ? speedOf(u) : 0;
    const map = B.pathMap(u, sp + dash, {});
    const cands = [...map.values()].filter(v => B.canStand(u, v.x, v.y) || (v.x === u.x && v.y === u.y));
    if (!cands.length) return false;
    const es = enemiesOf(u);
    cands.sort((a, b) => (a.y - b.y) || (Math.min(...es.map(e => dist(e, { ...u, x: b.x, y: b.y, size: u.size, id: u.id }))) - Math.min(...es.map(e => dist(e, { ...u, x: a.x, y: a.y, size: u.size, id: u.id })))));
    const dest = cands[0];
    if (dest.cost > u.t.move) { B.spendTime(u, "action"); u.t.move += speedOf(u); }
    const path = B.pathTo(map, dest.x, dest.y);
    const r = await B.moveAlong(u, path, { noProvoke: false }); u.t.move = Math.max(0, u.t.move - r.spent);
    if (alive(u) && !u.down && u.y === 0) { u.fled = true; B.dropOwnedStatuses(u); log(`${u.name} убегает с поля боя.`, "flee"); ui() && ui().fxEscape(u); }
    return true;
  }

  /* ===== ход ===== */
  async function doMoveTo(u, node, map) {
    const path = B.pathTo(map, node.x, node.y);
    const r = await B.moveAlong(u, path); u.t.move = Math.max(0, u.t.move - r.spent); u.t.moved += r.spent;
    return r;
  }
  function faceToward(u, t) { const dx = Math.sign(t.x - u.x), dy = Math.sign(t.y - u.y); if (dx || dy) u.facing = [dx, dy]; }
  async function performAction(u, act, pr) {
    if (!act) return false;
    if (act.kind === "attack") {
      const seq = u.side === "mon" && u.seq ? u.seq.map(id => u.atk.find(a => a.id === id)).filter(Boolean) : [act.atk];
      let first = true;
      for (const atk of seq) {
        let tgt = act.tgt;
        if (!first || !alive(tgt) || !B.inAttackRange(u, tgt, atk)) {
          const cands = targetsOf(u).filter(t => B.inAttackRange(u, t, atk)); if (!cands.length) break;
          tgt = cands.sort((a, b) => scoreAttack(u, atk, b, pr) - scoreAttack(u, atk, a, pr))[0];
        }
        first = false;
        if (!alive(u) || u.down) break;
        faceToward(u, tgt);
        const r = await B.doAttack(u, tgt, atk, { cancelable: false, onCommit: () => { if (u.side === "hero") B.commitAttack(u, atk, tgt); else B.spendTime(u, "action"); } });
      }
      if (act.atk.thrown && u.side === "mon") { u.atk = u.atk.filter(a => a.id !== "throw" && a.id !== "spear"); u.atk.push({ id: "fist", n: "Кулаки", hit: 2, dmg: B.parseDice("1"), dt: "bludgeon", kind: "melee", reach: 1 }); }
      return true;
    }
    if (act.kind === "ability") {
      if (act.picks.unit) faceToward(u, act.picks.unit);
      return B.useActive(u, act.id, act.picks);
    }
    return false;
  }
  async function preBonus(u, pr) {
    for (const id of u.ess) {
      if (!abilityReady(u, id)) continue;
      const A = B.A[id]; if (A.time !== "bonus") continue;
      const r = A.ai && A.ai(u); if (!r) continue;
      const picks = { unit: r.unit, units: r.units, cell: r.cell };
      if (id === "hobgoblin") { picks.cell = null; const es = targetsOf(u); if (es.length) { const tgt = es.reduce((a, b) => (dist(u, a) < dist(u, b) ? a : b)); const spec = A.tgt(u); const best = spec.cells.sort((a, b) => distCell(tgt, a[0], a[1]) - distCell(tgt, b[0], b[1]))[0]; if (best && distCell(tgt, best[0], best[1]) < dist(u, tgt)) picks.cell = best; } }
      if (id === "hobgoblin" && !picks.cell) continue;
      if (u.side === "hero" && u.mp < ESSENCES[id].active.mana + 2) continue;
      await B.useActive(u, id, picks);
      if (!alive(u) || u.down) return;
    }
  }
  async function aiPotion(u) {
    const pid = u.hero && countGear(u.hero, "potion-good") > 0 ? "potion-good" : "potion";
    if (u.side !== "hero" || !u.hero || countGear(u.hero, pid) < 1 || !B.timeOK(u, "bonus")) return;
    const needy = [u, ...alliesOf(u).filter(a => dist(u, a) <= 1)].filter(a => a.hp < a.maxHp * 0.35 && !a.dead).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!needy) return;
    takeGear(u.hero, pid, 1); B.spendTime(u, "bonus");
    const n = pid === "potion-good" ? roll(2, 4).total + 4 : roll(1, 4).total + 2; log(`${u.name} даёт зелье ${needy.name}.`); B.heal(needy, n, u);
  }
  AI.wantsOpportunity = (e, mover) => { const pr = profileOf(e); if (pr.still && pr.role === "ranged") return true; return true; };

  AI.takeTurn = async function (u) {
    const S = B.S, pr = profileOf(u);
    if (!alive(u) || u.down || !canAct(u) || has(u, "underground")) return;
    u.startCell = u.startCell || [u.x, u.y];
    ui() && ui().focusUnit(u);
    if (has(u, "prone")) { const cost = B.standCost(u); if (u.t.move >= cost && speedOf(u) > 0) { removeStatus(u, "prone"); u.t.move -= cost; log(`${u.name} встаёт.`); await sleep(250); } }
    if (u.side === "hero" && u.hero && B.dropsHere && B.dropsHere(u).length) await B.pickUpWeapon(u);          // стоит на своём оружии — подбирает (свободное действие)
    await moraleCheck(u, pr);
    if (shouldFlee(u, pr)) { if (await fleeTurn(u)) return; }
    if (u.side === "hero") await aiPotion(u);
    // Крот гасит факел бонусным действием (решение автора); автобой героев зажигает его снова не более двух раз за бой
    if (u.side === "mon" && u.ref === "rat-catcher" && B.callRats) await B.callRats(u);
    if (u.side === "mon" && u.pass.includes("giant-mole") && S.torch && B.timeOK(u, "bonus")) { B.spendTime(u, "bonus"); S.torch = false; S.torchLeft = 0; S.torchFixed = false; log(`${u.name} гасит свет: тьма.`, "bad"); ui() && ui().fxText(u, "тьма", "bad"); ui() && ui().refresh(); await sleep(300); }
    if (u.side === "hero" && u.hero && S.pitDark && !S.torch && (S.torchRelit || 0) < 2 && B.timeOK(u, "action") && (countGear(u.hero, "torch") > 0 || S.torchLeft > 0) && B.lightTorch) { S.torchRelit = (S.torchRelit || 0) + 1; await B.lightTorch(u); }
    if (has(u, "burning") && B.timeOK(u, "action") && !(bestAction(u, pr))) { B.spendTime(u, "action"); removeStatus(u, "burning"); log(`${u.name} тушит огонь.`, "good"); }
    if (has(u, "mired") && B.timeOK(u, "action") && !(bestAction(u, pr))) { B.spendTime(u, "action"); removeStatus(u, "mired"); u.bogStill = 0; u.t.move = speedOf(u); log(`${u.name} выбирается из топи.`, "good"); }          // автобой: вылезает, если некого бить
    // сдавленный/опутанный: пробуем вырваться, если некого бить
    const stuck = has(u, "grappled") || has(u, "trapped") || has(u, "restrained") || has(u, "pinned") || has(u, "buried");
    const es = targetsOf(u); if (!es.length) return;
    await preBonus(u, pr);
    if (!alive(u) || u.down) return;
    if (B.hookAllAsync) await B.hookAllAsync(u, "aiBonus", {});                          // доп. действия пассивок: «Пожиратель»
    if (!alive(u) || u.down) return;
    // часовые стоят, пока враг не подошёл
    const nearest = Math.min(...es.map(e => dist(u, e)));
    const hold = (pr.wake != null && nearest > pr.wake && !u.flags.awake) || false;
    if (!hold) u.flags.awake = true;
    // план: перебираем клетки
    const startPos = [u.x, u.y];
    const map = B.pathMap(u, u.t.move, {});
    let cells = [{ x: u.x, y: u.y, cost: 0, prev: null }];
    if (!hold && speedOf(u) > 0) cells = cells.concat([...map.values()].filter(v => (v.x !== u.x || v.y !== u.y) && B.canStand(u, v.x, v.y) && frightenOK(u, v.x, v.y)));
    let best = null;
    for (const c of cells) {
      u.x = c.x; u.y = c.y;
      const act = B.timeOK(u, "action") ? bestAction(u, pr) : null;
      const prefer = es.reduce((a, b) => (focusBonus(u, a, pr) - dist(u, a) * 0.6 >= focusBonus(u, b, pr) - dist(u, b) * 0.6 ? a : b));
      const moved = c.cost;
      const ps = posScore(u, es, pr, { movedCells: moved, startPos, start: u.startCell, sentinelHold: hold });
      const approach = act ? 0 : -dist(u, prefer) * 1.1;
      const total = (act ? act.score : 0) + ps + approach - (c.cost ? 0.05 * c.cost : 0);
      if (!best || total > best.total) best = { cell: c, act, total };
    }
    u.x = startPos[0]; u.y = startPos[1];
    if (!best) return;
    if (best.cell.x !== u.x || best.cell.y !== u.y) { const r = await doMoveTo(u, best.cell, map); if (!alive(u) || u.down || r.interrupted && (u.x !== best.cell.x || u.y !== best.cell.y)) { if (!alive(u) || u.down) return; } }
    if (!alive(u) || u.down) return;
    // действие в итоговой позиции (пересчитываем: что-то могло измениться по пути)
    if (B.timeOK(u, "action")) { const act = bestAction(u, pr); if (act) await performAction(u, act, pr); else if (stuck) await AI.tryEscape(u); }
    if (!alive(u) || u.down) return;
    // отход после удара
    if (pr.hitRun && u.t.move > 0 && speedOf(u) > 0 && (pr.int ?? 1) >= 1 && !u.flags.noRetreat) {
      const es2 = targetsOf(u); if (es2.length) {
        const map2 = B.pathMap(u, u.t.move, {}); let bc = null;
        for (const v of map2.values()) {
          if ((v.x === u.x && v.y === u.y) || !B.canStand(u, v.x, v.y) || !frightenOK(u, v.x, v.y)) continue;
          const dmin = Math.min(...es2.map(e => dist(e, { ...u, x: v.x, y: v.y, size: u.size, id: u.id })));
          const sc = dmin * 1.5 + (B.coverBetween(es2[0], { ...u, x: v.x, y: v.y, size: u.size, id: u.id, ...{} }) >= 2 ? 2 : 0) - (B.S.cells[v.y][v.x] && D.terrain[B.S.cells[v.y][v.x]].hazard ? 9 : 0);
          if (!bc || sc > bc.sc) bc = { v, sc };
        }
        const cur = Math.min(...es2.map(e => dist(u, e)));
        if (bc && bc.sc > cur * 1.5 + 0.5) { await doMoveTo(u, bc.v, map2); }
      }
    }
    // блуждающий огонёк гаснет и загорается в другом месте
    if (pr.relocate && !u.flags.relocated && alive(u) && u.hp < u.maxHp) {
      const spots = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (distCell(u, x, y) <= 4 && B.canStand(u, x, y)) spots.push([x, y]);
      const es3 = targetsOf(u); if (spots.length && es3.length) {
        spots.sort((a, b) => Math.min(...es3.map(e => distCell(e, b[0], b[1]))) - Math.min(...es3.map(e => distCell(e, a[0], a[1]))));
        const [x, y] = spots[0]; u.flags.relocated = true; log(`${u.name} гаснет и вспыхивает в другом месте.`); ui() && ui().fxText(u, "гаснет", ""); const from = [u.x, u.y]; u.x = x; u.y = y; ui() && await ui().animMove(u, from, [x, y]);
      }
    }
  };
  AI.tryEscape = async function (u) {
    const holds = B.holdsOf(u); if (!holds.length) return;
    const hold = holds[0], st = has(u, hold.id), gr = hold.id === "grappled" ? st : null, by = gr ? B.byId(gr.data.by) : null; let ok = false;      // за одно действие — одни путы
    B.spendTime(u, "action");
    if (hold.id === "buried") { const r = await B.doCheck(u, "athletics", { title: "Выбраться из земли", dc: st.data.dc }); if (r && r.ok) { removeStatus(u, "buried"); log(`${u.name} выбирается из земли.`); } return; }
    if (st.data && st.data.net) { const r = await B.doCheck(u, "athletics", { title: "Вырваться из сети", dc: st.data.dc || 10 }); ok = r && r.ok; }                    // сеть и паутина: проверка Силы
    else if (gr && gr.data.dc) { const r = await B.doCheck(u, gr.data.skill || B.bestDef(u), { title: "Вырваться", dc: gr.data.dc, tags: ["grapple"] }); ok = r && r.ok; }                    // хватка эссенции: Сл эссенции
    else if (gr && by && alive(by)) { const r = await B.contest(u, B.bestDef(u), by, "athletics", { title: "Вырваться", tagsA: ["grapple"] }); ok = r && r.win; }
    else { const r = await B.doCheck(u, B.bestDef(u), { title: "Вырваться", dc: (st.data && st.data.dc) || 10 }); ok = r && r.ok; }
    if (ok) { removeStatus(u, hold.id); log(`${u.name} вырывается.`); }
  };
  AI.profileOf = profileOf; AI.bestAction = bestAction; AI.scoreAttack = scoreAttack;
})();
