import {
  RING_LOOP_DURATION_MS,
  RING_LOOP_SPEED_BASELINE,
  SQUARE_CORNER_RADIUS,
} from './types';
import type { CropShape, EffectParams, EffectType, MirrorSettings } from './types';
import type { GifData } from '../lib/gif-decoder';

const RING_EFFECTS = new Set<EffectType>(['solidring', 'disc', 'googleone', 'duotone', 'blinkring', 'linxudo', 'bounce', 'collapsequad', 'axisrings', 'loader', 'spinner', 'neoncomet', 'equalizer', 'magiccircle', 'cyberhud', 'crtglitch', 'portal', 'kaleidoscope']);
const SOLID_RING_COLORS = ['#ff0040', '#ff8000', '#00ff80', '#00b0ff', '#ff0040'];
const DISC_COLORS = ['#ff0040', '#ff8000', '#ffe000', '#00ff80', '#00b0ff', '#a040ff', '#ff0040'];
const COLLAPSE_QUAD_COLORS = ['#EA4335', '#4285F4', '#34A853', '#FBBC05'] as const;
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

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
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

function getSquareTrackCornerRadius(outerHalf: number, half: number) {
  const inset = outerHalf - half;
  if (inset <= 0) return SQUARE_CORNER_RADIUS + Math.abs(inset);
  return Math.max(Math.min(SQUARE_CORNER_RADIUS - inset, half), 0);
}

function getRoundRectTrackPoint(cx: number, cy: number, half: number, radius: number, t: number) {
  const r = Math.min(radius, half);
  const edgeLen = half * 2 - r * 2;
  const arcLen = (Math.PI / 2) * r;
  const totalPerim = 4 * edgeLen + 4 * arcLen;
  let d = wrapUnit(t) * totalPerim;

  if (d < edgeLen) return { x: cx - half + r + d, y: cy - half };
  d -= edgeLen;
  if (d < arcLen) {
    const a = -Math.PI / 2 + d / r;
    return { x: cx + half - r + Math.cos(a) * r, y: cy - half + r + Math.sin(a) * r };
  }
  d -= arcLen;
  if (d < edgeLen) return { x: cx + half, y: cy - half + r + d };
  d -= edgeLen;
  if (d < arcLen) {
    const a = d / r;
    return { x: cx + half - r + Math.cos(a) * r, y: cy + half - r + Math.sin(a) * r };
  }
  d -= arcLen;
  if (d < edgeLen) return { x: cx + half - r - d, y: cy + half };
  d -= edgeLen;
  if (d < arcLen) {
    const a = Math.PI / 2 + d / r;
    return { x: cx - half + r + Math.cos(a) * r, y: cy + half - r + Math.sin(a) * r };
  }
  d -= arcLen;
  if (d < edgeLen) return { x: cx - half, y: cy + half - r - d };
  d -= edgeLen;
  if (d < arcLen) {
    const a = Math.PI + d / r;
    return { x: cx - half + r + Math.cos(a) * r, y: cy - half + r + Math.sin(a) * r };
  }

  return { x: cx - half + r, y: cy - half };
}

function traceRoundRectTrackSegment(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  half: number,
  radius: number,
  startT: number,
  endT: number,
) {
  const from = wrapUnit(startT);
  let to = endT;
  while (to < from) to += 1;
  const steps = Math.max(5, Math.ceil((to - from) * 120));
  const first = getRoundRectTrackPoint(cx, cy, half, radius, from);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    const point = getRoundRectTrackPoint(cx, cy, half, radius, t);
    ctx.lineTo(point.x, point.y);
  }
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

