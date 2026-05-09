# ✨ Avatar FX Studio

动态头像粒子特效生成器 — 上传图片或 GIF，选择特效，导出带动画的头像。

## 功能

- 🎨 **多种粒子特效**：闪电、火焰、光晕、轨道、护盾、冰霜、涟漪、花瓣、矩阵、泡泡、极光、萤火虫、雨滴、光环、实心环等
- 📷 **支持静态图片和 GIF 动图**导入
- 🔄 **无图模式**：不传图片也能玩特效
- 📐 **圆形/方形裁剪**，实时预览

## 导出格式

| 格式 | 动画 | 半透明 | 说明 |
|------|------|--------|------|
| WebM | ✅ | ✅ | 视频格式，支持完整半透明 |
| GIF  | ✅ | ❌ | 动图，1-bit 透明，不支持半透明边缘 |
| APNG | ✅ | ✅ | 动画 PNG，原生 alpha 通道 |
| WebP | ✅ | ✅ | 动画 WebP，Chrome/Edge 支持 |

## 技术栈

- React + TypeScript + Vite
- [PIXI.js](https://pixijs.com/) — WebGL 渲染
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
