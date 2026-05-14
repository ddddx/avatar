import {
  RING_LOOP_DURATION_MS,
  RING_LOOP_SPEED_BASELINE,
  SQUARE_CORNER_RADIUS,
} from './types';
import type { CropShape, EffectParams, EffectType, MirrorSettings } from './types';
import type { GifData } from '../lib/gif-decoder';

const RING_EFFECTS = new Set<EffectType>(['solidring', 'disc', 'googleone', 'duotone', 'blinkring']);
const SOLID_RING_COLORS = ['#ff0040', '#ff8000', '#00ff80', '#00b0ff', '#ff0040'];
const DISC_COLORS = ['#ff0040', '#ff8000', '#ffe000', '#00ff80', '#00b0ff', '#a040ff', '#ff0040'];
const GOOGLE_ONE_SEGMENTS = [
  { color: '#EA4335', degrees: 105 },
  { color: '#4285F4', degrees: 105 },
  { color: '#34A853', degrees: 105 },
  { color: '#FBBC05', degrees: 45 },
] as const;
const SMOOTH_GRADIENT_SAMPLES = 256;

export function isRingEffect(effect: EffectType) {
  return RING_EFFECTS.has(effect);
}

export function getRingAnimationProgress(speed: number, elapsedMs: number) {
  const turnsPerLoop = speed / RING_LOOP_SPEED_BASELINE;
  return wrapUnit((elapsedMs / RING_LOOP_DURATION_MS) * turnsPerLoop);
}

function wrapUnit(value: number) {
  return ((value % 1) + 1) % 1;
}

function traceRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function clipShapePath(ctx: CanvasRenderingContext2D, shape: CropShape, width: number, height: number) {
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }

  traceRoundedRectPath(ctx, 0, 0, width, height, SQUARE_CORNER_RADIUS);
}

