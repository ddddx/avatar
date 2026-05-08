import type { Application, Container, Graphics } from 'pixi.js';

export type EffectType = 'lightning' | 'fire' | 'glow' | 'orbit' | 'shield' | 'frost' | 'ripple' | 'petal' | 'stardust' | 'prism' | 'vortex' | 'firework' | 'gold';
export type CropShape = 'circle' | 'square';

export interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
  size: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  // lifecycle helpers
  birthTime?: number;
  // orbit fields
  angle?: number;
  radius?: number;
  angularSpeed?: number;
  orbitLayer?: number;
  // lightning fields
  x2?: number;
  y2?: number;
  branches?: Particle[];
  lightningAge?: number;
  lightningDuration?: number;
  // trail
  trail?: TrailPoint[];
  // shield energy flow
  flowOffset?: number;
  // flicker
  flickerSpeed?: number;
  flickerPhase?: number;
  // frost
  rotAngle?: number;
  rotSpeed?: number;
  // petal
  swayPhase?: number;
  swaySpeed?: number;
  // vortex
  spiralAngle?: number;
  spiralRadius?: number;
  spiralSpeed?: number;
  // firework
  fireworkPhase?: number;
}

export interface EffectParams {
  density: number;       // 1-100
  intensity: number;     // 1-100
  speed: number;         // 1-100
  color: string;         // hex color
  secondaryColor: string;
}

export interface AvatarState {
  image: HTMLImageElement | null;
  effect: EffectType;
  shape: CropShape;
  params: EffectParams;
}

export interface PixiContext {
  app: Application;
  container: Container;
  graphics: Graphics;
}

export const DEFAULT_PARAMS: EffectParams = {
  density: 50,
  intensity: 50,
  speed: 50,
  color: '#00d4ff',
  secondaryColor: '#ff6b35',
};

export const EFFECT_PRESETS: Record<EffectType, Partial<EffectParams>> = {
  lightning: { color: '#00d4ff', secondaryColor: '#8b5cf6', density: 40, intensity: 60, speed: 70 },
  fire:      { color: '#ff6b35', secondaryColor: '#ffcc02', density: 60, intensity: 70, speed: 50 },
  glow:      { color: '#a855f7', secondaryColor: '#ec4899', density: 50, intensity: 50, speed: 40 },
  orbit:     { color: '#00ffcc', secondaryColor: '#0088ff', density: 30, intensity: 50, speed: 50 },
  shield:    { color: '#00ffaa', secondaryColor: '#00ccff', density: 40, intensity: 60, speed: 30 },
  frost:     { color: '#e0f0ff', secondaryColor: '#88ccff', density: 50, intensity: 50, speed: 40 },
  ripple:    { color: '#44aaff', secondaryColor: '#88ddff', density: 40, intensity: 60, speed: 45 },
  petal:     { color: '#ffb6c1', secondaryColor: '#ff69b4', density: 50, intensity: 50, speed: 40 },
  stardust:  { color: '#6644cc', secondaryColor: '#aa88ff', density: 60, intensity: 50, speed: 30 },
  prism:     { color: '#ff4444', secondaryColor: '#4444ff', density: 50, intensity: 60, speed: 50 },
  vortex:    { color: '#00ccff', secondaryColor: '#8844ff', density: 60, intensity: 70, speed: 70 },
  firework:  { color: '#ff4466', secondaryColor: '#ffaa00', density: 50, intensity: 70, speed: 50 },
  gold:      { color: '#ffd700', secondaryColor: '#ffec8b', density: 50, intensity: 50, speed: 40 },
};
