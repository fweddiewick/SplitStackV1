import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HouseholdMember, CardMethod, Expense } from '../types';

// Detect Supabase environment variables from Vite or Vercel
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
  (import.meta.env.SUPABASE_URL as string) ||
  '';

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.SUPABASE_ANON_KEY as string) ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseUrl.includes('supabase.co') &&
  supabaseAnonKey.length > 20
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Fetch all household data from Supabase
 */
export async function fetchHouseholdData(): Promise<{
  members: HouseholdMember[] | null;
  paymentMethods: CardMethod[] | null;
  expenses: Expense[] | null;
}> {
  if (!supabase) return { members: null, paymentMethods: null, expenses: null };

  try {
    const [membersRes, methodsRes, expensesRes] = await Promise.all([
      supabase.from('household_members').select('*').order('created_at', { ascending: true }),
      supabase.from('payment_methods').select('*').order('created_at', { ascending: true }),
      supabase.from('household_expenses').select('*').order('created_at', { ascending: false }),
    ]);

    let members: HouseholdMember[] | null = null;
    let paymentMethods: CardMethod[] | null = null;
    let expenses: Expense[] | null = null;

    if (!membersRes.error && membersRes.data && membersRes.data.length > 0) {
      members = membersRes.data.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role || 'member',
        phone: row.phone || '',
        avatarUrl: row.avatar_url || '',
      }));
    }

    if (!methodsRes.error && methodsRes.data && methodsRes.data.length > 0) {
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
        baseRate: row.base_rate || '0.4 MPD',
        bonusRate: row.bonus_rate || '4.0 MPD',
        roundingBlock: (row.rounding_block ?? 1) as 5 | 1 | 0,
        keyExclusions: row.key_exclusions || '',
        eligibleModes: row.eligible_modes || '',
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
        splitBreakdown: typeof row.split_breakdown === 'object' && row.split_breakdown !== null ? row.split_breakdown : {},
        customWeights: row.custom_weights || undefined,
        pairMemberIds: row.pair_member_ids || undefined,
        notes: row.notes || undefined,
        settled: Boolean(row.settled),
        eligibleBlocksAmount: Number(row.eligible_blocks_amount || row.amount || 0),
        rewardEstimated: row.reward_estimated || '',
      }));
    }

    return { members, paymentMethods, expenses };
  } catch (err) {
    console.warn('Failed to fetch from Supabase:', err);
    return { members: null, paymentMethods: null, expenses: null };
  }
}

/**
 * Seed initial data to Supabase if database tables are currently empty
 */
export async function seedInitialDataToSupabase(
  members: HouseholdMember[],
  methods: CardMethod[],
  expenses: Expense[]
): Promise<boolean> {
  if (!supabase) return false;

  try {
    // Check if tables are empty
    const { count: mCount } = await supabase.from('household_members').select('*', { count: 'exact', head: true });
    if (mCount === 0 || mCount === null) {
      await supabase.from('household_members').upsert(
        members.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          phone: m.phone,
          avatar_url: m.avatarUrl,
        }))
      );
    }

    const { count: cCount } = await supabase.from('payment_methods').select('*', { count: 'exact', head: true });
    if (cCount === 0 || cCount === null) {
      await supabase.from('payment_methods').upsert(
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
          base_rate: c.baseRate,
          bonus_rate: c.bonusRate,
          rounding_block: c.roundingBlock,
          key_exclusions: c.keyExclusions,
          eligible_modes: c.eligibleModes,
          footer_advice: c.footerAdvice,
          footer_icon: c.footerIcon,
          footer_type: c.footerType,
          eligible_categories: c.eligibleCategories,
          is_default_payer: c.isDefaultPayer,
        }))
      );
    }

    const { count: eCount } = await supabase.from('household_expenses').select('*', { count: 'exact', head: true });
    if (eCount === 0 || eCount === null) {
      await supabase.from('household_expenses').upsert(
        expenses.map((e) => ({
          id: e.id,
          date: e.date,
          iso_date: e.isoDate,
          merchant: e.merchant,
          mcc: e.mcc,
          category: e.category,
          tags: e.tags,
          amount: e.amount,
          payer_id: e.payerId,
          payment_method_id: e.paymentMethodId,
          split_mode: e.splitMode,
          split_breakdown: e.splitBreakdown,
          custom_weights: e.customWeights,
          pair_member_ids: e.pairMemberIds,
          settled: e.settled,
          eligible_blocks_amount: e.eligibleBlocksAmount,
          reward_estimated: e.rewardEstimated,
        }))
      );
    }

    return true;
  } catch (err) {
    console.warn('Failed to seed initial data to Supabase:', err);
    return false;
  }
}

