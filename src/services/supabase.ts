import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HouseholdMember, CardMethod, Expense } from '../types';

export const STORAGE_KEY_CUSTOM_SUPABASE_URL = 'SPLITSTACK_SUPABASE_URL';
export const STORAGE_KEY_CUSTOM_SUPABASE_KEY = 'SPLITSTACK_SUPABASE_ANON_KEY';

/**
 * Clean & normalize URL and Key
 */
function cleanCredential(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

/**
 * Retrieve current Supabase credentials from Vite/Vercel env vars or LocalStorage override
 */
export function getSupabaseCredentials(): { url: string; key: string; source: 'env' | 'localStorage' | 'none' } {
  // Check env vars first
  const envUrl = cleanCredential(
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL
  );
  const envKey = cleanCredential(
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.SUPABASE_ANON_KEY
  );

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey, source: 'env' };
  }

  // Check LocalStorage override
  try {
    const localUrl = cleanCredential(localStorage.getItem(STORAGE_KEY_CUSTOM_SUPABASE_URL));
    const localKey = cleanCredential(localStorage.getItem(STORAGE_KEY_CUSTOM_SUPABASE_KEY));
    if (localUrl && localKey) {
      return { url: localUrl, key: localKey, source: 'localStorage' };
    }
  } catch {
    // localStorage not accessible
  }

  return { url: envUrl || '', key: envKey || '', source: 'none' };
}

/**
 * Check if the current config has valid structure
 */
export function checkIsConfigured(): boolean {
  const { url, key } = getSupabaseCredentials();
  return Boolean(
    url &&
    key &&
    (url.startsWith('https://') || url.startsWith('http://')) &&
    key.length > 20
  );
}

// Current singleton instance
let currentClient: SupabaseClient | null = null;
let clientInitialized = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInitialized && currentClient) {
    return currentClient;
  }

  const { url, key } = getSupabaseCredentials();
  if (url && key && (url.startsWith('https://') || url.startsWith('http://')) && key.length > 20) {
    try {
      currentClient = createClient(url, key, {
        auth: {
          persistSession: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      clientInitialized = true;
      return currentClient;
    } catch (e) {
      console.error('Failed to create Supabase client:', e);
      return null;
    }
  }

  return null;
}

export function saveCustomSupabaseConfig(url: string, key: string): boolean {
  const cleanUrl = cleanCredential(url);
  const cleanKey = cleanCredential(key);

  if (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://')) {
    return false;
  }
  if (cleanKey.length < 20) {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_SUPABASE_URL, cleanUrl);
    localStorage.setItem(STORAGE_KEY_CUSTOM_SUPABASE_KEY, cleanKey);
    currentClient = null;
    clientInitialized = false;
    getSupabaseClient();
    return true;
  } catch (err) {
    console.error('Failed to save custom Supabase config:', err);
    return false;
  }
}

export function clearCustomSupabaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_SUPABASE_URL);
    localStorage.removeItem(STORAGE_KEY_CUSTOM_SUPABASE_KEY);
    currentClient = null;
    clientInitialized = false;
  } catch {
    // ignore
  }
}

// Export backward compatible proxy for supabase & isSupabaseConfigured
export const isSupabaseConfigured = checkIsConfigured();
export const supabase = getSupabaseClient();

export interface SupabaseDiagnosticResult {
  isConfigured: boolean;
  source: 'env' | 'localStorage' | 'none';
  url: string;
  connected: boolean;
  tablesExist: {
    members: boolean;
    methods: boolean;
    expenses: boolean;
  };
  rowCounts: {
    members: number;
    methods: number;
    expenses: number;
  };
  errors: string[];
  recommendation?: string;
}

/**
 * Deep diagnostic test to verify Supabase connection, schema tables, and RLS policies
 */
