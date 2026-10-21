/* Тактический бой: итог, награды, анимация броска на эссенцию (две d10, один раз за бой), возврат результата приложению. */
(function () {
  const B = window.Battle, D = B.D;
  const End = (B.End = {});
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sleep = ms => (B.cfg.fast ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));
  const ESS_CHANCE = 95;                                              // бросок d100: 95+ (6 %), rules.md → «Эссенции»

  // Приводит героев и вещи в порядок после боя: оружие, стрелы, ОЗ, свет.
  function cleanup(S, outcome) {
    for (const t of S.thrown) { const c = state.party.find(x => x.id === t.hero); if (c && !c.equip[t.slot]) c.equip[t.slot] = t.item; else if (c) addToBag(c, { t: "w", id: t.item.id, qty: 1 }); }
    for (const [cid, used] of Object.entries(S.usedArrows)) { const c = state.party.find(x => x.id === cid), back = Math.floor(used / 2); if (c && back > 0) addToBag(c, { t: "g", id: "arrow", qty: back }); }
    for (const u of B.heroes()) {
      const c = u.hero; if (!c) continue;
      c.hp = u.dead ? 0 : Math.max(outcome === "defeat" || u.down ? 1 : 0, Math.min(u.hp, maxHp(c)));
      if (u.down && !u.dead) c.hp = Math.max(1, c.hp);
      c.mp = Math.max(0, Math.min(u.mp, maxMp(c))); c.insp = u.insp || 0; c.dead = !!u.dead;
      if (c.dead) c.hp = 0;
    }
    if (S.torchLit && state.run && !state.run.light) { state.run.light = true; state.run.torchLeft = 4; }
  }

  function rewardsPlan(S, outcome) {
    const ev = S.ev, killed = S.killed.slice(), species = killed.map(i => ev.list[i]);
    const fresh = [...new Set(species)].filter(id => !(journal().known[id] && journal().known[id].xpDone));
    const xp = fresh.reduce((a, id) => a + monXp(MONSTERS.find(m => m.id === id)), 0);
    const stones = {}; for (const id of species) { const m = MONSTERS.find(x => x.id === id), key = "stone-" + Math.min(9, Math.max(1, m.cls)); stones[key] = (stones[key] || 0) + 1; }
    // броски на эссенцию считаем заранее; анимация показывает лучший результат
    const rolls = species.map(id => ({ id, r: 1 + B.rnd(100) }));
    const wins = rolls.filter(x => x.r >= ESS_CHANCE);
    const best = rolls.length ? rolls.reduce((a, b) => (a.r >= b.r ? a : b)) : null;
    return { killed, species, fresh, xp, stones, rolls, wins, best };
  }
  const digits = r => { const v = r % 100; return [Math.floor(v / 10), v % 10]; };

  End.cleanup = cleanup;
  End.run = async function (S) {
    const ev = S.ev, UI = B.UI;
    let outcome = S.outcome || "flee";
    const display = outcome;                                           // win | retreat | flee | defeat
    const mapped = outcome === "defeat" ? "flee" : outcome;
    cleanup(S, outcome);
    const plan = rewardsPlan(S, outcome);
    const gotLines = [];
    for (const [key, n] of Object.entries(plan.stones)) { if (GEAR[key]) gotLines.push(giveParty({ t: "g", id: key, qty: n })); }
    for (const w of plan.wins) essStash().push(w.id);
    if (plan.wins.length) saveChar();
    if (UI && UI.active) await showScreens(S, display, plan, gotLines);
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
        <div class="bt-hlist">${B.heroes().map(h => `<span class="bt-hchip${h.dead ? " dead" : ""}"><img src="${h.face}" alt="">${esc(h.name)} <b>${h.dead ? "погиб" : Math.max(h.down ? 1 : 0, h.hp) + "/" + h.maxHp}</b></span>`).join("")}</div></div>
      ${nothing ? "" : `<div class="bt-roll" hidden><p>Бросок на эссенцию <small>— нужно ${ESS_CHANCE}+ из 100</small></p><canvas></canvas><div class="bt-roll-res"></div></div>`}
      <div class="bt-essgot" hidden></div>
      <button class="fx-btn primary big bt-done" hidden>Готово</button></div>`;
    const done = modal.querySelector(".bt-done"), finish = new Promise(res => { done.onclick = res; });
    if (!nothing && plan.best) {
      await sleep(900);
      const roll = modal.querySelector(".bt-roll"), cv = roll.querySelector("canvas"), resEl = roll.querySelector(".bt-roll-res"); roll.hidden = false;
      await sleep(120);
      const ok = plan.wins.length > 0, show = ok ? plan.wins.reduce((a, b) => (a.r >= b.r ? a : b)).r : plan.best.r, dg = digits(show);
      if (B.cfg.fast) { /* без анимации */ }
      else await B.Dice.spinReveal(cv, dg, { stops: [1500, 2700], glow: ok, glowColor: "#ffe27a" });
      resEl.innerHTML = ok ? `<b class="ok">${String(show).padStart(2, "0") === "00" ? 100 : show}</b> — выпала эссенция!` : `<b>${show}</b> — эссенция не выпала`;
      resEl.className = "bt-roll-res " + (ok ? "ok" : "no");
      if (ok) {
        const g = modal.querySelector(".bt-essgot"); g.hidden = false;
        g.innerHTML = plan.wins.map(w => { const e = ESSENCES[w.id]; return `<div class="bt-ess"><img src="${ART.monsterFace(w.id)}" alt=""><div><b>${esc(e ? e.name : w.id)}</b><small>${e ? e.cls + " класс · " + esc(e.passive.name) + " (П), " + esc(e.active.name) + " (А)" : ""}</small></div></div>`; }).join("") + `<p class="muted">Эссенция лежит в запасе отряда: герой впитывает её в меню героя → «Навыки».</p>`;
      }
    }
    done.hidden = false;
    await finish;
    modal.hidden = true; modal.innerHTML = "";
  }
})();
