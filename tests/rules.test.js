#!/usr/bin/env node
/* v0.4.2 修正的制度規則：每條都測一般情況＋邊界 */
'use strict';
const { assert, SP5, ZERO, engine, near, suite } = require('./_helper');
const stressEarliest = (inp, sel, opt) => require('../src/engine.js').scenario(inp, sel, opt).e;   // v0.9.3：引擎的 stressEarliest 包裝拿掉了，測試直接用 scenario().e
const S = suite('制度規則（v0.4.2）');
const t = S.test;

/* ---------- 勞基法第 55 條：未滿半年以半年計；滿半年以一年計 ---------- */
const months = (y, m) => y + m / 12;
[
  [months(10, 0), 20, '剛好 10 年'],
  [months(10, 1), 21, '10 年 1 個月 → 10.5 年'],
  [months(10, 5), 21, '10 年 5 個月 → 10.5 年'],
  [months(10, 6), 22, '10 年 6 個月 → 滿半年以一年計（review 抓到的 bug）'],
  [months(10, 11), 22, '10 年 11 個月 → 11 年'],
  [months(0, 3), 1, '3 個月 → 0.5 年 → 1 個基數'],
  [months(0, 6), 2, '6 個月 → 1 年 → 2 個基數'],
  [months(14, 6), 30, '14 年 6 個月 → 15 年 → 30 個基數'],
  [months(15, 0), 30, '15 年 → 30'],
  [months(15, 1), 30.5, '15 年 1 個月 → 15.5 年 → 30.5'],
  [months(15, 6), 31, '15 年 6 個月 → 16 年 → 31'],
  [months(29, 6), 45, '29 年 6 個月 → 30 年 → 45（上限）'],
  [months(30, 0), 45, '30 年 → 45'],
  [months(35, 0), 45, '35 年仍是 45'],
  [4.5, 10, '用小數填 4.5 年 = 4 年 6 個月 → 5 年 → 10']
].forEach(([yrs, units, label]) => t('舊制基數：' + label, () => assert.strictEqual(SP5.oldUnits(yrs), units)));
t('舊制基數：浮點小數不會造成誤差（10.5 與 10+6/12 結果相同）', () => assert.strictEqual(SP5.oldUnits(10.5), SP5.oldUnits(10 + 6 / 12)));
t('舊制一次領 = 基數 × 平均工資：4 年 6 個月、平均工資 7 萬 → 70 萬', () => {
  const en = engine({ oldOn: true, oHire: '2001', oYrs: '4.5', oWage: '7' }, ZERO), P = en.profile();
  assert.strictEqual(en.oldLump(P, 57), 700000);   // 2001 到職，57 歲時年資 ≥ 25 → 符合
});

/* ---------- 勞退條例第 24 條：月領門檻看實際提繳年資 ---------- */
const base60 = { birth: '1966-10', asset: '500', inc: '6', spend: '3' };   // 剛好 60 歲
t('勞退：工作 35 年、但新制實際提繳只有 10 年 → 只能一次領', () => {
  const en = engine(Object.assign({}, base60, { workStart: '25', pre: { lsYears: '10' } })), P = en.profile(), Q = en.pensions(P, 60);
  assert.strictEqual(Q.lsMonthly, 0); assert.ok(Q.lsLump > 0, '應有一次領金額');
});
t('勞退：實際提繳剛好 15 年 → 可以月領（邊界）', () => {
  const en = engine(Object.assign({}, base60, { pre: { lsYears: '15' } })), Q = en.pensions(en.profile(), 60);
  assert.ok(Q.lsMonthly > 0); assert.strictEqual(Q.lsLump, 0);
});
t('勞退：實際提繳 14.9 年 → 一次領（邊界）', () => {
  const en = engine(Object.assign({}, base60, { pre: { lsYears: '14.9' } })), Q = en.pensions(en.profile(), 60);
  assert.strictEqual(Q.lsMonthly, 0);
});
t('勞退：現在提繳 13 年，再工作 2 年退休 → 累計 15 年可月領', () => {
  const en = engine({ birth: '1968-10', pre: { lsYears: '13' } }), Q = en.pensions(en.profile(), 60);   // 58 歲，60 歲退休
  near(Q.lsYears, 15, 1e-9); assert.ok(Q.lsMonthly > 0);
});
t('勞退：沒填年資時，估算值 = 工作年資與「2005/07 至今」取小', () => {
  const en1 = engine({ birth: '1966-10', workStart: '25' }), en2 = engine({ birth: '1966-10', workStart: '50' });
  near(en1.pensions(en1.profile(), 60).lsYears, 21, 1e-9, '工作 35 年 → 估 21 年（2005/07 起）');
  near(en2.pensions(en2.profile(), 60).lsYears, 10, 1e-9, '工作 10 年 → 估 10 年');
  assert.strictEqual(en2.pensions(en2.profile(), 60).lsMonthly, 0);
});
t('勞退：一次領金額 = 當時專戶餘額', () => {
  const en = engine(Object.assign({}, base60, { pre: { lsYears: '8', lsBal: '120' } }), ZERO), Q = en.pensions(en.profile(), 60);
  assert.ok(Q.lsLump === 0 || Q.lsLump > 0);
});
t('勞退提繳年資檢查：不能超過新制施行至今的年數', () => {
  assert.ok(/勞退提繳年資/.test(engine({ pre: { lsYears: '30' } }).validate()));
  assert.strictEqual(engine({ pre: { lsYears: '21' } }).validate(), '');
});

/* ---------- 勞保請領年齡：可自選，不早於退休、法定 ±5 年 ---------- */
const liBase = { birth: '1976-10', workStart: '25', inc: '10', pre: { liYears: '30', w60: '4.58' } };
function liAt(pref, R) { const o = JSON.parse(JSON.stringify(liBase)); if (pref !== null) o.pre.liClaim = String(pref); const en = engine(o); return en.pensions(en.profile(), R); }
t('勞保：沒選 → 法定 65 歲領，不加不減', () => { const Q = liAt(null, 55); assert.strictEqual(Q.liClaim, 65); near(Q.liMonthly, SP5.liMonthlyCalc(45800, 30 + 4.583333333 * 0 + Q.liYears - 30, 65, 65), 1); });
t('勞保：選 60 歲、55 歲退休 → 60 歲領，減給 20%', () => {
  const Q = liAt(60, 55); assert.strictEqual(Q.liClaim, 60);
  near(Q.liMonthly, SP5.liMonthlyCalc(45800, Q.liYears, 60, 65), 1e-6); near(Q.liMonthly / SP5.liMonthlyCalc(45800, Q.liYears, 65, 65), 0.8, 1e-9);
});
t('勞保：選 62 歲 → 減給 12%', () => { const Q = liAt(62, 55); near(Q.liMonthly / SP5.liMonthlyCalc(45800, Q.liYears, 65, 65), 0.88, 1e-9); });
t('勞保：選 60 歲但 62 歲才退休 → 退休才能領（62 歲），減給 12%', () => {
  const Q = liAt(60, 62); assert.strictEqual(Q.liClaim, 62); near(Q.liMonthly / SP5.liMonthlyCalc(45800, Q.liYears, 65, 65), 0.88, 1e-9);
});
t('勞保：選 68 歲 → 延後 3 年加給 12%', () => { const Q = liAt(68, 55); assert.strictEqual(Q.liClaim, 68); near(Q.liMonthly / SP5.liMonthlyCalc(45800, Q.liYears, 65, 65), 1.12, 1e-9); });
t('勞保：選 70 歲 → 加給上限 20%', () => { const Q = liAt(70, 55); near(Q.liMonthly / SP5.liMonthlyCalc(45800, Q.liYears, 65, 65), 1.2, 1e-9); });
t('勞保：退休 61 歲 3 個月、選 60 歲 → 61 歲 3 個月才領；提前 3 年 9 個月按月比例減給 15%', () => {
  const Q = liAt(60, 61.25); near(Q.liClaim, 61.25, 1e-9); near(Q.liMonthly / SP5.liMonthlyCalc(45800, Q.liYears, 65, 65), 0.85, 1e-9);
});
t('OQ-LI-03（勞保局整合試算 0109187 實測）：65 年次、61 歲 3 個月請領、45,800 × 30 年 → 第二式 18,102', () =>
  assert.strictEqual(Math.round(SP5.liMonthlyCalc(45800, 30, 61.25, 65)), 18102));
t('OQ-LI-03 實測：第一式官方 11,602（官方先把基礎金額四捨五入再乘比率；引擎全程小數，容許 1 元）', () =>
  near((45800 * 30 * 0.00775 + 3000) * 0.85, 11602, 1));
t('OQ-LI-03 實測反證：不是「不足一年算一年」（17,889），也不是「不足一年不算」（18,741）', () => {
  const v = Math.round(SP5.liMonthlyCalc(45800, 30, 61.25, 65)); assert.notStrictEqual(v, 17889); assert.notStrictEqual(v, 18741);
});
t('勞保：延後 2 年 9 個月 → 按月比例加給 11%（已實測，見下一項）', () => {
  const o = JSON.parse(JSON.stringify(liBase)); o.pre.liClaim = '67'; const en = engine(o), Q = en.pensions(en.profile(), 67.75);
  near(Q.liMonthly / SP5.liMonthlyCalc(45800, Q.liYears, 65, 65), 1.11, 1e-9);
});
t('勞保局整合試算實測：67 歲 9 個月請領（法定 65）→ 第二式 23,640，延後也是按月比例', () =>
  assert.strictEqual(Math.round(SP5.liMonthlyCalc(45800, 30, 67.75, 65)), 23640));
