/*
 * SP5 退休年齡試算 — 計算引擎（全專案唯一的一份）
 *
 * 瀏覽器：<script src="engine.js"> 之後用 SP5Engine.create(inputs)
 * node  ：const SP5Engine = require('./engine.js')
 *
 * 規則來源見規格書 v0.2（引擎）、v0.3（勞保／勞退／國保／舊制）、v0.4（收支）。
 * 所有金額在引擎內部一律用「元」；畫面上的「萬」只在輸入與顯示時換算。
 * 所有金額是「今天的購買力」（實質），報酬率用實質報酬。
 * 時間按月計算：每個月先收支、再滾一個月報酬；年齡可含月（57.25 = 57 歲 3 個月）。
 */
(function (root) {
  'use strict';

  var VERSION = '0.9.9';

  /* ---------- 制度數字：一律來自 data/（瀏覽器由 build 內嵌成 SP5_DATA；node 直接讀檔） ---------- */
  var DATA = (root && root.SP5_DATA) ? root.SP5_DATA : (typeof require === 'function' ? require('../scripts/load-data.js')() : null);
  if (!DATA) throw new Error('SP5_DATA 未載入：請先執行 npm run build');
  var PR = DATA.params;
  /* 勞退月退休金的計算參數（v0.9.9）：生命表與年金化利率同一個生效日，按「當時有效」取（data/life_expectancy.csv、data/ls_annuity.csv） */
  function lsBasis(y, m) {
    var eff = pick(DATA.life, y || 9999, m || 12).effective, life = {}, lo = Infinity, hi = -Infinity;
    DATA.life.forEach(function (r) { if (r.effective === eff) { life[r.age] = r.T; lo = Math.min(lo, r.age); hi = Math.max(hi, r.age); } });
    return { life: life, lo: lo, hi: hi, rate: pick(DATA.lsAnnuity, y || 9999, m || 12).rate / 100 };
  }
  /* 依年度的表：取「生效日 ≤ 指定年月」的最新一列；都還沒生效就用最早那列 */
  /* 每張表只排序一次（v0.8.1；以前每次呼叫都複製再排序）。不改動原本的陣列 */
  var SORTED = [];
  function sortedOf(rows) {
    for (var i = 0; i < SORTED.length; i++) if (SORTED[i][0] === rows) return SORTED[i][1];
    var s = rows.slice().sort(function (a, b) { return a.effective < b.effective ? -1 : a.effective > b.effective ? 1 : 0; });
    SORTED.push([rows, s]); return s;
  }
  function pick(rows, y, m) {
    var key = y + '-' + ('0' + m).slice(-2) + '-01', sorted = sortedOf(rows), hit = null;
    for (var i = 0; i < sorted.length && sorted[i].effective <= key; i++) hit = sorted[i];
    return hit || sorted[0];
  }
  /* SP5 不算投資：名下可自由動用的錢，退休前後都用存款利率（rPreNom／rPostNom 為 null 時取 data/deposit_rate.csv）。
     infAdd：壓力測試在使用者選的通膨上再加幾個百分點 */
  var DEFAULT_ASSUME = { inf: PR.assumptions.inflation, rPreNom: null, rPostNom: null, rLsNom: PR.assumptions.ls_fund_nominal_return, infAdd: 0, depCut: 0, pensions: true, np: true, nhi: true };

  var PATHS = [['grad', '大學＋研究所'], ['uni', '大學'], ['med', '醫學系等 ' + PR.education.years.med + ' 年制'], ['five2', '五專＋二技'], ['five', '五專'], ['hs', '讀到高中職']];
  var GROUP = { pre: 'k12', ele: 'k12', jun: 'k12', sen: 'hs', five: 'hs', uni: 'col', grad: 'col', med: 'col', tech2: 'col' };
  var GLABEL = { k12: '國中小（含學齡前）', hs: '高中職／五專', col: '大學以上' };   /* 舊版三組（只為讀舊存檔） */
  /* v0.5.7 起每個階段各填一筆（公私立、國內外差很多）；舊存檔的三組費用自動攤到對應階段 */
  /* 工作空窗的情境 → 影響哪些年資（使用者只選情境，不用懂制度）
     all：勞保、勞退都中斷；ls：只有勞退中斷（育嬰留停有繼續加保、自由業透過職業工會加保） */
  var GAP_SITS = [['job', '待業、找工作', 'all'], ['study', '出國讀書、進修', 'all'], ['care', '全職照顧家人', 'all'], ['parental', '育嬰留職停薪', 'ls'],
    ['freeU', '自由業、接案（有加入職業工會）', 'ls'], ['freeN', '自由業、接案（沒有加入工會）', 'all'], ['other', '其他沒有工作的時間', 'all']];
  var GAP_KIND = {}; GAP_SITS.forEach(function (g) { GAP_KIND[g[0]] = g[2]; });
  function gapYears(gaps) {
    var all = 0, ls = 0;
    (gaps || []).forEach(function (g) { var y = (Number(g.y) || 0) + (Number(g.m) || 0) / 12; if (GAP_KIND[g.sit] === 'ls') ls += y; else all += y; });
    return { all: all, ls: ls };
  }
  var STAGE_LABEL = { pre: '學齡前', ele: '國小', jun: '國中', sen: '高中職', five: '五專', uni: '大學', med: '大學（醫學系等 6 年）', tech2: '二技', grad: '研究所' };
  function stageCostRaw(k, key) {
    var c = k.costs || {}, v = c[key];
    if (v === undefined || v === '') v = c[GROUP[key]];   /* 舊存檔 */
    return v === undefined ? '' : v;
  }
  function migrateKid(k) {
    var c = k.costs || {}, out = {};
    Object.keys(c).forEach(function (x) { if (!GLABEL[x]) out[x] = c[x]; });
    Object.keys(GROUP).forEach(function (key) { if ((out[key] === undefined || out[key] === '') && c[GROUP[key]] !== undefined && c[GROUP[key]] !== '') out[key] = c[GROUP[key]]; });
    k.costs = out; return k;
  }

  /* ---------- 純函式：制度公式（可直接對官方試算器驗證） ---------- */
  /* 勞保法定請領年齡（LI-02）。SP5 使用者未滿 65 歲，實際只會遇到民國 50 年次（64）與 51 年次以後（65） */
  function legalAge(birthYear) {
    var roc = birthYear - 1911, L = PR.li.legal_age;   /* 民國年＝西元年 − 1911 */
    return Math.min(L.max_age, L.base_age + Math.max(0, roc - L.base_roc_year));
  }
  /* 勞保老年年金月領（LI-10～14）：兩式擇優；提前每年減 4%、延後每年加 4%，各以 5 年為限，不足一年按月比例
     （勞保局整合試算 0109187 實測：61 歲 3 個月請領、法定 65 歲 → 減給 15%）；年資未滿 15 年為 0 */
  function liMonthlyCalc(w60, years, claimAge, legal) {
    var L = PR.li;
    if (!(years >= L.min_years - 1e-9)) return 0;   /* 容許浮點誤差：年資剛好 15 年（算出 14.9999…）也要算滿 */
    var k = 1 + L.adjust_per_year * Math.max(-L.adjust_max_years, Math.min(L.adjust_max_years, claimAge - legal));
    return Math.max(w60 * years * L.f1_rate + L.f1_add, w60 * years * L.f2_rate) * k;
  }
  /* 勞退月退年金化（LS-30～33）：每月期初給付的年金現值因子 */
  function lifeYears(age, y, m) { var b = lsBasis(y, m); return b.life[Math.min(b.hi, Math.max(b.lo, age))]; }
  function annuityFactor(T, r) { var j = Math.pow(1 + r, 1 / 12) - 1, v = 1 / (1 + r); return (1 - Math.pow(v, T)) / j * (1 + j); }
  function lsMonthlyCalc(balance, claimAge, y, m) { return balance / annuityFactor(lifeYears(claimAge, y, m), lsBasis(y, m).rate); }
  /* 勞退月提繳分級表：實際工資對應到級距（例：50,000 → 50,600；147,901 以上一律 150,000） */
  function gradeOf(rows, wage, y, m) {
    var eff = pick(rows, y || 9999, m || 12).effective;
    var tbl = rows.filter(function (r) { return r.effective === eff; }).sort(function (a, b) { return a.grade - b.grade; });
    for (var i = 0; i < tbl.length; i++) if (tbl[i].max_wage === '' || wage <= tbl[i].max_wage) return tbl[i].monthly_wage;
    return tbl[tbl.length - 1].monthly_wage;
  }
  function lsGradeOf(wage, y, m) { return gradeOf(DATA.lsGrades, wage, y, m); }
  /* 勞保投保薪資分級表（一般被保險人）：29,500 以下 → 29,500；43,901 以上 → 45,800 */
  function liGradeOf(wage, y, m) { return gradeOf(DATA.liGrades, wage, y, m); }
  /* 本息平均攤還：還剩 monthsLeft 期、每月繳 monthlyPay、年利率 rate 時的剩餘本金（名目） */
  function loanBalance(monthlyPay, monthsLeft, rate) {
    if (!(monthsLeft > 0)) return 0;
    var i = rate / 12;
    return i > 0 ? monthlyPay * (1 - Math.pow(1 + i, -monthsLeft)) / i : monthlyPay * monthsLeft;
  }
  /* 國保老年年金 B 式（NP-07、NP-08） */
  function npMonthlyCalc(years, wage) { return (wage || pick(DATA.np, 9999, 12).insured_amount) * years * PR.np.b_rate; }
  /* 勞基法舊制（OLD-01～04）：自請退休條件與基數 */
  function oldEligible(totalYears, age) { return PR.old.eligibility.some(function (c) { return totalYears >= c.min_years && age >= c.min_age; }); }
  /* 勞基法第 55 條：未滿半年以半年計；滿半年以一年計。年資先換成整月數，避免浮點誤差 */
  function oldUnits(oldYears) {
    var m = Math.round(oldYears * 12), full = Math.floor(m / 12), rem = m - full * 12;
    var O = PR.old, y = full + (rem === 0 ? 0 : rem < O.half_year.below_months ? O.half_year.partial : 1);
    return Math.min(O.max_units, O.units_first15 * Math.min(y, O.first_years) + O.units_after15 * Math.max(0, y - O.first_years));
  }

  /* ---------- 引擎：綁定一份輸入 S（引擎只讀不寫） ---------- */
  function create(S, opt) {
    opt = opt || {};
    var ROLE = opt.role === 'person' ? 'person' : 'household';   /* v0.9.7：person＝只算這個人（夫妻模式的另一半），沒有家用支出 */
    var now = opt.now || (function () { var d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1 }; })();
    var A = {}; Object.keys(DEFAULT_ASSUME).forEach(function (k) { A[k] = DEFAULT_ASSUME[k]; });
    Object.keys(opt.assume || {}).forEach(function (k) { A[k] = opt.assume[k]; });
    var NOW = now.y, NOWI = now.y * 12 + now.m - 1;
    var depRow = pick(DATA.deposit, now.y, now.m);
    var INF, DEP, R_PRE, R_POST, R_LS, M_PRE, M_POST, M_LS;
    /* 通膨、存款利率可由使用者在「提高準確度」選（S.pre.inf、S.pre.dep，單位 %）；其餘照假設 */
    function setRates() {
      var pre = S.pre || {}, iu = num(pre.inf), du = num(pre.dep);
      INF = (isFinite(iu) ? iu / 100 : A.inf) + (A.infAdd || 0);
      DEP = isFinite(du) ? du / 100 : depRow.rate / 100;
      var nPre = isFinite(du) ? DEP : A.rPreNom != null ? A.rPreNom : DEP;
      var nPost = isFinite(du) ? DEP : A.rPostNom != null ? A.rPostNom : DEP;
      /* 萬一存款利率降低（v0.9.0）：退休前後的存款利率都減 depCut，最低 0。跟通膨上升不同：房貸每月固定，不會因此變輕 */
      if (A.depCut) { DEP = Math.max(0, DEP - A.depCut); nPre = Math.max(0, nPre - A.depCut); nPost = Math.max(0, nPost - A.depCut); }
      R_PRE = A.rPre != null ? A.rPre : (1 + nPre) / (1 + INF) - 1;
      R_POST = A.rPost != null ? A.rPost : (1 + nPost) / (1 + INF) - 1;
      R_LS = A.rLs != null ? A.rLs : (1 + A.rLsNom) / (1 + INF) - 1;
      M_PRE = Math.pow(1 + R_PRE, 1 / 12) - 1; M_POST = Math.pow(1 + R_POST, 1 / 12) - 1; M_LS = Math.pow(1 + R_LS, 1 / 12) - 1;
    }
    var E_DEF = PR.assumptions.default_end_age, E = E_DEF;
    var npRow = pick(DATA.np, now.y, now.m), nhiRow = pick(DATA.nhi, now.y, now.m), capRow = pick(DATA.caps, now.y, now.m);
    var nhiEmpRow = pick(DATA.nhiEmp, now.y, now.m), npBenRow = pick(DATA.npBen, now.y, now.m);   /* v0.9.8：夫妻規則用 */
    var T_ = { LI_CAP: capRow.li_wage_cap, LS_CAP: capRow.ls_wage_cap, NP_PREM: npRow.self_monthly, NP_WAGE: npRow.insured_amount, NHI_SELF: nhiRow.self_monthly, NP_SURV_MIN: npBenRow.survivor_min };
    var LS_START = (function (v) { var p = String(v).split('-'); return +p[0] * 12 + (+p[1]) - 1; })(PR.ls.new_system_start);
    /* 房貸；勾了「提前一次還清」就在那一年一次付清剩餘本金，之後不再繳 */
    /* 退休年月：以 R 歲生日當月計（引擎以年為單位，不算到幾歲幾個月） */
    function retireYM(R) { return birthP() ? ymOf(R) : null; }
    /* 房貸；勾了「提前一次還清」就在那個年齡的生日當月一次付清剩餘本金，之後不再繳 */
    function houseLoan() {
      var l = { name: '房貸', pay: W(S.housePay), months: Math.round(num(S.houseYrs) * 12), payoffT: null, payoffAmt: 0 };
      if (S.housePre) {
        var at = num(S.housePreAge), pt = isFinite(at) ? tOfAge(at) : NaN, left = l.months - pt;
        if (pt > 0 && left > 0) { l.payoffT = pt; l.payoffAmt = loanBalance(l.pay, left, (num(S.houseRate) || 0) / 100); }
      }
      return l;
    }
    /* 「算到幾歲」來自輸入，輸入變了要呼叫 sync() */
    function sync() { var e = num(S.pre && S.pre.endAge); E = isFinite(e) && e > PR.product.max_retire_age && e <= PR.product.end_age_max ? Math.round(e) : E_DEF; setRates(); return E; }
    setRates();

    function num(s) { var v = parseFloat(String(s == null ? '' : s).replace(/[,\s]/g, '')); return isFinite(v) ? v : NaN; }

    function W(s) { return num(s) * 10000; }

    function fmtW(n) { var w = n / 10000, a = Math.abs(w), d = a >= 100 ? 0 : a >= 10 ? 1 : 2; return (+w.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d }) + ' 萬'; }

    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }   /* 單引號也跳脫（v0.8.0），屬性用單引號時也安全 */

    function mi(y, m) { return y * 12 + m - 1; }

    function ymStr(i) { return Math.floor(i / 12) + '/' + ('0' + (i % 12 + 1)).slice(-2); }

    function durStr(n) { var y = Math.floor(n / 12), m = n % 12; return ((y ? y + ' 年' : '') + (y && m ? ' ' : '') + (m ? m + ' 個月' : '')) || '不到 1 個月'; }

    function parseYM(v, lo, hi) { var m = /^(\d{4})\D?(\d{1,2})$/.exec(String(v || '').trim()); if (!m) return null; var y = +m[1], mo = +m[2]; if (mo < 1 || mo > 12 || y < lo || y > hi) return null; return { y: y, mo: mo }; }

    function birthP() { return parseYM(S.birth, 1930, 2010); }

    /* 勞退舊制的欄位：v0.5.7 起在 S.pre；舊存檔在最上層 */
    function OS() { return S.pre && S.pre.oldOn !== undefined && S.pre.oldOn !== null ? S.pre : S; }
    /* 開始工作的年月早於 2005 年 7 月 → 可能有舊制年資（要一直待在同一家公司才算） */
    function mayHaveOld() { var p = birthP(), ws = num(S.workStart); if (!p || !isFinite(ws)) return false; return mi(p.y, p.mo) + Math.round(ws * 12) < LS_START; }
    function age() { var p = birthP(); return p ? Math.floor((NOWI - mi(p.y, p.mo)) / 12) : null; }

    function kidStages(bym, path) {
      var p = parseYM(bym, 1990, 2040); if (!p) return null;
      /* 學制（v0.9.9 起在 data/params.json 的 education）：每個階段從第幾學年到第幾學年（含） */
      var ED = PR.education, Y = ED.years, Ey = p.y + ED.entry_age + (p.mo >= ED.birth_cutoff_month ? 1 : 0), F = Ey + Y.ele + Y.jun;
      var st = function (key, label, from, n) { return [key, label, from, from + n - 1]; };
      var d = [['pre', '學齡前', null, Ey - 1], st('ele', '國小', Ey, Y.ele), st('jun', '國中', Ey + Y.ele, Y.jun)];
      path = path || 'grad';
      if (path === 'five' || path === 'five2') { d.push(st('five', '五專', F, Y.five)); if (path === 'five2') d.push(st('tech2', '二技', F + Y.five, Y.tech2)); }
      else {
        d.push(st('sen', '高中職', F, Y.sen));
        if (path === 'uni' || path === 'grad') d.push(st('uni', '大學', F + Y.sen, Y.uni));
        if (path === 'grad') d.push(st('grad', '研究所', F + Y.sen + Y.uni, Y.grad));
        if (path === 'med') d.push(st('med', '醫學系等', F + Y.sen, Y.med));
      }
      return d.map(function (x) {
        var s = x[2] === null ? mi(p.y, p.mo) : mi(x[2], ED.school_start_month), e = mi(x[3] + 1, ED.school_end_month), grad = x[2] === null ? e : mi(x[3] + 1, ED.graduation_month);
        return { key: x[0], g: GROUP[x[0]], label: x[1], s: s, e: e, grad: grad, pre: x[2] === null, live: e >= NOWI, started: s <= NOWI,
          grade: s <= NOWI ? Math.floor((NOWI - s) / 12) + 1 : 0, years: x[2] === null ? 0 : x[3] - x[2] + 1 };
      });
    }

    /* 還沒讀完的階段，每個階段一列（g = 階段代號，也是 costs 的鍵） */
    function kidGroups(st) {
      return st.filter(function (t) { return t.live; }).map(function (t) {
        return { g: t.key, label: STAGE_LABEL[t.key] || t.label, started: t.started, start: t.s, end: t.grad, names: t.label,
          rem: t.started ? t.grad - NOWI + 1 : 0, years: t.started ? 0 : t.years };
      });
    }
    function stageCost(k, st) { return W(stageCostRaw(k, st.key)) || 0; }

    function kidEndIdx(k) { var st = kidStages(k.bym, k.path); return st ? st[st.length - 1].grad : null; }

    function parentAgeAt(i) { var p = birthP(); return Math.floor((i - mi(p.y, p.mo)) / 12); }

    function kidMonthlyNow() {
      if (!S.kidsOn) return 0;
      return S.kids.reduce(function (sum, k) {
        var st = kidStages(k.bym, k.path) || [], cur = st.filter(function (t) { return NOWI >= t.s && NOWI <= t.e; })[0];
        return sum + (cur ? stageCost(k, cur) / 12 : 0);
      }, 0);
    }

    /* ================= 引擎（按月） =================
     * 時間軸：t = 0 是這個月，一個月一步；每個月先收支、再滾一個月報酬。
     * 年齡一律用「年」表示但精確到月（例如 57.25 = 57 歲 3 個月）；退休、請領、還清都發生在某個月。
     * 金額都是今天的購買力；名目固定的金額（房貸、勞退月退）依通膨逐月折算。
     */
    function bIdx() { var p = birthP(); return mi(p.y, p.mo); }
    function ageMonths() { var p = birthP(); return p ? NOWI - mi(p.y, p.mo) : null; }
    function tOfAge(R) { return bIdx() + Math.round(R * 12) - NOWI; }   /* R 歲（可含月）那個月，距離現在幾個月 */
    function ageOfT(t) { return (NOWI + t - bIdx()) / 12; }
    function defl(t) { return Math.pow(1 + INF, t / 12); }

    function profile(adj) {
      adj = adj || {};
      /* 壓力情境（都只在 adj 裡，不改輸入）：
         incCut 收入少幾 %（到退休為止）、gap 收入中斷幾年（從明年 1 月起）、spend75 75 歲起每月多花幾元 */
      var p = birthP(), A0m = ageMonths(), incF = 1 - (adj.incCut || 0) / 100, inc0 = W(S.inc), inc = inc0 * incF;
      var gap0 = 12 - (NOWI % 12), gap1 = gap0 + Math.round((adj.gap || 0) * 12);
      var worked = Math.max(0, A0m / 12 - num(S.workStart));
      var pre = S.pre, tE = mi(p.y + E, p.mo) - NOWI, gy = gapYears(pre.gaps);
      /* 子女：每個月的費用直接攤到那個月（年額 ÷ 12；9 月入學、隔年 8 月為止） */
      var kidM = new Array(Math.max(0, tE)).fill(0), kidN = new Array(Math.max(0, tE)).fill(0);   /* kidN：這個月有幾個孩子還在學（健保眷屬，v0.9.8） */
      if (S.kidsOn) S.kids.forEach(function (k) {
        var seen = {};
        (kidStages(k.bym, k.path) || []).forEach(function (st) {
          var m = stageCost(k, st) / 12;
          for (var i = Math.max(st.s, NOWI); i <= st.e && i - NOWI < tE; i++) { kidM[i - NOWI] += m; if (!seen[i]) { seen[i] = 1; kidN[i - NOWI]++; } }
        });
      });
      return {
        A0: Math.floor(A0m / 12), A0m: A0m, A0y: A0m / 12, by: p.y, tE: tE,
        inc: inc, base: ROLE === 'person' ? 0 : W(S.spend) - (adj.cut || 0) / 12, extra: ROLE === 'person' ? 0 : (adj.extra || 0) / 12, stress: adj.liFactor != null ? adj.liFactor : 1,
        loans: ROLE === 'person' ? [] : [S.house ? houseLoan() : null, S.car ? { name: '車貸', pay: W(S.carPay), months: Math.round(num(S.carYrs) * 12), payoffT: null, payoffAmt: 0 } : null].filter(Boolean),
        kidM: ROLE === 'person' ? kidM.fill(0) : kidM, kidN: ROLE === 'person' ? kidN.fill(0) : kidN, par: ROLE !== 'person' && S.parOn ? W(S.par) : 0, parMonths: S.parOn && S.parMode === 'yrs' ? Math.round(num(S.parYrs) * 12) : Infinity,
        old: OS().oldOn ? { hireIdx: mi(num(OS().oHire), 1), yrs: num(OS().oYrs), wage: W(OS().oWage) } : null,
        worked: worked,
        /* 沒填實際年資時：工作年資扣掉「勞保、勞退都中斷」的空窗 */
        liYearsNow: isFinite(num(pre.liYears)) ? num(pre.liYears) : Math.max(0, worked - gy.all),
        gapAll: gy.all, gapLs: gy.ls,
        adj: adj, liGiven: isFinite(num(pre.liYears)), workStartIdx: mi(p.y, p.mo) + Math.round((num(S.workStart) || 0) * 12),
        liMode: adj.liMode !== undefined ? adj.liMode : (pre.liMode === 'lump' ? 'lump' : ''),
        liPre09: pre.liPre09 === true, sex: pre.sex === 'F' ? 'F' : pre.sex === 'M' ? 'M' : '', sameCo: isFinite(num(pre.sameCo)) ? num(pre.sameCo) : null,
        /* 填了就照填（那是最高 60 個月的平均，不一定剛好在某一級）；沒填就用月入帳對應投保薪資分級表 */
        w60: isFinite(num(pre.w60)) ? W(pre.w60) : liGradeOf(inc0, NOW, now.m),   /* 收入減少不影響：看的是最高 60 個月 */
        w36: isFinite(num(pre.w36)) ? W(pre.w36) : null,   /* 一次請領用「退保前 3 年」平均；沒填就用 w60 估算 */
        lsWage: lsGradeOf((isFinite(num(pre.lsWage)) ? W(pre.lsWage) : inc0) * incF, NOW, now.m),   /* 對應到月提繳分級表；收入減少時跟著降 */
        gap0: gap1 > gap0 ? gap0 : 0, gap1: gap1 > gap0 ? gap1 : 0, spend75: ROLE === 'person' ? 0 : adj.spend75 || 0, t75: mi(p.y + PR.assumptions.late_life_age, p.mo) - NOWI,
        lsSelf: (num(pre.self) || 0) / 100,
        lsYearsGiven: isFinite(num(pre.lsYears)) ? num(pre.lsYears) : null,
        liClaimPref: isFinite(num(pre.liClaim)) ? num(pre.liClaim) : null,
        nhiDep: !!pre.nhiDep,
        lsBalGiven: isFinite(num(pre.lsBal)) ? W(pre.lsBal) : null,
        est: { li: !isFinite(num(pre.liYears)) || !isFinite(num(pre.w60)), ls: !isFinite(num(pre.lsBal)) || !isFinite(num(pre.lsYears)) }
      };
    }

    /* ===== 勞保一次請領老年給付（勞保條例第 58 條第 2 項；規則在 data/params.json 的 li_lump） =====
       資格：2009/1/1 前有勞保年資。只用使用者已填的資料判斷：
         開始工作（出生年月＋開始工作年齡）在 2009/1 以後 → no（只能月領）
         有填實際勞保年資，且長於「2009/1 到現在」的月數 → yes（一定有 2009 年前的年資）
         使用者查過勞保局、自己確認 2009 年前有年資（pre.liPre09）→ yes（年資短的人只能靠這個）
         其他 → unknown（無法判斷，不猜） */
    var LL = PR.li_lump, LL_CUT = (function () { var m = /^(\d{4})-(\d{2})$/.exec(LL.eligible_if_insured_before); return mi(+m[1], +m[2]); })();
    function liLumpElig(P) {
      if (P.workStartIdx >= LL_CUT) return { state: 'no' };
      if (P.liGiven && P.liYearsNow * 12 > (NOWI - LL_CUT) + 1e-6) return { state: 'yes', by: 'years' };
      if (P.liPre09) return { state: 'yes', by: 'confirmed' };
      return { state: 'unknown' };
    }
    /* 基數：前 15 年每年 1 個月、之後每年 2 個月，最多 45 個月；60 歲後的年資最多算 5 年，合計最多 50 個月。不足一年按比例 */
    function lumpMonths(years, R) {
      var f = function (y) { return Math.min(y, LL.first_years) * LL.months_per_year_first + Math.max(0, y - LL.first_years) * LL.months_per_year_after; };
      var after60 = Math.max(0, Math.min(years, R - LL.after_age)), pre = years - after60, used60 = Math.min(after60, LL.after60_years_max);
      var m1 = Math.min(LL.cap_months, f(pre));
      if (used60 <= 0) return m1;
      return Math.min(LL.cap_months_with_after60, m1 + (f(pre + used60) - f(pre)));
    }
    /* 最早可以一次領的年齡（≥ 退休）：第 58 條第 2 項第 1～4 款，年資算到退休那個月；第 5 款（特殊工作）不納入 */
    function lumpAge(P, R, years) {
      var best = Infinity;
      LL.conditions.forEach(function (c) {
        if (c.same_unit_years) { if (P.sameCo !== null && P.sameCo + (R - P.A0y) >= c.same_unit_years - 1e-9) best = Math.min(best, R); return; }
        if (years < c.min_years - 1e-9) return;
        var a = P.sex === 'F' && c.min_age_female ? c.min_age_female : c.min_age;
        best = Math.min(best, Math.max(R, a));
      });
      return best;
    }
    function pensions(P, R) {
      var tR = tOfAge(R);
      if (!A.pensions) return { tR: tR, legal: legalAge(P.by), liYears: 0, liClaim: E, liT: P.tE, liMonthly: 0, lsClaim: E, lsT: P.tE, lsBal: 0, lsMonthly: 0, lsLump: 0, lsEnd: E, lsEndT: P.tE, T: 0, npMonths: 0, npEndT: tR, np65T: P.tE, npMonthly: 0 };
      var legal = legalAge(P.by);
      /* 勞保：年資計到退休那個月；預設法定年齡請領，可自選（法定 ±5 年）；但要先離職退保，所以不早於退休那個月。
         提前／延後按滿年計算減給或加給 */
      var pref = P.liClaimPref === null ? legal : Math.max(legal - PR.li.adjust_max_years, Math.min(legal + PR.li.adjust_max_years, P.liClaimPref));
      var gapIn = Math.max(0, Math.min(tR, P.gap1) - P.gap0);   /* 退休前收入中斷的月數：沒有勞保年資、沒有勞退提繳 */
      var liYears = P.liYearsNow + (tR - gapIn) / 12, liClaim = Math.max(R, pref), liT = tOfAge(liClaim);
      var liMonthly = liMonthlyCalc(P.w60, liYears, liClaim, legal) * P.stress;   /* 提前／延後按月比例 */
      /* 一次領：資格確定（yes）才算；領的那個月起不能再保國保（下面 npEndT 用 liT，自動停） */
      var liLump = 0, liLumpMonths = 0, liMode = '';
      if (P.liMode === 'lump' && liLumpElig(P).state === 'yes' && liYears >= 1) {
        var la = lumpAge(P, R, liYears);
        if (isFinite(la)) {
          liMode = 'lump'; liLumpMonths = lumpMonths(liYears, R); liLump = (P.w36 !== null ? P.w36 : P.w60) * liLumpMonths * P.stress;
          liClaim = la; liT = tOfAge(la); liMonthly = 0;
        }
      }
      /* 勞保年資未滿 15 年（沒有選一次請領）：data/params.json 的 li_onetime
         勞保＋退休後的國保年資滿 15 年 → 65 歲月領（只用勞保年資算，不提前、不延後）；國保另外按國保年資算
         否則 → 法定年齡領老年一次金（每年 1 個月；60 歲後的年資最多算 5 年）；領的那個月起國保停 */
      if (liMode === '' && liYears > 0 && liYears < PR.li.min_years - 1e-9) {
        var LO = PR.li_onetime, npY65 = A.np ? Math.max(0, tOfAge(PR.np.claim_age) - tR) / 12 : 0;
        if (liYears + npY65 >= LO.np_combine.min_total_years - 1e-9) {
          liMode = 'combined'; liClaim = Math.max(R, LO.np_combine.claim_age); liT = tOfAge(liClaim);
          liMonthly = Math.max(P.w60 * liYears * PR.li.f1_rate + PR.li.f1_add, P.w60 * liYears * PR.li.f2_rate) * P.stress;
        } else {
          var aft = Math.max(0, Math.min(liYears, R - LO.after_age)), om = (liYears - aft) + Math.min(aft, LO.after60_years_max);
          liMode = 'onetime'; liLumpMonths = om * LO.months_per_year; liLump = P.w60 * liLumpMonths * P.stress;
          liClaim = Math.max(R, legal); liT = tOfAge(liClaim); liMonthly = 0;
        }
      }
      /* 勞退：每月月底提繳、每月滾存到退休；60 歲（或退休時）那個月請領。
         勞動部個人退休金試算表（2026-10-02 實測）為「月底提繳、年內單利、年底複利」，與本式相差約 0.007% */
      var bal = P.lsBalGiven !== null ? P.lsBalGiven : lsBalNowEst(P), cm = P.lsWage * (PR.ls.employer_rate + P.lsSelf), t;
      for (t = 0; t < tR; t++) bal = bal * (1 + M_LS) + (t >= P.gap0 && t < P.gap1 ? 0 : cm);
      var lsClaim = Math.max(PR.ls.claim_age, R), lsT = tOfAge(lsClaim);
      for (t = tR; t < lsT; t++) bal *= (1 + M_LS);
      /* 勞退條例第 24 條：月領門檻看「實際提繳退休金之年資」，不是一般工作年資 */
      var lsYears = lsYrsNow(P) + (tR - gapIn) / 12, T = lifeYears(Math.floor(lsClaim + 1e-9), now.y, now.m);
      var lsOk = lsYears >= PR.ls.min_contrib_years - 1e-9;
      var lsMonthly = lsOk ? lsMonthlyCalc(bal, Math.floor(lsClaim + 1e-9), now.y, now.m) : 0;
      /* 國保：退休那個月起、到 65 歲或開始領勞保（取早）前要繳；65 歲起 B 式年金 */
      var t65 = tOfAge(PR.np.claim_age), npEndT = Math.min(t65, liT), npMonths = A.np ? Math.max(0, npEndT - tR) : 0;
      return { tR: tR, legal: legal, liYears: liYears, liClaim: liClaim, liT: liT, liMonthly: liMonthly, liLump: liLump, liLumpMonths: liLumpMonths, liMode: liMode,
        lsClaim: lsClaim, lsT: lsT, lsBal: bal, lsMonthly: lsMonthly, lsLump: lsOk ? 0 : bal, lsYears: lsYears, liPref: pref, lsEnd: lsClaim + T, lsEndT: lsT + T * 12, T: T,
        npMonths: npMonths, npEndT: npEndT, np65T: t65, npMonthly: npMonthlyCalc(npMonths / 12, T_.NP_WAGE) };
    }
    /* 勞退新制實際提繳年資：有填就用；沒填就估「工作年資」與「2005 年 7 月至今」取小，再扣掉空窗。
       只問空窗多久、不問何時，所以保守假設空窗都發生在新制期間 */
    function lsYrsNow(P) { return P.lsYearsGiven !== null ? P.lsYearsGiven : Math.max(0, Math.min(P.worked, Math.floor((NOWI - LS_START) / 12)) - (P.gapAll || 0) - (P.gapLs || 0)); }

    function lsBalNowEst(P) { return P.lsWage * 12 * (PR.ls.employer_rate + P.lsSelf) * lsYrsNow(P); }

    function oldLump(P, R) {
      if (!P.old) return 0;
      var total = (NOWI + tOfAge(R) - P.old.hireIdx) / 12;
      if (!oldEligible(total, R)) return 0;
      return oldUnits(P.old.yrs) * P.old.wage;
    }

    /* 一個月的淨現金流（求解時大量呼叫，不建物件） */
    function netM(P, Q, t) {
      var n = -P.base - P.kidM[t] - (t < P.parMonths ? P.par : 0), inGap = t >= P.gap0 && t < P.gap1 && t < Q.tR;
      if (t < Q.tR && !inGap) n += P.inc + P.extra;
      if (inGap) n -= T_.NP_PREM + (A.nhi !== false ? T_.NHI_SELF : 0);   /* 沒工作：自己繳國保、健保第六類 */
      if (t >= P.t75) n -= P.spend75;
      for (var i = 0; i < P.loans.length; i++) {
        var l = P.loans[i];
        if (l.payoffT !== null && t > l.payoffT) continue;
        if (l.payoffT !== null && t === l.payoffT) { n -= l.payoffAmt / defl(t); continue; }
        if (t < l.months) n -= l.pay / defl(t);
      }
      if (t >= Q.liT) n += Q.liMonthly;
      if (Q.lsMonthly && t >= Q.lsT && t < Q.lsEndT) n += Q.lsMonthly / defl(t - Q.lsT);
      if (Q.lsLump && t === Q.lsT) n += Q.lsLump;
      if (Q.liLump && t === Q.liT) n += Q.liLump;
      if (A.np && t >= Q.tR && t < Q.npEndT) n -= T_.NP_PREM;
      if (A.nhi !== false && !P.nhiDep && t >= Q.tR) n -= T_.NHI_SELF;
      if (Q.npMonths && t >= Q.np65T) n += Q.npMonthly;
      if (t === Q.tR) n += oldLump(P, Q.tR / 12 + P.A0y);
      return n;
    }
    /* 一個月的明細（v0.9.7 拆成兩層）：
       personFlowsM ＝ 這個人的：薪水（含每月多存）、勞保、勞退、國保年金、勞退舊制、國保保費、健保第六類
       householdFlowsM ＝ 這個家的：生活費（含晚年多花）、貸款、提前還清、孩子、孝親費
       flowsM ＝ 兩者合起來，欄位、加總順序跟 v0.9.6 完全相同（tests/golden.test.js 把關）。
       超出這個人計算範圍（t ≥ P.tE，即過了「算到幾歲」）：這個人的部分全部是 0；家的部分照常有定義（孩子費用已結束 → 0），
       夫妻模式由家庭層決定要不要計入。所有欄位一定是數字，不會是 NaN */
    function personFlowsM(P, Q, t) {
      var f = { work: 0, li: 0, ls: 0, np: 0, old: 0, npPrem: 0, nhiPrem: 0 };
      if (t < 0 || t >= P.tE) { f.inflow = 0; f.outflow = 0; f.net = 0; return f; }
      var inGap = t >= P.gap0 && t < P.gap1 && t < Q.tR;
      f.work = t < Q.tR && !inGap ? P.inc + P.extra : 0;
      if (inGap) { f.npPrem = T_.NP_PREM; f.nhiPrem = A.nhi !== false ? T_.NHI_SELF : 0; }
      if (t >= Q.liT) f.li = Q.liMonthly;
      if (Q.lsMonthly && t >= Q.lsT && t < Q.lsEndT) f.ls = Q.lsMonthly / defl(t - Q.lsT);
      if (Q.lsLump && t === Q.lsT) f.ls = Q.lsLump;
      if (Q.liLump && t === Q.liT) f.li = Q.liLump;
      if (A.np && t >= Q.tR && t < Q.npEndT) f.npPrem = T_.NP_PREM;
      if (A.nhi !== false && !P.nhiDep && t >= Q.tR) f.nhiPrem = T_.NHI_SELF;
      if (Q.npMonths && t >= Q.np65T) f.np = Q.npMonthly;
      if (t === Q.tR) f.old = oldLump(P, Q.tR / 12 + P.A0y);
      f.inflow = f.work + f.li + f.ls + f.np + f.old;
      f.outflow = f.npPrem + f.nhiPrem;
      f.net = f.inflow - f.outflow;
      return f;
    }
    function householdFlowsM(P, t) {
      var f = { living: P.base + (t >= P.t75 ? P.spend75 : 0), loan: 0, prepay: 0, kid: (t >= 0 && t < P.kidM.length) ? P.kidM[t] : 0, par: t < P.parMonths ? P.par : 0 };
      P.loans.forEach(function (l) {
        if (l.payoffT !== null && t > l.payoffT) return;
        if (l.payoffT !== null && t === l.payoffT) { f.prepay += l.payoffAmt / defl(t); return; }
        if (t < l.months) f.loan += l.pay / defl(t);
      });
      f.outflow = f.living + f.loan + f.prepay + f.kid + f.par;
      f.net = -f.outflow;
      return f;
    }
    function flowsM(P, Q, t) {
      var p = personFlowsM(P, Q, t), h = householdFlowsM(P, t);
      var f = { work: p.work, li: p.li, ls: p.ls, np: p.np, old: p.old, living: h.living, loan: h.loan, prepay: h.prepay, kid: h.kid, par: h.par, npPrem: p.npPrem, nhiPrem: p.nhiPrem };
      f.inflow = f.work + f.li + f.ls + f.np + f.old;
      f.outflow = f.living + f.loan + f.prepay + f.kid + f.par + f.npPrem + f.nhiPrem;
      f.net = f.inflow - f.outflow;
      return f;
    }
    /* 勞退專戶在第 t 個月還剩多少（今天的購買力，v0.9.8）：月領期間（lsT ≤ t < lsEndT）才有；
       以請領時的專戶餘額，每月按名目報酬滾存、扣掉固定的月退休金（名目），再折回今天的購買力。
       勞退條例第 26 條：月領期間過世，剩下的由遺屬領回。第 25 條年金保險的提繳不算 */
    function lsRemain(P, Q, t) {
      if (!Q.lsMonthly || t < Q.lsT || t >= Q.lsEndT) return 0;
      var mn = Math.pow(1 + A.rLsNom, 1 / 12) - 1, B = Q.lsBal, k;
      for (k = Q.lsT; k < t; k++) B = B * (1 + mn) - Q.lsMonthly;
      return Math.max(0, B) / defl(t - Q.lsT);
    }
    /* 健保一份保費（受僱者自付，v0.9.8）：投保金額（以每月實際入帳代替，夾在最低、最高級之間）× 費率 × 自付比例，四捨五入 */
    function nhiUnit(P) { var ins = Math.min(nhiEmpRow.insured_max, Math.max(nhiEmpRow.insured_min, P.inc)); return Math.round(ins * nhiEmpRow.rate / 100 * PR.nhi_dependent.employee_share); }
    /* 這個人的時間軸（v0.9.7，夫妻模式的兩條線用）：每個月只屬於一種狀態
       work 工作中／gap 收入中斷（沒薪水、自己繳國保健保）／retired 已退休、還沒有任何月領年金／pension 有月領年金（勞保、勞退、國保任一）
       一次領（勞保一次金、老年一次金、勞退一次領、勞退舊制）不算「有年金」，另外列在 lumps */
    function timeline(P, Q) {
      var seg = [], cur = null, lumps = [], t;
      for (t = 0; t < P.tE; t++) {
        var f = personFlowsM(P, Q, t), inGap = t >= P.gap0 && t < P.gap1 && t < Q.tR;
        var st = t < Q.tR ? (inGap ? 'gap' : 'work') : ((t >= Q.liT && Q.liMonthly > 0) || (Q.lsMonthly && t >= Q.lsT && t < Q.lsEndT) || (Q.npMonths && t >= Q.np65T && Q.npMonthly > 0) ? 'pension' : 'retired');
        if (!cur || cur.state !== st) { cur = { state: st, s: t, e: t + 1 }; seg.push(cur); } else cur.e = t + 1;
        if ((Q.liLump && t === Q.liT) || (Q.lsLump && t === Q.lsT) || f.old > 0) lumps.push({ t: t, li: Q.liLump && t === Q.liT ? Q.liLump : 0, ls: Q.lsLump && t === Q.lsT ? Q.lsLump : 0, old: f.old });
      }
      return { segments: seg, lumps: lumps, tR: Q.tR, liT: Q.liT, lsT: Q.lsT, lsEndT: Q.lsEndT, npEndT: Q.npEndT, np65T: Q.np65T, gap0: P.gap0, gap1: P.gap1, tE: P.tE };
    }

    function evalR(P, R) {
      var Q = pensions(P, R), B = W(S.asset), t, pre = null;
      /* 退休前：資產變負數就記下來（這個退休時點不可行）；負數不滾報酬 */
      for (t = 0; t < Q.tR; t++) { var a1 = B + netM(P, Q, t); if (a1 < 0 && pre === null) pre = t; B = a1 > 0 ? a1 * (1 + M_PRE) : a1; }
      var need = 0;
      for (t = P.tE - 1; t >= Q.tR; t--) need = Math.max(0, need / (1 + M_POST) - netM(P, Q, t));
      return { need: need, proj: B, gap: need - B, Q: Q, preExhaust: pre === null ? null : ageOfT(pre) };
    }

    /* 從退休那個月帶著 B0 往後走，回傳資產最低點（自我檢查用） */
    function minFrom(P, R, B0) {
      var Q = pensions(P, R), B = B0, min = Infinity;
      for (var t = Q.tR; t < P.tE; t++) { B += netM(P, Q, t); if (B < min) min = B; B *= 1 + M_POST; }
      return min;
    }

    /* 照現在的累積走到底：按月模擬，再依「你的年齡」彙總成一年一列 */
    function ledger(P, R) {
      var Q = pensions(P, R), B = W(S.asset), rows = [], cur = null, exhaust = null, preEx = null, bI = bIdx();
      for (var t = 0; t < P.tE; t++) {
        var a = Math.floor((NOWI + t - bI) / 12);
        if (!cur || cur.a !== a) { cur = { a: a, start: B, gain: 0, f: { work: 0, li: 0, ls: 0, np: 0, old: 0, living: 0, loan: 0, prepay: 0, kid: 0, par: 0, npPrem: 0, nhiPrem: 0, inflow: 0, outflow: 0, net: 0 } }; rows.push(cur); }
        var f = flowsM(P, Q, t), r = t < Q.tR ? M_PRE : M_POST;
        Object.keys(cur.f).forEach(function (k) { cur.f[k] += f[k]; });
        var after = B + f.net, gain = after > 0 ? after * r : 0;
        if (after < 0 && exhaust === null && t >= Q.tR) exhaust = ageOfT(t);
        if (after < 0 && preEx === null && t < Q.tR) preEx = ageOfT(t);
        B = after + gain; cur.gain += gain; cur.end = B;
      }
      rows.exhaust = exhaust; rows.preExhaust = preEx;
      return rows;
    }

    /* 逐月明細：每個月的收支與月初、月底資產（畫面上的「每一年 → 每個月」用） */
    function monthsRun(P, R) {
      var Q = pensions(P, R), B = W(S.asset), out = [];
      for (var t = 0; t < P.tE; t++) {
        var f = flowsM(P, Q, t), r = t < Q.tR ? M_PRE : M_POST, start = B, after = B + f.net, gain = after > 0 ? after * r : 0;
        B = after + gain;
        out.push({ t: t, idx: NOWI + t, f: f, start: start, gain: gain, end: B });
      }
      return out;
    }

    /* 按月的完整路徑：每個月的收支明細、投資收益、月底資產 */
    function monthly(P, R) {
      var Q = pensions(P, R), B = W(S.asset), out = [], ex = null;
      for (var t = 0; t < P.tE; t++) {
        var f = flowsM(P, Q, t), r = t < Q.tR ? M_PRE : M_POST, after = B + f.net, gain = after > 0 ? after * r : 0;
        if (after < 0 && ex === null && t >= Q.tR) ex = t;
        if (after < 0 && out.preT === undefined && t < Q.tR) out.preT = t;
        B = after + gain;
        out.push({ t: t, idx: NOWI + t, f: f, gain: gain, end: B });
      }
      out.Q = Q; out.exhaustT = ex; out.preExhaustT = out.preT === undefined ? null : out.preT;
      return out;
    }
    /* 這個月發生了什麼事（地圖的逐月檢視用）；金額是今天的購買力 */
    function eventsAt(P, Q, t) {
      var ev = [], idx = NOWI + t;
      if (t === Q.tR) {
        ev.push({ k: 'ret', text: '退休：薪水停了（每月少 ' + fmtW(P.inc + P.extra) + '）' });
        var o = oldLump(P, ageOfT(t)); if (o) ev.push({ k: 'in', text: '舊制退休金一次領 ' + fmtW(o) });
      }
      if (Q.npMonths && t === Q.tR) ev.push({ k: 'out', text: '開始繳國保：每月 ' + fmtW(T_.NP_PREM) });
      if (A.nhi !== false && !P.nhiDep && t === Q.tR) ev.push({ k: 'out', text: '開始自付健保（第六類）：每月 ' + fmtW(T_.NHI_SELF) });
      if (Q.npMonths && t === Q.npEndT && Q.npEndT > Q.tR) ev.push({ k: 'out', text: '國保停繳' });
      if (Q.npMonths && t === Q.np65T) ev.push({ k: 'in', text: '國保年金開始：每月 ' + fmtW(Q.npMonthly) });
      if (Q.liMonthly && t === Q.liT) ev.push({ k: 'in', text: '勞保年金開始：每月 ' + fmtW(Q.liMonthly) });
      if (Q.liLump && t === Q.liT) ev.push({ k: 'in', text: (Q.liMode === 'onetime' ? '勞保老年一次金 ' : '勞保一次領 ') + fmtW(Q.liLump) + '（之後不能再保國保）' });
      if (t === Q.lsT) {
        if (Q.lsMonthly) ev.push({ k: 'in', text: '勞退月退開始：每月 ' + fmtW(Q.lsMonthly) });
        else if (Q.lsLump) ev.push({ k: 'in', text: '勞退一次領 ' + fmtW(Q.lsLump) });
      }
      if (Q.lsMonthly && t === Q.lsEndT) ev.push({ k: 'out', text: '勞退專戶領完（月退依平均餘命分攤）' });
      P.loans.forEach(function (l) {
        if (l.payoffT !== null && t === l.payoffT) ev.push({ k: 'out', text: l.name + '提前一次還清：付 ' + fmtW(l.payoffAmt / defl(t)) + '（當時的金額約 ' + fmtW(l.payoffAmt) + '），之後不用再繳' });
        else if (l.payoffT === null && t === l.months) ev.push({ k: 'in', text: l.name + '繳完：每月少繳 ' + fmtW(l.pay / defl(t)) });
      });
      if (S.kidsOn) S.kids.forEach(function (k, i) {
        var st = kidStages(k.bym, k.path) || [], who = '第 ' + (i + 1) + ' 個孩子';
        st.forEach(function (x, j) {
          if (x.s !== idx || x.s < NOWI) return;
          if (x.pre) { ev.push({ k: 'out', text: who + '出生' }); return; }
          var prev = j > 0 ? stageCost(k, st[j - 1]) / 12 : 0, cur = stageCost(k, x) / 12;
          ev.push({ k: 'out', text: who + '上' + x.label + (Math.abs(prev - cur) > 0.5 ? '：費用每月 ' + fmtW(prev) + ' → ' + fmtW(cur) : '') });
        });
        var last = st[st.length - 1];
        if (last && last.e + 1 === idx) ev.push({ k: 'in', text: who + '今年 ' + ((last.grad % 12) + 1) + ' 月' + last.label + '畢業，這個月起費用停了（每月少 ' + fmtW(stageCost(k, last) / 12) + '）' });
      });
      if (P.par && t === P.parMonths) ev.push({ k: 'in', text: '孝親費結束：每月少 ' + fmtW(P.par) });
      return ev;
    }

    function solve(R, key, cap, baseAdj) {
      var g = function (v) { var o = Object.assign({}, baseAdj || {}); o[key] = v; return evalR(profile(o), R).gap; };
      if (g(0) <= 0) return 0;
      var hi = cap || 100000, t = 0;
      if (cap) { if (g(hi) > 0) return null; }
      else { while (g(hi) > 0 && t < 40) { hi *= 2; t++; } if (g(hi) > 0) return null; }
      var lo = 0;
      for (var i = 0; i < 55; i++) { var mid = (lo + hi) / 2; if (g(mid) <= 0) hi = mid; else lo = mid; }
      return hi;
    }

    /* 最早可以退休的月份：55 歲（或現在，若已超過）到 maxAge（預設 65 歲），逐月找第一個夠的。
       主結果固定找到 65 歲（SP5 的範圍）；壓力測試可以延長到 80 歲，算出「要工作到幾歲」 */
    function earliest(adj, maxAge) {
      var P = profile(adj), from = Math.ceil(P.A0m - 1e-9), to = Math.round((maxAge || PR.product.max_retire_age) * 12);   /* v0.6.0：從現在的年紀開始算 */
      for (var m = from; m <= to; m++) { var ev = evalR(P, m / 12); if (ev.gap <= 0 && ev.preExhaust === null) return m / 12; }
      return null;
    }
    function fromAge() { return Math.ceil(ageMonths() - 1e-9) / 12; }

    /* ================= quick form ================= */
    function validate() {
      var blank = function (v) { return v === undefined || v === null || String(v).trim() === ''; };
      if (blank(S.birth)) return '出生年月還沒填（例如 1974-11）。';
      var A0 = age();
      if (A0 === null) return '出生年月請寫成 1974-11 這種格式。';
      if (A0 >= PR.product.max_retire_age) return '這個工具算的是 ' + PR.product.max_retire_age + ' 歲以前退休，你已經 ' + PR.product.max_retire_age + ' 歲以上了。';
      if (blank(S.workStart)) return '幾歲開始工作還沒填（例如 24）。';
      var ws = num(S.workStart);
      if (!isFinite(ws) || ws < PR.labor.min_work_age || ws > A0) return '幾歲開始工作請填 ' + PR.labor.min_work_age + ' 到 ' + A0 + ' 之間的數字。';
      var need = ROLE === 'person' ? [[S.inc, '每月實際入帳']] : [[S.asset, '名下可自由動用的錢'], [S.inc, '每月實際入帳'], [S.spend, '每月基本生活費']];
      if (ROLE !== 'person' && S.house) need.push([S.housePay, '房貸每月繳幾萬'], [S.houseYrs, '房貸還剩幾年']);
      if (S.house && S.housePre) {
        var pa = num(S.housePreAge), hy = num(S.houseYrs), rt = num(S.houseRate);
        var ptm = isFinite(pa) ? mi(birthP().y + pa, birthP().mo) - NOWI : NaN;
        if (!(ptm > 0 && ptm < hy * 12)) return '提前還清的年齡要介於 ' + (A0 + 1) + ' 到 ' + Math.max(A0 + 1, Math.ceil(A0 + hy) - 1) + ' 歲之間（房貸還剩 ' + S.houseYrs + ' 年）。';
        if (!(rt >= 0 && rt <= 15)) return '房貸年利率請填 0 到 15 之間的數字，例如 2.2。';
      }
      if (S.car) need.push([S.carPay, '車貸每月繳幾萬'], [S.carYrs, '車貸還剩幾年']);
      if (S.parOn) need.push([S.par, '每月孝親費']);
      if (S.parOn && S.parMode === 'yrs') need.push([S.parYrs, '孝親費大約再幾年']);
      if (OS().oldOn) need.push([OS().oHire, '勞退舊制的到職年'], [OS().oYrs, '舊制年資'], [OS().oWage, '退休時月平均工資']);
      if (S.kidsOn) for (var i = 0; i < S.kids.length; i++) {
        var st = kidStages(S.kids[i].bym, S.kids[i].path);
        if (!st) return '第 ' + (i + 1) + ' 個孩子的出生年月請寫成 2012-05 這種格式。';
        kidGroups(st).forEach(function (g) { need.push([stageCostRaw(S.kids[i], g.g), '第 ' + (i + 1) + ' 個孩子「' + g.label + '」每年花幾萬']); });
      }
      for (var j = 0; j < need.length; j++) { var n = num(need[j][0]); if (!isFinite(n) || n < 0) return need[j][1] + '還沒填，或不是數字。'; }
      var pre = S.pre || {}, lg = legalAge(birthP().y);
      if (pre.liClaim !== undefined && pre.liClaim !== '') {
        var lc = num(pre.liClaim);
        if (!(lc >= lg - PR.li.adjust_max_years && lc <= lg + PR.li.adjust_max_years)) return '勞保請領年齡要在 ' + (lg - PR.li.adjust_max_years) + ' 到 ' + (lg + PR.li.adjust_max_years) + ' 歲之間（法定 ' + lg + ' 歲，前後各 5 年）。';
      }
      if (Array.isArray(pre.gaps)) for (var gi = 0; gi < pre.gaps.length; gi++) {
        var gg = pre.gaps[gi], gyv = num(gg.y === '' ? 0 : gg.y), gmv = num(gg.m === '' ? 0 : gg.m);
        if (!GAP_KIND[gg.sit]) return '工作空窗第 ' + (gi + 1) + ' 段：請選當時的情況。';
        if (!(gyv >= 0 && gyv <= 50 && Math.floor(gyv) === gyv)) return '工作空窗第 ' + (gi + 1) + ' 段：年要填 0 到 50 的整數。';
        if (!(gmv >= 0 && gmv <= 11 && Math.floor(gmv) === gmv)) return '工作空窗第 ' + (gi + 1) + ' 段：月要填 0 到 11 的整數。';
      }
      /* 提高準確度的數字欄位：有填就要是數字、在合理範圍（v0.7.0 補上；以前非數字會悄悄當成沒填） */
      var filled = function (v) { return v !== undefined && v !== null && String(v).trim() !== ''; };
      var maxLi = Math.max(0, Math.floor(age() - PR.labor.min_work_age) + 1);
      if (filled(pre.liYears) && !(num(pre.liYears) >= 0 && num(pre.liYears) <= maxLi)) return '勞保年資要填 0 到 ' + maxLi + ' 的數字。';
      if (filled(pre.w60) && !(W(pre.w60) > 0 && W(pre.w60) <= T_.LI_CAP + 1e-6)) return '平均月投保薪資要大於 0，而且不會超過勞保投保薪資上限 ' + (T_.LI_CAP / 10000) + ' 萬（這不是月薪，是投保級距的平均）。';
      if (filled(pre.lsBal) && !(num(pre.lsBal) >= 0 && num(pre.lsBal) <= 100000)) return '勞退專戶餘額要填 0 以上的數字（單位：萬）。';
      if (filled(pre.lsWage) && !(W(pre.lsWage) > 0 && W(pre.lsWage) <= T_.LS_CAP + 1e-6)) return '勞退月提繳工資要大於 0，而且不會超過勞退提繳上限 ' + (T_.LS_CAP / 10000) + ' 萬。';
      if (filled(pre.self) && !(num(pre.self) >= 0 && num(pre.self) <= PR.ls.self_max)) return '勞退自提要在 0% 到 ' + PR.ls.self_max + '% 之間。';
      /* 舊制的三個欄位：沒勾選舊制時不影響計算，但填了還是要是數字（v0.8.0；以前沒勾選就完全不檢查，「abc」會被當成一項有效的修改） */
      if (filled(pre.oHire) && !isFinite(num(pre.oHire))) return '勞退舊制的到職年要填數字（西元年，例如 1998）。';
      if (filled(pre.oYrs) && !isFinite(num(pre.oYrs))) return '勞退舊制年資要填數字。';
      if (filled(pre.oWage) && !isFinite(num(pre.oWage))) return '勞退舊制的月平均工資要填數字（單位：萬）。';
      if (pre.sameCo !== undefined && pre.sameCo !== '' && !(num(pre.sameCo) >= 0 && num(pre.sameCo) <= 60)) return '在目前這家公司保勞保的年數要在 0 到 60 之間。';
      if (pre.w36 !== undefined && pre.w36 !== '' && !(W(pre.w36) > 0 && W(pre.w36) <= T_.LI_CAP + 1e-6)) return '退保前 3 年平均月投保薪資要大於 0，而且不會超過勞保投保薪資上限 ' + (T_.LI_CAP / 10000) + ' 萬。';
      if (pre.inf !== undefined && pre.inf !== '' && !(num(pre.inf) >= 0 && num(pre.inf) <= 10)) return '通膨要在 0% 到 10% 之間。';
      if (pre.dep !== undefined && pre.dep !== '') {
        var dv = num(pre.dep);
        if (!isFinite(dv)) return '存款利率請填數字，例如 1.7。';
        if (dv > PR.deposit_input.max) return '存款利率最高 ' + PR.deposit_input.max + '%。超過的部分已經是投資報酬了；這裡算的是不靠投資的底線，投資的效果在 STEP 02。';
        if (dv < PR.deposit_input.min) return '存款利率最低 ' + PR.deposit_input.min + '%。一般存款不會這麼低，請確認是不是打錯。';
      }
      if (pre.lsYears !== undefined && pre.lsYears !== '') {
        var ly = num(pre.lsYears), maxLs = Math.floor((NOWI - LS_START) / 12) + 1;
        if (!(ly >= 0 && ly <= maxLs)) return '勞退提繳年資要在 0 到 ' + maxLs + ' 年之間（新制從 2005 年 7 月開始）。';
      }
      if (OS().oldOn) { var oy = num(OS().oYrs); var lsY = Math.floor(LS_START / 12); if (oy > lsY - num(OS().oHire) + PR.old.half_year.partial + 1e-9) return '舊制年資不會超過到職年到 ' + lsY + ' 年 6 月的年數。'; }
      return '';
    }

    function yearsMonthsUntil(R) { return Math.max(0, tOfAge(R)); }

    /* ---------- 人生現金流階段（依引擎事件自動切段；年齡可含月） ---------- */
    function phases(P, R, Q) {
      var cuts = [P.A0y, R, Q.liClaim, E];
      if (Q.lsMonthly) { cuts.push(Q.lsClaim); if (Q.lsEnd < E) cuts.push(Q.lsEnd); }
      if (Q.npMonths) cuts.push(PR.np.claim_age);
      cuts = cuts.filter(function (a, i, arr) { return a >= P.A0y && a <= E && arr.indexOf(a) === i; }).sort(function (a, b) { return a - b; });
      var out = [], firstPay = Math.min(Q.liMonthly > 0 ? Q.liClaim : Infinity, Q.lsMonthly ? Q.lsClaim : Infinity, Q.npMonths ? PR.np.claim_age : Infinity);
      for (var i = 0; i < cuts.length - 1; i++) {
        var f = cuts[i], t = cuts[i + 1], ls = Q.lsMonthly && f >= Q.lsClaim && f < Q.lsEnd, li = f >= Q.liClaim && Q.liMonthly > 0, np = Q.npMonths > 0 && f >= PR.np.claim_age;
        var name, parts = [];
        if (li) parts.push('勞保'); if (np) parts.push('國保'); if (ls) parts.push('勞退');
        if (f < R) name = '工作期';
        else if (ls && li) name = '雙年金期';
        else if (ls) name = '勞退期';
        else if (li) name = '勞保期';
        else if (np) name = '國保期';
        else name = f < firstPay - 1e-9 ? '橋接期' : '靠資產期';   /* 橋接＝第一筆年金開始之前；之後都沒有年金（例如勞保一次領、勞退領完）＝靠資產期 */
        var src = f < R ? '靠薪水' : parts.length ? parts.join('＋') + '＋資產' : '只靠資產';
        if (out.length && out[out.length - 1].name === name && out[out.length - 1].src === src) { out[out.length - 1].t = t; continue; }
        out.push({ name: name, src: src, f: f, t: t });
      }
      return out;
    }

    /* 事件：a 是發生時的年齡（含月），v 是每年的影響（今天的購買力） */
    function impactEvents(P, R, Q) {
      var ev = [], bI = bIdx();
      P.loans.forEach(function (l) {
        if (l.payoffT !== null) {
          ev.push({ a: ageOfT(l.payoffT), t: l.name + '提前一次還清', d: 'lumpout', v: l.payoffAmt / defl(l.payoffT), nom: l.payoffAmt });
          ev.push({ a: ageOfT(l.payoffT), t: l.name + '不用再繳', d: 'out', v: l.pay * 12 / defl(l.payoffT) });
          return;
        }
        if (l.months > 0 && l.months < P.tE) ev.push({ a: ageOfT(l.months), t: l.name + '繳完', d: 'out', v: l.pay * 12 / defl(l.months) });
      });
      if (S.kidsOn) S.kids.forEach(function (k, i) {
        var st = kidStages(k.bym, k.path); if (!st) return;
        var last = st[st.length - 1]; if (last.e < NOWI) return;
        ev.push({ a: (last.grad - bI) / 12, t: '第 ' + (i + 1) + ' 個孩子' + last.label + '畢業', d: 'out', v: stageCost(k, last), from: (last.e + 1 - bI) / 12 });
      });
      if (P.par && isFinite(P.parMonths) && P.parMonths < P.tE) ev.push({ a: ageOfT(P.parMonths), t: '孝親費結束', d: 'out', v: P.par * 12 });
      ev.push({ a: R, t: '退休', d: 'in-', v: P.inc * 12, ret: true });
      if (A.nhi !== false && !P.nhiDep) ev.push({ a: R, t: '開始自付健保（第六類）', d: 'out+', v: T_.NHI_SELF * 12 });
      var old = oldLump(P, R); if (old) ev.push({ a: R, t: '舊制退休金一次領', d: 'lump', v: old });
      if (Q.lsMonthly) ev.push({ a: Q.lsClaim, t: '勞退月退開始', d: 'in', v: Q.lsMonthly * 12 });
      else if (Q.lsLump) ev.push({ a: Q.lsClaim, t: '勞退一次領', d: 'lump', v: Q.lsLump });
      if (Q.liMonthly) ev.push({ a: Q.liClaim, t: '勞保年金開始', d: 'in', v: Q.liMonthly * 12 });
      if (Q.liLump) ev.push({ a: Q.liClaim, t: Q.liMode === 'onetime' ? '勞保老年一次金' : '勞保一次領', d: 'lump', v: Q.liLump });
      if (Q.npMonths) ev.push({ a: PR.np.claim_age, t: '國保年金開始', d: 'in', v: Q.npMonthly * 12 });
      if (Q.lsMonthly && Q.lsEnd < E) ev.push({ a: Q.lsEnd, t: '勞退專戶領完（月退依平均餘命分攤）', d: 'in-', v: Q.lsMonthly * 12 / defl(Q.T * 12) });
      return ev.sort(function (x, y) { return x.a - y.a || (y.ret ? 1 : 0) - (x.ret ? 1 : 0); });
    }

    /* 一次領 vs 月領：勞保＋國保的累計（今天的購買力，用退休後的實質存款利率折到退休那個月）。
       只呈現事實：回傳兩條累計線與「月領累計超過一次領」的年齡；不做建議 */
    function liCompare(P0, R) {
      var el = liLumpElig(P0); if (el.state !== 'yes') return { elig: el.state };
      var Pm = profile(Object.assign({}, P0.adj || {}, { liMode: '' })), Pl = profile(Object.assign({}, P0.adj || {}, { liMode: 'lump' }));
      var Qm = pensions(Pm, R), Ql = pensions(Pl, R);
      if (!Ql.liLump) return { elig: 'yes', none: true };
      var tR = Qm.tR, tE = tOfAge(E), cm = 0, cl = 0, cross = null, pts = [], d = 1;
      var flow = function (Q, t) {
        var v = 0;
        if (Q.liMonthly && t >= Q.liT) v += Q.liMonthly;
        if (Q.liLump && t === Q.liT) v += Q.liLump;
        if (A.np && t >= Q.tR && t < Q.npEndT) v -= T_.NP_PREM;
        if (Q.npMonths && t >= Q.np65T) v += Q.npMonthly;
        return v;
      };
      for (var t = tR; t < tE; t++) {
        cm += flow(Qm, t) * d; cl += flow(Ql, t) * d; d /= (1 + M_POST);
        if (cross === null && t >= Qm.liT && cm > cl) cross = ageOfT(t);
        var a = ageOfT(t + 1); if (Math.abs(a - Math.round(a)) < 1e-9) pts.push([Math.round(a), cm, cl]);
      }
      return { elig: 'yes', cross: cross, pts: pts,
        lump: { age: Ql.liClaim, amt: Ql.liLump, months: Ql.liLumpMonths, w36: Pl.w36, npMonths: Ql.npMonths, npMonthly: Ql.npMonthly },
        monthly: { age: Qm.liClaim, amt: Qm.liMonthly, kind: Qm.liMode, oneAmt: Qm.liLump, npMonths: Qm.npMonths, npMonthly: Qm.npMonthly }, years: Qm.liYears };
    }
    function bridgeInfo(P, R, ev) {
      var Q = ev.Q, bEnd = Math.min(Q.liMonthly ? Q.liClaim : E, Q.lsMonthly ? Q.lsClaim : E), out = 0;
      for (var t = Q.tR; t < tOfAge(bEnd); t++) out -= netM(P, Q, t);
      return { bEnd: bEnd, out: out };
    }

    /* 年齡顯示：57.25 → 57 歲 3 個月；ymOf(57.25) → 該月的西元年月 */
    function ageText(R) { var m = Math.round(R * 12), y = Math.floor(m / 12), r = m - y * 12; return y + ' 歲' + (r ? ' ' + r + ' 個月' : ''); }
    function ymOf(R) { var i = bIdx() + Math.round(R * 12); return { y: Math.floor(i / 12), m: i % 12 + 1 }; }

    function estList(P) {
      var pre = S.pre, l = [];
      if (!isFinite(num(pre.liYears))) l.push('勞保年資'); if (!isFinite(num(pre.w60))) l.push('平均月投保薪資');
      if (!isFinite(num(pre.lsBal))) l.push('勞退專戶餘額'); if (!isFinite(num(pre.lsWage))) l.push('勞退提繳工資'); if (!isFinite(num(pre.lsYears))) l.push('勞退提繳年資');
      return l;
    }

    sync();
    return {
      VERSION: VERSION, NOWI: NOWI, NOW: NOW, E_DEF: E_DEF, assume: A, T: T_, rates: function () { return { inf: INF, dep: DEP, depDefault: depRow.rate / 100, rPre: R_PRE, rPost: R_POST, rLs: R_LS }; }, legal: function () { return legalAge(birthP().y); },
      E: function () { return E; }, sync: sync,
      num: num, W: W, fmtW: fmtW, esc: esc, mi: mi, ymStr: ymStr, durStr: durStr, parseYM: parseYM, age: age,
      liLumpElig: liLumpElig, lumpMonths: lumpMonths, lumpAge: lumpAge, liCompare: liCompare,
      kidStages: kidStages, kidGroups: kidGroups, stageCostRaw: stageCostRaw, mayHaveOld: mayHaveOld, oldSrc: OS, kidEndIdx: kidEndIdx, parentAgeAt: parentAgeAt, kidMonthlyNow: kidMonthlyNow,
      profile: profile, pensions: pensions, lsBalNowEst: lsBalNowEst, oldLump: oldLump, flowsM: flowsM, netM: netM, personFlowsM: personFlowsM, householdFlowsM: householdFlowsM, timeline: timeline, role: ROLE, lsRemain: lsRemain, nhiUnit: nhiUnit,
      mrates: function () { return { pre: M_PRE, post: M_POST }; }, minFrom: minFrom, monthsRun: monthsRun, bIdx: bIdx,
      ageMonths: ageMonths, tOfAge: tOfAge, ageOfT: ageOfT, fromAge: fromAge, ageText: ageText, ymOf: ymOf,
      evalR: evalR, ledger: ledger, monthly: monthly, eventsAt: eventsAt, solve: solve, earliest: earliest, validate: validate, retireYM: retireYM, houseLoan: houseLoan,
      yearsMonthsUntil: yearsMonthsUntil, phases: phases, impactEvents: impactEvents, bridgeInfo: bridgeInfo, estList: estList
    };
  }

  /* 壓力測試：用更糟的情境另建一個引擎，回傳最快退休時點；不改動原本的輸入
     sel = { li: 勞保領到幾 %（100＝不打折）, inf: 通膨在原設定上多幾個百分點, end: 算到幾歲（0＝照原設定）,
             gap: 收入中斷幾年（明年 1 月起）, cut: 收入少幾 %（到退休）, spend: 75 歲起每月多花幾萬 } */
  /* 情境（調調看、萬一……共用）：另建一個引擎，回傳 { en, adj, e }；不改動原本的輸入
     sel = { li: 勞保領到幾 %, inf: 通膨多幾個百分點, end: 算到幾歲, gap: 收入中斷幾年, cut: 收入少幾 %, spend: 75 歲起每月多花幾萬,
             more: 每月多花幾元（負數＝少花）, save: 每月多存幾元（負數＝少存） } */
  function scenario(inputs, sel, opt) {
    opt = opt || {}; sel = sel || {};
    var inp = JSON.parse(JSON.stringify(inputs));
    if (sel.end) { inp.pre = inp.pre || {}; inp.pre.endAge = String(sel.end); }
    var A2 = {}; Object.keys(opt.assume || {}).forEach(function (k) { A2[k] = opt.assume[k]; });
    var inf = (sel.inf || 0) / 100;
    A2.infAdd = (A2.infAdd || 0) + inf;
    A2.depCut = (A2.depCut || 0) + (sel.dep || 0) / 100;
    if (A2.rPre != null) A2.rPre = (1 + A2.rPre) / (1 + inf) - 1;     /* 測試用的實質報酬覆寫 */
    if (A2.rPost != null) A2.rPost = (1 + A2.rPost) / (1 + inf) - 1;
    if (A2.rLs != null) A2.rLs = (1 + A2.rLs) / (1 + inf) - 1;
    var en = create(inp, { now: opt.now, assume: A2 });
    en.sync();
    var adj = { liFactor: sel.li != null ? sel.li / 100 : 1, gap: sel.gap || 0, incCut: sel.cut || 0, spend75: (sel.spend || 0) * 10000,
      cut: -(sel.more || 0) * 12, extra: (sel.save || 0) * 12 };
    return { en: en, adj: adj, e: en.earliest(adj, opt.maxAge || PR.product.max_retire_age) };
  }

  /* ===== 家庭層（v0.9.7）：一個或多個人＋一個家，逐月加總、算存款會不會用完 =====
     members：[{ en, P, Q }]，每個人自己的引擎、profile、pensions（退休月份已定）
     home：{ en, P }，提供家的支出（householdFlowsM）與報酬率；單人模式＝ members 只有那個人自己
     B0：現在的存款（元）
     opt.H：算到第幾個月（預設：成員中最晚的 P.tE，夫妻模式＝較晚過世的那位）
     opt.livingFactor(t)：家的生活費倍數（預設 1；夫妻模式：一方過世後 0.7，v1.0 接上）
     opt.premiumWaive(i, t)：第 i 位成員第 t 月是否免繳健保第六類（預設否）
     opt.extra(t)：第 t 月額外的家庭現金流（元，正＝收入；夫妻規則用，v0.9.8）
     判斷規則跟單人模式的 evalR 一致：最早有人退休之前，存款可以暫時是負的（不計利息）；之後任何一個月加完現金流後變負，就是不夠。
     利率：最早有人退休之前用 rPre，之後用 rPost（預設兩者相同，都是存款利率） */
  function household(members, home, B0, opt) {
    opt = opt || {};
    var H = opt.H != null ? opt.H : Math.max.apply(null, members.map(function (m) { return m.P.tE; }));
    var tR0 = Math.min.apply(null, members.map(function (m) { return m.Q.tR; }));
    var mr = home.en.mrates(), B = B0, min = Infinity, firstNeg = null, t, i;
    for (t = 0; t < H; t++) {
      var net = 0;
      for (i = 0; i < members.length; i++) {
        var m = members[i], pf = m.en.personFlowsM(m.P, m.Q, t);
        net += pf.net + (opt.premiumWaive && opt.premiumWaive(i, t) ? pf.nhiPrem : 0);
      }
      var hf = home.en.householdFlowsM(home.P, t), lf = opt.livingFactor ? opt.livingFactor(t) : 1;
      net += hf.net + (lf !== 1 ? hf.living * (1 - lf) : 0) + (opt.extra ? opt.extra(t) : 0);
      B = B + net;
      if (t >= tR0) { if (B < min) min = B; if (B < 0 && firstNeg === null) firstNeg = t; }
      var r = t < tR0 ? mr.pre : mr.post;
      B = B > 0 ? B * (1 + r) : B;
    }
    return { ok: firstNeg === null, firstNeg: firstNeg, min: min, end: B, H: H, tR0: tR0 };
  }

  /* ===== 夫妻規則（v0.9.8；規則與出處在 data/params.json 的 nhi_dependent、survivor） =====
     逐月算出四類調整，交給家庭組合器：
     1. 健保眷屬：有人沒工作（退休或收入中斷）、有人在工作 → 沒工作的人不繳第六類，改依附在工作的那位（較晚退休者），
        那位的保費多算眷屬：一份 × [min(3, 孩子＋沒工作的人數) − min(3, 孩子)]（孩子本來就依附他，已含在實際入帳裡）。
        都沒工作 → 一人投保第六類當戶長，其餘的人與孩子依附：第六類 × (1 ＋ min(3, 其他人＋孩子))。
     2. 勞保遺屬年金：一方過世後，另一方 55 歲以上、沒有工作的月份，自己的勞保月領與「過世者月領的一半（最低 3,000）」取高；
        過世者是一次請領（沒有月領）就沒有。自己是一次請領的，仍可領遺屬年金（擇一只限年金之間）。
     3. 國保遺屬年金：同上，一半、最低保障看 data/np_benefits.csv（113 年起 4,049），與自己的國保年金取高。
     4. 勞退專戶：月領期間過世，剩下的那個月一次回到家裡（勞退條例第 26 條）。
     5. 生活費：第一位過世後降到七成。
     只有一個人時不做任何調整（單人模式的結果不變）。過世月份＝各自的「算到幾歲」（P.tE） */
  function coupleRules(members, home, opt) {
    opt = opt || {};
    var n = members.length, H = opt.H != null ? opt.H : Math.max.apply(null, members.map(function (m) { return m.P.tE; }));
    var N = PR.nhi_dependent, SV = PR.survivor, t, i, j;
    var tD = members.map(function (m) { return m.P.tE; });
    var F = members.map(function (m) { var a = []; for (var k = 0; k < H; k++) a.push(m.en.personFlowsM(m.P, m.Q, k)); return a; });
    var nhiX = new Float64Array(H), lsLump = new Float64Array(H), living = new Float64Array(H).fill(1);
    var waive = members.map(function () { return new Uint8Array(H); });
    var sLI = members.map(function () { return new Float64Array(H); }), sNP = members.map(function () { return new Float64Array(H); });
    if (n >= 2) {
      var first = Math.min.apply(null, tD);
      for (t = first; t < H; t++) living[t] = PR.assumptions.living_after_death;
      for (t = 0; t < H; t++) {
        var alive = [], work = [], idle = [];
        for (i = 0; i < n; i++) if (t < tD[i]) { alive.push(i); (F[i][t].work > 0 ? work : idle).push(i); }
        if (!idle.length) continue;
        var kids = (home.P.kidN && t < home.P.kidN.length) ? home.P.kidN[t] : 0;
        if (work.length) {
          var w = work.slice().sort(function (a, b) { return members[b].Q.tR - members[a].Q.tR; })[0];
          var unit = members[w].en.nhiUnit(members[w].P);
          nhiX[t] -= unit * (Math.min(N.max_dependents, kids + idle.length) - Math.min(N.max_dependents, kids));
          idle.forEach(function (k) { waive[k][t] = 1; });
        } else {
          var head = idle[0], ns = members[head].en.T.NHI_SELF;
          idle.forEach(function (k) { if (k !== head) waive[k][t] = 1; });
          nhiX[t] -= ns * Math.min(N.max_dependents, idle.length - 1 + kids);
        }
      }
      for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
        if (i === j || !(tD[i] < tD[j]) || tD[i] >= H) continue;
        var Qi = members[i].Q, Qj = members[j].Q, t55 = members[j].en.tOfAge(SV.li.spouse_min_age);
        var liHalf = Qi.liMonthly > 0 && !Qi.liLump ? Math.max(SV.li.min_monthly, SV.li.ratio * Qi.liMonthly) : 0;
        var npHalf = Qi.npMonths > 0 && Qi.npMonthly > 0 ? Math.max(members[i].en.T.NP_SURV_MIN, SV.np.ratio * Qi.npMonthly) : 0;
        for (t = tD[i]; t < Math.min(tD[j], H); t++) {
          var fj = F[j][t];
          if (fj.work > 0 || t < t55) continue;
          var ownLI = (Qj.liLump && t === Qj.liT) ? 0 : fj.li;
          if (liHalf > ownLI) sLI[j][t] = liHalf - ownLI;
          if (npHalf > fj.np) sNP[j][t] = npHalf - fj.np;
        }
        lsLump[tD[i]] += members[i].en.lsRemain(members[i].P, Qi, tD[i]);
      }
    }
    var extra = new Float64Array(H);
    for (t = 0; t < H; t++) { extra[t] = nhiX[t] + lsLump[t]; for (i = 0; i < n; i++) extra[t] += sLI[i][t] + sNP[i][t]; }
    return { H: H, livingFactor: function (k) { return k < H ? living[k] : 1; }, premiumWaive: function (k, tt) { return tt < H && waive[k][tt] === 1; },
      extra: function (k) { return k < H ? extra[k] : 0; },
      detail: { tD: tD, nhiExtra: nhiX, waive: waive, survLI: sLI, survNP: sNP, lsLump: lsLump, living: living } };
  }
  /* 夫妻（或單人）＝家庭組合器＋夫妻規則；回傳 household 的結果，加上 rules（逐月明細） */
  function couple(members, home, B0, opt) {
    var r = coupleRules(members, home, opt), h = household(members, home, B0, { H: r.H, livingFactor: r.livingFactor, premiumWaive: r.premiumWaive, extra: r.extra });
    h.rules = r.detail; return h;
  }

  var api = {
    VERSION: VERSION, DATA: DATA,  pick: pick, STAGE_LABEL: STAGE_LABEL, migrateKid: migrateKid,  PATHS: PATHS, 
    create: create,
    legalAge: legalAge, liMonthlyCalc: liMonthlyCalc, lsMonthlyCalc: lsMonthlyCalc, lifeYears: lifeYears, 
    npMonthlyCalc: npMonthlyCalc, oldEligible: oldEligible, oldUnits: oldUnits, loanBalance: loanBalance, lsGradeOf: lsGradeOf, liGradeOf: liGradeOf,  scenario: scenario, household: household, couple: couple, GAP_SITS: GAP_SITS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SP5Engine = api;
})(typeof window !== 'undefined' ? window : this);
