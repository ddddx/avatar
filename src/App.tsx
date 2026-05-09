import { useState, useRef, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import EffectSelector from './components/EffectSelector';
import EffectControls from './components/EffectControls';
import PreviewCanvas from './components/PreviewCanvas';
import { DEFAULT_PARAMS, EFFECT_PRESETS } from './effects/types';
import type { EffectType, CropShape, EffectParams } from './effects/types';
import './App.css';

// Detect browser capabilities
const supportsMediaRecorder = typeof MediaRecorder !== 'undefined';
const supportsWebWorkers = typeof Worker !== 'undefined';

function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [effect, setEffect] = useState<EffectType>('lightning');
  const [shape, setShape] = useState<CropShape>('circle');
  const [params, setParams] = useState<EffectParams>({ ...DEFAULT_PARAMS });
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'gif' | 'webm' | 'frames'>(
    supportsMediaRecorder ? 'webm' : 'gif'
  );
  const [exportProgress, setExportProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
      workerScript: 'gif.worker.js',
    });

    const frameCount = Math.floor((duration / 1000) * fps);
    const frameDelay = Math.round(1000 / fps);

    // Capture frames
    for (let i = 0; i < frameCount; i++) {
      gif.addFrame(canvas, { copy: true, delay: frameDelay });
      setExportProgress((i + 1) / frameCount * 0.5); // 0-50% for capture
      await new Promise(r => setTimeout(r, frameDelay));
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
  }, [effect, downloadBlob]);

  // Export as PNG sequence frames (most compatible)
  const exportFrames = useCallback(async (canvas: HTMLCanvasElement) => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const duration = 2000;
    const fps = 12;
    const frameCount = Math.floor((duration / 1000) * fps);
    const frameDelay = Math.round(1000 / fps);

    // Capture frames as PNG
    for (let i = 0; i < frameCount; i++) {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const paddedIndex = String(i + 1).padStart(3, '0');
      zip.file(`frame-${paddedIndex}.png`, base64, { base64: true });
      setExportProgress((i + 1) / frameCount * 0.7);
      await new Promise(r => setTimeout(r, frameDelay));
    }

    // Generate zip
    setExportProgress(0.8);
    const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      setExportProgress(0.8 + metadata.percent / 100 * 0.2);
    });

    setExportProgress(1);
    downloadBlob(blob, `avatar-${effect}-frames.zip`);
  }, [effect, downloadBlob]);

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
      } else if (exportFormat === 'gif') {
        await exportGIF(canvas);
      } else {
        await exportFrames(canvas);
      }
    } catch (err) {
      console.error('Export failed:', err);
      const msg = err instanceof Error ? err.message : '导出失败';
      alert(`导出失败: ${msg}`);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [exportFormat, exporting, exportWebM, exportGIF, exportFrames]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>✨ Avatar FX Studio</h1>
        <p className="subtitle">动态头像粒子特效生成器</p>
      </header>

      <main className="app-main">
        <div className="sidebar">
          <section className="panel">
            <h2 className="panel-title">📷 上传头像</h2>
            <ImageUploader onImageLoad={setImage} />
          </section>

          <section className="panel">
            <h2 className="panel-title">🎨 特效类型</h2>
            <EffectSelector selected={effect} onChange={handleEffectChange} />
          </section>

          <section className="panel">
            <h2 className="panel-title">⚙️ 参数调节</h2>
            <EffectControls params={params} onChange={setParams} />
          </section>

          <section className="panel">
            <h2 className="panel-title">✂️ 形状裁剪</h2>
            <div className="shape-selector">
              <button
                className={`shape-btn ${shape === 'circle' ? 'active' : ''}`}
                onClick={() => setShape('circle')}
              >
                ⭕ 圆形
              </button>
              <button
                className={`shape-btn ${shape === 'square' ? 'active' : ''}`}
                onClick={() => setShape('square')}
              >
                ⬜ 方形
              </button>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">💾 导出</h2>
            <div className="export-controls">
              <div className="format-toggle">
                <button
                  className={`format-btn ${exportFormat === 'webm' ? 'active' : ''}`}
                  onClick={() => setExportFormat('webm')}
                  disabled={!supportsMediaRecorder}
                  title={!supportsMediaRecorder ? '此浏览器不支持 WebM' : 'WebM 视频'}
                >
                  🎬 WebM
                  {!supportsMediaRecorder && <span className="format-unsupported">✗</span>}
                </button>
                <button
                  className={`format-btn ${exportFormat === 'gif' ? 'active' : ''}`}
                  onClick={() => setExportFormat('gif')}
                  disabled={!supportsWebWorkers}
                  title={!supportsWebWorkers ? '此浏览器不支持 Web Worker' : 'GIF 动图'}
                >
                  🖼️ GIF
                  {!supportsWebWorkers && <span className="format-unsupported">✗</span>}
                </button>
                <button
                  className={`format-btn ${exportFormat === 'frames' ? 'active' : ''}`}
                  onClick={() => setExportFormat('frames')}
                  title="PNG 序列帧 (兼容性最好)"
                >
                  📁 序列帧
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
                disabled={!image || exporting}
              >
                {exporting
                  ? '⏳ 导出中...'
                  : `导出 ${exportFormat === 'webm' ? 'WebM' : exportFormat === 'gif' ? 'GIF' : '序列帧'}`
                }
              </button>
            </div>
          </section>
        </div>

        <div className="preview-area">
          {image ? (
            <PreviewCanvas
              image={image}
              effect={effect}
              shape={shape}
              params={params}
              canvasRef={canvasRef}
            />
          ) : (
            <div className="preview-placeholder">
              <div className="placeholder-icon">🖼️</div>
              <p>上传一张头像图片开始创作</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
