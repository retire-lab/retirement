/*
 * PDF 報告測試（v0.7.0）：整條鏈實際跑一遍
 *   模擬瀏覽器操作 SP5（dist/index.html）→ reportModel() → 真的 pdfmake 產生 PDF → pdf.js 讀回文字比對
 * 需要：npm install（jsdom、pdfmake、pdfjs-dist）與 npm run build
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const PdfPrinter = require('pdfmake');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const PDFDOC = require('../src/pdfdoc.js');
const SP5 = require('../src/engine.js');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
const FONT = path.join(ROOT, 'fonts', 'kai-subset.ttf');
const COVER = fs.readFileSync(path.join(ROOT, 'fonts', 'kai-chars.txt'), 'utf8');
const printer = new PdfPrinter({ Kai: { normal: FONT, bold: FONT, italics: FONT, bolditalics: FONT } });

const tests = []; const t = (name, fn) => tests.push({ name, fn });
const T = (s) => String(s).replace(/\s+/g, ' ').trim();
const J = (x) => JSON.parse(JSON.stringify(x));   // 模擬瀏覽器裡的陣列與 Node 的原型不同，比較前先轉成一般資料
const Z = (s) => String(s).replace(/\s+/g, '');   // pdf.js 讀回來的字之間可能有空白，比對時都拿掉

/* ---------- 在模擬瀏覽器裡操作 SP5 ---------- */
function app(saved, name) {
  const store = { 'sp5:data': JSON.stringify({ v: 1, active: 's1', list: [{ id: 's1', name: name || '我和小芸的退休計畫', saved, updated: '2026/10/03 21:00' }], cmp: [], showAll: false }) };
  const errs = [];
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', url: 'https://u.github.io/', beforeParse(w) {
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    for (const k in store) w.localStorage.setItem(k, store[k]);
    w.addEventListener('error', (e) => errs.push(e.message));
  } });
  const d = dom.window.document, W = dom.window;
  const click = (e) => { if (!e) throw new Error('找不到元素'); e.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
  const val = (e, v) => { if (typeof e === 'string') e = d.getElementById(e); e.value = v; e.dispatchEvent(new W.Event('input', { bubbles: true })); e.dispatchEvent(new W.Event('change', { bubbles: true })); };
  click(d.getElementById('go'));
  return { d, W, click, val, errs, model: () => W.SP5App.reportModel() };
}
const blank = () => ({ birth: '', workStart: '', asset: '', inc: '', spend: '', house: false, car: false, kidsOn: false, parOn: false, housePay: '', houseYrs: '', housePre: false, housePreAge: '', houseRate: '', carPay: '', carYrs: '', par: '', parMode: 'keep', parYrs: '',
  kids: [{ bym: '', path: 'grad', costs: {} }], pre: { liYears: '', w60: '', lsBal: '', lsWage: '', lsYears: '', liClaim: '', self: '0', endAge: '', nhiDep: false, inf: '', dep: '', oldOn: false, oHire: '', oYrs: '', oWage: '', gaps: [], liMode: '', liPre09: false, sex: '', sameCo: '', w36: '' } });
const mkIn = (o, pre) => { const b = blank(); Object.assign(b, o); Object.assign(b.pre, pre || {}); return b; };
const COMPLEX = mkIn({ birth: '1978-05', workStart: '24', asset: '380', inc: '9.5', spend: '4', house: true, car: true, kidsOn: true, parOn: true, housePay: '2.8', houseYrs: '12', carPay: '1.2', carYrs: '3', par: '1',
  kids: [{ bym: '2012-09', path: 'grad', costs: { jun: '8', sen: '10', uni: '18', grad: '25' } }, { bym: '2016-03', path: 'uni', costs: { ele: '6', jun: '8', sen: '10', uni: '18' } }] });
function complexCompare() {
  const A = app(COMPLEX); const { d, click, val } = A;
  click(d.getElementById('tgPrec'));
  val('pLy', '22'); val('pW', '4.58'); val('pB', '180');
  click(d.getElementById('gapAdd')); click(d.getElementById('gapAdd'));
  val(d.querySelector('[data-gapsit="0"]'), 'parental'); val('gy0', '1'); val('gm0', '0');
  val(d.querySelector('[data-gapsit="1"]'), 'job'); val('gy1', '0'); val('gm1', '6');
  click(d.querySelector('[data-pa="liMode:lump"]')); val('pW36', '4.2');
  click(d.getElementById('tgAdj'));
  click(d.querySelector('.stv[data-edit="ret"]')); d.getElementById('ed-y').value = '2036'; d.getElementById('ed-m').value = '5'; click(d.querySelector('[data-editok="ret"]'));
  click(d.querySelector('[data-step="more:-1"]')); click(d.querySelector('[data-step="more:-1"]'));
  click(d.querySelector('[data-step="wi.gap:1"]')); click(d.querySelector('[data-step="wi.inf:1"]'));
  return A;
}

/* 只需要「有修改 → 對照版」時用這個：動一下調調看就好（最複雜的情境每次重建要 2.5 秒） */
function quickCompare() { const A = app(COMPLEX); A.click(A.d.getElementById('tgAdj')); A.click(A.d.querySelector('[data-step="more:-1"]')); return A; }

