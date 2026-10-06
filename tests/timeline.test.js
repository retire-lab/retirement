/* tests/timeline.test.js — 引擎拆層與保險接續（v0.9.7，夫妻模式的地基）
 * 一、拆層一致：flowsM ＝ 這個人的 ＋ 這個家的；netM ＝ flowsM.net；只算這個人的模式跟完整模式的個人部分相同；超出範圍不會是 NaN
 * 二、單人＝只有一個人的家：家庭組合器的判斷跟 evalR 一致，最快退休那個月夠、前一個月不夠
 * 三、保險接續與重疊：每個人、每個月，薪水／國保／健保／勞保／勞退／國保年金／一次領之間的規則
 * 四、時間軸：每個月只有一種狀態、區段連續、狀態跟現金流對得上
 * 五、家庭組合器的掛勾（夫妻模式要用）：生活費倍數、免繳健保、成員順序不影響、成員越多存款不會越少（收入為正時）
 * 每一條都跑 600 組固定種子的隨機條件 × 數個退休年齡 × 每一個月 */
'use strict';
const S = require('../src/engine.js');
const { makeCase } = require('./_cases');
const NOW = { y: 2026, m: 10 }, N = 600, EPS = 1e-6;
let ok = 0, bad = 0;
const fails = {};
function check(name, cond, detail) {
  if (cond) return true;
  fails[name] = fails[name] || []; if (fails[name].length < 3) fails[name].push(detail); return false;
}
const counts = {};
function rule(name, fn) { counts[name] = counts[name] || { n: 0, f: 0 }; const r = fn(); counts[name].n++; if (!r) counts[name].f++; }
const close = (a, b) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));

const cases = [];
for (let i = 0; i < N; i++) {
  const inp = makeCase(i), en = S.create(inp, { now: NOW }); en.sync();
  if (en.validate()) continue;
  const P = en.profile(), A0 = en.age(), nowAge = 65 - en.tOfAge(65) / 12, e = en.earliest();
  const Rs = [nowAge + 1 / 12, 50, 55, 58, 60, 62, 65].filter((R) => R >= nowAge + 1 / 12 - 1e-9 && R <= 65);
  if (e !== null && Rs.indexOf(e) < 0) Rs.push(e);
  cases.push({ i, inp, en, P, A0, nowAge, e, Rs });
}

/* ===== 一、拆層一致 ===== */
const PF = ['work', 'li', 'ls', 'np', 'old', 'npPrem', 'nhiPrem'], HF = ['living', 'loan', 'prepay', 'kid', 'par'];
cases.forEach((c) => {
  const pen = S.create(c.inp, { now: NOW, role: 'person' }); pen.sync();
  const PP = pen.profile();
  c.Rs.forEach((R) => {
    const Q = c.en.pensions(c.P, R), QP = pen.pensions(PP, R);
    let a1 = true, a2 = true, a3 = true, a4 = true, a5 = true;
    for (let t = 0; t < c.P.tE; t++) {
      const f = c.en.flowsM(c.P, Q, t), p = c.en.personFlowsM(c.P, Q, t), h = c.en.householdFlowsM(c.P, t);
      if (a1 && !(PF.every((k) => f[k] === p[k]) && HF.every((k) => f[k] === h[k]))) a1 = check('flowsM 的每個欄位＝這個人的＋這個家的', false, '第 ' + c.i + ' 組 R=' + R + ' t=' + t);
      if (a2 && !close(c.en.netM(c.P, Q, t), f.net)) a2 = check('netM（求解用的快速總數）＝ flowsM.net（明細）', false, '第 ' + c.i + ' 組 t=' + t + '：' + c.en.netM(c.P, Q, t) + ' vs ' + f.net);
      const pp = pen.personFlowsM(PP, QP, t), hh = pen.householdFlowsM(PP, t);
      if (a3 && !PF.every((k) => close(pp[k], p[k]))) a3 = check('只算這個人的模式：個人部分跟完整模式相同', false, '第 ' + c.i + ' 組 t=' + t + ' ' + JSON.stringify(pp) + ' vs ' + JSON.stringify(p));
      if (a4 && !(hh.outflow === 0 && hh.net === 0)) a4 = check('只算這個人的模式：家的支出全部是 0', false, '第 ' + c.i + ' 組 t=' + t + ' ' + JSON.stringify(hh));
      if (a5 && !Object.values(f).every((v) => typeof v === 'number' && isFinite(v))) a5 = check('計算範圍內每個月、每個欄位都是數字（不是 NaN）', false, '第 ' + c.i + ' 組 t=' + t);
    }
    rule('flowsM 的每個欄位＝這個人的＋這個家的', () => a1); rule('netM（求解用的快速總數）＝ flowsM.net（明細）', () => a2);
    rule('只算這個人的模式：個人部分跟完整模式相同', () => a3); rule('只算這個人的模式：家的支出全部是 0', () => a4);
    rule('計算範圍內每個月、每個欄位都是數字（不是 NaN）', () => a5);
    let b1 = true, b2 = true;
    for (let t = c.P.tE; t < c.P.tE + 120; t++) {
      const p = c.en.personFlowsM(c.P, Q, t), f = c.en.flowsM(c.P, Q, t);
      if (b1 && !(PF.every((k) => p[k] === 0) && p.net === 0)) b1 = check('過了「算到幾歲」：這個人的現金流全部是 0', false, '第 ' + c.i + ' 組 t=' + t);
      if (b2 && !Object.values(f).every((v) => typeof v === 'number' && isFinite(v))) b2 = check('過了「算到幾歲」：每個欄位仍然是數字（原型抓到的 NaN 問題）', false, '第 ' + c.i + ' 組 t=' + t);
    }
    rule('過了「算到幾歲」：這個人的現金流全部是 0', () => b1); rule('過了「算到幾歲」：每個欄位仍然是數字（原型抓到的 NaN 問題）', () => b2);
  });
});

