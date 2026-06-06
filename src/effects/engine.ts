import * as PIXI from 'pixi.js';
import {
  RING_LOOP_DURATION_MS,
  RING_LOOP_SPEED_BASELINE,
  SQUARE_CORNER_RADIUS,
} from './types';
import type { Particle, EffectParams, EffectType, CropShape } from './types';

// ─── Color utilities ───
function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function lerpColor(a: string, b: string, t: number): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bv = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | bv;
}

function mixHex(a: string, b: string, t: number): string {
  return `#${lerpColor(a, b, t).toString(16).padStart(6, '0')}`;
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function drawRingQuad(
  g: PIXI.Graphics,
  p1Outer: { x: number; y: number },
  p2Outer: { x: number; y: number },
  p2Inner: { x: number; y: number },
  p1Inner: { x: number; y: number },
  color: number,
) {
  g.poly([
    p1Outer.x, p1Outer.y,
    p2Outer.x, p2Outer.y,
    p2Inner.x, p2Inner.y,
    p1Inner.x, p1Inner.y,
  ], true).fill({ color, alpha: 1 });
}

function drawCircularRingSegment(
  g: PIXI.Graphics,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  angle1: number,
  angle2: number,
  color: number,
) {
  const p1Outer = { x: cx + Math.cos(angle1) * outerRadius, y: cy + Math.sin(angle1) * outerRadius };
  const p2Outer = { x: cx + Math.cos(angle2) * outerRadius, y: cy + Math.sin(angle2) * outerRadius };
  const p2Inner = { x: cx + Math.cos(angle2) * innerRadius, y: cy + Math.sin(angle2) * innerRadius };
  const p1Inner = { x: cx + Math.cos(angle1) * innerRadius, y: cy + Math.sin(angle1) * innerRadius };
  drawRingQuad(g, p1Outer, p2Outer, p2Inner, p1Inner, color);
}

function drawRoundRectRingSegment(
  g: PIXI.Graphics,
  cx: number,
  cy: number,
  outerHalf: number,
  outerRadius: number,
  innerHalf: number,
  innerRadius: number,
  tStart: number,
  tEnd: number,
  color: number,
) {
  let from = ((tStart % 1) + 1) % 1;
  let to = tEnd;
  while (to < from) to += 1;

  const steps = Math.max(24, Math.ceil((to - from) * 720));
  const points: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    const p = getRoundRectPointStatic(cx, cy, outerHalf, outerRadius, t);
    points.push(p.x, p.y);
  }
  for (let i = steps; i >= 0; i--) {
    const t = from + ((to - from) * i) / steps;
    const p = getRoundRectPointStatic(cx, cy, innerHalf, innerRadius, t);
    points.push(p.x, p.y);
  }

  g.poly(points, true).fill({ color, alpha: 1 });
}

function getRoundRectPointStatic(cx: number, cy: number, half: number, radius: number, t: number): { x: number; y: number } {
  const r = Math.min(radius, half);
  const edgeLen = half * 2 - r * 2;
  const arcLen = (Math.PI / 2) * r;
  const totalPerim = 4 * edgeLen + 4 * arcLen;
  t = ((t % 1) + 1) % 1;
  let d = t * totalPerim;

  if (d < edgeLen) return { x: cx - half + r + d, y: cy - half };
  d -= edgeLen;
  if (d < arcLen) { const a = -Math.PI / 2 + d / r; return { x: cx + half - r + Math.cos(a) * r, y: cy - half + r + Math.sin(a) * r }; }
  d -= arcLen;
  if (d < edgeLen) return { x: cx + half, y: cy - half + r + d };
  d -= edgeLen;
  if (d < arcLen) { const a = d / r; return { x: cx + half - r + Math.cos(a) * r, y: cy + half - r + Math.sin(a) * r }; }
  d -= arcLen;
  if (d < edgeLen) return { x: cx + half - r - d, y: cy + half };
  d -= edgeLen;
  if (d < arcLen) { const a = Math.PI / 2 + d / r; return { x: cx - half + r + Math.cos(a) * r, y: cy + half - r + Math.sin(a) * r }; }
  d -= arcLen;
  if (d < edgeLen) return { x: cx - half, y: cy + half - r - d };
  d -= edgeLen;
  if (d < arcLen) { const a = Math.PI + d / r; return { x: cx - half + r + Math.cos(a) * r, y: cy - half + r + Math.sin(a) * r }; }

  return { x: cx - half + r, y: cy - half };
}

function getSquareTrackCornerRadius(outerHalf: number, half: number) {
  const inset = outerHalf - half;
  if (inset <= 0) return SQUARE_CORNER_RADIUS + Math.abs(inset);
  return Math.max(Math.min(SQUARE_CORNER_RADIUS - inset, half), 0);
}

export class ParticleEngine {
  particles: Particle[] = [];
  private time = 0;
  private effect: EffectType = 'lightning';
  private shape: CropShape = 'circle';
  private params: EffectParams = {
    density: 50, intensity: 50, speed: 50, size: 60, count: 1, ringWidth: 58,
    color: '#00d4ff', secondaryColor: '#ff6b35', ringAnimationMode: 'rotate', direction: 'forward',
  };

  // Lightning state
  private lightningBolts: Array<{
    segments: Array<{ x1: number; y1: number; x2: number; y2: number; width: number }>;
    life: number;
    maxLife: number;
    glow: number;
  }> = [];
  private lightningTimer = 0;

  // Orbit state
  private orbitAngle = 0;

  // Glow state
  private glowPhase = 0;

  // Shield state
  private shieldPhase = 0;
  private shieldHitTimer = 0;

  // Frost state
  private frostCrystals: Array<{ x: number; y: number; angle: number; size: number; branchLen: number }> = [];

  // Ripple state
  private ripplePhase = 0;

  // Petal state
  private petalTime = 0;

