import {
  RING_LOOP_DURATION_MS,
  RING_LOOP_SPEED_BASELINE,
  SQUARE_CORNER_RADIUS,
} from './types';
import type { CropShape, EffectParams, EffectType, MirrorSettings } from './types';
import type { GifData } from '../lib/gif-decoder';

const RING_EFFECTS = new Set<EffectType>(['solidring', 'disc', 'googleone', 'duotone', 'blinkring', 'linxudo', 'bounce']);
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

type RingAnimationState = {
  phase: number;
  alpha: number;
  widthScale: number;
  pulse: number;
};

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

function getRingAnimationState(params: EffectParams, progress: number): RingAnimationState {
  if (params.ringAnimationMode === 'breathe') {
    const pulseProgress = wrapUnit(progress * 2);
    const pulse = 0.5 - 0.5 * Math.cos(pulseProgress * Math.PI * 2);
    return {
      phase: 0,
      alpha: pulse,
      widthScale: 0.88 + pulse * 0.22,
      pulse,
    };
  }

  const direction = params.direction === 'reverse' ? -1 : 1;
  return {
    phase: wrapUnit(progress * direction),
    alpha: 1,
    widthScale: 1,
    pulse: 0.5,
  };
}

function drawLinxuDo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  animation: RingAnimationState,
) {
  const radius = Math.min(width, height) / 2;
  const diameter = radius * 2;
  const bandHeight = diameter / 3;
  const scale = animation.alpha < 1 ? 0.9 + animation.pulse * 0.1 : 1;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  if (animation.phase) {
    ctx.rotate(animation.phase * Math.PI * 2);
  }
  ctx.scale(scale, scale);
  ctx.globalAlpha = animation.alpha;

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = '#000000';
  ctx.fillRect(-radius, -radius, diameter, bandHeight);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-radius, -radius + bandHeight, diameter, bandHeight);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(-radius, -radius + bandHeight * 2, diameter, bandHeight);
  ctx.restore();
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

function getBounceAxisPosition(progress: number) {
  const wrapped = wrapUnit(progress);
  return wrapped < 0.5 ? wrapped * 2 : (1 - wrapped) * 2;
}

type BounceTrajectoryFamily = 'pingpong' | 'orbit' | 'figure8';

type BounceTrajectoryPreset = {
  family: BounceTrajectoryFamily;
  xTurns: number;
  yTurns: number;
  xPhase: number;
  yPhase: number;
  xAmplitude: number;
  yAmplitude: number;
  mirrorX?: boolean;
  mirrorY?: boolean;
};

const BOUNCE_TRAJECTORIES: readonly BounceTrajectoryPreset[] = [
  { family: 'pingpong', xTurns: 1, yTurns: 2, xPhase: 0.125, yPhase: 0.375, xAmplitude: 1, yAmplitude: 1 },
  { family: 'pingpong', xTurns: 2, yTurns: 1, xPhase: 0.625, yPhase: 0.125, xAmplitude: 0.92, yAmplitude: 0.86, mirrorX: true },
  { family: 'orbit', xTurns: 1, yTurns: 1, xPhase: 0.25, yPhase: 0.0, xAmplitude: 0.82, yAmplitude: 0.82 },
  { family: 'figure8', xTurns: 1, yTurns: 2, xPhase: 0.0, yPhase: 0.125, xAmplitude: 0.94, yAmplitude: 0.66 },
  { family: 'orbit', xTurns: 2, yTurns: 3, xPhase: 0.125, yPhase: 0.375, xAmplitude: 0.76, yAmplitude: 0.64, mirrorY: true },
  { family: 'pingpong', xTurns: 3, yTurns: 2, xPhase: 0.375, yPhase: 0.625, xAmplitude: 0.84, yAmplitude: 1, mirrorY: true },
] as const;

function getSignedBounceAxis(progress: number) {
  return getBounceAxisPosition(progress) * 2 - 1;
}

function getBounceTrajectoryPoint(progress: number, index: number, count: number) {
  const spread = count <= 1 ? 0 : index / count;
  const preset = BOUNCE_TRAJECTORIES[index % BOUNCE_TRAJECTORIES.length];
  const variantCycle = Math.floor(index / BOUNCE_TRAJECTORIES.length);
  const xTurns = preset.xTurns + (variantCycle % 2);
  const yTurns = preset.yTurns + ((variantCycle + 1) % 2);
  const xPhase = preset.xPhase + spread * 0.5 + variantCycle * 0.125;
  const yPhase = preset.yPhase + spread * 0.75 + variantCycle * 0.25;

  let x = 0;
  let y = 0;

  if (preset.family === 'pingpong') {
    x = getSignedBounceAxis(progress * xTurns + xPhase) * preset.xAmplitude;
    y = getSignedBounceAxis(progress * yTurns + yPhase) * preset.yAmplitude;
  } else if (preset.family === 'orbit') {
    x = Math.cos((progress * xTurns + xPhase) * Math.PI * 2) * preset.xAmplitude;
    y = Math.sin((progress * yTurns + yPhase) * Math.PI * 2) * preset.yAmplitude;
  } else {
    x = Math.sin((progress * xTurns + xPhase) * Math.PI * 2) * preset.xAmplitude;
    y = Math.sin((progress * yTurns + yPhase) * Math.PI * 2) * preset.yAmplitude;
  }

  if (preset.mirrorX) x *= -1;
  if (preset.mirrorY) y *= -1;

  return { x, y };
}

