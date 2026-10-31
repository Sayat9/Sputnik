/* Здания города: магазин, таверна, библиотека, доска объявлений, гильдия приключений, башня магов, церковь.
   Загружается при первом входе в здание (loadTown в index.html). Все цены и правила — черновик, см. ../campaign/drafts.md → «Город».
   Городское время: посещение здания с результатом стоит одно действие (таверна — ночь три), часы — townClock(). */
(function () {
  const T = window.Town = { ready: true };
  const host = document.getElementById("townov");
  const B = {};
  let ui = null;

  /* ---------- цены (черновик) ---------- */
  // Витрины: key — уникальный ключ позиции, e — предмет (для компаса нет), price — цена за штуку набора, many — можно купить ×5.
  const GOODS = [
    { key: "ration", e: { t: "g", id: "ration", qty: 5 }, price: 1 }, { key: "torch", e: { t: "g", id: "torch", qty: 1 }, price: 2, many: true },
    { key: "potion", e: { t: "g", id: "potion", qty: 1 }, price: 3, many: true }, { key: "potion-good", e: { t: "g", id: "potion-good", qty: 1 }, price: 12, many: true },
    { key: "arrow40", e: { t: "g", id: "arrow", qty: 40 }, price: 10, label: "Колчан на 40 стрел" }, { key: "arrow20", e: { t: "g", id: "arrow", qty: 20 }, price: 5, label: "Колчан на 20 стрел" },
    { key: "shovel", e: { t: "g", id: "shovel", qty: 1 }, price: 8 }, { key: "shovel-good", e: { t: "g", id: "shovel-good", qty: 1 }, price: 15 },
    { key: "flute", e: { t: "g", id: "flute", qty: 1 }, price: 8 }, { key: "firstaid", e: { t: "g", id: "firstaid", qty: 1 }, price: 20, many: true }, { key: "compass", special: "compass", price: 30 },
  ];
  const FORGE_W = ["dagger", "spear", "pike", "mace", "warhammer", "sword", "rapier", "greatsword", "gloves", "staff", "axe", "greataxe", "shortbow", "longbow", "shield", "tower-shield"];
  const FORGE_A = ["leather", "hide", "chainmail"];
  const forgeDisc = p => ((state.party || []).some(c => c.race === "dwarf" && !c.dead) ? Math.max(1, Math.round(p * 0.9)) : p);          // дварф в отряде: скидка 10% в кузнице
  const FORGE_PRICE = { weapon: 10, armor: 15, steelWeapon: 25, steelArmor: 40 };               // решение автора
  const FORGE = {
    base: [...FORGE_W.map(id => ({ key: "w:" + id, e: { t: "w", id, qty: 1 }, get price() { return forgeDisc(FORGE_PRICE.weapon); } })), ...FORGE_A.map(id => ({ key: "a:" + id, e: { t: "a", id, qty: 1 }, get price() { return forgeDisc(FORGE_PRICE.armor); } })),
      { key: "repair5", e: { t: "g", id: "repair-kit", qty: 5 }, price: 10, label: "Ремонтный набор ×5" }, { key: "repairpro5", e: { t: "g", id: "repair-kit-pro", qty: 5 }, price: 50, label: "Продвинутый ремонтный набор ×5" }],
    steel: [...FORGE_W.map(id => ({ key: "sw:" + id, e: { t: "w", id, qty: 1, steel: true }, get price() { return forgeDisc(FORGE_PRICE.steelWeapon); } })), ...FORGE_A.map(id => ({ key: "sa:" + id, e: { t: "a", id, qty: 1, steel: true }, get price() { return forgeDisc(FORGE_PRICE.steelArmor); } }))],
  };
  const COMPASS_INFO = () => ({ name: "Компас", icon: ICO_COMPASS, note: "Стрелка показывает север при любом повороте карты. Включается удержанием в инвентаре лабиринта.", weight: 0 });
  const TAVERN = { sleep: 3, food: 1 };                                                           // за героя
  const towerPrice = id => Math.max(1, Math.round(essPrice(id) / 3));                            // детали эссенции в башне — треть её цены, только для впитанной (решение автора)
  const churchPrice = id => essBasePrice(id);                                                    // удаление — полная цена обычной эссенции того же ранга (решение автора)
  const INFO_PRICE = { type: 5, portrait: 8, spawn: 10, body: 10, stats: 15, area: 30, "ess-stats": 45, "ess-passive": 60, "ess-active": 80 };          // сведения дорогие: места обитания — особенно, детали эссенций — ещё дороже
  const CLS_MULT = { 9: 1, 8: 5, 7: 20 };                                                         // как цена камня
  const INFO_SELL = 0.25;                                                                          // доля цены, которую платит гильдия за изученного монстра
  const LIB_PASS = 11;                                                                            // порог броска в библиотеке

  const INFO_LABEL = { type: "Тип", portrait: "Внешность", area: "Места обитания", spawn: "Условия появления", body: "Особенность тела", stats: "Характеристики", "ess-stats": "Эссенция: статы", "ess-passive": "Эссенция: пассивная", "ess-active": "Эссенция: активная" };
  const SHOP_TALK = ["Берите-берите, цены честные… почти.", "Камни? Камни я люблю. Особенно блестящие.", "Лабиринт кормит нас обоих, друг мой.", "Для вас — лучшая цена. Для других — ну, другая.", "Зелья свежие, вчерашние."];
  const talk = () => SHOP_TALK[Math.floor(Math.random() * SHOP_TALK.length)];

  const hero = () => state.party.find(c => c.id === ui.hero) || state.party[0];
  const classMult = m => CLS_MULT[m.cls] || 1;
  const infoPrice = (m, k) => (INFO_PRICE[k] || 5) * classMult(m);
  const html = s => { host.innerHTML = s; };
  const closeBtn = `<button class="fx-btn tw-x" data-t="close" aria-label="Закрыть">${ICO_X}</button>`;

  /* ---------- вход, выход, время ---------- */
  T.open = function (id) {
    if (!B[id]) return;
    ui = { b: id, hero: (state.party[0] || {}).id, sel: null, cost: 0, msg: "", mode: null, pick: null, pickEss: null, confirm: null, lines: null, rolled: null, ...(B[id].init ? B[id].init() : {}) };
    host.hidden = false; document.body.classList.add("forge-open"); render();
  };
  T.close = function () {
    if (!ui) return;
    if (ui.mirror) return;
    const n = ui.cost; host.hidden = true; host.innerHTML = ""; ui = null;
    document.body.classList.remove("forge-open");
    if (n > 0) { const c = townClock(); c.t += n; chaliceTick(n); saveChar(); const gi = gateInfo(); toast(`Прошло городских действий: ${n}. Врата ${gi.open ? "открыты сейчас" : "закрыты ещё " + gi.left + " д."}.`); }
    rerender();
  };
  T.state = () => ui;
  // Клиент игрока: показывает здание, открытое у ведущего (только просмотр, время не тратится).
  T.mirror = snap => { ui = { ...snap, mirror: true }; host.hidden = false; document.body.classList.add("forge-open"); render(); };
  T.unmirror = () => { if (ui && ui.mirror) { ui = null; host.hidden = true; host.innerHTML = ""; document.body.classList.remove("forge-open"); } };
  const spend = n => { ui.cost += n; };
  const visit = () => { ui.cost = Math.max(ui.cost, 1); };

  function render() {
    if (!ui) return;
    const y = host.querySelector(".tw-scroll")?.scrollTop || 0, y2 = host.querySelector(".tw-bagcol")?.scrollTop || 0;
    html(B[ui.b].render());
    const sc = host.querySelector(".tw-scroll"); if (sc) sc.scrollTop = y;
    const bc = host.querySelector(".tw-bagcol"); if (bc) bc.scrollTop = y2;
  }

  /* ---------- общие части ---------- */
  const portrait = c => `<span class="tw-ph">${phPortrait(raceById(c.race))}</span>`;
  function heroStrip(showGold = true) {
    return `<div class="tw-heroes" role="tablist" aria-label="Герои">${state.party.map(c => `<button class="tw-h${c.id === ui.hero ? " on" : ""}" role="tab" aria-selected="${c.id === ui.hero}" data-t="hero" data-id="${c.id}">
      ${portrait(c)}<span class="tw-hn">${esc(c.name)}</span>${showGold ? `<span class="tw-hg">${goldOf(c)}</span>` : ""}</button>`).join("")}</div>`;
  }
  const clockChip = () => { try { const c = townClock(), gi = gateInfo(), n = c.t % 3 + 1; return `<div class="tw-clock" title="Городское время: действие внутри дня и врата лабиринта"><small>День ${Math.floor(c.t / 3) + 1} · действие ${n}/3</small><b>${gi.open ? "врата открыты" : "врата через " + gi.left}</b></div>`; } catch (e) { return ""; } };          // счётчик городского времени
  const head = (title, sub = "") => `<header class="tw-head"><div><div class="fx-eyebrow">${sub}</div><h3>${title}</h3></div>${clockChip()}<div class="tw-gold" title="Монет в отряде">${COIN_SVG}<b>${partyGold()}</b></div>${closeBtn}</header>`;
  const msgLine = () => `<p class="tw-msg" role="status">${ui.msg || ""}</p>`;
  const noParty = () => state.party.length ? "" : `<p class="tw-msg">В отряде нет героев.</p>`;
  const frame = (title, sub, body, foot = "") => `<div class="tw-panel fx-frame">${head(title, sub)}<div class="tw-scroll">${body}</div>${foot ? `<footer class="tw-foot">${foot}</footer>` : ""}</div>`;
  const cellOf = (e, c, attrs, sel) => {
    const it = itemOf(e, c); if (!it) return "";
    return `<button class="cell" ${attrs} aria-pressed="${!!sel}" aria-label="${esc(it.name)}${e.qty > 1 ? ", " + e.qty + " шт." : ""}">${itemThumb(e, c)}${e.qty > 1 ? `<span class="q">${e.qty}</span>` : ""}${e.uses != null ? `<span class="q">${e.uses}</span>` : ""}${it.art ? "" : `<span class="t">${esc(it.short || it.name.split(" ")[0])}</span>`}</button>`;
  };
  const bagGrid = (c, selIdx, cls = "") => `<div class="packwrap"><div class="bag tw-bag ${cls}">${Array.from({ length: bagSize(c) }, (_, i) => {
    const e = (c.bag || [])[i];
    return e ? cellOf(e, c, `data-t="bag" data-i="${i}"`, selIdx === i) : `<div class="cell empty" aria-hidden="true"></div>`;
  }).join("")}</div></div>`;

  /* ---------- лавочник ---------- */
  const KEEPER = `<svg viewBox="0 0 220 128" aria-label="Лавочник с хитрой улыбкой">
    <defs><radialGradient id="kglow" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#f0b443" stop-opacity=".45"/><stop offset="1" stop-color="#f0b443" stop-opacity="0"/></radialGradient>
      <linearGradient id="kskin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fae5a"/><stop offset="1" stop-color="#5f7f3a"/></linearGradient></defs>
    <rect width="220" height="128" fill="#1a120a"/><rect width="220" height="128" fill="url(#kglow)"/>
    <path d="M0 96h220v32H0z" fill="#3b2a18"/><path d="M0 96h220" stroke="#6e5634" stroke-width="2"/>
    <path d="M18 20v-8M18 12l-6 6h12z" stroke="#6e5634" fill="#2a2016"/><circle cx="18" cy="26" r="6" fill="#f0b443" opacity=".85"/><circle cx="202" cy="26" r="6" fill="#f0b443" opacity=".85"/>
    <path d="M56 98c4-22 22-34 54-34s50 12 54 34z" fill="#6b2a22" stroke="#2a0e0a" stroke-width="2"/>
    <path d="M84 84l26 14 26-14" fill="#d6a64c" stroke="#7a5412"/>
    <path d="M62 62l-26-10 10 24 20 4z" fill="#7d9c4c" stroke="#2f421a"/><path d="M158 62l26-10-10 24-20 4z" fill="#7d9c4c" stroke="#2f421a"/>
    <ellipse cx="110" cy="58" rx="48" ry="40" fill="url(#kskin)" stroke="#2f421a" stroke-width="2.4"/>
    <path d="M62 38c6-26 30-34 48-34s42 8 48 34c-16-10-30-12-48-12s-32 2-48 12z" fill="#5b2f1e" stroke="#2a140a" stroke-width="2"/>
    <path d="M84 30l8-20 10 16 8-22 8 22 10-16 8 20z" fill="#e5b84f" stroke="#7a5412"/>
    <path d="M78 46l22 6" stroke="#2a1a0c" stroke-width="3.5" stroke-linecap="round"/><path d="M142 46l-22 6" stroke="#2a1a0c" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M78 58q10-8 22 0q-10 7-22 0z" fill="#f4ecd2" stroke="#2a1a0c" stroke-width="1.6"/><path d="M120 58q10-8 22 0q-10 7-22 0z" fill="#f4ecd2" stroke="#2a1a0c" stroke-width="1.6"/>
    <ellipse cx="91" cy="58" rx="3.2" ry="4.2" fill="#e8a317"/><ellipse cx="131" cy="58" rx="3.2" ry="4.2" fill="#e8a317"/><circle cx="92" cy="58" r="1.4" fill="#120a04"/><circle cx="132" cy="58" r="1.4" fill="#120a04"/>
    <path d="M108 60l-6 14q4 4 8 2z" fill="#6f8f42" stroke="#2f421a"/>
    <path d="M80 80q30 28 60-4" fill="#2a0e0a" stroke="#2a0e0a" stroke-width="2.4"/><path d="M84 80q26 14 54-3" fill="#f4ecd2"/><path d="M84 81l5 6 4-6 5 7 4-6 5 8 5-8 4 6 5-7 4 5" fill="none" stroke="#2a0e0a" stroke-width="1.3"/>
    <path d="M138 74q6 2 8-4" stroke="#2f421a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M30 100l14-10 14 10v28H30z" fill="#4a3322" stroke="#6e5634"/><circle cx="188" cy="106" r="9" fill="#e5b84f" stroke="#7a5412" stroke-width="2"/><circle cx="170" cy="112" r="7" fill="#e5b84f" stroke="#7a5412" stroke-width="2"/>
  </svg>`;

  /* =====================================================================
     МАГАЗИН
     ===================================================================== */
  // Магазин и кузница — один интерфейс с разной витриной.
  const goodsOf = () => ui.b === "forge" ? (FORGE[ui.tab || "base"] || FORGE.base) : GOODS;
  const goodByKey = k => [...GOODS, ...FORGE.base, ...FORGE.steel].find(g => g.key === k);
  const owned = g => g.special === "compass" && inventory().compass.owned;
  const goodInfo = g => g.special === "compass" ? COMPASS_INFO() : (g.label ? { ...itemOf(g.e), name: g.label } : itemOf(g.e));
  const sellsStones = () => ui.b === "shop";
  // Продажа артефактов (Кузница и Башня магов): в отряде — флаги сокровищ и артефакты-предметы в рюкзаках и слотах.
  function artRows() {
    const out = [];
    for (const id of Object.keys(TREASURES)) if (ARTIFACTS[id] && treasure(id).owned) out.push({ key: "t:" + id, id, src: "tr" });
    for (const c of state.party.filter(x => !x.dead)) {
      (c.bag || []).forEach((e, i) => { if (e && e.art && ARTIFACTS[e.art]) out.push({ key: `b:${c.id}:${i}`, id: e.art, src: "bag", c, i, qty: 1 }); else if (e && e.t === "g" && ARTIFACTS[e.id] && !TREASURES[e.id]) out.push({ key: `b:${c.id}:${i}`, id: e.id, src: "bag", c, i, qty: e.qty || 1 }); });
      for (const [sl, e] of Object.entries(c.equip || {})) if (e && ((e.t === "g" && ARTIFACTS[e.id] && !TREASURES[e.id]) || (e.art && ARTIFACTS[e.art]))) out.push({ key: `e:${c.id}:${sl}`, id: e.art || e.id, src: "eq", c, sl });
    }
    return out;
  }
  const artPay = (r, b) => Math.round(artValue(r.id) * artBuyerMult(r.id, b));
  function artSell(key, b) {
    const r = artRows().find(x => x.key === key); if (!r) return;
    const c = hero(), g = artPay(r, b);
    if (r.src === "tr") { const tr = treasure(r.id); tr.owned = false; if (state.run && state.run.tollArmed && r.id === "tollbell") state.run.tollArmed = null; }
    else if (r.src === "bag") { const e = r.c.bag[r.i]; e.qty = (e.qty || 1) - 1; if (e.qty <= 0) r.c.bag.splice(r.i, 1); }
    else delete r.c.equip[r.sl];
    addGold(c, g); visit(); ui.msg = `Продано: ${artName(r.id)} за ${g} монет — ${c.name}.`; saveChar();
  }
  const artSellHtml = b => {
    artSync(); const rows = artRows();
    return rows.length ? `<div class="tw-rows">${rows.map(r => { const A = ARTIFACTS[r.id];
      return `<div class="tw-row"><div class="tw-who"><span class="tw-ph sq" style="display:grid;place-items:center;color:var(--fx-gold)">${A.ico()}</span><div><b>${esc(artName(r.id))}${r.qty > 1 ? " × " + r.qty : ""}</b><small>${A.cls} класс${r.c ? " · у " + esc(r.c.name) : ""}</small></div></div>
        <button class="fx-btn primary" data-t="artsell" data-key="${r.key}" data-b="${b}">${artPay(r, b)}</button></div>`; }).join("")}</div>` : `<p class="tw-msg">Артефактов, которые можно продать, у отряда нет.</p>`;
  };
  function shopSelInfo() {
    const c = hero(), sel = ui.sel;
    if (!sel) return `<span class="tw-hint">Нажми предмет, чтобы купить${sellsStones() ? "; свои расходники — нажми в рюкзаке, камни — из сумки" : ""}. Удержи: описание.</span>`;
    if (sel.side === "bag") {
      const e = (c.bag || [])[sel.i], it = e && itemOf(e, c); if (!it) return "";
      if (ui.b === "shop" && unitPrice(e) > 0) { const q = e.qty || 1, one = sellValue(e, 1), all = sellValue(e, q); return `<b>${esc(it.name)}${q > 1 ? " × " + q : ""}</b><span class="tw-btns">${one ? `<button class="fx-btn" data-t="sell1" data-i="${sel.i}">Продать 1 · +${one}</button>` : ""}<button class="fx-btn primary" data-t="sellall" data-i="${sel.i}"${all ? "" : " disabled"}>Продать${q > 1 ? " все" : ""} · +${all}</button></span><span class="tw-hint">Стандартная цена: за штуку ${(Math.round(unitPrice(e) * 100) / 100)} монет.</span>`; }
      return `<b>${esc(it.name)}${e.qty > 1 ? " × " + e.qty : ""}</b><span class="tw-hint">${sellsStones() ? "Магазин скупает камни (из сумки) и расходники: пайки, зелья, факелы, стрелы, лопаты, аптечки." : "Кузнец ничего не скупает."}</span>`;
    }
    const g = goodByKey(sel.key); if (!g) return "";
    const it = goodInfo(g), q = g.e ? g.e.qty : 1;
    if (owned(g)) return `<b>${esc(it.name)}</b><span class="tw-hint">Компас у отряда уже есть.</span>`;
    const can = partyGold() >= g.price, can5 = g.many && partyGold() >= g.price * 5;
    return `<b>${esc(it.name)}${q > 1 ? " × " + q : ""}</b><span class="tw-btns"><button class="fx-btn primary" data-t="buy" data-n="1"${can ? "" : " disabled"}>Купить · −${g.price}</button>${g.many ? `<button class="fx-btn" data-t="buy" data-n="5"${can5 ? "" : " disabled"}>×5 · −${g.price * 5}</button>` : ""}${g.special !== "compass" && g.e ? `<button class="fx-btn" data-t="bm-open"${can ? "" : " disabled"}>Купить несколько…</button>` : ""}</span>
      <span class="tw-hint">Получит и заплатит: ${esc(c.name)}${goldOf(c) < g.price ? " (остальное добавят другие)" : ""}</span>`;
  }
  const SMITH = `<svg viewBox="0 0 220 128" aria-label="Кузнец">
    <defs><radialGradient id="fglow" cx=".25" cy=".55" r=".7"><stop offset="0" stop-color="#ff8a2a" stop-opacity=".6"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient>
      <linearGradient id="sskin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a27a"/><stop offset="1" stop-color="#a8704a"/></linearGradient></defs>
    <rect width="220" height="128" fill="#1a120a"/><rect width="220" height="128" fill="url(#fglow)"/>
    <path d="M10 128V70q0-26 28-26t28 26v58z" fill="#2a1a10" stroke="#6e5634" stroke-width="2"/><path d="M22 128v-44q0-14 16-14t16 14v44z" fill="#ff7a1a" opacity=".85"/><path d="M28 128v-30q0-8 10-8t10 8v30z" fill="#ffd24a" opacity=".9"/>
    <path d="M96 128v-20h28v20z" fill="#3a3a44" stroke="#14141a" stroke-width="2"/><path d="M84 104h52l-6-12H90z" fill="#55555f" stroke="#14141a" stroke-width="2"/><path d="M136 100h22l-6 6h-16z" fill="#55555f" stroke="#14141a"/>
    <path d="M150 128c2-26 14-40 34-40s32 14 34 40z" fill="#5a3a22" stroke="#2a1a0c" stroke-width="2"/><path d="M168 92h32l-4 36h-24z" fill="#3b2a1a" stroke="#2a1a0c"/>
    <ellipse cx="184" cy="64" rx="26" ry="28" fill="url(#sskin)" stroke="#5a3a22" stroke-width="2.2"/>
    <path d="M158 62q0 36 26 40q26-4 26-40q-8 18-26 18t-26-18z" fill="#8a4a22" stroke="#4a260e" stroke-width="2"/>
    <path d="M160 54q4-26 24-26t24 26q-12-8-24-8t-24 8z" fill="#8a4a22" stroke="#4a260e" stroke-width="2"/>
    <path d="M168 54l10 3M200 54l-10 3" stroke="#2a1a0c" stroke-width="3" stroke-linecap="round"/><ellipse cx="174" cy="60" rx="3" ry="3.4" fill="#f4ecd2"/><ellipse cx="194" cy="60" rx="3" ry="3.4" fill="#f4ecd2"/><circle cx="174.5" cy="60.5" r="1.4" fill="#120a04"/><circle cx="194.5" cy="60.5" r="1.4" fill="#120a04"/>
    <path d="M176 78q8 6 16 0" stroke="#2a0e0a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M60 40l12-14 6 6-12 14z" fill="#8a8a94" stroke="#2a2a30" stroke-width="2"/><path d="M52 52l12 6" stroke="#6a4a2a" stroke-width="5" stroke-linecap="round"/>
    <circle cx="112" cy="84" r="1.6" fill="#ffd24a"/><circle cx="122" cy="80" r="1.2" fill="#ff9a2a"/><circle cx="104" cy="78" r="1.2" fill="#ff9a2a"/>
  </svg>`;
  const SMITH_TALK = ["Сталь не врёт, а вот мастера — бывает.", "Бери, пока горячо!", "Острое — для врагов, не для кошелька.", "Хорошая броня дешевле лекаря."];
  function renderShop() {
    const c = hero(), forge = ui.b === "forge", title = forge ? "Кузница" : "Магазин";
    if (!c) return frame(title, "Рафдония", noParty());
    const left = `<aside class="tw-bagcol">${heroStrip()}<div class="gold-row">${COIN_SVG}<b>${goldOf(c)}</b><small>монет у героя</small></div>${bagGrid(c, ui.sel && ui.sel.side === "bag" ? ui.sel.i : null)}${forge ? "" : sackTile()}</aside>`;
    const tabs = forge ? `<div class="tw-tabs"><button class="fx-btn" role="tab" aria-selected="${(ui.tab || "base") === "base"}" data-t="ftab" data-k="base">Обычное</button><button class="fx-btn" role="tab" aria-selected="${ui.tab === "steel"}" data-t="ftab" data-k="steel">Улучшенное</button><button class="fx-btn" role="tab" aria-selected="${ui.tab === "art"}" data-t="ftab" data-k="art">Скупка</button><button class="fx-btn" role="tab" aria-selected="${ui.tab === "fix"}" data-t="ftab" data-k="fix">Починка</button></div>` : "";
    if (forge && (ui.tab === "art" || ui.tab === "fix")) {
      const right0 = `<section class="tw-shopcol"><div class="tw-keeper">${img("assets/npc/smith.webp", "Кузнец")}<div class="tw-bubble">${ui.tab === "fix" ? "Что сломалось — несите, всё починю." : "Редкие вещи беру за хорошие деньги."}</div></div><div class="tw-sheet"><div class="tw-rod"></div><div class="tw-sheet-in">${tabs}${ui.tab === "fix" ? fixHtml(c) : artSellHtml("forge")}</div></div></section>`;
      return `<div class="tw-panel fx-frame">${head(title, "Рафдония")}<div class="tw-shop">${left}${right0}</div><footer class="tw-foot">${msgLine()}</footer></div>`;
    }
    const sheet = `<div class="tw-sheet"><div class="tw-rod"></div><div class="tw-sheet-in">${tabs}<div class="tw-stock">${goodsOf().map(g => {
      const it = goodInfo(g), sel = ui.sel && ui.sel.side === "shop" && ui.sel.key === g.key, own = owned(g), q = g.e ? g.e.qty : 1;
      return `<button class="tw-slot${own ? " own" : ""}${it.steel ? " steel" : ""}" data-t="stock" data-id="${g.key}" aria-pressed="${!!sel}" aria-label="${esc(it.name)}, ${g.price} монет">
        <span class="tw-img">${it.art ? img(it.art, it.name) : (it.icon || GEAR_ICON.custom)}${q > 1 ? `<span class="q">×${q}</span>` : ""}${it.steel ? `<span class="q st">сталь</span>` : ""}</span>
        <span class="tw-name">${esc(it.name)}</span><span class="tw-price${partyGold() < g.price ? " no" : ""}">${COIN_SVG}${own ? "есть" : g.price}</span></button>`; }).join("")}</div>
      <p class="tw-buyline">${forge ? "Оружие — 10, броня — 15, улучшенное оружие — 25, улучшенная броня — 40 монет. Сталь: +1 к атаке и урону, +1 КД." : `Скупаю камни из сумки: 9 класс — ${stonePrice(9)}, 8 класс — ${stonePrice(8)}, 7 класс — ${stonePrice(7)} монет. Перетащи сумку на лавочника или нажми на неё.`}</p></div></div>`;
    const right = `<section class="tw-shopcol"><div class="tw-keeper">${forge ? img("assets/npc/smith.webp", "Кузнец") : KEEPER}<div class="tw-bubble">${esc(ui.talk || (ui.talk = forge ? SMITH_TALK[Math.floor(Math.random() * SMITH_TALK.length)] : talk()))}</div></div>${sheet}</section>`;
    return `<div class="tw-panel fx-frame">${head(title, "Рафдония")}<div class="tw-shop">${left}${right}</div><footer class="tw-foot">${msgLine()}<div class="tw-sel">${shopSelInfo()}</div></footer>${ui.sk ? skHtml() : ""}${ui.bm ? bmHtml() : ""}</div>`;
  }
  /* ---------- починка в кузнице (решение автора 28.10): целое оружие и броню — до максимума за 5 монет (комплект — 10), сломанное — за 20 % полной цены ---------- */
  const fixFull = e => (e.art ? artValue(e.art) : e.steel ? (e.t === "a" ? FORGE_PRICE.steelArmor : FORGE_PRICE.steelWeapon) : (e.t === "a" ? FORGE_PRICE.armor : FORGE_PRICE.weapon));
  const fixPrice = e => (e.broken ? Math.max(1, Math.round(fixFull(e) * 0.2)) : 5);                // скидка дварфа на починку не действует: цены автора 5 / 10 / 20 %
  const fixNeed = e => isDurable(e) && (e.broken || durOf(e) < durMax(e));
  const fixItems = c => [...Object.entries(c.equip || {}).filter(([, e]) => isDurable(e)).map(([sl, e]) => ({ e, key: "eq:" + sl, where: ({ main: "в правой руке", off: "в левой руке", body: "надето" })[sl] || "надето" })),
    ...(c.bag || []).map((e, i) => ({ e, key: "bag:" + i, where: "в рюкзаке" })).filter(x => isDurable(x.e))];
  const fixSetItems = c => ["main", "off", "body"].map(sl => (c.equip || {})[sl]).filter(e => isDurable(e) && !e.broken && durOf(e) < durMax(e));
  const fixSetPrice = c => Math.min(5 * fixSetItems(c).length, 10);
  function fixHtml(c) {
    const rows = fixItems(c).filter(x => fixNeed(x.e)).map(x => `<div class="tw-row"><div class="tw-who"><div><b>${esc(itemOf(x.e).name)}</b><small>${x.where} · прочность ${durOf(x.e)}/${durMax(x.e)}${x.e.broken ? " · сломано: 20 % цены" : ""}</small></div></div>
      <button class="fx-btn primary" data-t="fixone" data-k="${x.key}"${partyGold() >= fixPrice(x.e) ? "" : " disabled"}>${fixPrice(x.e)}</button></div>`).join("");
    const n = fixSetItems(c).length;
    return `<p class="tw-lead">Целое оружие и броню кузнец доводит до полной прочности: 5 монет за вещь, 10 — за весь комплект (оружие, броня и второе оружие). Сломанное — 20 % полной цены вещи.</p>
      ${n >= 2 ? `<div style="display:flex;justify-content:center;margin:6px 0"><button class="fx-btn primary" data-t="fixset"${partyGold() >= fixSetPrice(c) ? "" : " disabled"}>Весь комплект (${n}) — ${fixSetPrice(c)}</button></div>` : ""}
      <div class="tw-rows">${rows || `<p class="tw-msg">У ${esc(c.name)} всё цело.</p>`}</div>`;
  }
  function fixOne(k) {
    const c = hero(), [src, v] = k.split(":"), e = src === "eq" ? (c.equip || {})[v] : (c.bag || [])[+v];
    if (!e || !fixNeed(e)) return;
    const price = fixPrice(e); if (!payGold(c, price)) { ui.msg = "Не хватает монет."; return; }
    const was = e.broken; durFix(e, 999); visit(); ui.msg = `${itemOf(e).name}: ${was ? "сломанное починено" : "починено до максимума"} за ${price}.`; saveChar();
  }
  function fixSet() {
    const c = hero(), list = fixSetItems(c), price = fixSetPrice(c); if (list.length < 2) return;
    if (!payGold(c, price)) { ui.msg = "Не хватает монет."; return; }
    list.forEach(e => durFix(e, 999)); visit(); ui.msg = `Комплект починен (${list.length} вещи) за ${price}.`; saveChar();
  }
  // Сумка для камней в левой колонке: нажатие или перетаскивание на лавочника открывает окно продажи.
  function sackTile() {
    const rows = sackRows(), n = rows.reduce((a, r) => a + r.qty, 0), val = rows.reduce((a, r) => a + r.qty * r.price, 0);
    return `<button class="tw-sacktile" data-t="sacktile" aria-label="Сумка для камней: ${n} камней"><span class="tw-sackico">${ICO_SACK}</span><span><b>Сумка для камней</b><small>${n ? `${n} шт. · продать за ${val}` : "пока пусто"}</small></span></button>`;
  }
  // Окно продажи: слева галочка, имя и класс, ползунок количества, справа сумма; кнопка «Продать» закреплена внизу.
  function skInit() { const sel = {}, num = {}; for (const r of sackRows()) { sel[r.key] = true; num[r.key] = r.qty; } return { sel, num }; }
  const skRows = () => sackRows().map(r => ({ ...r, take: Math.max(0, Math.min(r.qty, ui.sk.num[r.key] ?? r.qty)), on: ui.sk.sel[r.key] !== false }));
  const skTotal = () => skRows().filter(r => r.on).reduce((a, r) => ({ n: a.n + r.take, g: a.g + r.take * r.price }), { n: 0, g: 0 });
  function skHtml() {
    const rows = skRows(), t = skTotal();
    return `<div class="tw-dlg" role="dialog" aria-label="Продажа камней"><div class="tw-sk fx-frame">
      <div class="tw-sk-top"><span class="tw-sackico">${ICO_SACK}</span><b>Сумка для камней</b><button class="fx-btn tw-x" data-t="sk-close" aria-label="Закрыть">${ICO_X}</button></div>
      ${rows.length ? `<div class="tw-sk-list">${rows.map(r => `<div class="tw-sk-row${r.on ? "" : " off"}" data-key="${r.key}">
          <input type="checkbox" class="tw-sk-chk" data-t="sk-chk" data-key="${r.key}"${r.on ? " checked" : ""} aria-label="Продать: ${esc(r.name)}">
          <span class="tw-sk-name"><b>${esc(r.name)}</b><small>${r.cls} класс · по ${r.price}</small></span>
          <span class="tw-sk-pick"><input type="range" class="tw-range tw-sk-range" min="1" max="${r.qty}" value="${r.take || 1}" data-key="${r.key}"${r.on ? "" : " disabled"} aria-label="Сколько продать: ${esc(r.name)}"><output class="tw-sk-n">${r.take}/${r.qty}</output></span>
          <span class="tw-sk-sum">${r.on ? "+" + r.take * r.price : "—"}</span></div>`).join("")}</div>` : `<p class="tw-lead" style="padding:14px 4px">В сумке пусто: камни падают с монстров и попадают сюда.</p>`}
      <div class="tw-sk-foot"><span class="tw-sk-total">Продать <b>${t.n}</b> камней → <b>+${t.g}</b> монет</span><button class="fx-btn primary big" data-t="sk-sell"${t.n ? "" : " disabled"}>Продать</button></div></div></div>`;
  }
  // «Купить несколько»: окно с ползунком (сколько штук/наборов), максимум — сколько позволяют монеты отряда (до 99)
  const bmMax = g => Math.max(1, Math.min(99, Math.floor(partyGold() / Math.max(1, g.price))));
  function bmHtml() {
    const g = goodByKey(ui.bm.key); if (!g) return "";
    const it = goodInfo(g), q = g.e ? g.e.qty : 1, max = bmMax(g), n = Math.min(ui.bm.n, max), cost = g.price * n, can = partyGold() >= g.price;
    return `<div class="tw-dlg" role="dialog" aria-label="Купить несколько"><div class="tw-dlg-card fx-frame">
      <div class="tw-dlg-top"><div><b>${esc(it.name)}${q > 1 ? " × " + q : ""}</b><small>${g.price} монет за ${q > 1 ? "набор" : "штуку"}</small></div></div>
      <div class="tw-dlg-row"><button class="fx-btn" data-t="bm-d" data-d="-1" aria-label="Меньше">−</button><input type="range" class="tw-range tw-bm-range" min="1" max="${max}" value="${n}" aria-label="Сколько купить"><button class="fx-btn" data-t="bm-d" data-d="1" aria-label="Больше">+</button></div>
      <p class="tw-dlg-sum">Купить <b class="tw-bm-n">${n}</b>${q > 1 ? " × " + q + " = " + n * q + " шт." : ""} · <b class="tw-bm-cost">−${cost}</b> монет</p>
      <div class="tw-btns"><button class="fx-btn" data-t="bm-close">Отмена</button><button class="fx-btn primary" data-t="bm-buy"${can ? "" : " disabled"}>Купить</button></div></div></div>`;
  }
  function openSell() { if (!sellsStones()) return; ui.sk = skInit(); }
  function skSell() {
    const c = hero(), rows = skRows().filter(r => r.on && r.take > 0); if (!rows.length) return;
    let n = 0, g = 0;
    for (const r of rows) { const it = sack().items[r.key]; it.qty -= r.take; n += r.take; g += r.take * r.price; }
    addGold(c, g); visit(); ui.talk = talk(); ui.msg = `Продано камней: ${n} за ${g} монет — ${c.name}.`; ui.sk = sackRows().length ? skInit() : null; saveChar();
  }
  B.shop = { render: renderShop, init: () => ({ sheet: true }) };
  B.forge = { render: renderShop, init: () => ({ sheet: true, tab: "base" }) };

  /* =====================================================================
     ТАВЕРНА
     ===================================================================== */
  const carryOf = c => c.carry || (c.carry = { sat: 3, starve: 0, awake: 0, fat: 0 });
  const hungerText = st => st.starve >= 3 ? "голоден" : st.sat <= 0 ? "хочет есть" : `сыт на ${st.sat} д.`;
  B_tavern();
  function B_tavern() {
    B.tavern = {
      init: () => ({ sleep: {}, food: {} }),
      render() {
        if (!state.party.length) return frame("Таверна", "Рафдония", noParty());
        const live = state.party.filter(c => !c.dead);
        const locked = !!state.arenaLock;
        if (locked) ui.sleep = {};
        const total = live.reduce((a, c) => a + (ui.sleep[c.id] ? TAVERN.sleep : 0) + (ui.food[c.id] ? TAVERN.food : 0), 0);
        const rows = live.map(c => { const st = carryOf(c);
          return `<div class="tw-row"><div class="tw-who">${portrait(c)}<div><b>${esc(c.name)}</b><small>Усталость ${st.fat}/4 · ${hungerText(st)} · ОЗ ${hpOf(c)}/${maxHp(c)}</small></div></div>
            <div class="tw-chk"><button class="fx-btn${ui.sleep[c.id] ? " on" : ""}" data-t="tv" data-k="sleep" data-id="${c.id}" aria-pressed="${!!ui.sleep[c.id]}"${locked ? " disabled" : ""}>Сон · ${TAVERN.sleep}</button>
            <button class="fx-btn${ui.food[c.id] ? " on" : ""}" data-t="tv" data-k="food" data-id="${c.id}" aria-pressed="${!!ui.food[c.id]}">Еда · ${TAVERN.food}</button></div></div>`; }).join("");
        const body = `<div class="tw-npc">${img("assets/npc/innkeeper.webp", "Хозяин таверны")}<span>Добро пожаловать! Кровать мягкая, эль холодный.</span></div>${locked ? `<p class="tw-msg" style="color:var(--fx-danger)">После боя на арене раны не успеют зажить: ночлег недоступен до следующего спуска (еда — можно).</p>` : ""}<p class="tw-lead">Ночлег снимает усталость и лечит, ужин и завтрак — сытость на заход. Без них следующий спуск начнётся с усталостью и голодом. Ночь занимает три городских действия, еда — одно.</p>
          <div class="tw-rows">${rows}</div>${msgLine()}`;
        const sleepers = live.filter(c => ui.sleep[c.id]).length, eaters = live.filter(c => ui.food[c.id]).length;
        const foot = `<div class="tw-sel"><b>К оплате: ${total}</b><span class="tw-hint">У отряда: ${partyGold()} монет · спят: ${sleepers}, едят: ${eaters}</span><span class="tw-btns"><button class="fx-btn" data-t="tv-all">${locked ? "Всем еда" : "Всем всё"}</button><button class="fx-btn primary" data-t="tv-pay"${total > 0 && partyGold() >= total ? "" : " disabled"}>Оплатить</button></span></div>`;
        return frame("Таверна", "Рафдония", body, foot);
      },
    };
  }

  /* =====================================================================
     БИБЛИОТЕКА (поиск сведений броском)
     ===================================================================== */
  function infoPool() {
    const j = journal(), out = [];
    for (const m of libMonsters()) {
      const rec = j.known[m.id];
      if (!rec) { const h = j.hints[m.id] || []; for (const k of ["type", "portrait"]) if (!h.includes(k)) out.push({ m, k, hint: true }); }
      else { migrateRevealed(rec); for (const x of monSections(m)) if (!rec.revealed.includes(x.k)) out.push({ m, k: x.k }); }
    }
    return out;
  }
  function grantInfo(it) {
    const j = journal();
    if (it.hint) { (j.hints[it.m.id] ||= []).push(it.k); return; }
    const rec = j.known[it.m.id]; if (rec && !rec.revealed.includes(it.k)) rec.revealed.push(it.k);
  }
  const infoName = it => it.hint ? `неизвестный монстр (${it.m.cls} класс)` : it.m.name;
  B_library();
  /* ---- Библиотека: исследование по этапам (решение автора 25.10.2026, числа — черновик) ----
     Категория (пока только монстры) → кто проверяет → класс монстра (9 или 8; Сл 10 / 14) → четыре проверки подряд:
     тип (гоблины / звери / нежить / элементали), ранг (обычный / редкий / особый), известный или новый, вид сведений.
     Бонус проверки героя — мод. Интеллекта + мод. Проницательности (Мудрости). Успех — выбираешь сам, провал — случайно.
     Сведения об эссенции предлагаются только при выпавших 19–20 на последней проверке. Всё исследование — одно городское действие. */
  const LIB_DC = { 9: 10, 8: 14 };
  const RANK_RU = { normal: "Обычные", rare: "Редкие", special: "Особые" };
  const NOVEL_RU = { known: "Уже известный", new: "Новый (ещё не открыт)" };
  const STAGES = [["kind", "Тип монстра"], ["rank", "Ранг: обычный, редкий или особый"], ["novel", "Известный или новый монстр"], ["info", "Вид сведений"]];
  const rankGroup = m => { const r = rankOf(m); return r === "normal" || r === "rare" ? r : "special"; };
  const libBonus = c => { const t = totals(c); return mod(t.int.total) + mod(t.wis.total); };
  const libCands = cls => MONSTERS.filter(m => !m.draft && m.floor === 1 && m.cls === cls);
  const essKey = k => /^ess-/.test(k);
  // Какие сведения о монстре ещё не раскрыты (эссенция — только если lr.essOK).
  function lrInfoOpts(m, essOK) {
    const rec = journal().known[m.id]; if (rec) migrateRevealed(rec);
    return monSections(m).filter(x => (essOK || !essKey(x.k)) && !(rec && rec.revealed.includes(x.k))).map(x => ({ k: x.k, label: (x.group ? x.group + ": " : "") + x.label }));
  }
  function lrFiltered(lr, upto) {
    let c = lr.cand;
    if (upto > 0 && lr.picks.kind) c = c.filter(m => m.zone === lr.picks.kind);
    if (upto > 1 && lr.picks.rank) c = c.filter(m => rankGroup(m) === lr.picks.rank);
    if (upto > 2 && lr.picks.novel) c = c.filter(m => (lr.picks.novel === "new") === !journal().known[m.id]);
    return c;
  }
  function lrOptions(lr) {
    const st = STAGES[lr.stage][0], c = lrFiltered(lr, lr.stage);
    if (st === "kind") return [...new Set(c.map(m => m.zone))].map(v => ({ v, label: KIND_RU[v] || v }));
    if (st === "rank") return ["normal", "rare", "special"].filter(r => c.some(m => rankGroup(m) === r)).map(v => ({ v, label: RANK_RU[v] }));
    if (st === "novel") return ["known", "new"].filter(n => c.some(m => (n === "new") === !journal().known[m.id] && (n === "new" || lrInfoOpts(m, lr.essOK).length))).map(v => ({ v, label: NOVEL_RU[v] }));
    return lr.mon ? lrInfoOpts(lr.mon, lr.essOK).map(o => ({ v: o.k, label: o.label })) : [];
  }
  // Переходит к следующему этапу, пропуская те, где выбирать не из чего.
  function lrAdvance(lr) {
    for (;;) {
      if (lr.stage >= STAGES.length) { lrFinish(lr); return; }
      if (STAGES[lr.stage][0] === "info" && !lr.mon) {                                  // монстр определён после трёх первых этапов
        const pool = lrFiltered(lr, 3).filter(m => lrInfoOpts(m, lr.essOK).length);
        if (!pool.length) { lr.step = "empty"; return; }
        lr.mon = pool[rnd(pool.length)];
      }
      const o = lrOptions(lr);
      if (!o.length && STAGES[lr.stage][0] !== "info") { lr.stage++; continue; }
      if (o.length === 1 && STAGES[lr.stage][0] !== "info") { lr.picks[STAGES[lr.stage][0]] = o[0].v; lr.log.push(`${STAGES[lr.stage][1]}: единственный вариант — ${o[0].label}.`); lr.stage++; continue; }
      if (!o.length) { lr.step = "empty"; return; }
      lr.step = "stage"; lr.choosing = false; return;
    }
  }
  function lrFinish(lr) {
    const m = lr.mon, k = lr.picks.info; if (!m || !k) { lr.step = "empty"; return; }
    const isNew = !journal().known[m.id];
    seenKeys(m.id, [k]);
    const lab = (monSections(m).find(x => x.k === k) || {}).label || k;
    lr.result = `${isNew ? "Новая запись в библиотеке: " : ""}${m.name} (${m.cls} класс) — ${lab}.`;
    lr.step = "done"; saveChar();
  }
  function lrRoll(n) {
    const lr = ui.lr; if (!lr || lr.step !== "stage" || lr.choosing) return;
    const c = state.party.find(x => x.id === lr.hero) || hero(), bonus = libBonus(c), dc = LIB_DC[lr.cls], die = n || window.__libDie || 1 + rnd(20), total = die + bonus, pass = total >= dc;
    visit();
    const name = STAGES[lr.stage][1];
    if (STAGES[lr.stage][0] === "info" && die >= 19) lr.essOK = true;
    lr.lastRoll = { die, bonus, total, dc, pass };
    if (pass) { lr.choosing = true; lr.log.push(`${name}: к20 ${die}${bonus ? (bonus > 0 ? " + " : " − ") + Math.abs(bonus) : ""} = ${total} против Сл ${dc} — успех, выбираешь сам.`); return; }
    const o = lrOptions(lr), pick = o.length ? o[rnd(o.length)] : null;
    lr.log.push(`${name}: к20 ${die}${bonus ? (bonus > 0 ? " + " : " − ") + Math.abs(bonus) : ""} = ${total} против Сл ${dc} — провал, выбрано случайно${pick ? ": " + pick.label : ""}.`);
    if (pick) lrApply(lr, pick.v);
  }
  function lrApply(lr, v) {
    lr.picks[STAGES[lr.stage][0]] = v; lr.stage++; lr.choosing = false; lrAdvance(lr);
  }
  const lrMsg = () => `<p class="tw-msg">${ui.msg || ""}</p>`;
  function lrHtml() {
    const lr = ui.lr;
    const log = lr && lr.log.length ? `<div class="tw-result fx-frame">${lr.log.map(l => `<p>${esc(l)}</p>`).join("")}</div>` : "";
    if (!lr || lr.step === "cat") return `<p class="tw-lead">Пыльные тома и записки прежних отрядов. Выбери, о чём искать сведения. Исследование занимает одно городское действие.</p>
      <div class="tw-rows"><div class="tw-row"><div class="tw-who"><div><b>Предметы</b><small>скоро</small></div></div><button class="fx-btn" disabled>Скоро</button></div>
      <div class="tw-row"><div class="tw-who"><div><b>Монстры</b><small>тип, ранг, место обитания, особенности</small></div></div><button class="fx-btn primary" data-t="lr-cat" data-k="monsters">Выбрать</button></div></div>`;
    if (lr.step === "hero") return `<p class="tw-lead">Кто проходит проверки? Бонус — модификатор Интеллекта плюс Проницательности (Мудрости).</p>
      <div class="tw-rows">${state.party.filter(c => !c.dead).map(c => `<div class="tw-row"><div class="tw-who"><span class="tw-ph">${phPortrait(raceById(c.race))}</span><div><b>${esc(c.name)}</b><small>бонус ${libBonus(c) >= 0 ? "+" : ""}${libBonus(c)}</small></div></div><button class="fx-btn primary" data-t="lr-hero" data-id="${c.id}">Выбрать</button></div>`).join("")}</div>
      <button class="fx-btn" data-t="lr-back">← Назад</button>`;
    if (lr.step === "cls") return `<p class="tw-lead">О каких монстрах искать? Чем выше класс, тем сложнее проверки (растёт с 9 класса).</p>
      <div class="tw-rows">${Object.keys(LIB_DC).map(Number).map(cl => { const open = journal().tiers.includes(cl) && libCands(cl).length; return `<div class="tw-row"><div class="tw-who"><div><b>${cl} класс</b><small>Сл ${LIB_DC[cl]}${open ? "" : " · пока не открыт"}</small></div></div><button class="fx-btn primary" data-t="lr-cls" data-n="${cl}"${open ? "" : " disabled"}>Выбрать</button></div>`; }).join("")}</div>
      <button class="fx-btn" data-t="lr-back">← Назад</button>`;
    if (lr.step === "stage") {
      const c = state.party.find(x => x.id === lr.hero) || hero(), bonus = libBonus(c), dc = LIB_DC[lr.cls], opts = lrOptions(lr);
      const head = `<p class="tw-lead"><b>Этап ${lr.stage + 1} из ${STAGES.length}: ${STAGES[lr.stage][1]}.</b> Проверяет ${esc(c.name)}: бонус ${bonus >= 0 ? "+" : ""}${bonus}, Сл ${dc}. Успех — выбираешь сам, провал — случайно.</p>`;
      if (lr.choosing) return `${head}${log}<div class="tw-rows">${opts.map(o => `<div class="tw-row"><div class="tw-who"><div><b>${esc(o.label)}</b></div></div><button class="fx-btn primary" data-t="lr-pick" data-v="${esc(o.v)}">Выбрать</button></div>`).join("")}</div>`;
      return `${head}${log}<p class="tw-lead">Проверку бросает сама библиотека, в итоге видно только результат.</p>
        <button class="fx-btn primary" data-t="lr-roll" data-n="0" style="margin-top:8px">Провести проверку</button>`;
    }
    if (lr.step === "done") return `${log}<div class="tw-result fx-frame"><p><b>Найдено:</b> ${esc(lr.result)}</p><p style="opacity:.75;font-size:13px">Запись попала в библиотеку (кнопка «Библиотека» на главном экране и в лабиринте).</p></div>
      <button class="fx-btn primary" data-t="lr-restart">Ещё одно исследование</button>`;
    return `${log}<p class="tw-msg">По этим условиям в библиотеке больше нечего найти.</p><button class="fx-btn primary" data-t="lr-restart">Начать заново</button>`;
  }
  function B_library() {
    B.library = {
      render() { return frame("Библиотека", "Рафдония", `${noParty()}${state.party.length ? lrHtml() : ""}${lrMsg()}`); },
    };
  }
  function libRoll(n) {
    const pool = infoPool(); spend(1); ui.rolled = n;
    if (n < LIB_PASS) { ui.lines = [`к20 = ${n}: ничего полезного не нашлось.`]; return; }
    const lines = [`к20 = ${n}: нашлось сведение.`], count = n === 20 ? 2 : 1;
    for (let i = 0; i < count && pool.length; i++) {
      const it = pool.splice(rnd(pool.length), 1)[0]; grantInfo(it);
      lines.push(`${infoName(it)} — ${INFO_LABEL[it.k] || it.k}.`);
    }
    ui.lines = lines; saveChar();
  }

  /* =====================================================================
     ДОСКА ОБЪЯВЛЕНИЙ
     ===================================================================== */
  const questMon = q => MONSTERS.find(m => m.id === q.mon);
  function questSheet(q) {
    const m = questMon(q), have = questStones(q), left = QUEST_RUNS - q.runs, last = q.taken && q.runs >= QUEST_RUNS;
    const status = !q.taken ? `Висит на доске. Если не взять — сорвут через заход.`
      : last ? `Последний шанс сдать: после следующего спуска задание сгорит.`
      : `Заходов осталось: ${left} из ${QUEST_RUNS}.`;
    const act = (q.taken ? "" : `<button class="fx-btn primary" data-t="qaccept" data-id="${q.id}">Принять</button>`)
      + `<div class="tw-qprog">В сумке: <b>${have} / ${q.need}</b></div>` + (q.taken ? `<button class="fx-btn primary" data-t="qdone" data-id="${q.id}"${have >= q.need ? "" : " disabled"}>Сдать</button>` : "");
    return `<article class="tw-sheetq${q.rare ? " rare" : ""}${q.taken ? " taken" : ""}" aria-label="Охота: ${esc(m.name)}"><i class="tw-pin"></i>
      <small class="tw-qk">Охота${q.rare ? " · редкие" : ""}</small>
      <div class="tw-qmon"><span class="tw-ph sq">${img(monArt(m), m.name)}</span><div><b>${esc(m.name)}</b><small>${m.cls} класс</small></div></div>
      <p>Принести <b>${q.need}</b> камней: ${esc(m.name)}.<br>Награда: <b>${q.reward}</b> монет отряду.</p>
      <p class="tw-qnote">${status}</p>${act}</article>`;
  }
  B.board = {
    init: () => ({ cost: 1 }),                                                  // решение автора: поход к доске заданий — одно городское действие
    render() {
      const list = questBoard().list;
      return `<div class="tw-panel tw-boardpanel"><button class="fx-btn tw-x tw-xc" data-t="close" aria-label="Закрыть">${ICO_X}</button>
        <div class="tw-wall"><div class="tw-plank">Доска объявлений</div>
          <div class="tw-sheets">${list.map(questSheet).join("")}
            <article class="tw-sheetq news"><i class="tw-pin"></i><small class="tw-qk">События</small><p>Сейчас в городе тихо. Новости появятся здесь.</p></article></div>
          ${list.length ? "" : `<p class="tw-qempty">Заданий пока нет: они появятся, когда отряд вернётся из лабиринта.</p>`}
          <p class="tw-msg">${ui.msg || ""}</p></div></div>`;
    },
  };
  function questAccept(id) { const q = questBoard().list.find(x => x.id === +id); if (!q || q.taken) return; q.taken = true; q.runs = 0; ui.msg = `Задание принято всем отрядом: ${questMon(q).name}, ${q.need} камней (уже лежащие в сумке считаются).`; saveChar(); }
  function questDone(id) {
    const q = questBoard().list.find(x => x.id === +id); if (!q || !q.taken || questStones(q) < q.need) return;
    const name = questMon(q).name, reward = q.reward; questTurnIn(q); visit(); ui.msg = `Задание выполнено: «${name}». Награда ${reward} монет поделена на отряд.`; saveChar();
  }

  /* =====================================================================
     АРЕНА: ставки на бои монстров и бой отряда
     ===================================================================== */
  const ARENA_PAY = 3;                                                                            // монет за убитого 9 класса: тройная цена камня (решение автора)
  const ARENA_FIGHT_MAX = 6;
  const arenaPool = rare => MONSTERS.filter(m => m.floor === 1 && m.cls === 9 && !m.draft && !!m.rare === rare);
  const arenaMon = () => { const rare = Math.random() < .1 && arenaPool(true).length, pool = arenaPool(!!rare); return pool[rnd(pool.length)]; };
  // Сила монстра для ставок: ОЗ × защита × средний урон (грубо; ставки — не точная наука).
  function mpower(m) {
    const hp = parseInt(m.hp, 10) || 5, ac = parseInt(m.ac, 10) || 12; let dmg = 0;
    for (const [, txt] of m.traits || []) { const d = /(\d+)к(\d+)\s*([+−-]\s*\d+)?/.exec(txt || ""); if (d && /[+−]\d|попадан/.test(txt)) dmg = Math.max(dmg, +d[1] * (+d[2] + 1) / 2 + (d[3] ? parseInt(d[3].replace(/\s/g, "").replace("−", "-"), 10) : 0)); }
    return Math.max(1, hp) * (0.6 + ac / 20) * Math.max(2, dmg || 3);
  }
  function arenaState() {
    const trips = townClock().trips || 0;
    let a = state.arena;
    if (!a || a.trips !== trips) {
      a = state.arena = { trips, bouts: [] };
      for (let i = 0; i < 3; i++) {
        let x = arenaMon(), y = arenaMon(), g = 0; while (y.id === x.id && g++ < 20) y = arenaMon();
        const pa = Math.pow(mpower(x), 1.4) / (Math.pow(mpower(x), 1.4) + Math.pow(mpower(y), 1.4)), odds = p => Math.round(Math.min(8, Math.max(1.1, 0.9 / p)) * 20) / 20;
        a.bouts.push({ a: x.id, b: y.id, pa, oa: odds(pa), ob: odds(1 - pa), res: null });
      }
      saveChar();
    }
    return a;
  }
  B.arena = {
    init: () => ({ tab: "bets", fightN: Math.min(ARENA_FIGHT_MAX, Math.max(2, state.party.length || 2)), stake: 5, pick: null, ok: null }),
    render() {
      const c = hero(); if (!c) return frame("Арена", "Рафдония", noParty());
      const a = arenaState();
      const tabs = `<div class="tw-tabs" role="tablist"><button class="fx-btn" role="tab" aria-selected="${ui.tab === "bets"}" data-t="atab" data-k="bets">Ставки</button><button class="fx-btn" role="tab" aria-selected="${ui.tab === "fight"}" data-t="atab" data-k="fight">Бой отряда</button></div>`;
      let body = `<div class="tw-npc">${img("assets/npc/arena.webp", "Администратор арены")}<span>Арена Рафдонии: делайте ставки на бои монстров или выходите на песок всем отрядом.</span></div>` + heroStrip() + tabs;
      if (ui.tab === "bets") {
        body += `<p class="tw-lead">Три боя один на один между монстрами одного класса. Ставку делает выбранный герой (при нехватке добавят другие). Выигрыш — ставка × коэффициент, проигрыш — ставка сгорает.</p>
          <div class="tw-bouts">${a.bouts.map((b, i) => {
            const A = MONSTERS.find(m => m.id === b.a), Bm = MONSTERS.find(m => m.id === b.b), done = !!b.res;
            const side = (m, code, odds) => `<button class="tw-fighter${done && b.res.win === code ? " won" : done ? " lost" : ""}${ui.pick && ui.pick.i === i && ui.pick.side === code ? " pick" : ""}" data-t="apick" data-i="${i}" data-s="${code}"${done ? " disabled" : ""}>
              <span class="tw-ph sq">${img(monArt(m), m.name)}</span><b>${esc(m.name)}</b><small>${m.cls} класс${m.rare ? " · редкий" : ""}</small><i>×${odds.toFixed(2)}</i></button>`;
            const panel = !done && ui.pick && ui.pick.i === i ? `<div class="tw-stake"><div class="tw-dlg-row"><button class="fx-btn" data-t="astep" data-d="-1">−</button><b class="tw-stk">${ui.stake}</b><button class="fx-btn" data-t="astep" data-d="1">+</button></div>
              <div class="tw-btns">${[1, 5, 10, 25].map(v => `<button class="fx-btn${ui.stake === v ? " on" : ""}" data-t="achip" data-n="${v}">${v}</button>`).join("")}<button class="fx-btn" data-t="achip" data-n="${partyGold()}">Всё</button></div>
              <button class="fx-btn primary" data-t="abet"${ui.stake > 0 && partyGold() >= ui.stake ? "" : " disabled"}>Поставить ${ui.stake} на ${esc((ui.pick.side === "a" ? A : Bm).name)} · выигрыш ${Math.floor(ui.stake * (ui.pick.side === "a" ? b.oa : b.ob))}</button></div>` : "";
            const res = done ? `<p class="tw-bout-res">Победил: <b>${esc(MONSTERS.find(m => m.id === (b.res.win === "a" ? b.a : b.b)).name)}</b>. ${b.res.stake ? (b.res.pay ? `Выигрыш: +${b.res.pay} монет.` : `Ставка ${b.res.stake} проиграна.`) : "Ставку не делали."}</p>` : "";
            return `<div class="tw-bout fx-frame">${side(A, "a", b.oa)}<span class="tw-vs">VS</span>${side(Bm, "b", b.ob)}${panel}${res}</div>`; }).join("")}</div>${msgLine()}`;
      } else {
        const n = ui.fightN;
        body += `<p class="tw-lead">Отряд выходит на арену сам. Выберите число противников — случайные монстры 9 класса, редкие нечасто. За каждого убитого арена платит ${ARENA_PAY} монеты (тройная цена камня). Лута нет: камни и находки забирают администраторы, выпавшую эссенцию тоже — взамен бонус 20 % её цены.</p>
          <div class="tw-stake"><div class="tw-dlg-row"><button class="fx-btn" data-t="afn" data-d="-1">−</button><b class="tw-stk">${n}</b><button class="fx-btn" data-t="afn" data-d="1">+</button></div>
          <p class="tw-lead" style="text-align:center">Награда при победе: <b style="color:var(--fx-gold-hi)">${n * ARENA_PAY}</b> монет · после боя +1 Усталость каждому, раны не заживут и ночлег в таверне будет закрыт до следующего спуска.</p>
          <button class="fx-btn primary big" data-t="afight">${ui.ok === "fight" ? "Точно выйти? Нажми ещё раз" : "Выйти на арену"}</button></div>${msgLine()}`;
      }
      return frame("Арена", "Рафдония", body);
    },
  };
  function arenaBet() {
    const a = arenaState(), b = a.bouts[ui.pick.i], stake = ui.stake; if (!b || b.res || stake < 1) return;
    if (!payGold(hero(), stake)) { ui.msg = "Не хватает монет."; return; }
    const winA = Math.random() < b.pa, win = winA ? "a" : "b", mine = ui.pick.side, odds = mine === "a" ? b.oa : b.ob;
    const pay = win === mine ? Math.floor(stake * odds) : 0;
    if (pay) addGold(hero(), pay);
    b.res = { win, stake, pay, side: mine }; ui.pick = null; visit(); saveChar();
    ui.msg = pay ? `Ставка сыграла: +${pay} монет.` : `Не повезло: ${stake} монет проиграно.`;
  }
  function arenaStart() {
    if (!(window.settings && settings().tactical)) { ui.msg = "Арена работает только с включённым тактическим боем."; return; }
    if (ui.ok !== "fight") { ui.ok = "fight"; return; }
    const n = ui.fightN, list = []; for (let i = 0; i < n; i++) list.push(arenaMon().id);
    const zone = MONSTERS.find(m => m.id === list[0]).zone;
    const ev = { kind: "hard", title: "Арена", arena: true, list, zone, floor: 1, key: "arena", outcome: null, killed: [], turn: 0, round: 1, tactical: true, border: false, place: "Арена", cause: "arena", raw: 0, n: 0, ambush: false };
    ev.init = rollInitiative(list, false);
    spend(1); T.close();
    loadBattle().then(ok => { if (!ok || !window.Battle) { toast("Бой не загрузился"); return; } window.Battle.ensure(ev); });
  }
  // Итог боя на арене (вызывает battleDone): усталость, запрет ночлега, опыт за новые виды, возврат на арену.
  T.arenaDone = function (ev, res) {
    for (const c of state.party) { const st = c.carry || (c.carry = { sat: 3, starve: 0, awake: 0, fat: 0 }); st.fat = Math.min(4, (st.fat || 0) + 1); }
    state.arenaLock = true;
    const killed = res.killed.map(i => ev.list[i]);
    try { for (const id of killed) seenKeys(id, ["type"]); awardXp(killed); } catch (e) { /* опыт не критичен */ }
    const total = res.plan && res.plan.arena ? res.plan.arena.total : 0;
    saveChar(); toast(`Арена: убито ${killed.length} из ${ev.list.length}, получено ${total} монет. Усталость +1, ночлег закрыт.`);
    setTimeout(() => { T.open("arena"); ui.tab = "fight"; ui.msg = `Бой окончен: убито ${killed.length} из ${ev.list.length}, ${total} монет отряду.`; render(); }, 500);
  };

  /* =====================================================================
     ГИЛЬДИЯ ПРИКЛЮЧЕНИЙ: покупка и продажа сведений
     ===================================================================== */
  const guildMons = () => { const j = journal(), ids = new Set(libMonsters().map(m => m.id)); for (const id of Object.keys(j.known)) ids.add(id); return MONSTERS.filter(m => ids.has(m.id) && !m.draft && (m.abil || m.floor === 1)); };
  const monFull = m => { const rec = journal().known[m.id]; if (!rec) return false; migrateRevealed(rec); return monSections(m).every(x => rec.revealed.includes(x.k)); };
  const monWorth = m => Math.floor(monSections(m).reduce((a, x) => a + infoPrice(m, x.k), 0) * INFO_SELL);
  B_guild();
  function B_guild() {
    B.guild = {
      init: () => ({ tab: "buy", mon: null }),
      render() {
        const c = hero(); if (!c) return frame("Гильдия", "Приключений", noParty());
        const tabs = `<div class="tw-tabs" role="tablist"><button class="fx-btn" role="tab" aria-selected="${ui.tab === "buy"}" data-t="gtab" data-k="buy">Купить сведения</button><button class="fx-btn" role="tab" aria-selected="${ui.tab === "sell"}" data-t="gtab" data-k="sell">Продать сведения</button></div>`;
        let body = heroStrip() + tabs;
        if (ui.tab === "buy") {
          if (ui.mon) {
            const m = MONSTERS.find(x => x.id === ui.mon), rec = journal().known[m.id], j = journal();
            const secs = rec ? (migrateRevealed(rec), monSections(m).map(x => ({ k: x.k, label: x.label, group: x.group, open: rec.revealed.includes(x.k) })))
              : ["type", "portrait"].map(k => ({ k, label: INFO_LABEL[k], open: (j.hints[m.id] || []).includes(k), hint: true }));
            body += `<div class="tw-monhead"><button class="fx-btn" data-t="gback">← Назад</button><b>${rec ? esc(m.name) : "Неизвестный монстр"}</b><small>${m.cls} класс</small></div>
              <div class="tw-rows">${secs.map(x => `<div class="tw-row"><div class="tw-who"><div><b>${x.group ? x.group + ": " : ""}${esc(x.label)}</b><small>${x.open ? "уже известно" : "скрыто"}</small></div></div>
              ${x.open ? `<span class="tw-done">${ICO_CHECK}</span>` : `<button class="fx-btn primary" data-t="gbuy" data-k="${x.k}"${partyGold() >= infoPrice(m, x.k) ? "" : " disabled"}>${infoPrice(m, x.k)}</button>`}</div>`).join("")}</div>`;
          } else {
            body += `<p class="tw-lead">Гильдия знает о монстрах лабиринта больше новичков. Выбери монстра: цены зависят от класса и вида сведения.</p><div class="mon-grid">${guildMons().map(m => { const rec = journal().known[m.id], h = journal().hints[m.id] || [];
              return `<button class="mbox fx-frame" data-t="gmon" data-id="${m.id}"><div class="art">${rec || h.includes("portrait") ? img(monArt(m), m.name) : `<div class="mist"><span>?</span></div>`}</div><b>${rec ? esc(m.name) : "???"}</b></button>`; }).join("")}</div>`;
          }
        } else {
          const full = guildMons().filter(m => monFull(m) && !(journal().known[m.id] || {}).sold);
          body += `<p class="tw-lead">Гильдия платит за полностью изученных монстров — по ${Math.round(INFO_SELL * 100)}% стоимости сведений, один раз за вид.</p>
            ${full.length ? `<div class="tw-rows">${full.map(m => `<div class="tw-row"><div class="tw-who"><span class="tw-ph sq">${img(monArt(m), m.name)}</span><div><b>${esc(m.name)}</b><small>${m.cls} класс · изучен полностью</small></div></div><button class="fx-btn primary" data-t="gsell" data-id="${m.id}">+${monWorth(m)}</button></div>`).join("")}</div>`
              : `<p class="tw-msg">Полностью изученных монстров, которых ещё не продавали, нет.</p>`}`;
        }
        return frame("Гильдия приключений", "Рафдония", body + msgLine());
      },
    };
  }

  /* =====================================================================
     БАШНЯ МАГОВ: анализ эссенций
     ===================================================================== */
  const essLvl = id => ["ess-stats", "ess-passive", "ess-active"].filter(k => essSeen(id, k)).length;
  B_tower();
  function identify(id) {
    const price = artPrice(id);
    if (!payGold(hero(), price)) { ui.msg = "Не хватает монет."; return; }
    artState().known[id] = true; visit(); ui.msg = `Артефакт определён: ${ARTIFACTS[id].name}. Сведения записаны в библиотеку артефактов.`; saveChar();
  }
  function B_tower() {
    B.tower = {
      render() {
        const c = hero(); if (!c) return frame("Башня магов", "Рафдония", noParty());
        const tab = ui.tab === "art" ? "art" : ui.tab === "sell" ? "sell" : "ess";
        const tabs = `<div class="tw-tabs"><button class="fx-btn" role="tab" aria-selected="${tab === "ess"}" data-t="ttab" data-k="ess">Эссенции</button><button class="fx-btn" role="tab" aria-selected="${tab === "sell"}" data-t="ttab" data-k="sell">Скупка</button><button class="fx-btn" role="tab" aria-selected="${tab === "art"}" data-t="ttab" data-k="art">Артефакты</button></div>`;
        if (tab === "sell") return frame("Башня магов", "Рафдония", `${heroStrip()}${tabs}<p class="tw-lead">Маг скупает артефакты. Золото получает выбранный герой.</p>${artSellHtml("tower")}${msgLine()}`);
        if (tab === "art") {
          artSync();
          const ids = Object.keys(ARTIFACTS).filter(id => artState().seen[id]);
          const rows = ids.map(id => { const A = ARTIFACTS[id], known = artKnown(id), price = artPrice(id);
            return `<div class="tw-row"><div class="tw-who"><span class="tw-ph sq" style="display:grid;place-items:center;color:var(--fx-gold)">${A.ico()}</span><div><b>${esc(artName(id))}</b><small>${known ? `${A.cls} класс · цена ${artValue(id)} з. · ${esc(A.text)}` : `${A.cls} класс · свойства неизвестны`}</small></div></div>
              ${known ? `<span class="tw-done">${ICO_CHECK}</span>` : `<button class="fx-btn primary" data-t="aid" data-id="${id}"${partyGold() >= price ? "" : " disabled"}>${price}</button>`}</div>`; }).join("");
          return frame("Башня магов", "Рафдония", `${heroStrip()}${tabs}<p class="tw-lead">Маг определит артефакт за деньги: откроются название и свойства, сведения попадут в библиотеку артефактов.</p>
            ${ids.length ? `<div class="tw-rows">${rows}</div>` : `<p class="tw-msg">Артефактов пока нет: они появляются, когда отряд находит сокровища.</p>`}${msgLine()}`);
        }
        const ess = c.essences || [];
        const rows = ess.map(id => { const e = ESSENCES[id], n = essLvl(id), price = towerPrice(id);
          return `<div class="tw-row"><div class="tw-who"><div><b>${esc(essTitle(id))}</b><small>${e.cls} класс · изучено ${n} из 3</small></div></div>
            ${n === 3 ? `<span class="tw-done">${ICO_CHECK}</span>` : `<button class="fx-btn primary" data-t="analyze" data-id="${id}"${partyGold() >= price ? "" : " disabled"}>${price}</button>`}</div>`; }).join("");
        return frame("Башня магов", "Рафдония", `${heroStrip()}${tabs}<p class="tw-lead">Маг заглянет в героя и расскажет всё о впитанных им эссенциях: статы, пассивную и активную способности. Цена — треть цены эссенции.</p>
          ${ess.length ? `<div class="tw-rows">${rows}</div>` : `<p class="tw-msg">У ${esc(c.name)} нет эссенций.</p>`}${msgLine()}`);
      },
    };
  }

  /* =====================================================================
     АКАДЕМИЯ: курсы героя за деньги (ACADEMY в index.html; знания закреплены за героем)
     ===================================================================== */
  function learn(id) {
    const c = hero(), k = ACADEMY.find(x => x.id === id); if (!c || !k) return;
    if (eduKnows(c, id)) { ui.msg = `${c.name} уже прошёл этот курс.`; return; }
    if (k.need && !eduKnows(c, k.need)) { ui.msg = `Сначала нужен курс «${ACADEMY.find(x => x.id === k.need).name}».`; return; }
    if (!payGold(c, k.price)) { ui.msg = "Не хватает монет."; return; }
    eduLearn(c, id); visit(); ui.msg = `${c.name} прошёл курс «${k.name}».`; saveChar();
  }
  B.academy = {
    render() {
      const c = hero(); if (!c) return frame("Академия", "Рафдония", noParty());
      const tab = ui.tab && ACADEMY_GROUPS.some(g => g[0] === ui.tab) ? ui.tab : "gather";
      const tabs = `<div class="tw-tabs" role="tablist">${ACADEMY_GROUPS.map(([id, label]) => `<button class="fx-btn" role="tab" aria-selected="${tab === id}" data-t="atab" data-k="${id}">${label}${ACADEMY.filter(k => k.grp === id && eduKnows(c, k.id)).length ? " ✓" : ""}</button>`).join("")}</div>`;
      const rows = ACADEMY.filter(k => k.grp === tab).map(k => {
        const known = eduKnows(c, k.id), locked = k.need && !eduKnows(c, k.need), can = !known && !locked && partyGold() >= k.price;
        return `<div class="tw-row"><div class="tw-who"><div><b>${esc(k.name)}</b><small>${esc(k.text)}${locked ? " · сначала «" + esc(ACADEMY.find(x => x.id === k.need).name) + "»" : ""}</small></div></div>
          ${known ? `<span class="tw-done">${ICO_CHECK}</span>` : `<button class="fx-btn primary" data-t="learn" data-id="${k.id}"${can ? "" : " disabled"}>${k.price}</button>`}</div>`; }).join("");
      return frame("Академия", "Рафдония", `${heroStrip()}${tabs}<p class="tw-lead">Выбери героя и оплати курс. Знания остаются за ним одним — у остальных курсов нет.</p><div class="tw-rows">${rows}</div>${msgLine()}`);
    },
  };

  /* =====================================================================
     ЦЕРКОВЬ: удаление эссенций
     ===================================================================== */
  B_church();
  function B_church() {
    B.church = {
      render() {
        const c = hero(); if (!c) return frame("Церковь", "Рафдония", noParty());
        const ess = c.essences || [];
        const rows = ess.map(id => { const e = ESSENCES[id], price = churchPrice(id), ask = ui.confirm === id, nm = esc(essTitle(id));
          return `<div class="tw-row"><div class="tw-who"><div><b>${nm}</b><small>${e.cls} класс · освободит слот</small></div></div>
            <button class="fx-btn${ask ? " danger" : ""}" data-t="purge" data-id="${id}"${partyGold() >= price ? "" : " disabled"}>${ask ? "Точно? " + price : "Удалить · " + price}</button></div>`; }).join("");
        return frame("Церковь", "Рафдония", `${heroStrip()}<p class="tw-lead">Священник очистит героя от впитанной эссенции — она исчезнет безвозвратно, слот освободится. Слотов: ${ess.length}/${c.level}.</p>
          ${ess.length ? `<div class="tw-rows">${rows}</div>` : `<p class="tw-msg">У ${esc(c.name)} нет эссенций.</p>`}${msgLine()}`);
      },
    };
  }

  /* ---------- действия ---------- */
  // Предмет предложен лавочнику (перетаскиванием из рюкзака): обычные вещи он не скупает, камни лежат в сумке.
  // Расходники магазин скупает по стандартной цене (цена товара на одну штуку); камни — из сумки; кузнец ничего не скупает.
  const unitPrice = e => { const g = GOODS.find(x => x.e && x.e.t === "g" && e && e.t === "g" && x.e.id === e.id); return g ? g.price / g.e.qty : 0; };
  const sellValue = (e, n) => Math.floor(unitPrice(e) * n + 1e-9);
  function sellItem(i, all) {
    const c = hero(), e = (c.bag || [])[i]; if (!e || ui.b !== "shop") return;
    const have = e.qty || 1, n = all ? have : 1, g = sellValue(e, n);
    if (!g) { ui.msg = n === 1 && unitPrice(e) > 0 ? "Одну штуку так мало, что лавочник не платит — продай стопку." : "Это магазин не скупает."; return; }
    const it = itemOf(e, c); if (!takeGear(c, e.id, n)) { ui.msg = "Не получилось забрать предмет."; return; }
    addGold(c, g); visit(); ui.sel = null; ui.talk = talk(); ui.msg = `Продано: ${it.name}${n > 1 ? " × " + n : ""} за ${g} монет — ${c.name}.`; saveChar();
  }
  function offer(i) { if (ui.b === "shop") { const e = ((hero().bag || [])[i]); if (e && unitPrice(e) > 0) { sellItem(i, true); return; } } ui.msg = sellsStones() ? "Магазин скупает камни (из сумки) и расходники." : "Кузнец ничего не скупает."; }
  function buy(n) {
    const c = hero(), g = goodByKey(ui.sel.key); if (!g || owned(g)) return;
    const cost = g.price * n;
    if (g.special === "compass") {
      if (!payGold(c, cost)) { ui.msg = "Не хватает монет."; return; }
      inventory().compass.owned = true; visit(); ui.msg = "Куплен компас. Зажги его удержанием в инвентаре лабиринта."; ui.talk = null; saveChar(); return;
    }
    const qty = g.e.qty * n;
    if (partyGold() < cost) { ui.msg = "Не хватает монет."; return; }
    const room = (() => { const probe = JSON.parse(JSON.stringify(c.bag || [])); const tmp = { bag: probe, race: c.race, level: c.level, base: c.base, essences: c.essences, equip: c.equip }; return addToBag(tmp, { ...g.e, qty }) === 0; })();
    if (!room) { ui.msg = `Рюкзак ${c.name} полон.`; return; }
    payGold(c, cost); addToBag(c, { ...g.e, qty }); visit(); ui.talk = null;
    ui.msg = `Куплено: ${itemOf(g.e).name}${qty > 1 ? " × " + qty : ""} за ${cost} монет.`; saveChar();
  }
  function tavernPay() {
    const live = state.party.filter(c => !c.dead);
    if (state.arenaLock) ui.sleep = {};
    const total = live.reduce((a, c) => a + (ui.sleep[c.id] ? TAVERN.sleep : 0) + (ui.food[c.id] ? TAVERN.food : 0), 0);
    if (!total || !payGold(live[0], total)) { ui.msg = "Не хватает монет."; return; }
    let slept = 0, ate = 0;
    for (const c of live) {
      const st = carryOf(c);
      if (ui.sleep[c.id]) { st.fat = 0; st.awake = 0; c.hp = maxHp(c); c.mp = maxMp(c); c.insp = 1; c.flags = {}; slept++; if (hasCharm(c, "repair-charm")) for (const e of Object.values(c.equip || {})) if (isDurable(e)) durFix(e, 1); }
      if (ui.food[c.id]) { st.sat = 9; st.starve = 0; ate++; }
    }
    spend(slept ? 3 : 1); ui.sleep = {}; ui.food = {};
    ui.msg = `Оплачено ${total}: спали ${slept}, поели ${ate}.`; saveChar();
  }
  function analyze(id) {
    const e = ESSENCES[id], price = towerPrice(id);
    if (!payGold(hero(), price)) { ui.msg = "Не хватает монет."; return; }
    seenKeys(essSource(id), ["ess-stats", "ess-passive", "ess-active"]); markEssNamed(id);          // сведения попадают в библиотеку, и наоборот: прочитанное там открыто при получении
    visit(); ui.msg = `Анализ завершён: ${esc(ESSENCES[id].name)} раскрыта, сведения записаны в библиотеку.`; saveChar();
  }
  function purge(id) {
    const c = hero(), e = ESSENCES[id], price = churchPrice(id);
    if (ui.confirm !== id) { ui.confirm = id; ui.msg = "Эссенция исчезнет навсегда. Нажми ещё раз."; return; }
    if (!payGold(c, price)) { ui.msg = "Не хватает монет."; return; }
    const i = (c.essences || []).indexOf(id); if (i < 0) return;
    c.essences.splice(i, 1); c.hp = Math.min(hpOf(c), maxHp(c)); c.mp = Math.min(mpOf(c), maxMp(c));
    c.purged = (c.purged || 0) + 1;          // скрытый счётчик удалённых эссенций (позже — штраф, игроку не показывается)
    ui.confirm = null; visit(); ui.msg = `Эссенция удалена: слот свободен (${c.essences.length}/${c.level}).`; saveChar();
  }
  function guildBuy(k) {
    const m = MONSTERS.find(x => x.id === ui.mon), price = infoPrice(m, k);
    if (!payGold(hero(), price)) { ui.msg = "Не хватает монет."; return; }
    grantInfo({ m, k, hint: !journal().known[m.id] }); visit(); ui.msg = `Куплено сведение: ${INFO_LABEL[k] || k}.`; saveChar();
  }
  function guildSell(id) {
    const m = MONSTERS.find(x => x.id === id), rec = journal().known[id]; if (!rec || rec.sold) return;
    const w = monWorth(m); addGold(hero(), w); rec.sold = true; visit(); ui.msg = `Гильдия заплатила ${w} монет за сведения о «${m.name}» — ${hero().name}.`; saveChar();
  }

  /* ---------- события ---------- */
  let hold = { t: 0, fired: false, x: 0, y: 0 };
  host.addEventListener("pointerdown", e => {
    hold.fired = false;
    const el = e.target.closest("[data-t='bag'],[data-t='stock']"); if (!el || !ui) return; hold.x = e.clientX; hold.y = e.clientY; clearTimeout(hold.t);
    hold.t = setTimeout(() => {
      hold.fired = true;
      if (el.dataset.t === "bag") { const c = hero(), ent = (c.bag || [])[+el.dataset.i]; if (ent) showItemInfo(ent, c); }
      else { const g = goodByKey(el.dataset.id); if (g.special === "compass") showItemInfo(null, null, "", COMPASS_INFO()); else showItemInfo(g.e, null); }
    }, 450);
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) host.addEventListener(ev, () => clearTimeout(hold.t), true);
  host.addEventListener("pointermove", e => { if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) clearTimeout(hold.t); });
  host.addEventListener("input", e => {
    const el = e.target; if (ui && ui.bm && el.classList.contains("tw-bm-range")) { ui.bm.n = +el.value; const g = goodByKey(ui.bm.key), q = g && g.e ? g.e.qty : 1; host.querySelector(".tw-bm-n").textContent = ui.bm.n; host.querySelector(".tw-bm-cost").textContent = "−" + (g.price * ui.bm.n); return; }
    if (!ui || !ui.sk) return;
    if (el.classList.contains("tw-sk-range")) {
      ui.sk.num[el.dataset.key] = +el.value; const r = skRows().find(x => x.key === el.dataset.key); if (!r) return;
      const row = el.closest(".tw-sk-row"); row.querySelector(".tw-sk-n").textContent = `${r.take}/${r.qty}`; row.querySelector(".tw-sk-sum").textContent = "+" + r.take * r.price;
      const t = skTotal(); host.querySelector(".tw-sk-total").innerHTML = `Продать <b>${t.n}</b> камней → <b>+${t.g}</b> монет`; host.querySelector("[data-t='sk-sell']").disabled = !t.n;
    }
  });
  // Перетаскивание предмета из рюкзака на лавочника/витрину = продать.
  let drag = null; T.drag = () => drag;
  host.addEventListener("dragstart", e => e.preventDefault());          // браузерное перетаскивание картинки отменяло бы наш жест (pointercancel)
  const dropZone = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest(".tw-shopcol"); };
  host.addEventListener("pointerdown", e => {
    const el = e.target.closest("[data-t='bag'],[data-t='sacktile']"); if (!el || !ui || !(ui.b === "shop" || ui.b === "forge") || ui.sk) return;
    drag = { i: +el.dataset.i, sack: el.dataset.t === "sacktile", x: e.clientX, y: e.clientY, on: false, ghost: null };
  });
  window.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 9) return;
      drag.on = true; clearTimeout(hold.t); hold.fired = true;
      const c = hero(), ent = drag.sack ? {} : (c.bag || [])[drag.i]; if (!ent) { drag = null; return; }
      if (!drag.sack) ui.sel = { side: "bag", i: drag.i };
      const g = document.createElement("div"); g.className = "tw-ghost"; g.innerHTML = drag.sack ? ICO_SACK : itemThumb(ent, c); host.appendChild(g); drag.ghost = g; host.classList.add("tw-dragging");
    }
    drag.ghost.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
    const z = host.querySelector(".tw-shopcol"); if (z) z.classList.toggle("drop-ok", !!dropZone(e.clientX, e.clientY));
  }, { passive: true });
  const endDrag = (e, ok) => {
    const d = drag; drag = null; if (!d || !d.on) return;
    if (d.ghost) d.ghost.remove(); host.classList.remove("tw-dragging");
    const z = host.querySelector(".tw-shopcol"); if (z) z.classList.remove("drop-ok");
    if (ok && ui && dropZone(e.clientX, e.clientY)) { ui.msg = ""; if (d.sack) openSell(); else offer(d.i); }
    if (ui) render();
  };
  window.addEventListener("pointerup", e => endDrag(e, true));
  window.addEventListener("pointercancel", e => endDrag(e, false));
  host.addEventListener("click", e => {
    if (hold.fired) { hold.fired = false; return; }
    const el = e.target.closest("[data-t]"); if (!el || !ui) return;
    const ds = el.dataset; ui.msg = "";
    switch (ds.t) {
      case "close": T.close(); return;
      case "hero": ui.hero = ds.id; ui.sel = null; ui.confirm = null; break;
      case "bag": ui.sel = ui.sel && ui.sel.side === "bag" && ui.sel.i === +ds.i ? null : { side: "bag", i: +ds.i }; break;
      case "stock": ui.sel = ui.sel && ui.sel.side === "shop" && ui.sel.key === ds.id ? null : { side: "shop", key: ds.id }; break;
      case "ftab": ui.tab = ds.k; ui.sel = null; break;
      case "fixone": fixOne(ds.k); break;
      case "fixset": fixSet(); break;
      case "sellopen": if (ui.sel && ui.sel.side === "bag") offer(ui.sel.i); break;
      case "sacktile": openSell(); break;
      case "sk-close": ui.sk = null; break;
      case "bm-open": if (ui.sel && ui.sel.key) ui.bm = { key: ui.sel.key, n: 1 }; break;
      case "bm-close": ui.bm = null; break;
      case "bm-d": { const g = ui.bm && goodByKey(ui.bm.key); if (g) ui.bm.n = Math.max(1, Math.min(bmMax(g), ui.bm.n + (+ds.d))); break; }
      case "bm-buy": { const g = ui.bm && goodByKey(ui.bm.key), n = ui.bm ? Math.min(ui.bm.n, g ? bmMax(g) : 1) : 0; if (g && n) { ui.sel = { side: "shop", key: ui.bm.key }; buy(n); } ui.bm = null; break; }
      case "sk-chk": {
        ui.sk.sel[ds.key] = el.checked; const row = el.closest(".tw-sk-row"), r = skRows().find(x => x.key === ds.key);
        row.classList.toggle("off", !el.checked); row.querySelector(".tw-sk-range").disabled = !el.checked; row.querySelector(".tw-sk-sum").textContent = el.checked ? "+" + r.take * r.price : "—";
        const t = skTotal(); host.querySelector(".tw-sk-total").innerHTML = `Продать <b>${t.n}</b> камней → <b>+${t.g}</b> монет`; host.querySelector("[data-t='sk-sell']").disabled = !t.n; return;
      }
      case "sk-sell": skSell(); break;
      case "buy": buy(+ds.n); break;
      case "sell1": sellItem(+ds.i, false); break;
      case "sellall": sellItem(+ds.i, true); break;
      case "tv": { const m = ui[ds.k]; m[ds.id] = !m[ds.id]; break; }
      case "tv-all": for (const c of state.party.filter(x => !x.dead)) { if (!state.arenaLock) ui.sleep[c.id] = true; ui.food[c.id] = true; } break;
      case "tv-pay": tavernPay(); break;
      case "lr-cat": ui.lr = { step: "hero", cat: ds.k, log: [], picks: {}, stage: 0 }; break;
      case "lr-hero": if (ui.lr) { ui.lr.hero = ds.id; ui.lr.step = "cls"; } break;
      case "lr-cls": if (ui.lr) { const n = +ds.n; Object.assign(ui.lr, { cls: n, cand: libCands(n), stage: 0, picks: {}, log: [], mon: null, essOK: false, choosing: false }); lrAdvance(ui.lr); } break;
      case "lr-roll": lrRoll(+ds.n); break;
      case "lr-pick": if (ui.lr && ui.lr.choosing) lrApply(ui.lr, ds.v); break;
      case "lr-restart": ui.lr = { step: "hero", cat: "monsters", log: [], picks: {}, stage: 0 }; break;
      case "lr-back": if (ui.lr) ui.lr.step = ui.lr.step === "cls" ? "hero" : "cat"; break;
      case "gtab": ui.tab = ds.k; ui.mon = null; break;
      case "gmon": ui.mon = ds.id; break;
      case "gback": ui.mon = null; break;
      case "gbuy": guildBuy(ds.k); break;
      case "gsell": guildSell(ds.id); break;
      case "analyze": analyze(ds.id); break;
      case "learn": learn(ds.id); break;
      case "atab": ui.tab = ds.k; break;
      case "ttab": ui.tab = ds.k; break;
      case "aid": identify(ds.id); break;
      case "artsell": artSell(ds.key, ds.b); break;
      case "purge": purge(ds.id); break;
      case "qaccept": questAccept(ds.id); break;
      case "qdone": questDone(ds.id); break;
      case "atab": ui.tab = ds.k; ui.pick = null; ui.ok = null; break;
      case "apick": ui.pick = ui.pick && ui.pick.i === +ds.i && ui.pick.side === ds.s ? null : { i: +ds.i, side: ds.s }; break;
      case "astep": ui.stake = Math.max(1, ui.stake + +ds.d); break;
      case "achip": ui.stake = Math.max(1, +ds.n); break;
      case "abet": arenaBet(); break;
      case "afn": ui.fightN = Math.max(1, Math.min(ARENA_FIGHT_MAX, ui.fightN + +ds.d)); ui.ok = null; break;
      case "afight": arenaStart(); break;
    }
    render();
  });
  window.Town._B = B;
})();
