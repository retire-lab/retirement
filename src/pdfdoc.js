/*
 * 退休試算報告 PDF 的文件定義（pdfmake）。
 * 純函式：輸入 reportModel()（網頁產生的資料模型），輸出 pdfmake 的 docDefinition。
 * 瀏覽器與 Node 測試共用同一份；不碰畫面、不連網路。
 *
 * opts.anon      true＝分享版：拿掉出生年月（改寫年齡）、所有年月（年齡＋年月可反推出生日）、
 *                孩子的出生年月（改寫年齡）、工作空窗的原因、方案名稱
 * opts.password  有值就加 AES-256 密碼（PDF 1.7 ext3）
 * opts.coverage  字型子集收錄的字；不在裡面的字換成替代字或「□」，不會印出空白
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SP5PdfDoc = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var C = { ink: '#1f1f1d', mut: '#5f5e5a', line: '#d9d7d0', acc: '#1a4f8f', accbg: '#e3edf9', ok: '#2e6b1f', bad: '#9a2d12', warn: '#7a5200', warnbg: '#fbeccd', band: '#e7e5df', orange: '#b45309', gray: '#8a8880' };
  var SUBST = { '−': '－', '‹': '〈', '›': '〉', '▾': '', '⚠': '！', '✓': 'v', '✕': 'x', '\u00a0': ' ' };
  var YM = /（?\d{4}\/\d{2}(–\d{4}\/\d{2})?）?|\d{4} 年 \d{1,2} 月(–\d{4} 年 \d{1,2} 月)?/g;

  function build(M, opts) {
    opts = opts || {};
    var anon = !!opts.anon, cov = opts.coverage ? new Set(Array.from(opts.coverage)) : null, cmp = !!M.meta.compare;
    /* 文字：分享版拿掉年月；字型沒有的字換掉 */
    var tx = function (s) {
      s = s == null ? '' : String(s);
      if (anon) s = s.replace(/\d{4}\/\d{2} 起，/g, '').replace(YM, '').replace(/（\s*）/g, '').replace(/\s{2,}/g, ' ').trim();
      if (cov) s = Array.from(s).map(function (ch) { if (SUBST[ch] !== undefined) return SUBST[ch]; return (ch.charCodeAt(0) < 128 || /\s/.test(ch) || cov.has(ch)) ? ch : '□'; }).join('');
      return s;
    };
    var c = [], tocCh = 0;
    var NUM = ['一', '二', '三', '四', '五', '六'];
    /* 章節標題一定跟該章的第一個內容在同一頁：標題＋底線＋說明＋第一個內容包成「不可拆開」的區塊，
       這一頁放不下就整塊移到下一頁（這一頁留白），標題不會單獨留在頁尾 */
    var chapter = function (title, sub, first) {
      var head = [{ text: NUM[tocCh++] + '、' + tx(title), style: 'ch', tocItem: true, tocStyle: 'tocItem', tocMargin: [0, 4, 0, 4] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.4, lineColor: C.ink }], margin: [0, 2, 0, 4] }];
      if (sub) head.push({ text: tx(sub), style: 'sub' });
      c.push({ stack: head.concat(first ? [first] : []), unbreakable: true, keepTogether: true });
    };
    var subhead = function (t, first) { c.push({ stack: [{ text: tx(t), style: 'h3' }, first], unbreakable: true }); };
    var band = function (t, cols, color) { return [{ text: tx(t), style: 'band', colSpan: cols, fillColor: C.band, color: color || C.ink }].concat(new Array(cols - 1).fill({})); };
    var lines = function (arr, adj, big) {
      arr = (arr || []).map(tx).filter(Boolean);
      if (!arr.length) return { text: '' };
      var out = [{ text: arr[0], fontSize: big ? 13.5 : 10.5, color: adj ? C.acc : C.ink }];
      arr.slice(1).forEach(function (x) { out.push({ text: '\n' + x, fontSize: 8.5, color: /^↑/.test(x) ? C.ok : /^↓/.test(x) ? C.bad : C.mut }); });
      return { text: out };
    };
    var tableLayout = { hLineWidth: function () { return 0.4; }, vLineWidth: function () { return 0; }, hLineColor: function () { return C.line; }, paddingTop: function () { return 3; }, paddingBottom: function () { return 3; } };

    /* ===== 封面＋前言 ===== */
    c.push({ text: '退休試算報告', style: 'title' });
    c.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.4, lineColor: C.ink }], margin: [0, 2, 0, 8] });
    if (!anon) c.push({ text: tx('方案：' + M.meta.name + (M.meta.dirty ? '（未存檔）' : '')), style: 'meta' });
    c.push({ text: '前言', style: 'h3' });
    var intro = ['這份報告由「退休生命週期決策平台」產生，回答一個問題：不靠投資，只用收入減支出存下來的錢，加上勞保、勞退、國保、健保，最早幾歲可以退休。'];
    if (cmp) {
      intro.push('報告比較兩個版本：「原始」是你目前的設定；「調整後」包含' + (M.meta.pendingN ? '還沒套用的實際資料（提高準確度）' + (M.meta.adjN ? '與' : '') : '') + (M.meta.adjN ? '假設的情境（調調看）' : '') + '。');
      intro.push('怎麼讀：先看第一章兩個版本的條件差在哪裡，再看第二章的結果；第三、四章說明錢怎麼走，以及每個階段會發生什麼事' + (M.li ? '；第五章是勞保一次領和月領的比較' : '') + '。');
    } else {
      intro.push('這份報告是你目前的設定，沒有任何調整。想比較不同的做法，可以在網頁上用「調調看」或「提高準確度」，再分享一份對照報告。');
      intro.push('怎麼讀：第一章是算這份結果用的條件，第二章是結果；第三、四章說明錢怎麼走，以及每個階段會發生什麼事' + (M.li ? '；第五章是勞保一次領和月領的比較' : '') + '。');
    }
    intro.push('這是門檻估計，不是建議。金額都是今天的購買力。');
    intro.forEach(function (t) { c.push({ text: tx(t), style: 'p' }); });
    c.push({ text: '適用範圍', style: 'h3' });
    M.scope.forEach(function (t) { c.push({ text: '・' + tx(t), style: 'li' }); });
    c.push({ text: '假設', style: 'h3' });
    M.assumptions.forEach(function (t) { c.push({ text: '・' + tx(t), style: 'li' }); });
    c.push({ text: '', pageBreak: 'after' });
    /* ===== 目錄 ===== */
    c.push({ toc: { title: { text: '目錄', style: 'tocTitle' } } });
    c.push({ text: '', pageBreak: 'after' });

    /* ===== 一、條件 ===== */
    var condTitle = [cmp ? '條件：原始 vs 調整後' : '條件', cmp ? '每一項都列出來；沒改的寫「同左」，改過的用藍色。' : '算這份結果用的所有條件。標「估算」的，是還沒填實際資料、由系統依收入估算的。'];
    /* 條件：每一組各自一張不拆頁的小表（組標題不會單獨留在頁尾）；對照時每組都附「原始／調整後」欄名。分號分開的值（例如每個孩子）一項一行 */
    var nl = function (v) { return tx(v).replace(/；/g, '\n'); };
    M.conditions.forEach(function (g, gi) {
      var body = [cmp ? [{ text: tx(g.title), style: 'band', fillColor: C.band }, { text: '原始', color: C.mut, fillColor: C.band, fontSize: 9, margin: [0, 5, 0, 0] }, { text: '調整後', color: C.acc, fillColor: C.band, fontSize: 9, margin: [0, 5, 0, 0] }]
                        : band(g.title, 2)];
      g.rows.forEach(function (r) {
        var o = anon && r.anonO != null ? r.anonO : r.o, a = anon && r.anonA != null ? r.anonA : r.a;
        var lab = anon && r.anonLabel ? r.anonLabel : r.label;
        if (cmp) body.push([{ text: tx(lab), color: C.mut }, { text: nl(o) }, r.changed ? { text: nl(a), color: C.acc, fillColor: C.accbg } : { text: '同左', color: C.mut, fillColor: C.accbg }]);
        else body.push([{ text: tx(lab), color: C.mut }, { text: nl(o) }]);
      });
      var tbl = { table: { headerRows: 1, widths: cmp ? [108, '*', '*'] : [120, '*'], body: body, dontBreakRows: true }, layout: tableLayout, fontSize: 10, unbreakable: true, margin: [0, 0, 0, 8] };
      if (gi === 0) chapter(condTitle[0], condTitle[1], tbl); else c.push(tbl);
    });

    /* ===== 二、結果 ===== */
    var resTitle = [cmp ? '結果：原始 vs 調整後' : '結果', '「需要有」：在那個時間退休，那天手上要有多少錢，才夠用到 ' + M.meta.E + ' 歲（今天的購買力）。'];
    if (cmp) {
      var rb = [[{ text: '' }, { text: '原始', color: C.mut }, { text: '調整後', color: C.acc, fillColor: C.accbg }]];
      M.results.rows.forEach(function (r) {
        var a = lines(r.a, true, r.big); if (r.d) a.text.push({ text: '\n' + tx(r.d), fontSize: 8.5, color: r.dcls === 'good' ? C.ok : r.dcls === 'bad' ? C.bad : C.mut });
        a.fillColor = C.accbg;
        rb.push([{ text: tx(r.label), color: C.mut }, lines(r.o, false, r.big), a]);
      });
      chapter(resTitle[0], resTitle[1], { table: { headerRows: 1, widths: [92, '*', '*'], body: rb, dontBreakRows: true }, layout: tableLayout, fontSize: 10.5 });
    } else {
      chapter(resTitle[0], resTitle[1], { stack: [{ table: { widths: [120, '*'], body: M.results.rows.map(function (r) { return [{ text: tx(r.label), color: C.mut }, lines(r.v, false, r.big)]; }), dontBreakRows: true }, layout: tableLayout, fontSize: 10.5 }]
        .concat(M.results.notes.length ? [{ text: M.results.notes.map(tx).join(''), style: 'note' }] : []) });
    }

    /* ===== 三、曲線 ===== */
    chapter('你的錢會怎麼走', '每年年底的資產，今天的購買力。' + (cmp ? '灰色虛線是原始，藍色是調整後。' : ''), { svg: curveSvg(M.curve, cmp, tx), width: 515, margin: [0, 4, 0, 0] });

    /* ===== 四、每個階段 ===== */
    var phTitle = ['每個階段的收支', (cmp ? '左右對照每一段的時間與金額，以及這段發生的事。' : '每一段的錢從哪裡來、要從資產拿出多少，以及這段發生的事。') + '金額都是今天的購買力。'];
    var ORDER = ['工作期', '橋接期', '勞退期', '國保期', '雙年金期', '勞保期', '靠資產期'];
    var byName = function (list) { var o = {}; (list || []).forEach(function (x) { o[x.name] = x; }); return o; };
    var po = byName(M.phases.orig), pa = byName(M.phases.adj);
    var names = ORDER.filter(function (n) { return po[n] || pa[n]; }).concat(Object.keys(po).concat(Object.keys(pa)).filter(function (n, i, arr) { return ORDER.indexOf(n) < 0 && arr.indexOf(n) === i; }));
    var moneyCell = function (x, adj) {
      if (!x) return { text: '（沒有這一段）', color: C.mut, fontSize: 9.5 };
      var parts = [{ text: tx(x.src) + '\n', fontSize: 8.5, color: C.mut }, { text: tx(x.ages + '・' + x.dur) + (anon ? '' : '\n' + tx(x.yms)) + '\n', fontSize: 8.5, color: C.mut }];
      if (x.work) {
        var w = x.work;
        parts.push({ text: '現有　' + x.workText.a0 + '\n' });
        parts.push({ text: (w.net >= 0 ? '＋ 這段存下　' : '－ 這段入不敷出　') + x.workText.net + '\n', color: w.net >= 0 ? (adj ? C.acc : C.ink) : C.bad });
        if (w.er) parts.push({ text: (w.er > 0 ? '－ 通膨讓存款縮水　' : '＋ 存款利息　') + x.workText.er + '\n' });
        parts.push({ text: '退休時　' + x.workText.proj });
      } else parts.push({ text: tx(x.moneyText) });
      if (x.exText) parts.push({ text: '\n' + tx(x.exText), color: C.bad });
      return { text: parts, fontSize: 10, color: adj ? C.acc : C.ink };
    };
    var evCell = function (x, adj) {
      if (!x) return { text: '（沒有這一段）', color: C.mut, fontSize: 9.5 };
      if (!x.events.length) return { text: '（這段收支沒有大變化）', color: C.mut, fontSize: 9.5 };
      var parts = [];
      x.events.forEach(function (e, i) {
        var col = e.bad ? C.bad : e.ret ? C.ok : (adj ? C.acc : C.ink);
        parts.push({ text: (i ? '\n' : '') + tx(e.age) + (anon || !e.ym ? '' : '（' + e.ym + '）') + '　' + tx(e.t), color: col });
        if (e.text) parts.push({ text: '\n　' + tx(e.text), fontSize: 8.5, color: e.bad ? C.bad : C.mut });
      });
      return { text: parts, fontSize: 9.5 };
    };
    if (cmp) {
      var hb = [{ text: '' }, { text: '原始（' + tx(M.phases.origSub) + '）', color: C.mut, fontSize: 9 }, { text: '調整後（' + tx(M.phases.adjSub) + '）', color: C.acc, fontSize: 9, fillColor: C.accbg }];
      var mb = [hb], eb = [hb.map(function (h) { return Object.assign({}, h); })];
      names.forEach(function (n) {
        var m1 = moneyCell(po[n], false), m2 = moneyCell(pa[n], true); m2.fillColor = C.accbg;
        var e1 = evCell(po[n], false), e2 = evCell(pa[n], true); e2.fillColor = C.accbg;
        mb.push([{ text: n, fontSize: 12 }, m1, m2]); eb.push([{ text: n, fontSize: 12 }, e1, e2]);
      });
      chapter(phTitle[0], phTitle[1], { table: { headerRows: 1, keepWithHeaderRows: 1, widths: [62, '*', '*'], body: mb, dontBreakRows: true }, layout: tableLayout });
      subhead('每個階段發生的事', { table: { headerRows: 1, keepWithHeaderRows: 1, widths: [62, '*', '*'], body: eb, dontBreakRows: true }, layout: tableLayout });
    } else {
      var sb = [[{ text: '' }, { text: '時間與金額', color: C.mut, fontSize: 9 }, { text: '這段發生的事', color: C.mut, fontSize: 9 }]];
      names.forEach(function (n) { sb.push([{ text: n, fontSize: 12 }, moneyCell(po[n], false), evCell(po[n], false)]); });
      chapter(phTitle[0], phTitle[1], { table: { headerRows: 1, keepWithHeaderRows: 1, widths: [62, '*', '*'], body: sb, dontBreakRows: true }, layout: tableLayout });
    }

    /* ===== 五、勞保（能選一次領才有） ===== */
    if (M.li) {
      var box = function (t, col, lines2) { return { stack: [{ text: t, color: col, fontSize: 11 }].concat(lines2.map(function (x, i) { return { text: tx(x), fontSize: i === 0 ? 12 : 8.5, color: i === 0 ? C.ink : C.mut }; })), margin: [6, 4, 6, 4] }; };
      chapter('勞保：一次領和月領，累計各拿多少', null, { stack: [{ table: { widths: ['*', '*'], body: [[box(M.li.lumpTitle, C.orange, M.li.lumpLines), box(M.li.monTitle, C.acc, M.li.monLines)]] },
        layout: { hLineWidth: function () { return 1; }, vLineWidth: function () { return 1; }, hLineColor: function () { return C.line; }, vLineColor: function () { return C.line; } } },
        { text: tx(M.li.sentence) + '（含國保；以實質存款利率折算到退休那個月。只呈現事實，不做建議。）', color: C.acc, margin: [0, 6, 0, 0] }].concat(M.li.note ? [{ text: tx(M.li.note), style: 'note' }] : []) });
    }

    var foot = anon ? '分享版：已移除出生年月與所有年月（只留年齡）、孩子的出生年月、工作空窗的原因、方案名稱。' : '完整版：含你填的個人資料，請妥善保管。';
    var dd = {
      pageSize: 'A4', pageMargins: [40, 70, 40, 56],
      info: { title: '退休試算報告' + (anon ? '（分享版）' : '（完整版）'), author: '', subject: cmp ? '原始 vs 調整後' : '目前的設定', creator: '退休生命週期決策平台 v' + M.meta.version, producer: '退休生命週期決策平台' },
      defaultStyle: { font: opts.font || 'Kai', fontSize: 10, color: C.ink, lineHeight: 1.25 },
      styles: {
        title: { fontSize: 22, margin: [0, 0, 0, 2] }, meta: { fontSize: 11, color: C.mut, margin: [0, 0, 0, 6] },
        h3: { fontSize: 13, color: C.acc, margin: [0, 10, 0, 4] }, p: { fontSize: 10.5, lineHeight: 1.45, margin: [0, 0, 0, 4] }, li: { fontSize: 10, lineHeight: 1.35, margin: [0, 0, 0, 2] },
        ch: { fontSize: 16, margin: [0, 14, 0, 0] }, sub: { fontSize: 9.5, color: C.mut, margin: [0, 0, 0, 6] }, band: { fontSize: 12.5, margin: [0, 3, 0, 3] },
        note: { fontSize: 9.5, color: C.mut, margin: [0, 6, 0, 0] }, tocTitle: { fontSize: 18, margin: [0, 0, 0, 12] }, tocItem: { fontSize: 13 }
      },
      header: function () {
        return { margin: [40, 24, 40, 0], stack: [{ columns: [{ text: [{ text: '退休生命週期決策平台\n', fontSize: 12 }, { text: 'Retirement Lifecycle Decision Platform', fontSize: 7.5, color: C.mut }] },
          { text: M.meta.date.replace(/-/g, '/') + ' ・ v' + M.meta.version + ' ・ ' + (anon ? '分享版' : '完整版') + (cmp ? '・對照' : ''), alignment: 'right', fontSize: 8.5, color: C.mut }] },
          { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.6, lineColor: C.ink }] }] };
      },
      footer: function (cur) {
        return { margin: [40, 10, 40, 0], columns: [{ text: tx(foot) + '\n本結果是門檻估計，不代表實際退休所需金額，也不是建議。' + (M.meta.fontNote ? '字型：' + M.meta.fontNote + '。' : ''), fontSize: 7.5, color: C.mut }, { text: '第 ' + cur + ' 頁', alignment: 'right', fontSize: 8, color: C.mut, width: 50 }] };
      },
      content: c
    };
    if (opts.password) { dd.version = '1.7ext3'; dd.userPassword = String(opts.password); dd.ownerPassword = opts.ownerPassword || (String(opts.password) + ':owner:' + Math.random().toString(36).slice(2)); dd.permissions = { printing: 'highResolution', modifying: false, copying: true, annotating: false, fillingForms: false, contentAccessibility: true, documentAssembly: false }; }
    return dd;
  }

  /* 曲線（SVG）：原始灰色虛線、調整後藍色；退休時間垂直線；資產用完標紅 */
  function curveSvg(cv, cmp, tx) {
    var W = 515, H = 270, L = 40, R = 10, T = 40, B = 30;
    var all = cv.orig.concat(cv.adj || []), vs = all.map(function (p) { return p[1]; }).concat([0]);
    var vmax = Math.max.apply(null, vs) * 1.1, vmin = Math.min.apply(null, vs);
    var a0 = Math.min.apply(null, all.map(function (p) { return p[0]; })) - 1, a1 = Math.max.apply(null, all.map(function (p) { return p[0]; }));
    var X = function (a) { return L + (a - a0) / Math.max(1, a1 - a0) * (W - L - R); }, Y = function (v) { return T + (H - T - B) - (v - vmin) / ((vmax - vmin) || 1) * (H - T - B); };
    var raw = (vmax - vmin) / 6, mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw)))), step = [1, 2, 5, 10].map(function (k) { return k * mag; }).filter(function (k) { return k >= raw; })[0] || raw;
    var g = '';
    for (var v = Math.ceil(vmin / step) * step; v <= vmax; v += step) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#d9d7d0" stroke-width="0.5"/><text x="' + (L - 4) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="8" fill="#5f5e5a" text-anchor="end">' + Math.round(v / 1e4) + '</text>';
    for (var a = Math.ceil(a0 / 10) * 10; a <= a1; a += 10) g += '<text x="' + X(a).toFixed(1) + '" y="' + (H - B + 13) + '" font-size="8" fill="#5f5e5a" text-anchor="middle">' + a + '</text>';
    g += '<line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#5f5e5a" stroke-width="0.9"/><line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(Math.max(0, vmin)).toFixed(1) + '" y2="' + Y(Math.max(0, vmin)).toFixed(1) + '" stroke="#5f5e5a" stroke-width="0.9"/>';
    if (vmin < 0) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#5f5e5a" stroke-width="0.9"/>';
    g += '<text x="' + (W - R) + '" y="' + (H - 4) + '" font-size="8" fill="#5f5e5a" text-anchor="end">年齡</text><text x="4" y="' + (T - 8) + '" font-size="8" fill="#5f5e5a">萬</text>';
    var pl = function (pts, col, w, dash) { return '<polyline fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="4,3"' : '') + ' points="' + pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>'; };
    var vline = function (R0, col, lab, dy) { return '<line x1="' + X(R0).toFixed(1) + '" x2="' + X(R0).toFixed(1) + '" y1="' + (T - 18 + dy) + '" y2="' + (H - B) + '" stroke="' + col + '" stroke-width="0.8" stroke-dasharray="3,2"/><text x="' + (X(R0) + 3).toFixed(1) + '" y="' + (T - 20 + dy) + '" font-size="8.5" fill="' + col + '">' + tx(lab) + '</text>'; };
    /* 資產用完：用精確的月份（跟第四章「資產到 X 就用完了」同一個數字），點畫在 0 的位置 */
    var ex = function (age, txt, lab) { if (age == null) return ''; return '<circle cx="' + X(age).toFixed(1) + '" cy="' + Y(0).toFixed(1) + '" r="3" fill="#9a2d12"/><text x="' + (X(age) + 6).toFixed(1) + '" y="' + (Y(0) - 5).toFixed(1) + '" font-size="8.5" fill="#9a2d12">' + tx((lab ? lab + ' ' : '') + txt + '用完') + '</text>'; };
    var body = cmp ? pl(cv.orig, '#8a8880', 1.4, true) + pl(cv.adj, '#1a4f8f', 2) + vline(cv.Ro, '#8a8880', '原始 ' + cv.RoText + '退休', 0) + vline(cv.Ra, '#1a4f8f', '調整後 ' + cv.RaText + '退休', 13) + ex(cv.exO, cv.exOText, '原始') + ex(cv.exA, cv.exAText, '調整後')
      : pl(cv.orig, '#2e6b1f', 2) + vline(cv.Ro, '#2e6b1f', cv.RoText + '退休', 13) + ex(cv.exO, cv.exOText, '');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Kai">' + g + body + '</svg>';
  }

  return { build: build, curveSvg: curveSvg };
}));
