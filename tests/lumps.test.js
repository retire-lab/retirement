/* tests/lumps.test.js — 養老預備金與未來的大筆收支（v1.0.2）
 * 預備金：退休後存款任何時候都不低於它；「不留的話」可以比較
 * 大筆收支：某個月一筆錢進出；快速總數 netM 與明細 flowsM 一致；事件、驗證；夫妻的「另一半幾歲」；每個階段的鐵律 */
'use strict';
const S = require('../src/engine.js');
const { inputs } = require('./_helper');
const NOW = { y: 2026, m: 10 };
let ok = 0, bad = 0;
function check(name, cond, detail) { if (cond) { ok++; console.log('  ✓ ' + name); } else { bad++; console.log('  ✗ ' + name + (detail !== undefined ? '：' + JSON.stringify(detail).slice(0, 300) : '')); } }
function section(t) { console.log('\n■ ' + t); }
const BASE = { birth: '1978-05', workStart: '24', asset: '450', inc: '9', spend: '4' };
function en(over) { const e = S.create(inputs(Object.assign({}, BASE, over || {})), { now: NOW }); e.sync(); return e; }
const at = (e, x) => (x === null ? null : e.ageText(x));

section('單人：養老預備金');
{
  const e0 = en(), e1 = en({ reserve: '48' });
  check('不填預備金：55 歲 1 個月（跟原本一樣）', at(e0, e0.earliest()) === '55 歲 1 個月', at(e0, e0.earliest()));
  check('留 48 萬（一年生活費）：55 歲 5 個月', at(e1, e1.earliest()) === '55 歲 5 個月', at(e1, e1.earliest()));
  check('「不留的話」可以直接比較：earliest({ noReserve: true })＝不填的結果', e1.earliest({ noReserve: true }) === e0.earliest());
  const P = e1.profile(), R = e1.earliest(), Q = e1.evalR(P, R).Q; let B = e1.evalR(P, R).proj, min = Infinity;
  for (let t = Q.tR; t < P.tE; t++) { if (B < min) min = B; B = (B + e1.netM(P, Q, t)) * (1 + e1.mrates().post); }
  check('照最快的時間退休：退休後存款每個月月初都不低於 48 萬', min >= 480000 - 1, Math.round(min));
  check('預備金填錯：寫出原因', /養老預備金請填數字/.test(en({ reserve: 'abc' }).validate() || ''));
  check('預備金空白：沒有錯誤', !en({ reserve: '' }).validate());
}

section('單人：未來的大筆收支');
{
  const e0 = en();
  const out = en({ lumpsOn: true, lumps: [{ name: '換車', kind: 'out', amt: '80', when: 'age', val: '60' }] });
  const inn = en({ lumpsOn: true, lumps: [{ name: '儲蓄險到期', kind: 'in', amt: '150', when: 'age', val: '58' }] });
  check('60 歲換車 80 萬：最快退休變晚', out.earliest() > e0.earliest(), [at(e0, e0.earliest()), at(out, out.earliest())]);
  check('58 歲儲蓄險到期 150 萬：最快退休變早', inn.earliest() < e0.earliest(), [at(e0, e0.earliest()), at(inn, inn.earliest())]);
  check('沒打開大筆收支（清單有東西也不算）：跟原本一樣', en({ lumpsOn: false, lumps: [{ kind: 'out', amt: '80', when: 'age', val: '60' }] }).earliest() === e0.earliest());
  const P = out.profile(), Q = out.evalR(P, 55).Q, t60 = out.tOfAge(60);
  let same = true; for (let t = 0; t < P.tE; t++) if (Math.abs(out.netM(P, Q, t) - out.flowsM(P, Q, t).net) > 1e-6) same = false;
  check('快速總數 netM＝明細 flowsM（每個月）', same);
  check('換車那個月：明細有「大筆支出」80 萬', Math.abs(out.flowsM(P, Q, t60).lumpOut - 800000) < 1e-6 && out.flowsM(P, Q, t60 - 1).lumpOut === 0);
  check('那個月的事件寫「換車：一次付出 80 萬」', out.eventsAt(P, Q, t60).some((x) => /換車：一次付出 80 萬/.test(x.text)));
  check('結果頁的階段事件也有它', out.impactEvents(P, 55, Q).some((x) => x.t === '換車' && x.d === 'lumpout'));
  const ym = en({ lumpsOn: true, lumps: [{ name: '出國', kind: 'out', amt: '30', when: 'ym', val: '203006' }] }), Py = ym.profile();
  check('用西元年月填（203006）：在 2030 年 6 月', Py.lumpList.length === 1 && Py.lumpList[0].t === (2030 * 12 + 5) - (2026 * 12 + 9));
  check('沒填名稱：叫「第 1 筆大筆支出」', en({ lumpsOn: true, lumps: [{ kind: 'out', amt: '30', when: 'age', val: '60' }] }).profile().lumpList[0].name === '第 1 筆大筆支出');
  const err = (l) => en({ lumpsOn: true, lumps: [l] }).validate() || '';
  check('金額沒填：寫出第幾筆', /第 1 筆大筆收支：金額還沒填/.test(err({ kind: 'out', amt: '', when: 'age', val: '60' })));
  check('年月打錯：寫出格式', /第 1 筆大筆收支：時間請用西元年月/.test(err({ kind: 'out', amt: '10', when: 'ym', val: '2030-13' })));
  check('時間在今天以前：擋下', /時間要在今天以後/.test(err({ kind: 'out', amt: '10', when: 'ym', val: '202001' })));
}

