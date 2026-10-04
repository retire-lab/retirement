/* src/app/70-pdf.js — 分享 PDF 報告
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* ================= 分享 PDF 報告（v0.7.0） =================
     沒有有效的修改 → 單一版本；有（調調看或還沒套用的實際資料）→ 原始 vs 調整後的對照。
     資料模型 reportModel() 直接從引擎與網頁現有的函式取值，PDF 產生器（pdfdoc.js）只負責排版。 */
  function ageOfYM(ym) { var p = EN0.parseYM(ym, 1900, 2100); return p ? Math.floor((EN0.NOWI - EN0.mi(p.y, p.mo)) / 12) : null; }
  function todayISO() { var d = new Date(), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function gapDetail(list) {
    var n = gapNorm(list); if (!n.length) return '沒有';
    var lab = {}; SP5Engine.GAP_SITS.forEach(function (g) { lab[g[0]] = g[1]; });
    return n.map(function (g) { return (lab[g.sit] || g.sit) + ' ' + durStr(g.y * 12 + g.m); }).join('；');
  }
  var RPT_PRE = [['liYears', '勞保年資'], ['w60', '平均月投保薪資'], ['liClaim', '勞保請領年齡'], ['liMode', '勞保怎麼領'], ['w36', '退保前 3 年平均月投保薪資'], ['liPre09', '2009 年前有勞保年資'], ['sex', '勞保登記的性別'], ['sameCo', '在目前這家公司保勞保幾年'],
    ['lsBal', '勞退專戶餘額'], ['lsWage', '勞退月提繳工資'], ['lsYears', '勞退提繳年資'], ['self', '勞退自提'], ['oldOn', '勞退舊制'], ['oHire', '勞退舊制到職年'], ['oYrs', '勞退舊制年資'], ['oWage', '勞退舊制平均工資'],
    ['gaps', '工作空窗'], ['nhiDep', '健保'], ['inf', '通膨'], ['dep', '存款利率']];
  var RPT_OPTIONAL = { w36: 1, liPre09: 1, sex: 1, sameCo: 1, oHire: 1, oYrs: 1, oWage: 1 };
  function condModel(cmp, eff) {
    var I = getInputs(), a = adjState(), fx = {};
    CMP_ROWS.forEach(function (x) { fx[x[0]] = x[1]; });
    var row = function (label, o, a2, extra) { var r = { label: label, o: o, a: a2 == null ? o : a2 }; r.changed = !!cmp && r.a !== r.o; if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; }); return r; };
    var bAge = ageOfYM(I.birth);
    var g1 = { title: '基本資料', rows: [row('出生年月', String(I.birth).replace('-', '/'), null, { anonLabel: '年齡', anonO: bAge + ' 歲', anonA: bAge + ' 歲' })] };
    [['幾歲開始工作', '幾歲開始工作'], ['名下資產', '名下可自由動用的錢'], ['每月實際入帳', '每月實際入帳'], ['每月基本生活費', '每月基本生活費']].forEach(function (x) { g1.rows.push(row(x[1], fx[x[0]](I))); });
    var kidsAnon = I.kidsOn ? I.kids.map(function (k, n) { return (I.kids.length > 1 ? '孩子 ' + (n + 1) + '：' : '') + ageOfYM(k.bym) + ' 歲・' + (PL[k.path] || ''); }).join('；') : '無';
    var g2 = { title: '以後會結束的支出', rows: [row('房貸', fx['房貸'](I)), row('車貸', fx['車貸'](I)), row('孩子', fx['子女'](I), null, { anonO: kidsAnon, anonA: kidsAnon }), row('孩子每年的費用', fx['子女每年費用'](I)), row('孝親費', fx['孝親費'](I))] };
    var g3 = { title: cmp ? '實際資料（提高準確度）' : '勞保、勞退、健保', rows: [] };
    RPT_PRE.forEach(function (x) {
      var k = x[0], ov = S.pre[k], av = eff[k];
      if (RPT_OPTIONAL[k] && !preNorm(k, ov) && !preNorm(k, av)) return;
      if ((k === 'oHire' || k === 'oYrs' || k === 'oWage') && !S.pre.oldOn && !eff.oldOn) return;
      if (k === 'gaps') g3.rows.push(row(x[1], gapDetail(ov), gapDetail(av), { anonO: gapStatus(ov), anonA: gapStatus(av), changedKey: k }));
      else g3.rows.push(row(x[1], preVal(k, ov), preVal(k, av)));
    });
    g3.rows.forEach(function (r) { if (r.changedKey === 'gaps') r.changed = !!cmp && preNorm('gaps', S.pre.gaps) !== preNorm('gaps', eff.gaps); });
    var out = [g1, g2, g3];
    if (cmp) {
      var wi = WI_STEPS.map(function (s2) { return row(s2[1], wiVal(s2[0], WI_NEUTRAL[s2[0]]).replace('（設定）', ''), wiVal(s2[0], a.wi[s2[0]]).replace('（設定）', '')); });
      out.push({ title: '如果……（調調看）', rows: [row('想在幾歲退休', '最快', a.ret !== null ? ageText(a.ret) : '最快'), row('每月花費', fmtW(W(S.spend)), fmtW(W(S.spend) + a.more)),
        row('每月多存', '不變', a.save ? (a.save > 0 ? '多存 ' : '少存 ') + yuan(a.save) : '不變'), row('活到', EN0.E() + ' 歲', (a.end !== null ? a.end : EN0.E()) + ' 歲')].concat(wi) });
    } else g3.rows.push(row('算到幾歲', EN0.E() + ' 歲'));
    return out;
  }
  function phasesForReport(en, P, R) {
    bindEngine(en);
    var Q = en.evalR(P, R).Q, pm = phaseModel(P, R, Q);
    var list = pm.list.map(function (x) {
      return { name: x.name, src: x.src, ages: x.ages, dur: x.dur, yms: x.yms, work: x.work || null, exText: x.exText,
        workText: x.work ? { a0: fmtW(x.work.a0), net: fmtW(Math.abs(x.work.net)), er: fmtW(Math.abs(x.work.er)), proj: fmtW(x.work.proj) } : null,
        moneyText: x.net < 0 ? '這段要從資產拿出 ' + fmtW(-x.net) : '這段收入大於支出，共多 ' + fmtW(x.net),
        events: x.events.map(function (e) { return { age: e.age, ym: e.ym, t: e.t, text: e.text, bad: !!e.bad, ret: !!e.ret }; }) };
    });
    bindEngine(EN0);
    return list;
  }
  function liModel(eff) {
    var inp = JSON.parse(JSON.stringify(getInputs())); inp.pre = JSON.parse(JSON.stringify(eff));
    var en = SP5Engine.create(inp); if (en.validate()) return null; en.sync();
    var P = en.profile(); if (en.liLumpElig(P).state !== 'yes') return null;
    var e = en.earliest(), c = en.liCompare(P, e !== null ? e : 65); if (c.elig !== 'yes' || c.none) return null;
    var k = c.monthly.kind;
    return { lumpTitle: '一次領', lumpLines: [ageText(c.lump.age) + '領 ' + fmtW(c.lump.amt), (Math.round(c.lump.months * 100) / 100) + ' 個月 × ' + (c.lump.w36 != null ? '退保前 3 年平均' : '平均月投保薪資') + '；之後不能保國保'],
      monTitle: k === 'onetime' ? '老年一次金' : k === 'combined' ? '月領（併計國保）' : '月領',
      monLines: [k === 'onetime' ? ageText(c.monthly.age) + '領 ' + fmtW(c.monthly.oneAmt) : ageText(c.monthly.age) + '起每月 ' + fmtW(c.monthly.amt), c.monthly.npMonths ? '退休到開始領之前繳國保；65 歲起國保每月 ' + fmtW(c.monthly.npMonthly) : '不用繳國保'],
      sentence: liSentence(c), note: c.lump.w36 != null ? '一次領用你填的退保前 3 年平均月投保薪資。' : '一次領法定用退保前 3 年的平均投保薪資，這裡以平均月投保薪資估算。' };
  }
  function reportModel() {
    var X = C.ctx; if (!X) return null;
    bindEngine(EN0);
    var P = X.P, pv = X.pv, cmp = !!pv, dc = draftCheck(), eff = dc.eff;
    C.preEst = preEstimates(P);
    var M = { meta: { version: EN0.VERSION, date: todayISO(), name: active() ? active().name : '我的方案', dirty: isDirty(), compare: cmp, pendingN: dc.ok.length, adjN: adjLabels().length, E: EN0.E(), fontNote: window.SP5_FONT_NAME || '' },
      scope: htmlLines($('scopeNote').innerHTML), assumptions: assumptionsList(EN0.rates()), conditions: condModel(cmp, eff) };
    if (cmp) {
      var sink = [], inRes = false; compareHtml(X.c, sink);
      M.results = { rows: sink.filter(function (r) { if (r.sec) { inRes = r.sec === '結果'; return false; } return inRes && r.label; }) };
    } else {
      var e = X.e, ev = evalR(P, X.Rorig);
      M.results = { rows: [{ label: '最快退休', v: e !== null ? [ageText(e), ymText(e)] : ['65 歲還不夠'], big: true }, { label: '需要有', v: [fmtW(ev.need)] }, { label: '退休時會有', v: [fmtW(ev.proj)] },
        { label: '夠用到', v: [EN0.E() + ' 歲'] }, { label: '橋接期', v: [e !== null && e < 60 - 1e-9 ? durStr(monthsBetween(e, 60)) : '沒有'] }, { label: '錢夠不夠', v: [gapText(ev)] }],
        notes: htmlBlocks(C.heroHtml).filter(function (l) { return /。$/.test(l); }) };
    }
    var lo = ledger(P, X.Rorig);
    M.curve = { orig: lo.map(function (r) { return [r.a + 1, Math.round(r.end)]; }), Ro: X.Rorig, RoText: ageText(X.Rorig), exO: lo.exhaust, exOText: lo.exhaust != null ? ageText(lo.exhaust) : '' };
    if (cmp) { var la = pv.en.ledger(pv.Pa, X.Radj); M.curve.adj = la.map(function (r) { return [r.a + 1, Math.round(r.end)]; }); M.curve.Ra = X.Radj; M.curve.RaText = ageText(X.Radj); M.curve.exA = la.exhaust; M.curve.exAText = la.exhaust != null ? pv.en.ageText(la.exhaust) : ''; }
    M.phases = { orig: phasesForReport(EN0, P, X.Rorig), origSub: '以 ' + ageText(X.Rorig) + '退休' };
    if (cmp) { M.phases.adj = phasesForReport(pv.en, pv.Pa, X.Radj); M.phases.adjSub = '以 ' + ageText(X.Radj) + '退休'; }
    M.li = liModel(eff);
    return M;
  }
  function pdfFileName(M, anon) { return '退休試算_' + (anon ? '分享版' : '完整版') + (M.meta.compare ? '_對照' : '') + '_' + M.meta.date + '.pdf'; }

  /* ---- 載入 PDF 程式庫與字型：按下產生才載；字型存在瀏覽器（Cache Storage），第二次就不用再下載 ---- */
  var PDFA = window.SP5_PDF_ASSETS || { lib: 'vendor/pdfmake.min.js', font: 'fonts/kai-subset.ttf', fontBytes: 0, fontVer: 'dev' };
  function pdfLoadLib() {
    if (window.pdfMake && window.pdfMake.createPdf) return Promise.resolve();
    var inl = window.SP5_PDF_INLINE;
    return new Promise(function (res, rej) {
      var sc = document.createElement('script');
      if (inl && inl.lib) { sc.text = inl.lib; document.head.appendChild(sc); return window.pdfMake ? res() : rej(new Error('PDF 程式庫載入失敗')); }
      sc.src = PDFA.lib; sc.onload = function () { res(); }; sc.onerror = function () { rej(new Error('PDF 程式庫下載失敗，請檢查網路後再試一次')); };
      document.head.appendChild(sc);
    });
  }
  function abToB64(ab) { var u = new Uint8Array(ab), out = '', CH = 0x8000; for (var i = 0; i < u.length; i += CH) out += String.fromCharCode.apply(null, u.subarray(i, i + CH)); return btoa(out); }
  function pdfLoadFont(onp) {
    if (pdfLoadFont.b64) return Promise.resolve(pdfLoadFont.b64);
    var inl = window.SP5_PDF_INLINE; if (inl && inl.font) return Promise.resolve(pdfLoadFont.b64 = inl.font);
    var url = PDFA.font, cn = 'sp5-font-' + PDFA.fontVer, hasCache = typeof caches !== 'undefined';
    var cached = hasCache ? caches.open(cn).then(function (cc) { return cc.match(url); }).then(function (r) { return r ? r.arrayBuffer() : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return cached.then(function (ab) {
      if (ab) return ab;
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('字型下載失敗（' + r.status + '），請檢查網路後再試一次');
        var total = +r.headers.get('content-length') || PDFA.fontBytes || 0;
        if (!r.body || !r.body.getReader) return r.arrayBuffer();
        var rd = r.body.getReader(), got = 0, parts = [];
        var pump = function () { return rd.read().then(function (x) { if (x.done) return; parts.push(x.value); got += x.value.length; if (onp) onp(got, total); return pump(); }); };
        return pump().then(function () { var buf = new Uint8Array(got), o = 0; parts.forEach(function (p2) { buf.set(p2, o); o += p2.length; }); return buf.buffer; });
      }).then(function (ab2) { if (hasCache) caches.open(cn).then(function (cc) { return cc.put(url, new Response(ab2.slice(0))); }).catch(function () {}); return ab2; });
    }).then(function (ab3) { return (pdfLoadFont.b64 = abToB64(ab3)); });
  }
  function makePdf(M, opts, onp) {
    return pdfLoadLib().then(function () { if (onp) onp('font', 0, PDFA.fontBytes); return pdfLoadFont(function (g, t) { if (onp) onp('font', g, t); }); }).then(function (f64) {
      if (onp) onp('build');
      window.pdfMake.vfs = window.pdfMake.vfs || {}; window.pdfMake.vfs['kai.ttf'] = f64;
      window.pdfMake.fonts = { Kai: { normal: 'kai.ttf', bold: 'kai.ttf', italics: 'kai.ttf', bolditalics: 'kai.ttf' } };
      var dd = SP5PdfDoc.build(M, Object.assign({ coverage: window.SP5_FONT_CHARS || '' }, opts));
      makePdf.last = dd;
      return new Promise(function (res, rej) { try { window.pdfMake.createPdf(dd).getBlob(function (b) { res(b); }); } catch (err) { rej(err); } });
    });
  }
  function deliverPdf(blob, name) { return deliverFile(blob, name, 'application/pdf'); }
  /* 交出檔案：手機用系統分享選單，電腦直接下載（PDF 與方案備份共用） */
  function deliverFile(blob, name, type) {
    var file = null; try { file = new File([blob], name, { type: type }); } catch (e) { file = null; }
    var dl = function () { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000); return 'download'; };
    if (/iPhone|iPad|Android/i.test(navigator.userAgent) && file && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: name }).then(function () { return 'share'; }, dl);
    return Promise.resolve(dl());
  }
  var PDF_ANON_LIST = '<div class="pdfanon" id="pdfAnonList"><b>會拿掉：</b><ul><li>出生年月 → 改寫成年齡</li><li>所有年月 → 只留年齡<span>年齡加上年月就能反推出生日，所以一起拿掉</span></li><li>孩子的出生年月 → 改寫成年齡</li><li>工作空窗的原因 → 只寫幾段、多久</li><li>方案名稱</li></ul><b>會保留：</b>資產、收入、支出、房貸、學費等數字，看的人才知道結果怎麼算出來。</div>';
  function openShare() {
    var X = C.ctx; if (!X) return;
    var cmp = !!X.pv, pendN = X.dc ? X.dc.ok.length : 0, v = 'full';
    try { v = localStorage.getItem('sp5:pdfv') === 'anon' ? 'anon' : 'full'; } catch (e) { v = 'full'; }
    var a = active(), mb = (PDFA.fontBytes / 1048576).toFixed(1);
    var info = '<div class="pdfinfo">這份報告會包含：<b>' + (cmp ? '原始 vs 調整後的對照' : '目前的結果') + '</b>' +
      (cmp && pendN ? '<br>你有 ' + pendN + ' 項實際資料還沒套用，會以「還沒套用」標示。' : '') +
      (isDirty() ? '<br>「' + esc(a ? a.name : '') + '」有未存檔的修改，報告會用畫面上的數字，並標示「未存檔」。' : '') + '</div>' +
      (cmp ? '<div class="muted" style="margin-top:4px">只想分享調整後的版本？先按「存成新方案」，再從新方案分享。</div>' : '');
    var opt = function (val, t, sub) { return '<label class="pdfopt"><input type="radio" name="pdfv" value="' + val + '"' + (v === val ? ' checked' : '') + '><span><b>' + t + '</b><small>' + sub + '</small></span></label>'; };
    var body = info + '<div class="f" style="margin-top:12px">要給誰看</div>' + opt('full', '完整版', '自己留存。包含你填的所有資料。') + opt('anon', '分享版', '給理專、家人看。拿掉出生年月等個資，但財務數字會保留，熟悉你的人可能從數字猜出是你。') +
      PDF_ANON_LIST.replace('id="pdfAnonList"', 'id="pdfAnonList"' + (v === 'anon' ? '' : ' hidden')) +
      '<div class="pdfpw"><div class="f">密碼</div><label class="check"><input type="checkbox" id="pdfPwOn" checked><span>加密碼保護（建議）</span></label>' +
      '<div id="pdfPwBox"><label class="f" for="pdfP1">設定密碼</label><input id="pdfP1" type="password" autocomplete="new-password"><label class="f" for="pdfP2" style="margin-top:6px">再輸入一次</label><input id="pdfP2" type="password" autocomplete="new-password">' +
      '<div class="pdfwarn">至少 8 個字。忘記密碼就打不開，我們沒辦法幫你找回。</div></div><div class="pdfwarn2" id="pdfNoPw" hidden>不加密碼：任何人拿到這個檔案都能打開。</div></div>' +
      '<div class="err" id="pdfErr" hidden></div>' +
      '<div class="muted" style="margin-top:10px;font-size:12px">' + (pdfLoadFont.b64 ? '' : '第一次產生需要下載楷書字型（約 ' + mb + ' MB），之後就很快。') + '字型：' + esc(window.SP5_FONT_NAME || '') + '。資料只在這台裝置上處理，不會上傳。</div>';
    modal('分享 PDF 報告', body, [{ label: '取消', fn: function () {} }, { label: '產生 PDF', cls: 'primary', fn: function () { return startPdf(); } }]);
  }
  function pdfShowErr(m) { var e = $('pdfErr'); if (e) { e.textContent = m; e.hidden = !m; } }
  function startPdf() {
    var anon = !!document.querySelector('input[name="pdfv"][value="anon"]:checked'), pwOn = $('pdfPwOn') && $('pdfPwOn').checked;
    var p1 = pwOn ? $('pdfP1').value : '', p2 = pwOn ? $('pdfP2').value : '';
    if (pwOn && !p1) { pdfShowErr('請設定密碼，或取消勾選「加密碼保護」。'); return false; }
    if (pwOn && p1.length < 8) { pdfShowErr('密碼至少 8 個字。'); return false; }   /* pdfkit 的 AES-256 是 R5（密碼驗證較弱），用長度補強 */
    if (pwOn && p1 !== p2) { pdfShowErr('兩次輸入的密碼不一樣。'); return false; }
    try { localStorage.setItem('sp5:pdfv', anon ? 'anon' : 'full'); } catch (e) {}
    var M = reportModel(); if (!M) { pdfShowErr('還沒有結果，請先算出結果。'); return false; }
    var name = pdfFileName(M, anon), token = (startPdf.tok = (startPdf.tok || 0) + 1);
    modal('正在產生 PDF…', '<div class="pbar"><i id="pdfBar" style="width:5%"></i></div><div class="muted" id="pdfStat">準備中…</div><div class="muted">資料只在這台裝置上處理，不會上傳。</div>', [{ label: '取消', fn: function () { startPdf.tok++; } }]);
    var stat = function (t, w) { var s2 = $('pdfStat'), b = $('pdfBar'); if (s2) s2.textContent = t; if (b && w != null) b.style.width = w + '%'; };
    makePdf(M, { anon: anon, password: pwOn ? p1 : '' }, function (k, g, t) {
      if (k === 'font' && t) stat('第一次使用：下載字型 ' + (g / 1048576).toFixed(1) + ' / ' + (t / 1048576).toFixed(1) + ' MB', 5 + Math.round(80 * g / t));
      else if (k === 'build') stat('排版中…', 92);
    }).then(function (blob) {
      if (token !== startPdf.tok) return;
      stat('完成', 100);
      return deliverPdf(blob, name).then(function () { closeModal(); toast('已產生 PDF：' + name + (pwOn ? '。密碼請自己記好，我們沒辦法幫你找回。' : '')); });
    }).catch(function (err) {
      if (token !== startPdf.tok) return;
      modal('沒辦法產生 PDF', '<div class="err">' + esc(err && err.message ? err.message : String(err)) + '</div><div class="muted" style="margin-top:6px">資料沒有上傳，也沒有遺失。可以再試一次。</div>', [{ label: '關閉', fn: function () {} }]);
    });
    return false;
  }
  window.SP5App = { reportModel: reportModel, pdfFileName: pdfFileName, makePdf: makePdf, draftCheck: draftCheck, importFile: function (f) { return importFile(f); }, importText: function (t, n) { return importText(t, n); } };

