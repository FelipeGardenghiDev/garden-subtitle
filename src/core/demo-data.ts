import { SubtitleSegment } from '../types';

export const DEMO_SUBTITLE_SEGMENTS: SubtitleSegment[] = [
  {
    id: 'seg-1',
    start: 0.2,
    end: 2.1,
    text: 'O segredo para vídeos virais',
    emoji: '🔥',
    words: [
      { id: 'w1', word: 'O', start: 0.2, end: 0.4 },
      { id: 'w2', word: 'segredo', start: 0.4, end: 1.0 },
      { id: 'w3', word: 'para', start: 1.0, end: 1.3 },
      { id: 'w4', word: 'vídeos', start: 1.3, end: 1.7 },
      { id: 'w5', word: 'virais', start: 1.7, end: 2.1 }
    ]
  },
  {
    id: 'seg-2',
    start: 2.2,
    end: 4.3,
    text: 'É prender a atenção rápido',
    emoji: '⚡',
    words: [
      { id: 'w6', word: 'É', start: 2.2, end: 2.4 },
      { id: 'w7', word: 'prender', start: 2.4, end: 2.9 },
      { id: 'w8', word: 'a', start: 2.9, end: 3.1 },
      { id: 'w9', word: 'atenção', start: 3.1, end: 3.7 },
      { id: 'w10', word: 'rápido', start: 3.7, end: 4.3 }
    ]
  },
  {
    id: 'seg-3',
    start: 4.4,
    end: 6.5,
    text: 'Legendas com dinamismo e foco',
    emoji: '🎯',
    words: [
      { id: 'w11', word: 'Legendas', start: 4.4, end: 4.9 },
      { id: 'w12', word: 'com', start: 4.9, end: 5.2 },
      { id: 'w13', word: 'dinamismo', start: 5.2, end: 5.9 },
      { id: 'w14', word: 'e', start: 5.9, end: 6.1 },
      { id: 'w15', word: 'foco', start: 6.1, end: 6.5 }
    ]
  },
  {
    id: 'seg-4',
    start: 6.6,
    end: 8.8,
    text: 'Fazem seu engajamento explodir',
    emoji: '🚀',
    words: [
      { id: 'w16', word: 'Fazem', start: 6.6, end: 7.0 },
      { id: 'w17', word: 'seu', start: 7.0, end: 7.3 },
      { id: 'w18', word: 'engajamento', start: 7.3, end: 8.1 },
      { id: 'w19', word: 'explodir', start: 8.1, end: 8.8 }
    ]
  },
  {
    id: 'seg-5',
    start: 8.9,
    end: 11.2,
    text: 'E geram muito mais dinheiro!',
    emoji: '💰',
    words: [
      { id: 'w20', word: 'E', start: 8.9, end: 9.2 },
      { id: 'w21', word: 'geram', start: 9.2, end: 9.7 },
      { id: 'w22', word: 'muito', start: 9.7, end: 10.2 },
      { id: 'w23', word: 'mais', start: 10.2, end: 10.6 },
      { id: 'w24', word: 'dinheiro!', start: 10.6, end: 11.2 }
    ]
  }
];

/**
 * Converte um texto colado pelo usuário em segmentos automáticos com timestamps estimados
 */
export function generateSegmentsFromText(rawText: string, wordsPerSegment = 4): SubtitleSegment[] {
  const words = rawText.trim().split(/\s+/).filter(Boolean);
  const segments: SubtitleSegment[] = [];

  let currentTime = 0.5;
  const avgWordDuration = 0.35; // ~350ms por palavra

  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const chunkWords = words.slice(i, i + wordsPerSegment);
    const segStart = currentTime;
    
    const wordTimestamps = chunkWords.map((w, idx) => {
      const wStart = currentTime;
      const wEnd = wStart + avgWordDuration;
      currentTime = wEnd + 0.05;
      return {
        id: `w_${i + idx}_${Date.now()}`,
        word: w,
        start: Number(wStart.toFixed(2)),
        end: Number(wEnd.toFixed(2))
      };
    });

    const segEnd = wordTimestamps[wordTimestamps.length - 1].end;

    segments.push({
      id: `seg_${i / wordsPerSegment}_${Date.now()}`,
      start: Number(segStart.toFixed(2)),
      end: Number(segEnd.toFixed(2)),
      text: chunkWords.join(' '),
      words: wordTimestamps
    });

    currentTime += 0.3; // Pausa entre segmentos
  }

  return segments;
}