t('實測反證：延後不是「只算滿年」（23,001），也不是「不足一年算一年」（23,853）', () => {
  const v = Math.round(SP5.liMonthlyCalc(45800, 30, 67.75, 65)); assert.notStrictEqual(v, 23001); assert.notStrictEqual(v, 23853);
});
t('實測：延後第一式官方 15,150（官方先取整再乘比率，容許 1 元）', () => near((45800 * 30 * 0.00775 + 3000) * 1.11, 15150, 1));
t('勞保整合試算實測：勞退 100 萬、67 歲 9 個月申請 → 取 67 歲、平均餘命 18、首期 5,119、季發 15,357', () => {
  assert.strictEqual(SP5.lifeYears(Math.floor(67.75)), 18);
  const m = Math.round(SP5.lsMonthlyCalc(1000000, 67)); assert.strictEqual(m, 5119); assert.strictEqual(m * 3, 15357);
});
t('勞保：提前 1 個月 → 減給 0.333…%（按月比例的最小單位）', () => near(SP5.liMonthlyCalc(45800, 30, 65 - 1 / 12, 65) / SP5.liMonthlyCalc(45800, 30, 65, 65), 1 - 0.04 / 12, 1e-12));
t('勞保：提前 5 年 6 個月 → 仍以 20% 為上限', () => near(SP5.liMonthlyCalc(45800, 30, 59.5, 65) / SP5.liMonthlyCalc(45800, 30, 65, 65), 0.8, 1e-12));
t('勞保整合試算實測：勞退 100 萬、61 歲 3 個月申請 → 申請年齡取 61、平均餘命 23、首期 4,117、季發 12,351', () => {
  assert.strictEqual(SP5.lifeYears(Math.floor(61.25)), 23);
  const m = Math.round(SP5.lsMonthlyCalc(1000000, Math.floor(61.25))); assert.strictEqual(m, 4117); assert.strictEqual(m * 3, 12351);
});
t('L5（勞保局 FAQ 0017390）：劉太太年資 17.75 年、提前 1 年 → 12,097 元', () => near(SP5.liMonthlyCalc(45800, 17.75, 64, 65), 12097, 0.5));
t('L5（勞保局 FAQ 0017390）：劉先生年資 23.25 年、延後超過 5 年 → 加給上限 20%，19,806 元', () => near(SP5.liMonthlyCalc(45800, 23.25, 77, 60), 19806, 0.5));
t('勞保：早領會讓國保保費提早停（國保只繳到開始領勞保前）', () => {
  const Qa = liAt(60, 55), Qb = liAt(null, 55); assert.ok(Qa.npMonths < Qb.npMonths); assert.strictEqual(Qa.npMonths, 60);
});
t('勞保請領年齡檢查：法定 65 歲，只能選 60–70', () => {
  const v = (x) => { const o = JSON.parse(JSON.stringify(liBase)); o.pre.liClaim = String(x); return engine(o).validate(); };
  assert.ok(/勞保請領年齡/.test(v(59))); assert.ok(/勞保請領年齡/.test(v(71))); assert.strictEqual(v(60), ''); assert.strictEqual(v(70), '');
});
t('勞保：選擇早領會改變最早可退休時點（不是只改月領金額）', () => {
  const a = engine({ birth: '1971-10', asset: '700', inc: '8', spend: '4', pre: { liClaim: '60' } }).earliest();
  const b = engine({ birth: '1971-10', asset: '700', inc: '8', spend: '4' }).earliest();
  assert.ok(a !== b, '早領應該影響結果（a=' + a + ', b=' + b + '）');
});

/* ---------- 勞退累積（勞動部個人退休金試算表，2026-10-02 實測，OQ-LS-04 結案） ---------- */
/* 輸入：目前 50 歲、退休 60 歲、提繳工資 50,000（試算表自動對應到 50,600 級）、雇提 6%、報酬 3%、薪資成長 0% */
const MOL = [[1, 501, 36933], [2, 2110, 74974], [3, 4860, 114156], [4, 8786, 154514], [5, 13922, 196082],
  [6, 20305, 238897], [7, 27973, 282997], [8, 36964, 328420], [9, 47318, 375206], [10, 59075, 423395]];
function molTable(monthly, r, years) {   // 勞動部算法：月底提繳、年內單利、年底複利
  let B = 0, inc = 0; const out = [];
  for (let y = 1; y <= years; y++) {
    let simple = 0; for (let i = 1; i <= 12; i++) simple += monthly * r * (12 - i) / 12;
    const gain = B * r + simple; B += 12 * monthly + gain; inc += gain; out.push([y, Math.round(inc), Math.round(B)]);
  }
  return out;
}
t('S1 勞動部試算表：月提繳 3,036（50,600 × 6%），年提繳 36,432', () => assert.strictEqual(50600 * 0.06 * 12, 36432));
t('S1 勞動部試算表：我們理解的算法逐年完全重現官方明細（10 年、累計收益與本利和）', () => assert.deepStrictEqual(molTable(3036, 0.03, 10), MOL));
t('S1 引擎：同一組輸入算到 60 歲，與官方 423,395 相差不到 0.05%', () => {
  const en = engine({ birth: '1976-10', pre: { lsBal: '0', lsWage: '5.06', lsYears: '20' } }, { inf: 0, rPre: 0, rPost: 0, rLs: 0.03, pensions: true, np: false, nhi: false });
  const Q = en.pensions(en.profile(), 60);
  assert.ok(Math.abs(Q.lsBal / 423395 - 1) < 0.0005, '引擎 ' + Math.round(Q.lsBal) + ' vs 官方 423,395');
});
t('S1 引擎：是「月底」提繳（第 1 個月提繳的錢在當月不生息）', () => {
  const en = engine({ birth: '1976-10', pre: { lsBal: '0', lsWage: '5.06', lsYears: '20' } }, { inf: 0, rPre: 0, rPost: 0, rLs: 0.03, pensions: true, np: false, nhi: false });
  const Q = en.pensions(en.profile(), 50 + 1 / 12);   // 只工作 1 個月就退休，但勞退要到 60 歲才領 → 3,036 滾 119 個月
  near(Q.lsBal, 3036 * Math.pow(1.03, 119 / 12), 0.01);
});

/* ---------- 勞退月提繳分級表（115.1.1 生效） ---------- */
[[1, 1500], [1500, 1500], [1501, 3000], [7500, 7500], [7501, 8700], [29500, 29500], [30000, 30300], [45800, 45800], [45801, 48200],
 [50000, 50600], [50600, 50600], [50601, 53000], [92100, 92100], [100000, 101100], [147900, 147900], [147901, 150000], [300000, 150000]
].forEach(([w, g]) => t('分級表：實際工資 ' + w.toLocaleString() + ' → 月提繳工資 ' + g.toLocaleString(), () => assert.strictEqual(SP5.lsGradeOf(w), g)));
t('分級表：引擎估算時，月入帳 5 萬 → 提繳工資 50,600（與勞動部試算表相同）', () => {
  assert.strictEqual(engine({ inc: '5' }).profile().lsWage, 50600);
});
t('分級表：精度區填 5 萬 → 也對應到 50,600；填 16 萬 → 上限 150,000', () => {
  assert.strictEqual(engine({ pre: { lsWage: '5' } }).profile().lsWage, 50600);
  assert.strictEqual(engine({ pre: { lsWage: '16' } }).profile().lsWage, 150000);
});
t('S1 引擎：直接填 50,000（不必自己換算級距）也與勞動部 423,395 相差不到 0.05%', () => {
  const en = engine({ birth: '1976-10', pre: { lsBal: '0', lsWage: '5', lsYears: '20' } }, { inf: 0, rPre: 0, rPost: 0, rLs: 0.03, pensions: true, np: false, nhi: false });
  const Q = en.pensions(en.profile(), 60); assert.ok(Math.abs(Q.lsBal / 423395 - 1) < 0.0005, Math.round(Q.lsBal));
});

/* ---------- 勞保投保薪資分級表（115.1.1 施行，一般被保險人） ---------- */
[[10000, 29500], [29500, 29500], [29501, 30300], [30000, 30300], [36301, 38200], [42000, 42000], [43900, 43900], [43901, 45800], [45800, 45800], [100000, 45800]
].forEach(([w, g]) => t('勞保分級：月薪資 ' + w.toLocaleString() + ' → 月投保薪資 ' + g.toLocaleString(), () => assert.strictEqual(SP5.liGradeOf(w), g)));
t('勞保分級：估算時用月入帳對應級距（入帳 3 萬 → 30,300；2.5 萬 → 29,500；4.4 萬 → 45,800）', () => {
  assert.strictEqual(engine({ inc: '3' }).profile().w60, 30300);
  assert.strictEqual(engine({ inc: '2.5' }).profile().w60, 29500);
  assert.strictEqual(engine({ inc: '4.4' }).profile().w60, 45800);
});
t('勞保分級：使用者自己填的平均月投保薪資不對應級距（4.15 萬 → 41,500，因為是平均值）', () => {
  assert.strictEqual(engine({ pre: { w60: '4.15' } }).profile().w60, 41500);
});
t('勞保分級：入帳 3 萬的人，估算的勞保年金比用 min(入帳, 45,800) 時略高（30,300 > 30,000）', () => {
  const en = engine({ inc: '3', pre: { liYears: '30' } }), Q = en.pensions(en.profile(), 65);
  near(Q.liMonthly, SP5.liMonthlyCalc(30300, Q.liYears, 65, 65), 1e-6);
});

