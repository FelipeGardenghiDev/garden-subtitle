import { SubtitleSegment, WordTimestamp } from '../types';
import { detectContextEmoji } from './emoji-detector';

/**
 * Converte timestamp de legenda (00:01:23,456 ou 00:01:23.456 ou 01:23.456) para segundos numéricos
 */
export function parseSubtitleTime(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');

  if (parts.length === 3) {
    const hrs = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hrs * 3600 + mins * 60 + secs;
  } else if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(clean) || 0;
}

/**
 * Divide uma frase em palavras com timestamps proporcionais dentro da duração do segmento
 */
export function createWordTimestamps(
  text: string,
  segmentStart: number,
  segmentEnd: number,
  segmentId: string
): WordTimestamp[] {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const totalDuration = Math.max(0.1, segmentEnd - segmentStart);
  const wordDuration = totalDuration / rawWords.length;

  return rawWords.map((word, index) => {
    const start = parseFloat((segmentStart + index * wordDuration).toFixed(2));
    const end = parseFloat((segmentStart + (index + 1) * wordDuration).toFixed(2));
    return {
      id: `${segmentId}_w${index + 1}`,
      word,
      start,
      end,
      confidence: 1.0
    };
  });
}

/**
 * Parser para arquivos SubRip (.SRT)
 */
export function parseSRT(srtContent: string): SubtitleSegment[] {
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/).filter(b => b.trim().length > 0);
  const segments: SubtitleSegment[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // Linha de tempo é a primeira ou a segunda (quando há número do índice antes)
    let timeLineIndex = 0;
    if (/^\d+$/.test(lines[0]) && lines.length >= 3) {
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split('-->');
    const start = parseSubtitleTime(startStr);
    const end = parseSubtitleTime(endStr);

    const textLines = lines.slice(timeLineIndex + 1);
    const rawText = textLines.join(' ').replace(/<[^>]*>/g, '').trim();

    if (!rawText) continue;

    const segId = `seg_srt_${i + 1}`;
    const words = createWordTimestamps(rawText, start, end, segId);
    const emoji = detectContextEmoji(rawText);

    segments.push({
      id: segId,
      start,
      end,
      text: rawText,
      words,
      emoji: emoji || undefined
    });
  }

  return segments;
}

/**
 * Parser para arquivos WebVTT (.VTT)
 */
export function parseVTT(vttContent: string): SubtitleSegment[] {
  const normalized = vttContent
    .replace(/^WEBVTT[^\n]*\n/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const blocks = normalized.split(/\n\s*\n/).filter(b => b.trim().length > 0);
  const segments: SubtitleSegment[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIndex = -1;
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].includes('-->')) {
        timeLineIndex = j;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const [startStr, endStr] = timeLine.split('-->');
    const start = parseSubtitleTime(startStr.trim().split(' ')[0]);
    const end = parseSubtitleTime(endStr.trim().split(' ')[0]);

    const textLines = lines.slice(timeLineIndex + 1);
    const rawText = textLines.join(' ').replace(/<[^>]*>/g, '').trim();

    if (!rawText) continue;

    const segId = `seg_vtt_${i + 1}`;
    const words = createWordTimestamps(rawText, start, end, segId);
    const emoji = detectContextEmoji(rawText);

    segments.push({
      id: segId,
      start,
      end,
      text: rawText,
      words,
      emoji: emoji || undefined
    });
  }

  return segments;
}

/**
 * Parser para projetos nativos GardenCut (.garden-sub)
 */
export function parseGardenSub(jsonContent: string): SubtitleSegment[] {
  try {
    const data = JSON.parse(jsonContent);
    const segments: SubtitleSegment[] = [];

    if (data.tracks && Array.isArray(data.tracks)) {
      for (const track of data.tracks) {
        if (track.clips && Array.isArray(track.clips)) {
          for (let i = 0; i < track.clips.length; i++) {
            const clip = track.clips[i];
            const start = clip.start || 0;
            const end = start + (clip.duration || 2);
            const text = (clip.content || clip.name || '').trim();
            if (!text) continue;

            const segId = clip.id || `seg_gc_${i + 1}`;
            const words = createWordTimestamps(text, start, end, segId);
            const emoji = detectContextEmoji(text);

            segments.push({
              id: segId,
              start,
              end,
              text,
              words,
              emoji: emoji || undefined
            });
          }
        }
      }
    }
    return segments;
  } catch (err) {
    console.error('Falha ao decodificar JSON .garden-sub:', err);
    return [];
  }
}

/**
 * Identifica o formato da legenda e faz o parsing correspondente
 */
export function parseSubtitleFile(fileName: string, content: string): SubtitleSegment[] {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (ext === 'srt') {
    return parseSRT(content);
  } else if (ext === 'vtt') {
    return parseVTT(content);
  } else if (ext === 'garden-sub' || ext === 'json') {
    return parseGardenSub(content);
  }

  // Tenta heurística de conteúdo
  if (content.includes('WEBVTT')) {
    return parseVTT(content);
  } else if (content.trim().startsWith('{')) {
    return parseGardenSub(content);
  } else {
    return parseSRT(content);
  }
}
