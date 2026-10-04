#!/usr/bin/env node
/*
 * 畫面結構測試（不需要任何套件）：v0.4.1 曾經少一個 </div>，
 * 讓車貸、子女、孝親、舊制全被包進房貸區塊，沒勾房貸就看不到。這裡防止同類錯誤再發生。
 */
'use strict';
const fs = require('fs'), path = require('path');
const { assert, suite } = require('./_helper');
const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
/* v0.8.0 起畫面程式拆到 src/app/（建置時接回去）：檢查文字與結構時，把它們放回 <script src="app.generated.js"> 的位置一起看 */
const appDir = path.join(__dirname, '..', 'src', 'app');
const appSrc = fs.readdirSync(appDir).filter((f) => /^\d\d-[\w-]+\.js$/.test(f)).sort().map((f) => fs.readFileSync(path.join(appDir, f), 'utf8')).join('\n');
const html = page.replace('<script src="app.generated.js"></script>', () => '<script>\n' + appSrc + '\n</script>');
const body = html.slice(html.indexOf('<body>'), html.indexOf('<script'));
const S = suite('畫面結構');
const t = S.test;

/* 迷你 HTML 解析：記錄每個元素的祖先 id */
const VOID = new Set(['input', 'br', 'img', 'meta', 'link', 'hr']);
const stack = [], ancestors = {}, ids = [], errors = [];
const re = /<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>/g;
let m;
while ((m = re.exec(body))) {
  const [, close, tag, attrs] = m, name = tag.toLowerCase();
  if (VOID.has(name)) continue;
  if (close) {
    const top = stack.pop();
    if (!top || top.tag !== name) errors.push('第 ' + body.slice(0, m.index).split('\n').length + ' 行：</' + name + '> 對不上 <' + (top ? top.tag : '無') + '>');
  } else {
    const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
    if (id) { ids.push(id); ancestors[id] = stack.filter((x) => x.id).map((x) => x.id); }
    stack.push({ tag: name, id });
  }
}

t('所有標籤正確配對（沒有少 </div>）', () => assert.deepStrictEqual(errors, []));
t('解析完畢後沒有沒關的標籤', () => assert.strictEqual(stack.filter((x) => x.tag !== 'body').length, 0, '還有 ' + stack.map((x) => x.tag + (x.id ? '#' + x.id : '')).join(', ') + ' 沒關'));
t('id 沒有重複', () => { const dup = ids.filter((x, i) => ids.indexOf(x) !== i); assert.deepStrictEqual(dup, []); });
['sec-house', 'sec-car', 'sec-kidsOn', 'sec-parOn'].forEach((sec) => {
  t(sec + '：存在，而且不被其他可收合區塊包住', () => {
    assert.ok(ancestors[sec], '找不到 ' + sec);
    const bad = ancestors[sec].filter((a) => /^sec-/.test(a));
    assert.deepStrictEqual(bad, [], sec + ' 被包在 ' + bad.join(' > ') + ' 裡');
  });
});
t('sec-housePre（提前還清）在房貸區塊裡，而且只在房貸裡', () => assert.deepStrictEqual(ancestors['sec-housePre'].filter((a) => /^sec-/.test(a)), ['sec-house']));
t('四個勾選卡片都對應到存在的區塊', () => {
  (body.match(/data-chip="([^"]+)"/g) || []).map((x) => x.match(/"([^"]+)"/)[1]).forEach((k) => assert.ok(ids.includes('sec-' + k), '缺 sec-' + k));
});
t('快速開始的每個輸入欄位都有對應的 label', () => {
  const inputs = (body.match(/<input[^>]+id="([^"]+)"[^>]*>/g) || []).map((x) => x.match(/id="([^"]+)"/)[1]);
  inputs.filter((id) => !/^(housePre)$/.test(id) && !/parYrs/.test(id)).forEach((id) => assert.ok(new RegExp('for="' + id + '"').test(body), id + ' 沒有 label'));
});
t('引擎與資料用 <script src> 引入（build 會內嵌）', () => {
  assert.ok(html.includes('<script src="data.generated.js"></script>')); assert.ok(html.includes('<script src="engine.js"></script>'));
  assert.ok(html.indexOf('data.generated.js') < html.indexOf('src="engine.js"'), '資料要在引擎之前載入');
});
t('v0.6.0 起改回「多存」（不靠投資，「投入」容易被誤會成投資）：畫面上不出現「多投入」', () => assert.ok(!/多投入/.test(html), '還有「多投入」'));
t('v0.6.0：舊的分頁、試試看、壓力測試、地圖選單都已拿掉', () => { assert.ok(!/data-tab=|壓力測試|id="retAge"|tryPanel|stressPanel/.test(html)); });
t('畫面上不再出現「勞退月退停發」', () => assert.ok(!/停發/.test(html)));
t('畫面上不說「你的投資報酬率」（使用者沒輸入投資，改稱資產報酬率）', () => assert.ok(!/投資報酬率/.test(html)));
t('快速開始在「名下可自由動用的錢」旁寫明不算投資', () => assert.ok(/試算不算投資/.test(html)));
t('畫面上不再出現「退休前每年賺 5%」這類投資報酬假設', () => assert.ok(!/每年賺 5%|名目報酬 5%|報酬 5%/.test(html)));

t('網頁標題是「退休生命週期決策平台｜Retirement Lifecycle Decision Platform」', () => assert.ok(/<title>退休生命週期決策平台｜Retirement Lifecycle Decision Platform<\/title>/.test(html)));
t('頁首有中英文平台名稱', () => assert.ok(/退休生命週期決策平台/.test(body) && /Retirement Lifecycle Decision Platform/.test(body)));
t('使用者看得到的文字不出現 SP5、SP2（程式內部名稱、存檔前綴不算）', () => {
  const visible = html.replace(/SP5Engine|sp5:/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const strs = (visible.match(/'[^'\n]*'|"[^"\n]*"|>[^<]+</g) || []).filter((x) => /SP5|SP2/.test(x));
  assert.deepStrictEqual(strs, []);
});

t('快速開始不再有勞退舊制（移到提高準確度）', () => { assert.ok(!ids.includes('oldOn') && !ids.includes('sec-oldOn') && !ids.includes('oHire')); });

t('快速開始寫明「只算你自己負擔的那一份」與資料不會上傳', () => { assert.ok(/只算你自己負擔的那一份；有配偶的話，假設對方繼續負擔他的家用份額/.test(html)); assert.ok(/不會上傳/.test(html)); });
t('結果頁的長串假設仍保留「並假設配偶持續負擔其目前的家用份額」原文', () => assert.ok(/並假設配偶持續負擔其目前的家用份額/.test(html)));

t('快速開始寫明適用範圍：只算勞保、勞退，公教軍人、農民不適用', () => assert.ok(/只算勞保、勞退；公務員、教師、軍人、農民的退休制度不同，結果不適用/.test(html)));

t('快速開始的五個欄位沒有預填數字（範例只放在 placeholder）', () => { ['birth', 'workStart', 'asset', 'inc', 'spend'].forEach((k) => { const m = html.match(new RegExp('<input id="' + k + '"[^>]*>')); assert.ok(m, k); assert.ok(!/ value="/.test(m[0]), k + ' 不該有 value'); assert.ok(/placeholder="例如 /.test(m[0]), k + ' 要有例如'); }); });

process.exit(S.run() ? 1 : 0);