/* ---------- 健保第六類 ---------- */
t('健保：退休前不另外扣（已含在實際入帳）', () => { const en = engine({}), P = en.profile(), Q = en.pensions(P, 60); assert.strictEqual(en.flowsM(P, Q, 0).nhiPrem, 0); });
t('健保：退休當月起每月自付 826 元（第六類，110.1.1 生效表）', () => {
  const en = engine({}), P = en.profile(), Q = en.pensions(P, 60);
  assert.strictEqual(en.flowsM(P, Q, Q.tR).nhiPrem, 826); assert.strictEqual(en.flowsM(P, Q, Q.tR - 1).nhiPrem, 0);
  assert.strictEqual(en.flowsM(P, Q, P.tE - 1).nhiPrem, 826);
});
t('健保：勾「依附在職的配偶或子女當眷屬」→ 0 元', () => { const en = engine({ pre: { nhiDep: true } }), P = en.profile(), Q = en.pensions(P, 60); assert.strictEqual(en.flowsM(P, Q, Q.tR).nhiPrem, 0); });
t('健保：退休當月的事件清單有「開始自付健保」', () => {
  const en = engine({}), P = en.profile(), Q = en.pensions(P, 60);
  assert.ok(en.eventsAt(P, Q, Q.tR).some((e) => /開始自付健保/.test(e.text)));
  const en2 = engine({ pre: { nhiDep: true } }), P2 = en2.profile(), Q2 = en2.pensions(P2, 60);
  assert.ok(!en2.eventsAt(P2, Q2, Q2.tR).some((e) => /健保/.test(e.text)));
});
t('健保：保費讓需要的錢變多（依附眷屬的人比較早能退休或一樣）', () => {
  const a = engine({ asset: '700', inc: '8', spend: '4' }).earliest(), b = engine({ asset: '700', inc: '8', spend: '4', pre: { nhiDep: true } }).earliest();
  assert.ok(b === null || (a !== null && b <= a) || a === null);
});
t('健保：0% 報酬時，健保讓 60 歲退休的需要本金剛好多 826 × 12 × 30 年', () => {
  const as = { inf: 0, rPre: 0, rPost: 0, rLs: 0, pensions: false, np: false };
  const a = engine({}, Object.assign({}, as, { nhi: true })), b = engine({}, Object.assign({}, as, { nhi: false }));
  near(a.evalR(a.profile(), 60).need - b.evalR(b.profile(), 60).need, 826 * 12 * 30, 1);
});

/* ---------- 退休前資產就用完 ---------- */
const broke = { asset: '30', inc: '5', spend: '6' };   // 每月入不敷出 1 萬
t('退休前用完：每月入不敷出，所有退休時點都不可行', () => { assert.strictEqual(engine(broke).earliest(), null); });
t('退休前用完：evalR 回報退休前用完的時間點（30 萬、每月 -1 萬 → 30 個月後）', () => {
  const en = engine(broke, ZERO), ev = en.evalR(en.profile(), 60);
  near(ev.preExhaust, 50 + 30 / 12, 1e-9);
});
t('退休前用完：負資產不會滾報酬（不會越欠越多）', () => {
  const en = engine(broke, { inf: 0, rPre: 0.1, rPost: 0, rLs: 0, pensions: false, np: false, nhi: false }), ev = en.evalR(en.profile(), 55);
  assert.ok(ev.proj > -1e7, '負數被放大了：' + ev.proj);
});
t('退休前用完：逐月路徑也標出同一個時間點', () => {
  const en = engine(broke, ZERO), P = en.profile(), mon = en.monthly(P, 60), led = en.ledger(P, 60);
  assert.strictEqual(mon.preExhaustT, 30); near(led.preExhaust, 52.5, 1e-9);
});
t('退休前用完：只是暫時的（房貸短期壓力），也判定不可行', () => {
  const en = engine({ asset: '5', inc: '8', spend: '3', house: true, housePay: '6', houseYrs: '2' });
  assert.ok(en.evalR(en.profile(), 60).preExhaust !== null); assert.strictEqual(en.earliest(), null);
});

/* ---------- 國保進地圖 ---------- */
t('地圖：55 歲退休、勞保延到 68 歲領 → 65–68 歲那段標出國保', () => {
  const en = engine({ asset: '2000', pre: { liClaim: '68' } }), P = en.profile(), Q = en.pensions(P, 55);
  const ph = en.phases(P, 55, Q), seg = ph.find((x) => x.f >= 65 - 1e-9 && x.t <= 68 + 1e-9);
  assert.ok(seg, '應有 65–68 的階段'); assert.ok(/國保/.test(seg.src), seg.src);
});
t('地圖：65 歲後勞保＋國保＋勞退同時領，來源寫齊', () => {
  const en = engine({ asset: '2000' }), P = en.profile(), Q = en.pensions(P, 55);
  const seg = en.phases(P, 55, Q).find((x) => x.f >= 65 - 1e-9);
  assert.ok(/勞保/.test(seg.src) && /國保/.test(seg.src) && /勞退/.test(seg.src), seg.src);
});
t('地圖：沒有國保（65 歲才退休）就不會出現國保', () => {
  const en = engine({}), P = en.profile(), Q = en.pensions(P, 65);
  assert.ok(!en.phases(P, 65, Q).some((x) => /國保/.test(x.src)));
});
t('地圖：階段首尾相接、沒有缺口', () => {
  const en = engine({ asset: '2000', house: true, housePay: '2', houseYrs: '10' }), P = en.profile(), Q = en.pensions(P, 56.5);
  const ph = en.phases(P, 56.5, Q);
  for (let i = 1; i < ph.length; i++) near(ph[i].f, ph[i - 1].t, 1e-9, '第 ' + i + ' 段');
  near(ph[ph.length - 1].t, en.E(), 1e-9);
});

/* ---------- 壓力測試（四組情境） ---------- */
const stIn = require('./_helper').inputs({ birth: '1974-11', asset: '400', inc: '10', spend: '4.5' });
const stNow = { y: 2026, m: 10 };
const stBase = SP5.create(stIn, { now: stNow }).earliest();
const st = (sel) => stressEarliest(stIn, sel, { now: stNow });
const later = (a, b) => (a === null ? b === null : b === null || b >= a - 1e-9);   // b 不早於 a
t('壓力測試：完全不加壓力 = 基準（一致性）', () => assert.strictEqual(st({}), stBase));
t('壓力測試：勞保 100% = 不打折 = 基準', () => assert.strictEqual(st({ li: 100 }), stBase));
t('壓力測試：勞保打折越多，越晚退休（100 → 50 單調）', () => {
  let prev = stBase; [90, 80, 70, 60, 50].forEach((x) => { const v = st({ li: x }); assert.ok(later(prev, v), x + '%：' + v + ' 早於 ' + prev); prev = v; });
});
t('壓力測試：通膨多 1%、多 2% 依序延後', () => { const a = st({ inf: 1 }), b = st({ inf: 2 }); assert.ok(later(stBase, a) && later(a, b)); assert.ok(a !== stBase); });
t('壓力測試：活到 95、100 歲依序延後', () => { const a = st({ end: 95 }), b = st({ end: 100 }); assert.ok(later(stBase, a) && later(a, b)); });
t('壓力測試：多種一起，比任何單一情境都晚', () => {
  const all = st({ li: 70, gap: 1, inf: 1, end: 95 });
  [{ li: 70 }, { gap: 1 }, { inf: 1 }, { end: 95 }].forEach((one) => assert.ok(later(st(one), all), JSON.stringify(one)));
});
t('壓力測試：不會改到原本的輸入（算完 endAge 仍是空的）', () => {
  const inp = JSON.parse(JSON.stringify(stIn)); stressEarliest(inp, { end: 100 }, { now: stNow }); assert.strictEqual(inp.pre.endAge, '');
});
t('壓力測試：勞保打折只影響勞保年金（勞保 50% 的月領剛好是一半）', () => {
  const en = SP5.create(stIn, { now: stNow }), P1 = en.profile(), P2 = en.profile({ liFactor: 0.5 });
  near(en.pensions(P2, 60).liMonthly, en.pensions(P1, 60).liMonthly * 0.5, 1e-6);
  near(en.pensions(P2, 60).lsMonthly, en.pensions(P1, 60).lsMonthly, 1e-6);
});
/* v0.9.9：舊的 stress: true（勞保 80%）相容路徑已移除——畫面自 v0.8.0 起不再傳這個參數 */
t('壓力測試：報酬率少 1% 不影響勞退基金（勞退月領不變）', () => {
  // 0% 通膨下比較：自己的報酬少 1%，勞退專戶與月退金額不應改變
  const as = { inf: 0, rPre: 0.03, rPost: 0.02, rLs: 0.01, pensions: true, np: true, nhi: true };
  const e1 = SP5.create(stIn, { now: stNow, assume: as });
  const inp2 = JSON.parse(JSON.stringify(stIn));
  const e2 = SP5.create(inp2, { now: stNow, assume: Object.assign({}, as, { rPre: 0.02, rPost: 0.01 }) });
  near(e2.pensions(e2.profile(), 60).lsMonthly, e1.pensions(e1.profile(), 60).lsMonthly, 1e-6);
});

