import React, { useState, useId, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CardMethod, MethodType, MemberId, BillingCycleType } from '../types';
import { lookupCardCategories, ALL_SG_CATEGORIES, CategoryOption } from '../services/cardCategoryLookup';
import { getCardStatementCycleWindow } from '../utils/dateUtils';

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
    pushLocalDataToCloud,
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
  const [formStartDay, setFormStartDay] = useState<number>(activeCard?.statementStartDay ?? 1);
  const [formEndDay, setFormEndDay] = useState<number>(activeCard?.statementEndDay ?? 31);
  const [formCap, setFormCap] = useState(String(activeCard?.bonusCap || '1000'));
  const [formCurrentSpend, setFormCurrentSpend] = useState(String(activeCard?.currentSpend || '0'));
  const [formRounding, setFormRounding] = useState<number>(activeCard?.roundingBlock ?? 1);
  const [formBaseRate, setFormBaseRate] = useState(activeCard?.baseRate || '0.4 MPD');
  const [formBonusRate, setFormBonusRate] = useState(activeCard?.bonusRate || '4.0 MPD (10X Points)');
  const [formExclusions, setFormExclusions] = useState(activeCard?.keyExclusions || '');
  const [formCategories, setFormCategories] = useState<string[]>(activeCard?.eligibleCategories || ['dining', 'online_shopping']);

  // Category lookup & dynamic categories state
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);
  const [categoryFetchNotice, setCategoryFetchNotice] = useState<string | null>(null);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>(ALL_SG_CATEGORIES);

  // Sync state when active card changes
  useEffect(() => {
    if (activeCard) {
      handleSelectCard(activeCard);
    }
  }, [activeCard?.id]);

  const handleSelectCard = (card: CardMethod) => {
    setSelectedCardId(card.id);
    setFormName(card.name);
    setFormMember(card.memberId);
    setFormType(card.type);
    setFormCycle(card.billingCycleType);
    setFormCycleDesc(card.billingCycleDesc || (card.billingCycleType === 'calendar' ? 'Calendar (1st - End of Month)' : 'Statement Date (15th - 14th)'));
    setFormStartDay(card.statementStartDay ?? (card.billingCycleType === 'statement' ? 15 : 1));
    setFormEndDay(card.statementEndDay ?? (card.billingCycleType === 'statement' ? 14 : 31));
    setFormCap(String(card.bonusCap ?? 0));
    setFormCurrentSpend(String(card.currentSpend ?? 0));
    setFormRounding(card.roundingBlock);
    setFormBaseRate(card.baseRate);
    setFormBonusRate(card.bonusRate);
    setFormExclusions(card.keyExclusions || '');
    setFormCategories(card.eligibleCategories || []);
    setCategoryFetchNotice(null);

    // Ensure any custom categories already on the card are represented in availableCategories
    if (card.eligibleCategories) {
      setAvailableCategories((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newOnes: CategoryOption[] = [];
        card.eligibleCategories.forEach((catId) => {
          if (!existingIds.has(catId)) {
            newOnes.push({
              id: catId,
              label: catId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
              mccExamples: 'Custom Card Category',
            });
          }
        });
        return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
      });
    }
  };

  const handleCategoryToggle = (catId: string) => {
    if (formCategories.includes(catId)) {
      setFormCategories(formCategories.filter((c) => c !== catId));
    } else {
      setFormCategories([...formCategories, catId]);
    }
  };

  // Online / AI & Singapore Knowledge Base Category Lookup
  const handleFetchOnlineCategories = async () => {
    if (!formName.trim()) {
      showToast('Please enter a card name to fetch categories', 'warning');
      return;
    }

    setIsFetchingCategories(true);
    setCategoryFetchNotice(null);

    try {
      const res = await lookupCardCategories(formName);

      // Add any newly retrieved categories to available list
      setAvailableCategories((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const toAdd = res.categories.filter((c) => !existingIds.has(c.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });

      // Update formCategories with the fetched category IDs
      const fetchedIds = res.categories.map((c) => c.id);
      setFormCategories(fetchedIds);

      // Also suggest rates if present
      if (res.bonusRate && !formBonusRate) setFormBonusRate(res.bonusRate);
      if (res.baseRate && !formBaseRate) setFormBaseRate(res.baseRate);
      if (res.keyExclusions && !formExclusions) setFormExclusions(res.keyExclusions);

      const notice = res.notes || `Retrieved ${res.categories.length} categories for ${res.cardName}. Review and uncheck any that do not belong.`;
      setCategoryFetchNotice(notice);
      showToast(`Fetched ${res.categories.length} eligible categories for ${formName}!`, 'online_prediction');
    } catch (err: any) {
      console.warn('Category fetch error:', err);
      showToast('Could not fetch online categories, keeping current list.', 'warning');
    } finally {
      setIsFetchingCategories(false);
    }
  };

  // Add custom category
  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customCategoryInput.trim();
    if (!clean) return;

    const id = clean.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (!availableCategories.some((c) => c.id === id)) {
      const newOption: CategoryOption = {
        id,
        label: clean,
        mccExamples: 'User Defined Custom Category',
      };
      setAvailableCategories((prev) => [...prev, newOption]);
    }

    if (!formCategories.includes(id)) {
      setFormCategories((prev) => [...prev, id]);
    }

    setCustomCategoryInput('');
    showToast(`Added custom category "${clean}"!`, 'add');
  };

  // Statement cycle presets
  const handleApplyCyclePreset = (start: number, end: number, label: string) => {
    setFormCycle('statement');
    setFormStartDay(start);
    setFormEndDay(end);
    setFormCycleDesc(label);
    showToast(`Cycle set: ${label} (Resets on the ${start}th)`, 'calendar_month');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard) return;

    const start = formCycle === 'statement' ? Math.max(1, Math.min(31, formStartDay)) : 1;
    const end = formCycle === 'statement' ? Math.max(1, Math.min(31, formEndDay)) : 31;

    updatePaymentMethod(activeCard.id, {
      name: formName,
      memberId: formMember,
      type: formType,
      billingCycleType: formCycle,
      billingCycleDesc: formCycleDesc,
      statementStartDay: start,
      statementEndDay: end,
      bonusCap: parseFloat(formCap) || 0,
      currentSpend: parseFloat(formCurrentSpend) || 0,
      roundingBlock: formRounding as 5 | 1 | 0,
      baseRate: formBaseRate,
      bonusRate: formBonusRate,
      keyExclusions: formExclusions,
      eligibleCategories: formCategories,
    });
    showToast(`Saved ${formName}! Statement reset date & categories synced across devices.`, 'save');
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
    if (confirm(`Remove ${name} from household configuration and sync removal to cloud?`)) {
      deletePaymentMethod(id);
    }
  };

  const filteredCards = paymentMethods.filter((c) => {
    if (filterMember === 'all') return true;
    return c.memberId === filterMember;
  });

  // Calculate live preview for current form cycle
  const previewCycleWindow = getCardStatementCycleWindow({
    billingCycleType: formCycle,
    statementStartDay: formStartDay,
    statementEndDay: formEndDay,
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
              PAYMENT METHODS &amp; STATEMENT CYCLE CONFIGURATION
            </h1>
            <p className="text-[10px] font-label font-medium uppercase tracking-wider text-[#41484b] truncate">
              CARDS SYNCED TO SUPABASE • INDEPENDENT STATEMENT RESET DATES • {paymentMethods.length} ACTIVE METHODS
            </p>
          </div>
        </div>

        {/* Quick Stats & Top CTA */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <button
            onClick={() => pushLocalDataToCloud()}
            className="flex items-center gap-1 bg-[#43978D] hover:bg-[#264D59] text-white border-2 border-[#264D59] px-2 py-1 text-[11px] font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
            title="Push local payment methods and transactions to Supabase to ensure everything is synced across devices"
          >
            <span className="material-symbols-outlined text-sm font-bold">cloud_upload</span>
            <span className="hidden sm:inline">Sync Cloud</span>
          </button>

          <button
            onClick={() => syncCardSpendWithExpenses(selectedMonth)}
            className="flex items-center gap-1 bg-[#F9E07F] hover:bg-[#F9AD6A] text-[#264D59] border-2 border-[#264D59] px-2 py-1 text-[11px] font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
            title="Recalculate card spend counters matching their exact statement cycles from expenses log"
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
            title="Restore official Singapore cards templates (HSBC, UOB, OCBC, DBS, Citi, PayNow)"
          >
            <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
            <span className="hidden sm:inline">Reset Defaults</span>
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

      {/* 2. Two-Column Workspace (50% / 50%) */}
      <div className="flex-1 min-h-0 flex gap-2.5 overflow-hidden">
        {/* LEFT COLUMN: CONFIGURED METHODS LIST (50% width) */}
        <div className="w-full lg:w-[48%] flex flex-col h-full min-h-0 bg-[#FCF9F3] border-2 border-[#264D59] shadow-[3px_3px_0px_#264D59] p-2">
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
              const cycleWindow = getCardStatementCycleWindow(card);

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
                          Default Payer
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

                  {/* Summary Grid with Statement Cycle and Reset Days */}
                  <div className="mt-1 grid grid-cols-12 gap-1 text-[10px] font-label bg-white/80 p-1 border border-[#264D59]/50">
                    <div className="col-span-5 truncate">
                      <span className="text-[#41484b]">Cycle:</span>{' '}
                      <strong className="text-[#264D59]">
                        {card.billingCycleType === 'statement'
                          ? `${card.statementStartDay || 15}th – ${card.statementEndDay || 14}th`
                          : '1st – End of Month'}
                      </strong>
                    </div>
                    <div className="col-span-4 truncate">
                      <span className="text-[#41484b]">Cap:</span>{' '}
                      <strong className="text-[#264D59]">
                        {card.bonusCap > 0 ? `$${card.bonusCap}` : 'Uncapped'}
                      </strong>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className={`px-1 py-0.2 font-bold text-[9px] border ${
                        cycleWindow.resetInDays <= 3
                          ? 'bg-[#D46C4E] text-white border-[#D46C4E]'
                          : 'bg-[#F9E07F] text-[#264D59] border-[#264D59]'
                      }`}>
                        Resets in {cycleWindow.resetInDays}d
                      </span>
                    </div>
                  </div>

                  {/* Category Pills Preview */}
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] font-label font-bold text-[#41484b]">
                      Categories ({card.eligibleCategories?.length || 0}):
                    </span>
                    {(card.eligibleCategories || []).slice(0, 4).map((cat) => (
                      <span
                        key={cat}
                        className="bg-white border border-[#264D59]/40 text-[#264D59] px-1 text-[8px] font-label uppercase truncate max-w-[90px]"
                      >
                        {cat.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {(card.eligibleCategories?.length || 0) > 4 && (
                      <span className="text-[8px] font-label font-bold text-[#264D59]">
                        +{(card.eligibleCategories?.length || 0) - 4} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: RULES & CONFIGURATION EDITOR (52% width) */}
        <div className="w-full lg:w-[52%] flex flex-col h-full min-h-0 bg-[#FCF9F3] border-2 border-[#264D59] shadow-[3px_3px_0px_#264D59] p-2.5 justify-between">
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
            <form onSubmit={handleSaveConfig} className="flex-1 min-h-0 flex flex-col justify-between py-1.5 gap-2 overflow-y-auto pr-0.5">
              {/* Row 1: Name and Assigned Member */}
              <div className="grid grid-cols-12 gap-2 shrink-0">
                <div className="col-span-7 flex flex-col">
                  <label htmlFor={`cfgMethodName-${uniqueId}`} className="font-headline font-bold text-[10px] uppercase tracking-wider text-[#264D59] flex items-center justify-between">
                    <span>Card / Method Name</span>
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

              {/* Row 3: Billing & Statement Cycle Rules (Statement Start Day & End Day Capture & Reset Engine) */}
              <div className="shrink-0 p-2 bg-[#F6F3ED] border-2 border-[#264D59] flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm font-bold text-[#264D59]">calendar_month</span>
                    <span className="font-headline font-bold text-[10px] uppercase tracking-wider text-[#264D59]">
                      Statement Date &amp; Cap Reset Cycle
                    </span>
                  </div>
                  <span className="text-[9px] font-label font-bold text-[#43978D] bg-white px-1.5 border border-[#264D59]">
                    Resets in {previewCycleWindow.resetInDays} days
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-label">
                  <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1 border border-[#264D59]">
                    <input
                      type="radio"
                      name="cycleRadio"
                      checked={formCycle === 'calendar'}
                      onChange={() => {
                        setFormCycle('calendar');
                        setFormStartDay(1);
                        setFormEndDay(31);
                        setFormCycleDesc('Calendar (1st - End of Month)');
                      }}
                      className="accent-[#264D59]"
                    />
                    <div>
                      <strong className="block uppercase text-[#264D59]">Calendar Month</strong>
                      <span className="text-[9px] text-[#41484b]">Resets on the 1st of each month</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1 border border-[#264D59]">
                    <input
                      type="radio"
                      name="cycleRadio"
                      checked={formCycle === 'statement'}
                      onChange={() => {
                        setFormCycle('statement');
                        if (formStartDay === 1) setFormStartDay(15);
                        if (formEndDay === 31) setFormEndDay(14);
                        setFormCycleDesc('Statement Date (15th - 14th)');
                      }}
                      className="accent-[#264D59]"
                    />
                    <div>
                      <strong className="block uppercase text-[#264D59]">Statement Cycle</strong>
                      <span className="text-[9px] text-[#41484b]">Resets on card statement date</span>
                    </div>
                  </label>
                </div>

                {/* If Statement Cycle is active, capture explicit statement start & end days */}
                {formCycle === 'statement' ? (
                  <div className="bg-white p-1.5 border border-[#264D59] flex flex-col gap-1.5">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6 flex flex-col">
                        <label className="font-headline font-bold text-[9px] uppercase text-[#264D59]">
                          Statement Start Day
                        </label>
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={formStartDay}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(31, parseInt(e.target.value) || 1));
                              setFormStartDay(val);
                              const computedEnd = val === 1 ? 31 : val - 1;
                              setFormEndDay(computedEnd);
                              setFormCycleDesc(`Statement Date (${val}th - ${computedEnd}th)`);
                            }}
                            className="w-16 border-2 border-[#264D59] p-1 font-headline font-bold text-xs text-center text-[#264D59]"
                          />
                          <span className="text-[9px] font-label font-bold text-[#41484b]">th of month</span>
                        </div>
                      </div>

                      <div className="col-span-6 flex flex-col">
                        <label className="font-headline font-bold text-[9px] uppercase text-[#264D59]">
                          Statement End Day
                        </label>
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={formEndDay}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(31, parseInt(e.target.value) || 1));
                              setFormEndDay(val);
                              setFormCycleDesc(`Statement Date (${formStartDay}th - ${val}th)`);
                            }}
                            className="w-16 border-2 border-[#264D59] p-1 font-headline font-bold text-xs text-center text-[#264D59]"
                          />
                          <span className="text-[9px] font-label font-bold text-[#41484b]">th of following</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Presets for Singapore banks */}
                    <div className="flex items-center gap-1 pt-1 border-t border-[#264D59]/30 flex-wrap">
                      <span className="text-[8px] font-headline font-bold uppercase text-[#41484b]">Presets:</span>
                      <button
                        type="button"
                        onClick={() => handleApplyCyclePreset(15, 14, 'Statement Date (15th - 14th)')}
                        className="px-1.5 py-0.5 bg-[#F0EEE8] hover:bg-[#F9E07F] border border-[#264D59] text-[8px] font-bold uppercase"
                      >
                        15th – 14th (HSBC/DBS)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyCyclePreset(20, 19, 'Statement Date (20th - 19th)')}
                        className="px-1.5 py-0.5 bg-[#F0EEE8] hover:bg-[#F9E07F] border border-[#264D59] text-[8px] font-bold uppercase"
                      >
                        20th – 19th (Citi)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyCyclePreset(24, 23, 'Statement Date (24th - 23rd)')}
                        className="px-1.5 py-0.5 bg-[#F0EEE8] hover:bg-[#F9E07F] border border-[#264D59] text-[8px] font-bold uppercase"
                      >
                        24th – 23rd (UOB)
                      </button>
                    </div>

                    <div className="text-[9px] font-label text-[#264D59] bg-[#F9E07F]/20 p-1 border border-[#264D59]/40">
                      <strong>Statement Reset Behavior:</strong> This card’s spending cap resets strictly on the <strong>{formStartDay}th</strong> of each month. Active cycle: <strong>{previewCycleWindow.displayRange}</strong>. Only transactions within these dates count against its spend cap.
                    </div>
                  </div>
                ) : (
                  <div className="text-[9px] font-label text-[#264D59] bg-white p-1 border border-[#264D59]">
                    <strong>Calendar Month Reset:</strong> Resets on the 1st of each calendar month. (Active range: {previewCycleWindow.displayRange}).
                  </div>
                )}
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
                    Statement Spend
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
                    <span>Current cycle spend</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cycleWindow = getCardStatementCycleWindow({
                          billingCycleType: formCycle,
                          statementStartDay: formStartDay,
                          statementEndDay: formEndDay,
                        });
                        const cardExpenses = expenses.filter(
                          (e) => e.paymentMethodId === activeCard?.id && cycleWindow.isWithinCycle(e)
                        );
                        const total = cardExpenses.reduce((s, e) => s + e.amount, 0);
                        setFormCurrentSpend(total.toFixed(2));
                        showToast(`Calculated $${total.toFixed(2)} from ${cardExpenses.length} transactions in active cycle!`);
                      }}
                      className="text-[#264D59] hover:underline font-bold flex items-center gap-0.5 uppercase cursor-pointer"
                      title="Sync spend for this card from expenses matching active statement cycle"
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

              {/* Row 6: Auto-Route Eligible Categories (Expanded beyond 8 + Online Fetch + Uncheck / Check) */}
              <div className="shrink-0 flex flex-col gap-1 p-2 bg-[#FCF9F3] border-2 border-[#264D59]">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline font-bold text-[10px] uppercase tracking-wider text-[#264D59]">
                      Auto-Route Eligible Categories
                    </span>
                    <span className="bg-[#264D59] text-white px-1.5 py-0.2 text-[9px] font-label font-bold">
                      {formCategories.length} Selected
                    </span>
                  </div>

                  {/* Online Fetch / Check Button */}
                  <button
                    type="button"
                    onClick={handleFetchOnlineCategories}
                    disabled={isFetchingCategories}
                    className="flex items-center gap-1 bg-[#F9E07F] hover:bg-[#F9AD6A] text-[#264D59] border border-[#264D59] px-2 py-0.5 text-[10px] font-headline font-bold uppercase shadow-[1px_1px_0px_#264D59] transition-all disabled:opacity-50"
                    title="Fetch & check online for eligible reward categories based on card name"
                  >
                    <span className={`material-symbols-outlined text-xs ${isFetchingCategories ? 'animate-spin' : ''}`}>
                      {isFetchingCategories ? 'sync' : 'travel_explore'}
                    </span>
                    <span>{isFetchingCategories ? 'Checking...' : 'Fetch / Check Online'}</span>
                  </button>
                </div>

                {/* Notice banner after fetching */}
                {categoryFetchNotice && (
                  <div className="bg-[#F9E07F]/30 border border-[#264D59] p-1.5 flex items-start gap-1.5 text-[9px] font-label text-[#264D59]">
                    <span className="material-symbols-outlined text-xs text-[#264D59] shrink-0 mt-0.5">info</span>
                    <div className="flex-1">
                      <span>{categoryFetchNotice}</span>
                      <p className="font-bold mt-0.5 text-[#D46C4E]">
                        Tip: You can uncheck any categories below that do not apply to your card!
                      </p>
                    </div>
                  </div>
                )}

                {/* Categories Grid (Allows checking and unchecking any category!) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[9px] font-label max-h-40 overflow-y-auto pr-1 border border-[#264D59]/30 p-1 bg-white">
                  {availableCategories.map((item) => {
                    const isChecked = formCategories.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-1.5 p-1 border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[#F9E07F]/30 border-[#264D59] font-bold text-[#264D59]'
                            : 'bg-white border-gray-200 text-[#41484b] hover:bg-gray-50'
                        }`}
                        title={item.mccExamples ? `Examples: ${item.mccExamples}` : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCategoryToggle(item.id)}
                          className="accent-[#264D59] mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">{item.label}</span>
                          {item.mccExamples && (
                            <span className="text-[7.5px] text-[#41484b]/80 block truncate">
                              {item.mccExamples}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Custom Category Tag Addition */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-[#264D59]/30">
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder="+ Add custom category (e.g. Pet Care, Cruise Lines, Wine)"
                    className="flex-1 bg-white px-2 py-0.5 text-[9px] font-label border border-[#264D59] text-[#264D59] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="px-2 py-0.5 bg-[#264D59] text-white font-headline font-bold text-[9px] uppercase border border-[#264D59] hover:bg-[#43978D]"
                  >
                    + Add
                  </button>
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
                    <span>Save &amp; Sync to Supabase</span>
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

      {/* 3. Bottom Household Configuration Bar */}
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
            <span className="font-medium text-[#264D59]">Cloud Sync: Realtime Supabase Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
