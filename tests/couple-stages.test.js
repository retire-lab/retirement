/* tests/couple-stages.test.js — 夫妻的「每個階段」（v1.0.1）
 * 鐵律：把每個月的現金流拆成明細、切成階段之後，最後的存款必須等於引擎 run().end（household 的算法），一分不差。
 * 另外：階段連續、覆蓋整段期間；各段明細加起來等於逐月明細；畫布例子的階段切點與事件正確；一次領記成事件，不切成一段。 */
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
const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

function invariants(M, ma, mb, tag, fails) {
  const st = M.stages(ma, mb), br = M.breakdown(ma, mb), h = M.run(ma, mb), g = st.stages;
  if (!close(st.end, h.end) || !close(br.end, h.end)) fails.push(tag + ' 最後存款 ' + st.end + ' vs ' + h.end);
  if (!(g.length && g[0].s === 0 && g[g.length - 1].e === h.H && g.every((x, i) => x.e > x.s && (!i || x.s === g[i - 1].e)))) fails.push(tag + ' 階段不連續');
  const keys = Object.keys(g[0].avg);
  keys.forEach((k) => {
    const fromStages = g.reduce((s, x) => s + x.avg[k] * x.months, 0) + g.reduce((s, x) => s + x.lumps.filter((l) => l.key === k).reduce((a, l) => a + l.amt, 0), 0);
    const fromRows = br.rows.reduce((s, r) => s + r[k], 0);
    if (!close(fromStages, fromRows)) fails.push(tag + ' 項目 ' + k + ' 加總不合：' + fromStages + ' vs ' + fromRows);
  });
  br.rows.forEach((r) => { if (!Object.keys(r).every((k) => typeof r[k] !== 'number' || isFinite(r[k]))) fails.push(tag + ' 第 ' + r.t + ' 月有非數字'); });
  return st;
}

section('鐵律：拆成階段後的最後存款＝引擎算的（畫布例子的三種安排，加上滑桿幾個位置）');
{
  const M = S.coupleModel(CIN, { now: NOW }), P = M.plans(), fails = [];
  [['你先退', P.youFirst], ['一起退', P.together], ['另一半先退', P.partnerFirst]].forEach(([n, d]) => invariants(M, d.ma, d.mb, n, fails));
  const m55 = M.monthOfAge('you', 55); invariants(M, m55, M.best('you', m55), '你 55 歲', fails);
  invariants(M, P.together.ma + 24, P.together.ma + 24, '一起退晚兩年', fails);
  check('最後存款一分不差、階段連續、各段明細加起來＝逐月明細、沒有非數字', fails.length === 0, fails);
}

section('鐵律：40 對隨機夫妻 × 3 種安排');
{
  const fails = []; let n = 0;
  for (let i = 0, k = 0; k < 40 && i < 600; i++) {
    const a = makeCase(i), b = makeCase((i * 13 + 7) % 600);
    if (a.pre && a.pre.nhiDep) continue;
    const cin = Object.assign({}, a, { you: { birth: a.birth, workStart: a.workStart, inc: a.inc, pre: Object.assign({}, a.pre, { gaps: [] }) }, partner: { birth: b.birth, workStart: b.workStart, inc: b.inc, pre: Object.assign({}, b.pre, { gaps: [] }) } });
    const M = S.coupleModel(cin, { now: NOW }); if (M.error) continue; k++;
    const P = M.plans();
    [P.youFirst, P.together, P.partnerFirst].forEach((d, j) => { if (d) { invariants(M, d.ma, d.mb, '第 ' + i + ' 組方案 ' + (j + 1), fails); n++; } });
  }
  check('隨機夫妻的 ' + n + ' 個組合：最後存款一分不差、階段連續、明細加總一致', fails.length === 0, fails.slice(0, 3));
}

section('畫布例子「你先退」的階段切點與事件');
{
  const M = S.coupleModel(CIN, { now: NOW }), d = M.plans().youFirst, g = M.stages(d.ma, d.mb).stages, at = (ym) => g.find((x) => x.ymS === ym);
  check('第一段從現在（2026/10）開始，兩人都在工作', g[0].ymS === '2026/10' && g[0].avg.wageA > 0 && g[0].avg.wageB > 0);
  const s1 = at('2034/11');
  check('2034/11：你退休 → 你開始繳國保、健保依附在另一半名下', s1 && s1.removed.includes('wageA') && s1.added.includes('npPremA') && s1.added.includes('nhiDep'), s1 && [s1.added, s1.removed]);
  const s2 = at('2050/03');
  check('2050/03（你 65 歲）：開始領勞保、國保年金，國保停繳', s2 && s2.added.includes('liA') && s2.added.includes('npA') && s2.removed.includes('npPremA'), s2 && [s2.added, s2.removed]);
  const s3 = at('2053/07');
  check('2053/07：另一半退休，開始領勞保、勞退', s3 && s3.removed.includes('wageB') && s3.added.includes('liB') && s3.added.includes('lsB'));
  const last = g[g.length - 1];
  check('最後一段：你到了「活到」→ 生活費降到七成、另一半開始領遺屬年金', last.diedA && last.livingDrop && last.added.includes('survB'), last && [last.added, last.diedA, last.livingDrop]);
  check('房貸繳完、孩子的教育費結束都有自己的切點', g.some((x) => x.removed.includes('loan')) && g.some((x) => x.removed.includes('kid')));
}

section('一次領記成事件，不切成一個月的階段');
{
  const lump = Object.assign({}, CIN, { you: { birth: '1970-05', workStart: '30', inc: '6', pre: { liMode: 'lump', liPre09: true, endAge: '70' } } });
  const M = S.coupleModel(lump, { now: NOW }), d = M.plans().youFirst;
  const g = M.stages(d.ma, d.mb).stages, all = g.flatMap((x) => x.lumps);
  check('勞保一次領：記在那一段的事件裡', all.some((l) => l.key === 'liA' && l.amt > 0), all);
  check('70 歲走、勞退月領期間：專戶餘額回到家裡，也是事件', all.some((l) => l.key === 'lsBack' && l.amt > 0), all);
  check('沒有只有一個月的階段（除了最後一段）', g.slice(0, -1).every((x) => x.months > 1), g.filter((x) => x.months <= 1).map((x) => x.ymS));
  check('最後存款仍然一分不差', close(M.stages(d.ma, d.mb).end, M.run(d.ma, d.mb).end));
}

console.log('\n' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
