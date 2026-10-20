import React from 'react';
import { 
  Film, Cpu, Layers, FileText, ArrowRight, Download, 
  Sliders, Radio, Sparkles 
} from 'lucide-react';

interface ExportSectionProps {
  isExporting: boolean;
  exportProgress: number;
  onExportBurnInVideo: (convertMP4: boolean) => void;
  onExportTransparentOverlay: () => void;
  onExportGardenCut: () => void;
  onExportSRT: () => void;
  onExportVTT: () => void;
  onExportASS: () => void;
  onExportPremiere: () => void;
  onExportFCPXML: () => void;
  onExportAfterEffects: () => void;
  onExportTTML?: () => void;
  onExportEDL?: () => void;
  onOpenOBSLive: () => void;
}

export const ExportSection: React.FC<ExportSectionProps> = ({
  isExporting,
  exportProgress,
  onExportBurnInVideo,
  onExportTransparentOverlay,
  onExportGardenCut,
  onExportSRT,
  onExportVTT,
  onExportASS,
  onExportPremiere,
  onExportFCPXML,
  onExportAfterEffects,
  onExportTTML,
  onExportEDL,
  onOpenOBSLive
}) => {
  return (
    <div className="space-y-4">
      {/* CARD MODO 1: RENDERIZAÇÃO DE VÍDEO FINAL COM LEGENDA EMBUTIDA */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-white">
              Modo 1: Gravação & Renderização Direta (Hardsub)
            </h4>
            <p className="text-[10px] text-slate-400">Renderiza os frames do vídeo com legendas cinéticas embutidas</p>
          </div>
        </div>

        {isExporting ? (
          <div className="space-y-2 py-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                Renderizando e gravando mídia no navegador...
              </span>
              <span className="font-mono text-emerald-400 font-bold">{exportProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-200"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => onExportBurnInVideo(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
            >
              <Film className="w-4 h-4 fill-slate-950" />
              <span>Exportar Vídeo Final com Legenda (.webm / .mp4 rápido)</span>
            </button>
            <button
              onClick={() => onExportBurnInVideo(true)}
              className="w-full py-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Converter para MP4 Universal (H.264 via FFmpeg Wasm)</span>
            </button>
            <button
              onClick={onExportTransparentOverlay}
              className="w-full py-2.5 rounded-xl bg-slate-950/80 border border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Exportar Legenda em Fundo Transparente (Alpha WebM Overlay)</span>
            </button>
          </div>
        )}
      </div>

      {/* CARD MODO 2: ARQUIVOS & INTEGRAÇÃO GARDEN CUT */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-white">
              Modo 2: Arquivos de Legendas & Ecossistema
            </h4>
            <p className="text-[10px] text-slate-400">Envie para o GardenCut ou use no Premiere, DaVinci e CapCut</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          {/* Pacote GardenCut */}
          <button
            onClick={onExportGardenCut}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition cursor-pointer flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-bold text-cyan-400 block mb-0.5">🌿 GardenCut</span>
              <p className="text-[10px] text-slate-400 leading-tight">Pacote .garden-sub para timeline</p>
            </div>
            <span className="text-[9px] font-mono text-cyan-300 mt-2 flex items-center gap-1 font-bold">
              Baixar .garden-sub <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          {/* SRT */}
          <button
            onClick={onExportSRT}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-bold text-white block mb-0.5">📄 Arquivo .SRT</span>
              <p className="text-[10px] text-slate-400 leading-tight">Padrão universal SubRip</p>
            </div>
            <span className="text-[9px] font-mono text-slate-300 mt-2 flex items-center gap-1 font-bold">
              Baixar .srt <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          {/* VTT */}
          <button
            onClick={onExportVTT}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-bold text-white block mb-0.5">🌐 Arquivo .VTT</span>
              <p className="text-[10px] text-slate-400 leading-tight">Legendas WebVTT para web</p>
            </div>
            <span className="text-[9px] font-mono text-slate-300 mt-2 flex items-center gap-1 font-bold">
              Baixar .vtt <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          {/* ASS */}
          <button
            onClick={onExportASS}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-left transition cursor-pointer flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-bold text-amber-400 block mb-0.5">🎭 Arquivo .ASS</span>
              <p className="text-[10px] text-slate-400 leading-tight">SubStation Alpha com fontes e estilos</p>
            </div>
            <span className="text-[9px] font-mono text-amber-300 mt-2 flex items-center gap-1 font-bold">
              Baixar .ass <ArrowRight className="w-3 h-3" />
            </span>
          </button>
        </div>
      </div>

      {/* CARD MODO 3: SOFTWARES INDUSTRIAIS NLE (PREMIERE, DAVINCI, VEGAS, AFTER EFFECTS) */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-white">
              Modo 3: Editores Profissionais NLE
            </h4>
            <p className="text-[10px] text-slate-400">Projetos nativos para Adobe Premiere Pro, DaVinci Resolve, Sony Vegas e After Effects</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Adobe Premiere Pro .prproj */}
          <button
            onClick={onExportPremiere}
            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 text-left transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-purple-400">🎬 Adobe Premiere Pro</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">.prproj</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Projeto nativo compactado em gzip. Abre com 2 cliques no Windows/Mac com timeline pronta.
              </p>
            </div>
            <span className="text-[10px] font-mono text-purple-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
              Baixar .prproj <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          {/* DaVinci Resolve & Sony Vegas .xml */}
          <button
            onClick={onExportFCPXML}
            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-pink-500/50 text-left transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-pink-400">🎞️ DaVinci & Sony Vegas</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono font-bold">.xml</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Timeline Universal FCP 7 XML com cortes sincronizados e geradores de títulos por palavra.
              </p>
            </div>
            <span className="text-[10px] font-mono text-pink-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
              Baixar .xml <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          {/* Adobe After Effects .jsx */}
          <button
            onClick={onExportAfterEffects}
            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-left transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-amber-400">⚡ Adobe After Effects</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">.jsx</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Script ExtendScript que cria camadas de texto vetoriais com keyframes de pop/zoom nativos.
              </p>
            </div>
            <span className="text-[10px] font-mono text-amber-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
              Baixar .jsx <ArrowRight className="w-3 h-3" />
            </span>
          </button>
          {/* W3C TTML / Netflix */}
          <button
            onClick={onExportTTML}
            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-left transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-400">🌐 W3C TTML / SMPTE</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">.ttml</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Padrão internacional Netflix e Amazon Prime com posicionamento e estilização W3C.
              </p>
            </div>
            <span className="text-[10px] font-mono text-emerald-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
              Baixar .ttml <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          {/* CMX 3600 EDL */}
          <button
            onClick={onExportEDL}
            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-left transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-cyan-400">📋 CMX 3600 EDL</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">.edl</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Lista de decisão de corte universal com timecodes SMPTE para Avid, DaVinci e Premiere.
              </p>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
              Baixar .edl <ArrowRight className="w-3 h-3" />
            </span>
          </button>
        </div>
      </div>

      {/* CARD MODO 4: OBS STUDIO & BROADCAST LIVE */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase text-white flex items-center gap-2">
                Modo 4: OBS Studio & Broadcast Live
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">Streaming</span>
              </h4>
              <p className="text-[10px] text-slate-400">Use legendas dinâmicas ao vivo em suas streams na Twitch, YouTube ou gravações</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={onOpenOBSLive}
            className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 hover:bg-purple-900/30 text-left transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Radio className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-purple-300">Abrir Janela OBS Live Overlay</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Exibe tela limpa com fundo transparente ou Chroma Key para capturar no OBS Studio via "Captura de Janela" ou "Navegador".
              </p>
            </div>
            <span className="text-[10px] font-mono text-purple-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
              Abrir Overlay Live <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          <button
            onClick={onExportTransparentOverlay}
            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-300">Vídeo WebM Alpha para OBS</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Gera vídeo com canal Alpha transparente para colocar como "Fonte de Mídia" (Media Source) no OBS Studio.
              </p>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 mt-3 flex items-center gap-1 font-bold group-hover:translate-x-0.5 transition-transform">
              Exportar Alpha WebM <Download className="w-3 h-3" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
