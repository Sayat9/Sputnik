// База монстров и способностей: campaign/db/monsters.json — единый список (в игре, утверждено, правки, идея, удалён).
// Запуск из папки app:  node tools/mondb.mjs <команда> [аргументы]
//   import                — подтянуть из игры всех монстров и их эссенции (статус «в игре»; заметки и идеи базы сохраняются)
//   list [поле=знач ...]  — список (фильтры: status=идея floor=3 zone="Лагерь орков" cls=7)
//   show <id>             — карточка монстра
//   check                 — проверки: повторы пассивок/активок (имя и похожий текст), масштаб эссенций, нерасписанные навыки,
//                           «в игре» без кода способностей, без статблока; код возврата 1, если есть ошибки
//   add <file.json|json>  — добавить (или заменить) запись целиком
//   set <id> <путь> <знач> — поправить поле: set orc-chief essence.passive.text "..."; значение — JSON или строка
//   note <id> <текст>     — добавить заметку с датой
//   del <id> [--hard]     — пометить «удалён» (из игры исчезнет при gen, если запись создана базой); --hard — стереть из базы
//   gen                   — записать в игру монстров, которых ведёт база (game: "db", статус «в игре»), правки поверх кода (override)
//                           и удаления, затем пересобрать бестиарий (gen_bestiary.py) и книгу (report)
//   report                — campaign/monsters_db.md: читаемая книга монстров по этажам и местам
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import vm from "node:vm";
import path from "node:path";

const APP = path.resolve(new URL(".", import.meta.url).pathname, "..");
const CAMP = path.resolve(APP, "..", "campaign");
const DBF = path.join(CAMP, "db", "monsters.json");
const HTML = path.join(APP, "index.html");
const STATUSES = ["в игре", "утверждено", "правки", "идея", "удалён"];
const today = () => new Date().toISOString().slice(0, 10);

const loadDb = () => existsSync(DBF) ? JSON.parse(readFileSync(DBF, "utf8")) : { version: 1, monsters: {} };
const saveDb = db => { mkdirSync(path.dirname(DBF), { recursive: true }); db.updated = today(); writeFileSync(DBF, JSON.stringify(db, null, 1) + "\n"); };

function gameData() {
  const src = readFileSync(HTML, "utf8");
  const a = src.indexOf("const ESSENCES = {"), b = src.indexOf("// ===== конец данных монстров");
  const ctx = {}; vm.runInNewContext(src.slice(a, b) + "\nthis.out = { MONSTERS, ESSENCES };", ctx);
  return ctx.out;
}
function abilityCode() {
  const dir = path.join(APP, "assets", "js"), ids = new Set();
  for (const f of readdirSync(dir).filter(f => /^battle-.*\.js$/.test(f))) {
    const s = readFileSync(path.join(dir, f), "utf8");
    for (const m of s.matchAll(/\b[AP]\[\s*"([a-z0-9-]+)"\s*\]\s*=/g)) ids.add(m[1]);
    for (const m of s.matchAll(/\b[AP]\.([a-zA-Z0-9_]+)\s*=/g)) ids.add(m[1]);
  }
  return ids;
}
const RAW_KEYS = ["id", "zone", "rare", "weight", "name", "floor", "cls", "rank", "size", "group", "type", "sz", "areas", "ac", "hp", "speed", "cr", "abil", "senses", "traits", "loot", "essence", "ph", "stub", "statDraft", "draft"];
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

/* ---------- import ---------- */
function cmdImport() {
  const db = loadDb(), { MONSTERS, ESSENCES } = gameData(), code = abilityCode(), seen = new Set();
  for (const m of MONSTERS) {
    if (m.dyn) continue; seen.add(m.id);
    const prev = db.monsters[m.id] || {};
    const e = ESSENCES[m.essence || m.id];
    const place = (m.areas && m.areas[0] || "").replace(/^\d этаж[,:]?\s*/, "") || m.zone;
    db.monsters[m.id] = {
      ...prev, id: m.id, name: m.name, floor: m.floor, place: prev.place || place, cls: m.cls, rank: m.rank, type: m.type || "",
      status: prev.status && prev.status !== "идея" && prev.status !== "утверждено" ? prev.status : "в игре",
      game: prev.game === "db" ? "db" : "code",
      mon: pick(m, RAW_KEYS),
      essence: e ? { name: e.name, cls: e.cls, stats: e.stats, other: e.other || [], passive: e.passive, active: e.active } : null,
      code: { active: code.has(m.essence || m.id), passive: code.has(m.essence || m.id) },
      notes: prev.notes || [],
    };
  }
  for (const [id, r] of Object.entries(db.monsters)) if (r.game && r.game !== "db" && !seen.has(id) && r.status === "в игре") { r.status = "удалён"; (r.notes ||= []).push({ d: today(), t: "нет в игре при импорте" }); }
  saveDb(db); console.log(`импортировано из игры: ${seen.size}, всего в базе: ${Object.keys(db.monsters).length}`);
}

