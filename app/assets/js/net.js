/* Онлайн-режим: связь ведущего (host) и игроков (client). Транспорт — WebRTC через PeerJS (по коду комнаты, своего сервера нет) или BroadcastChannel (для проверок).
   Здесь только связь: комнаты, ссылки (Link) с кусочками сообщений, пульс, запросы-ответы (RPC), переподключение. Игровая часть — netGlue в index.html. См. docs/multiplayer.md. */
(function () {
  const N = window.Net = { ver: 1, role: null, code: null, status: "off", players: {}, transport: "peer", handlers: {}, listeners: [] };
  const PREFIX = "sputnik-rf-", ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rid = n => Array.from({ length: n }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join("");
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const emit = (ev, d) => { for (const f of N.listeners) { try { f(ev, d); } catch (e) { console.error("net:", e); } } };
  N.on = f => { N.listeners.push(f); return () => { const i = N.listeners.indexOf(f); if (i >= 0) N.listeners.splice(i, 1); }; };
  N.handle = (t, fn) => { N.handlers[t] = fn; };                                     // обработчик входящего сообщения или запроса: fn(данные, link, игрок)
  const setStatus = s => { if (N.status !== s) { N.status = s; emit("status", s); } };

  /* ===== транспорты: Conn { send(строка), onmessage, onclose, close() } ===== */
  const Tr = {};
  Tr.loopback = {
    async host(code, onConn) {
      const bc = new BroadcastChannel("spl-" + code), conns = {};
      bc.onmessage = e => {
        const m = e.data; if (m.to !== "host") return;
        let c = conns[m.from];
        if (m.k === "open") { if (c && c.live) { c.live = false; if (c.onclose) c.onclose(); } c = conns[m.from] = mk(m.from); onConn(c); return; }
        if (!c || !c.live) return;
        if (m.k === "close") { c.live = false; if (c.onclose) c.onclose(); } else if (c.onmessage) c.onmessage(m.d);
      };
      const mk = cid => ({ live: true, send(s) { if (this.live) bc.postMessage({ to: cid, from: "host", k: "msg", d: s }); }, close() { if (this.live) { this.live = false; bc.postMessage({ to: cid, from: "host", k: "close" }); } } });
      return { close() { for (const c of Object.values(conns)) c.close(); bc.close(); } };
    },
    async join(code) {
      const cid = "c" + rid(6), bc = new BroadcastChannel("spl-" + code);
      const c = { live: true, send(s) { if (this.live) bc.postMessage({ to: "host", from: cid, k: "msg", d: s }); }, close() { if (this.live) { this.live = false; bc.postMessage({ to: "host", from: cid, k: "close" }); bc.close(); } } };
      bc.onmessage = e => { const m = e.data; if (m.to !== cid) return; if (m.k === "close") { c.live = false; if (c.onclose) c.onclose(); } else if (c.onmessage) c.onmessage(m.d); };
      bc.postMessage({ to: "host", from: cid, k: "open" });
      await sleep(30);
      return c;
    },
  };
  let peerLoad = null;
  const loadPeer = () => peerLoad || (peerLoad = window.Peer ? Promise.resolve() : new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = "assets/vendor/peerjs.min.js"; s.onload = ok; s.onerror = () => { peerLoad = null; no(new Error("не загрузился PeerJS")); }; document.head.appendChild(s);
  }));
  const wrapDc = dc => { const c = { live: true, send(s) { if (this.live) dc.send(s); }, close() { this.live = false; try { dc.close(); } catch (e) {} } }; dc.on("data", d => c.onmessage && c.onmessage(typeof d === "string" ? d : String(d))); dc.on("close", () => { c.live = false; c.onclose && c.onclose(); }); dc.on("error", () => { c.live = false; c.onclose && c.onclose(); }); return c; };
  const PEER_OPTS = { debug: 0 };
  Tr.peer = {
    async host(code, onConn) {
      await loadPeer();
      const peer = new Peer(PREFIX + code, PEER_OPTS);
      try { await new Promise((ok, no) => { peer.on("open", ok); peer.on("error", e => no(e)); setTimeout(() => no(new Error("нет связи с сервером рукопожатий")), 15000); }); }
      catch (e) { try { peer.destroy(); } catch (x) {} throw e; }                                  // неудачная попытка не должна занимать код комнаты
      peer.on("error", e => emit("peererror", String(e && e.type || e)));
      peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) {} });          // сигнальный сервер нужен только для рукопожатий
      peer.on("connection", dc => { const c = wrapDc(dc); if (dc.open) onConn(c); else dc.on("open", () => onConn(c)); });
      return { close() { try { peer.destroy(); } catch (e) {} } };
    },
    async join(code) {
      await loadPeer();
      const peer = new Peer(PEER_OPTS);
      await new Promise((ok, no) => { peer.on("open", ok); peer.on("error", e => no(e)); setTimeout(() => no(new Error("нет связи с сервером рукопожатий")), 10000); });
      const dc = peer.connect(PREFIX + code, { reliable: true, serialization: "json" });
      await new Promise((ok, no) => { dc.on("open", ok); dc.on("error", e => no(e)); peer.on("error", e => no(e)); setTimeout(() => no(new Error("ведущий не отвечает")), 12000); });
      const c = wrapDc(dc); const close = c.close; c.close = function () { close.call(this); try { peer.destroy(); } catch (e) {} };
      dc.on("close", () => { try { peer.destroy(); } catch (e) {} });
      return c;
    },
  };

  /* ===== Link: сообщения {t, d, id?}, ответы {re, d | err}, кусочки, пульс ===== */
  const CHUNK = 48000;
  class Link {
    constructor(conn) {
      this.conn = conn; this.alive = true; this.rpc = {}; this.seq = 1; this.parts = {}; this.last = Date.now(); this.tag = null;
      conn.onmessage = raw => this._in(raw); conn.onclose = () => this._closed();
      this.timer = setInterval(() => { if (!this.alive) return; this.raw({ t: "ping" }); if (Date.now() - this.last > 15000) this._closed(); }, 4000);
    }
    raw(msg) {
      if (!this.alive) return false;
      const s = JSON.stringify(msg);
      try {
        if (s.length <= CHUNK) this.conn.send(s);
        else { const id = "k" + (this.seq++), n = Math.ceil(s.length / CHUNK); for (let i = 0; i < n; i++) this.conn.send(JSON.stringify({ t: "chunk", id, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) })); }
      } catch (e) { return false; }
      return true;
    }
    send(t, d) { return this.raw({ t, d }); }
    call(t, d, ms = 0) {
      return new Promise((ok, no) => {
        const id = this.seq++; let to = null;
        this.rpc[id] = { ok, no };
        if (ms) to = setTimeout(() => { delete this.rpc[id]; no(new Error("нет ответа: " + t)); }, ms);
        this.rpc[id].clear = () => to && clearTimeout(to);
        if (!this.raw({ t, d, id })) { delete this.rpc[id]; no(new Error("связь оборвана")); }
      });
    }
    _in(raw) {
      this.last = Date.now();
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (m.t === "chunk") { const p = (this.parts[m.id] ||= { n: m.n, got: [], k: 0 }); if (!p.got[m.i]) { p.got[m.i] = m.d; p.k++; } if (p.k === p.n) { delete this.parts[m.id]; this._in(p.got.join("")); } return; }
      if (m.t === "ping") return;
      if (m.re != null) { const r = this.rpc[m.re]; if (!r) return; delete this.rpc[m.re]; r.clear && r.clear(); if (m.err) r.no(new Error(m.err)); else r.ok(m.d); return; }
      const h = N.handlers[m.t];
      if (!h) { if (m.id != null) this.raw({ re: m.id, err: "нет обработчика " + m.t }); return; }
      Promise.resolve().then(() => h(m.d, this, this.player)).then(res => { if (m.id != null) this.raw({ re: m.id, d: res === undefined ? null : res }); },
        err => { console.error("net handler", m.t, err); if (m.id != null) this.raw({ re: m.id, err: String(err && err.message || err) }); });
    }
    _closed() {
      if (!this.alive) return; this.alive = false; clearInterval(this.timer);
      for (const r of Object.values(this.rpc)) { r.clear && r.clear(); r.no(new Error("связь оборвана")); } this.rpc = {};
      try { this.conn.close(); } catch (e) {}
      if (this.onclose) this.onclose();
    }
    close() { this._closed(); }
  }
  N.Link = Link;

  /* ===== ведущий ===== */
  let hostHandle = null;
  N.startHost = async function (opts = {}) {
    if (N.role) throw new Error("уже в онлайне");
    N.transport = opts.transport || N.transport;
    let code = opts.code || rid(5);
    setStatus("starting");
    // Старый код комнаты ещё может числиться на сервере рукопожатий (приложение закрыли, не закрыв комнату): ждём освобождения, потом берём новый код.
    for (let attempt = 0; ; attempt++) {
      try { hostHandle = await Tr[N.transport].host(code, conn => onConn(new Link(conn))); break; }
      catch (e) {
        const taken = e && (e.type === "unavailable-id" || /taken/i.test(String(e.message || e)));
        if (!taken) { setStatus("off"); throw e; }
        if (attempt < 5) { await sleep(3000); continue; }
        if (attempt === 5) { code = rid(5); emit("codechanged", code); continue; }
        setStatus("off"); throw e;
      }
    }
    N.role = "host"; N.code = code; setStatus("hosting"); emit("host", code);
    return code;
  };
  const onConn = link => {
    link._helloTimer = setTimeout(() => link.close(), 10000);                              // молчащее соединение без приветствия закрываем
    link.onclose = () => clearTimeout(link._helloTimer);
  };
  // Привязывает ссылку к игроку (вызывает обработчик hello в netGlue): возвращает запись игрока.
  N.bind = function (link, pid, name) {
    clearTimeout(link._helloTimer);
    let p = N.players[pid];
    if (!p) p = N.players[pid] = { pid, name, online: false, link: null, joined: Date.now() };
    if (p.link && p.link !== link) { const old = p.link; old.onclose = null; old.close(); }          // тот же игрок зашёл заново (переподключение)
    p.name = name || p.name; p.link = link; p.online = true; link.player = p; p.seen = Date.now();
    link.onclose = () => { const q = link.player; if (q && q.link === link) { q.link = null; q.online = false; emit("player", q); } };
    emit("player", p);
    return p;
  };
  N.newPid = () => "p" + rid(6);
  N.toPlayer = (pid, t, d) => { const p = N.players[pid]; return !!(p && p.link && p.link.send(t, d)); };
  N.callPlayer = (pid, t, d, ms) => { const p = N.players[pid]; if (!(p && p.link && p.link.alive)) return Promise.reject(new Error("игрок не в сети")); return p.link.call(t, d, ms); };
  N.broadcast = (t, d) => { for (const p of Object.values(N.players)) if (p.link) p.link.send(t, d); };
  N.stopHost = function () {
    for (const p of Object.values(N.players)) if (p.link) { p.link.onclose = null; p.link.close(); }
    N.players = {}; if (hostHandle) hostHandle.close(); hostHandle = null; N.role = null; N.code = null; setStatus("off"); emit("host", null);
  };

  /* ===== игрок ===== */
  let want = null, link = null, retry = 0, cancelled = false, gen = 0;
  N.join = function (code, name, pid, helloData) {
    code = String(code || "").trim().toUpperCase();
    if (N.role === "host") throw new Error("уже ведущий");
    if (link) { link.onclose = null; link.close(); link = null; }                  // повторный вход: старое соединение и старый цикл подключения не должны мешать новому
    cancelled = false; retry = 0; want = { code, name, pid, helloData }; N.code = code; N.role = "client"; connectLoop(++gen);
  };
  N.leave = function () { gen++; cancelled = true; want = null; if (link) { link.onclose = null; link.close(); link = null; } N.role = null; N.code = null; setStatus("off"); };
  N.link = () => link;
  N.callHost = (t, d, ms) => { if (!(link && link.alive)) return Promise.reject(new Error("нет связи с ведущим")); return link.call(t, d, ms); };
  N.toHost = (t, d) => !!(link && link.alive && link.send(t, d));
  async function connectLoop(my) {
    while (!cancelled && want && my === gen) {
      setStatus(retry ? "reconnecting" : "connecting");
      try {
        const conn = await Tr[N.transport].join(want.code); if (my !== gen) { try { conn.close(); } catch (e) {} return; }
        const l = new Link(conn); link = l;
        const hello = typeof want.helloData === "function" ? want.helloData() : (want.helloData || {});
        const w = await l.call("hello", { ver: N.ver, pid: want.pid, name: want.name, ...hello }, 8000);
        if (w && w.pid) want.pid = w.pid;
        retry = 0; setStatus("online"); emit("welcome", w);
        await new Promise(res => { l.onclose = res; });
        if (link === l) link = null; if (cancelled || my !== gen) return;
        setStatus("reconnecting"); emit("lost");
      } catch (e) { if (my !== gen) return; link = null; emit("joinerror", String(e && e.message || e)); }
      retry++; await sleep(Math.min(8000, 1200 + retry * 800));
    }
  }
  N.pid = () => (want && want.pid) || null;
  N.rid = rid;
})();
