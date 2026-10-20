import { MCPTool } from './types';
import { CardMethod, HouseholdMember, SplitMode } from '../types';
import { SG_MERCHANT_DIRECTORY } from '../data/initialData';

export const SPLITSTACK_MCP_TOOLS: MCPTool[] = [
  {
    name: 'recommend_optimal_card',
    description:
      'Recommends the best Singapore credit card for a given transaction by analyzing user-added payment methods, category MCC rules, remaining monthly bonus caps, and $5 block rounding rules.',
    inputSchema: {
      type: 'object',
      properties: {
        merchant: {
          type: 'string',
          description: 'Merchant name (e.g. "FairPrice", "GrabFood", "Shopee", "Singtel")',
        },
        amount: {
          type: 'number',
          description: 'Transaction amount in SGD (default: 100.00)',
        },
        category: {
          type: 'string',
          description: 'Optional transaction category (e.g. "groceries", "dining", "online_shopping")',
        },
      },
      required: ['merchant'],
    },
  },
  {
    name: 'calculate_expense_split',
    description:
      'Calculates cent-precision split allocation for household expenses across dynamic members (equal N-way or custom).',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Total SGD amount to split',
        },
        splitMode: {
          type: 'string',
          enum: ['equal', 'pair', 'custom'],
          description: 'Split strategy mode',
        },
        payerId: {
          type: 'string',
          description: 'ID of the member who paid',
        },
      },
      required: ['amount', 'splitMode', 'payerId'],
    },
  },
  {
    name: 'get_card_limits',
    description:
      'Fetches current spend, bonus caps, remaining headroom, and overspend warning statuses for all active payment methods.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'manage_household_members',
    description:
      'Manages household member roster: list all members, add a new member, or update member roles.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'add', 'update'],
          description: 'Member action to perform',
        },
        name: {
          type: 'string',
          description: 'Name of the member (for add/update)',
        },
        role: {
          type: 'string',
          enum: ['lead', 'member'],
          description: 'Role of the member',
        },
        phone: {
          type: 'string',
          description: 'Phone number of the member',
        },
      },
      required: ['action'],
    },
  },
];

/**
 * Dynamic Recommendation Engine for MCP
 * Evaluates dynamically against the user's added payment methods
 */
export function executeRecommendCard(
  userAddedCards: CardMethod[],
  merchant: string,
  amount = 100,
  overrideCategory?: string
) {
  const query = merchant.trim().toLowerCase();
  let detectedMcc = '5411';
  let detectedCategory = overrideCategory || 'groceries';

  // Check merchant directory
  for (const [key, val] of Object.entries(SG_MERCHANT_DIRECTORY)) {
    if (query.includes(key)) {
      detectedMcc = val.mcc;
      detectedCategory = val.category.toLowerCase().replace(/[^a-z0-9]/g, '_');
      break;
    }
  }

  // Filter out non-credit methods
  const candidateCards = userAddedCards.filter((c) => c.type !== 'giro');

  if (candidateCards.length === 0) {
    return {
      error: 'No payment methods available in the household stack. Please add cards in the Payment Methods tab.',
    };
  }

  const scoredCards = candidateCards.map((card) => {
    let score = 0;
    const reasons: string[] = [];
    let warning: string | undefined;

    const isCapped = card.bonusCap > 0 && card.currentSpend >= card.bonusCap;
    const remainingHeadroom = card.bonusCap > 0 ? Math.max(0, card.bonusCap - card.currentSpend) : 999999;

    // Exclusions check
    let isExcluded = false;
    if (card.keyExclusions) {
      const ex = card.keyExclusions.toLowerCase();
      if (
        (ex.includes('airline') && (detectedMcc === '4511' || query.includes('scoot') || query.includes('air'))) ||
        (ex.includes('utilit') && (detectedMcc === '4900' || detectedMcc === '4814' || query.includes('sp ') || query.includes('singtel')))
      ) {
        isExcluded = true;
      }
    }

    if (isExcluded) {
      score -= 100;
      warning = `MCC ${detectedMcc} is explicitly excluded under ${card.name} terms.`;
    }

    if (isCapped) {
      score -= 200;
      warning = `Card is CAPPED OUT ($${card.currentSpend.toFixed(2)} / $${card.bonusCap}). Further spend earns base rate only.`;
    }

    // Dynamic category matching against card.eligibleCategories
    const cleanDet = detectedCategory.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const cardCats = (card.eligibleCategories || []).map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ' '));
    const matchedCategory = cardCats.some(
      (cat) =>
        cat.includes(cleanDet) ||
        cleanDet.includes(cat) ||
        (cat.includes('grocer') && (query.includes('fairprice') || query.includes('cold storage') || query.includes('sheng siong'))) ||
        (cat.includes('dining') && (query.includes('hdl') || query.includes('food') || query.includes('grab') || query.includes('restaurant'))) ||
        (cat.includes('shopping') && (query.includes('shopee') || query.includes('lazada') || query.includes('amazon') || query.includes('taobao'))) ||
        (cat.includes('travel') && (query.includes('scoot') || query.includes('air') || query.includes('hotel') || query.includes('agoda'))) ||
        (cat.includes('transport') && (query.includes('simplygo') || query.includes('mrt') || query.includes('bus') || query.includes('gojek')))
    );

    if (matchedCategory && !isCapped && !isExcluded) {
      score += 120;
      reasons.push(`Matches bonus category '${detectedCategory}' on ${card.name} (${card.bonusRate})`);
    }

    // Check $5 block rounding rule
    let eligibleBlocksAmount = amount;
    let slippage = 0;
    if (card.roundingBlock === 5) {
      eligibleBlocksAmount = Math.floor(amount / 5) * 5;
      slippage = Number((amount - eligibleBlocksAmount).toFixed(2));
    } else if (card.roundingBlock === 1) {
      eligibleBlocksAmount = Math.floor(amount);
      slippage = Number((amount - eligibleBlocksAmount).toFixed(2));
    }

    // Base fallback preference
    if (card.bonusCap === 0 && !matchedCategory) {
      score += 30;
      reasons.push(`Uncapped base fallback earner (${card.baseRate})`);
    }

    return {
      card,
      score,
      isEligible: !isExcluded && !isCapped,
      reasons,
      warning,
      eligibleBlocksAmount,
      slippage,
      remainingHeadroom,
      potentialEarnings: card.bonusRate.includes('MPD')
        ? `${(eligibleBlocksAmount * 4).toFixed(0)} KrisFlyer Miles (${card.bonusRate})`
        : `Up to $${(eligibleBlocksAmount * 0.05).toFixed(2)} SGD (${card.bonusRate})`,
    };
  });

  scoredCards.sort((a, b) => b.score - a.score);
  return {
    merchant,
    detectedMcc,
    detectedCategory,
    topRecommendation: scoredCards[0],
    allEvaluatedCards: scoredCards,
  };
}
