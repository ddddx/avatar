import { useState, useRef, useCallback } from 'react';
import type { GifData } from './lib/gif-decoder';
import ImageUploader from './components/ImageUploader';
import EffectSelector from './components/EffectSelector';
import EffectControls from './components/EffectControls';
import PreviewCanvas from './components/PreviewCanvas';
import {
  DEFAULT_PARAMS,
  EFFECT_PRESETS,
  RING_LOOP_FRAME_COUNT,
  RING_LOOP_FRAME_DELAY_MS,
} from './effects/types';
import type { EffectType, CropShape, EffectParams, MirrorSettings } from './effects/types';
import { createRingRenderer } from './effects/ring-renderer';
// @ts-ignore - gif.js browser bundle has no types
import GIF from 'gif.js/dist/gif.js';
// @ts-ignore - upng-js has no types
import * as UPNG from 'upng-js';
// @ts-ignore - wasm-webp has no types
import { encodeAnimation } from 'wasm-webp';
import './App.css';

// Detect browser capabilities
const supportsMediaRecorder = typeof MediaRecorder !== 'undefined';
const supportsWebWorkers = typeof Worker !== 'undefined';
const GIF_TRANSPARENT_KEY = 0xff00ff;
const RING_EFFECTS = new Set<EffectType>(['solidring', 'disc', 'googleone']);
const EFFECT_LABELS: Record<EffectType, string> = {
  solidring: '实心环',
  disc: '光盘',
  googleone: 'Google One 环',
  lightning: '闪电',
  fire: '火焰',
  glow: '炫光',
  orbit: '环形粒子',
  shield: '能量护盾',
  frost: '冰霜',
  ripple: '水波纹',
  petal: '花瓣雨',
  stardust: '星尘',
  prism: '棱镜光',
  vortex: '旋风',
  firework: '烟花',
  gold: '金粉',
  spin: '旋转',
  loader: '加载中',
  spinner: '等待圈',
  matrix: '矩阵雨',
  bubble: '气泡',
  aurora: '极光',
  firefly: '萤火虫',
  rain: '雨',
};

function applyCircleAlphaMask(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function snapTransparentToGifKey(imageData: ImageData) {
  const px = imageData.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 64) {
      px[i] = 255;
      px[i + 1] = 0;
      px[i + 2] = 255;
    }
    px[i + 3] = 255;
  }
}


type OfflineRingRendererOptions = {
  width: number;
  height: number;
  image: HTMLImageElement | null;
  gifData: GifData | null;
  effect: EffectType;
  shape: CropShape;
  mirror: MirrorSettings;
  params: EffectParams;
};

function createOfflineRingRenderer({
  width,
  height,
  image,
  gifData,
  effect,
  shape,
  mirror,
  params,
}: OfflineRingRendererOptions) {
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = width;
  frameCanvas.height = height;
  const ctx = frameCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('无法创建导出画布');
  }
  const renderer = createRingRenderer({
    width,
    height,
    image,
    gifData,
    effect,
    shape,
    mirror,
  });

  return {
    frameCanvas,
    renderFrame(progress: number, elapsedMs: number) {
      renderer.render(ctx, params, progress, elapsedMs);
      return frameCanvas;
    }
  }
}

type ExportDrivenCanvas = HTMLCanvasElement & {
  __avatarSetExportFrameStep?: (deltaMs: number | null) => void;
  __avatarSetRingLoopProgress?: (progress: number | null) => void;
  __avatarRenderFrame?: () => void;
  __avatarExtractFrame?: () => HTMLCanvasElement | null;
};