/* ===== 二、單人＝只有一個人的家 ===== */
cases.forEach((c) => {
  const B0 = c.en.W(c.inp.asset);
  c.Rs.forEach((R) => {
    const ev = c.en.evalR(c.P, R), hh = S.household([{ en: c.en, P: c.P, Q: ev.Q }], { en: c.en, P: c.P }, B0);
    if (Math.abs(ev.gap) > 1) rule('家庭組合器的「夠不夠」跟 evalR 一致（一個人的家）', () => check('家庭組合器的「夠不夠」跟 evalR 一致（一個人的家）', hh.ok === (ev.gap <= 0), '第 ' + c.i + ' 組 R=' + R + ' gap=' + ev.gap + ' ok=' + hh.ok));
    rule('家庭組合器預設算到這個人的「算到幾歲」', () => check('家庭組合器預設算到這個人的「算到幾歲」', hh.H === c.P.tE, '第 ' + c.i + ' 組'));
  });
  if (c.e !== null) {
    const ev = c.en.evalR(c.P, c.e), hh = S.household([{ en: c.en, P: c.P, Q: ev.Q }], { en: c.en, P: c.P }, B0);
    rule('最快退休那個月：家庭組合器判斷「夠」', () => check('最快退休那個月：家庭組合器判斷「夠」', hh.ok || Math.abs(ev.gap) <= 1, '第 ' + c.i + ' 組 e=' + c.e));
    const R1 = c.e - 1 / 12;
    if (R1 >= c.nowAge + 1 / 12 - 1e-9) {
      const ev1 = c.en.evalR(c.P, R1), h1 = S.household([{ en: c.en, P: c.P, Q: ev1.Q }], { en: c.en, P: c.P }, B0);
      rule('最快退休的前一個月：家庭組合器判斷「不夠」', () => check('最快退休的前一個月：家庭組合器判斷「不夠」', !h1.ok || Math.abs(ev1.gap) <= 1, '第 ' + c.i + ' 組 e=' + c.e));
    }
  }
});