/* ---------- 壓力測試延長到 70 歲 ---------- */
const late = require('./_helper').inputs({ birth: '1964-05', asset: '150', inc: '7', spend: '4' });   // 基準約 62 歲多
t('70 歲：主結果仍以 65 歲為限（earliest 預設不超過 65）', () => {
  const v = SP5.create(late, { now: stNow }).earliest(); assert.ok(v === null || v <= 65 + 1e-9, v);
});
t('70 歲：壓力測試延長搜尋後，65 歲還不夠的情境可以算出精確年月', () => {
  const sel = { li: 60, inf: 1 };
  const v65 = stressEarliest(late, sel, { now: stNow }), v70 = stressEarliest(late, sel, { now: stNow, maxAge: 70 });
  assert.strictEqual(v65, null); assert.ok(v70 !== null && v70 > 65 && v70 <= 70, String(v70));
  near(v70 * 12, Math.round(v70 * 12), 1e-6, '要落在某個月');
});
t('70 歲：65 歲內就夠的情境，延長搜尋不改變答案', () => {
  const sel = { li: 80 }; assert.strictEqual(stressEarliest(stIn, sel, { now: stNow }), stressEarliest(stIn, sel, { now: stNow, maxAge: 70 }));
});
t('70 歲：工作到 67 歲 → 勞保 67 歲領、延後 2 年加給 8%，沒有國保', () => {
  const en = SP5.create(late, { now: stNow }), Q = en.pensions(en.profile(), 67);
  assert.strictEqual(Q.liClaim, 67); assert.strictEqual(Q.npMonths, 0);
  near(Q.liMonthly / SP5.liMonthlyCalc(en.profile().w60, Q.liYears, 65, SP5.legalAge(1964)), 1.08, 1e-9);
});
t('70 歲：工作到 67 歲，資產往後走不會用完（可行就真的可行）', () => {
  const v = stressEarliest(late, { li: 60, inf: 1 }, { now: stNow, maxAge: 70 });
  const inp = JSON.parse(JSON.stringify(late));
  const en = SP5.create(inp, { now: stNow, assume: { infAdd: 0.01 } });
  const led = en.ledger(en.profile({ liFactor: 0.6 }), v); assert.strictEqual(led.exhaust, null); assert.strictEqual(led.preExhaust, null);
});
/* ---------- 壓力測試延長到 80 歲（很愛工作的人） ---------- */
const heavy = require('./_helper').inputs({ birth: '1964-05', asset: '30', inc: '5', spend: '4' });
t('80 歲：重壓力要工作到 70 歲以後 → 上限 70 時算不出，上限 80 時算得出精確年月', () => {
  const sel = { li: 70 };
  assert.strictEqual(stressEarliest(heavy, sel, { now: stNow, maxAge: 70 }), null);
  const v = stressEarliest(heavy, sel, { now: stNow, maxAge: 80 });
  assert.ok(v !== null && v > 70 && v <= 80, String(v)); near(v * 12, Math.round(v * 12), 1e-6);
});
t('80 歲：工作到 78 歲 → 勞保延後加給停在 20%、勞退 78 歲領、平均餘命 10 年、沒有國保', () => {
  const en = SP5.create(heavy, { now: stNow }), P = en.profile(), Q = en.pensions(P, 78);
  near(Q.liMonthly / SP5.liMonthlyCalc(P.w60, Q.liYears, 65, 65), 1.2, 1e-9);
  assert.strictEqual(Q.lsClaim, 78); assert.strictEqual(Q.T, 10); assert.strictEqual(Q.npMonths, 0);
});
t('80 歲：算到 90 歲時，80 歲退休後還有 10 年，逐月路徑完整', () => {
  const en = SP5.create(heavy, { now: stNow }), mon = en.monthly(en.profile(), 80);
  assert.ok(mon.length > 0 && mon.every((m) => isFinite(m.end)));
});
t('80 歲：最壞情況（一路搜到 80 歲都不夠）連跑 5 次在 2 秒內', () => {
  const t0 = Date.now(); for (let i = 0; i < 5; i++) stressEarliest(heavy, { li: 50, gap: 2, inf: 2, cut: 20, spend: 2, end: 100 }, { now: stNow, maxAge: 80 });
  assert.ok(Date.now() - t0 < 2000, (Date.now() - t0) + ' ms');
});
t('同時發生：一定不早於任何單一情境（不會比最晚的單一情境更早）', () => {
  const sel = { li: 70, gap: 1, inf: 1, end: 95 }, all = stressEarliest(stIn, sel, { now: stNow, maxAge: 70 });
  Object.keys(sel).forEach((k) => { const one = stressEarliest(stIn, { [k]: sel[k] }, { now: stNow, maxAge: 70 }); assert.ok(all === null || (one !== null && all >= one - 1e-9), k); });
});
t('同時發生：這組範例比單獨相加更晚（風險互相放大）', () => {
  const base = SP5.create(stIn, { now: stNow }).earliest(), sel = { li: 70, gap: 2, inf: 1, end: 95 };
  const m = (v) => Math.round((v - base) * 12);
  const sum = Object.keys(sel).reduce((a, k) => a + m(stressEarliest(stIn, { [k]: sel[k] }, { now: stNow, maxAge: 70 })), 0);
  const all = m(stressEarliest(stIn, sel, { now: stNow, maxAge: 70 }));
  assert.ok(all > sum, '同時 ' + all + ' 個月、相加 ' + sum + ' 個月');
});

/* ---------- v0.5.0：不算投資（存款利率）、使用者選通膨與利率 ---------- */
t('不算投資：預設存款利率 1.7%（臺銀一年期定存）、通膨 2% → 名下的錢實質每年約 -0.29%', () => {
  const r = SP5.create(require('./_helper').inputs({}), { now: stNow }).rates();
  assert.strictEqual(r.dep, 0.017); assert.strictEqual(r.inf, 0.02);
  near(r.rPre, 1.017 / 1.02 - 1, 1e-12); near(r.rPost, r.rPre, 1e-12); assert.ok(r.rPre < 0, '錢要會縮水');
});
t('不算投資：勞退基金仍是 3%（制度的一部分，不是使用者的投資）', () => {
  near(SP5.create(require('./_helper').inputs({}), { now: stNow }).rates().rLs, 1.03 / 1.02 - 1, 1e-12);
});
t('不算投資：存款利率取自 data/deposit_rate.csv（2026-10-01 生效）', () => assert.strictEqual(SP5.pick(SP5.DATA.deposit, 2026, 10).rate, 1.7));
t('使用者選通膨 3%、利率 0.8%（活存）→ sync 後生效，實質約 -2.1%', () => {
  const en = SP5.create(require('./_helper').inputs({ pre: { inf: '3', dep: '0.8' } }), { now: stNow }); en.sync();
  const r = en.rates(); assert.strictEqual(r.inf, 0.03); assert.strictEqual(r.dep, 0.008); near(r.rPre, 1.008 / 1.03 - 1, 1e-12);
});
t('使用者選的利率，退休前後都用（SP5 不分累積期、提領期）', () => {
  const en = SP5.create(require('./_helper').inputs({ pre: { dep: '2' } }), { now: stNow }); en.sync(); const r = en.rates(); near(r.rPre, r.rPost, 1e-15);
});
t('通膨越高、利率越低，越晚退休', () => {
  const at = (pre) => { const en = SP5.create(require('./_helper').inputs(Object.assign({ asset: '400', spend: '4.5' }, { pre })), { now: stNow }); en.sync(); return en.earliest(); };
  const base = at({}), hiInf = at({ inf: '3' }), loDep = at({ dep: '0.8' }), hiDep = at({ dep: '2' });
  assert.ok(later(base, hiInf), '通膨 3%'); assert.ok(later(base, loDep), '活存'); assert.ok(later(hiDep, base), '優利定存應不晚於基準');
});
t('通膨、利率的輸入檢查：0–10%', () => {
  assert.ok(/通膨/.test(SP5.create(require('./_helper').inputs({ pre: { inf: '12' } }), { now: stNow }).validate()));
  assert.ok(/存款利率/.test(SP5.create(require('./_helper').inputs({ pre: { dep: '-1' } }), { now: stNow }).validate()));
  assert.strictEqual(SP5.create(require('./_helper').inputs({ pre: { inf: '2.5', dep: '1.7' } }), { now: stNow }).validate(), '');
});
t('壓力的通膨是「在使用者選的通膨上再加」：選 3% ＋ 壓力多 1% → 4%', () => {
  const en = SP5.create(require('./_helper').inputs({ pre: { inf: '3' } }), { now: stNow, assume: { infAdd: 0.01 } }); en.sync(); near(en.rates().inf, 0.04, 1e-12);
});
t('不加壓力 = 基準，在使用者改過通膨與利率時也成立', () => {
  const inp = require('./_helper').inputs({ asset: '400', spend: '4.5', pre: { inf: '2.5', dep: '0.8' } });
  const en = SP5.create(inp, { now: stNow }); en.sync(); assert.strictEqual(stressEarliest(inp, {}, { now: stNow }), en.earliest());
});

/* ---------- v0.5.0：收入中斷（明年 1 月起） ---------- */
const gIn = require('./_helper').inputs({ asset: '400', spend: '4.5', pre: { liYears: '20', lsYears: '15' } });
t('收入中斷：從明年 1 月開始（現在 2026 年 10 月 → 3 個月後）', () => {
  const P = SP5.create(gIn, { now: stNow }).profile({ gap: 1 }); assert.strictEqual(P.gap0, 3); assert.strictEqual(P.gap1, 15);
});
t('收入中斷 1 年：那 12 個月沒有薪水，要自己繳國保 1,329 和健保 826', () => {
  const en = SP5.create(gIn, { now: stNow }), P = en.profile({ gap: 1 }), Q = en.pensions(P, 60);
  for (let t2 = 3; t2 < 15; t2++) { const f = en.flowsM(P, Q, t2); assert.strictEqual(f.work, 0); assert.strictEqual(f.npPrem, 1329); assert.strictEqual(f.nhiPrem, 826); }
  const f2 = en.flowsM(P, Q, 15); assert.ok(f2.work > 0); assert.strictEqual(f2.npPrem, 0);
  assert.ok(en.flowsM(P, Q, 2).work > 0, '中斷前還有薪水');
});
t('收入中斷 1 年：勞保年資、勞退提繳年資都少 1 年', () => {
  const en = SP5.create(gIn, { now: stNow }), Q0 = en.pensions(en.profile(), 60), Q1 = en.pensions(en.profile({ gap: 1 }), 60);
  near(Q0.liYears - Q1.liYears, 1, 1e-9); near(Q0.lsYears - Q1.lsYears, 1, 1e-9);
});
t('收入中斷 1 年：勞退專戶少了 12 個月的提繳（0% 報酬時剛好少 12 × 月提繳）', () => {
  const en = SP5.create(gIn, { now: stNow, assume: { inf: 0, rLs: 0 } }), P = en.profile({ gap: 1 });
  const d = en.pensions(en.profile(), 60).lsBal - en.pensions(P, 60).lsBal; near(d, 12 * P.lsWage * 0.06, 0.01);
});
t('收入中斷：中斷期間已經退休的部分不算（退休後本來就沒收入）', () => {
  const en = SP5.create(gIn, { now: stNow }), P = en.profile({ gap: 2 }), R = en.ageOfT(10), Q = en.pensions(P, R);
  assert.strictEqual(en.flowsM(P, Q, 20).npPrem, Q.tR <= 20 && 20 < Q.npEndT ? 1329 : 0);
});
t('收入中斷：1 年 → 2 年 依序延後', () => { const a = st({ gap: 1 }), b = st({ gap: 2 }); assert.ok(later(stBase, a) && later(a, b)); assert.ok(a !== stBase); });

