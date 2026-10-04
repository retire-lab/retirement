/*
 * 官方試算器實測案例（v0.9.1）：tests/fixtures/official-cases.json 每一筆都重算一次，跟官方輸出比對。
 * 官方規則改了：先更新 fixture 的官方輸出與實測日期，再看引擎要不要跟著改。
 */
'use strict';
const assert = require('assert');
const SP5 = require('../src/engine.js');
const { inputs } = require('./_helper');
const F = require('./fixtures/official-cases.json');
let ok = 0, bad = 0;
const t = (name, fn) => { try { fn(); ok++; console.log('  ✓ ' + name); } catch (e) { bad++; console.log('  ✗ ' + name + '\n      ' + e.message); } };
const within = (v, official, c) => c.relTolerance != null ? Math.abs(v / official - 1) <= c.relTolerance : Math.abs(Math.round(v) - official) <= (c.tolerance || 0);
console.log('■ 官方試算器實測案例（' + F.cases.length + ' 筆）');
t('每一筆都有來源名稱、網址，以及實測日期（沒記錄就要寫明原因）', () => F.cases.forEach((c) => { assert.ok(c.source && c.source.name && /^https:\/\//.test(c.source.url), c.id); assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.source.measured || '') || (c.source.measured === null && /未記錄/.test(c.source.note || '')), c.id + ' 的實測日期'); }));
t('id 不重複', () => assert.strictEqual(new Set(F.cases.map((c) => c.id)).size, F.cases.length));
F.cases.forEach((c) => {
  t(c.id + '：' + c.title, () => {
    let v;
    if (c.call) v = SP5[c.call.fn].apply(null, c.call.args);
    else { const en = SP5.create(inputs(c.engine.inputs), { now: { y: 2026, m: 10 }, assume: c.engine.assume }); en.sync(); v = en.pensions(en.profile(), c.engine.at)[c.engine.field]; }
    assert.ok(within(v, c.official, c), 'SP5 ' + (Math.round(v * 100) / 100) + ' vs 官方 ' + c.official);
    (c.also || []).forEach((x) => {
      let w;
      if (x.fn) w = SP5[x.fn].apply(null, x.args);
      else if (/^round\(lsMonthlyCalc\)\*3$/.test(x.formula)) w = Math.round(SP5.lsMonthlyCalc.apply(null, c.call.args)) * 3;
      else w = Function('"use strict";return (' + x.formula + ')')();
      assert.ok(Math.abs(Math.round(w) - x.official) <= (x.tolerance || 0), x.what + '：' + Math.round(w) + ' vs 官方 ' + x.official);
    });
  });
});
console.log('  ' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
