#!/usr/bin/env node
/* data/ 資料檔的完整性：改資料時手誤，這裡會擋下來 */
'use strict';
const fs = require('fs'), path = require('path');
const { assert, SP5, suite } = require('./_helper');
const D = require('../scripts/load-data.js')();
const S = suite('資料檔');
const t = S.test;
const today = new Date().toISOString().slice(0, 10);

/* 生命表（v0.9.9：有生效日、表的年度另成一欄，不再寫在欄位名稱裡） */
const lifeSets = {}; D.life.forEach((r) => { (lifeSets[r.effective] = lifeSets[r.effective] || []).push(r); });
t('平均餘命表：欄位是 effective、table_year、age、life_expectancy、T（年度不在欄位名稱裡）', () => D.life.forEach((r) => ['effective', 'table_year', 'age', 'life_expectancy', 'T'].forEach((k) => assert.ok(r[k] !== undefined && r[k] !== '', k))));
t('平均餘命表：每一組（同一個生效日）60 到 85 歲每一歲都有、沒有重複', () => Object.values(lifeSets).forEach((L) => { for (let a = 60; a <= 85; a++) assert.ok(L.some((r) => r.age === a), '缺 ' + a); assert.strictEqual(new Set(L.map((r) => r.age)).size, L.length); }));
t('平均餘命表：同一組只用同一年度的生命表', () => Object.values(lifeSets).forEach((L) => assert.strictEqual(new Set(L.map((r) => r.table_year)).size, 1)));
t('平均餘命表：採計值 = 生命表數字四捨五入', () => D.life.forEach((r) => assert.strictEqual(r.T, Math.round(r.life_expectancy), r.age + ' 歲')));
t('平均餘命表：年紀越大餘命越短', () => Object.values(lifeSets).forEach((L0) => {
  const L = L0.slice().sort((a, b) => a.age - b.age);
  for (let i = 1; i < L.length; i++) { assert.ok(L[i].life_expectancy < L[i - 1].life_expectancy, L[i].age + ' 歲'); assert.ok(L[i].T <= L[i - 1].T, L[i].age + ' 歲'); }
}));
t('勞退年金化利率與生命表：生效日一一對應，而且用同一年度的生命表', () => {
  const effL = Object.keys(lifeSets).sort(), effA = D.lsAnnuity.map((r) => r.effective).sort();
  assert.deepStrictEqual(effA, effL); D.lsAnnuity.forEach((r) => assert.strictEqual(r.table_year, lifeSets[r.effective][0].table_year));
});
t('勞退年金化利率：在合理範圍（0.5%–5%），單位是 %；目前 1.1473%（110–112 年平均）', () => { D.lsAnnuity.forEach((r) => assert.ok(r.rate > 0.5 && r.rate < 5, r.rate)); assert.strictEqual(SP5.pick(D.lsAnnuity, 2026, 10).rate, 1.1473); });
t('平均餘命表：抽查勞保局公布值（60 歲 23 年、65 歲 19 年、70 歲 16 年）', () => {
  assert.strictEqual(SP5.lifeYears(60), 23); assert.strictEqual(SP5.lifeYears(65), 19); assert.strictEqual(SP5.lifeYears(70), 16);
});
['np', 'nhi', 'caps', 'deposit', 'nhiEmp', 'npBen', 'lsAnnuity', 'life'].forEach((k) => {
  t(k + '：至少一列，生效日格式 YYYY-MM-DD', () => { assert.ok(D[k].length > 0); D[k].forEach((r) => assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.effective), r.effective)); });
  t(k + '：至少有一列已經生效（不能全是未來的表）', () => assert.ok(D[k].some((r) => r.effective <= today)));
  t(k + '：每一列都寫了來源', () => D[k].forEach((r) => assert.ok(String(r.source || '').length > 4)));
  if (k !== 'life') t(k + '：生效日不重複', () => assert.strictEqual(new Set(D[k].map((r) => r.effective)).size, D[k].length));   /* 生命表一個生效日有多列（每個年齡一列） */
});
t('健保（受僱者）：115 年費率 5.17%、投保金額最低 29,500（＝最低工資）、最高 313,000', () => {
  const r = SP5.pick(D.nhiEmp, 2026, 10); assert.strictEqual(r.rate, 5.17); assert.strictEqual(r.insured_min, 29500); assert.strictEqual(r.insured_max, 313000);
  assert.strictEqual(SP5.pick(D.liGrades.filter((g) => g.grade === 1), 2026, 10).monthly_wage, r.insured_min);   /* 第 1 級跟勞保一樣都是最低工資 */
});
t('國保遺屬年金最低保障：113 年起 4,049，109～112 年 3,772（每 4 年依 CPI 調整）', () => {
  assert.strictEqual(SP5.pick(D.npBen, 2026, 10).survivor_min, 4049); assert.strictEqual(SP5.pick(D.npBen, 2023, 12).survivor_min, 3772);
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
t('params.li_lump：一次領規則有來源、取得日期、第 58 條第 2 項第 1～4 款', () => {
  const L = D.params.li_lump; assert.ok(L.source && /第 58 條/.test(L.source) && L.retrieved);
  assert.strictEqual(L.conditions.length, 4); assert.strictEqual(L.cap_months, 45); assert.strictEqual(L.cap_months_with_after60, 50);
});
/* v0.9.9 資料治理：每個 params 區塊都要回答「你是誰、從哪來、屬於哪一種」 */
const CATS = ['legal', 'product_rule', 'model_assumption', 'meta'];
t('params：每個區塊都標了 category（legal／product_rule／model_assumption／meta）', () => Object.keys(D.params).filter((x) => typeof D.params[x] === 'object').forEach((x) => assert.ok(CATS.includes(D.params[x].category), x + '：' + D.params[x].category)));
t('params：legal、product_rule、model_assumption 的區塊都有 source', () => Object.keys(D.params).filter((x) => typeof D.params[x] === 'object' && D.params[x].category !== 'meta').forEach((x) => assert.ok(String(D.params[x].source || '').length > 4, x)));
t('params：不再放有生效日、會逐年調整的年度資料（那些一律放 data/*.csv）', () => ['ls_annuity_rate', 'nhi_supplementary'].forEach((x) => assert.ok(!(x in D.params), x)));
t('資料：每張 CSV 都有 effective（生效日）或是年齡表的一部分', () => Object.keys(D).filter((x) => Array.isArray(D[x])).forEach((x) => assert.ok(D[x].every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.effective)), x)));
t('params：勞保兩式與減給展延參數齊全', () => ['min_years', 'f1_rate', 'f1_add', 'f2_rate', 'adjust_per_year', 'adjust_max_years'].forEach((k) => assert.ok(typeof D.params.li[k] === 'number', k)));
t('params：每一項都有來源', () => Object.entries(D.params).forEach(([k, v]) => { if (k !== 'version') assert.ok(v.source, k + ' 缺來源'); }));
t('params.verified：最後核對日期是合法日期，而且不是未來', () => { const v = D.params.verified; assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(v.at), v.at); const d = new Date(v.at + 'T00:00:00'); assert.ok(isFinite(d.getTime()) && d.getTime() <= Date.now(), v.at); });
t('params：同一個門檻不重複寫成不同的數字（勞保年資 15 年：li.min_years ＝ li_onetime.applies_if_years_below）', () => assert.strictEqual(D.params.li_onetime.applies_if_years_below, D.params.li.min_years));
t('params：雇主提繳率 ls.employer_rate 是 6%，而且引擎沒有寫死 0.06（v0.9.3 以前寫死在兩處）', () => { assert.strictEqual(D.params.ls.employer_rate, 0.06); assert.ok(!/0\.06\b/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8'))); });
t('SOURCES.md：每個資料檔都有登記', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'data', 'SOURCES.md'), 'utf8');
  fs.readdirSync(path.join(__dirname, '..', 'data')).filter((f) => /\.(csv|json)$/.test(f)).forEach((f) => assert.ok(md.includes(f), f + ' 沒有登記在 SOURCES.md'));
});
t('暫定的數字有標記（caps 的 status），提醒要確認', () => assert.ok(D.caps.every((r) => r.status)));

