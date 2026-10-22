import { SubtitleSegment, WordTimestamp, WhisperModelSize, WhisperLanguage, WhisperTranscriptionOptions } from '../types';
import { createWordTimestamps } from './subtitle-parsers';
import { detectContextEmoji } from './emoji-detector';
import { extractMonoAudio16kHz } from './audio-waveform';

// Declarar SpeechRecognition para TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface WhisperWordChunk {
  text: string;
  timestamp: [number, number | null];
}

export const WHISPER_MODEL_HUB_MAP: Record<WhisperModelSize, string> = {
  tiny: 'Xenova/whisper-tiny',
  base: 'Xenova/whisper-base',
  small: 'Xenova/whisper-small',
};

export function getWhisperModelIdentifier(model: WhisperModelSize): string {
  return WHISPER_MODEL_HUB_MAP[model] || WHISPER_MODEL_HUB_MAP.tiny;
}

export function getWhisperLanguageParam(lang: WhisperLanguage): string | undefined {
  if (lang === 'auto') return undefined;
  return lang;
}

// Cache singleton dos pipelines Whisper Wasm para evitar recarregamento
const whisperPipelines: Partial<Record<WhisperModelSize, Promise<any>>> = {};

/**
 * Verifica se a API de Reconhecimento de Voz nativa do navegador está disponível
 */
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

/**
 * Converte chunks de palavras do Whisper (word-level timestamps) em SubtitleSegments
 * agrupados por limite de palavras por bloco, pontuação final ou pausas de voz (> 0.65s).
 */
export function convertWhisperChunksToSegments(
  chunks: WhisperWordChunk[],
  maxWordsPerSegment = 4
): SubtitleSegment[] {
  if (!chunks || chunks.length === 0) return [];

  const limit = Math.max(1, maxWordsPerSegment || 4);
  const segments: SubtitleSegment[] = [];
  let currentWords: WordTimestamp[] = [];

  const flushSegment = () => {
    if (currentWords.length === 0) return;
    const segIndex = segments.length + 1;
    const segId = `seg_whisper_${segIndex}`;
    const start = currentWords[0].start;
    const end = currentWords[currentWords.length - 1].end;
    const text = currentWords.map(w => w.word).join(' ');
    const normalizedWords = currentWords.map((w, idx) => ({
      ...w,
      id: `${segId}_w_${idx}`
    }));

    segments.push({
      id: segId,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      text,
      words: normalizedWords,
      emoji: detectContextEmoji(text) || undefined
    });
    currentWords = [];
  };

  for (let i = 0; i < chunks.length; i++) {
    const rawWord = (chunks[i].text || '').trim();
    if (!rawWord) continue;

    const rawStart = chunks[i].timestamp?.[0] ?? (currentWords.length > 0 ? currentWords[currentWords.length - 1].end : 0);
    const rawEnd = chunks[i].timestamp?.[1] ?? (rawStart + 0.35);
    const start = Math.max(0, Number(rawStart));
    const end = Math.max(start + 0.1, Number(rawEnd));

    // Se houver uma pausa longa (> 0.65s) desde a palavra anterior, fecha o segmento atual
    if (currentWords.length > 0) {
      const prevEnd = currentWords[currentWords.length - 1].end;
      if (start - prevEnd > 0.65) {
        flushSegment();
      }
    }

    currentWords.push({
      id: `tmp_w_${i}`,
      word: rawWord,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2))
    });

    const endsWithPunctuation = /[.!?]$/.test(rawWord);
    if (currentWords.length >= limit || endsWithPunctuation) {
      flushSegment();
    }
  }

  flushSegment();
  return segments;
}

/**
 * Transcreve mídia 100% no navegador usando Whisper WebAssembly / ONNX Runtime Web
 * com extração acústica em 16kHz via Web Audio API e alinhamento palavra por palavra.
 */
