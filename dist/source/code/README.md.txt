# 苔光跃迁 · MOSSLIGHT

规则简单的双关 3D 平台跳跃游戏。竖立的小方块，从白天的温馨森林跃入夜晚的赛博都市。

- [在线游玩](https://mosslight-hop.mnzxnbcv.chatgpt.site/)
- [公开源码与完整下载](https://mosslight-hop.mnzxnbcv.chatgpt.site/source/)
- MIT 许可：允许使用、修改、再发布和商业使用，请保留许可证。原创模型、生成脚本、贴图和合成音频也包含在发布中；第三方说明见 `THIRD_PARTY_NOTICES.txt`。

## 操作

点击“出发”自动进入全屏并锁定鼠标。移动鼠标左右转向、上下看，无需按住鼠标键。

| 操作 | 按键 |
| --- | --- |
| 移动 | WASD / 方向键，方向跟随镜头 |
| 跳跃 | 空格 |
| 缩放 | 滚轮 |
| 暂停并释放鼠标 | Esc |
| 继续并重新锁定鼠标 | 点击“继续冒险” |
| 视角复位 / 辅助转向 | C / Q、E |
| 回到最近存档点 | R |

返回选关会退出全屏。手机使用左侧摇杆、跳跃按钮、空白区域单指环视与双指缩放。
浏览器的全屏和鼠标锁定需要点击触发；如果首次未获得锁定，点击游戏画面即可重试。

## 规则

越过平台，抵达圆形光门。森林有 12 束微光与 3 件珍藏，满分 270 分；都市有 24 束微光与 3 件珍藏，满分 390 分。接触自动拾取，微光 10 分、珍藏 50 分。收集可选；掉落会从存档旗重生，已收集物品与积分保留，重开本关重置。任意关全部收集可解锁永久金色光环。收藏、光环和最快记录保存在当前浏览器。

森林平台比初版加宽 20%、加深 10%，保持温馨入门难度。都市从 15 个平台、97 米路线扩展到 30 个平台、207 米路线，含 5 个安全存档点。

都市包含六种机关：移动平台、塌落平台、定时光栅、旋转光臂、下压闸门、间歇平台。低光臂与光栅可跳过；闸门黄灯预警后下压，升起时通过；间歇平台黄灯提示离开，红色轮廓提示等待恢复。机关状态与碰撞使用同一物理时钟，暂停会一起冻结。背景音乐为原创合成，默认关闭，点击音符打开。

## 本地运行

安装 Node.js 20 或更新版本，解压源码，进入项目目录后运行：

```sh
node server.mjs
```

浏览器打开 `http://127.0.0.1:4186/`。无须安装运行依赖，素材和 Three.js 均随源码提供。游戏离线可运行。ES 模块需要 HTTP 服务，请不要直接双击 HTML。

```sh
npm test
node qa/route.mjs
```

可选浏览器测试需要 `npm install --no-save playwright` 和本机 Microsoft Edge，启动服务器后执行 `node qa/v3-browser.cjs`。镜头测试覆盖真实点击触发的全屏与鼠标锁定、双轴鼠标输入、Esc 暂停、恢复和退出。`node qa/v4-browser.cjs` 使用移动与跳跃按键输入跑完整两关，并检查新增机关和手机布局；`node qa/route.mjs` 检查四种起步时机下的完整都市路线，不传送角色、不关闭机关。

## 文件

| 文件 | 内容 |
| --- | --- |
| `dist/game.js` | Three.js 场景、控制、镜头、界面与合成音频 |
| `dist/physics.js` | 固定步长物理、两关地图、存档、障碍 |
| `dist/orbit.js` | 镜头旋转、俯仰、缩放与视角相对移动 |
| `dist/collection.js` | 收集物布局、计分与收藏等级 |
| `dist/index.html` / `dist/style.css` | 响应式游戏界面 |
| `models/MosslightAssets.blend` | 原始可编辑 Blender 模型 |
| `tools/build_assets.py` | 重建所有 GLB 模型的脚本 |
| `dist/assets/` | 模型和 AI 贴图，提示词见 `ASSETS.txt` |
| `tools/release_source.py` | 生成公开代码浏览页和源码 ZIP |

使用 Blender 运行 `blender --background --python tools/build_assets.py` 可重建模型。
使用 Python 3 运行 `python tools/release_source.py` 可重新生成源码发布包。

Three.js r169：MIT，许可证保留在 `dist/vendor/LICENSE.txt`。全屏与鼠标锁定说明：[MDN Pointer Lock](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)。
