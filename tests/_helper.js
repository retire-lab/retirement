/* 測試共用：輸入樣板、建立引擎、迷你測試框架（不需要任何套件） */
'use strict';
const assert = require('assert');
const SP5 = require('../src/engine.js');
const NOW = { y: 2026, m: 10 };
const ZERO = { inf: 0, rPre: 0, rPost: 0, rLs: 0, pensions: false, np: false, nhi: false };

function inputs(over) {
  const base = {
    birth: '1976-10', workStart: '25', asset: '900', inc: '10', spend: '5',
    house: false, car: false, kidsOn: false, parOn: false, oldOn: false,
    housePay: '', houseYrs: '', housePre: false, housePreAge: '', houseRate: '',
    carPay: '', carYrs: '', par: '', parMode: 'keep', parYrs: '',
    oHire: '', oYrs: '', oWage: '', kids: [{ bym: '', path: 'grad', costs: {} }],
    pre: { liYears: '', w60: '', lsBal: '', lsWage: '', lsYears: '', liClaim: '', self: '0', endAge: '', nhiDep: false }
  };
  const o = Object.assign(base, JSON.parse(JSON.stringify(over || {})));
  if (over && over.pre) o.pre = Object.assign({}, base.pre, over.pre);
  return o;
}
function engine(over, assume, now) { return SP5.create(inputs(over), { now: now || NOW, assume: assume }); }
function near(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg ? msg + '：' : '') + '預期 ' + expected + '，實際 ' + actual);
}
function suite(title) {
  const tests = [];
  return {
    test: (name, fn) => tests.push([name, fn]),
    run: () => {
      let pass = 0, fail = 0;
      console.log('\n■ ' + title);
      for (const [name, fn] of tests) {
        try { fn(); pass++; console.log('  ✓ ' + name); }
        catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + e.message); }
      }
      console.log('  ' + pass + ' 通過，' + fail + ' 失敗');
      return fail;
    }
  };
}
module.exports = { assert, SP5, NOW, ZERO, inputs, engine, near, suite };
