# Handoff：GitHub Pages 网页试玩上线

- 日期：2026-10-14，Asia/Shanghai
- 状态：源码与 GitHub Pages 网页已发布，线上基本功能检查通过。
- 目标：按用户指定发布到 AstroTorpedo，通过 GitHub 网页操作，不使用 GitHub Desktop 发布。
- 前一份：[网页上传进展与失败记录](2026-10-14-025-web-upload-progress.md)

## 完成结果

- 源码仓库：[AstroTorpedo/galaxy-letters](https://github.com/AstroTorpedo/galaxy-letters)。
- 在线试玩：[21厘米：星系来信](https://astrotorpedo.github.io/galaxy-letters/)。首页进入 `explore.html?night=1`，直接工作台为 `explore.html`，旧版为 `legacy.html`。
- 完整源码、两套模拟 cube、FITS、角色 / 场景、既有设计与协作文档已还原为正常目录。研究缓存、真实数据未完成下载和桌面分发产物排除。
- Pages = GitHub Actions，HTTPS 开启；首次成功流程完成目录还原 → 安装锁定依赖 → 26 项测试 → 构建 → 部署。
- 桌面打包与其他平台分发仍暂停。当前数据仍是参数化合成观测，不是 M33 实测或完整流体模拟。

## 上传与版本证据

- 较大的网页提交被网站拒绝为 file too large；最终采用 9 份不超过 5 MiB 的分卷，三批网页提交成功。较大提交失败的具体阈值原因未确定，不把官方单文件限额直接当作本次错误的唯一解释。
- 三批提交为 `1aafc0621aaddecd1f11460ef2a0b69b30f9efe7`、`9f1d245be1c19216b3e817df2b2a56e53a03f345`、`b065a5283afa6c7929bfe2a614c5bda0e82b05cc`。
- 九份远程 blob 的大小 / Git SHA1 均与本地逐一相同；合并档案 SHA256 校验通过。
- Actions 自动还原并提交完整源码：[d50c288](https://github.com/AstroTorpedo/galaxy-letters/commit/d50c288a070c2493efe801b1eabc260db62d2970)。临时分卷已从最新 main 删除，历史提交仍可追溯。
- 成功部署：[Actions 38575399739](https://github.com/AstroTorpedo/galaxy-letters/actions/runs/38575399739)，全部三个 job 成功，环境 URL 与试玩入口一致。
- 先前缺源码 / 部分分卷触发的失败流程保留为历史；完整校验成功后才部署。

## 实际验证

- 云端日志：`game-source.tar.gz: OK`；`tests 26`、`pass 26`、`fail 0`；Vite 生产构建成功；Pages 部署成功；首页 HTTP 200。
- 线上浏览器：新版故事开场、林岚立绘与交接对话正常；两套 gzip cube 均成功解码并绘制图 / 孔径谱 / PV。
- 两样本均为 128 × 128 × 101；中心谱峰分别约 2.12 / 2.05 mJy/beam，第二样本中心速度约 −3.6 km/s，实际数据与路径已切换。
- 在线孔径由 2 像素 / 8″ 调至 3 像素 / 12″ 后谱更新，第二样本峰约 2.08 mJy/beam，自动纵轴约 −0.47…2.27 mJy/beam。
- 通道图仍默认逐通道 signed min–max 线性，当前通道色标上端约 4.96 mJy/beam；FITS 相对路径指向对应样本。
- 浏览器 error / warn 日志为空。线上没有保存 QA 观测或手记；页面留在故事开场供用户试玩。
- 完整通关、重置 / 恢复与双源 FITS 的先前本地验收见 [CAMPAIGN_QA.md](../CAMPAIGN_QA.md)；本轮补查实际托管环境，不重复宣称进行了完整线上通关或专业科学审核。
- 本轮线上截图保存在本机 `artifacts/qa-pages/02-online-cube.jpg` 与 `03-online-story.jpg`，最终回复展示。截图尚未同步远程，不把它们列为仓库已有资产。

## 文件与协作状态

- [README](../../README.md) 增加直接试玩链接与上线结果；更新 handoff 索引，并保留 025 的真实失败记录。
- [pages.yml](../../.github/workflows/pages.yml) 含一次性网页分卷导入步骤；没有分卷时自动跳过。普通源码 push main 继续测试 / 部署，纯 Markdown / docs / artifacts 提交跳过部署。
- `origin` 指向该仓库。本机普通 Git fetch 遇到 HTTP/2 / 连接错误，因此通过只读 GitHub API 核实 commit、tree 与 155 个 blob，再用本地 Git 对象接入远程源版本；树 / 提交 SHA 完全相同，用户工作文件保留。没有使用终端另一身份执行远程写操作。
- 发布后的纯文档更新在网页提交；本地工作区已接入上述源版本；后续纯文档网页提交在收尾时再次核实，线上 QA 截图作为本机产物保留。

## 决策与下一步

- 用户已确认：AstroTorpedo、网页发布；没有恢复桌面打包。
- 可逆默认：独立公开项目仓库与项目 Pages，既有个人主页仓库保持原样。
- 下一步由用户在线试玩并反馈，继续改进剧情、目标、教程和观测体验。科学模型 / 阈值仍需专业审核；M33 硬盘恢复后再接入。
- 本机与 GitHub Pages 的存档属于不同域名，不会自动同步；玩家进度保存在自己的浏览器中。
