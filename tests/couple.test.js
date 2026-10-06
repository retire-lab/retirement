/* tests/couple.test.js — 夫妻規則（v0.9.8；規則與出處在 data/params.json 的 nhi_dependent、survivor）
 * 一、指定情境：用確切金額比對健保眷屬、勞保與國保遺屬年金、勞退專戶餘額、生活費
 * 二、200 組隨機夫妻：規則在每個月都成立 */
'use strict';
const S = require('../src/engine.js');
const { inputs } = require('./_helper');
const { makeCase } = require('./_cases');
const PR = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'params.json'), 'utf8'));
const NOW = { y: 2026, m: 10 }, NS = 826, EPS = 1e-6;
let ok = 0, bad = 0;
function check(name, cond, detail) { if (cond) { ok++; console.log('  ✓ ' + name); } else { bad++; console.log('  ✗ ' + name + (detail !== undefined ? '：' + JSON.stringify(detail) : '')); } return cond; }
function section(t) { console.log('\n■ ' + t); }
function mk(o, pre, role) { const en = S.create(inputs(Object.assign({}, o, { pre: pre || {} })), { now: NOW, role }); en.sync(); return { en, P: en.profile() }; }
function mem(x, R) { return { en: x.en, P: x.P, Q: x.en.pensions(x.P, R) }; }
const A0 = { birth: '1985-03', workStart: '25', asset: '300', inc: '8', spend: '7' }, B0 = { birth: '1988-07', workStart: '25', inc: '6.5' };
const kidsOf = (bys) => ({ kidsOn: true, kids: bys.map((b) => ({ bym: b, path: 'uni', costs: { ele: '2', jun: '2', sen: '2', uni: '3' } })) });

section('健保眷屬：一方沒工作、另一方在工作');
{
  const a = mk(A0, { liYears: '16' }), b = mk(B0, {}, 'person'), A = mem(a, 55), B = mem(b, 60);
  const r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules, t = A.Q.tR + 10, unit = b.en.nhiUnit(b.P);
  check('另一半月入 6.5 萬：健保一份＝ 65,000 × 5.17% × 30% ＝ 1,008', unit === 1008, unit);
  check('你退休、另一半還在工作：你不繳第六類（826）', r.waive[0][t] === 1 && a.en.personFlowsM(a.P, A.Q, t).nhiPrem === NS);
  check('改成另一半的保費多算你一份：每月多 1,008（比第六類 826 還貴）', r.nhiExtra[t] === -1008, r.nhiExtra[t]);
  check('兩人都還在工作的月份：沒有任何健保調整', r.nhiExtra[A.Q.tR - 1] === 0 && r.waive[0][A.Q.tR - 1] === 0);
}
{
  const a = mk(Object.assign({}, A0, kidsOf(['2015-03', '2016-03', '2017-03'])), { liYears: '16' }), b = mk(B0, {}, 'person'), A = mem(a, 50), B = mem(b, 60);
  const r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules;
  const t3 = Array.from({ length: B.Q.tR }, (_, t) => t).find((t) => t >= A.Q.tR && a.P.kidN[t] === 3);
  const t2 = Array.from({ length: B.Q.tR }, (_, t) => t).find((t) => t >= A.Q.tR && a.P.kidN[t] === 2);
  check('已經有 3 個孩子依附：再加配偶不用多繳（眷屬最多算 3 人）', t3 !== undefined && r.nhiExtra[t3] === 0 && r.waive[0][t3] === 1, { t3, x: r.nhiExtra[t3] });
  check('2 個孩子依附：加配偶多算 1 份', t2 !== undefined && r.nhiExtra[t2] === -b.en.nhiUnit(b.P), { t2, x: r.nhiExtra[t2] });
}
section('健保眷屬：兩人都沒工作');
{
  const a = mk(A0, { liYears: '16' }), b = mk(B0, {}, 'person'), A = mem(a, 55), B = mem(b, 55);
  const r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules, t = Math.max(A.Q.tR, B.Q.tR) + 5;
  const paid = [A, B].reduce((s, m, i) => s + m.en.personFlowsM(m.P, m.Q, t).nhiPrem * (1 - r.waive[i][t]), 0) - r.nhiExtra[t];
  check('沒有孩子：一人第六類、另一人依附，合計 826 × 2（跟各自繳一樣）', paid === NS * 2, paid);
}
{
  const a = mk(Object.assign({}, A0, kidsOf(['2016-03', '2018-03'])), { liYears: '16' }), b = mk(B0, {}, 'person'), A = mem(a, 50), B = mem(b, 50);
  const r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules;
  const t = Array.from({ length: 400 }, (_, k) => k).find((k) => k >= Math.max(A.Q.tR, B.Q.tR) && a.P.kidN[k] === 2);
  const paid = [A, B].reduce((s, m, i) => s + m.en.personFlowsM(m.P, m.Q, t).nhiPrem * (1 - r.waive[i][t]), 0) - r.nhiExtra[t];
  check('2 個孩子：戶長＋配偶＋2 孩子，826 × (1 ＋ 3) ＝ 3,304（眷屬最多 3 人）', paid === NS * 4, { t, paid });
}

