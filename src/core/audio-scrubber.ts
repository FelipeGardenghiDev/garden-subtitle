/**
 * Audio Scrubber Engine & Frame Quantizer (60fps / 30fps / 24fps)
 * Fornece reprodução de microfatias de áudio em ultrabaixa latência (AudioContext)
 * com fade-in / fade-out de 5ms para eliminar pops/clicks durante o arraste da agulha de reprodução.
 */

export interface FrameQuantizeOptions {
  fps?: number;
  toleranceSeconds?: number;
}

/**
 * Quantiza um timestamp em segundos para o frame mais próximo baseado na taxa de quadros (FPS)
 */
export function quantizeToFrame(seconds: number, fps = 30): number {
  if (seconds < 0) return 0;
  const frameDuration = 1 / fps;
  const frameIndex = Math.round(seconds / frameDuration);
  return Number((frameIndex * frameDuration).toFixed(4));
}

/**
 * Calcula se dois pontos no tempo estão dentro do raio de encaixe (magnetic snapping)
 */
export function shouldSnapToPoint(
  currentTime: number,
  targetTime: number,
  thresholdSeconds = 0.05
): boolean {
  return Math.abs(currentTime - targetTime) <= thresholdSeconds;
}

/**
 * Encontra o ponto de corte ou marcador de legenda mais próximo para encaixe magnético (Snap-to-Grid)
 */
export function findNearestSnapPoint(
  currentTime: number,
  snapPoints: number[],
  thresholdSeconds = 0.08
): number | null {
  let closest: number | null = null;
  let minDiff = Infinity;

  for (const pt of snapPoints) {
    const diff = Math.abs(currentTime - pt);
    if (diff <= thresholdSeconds && diff < minDiff) {
      minDiff = diff;
      closest = pt;
    }
  }

  return closest;
}

export class AudioScrubberEngine {
  private ctx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  constructor(audioBuffer?: AudioBuffer) {
    if (audioBuffer) {
      this.audioBuffer = audioBuffer;
    }
  }

  public setAudioBuffer(buffer: AudioBuffer): void {
    this.audioBuffer = buffer;
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Toca uma microfatia de áudio em tempo real ao arrastar a agulha de reprodução.
   * Aplica envoltória de ganho (5ms fade-in e 5ms fade-out) para evitar artefatos acústicos.
   */
  public scrub(startTime: number, sliceDuration = 0.08, volume = 0.8): void {
    if (!this.audioBuffer) return;
    const ctx = this.initContext();
    if (!ctx) return;

    // Interromper fatia anterior se ainda estiver tocando
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Ignora caso já tenha parado
      }
      this.currentSource = null;
    }

    const safeStart = Math.max(0, Math.min(startTime, this.audioBuffer.duration - 0.01));
    const safeDuration = Math.min(sliceDuration, this.audioBuffer.duration - safeStart);
    if (safeDuration <= 0.005) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = this.audioBuffer;

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const fadeTime = Math.min(0.008, safeDuration / 3);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + fadeTime);
      gain.gain.setValueAtTime(volume, now + safeDuration - fadeTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + safeDuration);

      source.connect(gain);
      gain.connect(ctx.destination);

      source.start(now, safeStart, safeDuration);
      this.currentSource = source;
      this.gainNode = gain;
    } catch {
      // Ignorar falhas transitórias de contexto
    }
  }

  public dispose(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
