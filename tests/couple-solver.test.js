/* tests/couple-solver.test.js — 夫妻 solver（v1.0.0-beta.1）
 * 一、畫布的例子：數字釘死（跟逐月暴力搜尋的結果一致）
 * 二、二分搜尋的前提：越晚退休錢只會越多（單調）；找到的答案是最快的（前一個月不夠）
 * 三、三個方案的順序、換算比例、調調看的方向
 * 四、兩人條件對稱時，對調結果也對調；輸入錯誤時指出是誰
 * 五、效能 */
'use strict';
const S = require('../src/engine.js');
const { makeCase } = require('./_cases');
const NOW = { y: 2026, m: 10 };
let ok = 0, bad = 0;
function check(name, cond, detail) { if (cond) { ok++; console.log('  ✓ ' + name); } else { bad++; console.log('  ✗ ' + name + (detail !== undefined ? '：' + JSON.stringify(detail).slice(0, 300) : '')); } }
function section(t) { console.log('\n■ ' + t); }
const kids = [{ bym: '2016-04', path: 'uni', costs: { ele: '5', jun: '6', sen: '8', uni: '15' } }, { bym: '2019-09', path: 'uni', costs: { pre: '10', ele: '5', jun: '6', sen: '8', uni: '15' } }];
const CIN = { asset: '300', spend: '7', house: true, housePay: '2', houseYrs: '20', car: false, kidsOn: true, kids, parOn: false, pre: {},
  you: { birth: '1985-03', workStart: '25', inc: '8', pre: {} }, partner: { birth: '1988-07', workStart: '25', inc: '6.5', pre: {} } };

section('畫布的例子（你 1985-03 月入 8 萬、另一半 1988-07 月入 6.5 萬、存款 300 萬、生活費 7 萬、房貸 2 萬 20 年、兩個孩子）');
{
  const M = S.coupleModel(CIN, { now: NOW }), P = M.plans(), A = M.A;
  check('你先退到底：你 49 歲 8 個月（2034/11）、另一半 65 歲', P.youFirst && A.ageText(P.youFirst.ageA) === '49 歲 8 個月' && P.youFirst.ymA === '2034/11' && A.ageText(P.youFirst.ageB) === '65 歲', P.youFirst && [A.ageText(P.youFirst.ageA), P.youFirst.ymA]);
  check('一起退：2043/08（你 58 歲 5 個月、另一半 55 歲 1 個月），只靠存款 19 個月', P.together && P.together.ymA === '2043/08' && P.together.onlySavings === 19, P.together && [P.together.ymA, P.together.onlySavings]);
  check('另一半先退到底：另一半 47 歲 1 個月、你 65 歲', P.partnerFirst && A.ageText(P.partnerFirst.ageB) === '47 歲 1 個月' && A.ageText(P.partnerFirst.ageA) === '65 歲');
  const m55 = M.monthOfAge('you', 55), b = M.best('you', m55);
  check('你 55 歲退休：另一半最快 59 歲 1 個月（2047/08）', A.ageText(M.ageOf('partner', b)) === '59 歲 1 個月' && M.ym(b) === '2047/08', [A.ageText(M.ageOf('partner', b)), M.ym(b)]);
  check('換算比例：你多做 1 年，另一半早 14 個月', M.exchange('you', m55) === 14, M.exchange('you', m55));
  const M2 = S.coupleModel(CIN, { now: NOW, sel: { more: -0.5 } }), b2 = M2.best('you', m55);
  check('調調看：全家每月少花 5,000 → 另一半 55 歲 11 個月', A.ageText(M2.ageOf('partner', b2)) === '55 歲 11 個月', A.ageText(M2.ageOf('partner', b2)));
  check('一起退是三個方案裡唯一有「只靠存款」的', P.youFirst.onlySavings === 0 && P.partnerFirst.onlySavings === 0 && P.together.onlySavings > 0);
}

section('二分搜尋的前提：越晚退休，錢只會越多（固定另一方，夠了之後不會又變不夠）');
const pool = [];
for (let i = 0; pool.length < 40 && i < 600; i++) {
  const a = makeCase(i), b = makeCase((i * 13 + 7) % 600);
  if (a.pre && a.pre.nhiDep) continue;
  const cin = Object.assign({}, a, { you: { birth: a.birth, workStart: a.workStart, inc: a.inc, pre: Object.assign({}, a.pre, { gaps: [] }) }, partner: { birth: b.birth, workStart: b.workStart, inc: b.inc, pre: Object.assign({}, b.pre, { gaps: [] }) } });
  const M = S.coupleModel(cin, { now: NOW }); if (M.error) continue;
  pool.push(M);
}
{
  let monoA = true, monoB = true, minimal = true, checks = 0, info = null;
  pool.forEach((M, k) => {
    [0, 0.33, 0.66, 1].forEach((f) => {
      const m = Math.round(M.MA * f), b = M.best('you', m);
      if (b === null) return; checks++;
      for (let x = b; x <= Math.min(M.MB, b + 36); x += 6) if (!M.feasible(m, x)) { monoA = false; info = info || [k, m, x]; }
      if (b > 0 && M.feasible(m, b - 1)) { minimal = false; info = info || ['min', k, m, b]; }
      for (let y = m; y <= Math.min(M.MA, m + 36); y += 6) if (!M.feasible(y, b)) { monoB = false; info = info || ['B', k, y, b]; }
    });
  });
  check('另一方最快的月份之後，再晚退也都夠（' + pool.length + ' 對隨機夫妻 × 4 個退休點，共 ' + checks + ' 組）', monoA, info);
  check('固定另一方，你越晚退也一直夠', monoB, info);
  check('找到的是最快的：前一個月一定不夠', minimal, info);
  let mono = true;
  pool.slice(0, 20).forEach((M) => { let prev = Infinity; for (let m = 0; m <= M.MA; m += 12) { const b = M.best('you', m); if (b === null) continue; if (b > prev) mono = false; prev = b; } });
  check('你越晚退，另一半最快的月份不會變晚', mono);
}

