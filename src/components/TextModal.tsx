import React from 'react';
import { FileText, X } from 'lucide-react';

interface TextModalProps {
  isOpen: boolean;
  rawTextInput: string;
  setRawTextInput: (text: string) => void;
  onConvertText: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const TextModal: React.FC<TextModalProps> = ({
  isOpen,
  rawTextInput,
  setRawTextInput,
  onConvertText,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            Gerar Legendas a partir de Texto
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onConvertText} className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">
              Cole o roteiro ou fala do vídeo (as palavras serão divididas automaticamente):
            </label>
            <textarea
              rows={5}
              required
              placeholder="Ex: O segredo para vídeos virais é prender a atenção nos primeiros 3 segundos..."
              value={rawTextInput}
              onChange={(e) => setRawTextInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer shadow-lg hover:bg-emerald-400 transition"
          >
            Gerar Legendas e Timestamps
          </button>
        </form>
      </div>
    </div>
  );
};