section('夫妻：養老預備金與大筆收支');
{
  const kids = [{ bym: '2016-04', path: 'uni', costs: { ele: '5', jun: '6', sen: '8', uni: '15' } }, { bym: '2019-09', path: 'uni', costs: { pre: '10', ele: '5', jun: '6', sen: '8', uni: '15' } }];
  const CIN = { asset: '300', spend: '7', house: true, housePay: '2', houseYrs: '20', kidsOn: true, kids, pre: {}, you: { birth: '1985-03', workStart: '25', inc: '8', pre: {} }, partner: { birth: '1988-07', workStart: '25', inc: '6.5', pre: {} } };
  const M0 = S.coupleModel(CIN, { now: NOW }), M1 = S.coupleModel(Object.assign({}, CIN, { reserve: '84' }), { now: NOW });
  const A = M0.A, P0 = M0.plans(), P1 = M1.plans();
  check('留 84 萬：你先退 49 歲 8 個月 → 50 歲 6 個月；一起退 2043/08 → 2044/01', A.ageText(P1.youFirst.ageA) === '50 歲 6 個月' && P1.together.ymA === '2044/01', [A.ageText(P1.youFirst.ageA), P1.together.ymA]);
  check('「不留的話」：sel.noReserve 回到原本', S.coupleModel(Object.assign({}, CIN, { reserve: '84' }), { now: NOW, sel: { noReserve: true } }).plans().youFirst.ma === P0.youFirst.ma);
  check('留預備金的組合：有人退休後，存款每個月都不低於 84 萬', M1.run(P1.youFirst.ma, P1.youFirst.mb).min >= 840000 - 1);
  const L = Object.assign({}, CIN, { lumpsOn: true, lumps: [{ name: '孩子 1 第一桶金', kind: 'out', amt: '100', when: 'ym', val: '203806' }, { name: '儲蓄險到期', kind: 'in', amt: '150', when: 'page', val: '55' }] });
  const ML = S.coupleModel(L, { now: NOW }), d = ML.plans().youFirst, st = ML.stages(d.ma, d.mb);
  const ev = st.stages.flatMap((g) => g.lumps);
  check('「另一半 55 歲」換成另一半 55 歲那個月（2043/07）', ev.some((x) => x.name === '儲蓄險到期' && x.ym === '2043/07' && x.key === 'lumpIn'), ev.map((x) => [x.name, x.ym]));
  check('第一桶金在 2038/06 是一筆大筆支出', ev.some((x) => x.name === '孩子 1 第一桶金' && x.ym === '2038/06' && x.key === 'lumpOut' && Math.abs(x.amt - 1e6) < 1e-6));
  check('鐵律：有大筆收支時，每個階段的最後存款仍＝引擎', Math.abs(st.end - ML.run(d.ma, d.mb).end) < 1e-6 * Math.max(1, Math.abs(st.end)));
  const Le = S.coupleModel(Object.assign({}, CIN, { lumpsOn: true, lumps: [{ name: 'x', kind: 'out', amt: '', when: 'age', val: '60' }] }), { now: NOW });
  check('大筆收支填錯：指出是我們家', Le.error && Le.who === 'home' && /大筆收支/.test(Le.error), Le);
  const Lp = S.coupleModel(Object.assign({}, CIN, { lumpsOn: true, lumps: [{ name: 'x', kind: 'out', amt: '10', when: 'page', val: '' }] }), { now: NOW });
  check('「另一半幾歲」沒填：也擋下、指出是我們家', Lp.error && Lp.who === 'home', Lp);
}

console.log('\n' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
