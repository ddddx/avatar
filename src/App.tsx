import { useState, useRef, useCallback } from 'react';
import type { GifData } from './lib/gif-decoder';
import { decodeGif } from './lib/gif-decoder';
import EffectSelector from './components/EffectSelector';
import EffectControls from './components/EffectControls';
import PreviewCanvas from './components/PreviewCanvas';
import {
  DEFAULT_PARAMS,
  EFFECT_PRESETS,
  RING_LOOP_DURATION_MS,
  RING_LOOP_SPEED_BASELINE,
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
const RING_EFFECTS = new Set<EffectType>(['solidring', 'disc', 'googleone', 'duotone', 'blinkring', 'linxudo', 'bounce', 'collapsequad', 'axisrings', 'loader', 'spinner', 'neoncomet', 'equalizer', 'magiccircle', 'cyberhud', 'crtglitch', 'portal', 'kaleidoscope']);
const PREVIEW_LOOP_EFFECTS = new Set<EffectType>(['fire', 'aurora', 'rain']);
const TRANSPARENT_STAGE_EFFECTS = new Set<EffectType>(['bounce']);
const EFFECT_LABELS: Record<EffectType, string> = {
  solidring: '实心环',
  disc: '光盘',
  googleone: 'Google One 环',
  duotone: '双色环',
  blinkring: '闪烁环',
  linxudo: 'LinxuDo',
  bounce: '弹跳头像',
  collapsequad: '收缩四色环',
  axisrings: '双轴圆环',
  neoncomet: '霓虹彗星环',
  equalizer: '频谱环',
  magiccircle: '魔法阵',
  cyberhud: '赛博 HUD',
  crtglitch: 'CRT 故障',
  portal: '传送门',
  kaleidoscope: '万花筒',
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

function hasTransparentStage(
  effect: EffectType,
  shape: CropShape,
  image: HTMLImageElement | null,
  gifData: GifData | null,
) {
  return (!image && !gifData) || shape === 'circle' || TRANSPARENT_STAGE_EFFECTS.has(effect);
}

function getRingExportTiming(effect: EffectType, fallbackFps: number, params: EffectParams) {
  if (!RING_EFFECTS.has(effect) && !PREVIEW_LOOP_EFFECTS.has(effect)) {
    return {
      frameCount: Math.floor((2000 / 1000) * fallbackFps),
      frameDelay: Math.round(1000 / fallbackFps),
    };
  }

  const clampedSpeed = Math.max(1, Math.min(params.speed, 100));
  const loopDuration = (
    RING_EFFECTS.has(effect)
      ? RING_LOOP_DURATION_MS * (RING_LOOP_SPEED_BASELINE / clampedSpeed)
      : 2000 * (50 / clampedSpeed)
  );
  const frameDelay = Math.round(1000 / fallbackFps);

  return {
    frameCount: Math.max(2, Math.round(loopDuration / frameDelay) + 1),
    frameDelay,
  };
}

function getRingExportFrameProgress(_effect: EffectType, frameIndex: number, frameCount: number) {
  if (frameCount <= 1) return 0;
  return frameIndex / (frameCount - 1);
}

function getSupportedWebMMimeType() {
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error('WebM 录制不被此浏览器支持');
  }

  return mimeType;
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
    renderFrame(exportProgress: number, elapsedMs: number) {
      renderer.render(ctx, params, exportProgress, elapsedMs);
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

type WorkspaceTab = 'effects' | 'controls' | 'output';

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
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('controls');
  const [previewDragging, setPreviewDragging] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const handleClearSource = useCallback(() => {
    setImage(null);
    setGifData(null);
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    if (file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        try {
          handleGifLoad(decodeGif(buffer));
        } catch (err) {
          console.error('Failed to parse GIF:', err);
          alert('GIF 文件解析失败');
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      const img = new Image();
      img.onload = () => handleImageLoad(img);
      img.src = url;
    };
    reader.readAsDataURL(file);
  }, [handleGifLoad, handleImageLoad]);

  const handlePreviewDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setPreviewDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

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
    const fps = 20;
    const mimeType = getSupportedWebMMimeType();

    if (RING_EFFECTS.has(effect) || PREVIEW_LOOP_EFFECTS.has(effect)) {
      const { frameCount, frameDelay } = getRingExportTiming(effect, fps, params);
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = canvas.width;
      frameCanvas.height = canvas.height;
      const frameCtx = frameCanvas.getContext('2d');
      if (!frameCtx) {
        throw new Error('无法创建 WebM 导出画布');
      }

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
      const stream = frameCanvas.captureStream(0);
      const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      await new Promise<void>((resolve, reject) => {
        recorder.onerror = () => reject(new Error('WebM 录制失败'));
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          downloadBlob(blob, `avatar-${effect}.webm`);
          resolve();
        };

        recorder.start();

        const renderFrames = async () => {
          try {
            if (!ringRenderer) {
              exportCanvas.__avatarSetExportFrameStep?.(frameDelay);
            }
            for (let i = 0; i < frameCount; i++) {
              const frameProgress = getRingExportFrameProgress(effect, i, frameCount);
              const sourceCanvas = ringRenderer
                ? ringRenderer.renderFrame(frameProgress, i * frameDelay)
                : (() => {
                    exportCanvas.__avatarSetRingLoopProgress?.(frameProgress);
                    exportCanvas.__avatarRenderFrame?.();
                    return exportCanvas.__avatarExtractFrame?.() ?? canvas;
                  })();
              frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
              frameCtx.drawImage(sourceCanvas, 0, 0);
              track.requestFrame?.();
              setExportProgress((i + 1) / frameCount * 0.95);
              await new Promise(r => setTimeout(r, frameDelay));
            }
          } finally {
            if (!ringRenderer) {
              exportCanvas.__avatarSetRingLoopProgress?.(null);
              exportCanvas.__avatarSetExportFrameStep?.(null);
            }
          }
          setExportProgress(1);
          recorder.stop();
        };

        void renderFrames().catch(reject);
      });
      return;
    }

    const duration = 2000;
    const stream = canvas.captureStream(fps);

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
  }, [effect, downloadBlob, gifData, image, mirror, params, shape]);

  // Export as GIF (gif.js with Web Worker, fallback to frames)
  const exportGIF = useCallback(async (canvas: HTMLCanvasElement) => {
    const fps = 15; // Lower fps for smaller GIF
    const transparentStage = hasTransparentStage(effect, shape, image, gifData);

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
      transparent: transparentStage ? GIF_TRANSPARENT_KEY : undefined,
    });

    const { frameCount, frameDelay: captureDelay } = getRingExportTiming(effect, fps, params);
    const exportCanvas = canvas as ExportDrivenCanvas;
    const drivePreviewLoop = PREVIEW_LOOP_EFFECTS.has(effect);
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
    if (transparentStage) {
      offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      offCtx = offscreen.getContext('2d')!;
    }
    const BG_THRESHOLD = 8; // pixels dimmer than this are "background" → transparent

    try {
      if (drivePreviewLoop) {
        exportCanvas.__avatarSetExportFrameStep?.(captureDelay);
      }

      // Capture frames
      for (let i = 0; i < frameCount; i++) {
        const frameProgress = getRingExportFrameProgress(effect, i, frameCount);
        if (drivePreviewLoop) {
          exportCanvas.__avatarSetRingLoopProgress?.(frameProgress);
          exportCanvas.__avatarRenderFrame?.();
        }

        const sourceCanvas = RING_EFFECTS.has(effect)
          ? (ringRenderer?.renderFrame(frameProgress, i * captureDelay) ?? exportCanvas.__avatarExtractFrame?.() ?? canvas)
          : drivePreviewLoop
            ? (exportCanvas.__avatarExtractFrame?.() ?? canvas)
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
          } else if (transparentStage) {
            snapTransparentToGifKey(imgData);
          }
          offCtx.putImageData(imgData, 0, 0);
          gif.addFrame(offscreen, { copy: true, delay: captureDelay });
        } else {
          gif.addFrame(sourceCanvas, { copy: true, delay: captureDelay });
        }
        setExportProgress((i + 1) / frameCount * 0.5);
        if (!RING_EFFECTS.has(effect) && !drivePreviewLoop) {
          await new Promise(r => setTimeout(r, captureDelay));
        }
      }
    } finally {
      if (drivePreviewLoop) {
        exportCanvas.__avatarSetRingLoopProgress?.(null);
        exportCanvas.__avatarSetExportFrameStep?.(null);
      }
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
    const fps = 15;
    const { frameCount, frameDelay } = getRingExportTiming(effect, fps, params);
    const w = canvas.width;
    const h = canvas.height;
    const exportCanvas = canvas as ExportDrivenCanvas;
    const drivePreviewLoop = PREVIEW_LOOP_EFFECTS.has(effect);
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
      if (drivePreviewLoop) {
        exportCanvas.__avatarSetExportFrameStep?.(frameDelay);
      }

      for (let i = 0; i < frameCount; i++) {
        const frameProgress = getRingExportFrameProgress(effect, i, frameCount);
        if (drivePreviewLoop) {
          exportCanvas.__avatarSetRingLoopProgress?.(frameProgress);
          exportCanvas.__avatarRenderFrame?.();
        }

        const sourceCanvas = RING_EFFECTS.has(effect)
          ? (ringRenderer?.renderFrame(frameProgress, i * frameDelay) ?? exportCanvas.__avatarExtractFrame?.() ?? canvas)
          : drivePreviewLoop
            ? (exportCanvas.__avatarExtractFrame?.() ?? canvas)
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
        if (!RING_EFFECTS.has(effect) && !drivePreviewLoop) {
          await new Promise(r => setTimeout(r, frameDelay));
        }
      }
    } finally {
      if (drivePreviewLoop) {
        exportCanvas.__avatarSetRingLoopProgress?.(null);
        exportCanvas.__avatarSetExportFrameStep?.(null);
      }
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
    const fps = 12;
    const transparentStage = hasTransparentStage(effect, shape, image, gifData);
    const { frameCount, frameDelay } = getRingExportTiming(effect, fps, params);
    const w = canvas.width;
    const h = canvas.height;
    const exportCanvas = canvas as ExportDrivenCanvas;
    const drivePreviewLoop = PREVIEW_LOOP_EFFECTS.has(effect);
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
      if (drivePreviewLoop) {
        exportCanvas.__avatarSetExportFrameStep?.(frameDelay);
      }

      for (let i = 0; i < frameCount; i++) {
        const frameProgress = getRingExportFrameProgress(effect, i, frameCount);
        if (drivePreviewLoop) {
          exportCanvas.__avatarSetRingLoopProgress?.(frameProgress);
          exportCanvas.__avatarRenderFrame?.();
        }

        const sourceCanvas = RING_EFFECTS.has(effect)
          ? (ringRenderer?.renderFrame(frameProgress, i * frameDelay) ?? exportCanvas.__avatarExtractFrame?.() ?? canvas)
          : drivePreviewLoop
            ? (exportCanvas.__avatarExtractFrame?.() ?? canvas)
            : canvas;

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(sourceCanvas, 0, 0);
        if (shape === 'circle') {
          applyCircleAlphaMask(ctx, w, h);
        }
        const imgData = ctx.getImageData(0, 0, w, h);
        frames.push({ data: new Uint8Array(imgData.data), duration: frameDelay });
        setExportProgress((i + 1) / frameCount * 0.7);
        if (!RING_EFFECTS.has(effect) && !drivePreviewLoop) {
          await new Promise(r => setTimeout(r, frameDelay));
        }
      }
    } finally {
      if (drivePreviewLoop) {
        exportCanvas.__avatarSetRingLoopProgress?.(null);
        exportCanvas.__avatarSetExportFrameStep?.(null);
      }
    }

    setExportProgress(0.8);
    const webpData = await encodeAnimation(w, h, transparentStage, frames);
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
        <div className="header-copy">
          <div className="header-title-group">
            <h1>动态头像工作台</h1>
          </div>
        </div>
        <div className="header-badges">
          <span className="meta-pill">37 种特效</span>
          <span className="meta-pill">圆外透明导出</span>
          <span className="meta-pill">GIF / APNG / WebP / WebM</span>
        </div>
      </header>

      <main className="app-main">
        <div className="studio-grid">
          <section className="panel preview-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">实时预览</h2>
              </div>
            </div>
            <div className="preview-control-strip">
              <div className="preview-meta">
                <span className="meta-pill">导出：{formatLabel}</span>
              </div>
              <div className="preview-quickbar">
                <div className="quick-group">
                  <span className="quick-label">形状</span>
                  <div className="quick-toggle">
                    <button
                      type="button"
                      className={`quick-btn ${shape === 'circle' ? 'active' : ''}`}
                      onClick={() => setShape('circle')}
                    >
                      ⭕ 圆形
                    </button>
                    <button
                      type="button"
                      className={`quick-btn ${shape === 'square' ? 'active' : ''}`}
                      onClick={() => setShape('square')}
                    >
                      ⬜ 矩形
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div
              className={`preview-stage ${previewDragging ? 'dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setPreviewDragging(true);
              }}
              onDragLeave={() => setPreviewDragging(false)}
              onDrop={handlePreviewDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFile(file);
                  }
                  e.currentTarget.value = '';
                }}
              />
              <div className="preview-toolbar">
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {image || gifData ? '更换素材' : '上传素材'}
                </button>
                {(image || gifData) && (
                  <button
                    type="button"
                    className="toolbar-btn subtle"
                    onClick={handleClearSource}
                  >
                    清空
                  </button>
                )}
              </div>
              <div className="preview-area">
                <div className="preview-stack">
                  <PreviewCanvas
                    image={image}
                    gifData={gifData}
                    effect={effect}
                    shape={shape}
                    mirror={mirror}
                    params={params}
                    canvasRef={canvasRef}
                  />
                  {!image && !gifData && (
                    <div className="preview-status-hint">
                      纯特效预览中，可拖拽图片或 GIF 到这里
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside
            className="side-rail"
          >
            <section className="panel selector-shell side-panel">
              <div className="section-head">
                <div className="selector-head-main">
                  <div className="selector-title-row">
                    <h2 className="section-title">特效库</h2>
                    <span className="selector-current">当前特效：{EFFECT_LABELS[effect]}</span>
                  </div>
                </div>
              </div>
              <div className="selector-body">
                <EffectSelector selected={effect} onChange={handleEffectChange} />
              </div>
            </section>

            <section className="panel workspace-panel side-panel">
              <div className="section-head">
                <div>
                  <h2 className="section-title">调节、特效与导出</h2>
                </div>
              </div>
              <div className="workspace-tabs">
                <button
                  type="button"
                  className={`workspace-tab workspace-tab-mobile-only ${workspaceTab === 'effects' ? 'active' : ''}`}
                  onClick={() => setWorkspaceTab('effects')}
                >
                  特效
                </button>
                <button
                  type="button"
                  className={`workspace-tab ${workspaceTab === 'controls' ? 'active' : ''}`}
                  onClick={() => setWorkspaceTab('controls')}
                >
                  调节
                </button>
                <button
                  type="button"
                  className={`workspace-tab ${workspaceTab === 'output' ? 'active' : ''}`}
                  onClick={() => setWorkspaceTab('output')}
                >
                  导出
                </button>
              </div>

              {workspaceTab === 'effects' ? (
                <div className="workspace-body workspace-body-effects">
                  <div className="workspace-section-head">
                    <div className="group-label">特效</div>
                    <span className="selector-current">当前：{EFFECT_LABELS[effect]}</span>
                  </div>
                  <EffectSelector selected={effect} onChange={handleEffectChange} />
                </div>
              ) : workspaceTab === 'controls' ? (
                <div className="workspace-body">
                  <div className="workspace-section-head">
                    <div className="group-label">参数调节</div>
                  </div>
                  <EffectControls effect={effect} params={params} onChange={setParams} />
                </div>
              ) : (
                <div className="workspace-body">
                  <div className="workspace-section-head">
                    <div className="group-label">导出设置</div>
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
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default App;
