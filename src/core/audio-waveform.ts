import { SubtitleSegment } from '../types';

/**
 * Extrai o áudio de uma URL de mídia (Blob ou HTTP) e faz reamostragem (resampling)
 * para 16.000 Hz Mono (Float32Array) usando Web Audio API e OfflineAudioContext.
 * Ideal tanto para inferência acústica do Whisper Wasm quanto para análise de Waveform.
 */
export async function extractMonoAudio16kHz(mediaSrc: string): Promise<Float32Array> {
  const response = await fetch(mediaSrc);
  const arrayBuffer = await response.arrayBuffer();

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const targetSampleRate = 16000;
    const targetLength = Math.max(1, Math.ceil(decodedBuffer.duration * targetSampleRate));

    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer.getChannelData(0);
  } finally {
    if (audioCtx.state !== 'closed') {
      await audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Calcula picos normalizados [0.06 .. 1.0] a partir de amostras PCM Float32Array
 * para desenhar as barras da forma de onda (Waveform) na Timeline.
 */
export function computeWaveformPeaks(samples: Float32Array, numBuckets = 120): number[] {
  if (!samples || samples.length === 0 || numBuckets <= 0) {
    return Array(Math.max(1, numBuckets)).fill(0.08);
  }

  const bucketSize = Math.max(1, Math.floor(samples.length / numBuckets));
  const rawPeaks: number[] = [];
  let maxPeak = 0.001;

  for (let i = 0; i < numBuckets; i++) {
    const start = i * bucketSize;
    const end = Math.min(samples.length, start + bucketSize);
    let sumSq = 0;
    let count = 0;

    // Passo adaptativo para manter performance instantânea em áudios longos
    const step = Math.max(1, Math.floor((end - start) / 64));
    for (let j = start; j < end; j += step) {
      const val = Math.abs(samples[j]);
      sumSq += val * val;
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    if (rms > maxPeak) maxPeak = rms;
    rawPeaks.push(rms);
  }

  return rawPeaks.map(p => Math.max(0.06, Math.min(1.0, p / maxPeak)));
}

/**
 * Gera uma forma de onda sintética determinística sincronizada com as palavras e
 * segmentos de legenda (usada no modo Demo ou quando não há arquivo de áudio decodificado).
 */
export function generateSyntheticWaveform(
  segments: SubtitleSegment[],
  duration: number,
  numBuckets = 120
): number[] {
  const safeDuration = Math.max(1, duration || 10);
  const peaks: number[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const t = (i / numBuckets) * safeDuration;
    const activeSeg = segments.find(s => t >= s.start && t <= s.end);

    if (!activeSeg) {
      // Ruído de fundo sutil nos intervalos de silêncio
      const noise = 0.06 + Math.abs(Math.sin(i * 1.7)) * 0.04;
      peaks.push(Number(noise.toFixed(3)));
      continue;
    }

    const activeWord = activeSeg.words.find(w => t >= w.start && t <= w.end);
    if (activeWord) {
      const wordMid = (activeWord.start + activeWord.end) / 2;
      const halfSpan = Math.max(0.05, (activeWord.end - activeWord.start) / 2);
      const distFromCenter = Math.min(1, Math.abs(t - wordMid) / halfSpan);
      const envelope = 1 - distFromCenter * 0.45;
      const harmonic = 0.7 + 0.3 * Math.abs(Math.sin(i * 3.1 + activeWord.word.length));
      const val = Math.max(0.18, Math.min(1.0, envelope * harmonic));
      peaks.push(Number(val.toFixed(3)));
    } else {
      // Micro-pausa entre palavras dentro de um mesmo segmento
      peaks.push(0.16);
    }
  }

  return peaks;
}
