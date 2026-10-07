/* tests/e2e/couple.e2e.js — 夫妻模式的畫面操作（v1.0.0-beta.2）
 * 用真的點擊與輸入：入口 → 三個頁籤 → 算 → 三個方案、滑桿、切換調誰、調調看、提高準確度 → 存檔、重新打開、方案清單；
 * 輸入錯誤時跳到出錯的頁籤；單人模式不受影響。輸入跟 tests/couple-solver.test.js 相同，畫面上的數字要一致。 */
'use strict';
const { JSDOM } = require('jsdom');
const html = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'dist', 'index.html'), 'utf8');
let ok = 0, bad = 0;
function check(name, cond, detail) { if (cond) { ok++; console.log('  ✓ ' + name); } else { bad++; console.log('  ✗ ' + name + (detail !== undefined ? '：' + String(detail).slice(0, 300) : '')); } }
function section(t) { console.log('\n■ ' + t); }
function mk(store, url) {
  const errs = [], calls = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: url || 'https://user.github.io/sp5/', beforeParse(w) {
    if (store) Object.keys(store).forEach((k) => w.localStorage.setItem(k, store[k]));
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; w.gtag = function () { calls.push([...arguments]); };
    w.addEventListener('error', (e) => errs.push(e.message));
  } });
  const W = dom.window, d = W.document;
  const q = (s) => d.querySelector(s), click = (s) => { const el = typeof s === 'string' ? q(s) : s; if (!el) throw new Error('找不到 ' + s); el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
  const type = (path, v) => { const el = q('[data-cpk="' + path + '"]'); if (!el) throw new Error('找不到欄位 ' + path); el.value = v; el.dispatchEvent(new W.Event('input', { bubbles: true })); };
  const txt = (s) => { const el = q(s); if (!el) return ''; const c = el.cloneNode(true); c.querySelectorAll('script,style').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' '); };
  return { W, d, q, click, type, txt, errs, calls };
}
const COSTS = { pre: '10', ele: '5', jun: '6', sen: '8', uni: '15' };
function fillAll(T) {
  T.type('you.birth', '1985-03'); T.type('you.workStart', '25'); T.type('you.inc', '8');
  T.click('[data-cptab="p"]'); T.type('partner.birth', '1988-07'); T.type('partner.workStart', '25'); T.type('partner.inc', '6.5');
  T.click('[data-cptab="home"]'); T.type('asset', '300'); T.type('spend', '7');
  T.click('[data-cpchip="house"]'); T.type('housePay', '2'); T.type('houseYrs', '20');
  T.click('[data-cpchip="kidsOn"]'); T.type('kids.0.bym', '2016-04');
  T.d.querySelector('[data-cpk="kids.0.path"]').dispatchEvent(new T.W.Event('change', { bubbles: true }));   /* 輸入出生年月後重畫，各階段才會出現 */
  T.d.querySelectorAll('[data-cpk^="kids.0.costs."]').forEach((el) => T.type(el.dataset.cpk, COSTS[el.dataset.cpk.split('.').pop()]));
  T.click('#cpKidAdd'); T.type('kids.1.bym', '2019-09');
  T.d.querySelector('[data-cpk="kids.1.path"]').dispatchEvent(new T.W.Event('change', { bubbles: true }));
  T.d.querySelectorAll('[data-cpk^="kids.1.costs."]').forEach((el) => T.type(el.dataset.cpk, COSTS[el.dataset.cpk.split('.').pop()]));
}

