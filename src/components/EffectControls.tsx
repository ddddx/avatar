import React from 'react';
import type { EffectParams, EffectType, RingAnimationMode, RotationDirection } from '../effects/types';

interface Props {
  effect: EffectType;
  params: EffectParams;
  onChange: (p: EffectParams) => void;
}

const DIRECTION_EFFECTS = new Set<EffectType>([
  'solidring', 'disc', 'googleone', 'duotone', 'linxudo', 'collapsequad', 'axisrings',
  'neoncomet', 'equalizer', 'magiccircle', 'cyberhud', 'portal', 'kaleidoscope',
]);
const RING_EFFECTS = new Set<EffectType>(['solidring', 'disc', 'googleone', 'duotone', 'blinkring', 'linxudo', 'collapsequad']);
const COLOR_EFFECTS = new Set<EffectType>([
  'lightning', 'fire', 'glow', 'orbit', 'shield', 'frost', 'ripple', 'petal', 'stardust',
  'vortex', 'firework', 'gold', 'spin', 'loader', 'spinner', 'matrix', 'bubble', 'aurora', 'firefly',
  'rain', 'duotone', 'blinkring', 'axisrings', 'neoncomet', 'equalizer',
  'magiccircle', 'cyberhud', 'crtglitch', 'portal', 'kaleidoscope',
]);
const DENSITY_EFFECTS = new Set<EffectType>([
  'lightning', 'fire', 'glow', 'orbit', 'shield', 'frost', 'ripple', 'petal', 'stardust', 'prism',
  'vortex', 'firework', 'gold', 'spin', 'loader', 'matrix', 'bubble', 'aurora', 'firefly',
  'rain', 'duotone', 'neoncomet', 'equalizer', 'magiccircle', 'cyberhud', 'crtglitch',
  'portal', 'kaleidoscope',
]);
const INTENSITY_EFFECTS = new Set<EffectType>([
  'lightning', 'fire', 'glow', 'orbit', 'shield', 'frost', 'ripple', 'petal', 'stardust', 'prism',
  'vortex', 'firework', 'gold', 'spin', 'loader', 'spinner', 'matrix', 'bubble', 'aurora', 'firefly',
  'rain', 'solidring', 'disc', 'googleone', 'duotone', 'blinkring', 'neoncomet', 'equalizer',
  'magiccircle', 'cyberhud', 'crtglitch', 'portal', 'kaleidoscope',
]);
const SIZE_EFFECTS = new Set<EffectType>(['bounce']);
const COUNT_EFFECTS = new Set<EffectType>(['bounce']);
const RING_WIDTH_EFFECTS = new Set<EffectType>([
  'collapsequad', 'axisrings', 'neoncomet', 'equalizer', 'magiccircle', 'cyberhud', 'portal',
]);

const EffectControls: React.FC<Props> = ({ effect, params, onChange }) => {
  const set = (key: keyof EffectParams, val: number | string) => {
    onChange({ ...params, [key]: val });
  };

  return (
    <div className="effect-controls">
      {DENSITY_EFFECTS.has(effect) && (
        <div className="control-row">
          <label>粒子密度</label>
          <input
            type="range" min={1} max={100} value={params.density}
            onChange={(e) => set('density', +e.target.value)}
          />
          <span className="val">{params.density}</span>
        </div>
      )}
      {INTENSITY_EFFECTS.has(effect) && (
        <div className="control-row">
          <label>特效强度</label>
          <input
            type="range" min={1} max={100} value={params.intensity}
            onChange={(e) => set('intensity', +e.target.value)}
          />
          <span className="val">{params.intensity}</span>
        </div>
      )}
      <div className="control-row">
        <label>动画速度</label>
        <input
          type="range" min={1} max={100} value={params.speed}
          onChange={(e) => set('speed', +e.target.value)}
        />
        <span className="val">{params.speed}</span>
      </div>
      {RING_WIDTH_EFFECTS.has(effect) && (
        <div className="control-row">
          <label>环宽</label>
          <input
            type="range" min={1} max={100} value={params.ringWidth}
            onChange={(e) => set('ringWidth', +e.target.value)}
          />
          <span className="val">{params.ringWidth}</span>
        </div>
      )}
      {SIZE_EFFECTS.has(effect) && (
        <div className="control-row">
          <label>头像尺寸</label>
          <input
            type="range" min={1} max={100} value={params.size}
            onChange={(e) => set('size', +e.target.value)}
          />
          <span className="val">{params.size}%</span>
        </div>
      )}
      {COUNT_EFFECTS.has(effect) && (
        <div className="control-row">
          <label>球数量</label>
          <input
            type="range" min={1} max={12} value={params.count}
            onChange={(e) => set('count', +e.target.value)}
          />
          <span className="val">{params.count}</span>
        </div>
      )}
      {COLOR_EFFECTS.has(effect) && (
        <div className="control-row colors">
          <label>{effect === 'axisrings' ? '外环' : '主色'}</label>
          <input
            type="color" value={params.color}
            onChange={(e) => set('color', e.target.value)}
          />
          <label>{effect === 'axisrings' ? '内环' : '副色'}</label>
          <input
            type="color" value={params.secondaryColor}
            onChange={(e) => set('secondaryColor', e.target.value)}
          />
        </div>
      )}
      {RING_EFFECTS.has(effect) && (
        <div className="control-row direction-row">
          <label>动画模式</label>
          <div className="direction-toggle">
            <button
              type="button"
              className={`direction-btn ${params.ringAnimationMode === 'rotate' ? 'active' : ''}`}
              onClick={() => set('ringAnimationMode', 'rotate' as RingAnimationMode)}
            >
              旋转
            </button>
            <button
              type="button"
              className={`direction-btn ${params.ringAnimationMode === 'breathe' ? 'active' : ''}`}
              onClick={() => set('ringAnimationMode', 'breathe' as RingAnimationMode)}
            >
              呼吸灯
            </button>
          </div>
          <span className="val">{params.ringAnimationMode === 'rotate' ? '环形旋转' : '明暗呼吸'}</span>
        </div>
      )}
      {params.ringAnimationMode === 'rotate' && DIRECTION_EFFECTS.has(effect) && (
        <div className="control-row direction-row">
          <label>旋转方向</label>
          <div className="direction-toggle">
            <button
              type="button"
              className={`direction-btn ${params.direction === 'forward' ? 'active' : ''}`}
              onClick={() => set('direction', 'forward' as RotationDirection)}
            >
              正转
            </button>
            <button
              type="button"
              className={`direction-btn ${params.direction === 'reverse' ? 'active' : ''}`}
              onClick={() => set('direction', 'reverse' as RotationDirection)}
            >
              反转
            </button>
          </div>
          <span className="val">{params.direction === 'forward' ? '顺时针' : '逆时针'}</span>
        </div>
      )}
    </div>
  );
};

export default EffectControls;
