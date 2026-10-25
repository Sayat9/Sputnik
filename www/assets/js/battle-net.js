/* Тактический бой онлайн (черновик, docs/multiplayer.md). Ведущий водит бой, герои друзей ходят на их телефонах:
   - ход героя друга: ведущий отдаёт снимок боя игроку (RPC "turn"), тот играет ход обычным интерфейсом и возвращает снимок;
     пока идёт ход, игрок шлёт ведущему снимки ("bat"), так что при обрыве связи ход продолжится с того же места;
   - броски героя друга на чужих ходах (спасброски и т. п.) и реакции — RPC "dice" и "react" на его телефон;
   - остальные игроки и ведущий видят бой зеркалом (снимок приходит вместе с обычным состоянием игры). */
(function () {
  const B = window.Battle; let N = window.Net;
  const BN = B.Net = { turnActive: false, mirroring: false, active: null };
  const hostOn = () => !!(N && N.role === "host");
  const clientOn = () => !!(N && N.role === "client" && typeof isMaster === "function" && !isMaster());
  BN.isClient = clientOn; BN.isHost = hostOn;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const heroOf = u => (u && u.hero) || (u && u.summon && u.owner && (B.byId(u.owner) || {}).hero) || null;
  const ownerPid = u => { const h = heroOf(u); return (h && h.owner) || null; };
  const myPid = () => (N && N.pid && N.pid()) || null;
  const light = u => (u ? { id: u.id, face: u.face, name: u.name } : null);
  const ownHeroes = () => (state.party || []).filter(c => c.owner && c.owner === myPid());
  const heroesOf = pid => (state.party || []).filter(c => c.owner === pid);
  const mergeHeroes = list => {
    for (const h of list || []) { const cur = (state.party || []).find(c => c.id === h.id); if (!cur) continue; const nseq = Math.max(cur.nseq || 0, h.nseq || 0) + 1; for (const k of Object.keys(cur)) delete cur[k]; Object.assign(cur, JSON.parse(JSON.stringify(h)), { nseq }); }
  };

  /* ===== кто бросает и принимает решения ===== */
  B.netCtl = u => {
    if (!B.S || u.side !== "hero" || u.summon) return null;
    if (hostOn()) { const pid = ownerPid(u); if (!pid || B.S.opts.autoHeroes) return null; const p = N.players[pid]; return p && p.online ? "remote" : "auto"; }
    if (clientOn()) { const h = u.hero; return h && h.owner && h.owner === myPid() ? "ui" : "auto"; }
    return null;
  };
  BN.remoteOwner = u => { if (!hostOn() || !B.S || B.S.opts.autoHeroes) return null; const pid = ownerPid(u); return pid && N.players[pid] ? pid : null; };

  /* ===== ведущий ===== */
  const pushNow = () => { try { window.NetGlue && NetGlue.pushAll(true); } catch (e) {} };
  const waitOnline = pid => new Promise(res => { const off = N.on((ev, d) => { if (ev === "player" && d && d.pid === pid && d.online) { off(); res("back"); } }); });
  async function waitOrTakeover(u, pid, what) {
    const g = ui(), p = N.players[pid], back = waitOnline(pid);
    if (!g) return back;
    g.banner(`Ждём игрока ${p ? p.name : ""}: ${what || "герой"} ${u.name}`, 3000);
    const ask = (async () => {
      for (;;) {
        const r = await g.choose({ title: `Нет связи с игроком ${p ? p.name : ""}`, options: [{ id: "take", label: `Взять ${u.name} под управление` }, { id: "skip", label: what ? "Оставить как стоит" : "Пропустить ход" }, { id: "wait", label: "Ждать возвращения" }] });
        if (r === "take" || r === "skip") return r;
        if (r === "wait") return new Promise(() => {});
      }
    })();
    const r = await Promise.race([back, ask]);
    if (r === "back") { const m = g.root && g.root().querySelector(".bt-modal"); if (m) { m.hidden = true; m.innerHTML = ""; } }
    return r;
  }
  BN.remoteTurn = async function (u) {
    const S = B.S, pid = ownerPid(u); BN.active = pid;
    try {
      for (;;) {
        const p = N.players[pid];
        if (!(p && p.online)) {
          const r = await waitOrTakeover(u, pid);
          if (r === "take") { await ui().heroTurn(u); return; }
          if (r === "skip") return;
        }
        if (S.outcome) return;
        try {
          pushNow();
          const res = await N.callPlayer(pid, "turn", { snap: B.ser(S), ev: S.ev, unit: u.id, heroes: heroesOf(pid) }, 0);
          mergeHeroes(res.heroes); B.restoreInto(S, res.snap); if (ui()) ui().refreshNow();
          return;
        } catch (e) { /* связь оборвалась посреди хода: ждём игрока и продолжаем с последнего снимка */ }
      }
    } finally { BN.active = null; }
  };
  // Расстановка по очереди инициативы: герой друга ставится на его телефоне («Готово» передаёт очередь), свои — у ведущего.
  BN.onlinePlacement = () => !!(hostOn() && ui() && Object.values(N.players).some(p => p.online && (state.party || []).some(c => c.owner === p.pid && !c.dead)));
  BN.placeInOrder = async function (S) {
    S.phase = "place"; S.hideMons = true;
    const order = S.order.map(id => B.byId(id)).filter(u => u && u.side === "hero" && !u.summon && !u.dead);
    for (const u of order) {
      S.placing = u.id;
      const pid = ownerPid(u);
      if (!pid || S.opts.autoHeroes) { pushNow(); await ui().placeOne(u); continue; }
      BN.active = pid;
      try {
        for (;;) {
          const p = N.players[pid];
          if (!(p && p.online)) {
            const r = await waitOrTakeover(u, pid, "расстановка");
            if (r === "take") { await ui().placeOne(u); break; }
            if (r === "skip") break;
          }
          try {
            pushNow();
            const res = await N.callPlayer(pid, "place", { snap: B.ser(S), ev: S.ev, unit: u.id }, 0);
            if (res && res.pos) { u.x = res.pos[0]; u.y = res.pos[1]; }
            break;
          } catch (e) { /* игрок отвалился: ждём и повторяем */ }
        }
      } finally { BN.active = null; }
      if (ui()) ui().refreshNow();
    }
    S.placing = null; S.phase = "init";
    if (ui()) { ui().mode = "idle"; ui().setHl(new Map()); ui().refreshNow(); }
  };
  // Бросок героя друга на чужом ходу: окно кубиков на его телефоне; нет связи — бросает игра.
  BN.remoteSession = function (u, meta, autoSession) {
    const pid = ownerPid(u), sid = N.rid(6), fallback = autoSession(u, meta);
    let broken = false;
    const lm = { kind: meta.kind, title: meta.title, sub: meta.sub, anim: meta.anim, death: meta.death, att: light(meta.att), tgt: light(meta.tgt) };
    const call = async (op, o) => { if (broken) throw new Error("fallback"); try { return await N.callPlayer(pid, "dice", { sid, op, u: u.id, meta: lm, o }, 0); } catch (e) { broken = true; throw e; } };
    const roll = async (op, o) => {
      const rr = (o.reroll || []).slice(), o2 = { ...o, reroll: rr.map(x => ({ id: x.id, label: x.label })) };
      try {
        const res = await call(op, o2); if (!res.r) return null;
        for (let i = 0; i < res.used; i++) if (rr[i] && rr[i].spend) rr[i].spend();
        return Object.assign(res.r, { auto: false });
      } catch (e) { return fallback[op]({ ...o, reroll: [] }); }
    };
    return {
      auto: false,
      d20: o => roll("d20", o), dice: o => roll("dice", o), note() {},
      async finish(o = {}) { if (broken) return fallback.finish(o); try { await call("finish", { ...o, tgt: undefined }); } catch (e) { return fallback.finish(o); } },
      close() { if (!broken) call("close", {}).catch(() => {}); },
    };
  };
  BN.remoteReact = async function (u, o) {
    const pid = ownerPid(u);
    try { return !!(await N.callPlayer(pid, "react", { title: o.title, text: o.text, yes: o.yes, no: o.no }, 0)); } catch (e) { return false; }
  };
  /* ===== общий канал «видно всем»: броски, сводки спасбросков, итог боя ===== */
  const relay = (msg, except) => { for (const p of Object.values(N.players)) if (p.link && p.pid !== except) p.link.send("watch", msg); };
  BN.ownerPid = ownerPid;
  BN.emit = (msg, except) => { try { if (hostOn()) { relay(msg, except); if (except) BN.show(msg); } else if (clientOn()) N.toHost("watch", msg); } catch (e) {} };
  // Обёртка сессии броска: что бросает любой участник — видят все остальные (без КД монстров).
  BN.watch = function (u, meta, ses) {
    if (!ses || !(hostOn() || clientOn())) return ses;
    const sid = N.rid(5), ex = hostOn() ? ownerPid(u) : null;
    const send = m => BN.emit({ sid, who: u.name, side: u.side, title: meta.title, sub: meta.sub, ...m }, ex);
    const out = Object.assign({}, ses);
    out.d20 = async o => { send({ k: "start", label: o.label }); const r = await ses.d20(o); if (r) send({ k: "res", total: r.total, nat: r.nat, label: o.label }); return r; };
    out.dice = async o => { send({ k: "start", label: o.label }); const r = await ses.dice(o); if (r) send({ k: "res", total: r.total, label: o.label }); return r; };
    out.finish = async o => { const r = await ses.finish(o); send({ k: "fin", text: o && o.text, ok: o && o.ok }); return r; };
    out.close = () => { try { ses.close(); } finally { send({ k: "end" }); } };
    return out;
  };
  let wEl = null, wT = 0;
  function watchBox() {
    if (wEl && document.body.contains(wEl)) return wEl;
    wEl = document.createElement("div"); wEl.id = "bnwatch";
    wEl.style.cssText = "position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:9300;width:min(92vw,360px);padding:10px 14px;border-radius:12px;background:rgba(20,14,8,.94);border:1px solid #6e5634;color:#f4e8cc;text-align:center;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.5);font:14px/1.35 inherit";
    document.body.appendChild(wEl); return wEl;
  }
  BN.show = function (m) {
    if (!m || !B.UI || !B.UI.active) return;
    if (m.k === "sum" || m.k === "sumend") return BN.showSum(m);
    if (m.k === "end") return;
    const el = watchBox(); el.hidden = false;
    const head = `<small style="opacity:.75">${m.side === "hero" ? "Герой" : "Враг"}: ${esc(m.who || "")}</small><br><b>${esc(m.title || "Бросок")}</b>${m.sub ? `<br><small>${esc(m.sub)}</small>` : ""}`;
    let body = "";
    if (m.k === "start") body = `<div style="margin-top:4px;opacity:.8">бросает кубики…</div>`;
    else if (m.k === "res") body = `<div style="margin-top:4px;font-size:26px;font-weight:700;color:#f4d48e">${m.total}</div>${m.nat != null && m.nat !== m.total ? `<small>на кубике ${m.nat}</small>` : ""}`;
    else if (m.k === "fin") body = `<div style="margin-top:4px;color:${m.ok === false ? "#e8a090" : "#b8e0a0"}">${esc(m.text || "")}</div>`;
    el.innerHTML = head + body;
    clearTimeout(wT); wT = setTimeout(() => { if (wEl) wEl.hidden = true; }, m.k === "start" ? 9000 : 3200);
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Сводка спасбросков: ведущий показывает всем; перебросить можно только за своего героя, и только на своём телефоне.
  const sums = {};
  BN.sumStart = (title, sub, rows, reroll) => {
    if (!hostOn()) return null;
    const sid = N.rid(5); sums[sid] = { title, sub, rows, reroll };
    relay({ k: "sum", sid, title, sub, rows: rows() }); return sid;
  };
  BN.sumUpdate = sid => { const s = sums[sid]; if (!s) return; const rs = s.rows(); relay({ k: "sum", sid, title: s.title, sub: s.sub, rows: rs }); if (B.UI && B.UI.sumRedraw) B.UI.sumRedraw(rs); };
  BN.sumEnd = sid => { if (sums[sid]) { delete sums[sid]; relay({ k: "sumend", sid }); } };
  BN.showSum = function (m) {
    let el = document.getElementById("bnsum");
    if (m.k === "sumend") { if (el) el.remove(); return; }
    if (!clientOn()) return;
    if (!el) { el = document.createElement("div"); el.id = "bnsum"; el.style.cssText = "position:fixed;inset:0;z-index:9400;display:flex;align-items:center;justify-content:center;background:rgba(8,6,4,.7);padding:14px"; document.body.appendChild(el);
      el.addEventListener("click", async e => {
        if (e.target.closest("[data-bs=close]")) { el.remove(); return; }
        const b = e.target.closest("[data-bs=rr]"); if (!b || b.disabled) return; b.disabled = true;
        try { await N.callHost("sumReroll", { sid: el.dataset.sid, i: +b.dataset.i }, 8000); } catch (err) { b.disabled = false; }
      }); }
    el.dataset.sid = m.sid; const me = myPid();
    el.innerHTML = `<div class="bt-dlg fx-frame" style="width:min(92vw,380px);padding:14px"><h4 style="margin:0 0 4px">${esc(m.title)}</h4><p style="margin:0 0 8px;opacity:.8">${esc(m.sub)}</p>
      <ul class="bt-sum" style="list-style:none;margin:0;padding:0;display:grid;gap:6px">${m.rows.map((r, i) => `<li class="${r.ok ? "ok" : "bad"}" style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span class="n">${esc(r.name)}</span><span class="v">${r.total}</span><b>${r.ok ? "устоял" : "провал"}</b>${r.owner && r.owner === me && r.rr ? `<button class="fx-btn" data-bs="rr" data-i="${i}">Перебросить</button>` : ""}</li>`).join("")}</ul>
      <div style="margin-top:10px"><button class="fx-btn" data-bs="close">Скрыть</button></div></div>`;
  };
  // Итог боя: ведущий присылает экран победы всем, у остальных он показывается, пока ведущий не закроет свой.
  BN.announceEnd = html => { if (hostOn()) relay({ k: "endscr", html }); };
  BN.endClose = () => { if (hostOn()) relay({ k: "endclose" }); };
  BN.showEnd = function (m) {
    let el = document.getElementById("bnend");
    if (m.k === "endclose") { if (el) el.remove(); return; }
    if (!clientOn()) return;
    if (!el) { el = document.createElement("div"); el.id = "bnend"; el.style.cssText = "position:fixed;inset:0;z-index:9450;display:flex;align-items:center;justify-content:center;background:rgba(8,6,4,.86);padding:14px;overflow:auto"; document.body.appendChild(el); el.addEventListener("click", e => { if (e.target.closest("[data-be=close]")) el.remove(); }); }
    el.innerHTML = m.html + `<div style="position:absolute;left:0;right:0;bottom:16px;text-align:center"><button class="fx-btn" data-be="close">Закрыть</button></div>`;
  };
  // Состояние боя для рассылки (подключается в netglue).
  BN.view = () => (B.S && B.running && (B.S.phase === "fight" || B.S.phase === "place") ? { bat: { ev: B.S.ev, S: B.ser(B.S) } } : { bat: null });

  /* ===== игрок ===== */
  async function ensureUi() {
    if (!B.S) return false;
    if (!B.UI.active) B.UI.open();
    if (!B.S.phase || B.S.phase === "init") B.S.phase = "fight";
    B.running = true;
    return true;
  }
  BN.mirror = async function (bat) {
    if (!clientOn() || BN.turnActive) return;
    if (!bat) { BN.mirrorEnd(); return; }
    const was = B.S && B.S.placing;
    if (!B.S || !BN.mirroring) { const S = { ev: bat.ev }; B.restoreInto(S, bat.S); B.S = S; BN.mirroring = true; await ensureUi(); B.UI.refreshNow(); }
    else { B.restoreInto(B.S, bat.S); B.running = true; if (!B.UI.active) await ensureUi(); B.UI.refreshNow(); }
    if (B.S.phase === "place" && B.S.placing && B.S.placing !== was) { const u = B.byId(B.S.placing); if (u) B.UI.banner(`Расставляет героя: ${u.name}`, 2200); }
  };
  BN.mirrorEnd = function () {
    if (!BN.mirroring && !BN.turnActive) return;
    BN.mirroring = false; try { if (B.UI && B.UI.active) B.UI.close(); } catch (e) {} B.S = null; B.running = false;
    if (typeof rerender === "function") rerender();
  };
  const stream = () => { if (BN.turnActive && B.S) N.toHost("bat", { snap: B.ser(B.S), heroes: ownHeroes() }); };
  let streamT = 0;
  BN.onRefresh = () => { if (!BN.turnActive || streamT) return; streamT = setTimeout(() => { streamT = 0; stream(); }, 450); };
  function mergeOwn(list) { for (const h of list || []) { const cur = (state.party || []).find(c => c.id === h.id); if (cur) { for (const k of Object.keys(cur)) delete cur[k]; Object.assign(cur, JSON.parse(JSON.stringify(h))); } } }

  // Сообщения: net.js может загрузиться позже файлов боя, поэтому регистрация отдельная и повторяемая.
  let registered = false;
  BN.register = function () {
    N = window.Net; if (!N || registered) return; registered = true;
    // Игрок во время хода присылает снимки: ведущий видит ход вживую и сохраняет его на случай обрыва.
    N.handle("watch", (d, link, p) => { if (hostOn()) { if (!p) return; relay(d, p.pid); BN.show(d); } else if (d && (d.k === "endscr" || d.k === "endclose")) BN.showEnd(d); else BN.show(d); });
    N.handle("sumReroll", (d, link, p) => {
      const s = hostOn() && d && sums[d.sid]; if (!s || !p) return { ok: false };
      const r = s.rows()[d.i]; if (!r || r.owner !== p.pid || !r.rr) return { ok: false };
      s.reroll(d.i); BN.sumUpdate(d.sid); return { ok: true };
    });
    N.handle("bat", (d, link, p) => {
      if (!hostOn() || !B.S || !p || BN.active !== p.pid) return;
      mergeHeroes(d.heroes); B.restoreInto(B.S, d.snap); if (ui()) ui().refresh();
    });
    N.handle("turn", async d => {
      BN.turnActive = true; BN.mirroring = true;
      try {
        mergeOwn(d.heroes);
        if (!B.S) B.S = { ev: d.ev };
        B.restoreInto(B.S, d.snap); B.S.ev = d.ev; await ensureUi();
        const u = B.byId(d.unit); if (!u) throw new Error("нет героя в бою");
        B.UI.refreshNow(); B.UI.banner(`Твой ход: ${u.name}`, 1400);
        await B.UI.heroTurn(u);
      } finally { BN.turnActive = false; }
      return { snap: B.ser(B.S), heroes: ownHeroes() };
    });
    // Расстановка: игрок ставит своего героя и нажимает «Готово».
    N.handle("place", async d => {
      BN.turnActive = true; BN.mirroring = true;
      try {
        if (!B.S) B.S = { ev: d.ev };
        B.restoreInto(B.S, d.snap); B.S.ev = d.ev; await ensureUi();
        const u = B.byId(d.unit); if (!u) throw new Error("нет героя в бою");
        await B.UI.placeOne(u);
        return { pos: [u.x, u.y] };
      } finally { BN.turnActive = false; }
    });
    const sess = {};
    N.handle("dice", async d => {
      if (!clientOn()) return null;
      if (!B.UI.active) { if (!B.S) return null; await ensureUi(); }
      let ses = sess[d.sid];
      if (!ses) { const u = B.byId(d.u) || { name: "", face: "" }; ses = sess[d.sid] = B.Dice.session(u, { ...d.meta, u }); }
      if (d.op === "d20" || d.op === "dice") {
        let used = 0; const rr = (d.o.reroll || []).map(x => ({ id: x.id, label: x.label, spend() { used++; } }));
        const r = await ses[d.op]({ ...d.o, reroll: rr });
        return { r: r || null, used };
      }
      if (d.op === "finish") { delete sess[d.sid]; await ses.finish({ ...d.o, tgt: d.meta.tgt }); return {}; }
      if (d.op === "close") { delete sess[d.sid]; ses.close(); return {}; }
      return {};
    });
    N.handle("react", async d => { if (!B.UI.active) { if (!B.S) return false; await ensureUi(); } return !!(await B.UI.promptReaction(d)); });
  };
  BN.register();
})();
