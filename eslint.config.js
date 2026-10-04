/* ESLint（v0.8.0）：先只開「抓 bug」的規則，不管風格。
 * src/app/*.js 不是獨立模組，由 scripts/lint.js 接起來再檢查（行號會換算回原檔）。 */
'use strict';
const js = require('@eslint/js');
const globals = require('globals');

const bugRules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  'no-empty': ['error', { allowEmptyCatch: true }],   // try { localStorage… } catch (e) {} 是刻意的
  'no-redeclare': 'error',
  'no-shadow-restricted-names': 'error'
};

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', 'src/data.generated.js', 'src/pdfassets.generated.js', 'src/app/**', 'fonts/**'] },
  { files: ['src/engine.js', 'src/pdfdoc.js'], languageOptions: { ecmaVersion: 2017, sourceType: 'script', globals: { ...globals.browser, module: 'readonly', require: 'readonly', self: 'readonly', SP5_DATA: 'readonly' } }, rules: bugRules },
  { files: ['src/app.generated.js'], languageOptions: { ecmaVersion: 2017, sourceType: 'script', globals: { ...globals.browser, SP5Engine: 'readonly', SP5PdfDoc: 'readonly', SP5_DATA: 'readonly' } }, rules: bugRules },
  { files: ['scripts/**/*.js', 'tests/**/*.js', 'eslint.config.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } }, rules: bugRules }
];
