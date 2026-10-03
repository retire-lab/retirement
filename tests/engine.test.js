#!/usr/bin/env node
/*
 * SP5 引擎測試：node tests/engine.test.js
 * 預期值都能用計算機手算，或直接對照勞保局公布的範例／官方試算器。
 * 案例編號對應規格書：TC＝v0.2 引擎、L／A／OLD／NP＝v0.3 制度模組、C＝v0.4 子女。
 * 引擎按月計算。手算案例的生日設在 10 月，讓「今天」（2026 年 10 月）剛好是生日當月。
 */
'use strict';
const assert = require('assert');
const SP5 = require('../src/engine.js');

const NOW = { y: 2026, m: 10 };
/* 0% 報酬、0% 通膨、不算年金：每個數字都是加減法 */
const ZERO = { inf: 0, rPre: 0, rPost: 0, rLs: 0, pensions: false, np: false, nhi: false };

function inputs(over) {
  const base = {
    birth: '1976-10', workStart: '25', asset: '900', inc: '10', spend: '5',
    house: false, car: false, kidsOn: false, parOn: false, oldOn: false,
    housePay: '', houseYrs: '', carPay: '', carYrs: '', par: '', parMode: 'keep', parYrs: '',
    oHire: '', oYrs: '', oWage: '', kids: [{ bym: '', path: 'grad', costs: {} }],
    pre: { liYears: '', w60: '', lsBal: '', lsWage: '', self: '0', endAge: '' }
  };
  const o = Object.assign(base, over || {});
  if (over && over.pre) o.pre = Object.assign(base.pre, over.pre);
  return o;
}
function engine(over, assume) { return SP5.create(inputs(over), { now: NOW, assume: assume }); }
function near(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' 預期 ' + expected + '，實際 ' + actual);
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const todo = [];
function pending(name, why) { todo.push([name, why]); }

/* ================= v0.2 引擎（0% 報酬，手算） ================= */
test('TC1 基準：無年金、無到期支出，各年齡缺口', () => {
  const en = engine({}, ZERO), P = en.profile();
  assert.strictEqual(P.A0, 50);
  near(en.evalR(P, 55).gap, 9000000, 1, 'R=55');
  near(en.evalR(P, 60).gap, 3000000, 1, 'R=60');
  near(en.evalR(P, 62).gap, 600000, 1, 'R=62');
  near(en.evalR(P, 63).gap, -600000, 1, 'R=63');
});
test('TC1 按月：缺口每個月少 10 萬，最早剛好 62 歲 6 個月', () => {
  const en = engine({}, ZERO), P = en.profile();
  near(en.evalR(P, 62 + 5 / 12).gap, 100000, 1, '62 歲 5 個月');
  near(en.evalR(P, 62.5).gap, 0, 1, '62 歲 6 個月');
  assert.strictEqual(en.earliest(), 62.5);
  assert.strictEqual(en.ageText(62.5), '62 歲 6 個月');
  assert.deepStrictEqual(en.ymOf(62.5), { y: 2039, m: 4 });
});
test('TC1 求解：60 歲退休，每月多存 25,000、或每月永久少花 6,250', () => {
  const en = engine({}, ZERO);
  near(en.solve(60, 'extra') / 12, 25000, 1, '多存');
  near(en.solve(60, 'cut', 600000) / 12, 6250, 1, '少花');
});
test('TC2 房貸 60 歲結束：最早可退休從 62 歲 6 個月提前到 56 歲 6 個月', () => {
  const en = engine({ spend: '3', house: true, housePay: '2', houseYrs: '10' }, ZERO), P = en.profile();
  near(en.evalR(P, 55).gap, 1800000, 1, 'R=55');
  near(en.evalR(P, 56).gap, 600000, 1, 'R=56');
  near(en.evalR(P, 57).gap, -600000, 1, 'R=57');
  assert.strictEqual(en.earliest(), 56.5);
});
test('TC5 按月複利與月初扣款（年報酬 5%）', () => {
  const en = engine({ birth: '1963-10', asset: '100', inc: '10', spend: '4', pre: { endAge: '66' } },
    { inf: 0, rPre: 0.05, rPost: 0.05, rLs: 0, pensions: false, np: false, nhi: false });
  const P = en.profile(), ev = en.evalR(P, 64), m = Math.pow(1.05, 1 / 12) - 1;
  assert.strictEqual(P.A0, 63);
  let proj = 1000000; for (let i = 0; i < 12; i++) proj = (proj + 60000) * (1 + m);   // 每月月初存 6 萬，再滾一個月
  let need = 0; for (let i = 0; i < 24; i++) need += 40000 / Math.pow(1 + m, i);         // 24 個月、每月月初付 4 萬
  near(ev.proj, proj, 1, '64 歲當月資產');
  near(ev.need, need, 1, '需要的本金');
});
test('自我檢查：用「需要的本金」往前推，資產最低點剛好是 0', () => {
  const en = engine({ spend: '3', house: true, housePay: '2', houseYrs: '10' }, { inf: 0.02, rPre: 0.03, rPost: 0.02, rLs: 0.01, pensions: true, np: true });
  const P = en.profile();
  for (const R of [55, 58.25, 61.5]) {
    const ev = en.evalR(P, R);
    if (ev.need > 0) near(en.minFrom(P, R, ev.need), 0, 1, 'R=' + R + ' 最低點');
  }
});
test('性質：還差錢的年齡，永久少花一定不多於多存（不成立就是 bug）', () => {
  const en = engine({}, ZERO), P = en.profile();
  for (let R = 55; R <= 62; R++) {
    const X = en.solve(R, 'extra'), Y = en.solve(R, 'cut', P.base);
    assert.ok(Y <= X + 1, 'R=' + R + ' 少花 ' + Y + ' > 多存 ' + X);
  }
});

