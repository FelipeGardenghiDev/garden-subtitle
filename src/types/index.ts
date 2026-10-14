export interface WordTimestamp {
  word: string;
  start: number; // segundos
  end: number;   // segundos
  confidence: number;
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
  fontSize: number;
  highlightColor: string;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  enableEmojis: boolean;
  maxWordsPerLine: number;
}
