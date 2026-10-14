# Handoff：多目标、任务与可恢复重置基础

- 日期：2026-10-14，Asia/Shanghai
- 状态：逻辑基础完成，UI 接入继续进行。
- 对应任务：两个实际样本可观测、明确目标、存档 / 重置与教程进度。
- 前一份记录：[林岚资产](2026-10-14-019-linlan-character.md)

## 已完成与文件变更

- [targets.ts](../../src/targets.ts)：GX-03「归航」和 GX-07「回波」对应不同 sourceId。
- [campaign.ts](../../src/campaign.ts)：各目标由观测质量、实际视图和保存的测量判定任务；跨批次 / 夜晚累计，按实际进度给出下一步。
- [campaign-state.ts](../../src/campaign-state.ts)：新版本状态、旧 Exposure 默认回波、旧模型坐标保留、教程 / 对话 / 任务状态。
- [progress-store.ts](../../src/progress-store.ts)：只操作已知存档键，先快照再清空，恢复采用交换快照，备份失败不清空。
- [dialogue.ts](../../src/dialogue.ts)：交班往事、目标、方法问答、阶段回应与最终报告的对话内容。
- [observing.ts](../../src/observing.ts)、[cube.ts](../../src/cube.ts)、[check-night-fits.py](../../scripts/check-night-fits.py)：明确目标与源一致，标题 / FITS 来源跟随实际模型。
- 新增 campaign / reset 测试，并扩充目标来源检查。

## 验证

- 基础任务、旧状态迁移、重置 / 恢复与备份失败等自动检查通过；已有科学模型和显示测试保持通过。
- 生产构建通过。此阶段 UI 尚未接完，浏览器双目标、对话和重置验收未完成。
- 未重置用户数据。Git main，未提交，无远程，无新增依赖。

## 决策与下一步

新状态键使用 v2，从 v1 迁移但保留旧值；明确重置才清理已知本版键，旧三案存档不动。继续将角色、对话 / 教程、任务卡和 reset 确认 / 恢复接进界面；独立 4176 进行完整验收，不打包上传。
