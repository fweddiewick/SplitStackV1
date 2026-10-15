import React, { useState, useId } from 'react';
import { useApp } from '../context/AppContext';
import { CardMethod, MethodType, MemberId, BillingCycleType } from '../types';

interface PaymentMethodsViewProps {
  onOpenAddModal: () => void;
  onOpenManageMembers?: () => void;
}

export const PaymentMethodsView: React.FC<PaymentMethodsViewProps> = ({
  onOpenAddModal,
  onOpenManageMembers,
}) => {
  const {
    paymentMethods,
    members,
    expenses,
    updatePaymentMethod,
    deletePaymentMethod,
    setDefaultPayerMethod,
    resetToDefaultMethods,
    syncCardSpendWithExpenses,
    resetCardSpendTracker,
    selectedMonth,
    showToast,
  } = useApp();

  const uniqueId = useId();

  // State
  const [selectedCardId, setSelectedCardId] = useState<string>(
    paymentMethods[0]?.id || ''
  );
  const [filterMember, setFilterMember] = useState<'all' | MemberId>('all');

  // Currently editing card
  const activeCard = paymentMethods.find((c) => c.id === selectedCardId) || paymentMethods[0];

  // Form Fields mapped to activeCard
  const [formName, setFormName] = useState(activeCard?.name || 'HSBC Revolution');
  const [formMember, setFormMember] = useState<MemberId>(activeCard?.memberId || members[0]?.id || 'ryan');
  const [formType, setFormType] = useState<MethodType>(activeCard?.type || 'credit');
  const [formCycle, setFormCycle] = useState<BillingCycleType>(activeCard?.billingCycleType || 'calendar');
  const [formCycleDesc, setFormCycleDesc] = useState(activeCard?.billingCycleDesc || 'Calendar (1st - End of Month)');
  const [formCap, setFormCap] = useState(String(activeCard?.bonusCap || '1000'));
  const [formCurrentSpend, setFormCurrentSpend] = useState(String(activeCard?.currentSpend || '0'));
  const [formRounding, setFormRounding] = useState<number>(activeCard?.roundingBlock ?? 1);
  const [formBaseRate, setFormBaseRate] = useState(activeCard?.baseRate || '0.4 MPD');
  const [formBonusRate, setFormBonusRate] = useState(activeCard?.bonusRate || '4.0 MPD (10X Points)');
  const [formExclusions, setFormExclusions] = useState(activeCard?.keyExclusions || '');
  const [formCategories, setFormCategories] = useState<string[]>(activeCard?.eligibleCategories || ['dining', 'online_shopping']);

  const handleSelectCard = (card: CardMethod) => {
    setSelectedCardId(card.id);
    setFormName(card.name);
    setFormMember(card.memberId);
    setFormType(card.type);
    setFormCycle(card.billingCycleType);
    setFormCycleDesc(card.billingCycleDesc || (card.billingCycleType === 'calendar' ? 'Calendar (1st - End of Month)' : 'Statement Date (TBD)'));
    setFormCap(String(card.bonusCap ?? 0));
    setFormCurrentSpend(String(card.currentSpend ?? 0));
    setFormRounding(card.roundingBlock);
    setFormBaseRate(card.baseRate);
    setFormBonusRate(card.bonusRate);
    setFormExclusions(card.keyExclusions || '');
    setFormCategories(card.eligibleCategories || []);
  };

  const handleCategoryToggle = (cat: string) => {
    if (formCategories.includes(cat)) {
      setFormCategories(formCategories.filter((c) => c !== cat));
    } else {
      setFormCategories([...formCategories, cat]);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard) return;

    updatePaymentMethod(activeCard.id, {
      name: formName,
      memberId: formMember,
      type: formType,
      billingCycleType: formCycle,
      billingCycleDesc: formCycleDesc,
      bonusCap: parseFloat(formCap) || 0,
      currentSpend: parseFloat(formCurrentSpend) || 0,
      roundingBlock: formRounding as 5 | 1 | 0,
      baseRate: formBaseRate,
      bonusRate: formBonusRate,
      keyExclusions: formExclusions,
      eligibleCategories: formCategories,
    });
    showToast(`Updated ${formName} rules & settings!`, 'save');
  };

  const handleSetDefault = () => {
    if (activeCard) {
      setDefaultPayerMethod(activeCard.id);
    }
  };

  const handleReset = () => {
    if (activeCard) {
      handleSelectCard(activeCard);
      showToast('Form reset to card saved values.');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Remove ${name} from household configuration?`)) {
      deletePaymentMethod(id);
    }
  };

  const filteredCards = paymentMethods.filter((c) => {
    if (filterMember === 'all') return true;
    return c.memberId === filterMember;
  });

  return (
    <div className="flex flex-col w-full h-full max-h-full overflow-hidden select-none font-body text-[#264D59] text-xs leading-tight justify-between">
      {/* 1. Compact Top Workspace Header */}
      <div className="shrink-0 flex items-center justify-between pb-2 mb-1 border-b-2 border-[#264D59] bg-[#FCF9F3]/90 backdrop-blur-sm p-2 shadow-[2px_2px_0px_#264D59]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-[#264D59] text-white flex items-center justify-center font-headline font-bold border-2 border-[#264D59] shadow-[2px_2px_0px_#F9E07F] shrink-0">
            <span className="material-symbols-outlined text-base">credit_card</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-headline font-bold uppercase tracking-tight text-[#264D59] truncate">
              PAYMENT METHODS &amp; HOUSEHOLD PAYER CONFIGURATION
            </h1>
            <p className="text-[10px] font-label font-medium uppercase tracking-wider text-[#41484b] truncate">
              MANAGE CARDS, REWARD CAPS &amp; BILLING CYCLES • {paymentMethods.length} ACTIVE METHODS
            </p>
          </div>
        </div>

        {/* Quick Stats & Top CTA */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <button
            onClick={() => syncCardSpendWithExpenses(selectedMonth)}
            className="flex items-center gap-1 bg-[#F9E07F] hover:bg-[#F9AD6A] text-[#264D59] border-2 border-[#264D59] px-2 py-1 text-[11px] font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
            title="Recalculate and match all card spend counters with expenses logged in ledger"
          >
            <span className="material-symbols-outlined text-sm font-bold">sync_alt</span>
            <span className="hidden sm:inline">Match Expenses Log</span>
            <span className="sm:hidden">Match Log</span>
          </button>
          <button
            onClick={() => {
              if (window.confirm('Reset all card spend counters to $0.00 and restore 100% of spending caps?')) {
                resetCardSpendTracker();
              }
            }}
            className="flex items-center gap-1 bg-[#F0EEE8] hover:bg-white text-[#264D59] border-2 border-[#264D59] px-2 py-1 text-[11px] font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
            title="Reset all card spend counters to $0.00"
          >
            <span className="material-symbols-outlined text-sm font-bold">restart_alt</span>
            <span className="hidden lg:inline">Reset Spend ($0)</span>
          </button>
          <button
            onClick={resetToDefaultMethods}
            className="flex items-center gap-1 bg-[#F0EEE8] hover:bg-[#F9E07F] text-[#264D59] border-2 border-[#264D59] px-2 py-1 text-[11px] font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
            title="Restore 11 official Singapore cards (HSBC, UOB, OCBC, DBS, Citi, PayNow, Debit)"
          >
            <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
            <span className="hidden sm:inline">Reset 11 Defaults</span>
          </button>
          <button
            onClick={onOpenManageMembers}
            className="hidden md:flex items-center gap-1.5 bg-[#F0EEE8] hover:bg-[#F9E07F] text-[#264D59] border-2 border-[#264D59] px-2.5 py-1 text-xs font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
          >
            <span className="material-symbols-outlined text-sm">group</span>
            <span>Members ({members.length})</span>
          </button>
          <button
            onClick={onOpenAddModal}
            className="px-2.5 py-1 bg-[#F9E07F] text-[#264D59] font-headline font-bold text-[11px] uppercase tracking-wider border-2 border-[#264D59] shadow-[2px_2px_0px_#264D59] hover:bg-[#264D59] hover:text-[#F9E07F] transition-all flex items-center gap-1 active:translate-x-[1px] active:translate-y-[1px]"
          >
            <span className="material-symbols-outlined text-sm font-bold">add</span>
            <span>+ Add Method</span>
          </button>
        </div>
      </div>

      {/* 2. Two-Column Workspace (55% / 45%) */}
      <div className="flex-1 min-h-0 flex gap-2.5 overflow-hidden">
        {/* LEFT COLUMN: CONFIGURED METHODS LIST (55% width) */}
        <div className="w-full lg:w-[55%] flex flex-col h-full min-h-0 bg-[#FCF9F3] border-2 border-[#264D59] shadow-[3px_3px_0px_#264D59] p-2">
          {/* Section subhead + filter toggles */}
          <div className="shrink-0 flex items-center justify-between pb-1.5 mb-1.5 border-b-2 border-[#264D59]">
            <div className="flex items-center gap-1.5">
              <span className="font-headline font-bold uppercase tracking-wide text-xs text-[#264D59]">
                Configured Payment Methods
              </span>
              <span className="bg-[#264D59] text-white px-1.5 py-0.2 text-[10px] font-label font-bold border border-[#264D59]">
                {filteredCards.length} ACTIVE
              </span>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-label">
              <span className="text-[#41484b] font-bold">Filter:</span>
              <button
                onClick={() => setFilterMember('all')}
                className={`px-1.5 py-0.5 font-bold border border-[#264D59] uppercase transition-colors ${
                  filterMember === 'all'
                    ? 'bg-[#264D59] text-white'
                    : 'bg-[#F0EEE8] text-[#264D59] hover:bg-[#F9E07F]'
                }`}
              >
                All
              </button>
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setFilterMember(m.id)}
                  className={`px-1.5 py-0.5 font-bold border border-[#264D59] uppercase transition-colors ${
                    filterMember === m.id
                      ? 'bg-[#264D59] text-white'
                      : 'bg-[#F0EEE8] text-[#264D59] hover:bg-[#F9E07F]'
                  }`}
                >
                  {m.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Dense Cards Matrix */}
          <div className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-y-auto pr-1">
            {filteredCards.map((card, idx) => {
              const isSelected = card.id === (activeCard?.id || '');
              const memberObj = members.find((m) => m.id === card.memberId);

              return (
                <div
                  key={card.id}
                  onClick={() => handleSelectCard(card)}
                  className={`group relative cursor-pointer border-2 border-[#264D59] p-2 transition-all ${
                    isSelected
                      ? 'bg-[#F9E07F] shadow-[2px_2px_0px_#264D59]'
                      : 'bg-[#FCF9F3] hover:bg-[#F0EEE8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-headline font-bold text-xs uppercase tracking-tight flex items-center gap-1 text-[#264D59] truncate">
                        <span className="material-symbols-outlined text-sm font-bold">
                          credit_card
                        </span>
                        {idx + 1}. {card.name}
                      </span>

                      <span className="bg-white border border-[#264D59] px-1 text-[9px] font-label font-bold uppercase text-[#264D59]">
                        {card.type}
                      </span>

                      <span className="bg-[#264D59] text-white px-1 text-[9px] font-label uppercase">
                        {card.network} •• {card.last4}
                      </span>

                      {card.isDefaultPayer && (
                        <span className="text-[9px] font-label font-bold bg-[#D46C4E] text-white px-1">
                          Active Payer
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-label text-[10px] font-bold text-[#264D59]">
                        {memberObj?.name || card.memberId}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCard(card);
                        }}
                        className="hover:bg-[#264D59] hover:text-white p-0.5 text-[#264D59]"
                        title="Edit in Editor"
                      >
                        <span className="material-symbols-outlined text-xs">edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(card.id, card.name);
                        }}
                        className="hover:bg-[#D46C4E] hover:text-white p-0.5 text-[#264D59]"
                        title="Delete Card"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Grid */}
                  <div className="mt-1 grid grid-cols-3 gap-1.5 text-[10px] font-label bg-white/80 p-1 border border-[#264D59]/50">
                    <div>
                      <span className="text-[#41484b]">Cycle:</span>{' '}
                      <strong className="text-[#264D59]">{card.billingCycleDesc}</strong>
                    </div>
                    <div>
                      <span className="text-[#41484b]">Cap:</span>{' '}
                      <strong className="text-[#264D59]">
                        {card.bonusCap > 0 ? `$${card.bonusCap} SGD` : 'Uncapped'}
                      </strong>
                    </div>
                    <div className="truncate">
                      <span className="text-[#41484b]">Rate:</span>{' '}
                      <strong className="text-[#264D59]">{card.bonusRate}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: RULES & CONFIGURATION EDITOR (45% width) */}
        <div className="w-full lg:w-[45%] flex flex-col h-full min-h-0 bg-[#FCF9F3] border-2 border-[#264D59] shadow-[3px_3px_0px_#264D59] p-2.5 justify-between">
          {/* Panel Header */}
          <div className="shrink-0 flex items-center justify-between pb-1.5 border-b-2 border-[#264D59]">
            <div className="flex items-center gap-1.5">
              <span className="font-headline font-bold uppercase tracking-wider text-xs text-[#264D59]">
                Method Configuration &amp; Rules Editor
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-label uppercase bg-[#F9E07F] text-[#264D59] px-1.5 py-0.2 border border-[#264D59] font-bold">
                Editing ID: {activeCard?.badgeCode || 'CFG-01'}
              </span>
            </div>
          </div>

          {/* Config Form Container */}
          {activeCard ? (
            <form onSubmit={handleSaveConfig} className="flex-1 min-h-0 flex flex-col justify-between py-1.5 gap-2 overflow-y-auto">
              {/* Row 1: Name and Assigned Member (Dynamic members) */}
              <div className="grid grid-cols-12 gap-2 shrink-0">
                <div className="col-span-7 flex flex-col">
                  <label htmlFor={`cfgMethodName-${uniqueId}`} className="font-headline font-bold text-[10px] uppercase tracking-wider text-[#264D59] flex items-center justify-between">
                    <span>Method Name</span>
                    <span className="text-[9px] text-[#41484b] font-normal">Last 4: {activeCard.last4}</span>
                  </label>
                  <input
                    id={`cfgMethodName-${uniqueId}`}
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white border-2 border-[#264D59] px-2 py-1 font-headline font-bold text-xs uppercase focus:bg-[#F9E07F]/40 focus:outline-none text-[#264D59]"
                  />
                </div>

                <div className="col-span-5 flex flex-col">
                  <label htmlFor={`cfgMemberSelect-${uniqueId}`} className="font-headline font-bold text-[10px] uppercase tracking-wider text-[#264D59]">
                    Household Member
                  </label>
                  <select
                    id={`cfgMemberSelect-${uniqueId}`}
                    value={formMember}
                    onChange={(e) => setFormMember(e.target.value)}
                    className="w-full bg-white border-2 border-[#264D59] px-1.5 py-1 font-label text-[11px] font-bold focus:bg-[#F9E07F]/40 focus:outline-none text-[#264D59]"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.role === 'lead' ? '(Lead)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Method Type Segmented Buttons */}
              <div className="shrink-0 flex flex-col">
                <span className="font-headline font-bold text-[10px] uppercase tracking-wider text-[#264D59] mb-0.5">
                  Method Type &amp; Rail
                </span>
                <div className="grid grid-cols-3 gap-1 text-[10px] font-label font-bold text-center">
                  {(['credit', 'debit', 'giro'] as MethodType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      className={`py-1 border-2 border-[#264D59] uppercase transition-colors ${
                        formType === t ? 'bg-[#264D59] text-white' : 'bg-[#F0EEE8] text-[#264D59] hover:bg-[#F9E07F]'
                      }`}
                    >
                      {t === 'giro' ? 'GIRO / Bank' : `${t} Card`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: Billing & Reward Cycle Rules */}
              <div className="shrink-0 p-1.5 bg-[#F6F3ED] border-2 border-[#264D59] flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-headline font-bold text-[10px] uppercase tracking-wider text-[#264D59]">
                    Billing &amp; Reward Cycle
                  </span>
                  <span className="text-[9px] font-label text-[#41484b]">T&amp;C Reset Type</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-label">
                  <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1 border border-[#264D59]">
                    <input
                      type="radio"
                      name="cycleRadio"
                      checked={formCycle === 'calendar'}
                      onChange={() => {
                        setFormCycle('calendar');
                        if (!formCycleDesc.includes('Statement')) {
                          setFormCycleDesc('Calendar (1st - End of Month)');
                        }
                      }}
                      className="accent-[#264D59]"
                    />
                    <div>
                      <strong className="block uppercase text-[#264D59]">Calendar Month</strong>
                      <span className="text-[9px] text-[#41484b]">1st to last calendar day</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1 border border-[#264D59]">
                    <input
                      type="radio"
                      name="cycleRadio"
                      checked={formCycle === 'statement'}
                      onChange={() => {
                        setFormCycle('statement');
                        if (!formCycleDesc || formCycleDesc.includes('Calendar')) {
                          setFormCycleDesc('Statement Date (15th - 14th)');
                        }
                      }}
                      className="accent-[#264D59]"
                    />
                    <div>
                      <strong className="block uppercase text-[#264D59]">Statement Cycle</strong>
                      <span className="text-[9px] text-[#41484b]">Custom statement reset</span>
                    </div>
                  </label>
                </div>
                <div className="flex items-center gap-1.5 bg-white p-1 border border-[#264D59]">
                  <span className="text-[9px] font-headline font-bold uppercase text-[#41484b] shrink-0">Cycle Note:</span>
                  <input
                    type="text"
                    value={formCycleDesc}
                    onChange={(e) => setFormCycleDesc(e.target.value)}
                    placeholder="e.g. Statement Date (15th - 14th) or Calendar (1st - End)"
                    className="w-full text-[10px] font-label font-bold text-[#264D59] focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 4: Spend Target / Cap & Rounding Block & Current Spend */}
              <div className="grid grid-cols-12 gap-1.5 shrink-0">
                <div className="col-span-4 flex flex-col">
                  <label htmlFor={`cfgSpendCap-${uniqueId}`} className="font-headline font-bold text-[9px] uppercase tracking-wider text-[#264D59]">
                    Cap / Target
                  </label>
                  <div className="flex items-center bg-white border-2 border-[#264D59] px-1.5 py-0.5">
                    <span className="font-headline font-bold text-[10px] mr-1 text-[#41484b]">$</span>
                    <input
                      id={`cfgSpendCap-${uniqueId}`}
                      type="number"
                      value={formCap}
                      onChange={(e) => setFormCap(e.target.value)}
                      className="w-full font-headline font-bold text-xs focus:outline-none text-[#264D59]"
                    />
                  </div>
                  <span className="text-[8px] font-label text-[#41484b]">0 if uncapped</span>
                </div>

                <div className="col-span-4 flex flex-col">
                  <label htmlFor={`cfgCurrentSpend-${uniqueId}`} className="font-headline font-bold text-[9px] uppercase tracking-wider text-[#264D59]">
                    Month Spend
                  </label>
                  <div className="flex items-center bg-white border-2 border-[#264D59] px-1.5 py-0.5">
                    <span className="font-headline font-bold text-[10px] mr-1 text-[#41484b]">$</span>
                    <input
                      id={`cfgCurrentSpend-${uniqueId}`}
                      type="number"
                      step="0.01"
                      value={formCurrentSpend}
                      onChange={(e) => setFormCurrentSpend(e.target.value)}
                      className="w-full font-headline font-bold text-xs focus:outline-none text-[#264D59]"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[8px] font-label text-[#41484b]">
                    <span>Current ledger spend</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cardExpenses = expenses.filter((e) => e.paymentMethodId === activeCard?.id);
                        const total = cardExpenses.reduce((s, e) => s + e.amount, 0);
                        setFormCurrentSpend(total.toFixed(2));
                        showToast(`Calculated $${total.toFixed(2)} from ${cardExpenses.length} logged expenses.`);
                      }}
                      className="text-[#264D59] hover:underline font-bold flex items-center gap-0.5 uppercase cursor-pointer"
                      title="Sync spend for this card from expenses log"
                    >
                      <span className="material-symbols-outlined text-[10px]">sync</span>
                      Match Log
                    </button>
                  </div>
                </div>

                <div className="col-span-4 flex flex-col">
                  <label htmlFor={`cfgRoundingSelect-${uniqueId}`} className="font-headline font-bold text-[9px] uppercase tracking-wider text-[#264D59]">
                    Rounding Rule
                  </label>
                  <select
                    id={`cfgRoundingSelect-${uniqueId}`}
                    value={formRounding}
                    onChange={(e) => setFormRounding(parseInt(e.target.value))}
                    className="w-full bg-white border-2 border-[#264D59] px-1 py-1 font-label text-[10px] font-bold focus:bg-[#F9E07F]/40 focus:outline-none text-[#264D59]"
                  >
                    <option value={5}>$5 Blocks (UOB/OCBC)</option>
                    <option value={1}>$1 Blocks (Citi/HSBC)</option>
                    <option value={0}>Exact Cents</option>
                  </select>
                  <span className="text-[8px] font-label text-[#41484b]">Multipliers unit</span>
                </div>
              </div>

              {/* Row 5: Rate Specification & Exclusions */}
              <div className="shrink-0 flex flex-col gap-1 bg-[#F0EEE8] p-1.5 border-2 border-[#264D59]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor={`cfgBaseRate-${uniqueId}`} className="font-label font-bold text-[9px] uppercase text-[#264D59]">Base Rate:</label>
                    <input
                      id={`cfgBaseRate-${uniqueId}`}
                      type="text"
                      value={formBaseRate}
                      onChange={(e) => setFormBaseRate(e.target.value)}
                      className="font-headline font-bold text-xs bg-white px-1.5 py-0.5 border border-[#264D59] text-[#264D59] w-24 text-right"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor={`cfgBonusRate-${uniqueId}`} className="font-label font-bold text-[9px] uppercase text-[#264D59]">Bonus Rate:</label>
                    <input
                      id={`cfgBonusRate-${uniqueId}`}
                      type="text"
                      value={formBonusRate}
                      onChange={(e) => setFormBonusRate(e.target.value)}
                      className="font-headline font-bold text-xs bg-[#F9E07F] px-1.5 py-0.5 border border-[#264D59] text-[#264D59] w-24 text-right"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-0.5 pt-1 border-t border-[#264D59]/30">
                  <span className="text-[9px] font-headline font-bold uppercase text-[#41484b] shrink-0">Exclusions:</span>
                  <input
                    type="text"
                    value={formExclusions}
                    onChange={(e) => setFormExclusions(e.target.value)}
                    placeholder="e.g. Supermarkets (5411), Utilities, AXS, Tax, E-wallets"
                    className="w-full bg-white px-1.5 py-0.5 text-[9px] font-label text-[#264D59] border border-[#264D59] focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 6: Auto-Route Eligible Categories */}
              <div className="shrink-0 flex flex-col">
                <span className="font-headline font-bold text-[10px] uppercase tracking-wider text-[#264D59] mb-0.5">
                  Auto-Route Eligible Categories
                </span>
                <div className="grid grid-cols-2 gap-1 text-[9px] font-label">
                  {[
                    { id: 'dining', label: 'Dining & Restaurants (MCC 5812)' },
                    { id: 'online_food', label: 'Online Food Delivery (Grab/Panda)' },
                    { id: 'online_shopping', label: 'Online Shopping (Shopee/Lazada)' },
                    { id: 'groceries', label: 'Groceries & Supermarkets (5411)' },
                    { id: 'travel', label: 'Travel & Flights (SIA/Scoot/Hotels)' },
                    { id: 'transport', label: 'Public Transit & Rides (SimplyGo)' },
                    { id: 'utilities', label: 'Utilities & SP Services GIRO' },
                    { id: 'general', label: 'General / All Other Eligible' },
                  ].map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-1.5 bg-white p-1 border border-[#264D59] cursor-pointer hover:bg-[#F0EEE8]"
                    >
                      <input
                        type="checkbox"
                        checked={formCategories.includes(item.id)}
                        onChange={() => handleCategoryToggle(item.id)}
                        className="accent-[#264D59]"
                      />
                      <span className="font-bold text-[#264D59] truncate">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Row 7: Form Actions */}
              <div className="shrink-0 flex items-center justify-between pt-1 border-t-2 border-[#264D59] gap-2 mt-auto">
                <button
                  type="button"
                  onClick={handleSetDefault}
                  className="px-2.5 py-1.5 bg-[#F0EEE8] font-headline font-bold text-[10px] uppercase border-2 border-[#264D59] hover:bg-[#F9E07F] flex items-center gap-1 text-[#264D59]"
                >
                  <span className="material-symbols-outlined text-xs">star</span>
                  <span>Set as Default Payer</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2.5 py-1.5 bg-white text-[#264D59] font-headline font-bold text-[10px] uppercase border-2 border-[#264D59] hover:bg-[#D46C4E] hover:text-white transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#264D59] text-white font-headline font-bold text-xs uppercase tracking-wider border-2 border-[#264D59] shadow-[2px_2px_0px_#F9E07F] hover:bg-[#43978D] hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">save</span>
                    <span>Save Configuration</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="p-4 text-center text-xs font-bold text-[#41484b]">
              No card selected.
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Household Configuration Bar (Dynamic Members) */}
      <div className="shrink-0 mt-2 bg-[#FCF9F3]/90 backdrop-blur-sm border-2 border-[#264D59] px-3 py-1.5 flex items-center justify-between font-label text-[10px] shadow-[2px_2px_0px_#264D59]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-headline font-bold uppercase tracking-wider text-[#264D59]">
              Household Allocation ({members.length}):
            </span>
            {members.map((m) => {
              const cardCount = paymentMethods.filter((c) => c.memberId === m.id).length;
              return (
                <span
                  key={m.id}
                  className={`px-1.5 py-0.5 border border-[#264D59] ${
                    m.role === 'lead' ? 'bg-white font-bold text-[#264D59]' : 'bg-[#F0EEE8] text-[#264D59]'
                  }`}
                >
                  {m.name} ({m.role === 'lead' ? 'Lead' : 'Member'}, {cardCount} {cardCount === 1 ? 'Card' : 'Cards'})
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-[#264D59]">
            <span className="font-bold uppercase text-[#264D59]">Currency:</span>
            <span className="font-headline font-bold text-[#264D59]">SGD ($)</span>
          </div>
          <div className="flex items-center gap-1 text-[#41484b]">
            <span className="w-1.5 h-1.5 bg-[#43978D] rounded-full"></span>
            <span className="font-medium text-[#264D59]">Engine: Dynamic Storage Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
