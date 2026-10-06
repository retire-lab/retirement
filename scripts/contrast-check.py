"""scripts/contrast-check.py — 真瀏覽器的顏色對比檢查（v1.0，依外部評論）
jsdom 沒有真的排版，tests/a11y.test.js 只能關掉 color-contrast；這支用 Playwright 的 Chromium 跑 axe 的 color-contrast，
淺色、深色兩種模式 × 單人與夫妻的 9 個畫面。改了顏色或版面後手動跑：
  npm run build && python3 scripts/contrast-check.py
需要：pip install playwright && playwright install chromium（GitHub Actions 沒有跑這支）"""
import asyncio, json
from playwright.async_api import async_playwright
AXE=open('node_modules/axe-core/axe.min.js',encoding='utf-8').read()
PERSON={"birth":"1978-05","workStart":"24","asset":"450","inc":"9","spend":"4","house":False,"car":False,"kidsOn":False,"parOn":False,"housePay":"","houseYrs":"","housePre":False,"housePreAge":"","houseRate":"","carPay":"","carYrs":"","par":"","parMode":"keep","parYrs":"","kids":[{"bym":"","path":"grad","costs":{}}],"pre":{"liYears":"","w60":"","lsBal":"","lsWage":"","lsYears":"","liClaim":"","self":"0","endAge":"","nhiDep":False,"inf":"","dep":"","oldOn":False,"oHire":"","oYrs":"","oWage":"","gaps":[],"liMode":"","liPre09":False,"sex":"","sameCo":"","w36":""}}
async def scan(p,name,out):
    r=await p.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'rule',values:['color-contrast']}});return r.violations.flatMap(v=>v.nodes.map(n=>({t:n.target.join(' '),html:n.html.slice(0,90),d:(n.any[0]||{}).data||{}})));}")
    for x in r: out.append((name,x['t'],round(x['d'].get('contrastRatio',0),2),x['d'].get('expectedContrastRatio'),x['d'].get('fgColor'),x['d'].get('bgColor'),x['html']))
async def run(scheme,out):
    async with async_playwright() as pw:
        b=await pw.chromium.launch(args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},color_scheme=scheme); p=await ctx.new_page()
        await p.goto('file://'+__import__('os').path.abspath('dist/index.html')); await p.add_script_tag(content=AXE)
        await scan(p,scheme+'｜快速開始',out)
        await p.evaluate("(s)=>{localStorage.setItem('sp5:data',JSON.stringify({v:1,active:'s1',list:[{id:'s1',name:'t',saved:s,updated:'x'}],cmp:[],showAll:false}));}",PERSON)
        await p.reload(); await p.add_script_tag(content=AXE); await p.wait_for_selector('.hero'); await scan(p,scheme+'｜單人結果',out)
        await p.click('#tgAdj'); await scan(p,scheme+'｜單人調調看',out); await p.click('#tgPrec'); await scan(p,scheme+'｜單人提高準確度',out)
        await p.evaluate("()=>localStorage.clear()"); await p.reload(); await p.add_script_tag(content=AXE)
        await p.click('[data-mode="couple"]'); await scan(p,scheme+'｜夫妻輸入',out)
        async def t(k,v): await p.fill(f'[data-cpk="{k}"]',v)
        await t('you.birth','198503'); await t('you.workStart','25'); await t('you.inc','8')
        await p.click('[data-cptab="p"]'); await t('partner.birth','198807'); await t('partner.workStart','25'); await t('partner.inc','6.5')
        await p.click('[data-cptab="home"]'); await t('asset','300'); await t('spend','7'); await p.click('#cpGo'); await p.wait_for_selector('#cpSlider')
        await scan(p,scheme+'｜夫妻結果',out); await p.click('[data-cpmode="tog"]'); await scan(p,scheme+'｜夫妻一起退',out)
        await p.click('#cpTgAdj'); await scan(p,scheme+'｜夫妻調調看',out); await p.click('#cpTgPrec'); await scan(p,scheme+'｜夫妻提高準確度',out)
        await b.close()
out=[]
asyncio.run(run('light',out)); asyncio.run(run('dark',out))
from collections import Counter
print('對比不足的元素',len(out)); c=Counter((o[4],o[5],o[2],o[3]) for o in out)
for k,v in c.most_common(20): print(v,'次  前景',k[0],'背景',k[1],'對比',k[2],'需要',k[3])
import sys
sys.exit(1 if out else 0)
