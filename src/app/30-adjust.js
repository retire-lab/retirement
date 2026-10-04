/* src/app/30-adjust.js — 調調看、萬一……
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* ================= 調調看＋萬一……＋整頁預覽（v0.6.0） =================
     調整都只存在 S.adj，不改輸入；有調整時另建一份情境引擎（SP5Engine.scenario），整頁換成那個版本，
     頂端標示「你正在看」，按「回到原本」清掉。主結果（EN0）永遠不變。 */
  function pct(x) { return (Math.round(x * 1000) / 10).toString().replace(/\.0$/, '') + '%'; }
  var STEP_MONEY = 2000, ADJ_MAX = 80;
  /* 萬一……：每項都是加減按鈕 [key, 標籤, 每格, 最小, 最大, 說明] */
  var WI_STEPS = [
    ['gap', '收入中斷多久', 1, 0, 3, '從明年起，每格 1 年。期間沒有薪水，要自己繳國保、健保'],
    ['cut', '收入減少多少', 10, 0, 30, '從現在到退休，每格 10%'],
    ['spend', '晚年每月多花多少', 1, 0, 3, '從 75 歲起，每格 1 萬，例如醫療、長照'],
    ['inf', '通膨', 1, 0, 3, '每格 1%'],
    ['dep', '存款利率', 0.5, 0, 1.5, '每格降 0.5 個百分點，退休前後都降。跟通膨上升不一樣：房貸每月固定，不會因此變輕'],
    ['li', '勞保只領到', 10, 50, 100, '每格 10%，不是預測勞保會砍']
  ];
  var WI_NEUTRAL = { gap: 0, cut: 0, spend: 0, inf: 0, dep: 0, li: 100 };   /* 順序跟面板一致 */
  function adjState() { if (!S.adj) S.adj = { ret: null, more: 0, save: 0, end: null, wi: Object.assign({}, WI_NEUTRAL) }; return S.adj; }
  function adjReset() { S.adj = null; S.adjEdit = null; S.phase = null; S.ledger = false; S.year = null; S.ypage = null; }
  function adjChanged() { S.phase = null; S.ledger = false; S.year = null; S.ypage = null; }
  function infBase() { return Math.round(EN0.rates().inf * 1000) / 10; }
  function depBase() { return Math.round(EN0.rates().dep * 1000) / 10; }
  function depAfter(v) { return Math.round(Math.max(0, depBase() - v) * 10) / 10; }

  function wiLabel(k, v) { return ({ li: '勞保只領 ' + v + '%', inf: '通膨 ' + (Math.round((infBase() + v) * 10) / 10) + '%', dep: '存款利率 ' + depAfter(v) + '%', gap: '收入中斷 ' + v + ' 年', cut: '收入少 ' + v + '%', spend: '晚年每月多花 ' + v + ' 萬' })[k]; }
  /* 萬一……每一項現在的顯示值 */
  function wiVal(k, v) {
    if (k === 'li') return v === 100 ? '不打折' : v + '%';
    if (k === 'inf') return (Math.round((infBase() + v) * 10) / 10) + '%' + (v === 0 ? '（設定）' : '');
    if (k === 'dep') return depAfter(v) + '%' + (v === 0 ? '（設定）' : '');
    if (v === 0) return '不會';
    return k === 'gap' ? v + ' 年' : k === 'cut' ? '少 ' + v + '%' : '多 ' + v + ' 萬';
  }
  function wiOn(a) { return Object.keys(WI_NEUTRAL).filter(function (k) { return a.wi[k] !== WI_NEUTRAL[k]; }); }
  function adjActive() { var a = adjState(); return a.ret !== null || a.more !== 0 || a.save !== 0 || a.end !== null || wiOn(a).length > 0; }
  function adjOther() { var a = adjState(); return a.more !== 0 || a.save !== 0 || a.end !== null || wiOn(a).length > 0; }
  function yuan(n) { return Math.abs(Math.round(n)).toLocaleString('en-US'); }
  function adjLabels() {
    var a = adjState(), l = [];
    if (a.ret !== null) l.push('想在 ' + ageText(a.ret) + '退休');
    if (a.more) l.push((a.more < 0 ? '每月少花 ' : '每月多花 ') + yuan(a.more));
    if (a.save) l.push((a.save > 0 ? '每月多存 ' : '每月少存 ') + yuan(a.save));
    if (a.end !== null) l.push('活到 ' + a.end + ' 歲');
    wiOn(a).forEach(function (k) { l.push('萬一' + wiLabel(k, a.wi[k])); });
    return l;
  }
  function adjSel() { var a = adjState(), w = a.wi; return { li: w.li, inf: w.inf, dep: w.dep, gap: w.gap, cut: w.cut, spend: w.spend, more: a.more, save: a.save, end: a.end }; }
  function gapText(ev) { return ev.preExhaust !== null ? '退休前就用完' : ev.gap <= 0 ? '多出 ' + fmtW(-ev.gap) : '還差 ' + fmtW(ev.gap); }
  function bridgeText(e) { return e !== null && e < 60 - 1e-9 ? '60 歲以前退休，要靠存款撐 ' + durStr(monthsBetween(e, 60)) + '，勞退 60 歲才能領。' : ''; }

  /* 想在幾歲退休：按 + 或 − 對齊整歲（滿幾歲的生日） */
  function retSnap(cur, d) { var whole = Math.abs(cur - Math.round(cur)) < 1e-6; return d < 0 ? (whole ? Math.round(cur) - 1 : Math.floor(cur)) : (whole ? Math.round(cur) + 1 : Math.ceil(cur)); }
  function stepper(key, label, val, note, changed, canDec, canInc) {
    if (canDec === undefined) canDec = true; if (canInc === undefined) canInc = true;
    var a = adjState(), ed = S.adjEdit === key, mid;
    if (ed) {
      if (key === 'more' || key === 'save') {
        var opts = key === 'more' ? [['-1', '少花'], ['1', '多花']] : [['1', '多存'], ['-1', '少存']];
        var cur = key === 'more' ? (a.more <= 0 ? '-1' : '1') : (a.save < 0 ? '-1' : '1');
        mid = '<div class="sted"><select id="ed-dir" aria-label="' + label + '的方向">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
          '<input id="ed-val" type="text" inputmode="numeric" aria-label="每月幾元" value="' + (a[key] ? Math.abs(a[key]) : '') + '" placeholder="例如 2500"><span>元</span>' +
          '<button type="button" class="primary sm" data-editok="' + key + '">好</button></div>';
      } else if (key === 'ret') {
        var ry = EN0.ymOf(a.ret !== null ? a.ret : C.Radj);
        mid = '<div class="sted"><input id="ed-y" type="text" inputmode="numeric" aria-label="退休的年" value="' + ry.y + '" style="flex:0 0 4.2em"><span>年</span><input id="ed-m" type="text" inputmode="numeric" aria-label="退休的月" value="' + ry.m + '" style="flex:0 0 3em"><span>月</span><button type="button" class="primary sm" data-editok="ret">好</button></div>';
      } else mid = '<div class="sted"><input id="ed-val" type="text" inputmode="numeric" aria-label="' + label + '" value="' + (a.end !== null ? a.end : EN0.E()) + '"><span>歲</span><button type="button" class="primary sm" data-editok="end">好</button></div>';
      return '<div class="strow"><span class="stlab">' + label + '</span>' + mid + '</div>';
    }
    var editable = key === 'more' || key === 'save' || key === 'end' || key === 'ret';
    return '<div class="strow"><span class="stlab">' + label + '</span>' +
      (canDec ? '<button type="button" class="stb" data-step="' + key + ':-1" aria-label="' + label + '減少">−</button>' : '<span class="stb-sp" aria-hidden="true"></span>') +
      '<button type="button" class="stv' + (changed ? ' chg' : '') + '"' + (editable ? ' data-edit="' + key + '"' : ' disabled') + '>' + val + '</button>' +
      (canInc ? '<button type="button" class="stb" data-step="' + key + ':1" aria-label="' + label + '增加">+</button>' : '<span class="stb-sp" aria-hidden="true"></span>') +
      (changed ? '<button type="button" class="strst" data-rst="' + key + '" aria-label="' + label + '回復">回復</button>' : '<span class="strst-sp"></span>') +
      (note ? '<div class="stnote">' + note + '</div>' : '') + '</div>';
  }
  /* 調調看的兩組都可以收起；收起時標題後面寫出改了什麼 */
  function agOpen(key, title, sum) {
    var open = !S.agClosed || !S.agClosed[key];
    return '<details class="adjg" data-ag="' + key + '"' + (open ? ' open' : '') + '><summary><b>' + title + '</b><span class="' + (sum ? 'chg' : '') + '">' + (sum || '沒有調整') + '</span></summary><div class="adjgb">';
  }
  function adjCardHtml(c) {
    var a0 = adjState(), mine = [], wis = [];
    if (a0.ret !== null) mine.push('想在 ' + ageText(a0.ret) + '退休');
    if (a0.more) mine.push((a0.more < 0 ? '少花 ' : '多花 ') + yuan(a0.more));
    if (a0.save) mine.push((a0.save > 0 ? '多存 ' : '少存 ') + yuan(a0.save));
    if (a0.end !== null) wis.push('活到 ' + a0.end + ' 歲');
    wiOn(a0).forEach(function (k) { wis.push(wiLabel(k, a0.wi[k])); });
    var mineSum = mine.join('・'), wiSum = wis.join('・');
    var a = adjState(), base = W(S.spend), inc = W(S.inc), endV = a.end !== null ? a.end : EN0.E();
    var moreV = a.more === 0 ? '不變' : (a.more < 0 ? '少 ' : '多 ') + yuan(a.more), saveV = a.save === 0 ? '不變' : (a.save > 0 ? '多存 ' : '少存 ') + yuan(a.save);
    var retV = a.ret === null ? '最快（' + ageText(c.Radj) + '）' : ageText(a.ret) + '<small class="stym">' + ymText(a.ret, true) + '</small>', retCur = a.ret !== null ? a.ret : c.Radj, from = EN0.fromAge();
    var wi = WI_STEPS.map(function (x) {
      var v = a.wi[x[0]];
      return stepper('wi.' + x[0], x[1], wiVal(x[0], v), x[5], v !== WI_NEUTRAL[x[0]], v - x[2] >= x[3], v + x[2] <= x[4]);
    }).join('');
    return '<div id="adjCard">' +
      '<div class="muted">按一下就會重算，結果放在上面「調整後」那欄，原始不變。改過的項目可以單獨「回復」。</div>' +
      agOpen('mine', '你可以決定的', mineSum) +
      stepper('ret', '想在幾歲退休', retV, '每格 1 歲（滿幾歲的生日）；點中間可以輸入年月', a.ret !== null, retSnap(retCur, -1) >= from - 1e-9, retSnap(retCur, 1) <= ADJ_MAX + 1e-9) +
      stepper('more', '每月花費', moreV, '每格 2,000，點中間可以直接輸入', a.more !== 0, a.more - STEP_MONEY >= -base, true) +
      stepper('save', '每月多存', saveV, '每格 2,000，點中間可以直接輸入', a.save !== 0, a.save - STEP_MONEY >= -inc, true) +
      '</div></details>' + agOpen('wi', '萬一……', wiSum) + '<div class="muted" style="margin-top:0">你控制不了，但可能發生的事</div>' +
      stepper('end', '活到', endV + ' 歲', '每格 1 歲，點中間可以直接輸入', a.end !== null, endV > 66, endV < 105) +
      wi + '</div></details></div>';
  }
