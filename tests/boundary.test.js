/*
 * 邊界測試（v0.9.1）
 * 1. 退休當月：最後一筆薪水在退休前一個月；勞退、勞保、國保在請領那個月才開始，前一個月是 0
 * 2. 跨瀏覽器：Math.pow 在不同瀏覽器的最後一位可能不同（SP2 的 Safari 經驗）。
 *    把 Math.pow 的結果往上、往下各偏一點點（相對 4e-16，比實際瀏覽器差異還大），最快退休的月份必須完全一樣
 */
'use strict';
const assert = require('assert');
const SP5 = require('../src/engine.js');
const { inputs } = require('./_helper');
const now = { y: 2026, m: 10 };
let ok = 0, bad = 0;
const t = (name, fn) => { try { fn(); ok++; console.log('  ✓ ' + name); } catch (e) { bad++; console.log('  ✗ ' + name + '\n      ' + e.message); } };
const eng = (o) => { const en = SP5.create(inputs(o), { now }); en.sync(); return en; };

console.log('■ 退休當月的逐月邊界');
const A = { birth: '1986-06', workStart: '25', asset: '500', inc: '9', spend: '4.5' };
t('薪水：退休前一個月還有，退休當月起沒有', () => {
  const en = eng(A), P = en.profile(), e = en.earliest(), Q = en.evalR(P, e).Q;
  assert.ok(en.flowsM(P, Q, Q.tR - 1).work > 0, '退休前一個月有薪水'); assert.strictEqual(en.flowsM(P, Q, Q.tR).work, 0); assert.strictEqual(en.flowsM(P, Q, Q.tR + 1).work, 0);
});
t('勞退：60 歲那個月開始領，前一個月是 0（53 歲 6 個月退休）', () => {
  const en = eng(A), P = en.profile(), Q = en.evalR(P, en.earliest()).Q, t60 = en.tOfAge(60);
  assert.strictEqual(en.flowsM(P, Q, t60 - 1).ls, 0); assert.ok(en.flowsM(P, Q, t60).ls > 0);
});
t('勞保、國保：65 歲那個月開始領，前一個月是 0', () => {
  const en = eng(A), P = en.profile(), Q = en.evalR(P, en.earliest()).Q, t65 = en.tOfAge(65);
  ['li', 'np'].forEach((k) => { assert.strictEqual(en.flowsM(P, Q, t65 - 1)[k], 0, k + ' 前一個月'); assert.ok(en.flowsM(P, Q, t65)[k] > 0, k + ' 當月'); });
});
t('退休當月：沒有薪水、還沒有勞退的那段（橋接期）每個月都只有支出', () => {
  const en = eng(A), P = en.profile(), Q = en.evalR(P, en.earliest()).Q;
  for (let tt = Q.tR; tt < en.tOfAge(60); tt++) { const f = en.flowsM(P, Q, tt); assert.ok(f.work === 0 && f.ls === 0 && f.li === 0 && f.net < 0, '第 ' + tt + ' 個月'); }
});
t('60 歲以後退休：退休當月薪水停、勞退同一個月開始（不重疊、不遺漏）', () => {
  const en = eng({ birth: '1966-03', workStart: '25', asset: '100', inc: '6', spend: '4' }), P = en.profile(), e = en.earliest() || 64, Q = en.evalR(P, e).Q;
  const b = en.flowsM(P, Q, Q.tR - 1), a = en.flowsM(P, Q, Q.tR);
  assert.ok(b.work > 0 && b.ls === 0, '前一個月：只有薪水'); assert.ok(a.work === 0 && a.ls > 0, '當月：薪水停、勞退開始');
});

console.log('■ 跨瀏覽器：Math.pow 的最後一位不同，最快退休的月份要一樣');
const PERSONAS = [
  A, { birth: '1974-11', workStart: '25', asset: '450', inc: '9', spend: '4' },
  { birth: '1978-05', workStart: '24', asset: '380', inc: '9.5', spend: '4', house: true, housePay: '2.8', houseYrs: '12', kidsOn: true, kids: [{ bym: '2012-09', path: 'grad', costs: { jun: '8', sen: '10', uni: '18', grad: '25' } }] },
  { birth: '1990-03', workStart: '23', asset: '120', inc: '6', spend: '3.2' }, { birth: '1968-11', workStart: '30', asset: '50', inc: '6', spend: '5' },
  { birth: '1980-01', workStart: '22', asset: '900', inc: '12', spend: '6', car: true, carPay: '1.2', carYrs: '3' },
  { birth: '1972-07', workStart: '28', asset: '1500', inc: '15', spend: '8', parOn: true, par: '1' },
  { birth: '1995-12', workStart: '24', asset: '30', inc: '4.5', spend: '2.5' }
];
const earliestWith = (pow, o, sel) => { const orig = Math.pow; Math.pow = pow; try { const sc = SP5.scenario(inputs(o), sel || {}, { now, maxAge: 80 }); return sc.e; } finally { Math.pow = orig; } };
const real = Math.pow, up = (a, b) => real(a, b) * (1 + 4e-16), dn = (a, b) => real(a, b) * (1 - 4e-16);
PERSONAS.forEach((o, i) => {
  [[{}, '原始'], [{ more: -2000 }, '少花 2,000'], [{ inf: 1 }, '通膨多 1%'], [{ dep: 0.5 }, '利率降 0.5']].forEach(([sel, lab]) => {
    t('人物 ' + (i + 1) + '（' + o.birth + '）' + lab + '：Math.pow 偏上、偏下，最快退休都一樣', () => {
      const e0 = earliestWith(real, o, sel), e1 = earliestWith(up, o, sel), e2 = earliestWith(dn, o, sel);
      assert.ok(e0 === e1 && e0 === e2, '正常 ' + e0 + '、偏上 ' + e1 + '、偏下 ' + e2);
    });
  });
});
t('最快退休那個月的缺口不是剛好卡在 0（離 0 至少 1 元，不會因為最後一位而翻轉）', () => {
  PERSONAS.forEach((o) => { const en = eng(o), P = en.profile(), e = en.earliest(); if (e === null) return; const ev = en.evalR(P, e); assert.ok(ev.gap <= -1 || ev.gap === 0, o.birth + ' 的缺口 ' + ev.gap + '（最快那個月一定 ≤ 0；不能落在 -1～0 之間的灰色地帶）'); });
});
console.log('  ' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
