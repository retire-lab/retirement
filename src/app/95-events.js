/* src/app/95-events.js — 所有事件、啟動
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* ================= events ================= */
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.dataset.pre) { if (t.type !== 'checkbox') S.preDraft[t.dataset.pre] = t.value; refreshPending(); return; }
    if (t.dataset.gapy != null) { S.preDraft.gaps[+t.dataset.gapy].y = t.value; refreshPending(); return; }
    if (t.dataset.gapm != null) { S.preDraft.gaps[+t.dataset.gapm].m = t.value; refreshPending(); return; }
    if (t.dataset.k) { S[t.dataset.k] = t.value; if (t.dataset.k === 'birth') paintAge(); showErr(''); paintAccum(); if (/^house/.test(t.dataset.k) || t.dataset.k === 'birth') paintPrepay(); }
    else if (t.dataset.kidby != null) { var i = +t.dataset.kidby; S.kids[i].bym = t.value; paintKid(i); showErr(''); paintAccum(); }
    else if (t.dataset.group) { var kk = S.kids[+t.dataset.kid]; kk.costs[t.dataset.group] = t.value; if (kk.copied) delete kk.copied[t.dataset.group]; var cp = t.parentNode.parentNode.querySelector('.cp'); if (cp) cp.remove(); showErr(''); paintAccum(); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset.kidpath != null) { var i = +t.dataset.kidpath; S.kids[i].path = t.value; paintKid(i); paintAccum(); }
    else if (t.name === 'parMode') { S.parMode = t.value; showErr(''); if (t.value === 'yrs') $('parYrs').focus(); }
    else if (t.id === 'housePre') { S.housePre = t.checked; $('sec-housePre').hidden = !t.checked; showErr(''); paintPrepay(); }
    else if (t.id === 'impFile') { var fl = t.files && t.files[0]; importFile(fl).then(function () { t.value = ''; }); }
    else if (t.dataset.imp != null) { impCount(); }
    else if (t.id === 'bkPwOn') { $('bkPwBox').hidden = !t.checked; $('bkNoPw').hidden = t.checked; bkShowErr(''); }
    else if (t.name === 'pdfv') { var al = $('pdfAnonList'); if (al) al.hidden = t.value !== 'anon'; }
    else if (t.id === 'pdfPwOn') { $('pdfPwBox').hidden = !t.checked; $('pdfNoPw').hidden = t.checked; pdfShowErr(''); }
    else if (t.dataset.pre) { S.preDraft[t.dataset.pre] = t.type === 'checkbox' ? t.checked : t.value; repaintKeep(); }
    else if (t.dataset.gapsit != null) { S.preDraft.gaps[+t.dataset.gapsit].sit = t.value; repaintKeep(); }
    else if (t.dataset.gapy != null || t.dataset.gapm != null) { repaintKeep(); }
    else if (t.matches && t.matches('#panelPrec input[type=text]')) { repaintKeep(); }
  });
  document.addEventListener('toggle', function (ev) {
    var k = ev.target.dataset && ev.target.dataset.pf; if (k) { S.pf = S.pf || {}; S.pf[k] = ev.target.open; }
    if (ev.target.dataset && ev.target.dataset.ag) { S.agClosed = S.agClosed || {}; S.agClosed[ev.target.dataset.ag] = !ev.target.open; }
  }, true);
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.chip) { var k = b.dataset.chip; S[k] = !S[k]; b.setAttribute('aria-pressed', S[k] ? 'true' : 'false'); $('sec-' + k).hidden = !S[k]; showErr(''); paintAccum(); }
    else if (b.dataset.same) {
      var sp = b.dataset.same.split(':'), kd = S.kids[+sp[0]], v = kd.costs[sp[2]] || '';
      kd.costs[sp[1]] = v; if (kd.copied) delete kd.copied[sp[1]];
      var inp = $('k' + sp[0] + sp[1]); if (inp) { inp.value = v; var cp0 = inp.parentNode.parentNode.querySelector('.cp'); if (cp0) cp0.remove(); }
      showErr(''); paintAccum();
    }
    else if (b.id === 'addKid') { if (S.kids.length < 6) { S.kids.push({ bym: '', path: S.kids[0] ? S.kids[0].path : 'grad', costs: {} }); paintKids(); $('kby' + (S.kids.length - 1)).focus(); } }
    else if (b.dataset.delkid != null) { S.kids.splice(+b.dataset.delkid, 1); if (!S.kids.length) S.kids.push({ bym: '', path: 'grad', costs: {} }); paintKids(); paintAccum(); }
    else if (b.id === 'go') { var e = validate(); if (e) { showErr(e); return; } S.ledger = false; S.phase = null; S.delta = null; adjReset(); S.panel = null;
      if (!DB.list.length) { var id = newId(); DB.list.push({ id: id, name: '我的第一個方案', saved: getInputs(), updated: nowStr() }); DB.active = id; if (saveDB()) toast('已建立「我的第一個方案」，存在這台裝置'); }
      paintResult(); show('result'); }
    else if (b.id === 'back') { show('quick'); }
    else if (b.dataset.phase != null) { var pi = +b.dataset.phase; S.phase = S.phase === pi ? null : pi; S.ledger = false; S.year = null; S.ypage = null; paintResult(); }   /* 點一下展開，再點一下收回 */
    else if (b.dataset.year) { S.year = +b.dataset.year; paintResult(); }
    else if (b.dataset.ypage != null) { S.ypage = +b.dataset.ypage; S.year = null; paintResult(); }
    else if (b.dataset.mb != null) { var cb = modal.cb && modal.cb[+b.dataset.mb]; var keep = cb && cb.fn && cb.fn() === false; if (!keep) closeModal(); }
    else if (b.id === 'saveBtn') { doSave(); paintResult(); }
    else if (b.id === 'shareBtn') { openShare(); }
    else if (b.id === 'expAll') { openExport(); }
    else if (b.id === 'impBtn') { $('impFile').click(); }
    else if (b.id === 'openList') { paintList(); show('list'); }
    else if (b.id === 'listBack') { var ve = validate(); if (ve) { syncForm(); show('quick'); showErr(ve); } else { paintResult(); show('result'); } }   /* 目前的方案資料不合法（例如匯入的檔案）：回快速開始並說明，不要硬畫結果 */
    else if (b.id === 'openCmp') { DB.cmp = null; paintCmp(); show('cmp'); }
    else if (b.id === 'cmpBack') { paintList(); show('list'); }
    else if (b.dataset.vs) { DB.cmp = [DB.active, b.dataset.vs]; saveDB(); paintCmp(); show('cmp'); }
    else if (b.dataset.sa != null) { DB.showAll = b.dataset.sa === '1'; saveDB(); paintCmp(); }
    else if (b.dataset.cs) {
      var sel = cmpSel(), cid = b.dataset.cs, ix = sel.indexOf(cid);
      if (ix >= 0) sel.splice(ix, 1); else if (sel.length >= CMP_MAX) { paintCmp('最多比 ' + CMP_MAX + ' 個，先取消一個。'); return; } else sel.push(cid);
      DB.cmp = sel.length ? sel : null; saveDB(); paintCmp();
    }
    else if (b.dataset.sw) { var to = b.dataset.sw; guard(function () { switchTo(to); }); }
    else if (b.id === 'newSc') {
      if (DB.list.length >= MAX) { modal('最多 ' + MAX + ' 個方案', '<div class="muted">請先刪除一個不要的方案。</div>', [{ label: '去刪除方案', cls: 'primary', fn: function () { paintList(); } }, { label: '取消', fn: function () {} }]); return; }
      var srcId = $('cpSrc') ? $('cpSrc').value : DB.list[0].id;
      guard(function () {
        var src = DB.list.filter(function (x) { return x.id === srcId; })[0], nid = newId();
        DB.list.push({ id: nid, name: uniqName(src.name + ' 的複本'), saved: JSON.parse(JSON.stringify(src.saved)), updated: nowStr() });
        DB.active = nid; saveDB(); toast('已新增並切換到「' + active().name + '」'); switchTo(nid);
      });
    }
    else if (b.dataset.rn) {
      var t = DB.list.filter(function (x) { return x.id === b.dataset.rn; })[0];
      modal('改名', '<label class="f" for="rnIn">方案名稱（1–20 字）</label><input id="rnIn" type="text" maxlength="20" value="' + esc(t.name) + '"><div class="err" id="rnErr" hidden></div>', [
        { label: '儲存名稱', cls: 'primary', fn: function () {
          var v = $('rnIn').value.trim(), err = !v ? '名稱不能空白。' : v.length > 20 ? '最多 20 個字。' : DB.list.some(function (x) { return x.id !== t.id && x.name === v; }) ? '已經有同名的方案。' : '';
          if (err) { $('rnErr').textContent = err; $('rnErr').hidden = false; return false; }
          t.name = v; saveDB(); paintList(); if (!$('result').hidden) paintResult(); toast('已改名為「' + v + '」');
        } },
        { label: '取消', fn: function () {} }
      ]);
    }
    else if (b.dataset.del) {
      var dv = DB.list.filter(function (x) { return x.id === b.dataset.del; })[0];
      modal('刪除「' + dv.name + '」？', '<div class="muted">刪除後無法復原。</div>', [
        { label: '刪除', cls: 'danger', fn: function () {
          DB.list = DB.list.filter(function (x) { return x.id !== dv.id; });
          if (DB.cmp) DB.cmp = DB.cmp.filter(function (id) { return id !== dv.id; });
          var wasActive = DB.active === dv.id;
          if (wasActive) { DB.active = DB.list[0].id; setInputs(DB.list[0].saved); }
          saveDB(); paintList(); toast('已刪除「' + dv.name + '」' + (wasActive ? '，切換到「' + DB.list[0].name + '」' : ''));
        } },
        { label: '取消', fn: function () {} }
      ]);
    }
    else if (b.id === 'wipe') {
      modal('清除這台裝置上的所有資料？', '<div class="muted">會刪掉這台裝置上全部 ' + DB.list.length + ' 個方案，無法復原。已匯出的備份檔、分享過的連結不會被刪除。</div>', [
        { label: '全部清除', cls: 'danger', fn: function () {
          try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('sp5:') === 0) localStorage.removeItem(k); }); } catch (e) {}
          DB = { v: 1, active: null, list: [], cmp: null, showAll: false };
          setInputs(DEFAULTS); show('quick'); toast('這台裝置上的資料已全部清除');
        } },
        { label: '取消', fn: function () {} }
      ]);
    }
    else if (b.id === 'gapAdd') { S.preDraft.gaps = (S.preDraft.gaps || []).concat([{ sit: 'job', y: '', m: '' }]); S.pf = S.pf || {}; S.pf.gap = true; paintResult(); }
    else if (b.dataset.gapdel != null) { S.preDraft.gaps.splice(+b.dataset.gapdel, 1); paintResult(); }
    else if (b.dataset.step) {
      var stp = b.dataset.step.split(':'), sk = stp[0], d = +stp[1], aj = adjState();
      if (sk === 'ret') { var rc = aj.ret !== null ? aj.ret : C.Radj, rn = retSnap(rc, d); if (rn >= EN0.fromAge() - 1e-9 && rn <= ADJ_MAX + 1e-9) aj.ret = rn; }
      else if (sk === 'more') aj.more = Math.max(-W(S.spend), aj.more + d * STEP_MONEY);
      else if (sk === 'save') aj.save = Math.max(-W(S.inc), aj.save + d * STEP_MONEY);
      else if (sk === 'end') { var ce = aj.end !== null ? aj.end : EN0.E(), ne = Math.max(66, Math.min(105, ce + d)); aj.end = ne === EN0.E() ? null : ne; }
      else if (sk.indexOf('wi.') === 0) { var wk = sk.slice(3), ws = WI_STEPS.filter(function (x) { return x[0] === wk; })[0]; aj.wi[wk] = Math.max(ws[3], Math.min(ws[4], aj.wi[wk] + d * ws[2])); }
      S.adjEdit = null; adjChanged(); paintResult();
    }
    else if (b.dataset.edit) { S.adjEdit = b.dataset.edit; paintResult(); }
    else if (b.dataset.editok) {
      var ek = b.dataset.editok, aj2 = adjState(), vv = Math.abs(num(($('ed-val') || {}).value));
      if (ek === 'ret') {
        var yy = Math.round(num(($('ed-y') || {}).value)), mm = Math.round(num(($('ed-m') || {}).value));
        if (yy > 1900 && mm >= 1 && mm <= 12) { var ra = EN0.ageOfT(EN0.mi(yy, mm) - EN0.NOWI); if (ra >= EN0.fromAge() - 1e-9 && ra <= ADJ_MAX + 1e-9) aj2.ret = ra; else { toast('要在現在到 ' + ADJ_MAX + ' 歲之間'); return; } }
        else { toast('請輸入正確的年和月'); return; }
      }
      else if (ek === 'end') { if (vv >= 66 && vv <= 105) aj2.end = Math.round(vv) === EN0.E() ? null : Math.round(vv); }
      else if (isFinite(vv)) { var dir = +($('ed-dir') || {}).value || 1, val = Math.round(vv) * dir; aj2[ek] = ek === 'more' ? Math.max(-W(S.spend), val) : Math.max(-W(S.inc), val); }
      S.adjEdit = null; adjChanged(); paintResult();
    }
    else if (b.dataset.rst) {
      var rk = b.dataset.rst, aj3 = adjState();
      if (rk === 'more' || rk === 'save') aj3[rk] = 0;
      else if (rk === 'ret') aj3.ret = null;
      else if (rk === 'end') aj3.end = null;
      else if (rk.indexOf('wi.') === 0) aj3.wi[rk.slice(3)] = WI_NEUTRAL[rk.slice(3)];
      else if (rk.indexOf('pre.') === 0) { var pk = rk.slice(4); S.preDraft[pk] = JSON.parse(JSON.stringify(S.pre[pk] === undefined ? '' : S.pre[pk])); }
      S.adjEdit = null; adjChanged(); paintResult();
    }
    else if (b.dataset.fill) { var fl = b.dataset.fill.split(':'), aj4 = adjState(); aj4[fl[0]] += +fl[1]; adjChanged(); paintResult(); }
    else if (b.dataset.apply) { var ap = b.dataset.apply.split(':'); adjReset(); adjState()[ap[0]] = +ap[1]; S.panel = 'adj'; paintResult(); window.scrollTo(0, 0); }
    else if (b.id === 'cmpReset') { adjReset(); S.preDraft = JSON.parse(JSON.stringify(S.pre)); S.preErr = ''; paintResult(); window.scrollTo(0, 0); }
    else if (b.id === 'precCancel') { S.preDraft = JSON.parse(JSON.stringify(S.pre)); S.preErr = ''; paintResult(); }
    else if (b.id === 'condAll') { S.condAll = !S.condAll; paintResult(); }
    else if (b.dataset.mtab) { S.mapTab = b.dataset.mtab; S.phase = null; S.ledger = false; paintResult(); }
    else if (b.id === 'saveNew') { saveAsNew(); }
    else if (b.id === 'goOld') { S.panel = 'prec'; S.pf = S.pf || {}; S.pf.old = true; paintResult(); $('panelPrec').scrollIntoView({ block: 'start' }); }
    else if (b.id === 'tgAdj' || b.id === 'tgPrec') { var want = b.id === 'tgAdj' ? 'adj' : 'prec'; S.panel = S.panel === want ? null : want; S.adjEdit = null; paintResult(); }
    else if (b.dataset.pa) { var pv = b.dataset.pa.split(':'); S.preDraft[pv[0]] = pv[1]; paintResult(); }
    else if (b.id === 'applyPre' || b.id === 'applyPre3' || b.id === 'clearPre') {
      var before = earliest(), Rb = before === null ? 65 : before, gb = gapText(evalR(profile(), Rb));
      var prevPre = S.pre, dcA = draftCheck(), oldDraft = JSON.parse(JSON.stringify(S.preDraft || {}));
      S.pre = b.id === 'clearPre' ? { liYears: '', w60: '', lsBal: '', lsWage: '', lsYears: '', liClaim: '', self: '0', endAge: S.pre.endAge || '', nhiDep: false, inf: '', dep: '', oldOn: S.pre.oldOn, oHire: S.pre.oHire, oYrs: S.pre.oYrs, oWage: S.pre.oWage, gaps: S.pre.gaps || [], liMode: '', liPre09: false, sex: '', sameCo: '', w36: '' } : JSON.parse(JSON.stringify(dcA.eff));
      var perr = validate(); if (perr) { S.pre = prevPre; S.preErr = perr; S.panel = 'prec'; paintResult(); return; }
      S.preErr = '';
      EN.sync();
      S.preDraft = JSON.parse(JSON.stringify(S.pre));
      var nBad = 0; if (b.id !== 'clearPre') Object.keys(dcA.bad).forEach(function (k) { S.preDraft[k] = oldDraft[k]; nBad++; });   /* 填錯的留在欄位裡繼續顯示錯誤 */
      var after = earliest(), lab = function (x) { return x === null ? '65 歲還不夠' : ageText(x); };
      S.delta = { before: before, after: after, Rb: Rb, gb: gb }; adjReset();
      toast((b.id === 'clearPre' ? '已改回估算' : '已套用') + '：最快 ' + lab(after) + (nBad ? '；' + nBad + ' 項有錯，沒有套用' : ''));
      if (nBad) S.panel = 'prec';
      S.panel = null; S.ledger = false; S.phase = null; paintResult(); window.scrollTo(0, 0);
    }
    else if (b.id === 'ledgerBtn') { S.ledger = !S.ledger; paintResult(); }
  });

  var DEFAULTS = getInputs();
  window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  /* 點「回報問題」的那一刻才填內容（版本、畫面、裝置）；連結本身預設就是寄信，程式出錯也點得開 */
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest ? e.target.closest('a.fblink') : null; if (a) a.href = fbHref(); }, true);
  document.addEventListener('keydown', function (e) {
    if ($('modal').hidden) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {   /* 焦點只在對話框裡循環 */
      var fs = modalFocusables(); if (!fs.length) { e.preventDefault(); return; }
      var i = fs.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (!e.shiftKey && (i === -1 || i === fs.length - 1)) { e.preventDefault(); fs[0].focus(); }
    }
  });
  $('modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
  loadDB();
  if (active()) { setInputs(active().saved); if (!validate()) { paintResult(); show('result'); } else syncForm(); }
  else { paintAge(); paintKids(); paintAccum(); }
  showLoadErr();
