import React, { useState } from 'react';
import {
  Sparkles, FileText, Plus, Trash2, Mic, Smile,
  Undo2, Redo2, Clock, Scissors, Merge, ChevronDown, ChevronUp, Cpu
} from 'lucide-react';
import { SubtitleSegment, WordTimestamp, WhisperModelSize, WhisperLanguage } from '../types';

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
  onTranscribeWhisperWasm: () => void;
  whisperModel?: WhisperModelSize;
  setWhisperModel?: (model: WhisperModelSize) => void;
  whisperLanguage?: WhisperLanguage;
  setWhisperLanguage?: (lang: WhisperLanguage) => void;
  isTranscribingAudio: boolean;
  liveTranscriptionText: string;
  onAutoEmojis: () => void;
  onUpdateSegmentText: (id: string, text: string) => void;
  onUpdateSegmentTiming: (id: string, start: number, end: number) => void;
  onUpdateWord: (segmentId: string, wordId: string, updates: Partial<Pick<WordTimestamp, 'word' | 'start' | 'end'>>) => void;
  onSplitSegment: (segmentId: string, splitAtWordIndex?: number) => void;
  onMergeWithNextSegment: (segmentId: string) => void;
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
  onTranscribeWhisperWasm,
  whisperModel = 'tiny',
  setWhisperModel,
  whisperLanguage = 'portuguese',
  setWhisperLanguage,
  isTranscribingAudio,
  liveTranscriptionText,
  onAutoEmojis,
  onUpdateSegmentText,
  onUpdateSegmentTiming,
  onUpdateWord,
  onSplitSegment,
  onMergeWithNextSegment,
  onRemoveSegment,
  onSelectEmoji,
  editingEmojiSegmentId,
  setEditingEmojiSegmentId
}) => {
  const [expandedWordSegId, setExpandedWordSegId] = useState<string | null>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="space-y-4">
      {/* Barra de Ações do Editor: IA Whisper Wasm, Web Speech, Texto, Adicionar, Undo, Redo */}
      <div className="flex flex-col gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
            {/* Gerar a partir de Texto */}
            <button
              onClick={onOpenTextModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Colar roteiro ou texto para dividir em legendas cinéticas"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Colar Texto</span>
            </button>

            {/* Auto Emojis */}
            <button
              onClick={onAutoEmojis}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition cursor-pointer"
              title="Detectar e adicionar emojis contextuais com base nas palavras"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto Emojis</span>
            </button>

            {/* Novo Segmento */}
            <button
              onClick={onAddSegment}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </div>
        </div>

        {/* Motores de Transcrição Acústica (Whisper Wasm 16kHz Offline vs Web Speech API) */}
        <div className="space-y-1.5 pt-1 border-t border-slate-900">
          {setWhisperModel && setWhisperLanguage && (
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div>
                <label className="text-slate-400 block mb-0.5 font-medium">Modelo Whisper:</label>
                <select
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value as WhisperModelSize)}
                  disabled={isTranscribingAudio}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-200 text-xs"
                >
                  <option value="tiny">Tiny (~39MB)</option>
                  <option value="base">Base (~74MB)</option>
                  <option value="small">Small (~244MB)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-0.5 font-medium">Idioma:</label>
                <select
                  value={whisperLanguage}
                  onChange={(e) => setWhisperLanguage(e.target.value as WhisperLanguage)}
                  disabled={isTranscribingAudio}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-200 text-xs"
                >
                  <option value="portuguese">Português</option>
                  <option value="english">Inglês</option>
                  <option value="spanish">Espanhol</option>
                  <option value="auto">Automático</option>
                </select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onTranscribeWhisperWasm}
              disabled={isTranscribingAudio}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
              title="Extrair áudio em 16kHz via Web Audio API e transcrever com Whisper WebAssembly (Word-Level Timestamps)"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isTranscribingAudio ? 'Processando...' : `Whisper (${whisperModel})`}</span>
            </button>

            <button
              onClick={onTranscribeAI}
              disabled={isTranscribingAudio}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
              title="Transcrever áudio do vídeo em tempo real usando reconhecimento nativo do navegador"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isTranscribingAudio ? 'Ouvindo...' : 'Web Speech (Live)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Banner de Transcrição Ativa */}
      {isTranscribingAudio && (
        <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-3 animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="font-mono truncate">{liveTranscriptionText || 'Processando áudio e alinhando palavras...'}</span>
        </div>
      )}

      {/* Lista de Segmentos da Timeline */}
      <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
        {segments.map((segment, idx) => {
          const isActive = currentTime >= segment.start && currentTime <= segment.end;
          const isWordEditorOpen = expandedWordSegId === segment.id;

          return (
            <div
              key={segment.id}
              className={`p-3.5 rounded-2xl border transition duration-150 flex flex-col gap-2.5 ${
                isActive
                  ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-500/5'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Topo do Card: Índice, Timings e Ações */}
              <div className="flex items-center justify-between text-xs gap-1">
                <div className="flex items-center gap-2 flex-wrap">
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

                <div className="flex items-center gap-1">
                  {/* Dividir Segmento (Split) */}
                  {segment.words.length >= 2 && (
                    <button
                      onClick={() => onSplitSegment(segment.id)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition cursor-pointer"
                      title="Dividir segmento em dois blocos (Split)"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Unir com Próximo Segmento (Merge) */}
                  {idx < segments.length - 1 && (
                    <button
                      onClick={() => onMergeWithNextSegment(segment.id)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/40 transition cursor-pointer"
                      title="Unir este segmento com o próximo (Merge)"
                    >
                      <Merge className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Expandir Ajuste Fino Word-Level */}
                  <button
                    onClick={() => setExpandedWordSegId(isWordEditorOpen ? null : segment.id)}
                    className={`p-1 px-2 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
                      isWordEditorOpen
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title="Abrir edição fina palavra por palavra (Word-Level Timestamps)"
                  >
                    <span>Palavras</span>
                    {isWordEditorOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

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

              {/* Input de Edição de Texto do Segmento */}
              <input
                type="text"
                value={segment.text}
                onChange={(e) => onUpdateSegmentText(segment.id, e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                placeholder="Texto da legenda..."
              />

              {/* Badges de Palavras Sincronizadas (Clicáveis para Pular ou Editar) */}
              {segment.words.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {segment.words.map(w => {
                    const isWordActive = currentTime >= w.start && currentTime <= w.end;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          onSeek(w.start);
                          setExpandedWordSegId(segment.id);
                        }}
                        title={`Clique para ir para ${w.start.toFixed(2)}s e ajustar esta palavra`}
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono transition cursor-pointer ${
                          isWordActive
                            ? 'bg-emerald-500 text-slate-950 font-black shadow-sm scale-105'
                            : 'bg-slate-900 text-slate-400 border border-slate-800/80 hover:border-emerald-500/50 hover:text-white'
                        }`}
                      >
                        {w.word}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Painel Expansível: Edição Fina Word-Level (Por Palavra) */}
              {isWordEditorOpen && segment.words.length > 0 && (
                <div className="mt-1 pt-2.5 border-t border-slate-800/90 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-1">
                    <span>Ajuste Cirúrgico por Palavra (Word-Level)</span>
                    <span className="font-mono text-[9px] text-slate-500">Início (s) / Fim (s)</span>
                  </div>

                  <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                    {segment.words.map((w, wIdx) => {
                      const isWordActive = currentTime >= w.start && currentTime <= w.end;
                      return (
                        <div
                          key={w.id}
                          className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-[11px] ${
                            isWordActive
                              ? 'bg-emerald-950/30 border-emerald-500/50'
                              : 'bg-slate-900/60 border-slate-800/80'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSeek(w.start)}
                            className="w-5 h-5 rounded bg-slate-800 text-[9px] font-mono text-slate-400 hover:text-emerald-400 flex items-center justify-center shrink-0 cursor-pointer"
                            title="Ouvir a partir desta palavra"
                          >
                            {wIdx + 1}
                          </button>

                          <input
                            type="text"
                            value={w.word}
                            onChange={(e) => onUpdateWord(segment.id, w.id, { word: e.target.value })}
                            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                          />

                          <input
                            type="number"
                            step={0.05}
                            min={0}
                            value={w.start}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!Number.isNaN(val)) {
                                onUpdateWord(segment.id, w.id, { start: val });
                              }
                            }}
                            className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-[10px] font-mono text-emerald-400 text-center focus:outline-none focus:border-emerald-500"
                            title="Início da palavra (segundos)"
                          />

                          <span className="text-slate-600 font-mono text-[10px]">&rarr;</span>

                          <input
                            type="number"
                            step={0.05}
                            min={0}
                            value={w.end}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!Number.isNaN(val)) {
                                onUpdateWord(segment.id, w.id, { end: val });
                              }
                            }}
                            className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-[10px] font-mono text-cyan-400 text-center focus:outline-none focus:border-cyan-500"
                            title="Fim da palavra (segundos)"
                          />

                          {wIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => onSplitSegment(segment.id, wIdx)}
                              className="p-1 rounded bg-slate-800/80 text-slate-400 hover:text-cyan-400 cursor-pointer"
                              title="Dividir segmento a partir desta palavra"
                            >
                              <Scissors className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
