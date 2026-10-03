#!/usr/bin/env node
/*
 * 驗收測試：第一位真人測試者（2026-10-02）的情境與回饋。
 * 1986 年 6 月生、名下 500 萬、每月入帳 9 萬、基本生活費 4.5 萬、25 歲開始工作。
 * 每一筆回饋都要有對應的檢查；畫面部分在 tests/e2e/ui.e2e.js 的「驗收」區段。
 */
'use strict';
const { assert, SP5, NOW, inputs, near, suite } = require('./_helper');
const S = suite('驗收：第一位測試者');
const t = S.test;
const IN = inputs({ birth: '1986-06', workStart: '25', asset: '500', inc: '9', spend: '4.5' });
const en = SP5.create(IN, { now: NOW }); en.sync();
const P = en.profile(), e = en.earliest(), ev = en.evalR(P, e);
const w = (x) => Math.round(x / 1e4);

t('#2／#4／#8 不再卡在 55 歲：最快 53 歲 6 個月（2039/12）', () => { near(e, 53.5, 1e-9); assert.deepStrictEqual(en.ymOf(e), { y: 2039, m: 12 }); });
t('#1 退休時資產：1,178 萬 = 現有 500 ＋ 這段存下 711 － 通膨縮水 33', () => {
  let saved = 0; for (let t2 = 0; t2 < ev.Q.tR; t2++) saved += en.netM(P, ev.Q, t2);
  assert.strictEqual(w(ev.proj), 1178); assert.strictEqual(w(saved), 711); assert.strictEqual(500 + w(saved) - w(ev.proj), 33);
});
t('#4 「每月多存」一定有效果（不會再顯示跟原本一樣）', () => assert.ok(SP5.scenario(IN, { save: 2000 }, { now: NOW }).e < e));
t('#8 活到 85：最快時間會變早（52 歲 4 個月），在原本時間退休多出的錢也會變多', () => {
  const s85 = SP5.scenario(IN, { end: 85 }, { now: NOW }); near(s85.e, 52 + 4 / 12, 1e-9);
  assert.ok(-s85.en.evalR(s85.en.profile(s85.adj), e).gap > -ev.gap);
});
t('#10／#11 萬一收入中斷 1 年：時間晚 1 年（54 歲 6 個月），錢從多出 8 萬變成還差 129 萬', () => {
  const g = SP5.scenario(IN, { gap: 1 }, { now: NOW }); near(g.e, 54.5, 1e-9);
  assert.strictEqual(w(-ev.gap), 8); assert.strictEqual(w(g.en.evalR(g.en.profile(g.adj), e).gap), 129);
});
t('#12／#13 每月少花 4,000（調整器兩格）：最快 51 歲 7 個月；在 53 歲 6 個月退休多出 255 萬', () => {
  const c = SP5.scenario(IN, { more: -4000 }, { now: NOW }); near(c.e, 51 + 7 / 12, 1e-9);
  assert.strictEqual(w(-c.en.evalR(c.en.profile(c.adj), e).gap), 255);
});
t('#6 空窗 4 年（待業）：勞保年資估算少 4 年', () => {
  const g = inputs({ birth: '1986-06', workStart: '25', asset: '500', inc: '9', spend: '4.5', pre: { gaps: [{ sit: 'job', y: '4', m: '0' }] } });
  near(P.liYearsNow - SP5.create(g, { now: NOW }).profile().liYearsNow, 4, 1e-9);
});
t('橋接期：53 歲 6 個月到 60 歲要從存款拿出 368 萬', () => {
  let br = 0; for (let t2 = en.tOfAge(53.5); t2 < en.tOfAge(60); t2++) br += en.netM(P, ev.Q, t2);
  assert.strictEqual(w(-br), 368);
});

process.exit(S.run() ? 1 : 0);
