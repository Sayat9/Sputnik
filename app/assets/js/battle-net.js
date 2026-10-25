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
  async function waitOrTakeover(u, pid) {
    const g = ui(), p = N.players[pid], back = waitOnline(pid);
    if (!g) return back;
    g.banner(`Ждём игрока ${p ? p.name : ""}: герой ${u.name}`, 3000);
    const ask = (async () => {
      for (;;) {
        const r = await g.choose({ title: `Нет связи с игроком ${p ? p.name : ""}`, options: [{ id: "take", label: `Взять ${u.name} под управление` }, { id: "skip", label: "Пропустить ход" }, { id: "wait", label: "Ждать возвращения" }] });
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
  // Состояние боя для рассылки (подключается в netglue).
  BN.view = () => (B.S && B.running && B.S.phase === "fight" ? { bat: { ev: B.S.ev, S: B.ser(B.S) } } : { bat: null });

  /* ===== игрок ===== */
  async function ensureUi() {
    if (!B.S) return false;
    if (!B.UI.active) B.UI.open();
    B.S.phase = "fight"; B.S.hideMons = false; B.running = true;
    return true;
  }
  BN.mirror = async function (bat) {
    if (!clientOn() || BN.turnActive) return;
    if (!bat) { BN.mirrorEnd(); return; }
    if (!B.S || !BN.mirroring) { const S = { ev: bat.ev }; B.restoreInto(S, bat.S); B.S = S; BN.mirroring = true; await ensureUi(); B.UI.refreshNow(); }
    else { B.restoreInto(B.S, bat.S); B.running = true; if (!B.UI.active) await ensureUi(); B.UI.refreshNow(); }
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
