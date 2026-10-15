import { describe, it, expect } from 'vitest';
import { detectContextEmoji, autoAssignEmojis } from '../src/core/emoji-detector';
import { exportToSRT, exportToVTT, exportToGardenCut } from '../src/core/exporters';
import { KINETIC_PRESETS } from '../src/core/kinetic-styles';
import { SubtitleSegment } from '../src/types';

describe('Garden Subtitle Core Engines', () => {
  const mockSegments: SubtitleSegment[] = [
    {
      id: 'seg-1',
      start: 1.0,
      end: 2.5,
      text: 'Muito dinheiro e vendas',
      words: [
        { id: 'w1', word: 'Muito', start: 1.0, end: 1.5 },
        { id: 'w2', word: 'dinheiro', start: 1.5, end: 2.0 },
        { id: 'w3', word: 'e', start: 2.0, end: 2.2 },
        { id: 'w4', word: 'vendas', start: 2.2, end: 2.5 }
      ]
    },
    {
      id: 'seg-2',
      start: 2.6,
      end: 4.0,
      text: 'Ideia com fogo no olhar',
      words: [
        { id: 'w5', word: 'Ideia', start: 2.6, end: 3.0 },
        { id: 'w6', word: 'com', start: 3.0, end: 3.3 },
        { id: 'w7', word: 'fogo', start: 3.3, end: 3.7 },
        { id: 'w8', word: 'no', start: 3.7, end: 3.8 },
        { id: 'w9', word: 'olhar', start: 3.8, end: 4.0 }
      ]
    }
  ];

  it('detects context emojis from keywords', () => {
    expect(detectContextEmoji('Vamos ganhar muito dinheiro')).toBe('💰');
    expect(detectContextEmoji('O conteúdo está pegando fogo')).toBe('🔥');
    expect(detectContextEmoji('Tive uma ideia genial')).toBe('💡');
    expect(detectContextEmoji('Crescimento como um foguete')).toBe('🚀');
  });

  it('assigns emojis automatically across segments', () => {
    const enriched = autoAssignEmojis(mockSegments);
    expect(enriched[0].emoji).toBe('💰');
    expect(enriched[1].emoji).toBe('💡');
  });

  it('exports valid standard SRT subtitle text', () => {
    const srt = exportToSRT(mockSegments);
    expect(srt).toContain('1\n00:00:01,000 --> 00:00:02,500');
    expect(srt).toContain('Muito dinheiro e vendas');
    expect(srt).toContain('2\n00:00:02,600 --> 00:00:04,000');
  });

  it('exports valid WebVTT format', () => {
    const vtt = exportToVTT(mockSegments);
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:01.000 --> 00:00:02.500');
  });

  it('exports valid .garden-sub project for GardenCut', () => {
    const gardenCutProject = exportToGardenCut(mockSegments, KINETIC_PRESETS.hormozi, 10);
    expect(gardenCutProject.version).toBe('1.0.0');
    expect(gardenCutProject.generator).toBe('Garden Subtitle');
    expect(gardenCutProject.tracks[0].clips).toHaveLength(2);
    expect(gardenCutProject.tracks[0].clips[0].style.color).toBe(KINETIC_PRESETS.hormozi.highlightColor);
  });
});