/* ---------- 產生 PDF、讀回文字 ---------- */
function makePdf(M, opts) {
  return new Promise((res, rej) => {
    const dd = PDFDOC.build(M, Object.assign({ coverage: COVER, ownerPassword: 'owner-test' }, opts || {}));
    const doc = printer.createPdfKitDocument(dd), bufs = [];
    doc.on('data', (b) => bufs.push(b)); doc.on('end', () => res({ buf: Buffer.concat(bufs), dd })); doc.on('error', rej); doc.end();
  });
}
async function readPdf(buf, password) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), password, verbosity: 0, useSystemFonts: false }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const tc = await p.getTextContent(); pages.push(tc.items.map((x) => x.str).join(' ')); }
  const meta = await doc.getMetadata().catch(() => ({}));
  return { pages, all: pages.join('\n'), meta, n: doc.numPages };
}
const cache = {};
async function pdfOf(key, Mfn, opts) {
  if (!cache[key]) { const M = Mfn(); const { buf, dd } = await makePdf(M, opts); cache[key] = { M, buf, dd, txt: await readPdf(buf, opts && opts.password) }; }
  return cache[key];
}
/* 情境 */
let A_SINGLE, A_CMP, A_SHORT, A_LI;
const getSingle = () => (A_SINGLE = A_SINGLE || app(COMPLEX)).model();
const getCmp = () => (A_CMP = A_CMP || complexCompare()).model();
const getShort = () => (A_SHORT = A_SHORT || app(mkIn({ birth: '1968-11', workStart: '30', asset: '50', inc: '6', spend: '5' }))).model();
const getLi = () => (A_LI = A_LI || app(mkIn({ birth: '1974-11', workStart: '24', asset: '520', inc: '11.5', spend: '4.2' }, { liYears: '28', w60: '4.58' }))).model();
const CH_SINGLE = ['一、條件', '二、結果', '三、你的錢會怎麼走', '四、每個階段的收支'];
const CH_CMP = ['一、條件：原始 vs 調整後', '二、結果：原始 vs 調整後', '三、你的錢會怎麼走', '四、每個階段的收支'];

