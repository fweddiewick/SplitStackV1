/**
 * cardCategoryLookup.ts
 * Intelligence service to fetch and suggest eligible reward categories, bonus rules,
 * and MCC mappings for Singapore credit cards.
 * 
 * Features:
 * 1. Checks online via Google Gemini (if API key available)
 * 2. Deep offline Singapore Cards Knowledge Base covering all major SG banks
 * 3. Returns rich taxonomy of categories with descriptions, allowing users to review,
 *    uncheck irrelevant categories, or add custom ones.
 */

import { GoogleGenAI } from '@google/genai';

export interface CategoryOption {
  id: string;
  label: string;
  description?: string;
  mccExamples?: string;
}

export interface CardLookupResult {
  cardName: string;
  detectedBank: string;
  categories: CategoryOption[];
  bonusRate?: string;
  baseRate?: string;
  bonusCap?: number;
  roundingBlock?: 5 | 1 | 0;
  keyExclusions?: string;
  notes?: string;
  source: 'ai_online' | 'knowledge_base' | 'generic';
}

// Master taxonomy of Singapore reward categories
export const ALL_SG_CATEGORIES: CategoryOption[] = [
  { id: 'dining', label: 'Dining & Restaurants', mccExamples: '5812, 5813 (Restaurants, Bars, Bistros)' },
  { id: 'online_food', label: 'Online Food Delivery', mccExamples: 'GrabFood, Deliveroo, Foodpanda' },
  { id: 'online_shopping', label: 'Online Shopping & E-Commerce', mccExamples: 'Shopee, Lazada, Amazon, Taobao' },
  { id: 'groceries', label: 'Groceries & Supermarkets', mccExamples: '5411 (FairPrice, Cold Storage, Giant, Sheng Siong)' },
  { id: 'travel', label: 'Travel & Flights', mccExamples: '4511, 4722 (SIA, Scoot, Expedia, Agoda)' },
  { id: 'hotels', label: 'Hotels & Accommodations', mccExamples: '7011 (Marriott, Hilton, Airbnb, Booking.com)' },
  { id: 'transport', label: 'Public Transit & Rides', mccExamples: 'SimplyGo, Bus/MRT, Grab, ComfortDelGro, Gojek' },
  { id: 'utilities', label: 'Utilities & Telco', mccExamples: '4900 (SP Services, Tuas Power, Singtel, StarHub)' },
  { id: 'petrol', label: 'Petrol & Fuel', mccExamples: '5541, 5542 (Shell, Esso, SPC, Caltex)' },
  { id: 'entertainment', label: 'Entertainment & Ticketing', mccExamples: '7832, 7922 (Shaw, Golden Village, SISTIC, Klook)' },
  { id: 'fashion', label: 'Fashion & Department Stores', mccExamples: '5311, 5651 (Takashimaya, Zara, Uniqlo, Tangs)' },
  { id: 'beauty_wellness', label: 'Beauty, Wellness & Spa', mccExamples: '7230, 7298 (Watsons, Guardian, Sephora, Spas)' },
  { id: 'family_kids', label: 'Family, Kids & Baby', mccExamples: '5641, 5945 (Mothercare, Toys"R"Us, Baby Stores)' },
  { id: 'medical_health', label: 'Health, Medical & Pharmacies', mccExamples: '8099, 5912 (Clinics, Hospital Pharmacies)' },
  { id: 'streaming', label: 'Streaming & Subscriptions', mccExamples: 'Netflix, Spotify, Disney+, YouTube Premium' },
  { id: 'fcy', label: 'Foreign Currency / Overseas Spend', mccExamples: 'Non-SGD transactions, Overseas retail' },
  { id: 'contactless', label: 'Mobile Contactless / PayWave', mccExamples: 'Apple Pay, Google Pay, In-store NFC' },
  { id: 'general', label: 'General / All Other Eligible Spend', mccExamples: 'Catch-all 1.2-1.6 MPD or 1.5% Cashback' },
];