/* ===== 三、保險接續與重疊（每個人、每個月） ===== */
const RULES = [
  ['有薪水的月份不繳國保', (f) => !(f.work > 0 && f.npPrem > 0)],
  ['有薪水的月份不繳健保第六類', (f) => !(f.work > 0 && f.nhiPrem > 0)],
  ['勞保月領不早於退休那個月', (f, t, Q) => !(f.li > 0 && !(Q.liLump && t === Q.liT) && t < Q.tR)],
  ['勞保月領從請領那個月開始，金額固定', (f, t, Q) => !(Q.liMonthly > 0) || (t < Q.liT ? f.li === 0 : f.li === Q.liMonthly)],
  ['勞退月領不早於 60 歲，也不早於退休', (f, t, Q, c) => !(f.ls > 0 && !(Q.lsLump && t === Q.lsT)) || (t >= Q.lsT && t >= Q.tR && t >= c.en.tOfAge(60))],
  ['勞退月領在領完的那個月停止', (f, t, Q) => !(Q.lsMonthly > 0 && t >= Q.lsEndT) || f.ls === 0],
  ['國保保費只在退休後、65 歲或開始領勞保之前', (f, t, Q, c) => !(f.npPrem > 0) || (t >= c.P.gap0 && t < c.P.gap1 && t < Q.tR) || (t >= Q.tR && t < Q.npEndT)],
  ['國保停繳點不晚於 65 歲，也不晚於開始領勞保', (f, t, Q, c) => Q.npEndT <= c.en.tOfAge(65) && Q.npEndT <= Q.liT],
  ['國保年金只在 65 歲以後', (f, t, Q) => !(f.np > 0) || t >= Q.np65T],
  ['有國保年金就一定繳過國保', (f, t, Q) => !(f.np > 0) || Q.npMonths > 0],
  ['健保第六類只在收入中斷或退休後', (f, t, Q, c) => !(f.nhiPrem > 0) || t >= Q.tR || (t >= c.P.gap0 && t < c.P.gap1)],
  ['依附眷屬投保的人，退休後不繳健保第六類', (f, t, Q, c) => !(c.P.nhiDep && t >= Q.tR) || f.nhiPrem === 0],
  ['收入中斷的月份沒有薪水', (f, t, Q, c) => !(t >= c.P.gap0 && t < c.P.gap1 && t < Q.tR) || f.work === 0],
  ['收入中斷的月份要自己繳國保', (f, t, Q, c) => !(t >= c.P.gap0 && t < c.P.gap1 && t < Q.tR) || f.npPrem > 0],
  ['勞退舊制一次金只在退休那個月', (f, t, Q) => !(f.old > 0) || t === Q.tR],
  ['每一項收支都不是負數', (f) => PF.every((k) => f[k] >= 0)]
];
cases.forEach((c) => {
  c.Rs.forEach((R) => {
    const Q = c.en.pensions(c.P, R), state = {};
    let liLumpN = 0, lsLumpN = 0, oldN = 0;
    for (let t = 0; t < c.P.tE; t++) {
      const f = c.en.personFlowsM(c.P, Q, t);
      RULES.forEach(([name, fn]) => { if (state[name] === false) return; if (!fn(f, t, Q, c)) state[name] = check(name, false, '第 ' + c.i + ' 組 R=' + R + ' t=' + t + ' ' + JSON.stringify(f)); });
      if (Q.liLump && t === Q.liT) liLumpN++; if (Q.lsLump && t === Q.lsT && f.ls === Q.lsLump) lsLumpN++; if (f.old > 0) oldN++;
    }
    RULES.forEach(([name]) => rule(name, () => state[name] !== false));
    rule('勞保一次領（一次請領、老年一次金）最多一次，且領了就沒有勞保月領', () => check('勞保一次領（一次請領、老年一次金）最多一次，且領了就沒有勞保月領', liLumpN <= 1 && (!Q.liLump || Q.liMonthly === 0), '第 ' + c.i + ' 組 R=' + R));
    rule('勞退一次領最多一次，且一次領跟月領只會有一種', () => check('勞退一次領最多一次，且一次領跟月領只會有一種', lsLumpN <= 1 && !(Q.lsLump && Q.lsMonthly), '第 ' + c.i + ' 組 R=' + R));
    rule('勞退舊制一次金最多一次', () => check('勞退舊制一次金最多一次', oldN <= 1, '第 ' + c.i + ' 組 R=' + R));
    rule('勞退請領年齡＝ 60 歲與退休年齡取晚', () => check('勞退請領年齡＝ 60 歲與退休年齡取晚', Q.lsT === c.en.tOfAge(Math.max(60, R)), '第 ' + c.i + ' 組 R=' + R + ' lsT=' + Q.lsT));
    rule('勞保請領不早於退休（要先退保）', () => check('勞保請領不早於退休（要先退保）', Q.liT >= Q.tR, '第 ' + c.i + ' 組 R=' + R));
  });
  /* 收入中斷一年：勞保年資少一年、勞退提繳少一年（退休時間在中斷結束之後） */
  const Pg = c.en.profile({ gap: 1 }), R = 65;
  if (Pg.gap1 > Pg.gap0 && c.en.tOfAge(R) > Pg.gap1) {
    const Q0 = c.en.pensions(c.P, R), Q1 = c.en.pensions(Pg, R);
    rule('收入中斷一年：勞保年資剛好少一年', () => check('收入中斷一年：勞保年資剛好少一年', close(Q0.liYears - Q1.liYears, 1), '第 ' + c.i + ' 組 ' + Q0.liYears + ' → ' + Q1.liYears));
    rule('收入中斷一年：勞退提繳年資剛好少一年、專戶不會變多', () => check('收入中斷一年：勞退提繳年資剛好少一年、專戶不會變多', close(Q0.lsYears - Q1.lsYears, 1) && Q1.lsBal <= Q0.lsBal + EPS, '第 ' + c.i + ' 組'));
  }
});

