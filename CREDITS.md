# 数据与素材说明

- 游戏与角色：本项目原创科教试玩。GX-03「归航」、GX-07「回波」、林岚及阵列均为虚构。
- 数据：两套 PPV cube 由 `scripts/prepare-cubes.py` 参数化生成。合成观测的方程、单位、仪器简化和限制见 [SIMULATED_CUBES.md](docs/SIMULATED_CUBES.md)。光学图也是合成星光示意，没有使用用户的 M33 实测数据。
- 插画：概念图与林岚立绘由内置 imagegen 根据本项目提示词生成；提示词见 `docs/art/`。没有使用 Star Beat 的图片、音乐、代码或数据文件。
- 参考设计：[Star Beat](https://bruja-aprendiza.itch.io/star-beat) 提供了将天文学内容转化为互动游戏的参考；本项目未与其作者或鲁汶大学建立合作。
- Inferno：Nathaniel J. Smith、Stefan van der Walt 设计；本项目的 256 色表从 Matplotlib 3.9.4 导出。原始色表为 CC0，见[作者仓库说明](https://github.com/BIDS/colormap/blob/master/colormaps.py)。
- 旧版三案使用 Phaser 3.90.0（MIT），其依赖 EventEmitter3（MIT）。完整运行时许可随网页发布在 [third-party-notices.txt](public/third-party-notices.txt)。其他开发工具许可见相应 npm 软件包。

本轮未为项目自有代码或素材指定开源许可证；第三方许可仅适用于对应组件。