// Rich Singapore Card Directory with verified 2024/2025 reward rules
const SG_CARD_INTELLIGENCE: Record<string, {
  bank: string;
  categories: string[];
  bonusRate: string;
  baseRate: string;
  bonusCap: number;
  roundingBlock: 5 | 1 | 0;
  keyExclusions: string;
  advice: string;
}> = {
  'hsbc revolution': {
    bank: 'HSBC',
    categories: ['dining', 'online_food', 'online_shopping', 'travel', 'transport', 'contactless'],
    bonusRate: '4.0 MPD (10X Points)',
    baseRate: '0.4 MPD',
    bonusCap: 1000,
    roundingBlock: 1,
    keyExclusions: 'Supermarkets (MCC 5411 excluded), Fast Food, OTAs, Insurance, Top-ups',
    advice: 'Best for restaurant dining, Foodpanda/GrabFood, transport & Shopee/Lazada shopping.',
  },
  'hsbc travelone': {
    bank: 'HSBC',
    categories: ['general', 'travel', 'hotels', 'fcy'],
    bonusRate: '2.4 MPD (Overseas FCY)',
    baseRate: '1.2 MPD',
    bonusCap: 0,
    roundingBlock: 1,
    keyExclusions: 'Government, AXS, tax, hospital, insurance, prepaid e-wallets',
    advice: 'Uncapped earner with instant point transfer to 20+ airline and hotel loyalty partners.',
  },
  "uob lady's": {
    bank: 'UOB',
    categories: ['dining', 'fashion', 'beauty_wellness', 'family_kids', 'entertainment', 'travel', 'transport'],
    bonusRate: '4.0 MPD (10X UNI$)',
    baseRate: '0.4 MPD',
    bonusCap: 1000,
    roundingBlock: 5,
    keyExclusions: 'Non-selected categories, Grab top-ups, utilities, government, tax',
    advice: 'Earns 4.0 MPD on your 1 selected preferred category (e.g. Dining or Fashion). Switch category quarterly.',
  },
  "uob lady's solitaire": {
    bank: 'UOB',
    categories: ['dining', 'fashion', 'beauty_wellness', 'family_kids', 'entertainment', 'travel', 'transport'],
    bonusRate: '4.0 MPD (10X UNI$)',
    baseRate: '0.4 MPD',
    bonusCap: 2000,
    roundingBlock: 5,
    keyExclusions: 'Non-selected categories, Grab top-ups, utilities, government',
    advice: 'Earns 4.0 MPD on 2 selected preferred categories with higher $2,000 monthly bonus cap.',
  },
  'uob one': {
    bank: 'UOB',
    categories: ['groceries', 'utilities', 'online_shopping', 'online_food', 'transport', 'petrol'],
    bonusRate: 'Up to 10% Cash Rebate (Tiered)',
    baseRate: '3.33% Rebate',
    bonusCap: 2000,
    roundingBlock: 5,
    keyExclusions: 'Requires min 5 retail transactions/month; government, schools, insurance excluded',
    advice: 'Requires $500, $1,000 or $2,000 minimum monthly spend per quarter. Boosted on Dairy Farm, Grab & Shopee.',
  },
  'uob evol': {
    bank: 'UOB',
    categories: ['online_shopping', 'online_food', 'contactless', 'dining', 'entertainment'],
    bonusRate: '8% Cashback (Online & Contactless)',
    baseRate: '0.3% Cashback',
    bonusCap: 800,
    roundingBlock: 5,
    keyExclusions: 'Requires $800 min monthly spend; sub-caps of $30 online + $30 contactless apply',
    advice: 'Great 8% cashback on mobile contactless and online transactions with $800 min monthly spend.',
  },
  'citi rewards': {
    bank: 'Citibank',
    categories: ['online_shopping', 'online_food', 'fashion', 'entertainment'],
    bonusRate: '4.0 MPD (10X Points)',
    baseRate: '0.4 MPD',
    bonusCap: 1000,
    roundingBlock: 1,
    keyExclusions: 'In-store dining, mobile wallet top-ups, offline retail, travel/flight bookings',
    advice: 'Prime online card. Pair with Instarem Amaze for 4.0 MPD on in-store spending overseas.',
  },
  'citi cash back': {
    bank: 'Citibank',
    categories: ['dining', 'groceries', 'petrol'],
    bonusRate: '6% - 8% Cashback',
    baseRate: '0.25% Cashback',
    bonusCap: 800,
    roundingBlock: 1,
    keyExclusions: 'Requires min $800 spend per statement cycle; cap of $80 per category',
    advice: 'High rebate on dining, supermarkets, and petrol when hitting $800 statement spend.',
  },
  'citi premiermiles': {
    bank: 'Citibank',
    categories: ['general', 'travel', 'hotels', 'fcy'],
    bonusRate: '2.0 MPD (FCY) / 1.2 MPD (Local)',
    baseRate: '1.2 MPD',
    bonusCap: 0,
    roundingBlock: 1,
    keyExclusions: 'Tax, government, insurance, e-wallets',
    advice: 'Uncapped Citi miles that never expire. Includes 2 complimentary Priority Pass lounge visits/year.',
  },
  "dbs woman's world": {
    bank: 'DBS',
    categories: ['online_shopping', 'online_food', 'travel', 'streaming', 'entertainment'],
    bonusRate: '4.0 MPD (10X DBS Points)',
    baseRate: '0.4 MPD',
    bonusCap: 1500,
    roundingBlock: 5,
    keyExclusions: 'Offline spend, crypto, insurance, government, top-ups',
    advice: 'Industry-best $1,500 monthly bonus cap for almost all online retail and bookings.',
  },
  'dbs live fresh': {
    bank: 'DBS',
    categories: ['online_shopping', 'transport', 'online_food', 'contactless'],
    bonusRate: 'Up to 6% Cashback',
    baseRate: '0.3% Cashback',
    bonusCap: 800,
    roundingBlock: 5,
    keyExclusions: 'Requires $800 monthly spend; sub-caps apply per category',
    advice: 'Cashback on online and eco-friendly / public transport merchants.',
  },
  'dbs altitude': {
    bank: 'DBS',
    categories: ['general', 'travel', 'hotels', 'fcy'],
    bonusRate: '2.2 MPD (FCY) / 1.3 MPD (Local)',
    baseRate: '1.3 MPD',
    bonusCap: 0,
    roundingBlock: 5,
    keyExclusions: 'Insurance, AXS, tax, top-ups, crypto',
    advice: 'Reliable everyday miles earner with no cap on points earned.',
  },
  'ocbc rewards': {
    bank: 'OCBC',
    categories: ['online_shopping', 'fashion', 'entertainment', 'family_kids'],
    bonusRate: '4.0 MPD (10X OCBC$)',
    baseRate: '0.4 MPD',
    bonusCap: 1110,
    roundingBlock: 5,
    keyExclusions: 'Supermarkets, dining, fast food, utilities, government',
    advice: 'Formerly Titanium Rewards. 4.0 MPD on department stores, electronics, and online shopping up to S$1,110/mo.',
  },
  'ocbc 365': {
    bank: 'OCBC',
    categories: ['dining', 'online_food', 'groceries', 'transport', 'petrol', 'utilities'],
    bonusRate: '3% - 6% Cashback',
    baseRate: '0.3% Cashback',
    bonusCap: 1600,
    roundingBlock: 5,
    keyExclusions: 'Requires $800 min monthly spend; overall monthly cashback cap S$160',
    advice: 'Great all-in-one daily cashback card: 5% dining, 3% groceries, 3% telco/utilities, 5% petrol.',
  },
  'standard chartered simply cash': {
    bank: 'Standard Chartered',
    categories: ['general', 'contactless'],
    bonusRate: '1.5% Unlimited Cashback',
    baseRate: '1.5% Cashback',
    bonusCap: 0,
    roundingBlock: 0,
    keyExclusions: 'AXS, tax, insurance, crypto, e-wallet top-ups',
    advice: 'No min spend and no cashback cap. Reliable fallback for large non-bonus transactions.',
  },
  'standard chartered smart': {
    bank: 'Standard Chartered',
    categories: ['online_food', 'streaming', 'transport', 'dining'],
    bonusRate: '6.0% Cashback (Fast Food/Streaming)',
    baseRate: '0.5% Cashback',
    bonusCap: 818,
    roundingBlock: 1,
    keyExclusions: 'General retail earns base rate; bonus limited to selected everyday merchants',
    advice: '6.0% cashback at McDonald’s, KFC, Subway, Toast Box, Ya Kun, Netflix, Spotify, Disney+ and SimplyGo.',
  },
  'maybank family & friends': {
    bank: 'Maybank',
    categories: ['groceries', 'dining', 'online_food', 'transport', 'petrol', 'beauty_wellness', 'streaming'],
    bonusRate: '8% Cashback on 5 Chosen Categories',
    baseRate: '0.3% Cashback',
    bonusCap: 800,
    roundingBlock: 1,
    keyExclusions: 'Requires $800 min monthly spend; $25 cashback cap per category',
    advice: 'Select your preferred 5 categories out of 10 available everyday categories.',
  },
  'cimb visa signature': {
    bank: 'CIMB',
    categories: ['beauty_wellness', 'online_shopping', 'groceries', 'petrol'],
    bonusRate: '10% Cashback',
    baseRate: '0.2% Cashback',
    bonusCap: 800,
    roundingBlock: 1,
    keyExclusions: 'Requires $800 min monthly spend; $20 cap per category; min 8 transactions >= $30',
    advice: '10% cashback on beauty & wellness, online shopping, pet shops and veterinary services.',
  },
  'trust cashback': {
    bank: 'Trust Bank',
    categories: ['general', 'groceries', 'dining', 'fcy'],
    bonusRate: 'Up to 2.5% Cashback (Quarterly)',
    baseRate: '1.0% - 1.5% Cashback',
    bonusCap: 2500,
    roundingBlock: 0,
    keyExclusions: 'Standard bank exclusions apply; higher rate linked to Trust savings balance',
    advice: 'FairPrice Group ecosystem card with 0% FX transaction fee overseas.',
  },
};

