import type { Application, Container, Graphics } from 'pixi.js';

export type EffectType = 'lightning' | 'fire' | 'glow' | 'orbit' | 'shield' | 'frost' | 'ripple' | 'petal' | 'stardust' | 'prism' | 'vortex' | 'firework' | 'gold' | 'spin' | 'loader' | 'spinner' | 'matrix' | 'bubble' | 'aurora' | 'firefly' | 'rain' | 'solidring' | 'disc' | 'googleone' | 'duotone' | 'blinkring' | 'linxudo' | 'bounce' | 'collapsequad' | 'axisrings' | 'neoncomet' | 'equalizer' | 'magiccircle' | 'cyberhud' | 'crtglitch' | 'portal' | 'kaleidoscope';
export type CropShape = 'circle' | 'square';
export type RotationDirection = 'forward' | 'reverse';
export type RingAnimationMode = 'rotate' | 'breathe';
export const SQUARE_CORNER_RADIUS = 16;
export const RING_LOOP_FRAME_COUNT = 30;
export const RING_LOOP_FRAME_DELAY_MS = 67;
export const RING_LOOP_DURATION_MS = RING_LOOP_FRAME_COUNT * RING_LOOP_FRAME_DELAY_MS;
export const RING_LOOP_SPEED_BASELINE = 50;

export interface MirrorSettings {
  flipX: boolean;
  flipY: boolean;
}

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
  size: number;          // 1-100
  count: number;         // 1-12
  ringWidth: number;     // 1-100
  color: string;         // hex color
  secondaryColor: string;
  ringAnimationMode: RingAnimationMode;
  direction: RotationDirection;
}

export interface AvatarState {
  image: HTMLImageElement | null;
  effect: EffectType;
  shape: CropShape;
  mirror?: MirrorSettings;
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
  size: 60,
  count: 1,
  ringWidth: 58,
  color: '#00d4ff',
  secondaryColor: '#ff6b35',
  ringAnimationMode: 'rotate',
  direction: 'forward',
};

export const EFFECT_PRESETS: Record<EffectType, Partial<EffectParams>> = {
  lightning: { color: '#4dc9f6', secondaryColor: '#a855f7', density: 40, intensity: 60, speed: 35 },
  fire:      { color: '#ff5a1f', secondaryColor: '#ffd166', density: 72, intensity: 78, speed: 55 },
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
  spinner:   { color: '#4dc9f6', secondaryColor: '#a855f7', density: 30, intensity: 55, speed: 55 },
  matrix:    { color: '#22c55e', secondaryColor: '#16a34a', density: 60, intensity: 65, speed: 45 },
  bubble:    { color: '#67e8f9', secondaryColor: '#a5f3fc', density: 55, intensity: 55, speed: 40 },
  aurora:    { color: '#2dd4bf', secondaryColor: '#a78bfa', density: 58, intensity: 68, speed: 34 },
  firefly:   { color: '#fbbf24', secondaryColor: '#34d399', density: 55, intensity: 50, speed: 30 },
  rain:      { color: '#60a5fa', secondaryColor: '#dbeafe', density: 70, intensity: 64, speed: 58 },
  solidring: { color: '#00d4ff', secondaryColor: '#ff6b35', density: 50, intensity: 60, speed: 50, ringAnimationMode: 'rotate', direction: 'forward' },
  disc:      { color: '#00b0ff', secondaryColor: '#ff0040', density: 60, intensity: 55, speed: 50, ringAnimationMode: 'rotate', direction: 'forward' },
  googleone: { color: '#ea4335', secondaryColor: '#34a853', density: 50, intensity: 60, speed: 50, ringAnimationMode: 'rotate', direction: 'forward' },
  duotone:   { color: '#00d4ff', secondaryColor: '#ff6b35', density: 50, intensity: 58, speed: 50, ringAnimationMode: 'rotate', direction: 'forward' },
  blinkring: { color: '#00d4ff', secondaryColor: '#ff6b35', density: 50, intensity: 58, speed: 50, ringAnimationMode: 'rotate', direction: 'forward' },
  linxudo:   { color: '#000000', secondaryColor: '#ffffff', density: 50, intensity: 50, speed: 50, ringAnimationMode: 'rotate', direction: 'forward' },
  bounce:    { color: '#00d4ff', secondaryColor: '#ff6b35', density: 50, intensity: 50, speed: 50, size: 60, count: 1, ringAnimationMode: 'rotate', direction: 'forward' },
  collapsequad: { color: '#ea4335', secondaryColor: '#4285f4', density: 50, intensity: 62, speed: 50, ringWidth: 58, ringAnimationMode: 'rotate', direction: 'forward' },
  axisrings: { color: '#38bdf8', secondaryColor: '#f472b6', density: 50, intensity: 70, speed: 30, ringWidth: 46, ringAnimationMode: 'rotate', direction: 'forward' },
  neoncomet: { color: '#22d3ee', secondaryColor: '#f472b6', density: 55, intensity: 72, speed: 48, ringWidth: 42, ringAnimationMode: 'rotate', direction: 'forward' },
  equalizer: { color: '#34d399', secondaryColor: '#60a5fa', density: 64, intensity: 68, speed: 42, ringWidth: 50, ringAnimationMode: 'rotate', direction: 'forward' },
  magiccircle: { color: '#a78bfa', secondaryColor: '#fbbf24', density: 58, intensity: 70, speed: 36, ringWidth: 44, ringAnimationMode: 'rotate', direction: 'forward' },
  cyberhud: { color: '#22d3ee', secondaryColor: '#84cc16', density: 54, intensity: 66, speed: 44, ringWidth: 38, ringAnimationMode: 'rotate', direction: 'forward' },
  crtglitch: { color: '#06b6d4', secondaryColor: '#f43f5e', density: 48, intensity: 70, speed: 52, ringAnimationMode: 'rotate', direction: 'forward' },
  portal: { color: '#38bdf8', secondaryColor: '#a855f7', density: 62, intensity: 76, speed: 46, ringWidth: 48, ringAnimationMode: 'rotate', direction: 'forward' },
  kaleidoscope: { color: '#f97316', secondaryColor: '#06b6d4', density: 62, intensity: 64, speed: 34, ringAnimationMode: 'rotate', direction: 'forward' },
};
