/*
 * 方案匯出／匯入測試（v0.8.1）：模擬瀏覽器操作 dist/index.html，用 Node 真正的 Web Crypto 加解密。
 * 需要：npm install（jsdom）與 npm run build
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const { webcrypto } = require('crypto');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
const tests = []; const t = (name, fn) => tests.push({ name, fn });
const T = (s) => String(s).replace(/\s+/g, ' ').trim();
const J = (x) => JSON.parse(JSON.stringify(x));
const wait = (ms) => new Promise((r) => setTimeout(r, ms || 30));
const X = 'X"\'><i id=xss></i>';

const blank = () => ({ birth: '', workStart: '', asset: '', inc: '', spend: '', house: false, car: false, kidsOn: false, parOn: false, housePay: '', houseYrs: '', housePre: false, housePreAge: '', houseRate: '', carPay: '', carYrs: '', par: '', parMode: 'keep', parYrs: '',
  kids: [{ bym: '', path: 'grad', costs: {} }], pre: { liYears: '', w60: '', lsBal: '', lsWage: '', lsYears: '', liClaim: '', self: '0', endAge: '', nhiDep: false, inf: '', dep: '', oldOn: false, oHire: '', oYrs: '', oWage: '', gaps: [], liMode: '', liPre09: false, sex: '', sameCo: '', w36: '' } });
const mkIn = (o, pre) => { const b = blank(); Object.assign(b, o); Object.assign(b.pre, pre || {}); return b; };
const A_IN = mkIn({ birth: '1986-06', workStart: '25', asset: '500', inc: '9', spend: '4.5', house: true, housePay: '2', houseYrs: '10', kidsOn: true, kids: [{ bym: '2018-03', path: 'uni', costs: { ele: '2', jun: '2', sen: '2', uni: '3' } }] }, { liYears: '15', gaps: [{ sit: 'parental', y: '1', m: '0' }] });
const B_IN = mkIn({ birth: '1974-11', workStart: '25', asset: '450', inc: '9', spend: '4' });

function app(list, active) {
  const errs = [], dl = { files: [] };
  const store = list ? { 'sp5:data': JSON.stringify({ v: 1, active: active || list[0].id, list, cmp: [], showAll: false }) } : {};
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', url: 'https://u.github.io/', beforeParse(w) {
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });       // 真正的 Web Crypto
    for (const k in store) w.localStorage.setItem(k, store[k]);
    w.addEventListener('error', (e) => errs.push(e.message));
    w.fetch = () => { dl.fetch = (dl.fetch || 0) + 1; return Promise.reject(new Error('不該連網路')); };
    let last = null;
    w.URL.createObjectURL = (b) => { last = b; return 'blob:x'; }; w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () { dl.files.push({ name: this.download, blob: last }); };
  } });
  const d = dom.window.document, W = dom.window;
  const click = (e) => { if (!e) throw new Error('找不到元素'); if (e.closest && e.closest('[inert]')) throw new Error('點到被設成不可操作的元素（真的瀏覽器點不到）：' + (e.id || e.className || e.tagName)); e.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
  const chg = (e) => e.dispatchEvent(new W.Event('change', { bubbles: true }));
  const mb = (label) => [...d.querySelectorAll('#mBtns button')].find((b) => T(b.textContent) === label || T(b.textContent).startsWith(label));
  const db = () => JSON.parse(W.localStorage.getItem('sp5:data'));
  const title = () => T(d.getElementById('mTitle').textContent), body = () => T(d.getElementById('mBody').textContent);
  return { d, W, errs, dl, click, chg, mb, db, title, body, list: () => click(d.getElementById('openList')) };
}
const two = () => [{ id: 's1', name: '我的第一個方案', saved: A_IN, updated: '2026/10/03 21:00' }, { id: 's2', name: '55 歲退休', saved: B_IN, updated: '2026/10/04 09:30' }];
async function exportFile(A, pw) {
  A.list(); A.click(A.d.getElementById('expAll'));
  if (pw) { A.d.getElementById('bkP1').value = pw; A.d.getElementById('bkP2').value = pw; }
  else { const c = A.d.getElementById('bkPwOn'); c.checked = false; A.chg(c); }
  const n0 = A.dl.files.length; A.click(A.mb('匯出'));
  for (let i = 0; i < 200 && A.dl.files.length === n0; i++) await wait(25);
  const f = A.dl.files[A.dl.files.length - 1]; return { name: f.name, text: await f.blob.text() };
}
async function decryptNode(env, pw) {
  const enc = new TextEncoder(), b = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
  const base = await webcrypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b(env.kdf.salt), iterations: env.kdf.iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: b(env.cipher.iv) }, key, b(env.data))));
}
async function until(fn, ms) { for (let i = 0; i < (ms || 4000) / 25; i++) { if (fn()) return true; await wait(25); } return false; }

/* ===== 匯出 ===== */
t('方案清單有「備份」：匯出所有方案、匯入方案，清除資料移到同一張卡', async () => { const A = app(two()); A.list(); assert.ok(A.d.getElementById('expAll') && A.d.getElementById('impBtn') && A.d.getElementById('wipe')); assert.ok(/換手機、清除瀏覽器資料就會不見/.test(T(A.d.getElementById('list').textContent))); });
t('匯出視窗：寫明幾個方案、檔名；預設加密碼', async () => { const A = app(two()); A.list(); A.click(A.d.getElementById('expAll')); assert.strictEqual(A.title(), '匯出所有方案'); assert.ok(/2 個方案/.test(A.body()) && /退休試算方案_\d{4}-\d{2}-\d{2}\.json/.test(A.body())); assert.ok(A.d.getElementById('bkPwOn').checked); });
t('匯出密碼：沒填、少於 8 個字、兩次不一樣 → 不匯出，寫出原因', async () => {
  const A = app(two()); A.list(); A.click(A.d.getElementById('expAll'));
  const set = (a, b) => { A.d.getElementById('bkP1').value = a; A.d.getElementById('bkP2').value = b; A.click(A.mb('匯出')); return T(A.d.getElementById('bkErr').textContent); };
  assert.ok(/請設定密碼/.test(set('', ''))); assert.ok(/至少 8 個字/.test(set('1234567', '1234567'))); assert.ok(/兩次輸入的密碼不一樣/.test(set('12345678', '12345679')));
  await wait(60); assert.strictEqual(A.dl.files.length, 0);
});
t('匯出（不加密）：.json、標記正確、內容＝存檔', async () => {
  const A = app(two()); const f = await exportFile(A, ''); const o = JSON.parse(f.text);
  assert.ok(/^退休試算方案_\d{4}-\d{2}-\d{2}\.json$/.test(f.name), f.name);
  assert.deepStrictEqual([o.app, o.kind, o.format, o.encrypted], ['sp5-retirement', 'scenarios', 1, false]);
  assert.deepStrictEqual(o.list.map((x) => x.name), ['我的第一個方案', '55 歲退休']); assert.deepStrictEqual(J(o.list[0].saved), J(A.db().list[0].saved));
});
t('匯出（加密）：AES-256-GCM＋PBKDF2 60 萬次；檔案裡看不到任何個資；用同一個密碼解得開、內容＝存檔', async () => {
  const A = app(two()); const f = await exportFile(A, 'abcd1234'); const o = JSON.parse(f.text);
  assert.strictEqual(o.encrypted, true); assert.deepStrictEqual([o.kdf.name, o.kdf.hash, o.kdf.iterations, o.cipher.name], ['PBKDF2', 'SHA-256', 600000, 'AES-GCM']);
  ['我的第一個方案', '55 歲退休', '1986-06', '1974-11', 'parental', '"500"'].forEach((s) => assert.ok(!f.text.includes(s), '檔案裡不該看得到：' + s));
  const plain = await decryptNode(o, 'abcd1234'); assert.deepStrictEqual(plain.list.map((x) => x.name), ['我的第一個方案', '55 歲退休']); assert.deepStrictEqual(J(plain.list[0].saved), J(A.db().list[0].saved));
  await assert.rejects(decryptNode(o, 'wrong-pass'));
  assert.ok(/密碼請自己記好/.test(A.d.getElementById('toast').textContent));
});
t('匯出兩次：每次的鹽與 IV 都不同（同樣的資料、同樣的密碼，加密結果不一樣）', async () => { const A = app(two()); const a = JSON.parse((await exportFile(A, 'abcd1234')).text), b = JSON.parse((await exportFile(A, 'abcd1234')).text); assert.notStrictEqual(a.kdf.salt, b.kdf.salt); assert.notStrictEqual(a.cipher.iv, b.cipher.iv); assert.notStrictEqual(a.data, b.data); });
t('匯出時有未存檔的修改 → 提醒匯出的是上次存檔的內容', async () => { const A = app(two()); A.click(A.d.getElementById('back')); const e = A.d.getElementById('asset'); e.value = '600'; e.dispatchEvent(new A.W.Event('input', { bubbles: true })); A.click(A.d.getElementById('go')); A.list(); A.click(A.d.getElementById('expAll')); assert.ok(/有未存檔的修改；匯出的是上次存檔的內容/.test(A.body())); });

