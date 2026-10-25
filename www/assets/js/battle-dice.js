/* Тактический бой: кубики. Физика на canvas (кубик можно зажать, потаскать и швырнуть), окно броска с кнопкой «Бросить»,
   отменой до броска, перебросами и анимацией атаки. Сессия броска — B.Dice.session(юнит, мета). См. docs/battle.md. */
(function () {
  const B = window.Battle, D = B.D;
  const Dice = (B.Dice = {});
  const rnd = n => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sg = n => (n >= 0 ? "+" : "−") + Math.abs(n);
  const ico = (name, cls = "") => `<svg class="bi ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${D.ico[name] || ""}</svg>`;

  /* ===================== рисунок кубика ===================== */
  function poly(s, R) {
    const reg = (n, r, a0) => Array.from({ length: n }, (_, i) => [Math.cos(a0 + i * 2 * Math.PI / n) * r, Math.sin(a0 + i * 2 * Math.PI / n) * r]);
    if (s === 4) return reg(3, R * 1.18, -Math.PI / 2);
    if (s === 6) return [[-R * .82, -R * .82], [R * .82, -R * .82], [R * .82, R * .82], [-R * .82, R * .82]];
    if (s === 8) return [[0, -R * 1.12], [R * .95, 0], [0, R * 1.12], [-R * .95, 0]];
    if (s === 10) return [[0, -R * 1.15], [R * .95, -R * .15], [R * .62, R * .98], [-R * .62, R * .98], [-R * .95, -R * .15]];
    if (s === 12) return reg(5, R * 1.08, -Math.PI / 2);
    return reg(6, R * 1.08, -Math.PI / 2);                                  // d20
  }
  const PALETTE = {
    ivory: ["#fbf2d4", "#d9bf7c", "#46331a", "#2b1c08"],
    blood: ["#d77b6a", "#8f2f27", "#3d0f0b", "#fff1d6"],
    green: ["#a9dc8e", "#4e8f3c", "#1d3d14", "#102608"],
    azure: ["#a9c9ec", "#4a76b0", "#142a4a", "#0d1f3a"],
    gold: ["#ffe9a0", "#d6a64c", "#5a3a0a", "#2b1c08"],
  };

  /* ===================== объёмные кубики: видно, какие грани крутятся ===================== */
  // Настоящие многогранники (d4, d6, d8, d10, d12, d20) вращаются кватернионом, на видимых гранях — числа. После остановки кубик плавно
  // поворачивается так, чтобы выпавшая грань смотрела на игрока (число стоит прямо). Невыпуклых граней нет: достаточно отсечь грани, смотрящие от зрителя.
  const V3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
  const Q = {
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]],
    axis: (ax, ang) => { const [x, y, z] = V3.norm(ax), h = ang / 2, s = Math.sin(h); return [Math.cos(h), x * s, y * s, z * s]; },
    norm: q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; },
    rot: (q, v) => { const [w, x, y, z] = q, [vx, vy, vz] = v;
      const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
      return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]; },
    slerp: (a, b, t) => { let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map(x => -x); d = -d; }
      if (d > 0.9995) return Q.norm(a.map((x, i) => x + (b[i] - x) * t));
      const th = Math.acos(d), s = Math.sin(th), A = Math.sin((1 - t) * th) / s, Bk = Math.sin(t * th) / s; return a.map((x, i) => x * A + b[i] * Bk); },
    between: (a, b) => { const d = V3.dot(a, b); if (d < -0.9999) { const ax = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; return Q.axis(V3.cross(a, ax), Math.PI); } return Q.norm([1 + d, ...V3.cross(a, b)]); },
    random: () => Q.norm([rnd(2000) / 1000 - 1, rnd(2000) / 1000 - 1, rnd(2000) / 1000 - 1, rnd(2000) / 1000 - 1]),
    z: ang => Q.axis([0, 0, 1], ang),
  };
  const POLY_OK = { 4: 1, 6: 1, 8: 1, 10: 1, 12: 1, 20: 1, 100: 1 };
  const POLY_CACHE = {};
  function hullFaces(vs) {
    const faces = [], keys = new Set(), n = vs.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
      let nm = V3.cross(V3.sub(vs[j], vs[i]), V3.sub(vs[k], vs[i])); if (V3.len(nm) < 1e-6) continue; nm = V3.norm(nm);
      let d = V3.dot(nm, vs[i]); if (d < 0) { nm = nm.map(x => -x); d = -d; }
      if (vs.some(p => V3.dot(nm, p) > d + 1e-4)) continue;
      const key = nm.map(x => Math.round(x * 1000)).join(",") + "|" + Math.round(d * 1000); if (keys.has(key)) continue; keys.add(key);
      const idx = vs.map((p, m) => (Math.abs(V3.dot(nm, p) - d) < 1e-4 ? m : -1)).filter(m => m >= 0);
      const c = idx.reduce((a, m) => [a[0] + vs[m][0] / idx.length, a[1] + vs[m][1] / idx.length, a[2] + vs[m][2] / idx.length], [0, 0, 0]);
      const e1 = V3.norm(V3.sub(vs[idx[0]], c)), e2 = V3.cross(nm, e1);
      idx.sort((a, b) => Math.atan2(V3.dot(V3.sub(vs[a], c), e2), V3.dot(V3.sub(vs[a], c), e1)) - Math.atan2(V3.dot(V3.sub(vs[b], c), e2), V3.dot(V3.sub(vs[b], c), e1)));
      faces.push({ idx, n: nm, c, up: V3.norm(V3.sub(vs[idx[0]], c)) });
    }
    return faces;
  }
  function buildPoly(s) {
    const t = s === 100 ? 10 : s; if (POLY_CACHE[s]) return POLY_CACHE[s];
    const PHI = (1 + Math.sqrt(5)) / 2; let vs = [];
    if (t === 4) vs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    else if (t === 6) { for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) vs.push([x, y, z]); }
    else if (t === 8) vs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    else if (t === 12) { for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) vs.push([x, y, z]); for (const a of [-1, 1]) for (const b of [-1, 1]) vs.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]); }
    else if (t === 20) { for (const a of [-1, 1]) for (const b of [-1, 1]) vs.push([0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]); }
    else {                                                                                                   // d10: пятиугольный трапецоэдр; высоту колец подбираем так, чтобы воздушные грани были плоскими
      const h = 1.0, P = a => { const T = [0, 0, h], u0 = [1, 0, a], d0 = [Math.cos(Math.PI / 5), Math.sin(Math.PI / 5), -a], u1 = [Math.cos(2 * Math.PI / 5), Math.sin(2 * Math.PI / 5), a]; return V3.dot(V3.cross(V3.sub(u0, T), V3.sub(d0, T)), V3.sub(u1, T)); };
      let lo = 0.02, hi = 0.9; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (P(lo) * P(mid) <= 0) hi = mid; else lo = mid; }
      const a = (lo + hi) / 2; vs = [[0, 0, h], [0, 0, -h]];
      for (let k = 0; k < 5; k++) { vs.push([Math.cos(2 * Math.PI * k / 5), Math.sin(2 * Math.PI * k / 5), a]); vs.push([Math.cos(2 * Math.PI * k / 5 + Math.PI / 5), Math.sin(2 * Math.PI * k / 5 + Math.PI / 5), -a]); }
    }
    const R = Math.max(...vs.map(V3.len)); vs = vs.map(v => v.map(x => x / R));
    const faces = hullFaces(vs), N = faces.length;
    // числа: противоположные грани в сумме N + 1 (у d4 просто по порядку)
    const nums = new Array(N).fill(0), order = Array.from({ length: Math.ceil(N / 2) }, (_, i) => i + 1);
    for (let i = order.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }          // фиксированная «случайная» раскладка
    let m = 0; const used = new Array(N).fill(false);
    for (let i = 0; i < N; i++) {
      if (used[i]) continue; used[i] = true;
      if (t === 4) { nums[i] = ++m; continue; }
      const opp = faces.findIndex((f, j) => !used[j] && V3.dot(f.n, faces[i].n) < -0.999);
      const v = order[m++]; nums[i] = v; if (opp >= 0) { used[opp] = true; nums[opp] = N + 1 - v; }
    }
    const lab = nums.map(v => (s === 100 ? String((v % 10) * 10).padStart(2, "0") : String(v) + (v === 6 || v === 9 ? "." : "")));
    const clean = nums.map(v => (s === 100 ? String((v % 10) * 10).padStart(2, "0") : String(v)));
    return (POLY_CACHE[s] = { vs, faces, lab, clean, N });
  }
  // Поворот, при котором грань с числом `final` смотрит на зрителя числом вверх.
  Dice.faceUp = function (s, final) {
    const P = buildPoly(s), i = P.clean.indexOf(String(final)); if (i < 0) return Q.random();
    const f = P.faces[i], q0 = Q.between(f.n, [0, 0, 1]), v = Q.rot(q0, f.up), phi = Math.atan2(v[0], v[1]);
    return Q.norm(Q.mul(Q.z(phi), q0));
  };
  Dice.randQ = Q.random; Dice.qAxis = Q.axis; Dice.qMul = Q.mul; Dice.qSlerp = Q.slerp; Dice.qNorm = Q.norm;
  Dice.polyOK = s => !!POLY_OK[s];
  Dice._poly = buildPoly; Dice._qrot = Q.rot;          // для проверок
  function drawPoly(ctx, s, x, y, R, o) {
    const { q, pal = "ivory", glow = null, scale = 1, dim = 1 } = o, col = PALETTE[pal] || PALETTE.ivory, P = buildPoly(s), K = R * 1.12 * scale;
    const rv = P.vs.map(v => Q.rot(q, v)), L = V3.norm([-0.45, 0.6, 0.65]);
    const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const c0 = hex(col[0]), c1 = hex(col[1]);
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = dim; ctx.lineJoin = "round";
    const vis = P.faces.map((f, i) => ({ f, i, n: Q.rot(q, f.n) })).filter(a => a.n[2] > 0.02).sort((a, b) => a.n[2] - b.n[2]);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 20; }
    for (const { f, i, n } of vis) {
      const lum = Math.max(0, Math.min(1, 0.25 + 0.75 * Math.max(0, V3.dot(n, L)))), mix = c1.map((v, k) => Math.round(v + (c0[k] - v) * lum));
      ctx.beginPath(); f.idx.forEach((m, j) => { const p = rv[m]; (j ? ctx.lineTo : ctx.moveTo).call(ctx, p[0] * K, -p[1] * K); }); ctx.closePath();
      ctx.fillStyle = `rgb(${mix[0]},${mix[1]},${mix[2]})`; ctx.fill(); ctx.shadowBlur = 0;
      ctx.lineWidth = 1.6; ctx.strokeStyle = col[2]; ctx.stroke();
      // число на грани: плоскость грани проецируется в экран (аффинно), поэтому цифры сжимаются и наклоняются вместе с гранью
      const c = Q.rot(q, f.c), up = Q.rot(q, f.up), right = V3.cross(up, n);
      const size = (s === 20 ? 0.62 : s === 12 ? 0.74 : s === 100 || s === 10 ? 0.64 : s === 8 ? 0.62 : s === 6 ? 0.9 : 0.7) * K / 100, tilt = Math.max(0.35, n[2]);
      ctx.save(); ctx.transform(right[0] * size, -right[1] * size, -up[0] * size, up[1] * size, c[0] * K, -c[1] * K);
      ctx.globalAlpha = dim * Math.min(1, 0.35 + tilt);
      ctx.fillStyle = col[3]; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const label = P.lab[i], fs = label.length > 2 ? 78 : label.length > 1 ? 100 : 118;
      ctx.font = `700 ${fs}px "Kelly Slab", Georgia, serif`;
      if (pal === "blood") { ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 8; ctx.strokeText(label, 0, 6); }
      ctx.fillText(label, 0, 6); ctx.restore();
    }
    ctx.restore();
  }
  // Рисует кубик с центром (x, y): z — высота над столом, ang — поворот, sq — «кувырок» (0..1: ширина), glow — свечение результата.
  Dice.drawDie = function (ctx, s, x, y, R, o = {}) {
    const { z = 0, ang = 0, sq = 1, face = "", pal = "ivory", glow = null, scale = 1, dim = 1 } = o;
    const col = PALETTE[pal] || PALETTE.ivory;
    ctx.save();
    // тень на столе
    const sh = Math.max(0.35, 1 - z / 140);
    ctx.fillStyle = `rgba(0,0,0,${0.32 * sh})`; ctx.beginPath(); ctx.ellipse(x + z * 0.18, y + R * 0.72, R * 0.95 * sh * scale, R * 0.34 * sh * scale, 0, 0, Math.PI * 2); ctx.fill();
    if (o.q && POLY_OK[s]) { ctx.restore(); drawPoly(ctx, s, x, y - z, R, o); return; }                    // объёмный кубик с числами на гранях
    ctx.translate(x, y - z); ctx.rotate(ang); ctx.scale(scale * (0.8 + 0.2 * sq), scale); ctx.globalAlpha = dim;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 22; }
    const pts = poly(s, R);
    ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
    const g = ctx.createRadialGradient(-R * .3, -R * .4, R * .1, 0, 0, R * 1.3); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 2.4; ctx.strokeStyle = col[2]; ctx.lineJoin = "round"; ctx.stroke();
    // грани
    ctx.lineWidth = 1.3; ctx.strokeStyle = col[2]; ctx.globalAlpha = 0.5 * dim;
    ctx.beginPath();
    if (s === 20) { [0, 2, 4].forEach((i, k) => { const [px, py] = pts[i]; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath(); [1, 3, 5].forEach(i => { ctx.moveTo(pts[i][0] * .5, pts[i][1] * .5); ctx.lineTo(pts[i][0], pts[i][1]); }); }
    else if (s === 8) { ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(0, 0); ctx.lineTo(pts[2][0], pts[2][1]); ctx.moveTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[3][0], pts[3][1]); }
    else if (s === 6) { ctx.rect(-R * .45, -R * .45, R * .9, R * .9); }
    else if (s === 12) { pts.forEach(([px, py]) => { ctx.moveTo(px * .55, py * .55); ctx.lineTo(px, py); }); }
    else if (s === 10) { pts.forEach(([px, py]) => { ctx.moveTo(0, 0); ctx.lineTo(px * .8, py * .8); }); }
    else { pts.forEach(([px, py]) => { ctx.moveTo(px * .5, py * .5); ctx.lineTo(px, py); }); }
    ctx.stroke();
    ctx.globalAlpha = dim;
    // число
    ctx.fillStyle = col[3]; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const fs = Math.round(R * (String(face).length > 1 ? 0.86 : 1.05));
    ctx.font = `700 ${fs}px "Kelly Slab", Georgia, serif`;
    if (pal === "blood") { ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 3; ctx.strokeText(String(face), 0, R * 0.04); }
    ctx.fillText(String(face), 0, R * 0.04);
    ctx.restore();
  };

  /* ===================== физика: арена с кубиками ===================== */
  class Arena {
    constructor(canvas, hooks = {}) {
      this.cv = canvas; this.ctx = canvas.getContext("2d"); this.hooks = hooks; this.bodies = []; this.R = 30; this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.held = null; this.running = false; this.t0 = 0; this.resize();
      this._down = e => this.onDown(e); this._move = e => this.onMove(e); this._up = e => this.onUp(e);
      canvas.addEventListener("pointerdown", this._down); canvas.addEventListener("pointermove", this._move);
      canvas.addEventListener("pointerup", this._up); canvas.addEventListener("pointercancel", this._up);
      this.enabled = false;
    }
    resize() { this.w = Math.max(200, this.cv.clientWidth || 320); this.h = Math.max(120, this.cv.clientHeight || 180); this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr); }
    setDice(list) {
      this.R = list.length > 4 ? 22 : list.length > 2 ? 26 : 32;
      this.bodies = list.map((d, i) => ({ s: d.s, pal: d.pal || "ivory", x: this.w * (0.5 + (i - (list.length - 1) / 2) * 0.22), y: this.h * 0.55, z: 0, vx: 0, vy: 0, vz: 0, ang: (rnd(100) / 100 - 0.5) * 0.6, w: 0, ph: rnd(628) / 100,
        face: d.s === 100 ? "00" : "?", state: "idle", final: null, flickT: 0, settleT: 0, glow: null, bounce: 0,
        q: Dice.polyOK(d.s) ? Dice.randQ() : null, axis: [rnd(200) / 100 - 1, rnd(200) / 100 - 1, rnd(200) / 100 - 1] }));
    }
    anyIdle() { return this.bodies.some(b => b.state === "idle"); }
    allDone() { return this.bodies.length > 0 && this.bodies.every(b => b.state === "done"); }
    rolling() { return this.bodies.some(b => b.state === "rolling" || b.state === "held" || b.state === "settling"); }
    // Бросок всех лежащих кубиков с заданной скоростью (px/с); без аргумента — случайный бросок слева.
    throwAll(vx, vy) {
      const idle = this.bodies.filter(b => b.state === "idle"), n = idle.length;
      idle.forEach((b, i) => {
        let bx = vx, by = vy;
        if (bx == null) { b.x = this.R * 1.2 + rnd(30); b.y = this.h * (0.3 + 0.4 * rnd(100) / 100); b.z = 30; bx = 520 + rnd(520); by = rnd(500) - 250; }
        this.launch(b, bx * (0.9 + rnd(20) / 100), by * (0.85 + rnd(30) / 100) + (i - n / 2) * 40);
      });
    }
    launch(b, vx, vy) {
      const sp = Math.hypot(vx, vy);
      b.state = "rolling"; b.vx = vx; b.vy = vy; b.vz = 230 + Math.min(420, sp * 0.16) + rnd(80); b.z = Math.max(b.z, 36 + rnd(18));
      b.w = (rnd(2) ? 1 : -1) * (7 + Math.min(18, sp * 0.02) + rnd(40) / 10); b.flickT = 0; b.settleT = 0; b.final = null; b.glow = null; b.bounce = 0;
      this.start();
    }
    start() { if (this.running) return; this.running = true; this.t0 = performance.now(); const loop = t => { if (!this.running) return; const dt = Math.min(0.033, (t - this.t0) / 1000); this.t0 = t; this.update(dt); this.draw(); if (!this.rolling()) { this.running = false; return; } this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); }
    destroy() { this.stop(); this.cv.removeEventListener("pointerdown", this._down); this.cv.removeEventListener("pointermove", this._move); this.cv.removeEventListener("pointerup", this._up); this.cv.removeEventListener("pointercancel", this._up); }
    pos(e) { const r = this.cv.getBoundingClientRect(); return [(e.clientX - r.left) * (this.w / r.width), (e.clientY - r.top) * (this.h / r.height)]; }
    onDown(e) {
      if (!this.enabled || !this.anyIdle()) return;
      const [px, py] = this.pos(e);
      const idle = this.bodies.filter(b => b.state === "idle");
      if (!idle.some(b => Math.hypot(b.x - px, b.y - py) <= this.R * 1.7)) return;
      e.preventDefault(); this.cv.setPointerCapture(e.pointerId);
      this.held = { id: e.pointerId, samples: [[performance.now(), px, py]], x: px, y: py };
      idle.forEach((b, i) => { b.state = "held"; b.hx = (i - (idle.length - 1) / 2) * this.R * 1.25; b.hy = ((i % 2) ? 1 : -1) * this.R * 0.35 * (idle.length > 1 ? 1 : 0); });
      if (this.hooks.onGrab) this.hooks.onGrab();
      this.start();
    }
    onMove(e) {
      if (!this.held || e.pointerId !== this.held.id) return;
      const [px, py] = this.pos(e); this.held.x = px; this.held.y = py;
      const t = performance.now(); this.held.samples.push([t, px, py]); while (this.held.samples.length > 8 || (this.held.samples.length > 2 && t - this.held.samples[0][0] > 140)) this.held.samples.shift();
    }
    onUp(e) {
      if (!this.held || e.pointerId !== this.held.id) return;
      const s = this.held.samples, a = s[0], z = s[s.length - 1], dt = Math.max(0.016, (z[0] - a[0]) / 1000);
      let vx = (z[1] - a[1]) / dt, vy = (z[2] - a[2]) / dt;
      const sp = Math.hypot(vx, vy);
      if (sp < 140) { const ang = rnd(628) / 100; vx = Math.cos(ang) * (260 + rnd(160)); vy = Math.sin(ang) * (260 + rnd(160)); }      // отпустил без замаха — просто уронил
      else if (sp > 2600) { vx *= 2600 / sp; vy *= 2600 / sp; }
      this.held = null;
      const held = this.bodies.filter(b => b.state === "held");
      held.forEach((b, i) => { b.state = "idle"; this.launch(b, vx * (0.92 + rnd(16) / 100), vy * (0.92 + rnd(16) / 100) + (i - held.length / 2) * 60); });
      if (this.hooks.onThrow) this.hooks.onThrow();
    }
    update(dt) {
      const R = this.R, g = 1900;
      for (const b of this.bodies) {
        if (b.state === "held" && this.held) {
          const tx = Math.max(R, Math.min(this.w - R, this.held.x + b.hx)), ty = Math.max(R, Math.min(this.h - R, this.held.y + b.hy));
          b.x += (tx - b.x) * Math.min(1, dt * 22); b.y += (ty - b.y) * Math.min(1, dt * 22); b.z += (34 - b.z) * Math.min(1, dt * 12); b.ang += Math.sin(performance.now() / 140 + b.ph) * dt * 1.4; b.ph += dt * 5;
          if (b.q) b.q = Dice.qNorm(Dice.qMul(Dice.qAxis(b.axis, dt * 2.2), b.q));          // в руке кубик медленно поворачивается
          b.sq = 1; continue;
        }
        if (b.state === "rolling") {
          b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= g * dt;
          if (b.z <= 0) {
            b.z = 0;
            if (b.vz < -90) { b.vz = -b.vz * 0.42; b.bounce++; b.w += (rnd(2) ? 1 : -1) * (2 + rnd(30) / 10); b.axis = [rnd(200) / 100 - 1, rnd(200) / 100 - 1, rnd(200) / 100 - 1]; if (this.hooks.onBounce) this.hooks.onBounce(); }
            else b.vz = 0;
          }
          const ground = b.z <= 0.5;
          const k = Math.exp(-(ground ? 3.1 : 0.15) * dt); b.vx *= k; b.vy *= k; b.w *= Math.exp(-(ground ? 2.3 : 0.4) * dt);
          if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.58; b.w *= 0.9; } else if (b.x > this.w - R) { b.x = this.w - R; b.vx = -Math.abs(b.vx) * 0.58; b.w *= 0.9; }
          if (b.y < R * 0.9) { b.y = R * 0.9; b.vy = Math.abs(b.vy) * 0.58; } else if (b.y > this.h - R * 0.6) { b.y = this.h - R * 0.6; b.vy = -Math.abs(b.vy) * 0.58; }
          const sp = Math.hypot(b.vx, b.vy);
          b.ang += b.w * dt; b.ph += (4 + Math.abs(b.w)) * dt; b.sq = Math.abs(Math.cos(b.ph));
          if (b.q) b.q = Dice.qNorm(Dice.qMul(Dice.qAxis(b.axis, (Math.abs(b.w) * 1.9 + (b.z > 1 ? 5 : 0)) * dt), b.q));          // кубик кувыркается: видны грани с числами
          b.flickT -= dt;
          if (b.flickT <= 0) { b.face = this.randFace(b.s); b.flickT = 0.05 + (1 - Math.min(1, (sp + Math.abs(b.w) * 20) / 520)) * 0.2; }
          if (ground && sp < 16 && Math.abs(b.w) < 1.1) { b.settleT += dt; if (b.settleT > 0.14) { b.state = "settling"; b.t = 0; b.final = this.finalFace(b); if (b.q) { b.q0 = b.q; b.qT = Dice.faceUp(b.s, b.final); } } } else b.settleT = 0;
        } else if (b.state === "settling") {
          b.t += dt; b.ang *= Math.exp(-9 * dt); b.sq += (1 - b.sq) * Math.min(1, dt * 12); b.z = Math.max(0, Math.sin(Math.min(1, b.t / 0.22) * Math.PI) * 9);
          if (b.q) { const u = Math.min(1, b.t / 0.42); b.q = Dice.qSlerp(b.q0, b.qT, u * u * (3 - 2 * u)); }          // докатился: плавно ложится выпавшей гранью вверх
          if (b.t > 0.1) b.face = b.final;
          if (b.t >= (b.q ? 0.46 : 0.24)) { b.state = "done"; b.z = 0; b.ang = 0; b.sq = 1; b.face = b.final; if (this.allDone() && this.hooks.onSettle) this.hooks.onSettle(this.bodies.map(x => x.final)); }
        }
      }
      // столкновения кубиков друг с другом
      for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], c = this.bodies[j]; if (a.state === "held" || c.state === "held") continue;
        const dx = c.x - a.x, dy = c.y - a.y, dd = Math.hypot(dx, dy), min = R * 1.9;
        if (dd > 0.01 && dd < min && (a.state !== "idle" || c.state !== "idle")) {
          const nx = dx / dd, ny = dy / dd, ov = (min - dd) / 2;
          a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
          const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rv < 0) { const j2 = -rv * 0.8; a.vx -= nx * j2; a.vy -= ny * j2; c.vx += nx * j2; c.vy += ny * j2; }
        }
      }
    }
    randFace(s) { return s === 100 ? String(rnd(10) * 10).padStart(2, "0") : 1 + rnd(s); }
    finalFace(b) { return b.pre != null ? b.pre : (b.s === 100 ? String(rnd(10) * 10).padStart(2, "0") : 1 + rnd(b.s)); }
    draw() {
      const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h);
      const order = [...this.bodies].sort((a, b) => a.y - b.y);
      for (const b of order) Dice.drawDie(c, b.q ? b.s : (b.s === 100 ? 10 : b.s), b.x, b.y, this.R, { z: b.z, ang: b.q ? 0 : b.ang, q: b.q, sq: b.sq == null ? 1 : b.sq, face: b.face, s100: b.s === 100, pal: b.pal, glow: b.glow || (b.state === "held" ? "rgba(244,212,142,.8)" : (b.state === "idle" ? "rgba(244,212,142,.3)" : null)), scale: b.state === "held" ? 1.12 : 1, dim: b.dim == null ? 1 : b.dim });
    }
    setResultGlow(i, color) { if (this.bodies[i]) { this.bodies[i].glow = color; this.draw(); } }
    dim(i, v) { /* затемнение отброшенного кубика преимущества */ const b = this.bodies[i]; if (b) { b.dim = v; } }
  }
  Dice.Arena = Arena;


  /* ===================== спрайты и всплески атаки ===================== */
  // Спрайты смотрят вправо (в сторону цели), всплеск рисуется поверх портрета цели.
  const SPR = {
    slash: `<path d="M12 16.5 L32 16.5 L38 20 L32 23.5 L12 23.5 Z" fill="#e8eef6" stroke="#8fa0b3" stroke-width="1.2" stroke-linejoin="round"/><path d="M13 20 L35 20" stroke="#fff" stroke-width="1.1"/><rect x="8.5" y="11" width="4.5" height="18" rx="1.6" fill="#d6a64c" stroke="#7a5a1c"/><rect x="2" y="18" width="7" height="4" rx="1.5" fill="#6b4a2a"/><circle cx="2.4" cy="20" r="2.3" fill="#d6a64c" stroke="#7a5a1c" stroke-width=".8"/>`,
    pierce: `<path d="M2 20 L29 20" stroke="#8a6a3a" stroke-width="3.2" stroke-linecap="round"/><path d="M27 13.5 L39 20 L27 26.5 Z" fill="#e8eef6" stroke="#8fa0b3" stroke-width="1.2" stroke-linejoin="round"/><path d="M27 20 L36 20" stroke="#fff"/>`,
    arrow: `<path d="M5 20 L32 20" stroke="#b69460" stroke-width="2.2" stroke-linecap="round"/><path d="M31 15.5 L39 20 L31 24.5 Z" fill="#d3dbe3" stroke="#8fa0b3" stroke-width="1"/><path d="M5 20 L1.5 15.5 M5 20 L1.5 24.5 M9.5 20 L6 15.5 M9.5 20 L6 24.5" stroke="#f4ead2" stroke-width="2.2" stroke-linecap="round"/>`,
    blunt: `<path d="M4 36 L22 18" stroke="#7a5a32" stroke-width="4.4" stroke-linecap="round"/><circle cx="28" cy="12" r="8.5" fill="#b3bac3" stroke="#6a717a" stroke-width="1.6"/><path d="M28 1.5v4.5M28 18v4.5M17.5 12H22M34 12h4.5M20.6 4.6l3.2 3.2M35.4 4.6l-3.2 3.2M20.6 19.4l3.2-3.2M35.4 19.4l-3.2-3.2" stroke="#6a717a" stroke-width="2.4" stroke-linecap="round"/>`,
    fire: `<defs><radialGradient id="gOrbF"><stop offset="0" stop-color="#fff6c0"/><stop offset=".5" stop-color="#ffa43a"/><stop offset="1" stop-color="#ff4a10"/></radialGradient></defs><path d="M2 20 Q12 9 22 13 Q31 14 33 20 Q31 26 22 27 Q12 31 2 20Z" fill="#ff6a1a" opacity=".65"/><circle cx="27" cy="20" r="10" fill="url(#gOrbF)"/>`,
    cold: `<defs><linearGradient id="gIce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2fbff"/><stop offset="1" stop-color="#6fbcf5"/></linearGradient></defs><path d="M39 20 L24 11 L5 20 L24 29 Z" fill="url(#gIce)" stroke="#bfe6ff" stroke-width="1.2" stroke-linejoin="round"/><path d="M24 11 L24 29 M5 20 L39 20" stroke="#fff" stroke-width=".9" opacity=".7"/>`,
    poison: `<circle cx="24" cy="20" r="11" fill="#7fc24a" stroke="#3f7a26" stroke-width="1.4"/><circle cx="20" cy="16" r="3.2" fill="#c8f08c" opacity=".8"/><circle cx="29" cy="24" r="2.2" fill="#c8f08c" opacity=".7"/><circle cx="8" cy="19" r="2.6" fill="#7fc24a" opacity=".6"/><circle cx="3.5" cy="22" r="1.7" fill="#7fc24a" opacity=".5"/>`,
    lightning: `<path d="M24 1 L10 22 L19 22 L14 39 L32 15 L22 15 Z" fill="#fff08a" stroke="#e0a81c" stroke-width="1.3" stroke-linejoin="round"/>`,
    thunder: `<circle cx="22" cy="20" r="7" fill="#ffe27a" opacity=".85"/><circle cx="22" cy="20" r="12" fill="none" stroke="#ffe27a" stroke-width="2.4"/><circle cx="22" cy="20" r="17" fill="none" stroke="#ffe27a" stroke-width="1.8" opacity=".6"/>`,
    heal: `<path d="M16 6h8v10h10v8H24v10h-8V24H6v-8h10z" fill="#8fe3a2" stroke="#3f9a58" stroke-width="1.6" stroke-linejoin="round"/>`,
  };
  const ray = (n, r1, r2, extra = "") => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); return `<path d="M${50 + c * r1} ${50 + s * r1} L${50 + c * r2} ${50 + s * r2}" ${extra}/>`; }).join("");
  const BUR = {
    slash: `<g fill="none" stroke-linecap="round"><path class="st" d="M14 84 L88 16" stroke="#fff" stroke-width="6"/><path class="st s2" d="M24 94 L94 38" stroke="#cfe6ff" stroke-width="4"/><path class="st s3" d="M6 62 L68 8" stroke="#cfe6ff" stroke-width="3.5"/></g>`,
    pierce: `<circle class="pop" cx="50" cy="50" r="11" fill="#fff"/><g class="pop" stroke="#fff" stroke-width="4" stroke-linecap="round">${ray(8, 17, 38)}</g>`,
    blunt: `<circle class="ring" cx="50" cy="50" r="24" fill="none" stroke="#f4d48e" stroke-width="7"/><g class="pop" stroke="#f4d48e" stroke-width="4.5" stroke-linecap="round">${ray(10, 30, 46)}</g>`,
    fire: `<defs><radialGradient id="gBF"><stop offset="0" stop-color="#fff6c0"/><stop offset=".4" stop-color="#ffa43a"/><stop offset="1" stop-color="#ff4a10" stop-opacity="0"/></radialGradient></defs><circle class="pop" cx="50" cy="50" r="48" fill="url(#gBF)"/><g class="pop" fill="#ff7a1a">${[0, 60, 120, 180, 240, 300].map(a => `<path transform="rotate(${a} 50 50)" d="M50 6 Q58 22 50 34 Q42 22 50 6Z"/>`).join("")}</g>`,
    cold: `<g class="pop" stroke="#dff4ff" stroke-width="4.5" stroke-linecap="round" fill="none">${[0, 60, 120].map(a => `<path transform="rotate(${a} 50 50)" d="M50 8 L50 92 M42 18 L50 26 L58 18 M42 82 L50 74 L58 82"/>`).join("")}</g><circle class="ring" cx="50" cy="50" r="22" fill="none" stroke="#9ad7ff" stroke-width="3"/>`,
    poison: `<g class="pop">${[[34, 58, 14], [62, 52, 11], [48, 34, 9], [70, 72, 7], [28, 30, 7]].map(([x, y, r], i) => `<circle class="bub b${i}" cx="${x}" cy="${y}" r="${r}" fill="#8fd25a" stroke="#4a8a2a" stroke-width="2" opacity=".9"/>`).join("")}</g>`,
    lightning: `<circle class="pop" cx="50" cy="50" r="30" fill="#fff6b0" opacity=".55"/><path class="pop" d="M58 4 L30 52 L48 52 L38 96 L72 40 L52 40 Z" fill="#fff08a" stroke="#e0a81c" stroke-width="2" stroke-linejoin="round"/>`,
    thunder: `<circle class="ring" cx="50" cy="50" r="20" fill="none" stroke="#ffe27a" stroke-width="5"/><circle class="ring r2" cx="50" cy="50" r="30" fill="none" stroke="#ffe27a" stroke-width="3.5"/><g class="pop" stroke="#fff08a" stroke-width="3.5" stroke-linecap="round">${ray(8, 12, 26)}</g>`,
    heal: `<g class="pop" fill="#8fe3a2" stroke="#3f9a58" stroke-width="1.4">${[[30, 60, 9], [66, 48, 12], [50, 26, 8], [72, 74, 7], [24, 34, 6]].map(([x, y, r], i) => `<path class="bub b${i}" transform="translate(${x - r} ${y - r}) scale(${r / 12})" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/>`).join("")}</g><circle class="ring" cx="50" cy="50" r="26" fill="none" stroke="#8fe3a2" stroke-width="3"/>`,
  };
  Dice.sprite = k => `<svg viewBox="0 0 40 40" aria-hidden="true">${SPR[k] || SPR.blunt}</svg>`;
  Dice.burst = k => `<svg viewBox="0 0 100 100" aria-hidden="true">${BUR[k] || BUR.blunt}</svg>`;

  /* ===================== окно броска ===================== */
  let current = null;                                     // открытое окно
  function portraitOf(u) { return u && u.face ? `<img src="${u.face}" alt="">` : ""; }
  function createSheet(u, meta) {
    const root = document.createElement("div");
    root.className = "bd-ov"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", meta.title || "Бросок");
    const duo = meta.att && meta.tgt;
    root.innerHTML = `<div class="bd-sheet fx-frame">
      <div class="bd-head"><div class="bd-titles"><h3>${esc(meta.title || "Бросок")}</h3><small>${esc(meta.sub || "")}</small></div>
        <button class="bd-x" type="button" aria-label="Отменить действие">${ico("close")}</button></div>
      <div class="bd-stage${duo ? " duo" : ""}"><div class="bd-who a">${portraitOf(meta.att || u)}</div>${duo ? `<div class="bd-fxl"><span class="bd-weapon">${meta.anim ? Dice.sprite(meta.anim) : ""}</span></div><div class="bd-who t">${portraitOf(meta.tgt)}<b class="bd-num"></b></div>` : `<b class="bd-num solo"></b>`}</div>
      <div class="bd-chips"></div><div class="bd-vs"></div>
      <div class="bd-arena"><canvas></canvas><div class="bd-hint">Зажми кубик, потяни и отпусти — или нажми «Бросить»</div></div>
      <div class="bd-res"></div>
      <div class="bd-row"><button class="bd-roll fx-btn primary big" type="button">Бросить</button>
        <button class="bd-reroll" type="button" aria-label="Перебросить" disabled>${ico("reroll")}<i></i></button></div>
      <button class="bd-ok fx-btn primary big" type="button" hidden>ОК</button></div>`;
    document.body.appendChild(root);
    document.body.classList.add("bd-open");
    const $ = s => root.querySelector(s);
    const sh = { root, $, u, meta, committed: false, closed: false, arena: null, waiters: {} };
    sh.arena = new Arena($("canvas"), { onSettle: vals => sh.onSettle && sh.onSettle(vals), onThrow: () => { sh.committed = true; $(".bd-x").hidden = true; $(".bd-hint").classList.add("off"); }, onGrab: () => $(".bd-hint").classList.add("off") });
    sh.arena.cv.style.touchAction = "none";
    requestAnimationFrame(() => { sh.arena.resize(); sh.arena.draw(); });
    current = sh; return sh;
  }
  function closeSheet(sh) {
    if (!sh || sh.closed) return; sh.closed = true; if (sh.arena) sh.arena.destroy();
    sh.root.classList.add("out"); setTimeout(() => sh.root.remove(), 160);
    if (current === sh) { current = null; document.body.classList.remove("bd-open"); }
    const UI = window.Battle && window.Battle.UI; if (UI && UI.flushFx) UI.flushFx();        // всплывающий урон, ждавший закрытия окна
  }
  const chipsHtml = (mods, adv, dis) => [
    ...(mods || []).filter(m => m.v !== 0 || m.l).map(m => `<span class="bd-chip">${esc(m.l)} ${sg(m.v)}</span>`),
    ...(adv || []).map(a => `<span class="bd-chip adv">▲ ${esc(a)}</span>`), ...(dis || []).map(a => `<span class="bd-chip dis">▼ ${esc(a)}</span>`),
  ].join("");

  // Один шаг броска: показывает подсказки, ждёт бросок игрока, даёт перебросы и «Далее».
  function runStep(sh, o) {
    return new Promise(resolve => {
      const $ = sh.$, arena = sh.arena, meta = sh.meta;
      const pal = o.kind === "dmg" ? (o.heal ? "green" : "blood") : (o.save ? "azure" : "ivory");
      const diceList = o.kind === "d20" ? (o.dual ? [{ s: 20, pal }, { s: 20, pal }] : [{ s: 20, pal }]) : Array.from({ length: o.n }, () => ({ s: o.s, pal }));
      const rerolls = (o.reroll || []).slice();
      let rolled = false, settled = false, prev = null, lastVals = null;
      $(".bd-chips").innerHTML = o.kind === "d20" ? chipsHtml(o.mods, o.adv, o.dis) + (o.dual ? "" : "") : `<span class="bd-chip">${o.n}к${o.s}${o.bonus ? " " + sg(o.bonus) : ""}</span>${o.crit ? '<span class="bd-chip adv">кости урона ×2</span>' : ""}${o.dt ? `<span class="bd-chip">${esc(D.DT[o.dt] || "")}</span>` : ""}`;
      $(".bd-vs").innerHTML = o.vs ? (o.vs.ac != null ? (B.Net && B.Net.isClient && B.Net.isClient() ? `Цель: ${esc(o.vs.name || "")}` : `Цель: ${esc(o.vs.name || "")} · <b>КД ${o.vs.ac}</b>${o.vs.notes && o.vs.notes.length ? ` <small>(${esc(o.vs.notes.join(", "))})</small>` : ""}`) : `Сложность <b>${o.vs.dc}</b>`) : (o.label ? esc(o.label) : "");
      $(".bd-res").innerHTML = ""; $(".bd-res").className = "bd-res";
      $(".bd-ok").hidden = true; $(".bd-row").hidden = false;
      const rollBtn = $(".bd-roll"), rrBtn = $(".bd-reroll"), xBtn = $(".bd-x");
      rollBtn.disabled = false; rollBtn.textContent = "Бросить";
      const canCancel = !!o.cancel && !sh.committed;
      xBtn.hidden = !canCancel; sh.cancelStep = canCancel ? () => { resolve(null); } : null;
      $(".bd-hint").classList.toggle("off", false);
      const updReroll = () => { rrBtn.disabled = !(settled && rerolls.length); rrBtn.classList.toggle("on", !rrBtn.disabled); rrBtn.querySelector("i").textContent = rerolls.length ? "×" + rerolls.length : ""; rrBtn.title = rerolls.length ? rerolls[0].label : "Перебросов нет"; };
      arena.setDice(diceList); arena.enabled = true; arena.draw(); updReroll();
      const finishRoll = vals => {
        settled = true; arena.enabled = false; lastVals = vals;
        let res;
        if (o.kind === "d20") {
          const a = vals[0], b = o.dual ? vals[1] : null, nat = o.dual ? (o.dual === "adv" ? Math.max(a, b) : Math.min(a, b)) : a;
          const sum = (o.mods || []).reduce((s, m) => s + m.v, 0);
          res = { dice: o.dual ? [a, b] : [a], nat, mode: o.dual || null, sum, total: nat + sum };
          if (o.dual) arena.dim(vals.indexOf(nat) === 0 ? 1 : 0, 0.45);
          let txt = `<b class="n">${nat}</b> ${sum ? (sum > 0 ? "+" : "−") + " " + Math.abs(sum) : ""} = <b class="t">${res.total}</b>`;
          let cls = "";
          if (o.death) { txt += res.nat === 20 ? " — двадцать!" : res.nat === 1 ? " — единица (два провала)" : res.total >= 10 ? " — успех" : " — провал"; cls = res.total >= 10 ? "ok" : "bad"; }
          else if (o.vs && o.vs.ac != null) { const hit = nat === 20 || (nat !== 1 && res.total >= o.vs.ac); txt += hit ? (nat === 20 ? " — КРИТ!" : " — попадание") : (nat === 1 ? " — критический промах" : " — промах"); cls = hit ? (nat === 20 ? "crit" : "ok") : "bad"; }
          else if (o.vs && o.vs.dc != null) { const ok = res.total >= o.vs.dc; txt += ok ? " — успех" : " — провал"; cls = ok ? "ok" : "bad"; }
          if (nat === 20) arena.setResultGlow(o.dual && vals[1] === 20 && vals[0] !== 20 ? 1 : 0, "#8fe07a"); else if (nat === 1) arena.setResultGlow(vals.indexOf(1), "#ec6a5a");
          if (prev != null) txt += ` <small>(было ${prev})</small>`;
          $(".bd-res").innerHTML = txt; $(".bd-res").className = "bd-res " + cls; sh.last = res;
        } else {
          const sum = vals.reduce((a, v) => a + v, 0);
          res = { rolls: vals.slice(), sum };
          const tot = sum + (o.bonus || 0);
          $(".bd-res").innerHTML = `${vals.join(" + ")}${o.bonus ? ` ${o.bonus > 0 ? "+" : "−"} ${Math.abs(o.bonus)}` : ""} = <b class="t">${tot}</b>${prev != null ? ` <small>(было ${prev})</small>` : ""}`; $(".bd-res").className = "bd-res " + (o.heal ? "heal" : "dmg");
        }
        res.total = res.total != null ? res.total : res.sum + (o.bonus || 0);
        rollBtn.disabled = true; $(".bd-row").hidden = false; updReroll();
        const ok = $(".bd-ok"); ok.hidden = false; ok.textContent = o.next || "Далее ▸"; sh.lastRes = res; sh.lastTotal = res.total;
        ok.onclick = () => { ok.hidden = true; $(".bd-row").hidden = true; arena.enabled = false; resolve(Object.assign(res, { auto: false })); };
        const rt = o.kind === "d20" ? res.nat : null;
        if (window.navigator && navigator.vibrate) { try { navigator.vibrate(rt === 20 ? [20, 40, 20] : 14); } catch (e) {} }
      };
      sh.onSettle = vals => finishRoll(vals);
      rollBtn.onclick = () => { if (!arena.anyIdle()) return; sh.committed = true; xBtn.hidden = true; $(".bd-hint").classList.add("off"); arena.throwAll(); rollBtn.disabled = true; };
      rrBtn.onclick = () => {
        if (rrBtn.disabled || !rerolls.length) return;
        const opt = rerolls.shift(); if (opt.spend) opt.spend();
        prev = o.kind === "d20" ? (sh.last ? sh.last.nat : null) : (lastVals ? lastVals.reduce((a, v) => a + v, 0) : null);
        settled = false; $(".bd-ok").hidden = true; $(".bd-res").innerHTML = ""; updReroll();
        arena.setDice(diceList); arena.enabled = false; arena.throwAll(); rollBtn.disabled = true;
      };
    });
  }

  // Анимация атаки на «сцене»: оружие вылетает к цели, на цели вспыхивает эффект по типу урона, всплывает число.
  async function playFx(sh, o) {
    const st = sh.$(".bd-stage"), fx = sh.$(".bd-fxl"), tgtEl = sh.$(".bd-who.t"), num = sh.$(".bd-num"), wp = sh.$(".bd-weapon");
    if (!st) return;
    st.classList.remove("hit", "miss", "heal", "swing");
    const kind = o.heal ? "heal" : (o.anim || (sh.meta && sh.meta.anim) || "blunt");
    if (fx && wp) {
      wp.innerHTML = Dice.sprite(kind); fx.className = "bd-fxl"; void fx.offsetWidth;
      fx.classList.add("go", "k-" + kind); if (o.miss) fx.classList.add("miss"); st.classList.add("swing");
      await sleep(o.miss ? 430 : 330);
    }
    if (tgtEl && !o.miss && (o.dmg != null || o.heal)) {
      const b = document.createElement("span"); b.className = "bd-burst k-" + kind; b.innerHTML = Dice.burst(kind); tgtEl.appendChild(b); setTimeout(() => b.remove(), 900);
    }
    if (o.miss) { st.classList.add("miss"); if (num) { num.textContent = "Промах"; num.className = "bd-num show miss"; } }
    else if (o.heal) { st.classList.add("heal"); if (num) { num.textContent = "+" + (o.dmg || 0); num.className = "bd-num show heal"; } }
    else if (o.dmg != null) { st.classList.add("hit"); if (num) { num.textContent = "−" + o.dmg; num.className = "bd-num show hit" + (o.crit ? " crit" : ""); } }
    else if (o.save && num) { num.textContent = o.ok ? "✓" : "✗"; num.className = "bd-num show " + (o.ok ? "heal" : "miss"); }
  }

  Dice.session = function (u, meta) {
    const sh = createSheet(u, meta);
    const cleanup = () => { if (sh.cancelStep) sh.cancelStep = null; };
    return {
      auto: false,
      async d20(o) {
        const dual = (o.adv || []).length && !(o.dis || []).length ? "adv" : (o.dis || []).length && !(o.adv || []).length ? "dis" : null;
        const r = await runStep(sh, { kind: "d20", dual, ...o, next: "Далее ▸" });
        if (!r) { closeSheet(sh); return null; }
        return r;
      },
      async dice(o) {
        if (!(o.n > 0)) return { rolls: [], sum: 0, total: o.bonus || 0, auto: false };         // нечего бросать
        const r = await runStep(sh, { kind: "dmg", ...o, next: "Далее ▸" });
        if (!r) { closeSheet(sh); return null; }
        return r;
      },
      note() {},
      async finish(o = {}) {
        if (sh.closed) return;
        sh.$(".bd-row").hidden = true; sh.arena.enabled = false;
        sh.$(".bd-chips").innerHTML = ""; sh.$(".bd-vs").innerHTML = "";
        sh.$(".bd-res").innerHTML = esc(o.text || ""); sh.$(".bd-res").className = "bd-res " + (o.miss ? "bad" : o.heal || o.ok ? "ok" : o.save ? "bad" : o.crit ? "crit" : "dmg");
        if (o.ok === false) sh.$(".bd-res").className = "bd-res bad";
        sh.$(".bd-arena").classList.add("small");
        await playFx(sh, o);
        await new Promise(res => { const ok = sh.$(".bd-ok"); ok.hidden = false; ok.textContent = "ОК"; ok.onclick = () => res(); });
        closeSheet(sh);
      },
      close() { closeSheet(sh); },
    };
  };
  // Крестик в шапке: отмена до броска.
  document.addEventListener("click", e => {
    const x = e.target.closest(".bd-x"); if (!x) return;
    const sh = current; if (sh && sh.cancelStep && !sh.committed) { const f = sh.cancelStep; sh.cancelStep = null; f(); }
  });
  Dice.isOpen = () => !!current;

  /* ===================== вращающиеся d10 для экрана наград ===================== */
  // Рисует на canvas пару кубиков, которые крутятся и останавливаются по очереди. digits — итоговые цифры [десятки, единицы].
  Dice.spinReveal = function (canvas, digits, o = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = canvas.getBoundingClientRect(), w = Math.max(220, r.width), h = Math.max(120, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d"), R = Math.min(46, w / 6), t0 = performance.now(), stops = o.stops || [1500, 2500], glowAll = o.glow;
    const n = digits.length; let doneAt = null, raf = 0, alive = true, stoppedCount = 0;
    return new Promise(resolve => {
      const frame = now => {
        if (!alive) return;
        const t = now - t0; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
        let allStopped = true;
        for (let i = 0; i < n; i++) {
          const x = w * (0.5 + (i - (n - 1) / 2) * 0.3), y = h * 0.52, stop = stops[i], moving = t < stop;
          let ang, sq, face, z = 0, scale = 1, glow = null;
          if (moving) { allStopped = false; const k = t / 1000 * (14 - i * 2); ang = k * (i % 2 ? -1 : 1); sq = Math.abs(Math.cos(k * 1.3)); face = Math.floor(t / 70 + i * 3) % 10; z = 8 + 6 * Math.abs(Math.sin(t / 160 + i)); scale = 1 + 0.05 * Math.sin(t / 90); }
          else { const e = Math.min(1, (t - stop) / 380); ang = (1 - e) * 0.6 * (i % 2 ? -1 : 1) * Math.cos(e * 9); sq = 1; face = digits[i]; z = Math.max(0, Math.sin(Math.min(1, e * 1.4) * Math.PI) * 18 * (1 - e)); scale = 1 + (1 - e) * 0.12; if (glowAll && t > stops[n - 1] + 150) glow = o.glowColor || "#ffe27a"; }
          Dice.drawDie(ctx, 10, x, y, R, { z, ang, sq, face, pal: glow ? "gold" : "ivory", glow, scale });
          if (!moving && stoppedCount <= i) { stoppedCount = i + 1; if (o.onStop) o.onStop(i); }
        }
        if (allStopped && doneAt == null) doneAt = t;
        if (doneAt != null && t > doneAt + 700) { if (!glowAll || t > doneAt + 1700) { resolve(); if (!glowAll) { alive = false; return; } } }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      canvas._stop = () => { alive = false; cancelAnimationFrame(raf); };
    });
  };
})();
