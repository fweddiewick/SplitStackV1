import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { MemberId, MethodType, CardNetwork, BillingCycleType } from '../types';

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
  const { paymentMethods, members, addPaymentMethod, updatePaymentMethod } = useApp();

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
  const [keyExclusions, setKeyExclusions] = useState('');
  const [cardSubtitle, setCardSubtitle] = useState('4.0 MPD on Shopping & Electronics');

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
      setKeyExclusions(existingCard.keyExclusions || '');
      setCardSubtitle(existingCard.cardSubtitle);
    } else if (members.length > 0) {
      setMemberId(members[0].id);
    }
  }, [existingCard, members]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

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
        keyExclusions,
        cardSubtitle,
      });
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
        currentSpend: 0,
        bonusCap: parseFloat(bonusCap) || 0,
        baseRate: baseRate || '0.4 MPD',
        bonusRate,
        roundingBlock,
        keyExclusions,
        footerAdvice: `Configured for ${name}. Optimize according to reward categories.`,
        footerIcon: 'credit_card',
        footerType: 'info',
        eligibleCategories: ['dining', 'online_shopping', 'groceries'],
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#264D59]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-[#FCF9F3] border-4 border-[#264D59] shadow-[6px_6px_0px_#264D59] w-full max-w-md p-4 flex flex-col gap-3 font-body">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#264D59] pb-2">
          <span className="font-headline font-bold text-sm uppercase tracking-wide flex items-center gap-1.5 text-[#264D59]">
            <span className="material-symbols-outlined text-base">add_card</span>
            {existingCard ? 'Configure Existing Card' : 'Add New Payment Method'}
          </span>
          <button
            onClick={onClose}
            className="hover:bg-[#D46C4E] hover:text-white px-2 py-0.5 border border-[#264D59] font-bold text-xs text-[#264D59]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 font-label text-xs">
          <div>
            <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
              Card / Method Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OCBC Titanium Rewards"
              className="w-full border-2 border-[#264D59] p-1.5 font-headline font-bold bg-white focus:bg-[#F9E07F]/40 focus:outline-none text-[#264D59] text-xs"
            />
          </div>

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
                Last 4 Digits
              </label>
              <input
                type="text"
                maxLength={4}
                value={last4}
                onChange={(e) => setLast4(e.target.value)}
                placeholder="5521"
                className="w-full border-2 border-[#264D59] p-1.5 font-headline font-bold bg-white text-[#264D59] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Monthly Bonus Cap (SGD)
              </label>
              <input
                type="number"
                value={bonusCap}
                onChange={(e) => setBonusCap(e.target.value)}
                placeholder="0 if uncapped"
                className="w-full border-2 border-[#264D59] p-1.5 font-headline font-bold bg-white text-[#264D59] text-xs"
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
                placeholder="4.0 MPD (10X Points)"
                className="w-full border-2 border-[#264D59] p-1.5 font-headline font-bold bg-white text-[#264D59] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Base Earn Rate
              </label>
              <input
                type="text"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                placeholder="0.4 MPD"
                className="w-full border-2 border-[#264D59] p-1.5 font-headline font-bold bg-white text-[#264D59] text-xs"
              />
            </div>
            <div>
              <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
                Billing Cycle
              </label>
              <select
                value={billingCycleType}
                onChange={(e) => {
                  const val = e.target.value as BillingCycleType;
                  setBillingCycleType(val);
                  if (val === 'calendar' && !billingCycleDesc.includes('Calendar')) {
                    setBillingCycleDesc('Calendar (1st - End of Month)');
                  } else if (val === 'statement' && !billingCycleDesc.includes('Statement')) {
                    setBillingCycleDesc('Statement Date (15th - 14th)');
                  }
                }}
                className="w-full border-2 border-[#264D59] p-1.5 bg-white font-bold text-[#264D59] text-xs"
              >
                <option value="calendar">Calendar Month (1st - End)</option>
                <option value="statement">Statement Date Cycle</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
              Billing Cycle Note / Statement Range
            </label>
            <input
              type="text"
              value={billingCycleDesc}
              onChange={(e) => setBillingCycleDesc(e.target.value)}
              placeholder="e.g. Statement Date (15th - 14th) or Calendar (1st - End)"
              className="w-full border-2 border-[#264D59] p-1.5 font-label bg-white text-[#264D59] text-xs"
            />
          </div>

          <div>
            <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
              Key Exclusions
            </label>
            <input
              type="text"
              value={keyExclusions}
              onChange={(e) => setKeyExclusions(e.target.value)}
              placeholder="e.g. Supermarkets (5411), Utilities, Insurance, Tax, AXS"
              className="w-full border-2 border-[#264D59] p-1.5 font-label bg-white text-[#264D59] text-xs"
            />
          </div>

          <div>
            <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
              Network / Rail
            </label>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {(['Visa', 'Mastercard', 'Amex', 'PayNow'] as CardNetwork[]).map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => setNetwork(net)}
                  className={`border-2 border-[#264D59] py-1 font-bold ${
                    network === net ? 'bg-[#264D59] text-white' : 'bg-[#F0EEE8] text-[#264D59]'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-headline font-bold text-[10px] uppercase text-[#264D59]">
              Rounding Block Rule
            </label>
            <select
              value={roundingBlock}
              onChange={(e) => setRoundingBlock(parseInt(e.target.value) as 5 | 1 | 0)}
              className="w-full border-2 border-[#264D59] p-1.5 bg-white font-bold text-[#264D59] text-xs"
            >
              <option value={5}>$5 SGD Blocks (UOB / OCBC rule)</option>
              <option value={1}>$1 SGD Exact (Citi / HSBC rule)</option>
              <option value={0}>No Rounding (Exact Cents)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 border-t-2 border-[#264D59] pt-3 mt-1">
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
              {existingCard ? 'Save Changes' : 'Add Method'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
