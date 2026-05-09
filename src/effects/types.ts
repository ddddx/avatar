import type { Application, Container, Graphics } from 'pixi.js';

export type EffectType = 'lightning' | 'fire' | 'glow' | 'orbit' | 'shield' | 'frost' | 'ripple' | 'petal' | 'stardust' | 'prism' | 'vortex' | 'firework' | 'gold' | 'spin' | 'loader' | 'matrix' | 'bubble' | 'pulse';
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
  lightning: { color: '#4dc9f6', secondaryColor: '#a855f7', density: 40, intensity: 60, speed: 35 },
  fire:      { color: '#ff4500', secondaryColor: '#ffd700', density: 65, intensity: 75, speed: 55 },
  glow:      { color: '#c084fc', secondaryColor: '#f472b6', density: 55, intensity: 60, speed: 40 },
  orbit:     { color: '#34d399', secondaryColor: '#60a5fa', density: 40, intensity: 55, speed: 50 },
  shield:    { color: '#22d3ee', secondaryColor: '#a78bfa', density: 50, intensity: 65, speed: 35 },
  frost:     { color: '#e0f2fe', secondaryColor: '#7dd3fc', density: 55, intensity: 55, speed: 40 },
  ripple:    { color: '#38bdf8', secondaryColor: '#a5f3fc', density: 50, intensity: 65, speed: 45 },
  petal:     { color: '#fda4af', secondaryColor: '#fb7185', density: 55, intensity: 55, speed: 40 },
  stardust:  { color: '#c084fc', secondaryColor: '#e879f9', density: 65, intensity: 55, speed: 35 },
  prism:     { color: '#f87171', secondaryColor: '#60a5fa', density: 55, intensity: 65, speed: 50 },
  vortex:    { color: '#22d3ee', secondaryColor: '#a855f7', density: 65, intensity: 75, speed: 65 },
  firework:  { color: '#fb923c', secondaryColor: '#fbbf24', density: 55, intensity: 75, speed: 50 },
  gold:      { color: '#fbbf24', secondaryColor: '#fde68a', density: 55, intensity: 60, speed: 40 },
  spin:      { color: '#a78bfa', secondaryColor: '#60a5fa', density: 50, intensity: 60, speed: 55 },
  loader:    { color: '#60a5fa', secondaryColor: '#a78bfa', density: 30, intensity: 50, speed: 50 },
  matrix:    { color: '#22c55e', secondaryColor: '#16a34a', density: 60, intensity: 65, speed: 45 },
  bubble:    { color: '#67e8f9', secondaryColor: '#a5f3fc', density: 55, intensity: 55, speed: 40 },
  pulse:     { color: '#f472b6', secondaryColor: '#c084fc', density: 40, intensity: 70, speed: 50 },
};
