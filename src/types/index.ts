export interface WordTimestamp {
  id: string;
  word: string;
  start: number; // em segundos (ex: 1.25)
  end: number;   // em segundos (ex: 1.65)
  confidence?: number;
}

export interface SubtitleSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
  emoji?: string;
}

export type KineticStyle = 'hormozi' | 'mrbeast' | 'tiktok-glow' | 'minimal-clean';

export interface KineticConfig {
  style: KineticStyle;
  fontSize: number;           // ex: 48
  highlightColor: string;     // cor da palavra ativa (ex: #fde047 amarelo Hormozi ou #22c55e verde MrBeast)
  textColor: string;          // cor das palavras inativas (ex: #ffffff)
  strokeColor: string;        // cor do contorno (ex: #000000)
  strokeWidth: number;        // largura do contorno (ex: 4)
  backgroundColor?: string;   // fundo da palavra ou do bloco (ex: rgba(0,0,0,0.6) ou #000000)
  enableEmojis: boolean;      // habilitar emojis animados automáticos
  maxWordsPerLine: number;    // máximo de palavras visíveis por bloco (ex: 3 a 5)
  positionY: number;          // porcentagem da altura vertical (ex: 75% da tela)
  animationScale: number;     // escala de zoom na palavra ativa (ex: 1.2x)
  glowColor?: string;         // cor de neon (para tiktok-glow)
}

export interface VideoDimensions {
  width: number;
  height: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
}

export interface GardenCutTextClip {
  id: string;
  trackId: string;
  type: 'text';
  name: string;
  start: number;
  duration: number;
  content: string;
  style: {
    fontFamily: string;
    fontSize: number;
    color: string;
    backgroundColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  };
}

export interface GardenCutProjectImport {
  version: string;
  generator: 'Garden Subtitle';
  exportedAt: string;
  totalDuration: number;
  tracks: Array<{
    id: string;
    name: string;
    type: 'text';
    clips: GardenCutTextClip[];
  }>;
}