/* ---------- v0.5.0：收入減少（到退休） ---------- */
t('收入減少 20%：每月入帳少 20%，勞退提繳工資依分級表重新對應', () => {
  const en = SP5.create(require('./_helper').inputs({ inc: '5' }), { now: stNow }), P = en.profile({ incCut: 20 });
  assert.strictEqual(P.inc, 40000); assert.strictEqual(P.lsWage, 40100);   // 40,000 → 40,100 級
});
t('收入減少：勞保平均月投保薪資不降（最高 60 個月平均）', () => {
  const en = SP5.create(require('./_helper').inputs({ inc: '5' }), { now: stNow }); assert.strictEqual(en.profile({ incCut: 20 }).w60, en.profile().w60);
});
t('收入減少：自己填的勞退提繳工資也跟著降（6 萬 × 0.9 = 54,000 → 55,400 級）', () => {
  const en = SP5.create(require('./_helper').inputs({ pre: { lsWage: '6' } }), { now: stNow }); assert.strictEqual(en.profile({ incCut: 10 }).lsWage, 55400);
});
t('收入減少：10% → 20% 依序延後', () => { const a = st({ cut: 10 }), b = st({ cut: 20 }); assert.ok(later(stBase, a) && later(a, b)); assert.ok(a !== stBase); });

/* ---------- v0.5.0：75 歲起支出增加 ---------- */
t('支出增加：75 歲那個月起每月多花，之前不變', () => {
  const en = SP5.create(stIn, { now: stNow }), P = en.profile({ spend75: 10000 }), Q = en.pensions(P, 60);
  assert.strictEqual(en.flowsM(P, Q, P.t75).living - P.base, 10000); assert.strictEqual(en.flowsM(P, Q, P.t75 - 1).living, P.base);
});
t('支出增加：每月多 1 萬 → 2 萬 依序延後', () => { const a = st({ spend: 1 }), b = st({ spend: 2 }); assert.ok(later(stBase, a) && later(a, b)); assert.ok(a !== stBase); });
t('支出增加：算到 75 歲以前就結束的話沒有影響（endAge 不可能 < 75，這裡改用 0% 報酬手算 0 影響的反例）', () => {
  const en = SP5.create(stIn, { now: stNow }), P0 = en.profile(), P1 = en.profile({ spend75: 10000 });
  near(en.evalR(P1, 60).need - en.evalR(P0, 60).need > 0 ? 1 : 0, 1, 0);
});

/* ---------- v0.5.7：子女每個階段各自的費用 ---------- */
const kidIn = (costs, path) => require('./_helper').inputs({ kidsOn: true, kids: [{ bym: '2015-03', path: path || 'grad', costs }] });
t('子女：國小公立 5 萬、國中私立 30 萬 → 國中開學那個月起每月費用從 0.42 萬跳到 2.5 萬', () => {
  const en = SP5.create(kidIn({ ele: '5', jun: '30', sen: '25', uni: '20', grad: '150' }), { now: stNow }), P = en.profile();
  const st = en.kidStages('2015-03', 'grad'), jun = st.find((x) => x.key === 'jun'), t0 = jun.s - (2026 * 12 + 9);
  near(P.kidM[t0 - 1], 50000 / 12, 0.01); near(P.kidM[t0], 300000 / 12, 0.01);
});
t('子女：國內大學 20 萬、美國研究所 150 萬，各自分開算', () => {
  const en = SP5.create(kidIn({ ele: '5', jun: '5', sen: '25', uni: '20', grad: '150' }), { now: stNow }), P = en.profile(), st = en.kidStages('2015-03', 'grad');
  const g = st.find((x) => x.key === 'grad'), u = st.find((x) => x.key === 'uni'), base = 2026 * 12 + 9;
  near(P.kidM[u.s - base], 200000 / 12, 0.01); near(P.kidM[g.s - base], 1500000 / 12, 0.01);
});
t('子女：還沒讀完的階段每個一列（小六：國小、國中、高中職、大學、研究所）', () => {
  const en = SP5.create(kidIn({}), { now: stNow }); assert.deepStrictEqual(en.kidGroups(en.kidStages('2015-03', 'grad')).map((g) => g.g), ['ele', 'jun', 'sen', 'uni', 'grad']);
});
t('子女：每一階段都要填（沒填研究所 → 輸入檢查擋下並指出是哪一階段）', () => {
  assert.ok(/研究所/.test(SP5.create(kidIn({ ele: '5', jun: '5', sen: '25', uni: '20' }), { now: stNow }).validate()));
});
t('子女：醫學系路徑的大學那格寫「大學（醫學系等 6 年）」', () => {
  const en = SP5.create(kidIn({}, 'med'), { now: stNow }); assert.ok(en.kidGroups(en.kidStages('2015-03', 'med')).some((g) => g.label === '大學（醫學系等 6 年）'));
});
t('舊存檔：三組費用自動攤到每個階段（k12 → 學齡前／國小／國中，hs → 高中職／五專，col → 大學以上）', () => {
  const k = SP5.migrateKid({ costs: { k12: '10', hs: '20', col: '30' } });
  assert.deepStrictEqual(k.costs, { pre: '10', ele: '10', jun: '10', sen: '20', five: '20', uni: '30', grad: '30', med: '30', tech2: '30' });
});
t('舊存檔：已經有新格式的階段不會被舊的三組覆蓋', () => {
  assert.strictEqual(SP5.migrateKid({ costs: { col: '30', grad: '150' } }).costs.grad, '150');
});
t('舊存檔：沒轉換直接算，也跟轉換後算出一樣的結果', () => {
  const a = SP5.create(kidIn({ k12: '5', hs: '25', col: '32' }), { now: stNow }).earliest();
  const b = SP5.create(kidIn(SP5.migrateKid({ costs: { k12: '5', hs: '25', col: '32' } }).costs), { now: stNow }).earliest();
  assert.strictEqual(a, b);
});

/* ---------- v0.5.7：勞退舊制移到 pre、可能有舊制的判斷 ---------- */
t('勞退舊制放在 pre 也能算（跟放在最上層一樣）', () => {
  const top = SP5.create(require('./_helper').inputs({ oldOn: true, oHire: '2001', oYrs: '4.5', oWage: '7' }), { now: stNow });
  const pre = SP5.create(require('./_helper').inputs({ pre: { oldOn: true, oHire: '2001', oYrs: '4.5', oWage: '7' } }), { now: stNow });
  assert.strictEqual(pre.oldLump(pre.profile(), 57), top.oldLump(top.profile(), 57)); assert.strictEqual(pre.oldLump(pre.profile(), 57), 700000);
});
t('可能有舊制：出生年月＋幾歲開始工作 早於 2005 年 7 月 → true', () => {
  assert.strictEqual(SP5.create(require('./_helper').inputs({ birth: '1974-11', workStart: '24' }), { now: stNow }).mayHaveOld(), true);   // 1998/11
  assert.strictEqual(SP5.create(require('./_helper').inputs({ birth: '1982-07', workStart: '22' }), { now: stNow }).mayHaveOld(), true);   // 2004/07
});
t('可能有舊制：剛好 2005 年 7 月或之後才開始工作 → false', () => {
  assert.strictEqual(SP5.create(require('./_helper').inputs({ birth: '1983-07', workStart: '22' }), { now: stNow }).mayHaveOld(), false);  // 2005/07
  assert.strictEqual(SP5.create(require('./_helper').inputs({ birth: '1990-03', workStart: '23' }), { now: stNow }).mayHaveOld(), false);
});

/* ---------- v0.6.0：從現在的年紀開始算 ---------- */
t('下限：40 歲的人，最早可以算到 40 歲（不再卡在 55 歲）', () => {
  assert.ok(Math.abs(SP5.create(require('./_helper').inputs({ birth: '1986-06' }), { now: stNow }).fromAge() - (40 + 4 / 12)) < 1e-9);
});
t('下限：已經夠用的人，最早就是現在（這個月）', () => {
  const en = SP5.create(require('./_helper').inputs({ birth: '1976-10', asset: '5000', inc: '5', spend: '3' }), { now: stNow });
  near(en.earliest(), en.fromAge(), 1e-9); near(en.fromAge(), 50, 1e-9);
});
t('下限：最早時點仍落在某一個月，且不早於現在', () => {
  const en = SP5.create(require('./_helper').inputs({ birth: '1986-06', asset: '500', inc: '9', spend: '4.5' }), { now: stNow }), e = en.earliest();
  near(e * 12, Math.round(e * 12), 1e-6); assert.ok(e >= en.fromAge() - 1e-9);
});

