/* src/app/85-ui.js — 對話框、提示、方案列
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  function newId() { return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function uniqName(base) { var n = base.slice(0, 20), i = 2; while (DB.list.some(function (x) { return x.name === n; })) n = (base.slice(0, 17) + ' ' + i++); return n; }
  function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 2600); }
  function modal(title, bodyHtml, buttons) {
    $('mTitle').textContent = title; $('mBody').innerHTML = bodyHtml;
    $('mBtns').innerHTML = buttons.map(function (b, i) { return '<button type="button" data-mb="' + i + '" class="' + (b.cls || '') + '">' + b.label + '</button>'; }).join('');
    /* 可近用性（v0.9.0）：記住是誰打開的；背景設為不可操作（inert）；焦點放進對話框；Tab 在對話框裡循環（見 95-events） */
    if ($('modal').hidden) modal.prev = document.activeElement;
    modal.cb = buttons; $('modal').hidden = false;
    /* 只鎖對話框以外的東西：從對話框往上一層一層，把兄弟元素設成不可操作（對話框本身、提示訊息不動）。
       v0.9.0 曾把整個 <main> 設成 inert，但對話框就在 <main> 裡面，結果連對話框一起鎖住、按不了（v0.9.2 修正） */
    var n = $('modal'), set = modal.inerted || [];
    while (n && n.parentElement && n !== document.body) {
      [].forEach.call(n.parentElement.children, function (sib) {
        if (sib === n || sib.id === 'toast' || sib.tagName === 'SCRIPT' || sib.hasAttribute('inert')) return;
        sib.setAttribute('inert', ''); sib.setAttribute('aria-hidden', 'true'); set.push(sib);
      });
      n = n.parentElement;
    }
    modal.inerted = set;
    var f = $('mBody').querySelector('input') || $('mBtns').querySelector('button'); if (f) f.focus();
  }
  /* 回報問題（v0.9.4）：寄信給維護者。主旨與內容先填好版本、目前畫面、裝置，方便找問題。
     絕不帶入使用者填的任何數字（資料只在這台裝置上） */
  var FB_MAIL = 'hsuchen1@gmail.com';
  function fbDevice() {
    var u = navigator.userAgent || '';
    var dev = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : '其他裝置';
    var br = /Edg\//.test(u) ? 'Edge' : /Line\//.test(u) ? 'LINE 內建瀏覽器' : /FBAN|FBAV|Instagram|Barcelona|Threads/.test(u) ? '社群 App 內建瀏覽器' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /FxiOS|Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : '其他瀏覽器';
    return dev + '・' + br;
  }
  function fbScreen() {
    var on = function (id) { var el = $(id); return !!el && !el.hidden; };
    var s = on('result') ? '結果頁' : on('list') ? '方案清單' : '快速開始';
    if (s === '結果頁' && S.panel) s += '（' + (S.panel === 'adj' ? '調調看' : '提高準確度') + '打開）';
    if (!$('modal').hidden) s += '，對話框「' + $('mTitle').textContent + '」';
    return s;
  }
  function fbHref() {
    var subject = '退休試算 回報問題（v' + EN0.VERSION + '）';
    var body = '（請在這裡寫下你遇到的問題或想法）\n\n\n' +
      '—— 以下自動帶入，方便找問題 ——\n版本：v' + EN0.VERSION + '\n畫面：' + fbScreen() + '\n裝置：' + fbDevice() + '\n日期：' + todayISO() + '\n\n' +
      '不用寫出生年月、資產這些個資；如果問題跟某個數字有關，可以附上截圖（記得先遮住你不想給人看的部分）。';
    return 'mailto:' + FB_MAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  /* 存款利率的來源（v0.9.6）：沒填＝臺銀一年期定存牌告；填了＝使用者自己設定 */
  function depSrc() { return S.pre && S.pre.dep !== '' && S.pre.dep != null ? '你設定的' : '一年期定存'; }
  function closeModal() {
    $('modal').hidden = true; modal.cb = null;
    (modal.inerted || []).forEach(function (el) { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }); modal.inerted = [];
    var p = modal.prev; modal.prev = null;
    if (p && document.contains(p) && typeof p.focus === 'function') p.focus();   /* 焦點還給打開它的按鈕（還在畫面上的話） */
  }
  /* 對話框裡可以聚焦的元素（Tab 循環用） */
  function modalFocusables() { return [].slice.call($('modal').querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')).filter(function (el) { return !el.disabled && !el.hidden && !(el.closest && el.closest('[hidden]')); }); }
  function guard(next) {
    if (!isDirty()) return next();
    modal('目前的方案有未存檔的修改', '<div class="muted">「' + esc(active().name) + '」改過的地方還沒存。</div>', [
      { label: '存檔後繼續', cls: 'primary', fn: function () { doSave(); next(); } },
      { label: '不存檔直接繼續', fn: function () { next(); } },
      { label: '取消', fn: function () {} }
    ]);
  }
  function doSave() {
    var a = active(); if (!a) return;
    /* v1.0.3：目前的方案是夫妻的，就存夫妻畫面的資料（單人的資料絕不寫進夫妻方案；夫妻畫面沒有載入這個方案就不動它） */
    if (a.saved && a.saved.mode === 'couple') { if (CP.id === a.id && CP.inp) { a.saved = JSON.parse(JSON.stringify(CP.inp)); a.updated = nowStr(); if (saveDB()) toast('已存檔：' + a.name); } return; }
    a.saved = getInputs(); a.updated = nowStr(); if (saveDB()) toast('已存檔：' + a.name);
  }
  function syncForm() {
    document.querySelectorAll('#quick input[data-k]').forEach(function (el) { el.value = S[el.dataset.k] == null ? '' : S[el.dataset.k]; });
    S.etab = null; S.openKid = null; S.openLump = null;
    paintLumps(); paintResv(); paintTabs();
    $('housePre').checked = !!S.housePre; $('sec-housePre').hidden = !S.housePre; paintPrepay();
    document.querySelectorAll('[name=parMode]').forEach(function (r) { r.checked = r.value === (S.parMode || 'keep'); });
    if (!S.kids || !S.kids.length) S.kids = [{ bym: '', path: 'grad', costs: {} }];
    paintKids(); paintAge(); paintAccum(); showErr('');
  }
  /* ===== v1.0.2：未來的大筆收支清單（單人、夫妻共用同一份畫面）=====
     o.box：外框樣式；o.input(i, 欄位) → 輸入框的屬性；o.btn(i, 欄位, 值)、o.del(i) → 按鈕的屬性；o.add：「再加一筆」的屬性；o.people（2＝夫妻）；o.names */
  function lumpsHtml(list, o) {
    var seg = function (i, f, cur, opts, label) {
      return '<div class="seg" role="group" aria-label="' + label + '">' + opts.map(function (x) { return '<button type="button" ' + o.btn(i, f, x[0]) + ' aria-pressed="' + (cur === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    };
    var row = function (lab, id, attr, val, ph, unit, mode) {
      return '<div class="qf"><label class="qlab" for="' + id + '">' + lab + '</label><div class="qin"><input id="' + id + '" type="text" inputmode="' + (mode || 'decimal') + '" ' + attr + ' value="' + esc(String(val == null ? '' : val)) + '" placeholder="' + ph + '">' + (unit ? '<span class="u">' + unit + '</span>' : '') + '</div></div>';
    };
    var whens = [['ym', '某年某月'], ['age', o.names[0] + '幾歲']].concat(o.people === 2 ? [['page', o.names[1] + '幾歲']] : []);
    return list.map(function (x, i) {
      var id = o.idp + i, ym = x.when === 'ym';
      if (o.open !== i) return '<div class="isum"><div><b>' + esc(String(x.name || '').trim() || '第 ' + (i + 1) + ' 筆') + '</b><div class="muted">' + lumpWhenText(x, o.names) + '</div></div>' +   /* v1.0.3：填好的收成一行 */
        '<div style="text-align:right"><b class="' + (x.kind === 'in' ? 'amt-in' : 'amt-out') + '">' + (num(x.amt) > 0 ? (x.kind === 'in' ? '＋' : '−') + esc(String(x.amt)) + ' 萬' : '金額還沒填') + '</b><div><button type="button" class="linkbtn" ' + o.openAt(i) + '>修改</button></div></div></div>';
      return '<div class="' + o.box + '"><div class="cou-kidh"><b>第 ' + (i + 1) + ' 筆</b><button type="button" class="linkbtn" ' + o.del(i) + ' aria-label="刪除第 ' + (i + 1) + ' 筆大筆收支">刪除</button></div>' +
        row('名稱', id + 'n', o.input(i, 'name'), x.name, '例如 換車、孩子第一桶金、儲蓄險到期', '', 'text') +
        '<div class="qlab" style="margin-top:8px">收入還是支出</div>' + seg(i, 'kind', x.kind || 'out', [['out', '支出'], ['in', '收入']], '收入還是支出') +
        row('金額', id + 'a', o.input(i, 'amt'), x.amt, '例如 80', '萬') + '<div class="qhint">用今天的購買力填，系統自己換算。</div>' +
        '<div class="qlab" style="margin-top:8px">什麼時候</div>' + seg(i, 'when', x.when || 'age', whens, '什麼時候') +
        row(ym ? '西元年月' : '幾歲', id + 'w', o.input(i, 'val'), x.val, ym ? '西元年月，不用打 -' : '例如 60', ym ? '' : '歲', 'numeric') +
        '<button type="button" class="primary" style="margin-top:10px" ' + o.done + '>好了</button></div>';
    }).join('') + (list.length < 20 ? '<button type="button" class="linkbtn" ' + o.add + '>＋ 再加一筆</button>' : '');
  }
  function ymShow(v) { var m = /^(\d{4})\D?(\d{1,2})$/.exec(String(v || '').trim()); return m ? m[1] + '/' + ('0' + (+m[2])).slice(-2) : esc(String(v || '')); }   /* 201604 → 2016/04 */
  function lumpWhenText(x, names) {
    var v = String(x.val == null ? '' : x.val).trim(); if (!v) return '還沒填時間';
    if (x.when === 'ym') { var m = /^(\d{4})\D?(\d{1,2})$/.exec(v); return m ? m[1] + ' 年 ' + (+m[2]) + ' 月' : v; }
    return (x.when === 'page' ? names[1] : names[0]) + ' ' + esc(v) + ' 歲';
  }
  /* v1.0.3：「以後會結束的支出」按鈕上的摘要（單人、夫妻共用；I＝輸入，kids 只算填了出生年月的） */
  function tabSummary(k, I) {
    var f = function (v) { return String(v == null ? '' : v).trim(); };
    if (k === 'house') return f(I.housePay) && f(I.houseYrs) ? f(I.housePay) + ' 萬・還 ' + f(I.houseYrs) + ' 年' : '還沒填';
    if (k === 'car') return f(I.carPay) && f(I.carYrs) ? f(I.carPay) + ' 萬・還 ' + f(I.carYrs) + ' 年' : '還沒填';
    if (k === 'carsOn') return (I.cars || []).filter(function (c) { return f(c.pay); }).length + ' 台';
    if (k === 'kidsOn') { var n = (I.kids || []).filter(function (x) { return f(x.bym); }).length; return n ? n + ' 個' : '還沒填'; }
    if (k === 'parOn') return f(I.par) ? f(I.par) + ' 萬／月' : '還沒填';
    if (k === 'lumpsOn') return (I.lumps || []).length + ' 筆';
    return '';
  }
  /* v1.0.5：「以後會結束的支出」的大方塊——單人、夫妻用同一個函式產生，長相不會再各自分岔。
     list：[[key, 名稱]]；I：輸入；cur：目前這一頁；attr(key) → 按鈕的屬性（單人 data-chip、夫妻 data-cpchip） */
  var EXP_ICON = { house: '🏠', car: '🚗', carsOn: '🚗', kidsOn: '🎓', parOn: '🧓', lumpsOn: '💰' };
  function expTilesHtml(list, I, cur, attr) {
    return list.map(function (x) {
      var k = x[0], on = !!I[k], c = on && cur === k;
      return '<button type="button" class="tile' + (c ? ' cur' : '') + '" ' + attr(k) + ' aria-pressed="' + on + '" aria-expanded="' + c + '"><span class="ic">' + EXP_ICON[k] + '</span><b>' + x[1] + '</b><span class="tsum" data-sum="' + k + '">' + (on ? esc(tabSummary(k, I)) : '') + '</span></button>';
    }).join('');
  }
  function newLump() { return { name: '', kind: 'out', amt: '', when: 'age', val: '' }; }
  /* 養老預備金的參考按鈕：用剛填的生活費算半年、一年 */
  function reserveChips(spend, cur, attr) {   /* attr(值) → 按鈕的屬性 */
    var m = num(spend); if (!(m > 0)) return '';
    var r = function (x) { return String(Math.round(x * 10) / 10); };
    return '<div class="chips">' + [['半年生活費', m * 6], ['一年生活費', m * 12]].map(function (x) { return '<button type="button" class="chip" ' + attr(r(x[1])) + ' aria-pressed="' + (String(cur) === r(x[1])) + '">' + x[0] + ' ' + r(x[1]) + ' 萬</button>'; }).join('') + '</div><div class="qhint">參考用：用你上面填的生活費算，按了才填進去。</div>';
  }
  function show(view) { ['quick', 'couple', 'result', 'list', 'cmp'].forEach(function (v) { $(v).hidden = v !== view; }); window.scrollTo(0, 0); }
  function scBarHtml() {
    var a = active(); if (!a) return '';
    var d = isDirty();
    return '<div class="scbar' + (d ? ' dirty' : '') + '"><button type="button" class="scpick" id="openList"><span class="nm">' + esc(a.name) + '</span><span class="ct">' + DB.list.length + '／' + MAX + ' ▾</span></button>' +
      '<button type="button" class="scsave' + (d ? ' primary' : '') + '" id="saveBtn"' + (d ? '' : ' disabled') + '>' + (d ? '存檔' : '已存檔') + '</button>' +
      '<button type="button" class="scshare" id="shareBtn" aria-label="分享 PDF 報告"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>分享</button></div>' +
      (d ? '<div class="muted" style="color:var(--warn);margin-top:4px">有未存檔的修改，這台裝置上的「' + esc(a.name) + '」還是舊的。</div>' : '');
  }
  function sumLine(inp) {
    if (inp && inp.mode === 'couple') {   /* v1.0：夫妻方案 */
      var y = inp.you || {}, p = inp.partner || {}, c = ['夫妻', '資產 ' + fmtW(W(inp.asset)), '入帳 ' + fmtW(W(y.inc) + W(p.inc)) + '／月', '生活費 ' + fmtW(W(inp.spend)) + '／月'];
      if (inp.house) c.push('房貸'); if (inp.kidsOn) c.push('子女 ' + (inp.kids || []).length);
      return c.join('・');
    }
    var t = ['資產 ' + fmtW(W(inp.asset)), '入帳 ' + fmtW(W(inp.inc)) + '／月', '負擔 ' + fmtW(W(inp.spend)) + '／月'];
    if (inp.house) t.push('房貸'); if (inp.car) t.push('車貸'); if (inp.kidsOn) t.push('子女 ' + inp.kids.length); if (inp.parOn) t.push('孝親');
    return t.join('・');
  }