section('勞保遺屬年金');
{
  /* 你勞保 28 年月領、80 歲過世；另一半勞保 16 年月領、活到 95 歲 */
  const a = mk(A0, { liYears: '28', w60: '4.58', endAge: '80' }), b = mk(B0, { liYears: '16', w60: '3.2', endAge: '95' }, 'person');
  const A = mem(a, 60), B = mem(b, 60), r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules, tD = A.P.tE;
  const half = Math.max(3000, 0.5 * A.Q.liMonthly), own = (t) => b.en.personFlowsM(b.P, B.Q, t).li;
  check('你過世前：另一半沒有遺屬年金', r.survLI[1].slice(0, tD).every((v) => v === 0));
  check('你過世後：另一半領「自己的月領」與「你月領的一半」中比較高的', Array.from({ length: 60 }, (_, k) => tD + k).every((t) => Math.abs(own(t) + r.survLI[1][t] - Math.max(own(t), half)) < EPS),
    { half: Math.round(half), own: Math.round(own(tD)), add: Math.round(r.survLI[1][tD]) });
  check('擇一：不會同時領全額的自己＋全額的遺屬年金', Array.from({ length: 60 }, (_, k) => tD + k).every((t) => own(t) + r.survLI[1][t] <= Math.max(own(t), half) + EPS));
}
{
  /* 另一半還在工作時你過世：要等他退休、而且滿 55 歲才領 */
  const a = mk(A0, { liYears: '28', w60: '4.58', endAge: '66' }), b = mk(B0, { liYears: '10', w60: '3.2' }, 'person');
  const A = mem(a, 60), B = mem(b, 65), r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules, tD = A.P.tE;
  check('另一半還在工作的月份：沒有遺屬年金（工作收入超過第 1 級）', tD < B.Q.tR && r.survLI[1].slice(tD, B.Q.tR).every((v) => v === 0), { tD, tR: B.Q.tR });
  const half = Math.max(3000, 0.5 * A.Q.liMonthly), own = (t) => b.en.personFlowsM(b.P, B.Q, t).li;
  check('另一半退休後：自己的月領與「你月領的一半」取高（這例子自己的比較高，所以不用補）', Array.from({ length: 60 }, (_, k) => B.Q.tR + k).every((t) => Math.abs(own(t) + r.survLI[1][t] - Math.max(own(t), half)) < EPS),
    { half: Math.round(half), own: Math.round(own(B.Q.tR)) });
}
{
  /* 一次請領要有 2009 年以前的勞保年資：1970 年生、22 歲開始工作 */
  const a = mk(Object.assign({}, A0, { birth: '1970-05', workStart: '22' }), { liMode: 'lump', liPre09: true, endAge: '80' }), b = mk(B0, { endAge: '95' }, 'person');
  const A = mem(a, 60), B = mem(b, 60), r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules;
  check('你選勞保一次請領：沒有月領，所以另一半沒有勞保遺屬年金', A.Q.liLump > 0 && r.survLI[1].every((v) => v === 0), A.Q.liLump);
}
{
  /* 遺屬年金最低 3,000：你勞保很短、月領很少 */
  const a = mk(A0, { liYears: '15', w60: '2.95', endAge: '80' }), b = mk(B0, { liYears: '1', endAge: '95' }, 'person');
  const A = mem(a, 65), B = mem(b, 55), r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules, tD = A.P.tE;
  const own = b.en.personFlowsM(b.P, B.Q, tD + 5).li;
  check('遺屬年金最低 3,000', A.Q.liMonthly * 0.5 < 3000 ? Math.abs(own + r.survLI[1][tD + 5] - Math.max(own, 3000)) < EPS : true, { half: A.Q.liMonthly / 2, own });
}

{
  /* 另一半勞保年資短（50 歲就退休、年資未滿 15 年靠國保併計月領），自己的月領比你的一半少 → 要補 */
  const a = mk(A0, { liYears: '28', w60: '4.58', endAge: '80' }), b = mk(B0, { liYears: '3', endAge: '95' }, 'person');
  const A = mem(a, 60), B = mem(b, 50), r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules, tD = A.P.tE;
  const half = Math.max(3000, 0.5 * A.Q.liMonthly), own = b.en.personFlowsM(b.P, B.Q, tD).li;
  check('另一半自己的月領比較少：補到「你月領的一半」', own < half && Math.abs(own + r.survLI[1][tD] - half) < EPS && r.survLI[1][tD] > 0,
    { half: Math.round(half), own: Math.round(own), add: Math.round(r.survLI[1][tD]) });
}