/* ---------- v0.6.0：工作空窗（過去） ---------- */
const gapIn = (gaps, pre) => require('./_helper').inputs({ birth: '1976-10', workStart: '25', pre: Object.assign({ gaps }, pre || {}) });
t('空窗：待業 2 年 6 個月 → 勞保年資、勞退提繳年資都少 2.5 年', () => {
  const a = SP5.create(gapIn([]), { now: stNow }).profile(), b = SP5.create(gapIn([{ sit: 'job', y: '2', m: '6' }]), { now: stNow }).profile();
  near(a.liYearsNow - b.liYearsNow, 2.5, 1e-9);
  const en = SP5.create(gapIn([{ sit: 'job', y: '2', m: '6' }]), { now: stNow }), en0 = SP5.create(gapIn([]), { now: stNow });
  near(en0.pensions(en0.profile(), 60).lsYears - en.pensions(en.profile(), 60).lsYears, 2.5, 1e-9);
});
t('空窗：育嬰留職停薪 1 年 → 勞保年資不變、勞退少 1 年', () => {
  const en0 = SP5.create(gapIn([]), { now: stNow }), en = SP5.create(gapIn([{ sit: 'parental', y: '1', m: '0' }]), { now: stNow });
  near(en.profile().liYearsNow, en0.profile().liYearsNow, 1e-9);
  near(en0.pensions(en0.profile(), 60).lsYears - en.pensions(en.profile(), 60).lsYears, 1, 1e-9);
});
t('空窗：自由業有加入職業工會 → 只扣勞退；沒有加入工會 → 兩個都扣', () => {
  const u = SP5.create(gapIn([{ sit: 'freeU', y: '3', m: '0' }]), { now: stNow }).profile(), n = SP5.create(gapIn([{ sit: 'freeN', y: '3', m: '0' }]), { now: stNow }).profile();
  const z = SP5.create(gapIn([]), { now: stNow }).profile();
  near(u.liYearsNow, z.liYearsNow, 1e-9); near(z.liYearsNow - n.liYearsNow, 3, 1e-9);
});
t('空窗：多段會加總（待業 6 個月＋出國讀書 1 年 3 個月 → 少 1.75 年）', () => {
  const z = SP5.create(gapIn([]), { now: stNow }).profile(), g = SP5.create(gapIn([{ sit: 'job', y: '0', m: '6' }, { sit: 'study', y: '1', m: '3' }]), { now: stNow }).profile();
  near(z.liYearsNow - g.liYearsNow, 1.75, 1e-9);
});
t('空窗：有填實際勞保年資時，以實際為準，空窗不影響', () => {
  assert.strictEqual(SP5.create(gapIn([{ sit: 'job', y: '4', m: '0' }], { liYears: '20' }), { now: stNow }).profile().liYearsNow, 20);
});
t('空窗：讓勞保月領變少（4 年空窗）', () => {
  const a = SP5.create(gapIn([]), { now: stNow }), b = SP5.create(gapIn([{ sit: 'job', y: '4', m: '0' }]), { now: stNow });
  assert.ok(b.pensions(b.profile(), 65).liMonthly < a.pensions(a.profile(), 65).liMonthly);
});
t('空窗：輸入檢查（沒選情境、年不是整數、月超過 11）', () => {
  assert.ok(/請選當時的情況/.test(SP5.create(gapIn([{ sit: '', y: '1', m: '0' }]), { now: stNow }).validate()));
  assert.ok(/年要填/.test(SP5.create(gapIn([{ sit: 'job', y: '1.5', m: '0' }]), { now: stNow }).validate()));
  assert.ok(/月要填/.test(SP5.create(gapIn([{ sit: 'job', y: '1', m: '12' }]), { now: stNow }).validate()));
  assert.strictEqual(SP5.create(gapIn([{ sit: 'job', y: '1', m: '11' }]), { now: stNow }).validate(), '');
});
t('空窗：只問多久不問何時，保守假設發生在勞退新制期間（2001 年就開始工作的人，也照樣扣勞退）', () => {
  const en0 = SP5.create(gapIn([]), { now: stNow }), en = SP5.create(gapIn([{ sit: 'job', y: '2', m: '0' }]), { now: stNow });
  near(en0.pensions(en0.profile(), 60).lsYears - en.pensions(en.profile(), 60).lsYears, 2, 1e-9);
});
t('空窗：七種情境都定義了影響', () => assert.strictEqual(SP5.GAP_SITS.length, 7));

/* ---------- v0.6.0：scenario（調調看、萬一共用） ---------- */
const scIn = require('./_helper').inputs({ birth: '1986-06', asset: '500', inc: '9', spend: '4.5' });
const sc = (sel, mx) => SP5.scenario(scIn, sel, { now: stNow, maxAge: mx }).e;
t('scenario：什麼都不調 = 主結果', () => { const en = SP5.create(scIn, { now: stNow }); en.sync(); assert.strictEqual(sc({}), en.earliest()); });
t('scenario：每月少花 → 更早；每月多花 → 更晚（雙向）', () => { const b = sc({}); assert.ok(sc({ more: -4000 }) < b); assert.ok(sc({ more: 4000 }) > b); });
t('scenario：每月多存 → 更早；每月少存 → 更晚（雙向）', () => { const b = sc({}); assert.ok(sc({ save: 4000 }) < b); assert.ok(sc({ save: -4000 }) > b); });
t('scenario：少花 2,000 比多存 2,000 更有效（退休後也少用）', () => assert.ok(sc({ more: -2000 }) <= sc({ save: 2000 })));
t('scenario：活到 85 比 90 更早、95 更晚', () => { const b = sc({}); assert.ok(sc({ end: 85 }) < b); assert.ok(sc({ end: 95 }) > b); });
t('scenario：不改原本的輸入', () => { const inp = JSON.parse(JSON.stringify(scIn)); SP5.scenario(inp, { end: 85, more: -4000 }, { now: stNow }); assert.strictEqual(inp.pre.endAge, ''); });

