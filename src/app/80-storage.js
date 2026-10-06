/* src/app/80-storage.js — 存檔
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* ================= 方案（照 SP2 §1.8；存在這台裝置） ================= */
  var KEY = 'sp5:data', MAX = 10, CMP_MAX = 3;
  var IN_KEYS = ['birth', 'workStart', 'asset', 'inc', 'spend', 'house', 'car', 'kidsOn', 'parOn', 'housePay', 'houseYrs', 'housePre', 'housePreAge', 'houseRate', 'carPay', 'carYrs', 'par', 'parMode', 'parYrs', 'kids', 'pre', 'reserve', 'lumpsOn', 'lumps'];   /* v1.0.2：養老預備金、未來的大筆收支 */
  var DB = { v: 1, active: null, list: [], cmp: null, showAll: false };
  /* 舊格式的輸入轉成新格式：子女費用三組 → 每個階段；勞退舊制從最上層搬到 pre */
  function migrateInputs(o) {
    if (!o) return o;
    if (o.reserve == null) o.reserve = ''; o.lumpsOn = !!o.lumpsOn; if (!Array.isArray(o.lumps)) o.lumps = [];   /* v1.0.2：舊方案沒有這三個欄位；照 IN_KEYS 的順序補，比對「有沒有改過」時才會一致 */
    if (o.mode === 'couple') {   /* v1.0：夫妻方案 */
      if (o.kids) o.kids.forEach(function (k) { SP5Engine.migrateKid(k); });
      o.pre = o.pre || {}; ['you', 'partner'].forEach(function (w) { o[w] = o[w] || {}; o[w].pre = o[w].pre || {}; });
      return o;
    }
    if (o.kids) o.kids.forEach(function (k) { SP5Engine.migrateKid(k); delete k.copied; });
    o.pre = o.pre || {};
    if (o.pre.oldOn === undefined) {
      o.pre.oldOn = !!o.oldOn; o.pre.oHire = o.oHire || ''; o.pre.oYrs = o.oYrs || ''; o.pre.oWage = o.oWage || '';
    }
    delete o.oldOn; delete o.oHire; delete o.oYrs; delete o.oWage;
    if (!Array.isArray(o.pre.gaps)) o.pre.gaps = [];
    return o;
  }
  /* 讀存檔。讀不出來（損壞、格式不符）時，先把原始資料另存到 sp5:data:backup-時間，再提示使用者：
     以前是靜默吞掉，畫面變空、使用者一存檔就把損壞的資料覆蓋掉，永久遺失 */
  function loadDB() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return; }
    if (raw == null || raw === '') return;
    try {
      var d = JSON.parse(raw);
      if (!(d && d.v === 1 && Array.isArray(d.list))) throw new Error('格式不符');
      d.list.forEach(function (x) { migrateInputs(x.saved); });
      DB = d;
    } catch (e) {
      var bk = KEY + ':backup-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
      try { localStorage.setItem(bk, raw); S.loadErr = { key: bk, ok: true }; } catch (e2) { S.loadErr = { key: bk, ok: false }; }
    }
  }
  function showLoadErr() {
    var L = S.loadErr; if (!L) return;
    modal('存檔讀不出來', '<div>這台裝置上的方案資料讀不出來，可能已經損壞。</div>' +
      (L.ok ? '<div style="margin-top:8px">原始資料<b>已經另外保存一份</b>（<code>' + esc(L.key) + '</code>），之後的存檔不會覆蓋它。需要救回時，可以把這份資料提供給維護者。</div>'
            : '<div class="err" style="margin-top:8px">原始資料沒辦法另外保存（瀏覽器的儲存空間可能已滿）。在處理好之前，建議先不要按「存檔」。</div>') +
      '<div class="muted" style="margin-top:8px">你可以先重新填寫，算出新的結果。</div>', [{ label: '知道了', cls: 'primary', fn: function () {} }]);
  }
  function saveDB() { try { localStorage.setItem(KEY, JSON.stringify(DB)); return true; } catch (e) { toast('這台裝置沒辦法存檔（可能是無痕模式）'); return false; } }
  function getInputs() { var o = {}; IN_KEYS.forEach(function (k) { o[k] = S[k]; }); return JSON.parse(JSON.stringify(o)); }
  function setInputs(o) { o = migrateInputs(JSON.parse(JSON.stringify(o))); IN_KEYS.forEach(function (k) { if (o[k] !== undefined) S[k] = o[k]; }); S.preDraft = null; S.delta = null; syncForm(); }
  function active() { return DB.list.filter(function (x) { return x.id === DB.active; })[0] || null; }
  function isDirty() { var a = active(); return !!a && JSON.stringify(getInputs()) !== JSON.stringify(a.saved); }
  function nowStr() { var d = new Date(), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  /* 把目前的調整寫進一個新方案：每月花費、每月多存（視為入帳增加）、活到、還沒套用的實際資料；萬一……是假設的意外，不存 */
  function saveAsNew() {
    if (DB.list.length >= MAX) { modal('最多 ' + MAX + ' 個方案', '<div class="muted">請先刪除一個不要的方案。</div>', [{ label: '去刪除方案', cls: 'primary', fn: function () { paintList(); } }, { label: '取消', fn: function () {} }]); return; }
    var a = adjState(), inp = JSON.parse(JSON.stringify(getInputs())), lab = adjLabels().filter(function (x) { return x.indexOf('萬一') !== 0; });
    inp.pre = JSON.parse(JSON.stringify(draftCheck().eff));   /* 填錯的項目不存 */
    var r1 = function (x) { return String(Math.round(x * 100) / 100); };
    if (a.more) inp.spend = r1((W(S.spend) + a.more) / 10000);
    if (a.save) inp.inc = r1((W(S.inc) + a.save) / 10000);
    if (a.end !== null) inp.pre.endAge = String(a.end);
    var skipped = wiOn(a).length + (a.ret !== null ? 1 : 0), cur = active(), base = cur ? cur.name : '方案';
    lab = lab.filter(function (x) { return x.indexOf('想在') !== 0; });
    var tag = lab.length ? lab[0].replace('每月', '') + (lab.length > 1 ? '等' : '') : draftCheck().ok.length ? '實際資料' : '調整';
    var nid = newId(), name = uniqName(base.slice(0, 10) + '（' + tag + '）');
    guard(function () {
      DB.list.push({ id: nid, name: name, saved: inp, updated: nowStr() });
      DB.active = nid; saveDB(); adjReset(); S.preDraft = null; switchTo(nid);
      toast('已存成新方案「' + name + '」' + (skipped ? '；想在幾歲退休、萬一……沒有存進去' : ''));
    });
  }
