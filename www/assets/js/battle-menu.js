/* Тактический бой: панель действий героя, выбор целей и клеток, окна подтверждений и инспектор.
   Все действия до броска можно отменить. См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D, UI = B.UI;
  const { esc, ico, stIco, sleep } = UI;
  const has = (u, id) => B.has(u, id);
  const TIME_BADGE = { action: ["Д", "действие"], bonus: ["Б", "доп. действие"], reaction: ["Р", "реакция"], free: ["С", "свободно"], move: ["П", "перемещение"] };
  const DOCK = [["attack", "Атака", "attack"], ["skill", "Навыки", "skills"], ["move", "Движение", "move"], ["defend", "Оборона", "defend"],
    ["other", "Ещё", "more"], ["item", "Предметы", "items"], ["flee", "Побег", "flee"], ["end", "Конец хода", "end"]];
  const q = s => UI.root().querySelector(s);

  /* ===== панель ===== */
  const barHtml = (cls, cur, max) => `<div class="bt-meter ${cls}"><i style="width:${max ? Math.round(Math.max(0, Math.min(1, cur / max)) * 100) : 0}%"></i></div>`;
  function unitCard(u, compact) {
    const sts = u.conds.filter(c => D.status[c.id]).map(c => `<span class="bt-stchip ${D.status[c.id].good ? "good" : "bad"}" data-sid="${c.id}" data-uid="${u.id}" title="Удерживайте: что это">${stIco(c.id)}${esc(D.status[c.id].name)}</span>`).join("");
    const hero = !!u.hero, mine = u.side === "hero";
    return `<div class="bt-card${compact ? " compact" : ""}"><div class="bt-cface ${u.side}${u.spectral ? " ghost" : ""}"><img src="${u.face}" alt=""></div>
      <div class="bt-cinfo"><b>${esc(u.name)}</b><small>${hero ? `${esc(raceById(u.race).name)} · ${u.level} ур. · КД ${u.ac}` : u.summon ? `${u.kind === "double" ? "Двойник" : "Призванный волк"} · КД ${u.ac}` : `${esc(u.mon.size)} · КД ${u.ac}`}</small>
        ${mine || B.S.opts.showMonHp ? `<div class="bt-nums"><span class="hp">ОЗ <b>${u.hp}</b>/${u.maxHp}${u.temp ? ` <em>+${u.temp}</em>` : ""}</span>${hero ? `<span class="mp">Мана <b>${u.mp}</b>/${u.maxMp}</span>` : ""}</div>${barHtml("hp", u.hp, u.maxHp)}${hero ? barHtml("mp", u.mp, u.maxMp) : ""}` : `<div class="bt-nums"><span class="hp">ОЗ скрыты</span></div>`}
      </div></div>${sts ? `<div class="bt-stline">${sts}</div>` : ""}`;
  }
  function resChips(u) {
    const t = u.t || {}, sp = B.speedOf(u);
    return `<div class="bt-reschips"><span class="rc mv" title="Перемещение">${ico("move")}<b>${t.move || 0}</b>/${sp + (t.dash ? sp : 0)}</span>
      <span class="rc ${t.action > 0 ? "on" : "off"}" title="Действие"><i>Д</i>действие</span><span class="rc ${t.bonus > 0 ? "on bn" : "off"}" title="Доп. действие"><i>Б</i>доп.</span>
      <span class="rc ${t.react > 0 ? "on rn" : "off"}" title="Реакция"><i>Р</i>реакция</span></div>`;
  }
  function optionHtml(o) {
    const [b, bt] = TIME_BADGE[o.time] || ["", ""];
    const cost = o.ess && ESSENCES[o.ess] ? "" : "";
    return `<button class="bt-opt${o.enabled ? "" : " off"}" data-ba="opt" data-id="${esc(o.id)}" aria-disabled="${!o.enabled}">
      <span class="oi">${ico(o.ico || "attack")}</span><span class="ot"><b>${esc(o.label)}</b><small>${esc(o.sub || "")}</small>${!o.enabled && o.why ? `<em>${esc(o.why)}</em>` : ""}</span>
      <span class="ob t-${o.time}" title="${esc(bt)}">${b}</span></button>`;
  }
  // Пассивные способности эссенций — справка под списком навыков.
  function passiveRows(u) {
    const known = id => typeof essSeen !== "function" || essSeen(id, "ess-passive");          // описание пассивки видно, только если оно изучено (библиотека, анализ в башне)
    const rows = u.ess.filter(id => ESSENCES[id]).map(id => { const e = ESSENCES[id]; return known(id) ? `<div class="bt-prow"><b>${esc(e.passive.name)}</b><small>${esc(e.passive.text)}</small></div>` : `<div class="bt-prow"><b>Неизвестная пассивка</b><small>свойства этой эссенции ещё не изучены</small></div>`; });
    return rows.length ? `<h6 class="bt-ph">Пассивные способности</h6>${rows.join("")}` : "";
  }
  const CATS = { attack: ["Атака", ["attack"]], skill: ["Навыки", ["skill"]], other: ["Прочие действия", ["other", "move"]], item: ["Предметы", ["item"]] };
  UI.renderPanel = function () {
    const S = B.S, p = q(".bt-panel"); if (!p || !S) return;
    if (UI.mode === "place" || UI.mode === "ambush") return renderPlace(p);
    if (UI.mode === "result") return;
    const u = UI.turnUnit;
    if (u && UI.mode === "hero") {
      let h = unitCard(u, !!UI.cat && !UI.pick) + resChips(u);
      if (UI.pick) {
        h += pickPromptHtml();
      } else {
        const opts = B.actionsFor(u), noLeft = !(u.t.action > 0) && !(u.t.bonus > 0) && !(u.t.move > 0), pop = opts.find(o => o.pop && o.enabled);
        if (pop) h += `<button class="bt-pickup" data-ba="pickup">${ico("throwing")}<span><b>${esc(pop.label)}</b><small>свободное действие — вы стоите на нём</small></span></button>`;
        h += `<div class="bt-dock">${(u.summon ? DOCK.filter(d => ["attack", "move", "end"].includes(d[0])) : DOCK).map(([id, label, ic]) => `<button class="bt-dk${UI.cat === id ? " on" : ""}${id === "end" && noLeft ? " pulse" : ""}" data-ba="dock" data-id="${id}"><span>${ico(ic)}</span><small>${label}</small></button>`).join("")}</div>`;
        if (UI.cat && CATS[UI.cat]) {
          const list = opts.filter(o => CATS[UI.cat][1].includes(o.cat) && !(UI.cat === "other" && o.id === "move"));
          h += `<div class="bt-list"><div class="bt-listh"><b>${CATS[UI.cat][0]}</b><button class="bt-x" data-ba="dock" data-id="${UI.cat}" aria-label="Свернуть">${ico("close")}</button></div>${list.length ? list.map(optionHtml).join("") : `<p class="bt-empty">Здесь пока ничего нет.</p>`}${UI.cat === "skill" ? passiveRows(u) : ""}</div>`;
        } else if (!UI.cat) h += `<p class="bt-hint">Выберите действие. Нажмите на любого бойца на поле, чтобы посмотреть его состояние.</p>`;
      }
      p.innerHTML = h;
      if (UI.cat && !UI.pick) { const dk = p.querySelector(".bt-dock"); if (dk) { const d = dk.getBoundingClientRect().top - p.getBoundingClientRect().top - 4; if (d > 0 || p.scrollTop > 0) p.scrollTop = Math.max(0, p.scrollTop + d); } }          // кнопки действий остаются целыми, список раскрывается под ними
      return;
    }
    // чужой ход; выбор, начатый до меню хода (вынырнуть из-под земли в начале хода), тоже показывает подсказку и кнопки
    const cu = B.currentUnit();
    p.innerHTML = (cu ? unitCard(cu) : "") + (UI.pick ? pickPromptHtml() : `<div class="bt-ticker">${(S.log.slice(-5)).reverse().map(l => `<p class="${l.c}">${esc(l.t)}</p>`).join("")}</div>`);
  };
  // Подсказка выбора цели/клетки/пути с кнопками «Отмена» и «Готово».
  const pickPromptHtml = () => `<div class="bt-prompt"><p>${esc(UI.pick.prompt || "")}</p><div class="btns">${UI.pick.extraBtns || ""}<button class="fx-btn" data-ba="pick-cancel">Отмена</button>${UI.pick.confirmable ? `<button class="fx-btn primary" data-ba="pick-ok"${UI.pick.canOk ? "" : " disabled"}>${esc(UI.pick.okLabel || "Готово")}</button>` : ""}</div></div>`;
  UI.renderLogTicker = function () { if (UI.mode !== "hero" && UI.mode !== "place") UI.renderPanel(); };
  function renderPlace(p) {
    const S = B.S, hs = B.heroes().filter(h => !h.dead), pp = UI.panelPlace || {};
    if (UI.placeOnly) { const h = B.byId(UI.placeOnly); p.innerHTML = `<div class="bt-prompt"><h4>Расстановка: ${esc(h ? h.name : "")}</h4><p>Нажмите свободную клетку в трёх нижних рядах — герой встанет туда. Когда готовы, нажмите «Готово»: очередь перейдёт дальше.</p><div class="btns"><button class="fx-btn primary big" data-ba="place-go">Готово</button></div></div>`; return; }
    if (pp.ambush) { p.innerHTML = `<div class="bt-prompt"><h4>Засада!</h4><p>Герои застигнуты врасплох и стоят в ряд на третьей линии. Монстры ходят первыми.</p><div class="btns"><button class="fx-btn primary big" data-ba="place-go">К бою!</button></div></div>`; return; }
    p.innerHTML = `<div class="bt-prompt"><h4>${S.heroAmbush ? "Засада отряда" : "Расстановка"}</h4><p>Выберите героя, затем клетку в трёх нижних рядах. ${S.heroAmbush ? "Враги стоят в одну линию и не ждут нападения: герои ходят первыми." : "Враги появятся после расстановки."}</p>
      <div class="bt-chips">${hs.map(h => `<button class="bt-pchip${UI.placeSel === h.id ? " on" : ""}" data-ba="place-sel" data-id="${h.id}"><img src="${h.face}" alt=""><span>${esc(h.name)}</span></button>`).join("")}</div>
      <div class="btns"><button class="fx-btn primary big" data-ba="place-go">В бой!</button></div></div>`;
  }

  /* ===== клики панели и окон ===== */
  function panelClick(e) {
    const el = e.target.closest("[data-ba]"); if (!el) return;
    const a = el.dataset.ba, id = el.dataset.id, u = UI.turnUnit;
    if (a === "place-sel") { UI.placeSel = id; UI.paintPlace(); UI.renderPanel(); return; }
    if (a === "place-go") { UI.placeDone(); return; }
    if (a === "dock") { dock(id); return; }
    if (a === "opt") { const o = B.actionsFor(u).find(x => x.id === id); if (o) runOption(o); return; }
    if (a === "pickup") { const o = B.actionsFor(u).find(x => x.id === "pickup"); if (o) runOption(o); return; }
    if (a === "pick-cancel") { if (UI.pick) UI.pick.cancel(); return; }
    if (a === "pick-ok") { if (UI.pick && UI.pick.ok) UI.pick.ok(); return; }
  }
  async function dock(id) {
    const u = UI.turnUnit; if (!u || UI.busy || UI.pick) return;
    if (id === "end") { endTurn(); return; }
    if (id === "move") { const o = B.actionsFor(u).find(x => x.id === "move"); if (o) runOption(o); return; }
    if (id === "defend") { const o = B.actionsFor(u).find(x => x.id === "defend"); if (o) { if (!o.enabled) { UI.toast(o.why); return; } if (await UI.confirm({ title: "Оборона", text: "Атаки по вам будут с помехой, а спасброски Ловкости — с преимуществом до начала вашего следующего хода. Тратит действие." })) runOption(o); } return; }
    if (id === "flee") { const o = B.actionsFor(u).find(x => x.id === "flee"); if (o) runOption(o); return; }
    UI.cat = UI.cat === id ? null : id; UI.renderPanel();
  }
  async function runOption(o) {
    const u = UI.turnUnit; if (!u || UI.busy) return;
    if (!o.enabled) { UI.toast(o.why || "Сейчас недоступно"); return; }
    if (["dash", "disengage"].includes(o.id) && !(await UI.confirm({ title: o.label, text: o.sub + ". Тратит действие." }))) return;
    UI.busy = true; UI.cat = null;
    try { await o.run(); } catch (err) { console.error("действие:", err); UI.toast("Ошибка действия"); }
    UI.busy = false; UI.setHl(new Map()); UI.pathPreview = null; UI.targetIds = null; UI.selIds = null;
    UI.refreshNow();
    if (B.checkEnd() || u.escaped || u.down || !B.alive(u)) endTurn();
    else if (B.S.opts.autoEnd && UI.turnUnit === u && B.turnSpent(u)) await autoEnd(u);
    else UI.renderPanel();
  }
  // Действия кончились: коротко показываем это и передаём ход (отключается в меню боя).
  async function autoEnd(u) {
    UI.busy = true; UI.renderPanel();
    UI.banner("Действия закончились — ход завершён", 1100);
    await sleep(B.cfg.fast ? 0 : 650);
    UI.busy = false;
    if (UI.turnUnit === u && UI.mode === "hero" && !UI.pick) endTurn(); else UI.renderPanel();
  }
  function endTurn() { if (UI.endTurn) { const f = UI.endTurn; UI.endTurn = null; UI.pick && UI.pick.cancel && UI.pick.cancel(); f(); } }
  UI.heroTurn = function (u) {
    return new Promise(resolve => {
      UI.turnUnit = u; UI.cat = null; UI.mode = "hero"; UI.busy = false; UI.pick = null;
      UI.endTurn = () => { UI.mode = "idle"; UI.turnUnit = null; UI.cat = null; UI.setHl(new Map()); resolve(); UI.refresh(); };
      UI.refreshNow();
    });
  };

  /* ===== окна ===== */
  function showModal(html) { const m = q(".bt-modal"); m.innerHTML = html; m.hidden = false; return m; }
  function hideModal() { const m = q(".bt-modal"); if (m) { m.hidden = true; m.innerHTML = ""; } }
  UI.confirm = function (o) {
    return new Promise(resolve => {
      const m = showModal(`<div class="bt-dlg fx-frame"><h4>${esc(o.title)}</h4><p>${esc(o.text || "")}</p><div class="btns"><button class="fx-btn" data-m="no">${esc(o.no || "Отмена")}</button><button class="fx-btn primary" data-m="yes">${esc(o.yes || "Да")}</button></div></div>`);
      m.onclick = e => { const b = e.target.closest("[data-m]"); if (!b) return; hideModal(); resolve(b.dataset.m === "yes"); };
    });
  };
  UI.promptReaction = function (o) {
    return new Promise(resolve => {
      const m = showModal(`<div class="bt-dlg fx-frame react"><small class="bt-eyebrow">Реакция</small><h4>${esc(o.title)}</h4><p>${esc(o.text || "")}</p><div class="btns"><button class="fx-btn" data-m="no">${esc(o.no || "Пропустить")}</button><button class="fx-btn primary" data-m="yes">${esc(o.yes || "Да")}</button></div></div>`);
      m.onclick = e => { const b = e.target.closest("[data-m]"); if (!b) return; hideModal(); resolve(b.dataset.m === "yes"); };
    });
  };
  UI.choose = function (o) {
    return new Promise(resolve => {
      const m = showModal(`<div class="bt-dlg fx-frame"><h4>${esc(o.title)}</h4><div class="bt-choices">${o.options.map(x => `<button class="fx-btn" data-m="${esc(x.id)}">${esc(x.label)}</button>`).join("")}</div><div class="btns"><button class="fx-btn" data-m="__no">Отмена</button></div></div>`);
      m.onclick = e => { const b = e.target.closest("[data-m]"); if (!b) return; hideModal(); resolve(b.dataset.m === "__no" ? null : b.dataset.m); };
    });
  };
  // note — HTML сноски справа с эффектом поля (долгое нажатие на клетку с бойцом).
  UI.inspect = function (u, note) {
    const S = B.S, hero = !!u.hero, mine = u.side === "hero";
    const GM = typeof masterOn === "function" && masterOn(), foe = !mine && !u.summon, rev = foe && !GM ? ((typeof journal === "function" && (journal().known[u.ref || (u.mon && u.mon.id)] || {}).revealed) || []) : null;          // обычному игроку про врага видно только раскрытое в библиотеке; мастеру — всё, если включён «Режим мастера»
    const kStats = !rev || rev.includes("stats"), kType = !rev || rev.includes("type") || rev.includes("stats"), kAtk = !rev || rev.includes("attacks") || rev.includes("stats");
    const atk = B.attacksOf(u).filter(a => !a.offhand).map(a => `<li><b>${esc(a.n)}</b> · ${a.kind === "melee" ? "ближний" : "дальний"} · ${a.hit != null ? "+" + (a.hit) : ""} · ${a.dmg.n ? B.fmtDice(a.dmg) : a.dmg.b} ${D.DT[a.dt] || ""}${a.dmgMult === 0.5 ? " (вполсилы)" : ""}</li>`).join("");
    const ess = (!hero && !u.summon ? [] : u.ess).map(id => { const e = ESSENCES[id]; return `<li><b>${esc(e.passive.name)} (П).</b> ${esc(e.passive.text)}</li><li><b>${esc(e.active.name)} (А).</b> ${e.active.mana} маны, ${esc(e.active.time)}. ${esc(e.active.text)}</li>`; }).join("");
    const sts = u.conds.filter(c => D.status[c.id]).map(c => `<li><span class="bt-stchip ${D.status[c.id].good ? "good" : "bad"}" data-sid="${c.id}" data-uid="${u.id}">${stIco(c.id)}${esc(D.status[c.id].name)}</span> ${esc(D.status[c.id].desc)}</li>`).join("");
    const owner = u.summon ? B.byId(u.owner) : null;
    const sub = hero ? esc(raceById(u.race).name) + " · " + u.level + " ур." : u.summon ? (u.kind === "double" ? `Двойник · ${esc(owner ? owner.name : "")} · исчезает от любого урона` : `Призванный волк · ${esc(owner ? owner.name : "")}`) : (kType ? esc(u.mon.size) + " · " + u.cls + " класс" : "") + (kType && typeof monCourse === "function" && monCourse(u.cls) ? ` · <b class="bt-rankbadge">${esc(monBadge(u.mon))}</b>` : "");
    const body = `<div class="bt-dlg fx-frame insp"><div class="bt-ihead"><div class="bt-cface ${u.side}${u.spectral ? " ghost" : ""}"><img src="${u.face}" alt=""></div><div><h4>${esc(u.name)}</h4><small>${sub}</small></div><button class="bt-x" data-m="close" aria-label="Закрыть">${ico("close")}</button></div>
      <div class="bt-istats">${hero || u.summon ? `<span>КД <b>${u.ac}</b></span>` : ""}${kStats ? `<span title="Клеток хода в бою">Скорость <b>${B.speedOf(u)} кл.</b></span>` : ""}${mine || S.opts.showMonHp ? `<span>ОЗ <b>${u.hp}/${u.maxHp}</b></span>` : `<span>ОЗ <b>скрыты</b></span>`}${hero ? `<span>Мана <b>${u.mp}/${u.maxMp}</b></span>` : ""}</div>
      ${kStats ? `<div class="bt-iabil">${["str", "dex", "con", "int", "wis", "cha"].map(k => `<span>${B.ABIL_RU[k].slice(0, 3)} <b>${u.abil[k]}</b></span>`).join("")}</div>` : ""}
      ${sts ? `<h5>Состояния</h5><ul>${sts}</ul>` : ""}${kAtk ? `<h5>Атаки</h5><ul>${atk}</ul>` : ""}${ess ? `<h5>Навыки эссенции</h5><ul>${ess}</ul>` : ""}</div>`;
    const m = showModal(note ? `<div class="bt-insp-wrap">${body}<aside class="bt-fieldnote fx-frame" aria-label="Эффект поля">${note}</aside></div>` : body);
    m.onclick = e => { if (e.target.closest("[data-m]") || !e.target.closest(".bt-dlg, .bt-fieldnote")) hideModal(); };          // клик по свободной части экрана закрывает окно
  };
  /* ===== эффекты клетки: долгое нажатие по полю ===== */
  // Список строк «что здесь»: местность, свет, ловушка, зона, иллюзия, тело, лежащее оружие.
  UI.cellEffects = function (x, y) {
    const S = B.S, t = B.tinfo(x, y), tid = B.terrain(x, y), out = [];
    out.push({ h: t ? t.name : "Ровная земля", t: t ? t.note : "Обычная земля: ничего особенного." });
    const od = B.objAt && B.objAt(x, y); if (od) out.push({ h: "Можно разрушить", t: `КД ${od.ac}, ОЗ ${od.hp}/${od.maxHp}. Бьют оружием (молот и тяжёлое оружие — с преимуществом, обычное по камню может отдать в руку) или областью: взрывом, обвалом.` });
    if (t && t.block) out.push({ h: "Закрывает обзор", t: "Клетки за ним не видны, туда нельзя стрелять, метать и колдовать." });
    if (t && t.wet) out.push({ h: "Вода", t: "Холод и молния по вставшему сюда +1к4." });
    if (S.dark) out.push({ h: B.lightAt(x, y) ? "Освещено" : "Тьма", t: B.lightAt(x, y) ? "Свет: штрафов тьмы нет." : "Помеха на Восприятие и дальние атаки у тех, кто без тёмного зрения; в тени можно прятаться." });
    for (const o of S.objs) if (o.x === x && o.y === y) {
      if (o.kind === "trap" && (!o.hidden || o.owner === "hero")) out.push({ h: "Ловушка", t: `Сл ${o.dc}, ${o.dmg} ${D.DT[o.dt] || ""}; наступивший спасается Ловкостью, при провале опутан.` });
      if (o.kind === "find") { const f = typeof FINDS !== "undefined" && FINDS[o.fid], hero = UI.turnUnit && UI.turnUnit.hero; if (f) { const kn = typeof findKnown === "function" ? findKnown(hero, o.fid) : true; out.push({ h: kn ? f.name : f.alias, t: kn ? findNote(f) : "Эффект неизвестен: нужен навык или знания. Собрать — действием рядом (проверка), одноразовый." }); } }
      if (o.kind === "chest") out.push({ h: o.opened ? "Сундук пуст" : "Сундук", t: o.opened ? "Уже открыт." : "Откройте рядом действием: внутри добыча." });
      if (o.kind === "illusion") out.push({ h: "Иллюзия «Морока»", t: "Неподвижная иллюзия: кто её увидел, проверяет Проницательность. Исчезнет через минуту." });
    }
    for (const z of S.zones || []) if (B.zoneCells(z).some(([cx, cy]) => cx === x && cy === y)) out.push(z.kind === "swarm" ? { h: "Рой паучат", t: `Начавший ход здесь получает 2к4 колющего и спасается Телосложением (Сл ${z.dc}), провал — отравлен. Огонь уничтожает рой.` } : { h: "Белая пыль", t: `Сильное заслонение: видно на 1,5 м. Начавший ход здесь, кроме пепельника, спасается Телосложением (Сл ${z.dc}), провал — отравлен.` });
    for (const b of S.bodies || []) if (!b.eaten && b.x === x && b.y === y) out.push({ h: "Павший", t: `${b.name}: тело.` });
    const w = S.drops.filter(d => d.x === x && d.y === y && d.kind === "weapon"), ar = S.drops.filter(d => d.x === x && d.y === y && d.kind === "arrow").length;
    if (w.length) out.push({ h: "Лежит оружие", t: w.map(d => { const it = typeof itemOf === "function" && itemOf(d.item), hh = B.heroes().find(q => q.hero && q.hero.id === d.hero); return `${it ? it.name : "оружие"}${hh ? " (" + hh.name + ")" : ""}`; }).join(", ") + ". Хозяин подбирает его, встав на клетку — свободное действие." });
    if (ar) out.push({ h: "Стрелы", t: `${ar} шт. Подбираются после боя, если отряд не бежал.` });
    return out;
  };
  const effectsHtml = (x, y) => `<small class="bt-eyebrow">Поле ${x + 1}:${y + 1}</small>` + UI.cellEffects(x, y).map(e => `<h6>${esc(e.h)}</h6><p>${esc(e.t)}</p>`).join("");
  // Сноска о состоянии: название, что делает, сколько ещё действует.
  UI.statusNote = function (uid, sid) {
    const u = B.byId(uid), st = D.status[sid], c = u && u.conds.find(q => q.id === sid); if (!st) return;
    const left = c ? (c.k === Infinity ? "пока не снимут" : (() => { const n = c.k - (u.turnsTaken || 0); return n > 0 ? `ещё ${n} ${n === 1 ? "ход" : n < 5 ? "хода" : "ходов"} ${u.name}` : "до конца текущего хода"; })()) : "";
    const m = showModal(`<div class="bt-dlg fx-frame cellinfo"><div class="bt-ihead"><h4>${esc(st.name)}</h4><button class="bt-x" data-m="close" aria-label="Закрыть">${ico("close")}</button></div><p class="left">${esc(st.desc || "")}</p>${left ? `<p class="left"><small>${esc(u.name)}: ${esc(left)}.</small></p>` : ""}</div>`);
    m.onclick = e => { if (e.target.closest("[data-m]") || e.target === m) hideModal(); };
  };
  UI.cellInfo = function (x, y) {
    const u = B.occupant(x, y);
    if (u) { UI.inspect(u, effectsHtml(x, y)); return; }                                         // боец на клетке: его окно, справа — сноска поля
    const m = showModal(`<div class="bt-dlg fx-frame cellinfo"><div class="bt-ihead"><h4>Клетка ${x + 1}:${y + 1}</h4><button class="bt-x" data-m="close" aria-label="Закрыть">${ico("close")}</button></div>${UI.cellEffects(x, y).map(e => `<h5>${esc(e.h)}</h5><p class="left">${esc(e.t)}</p>`).join("")}</div>`);
    m.onclick = e => { if (e.target.closest("[data-m]") || e.target === m) hideModal(); };
  };
  // Долгое нажатие: при выборе движения ставит или снимает путевую точку, иначе показывает эффекты клетки.
  UI.onCellHold = function (x, y) {
    if (!UI.active || !B.S || UI.mode === "result") return;          // на расстановке тоже можно узнать особенности клетки
    const m = q(".bt-modal"); if (m && !m.hidden) return;
    if (UI.holdHandle && UI.mode !== "place") { UI.holdHandle(x, y); return; }
    UI.cellInfo(x, y);
  };
  // Сводка спасбросков по нескольким целям: закрывается кнопкой, бой ждёт.
  UI.summary = function (title, sub, rows, reroll) {
    return new Promise(res => {
      const draw = rs => `<div class="bt-dlg fx-frame cellinfo"><div class="bt-ihead"><h4>${esc(title)}</h4></div><p class="bt-sub">${esc(sub)}</p>
        <ul class="bt-sum">${rs.map((r, i) => `<li class="${r.ok ? "ok" : "bad"}"><span class="n">${esc(r.name)}</span><span class="v">${r.total}</span><b>${r.ok ? "устоял" : "провал"}</b>${reroll && r.side === "hero" ? `<button class="fx-btn bt-rr" data-rr="${i}"${r.canReroll ? "" : " disabled"} title="Потратить переброс">Переброс</button>` : ""}</li>`).join("")}</ul>
        <div class="bt-btns"><button class="fx-btn primary" data-m="sumok">Готово</button></div></div>`;
      const m = showModal(draw(rows));
      UI.sumRedraw = rs => { if (m.isConnected && !m.hidden) m.innerHTML = draw(rs); };          // онлайн: игрок перебросил у себя — сводка у ведущего обновляется
      m.onclick = e => {
        if (e.target.closest("[data-m=sumok]")) { hideModal(); UI.sumRedraw = null; res(); return; }
        const b = e.target.closest("[data-rr]"); if (b && !b.disabled && reroll) m.innerHTML = draw(reroll(+b.dataset.rr));
      };
    });
  };
  UI.menu = function () {
    const S = B.S, PLAYER = typeof isMaster === "function" && !isMaster();          // у игрока в меню боя нет функций ведущего
    const lines = S.log.slice(-30).reverse().map(l => `<p class="${l.c}">${esc(l.t)}</p>`).join("");
    const m = showModal(`<div class="bt-dlg fx-frame menu"><div class="bt-ihead"><h4>Меню боя</h4><button class="bt-x" data-m="close" aria-label="Закрыть">${ico("close")}</button></div>
      <div class="bt-switches">
        ${PLAYER ? "" : `<button class="fx-btn" data-m="monhp">ОЗ монстров: ${S.opts.showMonHp ? "показаны" : "скрыты"}</button>`}
        <button class="fx-btn" data-m="autosave">Спасброски героев: ${S.opts.autoSaves ? "авто" : "вручную"}</button>
        <button class="fx-btn" data-m="autoend">Конец хода сам, когда кончились действия: ${S.opts.autoEnd ? "вкл" : "выкл"}</button>
        ${PLAYER ? "" : `<button class="fx-btn" data-m="auto">Авто-бой героев: ${S.opts.autoHeroes ? "вкл" : "выкл"}</button>
        <button class="fx-btn" data-m="gm">Мастер: завершить бой…</button>`}</div>
      <h5>Журнал боя</h5><div class="bt-log">${lines}</div></div>`);
    m.onclick = async e => {
      const b = e.target.closest("[data-m]"); if (!b && e.target !== m) return; const k = b && b.dataset.m;
      if (!k || k === "close") { hideModal(); return; }
      if (k === "monhp") S.opts.showMonHp = !S.opts.showMonHp; if (k === "autosave") S.opts.autoSaves = !S.opts.autoSaves; if (k === "autoend") S.opts.autoEnd = !S.opts.autoEnd;
      if (k === "monhp" || k === "autosave" || k === "autoend") { try { (state.settings ||= {}).battleOpts = { showMonHp: !!S.opts.showMonHp, autoSaves: !!S.opts.autoSaves, autoEnd: S.opts.autoEnd !== false }; saveChar(); } catch (e) {} }          // эти переключатели помнятся между боями
      if (k === "autoend" && S.opts.autoEnd && UI.turnUnit && UI.mode === "hero" && !UI.busy && !UI.pick && B.turnSpent(UI.turnUnit)) { hideModal(); endTurn(); return; }
      if (k === "auto") { S.opts.autoHeroes = !S.opts.autoHeroes; if (S.opts.autoHeroes && UI.endTurn) { hideModal(); endTurn(); return; } }
      if (k === "legacy") { hideModal(); if (await UI.confirm({ title: "Обычный экран боя", text: "Поле закроется: останутся порядок ходов и кнопки «Победа», «Бег», «Монстры убегают». Уже убитых монстров и потери ОЗ сохраним.", yes: "Перейти" })) { B.abort(); if (UI.endTurn) endTurn(); } return; }
      if (k === "gm") { hideModal(); const r = await UI.choose({ title: "Завершить бой как…", options: [{ id: "win", label: "Победа (монстры повержены)" }, { id: "flee", label: "Отряд отступил" }, { id: "retreat", label: "Монстры убежали" }] }); if (r) { S.outcome = r; if (r === "win") B.mons().forEach(mm => { if (mm.alive) { mm.alive = false; mm.hp = 0; S.killed.push(mm.idx); } }); endTurn(); } return; }
      UI.refreshNow(); UI.menu();
    };
  };

  /* ===== выбор целей и клеток ===== */
  function beginPick(p) { UI.pick = p; UI.renderPanel(); UI.refreshNow(); }
  function endPick() { UI.setTraj && UI.setTraj(null); UI.pick = null; UI.holdHandle = null; UI.setHl(new Map()); UI.pathPreview = null; UI.pathWays = null; UI.pathStart = null; UI.targetIds = null; UI.selIds = null; UI.drawPath(); UI.refreshNow(); }
  const unitAtCell = (x, y) => B.occupant(x, y);
  function paintRange(cells, kind) { const map = new Map(); for (const [x, y] of cells || []) UI.hlAdd(map, x, y, kind === "heal" || kind === "help" ? "hl-ally" : "hl-reach"); return map; }
  UI.pickUnit = function (spec) {
    return new Promise(resolve => {
      const ids = new Set(spec.units), map = paintRange(spec.cells, spec.kind);
      for (const id of ids) { const u = B.byId(id); if (u) B.footprint(u).forEach(([x, y]) => UI.hlAdd(map, x, y, spec.kind === "heal" || spec.kind === "help" ? "hl-target-ally" : "hl-target")); }
      const objKeys = new Set(spec.objs || []);
      for (const k of objKeys) UI.hlAdd(map, ...k.split(",").map(Number), "hl-target");
      UI.setHl(map); UI.targetIds = ids;
      if (spec.from) UI.setTraj([...ids].map(id => ({ a: spec.from, b: B.byId(id), faint: true })).filter(s => s.b));          // линии полёта к возможным целям
      const done = v => { endPick(); resolve(v); };
      UI.pickHandle = (x, y) => { const u = unitAtCell(x, y); if (u && ids.has(u.id)) done(u); else if (u) UI.toast("Эта цель недоступна"); else if (objKeys.has(x + "," + y)) done(B.objAt(x, y)); };
      beginPick({ type: "unit", prompt: spec.prompt, cancel: () => done(null) });
    });
  };
  UI.pickUnits = function (spec) {
    return new Promise(resolve => {
      const ids = new Set(spec.units), sel = new Set(), map = paintRange(spec.cells, spec.kind);
      for (const id of ids) { const u = B.byId(id); if (u) B.footprint(u).forEach(([x, y]) => UI.hlAdd(map, x, y, "hl-target")); }
      UI.setHl(map); UI.targetIds = ids; UI.selIds = sel;
      const p = { type: "units", prompt: `${spec.prompt} (выбрано: 0)`, confirmable: true, canOk: (spec.min || 0) <= 0, okLabel: "Готово", cancel: () => done(null), ok: () => done([...sel].map(B.byId)) };
      const done = v => { endPick(); resolve(v); };
      UI.pickHandle = (x, y) => {
        const u = unitAtCell(x, y); if (!u || !ids.has(u.id)) return;
        if (sel.has(u.id)) sel.delete(u.id); else if (sel.size < (spec.max || 9)) sel.add(u.id); else { UI.toast("Больше целей выбрать нельзя"); return; }
        p.prompt = `${spec.prompt} (выбрано: ${sel.size})`; p.canOk = sel.size >= (spec.min || 0); UI.renderPanel(); UI.refreshNow();
      };
      beginPick(p);
    });
  };
  UI.pickCell = function (spec) {
    return new Promise(resolve => {
      const valid = new Set(spec.cells.map(([x, y]) => x + "," + y)), map = new Map();
      for (const [x, y] of spec.cells) UI.hlAdd(map, x, y, spec.kind === "flee" ? "hl-flee" : spec.kind === "trap" ? "hl-ally" : "hl-move");
      UI.setHl(map);
      let sel = null;
      const done = v => { endPick(); resolve(v); };
      const nodeOf = (x, y) => spec.path && spec.path.get ? spec.path.get(x + "," + y) : null;
      const preview = (x, y) => { const n = nodeOf(x, y); if (!n) return; const path = []; for (let c = n; c && c.prev; c = c.prev) path.unshift([c.x, c.y]); UI.pathPreview = path; UI.drawPath(); };
      const withArea = spec.radius != null;                                                  // область действия: сначала показываем, кого заденет
      const p = { type: "cell", prompt: spec.prompt, cancel: () => done(null), extraBtns: spec.optional ? `<button class="fx-btn" data-ba="pick-skip">Без перемещения</button>` : "", confirmable: !!spec.path || withArea, canOk: false, okLabel: "Подтвердить", ok: () => { if (sel) done(sel); } };
      const paintArea = (x, y) => {
        const m2 = new Map(map); const hit = [];
        for (let yy = 0; yy < B.H; yy++) for (let xx = 0; xx < B.W; xx++) if (Math.max(Math.abs(xx - x), Math.abs(yy - y)) <= spec.radius) UI.hlAdd(m2, xx, yy, "hl-area");
        for (const o of B.live()) if (B.distCell(o, x, y) <= spec.radius) hit.push(`${o.name}${o.side === (spec.forSide || "hero") ? " (свой)" : ""}`);
        UI.setHl(m2); return hit;
      };
      UI.pickHandle = (x, y) => {
        if (!valid.has(x + "," + y)) return;
        if (withArea) {
          if (sel && sel[0] === x && sel[1] === y) { done(sel); return; }
          sel = [x, y]; p.canOk = true; const hit = paintArea(x, y); p.prompt = `${spec.prompt}. Заденет: ${hit.join(", ") || "никого"}. Нажмите ещё раз или «Подтвердить».`; UI.renderPanel(); return;
        }
        if (!spec.path) { done([x, y]); return; }
        if (sel && sel[0] === x && sel[1] === y) { done(sel); return; }
        sel = [x, y]; p.canOk = true; preview(x, y); UI.renderPanel();
      };
      UI.skipPick = () => done({ skip: true });
      beginPick(p);
    }).then(v => (v && v.skip ? {} : v));
  };
  // Перемещение. Нажатие выбирает клетку (второе нажатие или «Идти» — идти), долгое нажатие ставит путевую точку: герой обязательно пройдёт
  // через неё (чтобы обойти ловушки и костёр). Точек может быть несколько, повторное долгое нажатие снимает точку. Путь — ломаная по точкам.
  UI.pickMove = function (spec) {
    return new Promise(resolve => {
      const u = spec.unit, budget = Math.max(0, spec.budget), key = (x, y) => x + "," + y;
      const foes = B.enemiesOf(u).filter(e => B.canAct(e) && e.t.react && !u.t.disengage);
      const scared = has(u, "frightened"), avoid = (x, y) => scared && B.frightenOK && !B.frightenOK(u, x, y);
      const provokes = (path, start) => { let prev = start || [u.x, u.y]; const who = new Set(); for (const [x, y] of path) { for (const e of foes) { const r = B.meleeReach(e); if (B.distAt(e, u, prev[0], prev[1]) <= r && B.distAt(e, u, x, y) > r) who.add(e.name); } prev = [x, y]; } return [...who]; };
      const trapsOn = path => path.filter(([x, y]) => B.S.objs.some(o => o.kind === "trap" && o.x === x && o.y === y && (!o.hidden || o.owner === "hero")) || (B.tinfo(x, y) || {}).hazard).length;
      const nodePath = (m, x, y) => { const out = []; for (let c = m.get(key(x, y)); c && c.prev; c = c.prev) out.unshift([c.x, c.y]); return out; };
      const mapFrom = (pos, left) => B.pathMap({ ...u, x: pos[0], y: pos[1] }, Math.max(0, left), { avoid });
      let ways = [], legs = [], pos = [u.x, u.y], left = budget, reach = mapFrom(pos, left), sel = null;
      const flat = () => legs.flat();
      // пересчёт после изменения точек: идём по ним по порядку, лишние (недостижимые) отбрасываем
      const recalc = () => {
        const old = ways; ways = []; legs = []; pos = [u.x, u.y]; left = budget;
        for (const w of old) {
          const m = mapFrom(pos, left), n = m.get(key(w[0], w[1]));
          if (!n || (w[0] === pos[0] && w[1] === pos[1])) { UI.toast("Точка стала недостижима и снята"); break; }
          ways.push(w); legs.push(nodePath(m, w[0], w[1])); left -= n.cost; pos = w;
        }
        reach = mapFrom(pos, left);
        if (sel && !(reach.get(key(sel.x, sel.y)) && B.canStand(u, sel.x, sel.y))) sel = null;
      };
      const paint = () => {
        const hl = new Map(), base = flat();
        for (const [k, n] of reach) {
          if ((n.x === pos[0] && n.y === pos[1]) || !B.canStand(u, n.x, n.y)) continue;
          const bad = foes.some(e => B.distAt(e, u, n.x, n.y) <= B.meleeReach(e));          // оранжевым — клетки в зоне досягаемости врагов, которые могут ударить по возможности (при выходе из неё); путь с выходом из зоны — в подсказке
          UI.hlAdd(hl, n.x, n.y, bad ? "hl-danger" : "hl-move");
        }
        UI.setHl(hl); UI.pathWays = ways.slice(); UI.pathStart = ways.length ? [u.x, u.y] : null;
        const full = sel ? [...base, ...nodePath(reach, sel.x, sel.y)] : base; UI.pathPreview = full.length ? full : null; UI.drawPath();
      };
      const note = () => {
        if (!sel) return `Перемещение: осталось ${left} кл.${spec.standCost ? ` (встать: −${spec.standCost})` : ""} Нажмите клетку.${ways.length ? ` Точек: ${ways.length}.` : " Зажмите клетку — герой пройдёт через неё."}`;
        const full = [...flat(), ...nodePath(reach, sel.x, sel.y)], who = provokes(full), tr = trapsOn(full), cost = budget - left + reach.get(key(sel.x, sel.y)).cost;
        return `Идти на ${cost} кл.${who.length ? ` ⚠ атака по возможности: ${who.join(", ")}.` : ""}${tr ? ` ⚠ на пути ловушка или огонь (${tr}).` : ""} Нажмите ещё раз или «Идти».${ways.length ? "" : " Зажмите клетку — пройдёт через неё."}`;
      };
      const extra = () => `${spec.standCost ? `<button class="fx-btn" data-ba="pick-stand">Только встать</button>` : ""}${ways.length ? `<button class="fx-btn" data-ba="pick-clear">Снять точки</button>` : ""}`;
      const done = v => { endPick(); resolve(v); };
      const p = { type: "move", prompt: "", cancel: () => done(null), confirmable: true, canOk: false, okLabel: "Идти", ok: () => { if (sel) go(); }, extraBtns: "" };
      const refresh = () => { paint(); p.prompt = note(); p.canOk = !!sel; p.extraBtns = extra(); UI.renderPanel(); };
      const go = () => { const path = [...flat(), ...nodePath(reach, sel.x, sel.y)]; done({ x: sel.x, y: sel.y, path }); };
      UI.skipPick = () => done({ stay: true });
      UI.clearWays = () => { ways = []; recalc(); refresh(); };
      UI.pickHandle = (x, y) => {
        const n = reach.get(key(x, y));
        if (!n || (x === pos[0] && y === pos[1]) || !B.canStand(u, x, y)) { if (ways.some(w => w[0] === x && w[1] === y)) UI.toast("Это путевая точка — зажмите её, чтобы снять"); return; }
        if (sel && sel.x === x && sel.y === y) { go(); return; }
        sel = { x, y }; refresh();
      };
      // долгое нажатие: поставить точку (через неё можно проходить, даже если там союзник) или снять
      UI.holdHandle = (x, y) => {
        const at = ways.findIndex(w => w[0] === x && w[1] === y);
        if (at >= 0) { ways.splice(at, 1); recalc(); refresh(); UI.toast("Путевая точка снята"); return; }
        const n = reach.get(key(x, y));
        if (!n || (x === pos[0] && y === pos[1])) { UI.toast("Через эту клетку не пройти (далеко или занято)"); return; }
        ways.push([x, y]); recalc(); refresh(); UI.toast(`Путевая точка ${ways.length}: герой обязательно пройдёт здесь`);
      };
      beginPick(p); refresh();
    });
  };
  UI.pickFor = async function (u, spec, A) {
    spec = spec || { type: "self" };
    const eb = ESSENCES[A && A.__id] || null;
    if (spec.type === "self") { return (await UI.confirm({ title: "Применить способность?", text: A && A.name ? A.name : "", yes: "Применить" })) ? {} : null; }
    if (spec.type === "unit") { if (!spec.units.length) { UI.toast("Нет подходящих целей"); return null; } const t = await UI.pickUnit(spec); return t ? { unit: t } : null; }
    if (spec.type === "units") { if (!spec.units.length) { UI.toast("Нет подходящих целей"); return null; } const l = await UI.pickUnits(spec); return l ? { units: l } : null; }
    if (spec.type === "cell") { if (!spec.cells.length) { UI.toast("Некуда применить"); return null; } const c = await UI.pickCell({ ...spec, path: spec.path && spec.kind === "move" ? spec.path : null }); if (c === null) return null; return Array.isArray(c) ? { cell: c } : {}; }
    if (spec.type === "area") {
      const map = new Map(); for (const [x, y] of spec.cells || []) UI.hlAdd(map, x, y, "hl-area");
      for (const id of spec.units) { const t = B.byId(id); if (t) B.footprint(t).forEach(([x, y]) => UI.hlAdd(map, x, y, t.side === u.side ? "hl-target-ally" : "hl-target")); }
      UI.setHl(map); UI.targetIds = new Set(spec.units);
      const ok = await new Promise(resolve => { beginPick({ type: "area", prompt: `${spec.prompt}. Заденет: ${spec.units.map(id => B.byId(id).name).join(", ") || "никого"}.`, confirmable: true, canOk: true, okLabel: "Применить", cancel: () => resolve(false), ok: () => resolve(true) }); UI.pickHandle = () => {}; });
      endPick(); return ok ? {} : null;
    }
    if (spec.type === "cube") {
      const anchors = new Set(spec.anchors.map(([x, y]) => x + "," + y)); let sel = null;
      const cubeMap = (ax, ay) => { const map = new Map(); for (const [x, y] of spec.anchors) UI.hlAdd(map, x, y, "hl-reach"); if (ax != null) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) UI.hlAdd(map, ax + dx, ay + dy, "hl-area"); return map; };
      UI.setHl(cubeMap());
      const res = await new Promise(resolve => {
        const okLabel = spec.okLabel || "Применить", p = { type: "cube", prompt: spec.prompt, confirmable: true, canOk: false, okLabel, cancel: () => resolve(null), ok: () => { if (sel) resolve(sel); } };
        UI.pickHandle = (x, y) => { let ax = Math.min(x, B.W - 2), ay = Math.min(y, B.H - 2); if (!anchors.has(ax + "," + ay)) return; if (sel && sel[0] === ax && sel[1] === ay) { resolve(sel); return; } sel = [ax, ay]; UI.setHl(cubeMap(ax, ay)); p.canOk = true; const hit = B.live().filter(o => B.footprint(o).some(([fx, fy]) => fx >= ax && fx < ax + 2 && fy >= ay && fy < ay + 2)); p.prompt = `Заденет: ${hit.map(o => o.name).join(", ") || "никого"}. Нажмите ещё раз или «${okLabel}».`; UI.renderPanel(); };
        beginPick(p);
      });
      endPick(); return res ? { cell: res } : null;
    }
    return {};
  };

  /* ===== касания поля ===== */
  UI.onCell = function (x, y, e) {
    const S = B.S; if (!S) return;
    if (UI.mode === "place") {
      const occ = B.occupant(x, y);
      if (UI.placeOnly) { const h1 = B.byId(UI.placeOnly); if (h1 && y >= B.H - 3 && !B.obstacleAt(x, y) && (!occ || occ === h1)) { h1.x = x; h1.y = y; UI.paintPlace(); UI.refreshNow(); } else UI.toast("Ставьте героя в три нижних ряда на свободную клетку"); return; }
      if (occ && occ.side === "hero") { UI.placeSel = occ.id; UI.paintPlace(); UI.renderPanel(); return; }
      const h = B.byId(UI.placeSel);
      if (h && y >= B.H - 3 && !B.obstacleAt(x, y) && !occ) { h.x = x; h.y = y; const hs = B.heroes().filter(z => !z.dead), i = hs.indexOf(h); UI.placeSel = hs[(i + 1) % hs.length].id; UI.paintPlace(); UI.refreshNow(); UI.renderPanel(); }
      else UI.toast("Ставьте героев в три нижних ряда на свободные клетки");
      return;
    }
    if (UI.pick && UI.pickHandle) { UI.pickHandle(x, y); return; }
    const u = B.occupant(x, y);
    if (u) { UI.inspect(u); return; }
    const t = B.tinfo(x, y); if (t) UI.toast(`${t.name}: ${t.note}`);
  };
  UI.onBtn = function (name, btn) {
    if (name === "menu") UI.menu();
    else if (name === "inspect") { const u = B.byId(btn.dataset.id); if (u) UI.inspect(u); }
  };
  // Кнопка «Назад» телефона: отменить текущий шаг, иначе — меню боя.
  UI.onBack = function () {
    if (UI.mode === "result") return;
    const x = document.querySelector(".bd-ov:not(.out) .bd-x:not([hidden])"); if (x) { x.click(); return; }
    if (document.querySelector(".bd-ov:not(.out)")) return;                              // бросок уже идёт — отменять поздно
    const m = q(".bt-modal"); if (m && !m.hidden) { const no = m.querySelector('[data-m="no"], [data-m="__no"], [data-m="close"]'); if (no) no.click(); return; }
    if (UI.pick) { UI.pick.cancel(); return; }
    if (UI.cat) { UI.cat = null; UI.renderPanel(); return; }
    UI.menu();
  };
  // Клики по панели и окнам (корень слушает только поле — эти элементы обрабатываем отдельно).
  document.addEventListener("click", e => {
    if (!UI.active) return;
    const panel = e.target.closest(".bt-panel"); if (panel) {
      const el = e.target.closest("[data-ba]");
      if (el && el.dataset.ba === "pick-skip") { UI.skipPick && UI.skipPick(); return; }
      if (el && el.dataset.ba === "pick-stand") { UI.skipPick && UI.skipPick(); return; }
      if (el && el.dataset.ba === "pick-clear") { UI.clearWays && UI.clearWays(); return; }
      panelClick(e);
    }
  });
})();