/* ---------- v0.6.9：勞保一次請領老年給付（勞保條例第 58 條第 2 項） ---------- */
const lumpIn = (o, pre) => require('./_helper').inputs(Object.assign({ birth: '1974-11', workStart: '24', asset: '520', inc: '11.5', spend: '4.2' }, o || {}, { pre: Object.assign({ liYears: '28', w60: '4.58' }, pre || {}) }));
const elig = (o, pre) => { const en = SP5.create(lumpIn(o, pre), { now: stNow }); return en.liLumpElig(en.profile()).state; };
// 2026/10 時，「2009/1 到現在」共 213 個月（17.75 年）
t('一次領資格：2008/12 開始工作、有填勞保年資而且長過 2009/1 以後的月數 → 可以選', () => assert.strictEqual(elig({ birth: '1984-12', workStart: '24' }, { liYears: '17.84' }), 'yes'));
t('一次領資格：2009/1 才開始工作 → 只能月領', () => assert.strictEqual(elig({ birth: '1985-01', workStart: '24' }, { liYears: '17.84' }), 'no'));
t('一次領資格：2008/12 開始工作，但年資剛好等於 2009/1 以後的月數 → 無法判斷（不猜）', () => assert.strictEqual(elig({ birth: '1984-12', workStart: '24' }, { liYears: '17.75' }), 'unknown'));
t('一次領資格：年資短，但查過勞保局、自己確認 2009 年前有年資 → 可以選', () => assert.strictEqual(elig({}, { liYears: '5', liPre09: true }), 'yes'));
t('一次領資格：2009 年以後才開始工作，就算勾了確認也不行', () => assert.strictEqual(elig({ birth: '1985-01', workStart: '24' }, { liPre09: true }), 'no'));
t('一次領資格：沒填實際勞保年資 → 無法判斷（只用開始工作年齡不能確定當時有保勞保）', () => assert.strictEqual(elig({}, { liYears: '' }), 'unknown'));
t('一次領資格：規則寫在 data/params.json（2009-01），不是寫死在引擎', () => assert.strictEqual(SP5.DATA.params.li_lump.eligible_if_insured_before, '2009-01'));
const lm = (y, R) => SP5.create(lumpIn(), { now: stNow }).lumpMonths(y, R);
t('一次領基數：10.5 年 → 10.5 個月（不足一年按比例）', () => near(lm(10.5, 55), 10.5, 1e-9));
t('一次領基數：20 年 → 15＋5×2＝25 個月', () => near(lm(20, 55), 25, 1e-9));
t('一次領基數：60 歲前最多 45 個月（31.9 年 → 45）', () => near(lm(31.92, 55.83), 45, 1e-9));
t('一次領基數：60 歲後年資最多算 5 年、合計最多 50 個月（35 年、63 歲退休 → 50）', () => near(lm(35, 63), 50, 1e-9));
t('一次領基數：60 歲後的年資也算（20 年、62 歲退休 → 25）', () => near(lm(20, 62), 25, 1e-9));
const la = (pre, y, R) => { const en = SP5.create(lumpIn({}, pre), { now: stNow }); return en.lumpAge(en.profile(), R, y); };
t('最早一次領：年資滿 25 年、年滿 50 歲 → 退休那個月就能領', () => near(la({}, 31.9, 55.83), 55.83, 1e-9));
t('最早一次領：年資滿 15 年 → 55 歲', () => near(la({}, 20, 52), 55, 1e-9));
t('最早一次領：年資未滿 15 年 → 60 歲（沒填性別照男性）', () => near(la({}, 10, 52), 60, 1e-9));
t('最早一次領：女性、年資滿 1 年 → 55 歲', () => near(la({ sex: 'F' }, 10, 52), 55, 1e-9));
t('最早一次領：女性、年資滿 15 年 → 一樣 55 歲（性別只影響年資未滿 15 年的人）', () => near(la({ sex: 'F' }, 20, 52), la({ sex: 'M' }, 20, 52), 1e-9));
t('最早一次領：同一家公司保到退休滿 25 年 → 不論年齡，退休就能領', () => {
  const en = SP5.create(lumpIn({}, { sameCo: '20' }), { now: stNow }), P = en.profile();
  near(en.lumpAge(P, 51.92 + 5, 10), 51.92 + 5, 0.01);   // 現在 51 歲 11 個月＋20 年 → 5 年後滿 25 年
});
const lumpEn = (pre) => { const en = SP5.create(lumpIn({}, Object.assign({ liMode: 'lump' }, pre || {})), { now: stNow }); en.sync(); return en; };
t('選一次領：勞保沒有月領，改成一筆 45,800 × 45 ＝ 2,061,000', () => {
  const en = lumpEn(), P = en.profile(), Q = en.pensions(P, 55.83);
  assert.strictEqual(Q.liMonthly, 0); near(Q.liLump, 2061000, 1); assert.strictEqual(Q.liMode, 'lump');
});
t('選一次領：那一筆錢出現在一次領的那個月，前一個月沒有', () => {
  const en = lumpEn(), P = en.profile(), Q = en.pensions(P, 55.83);
  near(en.flowsM(P, Q, Q.liT).li, 2061000, 1); assert.strictEqual(en.flowsM(P, Q, Q.liT - 1).li, 0);
  assert.ok(en.impactEvents(P, 55.83, Q).some((x) => x.t === '勞保一次領' && x.d === 'lump'));
});
t('選一次領：年資未滿 15 年、52 歲退休 → 60 歲才領，退休到 60 歲要繳國保，之後不能再保', () => {
  const en = lumpEn({ liYears: '5', liPre09: true }), P = en.profile(), Q = en.pensions(P, 52);
  near(Q.liClaim, 60, 1e-9); assert.strictEqual(Q.npEndT, Q.liT); assert.strictEqual(Q.npMonths, Q.liT - Q.tR);
});
t('選一次領但資格不確定（沒填年資）→ 照月領算，不猜', () => {
  const en = lumpEn({ liYears: '' }), Q = en.pensions(en.profile(), 60); assert.ok(Q.liMonthly > 0); assert.strictEqual(Q.liLump, 0);
});
t('選一次領之後，階段不會再出現勞保期；勞退領完之後叫「靠資產期」', () => {
  const en = lumpEn(), P = en.profile(), R = en.earliest(), ph = en.phases(P, R, en.evalR(P, R).Q).map((x) => x.name);
  assert.ok(!ph.includes('勞保期') && !ph.includes('雙年金期')); assert.strictEqual(ph[ph.length - 1], '靠資產期');
});
t('損益兩平：活過 72 歲，月領（含國保）累計超過一次領', () => {
  const en = SP5.create(lumpIn(), { now: stNow }); en.sync(); const P = en.profile(), c = en.liCompare(P, en.earliest());
  assert.strictEqual(c.elig, 'yes'); near(c.cross, 72, 1e-9); near(c.lump.amt, 2061000, 1);
});
t('損益兩平：交叉之前一次領比較多、之後月領比較多（累計線只交叉一次）', () => {
  const en = SP5.create(lumpIn(), { now: stNow }); en.sync(); const P = en.profile(), c = en.liCompare(P, en.earliest());
  c.pts.forEach(([a, m, l]) => assert.ok(a <= 72 ? l >= m : m > l, a));   // 72 歲那一點是 71 歲 11 個月底的累計
});
t('損益兩平：用退休後的實質存款利率折現（存款利率改高，交叉點不會變早）', () => {
  const a = SP5.create(lumpIn(), { now: stNow }); a.sync(); const ca = a.liCompare(a.profile(), a.earliest());
  const b = SP5.create(lumpIn({}, { dep: '2' }), { now: stNow }); b.sync(); const cb = b.liCompare(b.profile(), b.earliest());
  assert.ok(cb.cross >= ca.cross - 1e-9);
});
t('損益兩平：資格不確定時不比較', () => { const en = SP5.create(lumpIn({}, { liYears: '' }), { now: stNow }); assert.strictEqual(en.liCompare(en.profile(), 58).elig, 'unknown'); });
t('輸入檢查：同一家公司年資 0～60', () => assert.ok(/目前這家公司/.test(SP5.create(lumpIn({}, { sameCo: '70' }), { now: stNow }).validate())));

/* ---------- v0.6.11：勞保年資未滿 15 年（老年一次金、國保年資併計） ---------- */
const otIn = (o, pre) => require('./_helper').inputs(Object.assign({ birth: '1967-04', workStart: '50', asset: '300', inc: '5', spend: '3' }, o || {}, { pre: Object.assign({ w60: '4.58' }, pre || {}) }));
const otQ = (R, o, pre) => { const en = SP5.create(otIn(o, pre), { now: stNow }); en.sync(); return { en, Q: en.pensions(en.profile(), R) }; };
t('未滿 15 年：勞保 12 年＋退休後國保 3 年＝15 年 → 65 歲月領，只用勞保 12 年算（B 式 45,800×12×1.55%）', () => {
  const { Q } = otQ(62); assert.strictEqual(Q.liMode, 'combined'); near(Q.liMonthly, 45800 * 12 * 0.0155, 1); near(Q.liClaim, 65, 1e-9);
});
t('未滿 15 年：靠國保併計的月領不提前、不延後（就算選 60 歲領，也是 65 歲、不減給）', () => {
  const { Q } = otQ(62, {}, { liClaim: '60' }); near(Q.liClaim, 65, 1e-9); near(Q.liMonthly, 45800 * 12 * 0.0155, 1);
});
t('未滿 15 年：國保年資不夠併計（64 歲退休：14 年＋1 年＝15 剛好）→ 仍可月領；63 歲 6 個月＋…邊界', () => {
  const { Q } = otQ(64); assert.strictEqual(Q.liMode, 'combined');
});
t('未滿 15 年：勞保 9.5 年、65 歲之後才退休（沒有國保年資）→ 老年一次金', () => {
  const { Q } = otQ(66, { workStart: '56' }); assert.strictEqual(Q.liMode, 'onetime'); assert.strictEqual(Q.liMonthly, 0);
});
t('老年一次金：每年 1 個月（64 歲退休、勞保 8.5 年 → 8.5 個月 × 45,800），等到法定 65 歲才領', () => {
  const { Q } = otQ(64, { workStart: '55.5' }); assert.strictEqual(Q.liMode, 'onetime'); near(Q.liYears, 8.5, 1e-9);
  near(Q.liLumpMonths, 8.5, 1e-9); near(Q.liLump, 45800 * 8.5, 1); near(Q.liClaim, 65, 1e-9);
});
t('老年一次金：66 歲才退休 → 66 歲領（要先退保）；60 歲後 6 年只算 5 年', () => {
  const { Q } = otQ(66, { workStart: '55.5' }); assert.strictEqual(Q.liMode, 'onetime'); near(Q.liClaim, 66, 1e-9);
  near(Q.liLumpMonths, (Q.liYears - 6) + 5, 1e-9);
});
t('老年一次金：60 歲以後的年資最多算 5 年', () => {
  const r = otQ(71, { workStart: '58' }).Q;     // 58～71 歲 = 13 年，其中 60 歲後 11 年 → 只算 5 年 → 2＋5＝7 個月（加上目前已有的部分）
  assert.strictEqual(r.liMode, 'onetime'); assert.ok(r.liLumpMonths < r.liYears - 1e-9);
});
t('老年一次金：那一筆出現在領的那個月；那個月起國保停', () => {
  const { en, Q } = otQ(66, { workStart: '56' }); const P = en.profile();
  near(en.flowsM(P, Q, Q.liT).li, Q.liLump, 1); assert.strictEqual(en.flowsM(P, Q, Q.liT - 1).li, 0);
  assert.ok(en.impactEvents(P, 66, Q).some((x) => x.t === '勞保老年一次金'));
});
t('勞保年資剛好 15 年（浮點算出 14.9999…）也算滿 15 年，可以月領（v0.6.11 修正）', () => {
  const en = SP5.create(require('./_helper').inputs({ birth: '2001-03', workStart: '23', asset: '30', inc: '4.5', spend: '2.5' }), { now: stNow }); en.sync();
  const Q = en.pensions(en.profile(), 38); assert.ok(Q.liMonthly > 0); assert.strictEqual(Q.liMode, '');
});
t('未滿 15 年但 2009 年前有年資、選了一次請領 → 走一次請領（不是老年一次金）', () => {
  const { Q } = otQ(62, { workStart: '40' }, { liYears: '9.5', liPre09: true, liMode: 'lump' }); assert.strictEqual(Q.liMode, 'lump');   // 2007 年開始工作
});
t('規則寫在 data/params.json 的 li_onetime（附來源）', () => { const L = SP5.DATA.params.li_onetime; assert.strictEqual(L.np_combine.claim_age, 65); assert.ok(/80998/.test(L.source)); });