export async function testSupabaseConnection(): Promise<SupabaseDiagnosticResult> {
  const creds = getSupabaseCredentials();
  const client = getSupabaseClient();

  const result: SupabaseDiagnosticResult = {
    isConfigured: checkIsConfigured(),
    source: creds.source,
    url: creds.url,
    connected: false,
    tablesExist: { members: false, methods: false, expenses: false },
    rowCounts: { members: 0, methods: 0, expenses: 0 },
    errors: [],
  };

  if (!client || !result.isConfigured) {
    result.errors.push('Supabase URL or Anon Key is missing or invalid.');
    result.recommendation = 'Enter your Supabase Project URL and Anon Key in the Database Settings dialog or set them in Vercel environment variables.';
    return result;
  }

  try {
    const [mRes, cRes, eRes] = await Promise.all([
      client.from('household_members').select('*', { count: 'exact', head: true }),
      client.from('payment_methods').select('*', { count: 'exact', head: true }),
      client.from('household_expenses').select('*', { count: 'exact', head: true }),
    ]);

    let anySuccess = false;

    if (mRes.error) {
      result.errors.push(`Table 'household_members': ${mRes.error.message} (code: ${mRes.error.code || 'unknown'})`);
    } else {
      result.tablesExist.members = true;
      result.rowCounts.members = mRes.count ?? 0;
      anySuccess = true;
    }

    if (cRes.error) {
      result.errors.push(`Table 'payment_methods': ${cRes.error.message} (code: ${cRes.error.code || 'unknown'})`);
    } else {
      result.tablesExist.methods = true;
      result.rowCounts.methods = cRes.count ?? 0;
      anySuccess = true;
    }

    if (eRes.error) {
      result.errors.push(`Table 'household_expenses': ${eRes.error.message} (code: ${eRes.error.code || 'unknown'})`);
    } else {
      result.tablesExist.expenses = true;
      result.rowCounts.expenses = eRes.count ?? 0;
      anySuccess = true;
    }

    result.connected = anySuccess;

    const allTablesExist = result.tablesExist.members && result.tablesExist.methods && result.tablesExist.expenses;
    if (!allTablesExist) {
      result.recommendation = 'Database tables are missing or not initialized! Copy the SQL Schema and run it in the Supabase Dashboard SQL Editor.';
    } else {
      result.recommendation = 'Connected! All database tables and cross-device sync channels are healthy.';
    }

    return result;
  } catch (err: any) {
    result.errors.push(err?.message || String(err));
    result.recommendation = 'Network error or invalid Supabase URL. Please verify your credentials.';
    return result;
  }
}

/**
 * Fetch all household data from Supabase
 */
export async function fetchHouseholdData(): Promise<{
  success: boolean;
  members: HouseholdMember[] | null;
  paymentMethods: CardMethod[] | null;
  expenses: Expense[] | null;
  error?: string;
  tablesMissing?: boolean;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      members: null,
      paymentMethods: null,
      expenses: null,
      error: 'Supabase client not initialized.',
    };
  }

  try {
    const [membersRes, methodsRes, expensesRes] = await Promise.all([
      client.from('household_members').select('*').order('created_at', { ascending: true }),
      client.from('payment_methods').select('*').order('created_at', { ascending: true }),
      client.from('household_expenses').select('*').order('created_at', { ascending: false }),
    ]);

    // Check for schema/table existence errors
    const errors: string[] = [];
    let tablesMissing = false;

    if (membersRes.error) {
      errors.push(`household_members: ${membersRes.error.message}`);
      if (membersRes.error.code === '42P01' || membersRes.error.message.includes('does not exist')) {
        tablesMissing = true;
      }
    }
    if (methodsRes.error) {
      errors.push(`payment_methods: ${methodsRes.error.message}`);
      if (methodsRes.error.code === '42P01' || methodsRes.error.message.includes('does not exist')) {
        tablesMissing = true;
      }
    }
    if (expensesRes.error) {
      errors.push(`household_expenses: ${expensesRes.error.message}`);
      if (expensesRes.error.code === '42P01' || expensesRes.error.message.includes('does not exist')) {
        tablesMissing = true;
      }
    }

    if (errors.length > 0 && tablesMissing) {
      console.warn('Supabase tables missing:', errors.join(', '));
      return {
        success: false,
        members: null,
        paymentMethods: null,
        expenses: null,
        error: errors.join('; '),
        tablesMissing: true,
      };
    }

    let members: HouseholdMember[] | null = null;
    let paymentMethods: CardMethod[] | null = null;
    let expenses: Expense[] | null = null;

    if (!membersRes.error && membersRes.data) {
      members = membersRes.data.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role || 'member',
        phone: row.phone || '',
        avatarUrl: row.avatar_url || '',
      }));
    }

    if (!methodsRes.error && methodsRes.data) {
      paymentMethods = methodsRes.data.map((row) => ({
        id: row.id,
        badgeCode: row.badge_code || '',
        name: row.name,
        bank: row.bank || '',
        memberId: row.member_id || '',
        type: row.type || 'credit',
        network: row.network || 'Visa',
        last4: row.last4 || '',
        statusTag: row.status_tag || 'Open Buffer',
        statusTagBg: row.status_tag_bg || '#43978D',
        cardSubtitle: row.card_subtitle || '',
        billingCycleType: row.billing_cycle_type || 'calendar',
        billingCycleDesc: row.billing_cycle_desc || '',
        currentSpend: Number(row.current_spend || 0),
        bonusCap: Number(row.bonus_cap || 0),
        minSpendTarget: row.min_spend_target ? Number(row.min_spend_target) : undefined,
        txnTargetReq: row.txn_target_req || undefined,
        maxRebateDesc: row.max_rebate_desc || undefined,
        baseRate: row.base_rate || '0.4 MPD',
        bonusRate: row.bonus_rate || '4.0 MPD',
        roundingBlock: (row.rounding_block ?? 1) as 5 | 1 | 0,
        keyExclusions: row.key_exclusions || '',
        eligibleModes: row.eligible_modes || '',
        overflowRate: row.overflow_rate || undefined,
        pointsExpiry: row.points_expiry || undefined,
        overseasRate: row.overseas_rate || undefined,
        extraBenefit: row.extra_benefit || undefined,
        footerAdvice: row.footer_advice || '',
        footerIcon: row.footer_icon || 'credit_card',
        footerType: row.footer_type || 'success',
        eligibleCategories: Array.isArray(row.eligible_categories) ? row.eligible_categories : [],
        isDefaultPayer: Boolean(row.is_default_payer),
      }));
    }

    if (!expensesRes.error && expensesRes.data) {
      expenses = expensesRes.data.map((row) => ({
        id: row.id,
        date: row.date || '',
        isoDate: row.iso_date || '',
        merchant: row.merchant || '',
        mcc: row.mcc || '',
        category: row.category || '',
        tags: Array.isArray(row.tags) ? row.tags : [],
        amount: Number(row.amount || 0),
        payerId: row.payer_id || '',
        paymentMethodId: row.payment_method_id || '',
        splitMode: row.split_mode || 'equal',
        splitBreakdown:
          typeof row.split_breakdown === 'object' && row.split_breakdown !== null ? row.split_breakdown : {},
        customWeights: row.custom_weights || undefined,
        pairMemberIds: row.pair_member_ids || undefined,
        notes: row.notes || undefined,
        settled: Boolean(row.settled),
        eligibleBlocksAmount: Number(row.eligible_blocks_amount || row.amount || 0),
        rewardEstimated: row.reward_estimated || '',
      }));
    }

    return {
      success: true,
      members,
      paymentMethods,
      expenses,
    };
  } catch (err: any) {
    console.warn('Failed to fetch from Supabase:', err);
    return {
      success: false,
      members: null,
      paymentMethods: null,
      expenses: null,
      error: err?.message || String(err),
    };
  }
}

