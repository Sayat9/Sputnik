const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  const rep = await p.evaluate(async () => {
    const issues = [], wait = ms => new Promise(r => setTimeout(r, ms));
    const bad = tag => { const h = document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, ""); const m = h.match(/.{50}(NaN|undefined|\[object Object\]).{50}/); if (m) issues.push(tag + ": " + m[0]); };
    // отряд
    state.party = ["barbarian", "fairy", "dwarf"].map((race, i) => { const c = Object.assign(clone(state.example), { id: "u" + i, example: false, name: "Г" + i, race }); delete c.bag; delete c.kit; ensureKit(c); addToBag(c, { t: "g", id: "shovel", qty: 1 }); addToBag(c, { t: "g", id: "stone-9", qty: 5 }); addToBag(c, { t: "w", id: "sword", qty: 1 }); return c; });
    state.current = "u0"; saveChar();
    const keys = ["", "town", ...Object.keys(SECTIONS), ...Object.keys(TABS)];
    for (const k of keys) { location.hash = k; await wait(40); bad("страница #" + k); }
    // бестиарий: открыть всех, все фильтры
    location.hash = Object.keys(TABS).find(k => /mon/.test(k)) || "monsters"; await wait(40);
    for (const f of ["all", "1", "2"]) { mf.floor = f; rerender(); await wait(20); document.querySelectorAll("details.mon").forEach(d => d.open = true); bad("бестиарий этаж " + f); }
    mf.floor = "all"; rerender();
    // меню героя: все предметы и кнопки
    location.hash = "town"; await wait(40);
    for (const c of state.party) {
      openHero(c.id);
      for (const tab of ["stats", "inv"]) { heroUi.tab = tab; renderHero(); bad(`герой ${c.name} ${tab}`); }
      heroUi.tab = "inv";
      for (let i = 0; i < (c.bag || []).length; i++) {
        heroUi.sel = i; renderHero(); bad(`предмет ${c.bag[i]?.id}`);
        const btns = [...document.querySelectorAll(".sel-panel [data-hx]")].map(x => x.dataset.hx).filter(x => !["drop", "give", "give-toggle"].includes(x));
        if (btns.length && Math.random() < .5) { const el = document.querySelector(`.sel-panel [data-hx="${btns[0]}"]`); el && el.click(); await wait(10); }
      }
      document.querySelectorAll('[data-hx="luck"]')[0]?.click();
      closeHero();
    }
    // библиотека
    journal(); unlockJournal(9); journal().hints = { "goblin": ["type"], "wolf": ["type", "portrait"] }; journal().known.fox = { revealed: ["area", "spawn"], added: "" };
    openLibrary(); bad("библиотека"); libUi.card = "fox"; renderLibrary(); bad("карточка лисы");
    libUi.card = null; libUi.adding = true; libUi.q = "гоб"; renderLibrary(); bad("поиск");
    // сохранения
    document.querySelector('[data-save="open"]')?.click(); await wait(30); bad("сохранения");
    return issues;
  });
  console.log(rep, [...new Set(errs)]);
  await b.close();
})();