/* ---------- 共用的檢查 ---------- */
function chapterPages(txt, chapters) {
  /* 每章標題第一次出現的頁（目錄頁除外） */
  const toc = txt.pages.findIndex((p) => Z(p).includes('目錄') && Z(p).includes('一、'));
  return chapters.map((c) => txt.pages.findIndex((p, i) => i !== toc && Z(p).includes(Z(c))) + 1);
}
function checkStructure(txt, chapters) {
  const toc = txt.pages.findIndex((p) => Z(p).includes('目錄'));
  assert.strictEqual(toc, 1, '目錄在第 2 頁');
  assert.ok(Z(txt.pages[0]).includes('退休試算報告') && Z(txt.pages[0]).includes('前言') && Z(txt.pages[0]).includes('適用範圍') && Z(txt.pages[0]).includes('假設'), '第 1 頁：前言、適用範圍、假設');
  const pg = chapterPages(txt, chapters);
  pg.forEach((p, i) => assert.ok(p > 2, chapters[i] + ' 有出現在正文'));
  for (let i = 1; i < pg.length; i++) assert.ok(pg[i] >= pg[i - 1], '章節順序：' + chapters[i - 1] + ' → ' + chapters[i]);
  /* 目錄的頁碼＝實際頁碼 */
  const tocZ = Z(txt.pages[toc]);
  chapters.forEach((c, i) => { const m = tocZ.match(new RegExp(Z(c).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\D*?(\\d+)')); assert.ok(m, '目錄有 ' + c); assert.strictEqual(+m[1], pg[i], c + ' 的頁碼：目錄寫 ' + m[1] + '，實際在第 ' + pg[i] + ' 頁'); });
  /* 章節標題不會單獨留在頁尾：標題那一頁一定也有該章的第一樣內容 */
  const FIRST = { '一': ['基本資料'], '二': ['退休時間', '最快退休'], '三': ['年齡'], '四': ['工作期'], '五': ['一次領'] };
  chapters.forEach((c, i) => { const pz = Z(txt.pages[pg[i] - 1]), after = pz.slice(pz.indexOf(Z(c)) + Z(c).length); assert.ok(FIRST[c[0]].some((m) => after.includes(m)), c + '：標題那一頁（第 ' + pg[i] + ' 頁）沒有該章的內容，標題被單獨留在頁尾'); });
  /* 每一頁都有內容（不是只有頁首頁尾） */
  txt.pages.forEach((p, i) => assert.ok(Z(p).replace(/退休生命週期決策平台|RetirementLifecycleDecisionPlatform|第\d+頁|\d{4}\/\d{2}\/\d{2}|v\d+\.\d+\.\d+|完整版|去個資版|・|對照/g, '').length > 60, '第 ' + (i + 1) + ' 頁不是空白頁'));
}
/* 文件定義裡往下層找（章節標題與第一個內容包在同一個區塊裡） */
function findNodes(x, pred, out) { out = out || []; if (Array.isArray(x)) x.forEach((y) => findNodes(y, pred, out)); else if (x && typeof x === 'object') { if (pred(x)) out.push(x); ['stack', 'content'].forEach((k) => { if (x[k]) findNodes(x[k], pred, out); }); } return out; }
const svgOf = (dd) => findNodes(dd.content, (x) => typeof x.svg === 'string')[0].svg;
function allStrings(M) { const out = []; (function walk(x) { if (typeof x === 'string') out.push(x); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') Object.values(x).forEach(walk); })(M); return out; }

/* ========== 單一版本 ========== */
t('單一版本：沒改條件 → 模型是單一版本，檔名不含「對照」', async () => { const M = getSingle(); assert.strictEqual(M.meta.compare, false); assert.strictEqual(A_SINGLE.W.SP5App.pdfFileName(M, false), '退休試算_完整版_' + M.meta.date + '.pdf'); });
t('單一版本：章節、目錄頁碼、沒有空白頁', async () => checkStructure((await pdfOf('single', getSingle)).txt, CH_SINGLE));
t('單一版本：沒有勞保一次領資格（沒填年資）→ 沒有第五章', async () => { const { M, txt } = await pdfOf('single', getSingle); assert.strictEqual(M.li, null); assert.ok(!Z(txt.all).includes('五、')); });
t('單一版本：前言寫「你目前的設定」；方案名稱在完整版裡', async () => { const z = Z((await pdfOf('single', getSingle)).txt.pages[0]); assert.ok(z.includes('這份報告是你目前的設定')); assert.ok(z.includes('我和小芸的退休計畫')); });
t('單一版本：假設 10 點全部印出（與網頁同一份清單）', async () => { const { M, txt } = await pdfOf('single', getSingle); assert.strictEqual(M.assumptions.length, 10); M.assumptions.forEach((a) => assert.ok(Z(txt.pages[0]).includes(Z(a)), a)); });
t('單一版本：條件每一列（標籤＋值）都在 PDF 裡', async () => { const { M, txt } = await pdfOf('single', getSingle); const z = Z(txt.all); M.conditions.forEach((g) => { assert.ok(z.includes(Z(g.title)), g.title); g.rows.forEach((r) => { assert.ok(z.includes(Z(r.label)), r.label); assert.ok(z.includes(Z(r.o).replace(/；/g, '')), r.label + '：' + r.o); }); }); });
t('單一版本：結果的數字＝引擎直接算的（最快退休、需要有、會有）', async () => {
  const { M, txt } = await pdfOf('single', getSingle), en = SP5.create(COMPLEX, { now: { y: 2026, m: 10 } }); en.sync();
  const P = en.profile(), e = en.earliest(), ev = en.evalR(P, e), z = Z(txt.all);
  assert.ok(z.includes(Z(en.ageText(e))), '最快退休 ' + en.ageText(e)); assert.ok(z.includes(Z(en.fmtW(ev.need))), '需要有 ' + en.fmtW(ev.need)); assert.ok(z.includes(Z(en.fmtW(ev.proj))), '會有 ' + en.fmtW(ev.proj));
  assert.deepStrictEqual(J(M.results.rows.map((r) => r.label)), ['最快退休', '需要有', '退休時會有', '夠用到', '橋接期', '錢夠不夠']);
});
t('單一版本：結果與網頁的結果卡一致（同一句話）', async () => { const { txt } = await pdfOf('single', getSingle); const web = T(A_SINGLE.d.querySelector('.hero .rs2').textContent); assert.ok(Z(txt.all).includes(Z(web)), web); });
t('單一版本：每個階段、每一個事件（標題＋說明）都在 PDF 裡', async () => {
  const { M, txt } = await pdfOf('single', getSingle), z = Z(txt.all); let n = 0;
  M.phases.orig.forEach((p) => { assert.ok(z.includes(Z(p.name)), p.name); p.events.forEach((e) => { n++; assert.ok(z.includes(Z(e.t)), p.name + '：' + e.t); if (e.text) assert.ok(z.includes(Z(e.text)), e.t + '：' + e.text); }); });
  assert.ok(n >= 8, '事件數量合理：' + n);
});
t('單一版本：階段與網頁「每個階段的收支」一樣（名稱、順序）', async () => { const { M } = await pdfOf('single', getSingle); const web = [...A_SINGLE.d.querySelectorAll('#mapCard .phc b')].map((b) => b.textContent); assert.deepStrictEqual(J(M.phases.orig.map((p) => p.name)), J(web)); });

/* ========== 對照版 ========== */
t('對照版：有修改 → 模型是對照，檔名含「對照」', async () => { const M = getCmp(); assert.strictEqual(M.meta.compare, true); assert.ok(M.meta.pendingN >= 5 && M.meta.adjN === 4, 'pending ' + M.meta.pendingN + ' adj ' + M.meta.adjN); assert.strictEqual(A_CMP.W.SP5App.pdfFileName(M, true), '退休試算_去個資版_對照_' + M.meta.date + '.pdf'); });
t('對照版：章節（先條件、再結果）、目錄頁碼、沒有空白頁', async () => checkStructure((await pdfOf('cmp', getCmp)).txt, CH_CMP.concat(['五、勞保：一次領和月領，累計各拿多少'])));
t('對照版：條件四組，改過的項目調整後的值都在 PDF 裡', async () => {
  const { M, txt } = await pdfOf('cmp', getCmp), z = Z(txt.all);
  assert.deepStrictEqual(J(M.conditions.map((g) => g.title)), ['基本資料', '以後會結束的支出', '實際資料（提高準確度）', '如果……（調調看）']);
  const ch = []; M.conditions.forEach((g) => g.rows.forEach((r) => { if (r.changed) { ch.push(r.label); assert.ok(z.includes(Z(r.a).replace(/；/g, '')), r.label + '：' + r.a); } }));
  ['勞保年資', '勞退專戶餘額', '工作空窗', '勞保怎麼領', '退保前 3 年平均月投保薪資', '想在幾歲退休', '每月花費', '收入中斷多久', '通膨'].forEach((l) => assert.ok(ch.includes(l), '標為已改：' + l));
  assert.ok(!ch.includes('出生年月') && !ch.includes('房貸'), '沒改的不標');
});
t('對照版：結果每一列與網頁對照表一致（原始、調整後、差距）', async () => {
  const { M, txt } = await pdfOf('cmp', getCmp), z = Z(txt.all);
  const webRows = [...A_CMP.d.querySelectorAll('.cmpcard .cr')]; let inRes = false, n = 0;
  webRows.forEach((r) => { if (r.classList.contains('sec')) { inRes = /結果/.test(r.textContent); return; } if (!inRes) return; const lab = T(r.querySelector('.cl').textContent); if (!lab) return; n++;
    const o = [...r.querySelector('.co').childNodes].map((x) => T(x.textContent)).filter(Boolean)[0]; if (o) assert.ok(z.includes(Z(o.replace(/\d{4}\/\d{2}.*$/, ''))), lab + ' 原始：' + o); });
  assert.strictEqual(n, M.results.rows.length, '列數一致');
  M.results.rows.forEach((r) => { (r.a || []).forEach((x) => assert.ok(z.includes(Z(x)), r.label + ' 調整後：' + x)); if (r.d) assert.ok(z.includes(Z(r.d)), r.label + ' 差距：' + r.d); });
});
t('對照版：每個階段兩個版本都有，金額與事件左右對照（「沒有這一段」標示）', async () => {
  const { M, txt } = await pdfOf('cmp', getCmp), z = Z(txt.all);
  const on = M.phases.orig.map((p) => p.name), an = M.phases.adj.map((p) => p.name);
  assert.ok(an.includes('橋接期') && !on.includes('橋接期'), '調整後多了橋接期'); assert.ok(z.includes('（沒有這一段）'));
  [...M.phases.orig, ...M.phases.adj].forEach((p) => p.events.forEach((e) => { assert.ok(z.includes(Z(e.t)), e.t); if (e.text) assert.ok(z.includes(Z(e.text)), e.text); }));
  assert.ok(M.phases.adj.some((p) => p.events.some((e) => e.bad && e.t === '資產用完')), '調整後有資產用完的事件');
});
t('對照版：勞保一次領的事件金額＝4.2 萬 × 45 個月＝189 萬', async () => { const { M } = await pdfOf('cmp', getCmp); const ev = [].concat(...M.phases.adj.map((p) => p.events)).find((e) => e.t === '勞保一次領'); assert.ok(ev && /189 萬/.test(ev.text), ev && ev.text); });
t('對照版：曲線兩條線（灰色虛線、藍色）與兩條退休時間線', async () => { const { dd } = await pdfOf('cmp', getCmp); const svg = svgOf(dd); assert.strictEqual((svg.match(/<polyline/g) || []).length, 2); assert.ok(/stroke-dasharray="4,3"/.test(svg) && /原始 .*退休/.test(svg) && /調整後 .*退休/.test(svg) && /用完/.test(svg)); });

/* ========== 去個資版 ========== */
const YMRE = /\d{4}\s*\/\s*\d{2}(?!\s*\/\s*\d{2})|\d{4}\s*年\s*\d{1,2}\s*月/g;   // 年月（不含頁首的產生日期 YYYY/MM/DD）
for (const [key, fn, label] of [['singleA', getSingle, '單一版本'], ['cmpA', getCmp, '對照版']]) {
  t('去個資版（' + label + '）：沒有任何年月（只剩頁首的產生日期）', async () => { const { txt } = await pdfOf(key, fn, { anon: true }); const hits = txt.all.match(YMRE) || []; assert.deepStrictEqual(hits, [], hits.slice(0, 5).join('、')); });
  t('去個資版（' + label + '）：沒有出生年月、孩子生日、方案名稱；出生年月改寫成年齡', async () => {
    const { txt } = await pdfOf(key, fn, { anon: true }), z = Z(txt.all);
    ['1978/05', '1978', '2012/09', '2012-09', '2016/03', '2016-03', '我和小芸的退休計畫', '小芸'].forEach((x) => assert.ok(!z.includes(Z(x)), '不該出現：' + x));
    assert.ok(!/出生年月\d/.test(z), '沒有「出生年月」那一列（頁尾說明拿掉了什麼的那句不算）');
    assert.ok(z.includes('年齡') && z.includes('48歲'), '改寫成年齡');
  });
  t('去個資版（' + label + '）：頁首寫「去個資版」、頁尾寫拿掉了哪些', async () => { const { txt } = await pdfOf(key, fn, { anon: true }); assert.ok(Z(txt.pages[0]).includes('去個資版')); assert.ok(Z(txt.pages[0]).includes('已移除出生年月與所有年月')); });
  t('去個資版（' + label + '）：財務數字照樣保留（資產、房貸、學費）', async () => { const z = Z((await pdfOf(key, fn, { anon: true })).txt.all); ['380萬', '2.8萬', '研究所25萬'].forEach((x) => assert.ok(z.includes(x), x)); });
}
t('去個資版（對照）：工作空窗只寫幾段、多久，不寫原因；完整版寫原因', async () => {
  const za = Z((await pdfOf('cmpA', getCmp, { anon: true })).txt.all), zf = Z((await pdfOf('cmp', getCmp)).txt.all);
  ['育嬰留職停薪', '待業、找工作'].forEach((x) => { assert.ok(!za.includes(Z(x)), '去個資版不該有：' + x); assert.ok(zf.includes(Z(x)), '完整版要有：' + x); });
  assert.ok(za.includes(Z('2 段・共 1 年 6 個月')));
});
t('完整版：保留出生年月、孩子生日、方案名稱', async () => { const z = Z((await pdfOf('cmp', getCmp)).txt.all); ['1978/05', '2012/09', '我和小芸的退休計畫'].forEach((x) => assert.ok(z.includes(Z(x)), x)); });

/* ========== 加密 ========== */
t('加密：AES-256（/V 5、/CFM /AESV3、256 位元；pdfkit 只支援 R5，所以密碼至少 8 個字），沒密碼打不開', async () => {
  const { buf } = await makePdf(getSingle(), { password: 'test1234' }); const raw = buf.toString('latin1');
  assert.ok(/\/Encrypt/.test(raw) && /\/V 5/.test(raw) && /\/CFM \/AESV3/.test(raw) && /\/Length 256/.test(raw) && /\/R 5/.test(raw), '是 AES-256（R5）');
  await assert.rejects(readPdf(buf), (e) => /password/i.test(e.name + e.message), '沒密碼要打不開');
});
t('加密：錯的密碼打不開；對的密碼內容完整（跟不加密的一樣）', async () => {
  const M = getSingle(), { buf } = await makePdf(M, { password: 'test1234' });
  await assert.rejects(readPdf(buf, 'wrong-pass'));
  const enc = await readPdf(buf, 'test1234'), plain = (await pdfOf('single', getSingle)).txt;
  assert.strictEqual(enc.n, plain.n); assert.strictEqual(Z(enc.all), Z(plain.all));
});
t('不加密：沒有 /Encrypt', async () => { const { buf } = await makePdf(getSingle(), {}); assert.ok(!/\/Encrypt/.test(buf.toString('latin1'))); });

/* ========== 字型與文字 ========== */
t('字型：PDF 嵌入的是楷書子集', async () => { const raw = (await makePdf(getSingle(), {})).buf.toString('latin1'); assert.ok(/\/FontFile2/.test(raw), '有嵌入字型'); assert.ok(!/Helvetica|Roboto/.test(raw), '沒有用到其他字型'); });
t('字型：四種情境裡會出現的每一個字都在子集裡（不會印出方塊）', async () => {
  const cov = new Set(Array.from(COVER)), miss = new Set();
  [getSingle(), getCmp(), getShort(), getLi()].forEach((M) => allStrings(M).forEach((s) => Array.from(s).forEach((ch) => { if (ch.charCodeAt(0) >= 128 && !/\s/.test(ch) && !cov.has(ch) && !'−‹›▾⚠✓✕'.includes(ch)) miss.add(ch); })));
  assert.deepStrictEqual([...miss], []);
  ['single', 'cmp'].forEach((k) => assert.ok(!cache[k] || !cache[k].txt.all.includes('□'), k + ' 沒有方塊'));
});
t('罕見字：方案名稱有子集外的字 → 換成「□」，不會壞掉', async () => {
  const A = app(COMPLEX, '𠀋𠀋的方案'); const M = A.model(); const { buf } = await makePdf(M, {}); const txt = await readPdf(buf);
  assert.ok(Z(txt.pages[0]).includes('□□的方案'), Z(txt.pages[0]).slice(0, 80));
});
t('同一份資料產生兩次，內容一模一樣', async () => { const M = getCmp(); const a = await readPdf((await makePdf(M, {})).buf), b = await readPdf((await makePdf(M, {})).buf); assert.strictEqual(Z(a.all), Z(b.all)); });
t('PDF 的標題與產生者資訊', async () => { const { txt } = await pdfOf('cmp', getCmp); assert.ok(/退休試算報告（完整版）/.test(txt.meta.info.Title)); assert.ok(/退休生命週期決策平台 v\d+\.\d+\.\d+/.test(txt.meta.info.Creator)); });

/* ========== 其他情境 ========== */
t('65 歲還不夠：結果寫 65 歲還不夠、需要／會有／還差都在', async () => {
  const M = getShort(); const { txt } = await pdfOf('short', getShort), z = Z(txt.all);
  assert.strictEqual(M.results.rows[0].v[0], '65 歲還不夠'); assert.ok(z.includes('65歲還不夠') && z.includes(Z('還差 551 萬')), z.slice(0, 0));
  checkStructure(txt, CH_SINGLE);
});
t('能選勞保一次領：有第五章，結論「活過 72 歲，月領累計超過一次領」', async () => {
  const M = getLi(); assert.ok(M.li); const { txt } = await pdfOf('li', getLi), z = Z(txt.all);
  assert.ok(z.includes('五、勞保：一次領和月領，累計各拿多少')); assert.ok(z.includes(Z('活過 72 歲，月領累計超過一次領。'))); assert.ok(z.includes(Z('206 萬')));
  checkStructure(txt, CH_SINGLE.concat(['五、勞保：一次領和月領，累計各拿多少']));
});
t('未存檔：改了答案沒存 → 完整版標「（未存檔）」，去個資版不寫方案名稱', async () => {
  const A = app(COMPLEX); A.click(A.d.getElementById('back')); A.val('asset', '400'); A.click(A.d.getElementById('go'));
  const M = A.model(); assert.strictEqual(M.meta.dirty, true); assert.strictEqual(M.meta.compare, false, '改答案不算調整');
  const f = await readPdf((await makePdf(M, {})).buf), an = await readPdf((await makePdf(M, { anon: true })).buf);
  assert.ok(Z(f.pages[0]).includes('我和小芸的退休計畫（未存檔）')); assert.ok(!Z(an.pages[0]).includes('未存檔') && !Z(an.pages[0]).includes('小芸'));
});
t('填錯的實際資料不算修改：只填錯一項 → 單一版本報告', async () => { const A = app(COMPLEX); A.click(A.d.getElementById('tgPrec')); A.val('pW', '9'); const M = A.model(); assert.strictEqual(M.meta.compare, false); assert.ok(!allStrings(M).some((s) => /9 萬/.test(s) && /平均/.test(s))); });
t('模擬瀏覽器裡沒有執行錯誤', async () => { [A_SINGLE, A_CMP, A_SHORT, A_LI].filter(Boolean).forEach((A) => assert.deepStrictEqual(A.errs, [])); });


/* ========== 分享視窗的操作（用替身取代 pdfmake 與下載，攔下送出的文件定義與檔名） ========== */
function stubPdf(A, opts) {
  const W = A.W; opts = opts || {};
  W.__dd = null; W.__dl = null; W.__fetch = 0;
  W.SP5_PDF_INLINE = { font: 'AAAA' };                         // 字型用內嵌的替身，不連網路
  W.fetch = () => { W.__fetch++; return Promise.reject(new Error('不該連網路')); };
  W.pdfMake = { createPdf(dd) { if (opts.fail) throw new Error('排版失敗（測試）'); W.__dd = dd; return { getBlob(cb) { setTimeout(() => cb(new W.Blob(['%PDF-1.7'], { type: 'application/pdf' })), 5); } }; } };
  W.URL.createObjectURL = () => 'blob:test'; W.URL.revokeObjectURL = () => {};
  W.HTMLAnchorElement.prototype.click = function () { W.__dl = this.download; };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms || 40));
const modalTitle = (A) => T(A.d.getElementById('mTitle').textContent);
const mbtn = (A, label) => [...A.d.querySelectorAll('#mBtns button')].find((b) => T(b.textContent) === label);
function setPw(A, a, b) { const d = A.d; d.getElementById('pdfP1').value = a; d.getElementById('pdfP2').value = b; }

t('分享按鈕：在結果頁的方案列右邊（存檔旁邊）', async () => { const A = app(COMPLEX); const bar = A.d.querySelector('.scbar'); const ids = [...bar.querySelectorAll('button')].map((b) => b.id); assert.deepStrictEqual(J(ids), ['openList', 'saveBtn', 'shareBtn']); assert.ok(/分享/.test(A.d.getElementById('shareBtn').textContent)); });
t('分享視窗（沒改條件）：寫「目前的結果」，沒有「存成新方案」的提示；預設完整版、加密碼', async () => {
  const A = app(COMPLEX); A.click(A.d.getElementById('shareBtn')); const b = T(A.d.getElementById('mBody').textContent);
  assert.strictEqual(modalTitle(A), '分享 PDF 報告'); assert.ok(/這份報告會包含：目前的結果/.test(b)); assert.ok(!/存成新方案/.test(b));
  assert.ok(A.d.querySelector('input[name="pdfv"][value="full"]').checked && A.d.getElementById('pdfPwOn').checked); assert.ok(A.d.getElementById('pdfAnonList').hidden);
});
t('分享視窗（改了條件）：寫「原始 vs 調整後的對照」、幾項還沒套用、只想分享調整後就先存成新方案', async () => {
  const A = complexCompare(); A.click(A.d.getElementById('shareBtn')); const b = T(A.d.getElementById('mBody').textContent);
  assert.ok(/原始 vs 調整後的對照/.test(b) && /你有 6 項實際資料還沒套用/.test(b) && /只想分享調整後的版本？先按「存成新方案」/.test(b), b.slice(0, 200));
});
t('分享視窗：未存檔時提醒「會標示未存檔」', async () => { const A = app(COMPLEX); A.click(A.d.getElementById('back')); A.val('asset', '400'); A.click(A.d.getElementById('go')); A.click(A.d.getElementById('shareBtn')); assert.ok(/有未存檔的修改，報告會用畫面上的數字，並標示「未存檔」/.test(T(A.d.getElementById('mBody').textContent))); });
t('分享視窗：選去個資版 → 列出會拿掉哪些（含為什麼連年月都拿掉）；切回完整版就收起', async () => {
  const A = app(COMPLEX); A.click(A.d.getElementById('shareBtn'));
  A.val(A.d.querySelector('input[name="pdfv"][value="anon"]'), 'anon'); A.d.querySelector('input[name="pdfv"][value="anon"]').checked = true;
  A.d.querySelector('input[name="pdfv"][value="anon"]').dispatchEvent(new A.W.Event('change', { bubbles: true }));
  const l = A.d.getElementById('pdfAnonList'); assert.ok(!l.hidden);
  ['出生年月 → 改寫成年齡', '所有年月 → 只留年齡', '年齡加上年月就能反推出生日', '孩子的出生年月', '工作空窗的原因', '方案名稱', '會保留：'].forEach((x) => assert.ok(T(l.textContent).includes(x), x));
  const f = A.d.querySelector('input[name="pdfv"][value="full"]'); f.checked = true; f.dispatchEvent(new A.W.Event('change', { bubbles: true })); assert.ok(l.hidden);
});
t('密碼：沒填、少於 8 個字、兩次不一樣 → 視窗不關，寫出原因', async () => {
  const A = app(COMPLEX); stubPdf(A); A.click(A.d.getElementById('shareBtn'));
  const go = () => A.click(mbtn(A, '產生 PDF')), err = () => T(A.d.getElementById('pdfErr').textContent);
  setPw(A, '', ''); go(); assert.ok(/請設定密碼/.test(err()) && modalTitle(A) === '分享 PDF 報告');
  setPw(A, '1234567', '1234567'); go(); assert.ok(/至少 8 個字/.test(err()));
  setPw(A, '12345678', '12345679'); go(); assert.ok(/兩次輸入的密碼不一樣/.test(err()));
  await wait(); assert.strictEqual(A.W.__dd, null, '都沒有產生');
});
t('產生（加密碼）：送出的文件有密碼與 AES-256 設定，下載檔名正確，完成後提醒記密碼', async () => {
  const A = app(COMPLEX); stubPdf(A); A.click(A.d.getElementById('shareBtn')); setPw(A, 'abcd1234', 'abcd1234');
  A.click(mbtn(A, '產生 PDF')); assert.strictEqual(modalTitle(A), '正在產生 PDF…'); await wait(80);
  assert.ok(A.W.__dd && A.W.__dd.userPassword === 'abcd1234' && A.W.__dd.version === '1.7ext3');
  assert.ok(/^退休試算_完整版_\d{4}-\d{2}-\d{2}\.pdf$/.test(A.W.__dl), A.W.__dl);
  assert.ok(A.d.getElementById('modal').hidden); assert.ok(/已產生 PDF/.test(A.d.getElementById('toast').textContent) && /密碼請自己記好/.test(A.d.getElementById('toast').textContent));
  assert.strictEqual(A.W.__fetch, 0, '沒有連網路');
});
t('產生（不加密碼）：顯示「任何人都能打開」，文件沒有密碼', async () => {
  const A = app(COMPLEX); stubPdf(A); A.click(A.d.getElementById('shareBtn'));
  const cb = A.d.getElementById('pdfPwOn'); cb.checked = false; cb.dispatchEvent(new A.W.Event('change', { bubbles: true }));
  assert.ok(!A.d.getElementById('pdfNoPw').hidden && A.d.getElementById('pdfPwBox').hidden);
  A.click(mbtn(A, '產生 PDF')); await wait(80); assert.ok(A.W.__dd && !A.W.__dd.userPassword); assert.ok(!/密碼請自己記好/.test(A.d.getElementById('toast').textContent));
});
t('產生（去個資版＋對照）：檔名「去個資版_對照」，送出的內容沒有出生年月與方案名稱，下次預設去個資版', async () => {
  const A = quickCompare(); stubPdf(A); A.click(A.d.getElementById('shareBtn'));
  const an = A.d.querySelector('input[name="pdfv"][value="anon"]'); an.checked = true; an.dispatchEvent(new A.W.Event('change', { bubbles: true }));
  setPw(A, 'abcd1234', 'abcd1234'); A.click(mbtn(A, '產生 PDF')); await wait(80);
  assert.ok(/^退休試算_去個資版_對照_/.test(A.W.__dl), A.W.__dl);
  const js = JSON.stringify(A.W.__dd.content); assert.ok(!js.includes('1978/05') && !js.includes('我和小芸'), '內容沒有個資');
  A.click(A.d.getElementById('shareBtn')); assert.ok(A.d.querySelector('input[name="pdfv"][value="anon"]').checked, '記住上次的選擇');
});
t('產生中按取消 → 不會下載', async () => { const A = app(COMPLEX); stubPdf(A); A.click(A.d.getElementById('shareBtn')); setPw(A, 'abcd1234', 'abcd1234'); A.click(mbtn(A, '產生 PDF')); A.click(mbtn(A, '取消')); await wait(80); assert.strictEqual(A.W.__dl, null); });
t('產生失敗 → 顯示原因，說明資料沒有上傳、沒有遺失', async () => { const A = app(COMPLEX); stubPdf(A, { fail: true }); A.click(A.d.getElementById('shareBtn')); setPw(A, 'abcd1234', 'abcd1234'); A.click(mbtn(A, '產生 PDF')); await wait(80); assert.strictEqual(modalTitle(A), '沒辦法產生 PDF'); assert.ok(/排版失敗（測試）/.test(T(A.d.getElementById('mBody').textContent)) && /沒有上傳/.test(T(A.d.getElementById('mBody').textContent))); });
t('分享視窗的操作沒有執行錯誤', async () => { const A = quickCompare(); stubPdf(A); A.click(A.d.getElementById('shareBtn')); setPw(A, 'abcd1234', 'abcd1234'); A.click(mbtn(A, '產生 PDF')); await wait(80); assert.deepStrictEqual(J(A.errs), []); });


/* ========== 真的瀏覽器版 pdfmake：用 preview.html（程式庫與字型內嵌）在模擬瀏覽器裡產生，再讀回來 ========== */
t('瀏覽器版 pdfmake＋真的楷書字型：產生加密的對照版 PDF，讀回來內容正確', async () => {
  const PREV = fs.readFileSync(path.join(ROOT, 'dist', 'preview.html'), 'utf8'), errs = [];
  const store = { 'sp5:data': JSON.stringify({ v: 1, active: 's1', list: [{ id: 's1', name: '我和小芸的退休計畫', saved: COMPLEX, updated: '2026/10/03 21:00' }], cmp: [], showAll: false }) };
  const dom = new JSDOM(PREV, { runScripts: 'dangerously', url: 'https://u.github.io/', pretendToBeVisual: true, beforeParse(w) { w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; for (const k in store) w.localStorage.setItem(k, store[k]); w.addEventListener('error', (e) => errs.push(e.message)); } });
  const W = dom.window, d = W.document, click = (e) => e.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  click(d.getElementById('go')); click(d.getElementById('tgAdj')); click(d.querySelector('[data-step="more:-1"]'));
  const M = W.SP5App.reportModel(); assert.strictEqual(M.meta.compare, true);
  const blob = await W.SP5App.makePdf(M, { password: 'abcd1234' });
  const buf = Buffer.from(await new Promise((res, rej) => { const fr = new W.FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsArrayBuffer(blob); }));
  assert.ok(buf.slice(0, 5).toString() === '%PDF-', '是 PDF'); assert.ok(/\/CFM \/AESV3/.test(buf.toString('latin1')), 'AES-256');
  await assert.rejects(readPdf(buf), undefined, '沒密碼打不開');
  const txt = await readPdf(buf, 'abcd1234'), z = Z(txt.all);
  ['退休試算報告', '目錄', '一、條件：原始vs調整後', '二、結果：原始vs調整後', '四、每個階段的收支', '每月花費4萬3.8萬'].forEach((x) => assert.ok(z.includes(Z(x)), x));
  assert.ok(!txt.all.includes('□'), '沒有方塊字'); assert.deepStrictEqual(J(errs), []);
});


/* ========== 使用者回報的版面問題（v0.7.0 上線後的第一份 PDF） ========== */
const REPORTED = mkIn({ birth: '1974-11', workStart: '25', asset: '450', inc: '9', spend: '4', house: true, housePay: '2', houseYrs: '4', kidsOn: true,
  kids: [{ bym: '201206', path: 'grad', costs: { jun: '2', sen: '2', uni: '3', grad: '5' } }, { bym: '201803', path: 'uni', costs: { ele: '2', jun: '2', sen: '2', uni: '3', grad: '5' } }] });
let A_REP;
const getRep = () => { if (!A_REP) { A_REP = app(REPORTED, '我的第一個方案'); A_REP.click(A_REP.d.getElementById('tgAdj')); A_REP.click(A_REP.d.querySelector('.stv[data-edit="ret"]')); A_REP.d.getElementById('ed-y').value = '2029'; A_REP.d.getElementById('ed-m').value = '11'; A_REP.click(A_REP.d.querySelector('[data-editok="ret"]')); } return A_REP.model(); };
t('回報情境：章節標題都跟內容在同一頁（「三、你的錢會怎麼走」不會留在頁尾、曲線在下一頁）', async () => checkStructure((await pdfOf('rep', getRep)).txt, CH_CMP));
t('回報 1：結果表的年月獨立一行（不會「58 歲 2 個月2033/01」黏在一起）', async () => {
  const M = getRep(); M.results.rows.forEach((r) => [r.o, r.a].forEach((cell) => { if (cell && cell[0]) assert.ok(!/\d{4}\/\d{2}/.test(cell[0]), r.label + ' 的大字裡有年月：' + cell[0]); }));
  const r0 = M.results.rows[0]; assert.ok(/^\d{4}\/\d{2}/.test(r0.o[1]) && /^\d{4}\/\d{2}/.test(r0.a[1]), J(r0));
});
t('回報 7：「要補上」的說明和金額在同一行（不會「每月再少花」「0.86 萬」拆開）', async () => { const r = getRep().results.rows.find((x) => x.label === '要補上'); assert.ok(r && r.a.some((x) => /^(或)?每月再(多存|少花) [\d.]+ 萬$/.test(x)), J(r)); });
t('回報 2：曲線上「用完」的年齡＝第四章的「資產用完」事件（同一個精確月份）', async () => {
  const M = getRep(); const ev = [].concat(...M.phases.adj.map((p) => p.events)).find((e) => e.bad); assert.ok(ev, '有資產用完的事件');
  assert.strictEqual(M.curve.exAText, ev.age); const { dd } = await pdfOf('rep', getRep); assert.ok(svgOf(dd).includes('調整後 ' + ev.age + '用完'));
});
t('回報 3：出生年月輸入「201206」→ 印成 2012/06', async () => { const z = Z((await pdfOf('rep', getRep)).txt.all); assert.ok(z.includes('孩子1：2012/06生') && z.includes('孩子2：2018/03生') && !z.includes('201206'), z.slice(z.indexOf('孩子'), z.indexOf('孩子') + 60)); });
t('回報 4：兩個孩子的費用分開寫明；只讀到大學的孩子不列研究所', async () => {
  const M = getRep(); const r = M.conditions[1].rows.find((x) => x.label === '孩子每年的費用');
  assert.ok(/^孩子 1：.*研究所 5 萬；孩子 2：/.test(r.o), r.o); assert.ok(!/孩子 2：.*研究所/.test(r.o), '孩子 2 讀到大學，不列研究所：' + r.o);
});
t('回報 6：條件的每一組各自不拆頁，每組都附「原始／調整後」欄名', async () => { const { dd } = await pdfOf('rep', getRep); const tb = findNodes(dd.content, (x) => x.table && x.unbreakable && x.table.body[0][0].style === 'band'); assert.strictEqual(tb.length, 4); tb.forEach((x) => assert.ok(x.table.body[0][1].text === '原始' && x.table.body[0][2].text === '調整後')); });
t('回報 8：曲線縱軸至少 4 個刻度，負的那一段也有', async () => { const { dd } = await pdfOf('rep', getRep); const svg = svgOf(dd); const ticks = (svg.match(/text-anchor="end">-?\d+</g) || []); assert.ok(ticks.length >= 4 && ticks.some((x) => />-\d/.test(x)), ticks.join(' ')); });
t('章節標題與該章第一個內容包成不可拆開的區塊（放不下就整塊換頁）', async () => {
  const dd = PDFDOC.build(getRep(), { coverage: COVER }); const blocks = dd.content.filter((x) => x.stack && x.stack[0] && x.stack[0].tocItem);
  assert.strictEqual(blocks.length, 4); blocks.forEach((b) => { assert.strictEqual(b.unbreakable, true); assert.ok(b.stack.length >= 3, '標題、底線之外還有內容'); });
});

(async () => {
  let ok = 0, bad = 0;
  console.log('■ PDF 報告');
  for (const x of tests) {
    try { await x.fn(); ok++; console.log('  ✓ ' + x.name); }
    catch (e) { bad++; console.log('  ✗ ' + x.name + '\n      ' + String(e && e.message || e).split('\n')[0].slice(0, 300)); }
  }
  console.log('  ' + ok + ' 通過，' + bad + ' 失敗');
  process.exit(bad ? 1 : 0);
})();
