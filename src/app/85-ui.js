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
    if (a.saved && a.saved.mode === 'couple') { toast('「' + a.name + '」是夫妻方案，單人的資料不會存進去'); return; }   /* v1.0.1：最後一道保險 */
    a.saved = getInputs(); a.updated = nowStr(); if (saveDB()) toast('已存檔：' + a.name);
  }
  function syncForm() {
    document.querySelectorAll('#quick input[data-k]').forEach(function (el) { el.value = S[el.dataset.k] == null ? '' : S[el.dataset.k]; });
    ['house', 'car', 'kidsOn', 'parOn'].forEach(function (k) { var b = document.querySelector('[data-chip="' + k + '"]'); if (b) b.setAttribute('aria-pressed', S[k] ? 'true' : 'false'); $('sec-' + k).hidden = !S[k]; });
    $('housePre').checked = !!S.housePre; $('sec-housePre').hidden = !S.housePre; paintPrepay();
    document.querySelectorAll('[name=parMode]').forEach(function (r) { r.checked = r.value === (S.parMode || 'keep'); });
    if (!S.kids || !S.kids.length) S.kids = [{ bym: '', path: 'grad', costs: {} }];
    paintKids(); paintAge(); paintAccum(); showErr('');
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
