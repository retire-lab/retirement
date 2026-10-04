/* src/app/50-precision.js — 提高準確度
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  var PRE_LABEL = { inf: '通膨', dep: '存款利率', liClaim: '請領年齡', liYears: '勞保年資', w60: '平均月投保薪資', lsBal: '專戶餘額', lsWage: '月提繳工資', lsYears: '提繳年資', self: '自提', oldOn: '勞退舊制', oHire: '到職年', oYrs: '舊制年資', oWage: '平均工資', gaps: '工作空窗', liMode: '勞保怎麼領', liPre09: '2009 年前有勞保年資', sex: '勞保登記的性別', sameCo: '同一家公司年資', w36: '退保前 3 年平均', nhiDep: '健保', endAge: '算到幾歲' };
  var PRE_GROUP = { base: ['inf', 'dep'], li: ['liClaim', 'liMode', 'liPre09', 'sex', 'sameCo', 'w36', 'liYears', 'w60'], ls: ['lsBal', 'lsWage', 'lsYears', 'self'], old: ['oldOn', 'oHire', 'oYrs', 'oWage'], gap: ['gaps'], nhi: ['nhiDep'] };
  function gapNorm(list) { return (list || []).map(function (g) { return { sit: g.sit, y: +g.y || 0, m: +g.m || 0 }; }).filter(function (g) { return g.y || g.m; }); }
  function gapStatus(list) { var n = gapNorm(list), mo = n.reduce(function (t, g) { return t + g.y * 12 + g.m; }, 0); return n.length ? n.length + ' 段・共 ' + durStr(mo) : '沒有'; }
  function preNorm(k, v) { if (k === 'gaps') return JSON.stringify(gapNorm(v)); if (k === 'nhiDep' || k === 'oldOn' || k === 'liPre09') return v ? '1' : ''; if (k === 'self') return String(v === '' || v == null ? 0 : +v); return v == null ? '' : String(v).trim(); }
  function preChanged(k) { return !!S.preDraft && preNorm(k, S.preDraft[k]) !== preNorm(k, S.pre[k]); }
  function pendingKeys() { return Object.keys(PRE_LABEL).filter(preChanged); }
  /* 逐項驗證還沒套用的實際資料：一項一項疊上去，驗證通過的才算數。
     ok：有效的項目；bad：{欄位: 錯誤訊息}；eff：只含有效項目的草稿（對照表、PDF、設為新的原始都用它） */
  function draftCheck() {
    var eff = JSON.parse(JSON.stringify(S.pre)), bad = {}, ok = [];
    if (!S.preDraft) return { eff: eff, bad: bad, ok: ok };
    pendingKeys().forEach(function (k) {
      var trial = JSON.parse(JSON.stringify(eff)); trial[k] = JSON.parse(JSON.stringify(S.preDraft[k] === undefined ? '' : S.preDraft[k]));
      var inp = JSON.parse(JSON.stringify(getInputs())); inp.pre = trial;
      var err = SP5Engine.create(inp).validate();
      if (err) bad[k] = err; else { eff = trial; ok.push(k); }
    });
    return { eff: eff, bad: bad, ok: ok };
  }
  /* 填錯的欄位：下面直接顯示錯誤，並打開所在的區塊 */
  function markFieldErrors(bad) {
    Object.keys(bad).forEach(function (k) {
      var el = document.querySelector('#panelPrec [data-pre="' + k + '"]') || document.querySelector('#panelPrec [data-pa^="' + k + ':"]') || (k === 'gaps' ? $('gapAdd') : null);
      if (!el) return;
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.setAttribute('aria-invalid', 'true');
      var host = el.closest('.row') || el.closest('.stg2') || el.parentNode, msg = document.createElement('div');
      msg.className = 'ferr'; msg.setAttribute('role', 'alert'); msg.dataset.ferr = k; msg.textContent = bad[k] + '（這一項還沒算進去）';
      host.parentNode.insertBefore(msg, host.nextSibling);
      var det = el.closest('details'); if (det) det.open = true;
    });
  }
  /* 顯示「原本 → 改成」：沒填的寫估算值（C.preEst 在畫面產生時記下） */
  function preVal(k, v) {
    var E = C.preEst || {}, empty = v === '' || v == null;
    switch (k) {
      case 'inf': return (empty ? 2 : +v) + '%';
      case 'dep': return (empty ? E.dep : +v) + '%';
      case 'liClaim': return (empty ? E.legal : +v) + ' 歲';
      case 'liYears': case 'lsYears': return empty ? '估算 ' + E[k] + ' 年' : v + ' 年';
      case 'w60': case 'lsBal': case 'lsWage': return empty ? '估算 ' + E[k] + ' 萬' : v + ' 萬';
      case 'w36': return empty ? '用平均月投保薪資估算' : v + ' 萬';
      case 'self': return (empty ? 0 : +v) + '%';
      case 'nhiDep': return v ? '依附眷屬' : '第六類自付';
      case 'oldOn': return v ? '有' : '沒有';
      case 'gaps': return gapStatus(v);
      case 'liMode': return v === 'lump' ? '一次領' : '月領';
      case 'liPre09': return v ? '確認有' : '沒確認';
      case 'sex': return v === 'F' ? '女' : v === 'M' ? '男' : '不填';
      case 'sameCo': return empty ? '—' : v + ' 年';
      case 'oHire': return empty ? '—' : v + ' 年';
      case 'oYrs': return empty ? '—' : v + ' 年';
      case 'oWage': return empty ? '—' : v + ' 萬';
      case 'endAge': return (empty ? E.endAge : +v) + ' 歲';
    }
    return String(v);
  }
  function preDiff(k) { return PRE_LABEL[k] + ' ' + preVal(k, S.pre[k]) + ' → ' + preVal(k, S.preDraft[k]); }
  /* 欄位離開（change）時才重畫，讓「調整後」那欄更新；重畫後把焦點放回原本的欄位 */
  function repaintKeep() {
    var y = window.scrollY, f = document.activeElement && document.activeElement.id;
    S.phase = null; paintResult();
    if (f && $(f)) $(f).focus();
    try { window.scrollTo(0, y); } catch (e) {}
  }
  /* 打字時只更新標記，不重畫整個畫面（避免游標跳掉） */
  function refreshPending() {
    if (!$('precBox')) return;
    Object.keys(PRE_GROUP).forEach(function (g) {
      var el = document.querySelector('[data-chg="' + g + '"]'); if (!el) return;
      var ks = PRE_GROUP[g].filter(preChanged);
      el.innerHTML = ks.map(function (k) { return '<em class="chg">' + esc(preDiff(k)) + '</em>'; }).join('');
      el.hidden = !ks.length;
    });
    var okN = draftCheck().ok.length, ap = $('applyPre'); if (ap) { ap.disabled = !okN; ap.textContent = okN ? '設為新的原始（' + okN + ' 項）' : '沒有要套用的變更'; }
  }
  function gapHtml(list) {
    var sits = SP5Engine.GAP_SITS;
    var rows = list.map(function (g, i) {
      return '<div class="gaprow"><div class="gaph"><label for="gs' + i + '">第 ' + (i + 1) + ' 段</label><button type="button" class="linkbtn" data-gapdel="' + i + '" aria-label="刪除第 ' + (i + 1) + ' 段">刪除</button></div>' +
        '<select id="gs' + i + '" data-gapsit="' + i + '">' + sits.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === g.sit ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        '<div class="gapym"><input type="text" inputmode="numeric" id="gy' + i + '" data-gapy="' + i + '" aria-label="第 ' + (i + 1) + ' 段幾年" value="' + esc(g.y) + '" placeholder="0"><span>年</span>' +
        '<input type="text" inputmode="numeric" id="gm' + i + '" data-gapm="' + i + '" aria-label="第 ' + (i + 1) + ' 段幾個月" value="' + esc(g.m) + '" placeholder="0"><span>個月</span></div></div>';
    }).join('');
    return '<div class="muted">從開始工作到今天，中間有沒有停下來過？選當時的情況、填大概多久，系統會自己調整估算。</div><div class="purpose">只用來判斷勞保、勞退年資要扣多少。不會問原因，也不影響其他計算。</div>' + rows +
      '<button type="button" class="gapadd" id="gapAdd">＋ ' + (list.length ? '再加一段' : '加一段空窗') + '</button>' +
      (list.length ? '<div class="gaptot"><span>合計</span><b>' + gapStatus(list) + '</b></div>' : '');
  }
  /* 勞保：怎麼領（月領／一次領）＋比較卡。用「還沒套用的實際資料」算，只呈現事實、不給建議 */
  /* 勞保年資未滿 15 年：說明是老年一次金，還是加計國保後 65 歲月領 */
  function liUnder15Html(d) {
    var inp = JSON.parse(JSON.stringify(getInputs())); inp.pre = JSON.parse(JSON.stringify(draftCheck().eff)); inp.pre.liMode = '';
    var en = SP5Engine.create(inp); if (en.validate()) return ''; en.sync();
    var P = en.profile(), e = en.earliest(), R = e !== null ? e : 65, Q = en.pensions(P, R);
    if (Q.liMode !== 'onetime' && Q.liMode !== 'combined') return '';
    var y = Math.round(Q.liYears * 10) / 10, np = Math.round(Math.max(0, 65 - R) * 10) / 10;
    if (Q.liMode === 'combined') return '<div class="limsg u15">你退休時勞保年資 ' + y + ' 年，未滿 15 年；加上退休後到 65 歲的國保年資 ' + np + ' 年，合計滿 15 年，<b>' + ageText(Q.liClaim) + '可以月領勞保年金 ' + fmtW(Q.liMonthly) + '</b>。' +
      '<span>只用勞保年資算，不能提前、延後，所以上面的請領年齡不適用；國保年金另外算。你也可以選擇領老年一次金，但領了就不能再併計國保年資改月領。（勞保條例第 58 條、勞動部說明）</span></div>';
    return '<div class="limsg u15">你退休時勞保年資 ' + y + ' 年，未滿 15 年，加上國保年資也不滿 15 年，<b>' + ageText(Q.liClaim) + '可以領老年一次金 ' + fmtW(Q.liLump) + '</b>。' +
      '<span>每年 1 個月 × 平均月投保薪資，60 歲以後的年資最多算 5 年；要先退保、到法定年齡才能領，所以上面的請領年齡不適用。（勞保條例第 58 條、勞保局給付標準）</span></div>';
  }
  function liLumpHtml(d) {
    var inp = JSON.parse(JSON.stringify(getInputs())); inp.pre = JSON.parse(JSON.stringify(draftCheck().eff));
    var en = SP5Engine.create(inp); if (en.validate()) return ''; en.sync();
    var P = en.profile(), el = en.liLumpElig(P), e = en.earliest(), R = e !== null ? e : 65;
    var head = '<div class="row lihow"><div class="f">怎麼領</div>';
    if (el.state === 'no') return head + '<div class="limsg">你只能月領。<span>你在 2009 年以後才開始工作；2009 年以後才第一次保勞保的人，不能選一次領（勞保條例第 58 條）。</span></div></div>';
    if (el.state === 'unknown') return head + '<div class="limsg warn">還無法判斷你能不能選一次領。<span>要 2009 年以前就有勞保年資才能選。請到勞保局 e 化服務系統查「個人年資」，把勞保年資填在下面就會自動判斷；年資比較短的話，查過之後在這裡確認。</span>' +
      '<label class="check"><input type="checkbox" data-pre="liPre09"' + (d.liPre09 ? ' checked' : '') + '><span>我查過了，2009 年以前就有勞保年資</span></label></div></div>';
    var mode = d.liMode === 'lump' ? 'lump' : '', Q = en.pensions(P, R), yrs = Q.liYears, c = en.liCompare(P, R);
    var out = head + '<div class="liok">' + (el.by === 'confirmed' ? '你確認過 2009 年以前就有勞保年資' : '你 2009 年以前就有勞保年資') + '，可以選一次領（勞保條例第 58 條）。</div>' +
      (el.by === 'confirmed' ? '<label class="check"><input type="checkbox" data-pre="liPre09" checked><span>我查過了，2009 年以前就有勞保年資</span></label>' : '') +
      '<div class="seg" role="group" aria-label="勞保怎麼領"><button type="button" data-pa="liMode:" aria-pressed="' + (mode === '') + '">月領</button><button type="button" data-pa="liMode:lump" aria-pressed="' + (mode === 'lump') + '">一次領</button></div>' +
      '<div class="row"><label class="f" for="pW36">退保前 3 年平均月投保薪資（萬，選填）</label><input id="pW36" type="text" inputmode="decimal" data-pre="w36" value="' + esc(d.w36 || '') + '" placeholder="沒填就用 ' + (P.w60 / 10000).toFixed(2) + ' 估算"></div>' +
      '<div class="purpose">只用來算一次請領的金額：法定是用退保前 3 年（36 個月）的平均，不是最高 60 個月。退休前幾年降薪或改兼職的人，兩者會差很多。勞保局 e 化服務系統查得到。</div></div>';
    /* 只在會改變答案時才問：年資未滿 15 年才問性別；50 歲以前退休才問同一家公司的年資 */
    var askSex = yrs < 15 - 1e-9 && R < 60 - 1e-9, askCo = R < 50 - 1e-9;
    if (askSex || askCo) {
      out += '<div class="liq"><div class="muted" style="margin-top:0">' + (askSex ? '你退休時勞保年資未滿 15 年，' : '你打算 50 歲以前退休，') + '下面' + (askSex && askCo ? '兩題' : '這題') + '可能會讓一次領更早。都是選填。</div>';
      if (askSex) out += '<div class="f" style="margin-top:10px">勞保登記的性別（選填）</div><div class="seg" role="group" aria-label="勞保登記的性別">' +
        [['M', '男'], ['F', '女'], ['', '不填']].map(function (o) { return '<button type="button" data-pa="sex:' + o[0] + '" aria-pressed="' + ((d.sex || '') === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        '<div class="purpose">只用來判斷勞保一次領最早幾歲能領：勞保條例第 58 條規定，女性年資滿 1 年、55 歲就能一次領，男性要 60 歲。不影響其他計算。</div>';
      if (askCo) out += '<div class="row"><label class="f" for="pSc">在目前這家公司保勞保幾年（選填）</label><input id="pSc" type="text" inputmode="decimal" data-pre="sameCo" value="' + esc(d.sameCo || '') + '" placeholder="例如 20"></div>' +
        '<div class="purpose">只用來判斷勞保一次領最早幾歲能領：勞保條例第 58 條規定，在同一家公司保滿 25 年，不論幾歲都能一次領。不影響其他計算。</div>';
      out += '</div>';
    }
    if (c.elig === 'yes' && !c.none) out += liCompareHtml(en, c);
    return out;
  }
  function liSentence(c) {
    var pts = c.pts, last = pts.length ? pts[pts.length - 1] : [0, 0, 0];
    return c.monthly.kind === 'onetime' ? '兩種都是一次拿：到 ' + EN0.E() + ' 歲，一次請領累計' + (last[2] >= last[1] ? '多 ' + fmtW(last[2] - last[1]) : '少 ' + fmtW(last[1] - last[2])) + '（含國保）。'
      : c.cross !== null ? '活過 ' + ageText(c.cross) + '，月領累計超過一次領。' : '算到 ' + EN0.E() + ' 歲，月領累計都沒有超過一次領。';
  }
  function liCompareHtml(en, c) {
    var pts = c.pts, W2 = 330, L = 40, Rr = 6, T = 14, H = 170, w = W2 - L - Rr;
    var a0 = pts.length ? pts[0][0] - 1 : 55, a1 = pts.length ? pts[pts.length - 1][0] : 90;
    var vs = pts.map(function (p) { return p[1]; }).concat(pts.map(function (p) { return p[2]; })).concat([0]);
    var vmax = Math.max.apply(null, vs) * 1.08, vmin = Math.min.apply(null, vs), rng = (vmax - vmin) || 1;
    var X = function (a) { return L + (a - a0) / Math.max(1, a1 - a0) * w; }, Y = function (v) { return T + H - (v - vmin) / rng * H; };
    var g = '', step = Math.pow(10, Math.floor(Math.log10(Math.max(1, vmax / 3)))); step = Math.ceil(vmax / 3 / step) * step;
    for (var v = 0; v <= vmax; v += step) g += '<line x1="' + L + '" x2="' + (L + w) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="cg"></line><text x="' + (L - 4) + '" y="' + (Y(v) + 3).toFixed(1) + '" class="ct ty">' + fmtW(v).replace(' 萬', '') + '</text>';
    for (var ag = Math.ceil(a0 / 5) * 5; ag <= a1; ag += 5) g += '<text x="' + X(ag).toFixed(1) + '" y="' + (T + H + 14) + '" class="ct tx">' + ag + '</text>';
    g += '<line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (T + H) + '" class="ca"></line><line x1="' + L + '" x2="' + (L + w) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="ca"></line>';
    g += '<text x="' + (L + w) + '" y="' + (T + H + 28) + '" class="ct tx" text-anchor="end">年齡</text><text x="2" y="' + (T - 4) + '" class="ct">萬</text>';
    var line = function (k) { return pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[k]).toFixed(1); }).join(' '); };
    var mk = '';
    if (c.cross !== null) { var cx = X(c.cross), row = pts.filter(function (p) { return p[0] >= c.cross; })[0]; mk = '<line x1="' + cx.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y1="' + T + '" y2="' + (T + H) + '" class="cv"></line>' + (row ? '<circle cx="' + cx.toFixed(1) + '" cy="' + Y(row[2]).toFixed(1) + '" r="4.5" class="cxm"></circle>' : '') + '<text x="' + Math.min(cx + 6, L + w - 70).toFixed(1) + '" y="' + (T + 12) + '" class="cl">' + ageText(c.cross) + '交叉</text>'; }
    var svg = '<svg viewBox="0 0 ' + W2 + ' ' + (T + H + 34) + '" class="curve" role="img" aria-label="一次領與月領的累計金額"><title>一次領與月領的累計金額（含國保，今天的購買力）</title>' + g +
      '<polyline points="' + line(2) + '" class="lil"></polyline><polyline points="' + line(1) + '" class="lim"></polyline>' + mk + '</svg>';
    var sentence = liSentence(c);
    return '<div class="licmp"><b>一次領和月領，累計各拿多少</b><div class="muted" style="margin-top:2px">含國保；今天的購買力，以實質存款利率折算到退休那個月</div>' +
      '<div class="li2"><div class="lb lump"><b>一次領</b><div>' + ageText(c.lump.age) + '領 <b>' + fmtW(c.lump.amt) + '</b></div><small>' + (Math.round(c.lump.months * 100) / 100) + ' 個月 × 平均月投保薪資；之後不能保國保</small></div>' +
      '<div class="lb mon"><b>' + (c.monthly.kind === 'onetime' ? '老年一次金' : c.monthly.kind === 'combined' ? '月領（併計國保）' : '月領') + '</b><div>' + (c.monthly.kind === 'onetime' ? ageText(c.monthly.age) + '領 <b>' + fmtW(c.monthly.oneAmt) + '</b>' : ageText(c.monthly.age) + '起每月 <b>' + fmtW(c.monthly.amt) + '</b>') + '</div><small>' + (c.monthly.npMonths ? '退休到開始領之前繳國保；65 歲起國保每月 ' + fmtW(c.monthly.npMonthly) : '不用繳國保') + '</small></div></div>' + svg +
      '<div class="clg"><span><i class="lg lil"></i>一次領</span><span><i class="lg lim"></i>' + (c.monthly.kind === 'onetime' ? '老年一次金' : '月領') + '</span></div>' +
      '<div class="lisent">' + sentence + '</div>' +
      '<div class="purpose">' + (c.lump.w36 !== null && c.lump.w36 !== undefined ? '一次領用你填的退保前 3 年平均（' + fmtW(c.lump.w36) + '）。' : '一次領法定用「退保前 3 年」的平均投保薪資，這裡以你填的平均月投保薪資估算；可以在上面填實際數字。') + '一次領之後不能再參加國民年金保險（2023 年 10 月起），國保已一起算進去。一次領一經核付就不能改。女性、在同一家公司保滿 25 年，或從事危險、需要強體力的特殊工作的人，可能更早就能一次領，請以勞保局為準。</div></div>';
  }
  function preEstimates(P) {
    return { legal: EN.legal(), dep: Math.round(EN.rates().depDefault * 1000) / 10, endAge: EN.E_DEF,
      liYears: Math.round(P.liYearsNow), w60: (P.w60 / 10000).toFixed(2), lsBal: Math.round(lsBalNowEst(P) / 10000), lsWage: (P.lsWage / 10000).toFixed(2),
      lsYears: Math.round(Math.max(0, Math.min(P.worked, (EN.NOWI - (2005 * 12 + 6)) / 12))) };
  }
  function precHtml(P) {
    var depDef = Math.round(EN.rates().depDefault * 1000) / 10;
    var paGroup = function (key, label, opts, cur, sub) { return '<div class="stg2"><div class="stl">' + label + '</div>' + (sub ? '<div class="sts">' + sub + '</div>' : '') + '<div class="chips" style="margin-top:4px">' + opts.map(function (o) { return '<button type="button" class="chip" data-pa="' + key + ':' + o[0] + '" aria-pressed="' + (o[0] === cur) + '">' + o[1] + '</button>'; }).join('') + '</div></div>'; };
    var fold = function (key, title, status, inner) {
      var open = S.preErr || (S.pf && S.pf[key]);
      return '<details class="pfold" data-pf="' + key + '"' + (open ? ' open' : '') + '><summary><b>' + title + '</b><span>' + status + '</span><div class="chgs" data-chg="' + key + '" hidden></div></summary><div class="pfin">' + inner + '</div></details>';
    };
    var dv = function (k) { return S.pre[k] !== '' && S.pre[k] != null; };
    var liN = (dv('liYears') ? 0 : 1) + (dv('w60') ? 0 : 1), lsN = (dv('lsBal') ? 0 : 1) + (dv('lsWage') ? 0 : 1) + (dv('lsYears') ? 0 : 1);
    C.preEst = preEstimates(P);
    /* 標題的狀態一律是「目前生效的值」（S.pre）；準備要改的值在旁邊的標記顯示 */
    var lgA = EN.legal(), cl = S.pre.liClaim, Qb = EN0.pensions(P, C.Rorig != null ? C.Rorig : 65);
    var claimTxt = cl === '' || cl == null ? lgA + ' 歲領（法定）' : cl + ' 歲領（' + (+cl < lgA ? '減給 ' + (lgA - cl) * 4 + '%' : +cl > lgA ? '加給 ' + (cl - lgA) * 4 + '%' : '法定') + '）';
    var d = S.preDraft, l = estList(P), TOTAL = 5, lvl = l.length === TOTAL ? '基本' : l.length ? '部分用實際資料' : '已用實際資料';
    var f = function (id, key, label, ph) { return '<div><label class="f" for="' + id + '">' + label + '</label><input id="' + id + '" type="text" inputmode="decimal" data-pre="' + key + '" placeholder="' + ph + '" value="' + esc(d[key]) + '"></div>'; };
    var lg = EN.legal(), opts = '<option value=""' + (d.liClaim === '' ? ' selected' : '') + '>法定年齡（' + lg + ' 歲）</option>';
    for (var a = lg - 5; a <= lg + 5; a++) if (a !== lg) opts += '<option value="' + a + '"' + (String(d.liClaim) === String(a) ? ' selected' : '') + '>' + a + ' 歲（' + (a < lg ? '減給 ' + (lg - a) * 4 + '%' : '加給 ' + (a - lg) * 4 + '%') + '）</option>';
    return '<div class="prec" id="precBox"><div class="pm">目前精度：<b>' + lvl + '</b></div>' +

      (S.preErr ? '<div class="err" style="margin-top:8px">' + esc(S.preErr) + '</div>' : '') +
      '<h3 class="ph3">基本假設</h3><div class="chgs" data-chg="base" hidden></div><div class="muted">這兩個會改變上面的主結果。</div>' +
      paGroup('inf', '通膨（每年）', [['2', '2%（預設）'], ['2.5', '2.5%'], ['3', '3%']], d.inf === '' || d.inf == null ? '2' : String(d.inf)) +
      paGroup('dep', '存款利率（每年）', [['0.8', '0.8% 活存'], [String(depDef), depDef + '% 一年定存（預設）'], ['2', '2.0% 優利定存']], d.dep === '' || d.dep == null ? String(depDef) : String(d.dep),
        '本平台不算投資：名下可自由動用的錢，假設都放在銀行。預設是臺灣銀行一年期定存牌告。') +
      (function () { var i = (d.inf === '' || d.inf == null ? 2 : +d.inf) / 100, r = (d.dep === '' || d.dep == null ? depDef : +d.dep) / 100, real = (1 + r) / (1 + i) - 1;
        return '<div class="realr ' + (real < 0 ? 'neg' : 'pos') + '"><span>扣掉通膨後，你的錢每年</span><b>' + (real < 0 ? '-' + pct(-real) + '（慢慢縮水）' : '+' + pct(real)) + '</b></div>'; })() +
      '<h3 class="ph3">你的實際資料</h3><div class="muted">登入勞保局 e 化服務系統查得到。沒填的用估算值（灰字）。</div>' +
      fold('gap', '工作空窗', gapStatus(S.pre.gaps), gapHtml(d.gaps || [])) +
      fold('li', '勞保老年年金', (liN ? liN + ' 項估算' : '已填') + '・' + (Qb.liMode === 'lump' ? ageText(Qb.liClaim) + '一次領' : Qb.liMode === 'onetime' ? ageText(Qb.liClaim) + '老年一次金' : Qb.liMode === 'combined' ? ageText(Qb.liClaim) + '月領（併計國保）' : claimTxt),
            '<div class="row"><label class="f" for="pLc">幾歲開始領（可以提早到 ' + (lg - 5) + ' 歲）</label><select id="pLc" data-pre="liClaim">' + opts + '</select>' +
      '<div class="muted" style="margin-top:4px">要先離職退保才能領，所以不會早於你退休的時間。早領每年少 4%（按月計），但可以縮短只靠資產的那段。</div></div>' + liUnder15Html(d) + liLumpHtml(d) +
      '<div class="g2 row">' + f('pLy', 'liYears', '勞保年資（年）', '估算 ' + Math.round(P.liYearsNow)) + f('pW', 'w60', '平均月投保薪資（萬）', '估算 ' + (P.w60 / 10000).toFixed(2)) + '</div>') +
      fold('ls', '勞退新制', lsN ? lsN + ' 項估算' : '已填',
      '<div class="g2 row">' + f('pB', 'lsBal', '專戶目前餘額（萬）', '估算 ' + Math.round(lsBalNowEst(P) / 10000)) + f('pLw', 'lsWage', '月提繳工資（萬）', '估算 ' + (P.lsWage / 10000).toFixed(2)) + '</div>' +
      '<div class="g2 row">' + f('pLs', 'lsYears', '實際提繳年資（年）', '估算 ' + Math.round(Math.max(0, Math.min(P.worked, (EN.NOWI - (2005 * 12 + 6)) / 12)))) +
      '<div><label class="f" for="pS">自提</label><select id="pS" data-pre="self">' + [0, 1, 2, 3, 4, 5, 6].map(function (v) { return '<option value="' + v + '"' + (String(v) === String(d.self) ? ' selected' : '') + '>' + v + '%</option>'; }).join('') + '</select></div></div>' +
      '<div class="muted" style="margin-top:4px">實際提繳滿 15 年才能月領，不到 15 年只能一次領（勞工退休金條例第 24 條）。換過工作、中斷過的年資會合併計算。</div>') +
      fold('old', '勞退舊制', S.pre.oldOn ? esc(S.pre.oYrs) + ' 年・平均工資 ' + esc(S.pre.oWage) + ' 萬' : '沒有',
        '<label class="check row"><input type="checkbox" data-pre="oldOn"' + (d.oldOn ? ' checked' : '') + '><span>2005 年 7 月以前就在現在這家公司，有保留勞退舊制年資</span></label>' +
        '<div class="g3 row">' + f('pOh', 'oHire', '到職年', '例如 1999') + f('pOy', 'oYrs', '舊制年資（年）', '例如 6') + f('pOw', 'oWage', '退休時月平均工資（萬）', '例如 8') + '</div>' +
        '<div class="muted" style="margin-top:4px">勾了才會算。年資可以填小數（4 年 6 個月填 4.5）；平均工資是退休前 6 個月、含經常性津貼的平均，用今天的物價估。符合自請退休條件時由公司一次發給，沒符合就是 0。</div>') +
      fold('nhi', '健保', S.pre.nhiDep ? '依附眷屬' : '第六類自付',
      '<label class="check row"><input type="checkbox" data-pre="nhiDep"' + (d.nhiDep ? ' checked' : '') + '><span>退休後可以依附在職的配偶或子女，當健保眷屬</span></label>' +
      '<div class="muted" style="margin-top:4px">沒勾：退休後以第六類自付，每月 ' + EN.T.NHI_SELF.toLocaleString('en-US') + ' 元。勾了：不用自己繳。</div><div class="purpose">只用來判斷退休後要不要自己繳健保費。</div>') +
'<div class="muted" style="margin-top:14px">改了的項目會先放在上面「調整後」那欄對照，確定了再設為新的原始。</div>' +
      '<div class="g2 row" style="margin-top:6px"><button type="button" class="primary" id="applyPre" style="height:44px">套用並重新計算</button><button type="button" id="clearPre" style="height:44px">清除，改回估算</button></div>' +
      '</div>';
  }
