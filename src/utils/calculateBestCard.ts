/**
 * calculateBestCard.ts / calculateBestCard.js
 * Cross-references a merchant MCC against Supabase card_rules to determine the highest yielding credit card.
 *
 * Rules:
 * 1. Checks if the MCC is included in the card's eligible_mccs array.
 * 2. Checks if the card has remaining headroom under its monthly_cap.
 * 3. Applies rounding rules ($5 SGD blocks, $1 SGD blocks, or exact).
 * 4. Strictly prioritizes bonus-rate cards with headroom before falling back to base rate cards.
 */

export interface CardRule {
  id?: string;
  card_name: string;
  bank?: string;
  owner: string;
  base_earn_rate: string;
  bonus_earn_rate: string;
  monthly_cap: number; // 0 if uncapped
  rounding_rule: '5_sgd_block' | '1_sgd_block' | 'exact' | number;
  eligible_mccs: string[] | string; // array of 4-digit strings or JSON
  key_exclusions?: string[];
  is_active?: boolean;
}

export interface EvaluatedCardOption {
  card: CardRule;
  isBonusEligible: boolean;
  isCapped: boolean;
  remainingHeadroom: number;
  eligibleSpend: number;
  slippage: number;
  effectiveRate: string;
  score: number;
  estimatedReturn: string;
  reasons: string[];
  warning?: string;
}

export interface BestCardRecommendation {
  topCard: EvaluatedCardOption | null;
  rankedCards: EvaluatedCardOption[];
  queryMcc: string;
  transactionAmount: number;
}

/**
 * Normalizes eligible_mccs to a string array
 */
function parseEligibleMccs(mccs: string[] | string | undefined): string[] {
  if (!mccs) return [];
  if (Array.isArray(mccs)) return mccs.map((m) => String(m).trim());
  if (typeof mccs === 'string') {
    try {
      const parsed = JSON.parse(mccs);
      if (Array.isArray(parsed)) return parsed.map((m) => String(m).trim());
    } catch {
      return mccs.split(',').map((m) => m.trim());
    }
  }
  return [];
}

/**
 * Calculates $5 block or $1 block rounding rule
 */
export function applyRoundingRule(amount: number, rule: '5_sgd_block' | '1_sgd_block' | 'exact' | number) {
  const cleanAmount = Math.max(0, amount);
  if (rule === '5_sgd_block' || rule === 5) {
    const blocks = Math.floor(cleanAmount / 5);
    const eligible = blocks * 5;
    const slippage = Number((cleanAmount - eligible).toFixed(2));
    return { eligible, slippage, blocks, unit: 5 };
  }

  if (rule === '1_sgd_block' || rule === 1) {
    const blocks = Math.floor(cleanAmount);
    const eligible = blocks;
    const slippage = Number((cleanAmount - eligible).toFixed(2));
    return { eligible, slippage, blocks, unit: 1 };
  }

  return { eligible: cleanAmount, slippage: 0, blocks: cleanAmount, unit: 0 };
}

/**
 * Main Calculation Engine:
 * Cross-references the fetched MCC with Supabase card rules and current spend.
 */
