/* src/app/82-backup.js — 方案匯出／匯入（v0.8.1）
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* ================= 方案匯出／匯入（v0.8.1） =================
     一次帶走全部方案，存成 .json。預設加密碼：AES-256-GCM，金鑰由密碼經 PBKDF2-SHA256 計算 60 萬次產生（瀏覽器內建 Web Crypto）。
     匯入一律新增成新方案，絕不覆蓋現有的；檔案內容一律當成外來資料：只取認得的欄位、轉成該有的型別，放進畫面前跳脫。 */
  var BK = { app: 'sp5-retirement', kind: 'scenarios', format: 1, iter: 600000, maxBytes: 2 * 1024 * 1024 };
  function utf8(s) { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s); var b = unescape(encodeURIComponent(s)), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function unutf8(u8) { if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(u8); var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return decodeURIComponent(escape(s)); }
  function b64ToU8(b) { var s = atob(b), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function bkSubtle() { var c = window.crypto; if (!c || !c.subtle) throw new Error('這個瀏覽器不支援加密（需要 https 連線）。'); return c; }
  function bkKey(pw, salt, iter) {
    var c = bkSubtle();
    return c.subtle.importKey('raw', utf8(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return c.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function bkEncrypt(obj, pw) {
    var c = bkSubtle(), salt = c.getRandomValues(new Uint8Array(16)), iv = c.getRandomValues(new Uint8Array(12));
    return bkKey(pw, salt, BK.iter).then(function (key) { return c.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, utf8(JSON.stringify(obj))); }).then(function (ct) {
      return { kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: BK.iter, salt: abToB64(salt) }, cipher: { name: 'AES-GCM', iv: abToB64(iv) }, data: abToB64(ct) };
    });
  }
  function bkDecrypt(env, pw) {
    var it = +(env.kdf && env.kdf.iterations);
    if (!(it >= 100000 && it <= 10000000) || !env.cipher || typeof env.data !== 'string') return Promise.reject(new Error('BAD_FILE'));
    var c = bkSubtle();
    return bkKey(pw, b64ToU8(env.kdf.salt), it).then(function (key) { return c.subtle.decrypt({ name: 'AES-GCM', iv: b64ToU8(env.cipher.iv) }, key, b64ToU8(env.data)); })
      .then(function (pt) { return JSON.parse(unutf8(new Uint8Array(pt))); }, function () { throw new Error('WRONG_PW'); });
  }
  function bkFileName() { return '退休試算方案_' + todayISO() + '.json'; }

  /* ---- 匯出 ---- */
  function openExport() {
    var n = DB.list.length; if (!n) { toast('還沒有方案可以匯出'); return; }
    var a = active();
    var body = '<div>會存成一個檔案，裡面有 <b>' + n + ' 個方案</b>的所有資料（出生年月、收入、資產、孩子……）。到新的裝置用「匯入方案」就能接著用。</div>' +
      (DB.list.some(function (x) { return x.saved && x.saved.mode === 'couple'; }) ? '<div class="pdfinfo" style="margin-top:8px">裡面有夫妻方案：這份檔案<b>也包含另一半的資料</b>（出生年月、收入、勞保勞退）。傳給別人或存到雲端前，建議加密碼。</div>' : '') +   /* v1.0：外部評論 P2 */
      '<div class="muted" style="margin-top:6px">檔名：' + esc(bkFileName()) + '</div>' +
      (a && isDirty() ? '<div class="pdfinfo" style="margin-top:8px">「' + esc(a.name) + '」有未存檔的修改；匯出的是上次存檔的內容。</div>' : '') +
      '<div class="pdfpw"><div class="f">密碼</div><label class="check"><input type="checkbox" id="bkPwOn" checked><span>加密碼保護（建議）</span></label>' +
      '<div id="bkPwBox"><label class="f" for="bkP1">設定密碼</label><input id="bkP1" type="password" autocomplete="new-password"><label class="f" for="bkP2" style="margin-top:6px">再輸入一次</label><input id="bkP2" type="password" autocomplete="new-password">' +
      '<div class="pdfwarn">至少 8 個字。匯入時要輸入同一個密碼；忘記就打不開，我們沒辦法幫你找回。</div></div>' +
      '<div class="pdfwarn2" id="bkNoPw" hidden>不加密碼：任何人拿到這個檔案，都看得到你所有方案的資料。</div></div>' +
      '<div class="err" id="bkErr" hidden></div>';
    modal('匯出所有方案', body, [{ label: '取消', fn: function () {} }, { label: '匯出', cls: 'primary', fn: function () { return startExport(); } }]);
  }
  function bkShowErr(m) { var e = $('bkErr'); if (e) { e.textContent = m; e.hidden = !m; } }
  function bkPayload() {
    return { list: DB.list.map(function (x) { return { name: x.name, saved: JSON.parse(JSON.stringify(x.saved)), updated: x.updated }; }) };
  }
  function startExport() {
    var on = $('bkPwOn') && $('bkPwOn').checked, p1 = on ? $('bkP1').value : '', p2 = on ? $('bkP2').value : '';
    if (on && !p1) { bkShowErr('請設定密碼，或取消勾選「加密碼保護」。'); return false; }
    if (on && p1.length < 8) { bkShowErr('密碼至少 8 個字。'); return false; }
    if (on && p1 !== p2) { bkShowErr('兩次輸入的密碼不一樣。'); return false; }
    var head = { app: BK.app, kind: BK.kind, format: BK.format, version: EN0.VERSION, exported: new Date().toISOString(), encrypted: !!on };
    var name = bkFileName(), n = DB.list.length;
    var done = function (obj) {
      var blob = new Blob([JSON.stringify(obj, null, on ? 0 : 1)], { type: 'application/json' });
      return deliverFile(blob, name, 'application/json').then(function () { track('backup_export', { encrypted: !!on }); closeModal(); toast('已匯出 ' + n + ' 個方案：' + name + (on ? '。密碼請自己記好，我們沒辦法幫你找回。' : '')); });
    };
    modal('正在匯出…', '<div class="muted">' + (on ? '加密中，大約需要一兩秒。' : '') + '資料只在這台裝置上處理，不會上傳。</div>', []);
    var p;
    try { p = on ? bkEncrypt(bkPayload(), p1).then(function (env) { return Object.assign(head, env); }) : Promise.resolve(Object.assign(head, bkPayload())); }
    catch (e) { p = Promise.reject(e); }
    p.then(done).catch(function (err) { bkFail('沒辦法匯出', err && err.message ? err.message : String(err)); });
    return false;
  }

  /* ---- 匯入 ---- */
  function bkFail(title, msg) {
    modal(title, '<div>' + esc(msg) + '</div><div class="muted" style="margin-top:6px">你的方案沒有任何改變。</div>', [{ label: '知道了', cls: 'primary', fn: function () {} }]);
  }
  var BK_MSG = {
    BAD_JSON: ['這不是退休試算的檔案', '請選擇從「匯出所有方案」存下來的檔案（檔名開頭是「退休試算方案」，結尾是 .json）。'],
    BAD_FILE: ['這不是退休試算的檔案', '請選擇從「匯出所有方案」存下來的檔案（檔名開頭是「退休試算方案」，結尾是 .json）。'],
    TOO_BIG: ['檔案太大', '退休試算的備份檔不會超過 2 MB，這個檔案可能不是。'],
    EMPTY: ['檔案裡沒有方案', '這個備份檔裡沒有任何方案。']
  };
  function importFile(file) {
    if (!file) return Promise.resolve();
    if (file.size > BK.maxBytes) { bkFail.apply(null, BK_MSG.TOO_BIG); return Promise.resolve(); }
    return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result)); }; fr.onerror = function () { res(null); }; fr.readAsText(file); })
      .then(function (txt) { return importText(txt, file.name); });
  }
  function importText(txt, fname) {
    var f;
    try { f = JSON.parse(txt); } catch (e) { bkFail.apply(null, BK_MSG.BAD_JSON); return; }
    if (!f || typeof f !== 'object' || f.app !== BK.app || f.kind !== BK.kind) { bkFail.apply(null, BK_MSG.BAD_FILE); return; }
    if (!(+f.format >= 1)) { bkFail.apply(null, BK_MSG.BAD_FILE); return; }
    if (+f.format > BK.format) { bkFail('檔案來自比較新的版本', '這個檔案是用 v' + String(f.version || '').slice(0, 12) + ' 匯出的，目前網頁是 v' + EN0.VERSION + '。請重新整理網頁後再匯入。'); return; }
    var meta = { name: fname || '', exported: typeof f.exported === 'string' ? f.exported.slice(0, 10) : '' };
    if (f.encrypted) { askImportPw(f, meta, ''); return; }
    importPreview(f.list, meta);
  }
  function askImportPw(f, meta, err) {
    modal('需要密碼', '<div>這個檔案匯出時加了密碼。</div><label class="f" for="bkIp" style="margin-top:8px">密碼</label><input id="bkIp" type="password" autocomplete="current-password" placeholder="輸入匯出時設定的密碼">' +
      '<div class="err" id="bkErr"' + (err ? '' : ' hidden') + '>' + esc(err) + '</div>',
      [{ label: '取消', fn: function () {} }, { label: '打開', cls: 'primary', fn: function () {
        var pw = $('bkIp').value; if (!pw) { bkShowErr('請輸入密碼。'); return false; }
        modal('正在解開…', '<div class="muted">大約需要一兩秒。資料只在這台裝置上處理，不會上傳。</div>', []);
        bkDecrypt(f, pw).then(function (obj) { importPreview(obj && obj.list, meta); }, function (e) {
          if (e && e.message === 'WRONG_PW') askImportPw(f, meta, '密碼不對，再試一次。'); else bkFail.apply(null, BK_MSG.BAD_FILE);
        });
        return false;
      } }]);
  }
  /* 外來資料：只取認得的欄位、轉成該有的型別（以空白的預設輸入為範本）；長度設上限 */
  function bkStr(v, max) { return v == null ? '' : String(typeof v === 'object' ? '' : v).slice(0, max || 40); }
  /* v1.0.2：大筆收支清單：最多 20 筆，每筆只收已知欄位；when 只接受 age／ym（夫妻多一個 page＝另一半幾歲） */
  function bkLumps(arr, couple) {
    return (Array.isArray(arr) ? arr : []).slice(0, 20).map(function (x) {
      x = x && typeof x === 'object' ? x : {};
      var w = x.when === 'ym' || (couple && x.when === 'page') ? x.when : 'age';
      return { name: bkStr(x.name, 20), kind: x.kind === 'in' ? 'in' : 'out', amt: bkStr(x.amt, 12), when: w, val: bkStr(x.val, 12) };
    });
  }
  function sanitizeInputs(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    if (raw.mode === 'couple') {   /* v1.0：夫妻方案。我們家的欄位沿用單人的白名單；兩個人各自只收基本資料與 pre 裡已知的欄位 */
      var h = sanitizeInputs(Object.assign({}, raw, { mode: undefined })), person = function (x, par) {
        x = x && typeof x === 'object' ? x : {}; var rp = x.pre && typeof x.pre === 'object' ? x.pre : {}, pp = {};
        ['liYears', 'w60', 'lsBal', 'lsWage', 'lsYears', 'self'].forEach(function (k) { pp[k] = bkStr(rp[k], 12); });
        var o = { name: bkStr(x.name, 8), birth: bkStr(x.birth, 20), workStart: bkStr(x.workStart, 20), inc: bkStr(x.inc, 20), pre: pp };
        if (par) { o.parOn = !!x.parOn; o.par = bkStr(x.par, 20); o.parMode = x.parMode === 'yrs' ? 'yrs' : 'keep'; o.parYrs = bkStr(x.parYrs, 20); }
        return o;
      };
      return { mode: 'couple', asset: h.asset, spend: h.spend, house: h.house, housePay: h.housePay, houseYrs: h.houseYrs, car: false, carPay: '', carYrs: '', kidsOn: h.kidsOn, kids: h.kids,
        parOn: h.parOn, par: h.par, parMode: h.parMode, parYrs: h.parYrs, pre: { inf: h.pre.inf || '', dep: h.pre.dep || '' }, you: person(raw.you), partner: person(raw.partner, true),
        reserve: bkStr(raw.reserve, 12), lumpsOn: !!raw.lumpsOn, lumps: bkLumps(raw.lumps, true),   /* v1.0.2 */
        carsOn: !!raw.carsOn, cars: (Array.isArray(raw.cars) ? raw.cars : []).slice(0, 4).map(function (c) { c = c && typeof c === 'object' ? c : {}; return { pay: bkStr(c.pay, 20), yrs: bkStr(c.yrs, 20) }; }) };
    }
    var T = DEFAULTS, out = {};
    IN_KEYS.forEach(function (k) {
      if (k === 'kids') { out.kids = (Array.isArray(raw.kids) ? raw.kids : []).slice(0, 6).map(function (x) { x = x && typeof x === 'object' ? x : {}; var c = {}, rc = x.costs && typeof x.costs === 'object' ? x.costs : {}; Object.keys(rc).slice(0, 12).forEach(function (g) { if (/^[a-z0-9]{1,8}$/.test(g)) c[g] = bkStr(rc[g], 10); }); return { bym: bkStr(x.bym, 10), path: bkStr(x.path, 10), costs: c }; }); if (!out.kids.length) out.kids = JSON.parse(JSON.stringify(T.kids)); return; }
      if (k === 'lumps') { out.lumps = bkLumps(raw.lumps, false); return; }   /* v1.0.2 */
      if (k === 'pre') {
        var rp = raw.pre && typeof raw.pre === 'object' ? raw.pre : {}, p = {};
        Object.keys(T.pre).forEach(function (pk) {
          if (pk === 'gaps') p.gaps = (Array.isArray(rp.gaps) ? rp.gaps : []).slice(0, 10).map(function (g) { g = g && typeof g === 'object' ? g : {}; return { sit: bkStr(g.sit, 12), y: bkStr(g.y, 3), m: bkStr(g.m, 3) }; });
          else p[pk] = typeof T.pre[pk] === 'boolean' ? !!rp[pk] : bkStr(rp[pk], 12);
        });
        out.pre = p; return;
      }
      out[k] = typeof T[k] === 'boolean' ? !!raw[k] : bkStr(raw[k], 20);
    });
    return migrateInputs(out);
  }
  function importPreview(list, meta) {
    if (!Array.isArray(list)) { bkFail.apply(null, BK_MSG.BAD_FILE); return; }
    var items = list.slice(0, 50).map(function (x) { x = x && typeof x === 'object' ? x : {}; return { name: bkStr(x.name, 20).trim() || '匯入的方案', saved: sanitizeInputs(x.saved), updated: bkStr(x.updated, 20) }; });
    if (!items.length) { bkFail.apply(null, BK_MSG.EMPTY); return; }
    var room = MAX - DB.list.length;
    if (room <= 0) { bkFail('已經有 ' + MAX + ' 個方案', '這台裝置最多存 ' + MAX + ' 個方案。請先在清單裡刪除不要的，再匯入。'); return; }
    importPreview.items = items;
    var names = {}; DB.list.forEach(function (x) { names[x.name] = 1; });
    var rows = items.map(function (x, i) {
      return '<label class="impopt"><input type="checkbox" data-imp="' + i + '"' + (i < room ? ' checked' : '') + '><span><b>' + esc(x.name) + '</b><small>' + esc(sumLine(x.saved)) + (x.updated ? '・存檔：' + esc(x.updated) : '') + '</small>' +
        (names[x.name] ? '<small class="impdup">跟這台裝置上的方案同名，匯入後叫「' + esc(x.name) + '（匯入）」</small>' : '') + '</span></label>';
    }).join('');
    modal('匯入方案', '<div class="muted">檔案：' + esc(meta.name) + (meta.exported ? '・' + esc(meta.exported) + ' 匯出' : '') + '</div>' +
      '<div class="pdfinfo" style="margin-top:8px">匯入的方案會<b>新增</b>在清單裡，不會覆蓋你現有的方案。</div>' +
      '<div class="f" style="margin-top:10px">要匯入哪些？</div>' + rows +
      '<div class="muted" id="impRoom" style="margin-top:8px">這台裝置已有 ' + DB.list.length + ' 個方案，最多 ' + MAX + ' 個，還能匯入 ' + room + ' 個。</div><div class="err" id="bkErr" hidden></div>',
      [{ label: '取消', fn: function () {} }, { label: '匯入', cls: 'primary', fn: function () { return doImport(); } }]);
    impCount();
  }
  function impSel() { return [].slice.call(document.querySelectorAll('[data-imp]')).filter(function (c) { return c.checked; }).map(function (c) { return +c.dataset.imp; }); }
  function impCount() {
    var n = impSel().length, room = MAX - DB.list.length, b = document.querySelector('#mBtns .primary');
    if (b) { b.textContent = n ? '匯入 ' + n + ' 個方案' : '匯入'; b.disabled = !n || n > room; }
    bkShowErr(n > room ? '最多只能再匯入 ' + room + ' 個，請少勾 ' + (n - room) + ' 個。' : '');
  }
  function doImport() {
    var sel = impSel(), items = importPreview.items || [], room = MAX - DB.list.length;
    if (!sel.length || sel.length > room) { impCount(); return false; }
    var added = [], first = null, wasEmpty = !DB.list.length;
    sel.forEach(function (i) {
      var x = items[i], nm = DB.list.some(function (y) { return y.name === x.name; }) ? uniqName(x.name + '（匯入）') : uniqName(x.name);
      var id = newId(); DB.list.push({ id: id, name: nm, saved: x.saved, updated: x.updated || nowStr() }); added.push(nm); if (!first) first = id;
    });
    track('backup_import');
    var msg = '已匯入 ' + added.length + ' 個方案：' + added.join('、');
    if (wasEmpty || !DB.active) { closeModal(); switchTo(first); toast(msg); return true; }   /* 新裝置：直接切到第一個匯入的方案 */
    if (saveDB()) toast(msg);
    paintList();
    return true;
  }
