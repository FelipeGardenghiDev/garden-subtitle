import React from 'react';
import { Radio, Mic, Play, Pause, X } from 'lucide-react';

interface OBSLiveOverlayProps {
  isOpen: boolean;
  obsChromaMode: 'transparent' | 'green' | 'magenta' | 'black';
  setObsChromaMode: (mode: 'transparent' | 'green' | 'magenta' | 'black') => void;
  isLiveMicActive: boolean;
  toggleLiveMic: () => void;
  isPlaying: boolean;
  togglePlay: () => void;
  aspectRatio: '9:16' | '16:9';
  obsCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}

export const OBSLiveOverlay: React.FC<OBSLiveOverlayProps> = ({
  isOpen,
  obsChromaMode,
  setObsChromaMode,
  isLiveMicActive,
  toggleLiveMic,
  isPlaying,
  togglePlay,
  aspectRatio,
  obsCanvasRef,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between ${
        obsChromaMode === 'green'
          ? 'bg-[#00FF00]'
          : obsChromaMode === 'magenta'
          ? 'bg-[#FF00FF]'
          : obsChromaMode === 'black'
          ? 'bg-black'
          : 'bg-slate-950/90 backdrop-blur-xs'
      }`}
    >
      {/* Barra Flutuante de Controle OBS (Minimalista) */}
      <div className="w-full max-w-5xl mx-auto p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800 m-4 shadow-2xl z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
          <span className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-purple-400" />
            OBS Studio Live Overlay
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
            {aspectRatio} &middot; 60 FPS
          </span>
        </div>

        {/* Controles de Fundo / Chroma */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
          <span className="text-slate-400 px-2 font-medium">Fundo:</span>
          <button
            onClick={() => setObsChromaMode('transparent')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              obsChromaMode === 'transparent'
                ? 'bg-purple-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Transparente (Navegador)
          </button>
          <button
            onClick={() => setObsChromaMode('green')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              obsChromaMode === 'green'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Verde Chroma
          </button>
          <button
            onClick={() => setObsChromaMode('magenta')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              obsChromaMode === 'magenta'
                ? 'bg-pink-500 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Magenta Chroma
          </button>
          <button
            onClick={() => setObsChromaMode('black')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              obsChromaMode === 'black'
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Preto
          </button>
        </div>

        {/* Ações e Fechar */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLiveMic}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              isLiveMicActive
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Transcrever e legendar sua fala em tempo real na live"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isLiveMicActive ? 'Ouvindo Microfone...' : 'Legendar Voz ao Vivo'}</span>
          </button>

          <button
            onClick={togglePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Sair do Modo OBS (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Área Central: Canvas OBS */}
      <div className="flex-1 w-full flex items-center justify-center p-4 relative overflow-hidden">
        <canvas
          ref={obsCanvasRef}
          width={aspectRatio === '9:16' ? 1080 : 1920}
          height={aspectRatio === '9:16' ? 1920 : 1080}
          className={`max-h-full max-w-full object-contain ${
            obsChromaMode === 'transparent' ? 'drop-shadow-2xl' : ''
          }`}
        />
      </div>

      {/* Dica de Configuração do OBS no Rodapé */}
      <div className="w-full max-w-3xl mx-auto p-2.5 mb-3 bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-800/80 text-center text-[11px] text-slate-400">
        💡 <strong className="text-white">Como usar no OBS Studio:</strong> Adicione esta janela como <span className="text-purple-300 font-bold">Captura de Janela</span> (Window Capture) e adicione o filtro <span className="text-purple-300 font-bold">Color Key / Chroma Key</span> se usar fundo verde, ou use como <span className="text-purple-300 font-bold">Fonte de Navegador</span> (Browser Source).
      </div>
    </div>
  );
};