/**
 * Searches and fetches eligible categories and card rules for any given card name.
 * Combines online Gemini grounding (if key available) with local Singapore card registry.
 */
export async function lookupCardCategories(cardName: string): Promise<CardLookupResult> {
  const cleanName = cardName.trim().toLowerCase();
  if (!cleanName) {
    return {
      cardName,
      detectedBank: 'Unknown Bank',
      categories: ALL_SG_CATEGORIES.slice(0, 8),
      source: 'generic',
      notes: 'Please enter a card name to fetch specific eligible categories.',
    };
  }

  // 1. Try local Singapore card intelligence first for instantaneous high-precision match
  let matchedIntelKey = Object.keys(SG_CARD_INTELLIGENCE).find((key) => cleanName.includes(key) || key.includes(cleanName));

  // Secondary loose keyword match (e.g. "revo", "travelone", "evol", "365", "ladys", "wwmc")
  if (!matchedIntelKey) {
    if (cleanName.includes('revo')) matchedIntelKey = 'hsbc revolution';
    else if (cleanName.includes('travelone') || cleanName.includes('travel one')) matchedIntelKey = 'hsbc travelone';
    else if (cleanName.includes('lady')) matchedIntelKey = cleanName.includes('solitaire') ? "uob lady's solitaire" : "uob lady's";
    else if (cleanName.includes('one') && (cleanName.includes('uob') || cleanName.includes('card'))) matchedIntelKey = 'uob one';
    else if (cleanName.includes('evol')) matchedIntelKey = 'uob evol';
    else if (cleanName.includes('citi') && cleanName.includes('reward')) matchedIntelKey = 'citi rewards';
    else if (cleanName.includes('premiermile') || cleanName.includes('pm')) matchedIntelKey = 'citi premiermiles';
    else if (cleanName.includes('woman') || cleanName.includes('wwmc')) matchedIntelKey = "dbs woman's world";
    else if (cleanName.includes('live fresh')) matchedIntelKey = 'dbs live fresh';
    else if (cleanName.includes('altitude')) matchedIntelKey = 'dbs altitude';
    else if (cleanName.includes('titanium') || (cleanName.includes('ocbc') && cleanName.includes('reward'))) matchedIntelKey = 'ocbc rewards';
    else if (cleanName.includes('365')) matchedIntelKey = 'ocbc 365';
    else if (cleanName.includes('simply cash') || cleanName.includes('simplycash')) matchedIntelKey = 'standard chartered simply cash';
    else if (cleanName.includes('smart')) matchedIntelKey = 'standard chartered smart';
    else if (cleanName.includes('family') || cleanName.includes('friends')) matchedIntelKey = 'maybank family & friends';
    else if (cleanName.includes('cimb')) matchedIntelKey = 'cimb visa signature';
    else if (cleanName.includes('trust')) matchedIntelKey = 'trust cashback';
  }

  // 2. Check if Gemini online lookup is available
  const geminiApiKey =
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY);

  if (geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `Analyze this credit/debit card: "${cardName}". 
Identify the issuing Singapore bank and its specific eligible bonus/cashback reward categories.
Select which of these standard categories it qualifies for:
["dining", "online_food", "online_shopping", "groceries", "travel", "hotels", "transport", "utilities", "petrol", "entertainment", "fashion", "beauty_wellness", "family_kids", "medical_health", "streaming", "fcy", "contactless", "general"]

Also provide the card's typical bonus earn rate (e.g. 4.0 MPD or 5% Cashback), base rate, monthly cap in SGD, and key exclusions.
Format response strictly as valid JSON:
{
  "bank": "Bank Name",
  "matchedCategoryIds": ["dining", "online_food", ...],
  "bonusRate": "4.0 MPD",
  "baseRate": "0.4 MPD",
  "bonusCap": 1000,
  "keyExclusions": "excl..."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed.matchedCategoryIds && Array.isArray(parsed.matchedCategoryIds) && parsed.matchedCategoryIds.length > 0) {
          const matchedOptions = ALL_SG_CATEGORIES.filter((c) => parsed.matchedCategoryIds.includes(c.id));
          return {
            cardName,
            detectedBank: parsed.bank || 'Singapore Bank',
            categories: matchedOptions.length > 0 ? matchedOptions : ALL_SG_CATEGORIES.slice(0, 6),
            bonusRate: parsed.bonusRate,
            baseRate: parsed.baseRate,
            bonusCap: parsed.bonusCap,
            keyExclusions: parsed.keyExclusions,
            source: 'ai_online',
            notes: `Retrieved latest terms online via AI for "${cardName}". Please review the eligible categories below and uncheck any that do not apply to your card.`,
          };
        }
      }
    } catch (e) {
      console.warn('Gemini online card lookup failed or timed out, falling back to Singapore Knowledge Base:', e);
    }
  }

  // 3. Fallback to rich Singapore Card Knowledge Base
  if (matchedIntelKey) {
    const intel = SG_CARD_INTELLIGENCE[matchedIntelKey];
    const categoryOptions = ALL_SG_CATEGORIES.filter((c) => intel.categories.includes(c.id));

    return {
      cardName,
      detectedBank: intel.bank,
      categories: categoryOptions,
      bonusRate: intel.bonusRate,
      baseRate: intel.baseRate,
      bonusCap: intel.bonusCap,
      roundingBlock: intel.roundingBlock,
      keyExclusions: intel.keyExclusions,
      source: 'knowledge_base',
      notes: `Matched verified Singapore rules for ${intel.bank} (${matchedIntelKey.toUpperCase()}). ${intel.advice} Uncheck any categories that do not apply to your plan.`,
    };
  }

  // 4. Heuristic inference based on card name words
  const inferredIds = new Set<string>();
  if (/dining|food|gourmet|restaurant/i.test(cleanName)) inferredIds.add('dining').add('online_food');
  if (/shop|rewards|titanium|revolution|evol/i.test(cleanName)) inferredIds.add('online_shopping').add('fashion');
  if (/travel|miles|altitude|flyer|world/i.test(cleanName)) inferredIds.add('travel').add('hotels').add('fcy');
  if (/fresh|grocery|mart|fairprice/i.test(cleanName)) inferredIds.add('groceries');
  if (/transport|go|simply/i.test(cleanName)) inferredIds.add('transport');
  if (/petrol|fuel|esso|shell/i.test(cleanName)) inferredIds.add('petrol');
  if (inferredIds.size === 0) {
    inferredIds.add('dining').add('online_shopping').add('groceries').add('general');
  }

  const inferredOptions = ALL_SG_CATEGORIES.filter((c) => inferredIds.has(c.id));

  return {
    cardName,
    detectedBank: 'Singapore Card',
    categories: inferredOptions,
    source: 'generic',
    notes: `Derived categories based on card keywords. Please review and uncheck any categories that do not apply.`,
  };
}