export function calculateBestCard(
  mcc: string,
  cardRules: CardRule[],
  currentSpendMap: Record<string, number> = {},
  amount = 100
): BestCardRecommendation {
  const cleanMcc = String(mcc || '').trim();
  const validCards = cardRules.filter((c) => c.is_active !== false);

  if (validCards.length === 0) {
    return {
      topCard: null,
      rankedCards: [],
      queryMcc: cleanMcc,
      transactionAmount: amount,
    };
  }

  const evaluatedCards: EvaluatedCardOption[] = validCards.map((card) => {
    const cardIdentifier = card.id || card.card_name;
    const currentSpend = currentSpendMap[cardIdentifier] || currentSpendMap[card.card_name] || 0;
    const monthlyCap = card.monthly_cap || 0;
    const remainingHeadroom = monthlyCap > 0 ? Math.max(0, monthlyCap - currentSpend) : 999999;
    const isCapped = monthlyCap > 0 && currentSpend >= monthlyCap;

    const eligibleMccs = parseEligibleMccs(card.eligible_mccs);
    const isMccEligible = cleanMcc.length > 0 && eligibleMccs.includes(cleanMcc);

    // Apply Rounding Rule
    const { eligible: eligibleSpend, slippage } = applyRoundingRule(amount, card.rounding_rule);

    let score = 0;
    const reasons: string[] = [];
    let warning: string | undefined;

    // Check Key Exclusions (e.g. Utilities, Tax, Hospital, Insurance)
    let isExcluded = false;
    if (card.key_exclusions && card.key_exclusions.length > 0) {
      if (
        (cleanMcc === '4900' || cleanMcc === '4814') &&
        card.key_exclusions.some((ex) => ex.toLowerCase().includes('util'))
      ) {
        isExcluded = true;
        warning = `MCC ${cleanMcc} is in ${card.card_name}'s key exclusions list.`;
      }
      if (cleanMcc === '4511' && card.key_exclusions.some((ex) => ex.toLowerCase().includes('air'))) {
        isExcluded = true;
        warning = `Airlines (MCC 4511) are excluded under ${card.card_name}.`;
      }
    }

    // SCORING HIERARCHY:
    // 1. Prioritize cards that trigger bonus_earn_rate AND have remaining headroom
    if (isMccEligible && !isCapped && !isExcluded) {
      score += 1000; // Major boost for bonus match
      reasons.push(`MCC ${cleanMcc} is qualified for ${card.bonus_earn_rate}`);

      if (remainingHeadroom < amount) {
        score -= 200;
        warning = `Only $${remainingHeadroom.toFixed(2)} headroom left before cap overflow.`;
      }
    } else if (isMccEligible && isCapped) {
      // Qualifies on MCC, but capped out!
      score -= 500;
      warning = `Card has capped out ($${currentSpend.toFixed(2)} / $${monthlyCap}). Reverts to base ${card.base_earn_rate}.`;
      reasons.push(`Monthly bonus cap reached; not recommended for further spend`);
    } else {
      // Base earn rate card fallback
      const isZeroEarn = card.base_earn_rate.includes('0%') || card.bonus_earn_rate.includes('0%');
      if (isZeroEarn) {
        score += 10;
        reasons.push(`Non-reward direct transfer rail`);
      } else {
        score += 100;
        reasons.push(`Non-bonus category; earns base rate ${card.base_earn_rate}`);
      }
    }

    // Rate parsing priority (reward yield)
    const baseVal = parseFloat(card.base_earn_rate) || 0;
    if (baseVal > 0.5) {
      score += Math.round(baseVal * 25); // Higher base rate cards (1.6% Cashback / 1.2 MPD) rank higher
    }

    const isMiles = card.bonus_earn_rate.includes('MPD') || card.bonus_earn_rate.includes('Points');
    if (isMiles && isMccEligible && !isCapped && !isExcluded) {
      score += 50; // Miles bonus gets high recommendation
    }

    // Subtract points for slippage ($5 block rounding losses)
    if (slippage > 0) {
      score -= Math.round(slippage * 2);
    }

    // Uncapped safety net fallback for general spend
    if (monthlyCap === 0 && !isMccEligible && !card.base_earn_rate.includes('0%')) {
      score += 50;
      reasons.push(`Uncapped base safety net (No monthly ceiling)`);
    }

    // Format Estimated Return
    const isBonusActive = isMccEligible && !isCapped && !isExcluded;
    const effectiveRate = isBonusActive ? card.bonus_earn_rate : card.base_earn_rate;

    let estimatedReturn = '';
    if (effectiveRate.includes('MPD')) {
      const mpdVal = parseFloat(effectiveRate) || 4.0;
      const miles = Math.floor(eligibleSpend * mpdVal);
      estimatedReturn = `${miles.toLocaleString()} KrisFlyer Miles (${effectiveRate})`;
    } else if (effectiveRate.includes('%') || effectiveRate.includes('Cash')) {
      const pct = (parseFloat(effectiveRate) || 5.0) / 100;
      const cash = (eligibleSpend * pct).toFixed(2);
      estimatedReturn = `$${cash} SGD Cashback (${effectiveRate})`;
    } else {
      estimatedReturn = effectiveRate;
    }

    return {
      card,
      isBonusEligible: isBonusActive,
      isCapped,
      remainingHeadroom,
      eligibleSpend,
      slippage,
      effectiveRate,
      score,
      estimatedReturn,
      reasons,
      warning,
    };
  });

  // Sort descending by calculated score
  evaluatedCards.sort((a, b) => b.score - a.score);

  return {
    topCard: evaluatedCards[0] || null,
    rankedCards: evaluatedCards,
    queryMcc: cleanMcc,
    transactionAmount: amount,
  };
}
