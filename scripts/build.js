#!/usr/bin/env node
/*
 * 1. 把 data/（CSV、JSON）轉成 src/data.generated.js（window.SP5_DATA = …）
 * 2. 把 data.generated.js 與 engine.js 塞進 src/index.html，輸出單一檔案 dist/index.html
 *
 * 開發時：先跑一次 build，之後直接開 src/index.html（它用 <script src> 讀這兩個檔）。
 * 上線的是 dist/index.html，只有一個檔案，引擎與資料都只有一份。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const loadData = require('./load-data.js');

const root = path.join(__dirname, '..');
const src = (f) => path.join(root, 'src', f);
const outDir = path.join(root, 'dist');

// 1. 資料
const data = loadData();
const dataJs = '/* 由 scripts/build.js 從 data/ 自動產生，請勿手改 */\nwindow.SP5_DATA = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(src('data.generated.js'), dataJs);

// 2. 內嵌
let html = fs.readFileSync(src('index.html'), 'utf8');
const engine = fs.readFileSync(src('engine.js'), 'utf8');
const pieces = [['<script src="data.generated.js"></script>', dataJs], ['<script src="engine.js"></script>', engine]];
for (const [tag, code] of pieces) {
  if (html.split(tag).length !== 2) { console.error('build 失敗：src/index.html 裡必須剛好有一個 ' + tag); process.exit(1); }
  if (code.includes('</script')) { console.error('build 失敗：' + tag + ' 的內容不能出現 </script'); process.exit(1); }
  html = html.replace(tag, () => '<script>\n' + code + '\n</script>');
}
const version = (engine.match(/var VERSION = '([^']+)'/) || [])[1] || 'dev';
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const out = '<!-- SP5 v' + version + '，build ' + stamp + ' UTC，資料版本 ' + data.params.version + '。請勿直接修改這個檔案，改 src/ 或 data/ 之後重新 build。 -->\n' + html;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), out);
console.log('已輸出 dist/index.html（v' + version + '，資料 ' + data.params.version + ' 年版，' + Math.round(out.length / 1024) + ' KB）');
