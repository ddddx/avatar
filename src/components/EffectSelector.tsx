import React from 'react';
import type { EffectType } from '../effects/types';

interface Props {
  selected: EffectType;
  onChange: (e: EffectType) => void;
}

type EffectCategory = 'ring' | 'energy' | 'motion' | 'tech';

const categories: { id: EffectCategory; label: string }[] = [
  { id: 'ring', label: '环类' },
  { id: 'energy', label: '能量' },
  { id: 'motion', label: '氛围' },
  { id: 'tech', label: '科技' },
];

const effectsByCategory: Record<EffectCategory, { type: EffectType; icon: string; label: string }[]> = {
  ring: [
    { type: 'solidring', icon: '⭕', label: '实心环' },
    { type: 'disc',      icon: '💿', label: '光盘' },
    { type: 'googleone', icon: '🌈', label: 'Google 环' },
    { type: 'duotone',   icon: '🔵', label: '双色环' },
    { type: 'blinkring', icon: '💠', label: '闪烁环' },
    { type: 'linxudo',   icon: '⚫', label: 'LinxuDo' },
    { type: 'bounce',    icon: '🏀', label: '弹跳头像' },
    { type: 'collapsequad', icon: '🔴', label: '收缩四色环' },
    { type: 'axisrings', icon: '◎', label: '双轴圆环' },
    { type: 'neoncomet', icon: '☄️', label: '霓虹彗星环' },
    { type: 'equalizer', icon: '▥', label: '频谱环' },
    { type: 'orbit',     icon: '💫', label: '环形粒子' },
    { type: 'spin',      icon: '🔄', label: '旋转' },
    { type: 'loader',    icon: '⏳', label: '加载中' },
    { type: 'spinner',   icon: '🌀', label: '等待圈' },
  ],
  energy: [
    { type: 'lightning', icon: '⚡', label: '闪电' },
    { type: 'fire',      icon: '🔥', label: '火焰' },
    { type: 'glow',      icon: '✨', label: '炫光' },
    { type: 'shield',    icon: '🔮', label: '能量护盾' },
    { type: 'frost',     icon: '❄️', label: '冰霜' },
    { type: 'prism',     icon: '💎', label: '棱镜光' },
    { type: 'gold',      icon: '✨', label: '金粉' },
    { type: 'aurora',    icon: '🌌', label: '极光' },
    { type: 'magiccircle', icon: '✦', label: '魔法阵' },
    { type: 'portal',    icon: '◎', label: '传送门' },
  ],
  motion: [
    { type: 'ripple',    icon: '🌊', label: '水波纹' },
    { type: 'petal',     icon: '🌸', label: '花瓣雨' },
    { type: 'stardust',  icon: '⭐', label: '星尘' },
    { type: 'vortex',    icon: '🌪️', label: '旋风' },
    { type: 'firework',  icon: '🎆', label: '烟花' },
    { type: 'bubble',    icon: '🫧', label: '气泡' },
    { type: 'firefly',   icon: '🪲', label: '萤火虫' },
    { type: 'rain',      icon: '🌧️', label: '雨' },
  ],
  tech: [
    { type: 'matrix',    icon: '🟢', label: '矩阵雨' },
    { type: 'cyberhud',  icon: '⌖', label: '赛博 HUD' },
    { type: 'crtglitch', icon: '▤', label: 'CRT 故障' },
    { type: 'kaleidoscope', icon: '◈', label: '万花筒' },
  ],
};

function getEffectCategory(effectType: EffectType): EffectCategory {
  return categories.find(({ id }) =>
    effectsByCategory[id].some((effect) => effect.type === effectType),
  )?.id ?? 'ring';
}

const EffectSelector: React.FC<Props> = ({ selected, onChange }) => {
  const selectedCategory = getEffectCategory(selected);
  const [view, setView] = React.useState({ category: selectedCategory, selected });
  const category = view.selected === selected ? view.category : selectedCategory;

  return (
    <>
      <div className="effect-tabs">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`effect-tab ${category === item.id ? 'active' : ''}`}
            onClick={() => setView({ category: item.id, selected })}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="effect-selector">
        {effectsByCategory[category].map((ef) => (
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
    </>
  );
};

export default EffectSelector;