function appendRingPath(
  ctx: CanvasRenderingContext2D,
  shape: CropShape,
  width: number,
  height: number,
  ringWidth: number,
) {
  if (shape === 'circle') {
    const radius = Math.min(width, height) / 2;
    const innerRadius = Math.max(radius - ringWidth, 0);
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.arc(width / 2, height / 2, innerRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    return;
  }

  const inset = Math.max(0, Math.min(ringWidth, Math.min(width, height) / 2));
  const innerWidth = Math.max(width - inset * 2, 0);
  const innerHeight = Math.max(height - inset * 2, 0);
  const innerRadius = Math.max(SQUARE_CORNER_RADIUS - inset, 0);

  traceRoundedRectPath(ctx, 0, 0, width, height, SQUARE_CORNER_RADIUS);
  traceRoundedRectPath(ctx, inset, inset, innerWidth, innerHeight, innerRadius);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function lerpHexColor(a: string, b: string, t: number) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const bValue = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r}, ${g}, ${bValue})`;
}

function addSampledPaletteStops(gradient: CanvasGradient, colors: readonly string[]) {
  const paletteSpan = colors.length - 1;
  for (let i = 0; i <= SMOOTH_GRADIENT_SAMPLES; i++) {
    const t = i / SMOOTH_GRADIENT_SAMPLES;
    const scaled = t * paletteSpan;
    const index = Math.floor(scaled);
    const blend = scaled - index;
    const color = lerpHexColor(
      colors[index],
      colors[Math.min(index + 1, paletteSpan)],
      blend,
    );
    gradient.addColorStop(t, color);
  }
}

function getDuotoneSegmentCount(density: number) {
  const pairCount = Math.max(1, Math.round(1 + (density / 100) * 23));
  return pairCount * 2;
}

function createRingPaint(
  ctx: CanvasRenderingContext2D,
  effect: EffectType,
  params: EffectParams,
  phase: number,
  width: number,
  height: number,
) : string | CanvasGradient {
  if (effect === 'blinkring') {
    return phase < 0.5 ? params.color : params.secondaryColor;
  }

  const gradient = ctx.createConicGradient(phase * Math.PI * 2, width / 2, height / 2);

  if (effect === 'solidring') {
    addSampledPaletteStops(gradient, SOLID_RING_COLORS);
    return gradient;
  }

  if (effect === 'disc') {
    addSampledPaletteStops(gradient, DISC_COLORS);
    return gradient;
  }

  if (effect === 'duotone') {
    const segmentCount = getDuotoneSegmentCount(params.density);
    for (let i = 0; i < segmentCount; i++) {
      const start = i / segmentCount;
      const end = (i + 1) / segmentCount;
      const color = i % 2 === 0 ? params.color : params.secondaryColor;
      gradient.addColorStop(start, color);
      gradient.addColorStop(end, color);
    }
    gradient.addColorStop(0, params.color);
    gradient.addColorStop(1, params.secondaryColor);
    return gradient;
  }

  let cursor = 0;
  for (const segment of GOOGLE_ONE_SEGMENTS) {
    const start = cursor;
    const end = cursor + segment.degrees / 360;
    gradient.addColorStop(start, segment.color);
    gradient.addColorStop(end, segment.color);
    cursor = end;
  }
  gradient.addColorStop(0, GOOGLE_ONE_SEGMENTS[0].color);
  gradient.addColorStop(1, GOOGLE_ONE_SEGMENTS[GOOGLE_ONE_SEGMENTS.length - 1].color);
  return gradient;
}

function getGifFrameIndexAtTime(data: GifData, elapsedMs: number) {
  if (!data.frames.length) return 0;
  const totalDuration = data.frames.reduce((sum, frame) => sum + frame.delay, 0);
  if (totalDuration <= 0) return 0;

  let cursor = ((elapsedMs % totalDuration) + totalDuration) % totalDuration;
  for (let i = 0; i < data.frames.length; i++) {
    if (cursor < data.frames[i].delay) {
      return i;
    }
    cursor -= data.frames[i].delay;
  }

  return data.frames.length - 1;
}

function drawCoveredSource(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  mirror: MirrorSettings,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  ctx.save();
  ctx.translate(targetWidth / 2, targetHeight / 2);
  ctx.scale(mirror.flipX ? -1 : 1, mirror.flipY ? -1 : 1);
  ctx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

type RingRendererOptions = {
  width: number;
  height: number;
  image: HTMLImageElement | null;
  gifData: GifData | null;
  effect: EffectType;
  shape: CropShape;
  mirror: MirrorSettings;
};

export function createRingRenderer({
  width,
  height,
  image,
  gifData,
  effect,
  shape,
  mirror,
}: RingRendererOptions) {
  const gifSource = gifData;
  const gifFrameCanvas = gifSource ? document.createElement('canvas') : null;
  const gifFrameCtx = gifFrameCanvas?.getContext('2d') ?? null;
  if (gifSource && gifFrameCanvas && gifFrameCtx) {
    gifFrameCanvas.width = gifSource.width;
    gifFrameCanvas.height = gifSource.height;
  }

  const hasSource = !!image || !!gifSource;

  return {
    render(ctx: CanvasRenderingContext2D, params: EffectParams, progress: number, elapsedMs: number) {
      ctx.clearRect(0, 0, width, height);

      if (hasSource) {
        ctx.save();
        clipShapePath(ctx, shape, width, height);
        ctx.clip();

        if (gifSource && gifFrameCanvas && gifFrameCtx) {
          const frame = gifSource.frames[getGifFrameIndexAtTime(gifSource, elapsedMs)];
          gifFrameCtx.clearRect(0, 0, gifFrameCanvas.width, gifFrameCanvas.height);
          gifFrameCtx.putImageData(frame.imageData, 0, 0);
          drawCoveredSource(ctx, gifFrameCanvas, gifSource.width, gifSource.height, mirror, width, height);
        } else if (image) {
          drawCoveredSource(ctx, image, image.width, image.height, mirror, width, height);
        }

        ctx.restore();
      }

      const direction = params.direction === 'reverse' ? -1 : 1;
      const phase = wrapUnit(progress * direction);
      const ringWidth = effect === 'solidring'
        ? 4 + (params.intensity / 100) * 36
        : effect === 'disc'
          ? 15 + (params.intensity / 100) * 35
          : effect === 'duotone' || effect === 'blinkring'
            ? 10 + (params.intensity / 100) * 34
            : 28 + (params.intensity / 100) * 24;

      const paint = createRingPaint(ctx, effect, params, phase, width, height);
      appendRingPath(ctx, shape, width, height, ringWidth);
      ctx.fillStyle = paint;
      ctx.fill(shape === 'square' ? 'evenodd' : undefined);
    },
  };
}
