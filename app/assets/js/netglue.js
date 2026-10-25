/* Онлайн: игровая часть — ведущий (комната, игроки, рассылка состояния) и клиент игрока (зеркало экранов, свои герои, меню).
   Транспорт — assets/js/net.js. Схема и решения — docs/multiplayer.md. Здесь же ограничения клиента: он ничего не меняет в игре, кроме своих героев и боя. */
(function () {
  const N = window.Net;
  const G = window.NetGlue = { ready: false, follow: true, view: {}, hostPanel: false };
  const jstr = JSON.stringify;
  const PLAYER_KEY = "sputnik.net.v1", HOST_KEY = "sputnik.nethost.v1";
  const SKIP = new Set(["sessions", "example", "current", "runSnap", "fightSnap", "settings", "lastHash", "saves", "net"]);
  const GAME_HASH = ["", "town", "labyrinth"];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const q = new URLSearchParams(location.search);
  if (q.get("net") === "loopback") N.transport = "loopback";
  const battleOn = () => !!(window.Battle && window.Battle.running);
  const heroById = id => (state.party || []).find(c => c.id === id);
  const noSeq = c => jstr({ ...c, nseq: 0, force: 0 });

  /* ===== стили ===== */
  const css = document.createElement("style");
  css.textContent = `
  #netov,#netjoin,#netmap,#netheroes{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(8,6,4,.86);padding:14px;overflow:auto}
  #netov[hidden],#netjoin[hidden],#netmap[hidden],#netheroes[hidden]{display:none}
  .net-panel{width:min(94vw,440px);max-height:92vh;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
  .net-panel h3{margin:0;font-family:"Kelly Slab",Georgia,serif;color:var(--fx-gold-hi,#f4d48e)}
  .net-code{font:700 40px/1 "Kelly Slab",Georgia,serif;letter-spacing:6px;text-align:center;color:var(--fx-gold-hi,#f4d48e);padding:8px 0}
  .net-row{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(214,166,76,.18)}
  .net-dot{width:10px;height:10px;border-radius:50%;background:#777;display:inline-block;margin-right:6px}.net-dot.on{background:#7bc653}
  .net-panel input,.net-panel select{width:100%;padding:10px;border-radius:8px;border:1px solid #6e5634;background:#1a140d;color:#f4e8cc;font:inherit}
  .net-msg{min-height:1.2em;font-size:13px;opacity:.85}
  #netbar{position:fixed;left:0;right:0;bottom:0;z-index:8500;display:flex;gap:4px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:linear-gradient(#1a140d,#0f0b07);border-top:1px solid #6e5634}
  #netbar button{flex:1;min-width:0;padding:12px 4px;font-size:14px;white-space:nowrap}
  #netbar button[data-nb="more"]{flex:0 0 56px;font-size:20px;line-height:1}
  #netbar .st{position:absolute;right:8px;top:-18px;font-size:11px;padding:1px 8px;border-radius:9px;background:#2a1f12;color:#f4d48e;border:1px solid #6e5634}
  body.net-player nav.tabs,body.net-player #dice-fab{display:none!important}
  body.net-player{padding-bottom:64px}
  body.net-player.bt-active #netbar,body.net-player.net-forge #netbar{display:none}
  body.net-follow #view,body.net-follow #townov{pointer-events:none}
  body.net-follow #townov .tw-x{display:none}
  .net-team{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%;margin:10px 0}
  .net-team .pc{min-width:0;width:auto}
  .net-hcard{display:flex;flex-direction:column;gap:4px;min-width:0}
  .net-owner{font-size:12px;color:#c9b88f;text-align:center}.net-owner.me{color:#f4d48e;font-weight:700}
  .net-players{width:100%;max-width:420px;margin:6px auto}.net-players .net-row small{opacity:.75;text-align:right}
  .net-chip{position:fixed;top:6px;right:8px;z-index:8400;font-size:11px;padding:2px 9px;border-radius:9px;background:#2a1f12;color:#f4d48e;border:1px solid #6e5634;opacity:.9}
  .net-ro-note{font-size:12px;opacity:.7;text-align:center}
  `;
  document.head.appendChild(css);
  const mkOv = (id, hidden = true) => { let el = document.getElementById(id); if (!el) { el = document.createElement("div"); el.id = id; el.hidden = hidden; document.body.appendChild(el); } return el; };

  /* ===================================================================== ведущий ===== */
  const H = G.host = { cache: {}, lastJ: {}, timer: null, last: 0 };
  H.on = () => N.role === "host";
  function trackHeroes(lastJ) {
    for (const c of state.party || []) {
      const j = noSeq(c);
      if (lastJ[c.id] !== undefined && lastJ[c.id] !== j) c.nseq = (c.nseq || 0) + 1;                // герой изменился на этой стороне — версия растёт
      lastJ[c.id] = j;
    }
  }
  function buildView() {
    trackHeroes(H.lastJ);
    const v = { ids: (state.party || []).map(c => c.id), dgUi: dgUi, hash: location.hash.slice(1), rev: Date.now() };
    for (const c of state.party || []) v["h:" + c.id] = c;
    for (const k of Object.keys(state)) if (!SKIP.has(k) && k !== "party") v["s:" + k] = state[k];
    v.town = window.Town && window.Town.state && window.Town.state() ? window.Town.state() : null;
    v.battle = battleOn();
    v.players = Object.values(N.players).map(p => ({ pid: p.pid, name: p.name, online: !!p.online }));
    if (window.Battle && Battle.Net) Object.assign(v, Battle.Net.view());
    return v;
  }
  function pushAll(force) {
    if (!H.on()) return;
    const players = Object.values(N.players).filter(p => p.online && p.link);
    const v = buildView(), next = {};
    for (const k of Object.keys(v)) next[k] = k === "rev" ? "" : jstr(v[k]);
    if (!players.length) { H.cache = next; return; }
    for (const p of players) {
      const sent = (p.sent ||= {}), set = {}, del = [];
      for (const k of Object.keys(next)) if (k !== "rev" && sent[k] !== next[k]) set[k] = v[k];
      for (const k of Object.keys(sent)) if (!(k in next)) del.push(k);
      if (!Object.keys(set).length && !del.length && !force) continue;
      if (p.link.send("view", { set, del })) { for (const k of Object.keys(set)) sent[k] = next[k]; for (const k of del) delete sent[k]; }
    }
    H.cache = next;
  }
  G.pushAll = pushAll;
  const schedule = () => { if (!H.on() || H.timer) return; H.timer = setTimeout(() => { H.timer = null; pushAll(); }, 120); };
  G.schedule = schedule;

  function adoptHero(h, p) {
    if (!h || !h.id || h.owner !== p.pid) return false;
    if (battleOn()) return false;
    const cur = heroById(h.id);
    if (!cur) { state.party.push(h); H.lastJ[h.id] = noSeq(h); toast(`Герой «${h.name}» вернулся от игрока ${p.name}`); saveChar(); return true; }
    if ((h.nseq || 0) > (cur.nseq || 0)) { for (const k of Object.keys(cur)) delete cur[k]; Object.assign(cur, h); H.lastJ[h.id] = noSeq(cur); saveChar(); return true; }
    return false;
  }
  function setupHostHandlers() {
    N.handle("hello", (d, link) => {
      const p = N.bind(link, d.pid || N.newPid(), String(d.name || "Игрок").slice(0, 24));
      for (const h of d.heroes || []) adoptHero(h, p);
      p.sent = {};
      setTimeout(() => pushAll(true), 40);
      renderHostPanel();
      return { pid: p.pid, code: N.code, name: p.name };
    });
    N.handle("heroPush", (d, link, p) => {
      if (!p) return { ok: false };
      const ok = adoptHero(d.hero, p);
      if (!ok) { const cur = d.hero && heroById(d.hero.id); if (cur) p.link.send("view", { set: { ["h:" + cur.id]: { ...cur, force: 1 } }, del: [] }); }
      else schedule();
      return { ok };
    });
    // Игрок создал героя: ведущий проверяет и добавляет в отряд (по одному живому герою на игрока).
    N.handle("createHero", (d, link, p) => {
      const c = d && d.hero; if (!p || !c || !c.name || !raceById(c.race) || !c.base) return { ok: false, why: "неверные данные" };
      if (battleOn()) return { ok: false, why: "идёт бой" };
      if ((state.party || []).some(x => x.owner === p.pid && !x.dead)) return { ok: false, why: "у тебя уже есть герой" };
      if ((state.party || []).some(x => x.id === c.id)) c.id = "c" + Date.now().toString(36) + N.rid(2);
      c.owner = p.pid; c.level = 1; c.nseq = 1; c.example = false; c.dead = false;
      for (const k of ["str", "dex", "con", "int", "wis", "cha"]) c.base[k] = Math.max(1, Math.min(30, parseInt(c.base[k], 10) || 10));
      try { ensureKit(c); } catch (e) {}
      c.hp = maxHp(c); c.mp = maxMp(c);
      state.party.push(c); const last = (state.sessions || [])[state.sessions.length - 1]; if (last && last.members) last.members.push(c.id);
      saveChar(); schedule(); toast(`Игрок ${p.name} создал героя «${c.name}»`);
      renderHostPanel();
      try { if (forge && forge.open && forge.step === "team") renderForge(true); else if (!location.hash.slice(1)) rerender(); } catch (e) {}          // ведущий сразу видит нового героя в отряде
      return { ok: true, id: c.id };
    });
    N.handle("bye", (d, link, p) => { if (p) { p.link = null; p.online = false; } renderHostPanel(); });
  }
  G.startHost = async function () {
    if (H.on()) return N.code;
    setupHostHandlers();
    try { if (await loadBattle() && Battle.Net) Battle.Net.register(); } catch (e) {}
    const stored = lsGet(HOST_KEY);
    const code = await N.startHost(stored && stored.code ? { code: stored.code } : {});
    lsSet(HOST_KEY, { code });
    clearInterval(H.poll); H.poll = setInterval(() => pushAll(), 400);
    renderHostPanel(); updateChip();
    return code;
  };
  G.stopHost = function () { clearInterval(H.poll); N.stopHost(); renderHostPanel(); updateChip(); };
  N.on((ev, d) => { if (ev === "codechanged") toast("Прошлый код комнаты ещё занят на сервере: новый код — " + d); });
  N.on((ev, d) => { if (ev === "player") { renderHostPanel(); updateChip(); if (d && d.online) schedule(); } });

  // Хуки: любое сохранение или перерисовка — пора рассылать состояние.
  const _save = window.saveChar;
  window.saveChar = function () { const r = _save.apply(this, arguments); try { if (H.on()) schedule(); else if (!isMaster()) afterClientSave(); } catch (e) { console.error(e); } return r; };

  function renderHostPanel() {
    const ov = mkOv("netov"); if (!G.hostPanel) { ov.hidden = true; return; }
    const hosting = H.on(), players = Object.values(N.players);
    let body;
    if (!hosting) {
      const st = lsGet(HOST_KEY);
      body = `<p>Друзья подключаются к твоей партии по коду комнаты. Ты ведёшь игру, они видят экран, играют только в бою и смотрят карту, справочник и своих героев. Решения — в Discord.</p>
        <p class="net-msg">${st && st.code ? "Код прошлой комнаты сохранится: " + esc(st.code) + " (игроки переподключатся сами)." : ""}</p>
        <button class="fx-btn primary big" data-nx="start">Создать комнату</button><button class="fx-btn" data-nx="close">Закрыть</button>`;
    } else {
      body = `<div class="fx-eyebrow">Код комнаты</div><div class="net-code" id="net-code">${esc(N.code)}</div>
        <button class="fx-btn" data-nx="copy">Скопировать код</button>
        <div class="fx-section">Игроки</div>
        ${players.length ? players.map(p => `<div class="net-row"><span><i class="net-dot${p.online ? " on" : ""}"></i>${esc(p.name)}</span><small>${p.online ? "в сети" : "не в сети"}</small></div>`).join("") : `<p class="net-msg">Пока никого нет. Отправь код друзьям: они вводят его в клиенте «Спутник — Игрок».</p>`}
        <div class="fx-section">Герои и игроки</div>
        ${(state.party || []).length ? state.party.map(c => `<div class="net-row"><span>${esc(c.name)}</span><select data-nx="own" data-id="${c.id}" aria-label="Чей герой ${esc(c.name)}"><option value="">Ведущий</option>${players.map(p => `<option value="${p.pid}"${c.owner === p.pid ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>`).join("") : `<p class="net-msg">В отряде нет героев.</p>`}
        <p class="net-ro-note">Герой игрока хранится и у него: при подключении ведущий забирает его сохранение.</p>
        <button class="fx-btn danger" data-nx="stop">Закрыть комнату</button><button class="fx-btn" data-nx="close">Скрыть окно</button>`;
    }
    ov.hidden = false;
    ov.innerHTML = `<div class="net-panel fx-frame"><h3>Онлайн-игра</h3>${body}</div>`;
  }
  G.openHostPanel = function () { G.hostPanel = true; renderHostPanel(); };
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-nx]"); if (!el || !el.closest("#netov")) return;
    const a = el.dataset.nx;
    if (a === "close") { G.hostPanel = false; renderHostPanel(); }
    else if (a === "start") { el.disabled = true; toast("Создаю комнату…"); try { await G.startHost(); } catch (err) { toast("Не удалось создать комнату: " + (err && err.message || err)); renderHostPanel(); } }
    else if (a === "stop") { G.stopHost(); }
    else if (a === "copy") { try { await navigator.clipboard.writeText(N.code); toast("Код скопирован"); } catch (err) { toast("Код: " + N.code); } }
  });
  document.addEventListener("change", e => {
    const el = e.target.closest("[data-nx='own']"); if (!el) return;
    const c = heroById(el.dataset.id); if (!c) return;
    if (el.value) c.owner = el.value; else delete c.owner;
    saveChar(); schedule(); renderHostPanel();
  });
  function updateChip() {
    let el = document.getElementById("net-chip");
    if (!H.on()) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("button"); el.id = "net-chip"; el.className = "net-chip"; el.onclick = () => G.openHostPanel(); document.body.appendChild(el); }
    const on = Object.values(N.players).filter(p => p.online).length;
    el.textContent = `Онлайн ${N.code} · ${on}`;
  }

  /* ===================================================================== игрок ===== */
  const C = G.client = { lastJ: {}, applyT: null, msg: "" };
  const myPid = () => N.pid();
  const ownHeroes = () => (state.party || []).filter(c => c.owner && c.owner === myPid());
  G.isMine = c => !!(c && c.owner && c.owner === myPid());

  G.initPlayer = function () {
    document.body.classList.add("net-player", "net-follow");
    buildBar(); buildJoin();
    N.handle("view", d => { applyPatch(d); });
    N.on((ev, d) => {
      if (ev === "status") { updateBar(); if (d === "online") hideJoin(); else if (d === "reconnecting" || d === "off") goOffline(); }
      if (ev === "welcome" && d && d.pid) { const cr = lsGet(PLAYER_KEY) || {}; cr.pid = d.pid; lsSet(PLAYER_KEY, cr); C.msg = ""; }
      if (ev === "joinerror") { C.msg = "Нет связи: " + d; updateJoinMsg(); }
    });
    loadBattle().then(ok => { if (ok && Battle.Net) Battle.Net.register(); });                                                                      // файлы боя нужны, чтобы видеть бой и играть свои ходы
    const cr = lsGet(PLAYER_KEY);
    if (cr && cr.code) connect(cr.code, cr.name, cr.pid);
    else showJoin();
  };
  function connect(code, name, pid) {
    lsSet(PLAYER_KEY, { code: code.toUpperCase(), name, pid });
    N.join(code, name, pid, () => ({ heroes: ownHeroes() }));
    updateBar();
  }
  G.submitHero = async function (c) {
    try {
      const r = await N.callHost("createHero", { hero: c }, 15000);
      toast(r && r.ok ? `Герой «${c.name}» создан` : `Герой не создан: ${(r && r.why) || "ведущий отказал"}`);
      onBar("game");
    } catch (e) { toast("Нет связи с ведущим: герой не создан"); }
  };
  G.canCreate = () => !(state.party || []).some(c => c.owner && c.owner === myPid() && !c.dead);
  function afterClientSave() {
    const mine = ownHeroes(); if (!mine.length || battleOn()) return;
    for (const c of mine) {
      const j = noSeq(c);
      if (C.lastJ[c.id] !== undefined && C.lastJ[c.id] !== j) { c.nseq = (c.nseq || 0) + 1; N.toHost("heroPush", { hero: c }); }
      C.lastJ[c.id] = j;
    }
  }

  /* ---- разбор присланного ---- */
  function applyPatch(d) {
    for (const k of Object.keys(d.set || {})) G.view[k] = d.set[k];
    for (const k of d.del || []) delete G.view[k];
    if (!C.applyT) C.applyT = setTimeout(() => { C.applyT = null; try { applyView(); } catch (e) { console.error("net view:", e); } }, 60);
  }
  G.applyPatch = applyPatch;
  function applyView() {
    const V = G.view, pid = myPid(), old = new Map((state.party || []).map(c => [c.id, c]));
    const party = [];
    for (const id of V.ids || []) {
      const inc = V["h:" + id]; if (!inc) continue;
      const mine = old.get(id);
      const inBat = !!(window.Battle && Battle.Net && Battle.Net.turnActive);
      if (mine && pid && mine.owner === pid && (inBat || ((mine.nseq || 0) > (inc.nseq || 0) && !inc.force))) { party.push(mine); continue; }          // мой герой новее — оставляю свой (он уйдёт ведущему)
      const h = { ...inc }; delete h.force; party.push(h); C.lastJ[id] = noSeq(h);
    }
    const ns = { sessions: [], example: state.example, current: null, settings: state.settings || {}, party, lastHash: state.lastHash };
    for (const k of Object.keys(V)) if (k.startsWith("s:")) ns[k.slice(2)] = V[k];
    state = ns; char = curChar();
    if (V.dgUi) dgUi = V.dgUi;
    if (V.bat !== undefined && window.Battle && Battle.Net) Battle.Net.mirror(V.bat);
    else if (V.bat !== undefined && V.bat) loadBattle().then(ok => { if (ok && Battle.Net) Battle.Net.mirror(G.view.bat); });
    // экран: идём за ведущим
    if (!location.hash.slice(1)) { try { rerender(); } catch (e) {} }                                        // экран «Команда»: новый герой друга виден сразу
    if (G.follow) {
      const h = V.hash || "";
      if (GAME_HASH.includes(h) && location.hash.slice(1) !== h) location.hash = h; else if (GAME_HASH.includes(location.hash.slice(1))) rerender();
    } else if (!GAME_HASH.includes(location.hash.slice(1)) === false) { /* смотрит свой экран — основное не трогаем */ }
    if (heroUi) { try { renderHero(); } catch (e) {} }
    // здание города
    loadTown().then(ok => { if (!ok) return; if (V.town) window.Town.mirror(V.town); else window.Town.unmirror && window.Town.unmirror(); });
    try { localStorage.setItem(STATE_KEY, jstr(state)); } catch (e) {}
  }

  /* ---- окно команды: вместо главного меню у игрока ---- */
  G.teamScreen = function () {
    const players = G.view.players || [], nm = pid => (players.find(p => p.pid === pid) || {}).name;
    const heroesOf = pid => (state.party || []).filter(c => (pid ? c.owner === pid : !c.owner)).map(c => esc(c.name)).join(", ") || "героя нет";
    const cards = (state.party || []).map(c => {
      const st = state.run && state.run.status && state.run.status[c.id], card = st ? charBars(c) : townCard(c);
      const who = c.owner ? (nm(c.owner) || "игрок") : "Ведущий";
      return `<div class="net-hcard"><small class="net-owner${G.isMine(c) ? " me" : ""}">${esc(who)}${G.isMine(c) ? " · это ты" : ""}${c.dead ? " · погиб" : ""}</small>${card}</div>`;
    }).join("");
    return `<div class="fx-home"><div class="crest">${CREST}</div>
      <div class="fx-eyebrow">Комната ${esc(N.code || "")}</div><h2 class="fx-title">Команда</h2><div class="fx-rule"><span></span></div>
      <div class="net-players"><div class="net-row"><span><i class="net-dot on"></i>Ведущий</span><small>${heroesOf("")}</small></div>
        ${players.map(p => `<div class="net-row"><span><i class="net-dot${p.online ? " on" : ""}"></i>${esc(p.name)}${p.pid === myPid() ? " (ты)" : ""}</span><small>${p.online ? heroesOf(p.pid) : "не в сети"}</small></div>`).join("")}</div>
      ${cards ? `<div class="net-team">${cards}</div>` : `<p class="fx-hint">В отряде пока нет героев. Создай своего в разделе «Герои».</p>`}
      ${N.status === "online" ? `<p class="fx-hint" style="opacity:.7">Ждём, когда ведущий начнёт партию.</p>` : `<p class="fx-hint">Нет связи с ведущим. Здесь то, что твои герои уже знают и имеют.</p><button class="fx-btn primary" data-nj="open">Подключиться к комнате</button>`}</div>`;
  };

  /* ---- оболочка клиента ---- */
  function buildBar() {
    const bar = mkOv("netbar", false); bar.style = ""; bar.hidden = false;
    bar.innerHTML = `<span class="st" id="net-st"></span>
      <button class="fx-btn" data-nb="game">Игра</button><button class="fx-btn" data-nb="heroes">Герои</button><button class="fx-btn" data-nb="ref">Справочник</button><button class="fx-btn" data-nb="more" aria-label="Меню">≡</button>`;
    bar.addEventListener("click", e => { const b = e.target.closest("[data-nb]"); if (b) onBar(b.dataset.nb); });
    updateBar();
  }
  const STATUS_RU = { off: "не подключён", starting: "запуск", connecting: "подключаюсь…", reconnecting: "связь потеряна, переподключаюсь…", online: "в сети", hosting: "в сети" };
  function updateBar() {
    const el = document.getElementById("net-st"); if (el) el.textContent = STATUS_RU[N.status] || N.status;
    document.body.classList.toggle("net-follow", G.follow && N.status === "online");          // без связи экран не «чужой»: можно листать своё
  }
  // Без связи игрок видит свою команду, своих героев, справочник, библиотеку и карту — всё, что уже знает; игровые экраны ведущего недоступны.
  function goOffline() { G.follow = true; updateBar(); if (location.hash.slice(1) !== "") location.hash = ""; else rerender(); }
  function onBar(a) {
    if (a === "game") { G.follow = true; closeOv(); updateBar(); if (N.status !== "online") { goOffline(); return; } const h = G.view.hash || ""; if (location.hash.slice(1) !== h && GAME_HASH.includes(h)) location.hash = h; else rerender(); }
    else if (a === "ref") { G.follow = false; updateBar(); closeOv(); location.hash = "#ref"; }
    else if (a === "map") openMap();
    else if (a === "heroes") openHeroes();
    else if (a === "more") openMore();
  }
  const closeOv = () => { for (const id of ["netmap", "netheroes"]) { const el = document.getElementById(id); if (el) el.hidden = true; } };
  function openMap() {
    if (!state.run) { toast("Карты пока нет: отряд не в лабиринте"); return; }
    const inv = typeof invItem === "function" ? invItem("map") : null, minv = typeof invItem === "function" ? invItem("mmap") : null;
    const kind = minv && minv.owned ? "magic" : inv && inv.owned ? "plain" : null;
    if (!kind) { toast("У отряда нет карты этого этажа"); return; }
    const ov = mkOv("netmap"), old = dgUi.map;
    dgUi.map = kind; let html; try { html = floorMapOverlay(); } finally { dgUi.map = old; }
    ov.innerHTML = html.replace('data-dg="close-map"', 'data-nb="closeov"'); ov.hidden = false;
    ov.onclick = e => { if (e.target.closest("[data-nb='closeov']")) ov.hidden = true; };
  }
  function openHeroes() {
    const ov = mkOv("netheroes");
    const party = state.party || [];
    ov.innerHTML = `<div class="net-panel fx-frame"><h3>Герои</h3>${party.length ? party.map(c => `<div class="net-row"><button class="fx-btn" data-hero="${c.id}" style="flex:1;text-align:left">${esc(c.name)} · ${raceById(c.race).name} · ${c.level} ур.${G.isMine(c) ? " · мой" : ""}</button><small>${hpOf(c)}/${maxHp(c)}</small></div>`).join("") : `<p class="net-msg">Героев пока нет: ведущий ещё не назначил тебе героя.</p>`}
      ${G.canCreate() && N.status === "online" ? `<button class="fx-btn primary" data-nb="create">Создать своего героя</button>` : ""}
      <button class="fx-btn" data-nb="closeov">Закрыть</button></div>`;
    ov.hidden = false;
    ov.onclick = e => { if (e.target === ov || e.target.closest("[data-nb='closeov']")) ov.hidden = true; if (e.target.closest("[data-nb='create']")) { ov.hidden = true; if (battleOn()) { toast("Во время боя героев не создают"); return; } G.follow = false; document.body.classList.remove("net-follow"); openForge("race", "more"); } const b = e.target.closest("[data-hero]"); if (b) { ov.hidden = true; openHero(b.dataset.hero); } };
  }
  function openMore() {
    const ov = mkOv("netheroes"), cr = lsGet(PLAYER_KEY) || {};
    ov.innerHTML = `<div class="net-panel fx-frame"><h3>Связь</h3><p>Комната: <b>${esc(cr.code || "—")}</b> · ${esc(STATUS_RU[N.status] || N.status)}</p>
      ${APP_BUILD ? `<p class="net-ro-note">Версия от ${esc(APP_BUILD)}</p>` : ""}
      <button class="fx-btn" data-nb="map">Карта этажа</button>
      <button class="fx-btn" data-nb="lib">Библиотека</button>
      ${N.status !== "online" ? `<button class="fx-btn primary" data-nb="join">Подключиться к комнате</button>` : ""}
      <button class="fx-btn upd-btn" data-upd="${updUi.state === "downloaded" ? "apply" : updUi.state === "available" ? "ask" : "check"}">${UPD_LABEL[updUi.state]}</button>
      <button class="fx-btn danger" data-nb="leave">Выйти из комнаты</button><button class="fx-btn" data-nb="closeov">Закрыть</button></div>`;
    ov.hidden = false;
    ov.onclick = e => { if (e.target === ov || e.target.closest("[data-nb='closeov']")) ov.hidden = true; if (e.target.closest("[data-nb='map']")) { ov.hidden = true; openMap(); } if (e.target.closest("[data-nb='lib']")) { ov.hidden = true; openLibrary(); } if (e.target.closest("[data-nb='join']")) { ov.hidden = true; showJoin(); } if (e.target.closest("[data-nb='leave']")) { ov.hidden = true; N.toHost("bye", {}); N.leave(); lsSet(PLAYER_KEY, null); showJoin(); } };
  }

  /* ---- вход в комнату ---- */
  function buildJoin() { mkOv("netjoin"); document.addEventListener("click", e => { if (e.target.closest("[data-nj='open']")) showJoin(); }); }
  function showJoin() {
    const ov = mkOv("netjoin"), cr = lsGet(PLAYER_KEY) || {};
    ov.hidden = false;
    ov.innerHTML = `<div class="net-panel fx-frame"><div class="fx-eyebrow">Исследователи лабиринта</div><h3>Подключиться к партии</h3>
      <p>Попроси ведущего код комнаты и впиши его ниже.</p>
      <label>Код комнаты<input id="nj-code" maxlength="8" autocapitalize="characters" autocomplete="off" value="${esc(cr.code || "")}"></label>
      <label>Твоё имя<input id="nj-name" maxlength="24" autocomplete="off" value="${esc(cr.name || "")}"></label>
      <p class="net-msg" id="nj-msg"></p>
      <button class="fx-btn primary big" data-nj="go">Подключиться</button><button class="fx-btn" data-nj="later">Позже: смотреть своих героев и справочник</button></div>`;
    ov.onclick = e => {
      if (e.target.closest("[data-nj='later']")) { ov.hidden = true; goOffline(); return; }
      if (!e.target.closest("[data-nj='go']")) return;
      const code = ov.querySelector("#nj-code").value.trim(), name = ov.querySelector("#nj-name").value.trim() || "Игрок";
      if (code.length < 4) { ov.querySelector("#nj-msg").textContent = "Введи код комнаты."; return; }
      C.msg = "Подключаюсь…"; updateJoinMsg(); connect(code, name, (lsGet(PLAYER_KEY) || {}).pid);
    };
  }
  function updateJoinMsg() { const m = document.getElementById("nj-msg"); if (m) m.textContent = C.msg; }
  function hideJoin() { const ov = document.getElementById("netjoin"); if (ov) ov.hidden = true; }

  /* ---- ограничения в меню героя ---- */
  const VIEW_OK = new Set(["tab", "close", "kills", "sack"]);
  const FORBID = new Set(["hp", "mp", "insp", "luck", "revive", "ess-release", "ess-add-toggle", "ess-add", "ess-take", "add-toggle"]);
  document.addEventListener("click", e => {
    if (isMaster()) return;
    const el = e.target.closest("#heroov [data-hx],#heroov [data-hadd]"); if (!el) return;
    const hx = el.dataset.hx, c = heroUi && heroById(heroUi.id);
    let ok = hx !== undefined && VIEW_OK.has(hx);
    if (!ok && hx !== undefined && !FORBID.has(hx) && el.dataset.hadd === undefined) {
      ok = G.isMine(c) && !battleOn();
      if (ok && (hx === "give" || hx === "coin-give")) { const to = heroById(el.dataset.to); ok = !!(to && to.owner === c.owner); }
    }
    if (!ok) { e.stopImmediatePropagation(); e.preventDefault(); toast(FORBID.has(hx) || el.dataset.hadd !== undefined ? "Это делает ведущий" : battleOn() ? "Во время боя меню героя только для просмотра" : "Это чужой герой: можно только смотреть"); }
  }, true);
  // Убираем из меню героя кнопки ведущего (чтобы их не было видно, а не только не работали).
  const stripMaster = () => {
    if (isMaster()) return;
    const root = document.getElementById("heroov"); if (!root) return;
    root.querySelectorAll([...FORBID].map(x => `[data-hx="${x}"]`).join(",") + ",[data-hadd]").forEach(b => b.remove());
    root.querySelectorAll(".btn-row,.add-list").forEach(r => { if (!r.children.length) r.remove(); });
  };
  new MutationObserver(stripMaster).observe(document.getElementById("heroov"), { childList: true });

  /* ---- библиотека: только чтение (знания отряда записывает ведущий) ---- */
  const LIB_FORBID = ["add", "cancel-add", "pick", "confirm-add", "reveal", "cancel-reveal", "toggle", "confirm-reveal"];
  document.addEventListener("click", e => { if (isMaster()) return; const el = e.target.closest("#libov [data-lx]"); if (el && LIB_FORBID.includes(el.dataset.lx)) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  new MutationObserver(() => {
    if (isMaster()) return;
    const root = document.getElementById("libov"); if (!root) return;
    root.querySelectorAll(LIB_FORBID.map(x => `[data-lx="${x}"]`).join(",")).forEach(b => b.remove());
  }).observe(document.getElementById("libov"), { childList: true, subtree: true });

  // Пока открыто создание героя, нижняя панель клиента прячется.
  new MutationObserver(() => document.body.classList.toggle("net-forge", !document.getElementById("forge").hidden)).observe(document.getElementById("forge"), { attributes: true, attributeFilter: ["hidden"] });
  G.ready = true;
})();
