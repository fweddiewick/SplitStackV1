import React from 'react';
import { useApp } from '../context/AppContext';

export const Footer: React.FC = () => {
  const { isCloudSynced } = useApp();

  return (
    <footer className="h-7 w-full bg-[#FCF9F3]/95 backdrop-blur-sm border-t-2 border-[#264D59] px-3 md:px-4 flex items-center justify-between shrink-0 text-[10px] font-label text-[#264D59]/80 z-30 select-none">
      <div className="flex items-center gap-1.5 md:gap-2 truncate">
        <span className="font-headline font-bold uppercase tracking-tight text-[#264D59]">
          SplitStack SG
        </span>
        <span>•</span>
        <div className="flex items-center gap-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isCloudSynced ? 'bg-[#43978D] animate-pulse' : 'bg-[#D46C4E]'
            }`}
          ></span>
          <span className="font-bold">
            {isCloudSynced
              ? 'Supabase Database Connected • Desktop & Mobile Synced'
              : 'Local Mode • Connect Supabase on Vercel to sync across devices'}
          </span>
        </div>
      </div>
      <div className="font-headline uppercase font-bold tracking-wider text-[#264D59] shrink-0 text-[9px] md:text-[10px]">
        Form Follows Function &copy; 2024
      </div>
    </footer>
  );
};
