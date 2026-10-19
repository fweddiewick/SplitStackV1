import React from 'react';
import { useApp } from '../context/AppContext';

export const Footer: React.FC = () => {
  const { isCloudSynced, syncStatusDetails, setIsSyncModalOpen } = useApp();

  return (
    <footer className="h-7 w-full bg-[#FCF9F3]/95 backdrop-blur-sm border-t-2 border-[#264D59] px-3 md:px-4 flex items-center justify-between shrink-0 text-[10px] font-label text-[#264D59]/80 z-30 select-none">
      <div className="flex items-center gap-1.5 md:gap-2 truncate">
        <span className="font-headline font-bold uppercase tracking-tight text-[#264D59]">
          SplitStack SG
        </span>
        <span>•</span>
        <button
          onClick={() => setIsSyncModalOpen(true)}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-[#F9E07F]/40 border border-transparent hover:border-[#264D59]/30 transition-colors cursor-pointer text-left truncate"
          title="Click to check database health, view errors, or configure cross-device sync"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isCloudSynced ? 'bg-[#43978D] animate-pulse' : 'bg-[#D46C4E]'
            }`}
          ></span>
          <span className="font-bold truncate">
            {syncStatusDetails ||
              (isCloudSynced
                ? 'Cloud Database Connected • Desktop & Mobile Synced'
                : 'Local Mode • Click to configure Supabase sync')}
          </span>
          <span className="material-symbols-outlined text-[11px] opacity-70">settings</span>
        </button>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setIsSyncModalOpen(true)}
          className="font-headline uppercase font-bold text-[9px] md:text-[10px] text-[#264D59] hover:underline cursor-pointer flex items-center gap-0.5"
        >
          <span className="material-symbols-outlined text-[10px]">cloud_sync</span>
          Sync Settings
        </button>
      </div>
    </footer>
  );
};