  // Stardust state
  private stardustTime = 0;
  private meteors: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; length: number }> = [];
  private meteorTimer = 0;

  // Prism state
  private prismTime = 0;

  // Vortex state
  private vortexTime = 0;

  // Firework state
  private fireworkBursts: Array<{ x: number; y: number; particles: Particle[]; life: number }> = [];
  private fireworkTimer = 0;

  // Gold state
  private goldTime = 0;

  // Spin state
  private spinTime = 0;

  // Loader state
  private loaderTime = 0;

  // Spinner state
  private spinnerTime = 0;

  // Matrix state
  private matrixColumns: Array<{ x: number; chars: string[]; speed: number; phase: number }> = [];
  private matrixTimer = 0;

  // Bubble state
  private bubbleTime = 0;

  // Fire state
  private fireTime = 0;

  // Aurora state
  private auroraTime = 0;


  // Firefly state
  private fireflyTime = 0;

  // Rain state
  private rainTime = 0;

  // SolidRing state
  private solidRingPhase = 0;

  // Disc state
  private discPhase = 0;

  // Google One ring state
  private googleOnePhase = 0;
  private effectLoopPhase: number | null = null;
  private frameDeltaSeconds = 1 / 60;
  private lastUpdateAt = 0;
  private fixedDeltaSeconds: number | null = null;

  setEffect(e: EffectType) { this.effect = e; this.particles = []; this.lightningBolts = []; }
  setShape(s: CropShape) {
    if (this.shape === s) return;
    this.shape = s;
    this.clear();
  }
  setParams(p: EffectParams) { this.params = p; }
  setFixedDeltaMs(deltaMs: number | null) {
    if (deltaMs == null) {
      this.fixedDeltaSeconds = null;
      this.lastUpdateAt = 0;
      this.frameDeltaSeconds = 1 / 60;
      return;
    }
    this.fixedDeltaSeconds = Math.max(deltaMs, 0) / 1000;
    this.frameDeltaSeconds = this.fixedDeltaSeconds;
    this.lastUpdateAt = 0;
  }
  setRingLoopProgress(progress: number | null) {
    if (progress == null) {
      this.effectLoopPhase = null;
      return;
    }
    const direction = this.params.direction === 'reverse' ? -1 : 1;
    const loopPhase = this.getWrappedPhase(progress);
    const ringPhase = this.getWrappedPhase(progress * direction);
    this.effectLoopPhase = loopPhase;
    this.solidRingPhase = ringPhase;
    this.discPhase = ringPhase;
    this.googleOnePhase = ringPhase;
  }

  private getSpeedStep() {
    return Math.max(this.params.speed / 50, 0.02);
  }

  private getEffectLoopProgress(timer: number, realtimeScale: number) {
    if (this.effectLoopPhase != null) {
      return this.effectLoopPhase;
    }
    return this.getWrappedPhase(timer * realtimeScale);
  }

  update(canvasW: number, canvasH: number, imgSize: number) {
    if (this.fixedDeltaSeconds != null) {
      this.frameDeltaSeconds = this.fixedDeltaSeconds;
    } else {
      const now = performance.now();
      this.frameDeltaSeconds = this.lastUpdateAt
        ? Math.min((now - this.lastUpdateAt) / 1000, 0.1)
        : 1 / 60;
      this.lastUpdateAt = now;
    }

    const dt = (this.params.speed / 50) * 0.8;
    this.time += dt * 0.016;

    switch (this.effect) {
      case 'lightning': this.updateLightning(canvasW, canvasH, imgSize); break;
      case 'fire':      this.updateFire(canvasW, canvasH, imgSize); break;
      case 'glow':      this.updateGlow(canvasW, canvasH, imgSize); break;
      case 'orbit':     this.updateOrbit(canvasW, canvasH, imgSize); break;
      case 'shield':    this.updateShield(canvasW, canvasH, imgSize); break;
      case 'frost':     this.updateFrost(canvasW, canvasH, imgSize); break;
      case 'ripple':    this.updateRipple(canvasW, canvasH, imgSize); break;
      case 'petal':     this.updatePetal(canvasW, canvasH, imgSize); break;
      case 'stardust':  this.updateStardust(canvasW, canvasH, imgSize); break;
      case 'prism':     this.updatePrism(canvasW, canvasH, imgSize); break;
      case 'vortex':    this.updateVortex(canvasW, canvasH, imgSize); break;
      case 'firework':  this.updateFirework(canvasW, canvasH, imgSize); break;
      case 'gold':      this.updateGold(canvasW, canvasH, imgSize); break;
      case 'spin':      this.updateSpin(canvasW, canvasH, imgSize); break;
      case 'loader':    this.updateLoader(canvasW, canvasH, imgSize); break;
      case 'spinner':   this.updateSpinner(canvasW, canvasH, imgSize); break;
      case 'matrix':    this.updateMatrix(canvasW, canvasH, imgSize); break;
      case 'bubble':    this.updateBubble(canvasW, canvasH, imgSize); break;
      case 'aurora':    this.updateAurora(canvasW, canvasH, imgSize); break;
      case 'firefly':   this.updateFirefly(canvasW, canvasH, imgSize); break;
      case 'rain':      this.updateRain(canvasW, canvasH, imgSize); break;
      case 'solidring': this.updateSolidRing(canvasW, canvasH, imgSize); break;
      case 'disc':      this.updateDisc(canvasW, canvasH, imgSize); break;
      case 'googleone': this.updateGoogleOne(canvasW, canvasH, imgSize); break;
    }
  }

  draw(g: PIXI.Graphics, canvasW: number, canvasH: number, imgSize: number) {
    g.clear();
    switch (this.effect) {
      case 'lightning': this.drawLightning(g, canvasW, canvasH, imgSize); break;
      case 'fire':      this.drawFire(g, canvasW, canvasH, imgSize); break;
      case 'glow':      this.drawGlow(g, canvasW, canvasH, imgSize); break;
      case 'orbit':     this.drawOrbit(g, canvasW, canvasH, imgSize); break;
      case 'shield':    this.drawShield(g, canvasW, canvasH, imgSize); break;
      case 'frost':     this.drawFrost(g, canvasW, canvasH, imgSize); break;
      case 'ripple':    this.drawRipple(g, canvasW, canvasH, imgSize); break;
      case 'petal':     this.drawPetal(g, canvasW, canvasH, imgSize); break;
      case 'stardust':  this.drawStardust(g, canvasW, canvasH, imgSize); break;
      case 'prism':     this.drawPrism(g, canvasW, canvasH, imgSize); break;
      case 'vortex':    this.drawVortex(g, canvasW, canvasH, imgSize); break;
      case 'firework':  this.drawFirework(g, canvasW, canvasH, imgSize); break;
      case 'gold':      this.drawGold(g, canvasW, canvasH, imgSize); break;
      case 'spin':      this.drawSpin(g, canvasW, canvasH, imgSize); break;
      case 'loader':    this.drawLoader(g, canvasW, canvasH, imgSize); break;
      case 'spinner':   this.drawSpinner(g, canvasW, canvasH, imgSize); break;
      case 'matrix':    this.drawMatrix(g, canvasW, canvasH, imgSize); break;
      case 'bubble':    this.drawBubble(g, canvasW, canvasH, imgSize); break;
      case 'aurora':    this.drawAurora(g, canvasW, canvasH, imgSize); break;
      case 'firefly':   this.drawFirefly(g, canvasW, canvasH, imgSize); break;
      case 'rain':      this.drawRain(g, canvasW, canvasH, imgSize); break;
      case 'solidring': this.drawSolidRing(g, canvasW, canvasH, imgSize); break;
      case 'disc':      this.drawDisc(g, canvasW, canvasH, imgSize); break;
      case 'googleone': this.drawGoogleOne(g, canvasW, canvasH, imgSize); break;
    }
  }

  // ─── Edge helper ───
  private getEdgePoint(canvasW: number, canvasH: number, imgSize: number, t: number): { x: number; y: number; nx: number; ny: number } {
    const cx = canvasW / 2, cy = canvasH / 2;
    const r = imgSize / 2;

    if (this.shape === 'circle') {
      const angle = t * Math.PI * 2;
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, nx: Math.cos(angle), ny: Math.sin(angle) };
    } else {
      const half = r;
      const cornerRadius = getSquareTrackCornerRadius(half, half);
      const point = this.getRoundRectPoint(cx, cy, half, cornerRadius, t);
      const sampleOffset = 0.0015;
      const prev = this.getRoundRectPoint(cx, cy, half, cornerRadius, t - sampleOffset);
      const next = this.getRoundRectPoint(cx, cy, half, cornerRadius, t + sampleOffset);
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const tangentLen = Math.hypot(tx, ty) || 1;
      return {
        x: point.x,
        y: point.y,
        nx: ty / tangentLen,
        ny: -tx / tangentLen,
      };
    }
  }


  // ════════════════════════════════════════════════════════════════════
  // �?LIGHTNING
  // ════════════════════════════════════════════════════════════════════

  // --- Rounded-rect perimeter helper ---
  private getRoundRectPoint(cx: number, cy: number, half: number, radius: number, t: number): { x: number; y: number } {
    const r = Math.min(radius, half);
    const edgeLen = half * 2 - r * 2;
    const arcLen = (Math.PI / 2) * r;
    const totalPerim = 4 * edgeLen + 4 * arcLen;
    t = ((t % 1) + 1) % 1;
    let d = t * totalPerim;

    if (d < edgeLen) return { x: cx - half + r + d, y: cy - half };
    d -= edgeLen;
    if (d < arcLen) { const a = -Math.PI / 2 + d / r; return { x: cx + half - r + Math.cos(a) * r, y: cy - half + r + Math.sin(a) * r }; }
    d -= arcLen;
    if (d < edgeLen) return { x: cx + half, y: cy - half + r + d };
    d -= edgeLen;
    if (d < arcLen) { const a = d / r; return { x: cx + half - r + Math.cos(a) * r, y: cy + half - r + Math.sin(a) * r }; }
    d -= arcLen;
    if (d < edgeLen) return { x: cx + half - r - d, y: cy + half };
    d -= edgeLen;
    if (d < arcLen) { const a = Math.PI / 2 + d / r; return { x: cx - half + r + Math.cos(a) * r, y: cy + half - r + Math.sin(a) * r }; }
    d -= arcLen;
    if (d < edgeLen) return { x: cx - half, y: cy + half - r - d };
    d -= edgeLen;
    if (d < arcLen) { const a = Math.PI + d / r; return { x: cx - half + r + Math.cos(a) * r, y: cy - half + r + Math.sin(a) * r }; }

    return { x: cx - half + r, y: cy - half };
  }

  private drawRoundRectSegment(
    g: PIXI.Graphics,
    cx: number,
    cy: number,
    half: number,
    radius: number,
    tStart: number,
    tEnd: number,
    stroke: { width: number; color: number; alpha: number },
  ) {
    let from = ((tStart % 1) + 1) % 1;
    let to = tEnd;
    while (to < from) to += 1;
    const steps = Math.max(5, Math.ceil((to - from) * 120));
    const first = this.getRoundRectPoint(cx, cy, half, radius, from);
    g.moveTo(first.x, first.y);
    for (let i = 1; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      const p = this.getRoundRectPoint(cx, cy, half, radius, t);
      g.lineTo(p.x, p.y);
    }
    g.stroke(stroke);
  }

  private isInsideShapePoint(x: number, y: number, cx: number, cy: number, half: number, inset = 0) {
    const effectiveHalf = Math.max(half - inset, 0);
    if (this.shape === 'circle') {
      const dx = x - cx;
      const dy = y - cy;
      return dx * dx + dy * dy <= effectiveHalf * effectiveHalf;
    }

    const radius = getSquareTrackCornerRadius(half, effectiveHalf);
    const innerHalf = Math.max(effectiveHalf - radius, 0);
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);

    if ((dx <= innerHalf && dy <= effectiveHalf) || (dy <= innerHalf && dx <= effectiveHalf)) {
      return true;
    }

    const cornerDx = dx - innerHalf;
    const cornerDy = dy - innerHalf;
    return cornerDx * cornerDx + cornerDy * cornerDy <= radius * radius;
  }

  private projectInsideShapePoint(x: number, y: number, cx: number, cy: number, half: number, inset = 0) {
    const effectiveHalf = Math.max(half - inset, 1);
    if (this.shape === 'circle') {
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      if (len <= effectiveHalf) return { x, y };
      const scale = effectiveHalf / len;
      return { x: cx + dx * scale, y: cy + dy * scale };
    }

    const radius = getSquareTrackCornerRadius(half, effectiveHalf);
    const innerHalf = Math.max(effectiveHalf - radius, 0);
    const lx = x - cx;
    const ly = y - cy;
    const sx = lx === 0 ? 1 : Math.sign(lx);
    const sy = ly === 0 ? 1 : Math.sign(ly);
    const dx = Math.abs(lx);
    const dy = Math.abs(ly);

    if (this.isInsideShapePoint(x, y, cx, cy, half, inset)) {
      return { x, y };
    }

    if (dx <= innerHalf) {
      return { x: cx + lx, y: cy + sy * effectiveHalf };
    }
    if (dy <= innerHalf) {
      return { x: cx + sx * effectiveHalf, y: cy + ly };
    }

    const cornerCx = sx * innerHalf;
    const cornerCy = sy * innerHalf;
    const vx = lx - cornerCx;
    const vy = ly - cornerCy;
    const vLen = Math.hypot(vx, vy) || 1;
    const scale = radius / vLen;
    return {
      x: cx + cornerCx + vx * scale,
      y: cy + cornerCy + vy * scale,
    };
  }

  private getRandomPointInShape(cx: number, cy: number, half: number, inset = 0) {
    const effectiveHalf = Math.max(half - inset, 1);
    if (this.shape === 'circle') {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * effectiveHalf;
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
      };
    }

    for (let i = 0; i < 24; i++) {
      const x = cx + (Math.random() - 0.5) * effectiveHalf * 2;
      const y = cy + (Math.random() - 0.5) * effectiveHalf * 2;
      if (this.isInsideShapePoint(x, y, cx, cy, half, inset)) {
        return { x, y };
      }
    }

    return this.projectInsideShapePoint(
      cx + (Math.random() - 0.5) * effectiveHalf * 2,
      cy + (Math.random() - 0.5) * effectiveHalf * 2,
      cx,
      cy,
      half,
      inset,
    );
  }
  private generateBolt(
    x1: number, y1: number, x2: number, y2: number,
    width: number, depth: number, segments: Array<{ x1: number; y1: number; x2: number; y2: number; width: number }>
  ) {
    if (depth <= 0 || width < 0.3) return;

    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 3) return;

    const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * len * 0.4;
    const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * len * 0.4;

    segments.push({ x1, y1, x2: midX, y2: midY, width });
    segments.push({ x1: midX, y1: midY, x2, y2, width });

    if (Math.random() < 0.45 && depth > 1) {
      const branchAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.2;
      const branchLen = len * (0.3 + Math.random() * 0.4);
      const bx = midX + Math.cos(branchAngle) * branchLen;
      const by = midY + Math.sin(branchAngle) * branchLen;
      this.generateBolt(midX, midY, bx, by, width * 0.5, depth - 1, segments);
    }
    if (Math.random() < 0.3 && depth > 1) {
      const branchAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.5;
      const branchLen = len * (0.2 + Math.random() * 0.3);
      const bx = midX + Math.cos(branchAngle) * branchLen;
      const by = midY + Math.sin(branchAngle) * branchLen;
      this.generateBolt(midX, midY, bx, by, width * 0.4, depth - 1, segments);
    }

    this.generateBolt(x1, y1, midX, midY, width, depth - 1, segments);
    this.generateBolt(midX, midY, x2, y2, width, depth - 1, segments);
  }

  private updateLightning(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    const spd = speedStep;
    this.lightningTimer += spd;

    this.lightningBolts = this.lightningBolts.filter(b => {
      b.life -= speedStep;
      return b.life > 0;
    });

    const spawnInterval = Math.max(4, 20 - Math.floor(this.params.density / 8));
    if (this.lightningTimer >= spawnInterval) {
      this.lightningTimer = 0;
      const boltCount = 1 + Math.floor(this.params.density / 30);

      for (let i = 0; i < boltCount; i++) {
        // Cross-bolt: edge-to-edge, or edge-to-center
        const t1 = Math.random();
        const ep1 = this.getEdgePoint(cw, ch, sz, t1);
        let targetX: number, targetY: number;
        if (Math.random() < 0.5) {
          // Cross bolt: from one edge to opposite edge
          const t2 = (t1 + 0.3 + Math.random() * 0.4) % 1;
          const ep2 = this.getEdgePoint(cw, ch, sz, t2);
          targetX = ep2.x;
          targetY = ep2.y;
        } else {
          // Edge to near-center
          const cx = cw / 2, cy = ch / 2;
          targetX = cx + (Math.random() - 0.5) * sz * 0.25;
          targetY = cy + (Math.random() - 0.5) * sz * 0.25;
        }

        const segments: Array<{ x1: number; y1: number; x2: number; y2: number; width: number }> = [];
        const baseWidth = 0.8 + (this.params.intensity / 100) * 1.2;
        const depth = 3 + Math.floor(this.params.intensity / 25);
        this.generateBolt(ep1.x, ep1.y, targetX, targetY, baseWidth, depth, segments);

        this.lightningBolts.push({
          segments,
          life: 3 + Math.random() * 5,
          maxLife: 8,
          glow: 0.8 + Math.random() * 0.2,
        });
      }
    }

    const sparkCount = Math.floor(this.params.density / 20) + 1;
    for (let i = 0; i < sparkCount; i++) {
      const t = Math.random();
      const ep = this.getEdgePoint(cw, ch, sz, t);
      this.particles.push({
        x: ep.x + (Math.random() - 0.5) * 4,
        y: ep.y + (Math.random() - 0.5) * 4,
        vx: ep.nx * (0.5 + Math.random() * 1),
        vy: ep.ny * (0.5 + Math.random() * 1),
        life: 3 + Math.random() * 5,
        maxLife: 8,
        size: 0.5 + Math.random() * 1,
        color: Math.random() > 0.5 ? this.params.color : this.params.secondaryColor,
        alpha: 1,
        trail: [],
      });
    }

    this.particles = this.particles.filter(p => {
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 4) p.trail.shift();
      }
      p.x += p.vx * speedStep;
      p.y += p.vy * speedStep;
      p.vx *= Math.pow(0.95, speedStep);
      p.vy *= Math.pow(0.95, speedStep);
      p.life -= speedStep;
      return p.life > 0;
    });
  }

  private drawLightning(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);

    for (const bolt of this.lightningBolts) {
      const progress = bolt.life / bolt.maxLife;
      const fadeAlpha = progress < 0.3 ? progress / 0.3 : 1;
      const flashAlpha = progress > 0.7 ? 1 : 0.6 + Math.sin(progress * Math.PI * 8) * 0.4;
      const baseAlpha = fadeAlpha * flashAlpha * bolt.glow;

      // 3-layer glow: outer, mid, core.
      const layers = [
        { width: 4, color: colorNum, alpha: baseAlpha * 0.35 },
        { width: 2, color: secColorNum, alpha: baseAlpha * 0.65 },
        { width: 0.8, color: 0xffffff, alpha: baseAlpha * 1.0 },
      ];

      for (const seg of bolt.segments) {
        // Generate zigzag sub-segments
        const subSegs = 3 + Math.floor(Math.random() * 3);
        const points: Array<{ x: number; y: number }> = [{ x: seg.x1, y: seg.y1 }];
        for (let i = 1; i < subSegs; i++) {
          const t = i / subSegs;
          const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          const perpX = -dy / len, perpY = dx / len;
          const offset = (Math.random() - 0.5) * len * 0.15;
          points.push({
            x: seg.x1 + dx * t + perpX * offset,
            y: seg.y1 + dy * t + perpY * offset,
          });
        }
        points.push({ x: seg.x2, y: seg.y2 });

        for (const layer of layers) {
          g.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            g.lineTo(points[i].x, points[i].y);
          }
          g.stroke({ width: layer.width, color: layer.color, alpha: layer.alpha });
        }
      }

      // Glow circles at bolt start and end
      const firstSeg = bolt.segments[0];
      const lastSeg = bolt.segments[bolt.segments.length - 1];
      if (firstSeg && lastSeg) {
        const glowAlpha = baseAlpha * 0.25;
        g.circle(firstSeg.x1, firstSeg.y1, 22).fill({ color: colorNum, alpha: glowAlpha });
        g.circle(lastSeg.x2, lastSeg.y2, 22).fill({ color: colorNum, alpha: glowAlpha });
      }
    }

    // Spark particles with trails
    for (const p of this.particles) {
      const a = p.life / p.maxLife;
      const pColor = hexToNum(p.color);
      if (p.trail) {
        for (let i = 0; i < p.trail.length; i++) {
          const tp = p.trail[i];
          const ta = a * (i / p.trail.length) * 0.5;
          // Outer glow trail
          g.circle(tp.x, tp.y, p.size * 1.5).fill({ color: pColor, alpha: ta * 0.3 });
          // Core trail
          g.circle(tp.x, tp.y, p.size * 0.6).fill({ color: pColor, alpha: ta });
        }
      }
      // Outer glow
      g.circle(p.x, p.y, p.size * 2).fill({ color: pColor, alpha: a * 0.3 });
      // Bright core
      g.circle(p.x, p.y, p.size).fill({ color: 0xffffff, alpha: a });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🔥 FIRE
  // ════════════════════════════════════════════════════════════════════

  private updateFire(_cw: number, _ch: number, _sz: number) {
    this.fireTime += this.frameDeltaSeconds * this.getSpeedStep() * 0.5;
    this.particles = [];
  }

  private drawFire(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const intensity = this.params.intensity / 100;
    const density = this.params.density / 100;
    const phase = this.getEffectLoopProgress(this.fireTime, 1);
    const loop = phase * Math.PI * 2;
    const mainColor = this.params.color;
    const secondaryColor = this.params.secondaryColor;
    const emberColor = mixHex(mainColor, '#160300', 0.58);
    const whiteHot = mixHex(secondaryColor, '#ffffff', 0.72);
    const baseY = cy + r * 0.88;

    for (let i = 7; i >= 0; i--) {
      const t = i / 7;
      const pulse = 0.9 + 0.1 * Math.sin(loop + t * Math.PI);
      g.ellipse(
        cx,
        baseY + r * 0.02,
        r * (0.38 + density * 0.18 + t * 0.52) * pulse,
        r * (0.045 + intensity * 0.035 + t * 0.13),
      ).fill({
        color: lerpColor(secondaryColor, mainColor, t),
        alpha: (0.035 + intensity * 0.065) * (1 - t),
      });
    }

    const tongueCount = 8 + Math.floor(this.params.density / 13) + Math.floor(intensity * 4);
    for (let i = 0; i < tongueCount; i++) {
      const seed = pseudoRandom(i * 31.7 + 4.2);
      const t = tongueCount <= 1 ? 0.5 : (i + 0.5) / tongueCount;
      const lane = t * 2 - 1;
      const edgeAngle = Math.PI * (0.12 + t * 0.76);
      const baseX = this.shape === 'circle'
        ? cx + Math.cos(edgeAngle) * r * (0.82 + seed * 0.08)
        : cx + lane * r * 0.9;
      const base = this.shape === 'circle'
        ? cy + Math.sin(edgeAngle) * r * (0.84 + seed * 0.07)
        : baseY + Math.sin((t + phase) * Math.PI * 2) * r * 0.015;
      const edgeFade = 1 - Math.pow(Math.abs(lane), 1.5) * 0.32;
      const wave = 0.5 + 0.5 * Math.sin(loop * (1 + (i % 2)) + seed * Math.PI * 2 + lane * 1.2);
      const height = r * (0.18 + intensity * 0.28 + density * 0.08) * (0.62 + seed * 0.55 + wave * 0.35) * edgeFade;
      const width = r * (0.028 + intensity * 0.038 + density * 0.016) * (0.85 + seed * 0.55) * edgeFade;
      const lean = Math.sin(loop + seed * Math.PI * 2) * r * (0.025 + intensity * 0.035) - lane * r * 0.03;
      const tipX = baseX + lean;
      const tipY = base - height;
      const colorOuter = lerpColor(mainColor, secondaryColor, 0.14 + seed * 0.34);

      g.poly([
        baseX - width * 1.45, base,
        baseX + width * 1.35, base,
        tipX + width * 0.55, tipY + height * 0.44,
        tipX, tipY,
        tipX - width * 0.52, tipY + height * 0.44,
      ], true).fill({ color: colorOuter, alpha: 0.16 + intensity * 0.16 });

      g.poly([
        baseX - width * 0.58, base - height * 0.08,
        baseX + width * 0.55, base - height * 0.08,
        tipX + width * 0.2, tipY + height * 0.54,
        tipX, tipY + height * (0.18 + seed * 0.1),
        tipX - width * 0.2, tipY + height * 0.54,
      ], true).fill({ color: lerpColor(secondaryColor, whiteHot, 0.22 + seed * 0.25), alpha: 0.12 + intensity * 0.18 });
    }

    const sparkCount = 10 + Math.floor(this.params.density * 0.34);
    for (let i = 0; i < sparkCount; i++) {
      const seed = pseudoRandom(i * 19.91 + 8.8);
      const progress = this.getWrappedPhase(phase * (1 + (i % 3)) + seed);
      const lane = pseudoRandom(i * 5.17 + 2.4) * 2 - 1;
      const rise = r * (0.08 + progress * (0.48 + intensity * 0.32));
      const drift = Math.sin(loop * 1.5 + seed * Math.PI * 2) * r * (0.025 + intensity * 0.05);
      const x = cx + lane * r * (0.44 + density * 0.24) * (1 - progress * 0.28) + drift;
      const y = baseY - rise;
      const fade = Math.sin(progress * Math.PI);
      const size = (0.7 + intensity * 1.3 + seed * 1.5) * (0.55 + fade * 0.75);
      const color = progress < 0.35 ? hexToNum(whiteHot) : lerpColor(secondaryColor, emberColor, progress);

      g.moveTo(x + r * 0.015, y + size * 2.2);
      g.lineTo(x - drift * 0.35, y - size * 1.4);
      g.stroke({ color, alpha: fade * (0.12 + intensity * 0.2), width: Math.max(0.45, size * 0.32) });
      g.circle(x, y, size * (1.8 + intensity)).fill({ color, alpha: fade * (0.04 + intensity * 0.08) });
      g.circle(x, y, size).fill({ color, alpha: fade * (0.42 + intensity * 0.36) });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // �?GLOW
  // ════════════════════════════════════════════════════════════════════

  private updateGlow(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.glowPhase += 0.015 * speedStep;
    const count = Math.floor(this.params.density / 2) + 15;
    const cx = cw / 2, cy = ch / 2, r = sz / 2;

    while (this.particles.length < count) {
      const isInner = Math.random() < 0.4;
      const dist = isInner ? sz * 0.2 + Math.random() * sz * 0.3 : sz * 0.5 + Math.random() * sz * 0.15;
      let x: number;
      let y: number;
      if (this.shape === 'circle') {
        const angle = Math.random() * Math.PI * 2;
        x = cx + Math.cos(angle) * dist;
        y = cy + Math.sin(angle) * dist;
      } else if (isInner) {
        const point = this.getRandomPointInShape(cx, cy, r, r * 0.28);
        x = point.x;
        y = point.y;
      } else {
        const t = Math.random();
        const half = Math.max(Math.min(dist, r - 6), 8);
        const cornerRadius = getSquareTrackCornerRadius(r, half);
        const point = this.getRoundRectPoint(cx, cy, half, cornerRadius, t);
        x = point.x;
        y = point.y;
      }

      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: 60 + Math.random() * 100,
        maxLife: 160,
        size: isInner ? 1 + Math.random() * 2 : 2 + Math.random() * 4,
        color: Math.random() > 0.5 ? this.params.color : this.params.secondaryColor,
        alpha: 0.5 + Math.random() * 0.5,
        flickerSpeed: 2 + Math.random() * 6,
        flickerPhase: Math.random() * Math.PI * 2,
      });
    }

    this.particles = this.particles.filter(p => {
      p.x += p.vx * speedStep;
      p.y += p.vy * speedStep;
      p.life -= speedStep;
      return p.life > 0;
    });
  }

  private drawGlow(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const breathe = 0.7 + Math.sin(this.glowPhase * 1.5) * 0.3;
    const intensity = this.params.intensity;
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);

    // Outer halo
    const haloRadius = r + intensity * 0.5;
    const gradSteps = 10;
    for (let i = 0; i <= gradSteps; i++) {
      const t = i / gradSteps;
      const radius = r * 0.6 + (haloRadius - r * 0.6) * t;
      let alpha: number;
      let color: number;
      if (t < 0.3) {
        alpha = 0;
        color = colorNum;
      } else if (t < 0.5) {
        alpha = 0.12 * breathe * ((t - 0.3) / 0.2);
        color = colorNum;
      } else if (t < 0.7) {
        alpha = 0.1 * breathe;
        color = colorNum;
      } else {
        alpha = 0.06 * breathe * (1 - (t - 0.7) / 0.3);
        color = secColorNum;
      }
      if (alpha > 0.001) {
        if (this.shape === 'circle') {
          g.circle(cx, cy, radius).fill({ color, alpha });
        } else {
          const cornerRadius = getSquareTrackCornerRadius(r, radius);
          g.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, cornerRadius).fill({ color, alpha });
        }
      }
    }

    // Rotating outer ring
    const ringR = r + haloRadius * 0.5;
    const arcLen = Math.PI * 0.8;
    const ringAngle = this.glowPhase * 0.3;

    const arcSteps = 32;
    if (this.shape === 'circle') {
      g.moveTo(
        cx + Math.cos(ringAngle) * ringR,
        cy + Math.sin(ringAngle) * ringR,
      );
      for (let i = 1; i <= arcSteps; i++) {
        const a = ringAngle + (arcLen * i) / arcSteps;
        g.lineTo(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
      }
      g.stroke({ width: 3, color: colorNum, alpha: 0.3 * breathe });
    } else {
      const half = Math.max(Math.min(ringR, r - 3), 8);
      const cornerRadius = getSquareTrackCornerRadius(r, half);
      const startT = (((ringAngle / (Math.PI * 2)) % 1) + 1) % 1;
      this.drawRoundRectSegment(g, cx, cy, half, cornerRadius, startT, startT + arcLen / (Math.PI * 2), {
        width: 3,
        color: colorNum,
        alpha: 0.3 * breathe,
      });
    }

    // Secondary arc
    const ringR2 = ringR + 5;
    const ringAngle2 = ringAngle + Math.PI;
    const arcLen2 = arcLen * 0.6;
    if (this.shape === 'circle') {
      g.moveTo(
        cx + Math.cos(ringAngle2) * ringR2,
        cy + Math.sin(ringAngle2) * ringR2,
      );
      for (let i = 1; i <= arcSteps; i++) {
        const a = ringAngle2 + (arcLen2 * i) / arcSteps;
        g.lineTo(cx + Math.cos(a) * ringR2, cy + Math.sin(a) * ringR2);
      }
      g.stroke({ width: 3, color: secColorNum, alpha: 0.18 * breathe });
    } else {
      const half = Math.max(Math.min(ringR2, r - 1), 8);
      const cornerRadius = getSquareTrackCornerRadius(r, half);
      const startT = (((ringAngle2 / (Math.PI * 2)) % 1) + 1) % 1;
      this.drawRoundRectSegment(g, cx, cy, half, cornerRadius, startT, startT + arcLen2 / (Math.PI * 2), {
        width: 3,
        color: secColorNum,
        alpha: 0.18 * breathe,
      });
    }

    // Inner bright ring
    const innerSteps = 6;
    for (let i = innerSteps; i >= 0; i--) {
      const t = i / innerSteps;
      const radius = (r - 3) + (r + 12 - (r - 3)) * t;
      const alpha = 0.15 * breathe * (1 - t) * 0.5;
      if (this.shape === 'circle') {
        g.circle(cx, cy, radius).fill({ color: colorNum, alpha });
      } else {
        const cornerRadius = getSquareTrackCornerRadius(r, radius);
        g.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, cornerRadius).fill({ color: colorNum, alpha });
      }
    }

    // Particles
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const fadeIn = lifeRatio > 0.85 ? (1 - lifeRatio) / 0.15 : 1;
      const fadeOut = lifeRatio < 0.2 ? lifeRatio / 0.2 : 1;
      const flicker = 0.5 + 0.5 * Math.sin(this.time * (p.flickerSpeed ?? 3) + (p.flickerPhase ?? 0));
      const a = lifeRatio * p.alpha * fadeIn * fadeOut * breathe;
      const pColor = hexToNum(p.color);

      // Big background glow
      g.circle(p.x, p.y, p.size * 2).fill({ color: pColor, alpha: a * 0.15 });
      // Small foreground with flicker
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * flicker });
      // Bright center
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * flicker * 0.8 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 💫 ORBIT
  // ════════════════════════════════════════════════════════════════════

  private updateOrbit(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.orbitAngle += 0.008 * speedStep;
    const cx = cw / 2, cy = ch / 2;
    const layerCount = 2 + Math.floor(this.params.intensity / 25);
    const targetPerLayer = Math.floor(this.params.density / layerCount / 3) + 3;
    const outerHalf = sz / 2;

    for (let layer = 0; layer < layerCount; layer++) {
      const maxR = this.shape === 'circle' ? sz / 2 - 10 : outerHalf - 14;
      const layerR = maxR - layer * 16;
      if (layerR <= 6) continue;
      const existing = this.particles.filter(p => p.orbitLayer === layer).length;
      const toSpawn = targetPerLayer - existing;
      for (let i = 0; i < toSpawn; i++) {
        const angle = this.shape === 'circle' ? Math.random() * Math.PI * 2 : Math.random();
        const speedMult = 1 + (layerCount - layer) * 0.3;
        const angularSpeed = (0.012 + Math.random() * 0.02) * speedMult;
        const isDust = Math.random() < 0.3;

        this.particles.push({
          x: cx + Math.cos(angle) * layerR,
          y: cy + Math.sin(angle) * layerR,
          vx: 0, vy: 0,
          angle,
          radius: layerR + (Math.random() - 0.5) * 6,
          angularSpeed: angularSpeed * (Math.random() > 0.5 ? 1 : -1),
          orbitLayer: layer,
          life: 300 + Math.random() * 300,
          maxLife: 600,
          size: isDust ? 0.5 + Math.random() * 1 : 1.5 + Math.random() * 3,
          color: isDust
            ? (Math.random() > 0.5 ? this.params.color : this.params.secondaryColor)
            : (layer % 2 === 0 ? this.params.color : this.params.secondaryColor),
          alpha: isDust ? 0.3 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4,
          trail: [],
        });
      }
    }

    this.particles = this.particles.filter(p => {
      if (this.shape === 'circle') {
        p.angle = (p.angle ?? 0) + (p.angularSpeed ?? 0) * speedStep;
        p.x = cx + Math.cos(p.angle ?? 0) * (p.radius ?? 0);
        p.y = cy + Math.sin(p.angle ?? 0) * (p.radius ?? 0);
      } else {
        p.angle = (((p.angle ?? 0) + ((p.angularSpeed ?? 0) * speedStep) / (Math.PI * 2)) % 1 + 1) % 1;
        const half = Math.max(Math.min(p.radius ?? 0, outerHalf - 4), 8);
        const cornerRadius = getSquareTrackCornerRadius(outerHalf, half);
        const pt = this.getRoundRectPoint(cx, cy, half, cornerRadius, p.angle ?? 0);
        p.x = pt.x;
        p.y = pt.y;
      }

      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 6) p.trail.shift();
      }

      p.life -= speedStep;
      return p.life > 0;
    });
  }

  private drawOrbit(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const layerCount = 2 + Math.floor(this.params.intensity / 25);
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);
    const outerHalf = sz / 2;

    // Dashed orbit rings
    for (let i = 0; i < layerCount; i++) {
      const maxR = this.shape === 'circle' ? sz / 2 - 15 : outerHalf - 15;
      const r = this.shape === 'circle' ? maxR - i * 15 : maxR - i * 16;
      if (r <= 6) continue;
      const ringColor = i % 2 === 0 ? colorNum : secColorNum;
      const dashCount = 40;
      for (let d = 0; d < dashCount; d++) {
        if (d % 2 === 0) {
          if (this.shape === 'circle') {
            const a1 = (d / dashCount) * Math.PI * 2;
            const a2 = ((d + 1) / dashCount) * Math.PI * 2;
            const steps = 4;
            g.moveTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
            for (let s = 1; s <= steps; s++) {
              const a = a1 + ((a2 - a1) * s) / steps;
              g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
            g.stroke({ width: 1, color: ringColor, alpha: 0.08 });
          } else {
            const cornerRadius = getSquareTrackCornerRadius(outerHalf, r);
            this.drawRoundRectSegment(
              g,
              cx,
              cy,
              r,
              cornerRadius,
              d / dashCount,
              (d + 1) / dashCount,
              { width: 1, color: ringColor, alpha: 0.08 },
            );
          }
        }
      }
    }

    // Draw particles with trails
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const fadeIn = lifeRatio > 0.9 ? (1 - lifeRatio) / 0.1 : 1;
      const fadeOut = lifeRatio < 0.15 ? lifeRatio / 0.15 : 1;
      const a = fadeIn * fadeOut * p.alpha;
      const pColor = hexToNum(p.color);

      // Trail
      if (p.trail && p.trail.length >= 2) {
        const trailAlphas = [0.2, 0.45];
        const trailCount = Math.min(2, p.trail.length);
        for (let i = 0; i < trailCount; i++) {
          const tp = p.trail[p.trail.length - trailCount + i];
          g.circle(tp.x, tp.y, p.size * 0.8).fill({ color: pColor, alpha: a * trailAlphas[i] });
        }
      }

      // Outer glow
      g.circle(p.x, p.y, p.size * 2.5).fill({ color: pColor, alpha: a * 0.3 });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * 0.65 });
      // Bright center
      g.circle(p.x, p.y, p.size * 0.35).fill({ color: 0xffffff, alpha: a * 0.85 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🔮 SHIELD
  // ════════════════════════════════════════════════════════════════════

  private updateShield(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.shieldPhase += 0.012 * speedStep;
    if (this.shieldHitTimer > 0) this.shieldHitTimer -= 0.02 * speedStep;

    const cx = cw / 2, cy = ch / 2;
    const intensity = this.params.intensity / 100;
    const segCount = Math.floor(this.params.density * (1.1 + intensity * 0.8)) + 20;
    const outerHalf = sz / 2;

    while (this.particles.length < segCount) {
      const angle = this.shape === 'circle' ? Math.random() * Math.PI * 2 : Math.random();
      const ring = Math.floor(Math.random() * 3);
      const baseR = this.shape === 'circle' ? sz / 2 - 15 + ring * 10 : sz / 2 - 32 + ring * 10;
      const isArc = Math.random() < 0.12 + intensity * 0.18;

      this.particles.push({
        x: 0, y: 0,
        vx: 0, vy: 0,
        angle,
        radius: baseR + (Math.random() - 0.5) * 5,
        angularSpeed: (0.007 + intensity * 0.01 + Math.random() * (0.012 + intensity * 0.018)) * (ring % 2 === 0 ? 1 : -1),
        orbitLayer: ring,
        life: isArc ? 10 + Math.random() * 20 : 400 + Math.random() * 300,
        maxLife: isArc ? 30 : 700,
        size: isArc
          ? 0.8 + intensity * 1.8 + Math.random() * 2
          : 1.1 + intensity * 1.6 + Math.random() * 2.5,
        color: ring === 0 ? this.params.color : ring === 1 ? this.params.secondaryColor : this.params.color,
        alpha: isArc ? 0.55 + intensity * 0.4 : 0.32 + intensity * 0.35 + Math.random() * 0.25,
        flowOffset: Math.random() * Math.PI * 2,
        trail: isArc ? [] : undefined,
      });
    }

    this.particles = this.particles.filter(p => {
      const pulse = 1 + Math.sin(this.shieldPhase * 3 + (p.angle ?? 0) * 2 + (p.flowOffset ?? 0)) * 0.02;
      const hitShake = this.shieldHitTimer > 0
        ? (Math.random() - 0.5) * this.shieldHitTimer * 3
        : 0;
      const r = (p.radius ?? 0) * pulse + hitShake;
      if (this.shape === 'circle') {
        p.angle = (p.angle ?? 0) + (p.angularSpeed ?? 0) * speedStep;
        p.x = cx + Math.cos(p.angle ?? 0) * r;
        p.y = cy + Math.sin(p.angle ?? 0) * r;
      } else {
        p.angle = (((p.angle ?? 0) + ((p.angularSpeed ?? 0) * speedStep) / (Math.PI * 2)) % 1 + 1) % 1;
        const half = Math.max(Math.min(r, outerHalf - 4), 8);
        const cornerRadius = getSquareTrackCornerRadius(outerHalf, half);
        const pt = this.getRoundRectPoint(cx, cy, half, cornerRadius, p.angle ?? 0);
        p.x = pt.x;
        p.y = pt.y;
      }

      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 5) p.trail.shift();
      }

      p.life -= speedStep;
      return p.life > 0;
    });

    if (Math.random() < 0.0015 + intensity * 0.003) {
      this.shieldHitTimer = 1;
    }
  }

  private drawShield(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const outerHalf = sz / 2;
    const baseR = this.shape === 'circle' ? sz / 2 - 15 : sz / 2 - 32;
    const flowAngle = this.shieldPhase * 0.5;
    const flowT = (((flowAngle / (Math.PI * 2)) % 1) + 1) % 1;
    const time = this.shieldPhase;
    const intensity = this.params.intensity / 100;
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);

    // Outer glow
    const outerAlpha = 0.38 + intensity * 0.48 + Math.sin(time * 2) * (0.1 + intensity * 0.14);
    const glowSteps = 8;
    for (let i = glowSteps; i >= 0; i--) {
      const t = i / glowSteps;
      const radius = (baseR - 5) + (baseR + 34 + intensity * 34 - (baseR - 5)) * t;
      const alpha = outerAlpha * (1 - t) * (0.055 + intensity * 0.07);
      if (this.shape === 'circle') {
        g.circle(cx, cy, radius).fill({ color: colorNum, alpha });
      } else {
        const cornerRadius = getSquareTrackCornerRadius(outerHalf, radius);
        g.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, cornerRadius).fill({ color: colorNum, alpha });
      }
    }

    // 3-layer shield rings
    const ringConfigs = [
      { r: baseR + 6,  alpha: 0.06 + intensity * 0.09, color: colorNum },
      { r: baseR + 16, alpha: 0.08 + intensity * 0.13, color: secColorNum },
      { r: baseR + 26, alpha: 0.1 + intensity * 0.16,  color: colorNum },
    ];

    const arcSteps = 64;
    for (const ring of ringConfigs) {
      const ringAlpha = ring.alpha + Math.sin(time * 2) * 0.03;
      if (this.shape === 'circle') {
        g.moveTo(cx + ring.r, cy);
        for (let i = 1; i <= arcSteps; i++) {
          const a = (i / arcSteps) * Math.PI * 2;
          g.lineTo(cx + Math.cos(a) * ring.r, cy + Math.sin(a) * ring.r);
        }
        g.closePath();
        g.stroke({ width: 0.9 + intensity * 1.4, color: ring.color, alpha: ringAlpha });
      } else {
        const cornerRadius = getSquareTrackCornerRadius(outerHalf, ring.r);
        g.roundRect(cx - ring.r, cy - ring.r, ring.r * 2, ring.r * 2, cornerRadius);
        g.stroke({ width: 0.9 + intensity * 1.4, color: ring.color, alpha: ringAlpha });
      }
    }

    // Flowing bright arc segments
    const arcCount = 4 + Math.round(intensity * 6);
    for (let i = 0; i < arcCount; i++) {
      const ringIdx = i % 3;
      const ring = ringConfigs[ringIdx];
      const baseAngle = (i / arcCount) * Math.PI * 2;
      const arcStart = baseAngle + time * (0.3 + ringIdx * 0.12);
      const arcLen = 0.16 + intensity * 0.18 + Math.sin(time * 1.5 + i * 0.8) * (0.06 + intensity * 0.08);
      const arcAlpha = 0.34 + intensity * 0.46 + Math.sin(time * 2 + i * 1.2) * (0.1 + intensity * 0.12);
      const arcColor = i % 2 === 0 ? 0xffffff : ring.color;

      if (this.shape === 'circle') {
        const steps = 16;
        g.moveTo(
          cx + Math.cos(arcStart) * ring.r,
          cy + Math.sin(arcStart) * ring.r,
        );
        for (let s = 1; s <= steps; s++) {
          const a = arcStart + (arcLen * s) / steps;
          g.lineTo(cx + Math.cos(a) * ring.r, cy + Math.sin(a) * ring.r);
        }
        g.stroke({ width: 1.4 + intensity * 2.2, color: arcColor, alpha: arcAlpha });
      } else {
        const cornerRadius = getSquareTrackCornerRadius(outerHalf, ring.r);
        const arcStartT = ((i / arcCount) + (time * (0.3 + ringIdx * 0.12)) / (Math.PI * 2)) % 1;
        const arcLenT = arcLen / (Math.PI * 2);
        this.drawRoundRectSegment(g, cx, cy, ring.r, cornerRadius, arcStartT, arcStartT + arcLenT, {
          width: 1.4 + intensity * 2.2,
          color: arcColor,
          alpha: arcAlpha,
        });
      }
    }

    // Hex grid pattern
    if (this.shape === 'circle') {
      const hexSize = 14;
      const hexR = baseR + 16;
      const hexPulse = 0.06 + intensity * 0.14 + Math.sin(time * 3) * (0.03 + intensity * 0.05);

      for (let row = -4; row <= 4; row++) {
        for (let col = -4; col <= 4; col++) {
          const hx = col * hexSize * 1.5;
          const hy = row * hexSize * Math.sqrt(3) + (col % 2 ? hexSize * Math.sqrt(3) / 2 : 0);
          const dist = Math.sqrt(hx * hx + hy * hy);
          if (dist < hexR - hexSize || dist > hexR + hexSize) continue;

          const cellAngle = Math.atan2(hy, hx);
          const flowDist = Math.abs(((cellAngle - flowAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const flowBright = flowDist < 0.8 ? 1 - flowDist / 0.8 : 0;

          const hexAlpha = hexPulse + flowBright * (0.08 + intensity * 0.14);
          const centerX = cx + hx;
          const centerY = cy + hy;
          const hexR2 = hexSize * 0.5;
          g.moveTo(
            centerX + Math.cos(Math.PI / 6) * hexR2,
            centerY + Math.sin(Math.PI / 6) * hexR2,
          );
          for (let v = 1; v < 6; v++) {
            const va = (v / 6) * Math.PI * 2 + Math.PI / 6;
            g.lineTo(centerX + Math.cos(va) * hexR2, centerY + Math.sin(va) * hexR2);
          }
          g.closePath();
          g.stroke({ width: 0.35 + intensity * 0.55, color: colorNum, alpha: hexAlpha });
        }
      }
    }

    // Edge arc sparks
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const a = lifeRatio * p.alpha;
      const isArc = p.maxLife < 50;
      const pColor = hexToNum(p.color);

      if (isArc && p.trail) {
        for (let i = 0; i < p.trail.length; i++) {
          const tp = p.trail[i];
          g.circle(tp.x, tp.y, p.size * 0.4).fill({ color: 0xffffff, alpha: a * (i / p.trail.length) * 0.4 });
        }
      }

      const pathPos = this.shape === 'circle'
        ? Math.atan2(p.y - cy, p.x - cx)
        : (p.angle ?? 0);
      const flowProx = this.shape === 'circle'
        ? Math.abs(((pathPos - flowAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
        : Math.min(
            Math.abs(pathPos - flowT),
            Math.abs(pathPos - flowT + 1),
            Math.abs(pathPos - flowT - 1),
          ) * Math.PI * 2;
      const flowMod = flowProx < 1 ? 1 + (1 - flowProx) * 0.5 : 1;

      // Outer glow
      g.circle(p.x, p.y, p.size * (1.5 + intensity * 1.5)).fill({ color: pColor, alpha: Math.min(1, a * flowMod * (0.1 + intensity * 0.18)) });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: Math.min(1, a * flowMod * (0.62 + intensity * 0.42)) });

      if (!isArc) {
        g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * flowMod * 0.5 });
      }
    }

    // Hit pulse effect
    if (this.shieldHitTimer > 0) {
      const hitSteps = 6;
      for (let i = hitSteps; i >= 0; i--) {
        const t = i / hitSteps;
        const radius = (baseR - 10) + (baseR + 30 - (baseR - 10)) * t;
        const alpha = this.shieldHitTimer * (0.16 + intensity * 0.28) * (1 - t) * 0.3;
        if (this.shape === 'circle') {
          g.circle(cx, cy, radius).fill({ color: 0xffffff, alpha });
        } else {
          const cornerRadius = getSquareTrackCornerRadius(outerHalf, radius);
          g.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, cornerRadius).fill({ color: 0xffffff, alpha });
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // ❄️ FROST
  // ════════════════════════════════════════════════════════════════════

  private updateFrost(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    const spd = speedStep;
    const densityFactor = this.params.density / 50;
    const intensity = this.params.intensity / 100;
    const targetCrystals = Math.floor((18 + intensity * 28) * densityFactor);

    if (this.frostCrystals.length > targetCrystals) {
      this.frostCrystals.length = targetCrystals;
    }

    // Spawn ice crystals at edge
    while (this.frostCrystals.length < targetCrystals) {
      const t = Math.random();
      const ep = this.getEdgePoint(cw, ch, sz, t);
      this.frostCrystals.push({
        x: ep.x, y: ep.y,
        angle: Math.random() * Math.PI * 2,
        size: 1.5 + intensity * 3 + Math.random() * 3,
        branchLen: 6 + intensity * 14 + Math.random() * 12,
      });
    }

    // Spawn snowflake particles from top
    const spawnRate = Math.floor(this.params.density / 8) + 2;
    for (let i = 0; i < spawnRate; i++) {
      this.particles.push({
        x: cw * Math.random(),
        y: -5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (0.3 + Math.random() * 0.8) * spd,
        life: 200 + Math.random() * 200,
        maxLife: 400,
        size: 0.8 + intensity * 1.2 + Math.random() * 2.3,
        color: Math.random() > 0.5 ? this.params.color : this.params.secondaryColor,
        alpha: 0.35 + intensity * 0.35 + Math.random() * 0.3,
        rotAngle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        flickerPhase: Math.random() * Math.PI * 2,
      });
    }

    // Spawn edge frost particles that spread inward
    const edgeSpawn = Math.floor(this.params.density / 10) + 1;
    for (let i = 0; i < edgeSpawn; i++) {
      const t = Math.random();
      const ep = this.getEdgePoint(cw, ch, sz, t);
      this.particles.push({
        x: ep.x + (Math.random() - 0.5) * 6,
        y: ep.y + (Math.random() - 0.5) * 6,
        vx: (ep.nx * (-0.2 - Math.random() * 0.5) + (Math.random() - 0.5) * 0.2) * spd,
        vy: (ep.ny * (-0.2 - Math.random() * 0.5) + (Math.random() - 0.5) * 0.2) * spd,
        life: 80 + Math.random() * 120,
        maxLife: 200,
        size: 0.8 + intensity * 1.2 + Math.random() * 1.8,
        color: Math.random() > 0.5 ? this.params.secondaryColor : this.params.color,
        alpha: 0.45 + intensity * 0.35 + Math.random() * 0.2,
      });
    }

    this.particles = this.particles.filter(p => {
      p.x += p.vx * speedStep;
      p.y += p.vy * speedStep;
      // Snowflakes sway
      if (p.rotSpeed !== undefined) {
        p.vx += Math.sin(this.time * 2 + (p.flickerPhase ?? 0)) * 0.02 * speedStep;
        p.rotAngle = (p.rotAngle ?? 0) + (p.rotSpeed ?? 0) * speedStep;
      }
      p.life -= speedStep;
      return p.life > 0 && p.y < ch + 10;
    });
  }

  private drawFrost(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const intensity = this.params.intensity / 100;
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);

    // Background ice glow
    const glowAlpha = 0.025 + intensity * 0.04 + Math.sin(this.time * 0.5) * 0.015;
    for (let i = 5; i >= 0; i--) {
      const t = i / 5;
      const radius = r * 0.8 + (r * 1.3 - r * 0.8) * t;
      g.circle(cx, cy, radius).fill({ color: secColorNum, alpha: glowAlpha * (1 - t) });
    }

    // Draw frost crystals (branching lines at edges)
    for (const crystal of this.frostCrystals) {
      const alpha = 0.3 + Math.sin(this.time + crystal.angle) * 0.15;
      // Main branch
      const x2 = crystal.x + Math.cos(crystal.angle) * crystal.branchLen;
      const y2 = crystal.y + Math.sin(crystal.angle) * crystal.branchLen;
      g.moveTo(crystal.x, crystal.y);
      g.lineTo(x2, y2);
      g.stroke({ width: 0.65 + intensity * 0.8, color: colorNum, alpha });

      // Sub-branches
      for (let i = 0; i < 2; i++) {
        const t = 0.4 + i * 0.3;
        const mx = crystal.x + (x2 - crystal.x) * t;
        const my = crystal.y + (y2 - crystal.y) * t;
        const subAngle = crystal.angle + (i === 0 ? 0.6 : -0.6);
        const subLen = crystal.branchLen * 0.4;
        g.moveTo(mx, my);
        g.lineTo(mx + Math.cos(subAngle) * subLen, my + Math.sin(subAngle) * subLen);
        g.stroke({ width: 0.45 + intensity * 0.45, color: secColorNum, alpha: alpha * 0.7 });
      }
    }

    // Draw particles
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const fadeIn = lifeRatio > 0.9 ? (1 - lifeRatio) / 0.1 : 1;
      const fadeOut = lifeRatio < 0.15 ? lifeRatio / 0.15 : 1;
      const a = lifeRatio * p.alpha * fadeIn * fadeOut;
      const pColor = hexToNum(p.color);

      // Glow
      g.circle(p.x, p.y, p.size * 2.5).fill({ color: pColor, alpha: a * 0.12 });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * 0.7 });
      // Bright center
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * 0.9 });

      // Snowflake arms (for larger snowflakes)
      if (p.rotSpeed !== undefined && p.size > 1.5) {
        const armLen = p.size * 2;
        const angle = p.rotAngle ?? 0;
        for (let i = 0; i < 6; i++) {
          const a2 = angle + (i / 6) * Math.PI * 2;
          g.moveTo(p.x, p.y);
          g.lineTo(p.x + Math.cos(a2) * armLen, p.y + Math.sin(a2) * armLen);
          g.stroke({ width: 0.5, color: colorNum, alpha: a * 0.4 });
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🌊 RIPPLE
  // ════════════════════════════════════════════════════════════════════

  private updateRipple(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.ripplePhase += 0.02 * speedStep;

    // Spawn shimmer particles at edge
    const spawnRate = Math.floor(this.params.density / 10) + 1;
    for (let i = 0; i < spawnRate; i++) {
      const t = Math.random();
      const ep = this.getEdgePoint(cw, ch, sz, t);
      this.particles.push({
        x: ep.x + (Math.random() - 0.5) * 8,
        y: ep.y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 40 + Math.random() * 60,
        maxLife: 100,
        size: 0.8 + Math.random() * 1.5,
        color: Math.random() > 0.5 ? this.params.color : mixHex(this.params.secondaryColor, '#ffffff', 0.35),
        alpha: 0.4 + Math.random() * 0.6,
        flickerSpeed: 3 + Math.random() * 5,
        flickerPhase: Math.random() * Math.PI * 2,
      });
    }

    this.particles = this.particles.filter(p => {
      p.x += p.vx * speedStep;
      p.y += p.vy * speedStep;
      p.life -= speedStep;
      return p.life > 0;
    });
  }

  private drawRipple(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const phase = this.ripplePhase;
    const intensity = this.params.intensity / 100;
    const ringCount = 4 + Math.floor(intensity * 3);
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);

    // Concentric expanding rings
    for (let i = 0; i < ringCount; i++) {
      const t = ((phase + i / ringCount) % 1);
      const radius = r * 0.3 + t * r * 0.9;
      const alpha = (1 - t) * 0.35 * (0.5 + Math.sin(phase * 3 + i) * 0.3);
      if (alpha > 0.005) {
        const width = 1.5 + (1 - t) * 1.5;
        if (this.shape === 'circle') {
          g.circle(cx, cy, radius).stroke({ width, color: colorNum, alpha });
        } else {
          const cornerRadius = getSquareTrackCornerRadius(r, radius);
          g.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, cornerRadius)
            .stroke({ width, color: colorNum, alpha });
        }
      }
    }

    // Secondary phase rings
    for (let i = 0; i < ringCount - 1; i++) {
      const t = ((phase * 0.7 + 0.3 + i / (ringCount - 1)) % 1);
      const radius = r * 0.2 + t * r * 0.85;
      const alpha = (1 - t) * 0.2 * (0.5 + Math.cos(phase * 2 + i * 1.5) * 0.3);
      if (alpha > 0.005) {
        if (this.shape === 'circle') {
          g.circle(cx, cy, radius).stroke({ width: 1, color: secColorNum, alpha });
        } else {
          const cornerRadius = getSquareTrackCornerRadius(r, radius);
          g.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, cornerRadius)
            .stroke({ width: 1, color: secColorNum, alpha });
        }
      }
    }

    // Water surface glow
    const glowAlpha = 0.03 + Math.sin(phase * 2) * 0.015;
    for (let i = 4; i >= 0; i--) {
      const t = i / 4;
      const radius = r * (0.5 + t * 0.6);
      const alpha = glowAlpha * (1 - t);
      if (this.shape === 'circle') {
        g.circle(cx, cy, radius).fill({ color: colorNum, alpha });
      } else {
        const cornerRadius = getSquareTrackCornerRadius(r, radius);
        g.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, cornerRadius)
          .fill({ color: colorNum, alpha });
      }
    }

    // Shimmer particles
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const flicker = 0.5 + 0.5 * Math.sin(this.time * (p.flickerSpeed ?? 4) + (p.flickerPhase ?? 0));
      const a = lifeRatio * p.alpha * flicker;
      const pColor = hexToNum(p.color);
      g.circle(p.x, p.y, p.size * 2.5).fill({ color: pColor, alpha: a * 0.22 });
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * 0.8 });
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * 0.95 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🌸 PETAL
  // ════════════════════════════════════════════════════════════════════

  private updatePetal(cw: number, ch: number, _sz: number) {
    const speedStep = this.getSpeedStep();
    this.petalTime += 0.016 * speedStep;
    const intensity = this.params.intensity / 100;

    // Spawn petals from top (gradually ramp up)
    const warmup = Math.min(1, this.petalTime / 2);
    const spawnRate = Math.floor(this.params.density / 10) + 1;
    const petalColors = [
      this.params.color,
      this.params.secondaryColor,
      mixHex(this.params.color, this.params.secondaryColor, 0.5),
      mixHex(this.params.secondaryColor, '#ffffff', 0.5),
      '#ffffff',
    ];
    for (let i = 0; i < spawnRate * warmup; i++) {
      this.particles.push({
        x: Math.random() * cw,
        y: -10 - Math.random() * 20,
        vx: (Math.random() - 0.5) * (0.35 + intensity * 0.45),
        vy: 0.35 + intensity * 0.45 + Math.random() * (0.8 + intensity * 0.8),
        life: 200 + Math.random() * 300,
        maxLife: 500,
        size: 2.2 + intensity * 2.8 + Math.random() * 4,
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        alpha: 0.45 + intensity * 0.35 + Math.random() * 0.25,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.8 + intensity * 1.1 + Math.random() * 2,
        rotAngle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
      });
    }

    this.particles = this.particles.filter(p => {
      // Swaying motion
      p.x += (p.vx + Math.sin(this.petalTime * (p.swaySpeed ?? 1.5) + (p.swayPhase ?? 0)) * 0.8) * speedStep;
      p.y += p.vy * speedStep;
      p.rotAngle = (p.rotAngle ?? 0) + (p.rotSpeed ?? 0) * speedStep;
      p.vy += 0.002 * speedStep; // slight gravity
      p.vy *= Math.pow(0.999, speedStep); // terminal velocity
      p.life -= speedStep;
      return p.life > 0 && p.y < ch + 20;
    });
  }

  private drawPetal(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    const intensity = this.params.intensity / 100;

    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const fadeIn = lifeRatio > 0.9 ? (1 - lifeRatio) / 0.1 : 1;
      const fadeOut = lifeRatio < 0.1 ? lifeRatio / 0.1 : 1;
      const a = lifeRatio * p.alpha * fadeIn * fadeOut;
      const pColor = hexToNum(p.color);
      const angle = p.rotAngle ?? 0;

      // Draw petal as rotated ellipse (diamond shape)
      const w = p.size;
      const h = p.size * 1.5;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // 4-point diamond
      const points = [
        { x: p.x + cosA * w, y: p.y + sinA * w },
        { x: p.x - sinA * h, y: p.y + cosA * h },
        { x: p.x - cosA * w, y: p.y - sinA * w },
        { x: p.x + sinA * h, y: p.y - cosA * h },
      ];

      g.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i].x, points[i].y);
      }
      g.closePath();
      g.fill({ color: pColor, alpha: a * 0.8 });
      // Soft glow
      g.circle(p.x, p.y, p.size * (1.4 + intensity * 1.4)).fill({ color: pColor, alpha: a * (0.1 + intensity * 0.16) });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // �?STARDUST
  // ════════════════════════════════════════════════════════════════════

  private updateStardust(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.stardustTime += 0.016 * speedStep;
    const cx = cw / 2, cy = ch / 2;
    const intensity = this.params.intensity / 100;

    // Maintain star particles around edge
    const targetCount = Math.floor(this.params.density * (0.9 + intensity * 0.65)) + 20;
    if (this.particles.length > targetCount) {
      this.particles.length = targetCount;
    }
    while (this.particles.length < targetCount) {
      const angle = Math.random() * Math.PI * 2;
      const dist = sz * 0.35 + Math.random() * sz * 0.3;
      const isNebula = Math.random() < 0.08 + intensity * 0.14;
      let x: number;
      let y: number;
      if (this.shape === 'circle') {
        x = cx + Math.cos(angle) * dist;
        y = cy + Math.sin(angle) * dist;
      } else {
        const point = this.getRandomPointInShape(cx, cy, sz / 2, isNebula ? sz * 0.06 : sz * 0.02);
        x = point.x;
        y = point.y;
      }
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        life: 300 + Math.random() * 500,
        maxLife: 800,
        size: isNebula
          ? 8 + intensity * 14 + Math.random() * (12 + intensity * 16)
          : 0.4 + intensity * 1.2 + Math.random() * (1.2 + intensity * 1.8),
        color: isNebula
          ? (Math.random() > 0.5
              ? mixHex(this.params.color, '#050014', 0.72)
              : mixHex(this.params.secondaryColor, '#050014', 0.72))
          : (Math.random() > 0.5 ? this.params.color : this.params.secondaryColor),
        alpha: isNebula
          ? 0.025 + intensity * 0.075 + Math.random() * 0.06
          : 0.22 + intensity * 0.4 + Math.random() * 0.35,
        flickerSpeed: 1 + Math.random() * 4,
        flickerPhase: Math.random() * Math.PI * 2,
        angle,
        angularSpeed: (Math.random() - 0.5) * 0.003,
      });
    }

    // Spawn meteors occasionally
    this.meteorTimer += speedStep;
    const meteorInterval = Math.max(30, 120 - this.params.density);
    if (this.meteorTimer >= meteorInterval) {
      this.meteorTimer = 0;
      const side = Math.random();
      let mx: number, my: number, mvx: number, mvy: number;
      if (side < 0.5) {
        mx = Math.random() * cw * 0.5;
        my = -10;
        mvx = (2 + Math.random() * 3) * (0.75 + intensity * 0.75);
        mvy = (1.5 + Math.random() * 2) * (0.75 + intensity * 0.75);
      } else {
        mx = cw + 10;
        my = Math.random() * ch * 0.3;
        mvx = -(2 + Math.random() * 3) * (0.75 + intensity * 0.75);
        mvy = (1.5 + Math.random() * 2) * (0.75 + intensity * 0.75);
      }
      this.meteors.push({ x: mx, y: my, vx: mvx, vy: mvy, life: 40, maxLife: 40, length: 12 + intensity * 24 + Math.random() * 18 });
    }

    // Update particles with slow rotation
    this.particles = this.particles.filter(p => {
      p.angle = (p.angle ?? 0) + (p.angularSpeed ?? 0) * speedStep;
      if (this.shape === 'circle') {
        const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        const a2 = Math.atan2(p.y - cy, p.x - cx) + (p.angularSpeed ?? 0) * speedStep;
        p.x = cx + Math.cos(a2) * dist;
        p.y = cy + Math.sin(a2) * dist;
      } else {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const turn = (p.angularSpeed ?? 0) * speedStep;
        p.x += -dy * turn * 0.18;
        p.y += dx * turn * 0.18;
      }
      p.x += p.vx * speedStep;
      p.y += p.vy * speedStep;
      if (!this.isInsideShapePoint(p.x, p.y, cx, cy, sz / 2, -8)) {
        const projected = this.projectInsideShapePoint(p.x, p.y, cx, cy, sz / 2, -8);
        p.x = projected.x;
        p.y = projected.y;
        p.vx *= -0.25;
        p.vy *= -0.25;
      }
      p.life -= speedStep;
      return p.life > 0;
    });

    // Update meteors
    this.meteors = this.meteors.filter(m => {
      m.x += m.vx * speedStep;
      m.y += m.vy * speedStep;
      m.life -= speedStep;
      return m.life > 0;
    });
  }

  private drawStardust(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    const intensity = this.params.intensity / 100;
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);

    // Background nebula glow
    for (const p of this.particles) {
      if (p.size > 8) {
        const a = p.alpha * (0.7 + Math.sin(this.stardustTime * 0.3 + (p.flickerPhase ?? 0)) * 0.3);
        const pColor = hexToNum(p.color);
        g.circle(p.x, p.y, p.size * (0.8 + intensity * 0.45)).fill({ color: pColor, alpha: a });
      }
    }

    // Star particles
    for (const p of this.particles) {
      if (p.size > 8) continue; // skip nebula
      const lifeRatio = p.life / p.maxLife;
      const flicker = 0.4 + 0.6 * Math.sin(this.stardustTime * (p.flickerSpeed ?? 2) + (p.flickerPhase ?? 0));
      const a = lifeRatio * p.alpha * flicker;
      const pColor = hexToNum(p.color);

      // Outer glow
      g.circle(p.x, p.y, p.size * (2.5 + intensity * 2.4)).fill({ color: pColor, alpha: a * (0.08 + intensity * 0.16) });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * (0.55 + intensity * 0.35) });
      // Bright center
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * 1.0 });
    }

    // Meteors
    for (const m of this.meteors) {
      const a = m.life / m.maxLife;
      // Trail segments
      for (let i = 0; i < 8; i++) {
        const t = i / 8;
        const px = m.x - m.vx * t * m.length * 0.15;
        const py = m.y - m.vy * t * m.length * 0.15;
        const segAlpha = a * (1 - t) * 0.6;
        g.circle(px, py, (1.2 + intensity * 0.8) * (1 - t * 0.7)).fill({ color: 0xffffff, alpha: segAlpha });
        g.circle(px, py, (2.4 + intensity * 2.2) * (1 - t * 0.7)).fill({ color: secColorNum, alpha: segAlpha * (0.2 + intensity * 0.2) });
      }
      // Head
      g.circle(m.x, m.y, 1.5 + intensity * 1.2).fill({ color: 0xffffff, alpha: a });
      g.circle(m.x, m.y, 4 + intensity * 3).fill({ color: colorNum, alpha: a * (0.22 + intensity * 0.18) });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 💎 PRISM
  // ════════════════════════════════════════════════════════════════════

  private updatePrism(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.prismTime += 0.016 * speedStep;
    const intensity = this.params.intensity / 100;

    // Rainbow colors cycling
    const rainbowColors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0x4400ff, 0x8800ff];

    // Spawn rainbow particles at edge
    const spawnRate = Math.floor(this.params.density / 8) + 2;
    for (let i = 0; i < spawnRate; i++) {
      const t = Math.random();
      const ep = this.getEdgePoint(cw, ch, sz, t);
      const colorIdx = Math.floor((this.prismTime * 3 + Math.random() * 7)) % 7;

      this.particles.push({
        x: ep.x + (Math.random() - 0.5) * 4,
        y: ep.y + (Math.random() - 0.5) * 4,
        vx: -ep.nx * (0.35 + intensity * 0.9 + Math.random() * (0.9 + intensity * 1.3)),
        vy: -ep.ny * (0.35 + intensity * 0.9 + Math.random() * (0.9 + intensity * 1.3)),
        life: 50 + Math.random() * 80,
        maxLife: 130,
        size: 0.9 + intensity * 2.2 + Math.random() * (1.6 + intensity * 2.2),
        color: '#' + rainbowColors[colorIdx].toString(16).padStart(6, '0'),
        alpha: 0.32 + intensity * 0.42 + Math.random() * 0.26,
        trail: [],
      });
    }

    this.particles = this.particles.filter(p => {
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 5) p.trail.shift();
      }
      p.x += p.vx * speedStep;
      p.y += p.vy * speedStep;
      p.vx *= Math.pow(0.99, speedStep);
      p.vy *= Math.pow(0.99, speedStep);
      p.life -= speedStep;
      return p.life > 0;
    });
  }

  private drawPrism(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const time = this.prismTime;
    const intensity = this.params.intensity / 100;
    const rainbowColors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0x4400ff, 0x8800ff];

    // Prismatic light rays from edge
    const rayCount = 7;
    for (let i = 0; i < rayCount; i++) {
      const baseAngle = (i / rayCount) * Math.PI * 2 + time * 0.2;
      const rayLen = r * (0.28 + intensity * 0.22) + Math.sin(time * 2 + i) * r * (0.06 + intensity * 0.08);
      const innerR = r * 0.6;
      const x1 = cx + Math.cos(baseAngle) * innerR;
      const y1 = cy + Math.sin(baseAngle) * innerR;
      const x2 = cx + Math.cos(baseAngle) * (innerR + rayLen);
      const y2 = cy + Math.sin(baseAngle) * (innerR + rayLen);
      const alpha = 0.12 + intensity * 0.32 + Math.sin(time * 3 + i * 0.8) * (0.08 + intensity * 0.08);

      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke({ width: 1.4 + intensity * 2.2, color: rainbowColors[i], alpha });

      // Glow around ray
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      g.circle(mx, my, 5 + intensity * 8).fill({ color: rainbowColors[i], alpha: alpha * (0.16 + intensity * 0.16) });
    }

    // Prismatic halo
    for (let i = 0; i < 7; i++) {
      const t = (time * 0.5 + i / 7) % 1;
      const haloR = r * 0.55 + t * r * 0.25;
      const alpha = (0.04 + intensity * 0.08) * (1 - t);
      g.circle(cx, cy, haloR).stroke({ width: 0.8 + intensity * 1.4, color: rainbowColors[i], alpha });
    }

    // White incoming beam
    const beamAngle = time * 0.3;
    const beamLen = r * 1.1;
    g.moveTo(cx - Math.cos(beamAngle) * beamLen, cy - Math.sin(beamAngle) * beamLen);
    g.lineTo(cx + Math.cos(beamAngle) * r * 0.3, cy + Math.sin(beamAngle) * r * 0.3);
    g.stroke({ width: 1 + intensity * 2.2, color: 0xffffff, alpha: 0.08 + intensity * 0.2 + Math.sin(time) * 0.08 });

    // Particles with trails
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const a = lifeRatio * p.alpha;
      const pColor = hexToNum(p.color);

      // Trail
      if (p.trail && p.trail.length >= 2) {
        for (let i = 0; i < p.trail.length; i++) {
          const tp = p.trail[i];
          g.circle(tp.x, tp.y, p.size * 0.5).fill({ color: pColor, alpha: a * (i / p.trail.length) * 0.3 });
        }
      }

      g.circle(p.x, p.y, p.size * (1.4 + intensity)).fill({ color: pColor, alpha: a * (0.08 + intensity * 0.16) });
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * (0.55 + intensity * 0.35) });
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * (0.35 + intensity * 0.35) });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🌪�?VORTEX
  // ════════════════════════════════════════════════════════════════════

  private updateVortex(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.vortexTime += 0.016 * speedStep;
    const cx = cw / 2, cy = ch / 2;
    const armCount = 3 + Math.floor(this.params.intensity / 25);

    // Spawn spiral particles
    const targetCount = Math.floor(this.params.density * 2) + 30;
    while (this.particles.length < targetCount) {
      const arm = Math.floor(Math.random() * armCount);
      const dist = sz * 0.15 + Math.random() * sz * 0.45;
      const armAngle = (arm / armCount) * Math.PI * 2;
      const spiralOffset = dist * 0.02; // tighter spiral near center
      const angle = armAngle + spiralOffset + (Math.random() - 0.5) * 0.3;

      this.particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0, vy: 0,
        life: 200 + Math.random() * 300,
        maxLife: 500,
        size: 1 + Math.random() * 2.5,
        color: Math.random() > 0.5 ? this.params.color : this.params.secondaryColor,
        alpha: 0.4 + Math.random() * 0.6,
        spiralAngle: angle,
        spiralRadius: dist,
        spiralSpeed: 0.02 + Math.random() * 0.03,
        trail: [],
        angle: armAngle,
      });
    }

    this.particles = this.particles.filter(p => {
      const oldX = p.x, oldY = p.y;
      p.spiralAngle = (p.spiralAngle ?? 0) + (p.spiralSpeed ?? 0.02) * speedStep;
      // Spiral inward slowly
      p.spiralRadius = (p.spiralRadius ?? 0) - 0.1 * speedStep;
      if ((p.spiralRadius ?? 0) < sz * 0.08) {
        p.spiralRadius = sz * 0.08 + Math.random() * sz * 0.1;
      }

      p.x = cx + Math.cos(p.spiralAngle ?? 0) * (p.spiralRadius ?? 0);
      p.y = cy + Math.sin(p.spiralAngle ?? 0) * (p.spiralRadius ?? 0);

      if (p.trail) {
        p.trail.push({ x: oldX, y: oldY, alpha: p.alpha, size: p.size });
        if (p.trail.length > 6) p.trail.shift();
      }

      p.life -= speedStep;
      return p.life > 0;
    });
  }

  private drawVortex(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const time = this.vortexTime;
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);

    // Wind eye - center void with surrounding glow
    const eyeR = r * 0.12;
    for (let i = 6; i >= 0; i--) {
      const t = i / 6;
      const radius = eyeR + (eyeR * 3) * t;
      const alpha = 0.06 * (1 - t);
      g.circle(cx, cy, radius).fill({ color: secColorNum, alpha });
    }

    // Spiral guide lines (faint)
    const armCount = 3 + Math.floor(this.params.intensity / 25);
    for (let arm = 0; arm < armCount; arm++) {
      const baseAngle = (arm / armCount) * Math.PI * 2;
      const steps = 40;
      const points: Array<{ x: number; y: number }> = [];
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const dist = eyeR + t * (r - eyeR);
        const spiralAngle = baseAngle + t * 3 + time * 0.5;
        points.push({
          x: cx + Math.cos(spiralAngle) * dist,
          y: cy + Math.sin(spiralAngle) * dist,
        });
      }
      g.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i].x, points[i].y);
      }
      g.stroke({ width: 0.8, color: colorNum, alpha: 0.08 });
    }

    // Particles with trails
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const fadeIn = lifeRatio > 0.9 ? (1 - lifeRatio) / 0.1 : 1;
      const fadeOut = lifeRatio < 0.1 ? lifeRatio / 0.1 : 1;
      const a = lifeRatio * p.alpha * fadeIn * fadeOut;
      const pColor = hexToNum(p.color);

      // Trail
      if (p.trail && p.trail.length >= 2) {
        for (let i = 0; i < p.trail.length; i++) {
          const tp = p.trail[i];
          g.circle(tp.x, tp.y, p.size * 0.5).fill({ color: pColor, alpha: a * (i / p.trail.length) * 0.25 });
        }
      }

      // Outer glow
      g.circle(p.x, p.y, p.size * 2.5).fill({ color: pColor, alpha: a * 0.2 });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * 0.8 });
      // Bright center
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * 0.7 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🎆 FIREWORK
  // ════════════════════════════════════════════════════════════════════

  private updateFirework(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.fireworkTimer += speedStep;
    const intensity = this.params.intensity / 100;

    // Spawn new firework burst
    const burstInterval = Math.max(20, 80 - Math.floor(this.params.density / 2));
    if (this.fireworkTimer >= burstInterval) {
      this.fireworkTimer = 0;

      // Random position inside the shape (not just the edge)
      const cx = cw / 2, cy = ch / 2;
      let bx: number, by: number;
      if (this.shape === 'circle') {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * sz / 2;
        bx = cx + Math.cos(angle) * r;
        by = cy + Math.sin(angle) * r;
      } else {
        bx = cx + (Math.random() - 0.5) * sz;
        by = cy + (Math.random() - 0.5) * sz;
      }
      const burstParticles: Particle[] = [];
      const particleCount = 15 + Math.floor(this.params.intensity / 3);
      const burstColors = [
        this.params.color,
        this.params.secondaryColor,
        mixHex(this.params.color, this.params.secondaryColor, 0.35),
        mixHex(this.params.color, this.params.secondaryColor, 0.65),
        mixHex(this.params.color, '#ffffff', 0.45),
        mixHex(this.params.secondaryColor, '#ffffff', 0.45),
        '#ffffff',
      ];
      const burstColor = burstColors[Math.floor(Math.random() * burstColors.length)];
      const burstColor2 = burstColors[Math.floor(Math.random() * burstColors.length)];

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const speed = 1.5 + Math.random() * 3 * (this.params.intensity / 50);
        burstParticles.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 40 + Math.random() * 30,
          maxLife: 70,
          size: 1.1 + intensity * 1.2 + Math.random() * (1.2 + intensity * 1.4),
          color: Math.random() > 0.4 ? burstColor : burstColor2,
          alpha: 0.55 + intensity * 0.3 + Math.random() * 0.15,
          trail: [],
        });
      }

      this.fireworkBursts.push({
        x: bx,
        y: by,
        particles: burstParticles,
        life: 70,
      });
    }

    // Update bursts
    this.fireworkBursts = this.fireworkBursts.filter(burst => {
      burst.particles = burst.particles.filter(p => {
        if (p.trail) {
          p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
          if (p.trail.length > 5) p.trail.shift();
        }
        p.x += p.vx * speedStep;
        p.y += p.vy * speedStep;
        p.vy += 0.04 * speedStep; // gravity
        p.vx *= Math.pow(0.98, speedStep);
        p.vy *= Math.pow(0.98, speedStep);
        p.size *= Math.pow(0.995, speedStep);
        p.life -= speedStep;
        return p.life > 0;
      });
      burst.life -= speedStep;
      return burst.life > 0 && burst.particles.length > 0;
    });
  }

  private drawFirework(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    for (const burst of this.fireworkBursts) {
      // Flash at burst center
      const flashAlpha = burst.life > 60 ? (burst.life - 60) / 10 * 0.3 : 0;
      if (flashAlpha > 0) {
        g.circle(burst.x, burst.y, 20).fill({ color: 0xffffff, alpha: flashAlpha });
      }

      for (const p of burst.particles) {
        const lifeRatio = p.life / p.maxLife;
        const a = lifeRatio * p.alpha;
        const pColor = hexToNum(p.color);

        // Trail
        if (p.trail) {
          for (let i = 0; i < p.trail.length; i++) {
            const tp = p.trail[i];
            g.circle(tp.x, tp.y, p.size * 0.4).fill({ color: pColor, alpha: a * (i / p.trail.length) * 0.3 });
          }
        }

        // Glow
        g.circle(p.x, p.y, p.size * 2.5).fill({ color: pColor, alpha: a * 0.25 });
        // Core
        g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * 0.9 });
        // Spark center
        g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * 0.8 });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // �?GOLD
  // ════════════════════════════════════════════════════════════════════

  private updateGold(cw: number, ch: number, _sz: number) {
    const speedStep = this.getSpeedStep();
    this.goldTime += 0.016 * speedStep;
    const intensity = this.params.intensity / 100;

    // Spawn gold particles from top
    const spawnRate = Math.floor(this.params.density / 8) + 2;
    const goldColors = [
      this.params.color,
      this.params.secondaryColor,
      mixHex(this.params.color, this.params.secondaryColor, 0.45),
      mixHex(this.params.secondaryColor, '#ffffff', 0.5),
      '#ffffff',
    ];
    for (let i = 0; i < spawnRate; i++) {
      const isDust = Math.random() < 0.4;
      this.particles.push({
        x: Math.random() * cw,
        y: -5 - Math.random() * 15,
        vx: (Math.random() - 0.5) * (0.25 + intensity * 0.35),
        vy: 0.3 + intensity * 0.35 + Math.random() * (0.7 + intensity * 0.7),
        life: 150 + Math.random() * 250,
        maxLife: 400,
        size: isDust
          ? 0.35 + intensity * 0.65 + Math.random() * 1
          : 1.4 + intensity * 2.2 + Math.random() * 3.2,
        color: goldColors[Math.floor(Math.random() * goldColors.length)],
        alpha: isDust
          ? 0.22 + intensity * 0.24 + Math.random() * 0.3
          : 0.42 + intensity * 0.38 + Math.random() * 0.2,
        flickerSpeed: 4 + Math.random() * 8,
        flickerPhase: Math.random() * Math.PI * 2,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.5 + Math.random() * 1.5,
      });
    }

    this.particles = this.particles.filter(p => {
      p.x += (p.vx + Math.sin(this.goldTime * (p.swaySpeed ?? 1) + (p.swayPhase ?? 0)) * 0.3) * speedStep;
      p.y += p.vy * speedStep;
      p.vy += 0.001 * speedStep;
      p.life -= speedStep;
      return p.life > 0 && p.y < ch + 10;
    });
  }

  private drawGold(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    // Background warm glow
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const intensity = this.params.intensity / 100;
    const glowAlpha = 0.012 + intensity * 0.025 + Math.sin(this.goldTime * 1.5) * 0.01;
    const colorNum = hexToNum(this.params.color);
    for (let i = 4; i >= 0; i--) {
      const t = i / 4;
      g.circle(cx, cy, r * (0.6 + t * 0.5)).fill({ color: colorNum, alpha: glowAlpha * (1 - t) });
    }

    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const fadeIn = lifeRatio > 0.9 ? (1 - lifeRatio) / 0.1 : 1;
      const fadeOut = lifeRatio < 0.1 ? lifeRatio / 0.1 : 1;
      const flicker = 0.3 + 0.7 * Math.abs(Math.sin(this.goldTime * (p.flickerSpeed ?? 6) + (p.flickerPhase ?? 0)));
      const a = lifeRatio * p.alpha * fadeIn * fadeOut * flicker;
      const pColor = hexToNum(p.color);

      // Outer glow
      g.circle(p.x, p.y, p.size * (2.4 + intensity * 2.4)).fill({ color: pColor, alpha: a * (0.08 + intensity * 0.14) });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * (0.56 + intensity * 0.32) });
      // Bright center
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * 0.95 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🔄 SPIN
  // ════════════════════════════════════════════════════════════════════

  private updateSpin(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.spinTime += 0.016 * speedStep;
    const cx = cw / 2, cy = ch / 2;
    const ringCount = 2 + Math.floor(this.params.intensity / 30);
    const targetCount = Math.floor(this.params.density * 3) + 40;

    while (this.particles.length < targetCount) {
      const ring = Math.floor(Math.random() * ringCount);
      const baseRadius = sz * 0.15 + (ring / ringCount) * sz * 0.4;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x: cx + Math.cos(angle) * baseRadius,
        y: cy + Math.sin(angle) * baseRadius,
        vx: 0, vy: 0,
        life: 300 + Math.random() * 400,
        maxLife: 700,
        size: 1.5 + Math.random() * 2,
        color: Math.random() > 0.4 ? this.params.color : this.params.secondaryColor,
        alpha: 0.5 + Math.random() * 0.5,
        angle: angle,
        radius: baseRadius,
        angularSpeed: (0.02 + Math.random() * 0.03) * (ring % 2 === 0 ? 1 : -1),
        orbitLayer: ring,
        trail: [],
      });
    }

    this.particles = this.particles.filter(p => {
      const oldX = p.x, oldY = p.y;
      p.angle = (p.angle ?? 0) + (p.angularSpeed ?? 0.02) * speedStep;
      // Slight radius oscillation
      const wobble = Math.sin(this.spinTime * 2 + (p.orbitLayer ?? 0)) * sz * 0.02;
      p.x = cx + Math.cos(p.angle ?? 0) * ((p.radius ?? 0) + wobble);
      p.y = cy + Math.sin(p.angle ?? 0) * ((p.radius ?? 0) + wobble);
      if (p.trail) {
        p.trail.push({ x: oldX, y: oldY, alpha: p.alpha, size: p.size });
        if (p.trail.length > 8) p.trail.shift();
      }
      p.life -= speedStep;
      return p.life > 0;
    });
  }

  private drawSpin(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    // Center glow
    const glowA = 0.04 + Math.sin(this.spinTime * 3) * 0.02;
    g.circle(cx, cy, r * 0.15).fill({ color: hexToNum(this.params.color), alpha: glowA });

    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const a = lifeRatio * p.alpha;
      const pColor = hexToNum(p.color);
      // Trail
      if (p.trail) {
        for (let i = 0; i < p.trail.length; i++) {
          const t = p.trail[i];
          const ta = a * (i / p.trail.length) * 0.3;
          g.circle(t.x, t.y, t.size * 0.6).fill({ color: pColor, alpha: ta });
        }
      }
      // Glow + core
      g.circle(p.x, p.y, p.size * 2.5).fill({ color: pColor, alpha: a * 0.15 });
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * 0.8 });
      g.circle(p.x, p.y, p.size * 0.4).fill({ color: 0xffffff, alpha: a * 0.6 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // �?LOADER
  // ════════════════════════════════════════════════════════════════════

  private updateLoader(cw: number, ch: number, sz: number) {
    this.loaderTime += 0.016 * (this.params.speed / 50);
    const cx = cw / 2, cy = ch / 2;
    const dotCount = 3 + Math.floor(this.params.intensity / 25);
    const orbitR = sz * 0.25;
    const outerHalf = sz / 2;

    this.particles = this.particles.filter(p => (p.orbitLayer ?? 0) < dotCount);

    for (let idx = 0; idx < dotCount; idx++) {
      if (this.particles.some(p => p.orbitLayer === idx)) continue;
      const angle = (idx / dotCount) * Math.PI * 2;
      this.particles.push({
        x: cx + Math.cos(angle) * orbitR,
        y: cy + Math.sin(angle) * orbitR,
        vx: 0, vy: 0,
        life: 99999,
        maxLife: 99999,
        size: 3 + Math.random() * 2,
        color: idx === 0 ? this.params.color : this.params.secondaryColor,
        alpha: 0.9,
        angle: angle,
        radius: orbitR,
        orbitLayer: idx,
      });
    }

    // Loader dots orbit and pulse
    const mainAngle = this.loaderTime * 3;
    this.particles.forEach((p) => {
      const idx = p.orbitLayer ?? 0;
      const phase = mainAngle - (idx / dotCount) * Math.PI * 0.5;
      // Ease in/out for each dot
      const eased = phase + Math.sin(phase * 2) * 0.3;
      if (this.shape === 'circle') {
        p.x = cx + Math.cos(eased) * (p.radius ?? 0);
        p.y = cy + Math.sin(eased) * (p.radius ?? 0);
      } else {
        const half = Math.max(Math.min(p.radius ?? orbitR, outerHalf - 12), 8);
        const cornerRadius = getSquareTrackCornerRadius(outerHalf, half);
        const trackT = (((eased / (Math.PI * 2)) % 1) + 1) % 1;
        const pt = this.getRoundRectPoint(cx, cy, half, cornerRadius, trackT);
        p.x = pt.x;
        p.y = pt.y;
      }
      // Pulse size
      const pulse = 0.7 + 0.3 * Math.sin(this.loaderTime * 8 + idx);
      p.size = (3 + Math.sin(idx) * 1.5) * pulse;
      // Stagger fade
      const fadePhase = (this.loaderTime * 2 + idx * 0.5) % 1;
      p.alpha = 0.4 + 0.6 * Math.abs(Math.sin(fadePhase * Math.PI));
    });
  }

  private drawLoader(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const colorNum = hexToNum(this.params.color);
    const outerHalf = sz / 2;
    const orbitHalf = Math.max(Math.min(sz * 0.25, outerHalf - 12), 8);

    // Center pulsing circle
    const breathe = 0.06 + 0.04 * Math.sin(this.loaderTime * 4);
    g.circle(cx, cy, sz * 0.08).fill({ color: colorNum, alpha: breathe });

    // Orbiting dots
    for (const p of this.particles) {
      const pColor = hexToNum(p.color);
      // Glow
      g.circle(p.x, p.y, p.size * 3).fill({ color: pColor, alpha: p.alpha * 0.12 });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: p.alpha });
      // Bright center
      g.circle(p.x, p.y, p.size * 0.4).fill({ color: 0xffffff, alpha: p.alpha * 0.7 });
    }

    // Orbit path hint
    if (this.shape === 'circle') {
      g.circle(cx, cy, sz * 0.25).stroke({ color: colorNum, alpha: 0.08, width: 1 });
    } else {
      const cornerRadius = getSquareTrackCornerRadius(outerHalf, orbitHalf);
      g.roundRect(cx - orbitHalf, cy - orbitHalf, orbitHalf * 2, orbitHalf * 2, cornerRadius)
        .stroke({ color: colorNum, alpha: 0.08, width: 1 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🌀 SPINNER
  // ════════════════════════════════════════════════════════════════════

  private updateSpinner(_cw: number, _ch: number, _sz: number) {
    this.spinnerTime += 0.016 * (this.params.speed / 50);
  }

  private drawSpinner(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2;
    const cy = ch / 2;
    const outerHalf = sz / 2;
    const radius = sz * 0.28;
    const strokeWidth = 6 + (this.params.intensity / 100) * 20;
    const minArc = 0.14;
    const maxArc = 0.4;
    const pulse = (Math.sin(this.spinnerTime * 3) + 1) / 2;
    const arcLen = minArc + (maxArc - minArc) * pulse;
    const rotationT = ((this.spinnerTime * 0.42) % 1 + 1) % 1;
    const startT = rotationT - arcLen * 0.82;
    const endT = rotationT + arcLen * 0.18;
    const colorNum = hexToNum(this.params.color);

    if (this.shape === 'circle') {
      g.arc(cx, cy, radius, startT * Math.PI * 2, endT * Math.PI * 2)
        .stroke({ width: strokeWidth, color: colorNum, alpha: 0.98, cap: 'round' });
    } else {
      const half = Math.max(Math.min(radius, outerHalf - strokeWidth), 10);
      const cornerRadius = getSquareTrackCornerRadius(outerHalf, half);
      this.drawRoundRectSegment(g, cx, cy, half, cornerRadius, startT, endT, {
        width: strokeWidth,
        color: colorNum,
        alpha: 0.98,
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🟢 MATRIX
  // ════════════════════════════════════════════════════════════════════

  private updateMatrix(cw: number, _ch: number, sz: number) {
    this.matrixTimer += 0.016 * (this.params.speed / 50);
    const colWidth = 18 - (this.params.density / 100) * 10;
    const cx = cw / 2;
    // In circle mode, constrain columns to the inscribed circle
    const r = sz / 2;
    let startX: number, endX: number;
    if (this.shape === 'circle') {
      startX = cx - r;
      endX = cx + r;
    } else {
      startX = cx - sz / 2;
      endX = cx + sz / 2;
    }
    const colCount = Math.max(1, Math.floor((endX - startX) / colWidth));

    // Initialize columns
    if (this.matrixColumns.length !== colCount) {
      this.matrixColumns = [];
      for (let i = 0; i < colCount; i++) {
        const charCount = 5 + Math.floor(Math.random() * 15);
        const chars = Array.from({ length: charCount }, () =>
          String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))
        );
        this.matrixColumns.push({
          x: startX + i * colWidth + colWidth / 2,
          chars,
          speed: 0.5 + Math.random() * 1.5,
          phase: Math.random() * 100,
        });
      }
    }

    // Update columns
    this.matrixColumns.forEach(col => {
      col.phase += col.speed * 2 * (this.params.speed / 50);
    });
  }

  private drawMatrix(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const r = sz / 2;
    const topY = cy - r;
    const bottomY = cy + r;
    const charH = 14;
    const intensity = this.params.intensity / 100;
    const greenNum = hexToNum(this.params.color);
    const darkGreenNum = hexToNum(this.params.secondaryColor);
    const textAlphaScale = 0.45 + intensity * 0.55;
    const backgroundAlpha = 0.12 + intensity * 0.28;

    // Background tint (circle or rect)
    if (this.shape === 'circle') {
      g.circle(cx, cy, r).fill({ color: 0x000000, alpha: backgroundAlpha });
    } else {
      g.roundRect(cx - r, topY, sz, sz, SQUARE_CORNER_RADIUS).fill({ color: 0x000000, alpha: backgroundAlpha });
    }

    for (const col of this.matrixColumns) {
      const visibleChars = Math.floor(sz / charH);
      for (let i = 0; i < Math.min(col.chars.length, visibleChars); i++) {
        const y = topY + ((col.phase + i * charH) % sz);
        if (y < topY || y > bottomY) continue;
        if (!this.isInsideShapePoint(col.x, y, cx, cy, r, 1)) continue;
        const isHead = i === 0;
        const fadeT = i / visibleChars;
        const alpha = isHead ? 1 : Math.max(0, 0.8 - fadeT * 0.7);
        const color = isHead ? 0xffffff : (fadeT < 0.3 ? greenNum : darkGreenNum);
        // Varying character sizes for visual interest
        const charW = 4 + (col.chars[i]?.charCodeAt(0) % 3) * 1.5;
        const charH2 = 8 + (col.chars[i]?.charCodeAt(0) % 4) * 2;
        g.rect(col.x - charW / 2, y - charH2 / 2, charW, charH2).fill({ color, alpha: alpha * 0.8 * textAlphaScale });
        // Bright head with glow
        if (isHead) {
          g.circle(col.x, y, 4 + intensity * 8).fill({ color: greenNum, alpha: 0.12 + intensity * 0.28 });
          g.circle(col.x, y, 2.5 + intensity * 2.5).fill({ color: 0xffffff, alpha: 0.45 + intensity * 0.45 });
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🫧 BUBBLE
  // ════════════════════════════════════════════════════════════════════

  private updateBubble(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.bubbleTime += 0.016 * speedStep;
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const intensity = this.params.intensity / 100;
    const warmup = Math.min(1, this.bubbleTime / 2);
    const targetCount = Math.floor((this.params.density * (1.05 + intensity * 0.9) + 16 + intensity * 18) * warmup);

    if (this.particles.length > targetCount) {
      this.particles.length = targetCount;
    }

    while (this.particles.length < targetCount) {
      const spawn = this.shape === 'circle'
        ? this.getRandomPointInShape(cx, cy + r * 0.55, r * 0.75)
        : this.getRandomPointInShape(cx, cy + r * 0.58, r * 0.78, r * 0.08);
      this.particles.push({
        x: spawn.x,
        y: Math.min(cy + r * 0.98, spawn.y + Math.random() * r * 0.18),
        vx: 0, vy: 0,
        life: 200 + Math.random() * 300,
        maxLife: 500,
        size: 2.2 + intensity * 4.2 + Math.random() * (4 + intensity * 4.5),
        color: Math.random() > 0.5 ? this.params.color : this.params.secondaryColor,
        alpha: 0.18 + intensity * 0.32 + Math.random() * (0.24 + intensity * 0.18),
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.75 + intensity * 1.1 + Math.random() * (1.3 + intensity * 1.4),
      });
    }

    this.particles = this.particles.filter(p => {
      // Rise
      p.y -= (0.35 + intensity * 0.55 + Math.random() * (0.22 + intensity * 0.28)) * speedStep;
      // Sway
      p.x += Math.sin(this.bubbleTime * (p.swaySpeed ?? 1) + (p.swayPhase ?? 0)) * (0.35 + intensity * 0.55) * speedStep;
      // Slight shrink as it rises
      p.size *= Math.pow(0.9992 - intensity * 0.00025, speedStep);
      p.life -= speedStep;
      if (!this.isInsideShapePoint(p.x, p.y, cx, cy, r, -p.size)) {
        p.life = 0;
      }
      // Pop near top
      return p.life > 0 && p.y > cy - r * 0.9;
    });
  }

  private drawBubble(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    const intensity = this.params.intensity / 100;

    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const a = p.alpha * Math.min(1, lifeRatio * 3);
      const pColor = hexToNum(p.color);

      g.circle(p.x, p.y, p.size * (1.7 + intensity * 2.4)).fill({ color: pColor, alpha: a * (0.035 + intensity * 0.07) });
      // Bubble rim
      g.circle(p.x, p.y, p.size).stroke({ color: pColor, alpha: a * (0.45 + intensity * 0.42), width: 0.9 + intensity * 1.4 });
      // Inner glow
      g.circle(p.x, p.y, p.size * 0.7).fill({ color: pColor, alpha: a * (0.06 + intensity * 0.13) });
      // Highlight
      g.circle(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * (0.18 + intensity * 0.13)).fill({ color: 0xffffff, alpha: a * (0.32 + intensity * 0.36) });
    }
  }

  // ════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════
  // AURORA
  // ════════════════════════════════════════════════════════════════════

  private updateAurora(_cw: number, _ch: number, _sz: number) {
    this.auroraTime += this.frameDeltaSeconds * this.getSpeedStep() * 0.5;
    this.particles = [];
  }

  private drawAurora(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2;
    const cy = ch / 2;
    const r = sz / 2;
    const intensity = this.params.intensity / 100;
    const density = this.params.density / 100;
    const phase = this.getEffectLoopProgress(this.auroraTime, 1);
    const loop = phase * Math.PI * 2;
    const curtainCount = 3 + Math.floor(density * 3) + Math.floor(intensity * 2);
    const segments = 44;
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);
    const midColor = lerpColor(this.params.color, this.params.secondaryColor, 0.45);
    const paleColor = lerpColor(this.params.secondaryColor, '#ffffff', 0.58);

    for (let i = 5; i >= 0; i--) {
      const t = i / 5;
      const pulse = 0.88 + 0.12 * Math.sin(loop + t * Math.PI);
      g.ellipse(
        cx,
        cy - r * (0.48 - t * 0.02),
        r * (0.55 + t * 0.55) * pulse,
        r * (0.18 + t * 0.28),
      ).fill({
        color: i % 2 === 0 ? colorNum : secColorNum,
        alpha: (0.012 + intensity * 0.018) * (1 - t),
      });
    }

    for (let layer = 0; layer < curtainCount; layer++) {
      const layerT = curtainCount <= 1 ? 0 : layer / (curtainCount - 1);
      const seed = pseudoRandom(layer * 17.13 + 1.5);
      const yBase = cy - r * (0.68 - layerT * 0.22);
      const thickness = r * (0.09 + intensity * 0.14 + density * 0.04 + layerT * 0.035);
      const span = sz * (0.82 + density * 0.16 + layerT * 0.08);
      const pointsTop: Array<{ x: number; y: number }> = [];
      const pointsBottom: Array<{ x: number; y: number }> = [];
      const layerColor = layer % 3 === 0 ? colorNum : layer % 3 === 1 ? midColor : secColorNum;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = cx - span / 2 + span * t;
        const taper = Math.sin(t * Math.PI);
        const wave =
          Math.sin(loop * (1 + layer) + t * Math.PI * (2.0 + layerT) + seed * Math.PI * 2) * r * (0.03 + intensity * 0.045) +
          Math.sin(-loop * (2 + (layer % 2)) + t * Math.PI * (4.0 + layerT * 1.2) + layer * 0.7) * r * (0.015 + intensity * 0.026);
        const crest = yBase + wave;
        pointsTop.push({ x, y: crest - thickness * (0.18 + taper * 0.08) });
        pointsBottom.push({ x, y: crest + thickness * (0.72 + taper * (0.58 + intensity * 0.4)) });
      }

      g.moveTo(pointsTop[0].x, pointsTop[0].y);
      for (let i = 1; i < pointsTop.length; i++) {
        g.lineTo(pointsTop[i].x, pointsTop[i].y);
      }
      for (let i = pointsBottom.length - 1; i >= 0; i--) {
        g.lineTo(pointsBottom[i].x, pointsBottom[i].y);
      }
      g.closePath();
      g.fill({
        color: layerColor,
        alpha: (0.045 + intensity * 0.07) * (1 - layerT * 0.28),
      });

      const rayCount = 7 + Math.floor(density * 10);
      for (let i = 0; i < rayCount; i++) {
        const t = (i + 0.5) / rayCount;
        const raySeed = pseudoRandom(layer * 101 + i * 13.7);
        const x = cx - span / 2 + span * t;
        const wobble =
          Math.sin(loop * (1 + layer) + t * Math.PI * (2.0 + layerT) + seed * Math.PI * 2) * r * (0.03 + intensity * 0.045) +
          Math.sin(-loop * (2 + (layer % 2)) + t * Math.PI * (4.0 + layerT * 1.2) + layer * 0.7) * r * (0.015 + intensity * 0.026);
        const taper = Math.sin(t * Math.PI);
        const topY = yBase + wobble - thickness * 0.15;
        const bottomY = yBase + wobble + thickness * (0.9 + taper * (0.8 + intensity * 0.7));
        const shine = 0.55 + 0.45 * Math.sin(loop * (1 + (i % 2)) + raySeed * Math.PI * 2);
        g.moveTo(x, topY);
        g.lineTo(x + Math.sin(loop + raySeed * Math.PI * 2) * r * 0.018, bottomY);
        g.stroke({
          width: 0.7 + intensity * 1.4 + raySeed * 0.7,
          color: raySeed > 0.5 ? paleColor : layerColor,
          alpha: (0.035 + intensity * 0.09) * shine * (1 - layerT * 0.25),
        });
      }
    }

    const glintCount = 5 + Math.floor(density * 14);
    for (let i = 0; i < glintCount; i++) {
      const seed = pseudoRandom(i * 23.4 + 5.7);
      const x = cx + (pseudoRandom(i * 7.9 + 3.2) - 0.5) * r * (1.35 + density * 0.22);
      const y = cy - r * (0.62 - pseudoRandom(i * 11.3 + 1.9) * 0.55);
      const pulse = 0.5 + 0.5 * Math.sin(loop * (1 + (i % 3)) + seed * Math.PI * 2);
      const size = 0.9 + intensity * 1.3 + seed * 1.2;
      g.circle(x, y, size * (2.4 + intensity * 1.8)).fill({ color: paleColor, alpha: pulse * (0.018 + intensity * 0.035) });
      g.circle(x, y, size).fill({ color: paleColor, alpha: pulse * (0.12 + intensity * 0.18) });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // FIREFLY
  // ════════════════════════════════════════════════════════════════════

  private updateFirefly(cw: number, ch: number, sz: number) {
    const speedStep = this.getSpeedStep();
    this.fireflyTime += 0.016 * speedStep;
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const intensity = this.params.intensity / 100;
    const targetCount = Math.floor(this.params.density * (0.52 + intensity * 0.72)) + 10 + Math.floor(intensity * 16);

    if (this.particles.length > targetCount) {
      this.particles.length = targetCount;
    }

    while (this.particles.length < targetCount) {
      const spawn = this.getRandomPointInShape(cx, cy, r, r * 0.1);
      this.particles.push({
        x: spawn.x,
        y: spawn.y,
        vx: (Math.random() - 0.5) * (0.18 + intensity * 0.35),
        vy: (Math.random() - 0.5) * (0.18 + intensity * 0.35),
        life: 400 + Math.random() * 600,
        maxLife: 1000,
        size: 1.3 + intensity * 2.5 + Math.random() * (2.0 + intensity * 2.2),
        color: Math.random() > 0.4 ? this.params.color : this.params.secondaryColor,
        alpha: 0,
        flickerSpeed: 0.8 + intensity * 2 + Math.random() * (2.2 + intensity * 2.4),
        flickerPhase: Math.random() * Math.PI * 2,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.4 + intensity * 0.9 + Math.random() * (1.1 + intensity * 1.1),
      });
    }

    this.particles = this.particles.filter(p => {
      p.vx += (Math.random() - 0.5) * (0.025 + intensity * 0.06) * speedStep;
      p.vy += (Math.random() - 0.5) * (0.025 + intensity * 0.06) * speedStep;
      p.vx *= Math.pow(0.98, speedStep);
      p.vy *= Math.pow(0.98, speedStep);
      p.x += (p.vx + Math.sin(this.fireflyTime * (p.swaySpeed ?? 1) + (p.swayPhase ?? 0)) * (0.12 + intensity * 0.24)) * speedStep;
      p.y += (p.vy + Math.cos(this.fireflyTime * (p.swaySpeed ?? 1) + (p.swayPhase ?? 0)) * (0.08 + intensity * 0.2)) * speedStep;

      if (!this.isInsideShapePoint(p.x, p.y, cx, cy, r, r * 0.08)) {
        const projected = this.projectInsideShapePoint(p.x, p.y, cx, cy, r, r * 0.08);
        p.vx = (p.vx ?? 0) * -0.35;
        p.vy = (p.vy ?? 0) * -0.35;
        p.x = projected.x;
        p.y = projected.y;
      }

      const flickerFloor = 0.18 + intensity * 0.18;
      const flicker = flickerFloor + (1 - flickerFloor) * Math.abs(Math.sin(this.fireflyTime * (p.flickerSpeed ?? 2) + (p.flickerPhase ?? 0)));
      const lifeRatio = p.life / (p.maxLife ?? 1000);
      const fadeIn = lifeRatio > 0.9 ? (1 - lifeRatio) / 0.1 : 1;
      const fadeOut = lifeRatio < 0.1 ? lifeRatio / 0.1 : 1;
      p.alpha = flicker * fadeIn * fadeOut * (0.55 + intensity * 0.5);

      p.life -= speedStep;
      return p.life > 0;
    });
  }

  private drawFirefly(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    const intensity = this.params.intensity / 100;

    for (const p of this.particles) {
      const pColor = hexToNum(p.color);
      g.circle(p.x, p.y, p.size * (3.0 + intensity * 3.4)).fill({ color: pColor, alpha: p.alpha * (0.045 + intensity * 0.08) });
      g.circle(p.x, p.y, p.size * (1.6 + intensity * 0.9)).fill({ color: pColor, alpha: p.alpha * (0.14 + intensity * 0.16) });
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: p.alpha * (0.48 + intensity * 0.34) });
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: p.alpha * (0.58 + intensity * 0.34) });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // RAIN
  // ════════════════════════════════════════════════════════════════════

  private updateRain(_cw: number, _ch: number, _sz: number) {
    this.rainTime += this.frameDeltaSeconds * this.getSpeedStep() * 0.5;
    this.particles = [];
  }

  private drawRain(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const intensity = this.params.intensity / 100;
    const density = this.params.density / 100;
    const phase = this.getEffectLoopProgress(this.rainTime, 1);
    const mainColor = hexToNum(this.params.color);
    const secondaryColor = hexToNum(this.params.secondaryColor);
    const rainCount = 38 + Math.floor(density * 92) + Math.floor(intensity * 24);
    const slant = r * (0.085 + intensity * 0.05);
    const fallSpan = sz * 1.55;
    const top = cy - r * 0.98 - fallSpan * 0.12;

    for (let i = 0; i < rainCount; i++) {
      const seed = pseudoRandom(i * 41.37 + 12.4);
      const xSeed = pseudoRandom(i * 13.17 + 7.1);
      const localPhase = this.getWrappedPhase(phase * (1 + (i % 3)) + seed);
      const laneX = cx - r * 0.82 + xSeed * r * 1.64;
      const y = top + localPhase * fallSpan;
      const sway = Math.sin((phase + seed) * Math.PI * 2) * r * (0.012 + intensity * 0.012);
      const x = laneX - slant * localPhase * 2.4 + sway;
      const length = r * (0.1 + intensity * 0.15 + seed * 0.07);
      const width = 0.45 + intensity * 0.75 + (seed > 0.78 ? 0.45 : 0);
      const headX = x;
      const headY = y;
      const tailX = x + slant * (0.8 + seed * 0.45);
      const tailY = y - length;
      const midX = (headX + tailX) / 2;
      const midY = (headY + tailY) / 2;

      if (!this.isInsideShapePoint(midX, midY, cx, cy, r, r * 0.015)) {
        continue;
      }

      const edgeDx = Math.abs(midX - cx) / r;
      const edgeDy = Math.abs(midY - cy) / r;
      const edgeFade = this.shape === 'circle'
        ? Math.max(0.15, 1 - Math.max(0, Math.hypot(midX - cx, midY - cy) / r - 0.62) * 2.6)
        : Math.max(0.2, 1 - Math.max(edgeDx, edgeDy) * 0.18);
      const color = seed > 0.68 ? secondaryColor : mainColor;
      const alpha = (0.22 + intensity * 0.36 + seed * 0.18) * edgeFade;

      g.moveTo(headX, headY);
      g.lineTo(tailX, tailY);
      g.stroke({ color, alpha, width });

      if (seed > 0.72) {
        g.moveTo(headX + 0.8, headY + 0.8);
        g.lineTo(tailX + 0.8, tailY + 0.8);
        g.stroke({ color: secondaryColor, alpha: alpha * 0.24, width: width + 1.1 });
      }
    }

    const sheetCount = 3 + Math.floor(intensity * 3);
    for (let i = 0; i < sheetCount; i++) {
      const t = i / Math.max(sheetCount - 1, 1);
      const y = cy - r * 0.72 + t * r * 1.28;
      const alpha = (0.012 + intensity * 0.025) * (1 - Math.abs(t - 0.5) * 0.8);
      g.moveTo(cx - r * 0.86, y + Math.sin(phase * Math.PI * 2 + i) * r * 0.015);
      g.lineTo(cx + r * 0.82, y - r * (0.05 + intensity * 0.03));
      g.stroke({ color: secondaryColor, alpha, width: 0.7 + intensity * 0.7 });
    }
  }
  // ════════════════════════════════════════════════════════════════════
  // SOLID RING
  // ════════════════════════════════════════════════════════════════════

  private updateSolidRing(_cw: number, _ch: number, _sz: number) {
    this.solidRingPhase = this.advanceLoopPhase(this.solidRingPhase);
  }

  private drawSolidRing(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const r = sz / 2;
    const lineWidth = 4 + (this.params.intensity / 100) * 36;
    const steps = 1920;
    const outerRadius = r;
    const innerRadius = Math.max(r - lineWidth, 0);
    // Vivid gradient: red → orange → green → blue
    const rainbowColors = [
      '#ff0040',
      '#ff8000',
      '#00ff80',
      '#00b0ff',
      '#ff0040',
    ];

    if (this.shape === 'square') {
      const outerHalf = Math.min(r, sz / 2);
      const innerHalf = Math.max(outerHalf - lineWidth, 0);
      const outerRadius = SQUARE_CORNER_RADIUS;
      const innerRadius = Math.max(SQUARE_CORNER_RADIUS - lineWidth, 0);
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const colorT = this.getWrappedPhase(t + this.solidRingPhase);
        const colorIdx = colorT * (rainbowColors.length - 1);
        const ci = Math.floor(colorIdx);
        const cf = colorIdx - ci;
        const segColor = lerpColor(
          rainbowColors[ci],
          rainbowColors[Math.min(ci + 1, rainbowColors.length - 1)],
          cf
        );
        const nextT = (i + 1) / steps;
        const p1Outer = this.getRoundRectPoint(cx, cy, outerHalf, outerRadius, t);
        const p2Outer = this.getRoundRectPoint(cx, cy, outerHalf, outerRadius, nextT);
        const p2Inner = this.getRoundRectPoint(cx, cy, innerHalf, innerRadius, nextT);
        const p1Inner = this.getRoundRectPoint(cx, cy, innerHalf, innerRadius, t);
        drawRingQuad(g, p1Outer, p2Outer, p2Inner, p1Inner, segColor);
      }
      return;
    }

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const colorT = this.getWrappedPhase(t + this.solidRingPhase);
      const colorIdx = colorT * (rainbowColors.length - 1);
      const ci = Math.floor(colorIdx);
      const cf = colorIdx - ci;
      const segColor = lerpColor(
        rainbowColors[ci],
        rainbowColors[Math.min(ci + 1, rainbowColors.length - 1)],
        cf
      );

      const a1 = t * Math.PI * 2;
      const a2 = (t + 1 / steps) * Math.PI * 2;
      drawCircularRingSegment(g, cx, cy, outerRadius, innerRadius, a1, a2, segColor);
    }
  }

  // ─── Disc ───
  private updateDisc(_cw: number, _ch: number, _sz: number) {
    this.discPhase = this.advanceLoopPhase(this.discPhase);
  }

  private drawDisc(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const r = sz / 2;
    // Ring width: 15-50px based on intensity
    const ringWidth = 15 + (this.params.intensity / 100) * 35;
    const outerRadius = r;
    const innerRadius = Math.max(r - ringWidth, 0);

    // 1. Continuous rainbow gradient ring (Google One style)
    // Palette: red → orange → yellow → green → blue → purple → red
    const discColors = [
      '#ff0040', '#ff8000', '#ffe000', '#00ff80', '#00b0ff', '#a040ff', '#ff0040',
    ];
    const steps = 1920;

    if (this.shape === 'square') {
      const outerHalf = Math.min(r, sz / 2);
      const innerHalf = Math.max(outerHalf - ringWidth, 0);
      const outerRadius = SQUARE_CORNER_RADIUS;
      const innerRadius = Math.max(SQUARE_CORNER_RADIUS - ringWidth, 0);
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const colorT = this.getWrappedPhase(t + this.discPhase) * (discColors.length - 1);
        const ci = Math.floor(colorT);
        const cf = colorT - ci;
        const segColor = lerpColor(
          discColors[ci],
          discColors[Math.min(ci + 1, discColors.length - 1)],
          cf,
        );
        const nextT = (i + 1) / steps;
        const p1Outer = this.getRoundRectPoint(cx, cy, outerHalf, outerRadius, t);
        const p2Outer = this.getRoundRectPoint(cx, cy, outerHalf, outerRadius, nextT);
        const p2Inner = this.getRoundRectPoint(cx, cy, innerHalf, innerRadius, nextT);
        const p1Inner = this.getRoundRectPoint(cx, cy, innerHalf, innerRadius, t);
        drawRingQuad(g, p1Outer, p2Outer, p2Inner, p1Inner, segColor);
      }
    } else {
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const angle1 = (t + this.discPhase) * Math.PI * 2;
        const angle2 = (t + 1 / steps + this.discPhase) * Math.PI * 2;

        const colorT = t * (discColors.length - 1);
        const ci = Math.floor(colorT);
        const cf = colorT - ci;
        const segColor = lerpColor(
          discColors[ci],
          discColors[Math.min(ci + 1, discColors.length - 1)],
          cf,
        );
        drawCircularRingSegment(g, cx, cy, outerRadius, innerRadius, angle1, angle2, segColor);
      }
    }
  }

  // ─── Google One Ring ───
  private updateGoogleOne(_cw: number, _ch: number, _sz: number) {
    this.googleOnePhase = this.advanceLoopPhase(this.googleOnePhase);
  }

  private advanceLoopPhase(phase: number) {
    const turnsPerLoop = this.params.speed / RING_LOOP_SPEED_BASELINE;
    const direction = this.params.direction === 'reverse' ? -1 : 1;
    const phaseDelta = direction * turnsPerLoop * (this.frameDeltaSeconds / (RING_LOOP_DURATION_MS / 1000));
    return this.getWrappedPhase(phase + phaseDelta);
  }

  private getWrappedPhase(phase: number) {
    return ((phase % 1) + 1) % 1;
  }

  private drawGoogleOne(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2;
    const cy = ch / 2;
    const r = sz / 2;
    const ringWidth = 28 + (this.params.intensity / 100) * 24;
    const outerRadius = r;
    const innerRadius = Math.max(r - ringWidth, 0);

    const segments = [
      { color: '#EA4335', degrees: 105 },
      { color: '#4285F4', degrees: 105 },
      { color: '#34A853', degrees: 105 },
      { color: '#FBBC05', degrees: 45 },
    ] as const;

    let segmentStart = this.googleOnePhase;

    if (this.shape === 'square') {
      const outerHalf = Math.min(r, sz / 2);
      const innerHalf = Math.max(outerHalf - ringWidth, 0);
      const outerRadius = SQUARE_CORNER_RADIUS;
      const innerRadius = Math.max(SQUARE_CORNER_RADIUS - ringWidth, 0);

      for (const segment of segments) {
        const span = segment.degrees / 360;
        drawRoundRectRingSegment(
          g,
          cx,
          cy,
          outerHalf,
          outerRadius,
          innerHalf,
          innerRadius,
          segmentStart,
          segmentStart + span,
          hexToNum(segment.color),
        );
        segmentStart += span;
      }
      return;
    }

    for (const segment of segments) {
      const span = segment.degrees / 360;
      const startAngle = segmentStart * Math.PI * 2;
      const endAngle = (segmentStart + span) * Math.PI * 2;
      g.arc(cx, cy, outerRadius, startAngle, endAngle);
      g.arc(cx, cy, innerRadius, endAngle, startAngle, true);
      g.fill({ color: hexToNum(segment.color), alpha: 1 });
      segmentStart += span;
    }
  }

  clear() {
    this.particles = [];
    this.lightningBolts = [];
    this.time = 0;
    this.glowPhase = 0;
    this.orbitAngle = 0;
    this.shieldPhase = 0;
    this.shieldHitTimer = 0;
    this.lightningTimer = 0;
    this.frostCrystals = [];
    this.ripplePhase = 0;
    this.petalTime = 0;
    this.stardustTime = 0;
    this.meteors = [];
    this.meteorTimer = 0;
    this.prismTime = 0;
    this.vortexTime = 0;
    this.fireworkBursts = [];
    this.fireworkTimer = 0;
    this.goldTime = 0;
    this.spinTime = 0;
    this.loaderTime = 0;
    this.spinnerTime = 0;
    this.matrixColumns = [];
    this.matrixTimer = 0;
    this.bubbleTime = 0;
    this.fireTime = 0;
    this.auroraTime = 0;

    this.fireflyTime = 0;
    this.rainTime = 0;
    this.solidRingPhase = 0;
    this.discPhase = 0;
    this.googleOnePhase = 0;
    this.effectLoopPhase = null;
    this.frameDeltaSeconds = 1 / 60;
    this.lastUpdateAt = 0;
    this.fixedDeltaSeconds = null;
  }
}