/**
 * Save an expense to Supabase
 */
export async function saveExpenseToSupabase(expense: Expense): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('household_expenses').upsert({
      id: expense.id,
      date: expense.date,
      iso_date: expense.isoDate,
      merchant: expense.merchant,
      mcc: expense.mcc,
      category: expense.category,
      tags: expense.tags,
      amount: expense.amount,
      payer_id: expense.payerId,
      payment_method_id: expense.paymentMethodId,
      split_mode: expense.splitMode,
      split_breakdown: expense.splitBreakdown,
      custom_weights: expense.customWeights,
      pair_member_ids: expense.pairMemberIds,
      settled: expense.settled,
      eligible_blocks_amount: expense.eligibleBlocksAmount,
      reward_estimated: expense.rewardEstimated,
      notes: expense.notes,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Error saving expense to Supabase:', err);
  }
}

/**
 * Delete an expense from Supabase
 */
export async function deleteExpenseFromSupabase(id: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('household_expenses').delete().eq('id', id);
  } catch (err) {
    console.warn('Error deleting expense from Supabase:', err);
  }
}

/**
 * Clear expenses from Supabase
 */
export async function clearExpensesFromSupabase(idsToRemove: string[]): Promise<void> {
  if (!supabase || idsToRemove.length === 0) return;
  try {
    await supabase.from('household_expenses').delete().in('id', idsToRemove);
  } catch (err) {
    console.warn('Error clearing expenses from Supabase:', err);
  }
}

/**
 * Update settled status in Supabase
 */
export async function updateExpensesSettledInSupabase(ids: string[], settled: boolean): Promise<void> {
  if (!supabase || ids.length === 0) return;
  try {
    await supabase.from('household_expenses').update({ settled }).in('id', ids);
  } catch (err) {
    console.warn('Error updating settled in Supabase:', err);
  }
}

/**
 * Save a payment method to Supabase
 */
export async function savePaymentMethodToSupabase(card: CardMethod): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('payment_methods').upsert({
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
      min_spend_target: card.minSpendTarget,
      base_rate: card.baseRate,
      bonus_rate: card.bonusRate,
      rounding_block: card.roundingBlock,
      key_exclusions: card.keyExclusions,
      eligible_modes: card.eligibleModes,
      footer_advice: card.footerAdvice,
      footer_icon: card.footerIcon,
      footer_type: card.footerType,
      eligible_categories: card.eligibleCategories,
      is_default_payer: card.isDefaultPayer,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Error saving payment method to Supabase:', err);
  }
}

/**
 * Delete a payment method from Supabase
 */
export async function deletePaymentMethodFromSupabase(id: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('payment_methods').delete().eq('id', id);
  } catch (err) {
    console.warn('Error deleting payment method from Supabase:', err);
  }
}

/**
 * Save a household member to Supabase
 */
export async function saveMemberToSupabase(member: HouseholdMember): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('household_members').upsert({
      id: member.id,
      name: member.name,
      role: member.role,
      phone: member.phone,
      avatar_url: member.avatarUrl,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Error saving member to Supabase:', err);
  }
}

/**
 * Delete a household member from Supabase
 */
export async function deleteMemberFromSupabase(id: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('household_members').delete().eq('id', id);
  } catch (err) {
    console.warn('Error deleting member from Supabase:', err);
  }
}
