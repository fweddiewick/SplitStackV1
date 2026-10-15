import React, { useState, useEffect, useId } from 'react';
import { useApp } from '../context/AppContext';
import { MemberId, SplitMode } from '../types';
import { searchMerchantMcc } from '../services/mccService';
import { calculateBestCard, CardRule } from '../utils/calculateBestCard';
import { formatDisplayDate, toIsoDateString } from '../utils/dateUtils';

export const LogExpenseView: React.FC = () => {
  const {
    members,
    paymentMethods,
    expenses,
    addExpense,
    deleteExpense,
    clearExpensesByMonth,
    selectedMonth,
    calculateSplit,
    calculateCardEligibility,
    setActiveTab,
    showToast,
  } = useApp();

  const uniqueId = useId();

  const [isManageLogsOpen, setIsManageLogsOpen] = useState(false);

  // Form State
  const [merchant, setMerchant] = useState('FairPrice Xtra VivoCity');
  const [mcc, setMcc] = useState('5411');
  const [isoDate, setIsoDate] = useState('2024-10-28');
  const [dateStr, setDateStr] = useState('28 Oct 2024');
  const [amount, setAmount] = useState('312.40');
  const [selectedTags, setSelectedTags] = useState<string[]>([
    'Groceries (MCC 5411)',
    'Supermarket',
  ]);
  const [payerId, setPayerId] = useState<MemberId>(members[0]?.id || 'ryan');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [pairMembers, setPairMembers] = useState<[string, string]>([
    members[0]?.id || 'ryan',
    members[1]?.id || 'sarah',
  ]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    paymentMethods[0]?.id || 'uob-one'
  );
  const [mccSearchSource, setMccSearchSource] = useState<string>('Live CheckMCC');

  // Custom percentages
  const [customWeights, setCustomWeights] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    const equalShare = Number((100 / (members.length || 1)).toFixed(2));
    members.forEach((m) => {
      init[m.id] = equalShare;
    });
    return init;
  });

  const numAmount = Math.max(0, parseFloat(amount.replace(/[^0-9.]/g, '')) || 0);

  // Debounced CheckMCC lookup when merchant name changes
  useEffect(() => {
    const trimmed = merchant.trim();
    if (!trimmed) return;

    const timer = setTimeout(async () => {
      try {
        const resp = await searchMerchantMcc(trimmed);
        if (resp.success && resp.data) {
          setMcc(resp.data.mcc);
          setMccSearchSource(resp.data.source === 'live_api' ? 'CheckMCC Live' : 'Verified Directory');

          // Recommend card using calculateBestCard utility
          const cardRules: CardRule[] = paymentMethods.map((c) => ({
            id: c.id,
            card_name: c.name,
            owner: c.memberId,
            base_earn_rate: c.baseRate,
            bonus_earn_rate: c.bonusRate,
            monthly_cap: c.bonusCap,
            rounding_rule: c.roundingBlock === 5 ? '5_sgd_block' : c.roundingBlock === 1 ? '1_sgd_block' : 'exact',
            eligible_mccs: c.eligibleCategories?.includes('groceries') ? ['5411'] : c.eligibleCategories?.includes('dining') ? ['5812', '5814'] : ['5311', '5651'],
            is_active: true,
          }));

          const spendMap: Record<string, number> = {};
          paymentMethods.forEach((c) => {
            spendMap[c.id] = c.currentSpend;
          });

          const rec = calculateBestCard(resp.data.mcc, cardRules, spendMap, numAmount || 100);
          if (rec.topCard?.card?.id) {
            setSelectedMethodId(rec.topCard.card.id);
          }
        }
      } catch (e) {
        // keep current
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [merchant, numAmount, paymentMethods]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Cent precision split preview across dynamic members
  const splitBreakdown = calculateSplit(
    numAmount,
    splitMode,
    payerId,
    splitMode === 'pair' ? pairMembers : undefined,
    splitMode === 'custom' ? customWeights : undefined
  );

  // Selected Card Intelligence
  const currentCard = paymentMethods.find((c) => c.id === selectedMethodId) || paymentMethods[0];
  const intel = currentCard
    ? calculateCardEligibility(currentCard, numAmount, mcc, selectedTags[0] || 'General')
    : {
        isEligible: true,
        eligibleAmount: numAmount,
        slippage: 0,
        isCapped: false,
        remainingHeadroom: 9999,
        projectedSpend: numAmount,
        message: 'No card selected',
        adviceType: 'ok' as const,
      };

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant.trim()) {
      showToast('Please enter a merchant or payee name', 'error');
      return;
    }
    if (numAmount <= 0) {
      showToast('Please enter a valid expense amount', 'error');
      return;
    }

    const finalIso = isoDate || toIsoDateString(dateStr);
    const finalDate = dateStr || formatDisplayDate(finalIso);

    addExpense({
      date: finalDate,
      isoDate: finalIso,
      merchant,
      mcc,
      category: selectedTags[0] ? selectedTags[0].split(' ')[0] : 'General',
      tags: selectedTags,
      amount: numAmount,
      payerId,
      paymentMethodId: selectedMethodId,
      splitMode,
      splitBreakdown,
      pairMemberIds: splitMode === 'pair' ? pairMembers : undefined,
      customWeights: splitMode === 'custom' ? customWeights : undefined,
      settled: false,
      eligibleBlocksAmount: intel.eligibleAmount,
      rewardEstimated: currentCard ? `${currentCard.name} • ${currentCard.bonusRate}` : 'General',
    });

    setActiveTab('settle');
  };

  const resetForm = () => {
    setMerchant('');
    setAmount('0.00');
    setMcc('5411');
    setSelectedTags(['Groceries (MCC 5411)']);
    setSplitMode('equal');
    showToast('Form fields cleared.');
  };

  const categoryChipList = [
    'Groceries (MCC 5411)',
    'Supermarket',
    'Online Spend',
    'Contactless / PayWave',
    'Dining / F&B',
    'Utilities / Recurring',
    'FCY / Overseas',
  ];

  return (
    <div className="flex flex-col w-full h-full max-h-full overflow-hidden select-none font-body justify-between gap-2.5">
      {/* Top Banner Bar */}
      <div className="shrink-0 flex items-center justify-between border-2 border-[#264D59] bg-[#FCF9F3] px-3.5 py-1.5 shadow-[3px_3px_0px_#264D59]">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center bg-[#264D59] text-[#F9E07F] px-2 py-0.5 text-xs font-headline font-bold uppercase tracking-wider">
            ENTRY {String(expenses.length + 1).padStart(3, '0')}
          </span>
          <div className="flex flex-col">
            <h1 className="font-headline font-bold text-sm tracking-tight uppercase leading-none text-[#264D59]">
              LOG EXPENSE &amp; MULTI-PARTY SPLIT
            </h1>
            <span className="text-[10px] font-headline font-medium text-[#41484b] tracking-wider uppercase mt-0.5">
              CHECKMCC API VALIDATION &bull; SUPABASE REWARD RULES
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsManageLogsOpen(true)}
            className="flex items-center gap-1.5 border-2 border-[#264D59] bg-[#F0EEE8] hover:bg-[#F9E07F] text-[#264D59] px-2.5 py-0.5 text-[10px] font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
            title="View, remove individual logged expenses, or clear by month"
          >
            <span className="material-symbols-outlined text-[13px] leading-none">delete_sweep</span>
            <span>Manage Logs ({expenses.length})</span>
          </button>
          <div className="flex items-center gap-1.5 border-2 border-[#264D59] bg-[#F9E07F] text-[#264D59] px-2 py-0.5 text-[10px] font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59]">
            <span className="material-symbols-outlined text-[13px] leading-none">autorenew</span>
            <span>CYCLE: {(selectedMonth || 'ACTIVE').toUpperCase()}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 border-2 border-[#264D59] bg-[#F0EEE8] px-2 py-0.5 text-[10px] font-headline font-bold uppercase text-[#264D59]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#43978D]"></span>
            <span>HYBRID ENGINE V3.4</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split Workspace (60% / 40%) */}
      <div className="flex-1 grid grid-cols-12 gap-2.5 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: 60% */}
        <div className="col-span-12 lg:col-span-7 flex flex-col border-2 border-[#264D59] bg-[#FCF9F3] p-3 gap-2 shadow-[3px_3px_0px_#264D59] overflow-hidden justify-between">
          {/* Sub-Header */}
          <div className="flex items-center justify-between pb-1.5 border-b-2 border-[#264D59] shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#264D59]">receipt_long</span>
              <span className="font-headline font-bold text-xs uppercase tracking-wider text-[#264D59]">
                TRANSACTION DETAILS &amp; SPLIT ALLOCATION
              </span>
            </div>
            <span className="text-[10px] font-headline font-bold text-[#D46C4E] uppercase bg-[#F9AD6A]/20 px-1.5 py-0.2 border border-[#264D59]">
              * REQUIRED FIELDS
            </span>
          </div>

          {/* Row 1: Merchant, Date, Amount */}
          <div className="grid grid-cols-12 gap-2 shrink-0">
            {/* Merchant Input */}
            <div className="col-span-12 sm:col-span-5 flex flex-col bg-[#FBF8F2] p-1.5 border-2 border-[#264D59]">
              <label
                htmlFor={`merchant-${uniqueId}`}
                className="text-[9px] font-headline font-bold uppercase text-[#41484b] flex items-center justify-between"
              >
                <span>Merchant / Payee</span>
                <span className="text-[#43978D] font-mono font-bold" title={mccSearchSource}>
                  MCC {mcc} &bull; {mccSearchSource}
                </span>
              </label>
              <input
                id={`merchant-${uniqueId}`}
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. FairPrice, Shopee, Singtel"
                className="w-full bg-transparent font-headline font-bold text-xs tracking-tight text-[#264D59] border-b-2 border-[#264D59] focus:outline-none focus:border-[#43978D] pt-0.5"
              />
            </div>

            {/* Date Input */}
            <div className="col-span-12 sm:col-span-3 flex flex-col bg-[#FBF8F2] p-1.5 border-2 border-[#264D59]">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`txDate-${uniqueId}`}
                  className="text-[9px] font-headline font-bold uppercase text-[#41484b]"
                >
                  Date
                </label>
                <input
                  type="date"
                  value={isoDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setIsoDate(e.target.value);
                      setDateStr(formatDisplayDate(e.target.value));
                    }
                  }}
                  className="w-4 h-4 cursor-pointer bg-transparent border-0 p-0 text-xs"
                  title="Pick transaction date"
                />
              </div>
              <input
                id={`txDate-${uniqueId}`}
                type="text"
                value={dateStr}
                onChange={(e) => {
                  setDateStr(e.target.value);
                  const parsed = toIsoDateString(e.target.value);
                  if (parsed) setIsoDate(parsed);
                }}
                className="w-full bg-transparent font-headline font-bold text-xs tracking-tight text-[#264D59] border-b-2 border-[#264D59] focus:outline-none focus:border-[#43978D] pt-0.5 uppercase"
              />
              {/* Quick month pills for easy testing */}
              <div className="flex items-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = '2024-10-28';
                    setIsoDate(d);
                    setDateStr(formatDisplayDate(d));
                  }}
                  className="text-[8px] font-mono px-1 py-0.2 bg-[#F0EEE8] hover:bg-[#F9E07F] border border-[#264D59]/40 text-[#264D59]"
                >
                  Oct '24
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = '2024-11-15';
                    setIsoDate(d);
                    setDateStr(formatDisplayDate(d));
                  }}
                  className="text-[8px] font-mono px-1 py-0.2 bg-[#F0EEE8] hover:bg-[#F9E07F] border border-[#264D59]/40 text-[#264D59]"
                >
                  Nov '24
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setIsoDate(today);
                    setDateStr(formatDisplayDate(today));
                  }}
                  className="text-[8px] font-mono px-1 py-0.2 bg-[#F0EEE8] hover:bg-[#F9E07F] border border-[#264D59]/40 text-[#264D59]"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Amount SGD Input */}
            <div className="col-span-7 sm:col-span-4 flex flex-col bg-[#F9E07F] p-1.5 border-2 border-[#264D59] shadow-[2px_2px_0px_#264D59]">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`totalAmount-${uniqueId}`}
                  className="text-[9px] font-headline font-bold uppercase text-[#264D59]"
                >
                  Total Amount (SGD)
                </label>
                <span className="text-[9px] font-mono bg-[#FCF9F3] text-[#264D59] px-1 border border-[#264D59] font-bold">
                  SGD
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-headline font-bold text-base mr-1 text-[#264D59]">$</span>
                <input
                  id={`totalAmount-${uniqueId}`}
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-transparent font-headline font-extrabold text-lg tracking-tight text-[#264D59] border-b-2 border-[#264D59] focus:outline-none leading-none"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Category Chips */}
          <div className="flex flex-col gap-1 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-headline font-bold uppercase text-[#41484b]">
                MCC Category Toggles:
              </span>
              <span className="text-[9px] font-mono text-[#41484b]">Auto-verified via CheckMCC</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {categoryChipList.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-0.5 text-[10px] font-headline font-bold uppercase border-2 border-[#264D59] transition-colors ${
                      isSelected
                        ? 'bg-[#264D59] text-white shadow-[1.5px_1.5px_0px_#264D59]'
                        : 'bg-[#FBF8F2] text-[#264D59] hover:bg-[#F9E07F]/40'
                    }`}
                  >
                    {isSelected ? `✓ ${tag}` : tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Paid By Selector */}
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-[9px] font-headline font-bold uppercase text-[#41484b]">
              Paid By (Household Member):
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-24 overflow-y-auto">
              {members.map((m) => {
                const isSelected = payerId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setPayerId(m.id)}
                    className={`cursor-pointer border-2 border-[#264D59] p-1.5 flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-[#F9E07F] shadow-[2px_2px_0px_#264D59]'
                        : 'bg-[#FBF8F2] hover:bg-[#F0EEE8]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-headline font-bold text-xs uppercase leading-none text-[#264D59] truncate">
                        {m.name}
                      </span>
                      <span
                        className={`w-3.5 h-3.5 rounded-full border border-[#264D59] flex items-center justify-center text-[9px] font-bold ${
                          isSelected ? 'bg-[#264D59] text-[#F9E07F]' : 'bg-white'
                        }`}
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[8px] font-label font-bold text-[#264D59] bg-[#FCF9F3] px-1 border border-[#264D59] uppercase">
                        {m.role === 'lead' ? 'LEAD' : 'MEMBER'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 4: Split Ratio Allocation Engine */}
          <div className="flex flex-col gap-1.5 bg-[#FBF8F2] p-2 border-2 border-[#264D59]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-headline font-bold uppercase text-[#41484b]">
                Split Ratio Allocation Engine:
              </span>
              <span className="text-[9px] font-headline font-bold bg-[#264D59] text-white px-1.5 py-0.2 uppercase">
                Cent Precision Engine
              </span>
            </div>

            {/* Split Mode Buttons */}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSplitMode('equal')}
                className={`border-2 border-[#264D59] px-2 py-1 text-[9px] font-headline font-bold uppercase tracking-tight text-center transition-all ${
                  splitMode === 'equal'
                    ? 'bg-[#264D59] text-white shadow-[1px_1px_0px_#264D59]'
                    : 'bg-[#FCF9F3] text-[#264D59] hover:bg-[#F0EEE8]'
                }`}
              >
                Equal All ({(100 / (members.length || 1)).toFixed(1)}%)
              </button>

              {members.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setSplitMode('pair');
                    setPairMembers([members[0].id, members[1].id]);
                  }}
                  className={`border-2 border-[#264D59] px-2 py-1 text-[9px] font-headline font-bold uppercase tracking-tight text-center transition-all ${
                    splitMode === 'pair'
                      ? 'bg-[#264D59] text-white shadow-[1px_1px_0px_#264D59]'
                      : 'bg-[#FCF9F3] text-[#264D59] hover:bg-[#F0EEE8]'
                  }`}
                >
                  Pair 50/50
                </button>
              )}

              <button
                type="button"
                onClick={() => setSplitMode('custom')}
                className={`border-2 border-[#264D59] px-2 py-1 text-[9px] font-headline font-bold uppercase tracking-tight text-center transition-all ${
                  splitMode === 'custom'
                    ? 'bg-[#264D59] text-white shadow-[1px_1px_0px_#264D59]'
                    : 'bg-[#FCF9F3] text-[#264D59] hover:bg-[#F0EEE8]'
                }`}
              >
                Custom %
              </button>
            </div>

            {/* Dynamic Breakdown Preview Blocks */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 border-t-2 border-[#264D59] mt-0.5 max-h-24 overflow-y-auto">
              {members.map((m) => {
                const share = splitBreakdown[m.id] || 0;
                const pct = numAmount > 0 ? ((share / numAmount) * 100).toFixed(1) : '0.0';

                return (
                  <div
                    key={m.id}
                    className="bg-[#FCF9F3] border-2 border-[#264D59] p-1.5 flex flex-col justify-between shadow-[1px_1px_0px_#264D59]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-headline font-bold uppercase text-[#264D59] truncate">
                        {m.name.split(' ')[0]}'s Share
                      </span>
                      <span className="text-[8px] font-mono bg-[#F9E07F]/60 px-1 border border-[#264D59] font-bold text-[#264D59]">
                        {pct}%
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-[9px] font-headline font-bold text-[#41484b]">SGD</span>
                      <span className="text-xs font-headline font-bold tracking-tight text-[#264D59]">
                        ${share.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 40% (Payment Method & Card Optimization) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col border-2 border-[#264D59] bg-[#FCF9F3] p-3 gap-2 shadow-[3px_3px_0px_#264D59] overflow-hidden justify-between">
          {/* Sub-Header */}
          <div className="flex items-center justify-between pb-1.5 border-b-2 border-[#264D59] shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#264D59]">credit_card</span>
              <span className="font-headline font-bold text-xs uppercase tracking-wider text-[#264D59]">
                PAYMENT METHOD &amp; CARD OPTIMIZATION
              </span>
            </div>
            <span className="text-[10px] font-headline font-bold bg-[#F9E07F] text-[#264D59] px-1.5 py-0.2 border border-[#264D59] uppercase">
              SUPABASE RULES ENGINE
            </span>
          </div>

          {/* Payment Method Selector Dropdown */}
          <div className="flex flex-col gap-1 shrink-0">
            <label htmlFor={`payInstrument-${uniqueId}`} className="text-[9px] font-headline font-bold uppercase text-[#41484b]">
              Selected Payment Instrument:
            </label>
            <div className="relative">
              <select
                id={`payInstrument-${uniqueId}`}
                value={selectedMethodId}
                onChange={(e) => setSelectedMethodId(e.target.value)}
                className="w-full bg-[#FBF8F2] border-2 border-[#264D59] px-2.5 py-1.5 font-headline font-bold text-xs uppercase text-[#264D59] shadow-[2px_2px_0px_#264D59] focus:outline-none appearance-none cursor-pointer"
              >
                {paymentMethods.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name.toUpperCase()} (•••• {card.last4} · {card.bank})
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-base text-[#264D59]">
                expand_more
              </span>
            </div>
          </div>

          {/* Real-time Card Intelligence Box */}
          <div className="flex-1 flex flex-col justify-between border-2 border-[#264D59] bg-[#FBF8F2] p-2.5 gap-2 overflow-y-auto">
            {currentCard ? (
              <>
                {/* Intel Header */}
                <div className="flex items-center justify-between border-b border-[#264D59] pb-1 shrink-0">
                  <span className="text-[10px] font-headline font-bold uppercase text-[#264D59] flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-[#43978D]">analytics</span>
                    Live MCC &amp; Spend Qualification Analysis
                  </span>
                  <span className="text-[9px] font-mono bg-[#43978D]/20 text-[#264D59] px-1 border border-[#264D59] font-bold">
                    {mcc} {intel.isEligible ? 'VALID' : 'NON-BONUS'}
                  </span>
                </div>

                {/* Line 1: MCC Rule Match */}
                <div className="flex items-start justify-between bg-[#FCF9F3] p-1.5 border border-[#264D59] gap-1.5 shrink-0">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-headline font-bold uppercase leading-tight text-[#264D59]">
                      MCC / Category Eligibility:
                    </span>
                    <span className="text-[9px] font-body text-[#41484b] leading-tight mt-0.5">
                      '{merchant}' verified as MCC {mcc}.{' '}
                      {intel.isEligible
                        ? `Qualifies for ${currentCard.bonusRate}.`
                        : `Ineligible for bonus tier; earns base ${currentCard.baseRate}.`}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-headline font-bold uppercase px-1 py-0.5 text-white shrink-0 border border-[#264D59] ${
                      intel.isEligible ? 'bg-[#43978D]' : 'bg-[#D46C4E]'
                    }`}
                  >
                    {intel.isEligible ? 'QUALIFIED' : 'EXCLUDED'}
                  </span>
                </div>

                {/* Line 2: $5 Block Rounding Simulation */}
                <div className="flex items-start justify-between bg-[#FCF9F3] p-1.5 border border-[#264D59] gap-1.5 shrink-0">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-headline font-bold uppercase leading-tight text-[#264D59]">
                        {currentCard.name} Rounding Check:
                      </span>
                      <span className="text-[8px] font-mono bg-[#F9AD6A]/30 text-[#264D59] border border-[#264D59] px-1 font-bold">
                        {currentCard.roundingBlock === 5 ? '$5 BLOCK RULE' : currentCard.roundingBlock === 1 ? '$1 ROUNDING' : 'NO ROUNDING'}
                      </span>
                    </div>
                    <span className="text-[9px] font-body text-[#41484b] leading-tight mt-0.5">
                      {currentCard.roundingBlock === 5 ? (
                        <>
                          SGD ${numAmount.toFixed(2)} rounded down to nearest $5 block ={' '}
                          <strong className="text-[#264D59]">
                            {Math.floor(numAmount / 5)} blocks × $5.00 = ${intel.eligibleAmount.toFixed(2)} eligible
                          </strong>
                          . (${intel.slippage.toFixed(2)} slippage).
                        </>
                      ) : (
                        <>
                          SGD ${numAmount.toFixed(2)} exact calculation. Slippage: ${intel.slippage.toFixed(2)}.
                        </>
                      )}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#264D59] shrink-0 self-center">
                    ${intel.eligibleAmount.toFixed(2)} ELIG
                  </span>
                </div>

                {/* Line 3: Spend Progress & Cap Impact */}
                <div className="flex flex-col bg-[#FCF9F3] p-1.5 border border-[#264D59] gap-1 shrink-0">
                  <div className="flex items-center justify-between text-[9px] font-headline font-bold uppercase text-[#264D59]">
                    <span>
                      {currentCard.name} ({currentCard.bonusCap > 0 ? `Cap: $${currentCard.bonusCap}` : 'Uncapped'}):
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        intel.isCapped ? 'text-[#D46C4E]' : 'text-[#43978D]'
                      }`}
                    >
                      {intel.isCapped
                        ? 'CAPPED'
                        : currentCard.bonusCap > 0
                        ? `${Math.min(100, (intel.projectedSpend / currentCard.bonusCap) * 100).toFixed(0)}% MET`
                        : 'UNCAPPED'}
                    </span>
                  </div>

                  {/* Progress Bar Brutalist */}
                  <div className="w-full h-3 bg-[#F0EEE8] border border-[#264D59] p-0.5">
                    <div
                      className={`h-full flex items-center justify-end pr-1 ${
                        intel.isCapped ? 'bg-[#D46C4E]' : 'bg-[#264D59]'
                      }`}
                      style={{
                        width: `${
                          currentCard.bonusCap > 0
                            ? Math.min(100, (intel.projectedSpend / currentCard.bonusCap) * 100)
                            : 50
                        }%`,
                      }}
                    >
                      <span className="text-[7px] font-mono text-[#F9E07F] font-bold">
                        ${intel.projectedSpend.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between text-[8px] font-mono text-[#41484b]">
                    <span>Current: ${currentCard.currentSpend.toFixed(2)}</span>
                    <span>+ This Txn: ${numAmount.toFixed(2)}</span>
                    <span className="font-bold text-[#264D59]">
                      New Total: ${intel.projectedSpend.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Strategy Alert Banner */}
                <div
                  className={`border-2 border-[#264D59] p-2 flex items-start gap-1.5 shrink-0 ${
                    intel.adviceType === 'capped'
                      ? 'bg-[#D46C4E]/20 text-[#264D59]'
                      : intel.adviceType === 'warning'
                      ? 'bg-[#F9AD6A]/30 text-[#264D59]'
                      : 'bg-[#F0EEE8] text-[#264D59]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm text-[#264D59] shrink-0 mt-0.5">
                    {intel.adviceType === 'capped' ? 'block' : intel.adviceType === 'warning' ? 'priority_high' : 'verified'}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-headline font-bold uppercase text-[#264D59] leading-tight">
                      {intel.adviceType === 'capped'
                        ? 'Card Capped Out Warning'
                        : intel.adviceType === 'warning'
                        ? 'Optimization Advice'
                        : 'Strategy Note'}
                    </span>
                    <p className="text-[9px] font-body text-[#264D59]/90 leading-tight mt-0.5">
                      {intel.message}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 text-center text-xs font-bold text-[#41484b]">
                No payment method available. Please add a card in Payment Methods.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Strip & Status Ticker */}
      <div className="shrink-0 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3 border-2 border-[#264D59] bg-[#FCF9F3] p-2 shadow-[3px_3px_0px_#264D59]">
          {/* Reset Button */}
          <button
            type="button"
            onClick={resetForm}
            className="border-2 border-[#264D59] bg-[#FBF8F2] hover:bg-[#F0EEE8] text-[#264D59] font-headline font-bold text-xs uppercase px-4 py-2 transition-all shadow-[1.5px_1.5px_0px_#264D59] flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-[#264D59]">restart_alt</span>
            <span>Cancel / Reset Form</span>
          </button>

          {/* Center Status Ticker (Clickable to open management modal) */}
          <button
            type="button"
            onClick={() => setIsManageLogsOpen(true)}
            className="hidden xl:flex items-center gap-2 text-[10px] font-mono text-[#41484b] hover:bg-[#F9E07F]/40 px-2 py-1 border border-dashed border-[#264D59]/50 transition-all cursor-pointer overflow-hidden truncate"
            title="Click to view and manage logged expenses"
          >
            <span className="font-headline font-bold uppercase text-[#264D59] bg-[#F9E07F] px-1.5 py-0.5 border border-[#264D59] shrink-0">
              RECENT LOGS ({expenses.length}):
            </span>
            <span className="truncate text-[#264D59]">
              {expenses.slice(0, 4).map((e) => `${e.merchant.split(' ')[0]} ($${e.amount.toFixed(2)})`).join(' • ')}
            </span>
            <span className="text-[9px] uppercase font-bold text-[#D46C4E] underline shrink-0 ml-1">
              Manage &bull; Clear
            </span>
          </button>

          {/* Primary Action CTA */}
          <button
            type="button"
            onClick={handleSubmit}
            className="border-2 border-[#264D59] bg-[#264D59] hover:bg-[#1f3f49] text-white font-headline font-extrabold text-xs uppercase tracking-wider px-6 py-2 shadow-[2.5px_2.5px_0px_#1A1A1A] flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <span className="material-symbols-outlined text-base text-[#F9E07F]">check_circle</span>
            <span>LOG EXPENSE &amp; UPDATE LEDGER</span>
          </button>
        </div>
      </div>

      {/* Manage Household Logged Expenses Modal */}
      {isManageLogsOpen && (
        <div className="fixed inset-0 z-50 bg-[#264D59]/60 backdrop-blur-[2px] flex items-center justify-center p-3 md:p-6">
          <div className="bg-[#FCF9F3] border-4 border-[#264D59] shadow-[6px_6px_0px_#264D59] w-full max-w-3xl max-h-[85vh] flex flex-col justify-between font-body text-xs text-[#264D59]">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between border-b-2 border-[#264D59] p-3 bg-[#F0EEE8]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-[#264D59]">manage_history</span>
                <div>
                  <h2 className="font-headline font-bold text-sm uppercase tracking-wide text-[#264D59]">
                    Household Logged Expenses &bull; {selectedMonth}
                  </h2>
                  <span className="text-[10px] font-label text-[#41484b]">
                    {expenses.length} TOTAL LOGGED TRANSACTIONS IN LEDGER
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Clear all logged expenses for ${selectedMonth}?\n\nThis will remove the transactions and refund card spend limits.`
                      )
                    ) {
                      clearExpensesByMonth(selectedMonth);
                    }
                  }}
                  className="flex items-center gap-1 bg-[#D46C4E] hover:bg-[#b85437] text-white border-2 border-[#264D59] px-2.5 py-1 text-xs font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
                >
                  <span className="material-symbols-outlined text-sm font-bold">delete_sweep</span>
                  <span>Clear All for {selectedMonth}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsManageLogsOpen(false)}
                  className="hover:bg-[#D46C4E] hover:text-white px-2 py-0.5 border border-[#264D59] font-bold text-xs text-[#264D59]"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Expenses List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {expenses.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-[#41484b]">
                  No logged expenses in ledger yet. Log a transaction using the form!
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {expenses.map((exp) => {
                    const card = paymentMethods.find((c) => c.id === exp.paymentMethodId);
                    const payer = members.find((m) => m.id === exp.payerId);

                    return (
                      <div
                        key={exp.id}
                        className="bg-white border-2 border-[#264D59] p-2 flex items-center justify-between gap-3 shadow-[1.5px_1.5px_0px_#264D59] hover:bg-[#F9E07F]/10 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-[#41484b] shrink-0 w-20">
                            {exp.date}
                          </span>
                          <div className="min-w-0">
                            <span className="font-headline font-bold text-xs uppercase text-[#264D59] truncate block">
                              {exp.merchant}
                            </span>
                            <span className="text-[10px] font-mono text-[#43978D]">
                              MCC {exp.mcc} • Paid by {payer?.name || exp.payerId} via {card?.name || exp.paymentMethodId}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-headline font-bold text-sm text-[#264D59]">
                            ${exp.amount.toFixed(2)} SGD
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete expense "${exp.merchant}" ($${exp.amount.toFixed(2)})?\n\nThis will restore ${card?.name || 'card'} spend limits.`
                                )
                              ) {
                                deleteExpense(exp.id);
                              }
                            }}
                            className="flex items-center gap-1 bg-[#F0EEE8] hover:bg-[#D46C4E] hover:text-white text-[#264D59] border border-[#264D59] px-2 py-1 text-[10px] font-headline font-bold uppercase transition-all shadow-[1px_1px_0px_#264D59]"
                            title="Delete this transaction"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-between border-t-2 border-[#264D59] p-2.5 bg-[#F0EEE8]">
              <span className="text-[10px] font-mono text-[#41484b]">
                Deletions automatically refund credit card caps and update net balances in real time.
              </span>
              <button
                type="button"
                onClick={() => setIsManageLogsOpen(false)}
                className="px-4 py-1 bg-[#264D59] hover:bg-[#1f3f49] text-white border-2 border-[#264D59] font-headline font-bold text-xs uppercase"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
