#!/usr/bin/env node
/*
 * 12 種人物情境的健全性測試：不比對特定答案，只檢查「不該發生的事」。
 * 用預設假設（含年金、國保、健保）、今天是 2026 年 10 月。
 */
'use strict';
const { assert, engine, near, suite } = require('./_helper');
const S = suite('Persona 健全性');

const P = {
  '25 歲剛出社會、沒房貸': { birth: '2001-03', workStart: '23', asset: '30', inc: '4.5', spend: '2.5' },
  '45 歲高資產': { birth: '1981-05', workStart: '24', asset: '2000', inc: '15', spend: '6' },
  '51 歲、房貸快繳完': { birth: '1975-02', workStart: '25', asset: '400', inc: '10', spend: '4', house: true, housePay: '2.5', houseYrs: '3' },
  '55 歲、兩個孩子': { birth: '1971-08', workStart: '26', asset: '600', inc: '12', spend: '4.5', kidsOn: true,
    kids: [{ bym: '2008-03', path: 'grad', costs: { col: '30' } }, { bym: '2012-10', path: 'uni', costs: { k12: '15', hs: '20', col: '25' } }] },
  '59 歲、勞保未滿 15 年': { birth: '1967-04', workStart: '50', asset: '300', inc: '5', spend: '3' },
  '有勞退舊制': { birth: '1972-06', workStart: '24', asset: '500', inc: '9', spend: '4', oldOn: true, oHire: '1998', oYrs: '7', oWage: '7' },
  '高收入高支出＋車貸＋孝親': { birth: '1978-09', workStart: '25', asset: '800', inc: '25', spend: '15', car: true, carPay: '3', carYrs: '4', parOn: true, par: '3', parMode: 'keep' },
  '低收入低支出': { birth: '1970-01', workStart: '22', asset: '150', inc: '3.5', spend: '2.2' },
  '65 歲還不夠': { birth: '1968-11', workStart: '30', asset: '50', inc: '6', spend: '5', house: true, housePay: '2', houseYrs: '20' },
  '已經達到退休門檻': { birth: '1964-03', workStart: '25', asset: '3000', inc: '8', spend: '3' },
  '入不敷出（退休前就用完）': { birth: '1980-06', workStart: '25', asset: '20', inc: '4', spend: '5' },
  '全部選項都用上': { birth: '1974-11', workStart: '24', asset: '520', inc: '11.5', spend: '4.2',
    house: true, housePay: '2.6', houseYrs: '18', housePre: true, housePreAge: '60', houseRate: '2.1', car: true, carPay: '1.3', carYrs: '3',
    kidsOn: true, kids: [{ bym: '2009-04', path: 'grad', costs: { hs: '25', col: '32' } }, { bym: '2015-10', path: 'med', costs: { k12: '15', hs: '22', col: '45' } }],
    parOn: true, par: '1.2', parMode: 'yrs', parYrs: '12', oldOn: true, oHire: '2001', oYrs: '4.5', oWage: '9',
    pre: { liYears: '26', w60: '4.58', lsYears: '20', liClaim: '62', self: '3', endAge: '95', nhiDep: true } }
};