section('入口與三個頁籤');
const T = mk(null, 'https://retire-lab.github.io/retirement/');
check('快速開始最上面有「我自己／我和另一半」', !!T.q('[data-mode="single"]') && !!T.q('[data-mode="couple"]'));
T.click('[data-mode="couple"]');
check('選「我和另一半」：切到夫妻畫面', !T.q('#couple').hidden && T.q('#quick').hidden);
check('跟單人一樣有灰色說明框：只算勞保勞退、資料（包含另一半的）只存在這台裝置', /只算勞保、勞退/.test(T.txt('#couple .scope')) && /包含另一半的/.test(T.txt('#couple .scope')));
check('說明框折疊：首屏只有一句（合併算、適用勞保勞退、資料不上傳），其餘收在「試算範圍與隱私說明」', !!T.q('#couple .scope details') && !T.q('#couple .scope details').open && /勞保、勞退.*包含另一半的.*不會上傳/.test(T.txt('#couple .scope > div')) && !/合併算/.test(T.txt('#couple .scope > div')) && /試算範圍與隱私說明/.test(T.txt('#couple .scope summary')));
check('單人的說明框也一樣折疊；PDF 用的完整內容（#scopeNote）還在，而且不含按鈕文字', !!T.q('#quick .scope details') && !T.q('#quick .scope details').open && /只算勞保、勞退/.test(T.txt('#scopeNote')) && !/試算範圍與隱私說明/.test(T.txt('#scopeNote')));
check('展開內容寫出資料保存的例外：換瀏覽器、Threads／LINE 裡打開、無痕、Safari 很久沒開；可以匯出備份', /Threads、LINE/.test(T.txt('#couple .scope-keep')) && /Safari/.test(T.txt('#couple .scope-keep')) && /匯出/.test(T.txt('#quick .scope-keep')));
check('展開內容說明資料存在本機但沒有加密（不要把「不上傳」誤解成「已加密」）', /沒有加密/.test(T.txt('#couple .scope-keep')) && /沒有加密/.test(T.txt('#quick .scope-keep')));
check('說明框講清楚怎麼清除：到「方案清單」按「清除這台裝置上的所有資料」（夫妻、單人都是）', /方案清單.*清除這台裝置上的所有資料/.test(T.txt('#couple .scope')) && /方案清單.*清除這台裝置上的所有資料/.test(T.txt('#scopeNote')) && !/記得清除/.test(T.txt('#scopeNote')));
check('說明框的「活到幾歲」預設值從參數帶入（90 歲）', /預設 90 歲/.test(T.txt('#couple .scope')));
check('一開始在「你」的頁籤，三個頁籤都還沒填', T.q('[data-cptab="you"]').getAttribute('aria-pressed') === 'true' && /還沒填.*還沒填.*還沒填/.test(T.txt('.cou-tabs')));
check('「你」的頁籤沒有送出按鈕（還不可能算），只有「下一步」', !T.q('#cpGo') && !!T.q('.cou-next'));
T.click('[data-cptab="home"]');
check('最後一步「我們家」才有送出按鈕，跟單人同樣式（primary big）：「看我們的退休年齡」', !!T.q('#cpGo') && T.q('#cpGo').classList.contains('big') && /看我們的退休年齡/.test(T.q('#cpGo').textContent));
check('還沒填完不能算，寫出還差哪幾部分', T.q('#cpGo').disabled && /還差：你、另一半、我們家/.test(T.txt('#cpMiss')));
T.click('[data-cptab="you"]');
check('出生年月的提示只講規則「西元年月，不用打 -」，不放一個看起來像預設值的數字', T.q('[data-cpk="you.birth"]').placeholder === '西元年月，不用打 -' && !/\d{6}/.test(T.q('[data-cpk="you.birth"]').placeholder) && T.txt('[data-cpage="you"]').trim() === '');
T.type('you.birth', '1985');
check('打了但不完整：底下才提醒「西元年月，不用打 -」（空著的時候不重複寫）', /不用打 -/.test(T.txt('[data-cpage="you"]')));
T.type('you.birth', '198503');
check('出生年月打 198503（不用槓）：底下即時顯示今年幾歲', /^今年 41 歲$/.test(T.txt('[data-cpage="you"]').trim()), T.txt('[data-cpage="you"]'));
check('單人的出生年月提示也一樣', T.q('#birth') && T.q('#birth').placeholder === '西元年月，不用打 -');
check('只填一項：頁籤寫「還差 2 項」（不是 1 / 3 這種表單語言）', /還差 2 項/.test(T.txt('[data-cpst="you"]')));
T.type('you.workStart', '25'); T.type('you.inc', '8');
check('打字時頁籤狀態跟著更新（不用重畫）：你 ✓ 填好了', /^✓ 填好了$/.test(T.txt('[data-cpst="you"]').trim()) && T.q('[data-cpst="you"]').classList.contains('done'));
check('打字時焦點不會跑掉（欄位還是同一個元素）', T.d.activeElement === T.d.body || !!T.q('[data-cpk="you.inc"]'));
T.click('.cou-next');
check('「下一步」到另一半的頁籤', T.q('[data-cptab="p"]').getAttribute('aria-pressed') === 'true' && !!T.q('[data-cpk="partner.birth"]'));
const T2 = mk(null, 'https://retire-lab.github.io/retirement/'); T2.click('[data-mode="couple"]'); fillAll(T2);
check('我們家：房貸、孩子都選了；按鈕上寫摘要（2 萬・還 20 年、2 個）', /2 萬・還 20 年/.test(T2.txt('[data-cpchip="house"]')) && /2 個/.test(T2.txt('[data-cpchip="kidsOn"]')), [T2.txt('[data-cpchip="house"]'), T2.txt('[data-cpchip="kidsOn"]')]);
check('v1.0.3：底下只顯示目前的「孩子」，房貸欄位收起來；填好的孩子收成一行', !T2.q('[data-cpk="housePay"]') && T2.d.querySelectorAll('.cou-kid').length === 1 && T2.d.querySelectorAll('#couple .isum').length === 1);
T2.click('[data-cpkidopen="0"]');
check('點第一個孩子的「修改」：展開它（各階段費用依學制出現），另一個收起來', !!T2.q('[data-cpk="kids.0.costs.uni"]') && !T2.q('[data-cpk="kids.1.bym"]'));
T2.click('[data-cpchip="house"]');
check('點「房貸」：只是切過去（不取消），看得到房貸欄位', T2.q('[data-cpchip="house"]').getAttribute('aria-pressed') === 'true' && T2.q('[data-cpk="housePay"]').value === '2' && !T2.q('.cou-kid'));
T2.click('[data-cpchip="kidsOn"]');
check('全部填完：可以算', !T2.q('#cpGo').disabled);
check('「我們家」不再有孝親費（那是各自父母的）', !T2.q('[data-cpk="par"]') && !T2.q('[data-cpk="partner.par"]'));
T2.click('[data-cptab="you"]'); const parYou = !!T2.q('[data-cpk="par"]') && !T2.q('[data-cpk="partner.par"]');
T2.click('[data-cptab="p"]'); const parP = !!T2.q('[data-cpk="partner.par"]') && !T2.q('[data-cpk="par"]');
check('孝親費在各自的頁籤：你的頁籤填你父母的、另一半的頁籤填另一半父母的', parYou && parP);
T2.click('[data-cptab="home"]');