/* ================= v0.2 房貸提前還清 ================= */
test('D4 剩餘本金：600 萬、2.4%、30 年，繳滿 60 期後剩 5,274,262', () => {
  const pmt = 6000000 * 0.002 / (1 - Math.pow(1.002, -360));
  near(SP5.loanBalance(pmt, 300, 0.024), 5274262, 1);
});
test('零利率提前還清：總支出不變，55 歲缺口跟 TC2 一樣', () => {
  const en = engine({ spend: '3', house: true, housePay: '2', houseYrs: '10', housePre: true, housePreAge: '55', houseRate: '0' }, ZERO), P = en.profile();
  near(en.evalR(P, 55).gap, 1800000, 1, 'R=55');
  const Q = en.pensions(P, 60);
  near(en.flowsM(P, Q, 60).prepay, 1200000, 1, '55 歲生日那個月一次還 120 萬');
  assert.strictEqual(en.flowsM(P, Q, 61).loan, 0);
  near(en.flowsM(P, Q, 59).loan, 20000, 1, '還清前一個月照繳');
});
test('提前還清年齡超出房貸期間要擋下', () => {
  const msg = engine({ house: true, housePay: '2', houseYrs: '5', housePre: true, housePreAge: '58', houseRate: '2' }).validate();
  assert.ok(/提前還清的年齡/.test(msg), msg);
});
test('退休年月：1976-03 生，57 歲退休是 2033 年 3 月', () => {
  assert.deepStrictEqual(engine({ birth: '1976-03' }, ZERO).retireYM(57), { y: 2033, m: 3 });
});

/* ================= v0.3 勞保（對照勞保局整合試算） ================= */
test('LI-02 法定請領年齡依出生年次', () => {
  assert.strictEqual(SP5.legalAge(1957), 60);
  assert.strictEqual(SP5.legalAge(1958), 61);
  assert.strictEqual(SP5.legalAge(1961), 64);
  assert.strictEqual(SP5.legalAge(1962), 65);
  assert.strictEqual(SP5.legalAge(1980), 65);
});
test('L1 基準，第二式勝：45,800 × 30 年 → 21,297', () => near(SP5.liMonthlyCalc(45800, 30, 65, 65), 21297, 0.5));
test('L2 提前 5 年減給 20% → 17,038', () => near(SP5.liMonthlyCalc(45800, 30, 60, 65), 17037.6, 0.01));
test('L3 延後上限加給 20% → 25,556', () => near(SP5.liMonthlyCalc(45800, 30, 70, 65), 25556.4, 0.01));
test('L3b 延後超過 5 年仍以 20% 為限', () => near(SP5.liMonthlyCalc(45800, 30, 72, 65), 25556.4, 0.01));
test('L4 低薪時第一式勝 → 5,935', () => near(SP5.liMonthlyCalc(25250, 15, 65, 65), 5935.3125, 0.001));
test('L6 民國 50 年次（法定 64），62 歲請領減 8% → 19,593', () => near(SP5.liMonthlyCalc(45800, 30, 62, SP5.legalAge(1961)), 19593.24, 0.01));
test('L9 年資未滿 15 年不能領年金', () => assert.strictEqual(SP5.liMonthlyCalc(45800, 14.92, 65, 65), 0));

