# ✨ Avatar FX Studio

动态头像粒子特效生成器 — 上传图片或 GIF，选择特效，导出带动画的头像。

在线体验：https://ddddx.github.io/avatar/

## 功能

- 🎨 **37 种动态特效**：闪电、火焰、炫光、环形粒子、能量护盾、冰霜、水波纹、花瓣雨、星尘、棱镜光、旋风、烟花、金粉、旋转、加载中、等待圈、矩阵雨、气泡、极光、萤火虫、雨、实心环、光盘、Google One 环、双色环、闪烁环、灵犀 Do、弹跳头像、收缩四色环、双轴圆环、霓虹彗星环、频谱环、魔法阵、赛博 HUD、CRT 故障、传送门、万花筒
- 📷 **支持静态图片和 GIF 动图**导入
- 🔄 **无图模式**：不传图片也能玩特效
- 📐 **圆形 / 圆角矩形裁切**，实时预览
- 🪞 **支持左右镜像、上下镜像**
- 🔁 **环类特效支持正转 / 反转**：实心环、光盘、Google One 环、双色环
- 🎛️ **双色环支持密度调分段间距**：从两半对切到高密度细分交替
- ✨ **闪烁环支持整圈主副色交替闪烁**：强度控制环粗细，速度控制切换节奏
- 🧪 **预览与导出统一环渲染逻辑**：减少环类特效的拼缝、脏点和首尾不一致问题

## 导出格式

| 格式 | 动画 | 半透明 | 说明 |
|------|------|--------|------|
| WebM | ✅ | ✅ | 视频格式，支持完整半透明 |
| GIF  | ✅ | ❌ | 动图，1-bit 透明，不支持半透明边缘 |
| APNG | ✅ | ✅ | 动画 PNG，原生 alpha 通道 |
| WebP | ✅ | ✅ | 动画 WebP，Chrome/Edge 支持 |

## 技术栈

- React + TypeScript + Vite
- [PIXI.js](https://pixijs.com/) — 大部分粒子特效的实时渲染
- Canvas 2D — 环类特效的统一预览与导出渲染
- [omggif](https://github.com/deanm/omggif) — GIF 解码
- [gif.js](https://github.com/jnordberg/gif.js) — GIF 编码
- [upng-js](https://github.com/nicgirault/upng-js) — APNG 编码
- [wasm-webp](https://github.com/nicgirault/wasm-webp) — 动画 WebP 编码

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 部署

项目通过 GitHub Actions 自动部署到 GitHub Pages。

## 友情链接

- [Linux.do](https://linux.do/) — 一个关于 Linux 和开源的技术社区
