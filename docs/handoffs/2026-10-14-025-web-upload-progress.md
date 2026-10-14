# Handoff：网页上传与 Pages 配置进展

- 日期：2026-10-14，Asia/Shanghai
- 状态：部分完成，源码分卷上传待补正，尚未上线。
- 目标：完全通过 GitHub 网页发布，保持目录、模拟数据与源码可复现。
- 前一份：[创建仓库](2026-10-14-024-github-repository.md)

## 已完成

- README 已通过网页提交，初始提交 `0bb2e6ad9ea6adee5f81a7fea5c620038b36e54e`。
- Pages 发布源已在网页切换为 GitHub Actions，HTTPS 默认开启。
- [工作流](../../.github/workflows/pages.yml) 已通过网页编辑器提交，提交 `f537590433a7f992c82e09278d4d67ba46db3386`。
- 工作流含一次性分卷合并 / SHA256 校验 / 还原 / 提交完整源码，然后重新检出 main、测试、构建和部署；未来没有分卷时跳过导入步骤。
- 原始完整源档案（排除 .github，单独上传工作流）在 `.research/github-publish/`，约 43.73 MB、154 文件。SHA256 为 `c175ad6f6b17c13043b0b20597d71054cce284262cde98a83e03e4afc8158904`。

## 发现与验证

- GitHub 连接器 AstroTorpedo 可以读取新仓库，但 create_blob 返回 403 Resource not accessible by integration。未扩大连接器权限，后续继续网页操作。
- 网页文件上传最大 25 MiB / 文件，一次 100 文件；为保留目录采用分卷，由仓库 Actions 自行还原。没有执行桌面或 HTML5 ZIP 分发脚本。
- 两份原分卷在上传界面列出，点击提交后未及时核对远程树就离开页面；后续 API 发现它们没有进入提交。上传列表不能作为提交成功的证据。
- 首次 Actions [38572042342](https://github.com/AstroTorpedo/galaxy-letters/actions/runs/38572042342) 因缺少源码 / 锁文件失败，导入步骤因无分卷而跳过，没有部署。
- 已改为三个较小分卷：20 MiB、20 MiB、剩余约 1.78 MB；重传后必须确认远程树与提交，再检查流水线。
- 工作流 YAML / 作业依赖本地检查通过；网页非空行内容与本地一致，API 读回工作流也一致。

## 文件与 Git 状态

- 本地工作流新增一次性导入 job；临时档案全部在已忽略的 `.research/`。
- 本地仍是无提交的 main，与远程历史尚未连接；源码还原后可只读 fetch 并对齐索引，保留用户本地文件。
- 不使用 GitHub Desktop，不通过终端另一账号执行远程写操作。

## 下一步

1. 在网页上传三个分卷，提交后核对远程实际文件 / 提交。
2. 由 Actions 校验完整性、还原源码并推回当前项目 main；确认源码路径与本地一致。
3. 观察测试 / 构建 / 部署结果，实际检查 Pages 新版首页、角色、两目标与 gzip cube；失败时据日志修正。
4. 补齐发布成功 handoff、入口与截图，更新 README / 部署说明。专业审核与外部试玩仍待进行。
