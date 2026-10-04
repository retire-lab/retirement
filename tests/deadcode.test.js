/*
 * 死程式檢查（v0.9.3）：改版時留下沒用的東西，就讓測試失敗。
 * 讀 src/index.html 與 src/app/*.js（不需要 build），規則：
 *  1. CSS 定義的 class，畫面或程式裡要用得到
 *  2. 事件處理的按鈕 id、data-*，畫面或程式裡要產生得出來
 *  3. 程式用 $('id') 找的元素要存在
 *  4. S 的欄位不能只寫不讀
 *  5. 引擎對外公開的東西，要有人用（畫面、PDF、腳本或測試）
 * 用字串組出來的名稱（例如 'k-' + 類型、'sec-' + 名稱）列在 DYN，新增時要寫明理由。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const html = R('src/index.html');
const appDir = path.join(__dirname, '..', 'src', 'app');
const app = fs.readdirSync(appDir).filter((f) => /^\d\d-[\w-]+\.js$/.test(f)).sort().map((f) => fs.readFileSync(path.join(appDir, f), 'utf8')).join('\n');
const css = (html.match(/<style>([\s\S]*?)<\/style>/g) || []).join('\n');
const markup = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
const eng = R('src/engine.js'), pdfdoc = R('src/pdfdoc.js');
const tests = fs.readdirSync(__dirname).filter((f) => f.endsWith('.js') && f !== 'deadcode.test.js').map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n') + R('tests/e2e/ui.e2e.js');
const scripts = ['scripts/build.js', 'scripts/load-data.js', 'scripts/lint.js'].map(R).join('\n');
/* 用字串組出來的名稱（字面上搜尋不到） */
const DYN = {
  classPrefix: ['k-'],                       // 'k-' + PH_KIND（每個階段的顏色）
  idPrefix: ['sec-'],                        // 'sec-' + 開關名稱（快速開始的房貸、車貸…區塊）
  datasetWriteOnly: ['ferr']                 // 欄位錯誤訊息的標記：程式寫、測試讀
};
let ok = 0, bad = 0;
const t = (name, fn) => { try { fn(); ok++; console.log('  ✓ ' + name); } catch (e) { bad++; console.log('  ✗ ' + name + '\n      ' + e.message); } };
const word = (w) => new RegExp('(?<![\\w-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])');
console.log('■ 死程式檢查');

t('CSS 的每個 class 都有地方用（畫面或程式）', () => {
  const classes = [...new Set((css.replace(/url\([^)]*\)|\d+\.\d+/g, '').match(/\.[a-zA-Z][\w-]*/g) || []).map((x) => x.slice(1)))];
  const dead = classes.filter((c) => !DYN.classPrefix.some((p) => c.startsWith(p)) && !word(c).test(markup) && !word(c).test(app));
  assert.deepStrictEqual(dead, [], '沒用到的 class：' + dead.join(' '));
});
t('事件處理的按鈕 id 都存在（畫面或程式產生）', () => {
  const ids = [...new Set([...app.matchAll(/\b(?:b|t)\.id === '([\w-]+)'/g)].map((m) => m[1]))];
  const dead = ids.filter((i) => !DYN.idPrefix.some((p) => i.startsWith(p)) && !markup.includes('id="' + i + '"') && !app.includes('id="' + i + '"'));
  assert.deepStrictEqual(dead, [], '處理了但不存在的按鈕：' + dead.join(' '));
});
t('事件處理的 data-* 都存在（畫面或程式產生）', () => {
  const ks = [...new Set([...app.matchAll(/dataset\.(\w+)/g)].map((m) => m[1]))].filter((k) => !DYN.datasetWriteOnly.includes(k));
  const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  const dead = ks.filter((k) => !app.includes('data-' + kebab(k) + '=') && !markup.includes('data-' + kebab(k) + '='));
  assert.deepStrictEqual(dead, [], '處理了但沒有任何元素帶這個屬性：' + dead.map((k) => 'data-' + kebab(k)).join(' '));
});
t("程式用 $('id') 找的元素都存在", () => {
  const ids = [...new Set([...app.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]))];
  const dead = ids.filter((i) => !DYN.idPrefix.some((p) => i.startsWith(p)) && !markup.includes('id="' + i + '"') && !app.includes('id="' + i + '"'));
  assert.deepStrictEqual(dead, [], '找不到的元素：' + dead.join(' '));
});
t('S 的欄位沒有只寫不讀', () => {
  const fields = [...new Set([...app.matchAll(/\bS\.(\w+)/g)].map((m) => m[1]))];
  const inKeys = app.match(/var IN_KEYS = \[([^\]]*)\]/), IN = inKeys ? inKeys[1] : '';
  const dead = fields.filter((f) => !IN.includes("'" + f + "'") && !new RegExp('\\bS\\.' + f + '\\b(?!\\s*=(?!=))').test(app));
  assert.deepStrictEqual(dead, [], '只寫不讀：' + dead.map((f) => 'S.' + f).join(' '));
});
t('引擎對外公開的東西都有人用（畫面、PDF、腳本或測試）', () => {
  const blocks = [eng.match(/var api = \{([\s\S]*?)\n {2}\};/)[1], eng.match(/return \{\s*\n\s*VERSION: VERSION, NOWI[\s\S]*?\};/)[0]];
  const keys = [...new Set(blocks.flatMap((b) => [...b.matchAll(/(\w+)\s*:\s*[\w.(]/g)].map((m) => m[1])))];
  const users = app + pdfdoc + scripts + tests;
  const dead = keys.filter((k) => !new RegExp('[.\\s]' + k + '\\b|\\b' + k + ' = EN\\.' + k).test(users));
  assert.deepStrictEqual(dead, [], '公開了但沒人用：' + dead.join(' '));
});
console.log('  ' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
