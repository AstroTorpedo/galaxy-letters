# GitHub Pages 网页部署

本轮用户已授权将游戏发布至自己的 GitHub，并启用 Pages。桌面包和 itch.io 上传仍暂停。

## 内容与入口

- 首页 `index.html` 自动进入 `explore.html?night=1`，即最新双目标故事。
- `explore.html` 是直接工作台，`legacy.html` 保留早期三案。
- `public/cubes/` 中两套数据均为项目生成的合成观测；不是 M33 实测数据。
- 发布 `dist/` 静态文件，无账号、服务端或运行时 CDN。
- 存档属于当前域名和浏览器；本机与 GitHub Pages 不共享进度。

## 自动部署

仓库 Settings → Pages → Source 使用 **GitHub Actions**。工作流为 [pages.yml](../.github/workflows/pages.yml)：

1. 推送 `main` 或手动触发工作流。
2. Ubuntu / Node 24 执行 `npm ci`、`npm test`、`npm run build`。
3. 构建成功才上传 `dist/` 并部署至 `github-pages` 环境。
4. 纯 Markdown、`docs/`、`artifacts/` 修改不重新部署；如需可手动运行。

Vite 使用相对 base `./`，资源和 cube 请求使用相对 URL，适用于项目站点的 `/<仓库名>/` 子路径。没有依赖服务器重写的历史路由。

## 发布检查

```sh
npm test
npm run build
npm run preview
```

线上需实际检查首页跳转、立绘 / 场景、两个目标、gzip cube 读取、观测生成与孔径 / PV、旧版入口，以及浏览器错误日志。CI 的测试和构建成功不替代浏览器检查。

源码排除 `node_modules/`、`dist/`、`release/`、`.research/`、`data/raw/` 和本地日志；参考游戏研究缓存及未完成的实测下载不上传。不调用桌面打包脚本。

## 依据

2026-10-14 核实：[GitHub 自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Vite 静态部署](https://vite.dev/guide/static-deploy.html)、[Vite relative base](https://vite.dev/guide/build.html#relative-base)。Actions 版本来自官方仓库当日 latest release；项目依赖以锁文件为准。

实际仓库、线上 URL、部署运行结果与自测记录见[最新 handoff](handoffs/README.md)。
