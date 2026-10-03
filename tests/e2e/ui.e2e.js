/* 畫面端到端測試：需要 jsdom（npm i -D jsdom），先 npm run build 再 node tests/e2e/ui.e2e.js。不在 npm test 裡，維持零套件相依。 */
const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','..','dist','index.html'),'utf8');
function mk(store){const errs=[];const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://user.github.io/sp5/',beforeParse(w){if(store)Object.keys(store).forEach(k=>w.localStorage.setItem(k,store[k]));w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.addEventListener('error',e=>errs.push(e.message));}});return {d:dom.window.document,W:dom.window,errs};}
const T=s=>s.replace(/\s+/g,' ').trim();
let ok=0,bad=0; const check=(name,cond,info)=>{ if(cond){ok++;console.log('  ✓',name);} else {bad++;console.log('  ✗',name,info||'');} };
function act(env){const {d,W}=env; return {
  click:el=>{if(!el)throw new Error('missing element');el.dispatchEvent(new W.MouseEvent('click',{bubbles:true}))},
  type:(el,v)=>{el.value=v;el.dispatchEvent(new W.Event('input',{bubbles:true}))},
  chg:(el,v)=>{if(el.type==='checkbox')el.checked=v;else el.value=v;el.dispatchEvent(new W.Event('change',{bubbles:true}))},
  visible:id=>{let e=d.getElementById(id); while(e){ if(e.hidden) return false; e=e.parentElement;} return true;}
};}
function tester(env){ const {d}=env,a=act(env); a.type(d.getElementById('birth'),'1986-06'); a.type(d.getElementById('workStart'),'25'); a.type(d.getElementById('asset'),'500'); a.type(d.getElementById('inc'),'9'); a.type(d.getElementById('spend'),'4.5'); a.click(d.getElementById('go')); }
function openPrec(env){ const b=env.d.getElementById('tgPrec'); if(b.getAttribute('aria-expanded')!=='true') act(env).click(b); }
function openAdj(env){ const b=env.d.getElementById('tgAdj'); if(b.getAttribute('aria-expanded')!=='true') act(env).click(b); }
const hero=d=>T(d.querySelector('.hero').textContent), imp=d=>T((d.querySelector('.cmpcard')||{textContent:''}).textContent).replace(/^.*?調整後條件/,'條件');
function section(t){ console.log('\n■ '+t); }

section('快速開始：P0 區塊與平台名稱');
{ const env=mk(), {d}=env, a=act(env);
  a.click(d.querySelector('[data-chip=car]')); a.click(d.querySelector('[data-chip=kidsOn]')); a.click(d.querySelector('[data-chip=parOn]'));
  ['sec-car','sec-kidsOn','sec-parOn'].forEach(id=>check('沒勾房貸，'+id+' 看得到',a.visible(id)));
  check('房貸區塊維持隱藏',!a.visible('sec-house'));
  check('網頁標題',d.title==='退休生命週期決策平台｜Retirement Lifecycle Decision Platform');
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('驗收：第一位測試者（1986/06、500 萬、月入 9 萬、生活費 4.5 萬）');
{ const env=mk(), {d}=env, a=act(env); tester(env);
  check('#2／#4／#8 不再卡在 55 歲：最快 53 歲 6 個月、2039 年 12 月',/53 歲 6 個月/.test(T(d.querySelector('.hero .age').textContent))&&/2039 年 12 月/.test(hero(d)),hero(d).slice(0,80));
  check('#1／#11 答案同時講錢：那時候退休，需要 1,171 萬，你會有 1,178 萬',/那時候退休，需要 1,171 萬，你會有 1,178 萬，夠用到 90 歲/.test(hero(d)),hero(d).slice(0,200));
  check('下限放寬後提醒橋接期：60 歲以前要靠存款撐 6 年 6 個月',/60 歲以前退休，要靠存款撐 6 年 6 個月/.test(hero(d)));
  check('結果卡底下一行假設灰字，沒有「看看每個期間的現金流」',/不靠投資・存款 1\.7%・通膨 2%・算到 90 歲/.test(hero(d))&&!/看看每個期間的現金流/.test(T(d.body.textContent.replace(/<[^>]+>/g,''))));
  openAdj(env);
  check('調調看最上面不再有「想再早一年」藍框',!/想再早一年/.test(T(d.getElementById('panelAdj').textContent))&&!d.querySelector('#panelAdj .hook'));
  a.click(d.getElementById('tgAdj'));
  // #1 工作期
  a.click(d.querySelector('[data-phase="0"]'));
  const wp=T(d.querySelector('.ppanel').textContent);
  check('#1 工作期寫出退休時有多少錢：1,178 萬＝現有 500＋存下 711－通膨 32.7',/退休時你會有 1,178 萬/.test(wp)&&/現有500 萬/.test(wp)&&/這段存下711 萬/.test(wp)&&/通膨讓存款縮水32.7 萬/.test(wp),wp.slice(0,160));
  // #12／#13 調整器
  openAdj(env);
  const rows=[...d.querySelectorAll('.strow')].map(x=>T(x.querySelector('.stlab').textContent));
  check('#12 調調看：全部是加減按鈕，分「你可以決定的」「萬一……」',rows.join('/')==='想在幾歲退休/每月花費/每月多存/活到/收入中斷多久/收入減少多少/晚年每月多花多少/通膨/勞保只領到'&&[...d.querySelectorAll('#adjCard .adjg > summary b')].map(x=>x.textContent).join('/')==='你可以決定的/萬一……',rows.join('/'));
  check('#13 金額每格 2,000',/每格 2,000/.test(T(d.getElementById('adjCard').textContent)));
  a.click(d.querySelector('[data-step="more:-1"]')); a.click(d.querySelector('[data-step="more:-1"]'));
  check('#3／#10 有調整 → 結果改成原始／調整後對照，原始那欄不動',!!d.querySelector('.cmpcard')&&/最快退休53 歲 6 個月2039\/12（最快）51 歲 7 個月/.test(imp(d)),imp(d));
  check('對照表上半部寫出條件：每月花費 4.5 萬 → 4.1 萬（少 4,000）',/條件每月花費4\.5 萬4\.1 萬少 4,000回復結果/.test(imp(d)),imp(d));
  check('#11 時間和錢都在表裡：早 1 年 11 個月；53 歲 6 個月退休多出 255 萬、多 247 萬',/↑ 早 1 年 11 個月/.test(imp(d))&&/在 53 歲 6 個月退休多出 7\.64 萬多出 255 萬↑ 多 247 萬/.test(imp(d)),imp(d));
  check('橫幅：調調看中＋回到原始＋存成新方案',/調調看中/.test(T(d.querySelector('.pvbar').textContent))&&!!d.getElementById('cmpReset')&&!!d.getElementById('saveNew'));
  check('曲線同時畫原始與調整後',d.querySelectorAll('#curveCard polyline').length===2);
  check('地圖有原始／調整後頁籤，預設調整後',d.querySelector('[data-mtab="adj"]').getAttribute('aria-selected')==='true');
  a.click(d.querySelector('[data-mtab="orig"]'));
  check('切到原始 → 地圖寫「原始：以 53 歲 6 個月」',/原始：以 53 歲 6 個月/.test(T(d.getElementById('mapCard').textContent)));
  a.click(d.getElementById('cmpReset'));
  check('回到原始：對照表、橫幅消失，大數字還是 53 歲 6 個月',!d.querySelector('.pvbar')&&!d.querySelector('.cmpcard')&&/53 歲 6 個月/.test(T(d.querySelector('.hero .age').textContent)));
  a.click(d.querySelector('[data-step="save:1"]'));
  check('#4 每月多存 2,000：最快一定變早',/↑ 早 /.test(imp(d)),imp(d));
  a.click(d.getElementById('cmpReset'));
  for(let i=0;i<5;i++) a.click(d.querySelector('[data-step="end:-1"]'));
  check('#8 活到 85：早 1 年 2 個月，錢也變多（多出 156 萬）',/52 歲 4 個月.*↑ 早 1 年 2 個月/.test(imp(d))&&/多出 156 萬/.test(imp(d)),imp(d));
  a.click(d.getElementById('cmpReset'));
  a.click(d.querySelector('[data-step="wi.gap:1"]'));
  check('#7／#10 萬一收入中斷 1 年：晚 1 年；錢從多出變成還差 129 萬',/54 歲 6 個月.*↓ 晚 1 年/.test(imp(d))&&/還差 129 萬/.test(imp(d)),imp(d));
  check('萬一的條件也寫在表裡（收入中斷：不會 → 1 年，名稱不加「萬一」）',/收入中斷多久不會1 年回復/.test(imp(d)),imp(d));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('調調看：調整器細節');
{ const env=mk(), {d}=env, a=act(env); tester(env); openAdj(env);
  const row=lab=>[...d.querySelectorAll('.strow')].find(x=>T(x.querySelector('.stlab').textContent)===lab), val=k=>T(row(['想在幾歲退休','每月花費'][k]||k).querySelector('.stv').textContent);
  a.click(d.querySelector('[data-edit="more"]'));
  check('點中間可以直接輸入（方向＋金額）',!!d.getElementById('ed-dir')&&!!d.getElementById('ed-val'));
  a.chg(d.getElementById('ed-dir'),'-1'); d.getElementById('ed-val').value='2500'; a.click(d.querySelector('[data-editok="more"]'));
  check('輸入少花 2,500 → 顯示「少 2,500」、條件寫 4.25 萬',val(1)==='少 2,500'&&/每月花費4\.5 萬4\.25 萬少 2,500/.test(imp(d)),val(1)+' | '+imp(d));
  a.click(d.querySelector('[data-step="more:1"]')); a.click(d.querySelector('[data-step="more:1"]'));
  check('再按兩次 + → 多花 1,500',val(1)==='多 1,500',val(1));
  a.click(d.getElementById('cmpReset'));
  a.click(d.querySelector('[data-step="ret:-1"]')); a.click(d.querySelector('[data-step="ret:-1"]'));
  check('想在 52 歲退休 → 錢不夠時多一列「要補上」：每月再多存或再少花，有兩個套用按鈕',/要補上每月再多存 [\d.]+ 萬或每月再少花 [\d.]+ 萬套用多存套用少花/.test(imp(d))&&d.querySelectorAll('[data-fill]').length===2,imp(d));
  a.click(d.querySelector('[data-fill^="save:"]'));
  check('套用多存 → 剛好夠（多出），要補上那列消失',/錢夠不夠多出 7\.64 萬多出/.test(imp(d))&&!/要補上/.test(imp(d)),imp(d));
  a.click(d.getElementById('cmpReset'));
  check('想在幾歲退休：預設「最快（53 歲 6 個月）」',val(0)==='最快（53 歲 6 個月）',val(0));
  for(let i=0;i<4;i++) a.click(d.querySelector('[data-step="ret:1"]'));
  check('按 4 次 + → 對齊整歲：54、55、56、57 歲；結果改成「退休時間」（你選的）',/^57 歲2043\/06$/.test(val(0))&&/退休時間53 歲 6 個月2039\/12（最快）57 歲2043\/06（你選的）晚 3 年 6 個月/.test(imp(d)),val(0)+' | '+imp(d));
  check('每一列都會變：退休時會有、橋接期 3 年、錢夠不夠',/退休時會有1,178 萬1,[3-9]\d\d 萬/.test(imp(d))&&/橋接期6 年 6 個月3 年/.test(imp(d))&&/錢夠不夠多出 7\.64 萬多出 [\d,]+ 萬/.test(imp(d)),imp(d));
  check('晚退休是自己選的，「晚 4 年」用中性色（不是紅色）',!d.querySelector('.cmpcard .cr.first .cd.bad'));
  check('地圖改用 57 歲畫',/以 57 歲（/.test(T(d.getElementById('mapCard').textContent)));
  a.click(d.querySelector('[data-step="more:-1"]')); a.click(d.querySelector('[data-step="more:-1"]'));
  check('同時少花 4,000 → 多一列「最快可以」51 歲 7 個月',/最快可以53 歲 6 個月51 歲 7 個月↑ 早 1 年 11 個月/.test(imp(d)),imp(d));
  a.click(d.querySelector('.rmc[data-rst="ret"]'));
  check('回復退休年紀 → 回到「最快退休」那一列',/最快退休53 歲 6 個月/.test(imp(d))&&!/你選的/.test(imp(d)),imp(d));
  a.click(d.getElementById('back')); a.click(d.getElementById('go'));
  check('重新計算 → 調整全部清掉、面板收起',!d.querySelector('.pvbar')&&!d.getElementById('panelAdj'));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('萬一……：通膨跟著設定');
{ const env=mk(), {d}=env, a=act(env); tester(env); openAdj(env);
  const infv=()=>T([...d.querySelectorAll('.strow')].find(x=>/通膨/.test(x.textContent)).querySelector('.stv').textContent);
  check('預設通膨寫「2%（設定）」',infv()==='2%（設定）',infv());
  a.click(d.querySelector('[data-step="wi.inf:1"]'));
  check('按 + → 3%',infv()==='3%',infv());
  a.click(d.querySelector('[data-step="wi.inf:-1"]'));
  check('按 − → 回到 2%（設定），而且 − 消失（不會低於設定）',infv()==='2%（設定）'&&!d.querySelector('[data-step="wi.inf:-1"]'));
  openPrec(env); a.click(d.querySelector('[data-pa="inf:3"]')); a.click(d.getElementById('applyPre3')); openAdj(env);
  check('提高準確度設 3% 後：萬一的通膨從 3%（設定）起跳',infv()==='3%（設定）',infv());
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('提高準確度：卡片、套用、原本 → 改成');
{ const env=mk(), {d}=env, a=act(env); tester(env);
  check('提高準確度預設收起',d.getElementById('tgPrec').getAttribute('aria-expanded')==='false'&&!d.getElementById('panelPrec'));
  a.click(d.getElementById('tgPrec'));
  check('按「提高準確度」→ 打開',!!d.getElementById('panelPrec'));
  const folds=[...d.querySelectorAll('.pfold summary')].map(x=>T(x.textContent).split(/\d|已填|沒有|第六類|算到/)[0]);
  check('摺疊：工作空窗、勞保老年年金、勞退新制、勞退舊制、健保（「其他／算到幾歲」已拿掉，改用萬一的「活到」）',folds.join('/')==='工作空窗/勞保老年年金/勞退新制/勞退舊制/健保'&&!d.querySelector('[data-pre="endAge"]'),folds.join('/'));
  a.chg(d.getElementById('pLc'),'60');
  check('改請領年齡 → 標「請領年齡 65 歲 → 60 歲」',/請領年齡 65 歲 → 60 歲/.test(T(d.querySelector('[data-chg=li]').textContent)));
  check('還沒套用就先出現對照：條件寫請領年齡 65 歲 → 60 歲',!!d.querySelector('.cmpcard')&&/請領年齡65 歲60 歲/.test(imp(d)),imp(d));
  check('橫幅：實際資料還沒套用＋取消＋設為新的原始',/實際資料還沒套用/.test(T(d.querySelector('.pvbar').textContent))&&!!d.getElementById('precCancel')&&!!d.getElementById('applyPre3'));
  a.click(d.getElementById('precCancel'));
  check('取消 → 對照消失、改回 65 歲',!d.querySelector('.cmpcard')&&!/請領年齡 65 歲 → 60 歲/.test(T((d.querySelector('[data-chg=li]')||{textContent:''}).textContent)));
  a.chg(d.getElementById('pLc'),'60'); a.click(d.getElementById('applyPre3'));
  check('套用後大數字下方：時間變化＋在原本時間退休的錢',d.querySelectorAll('.hero .hdelta').length===2&&/在 53 歲 6 個月退休：/.test(hero(d)),hero(d).slice(0,240));
  openPrec(env); a.type(d.getElementById('pLs'),'40'); a.chg(d.getElementById('pLs'),'40');
  check('不合理的提繳年資 → 欄位下方當場顯示錯誤（不用等按套用）',/勞退提繳年資/.test(T((d.querySelector('.ferr[data-ferr="lsYears"]')||{textContent:''}).textContent))&&d.getElementById('pLs').getAttribute('aria-invalid')==='true');
  a.click(d.getElementById('applyPre')); openPrec(env);
  check('按套用：填錯的不套用，留在欄位繼續顯示錯誤',d.getElementById('pLs').value==='40'&&!!d.querySelector('.ferr[data-ferr="lsYears"]'));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('#6 工作空窗：情境＋幾年幾個月');
{ const env=mk(), {d}=env, a=act(env); tester(env);
  openPrec(env);
  check('預設「工作空窗　沒有」',/^工作空窗沒有/.test(T(d.querySelector('.pfold[data-pf=gap] summary').textContent)));
  a.click(d.getElementById('gapAdd'));
  check('加一段：有情境選單、年、月',!!d.querySelector('[data-gapsit="0"]')&&!!d.querySelector('[data-gapy="0"]')&&!!d.querySelector('[data-gapm="0"]'));
  const opts=[...d.querySelector('[data-gapsit="0"]').options].map(o=>o.textContent);
  check('七種情境，含工會的兩種自由業',opts.length===7&&opts.includes('自由業、接案（有加入職業工會）')&&opts.includes('自由業、接案（沒有加入工會）'),opts.join('/'));
  { const box=d.querySelector('.pfold[data-pf=gap] .pfin').cloneNode(true); box.querySelectorAll('.purpose').forEach(x=>x.remove());
    check('空窗的情境選單與欄位不出現勞保、勞退、健保（只有用途說明提到）',!/勞保|勞退|健保/.test(T(box.textContent))); }
  check('空窗寫明用途：只用來判斷勞保、勞退年資要扣多少',/只用來判斷勞保、勞退年資要扣多少/.test(T(d.querySelector('.pfold[data-pf=gap] .pfin').textContent)));
  const ph0=d.getElementById('pLy').placeholder;
  a.type(d.querySelector('[data-gapy="0"]'),'4'); a.chg(d.querySelector('[data-gapy="0"]'),'4'); a.type(d.querySelector('[data-gapm="0"]'),'0');
  check('填完空窗 → 對照：晚 11 個月、在 53 歲 6 個月退休還差 115 萬',/54 歲 5 個月/.test(imp(d))&&/↓ 晚 11 個月/.test(imp(d))&&/還差 115 萬/.test(imp(d)),imp(d));
  check('標「工作空窗 沒有 → 1 段・共 4 年」',/工作空窗 沒有 → 1 段・共 4 年/.test(T(d.querySelector('[data-chg=gap]').textContent)),T(d.querySelector('[data-chg=gap]').textContent));
  a.click(d.getElementById('applyPre')); openPrec(env);
  check('套用後：標題「1 段・共 4 年」、勞保年資估算少 4 年',/1 段・共 4 年/.test(T(d.querySelector('.pfold[data-pf=gap] summary').textContent))&&(+ph0.replace(/\D/g,'')-(+d.getElementById('pLy').placeholder.replace(/\D/g,'')))===4,ph0+' → '+d.getElementById('pLy').placeholder);
  a.click(d.getElementById('gapAdd')); a.chg(d.querySelector('[data-gapsit="1"]'),'parental'); a.type(d.querySelector('[data-gapy="1"]'),'1');
  a.click(d.getElementById('applyPre')); openPrec(env);
  check('育嬰留停 1 年：勞保年資不再減少（還是少 4 年）',(+ph0.replace(/\D/g,'')-(+d.getElementById('pLy').placeholder.replace(/\D/g,'')))===4);
  a.chg(d.querySelector('[data-gapsit="0"]'),'job'); a.type(d.querySelector('[data-gapm="0"]'),'12'); a.chg(d.querySelector('[data-gapm="0"]'),'12');
  check('月填 12 → 當場擋下、顯示錯誤',/月要填 0 到 11/.test(T((d.querySelector('.ferr[data-ferr="gaps"]')||{textContent:''}).textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('特殊情況');
{ const env=mk(), {d}=env, a=act(env);
  a.type(d.getElementById('birth'),'1968-11'); a.type(d.getElementById('workStart'),'30'); a.type(d.getElementById('asset'),'50'); a.type(d.getElementById('inc'),'6'); a.type(d.getElementById('spend'),'5'); a.click(d.getElementById('go'));
  openAdj(env);
  check('65 歲還不夠：大字＋「要在 65 歲退休：每月多存…或少花…」與套用按鈕',/65 歲還不夠/.test(T(d.querySelector('.hero .age').textContent))&&/要在 65 歲退休：/.test(hero(d))&&d.querySelectorAll('.hero [data-apply]').length>=1); a.click(d.querySelector('[data-step="wi.li:-1"]')); a.click(d.querySelector('[data-step="wi.li:-1"]'));
  check('65 歲還不夠時：原始寫 65 歲還不夠，調整後算到 80 歲',/最快退休65 歲還不夠/.test(imp(d)),imp(d));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env);
  a.type(d.getElementById('asset'),'20'); a.type(d.getElementById('inc'),'4'); a.type(d.getElementById('spend'),'5'); a.click(d.getElementById('go'));
  check('入不敷出：還沒退休錢就用完',/還沒退休錢就用完/.test(hero(d)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env);
  a.type(d.getElementById('birth'),'1976-10'); a.type(d.getElementById('asset'),'5000'); a.type(d.getElementById('inc'),'5'); a.type(d.getElementById('spend'),'3'); a.click(d.getElementById('go'));
  openAdj(env);
  check('已經夠用：你現在就已經達到退休門檻',/你現在就已經達到退休門檻/.test(hero(d)),hero(d).slice(0,160));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('子女每階段、舊存檔、舊制提醒、方案比對');
{ const env=mk(), {d}=env, a=act(env);
  a.click(d.querySelector('[data-chip=kidsOn]')); a.type(d.getElementById('kby0'),'2015-03');
  const rows=()=>[...d.querySelectorAll('[data-kidbox="0"] .stg label')].map(x=>T(x.firstChild.textContent));
  check('小六：國小、國中、高中職、大學、研究所',rows().join('/')==='國小/國中/高中職/大學/研究所',rows().join('/'));
  a.type(d.getElementById('k0ele'),'5'); a.click(d.querySelector('[data-same="0:jun:ele"]'));
  check('同上',d.getElementById('k0jun').value==='5');
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const oldIn={birth:'1974-11',workStart:'24',asset:'520',inc:'11.5',spend:'4.2',house:false,car:false,kidsOn:true,parOn:false,oldOn:true,oHire:'2001',oYrs:'4.5',oWage:'9',housePay:'',houseYrs:'',housePre:false,housePreAge:'',houseRate:'',carPay:'',carYrs:'',par:'',parMode:'keep',parYrs:'',
    kids:[{bym:'2009-04',path:'grad',costs:{hs:'25',col:'32'}}], pre:{liYears:'',w60:'',lsBal:'',lsWage:'',lsYears:'',liClaim:'',self:'0',endAge:'',nhiDep:false}};
  const env=mk({'sp5:data':JSON.stringify({v:1,active:'s1',list:[{id:'s1',name:'舊方案',saved:oldIn,updated:'2026/09/30 10:00'}],cmp:[],showAll:false})}), d=env.d;
  check('舊存檔：子女轉成每階段（高中職 25）',d.getElementById('k0sen')&&d.getElementById('k0sen').value==='25');
  act(env).click(d.getElementById('go'));
  check('舊存檔：沒有工作空窗欄位也能算、不顯示有未存檔的修改',!d.querySelector('.scbar.dirty')&&T(d.getElementById('saveBtn').textContent)==='已存檔');
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env);
  a.type(d.getElementById('birth'),'1974-11'); a.type(d.getElementById('workStart'),'24'); a.type(d.getElementById('asset'),'400'); a.click(d.getElementById('go'));
  check('1998 年開始工作 → 提高準確度按鈕上寫「可能有勞退舊制」',/可能有勞退舊制/.test(T(d.getElementById('tgPrec').textContent)));
  a.click(d.getElementById('tgPrec'));
  check('打開提高準確度，最上面提醒可能有舊制年資',/可能有勞退舊制年資/.test(T(d.querySelector('#panelPrec .holdhint').textContent)));
  a.click(d.getElementById('goOld'));
  check('補上 → 打開提高準確度並打開勞退舊制',!!d.getElementById('panelPrec')&&d.querySelector('.pfold[data-pf=old]').open);
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env); tester(env);
  a.click(d.getElementById('openList')); a.click(d.getElementById('newSc'));
  openPrec(env); a.click(d.getElementById('gapAdd')); a.type(d.querySelector('[data-gapy="0"]'),'2'); a.click(d.getElementById('applyPre')); a.click(d.getElementById('saveBtn'));
  a.click(d.getElementById('openList')); a.click(d.getElementById('openCmp'));
  check('參數總表顯示工作空窗差異',/工作空窗/.test(T(d.getElementById('cmp').textContent))&&/1 段・共 2 年/.test(T(d.getElementById('cmp').textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('可見文字');
{ const env=mk(), {d}=env, a=act(env); tester(env);
  const vis=()=>{ const c=d.body.cloneNode(true); c.querySelectorAll('script,style').forEach(x=>x.remove()); return T(c.textContent); };
  openAdj(env); a.click(d.querySelector('[data-step="more:-1"]')); a.click(d.querySelector('[data-step="wi.gap:1"]'));
  check('畫面上沒有 SP5、SP2、壓力測試、多投入',!/SP5|SP2|壓力測試|多投入/.test(vis()));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('版面整理：結果 → 兩個按鈕，沒有詳細說明、沒有重複的連結');
{ const env=mk(), {d}=env, a=act(env); tester(env);
  check('沒有「詳細說明」卡片',!d.getElementById('heroDet')&&!/詳細說明/.test(T(d.getElementById('result').textContent)));
  check('沒有「補上實際資料 ›」重複連結（提高準確度按鈕就是它）',!/補上實際資料 ›/.test(T(d.getElementById('result').textContent)));
  const kids=[...d.getElementById('result').children].map(x=>x.className||x.id);
  check('結果卡後面緊接兩個按鈕',kids[kids.indexOf('card hero')+1]==='twin',kids.join(','));
  check('假設灰字是純文字（不是按鈕，不會打開任何東西）',d.querySelector('.hero .assume').tagName==='DIV');
  const tw=[...d.querySelectorAll('.twin button b')].map(x=>x.textContent);
  check('並排兩個按鈕：調調看、提高準確度，預設都收起',tw.join('/')==='調調看/提高準確度'&&!d.getElementById('panelAdj')&&!d.getElementById('panelPrec'));
  check('提高準確度按鈕寫出幾項是估算的',/5 項是估算的/.test(T(d.getElementById('tgPrec').textContent)));
  a.click(d.getElementById('tgAdj'));
  check('打開調調看',!!d.getElementById('panelAdj')&&!d.getElementById('panelPrec'));
  a.click(d.getElementById('tgPrec'));
  check('改開提高準確度 → 調調看自動收起（一次一個）',!!d.getElementById('panelPrec')&&!d.getElementById('panelAdj'));
  a.click(d.getElementById('tgPrec'));
  check('再按一次 → 收起',!d.getElementById('panelPrec'));
  a.click(d.getElementById('tgAdj')); a.click(d.querySelector('[data-step="more:-1"]')); a.click(d.getElementById('tgAdj'));
  check('調調看收起來，對照表仍然看得到',!d.getElementById('panelAdj')&&!!d.querySelector('.cmpcard'));
  check('調調看按鈕寫「已調整」',/已調整/.test(T(d.getElementById('tgAdj').textContent)));
  check('對照時，假設灰字放在對照表底下',/不靠投資・存款/.test(T(d.querySelector('.cmpcard').textContent)));
  a.click(d.getElementById('cmpReset')); openAdj(env);
  a.click(d.querySelector('[data-step="ret:-1"]')); a.click(d.querySelector('[data-step="ret:-1"]'));
  a.click(d.querySelector('[data-fill^="more:"]'));
  check('對照表的「套用少花」→ 調調看的每月花費跟著改、面板保持打開',!!d.getElementById('panelAdj')&&/少 /.test(T([...d.querySelectorAll('.strow')].find(x=>/每月花費/.test(x.textContent)).querySelector('.stv').textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('混合（實際資料＋調調看）與存成新方案');
{ const env=mk(), {d}=env, a=act(env); tester(env);
  a.click(d.getElementById('tgPrec')); a.click(d.getElementById('gapAdd')); a.type(d.querySelector('[data-gapy="0"]'),'4'); a.chg(d.querySelector('[data-gapy="0"]'),'4');
  openAdj(env); a.click(d.querySelector('[data-step="more:-1"]')); a.click(d.querySelector('[data-step="end:-1"]'));
  a.click(d.querySelector('[data-step="wi.gap:1"]')); a.click(d.querySelector('[data-step="wi.li:-1"]')); a.click(d.querySelector('[data-step="wi.li:-1"]'));
  check('混合：橫幅只有「回到原始」「存成新方案」',/實際資料還沒套用・調調看中/.test(T(d.querySelector('.pvbar').textContent))&&!!d.getElementById('cmpReset')&&!!d.getElementById('saveNew')&&!d.getElementById('applyPre3'));
  check('條件分「實際資料」「如果……」兩段',/條件實際資料工作空窗/.test(imp(d))&&/如果……每月花費/.test(imp(d)),imp(d));
  check('條件超過 3 項 → 收起「還有 N 項」',/還有 2 項 ›/.test(imp(d)),imp(d));
  a.click(d.getElementById('condAll'));
  check('展開後看得到萬一的條件',/勞保只領到不打折80%回復/.test(imp(d)),imp(d));
  const before=d.querySelectorAll('.scrow').length, n0=T(d.querySelector('.scbar .ct').textContent);
  a.click(d.getElementById('saveNew'));
  check('存成新方案：方案數 +1、自動命名、切到新方案',/2／10/.test(T(d.querySelector('.scbar .ct').textContent))&&/（少花 2,000等）/.test(T(d.querySelector('.scbar .nm').textContent)),T(d.querySelector('.scbar').textContent));
  check('新方案：沒有對照、提示萬一沒存進去',!d.querySelector('.cmpcard')&&/萬一……沒有存進去/.test(d.getElementById('toast').textContent));
  a.click(d.getElementById('back'));
  check('新方案的輸入：生活費 4.3 萬',d.getElementById('spend').value==='4.3');
  a.click(d.getElementById('go')); a.click(d.getElementById('tgPrec'));
  check('新方案的實際資料：工作空窗 1 段・共 4 年',/1 段・共 4 年/.test(T(d.querySelector('.pfold[data-pf=gap] summary').textContent)));
  openAdj(env);
  check('新方案的基準活到 89 歲：萬一的「活到」從 89 歲開始、灰字寫算到 89 歲',/活到−89 歲\+/.test(T(d.getElementById('adjCard').textContent))&&/算到 89 歲/.test(T(d.querySelector('.hero .assume').textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('回原設定：單一因素');
{ const env=mk(), {d}=env, a=act(env); tester(env); openAdj(env);
  a.click(d.querySelector('[data-step="more:-1"]')); a.click(d.querySelector('[data-step="wi.gap:1"]')); a.click(d.querySelector('[data-step="end:-1"]'));
  check('改了三項 → 三列都出現「回復」，沒改的沒有',d.querySelectorAll('.strst').length===3);
  a.click(d.querySelector('.strow [data-rst="wi.gap"]'));
  check('「回復」只改回收入中斷，其他兩項還在',!/收入中斷/.test(imp(d))&&/每月花費/.test(imp(d))&&/活到/.test(imp(d)),imp(d));
  a.click(d.querySelector('.rmc[data-rst="more"]'));
  check('對照表條件列的「回復」也能單獨拿掉一項（剩活到）',!/每月花費/.test(imp(d))&&/活到/.test(imp(d)),imp(d));
  a.click(d.querySelector('.rmc[data-rst="end"]'));
  check('全部拿掉 → 回到單欄結果',!d.querySelector('.cmpcard')&&!d.querySelector('.pvbar'));
  openPrec(env); a.chg(d.getElementById('pLc'),'60');
  a.click(d.querySelector('.rmc[data-rst="pre.liClaim"]'));
  check('實際資料的條件也能用「回復」改回（請領年齡回到法定）',!d.querySelector('.cmpcard'));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('你的錢會怎麼走、每個階段的收支');
{ const env=mk(), {d}=env, a=act(env); tester(env);
  check('曲線有座標軸、標「年齡」「萬」',d.querySelectorAll('#curveCard .ca').length>=2&&/年齡/.test(d.querySelector('#curveCard svg').textContent)&&/萬/.test(d.querySelector('#curveCard svg').textContent));
  check('沒調整時標出退休時間（53 歲 6 個月退休）',[...d.querySelectorAll('#curveCard .cl')].some(x=>/53 歲 6 個月退休/.test(x.textContent)));
  openAdj(env); a.click(d.querySelector('[data-step="more:-1"]')); a.click(d.querySelector('[data-step="more:-1"]'));
  const labs=[...d.querySelectorAll('#curveCard .cl')].map(x=>x.textContent).join(' / ');
  check('對照時：原始與調整後的退休時間都標出來',/原始 53 歲 6 個月退休/.test(labs)&&/調整後 51 歲 7 個月退休/.test(labs),labs);
  check('地圖改名「每個階段的收支」',d.querySelector('#mapCard h2').textContent==='每個階段的收支');
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('按了沒反應的按鈕不顯示');
{ const env=mk(), {d}=env, a=act(env); tester(env); openAdj(env);
  const has=(lab,dir)=>!![...d.querySelectorAll('.strow')].find(x=>T(x.querySelector('.stlab').textContent)===lab).querySelector('[data-step$=":'+dir+'"]');
  check('一開始：收入中斷、收入減少、75 歲後多花、通膨只有 +',['收入中斷多久','收入減少多少','晚年每月多花多少','通膨'].every(l=>!has(l,'-1')&&has(l,'1')));
  check('一開始：勞保只領到只有 −（不打折已經是上限）',has('勞保只領到','-1')&&!has('勞保只領到','1'));
  check('每月花費、每月多存、活到、想在幾歲退休兩邊都有',['每月花費','每月多存','活到','想在幾歲退休'].every(l=>has(l,'-1')&&has(l,'1')));
  a.click(d.querySelector('[data-step="wi.gap:1"]'));
  check('收入中斷按 + 之後，− 出現',has('收入中斷多久','-1'));
  a.click(d.querySelector('[data-step="wi.gap:1"]')); a.click(d.querySelector('[data-step="wi.gap:1"]'));
  check('收入中斷到 3 年上限，+ 消失',!has('收入中斷多久','1'));
  a.click(d.querySelector('[data-step="wi.li:-1"]'));
  check('勞保按 − 之後，+ 出現',has('勞保只領到','1'));
  check('隱藏的按鈕保留位置（數字不會左右跳）',d.querySelectorAll('.stb-sp').length>=1);
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('存成新方案：想在幾歲退休不存');
{ const env=mk(), {d}=env, a=act(env); tester(env); openAdj(env);
  a.click(d.querySelector('[data-step="ret:1"]')); a.click(d.querySelector('[data-step="more:-1"]'));
  a.click(d.getElementById('saveNew'));
  check('提示「想在幾歲退休、萬一……沒有存進去」',/想在幾歲退休、萬一……沒有存進去/.test(d.getElementById('toast').textContent));
  check('新方案名稱用其他調整命名（少花 2,000）',/（少花 2,000）/.test(T(d.querySelector('.scbar .nm').textContent)),T(d.querySelector('.scbar .nm').textContent));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('想在幾歲退休：對齊整歲、輸入年月');
{ const env=mk(), {d}=env, a=act(env); tester(env); openAdj(env);
  const rv=()=>T([...d.querySelectorAll('.strow')][0].querySelector('.stv').textContent);
  a.click(d.querySelector('[data-step="ret:-1"]'));
  check('從最快（53 歲 6 個月）按 − → 53 歲（不是 52 歲 6 個月）',/^53 歲2039\/06$/.test(rv()),rv());
  a.click(d.getElementById('cmpReset'));
  a.click(d.querySelector('[data-step="ret:1"]'));
  check('從最快按 + → 54 歲',/^54 歲2040\/06$/.test(rv()),rv());
  a.click(d.querySelector('.stv[data-edit="ret"]'));
  check('點中間 → 輸入年、月',!!d.getElementById('ed-y')&&!!d.getElementById('ed-m'));
  d.getElementById('ed-y').value='2038'; d.getElementById('ed-m').value='2'; a.click(d.querySelector('[data-editok="ret"]'));
  check('輸入 2038 年 2 月 → 51 歲 8 個月',/^51 歲 8 個月2038\/02$/.test(rv()),rv());
  a.click(d.querySelector('[data-step="ret:1"]'));
  check('從 51 歲 8 個月按 + → 對齊到 52 歲',/^52 歲/.test(rv()),rv());
  a.click(d.querySelector('.stv[data-edit="ret"]')); d.getElementById('ed-y').value='2020'; d.getElementById('ed-m').value='1'; a.click(d.querySelector('[data-editok="ret"]'));
  check('輸入過去的年月 → 擋下並提示',/要在現在到 80 歲之間/.test(d.getElementById('toast').textContent));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('萬一……的名稱寫清楚調的是什麼');
{ const env=mk(), {d}=env, a=act(env); tester(env); openAdj(env);
  const t=T(d.getElementById('adjCard').textContent);
  check('收入中斷多久、收入減少多少、晚年每月多花多少',/收入中斷多久/.test(t)&&/收入減少多少/.test(t)&&/晚年每月多花多少/.test(t));
  check('晚年多花寫「從 75 歲起」，不提壽命',/從 75 歲起/.test(t)&&!/最後 8 年|最後八年|餘命/.test(t));
  a.click(d.querySelector('[data-step="wi.spend:1"]'));
  check('晚年每月多花 1 萬：值寫「多 1 萬」，對照表條件寫「晚年每月多花多少 不會 → 多 1 萬」',/晚年每月多花多少−多 1 萬\+/.test(T(d.getElementById('adjCard').textContent))&&/晚年每月多花多少不會多 1 萬回復/.test(imp(d)),imp(d));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('舊方案存過算到幾歲：照樣用，清除也不會改掉');
{ const old={birth:'1986-06',workStart:'25',asset:'500',inc:'9',spend:'4.5',house:false,car:false,kidsOn:false,parOn:false,housePay:'',houseYrs:'',housePre:false,housePreAge:'',houseRate:'',carPay:'',carYrs:'',par:'',parMode:'keep',parYrs:'',kids:[],
    pre:{liYears:'',w60:'',lsBal:'',lsWage:'',lsYears:'',liClaim:'',self:'0',endAge:'95',nhiDep:false,inf:'',dep:'',oldOn:false,oHire:'',oYrs:'',oWage:'',gaps:[]}};
  const env=mk({'sp5:data':JSON.stringify({v:1,active:'s1',list:[{id:'s1',name:'算到 95',saved:old,updated:'2026/10/01 10:00'}],cmp:[],showAll:false})}), {d}=env, a=act(env);
  a.click(d.getElementById('go'));
  check('舊方案存的 95 歲照樣當原始（灰字寫算到 95 歲）',/算到 95 歲/.test(T(d.querySelector('.hero .assume').textContent)));
  openAdj(env);
  check('萬一的「活到」從 95 歲開始調',/活到−95 歲\+/.test(T(d.getElementById('adjCard').textContent)));
  openPrec(env); a.click(d.getElementById('clearPre'));
  check('按「清除，改回估算」不會把算到幾歲改回 90',/算到 95 歲/.test(T(d.querySelector('.hero .assume').textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('v0.6.9：只算你那一份、隱私、那天需要多少');
{ const env=mk(), {d}=env, a=act(env);
  check('快速開始寫明只算你那一份、資料不會上傳',/只算你自己負擔的那一份/.test(T(d.getElementById('scopeNote').textContent))&&/不會上傳/.test(T(d.getElementById('scopeNote').textContent)));
  a.click(d.querySelector('[data-chip=kidsOn]')); a.click(d.querySelector('[data-chip=parOn]'));
  check('孩子、孝親費寫明用途',/只用來算每個學習階段/.test(T(d.getElementById('sec-kidsOn').textContent))&&/不需要填父母的任何資料/.test(T(d.getElementById('sec-parOn').textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env); tester(env);
  check('結果卡底下灰字多「只算你自己那一份」',/只算你自己那一份/.test(T(d.querySelector('.assume').textContent)));
  openAdj(env); for(let i=0;i<5;i++) a.click(d.querySelector('[data-step="ret:1"]'));
  check('對照表多一列「需要有」，在「退休時會有」上面',/需要有1,171 萬[\d,]+ 萬退休時會有/.test(imp(d)),imp(d));
  check('對照表下面解釋「需要有」',/需要有：在那個時間退休/.test(T(d.querySelector('.cmpcard').textContent)));
  openPrec(env);
  check('健保寫明用途',/只用來判斷退休後要不要自己繳健保費/.test(T(d.querySelector('.pfold[data-pf=nhi]').textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env);
  a.type(d.getElementById('birth'),'1968-11'); a.type(d.getElementById('workStart'),'30'); a.type(d.getElementById('asset'),'50'); a.type(d.getElementById('inc'),'6'); a.type(d.getElementById('spend'),'5'); a.click(d.getElementById('go'));
  check('65 歲還不夠：65 歲退休，需要 684 萬，你會有 133 萬，還差 551 萬',/65 歲退休，需要 684 萬，你會有 133 萬，還差 551 萬/.test(hero(d)),hero(d).slice(0,200));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('v0.6.9：勞保一次領 vs 月領');
function liCase(env, birth, ws, asset){ const {d}=env,a=act(env); a.type(d.getElementById('birth'),birth); a.type(d.getElementById('workStart'),ws); a.type(d.getElementById('asset'),asset||'520'); a.type(d.getElementById('inc'),'11.5'); a.type(d.getElementById('spend'),'4.2'); a.click(d.getElementById('go')); openPrec(env); }
const how=d=>T((d.querySelector('.lihow')||{textContent:''}).textContent);
{ const env=mk(), {d}=env, a=act(env); liCase(env,'1990-03','23');
  check('2013 年才開始工作 → 你只能月領，不顯示比較',/你只能月領/.test(how(d))&&!d.querySelector('.licmp')&&!d.querySelector('[data-pa="liMode:lump"]'));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env); liCase(env,'1974-11','24');
  check('2009 年前開始工作、沒填年資 → 無法判斷，請查勞保局，不顯示比較',/還無法判斷/.test(how(d))&&/勞保局/.test(how(d))&&!d.querySelector('.licmp'));
  a.type(d.getElementById('pLy'),'28'); a.chg(d.getElementById('pLy'),'28'); a.type(d.getElementById('pW'),'4.58'); a.chg(d.getElementById('pW'),'4.58');
  check('填了 28 年 → 可以選一次領（第 58 條），出現月領／一次領',/可以選一次領（勞保條例第 58 條）/.test(how(d))&&!!d.querySelector('[data-pa="liMode:lump"]'));
  const card=()=>T(d.querySelector('.licmp').textContent);
  check('比較卡：一次領 55 歲 10 個月 206 萬、月領 65 歲起每月 2.27 萬',/一次領55 歲 10 個月領 206 萬/.test(card())&&/月領65 歲起每月 2\.27 萬/.test(card()),card().slice(0,200));
  check('比較卡：兩條累計線＋交叉點，只寫事實「活過 72 歲，月領累計超過一次領」',d.querySelectorAll('.licmp polyline').length===2&&/活過 72 歲，月領累計超過一次領。/.test(card()));
  check('比較卡不寫建議、划算',!/建議|划算|比較好|應該/.test(card()));
  check('比較卡寫明含國保、一次領後不能保國保、核付後不能改',/含國保/.test(card())&&/不能再參加國民年金保險/.test(card())&&/不能改/.test(card()));
  check('比較卡不放進主結果',!d.querySelector('.hero .licmp')&&!d.querySelector('.cmpcard .licmp'));
  a.click(d.querySelector('[data-pa="liMode:lump"]'));
  check('選一次領 → 先對照：條件寫「勞保怎麼領 月領 → 一次領」',/勞保怎麼領月領一次領回復/.test(imp(d)),imp(d));
  a.click(d.getElementById('applyPre3')); openPrec(env);
  check('設為新的原始後，勞保標題寫「一次領」',/一次領/.test(T(d.querySelector('.pfold[data-pf=li] summary').textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env); liCase(env,'1974-11','24','900');   // 56 歲 8 個月退休、年資未滿 15 年：60 歲前退休，性別才有差（v0.6.11 起併計國保，最快退休變早）
  a.type(d.getElementById('pLy'),'5'); a.chg(d.getElementById('pLy'),'5');
  check('年資短 → 還是無法判斷，可以勾「我查過了」',/還無法判斷/.test(how(d))&&!!d.querySelector('[data-pre="liPre09"]'));
  a.chg(d.querySelector('[data-pre="liPre09"]'),true);
  check('勾了 → 可以選一次領（你確認過……）',/你確認過 2009 年以前就有勞保年資/.test(how(d)));
  check('年資未滿 15 年 → 出現「勞保登記的性別（選填）」並寫明用途',/勞保登記的性別（選填）/.test(T(d.querySelector('.liq').textContent))&&/只用來判斷勞保一次領最早幾歲能領/.test(T(d.querySelector('.liq').textContent))&&/不影響其他計算/.test(T(d.querySelector('.liq').textContent)));
  const lumpAgeTxt=()=>T(d.querySelector('.licmp .lump').textContent);
  const before=lumpAgeTxt(); a.click(d.querySelector('[data-pa="sex:F"]'));
  check('選女 → 一次領從 60 歲提早到退休那個月（56 歲 8 個月；女性 55 歲就符合，但要先退休退保）',/^一次領60 歲領/.test(before)&&/^一次領56 歲 8 個月領/.test(lumpAgeTxt()),before+' → '+lumpAgeTxt());
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env); liCase(env,'1974-11','24');
  a.type(d.getElementById('pLy'),'28'); a.chg(d.getElementById('pLy'),'28');
  check('年資滿 15 年、50 歲以後退休 → 不問性別、不問同一家公司年資',!d.querySelector('.liq'));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env, a=act(env); liCase(env,'1974-11','24','300');   // 60 歲 4 個月退休
  a.type(d.getElementById('pLy'),'5'); a.chg(d.getElementById('pLy'),'5'); a.chg(d.querySelector('[data-pre="liPre09"]'),true);
  check('年資未滿 15 年、但 60 歲以後才退休 → 不問性別（問了也沒差）',!d.querySelector('.liq'));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('調調看：兩組都能收起，收起時寫出改了什麼');
{ const env=mk(), {d,W}=env, a=act(env); tester(env); openAdj(env);
  const g=k=>d.querySelector('[data-ag="'+k+'"]'), sum=k=>T(g(k).querySelector('summary span').textContent);
  check('兩組都是可以收起的區塊，預設展開，標題寫「沒有調整」',g('mine').tagName==='DETAILS'&&g('wi').tagName==='DETAILS'&&g('mine').open&&g('wi').open&&sum('mine')==='沒有調整'&&sum('wi')==='沒有調整');
  a.click(d.querySelector('[data-step="ret:1"]')); a.click(d.querySelector('[data-step="more:-1"]'));
  a.click(d.querySelector('[data-step="wi.gap:1"]')); a.click(d.querySelector('[data-step="end:-1"]'));
  check('你可以決定的：想在 54 歲退休・少花 2,000',sum('mine')==='想在 54 歲退休・少花 2,000',sum('mine'));
  check('萬一……：活到 89 歲・收入中斷 1 年（活到歸在萬一）',sum('wi')==='活到 89 歲・收入中斷 1 年',sum('wi'));
  g('wi').open=false; g('wi').dispatchEvent(new W.Event('toggle'));
  a.click(d.querySelector('[data-step="more:-1"]'));
  check('收起萬一後再調別的，重算後仍維持收起，摘要還在',!g('wi').open&&g('mine').open&&sum('wi')==='活到 89 歲・收入中斷 1 年');
  a.click(d.querySelector('.strow [data-rst="wi.gap"]'));
  check('回復收入中斷 → 收起的摘要跟著更新',sum('wi')==='活到 89 歲',sum('wi'));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('結果頁最下面的假設改成分點');
{ const env=mk(), {d}=env, a=act(env); tester(env);
  const li=[...d.querySelectorAll('.disc li')].map(x=>T(x.textContent));
  check('假設分成 10 點',li.length===10,li.length);
  check('第一點就是只算你自己那一份（含配偶負擔家用的原文）',/^只算你自己負擔的那一份，並假設配偶持續負擔其目前的家用份額。/.test(li[0]));
  check('涵蓋存款利率、通膨、算到幾歲、勞保勞退國保、健保、工作空窗、不是建議',[/年利率 1\.7%/,/通膨 2%/,/算到 90 歲/,/國保保費與年金已計入/,/第六類自付每月 826 元/,/工作空窗只問多久/,/不是建議/].every(r=>li.some(x=>r.test(x))));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('v0.6.11：勞保年資未滿 15 年、適用範圍');
function u15(env, asset){ const {d}=env,a=act(env); a.type(d.getElementById('birth'),'1967-04'); a.type(d.getElementById('workStart'),asset==='1500'?'56':'50'); a.type(d.getElementById('asset'),asset); a.type(d.getElementById('inc'),'5'); a.type(d.getElementById('spend'),'3'); a.click(d.getElementById('go')); openPrec(env); }
{ const env=mk(), {d}=env;
  check('快速開始寫明只算勞保、勞退，公教軍人、農民不適用',/只算勞保、勞退；公務員、教師、軍人、農民的退休制度不同，結果不適用/.test(T(d.getElementById('scopeNote').textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env; u15(env,'800');
  check('勞保 10.7 年＋國保 4.3 年 → 標題「65 歲月領（併計國保）」',/65 歲月領（併計國保）/.test(T(d.querySelector('.pfold[data-pf=li] summary').textContent)));
  check('說明：合計滿 15 年、65 歲可以月領、不能提前延後、國保另外算、一次金領了就不能併計',[/合計滿 15 年/,/65 歲可以月領勞保年金/,/不能提前、延後/,/國保年金另外算/,/不能再併計/].every(r=>r.test(T(d.querySelector('.u15').textContent))));
  check('每個階段的收支：有勞保年金（不是只靠資產）',/勞保|雙年金/.test([...d.querySelectorAll('.phc b')].map(x=>x.textContent).join('/')));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env; u15(env,'1500');
  check('勞保 3.5 年、加國保也不滿 15 年 → 標題「65 歲老年一次金」',/65 歲老年一次金/.test(T(d.querySelector('.pfold[data-pf=li] summary').textContent)));
  check('說明：老年一次金 16 萬、每年 1 個月、請領年齡不適用',/可以領老年一次金 16 萬/.test(T(d.querySelector('.u15').textContent))&&/每年 1 個月/.test(T(d.querySelector('.u15').textContent)));
  check('假設提到沒算公保、軍保、農保與一次領的稅',[...d.querySelectorAll('.disc li')].some(x=>/公保、軍保、農保/.test(x.textContent)&&/一次領的稅/.test(x.textContent)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env; tester(env); openPrec(env);
  check('勞保滿 15 年的人不出現未滿 15 年的說明',!d.querySelector('.u15'));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('v0.6.12：一次請領用退保前 3 年平均、季發、農民');
{ const env=mk(), {d}=env, a=act(env); liCase(env,'1974-11','24');
  a.type(d.getElementById('pLy'),'28'); a.chg(d.getElementById('pLy'),'28'); a.type(d.getElementById('pW'),'4.58'); a.chg(d.getElementById('pW'),'4.58');
  check('可以選一次領時，出現選填的「退保前 3 年平均月投保薪資」並寫明用途',!!d.getElementById('pW36')&&/只用來算一次請領的金額/.test(how(d)));
  const lump=()=>T(d.querySelector('.licmp .lump').textContent);
  check('沒填：一次領 206 萬',/領 206 萬/.test(lump()),lump());
  a.type(d.getElementById('pW36'),'3.2'); a.chg(d.getElementById('pW36'),'3.2');
  check('填 3.2 萬 → 一次領變 144 萬，附註寫用你填的數字',/領 144 萬/.test(lump())&&/一次領用你填的退保前 3 年平均（3\.2 萬）/.test(T(d.querySelector('.licmp').textContent)),lump());
  check('對照表條件寫「退保前 3 年平均」',/退保前 3 年平均用平均月投保薪資估算3\.2 萬/.test(imp(d)),imp(d));
  a.type(d.getElementById('pW36'),'5'); a.chg(d.getElementById('pW36'),'5');
  check('填 5 萬（超過上限）→ 欄位下方顯示錯誤；對照表照樣在（其他有效的修改還在）',/退保前 3 年平均月投保薪資/.test(T((d.querySelector('.ferr[data-ferr="w36"]')||{textContent:''}).textContent))&&!!d.querySelector('.cmpcard')&&!/還不能比較/.test(T(d.getElementById('result').textContent)));
  check('填錯的那項不算進對照表的條件',!/退保前 3 年平均/.test(imp(d)),imp(d));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }
{ const env=mk(), {d}=env; liCase(env,'1990-03','23');
  check('不能選一次領的人，不出現退保前 3 年平均',!d.getElementById('pW36'));
  const li=[...d.querySelectorAll('.disc li')].map(x=>T(x.textContent));
  check('假設寫明勞退月退是季發、沒算老農津貼與農民退休儲金',li.some(x=>/季發/.test(x))&&li.some(x=>/老農津貼、農民退休儲金/.test(x)));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('工作期入不敷出時，不寫「存下 -X 萬」');
{ const env=mk(), {d}=env, a=act(env);
  a.type(d.getElementById('birth'),'1978-05'); a.type(d.getElementById('workStart'),'24'); a.type(d.getElementById('asset'),'380'); a.type(d.getElementById('inc'),'4'); a.type(d.getElementById('spend'),'4.5'); a.click(d.getElementById('go'));
  a.click(d.querySelectorAll('#mapCard .phc')[0]);
  const t=T(d.querySelector('#mapCard .ppanel').textContent);
  check('工作期支出大於收入 → 寫「－ 這段入不敷出」，不出現負的「存下」',/－ 這段入不敷出/.test(t)&&!/這段存下\s*-/.test(t),t.slice(0,160));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

section('v0.7.0：填錯當場擋下，不算修改');
{ const env=mk(), {d}=env, a=act(env); tester(env); openPrec(env);
  a.type(d.getElementById('pLy'),'abc'); a.chg(d.getElementById('pLy'),'abc');
  check('只填錯一項 → 沒有對照表、沒有黃色橫幅（填錯不算修改）',!d.querySelector('.cmpcard')&&!d.querySelector('.pvbar'));
  check('提高準確度按鈕寫「1 項有錯」',/1 項有錯/.test(T(d.getElementById('tgPrec').textContent)),T(d.getElementById('tgPrec').textContent));
  check('錯誤寫在勞保年資欄位下方',!!d.querySelector('.ferr[data-ferr="liYears"]'));
  a.type(d.getElementById('pLy'),'20'); a.chg(d.getElementById('pLy'),'20');
  check('改正 → 錯誤消失，出現對照表',!d.querySelector('.ferr')&&!!d.querySelector('.cmpcard')&&/勞保年資估算 15 年20 年/.test(imp(d)),imp(d));
  a.type(d.getElementById('pW'),'9'); a.chg(d.getElementById('pW'),'9');
  check('一對一錯 → 對照表只有對的那項，按鈕寫「1 項有錯・1 項還沒套用」',/1 項有錯・1 項還沒套用/.test(T(d.getElementById('tgPrec').textContent))&&/勞保年資/.test(imp(d))&&!/平均月投保薪資/.test(imp(d)),T(d.getElementById('tgPrec').textContent));
  a.click(d.getElementById('applyPre')); openPrec(env);
  check('套用：對的套用了（勞保年資 20），錯的留在欄位（9）並提示',d.getElementById('pLy').value==='20'&&d.getElementById('pW').value==='9'&&!!d.querySelector('.ferr[data-ferr="w60"]')&&/1 項有錯，沒有套用/.test(d.getElementById('toast').textContent));
  check('套用後沒有對照表（剩下的只有填錯的那項）',!d.querySelector('.cmpcard'));
  check('沒有執行錯誤',env.errs.length===0,env.errs); }

console.log('\n'+ok+' 通過，'+bad+' 失敗');
