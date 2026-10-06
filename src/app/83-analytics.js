/* src/app/83-analytics.js — 使用統計（GA4，v0.9.5）
 * 這個檔案不是獨立的模組：建置時 src/app/ 的檔案依檔名順序接起來，包在同一個函式裡（共用變數）。
 * 產生 src/app.generated.js，再內嵌進 dist/index.html。 */
  /* ================= 使用統計（GA4） =================
     1. 只在正式網站（retire-lab.github.io）載入；Claude 暫存版、本機測試都不送，數據不被污染。
     2. 關掉 Google 信號與廣告個人化。
     3. 事件白名單：只能送預先定義的事件名稱，參數只能是列出來的選項值（例如 full／anon、true／false）。
        任何不在清單裡的東西都會被丟掉，所以從結構上不可能把使用者填的數字送出去。
     4. 被廣告阻擋外掛擋掉、或 GA 本身出錯，網站照常運作。 */
  var GA_ID = 'G-84G3K51M8Q', GA_HOST = 'retire-lab.github.io';
  var GA_EVENTS = {
    calculation_complete: {},
    couple_mode_open: {},                                       // v1.0：選「我和另一半」
    couple_calculation_complete: {},                            // v1.0：夫妻模式按「算」並算出結果
    couple_adjust_open: {},                                     // v1.0：夫妻模式打開調調看
    couple_precision_open: {},                                  // v1.0：夫妻模式打開提高準確度                                   // 快速開始按「算」並算出結果
    adjust_open: {}, precision_open: {}, share_open: {},       // 打開調調看、提高準確度、分享視窗
    pdf_generate: { variant: ['full', 'anon'], encrypted: [true, false], mode: ['single', 'compare'] },
    backup_export: { encrypted: [true, false] }, backup_import: {},
    feedback_click: {}                                          // 點「回報問題」
  };
  function gaOn() { try { return location.hostname === GA_HOST; } catch (e) { return false; } }
  function gaInit() {
    if (!gaOn() || window.__sp5ga) return;
    window.__sp5ga = true;
    try {
      window.dataLayer = window.dataLayer || [];
      if (typeof window.gtag !== 'function') window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      document.head.appendChild(s);
    } catch (e) {}
  }
  function track(name, params) {
    try {
      if (!gaOn() || typeof window.gtag !== 'function') return;
      var spec = GA_EVENTS[name]; if (!spec) return;
      var p = {};
      Object.keys(params || {}).forEach(function (k) { if (spec[k] && spec[k].indexOf(params[k]) >= 0) p[k] = params[k]; });
      window.gtag('event', name, p);
    } catch (e) {}
  }
