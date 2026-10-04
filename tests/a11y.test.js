/*
 * 無障礙自動檢查（v0.9.1）：axe-core 在模擬瀏覽器裡掃描每個主要畫面。
 * 顏色對比在 jsdom 算不出來（沒有排版），所以關掉；其餘規則全開。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');

function mk() {
  const errs = [];
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', url: 'https://u.github.io/', pretendToBeVisual: true, beforeParse(w) { w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; w.addEventListener('error', (e) => errs.push(e.message)); } });
  const W = dom.window, d = W.document;
  W.eval(axeSrc);
  const click = (e) => { if (!e) throw new Error('找不到元素'); if (e.closest && e.closest('[inert]')) throw new Error('點到被設成不可操作的元素（真的瀏覽器點不到）：' + (e.id || e.className || e.tagName)); e.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
  const type = (id, v) => { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new W.Event('input', { bubbles: true })); e.dispatchEvent(new W.Event('change', { bubbles: true })); };
  return { W, d, errs, click, type };
}
async function scan(A) {
  const r = await A.W.axe.run(A.d, { rules: { 'color-contrast': { enabled: false } }, resultTypes: ['violations'] });
  return r.violations.map((v) => v.id + '（' + v.impact + '）：' + v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('、') + (v.nodes.length > 3 ? ' 等 ' + v.nodes.length + ' 處' : ''));
}
const steps = [
  ['快速開始（空白）', () => {}],
  ['快速開始：直接按「算」的錯誤訊息', (A) => A.click(A.d.getElementById('go'))],
  ['結果頁', (A) => { [['birth', '1986-06'], ['workStart', '25'], ['asset', '500'], ['inc', '9'], ['spend', '4.5']].forEach(([k, v]) => A.type(k, v)); A.click(A.d.getElementById('go')); }],
  ['結果頁：每個階段展開一段', (A) => A.click(A.d.querySelector('#mapCard .phc'))],
  ['調調看＋對照表＋兩條色條', (A) => { A.click(A.d.getElementById('tgAdj')); A.click(A.d.querySelector('[data-step="more:-1"]')); A.click(A.d.querySelector('[data-step="wi.dep:1"]')); }],
  ['提高準確度（含一項填錯）', (A) => { A.click(A.d.getElementById('tgPrec')); A.type('pLy', 'abc'); }],
  ['分享視窗', (A) => A.click(A.d.getElementById('shareBtn'))],
  ['方案清單', (A) => { A.click([...A.d.querySelectorAll('#mBtns button')].find((b) => /取消/.test(b.textContent))); A.click(A.d.getElementById('openList')); }],
  ['匯出視窗', (A) => A.click(A.d.getElementById('expAll'))]
];
(async () => {
  console.log('■ 無障礙自動檢查（axe-core，顏色對比除外）');
  const A = mk(); let ok = 0, bad = 0;
  for (const [name, fn] of steps) {
    try { fn(A); const v = await scan(A); if (v.length) { bad++; console.log('  ✗ ' + name + '\n      ' + v.join('\n      ')); } else { ok++; console.log('  ✓ ' + name + '：沒有問題'); } }
    catch (e) { bad++; console.log('  ✗ ' + name + '（' + e.message + '）'); }
  }
  if (A.errs.length) { bad++; console.log('  ✗ 執行錯誤：' + A.errs.join('；')); }
  console.log('  ' + ok + ' 通過，' + bad + ' 失敗');
  process.exit(bad ? 1 : 0);
})();