/* ---------- v0.8.1：CSV 格式不符就讓 build 失敗 ---------- */
{
  const os = require('os'), { csv } = require('../scripts/load-data.js');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp5csv-'));
  const put = (n, t) => fs.writeFileSync(path.join(tmp, n), t);
  put('ok.csv', 'effective,rate,source\n2026-01-01,1.7,台銀,一年期定存\n');
  put('quote.csv', 'effective,rate,source\n2026-01-01,"1,7",台銀\n');
  put('short.csv', 'effective,insured_amount,self_monthly,source\n2026-01-01,21103\n');
  t('CSV：最後一欄（來源）可以含逗號', () => { const r = csv('ok.csv', tmp); assert.strictEqual(r[0].rate, 1.7); assert.strictEqual(r[0].source, '台銀,一年期定存'); });
  t('CSV：出現引號 → 失敗，指出檔名與行號', () => assert.throws(() => csv('quote.csv', tmp), /quote\.csv 第 2 行：不支援引號/));
  t('CSV：欄位數不足 → 失敗，指出檔名、行號與欄位數', () => assert.throws(() => csv('short.csv', tmp), /short\.csv 第 2 行：欄位數 2，標題有 4 欄/));
  t('CSV：data/ 裡所有資料檔都通過檢查', () => fs.readdirSync(path.join(__dirname, '..', 'data')).filter((f) => f.endsWith('.csv')).forEach((f) => assert.ok(csv(f).length > 0, f)));
}

/* v0.9.9：說明文字（note）不准用中文再寫一次同一組已有的數值（數值改了說明不會跟著改）；法條條號「第 N 條／項／款」是引用，不算 */
t('params：說明文字不重寫同一組裡已有的數值（單一來源）', () => {
  const P = D.params, bad = [];
  const nums = (o, acc) => { if (o && typeof o === 'object') { for (const k in o) { if (/note|source/.test(k)) continue; nums(o[k], acc); } } else if (typeof o === 'number') { acc.add(String(o)); if (o > 0 && o < 1) acc.add(String(+(o * 100).toFixed(4))); } else if (typeof o === 'string' && /^\d{4}-\d{2}/.test(o)) { acc.add(o.slice(0, 4)); acc.add(String(+o.slice(5, 7))); } return acc; };
  const notes = (o, p, out) => { if (o && typeof o === 'object') for (const k in o) { const v = o[k]; if (typeof v === 'string' && /note/.test(k)) out.push([p + '.' + k, v]); else notes(v, p + '.' + k, out); } return out; };
  for (const g in P) { if (!P[g] || typeof P[g] !== 'object') continue; const vals = nums(P[g], new Set());
    notes(P[g], g, []).forEach(([path, txt]) => { const toks = (txt.replace(/第\s*\d+(?:\s*[、，]\s*\d+)*\s*[條項款目]/g, '').replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) || []);
      const hit = [...new Set(toks.filter((x) => vals.has(String(+x))))]; if (hit.length) bad.push(path + '：' + hit.join('、')); }); }
  assert.deepStrictEqual(bad, []);
});
process.exit(S.run() ? 1 : 0);
