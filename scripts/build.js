#!/usr/bin/env node
/*
 * 1. 把 data/（CSV、JSON）轉成 src/data.generated.js（window.SP5_DATA = …）
 * 2. 把 data.generated.js 與 engine.js 塞進 src/index.html，輸出單一檔案 dist/index.html
 *
 * 開發時：先跑一次 build，之後直接開 src/index.html（它用 <script src> 讀這兩個檔）。
 * 上線的是 dist/index.html，只有一個檔案，引擎與資料都只有一份。
 * 3.（v0.7.0）PDF：產生器 pdfdoc.js 一起內嵌；pdfmake 與楷書子集字型複製到 dist/vendor、dist/fonts，按下「產生 PDF」才下載。
 *    另外輸出 dist/preview.html：程式庫與字型都內嵌在同一個檔案裡（給只能放單一檔案的預覽環境用）。
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

// 2. PDF 資產：字型子集（scripts/build-font.py 產生）與 pdfmake
const crypto = require('crypto');
const fontFile = path.join(root, 'fonts', 'kai-subset.ttf');
const fontBuf = fs.readFileSync(fontFile);
const fontVer = crypto.createHash('sha1').update(fontBuf).digest('hex').slice(0, 10);
const fontChars = fs.readFileSync(path.join(root, 'fonts', 'kai-chars.txt'), 'utf8');
const fontName = fs.readFileSync(path.join(root, 'fonts', 'FONT-NAME.txt'), 'utf8').trim();
const pdfmakeFile = path.join(root, 'node_modules', 'pdfmake', 'build', 'pdfmake.min.js');
if (!fs.existsSync(pdfmakeFile)) { console.error('build 失敗：找不到 pdfmake，請先執行 npm install'); process.exit(1); }
const assetsJs = '/* 由 scripts/build.js 自動產生，請勿手改 */\nwindow.SP5_PDF_ASSETS = ' + JSON.stringify({ lib: 'vendor/pdfmake.min.js?v=' + require(path.join(root, 'node_modules', 'pdfmake', 'package.json')).version, font: 'fonts/kai-subset.ttf?v=' + fontVer, fontBytes: fontBuf.length, fontVer: fontVer }) +
  ';\nwindow.SP5_FONT_NAME = ' + JSON.stringify(fontName) + ';\nwindow.SP5_FONT_CHARS = ' + JSON.stringify(fontChars) + ';\n';
fs.writeFileSync(src('pdfassets.generated.js'), assetsJs);

// 2.5（v0.8.0）畫面程式：src/app/*.js 依檔名順序接起來，包在同一個函式裡（共用變數）→ src/app.generated.js
const appDir = src('app');
const appFiles = fs.readdirSync(appDir).filter((f) => /^\d\d-[\w-]+\.js$/.test(f)).sort();
const stripHead = (t) => t.replace(/^\/\* src\/app\/[\s\S]*?\*\/\n/, '');   // 每個檔案開頭的說明註解不放進成品
const appJs = '(function () {\n' + appFiles.map((f) => stripHead(fs.readFileSync(path.join(appDir, f), 'utf8'))).join('') + '})();';
fs.writeFileSync(src('app.generated.js'), appJs);

// 3. 內嵌
let html = fs.readFileSync(src('index.html'), 'utf8');
const engine = fs.readFileSync(src('engine.js'), 'utf8');
const pdfdoc = fs.readFileSync(src('pdfdoc.js'), 'utf8');
const pieces = [['<script src="data.generated.js"></script>', dataJs], ['<script src="engine.js"></script>', engine], ['<script src="pdfdoc.js"></script>', pdfdoc], ['<script src="pdfassets.generated.js"></script>', assetsJs.replace(/<\//g, '<\\/')], ['<script src="app.generated.js"></script>', appJs]];
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
fs.mkdirSync(path.join(outDir, 'vendor'), { recursive: true }); fs.mkdirSync(path.join(outDir, 'fonts'), { recursive: true });
fs.copyFileSync(pdfmakeFile, path.join(outDir, 'vendor', 'pdfmake.min.js'));
fs.copyFileSync(fontFile, path.join(outDir, 'fonts', 'kai-subset.ttf'));
fs.copyFileSync(path.join(root, 'fonts', 'LICENSE-ARPHIC.txt'), path.join(outDir, 'fonts', 'LICENSE-ARPHIC.txt'));
// 預覽用單一檔案：程式庫與字型內嵌（JSON 字串化，並把 </ 換掉，避免提早結束 <script>）
const asciiJson = (txt) => JSON.stringify(txt).replace(/<\//g, '<\\/').replace(/[\u007f-\uffff]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));   // 非 ASCII 一律跳脫（程式庫字串裡有 U+FFFD 等字元）
const inline = '<script>window.SP5_PDF_INLINE = { lib: ' + asciiJson(fs.readFileSync(pdfmakeFile, 'utf8')) + ', font: ' + JSON.stringify(fontBuf.toString('base64')) + ' };</script>\n';
const preview = out.replace('<script>', () => inline + '<script>');
fs.writeFileSync(path.join(outDir, 'preview.html'), preview);
console.log('已輸出 dist/index.html（v' + version + '，資料 ' + data.params.version + ' 年版，' + Math.round(out.length / 1024) + ' KB）＋ PDF 字型 ' + (fontBuf.length / 1048576).toFixed(2) + ' MB、預覽單檔 ' + (preview.length / 1048576).toFixed(1) + ' MB');
