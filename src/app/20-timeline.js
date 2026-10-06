/* src/app/20-timeline.js — 每個階段、逐年明細
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  var ageText = EN.ageText;
  function ymText(R, short) { var d = EN.ymOf(R); return short ? d.y + '/' + ('0' + d.m).slice(-2) : d.y + ' 年 ' + d.m + ' 月'; }
  function same(a, b) { return a !== null && b !== null && Math.abs(a - b) < 1e-6; }
  function monthsBetween(a, b) { return Math.round((b - a) * 12); }
  /* 事件說明：純文字＋樣式（網頁與 PDF 共用）。ym：這筆變化從哪個年月起（PDF 分享版會拿掉） */
  function impactPlain(e) {
    if (e.d === 'lump') return { cls: 'up', text: '這個月一次收入 ' + fmtW(e.v), ym: '' };
    if (e.d === 'lumpout') return { cls: 'dn2', text: '這個月一次付出 ' + fmtW(e.v) + (e.nom ? '（今天的購買力；當時的金額約 ' + fmtW(e.nom) + '）' : ''), ym: '' };
    var word = e.d === 'out' ? '支出少' : e.d === 'out+' ? '支出多' : e.d === 'in' ? '收入多' : '收入少', cls = e.d === 'out' ? 'dn' : e.d === 'in' ? 'up' : 'dn2';
    return { cls: cls, text: '每年' + word + ' ' + fmtW(e.v), ym: ymText(e.from != null ? e.from : e.a, true) };
  }
  function impactText(e) { var x = impactPlain(e); return '<span class="' + x.cls + '">' + (x.ym ? x.ym + ' 起，' : '') + x.text + '</span>'; }
  /* 照這個退休時點走，資產第一次付不出當月支出的年齡；撐得到最後就回傳 null */
  function exhaustAge(P, R) { return ledger(P, R).exhaust; }
  function ageCell(a, cls) { return '<span class="pa' + (cls || '') + '">' + ageText(a) + '<small>' + ymText(a, true) + '</small></span>'; }
  /* 每個階段的資料模型：用目前綁定的引擎（bindEngine）算。網頁的地圖與 PDF 都從這裡產生 */
  function phaseModel(P, R, Q) {
    var ph = phases(P, R, Q), ev = impactEvents(P, R, Q), led = ledger(P, R), ex = led.exhaust;
    if (ex !== null) {
      ev.forEach(function (e) { if (e.ret) e.t = '退休（資產撐不到 ' + EN.E() + ' 歲）'; });
      ev.push({ a: ex, t: '資產用完', bad: true });
      ev.sort(function (x, y) { return x.a - y.a || (x.bad ? 1 : 0) - (y.bad ? 1 : 0); });
    }
    var inPh = function (a, p) { return a >= p.f - 1e-9 && (a < p.t - 1e-9 || (p === ph[ph.length - 1] && a <= p.t + 1e-9)); };
    var min = null; led.forEach(function (r) { if (r.a >= Math.floor(R) && (min === null || r.end < min.end)) min = r; });
    var proj = evalR(P, R).proj;
    var list = ph.map(function (x) {
      var net = 0; for (var t = Math.max(0, EN.tOfAge(x.f)); t < EN.tOfAge(x.t); t++) net += EN.netM(P, Q, t);
      var m = { name: x.name, src: x.src, f: x.f, t: x.t, dur: durStr(monthsBetween(x.f, x.t)), ages: ageText(x.f) + '–' + ageText(x.t), yms: ymText(x.f) + '–' + ymText(x.t - 1 / 12), ymsShort: ymText(x.f, true) + '–' + ymText(x.t - 1 / 12, true), net: net, bad: ex !== null && inPh(ex, x) };
      if (x.name === '工作期') { var a0 = W(S.asset), er = a0 + net - proj; m.work = { a0: a0, net: net, er: Math.abs(er) >= 5000 ? er : 0, proj: proj }; }
      m.exText = m.bad ? '但資產到 ' + ageText(ex) + '（' + ymText(ex, true) + '）就用完了' : '';
      m.events = ev.filter(function (e) { return inPh(e.a, x); }).map(function (e) {
        if (e.bad) return { a: e.a, age: ageText(e.a), ym: ymText(e.a, true), t: '資產用完', text: '從這個月起，收入付不出支出；還差的錢就是上面說的缺口', cls: 'bad', bad: true, ret: false, rawEv: e };
        var ip = impactPlain(e); return { a: e.a, age: ageText(e.a), ym: ymText(e.a, true), t: e.t, text: ip.text, from: ip.ym, cls: ip.cls, bad: false, ret: !!e.ret, rawEv: e };
      });
      m.low = !(min && min.a >= Math.floor(x.f) && min.a < Math.ceil(x.t)) ? '' : min.a === EN.E() - 1 ? EN.E() + ' 歲時還剩 ' + fmtW(min.end) + '，資產一路撐到最後' : '資產最低點：' + (min.end < 0 ? '不足 ' + fmtW(-min.end) : fmtW(min.end)) + '（' + min.a + ' 歲那一年）';
      return m;
    });
    return { list: list, ex: ex, R: R, inPh: inPh };
  }
  /* 結果頁最下面的假設（網頁、PDF 共用） */
  /* 制度資料最後核對日期（data/params.json 的 verified_at）；超過一年沒核對就提醒（v0.9.0） */
  function dataCheck() {
    var vf = SP5Engine.DATA && SP5Engine.DATA.params && SP5Engine.DATA.params.verified, v = (vf && vf.at) || '', d = new Date(v + 'T00:00:00');
    var days = isFinite(d.getTime()) ? Math.floor((Date.now() - d.getTime()) / 86400000) : 9999;
    return { date: v.replace(/-/g, '/'), stale: days > 365 };
  }
  function assumptionsList(rt) {
    var dc = dataCheck();
    return [
      '這是在固定假設下推算的門檻，不是機率，也不是保證；不代表實際退休所需金額，也不是建議。',
      '只算你自己負擔的那一份，並假設配偶持續負擔其目前的家用份額。',
      '不算投資：名下可自由動用的錢放銀行（年利率 ' + pct2(rt.dep) + '，' + depSrc() + '；退休前後都用同一個利率）；勞退基金 ' + pct(LAW.lsRet) + '。',
      '通膨 ' + pct(rt.inf) + '，金額都是今天的購買力；薪資和生活費隨通膨調整，薪資實質成長 ' + pct(LAW.wageG) + '。',
      '算到 ' + EN0.E() + ' 歲，時間按月計算；勞退月退實際每 ' + LAW.payEvery + ' 個月發一次（季發），這裡按月攤開計算。',
      '勞保預設在法定年齡請領（可自選月領或一次領）；勞退在 ' + LAW.lsAge + ' 歲或退休時請領；國保保費與年金已計入。',
      '健保：退休後依第六類自付每月 ' + EN0.T.NHI_SELF.toLocaleString('en-US') + ' 元（可改為依附眷屬）；二代健保補充保費未計入。',
      '勞保年資未滿 ' + LAW.liMin + ' 年：法定年齡領老年一次金；加上退休後到 ' + LAW.npAge + ' 歲的國保年資滿 ' + LAW.npComb + ' 年，' + LAW.npAge + ' 歲可以月領（只用勞保年資算）。',
      '工作空窗只問多久，假設都發生在勞退新制期間；只扣制度年資，不重建當時的薪資與存款。',
      '孩子的費用是每個學段的全年金額平均攤到每個月，不是實際繳費的月份。',
      '沒有算：公保、軍保、農保、老農津貼、農民退休儲金（公務員、教師、軍人、農民不適用）；一次領的稅；長照的政府補助；' + LAW.maxR + ' 歲以後繼續工作。',
      '制度數字（勞保、勞退、國保、健保）最後核對：' + dc.date + '。' + (dc.stale ? '已經超過一年沒有核對，可能跟最新的規定不同。' : '')
    ];
  }
  /* ================= 每個階段（v0.9.0：色條＋直式清單） =================
     色條：長度依時間長短；顏色依錢從哪裡來（綠＝有薪水、橘＝只靠資產、灰藍＝有年金補貼）；紅點＝資產用完。只能看、不能點。
     清單：每一段一列，直接寫金額；點了展開這段發生的事。 */
  var PH_KIND = { '工作期': 'pay', '橋接期': 'asset', '靠資產期': 'asset', '勞退期': 'pension', '國保期': 'pension', '雙年金期': 'pension', '勞保期': 'pension' };
  var PH_LEG = [['pay', '有薪水'], ['asset', '只靠資產'], ['pension', '有年金補貼']];
  function stripHtml(PM, label, dim) {
    var ph = PM.list; if (!ph.length) return '';
    var A0 = ph[0].f, A1 = ph[ph.length - 1].t, P0 = function (a) { return Math.max(0, Math.min(100, (a - A0) / Math.max(1e-9, A1 - A0) * 100)); };
    /* 標籤：退休固定在上方（粗體）；現在、終點、用完固定在下方；其他分界哪一排放得下就放哪一排（都放不下才省略，清單裡有） */
    var WPX = 330, occ = { up: [], dn: [] }, labs = [];
    var tw = function (t) { return t.replace(/ /g, '').length * 7.2 + (t.split(' ').length - 1) * 3 + 4; };
    var put = function (row, age, text, align, cls) {
      var x = P0(age) / 100 * WPX, w = tw(text), l = align === 'l' ? x : align === 'r' ? x - w : x - w / 2;
      if (!occ[row].every(function (q) { return q[1] < l - 6 || q[0] > l + w + 6; })) return false;
      occ[row].push([l, l + w]); labs.push({ row: row, age: age, text: text, align: align, cls: cls || '' }); return true;
    };
    var R = PM.R, ex = PM.ex, fl = function (a) { return String(Math.floor(a + 1e-9)); };
    put('up', R, '退休 ' + fl(R), 'c', 'ret');
    put('dn', A0, '現在 ' + fl(A0), 'l'); put('dn', A1, fl(A1), 'r');
    if (ex !== null) put('dn', ex, ageText(ex) + '用完', 'c', 'bad');
    ph.forEach(function (x) { [x.f, x.t].forEach(function (b) {
      if (Math.abs(b - A0) < 1e-6 || Math.abs(b - A1) < 1e-6 || Math.abs(b - R) < 1e-6 || labs.some(function (l) { return Math.abs(l.age - b) < 1e-6; })) return;
      put('up', b, fl(b), 'c') || put('dn', b, fl(b), 'c');
    }); });
    var lab = function (l) {
      var pos = l.align === 'l' ? 'left:0' : l.align === 'r' ? 'right:0' : 'left:' + P0(l.age).toFixed(2) + '%;transform:translateX(-50%)';
      var tick = l.align === 'c' ? '<i class="sltk ' + l.row + ' ' + l.cls + '" style="left:' + P0(l.age).toFixed(2) + '%"></i>' : '';
      return '<span class="sl ' + l.row + ' ' + l.cls + '" style="' + pos + '">' + l.text + '</span>' + tick;
    };
    var segs = ph.map(function (x) { return '<i class="sg k-' + (PH_KIND[x.name] || 'pension') + '" style="left:' + P0(x.f).toFixed(2) + '%;width:' + (P0(x.t) - P0(x.f)).toFixed(2) + '%"></i>'; }).join('');
    var aria = (label ? label + '：' : '') + ph.map(function (x) { return x.name + x.dur; }).join('、') + (ex !== null ? '；資產在 ' + ageText(ex) + '用完' : '');
    return (label ? '<div class="stlab">' + label + '</div>' : '') + '<div class="strip' + (dim ? ' dim' : '') + '" role="img" aria-label="' + esc(aria) + '">' +
      '<div class="slrow up">' + labs.filter(function (l) { return l.row === 'up'; }).map(lab).join('') + '</div>' +
      '<div class="sbar"><div class="sbarin">' + segs + '</div>' + (ex !== null ? '<i class="sdot" style="left:' + P0(ex).toFixed(2) + '%"></i>' : '') + '</div>' +
      '<div class="slrow dn">' + labs.filter(function (l) { return l.row === 'dn'; }).map(lab).join('') + '</div></div>';
  }
  function phaseLegend() { return '<div class="slegend">' + PH_LEG.map(function (k) { return '<span><i class="k-' + k[0] + '"></i>' + k[1] + '</span>'; }).join('') + '</div>'; }
  function timelineHtml(P, R, Q, PM) {
    PM = PM || phaseModel(P, R, Q);
    var ph = PM.list, ex = PM.ex;
    var rows = ph.map(function (x, i) {
      var open = S.phase === i, kind = PH_KIND[x.name] || 'pension';
      var money = x.work ? '退休時你會有 <b>' + fmtW(x.work.proj) + '</b>' : x.net < 0 ? '這段要從資產拿出 <b>' + fmtW(-x.net) + '</b>' : '這段收入大於支出，共多 <b>' + fmtW(x.net) + '</b>';
      var head = '<button type="button" class="phc' + (x.bad ? ' bad' : '') + '" data-phase="' + i + '" aria-expanded="' + open + '">' +
        '<span class="phh"><i class="phsw k-' + kind + '"></i><b>' + x.name + '</b><span class="ps">' + x.src + '</span><span class="chev" aria-hidden="true">' + (open ? '⌄' : '›') + '</span></span>' +
        '<span class="rg">' + x.ages + '・' + x.dur + '</span><span class="pm1">' + money + '</span>' + (x.exText ? '<span class="bad">' + x.exText + '</span>' : '') + '</button>';
      if (!open) return '<div class="phrow' + (x.bad ? ' bad' : '') + '">' + head + '</div>';
      var detail = '';
      if (x.work) {
        var w = x.work;
        detail = '<div class="wgrid">' + '<span>現有</span><span>' + fmtW(w.a0) + '</span>' +
          (w.net >= 0 ? '<span>＋ 這段存下</span><span>' + fmtW(w.net) + '</span>' : '<span>－ 這段入不敷出</span><span>' + fmtW(-w.net) + '</span>') +   /* 工作期也可能入不敷出（收入中斷、房貸、子女同時發生） */
          (w.er ? '<span>' + (w.er > 0 ? '－ 通膨讓存款縮水' : '＋ 存款利息') + '</span><span>' + fmtW(Math.abs(w.er)) + '</span>' : '') +
          '<b>退休時</b><b>' + fmtW(w.proj) + '</b></div>';
      }
      var evs = x.events.map(function (e) {
        if (e.bad) return '<div class="pe">' + ageCell(e.a, ' bad') + '<div><div class="pt bad">資產用完</div><span class="bad">' + e.text + '</span></div></div>';
        return '<div class="pe">' + ageCell(e.a, e.ret ? (ex !== null ? ' warnc' : ' ret') : '') + '<div><div class="pt">' + e.t + '</div>' + impactText(e.rawEv) + '</div></div>';
      }).join('') || '<div class="muted" style="margin-top:6px">這段期間收支沒有大變化。</div>';
      var panel = '<div class="ppanel"><div class="pr">' + x.yms + '</div>' + detail + evs + (x.low ? '<div class="pmin">' + x.low + '</div>' : '') +
        '<button type="button" class="linkbtn" id="ledgerBtn" aria-expanded="' + !!S.ledger + '">' + (S.ledger ? '收起逐月明細' : '看這段每一年、每個月 ›') + '</button>' +
        (S.ledger ? yearsHtml(P, R, x) : '') + '</div>';
      return '<div class="phrow open' + (x.bad ? ' bad' : '') + '">' + head + panel + '</div>';
    });
    return '<div class="phlist">' + rows.join('') + '</div>';
  }
  /* 逐年逐月：這個階段涵蓋的日曆年，五年一頁；點某一年列出 1–12 月發生的事 */
  var YPAGE = 5;
  function monthSummary(f) {
    var a = [], b = [];
    if (f.work) a.push('薪水 ' + fmtW(f.work)); if (f.ls) a.push('勞退 ' + fmtW(f.ls)); if (f.li) a.push('勞保 ' + fmtW(f.li)); if (f.np) a.push('國保 ' + fmtW(f.np));
    b.push('生活 ' + fmtW(f.living)); if (f.loan) b.push('貸款 ' + fmtW(f.loan)); if (f.kid) b.push('子女 ' + fmtW(f.kid)); if (f.par) b.push('孝親 ' + fmtW(f.par)); if (f.npPrem) b.push('國保費 ' + fmtW(f.npPrem)); if (f.nhiPrem) b.push('健保費 ' + fmtW(f.nhiPrem));
    return '每月收入：' + (a.join('、') || '無') + '<br>每月支出：' + b.join('、');
  }
  function yearsHtml(P, R, x) {
    var mon = EN.monthly(P, R), Q = mon.Q, bI = EN.tOfAge(0) + EN.NOWI;   /* bI：出生那個月 */
    var tF = Math.max(0, EN.tOfAge(x.f)), tT = Math.min(P.tE, EN.tOfAge(x.t)) - 1;
    if (tT < tF) return '';
    var y0 = Math.floor((EN.NOWI + tF) / 12), y1 = Math.floor((EN.NOWI + tT) / 12), years = [];
    for (var y = y0; y <= y1; y++) years.push(y);
    var hasEv = function (y) { for (var m = 0; m < 12; m++) { var t = y * 12 + m - EN.NOWI; if (t >= 0 && t < P.tE && (EN.eventsAt(P, Q, t).length || t === mon.exhaustT)) return true; } return false; };
    var pool = (S.ypage != null && S.ypage >= 0) ? years.slice(S.ypage * YPAGE, S.ypage * YPAGE + YPAGE) : years;
    if (!pool.length) pool = years;
    if (S.year == null || years.indexOf(S.year) < 0) { S.year = pool[0]; for (var i = 0; i < pool.length; i++) if (hasEv(pool[i])) { S.year = pool[i]; break; } }
    var pages = Math.ceil(years.length / YPAGE), pg = Math.floor(years.indexOf(S.year) / YPAGE);
    if (S.ypage != null && S.ypage >= 0 && S.ypage < pages) pg = S.ypage;
    var shown = years.slice(pg * YPAGE, pg * YPAGE + YPAGE);
    var ages = function (y) { return Math.floor((y * 12 - bI) / 12) + '–' + Math.floor((y * 12 + 11 - bI) / 12) + ' 歲'; };
    var btns = '<div class="ygrid" role="tablist" aria-label="年份">' + shown.map(function (y) {
      return '<button type="button" role="tab" class="yb' + (hasEv(y) ? ' ev' : '') + '" data-year="' + y + '" aria-selected="' + (y === S.year) + '"><b>' + y + '</b><span>' + ages(y) + '</span></button>';
    }).join('') + '</div>' + '<div class="ylegend"><b>●</b> 這一年有事情發生（退休、年金開始、繳完貸款、孩子升學…）</div>';
    var pager = pages > 1 ? '<div class="ypager"><button type="button" data-ypage="' + (pg - 1) + '"' + (pg === 0 ? ' disabled' : '') + '>‹ 上一頁</button><span class="muted">' + years[pg * YPAGE] + '–' + shown[shown.length - 1] + '・' + (pg + 1) + '／' + pages + '</span><button type="button" data-ypage="' + (pg + 1) + '"' + (pg === pages - 1 ? ' disabled' : '') + '>下一頁 ›</button></div>' : '';
    /* 該年 12 個月：事件月份才寫字，連續沒事的月份合併成「同上」 */
    var rows = [], run = null, first = true, Y = S.year;
    var flush = function () {
      if (!run) return;
      rows.push('<div class="mr"><span class="mm">' + (run.a === run.b ? run.a + ' 月' : run.a + '–' + run.b + ' 月') + '</span><span class="mt muted">同上</span><span class="me">' + run.b + ' 月底 ' + fmtW(run.end) + '</span></div>');
      run = null;
    };
    for (var m = 1; m <= 12; m++) {
      var t = Y * 12 + m - 1 - EN.NOWI;
      if (t < 0) { if (m === 12 || Y * 12 + m - EN.NOWI >= 0) rows.push('<div class="mr past"><span class="mm">' + (m === 1 ? '1' : '1–' + m) + ' 月</span><span class="mt muted">已經過去</span><span class="me"></span></div>'); continue; }
      if (t >= P.tE) { flush(); rows.push('<div class="mr past"><span class="mm">' + m + ' 月起</span><span class="mt muted">試算到 ' + EN.E() + ' 歲為止</span><span class="me"></span></div>'); break; }
      var ev = EN.eventsAt(P, Q, t), mo = mon[t], bad = t === mon.exhaustT;
      if (!ev.length && !bad && !first) { if (run) { run.b = m; run.end = mo.end; } else run = { a: m, b: m, end: mo.end }; continue; }
      flush();
      var txt = ev.map(function (e) { return '<div class="mev ' + e.k + '">● ' + e.text + '</div>'; }).join('');
      if (bad) txt += '<div class="mev bad">● 資產用完：從這個月起，收入付不出支出</div>';
      if (first) txt += '<div class="msum">' + monthSummary(mo.f) + '</div>';
      first = false;
      rows.push('<div class="mr' + (ev.length || bad ? ' hit' : '') + '"><span class="mm">' + m + ' 月</span><span class="mt">' + txt + '</span><span class="me' + (mo.end < 0 ? ' neg' : '') + '">月底 ' + (mo.end < 0 ? '不足 ' + fmtW(-mo.end) : fmtW(mo.end)) + '</span></div>');
    }
    flush();
    return pager + btns + '<div class="mlist"><div class="mhd">' + Y + ' 年（' + ages(Y) + '）</div>' + rows.join('') + '</div>' +
      '<div class="muted" style="margin-top:6px">金額都是今天的購買力。「同上」表示收支項目沒有變化。</div>';
  }

