/**
 * mccService.ts / mccService.js
 * Service for fetching Merchant Category Codes (MCC) from the CheckMCC Singapore API (https://www.check-mcc.sg)
 * Includes rate-limit protection (100 requests per 15 minutes), in-memory query caching, and robust offline fallback.
 */

export interface MccSearchResult {
  mcc: string; // 4-digit MCC code e.g. "5411"
  merchantName: string;
  category: string;
  description?: string;
  source: 'live_api' | 'cache' | 'local_database';
}

export interface MccServiceResponse {
  success: boolean;
  data: MccSearchResult | null;
  error?: string;
  rateLimitRemaining?: number;
}

// Rate Limiting constants (100 requests per 15 minutes)
const MAX_REQUESTS_PER_WINDOW = 100;
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 mins

interface RateLimitTracker {
  timestamps: number[];
}

const rateTracker: RateLimitTracker = {
  timestamps: [],
};

// In-memory query cache to avoid redundant network round-trips
const queryCache = new Map<string, { result: MccSearchResult | null; cachedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

// Comprehensive Singapore Offline Fallback Directory
const SG_OFFLINE_MCC_REGISTRY: Record<string, { mcc: string; category: string; description: string }> = {
  fairprice: { mcc: '5411', category: 'Grocery Stores, Supermarkets', description: 'NTUC FairPrice, FairPrice Finest, Xtra' },
  'cold storage': { mcc: '5411', category: 'Grocery Stores, Supermarkets', description: 'Cold Storage / CS Fresh Supermarket' },
  'don don donki': { mcc: '5411', category: 'Grocery Stores, Supermarkets', description: 'Don Don Donki Japanese Discount Supermarket' },
  donki: { mcc: '5411', category: 'Grocery Stores, Supermarkets', description: 'Don Don Donki Japanese Discount Supermarket' },
  'sheng siong': { mcc: '5411', category: 'Grocery Stores, Supermarkets', description: 'Sheng Siong Supermarket' },
  shengsiong: { mcc: '5411', category: 'Grocery Stores, Supermarkets', description: 'Sheng Siong Supermarket' },
  meidiya: { mcc: '5411', category: 'Grocery Stores, Supermarkets', description: 'Meidi-Ya Japanese Supermarket' },
  shopee: { mcc: '5311', category: 'Department Stores / Online Marketplaces', description: 'Shopee Singapore e-Commerce' },
  lazada: { mcc: '5311', category: 'Department Stores / Online Marketplaces', description: 'Lazada Singapore e-Commerce' },
  amazon: { mcc: '5311', category: 'Department Stores / Online Marketplaces', description: 'Amazon.sg Retail & Prime' },
  taobao: { mcc: '5311', category: 'Department Stores / Online Marketplaces', description: 'Taobao Online Shopping' },
  qoo10: { mcc: '5311', category: 'Department Stores / Online Marketplaces', description: 'Qoo10 Online Shopping' },
  grab: { mcc: '5814', category: 'Fast Food Restaurants / Deliveries', description: 'GrabFood / GrabPay Deliveries' },
  grabfood: { mcc: '5814', category: 'Fast Food Restaurants / Deliveries', description: 'GrabFood Singapore' },
  foodpanda: { mcc: '5814', category: 'Fast Food Restaurants / Deliveries', description: 'Foodpanda Singapore Deliveries' },
  deliveroo: { mcc: '5814', category: 'Fast Food Restaurants / Deliveries', description: 'Deliveroo Singapore Food' },
  mcdonalds: { mcc: '5814', category: 'Fast Food Restaurants', description: 'McDonalds Fast Food' },
  kfc: { mcc: '5814', category: 'Fast Food Restaurants', description: 'KFC Singapore' },
  subway: { mcc: '5814', category: 'Fast Food Restaurants', description: 'Subway Fast Food' },
  'hai di lao': { mcc: '5812', category: 'Eating Places, Restaurants', description: 'Haidilao Hotpot Dining' },
  haidilao: { mcc: '5812', category: 'Eating Places, Restaurants', description: 'Haidilao Hotpot Dining' },
  din_tai_fung: { mcc: '5812', category: 'Eating Places, Restaurants', description: 'Din Tai Fung Restaurant' },
  'din tai fung': { mcc: '5812', category: 'Eating Places, Restaurants', description: 'Din Tai Fung Restaurant' },
  starbucks: { mcc: '5814', category: 'Fast Food Restaurants / Cafes', description: 'Starbucks Coffee' },
  'sp services': { mcc: '4900', category: 'Utilities - Electric, Gas, Sanitary, Water', description: 'SP Group Electricity & Water' },
  'sp group': { mcc: '4900', category: 'Utilities - Electric, Gas, Sanitary, Water', description: 'SP Group Power & Utilities' },
  singtel: { mcc: '4814', category: 'Telecommunication Services', description: 'Singtel Fiber Broadband & Mobile' },
  starhub: { mcc: '4814', category: 'Telecommunication Services', description: 'Starhub Telecom & Cable' },
  m1: { mcc: '4814', category: 'Telecommunication Services', description: 'M1 Telecom Services' },
  netflix: { mcc: '5815', category: 'Digital Goods - Media, Books, Movies, Music', description: 'Netflix Streaming' },
  spotify: { mcc: '5815', category: 'Digital Goods - Media, Books, Movies, Music', description: 'Spotify Music Streaming' },
  uniqlo: { mcc: '5651', category: 'Family Clothing Stores', description: 'Uniqlo Apparel' },
  zara: { mcc: '5651', category: 'Family Clothing Stores', description: 'Zara Fashion' },
  scoot: { mcc: '4511', category: 'Airlines & Air Carriers', description: 'FlyScoot Airlines' },
  'singapore airlines': { mcc: '4511', category: 'Airlines & Air Carriers', description: 'Singapore Airlines SIA' },
  ikea: { mcc: '5712', category: 'Furniture, Home Furnishings Stores', description: 'IKEA Furniture & Homeware' },
};

/**
 * Checks and updates rate limit timestamps
 */
function checkRateLimit(): { isRateLimited: boolean; remainingRequests: number } {
  const now = Date.now();
  // Filter out timestamps outside the 15-minute window
  rateTracker.timestamps = rateTracker.timestamps.filter((ts) => now - ts < WINDOW_DURATION_MS);

  const requestCount = rateTracker.timestamps.length;
  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - requestCount);

  if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
    return { isRateLimited: true, remainingRequests: 0 };
  }

  // Record this request
  rateTracker.timestamps.push(now);
  return { isRateLimited: false, remainingRequests: remaining - 1 };
}

