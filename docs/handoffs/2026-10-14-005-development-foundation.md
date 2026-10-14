# Handoff：开发基础与教学模型

- 日期：2026-10-14，Asia/Shanghai
- 状态：本步骤完成；界面实现正在继续。
- 对应任务：用户授权按计划连续实施，并再次要求每一步保留 handoff。
- 前一份记录：[第一案设计](2026-10-14-004-case01-design.md)

## 本步骤目标与范围

检查环境、初始化网页项目、实现三个案件可共用的教学模型与进度判定，建立可复现依赖。

## 已完成

- 确认当前为 macOS ARM64，Node.js 24.14.1、npm、Python 与 Git 可用。
- 采用 Phaser 3.90.0 + TypeScript 7.0.2 + Vite 8.3.4，记录 package-lock.json。
- 安装桌面打包工具 @electron/packager 20.3.0；Electron 运行时在打包阶段按固定版本准备。
- 实现薄圆盘投影谱线、半高宽、教学 HI / 速度场、区域坐标和三个案件的证据判定。
- 实现版本化存档解析、非法值处理和连续关卡导航约束。
- 初始化本地 Git main 分支，无提交、无远程仓库。

## 文件变更

- 项目配置：package.json、package-lock.json、tsconfig.json、vite.config.ts、index.html、.gitignore。
- 科学与状态：[science.ts](../../src/science.ts)、[state.ts](../../src/state.ts)。
- 验证：[science.test.ts](../../tests/science.test.ts)。
- 程序绘制的图标：[icon.svg](../../public/icon.svg)。

## 验证

- `npm install --no-fund`：成功，安装时审计 0 项已知漏洞。
- `npm test`：7 项通过，覆盖正面投影、速度投影歧义、谱线对称、非法参数、区域、证据缺失和损坏存档。
- 尚未验证：界面、完整浏览器流程、构建和桌面包，下一步继续。
- Git 状态：main，尚无提交；所有项目文件为本地未提交内容。

## 决策与假设

- 用户已确认：按计划自主逐步执行，完成后提供审阅；每阶段即时记录交接。
- 可逆实现选择：固定 Phaser 3 稳定 API；桌面打包采用官方 @electron/packager，便于复用网页产物。
- 科学模型均为教学模拟；尚无真实观测数据或专业科学审核。

## 遗留项与风险

- 无阻碍。当前只完成基础，尚无可玩界面。
- 外部试玩与用户专业审核无法由代码测试代替，最终交付时明确区分。

## 下一步

实现画风 B 的观测台、三个案件、手册、提示、证据夹、存档与结案，再运行浏览器验证。

## 恢复工作所需信息

- `npm test` 验证模型；UI 完成后使用 `npm run dev` 和 `npm run build`。
- 环境变化：项目 npm 依赖、本地 Git 初始化；无全局安装、无外部发布。
