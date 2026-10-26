// Масштаб эссенций (автор, 27.10): 9 класс — ровно +3 и −1; 8 — минимум +4 и −2; 7 — минимум +5 и −2; 6 — +7 и −3 (сумма положительных статов и «+N» особенностей; минус — каждый отрицательный пункт).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [] })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(400);
  const rows = await p.evaluate(() => {
    const NEG = /[−-]\d|Жадность|Серебро жжёт|Боится|Уязвимость|Тяжёлый|Холод (сковывает|жжёт)|Хрупкий|Нестабильность|Плохое зрение/;
    return Object.values(ESSENCES).map(e => {
      let plus = 0, minus = 0;
      for (const v of Object.values(e.stats)) { if (v > 0) plus += v; else if (v < 0) minus++; }
      for (const o of e.other || []) { if (NEG.test(o)) minus++; else { const m = /\+(\d+)(,\d+)?( м)?/.exec(o); plus += m && !m[3] ? +m[1] : 1; } }
      return { id: e.id, cls: e.cls, plus, minus };
    });
  });
  const RULE = { 9: r => r.plus === 3 && r.minus === 1, 8: r => r.plus >= 4 && r.minus >= 2, 7: r => r.plus >= 5 && r.minus >= 2, 6: r => r.plus >= 7 && r.minus >= 3 };
  let bad = 0; for (const r of rows) { const good = RULE[r.cls] ? RULE[r.cls](r) : true; if (!good) { bad++; console.log('  ✗', r.cls, r.id, 'плюсов', r.plus, 'минусов', r.minus); } }
  console.log('эссенций:', rows.length, 'не по правилу:', bad, errs.length ? errs : '');
  await b.close();
})();
