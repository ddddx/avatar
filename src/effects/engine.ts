import * as PIXI from 'pixi.js';
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

export class ParticleEngine {
  particles: Particle[] = [];
  private time = 0;
  private effect: EffectType = 'lightning';
  private shape: CropShape = 'circle';
  private params: EffectParams = {
    density: 50, intensity: 50, speed: 50,
    color: '#00d4ff', secondaryColor: '#ff6b35',
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

  // Matrix state
  private matrixColumns: Array<{ x: number; chars: string[]; speed: number; phase: number }> = [];
  private matrixTimer = 0;

  // Bubble state
  private bubbleTime = 0;

  // Aurora state
  private auroraTime = 0;


  // Firefly state
  private fireflyTime = 0;

  // Rain state
  private rainTime = 0;

  // SolidRing state
  private solidRingAngle = 0;

  // Disc state
  private discAngle = 0;

  setEffect(e: EffectType) { this.effect = e; this.particles = []; this.lightningBolts = []; }
  setShape(s: CropShape) { this.shape = s; }
  setParams(p: EffectParams) { this.params = p; }

  update(canvasW: number, canvasH: number, imgSize: number) {
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
      case 'matrix':    this.updateMatrix(canvasW, canvasH, imgSize); break;
      case 'bubble':    this.updateBubble(canvasW, canvasH, imgSize); break;
      case 'aurora':    this.updateAurora(canvasW, canvasH, imgSize); break;
      case 'firefly':   this.updateFirefly(canvasW, canvasH, imgSize); break;
      case 'rain':      this.updateRain(canvasW, canvasH, imgSize); break;
      case 'solidring': this.updateSolidRing(canvasW, canvasH, imgSize); break;
      case 'disc':      this.updateDisc(canvasW, canvasH, imgSize); break;
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
      case 'matrix':    this.drawMatrix(g, canvasW, canvasH, imgSize); break;
      case 'bubble':    this.drawBubble(g, canvasW, canvasH, imgSize); break;
      case 'aurora':    this.drawAurora(g, canvasW, canvasH, imgSize); break;
      case 'firefly':   this.drawFirefly(g, canvasW, canvasH, imgSize); break;
      case 'rain':      this.drawRain(g, canvasW, canvasH, imgSize); break;
      case 'solidring': this.drawSolidRing(g, canvasW, canvasH, imgSize); break;
      case 'disc':      this.drawDisc(g, canvasW, canvasH, imgSize); break;
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
      const perim = half * 8;
      const d = (t * perim) % perim;
      if (d < half * 2) {
        const x = cx - half + d;
        return { x, y: cy - half, nx: 0, ny: -1 };
      } else if (d < half * 4) {
        const x = cx + half;
        return { x, y: cy - half + (d - half * 2), nx: 1, ny: 0 };
      } else if (d < half * 6) {
        const x = cx + half - (d - half * 4);
        return { x, y: cy + half, nx: 0, ny: 1 };
      } else {
        const x = cx - half;
        return { x, y: cy + half - (d - half * 6), nx: -1, ny: 0 };
      }
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
    const spd = this.params.speed / 50;
    this.lightningTimer += spd;

    this.lightningBolts = this.lightningBolts.filter(b => {
      b.life -= 1;
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
        color: '#ffffff',
        alpha: 1,
        trail: [],
      });
    }

    this.particles = this.particles.filter(p => {
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 4) p.trail.shift();
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= 1;
      return p.life > 0;
    });
  }

  private drawLightning(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    for (const bolt of this.lightningBolts) {
      const progress = bolt.life / bolt.maxLife;
      const fadeAlpha = progress < 0.3 ? progress / 0.3 : 1;
      const flashAlpha = progress > 0.7 ? 1 : 0.6 + Math.sin(progress * Math.PI * 8) * 0.4;
      const baseAlpha = fadeAlpha * flashAlpha * bolt.glow;

      // 3-layer glow: outer (thick, low alpha) �?mid �?core (thin, high alpha)
      const layers = [
        { width: 4, color: 0x4488ff, alpha: baseAlpha * 0.35 },
        { width: 2, color: 0x88bbff, alpha: baseAlpha * 0.65 },
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
        g.circle(firstSeg.x1, firstSeg.y1, 22).fill({ color: 0x4488ff, alpha: glowAlpha });
        g.circle(lastSeg.x2, lastSeg.y2, 22).fill({ color: 0x4488ff, alpha: glowAlpha });
      }
    }

    // Spark particles with trails
    for (const p of this.particles) {
      const a = p.life / p.maxLife;
      if (p.trail) {
        for (let i = 0; i < p.trail.length; i++) {
          const tp = p.trail[i];
          const ta = a * (i / p.trail.length) * 0.5;
          // Outer glow trail
          g.circle(tp.x, tp.y, p.size * 1.5).fill({ color: 0xaaddff, alpha: ta * 0.3 });
          // Core trail
          g.circle(tp.x, tp.y, p.size * 0.6).fill({ color: 0xaaddff, alpha: ta });
        }
      }
      // Outer glow
      g.circle(p.x, p.y, p.size * 2).fill({ color: 0x88ccff, alpha: a * 0.3 });
      // Bright core
      g.circle(p.x, p.y, p.size).fill({ color: 0xffffff, alpha: a });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🔥 FIRE
  // ════════════════════════════════════════════════════════════════════

  private updateFire(cw: number, ch: number, sz: number) {
    const spd = this.params.speed / 50;
    const spawnRate = Math.floor(this.params.density / 4) + 2;
    const ext = (this.params.intensity / 100);
    const cx = cw / 2, cy = ch / 2, r = sz / 2;

    for (let i = 0; i < spawnRate; i++) {
      // Fire rises from the bottom area — wider spread for dispersed look
      const spreadX = (Math.random() - 0.5) * r * 1.2;
      const baseX = cx + spreadX;
      const baseY = cy + r * 0.7 + Math.random() * r * 0.2;

      this.particles.push({
        x: baseX + (Math.random() - 0.5) * 16,
        y: baseY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -(1 + Math.random() * 2 * ext) * spd,
        life: 25 + Math.random() * 35,
        maxLife: 60,
        size: 2.5 + Math.random() * (4 + ext * 6),
        color: '',
        alpha: 0.5,
        trail: [],
      });
    }

    this.particles = this.particles.filter(p => {
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 5) p.trail.shift();
      }
      p.vx += (Math.random() - 0.5) * 0.35;
      p.vy -= 0.04;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.99;
      p.size *= 0.985;
      p.life -= 1;
      return p.life > 0 && p.size > 0.5;
    });
  }

  private drawFire(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;

    // Bottom glow circle
    const glowIntensity = 0.08 + (this.params.intensity / 100) * 0.06;
    const bottomY = cy + r;
    // Draw concentric circles for radial glow simulation (wider to match dispersed fire)
    const gradSteps = 8;
    for (let i = gradSteps; i >= 0; i--) {
      const t = i / gradSteps;
      const radius = r * 1.6 * t;
      const alpha = glowIntensity * 0.4 * (1 - t);
      const color = lerpColor('#cc5018', '#aa3000', t);
      g.circle(cx, bottomY, radius).fill({ color, alpha });
    }

    // Full radial glow
    for (let i = gradSteps; i >= 0; i--) {
      const t = i / gradSteps;
      const radius = (r + 30) * t;
      const alpha = glowIntensity * 0.3 * (1 - t) * 0.2;
      g.circle(cx, cy, radius).fill({ color: 0xcc5800, alpha });
    }

    // Sort particles
    const sorted = [...this.particles].sort((a, b) => {
      const ta = 1 - a.life / a.maxLife;
      const tb = 1 - b.life / b.maxLife;
      return tb - ta;
    });

    for (const p of sorted) {
      const lifeRatio = 1 - p.life / p.maxLife;
      const alpha = lifeRatio < 0.1
        ? lifeRatio / 0.1
        : lifeRatio > 0.7
          ? (1 - lifeRatio) / 0.3
          : 1;

      let colorNum: number;
      if (lifeRatio > 0.7) {
        colorNum = lerpColor('#ffcc66', '#ff9933', (lifeRatio - 0.7) / 0.3);
      } else if (lifeRatio > 0.5) {
        colorNum = lerpColor('#ff9933', '#ee6600', (lifeRatio - 0.5) / 0.2);
      } else if (lifeRatio > 0.3) {
        colorNum = lerpColor('#ee6600', '#cc3300', (lifeRatio - 0.3) / 0.2);
      } else {
        colorNum = lerpColor('#cc3300', '#881100', lifeRatio / 0.3);
      }

      // Layer 1: large heat glow
      g.circle(p.x, p.y, p.size * 3).fill({ color: colorNum, alpha: alpha * 0.08 * p.alpha });
      // Layer 2: mid transition
      g.circle(p.x, p.y, p.size * 1.5).fill({ color: colorNum, alpha: alpha * 0.2 * p.alpha });
      // Layer 3: bright core
      g.circle(p.x, p.y, p.size).fill({ color: colorNum, alpha: alpha * 0.5 * p.alpha });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // �?GLOW
  // ════════════════════════════════════════════════════════════════════

  private updateGlow(cw: number, ch: number, sz: number) {
    this.glowPhase += 0.015 * (this.params.speed / 50);
    const count = Math.floor(this.params.density / 2) + 15;

    while (this.particles.length < count) {
      const isInner = Math.random() < 0.4;
      const dist = isInner ? sz * 0.2 + Math.random() * sz * 0.3 : sz * 0.5 + Math.random() * sz * 0.15;
      const angle = Math.random() * Math.PI * 2;

      this.particles.push({
        x: cw / 2 + Math.cos(angle) * dist,
        y: ch / 2 + Math.sin(angle) * dist,
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
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
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
    if (this.shape === 'circle') {
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
          g.circle(cx, cy, radius).fill({ color, alpha });
        }
      }
    }

    // Rotating outer ring
    const ringR = r + haloRadius * 0.5;
    const arcLen = Math.PI * 0.8;
    const ringAngle = this.glowPhase * 0.3;

    // Draw arc as series of small line segments
    const arcSteps = 32;
    g.moveTo(
      cx + Math.cos(ringAngle) * ringR,
      cy + Math.sin(ringAngle) * ringR,
    );
    for (let i = 1; i <= arcSteps; i++) {
      const a = ringAngle + (arcLen * i) / arcSteps;
      g.lineTo(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
    }
    g.stroke({ width: 3, color: colorNum, alpha: 0.3 * breathe });

    // Secondary arc
    const ringR2 = ringR + 5;
    const ringAngle2 = ringAngle + Math.PI;
    const arcLen2 = arcLen * 0.6;
    g.moveTo(
      cx + Math.cos(ringAngle2) * ringR2,
      cy + Math.sin(ringAngle2) * ringR2,
    );
    for (let i = 1; i <= arcSteps; i++) {
      const a = ringAngle2 + (arcLen2 * i) / arcSteps;
      g.lineTo(cx + Math.cos(a) * ringR2, cy + Math.sin(a) * ringR2);
    }
    g.stroke({ width: 3, color: secColorNum, alpha: 0.18 * breathe });

    // Inner bright ring
    const innerSteps = 6;
    for (let i = innerSteps; i >= 0; i--) {
      const t = i / innerSteps;
      const radius = (r - 3) + (r + 12 - (r - 3)) * t;
      const alpha = 0.15 * breathe * (1 - t) * 0.5;
      g.circle(cx, cy, radius).fill({ color: colorNum, alpha });
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
    this.orbitAngle += 0.008 * (this.params.speed / 50);
    const cx = cw / 2, cy = ch / 2;
    const layerCount = 2 + Math.floor(this.params.intensity / 25);
    const targetPerLayer = Math.floor(this.params.density / layerCount / 3) + 3;

    for (let layer = 0; layer < layerCount; layer++) {
      // In circle mode, keep orbits inside the circle
      const maxR = this.shape === 'circle' ? sz / 2 - 10 : sz / 2 + 8;
      const layerR = maxR - layer * 18;
      const existing = this.particles.filter(p => p.orbitLayer === layer).length;
      const toSpawn = targetPerLayer - existing;
      for (let i = 0; i < toSpawn; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speedMult = 1 + (layerCount - layer) * 0.3;
        const angularSpeed = (0.012 + Math.random() * 0.02) * (this.params.speed / 50) * speedMult;
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
      p.angle = (p.angle ?? 0) + (p.angularSpeed ?? 0);
      p.x = cx + Math.cos(p.angle ?? 0) * (p.radius ?? 0);
      p.y = cy + Math.sin(p.angle ?? 0) * (p.radius ?? 0);

      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 6) p.trail.shift();
      }

      p.life -= 1;
      return p.life > 0;
    });
  }

  private drawOrbit(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const layerCount = 2 + Math.floor(this.params.intensity / 25);
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);

    // Dashed orbit rings
    for (let i = 0; i < layerCount; i++) {
      const maxR = this.shape === 'circle' ? sz / 2 - 15 : sz / 2 + 8;
      const r = this.shape === 'circle' ? maxR - i * 15 : maxR + i * 18;
      const ringColor = i % 2 === 0 ? colorNum : secColorNum;
      const dashCount = 40;
      for (let d = 0; d < dashCount; d++) {
        if (d % 2 === 0) {
          const a1 = (d / dashCount) * Math.PI * 2;
          const a2 = ((d + 1) / dashCount) * Math.PI * 2;
          const steps = 4;
          g.moveTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
          for (let s = 1; s <= steps; s++) {
            const a = a1 + ((a2 - a1) * s) / steps;
            g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          }
          g.stroke({ width: 1, color: ringColor, alpha: 0.08 });
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
    this.shieldPhase += 0.012 * (this.params.speed / 50);
    if (this.shieldHitTimer > 0) this.shieldHitTimer -= 0.02;

    const cx = cw / 2, cy = ch / 2;
    const segCount = Math.floor(this.params.density * 1.5) + 20;

    while (this.particles.length < segCount) {
      const angle = Math.random() * Math.PI * 2;
      const ring = Math.floor(Math.random() * 3);
      const baseR = this.shape === 'circle' ? sz / 2 - 15 + ring * 10 : sz / 2 + 6 + ring * 10;
      const isArc = Math.random() < 0.2;

      this.particles.push({
        x: 0, y: 0,
        vx: 0, vy: 0,
        angle,
        radius: baseR + (Math.random() - 0.5) * 5,
        angularSpeed: (0.01 + Math.random() * 0.02) * (ring % 2 === 0 ? 1 : -1) * (this.params.speed / 50),
        orbitLayer: ring,
        life: isArc ? 10 + Math.random() * 20 : 400 + Math.random() * 300,
        maxLife: isArc ? 30 : 700,
        size: isArc ? 1 + Math.random() * 2 : 1.5 + Math.random() * 2.5,
        color: ring === 0 ? this.params.color : ring === 1 ? this.params.secondaryColor : this.params.color,
        alpha: isArc ? 0.9 : 0.5 + Math.random() * 0.3,
        flowOffset: Math.random() * Math.PI * 2,
        trail: isArc ? [] : undefined,
      });
    }

    this.particles = this.particles.filter(p => {
      p.angle = (p.angle ?? 0) + (p.angularSpeed ?? 0);
      const pulse = 1 + Math.sin(this.shieldPhase * 3 + (p.angle ?? 0) * 2 + (p.flowOffset ?? 0)) * 0.02;
      const hitShake = this.shieldHitTimer > 0
        ? (Math.random() - 0.5) * this.shieldHitTimer * 3
        : 0;
      const r = (p.radius ?? 0) * pulse + hitShake;
      p.x = cx + Math.cos(p.angle ?? 0) * r;
      p.y = cy + Math.sin(p.angle ?? 0) * r;

      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 5) p.trail.shift();
      }

      p.life -= 1;
      return p.life > 0;
    });

    if (Math.random() < 0.003) {
      this.shieldHitTimer = 1;
    }
  }

  private drawShield(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const baseR = this.shape === 'circle' ? sz / 2 - 15 : sz / 2;
    const flowAngle = this.shieldPhase * 0.5;
    const time = this.shieldPhase;
    const colorNum = hexToNum(this.params.color);
    const secColorNum = hexToNum(this.params.secondaryColor);

    // Outer glow
    const outerAlpha = 0.6 + Math.sin(time * 2) * 0.2;
    const glowSteps = 8;
    for (let i = glowSteps; i >= 0; i--) {
      const t = i / glowSteps;
      const radius = (baseR - 5) + (baseR + 50 - (baseR - 5)) * t;
      const alpha = outerAlpha * (1 - t) * 0.1;
      g.circle(cx, cy, radius).fill({ color: colorNum, alpha });
    }

    // 3-layer shield rings
    const ringConfigs = [
      { r: baseR + 6,  alpha: 0.1,  color: colorNum },
      { r: baseR + 16, alpha: 0.15, color: secColorNum },
      { r: baseR + 26, alpha: 0.2,  color: colorNum },
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
        g.stroke({ width: 1.5, color: ring.color, alpha: ringAlpha });
      } else {
        // Square ring
        g.rect(cx - ring.r, cy - ring.r, ring.r * 2, ring.r * 2);
        g.stroke({ width: 1.5, color: ring.color, alpha: ringAlpha });
      }
    }

    // Flowing bright arc segments
    const arcCount = 7;
    for (let i = 0; i < arcCount; i++) {
      const ringIdx = i % 3;
      const ring = ringConfigs[ringIdx];
      const baseAngle = (i / arcCount) * Math.PI * 2;
      const arcStart = baseAngle + time * (0.3 + ringIdx * 0.12);
      const arcLen = 0.25 + Math.sin(time * 1.5 + i * 0.8) * 0.1;
      const arcAlpha = 0.6 + Math.sin(time * 2 + i * 1.2) * 0.2;
      const arcColor = i % 2 === 0 ? 0xffffff : ring.color;

      const steps = 16;
      g.moveTo(
        cx + Math.cos(arcStart) * ring.r,
        cy + Math.sin(arcStart) * ring.r,
      );
      for (let s = 1; s <= steps; s++) {
        const a = arcStart + (arcLen * s) / steps;
        g.lineTo(cx + Math.cos(a) * ring.r, cy + Math.sin(a) * ring.r);
      }
      g.stroke({ width: 2.5, color: arcColor, alpha: arcAlpha });
    }

    // Hex grid pattern
    const hexSize = 14;
    const hexR = baseR + 16;
    const hexPulse = 0.14 + Math.sin(time * 3) * 0.06;

    for (let row = -4; row <= 4; row++) {
      for (let col = -4; col <= 4; col++) {
        const hx = col * hexSize * 1.5;
        const hy = row * hexSize * Math.sqrt(3) + (col % 2 ? hexSize * Math.sqrt(3) / 2 : 0);
        const dist = Math.sqrt(hx * hx + hy * hy);
        if (dist < hexR - hexSize || dist > hexR + hexSize) continue;

        const cellAngle = Math.atan2(hy, hx);
        const flowDist = Math.abs(((cellAngle - flowAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const flowBright = flowDist < 0.8 ? 1 - flowDist / 0.8 : 0;

        const hexAlpha = hexPulse + flowBright * 0.15;
        // Draw hex
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
        g.stroke({ width: 0.6, color: colorNum, alpha: hexAlpha });
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

      const pAngle = Math.atan2(p.y - cy, p.x - cx);
      const flowProx = Math.abs(((pAngle - flowAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const flowMod = flowProx < 1 ? 1 + (1 - flowProx) * 0.5 : 1;

      // Outer glow
      g.circle(p.x, p.y, p.size * 2).fill({ color: pColor, alpha: Math.min(1, a * flowMod * 0.2) });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: Math.min(1, a * flowMod) });

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
        const alpha = this.shieldHitTimer * 0.3 * (1 - t) * 0.3;
        g.circle(cx, cy, radius).fill({ color: 0xffffff, alpha });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // ❄️ FROST
  // ════════════════════════════════════════════════════════════════════

  private updateFrost(cw: number, ch: number, sz: number) {
    const spd = this.params.speed / 50;
    const densityFactor = this.params.density / 50;

    // Spawn ice crystals at edge
    while (this.frostCrystals.length < Math.floor(30 * densityFactor)) {
      const t = Math.random();
      const ep = this.getEdgePoint(cw, ch, sz, t);
      this.frostCrystals.push({
        x: ep.x, y: ep.y,
        angle: Math.random() * Math.PI * 2,
        size: 2 + Math.random() * 4,
        branchLen: 8 + Math.random() * 15,
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
        size: 1 + Math.random() * 2.5,
        color: Math.random() > 0.5 ? '#e0f0ff' : '#b0d4ff',
        alpha: 0.5 + Math.random() * 0.5,
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
        size: 1 + Math.random() * 2,
        color: '#88ccff',
        alpha: 0.6 + Math.random() * 0.4,
      });
    }

    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      // Snowflakes sway
      if (p.rotSpeed !== undefined) {
        p.vx += Math.sin(this.time * 2 + (p.flickerPhase ?? 0)) * 0.02;
        p.rotAngle = (p.rotAngle ?? 0) + (p.rotSpeed ?? 0);
      }
      p.life -= 1;
      return p.life > 0 && p.y < ch + 10;
    });
  }

  private drawFrost(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;

    // Background ice glow
    const glowAlpha = 0.04 + Math.sin(this.time * 0.5) * 0.02;
    for (let i = 5; i >= 0; i--) {
      const t = i / 5;
      const radius = r * 0.8 + (r * 1.3 - r * 0.8) * t;
      g.circle(cx, cy, radius).fill({ color: 0x88ccff, alpha: glowAlpha * (1 - t) });
    }

    // Draw frost crystals (branching lines at edges)
    for (const crystal of this.frostCrystals) {
      const alpha = 0.3 + Math.sin(this.time + crystal.angle) * 0.15;
      // Main branch
      const x2 = crystal.x + Math.cos(crystal.angle) * crystal.branchLen;
      const y2 = crystal.y + Math.sin(crystal.angle) * crystal.branchLen;
      g.moveTo(crystal.x, crystal.y);
      g.lineTo(x2, y2);
      g.stroke({ width: 1, color: 0xcceeFF, alpha });

      // Sub-branches
      for (let i = 0; i < 2; i++) {
        const t = 0.4 + i * 0.3;
        const mx = crystal.x + (x2 - crystal.x) * t;
        const my = crystal.y + (y2 - crystal.y) * t;
        const subAngle = crystal.angle + (i === 0 ? 0.6 : -0.6);
        const subLen = crystal.branchLen * 0.4;
        g.moveTo(mx, my);
        g.lineTo(mx + Math.cos(subAngle) * subLen, my + Math.sin(subAngle) * subLen);
        g.stroke({ width: 0.7, color: 0xaaddFF, alpha: alpha * 0.7 });
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
          g.stroke({ width: 0.5, color: 0xffffff, alpha: a * 0.4 });
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🌊 RIPPLE
  // ════════════════════════════════════════════════════════════════════

  private updateRipple(cw: number, ch: number, sz: number) {
    this.ripplePhase += 0.02 * (this.params.speed / 50);

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
        color: Math.random() > 0.5 ? '#88ddff' : '#ffffff',
        alpha: 0.4 + Math.random() * 0.6,
        flickerSpeed: 3 + Math.random() * 5,
        flickerPhase: Math.random() * Math.PI * 2,
      });
    }

    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      return p.life > 0;
    });
  }

  private drawRipple(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const phase = this.ripplePhase;
    const intensity = this.params.intensity / 100;
    const ringCount = 4 + Math.floor(intensity * 3);

    // Concentric expanding rings
    for (let i = 0; i < ringCount; i++) {
      const t = ((phase + i / ringCount) % 1);
      const radius = r * 0.3 + t * r * 0.9;
      const alpha = (1 - t) * 0.35 * (0.5 + Math.sin(phase * 3 + i) * 0.3);
      if (alpha > 0.005) {
        g.circle(cx, cy, radius).stroke({ width: 1.5 + (1 - t) * 1.5, color: hexToNum(this.params.color), alpha });
      }
    }

    // Secondary phase rings
    for (let i = 0; i < ringCount - 1; i++) {
      const t = ((phase * 0.7 + 0.3 + i / (ringCount - 1)) % 1);
      const radius = r * 0.2 + t * r * 0.85;
      const alpha = (1 - t) * 0.2 * (0.5 + Math.cos(phase * 2 + i * 1.5) * 0.3);
      if (alpha > 0.005) {
        g.circle(cx, cy, radius).stroke({ width: 1, color: hexToNum(this.params.secondaryColor), alpha });
      }
    }

    // Water surface glow
    const glowAlpha = 0.03 + Math.sin(phase * 2) * 0.015;
    for (let i = 4; i >= 0; i--) {
      const t = i / 4;
      g.circle(cx, cy, r * (0.5 + t * 0.6)).fill({ color: hexToNum(this.params.color), alpha: glowAlpha * (1 - t) });
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
    this.petalTime += 0.016 * (this.params.speed / 50);

    // Spawn petals from top (gradually ramp up)
    const warmup = Math.min(1, this.petalTime / 2);
    const spawnRate = Math.floor(this.params.density / 10) + 1;
    const petalColors = ['#ffb6c1', '#ffc0cb', '#ff69b4', '#fff0f5', '#ffffff'];
    for (let i = 0; i < spawnRate * warmup; i++) {
      this.particles.push({
        x: Math.random() * cw,
        y: -10 - Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.5 + Math.random() * 1.2,
        life: 200 + Math.random() * 300,
        maxLife: 500,
        size: 3 + Math.random() * 4,
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        alpha: 0.6 + Math.random() * 0.4,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 1 + Math.random() * 2,
        rotAngle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
      });
    }

    this.particles = this.particles.filter(p => {
      // Swaying motion
      p.x += p.vx + Math.sin(this.petalTime * (p.swaySpeed ?? 1.5) + (p.swayPhase ?? 0)) * 0.8;
      p.y += p.vy;
      p.rotAngle = (p.rotAngle ?? 0) + (p.rotSpeed ?? 0);
      p.vy += 0.002; // slight gravity
      p.vy *= 0.999; // terminal velocity
      p.life -= 1;
      return p.life > 0 && p.y < ch + 20;
    });
  }

  private drawPetal(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
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
      g.circle(p.x, p.y, p.size * 2).fill({ color: pColor, alpha: a * 0.18 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // �?STARDUST
  // ════════════════════════════════════════════════════════════════════

  private updateStardust(cw: number, ch: number, sz: number) {
    this.stardustTime += 0.016 * (this.params.speed / 50);
    const cx = cw / 2, cy = ch / 2;

    // Maintain star particles around edge
    const targetCount = Math.floor(this.params.density * 1.2) + 20;
    while (this.particles.length < targetCount) {
      const angle = Math.random() * Math.PI * 2;
      const dist = sz * 0.35 + Math.random() * sz * 0.3;
      const isNebula = Math.random() < 0.15;
      this.particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        life: 300 + Math.random() * 500,
        maxLife: 800,
        size: isNebula ? 10 + Math.random() * 20 : 0.5 + Math.random() * 2.5,
        color: isNebula
          ? (Math.random() > 0.5 ? '#2a1a4e' : '#1a1a3e')
          : (Math.random() > 0.5 ? '#aa88ff' : '#6644cc'),
        alpha: isNebula ? 0.05 + Math.random() * 0.08 : 0.3 + Math.random() * 0.7,
        flickerSpeed: 1 + Math.random() * 4,
        flickerPhase: Math.random() * Math.PI * 2,
        angle,
        angularSpeed: (Math.random() - 0.5) * 0.003,
      });
    }

    // Spawn meteors occasionally
    this.meteorTimer += 1;
    const meteorInterval = Math.max(30, 120 - this.params.density);
    if (this.meteorTimer >= meteorInterval) {
      this.meteorTimer = 0;
      const side = Math.random();
      let mx: number, my: number, mvx: number, mvy: number;
      if (side < 0.5) {
        mx = Math.random() * cw * 0.5;
        my = -10;
        mvx = 2 + Math.random() * 3;
        mvy = 1.5 + Math.random() * 2;
      } else {
        mx = cw + 10;
        my = Math.random() * ch * 0.3;
        mvx = -(2 + Math.random() * 3);
        mvy = 1.5 + Math.random() * 2;
      }
      this.meteors.push({ x: mx, y: my, vx: mvx, vy: mvy, life: 40, maxLife: 40, length: 15 + Math.random() * 20 });
    }

    // Update particles with slow rotation
    this.particles = this.particles.filter(p => {
      p.angle = (p.angle ?? 0) + (p.angularSpeed ?? 0);
      const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      const a2 = Math.atan2(p.y - cy, p.x - cx) + (p.angularSpeed ?? 0);
      p.x = cx + Math.cos(a2) * dist;
      p.y = cy + Math.sin(a2) * dist;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      return p.life > 0;
    });

    // Update meteors
    this.meteors = this.meteors.filter(m => {
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 1;
      return m.life > 0;
    });
  }

  private drawStardust(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {

    // Background nebula glow
    for (const p of this.particles) {
      if (p.size > 8) {
        const a = p.alpha * (0.7 + Math.sin(this.stardustTime * 0.3 + (p.flickerPhase ?? 0)) * 0.3);
        const pColor = hexToNum(p.color);
        g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a });
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
      g.circle(p.x, p.y, p.size * 3.5).fill({ color: pColor, alpha: a * 0.15 });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * 0.8 });
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
        g.circle(px, py, 1.5 * (1 - t * 0.7)).fill({ color: 0xffffff, alpha: segAlpha });
        g.circle(px, py, 3 * (1 - t * 0.7)).fill({ color: 0xaa88ff, alpha: segAlpha * 0.3 });
      }
      // Head
      g.circle(m.x, m.y, 2).fill({ color: 0xffffff, alpha: a });
      g.circle(m.x, m.y, 5).fill({ color: 0xaa88ff, alpha: a * 0.3 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 💎 PRISM
  // ════════════════════════════════════════════════════════════════════

  private updatePrism(cw: number, ch: number, sz: number) {
    this.prismTime += 0.016 * (this.params.speed / 50);

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
        vx: -ep.nx * (0.5 + Math.random() * 1.5),
        vy: -ep.ny * (0.5 + Math.random() * 1.5),
        life: 50 + Math.random() * 80,
        maxLife: 130,
        size: 1.5 + Math.random() * 3,
        color: '#' + rainbowColors[colorIdx].toString(16).padStart(6, '0'),
        alpha: 0.5 + Math.random() * 0.5,
        trail: [],
      });
    }

    this.particles = this.particles.filter(p => {
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 5) p.trail.shift();
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.life -= 1;
      return p.life > 0;
    });
  }

  private drawPrism(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const time = this.prismTime;
    const rainbowColors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0x4400ff, 0x8800ff];

    // Prismatic light rays from edge
    const rayCount = 7;
    for (let i = 0; i < rayCount; i++) {
      const baseAngle = (i / rayCount) * Math.PI * 2 + time * 0.2;
      const rayLen = r * 0.4 + Math.sin(time * 2 + i) * r * 0.1;
      const innerR = r * 0.6;
      const x1 = cx + Math.cos(baseAngle) * innerR;
      const y1 = cy + Math.sin(baseAngle) * innerR;
      const x2 = cx + Math.cos(baseAngle) * (innerR + rayLen);
      const y2 = cy + Math.sin(baseAngle) * (innerR + rayLen);
      const alpha = 0.25 + Math.sin(time * 3 + i * 0.8) * 0.15;

      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke({ width: 2.5, color: rainbowColors[i], alpha });

      // Glow around ray
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      g.circle(mx, my, 8).fill({ color: rainbowColors[i], alpha: alpha * 0.25 });
    }

    // Prismatic halo
    for (let i = 0; i < 7; i++) {
      const t = (time * 0.5 + i / 7) % 1;
      const haloR = r * 0.55 + t * r * 0.25;
      const alpha = 0.08 * (1 - t);
      g.circle(cx, cy, haloR).stroke({ width: 1.5, color: rainbowColors[i], alpha });
    }

    // White incoming beam
    const beamAngle = time * 0.3;
    const beamLen = r * 1.1;
    g.moveTo(cx - Math.cos(beamAngle) * beamLen, cy - Math.sin(beamAngle) * beamLen);
    g.lineTo(cx + Math.cos(beamAngle) * r * 0.3, cy + Math.sin(beamAngle) * r * 0.3);
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.2 + Math.sin(time) * 0.1 });

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

      g.circle(p.x, p.y, p.size * 1.8).fill({ color: pColor, alpha: a * 0.15 });
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * 0.8 });
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * 0.6 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🌪�?VORTEX
  // ════════════════════════════════════════════════════════════════════

  private updateVortex(cw: number, ch: number, sz: number) {
    this.vortexTime += 0.016 * (this.params.speed / 50);
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
      p.spiralAngle = (p.spiralAngle ?? 0) + (p.spiralSpeed ?? 0.02);
      // Spiral inward slowly
      p.spiralRadius = (p.spiralRadius ?? 0) - 0.1;
      if ((p.spiralRadius ?? 0) < sz * 0.08) {
        p.spiralRadius = sz * 0.08 + Math.random() * sz * 0.1;
      }

      p.x = cx + Math.cos(p.spiralAngle ?? 0) * (p.spiralRadius ?? 0);
      p.y = cy + Math.sin(p.spiralAngle ?? 0) * (p.spiralRadius ?? 0);

      if (p.trail) {
        p.trail.push({ x: oldX, y: oldY, alpha: p.alpha, size: p.size });
        if (p.trail.length > 6) p.trail.shift();
      }

      p.life -= 1;
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
    this.fireworkTimer += this.params.speed / 50;

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
      const burstColors = ['#ff4466', '#ffaa00', '#44ff88', '#4488ff', '#ff44ff', '#ffff44', '#ffffff'];
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
          size: 1.5 + Math.random() * 2,
          color: Math.random() > 0.4 ? burstColor : burstColor2,
          alpha: 0.8 + Math.random() * 0.2,
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
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // gravity
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.size *= 0.995;
        p.life -= 1;
        return p.life > 0;
      });
      burst.life -= 1;
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
    this.goldTime += 0.016 * (this.params.speed / 50);

    // Spawn gold particles from top
    const spawnRate = Math.floor(this.params.density / 8) + 2;
    const goldColors = ['#ffd700', '#ffec8b', '#daa520', '#ffffff'];
    for (let i = 0; i < spawnRate; i++) {
      const isDust = Math.random() < 0.4;
      this.particles.push({
        x: Math.random() * cw,
        y: -5 - Math.random() * 15,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 0.4 + Math.random() * 1.0,
        life: 150 + Math.random() * 250,
        maxLife: 400,
        size: isDust ? 0.5 + Math.random() * 1 : 2 + Math.random() * 3.5,
        color: goldColors[Math.floor(Math.random() * goldColors.length)],
        alpha: isDust ? 0.3 + Math.random() * 0.4 : 0.6 + Math.random() * 0.4,
        flickerSpeed: 4 + Math.random() * 8,
        flickerPhase: Math.random() * Math.PI * 2,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.5 + Math.random() * 1.5,
      });
    }

    this.particles = this.particles.filter(p => {
      p.x += p.vx + Math.sin(this.goldTime * (p.swaySpeed ?? 1) + (p.swayPhase ?? 0)) * 0.3;
      p.y += p.vy;
      p.vy += 0.001;
      p.life -= 1;
      return p.life > 0 && p.y < ch + 10;
    });
  }

  private drawGold(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    // Background warm glow
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const glowAlpha = 0.02 + Math.sin(this.goldTime * 1.5) * 0.01;
    for (let i = 4; i >= 0; i--) {
      const t = i / 4;
      g.circle(cx, cy, r * (0.6 + t * 0.5)).fill({ color: 0xffd700, alpha: glowAlpha * (1 - t) });
    }

    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const fadeIn = lifeRatio > 0.9 ? (1 - lifeRatio) / 0.1 : 1;
      const fadeOut = lifeRatio < 0.1 ? lifeRatio / 0.1 : 1;
      const flicker = 0.3 + 0.7 * Math.abs(Math.sin(this.goldTime * (p.flickerSpeed ?? 6) + (p.flickerPhase ?? 0)));
      const a = lifeRatio * p.alpha * fadeIn * fadeOut * flicker;
      const pColor = hexToNum(p.color);

      // Outer glow
      g.circle(p.x, p.y, p.size * 3.5).fill({ color: pColor, alpha: a * 0.14 });
      // Core
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: a * 0.8 });
      // Bright center
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: a * 0.95 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🔄 SPIN
  // ════════════════════════════════════════════════════════════════════

  private updateSpin(cw: number, ch: number, sz: number) {
    this.spinTime += 0.016 * (this.params.speed / 50);
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
      p.angle = (p.angle ?? 0) + (p.angularSpeed ?? 0.02);
      // Slight radius oscillation
      const wobble = Math.sin(this.spinTime * 2 + (p.orbitLayer ?? 0)) * sz * 0.02;
      p.x = cx + Math.cos(p.angle ?? 0) * ((p.radius ?? 0) + wobble);
      p.y = cy + Math.sin(p.angle ?? 0) * ((p.radius ?? 0) + wobble);
      if (p.trail) {
        p.trail.push({ x: oldX, y: oldY, alpha: p.alpha, size: p.size });
        if (p.trail.length > 8) p.trail.shift();
      }
      p.life -= 1;
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
    const targetCount = dotCount * 6; // dots + trails

    while (this.particles.length < targetCount) {
      const idx = this.particles.length % dotCount;
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
      p.x = cx + Math.cos(eased) * (p.radius ?? 0);
      p.y = cy + Math.sin(eased) * (p.radius ?? 0);
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
    g.circle(cx, cy, sz * 0.25).stroke({ color: colorNum, alpha: 0.08, width: 1 });
  }

  // ════════════════════════════════════════════════════════════════════
  // 🟢 MATRIX
  // ════════════════════════════════════════════════════════════════════

  private updateMatrix(cw: number, _ch: number, sz: number) {
    this.matrixTimer += 0.016 * (this.params.speed / 50);
    const colWidth = 12;
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
    const colCount = Math.floor((endX - startX) / colWidth);

    // Initialize columns
    if (this.matrixColumns.length === 0) {
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
    const greenNum = hexToNum(this.params.color);
    const darkGreenNum = hexToNum(this.params.secondaryColor);

    // Background tint (circle or rect)
    if (this.shape === 'circle') {
      g.circle(cx, cy, r).fill({ color: 0x000000, alpha: 0.3 });
    } else {
      g.rect(cx - r, topY, sz, sz).fill({ color: 0x000000, alpha: 0.3 });
    }

    for (const col of this.matrixColumns) {
      const visibleChars = Math.floor(sz / charH);
      for (let i = 0; i < Math.min(col.chars.length, visibleChars); i++) {
        const y = topY + ((col.phase + i * charH) % sz);
        if (y < topY || y > bottomY) continue;
        // In circle mode, skip characters outside the circle
        if (this.shape === 'circle') {
          const dx = col.x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy > r * r) continue;
        }
        const isHead = i === 0;
        const fadeT = i / visibleChars;
        const alpha = isHead ? 1 : Math.max(0, 0.8 - fadeT * 0.7);
        const color = isHead ? 0xffffff : (fadeT < 0.3 ? greenNum : darkGreenNum);
        // Varying character sizes for visual interest
        const charW = 4 + (col.chars[i]?.charCodeAt(0) % 3) * 1.5;
        const charH2 = 8 + (col.chars[i]?.charCodeAt(0) % 4) * 2;
        g.rect(col.x - charW / 2, y - charH2 / 2, charW, charH2).fill({ color, alpha: alpha * 0.8 });
        // Bright head with glow
        if (isHead) {
          g.circle(col.x, y, 8).fill({ color: greenNum, alpha: 0.25 });
          g.circle(col.x, y, 4).fill({ color: 0xffffff, alpha: 0.8 });
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 🫧 BUBBLE
  // ════════════════════════════════════════════════════════════════════

  private updateBubble(cw: number, ch: number, sz: number) {
    this.bubbleTime += 0.016 * (this.params.speed / 50);
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const warmup = Math.min(1, this.bubbleTime / 2);
    const targetCount = Math.floor((this.params.density * 1.5 + 20) * warmup);

    while (this.particles.length < targetCount) {
      // In circle mode, spawn within the circle
      let px: number;
      if (this.shape === 'circle') {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * r * 0.7;
        px = cx + Math.cos(angle) * dist;
      } else {
        px = cx + (Math.random() - 0.5) * sz * 0.8;
      }
      this.particles.push({
        x: px,
        y: cy + r * 0.8 + Math.random() * r * 0.2,
        vx: 0, vy: 0,
        life: 200 + Math.random() * 300,
        maxLife: 500,
        size: 3 + Math.random() * 6,
        color: Math.random() > 0.5 ? this.params.color : this.params.secondaryColor,
        alpha: 0.3 + Math.random() * 0.4,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 1 + Math.random() * 2,
      });
    }

    this.particles = this.particles.filter(p => {
      // Rise
      p.y -= 0.5 + Math.random() * 0.3;
      // Sway
      p.x += Math.sin(this.bubbleTime * (p.swaySpeed ?? 1) + (p.swayPhase ?? 0)) * 0.5;
      // Slight shrink as it rises
      p.size *= 0.9995;
      p.life -= 1;
      // Pop near top
      return p.life > 0 && p.y > cy - r * 0.9;
    });
  }

  private drawBubble(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {

    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      const a = p.alpha * Math.min(1, lifeRatio * 3);
      const pColor = hexToNum(p.color);

      // Bubble rim
      g.circle(p.x, p.y, p.size).stroke({ color: pColor, alpha: a * 0.7, width: 1.5 });
      // Inner glow
      g.circle(p.x, p.y, p.size * 0.7).fill({ color: pColor, alpha: a * 0.1 });
      // Highlight
      g.circle(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.25).fill({ color: 0xffffff, alpha: a * 0.5 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════
  // AURORA
  // ════════════════════════════════════════════════════════════════════

  private updateAurora(cw: number, ch: number, sz: number) {
    this.auroraTime += 0.016 * (this.params.speed / 50);
    const targetCount = Math.floor(this.params.density * 1.5) + 30;

    while (this.particles.length < targetCount) {
      this.particles.push({
        x: Math.random() * cw,
        y: ch / 2 - sz / 2 + Math.random() * sz * 0.4,
        vx: 0, vy: 0,
        life: 300 + Math.random() * 500,
        maxLife: 800,
        size: 20 + Math.random() * 40,
        color: Math.random() > 0.5 ? this.params.color : this.params.secondaryColor,
        alpha: 0.05 + Math.random() * 0.1,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.3 + Math.random() * 0.7,
      });
    }

    this.particles = this.particles.filter(p => {
      p.x += Math.sin(this.auroraTime * (p.swaySpeed ?? 0.5) + (p.swayPhase ?? 0)) * 1.5;
      p.y += Math.sin(this.auroraTime * 0.3 + (p.swayPhase ?? 0)) * 0.3;
      p.alpha = (0.05 + 0.08 * Math.sin(this.auroraTime * 2 + (p.swayPhase ?? 0))) * (p.life / (p.maxLife ?? 800));
      p.life -= 1;
      return p.life > 0;
    });
  }

  private drawAurora(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    for (const p of this.particles) {
      const pColor = hexToNum(p.color);
      g.ellipse(p.x, p.y, p.size, p.size * 0.3).fill({ color: pColor, alpha: p.alpha });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // FIREFLY
  // ════════════════════════════════════════════════════════════════════

  private updateFirefly(cw: number, ch: number, sz: number) {
    this.fireflyTime += 0.016 * (this.params.speed / 50);
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const targetCount = Math.floor(this.params.density * 0.8) + 15;

    while (this.particles.length < targetCount) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r * 0.85;
      this.particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: 400 + Math.random() * 600,
        maxLife: 1000,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.4 ? this.params.color : this.params.secondaryColor,
        alpha: 0,
        flickerSpeed: 1 + Math.random() * 3,
        flickerPhase: Math.random() * Math.PI * 2,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.5 + Math.random() * 1.5,
      });
    }

    this.particles = this.particles.filter(p => {
      p.vx += (Math.random() - 0.5) * 0.05;
      p.vy += (Math.random() - 0.5) * 0.05;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.x += p.vx + Math.sin(this.fireflyTime * (p.swaySpeed ?? 1) + (p.swayPhase ?? 0)) * 0.2;
      p.y += p.vy + Math.cos(this.fireflyTime * (p.swaySpeed ?? 1) + (p.swayPhase ?? 0)) * 0.15;

      const dx = p.x - cx, dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r * 0.9) {
        p.vx -= dx * 0.001;
        p.vy -= dy * 0.001;
      }

      const flicker = 0.3 + 0.7 * Math.abs(Math.sin(this.fireflyTime * (p.flickerSpeed ?? 2) + (p.flickerPhase ?? 0)));
      const lifeRatio = p.life / (p.maxLife ?? 1000);
      const fadeIn = lifeRatio > 0.9 ? (1 - lifeRatio) / 0.1 : 1;
      const fadeOut = lifeRatio < 0.1 ? lifeRatio / 0.1 : 1;
      p.alpha = flicker * fadeIn * fadeOut;

      p.life -= 1;
      return p.life > 0;
    });
  }

  private drawFirefly(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    for (const p of this.particles) {
      const pColor = hexToNum(p.color);
      g.circle(p.x, p.y, p.size * 4).fill({ color: pColor, alpha: p.alpha * 0.08 });
      g.circle(p.x, p.y, p.size * 2).fill({ color: pColor, alpha: p.alpha * 0.2 });
      g.circle(p.x, p.y, p.size).fill({ color: pColor, alpha: p.alpha * 0.7 });
      g.circle(p.x, p.y, p.size * 0.3).fill({ color: 0xffffff, alpha: p.alpha * 0.9 });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // RAIN
  // ════════════════════════════════════════════════════════════════════

  private updateRain(cw: number, ch: number, sz: number) {
    this.rainTime += 0.016 * (this.params.speed / 50);
    const cx = cw / 2, cy = ch / 2, r = sz / 2;
    const targetCount = Math.floor(this.params.density * 2) + 40;

    while (this.particles.length < targetCount) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r * 0.9;
      this.particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy - r + Math.random() * r * 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 3 + Math.random() * 4,
        life: 60 + Math.random() * 80,
        maxLife: 140,
        size: 1 + Math.random() * 1.5,
        color: Math.random() > 0.3 ? this.params.color : this.params.secondaryColor,
        alpha: 0.4 + Math.random() * 0.4,
        trail: [],
      });
    }

    this.particles = this.particles.filter(p => {
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha, size: p.size });
        if (p.trail.length > 4) p.trail.shift();
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;

      if (this.shape === 'circle') {
        const dx = p.x - cx, dy = p.y - cy;
        if (dx * dx + dy * dy > r * r) {
          p.life = 0;
        }
      }

      p.life -= 1;
      return p.life > 0 && p.y < ch + 10;
    });
  }

  private drawRain(g: PIXI.Graphics, _cw: number, _ch: number, _sz: number) {
    for (const p of this.particles) {
      const lifeRatio = p.life / (p.maxLife ?? 140);
      const a = p.alpha * Math.min(1, lifeRatio * 3);
      const pColor = hexToNum(p.color);

      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.5, p.y - p.vy * 0.5);
      g.stroke({ color: pColor, alpha: a, width: p.size });

      g.circle(p.x, p.y, p.size * 2).fill({ color: pColor, alpha: a * 0.15 });
    }
  }
  // ════════════════════════════════════════════════════════════════════
  // SOLID RING
  // ════════════════════════════════════════════════════════════════════

  private updateSolidRing(_cw: number, _ch: number, _sz: number) {
    const spd = this.params.speed / 50;
    this.solidRingAngle += spd * 0.03;
  }

  private drawSolidRing(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const r = sz / 2;
    const lineWidth = 4 + (this.params.intensity / 100) * 36;
    const steps = 720;
    const time = this.solidRingAngle;

    // Vivid gradient: red → orange → green → blue
    const rainbowColors = [
      '#ff0040',
      '#ff8000',
      '#00ff80',
      '#00b0ff',
      '#ff0040',
    ];

    const ringR = r - lineWidth / 2;

    if (this.shape === 'square') {
      const cornerRadius = 16;
      const half = ringR;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const colorT = (t + time * 0.3) % 1;
        const colorIdx = colorT * (rainbowColors.length - 1);
        const ci = Math.floor(colorIdx);
        const cf = colorIdx - ci;
        const segColor = lerpColor(
          rainbowColors[ci],
          rainbowColors[Math.min(ci + 1, rainbowColors.length - 1)],
          cf
        );
        const p1 = this.getRoundRectPoint(cx, cy, half, cornerRadius, t);
        const p2 = this.getRoundRectPoint(cx, cy, half, cornerRadius, (i + 1) / steps);
        g.moveTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
        g.stroke({ width: lineWidth, color: segColor, alpha: 1 });
      }
      return;
    }

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const colorT = (t + time * 0.3) % 1;
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
      g.beginPath();
      g.arc(cx, cy, ringR, a1, a2);
      g.stroke({ width: lineWidth, color: segColor, alpha: 1 });
    }
  }

  // ─── Disc ───
  private updateDisc(_cw: number, _ch: number, _sz: number) {
    const spd = this.params.speed / 50;
    this.discAngle += spd * 0.02;
  }

  private drawDisc(g: PIXI.Graphics, cw: number, ch: number, sz: number) {
    const cx = cw / 2, cy = ch / 2;
    const r = sz / 2;
    // Ring width: 15-50px based on intensity
    const ringWidth = 15 + (this.params.intensity / 100) * 35;
    const ringR = r - ringWidth / 2;

    // 1. Continuous rainbow gradient ring (Google One style)
    // Palette: red → orange → yellow → green → blue → purple → red
    const discColors = [
      '#ff0040', '#ff8000', '#ffe000', '#00ff80', '#00b0ff', '#a040ff', '#ff0040',
    ];
    const steps = 720;

    if (this.shape === 'square') {
      const cornerRadius = 16;
      const half = ringR;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const colorT = ((t + this.discAngle / (Math.PI * 2)) % 1) * (discColors.length - 1);
        const ci = Math.floor(colorT);
        const cf = colorT - ci;
        const segColor = lerpColor(
          discColors[ci],
          discColors[Math.min(ci + 1, discColors.length - 1)],
          cf,
        );
        const p1 = this.getRoundRectPoint(cx, cy, half, cornerRadius, t);
        const p2 = this.getRoundRectPoint(cx, cy, half, cornerRadius, (i + 1) / steps);
        g.moveTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
        g.stroke({ width: ringWidth, color: segColor, alpha: 1 });
      }
    } else {
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const angle1 = t * Math.PI * 2 + this.discAngle;
        const angle2 = (t + 1 / steps) * Math.PI * 2 + this.discAngle;

        const colorT = t * (discColors.length - 1);
        const ci = Math.floor(colorT);
        const cf = colorT - ci;
        const segColor = lerpColor(
          discColors[ci],
          discColors[Math.min(ci + 1, discColors.length - 1)],
          cf,
        );

        const x1 = cx + Math.cos(angle1) * ringR;
        const y1 = cy + Math.sin(angle1) * ringR;
        const x2 = cx + Math.cos(angle2) * ringR;
        const y2 = cy + Math.sin(angle2) * ringR;

        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke({ width: ringWidth, color: segColor, alpha: 1 });
      }
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
    this.matrixColumns = [];
    this.matrixTimer = 0;
    this.bubbleTime = 0;
    this.auroraTime = 0;

    this.fireflyTime = 0;
    this.rainTime = 0;
    this.solidRingAngle = 0;
    this.discAngle = 0;
  }
}
