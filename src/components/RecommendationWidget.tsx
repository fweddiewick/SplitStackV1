import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { searchMerchantMcc, MccSearchResult } from '../services/mccService';
import { calculateBestCard, CardRule, BestCardRecommendation } from '../utils/calculateBestCard';

interface RecommendationWidgetProps {
  initialMerchant?: string;
  initialAmount?: number;
  onSelectCardForExpense?: (cardId: string, merchant: string, amount: number, mcc: string) => void;
  compact?: boolean;
}

export const RecommendationWidget: React.FC<RecommendationWidgetProps> = ({
  initialMerchant = '',
  initialAmount = 100,
  onSelectCardForExpense,
  compact = false,
}) => {
  const { paymentMethods, members, setActiveTab, showToast } = useApp();

  const [merchantInput, setMerchantInput] = useState(initialMerchant);
  const [amountInput, setAmountInput] = useState(String(initialAmount));
  const [isLoading, setIsLoading] = useState(false);
  const [mccResult, setMccResult] = useState<MccSearchResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<BestCardRecommendation | null>(null);
  const [showRankedList, setShowRankedList] = useState(false);

  // Map user's current payment methods to Supabase CardRule schema format
  const cardRules: CardRule[] = paymentMethods.map((c) => {
    // Generate default eligible MCCs based on categories and exclusions
    const mccs: string[] = [];
    const cats = c.eligibleCategories || [];
    if (cats.includes('groceries')) mccs.push('5411');
    if (cats.includes('dining')) mccs.push('5812', '5813', '5814');
    if (cats.includes('online_food')) mccs.push('5814');
    if (cats.includes('online_shopping') || cats.includes('shopping')) {
      mccs.push('5311', '5651', '5691', '5611', '5621', '5631', '5641', '5661', '5712', '5732', '5815', '5999');
    }
    if (cats.includes('department_stores')) mccs.push('5311');
    if (cats.includes('electronics')) mccs.push('5732');
    if (cats.includes('utilities')) mccs.push('4900', '4814');
    if (cats.includes('transport') || cats.includes('contactless')) mccs.push('4121', '4111');
    if (cats.includes('travel')) mccs.push('4511', '7011');
    if (cats.includes('pharmacy') || cats.includes('convenience')) mccs.push('5912', '5499');

    // Filter out exclusions
    const exclusionText = (c.keyExclusions || '').toLowerCase();
    const finalMccs = mccs.filter((m) => {
      if (m === '5411' && (exclusionText.includes('5411') || exclusionText.includes('supermarket'))) return false;
      if (m === '4511' && (exclusionText.includes('airline') || exclusionText.includes('4511'))) return false;
      if (m === '4900' && (exclusionText.includes('util') || exclusionText.includes('4900'))) return false;
      if (m === '5812' && exclusionText.includes('in-store dining')) return false;
      return true;
    });

    const ownerMember = members.find((m) => m.id === c.memberId);

    return {
      id: c.id,
      card_name: c.name,
      bank: c.bank,
      owner: ownerMember ? ownerMember.name : 'Household Payer',
      base_earn_rate: c.baseRate,
      bonus_earn_rate: c.bonusRate,
      monthly_cap: c.bonusCap,
      rounding_rule: c.roundingBlock === 5 ? '5_sgd_block' : c.roundingBlock === 1 ? '1_sgd_block' : 'exact',
      eligible_mccs: finalMccs,
      key_exclusions: c.keyExclusions ? c.keyExclusions.split(',').map((s) => s.trim()) : [],
      is_active: true,
    };
  });

  // Build current spend map from payment methods
  const currentSpendMap: Record<string, number> = {};
  paymentMethods.forEach((c) => {
    currentSpendMap[c.id] = c.currentSpend;
    currentSpendMap[c.name] = c.currentSpend;
  });

  // Debounced live API lookup
  useEffect(() => {
    const trimmed = merchantInput.trim();
    if (!trimmed) {
      setMccResult(null);
      setApiError(null);
      setRecommendation(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setApiError(null);

    const timer = setTimeout(async () => {
      try {
        const resp = await searchMerchantMcc(trimmed);
        if (resp.success && resp.data) {
          setMccResult(resp.data);
          const numAmt = parseFloat(amountInput) || 100;
          const rec = calculateBestCard(resp.data.mcc, cardRules, currentSpendMap, numAmt);
          setRecommendation(rec);
        } else {
          setMccResult(null);
          setApiError(resp.error || 'Merchant not found in CheckMCC directory.');
          // Still evaluate general base rate
          const numAmt = parseFloat(amountInput) || 100;
          const fallbackRec = calculateBestCard('', cardRules, currentSpendMap, numAmt);
          setRecommendation(fallbackRec);
        }
      } catch (err: unknown) {
        setApiError('Unable to reach CheckMCC API service.');
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [merchantInput, amountInput, paymentMethods]);

  const handleUseCard = () => {
    if (!recommendation?.topCard) return;
    const card = recommendation.topCard.card;
    const numAmt = parseFloat(amountInput) || 100;
    const mccCode = mccResult?.mcc || '5411';

    if (onSelectCardForExpense) {
      onSelectCardForExpense(card.id || card.card_name, merchantInput, numAmt, mccCode);
    } else {
      setActiveTab('log');
      showToast(`Prefilled ${card.card_name} into Log Expense!`);
    }
  };

  const quickPresets = [
    { label: 'FairPrice', name: 'FairPrice Xtra' },
    { label: 'GrabFood', name: 'GrabFood' },
    { label: 'Shopee', name: 'Shopee SG' },
    { label: 'Hai Di Lao', name: 'Hai Di Lao VivoCity' },
    { label: 'SP Utilities', name: 'SP Group' },
  ];

  return (
    <div className="flex flex-col h-full justify-between font-body text-xs text-[#264D59]">
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between pb-1.5 border-b-2 border-[#264D59]">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-[#264D59] font-bold">
            travel_explore
          </span>
          <span className="font-headline font-bold text-xs uppercase tracking-wider text-[#264D59]">
            CheckMCC &bull; Supabase Card Recommender
          </span>
        </div>
        <span className="bg-[#43978D] text-white text-[9px] font-label font-bold px-1.5 py-0.2 border border-[#264D59] uppercase">
          Live API V1.0
        </span>
      </div>

      {/* Inputs (Merchant & Amount) */}
      <div className="flex flex-col gap-1.5 my-1.5 shrink-0">
        <div className="grid grid-cols-12 gap-1.5">
          <div className="col-span-8 flex flex-col">
            <label className="text-[9px] font-headline font-bold uppercase text-[#41484b] mb-0.5">
              Merchant Name (Live CheckMCC Search)
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={merchantInput}
                onChange={(e) => setMerchantInput(e.target.value)}
                placeholder="e.g. FairPrice, Shopee, Uniqlo..."
                className="w-full bg-white border-2 border-[#264D59] px-2 py-1 pr-6 font-headline font-bold text-xs text-[#264D59] focus:outline-none focus:bg-[#F9E07F]/30"
              />
              {isLoading && (
                <span className="material-symbols-outlined absolute right-1.5 text-xs text-[#43978D] animate-spin">
                  progress_activity
                </span>
              )}
            </div>
          </div>

          <div className="col-span-4 flex flex-col">
            <label className="text-[9px] font-headline font-bold uppercase text-[#41484b] mb-0.5">
              SGD ($)
            </label>
            <input
              type="number"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full bg-white border-2 border-[#264D59] px-2 py-1 font-headline font-bold text-xs text-[#264D59] focus:outline-none focus:bg-[#F9E07F]/30"
            />
          </div>
        </div>

        {/* Quick Chips */}
        <div className="flex flex-wrap gap-1">
          {quickPresets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setMerchantInput(p.name)}
              className="px-1.5 py-0.5 text-[9px] font-headline font-bold uppercase border border-[#264D59] bg-[#FBF8F2] hover:bg-[#F9E07F] text-[#264D59] transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Returned MCC Banner from Live API */}
      <div className="shrink-0 bg-[#F0EEE8] border-2 border-[#264D59] p-1.5 flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-[9px] font-label font-bold uppercase text-[#41484b]">CheckMCC Result:</span>
          {mccResult ? (
            <span className="font-headline font-bold text-xs text-[#264D59] truncate flex items-center gap-1">
              <span className="bg-[#264D59] text-white px-1 font-mono text-[9px] font-bold">
                MCC {mccResult.mcc}
              </span>
              <span className="truncate">{mccResult.category}</span>
            </span>
          ) : isLoading ? (
            <span className="text-[10px] font-body text-[#43978D] font-bold flex items-center gap-1">
              <span>Querying live merchant category database...</span>
            </span>
          ) : (
            <span className="text-[10px] font-body text-[#41484b] italic truncate">
              {apiError || 'Type a merchant name to fetch official 4-digit MCC.'}
            </span>
          )}
        </div>

        {mccResult?.source && (
          <span className="text-[8px] font-mono uppercase bg-white border border-[#264D59] px-1 text-[#264D59] shrink-0 font-bold">
            {mccResult.source === 'live_api' ? '✓ API' : 'DB'}
          </span>
        )}
      </div>

      {/* Main Calculated Recommendation Result */}
      <div className="flex-1 min-h-0 border-2 border-[#264D59] bg-[#FBF8F2] p-2 flex flex-col justify-between overflow-y-auto">
        {recommendation?.topCard ? (
          <div className="flex flex-col gap-1.5">
            {/* Top Card Badge & Name */}
            <div className="flex justify-between items-start border-b border-[#264D59]/30 pb-1">
              <div>
                <span className="text-[8px] font-label font-bold uppercase text-[#41484b] block">
                  Top Recommended Card (Supabase Rules)
                </span>
                <h4 className="font-headline font-extrabold text-sm uppercase text-[#264D59] leading-tight flex items-center gap-1">
                  <span>{recommendation.topCard.card.card_name}</span>
                  <span className="text-[9px] font-normal text-[#41484b]">
                    ({recommendation.topCard.card.owner})
                  </span>
                </h4>
              </div>
              <span
                className={`text-[10px] font-headline font-bold px-1.5 py-0.5 border border-[#264D59] ${
                  recommendation.topCard.isBonusEligible
                    ? 'bg-[#43978D] text-white'
                    : 'bg-[#F0EEE8] text-[#264D59]'
                }`}
              >
                {recommendation.topCard.effectiveRate}
              </span>
            </div>

            {/* Reward Breakdown & Slippage */}
            <div className="space-y-1 text-[10px] font-body text-[#264D59]">
              <div className="flex justify-between items-center">
                <span className="text-[#41484b]">Expected Return:</span>
                <strong className="text-[#264D59] font-headline font-bold">
                  {recommendation.topCard.estimatedReturn}
                </strong>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#41484b]">Remaining Cap Headroom:</span>
                <span className="font-mono font-bold text-[#264D59]">
                  {recommendation.topCard.remainingHeadroom > 99999
                    ? 'Uncapped'
                    : `$${recommendation.topCard.remainingHeadroom.toFixed(2)}`}
                </span>
              </div>

              {recommendation.topCard.slippage > 0 && (
                <div className="flex justify-between items-center text-[9px] font-mono text-[#D46C4E]">
                  <span>$5 Block Slippage:</span>
                  <span>-${recommendation.topCard.slippage.toFixed(2)} unrewarded</span>
                </div>
              )}

              {recommendation.topCard.warning && (
                <div className="bg-[#D46C4E]/15 border border-[#D46C4E] p-1 text-[9px] font-bold text-[#D46C4E]">
                  {recommendation.topCard.warning}
                </div>
              )}
            </div>

            {/* Action CTA */}
            <button
              type="button"
              onClick={handleUseCard}
              className="w-full mt-1 py-1.5 bg-[#264D59] hover:bg-[#F9E07F] text-white hover:text-[#264D59] border-2 border-[#264D59] font-headline font-bold text-[11px] uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-xs font-bold">arrow_forward</span>
              <span>Use This Card in Log Expense</span>
            </button>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-2 text-[#41484b]">
            <span className="material-symbols-outlined text-2xl text-[#264D59]">credit_card</span>
            <span className="font-headline font-bold text-xs uppercase text-[#264D59] mt-1">
              Awaiting Merchant Query
            </span>
            <span className="text-[9px] font-body mt-0.5">
              Enter a merchant name above. CheckMCC translates it to an exact 4-digit code, and local Supabase rules evaluate the best card!
            </span>
          </div>
        )}
      </div>

      {/* Toggle Alternate Cards List */}
      {recommendation && recommendation.rankedCards.length > 1 && (
        <div className="shrink-0 mt-1">
          <button
            type="button"
            onClick={() => setShowRankedList(!showRankedList)}
            className="w-full py-0.5 bg-[#F0EEE8] hover:bg-[#E5E2DC] border border-[#264D59] text-[9px] font-headline font-bold uppercase text-[#264D59] flex items-center justify-center gap-1"
          >
            <span>{showRankedList ? 'Hide Other Cards' : `Compare All ${recommendation.rankedCards.length} Household Cards`}</span>
            <span className="material-symbols-outlined text-xs">
              {showRankedList ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showRankedList && (
            <div className="mt-1 border border-[#264D59] bg-white p-1 max-h-24 overflow-y-auto space-y-1 text-[9px]">
              {recommendation.rankedCards.slice(1).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-[#264D59]/20 pb-0.5">
                  <div className="truncate">
                    <span className="font-bold text-[#264D59]">{item.card.card_name}</span>
                    <span className="text-[#41484b] ml-1">({item.card.owner})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[#264D59]">{item.effectiveRate}</span>
                    {item.isCapped && (
                      <span className="bg-[#D46C4E] text-white px-0.5 font-bold text-[8px]">CAPPED</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
