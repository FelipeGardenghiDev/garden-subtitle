import { describe, it, expect } from 'vitest';
import { detectContextEmoji, autoAssignEmojis } from '../src/core/emoji-detector';
import { exportToSRT, exportToVTT, exportToGardenCut, exportToASS } from '../src/core/exporters';
import { KINETIC_PRESETS } from '../src/core/kinetic-styles';
import { SubtitleSegment } from '../src/types';
import { isNonNativeFormat } from '../src/core/ffmpeg-transcoder';
import { parseSRT, parseVTT, parseSubtitleTime } from '../src/core/subtitle-parsers';
import { exportToFCPXML, exportToPremiereProject, exportToAfterEffectsScript } from '../src/core/nle-exporters';

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

  it('exports valid Advanced SubStation Alpha (.ass) format with word-level {\\k} tags and BGR colors', async () => {
    const { hexToASSColor } = await import('../src/core/exporters');
    expect(hexToASSColor('#fde047')).toBe('&H0047E0FD');

    const ass = exportToASS(mockSegments, KINETIC_PRESETS['ali-abdaal']);
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('Plus Jakarta Sans');
    expect(ass).toContain('Dialogue: 0,0:00:01.00,0:00:02.50');
    expect(ass).toContain('{\\k50}Muito {\\k50}dinheiro');
  });

  it('provides new kinetic presets Ali Abdaal and Karaoke Wave', () => {
    expect(KINETIC_PRESETS['ali-abdaal'].highlighter).toBe(true);
    expect(KINETIC_PRESETS['ali-abdaal'].rotation).toBe(-2);
    expect(KINETIC_PRESETS['karaoke-wave'].karaokeProgressive).toBe(true);
  });

  it('exports valid Final Cut Pro 7 XML (.xml) for DaVinci Resolve, Vegas and Premiere', () => {
    const xml = exportToFCPXML(mockSegments, KINETIC_PRESETS.hormozi, 'video.mp4', 5.0);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<xmeml version="4">');
    expect(xml).toContain('<generatoritem id="text-clip-1">');
    expect(xml).toContain('Muito dinheiro e vendas');
  });

  it('exports valid Premiere Pro Project (.prproj) Gzipped Blob', async () => {
    const prprojBlob = await exportToPremiereProject(mockSegments, KINETIC_PRESETS.hormozi, 'video.mp4', 5.0);
    expect(prprojBlob).toBeInstanceOf(Blob);
    expect(prprojBlob.size).toBeGreaterThan(50);
  });

  it('exports valid After Effects ExtendScript (.jsx)', () => {
    const jsx = exportToAfterEffectsScript(mockSegments, KINETIC_PRESETS.mrbeast, 'video.mp4', 5.0);
    expect(jsx).toContain('app.beginUndoGroup');
    expect(jsx).toContain('app.project.items.addComp');
    expect(jsx).toContain('myComp.layers.addText');
    expect(jsx).toContain('scaleProp.setValueAtTime');
  });

  it('manages undo and redo stacks correctly with HistoryManager', async () => {
    const { HistoryManager } = await import('../src/core/history-manager');
    const history = new HistoryManager<string>('initial', 5);

    expect(history.state).toBe('initial');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);

    history.push('step-1');
    expect(history.state).toBe('step-1');
    expect(history.canUndo).toBe(true);

    history.push('step-2');
    expect(history.state).toBe('step-2');

    // Test Undo
    const undone = history.undo();
    expect(undone).toBe('step-1');
    expect(history.state).toBe('step-1');
    expect(history.canRedo).toBe(true);

    // Test Redo
    const redone = history.redo();
    expect(redone).toBe('step-2');
    expect(history.state).toBe('step-2');
    expect(history.canRedo).toBe(false);

    // Test pushing new state clears redo future
    history.undo();
    expect(history.canRedo).toBe(true);
    history.push('step-3');
    expect(history.canRedo).toBe(false);
    expect(history.state).toBe('step-3');
  });

  it('paginates long segments across multiple word pages based on currentTime and maxWordsPerLine', async () => {
    const { getActiveWordPage } = await import('../src/core/canvas-renderer');
    const longWords = [
      { id: 'w1', word: 'Um', start: 0.0, end: 0.5 },
      { id: 'w2', word: 'dois', start: 0.5, end: 1.0 },
      { id: 'w3', word: 'três', start: 1.0, end: 1.5 },
      { id: 'w4', word: 'quatro', start: 1.5, end: 2.0 },
      { id: 'w5', word: 'cinco', start: 2.0, end: 2.5 },
      { id: 'w6', word: 'seis', start: 2.5, end: 3.0 },
      { id: 'w7', word: 'sete', start: 3.0, end: 3.5 }
    ];

    const page1 = getActiveWordPage(longWords, 0.7, 3);
    expect(page1.map(w => w.word)).toEqual(['Um', 'dois', 'três']);

    const page2 = getActiveWordPage(longWords, 2.1, 3);
    expect(page2.map(w => w.word)).toEqual(['quatro', 'cinco', 'seis']);

    const page3 = getActiveWordPage(longWords, 3.2, 3);
    expect(page3.map(w => w.word)).toEqual(['sete']);
  });

  it('computes normalized waveform peaks and synthetic speech waveforms accurately', async () => {
    const { computeWaveformPeaks, generateSyntheticWaveform } = await import('../src/core/audio-waveform');

    const pcm = new Float32Array(1600);
    for (let i = 0; i < pcm.length; i++) {
      pcm[i] = i < 800 ? 0.8 * Math.sin(i * 0.1) : 0.02;
    }

    const peaks = computeWaveformPeaks(pcm, 10);
    expect(peaks).toHaveLength(10);
    expect(peaks[0]).toBeGreaterThan(peaks[9]);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(1.0);
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(0.06);

    const synthetic = generateSyntheticWaveform(mockSegments, 5.0, 20);
    expect(synthetic).toHaveLength(20);
    // Bucket at t=1.25s (index 5) is inside seg-1 and should be higher than silence at t=0.1s (index 0)
    expect(synthetic[5]).toBeGreaterThan(synthetic[0]);
  });

  it('converts Whisper word-level chunks into timed SubtitleSegments with pause and punctuation detection', async () => {
    const { convertWhisperChunksToSegments } = await import('../src/core/speech-transcriber');
    const chunks = [
      { text: 'Ganhar', timestamp: [0.0, 0.4] as [number, number] },
      { text: 'muito', timestamp: [0.4, 0.8] as [number, number] },
      { text: 'dinheiro!', timestamp: [0.8, 1.3] as [number, number] },
      { text: 'Nova', timestamp: [2.2, 2.5] as [number, number] },
      { text: 'ideia', timestamp: [2.5, 3.0] as [number, number] }
    ];

    const segs = convertWhisperChunksToSegments(chunks, 4);
    expect(segs).toHaveLength(2);
    expect(segs[0].text).toBe('Ganhar muito dinheiro!');
    expect(segs[0].emoji).toBe('💰');
    expect(segs[0].words).toHaveLength(3);
    expect(segs[1].text).toBe('Nova ideia');
    expect(segs[1].emoji).toBe('💡');
  });
});

