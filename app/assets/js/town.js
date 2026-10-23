/* Здания города: магазин, таверна, библиотека, доска объявлений, гильдия приключений, башня магов, церковь.
   Загружается при первом входе в здание (loadTown в index.html). Все цены и правила — черновик, см. ../campaign/drafts.md → «Город».
   Городское время: посещение здания с результатом стоит одно действие (таверна — ночь три), часы — townClock(). */
(function () {
  const T = window.Town = { ready: true };
  const host = document.getElementById("townov");
  const B = {};
  let ui = null;

  /* ---------- цены (черновик) ---------- */
  const STONE_PRICE = { "stone-9": 1, "stone-8": 5, "stone-7": 20 };                              // решение автора
  // Витрины: key — уникальный ключ позиции, e — предмет (для компаса нет), price — цена за штуку набора, many — можно купить ×5.
  const GOODS = [
    { key: "ration", e: { t: "g", id: "ration", qty: 5 }, price: 1 }, { key: "torch", e: { t: "g", id: "torch", qty: 1 }, price: 2, many: true },
    { key: "potion", e: { t: "g", id: "potion", qty: 1 }, price: 5, many: true }, { key: "potion-good", e: { t: "g", id: "potion-good", qty: 1 }, price: 15, many: true },
    { key: "arrow40", e: { t: "g", id: "arrow", qty: 40 }, price: 10, label: "Колчан на 40 стрел" }, { key: "arrow20", e: { t: "g", id: "arrow", qty: 20 }, price: 5, label: "Колчан на 20 стрел" },
    { key: "shovel", e: { t: "g", id: "shovel", qty: 1 }, price: 8 }, { key: "shovel-good", e: { t: "g", id: "shovel-good", qty: 1 }, price: 15 },
    { key: "compass", special: "compass", price: 30 },
  ];
  const FORGE_W = ["dagger", "spear", "mace", "warhammer", "sword", "rapier", "greatsword", "shortbow", "longbow", "shield", "tower-shield"];
  const FORGE_A = ["leather", "hide", "chainmail"];
  const FORGE_PRICE = { weapon: 10, armor: 15, steelWeapon: 25, steelArmor: 40 };               // решение автора
  const FORGE = {
    base: [...FORGE_W.map(id => ({ key: "w:" + id, e: { t: "w", id, qty: 1 }, price: FORGE_PRICE.weapon })), ...FORGE_A.map(id => ({ key: "a:" + id, e: { t: "a", id, qty: 1 }, price: FORGE_PRICE.armor }))],
    steel: [...FORGE_W.map(id => ({ key: "sw:" + id, e: { t: "w", id, qty: 1, steel: true }, price: FORGE_PRICE.steelWeapon })), ...FORGE_A.map(id => ({ key: "sa:" + id, e: { t: "a", id, qty: 1, steel: true }, price: FORGE_PRICE.steelArmor }))],
  };
  const COMPASS_INFO = () => ({ name: "Компас", icon: ICO_COMPASS, note: "Стрелка показывает север при любом повороте карты. Включается удержанием в инвентаре лабиринта.", weight: 0 });
  const TAVERN = { sleep: 4, food: 2 };                                                           // за героя
  const TOWER = { 9: 10, 8: 25, 7: 60 };                                                          // анализ эссенции по классу
  const CHURCH = { 9: 15, 8: 40, 7: 100 };                                                        // удаление эссенции по классу
  const INFO_PRICE = { type: 3, portrait: 5, area: 3, spawn: 4, body: 5, stats: 8, "ess-stats": 10, "ess-passive": 15, "ess-active": 20 };
  const CLS_MULT = { 9: 1, 8: 2, 7: 4 };
  const INFO_SELL = 0.5;                                                                          // доля цены, которую платит гильдия за изученного монстра
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
    const n = ui.cost; host.hidden = true; host.innerHTML = ""; ui = null;
    document.body.classList.remove("forge-open");
    if (n > 0) { const c = townClock(); c.t += n; saveChar(); const gi = gateInfo(); toast(`Прошло городских действий: ${n}. Врата ${gi.open ? "открыты сейчас" : "закрыты ещё " + gi.left + " д."}.`); }
    rerender();
  };
  T.state = () => ui;
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
  const head = (title, sub = "") => `<header class="tw-head"><div><div class="fx-eyebrow">${sub}</div><h3>${title}</h3></div><div class="tw-gold" title="Монет в отряде">${COIN_SVG}<b>${partyGold()}</b></div>${closeBtn}</header>`;
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
  const goodsOf = () => ui.b === "forge" ? FORGE[ui.tab || "base"] : GOODS;
  const goodByKey = k => [...GOODS, ...FORGE.base, ...FORGE.steel].find(g => g.key === k);
  const owned = g => g.special === "compass" && inventory().compass.owned;
  const goodInfo = g => g.special === "compass" ? COMPASS_INFO() : (g.label ? { ...itemOf(g.e), name: g.label } : itemOf(g.e));
  const sellsStones = () => ui.b === "shop";
  function shopSelInfo() {
    const c = hero(), sel = ui.sel;
    if (!sel) return `<span class="tw-hint">Нажми предмет: ${sellsStones() ? "купить или продать" : "купить"}. Удержи: описание.</span>`;
    if (sel.side === "bag") {
      const e = (c.bag || [])[sel.i], it = e && itemOf(e, c); if (!it) return "";
      const p = sellsStones() && e.t === "g" ? STONE_PRICE[e.id] : 0;
      if (!p) return `<b>${esc(it.name)}</b><span class="tw-hint">${sellsStones() ? "Магазин скупает только камни." : "Кузнец ничего не скупает."}</span>`;
      return `<b>${esc(it.name)}${e.qty > 1 ? " × " + e.qty : ""}</b><span class="tw-btns"><button class="fx-btn primary" data-t="sellopen">${e.qty > 1 ? "Продать… · по " + p : "Продать · +" + p}</button></span><span class="tw-hint">Можно перетащить на лавочника.</span>`;
    }
    const g = goodByKey(sel.key); if (!g) return "";
    const it = goodInfo(g), q = g.e ? g.e.qty : 1;
    if (owned(g)) return `<b>${esc(it.name)}</b><span class="tw-hint">Компас у отряда уже есть.</span>`;
    const can = partyGold() >= g.price, can5 = g.many && partyGold() >= g.price * 5;
    return `<b>${esc(it.name)}${q > 1 ? " × " + q : ""}</b><span class="tw-btns"><button class="fx-btn primary" data-t="buy" data-n="1"${can ? "" : " disabled"}>Купить · −${g.price}</button>${g.many ? `<button class="fx-btn" data-t="buy" data-n="5"${can5 ? "" : " disabled"}>×5 · −${g.price * 5}</button>` : ""}</span>
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
    const left = `<aside class="tw-bagcol">${heroStrip()}<div class="gold-row">${COIN_SVG}<b>${goldOf(c)}</b><small>монет у героя</small></div>${bagGrid(c, ui.sel && ui.sel.side === "bag" ? ui.sel.i : null)}</aside>`;
    const tabs = forge ? `<div class="tw-tabs"><button class="fx-btn" role="tab" aria-selected="${(ui.tab || "base") === "base"}" data-t="ftab" data-k="base">Обычное</button><button class="fx-btn" role="tab" aria-selected="${ui.tab === "steel"}" data-t="ftab" data-k="steel">Улучшенное</button></div>` : "";
    const sheet = `<div class="tw-sheet"><div class="tw-rod"></div><div class="tw-sheet-in">${tabs}<div class="tw-stock">${goodsOf().map(g => {
      const it = goodInfo(g), sel = ui.sel && ui.sel.side === "shop" && ui.sel.key === g.key, own = owned(g), q = g.e ? g.e.qty : 1;
      return `<button class="tw-slot${own ? " own" : ""}${it.steel ? " steel" : ""}" data-t="stock" data-id="${g.key}" aria-pressed="${!!sel}" aria-label="${esc(it.name)}, ${g.price} монет">
        <span class="tw-img">${it.art ? img(it.art, it.name) : (it.icon || GEAR_ICON.custom)}${q > 1 ? `<span class="q">×${q}</span>` : ""}${it.steel ? `<span class="q st">сталь</span>` : ""}</span>
        <span class="tw-name">${esc(it.name)}</span><span class="tw-price${partyGold() < g.price ? " no" : ""}">${COIN_SVG}${own ? "есть" : g.price}</span></button>`; }).join("")}</div>
      <p class="tw-buyline">${forge ? "Оружие — 10, броня — 15, улучшенное оружие — 25, улучшенная броня — 40 монет. Сталь: +1 к атаке и урону, +1 КД." : `Скупаю камни: 9 класс — ${STONE_PRICE["stone-9"]}, 8 класс — ${STONE_PRICE["stone-8"]}, 7 класс — ${STONE_PRICE["stone-7"]} монет.`}</p></div></div>`;
    const right = `<section class="tw-shopcol"><div class="tw-keeper">${forge ? img("assets/npc/smith.webp", "Кузнец") : KEEPER}<div class="tw-bubble">${esc(ui.talk || (ui.talk = forge ? SMITH_TALK[Math.floor(Math.random() * SMITH_TALK.length)] : talk()))}</div></div>${sheet}</section>`;
    return `<div class="tw-panel fx-frame">${head(title, "Рафдония")}<div class="tw-shop">${left}${right}</div><footer class="tw-foot">${msgLine()}<div class="tw-sel">${shopSelInfo()}</div></footer>${ui.dlg ? dlgHtml() : ""}</div>`;
  }
  // Окно «сколько продать»: ползунок от 1 до числа предметов в стопке.
  function dlgHtml() {
    const c = hero(), e = (c.bag || [])[ui.dlg.i]; if (!e) return "";
    const it = itemOf(e, c), p = STONE_PRICE[e.id] || 0, n = Math.min(ui.dlg.n, e.qty);
    return `<div class="tw-dlg" role="dialog" aria-label="Сколько продать"><div class="tw-dlg-card fx-frame">
      <div class="tw-dlg-top"><span class="tw-dlg-img">${itemThumb(e, c)}</span><div><b>${esc(it.name)}</b><small>В стопке: ${e.qty} · по ${p} монет</small></div></div>
      <div class="tw-dlg-row"><button class="fx-btn" data-t="dlg-step" data-d="-1" aria-label="Меньше">−</button>
        <input type="range" class="tw-range" min="1" max="${e.qty}" value="${n}" aria-label="Сколько продать">
        <button class="fx-btn" data-t="dlg-step" data-d="1" aria-label="Больше">+</button></div>
      <p class="tw-dlg-sum">Продать <b class="tw-dlg-n">${n}</b> из ${e.qty} → <b class="tw-dlg-gold">+${n * p}</b> монет</p>
      <div class="tw-btns"><button class="fx-btn" data-t="dlg-all">Все</button><button class="fx-btn" data-t="dlg-cancel">Отмена</button><button class="fx-btn primary" data-t="dlg-ok">Продать</button></div></div></div>`;
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
        const total = live.reduce((a, c) => a + (ui.sleep[c.id] ? TAVERN.sleep : 0) + (ui.food[c.id] ? TAVERN.food : 0), 0);
        const rows = live.map(c => { const st = carryOf(c);
          return `<div class="tw-row"><div class="tw-who">${portrait(c)}<div><b>${esc(c.name)}</b><small>Усталость ${st.fat}/4 · ${hungerText(st)} · ОЗ ${hpOf(c)}/${maxHp(c)}</small></div></div>
            <div class="tw-chk"><button class="fx-btn${ui.sleep[c.id] ? " on" : ""}" data-t="tv" data-k="sleep" data-id="${c.id}" aria-pressed="${!!ui.sleep[c.id]}">Сон · ${TAVERN.sleep}</button>
            <button class="fx-btn${ui.food[c.id] ? " on" : ""}" data-t="tv" data-k="food" data-id="${c.id}" aria-pressed="${!!ui.food[c.id]}">Еда · ${TAVERN.food}</button></div></div>`; }).join("");
        const body = `<div class="tw-npc">${img("assets/npc/innkeeper.webp", "Хозяин таверны")}<span>Добро пожаловать! Кровать мягкая, эль холодный.</span></div><p class="tw-lead">Ночлег снимает усталость и лечит, ужин и завтрак — сытость на заход. Без них следующий спуск начнётся с усталостью и голодом. Ночь занимает три городских действия, еда — одно.</p>
          <div class="tw-rows">${rows}</div>${msgLine()}`;
        const sleepers = live.filter(c => ui.sleep[c.id]).length, eaters = live.filter(c => ui.food[c.id]).length;
        const foot = `<div class="tw-sel"><b>К оплате: ${total}</b><span class="tw-hint">У отряда: ${partyGold()} монет · спят: ${sleepers}, едят: ${eaters}</span><span class="tw-btns"><button class="fx-btn" data-t="tv-all">Всем всё</button><button class="fx-btn primary" data-t="tv-pay"${total > 0 && partyGold() >= total ? "" : " disabled"}>Оплатить</button></span></div>`;
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
  function B_library() {
    B.library = {
      render() {
        const pool = infoPool();
        const body = `<p class="tw-lead">Пыльные тома и записки прежних отрядов. Мастер бросает к20: ${LIB_PASS}+ — находится сведение о каком-то монстре, 20 — два. Каждый бросок — одно городское действие.</p>
          ${ui.lines ? `<div class="tw-result fx-frame">${ui.lines.map(l => `<p>${l}</p>`).join("")}</div>` : ""}
          ${pool.length ? `<div class="roll-grid">${Array.from({ length: 20 }, (_, i) => `<button class="fx-btn${ui.rolled === i + 1 ? " on" : ""}" data-t="lib" data-n="${i + 1}">${i + 1}</button>`).join("")}</div>` : `<p class="tw-msg">В библиотеке больше нечего узнать о известных монстрах.</p>`}
          ${msgLine()}`;
        return frame("Библиотека", "Рафдония", body);
      },
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
  B.board = {
    render() {
      return frame("Доска объявлений", "Рафдония", `<div class="tw-board">
        <section class="fx-frame tw-note"><h4>События</h4><p>Сейчас в городе тихо. Новости появятся здесь.</p></section>
        <section class="fx-frame tw-note"><h4>Заказы на монстров</h4><p>Заказов пока нет.</p></section></div>`);
    },
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
  function B_tower() {
    B.tower = {
      render() {
        const c = hero(); if (!c) return frame("Башня магов", "Рафдония", noParty());
        const ess = c.essences || [];
        const rows = ess.map(id => { const e = ESSENCES[id], n = essLvl(id), price = TOWER[e.cls] || 10;
          return `<div class="tw-row"><div class="tw-who"><div><b>${esc(essTitle(id))}</b><small>${e.cls} класс · изучено ${n} из 3</small></div></div>
            ${n === 3 ? `<span class="tw-done">${ICO_CHECK}</span>` : `<button class="fx-btn primary" data-t="analyze" data-id="${id}"${partyGold() >= price ? "" : " disabled"}>${price}</button>`}</div>`; }).join("");
        return frame("Башня магов", "Рафдония", `${heroStrip()}<p class="tw-lead">Маг заглянет в героя и расскажет всё о впитанных им эссенциях: статы, пассивную и активную способность. Цена зависит от класса эссенции.</p>
          ${ess.length ? `<div class="tw-rows">${rows}</div>` : `<p class="tw-msg">У ${esc(c.name)} нет эссенций.</p>`}${msgLine()}`);
      },
    };
  }

  /* =====================================================================
     ЦЕРКОВЬ: удаление эссенций
     ===================================================================== */
  B_church();
  function B_church() {
    B.church = {
      render() {
        const c = hero(); if (!c) return frame("Церковь", "Рафдония", noParty());
        const ess = c.essences || [];
        const rows = ess.map(id => { const e = ESSENCES[id], price = CHURCH[e.cls] || 15, ask = ui.confirm === id, nm = esc(essTitle(id));
          return `<div class="tw-row"><div class="tw-who"><div><b>${nm}</b><small>${e.cls} класс · освободит слот</small></div></div>
            <button class="fx-btn${ask ? " danger" : ""}" data-t="purge" data-id="${id}"${partyGold() >= price ? "" : " disabled"}>${ask ? "Точно? " + price : "Удалить · " + price}</button></div>`; }).join("");
        return frame("Церковь", "Рафдония", `${heroStrip()}<p class="tw-lead">Священник очистит героя от впитанной эссенции — она исчезнет безвозвратно, слот освободится. Слотов: ${ess.length}/${c.level}.</p>
          ${ess.length ? `<div class="tw-rows">${rows}</div>` : `<p class="tw-msg">У ${esc(c.name)} нет эссенций.</p>`}${msgLine()}`);
      },
    };
  }

  /* ---------- действия ---------- */
  const priceOf = e => (sellsStones() && e && e.t === "g" ? STONE_PRICE[e.id] : 0) || 0;
  function sellN(i, n) {
    const c = hero(), e = (c.bag || [])[i], p = priceOf(e); if (!p) return;
    n = Math.max(1, Math.min(n, e.qty)); const name = itemOf(e, c).name;
    e.qty -= n; if (e.qty <= 0) { c.bag.splice(i, 1); ui.sel = null; }
    addGold(c, p * n); visit(); ui.talk = talk(); ui.msg = `Продано: ${name} × ${n} за ${p * n} монет — ${c.name}.`; saveChar();
  }
  // Предмет предложен лавочнику (кнопкой или перетаскиванием): одиночный продаётся сразу, у стопки спрашиваем количество.
  function offer(i) {
    const c = hero(), e = (c.bag || [])[i]; if (!e) return;
    if (!priceOf(e)) { ui.msg = sellsStones() ? "Магазин скупает только камни." : "Кузнец ничего не скупает."; return; }
    if (e.qty > 1) ui.dlg = { i, n: 1 }; else sellN(i, 1);
  }
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
    const total = live.reduce((a, c) => a + (ui.sleep[c.id] ? TAVERN.sleep : 0) + (ui.food[c.id] ? TAVERN.food : 0), 0);
    if (!total || !payGold(live[0], total)) { ui.msg = "Не хватает монет."; return; }
    let slept = 0, ate = 0;
    for (const c of live) {
      const st = carryOf(c);
      if (ui.sleep[c.id]) { st.fat = 0; st.awake = 0; c.hp = maxHp(c); c.mp = maxMp(c); c.insp = 1; c.flags = {}; slept++; }
      if (ui.food[c.id]) { st.sat = 9; st.starve = 0; ate++; }
    }
    spend(slept ? 3 : 1); ui.sleep = {}; ui.food = {};
    ui.msg = `Оплачено ${total}: спали ${slept}, поели ${ate}.`; saveChar();
  }
  function analyze(id) {
    const e = ESSENCES[id], price = TOWER[e.cls] || 10;
    if (!payGold(hero(), price)) { ui.msg = "Не хватает монет."; return; }
    seenKeys(essSource(id), ["ess-stats", "ess-passive", "ess-active"]); markEssNamed(id);          // сведения попадают в библиотеку, и наоборот: прочитанное там открыто при получении
    visit(); ui.msg = `Анализ завершён: ${esc(ESSENCES[id].name)} раскрыта, сведения записаны в библиотеку.`; saveChar();
  }
  function purge(id) {
    const c = hero(), e = ESSENCES[id], price = CHURCH[e.cls] || 15;
    if (ui.confirm !== id) { ui.confirm = id; ui.msg = "Эссенция исчезнет навсегда. Нажми ещё раз."; return; }
    if (!payGold(c, price)) { ui.msg = "Не хватает монет."; return; }
    const i = (c.essences || []).indexOf(id); if (i < 0) return;
    c.essences.splice(i, 1); c.hp = Math.min(hpOf(c), maxHp(c)); c.mp = Math.min(mpOf(c), maxMp(c));
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
    if (!e.target.classList.contains("tw-range") || !ui || !ui.dlg) return;
    const ent = (hero().bag || [])[ui.dlg.i]; if (!ent) return;
    ui.dlg.n = +e.target.value; const p = priceOf(ent);
    host.querySelector(".tw-dlg-n").textContent = ui.dlg.n; host.querySelector(".tw-dlg-gold").textContent = "+" + ui.dlg.n * p;
  });
  // Перетаскивание предмета из рюкзака на лавочника/витрину = продать.
  let drag = null; T.drag = () => drag;
  host.addEventListener("dragstart", e => e.preventDefault());          // браузерное перетаскивание картинки отменяло бы наш жест (pointercancel)
  const dropZone = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest(".tw-shopcol"); };
  host.addEventListener("pointerdown", e => {
    const el = e.target.closest("[data-t='bag']"); if (!el || !ui || !(ui.b === "shop" || ui.b === "forge") || ui.dlg) return;
    drag = { i: +el.dataset.i, x: e.clientX, y: e.clientY, on: false, ghost: null };
  });
  window.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 9) return;
      drag.on = true; clearTimeout(hold.t); hold.fired = true;
      const c = hero(), ent = (c.bag || [])[drag.i]; if (!ent) { drag = null; return; }
      ui.sel = { side: "bag", i: drag.i };
      const g = document.createElement("div"); g.className = "tw-ghost"; g.innerHTML = itemThumb(ent, c); host.appendChild(g); drag.ghost = g; host.classList.add("tw-dragging");
    }
    drag.ghost.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
    const z = host.querySelector(".tw-shopcol"); if (z) z.classList.toggle("drop-ok", !!dropZone(e.clientX, e.clientY));
  }, { passive: true });
  const endDrag = (e, ok) => {
    const d = drag; drag = null; if (!d || !d.on) return;
    if (d.ghost) d.ghost.remove(); host.classList.remove("tw-dragging");
    const z = host.querySelector(".tw-shopcol"); if (z) z.classList.remove("drop-ok");
    if (ok && ui && dropZone(e.clientX, e.clientY)) { ui.msg = ""; offer(d.i); }
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
      case "sellopen": if (ui.sel && ui.sel.side === "bag") offer(ui.sel.i); break;
      case "dlg-step": { const e = (hero().bag || [])[ui.dlg.i]; ui.dlg.n = Math.max(1, Math.min(e ? e.qty : 1, ui.dlg.n + +ds.d)); break; }
      case "dlg-all": { const e = (hero().bag || [])[ui.dlg.i]; ui.dlg.n = e ? e.qty : 1; break; }
      case "dlg-cancel": ui.dlg = null; break;
      case "dlg-ok": { const d = ui.dlg; ui.dlg = null; sellN(d.i, d.n); break; }
      case "buy": buy(+ds.n); break;
      case "tv": { const m = ui[ds.k]; m[ds.id] = !m[ds.id]; break; }
      case "tv-all": for (const c of state.party.filter(x => !x.dead)) { ui.sleep[c.id] = true; ui.food[c.id] = true; } break;
      case "tv-pay": tavernPay(); break;
      case "lib": libRoll(+ds.n); break;
      case "gtab": ui.tab = ds.k; ui.mon = null; break;
      case "gmon": ui.mon = ds.id; break;
      case "gback": ui.mon = null; break;
      case "gbuy": guildBuy(ds.k); break;
      case "gsell": guildSell(ds.id); break;
      case "analyze": analyze(ds.id); break;
      case "purge": purge(ds.id); break;
    }
    render();
  });
  window.Town._B = B;
})();