/**
 * Searches CheckMCC API for a merchant's exact 4-digit MCC and category
 * @param query Merchant name string, e.g. "FairPrice", "GrabFood", "Shopee"
 */
export async function searchMerchantMcc(query: string): Promise<MccServiceResponse> {
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    return { success: true, data: null };
  }

  // 1. Check local in-memory cache first
  const cached = queryCache.get(cleanQuery);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return {
      success: true,
      data: cached.result ? { ...cached.result, source: 'cache' } : null,
      rateLimitRemaining: MAX_REQUESTS_PER_WINDOW - rateTracker.timestamps.length,
    };
  }

  // 2. Check rate limit
  const { isRateLimited, remainingRequests } = checkRateLimit();
  if (isRateLimited) {
    // If rate-limited, try local database fallback before returning error
    const localMatch = findInLocalRegistry(cleanQuery);
    if (localMatch) {
      return {
        success: true,
        data: localMatch,
        error: 'CheckMCC rate limit reached (100 reqs/15m). Used local Singapore directory.',
        rateLimitRemaining: 0,
      };
    }

    return {
      success: false,
      data: null,
      error: 'CheckMCC API rate limit exceeded (100 requests per 15 minutes). Please try again shortly.',
      rateLimitRemaining: 0,
    };
  }

  // 3. Make asynchronous request to CheckMCC API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const apiUrl = `https://www.check-mcc.sg/api/store/search?q=${encodeURIComponent(cleanQuery)}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const localMatch = findInLocalRegistry(cleanQuery);
      return {
        success: true,
        data: localMatch,
        error: 'Rate limit (429) received from CheckMCC. Serving fallback results.',
        rateLimitRemaining: 0,
      };
    }

    if (response.ok) {
      const data = await response.json();

      // CheckMCC API typically returns an array of matched stores: [{ store_name, mcc, category, ... }]
      let matchedItem = null;
      if (Array.isArray(data) && data.length > 0) {
        matchedItem = data[0];
      } else if (data && data.results && Array.isArray(data.results) && data.results.length > 0) {
        matchedItem = data.results[0];
      } else if (data && data.mcc) {
        matchedItem = data;
      }

      if (matchedItem && matchedItem.mcc) {
        const result: MccSearchResult = {
          mcc: String(matchedItem.mcc).padStart(4, '0'),
          merchantName: matchedItem.store_name || matchedItem.name || query,
          category: matchedItem.category || matchedItem.mcc_description || 'General Merchant',
          description: matchedItem.description || matchedItem.notes || undefined,
          source: 'live_api',
        };

        // Cache positive result
        queryCache.set(cleanQuery, { result, cachedAt: Date.now() });

        return {
          success: true,
          data: result,
          rateLimitRemaining: remainingRequests,
        };
      }
    }
  } catch (err: unknown) {
    // Network failure, CORS block, or abort in sandboxed environments
    // Gracefully handle by checking local directory
  }

  // 4. Fallback to Local Verified Singapore Registry
  const localResult = findInLocalRegistry(cleanQuery);
  if (localResult) {
    queryCache.set(cleanQuery, { result: localResult, cachedAt: Date.now() });
    return {
      success: true,
      data: localResult,
      rateLimitRemaining: remainingRequests,
    };
  }

  // 5. Empty state (merchant not found)
  queryCache.set(cleanQuery, { result: null, cachedAt: Date.now() });
  return {
    success: true,
    data: null,
    error: `No exact MCC record found for "${query}".`,
    rateLimitRemaining: remainingRequests,
  };
}

function findInLocalRegistry(cleanQuery: string): MccSearchResult | null {
  for (const [key, val] of Object.entries(SG_OFFLINE_MCC_REGISTRY)) {
    if (cleanQuery.includes(key) || key.includes(cleanQuery)) {
      return {
        mcc: val.mcc,
        merchantName: val.description,
        category: val.category,
        description: val.description,
        source: 'local_database',
      };
    }
  }
  return null;
}
