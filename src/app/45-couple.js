/* src/app/45-couple.js — 夫妻模式（v1.0.0-beta.2）
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 計算全部交給引擎的 SP5Engine.coupleModel（beta.1）；這裡只負責輸入、畫面、存檔。
 * 存檔：跟單人方案放在同一份清單，夫妻方案的 saved 多一個 mode: 'couple'（舊方案沒有這個欄位＝單人）。
 * v1.0.3 拆成三個檔：這個檔＝狀態、輸入頁、事件；46-couple-result.js＝結果頁與每個階段；47-couple-panels.js＝調調看與提高準確度。 */
  var CP = { inp: null, id: null, tab: 'you', view: 'input', mode: 'you', P: null, mon: null, sel: {}, panel: null, ptab: 'you', atab: 'you', err: null, M0: null, M: null };
  var CP_COL = { work: '#2f7a3c', gap: '#9cc68f', retired: '#c4761a', pension: '#3e7b93' };   /* 到了「活到」之後不畫：線結束，另一條繼續走 */
  function cpBlank() {
    return { mode: 'couple', asset: '', spend: '', house: false, housePay: '', houseYrs: '', car: false, carPay: '', carYrs: '', carsOn: false, cars: [{ pay: '', yrs: '' }], reserve: '', lumpsOn: false, lumps: [], kidsOn: false, kids: [{ bym: '', path: 'uni', costs: {} }],
      parOn: false, par: '', parMode: 'keep', parYrs: '', pre: { inf: '', dep: '' },
      you: { name: '你', birth: '', workStart: '', inc: '', pre: {} }, partner: { name: '另一半', birth: '', workStart: '', inc: '', pre: {}, parOn: false, par: '', parMode: 'keep', parYrs: '' } };
  }
  function cpGet(path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, CP.inp); }
  function cpSet(path, v) { var ks = path.split('.'), o = CP.inp; for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
  /* 出生年月底下的即時回饋（跟單人一樣）：打對了顯示今年幾歲，還沒打對顯示格式 */
  function cpAgeHint(k) {
    var v = CP.inp[k].birth; if (!cpFilled(v)) return '';   /* 空著不寫：提示框已經有規則 */
    var en = SP5Engine.create({ birth: v, kids: [], pre: {} }); en.sync(); var a = en.age();
    return a === null || !isFinite(a) ? '西元年月，不用打 -' : '今年 ' + Math.floor(a) + ' 歲';
  }
  function cpName(w) { var n = CP.inp[w === 'you' ? 'you' : 'partner'].name; return String(n || (w === 'you' ? '你' : '另一半')).slice(0, 8); }
  var cpFilled = function (v) { return v != null && String(v).trim() !== ''; };
  /* 頁籤狀態用人話：填好了打勾，沒填完寫還差幾項 */
  function cpNeed(tab) { var I = CP.inp, p = tab === 'you' ? I.you : tab === 'p' ? I.partner : null, need = p ? [p.birth, p.workStart, p.inc] : [I.asset, I.spend]; return { n: need.filter(cpFilled).length, all: need.length }; }
  function cpDone(tab) { var x = cpNeed(tab); return x.n === x.all; }
  function cpStatus(tab) { var x = cpNeed(tab); return x.n === x.all ? '✓ 填好了' : x.n ? '還差 ' + (x.all - x.n) + ' 項' : '還沒填'; }
  function cpMissing() { var m = []; if (!cpDone('you')) m.push(cpName('you')); if (!cpDone('p')) m.push(cpName('partner')); if (!cpDone('home')) m.push('我們家'); return m; }
  function cpDirty() { var a = active(); return !!a && a.id === CP.id && JSON.stringify(a.saved) !== JSON.stringify(CP.inp); }
  function cpStart(saved, id) {
    CP.inp = saved ? JSON.parse(JSON.stringify(saved)) : cpBlank(); CP.id = id || null; CP.tab = 'you'; CP.sel = {}; CP.panel = null; CP.err = null; CP.mode = 'you'; CP.mon = null;
    CP.view = saved ? 'result' : 'input'; if (saved) cpBuild();
    cpPaint(); show('couple');
  }
  /* v1.0.1：單人與夫妻共用一份方案清單、也共用「目前的方案」。切換模式時，目前的方案一定要換成那個模式自己的，
     否則單人按存檔會把單人資料寫進夫妻方案（或反過來）。 */
  var isCoupleSc = function (x) { return !!(x && x.saved && x.saved.mode === 'couple'); };
  function cpEnter() {
    /* 1. 這次已經在用的夫妻方案（含還沒存檔的修改、或還沒算過的草稿）：接著用 */
    var mine = CP.id && DB.list.filter(function (x) { return x.id === CP.id; })[0];
    if (CP.inp && (mine || (!CP.id && CP.view === 'input'))) { if (mine) { DB.active = mine.id; saveDB(); } cpPaint(); show('couple'); return; }
    /* 2. 清單裡最近的夫妻方案：目前的方案是夫妻就用它，否則用清單裡最後一個夫妻方案 */
    var a = active(), c = isCoupleSc(a) ? a : DB.list.slice().reverse().filter(isCoupleSc)[0];
    if (c) { DB.active = c.id; saveDB(); cpStart(c.saved, c.id); return; }
    cpStart(null);
  }
  function singleEnter() {
    /* 回到單人：目前的方案如果是夫妻的，換成最近的單人方案；沒有單人方案就先不指定，按「看我的退休年齡」時另外建立 */
    if (!isCoupleSc(active())) return;
    var s1 = DB.list.slice().reverse().filter(function (x) { return !isCoupleSc(x); })[0];
    if (s1) { DB.active = s1.id; saveDB(); if (!String(S.birth || '').trim()) { setInputs(s1.saved); syncForm(); } }
  }
  function cpBuild() {
    CP.M0 = SP5Engine.coupleModel(CP.inp, {});
    CP.M = Object.keys(CP.sel).length ? SP5Engine.coupleModel(CP.inp, { sel: CP.sel }) : CP.M0;
    CP.Mnr = !CP.M.error && CP.M.PA.floor > 0 ? SP5Engine.coupleModel(CP.inp, { sel: Object.assign({}, CP.sel, { noReserve: true }) }) : null;   /* v1.0.2：算「不留預備金的話」 */
  }

  /* ---------- 輸入：三個頁籤 ---------- */
  function cpIn(path, label, unit, ph, mode) {
    var v = cpGet(path); v = v == null ? '' : v;
    return '<div class="qf"><label class="qlab" for="cq-' + path.replace(/\./g, '-') + '">' + label + '</label><div class="qin"><input id="cq-' + path.replace(/\./g, '-') + '" type="text" inputmode="' + (mode || 'decimal') + '" data-cpk="' + path + '" value="' + esc(String(v)) + '" placeholder="' + esc(ph || '') + '">' + (unit ? '<span class="u">' + unit + '</span>' : '') + '</div></div>';
  }
  function cpTabs(cur, opts, attr, label) {
    return '<div class="cou-tabs" role="group" aria-label="' + label + '">' + opts.map(function (o) {
      return '<button type="button" ' + attr + '="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '" class="cou-tab' + (cur === o[0] ? ' on' : '') + '"><b>' + esc(o[1]) + '</b>' + (o[2] ? '<span class="cou-st' + (/^✓/.test(o[2]) ? ' done' : '') + '" data-cpst="' + o[0] + '">' + o[2] + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function cpPersonHtml(w) {
    var k = w === 'you' ? 'you' : 'partner', nm = cpName(k);
    return '<div class="card"><div class="sechead"><h2>' + esc(nm) + '自己的資料</h2></div>' +
      cpIn(k + '.name', '稱呼', '', w === 'you' ? '你' : '另一半', 'text') + cpIn(k + '.birth', '出生年月', '', '西元年月，不用打 -', 'numeric') + '<div class="qhint" data-cpage="' + k + '">' + cpAgeHint(k) + '</div>' +
      cpIn(k + '.workStart', '幾歲開始工作（有勞保）', '歲', '例如 25', 'numeric') + cpIn(k + '.inc', '每月實際入帳', '萬', '例如 8') +
      '<div class="sub"><div class="t">給' + esc(nm) + '父母的孝親費<span class="opt">（選填）</span></div>' +   /* v1.0.5：區塊標題大、欄位名稱小 */
      cpIn(w === 'you' ? 'par' : 'partner.par', '每月', '萬', '沒有就空白') + cpIn(w === 'you' ? 'parYrs' : 'partner.parYrs', '給幾年', '年', '空白＝一直給') + '</div>' +
      '<div class="muted" style="margin-top:8px">勞保、勞退的年資與薪資，算完之後在「提高準確度」補，沒填就先用估算。</div>' +
      '<button type="button" class="cou-next" data-cptab="' + (w === 'you' ? 'p' : 'home') + '">下一步：' + esc(w === 'you' ? cpName('partner') : '我們家') + ' ›</button></div>';
  }
  function cpStageKeys(kid) {
    var st = kid.bym ? EN0.kidStages(kid.bym, kid.path) : null;
    if (st) return st.map(function (x) { return x.key; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    return ({ grad: ['ele', 'jun', 'sen', 'uni', 'grad'], uni: ['ele', 'jun', 'sen', 'uni'], med: ['ele', 'jun', 'sen', 'med'], five2: ['ele', 'jun', 'five', 'tech2'], five: ['ele', 'jun', 'five'], hs: ['ele', 'jun', 'sen'] })[kid.path] || [];
  }
  function cpKidsHtml() {
    var I = CP.inp; if (!I.kidsOn) return '';
    if (I.kids.length === 1) CP.openKid = 0;
    var pl = {}; SP5Engine.PATHS.forEach(function (o) { pl[o[0]] = o[1]; });
    return I.kids.map(function (kd, i) {
      var keys = cpStageKeys(kd);
      if (CP.openKid !== i) return '<div class="isum"><div><b>孩子 ' + (i + 1) + '</b><div class="muted">' + (String(kd.bym || '').trim() ? ymShow(kd.bym) + '・讀到' + esc(pl[kd.path] || '') : '還沒填出生年月') + '</div></div><button type="button" class="linkbtn" data-cpkidopen="' + i + '">修改</button></div>';   /* v1.0.3 */
      return '<div class="cou-kid"><div class="cou-kidh"><b>孩子 ' + (i + 1) + '</b>' + (I.kids.length > 1 ? '<button type="button" class="linkbtn" data-cpkiddel="' + i + '">刪除</button>' : '') + '</div>' +
        cpIn('kids.' + i + '.bym', '出生年月', '', '西元年月，不用打 -', 'numeric') +
        '<div class="qf"><label class="qlab" for="cq-kids-' + i + '-path">讀到</label><select id="cq-kids-' + i + '-path" data-cpk="kids.' + i + '.path">' +
        SP5Engine.PATHS.map(function (p) { return '<option value="' + p[0] + '"' + (kd.path === p[0] ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('') + '</select></div>' +
        '<div class="muted">每個階段一年的教育費（萬，沒有就填 0）</div>' +
        keys.map(function (key) { return cpIn('kids.' + i + '.costs.' + key, SP5Engine.STAGE_LABEL[key] || key, '萬', '例如 5'); }).join('') + (I.kids.length > 1 ? '<button type="button" class="primary" style="margin-top:10px" data-cpkiddone="1">好了</button>' : '') + '</div>';
    }).join('') + (I.kids.length < 6 ? '<button type="button" class="linkbtn" id="cpKidAdd">＋ 再加一個孩子</button>' : '');
  }
  /* v1.0.2：未來的大筆收支（錢合併算，不用分是誰的；時間可以用年月、你幾歲、另一半幾歲） */
  function cpLumpsHtml() {
    var I = CP.inp; if (!I.lumpsOn) return '';
    if (!Array.isArray(I.lumps) || !I.lumps.length) { I.lumps = [newLump()]; CP.openLump = 0; }
    return '<div class="muted">錢合併算，不用分是誰的，只要決定什麼時候發生。</div>' +
      lumpsHtml(I.lumps, { box: 'cou-kid', idp: 'cqlp', people: 2, names: [cpName('you'), cpName('partner')], add: 'id="cpLumpAdd"', open: CP.openLump, done: 'data-cplkdone="1"', openAt: function (i) { return 'data-cplkopen="' + i + '"'; },
        input: function (i, f) { return 'data-cpk="lumps.' + i + '.' + f + '"'; }, btn: function (i, f, v) { return 'data-cplkset="' + i + '.' + f + '.' + v + '"'; }, del: function (i) { return 'data-cplkdel="' + i + '"'; } });
  }
  /* 車貸：夫妻常常各有一台，可以加好幾台 */
  function cpCarsHtml() {
    var I = CP.inp; if (!I.carsOn) return '';
    if (!Array.isArray(I.cars) || !I.cars.length) I.cars = [{ pay: '', yrs: '' }];
    return I.cars.map(function (c, i) {
      return '<div class="cou-kid"><div class="cou-kidh"><b>車貸 ' + (i + 1) + '</b>' + (I.cars.length > 1 ? '<button type="button" class="linkbtn" data-cpcardel="' + i + '">刪除</button>' : '') + '</div>' +
        cpIn('cars.' + i + '.pay', '每月繳', '萬', '例如 1') + cpIn('cars.' + i + '.yrs', '還剩', '年', '例如 5') + '</div>';
    }).join('') + (I.cars.length < 4 ? '<button type="button" class="linkbtn" id="cpCarAdd">＋ 再加一台車</button>' : '');
  }
  /* v1.0.3：以後會結束的支出＝可以複選的分頁（跟單人一樣）：按鈕上寫摘要，底下只顯示目前這一個（CP.etab） */
  var CP_TABS = ['house', 'carsOn', 'kidsOn', 'lumpsOn'];
  function cpEtab() { var I = CP.inp; if (!CP.etab || !I[CP.etab]) CP.etab = CP_TABS.filter(function (k) { return I[k]; })[0] || null; return CP.etab; }
  var CP_TILES = [['house', '房貸'], ['carsOn', '車貸'], ['kidsOn', '子女'], ['lumpsOn', '大筆收支']];   /* 孝親在「你／另一半」頁籤（各自的父母） */
  function cpTabSub(key, title, inner) { return '<div class="sub"><div class="subh"><span class="t">' + title + '</span><button type="button" class="linkbtn" data-cpchipoff="' + key + '">不算' + title + '</button></div>' + inner + '</div>'; }
  /* v1.0.5：跟單人同一張卡片「哪些支出以後會結束？」、同一個大方塊函式、細節放同樣的小區塊 */
  function cpExpHtml() {
    var t = cpEtab();
    return '<div class="card"><div class="sechead"><h2>哪些支出以後會結束？</h2></div><div class="qhint" style="margin-top:6px">這很重要。房貸繳完、小孩畢業之後，你們需要的退休金可能差很多。有的點一下，可以選好幾個；底下一次只看一個。</div>' +
      '<div class="tiles">' + expTilesHtml(CP_TILES, CP.inp, t, function (k) { return 'data-cpchip="' + k + '"'; }) + '</div>' +
      (t === 'house' ? cpTabSub('house', '房貸', cpIn('housePay', '每月繳', '萬', '例如 2') + cpIn('houseYrs', '還剩', '年', '例如 20')) : '') +
      (t === 'carsOn' ? cpTabSub('carsOn', '車貸', cpCarsHtml()) : '') + (t === 'kidsOn' ? cpTabSub('kidsOn', '子女', cpKidsHtml()) : '') + (t === 'lumpsOn' ? cpTabSub('lumpsOn', '大筆收支', cpLumpsHtml()) : '') + '</div>';
  }
  function cpHomeHtml() {
    var I = CP.inp;
    return '<div class="card"><div class="sechead"><h2>我們家共有的</h2></div><div class="muted">全部填全家的總數。</div>' +
      cpIn('asset', '名下可自由動用的錢（兩人合計）', '萬', '例如 300') + cpIn('spend', '每月基本生活費（全家）', '萬', '例如 7') +
      cpIn('reserve', '退休後想隨時留多少預備金<span class="opt">（選填）</span>', '萬', '沒有就空白') + '<div class="qhint">退休後，存款任何時候都不低於這個數字。萬一生病、出國玩，隨時有錢可以拿。</div><div id="cpResv">' + reserveChips(I.spend, I.reserve, function (v) { return 'data-cpresv="' + v + '"'; }) + '</div>' +
'</div>' + cpExpHtml();
  }
  function cpGoHtml() {
    var miss = cpMissing();
    /* 跟單人的「看我的退休年齡」同一個樣式（primary big） */
    return '<button type="button" class="primary big" id="cpGo"' + (miss.length ? ' disabled' : '') + '>看我們的退休年齡</button>' +
      '<div class="muted" style="text-align:center;margin-top:6px" id="cpMiss">' + (miss.length ? '還差：' + esc(miss.join('、')) : '') + '</div>';
  }
  function cpInputHtml() {
    return '<div class="cou-mode" role="group" aria-label="要怎麼算"><button type="button" data-mode="single" aria-pressed="false">我自己</button><button type="button" data-mode="couple" aria-pressed="true">我和另一半</button></div>' +
      '<h1>我們最早幾歲可以退休？</h1>' +
      '<div class="lead">依序填' + esc(cpName('you')) + '、' + esc(cpName('partner')) + '、我們家，三個部分都填完就能算。錢合併算：一個人先退休，就是靠另一個人的薪水和共同的存款撐。</div>' +
      '<div class="scope"><div>適用一般勞保、勞退的上班族。資料（包含另一半的）只存在這台裝置，不會上傳。</div>' +
      '<details><summary>試算範圍與隱私說明</summary><div>只算勞保、勞退；公務員、教師、軍人、農民的退休制度不同，結果不適用。<br>兩個人的錢合併算，一直算到兩人都到了各自的「活到幾歲」（預設 ' + PR0.assumptions.default_end_age + ' 歲，結果出來後可以在「調調看」改）。<br>你填的資料（包含另一半的）只存在這台裝置的瀏覽器裡，不會上傳。網站用 Google Analytics 統計使用情況（例如有多少人算出結果），不包含你填的任何數字。<br>用公用電腦的話，用完到「方案清單」最下面按「清除這台裝置上的所有資料」，把填過的資料刪掉。</div><div class="scope-keep">資料存在這個瀏覽器裡：換瀏覽器或換裝置、在 Threads、LINE 裡直接打開、用無痕模式，或 Safari 很久沒打開這個網站（Apple 的隱私規則），都可能看不到之前的方案。重要的方案可以到「方案清單」用「匯出」備份。資料<b>沒有加密</b>：同一台裝置、同一個瀏覽器的人，打開這個網站看得到你存的方案。</div></details></div>' +
      cpTabs(CP.tab, [['you', cpName('you'), cpStatus('you')], ['p', cpName('partner'), cpStatus('p')], ['home', '我們家', cpStatus('home')]], 'data-cptab', '填哪一部分') +
      (CP.err ? '<div class="err" role="alert">' + esc(CP.err) + '</div>' : '') +
      (CP.tab === 'you' ? cpPersonHtml('you') : CP.tab === 'p' ? cpPersonHtml('p') : cpHomeHtml() + cpGoHtml());   /* 送出按鈕只在最後一步出現 */
  }

  /* ---------- 結果 ---------- */
  function cpPaint() { $('couple').innerHTML = CP.view === 'input' ? cpInputHtml() : cpResultHtml(); }
  function cpRefreshInputBits() {
    ['you', 'p', 'home'].forEach(function (k) { var el = document.querySelector('[data-cpst="' + k + '"]'); if (el) { el.textContent = cpStatus(k); el.className = 'cou-st' + (/^✓/.test(el.textContent) ? ' done' : ''); } });
    ['you', 'partner'].forEach(function (k) { var el = document.querySelector('[data-cpage="' + k + '"]'); if (el) el.textContent = cpAgeHint(k); });
    document.querySelectorAll('[data-cpchip]').forEach(function (bt) { var sm = bt.querySelector('.tsum'); if (sm) sm.textContent = tabSummary(bt.dataset.cpchip, CP.inp); });   /* v1.0.3：打字時更新按鈕上的摘要 */
    var go = $('cpGo'), miss = cpMissing(); if (go) go.disabled = miss.length > 0; var mm = $('cpMiss'); if (mm) mm.textContent = miss.length ? '還差：' + miss.join('、') : '';
  }
  function cpGo() {
    if (cpMissing().length) return;
    var I = CP.inp; I.parOn = cpFilled(I.par) && +I.par > 0; I.parMode = cpFilled(I.parYrs) ? 'yrs' : 'keep';
    I.partner.parOn = cpFilled(I.partner.par) && +I.partner.par > 0; I.partner.parMode = cpFilled(I.partner.parYrs) ? 'yrs' : 'keep';
    var M = SP5Engine.coupleModel(I, {});
    if (M.error) { CP.err = M.error; CP.tab = M.who === 'partner' ? 'p' : M.who === 'home' ? 'home' : 'you'; cpPaint(); return; }
    CP.err = null; CP.sel = {}; CP.panel = null; CP.mon = null;
    var a = active();
    guard(function () {
      if (a && a.id === CP.id && a.saved && a.saved.mode === 'couple') { a.saved = JSON.parse(JSON.stringify(I)); a.updated = nowStr(); }
      else {
        if (DB.list.length >= MAX) { toast('最多 ' + MAX + ' 個方案，這次沒有存檔'); }
        else { var nid = newId(); DB.list.push({ id: nid, name: uniqName('我們的方案'), saved: JSON.parse(JSON.stringify(I)), updated: nowStr() }); DB.active = nid; CP.id = nid; }
      }
      saveDB();
    });
    track('couple_calculation_complete');
    cpBuild(); CP.view = 'result'; cpPaint(); window.scrollTo(0, 0);
  }
  function cpRebuildPaint() { cpBuild(); cpPaint(); }
  /* 事件：只處理夫妻區塊裡的元素 */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#couple button, #quick [data-mode]') : null; if (!b || b.disabled) return;
    /* 切換「我自己／我和另一半」：兩個畫面用同一組按鈕；夫妻填到一半的資料保留，切回來接著填 */
    var I = CP.inp, ds = b.dataset;
    if (ds.mode) {
      if (ds.mode === 'single') { if (b.closest('#couple')) { singleEnter(); show('quick'); } return; }
      if (b.closest('#quick')) { track('couple_mode_open'); cpEnter(); }
      return;
    }
    if (ds.cptab) { CP.tab = ds.cptab; cpPaint(); return; }
    if (ds.cpchip) { if (!cpGet(ds.cpchip)) cpSet(ds.cpchip, true); CP.etab = ds.cpchip; cpPaint(); return; }   /* v1.0.3：沒選→選上並切過去；已選→只切換 */
    if (ds.cpchipoff) { cpSet(ds.cpchipoff, false); CP.etab = null; cpPaint(); return; }
    if (ds.cpkidopen != null) { CP.openKid = +ds.cpkidopen; cpPaint(); return; }
    if (ds.cpkiddone) { CP.openKid = null; cpPaint(); return; }
    if (ds.cplkopen != null) { CP.openLump = +ds.cplkopen; cpPaint(); return; }
    if (ds.cplkdone) { CP.openLump = null; cpPaint(); return; }
    if (b.id === 'cpLumpAdd') { I.lumps.push(newLump()); CP.openLump = I.lumps.length - 1; cpPaint(); return; }
    if (ds.cplkset) { var lq = ds.cplkset.split('.'); I.lumps[+lq[0]][lq[1]] = lq[2]; cpPaint(); return; }
    if (ds.cplkdel != null) { I.lumps.splice(+ds.cplkdel, 1); CP.openLump = null; if (!I.lumps.length) I.lumpsOn = false; cpPaint(); return; }
    if (ds.cpresv != null) { I.reserve = ds.cpresv; cpPaint(); return; }
    if (b.id === 'cpCarAdd') { I.cars.push({ pay: '', yrs: '' }); cpPaint(); return; }
    if (ds.cpcardel) { I.cars.splice(+ds.cpcardel, 1); cpPaint(); return; }
    if (b.id === 'cpKidAdd') { I.kids.push({ bym: '', path: 'uni', costs: {} }); CP.openKid = I.kids.length - 1; cpPaint(); return; }
    if (ds.cpkiddel) { I.kids.splice(+ds.cpkiddel, 1); CP.openKid = null; cpPaint(); return; }
    if (b.id === 'cpGo') { cpGo(); return; }
    if (b.id === 'cpEdit' || b.id === 'cpEdit2') { CP.view = 'input'; cpPaint(); return; }
    if (b.id === 'cpList') { paintList(); show('list'); return; }
    if (b.id === 'cpSave') { doSave(); cpPaint(); return; }
    if (ds.cpmode) { if (CP.mode !== ds.cpmode) { CP.mode = ds.cpmode; CP.mon = null; } cpPaint(); return; }
    if (b.id === 'cpTgAdj' || b.id === 'cpTgPrec') { var want = b.id === 'cpTgAdj' ? 'adj' : 'prec'; CP.panel = CP.panel === want ? null : want; if (CP.panel) track(want === 'adj' ? 'couple_adjust_open' : 'couple_precision_open'); cpPaint(); return; }
    if (ds.cpstep) {
      var k = ds.cpstep, st = CP_STEPS[k], d = +ds.d, cur = cpSelVal(k), nv;
      if (k === 'endA' || k === 'endB') nv = Math.min(PR0.product.end_age_max, Math.max(PR0.product.end_age_min, cur + d));
      else nv = Math.round(Math.min(st[2], Math.max(st[1], cur + d * st[0])) * 100) / 100;
      var neutral = k === 'li' ? 100 : (k === 'endA' || k === 'endB') ? PR0.assumptions.default_end_age : 0;
      if (nv === neutral) delete CP.sel[k]; else CP.sel[k] = nv;
      cpRebuildPaint(); return;
    }
    if (b.id === 'cpAdjReset') { CP.sel = {}; cpRebuildPaint(); return; }
    if (ds.cpptab) { CP.ptab = ds.cpptab; cpPaint(); return; }
    if (ds.cpphase != null || b.id === 'cpLedgerBtn' || ds.cpyear || ds.cpypage != null) {
      if (ds.cpphase != null) { var ip = +ds.cpphase; CP.phase = CP.phase === ip ? null : ip; CP.year = null; CP.ypage = null; }
      if (b.id === 'cpLedgerBtn') CP.ledger = !CP.ledger;
      if (ds.cpyear) { CP.year = +ds.cpyear; }
      if (ds.cpypage != null) { CP.ypage = +ds.cpypage; CP.year = null; }
      $('cpStages').innerHTML = cpStagesHtml(cpDescAt(CP.M, CP.mode, CP.mon)); return;
    }
    if (ds.cpatab) { CP.atab = ds.cpatab; cpPaint(); return; }
    if (ds.cpdep) { var DI = PR0.deposit_input, def = Math.round(EN0.rates().depDefault * 1000) / 10, c0 = cpFilled(I.pre.dep) ? +I.pre.dep : def, n = Math.round((c0 + (+ds.cpdep) * DI.step) * 100) / 100;
      n = Math.min(DI.max, Math.max(DI.min, n)); I.pre.dep = Math.abs(n - def) < 1e-9 ? '' : String(n); cpRebuildPaint(); return; }
    if (ds.cpinf) { I.pre.inf = +ds.cpinf === LAW.infDef ? '' : String(ds.cpinf); cpRebuildPaint(); return; }
    if (b.id === 'cpApply') { var M2 = SP5Engine.coupleModel(I, {}); if (M2.error) { toast(M2.error); return; } cpRebuildPaint(); toast('已套用'); return; }
  });
  document.addEventListener('input', function (e) {
    var el = e.target; if (!el || !el.closest || !el.closest('#couple')) return;
    if (el.id === 'cpRange') { CP.mon = +el.value; el.setAttribute('aria-valuetext', cpPosText(CP.mode, CP.mon)); $('cpOut').innerHTML = cpSlideOut(); $('cpStages').innerHTML = cpStagesHtml(cpDescAt(CP.M, CP.mode, CP.mon)); return; }
    if (el.dataset.cpk) { cpSet(el.dataset.cpk, el.value); if (CP.view === 'input') cpRefreshInputBits(); if ((el.dataset.cpk === 'spend' || el.dataset.cpk === 'reserve') && $('cpResv')) $('cpResv').innerHTML = reserveChips(CP.inp.spend, CP.inp.reserve, function (v) { return 'data-cpresv="' + v + '"'; }); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target; if (!el || !el.closest || !el.closest('#couple')) return;
    if (el.tagName === 'SELECT' && el.dataset.cpk) { cpSet(el.dataset.cpk, el.value); cpPaint(); }
  });
