import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PRESET_CARDS_CATALOG } from '../data/initialData';

export const CardStrategyView: React.FC<{ onOpenConfigureCard: (cardId?: string) => void }> = ({
  onOpenConfigureCard,
}) => {
  const {
    paymentMethods,
    expenses,
    addPaymentMethod,
    syncData,
    syncCardSpendWithExpenses,
    resetCardSpendTracker,
    clearExpensesByMonth,
    selectedMonth,
    showToast,
    recommendBestCard,
  } = useApp();
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'non-credit'>('all');

  const creditCards = paymentMethods.filter((c) => c.type === 'credit' || c.type === 'credit+debit');
  const nonCreditCards = paymentMethods.filter((c) => c.type !== 'credit' && c.type !== 'credit+debit');

  const displayedCards = paymentMethods.filter((c) => {
    if (filterType === 'credit') return c.type === 'credit' || c.type === 'credit+debit';
    if (filterType === 'non-credit') return c.type !== 'credit' && c.type !== 'credit+debit';
    return true;
  });

  const monthExpenses = selectedMonth
    ? expenses.filter((e) => {
        const parts = selectedMonth.split(' ');
        const mon = parts[0] || '';
        const yr = parts[1] || '';
        return (
          (e.date && e.date.toLowerCase().includes(mon.toLowerCase()) && (!yr || e.date.includes(yr))) ||
          (e.isoDate && yr && e.isoDate.startsWith(yr))
        );
      })
    : [];
  const totalMonthSpend = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleAddPreset = (presetName: string) => {
    const template = PRESET_CARDS_CATALOG.find((p) => p.name === presetName);
    if (template) {
      addPaymentMethod({
        ...template,
        currentSpend: 0.0,
      });
      setShowPresetMenu(false);
      showToast(`Imported ${template.name} (${template.bonusRate}) into your stack!`);
    }
  };

  // Dynamic Routing Recommendations based on user added cards
  const onlineRec = recommendBestCard('Shopee', '5311', 100);
  const diningRec = recommendBestCard('Hai Di Lao', '5812', 100);
  const utilRec = recommendBestCard('SP Group Utilities', '4900', 100);

  return (
    <div className="flex flex-col w-full h-full max-h-full overflow-hidden select-none gap-2 font-body">
      {/* Top Bar: Compact Strategy Header & Control Capsules */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#FCF9F3] border-2 border-[#264D59] shadow-[3px_3px_0px_#264D59]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#F9E07F] text-[#264D59] border-2 border-[#264D59] flex items-center justify-center font-headline font-bold text-base shadow-[1.5px_1.5px_0px_#264D59]">
            SG
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline font-bold text-sm tracking-tight text-[#264D59] uppercase leading-none">
                SG Credit Card Strategy &amp; Spend Caps
              </span>
              <span className="bg-[#264D59] text-[#FDF6DC] text-[9px] font-label font-bold px-1.5 py-0.5 uppercase tracking-wider">
                11 SG Methods
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-label text-[10px] text-[#264D59]/75 font-medium uppercase tracking-wide">
                4.0 MPD Ceiling &amp; Tiered Cashback Engine • {selectedMonth || 'NO CYCLE'}
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 border ${
                  monthExpenses.length > 0
                    ? 'bg-[#43978D]/15 text-[#43978D] border-[#43978D]/40 font-bold'
                    : 'bg-[#D46C4E]/10 text-[#D46C4E] border-[#D46C4E]/30 font-bold'
                }`}
              >
                {monthExpenses.length > 0
                  ? `Matched: ${monthExpenses.length} txns ($${totalMonthSpend.toFixed(2)})`
                  : 'Log Cleared: 100% Caps Reset ($0 spent)'}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-[#F0EEE8] border border-[#264D59] p-0.5 text-[10px] font-label">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 font-bold uppercase transition-all ${
                filterType === 'all' ? 'bg-[#264D59] text-white shadow-[1px_1px_0px_#264D59]' : 'text-[#264D59] hover:bg-[#F9E07F]'
              }`}
            >
              All ({paymentMethods.length})
            </button>
            <button
              onClick={() => setFilterType('credit')}
              className={`px-2 py-0.5 font-bold uppercase transition-all ${
                filterType === 'credit' ? 'bg-[#264D59] text-white shadow-[1px_1px_0px_#264D59]' : 'text-[#264D59] hover:bg-[#F9E07F]'
              }`}
            >
              Credit ({creditCards.length})
            </button>
            <button
              onClick={() => setFilterType('non-credit')}
              className={`px-2 py-0.5 font-bold uppercase transition-all ${
                filterType === 'non-credit' ? 'bg-[#264D59] text-white shadow-[1px_1px_0px_#264D59]' : 'text-[#264D59] hover:bg-[#F9E07F]'
              }`}
            >
              Debit/Non-Credit ({nonCreditCards.length})
            </button>
          </div>

          {/* Spend Tracker Sync & Reset Actions */}
          <button
            onClick={() => syncCardSpendWithExpenses(selectedMonth)}
            className="flex items-center gap-1 bg-[#F9E07F] hover:bg-[#F9AD6A] text-[#264D59] border-2 border-[#264D59] px-2.5 py-1 text-[11px] font-headline font-bold uppercase tracking-wider shadow-[2px_2px_0px_#264D59] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            title="Recalculate every card's spend and reset caps to match the expenses log"
          >
            <span className="material-symbols-outlined text-sm font-bold leading-none">sync_alt</span>
            <span className="hidden sm:inline">Match Expenses Log</span>
            <span className="sm:hidden">Match Log</span>
          </button>

          {monthExpenses.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(`Clear all ${monthExpenses.length} expenses for ${selectedMonth} and reset all card limits & caps to 100%?`)) {
                  clearExpensesByMonth(selectedMonth);
                }
              }}
              className="flex items-center gap-1 bg-[#D46C4E]/15 hover:bg-[#D46C4E] text-[#D46C4E] hover:text-white border-2 border-[#D46C4E] px-2 py-1 text-[11px] font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
              title={`Clear all expenses for ${selectedMonth} and reset caps`}
            >
              <span className="material-symbols-outlined text-sm font-bold leading-none">delete_sweep</span>
              <span className="hidden md:inline">Clear Month &amp; Reset</span>
            </button>
          )}

          <button
            onClick={() => {
              if (window.confirm('Reset all card spend to $0.00 and restore 100% of spending caps across all cards?')) {
                resetCardSpendTracker();
              }
            }}
            className="flex items-center gap-1 bg-[#F0EEE8] hover:bg-white text-[#264D59] border-2 border-[#264D59] px-2 py-1 text-[11px] font-headline font-bold uppercase tracking-wider shadow-[2px_2px_0px_#264D59] transition-all"
            title="Reset all card spend counters to $0.00 and restore caps"
          >
            <span className="material-symbols-outlined text-sm font-bold leading-none">restart_alt</span>
            <span className="hidden md:inline">Reset Caps to $0</span>
          </button>

          <button
            onClick={() => onOpenConfigureCard()}
            className="flex items-center gap-1 bg-[#264D59] text-[#FCF9F3] hover:bg-[#F9E07F] hover:text-[#264D59] border-2 border-[#264D59] px-2.5 py-1 text-[11px] font-headline font-bold uppercase tracking-wider shadow-[2px_2px_0px_#264D59] transition-all"
          >
            <span className="material-symbols-outlined text-sm font-bold leading-none">add_box</span>
            <span>Configure Card</span>
          </button>
        </div>
      </div>

      {/* Main Cards Viewport: High-Density Horizontally Panned Neo-Brutalist Grid */}
      <div className="flex-1 grid grid-flow-col auto-cols-[minmax(230px,280px)] md:auto-cols-[minmax(250px,1fr)] gap-2 min-h-0 overflow-x-auto overflow-y-hidden pb-1">
        {displayedCards.map((card) => {
          const isUOBOne = card.id === 'uob-one';
          const isAltitude = card.bonusCap === 0;
          const isCapped = card.bonusCap > 0 && card.currentSpend >= card.bonusCap;
          const isNear = card.bonusCap > 0 && !isCapped && card.bonusCap - card.currentSpend <= 150;
          const spendPct = card.bonusCap > 0 ? (card.currentSpend / card.bonusCap) * 100 : 45;
          const remainingHeadroom = card.bonusCap > 0 ? card.bonusCap - card.currentSpend : 0;

          let badgeText = card.statusTag || 'Active';
          let badgeBg = card.statusTagBg || '#264D59';
          let badgeColor = 'text-white';

          if (isUOBOne) {
            badgeText = 'Tiered Rebate';
            badgeBg = '#264D59';
            badgeColor = 'text-[#F9E07F]';
          } else if (isCapped) {
            badgeText = 'Capped Out';
            badgeBg = '#D46C4E';
          } else if (isNear) {
            badgeText = 'Near Limit';
            badgeBg = '#F9AD6A';
            badgeColor = 'text-[#264D59]';
          } else if (isAltitude) {
            badgeText = 'Uncapped';
            badgeBg = '#E5E2DC';
            badgeColor = 'text-[#264D59]';
          }

          return (
            <div
              key={card.id}
              onClick={() => onOpenConfigureCard(card.id)}
              className="bg-[#FCF9F3] border-2 border-[#264D59] flex flex-col justify-between p-2.5 shadow-[3px_3px_0px_#264D59] relative group hover:-translate-y-0.5 transition-transform overflow-hidden cursor-pointer"
            >
              {/* Corner Tag */}
              <div
                className={`absolute top-0 right-0 ${badgeColor} text-[8px] font-label font-bold px-2 py-0.5 uppercase border-b-2 border-l-2 border-[#264D59]`}
                style={{ backgroundColor: badgeBg }}
              >
                {badgeText}
              </div>

              {/* Upper Section */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 border border-[#264D59]" style={{ backgroundColor: badgeBg }}></div>
                  <span className="text-[10px] font-label font-bold text-[#264D59]/80 uppercase tracking-wider">
                    {card.bank}
                  </span>
                </div>

                <h3 className="font-headline font-bold text-base leading-tight text-[#264D59] tracking-tight uppercase truncate">
                  {card.name}
                </h3>
                <p className="text-[10px] font-body text-[#41484b] leading-tight line-clamp-1">
                  {card.cardSubtitle}
                </p>

                {/* Spend Target Box */}
                <div className="mt-1 bg-[#F0EEE8] border-2 border-[#264D59] p-1.5 flex flex-col gap-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-label text-[9px] uppercase font-bold text-[#41484b]">
                      {isAltitude ? 'Month Spend' : 'Spent / Cap'}
                    </span>
                    <span className={`font-headline font-bold text-sm ${isCapped ? 'text-[#D46C4E]' : 'text-[#264D59]'}`}>
                      ${card.currentSpend.toFixed(2)}{' '}
                      {!isAltitude && (
                        <span className="text-[10px] text-[#41484b]">/ ${card.bonusCap}</span>
                      )}
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-[#E5E2DC] border border-[#264D59] h-3 flex overflow-hidden">
                    {isUOBOne ? (
                      <>
                        <div className="bg-[#264D59] h-full" style={{ width: '80%' }}></div>
                        <div className="bg-[#F9E07F] h-full" style={{ width: '20%' }}></div>
                      </>
                    ) : (
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(100, spendPct)}%`,
                          backgroundColor: isCapped ? '#D46C4E' : isNear ? '#F9AD6A' : isAltitude ? '#264D59' : '#43978D',
                        }}
                      ></div>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-label">
                    <span className="text-[#264D59] font-semibold truncate">
                      {isUOBOne
                        ? 'Min: $1,000.00'
                        : isAltitude
                        ? 'No Max Cap'
                        : isCapped
                        ? `+SGD $${(card.currentSpend - card.bonusCap).toFixed(0)} Over`
                        : card.currentSpend === 0
                        ? `$${card.bonusCap.toFixed(2)} Headroom (100% Free)`
                        : `$${remainingHeadroom.toFixed(2)} Headroom`}
                    </span>
                    <span
                      className={`font-bold px-1 border border-[#264D59]/40 ${
                        isCapped
                          ? 'bg-[#D46C4E] text-white'
                          : isNear
                          ? 'bg-[#F9AD6A] text-[#264D59]'
                          : isUOBOne
                          ? 'bg-[#F9E07F] text-[#264D59]'
                          : card.currentSpend === 0 && card.bonusCap > 0
                          ? 'bg-[#43978D]/20 text-[#43978D]'
                          : 'bg-[#FCF9F3] text-[#264D59]'
                      }`}
                    >
                      {isUOBOne
                        ? '123.6% MET'
                        : isAltitude
                        ? 'FALLBACK ACTIVE'
                        : isCapped
                        ? `${spendPct.toFixed(1)}% OVER`
                        : card.currentSpend === 0 && card.bonusCap > 0
                        ? '0.0% (RESET)'
                        : `${spendPct.toFixed(1)}% USED`}
                    </span>
                  </div>
                </div>

                {/* Metric Details */}
                <div className="space-y-1 text-[10px] font-body border-t border-[#264D59]/25 pt-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[#41484b]">Billing Cycle:</span>
                    <span className="font-label font-bold text-[#264D59] truncate max-w-[120px]">
                      {card.billingCycleDesc}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#41484b]">Bonus Rate:</span>
                    <span className="font-label font-bold text-[#264D59]">{card.bonusRate}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#41484b]">Rounding Rule:</span>
                    <span className="font-label font-bold text-[#264D59]">
                      {card.roundingBlock === 5 ? '$5 Block' : card.roundingBlock === 1 ? '$1 Exact' : 'Exact Cents'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Callout */}
              <div
                className={`mt-2 border-2 border-[#264D59] p-1.5 flex items-start gap-1.5 ${
                  isCapped
                    ? 'bg-[#D46C4E] text-white'
                    : isNear
                    ? 'bg-[#F9AD6A] text-[#264D59]'
                    : 'bg-[#F0EEE8] text-[#264D59]'
                }`}
              >
                <span className="material-symbols-outlined text-sm font-bold shrink-0 mt-0.5">
                  {card.footerIcon}
                </span>
                <span className="text-[9px] font-label font-bold uppercase tracking-tight leading-tight">
                  {card.footerAdvice}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Strategy & Routing Matrix Panel (Dynamic from user-added cards) */}
      <div className="shrink-0 bg-[#FCF9F3] border-2 border-[#264D59] p-2.5 shadow-[3px_3px_0px_#264D59] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Recommendation Columns */}
        <div className="flex-1 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="shrink-0 flex items-center gap-1.5 pr-2 lg:border-r-2 lg:border-[#264D59]">
            <span className="material-symbols-outlined text-xl text-[#264D59] font-bold">alt_route</span>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-xs uppercase tracking-tight text-[#264D59]">
                Routing Matrix
              </span>
              <span className="text-[8px] font-label font-bold uppercase text-[#264D59]/70">
                Live Recommender Engine
              </span>
            </div>
          </div>

          {/* Category Pills (Dynamic best cards from user added methods) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
            {/* Online & Travel */}
            <div className="bg-[#FBF8F2] border border-[#264D59] px-2 py-1 flex flex-col justify-center">
              <div className="flex items-center justify-between text-[9px] font-label">
                <span className="font-bold uppercase text-[#41484b]">1. Online &amp; E-Commerce</span>
                <span className="font-bold text-[#264D59]">{onlineRec?.card?.bonusRate || '4.0 MPD'}</span>
              </div>
              <div className="text-[11px] font-headline font-bold text-[#264D59] truncate mt-0.5">
                {onlineRec?.card?.name || 'Citi Rewards'} ({onlineRec?.remainingHeadroom ? `$${onlineRec.remainingHeadroom.toFixed(0)} left` : 'Active'})
              </div>
            </div>

            {/* Dining & Supermarkets */}
            <div className="bg-[#FBF8F2] border border-[#264D59] px-2 py-1 flex flex-col justify-center">
              <div className="flex items-center justify-between text-[9px] font-label">
                <span className="font-bold uppercase text-[#41484b]">2. Dining &amp; Groceries</span>
                <span className="font-bold text-[#43978D]">{diningRec?.card?.bonusRate || '4.0 MPD'}</span>
              </div>
              <div className="text-[11px] font-headline font-bold text-[#264D59] truncate mt-0.5">
                {diningRec?.card?.name || 'HSBC Revolution'} <span className="text-[#43978D] font-bold">(${diningRec?.remainingHeadroom?.toFixed(0) || '751'} headroom)</span>
              </div>
            </div>

            {/* Utilities & GIRO */}
            <div className="bg-[#FBF8F2] border border-[#264D59] px-2 py-1 flex flex-col justify-center">
              <div className="flex items-center justify-between text-[9px] font-label">
                <span className="font-bold uppercase text-[#41484b]">3. SP Group &amp; Utilities</span>
                <span className="font-bold text-[#264D59]">{utilRec?.card?.bonusRate || '5% Cash'}</span>
              </div>
              <div className="text-[11px] font-headline font-bold text-[#264D59] truncate mt-0.5">
                {utilRec?.card?.name || 'UOB One Card'} <span className="text-[#264D59]/80 font-normal">(Min Spend Secured)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Preset Quick-Add Strip */}
        <div className="shrink-0 flex items-center gap-2 border-t md:border-t-0 md:border-l-2 border-[#264D59] pt-2 md:pt-0 md:pl-3">
          <div className="relative">
            <button
              onClick={() => setShowPresetMenu(!showPresetMenu)}
              className="flex items-center gap-1.5 bg-[#F9E07F] hover:bg-[#F9AD6A] text-[#264D59] border-2 border-[#264D59] px-3 py-1.5 text-xs font-headline font-bold uppercase tracking-wider shadow-[2px_2px_0px_#264D59] transition-all"
            >
              <span className="material-symbols-outlined text-sm font-bold">library_add</span>
              <span>SG Presets</span>
              <span className="material-symbols-outlined text-xs">arrow_drop_down</span>
            </button>

            {/* Dropdown Presets */}
            {showPresetMenu && (
              <div className="absolute right-0 bottom-full mb-1 w-64 bg-[#FCF9F3] border-2 border-[#264D59] shadow-[4px_4px_0px_#264D59] z-50 p-1 flex flex-col gap-1">
                <div className="px-2 py-1 border-b border-[#264D59] text-[9px] font-label font-bold uppercase text-[#264D59]/75">
                  Popular Singapore Card Templates
                </div>
                {PRESET_CARDS_CATALOG.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleAddPreset(preset.name)}
                    className="w-full text-left p-1.5 hover:bg-[#F9E07F]/30 border border-transparent hover:border-[#264D59] text-[11px] font-headline font-bold uppercase flex justify-between items-center text-[#264D59]"
                  >
                    <span>{preset.name}</span>
                    <span className="text-[9px] font-label text-[#43978D] font-bold">
                      {preset.bonusRate}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={syncData}
            className="p-1.5 bg-[#FCF9F3] hover:bg-[#F9E07F] border-2 border-[#264D59] shadow-[2px_2px_0px_#264D59] flex items-center justify-center transition-colors"
            title="Refresh MCC spend data"
          >
            <span className="material-symbols-outlined text-sm font-bold text-[#264D59]">sync</span>
          </button>
        </div>
      </div>
    </div>
  );
};
