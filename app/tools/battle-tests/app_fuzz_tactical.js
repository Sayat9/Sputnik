// Случайный игрок: много заходов подряд, после каждого шага — проверка инвариантов.
const { chromium } = require('playwright');
const RUNS = +process.argv[2] || 12, STEPS = +process.argv[3] || 400;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  const report = await p.evaluate(async ({ RUNS, STEPS }) => {
    state.settings = { tactical: true }; await loadBattle();
    const issues = [], stats = { steps: 0, fights: 0, explores: 0, digs: 0, rests: 0, camps: 0, runsEnded: 0, moves: 0, runMoves: 0, luck: 0, rollbacks: 0, saves: 0 };
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const clickSel = sel => { const els = [...document.querySelectorAll(sel)].filter(e => !e.disabled); if (!els.length) return false; pick(els).click(); return true; };
    const races = ["barbarian", "human", "dwarf", "beastkin", "fairy", "dragon"];
    const weaps = WEAPONS.filter(w => w.kind !== "Боеприпасы" && w.group !== "shield").map(w => w.id);
    const check = (tag) => {
      const r = state.run;
      const html = document.getElementById("app")?.innerHTML || document.body.innerHTML;
      if (/NaN|undefined|\[object Object\]/.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) { const m = html.match(/.{60}(NaN|undefined|\[object Object\]).{60}/); issues.push(`${tag}: в разметке ${m ? m[0] : "NaN/undefined"}`); }
      for (const c of state.party) {
        if (!(c.hp >= 0 && c.hp <= maxHp(c))) issues.push(`${tag}: ОЗ ${c.name} = ${c.hp}/${maxHp(c)}`);
        if ((c.bag || []).length > bagSize(c)) issues.push(`${tag}: рюкзак ${c.name} переполнен`);
        for (const e of c.bag || []) { if (!(e.qty >= 1)) issues.push(`${tag}: стопка ${e.id} qty=${e.qty}`); if (e.uses != null && !(e.uses >= 1)) issues.push(`${tag}: лопата uses=${e.uses}`); if (e.t === "g" && e.qty > GEAR[e.id].stack) issues.push(`${tag}: стопка ${e.id} больше максимума`); }
        if (r) { const st = r.status[c.id]; if (!st || st.fat < 0 || st.fat > 4 || st.sat < 0) issues.push(`${tag}: статус ${c.name} ${JSON.stringify(st)}`); }
      }
      if (r) {
        if (!(r.act >= 1 && r.act <= 3 && r.day >= 1 && r.day <= 7)) issues.push(`${tag}: время д${r.day} д${r.act}`);
        if (!inBounds(r.pos.x, r.pos.y)) issues.push(`${tag}: позиция вне карты ${JSON.stringify(r.pos)}`);
        if (r.pending && !document.querySelector('.ev-roll') && !dgUi.enc && !dgUi.res) issues.push(`${tag}: бросок ждёт, но окна нет (${r.pending.cause})`);
        if (r.torchLeft < 0) issues.push(`${tag}: факел ${r.torchLeft}`);
      }
    };
    const newParty = n => {
      state.party = []; state.journal = null; state.inventory = null;
      for (let i = 0; i < n; i++) {
        const c = Object.assign(clone(state.example), { id: "h" + i + "_" + Math.random().toString(36).slice(2, 6), example: false, name: "Герой" + i, race: pick(races), level: 1 + Math.floor(Math.random() * 3) });
        c.equip = { main: { t: "w", id: pick(weaps) } }; delete c.bag; delete c.kit; delete c.hp; ensureKit(c);
        if (Math.random() < .6) addToBag(c, { t: "g", id: pick(SHOVELS), qty: 1 });
        if (Math.random() < .5) addToBag(c, { t: "g", id: "torch", qty: 1 + Math.floor(Math.random() * 4) });
        if (Math.random() < .2) c.luck = Math.floor(Math.random() * 7) - 2;
        state.party.push(c);
      }
    };
    const playBattle = async () => {
      const t0 = Date.now(); Battle.cfg.fast = true;
      for (let i = 0; i < 4000 && dgUi.enc && Date.now() - t0 < 60000; i++) {
        const UI = Battle.UI, S = Battle.S;
        if (!UI.active) { await new Promise(r => setTimeout(r, 20)); if (!Battle.running) break; continue; }
        if (S) S.opts.autoHeroes = true;
        const md = document.querySelector('.bt-modal'); const yes = md && !md.hidden && md.querySelector('[data-m="yes"]'); if (yes) { yes.click(); await new Promise(r => setTimeout(r, 5)); continue; }
        const sum = [...document.querySelectorAll('.bt-modal .fx-btn.primary')].find(b => b.offsetParent && !b.classList.contains('bt-done') && /^Готово$/.test(b.textContent.trim())); if (sum) { sum.click(); await new Promise(r => setTimeout(r, 5)); continue; }
        const sheetBtn = document.querySelector('.bd-ov:not(.out) .bd-ok:not([hidden])'); if (sheetBtn) { sheetBtn.click(); await new Promise(r => setTimeout(r, 5)); continue; }
        const roll = document.querySelector('.bd-ov:not(.out) .bd-roll:not([disabled])'); if (roll && !document.querySelector('.bd-ov:not(.out) .bd-row').hidden) { roll.click(); await new Promise(r => setTimeout(r, 30)); continue; }
        if (UI.mode === 'place' || UI.mode === 'ambush') { UI.placeDone(); }
        else if (UI.mode === 'hero' && UI.endTurn) { UI.endTurn(); }
        else if (UI.mode === 'result') { const lv = document.querySelector('.bt-ess [data-ec="leave"]:not([disabled])'); if (lv && lv.offsetParent) lv.click(); const d = document.querySelector('.bt-done:not([hidden])'); if (d) d.click(); }          // эссенцию путника надо решить: «Оставить»
        await new Promise(r => setTimeout(r, 10));
      }
      if (dgUi.enc && Battle.running) { issues.push('бой завис (60 с)'); try { Battle.abort(); Battle.UI.endTurn && Battle.UI.endTurn(); } catch (e) {} await new Promise(r => setTimeout(r, 300)); }
      stats.fights++;
    };
    for (let run = 0; run < RUNS; run++) {
      newParty(1 + Math.floor(Math.random() * 4));
      newRun(); if (run % 3 === 2) { state.run.pos = { x: CENTER, y: CENTER }; state.party.forEach(c => addToBag(c, { t: "g", id: "shovel-best", qty: 1 })); } dgUi = freshUi(); location.hash = "labyrinth"; rerender();
      await new Promise(r => setTimeout(r, 30));
      for (let s = 0; s < STEPS && state.run; s++) {
        stats.steps++;
        const r = state.run;
        try {
          if (dgUi.enc) {
            const e = dgUi.enc;
            if (e.list && e.tactical) await playBattle();
            else if (!e.list) clickSel(e.trav ? '[data-dg="tv-act"],[data-dg="tv-fight"],[data-dg="tv-gift"],[data-dg="tv-rest"],[data-dg="enc-done"]' : '[data-dg="enc-done"]');
            else if (!e.outcome) { if (Math.random() < .3) clickSel('[data-dg="enc-next"]'); else clickSel('[data-dg="enc-out"]'); }
            else if (Math.random() < .3 && document.querySelector('[data-dg="enc-kill"]:not([disabled])')) clickSel('[data-dg="enc-kill"]');
            else { clickSel('[data-dg="enc-ok"]'); stats.fights++; }
          } else if (dgUi.res) clickSel('[data-dg="res-done"]');
          else if (r.pending) { if (r.pending.cause === "camp") stats.camps++; r.pending.pick = r.pending.pick || (1 + Math.floor(Math.random() * 20)); resolveRoll(); rerender(); }
          else if (dgUi.phase === "rest") { if (Math.random() < .3) clickSel('[data-guard]'); if (Math.random() < .3) clickSel('[data-eat]'); clickSel('[data-dg="rest-go"]'); stats.rests++; }
          else if (dgUi.phase === "explore" || dgUi.phase === "dig") {
            if (Math.random() < .15) { clickSel('.mapov [data-dg="cancel"]'); }
            else { clickSel('[data-dg="sr-n"]'); if (document.querySelector('[data-dg="sr-l"]')) { clickSel('[data-dg="sr-l"]'); stats.luck++; } clickSel('[data-dg="sr-ok"]'); dgUi.phase === "menu" && (stats[r.lastK = "x"] = 0); }
          } else if (dgUi.phase === "move" || dgUi.phase === "run") {
            const c = candidates().filter(t => inBounds(t.x, t.y));
            if (!c.length || Math.random() < .05) clickSel('[data-dg="cancel"]');
            else if (dgUi.phase === "move") { dgUi.target = pick(c); act("move"); stats.moves++; }
            else { dgUi.path.push(pick(c)); if (dgUi.path.length >= 2) { act("run"); stats.runMoves++; } else rerender(); }
          } else {
            const roll = Math.random();
            if (roll < .03) { clickSel('[data-dg="torch-on"],[data-dg="torch-off"]'); }
            else if (roll < .05) { saveChar(); state = loadState(); stats.saves++; }
            else {
              const a = run % 3 === 1 ? pick(["rest", "explore", "dig", "explore"]) : run % 3 === 2 ? pick(["dig", "dig", "explore"]) : pick(["move", "move", "move", "run", "rest", "explore", "explore", "dig", "dig"]);
              const btn = document.querySelector(`[data-act="${a}"]`);
              if (btn && !btn.disabled) { if (a === "explore") stats.explores++; if (a === "dig") stats.digs++; btn.click(); }
            }
          }
        } catch (e) { issues.push(`исключение: ${e.message}`); }
        check(`заход ${run + 1}, шаг ${s}`);
        if (issues.length > 40) break;
      }
      if (!state.run) stats.runsEnded++;
      else if (Math.random() < .5 && state.runSnap) { rollbackRun(); stats.rollbacks++; }
      else endRun(true);
    }
    return { issues: [...new Set(issues)].slice(0, 40), stats };
  }, { RUNS, STEPS });
  console.log(JSON.stringify(report, null, 1)); console.log("page errors:", [...new Set(errs)].slice(0, 20));
  await b.close();
})();
