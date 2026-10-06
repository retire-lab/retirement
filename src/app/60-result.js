/* src/app/60-result.js — 結果頁
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* v1.0.2：結果旁邊的說明。有填養老預備金：已保留多少、不留的話可以早多久；沒填：剛好夠的最低門檻，不是建議 */
  function floorNote(en, P, e) {
    if (P.floor > 0) {
      var e0 = en.earliest({ noReserve: true }), d = e0 === null ? 0 : Math.round((e - e0) * 12);
      return '<div class="floor"><b>已保留 ' + fmtW(P.floor) + '養老預備金</b>：退休後，存款任何時候都至少有 ' + fmtW(P.floor) + '。' + (d > 0 ? '<b>不留的話，可以早 ' + durStr(d) + '。</b>' : '') + '</div>';
    }
    return '<div class="floor">這是<b>剛好夠的最低門檻</b>，不是建議的退休年齡：照這個時間退休，錢剛好用到 ' + en.E() + ' 歲，幾乎沒有緩衝。想留緩衝，可以填「退休後想隨時留多少預備金」，或在「調調看」多存一點。</div>';
  }
  function paintResult() {
    if (!S.preDraft) S.preDraft = JSON.parse(JSON.stringify(S.pre));
    bindEngine(EN0); EN.sync();
    var P = profile(), e = earliest(), from = EN.fromAge(), Rshow = e === null ? 65 : e, ev0 = evalR(P, Rshow);
    var a = adjState(), pv = null, dc = draftCheck(), pend = dc.ok, adjOn = adjActive(), draftErr = '';   /* 填錯的項目不算修改，也不會讓對照表消失 */
    if (adjOn || pend.length) {
      var inp = getInputs();   /* 只選了退休年紀也走這裡：調整後那欄＝原始條件、在你選的年紀退休 */
      if (pend.length) { inp = JSON.parse(JSON.stringify(inp)); inp.pre = JSON.parse(JSON.stringify(dc.eff)); }
      if (!draftErr) {
        var sc = SP5Engine.scenario(inp, adjSel(), { now: { y: EN0.NOW, m: EN0.NOWI % 12 + 1 }, maxAge: ADJ_MAX });
        pv = { en: sc.en, Pa: sc.en.profile(sc.adj), ea: sc.e, adj: sc.adj };
      }
    }
    /* 調整後那欄的退休時間：你選的年紀，沒選就是它自己的最快；原始那欄永遠是原始的最快 */
    var tab = pv ? (S.mapTab || 'adj') : 'orig';
    var Rorig = Rshow; C.Rorig = Rorig; var Radj = a.ret !== null ? a.ret : pv ? (pv.ea !== null ? pv.ea : Rshow) : Rshow;
    C.Radj = Radj;
    var Rdisp = tab === 'adj' ? Radj : Rorig;
    var c = { e: e, P: P, from: from, Rshow: Rorig, pv: pv, Rdisp: Radj, Radj: Radj, Rm: Rorig };
    C.ctx = { c: c, P: P, e: e, Rorig: Rorig, Radj: Radj, pv: pv, dc: dc, adjOn: adjOn };

    /* ---- 答案：時間＋錢 ---- */
    var head, eH = e, enH = EN0, PH = P, capH = LAW.maxR;
    var evH = eH !== null ? enH.evalR(PH, eH) : enH.evalR(PH, Math.min(capH, 65));
    var lab = '照現在這樣，最快約';
    if (e === null && ev0.preExhaust !== null) head = '<div class="rl">照現在這樣</div><div class="age warn">還沒退休錢就用完</div><div class="rs">照目前的收支，資產會在 <b>' + ageText(ev0.preExhaust) + '（' + ymText(ev0.preExhaust, true) + '）</b>用完，那時候還沒退休。要先讓每個月的收入大於支出，退休才算得下去。</div>';
    else if (eH === null) head = '<div class="rl">照現在這樣</div><div class="age warn">' + capH + ' 歲還不夠</div>' + '<div class="rs">' + LAW.maxR + ' 歲退休，需要 <b>' + fmtW(ev0.need) + '</b>，你會有 <b>' + fmtW(ev0.proj) + '</b>，還差 <b>' + fmtW(ev0.gap) + '</b>' + (exhaustAge(P, LAW.maxR) !== null ? '；資產會在 ' + ageText(exhaustAge(P, LAW.maxR)) + '（' + ymText(exhaustAge(P, LAW.maxR), true) + '）用完' : '') + '。</div>';
    else {
      var m = yearsMonthsUntil(eH);
      head = '<div class="rl">' + lab + '</div><div class="age">' + ageText(eH) + '<span class="agey">' + ymText(eH) + '</span>' + (eH > LAW.maxR + 1e-9 ? '<em class="over">超過 ' + LAW.maxR + ' 歲</em>' : '') + '</div>' +
        '<div class="rs">' + (m > 0 ? '約 <b>' + durStr(m) + '</b>後' : '你現在就已經達到退休門檻') + (m > 0 && eH < LAW.maxR - 1e-9 ? '，比 ' + LAW.maxR + ' 歲早 ' + durStr(monthsBetween(eH, LAW.maxR)) + '。' : '。') + '</div>' +
        '<div class="rs2">那時候退休，需要 <b>' + fmtW(evH.need) + '</b>，你會有 <b>' + fmtW(evH.proj) + '</b>，夠用到 ' + enH.E() + ' 歲。</div>' +
        (bridgeText(eH) ? '<div class="hbr">' + bridgeText(eH) + '</div>' : '');
    }
    C.heroHtml = head;
    if (S.delta) {
      var db = S.delta.before, da = S.delta.after, dl;
      if (db === da) dl = ['same', '跟剛才一樣'];
      else if (db !== null && da !== null) { var dm = monthsBetween(da, db); dl = dm > 0 ? ['ok', '↑ 比剛才早 ' + durStr(dm) + '（剛才是 ' + ageText(db) + '）'] : ['short', '↓ 比剛才晚 ' + durStr(-dm) + '（剛才是 ' + ageText(db) + '）']; }
      else if (da === null) dl = ['short', '↓ 變成 ' + LAW.maxR + ' 歲還不夠（剛才是 ' + ageText(db) + '）'];
      else dl = ['ok', '↑ 變成可以在 ' + ageText(da) + '退休（剛才是 ' + LAW.maxR + ' 歲還不夠）'];
      head += '<div class="hdelta ' + dl[0] + '">' + dl[1] + '</div>';
      if (S.delta.Rb != null) { var gB = S.delta.gb, gA = evalR(P, S.delta.Rb); head += '<div class="hdelta same">在 ' + ageText(S.delta.Rb) + '退休：' + gB + ' → ' + gapText(gA) + '</div>'; }
    }
    var l = estList(P), rt = EN0.rates();
    /* 假設：結果卡底下一行灰字，點了打開提高準確度（最上面就是基本假設） */
    var dck = dataCheck();
    var note = '<div class="assume">不靠投資・存款 ' + pct2(rt.dep) + '（' + depSrc() + '）・通膨 ' + pct(rt.inf) + '・算到 ' + EN0.E() + ' 歲・只算你自己那一份・制度資料核對 ' + dck.date + '</div>' +
      (dck.stale ? '<div class="hwarn" role="alert">制度資料已經超過一年沒有核對（上次 ' + dck.date + '），結果可能跟最新的規定不同。</div>' : '');
    var oldHint = EN0.mayHaveOld() && !S.pre.oldOn;

    /* ---- 唯一的色塊：想再早一年（可一鍵套用） ---- */
    var hook = '';
    {
      var tR = e === null ? 65 : e - 1;
      if (tR >= from - 1e-9) {
        var evt = evalR(P, tR), X = Math.round((tR - P.A0y) * 12) > 0 ? solve(tR, 'extra') : null, Y = solve(tR, 'cut', P.base * 12);
        var xm = X !== null ? Math.ceil(X / 12 / 100) * 100 : null, ym = Y !== null ? Math.ceil(Y / 12 / 100) * 100 : null;
        var xOk = xm !== null && xm <= P.inc, yOk = ym !== null;
        hook = '<div class="hook"><div class="hk">' + (e === null ? '要在 ' + LAW.maxR + ' 歲退休' : '想再早一年，' + ageText(tR) + '（' + ymText(tR, true) + '）退休') + '，原始還差 <b>' + fmtW(evt.gap) + '</b></div>' +
          '<div>' + (xOk ? '每月多存 <b>' + fmtW(xm) + '</b>' : '') + (xOk && yOk ? '，或' : '') + (yOk ? '每月少花 <b>' + fmtW(ym) + '</b>' : '') + (!xOk && !yOk ? '單靠多存或少花都補不上' : '') + '</div>' +
          '<div class="hkbtns">' + (xOk ? '<button type="button" class="linkbtn" data-apply="save:' + xm + '">套用看看：多存 ' + fmtW(xm) + '</button>' : '') +
          (yOk ? '<button type="button" class="linkbtn" data-apply="more:-' + ym + '">套用看看：少花 ' + fmtW(ym) + '</button>' : '') + '</div></div>';
      } else hook = '<div class="hook"><div class="hk">現在就退休，到 ' + EN0.E() + ' 歲還多出 <b>' + fmtW(-ev0.gap) + '</b></div></div>';
    }
    var pvbar = '';
    if (adjOn || pend.length) {
      var mode = adjOn && pend.length ? 'mix' : adjOn ? 'adj' : 'fact';
      var lab2 = mode === 'mix' ? '實際資料還沒套用・調調看中' : mode === 'adj' ? '調調看中' : '實際資料還沒套用';
      var btns = mode === 'fact' ? '<button type="button" id="precCancel">取消</button><button type="button" class="primary" id="applyPre3">設為新的原始</button>'
        : '<button type="button" id="cmpReset">回到原始</button><button type="button" class="primary" id="saveNew">存成新方案</button>';
      pvbar = '<div class="pvbar" role="status"><b>' + lab2 + '</b>' + btns + '</div>';
    }

    /* ---- 地圖：跟著調整一起變（預覽時切到情境引擎畫） ---- */
    /* 對照時同時算原始與調整後的階段：上下兩條色條；清單跟著頁籤（v0.9.0） */
    var mapBody = null, pmO = phaseModel(P, Rorig, evalR(P, Rorig).Q), pmA = null;
    if (pv) { bindEngine(pv.en); pmA = phaseModel(pv.Pa, Radj, pv.en.evalR(pv.Pa, Radj).Q); if (tab === 'adj') mapBody = timelineHtml(pv.Pa, Radj, null, pmA); bindEngine(EN0); }
    if (mapBody === null) mapBody = timelineHtml(P, Rorig, null, pmO);
    var strips = pv ? stripHtml(pmO, '原始・' + ageText(Rorig) + '退休', true) + stripHtml(pmA, '調整後・' + ageText(Radj) + '退休', false) : stripHtml(pmO, null, false);
    var mtabs = pv ? '<div class="mtabs" role="group" aria-label="地圖版本"><button type="button" data-mtab="orig" aria-pressed="' + (tab === 'orig') + '">原始</button><button type="button" data-mtab="adj" aria-pressed="' + (tab === 'adj') + '">調整後</button></div>' : '';

    /* 詳細說明（收起）：想再早一年、假設、舊制提醒；下面已有調調看與提高準確度，手機上省空間 */
    c.hook = hook;
    if (!pv && e === null && ev0.preExhaust === null) {
      var X65 = solve(65, 'extra'), Y65 = solve(65, 'cut', P.base * 12);
      var x65 = X65 !== null ? Math.ceil(X65 / 12 / 100) * 100 : null, y65 = Y65 !== null ? Math.ceil(Y65 / 12 / 100) * 100 : null;
      if (x65 !== null && x65 > P.inc) x65 = null;
      head += '<div class="fill65">要在 ' + LAW.maxR + ' 歲退休：' + (x65 !== null ? '每月多存 <b>' + fmtW(x65) + '</b>' : '') + (x65 !== null && y65 !== null ? '，或' : '') + (y65 !== null ? '每月少花 <b>' + fmtW(y65) + '</b>' : '') + (x65 === null && y65 === null ? '單靠多存或少花補不上' : '') +
        '<span class="fillb">' + (x65 !== null ? '<button type="button" class="linkbtn" data-apply="save:' + x65 + '">套用多存</button>' : '') + (y65 !== null ? '<button type="button" class="linkbtn" data-apply="more:-' + y65 + '">套用少花</button>' : '') + '</span></div>';
    }
    /* 調調看、提高準確度：並排兩個按鈕，一次打開一個 */
    var est = l.length;
    var twin = '<div class="twin">' +
      '<button type="button" id="tgAdj" aria-expanded="' + (S.panel === 'adj') + '" aria-controls="panelAdj"><b>調調看</b><span>' + (adjOn ? '已調整' : '如果多存、少花、活多久') + '</span></button>' +
      '<button type="button" id="tgPrec" aria-expanded="' + (S.panel === 'prec') + '" aria-controls="panelPrec"><b>提高準確度</b><span>' + (Object.keys(dc.bad).length ? '<em class="oldtag" style="color:var(--bad)">' + Object.keys(dc.bad).length + ' 項有錯</em>' + (pend.length ? '・' : '') : '') + (pend.length ? pend.length + ' 項還沒套用' : Object.keys(dc.bad).length ? '' : (est ? est + ' 項是估算的' : '補上實際資料') + (oldHint ? '・<em class="oldtag">可能有勞退舊制</em>' : '')) + '</span></button></div>';
    var oldBox = oldHint ? '<div class="holdhint">你 ' + LAW.lsStart[0] + ' 年 ' + (+LAW.lsStart[1]) + ' 月以前就在工作，如果到現在都沒換過公司，可能有勞退舊制年資。<button type="button" class="linkbtn inl" id="goOld">填寫 ›</button></div>' : '';
    var panel = S.panel === 'adj' ? '<div class="card tpanel" id="panelAdj">' + adjCardHtml(c) + '</div>' : S.panel === 'prec' ? '<div class="card tpanel" id="panelPrec">' + oldBox + precHtml(P) + '</div>' : '';
    $('result').innerHTML =
      '<div class="top"><button type="button" class="linkbtn" id="back">‹ 修改答案</button><span class="muted">v' + EN0.VERSION + '</span></div>' + scBarHtml() + pvbar +
      (pv ? '<div class="card cmpcard">' + compareHtml(c) + note + '</div>' : '<div class="card hero">' + head + (eH !== null ? floorNote(enH, PH, eH) : '') + note + '</div>') +
      twin + panel + curveHtml(c) +
      '<div class="card" id="mapCard"><h2>每個階段的收支</h2><div class="muted" style="margin-top:2px">' + (pv ? '上下兩條色條對照原始與調整後。' : '') + '色條的長度依時間長短；點下面每一段看發生的事。金額都是今天的購買力。</div>' +
        strips + phaseLegend() + mtabs + '<div class="muted" style="margin-top:8px">' + (pv ? (tab === 'adj' ? '調整後：' : '原始：') : '') + '以 ' + ageText(Rdisp) + '（' + ymText(Rdisp, true) + '）退休來看</div>' + mapBody + '</div>' +

      '<div class="disc"><b>假設</b><ul>' + assumptionsList(rt).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
    refreshPending(); markFieldErrors(dc.bad);
    if (S.adjEdit) { var ev = $('ed-val'); if (ev) ev.focus(); }
  }


