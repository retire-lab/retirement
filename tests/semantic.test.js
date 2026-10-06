/* tests/semantic.test.js — 語意一致性（v0.9.9，Rule/Data Hygiene 的驗收關卡）
 * 做法：拿建置好的 dist/index.html，把內嵌的資料改掉「一個」制度參數或年度資料，
 *       再檢查引擎、結果頁、提高準確度、調調看、PDF 的資料模型是不是「全部」跟著變。
 * 每一組都先確認原本的網頁裡沒有那個新數字（避免剛好通過）。
 * 有任何一處沒跟著變，代表那裡自己偷存了一份制度數字。 */
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
let ok = 0, bad = 0;
function check(name, cond, detail) { if (cond) { ok++; console.log('  ✓ ' + name); } else { bad++; console.log('  ✗ ' + name + (detail !== undefined ? '：' + JSON.stringify(detail).slice(0, 300) : '')); } }
function section(t) { console.log('\n■ ' + t); }

/* 取出內嵌資料、改掉、放回去 */
const M0 = HTML.indexOf('window.SP5_DATA = '), M1 = HTML.indexOf('};', M0) + 1;
const DATA0 = JSON.parse(HTML.slice(M0 + 'window.SP5_DATA = '.length, M1));
function htmlWith(mut) { const d = JSON.parse(JSON.stringify(DATA0)); mut(d); return HTML.slice(0, M0) + 'window.SP5_DATA = ' + JSON.stringify(d) + HTML.slice(M1); }

/* 一位 48 歲、會在 60 歲以前退休的人（結果頁會出現「勞退幾歲才能領」） */
const PERSON = { birth: '1978-05', workStart: '24', asset: '450', inc: '9', spend: '4', house: false, car: false, kidsOn: false, parOn: false,
  housePay: '', houseYrs: '', housePre: false, housePreAge: '', houseRate: '', carPay: '', carYrs: '', par: '', parMode: 'keep', parYrs: '',
  kids: [{ bym: '', path: 'grad', costs: {} }], pre: { liYears: '', w60: '', lsBal: '', lsWage: '', lsYears: '', liClaim: '', self: '0', endAge: '', nhiDep: false, inf: '', dep: '', oldOn: false, oHire: '', oYrs: '', oWage: '', gaps: [], liMode: '', liPre09: false, sex: '', sameCo: '', w36: '' } };
const POOR = Object.assign({}, PERSON, { asset: '0', inc: '4', spend: '3.8' });   /* 到上限都不夠 */

