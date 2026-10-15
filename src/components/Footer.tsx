import React from 'react';

export const Footer: React.FC = () => {
  const currentTimeString = 'Oct 28, 2024, 08:30 PM SGT';

  return (
    <footer className="h-7 w-full bg-[#FCF9F3]/95 backdrop-blur-sm border-t-2 border-[#264D59] px-3 md:px-4 flex items-center justify-between shrink-0 text-[10px] font-label text-[#264D59]/80 z-30 select-none">
      <div className="flex items-center gap-1.5 md:gap-2 truncate">
        <span className="font-headline font-bold uppercase tracking-tight text-[#264D59]">
          SplitStack SG
        </span>
        <span>•</span>
        <span className="hidden sm:inline">Zero Scroll Viewport Active</span>
        <span className="hidden sm:inline">•</span>
        <span className="truncate">Last computed: {currentTimeString}</span>
      </div>
      <div className="font-headline uppercase font-bold tracking-wider text-[#264D59] shrink-0 text-[9px] md:text-[10px]">
        Form Follows Function &copy; 2024
      </div>
    </footer>
  );
};
