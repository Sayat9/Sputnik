/* Тактический бой: интерфейс — поле 7×7, фон по зоне, местность, токены с ОЗ/маной, иконки статусов, эффекты, расстановка.
   Меню действий и выбор целей — в battle-menu.js. См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const UI = (B.UI = { active: false, mode: "idle", hl: new Map(), pick: null, busy: false, turnUnit: null, pendingFx: [] });
  const sleep = ms => (B.cfg.fast ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ico = (name, cls = "") => `<svg class="bi ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${D.ico[name] || ""}</svg>`;
  const stIco = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(D.status[id] || {}).ico || ""}</svg>`;
  UI.esc = esc; UI.ico = ico; UI.stIco = stIco; UI.sleep = sleep;
  let root = null, board = null, cell = 52, cellEls = [], tokenEls = new Map(), raf = 0;
  UI.cell = () => cell; UI.root = () => root;

  /* ===== фон по зоне ===== */
  function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function bgSvg(zone, seed) {
    const z = D.zones[zone] || D.zones.goblin, c = z.bg, r = mulberry(seed), N = 700, out = [];
    const P = (a, b) => a + r() * (b - a);
    out.push(`<defs><radialGradient id="bgg" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="${c.base}"/><stop offset="1" stop-color="${c.base2}"/></radialGradient></defs><rect width="${N}" height="${N}" fill="url(#bgg)"/>`);
    const dot = () => c.dots[Math.floor(r() * c.dots.length)];
    for (let i = 0; i < 46; i++) out.push(`<ellipse cx="${P(0, N)}" cy="${P(0, N)}" rx="${P(14, 60)}" ry="${P(8, 30)}" fill="${dot()}" opacity="${P(.12, .3)}"/>`);
    for (let i = 0; i < 70; i++) { const x = P(0, N), y = P(0, N), h = P(5, 13); out.push(`<path d="M${x} ${y} l${P(-3, 3)} ${-h} M${x + 3} ${y} l${P(-3, 3)} ${-h * .8} M${x - 3} ${y} l${P(-3, 3)} ${-h * .7}" stroke="${c.tufts}" stroke-width="1.6" opacity="${P(.3, .65)}" fill="none" stroke-linecap="round"/>`); }
    if (zone === "goblin") for (let i = 0; i < 16; i++) { const x = P(20, N - 20), y = P(20, N - 20); out.push(`<path d="M${x} ${y} l14 3 M${x + 2} ${y + 6} l14 3" stroke="#d6c28a" stroke-width="1.6" opacity=".45" stroke-linecap="round"/>`); out.push(`<ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="#2a2010" opacity=".35"/>`); }
    if (zone === "beast") for (let i = 0; i < 40; i++) out.push(`<ellipse cx="${P(0, N)}" cy="${P(0, N)}" rx="${P(5, 9)}" ry="${P(3, 5)}" fill="${["#7a9a3a", "#a8863a", "#5a8a3a", "#8a5a2a"][Math.floor(r() * 4)]}" opacity="${P(.25, .6)}" transform="rotate(${P(0, 180)} ${N / 2} ${N / 2})"/>`);
    if (zone === "undead") { for (let i = 0; i < 14; i++) { let x = P(0, N), y = P(0, N), d = `M${x} ${y}`; for (let k = 0; k < 4; k++) { x += P(-30, 30); y += P(10, 34); d += ` L${x} ${y}`; } out.push(`<path d="${d}" stroke="#14121c" stroke-width="2.4" fill="none" opacity=".55"/>`); } for (let i = 0; i < 9; i++) out.push(`<path d="M${P(0, N)} ${P(0, N)} l${P(10, 22)} ${P(-8, 8)}" stroke="#d6ccb4" stroke-width="3.5" stroke-linecap="round" opacity=".28"/>`); }
    if (zone === "stone") { for (let i = 0; i < 14; i++) { let x = P(0, N), y = P(0, N), d = `M${x} ${y}`; for (let k = 0; k < 4; k++) { x += P(-26, 26); y += P(8, 30); d += ` L${x} ${y}`; } out.push(`<path d="${d}" stroke="#12181e" stroke-width="2.2" fill="none" opacity=".5"/>`); } for (let i = 0; i < 40; i++) out.push(`<circle cx="${P(0, N)}" cy="${P(0, N)}" r="${P(2, 6)}" fill="${["#7c8ea0", "#5a6a78", "#9ab0c4"][Math.floor(r() * 3)]}" opacity="${P(.25, .55)}"/>`); for (let i = 0; i < 8; i++) out.push(`<circle cx="${P(0, N)}" cy="${P(0, N)}" r="${P(1.2, 2.2)}" fill="#8fe6f2" opacity=".6"/>`); }
    return `<svg viewBox="0 0 ${N} ${N}" preserveAspectRatio="none" aria-hidden="true">${out.join("")}</svg>`;
  }

  /* ===== сборка ===== */
  UI.open = function () {
    if (UI.active) return;
    root = document.createElement("div"); root.id = "battle"; root.className = "bt-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Бой");
    root.innerHTML = `<div class="bt-top"><div class="bt-round"><small>Раунд</small><b>1</b></div><div class="bt-order" aria-label="Порядок ходов"></div>
        <button class="bt-iconbtn" data-bt="menu" aria-label="Меню боя">${ico("menu")}</button></div>
      <div class="bt-banner" aria-live="polite"></div>
      <div class="bt-boardwrap"><div class="bt-board"><div class="bt-bg"></div><div class="bt-cells"></div><div class="bt-zonelay"></div><div class="bt-objs"></div><div class="bt-tokens"></div><div class="bt-marks"></div><svg class="bt-pathsvg" aria-hidden="true"></svg><div class="bt-fx"></div></div>
        <div class="bt-zone"></div><div class="bt-toast" hidden></div></div>
      <div class="bt-panel"></div><div class="bt-modal" hidden></div>`;
    document.body.appendChild(root); document.body.classList.add("forge-open", "bt-active");
    board = root.querySelector(".bt-board");
    UI.active = true; UI.mode = "idle"; UI.hl = new Map(); UI.pick = null; UI.busy = false; UI.turnUnit = null; UI.built = false; UI.cat = null;
    window.addEventListener("resize", fit); fit();
    root.addEventListener("click", onClick);
    board.addEventListener("pointerdown", onHoldDown); board.addEventListener("pointermove", onHoldMove); board.addEventListener("pointerup", onHoldUp); board.addEventListener("pointercancel", onHoldUp);
    board.addEventListener("contextmenu", e => e.preventDefault());
    // Кнопка «Назад» не выходит из боя: отменяет текущий шаг или открывает меню боя.
    try { history.pushState({ btBattle: 1 }, ""); UI._pushed = true; } catch (e) { UI._pushed = false; }
    window.addEventListener("popstate", onPop);
  };
  function onPop() {
    if (!UI.active) return;
    UI._pushed = false;
    try { history.pushState({ btBattle: 1 }, ""); UI._pushed = true; } catch (e) {}
    if (UI.onBack) UI.onBack();
  }
  UI.close = function () {
    if (!UI.active) return;
    window.removeEventListener("resize", fit); window.removeEventListener("popstate", onPop);
    if (UI._pushed) { UI._pushed = false; try { history.back(); } catch (e) {} }
    if (root) root.remove(); root = null; board = null; cellEls = []; tokenEls = new Map(); UI.active = false; UI.built = false;
    document.body.classList.remove("forge-open", "bt-active");
  };
  function fit() {
    if (!root) return;
    const h = sel => { const e = root.querySelector(sel); return e ? e.offsetHeight : 0; };
    const topH = (h(".bt-top") || 56) + (h(".bt-banner") || 26) + 24, panelMin = innerHeight < 700 ? 240 : 270;
    const side = innerWidth >= 760 && innerWidth > innerHeight;                      // альбомный режим: панель рядом с полем
    const size = side ? Math.max(210, Math.min(innerWidth - 400 - 24, innerHeight - topH - 8, 640)) : Math.max(210, Math.min(innerWidth - 10, innerHeight - topH - panelMin, 560));
    cell = Math.floor(size / 7); const wpx = cell * 7;
    root.style.setProperty("--cell", cell + "px"); root.style.setProperty("--bw", wpx + "px");
    if (UI.built) UI.refresh();
  }
  function build(S) {
    const bg = root.querySelector(".bt-bg"); S.bgSeed = S.bgSeed || Math.floor(Math.random() * 1e9);
    bg.innerHTML = bgSvg(S.zone, S.bgSeed);
    root.querySelector(".bt-zone").textContent = (D.zones[S.zone] || {}).name || "";
    root.dataset.zone = S.zone; root.classList.toggle("dark", !!S.dark && !S.torch);
    const cells = root.querySelector(".bt-cells"); cells.innerHTML = ""; cellEls = [];
    for (let y = 0; y < B.H; y++) { cellEls[y] = []; for (let x = 0; x < B.W; x++) { const c = document.createElement("div"); c.className = "bt-cell"; c.dataset.x = x; c.dataset.y = y; c.dataset.t = ""; cells.appendChild(c); cellEls[y][x] = c; } }
    UI.built = true; tokenEls = new Map(); root.querySelector(".bt-tokens").innerHTML = "";
  }

  /* ===== отрисовка ===== */
  function renderCells(S) {
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      const el = cellEls[y][x], t = S.cells[y][x] || "";
      if (el.dataset.t !== t) { el.dataset.t = t; el.innerHTML = t ? `<svg class="bt-ter t-${t}" viewBox="0 0 100 100" aria-hidden="true">${D.SVG[t] || ""}</svg>` : ""; }
      const classes = UI.hl.get(x + "," + y) || [], key = classes.join(" ");
      if (el.dataset.h !== key) { el.dataset.h = key; el.className = "bt-cell" + (key ? " " + key : ""); }
    }
  }
  const hpColor = f => (f > 0.6 ? "#7cc05a" : f > 0.3 ? "#e0b13c" : "#d6523f");
  function statusIcons(u) {
    const list = u.conds.filter(c => D.status[c.id]); if (u.dead) return "";
    const shown = list.slice(0, 4), extra = list.length - shown.length;
    return shown.map(c => `<i class="bt-st ${D.status[c.id].good ? "good" : "bad"}" title="${esc(D.status[c.id].name)}">${stIco(c.id)}</i>`).join("") + (extra > 0 ? `<i class="bt-st more">+${extra}</i>` : "");
  }
  // «Чутьё» волка (6 клеток) и «По следу» костяной гончей (ближайший раненый в 18 м): раненых врагов отмечает сердечком.
  function sensedWounded(S, u) {
    if (u.hp >= u.maxHp / 2) return false;
    if (B.heroes().some(h => B.alive(h) && h.pass.includes("wolf") && B.dist(h, u) <= 6)) return true;
    return B.heroes().some(h => {
      if (!B.alive(h) || !h.pass.includes("bone-hound")) return false;
      const near = B.enemiesOf(h).filter(e => e.hp < e.maxHp / 2).sort((a, b) => B.dist(h, a) - B.dist(h, b))[0];
      return near === u && B.dist(h, u) <= 12;
    });
  }
  function renderTokens(S) {
    const layer = root.querySelector(".bt-tokens"), seen = new Set();
    for (const u of S.units) {
      seen.add(u.id);
      let el = tokenEls.get(u.id);
      if (!el) {
        el = document.createElement("div"); el.className = "bt-token"; el.dataset.id = u.id;
        el.innerHTML = `<div class="bt-bars"><i class="hp"><b></b></i><i class="mp"><b></b></i></div><div class="bt-face"><img alt="" draggable="false"></div><div class="bt-name"></div><div class="bt-sts"></div><div class="bt-wound" hidden>${ico("heart")}</div>`;
        el.querySelector("img").src = u.face || ""; layer.appendChild(el); tokenEls.set(u.id, el);
        el.style.left = u.x * cell + "px"; el.style.top = u.y * cell + "px";
      }
      const gone = u.fled || u.escaped || (!u.alive && (u.side === "mon" || u.summon)) || (u.side === "mon" && S.hideMons);
      el.hidden = gone;
      const sz = u.size * cell;
      el.style.width = sz + "px"; el.style.height = sz + "px"; el.style.left = u.x * cell + "px"; el.style.top = u.y * cell + "px";
      const cur = S.order[S.turn] === u.id && S.phase === "fight";
      el.className = `bt-token ${u.side}${u.size > 1 ? " big" : ""}${cur ? " cur" : ""}${u.down ? " down" : ""}${u.dead ? " dead" : ""}${has(u, "hidden") ? " hidden-st" : ""}${has(u, "underground") ? " under" : ""}${u.summon ? " summon k-" + u.kind : ""}${u.spectral ? " ghost" : ""}${UI.targetIds && UI.targetIds.has(u.id) ? " target" : ""}${UI.selIds && UI.selIds.has(u.id) ? " sel" : ""}`;
      const showHp = u.side === "hero" || S.opts.showMonHp;
      const bars = el.querySelector(".bt-bars"); bars.hidden = !showHp;
      if (showHp) {
        const f = u.maxHp ? u.hp / u.maxHp : 0, hp = bars.querySelector(".hp b"); hp.style.width = Math.round(f * 100) + "%"; hp.style.background = hpColor(f);
        const mpEl = bars.querySelector(".mp"); mpEl.hidden = u.side !== "hero" || !u.maxMp; if (u.side === "hero") mpEl.querySelector("b").style.width = Math.round((u.maxMp ? u.mp / u.maxMp : 0) * 100) + "%";
        bars.title = `${u.name}: ОЗ ${u.hp}/${u.maxHp}${u.side === "hero" ? ` · мана ${u.mp}/${u.maxMp}` : ""}`;
        const tmp = u.temp > 0 ? ` +${u.temp}` : ""; bars.dataset.tmp = tmp;
      }
      el.querySelector(".bt-sts").innerHTML = statusIcons(u);
      const w = el.querySelector(".bt-wound"); w.hidden = !(u.side === "mon" && u.alive && !S.opts.showMonHp && sensedWounded(S, u));
      const nm = el.querySelector(".bt-name"); nm.textContent = u.summon ? (u.kind === "double" ? "Д" : "В" + (/\d$/.test(u.name) ? u.name.slice(-1) : "")) : u.side === "hero" ? u.name.split(" ")[0] : (/\d$/.test(u.name) ? u.name.slice(-1) : ""); nm.className = "bt-name" + (u.side === "hero" && !u.summon ? "" : " num"); nm.hidden = !nm.textContent;
    }
    for (const [id, el] of tokenEls) if (!seen.has(id)) { el.remove(); tokenEls.delete(id); }
  }
  const has = (u, id) => B.has(u, id);
  // Зоны эссенций: рой паучат (куб 3 м) и белая пыль (сфера вокруг пепельника) подсвечивают клетки на поле.
  function renderZones(S) {
    const l = root.querySelector(".bt-zonelay"); if (!l) return;
    let h = "";
    for (const z of S.zones || []) for (const [x, y] of B.zoneCells(z)) h += `<div class="bt-zcell k-${z.kind}" style="left:${x * cell}px;top:${y * cell}px;width:${cell}px;height:${cell}px"></div>`;
    l.innerHTML = h;
  }
  function renderObjs(S) {
    const l = root.querySelector(".bt-objs"); let h = "";
    for (const o of S.objs) if (o.kind === "trap" && (!o.hidden || o.owner === "hero")) h += `<div class="bt-obj trap" style="left:${o.x * cell}px;top:${o.y * cell}px;width:${cell}px;height:${cell}px"><svg viewBox="0 0 100 100">${D.SVG.trap}</svg></div>`;
    for (const o of S.objs) if (o.kind === "illusion") h += `<div class="bt-obj illusion" title="Иллюзия «Морока»" style="left:${o.x * cell}px;top:${o.y * cell}px;width:${cell}px;height:${cell}px">${ico("eye")}</div>`;
    for (const b of S.bodies || []) if (!b.eaten) h += `<div class="bt-obj body" title="Павший: ${esc(b.name)}" style="left:${b.x * cell}px;top:${b.y * cell}px;width:${cell}px;height:${cell}px">${ico("skull")}</div>`;
    l.innerHTML = h;
    // Брошенное оружие и стрелы на земле: значки в углу клетки поверх фишек.
    const m = root.querySelector(".bt-marks"), byCell = new Map();
    for (const w of S.drops) { const k = w.x + "," + w.y, e = byCell.get(k) || { x: w.x, y: w.y, weapons: [], arrows: 0 }; if (w.kind === "weapon") e.weapons.push(w); else e.arrows++; byCell.set(k, e); }
    m.innerHTML = [...byCell.values()].map(e => {
      const wp = e.weapons.map(w => { const it = itemOf(w.item), hh = B.byId && B.heroes().find(u => u.hero && u.hero.id === w.hero); return `<span class="mk w" title="${esc((it ? it.name : "Оружие") + (hh ? " — " + hh.name : ""))} лежит на земле">${ico("throwing")}</span>`; }).join("");
      const ar = e.arrows ? `<span class="mk a" title="Стрелы на земле: ${e.arrows}">${ico("arrow")}<b>${e.arrows}</b></span>` : "";
      return `<div class="bt-mark" style="left:${e.x * cell}px;top:${e.y * cell}px;width:${cell}px;height:${cell}px">${wp}${ar}</div>`;
    }).join("");
  }
  function renderOrder(S) {
    const el = root.querySelector(".bt-order"), rd = root.querySelector(".bt-round b"); if (rd) rd.textContent = S.round;
    if (!S.order.length) { el.innerHTML = ""; return; }
    el.innerHTML = S.order.map((id, i) => {
      const u = B.byId(id); if (!u || u.fled || u.escaped || (!u.alive && u.side === "mon")) return "";
      const cur = i === S.turn && S.phase === "fight";
      return `<button class="bt-ord ${u.side}${cur ? " cur" : ""}${u.down ? " down" : ""}${u.summon ? " sm" : ""}${u.spectral ? " ghost" : ""}" data-bt="inspect" data-id="${u.id}" title="${esc(u.name)}"><img src="${u.face}" alt=""></button>`;
    }).join("");
    const c = el.querySelector(".cur"); if (c && c.scrollIntoView) { try { c.scrollIntoView({ inline: "center", block: "nearest" }); } catch (e) {} }
  }
  UI.refresh = function () {
    if (!UI.active || !B.S || !root) return;
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; UI.refreshNow(); });
  };
  UI.refreshNow = function () {
    const S = B.S; if (!UI.active || !S || !root) return;
    if (!UI.built) build(S);
    root.classList.toggle("dark", !!S.dark && !S.torch);
    renderCells(S); renderZones(S); renderTokens(S); renderObjs(S); renderOrder(S);
    if (UI.renderPanel) UI.renderPanel();
    UI.drawPath();
  };
  UI.setHl = function (map) { UI.hl = map || new Map(); UI.targetIds = UI.targetIds || null; if (B.S && UI.built) { renderCells(B.S); } };
  UI.hlAdd = (map, x, y, cls) => { const k = x + "," + y; const a = map.get(k) || []; if (!a.includes(cls)) a.push(cls); map.set(k, a); };
  UI.drawPath = function () {
    const svg = root && root.querySelector(".bt-pathsvg"); if (!svg) return;
    const p = UI.pathPreview, ways = UI.pathWays || [];
    if ((!p || !p.length) && !ways.length) { svg.innerHTML = ""; return; }
    svg.setAttribute("viewBox", `0 0 ${cell * 7} ${cell * 7}`);
    let h = "";
    if (p && p.length) {
      const start = UI.pathStart ? [UI.pathStart] : [];
      const pts = [...start, ...p].map(([x, y]) => `${(x + 0.5) * cell},${(y + 0.5) * cell}`).join(" "), last = p[p.length - 1];
      h += `<polyline points="${pts}" fill="none" stroke="#f4d48e" stroke-width="${Math.max(3, cell * 0.08)}" stroke-dasharray="${cell * 0.12} ${cell * 0.12}" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/><circle cx="${(last[0] + 0.5) * cell}" cy="${(last[1] + 0.5) * cell}" r="${cell * 0.16}" fill="#f4d48e"/>`;
    }
    // путевые точки: булавки с номерами — герой обязательно пройдёт через них
    ways.forEach(([x, y], i) => { h += `<g><circle cx="${(x + 0.5) * cell}" cy="${(y + 0.5) * cell}" r="${cell * 0.24}" fill="#2a6f4a" stroke="#bff0b4" stroke-width="${Math.max(2, cell * 0.05)}"/><text x="${(x + 0.5) * cell}" y="${(y + 0.5) * cell + cell * 0.09}" text-anchor="middle" font-size="${cell * 0.28}" font-weight="700" fill="#effff0" font-family="sans-serif">${i + 1}</text></g>`; });
    svg.innerHTML = h;
  };

  /* ===== позиции клеток по касанию ===== */
  function cellAt(e) {
    const r = board.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / (r.width / B.W)), y = Math.floor((e.clientY - r.top) / (r.height / B.H));
    return B.inB(x, y) ? [x, y] : null;
  }
  // Долгое нажатие (≈0,45 с) по клетке: в выборе движения — путевая точка, в остальное время — окно с эффектами клетки (battle-menu.js).
  const HOLD_MS = 450;
  let hold = null;
  function onHoldDown(e) {
    if (!UI.active || (e.pointerType === "mouse" && e.button !== 0) || (B.Dice && B.Dice.isOpen && B.Dice.isOpen())) return;
    const c = cellAt(e); if (!c) return;
    clearTimeout(hold && hold.t);
    hold = { x: e.clientX, y: e.clientY, c, t: setTimeout(() => {
      if (!hold) return; const [cx, cy] = hold.c; hold = null; UI._noClickUntil = Date.now() + 700;
      try { if (navigator.vibrate) navigator.vibrate(16); } catch (err) {}
      if (UI.onCellHold) UI.onCellHold(cx, cy);
    }, HOLD_MS) };
  }
  function onHoldMove(e) { if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) { clearTimeout(hold.t); hold = null; } }
  function onHoldUp() { if (hold) { clearTimeout(hold.t); hold = null; } }
  function onClick(e) {
    const t = e.target;
    if (t.closest(".bt-panel, .bt-modal, .bd-ov")) return;                         // панель и окна обрабатывает battle-menu.js
    if (UI._noClickUntil && Date.now() < UI._noClickUntil && board && board.contains(t)) { UI._noClickUntil = 0; return; }          // клик после долгого нажатия не считается
    const btn = t.closest("[data-bt]");
    if (btn) { UI.onBtn && UI.onBtn(btn.dataset.bt, btn); return; }
    if (board && board.contains(t)) { const c = cellAt(e); if (c && UI.onCell) UI.onCell(c[0], c[1], e); }
  }

  /* ===== эффекты ===== */
  const centerOf = u => ({ x: (u.x + u.size / 2) * cell, y: (u.y + u.size / 2) * cell });
  function floatText(u, text, cls, big) {
    if (!UI.active || !root) return;
    const fx = root.querySelector(".bt-fx"), c = centerOf(u), el = document.createElement("span");
    el.className = "bt-float " + (cls || "") + (big ? " big" : ""); el.textContent = text;
    el.style.left = c.x + (Math.random() * 16 - 8) + "px"; el.style.top = c.y - u.size * cell * 0.35 + "px";
    fx.appendChild(el); setTimeout(() => el.remove(), 1300);
  }
  const defer = fn => { if (B.Dice && B.Dice.isOpen && B.Dice.isOpen()) UI.pendingFx.push(fn); else fn(); };
  UI.flushFx = () => { const l = UI.pendingFx.splice(0); l.forEach(f => { try { f(); } catch (e) {} }); };
  UI.fxHit = (u, n, dt, crit) => defer(() => {
    floatText(u, "−" + n, "dmg dt-" + dt, crit);
    const el = tokenEls.get(u.id); if (el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 420); }
    UI.refresh();
  });
  UI.fxHeal = (u, n) => defer(() => { floatText(u, "+" + n, "heal"); UI.refresh(); });
  UI.fxText = (u, text, cls) => defer(() => floatText(u, text, cls || ""));
  UI.fxDeath = u => defer(() => { const el = tokenEls.get(u.id); if (el) el.classList.add("dying"); floatText(u, u.side === "mon" ? "повержен" : "погиб", "dmg", true); setTimeout(() => UI.refresh(), 450); });
  UI.fxEscape = u => defer(() => { floatText(u, "уходит", "good"); UI.refresh(); });
  UI.fxCube = (ax, ay, size) => defer(() => {
    const fx = root.querySelector(".bt-fx"), el = document.createElement("div"); el.className = "bt-cube"; el.style.cssText = `left:${ax * cell}px;top:${ay * cell}px;width:${size * cell}px;height:${size * cell}px`;
    fx.appendChild(el); setTimeout(() => el.remove(), 900);
  });
  UI.banner = function (text, ms = 1600) {
    if (!UI.active || !root) return; const b = root.querySelector(".bt-banner"); b.textContent = text; b.classList.add("on");
    clearTimeout(UI._bt); UI._bt = setTimeout(() => b.classList.remove("on"), ms);
  };
  UI.toast = function (msg) {
    if (!UI.active || !root) return; const t = root.querySelector(".bt-toast"); t.textContent = msg; t.hidden = false; t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
    clearTimeout(UI._tt); UI._tt = setTimeout(() => { t.hidden = true; }, 2300);
  };
  UI.animMove = async function (u, from, to) {
    if (!UI.active || B.cfg.fast) return;
    UI.refreshNow(); await sleep(150);
  };
  UI.animAttack = async function (att, tgt, atk, kind) {
    if (!UI.active || B.cfg.fast) return;
    if (B.Dice && B.Dice.isOpen && B.Dice.isOpen()) return;                           // у окна броска своя анимация
    const ea = tokenEls.get(att.id); const a = centerOf(att), t = centerOf(tgt);
    if (atk && atk.kind === "ranged") {
      const fx = root.querySelector(".bt-fx"), p = document.createElement("div"); p.className = "bt-proj k-" + kind; p.style.left = a.x + "px"; p.style.top = a.y + "px"; fx.appendChild(p);
      void p.offsetWidth; p.style.transform = `translate(${t.x - a.x}px, ${t.y - a.y}px) rotate(${Math.atan2(t.y - a.y, t.x - a.x)}rad)`; await sleep(260); p.remove();
    } else if (ea) {
      const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 1;
      ea.style.setProperty("--lx", (dx / d) * cell * 0.38 + "px"); ea.style.setProperty("--ly", (dy / d) * cell * 0.38 + "px");
      ea.classList.remove("lunge"); void ea.offsetWidth; ea.classList.add("lunge"); await sleep(230); ea.classList.remove("lunge");
    }
  };
  UI.focusUnit = function (u) { UI.refresh(); };
  UI.onLog = function (text, cls) { if (UI.renderLogTicker) UI.renderLogTicker(); };

  /* ===== расстановка героев ===== */
  UI.placement = function (S) {
    return new Promise(resolve => {
      S.hideMons = !S.ambush; if (!UI.built) build(S); UI.refreshNow();
      if (S.ambush) {
        UI.mode = "ambush"; UI.banner("Засада! Герои застигнуты врасплох", 3000);
        UI.panelPlace = { ambush: true, done: resolve }; if (UI.renderPanel) UI.renderPanel(); return;
      }
      UI.mode = "place"; UI.placeSel = B.heroes().filter(h => !h.dead)[0]?.id || null;
      UI.panelPlace = { ambush: false, done: resolve }; UI.paintPlace(); if (UI.renderPanel) UI.renderPanel();
      UI.banner("Расставьте героев в трёх нижних рядах", 3200);
    });
  };
  UI.paintPlace = function () {
    const S = B.S, map = new Map();
    for (let y = 4; y < 7; y++) for (let x = 0; x < 7; x++) { const hero = B.byId(UI.placeSel); const occ = B.occupant(x, y, hero); if (hero && !B.obstacleAt(x, y) && !occ) UI.hlAdd(map, x, y, "hl-place"); }
    UI.setHl(map);
  };
  UI.placeDone = function () { UI.setHl(new Map()); UI.mode = "idle"; const p = UI.panelPlace; UI.panelPlace = null; if (p) p.done(); };
  UI.reveal = async function (S) { S.hideMons = false; UI.refreshNow(); const names = B.mons().map(m => m.name).join(", "); UI.banner(`Враги: ${names}`, 2600); await sleep(1000); };
  UI.start = async function (S) { UI.refreshNow(); UI.banner(S.ambush ? "Засада! Монстры ходят первыми" : "Бой начался!", 1600); await sleep(600); };
  UI.turnStart = async function (u) { UI.refreshNow(); UI.banner(u.side === "hero" ? `Ход: ${u.name}` : `Ходит: ${u.name}`, 1100); if (u.side === "mon") await sleep(350); };
  UI.turnEnd = function (u) { UI.refresh(); };
})();