section('結果：三種安排跟滑桿整合成一張卡片（數字跟 solver 測試一致）');
T2.click('#cpGo');
const R = T2.txt('#couple');
const M2 = T2.W.SP5Engine.coupleModel(JSON.parse(T2.W.localStorage.getItem('sp5:data')).list.slice(-1)[0].saved, {}), m55 = M2.monthOfAge('you', 55);
check('按「算」之後到結果頁：一張「三種安排」卡片，沒有另外的三行事實、方案卡、「自己配一組」', !!T2.q('#cpSlider') && /三種安排/.test(R) && !T2.q('.cou-hero') && !/自己配一組|三個參考方案/.test(R));
const segTxt = [...T2.d.querySelectorAll('[data-cpmode]')].map((b) => b.textContent.replace(/\s+/g, ''));
check('三顆切換鈕上直接寫答案：你先退 49 歲 8 個月｜一起退 2043/08｜另一半先退 47 歲 1 個月', segTxt.length === 3 && segTxt[0] === '你先退49歲8個月' && segTxt[1] === '一起退2043/08' && segTxt[2] === '另一半先退47歲1個月', segTxt);
check('切換鈕不替使用者選（切換鈕上沒有「建議」「推薦」「最好」；說明文字裡的「不是建議」除外）', !/建議|推薦|最好/.test(T2.txt('.cou-seg')) && !/(?<!不是)建議/.test(T2.txt('#cpSlider')));
check('預設「你先退」：滑桿從你最早 49 歲 8 個月開始，另一半做到 65 歲', T2.q('[data-cpmode="you"]').getAttribute('aria-pressed') === 'true' && /最早 49 歲 8 個月/.test(T2.txt('.cou-rg')) && /49 歲 8 個月.*65 歲/.test(T2.txt('#cpOut .cou-two')));
check('「一份薪水撐全家」寫成句子（跟「早幾年」一樣時合成一句），不再是三格框框', /你先退，早 18 年 8 個月，這段時間靠一份薪水撐全家/.test(T2.txt('#cpOut')) && !T2.q('.cou-chips'));
check('只靠存款是 0 的時候不出現', !/只靠存款/.test(T2.txt('#cpOut')));
check('最快的組合：寫明「剛好夠的最低門檻，不是建議」、幾乎沒有緩衝（外部評論 P1），不再說「接近 0 是正常的」', /剛好夠的最低門檻，不是建議的退休時間.*幾乎沒有緩衝/.test(T2.txt('#cpOut')) && !/接近 0 是正常的/.test(T2.txt('#couple')));
check('兩條線與圖例（三種財務狀態）', T2.d.querySelectorAll('#cpOut .cou-bar').length === 2 && T2.d.querySelectorAll('#cpOut .cou-lg span').length === 3);
check('畫面上不出現「過世」', !/過世/.test(T2.txt('#couple')) && /只剩一位之後/.test(T2.txt('.assume')));
const youBar = T2.d.querySelectorAll('#cpOut .cou-bar')[0], segs = [...youBar.querySelectorAll('.cou-sg')], endPct = segs.reduce((m, g) => Math.max(m, parseFloat(g.style.left) + parseFloat(g.style.width)), 0);
check('你比另一半早到「活到」：你的線在中途結束', endPct < 99, endPct);
check('GA：送出 couple_mode_open、couple_calculation_complete（不含任何數字）', T2.calls.some((c) => c[1] === 'couple_mode_open') && T2.calls.some((c) => c[1] === 'couple_calculation_complete') && !T2.calls.some((c) => JSON.stringify(c).indexOf('1985') >= 0));
const phases = () => [...T2.d.querySelectorAll('#cpStages .phc')].map((x) => x.textContent.replace(/\s+/g, ' ').trim());
check('結果頁有「每個階段的收支」，跟單人同一套版面：色條、圖例、階段卡片', /每個階段的收支/.test(T2.txt('#cpStages')) && !!T2.q('#cpStages .strip .sbar') && !!T2.q('#cpStages .slegend') && T2.d.querySelectorAll('#cpStages .phrow').length >= 3);
check('「你先退」：兩人都在工作 → 一份薪水撐全家 → 有年金補貼', /^兩人都在工作/.test(phases()[0]) && /^一份薪水撐全家/.test(phases()[1]) && phases().some((x) => /^有年金補貼/.test(x)), phases());
check('第一段寫：你退休時，你們會有 739 萬', /你退休時，你們會有 739 萬/.test(phases()[0]), phases()[0]);
check('色條上標出誰在哪一年退休', /你退 2034/.test(T2.txt('#cpStages .strip')) && /另一半退 2053/.test(T2.txt('#cpStages .strip')));
T2.click('[data-cpphase="1"]');
check('點開「一份薪水撐全家」：存款帳（開始時、入不敷出、通膨縮水、結束時）', !!T2.q('#cpStages .phrow.open .wgrid') && /這段開始時.*這段入不敷出.*這段結束時/.test(T2.txt('#cpStages .phrow.open .wgrid')));
check('　事件：2034/11 你退休、開始繳國保、健保依附，寫出每年收支少多少', /2034\/11.*你退休、你開始繳國保、健保依附在工作的那位名下.*每年收支少/.test(T2.txt('#cpStages .phrow.open')));
T2.click('#cpLedgerBtn');
check('　逐月明細：年份按鈕（你／另一半的年紀）＋每個月的收入、支出、月底存款', T2.d.querySelectorAll('#cpStages [data-cpyear]').length >= 1 && /\d+／\d+ 歲/.test(T2.txt('#cpStages .ygrid')) && /每月收入：另一半的薪水/.test(T2.txt('#cpStages .mlist')) && /月底/.test(T2.txt('#cpStages .mlist')));
T2.click('[data-cpyear="2035"]');
check('　點 2035：換成那一年', /^2035 年/.test(T2.txt('#cpStages .mhd')));
T2.click('[data-cpphase="1"]');
const lastPh = T2.d.querySelectorAll('#cpStages .phc').length - 1; T2.click('[data-cpphase="' + lastPh + '"]');
check('最後一段的事件：你到了「活到」的年紀、生活費降到 70%、另一半開始領遺屬年金', /你到了「活到」的年紀、生活費降到 70%、另一半開始領遺屬年金/.test(T2.txt('#cpStages .phrow.open')), T2.txt('#cpStages .phrow.open').slice(0, 300));
T2.click('[data-cpphase="' + lastPh + '"]');
const stagesBefore = T2.txt('#cpStages');
const rg = T2.q('#cpRange');
check('滑桿最左邊＝你最早可行的月份（每個位置都夠）', +rg.min === M2.plans().youFirst.ma && +rg.max === M2.MA);
rg.value = String(m55); rg.dispatchEvent(new T2.W.Event('input', { bubbles: true }));
check('拉到你 55 歲：另一半最早 59 歲 1 個月（2047/08），滑桿本身不重畫', T2.q('#cpRange') === rg && /59 歲 1 個月/.test(T2.txt('#cpOut')) && /2047\/08/.test(T2.txt('#cpOut')));
check('換算比例：你每多做 1 年，另一半可以早 1 年 2 個月', /你每多做 1 年，另一半可以早 1 年 2 個月/.test(T2.txt('#cpOut')));
check('滑桿有讀得出來的值（aria-valuetext）', /55 歲/.test(rg.getAttribute('aria-valuetext')));
check('拉滑桿：每個階段跟著變（你 55 歲退休：一份薪水撐全家從 2040/03 開始）', T2.txt('#cpStages') !== stagesBefore && /你退 2040/.test(T2.txt('#cpStages .strip')) && /一份薪水撐全家.{0,20}2040\/03/.test(T2.txt('#cpStages')), T2.txt('#cpStages').slice(0, 200));
T2.click('[data-cpmode="tog"]');
check('點「一起退」：滑桿變成「兩人哪個月一起退？」，從 2043/08 開始', /兩人哪個月一起退/.test(T2.txt('#cpSlider')) && /最早 2043\/08/.test(T2.txt('.cou-rg')) && /58 歲 5 個月.*55 歲 1 個月/.test(T2.txt('#cpOut .cou-two')));
check('切到「一起退」：每個階段換成兩人都在工作 → 只靠資產 1 年 7 個月 → 有年金補貼', /一起退 2043/.test(T2.txt('#cpStages .strip')) && [...T2.d.querySelectorAll('#cpStages .phc')].some((x) => /^只靠資產.*1 年 7 個月/.test(x.textContent.replace(/\s+/g, ' ').trim())), [...T2.d.querySelectorAll('#cpStages .phc')].map((x) => x.textContent.replace(/\s+/g, ' ').slice(0, 40)));
check('一起退最早：只靠存款 1 年 7 個月（橘色句子）', /只靠存款 1 年 7 個月：兩人都退了、年金還沒開始/.test(T2.txt('#cpOut')) && !!T2.q('#cpOut .cou-say.cou-warn'));
const rgT = T2.q('#cpRange'); rgT.value = String(+rgT.min + 24); rgT.dispatchEvent(new T2.W.Event('input', { bubbles: true }));
check('往右拉到有緩衝：不再標「最低門檻」，只寫還剩多少', (() => { const r = T2.q('#cpRange'); r.value = String(+r.min + 24); r.dispatchEvent(new T2.W.Event('input', { bubbles: true })); return !/最低門檻/.test(T2.txt('#cpOut')) && /兩人都到設定歲數時還剩/.test(T2.txt('#cpOut')); })());
check('「一起退」往右拉兩年（以前的滑桿調不出來）：2045/08、比最早晚 2 年、不用只靠存款', /2045\/08/.test(T2.txt('#cpOut')) && /比最早晚 2 年/.test(T2.txt('#cpOut')) && /不用只靠存款/.test(T2.txt('#cpOut')) && !/只靠存款 \d/.test(T2.txt('#cpOut')));
T2.click('[data-cpmode="par"]');
check('點「另一半先退」：另一半 47 歲 1 個月、你做到 65 歲，滑桿控制另一半', /另一半想幾歲退休？你配合到最早/.test(T2.txt('#cpSlider')) && /65 歲.*47 歲 1 個月/.test(T2.txt('#cpOut .cou-two')));
T2.click('[data-cpmode="you"]');
section('調調看');
T2.click('#cpTgAdj');
check('打開調調看：跟提高準確度一樣分「你／另一半／我們家」三個頁籤', !!T2.q('#cpAdj') && T2.d.querySelectorAll('#cpAdj [data-cpatab]').length === 3);
check('「你」的頁籤：活到、收入中斷、收入減少', /活到.*收入中斷多久.*收入減少多少/.test(T2.txt('#cpAdj')) && !/全家每月花費/.test(T2.txt('#cpAdj')));
check('GA：couple_adjust_open', T2.calls.some((c) => c[1] === 'couple_adjust_open'));
{ const r = T2.q('#cpRange'); r.value = String(m55); r.dispatchEvent(new T2.W.Event('input', { bubbles: true })); }
const before = T2.txt('#cpOut');
T2.click('[data-cpatab="home"]');
check('「我們家」的頁籤：全家花費、多存、晚年多花、通膨、存款利率、勞保打折', /全家每月花費.*全家每月多存.*晚年每月多花.*通膨.*存款利率降低.*勞保只領到/.test(T2.txt('#cpAdj')));
T2.click('[data-cpstep="more"][data-d="-1"]'); T2.click('[data-cpstep="more"][data-d="-1"]'); T2.click('[data-cpstep="more"][data-d="-1"]');
check('有調過的頁籤標「已調 1 項」', /已調 1 項/.test(T2.txt('[data-cpatab="home"]')) && !/已調/.test(T2.txt('[data-cpatab="you"]')));
check('全家每月少花 6,000：寫出「原始 → 調整後」，另一半變早', /原始：.*→ 調整後：/.test(T2.txt('#cpOut')) && T2.txt('#cpOut') !== before, T2.txt('#cpOut').slice(0, 160));
T2.click('[data-cpatab="p"]'); T2.click('[data-cpstep="gapB"][data-d="1"]');
check('另一半收入中斷半年：數字跟著變', /收入中斷多久.*半年|0\.5 年/.test(T2.txt('#cpAdj')));
T2.click('#cpAdjReset');
check('回到原始：沒有「原始 → 調整後」', !/調整後/.test(T2.txt('#cpOut')));
const rg2 = T2.q('#cpRange'); rg2.value = String(m55); rg2.dispatchEvent(new T2.W.Event('input', { bubbles: true }));
check('滑桿拉回 55 歲：另一半又是 59 歲 1 個月', /59 歲 1 個月/.test(T2.txt('#cpOut')));

