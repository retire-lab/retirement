#!/usr/bin/env node
/* data/ 資料檔的完整性：改資料時手誤，這裡會擋下來 */
'use strict';
const fs = require('fs'), path = require('path');
const { assert, SP5, suite } = require('./_helper');
const D = require('../scripts/load-data.js')();
const S = suite('資料檔');
const t = S.test;
const today = new Date().toISOString().slice(0, 10);

t('平均餘命表：60 到 85 歲每一歲都有', () => { for (let a = 60; a <= 85; a++) assert.ok(D.life.some((r) => r.age === a), '缺 ' + a + ' 歲'); });
t('平均餘命表：沒有重複的年齡', () => assert.strictEqual(new Set(D.life.map((r) => r.age)).size, D.life.length));
t('平均餘命表：採計值 = 生命表數字四捨五入', () => D.life.forEach((r) => assert.strictEqual(r.T, Math.round(r.ex_111), r.age + ' 歲：' + r.ex_111 + ' → ' + r.T)));
t('平均餘命表：隨年齡遞減（生命表）、不增加（採計值）', () => {
  const L = D.life.slice().sort((a, b) => a.age - b.age);
  for (let i = 1; i < L.length; i++) { assert.ok(L[i].ex_111 < L[i - 1].ex_111, L[i].age + ' 歲'); assert.ok(L[i].T <= L[i - 1].T, L[i].age + ' 歲'); }
});
t('平均餘命表：抽查勞保局公布值（60 歲 23 年、65 歲 19 年、70 歲 16 年）', () => {
  assert.strictEqual(SP5.lifeYears(60), 23); assert.strictEqual(SP5.lifeYears(65), 19); assert.strictEqual(SP5.lifeYears(70), 16);
});
['np', 'nhi', 'caps', 'deposit'].forEach((k) => {
  t(k + '：至少一列，生效日格式 YYYY-MM-DD', () => { assert.ok(D[k].length > 0); D[k].forEach((r) => assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.effective), r.effective)); });
  t(k + '：至少有一列已經生效（不能全是未來的表）', () => assert.ok(D[k].some((r) => r.effective <= today)));
  t(k + '：每一列都寫了來源', () => D[k].forEach((r) => assert.ok(String(r.source || '').length > 4)));
  t(k + '：生效日不重複', () => assert.strictEqual(new Set(D[k].map((r) => r.effective)).size, D[k].length));
});
t('國保：115 年月投保金額 21,103、自付 1,329（= 21,103 × 10.5% × 60%，四捨五入）', () => {
  const r = SP5.pick(D.np, 2026, 10); assert.strictEqual(r.insured_amount, 21103); assert.strictEqual(r.self_monthly, 1329);
  assert.strictEqual(Math.round(21103 * 0.105 * 0.6), 1329);
});
t('健保第六類：本人自付 826 = 平均保險費 1,377 × 60%（四捨五入）', () => {
  const r = SP5.pick(D.nhi, 2026, 10); assert.strictEqual(r.self_monthly, 826); assert.strictEqual(Math.round(r.avg_premium * 0.6), 826);
});
t('依年度挑表：取「生效日 ≤ 指定年月」的最新一列', () => {
  const rows = [{ effective: '2026-01-01', v: 1 }, { effective: '2027-01-01', v: 2 }, { effective: '2025-01-01', v: 0 }];
  assert.strictEqual(SP5.pick(rows, 2026, 12).v, 1); assert.strictEqual(SP5.pick(rows, 2027, 1).v, 2); assert.strictEqual(SP5.pick(rows, 2024, 1).v, 0);
});
t('依年度挑表：引擎用的是今天適用的那一列（加入明年的新表不影響今年）', () => {
  const rows = D.np.concat([{ effective: '2099-01-01', insured_amount: 99999, self_monthly: 9999, source: '測試' }]);
  assert.strictEqual(SP5.pick(rows, 2026, 10).self_monthly, 1329);
});
t('勞退分級表：62 級、級數連續', () => { const g = D.lsGrades.map((r) => r.grade); assert.strictEqual(g.length, 62); g.forEach((x, i) => assert.strictEqual(x, i + 1)); });
t('勞退分級表：月提繳工資遞增，且等於該級上限（最後一級除外）', () => {
  const L = D.lsGrades; for (let i = 0; i < L.length; i++) { if (i) assert.ok(L[i].monthly_wage > L[i - 1].monthly_wage); if (L[i].max_wage !== '') assert.strictEqual(L[i].monthly_wage, L[i].max_wage); }
});
t('勞退分級表：最後一級沒有上限、月提繳工資 = caps.csv 的勞退上限 150,000', () => {
  const last = D.lsGrades[D.lsGrades.length - 1]; assert.strictEqual(last.max_wage, ''); assert.strictEqual(last.monthly_wage, SP5.pick(D.caps, 2026, 10).ls_wage_cap);
});
t('勞退分級表：所有列同一個生效日 2026-01-01', () => assert.ok(D.lsGrades.every((r) => r.effective === '2026-01-01')));
t('勞退分級表：第一列寫了完整來源（其餘「同上」）', () => { assert.ok(/1140153598/.test(D.lsGrades[0].source)); assert.ok(D.lsGrades.slice(1).every((r) => r.source === '同上')); });
t('勞保分級表：11 級、級數連續、月投保薪資遞增', () => { const L = D.liGrades; assert.strictEqual(L.length, 11); L.forEach((r, i) => { assert.strictEqual(r.grade, i + 1); if (i) assert.ok(r.monthly_wage > L[i - 1].monthly_wage); }); });
t('勞保分級表：第 1 級是最低工資 29,500；第 2 到 10 級的月投保薪資等於該級上限', () => {
  const L = D.liGrades; assert.strictEqual(L[0].monthly_wage, 29500); L.slice(1, 10).forEach((r) => assert.strictEqual(r.monthly_wage, r.max_wage));
});
t('勞保分級表：最高一級沒有上限、月投保薪資 = caps.csv 的勞保上限 45,800', () => {
  const last = D.liGrades[D.liGrades.length - 1]; assert.strictEqual(last.max_wage, ''); assert.strictEqual(last.monthly_wage, SP5.pick(D.caps, 2026, 10).li_wage_cap);
});
t('勞保與勞退分級表：30,300 到 45,800 之間的級距完全相同', () => {
  const li = D.liGrades.filter((r) => r.monthly_wage >= 30300).map((r) => r.monthly_wage);
  const ls = D.lsGrades.filter((r) => r.monthly_wage >= 30300 && r.monthly_wage <= 45800).map((r) => r.monthly_wage);
  assert.deepStrictEqual(li, ls);
});
t('caps.csv：上限都已由官方分級表確認', () => assert.ok(D.caps.every((r) => r.status === 'confirmed')));
t('存款利率：在合理範圍（0–5%），單位是 %', () => D.deposit.forEach((r) => assert.ok(r.rate > 0 && r.rate < 5, r.rate)));
t('params：勞退年金化利率在合理範圍（0.5%–5%）', () => { const r = D.params.ls_annuity_rate.value; assert.ok(r > 0.005 && r < 0.05); });
t('params：勞保兩式與減給展延參數齊全', () => ['min_years', 'f1_rate', 'f1_add', 'f2_rate', 'adjust_per_year', 'adjust_max_years'].forEach((k) => assert.ok(typeof D.params.li[k] === 'number', k)));
t('params：每一項都有來源', () => Object.entries(D.params).forEach(([k, v]) => { if (k !== 'version') assert.ok(v.source, k + ' 缺來源'); }));
t('SOURCES.md：每個資料檔都有登記', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'data', 'SOURCES.md'), 'utf8');
  fs.readdirSync(path.join(__dirname, '..', 'data')).filter((f) => /\.(csv|json)$/.test(f)).forEach((f) => assert.ok(md.includes(f), f + ' 沒有登記在 SOURCES.md'));
});
t('暫定的數字有標記（caps 的 status），提醒要確認', () => assert.ok(D.caps.every((r) => r.status)));

process.exit(S.run() ? 1 : 0);
