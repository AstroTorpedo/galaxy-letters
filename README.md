# 21厘米：星系来信

温暖的射电观测室：选择两个模拟星系，与林岚交接、学习观测，为运动对照和盘外弱线留下可复查证据。

当前为双目标故事试玩版。网站首页直接进入观测室；也可访问 `explore.html` 自由探索，或 `legacy.html` 查看旧版三案。GitHub 与 GitHub Pages 网页发布已获用户授权，桌面打包暂缓。

最新版支持 GX-03「归航」与 GX-07「回波」分别实际观测，林岚有立绘、往事 / 方法 / 下一步对话与阶段回应。任务卡根据观测和保存的测量推进，最终提交双目标报告。引导可关闭 / 重看，孔径和 PV 旁可直接向她提问。

想从头体验可点击“重新开始”并确认；系统先保留本地快照，可用“恢复备份”找回。升级会迁移旧进度，不自动清空。完整验收与限制见[双目标 QA](docs/CAMPAIGN_QA.md)。

## 运行

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:4173/ 开始故事，或 http://127.0.0.1:4173/explore.html 直接探索。两套模拟 cube 支持任意孔径谱、速度扫描、moment 图、可旋转 PV 切线与发现手记。HI 科学图统一使用用户选定的 inferno；光学图为合成星光示意，背景沿用已选画风 B。旧版入口为 `/legacy.html`。

```sh
npm test
npm run build
npm run preview
```

生产预览地址为 http://127.0.0.1:4174/ 。项目使用锁定的 Phaser / TypeScript / Vite，无运行时 CDN、账号或后端。

## 模拟数据

新增观测夜《黎明前的回波》：在虚构阵列接班，调整指向和频段，完成简化校准 / 干扰诊断，分配观测时间，得到由这些选择改变的 cube，再到工作台调查并交班。允许“证据不足”，历史交班与观测批次可回访。细节见[观测夜设计](docs/OBSERVING_NIGHT_DESIGN.md)和[实际验收](docs/OBSERVING_NIGHT_QA.md)。

已生成两个 101×128×128 PPV cube；FITS、无噪声模型和元数据位于 `public/cubes/`。M33 所在服务器硬盘目前掉线，后续恢复再接入；当前模型不宣称是 M33。

```sh
python3 scripts/prepare-cubes.py
python3 scripts/check-cubes.py
```

默认只生成模拟，使用已有 NumPy / Astropy / Pillow。可选真实数据下载需显式指定 `--with-reference`，当前未执行。模型参数、单位和处理约定见[模拟说明](docs/SIMULATED_CUBES.md)，实际验收见[新版 QA](docs/EXPLORER_QA.md)。

观测批次的下载 FITS 与界面使用同一数组，保留缺测、指向 / 频段 / 时间 / 干扰参数与 WCS。可检查浏览器下载文件：`python3 scripts/check-night-fits.py /path/to/download.fits`。

最新修正：新观测画幅随指向移动，旧批次保留原坐标；更改指向后需重新观测一批。通道图使用逐通道线性 min–max 和动态色标，保留负噪声；纯噪声也可很亮，缺测单独灰色显示。可切换固定线性比较。模型和实际验收见[指向 / 通道 QA](docs/POINTING_AND_CHANNEL_QA.md)。

孔径谱默认自动贴合当前数据，可用“＋ / −”调整纵轴，或“适配当前谱”一键复原；同源共用纵轴作为独立比较模式保留。坐标显示实际单位，不改变测量。见[谱显示 QA](docs/SPECTRUM_DISPLAY_QA.md)。

## 网页发布

源码仓库：[AstroTorpedo/galaxy-letters](https://github.com/AstroTorpedo/galaxy-letters)。当前正在首次部署，实际上线结果以 handoff 为准。

推送到 `main` 后，GitHub Actions 安装锁定依赖、运行测试、构建并部署 `dist/` 到 GitHub Pages。纯文档 / QA 截图改动不触发部署，也可从 Actions 手动运行。配置和复现方法见[部署说明](docs/DEPLOYMENT.md)。

进度保存在各浏览器当前网站的本地存储中；本机试玩进度不会自动转移到线上，换浏览器或清理网站数据后也不会同步。

## 后续桌面分发

以下 ZIP / 桌面脚本保留，当前暂停执行：

```sh
npm run package:web
npm run package:desktop
```

桌面打包脚本下载固定 Electron 44.7.2，默认生成 macOS ARM64 与 Windows x64 的 ZIP；也可传入 `-- --mac` 或 `-- --win`。macOS 打包需要在 macOS 上运行。成品位于 `release/`，平台实测结果另见交接记录，不把生成包等同于实机验证。

HTML5 ZIP 用于 itch.io 等托管，不能当作可直接双击的桌面包。桌面版包含运行时，玩家无需安装开发环境。

## 协作入口

- [AGENTS.md](AGENTS.md)
- [最新 handoff](docs/handoffs/README.md)
- [产品说明](docs/PRODUCT_BRIEF.md)
- [制作计划](docs/PROJECT_PLAN.md)
- [第一案](docs/CASE01_DESIGN.md)、[第二 / 三案](docs/CASE02_03_DESIGN.md)

科学数据为参数化合成观测，当前版本供试玩与科学审核。素材与第三方说明见[CREDITS.md](CREDITS.md)，最新发布结果见[handoff](docs/handoffs/README.md)。
