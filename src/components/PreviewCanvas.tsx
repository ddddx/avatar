import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { ParticleEngine } from '../effects/engine';
import type { EffectType, CropShape, EffectParams } from '../effects/types';

interface Props {
  image: HTMLImageElement | null;
  effect: EffectType;
  shape: CropShape;
  params: EffectParams;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const SIZE = 512;

const PreviewCanvas: React.FC<Props> = ({ image, effect, shape, params, canvasRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const engineRef = useRef(new ParticleEngine());
  const imageSpriteRef = useRef<PIXI.Sprite | null>(null);
  const maskRef = useRef<PIXI.Graphics | null>(null);
  const effectsGfxRef = useRef<PIXI.Graphics | null>(null);
  const rafRef = useRef<number>(0);
  const initRef = useRef(false);

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
          background: 0x0a0a0f,
          antialias: true,
          resolution: 1,
          preserveDrawingBuffer: true,
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

      cancelAnimationFrame(rafRef.current);

      // If no image, just show empty canvas
      if (!image) return;

      // imgSize = the avatar area (effects draw along its edge)
      const imgSize = SIZE;
      const texture = PIXI.Texture.from(image);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.position.set(SIZE / 2, SIZE / 2);
      const scale = Math.max(imgSize / image.width, imgSize / image.height);
      sprite.scale.set(scale);

      // Create mask — inscribed circle or full rectangle
      const mask = new PIXI.Graphics();
      if (shape === 'circle') {
        mask.circle(SIZE / 2, SIZE / 2, SIZE / 2).fill({ color: 0xffffff });
      } else {
        mask.rect(0, 0, SIZE, SIZE).fill({ color: 0xffffff });
      }
      app.stage.addChild(mask);
      maskRef.current = mask;

      sprite.mask = mask;
      app.stage.addChild(sprite);
      imageSpriteRef.current = sprite;

      // Create effects layer — same mask clips effects to the shape
      const effectsGfx = new PIXI.Graphics();
      effectsGfx.blendMode = 'add';
      effectsGfx.mask = mask;
      app.stage.addChild(effectsGfx);
      effectsGfxRef.current = effectsGfx;

      // Setup engine
      const engine = engineRef.current;
      engine.clear();
      engine.setEffect(effect);
      engine.setShape(shape);
      engine.setParams(params);

      // Animation loop
      const tick = () => {
        if (destroyed) return;
        engine.update(SIZE, SIZE, imgSize);
        engine.draw(effectsGfx, SIZE, SIZE, imgSize);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    setup();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafRef.current);
      // Reset init flag so a subsequent mount can re-create the app
      // (handles React strict mode double-mount)
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      initRef.current = false;
    };
  }, [image, effect, shape, params, canvasRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
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
      style={{
        width: SIZE,
        maxWidth: '100%',
        aspectRatio: '1 / 1',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
};

export default PreviewCanvas;