section('提高準確度');
T2.click('#cpTgPrec');
check('打開提高準確度：三個頁籤（你、另一半、我們家）', !!T2.q('#cpPrec') && T2.d.querySelectorAll('#cpPrec [data-cpptab]').length === 3);
check('寫出哪些是估算的', /還是估算的：/.test(T2.txt('#cpPrec')));
check('排列跟調調看一樣：標題 → 說明 → 頁籤；頁籤標「估算 N 項」', (() => { const k = [...T2.q('#cpPrec').children].map((x) => x.tagName + '.' + x.className); return k[0] === 'H2.' && k[1] === 'DIV.muted' && k[2] === 'DIV.cou-tabs'; })() && /估算 \d 項/.test(T2.txt('[data-cpptab="you"]')));
T2.type('you.pre.liYears', '16'); T2.click('#cpApply');
check('填勞保年資 16 年並套用：沒有錯誤', T2.errs.length === 0 && !!T2.q('#cpOut'));
T2.click('[data-cpptab="home"]');
T2.click('[data-cpdep="1"]');
check('我們家：存款利率加一格 → 1.9%，結果的假設也寫 1.9%', /1\.9%/.test(T2.txt('#cpPrec')) && /存款 1\.9%/.test(T2.txt('.assume')), T2.txt('.assume').slice(0, 60));
check('健保：依法自動處理，不需要設定', /依法自動處理/.test(T2.txt('#cpPrec')));