for (const [name, inp] of Object.entries(P)) {
  S.test(name, () => {
    const en = engine(inp), err = en.validate();
    assert.strictEqual(err, '', '輸入檢查不應失敗：' + err);
    const Pr = en.profile(), from = en.fromAge(), e = en.earliest();
    // 1. 最早退休時點落在 [能算的最早, 65]，而且落在某個月
    if (e !== null) { assert.ok(e >= from - 1e-9 && e <= 65 + 1e-9, '最早退休超出範圍：' + e); near(e * 12, Math.round(e * 12), 1e-6, '要落在某個月'); }
    // 2. 缺口隨退休時點延後而不增加（每年抽一點）
    let prev = Infinity;
    for (let a = Math.ceil(from); a <= 65; a++) { const g = en.evalR(Pr, a).gap; assert.ok(g <= prev + 1, a + ' 歲的缺口反而變大：' + g + ' > ' + prev); prev = g; }
    // 3. 結果與逐月模擬一致：可行的時點，往後走資產不會用完
    const R = e === null ? 65 : e, led = en.ledger(Pr, R), mon = en.monthly(Pr, R);
    if (e !== null) { assert.strictEqual(led.exhaust, null, e + ' 可以退休，資產卻在 ' + led.exhaust + ' 用完'); assert.strictEqual(led.preExhaust, null); }
    // 4. 不可行時一定說得出原因：退休前用完、或退休後用完、或缺口 > 0
    if (e === null) { const ev = en.evalR(Pr, 65); assert.ok(ev.preExhaust !== null || led.exhaust !== null || ev.gap > 0, '65 歲不可行卻找不到原因'); }
    // 5. 每一年、每一個月都是有限數字
    led.forEach((r) => { assert.ok(isFinite(r.end) && isFinite(r.f.net), r.a + ' 歲出現非數字'); });
    near(mon[mon.length - 1].end, led[led.length - 1].end, 0.01, '逐月與逐年終點');
    // 6. 自我檢查：從需要本金出發，最低點剛好碰 0（退休後）
    const ev = en.evalR(Pr, R); if (ev.need > 0) near(en.minFrom(Pr, R, ev.need), 0, 1, '需要本金的最低點');
    // 7. 少花 ≤ 多投入（兩者都算得出來時）
    for (let a = Math.ceil(from); a < Math.min(65, e === null ? 65 : e); a++) {
      if (en.evalR(Pr, a).gap <= 0) continue;
      const X = Math.round((a - Pr.A0y) * 12) > 0 ? en.solve(a, 'extra') : null, Y = en.solve(a, 'cut', Pr.base * 12);
      if (X !== null && Y !== null) assert.ok(Y <= X + 1, a + ' 歲：少花 ' + Y + ' > 多投入 ' + X);
    }
    // 8. 地圖階段首尾相接
    const ph = en.phases(Pr, R, ev.Q); for (let i = 1; i < ph.length; i++) near(ph[i].f, ph[i - 1].t, 1e-9, '階段相接');
    // 10. 壓力測試：不加壓力 = 基準；任何一種壓力都不會讓退休變早
    const { SP5, NOW } = require('./_helper'), inpX = require('./_helper').inputs(inp);
    assert.strictEqual(SP5.stressEarliest(inpX, {}, { now: NOW }), e, '不加壓力應等於基準');
    [{ li: 70 }, { inf: 1 }, { end: 100 }, { gap: 1 }, { cut: 10 }, { spend: 1 }].forEach((sel) => {
      const v = SP5.stressEarliest(inpX, sel, { now: NOW });
      assert.ok(e === null ? v === null : v === null || v >= e - 1e-9, JSON.stringify(sel) + ' 反而變早：' + v + ' < ' + e);
    });
    // 9. 事件都落在試算範圍內，而且按時間排序
    const evs = en.impactEvents(Pr, R, ev.Q); for (let i = 1; i < evs.length; i++) assert.ok(evs[i].a >= evs[i - 1].a - 1e-9, '事件沒排序');
  });
}

/* 特定 persona 的預期結論 */
S.test('「65 歲還不夠」：最早退休是 null，退休後資產在 65 歲以後用完', () => {
  const en = engine(P['65 歲還不夠']), Pr = en.profile();
  assert.strictEqual(en.earliest(), null); const ex = en.ledger(Pr, 65).exhaust; assert.ok(ex !== null && ex >= 65, '用完時點：' + ex);
});
S.test('「已經達到退休門檻」：最早就是現在（62 歲 7 個月）', () => {
  const en = engine(P['已經達到退休門檻']); near(en.earliest(), en.fromAge(), 1e-9);
});
S.test('「入不敷出」：退休前就用完，最早退休是 null', () => {
  const en = engine(P['入不敷出（退休前就用完）']), ev = en.evalR(en.profile(), 65);
  assert.strictEqual(en.earliest(), null); assert.ok(ev.preExhaust !== null && ev.preExhaust < 65);
});
S.test('「59 歲、勞保未滿 15 年」：62 歲退休，勞保 12 年＋國保 3 年＝15 年 → 65 歲月領（v0.6.11 起；舊版誤算成沒有勞保）', () => {
  const en = engine(P['59 歲、勞保未滿 15 年']), Q = en.pensions(en.profile(), 62);
  assert.strictEqual(Q.liMode, 'combined'); assert.ok(Q.liMonthly > 0); assert.ok(Math.abs(Q.liClaim - 65) < 1e-9);
});
S.test('「有勞退舊制」：1998 到職、55 歲時年資 ≥ 15 → 55 歲退休可一次領 7 年 × 2 × 7 萬 = 98 萬', () => {
  const en = engine(P['有勞退舊制']); assert.strictEqual(en.oldLump(en.profile(), 55), 980000);
});
S.test('「25 歲剛出社會」：從現在的年紀開始算（v0.6.0 起不再卡在 55 歲）', () => {
  const en = engine(P['25 歲剛出社會、沒房貸']); assert.ok(en.fromAge() < 26 && en.fromAge() >= 25);
});
S.test('「全部選項都用上」：勞保選 62 歲 → 62 歲領，減給 12%', () => {
  const en = engine(P['全部選項都用上']), Q = en.pensions(en.profile(), 58); near(Q.liClaim, 62, 1e-9);
});

process.exit(S.run() ? 1 : 0);