export async function transcribeWithWhisperWasm(
  mediaSrc: string,
  onProgressText: (text: string) => void,
  options?: WhisperTranscriptionOptions | number
): Promise<SubtitleSegment[]> {
  const opts: WhisperTranscriptionOptions = typeof options === 'number'
    ? { maxWordsPerSegment: options }
    : (options || {});

  const model: WhisperModelSize = opts.model || 'tiny';
  const language: WhisperLanguage = opts.language || 'portuguese';
  const maxWordsPerSegment = opts.maxWordsPerSegment || 4;

  onProgressText('Extraindo áudio PCM 16kHz via Web Audio API...');
  const audioData = await extractMonoAudio16kHz(mediaSrc);

  const modelId = getWhisperModelIdentifier(model);
  onProgressText(`Carregando motor Whisper WebAssembly (${model} / ONNX Runtime Web)...`);

  if (!whisperPipelines[model]) {
    const transformersUrl = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0';
    const { pipeline, env } = await import(/* @vite-ignore */ transformersUrl);
    env.allowLocalModels = false;
    whisperPipelines[model] = pipeline('automatic-speech-recognition', modelId, {
      dtype: 'q8',
      progress_callback: (info: any) => {
        if (info.status === 'progress' && typeof info.progress === 'number') {
          onProgressText(`Baixando modelo Whisper ${model} Wasm: ${Math.round(info.progress)}%`);
        }
      }
    });
  }

  const transcriber = await whisperPipelines[model];
  onProgressText(`Executando inferência acústica Whisper ${model} (${language})...`);

  const langParam = getWhisperLanguageParam(language);
  const result = await transcriber(audioData, {
    language: langParam,
    task: 'transcribe',
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5
  });

  if (result?.chunks && Array.isArray(result.chunks) && result.chunks.length > 0) {
    return convertWhisperChunksToSegments(result.chunks as WhisperWordChunk[], maxWordsPerSegment);
  }

  if (result?.text && typeof result.text === 'string' && result.text.trim()) {
    const text = result.text.trim();
    const duration = Math.max(2, audioData.length / 16000);
    const words = createWordTimestamps(text, 0, duration, 'seg_whisper_1');
    return convertWhisperChunksToSegments(
      words.map(w => ({ text: w.word, timestamp: [w.start, w.end] })),
      maxWordsPerSegment
    );
  }

  return [];
}

/**
 * Transcreve áudio a partir do elemento de vídeo/áudio usando Web Speech API em tempo real
 */
export function transcribeMediaElement(
  mediaElement: HTMLMediaElement,
  onProgressText: (text: string) => void
): Promise<SubtitleSegment[]> {
  return new Promise((resolve, reject) => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      reject(new Error('Reconhecimento de fala nativo não suportado neste navegador. Use o modo Whisper Wasm ou Google Chrome/Edge.'));
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    const segments: SubtitleSegment[] = [];
    let lastStartTime = 0;
    let accumulatedFinalTranscript = '';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const currentTime = mediaElement.currentTime || (lastStartTime + 2.5);
          const text = transcript.trim();
          if (text) {
            accumulatedFinalTranscript += ' ' + text;
            const segId = `seg_ai_${segments.length + 1}`;
            const start = lastStartTime;
            const end = Math.max(start + 1.0, currentTime);
            lastStartTime = end;

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
        } else {
          interimTranscript += transcript;
        }
      }

      onProgressText(interimTranscript || accumulatedFinalTranscript);
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition erro:', event.error);
      if (event.error !== 'no-speech') {
        recognition.stop();
        mediaElement.pause();
      }
    };

    recognition.onend = () => {
      if (segments.length === 0 && accumulatedFinalTranscript.trim()) {
        const text = accumulatedFinalTranscript.trim();
        const duration = mediaElement.duration || 10;
        const words = createWordTimestamps(text, 0, duration, 'seg_ai_1');
        segments.push({
          id: 'seg_ai_1',
          start: 0,
          end: duration,
          text,
          words,
          emoji: detectContextEmoji(text) || undefined
        });
      }
      resolve(segments);
    };

    mediaElement.currentTime = 0;
    mediaElement.muted = false;

    try {
      recognition.start();
      mediaElement.play().catch((err) => {
        recognition.stop();
        reject(err);
      });

      mediaElement.onended = () => {
        setTimeout(() => {
          recognition.stop();
        }, 500);
      };
    } catch (err) {
      reject(err);
    }
  });
}