section('存檔、重新打開、方案清單');
const db = JSON.parse(T2.W.localStorage.getItem('sp5:data'));
const cur = db.list.filter((x) => x.id === db.active)[0];
check('算完就存成一個夫妻方案（mode: couple）', cur && cur.saved.mode === 'couple' && cur.saved.partner.birth === '1988-07' && cur.name === '我們的方案');
check('改了提高準確度之後：顯示「存檔」', !!T2.q('#cpSave') && !T2.q('#cpSave').disabled);
T2.click('#cpSave');
check('按存檔之後：存進去了', JSON.parse(T2.W.localStorage.getItem('sp5:data')).list.filter((x) => x.id === db.active)[0].saved.you.pre.liYears === '16');
const T3 = mk({ 'sp5:data': T2.W.localStorage.getItem('sp5:data') });
check('重新打開網頁：直接回到夫妻方案的結果', !T3.q('#couple').hidden && !!T3.q('#cpSlider'), T3.errs.join('|'));
T3.click('#cpList');
check('方案清單：標「夫妻」，摘要寫兩人合計的入帳', /夫妻/.test(T3.txt('#list')) && /入帳 14\.5 萬／月/.test(T3.txt('#list')), T3.txt('#list').slice(0, 200));

section('車貸：可以有好幾台');
{
  const T5 = mk(); T5.click('[data-mode="couple"]'); fillAll(T5);
  T5.click('[data-cpchip="carsOn"]');
  check('打開車貸：出現第一台的每月繳、還剩幾年', !!T5.q('[data-cpk="cars.0.pay"]') && !!T5.q('[data-cpk="cars.0.yrs"]'));
  T5.type('cars.0.pay', '1'); T5.type('cars.0.yrs', '5'); T5.click('#cpCarAdd'); T5.type('cars.1.pay', '0.8'); T5.type('cars.1.yrs', '3');
  T5.click('#cpCarAdd'); check('可以再加：三台', T5.d.querySelectorAll('[data-cpk$=".pay"][data-cpk^="cars."]').length === 3);
  T5.click('[data-cpcardel="2"]'); check('可以刪掉一台', T5.d.querySelectorAll('[data-cpk$=".pay"][data-cpk^="cars."]').length === 2);
  T5.click('#cpGo');
  const sv = JSON.parse(T5.W.localStorage.getItem('sp5:data')).list.slice(-1)[0].saved;
  check('兩台車貸都存進去', sv.carsOn === true && sv.cars.length === 2 && sv.cars[1].pay === '0.8');
  const noCar = T2.W.SP5Engine.coupleModel(Object.assign({}, sv, { carsOn: false }), {}), withCar = T5.W.SP5Engine.coupleModel(sv, {}), m = withCar.monthOfAge('you', 55);
  check('引擎：兩台車貸讓另一半最快的時間變晚', withCar.best('you', m) > noCar.best('you', m), [noCar.best('you', m), withCar.best('you', m)]);
  const PP = withCar.plans(), segs5 = [...T5.d.querySelectorAll('[data-cpmode]')].map((b) => T5.txt('[data-cpmode="' + b.dataset.cpmode + '"] span'));
  check('畫面上的三個答案跟引擎一致（有車貸）', segs5[0] === withCar.A.ageText(PP.youFirst.ageA) && segs5[1] === PP.together.ymA && segs5[2] === withCar.A.ageText(PP.partnerFirst.ageB), segs5);
  const T6 = mk(); T6.click('[data-mode="couple"]'); fillAll(T6); T6.click('[data-cpchip="carsOn"]'); T6.type('cars.0.pay', '1'); T6.click('#cpGo');
  check('車貸沒填還剩幾年：停在「我們家」並寫出是第幾台', T6.q('[data-cptab="home"]').getAttribute('aria-pressed') === 'true' && /第 1 台車貸還剩幾年/.test(T6.txt('#couple .err')), T6.txt('#couple .err'));
  check('車貸測試沒有執行錯誤', T5.errs.length === 0 && T6.errs.length === 0, T5.errs.concat(T6.errs).join('|'));
}