function rgbaHexColor(hex: string, alpha: number) {
  const color = hexToRgb(hex);
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clampNumber(alpha, 0, 1)})`;
}

function shadeHexColor(hex: string, amount: number) {
  const base = hexToRgb(hex);
  const shade = clampNumber(amount, -1, 1);
  const target = shade >= 0 ? 255 : 0;
  const t = Math.abs(shade);
  const r = Math.round(base.r + (target - base.r) * t);
  const g = Math.round(base.g + (target - base.g) * t);
  const b = Math.round(base.b + (target - base.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
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

function fillCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillStyle: string | CanvasGradient | CanvasPattern,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function pseudoRandom(index: number, seed = 0) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getDirectedProgress(params: EffectParams, progress: number) {
  return wrapUnit(progress * (params.direction === 'reverse' ? -1 : 1));
}

function getTrackSample(
  shape: CropShape,
  cx: number,
  cy: number,
  outerHalf: number,
  half: number,
  t: number,
) {
  if (shape === 'circle') {
    const angle = wrapUnit(t) * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    return {
      x: cx + nx * half,
      y: cy + ny * half,
      nx,
      ny,
    };
  }

  const cornerRadius = getSquareTrackCornerRadius(outerHalf, half);
  const point = getRoundRectTrackPoint(cx, cy, half, cornerRadius, t);
  const prev = getRoundRectTrackPoint(cx, cy, half, cornerRadius, t - 0.0015);
  const next = getRoundRectTrackPoint(cx, cy, half, cornerRadius, t + 0.0015);
  const tx = next.x - prev.x;
  const ty = next.y - prev.y;
  const length = Math.hypot(tx, ty) || 1;

  return {
    x: point.x,
    y: point.y,
    nx: ty / length,
    ny: -tx / length,
  };
}

function strokeTrackSegment(
  ctx: CanvasRenderingContext2D,
  shape: CropShape,
  cx: number,
  cy: number,
  outerHalf: number,
  half: number,
  startT: number,
  endT: number,
) {
  if (shape === 'circle') {
    const from = wrapUnit(startT);
    let to = endT;
    while (to < from) to += 1;
    ctx.arc(cx, cy, half, from * Math.PI * 2, to * Math.PI * 2);
    return;
  }

  const cornerRadius = getSquareTrackCornerRadius(outerHalf, half);
  traceRoundRectTrackSegment(ctx, cx, cy, half, cornerRadius, startT, endT);
}

function strokeShapeTrack(
  ctx: CanvasRenderingContext2D,
  shape: CropShape,
  cx: number,
  cy: number,
  outerHalf: number,
  half: number,
) {
  if (shape === 'circle') {
    ctx.arc(cx, cy, half, 0, Math.PI * 2);
    return;
  }

  const cornerRadius = getSquareTrackCornerRadius(outerHalf, half);
  traceRoundedRectPath(ctx, cx - half, cy - half, half * 2, half * 2, cornerRadius);
}

function traceRegularPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotation: number,
) {
  for (let i = 0; i <= sides; i++) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
}

function drawCollapseQuadRing(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: EffectParams,
  animation: RingAnimationState,
  progress: number,
) {
  const radius = Math.min(width, height) / 2;
  const ringWidthBase = 8 + (Math.max(1, Math.min(params.ringWidth, 100)) / 100) * 52;
  const ringWidth = ringWidthBase * animation.widthScale;
  const arcRadius = radius - ringWidth / 2;
  const collapse = 0.5 - 0.5 * Math.cos(wrapUnit(progress) * Math.PI * 2);
  const segmentRatio = 1 - collapse;
  const baseSegmentSpan = (Math.PI * 2) / 4;
  const baseAngle = -Math.PI / 2 + animation.phase * Math.PI * 2;
  const capRadius = ringWidth / 2;
  const pointOnlyThreshold = 0.035;

  ctx.save();
  ctx.lineWidth = ringWidth;
  ctx.lineCap = 'round';
  ctx.globalAlpha = animation.alpha;

  for (let index = 0; index < COLLAPSE_QUAD_COLORS.length; index++) {
    const color = COLLAPSE_QUAD_COLORS[index];
    const segmentCenter = baseAngle + index * baseSegmentSpan + baseSegmentSpan / 2;
    const pointX = width / 2 + Math.cos(segmentCenter) * arcRadius;
    const pointY = height / 2 + Math.sin(segmentCenter) * arcRadius;

    if (segmentRatio <= pointOnlyThreshold) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pointX, pointY, capRadius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const currentSpan = baseSegmentSpan * segmentRatio;
    const startAngle = segmentCenter - currentSpan / 2;
    const endAngle = segmentCenter + currentSpan / 2;

    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, arcRadius, startAngle, endAngle);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLoader(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: CropShape,
  params: EffectParams,
  progress: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const intensity = params.intensity / 100;
  const dotCount = Math.max(3, Math.round(3 + params.density * 0.06));
  const orbitRadius = size * (0.2 + intensity * 0.1);
  const outerHalf = size / 2;
  const orbitHalf = Math.max(Math.min(orbitRadius, outerHalf - 12), 8);
  const phase = wrapUnit(progress) * Math.PI * 2;

  ctx.save();
  clipShapePath(ctx, shape, width, height);
  ctx.clip();

  const centerAlpha = 0.035 + intensity * 0.08 + 0.025 * Math.sin(phase * 2);
  fillCircle(ctx, cx, cy, size * 0.08, rgbaHexColor(params.color, centerAlpha));

  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(cx, cy, orbitRadius, 0, Math.PI * 2);
    ctx.strokeStyle = rgbaHexColor(params.color, 0.05 + intensity * 0.08);
    ctx.lineWidth = 0.8 + intensity * 1.2;
    ctx.stroke();
  } else {
    const cornerRadius = getSquareTrackCornerRadius(outerHalf, orbitHalf);
    traceRoundedRectPath(ctx, cx - orbitHalf, cy - orbitHalf, orbitHalf * 2, orbitHalf * 2, cornerRadius);
    ctx.strokeStyle = rgbaHexColor(params.color, 0.05 + intensity * 0.08);
    ctx.lineWidth = 0.8 + intensity * 1.2;
    ctx.stroke();
  }

  for (let index = 0; index < dotCount; index++) {
    const dotPhase = phase - (index / dotCount) * Math.PI * 0.5;
    const eased = dotPhase + Math.sin(dotPhase * 2) * 0.3;
    const color = index === 0 ? params.color : params.secondaryColor;
    const pulse = 0.7 + 0.3 * Math.sin(phase * 2 + index);
    const dotSize = (2 + intensity * 3 + Math.sin(index) * 1.2) * pulse;
    const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(phase + index * 0.8));
    let x: number;
    let y: number;

    if (shape === 'circle') {
      x = cx + Math.cos(eased) * orbitRadius;
      y = cy + Math.sin(eased) * orbitRadius;
    } else {
      const trackT = wrapUnit(eased / (Math.PI * 2));
      const cornerRadius = getSquareTrackCornerRadius(outerHalf, orbitHalf);
      const point = getRoundRectTrackPoint(cx, cy, orbitHalf, cornerRadius, trackT);
      x = point.x;
      y = point.y;
    }

    fillCircle(ctx, x, y, dotSize * 3, rgbaHexColor(color, alpha * 0.12));
    fillCircle(ctx, x, y, dotSize, rgbaHexColor(color, alpha));
    fillCircle(ctx, x, y, dotSize * 0.4, `rgba(255, 255, 255, ${alpha * 0.7})`);
  }

  ctx.restore();
}

function drawSpinner(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: CropShape,
  params: EffectParams,
  progress: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const outerHalf = size / 2;
  const radius = size * 0.28;
  const strokeWidth = 6 + (params.intensity / 100) * 20;
  const minArc = 0.14;
  const maxArc = 0.4;
  const phase = wrapUnit(progress);
  const pulse = (Math.sin(phase * Math.PI * 2) + 1) / 2;
  const arcLen = minArc + (maxArc - minArc) * pulse;
  const startT = phase - arcLen * 0.82;
  const endT = phase + arcLen * 0.18;

  ctx.save();
  clipShapePath(ctx, shape, width, height);
  ctx.clip();
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';

  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  } else {
    const half = Math.max(Math.min(radius, outerHalf - strokeWidth), 10);
    const cornerRadius = getSquareTrackCornerRadius(outerHalf, half);
    traceRoundedRectPath(ctx, cx - half, cy - half, half * 2, half * 2, cornerRadius);
  }
  ctx.strokeStyle = rgbaHexColor(params.secondaryColor, 0.12 + (params.intensity / 100) * 0.16);
  ctx.lineWidth = Math.max(2, strokeWidth * 0.38);
  ctx.stroke();

  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = rgbaHexColor(params.color, 0.98);

  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(cx, cy, radius, startT * Math.PI * 2, endT * Math.PI * 2);
  } else {
    const half = Math.max(Math.min(radius, outerHalf - strokeWidth), 10);
    const cornerRadius = getSquareTrackCornerRadius(outerHalf, half);
    traceRoundRectTrackSegment(ctx, cx, cy, half, cornerRadius, startT, endT);
  }
  ctx.stroke();
  ctx.restore();
}

function drawNeonComet(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: CropShape,
  params: EffectParams,
  progress: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const outerHalf = size / 2;
  const ringWidth = 8 + (Math.max(1, Math.min(params.ringWidth, 100)) / 100) * 34;
  const trackHalf = Math.max(outerHalf - ringWidth / 2 - 2, 8);
  const phase = getDirectedProgress(params, progress);
  const cometCount = Math.max(2, Math.round(2 + (params.density / 100) * 5));
  const tailSteps = 22;
  const tailLength = 0.08 + (params.intensity / 100) * 0.12;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  strokeShapeTrack(ctx, shape, cx, cy, outerHalf, trackHalf);
  ctx.strokeStyle = rgbaHexColor(params.color, 0.16);
  ctx.lineWidth = Math.max(2, ringWidth * 0.16);
  ctx.stroke();

  for (let comet = 0; comet < cometCount; comet++) {
    const head = phase + comet / cometCount;
    const color = comet % 2 === 0 ? params.color : params.secondaryColor;

    for (let step = tailSteps; step >= 0; step--) {
      const a = step / tailSteps;
      const t1 = head - tailLength * a;
      const t2 = head - tailLength * Math.max(0, a - 1 / tailSteps);
      const alpha = (1 - a) ** 1.6 * (0.16 + params.intensity / 220);
      ctx.beginPath();
      strokeTrackSegment(ctx, shape, cx, cy, outerHalf, trackHalf, t1, t2);
      ctx.strokeStyle = rgbaHexColor(color, alpha);
      ctx.lineWidth = ringWidth * (0.18 + (1 - a) * 0.42);
      ctx.stroke();
    }

    const headPoint = getTrackSample(shape, cx, cy, outerHalf, trackHalf, head);
    const headSize = ringWidth * 0.22 + (params.intensity / 100) * 5;
    fillCircle(ctx, headPoint.x, headPoint.y, headSize * 2.4, rgbaHexColor(color, 0.16));
    fillCircle(ctx, headPoint.x, headPoint.y, headSize, rgbaHexColor(color, 0.86));
    fillCircle(ctx, headPoint.x, headPoint.y, headSize * 0.38, 'rgba(255, 255, 255, 0.92)');
  }

  ctx.restore();
}

function drawEqualizer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: CropShape,
  params: EffectParams,
  progress: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const outerHalf = size / 2;
  const ringWidth = 8 + (Math.max(1, Math.min(params.ringWidth, 100)) / 100) * 32;
  const baseHalf = Math.max(outerHalf - ringWidth - 6, 10);
  const phase = getDirectedProgress(params, progress) * Math.PI * 2;
  const barCount = Math.max(28, Math.round(32 + params.density * 0.72));
  const maxBar = 10 + (params.intensity / 100) * 54;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  ctx.beginPath();
  strokeShapeTrack(ctx, shape, cx, cy, outerHalf, baseHalf);
  ctx.strokeStyle = rgbaHexColor(params.secondaryColor, 0.16);
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let i = 0; i < barCount; i++) {
    const t = i / barCount;
    const beat =
      0.42 +
      0.28 * Math.sin(phase * 2 + i * 0.62) +
      0.2 * Math.sin(phase * 3 - i * 0.37) +
      0.1 * Math.sin(phase + i * 1.91);
    const level = clampNumber(beat, 0.08, 1);
    const length = 5 + maxBar * level;
    const start = getTrackSample(shape, cx, cy, outerHalf, baseHalf, t);
    const end = {
      x: start.x + start.nx * length,
      y: start.y + start.ny * length,
    };
    const colorBlend = 0.5 + 0.5 * Math.sin(phase + i * 0.2);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = colorBlend > 0.52
      ? rgbaHexColor(params.color, 0.4 + level * 0.48)
      : rgbaHexColor(params.secondaryColor, 0.36 + level * 0.42);
    ctx.lineWidth = Math.max(2, ringWidth * 0.08 + level * ringWidth * 0.08);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMagicCircle(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: CropShape,
  params: EffectParams,
  progress: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const outerHalf = size / 2;
  const phase = getDirectedProgress(params, progress);
  const rotation = phase * Math.PI * 2;
  const intensity = params.intensity / 100;
  const ringWidth = 6 + (Math.max(1, Math.min(params.ringWidth, 100)) / 100) * 24;
  const radius = outerHalf - ringWidth * 1.7;
  const glyphCount = Math.max(12, Math.round(12 + params.density * 0.32));

  ctx.save();
  clipShapePath(ctx, shape, width, height);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let ring = 0; ring < 3; ring++) {
    const half = Math.max(radius - ring * ringWidth * 1.15, 12);
    ctx.beginPath();
    strokeShapeTrack(ctx, shape, cx, cy, outerHalf, half);
    ctx.strokeStyle = rgbaHexColor(ring % 2 === 0 ? params.color : params.secondaryColor, 0.12 + intensity * 0.14 + ring * 0.07);
    ctx.lineWidth = 1 + intensity * 1.4 + ring * 0.55;
    ctx.stroke();
  }

  ctx.beginPath();
  traceRegularPolygon(ctx, cx, cy, radius * 0.68, 3, -rotation - Math.PI / 2);
  ctx.strokeStyle = rgbaHexColor(params.secondaryColor, 0.22 + intensity * 0.34);
  ctx.lineWidth = 1 + intensity * 1.2;
  ctx.stroke();

  ctx.beginPath();
  traceRegularPolygon(ctx, cx, cy, radius * 0.48, 6, rotation);
  ctx.strokeStyle = rgbaHexColor(params.color, 0.2 + intensity * 0.28);
  ctx.lineWidth = 0.9 + intensity;
  ctx.stroke();

  for (let i = 0; i < glyphCount; i++) {
    const t = i / glyphCount + phase;
    const p = getTrackSample(shape, cx, cy, outerHalf, radius, t);
    const glyph = 3 + intensity * 5 + pseudoRandom(i, 3) * 7;
    const angle = Math.atan2(p.ny, p.nx) + Math.PI / 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.strokeStyle = rgbaHexColor(i % 2 === 0 ? params.color : params.secondaryColor, 0.28 + intensity * 0.42);
    ctx.lineWidth = 0.7 + intensity * 0.8;
    ctx.beginPath();
    ctx.moveTo(-glyph * 0.5, 0);
    ctx.lineTo(glyph * 0.5, 0);
    if (i % 3 === 0) {
      ctx.moveTo(0, -glyph * 0.35);
      ctx.lineTo(0, glyph * 0.35);
    }
    ctx.stroke();
    ctx.restore();
  }

  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  fillCircle(ctx, cx, cy, size * (0.035 + intensity * 0.025 + pulse * 0.02), rgbaHexColor(params.color, 0.08 + intensity * 0.12 + pulse * 0.06));
  ctx.restore();
}

function drawCyberHud(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: CropShape,
  params: EffectParams,
  progress: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const outerHalf = size / 2;
  const phase = getDirectedProgress(params, progress);
  const intensity = params.intensity / 100;
  const ringWidth = 6 + (Math.max(1, Math.min(params.ringWidth, 100)) / 100) * 24;
  const radius = outerHalf - ringWidth;
  const nodeCount = Math.max(8, Math.round(8 + params.density * 0.16));
  const scan = phase;
  const scanCount = Math.max(2, Math.round(2 + intensity * 4));

  ctx.save();
  clipShapePath(ctx, shape, width, height);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  ctx.beginPath();
  strokeShapeTrack(ctx, shape, cx, cy, outerHalf, radius);
  ctx.strokeStyle = rgbaHexColor(params.color, 0.12 + intensity * 0.22);
  ctx.lineWidth = 1 + intensity * 1.2;
  ctx.stroke();

  for (let i = 0; i < scanCount; i++) {
    const start = scan + i / scanCount;
    ctx.beginPath();
    strokeTrackSegment(ctx, shape, cx, cy, outerHalf, radius - i * 9, start, start + 0.045 + intensity * 0.055);
    ctx.strokeStyle = rgbaHexColor(i % 2 === 0 ? params.color : params.secondaryColor, 0.26 + intensity * 0.48 - i * 0.04);
    ctx.lineWidth = 1.3 + intensity * 1.5 + i * 0.22;
    ctx.stroke();
  }

  const scanAngle = phase * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(scanAngle) * radius, cy + Math.sin(scanAngle) * radius);
  ctx.strokeStyle = rgbaHexColor(params.secondaryColor, 0.18 + intensity * 0.42);
  ctx.lineWidth = 0.9 + intensity * 1.3;
  ctx.stroke();

  for (let i = 0; i < nodeCount; i++) {
    const t = i / nodeCount;
    const p = getTrackSample(shape, cx, cy, outerHalf, radius - 18 * (i % 2), t);
    const active = 0.35 + 0.65 * Math.max(0, Math.cos((t - scan) * Math.PI * 2));
    fillCircle(ctx, p.x, p.y, 1.8 + intensity * 2 + active * 2.5, rgbaHexColor(i % 2 === 0 ? params.color : params.secondaryColor, 0.12 + intensity * 0.18 + active * 0.5));
  }

  const bracket = size * 0.18;
  const inset = size * 0.13;
  const corners = [
    { x: inset, y: inset, sx: 1, sy: 1 },
    { x: width - inset, y: inset, sx: -1, sy: 1 },
    { x: width - inset, y: height - inset, sx: -1, sy: -1 },
    { x: inset, y: height - inset, sx: 1, sy: -1 },
  ];
  ctx.strokeStyle = rgbaHexColor(params.color, 0.16 + intensity * 0.34);
  ctx.lineWidth = 1.2 + intensity * 1.4;
  for (const corner of corners) {
    ctx.beginPath();
    ctx.moveTo(corner.x, corner.y + corner.sy * bracket * 0.35);
    ctx.lineTo(corner.x, corner.y);
    ctx.lineTo(corner.x + corner.sx * bracket * 0.35, corner.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCrtGlitch(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: CropShape,
  params: EffectParams,
  progress: number,
) {
  const phase = wrapUnit(progress);
  const cycle = phase * Math.PI * 2;
  const sliceCount = Math.max(5, Math.round(5 + params.density * 0.08));
  const shiftMax = 2 + (params.intensity / 100) * 18;

  ctx.save();
  clipShapePath(ctx, shape, width, height);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';

  if (params.intensity > 45) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
    ctx.fillRect(0, 0, width, height);
  }

  const scanStep = 6;
  for (let y = 0; y < height; y += scanStep) {
    const alpha = 0.035 + 0.025 * (0.5 + 0.5 * Math.sin(cycle * 2 + y * 0.07));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(0, y, width, 1);
  }

  for (let i = 0; i < sliceCount; i++) {
    const y = (pseudoRandom(i, 5) * height + phase * height * (1 + (i % 3))) % height;
    const h = 4 + pseudoRandom(i, 7) * 22;
    const offset = Math.sin(cycle * (1 + (i % 3)) + i * 1.7) * shiftMax * (0.35 + pseudoRandom(i, 8));
    ctx.fillStyle = rgbaHexColor(i % 2 === 0 ? params.color : params.secondaryColor, 0.11 + params.intensity / 900);
    ctx.fillRect(Math.min(0, offset), y, width + Math.abs(offset), h);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 80, 0.14)' : 'rgba(0, 220, 255, 0.14)';
    ctx.fillRect(offset, y + h * 0.35, width, 1.5);
  }

  const roll = (phase * height) % height;
  const gradient = ctx.createLinearGradient(0, roll - 40, 0, roll + 40);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.5, rgbaHexColor(params.color, 0.2));
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, roll - 40, width, 80);
  ctx.restore();
}

function drawPortal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: CropShape,
  params: EffectParams,
  progress: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const outerHalf = size / 2;
  const ringWidth = 8 + (Math.max(1, Math.min(params.ringWidth, 100)) / 100) * 34;
  const phase = getDirectedProgress(params, progress) * Math.PI * 2;
  const radius = outerHalf - ringWidth * 1.1;
  const arms = 4 + Math.floor(params.density / 22);

  ctx.save();
  clipShapePath(ctx, shape, width, height);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const glow = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
  glow.addColorStop(0, rgbaHexColor(params.secondaryColor, 0.16));
  glow.addColorStop(0.55, rgbaHexColor(params.color, 0.05));
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  fillCircle(ctx, cx, cy, radius, glow);

  for (let arm = 0; arm < arms; arm++) {
    ctx.beginPath();
    for (let s = 0; s <= 64; s++) {
      const t = s / 64;
      const r = radius * (0.18 + t * 0.78);
      const angle = phase + arm * (Math.PI * 2 / arms) + t * 4.6;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgbaHexColor(arm % 2 === 0 ? params.color : params.secondaryColor, 0.28 + params.intensity / 420);
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  for (let i = 0; i < Math.round(18 + params.density * 0.28); i++) {
    const lane = pseudoRandom(i, 11);
    const t = wrapUnit(phase / (Math.PI * 2) + lane + i * 0.037);
    const r = radius * (0.24 + 0.68 * t);
    const angle = phase + i * 2.399 + t * 3.4;
    const alpha = (1 - t) * 0.55;
    fillCircle(
      ctx,
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
      1.3 + pseudoRandom(i, 12) * 2.2,
      rgbaHexColor(i % 2 === 0 ? params.color : params.secondaryColor, alpha),
    );
  }

  ctx.beginPath();
  strokeShapeTrack(ctx, shape, cx, cy, outerHalf, radius);
  ctx.strokeStyle = rgbaHexColor(params.color, 0.45);
  ctx.lineWidth = Math.max(2, ringWidth * 0.12);
  ctx.stroke();
  ctx.restore();
}

function drawKaleidoscope(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: CropShape,
  params: EffectParams,
  progress: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);
  const radius = size / 2;
  const phase = getDirectedProgress(params, progress);
  const rotation = phase * Math.PI * 2;
  const segmentCount = Math.max(6, Math.round(6 + params.density * 0.08));

  ctx.save();
  clipShapePath(ctx, shape, width, height);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  for (let i = 0; i < segmentCount; i++) {
    const a1 = (i / segmentCount) * Math.PI * 2;
    const a2 = ((i + 1) / segmentCount) * Math.PI * 2;
    const color = i % 2 === 0 ? params.color : params.secondaryColor;
    const alpha = 0.08 + (params.intensity / 100) * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, a1, a2);
    ctx.closePath();
    ctx.fillStyle = rgbaHexColor(color, alpha);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
    ctx.strokeStyle = rgbaHexColor(color, 0.16 + params.intensity / 700);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  for (let ring = 0; ring < 4; ring++) {
    const r = radius * (0.2 + ring * 0.16);
    const sides = 3 + ring * 2;
    ctx.beginPath();
    traceRegularPolygon(ctx, 0, 0, r, sides, -rotation * (ring + 1));
    ctx.strokeStyle = rgbaHexColor(ring % 2 === 0 ? params.color : params.secondaryColor, 0.22);
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  for (let i = 0; i < Math.round(10 + params.density * 0.18); i++) {
    const angle = i * 2.399 + rotation;
    const r = radius * (0.12 + pseudoRandom(i, 13) * 0.72);
    fillCircle(
      ctx,
      Math.cos(angle) * r,
      Math.sin(angle) * r,
      1.6 + pseudoRandom(i, 14) * 3,
      rgbaHexColor(i % 2 === 0 ? params.color : params.secondaryColor, 0.36),
    );
  }

  ctx.restore();
}

type AxisRingLayer = 'back' | 'front';

type AxisRingLayout = {
  centerX: number;
  centerY: number;
  ringWidth: number;
  outerRadius: number;
  innerRadius: number;
  sourceDiameter: number;
};

type AxisRingSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
  color: string;
  ringWidth: number;
  ringOrder: number;
};

function getAxisRingLayout(width: number, height: number, params: EffectParams): AxisRingLayout {
  const centerX = width / 2;
  const centerY = height / 2;
  const minSize = Math.min(width, height);
  const ringWidth = 6 + (Math.max(1, Math.min(params.ringWidth, 100)) / 100) * 32;
  const outerRadius = minSize / 2 - ringWidth / 2;
  const innerRadius = Math.max(0, outerRadius - ringWidth);
  const sourceDiameter = Math.max(0, (innerRadius - ringWidth / 2) * 2);

  return {
    centerX,
    centerY,
    ringWidth,
    outerRadius,
    innerRadius,
    sourceDiameter,
  };
}

function getAxisRingSegmentColor(color: string, materialAngle: number, depth: number, radius: number) {
  const depthRatio = radius > 0 ? clampNumber(depth / radius, -1, 1) : 0;
  const depthShade = depthRatio * 0.2;
  const materialShade = Math.sin(materialAngle * 6 - Math.PI / 5) * 0.055;
  const fixedHighlight = Math.max(0, Math.cos(materialAngle - Math.PI * 0.35)) ** 12 * 0.18;

  return shadeHexColor(color, depthShade + materialShade + fixedHighlight - 0.035);
}

function getAxisRingSegments(
  centerX: number,
  centerY: number,
  radius: number,
  ringWidth: number,
  phase: number,
  axisAngle: number,
  color: string,
  ringOrder: number,
): AxisRingSegment[] {
  const samples = 160;
  const points: Array<{ x: number; y: number; depth: number }> = [];
  const axisX = Math.cos(axisAngle);
  const axisY = Math.sin(axisAngle);
  const perpX = -Math.sin(axisAngle);
  const perpY = Math.cos(axisAngle);
  const phaseCos = Math.cos(phase);
  const phaseSin = Math.sin(phase);

  for (let i = 0; i <= samples; i++) {
    const angle = (i / samples) * Math.PI * 2;
    const axisDistance = Math.cos(angle) * radius;
    const perpendicularDistance = Math.sin(angle) * radius;
    const projectedDistance = perpendicularDistance * phaseCos;
    const depth = perpendicularDistance * phaseSin;

    points.push({
      x: centerX + axisDistance * axisX + projectedDistance * perpX,
      y: centerY + axisDistance * axisY + projectedDistance * perpY,
      depth,
    });
  }

  const segments: AxisRingSegment[] = [];

  for (let i = 0; i < samples; i++) {
    const a = points[i];
    const b = points[i + 1];
    const depth = (a.depth + b.depth) / 2;
    const materialAngle = ((i + 0.5) / samples) * Math.PI * 2;

    segments.push({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      depth,
      color: getAxisRingSegmentColor(color, materialAngle, depth, radius),
      ringWidth,
      ringOrder,
    });
  }

  return segments;
}

function drawAxisRingSegments(
  ctx: CanvasRenderingContext2D,
  segments: AxisRingSegment[],
  layer: AxisRingLayer,
) {
  const visibleSegments = segments
    .filter((segment) => (layer === 'front' ? segment.depth >= 0 : segment.depth < 0))
    .sort((a, b) => {
      const ringDelta = a.ringOrder - b.ringOrder;
      if (ringDelta !== 0) return ringDelta;

      const depthDelta = a.depth - b.depth;
      return Math.abs(depthDelta) > 0.01 ? depthDelta : 0;
    });

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 1;

  for (const segment of visibleSegments) {
    ctx.lineWidth = segment.ringWidth;
    ctx.strokeStyle = segment.color;
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
  }

  ctx.restore();
}

function getAxisRingSceneSegments(
  width: number,
  height: number,
  params: EffectParams,
  progress: number,
): AxisRingSegment[] {
  const layout = getAxisRingLayout(width, height, params);
  const direction = params.direction === 'reverse' ? -1 : 1;
  const turn = wrapUnit(progress * direction) * Math.PI * 2;
  const outerPhase = turn;
  const innerPhase = turn + Math.PI / 2;
  const outerAxis = -Math.PI / 10 + turn;
  const innerAxis = Math.PI / 2.7 - turn;

  return [
    ...getAxisRingSegments(layout.centerX, layout.centerY, layout.innerRadius, layout.ringWidth, innerPhase, innerAxis, params.secondaryColor, 0),
    ...getAxisRingSegments(layout.centerX, layout.centerY, layout.outerRadius, layout.ringWidth, outerPhase, outerAxis, params.color, 1),
  ];
}

function drawAxisRings(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: EffectParams,
  progress: number,
  layer: AxisRingLayer,
) {
  const segments = getAxisRingSceneSegments(width, height, params, progress);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  drawAxisRingSegments(ctx, segments, layer);
  ctx.restore();
}

function drawAxisRingSource(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  params: EffectParams,
  mirror: MirrorSettings,
  shape: CropShape,
  width: number,
  height: number,
) {
  const layout = getAxisRingLayout(width, height, params);
  if (layout.sourceDiameter <= 0) return;

  const x = layout.centerX - layout.sourceDiameter / 2;
  const y = layout.centerY - layout.sourceDiameter / 2;

  ctx.save();
  ctx.translate(x, y);
  clipShapePath(ctx, shape, layout.sourceDiameter, layout.sourceDiameter);
  ctx.clip();
  drawCoveredSource(ctx, source, sourceWidth, sourceHeight, mirror, layout.sourceDiameter, layout.sourceDiameter);
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

  let x: number;
  let y: number;

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

      if (effect === 'axisrings') {
        drawAxisRings(ctx, width, height, params, progress, 'back');
      }

      if (hasSource) {
        if (gifSource && gifFrameCanvas && gifFrameCtx) {
          const frame = gifSource.frames[getGifFrameIndexAtTime(gifSource, elapsedMs)];
          gifFrameCtx.clearRect(0, 0, gifFrameCanvas.width, gifFrameCanvas.height);
          gifFrameCtx.putImageData(frame.imageData, 0, 0);
          if (effect === 'axisrings') {
            drawAxisRingSource(ctx, gifFrameCanvas, gifSource.width, gifSource.height, params, mirror, shape, width, height);
          } else {
            ctx.save();
            clipShapePath(ctx, shape, width, height);
            ctx.clip();
            drawCoveredSource(ctx, gifFrameCanvas, gifSource.width, gifSource.height, mirror, width, height);
            ctx.restore();
          }
        } else if (image) {
          if (effect === 'axisrings') {
            drawAxisRingSource(ctx, image, image.width, image.height, params, mirror, shape, width, height);
          } else {
            ctx.save();
            clipShapePath(ctx, shape, width, height);
            ctx.clip();
            drawCoveredSource(ctx, image, image.width, image.height, mirror, width, height);
            ctx.restore();
          }
        }
      }

      if (effect === 'loader') {
        drawLoader(ctx, width, height, shape, params, progress);
        return;
      }

      if (effect === 'spinner') {
        drawSpinner(ctx, width, height, shape, params, progress);
        return;
      }

      if (effect === 'neoncomet') {
        drawNeonComet(ctx, width, height, shape, params, progress);
        return;
      }

      if (effect === 'equalizer') {
        drawEqualizer(ctx, width, height, shape, params, progress);
        return;
      }

      if (effect === 'magiccircle') {
        drawMagicCircle(ctx, width, height, shape, params, progress);
        return;
      }

      if (effect === 'cyberhud') {
        drawCyberHud(ctx, width, height, shape, params, progress);
        return;
      }

      if (effect === 'crtglitch') {
        drawCrtGlitch(ctx, width, height, shape, params, progress);
        return;
      }

      if (effect === 'portal') {
        drawPortal(ctx, width, height, shape, params, progress);
        return;
      }

      if (effect === 'kaleidoscope') {
        drawKaleidoscope(ctx, width, height, shape, params, progress);
        return;
      }

      const animation = getRingAnimationState(params, progress);
      if (effect === 'linxudo') {
        drawLinxuDo(ctx, width, height, animation);
        return;
      }

      if (effect === 'collapsequad') {
        drawCollapseQuadRing(ctx, width, height, params, animation, progress);
        return;
      }

      if (effect === 'axisrings') {
        drawAxisRings(ctx, width, height, params, progress, 'front');
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
