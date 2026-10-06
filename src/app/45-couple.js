/* src/app/45-couple.js — 夫妻模式（v1.0.0-beta.2）
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 計算全部交給引擎的 SP5Engine.coupleModel（beta.1）；這裡只負責輸入、畫面、存檔。
 * 存檔：跟單人方案放在同一份清單，夫妻方案的 saved 多一個 mode: 'couple'（舊方案沒有這個欄位＝單人）。 */
  var CP = { inp: null, id: null, tab: 'you', view: 'input', mode: 'you', P: null, mon: null, sel: {}, panel: null, ptab: 'you', atab: 'you', err: null, M0: null, M: null };
  var CP_COL = { work: '#2f7a3c', gap: '#9cc68f', retired: '#c4761a', pension: '#3e7b93' };   /* 到了「活到」之後不畫：線結束，另一條繼續走 */
  function cpBlank() {
    return { mode: 'couple', asset: '', spend: '', house: false, housePay: '', houseYrs: '', car: false, carPay: '', carYrs: '', carsOn: false, cars: [{ pay: '', yrs: '' }], kidsOn: false, kids: [{ bym: '', path: 'uni', costs: {} }],
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
      '<div class="muted" style="margin-top:12px"><b>給' + esc(nm) + '父母的孝親費</b>（選填）</div>' +
      cpIn(w === 'you' ? 'par' : 'partner.par', '每月', '萬', '沒有就空白') + cpIn(w === 'you' ? 'parYrs' : 'partner.parYrs', '給幾年', '年', '空白＝一直給') +
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
    return I.kids.map(function (kd, i) {
      var keys = cpStageKeys(kd);
      return '<div class="cou-kid"><div class="cou-kidh"><b>孩子 ' + (i + 1) + '</b>' + (I.kids.length > 1 ? '<button type="button" class="linkbtn" data-cpkiddel="' + i + '">刪除</button>' : '') + '</div>' +
        cpIn('kids.' + i + '.bym', '出生年月', '', '西元年月，不用打 -', 'numeric') +
        '<div class="qf"><label class="qlab" for="cq-kids-' + i + '-path">讀到</label><select id="cq-kids-' + i + '-path" data-cpk="kids.' + i + '.path">' +
        SP5Engine.PATHS.map(function (p) { return '<option value="' + p[0] + '"' + (kd.path === p[0] ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('') + '</select></div>' +
        '<div class="muted">每個階段一年的教育費（萬，沒有就填 0）</div>' +
        keys.map(function (key) { return cpIn('kids.' + i + '.costs.' + key, SP5Engine.STAGE_LABEL[key] || key, '萬', '例如 5'); }).join('') + '</div>';
    }).join('') + (I.kids.length < 6 ? '<button type="button" class="linkbtn" id="cpKidAdd">＋ 再加一個孩子</button>' : '');
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
  function cpChip(key, label) { return '<button type="button" class="chip" data-cpchip="' + key + '" aria-pressed="' + !!cpGet(key) + '">' + label + '</button>'; }
  function cpHomeHtml() {
    var I = CP.inp;
    return '<div class="card"><div class="sechead"><h2>我們家共有的</h2></div><div class="muted">全部填全家的總數。</div>' +
      cpIn('asset', '名下可自由動用的錢（兩人合計）', '萬', '例如 300') + cpIn('spend', '每月基本生活費（全家）', '萬', '例如 7') +
      '<div class="muted" style="margin-top:12px"><b>以後會結束的支出</b></div><div class="chips">' + cpChip('house', '房貸') + cpChip('carsOn', '車貸') + cpChip('kidsOn', '孩子') + '</div>' +
      (I.house ? cpIn('housePay', '房貸每月繳', '萬', '例如 2') + cpIn('houseYrs', '房貸還剩', '年', '例如 20') : '') + cpCarsHtml() + cpKidsHtml() +
'</div>';
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
  function cpAge(who, m) { return CP.M.A.ageText(CP.M.ageOf(who, m)); }
  function cpLinesHtml(L, H, marks) {
    var M = CP.M, P = function (t) { return (t / H * 100).toFixed(2); };
    var bar = function (seg) { return seg.filter(function (g) { return g.state !== 'gone'; }).map(function (g) { return '<i class="cou-sg" style="left:' + P(g.s) + '%;width:' + (P(g.e) - P(g.s)).toFixed(2) + '%;background:' + CP_COL[g.state] + '"></i>'; }).join(''); };
    var row = function (i, nm) {
      var t = marks[i], pos = +P(t), al = pos < 22 ? 'left:0' : pos > 78 ? 'right:0' : 'left:' + pos + '%;transform:translateX(-50%)';
      return '<div class="cou-row"><b class="cou-nm">' + esc(nm) + '</b><div><div class="cou-mk"><span style="' + al + '">' + esc(cpAge(i === 0 ? 'you' : 'partner', t)) + '退休</span></div><div class="cou-bar">' + bar(L[i]) + '</div></div></div>';
    };
    var y0 = Math.floor(M.A.NOWI / 12), y1 = Math.floor((M.A.NOWI + H - 1) / 12), ticks = [y0];
    for (var y = Math.ceil((y0 + 1) / 10) * 10; y < y1; y += 10) { var pp = (y * 12 - M.A.NOWI) / H, pe = ((y1 * 12 + 11 - M.A.NOWI) / H); if (pp > 0.15 && pe - pp > 0.15) ticks.push(y); }   /* 離兩端太近（不到 15%）的刻度不畫，避免重疊 */
    ticks.push(y1);
    var ax = ticks.map(function (y, i) { var p = +P(y * 12 - M.A.NOWI); return '<span style="' + (i === 0 ? 'left:0' : i === ticks.length - 1 ? 'right:0' : 'left:' + p + '%;transform:translateX(-50%)') + '">' + y + '</span>'; }).join('');
    return '<div class="cou-lines">' + row(0, cpName('you')) + row(1, cpName('partner')) + '<div class="cou-row"><span></span><div class="cou-ax">' + ax + '</div></div></div>';
  }
  function cpLegend() {
    return '<div class="cou-lg">' + [['work', '工作中'], ['retired', '已退休、年金還沒開始'], ['pension', '有年金']].map(function (x) { return '<span><i style="background:' + CP_COL[x[0]] + '"></i>' + x[1] + '</span>'; }).join('') + '</div>';
  }
  /* ===== 三種安排（v1.0.0-beta.3：跟滑桿整合） =====
     mode＝滑桿控制誰：you（你；另一半配合到最早）、tog（兩人同一個月）、par（另一半；你配合到最早）。
     滑桿從那種安排最早可行的月份開始，每個位置都是夠的。 */
  function cpStart0(P, mode) { var x = mode === 'you' ? P.youFirst : mode === 'par' ? P.partnerFirst : P.together; return x ? (mode === 'par' ? x.mb : x.ma) : null; }
  function cpRange(M, P, mode) { var lo = cpStart0(P, mode); return lo === null ? null : { lo: lo, hi: mode === 'you' ? M.MA : mode === 'par' ? M.MB : Math.min(M.MA, M.MB) }; }
  function cpDescAt(M, mode, m) {
    if (mode === 'you') { var b = M.best('you', m); return b === null ? null : M.describe(m, b); }
    if (mode === 'par') { var a = M.best('partner', m); return a === null ? null : M.describe(a, m); }
    return M.feasible(m, m) ? M.describe(m, m) : null;
  }
  function cpPosText(mode, m) { return mode === 'tog' ? CP.M.ym(m) + '（' + cpName('you') + ' ' + cpAge('you', m) + '）' : cpAge(mode === 'you' ? 'you' : 'partner', m); }
  /* 最低門檻 ≠ 建議（外部評論 P1）：剩的錢少於全家 low_buffer_months 個月的生活費，就講清楚這是剛好夠的門檻、幾乎沒有緩衝 */
  function cpFloorHtml(d) {
    var low = d.left < CP.M.PA.base * PR0.product.low_buffer_months;
    return low ? '<div class="floor">這是<b>剛好夠的最低門檻</b>，不是建議的退休時間：兩人都到設定歲數時只剩 ' + fmtW(Math.max(0, d.left)) + '，幾乎沒有緩衝。想留緩衝，往右拉晚一點退，或在「調調看」多存一點。</div>'
      : '<div class="muted" style="margin-top:6px">兩人都到設定歲數時還剩 ' + fmtW(d.left) + '。</div>';
  }
  /* ===== 每個階段（v1.0.1）：引擎的 stages() 切好的每一段，每個月進來、出去多少，存款怎麼變 ===== */
  function cpStageLabels() {
    var y = esc(cpName('you')), q = esc(cpName('partner'));
    return {
      inn: { wageA: y + '的薪水', wageB: q + '的薪水', liA: y + '的勞保', liB: q + '的勞保', lsA: y + '的勞退', lsB: q + '的勞退', npA: y + '的國保年金', npB: q + '的國保年金', oldA: y + '的勞退舊制', oldB: q + '的勞退舊制', survA: y + '領的遺屬年金', survB: q + '領的遺屬年金', lsBack: '勞退專戶餘額回到家裡' },
      out: { living: '生活費', loan: '房貸、車貸', kid: '孩子', par: '孝親費', npPremA: y + '的國保保費', npPremB: q + '的國保保費', nhiA: y + '的健保（第六類）', nhiB: q + '的健保（第六類）', nhiDep: '健保眷屬費' },
      add: { liA: y + '開始領勞保', liB: q + '開始領勞保', lsA: y + '開始領勞退', lsB: q + '開始領勞退', npA: y + '開始領國保年金', npB: q + '開始領國保年金', survA: y + '開始領遺屬年金', survB: q + '開始領遺屬年金',
        npPremA: y + '開始繳國保', npPremB: q + '開始繳國保', nhiDep: '健保依附在工作的那位名下', nhiA: y + '自己投保健保', nhiB: q + '自己投保健保' },
      rem: { wageA: y + '退休', wageB: q + '退休', kid: '孩子的教育費結束', loan: '貸款繳完', par: '孝親費結束', npPremA: y + '的國保停繳', npPremB: q + '的國保停繳', lsA: y + '的勞退月退領完', lsB: q + '的勞退月退領完' }
    };
  }
  /* 每個階段的收支（v1.0.1）：跟單人同一套版面與樣式（色條、圖例、階段卡片、存款帳、逐年逐月），資料來自引擎的 stages()／breakdown() */
  var CP_YPAGE = 5;
  function cpPhaseModel(d) {
    var M = CP.M, y = cpName('you'), q = cpName('partner'), st = M.stages(d.ma, d.mb), rows = M.breakdown(d.ma, d.mb).rows, H = rows.length;
    var kindOf = function (o) {
      var w = (o.wageA > 0 ? 1 : 0) + (o.wageB > 0 ? 1 : 0), pen = o.liA + o.liB + o.lsA + o.lsB + o.npA + o.npB + o.survA + o.survB;
      return w === 2 ? ['pay', '兩人都在工作', '靠兩份薪水'] : w === 1 ? ['pay', '一份薪水撐全家', '靠' + (o.wageA > 0 ? y : q) + '的薪水'] : pen > 0.5 ? ['pension', '有年金補貼', '年金＋存款'] : ['asset', '只靠資產', '靠存款'];
    };
    var list = [], cur = null, t;
    for (t = 0; t < H; t++) {
      var k = kindOf(rows[t]);
      if (!cur || cur.name !== k[1] || cur.src !== k[2]) { cur = { kind: k[0], name: k[1], src: k[2], s: t, e: t + 1 }; list.push(cur); } else cur.e = t + 1;
    }
    var L = cpStageLabels(), money = function (v) { return fmtW(Math.round(v)); };
    var evAt = {};   /* 第 t 個月發生的事（給階段卡片與逐月明細共用） */
    st.stages.forEach(function (g, i) {
      var ch = [];
      g.removed.forEach(function (k) { if (L.rem[k] && !((k.slice(-1) === 'A' && g.diedA) || (k.slice(-1) === 'B' && g.diedB))) ch.push(L.rem[k]); });
      if (g.diedA) ch.push(esc(y) + '到了「活到」的年紀'); if (g.diedB) ch.push(esc(q) + '到了「活到」的年紀'); if (g.livingDrop) ch.push('生活費降到 ' + Math.round(g.lf * 100) + '%');
      g.added.forEach(function (k) { if (L.add[k]) ch.push(L.add[k]); });
      if (i > 0 && ch.length) {
        var prev = st.stages[i - 1], net = function (x) { return Object.keys(L.inn).reduce(function (a, k) { return a + (x.avg[k] || 0); }, 0) - Object.keys(L.out).reduce(function (a, k) { return a + (x.avg[k] || 0); }, 0); };
        var dn = net(g) - net(prev);
        (evAt[g.s] = evAt[g.s] || []).push({ t: g.s, text: ch.join('、'), impact: Math.abs(dn) >= 500 ? '每年收支' + (dn > 0 ? '多 ' : '少 ') + money(Math.abs(dn) * 12) : '', cls: dn < 0 ? 'down' : 'up' });   /* 跟單人一樣寫「每年」 */
      }
      g.lumps.forEach(function (x) { (evAt[x.t] = evAt[x.t] || []).push({ t: x.t, text: (L.inn[x.key] || x.key) + (x.key === 'lsBack' ? '' : '（一次領）'), impact: '這個月一次收入 ' + money(x.amt), cls: 'up' }); });
    });
    list.forEach(function (x) {
      var b0 = x.s ? rows[x.s - 1].bal : M.B0, b1 = rows[x.e - 1].bal, net = 0, lo = null;
      for (t = x.s; t < x.e; t++) { net += rows[t].net; if (lo === null || rows[t].bal < lo.bal) lo = { t: t, bal: rows[t].bal }; }
      x.b0 = b0; x.b1 = b1; x.net = net; x.er = b1 - b0 - net; x.months = x.e - x.s; x.lo = lo;
      x.ymS = M.ym(x.s); x.ymE = M.ym(x.e - 1); x.dur = durStr(x.months);
      x.events = []; for (t = x.s; t < x.e; t++) if (evAt[t]) x.events = x.events.concat(evAt[t]);
    });
    return { list: list, rows: rows, H: H, evAt: evAt, d: d };
  }
  function cpAgesAt(t) { var M = CP.M; return esc(cpName('you')) + ' ' + Math.floor(M.ageOf('you', t)) + '・' + esc(cpName('partner')) + ' ' + Math.floor(M.ageOf('partner', t)); }
  function cpStripHtml(PM) {
    var M = CP.M, H = PM.H, P0 = function (t) { return Math.max(0, Math.min(100, t / H * 100)); }, d = PM.d;
    /* 字寬照實際字級（11px）估：中文字約 12px、數字與英文約 7px（v1.0.1：原本全用 7.2 估，中文名字的標籤少估一半而超出卡片） */
    var WPX = 330, occ = { up: [], dn: [] }, labs = [], tw = function (s) { var w = 4; for (var i = 0; i < s.length; i++) w += /[\u2e80-\uffff]/.test(s[i]) ? 12 : s[i] === ' ' ? 3 : 7; return w; };
    var put = function (row, t, text, align, cls) {
      var x = P0(t) / 100 * WPX, w = tw(text), l = align === 'l' ? x : align === 'r' ? x - w : x - w / 2;
      var side = l <= 0 ? 'l' : l + w >= WPX ? 'r' : 'c';   /* 碰到左邊就貼齊左邊、碰到右邊就貼齊右邊，不會超出卡片 */
      l = Math.max(0, Math.min(WPX - w, l));
      if (!occ[row].every(function (r) { return r[1] < l - 6 || r[0] > l + w + 6; })) return false;
      occ[row].push([l, l + w]); labs.push({ row: row, t: t, text: text, side: side, cls: cls || '' }); return true;
    };
    var yr = function (t) { return M.ym(t).slice(0, 4); }, y = cpName('you'), q = cpName('partner');
    /* 先放一定要有的：現在、最後一年；再放退休（上排放不下就放下排）；其他分界哪排放得下就放哪排 */
    put('dn', 0, '現在 ' + yr(0), 'l'); put('dn', H, yr(H - 1), 'r');
    /* 退休標籤一定要有：上下排都放不下（兩人退休時間很近），就接在上排最後一個標籤後面，刻度線仍畫在真正的位置 */
    var retLab = function (t, text) {
      if (put('up', t, text, 'c', 'ret') || put('dn', t, text, 'c', 'ret')) return true;
      var w = tw(text), l = occ.up.reduce(function (m, r) { return Math.max(m, r[1]); }, 0) + 10;
      if (l + w > WPX) return false;
      occ.up.push([l, l + w]); labs.push({ row: 'up', t: t, text: text, side: 'abs', lpx: l, cls: 'ret' }); return true;
    };
    if (d.ma === d.mb) retLab(d.ma, '一起退 ' + yr(d.ma));
    else { retLab(Math.min(d.ma, d.mb), (d.ma < d.mb ? y : q) + '退 ' + yr(Math.min(d.ma, d.mb))); retLab(Math.max(d.ma, d.mb), (d.ma < d.mb ? q : y) + '退 ' + yr(Math.max(d.ma, d.mb))); }
    PM.list.forEach(function (x) { if (x.s > 0 && x.s !== d.ma && x.s !== d.mb) put('up', x.s, yr(x.s), 'c') || put('dn', x.s, yr(x.s), 'c'); });
    var lab = function (l) {
      var pos = l.side === 'l' ? 'left:0' : l.side === 'r' ? 'right:0' : l.side === 'abs' ? 'left:' + (l.lpx / WPX * 100).toFixed(2) + '%' : 'left:' + P0(l.t).toFixed(2) + '%;transform:translateX(-50%)', edge = l.t <= 0 || l.t >= H;
      return '<span class="sl ' + l.row + ' ' + l.cls + '" style="' + pos + '">' + esc(l.text) + '</span>' + (edge ? '' : '<i class="sltk ' + l.row + ' ' + l.cls + '" style="left:' + P0(l.t).toFixed(2) + '%"></i>');
    };
    var segs = PM.list.map(function (x) { return '<i class="sg k-' + x.kind + '" style="left:' + P0(x.s).toFixed(2) + '%;width:' + (P0(x.e) - P0(x.s)).toFixed(2) + '%"></i>'; }).join('');
    var aria = PM.list.map(function (x) { return x.name + x.dur; }).join('、');
    return '<div class="strip" role="img" aria-label="' + esc(aria) + '"><div class="slrow up">' + labs.filter(function (l) { return l.row === 'up'; }).map(lab).join('') + '</div>' +
      '<div class="sbar"><div class="sbarin">' + segs + '</div></div><div class="slrow dn">' + labs.filter(function (l) { return l.row === 'dn'; }).map(lab).join('') + '</div></div>';
  }
  function cpMonthSummary(o) {
    var L = cpStageLabels(), money = function (v) { return fmtW(Math.round(v)); }, a = [], b = [];
    Object.keys(L.inn).forEach(function (k) { if (o[k] > 0.5 && !o.lumps.some(function (x) { return x[0] === k; })) a.push(L.inn[k] + ' ' + money(o[k])); });
    Object.keys(L.out).forEach(function (k) { if (o[k] > 0.5) b.push(L.out[k] + ' ' + money(o[k])); });
    return '每月收入：' + (a.join('、') || '無') + '<br>每月支出：' + (b.join('、') || '無');
  }
  function cpYearsHtml(PM, x) {
    var M = CP.M, rows = PM.rows, years = [], y;
    var y0 = Math.floor((M.A.NOWI + x.s) / 12), y1 = Math.floor((M.A.NOWI + x.e - 1) / 12);
    for (y = y0; y <= y1; y++) years.push(y);
    var hasEv = function (yy) { for (var m = 0; m < 12; m++) { var t = yy * 12 + m - M.A.NOWI; if (t >= x.s && t < x.e && PM.evAt[t]) return true; } return false; };
    if (CP.year == null || years.indexOf(CP.year) < 0) { CP.year = years[0]; for (var i = 0; i < years.length; i++) if (hasEv(years[i])) { CP.year = years[i]; break; } }
    var pages = Math.ceil(years.length / CP_YPAGE), pg = CP.ypage != null && CP.ypage >= 0 && CP.ypage < pages ? CP.ypage : Math.floor(years.indexOf(CP.year) / CP_YPAGE);
    var shown = years.slice(pg * CP_YPAGE, pg * CP_YPAGE + CP_YPAGE), Y = CP.year;
    var ageR = function (yy) { var t = yy * 12 - M.A.NOWI; return esc(cpName('you')) + ' ' + Math.floor(M.ageOf('you', t)) + '・' + esc(cpName('partner')) + ' ' + Math.floor(M.ageOf('partner', t)); };
    var ageS = function (yy) { var t = yy * 12 - M.A.NOWI; return Math.floor(M.ageOf('you', t)) + '／' + Math.floor(M.ageOf('partner', t)) + ' 歲'; };   /* 小按鈕放得下：你／另一半 */
    var btns = '<div class="ygrid" role="group" aria-label="年份（' + esc(cpName('you')) + '／' + esc(cpName('partner')) + ' 的年紀）">' + shown.map(function (yy) {
      return '<button type="button" class="yb' + (hasEv(yy) ? ' ev' : '') + '" data-cpyear="' + yy + '" aria-pressed="' + (yy === Y) + '"><b>' + yy + '</b><span>' + ageS(yy) + '</span></button>';
    }).join('') + '</div><div class="ylegend"><b>●</b> 這一年有事情發生（退休、年金開始、繳完貸款、孩子畢業…）</div>';
    var pager = pages > 1 ? '<div class="ypager"><button type="button" data-cpypage="' + (pg - 1) + '"' + (pg === 0 ? ' disabled' : '') + '>‹ 上一頁</button><span class="muted">' + years[pg * CP_YPAGE] + '–' + shown[shown.length - 1] + '・' + (pg + 1) + '／' + pages + '</span><button type="button" data-cpypage="' + (pg + 1) + '"' + (pg === pages - 1 ? ' disabled' : '') + '>下一頁 ›</button></div>' : '';
    var out = [], run = null, first = true, m;
    var bal = function (v) { return v < 0 ? '不足 ' + fmtW(-v) : fmtW(v); };
    var flush = function () { if (!run) return; out.push('<div class="mr"><span class="mm">' + (run.a === run.b ? run.a + ' 月' : run.a + '–' + run.b + ' 月') + '</span><span class="mt muted">同上</span><span class="me">' + run.b + ' 月底 ' + bal(run.end) + '</span></div>'); run = null; };
    for (m = 1; m <= 12; m++) {
      var t = Y * 12 + m - 1 - M.A.NOWI;
      if (t < x.s) { if (m === 12 || Y * 12 + m - M.A.NOWI >= x.s) out.push('<div class="mr past"><span class="mm">' + (m === 1 ? '1' : '1–' + m) + ' 月</span><span class="mt muted">' + (t < 0 ? '已經過去' : '屬於上一個階段') + '</span><span class="me"></span></div>'); continue; }
      if (t >= x.e) { flush(); out.push('<div class="mr past"><span class="mm">' + m + ' 月起</span><span class="mt muted">' + (t >= PM.H ? '試算到這裡為止' : '屬於下一個階段') + '</span><span class="me"></span></div>'); break; }
      var o = rows[t], ev = PM.evAt[t] || [];
      if (!ev.length && !first) { if (run) { run.b = m; run.end = o.bal; } else run = { a: m, b: m, end: o.bal }; continue; }
      flush();
      var txt = ev.map(function (e) { return '<div class="mev">● ' + e.text + (e.impact ? '（' + e.impact + '）' : '') + '</div>'; }).join('') + ((first || ev.length) ? '<div class="msum">' + cpMonthSummary(o) + '</div>' : '');
      first = false;
      out.push('<div class="mr' + (ev.length ? ' hit' : '') + '"><span class="mm">' + m + ' 月</span><span class="mt">' + txt + '</span><span class="me' + (o.bal < 0 ? ' neg' : '') + '">月底 ' + bal(o.bal) + '</span></div>');
    }
    flush();
    return pager + btns + '<div class="mlist"><div class="mhd">' + Y + ' 年（' + ageR(Y) + ' 歲）</div>' + out.join('') + '</div>' +
      '<div class="muted" style="margin-top:6px">金額都是今天的購買力。「同上」表示收支項目沒有變化。</div>';
  }
  function cpStagesHtml(d) {
    if (!d) return '';
    var PM = cpPhaseModel(d), y = esc(cpName('you')), q = esc(cpName('partner'));
    if (CP.phase != null && CP.phase >= PM.list.length) CP.phase = null;
    var first = PM.list[0], whoFirst = d.ma === d.mb ? '兩人一起' : d.ma < d.mb ? y : q;
    var rows = PM.list.map(function (x, i) {
      var open = CP.phase === i;
      var money = i === 0 && x.name === '兩人都在工作' ? whoFirst + '退休時，你們會有 <b>' + fmtW(x.b1) + '</b>' : x.net < 0 ? '這段要從存款拿出 <b>' + fmtW(-x.net) + '</b>' : '這段收入大於支出，共多 <b>' + fmtW(x.net) + '</b>';
      var head = '<button type="button" class="phc" data-cpphase="' + i + '" aria-expanded="' + open + '">' +
        '<span class="phh"><i class="phsw k-' + x.kind + '"></i><b>' + x.name + '</b><span class="ps">' + esc(x.src) + '</span><span class="chev" aria-hidden="true">' + (open ? '⌄' : '›') + '</span></span>' +
        '<span class="rg">' + x.ymS + '–' + x.ymE + '・' + x.dur + '（' + cpAgesAt(x.s) + ' 歲起）</span><span class="pm1">' + money + '</span></button>';
      if (!open) return '<div class="phrow">' + head + '</div>';
      var detail = '<div class="wgrid"><span>' + (i === 0 ? '現有' : '這段開始時') + '</span><span>' + fmtW(Math.max(0, x.b0)) + '</span>' +
        (x.net >= 0 ? '<span>＋ 這段存下</span><span>' + fmtW(x.net) + '</span>' : '<span>－ 這段入不敷出</span><span>' + fmtW(-x.net) + '</span>') +
        (Math.abs(x.er) >= 5000 ? '<span>' + (x.er < 0 ? '－ 通膨讓存款縮水' : '＋ 存款利息') + '</span><span>' + fmtW(Math.abs(x.er)) + '</span>' : '') +
        '<b>這段結束時</b><b>' + fmtW(Math.max(0, x.b1)) + '</b></div>';
      var evs = x.events.map(function (e) {
        return '<div class="pe"><span class="pa">' + CP.M.ym(e.t) + '<small>' + cpAgesAt(e.t) + ' 歲</small></span><div><div class="pt">' + e.text + '</div>' + (e.impact ? '<span class="' + (e.cls === 'down' ? 'dn2' : 'up') + '">' + e.impact + '</span>' : '') + '</div></div>';
      }).join('') || '<div class="muted" style="margin-top:6px">這段期間收支沒有大變化。</div>';
      var lo = x.lo && x.lo.bal < x.b0 && x.lo.bal < x.b1 ? '<div class="pmin">存款最低點：' + fmtW(Math.max(0, x.lo.bal)) + '（' + CP.M.ym(x.lo.t) + '）</div>' : '';
      var panel = '<div class="ppanel"><div class="pr">' + x.ymS + '–' + x.ymE + '</div>' + detail + evs + lo +
        '<button type="button" class="linkbtn" id="cpLedgerBtn" aria-expanded="' + !!CP.ledger + '">' + (CP.ledger ? '收起逐月明細' : '看這段每一年、每個月 ›') + '</button>' +
        (CP.ledger ? cpYearsHtml(PM, x) : '') + '</div>';
      return '<div class="phrow open">' + head + panel + '</div>';
    });
    var look = d.ma === d.mb ? '以兩人 ' + CP.M.ym(d.ma) + ' 一起退休來看' : '以' + y + ' ' + esc(CP.M.A.ageText(d.ageA)) + '（' + d.ymA + '）、' + q + ' ' + esc(CP.M.A.ageText(d.ageB)) + '（' + d.ymB + '）退休來看';
    return '<h2>每個階段的收支</h2><div class="muted">色條的長度依時間長短；點下面每一段看發生的事。金額都是今天的購買力。</div>' + cpStripHtml(PM) + phaseLegend() +
      '<div class="muted" style="margin:8px 0">' + look + '</div><div class="phlist">' + rows.join('') + '</div>' + (first ? '' : '');
  }
  function cpSlideOut() {
    var M = CP.M, P = CP.P, mode = CP.mode, m = CP.mon, d = cpDescAt(M, mode, m), y = esc(cpName('you')), q = esc(cpName('partner'));
    if (!d) return '<div class="cou-say cou-warn">這個組合不夠。</div>';
    var lo = cpStart0(P, mode), first, ex = null, ref = '';
    if (mode === 'tog') first = '兩人同一個月退休' + (m > lo ? '，比最早晚 <b>' + durStr(m - lo) + '</b>' : '') + '。' + (d.onlySavings ? '' : '不用只靠存款。');
    else {
      var nm = d.first === 'you' ? y : q;
      first = d.first === 'both' ? '兩人同一個月退休。' : nm + '先退，早 <b>' + durStr(d.gap) + '</b>' +
        (d.oneSalary === d.gap ? '，這段時間靠一份薪水撐全家。' : (d.oneSalary ? '；一份薪水撐全家 <b>' + durStr(d.oneSalary) + '</b>' : '') + '。');
      ex = M.exchange(mode === 'you' ? 'you' : 'partner', m);
    }
    if (CP.M !== CP.M0) {   /* 調調看：原始 → 調整後 */
      if (mode === 'tog') { var P0 = CP.M0.plans(); ref = '原始：最早一起退 ' + (P0.together ? P0.together.ymA : '不夠') + ' → 調整後：' + (P.together ? P.together.ymA : '不夠'); }
      else { var d0 = cpDescAt(CP.M0, mode, m), oA = mode === 'par'; ref = '原始：' + (d0 ? esc(CP.M0.A.ageText(oA ? d0.ageA : d0.ageB)) : '不夠') + ' → 調整後：' + esc(M.A.ageText(oA ? d.ageA : d.ageB)); }
      ref = '<div class="cou-cmp">' + ref + '</div>';
    }
    var two = function (lab, age, ym) { return '<div><div class="muted">' + lab + '</div><b class="cou-b2">' + esc(M.A.ageText(age)) + '</b><div class="muted">' + ym + '</div></div>'; };
    return '<div class="cou-two">' + two(y + '退休', d.ageA, d.ymA) + two(q + '退休', d.ageB, d.ymB) + '</div>' +
      '<div class="cou-say">' + first + '</div>' + cpFloorHtml(d) +
      (d.onlySavings ? '<div class="cou-say cou-warn"><b>只靠存款 ' + durStr(d.onlySavings) + '</b>：兩人都退了、年金還沒開始。</div>' : '') + ref +
      (ex !== null && ex > 0 ? '<div class="cou-ex">' + (mode === 'you' ? y : q) + '每多做 1 年，' + (mode === 'you' ? q : y) + '可以早 <b>' + durStr(ex) + '</b></div>' : '') +
      cpLinesHtml(d.lines, d.H, [d.ma, d.mb]) + cpLegend();
  }
  function cpStep(key, label, val, hint, canDn, canUp, whoTag) {
    return '<div class="cou-step"><div><div>' + label + (whoTag ? '<span class="cou-tag">' + esc(whoTag) + '</span>' : '') + '</div><div class="muted">' + hint + '</div></div><div class="cou-stc">' +
      '<button type="button" class="stb" data-cpstep="' + key + '" data-d="-1" aria-label="' + esc(label + (whoTag || '')) + '減少"' + (canDn ? '' : ' disabled') + '>−</button><b>' + val + '</b>' +
      '<button type="button" class="stb" data-cpstep="' + key + '" data-d="1" aria-label="' + esc(label + (whoTag || '')) + '增加"' + (canUp ? '' : ' disabled') + '>＋</button></div></div>';
  }
  var CP_STEPS = { more: [0.2, -5, 5], save: [0.2, 0, 5], spend: [1, 0, 3], gapA: [0.5, 0, 3], gapB: [0.5, 0, 3], cutA: [10, 0, 30], cutB: [10, 0, 30], inf: [1, 0, 3], dep: [0.5, 0, 1.5], li: [10, 50, 100], endA: [1, 0, 0], endB: [1, 0, 0] };
  function cpSelVal(k) { var v = CP.sel[k]; if (k === 'li') return v == null ? 100 : v; if (k === 'endA' || k === 'endB') return v == null ? PR0.assumptions.default_end_age : v; return v || 0; }
  /* 調調看：跟提高準確度一樣分「你／另一半／我們家」；有調過的頁籤標「已調 N 項」 */
  var CP_AKEYS = { you: ['endA', 'gapA', 'cutA'], p: ['endB', 'gapB', 'cutB'], home: ['more', 'save', 'spend', 'inf', 'dep', 'li'] };
  function cpAdjHtml() {
    var v = cpSelVal, r1 = function (x) { return Math.round(x * 100) / 100; }, endMin = PR0.product.end_age_min, endMax = PR0.product.end_age_max, at = CP.atab || 'you';
    var money = function (x) { return x === 0 ? '0' : (x > 0 ? '＋' : '−') + fmtW(Math.abs(x) * 10000); };
    var cnt = function (t) { var n = CP_AKEYS[t].filter(function (k) { return k in CP.sel; }).length; return n ? '已調 ' + n + ' 項' : ''; };
    var person = function (sfx) {
      return '<div class="cou-g">可以決定的</div>' + cpStep('end' + sfx, '活到', v('end' + sfx) + ' 歲', '每格 1 歲', v('end' + sfx) > endMin, v('end' + sfx) < endMax) +
        '<div class="cou-g">萬一……</div>' +
        cpStep('gap' + sfx, '收入中斷多久', v('gap' + sfx) ? r1(v('gap' + sfx)) + ' 年' : '不會', '從明年起，每格半年', v('gap' + sfx) > 0, v('gap' + sfx) < 3) +
        cpStep('cut' + sfx, '收入減少多少', v('cut' + sfx) ? v('cut' + sfx) + '%' : '不會', '每格 10%', v('cut' + sfx) > 0, v('cut' + sfx) < 30);
    };
    var body = at === 'you' ? person('A') : at === 'p' ? person('B') :
      '<div class="cou-g">可以決定的</div>' +
      cpStep('more', '全家每月花費', money(v('more')), '每格 2,000', v('more') > -5, v('more') < 5) + cpStep('save', '全家每月多存', money(v('save')), '每格 2,000', v('save') > 0, v('save') < 5) +
      '<div class="cou-g">萬一……</div>' +
      cpStep('spend', '晚年每月多花多少', v('spend') ? fmtW(v('spend') * 10000) : '不會', '從' + esc(cpName('you')) + ' ' + PR0.assumptions.late_life_age + ' 歲起，每格 1 萬', v('spend') > 0, v('spend') < 3) +
      cpStep('inf', '通膨多幾個百分點', v('inf') ? '＋' + v('inf') + '%' : '不會', '每格 1%', v('inf') > 0, v('inf') < 3) + cpStep('dep', '存款利率降低', v('dep') ? '−' + v('dep') + '%' : '不會', '每格 0.5 個百分點', v('dep') > 0, v('dep') < 1.5) +
      cpStep('li', '勞保只領到', v('li') + '%', '兩個人一起打折，每格 10%', v('li') > 50, v('li') < 100);
    return '<div class="card" id="cpAdj"><h2>調調看</h2><div class="muted">退休時間用上面的滑桿調；這裡調錢和「萬一」。</div>' +
      cpTabs(at, [['you', cpName('you'), cnt('you')], ['p', cpName('partner'), cnt('p')], ['home', '我們家', cnt('home')]], 'data-cpatab', '調哪一部分') + body +
      (Object.keys(CP.sel).length ? '<button type="button" id="cpAdjReset">全部回到原始</button>' : '') + '</div>';
  }
  function cpPrecHtml() {
    var t = CP.ptab, body;
    if (t === 'home') {
      var DI = PR0.deposit_input, def = Math.round(EN0.rates().depDefault * 1000) / 10, cur = cpFilled(CP.inp.pre.dep) ? +CP.inp.pre.dep : def;
      body = '<div class="cou-g">存款利率（每年）</div><div class="cou-stc"><button type="button" class="stb" data-cpdep="-1" aria-label="存款利率減少"' + (cur - DI.step < DI.min - 1e-9 ? ' disabled' : '') + '>−</button><b>' + (Math.round(cur * 100) / 100) + '%</b>' +
        '<button type="button" class="stb" data-cpdep="1" aria-label="存款利率增加"' + (cur + DI.step > DI.max + 1e-9 ? ' disabled' : '') + '>＋</button></div>' +
        '<div class="muted">預設 ' + def + '% 是臺灣銀行一年期定存牌告；每格 ' + DI.step + '%，範圍 ' + DI.min + '%～' + DI.max + '%。</div>' +
        '<div class="cou-g">通膨（每年）</div><div class="chips">' + LAW.infOpts.map(function (x) { var on = String(cpFilled(CP.inp.pre.inf) ? +CP.inp.pre.inf : LAW.infDef) === String(x); return '<button type="button" class="chip" data-cpinf="' + x + '" aria-pressed="' + on + '">' + x + '%' + (x === LAW.infDef ? '（預設）' : '') + '</button>'; }).join('') + '</div>' +
        '<div class="cou-g">健保</div><div class="muted">依法自動處理，不用設定：沒工作的一方依附還在工作的另一半（不能自己投保第六類），另一半每月多一份眷屬保費；孩子也算眷屬，最多算 ' + PR0.nhi_dependent.max_dependents + ' 人。兩人都沒工作時，一人投保第六類，另一人和孩子依附。</div>';
    } else {
      var k = t === 'you' ? 'you' : 'partner', est = (CP.M0 && !CP.M0.error) ? (t === 'you' ? CP.M0.A : CP.M0.B).estList() : [];
      body = '<div class="muted" style="margin-top:8px">' + (est.length ? '還是估算的：' + esc(est.join('、')) : '都已經填了實際資料') + '</div>' +
        cpIn(k + '.pre.liYears', '勞保年資（到今天）', '年', '估算') + cpIn(k + '.pre.w60', '平均月投保薪資（最高 60 個月）', '萬', '估算') +
        cpIn(k + '.pre.lsBal', '勞退專戶餘額', '萬', '估算') + cpIn(k + '.pre.lsWage', '勞退月提繳工資', '萬', '估算') + cpIn(k + '.pre.lsYears', '勞退實際提繳年資', '年', '估算') +
        cpIn(k + '.pre.self', '勞退自提（%）', '%', '0') +
        '<div class="muted">這些數字在勞保局 e 化服務系統或 App 查得到。工作空窗、勞退舊制、一次請領等進階選項，夫妻模式之後提供。</div>' +
        '<button type="button" class="primary" id="cpApply">套用</button>';
    }
    var estN = function (w) { if (!CP.M0 || CP.M0.error) return ''; var n = (w === 'you' ? CP.M0.A : CP.M0.B).estList().length; return n ? '估算 ' + n + ' 項' : '✓ 都填了'; };
    /* 跟調調看同樣的排列：標題 → 說明 → 頁籤（標狀態）→ 內容 */
    return '<div class="card" id="cpPrec"><h2>提高準確度</h2><div class="muted">填了實際的數字，結果會更準；沒填的先用估算。</div>' +
      cpTabs(t, [['you', cpName('you'), estN('you')], ['p', cpName('partner'), estN('p')], ['home', '我們家', '']], 'data-cpptab', '補哪一部分') + body + '</div>';
  }
  /* 結果頁最上面：三行範圍事實（不替使用者選一個答案） */
  function cpResultHtml() {
    var M = CP.M, a = active(), dirty = cpDirty();
    var bar = '<div class="top"><button type="button" class="linkbtn" id="cpEdit">‹ 修改答案</button><span class="muted">v' + EN0.VERSION + '</span></div>' +
      (a && a.id === CP.id ? '<div class="scbar' + (dirty ? ' dirty' : '') + '"><button type="button" class="scpick" id="cpList"><span class="nm">' + esc(a.name) + '</span><span class="ct">' + DB.list.length + '／' + MAX + ' ▾</span></button>' +
        '<button type="button" class="scsave' + (dirty ? ' primary' : '') + '" id="cpSave"' + (dirty ? '' : ' disabled') + '>' + (dirty ? '存檔' : '已存檔') + '</button></div>' : '');
    if (M.error) return bar + '<div class="card"><div class="err" role="alert">' + esc(M.error) + '</div><button type="button" class="primary" id="cpEdit2">回去修改</button></div>';
    var P = CP.P = M.plans(), maxR = PR0.product.max_retire_age;
    var acts = '<div class="cou-acts"><button type="button" id="cpTgAdj" aria-expanded="' + (CP.panel === 'adj') + '">調調看</button><button type="button" id="cpTgPrec" aria-expanded="' + (CP.panel === 'prec') + '">提高準確度</button></div>' +
      (CP.panel === 'adj' ? cpAdjHtml() : CP.panel === 'prec' ? cpPrecHtml() : '');
    var tail = '<div class="assume">不靠投資・存款 ' + pct2(M.A.rates().dep) + '・通膨 ' + pct(M.A.rates().inf) + '・錢合併算・算到兩人都到各自的「活到」・沒工作的一方依法依附健保・只剩一位之後生活費降到 ' + Math.round(PR0.assumptions.living_after_death * 100) + '%、遺屬年金擇一取高、勞退專戶餘額回到家裡・制度資料核對 ' + esc(PR0.verified.at) + '</div>' +
      '<div class="muted" style="margin-top:6px">夫妻版的 PDF 報告之後提供。</div>';
    if (!P.youFirst && !P.together && !P.partnerFirst) {
      var w = M.describe(M.MA, M.MB);
      return bar + '<h1>我們什麼時候可以退休？</h1><div class="card"><b class="cou-warn">兩人都工作到 ' + maxR + ' 歲還不夠</b>' + (w && w.negYM ? '<div class="muted">' + w.negYM + ' 存款會用完。可以在「調調看」試試少花一點或多存一點。</div>' : '') + '</div>' + acts + tail;
    }
    if (!cpRange(M, P, CP.mode)) CP.mode = P.youFirst ? 'you' : P.together ? 'tog' : 'par';
    var R = cpRange(M, P, CP.mode);
    if (CP.mon === null || CP.mon < R.lo || CP.mon > R.hi) CP.mon = R.lo;
    /* 切換鈕上直接寫答案：一進來不用點就看得到三種安排最早是什麼時候 */
    var segs = [['you', cpName('you') + '先退', P.youFirst ? cpAge('you', P.youFirst.ma) : '不夠'], ['tog', '一起退', P.together ? P.together.ymA : '不夠'], ['par', cpName('partner') + '先退', P.partnerFirst ? cpAge('partner', P.partnerFirst.mb) : '不夠']];
    var segHtml = '<div class="cou-seg" role="group" aria-label="三種安排">' + segs.map(function (x) {
      return '<button type="button" data-cpmode="' + x[0] + '" aria-pressed="' + (CP.mode === x[0]) + '"' + (cpRange(M, P, x[0]) ? '' : ' disabled') + '><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span></button>';
    }).join('') + '</div>';
    var y = esc(cpName('you')), q = esc(cpName('partner'));
    var lab = CP.mode === 'you' ? y + '想幾歲退休？' + q + '配合到最早' : CP.mode === 'par' ? q + '想幾歲退休？' + y + '配合到最早' : '兩人哪個月一起退？';
    var loT = '最早 ' + (CP.mode === 'tog' ? M.ym(R.lo) : esc(cpAge(CP.mode === 'you' ? 'you' : 'partner', R.lo))), hiT = CP.mode === 'tog' ? M.ym(R.hi) : maxR + ' 歲';
    return bar + '<h1>我們什麼時候可以退休？</h1>' +
      '<div class="card" id="cpSlider"><h2>三種安排</h2><div class="muted">選一種，再用滑桿往後調。</div>' + segHtml +
      '<label class="qlab" for="cpRange" style="margin-top:14px;display:block">' + lab + '</label>' +
      '<input type="range" id="cpRange" min="' + R.lo + '" max="' + R.hi + '" step="1" value="' + CP.mon + '" aria-valuetext="' + esc(cpPosText(CP.mode, CP.mon)) + '">' +
      '<div class="cou-rg"><span>' + loT + '</span><span>' + hiT + '</span></div><div id="cpOut">' + cpSlideOut() + '</div></div>' +
      '<div class="card" id="cpStages">' + cpStagesHtml(cpDescAt(M, CP.mode, CP.mon)) + '</div>' + acts + tail;
  }
  function cpPaint() { $('couple').innerHTML = CP.view === 'input' ? cpInputHtml() : cpResultHtml(); }
  function cpRefreshInputBits() {
    ['you', 'p', 'home'].forEach(function (k) { var el = document.querySelector('[data-cpst="' + k + '"]'); if (el) { el.textContent = cpStatus(k); el.className = 'cou-st' + (/^✓/.test(el.textContent) ? ' done' : ''); } });
    ['you', 'partner'].forEach(function (k) { var el = document.querySelector('[data-cpage="' + k + '"]'); if (el) el.textContent = cpAgeHint(k); });
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
    if (ds.cpchip) { cpSet(ds.cpchip, !cpGet(ds.cpchip)); cpPaint(); return; }
    if (b.id === 'cpCarAdd') { I.cars.push({ pay: '', yrs: '' }); cpPaint(); return; }
    if (ds.cpcardel) { I.cars.splice(+ds.cpcardel, 1); cpPaint(); return; }
    if (b.id === 'cpKidAdd') { I.kids.push({ bym: '', path: 'uni', costs: {} }); cpPaint(); return; }
    if (ds.cpkiddel) { I.kids.splice(+ds.cpkiddel, 1); cpPaint(); return; }
    if (b.id === 'cpGo') { cpGo(); return; }
    if (b.id === 'cpEdit' || b.id === 'cpEdit2') { CP.view = 'input'; cpPaint(); return; }
    if (b.id === 'cpList') { paintList(); show('list'); return; }
    if (b.id === 'cpSave') { var a = active(); if (a && a.id === CP.id) { a.saved = JSON.parse(JSON.stringify(CP.inp)); a.updated = nowStr(); if (saveDB()) toast('已存檔：' + a.name); } cpPaint(); return; }
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
    if (el.dataset.cpk) { cpSet(el.dataset.cpk, el.value); if (CP.view === 'input') cpRefreshInputBits(); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target; if (!el || !el.closest || !el.closest('#couple')) return;
    if (el.tagName === 'SELECT' && el.dataset.cpk) { cpSet(el.dataset.cpk, el.value); cpPaint(); }
  });