section('國保遺屬年金');
{
  /* 你 50 歲退休、繳國保到 65 歲；80 歲過世 */
  const a = mk(A0, { liYears: '16', endAge: '80' }), b = mk(B0, { endAge: '95' }, 'person');
  const A = mem(a, 50), B = mem(b, 62), r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules, tD = A.P.tE;
  const half = Math.max(a.en.T.NP_SURV_MIN, 0.5 * A.Q.npMonthly), own = (t) => b.en.personFlowsM(b.P, B.Q, t).np;
  check('你有國保年金', A.Q.npMonthly > 0, A.Q.npMonthly);
  check('國保遺屬年金最低保障取自 data/np_benefits.csv：113 年起 4,049（不是 101 年的 3,500）', a.en.T.NP_SURV_MIN === 4049, a.en.T.NP_SURV_MIN);
  check('你過世後：另一半的國保與「你國保年金的一半（最低 4,049）」取高', Array.from({ length: 60 }, (_, k) => tD + k).every((t) => Math.abs(own(t) + r.survNP[1][t] - Math.max(own(t), half)) < EPS),
    { half: Math.round(half), own: Math.round(own(tD)) });
}

section('勞退專戶餘額（勞退條例第 26 條）');
{
  const a = mk(A0, { endAge: '70' }), b = mk(B0, { endAge: '95' }, 'person'), A = mem(a, 60), B = mem(b, 60);
  const r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules, tD = A.P.tE, rem = a.en.lsRemain(a.P, A.Q, tD);
  check('你在平均餘命前（70 歲）過世：專戶剩下的錢，在過世那個月一次回到家裡', tD < A.Q.lsEndT && rem > 0 && Math.abs(r.lsLump[tD] - rem) < EPS, { rem: Math.round(rem) });
  check('只在過世那個月出現一次', r.lsLump.filter((v) => v !== 0).length === 1);
  const seq = Array.from({ length: A.Q.lsEndT - A.Q.lsT }, (_, k) => a.en.lsRemain(a.P, A.Q, A.Q.lsT + k));
  check('剛開始領的那個月，剩下的＝請領時的專戶餘額', Math.abs(seq[0] - A.Q.lsBal) < EPS, [seq[0], A.Q.lsBal]);
  check('之後每個月越領越少，而且不會是負的', seq.every((v, k) => v >= 0 && (k === 0 || v <= seq[k - 1] + EPS)));
}
{
  const a = mk(A0, { endAge: '95' }), b = mk(B0, { endAge: '96' }, 'person'), A = mem(a, 60), B = mem(b, 60);
  const r = S.couple([A, B], { en: a.en, P: a.P }, 300e4).rules;
  check('活過平均餘命（月退休金已領完）才過世：沒有餘額', A.P.tE >= A.Q.lsEndT && r.lsLump.every((v) => v === 0));
}

section('生活費與一致性');
{
  const a = mk(A0, { endAge: '80' }), b = mk(B0, { endAge: '95' }, 'person'), A = mem(a, 58), B = mem(b, 58), home = { en: a.en, P: a.P };
  const c = S.couple([A, B], home, 300e4), r = c.rules, tD = A.P.tE;
  check('第一位過世前生活費不變，之後降到七成', r.living.slice(0, tD).every((v) => v === 1) && r.living.slice(tD).every((v) => v === 0.7));
  check('預設算到較晚過世的那位', c.H === B.P.tE);
  const sw = S.couple([B, A], home, 300e4);
  check('兩人順序對調：結果完全相同', Math.abs(c.end - sw.end) < 1e-3 && c.ok === sw.ok && c.firstNeg === sw.firstNeg, [c.end, sw.end]);
  const one = S.couple([A], home, 300e4), h1 = S.household([A], home, 300e4);
  check('只有一個人：夫妻規則不做任何調整，跟家庭組合器完全相同', one.end === h1.end && one.ok === h1.ok);
}

