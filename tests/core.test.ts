import { describe, it, expect } from 'vitest';
import { detectContextEmoji, autoAssignEmojis } from '../src/core/emoji-detector';
import { exportToSRT, exportToVTT, exportToGardenCut, exportToASS } from '../src/core/exporters';
import { KINETIC_PRESETS } from '../src/core/kinetic-styles';
import { SubtitleSegment } from '../src/types';
import { isNonNativeFormat } from '../src/core/ffmpeg-transcoder';
import { parseSRT, parseVTT, parseSubtitleTime } from '../src/core/subtitle-parsers';

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

  it('correctly identifies non-native video formats for FFmpeg Wasm handling', () => {
    expect(isNonNativeFormat('video_obs.mkv')).toBe(true);
    expect(isNonNativeFormat('gravacao_antiga.avi')).toBe(true);
    expect(isNonNativeFormat('stream.flv')).toBe(true);
    expect(isNonNativeFormat('camera.wmv')).toBe(true);
    expect(isNonNativeFormat('sony_cam.mts')).toBe(true);

    expect(isNonNativeFormat('video_web.mp4')).toBe(false);
    expect(isNonNativeFormat('video_safari.mov')).toBe(false);
    expect(isNonNativeFormat('clip.webm')).toBe(false);
    expect(isNonNativeFormat('audio.mp3')).toBe(false);
  });

  it('parses SRT files into word-level segments correctly', () => {
    const srtSample = `1
00:00:01,000 --> 00:00:03,000
Ganhar muito dinheiro online

2
00:00:03,500 --> 00:00:05,000
Ideia genial de negócio`;

    expect(parseSubtitleTime('00:01:23,500')).toBe(83.5);
    const parsed = parseSRT(srtSample);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].start).toBe(1);
    expect(parsed[0].end).toBe(3);
    expect(parsed[0].words).toHaveLength(4);
    expect(parsed[0].words[0].word).toBe('Ganhar');
    expect(parsed[0].emoji).toBe('💰');
  });

  it('parses WebVTT files correctly', () => {
    const vttSample = `WEBVTT

00:00:01.000 --> 00:00:02.500
Pegando fogo no estúdio`;

    const parsed = parseVTT(vttSample);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].words).toHaveLength(4);
    expect(parsed[0].emoji).toBe('🔥');
  });

  it('exports valid Advanced SubStation Alpha (.ass) format', () => {
    const ass = exportToASS(mockSegments, KINETIC_PRESETS['ali-abdaal']);
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('Plus Jakarta Sans');
    expect(ass).toContain('Dialogue: 0,0:00:01.00,0:00:02.50');
  });

  it('provides new kinetic presets Ali Abdaal and Karaoke Wave', () => {
    expect(KINETIC_PRESETS['ali-abdaal'].highlighter).toBe(true);
    expect(KINETIC_PRESETS['ali-abdaal'].rotation).toBe(-2);
    expect(KINETIC_PRESETS['karaoke-wave'].karaokeProgressive).toBe(true);
  });
});