/* ================= v0.3 勞退月退（勞保局 0018437 範例） ================= */
test('A3 專戶 100 萬、60 歲 → 每月 4,117（勞保局範例）', () => assert.strictEqual(Math.round(SP5.lsMonthlyCalc(1000000, 60)), 4117));
test('專戶 200 萬、60 歲 → 每月 8,235（勞保局範例）', () => assert.strictEqual(Math.round(SP5.lsMonthlyCalc(2000000, 60)), 8235));
test('A1 專戶 300 萬、60 歲 → 12,352', () => assert.strictEqual(Math.round(SP5.lsMonthlyCalc(3000000, 60)), 12352));
test('A2 專戶 300 萬、65 歲 → 14,628', () => assert.strictEqual(Math.round(SP5.lsMonthlyCalc(3000000, 65)), 14628));
test('A3 性質：月退與餘額成正比', () => near(SP5.lsMonthlyCalc(3e6, 62) / SP5.lsMonthlyCalc(1e6, 62), 3, 1e-12));
test('平均餘命表抽查（111 年簡易生命表）', () => {
  assert.strictEqual(SP5.lifeYears(60), 23);
  assert.strictEqual(SP5.lifeYears(61), 23);
  assert.strictEqual(SP5.lifeYears(65), 19);
  assert.strictEqual(SP5.lifeYears(70), 16);
  assert.strictEqual(SP5.lifeYears(85), 6);
  assert.strictEqual(SP5.lifeYears(90), 6);
});

/* ================= v0.3 國保、舊制 ================= */
test('NP 國保 B 式：10 年 → 每月 2,743', () => near(SP5.npMonthlyCalc(10), 2743.39, 0.01));
test('OLD-T1～T4 舊制基數（含半年進位）', () => {
  assert.strictEqual(SP5.oldUnits(10), 20);
  assert.strictEqual(SP5.oldUnits(20), 35);
  assert.strictEqual(SP5.oldUnits(35), 45);
  assert.strictEqual(SP5.oldUnits(10 + 4 / 12), 21);
  assert.strictEqual(SP5.oldUnits(10 + 7 / 12), 22);
});
test('OLD-T5／T6 懸崖：同一雇主 14 年拿 0，15 年且滿 55 歲才拿得到', () => {
  assert.strictEqual(SP5.oldEligible(14, 56), false);
  assert.strictEqual(SP5.oldEligible(15, 57), true);
  assert.strictEqual(SP5.oldEligible(25, 50), true);
  assert.strictEqual(SP5.oldEligible(10, 60), true);
});
test('OLD 引擎串接：42 歲到職、舊制 7 年、月薪 6 萬，56 歲 0 元、57 歲 84 萬', () => {
  const en = engine({ birth: '1976-03', oldOn: true, oHire: '2018', oYrs: '7', oWage: '6' }, ZERO), P = en.profile();
  assert.strictEqual(en.oldLump(P, 56), 0);
  assert.strictEqual(en.oldLump(P, 57), 840000);
});

/* ================= v0.4 子女學制（目前 2026 年 10 月） ================= */
function current(bym, path) {
  const en = engine({}, ZERO), st = en.kidStages(bym, path);
  const cur = st.filter((t) => t.started && t.live)[0];
  return cur ? (cur.pre ? '學齡前' : cur.label + ' ' + cur.grade) : '還沒出生';
}
test('C 9 月分界：2012-10 生讀國中 2 年級，2012-08 生讀國中 3 年級', () => {
  assert.strictEqual(current('2012-10'), '國中 2');
  assert.strictEqual(current('2012-08'), '國中 3');
});
test('C 其他年齡', () => {
  assert.strictEqual(current('2016-03'), '國小 5');
  assert.strictEqual(current('2020-11'), '學齡前');
  assert.strictEqual(current('2027-05'), '還沒出生');
});
test('C 升學路徑：五專＋二技、醫學系', () => {
  const en = engine({}, ZERO);
  assert.deepStrictEqual(en.kidStages('2012-10', 'five2').map((t) => t.label), ['學齡前', '國小', '國中', '五專', '二技']);
  const med = en.kidStages('2012-10', 'med');
  assert.strictEqual(med[med.length - 1].years, 6);
});
test('C 子女費用按月攤：國中每年 12 萬 → 每月 1 萬', () => {
  const en = engine({ kidsOn: true, kids: [{ bym: '2013-10', path: 'hs', costs: { k12: '12', hs: '0' } }] }, ZERO);
  const P = en.profile();
  // 2013-10 生 → 2020 入國小 → 2026/09 入國中；這個月起每月 1 萬
  near(P.kidM[0], 10000, 1, '這個月');
  near(P.kidM.slice(0, 12).reduce((a, b) => a + b, 0), 120000, 1, '這 12 個月');
});

