/* src/app/00-state.js — 狀態、引擎綁定
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* ================= state ================= */
  /* 快速開始一律從空白開始（v0.7.2）：範例只放在欄位的灰色提示文字裡。畫面欄位與這裡的狀態都要是空的，
     否則會出現「欄位空白、結果卻用範例數字算」的情況 */
  /* C：畫面算出來的暫存結果（v0.8.0 從 S 分出來）。S 只放使用者的輸入與畫面狀態；C 每次 paintResult() 重算，不存檔。
     ctx：結果頁的計算上下文（PDF 用）、heroHtml：結果卡的文字、Rorig／Radj：原始與調整後的退休時間、preEst：提高準確度的估算值 */
  var C = {};
  var S = { birth: '', workStart: '', asset: '', inc: '', spend: '',
    house: false, car: false, kidsOn: false, parOn: false,
    housePay: '', houseYrs: '', housePre: false, housePreAge: '', houseRate: '', parMode: 'keep', parYrs: '', carPay: '', carYrs: '', par: '',
    kids: [{ bym: '', path: 'grad', costs: {} }],
    ledger: false,
    pre: { liYears: '', w60: '', lsBal: '', lsWage: '', lsYears: '', liClaim: '', self: '0', endAge: '', nhiDep: false, inf: '', dep: '', oldOn: false, oHire: '', oYrs: '', oWage: '', gaps: [], liMode: '', liPre09: false, sex: '', sameCo: '', w36: '' } };
  var $ = function (id) { return document.getElementById(id); };
  /* 引擎：全專案唯一的一份，綁定同一個輸入物件 S（S 的輸入欄位變了，引擎讀到的就是新的） */
  var EN = SP5Engine.create(S);
  var EN0 = EN;
  var num = EN.num, W = EN.W, fmtW = EN.fmtW, esc = EN.esc, ymStr = EN.ymStr, durStr = EN.durStr, age = EN.age, kidStages = EN.kidStages, kidGroups = EN.kidGroups, kidMonthlyNow = EN.kidMonthlyNow, profile = EN.profile, lsBalNowEst = EN.lsBalNowEst, ledger = EN.ledger, evalR = EN.evalR, solve = EN.solve, earliest = EN.earliest, validate = EN.validate, yearsMonthsUntil = EN.yearsMonthsUntil, phases = EN.phases, impactEvents = EN.impactEvents, estList = EN.estList;
  /* 預覽：暫時把引擎函式切到情境引擎，畫完再切回 EN0 */
  function bindEngine(en) {
    EN = en; profile = en.profile; lsBalNowEst = en.lsBalNowEst; ledger = en.ledger; evalR = en.evalR;
    solve = en.solve; earliest = en.earliest; validate = en.validate; yearsMonthsUntil = en.yearsMonthsUntil; phases = en.phases; impactEvents = en.impactEvents;
    estList = en.estList;
  }