/**
 * Seed initial data to Supabase if database tables are currently empty
 */
export async function seedInitialDataToSupabase(
  members: HouseholdMember[],
  methods: CardMethod[],
  expenses: Expense[]
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    // 1. Members
    const { count: mCount, error: mCountErr } = await client
      .from('household_members')
      .select('*', { count: 'exact', head: true });

    if (mCountErr) {
      return { success: false, error: `household_members check failed: ${mCountErr.message}` };
    }

    if (mCount === 0 || mCount === null) {
      const { error: mUpsertErr } = await client.from('household_members').upsert(
        members.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          phone: m.phone || null,
          avatar_url: m.avatarUrl || null,
        }))
      );
      if (mUpsertErr) {
        return { success: false, error: `household_members seed failed: ${mUpsertErr.message}` };
      }
    }

    // 2. Payment methods
    const { count: cCount, error: cCountErr } = await client
      .from('payment_methods')
      .select('*', { count: 'exact', head: true });

    if (cCountErr) {
      return { success: false, error: `payment_methods check failed: ${cCountErr.message}` };
    }

    if (cCount === 0 || cCount === null) {
      const { error: cUpsertErr } = await client.from('payment_methods').upsert(
        methods.map((c) => ({
          id: c.id,
          badge_code: c.badgeCode,
          name: c.name,
          bank: c.bank,
          member_id: c.memberId,
          type: c.type,
          network: c.network,
          last4: c.last4,
          status_tag: c.statusTag,
          status_tag_bg: c.statusTagBg,
          card_subtitle: c.cardSubtitle,
          billing_cycle_type: c.billingCycleType,
          billing_cycle_desc: c.billingCycleDesc,
          current_spend: c.currentSpend,
          bonus_cap: c.bonusCap,
          min_spend_target: c.minSpendTarget ?? null,
          txn_target_req: c.txnTargetReq ?? null,
          max_rebate_desc: c.maxRebateDesc ?? null,
          base_rate: c.baseRate,
          bonus_rate: c.bonusRate,
          rounding_block: c.roundingBlock,
          key_exclusions: c.keyExclusions || null,
          eligible_modes: c.eligibleModes || null,
          overflow_rate: c.overflowRate || null,
          points_expiry: c.pointsExpiry || null,
          overseas_rate: c.overseasRate || null,
          extra_benefit: c.extraBenefit || null,
          footer_advice: c.footerAdvice,
          footer_icon: c.footerIcon,
          footer_type: c.footerType,
          eligible_categories: c.eligibleCategories,
          is_default_payer: Boolean(c.isDefaultPayer),
        }))
      );
      if (cUpsertErr) {
        return { success: false, error: `payment_methods seed failed: ${cUpsertErr.message}` };
      }
    }

    // 3. Expenses
    const { count: eCount, error: eCountErr } = await client
      .from('household_expenses')
      .select('*', { count: 'exact', head: true });

    if (eCountErr) {
      return { success: false, error: `household_expenses check failed: ${eCountErr.message}` };
    }

    if (eCount === 0 || eCount === null) {
      const { error: eUpsertErr } = await client.from('household_expenses').upsert(
        expenses.map((e) => ({
          id: e.id,
          date: e.date,
          iso_date: e.isoDate,
          merchant: e.merchant,
          mcc: e.mcc,
          category: e.category,
          tags: e.tags || [],
          amount: e.amount,
          payer_id: e.payerId,
          payment_method_id: e.paymentMethodId,
          split_mode: e.splitMode,
          split_breakdown: e.splitBreakdown || {},
          custom_weights: e.customWeights || null,
          pair_member_ids: e.pairMemberIds || null,
          notes: e.notes || null,
          settled: Boolean(e.settled),
          eligible_blocks_amount: e.eligibleBlocksAmount,
          reward_estimated: e.rewardEstimated || '',
        }))
      );
      if (eUpsertErr) {
        return { success: false, error: `household_expenses seed failed: ${eUpsertErr.message}` };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Failed to seed initial data to Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Push all active local data to Supabase (e.g. from desktop to initialize mobile)
 */
export async function pushAllLocalDataToSupabase(
  members: HouseholdMember[],
  methods: CardMethod[],
  expenses: Expense[]
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    if (members.length > 0) {
      const { error: mErr } = await client.from('household_members').upsert(
        members.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          phone: m.phone || null,
          avatar_url: m.avatarUrl || null,
          updated_at: new Date().toISOString(),
        }))
      );
      if (mErr) throw new Error(`household_members: ${mErr.message}`);
    }

    if (methods.length > 0) {
      const { error: cErr } = await client.from('payment_methods').upsert(
        methods.map((c) => ({
          id: c.id,
          badge_code: c.badgeCode,
          name: c.name,
          bank: c.bank,
          member_id: c.memberId,
          type: c.type,
          network: c.network,
          last4: c.last4,
          status_tag: c.statusTag,
          status_tag_bg: c.statusTagBg,
          card_subtitle: c.cardSubtitle,
          billing_cycle_type: c.billingCycleType,
          billing_cycle_desc: c.billingCycleDesc,
          current_spend: c.currentSpend,
          bonus_cap: c.bonusCap,
          min_spend_target: c.minSpendTarget ?? null,
          txn_target_req: c.txnTargetReq ?? null,
          max_rebate_desc: c.maxRebateDesc ?? null,
          base_rate: c.baseRate,
          bonus_rate: c.bonusRate,
          rounding_block: c.roundingBlock,
          key_exclusions: c.keyExclusions || null,
          eligible_modes: c.eligibleModes || null,
          overflow_rate: c.overflowRate || null,
          points_expiry: c.pointsExpiry || null,
          overseas_rate: c.overseasRate || null,
          extra_benefit: c.extraBenefit || null,
          footer_advice: c.footerAdvice,
          footer_icon: c.footerIcon,
          footer_type: c.footerType,
          eligible_categories: c.eligibleCategories,
          is_default_payer: Boolean(c.isDefaultPayer),
          updated_at: new Date().toISOString(),
        }))
      );
      if (cErr) throw new Error(`payment_methods: ${cErr.message}`);
    }

    if (expenses.length > 0) {
      const { error: eErr } = await client.from('household_expenses').upsert(
        expenses.map((e) => ({
          id: e.id,
          date: e.date,
          iso_date: e.isoDate,
          merchant: e.merchant,
          mcc: e.mcc,
          category: e.category,
          tags: e.tags || [],
          amount: e.amount,
          payer_id: e.payerId,
          payment_method_id: e.paymentMethodId,
          split_mode: e.splitMode,
          split_breakdown: e.splitBreakdown || {},
          custom_weights: e.customWeights || null,
          pair_member_ids: e.pairMemberIds || null,
          notes: e.notes || null,
          settled: Boolean(e.settled),
          eligible_blocks_amount: e.eligibleBlocksAmount,
          reward_estimated: e.rewardEstimated || '',
          updated_at: new Date().toISOString(),
        }))
      );
      if (eErr) throw new Error(`household_expenses: ${eErr.message}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to push all local data to Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save an expense to Supabase
 */
export async function saveExpenseToSupabase(expense: Expense): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client.from('household_expenses').upsert({
      id: expense.id,
      date: expense.date,
      iso_date: expense.isoDate,
      merchant: expense.merchant,
      mcc: expense.mcc,
      category: expense.category,
      tags: expense.tags || [],
      amount: expense.amount,
      payer_id: expense.payerId,
      payment_method_id: expense.paymentMethodId,
      split_mode: expense.splitMode,
      split_breakdown: expense.splitBreakdown || {},
      custom_weights: expense.customWeights || null,
      pair_member_ids: expense.pairMemberIds || null,
      settled: Boolean(expense.settled),
      eligible_blocks_amount: expense.eligibleBlocksAmount,
      reward_estimated: expense.rewardEstimated || '',
      notes: expense.notes || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Supabase error saving expense:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Exception saving expense to Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Delete an expense from Supabase
 */
export async function deleteExpenseFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client.from('household_expenses').delete().eq('id', id);
    if (error) {
      console.error('Supabase error deleting expense:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Exception deleting expense from Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Clear expenses from Supabase
 */
export async function clearExpensesFromSupabase(idsToRemove: string[]): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client || idsToRemove.length === 0) return { success: true };

  try {
    const { error } = await client.from('household_expenses').delete().in('id', idsToRemove);
    if (error) {
      console.error('Supabase error clearing expenses:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Exception clearing expenses from Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Update settled status in Supabase
 */
export async function updateExpensesSettledInSupabase(
  ids: string[],
  settled: boolean
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client || ids.length === 0) return { success: true };

  try {
    const { error } = await client.from('household_expenses').update({ settled }).in('id', ids);
    if (error) {
      console.error('Supabase error updating settled:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Exception updating settled in Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save a payment method to Supabase
 */
export async function savePaymentMethodToSupabase(card: CardMethod): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client.from('payment_methods').upsert({
      id: card.id,
      badge_code: card.badgeCode,
      name: card.name,
      bank: card.bank,
      member_id: card.memberId,
      type: card.type,
      network: card.network,
      last4: card.last4,
      status_tag: card.statusTag,
      status_tag_bg: card.statusTagBg,
      card_subtitle: card.cardSubtitle,
      billing_cycle_type: card.billingCycleType,
      billing_cycle_desc: card.billingCycleDesc,
      current_spend: card.currentSpend,
      bonus_cap: card.bonusCap,
      min_spend_target: card.minSpendTarget ?? null,
      txn_target_req: card.txnTargetReq ?? null,
      max_rebate_desc: card.maxRebateDesc ?? null,
      base_rate: card.baseRate,
      bonus_rate: card.bonusRate,
      rounding_block: card.roundingBlock,
      key_exclusions: card.keyExclusions || null,
      eligible_modes: card.eligibleModes || null,
      overflow_rate: card.overflowRate || null,
      points_expiry: card.pointsExpiry || null,
      overseas_rate: card.overseasRate || null,
      extra_benefit: card.extraBenefit || null,
      footer_advice: card.footerAdvice,
      footer_icon: card.footerIcon,
      footer_type: card.footerType,
      eligible_categories: card.eligibleCategories,
      is_default_payer: Boolean(card.isDefaultPayer),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Supabase error saving payment method:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Exception saving payment method to Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Delete a payment method from Supabase
 */
export async function deletePaymentMethodFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client.from('payment_methods').delete().eq('id', id);
    if (error) {
      console.error('Supabase error deleting payment method:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Exception deleting payment method from Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Save a household member to Supabase
 */
export async function saveMemberToSupabase(member: HouseholdMember): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client.from('household_members').upsert({
      id: member.id,
      name: member.name,
      role: member.role,
      phone: member.phone || null,
      avatar_url: member.avatarUrl || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Supabase error saving member:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Exception saving member to Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Delete a household member from Supabase
 */
export async function deleteMemberFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client.from('household_members').delete().eq('id', id);
    if (error) {
      console.error('Supabase error deleting member:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Exception deleting member from Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}
