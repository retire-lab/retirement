/* src/app/40-compare.js — 原始 vs 調整後對照、曲線
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* ================= 原始 vs 調整後 對照（v0.6.2） =================
     調調看（如果……）與提高準確度還沒套用的實際資料，都放在「調整後」那欄；原始那欄永遠不動 */
  function condRows() {
    var a = adjState(), fact = [], what = [];
    var dc0 = draftCheck(); dc0.ok.forEach(function (k) { fact.push([PRE_LABEL[k], esc(preVal(k, S.pre[k])), esc(preVal(k, dc0.eff[k])), 'pre.' + k]); });   /* 實際資料是使用者打的字：放進 HTML 前跳脫（preVal 維持純文字，PDF 也用它） */
    if (a.ret !== null) what.push(['想在幾歲退休', '最快', ageText(a.ret), 'ret']);
    if (a.more) what.push(['每月花費', fmtW(W(S.spend)), fmtW(W(S.spend) + a.more) + '<small>' + (a.more < 0 ? '少 ' : '多 ') + yuan(a.more) + '</small>', 'more']);
    if (a.save) what.push(['每月多存', '—', (a.save > 0 ? '多存 ' : '少存 ') + yuan(a.save), 'save']);
    if (a.end !== null) what.push(['活到', EN0.E() + ' 歲', a.end + ' 歲', 'end']);
    wiOn(a).forEach(function (k) {
      var g = WI_STEPS.filter(function (x) { return x[0] === k; })[0];
      what.push([g[1], wiVal(k, WI_NEUTRAL[k]).replace('（設定）', ''), wiVal(k, a.wi[k]), 'wi.' + k]);
    });
    return { fact: fact, what: what };
  }
  /* 要補上：在目前所有調整之上，每月再多存或再少花多少，才剛好夠（引擎的 solve 會取代同一項，所以求總量再減掉現有的） */
  function fillGap(pv, R) {
    var adj = pv.adj, inc = W(S.inc), base = W(S.spend);
    var tx = pv.en.solve(R, 'extra', inc * 12 + (adj.extra || 0), adj), tc = pv.en.solve(R, 'cut', base * 12, adj);
    var x = tx !== null ? Math.ceil((tx - (adj.extra || 0)) / 12 / 100) * 100 : null, y = tc !== null ? Math.ceil((tc - (adj.cut || 0)) / 12 / 100) * 100 : null;
    if (x !== null && x <= 0) x = null; if (y !== null && y <= 0) y = null;
    if (x === null && y === null) return '單靠多存或少花補不上';
    return (x !== null ? '每月再多存 <b>' + fmtW(x) + '</b>' : '') + (x !== null && y !== null ? '<br>或' : '') + (y !== null ? '每月再少花 <b>' + fmtW(y) + '</b>' : '') +
      '<span class="fillb">' + (x !== null ? '<button type="button" class="linkbtn" data-fill="save:' + x + '">套用多存</button>' : '') + (y !== null ? '<button type="button" class="linkbtn" data-fill="more:-' + y + '">套用少花</button>' : '') + '</span>';
  }
  /* 格子轉文字：大字與下面的小字分行（<small> 前後斷開）、<br>、段落斷開；粗體只是強調，不斷開 */
  function htmlLines(h) { return String(h == null ? '' : h).replace(/<button[\s\S]*?<\/button>/g, '').replace(/<small/g, '\n<small').replace(/<\/small>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<\/div>/g, '\n').replace(/<[^>]+>/g, '').split('\n').map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean); }
  /* 段落轉文字：只在 div、br 斷開（句子裡的粗體不斷開） */
  function htmlBlocks(h) { return String(h == null ? '' : h).replace(/<button[\s\S]*?<\/button>/g, '').replace(/<br\s*\/?>/g, '\n').replace(/<\/div>/g, '\n').replace(/<[^>]+>/g, '').split('\n').map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean); }
  function compareHtml(c, sink) {
    var pv = c.pv, cr = condRows(), ret = adjState().ret;
    var G = function (lab, o, a, cls, d, dcls) {
      if (sink) sink.push({ label: htmlLines(lab).join(''), o: htmlLines(o), a: htmlLines(a), cls: cls || '', d: d || '', dcls: dcls || '', big: cls === 'first' }); return '<div class="cr' + (cls ? ' ' + cls : '') + '"><span class="cl">' + lab + '</span><div class="co">' + o + '</div><div class="ca">' + a + (d ? '<span class="cd ' + (dcls || '') + '">' + d + '</span>' : '') + '</div></div>'; };
    var sec = function (t) { if (sink) sink.push({ sec: t }); return '<div class="cr sec"><span class="cl">' + t + '</span><div class="co"></div><div class="ca"></div></div>'; };
    var html = '<div class="cr hd"><span class="cl"></span><div class="co">原始</div><div class="ca">調整後</div></div>';
    /* 條件 */
    var all = (cr.fact.length && cr.what.length) ? [['實際資料', cr.fact], ['如果……', cr.what]] : [[null, cr.fact.concat(cr.what)]];
    var total = cr.fact.length + cr.what.length, shown = 0, cap = S.condAll ? 999 : 3;
    html += sec('條件');
    all.forEach(function (grp) {
      if (!grp[1].length) return;
      if (grp[0] && shown < cap) html += '<div class="cr sub"><span class="cl">' + grp[0] + '</span><div class="co"></div><div class="ca"></div></div>';
      grp[1].forEach(function (r) { if (shown++ < cap) html += G(r[0], r[1], r[2] + '<button type="button" class="rmc" data-rst="' + r[3] + '" aria-label="回復：' + r[0].replace(/<[^>]+>/g, '') + '">回復</button>', 'cond'); });
    });
    if (total > 3) html += '<div class="cr more"><button type="button" class="linkbtn" id="condAll">' + (S.condAll ? '收起' : '還有 ' + (total - 3) + ' 項 ›') + '</button><div class="co"></div><div class="ca"></div></div>';
    /* 結果：調整後那欄的退休時間 = 你選的年紀，沒選就是它自己的最快 */
    html += sec('結果');
    var e = c.e, ea = pv.ea, Ro = c.Rshow, Ra = c.Radj;
    var t0 = e === null ? '65 歲還不夠' : ageText(e) + '<small>' + ymText(e, true) + '（最快）</small>';
    var dt = function (x, y) { var dm = monthsBetween(y, x); return dm === 0 ? ['不變', ''] : dm > 0 ? ['↑ 早 ' + durStr(dm), 'good'] : ['↓ 晚 ' + durStr(-dm), 'bad']; };
    if (ret !== null) {
      var d0 = e !== null ? dt(e, ret) : ['', ''];
      d0 = [d0[0].replace(/^[↑↓] /, ''), ''];   /* 退休年紀是你自己選的，早晚都不算好壞，用中性色 */
      html += G('退休時間', '<b class="big' + (e === null ? ' warn' : '') + '">' + t0 + '</b>', '<b class="big">' + ageText(ret) + '<small>' + ymText(ret, true) + '（你選的）</small></b>', 'first', d0[0], d0[1]);
      if (adjOther()) {
        var t1 = ea === null ? ADJ_MAX + ' 歲還不夠' : ageText(ea), d1 = e !== null && ea !== null ? dt(e, ea) : ['', ''];
        html += G('最快可以', e === null ? '65 歲還不夠' : ageText(e), t1, '', d1[0], d1[1]);
      }
    } else {
      var t1b = ea === null ? ADJ_MAX + ' 歲還不夠' : ageText(ea) + '<small>' + ymText(ea, true) + (ea > 65 + 1e-9 ? '・超過 65 歲' : '') + '</small>';
      var d1b = e !== null && ea !== null ? dt(e, ea) : e === null && ea !== null ? ['↑ 變成算得出來', 'good'] : ['', ''];
      html += G('最快退休', '<b class="big' + (e === null ? ' warn' : '') + '">' + t0 + '</b>', '<b class="big">' + t1b + '</b>', 'first', d1b[0], d1b[1]);
    }
    var g0 = evalR(c.P, Ro), g1o = ret !== null ? pv.en.evalR(pv.Pa, Ra) : pv.en.evalR(pv.Pa, Ro);
    var pa = ret !== null ? g1o.proj : (ea !== null ? pv.en.evalR(pv.Pa, ea).proj : null);
    var na = ret !== null ? g1o.need : (ea !== null ? pv.en.evalR(pv.Pa, ea).need : null);
    html += G('需要有', fmtW(g0.need), na !== null ? fmtW(na) : '—', 'need');
    html += G('退休時會有', e !== null || ret !== null ? fmtW(g0.proj) : '—', pa !== null ? fmtW(pa) : '—');
    html += G('夠用到', EN0.E() + ' 歲', pv.en.E() + ' 歲');
    var Rb = ret !== null ? ret : ea;
    html += G('橋接期', e !== null && e < 60 - 1e-9 ? durStr(monthsBetween(e, 60)) : '沒有', Rb !== null && Rb < 60 - 1e-9 ? durStr(monthsBetween(Rb, 60)) : '沒有');
    var dg = (-g1o.gap) - (-g0.gap), lab = ret !== null ? '錢夠不夠' : '在 ' + ageText(Ro) + '退休';
    var need = g1o.gap > 0 && g1o.preExhaust === null ? fillGap(pv, ret !== null ? Ra : Ro) : null;
    html += G(lab, gapText(g0), gapText(g1o), need ? '' : 'last', Math.abs(dg) < 5000 ? '不變' : (dg > 0 ? '↑ 多 ' : '↓ 少 ') + fmtW(Math.abs(dg)), Math.abs(dg) < 5000 ? '' : dg > 0 ? 'good' : 'bad');
    if (need) html += G('要補上', '', need, 'last fill');
    /* 年齡上限的說法（v0.9.0）：原始那欄找最快退休只找到 65 歲，調整後那欄找到 80 歲；資產都算到 E 歲。出現「還不夠」時說清楚 */
    var short = e === null || (pv && pv.ea === null);
    html += '<div class="cmpnote">需要有：在那個時間退休，那天手上要有多少錢，才夠用到 ' + EN0.E() + ' 歲（今天的購買力）。' +
      (short ? '<br>「還不夠」的意思：原始那欄找最快退休只找到 65 歲，調整後那欄找到 ' + ADJ_MAX + ' 歲；兩邊的錢都算到 ' + EN0.E() + ' 歲。' : '') + '</div>';
    return html;
  }
  /* 你的錢會怎麼走：每年年底資產（今天的購買力）；有座標軸、退休時間的垂直線（原始灰、調整後藍）、用完的地方標紅 */
  /* 曲線的白話結論與文字摘要（v0.9.0）：rows＝逐年資產、R＝退休時間、proj＝退休時會有 */
  function curveWords(rows, R, proj) {
    var ex = rows.exhaust != null ? rows.exhaust : null, last = rows.length ? rows[rows.length - 1] : null, E = EN0.E();
    var min = null; rows.forEach(function (r) { if (r.a >= Math.floor(R) && (min === null || r.end < min.end)) min = r; });
    var bridge = R < 60 - 1e-9;
    var say = ex !== null ? '照這樣，資產會在 ' + ageText(ex) + '用完' + (bridge ? '；最吃緊的是 ' + Math.floor(R + 1e-9) + '～60 歲只靠資產的這段。' : '。')
      : bridge ? '退休後到 60 歲勞退開始前只靠資產，下降最快；之後年金補上，下降變慢。到 ' + E + ' 歲還剩 ' + fmtW(last ? last.end : 0) + '。'
      : '退休後年金補上大部分支出，資產慢慢下降；到 ' + E + ' 歲還剩 ' + fmtW(last ? last.end : 0) + '。';
    var aria = '現在 ' + fmtW(W(S.asset)) + '；' + ageText(R) + '退休時 ' + fmtW(proj) + '；' +
      (min ? '最低點 ' + min.a + ' 歲那一年 ' + (min.end < 0 ? '不足 ' + fmtW(-min.end) : fmtW(min.end)) + '；' : '') +
      (ex !== null ? '在 ' + ageText(ex) + '用完。' : '到 ' + E + ' 歲剩 ' + fmtW(last ? last.end : 0) + '。');
    return { say: say, aria: aria };
  }
  function curveHtml(c) {
    var base = ledger(c.P, c.Rshow), pv = c.pv ? c.pv.en.ledger(c.pv.Pa, c.Rdisp) : null;
    var all = base.concat(pv || []);
    var a0 = base.length ? base[0].a : 0, a1 = Math.max(base.length ? base[base.length - 1].a + 1 : 90, pv && pv.length ? pv[pv.length - 1].a + 1 : 0);
    var vmax = Math.max.apply(null, all.map(function (r) { return r.end; }).concat([1])), vmin = Math.min.apply(null, all.map(function (r) { return r.end; }).concat([0]));
    var L = 44, Rr = 8, T = 14, H = 170, Wd = 330, B = 22, w = Wd - L - Rr, top = vmax * 1.1, rng = top - vmin || 1;
    var X = function (age) { return L + ((age - a0) / Math.max(1, a1 - a0)) * w; }, Y = function (v) { return T + H - ((v - vmin) / rng) * H; };
    var line = function (rows) { return rows.map(function (r) { return X(r.a + 1).toFixed(1) + ',' + Y(r.end).toFixed(1); }).join(' '); };
    var g = '', step = Math.pow(10, Math.floor(Math.log10(Math.max(1, top / 3))));
    step = Math.ceil(top / 3 / step) * step;
    for (var v = 0; v <= top; v += step) g += '<line x1="' + L + '" x2="' + (L + w) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="cg"></line><text x="' + (L - 4) + '" y="' + (Y(v) + 3).toFixed(1) + '" class="ct ty">' + fmtW(v).replace(' 萬', '') + '</text>';
    for (var ag = Math.ceil(a0 / 10) * 10; ag <= a1; ag += 10) g += '<line x1="' + X(ag).toFixed(1) + '" x2="' + X(ag).toFixed(1) + '" y1="' + (T + H) + '" y2="' + (T + H + 4) + '" class="ca"></line><text x="' + X(ag).toFixed(1) + '" y="' + (T + H + 15) + '" class="ct tx">' + ag + '</text>';
    /* 座標軸 */
    g += '<line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (T + H) + '" class="ca"></line><line x1="' + L + '" x2="' + (L + w) + '" y1="' + Y(Math.max(0, vmin)).toFixed(1) + '" y2="' + Y(Math.max(0, vmin)).toFixed(1) + '" class="ca"></line>';
    if (vmin < 0) g += '<line x1="' + L + '" x2="' + (L + w) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="c0"></line>';
    g += '<text x="' + (L + w) + '" y="' + (T + H + B + 6) + '" class="ct tx" text-anchor="end">年齡</text><text x="2" y="' + (T - 4) + '" class="ct">萬</text>';
    /* 退休時間：垂直虛線 */
    var vline = function (R, cls, lab, dy) { return '<line x1="' + X(R).toFixed(1) + '" x2="' + X(R).toFixed(1) + '" y1="' + T + '" y2="' + (T + H) + '" class="cv ' + cls + '"></line><text x="' + Math.min(X(R) + 4, L + w - 70).toFixed(1) + '" y="' + (T + 10 + dy) + '" class="cl ' + cls + '">' + lab + '</text>'; };
    var marks = vline(c.Rshow, c.pv ? 'orig' : '', (c.pv ? '原始 ' : '') + ageText(c.Rshow) + '退休', 0);
    if (c.pv && !same(c.Rdisp, c.Rshow)) marks += vline(c.Rdisp, 'pv', '調整後 ' + ageText(c.Rdisp) + '退休', 14);
    /* 資產用完 */
    var exr = function (rows, cls) { var r = rows.filter(function (x) { return x.end < 0; })[0]; return r ? '<circle cx="' + X(r.a + 1).toFixed(1) + '" cy="' + Y(r.end).toFixed(1) + '" r="4" class="cx"></circle><text x="' + Math.min(X(r.a + 1) + 5, L + w - 50).toFixed(1) + '" y="' + (Y(r.end) - 6).toFixed(1) + '" class="cl bad">' + (cls ? cls + ' ' : '') + (r.a + 1) + ' 歲用完</text>' : ''; };
    var lines = pv ? '<polyline points="' + line(base) + '" class="cb dash"></polyline><polyline points="' + line(pv) + '" class="cp"></polyline>' + exr(base, '原始') + exr(pv, '調整後')
      : '<polyline points="' + line(base) + '" class="cb"></polyline>' + exr(base, '');
    var main = pv ? curveWords(pv, c.Rdisp, c.pv.en.evalR(c.pv.Pa, c.Rdisp).proj) : curveWords(base, c.Rshow, evalR(c.P, c.Rshow).proj);
    var aria = (pv ? '調整後：' : '') + main.aria + (pv ? '原始：' + curveWords(base, c.Rshow, evalR(c.P, c.Rshow).proj).aria : '');
    var svg = '<svg viewBox="0 0 ' + Wd + ' ' + (T + H + B + 10) + '" class="curve" role="img" aria-label="' + esc('資產隨年齡變化。' + aria) + '"><title>資產隨年齡變化（每年年底，今天的購買力）</title>' + g + marks + lines + '</svg>';
    return '<div class="card" id="curveCard"><h2>你的錢會怎麼走</h2><div class="csay" id="curveSay">' + (pv ? '調整後：' : '') + main.say + '</div><div class="muted" style="margin-top:2px">每年年底的資產，今天的購買力</div>' + svg +
      '<div class="clg">' + (pv ? '<span><i class="lg dash"></i>原始</span><span><i class="lg pv"></i>調整後</span>' : '<span><i class="lg"></i>你的資產</span>') + '</div></div>';
  }


  /* 提高準確度：哪些欄位改了但還沒套用 */
