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
  // 2 этаж и глубже: часть врагов переходит в ближайшие кусты, заросли или под надгробия (D.deep) — в preStart они пробуют там затаиться.
  function placeCoverMonsters(S) {
    const cfg = B.D.deep[S.zone]; if (!cfg || (S.floor || 1) < 2) return;
    const mons = shuffle(B.mons().filter(m => m.size === 1 && alive(m) && !B.isFlying(m)));
    let want = Math.round(B.mons().length * cfg.hideShare + (rnd(3) - 1) * 0.5); want = Math.max(1, Math.min(want, mons.length));
    const spots = [];
    for (let y = 0; y <= 3; y++) for (let x = 0; x < B.W; x++) { const t = B.tinfo(x, y); if (t && t.hide && !t.obstacle) spots.push({ x, y }); }
    let done = 0;
    for (const m of mons) {
      if (done >= want) break;
      const free = spots.filter(c => !B.occupant(c.x, c.y) && B.canStand(m, c.x, c.y)).map(c => ({ c, k: Math.abs(c.x - m.x) + Math.abs(c.y - m.y) })).filter(o => o.k <= 4);
      if (!free.length) continue;
      free.sort((a, b) => a.k - b.k || rnd(3) - 1);
      m.x = free[0].c.x; m.y = free[0].c.y; m.startCell = [m.x, m.y]; m.coverHide = true; done++;
    }
  }
  B.placeCoverMonsters = placeCoverMonsters;
  B.preStart = (S) => preStart(S);
  // Затаившийся враг становится виден: вплотную (≤ 1 клетки) сразу, до 3 клеток — если пассивное Восприятие героя не ниже его Скрытности.
  function reveal(m, why) { const h = has(m, "hidden"); if (!h || !h.data || !h.data.unseen) return; h.data.unseen = false; log(`${m.name} замечен${why ? " (" + why + ")" : ""}.`, "good"); const g = ui(); if (g) { g.fxText(m, "замечен", "good"); g.refresh(); } }
  function spotHidden(u) {
    if (u.side !== "hero" || !alive(u) || u.down) return;
    for (const m of B.mons()) {
      if (!B.isUnseen(m) || !alive(m)) continue;
      const dd = dist(u, m);
      if (dd <= 1) reveal(m, "рядом");
      else if (dd <= 3 && B.passivePerceptionOf(u) >= (has(m, "hidden").data.dc || 0)) reveal(m, "по шороху");
    }
  }
  B.spotHidden = spotHidden; B.revealHidden = reveal;

  /* ===== начало боя ===== */
  function preStart(S) {
    // скрытые ловушки: замечает герой с достаточным пассивным Восприятием
    const bestPerc = Math.max(0, ...B.heroes().map(h => B.passivePerceptionOf(h)));                    // с поправками пассивок (плохое зрение землекопа −5)
    for (const t of S.objs) if (t.kind === "trap" && t.hidden && bestPerc >= t.dc) t.hidden = false;
    // скрытные монстры пытаются спрятаться
    for (const m of B.mons()) {
      const pr = m.ai || {}; if (!pr.hide && !m.coverHide) continue;
      const spot = B.hideSpot(m); if (!spot && !pr.still) continue;
      const adv = (m.pass.includes("skeleton-archer") ? 1 : 0), a = d(20), b = adv ? d(20) : 0;
      const stealth = Math.max(a, b) + amod(m.abil.dex) + (m.skills.stealth || 0);
      if (stealth >= bestPerc) { addStatus(m, "hidden", { k: Infinity, data: { unseen: true, dc: stealth } }); }                // героям не виден, пока его не заметят
    }
    S.initialMons = B.mons().length;
  }

  /* ===== спасброски от смерти ===== */
  async function deathSaveTurn(u) {
    if (has(u, "stable")) return;
    const ses = B.session(u, { kind: "save", u, title: "Спасбросок от смерти", sub: `${u.name}: ${u.deathSaves.ok} успехов, ${u.deathSaves.fail} провалов`, death: true });
    const au = B.auraSave(u, "death");                                                // аура союзника (+1 «Под защитой духов») действует и на спасбросок от смерти
    const r = await ses.d20({ label: "Спасбросок от смерти", mods: au.mods, adv: au.adv, dis: au.dis, vs: { dc: 10 }, reroll: B.rerollOptions(u, "save"), cancel: false, death: true });
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
      if (ui()) snapshot(S);                                                                    // автосохранение: в начале каждого хода
      await B.startTurn(u);
      if (u.side === "hero") spotHidden(u);                                                  // враги, затаившиеся в начале боя
      else if (B.isUnseen(u)) reveal(u);                                                     // начал действовать — виден
      if (alive(u)) {
        const g = ui(); if (g) await g.turnStart(u);
        if (u.side === "hero" && !u.summon) {
          if (u.down) { if (!u.dead) await deathSaveTurn(u); }
          else if (!B.canAct(u)) log(`${u.name} не может действовать.`);
          else if (B.S.opts.autoHeroes || !g) await B.AI.takeTurn(u);
          else await g.heroTurn(u);
        } else if (u.side === "hero" && u.summon && g && !B.S.opts.autoHeroes && B.canAct(u)) await g.heroTurn(u);          // волки и двойники героя: за них играет игрок
        else if (B.canAct(u)) await B.AI.takeTurn(u);
        await B.endTurn(u);
        if (g) g.turnEnd(u);
      }
      const out = B.checkEnd(); if (out) break;
      B.advanceTurn();
      await sleep(180);
    }
    if (!S.outcome) S.outcome = "flee";
  }

  /* ===== автосохранение боя: снимок в начале каждого хода, возврат после перезагрузки страницы ===== */
  function snapshot(S) {
    try {
      const strip = (k, v) => (k === "hero" ? (v && v.id) : typeof v === "function" ? undefined : v);
      const ev = JSON.parse(JSON.stringify(S.ev)), body = JSON.parse(JSON.stringify(S, (k, v) => (k === "ev" ? undefined : strip(k, v))));
      state.fightSnap = { ev, S: body, at: Date.now() }; saveChar();
    } catch (e) { /* без снимка бой идёт как обычно */ }
  }
  B.snapshot = snapshot;
  B.resume = async function (ev, S) {
    if (B.running) return;
    B.running = true; ev.battleStarted = true; S.ev = ev;
    try {
      let maxId = 0;
      for (const u of S.units) { if (typeof u.hero === "string") u.hero = (state.party || []).find(c => c.id === u.hero) || null; const m = /^u(\d+)$/.exec(u.id); if (m) maxId = Math.max(maxId, +m[1]); }
      B.setUid(maxId + 1); B.S = S;
      if (B.UI) B.UI.open();
      const g = ui(); S.phase = "fight"; S.hideMons = false;
      if (g) await g.start(S);
      log("Бой восстановлен после перезагрузки.", "round");
      await loop(S);
      S.phase = "result";
      await B.End.run(S);
    } catch (err) {
      console.error("бой (возврат):", err);
      try { if (B.UI) B.UI.close(); } catch (e) {}
      B.running = false; B.S = null; state.fightSnap = null; ev.tactical = false; ev.battleStarted = false; toast("Бой не удалось восстановить — открыт обычный экран"); rerender();
    }
  };

  /* ===== запуск ===== */
  async function start(ev, o = {}) {
    const S = B.newBattle(ev);
    const g = ui();
    if (o.sim || !g) { placeHeroesDefault(S); placeMonsters(S); placeCoverMonsters(S); }
    else { placeHeroesDefault(S); await g.placement(S); placeMonsters(S); placeCoverMonsters(S); }
    preStart(S);                                                                                   // затаившиеся враги выбираются до показа поля, чтобы не выдать их
    if (g && !(o.sim || !g)) await g.reveal(S);
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
    if (typeof autoSave === "function") autoSave("перед боем");
    (async () => {
      try {
        if (B.UI) B.UI.open();
        const S = await start(ev);
        if (S.outcome === "abort") {
          state.fightSnap = null;         // игрок перешёл на обычный экран боя
          B.End.cleanup(S, "abort");
          if (B.UI) B.UI.close();
          B.running = false; B.S = null; ev.battleStarted = false; ev.tactical = false; ev.killed = S.killed.slice();
          toast("Бой перенесён на обычный экран"); rerender(); return;
        }
        await B.End.run(S);                 // экран итога и наград, затем возврат результата приложению
      } catch (err) {
        console.error("бой:", err); state.fightSnap = null;
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
