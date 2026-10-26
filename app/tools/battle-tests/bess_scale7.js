// Правило автора (27.10): у эссенции 7 класса минимум два минуса и около 5 и больше плюсов (сумма положительных статов + положительные особенности).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [] })); });
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(400);
  const rows = await p.evaluate(() => {
    const NEG = /[−-]\d|Жадность|Серебро жжёт|Боится|Уязвимость|Тяжёлый|Холод (сковывает|жжёт)|Хрупкий|Нестабильность|Плохое зрение/;
    return Object.values(ESSENCES).filter(e => e.cls === 7).map(e => {
      let plus = 0, minus = 0;
      for (const v of Object.values(e.stats)) { if (v > 0) plus += v; else if (v < 0) minus++; }
      for (const o of e.other || []) { if (NEG.test(o)) minus++; else { const m = /\+(\d+)(,\d+)?( м)?/.exec(o); plus += m && !m[3] ? +m[1] : 1; } }
      return { id: e.id, plus, minus };
    });
  });
  let bad = 0; for (const r of rows) { const good = r.plus >= 5 && r.minus >= 2; if (!good) { bad++; console.log('  ✗', r.id, 'плюсов', r.plus, 'минусов', r.minus); } }
  console.log('эссенций 7 класса:', rows.length, 'не по правилу:', bad, errs.length ? errs : '');
  await b.close();
})();
