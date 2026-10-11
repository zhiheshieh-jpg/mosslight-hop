"""Build the public source browser and a deterministic, portable source archive."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'source'
VERSION = json.loads((ROOT / 'package.json').read_text('utf-8'))['version']
SITE = 'https://mosslight-hop.mnzxnbcv.chatgpt.site'
ARCHIVE = f'mosslight-source-v{VERSION}.zip'

# An explicit release list keeps deployment metadata and local QA output private.
names = ['README.md', 'README.txt', 'LICENSE', 'THIRD_PARTY_NOTICES.txt',
         'ASSETS.txt', 'package.json', 'server.mjs', '.gitignore',
         'models/MosslightAssets.blend', 'tools/build_assets.py',
         'tools/release_source.py', 'qa/physics.test.mjs',
         'qa/collection-camera.test.mjs', 'qa/route.mjs', 'qa/driver.mjs', 'qa/v3-browser.cjs', 'qa/v4-browser.cjs', 'qa/v5-forest.cjs',
         'qa/pixel-world.test.mjs', 'qa/pixel-driver.mjs', 'qa/pixel-route.mjs',
         'qa/pixel-smoke.cjs', 'qa/pixel-playthrough.cjs', 'qa/characters.test.mjs', 'qa/characters-browser.cjs',
         'qa/sky-world.test.mjs', 'qa/progression.test.mjs', 'qa/sky-driver.mjs', 'qa/sky-route.mjs',
         'qa/sky-browser.cjs', 'qa/sky-browser-playthrough.cjs',
         'qa/palace-world.test.mjs', 'qa/palace-progression.test.mjs', 'qa/palace-driver.mjs', 'qa/palace-route.mjs',
         'qa/palace-browser.cjs', 'qa/palace-browser-playthrough.cjs']
files = {name: ROOT / name for name in names}
for path in sorted((ROOT / 'dist').rglob('*')):
    if path.is_file() and OUT not in path.parents and '.openai' not in path.parts:
        files[path.relative_to(ROOT).as_posix()] = path
for name, path in files.items():
    if not path.is_file():
        raise FileNotFoundError(name)

OUT.mkdir(parents=True, exist_ok=True)
entries = []
readable = ['README.md', 'LICENSE', 'dist/2d/world.js', 'dist/2d/game.js',
            'dist/2d/index.html', 'dist/2d/style.css', 'dist/2d/characters.js', 'dist/2d/sprite-atlas.js', 'dist/2d/assets/PROMPTS.json',
            'dist/2d/sky-level.js', 'dist/2d/progression.js', 'qa/sky-world.test.mjs', 'qa/progression.test.mjs',
            'qa/sky-driver.mjs', 'qa/sky-route.mjs', 'qa/sky-browser.cjs', 'qa/sky-browser-playthrough.cjs',
            'qa/pixel-world.test.mjs', 'qa/pixel-route.mjs', 'qa/pixel-playthrough.cjs',
            'dist/game.js', 'dist/physics.js', 'dist/palace-level.js', 'dist/palace-scene.js', 'dist/progression.js',
            'qa/palace-world.test.mjs', 'qa/palace-progression.test.mjs', 'qa/palace-route.mjs',
            'qa/palace-driver.mjs', 'qa/palace-browser.cjs', 'qa/palace-browser-playthrough.cjs',
            'dist/orbit.js', 'dist/collection.js', 'dist/index.html',
            'dist/style.css', 'tools/build_assets.py', 'server.mjs',
            'qa/physics.test.mjs', 'qa/collection-camera.test.mjs',
            'qa/v3-browser.cjs', 'tools/release_source.py', 'package.json',
            'ASSETS.txt', 'THIRD_PARTY_NOTICES.txt']
generated = {}
for name in readable:
    target = OUT / 'code' / (name + '.txt')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(files[name].read_bytes())
    entries.append({'name': name, 'url': 'code/' + name + '.txt'})
    generated[target.relative_to(ROOT).as_posix()] = target

manifest = {'version': VERSION, 'license': 'MIT', 'archive': ARCHIVE,
            'files': [{'path': name, 'bytes': path.stat().st_size,
                       'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                      for name, path in sorted(files.items())],
            'readable': entries}
(OUT / 'files.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), 'utf-8')

PAGE = r'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#193e32"><title>Mosslight · 开源代码</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f1f0e5;color:#243e35;font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif}a{color:inherit}header{padding:26px 5vw;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d3d9cb}header a{text-decoration:none}b.logo{letter-spacing:.2em;font-size:15px}header span{font-size:12px;opacity:.6}main{max-width:1400px;margin:auto;padding:60px 5vw}.eyebrow{letter-spacing:.2em;font-size:11px;color:#6b816e}h1{font-size:clamp(34px,5vw,60px);font-weight:500;letter-spacing:-.04em;margin:18px 0}p{line-height:1.9;color:#66776b;max-width:740px;font-size:15px}.actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:28px 0 36px}.download{background:#294f3e;color:#fff4d8;border-radius:9px;padding:15px 22px;text-decoration:none;font-size:14px}.actions small{color:#6b816e}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:0 0 42px}.fact{border:1px solid #d3d9cb;border-radius:12px;padding:22px}.fact strong{font-size:22px;font-weight:500}.fact p{font-size:12px;margin:9px 0 0}.section-label{font-size:12px;letter-spacing:.1em;margin-bottom:16px}.browser{display:grid;grid-template-columns:252px minmax(0,1fr);border:1px solid #ced6ca;border-radius:13px;overflow:hidden;background:#fbfaf1}nav{padding:15px;background:#e8ecdf;border-right:1px solid #d3d9cb;max-height:680px;overflow:auto}nav button{display:block;width:100%;text-align:left;background:transparent;color:#596e60;border:0;border-radius:6px;padding:10px 8px;font:12px ui-monospace,Consolas,monospace;word-break:break-all;cursor:pointer}nav button:hover{background:#dfe5d5}nav button.active{background:#294f3e;color:#fff8de}.code-head{height:52px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d3d9cb;padding:0 22px;gap:12px}.code-head span{font:12px ui-monospace,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.code-head a{font-size:12px;white-space:nowrap}pre{margin:0;padding:24px;max-height:628px;overflow:auto;color:#314d40;font:12px/1.8 ui-monospace,Consolas,monospace;tab-size:2}footer{margin-top:30px;font-size:12px;color:#6b816e;line-height:1.9}.run{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:40px}.run code{background:#e2e7d8;padding:10px 14px;border-radius:6px;font-size:13px}.run span{font-size:12px;color:#6b816e}:focus-visible{outline:3px solid #b78d48;outline-offset:2px}@media(max-width:650px){header{padding:20px 6vw}header span{display:none}main{padding:35px 6vw}.facts{grid-template-columns:1fr;gap:10px}.fact{padding:18px}.fact strong{font-size:18px}.browser{grid-template-columns:1fr}nav{display:flex;max-height:none;overflow:auto;padding:10px;border-right:0;border-bottom:1px solid #ced6ca}nav button{flex:0 0 auto;width:auto;white-space:nowrap;padding:12px}pre{padding:16px;max-height:520px}.code-head{padding:0 16px}.actions{gap:12px}.download{width:100%;text-align:center}}
</style></head><body>
<header><a href="../"><b class="logo">MOSSLIGHT</b> <span>苔光跃迁</span></a><a href="../">返回游戏 ↗</a></header>
<main><div class="eyebrow">OPEN SOURCE · VERSION __VERSION__</div><h1>把这片世界，带走。</h1><p>3D 平台跳跃与 2D 像素动作冒险的完整源码。可以阅读、修改，也可以做成自己的新世界。代码、模型、动作图集与生成脚本一并提供；角色来源说明见第三方声明。</p>
<div class="actions"><a class="download" href="__SITE__/source/__ARCHIVE__" download>下载完整源码 ZIP ↓</a><a class="download" href="https://github.com/zhiheshieh-jpg/mosslight-hop" target="_blank" rel="noopener">GitHub 仓库 ↗</a><small>代码 MIT 许可 · 包含可编辑 Blender 模型</small></div>
<div class="facts"><div class="fact"><strong>完整可运行</strong><p>两种版本、长路线、敌人首领、收集物与合成音频</p></div><div class="fact"><strong>素材与源文件</strong><p>.blend 模型、GLB、角色动画图集、背景与提示词</p></div><div class="fact"><strong>MIT</strong><p>代码开放使用；角色与品牌权利见第三方声明</p></div></div>
<div class="section-label">在本机运行</div><div class="run"><code>node server.mjs</code><span>解压后在项目目录运行，打开 http://127.0.0.1:4186/</span></div>
<div class="section-label">浏览源代码 <span id="file-count"></span></div><div class="browser"><nav id="files" aria-label="源码文件"></nav><section><div class="code-head"><span id="filename">README.md</span><a id="raw" href="code/README.md.txt" target="_blank" rel="noopener">原始文本 ↗</a></div><pre id="code" tabindex="0" aria-label="源代码">正在读取源码…</pre></section></div>
<footer>全部运行依赖均随源码提供，游戏无运行时 CDN 依赖。Three.js r169 使用 MIT 许可证，详见源码内 THIRD_PARTY_NOTICES.txt。<br>源码包内含测试与发布脚本；查看完整文件及 SHA-256：<a href="files.json">文件清单</a> · <a href="__SITE__/source/SHA256SUMS.txt">下载校验</a>。</footer></main>
<script>
let selection=0;
fetch('files.json').then(r=>{if(!r.ok)throw Error('manifest');return r.json()}).then(data=>{
 document.querySelector('#file-count').textContent=`· ${data.readable.length} 个文件`;
 const nav=document.querySelector('#files');
 async function show(file,button){const current=++selection;document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});document.querySelector('#filename').textContent=file.name;document.querySelector('#raw').href=file.url;document.querySelector('#code').textContent='正在读取源码…';try{const res=await fetch(file.url);if(!res.ok)throw Error('file');const text=await res.text();if(current===selection){document.querySelector('#code').textContent=text;document.querySelector('#code').scrollTop=0}}catch{if(current===selection)document.querySelector('#code').textContent='读取失败，请点击“原始文本”或下载完整源码包。'}}
 for(const file of data.readable){const b=document.createElement('button');b.textContent=file.name;b.onclick=()=>show(file,b);nav.appendChild(b)}
 nav.firstElementChild.click();
}).catch(()=>{document.querySelector('#code').textContent='文件清单暂时无法读取，请下载完整源码包。'});
</script></body></html>'''
page = PAGE.replace('__VERSION__', VERSION).replace('__SITE__', SITE).replace('__ARCHIVE__', ARCHIVE)
(OUT / 'index.html').write_text(page, 'utf-8')
for name in ['index.html', 'files.json']:
    path = OUT / name
    generated[path.relative_to(ROOT).as_posix()] = path

# Fixed timestamps and permissions make repeated releases byte-for-byte reproducible.
with zipfile.ZipFile(OUT / ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, path in sorted((files | generated).items()):
        info = zipfile.ZipInfo('mosslight/' + name, date_time=(2026, 10, 10, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
digest = hashlib.sha256((OUT / ARCHIVE).read_bytes()).hexdigest()
(OUT / 'SHA256SUMS.txt').write_text(f'{digest}  {ARCHIVE}\n', 'utf-8')
print(json.dumps({'archive': ARCHIVE, 'bytes': (OUT / ARCHIVE).stat().st_size,
                  'sha256': digest, 'files': len(files | generated)}, indent=2))
