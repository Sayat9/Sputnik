// 12.11: обход экранов и окон на узком телефоне (360×740): ничего не выходит за края, кнопки не накладываются, текст в кнопках не обрезан,
// страница не шире экрана; что не помещается — прокручивается внутри своего окна.
const L = require('./bui_lib.js'), F = require('./bui_flow.js');
const SHOTS = process.env.SHOTS || '/tmp/battle-shots';
(async () => {
  const { b, p } = await L.launch(+process.env.W || 360, +process.env.H || 740); const errs = []; p.on('pageerror', e => errs.push(e.message));
  let n = 0, bad = 0; const fails = [];
  await L.setup(p, { heroes: ['barb2', 'archer', 'fairy'], autoEnd: false });
  await p.evaluate(() => {
    window.__audit = () => {
      const out = [], vw = innerWidth, vh = innerHeight, de = document.documentElement;
      if (de.scrollWidth > vw + 1) out.push('страница шире экрана: ' + de.scrollWidth + ' > ' + vw);
      const scrollAnc = el => { let a = el.parentElement; while (a && a !== document.body) { const cs = getComputedStyle(a); if ((/(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1) || (/(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1)) return a; a = a.parentElement; } return null; };
      const vis = el => { if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      // верхний слой: если открыто окно, проверяем его; иначе всю страницу
      const tops = [...document.querySelectorAll('#battle, .bd-ov, #setov, #menuov, #heroov, #libov, #saveov, #townov, .mapov, .scrim, #forge, #gameov, #iteminfo, .bt-modal')].filter(vis);
      const root = tops.length ? tops[tops.length - 1] : document.body;
      const els = [...root.querySelectorAll('button, .chip, a.fx-btn, select, input')].filter(vis);
      const label = el => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''} «${(el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28)}»`;
      // видимая часть элемента: обрезается всеми предками с прокруткой или overflow: hidden
      const clip = el => { const r0 = el.getBoundingClientRect(); let l = r0.left, t = r0.top, rr = r0.right, bb = r0.bottom; let a = el.parentElement; while (a && a !== document.documentElement) { const cs = getComputedStyle(a); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const q = a.getBoundingClientRect(); l = Math.max(l, q.left); t = Math.max(t, q.top); rr = Math.min(rr, q.right); bb = Math.min(bb, q.bottom); } a = a.parentElement; } return { left: l, top: t, right: rr, bottom: bb, width: rr - l, height: bb - t }; };
      const rects = [];
      for (const el of els) {
        const r = el.getBoundingClientRect(), sa = scrollAnc(el);
        if (!sa && (r.right > vw + 1.5 || r.left < -1.5)) out.push(`за краем по ширине: ${label(el)} ${Math.round(r.left)}…${Math.round(r.right)}`);
        if (!sa && getComputedStyle(el).position !== 'fixed' && root !== document.body && (r.bottom > vh + 1.5 || r.top < -1.5)) out.push(`за краем по высоте (окно не прокручивается): ${label(el)} ${Math.round(r.top)}…${Math.round(r.bottom)}`);
        if (sa) { const s = sa.getBoundingClientRect(); if (s.right > vw + 1.5 || s.left < -1.5) out.push(`прокручиваемый блок шире экрана: ${sa.className}`); }
        const cs = getComputedStyle(el);
        if (el.tagName === 'BUTTON' && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 2 && !el.querySelector('img, svg')) out.push(`текст обрезан: ${label(el)}`);
        if (el.tagName === 'BUTTON' && cs.overflow !== 'hidden') { for (const ch of el.children) { const c = ch.getBoundingClientRect(); if (c.width > 2 && (c.right > r.right + 3 || c.left < r.left - 3)) { out.push(`текст вылез из кнопки: ${label(el)}`); break; } } }
        const cr = clip(el); if (cr.width > 4 && cr.height > 4 && cr.bottom > 0 && cr.top < vh && !el.closest('[hidden]')) rects.push({ el, r: cr });
      }
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const A = rects[i], Bb = rects[j]; if (A.el.contains(Bb.el) || Bb.el.contains(A.el)) continue;
        const w = Math.min(A.r.right, Bb.r.right) - Math.max(A.r.left, Bb.r.left), h = Math.min(A.r.bottom, Bb.r.bottom) - Math.max(A.r.top, Bb.r.top);
        if (w > 6 && h > 6) { const pa = getComputedStyle(A.el).position, pb = getComputedStyle(Bb.el).position; const fixedPair = [pa, pb].some(x => x === 'fixed' || x === 'absolute' || x === 'sticky') || [A.el, Bb.el].some(e => e.closest('nav.tabs, #dice-fab, .compass-btn, .gear-btn, .bt-x, .tw-x, .dd'));
          const top = document.elementFromPoint(Math.max(A.r.left, Bb.r.left) + w / 2, Math.max(A.r.top, Bb.r.top) + h / 2); const hid = top && !A.el.contains(top) && !Bb.el.contains(top);          // оба под другим слоем — не считается
          if (!fixedPair && !hid) out.push(`накладываются: ${label(A.el)} и ${label(Bb.el)}`); }
      }
      // надписи: текст одного элемента не должен наезжать на текст другого (значки-счётчики на плитках не в счёт)
      const texts = [];
      for (const el of root.querySelectorAll('h1, h2, h3, h4, b, small, span, p, time, label, dt, dd, li, div')) {
        if (!vis(el) || el.closest('button, .chip, svg, .bt-board, .stage, .bd-ov, nav.tabs, [hidden]')) continue;
        const own = [...el.childNodes].filter(nd => nd.nodeType === 3 && nd.textContent.trim().length > 1); if (!own.length) continue;
        const rg = document.createRange(); rg.selectNodeContents(own[0]); const tr = rg.getBoundingClientRect(); if (tr.width < 8 || tr.height < 6) continue;
        const cr = clip(el), l = Math.max(tr.left, cr.left), t = Math.max(tr.top, cr.top), rr = Math.min(tr.right, cr.right), bb = Math.min(tr.bottom, cr.bottom); if (rr - l < 8 || bb - t < 6 || bb < 0 || t > vh) continue;
        texts.push({ el, r: { left: l, top: t, right: rr, bottom: bb }, s: own[0].textContent.trim().slice(0, 24) });
      }
      for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
        const A = texts[i], Bb = texts[j]; if (A.el.contains(Bb.el) || Bb.el.contains(A.el)) continue;
        const w = Math.min(A.r.right, Bb.r.right) - Math.max(A.r.left, Bb.r.left), h = Math.min(A.r.bottom, Bb.r.bottom) - Math.max(A.r.top, Bb.r.top);
        if (w > 5 && h > 5) { const top = document.elementFromPoint(Math.max(A.r.left, Bb.r.left) + w / 2, Math.max(A.r.top, Bb.r.top) + h / 2); if (top && (A.el.contains(top) || Bb.el.contains(top) || top.contains(A.el) || top.contains(Bb.el))) out.push(`надписи наезжают: «${A.s}» и «${Bb.s}»`); }
      }
      return [...new Set(out)].slice(0, 10);
    };
  });
  const check = async (name, shot) => { await L.sleep(180); const r = await p.evaluate(() => window.__audit()); n++; if (r.length) { bad++; fails.push(name); } console.log(`  ${r.length ? '✗' : '✓'} ${name}${r.length ? '\n      ' + r.join('\n      ') : ''}`); if (shot || r.length) await p.screenshot({ path: `${SHOTS}/lay-${name.replace(/[^a-zа-я0-9]+/gi, '_')}.png` }); };
  const ev = (fn, a) => p.evaluate(fn, a);
  // --- главная, меню, настройки, сохранения
  await ev(() => { location.hash = ''; }); await check('главная', true);
  await p.click('#tab-menu'); await check('меню', true);
  await p.click('#menuov .gear-btn'); await check('настройки', true); await ev(() => { document.getElementById('setov').hidden = true; });
  await ev(() => { document.querySelector('[data-save="open"]') ? document.querySelector('.fx-home [data-save="open"]').click() : 0; }); await check('сохранения'); await ev(() => { const s = document.getElementById('saveov'); if (s) s.hidden = true; });
  // --- справочник и бестиарий с подгруппами
  await ev(() => { location.hash = 'ref'; }); await check('справочник');
  await ev(() => { settings().master = true; location.hash = 'bestiary'; }); await L.sleep(300); await check('бестиарий');
  await ev(() => { const c = [...document.querySelectorAll('.chip')].find(x => x.dataset.f === 'kind' && x.dataset.v === 'beast'); c && c.click(); }); await check('бестиарий: звери и подгруппы', true);
  await ev(() => { location.hash = 'weapons'; }); await check('оружие (справочник)');
  // --- создание героя: оружие
  await ev(() => { openForge('race', 'more'); }); await L.sleep(300); await check('создание: раса');
  await ev(() => { const r = document.querySelector('[data-fx-race]'); r && r.click(); const g = document.querySelector('[data-fx-gender]'); g && g.click(); }); await L.sleep(150);
  await ev(() => { const nx = document.querySelector('[data-fx="next-race"]') || [...document.querySelectorAll('#forge .fx-btn.primary')].pop(); nx && nx.click(); }); await L.sleep(300); await check('создание: оружие', true);
  for (const w of ['wand', 'flail', 'staff', 'morningstar']) { await ev(w => { const c = document.querySelector(`[data-fx-weapon="${w}"]`); c && c.click(); }, w); await check('создание: выбрано ' + w, w === 'wand'); await ev(w => { const c = document.querySelector(`[data-fx-weapon="${w}"]`); c && c.click(); c && document.querySelector(`[data-fx-weapon="${w}"]`).click(); }, w); }
  await ev(() => { closeForge(); });
  // --- город и здания
  await ev(() => { state.townUnlocked = true; state.party.forEach(c => { c.rank = 7; c.gold = 5000; addToBag(c, { t: 'g', id: 'arrow', qty: 7 }); }); addToBag(state.party[0], { t: 'g', id: 'throw-dagger', qty: 4 }); addToBag(state.party[1], { t: 'g', id: 'arrow-steel', qty: 9 }); state.run = null; location.hash = 'town'; rerender(); }); await L.sleep(400); await check('город', true);
  for (const id of ['tower', 'guild', 'church', 'library', 'board', 'tavern', 'shop', 'forge', 'arena', 'academy', 'auction']) {
    await ev(id => openBuilding(id), id); await L.sleep(450); await check('здание: ' + id, ['forge', 'shop', 'auction'].includes(id));
    const tabs = await ev(() => [...document.querySelectorAll('#townov .tw-tabs [role="tab"], #townov .tw-tabs .fx-btn')].length);
    for (let i = 1; i < tabs; i++) { await ev(i => { const t = [...document.querySelectorAll('#townov .tw-tabs [role="tab"], #townov .tw-tabs .fx-btn')][i]; t && t.click(); }, i); await check(`здание: ${id}, вкладка ${i + 1}`, id === 'forge'); }
    if (id === 'shop' || id === 'forge') { await ev(() => { const bg = document.querySelector('#townov [data-t="bag"]'); bg && bg.click(); }); await check(`здание: ${id}, предмет рюкзака`); }
    await ev(() => { const x = document.querySelector('#townov [data-t="close"]'); x && x.click(); }); await L.sleep(200);
    await ev(() => { const y = document.querySelector('[data-yn="0"]'); y && y.click(); });
  }
  // --- окно героя
  await ev(() => { const c = state.party[1]; c.equip.main = { t: 'w', id: 'wand' }; openHero(c.id); }); await L.sleep(300); await check('герой: данные', true);
  await ev(() => { heroUi.tab = 'inv'; renderHero(); }); await check('герой: инвентарь');
  await ev(() => { const i = state.party[1].bag.findIndex(e => e.id === 'arrow-steel'); heroUi.sel = i; renderHero(); }); await check('герой: стрелы выбраны', true);
  await ev(() => { heroUi.sel = null; heroUi.slot = 'main'; renderHero(); }); await check('герой: слот оружия');
  await ev(() => { heroUi.slot = null; heroUi.tab = 'skills'; renderHero(); }); await check('герой: навыки');
  await ev(() => { closeHero(); });
  // --- лабиринт
  await ev(() => { newRun(); state.run.status = {}; state.party.forEach(c => { state.run.status[c.id] = { fat: 0, sat: 3, starve: 0, awake: 0 }; }); location.hash = 'labyrinth'; rerender(); }); await L.sleep(500);
  await ev(() => { const a = document.querySelector('[data-yn="1"]'); a && a.click(); const go = [...document.querySelectorAll('.fx-btn')].find(x => /В путь/.test(x.textContent)); go && go.click(); }); await L.sleep(300); await check('лабиринт', true);
  await ev(() => { dgUi.gm = true; rerender(); }); await check('лабиринт: меню мастера'); await ev(() => { dgUi.gm = false; rerender(); });
  await ev(() => { const r = document.querySelector('[data-dg="rest"]'); r && r.click(); }); await check('лабиринт: отдых'); await ev(() => { dgUi.phase = null; rerender(); });
  // --- бой: панели действий у героев с новым оружием
  await ev(() => { const [a, c, d] = state.party; a.equip = { main: { t: 'w', id: 'flail' }, off: { t: 'w', id: 'dagger' } }; c.equip = { main: { t: 'w', id: 'staff' } }; d.equip = { main: { t: 'w', id: 'morningstar', art: 'dawn-star' }, off: { t: 'w', id: 'shield' } }; addToBag(a, { t: 'g', id: 'throw-dagger-steel', qty: 6 }); });
  await L.startFightPage(p, { list: ['goblin', 'goblin-archer', 'dire-wolf'], zone: 'goblin' }); await L.waitMode(p, 'place'); await check('бой: расстановка', true); await p.click('[data-ba="place-go"]'); await F.waitHero(p); await check('бой: ход героя', true);
  for (let h = 0; h < 3; h++) {
    for (const cat of ['attack', 'skill', 'move', 'defend', 'more', 'item', 'flee']) {
      const okc = await ev(cat => { const d = document.querySelector(`[data-ba="dock"][data-id="${cat}"]`); if (!d) return false; d.click(); return true; }, cat); if (!okc) continue;
      await L.sleep(150); const mode = await ev(() => Battle.UI.mode);
      await check(`бой: герой ${h + 1}, раздел ${cat}`, cat === 'attack');
      await ev(() => { const c = document.querySelector('[data-ba="pick-cancel"]'); if (c) c.click(); const y = document.querySelector('[data-yn="0"]'); y && y.click(); const m = document.querySelector('.bt-modal [data-m="close"], .bt-modal .bt-x'); m && m.click(); }); await L.sleep(120);
      await ev(cat => { const d = document.querySelector(`[data-ba="dock"][data-id="${cat}"]`); if (d && Battle.UI.cat === cat) d.click(); }, cat);
    }
    await ev(() => { const B = Battle; const u = B.byId(B.S.order[B.S.turn]); if (u && u.side === 'hero') { B.UI.endTurn && B.UI.endTurn(); } }); await L.sleep(600);
    for (let i = 0; i < 80; i++) { const st = await ev(() => { const B = Battle; const u = B.byId(B.S.order[B.S.turn]); return { hero: !!(u && u.side === 'hero' && B.UI.mode === 'idle'), end: !!B.S.outcome }; }); if (st.hero || st.end) break; await F.handleModal(p, 'yes'); await L.sleep(250); }
  }
  // меню боя и окно бойца
  await ev(() => { const m = document.querySelector('.bt-menu-btn, [data-bt="menu"]'); m && m.click(); }); await check('бой: меню'); await ev(() => { const x = document.querySelector('.bt-modal [data-m="close"]') || document.querySelector('.bt-modal .bt-x'); x && x.click(); });
  await ev(() => { const B = Battle; B.UI.inspect && B.UI.inspect(B.heroes()[0]); }); await check('бой: окно героя', true); await ev(() => { const x = document.querySelector('.bt-modal [data-m="close"]') || document.querySelector('.bt-modal .bt-x'); x && x.click(); });
  await ev(() => { const B = Battle; B.UI.inspect && B.UI.inspect(B.mons()[0]); }); await check('бой: окно врага'); await ev(() => { const x = document.querySelector('.bt-modal [data-m="close"]') || document.querySelector('.bt-modal .bt-x'); x && x.click(); });
  console.log(errs.length ? 'ОШИБКИ СТРАНИЦЫ:\n' + [...new Set(errs)].join('\n') : 'ошибок страницы нет');
  console.log(`blayout ${process.env.W || 360}×${process.env.H || 740}: экранов ${n}, с замечаниями ${bad}${bad ? ' — ' + fails.join('; ') : ''}`);
  await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
