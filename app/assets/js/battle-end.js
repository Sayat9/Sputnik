/* Тактический бой: итог, награды, анимация броска на эссенцию (две d10, один раз за бой), возврат результата приложению. */
(function () {
  const B = window.Battle, D = B.D;
  const End = (B.End = {});
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sleep = ms => (B.cfg.fast ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));
  const ESS_CHANCE = 93;                                              // бросок d100: 93+ (8 %); rules.md говорит 95+ — отклонение записано в drafts.md

  // Приводит героев и вещи в порядок после боя: оружие, стрелы, ОЗ, свет.
  // Брошенное оружие и целые стрелы подбираются, только если отряд остался хозяином поля (победа или монстры бежали).
  // Отступил или проиграл — они остались на поле (S.gear — строки для экрана итога). Переход на обычный экран ("abort") ничего не отнимает.
  function cleanup(S, outcome) {
    const keeps = outcome === "win" || outcome === "retreat" || outcome === "abort";
    S.gear = [];
    if (B.artRelease) B.artRelease(S);          // застрявшие и воткнутые копья падают на землю: дальше они ведут себя как обычное брошенное оружие
    for (const u of B.heroes()) {
      const c = u.hero; if (!c) continue;
      for (const w of S.drops.filter(d => d.kind === "weapon" && d.hero === c.id)) {          // оружие из руки и из рюкзака («Полная перевязь»), в том числе схваченное вором
        const nm = ((typeof itemOf === "function" && itemOf(w.item)) || {}).name || "оружие";
        if (keeps) S.gear.push({ ok: true, t: `${c.name} подбирает ${nm.toLowerCase()}` });
        else {
          if (w.slot === "bag") { const i = (c.bag || []).indexOf(w.item); if (i >= 0) c.bag.splice(i, 1); } else delete c.equip[w.slot];
          S.gear.push({ ok: false, t: `${nm} (${c.name}) осталось на поле` });
        }
      }
      u.disarmed = false; u.disarmedOff = false; u.bagThrown = [];
      const lg = S.arrowLog[c.id], lying = S.drops.filter(d => d.kind === "arrow" && d.hero === c.id).length;
      if (lg && lg.shot) {
        const back = keeps && lying ? lying - addToBag(c, { t: "g", id: "arrow", qty: lying }) : 0;
        const brk = lg.broken ? `, сломано ${lg.broken}` : "";
        S.gear.push(keeps ? { ok: back >= lying, t: `${c.name}: выпущено стрел ${lg.shot}, подобрано ${back}${brk}${back < lying ? `, не влезло в рюкзак ${lying - back}` : ""}` }
          : { ok: false, t: `${c.name}: выпущено стрел ${lg.shot}, ${lying ? `${lying} осталось на поле` : "все сломаны"}${brk}` });
      }
    }
    S.drops.length = 0;
    for (const u of B.heroes()) {
      const c = u.hero; if (!c) continue;
      c.hp = u.dead ? 0 : Math.max(outcome === "defeat" || u.down ? 1 : 0, Math.min(u.hp, maxHp(c)));
      if (u.down && !u.dead) c.hp = Math.max(1, c.hp);
      c.mp = Math.max(0, Math.min(u.mp, maxMp(c))); c.insp = u.insp ?? inspMax(c); c.dead = !!u.dead;
      if (c.dead) c.hp = 0;
      if (S.ev && S.ev.arena) { c.dead = false; c.hp = Math.max(1, c.hp); }          // на арене не умирают: упавших поднимают администраторы с 1 ОЗ
    }
  }

  function rewardsPlan(S, outcome) {
    const ev = S.ev, killed = S.killed.slice(), species = killed.map(i => ev.list[i]);
    const fresh = [...new Set(species.map(xpKeyOf))].filter(id => !(journal().known[id] && journal().known[id].xpDone));          // путники: опыт по классу (trav-9/8/7), а не за каждого
    const xp = fresh.reduce((a, id) => a + monXp(xpInfo(id)), 0);
    const stones = {};                                                                  // камни по видам монстров: id → { cls, n }, они идут в сумку для камней
    if (!ev.arena) for (const id of species) {
      const m = MONSTERS.find(x => x.id === id);
      (stones[m.dyn ? "~" + m.cls : id] ||= { cls: Math.min(9, Math.max(1, m.cls)), n: 0 }).n++;          // камни путников — просто «Находки» своего класса
    }
    // броски на эссенцию считаем заранее; анимация показывает лучший результат
    // «Удача новичка»: +5 к броску, если носитель сам добил монстра вида, которого он ещё не убивал (раз на вид; первое такое убийство в этом бою)
    const firstIn = {}, kills = [];
    const rolls = killed.map((idx, i) => {
      const id = species[i], hid = S.killedBy && S.killedBy[idx], c = hid && state.party.find(x => x.id === hid), key = hid + "|" + id;
      let bonus = 0;
      if (c && !((MONSTERS.find(m => m.id === id) || {}).dyn)) { if (c.equip && c.equip.charm && c.equip.charm.id === "beginners-luck" && !((c.kills || {})[id]) && !firstIn[key]) bonus = 5; firstIn[key] = true; kills.push({ hid, id }); }
      const base = 1 + B.rnd(100); return { id, r: Math.min(100, base + bonus), base, bonus };
    });
    const wins = S.forceWins ? S.forceWins.map(id => ({ id, r: 99 })) : rolls.filter(x => x.r >= ESS_CHANCE && !((MONSTERS.find(m => m.id === x.id) || {}).dyn));          // forceWins — только для проверок
    // Путник, убитый в бою, отдаёт все свои эссенции (допущение): они идут тем же экраном выбора «впитать / сохранить / оставить»
    if (!S.forceWins) for (const id of species) { const m = MONSTERS.find(x => x.id === id); if (m && m.dyn) for (const e of m.essences || []) wins.push({ id: e, r: 99, trav: true }); }
    const best = S.forceWins ? wins[0] : rolls.length ? rolls.reduce((a, b) => (a.r >= b.r ? a : b)) : null;
    return { killed, species, fresh, xp, stones, rolls, wins, best, kills };
  }
  const digits = r => { const v = r % 100; return [Math.floor(v / 10), v % 10]; };

  // Арена: лута нет (камни и находки забирают администраторы), платят по 3 монеты за убитого 9 класса (тройная цена камня); выпавшую эссенцию администрация забирает себе, героям — 20 % её цены монетами.
  function arenaRewards(S, plan) {
    const killed = plan.species.length, pay = plan.species.reduce((a, id) => a + 3 * (STONE_PRICE_BY_CLS[Math.min(9, Math.max(7, (MONSTERS.find(m => m.id === id) || {}).cls || 9))] || 1), 0);
    const essBonus = plan.wins.reduce((a, w) => a + Math.round(essPrice(w.id) * 0.2), 0), total = pay + essBonus;
    const live = state.party.filter(c => !c.dead), k = live.length || 1;
    live.forEach((c, i) => addGold(c, Math.floor(total / k) + (i < total % k ? 1 : 0)));
    const lines = [];
    if (killed) lines.push(`Арена платит: ${pay} монет за убитых (${killed}), лут забрали администраторы`);
    if (essBonus) lines.push(`Выпавшую эссенцию забрала администрация, героям — 20 % её цены: ${essBonus} монет`);
    return { pay, essBonus, total, killed, lines };
  }
  const STONE_PRICE_BY_CLS = { 9: 1, 8: 5, 7: 20 };
  End.cleanup = cleanup; End.plan = rewardsPlan;          // plan — для проверок
  End.run = async function (S) {
    const ev = S.ev, UI = B.UI;
    let outcome = S.outcome || "flee";
    const display = outcome;                                           // win | retreat | flee | defeat
    const mapped = outcome === "defeat" ? "flee" : outcome;
    state.fightSnap = null;
    cleanup(S, outcome);
    const plan = rewardsPlan(S, outcome);
    for (const k of plan.kills) { const c = state.party.find(x => x.id === k.hid); if (c) { c.kills ||= {}; c.kills[k.id] = (c.kills[k.id] || 0) + 1; } }          // список убийств героя
    const gotLines = [];
    for (const [id, it] of Object.entries(plan.stones)) { sackAdd(id, it.cls, it.n); gotLines.push(`Сумка для камней: ${MONSTERS.find(m => m.id === id).name} × ${it.n} (${it.cls} класс)`); }
    if (ev.arena) { plan.arena = arenaRewards(S, plan); gotLines.push(...plan.arena.lines); plan.wins = plan.wins.map(w => ({ ...w, arena: true })); }          // арена: лута нет, платят монетами
    if (B.deliverFound && !ev.arena) gotLines.push(...B.deliverFound(S, outcome === "win" || outcome === "retreat" || outcome === "abort"));
    if (!(UI && UI.active)) { for (const w of plan.wins) if (!w.arena) essStash().push(w.id); if (plan.wins.length) saveChar(); }          // без экрана итога — в запас; с экраном игрок выбирает: впитать, сохранить, оставить
    if (UI && UI.active) await showScreens(S, display, plan, gotLines);
    if (B.Net && B.Net.endClose) B.Net.endClose();
    const res = { outcome: mapped, killed: S.killed.slice(), plan };
    if (UI && UI.active) UI.close();
    B.running = false; B.S = null; ev.battleStarted = false;
    battleDone(ev, res);
  };

  const TITLE = { win: ["Победа!", "win"], retreat: ["Монстры бежали", "win"], flee: ["Отряд отступил", "flee"], defeat: ["Поражение", "lose"] };
  async function showScreens(S, outcome, plan, gotLines) {
    const UI = B.UI, root = UI.root(), modal = root.querySelector(".bt-modal");
    UI.mode = "result"; UI.setHl(new Map()); UI.refreshNow();
    const [title, cls] = TITLE[outcome] || TITLE.flee;
    const fallen = B.heroes().filter(h => h.dead).map(h => h.name), downed = B.heroes().filter(h => h.down && !h.dead).map(h => h.name);
    const xpLine = plan.xp ? `<li class="xp"><b>Опыт: +${plan.xp}</b> каждому герою <small>(новые виды: ${plan.fresh.map(id => esc(MONSTERS.find(m => m.id === id).name)).join(", ")})</small></li>` : (plan.species.length ? `<li class="muted">Опыт: эти виды уже убиты раньше</li>` : "");
    const stoneLines = gotLines.map(t => `<li class="stone">${esc(t)}</li>`).join("");
    const nothing = !plan.species.length;
    modal.hidden = false;
    modal.innerHTML = `<div class="bt-endscr fx-frame ${cls}">
      <small class="bt-eyebrow">Бой окончен · раундов: ${S.round}</small>
      <h2 class="bt-title ${cls}">${title}</h2>
      ${fallen.length ? `<p class="bt-bad">Погибли: ${esc(fallen.join(", "))}</p>` : ""}${downed.length && outcome !== "win" ? `<p class="bt-bad">Без сознания, остаётся 1 ОЗ: ${esc(downed.join(", "))}</p>` : ""}
      <div class="bt-rwd"><h5>Награды</h5>${nothing ? `<p class="muted">Никто не убит — награды нет.</p>` : `<ul>${xpLine}${stoneLines}</ul>`}
        ${S.gear && S.gear.length ? `<h5>Снаряжение</h5><ul class="bt-gearl">${S.gear.map(g => `<li class="${g.ok ? "ok" : "lost"}">${esc(g.t)}</li>`).join("")}</ul>` : ""}
        <div class="bt-hlist">${B.heroes().map(h => `<span class="bt-hchip${h.dead ? " dead" : ""}"><img src="${h.face}" alt="">${esc(h.name)} <b>${h.dead ? "погиб" : Math.max(h.down ? 1 : 0, h.hp) + "/" + h.maxHp}</b></span>`).join("")}</div></div>
      ${nothing ? "" : `<div class="bt-roll" hidden><p>Бросок на эссенцию <small>— нужно ${ESS_CHANCE}+ из 100</small></p><canvas></canvas><div class="bt-roll-res"></div><button class="bt-rolls-btn" type="button" aria-expanded="false" aria-label="Показать все броски на эссенцию" hidden><span>все броски</span><i aria-hidden="true">▾</i></button><div class="bt-rolls" hidden></div></div>`}
      <div class="bt-essgot" hidden></div>
      <button class="fx-btn primary big bt-done" hidden>Готово</button></div>`;
    if (B.Net && B.Net.announceEnd) { const essLine = plan.wins.length ? "Выпала эссенция!" : (plan.species.length ? "Эссенция не выпала" : ""); B.Net.announceEnd(`<div class="bt-endscr fx-frame ${cls}"><small class="bt-eyebrow">Бой окончен · раундов: ${S.round}</small><h2 class="bt-title ${cls}">${title}</h2>${fallen.length ? `<p class="bt-bad">Погибли: ${esc(fallen.join(", "))}</p>` : ""}<div class="bt-rwd"><h5>Награды</h5>${nothing ? `<p class="muted">Никто не убит — награды нет.</p>` : `<ul>${xpLine}${stoneLines}</ul>`}${essLine ? `<p><b>${essLine}</b></p>` : ""}<div class="bt-hlist">${B.heroes().map(h => `<span class="bt-hchip${h.dead ? " dead" : ""}"><img src="${h.face}" alt="">${esc(h.name)} <b>${h.dead ? "погиб" : Math.max(h.down ? 1 : 0, h.hp) + "/" + h.maxHp}</b></span>`).join("")}</div></div></div>`); }
    const done = modal.querySelector(".bt-done"), finish = new Promise(res => { done.onclick = res; });
    if (!nothing && plan.best) {
      await sleep(900);
      const roll = modal.querySelector(".bt-roll"), cv = roll.querySelector("canvas"), resEl = roll.querySelector(".bt-roll-res"); roll.hidden = false;
      await sleep(120);
      let ok = plan.wins.length > 0, rollShown = ok ? plan.wins.reduce((a, b) => (a.r >= b.r ? a : b)) : plan.best, show = rollShown.r;
      const reveal = async () => {
        if (!B.cfg.fast) await B.Dice.spinReveal(cv, digits(show), { stops: [1500, 2700], glow: ok, glowColor: "#ffe27a" });
        const luckNote = rollShown && rollShown.bonus ? ` <small>(выпало ${rollShown.base}, Удача новичка +${rollShown.bonus})</small>` : "";
        resEl.innerHTML = ok && rollShown.trav ? `<b class="ok">✦</b> — путник нёс с собой эссенцию!` : ok ? `<b class="ok">${String(show).padStart(2, "0") === "00" ? 100 : show}</b> — выпала эссенция!${luckNote}` : `<b>${show}</b> — эссенция не выпала${luckNote}`;
        resEl.className = "bt-roll-res " + (ok ? "ok" : "no");
      };
      // Список всех бросков: анимация показывает один (лучший), а кидается по одному броску на каждого убитого монстра.
      const rbtn = roll.querySelector(".bt-rolls-btn"), rlist = roll.querySelector(".bt-rolls");
      const drawRolls = () => {
        const seen = {}, names = plan.species.map(id => { const m = MONSTERS.find(x => x.id === id); seen[id] = (seen[id] || 0) + 1; const tot = plan.species.filter(x => x === id).length; return `${m ? m.name : id}${tot > 1 ? " " + seen[id] : ""}`; });
        rlist.innerHTML = plan.rolls.map((r, i) => `<div class="bt-rollrow${r.r >= ESS_CHANCE ? " win" : ""}${r === rollShown ? " shown" : ""}"><span class="n">${esc(names[i])}</span><span class="v"><b>${r.r}</b>${r.bonus ? ` <small>(${r.base} +${r.bonus})</small>` : ""}${r.again && r.again.length ? ` <small>«Ещё раз»: было ${r.again.join(", ")}</small>` : ""}</span><span class="m">${r.r >= ESS_CHANCE ? "эссенция" : "нет"}</span></div>`).join("") + `<p class="bt-rollnote">Нужно ${ESS_CHANCE}+ из 100. Анимация показывает лучший бросок.</p>`;
      };
      if (plan.rolls.length) {
        rbtn.hidden = false; drawRolls();
        rbtn.onclick = () => { const open = rlist.hidden; rlist.hidden = !open; rbtn.setAttribute("aria-expanded", String(open)); rbtn.querySelector("i").textContent = open ? "▴" : "▾"; };
      }
      await reveal();
      // «Ещё раз»: одноразовый предмет, перебрасывает неудачный бросок (на арене эссенция не достаётся, смысла нет)
      const onceMore = () => state.party.reduce((a, c) => a + countGear(c, "once-more"), 0);
      while (!ok && !S.ev.arena && onceMore() > 0) {
        const btn = document.createElement("button"); btn.className = "fx-btn primary"; btn.textContent = `«Ещё раз» — перебросить · осталось ${onceMore()}`; roll.appendChild(btn); done.hidden = false;
        const choice = await Promise.race([new Promise(res => { btn.onclick = () => res("again"); }), finish.then(() => "done")]);
        btn.remove(); if (choice === "done") break;
        const holder = state.party.find(c => countGear(c, "once-more") > 0); takeGear(holder, "once-more", 1); saveChar();
        const bonus = rollShown.bonus || 0, base = 1 + B.rnd(100), r = Math.min(100, base + bonus);
        (rollShown.again ||= []).push(rollShown.r); rollShown.r = r; rollShown.base = base; show = r;
        if (r >= ESS_CHANCE) { plan.wins.push({ id: rollShown.id, r, base, bonus }); ok = true; }
        await reveal(); if (!rbtn.hidden) drawRolls();
      }
      if (ok && S.ev.arena) {
        const g = modal.querySelector(".bt-essgot"); g.hidden = false;
        g.innerHTML = `<div class="bt-ess"><div><b>Эссенцию забрала администрация арены</b><small>Героям — 20 % её цены: ${plan.arena ? plan.arena.essBonus : 0} монет</small></div></div>`;
      } else if (ok) {
        const g = modal.querySelector(".bt-essgot"); g.hidden = false;
        g.innerHTML = plan.wins.map((w, i) => { const e = ESSENCES[w.id]; const pas = essSeen(w.id, "ess-passive"), act = essActiveLevel(w.id) > 0; return `<div class="bt-ess" data-i="${i}"><img src="${essFace(w.id)}" alt=""><div><b>${esc(e ? essTitle(w.id) : w.id)}</b><small>${e ? e.cls + " класс · " + (pas ? esc(e.passive.name) : "??") + " (П), " + (act ? esc(e.active.name) : "??") + " (А)" : ""}</small>
          <div class="bt-esschoice"><button class="fx-btn primary" data-ec="absorb">Впитать</button><button class="fx-btn" data-ec="keep" disabled title="Скоро">Сохранить</button><button class="fx-btn" data-ec="leave">Оставить</button></div><div class="bt-esspick" hidden></div></div></div>`; }).join("");
        await new Promise(resolve => {
          let left = plan.wins.length;
          const decide = (box, text) => { box.querySelector(".bt-esschoice").hidden = true; const pk = box.querySelector(".bt-esspick"); pk.hidden = false; pk.innerHTML = `<small class="muted">${esc(text)}</small>`; if (--left <= 0) resolve(); };
          g.onclick = ev => {
            const btn = ev.target.closest("[data-ec],[data-eh]"); if (!btn || btn.disabled) return;
            const box = btn.closest(".bt-ess"), w = plan.wins[+box.dataset.i], e = ESSENCES[w.id];
            if (btn.dataset.eh) { const c = state.party.find(x => x.id === btn.dataset.eh); if (!c) return; (c.essences ||= []).push(w.id); markEssNamed(w.id); c.mp = Math.min(maxMp(c), mpOf(c)); saveChar(); decide(box, `${c.name} впитал эссенцию.`); return; }
            if (btn.dataset.ec === "leave") { decide(box, "Эссенцию оставили."); return; }
            if (btn.dataset.ec === "absorb") {
              const pk = box.querySelector(".bt-esspick"); box.querySelector(".bt-esschoice").hidden = true; pk.hidden = false;
              pk.innerHTML = `<small>Кому впитать?</small><div class="bt-esschoice">${state.party.filter(c => !c.dead).map(c => { const has = (c.essences || []).includes(w.id), full = (c.essences || []).length >= c.level; return `<button class="fx-btn" data-eh="${c.id}"${has || full ? " disabled" : ""} title="${has ? "уже есть такая эссенция" : full ? "нет свободного слота" : ""}">${esc(c.name)}${has ? " (есть)" : full ? " (слотов нет)" : ""}</button>`; }).join("")}<button class="fx-btn" data-eb="1">Назад</button></div>`;
              pk.querySelector("[data-eb]").onclick = e2 => { e2.stopPropagation(); pk.hidden = true; box.querySelector(".bt-esschoice").hidden = false; };
            }
          };
        });
      }
    }
    done.hidden = false;
    await finish;
    modal.hidden = true; modal.innerHTML = "";
  }
})();
