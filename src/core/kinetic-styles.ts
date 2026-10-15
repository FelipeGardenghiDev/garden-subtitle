import { KineticConfig, KineticStyle } from '../types';

export const KINETIC_PRESETS: Record<KineticStyle, KineticConfig> = {
  hormozi: {
    style: 'hormozi',
    fontSize: 48,
    highlightColor: '#fde047', // Amarelo Canário Hormozi
    textColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 5,
    backgroundColor: '#000000',
    enableEmojis: true,
    maxWordsPerLine: 4,
    positionY: 75,
    animationScale: 1.2
  },
  mrbeast: {
    style: 'mrbeast',
    fontSize: 52,
    highlightColor: '#22c55e', // Verde Limão MrBeast
    textColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 6,
    enableEmojis: true,
    maxWordsPerLine: 3,
    positionY: 72,
    animationScale: 1.28
  },
  'tiktok-glow': {
    style: 'tiktok-glow',
    fontSize: 44,
    highlightColor: '#06b6d4', // Ciano Neon Glow
    textColor: '#ffffff',
    strokeColor: '#0f172a',
    strokeWidth: 3,
    enableEmojis: true,
    maxWordsPerLine: 3,
    positionY: 78,
    animationScale: 1.15,
    glowColor: 'rgba(6, 182, 212, 0.8)'
  },
  'minimal-clean': {
    style: 'minimal-clean',
    fontSize: 38,
    highlightColor: '#38bdf8', // Azul Suave
    textColor: '#f8fafc',
    strokeColor: '#020617',
    strokeWidth: 2,
    enableEmojis: false,
    maxWordsPerLine: 5,
    positionY: 82,
    animationScale: 1.08
  }
};
