  /* 47-couple-panels.js — 夫妻模式的調調看與提高準確度（v1.0.3 從 45-couple.js 拆出來，純搬家） */
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
