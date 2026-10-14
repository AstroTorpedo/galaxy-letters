# 自模拟 HI cube

日期：2026-10-14。当前优先级：按用户最新反馈，先完成可控模拟 cube 和自由探索工具；M33 所在服务器硬盘已掉线，等恢复后再接入或用于校准，不阻塞当前开发。

## 已生成文件

| 数据 | FITS | 无噪声模型 |
| --- | --- | --- |
| 旋转盘 | [cube.fits](../public/cubes/sim-disk/cube.fits) | [noiseless-model.fits](../public/cubes/sim-disk/noiseless-model.fits) |
| 翘曲、气体尾与独立云团 | [cube.fits](../public/cubes/sim-disturbed/cube.fits) | [noiseless-model.fits](../public/cubes/sim-disturbed/noiseless-model.fits) |

每套为 101×128×128 的 PPV cube；浏览器数据与 FITS 采用同一 voxel 值，浏览器仅重排速度升序并翻转显示 Y 轴到北朝上。

无噪声模型也提供 `noiseless.f32.gz`，与无噪声 FITS 逐体素一致，供观测夜施加主波束、积分时间噪声、频段和 RFI。观测后得到独立批次，下载使用该批次数组；来源参数与限制见[观测夜设计](OBSERVING_NIGHT_DESIGN.md)。

## 模型定义

- 物理网格：128×128，4 arcsec/pixel；示例距离 8 Mpc。此设置不宣称是 M33 的拟合或准确复现。
- 圆环：90 个径向环，每环 512 个方位采样，前向投影到天空网格。
- 旋转曲线：v(r)=145[1−exp(−r/1.1 kpc)] km/s。
- 内盘倾角 56°。方位角参数从画面水平轴定义，不能直接当作天文学 PA。
- 扰动模型外盘逐渐增加 11° 倾角和 24° 节线转角；空间投影和视向速度共同改变。
- 表面密度为带中央孔洞、外缘渐截和螺旋调制的指数分布；每环质量按天空像素面积分配，避免额外重复施加投影因子。
- 局部线型 Gaussian，速度弥散 9 km/s；采用光学薄 HI 的柱密度—亮温积分关系，再按波束换算 Jy/beam。
- 波束为空间 Gaussian FWHM=16 arcsec；谱通道间隔 5 km/s，谱响应 Gaussian σ=0.5 channel。
- 相关噪声 RMS 约 0.11 mJy/beam，保留正负值；噪声在空间和谱轴上均相关。
- 弱尾与独立云团为可控的现象学成分，用于探索任务，不是从潮汐作用动力学演化出来的结果。
- 第三轴为视向速度，不是第三个空间坐标或实际演化时间。

全部视图从这份 cube 得出：通道图、带掩膜的 moment 0 / 1、任意孔径均值谱、PV 切片。光学图是与模型共用投影几何的合成星光示意，明确标注为模拟。

## 已验证

`python3 scripts/check-cubes.py` 已通过：

- FITS 与传输二进制逐体素相等。
- FITS WCS 谱轴与元数据速度数组一致，BUNIT 与波束值正确。
- 无噪声模型非负，观测 cube 含负噪声，噪声 RMS 符合设定。
- 邻近空间像素噪声相关系数约 0.917，邻近谱通道约 0.26。
- 对称旋转盘的全局无噪声谱中心接近系统速度 0。
- 文件载荷哈希与元数据一致。

TypeScript 的任意孔径、moment 积分与 PV / NaN 处理也有自动化测试；不把这些检查当作专业科学审核。

## 复现

```sh
python3 scripts/prepare-cubes.py
python3 scripts/check-cubes.py
npm test
```

现有 Python 已包含 NumPy、Astropy、Pillow；没有安装 SciPy。原始 THINGS 下载在用户提出 M33 后停止，部分文件保留于忽略目录，未当成已完成的数据源。

HI 科学图和图鉴缩略图使用用户选定的标准 inferno。256 色 LUT 从本机 Matplotlib 3.9.4 导出至 `src/inferno.json`，浏览器与离线预览共享同一张表；运行和数据再生无需依赖 Matplotlib。色标显示量与单位，速度场仍保留负 / 正速度端点。

## M33 接入方向

拿到文件路径后先检查 BUNIT、CTYPE / CUNIT、速度参考系、RESTFRQ、波束、空间尺度与有效覆盖。随后可：

1. 保留真实 M33 为观测样例，比较真实噪声、结构和局部谱形。
2. 让模拟网格和仪器设置匹配 M33 的像素、波束与通道分辨率。
3. 以 M33 的几何与旋转曲线作为模型起点，再有控制地增加翘曲、尾或异常速度成分。

未拿到或审核真实数据之前，不能把当前模型标成 M33 或宣称已拟合 M33。