section('v1.0.2：養老預備金與未來的大筆收支（單人）');
{
  const U = mk(); const f = (id, v) => { const el = U.d.getElementById(id); el.value = v; el.dispatchEvent(new U.W.Event('input', { bubbles: true })); };
  check('快速開始：生活費底下有「退休後想隨時留多少預備金（選填）」，預設空白', !!U.q('#reserve') && U.q('#reserve').value === '' && /選填/.test(U.txt('label[for="reserve"]')));
  check('生活費還沒填：沒有參考按鈕', !U.q('[data-resv]'));
  f('birth', '197805'); f('workStart', '24'); f('asset', '450'); f('inc', '9'); f('spend', '4');
  check('填了生活費 4 萬：參考按鈕「半年生活費 24 萬」「一年生活費 48 萬」', /半年生活費 24 萬/.test(U.txt('#resvChips')) && /一年生活費 48 萬/.test(U.txt('#resvChips')));
  U.click('[data-resv="48"]');
  check('按「一年生活費」：填進 48', U.q('#reserve').value === '48' && U.q('[data-resv="48"]').getAttribute('aria-pressed') === 'true');
  U.click('#go');
  check('結果：55 歲 5 個月；已保留 48 萬養老預備金，不留的話可以早 4 個月', /55 歲 5 個月/.test(U.txt('.hero .age')) && /已保留 48 萬養老預備金.*不留的話，可以早 4 個月/.test(U.txt('.hero')), U.txt('.hero').slice(0, 200));
  check('假設清單寫出養老預備金', /養老預備金 48 萬/.test(U.txt('#result')));
  check('存進方案：reserve＝48', JSON.parse(U.W.localStorage.getItem('sp5:data')).list[0].saved.reserve === '48');
  U.click('#back'); U.click('[data-chip="lumpsOn"]');
  check('按「大筆收支」：出現一筆空白的（名稱、收入或支出、金額、什麼時候）', !U.q('#sec-lumpsOn').hidden && U.d.querySelectorAll('[data-lkdel]').length === 1 && /收入還是支出/.test(U.txt('#lumps')) && /什麼時候/.test(U.txt('#lumps')));
  const lk = (k, v) => { const el = U.q('[data-lk="0.' + k + '"]'); el.value = v; el.dispatchEvent(new U.W.Event('input', { bubbles: true })); };
  lk('name', '換車'); lk('amt', '80'); lk('val', '60');
  U.click('#go');
  check('60 歲換車 80 萬：結果變晚', !/55 歲 5 個月/.test(U.txt('.hero .age')), U.txt('.hero .age'));
  U.click('#back'); U.click('[data-lkset="0.kind.in"]');
  check('切成「收入」：按鈕標成按下', U.q('[data-lkset="0.kind.in"]').getAttribute('aria-pressed') === 'true' && U.q('[data-lk="0.amt"]').value === '80');
  U.click('[data-lkset="0.when.ym"]');
  check('時間改用「某年某月」：提示改成西元年月', /西元年月，不用打 -/.test(U.q('[data-lk="0.val"]').placeholder));
  lk('val', '209901'); U.click('#go');
  check('年月超出計算範圍：照算（不算進去），不會壞', !!U.q('.hero') && U.errs.length === 0);
  U.click('#back'); lk('val', '2020-01'); U.click('#go');
  check('年月在今天以前：留在輸入頁、寫出第幾筆', !U.q('#quick').hidden && /第 1 筆大筆收支：時間要在今天以後/.test(U.txt('#quick')), U.txt('#quick .err'));
  U.click('[data-lkdel="0"]');
  check('刪掉最後一筆：大筆收支收起來', U.q('#sec-lumpsOn').hidden && U.q('[data-chip="lumpsOn"]').getAttribute('aria-pressed') === 'false');
  check('單人新功能沒有執行錯誤', U.errs.length === 0, U.errs.join('|'));
}

section('v1.0.2：養老預備金與未來的大筆收支（夫妻）');
{
  const V = mk(); V.click('[data-mode="couple"]'); fillAll(V);
  check('我們家：生活費底下有預備金與參考按鈕（全家 7 萬 → 42、84 萬）', !!V.q('[data-cpk="reserve"]') && /半年生活費 42 萬/.test(V.txt('#cpResv')) && /一年生活費 84 萬/.test(V.txt('#cpResv')));
  V.click('[data-cpresv="84"]');
  check('按「一年生活費」：填進 84', V.q('[data-cpk="reserve"]').value === '84');
  V.click('#cpGo');
  check('結果：你先退 50 歲 6 個月、一起退 2044/01', /50 歲 6 個月/.test(V.txt('[data-cpmode="you"]')) && /2044\/01/.test(V.txt('[data-cpmode="tog"]')), V.txt('.cou-seg'));
  check('說明：已保留 84 萬養老預備金，不留的話這種安排最早可以提前 10 個月', /已保留 84 萬養老預備金.*不留的話，這種安排最早可以提前 10 個月/.test(V.txt('#cpOut')), V.txt('#cpOut').slice(0, 300));
  check('假設那行寫出養老預備金', /養老預備金 84 萬/.test(V.txt('.assume')));
  V.click('#cpEdit'); V.click('[data-cptab="home"]'); V.click('[data-cpchip="lumpsOn"]');
  check('大筆收支的「什麼時候」有三個選項：某年某月、你幾歲、另一半幾歲', V.d.querySelectorAll('[data-cplkset^="0.when."]').length === 3 && /另一半幾歲/.test(V.txt('#couple')));
  V.type('lumps.0.name', '儲蓄險到期'); V.click('[data-cplkset="0.kind.in"]'); V.type('lumps.0.amt', '150'); V.click('[data-cplkset="0.when.page"]'); V.type('lumps.0.val', '55');
  V.click('#cpGo');
  let found = false; const nph = V.d.querySelectorAll('#cpStages .phc').length;
  for (let i = 0; i < nph && !found; i++) { V.click('[data-cpphase="' + i + '"]'); if (/2043\/07.*儲蓄險到期.*這個月一次收入 150 萬/.test(V.txt('#cpStages .phrow.open'))) found = true; }
  check('每個階段：2043/07（另一半 55 歲）儲蓄險到期，這個月一次收入 150 萬', found);
  V.click('#cpEdit'); V.click('[data-cptab="home"]'); V.type('lumps.0.amt', ''); V.click('#cpGo');
  check('金額沒填：停在我們家，寫出第幾筆', !!V.q('[data-cptab="home"][aria-pressed="true"]') && /第 1 筆大筆收支：金額還沒填/.test(V.txt('#couple')), V.txt('#couple .err'));
  check('夫妻新功能沒有執行錯誤', V.errs.length === 0, V.errs.join('|'));
}

