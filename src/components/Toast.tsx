import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

export const ToastContainer: React.FC<{ toasts: ToastMessage[] }> = ({ toasts }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="glass-card px-4 py-2.5 flex items-center gap-2.5 text-[13px] font-medium text-stone-700 shadow-lg animate-fade-in"
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-orange-500 shrink-0" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
};
