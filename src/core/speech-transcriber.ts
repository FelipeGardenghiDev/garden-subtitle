import { SubtitleSegment } from '../types';
import { createWordTimestamps } from './subtitle-parsers';
import { detectContextEmoji } from './emoji-detector';

// Declarar SpeechRecognition para TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

/**
 * Verifica se a API de Reconhecimento de Voz nativa do navegador está disponível
 */
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

/**
 * Transcreve áudio a partir do elemento de vídeo/áudio ou microfone local usando IA do navegador
 */
export function transcribeMediaElement(
  mediaElement: HTMLMediaElement,
  onProgressText: (text: string) => void
): Promise<SubtitleSegment[]> {
  return new Promise((resolve, reject) => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      reject(new Error('Reconhecimento de fala nativo não suportado neste navegador. Use o Google Chrome ou Edge.'));
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
      // Se não gerou segmentos mas capturou texto acumulado
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

    // Iniciar reprodução do vídeo e captura do áudio
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
