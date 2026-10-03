#!/usr/bin/env python3
"""產生 PDF 用的楷書子集字型。
用法：python3 scripts/build-font.py
來源：fonts/source/ 裡的字型檔（優先用全字庫正楷體 TW-Kai*.ttf；沒有就用文鼎 PL 中楷 ukai.ttc 的台灣字形）
輸出：fonts/kai-subset.ttf、fonts/kai-chars.txt（子集涵蓋的字，PDF 產生器用來判斷罕見字）
收錄：Big5 第一級常用字 5,401 字（涵蓋教育部常用字 4,808 字）＋ src/ 與 data/ 裡出現的所有字＋ ASCII 與常用標點
"""
import glob, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont, TTCollection
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir = os.path.join(ROOT, 'fonts', 'source')
twkai = sorted(glob.glob(os.path.join(src_dir, 'TW-Kai*.ttf')))
if twkai:
    path, idx, name = twkai[0], None, '全字庫正楷體（國家發展委員會，政府資料開放授權條款）'
else:
    path, idx, name = os.path.join(src_dir, 'ukai.ttc'), 2, '文鼎 PL 中楷（Arphic Public License）'
chars = set()
for hi in range(0xA4, 0xC7):                       # Big5 第一級常用字：A440–C67E
    for lo in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
        if (hi, lo) > (0xC6, 0x7E): break
        try: chars.add(bytes([hi, lo]).decode('big5'))
        except UnicodeDecodeError: pass
for c in range(0x20, 0x7F): chars.add(chr(c))
chars.update('，。、；：？！「」『』（）《》〈〉…—–－‧・·＋＝％／～＄＃＆＊□○●◎△▲▽▼◆◇■★☆→←↑↓↗↘✓✕　’‘“”〔〕【】｜＿￥€')
for pat in ['src/*.html', 'src/*.js', 'data/*.json', 'data/*.csv']:
    for f in glob.glob(os.path.join(ROOT, pat)):
        chars.update(ch for ch in open(f, encoding='utf-8').read() if ord(ch) >= 0x20)
font = TTCollection(path).fonts[idx] if idx is not None else TTFont(path)
cmap = font.getBestCmap()
have = sorted(c for c in chars if ord(c) in cmap)
missing = sorted(c for c in chars if ord(c) not in cmap and ord(c) > 0x7f and not c.isspace())
tmp = os.path.join(ROOT, 'fonts', '_full.ttf'); font.save(tmp)
opts = subset.Options(); opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True; opts.glyph_names = False
f2 = subset.load_font(tmp, opts); ss = subset.Subsetter(opts); ss.populate(text=''.join(have)); ss.subset(f2)
out = os.path.join(ROOT, 'fonts', 'kai-subset.ttf'); subset.save_font(f2, out, opts); os.remove(tmp)
open(os.path.join(ROOT, 'fonts', 'kai-chars.txt'), 'w', encoding='utf-8').write(''.join(have))
open(os.path.join(ROOT, 'fonts', 'FONT-NAME.txt'), 'w', encoding='utf-8').write(name)
print('來源：%s\n收錄 %d 字（字型裡沒有的 %d 字）：%s\n輸出：%s（%.2f MB）' % (name, len(have), len(missing), ''.join(missing[:40]), out, os.path.getsize(out) / 1e6))
