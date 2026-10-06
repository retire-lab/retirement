/* src/app/10-quick.js — 快速開始
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* 出生年月底下的即時回饋：空著不寫（提示框已經有規則）、打錯了提醒規則、打對了顯示今年幾歲 */
  function paintAge() { var a = age(); $('ageText').textContent = a !== null ? '今年 ' + a + ' 歲' : (String(S.birth || '').trim() ? '西元年月，不用打 -' : ''); }
  function paintPrepay() {
    var box = $('preEst'); if (!box) return;
    var A0 = age(), at = num(S.housePreAge), yrs = num(S.houseYrs), pay = W(S.housePay), rt = num(S.houseRate);
    var base = '利率用來估算到時候還剩多少本金，銀行 App 或繳款單上查得到。';
    if (A0 === null || !isFinite(at) || !isFinite(yrs) || !isFinite(pay) || !isFinite(rt)) { box.textContent = base; box.className = 'qhint'; return; }
    var tAt = EN.tOfAge(at), left = Math.round(yrs * 12) - tAt;
    if (!(tAt > 0) || !(left > 0)) { box.textContent = '還清年齡要在 ' + (A0 + 1) + ' 到 ' + Math.max(A0 + 1, Math.ceil(A0 + yrs) - 1) + ' 歲之間。'; box.className = 'qhint bad'; return; }
    box.innerHTML = '到 ' + at + ' 歲（' + ymText(at, true) + '）大約要一次還 <b>' + fmtW(SP5Engine.loanBalance(pay, left, rt / 100)) + '</b>（當時的金額），之後不用再繳。';
    box.className = 'qhint ok';
  }
  function paintAccum() {
    var box = $('accum');
    if (String(S.inc).trim() === '' || String(S.spend).trim() === '') { box.hidden = true; return; }   /* 入帳或生活費沒填，不顯示 */
    var v = W(S.inc) - W(S.spend) - (S.house ? W(S.housePay) || 0 : 0) - (S.car ? W(S.carPay) || 0 : 0) - (S.parOn ? W(S.par) || 0 : 0) - kidMonthlyNow();
    if (!isFinite(v)) { box.hidden = true; return; }
    box.hidden = false;
    if (v < 0) { box.className = 'accum neg'; box.firstElementChild.textContent = '⚠️ 目前填的固定支出高於收入，請確認金額有沒有重複計算'; $('accumV').textContent = fmtW(v); }
    else { box.className = 'accum'; box.firstElementChild.textContent = '依目前填寫，你現在每月約可累積'; $('accumV').textContent = fmtW(v); }
  }
  function kidHtml(i) {
    var k = S.kids[i], st = kidStages(k.bym, k.path);
    if (!st) return { note: '填了出生年月，會列出還沒讀完的階段', on: false, html: '' };
    var gs = kidGroups(st);
    if (!gs.length) return { note: '已經畢業，不用計入', on: false, html: '' };
    var cur = st.filter(function (t) { return t.started && t.live; })[0];
    var src = S.kids[0] ? S.kids[0].costs : {};
    var html = gs.map(function (g, j) {
      var id = 'k' + i + g.g;
      if (i > 0 && k.costs[g.g] === undefined && src[g.g] !== undefined && src[g.g] !== '') { k.costs[g.g] = src[g.g]; k.copied = k.copied || {}; k.copied[g.g] = true; }
      var when = g.started ? '到 ' + ymStr(g.end) + '・還剩 ' + durStr(g.rem) : ymStr(g.start) + ' 起・共 ' + g.years + ' 年';
      var same = j > 0 ? '<button type="button" class="same" data-same="' + i + ':' + g.g + ':' + gs[j - 1].g + '">同上</button>' : '';
      return '<div class="stg"><label for="' + id + '">' + g.label + '<br><span>' + when + '</span></label>' +
        '<div class="stgin"><input id="' + id + '" type="text" inputmode="decimal" data-kid="' + i + '" data-group="' + g.g + '" placeholder="每年幾萬" value="' + esc(k.costs[g.g] || '') + '">' + same + '</div>' +
        (k.copied && k.copied[g.g] ? '<span class="cp">沿用第 1 個孩子</span>' : '') + '</div>';
    }).join('');
    var note = !cur ? '還沒出生' : cur.pre ? '現在是學齡前' : '現在讀' + cur.label + ' ' + cur.grade + ' 年級';
    return { note: note, on: true, html: html };
  }
  function paintKid(i) {
    var r = kidHtml(i), box = document.querySelector('[data-kidbox="' + i + '"]');
    if (!box) return;
    var n = box.querySelector('.knote'); n.textContent = r.note; n.className = 'knote' + (r.on ? ' on' : '');
    box.querySelector('.kst').innerHTML = r.html;
  }
  function paintKids() {
    $('kids').innerHTML = S.kids.map(function (k, i) {
      return '<div class="kid" data-kidbox="' + i + '"><div class="kidtop">' +
        '<div><label class="f" for="kby' + i + '">第 ' + (i + 1) + ' 個・出生年月</label><input id="kby' + i + '" type="text" inputmode="numeric" data-kidby="' + i + '" placeholder="西元年月，不用打 -" value="' + esc(k.bym) + '"></div>' +
        '<div><label class="f" for="kp' + i + '">打算讀到</label><select id="kp' + i + '" data-kidpath="' + i + '">' +
        SP5Engine.PATHS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === k.path ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<button type="button" data-delkid="' + i + '" aria-label="刪除第 ' + (i + 1) + ' 個孩子">刪除</button></div>' +
        '<div class="knote"></div><div class="kst"></div></div>';
    }).join('');
    S.kids.forEach(function (_, i) { paintKid(i); });
  }
  function showErr(m) { $('err').textContent = m; $('err').hidden = !m; }

  /* ================= result ================= */
  /* 年齡顯示：57.25 → 57 歲 3 個月；ymText → 西元年月 */
