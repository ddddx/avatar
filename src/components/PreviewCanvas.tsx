import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { ParticleEngine } from '../effects/engine';
import { SQUARE_CORNER_RADIUS } from '../effects/types';
import type { EffectType, CropShape, EffectParams } from '../effects/types';
import type { GifData } from '../lib/gif-decoder';

interface Props {
  image: HTMLImageElement | null;
  gifData: GifData | null;
  effect: EffectType;
  shape: CropShape;
  params: EffectParams;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const SIZE = 512;

const PreviewCanvas: React.FC<Props> = ({ image, gifData, effect, shape, params, canvasRef }) => {
  const noImageMode = !image && !gifData;
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const engineRef = useRef(new ParticleEngine());
  const imageSpriteRef = useRef<PIXI.Sprite | null>(null);
  const maskRef = useRef<PIXI.Graphics | null>(null);
  const effectsGfxRef = useRef<PIXI.Graphics | null>(null);
  const glowGfxRef = useRef<PIXI.Graphics | null>(null);
  const rafRef = useRef<number>(0);
  const initRef = useRef(false);
  // GIF animation state
  const gifTexturesRef = useRef<PIXI.Texture[]>([]);
  const gifFrameRef = useRef(0);
  const gifTimerRef = useRef(0);
  const gifLastTimeRef = useRef(0);

  // Single init + animation effect
  useEffect(() => {
    let destroyed = false;

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
          sprite.scale.set(scale);
        } else if (image) {
          const texture = PIXI.Texture.from(image);
          sprite = new PIXI.Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.position.set(SIZE / 2, SIZE / 2);
          const scale = Math.max(imgSize / image.width, imgSize / image.height);
          sprite.scale.set(scale);
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
      if (effect !== 'solidring') {
        glowGfx.blendMode = 'add';
        if (maskRef.current) glowGfx.mask = maskRef.current;
        const blurFilter = new PIXI.BlurFilter({ strength: 8, quality: 3 });
        glowGfx.filters = [blurFilter];
      }
      app.stage.addChild(glowGfx);
      glowGfxRef.current = glowGfx;

      // Create sharp effects layer (on top) — bright cores
      const effectsGfx = new PIXI.Graphics();
      effectsGfx.blendMode = 'add';
      if (maskRef.current) effectsGfx.mask = maskRef.current;
      app.stage.addChild(effectsGfx);
      effectsGfxRef.current = effectsGfx;

      // Setup engine
      const engine = engineRef.current;
      engine.clear();
      engine.setEffect(effect);
      engine.setShape(shape);
      engine.setParams(params);

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

        engine.update(SIZE, SIZE, imgSize);
        // For ring/solidring, skip glow layer to avoid additive double-draw
        // that washes out the rainbow colors to white
        if (effect !== 'solidring') {
          engine.draw(glowGfx, SIZE, SIZE, imgSize);   // blurred glow
        } else {
          glowGfx.clear();
        }
        engine.draw(effectsGfx, SIZE, SIZE, imgSize); // sharp cores
        rafRef.current = requestAnimationFrame(tick);
      };
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
  }, [image, gifData, effect, shape, canvasRef]);

  // Live-update params (speed, density, intensity, colors) without restarting animation
  useEffect(() => {
    engineRef.current.setParams(params);
  }, [params]);

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