function render(html, person) {
  const errs = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.github.io/retirement/', beforeParse(w) {
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    w.localStorage.setItem('sp5:data', JSON.stringify({ v: 1, active: 's1', list: [{ id: 's1', name: '測試', saved: person || PERSON, updated: '2026/10/06 10:00' }], cmp: [], showAll: false }));
    w.addEventListener('error', (e) => errs.push(e.message));
  } });
  const W = dom.window, d = W.document, txt = () => { const c = d.body.cloneNode(true); c.querySelectorAll('script,style').forEach((x) => x.remove()); return c.textContent; }, click = (sel) => { const el = d.querySelector(sel); if (el) el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); return !!el; };
  const out = { errs, W };
  out.hero = (d.querySelector('.hero') || {}).textContent || '';
  const M = W.SP5App.reportModel(); out.assume = M ? M.assumptions.join('\n') : '';
  out.page = txt();   /* 排除 <script>、<style>：內嵌的資料不是畫面上的字 */
  click('#tgPrec'); out.prec = txt();
  click('#tgAdj'); out.adj = txt();
  return out;
}
/* 引擎（用改過的資料，在網頁裡的那一份） */
function engine(html) { const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.github.io/retirement/', beforeParse(w) { w.scrollTo = () => {}; } }); return dom.window.SP5Engine; }
const NOW = { y: 2026, m: 10 };
function mk(E, inp) { const en = E.create(JSON.parse(JSON.stringify(inp || PERSON)), { now: NOW }); en.sync(); return en; }

const base = render(HTML), baseP = render(HTML, POOR), E0 = engine(HTML);
check('原本的網頁可以正常算出結果、沒有錯誤', base.hero.length > 0 && base.errs.length === 0 && baseP.errs.length === 0, base.errs.concat(baseP.errs));

section('法規（legal）：勞退請領年齡 60 → 61');
{
  const h = htmlWith((d) => { d.params.ls.claim_age = 61; }), r = render(h), E = engine(h), en = mk(E), P = en.profile();
  check('原本的結果頁寫的是 60 歲', /60 歲以前退休/.test(base.hero) && !/61 歲以前退休/.test(base.hero), base.hero);
  check('引擎：55 歲退休，勞退改在 61 歲那個月請領', en.pensions(P, 55).lsT === en.tOfAge(61), [en.pensions(P, 55).lsT, en.tOfAge(61)]);
  check('結果頁：「61 歲以前退休，要靠存款撐…勞退 61 歲才能領」', /61 歲以前退休/.test(r.hero) && /勞退 61 歲/.test(r.hero) && !/勞退 60 歲/.test(r.hero), r.hero);
  check('PDF 的假設說明：勞退在 61 歲請領', /61 歲/.test(r.assume) && !/勞退在 60 歲/.test(r.assume), r.assume);
  check('提高準確度、調調看的文字也沒有殘留「勞退 60 歲」', !/勞退\s*60\s*歲|60\s*歲勞退/.test(r.adj), (r.adj.match(/.{20}60\s*歲.{20}/g) || []).slice(0, 3));
}

section('法規（legal）：勞保提前請領每年減給 4% → 5%');
{
  const h = htmlWith((d) => { d.params.li.adjust_per_year = 0.05; }), r = render(h), E = engine(h);
  check('原本的提高準確度寫「每年少 4%」', /每年少 4%/.test(base.prec));
  check('引擎：提前 4 年請領，月領變成 80%', Math.abs(E.liMonthlyCalc(45800, 30, 61, 65) / E.liMonthlyCalc(45800, 30, 65, 65) - 0.8) < 1e-9);
  check('提高準確度的說明：「每年少 5%」', /每年少 5%/.test(r.prec) && !/每年少 4%/.test(r.prec));
}

section('法規（legal）：勞退月領門檻 15 年 → 16 年');
{
  const h = htmlWith((d) => { d.params.ls.min_contrib_years = 16; }), r = render(h);
  check('原本寫「滿 15 年才能月領」', /滿 15 年才能月領/.test(base.prec));
  check('提高準確度的說明跟著變成 16 年', /滿 16 年才能月領/.test(r.prec) && !/滿 15 年才能月領/.test(r.prec));
}

section('法規（legal）：勞基法舊制平均工資 6 個月 → 7 個月');
{
  const h = htmlWith((d) => { d.params.old.avg_wage_months = 7; }), r = render(h);
  check('原本寫「退休前 6 個月」', /退休前 6 個月/.test(base.prec));
  check('提高準確度的說明跟著變成 7 個月', /退休前 7 個月/.test(r.prec) && !/退休前 6 個月/.test(r.prec));
}

section('模型假設（model_assumption）：勞退基金報酬 3% → 4%');
{
  const h = htmlWith((d) => { d.params.assumptions.ls_fund_nominal_return = 0.04; }), r = render(h), en0 = mk(E0), en = mk(engine(h));
  check('原本的假設說明寫「勞退基金 3%」', /勞退基金 3%/.test(base.assume), base.assume);
  check('引擎：60 歲的勞退專戶變多', en.pensions(en.profile(), 60).lsBal > en0.pensions(en0.profile(), 60).lsBal);
  check('PDF 的假設說明跟著變成 4%', /勞退基金 4%/.test(r.assume) && !/勞退基金 3%/.test(r.assume), r.assume);
}

section('模型假設（model_assumption）：晚年多花從 75 歲 → 76 歲');
{
  const h = htmlWith((d) => { d.params.assumptions.late_life_age = 76; }), r = render(h), en = mk(engine(h));
  check('原本的調調看寫「從 75 歲起」', /從 75 歲起/.test(base.adj));
  check('引擎：晚年多花從 76 歲那個月開始', en.profile({ spend75: 10000 }).t75 === en.tOfAge(76));
  check('調調看的說明跟著變成 76 歲', /從 76 歲起/.test(r.adj) && !/從 75 歲起/.test(r.adj));
}

section('模型假設（model_assumption）：通膨 2% → 2.5%');
{
  const h = htmlWith((d) => { d.params.assumptions.inflation = 0.025; }), r = render(h), en = mk(engine(h));
  check('原本的結果卡寫「通膨 2%」', /通膨 2%/.test(base.page));
  check('引擎：通膨變成 2.5%', Math.abs(en.rates().inf - 0.025) < 1e-12);
  check('結果卡與 PDF 的假設跟著變成 2.5%', /通膨 2\.5%/.test(r.page) && /2\.5%/.test(r.assume), r.assume);
}

section('產品規則（product_rule）：試算的退休上限 65 歲 → 66 歲');
{
  const h = htmlWith((d) => { d.params.product.max_retire_age = 66; }), r = render(h, POOR);
  check('原本到上限都不夠時寫「65 歲還不夠」', /65 歲還不夠/.test(baseP.hero), baseP.hero);
  check('結果頁跟著變成「66 歲還不夠」', /66 歲還不夠/.test(r.hero) && !/65 歲還不夠/.test(r.hero), r.hero);
}

section('年度資料（annual_data，CSV）：存款利率加一列新的生效日');
{
  /* pick() 取「生效日 ≤ 那個月 1 號」的最新一列：引擎用 11 月的時間、加一列 11 月 1 日生效；畫面用今天的時間，改現行那一列的值 */
  const h = htmlWith((d) => { d.deposit.push({ effective: '2026-11-01', rate: 1.6, source: '測試' }); }), en = E0.create(JSON.parse(JSON.stringify(PERSON)), { now: { y: 2026, m: 11 } }), en1 = engine(h).create(JSON.parse(JSON.stringify(PERSON)), { now: { y: 2026, m: 11 } });
  en.sync(); en1.sync();
  check('原本寫「存款 1.7%」', /存款 1\.7%/.test(base.page));
  check('引擎：加一列 11 月生效的 1.6%，11 月起取到新的一列（10 月仍是 1.7%）', Math.abs(en1.rates().dep - 0.016) < 1e-12 && Math.abs(mk(engine(h)).rates().dep - 0.017) < 1e-12);
  const hv = htmlWith((d) => { d.deposit[d.deposit.length - 1].rate = 1.6; }), r = render(hv);
  check('結果卡跟著資料變成 1.6%（畫面沒有自己存一份 1.7%）', /存款 1\.6%/.test(r.page) && !/存款 1\.7%/.test(r.page));
}

section('年度資料（annual_data，CSV）：勞退年金化利率、生命表');
{
  const rows = DATA0.lsAnnuity, last = rows[rows.length - 1];
  const h = htmlWith((d) => { d.lsAnnuity.push(Object.assign({}, last, { effective: '2026-10-01', rate: last.rate + 1 })); });
  const en0 = mk(E0), en = mk(engine(h)), P0 = en0.profile(), P = en.profile();
  check('引擎：年金化利率加一列新的生效日，60 歲月領金額跟著變（專戶相同）', en.pensions(P, 60).lsMonthly !== en0.pensions(P0, 60).lsMonthly && Math.abs(en.pensions(P, 60).lsBal - en0.pensions(P0, 60).lsBal) < 1e-6);
  const set = DATA0.life.filter((x) => x.effective === DATA0.life[DATA0.life.length - 1].effective);
  const h2 = htmlWith((d) => { set.forEach((x) => d.life.push(Object.assign({}, x, { table_year: x.table_year + 3, life_expectancy: x.life_expectancy - 1, T: x.T - 1, effective: '2026-10-01' }))); });
  const en2 = mk(engine(h2)), Q0 = en0.pensions(P0, 60), Q2 = en2.pensions(en2.profile(), 60);
  check('引擎：換一份新的生命表（加列，不改欄位），60 歲月領領完的時間提早 1 年', Q0.lsEndT - Q2.lsEndT === 12, [Q0.lsEndT, Q2.lsEndT]);
}

section('年度資料（annual_data，CSV）：健保投保金額最低級、國保遺屬最低保障');
{
  const h = htmlWith((d) => { d.nhiEmp.push(Object.assign({}, d.nhiEmp[d.nhiEmp.length - 1], { effective: '2026-10-01', insured_min: 31000 })); d.npBen.push({ effective: '2026-10-01', survivor_min: 4500, source: '測試' }); });
  const E = engine(h), en = mk(E, Object.assign({}, PERSON, { inc: '2.5' })), en0 = mk(E0, Object.assign({}, PERSON, { inc: '2.5' }));
  check('引擎：月入低於最低級的人，健保一份跟著新的最低級', en.nhiUnit(en.profile()) === Math.round(31000 * 0.0517 * 0.3) && en.nhiUnit(en.profile()) !== en0.nhiUnit(en0.profile()), [en0.nhiUnit(en0.profile()), en.nhiUnit(en.profile())]);
  check('引擎：國保遺屬最低保障取到新的一列', en.T.NP_SURV_MIN === 4500 && en0.T.NP_SURV_MIN === 4049);
}

console.log('\n' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
