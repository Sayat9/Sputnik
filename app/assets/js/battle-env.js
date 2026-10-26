/* Тактический бой: среда поля — разрушаемые объекты (камни, кристаллы…), линия обзора и траектория выстрела (перехват снаряда на пути),
   находки (травы, грибы, особые камни: сбор и применение), деревянные сундуки. Данные находок (FINDS, FIND_KIND) — в index.html.
   Числа — черновик, см. ../campaign/drafts.md → «Среда поля». См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const { rnd, roll, parseDice, log, dist, distCell, alive, live, has, addStatus, removeStatus, sleep, pick, amod } = B;
  const NOUI = new Proxy({}, { get: () => () => undefined });
  const UI = () => B.UI || NOUI;
  const ui = () => (B.UI && B.UI.active ? B.UI : null);
  const key = (x, y) => x + "," + y;

  /* ===================== разрушаемые объекты ===================== */
  // hp, ac; res — типы урона, которых объект «боится» меньше (урон вполовину); drop — шанс выпадения камня (решение автора: на 1 этаже только 9-го класса, на 2 этаже только 8-го; низкий) (1 этаж / со 2-го: [9-й класс, 8-й класс]).
  D.obj = {
    rock:     { hp: 20, ac: 12, res: ["slash", "pierce"], drop: [[0.08, 0], [0, 0.05]] },
    crystal:  { hp: 10, ac: 11, res: [], drop: [[0.15, 0], [0, 0.10]] },
    grave:    { hp: 18, ac: 12, res: ["slash", "pierce"], drop: [[0.05, 0], [0, 0.04]] },
    crate:    { hp: 8, ac: 10, res: [], vuln: ["slash"], drop: [[0.03, 0], [0, 0.02]] },
    tent:     { hp: 8, ac: 9, res: [], vuln: ["slash"], drop: [[0.03, 0], [0, 0.02]] },
    tree:     { hp: 25, ac: 12, res: ["pierce"], vuln: ["slash"], drop: [[0.02, 0], [0, 0.02]] },
    palisade: { hp: 20, ac: 10, res: ["pierce"], vuln: ["slash"], drop: [[0.02, 0], [0, 0.015]] },
    stash:    { hp: 6, ac: 9, res: [], vuln: ["slash"], drop: [[0, 0], [0, 0]] },          // походный сундучок Ведьмина леса: награда и мимик — в destroyObject
    spearstuck: { hp: 1, ac: 6, res: [], drop: [[0, 0], [0, 0]] },          // воткнутое копьё-громоотвод: препятствие с 1 ОЗ, сбитое лежит на земле (battle-weap.js)
    deadfall: { hp: 24, ac: 11, res: ["pierce"], vuln: ["slash"], drop: [[0.02, 0], [0, 0.015]] },
  };
  D.recoil = { maxNat: 3, dmg: [1, 4] };                          // обычное оружие (не молот и не тяжёлое), натуральное 1–3 по камню: отдача в руку
  const NO_DAMAGE = ["poison", "psychic", "necrotic", "radiant"];  // такие эффекты объектам не вредят

  const objDef = (x, y) => { const t = B.terrain(x, y); return t && D.obj[t] ? D.obj[t] : null; };
  // Объект как «цель»: у него есть КД и ОЗ, но нет токена. isObj — признак.
  function objAt(x, y) {
    const t = B.terrain(x, y), def = t && D.obj[t]; if (!def) return null;
    const S = B.S, hp = (S.objHp ||= {})[key(x, y)] ?? def.hp;
    return { id: "obj:" + key(x, y), isObj: true, t, name: D.terrain[t].name, x, y, size: 1, side: "obj", ac: def.ac, hp, maxHp: def.hp, conds: [], pass: [], alive: true, face: "", def };
  }
  const isHeavy = w => !!(w && ((w.props || []).includes("Тяжёлое") || /hammer|молот/i.test(w.id + " " + (w.name || ""))));
  function objectTargets(u, atk) {
    if (!atk || atk.thrown && false) return [];
    const out = [], reach = atk.kind === "melee" ? (atk.reach || 1) : atk.range[1];
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      const o = objAt(x, y); if (!o) continue;
      const dd = distCell(u, x, y); if (dd < 1 || dd > reach) continue;
      if (atk.kind !== "melee" && B.lineCells(u, { x, y, size: 1, id: "o" }).some(([cx, cy]) => B.sightBlockAt(cx, cy) || (B.obstacleAt(cx, cy) && !(cx === x && cy === y)))) continue;       // стрела не летит сквозь другой камень
      out.push(o);
    }
    return out;
  }
  function stoneChance(t) {
    const def = D.obj[t]; if (!def || !def.drop) return [0, 0];
    return def.drop[(B.S.floor || 1) >= 2 ? 1 : 0];
  }
  function destroyObject(x, y, src) {
    const S = B.S, t = B.terrain(x, y), name = D.terrain[t].name;
    S.cells[y][x] = ""; delete (S.objHp || {})[key(x, y)];
    log(`${name} разрушен${/[ао]$/.test(name) ? "а" : ""}${src ? " (" + src.name + ")" : ""}.`, "hit");
    const g = ui(); if (g) { g.fxText({ x, y, size: 1, id: "obj" }, "разрушено", "dmg"); g.refresh(); }
    if (t === "stash") { stashBreak(x, y, src); return; }
    if (t === "spearstuck") { if (B.artSpearDown) B.artSpearDown(x, y, src); return; }
    const [p9, p8] = stoneChance(t);
    if (p9 && rnd(1000) < p9 * 1000) { (S.found ||= []).push({ t: "g", id: "stone-9", qty: 1 }); log(`Среди обломков блестит магический камень (9-й класс).`, "good"); }
    if (p8 && rnd(1000) < p8 * 1000) { (S.found ||= []).push({ t: "g", id: "stone-8", qty: 1 }); log(`Среди обломков блестит магический камень (8-й класс).`, "good"); }
  }
  // Походный сундучок (Ведьмин лес): обычно камни (иногда факел), в 5 % случаев внутри мимик — он появляется рядом и бьёт того, кто сломал.
  D.stash = { place: 0.45, mimic: 0.05, stone9: [1, 2], stone8: 0.2, torch: 0.08 };
  function stashBreak(x, y, src) {
    const S = B.S, C = D.stash; let who = src && src.side && !src.isObj ? src : null;
    if (!who) who = B.heroes().filter(alive)[0] || null;
    if (who && rnd(1000) < C.mimic * 1000) {
      const m = B.monUnit("mimic", -1), c = B.freeCellsNear(who, 1, m)[0] || [x, y];
      m.x = c[0]; m.y = c[1]; B.addUnit(m, S.order[S.turn]);
      log(`Из сундучка выскакивает мимик и бросается на ${who.name}!`, "bad");
      const g = ui(); if (g) { g.banner("Мимик!"); g.fxText(m, "мимик", "bad"); }
      (S.stashQ ||= []).push({ id: m.id, tgt: who.id }); return;
    }
    const lines = [], n9 = C.stone9[0] + rnd(C.stone9[1] - C.stone9[0] + 1);
    (S.found ||= []).push({ t: "g", id: "stone-9", qty: n9 }); lines.push(`камни 9-го класса × ${n9}`);
    if (rnd(1000) < C.stone8 * 1000) { S.found.push({ t: "g", id: "stone-8", qty: 1 }); lines.push("камень 8-го класса"); }
    if (rnd(1000) < C.torch * 1000) { S.found.push({ t: "g", id: "torch", qty: 1 }); lines.push("факел"); }
    if (rnd(1000) < 350) { S.found.push({ t: "g", id: "weak-salt", qty: 1 }); lines.push("слабая соль"); }
    log(`В обломках сундучка: ${lines.join(", ")}.`, "good");
  }
  B.flushStash = async function () {
    const S = B.S; while (S && S.stashQ && S.stashQ.length) {
      const q = S.stashQ.shift(), m = S.units.find(u => u.id === q.id), t = S.units.find(u => u.id === q.tgt);
      if (!m || !t || !alive(m) || !alive(t) || t.down) continue;
      const atk = B.meleeAttackOf ? B.meleeAttackOf(m) : null; if (!atk) continue;
      await B.doAttack(m, t, atk, { reaction: true, cancelable: false });
    }
  };
  // Урон объекту в клетке. dt — тип урона (ядовитому, психическому и т. п. объект не вредит).
  function damageObject(x, y, dmg, dt, src) {
    const S = B.S, t = B.terrain(x, y), def = t && D.obj[t]; if (!def || dmg <= 0 || NO_DAMAGE.includes(dt)) return 0;
    const v = def.res && def.res.includes(dt) ? Math.floor(dmg / 2) : def.vuln && def.vuln.includes(dt) ? dmg * 2 : dmg; if (v <= 0) return 0;          // дерево и дерево-подобное боится рубящего: урон вдвое (решение автора)
    const k = key(x, y), left = ((S.objHp ||= {})[k] ?? def.hp) - v; S.objHp[k] = left;
    const g = ui(); if (g) g.fxText({ x, y, size: 1, id: "obj" }, "−" + v, "dmg");
    if (left <= 0) destroyObject(x, y, src); else log(`${D.terrain[t].name}: −${v} (осталось ${left}).`);
    return v;
  }
  // Взрыв и подобные области: урон получают все разрушаемые объекты в клетках.
  function blastCells(cells, dmg, dt, src) { let n = 0; for (const [x, y] of cells) if (damageObject(x, y, dmg, dt, src)) n++; return n; }
  Object.assign(B, { objAt, objectTargets, damageObject, destroyObject, blastCells, isHeavy });

  // Атака оружия по объекту: бросок против КД, молот и тяжёлое оружие — с преимуществом, остальное по камню может отдать в руку.
  async function attackObject(att, atk, o, opt = {}) {
    const S = B.S, melee = atk.kind === "melee", w = atk.w || null, heavy = isHeavy(w);
    const mods = atk.parts ? [...atk.parts] : [{ l: "Бонус атаки", v: atk.hit }], adv = [], dis = [];
    if (atk.penalty) mods.push({ l: atk.penaltyLabel || "Штраф", v: atk.penalty });
    if (melee && heavy) adv.push("молот и тяжёлое оружие");
    if (!melee && atk.range && dist(att, o) > atk.range[0]) dis.push("дальняя дистанция");
    if (att.fat >= 3) mods.push({ l: "Усталость", v: -2 }); else if (att.fat === 2) mods.push({ l: "Усталость", v: -1 });
    const ses = B.session(att, { kind: "attack", att, tgt: o, atk, title: atk.n, sub: `${att.name} → ${o.name}`, anim: B.animKind(atk) });
    const r = await ses.d20({ label: "Бросок атаки", mods, adv, dis, vs: { ac: o.ac, notes: [], name: o.name }, reroll: B.rerollOptions(att, "attack"), cancel: att.side === "hero" && opt.cancelable !== false });
    if (!r) { ses.close(); return { cancelled: true }; }
    if (opt.onCommit) await opt.onCommit();
    const nat = r.nat, total = r.total, hit = nat === 20 || (nat !== 1 && total >= o.ac), crit = nat === 20;
    const g = ui(); if (g) await g.animAttack(att, o, atk, B.animKind(atk));
    const ar = atk.ammo && att.side === "hero" && att.hero ? B.arrowFate(att, o, { nat, total, ac: o.ac, hit, crit }) : null;
    let text, dealt = 0;
    if (hit) {
      const dm = await B.rollDamage(att, o, atk, { melee, extra: [] }, crit, ses);
      for (const p of dm.parts) dealt += damageObject(o.x, o.y, p.v, p.dt, att);
      for (const e of opt.extra || []) { const rr = roll(e.n * (crit && e.critDouble ? 2 : 1), e.s).total + (e.b || 0); dealt += damageObject(o.x, o.y, rr, e.dt || atk.dt, att); }
      if (B.flushStash) await B.flushStash();          // «+2к6» способности
      text = `${crit ? "Критическое попадание! " : "Попадание! "}${o.name}: −${dealt}`;
      log(`${att.name}: ${atk.n} по объекту «${o.name}» — ${dealt} урона.`, "hit");
    } else { text = "Мимо"; log(`${att.name}: ${atk.n} по объекту «${o.name}» — промах (${nat === total ? nat : nat + " → " + total} против КД ${o.ac}).`, "miss"); }
    // отдача: обычное оружие в руке по камню
    let hurt = 0;
    if (melee && !heavy && nat <= D.recoil.maxNat && alive(att)) {
      hurt = roll(D.recoil.dmg[0], D.recoil.dmg[1]).total;
      log(`${att.name}: ${atk.id === "fist" ? "кулак" : "оружие"} отдаёт в руку — ${hurt} урона.`, "bad");
      text += ` · отдача −${hurt}`;
    }
    await ses.finish({ text: text + (ar && ar.note ? " · " + ar.note : ""), miss: !hit, anim: B.animKind(atk), tgt: o, dmg: dealt, crit });
    if (hurt) await B.applyDamage(att, att, [{ v: hurt, dt: "bludgeon", label: "Отдача" }], { melee: true });
    if (att.alive) hookAttackDone(att, atk, hit);
    return { hit, crit, nat, total, dealt, obj: true };
  }
  const hookAttackDone = (att, atk, hit) => { try { B.hookAll(att, "attackDone", { att, atk, ctx: { att, atk, melee: atk.kind === "melee", mods: [], adv: [], dis: [], notes: [], extra: [], consume: [] }, res: { hit, post: [], att, atk } }); } catch (e) { /* пассивки ждут цель-существо */ } };
  B.attackObject = attackObject;

  /* ===================== перехват снаряда на пути ===================== */
  // Дальняя атака, метательное оружие и заклинание с броском атаки: при промахе с низким броском (натуральное 1–10)
  // снаряд, пролетая, задевает первого на линии: существо — если результат броска достигает его КД, объект — урон, неразрушаемый — упирается.
  D.intercept = { maxNat: 10 };
  async function interceptShot(att, tgt, atk, res, ses) {
    if (!atk || atk.kind === "melee" || res.nat > D.intercept.maxNat) return null;
    for (const [x, y] of B.lineCells(att, tgt)) {
      const u = B.occupant(x, y, att);
      if (u && u.id !== tgt.id && alive(u)) {
        const c2 = B.attackCtx(att, u, atk, {});
        if (res.total < c2.ac) { log(`${atk.n} пролетает рядом с ${u.name} и не задевает (${res.total} против КД ${c2.ac}).`, "miss"); return `летит мимо ${u.name}`; }
        log(`${atk.n} не долетает до цели и задевает ${u.name}!`, "bad");
        const dm = await B.rollDamage(att, u, atk, c2, false, ses), ap = await B.applyDamage(att, u, dm.parts, { melee: false, ctx: c2, src: att });
        const g = ui(); if (g) g.fxText(u, "задет", "bad");
        return `задевает ${u.name}: ${ap.total} урона`;
      }
      if (B.obstacleAt(x, y)) {
        const o = objAt(x, y), nm = D.terrain[B.terrain(x, y)].name;
        if (o) { if (res.total >= o.ac) { const dm = await B.rollDamage(att, o, atk, { melee: false, extra: [] }, false, ses); let t = 0; for (const p of dm.parts) t += damageObject(x, y, p.v, p.dt, att); log(`${atk.n} попадает в «${nm}».`, "miss"); return `бьёт в ${nm.toLowerCase()}: −${t}`; } }
        log(`${atk.n} упирается в «${nm}».`, "miss"); return `упирается в ${nm.toLowerCase()}`;
      }
    }
    return null;
  }
  B.interceptShot = interceptShot; B.rollChest = rollChest;

  /* ===================== находки: травы, грибы, камни ===================== */
  const FK = () => (typeof FIND_KIND !== "undefined" ? FIND_KIND : {});
  const FD = () => (typeof FINDS !== "undefined" ? FINDS : {});
  const knows = (hero, id) => (typeof findKnown === "function" ? findKnown(hero, id) : true);
  const findName = (hero, id) => { const f = FD()[id]; return f ? (knows(hero, id) ? f.name : f.alias) : id; };
  D.finds = { none: 0.3, one: 0.4 };                              // шанс 0, 1 или 2 находок на поле: 30 % / 40 % / 30 %
  function placeFinds(S) {
    if ((S.floor || 1) < 2 && S.zone !== "stone") return;                       // травы и грибы — только на 2 этаже (решение автора); особые камни — у элементалей
    const kind = Object.entries(FK()).find(([, k]) => k.zones.includes(S.zone)); if (!kind) return;
    const ids = Object.keys(FD()).filter(id => FD()[id].kind === kind[0]);
    const r = rnd(100), n = r < D.finds.none * 100 ? 0 : r < (D.finds.none + D.finds.one) * 100 ? 1 : 2;
    const total = ids.reduce((a, id) => a + FD()[id].w, 0);
    for (let i = 0; i < n; i++) {
      let pickId = ids[0], t = rnd(total);
      for (const id of ids) { t -= FD()[id].w; if (t < 0) { pickId = id; break; } }
      for (let tries = 0; tries < 40; tries++) {
        const x = rnd(B.W), y = 1 + rnd(B.H - 2), tt = D.terrain[S.cells[y][x]];
        if ((tt && (tt.obstacle || tt.hazard)) || S.objs.some(o => o.x === x && o.y === y)) continue;
        S.objs.push({ id: "find" + S.objs.length, kind: "find", fid: pickId, x, y }); break;
      }
    }
  }
  // Что видит у находки герой u: имя и описание глазами его знаний.
  const findLabel = (u, o) => findName(u.hero, o.fid);
  function nearFinds(u) { return B.S.objs.filter(o => o.kind === "find" && distCell(u, o.x, o.y) <= 1); }
  async function gatherFind(u, o) {
    const S = B.S, c = u.hero, f = FD()[o.fid], k = FK()[f.kind], nm = findLabel(u, o);
    // Проверка: лучший из подходящих навыков (Выживание/Медицина — травы; Выживание — грибы; Атлетика — камни)
    const skill = k.gather.slice().sort((a, b) => B.skillMod(u, b) - B.skillMod(u, a))[0];
    const expert = (f.kind === "herb" || f.kind === "mush") && ((c.essences || []).includes("goblin-shaman") || c.race === "fairy");          // «Знаток трав» (и фея «Сборщица»): преимущество, 2–3 штуки за раз
    const r = await B.doCheck(u, skill, { title: `Собрать: ${nm}`, label: `Сл ${k.gdc}`, dc: k.gdc, adv: expert ? [c.race === "fairy" ? "Сборщица" : "Знаток трав"] : [], cancel: true, onCommit: () => { u.t.action = 0; } });
    if (!r) return false;
    if (r.ok) {
      const qty = expert ? 2 + rnd(2) : 1, left = typeof addToBag === "function" ? addToBag(c, { t: "g", id: o.fid, qty }) : 0;
      if (left >= qty) { log(`${u.name}: рюкзак полон, ${nm.toLowerCase()} остаётся на земле.`); u.t.action = 1; ui() && ui().toast("Рюкзак полон"); return false; }
      if (qty > 1) log(`${u.name} собирает сразу ${qty - left}.`, "good");
      S.objs.splice(S.objs.indexOf(o), 1);
      log(`${u.name} собирает: ${nm.toLowerCase()}.`, "good"); const g = ui(); if (g) { g.fxText(u, "собрано", "good"); g.refresh(); }
    } else if (r.nat === 1) { S.objs.splice(S.objs.indexOf(o), 1); log(`${u.name} портит находку при сборе (${nm.toLowerCase()}).`, "bad"); ui() && ui().refresh(); }
    else log(`${u.name} не справляется со сбором (${r.total} против Сл ${k.gdc}) — можно попробовать ещё раз.`, "miss");
    return true;
  }
  // Применение находки в бою: съесть или применить (доп. действие) и бросить (действие).
  async function eatFind(u, id) {
    const c = u.hero, f = FD()[id], x = f.fx, nm = findName(c, id), txt = [];
    B.takeFind(c, id); u.t.bonus = 0;
    if (x.heal) { const n = roll(x.heal[0], x.heal[1]).total + x.heal[2]; const got = B.heal(u, n, u); txt.push(`+${got} ОЗ`); }
    if (x.mp) { const b = u.mp; B.setMp(u, u.mp + x.mp); txt.push(`+${u.mp - b} маны`); }
    if (x.poison) { const n = roll(x.poison[0], x.poison[1]).total + x.poison[2]; await B.applyDamage(u, u, [{ v: n, dt: "poison", label: f.name }], {}); addStatus(u, "poisoned", { k: 3 }); txt.push(`яд −${n}, отравлен`); }
    if (x.boom) { const n = roll(x.boom[0], x.boom[1]).total + x.boom[2]; await B.applyDamage(u, u, [{ v: n, dt: "fire", label: f.name }], {}); txt.push(`взрыв −${n}`); }
    if (x.sat) { const st = state.run && state.run.status && state.run.status[c.id]; if (st) { st.sat = Math.min(9, st.sat + x.sat); st.starve = 0; } txt.push(`сытость +${x.sat}`); }
    if (x.fat) { const st = state.run && state.run.status && state.run.status[c.id]; if (st) st.fat = Math.max(0, (st.fat || 0) - x.fat); u.fat = Math.max(0, (u.fat || 0) - x.fat); txt.push(`Усталость −${x.fat}`); }
    if (x.light) { addStatus(u, "lit", { k: x.light }); txt.push("светится"); }
    log(`${u.name} применяет «${nm}»: ${txt.join(", ") || "ничего"}.`, "good");
    const g = ui(); if (g) { g.fxText(u, nm, "good"); g.refresh(); }
    return true;
  }
  async function throwFind(u, id) {
    const c = u.hero, f = FD()[id], t = f.throw, nm = findName(c, id), UIx = UI();
    const range = 6, ok = (x, y) => distCell(u, x, y) <= range && distCell(u, x, y) > 0 && !B.lineBlocked(u, { x, y, size: 1, id: "c" });
    let cell = null, units = [];
    if (t.radius) {
      const cells = []; for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (ok(x, y)) cells.push([x, y]);
      const pk = await UIx.pickFor(u, { type: "cell", prompt: `${nm}: куда бросить`, cells, radius: t.radius, kind: "area" }, null);
      if (!pk || !pk.cell) return false; cell = pk.cell;
    } else {
      const foes = B.enemiesOf(u).filter(e => ok(e.x, e.y) && !has(e, "underground"));
      if (!foes.length) { UIx.toast("Нет целей в досягаемости"); return false; }
      const pk = await UIx.pickFor(u, { type: "unit", prompt: `${nm}: в кого бросить`, units: foes.map(e => e.id), cells: [], kind: "attack", from: u }, null);
      if (!pk || !pk.unit) return false; cell = [pk.unit.x, pk.unit.y]; units = [pk.unit];
    }
    B.takeFind(c, id); u.t.action = 0;
    const area = [];
    if (t.radius) for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) if (Math.max(Math.abs(x - cell[0]), Math.abs(y - cell[1])) <= t.radius) area.push([x, y]);
    if (t.radius) units = live().filter(w => !has(w, "underground") && B.footprint(w).some(([fx, fy]) => area.some(([ax, ay]) => ax === fx && ay === fy)));
    log(`${u.name} бросает «${nm}»${t.radius ? " — вспышка" : ""}!`, "skill");
    const g = ui(); if (g) { g.banner(`${u.name} бросает «${nm}»`); if (t.radius && g.fxCube) g.fxCube(Math.max(0, cell[0] - t.radius), Math.max(0, cell[1] - t.radius), Math.min(B.W, 2 * t.radius + 1)); }
    let total = 0;
    if (t.dmg) {
      const ses = B.session(u, { kind: "damage", u, title: nm, sub: `${u.name}: бросок по области` });
      const r = await ses.dice({ label: `Урон ${t.dmg[0]}к${t.dmg[1]}`, n: t.dmg[0], s: t.dmg[1], bonus: t.dmg[2], dt: t.dt, cancel: false, reroll: B.rerollOptions(u, "damage", { melee: false }) });
      total = r.sum + t.dmg[2]; await ses.finish({ text: `${total} урона (${D.DT[t.dt]})`, anim: t.dt === "fire" ? "fire" : "cold", dmg: total, tgt: units[0] || u });
      B.blastCells(area, total, t.dt, u);
    }
    for (const w of units) {
      const sv = await B.doSave(w, t.save, t.dc, { label: nm, from: u });
      if (t.dmg && total > 0) { const v = sv.ok ? Math.floor(total / 2) : total; if (v > 0) await B.applyDamage(u, w, [{ v, dt: t.dt, label: nm }], { skill: true }); }
      if (!sv.ok && (alive(w) || w.down) && t.status) { addStatus(w, t.status, { k: t.rounds || 1 }); g && g.fxText(w, D.status[t.status].name.toLowerCase(), "bad"); log(`${w.name}: ${D.status[t.status].name.toLowerCase()}.`, "bad"); }
    }
    return true;
  }
  // Убрать одну находку из рюкзака героя (из последней подходящей стопки).
  B.takeFind = (c, id) => { if (typeof takeGear === "function") takeGear(c, id, 1); };
  B.countFinds = c => { const out = {}; for (const e of c.bag || []) if (e.t === "g" && FD()[e.id]) out[e.id] = (out[e.id] || 0) + e.qty; return out; };

  /* ===================== сундуки ===================== */
  D.chest = { stone9: [2, 4], stone8: 0.3, food: 0.22, potion: 0.14, other: 0.1, map: 0.03 };         // таблица добычи (черновик)
  function rollChest(floor) {
    const C = D.chest, out = [];
    out.push({ t: "g", id: "stone-9", qty: C.stone9[0] + rnd(C.stone9[1] - C.stone9[0] + 1) });
    if (rnd(1000) < C.stone8 * 1000) out.push({ t: "g", id: "stone-8", qty: floor >= 2 ? 1 + rnd(2) : 1 });
    if (rnd(1000) < C.food * 1000) out.push({ t: "g", id: "ration", qty: 1 + rnd(2) });
    if (rnd(1000) < C.potion * 1000) out.push({ t: "g", id: "potion", qty: 1 });
    if (rnd(1000) < C.other * 1000) { const ids = Object.keys(FD()); out.push(rnd(2) ? { t: "g", id: "torch", qty: 1 + rnd(2) } : { t: "g", id: pick(ids), qty: 1 }); }
    if (rnd(100) < 35) out.push({ t: "g", id: "weak-salt", qty: 1 });          // слабая соль падает из сундуков (решение автора 29.10)
    if (rnd(1000) < C.map * 1000) out.push({ map: "floorMap" });
    return out;
  }
  function placeChests(S, ev) {
    if (S.zone !== "goblin" || (S.floor || 1) < 2) return;
    const thief = (ev.list || []).includes("goblin-thief") || ev.lair === "thieves";
    if (!thief && rnd(100) >= 12) return;
    for (let tries = 0; tries < 60; tries++) {
      const x = rnd(B.W), y = 1 + rnd(3);
      if (S.cells[y][x] || S.objs.some(o => o.x === x && o.y === y)) continue;
      S.cells[y][x] = "chest"; S.objs.push({ id: "chest", kind: "chest", x, y, opened: false, loot: rollChest(S.floor) }); return;
    }
  }
  function placeStashes(S, ev) {
    if (!(ev.stash || ev.void)) return;
    if (rnd(1000) >= D.stash.place * 1000) return;          // сундучок бывает не в каждом бою (решение автора 29.10)
    const n = 1;
    for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
      const x = rnd(B.W), y = 2 + rnd(Math.max(1, B.H - 5));
      if (S.cells[y][x] || S.objs.some(o => o.x === x && o.y === y)) continue;
      S.cells[y][x] = "stash"; i++;
    }
  }
  const nearChest = u => B.S.objs.find(o => o.kind === "chest" && !o.opened && distCell(u, o.x, o.y) <= 1);
  function openChest(u, o) {
    const S = B.S; o.opened = true; S.cells[o.y][o.x] = "chestopen"; u.t.action = 0;
    const lines = [];
    for (const it of o.loot) {
      (S.found ||= []).push(it);
      lines.push(it.map ? "Карта этажа" : `${(typeof itemOf === "function" && (itemOf(it, u.hero) || {}).name) || it.id}${it.qty > 1 ? " × " + it.qty : ""}`);
    }
    log(`${u.name} открывает сундук: ${lines.join(", ")}.`, "good");
    const g = ui(); if (g) { g.fxText(u, "сундук открыт", "good"); g.refresh(); g.banner && g.banner(`Сундук: ${lines.join(", ")}`, 3000); }
    return true;
  }
  // Находки и добыча — отряду по итогам боя (кроме побега: она осталась на поле).
  B.deliverFound = (S, keeps) => {
    const lines = [];
    for (const it of S.found || []) {
      if (!keeps) { lines.push(`Осталось на поле: ${it.map ? "карта" : (itemOf(it) || {}).name}`); continue; }
      if (it.map) {
        if (typeof invItem === "function" && !invItem("map").owned) { invItem("map").owned = true; lines.push("Карта этажа из сундука"); }
        else if (typeof giveParty === "function") lines.push(giveParty({ t: "g", id: "ration", qty: 2 }) + " (карта уже была)");
      } else if (typeof giveParty === "function") lines.push(giveParty(it));
    }
    S.found = [];
    return lines;
  };

  /* ===================== варианты действий героя ===================== */
  B.envActions = function (u) {
    const S = B.S, opts = [], c = u.hero; if (!c || u.summon) return opts;
    const act = B.timeOK(u, "action") ? null : "действие потрачено", bon = B.timeOK(u, "bonus") ? null : "доп. действие потрачено";
    for (const o of nearFinds(u)) {
      const nm = findLabel(u, o), k = FK()[FD()[o.fid].kind];
      const sk = k.gather.map(s => B.SKILL_RU[s]).join(" или ");
      opts.push({ id: "gather:" + o.id, cat: "item", label: `Собрать: ${nm}`, ico: "search", sub: `${sk}, Сл ${k.gdc}${distCell(u, o.x, o.y) ? "" : " · под ногами"}`, time: "action", enabled: !act, why: act, run: () => gatherFind(u, o) });
    }
    const ch = nearChest(u);
    if (ch) opts.push({ id: "chest", cat: "item", label: "Открыть сундук", ico: "search", sub: "деревянный сундук рядом", time: "action", enabled: !act, why: act, run: async () => openChest(u, ch) });
    const have = B.countFinds(c);
    for (const id of Object.keys(have)) {
      const f = FD()[id], known = knows(c, id), nm = findName(c, id), n = have[id];
      if (f.fx && Object.keys(f.fx).length) opts.push({ id: "eat:" + id, cat: "item", label: `${f.kind === "mush" ? "Съесть" : "Применить"}: ${nm}`, ico: "potion", sub: `${known ? (typeof findNote === "function" ? findNote({ fx: f.fx }) : "") : "эффект неизвестен"} · есть ${n}`, time: "bonus", enabled: !bon, why: bon, run: () => eatFind(u, id) });
      if (f.throw) opts.push({ id: "throw:" + id, cat: "item", label: `Бросить: ${nm}`, ico: "throwing", sub: `${known ? "по области или цели, до 6 клеток" : "эффект неизвестен"} · есть ${n}`, time: "action", enabled: !act, why: act, run: () => throwFind(u, id) });
    }
    return opts;
  };

  /* ===================== подготовка поля ===================== */
  B.placeEnv = function (S, ev) { placeFinds(S); placeChests(S, ev || {}); placeStashes(S, ev || {}); };

  /* ===================== данные местности: сундук ===================== */
  D.SVG.chest = '<ellipse cx="50" cy="82" rx="38" ry="9" fill="#000" opacity=".3"/><rect x="14" y="40" width="72" height="40" rx="5" fill="#8a5a2a" stroke="#3d2410" stroke-width="3"/><path d="M14 52 Q50 24 86 52 V40 Q50 14 14 40Z" fill="#a06a32" stroke="#3d2410" stroke-width="3" stroke-linejoin="round"/><path d="M14 56 H86 M32 40 V80 M68 40 V80" stroke="#4a2c12" stroke-width="3"/><rect x="43" y="50" width="14" height="16" rx="2" fill="#d6a64c" stroke="#5a3d0a" stroke-width="2"/><circle cx="50" cy="58" r="2.4" fill="#3d2410"/>';
  D.SVG.chestopen = '<ellipse cx="50" cy="82" rx="38" ry="9" fill="#000" opacity=".3"/><rect x="14" y="46" width="72" height="34" rx="5" fill="#8a5a2a" stroke="#3d2410" stroke-width="3"/><path d="M14 46 L24 18 H76 L86 46Z" fill="#a06a32" stroke="#3d2410" stroke-width="3" stroke-linejoin="round"/><rect x="20" y="48" width="60" height="12" fill="#2a1a0c"/><path d="M32 46 V80 M68 46 V80" stroke="#4a2c12" stroke-width="3"/>';
  D.terrain.chest = { name: "Деревянный сундук", obstacle: true, note: "Не пройти. Откройте его рядом действием: внутри добыча (камни, иногда еда, зелья, карта)." };
  D.SVG.stash = '<ellipse cx="50" cy="82" rx="30" ry="7" fill="#000" opacity=".3"/><rect x="24" y="48" width="52" height="32" rx="5" fill="#6b5a7a" stroke="#2c2236" stroke-width="3"/><rect x="24" y="48" width="52" height="11" rx="5" fill="#85729a" stroke="#2c2236" stroke-width="3"/><rect x="46" y="58" width="8" height="9" rx="2" fill="#d8c070" stroke="#2c2236" stroke-width="2"/>';
  D.terrain.stash = { name: "Походный сундучок", obstacle: true, note: "Не пройти. Небольшой сундучок: сломайте его (КД 9, 6 ОЗ), и внутри что-то будет." };
  D.SVG.spearstuck = '<ellipse cx="50" cy="86" rx="16" ry="5" fill="#000" opacity=".3"/><path d="M50 12 L56 30 L44 30 Z" fill="#c9d4e6" stroke="#2c3a52" stroke-width="2"/><rect x="47" y="30" width="6" height="56" rx="2" fill="#8a6a3a" stroke="#3d2a10" stroke-width="2"/><path d="M40 34 L48 44 M60 34 L52 44" stroke="#7fd0ff" stroke-width="3" stroke-linecap="round"/>';
  D.terrain.spearstuck = { name: "Воткнутое копьё", obstacle: true, note: "Не пройти. Копьё торчит из земли: собьёте его любой атакой (1 ОЗ), и оно упадёт рядом." };
  D.terrain.chestopen = { name: "Открытый сундук", obstacle: true, note: "Не пройти. Уже пуст." };

  /* ===== вороны: последняя ворона в гнезде паникует; чернокрыл зовёт новых (rules.md → «Гнездо ворон и чернокрыл») ===== */
  try {
    const cm = MONSTERS.find(x => x.id === "crow");
    if (cm && !D.mon.crow && D.deriveMon) { D.mon.crow = D.deriveMon(cm); D.mon.crow.ai = Object.assign({}, D.mon.crow.ai, { morale: { type: "alone", dc: 99 } }); }          // последняя ворона всегда бежит
  } catch (e) { /* нет данных вороны — обычная мораль */ }
  const prevRound = B.onRound;
  B.onRound = function (round) {
    if (prevRound) prevRound.apply(this, arguments);
    const S = B.S; if (!S || !S.ev || !S.ev.sp || S.ev.sp.k !== "blackwing" || round % 3 !== 0) return;          // каждые 3 раунда, пока чернокрыл жив
    const bw = S.units.find(u => u.ref === "blackwing" && alive(u) && !u.down); if (!bw) return;
    const have = S.units.filter(u => u.ref === "crow" && alive(u)).length;
    let added = 0;
    for (let i = have; i < 4; i++) {
      const w = B.monUnit("crow", -1);
      Object.assign(w, { summon: true, kind: "crow", owner: bw.id, side: "mon", idx: null, ess: [], pass: ["body:crow"], name: "Ворона " + (S.units.filter(x => x.ref === "crow").length + 1) });
      w.ai = Object.assign({}, w.ai, { noFlee: true, fleeHp: null, morale: null });
      const c = B.freeCellsNear(bw, 8, w)[0]; if (!c) continue;
      w.x = c[0]; w.y = c[1]; B.addUnit(w, bw.id); added++;
    }
    if (added) log(`Прилетают новые вороны: ${added}.`, "skill");
  };
})();
