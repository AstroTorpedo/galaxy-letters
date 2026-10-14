# Handoff：GitHub 网页发布准备

- 日期：2026-10-14，Asia/Shanghai
- 状态：本地发布准备完成；远程仓库 / Pages 部署待确定账号后执行。
- 对应任务：用户要求发布到自己的 GitHub，并提供 github.io 网页试玩。
- 前一份记录：[双目标试玩交付](2026-10-14-022-campaign-qa.md)

## 目标与完成结果

- 更新授权边界：GitHub 源码和 Pages 网页发布获准，桌面 / ZIP 打包仍暂停。
- 首页自动进入最新双目标故事，旧三案迁至 `legacy.html`，工作台保留旧版对照链接。
- 新增 Actions：Node 24、锁文件安装、26 项测试、Vite 构建、仅成功才部署 `dist/`；纯文档 / 截图提交不触发。
- 补充部署说明、数据 / 插画来源与第三方运行时许可。
- 读取官方 GitHub Pages / Vite 文档，并通过官方仓库 API 核实所用 Actions 版本。

## 文件变更

- [pages.yml](../../.github/workflows/pages.yml)、[DEPLOYMENT.md](../DEPLOYMENT.md)、[CREDITS.md](../../CREDITS.md)、[第三方许可](../../public/third-party-notices.txt)。
- [首页](../../index.html)、[旧版](../../legacy.html)、explore.html、vite.config.ts、src/explorer.ts。
- AGENTS、README、制作计划、package 描述与 handoff 索引。

## 验证

- `npm test`：26 / 26 通过；`npm run build` 成功，原 Phaser chunk 大小提示仍在。
- 本地 4176 生产首页实际跳转 `explore.html?night=1`；保留既有 QA 进度，两个目标 / 图片 / 数据加载正常，旧版对照实际进入 legacy.html 并正常显示 v0.1 封面，错误与警告日志为空。发布准备截图见[本地预览](../../artifacts/qa-pages/01-local-entry.jpg)。
- Markdown 本地链接检查通过（本记录新增后再次复查）；发布候选文件约 55.7 MB，最大单文件约 6.62 MB。
- 候选文件敏感令牌模式检查无命中；`.research/`、`data/raw/`、依赖、构建与 release 目录均由 ignore 排除。
- Git：main，无提交 / 远程；尚未上传。终端登录 JASxiaoxie；连接器另有 AstroTorpedo，已询问目标账号，不能擅自把不同身份等同。

## 决策与遗留项

- 用户已确认：执行 GitHub 发布并尝试 Pages，桌面打包保持暂停。
- 可逆默认：仓库拟命名 `galaxy-letters`，使用独立项目 Pages，不覆盖已有个人主页；公开仓库便于网页试玩。
- 待输入：两个可用 GitHub 身份中的发布归属。确定后创建仓库、推送、启用 Pages 并实际验证线上。
- 科学模型 / 教学阈值的专业审核仍未完成；公开状态不能等同于科学审核完成。

## 恢复

`npm test`、`npm run build`；工作流 `.github/workflows/pages.yml`。不运行 `package:web` / `package:desktop`。用户本地进度不重置。
