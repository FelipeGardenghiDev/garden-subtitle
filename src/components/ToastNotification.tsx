import React from 'react';
import { Sparkles } from 'lucide-react';

interface ToastNotificationProps {
  message: string | null;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-5 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce">
      <Sparkles className="w-4 h-4 text-emerald-400" />
      <span>{message}</span>
    </div>
  );
};
