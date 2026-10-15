import React from 'react';
import { 
  Sparkles, FileText, Plus, Trash2, Mic, Smile, 
  Undo2, Redo2, Clock
} from 'lucide-react';
import { SubtitleSegment } from '../types';

interface SubtitleEditorProps {
  segments: SubtitleSegment[];
  currentTime: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  onSeek: (time: number) => void;
  onAddSegment: () => void;
  onOpenTextModal: () => void;
  onTranscribeAI: () => void;
  isTranscribingAudio: boolean;
  liveTranscriptionText: string;
  onAutoEmojis: () => void;
  onUpdateSegmentText: (id: string, text: string) => void;
  onUpdateSegmentTiming: (id: string, start: number, end: number) => void;
  onRemoveSegment: (id: string) => void;
  onSelectEmoji: (id: string, emoji: string | null) => void;
  editingEmojiSegmentId: string | null;
  setEditingEmojiSegmentId: (id: string | null) => void;
}

const COMMON_EMOJIS = ['🔥', '💰', '🚀', '💡', '🧠', '⚡', '🎯', '📈', '✨', '👑', '⚠️', '👀', '💯', '💎'];

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  segments,
  currentTime,
  canUndo,
  canRedo,
  undo,
  redo,
  onSeek,
  onAddSegment,
  onOpenTextModal,
  onTranscribeAI,
  isTranscribingAudio,
  liveTranscriptionText,
  onAutoEmojis,
  onUpdateSegmentText,
  onUpdateSegmentTiming,
  onRemoveSegment,
  onSelectEmoji,
  editingEmojiSegmentId,
  setEditingEmojiSegmentId
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="space-y-4">
      {/* Barra de Ações do Editor: IA, Texto, Adicionar, Undo, Redo */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Desfazer última alteração (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desfazer</span>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Refazer última alteração (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refazer</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Transcrição Nativa por IA */}
          <button
            onClick={onTranscribeAI}
            disabled={isTranscribingAudio}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            title="Transcrever áudio do vídeo automaticamente usando IA nativa"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isTranscribingAudio ? 'Ouvindo...' : 'Transcrever Áudio (IA)'}</span>
          </button>

          {/* Gerar a partir de Texto */}
          <button
            onClick={onOpenTextModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 text-xs font-semibold transition cursor-pointer"
            title="Colar roteiro ou texto para dividir em legendas cinéticas"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Colar Texto</span>
          </button>

          {/* Auto Emojis */}
          <button
            onClick={onAutoEmojis}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition cursor-pointer"
            title="Detectar e adicionar emojis contextuais com base nas palavras"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto Emojis</span>
          </button>

          {/* Novo Segmento */}
          <button
            onClick={onAddSegment}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
        </div>
      </div>

      {/* Banner de Transcrição Ativa */}
      {isTranscribingAudio && (
        <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-3 animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono truncate">{liveTranscriptionText || 'Ouvindo áudio e alinhando palavras...'}</span>
        </div>
      )}

      {/* Lista de Segmentos da Timeline */}
      <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
        {segments.map((segment, idx) => {
          const isActive = currentTime >= segment.start && currentTime <= segment.end;

          return (
            <div
              key={segment.id}
              className={`p-3.5 rounded-2xl border transition duration-150 flex flex-col gap-2.5 ${
                isActive
                  ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-500/5'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Topo do Card: Índice, Timings e Botão de Deletar */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-mono font-bold text-[10px]">
                    {idx + 1}
                  </span>

                  {/* Badges de In e Out */}
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <button
                      onClick={() => onSeek(segment.start)}
                      className="hover:text-emerald-400 transition cursor-pointer underline decoration-dotted"
                      title="Pular para o início deste trecho"
                    >
                      {formatTime(segment.start)}
                    </button>
                    <span>&rarr;</span>
                    <button
                      onClick={() => onSeek(segment.end)}
                      className="hover:text-emerald-400 transition cursor-pointer underline decoration-dotted"
                      title="Pular para o fim deste trecho"
                    >
                      {formatTime(segment.end)}
                    </button>
                    <div className="flex items-center gap-0.5 ml-1 bg-slate-900 rounded border border-slate-800 px-1 py-0.5 text-[9px]">
                      <button
                        onClick={() => onUpdateSegmentTiming(segment.id, Math.max(0, segment.start - 0.1), segment.end)}
                        className="hover:text-emerald-400 cursor-pointer px-0.5"
                        title="Adiantar início (-0.1s)"
                      >
                        -0.1s
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        onClick={() => onUpdateSegmentTiming(segment.id, segment.start, segment.end + 0.1)}
                        className="hover:text-emerald-400 cursor-pointer px-0.5"
                        title="Estender fim (+0.1s)"
                      >
                        +0.1s
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Seletor de Emoji */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setEditingEmojiSegmentId(
                          editingEmojiSegmentId === segment.id ? null : segment.id
                        )
                      }
                      className="p-1 px-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-xs flex items-center gap-1 cursor-pointer transition"
                      title="Alterar emoji deste trecho"
                    >
                      {segment.emoji ? (
                        <span className="text-sm">{segment.emoji}</span>
                      ) : (
                        <Smile className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>

                    {/* Popover de Emojis */}
                    {editingEmojiSegmentId === segment.id && (
                      <div className="absolute right-0 top-8 z-30 bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-2xl flex flex-wrap gap-1.5 w-48">
                        {COMMON_EMOJIS.map(em => (
                          <button
                            key={em}
                            onClick={() => onSelectEmoji(segment.id, em)}
                            className="w-7 h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center text-sm cursor-pointer"
                          >
                            {em}
                          </button>
                        ))}
                        <button
                          onClick={() => onSelectEmoji(segment.id, null)}
                          className="w-full text-[10px] text-red-400 hover:bg-slate-800 py-1 rounded cursor-pointer text-center font-bold mt-1"
                        >
                          Remover Emoji
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Deletar Segmento */}
                  <button
                    onClick={() => onRemoveSegment(segment.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                    title="Excluir este segmento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Input de Edição de Texto */}
              <input
                type="text"
                value={segment.text}
                onChange={(e) => onUpdateSegmentText(segment.id, e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                placeholder="Texto da legenda..."
              />

              {/* Badges de Palavras Sincronizadas */}
              {segment.words.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {segment.words.map(w => {
                    const isWordActive = currentTime >= w.start && currentTime <= w.end;
                    return (
                      <span
                        key={w.id}
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono transition ${
                          isWordActive
                            ? 'bg-emerald-500 text-slate-950 font-black shadow-sm scale-105'
                            : 'bg-slate-900 text-slate-400 border border-slate-800/80'
                        }`}
                      >
                        {w.word}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