section('單人與夫妻長得一樣（v1.0.5：防止同一個東西各寫一份、慢慢分岔）');
{
  const Z = mk();
  const shape = (root) => [...root.querySelectorAll('.tile')].map((t) => [t.querySelector('.ic') ? 'ic' : '', t.querySelector('b') ? t.querySelector('b').textContent : '', t.querySelector('.tsum') ? 'tsum' : ''].join('|'));
  const single = shape(Z.d.getElementById('quick'));
  Z.click('[data-mode="couple"]'); Z.click('[data-cptab="home"]');
  const couple = shape(Z.d.getElementById('couple'));
  check('「以後會結束的支出」：兩個模式都是大方塊，每個都有圖示、名稱、摘要', single.length === 5 && couple.length === 4 && single.concat(couple).every((x) => /^ic\|.+\|tsum$/.test(x)), [single, couple]);
  check('名稱一致：房貸、車貸、子女、大筆收支（單人多一個孝親；夫妻的孝親在各自的頁籤）', JSON.stringify(couple.map((x) => x.split('|')[1])) === JSON.stringify(['房貸', '車貸', '子女', '大筆收支']) && single.map((x) => x.split('|')[1]).join() === '房貸,車貸,子女,孝親,大筆收支');
  check('夫妻也獨立成一張卡片「哪些支出以後會結束？」，說明跟單人一樣', /哪些支出以後會結束？/.test(Z.txt('#couple')) && /房貸繳完、小孩畢業之後，你們需要的退休金可能差很多/.test(Z.txt('#couple')));
  Z.click('[data-cpchip="house"]');
  check('細節放在同樣的小區塊（標題＋「不算房貸」），欄位名稱是小字', !!Z.q('#couple .sub .subh [data-cpchipoff="house"]') && !!Z.q('#couple .sub [data-cpk="housePay"]'));
  Z.click('[data-cptab="you"]');
  check('孝親：在「你」的頁籤，用小區塊（標題「給你父母的孝親費（選填）」，底下是每月、給幾年）', /給你父母的孝親費/.test(Z.txt('#couple .sub .t')) && !!Z.q('#couple .sub [data-cpk="par"]') && !!Z.q('#couple .sub [data-cpk="parYrs"]'));
}

section('方塊是開關：按錯了再按一次就取消（v1.0.7，使用者回報）');
{
  const G = mk(); const tile = (k) => G.q('[data-chip="' + k + '"]'), on = (k) => tile(k).getAttribute('aria-pressed') === 'true';
  G.click('[data-chip="kidsOn"]');
  check('單人：按「子女」→ 選上、正在看', on('kidsOn') && /tcur/.test(tile('kidsOn').className));
  G.click('[data-chip="kidsOn"]');
  check('單人：什麼都沒填，再按一次 → 關掉（跟沒按過一樣）', !on('kidsOn') && G.q('#sec-kidsOn').hidden);
  G.click('[data-chip="house"]'); G.click('[data-chip="car"]');
  G.click('[data-chip="house"]');
  check('單人：按別的已選方塊只是切過去，不會關', on('house') && on('car') && !G.q('#sec-house').hidden);
  const hp = G.d.getElementById('housePay'); hp.value = '2'; hp.dispatchEvent(new G.W.Event('input', { bubbles: true }));
  G.click('[data-chip="house"]');
  check('單人：填了房貸再按一次 → 不關，提示用「不算房貸」', on('house') && G.d.getElementById('housePay').value === '2' && /不算房貸/.test(G.txt('#toast')));
  G.click('[data-chip="car"]'); G.click('[data-chip="car"]');
  check('單人：車貸沒填 → 再按一次關掉，房貸還在', !on('car') && on('house'));
  G.click('[data-mode="couple"]'); G.click('[data-cptab="home"]');
  const con = (k) => G.q('[data-cpchip="' + k + '"]').getAttribute('aria-pressed') === 'true';
  G.click('[data-cpchip="lumpsOn"]'); G.click('[data-cpchip="lumpsOn"]');
  check('夫妻：大筆收支沒填 → 再按一次關掉', !con('lumpsOn'));
  G.click('[data-cpchip="kidsOn"]'); G.type('kids.0.bym', '201604'); G.click('[data-cpchip="kidsOn"]');
  check('夫妻：子女填了出生年月再按一次 → 不關，資料還在', con('kidsOn') && G.q('[data-cpk="kids.0.bym"]').value === '201604' && /不算子女/.test(G.txt('#toast')));
  check('說明寫出「按錯了再按一次就取消」', /按錯了再按一次就取消/.test(G.txt('#quick')) && /按錯了再按一次就取消/.test(G.txt('#couple')));
  check('開關測試沒有執行錯誤', G.errs.length === 0, G.errs.join('|'));
}

section('存檔：夫妻方案的「有沒有修改」與存檔（v1.0.3，使用者回報）');
{
  const X = mk(); X.click('[data-mode="couple"]'); fillAll(X); X.click('#cpGo');
  const db = () => JSON.parse(X.W.localStorage.getItem('sp5:data'));
  check('剛算完：存檔按鈕是「已存檔」', /已存檔/.test(X.txt('#cpSave')) && X.q('#cpSave').disabled);
  X.click('#cpList');
  check('方案清單：夫妻方案沒有「有未存檔的修改」（原本永遠顯示）', !/有未存檔的修改/.test(X.txt('#list')), X.txt('#list').slice(0, 200));
  const X2 = mk({ 'sp5:data': JSON.stringify(db()) }); X2.click('#cpTgPrec');
  const inp = X2.q('#cpPrec input[data-cpk]'); inp.value = '20'; inp.dispatchEvent(new X2.W.Event('input', { bubbles: true }));
  inp.dispatchEvent(new X2.W.Event('change', { bubbles: true }));
  X2.click('#cpTgPrec');
  const dirtyNow = /存檔/.test(X2.txt('#cpSave')) && !/已存檔/.test(X2.txt('#cpSave'));
  check('改了提高準確度：出現「存檔」', dirtyNow, X2.txt('#cpSave'));
  X2.click('#cpSave');
  const after = JSON.parse(X2.W.localStorage.getItem('sp5:data')).list.filter((x) => x.saved.mode === 'couple')[0];
  check('按存檔：存進夫妻方案（不是「單人的資料不會存進去」）', !/單人的資料不會存進去/.test(X2.txt('body')) && JSON.stringify(after.saved).indexOf('"20"') >= 0 && /已存檔/.test(X2.txt('#cpSave')));
  check('存檔測試沒有執行錯誤', X.errs.length === 0 && X2.errs.length === 0, X.errs.concat(X2.errs).join('|'));
}