/* ===== 四、時間軸 ===== */
cases.forEach((c) => {
  c.Rs.forEach((R) => {
    const Q = c.en.pensions(c.P, R), tl = c.en.timeline(c.P, Q), seg = tl.segments;
    rule('時間軸：區段從第 0 個月開始、連續不重疊、到「算到幾歲」為止', () => check('時間軸：區段從第 0 個月開始、連續不重疊、到「算到幾歲」為止',
      seg.length > 0 && seg[0].s === 0 && seg[seg.length - 1].e === c.P.tE && seg.every((x, k) => x.e > x.s && (k === 0 || x.s === seg[k - 1].e) && (k === 0 || x.state !== seg[k - 1].state)), '第 ' + c.i + ' 組 R=' + R + ' ' + JSON.stringify(seg)));
    rule('時間軸：退休前只有「工作中」或「收入中斷」，退休後不會再出現', () => check('時間軸：退休前只有「工作中」或「收入中斷」，退休後不會再出現',
      seg.every((x) => (x.e <= Q.tR) === (x.state === 'work' || x.state === 'gap')), '第 ' + c.i + ' 組 R=' + R + ' ' + JSON.stringify(seg)));
    let okP = true;
    seg.forEach((x) => { for (let t = x.s; t < x.e && okP; t++) {
      const f = c.en.personFlowsM(c.P, Q, t), monthly = (f.li > 0 && !(Q.liLump && t === Q.liT)) || (f.ls > 0 && !(Q.lsLump && t === Q.lsT)) || f.np > 0;
      if (x.state === 'pension' && !monthly) okP = check('時間軸：「有年金」的月份一定有月領年金，退休後有月領的月份一定是「有年金」', false, '第 ' + c.i + ' 組 t=' + t + ' 標成有年金但沒有月領');
      if (x.state === 'retired' && monthly) okP = check('時間軸：「有年金」的月份一定有月領年金，退休後有月領的月份一定是「有年金」', false, '第 ' + c.i + ' 組 t=' + t + ' 有月領卻標成已退休');
    } });
    rule('時間軸：「有年金」的月份一定有月領年金，退休後有月領的月份一定是「有年金」', () => okP);
    const lumpOk = tl.lumps.every((l) => { const f = c.en.personFlowsM(c.P, Q, l.t); return (l.li === 0 || f.li === l.li) && (l.ls === 0 || f.ls === l.ls) && f.old === l.old; });
    rule('時間軸：一次領的月份與金額跟現金流相同', () => check('時間軸：一次領的月份與金額跟現金流相同', lumpOk, '第 ' + c.i + ' 組 R=' + R));
  });
});

