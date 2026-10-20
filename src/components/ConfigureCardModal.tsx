import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { MemberId, MethodType, CardNetwork, BillingCycleType } from '../types';
import { lookupCardCategories, ALL_SG_CATEGORIES, CategoryOption } from '../services/cardCategoryLookup';
import { getCardStatementCycleWindow } from '../utils/dateUtils';

interface ConfigureCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId?: string;
}

export const ConfigureCardModal: React.FC<ConfigureCardModalProps> = ({
  isOpen,
  onClose,
  cardId,
}) => {
  const { paymentMethods, members, addPaymentMethod, updatePaymentMethod, showToast } = useApp();

  const existingCard = paymentMethods.find((c) => c.id === cardId);

  const [name, setName] = useState('OCBC Rewards Card');
  const [bank, setBank] = useState('OCBC');
  const [memberId, setMemberId] = useState<MemberId>(members[0]?.id || 'ryan');
  const [last4, setLast4] = useState('6671');
  const [network, setNetwork] = useState<CardNetwork>('Mastercard');
  const [cardType, setCardType] = useState<MethodType>('credit');
  const [bonusCap, setBonusCap] = useState('1110');
  const [baseRate, setBaseRate] = useState('0.4 MPD');
  const [bonusRate, setBonusRate] = useState('4.0 MPD');
  const [roundingBlock, setRoundingBlock] = useState<5 | 1 | 0>(5);
  const [billingCycleType, setBillingCycleType] = useState<BillingCycleType>('calendar');
  const [billingCycleDesc, setBillingCycleDesc] = useState('Calendar (1st - End of Month)');
  const [statementStartDay, setStatementStartDay] = useState<number>(1);
  const [statementEndDay, setStatementEndDay] = useState<number>(31);
  const [keyExclusions, setKeyExclusions] = useState('');
  const [cardSubtitle, setCardSubtitle] = useState('4.0 MPD on Shopping & Electronics');
  const [eligibleCategories, setEligibleCategories] = useState<string[]>(['online_shopping', 'dining']);

  const [isFetching, setIsFetching] = useState(false);
  const [fetchNotice, setFetchNotice] = useState<string | null>(null);
  const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>(ALL_SG_CATEGORIES);

  useEffect(() => {
    if (existingCard) {
      setName(existingCard.name);
      setBank(existingCard.bank);
      setMemberId(existingCard.memberId);
      setLast4(existingCard.last4);
      setNetwork(existingCard.network);
      setCardType(existingCard.type);
      setBonusCap(String(existingCard.bonusCap));
      setBaseRate(existingCard.baseRate);
      setBonusRate(existingCard.bonusRate);
      setRoundingBlock(existingCard.roundingBlock);
      setBillingCycleType(existingCard.billingCycleType);
      setBillingCycleDesc(existingCard.billingCycleDesc || (existingCard.billingCycleType === 'calendar' ? 'Calendar (1st - End of Month)' : 'Statement Cycle'));
      setStatementStartDay(existingCard.statementStartDay ?? (existingCard.billingCycleType === 'statement' ? 15 : 1));
      setStatementEndDay(existingCard.statementEndDay ?? (existingCard.billingCycleType === 'statement' ? 14 : 31));
      setKeyExclusions(existingCard.keyExclusions || '');
      setCardSubtitle(existingCard.cardSubtitle);
      setEligibleCategories(existingCard.eligibleCategories || ['dining', 'online_shopping']);
      setFetchNotice(null);
    } else if (members.length > 0) {
      setMemberId(members[0].id);
      setStatementStartDay(1);
      setStatementEndDay(31);
      setBillingCycleType('calendar');
      setBillingCycleDesc('Calendar (1st - End of Month)');
      setFetchNotice(null);
    }
  }, [existingCard, members, isOpen]);

  if (!isOpen) return null;

  const handleCategoryToggle = (id: string) => {
    if (eligibleCategories.includes(id)) {
      setEligibleCategories(eligibleCategories.filter((c) => c !== id));
    } else {
      setEligibleCategories([...eligibleCategories, id]);
    }
  };

  const handleFetchOnline = async () => {
    if (!name.trim()) {
      showToast('Please enter a card name first', 'warning');
      return;
    }
    setIsFetching(true);
    try {
      const res = await lookupCardCategories(name);
      setEligibleCategories(res.categories.map((c) => c.id));
      if (res.detectedBank && res.detectedBank !== 'Singapore Bank') {
        setBank(res.detectedBank);
      }
      if (res.bonusRate) setBonusRate(res.bonusRate);
      if (res.baseRate) setBaseRate(res.baseRate);
      if (res.bonusCap !== undefined) setBonusCap(String(res.bonusCap));
      if (res.roundingBlock !== undefined) setRoundingBlock(res.roundingBlock);
      if (res.keyExclusions) setKeyExclusions(res.keyExclusions);

      setFetchNotice(res.notes || `Retrieved terms for ${res.cardName}. Uncheck any categories that do not belong.`);
      showToast(`Fetched rules for ${name}!`, 'check_circle');
    } catch {
      showToast('Could not fetch categories, please select manually.', 'warning');
    } finally {
      setIsFetching(false);
    }
  };

  const previewCycle = getCardStatementCycleWindow({
    billingCycleType,
    statementStartDay,
    statementEndDay,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const start = billingCycleType === 'statement' ? Math.max(1, Math.min(31, statementStartDay)) : 1;
    const end = billingCycleType === 'statement' ? Math.max(1, Math.min(31, statementEndDay)) : 31;

    if (existingCard) {
      updatePaymentMethod(existingCard.id, {
        name,
        bank,
        memberId,
        last4,
        network,
        type: cardType,
        bonusCap: parseFloat(bonusCap) || 0,
        baseRate,
        bonusRate,
        roundingBlock,
        billingCycleType,
        billingCycleDesc,
        statementStartDay: start,
        statementEndDay: end,
        keyExclusions,
        cardSubtitle,
        eligibleCategories,
      });
      showToast(`Updated ${name} & synced to Supabase!`, 'save');
    } else {
      addPaymentMethod({
        badgeCode: name.substring(0, 4).toUpperCase(),
        name,
        bank,
        memberId,
        type: cardType,
        network,
        last4: last4 || '0000',
        statusTag: 'Open Buffer',
        statusTagBg: '#43978D',
        cardSubtitle: cardSubtitle || `${bonusRate} Rewards Earner`,
        billingCycleType,
        billingCycleDesc,
        statementStartDay: start,
        statementEndDay: end,
        currentSpend: 0,
        bonusCap: parseFloat(bonusCap) || 0,
        baseRate: baseRate || '0.4 MPD',
        bonusRate,
        roundingBlock,
        keyExclusions,
        footerAdvice: `Configured for ${name}. Statement resets in ${previewCycle.resetInDays}d.`,
        footerIcon: 'credit_card',
        footerType: 'info',
        eligibleCategories,
      });
      showToast(`Added ${name} to household & synced across devices!`, 'add_card');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#264D59]/60 backdrop-blur-[2px] flex items-center justify-center p-3">
      <div className="bg-[#FCF9F3] border-4 border-[#264D59] shadow-[6px_6px_0px_#264D59] w-full max-w-lg p-3.5 flex flex-col gap-2.5 font-body max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#264D59] pb-1.5 shrink-0">
          <span className="font-headline font-bold text-sm uppercase tracking-wide flex items-center gap-1.5 text-[#264D59]">
            <span className="material-symbols-outlined text-base">add_card</span>
            {existingCard ? 'Configure Card & Statement Reset' : 'Add New Payment Method (Synced to Supabase)'}
          </span>
          <button
            onClick={onClose}
            className="hover:bg-[#D46C4E] hover:text-white px-2 py-0.5 border border-[#264D59] font-bold text-xs text-[#264D59]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col gap-2 font-label text-xs overflow-y-auto pr-1">
          {/* Card Name + Fetch Button */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Card / Method Name
              </label>
              <button
                type="button"
                onClick={handleFetchOnline}
                disabled={isFetching}
                className="flex items-center gap-1 bg-[#F9E07F] hover:bg-[#F9AD6A] text-[#264D59] border border-[#264D59] px-2 py-0.5 text-[9px] font-headline font-bold uppercase shadow-[1px_1px_0px_#264D59]"
                title="Fetch rules, rates & eligible categories online"
              >
                <span className={`material-symbols-outlined text-xs ${isFetching ? 'animate-spin' : ''}`}>
                  {isFetching ? 'sync' : 'travel_explore'}
                </span>
                <span>{isFetching ? 'Fetching...' : 'Fetch Rules Online'}</span>
              </button>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. UOB Lady's Solitaire, HSBC Revolution, Citi Rewards"
              className="w-full border-2 border-[#264D59] p-1.5 font-headline font-bold bg-white focus:bg-[#F9E07F]/40 focus:outline-none text-[#264D59] text-xs"
            />
          </div>

          {fetchNotice && (
            <div className="bg-[#F9E07F]/30 border border-[#264D59] p-1 text-[9px] font-label text-[#264D59] flex items-center justify-between">
              <span>{fetchNotice}</span>
              <button type="button" onClick={() => setFetchNotice(null)} className="font-bold px-1">✕</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Cardholder / Member
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full border-2 border-[#264D59] p-1.5 bg-white font-bold text-[#264D59] text-xs"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.role === 'lead' ? '(Lead)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Last 4 Digits &amp; Bank
              </label>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="text"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value)}
                  placeholder="5521"
                  className="w-full border-2 border-[#264D59] p-1.5 font-headline font-bold bg-white text-[#264D59] text-xs text-center"
                />
                <input
                  type="text"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  placeholder="Bank (e.g. UOB)"
                  className="w-full border-2 border-[#264D59] p-1.5 font-headline font-bold bg-white text-[#264D59] text-xs"
                />
              </div>
            </div>
          </div>

          {/* Statement Cycle & Start / End Day */}
          <div className="bg-[#F6F3ED] border-2 border-[#264D59] p-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Statement Date &amp; Cap Reset Timing
              </span>
              <span className="text-[9px] font-bold text-[#43978D] bg-white px-1 border border-[#264D59]">
                Resets in {previewCycle.resetInDays}d
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <label className="flex items-center gap-1.5 bg-white p-1 border border-[#264D59] cursor-pointer">
                <input
                  type="radio"
                  name="cycleModalRadio"
                  checked={billingCycleType === 'calendar'}
                  onChange={() => {
                    setBillingCycleType('calendar');
                    setStatementStartDay(1);
                    setStatementEndDay(31);
                    setBillingCycleDesc('Calendar (1st - End of Month)');
                  }}
                  className="accent-[#264D59]"
                />
                <div>
                  <strong className="block text-[#264D59]">Calendar Month</strong>
                  <span className="text-[8.5px] text-[#41484b]">Resets 1st of month</span>
                </div>
              </label>

              <label className="flex items-center gap-1.5 bg-white p-1 border border-[#264D59] cursor-pointer">
                <input
                  type="radio"
                  name="cycleModalRadio"
                  checked={billingCycleType === 'statement'}
                  onChange={() => {
                    setBillingCycleType('statement');
                    if (statementStartDay === 1) setStatementStartDay(15);
                    if (statementEndDay === 31) setStatementEndDay(14);
                    setBillingCycleDesc('Statement Date (15th - 14th)');
                  }}
                  className="accent-[#264D59]"
                />
                <div>
                  <strong className="block text-[#264D59]">Statement Cycle</strong>
                  <span className="text-[8.5px] text-[#41484b]">Resets on statement day</span>
                </div>
              </label>
            </div>

            {billingCycleType === 'statement' && (
              <div className="bg-white p-1.5 border border-[#264D59] flex flex-col gap-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-headline font-bold text-[9px] uppercase text-[#264D59]">
                      Statement Start Day:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={statementStartDay}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(31, parseInt(e.target.value) || 1));
                        setStatementStartDay(val);
                        setStatementEndDay(val === 1 ? 31 : val - 1);
                        setBillingCycleDesc(`Statement Date (${val}th - ${val === 1 ? 31 : val - 1}th)`);
                      }}
                      className="w-full border-2 border-[#264D59] p-1 font-bold text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-headline font-bold text-[9px] uppercase text-[#264D59]">
                      Statement End Day:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={statementEndDay}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(31, parseInt(e.target.value) || 1));
                        setStatementEndDay(val);
                        setBillingCycleDesc(`Statement Date (${statementStartDay}th - ${val}th)`);
                      }}
                      className="w-full border-2 border-[#264D59] p-1 font-bold text-center text-xs"
                    />
                  </div>
                </div>
                <div className="text-[8.5px] text-[#264D59] font-medium bg-[#F9E07F]/20 p-1">
                  Active window: <strong>{previewCycle.displayRange}</strong>. Only expenses in this window count against spend cap.
                </div>
              </div>
            )}
          </div>

          {/* Rates and Caps */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Monthly Cap (SGD)
              </label>
              <input
                type="number"
                value={bonusCap}
                onChange={(e) => setBonusCap(e.target.value)}
                placeholder="0 = uncapped"
                className="w-full border-2 border-[#264D59] p-1 font-headline font-bold bg-white text-[#264D59] text-xs"
              />
            </div>
            <div>
              <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Bonus Rate
              </label>
              <input
                type="text"
                value={bonusRate}
                onChange={(e) => setBonusRate(e.target.value)}
                placeholder="4.0 MPD"
                className="w-full border-2 border-[#264D59] p-1 font-headline font-bold bg-[#F9E07F]/50 text-[#264D59] text-xs"
              />
            </div>
            <div>
              <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Base Rate
              </label>
              <input
                type="text"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                placeholder="0.4 MPD"
                className="w-full border-2 border-[#264D59] p-1 font-headline font-bold bg-white text-[#264D59] text-xs"
              />
            </div>
          </div>

          {/* Eligible Categories Selector (Check / Uncheck any category!) */}
          <div className="flex flex-col gap-1 border-2 border-[#264D59] p-2 bg-[#FCF9F3]">
            <div className="flex items-center justify-between">
              <span className="font-headline font-bold text-[10px] uppercase tracking-wider text-[#264D59]">
                Auto-Route Eligible Categories ({eligibleCategories.length} selected)
              </span>
              <span className="text-[8.5px] text-[#41484b]">Uncheck any that don't apply</span>
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto bg-white p-1 border border-[#264D59]/40 text-[9px]">
              {availableCategories.map((c) => {
                const checked = eligibleCategories.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-1.5 p-1 border cursor-pointer ${
                      checked ? 'bg-[#F9E07F]/30 border-[#264D59] font-bold text-[#264D59]' : 'border-gray-200 text-[#41484b]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleCategoryToggle(c.id)}
                      className="accent-[#264D59]"
                    />
                    <span className="truncate">{c.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
              Key Exclusions
            </label>
            <input
              type="text"
              value={keyExclusions}
              onChange={(e) => setKeyExclusions(e.target.value)}
              placeholder="e.g. Supermarkets (5411), Utilities, Insurance, Tax"
              className="w-full border-2 border-[#264D59] p-1 font-label bg-white text-[#264D59] text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t-2 border-[#264D59] pt-2 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-[#F0EEE8] border-2 border-[#264D59] font-headline font-bold text-[11px] uppercase text-[#264D59]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1 bg-[#264D59] text-white hover:bg-[#F9E07F] hover:text-[#264D59] border-2 border-[#264D59] shadow-[2px_2px_0px_#264D59] font-headline font-bold text-[11px] uppercase transition-colors"
            >
              {existingCard ? 'Save & Sync to Supabase' : 'Add Card & Sync to Cloud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
