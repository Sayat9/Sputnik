/* Тактический бой: главный поток — расстановка, инициатива, раунды, ходы, конец боя. См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const { rnd, amod, roll, d, log, dist, distCell, footprint, alive, live, has, addStatus, removeStatus, sleep, pick, shuffle } = B;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  B.running = false;

  /* ===== расстановка ===== */
  const spreadX = n => { const order = [3, 2, 4, 1, 5, 0, 6]; return order.slice(0, n).sort((a, b) => a - b); };
  function freeBlock(u, x, y) { return B.canStand(u, x, y) && !footprint(u, x, y).some(([fx, fy]) => { const t = B.tinfo(fx, fy); return t && t.hazard; }); }
  function nearestFree(u, x, y, rows) {
    let best = null;
    for (const ry of rows) for (let cx = 0; cx < B.W; cx++) {
      if (u.size > 1 && (cx + 1 >= B.W || ry + 1 >= B.H)) continue;
      if (!freeBlock(u, cx, ry)) continue;
      const dd = Math.abs(cx - x) + Math.abs(ry - y) * 1.5;
      if (!best || dd < best.dd) best = { x: cx, y: ry, dd };
    }
    return best;
  }
  function placeHeroesDefault(S) {
    const hs = B.heroes().filter(h => !h.dead), xs = spreadX(hs.length), y = S.ambush ? 4 : 5;
    hs.forEach((h, i) => { const c = nearestFree(h, xs[i], y, [4, 5, 6]) || nearestFree(h, 3, 5, [4, 5, 6]); if (c) { h.x = c.x; h.y = c.y; } });
  }
  B.placeHeroesDefault = placeHeroesDefault;
  function placeMonsters(S) {
    const mons = B.mons(), amb = S.ambush;
    const rowsBy = amb ? { front: [3, 2], mid: [2, 1], back: [1, 0] } : { front: [2, 1], mid: [1, 2, 0], back: [0, 1] };
    const where = pr => (["ranged", "secondLine"].includes(pr.role) ? "back" : ["skirmisher", "skittish", "support"].includes(pr.role) ? "mid" : "front");
    const order = shuffle(mons).sort((a, b) => (b.size - a.size));
    const heroes = B.heroes().filter(h => alive(h));
    for (const m of order) {
      const rows = rowsBy[where(m.ai || {})];
      const anchor = heroes.length ? pick(heroes) : { x: 3 };
      let placed = false;
      for (const ry of rows) {
        const opts = [];
        for (let cx = 0; cx < B.W; cx++) { if (m.size > 1 && (cx + 1 >= B.W || ry + 1 >= B.H)) continue; if (freeBlock(m, cx, ry)) opts.push({ x: cx, y: ry, k: Math.abs(cx - (amb ? anchor.x : 3)) + rnd(3) * 0.8 }); }
        if (opts.length) { opts.sort((a, b) => a.k - b.k); m.x = opts[0].x; m.y = opts[0].y; placed = true; break; }
      }
      if (!placed) { const c = nearestFree(m, 3, rows[0], [0, 1, 2, 3]); if (c) { m.x = c.x; m.y = c.y; } }
      m.startCell = [m.x, m.y];
    }
  }
  B.placeMonsters = placeMonsters;

  /* ===== начало боя ===== */
  function preStart(S) {
    // скрытые ловушки: замечает герой с достаточным пассивным Восприятием
    const bestPerc = Math.max(0, ...B.heroes().map(h => 10 + amod(h.abil.wis) + (h.skills.perception || 0)));
    for (const t of S.objs) if (t.kind === "trap" && t.hidden && bestPerc >= t.dc) t.hidden = false;
    // скрытные монстры пытаются спрятаться
    for (const m of B.mons()) {
      const pr = m.ai || {}; if (!pr.hide) continue;
      const spot = B.hideSpot(m); if (!spot && !pr.still) continue;
      const adv = (m.pass.includes("skeleton-archer") ? 1 : 0), a = d(20), b = adv ? d(20) : 0;
      const stealth = Math.max(a, b) + amod(m.abil.dex) + (m.skills.stealth || 0);
      if (stealth >= bestPerc) { addStatus(m, "hidden", { k: Infinity }); log(`${m.name} затаился.`); }
    }
    S.initialMons = B.mons().length;
  }

  /* ===== спасброски от смерти ===== */
  async function deathSaveTurn(u) {
    if (has(u, "stable")) return;
    const ses = B.session(u, { kind: "save", u, title: "Спасбросок от смерти", sub: `${u.name}: ${u.deathSaves.ok} успехов, ${u.deathSaves.fail} провалов`, death: true });
    const r = await ses.d20({ label: "Спасбросок от смерти", mods: [], adv: [], dis: [], vs: { dc: 10 }, reroll: B.rerollOptions(u, "save"), cancel: false, death: true });
    let text;
    if (r.nat === 20) { B.setHp(u, 1); B.revive(u); text = "Двадцать! Герой приходит в себя с 1 ОЗ"; }
    else if (r.nat === 1) { u.deathSaves.fail += 2; text = "Единица: два провала"; }
    else if (r.total >= 10) { u.deathSaves.ok++; text = "Успех"; }
    else { u.deathSaves.fail++; text = "Провал"; }
    log(`${u.name}: спасбросок от смерти ${r.nat} — ${text.toLowerCase()}.`, r.total >= 10 ? "good" : "bad");
    if (u.alive && !u.dead && u.down) {
      if (u.deathSaves.fail >= 3) { B.kill(u, null); text += ". Герой погибает"; }
      else if (u.deathSaves.ok >= 3) { removeStatus(u, "unconscious"); addStatus(u, "stable", { k: Infinity }); text += ". Состояние стабилизировано"; log(`${u.name} стабилизируется.`, "good"); }
    }
    await ses.finish({ text, save: true, ok: r.total >= 10 });
  }

  /* ===== основной цикл ===== */
  async function loop(S) {
    let guard = 0;
    while (!S.outcome && guard++ < 400) {
      const u = B.currentUnit();
      if (!u || !alive(u)) { B.advanceTurn(); continue; }
      S.curId = u.id;
      await B.startTurn(u);
      if (alive(u)) {
        const g = ui(); if (g) await g.turnStart(u);
        if (u.side === "hero") {
          if (u.down) { if (!u.dead) await deathSaveTurn(u); }
          else if (B.S.opts.autoHeroes || !g) await B.AI.takeTurn(u);
          else await g.heroTurn(u);
        } else if (B.canAct(u)) await B.AI.takeTurn(u);
        B.endTurn(u);
        if (g) g.turnEnd(u);
      }
      const out = B.checkEnd(); if (out) break;
      B.advanceTurn();
      await sleep(180);
    }
    if (!S.outcome) S.outcome = "flee";
  }

  /* ===== запуск ===== */
  async function start(ev, o = {}) {
    const S = B.newBattle(ev);
    const g = ui();
    if (o.sim || !g) { placeHeroesDefault(S); placeMonsters(S); }
    else { placeHeroesDefault(S); await g.placement(S); placeMonsters(S); await g.reveal(S); }
    preStart(S);
    B.rollInitiative();
    S.phase = "fight"; log(S.ambush ? "Засада! Монстры ходят первыми." : "Бой начался.", "round");
    if (g) await g.start(S);
    await loop(S);
    S.phase = "result";
    return S;
  }
  B.start = start;

  // Полностью автоматический бой без интерфейса (для проверок и симуляций).
  B.sim = async function (ev, o = {}) {
    const old = { fast: B.cfg.fast, auto: null };
    B.cfg.fast = true;
    try {
      const S = B.newBattle(ev); S.opts.autoHeroes = true;
      placeHeroesDefault(S); placeMonsters(S); preStart(S); B.rollInitiative(); S.phase = "fight";
      if (o.setup) o.setup(S);
      await loop(S);
      const rounds = S.round;
      return { outcome: S.outcome, rounds, killed: S.killed.slice(), log: S.log, S };
    } finally { B.cfg.fast = old.fast; }
  };

  // Вызывает приложение при открытии боя (encounterOverlay). Бой создаёт собственный слой и сам сообщает итог.
  B.ensure = function (ev) {
    if (B.running || ev.battleStarted) return;
    ev.battleStarted = true; B.running = true;
    (async () => {
      try {
        if (B.UI) B.UI.open();
        const S = await start(ev);
        if (S.outcome === "abort") {         // игрок перешёл на обычный экран боя
          B.End.cleanup(S, "abort");
          if (B.UI) B.UI.close();
          B.running = false; B.S = null; ev.battleStarted = false; ev.tactical = false; ev.killed = S.killed.slice();
          toast("Бой перенесён на обычный экран"); rerender(); return;
        }
        await B.End.run(S);                 // экран итога и наград, затем возврат результата приложению
      } catch (err) {
        console.error("бой:", err);
        try { if (B.UI) B.UI.close(); } catch (e) {}
        B.running = false; B.S = null;
        ev.tactical = false; toast("Ошибка боя — открыт обычный экран боя"); rerender();
      }
    })();
  };
  // Остановка тактического боя: цикл ходов завершится после текущего хода.
  B.abort = function () { const S = B.S; if (S && !S.outcome) S.outcome = "abort"; };
  B.ready = true;
})();
