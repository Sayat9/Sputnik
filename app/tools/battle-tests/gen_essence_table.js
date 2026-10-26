// Таблица статистик эссенций: все эссенции игры + предложенные (3 этаж) с проверкой масштаба. Запуск: node gen_essence_table.js → /home/user/campaign/essence_table.md
const { chromium } = require('playwright'); const fs = require('fs');
const NEG = /[−-]\d|Жадность|Серебро жжёт|Боится|Уязвимость|Тяжёлый|Холод (сковывает|жжёт)|Хрупкий|Нестабильность|Плохое зрение/;
const count = (stats, other) => { let plus = 0, minus = 0; for (const v of Object.values(stats)) { if (v > 0) plus += v; else if (v < 0) minus++; } for (const o of other || []) { if (NEG.test(o)) minus++; else { const m = /\+(\d+)(,\d+)?( м)?/.exec(o); plus += m && !m[3] ? +m[1] : 1; } } return { plus, minus }; };
const RULE = { 9: r => r.plus === 3 && r.minus === 1, 8: r => r.plus >= 4 && r.minus >= 2, 7: r => r.plus >= 5 && r.minus >= 2, 6: r => r.plus >= 7 && r.minus >= 3 };
const ST = { str: 'Сил', dex: 'Лов', con: 'Тел', int: 'Инт', wis: 'Муд', cha: 'Хар' };
const stat = s => Object.entries(s).map(([k, v]) => `${ST[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`).join(', ');
// Предложенные эссенции 3 этажа (ещё не в игре): [класс, название, тип, зона, статы, особенности]
const PROP = [
  [9, 'Костяной егерь', 'С (скрытный стрелок)', 'угодья', { dex: 1, wis: 1, str: -1 }, ['Скрытность +1']],
  [9, 'Шипастая гончая', 'С (быстрый ближний бой)', 'угодья', { dex: 1, str: 1, int: -1 }, ['Скорость +1,5 м']],
  [9, 'Сизый гриф', 'У (награда)', 'угодья', { wis: 1, str: -1 }, ['Восприятие +1', 'Выживание +1']],
  [8, 'Вожак гончих', 'С (поддержка)', 'угодья', { cha: 2, dex: -1 }, ['Восприятие +1', 'Запугивание +1', 'Скрытность −1']],
  [8, 'Каменный лось', 'С (танк, таран)', 'угодья', { con: 2, str: 1, dex: -1 }, ['КД +1', 'Скорость −1,5 м']],
  [8, 'Железная лиса', 'К (подвижность)', 'угодья', { dex: 2, con: -1, str: -1 }, ['Скрытность +1', 'Скорость +1,5 м']],
  [7, 'Рогатый страж лощин', 'К (таран)', 'угодья', { str: 2, con: 2, dex: -1 }, ['КД +1', 'Инициатива −1']],
  [7, 'Следопыт-охотник', 'У (маскировка на карте)', 'угодья', { dex: 2, wis: 2, con: -1, str: -1 }, ['Скрытность +1']],
  [6, 'Тихий хищник', 'С/К (тишина)', 'угодья', { dex: 2, str: 2, wis: 1, con: -1, cha: -1 }, ['Скрытность +2', 'Уязвимость к урону излучением']],
  [9, 'Волк ездовой', 'С (подвижность)', 'лагерь орков', { dex: 1, con: 1, int: -1 }, ['Выживание +1']],
  [9, 'Сокол-разведчик', 'У (исследование)', 'лагерь орков', { wis: 1, dex: 1, str: -1 }, ['Восприятие +1']],
  [8, 'Орк-разведчик', 'С (скрытность)', 'лагерь орков', { dex: 2, int: -1 }, ['Скрытность +1', 'Тёмное зрение +3 м', 'Запугивание −1']],
  [8, 'Орк-копейщик', 'С (контроль подступов)', 'лагерь орков', { str: 2, con: 1, dex: -1 }, ['КД +1', 'Инициатива −1']],
  [8, 'Орк-метатель топоров', 'К', 'лагерь орков', { str: 2, wis: -1 }, ['Дальность метательного оружия +3 м', 'Атлетика +1', 'Скрытность −1']],
  [7, 'Вожак стражи', 'С (строй)', 'лагерь орков', { str: 2, cha: 2, dex: -1 }, ['КД +1', 'Скрытность −1']],
  [7, 'Шаманка костров', 'С (огонь)', 'лагерь орков', { wis: 2, con: 2, dex: -1 }, ['Сопротивление урону огнём', 'Уязвимость к урону холодом']],
  [7, 'Цепной палач', 'С (контроль)', 'лагерь орков', { str: 2, con: 2, dex: -1 }, ['Атлетика +1', 'Инициатива −1']],
  [6, 'Вождь орков', 'К (железная воля, боевой клич)', 'лагерь орков', { str: 2, con: 2, cha: 2, dex: -1 }, ['Запугивание +1', 'Инициатива −1', 'Скрытность −1']],
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }); const p = await b.newPage();
  await p.addInitScript(() => localStorage.setItem('sputnik.state.v2', JSON.stringify({ party: [], sessions: [] })));
  await p.goto('file:///home/user/app/index.html'); await p.waitForTimeout(300);
  const ess = await p.evaluate(() => Object.values(ESSENCES).map(e => ({ id: e.id, name: e.name.replace('Эссенция ', ''), cls: e.cls, stats: e.stats, other: e.other || [] })));
  await b.close();
  const row = (cls, name, extra, stats, other) => { const c = count(stats, other), ok = RULE[cls] ? RULE[cls](c) : true; return `| ${cls} | ${name} | ${extra} | ${stat(stats)} | ${(other || []).join('; ') || '—'} | +${c.plus} | −${c.minus} | ${ok ? '✓' : '✗'} |`; };
  const head = '| Класс | Эссенция | ' + '%EX%' + ' | Статы | Особенности | Плюсов | Минусов | По правилу |\n|---|---|---|---|---|---|---|---|\n';
  let md = `# Таблица статистик эссенций\n\nСгенерировано \`tools/battle-tests/gen_essence_table.js\` (не править руками). Правила масштаба (автор, 27.10.2026): 9 класс — ровно +3 и −1; 8 — минимум +4 и −2; 7 — минимум +5 и −2; 6 — +7 и −3. Счёт: плюсы — сумма положительных значений статов и «+N» особенностей (остальные положительные особенности = 1; «+N м» = 1); минусы — каждый отрицательный пункт (стат или особенность). Опыт за первого убитого монстра вида: 10 − класс.\n\n## В игре сейчас\n\n` + head.replace('%EX%', 'Id');
  for (const e of ess.sort((a, b) => b.cls - a.cls || a.id.localeCompare(b.id))) md += row(e.cls, e.name, e.id, e.stats, e.other) + '\n';
  md += `\n## Предложено для 3 этажа (ещё не в игре; ждёт одобрения автора)\n\n` + head.replace('%EX%', 'Тип · зона');
  for (const [cls, name, type, zone, stats, other] of PROP.sort((a, b) => b[0] - a[0])) md += row(cls, name, type + ' · ' + zone, stats, other) + '\n';
  fs.writeFileSync('/home/user/campaign/essence_table.md', md);
  const bad = (md.match(/\| ✗ \|/g) || []).length; console.log('строк:', ess.length + PROP.length, 'не по правилу:', bad);
})();
