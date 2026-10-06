  /* 46-couple-result.js — 夫妻模式的結果頁（v1.0.3 從 45-couple.js 拆出來，純搬家）：
     兩條線、三種安排與滑桿、最低門檻／養老預備金的說明、每個階段的收支（色條、階段卡片、逐年逐月） */
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
    var fl = CP.M.PA.floor;
    if (fl > 0) {   /* v1.0.2：有填養老預備金 */
      var nr = CP.Mnr ? CP.Mnr.plans() : null, a = cpStart0(CP.P, CP.mode), b = nr ? cpStart0(nr, CP.mode) : null, dm = a !== null && b !== null ? a - b : 0;
      return '<div class="floor"><b>已保留 ' + fmtW(fl) + '養老預備金</b>：退休後，存款任何時候都至少有 ' + fmtW(fl) + '。' + (dm > 0 ? '<b>不留的話，這種安排最早可以提前 ' + durStr(dm) + '。</b>' : '') + '</div>';
    }
    var low = d.left < CP.M.PA.base * PR0.product.low_buffer_months;
    return low ? '<div class="floor">這是<b>剛好夠的最低門檻</b>，不是建議的退休時間：兩人都到設定歲數時只剩 ' + fmtW(Math.max(0, d.left)) + '，幾乎沒有緩衝。想留緩衝，可以填「退休後想隨時留多少預備金」，或往右拉晚一點退。</div>'
      : '<div class="muted" style="margin-top:6px">兩人都到設定歲數時還剩 ' + fmtW(d.left) + '。</div>';
  }
  /* ===== 每個階段（v1.0.1）：引擎的 stages() 切好的每一段，每個月進來、出去多少，存款怎麼變 ===== */
  function cpStageLabels() {
    var y = esc(cpName('you')), q = esc(cpName('partner'));
    return {
      inn: { wageA: y + '的薪水', wageB: q + '的薪水', liA: y + '的勞保', liB: q + '的勞保', lsA: y + '的勞退', lsB: q + '的勞退', npA: y + '的國保年金', npB: q + '的國保年金', oldA: y + '的勞退舊制', oldB: q + '的勞退舊制', survA: y + '領的遺屬年金', survB: q + '領的遺屬年金', lsBack: '勞退專戶餘額回到家裡', lumpIn: '大筆收入' },
      out: { living: '生活費', loan: '房貸、車貸', kid: '孩子', par: '孝親費', npPremA: y + '的國保保費', npPremB: q + '的國保保費', nhiA: y + '的健保（第六類）', nhiB: q + '的健保（第六類）', nhiDep: '健保眷屬費', lumpOut: '大筆支出' },
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
      g.lumps.forEach(function (x) {   /* 一次領、勞退餘額回家、大筆收支（v1.0.2：用使用者取的名字；支出寫「一次付出」） */
        var isL = x.key === 'lumpIn' || x.key === 'lumpOut', out = x.key === 'lumpOut';
        (evAt[x.t] = evAt[x.t] || []).push({ t: x.t, text: isL ? esc(x.name) : (L.inn[x.key] || x.key) + (x.key === 'lsBack' ? '' : '（一次領）'), impact: '這個月一次' + (out ? '付出 ' : '收入 ') + money(x.amt), cls: out ? 'down' : 'up' });
      });
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
  function cpResultHtml() {
    var M = CP.M, a = active(), dirty = cpDirty();
    var bar = '<div class="top"><button type="button" class="linkbtn" id="cpEdit">‹ 修改答案</button><span class="muted">v' + EN0.VERSION + '</span></div>' +
      (a && a.id === CP.id ? '<div class="scbar' + (dirty ? ' dirty' : '') + '"><button type="button" class="scpick" id="cpList"><span class="nm">' + esc(a.name) + '</span><span class="ct">' + DB.list.length + '／' + MAX + ' ▾</span></button>' +
        '<button type="button" class="scsave' + (dirty ? ' primary' : '') + '" id="cpSave"' + (dirty ? '' : ' disabled') + '>' + (dirty ? '存檔' : '已存檔') + '</button></div>' : '');
    if (M.error) return bar + '<div class="card"><div class="err" role="alert">' + esc(M.error) + '</div><button type="button" class="primary" id="cpEdit2">回去修改</button></div>';
    var P = CP.P = M.plans(), maxR = PR0.product.max_retire_age;
    var acts = '<div class="cou-acts"><button type="button" id="cpTgAdj" aria-expanded="' + (CP.panel === 'adj') + '">調調看</button><button type="button" id="cpTgPrec" aria-expanded="' + (CP.panel === 'prec') + '">提高準確度</button></div>' +
      (CP.panel === 'adj' ? cpAdjHtml() : CP.panel === 'prec' ? cpPrecHtml() : '');
    var tail = '<div class="assume">不靠投資・存款 ' + pct2(M.A.rates().dep) + '・通膨 ' + pct(M.A.rates().inf) + '・錢合併算・算到兩人都到各自的「活到」・沒工作的一方依法依附健保・只剩一位之後生活費降到 ' + Math.round(PR0.assumptions.living_after_death * 100) + '%、遺屬年金擇一取高、勞退專戶餘額回到家裡' + (M.PA.floor > 0 ? '・養老預備金 ' + fmtW(M.PA.floor) : '') + (M.PA.lumpList.length ? '・大筆收支 ' + M.PA.lumpList.length + ' 筆' : '') + '・制度資料核對 ' + esc(PR0.verified.at) + '</div>' +
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