/* ===== v1.0：夫妻方案 ===== */
const C_IN = { mode: 'couple', asset: '300', spend: '7', house: true, housePay: '2', houseYrs: '20', car: false, carPay: '', carYrs: '', kidsOn: true,
  kids: [{ bym: '2016-04', path: 'uni', costs: { ele: '5', jun: '6', sen: '8', uni: '15' } }], parOn: false, par: '', parMode: 'keep', parYrs: '', pre: { inf: '', dep: '1.9' },
  you: { name: '你', birth: '1985-03', workStart: '25', inc: '8', pre: { liYears: '16', w60: '', lsBal: '', lsWage: '', lsYears: '', self: '' } },
  partner: { name: '另一半', birth: '1988-07', workStart: '25', inc: '6.5', pre: { liYears: '', w60: '', lsBal: '', lsWage: '', lsYears: '', self: '' }, parOn: true, par: '0.5', parMode: 'keep', parYrs: '' } };
t('夫妻方案：匯出 → 新裝置匯入，資料完整保留；不在白名單的欄位丟掉；切過去是夫妻的結果', async () => {
  const evil = JSON.parse(JSON.stringify(C_IN)); evil.you.evil = '<img src=x onerror=alert(1)>'; evil.partner.pre.hack = 'x'.repeat(500);
  const A = app([{ id: 's1', name: '我的第一個方案', saved: A_IN, updated: '' }, { id: 'c1', name: '我們的方案', saved: evil, updated: '' }], 's1');
  A.list(); A.click(A.d.getElementById('expAll') || A.mb('匯出所有方案'));
  assert.ok(/也包含另一半的資料/.test(A.body()), '有夫妻方案時，匯出前提醒檔案也包含另一半的資料');
  A.click(A.mb('取消'));
  const f = await exportFile(A, ''), o = JSON.parse(f.text);
  assert.strictEqual(o.list[1].saved.mode, 'couple');
  const B = app(); B.W.SP5App.importText(f.text, f.name);
  assert.ok(await until(() => B.title() === '匯入方案'), B.title()); B.click(B.mb('匯入 2 個方案'));
  const c = B.db().list.filter((x) => x.saved.mode === 'couple')[0];
  assert.ok(c, '夫妻方案有匯入');
  assert.deepStrictEqual([c.saved.you.birth, c.saved.partner.birth, c.saved.partner.par, c.saved.partner.parOn, c.saved.kids[0].costs.uni, c.saved.you.pre.liYears, c.saved.pre.dep],
    ['1985-03', '1988-07', '0.5', true, '15', '16', '1.9']);
  assert.ok(!('evil' in c.saved.you) && !('hack' in c.saved.partner.pre), '白名單以外的欄位要丟掉');
  B.list(); B.click(B.d.querySelector('[data-sw="' + c.id + '"]'));   /* 匯入後會先切到第一個方案，從清單切過去 */
  assert.ok(!B.d.getElementById('couple').hidden && B.d.getElementById('cpSlider'), '切換到夫妻方案：顯示夫妻的結果');
  assert.strictEqual(B.errs.length, 0, B.errs.join('|'));
});

