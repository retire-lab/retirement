/* src/app/90-scenarios.js — 方案清單、方案比對
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  function paintList() {
    var n = DB.list.length;
    var src = n > 1 ? '<label class="f" for="cpSrc" style="margin-top:10px">從哪一個複製</label><select id="cpSrc">' + DB.list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === DB.active ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' : '';
    $('list').innerHTML = '<div class="top"><button type="button" class="linkbtn" id="listBack">‹ 回到結果</button><span class="muted">存在這台裝置</span></div>' +
      '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2>我的方案（' + n + '／' + MAX + '）</h2>' + (n >= 2 ? '<button type="button" id="openCmp">參數總表</button>' : '') + '</div>' +
      DB.list.map(function (x) {
        var cur = x.id === DB.active;
        return '<div class="scrow"><div class="h"><b>' + esc(x.name) + '</b>' + (cur ? '<span class="cur">目前</span>' : '') + (cur && isDirty() ? '<span class="muted" style="color:var(--warn)">有未存檔的修改</span>' : '') + '</div>' +
          '<div class="sum">' + sumLine(x.saved) + '</div><div class="sum">存檔：' + esc(x.updated) + '</div>' +
          '<div class="acts2">' + (cur ? '' : '<button type="button" class="primary" data-sw="' + esc(x.id) + '">切換到這個</button>') +
          '<button type="button" data-rn="' + esc(x.id) + '">改名</button>' +
          (cur ? '' : '<button type="button" data-vs="' + esc(x.id) + '">跟目前比</button>') +
          '<button type="button" class="danger" data-del="' + esc(x.id) + '"' + (n <= 1 ? ' disabled title="只剩一個方案不能刪"' : '') + '>刪除</button></div></div>';
      }).join('') + '</div>' +
      '<div class="card"><h2>新增方案</h2><div class="muted" style="margin-top:4px">新方案一律從現有方案複製，複製的是存檔過的版本。' + (n === 1 ? '會從「' + esc(DB.list[0].name) + '」複製。' : '') + '</div>' + src +
      '<button type="button" class="primary" id="newSc" style="width:100%;height:46px;margin-top:10px">＋ 複製成新方案</button></div>' +
      '<div class="card"><h2>備份</h2><div class="muted" style="margin-top:4px">方案只存在這台裝置的瀏覽器，系統擁有者看不到；換手機、清除瀏覽器資料就會不見。存成檔案，到新的裝置匯入就能接著用。</div>' +
      '<div class="bkacts"><button type="button" class="primary" id="expAll">匯出所有方案</button><button type="button" id="impBtn">匯入方案</button></div>' +
      '<input type="file" id="impFile" accept=".json,application/json" hidden>' +
      '<button type="button" class="danger" id="wipe" style="width:100%;height:44px;margin-top:14px">清除這台裝置上的所有資料</button></div>';
  }
  /* 參數總表 */
  var PL = {}; SP5Engine.PATHS.forEach(function (p) { PL[p[0]] = p[1]; });
  /* 出生年月一律寫成 YYYY/MM（使用者可能輸入 201206、2012-6 等） */
  function fmtBym(bym) { var p = EN0 ? EN0.parseYM(bym, 1900, 2100) : null; return p ? p.y + '/' + ('0' + p.mo).slice(-2) : String(bym || ''); }
  /* 每年費用：只列這個孩子的學制會讀到的階段（複製第一個孩子時，可能帶到用不到的階段） */
  function kidCostText(k) {
    var c = SP5Engine.migrateKid(JSON.parse(JSON.stringify(k))).costs, st = EN0 ? EN0.kidStages(k.bym, k.path) : null, ok = {};
    if (st) st.forEach(function (x) { ok[x.key] = 1; }); else Object.keys(c).forEach(function (g) { ok[g] = 1; });
    return Object.keys(SP5Engine.STAGE_LABEL).filter(function (g) { return ok[g] && c[g] !== undefined && c[g] !== ''; }).map(function (g) { return SP5Engine.STAGE_LABEL[g].replace(/（.*）/, '') + ' ' + c[g] + ' 萬'; }).join('、') || '—';
  }
  var CMP_ROWS = [
    ['幾歲開始工作', function (i) { return i.workStart + ' 歲'; }],
    ['名下資產', function (i) { return fmtW(W(i.asset)); }],
    ['每月實際入帳', function (i) { return fmtW(W(i.inc)); }],
    ['每月基本生活費', function (i) { return fmtW(W(i.spend)); }],
    ['房貸', function (i) { return i.house ? fmtW(W(i.housePay)) + '／月・' + i.houseYrs + ' 年' + (i.housePre ? '・' + i.housePreAge + ' 歲還清' : '') : '無'; }],
    ['車貸', function (i) { return i.car ? fmtW(W(i.carPay)) + '／月・' + i.carYrs + ' 年' : '無'; }],
    ['子女', function (i) { return i.kidsOn ? i.kids.map(function (k, n) { return (i.kids.length > 1 ? '孩子 ' + (n + 1) + '：' : '') + fmtBym(k.bym) + ' 生・' + (PL[k.path] || ''); }).join('；') : '無'; }],
    ['子女每年費用', function (i) { return i.kidsOn ? i.kids.map(function (k, n) { return (i.kids.length > 1 ? '孩子 ' + (n + 1) + '：' : '') + kidCostText(k); }).join('；') : '無'; }],
    ['孝親費', function (i) { return i.parOn ? fmtW(W(i.par)) + '／月・' + (i.parMode === 'yrs' ? '再 ' + i.parYrs + ' 年' : '一直算') : '無'; }],
    ['勞退舊制', function (i) { var o = migrateInputs(JSON.parse(JSON.stringify(i))).pre; return o.oldOn ? o.oHire + ' 到職・' + o.oYrs + ' 年・平均工資 ' + o.oWage + ' 萬' : '無'; }],
    ['勞保年資', function (i) { return i.pre.liYears !== '' ? i.pre.liYears + ' 年' : '估算'; }],
    ['平均月投保薪資', function (i) { return i.pre.w60 !== '' ? i.pre.w60 + ' 萬' : '估算'; }],
    ['勞退專戶餘額', function (i) { return i.pre.lsBal !== '' ? i.pre.lsBal + ' 萬' : '估算'; }],
    ['勞退提繳工資', function (i) { return i.pre.lsWage !== '' ? i.pre.lsWage + ' 萬' : '估算'; }],
    ['勞退自提', function (i) { return (i.pre.self || 0) + '%'; }],
    ['勞退提繳年資', function (i) { return i.pre.lsYears ? i.pre.lsYears + ' 年' : '估算'; }],
    ['勞保請領年齡', function (i) { return i.pre.liClaim ? i.pre.liClaim + ' 歲' : '法定年齡'; }],
    ['工作空窗', function (i) { return gapStatus(i.pre && i.pre.gaps); }],
    ['健保', function (i) { return i.pre.nhiDep ? '依附眷屬' : '第六類自付'; }],
    ['通膨', function (i) { return (i.pre.inf || 2) + '%'; }],
    ['存款利率', function (i) { return i.pre.dep ? i.pre.dep + '%' : '一年定存（預設）'; }],
    ['算到幾歲', function (i) { return (i.pre.endAge || EN.E_DEF) + ' 歲'; }]
  ];
  function cmpSel() {
    var ids = DB.list.map(function (x) { return x.id; });
    var sel = (DB.cmp || []).filter(function (id) { return ids.indexOf(id) >= 0; });
    if (!sel.length) {
      sel = [DB.active].concat(DB.list.filter(function (x) { return x.id !== DB.active; }).sort(function (a, b) { return a.updated < b.updated ? 1 : -1; }).slice(0, CMP_MAX - 1).map(function (x) { return x.id; }));
      DB.cmp = sel;
    }
    return sel;
  }
  function paintCmp(msg) {
    var sel = cmpSel(), cols = DB.list.filter(function (x) { return sel.indexOf(x.id) >= 0; });
    cols.sort(function (a, b) { return (a.id === DB.active ? -1 : 0) - (b.id === DB.active ? -1 : 0); });
    var base = cols[0], rows = '', nd = 0;
    var births = cols.map(function (c) { return c.saved.birth; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var g = 'grid-template-columns: 84px repeat(' + cols.length + ', minmax(0, 1fr))';
    var head = '<div class="c lbl hd"></div>' + cols.map(function (c) {
      var cur = c.id === DB.active;
      return '<div class="c hd' + (c === base ? ' base' : '') + '">' + esc(c.name) + (cur ? '<div class="muted" style="font-weight:400">目前' + (isDirty() ? '・表上是存檔版' : '') + '</div>' : '<button type="button" data-sw="' + esc(c.id) + '">切換到這個</button>') + '</div>';
    }).join('');
    CMP_ROWS.forEach(function (r) {
      var vals = cols.map(function (c) { return r[1](c.saved); }), diff = vals.some(function (v) { return v !== vals[0]; });
      if (diff) nd++;
      if (!diff && !DB.showAll) return;
      rows += '<div class="c lbl">' + r[0] + '</div>' + vals.map(function (v, i) { return '<div class="c' + (i === 0 ? ' base' : v !== vals[0] ? ' diff' : '') + '">' + esc(v) + '</div>'; }).join('');
    });
    var table = cols.length < 2 ? '<div class="muted" style="margin-top:10px">至少選兩個方案。</div>' :
      (!nd && !DB.showAll ? '<div class="pm" style="margin-top:10px">選的方案參數完全一樣。</div>' : '<div class="ctab" style="' + g + '">' + head + rows + '</div>');
    $('cmp').innerHTML = '<div class="top"><button type="button" class="linkbtn" id="cmpBack">‹ 回到方案清單</button><span class="muted">只比輸入，不比結果</span></div>' +
      '<div class="card"><h2>參數總表</h2><div class="muted" style="margin-top:4px">任選最多 ' + CMP_MAX + ' 個。以最左邊那欄為基準，跟它不一樣的格子會標色。</div>' +
      '<div class="chips">' + DB.list.map(function (x) { return '<button type="button" class="chip" data-cs="' + esc(x.id) + '" aria-pressed="' + (sel.indexOf(x.id) >= 0) + '">' + esc(x.name) + '</button>'; }).join('') + '</div>' +
      (msg ? '<div class="wf">' + msg + '</div>' : '') +
      (births.length > 1 ? '<div class="err" style="margin-top:10px">這幾個方案的出生年月不一樣（' + births.map(esc).join('、') + '），通常是改錯了。</div>' : '') +
      '<div class="seg" role="tablist" aria-label="顯示範圍"><button type="button" role="tab" data-sa="0" aria-selected="' + !DB.showAll + '">只看有差異（' + nd + '）</button><button type="button" role="tab" data-sa="1" aria-selected="' + !!DB.showAll + '">顯示全部（' + CMP_ROWS.length + '）</button></div>' +
      table + '</div>';
  }
  function switchTo(id) { DB.active = id; saveDB(); setInputs(active().saved); S.ledger = false; S.phase = null; adjReset(); if (validate()) { show('quick'); showErr(validate()); } else { paintResult(); show('result'); } }