function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [gifData, setGifData] = useState<GifData | null>(null);
  const [effect, setEffect] = useState<EffectType>('lightning');
  const [shape, setShape] = useState<CropShape>('circle');
  const [mirror, setMirror] = useState<MirrorSettings>({ flipX: false, flipY: false });
  const [params, setParams] = useState<EffectParams>({ ...DEFAULT_PARAMS });
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'gif' | 'webm' | 'webp' | 'apng'>(
    supportsMediaRecorder ? 'webm' : 'gif'
  );
  const [exportProgress, setExportProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shapeLabel = shape === 'circle' ? '圆形裁切' : '圆角矩形';
  const mirrorLabel = mirror.flipX && mirror.flipY
    ? '上下 + 左右'
    : mirror.flipX
      ? '左右'
      : mirror.flipY
        ? '上下'
        : '关闭';
  const formatLabel = exportFormat === 'webm'
    ? 'WebM'
    : exportFormat === 'gif'
      ? 'GIF'
      : exportFormat === 'apng'
        ? 'APNG'
        : 'WebP';

  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    setImage(img);
    setGifData(null); // Clear GIF when static image loaded
  }, []);

  const handleGifLoad = useCallback((data: GifData) => {
    setGifData(data);
    setImage(null); // Clear static image when GIF loaded
  }, []);

  const handleEffectChange = useCallback((e: EffectType) => {
    setEffect(e);
    const preset = EFFECT_PRESETS[e];
    setParams(prev => ({ ...prev, ...preset }));
  }, []);

  // Helper: download a blob using <a> tag (works on mobile)
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  // Export as WebM (MediaRecorder)
  const exportWebM = useCallback(async (canvas: HTMLCanvasElement) => {
    const duration = 2000;
    const fps = 20;
    const stream = canvas.captureStream(fps);

    // Try vp9 first, fall back to any supported codec
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      throw new Error('WebM 录制不被此浏览器支持');
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5000000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    return new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        downloadBlob(blob, `avatar-${effect}.webm`);
        resolve();
      };
      recorder.start();
      // Update progress during recording
      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setExportProgress(Math.min(elapsed / duration, 0.95));
      }, 100);
      setTimeout(() => {
        clearInterval(progressInterval);
        setExportProgress(1);
        recorder.stop();
      }, duration);
    });
  }, [effect, downloadBlob]);

  // Export as GIF (gif.js with Web Worker, fallback to frames)
  const exportGIF = useCallback(async (canvas: HTMLCanvasElement) => {
    const duration = 2000;
    const fps = 15; // Lower fps for smaller GIF

    // Check Web Worker support
    if (!supportsWebWorkers) {
      throw new Error('Web Workers 不可用，请使用序列帧导出');
    }

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: canvas.width,
      height: canvas.height,
      workerScript: import.meta.env.BASE_URL + 'gif.worker.js',
      transparent: (!image && !gifData) || shape === 'circle' ? GIF_TRANSPARENT_KEY : undefined,
    });

    const frameCount = RING_EFFECTS.has(effect) ? RING_LOOP_FRAME_COUNT : Math.floor((duration / 1000) * fps);
    const frameDelay = Math.round(1000 / fps);
    const captureDelay = RING_EFFECTS.has(effect) ? RING_LOOP_FRAME_DELAY_MS : frameDelay;
    const exportCanvas = canvas as ExportDrivenCanvas;
    const ringRenderer = RING_EFFECTS.has(effect)
      ? createOfflineRingRenderer({
          width: canvas.width,
          height: canvas.height,
          image,
          gifData,
          effect,
          shape,
          mirror,
          params,
        })
      : null;

    // For no-image mode: composite WebGL canvas over BLACK (not magenta!)
    // so semi-transparent edges blend to dark colors, not pink.
    // Then snap near-black pixels to magenta (the gif.js transparent color key).
    let offscreen: HTMLCanvasElement | null = null;
    let offCtx: CanvasRenderingContext2D | null = null;
    if (!image && !gifData || shape === 'circle') {
      offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      offCtx = offscreen.getContext('2d')!;
    }
    const BG_THRESHOLD = 8; // pixels dimmer than this are "background" → transparent

    try {
      if (RING_EFFECTS.has(effect) && !ringRenderer) {
        exportCanvas.__avatarSetExportFrameStep?.(captureDelay);
      }

      // Capture frames
      for (let i = 0; i < frameCount; i++) {
        if (RING_EFFECTS.has(effect) && !ringRenderer) {
          exportCanvas.__avatarSetRingLoopProgress?.(i / frameCount);
          exportCanvas.__avatarRenderFrame?.();
        }

        const sourceCanvas = RING_EFFECTS.has(effect)
          ? (ringRenderer?.renderFrame(i / frameCount, i * captureDelay) ?? exportCanvas.__avatarExtractFrame?.() ?? canvas)
          : canvas;

        if (offscreen && offCtx) {
          offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
          if (!image && !gifData) {
            offCtx.fillStyle = '#000000';
            offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
          }
          offCtx.drawImage(sourceCanvas, 0, 0);
          if (shape === 'circle') {
            applyCircleAlphaMask(offCtx, offscreen.width, offscreen.height);
          }
          const imgData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
          if (!image && !gifData) {
            const px = imgData.data;
            for (let j = 0; j < px.length; j += 4) {
              if (Math.max(px[j], px[j + 1], px[j + 2]) < BG_THRESHOLD) {
                px[j] = 255; px[j + 1] = 0; px[j + 2] = 255;
              }
              px[j + 3] = 255;
            }
          } else if (shape === 'circle') {
            snapTransparentToGifKey(imgData);
          }
          offCtx.putImageData(imgData, 0, 0);
          gif.addFrame(offscreen, { copy: true, delay: captureDelay });
        } else {
          gif.addFrame(sourceCanvas, { copy: true, delay: captureDelay });
        }
        setExportProgress((i + 1) / frameCount * 0.5);
        if (!RING_EFFECTS.has(effect)) {
          await new Promise(r => setTimeout(r, frameDelay));
        }
      }
    } finally {
      exportCanvas.__avatarSetRingLoopProgress?.(null);
      exportCanvas.__avatarSetExportFrameStep?.(null);
    }

    // Render GIF
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('GIF 渲染超时'));
      }, 30000);

      gif.on('finished', (blob: Blob) => {
        clearTimeout(timeout);
        setExportProgress(1);
        downloadBlob(blob, `avatar-${effect}.gif`);
        resolve();
      });

      gif.on('progress', (p: number) => {
        setExportProgress(0.5 + p * 0.5); // 50-100% for render
      });

      gif.render();
    });
  }, [effect, downloadBlob, gifData, image, mirror, params, shape]);

  // Export as PNG sequence frames (most compatible)
  // Export as APNG (animated PNG with full alpha support)
  const exportAPNG = useCallback(async (canvas: HTMLCanvasElement) => {
    const duration = 2000;
    const fps = 15;
    const frameCount = RING_EFFECTS.has(effect) ? RING_LOOP_FRAME_COUNT : Math.floor((duration / 1000) * fps);
    const frameDelay = RING_EFFECTS.has(effect) ? RING_LOOP_FRAME_DELAY_MS : Math.round(1000 / fps);
    const w = canvas.width;
    const h = canvas.height;
    const exportCanvas = canvas as ExportDrivenCanvas;
    const ringRenderer = RING_EFFECTS.has(effect)
      ? createOfflineRingRenderer({
          width: w,
          height: h,
          image,
          gifData,
          effect,
          shape,
          mirror,
          params,
        })
      : null;

    const frames: ArrayBuffer[] = [];
    const delays: number[] = [];

    // Create offscreen canvas for capturing RGBA pixels
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d')!;

    try {
      if (RING_EFFECTS.has(effect) && !ringRenderer) {
        exportCanvas.__avatarSetExportFrameStep?.(frameDelay);
      }

      for (let i = 0; i < frameCount; i++) {
        if (RING_EFFECTS.has(effect) && !ringRenderer) {
          exportCanvas.__avatarSetRingLoopProgress?.(i / frameCount);
          exportCanvas.__avatarRenderFrame?.();
        }

        const sourceCanvas = RING_EFFECTS.has(effect)
          ? (ringRenderer?.renderFrame(i / frameCount, i * frameDelay) ?? exportCanvas.__avatarExtractFrame?.() ?? canvas)
          : canvas;

        offCtx.clearRect(0, 0, w, h);
        offCtx.drawImage(sourceCanvas, 0, 0);
        if (shape === 'circle') {
          applyCircleAlphaMask(offCtx, w, h);
        }
        const imgData = offCtx.getImageData(0, 0, w, h);
        frames.push(imgData.data.buffer.slice(0));
        delays.push(frameDelay);

        setExportProgress((i + 1) / frameCount * 0.8);
        if (!RING_EFFECTS.has(effect)) {
          await new Promise(r => setTimeout(r, frameDelay));
        }
      }
    } finally {
      exportCanvas.__avatarSetRingLoopProgress?.(null);
      exportCanvas.__avatarSetExportFrameStep?.(null);
    }

    // Encode APNG — cnum=0 means auto colors
    setExportProgress(0.9);
    const apng = UPNG.encode(frames, w, h, 0, delays);
    const blob = new Blob([apng], { type: 'image/apng' });
    setExportProgress(1);
    downloadBlob(blob, `avatar-${effect}.apng`);
  }, [effect, downloadBlob, gifData, image, mirror, params, shape]);

  // Export as animated WebP (single .webp file) using wasm-webp
  const exportWebP = useCallback(async (canvas: HTMLCanvasElement) => {
    const duration = 2000;
    const fps = 12;
    const frameCount = RING_EFFECTS.has(effect) ? RING_LOOP_FRAME_COUNT : Math.floor((duration / 1000) * fps);
    const frameDelay = RING_EFFECTS.has(effect) ? RING_LOOP_FRAME_DELAY_MS : Math.round(1000 / fps);
    const w = canvas.width;
    const h = canvas.height;
    const exportCanvas = canvas as ExportDrivenCanvas;
    const ringRenderer = RING_EFFECTS.has(effect)
      ? createOfflineRingRenderer({
          width: w,
          height: h,
          image,
          gifData,
          effect,
          shape,
          mirror,
          params,
        })
      : null;
    // PIXI uses WebGL — can't getContext('2d') directly, use offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d')!;

    const frames: { data: Uint8Array; duration: number }[] = [];
    try {
      if (RING_EFFECTS.has(effect) && !ringRenderer) {
        exportCanvas.__avatarSetExportFrameStep?.(frameDelay);
      }

      for (let i = 0; i < frameCount; i++) {
        if (RING_EFFECTS.has(effect) && !ringRenderer) {
          exportCanvas.__avatarSetRingLoopProgress?.(i / frameCount);
          exportCanvas.__avatarRenderFrame?.();
        }

        const sourceCanvas = RING_EFFECTS.has(effect)
          ? (ringRenderer?.renderFrame(i / frameCount, i * frameDelay) ?? exportCanvas.__avatarExtractFrame?.() ?? canvas)
          : canvas;

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(sourceCanvas, 0, 0);
        if (shape === 'circle') {
          applyCircleAlphaMask(ctx, w, h);
        }
        const imgData = ctx.getImageData(0, 0, w, h);
        frames.push({ data: new Uint8Array(imgData.data), duration: frameDelay });
        setExportProgress((i + 1) / frameCount * 0.7);
        if (!RING_EFFECTS.has(effect)) {
          await new Promise(r => setTimeout(r, frameDelay));
        }
      }
    } finally {
      exportCanvas.__avatarSetRingLoopProgress?.(null);
      exportCanvas.__avatarSetExportFrameStep?.(null);
    }

    setExportProgress(0.8);
    const webpData = await encodeAnimation(w, h, !image && !gifData, frames);
    if (!webpData) throw new Error('WebP animation encoding failed');
    setExportProgress(1);
    const blob = new Blob([webpData.buffer as ArrayBuffer], { type: 'image/webp' });
    downloadBlob(blob, `avatar-${effect}.webp`);
  }, [effect, downloadBlob, gifData, image, mirror, params, shape]);

  const handleExport = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;
    setExporting(true);
    setExportProgress(0);

    try {
      if (exportFormat === 'webm') {
        if (!supportsMediaRecorder) {
          alert('此浏览器不支持 WebM 录制，请选择 GIF 或序列帧格式');
          return;
        }
        await exportWebM(canvas);
      } else if (exportFormat === 'apng') {
        await exportAPNG(canvas);
      } else if (exportFormat === 'gif') {
        await exportGIF(canvas);
      } else if (exportFormat === 'webp') {
        await exportWebP(canvas);
      }
    } catch (err) {
      console.error('Export failed:', err);
      const msg = err instanceof Error ? err.message : '导出失败';
      alert(`导出失败: ${msg}`);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [exportFormat, exporting, exportWebM, exportGIF, exportAPNG, exportWebP]);

  return (
    <div className="app">
      <header className="app-header">
        <p className="eyebrow">Avatar Motion Lab</p>
        <h1>动态头像工作台</h1>
        <p className="subtitle">上传图片或 GIF，套用动态特效，导出支持透明背景的头像动画。</p>
        <div className="header-badges">
          <span className="meta-pill">23 种特效</span>
          <span className="meta-pill">圆外透明导出</span>
          <span className="meta-pill">GIF / APNG / WebP / WebM</span>
        </div>
      </header>

      <main className="app-main">
        <section className="panel selector-shell">
          <div className="section-head section-head-inline">
            <div>
              <p className="section-kicker">Effects</p>
              <h2 className="section-title">特效库</h2>
            </div>
            <p className="section-note">先选风格，再微调密度、速度和颜色。当前特效：{EFFECT_LABELS[effect]}</p>
          </div>
          <div className="selector-body">
            <EffectSelector selected={effect} onChange={handleEffectChange} />
          </div>

          <div className="studio-grid">
            <section className="panel preview-panel">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Preview</p>
                  <h2 className="section-title">实时预览</h2>
                </div>
                <p className="section-note">圆形模式会把圆外部分裁成透明，导出时保持一致。</p>
              </div>
              <div className="preview-meta">
                <span className="meta-pill">特效：{EFFECT_LABELS[effect]}</span>
                <span className="meta-pill">形状：{shapeLabel}</span>
                <span className="meta-pill">镜像：{mirrorLabel}</span>
                <span className="meta-pill">导出：{formatLabel}</span>
              </div>
              <div className="preview-stage">
                <div className="preview-area">
                  <PreviewCanvas
                    image={image}
                    gifData={gifData}
                    effect={effect}
                    shape={shape}
                    mirror={mirror}
                    params={params}
                    canvasRef={canvasRef}
                  />
                </div>
              </div>
            </section>

            <aside className="control-rail">
              <section className="panel upload-panel">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Source</p>
                    <h2 className="section-title">素材</h2>
                  </div>
                  <p className="section-note">支持静态图和 GIF，拖拽到卡片内即可替换。</p>
                </div>
                <ImageUploader onImageLoad={handleImageLoad} onGifLoad={handleGifLoad} />
              </section>

              <section className="panel controls-panel">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Controls</p>
                    <h2 className="section-title">细节调节</h2>
                  </div>
                  <p className="section-note">调粒子密度、强度、速度和主副色，找到最适合头像的节奏。</p>
                </div>
                <EffectControls effect={effect} params={params} onChange={setParams} />
              </section>

              <section className="panel output-panel">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Output</p>
                    <h2 className="section-title">裁切与导出</h2>
                  </div>
                  <p className="section-note">先确定头像外形，再选择导出格式。透明背景优先用 APNG、WebP 或 WebM。</p>
                </div>

                <div className="output-group">
                  <div className="group-label">头像形状</div>
                  <div className="shape-selector">
                    <button
                      className={`shape-btn ${shape === 'circle' ? 'active' : ''}`}
                      onClick={() => setShape('circle')}
                    >
                      <span className="shape-icon">⭕</span>
                      <span>圆形</span>
                    </button>
                    <button
                      className={`shape-btn ${shape === 'square' ? 'active' : ''}`}
                      onClick={() => setShape('square')}
                    >
                      <span className="shape-icon">⬜</span>
                      <span>矩形</span>
                    </button>
                  </div>
                </div>

                <div className="output-group">
                  <div className="group-label">镜像</div>
                  <div className="mirror-selector">
                    <button
                      className={`shape-btn ${mirror.flipX ? 'active' : ''}`}
                      onClick={() => setMirror((prev) => ({ ...prev, flipX: !prev.flipX }))}
                    >
                      <span className="shape-icon">↔</span>
                      <span>左右镜像</span>
                    </button>
                    <button
                      className={`shape-btn ${mirror.flipY ? 'active' : ''}`}
                      onClick={() => setMirror((prev) => ({ ...prev, flipY: !prev.flipY }))}
                    >
                      <span className="shape-icon">↕</span>
                      <span>上下镜像</span>
                    </button>
                  </div>
                </div>

                <div className="output-group">
                  <div className="group-label">导出格式</div>
                  <div className="export-controls">
                    <div className="format-toggle">
                      <button
                        className={`format-btn ${exportFormat === 'webm' ? 'active' : ''}`}
                        onClick={() => setExportFormat('webm')}
                        disabled={!supportsMediaRecorder}
                        title="WebM 视频，支持半透明"
                      >
                        🎬 WebM
                      </button>
                      <button
                        className={`format-btn ${exportFormat === 'gif' ? 'active' : ''}`}
                        onClick={() => setExportFormat('gif')}
                        disabled={!supportsWebWorkers}
                        title="GIF 动图，不支持半透明"
                      >
                        🖼️ GIF
                      </button>
                      <button
                        className={`format-btn ${exportFormat === 'apng' ? 'active' : ''}`}
                        onClick={() => setExportFormat('apng')}
                        title="动画PNG，支持完整半透明"
                      >
                        🎞️ APNG
                      </button>
                      <button
                        className={`format-btn ${exportFormat === 'webp' ? 'active' : ''}`}
                        onClick={() => setExportFormat('webp')}
                        title="动画 WebP，支持半透明（Chrome/Edge）"
                      >
                        🎬 WebP
                      </button>
                    </div>
                    {exporting && (
                      <div className="export-progress">
                        <div
                          className="export-progress-bar"
                          style={{ width: `${Math.round(exportProgress * 100)}%` }}
                        />
                        <span className="export-progress-text">
                          {Math.round(exportProgress * 100)}%
                        </span>
                      </div>
                    )}
                    <button
                      className="export-btn"
                      onClick={handleExport}
                      disabled={exporting}
                    >
                      {exporting ? '正在导出…' : `导出 ${formatLabel}`}
                    </button>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
