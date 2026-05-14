import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { ParticleEngine } from '../effects/engine';
import { SQUARE_CORNER_RADIUS } from '../effects/types';
import { createRingRenderer, getRingAnimationProgress, isRingEffect as isRingEffectType } from '../effects/ring-renderer';
import type { EffectType, CropShape, EffectParams, MirrorSettings } from '../effects/types';
import type { GifData } from '../lib/gif-decoder';

interface Props {
  image: HTMLImageElement | null;
  gifData: GifData | null;
  effect: EffectType;
  shape: CropShape;
  mirror: MirrorSettings;
  params: EffectParams;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const SIZE = 512;
const NON_GLOW_EFFECTS = new Set<EffectType>(['solidring', 'disc', 'googleone', 'spinner']);

const PreviewCanvas: React.FC<Props> = ({ image, gifData, effect, shape, mirror, params, canvasRef }) => {
  const isRingEffect = isRingEffectType(effect);
  const noImageMode = !image && !gifData;
  const paramsRef = useRef(params);
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const engineRef = useRef(new ParticleEngine());
  const imageSpriteRef = useRef<PIXI.Sprite | null>(null);
  const maskRef = useRef<PIXI.Graphics | null>(null);
  const effectsGfxRef = useRef<PIXI.Graphics | null>(null);
  const glowGfxRef = useRef<PIXI.Graphics | null>(null);
  const rafRef = useRef<number>(0);
  const tickRef = useRef<(() => void) | null>(null);
  const initRef = useRef(false);
  // GIF animation state
  const gifTexturesRef = useRef<PIXI.Texture[]>([]);
  const gifFrameRef = useRef(0);
  const gifTimerRef = useRef(0);
  const gifLastTimeRef = useRef(0);
  const fixedDeltaMsRef = useRef<number | null>(null);
  const exportActiveRef = useRef(false);
  const ringCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const ringRendererRef = useRef<ReturnType<typeof createRingRenderer> | null>(null);
  const ringElapsedMsRef = useRef(0);

  paramsRef.current = params;

  // Single init + animation effect
  useEffect(() => {
    let destroyed = false;

    if (isRingEffect) {
      cancelAnimationFrame(rafRef.current);
      appRef.current?.destroy(true);
      appRef.current = null;
      initRef.current = false;
      for (const tex of gifTexturesRef.current) {
        tex.destroy(true);
      }
      gifTexturesRef.current = [];

      const container = containerRef.current;
      if (!container) return;

      container.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      container.appendChild(canvas);
      ringCanvasRef.current = canvas;
      ringCtxRef.current = canvas.getContext('2d');
      ringRendererRef.current = ringCtxRef.current
        ? createRingRenderer({
            width: SIZE,
            height: SIZE,
            image,
            gifData,
            effect,
            shape,
            mirror,
          })
        : null;
      ringElapsedMsRef.current = 0;
      gifLastTimeRef.current = 0;

      if (canvasRef) {
        (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
      }

      const tick = () => {
        if (destroyed) return;
        const now = performance.now();
        const deltaMs = fixedDeltaMsRef.current ?? (gifLastTimeRef.current ? Math.min(now - gifLastTimeRef.current, 100) : 16.67);
        gifLastTimeRef.current = now;
        ringElapsedMsRef.current += deltaMs;
        const currentParams = paramsRef.current;
        const progress = getRingAnimationProgress(currentParams.speed, ringElapsedMsRef.current);
        const ctx = ringCtxRef.current;
        const renderer = ringRendererRef.current;
        if (ctx && renderer) {
          renderer.render(ctx, currentParams, progress, ringElapsedMsRef.current);
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      tickRef.current = tick;
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        destroyed = true;
        cancelAnimationFrame(rafRef.current);
        ringCanvasRef.current = null;
        ringCtxRef.current = null;
        ringRendererRef.current = null;
      };
    }

    const setup = async () => {
      // Init PIXI app once
      if (!appRef.current && !initRef.current) {
        initRef.current = true;
        const app = new PIXI.Application();
        await app.init({
          width: SIZE,
          height: SIZE,
          background: 0x000000,
          antialias: true,
          resolution: 1,
          preserveDrawingBuffer: true,
          backgroundAlpha: shape === 'circle' || noImageMode ? 0 : 1,
        });
        if (destroyed) { app.destroy(true); return; }
        appRef.current = app;

        const container = containerRef.current;
        if (container && app.canvas) {
          container.innerHTML = '';
          const cvs = app.canvas as HTMLCanvasElement;
          cvs.style.width = '100%';
          cvs.style.height = '100%';
          cvs.style.display = 'block';
          container.appendChild(cvs);
          if (canvasRef) {
            (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = cvs;
          }
        }
      }

      const app = appRef.current;
      if (!app) return;

      // Clean up old image + effects
      if (imageSpriteRef.current) {
        app.stage.removeChild(imageSpriteRef.current);
        imageSpriteRef.current.destroy();
        imageSpriteRef.current = null;
      }
      if (maskRef.current) {
        app.stage.removeChild(maskRef.current);
        maskRef.current.destroy();
        maskRef.current = null;
      }
      if (effectsGfxRef.current) {
        app.stage.removeChild(effectsGfxRef.current);
        effectsGfxRef.current.destroy();
        effectsGfxRef.current = null;
      }
      if (glowGfxRef.current) {
        app.stage.removeChild(glowGfxRef.current);
        glowGfxRef.current.destroy();
        glowGfxRef.current = null;
      }

      // Clean up old GIF textures
      for (const tex of gifTexturesRef.current) {
        tex.destroy(true);
      }
      gifTexturesRef.current = [];
      gifFrameRef.current = 0;
      gifTimerRef.current = 0;
      gifLastTimeRef.current = 0;

      cancelAnimationFrame(rafRef.current);

      const hasImage = !!image || !!gifData;
      const imgSize = SIZE;

      if (hasImage) {
        let sprite: PIXI.Sprite;

        if (gifData) {
          // Create textures from GIF frames
          const textures: PIXI.Texture[] = [];
          for (const frame of gifData.frames) {
            const canvas = document.createElement('canvas');
            canvas.width = gifData.width;
            canvas.height = gifData.height;
            const ctx = canvas.getContext('2d')!;
            ctx.putImageData(frame.imageData, 0, 0);
            const tex = PIXI.Texture.from(canvas);
            textures.push(tex);
          }
          gifTexturesRef.current = textures;

          sprite = new PIXI.Sprite(textures[0]);
          sprite.anchor.set(0.5);
          sprite.position.set(SIZE / 2, SIZE / 2);
          const scale = Math.max(imgSize / gifData.width, imgSize / gifData.height);
          sprite.scale.set(mirror.flipX ? -scale : scale, mirror.flipY ? -scale : scale);
        } else if (image) {
          const texture = PIXI.Texture.from(image);
          sprite = new PIXI.Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.position.set(SIZE / 2, SIZE / 2);
          const scale = Math.max(imgSize / image.width, imgSize / image.height);
          sprite.scale.set(mirror.flipX ? -scale : scale, mirror.flipY ? -scale : scale);
        } else {
          return;
        }

        // Create mask — inscribed circle or full rectangle
        const mask = new PIXI.Graphics();
        if (shape === 'circle') {
          mask.circle(SIZE / 2, SIZE / 2, SIZE / 2).fill({ color: 0xffffff });
        } else {
          mask.roundRect(0, 0, SIZE, SIZE, SQUARE_CORNER_RADIUS).fill({ color: 0xffffff });
        }
        app.stage.addChild(mask);
        maskRef.current = mask;

        sprite.mask = mask;
        app.stage.addChild(sprite);
        imageSpriteRef.current = sprite;
      }

      // Create glow layer (blurred, underneath) — soft light halo
      const glowGfx = new PIXI.Graphics();
      if (!NON_GLOW_EFFECTS.has(effect)) {
        glowGfx.blendMode = 'add';
        if (maskRef.current) glowGfx.mask = maskRef.current;
        const blurFilter = new PIXI.BlurFilter({ strength: 8, quality: 3 });
        glowGfx.filters = [blurFilter];
      }
      app.stage.addChild(glowGfx);
      glowGfxRef.current = glowGfx;

      // Create sharp effects layer (on top) — bright cores
      const effectsGfx = new PIXI.Graphics();
      effectsGfx.blendMode = NON_GLOW_EFFECTS.has(effect) ? 'normal' : 'add';
      if (maskRef.current) effectsGfx.mask = maskRef.current;
      app.stage.addChild(effectsGfx);
      effectsGfxRef.current = effectsGfx;

      // Setup engine
      const engine = engineRef.current;
      engine.clear();
      engine.setEffect(effect);
      engine.setShape(shape);
      engine.setParams(params);
      engine.setFixedDeltaMs(fixedDeltaMsRef.current);

      const renderCurrentFrame = () => {
        if (!(exportActiveRef.current && isRingEffect)) {
          engine.update(SIZE, SIZE, imgSize);
        }

        if (!NON_GLOW_EFFECTS.has(effect)) {
          engine.draw(glowGfx, SIZE, SIZE, imgSize);
        } else {
          glowGfx.clear();
        }
        engine.draw(effectsGfx, SIZE, SIZE, imgSize);
      };

      // Animation loop — draw to both glow (blurred) and sharp layers
      const tick = () => {
        if (destroyed) return;

        // GIF frame animation
        if (gifTexturesRef.current.length > 1 && gifData) {
          const now = performance.now();
          if (gifLastTimeRef.current === 0) gifLastTimeRef.current = now;
          const elapsed = now - gifLastTimeRef.current;
          gifLastTimeRef.current = now;
          gifTimerRef.current += elapsed;

          const currentFrame = gifData.frames[gifFrameRef.current];
          if (gifTimerRef.current >= currentFrame.delay) {
            gifTimerRef.current -= currentFrame.delay;
            gifFrameRef.current = (gifFrameRef.current + 1) % gifTexturesRef.current.length;
            if (imageSpriteRef.current) {
              imageSpriteRef.current.texture = gifTexturesRef.current[gifFrameRef.current];
            }
          }
        }

        renderCurrentFrame();
        rafRef.current = requestAnimationFrame(tick);
      };
      tickRef.current = tick;
      rafRef.current = requestAnimationFrame(tick);
    };

    setup();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafRef.current);
      // Clean up GIF textures
      for (const tex of gifTexturesRef.current) {
        tex.destroy(true);
      }
      gifTexturesRef.current = [];
      // Reset init flag so a subsequent mount can re-create the app
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      initRef.current = false;
    };
  }, [image, gifData, effect, shape, mirror, canvasRef]);

  // Live-update params (speed, density, intensity, colors) without restarting animation
  useEffect(() => {
    if (isRingEffect) {
      const ctx = ringCtxRef.current;
      const renderer = ringRendererRef.current;
      if (ctx && renderer) {
        const currentParams = paramsRef.current;
        const progress = getRingAnimationProgress(currentParams.speed, ringElapsedMsRef.current);
        renderer.render(ctx, currentParams, progress, ringElapsedMsRef.current);
      }
      return;
    }
    engineRef.current.setParams(params);
  }, [isRingEffect, params]);

  useEffect(() => {
    const canvas = canvasRef as React.MutableRefObject<HTMLCanvasElement | null> | null;
    if (!canvas?.current) return;
    const target = canvas.current as HTMLCanvasElement & {
      __avatarSetExportFrameStep?: (deltaMs: number | null) => void;
      __avatarSetRingLoopProgress?: (progress: number | null) => void;
      __avatarRenderFrame?: () => void;
      __avatarExtractFrame?: () => HTMLCanvasElement | null;
    };

    target.__avatarSetExportFrameStep = (deltaMs: number | null) => {
      fixedDeltaMsRef.current = deltaMs;
      exportActiveRef.current = deltaMs != null;
      if (!isRingEffect) {
        engineRef.current.setFixedDeltaMs(deltaMs);
      }
      if (isRingEffect) {
        if (deltaMs != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        } else if (!rafRef.current && tickRef.current) {
          rafRef.current = requestAnimationFrame(tickRef.current);
        }
      }
    };

    target.__avatarSetRingLoopProgress = (progress: number | null) => {
      if (isRingEffect) {
        if (progress == null) return;
        ringElapsedMsRef.current = progress * 2000;
        return;
      }
      engineRef.current.setRingLoopProgress(progress);
    };

    target.__avatarRenderFrame = () => {
      if (isRingEffect) {
        const ctx = ringCtxRef.current;
        const renderer = ringRendererRef.current;
        if (!ctx || !renderer) return;
        const currentParams = paramsRef.current;
        const progress = getRingAnimationProgress(currentParams.speed, ringElapsedMsRef.current);
        renderer.render(ctx, currentParams, progress, ringElapsedMsRef.current);
        return;
      }

      const glowGfx = glowGfxRef.current;
      const effectsGfx = effectsGfxRef.current;
      if (!glowGfx || !effectsGfx) return;

      if (!exportActiveRef.current || !isRingEffect) {
        engineRef.current.update(SIZE, SIZE, SIZE);
      }
      if (!NON_GLOW_EFFECTS.has(effect)) {
        engineRef.current.draw(glowGfx, SIZE, SIZE, SIZE);
      } else {
        glowGfx.clear();
      }
      engineRef.current.draw(effectsGfx, SIZE, SIZE, SIZE);
      appRef.current?.render();
    };

    target.__avatarExtractFrame = () => {
      if (isRingEffect) {
        return ringCanvasRef.current;
      }
      const app = appRef.current;
      if (!app) return null;
      const extracted = app.renderer.extract.pixels(app.stage);
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = extracted.width;
      frameCanvas.height = extracted.height;
      const ctx = frameCanvas.getContext('2d');
      if (!ctx) return null;
      const pixels = new Uint8ClampedArray(extracted.pixels);
      ctx.putImageData(new ImageData(pixels, extracted.width, extracted.height), 0, 0);
      return frameCanvas;
    };

    return () => {
      delete target.__avatarSetExportFrameStep;
      delete target.__avatarSetRingLoopProgress;
      delete target.__avatarRenderFrame;
      delete target.__avatarExtractFrame;
    };
  }, [canvasRef, effect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      for (const tex of gifTexturesRef.current) {
        tex.destroy(true);
      }
      gifTexturesRef.current = [];
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      ringCanvasRef.current = null;
      ringCtxRef.current = null;
      ringRendererRef.current = null;
      exportActiveRef.current = false;
      tickRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="preview-canvas"
    />
  );
};

export default PreviewCanvas;
