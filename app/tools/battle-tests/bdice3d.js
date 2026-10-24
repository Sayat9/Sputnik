// Объёмные кубики: многогранники строятся (число граней, противоположные грани в сумме N+1), выпавшая грань ложится числом вверх; кадры для просмотра.
const { chromium } = require('playwright');
const FILES = ['battle-data','battle-core','battle-rules','battle-dice'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 500 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [], settings: { tactical: false } })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(500);
  for (const f of FILES) await p.addScriptTag({ path: `/home/user/app/assets/js/${f}.js` });
  const R = [], ok = (n, c, x) => { R.push({ n, ok: !!c }); if (!c) console.log('  ✗', n, '—', x == null ? '' : x); };
  const info = await p.evaluate(async () => {
    const D = Battle.Dice, out = {};
    for (const s of [4, 6, 8, 10, 12, 20, 100]) {
      const P = (() => { try { return D._poly(s); } catch (e) { return null; } })();
      out[s] = P && { N: P.N, labels: P.lab.length, uniq: new Set(P.clean).size };
    }
    // рисуем 4 кадра d20 при разных поворотах + результат
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 140; cv.style.cssText = 'position:fixed;left:0;top:0;background:#254a2c;z-index:99999'; document.body.appendChild(cv);
    const c = cv.getContext('2d'); const q0 = D.randQ();
    const spins = [D.qMul(D.qAxis([1, 0.4, 0.2], 0.0), q0), D.qMul(D.qAxis([1, 0.4, 0.2], 1.1), q0), D.qMul(D.qAxis([0.2, 1, 0.3], 2.2), q0), D.faceUp(20, 17)];
    spins.forEach((q, i) => D.drawDie(c, 20, 55 + i * 96, 70, 36, { q, pal: 'ivory', glow: i === 3 ? '#ffe27a' : null }));
    window.__frame = true; return out;
  });
  for (const s of [4, 6, 8, 10, 12, 20, 100]) ok(`d${s}: построен многогранник и подписи`, info[s] && info[s].N === (s === 100 ? 10 : s) && info[s].uniq === info[s].N, JSON.stringify(info[s]));
  await p.screenshot({ path: '/tmp/battle-shots/d20-frames.png', clip: { x: 0, y: 0, width: 400, height: 140 } });
  // sim-проверка: Arena.setDice → throwAll → дожидаемся остановки и сверяем, что у камеры смотрит выпавшая грань
  const fin = await p.evaluate(async () => {
    const D = Battle.Dice, cv = document.createElement('canvas'); cv.style.cssText = 'width:320px;height:180px;position:fixed;left:0;top:200px'; document.body.appendChild(cv);
    const A = new D.Arena(cv, {}); const res = []; let done = 0;
    for (const s of [20, 12, 10, 8, 6, 4, 100]) {
      A.setDice([{ s }]); A.enabled = true; A.throwAll(600, 100);
      await new Promise(r => { const t = setInterval(() => { if (A.allDone()) { clearInterval(t); r(); } }, 50); });
      const b = A.bodies[0]; const P = D._poly(s);
      // грань, смотрящая на зрителя
      let best = -2, bi = -1; P.faces.forEach((f, i) => { const n = D._qrot(b.q, f.n)[2]; if (n > best) { best = n; bi = i; } });
      res.push({ s, final: String(b.final), shown: P.clean[bi], tilt: +best.toFixed(3) });
    }
    return res;
  });
  for (const r of fin) ok(`d${r.s}: выпавшая грань (${r.final}) легла к зрителю`, r.final === r.shown && r.tilt > 0.99, JSON.stringify(r));
  console.log('errs:', errs.length ? errs.slice(0, 4) : 'нет'); ok('нет ошибок страницы', !errs.length, errs.join(' | '));
  console.log(`проверок: ${R.length}, не прошли: ${R.filter(x => !x.ok).length}`);
  await b.close(); process.exit(R.every(x => x.ok) ? 0 : 1);
})();
