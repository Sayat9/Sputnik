// Печатает JSON { MONSTERS, ESSENCES } из index.html (блок данных от ESSENCES до «конец данных монстров»).
import { readFileSync } from "node:fs";
import vm from "node:vm";
const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const a = src.indexOf("const ESSENCES = {"), b = src.indexOf("// ===== конец данных монстров");
const ctx = {};
vm.runInNewContext(src.slice(a, b) + "\nthis.out = { MONSTERS, ESSENCES };", ctx);
process.stdout.write(JSON.stringify(ctx.out));
