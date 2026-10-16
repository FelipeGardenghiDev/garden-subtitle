import React from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { SubtitleSegment } from '../types';
import { WaveformTimeline } from './WaveformTimeline';

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoSrc: string | null;
  videoName: string;
  segments: SubtitleSegment[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  aspectRatio: '9:16' | '16:9' | '1:1';
  togglePlay: () => void;
  seek: (time: number) => void;
  toggleMute: () => void;
  setAspectRatio: (ratio: '9:16' | '16:9' | '1:1') => void;
  onUpdateSegmentTiming: (id: string, start: number, end: number) => void;
  onVideoLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVideoTimeUpdate: () => void;
  onVideoEnded: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoRef,
  previewCanvasRef,
  videoSrc,
  videoName,
  segments,
  isPlaying,
  currentTime,
  duration,
  isMuted,
  aspectRatio,
  togglePlay,
  seek,
  toggleMute,
  setAspectRatio,
  onUpdateSegmentTiming,
  onVideoLoadedMetadata,
  onVideoTimeUpdate,
  onVideoEnded
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  const canvasWidth = aspectRatio === '16:9' ? 1920 : 1080;
  const canvasHeight = aspectRatio === '9:16' ? 1920 : 1080;

  return (
    <div className="flex-1 flex flex-col bg-slate-950/60 p-4 md:p-6 overflow-y-auto items-center justify-center">
      {/* Container Central com Proporção Controlada */}
      <div className="w-full max-w-xl flex flex-col items-center gap-3">
        {/* Aspect Ratio Selector Pills */}
        <div className="flex items-center justify-between w-full px-2">
          <span className="text-[11px] font-bold text-slate-400 truncate max-w-[200px]">
            {videoName}
          </span>
          <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-xl text-[10px]">
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                aspectRatio === '9:16'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              9:16 (Reels)
            </button>
            <button
              onClick={() => setAspectRatio('1:1')}
              className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                aspectRatio === '1:1'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1:1 (Feed)
            </button>
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                aspectRatio === '16:9'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              16:9 (YouTube)
            </button>
          </div>
        </div>

        {/* Viewport Canvas do Player */}
        <div
          className={`relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/5 border border-slate-800/80 bg-slate-900 flex items-center justify-center transition-all duration-300 ${
            aspectRatio === '9:16'
              ? 'w-full max-w-[320px] aspect-[9/16]'
              : aspectRatio === '1:1'
              ? 'w-full max-w-[380px] aspect-square'
              : 'w-full aspect-[16/9]'
          }`}
        >
          {/* Elemento de Vídeo oculto usado como fonte de frames */}
          <video
            ref={videoRef}
            src={videoSrc || undefined}
            playsInline
            crossOrigin="anonymous"
            muted={isMuted}
            onLoadedMetadata={onVideoLoadedMetadata}
            onTimeUpdate={onVideoTimeUpdate}
            onEnded={onVideoEnded}
            className="hidden"
          />

          {/* Canvas de Renderização em Tempo Real (60 FPS) */}
          <canvas
            ref={previewCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-cover"
          />

          {/* Play/Pause Overlay ao Clicar na Tela */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-transparent group cursor-pointer focus:outline-none"
            aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
          >
            <div
              className={`w-14 h-14 rounded-full bg-slate-950/60 backdrop-blur-sm border border-slate-700/60 flex items-center justify-center text-white transition duration-200 ${
                isPlaying ? 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100' : 'opacity-100 scale-100'
              }`}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
            </div>
          </button>
        </div>

        {/* Barra de Controles e Scrubber */}
        <div className="w-full bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-3 flex flex-col gap-2">
          {/* Timeline Range Scrubber */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-emerald-400 font-bold min-w-[46px]">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 10}
              step={0.05}
              value={currentTime}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="flex-1 accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-400 font-medium min-w-[46px] text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Botões de Ação do Player */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center hover:bg-emerald-400 transition cursor-pointer"
                title={isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950 ml-0.5" />}
              </button>
              <button
                onClick={() => seek(0)}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Reiniciar início"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={toggleMute}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title={isMuted ? 'Desmutar' : 'Mutar'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-[10px] text-slate-400 font-medium">
              Espaço: <span className="text-slate-300 font-bold">Play/Pause</span> &bull; <span className="text-slate-300 font-bold">&larr;/&rarr;</span> &bull; <span className="text-slate-300 font-bold">Ctrl+Z/Y</span>
            </div>
          </div>
        </div>

        {/* Timeline Interativa de Ondas de Áudio (Waveform 16kHz + Blocos Redimensionáveis) */}
        <WaveformTimeline
          videoSrc={videoSrc}
          segments={segments}
          currentTime={currentTime}
          duration={duration}
          onSeek={seek}
          onUpdateSegmentTiming={onUpdateSegmentTiming}
        />
      </div>
    </div>
  );
};
