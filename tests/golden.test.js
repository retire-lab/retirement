/* tests/golden.test.js — 引擎重構的標準答案（v0.9.7）
 * 用固定種子產生 600 組條件，記下引擎的所有關鍵輸出，存成 tests/fixtures/golden.json。
 * 重構後的引擎必須算出一模一樣的結果：月份、年齡、事件要完全相同；金額允許 1e-6 的相對誤差（浮點運算順序）。
 *   node tests/golden.test.js           比對
 *   node tests/golden.test.js --update  重拍標準答案（只有「刻意改變計算結果」的版本才可以這樣做，並在版本紀錄寫明原因） */
'use strict';
const fs = require('fs'), path = require('path');
const S = require('../src/engine.js');
const NOW = { y: 2026, m: 10 }, FILE = path.join(__dirname, 'fixtures', 'golden.json'), N = 600;

const { makeCase } = require('./_cases');
const SELS = [{}, { gap: 1 }, { cut: 20 }, { more: -0.5 }, { save: 0.5 }, { li: 80 }, { inf: 1 }, { dep: 0.5 }, { spend: 1 }];
const r6 = (x) => (x === null || x === undefined) ? x : (typeof x === 'number' ? (isFinite(x) ? +x.toPrecision(12) : String(x)) : x);
function snap(inp) {
  const en = S.create(inp, { now: NOW }); en.sync();
  const v = en.validate(); if (v) return { invalid: v };
  const P = en.profile(), e = en.earliest(), out = { e: r6(e) };
  [e, 55, 60, 65].forEach((R, k) => {
    if (R === null || R < en.age() + 1 / 12) return;
    const ev = en.evalR(P, R), Q = ev.Q, key = 'R' + k;
    out[key] = { need: r6(ev.need), proj: r6(ev.proj), pre: r6(ev.preExhaust),
      Q: ['tR', 'liYears', 'liClaim', 'liT', 'liMonthly', 'liLump', 'liMode', 'lsClaim', 'lsT', 'lsBal', 'lsMonthly', 'lsLump', 'lsEndT', 'npMonths', 'npEndT', 'npMonthly'].map((f) => r6(Q[f])) };
    /* 每個月的現金流：各項目加總與幾個抽樣月份 */
    const tot = {}, samp = [];
    for (let t = 0; t < P.tE; t++) { const f = en.flowsM(P, Q, t); Object.keys(f).forEach((n) => { tot[n] = (tot[n] || 0) + f[n]; }); if (t % 37 === 0) samp.push(r6(f.net)); }
    out[key].tot = Object.keys(tot).sort().map((n) => n + '=' + r6(tot[n])); out[key].samp = samp;
  });
  if (e !== null) {
    const ph = en.phases(P, e, en.evalR(P, e).Q); out.ph = ph.map((x) => x.name + ':' + r6(x.f) + '-' + r6(x.t));
    const led = en.ledger(P, e); out.led = [led.length, r6(led[0] && led[0].end), r6(led[led.length - 1] && led[led.length - 1].end), r6(led.exhaust)];
    const c = en.liCompare(P, e); out.li = c ? [c.elig, r6(c.cross), c.lump && r6(c.lump.amt), c.monthly && r6(c.monthly.amt)] : null;
  }
  out.sc = SELS.map((sel) => r6(S.scenario(inp, sel, { now: NOW, maxAge: 80 }).e));
  return out;
}
function cmp(a, b, p, bad) {
  if (bad.length > 20) return;
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a))) bad.push(p + '：' + a + ' → ' + b); return; }
  if (a && b && typeof a === 'object') { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); ks.forEach((k) => cmp(a[k], b[k], p + '.' + k, bad)); return; }
  if (a !== b) bad.push(p + '：' + JSON.stringify(a) + ' → ' + JSON.stringify(b));
}
const cases = Array.from({ length: N }, (_, i) => makeCase(i)), now = cases.map((c) => JSON.parse(JSON.stringify(snap(c))));   /* 跟存檔一樣經過 JSON（undefined → null） */
if (process.argv.includes('--update')) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ note: '引擎重構的標準答案（v0.9.7 拍攝，引擎 ' + S.VERSION + '）。只有刻意改變計算結果的版本才能重拍。', n: N, results: now }));
  const valid = now.filter((x) => !x.invalid).length;
  console.log('已重拍標準答案：' + N + ' 組（有效 ' + valid + ' 組，' + now.filter((x) => x.e !== null && !x.invalid).length + ' 組算得出最快退休）');
  process.exit(0);
}
const gold = JSON.parse(fs.readFileSync(FILE, 'utf8')), bad = [];
/* v1.0.2：flowsM 多了 lumpIn、lumpOut 兩個欄位（大筆收支）。沒有大筆收支時它們都是 0；比對時去掉加總為 0 的欄位，
   兩邊才是同一套項目（新增一個永遠是 0 的欄位，不算改變計算結果） */
const dropZero = (r) => { if (r && typeof r === 'object') { Object.keys(r).forEach((k) => { const x = r[k]; if (x && Array.isArray(x.tot)) x.tot = x.tot.filter((e) => !/=0$/.test(e)); }); } return r; };
gold.results.forEach(dropZero); now.forEach(dropZero);
let same = 0;
for (let i = 0; i < N; i++) { const b0 = bad.length; cmp(gold.results[i], now[i], '第 ' + i + ' 組', bad); if (bad.length === b0) same++; }
const valid = gold.results.filter((x) => !x.invalid).length;
console.log('\n■ 引擎標準答案（' + N + ' 組，有效 ' + valid + ' 組，每組含最快退休、4 個退休年齡的需要／會有／年金、每月現金流、階段、逐年、勞保比較、9 種情境）');
if (bad.length) { console.log('  ✗ 有 ' + (N - same) + ' 組跟標準答案不同：'); bad.slice(0, 20).forEach((x) => console.log('    ' + x)); console.log('\n' + same + ' 通過，' + (N - same) + ' 失敗'); process.exit(1); }
console.log('  ✓ ' + N + ' 組全部跟標準答案相同');
console.log('\n' + N + ' 通過，0 失敗');