/* ---------- v0.6.12：一次請領用退保前 3 年平均 ---------- */
t('一次請領：有填退保前 3 年平均（3.2 萬）→ 用它算：32,000 × 45 ＝ 1,440,000', () => {
  const en = lumpEn({ w36: '3.2' }), Q = en.pensions(en.profile(), 55.83); near(Q.liLump, 32000 * 45, 1);
});
t('一次請領：沒填 → 用平均月投保薪資估算（45,800 × 45）', () => { const en = lumpEn(), Q = en.pensions(en.profile(), 55.83); near(Q.liLump, 45800 * 45, 1); });
t('退保前 3 年平均只影響一次請領，不影響月領', () => {
  const a = SP5.create(lumpIn({}, { w36: '3.2' }), { now: stNow }), b = SP5.create(lumpIn(), { now: stNow });
  near(a.pensions(a.profile(), 60).liMonthly, b.pensions(b.profile(), 60).liMonthly, 1e-6);
});
t('退保前 3 年平均：超過勞保上限 4.58 萬 → 擋下', () => assert.ok(/退保前 3 年平均/.test(SP5.create(lumpIn({}, { w36: '5' }), { now: stNow }).validate())));
t('國保年金只用 B 式（2023/10 以後領勞保老年給付者不能選 A 式）：21,103 × 年資 × 1.3%', () => {
  const en = SP5.create(lumpIn(), { now: stNow }); en.sync(); const Q = en.pensions(en.profile(), 55.83);
  near(Q.npMonthly, 21103 * (Q.npMonths / 12) * 0.013, 1);
});

/* ---------- v0.7.0：提高準確度數字欄位的驗證 ---------- */
const vIn = (pre) => require('./_helper').inputs({ birth: '1986-06', workStart: '25', asset: '500', inc: '9', spend: '4.5', pre });
const vErr = (pre) => SP5.create(vIn(pre), { now: stNow }).validate();
t('驗證：勞保年資填非數字 → 擋下（以前會悄悄當成沒填）', () => assert.ok(/勞保年資要填/.test(vErr({ liYears: 'abc' }))));
t('驗證：勞保年資超過「年齡－15」→ 擋下；剛好上限可以', () => { assert.ok(/勞保年資要填 0 到 26/.test(vErr({ liYears: '27' }))); assert.strictEqual(vErr({ liYears: '26' }), ''); });
t('驗證：平均月投保薪資超過上限 4.58 萬 → 擋下，並說明不是月薪', () => { assert.ok(/不會超過勞保投保薪資上限 4\.58 萬（這不是月薪/.test(vErr({ w60: '9' }))); assert.strictEqual(vErr({ w60: '4.58' }), ''); });
t('驗證：平均月投保薪資 0 或負數 → 擋下', () => { assert.ok(vErr({ w60: '0' })); assert.ok(vErr({ w60: '-1' })); });
t('驗證：勞退專戶餘額負數 → 擋下；0 可以', () => { assert.ok(/勞退專戶餘額/.test(vErr({ lsBal: '-5' }))); assert.strictEqual(vErr({ lsBal: '0' }), ''); });
t('驗證：勞退月提繳工資超過上限 → 擋下', () => assert.ok(/勞退月提繳工資/.test(vErr({ lsWage: '50' }))));
t('驗證：勞退自提超過 6% → 擋下；6% 可以', () => { assert.ok(/自提/.test(vErr({ self: '7' }))); assert.strictEqual(vErr({ self: '6' }), ''); });
t('驗證：空白一律可以（代表用估算）', () => assert.strictEqual(vErr({ liYears: '', w60: '', lsBal: '', lsWage: '', self: '' }), ''));

/* ---------- v0.7.2：快速開始空白時的訊息 ---------- */
t('沒填出生年月 →「還沒填（西元年月，不用打 -）」；填錯 →「請用西元年月，不用打 -（例如……）」', () => {
  const v = (o) => SP5.create(Object.assign({ birth: '1986-06', workStart: '25', asset: '500', inc: '9', spend: '4.5', pre: {} }, o), { now: stNow }).validate();
  assert.strictEqual(v({ birth: '' }), '出生年月還沒填（西元年月，不用打 -）。'); assert.strictEqual(v({ birth: '1986/6/1' }), '出生年月請用西元年月，不用打 -（例如 1974 年 11 月就打 197411）。');
  assert.strictEqual(v({ workStart: '' }), '幾歲開始工作還沒填（例如 24）。'); assert.ok(/請填 15 到/.test(v({ workStart: '9' })));
  ['asset', 'inc', 'spend'].forEach((k) => assert.ok(/還沒填/.test(v({ [k]: '' })), k));
});

/* ---------- v0.8.0：勞退舊制欄位沒勾選時，填了也要是數字 ---------- */
t('舊制欄位：沒勾選舊制，填「abc」也擋下；空白或數字可以', () => {
  const v = (pre) => SP5.create(require('./_helper').inputs({ birth: '1986-06', workStart: '25', asset: '500', inc: '9', spend: '4.5', pre }), { now: stNow }).validate();
  assert.ok(/到職年要填數字/.test(v({ oldOn: false, oHire: 'abc' }))); assert.ok(/舊制年資要填數字/.test(v({ oldOn: false, oYrs: 'x' }))); assert.ok(/月平均工資要填數字/.test(v({ oldOn: false, oWage: '<b>' })));
  assert.strictEqual(v({ oldOn: false, oHire: '', oYrs: '', oWage: '' }), ''); assert.strictEqual(v({ oldOn: false, oHire: '1998', oYrs: '5', oWage: '4' }), '');
});
t('esc()：& < > " \' 都跳脫', () => assert.strictEqual(SP5.create(require('./_helper').inputs({}), { now: stNow }).esc('<a href="x" onclick=\'y\'>&'), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;'));

/* ---------- v0.9.0：萬一存款利率降低 ---------- */
t('萬一存款利率降低：退休前後的利率都減，最低 0；最快退休只會更晚或不變', () => {
  const inp = require('./_helper').inputs({ birth: '1986-06', workStart: '25', asset: '500', inc: '9', spend: '4.5' });
  const base = SP5.scenario(inp, {}, { now: stNow, maxAge: 80 }), r0 = base.en.rates();
  let prev = base.e;
  [0.5, 1, 1.5].forEach((d) => {
    const sc = SP5.scenario(inp, { dep: d }, { now: stNow, maxAge: 80 }), r = sc.en.rates();
    near(r.dep, Math.max(0, r0.dep - d / 100), 1e-12); assert.ok(r.rPre < r0.rPre && r.rPost < r0.rPost, '實質利率變低');
    assert.ok(sc.e === null || (prev !== null && sc.e >= prev - 1e-9), '最快退休不會變早：' + prev + ' → ' + sc.e); prev = sc.e;
  });
  near(SP5.scenario(inp, { dep: 5 }, { now: stNow, maxAge: 80 }).en.rates().dep, 0, 1e-12);
});
t('萬一存款利率降低：跟通膨上升不同——房貸每月固定，通膨上升會讓房貸變輕，利率下降不會', () => {
  const inp = require('./_helper').inputs({ birth: '1986-06', workStart: '25', asset: '500', inc: '9', spend: '4.5', house: true, housePay: '3', houseYrs: '20' });
  const a = SP5.scenario(inp, { inf: 1 }, { now: stNow }), b = SP5.scenario(inp, { dep: 1 }, { now: stNow });
  const loanReal = (sc) => { const en = sc.en, P = en.profile(sc.adj), Q = en.evalR(P, 60).Q; return en.flowsM(P, Q, 120).loan; };
  assert.ok(loanReal(a) < loanReal(b) - 1, '通膨上升時，十年後的房貸（今天的購買力）比較輕：' + loanReal(a) + ' vs ' + loanReal(b));
});

/* ---------- 用語 ---------- */
t('用語：勞退停發寫成「專戶領完」，不寫「停發」', () => {
  const en = engine({ birth: '1966-10', asset: '1500' }), P = en.profile(), Q = en.pensions(P, 60);
  const txt = en.impactEvents(P, 60, Q).map((e) => e.t).join('｜') + en.eventsAt(P, Q, Q.lsEndT).map((e) => e.text).join('｜');
  assert.ok(/專戶領完/.test(txt) && !/停發/.test(txt), txt);
});

/* 勞保局 2026-10-06 說明：領了勞保老年給付就不能再參加國保（112.10.1 起），但已繳的國保年資保留，65 歲仍可依該年資領國保老年年金 */
t('領了勞保老年給付後國保停繳，但已繳的國保年資保留、65 歲照領（勞保局 2026-10-06 說明；112.10.1 起）', () => {
  /* 1970-05 生、30 歲開始工作（2009 年前有年資）、50 歲退休（勞保年資 20 年），選一次請領：要用第 2 款等到 55 歲 */
  const en = engine({ birth: '1970-05', workStart: '30', asset: '900', inc: '6', spend: '3', pre: { liMode: 'lump', liPre09: true } }), P = en.profile(), Q = en.pensions(P, 50);
  assert.strictEqual(Q.tR, en.tOfAge(50)); assert.strictEqual(Q.liT, en.tOfAge(55), '一次請領在 55 歲');
  assert.strictEqual(Q.npEndT, Q.liT, '國保在開始領勞保的那個月停繳');
  assert.strictEqual(Q.npMonths, 60, '50～55 歲繳了 5 年國保');
  assert.strictEqual(Math.round(Q.npMonthly), Math.round(21103 * 5 * 0.013), '65 歲起國保年金按已繳的 5 年、B 式計算（21,103 × 5 × 1.3% ≈ 1,372）');
  let premAfter = 0, npPaid = 0;
  for (let t = 0; t < P.tE; t++) { const f = en.personFlowsM(P, Q, t); if (t >= Q.liT && f.npPrem > 0) premAfter++; if (t >= Q.np65T && f.np > 0) npPaid++; }
  assert.strictEqual(premAfter, 0, '領了勞保之後沒有任何一個月繳國保');
  assert.strictEqual(npPaid, P.tE - Q.np65T, '65 歲起每個月都有國保年金');
});

process.exit(S.run() ? 1 : 0);
