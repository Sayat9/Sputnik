// Кристальный рудник прошлого (14.11): портал в Кристальном разломе, вступление алхимика, лагерь, лавочник, точки, камертоны, резонанс, сердце, жадность, алхимик.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); }); p.on('response', x => { if (x.status() === 404) errs.push('404 ' + x.url().replace(/.*8765/, '')); });
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false, master: true } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const o = {}; const clr = () => { dgUi.enc = null; dgUi.res = null; dgUi.rroll = null; }, wait = ms => new Promise(r => setTimeout(r, ms));
    const mk = (id, n) => { const c = Object.assign(clone(state.example), { id, name: n, example: false, level: 5, rank: 7 }); ensureKit(c); addToBag(c, { t: 'g', id: 'ration', qty: 9 }); c.gold = 100; return c; };
    state.party = [mk('p0', 'Аргон'), mk('p1', 'Борис')]; newRun(); const run = state.run;
    run.floor = 2; run.variant = 'stone'; run.day = 10; run.act = 1; run.pos = { x: 5, y: 5 }; riftSync(); o.portals = run.riftsF2 && Object.values(run.riftsF2.tiles).every(t => t.id === 'crystal'); const tiles = Object.keys(run.riftsF2.tiles); clr();
    const [tx, ty] = tiles[0].split(',').map(Number); run.pos = { x: tx, y: ty }; riftEnter(); const R = run.rift; location.hash = 'labyrinth';
    await wait(400); let n = 0, last = ''; for (let i = 0; i < 5; i++) { const d = document.getElementById('vn-dlg'); if (!d) break; n++; last = d.innerText; d.click(); await wait(250); } clr();
    o.intro = n === 3 && /разобраться/.test(last);
    rerender(); o.noExit = !document.querySelector('[data-rift="exit"]');
    o.layout = R.map['7,12'] === 'tent' && R.map['5,13'] === 'shop' && R.map['7,3'] === 'heart' && R.pts.length === 3 && R.pts.filter(p => p.boss === 'foreman-gorn').length === 1 && R.pts[2].boss === 'singing-crystal';
    const win = () => { const e = dgUi.enc; e.outcome = 'win'; finishFight(e, e.list.map((id, i) => i)); };
    // лагерь до резонанса: тихо, разговор, покупка, отдых без нападений
    let campF = 0; for (let i = 0; i < 50; i++) { R.cleared = {}; R.visited = []; R.pos = { x: 7, y: 14 }; riftMove(7, 13); if (dgUi.enc) campF++; clr(); } o.campQuiet = campF === 0;
    R.pos = { x: 7, y: 12 }; rerender(); o.talkBtn = !!document.querySelector('[data-rift="cr-talk"]'); const talks = []; for (let i = 0; i < 4; i++) { crTalk(); await wait(100); const d = document.getElementById('vn-dlg'); talks.push(d ? d.innerText : ''); if (d) d.click(); await wait(150); }
    o.talks = /дыра/.test(talks[0]) && /Ногу/.test(talks[1]) && /эффективность/.test(talks[2]) && /дыра/.test(talks[3]);
    R.pos = { x: 5, y: 13 }; rerender(); o.shopBtns = document.querySelectorAll('[data-rift="cr-buy"]').length === 3; const g0 = partyGold(); crBuy('potion'); o.bought = partyGold() === g0 - 2;
    let restF = 0; for (let i = 0; i < 40; i++) { riftRest(); if (dgUi.enc) restF++; clr(); } o.campRestSafe = restF === 0;
    // точки: бой, после победы — «Вставить камертон»
    for (let i = 0; i < 3; i++) { const P = R.pts[i]; R.pos = { x: P.x + (P.x < 14 ? 1 : -1), y: P.y }; riftMove(P.x, P.y); const ids = dgUi.enc ? dgUi.enc.list.slice() : []; o['pt' + i] = !!dgUi.enc && (!P.boss || ids[0] === P.boss); win(); clr(); rerender();
      o['tuneBtn' + i] = !!document.querySelector('[data-rift="cr-tune"]'); crTune(); if (i < 2) clr(); }
    o.res = R.res && dgUi.res && /Резонанс/.test(dgUi.res.title) && dgUi.shakeUntil > Date.now(); rerender(); o.shake = !!document.querySelector('#rf-svg.rf-quake'); clr();
    // сердце: до резонанса стена — проверим уже открыто → страж
    R.pos = { x: 7, y: 4 }; riftMove(7, 3); o.boss = dgUi.enc && dgUi.enc.list[0] === 'primal-crystal' && dgUi.enc.crBoss && dgUi.enc.big10; const bossEnc = dgUi.enc; dgUi.enc = null;
    // лагерь после резонанса: жадность, алхимик, бои в лагере
    R.pos = { x: 5, y: 14 }; R.visited = []; R.cleared = {}; riftMove(5, 13); o.greed = dgUi.enc && dgUi.enc.list[0] === 'crystal-greed'; dgUi.enc.greedGold = 7; const gb = partyGold(); win(); o.greedPay = partyGold() === gb + 24 && R.greedDead; clr();
    R.pos = { x: 7, y: 13 }; riftMove(7, 12); o.alch = dgUi.enc && dgUi.enc.list[0] === 'crystal-alchemist' && dgUi.enc.dialog && dgUi.enc.dialog.start === 'alch-start'; win(); o.heart = state.party.some(c => c.bag.some(e => e && e.id === 'stone-heart')); clr();
    let cf = 0; for (let i = 0; i < 40; i++) { R.cleared = {}; R.pos = { x: 6, y: 14 }; riftMove(6, 13); if (dgUi.enc) cf++; clr(); } o.campFights = cf > 0;
    // каменное сердце: +2 Тел навсегда
    const c = state.party.find(c => c.bag.some(e => e && e.id === 'stone-heart')), con0 = c.base.con; o.bookCfg = BOOKS['stone-heart'].stat === 'con';
    // страж → сундук, выход
    dgUi.enc = bossEnc; win(); saveChar(); rerender(); o.autoChest = !!dgUi.res && dgUi.res.anim === 'chest' && R.bossDead;
    o.fork = !!GEAR['resonance-fork'] && !!ARTIFACTS['resonance-fork'];
    o.pony = (() => { const h = state.party[0], before = load(h).cap; h.essences = [...(h.essences || []), 'mine-pony']; const v = load(h).cap - before; h.essences.pop(); return v >= 17; })();
    return o;
  });
  console.log(JSON.stringify(r, null, 1)); const bad = Object.entries(r).filter(([k, v]) => v === false); console.log(bad.length ? 'FAIL ' + bad.map(x => x[0]).join(',') : 'ALL OK', errs.length ? 'ERRS ' + errs.slice(0, 5).join(' | ') : '');
  await b.close();
})();
