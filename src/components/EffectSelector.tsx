import React from 'react';
import type { EffectType } from '../effects/types';

interface Props {
  selected: EffectType;
  onChange: (e: EffectType) => void;
}

const effects: { type: EffectType; icon: string; label: string }[] = [
  { type: 'lightning', icon: '⚡', label: '闪电' },
  { type: 'fire',      icon: '🔥', label: '火焰' },
  { type: 'glow',      icon: '✨', label: '炫光' },
  { type: 'orbit',     icon: '💫', label: '环形粒子' },
  { type: 'shield',    icon: '🔮', label: '能量护盾' },
  { type: 'frost',     icon: '❄️', label: '冰霜' },
  { type: 'ripple',    icon: '🌊', label: '水波纹' },
  { type: 'petal',     icon: '🌸', label: '花瓣雨' },
  { type: 'stardust',  icon: '⭐', label: '星尘' },
  { type: 'prism',     icon: '💎', label: '棱镜光' },
  { type: 'vortex',    icon: '🌪️', label: '旋风' },
  { type: 'firework',  icon: '🎆', label: '烟花' },
  { type: 'gold',      icon: '✨', label: '金粉' },
  { type: 'spin',      icon: '🔄', label: '旋转' },
  { type: 'loader',    icon: '⏳', label: '加载中' },
  { type: 'matrix',    icon: '🟢', label: '矩阵雨' },
  { type: 'bubble',    icon: '🫧', label: '气泡' },
  { type: 'aurora',    icon: '🌌', label: '极光' },
  { type: 'firefly',   icon: '🪲', label: '萤火虫' },
  { type: 'rain',      icon: '🌧️', label: '雨' },
  { type: 'ring',      icon: '💍', label: '光环' },
];

const EffectSelector: React.FC<Props> = ({ selected, onChange }) => {
  return (
    <div className="effect-selector">
      {effects.map((ef) => (
        <button
          key={ef.type}
          className={`effect-btn ${selected === ef.type ? 'active' : ''}`}
          onClick={() => onChange(ef.type)}
        >
          <span className="effect-icon">{ef.icon}</span>
          <span className="effect-label">{ef.label}</span>
        </button>
      ))}
    </div>
  );
};

export default EffectSelector;