function getBounceCenter(
  shape: CropShape,
  width: number,
  height: number,
  progress: number,
  avatarRadius: number,
  index: number,
  count: number,
) {
  const point = getBounceTrajectoryPoint(progress, index, count);
  const xUnit = (point.x + 1) / 2;
  const yUnit = (point.y + 1) / 2;

  if (shape === 'square') {
    const minX = avatarRadius;
    const maxX = width - avatarRadius;
    const minY = avatarRadius;
    const maxY = height - avatarRadius;
    return {
      x: minX + (maxX - minX) * xUnit,
      y: minY + (maxY - minY) * yUnit,
    };
  }

  const cx = width / 2;
  const cy = height / 2;
  const travelRadius = Math.max(Math.min(width, height) / 2 - avatarRadius, 0);
  let offsetX = point.x * travelRadius;
  let offsetY = point.y * travelRadius;
  const offsetLength = Math.hypot(offsetX, offsetY);

  if (offsetLength > travelRadius && offsetLength > 0) {
    const clampScale = travelRadius / offsetLength;
    offsetX *= clampScale;
    offsetY *= clampScale;
  }

  return {
    x: cx + offsetX,
    y: cy + offsetY,
  };
}

function drawBounceAvatar(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  params: EffectParams,
  mirror: MirrorSettings,
  shape: CropShape,
  width: number,
  height: number,
  progress: number,
) {
  const clampedSize = Math.max(1, Math.min(params.size, 100));
  const count = Math.max(1, Math.min(Math.round(params.count), 12));
  const densityScale = count > 1 ? Math.max(0.34, 1 - (count - 1) * 0.08) : 1;
  const avatarDiameter = Math.min(width, height) * (clampedSize / 100) * densityScale;
  const avatarRadius = avatarDiameter / 2;

  ctx.save();
  clipShapePath(ctx, shape, width, height);
  ctx.clip();

  for (let index = 0; index < count; index++) {
    const center = getBounceCenter(shape, width, height, progress, avatarRadius, index, count);
    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.translate(center.x - avatarRadius, center.y - avatarRadius);
    drawCoveredSource(ctx, source, sourceWidth, sourceHeight, mirror, avatarDiameter, avatarDiameter);
    ctx.restore();
  }
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

      if (effect === 'bounce') {
        if (!hasSource) {
          return;
        }
        if (gifSource && gifFrameCanvas && gifFrameCtx) {
          const frame = gifSource.frames[getGifFrameIndexAtTime(gifSource, elapsedMs)];
          gifFrameCtx.clearRect(0, 0, gifFrameCanvas.width, gifFrameCanvas.height);
          gifFrameCtx.putImageData(frame.imageData, 0, 0);
          drawBounceAvatar(ctx, gifFrameCanvas, gifSource.width, gifSource.height, params, mirror, shape, width, height, progress);
        } else if (image) {
          drawBounceAvatar(ctx, image, image.width, image.height, params, mirror, shape, width, height, progress);
        }
        return;
      }

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

      const animation = getRingAnimationState(params, progress);
      if (effect === 'linxudo') {
        drawLinxuDo(ctx, width, height, animation);
        return;
      }

      const ringWidthBase = effect === 'solidring'
        ? 4 + (params.intensity / 100) * 36
        : effect === 'disc'
          ? 15 + (params.intensity / 100) * 35
          : effect === 'duotone' || effect === 'blinkring'
            ? 10 + (params.intensity / 100) * 34
            : 28 + (params.intensity / 100) * 24;
      const ringWidth = ringWidthBase * animation.widthScale;

      const paint = createRingPaint(ctx, effect, params, animation.phase, width, height);
      appendRingPath(ctx, shape, width, height, ringWidth);
      ctx.save();
      ctx.globalAlpha = animation.alpha;
      ctx.fillStyle = paint;
      ctx.fill(shape === 'square' ? 'evenodd' : undefined);
      ctx.restore();
    },
  };
}