section('200 組隨機夫妻：規則在每個月都成立');
{
  const pool = [];
  for (let i = 0; i < 600 && pool.length < 260; i++) { const inp = makeCase(i); if (inp.pre && inp.pre.nhiDep) continue; const en = S.create(inp, { now: NOW }); en.sync(); if (!en.validate()) pool.push(inp); }
  const st = {}; const fail = (k, d) => { if (!st[k]) st[k] = d; };
  for (let k = 0; k < 200; k++) {
    const ia = pool[k], ib = pool[(k * 7 + 5) % pool.length];
    const a = S.create(ia, { now: NOW }); a.sync(); const b = S.create(ib, { now: NOW, role: 'person' }); b.sync();
    const Pa = a.profile(), Pb = b.profile(), na = 65 - a.tOfAge(65) / 12, nb = 65 - b.tOfAge(65) / 12;
    const A = { en: a, P: Pa, Q: a.pensions(Pa, Math.max(na + 1 / 12, 50 + (k % 15))) }, B = { en: b, P: Pb, Q: b.pensions(Pb, Math.max(nb + 1 / 12, 52 + (k % 13))) };
    const c = S.couple([A, B], { en: a, P: Pa }, a.W(ia.asset)), r = c.rules, H = c.H, first = Math.min(Pa.tE, Pb.tE), M = [A, B];
    const all = [r.nhiExtra, r.lsLump, r.living, r.survLI[0], r.survLI[1], r.survNP[0], r.survNP[1]];
    if (!all.every((arr) => Array.from(arr).every((v) => isFinite(v)))) fail('所有明細都是數字', k);
    if (!Array.from(r.nhiExtra).every((v) => v <= 0)) fail('健保調整只會是多繳（不會憑空變少）', k);
    for (let t = 0; t < H; t++) {
      const f = M.map((m) => m.en.personFlowsM(m.P, m.Q, t)), alive = M.map((m) => t < m.P.tE), idle = M.map((m, i) => alive[i] && f[i].work === 0), work = M.map((m, i) => alive[i] && f[i].work > 0);
      const kids = Pa.kidN[t] || 0, cap = PR.nhi_dependent.max_dependents;
      M.forEach((m, i) => { if (r.waive[i][t] && !idle[i]) fail('只有活著而且沒工作的人才會免繳第六類', [k, t, i]); });
      const nIdle = idle.filter(Boolean).length, nWork = work.filter(Boolean).length;
      if (nIdle && nWork) {
        const w = [0, 1].filter((i) => work[i]).sort((x, y) => M[y].Q.tR - M[x].Q.tR)[0], unit = M[w].en.nhiUnit(M[w].P);
        if (r.nhiExtra[t] !== -unit * (Math.min(cap, kids + nIdle) - Math.min(cap, kids))) fail('一人工作時：多繳＝一份 ×（加入後的眷屬數 − 原本的眷屬數），最多 3 人', [k, t]);
      } else if (nIdle && !nWork) {
        const paid = [0, 1].reduce((s, i) => s + f[i].nhiPrem * (1 - r.waive[i][t]), 0) - r.nhiExtra[t];
        if (paid !== NS * (1 + Math.min(cap, nIdle - 1 + kids))) fail('都沒工作時：第六類 × (1 ＋ 眷屬數)，最多 3 個眷屬', [k, t, paid]);
      } else if (r.nhiExtra[t] !== 0) fail('沒有人「沒工作」的月份：沒有健保調整', [k, t]);
      [0, 1].forEach((i) => { if ((r.survLI[i][t] > 0 || r.survNP[i][t] > 0) && (t < first || !alive[i] || f[i].work > 0 || t < M[i].en.tOfAge(55))) fail('遺屬年金只給：有人過世之後、活著、沒工作、55 歲以上的那位', [k, t, i]); });
      if (r.lsLump[t] !== 0 && t !== Pa.tE && t !== Pb.tE) fail('勞退餘額只在過世的那個月', [k, t]);
      if (r.living[t] !== (t < first ? 1 : 0.7)) fail('生活費：第一位過世前 1，之後 0.7', [k, t]);
    }
    const sw = S.couple([B, A], { en: a, P: Pa }, a.W(ia.asset));
    if (!(Math.abs(c.end - sw.end) <= 1e-6 * Math.max(1, Math.abs(c.end)) && c.ok === sw.ok)) fail('兩人順序對調結果相同', k);
  }
  ['所有明細都是數字', '健保調整只會是多繳（不會憑空變少）', '只有活著而且沒工作的人才會免繳第六類', '一人工作時：多繳＝一份 ×（加入後的眷屬數 − 原本的眷屬數），最多 3 人',
   '都沒工作時：第六類 × (1 ＋ 眷屬數)，最多 3 個眷屬', '沒有人「沒工作」的月份：沒有健保調整', '遺屬年金只給：有人過世之後、活著、沒工作、55 歲以上的那位',
   '勞退餘額只在過世的那個月', '生活費：第一位過世前 1，之後 0.7', '兩人順序對調結果相同'].forEach((n) => check(n + '（200 組 × 每個月）', !(n in st), st[n]));
}

console.log('\n' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