/* ================= 逐月檢視 ================= */
test('按月路徑與逐年明細一致：最後一個月的資產相同', () => {
  const en = engine({ house: true, housePay: '2.3', houseYrs: '7' });
  const P = en.profile(), mon = en.monthly(P, 58), led = en.ledger(P, 58);
  near(mon[mon.length - 1].end, led[led.length - 1].end, 0.01);
});
test('逐月事件：房貸 10 年後的那個月出現「房貸繳完」', () => {
  const en = engine({ house: true, housePay: '2', houseYrs: '10' }, ZERO), P = en.profile(), Q = en.pensions(P, 62);
  assert.ok(en.eventsAt(P, Q, 120).some((e) => /房貸繳完/.test(e.text)));
  assert.ok(!en.eventsAt(P, Q, 119).some((e) => /房貸繳完/.test(e.text)));
});
test('逐月事件：2014-10 生的孩子 2027 年 9 月上國中，費用從國小改成國中', () => {
  const en = engine({ kidsOn: true, kids: [{ bym: '2014-10', path: 'uni', costs: { k12: '12', hs: '24', col: '30' } }] }, ZERO);
  const P = en.profile(), Q = en.pensions(P, 62);
  const ev = en.eventsAt(P, Q, 11).map((e) => e.text).join('｜');   // 2026/10 + 11 個月 = 2027/09
  assert.ok(/第 1 個孩子上國中/.test(ev), ev);
  const hs = en.eventsAt(P, Q, 11 + 36).map((e) => e.text).join('｜'); // 2030/09 上高中職，每月 1 萬 → 2 萬
  assert.ok(/上高中職：費用每月 1 萬 → 2 萬/.test(hs), hs);
});
test('逐月事件：退休那個月有「退休」與「開始繳國保」', () => {
  const en = engine({}), P = en.profile(), Q = en.pensions(P, 57);
  const txt = en.eventsAt(P, Q, Q.tR).map((e) => e.text).join('｜');
  assert.ok(/退休/.test(txt) && /開始繳國保/.test(txt), txt);
});

/* ================= 輸入檢查 ================= */
test('檢查：出生年月格式錯誤', () => assert.ok(/出生年月/.test(engine({ birth: 'abc' }).validate())));
test('檢查：勾了子女但沒填費用', () => {
  const msg = engine({ kidsOn: true, kids: [{ bym: '2012-10', path: 'grad', costs: {} }] }).validate();
  assert.ok(/第 1 個孩子/.test(msg), msg);
});
test('檢查：65 歲以上不適用', () => assert.ok(/65 歲/.test(engine({ birth: '1960-01' }).validate())));

/* ================= 預設假設下整條算得完、沒有 NaN ================= */
test('煙霧測試：預設假設＋房貸＋子女＋舊制，每一年都是數字', () => {
  const en = engine({ house: true, housePay: '2.3', houseYrs: '7', kidsOn: true,
    kids: [{ bym: '2012-05', path: 'grad', costs: { k12: '12', hs: '20', col: '25' } }],
    oldOn: true, oHire: '1999', oYrs: '6', oWage: '8' });
  const e = en.earliest(), R = e === null ? 65 : e;
  assert.ok(e === null || Math.abs(e * 12 - Math.round(e * 12)) < 1e-9, '最早退休要落在某個月');
  en.ledger(en.profile(), R).forEach((r) => assert.ok(isFinite(r.end), r.a + ' 歲不是數字'));
  assert.ok(e === null || (e >= 55 && e <= 65));
});

/* ================= 等官方試算器回填 ================= */
pending('L7／L8 勞保一次金', '一次金尚未納入引擎（勞保局整合試算已確認規則：45,800 × 45 個月 = 2,061,000）');

/* ================= 執行 ================= */
let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
for (const [name, why] of todo) console.log('  … ' + name + '（待辦：' + why + '）');
console.log('\n' + pass + ' 通過，' + fail + ' 失敗，' + todo.length + ' 項待官方試算器回填');
process.exit(fail ? 1 : 0);