/* ---------- проверки ---------- */
const norm = s => (s || "").toLowerCase().replace(/ё/g, "е").replace(/[«»"().,:;!?—–-]/g, " ").replace(/\s+/g, " ").trim();
const words = s => new Set(norm(s).split(" ").filter(w => w.length > 3));
const jacc = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let i = 0; for (const w of A) if (B.has(w)) i++; return i / (A.size + B.size - i); };
const NEG = /[−-]\d|Жадность|Серебро жжёт|Боится|Уязвимость|Тяжёлый|Холод (сковывает|жжёт)|Хрупкий|Нестабильность|Плохое зрение/;
function scaleOf(e) {
  let plus = 0, minus = 0;
  for (const v of Object.values(e.stats || {})) { if (v > 0) plus += v; else if (v < 0) minus++; }
  for (const o of e.other || []) { if (NEG.test(o)) minus++; else { const m = /\+(\d+)(,\d+)?( м)?/.exec(o); plus += m && !m[3] ? +m[1] : 1; } }
  return { plus, minus };
}
const RULE = { 9: r => r.plus === 3 && r.minus === 1, 8: r => r.plus >= 4 && r.minus >= 2, 7: r => r.plus >= 5 && r.minus >= 2, 6: r => r.plus >= 7 && r.minus >= 3 };
function cmdCheck(quiet) {
  const db = loadDb(), live = Object.values(db.monsters).filter(r => r.status !== "удалён"), errs = [], warns = [];
  const skills = [];
  for (const r of live) { const e = r.essence; if (!e) { if (r.status !== "идея") warns.push(`${r.id}: нет эссенции`); continue; }
    for (const k of ["passive", "active"]) { const s = e[k]; if (!s || !s.name) { (r.status === "идея" ? warns : errs).push(`${r.id}: ${k === "passive" ? "пассивка" : "активка"} без названия`); continue; }
      if (!s.text || s.text.length < 25) (r.status === "идея" ? warns : errs).push(`${r.id}: ${k === "passive" ? "пассивка" : "активка"} «${s.name}» не расписана`);
      if (k === "active" && r.status !== "идея" && (s.mana == null || !s.time)) errs.push(`${r.id}: активка «${s.name}» без маны или времени`);
      skills.push({ id: r.id, k, name: s.name, text: s.text || "" }); }
    if (e.stats && RULE[e.cls || r.cls]) { const sc = scaleOf(e); if (!RULE[e.cls || r.cls](sc)) (r.status === "идея" ? warns : errs).push(`${r.id}: масштаб эссенции ${e.cls || r.cls} кл. не по правилу (+${sc.plus} / −${sc.minus})`); }
    if (r.status === "в игре" && r.code && !r.code.active) warns.push(`${r.id}: в игре, но нет кода способностей в бою`);
    if (r.status === "в игре" && r.mon && (!r.mon.ac || r.mon.ac === "—")) warns.push(`${r.id}: в игре без статблока`);
  }
  // повторы: одинаковое название (у разных монстров) или очень похожий текст
  for (let i = 0; i < skills.length; i++) for (let j = i + 1; j < skills.length; j++) {
    const a = skills[i], b = skills[j]; if (a.id === b.id) continue;
    if (norm(a.name) === norm(b.name)) errs.push(`повтор названия: «${a.name}» — ${a.id} и ${b.id}`);
    else if (a.text.length > 40 && b.text.length > 40) { const s = jacc(a.text, b.text); if (s >= 0.55) warns.push(`похожий текст (${Math.round(s * 100)} %): ${a.id} «${a.name}» и ${b.id} «${b.name}»`); }
  }
  if (!quiet) { for (const e of errs) console.log("✗", e); for (const w of warns) console.log("·", w); console.log(`ошибок: ${errs.length}, замечаний: ${warns.length}`); }
  return { errs, warns };
}

/* ---------- правка ---------- */
function setPath(o, p, v) { const ks = p.split("."); let x = o; for (const k of ks.slice(0, -1)) x = (x[k] ||= {}); x[ks[ks.length - 1]] = v; }
const parseVal = v => { try { return JSON.parse(v); } catch { return v; } };
function cmdAdd(arg) {
  const db = loadDb(), data = existsSync(arg) ? JSON.parse(readFileSync(arg, "utf8")) : JSON.parse(arg);
  for (const r of Array.isArray(data) ? data : [data]) {
    if (!r.id || !r.name) throw new Error("нужны id и name");
    if (r.status && !STATUSES.includes(r.status)) throw new Error("статус: " + STATUSES.join(", "));
    const prev = db.monsters[r.id] || {};
    db.monsters[r.id] = { ...prev, ...r, notes: [...(prev.notes || []), ...(r.notes || [])] };
    console.log((prev.id ? "обновлён: " : "добавлен: ") + r.id);
  }
  saveDb(db); const { errs } = cmdCheck(true); if (errs.length) console.log(`внимание: check находит ошибок — ${errs.length} (node tools/mondb.mjs check)`);
}
function cmdSet(id, p, v) { const db = loadDb(), r = db.monsters[id]; if (!r) throw new Error("нет " + id); setPath(r, p, parseVal(v)); (r.notes ||= []).push({ d: today(), t: `правка ${p}` }); saveDb(db); console.log("ok"); }
function cmdNote(id, t) { const db = loadDb(), r = db.monsters[id]; if (!r) throw new Error("нет " + id); (r.notes ||= []).push({ d: today(), t }); saveDb(db); console.log("ok"); }
function cmdDel(id, hard) { const db = loadDb(); if (!db.monsters[id]) throw new Error("нет " + id); if (hard) delete db.monsters[id]; else { db.monsters[id].status = "удалён"; (db.monsters[id].notes ||= []).push({ d: today(), t: "удалён" }); } saveDb(db); console.log("ok — для игры выполни gen"); }

/* ---------- генерация в игру ---------- */
const J = o => JSON.stringify(o);
function cmdGen() {
  const db = loadDb(), rows = Object.values(db.monsters);
  const add = rows.filter(r => r.game === "db" && r.status === "в игре" && r.mon);
  const over = rows.filter(r => r.game === "code" && r.override && r.status !== "удалён");
  const gone = rows.filter(r => r.game === "code" && r.status === "удалён" && r.removeFromGame);
  let js = "/*DB-BEGIN*/\n// Сгенерировано tools/mondb.mjs из campaign/db/monsters.json — не править руками (node tools/mondb.mjs gen).\n";
  for (const r of add) { js += `MONSTERS.push(${J({ ...r.mon, id: r.id, name: r.name, floor: r.floor, cls: r.cls })});\n`;
    if (r.essence) js += `ESSENCES[${J(r.id)}] = ${J({ id: r.id, source: r.id, ...r.essence })};\n`; }
  for (const r of over) { const o = r.override;
    if (o.mon) js += `Object.assign(MONSTERS.find(m => m.id === ${J(r.id)}) || {}, ${J(o.mon)});\n`;
    if (o.essence) { const e = o.essence; js += `if (ESSENCES[${J(r.id)}]) { const e = ESSENCES[${J(r.id)}];` + Object.entries(e).map(([k, v]) => ` e[${J(k)}] = ${typeof v === "object" && !Array.isArray(v) ? `Object.assign({}, e[${J(k)}], ${J(v)})` : J(v)};`).join("") + " }\n"; } }
  for (const r of gone) js += `{ const i = MONSTERS.findIndex(m => m.id === ${J(r.id)}); if (i >= 0) MONSTERS.splice(i, 1); delete ESSENCES[${J(r.id)}]; }\n`;
  js += "/*DB-END*/\n";
  let src = readFileSync(HTML, "utf8");
  const s0 = src.indexOf("/*DB-BEGIN*/"), s1 = src.indexOf("/*DB-END*/");
  if (s0 >= 0 && s1 > s0) src = src.slice(0, s0) + js + src.slice(s1 + "/*DB-END*/\n".length);
  else { const anchor = "MONSTERS.forEach(m => {\n  const x = MON_EXTRA[m.id] || {};"; const i = src.indexOf(anchor); if (i < 0) throw new Error("не найдено место для блока базы"); src = src.slice(0, i) + js + src.slice(i); }
  writeFileSync(HTML, src);
  const ctx = {}; try { gameData(); } catch (e) { throw new Error("после генерации данные игры не читаются: " + e.message); }
  console.log(`в игру: новых ${add.length}, правок ${over.length}, удалений ${gone.length}`);
  try { execSync("python3 tools/gen_bestiary.py", { cwd: APP, stdio: "inherit" }); } catch (e) { console.log("бестиарий не пересобран: " + e.message); }
  cmdReport();
}

/* ---------- книга ---------- */
const STAT_RU = { str: "Сил", dex: "Лов", con: "Тел", int: "Инт", wis: "Мдр", cha: "Хар" };
const sg = v => (v > 0 ? "+" : "−") + Math.abs(v);
const essLine = e => !e ? "—" : [...Object.entries(e.stats || {}).map(([k, v]) => `${STAT_RU[k]} ${sg(v)}`), ...(e.other || [])].join(", ");
function cmdReport() {
  const db = loadDb(), rows = Object.values(db.monsters).filter(r => r.status !== "удалён");
  const { errs, warns } = cmdCheck(true);
  let md = `# База монстров и способностей\n\nСобрано \`tools/mondb.mjs report\` из \`campaign/db/monsters.json\` (${today()}). Статусы: в игре · утверждено (ждёт внесения) · правки · идея.\nПроверка: ошибок ${errs.length}, замечаний ${warns.length}${errs.length ? " — см. `node tools/mondb.mjs check`" : ""}.\n`;
  const by = {}; for (const r of rows) ((by[r.floor || 0] ||= {})[r.place || "—"] ||= []).push(r);
  for (const fl of Object.keys(by).sort()) { md += `\n## ${fl} этаж\n`;
    for (const [pl, list] of Object.entries(by[fl])) { md += `\n### ${pl}\n\n| Кл. | Монстр | Статус | Статы монстра | Эссенция | Пассивка | Активка | Код |\n|---|---|---|---|---|---|---|---|\n`;
      for (const r of list.sort((a, b) => b.cls - a.cls || a.name.localeCompare(b.name))) { const m = r.mon || {}, e = r.essence || {};
        const ac = m.ac && m.ac !== "—" ? `КД ${String(m.ac).split(" ")[0]}, ОЗ ${String(m.hp).split(" ")[0]}` : (r.stats || "—");
        md += `| ${r.cls} | ${r.name} \`${r.id}\` | ${r.status} | ${ac} | ${essLine(e)} | ${e.passive ? `**${e.passive.name}**: ${e.passive.text || "—"}` : "—"} | ${e.active ? `**${e.active.name}**${e.active.mana != null ? ` (${e.active.mana} маны)` : ""}: ${e.active.text || "—"}` : "—"} | ${r.code && r.code.active ? "да" : "нет"} |\n`; } } }
  writeFileSync(path.join(CAMP, "monsters_db.md"), md); console.log("книга: campaign/monsters_db.md");
}

/* ---------- список и карточка ---------- */
function cmdList(filters) {
  const db = loadDb(); const f = Object.fromEntries(filters.map(x => x.split("=")));
  const rows = Object.values(db.monsters).filter(r => Object.entries(f).every(([k, v]) => String(r[k]) === v)).sort((a, b) => (a.floor || 0) - (b.floor || 0) || String(a.place).localeCompare(String(b.place)) || b.cls - a.cls);
  for (const r of rows) console.log(`${r.floor || "-"} эт. · ${String(r.place).padEnd(22)} · ${r.cls} кл. · ${r.status.padEnd(9)} · ${r.id} — ${r.name}`);
  console.log(`всего: ${rows.length}`);
}
function cmdShow(id) { const r = loadDb().monsters[id]; if (!r) throw new Error("нет " + id); console.log(JSON.stringify(r, null, 1)); }

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === "import") cmdImport();
  else if (cmd === "list") cmdList(args);
  else if (cmd === "show") cmdShow(args[0]);
  else if (cmd === "check") { const { errs } = cmdCheck(false); process.exitCode = errs.length ? 1 : 0; }
  else if (cmd === "add") cmdAdd(args[0]);
  else if (cmd === "set") cmdSet(args[0], args[1], args.slice(2).join(" "));
  else if (cmd === "note") cmdNote(args[0], args.slice(1).join(" "));
  else if (cmd === "del") cmdDel(args[0], args.includes("--hard"));
  else if (cmd === "gen") cmdGen();
  else if (cmd === "report") cmdReport();
  else console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").filter(l => l.startsWith("//")).join("\n"));
} catch (e) { console.error("ошибка: " + e.message); process.exitCode = 2; }
