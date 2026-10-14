# Handoff：inferno 配色与试玩交付

- 日期：2026-10-14，Asia/Shanghai
- 状态：配色、最终验证与文档完成。
- 对应任务：用户要求从限额暂停处继续，并明确喜欢 inferno。
- 前一份记录：[自由探索台](2026-10-14-011-free-cube-explorer.md)

## 本步骤目标与范围

将用户的配色偏好落实到新探索版所有 HI 科学图，验证后准备本地试玩。

## 已完成

- 将 HI 积分、通道、速度场、PV 与图鉴数据缩略图统一为标准 inferno。
- 浏览器与离线预览共享 256 色 LUT；数值色标使用同一张表，保留单位和正 / 负速度端点。
- 更新协作规范、制作计划、模型说明与 README，记录 M33 硬盘掉线、inferno 偏好、新入口与不打包要求。
- 数据生成默认仅模拟；可选真实下载改为显式 `--with-reference`，保留旧 `--synthetic-only` 参数兼容。
- 完成新版浏览器自测和截图；所有测试数据仅位于 QA 端口。

## 文件变更

- [inferno.json](../../src/inferno.json)：从本机 Matplotlib 3.9.4 导出的标准 RGB 表，无新增运行时依赖。
- [explorer.ts](../../src/explorer.ts)、[explorer.css](../../src/explorer.css)：科学图、PV、色标。
- [prepare-cubes.py](../../scripts/prepare-cubes.py)、`public/cubes/*/moment0-preview.png`：数据再生与缩略图。
- [AGENTS.md](../../AGENTS.md)、[README.md](../../README.md)、[制作计划](../PROJECT_PLAN.md)、[模型说明](../SIMULATED_CUBES.md)、[新版 QA](../EXPLORER_QA.md)、[交接索引](README.md)。

## 验证

- `python3 scripts/prepare-cubes.py`：只生成两个模拟对象。
- `python3 scripts/check-cubes.py`：两套通过，FITS 与传输数据一致。
- `npm test`：11 项通过；`npm run build`：通过。
- 实际浏览器确认 inferno、单位色标、PV 旋转、扫描 / 暂停、弱信号记录、阈值 / 频段 / 拉伸、缩放不改谱、鼠标拖动、资料书 / 图鉴、刷新持久保存、跨对象回访与声化按钮；最终错误日志为空。
- 截图与全部验收细节见 [EXPLORER_QA.md](../EXPLORER_QA.md)。
- 本地 Markdown 链接检查无失效链接；4175 新入口与数据 HTTP 200。用户试玩标签已打开并保留，手记为空，未注入 QA 记录。
- Git：main，未提交，无远程。未打包、未上传、未公开发布。

## 决策与假设

- 用户已确认：inferno；继续开发；先试玩和修改。
- 当前默认：保留暖色 B 场景和合成光学星光示意；inferno 用于新版 HI 数据。
- 待确认建议：试玩后决定优先扩充的调查内容与叙事。

## 遗留项与风险

- 当前仍是探索原型，不把数据工具齐全等同于完整游戏内容已完成。
- M33 所在硬盘恢复前，无需反复询问路径；当前模拟不冒称 M33。
- 旧手记缩略图保留保存时的配色，新记录使用 inferno。旧版三案也保留原貌便于对照。
- 专业科学审核、外部教学评价、手机及多浏览器兼容性待进行。

## 下一步

用户试玩新版，重点反馈图像 / 噪声真实性、选区 / PV 操作与探索动力。随后据反馈迭代；真实 M33 后续恢复再接入。用户明确恢复前不打包、不上传。

## 恢复工作所需信息

- 试玩：`http://127.0.0.1:4175/explore.html`；旧版：`http://127.0.0.1:4175/`。
- 检查和复现命令见 [README](../../README.md)。
- 没有新增 npm / Python 项目依赖；研究缓存和部分真实下载在忽略目录中，不能当作已接入数据。