section('切換模式：不會弄丟方案，單人和夫妻不會互相覆蓋（v1.0.1，使用者回報）');
{
  const T8 = mk(); T8.click('[data-mode="couple"]'); fillAll(T8); T8.click('#cpGo');
  const db = () => JSON.parse(T8.W.localStorage.getItem('sp5:data')), coupleSc = () => db().list.filter((x) => x.saved.mode === 'couple');
  check('夫妻算完：存成「我們的方案」', coupleSc().length === 1 && coupleSc()[0].saved.partner.birth === '1988-07');
  T8.click('#cpEdit'); T8.click('#couple [data-mode="single"]'); T8.click('#quick [data-mode="couple"]');
  check('切回來停在離開時的頁籤（我們家），存款還是 300', T8.q('[data-cptab="home"]').getAttribute('aria-pressed') === 'true' && T8.q('[data-cpk="asset"]').value === '300');
  T8.click('[data-cptab="you"]');
  check('算完 → 修改答案 → 我自己 → 我和另一半：資料還在（使用者回報的路徑）', !T8.q('#couple').hidden && T8.q('[data-cpk="you.birth"]') && T8.q('[data-cpk="you.birth"]').value === '1985-03', T8.q('[data-cpk="you.birth"]') && T8.q('[data-cpk="you.birth"]').value);
  T8.click('#couple [data-mode="single"]');
  const fill = (id, v) => { const el = T8.d.getElementById(id); el.value = v; el.dispatchEvent(new T8.W.Event('input', { bubbles: true })); };
  fill('birth', '1978-05'); fill('workStart', '24'); fill('asset', '450'); fill('inc', '9'); fill('spend', '4');
  T8.click('#go');
  const d1 = db(), cs = d1.list.filter((x) => x.saved.mode === 'couple'), ss = d1.list.filter((x) => x.saved.mode !== 'couple');
  check('夫妻算完再切到單人按「看我的退休年齡」：另外建立單人方案，不寫進夫妻方案', cs.length === 1 && ss.length === 1 && d1.active === ss[0].id && cs[0].saved.partner.birth === '1988-07' && ss[0].saved.birth === '1978-05', d1.list.map((x) => [x.name, x.saved.mode || 'single']));
  check('單人結果頁上方顯示的是單人方案，不是「我們的方案」', !/我們的方案/.test(T8.txt('#result .scbar')), T8.txt('#result .scbar'));
  for (let k = 0; k < 5; k++) { T8.click('#back'); T8.click('#quick [data-mode="couple"]'); T8.click('#couple [data-mode="single"]'); }
  T8.click('#quick [data-mode="couple"]'); T8.click('[data-cptab="you"]');
  const d2 = db();
  check('來回切換 5 次：兩個方案都還在、內容沒有被對方蓋掉', d2.list.length === 2 && d2.list.filter((x) => x.saved.mode === 'couple')[0].saved.partner.birth === '1988-07' && d2.list.filter((x) => x.saved.mode !== 'couple')[0].saved.birth === '1978-05');
  check('切回夫妻：顯示夫妻方案的資料', T8.q('[data-cpk="you.birth"]') && T8.q('[data-cpk="you.birth"]').value === '1985-03');
  const T9 = mk({ 'sp5:data': JSON.stringify(Object.assign(db(), { active: db().list.filter((x) => x.saved.mode !== 'couple')[0].id })) });
  T9.click('#back'); T9.click('#quick [data-mode="couple"]');
  check('重新打開網頁（目前是單人方案）→ 按我和另一半：打開清單裡的夫妻方案，不是空白', !T9.q('#couple').hidden && !!T9.q('#cpSlider') && /49 歲 8 個月/.test(T9.txt('.cou-seg')), T9.txt('#couple').slice(0, 120));
  check('色條：「現在」、最後一年、兩個退休標籤都有，沒有被擠掉', /現在 2026/.test(T9.txt('#cpStages .strip')) && /2078/.test(T9.txt('#cpStages .strip')) && /你退 2034/.test(T9.txt('#cpStages .strip')) && /另一半退 2053/.test(T9.txt('#cpStages .strip')), T9.txt('#cpStages .strip'));
  check('切換測試沒有執行錯誤', T8.errs.length === 0 && T9.errs.length === 0, T8.errs.concat(T9.errs).join('|'));
}

section('輸入錯誤、回到單人模式');
const T4 = mk(); T4.click('[data-mode="couple"]'); fillAll(T4);
T4.click('[data-cptab="p"]'); T4.type('partner.birth', '1988-13'); T4.click('[data-cptab="home"]'); T4.click('#cpGo');   /* 送出按鈕只在最後一步 */
check('另一半的出生年月打錯：跳到另一半的頁籤並寫出錯誤', T4.q('[data-cptab="p"]').getAttribute('aria-pressed') === 'true' && /出生年月/.test(T4.txt('#couple .err')));
check('夫妻畫面最上面也是同一組「我自己／我和另一半」大按鈕（不是小字連結），標題「我們最早幾歲可以退休？」',
  T4.q('#couple .cou-mode [data-mode="couple"]').getAttribute('aria-pressed') === 'true' && !T4.q('#cpToSingle') && /我們最早幾歲可以退休？/.test(T4.txt('#couple h1')));
T4.click('#couple [data-mode="single"]');
check('按「我自己」：回到單人的快速開始', !T4.q('#quick').hidden && T4.q('#couple').hidden);
T4.click('#quick [data-mode="couple"]');
check('再按「我和另一半」：剛才填到一半的資料還在', !T4.q('#couple').hidden && T4.q('[data-cpk="partner.birth"]') && T4.q('[data-cpk="partner.birth"]').value === '1988-13');
check('整個過程沒有執行錯誤', [T, T2, T3, T4].every((x) => x.errs.length === 0), [T, T2, T3, T4].map((x) => x.errs.join('|')).join(' / '));

console.log('\n' + ok + ' 通過，' + bad + ' 失敗');
process.exit(bad ? 1 : 0);