/* ===== 五、家庭組合器的掛勾（夫妻模式要用） ===== */
cases.slice(0, 200).forEach((c) => {
  const R = c.Rs[c.Rs.length - 1], Q = c.en.pensions(c.P, R), B0 = c.en.W(c.inp.asset), m = [{ en: c.en, P: c.P, Q }], home = { en: c.en, P: c.P };
  const h0 = S.household(m, home, B0), h1 = S.household(m, home, B0, { livingFactor: () => 1 }), h7 = S.household(m, home, B0, { livingFactor: (t) => (t >= 120 ? 0.7 : 1) });
  rule('生活費倍數 1：跟不設定完全相同', () => check('生活費倍數 1：跟不設定完全相同', h0.end === h1.end && h0.ok === h1.ok, '第 ' + c.i + ' 組'));
  rule('生活費降到七成：最後的存款不會變少、原本夠的還是夠', () => check('生活費降到七成：最後的存款不會變少、原本夠的還是夠', h7.end >= h0.end - EPS && (!h0.ok || h7.ok), '第 ' + c.i + ' 組 ' + h0.end + ' → ' + h7.end));
  const hw = S.household(m, home, B0, { premiumWaive: () => true }), paid = Array.from({ length: c.P.tE }, (_, t) => c.en.personFlowsM(c.P, Q, t).nhiPrem).some((v) => v > 0);
  rule('免繳健保第六類：存款不會變少；有繳過的話一定變多', () => check('免繳健保第六類：存款不會變少；有繳過的話一定變多', hw.end >= h0.end - EPS && (!paid || hw.end > h0.end), '第 ' + c.i + ' 組'));
  /* 兩個人：另一半用「只算這個人」的模式，收入為正 → 存款不會比一個人少；成員順序不影響結果 */
  const d = cases[(c.i * 7 + 3) % cases.length], pen = S.create(d.inp, { now: NOW, role: 'person' }); pen.sync();
  const PP = pen.profile(), QP = pen.pensions(PP, Math.max(d.nowAge + 1 / 12, 65 - (65 - d.nowAge) / 2));
  const two = S.household([m[0], { en: pen, P: PP, Q: QP }], home, B0), owt = S.household([{ en: pen, P: PP, Q: QP }, m[0]], home, B0);
  rule('兩個人：成員順序對調，結果完全相同', () => check('兩個人：成員順序對調，結果完全相同', close(two.end, owt.end) && two.ok === owt.ok && two.H === owt.H, '第 ' + c.i + ' 組'));
  rule('兩個人：預設算到較晚的那位的「算到幾歲」', () => check('兩個人：預設算到較晚的那位的「算到幾歲」', two.H === Math.max(c.P.tE, PP.tE), '第 ' + c.i + ' 組'));
  const one = S.household(m, home, B0, { H: two.H });
  rule('兩個人：開始檢查存款的月份＝成員中最早退休的那個月', () => check('兩個人：開始檢查存款的月份＝成員中最早退休的那個月', two.tR0 === Math.min(Q.tR, QP.tR), '第 ' + c.i + ' 組'));
  /* 多一個人不一定比較好：另一半如果比較早退休，從他退休那個月就開始檢查存款（家裡少了一份薪水，存款不能再是負的），
     退休後還要自己繳國保健保。只有「另一半每個月淨流量都不是負的、也不比你早退休」時，才保證不會變差 */
  const harmless = QP.tR >= Q.tR && Array.from({ length: two.H }, (_, t) => pen.personFlowsM(PP, QP, t).net).every((v) => v >= 0);
  if (harmless) rule('兩個人：另一半每個月淨流量都不是負的、也不比你早退休 → 夠的不會變成不夠', () => check('兩個人：另一半每個月淨流量都不是負的、也不比你早退休 → 夠的不會變成不夠', !one.ok || two.ok, '第 ' + c.i + ' 組'));
  if (QP.tR < Q.tR && one.ok && !two.ok) rule('兩個人：另一半先退休時，從他退休那個月起存款不能是負的（記錄這種情況確實會發生）', () => two.firstNeg >= QP.tR);
});

console.log('\n■ 引擎拆層與保險接續（' + cases.length + ' 組有效條件 × 數個退休年齡 × 每一個月）');
Object.keys(counts).forEach((k) => {
  const x = counts[k];
  if (x.f === 0) { ok++; console.log('  ✓ ' + k + '（' + x.n + ' 次）'); }
  else { bad++; console.log('  ✗ ' + k + '（' + x.f + ' / ' + x.n + ' 次失敗）'); (fails[k] || []).forEach((d) => console.log('      ' + d)); }
});
console.log('\n' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
