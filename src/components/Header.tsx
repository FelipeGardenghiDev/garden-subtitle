import React from 'react';
import { Upload, FileText, Wand2, Radio, Undo2, Redo2 } from 'lucide-react';

interface HeaderProps {
  onImportSubtitleClick: () => void;
  onUploadMediaClick: () => void;
  onLoadDemo: () => void;
  onOpenOBS: () => void;
  subFileInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSubFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onImportSubtitleClick,
  onUploadMediaClick,
  onLoadDemo,
  onOpenOBS,
  subFileInputRef,
  fileInputRef,
  onSubFileUpload,
  onFileUpload,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-emerald-500/20">
            GS
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              Garden Subtitle
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                v1.0.0 &middot; Senior Architecture
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Estúdio Web de Legendas Cinéticas, Wasm & NLEs</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Ações de Desfazer / Refazer (Undo/Redo) Rápidas */}
          {onUndo && onRedo && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 mr-1">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="Desfazer (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="Refazer (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={onImportSubtitleClick}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 transition cursor-pointer"
            title="Importar arquivo .SRT, .VTT ou .GARDEN-SUB"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Importar Legenda</span>
          </button>
          <input
            type="file"
            ref={subFileInputRef}
            onChange={onSubFileUpload}
            accept=".srt,.vtt,.garden-sub,.json"
            className="hidden"
          />

          <button
            onClick={onUploadMediaClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Subir Mídia</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileUpload}
            accept="video/*,audio/*,.mp4,.webm,.mov,.m4v,.ogg,.ogv,.mkv,.avi,.flv,.wmv,.mts,.mp3,.wav,.m4a,.aac"
            className="hidden"
          />

          <button
            onClick={onLoadDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold text-emerald-400 transition cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Usar Demo</span>
          </button>

          <button
            onClick={onOpenOBS}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-xs font-bold text-purple-300 transition cursor-pointer"
            title="Abrir Modo Live Overlay para OBS Studio e Streaming"
          >
            <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>Modo OBS Studio</span>
          </button>
        </div>
      </div>
    </header>
  );
};
