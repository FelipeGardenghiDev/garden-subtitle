import React from 'react';
import { Cpu } from 'lucide-react';

interface TranscodeModalProps {
  isOpen: boolean;
  status: string;
  progress: number;
}

export const TranscodeModal: React.FC<TranscodeModalProps> = ({
  isOpen,
  status,
  progress
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-pulse">
          <Cpu className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">Processamento WebAssembly (FFmpeg)</h3>
          <p className="text-xs text-slate-400 mt-1">
            Remuxando ou transcodificando mídia para formato compatível com o navegador
          </p>
        </div>
        <div className="space-y-2 py-2 text-left">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-emerald-300 truncate max-w-[260px]">{status}</span>
            <span className="font-mono text-emerald-400 font-bold">{progress}%</span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          🔒 100% no seu navegador: nenhum arquivo é enviado para servidores externos.
        </p>
      </div>
    </div>
  );
};
