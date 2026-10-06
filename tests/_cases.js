/* tests/_cases.js — 固定種子的隨機條件（v0.9.7，golden.test.js 與 timeline.test.js 共用）
 * makeCase(i) 每次都產生同一組條件；涵蓋孩子、房貸（含提前還清）、車貸、孝親費、勞保勞退各欄位已填未填、
 * 工作空窗、勞退舊制、一次請領、健保依附、自訂通膨與存款利率、性別、同一雇主年資 */
'use strict';
const { inputs } = require('./_helper');
/* 固定種子的亂數（mulberry32） */
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeCase(i) {
  const r = rng(1000 + i), pick = (a) => a[Math.floor(r() * a.length)], yes = (p) => r() < p;
  const by = 1962 + Math.floor(r() * 41), bm = 1 + Math.floor(r() * 12), age = 2026 - by;
  const ws = String(Math.min(age, 15 + Math.floor(r() * 16)));
  const o = { birth: by + '-' + String(bm).padStart(2, '0'), workStart: ws,
    asset: pick(['0', '30', '150', '450', '900', '2000', '6000']), inc: pick(['2.8', '4.5', '6', '9', '13', '25']), spend: pick(['1.5', '2.5', '4', '6', '9']),
    house: yes(0.4), housePay: pick(['1.2', '2', '3.5']), houseYrs: pick(['3', '8', '15', '25']), car: yes(0.2), carPay: '1', carYrs: pick(['2', '5']),
    parOn: yes(0.3), par: pick(['0.5', '1', '2']), parMode: yes(0.5) ? 'yrs' : 'keep', parYrs: pick(['5', '10', '20']), kidsOn: yes(0.35), kids: [] };
  if (o.house && yes(0.3)) { o.housePre = true; o.housePreAge = String(Math.min(age + 1 + Math.floor(r() * 6), age + Math.max(1, +o.houseYrs - 1))); o.houseRate = pick(['1.8', '2.2']); }
  if (o.kidsOn) { const n = 1 + Math.floor(r() * 3); for (let k = 0; k < n; k++) o.kids.push({ bym: (2008 + Math.floor(r() * 18)) + '-' + String(1 + Math.floor(r() * 12)).padStart(2, '0'), path: pick(['sen', 'uni', 'grad']), costs: { ele: '2', jun: '3', sen: '4', uni: '8', grad: '10' } }); }
  const pre = {};
  if (yes(0.45)) pre.liYears = String(Math.floor(r() * 36));
  if (yes(0.4)) pre.w60 = pick(['2.8', '3.6', '4.58']);
  if (yes(0.3)) pre.lsBal = pick(['5', '60', '250']);
  if (yes(0.25)) pre.lsWage = pick(['3', '4.5', '15']);
  if (yes(0.25)) pre.lsYears = String(Math.floor(r() * 20));
  if (yes(0.2)) pre.self = pick(['0', '3', '6']);
  if (yes(0.15)) pre.liClaim = pick(['60', '63', '66', '70']);
  if (yes(0.15)) pre.endAge = pick(['85', '95', '100']);
  if (yes(0.15)) pre.nhiDep = true;
  if (yes(0.2)) pre.inf = pick(['2.5', '3']);
  if (yes(0.2)) pre.dep = pick(['0.5', '1.1', '2.3', '2.5']);
  if (yes(0.2)) pre.gaps = [{ sit: pick(['parental', 'freeU', 'freeN', 'other']), y: String(Math.floor(r() * 4)), m: String(Math.floor(r() * 12)) }];
  if (by < 1983 && yes(0.25)) { pre.oldOn = true; pre.oHire = String(1990 + Math.floor(r() * 15)); pre.oYrs = String(1 + Math.floor(r() * 12)); pre.oWage = pick(['3', '4.5']); }
  if (yes(0.15)) { pre.liMode = 'lump'; pre.liPre09 = yes(0.6); if (yes(0.5)) pre.w36 = pick(['3.2', '4.4']); }
  if (yes(0.1)) pre.sex = pick(['F', 'M']);
  if (yes(0.1)) pre.sameCo = String(Math.floor(r() * 30));
  o.pre = pre;   /* inputs() 只吃一個參數，pre 要放在裡面（v0.9.8 修正：之前當成第二個參數傳，pre 全部被丟掉） */
  return inputs(o);
}
module.exports = { rng, makeCase };
