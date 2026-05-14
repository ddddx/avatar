import React from 'react';
import type { EffectParams, EffectType, RotationDirection } from '../effects/types';

interface Props {
  effect: EffectType;
  params: EffectParams;
  onChange: (p: EffectParams) => void;
}

const DIRECTION_EFFECTS = new Set<EffectType>(['solidring', 'disc', 'googleone', 'duotone']);

const EffectControls: React.FC<Props> = ({ effect, params, onChange }) => {
  const set = (key: keyof EffectParams, val: number | string) => {
    onChange({ ...params, [key]: val });
  };

  return (
    <div className="effect-controls">
      <div className="control-row">
        <label>粒子密度</label>
        <input
          type="range" min={1} max={100} value={params.density}
          onChange={(e) => set('density', +e.target.value)}
        />
        <span className="val">{params.density}</span>
      </div>
      <div className="control-row">
        <label>特效强度</label>
        <input
          type="range" min={1} max={100} value={params.intensity}
          onChange={(e) => set('intensity', +e.target.value)}
        />
        <span className="val">{params.intensity}</span>
      </div>
      <div className="control-row">
        <label>动画速度</label>
        <input
          type="range" min={1} max={100} value={params.speed}
          onChange={(e) => set('speed', +e.target.value)}
        />
        <span className="val">{params.speed}</span>
      </div>
      <div className="control-row colors">
        <label>主色</label>
        <input
          type="color" value={params.color}
          onChange={(e) => set('color', e.target.value)}
        />
        <label>副色</label>
        <input
          type="color" value={params.secondaryColor}
          onChange={(e) => set('secondaryColor', e.target.value)}
        />
      </div>
      {DIRECTION_EFFECTS.has(effect) && (
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