/* ===== 匯入 ===== */
t('換裝置：加密匯出 → 新裝置匯入（錯的密碼再試）→ 方案一樣、算出來的結果一樣', async () => {
  const A = app(two()); const f = await exportFile(A, 'abcd1234');
  A.click(A.d.getElementById('listBack')); const heroA = T(A.d.querySelector('.hero .age').textContent);
  const B = app(); B.W.SP5App.importText(f.text, f.name);
  assert.strictEqual(B.title(), '需要密碼');
  B.d.getElementById('bkIp').value = 'wrong-pass'; B.click(B.mb('打開')); assert.ok(await until(() => /密碼不對/.test(B.body())), '錯的密碼要說「密碼不對」');
  B.d.getElementById('bkIp').value = 'abcd1234'; B.click(B.mb('打開')); assert.ok(await until(() => B.title() === '匯入方案'), B.title());
  assert.ok(/我的第一個方案/.test(B.body()) && /55 歲退休/.test(B.body()) && /不會覆蓋你現有的方案/.test(B.body()));
  B.click(B.mb('匯入 2 個方案')); const L = B.db().list; assert.deepStrictEqual(L.map((x) => x.name), ['我的第一個方案', '55 歲退休']);
  assert.deepStrictEqual(J(L[0].saved), J(A.db().list[0].saved), '匯入後的資料＝匯出前');
  assert.ok(B.d.querySelector('.hero'), '新裝置匯入後直接切到第一個方案的結果'); assert.strictEqual(B.db().active, L[0].id);
  assert.strictEqual(T(B.d.querySelector('.hero .age').textContent), heroA, '新裝置算出來的最快退休＝原本的');
  assert.deepStrictEqual(J(B.errs), []); assert.ok(!B.dl.fetch, '沒有連網路');
});
t('匯入同名的方案 → 新增成「（匯入）」，原本的方案一個字都沒變', async () => {
  const A = app(two()); const f = await exportFile(A, ''); const before = J(A.db().list);
  A.W.SP5App.importText(f.text, f.name); assert.ok(/匯入後叫「我的第一個方案（匯入）」/.test(A.body()));
  A.click(A.mb('匯入 2 個方案')); const L = A.db().list;
  assert.deepStrictEqual(L.map((x) => x.name), ['我的第一個方案', '55 歲退休', '我的第一個方案（匯入）', '55 歲退休（匯入）']);
  assert.deepStrictEqual(J(L.slice(0, 2)), before, '原本的方案沒變'); assert.ok(new Set(L.map((x) => x.id)).size === 4, '新的方案有新的 id');
});
t('超過 10 個：已有 9 個 → 預設只勾 1 個；勾 2 個就不能按，寫出原因', async () => {
  const nine = Array.from({ length: 9 }, (_, i) => ({ id: 'n' + i, name: '方案' + i, saved: B_IN, updated: '' }));
  const A = app(two()); const f = await exportFile(A, '');
  const C = app(nine); C.W.SP5App.importText(f.text, f.name);
  const cbs = [...C.d.querySelectorAll('[data-imp]')]; assert.deepStrictEqual(cbs.map((c) => c.checked), [true, false]); assert.ok(/還能匯入 1 個/.test(C.body()));
  cbs[1].checked = true; C.chg(cbs[1]); assert.ok(C.d.querySelector('#mBtns .primary').disabled && /最多只能再匯入 1 個/.test(C.body()));
  const ten = nine.concat([{ id: 'n9', name: '方案9', saved: B_IN, updated: '' }]); const D = app(ten); D.W.SP5App.importText(f.text, f.name); assert.strictEqual(D.title(), '已經有 10 個方案');
});
t('出錯：不是 JSON、別的 JSON、比較新的版本、沒有方案、超過 2 MB → 各自說明，方案沒變', async () => {
  const A = app(two()), before = J(A.db());
  A.W.SP5App.importText('這不是 JSON', 'x.json'); assert.strictEqual(A.title(), '這不是退休試算的檔案'); assert.ok(/你的方案沒有任何改變/.test(A.body()));
  A.W.SP5App.importText(JSON.stringify({ hello: 1 }), 'x.json'); assert.strictEqual(A.title(), '這不是退休試算的檔案');
  A.W.SP5App.importText(JSON.stringify({ app: 'sp5-retirement', kind: 'scenarios', format: 2, version: '0.9.0', list: [] }), 'x.json'); assert.strictEqual(A.title(), '檔案來自比較新的版本'); assert.ok(/v0\.9\.0/.test(A.body()));
  A.W.SP5App.importText(JSON.stringify({ app: 'sp5-retirement', kind: 'scenarios', format: 1, list: [] }), 'x.json'); assert.strictEqual(A.title(), '檔案裡沒有方案');
  await A.W.SP5App.importFile(new A.W.File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.json')); assert.strictEqual(A.title(), '檔案太大');
  assert.deepStrictEqual(J(A.db()), before);
});
t('加密檔被竄改 → 解不開（說密碼不對），不會壞掉', async () => {
  const A = app(two()); const o = JSON.parse((await exportFile(A, 'abcd1234')).text); const b = Buffer.from(o.data, 'base64'); b[5] ^= 0xff; o.data = b.toString('base64');
  A.W.SP5App.importText(JSON.stringify(o), 'x.json'); A.d.getElementById('bkIp').value = 'abcd1234'; A.click(A.mb('打開'));
  assert.ok(await until(() => /密碼不對/.test(A.body()))); assert.deepStrictEqual(J(A.errs), []);
});
t('攻擊：匯入檔的名稱與每個欄位都是惡意內容、或型別不對 → 不會注入、不會壞掉，只取認得的欄位', async () => {
  const deep = (o) => typeof o === 'string' ? X : Array.isArray(o) ? o.map(deep) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : o;
  const evil = { app: 'sp5-retirement', kind: 'scenarios', format: 1, exported: X, list: [{ name: X, saved: deep(A_IN), updated: X }, { name: { a: 1 }, saved: { birth: { x: 1 }, kids: 'no', pre: [1, 2], hacked: '<b>' }, updated: [] }, null, 'str'] };
  const A = app(two()); A.W.SP5App.importText(JSON.stringify(evil), X);
  assert.ok(!A.d.getElementById('xss'), '預覽沒有被注入'); assert.ok(A.body().includes('<i id=xss></i>'), '惡意內容以純文字顯示');
  A.click(A.mb('匯入')); assert.ok(!A.d.getElementById('xss'), '清單沒有被注入');
  const L = A.db().list; assert.strictEqual(L.length, 6);
  const odd = L[3]; assert.strictEqual(odd.name, '匯入的方案'); assert.strictEqual(typeof odd.saved.birth, 'string'); assert.ok(Array.isArray(odd.saved.kids) && typeof odd.saved.pre === 'object' && !Array.isArray(odd.saved.pre)); assert.ok(!('hacked' in odd.saved), '不認得的欄位不收');
  A.click([...A.d.querySelectorAll('[data-sw]')].find((b) => b.dataset.sw === L[2].id));
  assert.ok(!A.d.getElementById('xss'), '切換到匯入的方案後也沒有被注入'); assert.ok(!A.d.getElementById('quick').hidden, '資料不合法 → 停在快速開始');
  A.list(); A.click(A.d.getElementById('listBack'));
  assert.ok(!A.d.getElementById('quick').hidden && T((A.d.querySelector('#quick .err') || { textContent: '' }).textContent).length > 0, '回到結果：資料不合法就回快速開始並說明，不會崩潰');
  assert.deepStrictEqual(J(A.errs), []);
});

(async () => {
  let ok = 0, bad = 0;
  console.log('■ 方案匯出／匯入');
  for (const x of tests) {
    try { await x.fn(); ok++; console.log('  ✓ ' + x.name); }
    catch (e) { bad++; console.log('  ✗ ' + x.name + '\n      ' + String(e && e.message || e).split('\n')[0].slice(0, 300)); }
  }
  console.log('  ' + ok + ' 通過，' + bad + ' 失敗');
  process.exit(bad ? 1 : 0);
})();
