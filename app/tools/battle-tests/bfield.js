// Поле боя: паутина и сухая трава горят и перекидываются, удар о стену, сцены фона, окно врага без лишних сведений, пропуск после переброса.
const L = require('./bui_lib.js');
(async () => {
  const { b, p } = await L.launch(400, 860, {});
  const R = [], ok = (n, c, x) => { R.push(!!c); if (!c) console.log('  ✗', n, '—', x == null ? '' : JSON.stringify(x)); };
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.setup(p, { heroes: ['barb2', 'archer'], autoEnd: false });
  const A = await p.evaluate(async () => {
    const B = Battle, o = {}; B.cfg.fast = true;
    B.newBattle({ list: ['goblin', 'goblin'], zone: 'goblin', floor: 1, place: 'Паучьи кроны' }); const S = B.S;
    o.scene = S.scene;
    S.cells = S.cells.map(r => r.map(() => '')); S.objs = []; S.phase = 'fight';
    const [h, h2] = B.heroes(), m = B.mons()[0]; h.x = 3; h.y = 5; h2.x = 0; h2.y = 6; m.x = 3; m.y = 4;
    S.cells[4][3] = 'web'; S.cells[4][4] = 'brush'; S.cells[3][4] = 'web'; S.cells[1][1] = 'web';
    // огонь по бойцу в паутине поджигает её и соседние горючие клетки
    await B.applyDamage(h, m, [{ v: 1, dt: 'fire', label: 'тест' }]);
    o.afterFire = [B.terrain(3, 4), B.terrain(4, 4), B.terrain(3, 5)];
    o.far = B.terrain(1, 1);
    // горение: за 3 раунда перекидывается/догорает
    for (let i = 0; i < 4; i++) B.onRound(i + 2);
    o.after = [B.terrain(3, 4), B.terrain(4, 4), B.terrain(3, 3)];
    o.fireOld = Object.keys(S.fireOld || {}).length;
    // удар о преграду: толчок в край поля и в стену
    S.cells[2][2] = 'palisade'; m.x = 3; m.y = 0; m.hp = m.maxHp = 50; const hp0 = m.hp;
    const n = await B.push(m, 3, 1, 1); o.pushEdge = [n, hp0 - m.hp];
    m.x = 3; m.y = 2; m.hp = 50; const n2 = await B.push(m, 4, 2, 1); o.pushWall = [n2, 50 - m.hp];
    m.x = 3; m.y = 3; m.hp = 50; const n3 = await B.push(m, 3, 4, 1); o.pushFree = [n3, 50 - m.hp];
    // окно врага: игроку не видны класс и статы
    state.settings = state.settings || {}; state.settings.master = false;
    B.UI.open(); B.UI.inspect(m);
    o.inspTxt = document.querySelector('.bt-modal').textContent; document.querySelector('.bt-modal').hidden = true;
    // свободная часть экрана закрывает окно
    B.UI.inspect(m, '<p>сноска</p>'); const mod = document.querySelector('.bt-modal'); mod.click(); o.closedByBlank = mod.hidden;
    B.UI.close();
    return o;
  });
  ok('сцена по месту «Паучьи кроны»', A.scene === 'forest', A.scene);
  ok('огонь по бойцу поджигает паутину и сухую траву рядом', A.afterFire[0] === 'fire' && A.afterFire[1] === 'fire', A.afterFire);
  ok('дальняя паутина не горит сама', A.far === 'web', A.far);
  ok('после 4 раундов всё догорело, огня не осталось', A.after[0] === '' && A.after[1] === '' && A.fireOld === 0, [A.after, A.fireOld]);
  ok('толчок в край поля ранит', A.pushEdge[0] === 0 && A.pushEdge[1] > 0, A.pushEdge);
  ok('толчок в стену ранит', A.pushWall[0] === 0 && A.pushWall[1] > 0, A.pushWall);
  ok('толчок на свободную клетку не ранит', A.pushFree[0] === 1 && A.pushFree[1] === 0, A.pushFree);
  ok('в окне врага для игрока нет класса и характеристик', !/класс/.test(A.inspTxt) && !/Скорость/.test(A.inspTxt) && !/Сил\s*\d/.test(A.inspTxt), A.inspTxt.slice(0, 200));
  ok('нажатие на свободную часть закрывает окно врага', A.closedByBlank);
  ok('ошибок страницы нет', errs.length === 0, errs);
  console.log('проверок:', R.length, 'не прошли:', R.filter(x => !x).length);
  await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
