import React, { useEffect, useState, useRef } from 'react';
import { Activity, Cpu } from 'lucide-react';
import { SubtitleSegment } from '../types';
import {
  extractMonoAudio16kHz,
  computeWaveformPeaks,
  generateSyntheticWaveform
} from '../core/audio-waveform';

interface WaveformTimelineProps {
  videoSrc: string | null;
  segments: SubtitleSegment[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onUpdateSegmentTiming: (id: string, start: number, end: number) => void;
}

const NUM_BARS = 96;

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  videoSrc,
  segments,
  currentTime,
  duration,
  onSeek,
  onUpdateSegmentTiming
}) => {
  const [realPeaks, setRealPeaks] = useState<number[] | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState<boolean>(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingHandle, setDraggingHandle] = useState<{
    segId: string;
    edge: 'start' | 'end';
    initialStart: number;
    initialEnd: number;
  } | null>(null);

  const safeDuration = Math.max(1, duration || 10);

  // Extrai picos reais de 16kHz quando um arquivo de vídeo/áudio é carregado
  useEffect(() => {
    let cancelled = false;
    if (!videoSrc) {
      setRealPeaks(null);
      setIsAnalyzingAudio(false);
      return;
    }

    setIsAnalyzingAudio(true);
    extractMonoAudio16kHz(videoSrc)
      .then((samples) => {
        if (cancelled) return;
        const peaks = computeWaveformPeaks(samples, NUM_BARS);
        setRealPeaks(peaks);
      })
      .catch(() => {
        if (!cancelled) setRealPeaks(null);
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzingAudio(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoSrc]);

  const peaks = realPeaks || generateSyntheticWaveform(segments, safeDuration, NUM_BARS);

  // Arraste das bordas de início/fim do segmento direto na timeline
  useEffect(() => {
    if (!draggingHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const targetTime = Number((relX * safeDuration).toFixed(2));

      if (draggingHandle.edge === 'start') {
        const clampedStart = Math.min(targetTime, draggingHandle.initialEnd - 0.25);
        onUpdateSegmentTiming(draggingHandle.segId, Math.max(0, clampedStart), draggingHandle.initialEnd);
      } else {
        const clampedEnd = Math.max(targetTime, draggingHandle.initialStart + 0.25);
        onUpdateSegmentTiming(draggingHandle.segId, draggingHandle.initialStart, Math.min(safeDuration, clampedEnd));
      }
    };

    const handleMouseUp = () => {
      setDraggingHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingHandle, safeDuration, onUpdateSegmentTiming]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingHandle || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    onSeek(Number((relX * safeDuration).toFixed(2)));
  };

  const activeSegment = segments.find(s => currentTime >= s.start && currentTime <= s.end);
  const activeWord = activeSegment?.words.find(w => currentTime >= w.start && currentTime <= w.end);
  const playheadPercent = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100));

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3 flex flex-col gap-2 select-none">
      {/* Cabeçalho da Timeline de Áudio */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 text-slate-300 font-bold">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Timeline de Áudio & Legendas (16kHz DSP)</span>
          {isAnalyzingAudio && (
            <span className="text-amber-400 font-mono animate-pulse ml-1">
              Decodificando PCM...
            </span>
          )}
          {realPeaks && !isAnalyzingAudio && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] flex items-center gap-1">
              <Cpu className="w-2.5 h-2.5" /> PCM Real
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-mono">
          {activeWord ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
              Palavra ativa: &ldquo;{activeWord.word}&rdquo;
            </span>
          ) : (
            <span className="text-slate-500">Arraste as bordas dos blocos para ajustar o tempo</span>
          )}
        </div>
      </div>

      {/* Área Interativa de Ondas + Blocos de Segmentos */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-20 w-full bg-slate-950 rounded-xl border border-slate-800/90 overflow-hidden cursor-pointer"
      >
        {/* Camada 1: Barras da Forma de Onda (Waveform) */}
        <div className="absolute inset-0 flex items-center justify-between px-1 gap-[2px] pointer-events-none">
          {peaks.map((peak, i) => {
            const barTime = (i / peaks.length) * safeDuration;
            const isPassed = barTime <= currentTime;
            const inSegment = segments.some(s => barTime >= s.start && barTime <= s.end);
            const heightPct = Math.max(8, Math.round(peak * 85));

            return (
              <div
                key={i}
                style={{ height: `${heightPct}%` }}
                className={`flex-1 rounded-full transition-colors duration-75 ${
                  isPassed
                    ? 'bg-emerald-400/80'
                    : inSegment
                    ? 'bg-cyan-500/45'
                    : 'bg-slate-800'
                }`}
              />
            );
          })}
        </div>

        {/* Camada 2: Blocos dos Segmentos de Legenda Redimensionáveis */}
        <div className="absolute inset-x-0 bottom-1.5 h-7 pointer-events-none">
          {segments.map((seg, idx) => {
            const leftPct = Math.max(0, Math.min(100, (seg.start / safeDuration) * 100));
            const widthPct = Math.max(1.5, Math.min(100 - leftPct, ((seg.end - seg.start) / safeDuration) * 100));
            const isSegActive = currentTime >= seg.start && currentTime <= seg.end;

            return (
              <div
                key={seg.id}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(seg.start);
                }}
                title={`#${idx + 1}: "${seg.text}" (${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s)`}
                className={`absolute top-0 bottom-0 rounded-md border flex items-center justify-between px-1 text-[9px] font-bold truncate pointer-events-auto transition ${
                  isSegActive
                    ? 'bg-emerald-500/30 border-emerald-400 text-white shadow-md z-10'
                    : 'bg-slate-900/85 border-slate-700/90 text-slate-300 hover:border-cyan-400/70'
                }`}
              >
                {/* Alça Esquerda (Início) */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingHandle({
                      segId: seg.id,
                      edge: 'start',
                      initialStart: seg.start,
                      initialEnd: seg.end
                    });
                  }}
                  className="w-1.5 h-full bg-emerald-400/40 hover:bg-emerald-400 cursor-ew-resize rounded-l shrink-0 mr-0.5"
                  title="Arrastar para ajustar início do trecho"
                />

                <span className="truncate">
                  {seg.emoji ? `${seg.emoji} ` : ''}{seg.text}
                </span>

                {/* Alça Direita (Fim) */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingHandle({
                      segId: seg.id,
                      edge: 'end',
                      initialStart: seg.start,
                      initialEnd: seg.end
                    });
                  }}
                  className="w-1.5 h-full bg-emerald-400/40 hover:bg-emerald-400 cursor-ew-resize rounded-r shrink-0 ml-0.5"
                  title="Arrastar para ajustar fim do trecho"
                />
              </div>
            );
          })}
        </div>

        {/* Camada 3: Agulha do Playhead */}
        <div
          style={{ left: `${playheadPercent}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] z-20 pointer-events-none"
        >
          <div className="w-2.5 h-2.5 -ml-[4px] rounded-full bg-amber-400" />
        </div>
      </div>
    </div>
  );
};
