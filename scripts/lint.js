#!/usr/bin/env node
/* ESLint：一般檔案照常檢查；src/app/*.js 接起來（跟 build 一樣的順序）再檢查，錯誤行號換算回原本的檔案。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');
const root = path.join(__dirname, '..');

(async () => {
  const eslint = new ESLint({ cwd: root });
  const results = await eslint.lintFiles(['src/engine.js', 'src/pdfdoc.js', 'scripts', 'tests', 'eslint.config.js']);
  /* 畫面程式：接起來，記下每個檔案從第幾行開始 */
  const dir = path.join(root, 'src', 'app');
  const files = fs.readdirSync(dir).filter((f) => /^\d\d-[\w-]+\.js$/.test(f)).sort();
  let text = '(function () {\n', line = 2; const map = [];
  for (const f of files) { const t = fs.readFileSync(path.join(dir, f), 'utf8'); map.push({ f: 'src/app/' + f, start: line, n: t.split('\n').length - 1 }); text += t; line += t.split('\n').length - 1; }
  text += '})();\n';
  const [app] = await eslint.lintText(text, { filePath: path.join(root, 'src', 'app.generated.js') });
  const where = (ln) => { const m = map.find((x) => ln >= x.start && ln < x.start + x.n); return m ? m.f + ':' + (ln - m.start + 1) : 'src/app（接起來的第 ' + ln + ' 行）'; };

  let err = 0, warn = 0;
  const show = (file, msgs) => msgs.forEach((m) => { (m.severity === 2 ? err++ : warn++); console.log('  ' + (m.severity === 2 ? '✗' : '!') + ' ' + file(m.line) + ':' + m.column + '  ' + m.message + (m.ruleId ? '（' + m.ruleId + '）' : '')); });
  for (const r of results) show((ln) => path.relative(root, r.filePath) + ':' + ln, r.messages);
  show(where, app.messages);
  console.log('■ ESLint：' + (results.length + files.length) + ' 個檔案，' + err + ' 個錯誤' + (warn ? '、' + warn + ' 個警告' : ''));
  process.exit(err ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