section('三個方案與調調看的方向');
{
  let order = true;
  pool.slice(0, 25).forEach((M) => {
    const P = M.plans(); if (!P.youFirst || !P.together || !P.partnerFirst) return;
    if (!(P.youFirst.ma <= P.together.ma && P.together.ma <= P.partnerFirst.ma && P.partnerFirst.mb <= P.together.mb && P.together.mb <= P.youFirst.mb)) order = false;
  });
  check('你先退到底 ≤ 一起退 ≤ 另一半先退到底（你的月份）；另一半的月份反過來', order);
  const base = S.coupleModel(CIN, { now: NOW }), m = base.monthOfAge('you', 55), b0 = base.best('you', m);
  [[{ more: -0.5 }, 'le', '少花'], [{ save: 0.5 }, 'le', '多存'], [{ gapB: 1 }, 'ge', '另一半收入中斷一年'], [{ cutA: 20 }, 'ge', '你收入少兩成'], [{ inf: 1 }, 'ge', '通膨多 1%'], [{ dep: 0.5 }, 'ge', '存款利率降'], [{ li: 80 }, 'ge', '勞保只領八成']].forEach(([sel, how, name]) => {
    const M = S.coupleModel(CIN, { now: NOW, sel }), b = M.best('you', m);
    const good = b === null ? how === 'ge' : how === 'le' ? b <= b0 : b >= b0;
    check('調調看「' + name + '」：另一半最快的時間往' + (how === 'le' ? '早' : '晚') + '的方向', good, [b0, b]);
  });
  const H = S.coupleModel(CIN, { now: NOW, sel: { endB: 95 } });
  check('活到（另一半）95 歲：算到較晚過世的那位', H.describe(H.MA, H.MB).H === H.PB.tE && H.PB.tE > H.PA.tE);
}

section('對稱與輸入錯誤');
{
  const sym = { asset: '500', spend: '5', house: false, car: false, kidsOn: false, parOn: false, pre: {}, you: { birth: '1980-06', workStart: '25', inc: '7', pre: {} }, partner: { birth: '1984-02', workStart: '24', inc: '5', pre: {} } };
  const sw = Object.assign({}, sym, { you: sym.partner, partner: sym.you });
  const M = S.coupleModel(sym, { now: NOW }), W = S.coupleModel(sw, { now: NOW }), P = M.plans(), Q = W.plans();
  check('兩人對調（沒有跟年齡綁的家庭支出時）：「你先退到底」變成「另一半先退到底」', P.youFirst && Q.partnerFirst && P.youFirst.ma === Q.partnerFirst.mb && P.youFirst.mb === Q.partnerFirst.ma, [P.youFirst && [P.youFirst.ma, P.youFirst.mb], Q.partnerFirst && [Q.partnerFirst.ma, Q.partnerFirst.mb]]);
  check('一起退的月份相同', P.together && Q.together && P.together.ma === Q.together.ma);
  const e1 = S.coupleModel(Object.assign({}, sym, { partner: Object.assign({}, sym.partner, { birth: '' }) }), { now: NOW });
  check('另一半沒填出生年月：指出是另一半', e1.error && e1.who === 'partner', e1);
  const e2 = S.coupleModel(Object.assign({}, sym, { spend: '' }), { now: NOW });
  check('我們家沒填生活費：指出是我們家', e2.error && e2.who === 'home', e2);
  const car = S.coupleModel(Object.assign({}, sym, { carsOn: true, cars: [{ pay: '1', yrs: '5' }, { pay: '0.8', yrs: '3' }] }), { now: NOW });
  check('兩台車貸：一起退的時間變晚', car.plans().together.ma > P.together.ma, [P.together.ma, car.plans().together.ma]);
  const car1 = S.coupleModel(Object.assign({}, sym, { carsOn: true, cars: [{ pay: '1', yrs: '5' }] }), { now: NOW });
  check('一台比兩台早（車貸清單每一台都有算進去）', car1.plans().together.ma < car.plans().together.ma && car1.plans().together.ma > P.together.ma);
  const ce = S.coupleModel(Object.assign({}, sym, { carsOn: true, cars: [{ pay: '1', yrs: '' }] }), { now: NOW });
  check('車貸沒填還剩幾年：指出是我們家、第幾台', ce.error && ce.who === 'home' && /第 1 台車貸還剩幾年/.test(ce.error), ce);
  const p2 = S.coupleModel(Object.assign({}, sym, { partner: Object.assign({}, sym.partner, { parOn: true, par: '1', parMode: 'keep' }) }), { now: NOW });
  check('另一半那邊的孝親費也算進家用（退休時間變晚）', p2.plans().together.ma > P.together.ma, [P.together.ma, p2.plans().together.ma]);
}

section('效能');
{
  const t0 = Date.now(); for (let k = 0; k < 5; k++) { const M = S.coupleModel(CIN, { now: NOW }); M.plans(); M.best('you', M.monthOfAge('you', 55)); M.exchange('you', M.monthOfAge('you', 55)); }
  const ms = (Date.now() - t0) / 5;
  check('一次完整的畫面（三個方案＋滑桿＋換算比例）平均 ' + Math.round(ms) + ' 毫秒，低於 1 秒', ms < 1000, ms);
}

console.log('\n' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
