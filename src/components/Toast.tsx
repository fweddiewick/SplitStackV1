import React from 'react';
import { useApp } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toast } = useApp();

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-10 right-4 sm:right-8 z-50 bg-[#FCF9F3] border-2 border-[#264D59] px-4 py-2.5 shadow-[4px_4px_0px_#264D59] flex items-center gap-2.5 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
      role="status"
      aria-live="polite"
    >
      <span className="material-symbols-outlined text-[#43978D] font-bold text-lg">
        {toast.icon || 'check_circle'}
      </span>
      <span className="font-headline text-xs font-bold uppercase tracking-tight text-[#264D59]">
        {toast.message}
      </span>
    </div>
  );
};
