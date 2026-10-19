import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  HouseholdMember,
  CardMethod,
  Expense,
  TabType,
  ToastNotification,
  SplitMode,
  RecommendationResult,
} from '../types';
import {
  INITIAL_MEMBERS,
  INITIAL_PAYMENT_METHODS,
  INITIAL_EXPENSES,
} from '../data/initialData';
import { executeRecommendCard } from '../mcp/tools';
import { getExpenseMonthKey, isExpenseInMonth, getAvailableMonths } from '../utils/dateUtils';
import {
  isSupabaseConfigured,
  getSupabaseClient,
  checkIsConfigured,
  getSupabaseCredentials,
  fetchHouseholdData,
  seedInitialDataToSupabase,
  pushAllLocalDataToSupabase,
  saveExpenseToSupabase,
  deleteExpenseFromSupabase,
  clearExpensesFromSupabase,
  updateExpensesSettledInSupabase,
  savePaymentMethodToSupabase,
  deletePaymentMethodFromSupabase,
  saveMemberToSupabase,
  deleteMemberFromSupabase,
} from '../services/supabase';

interface AppContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  availableMonths: string[];
  isCloudSynced: boolean;
  syncStatusDetails: string;
  isSyncModalOpen: boolean;
  setIsSyncModalOpen: (open: boolean) => void;
  refreshCloudData: () => Promise<void>;
  pushLocalDataToCloud: () => Promise<boolean>;
  members: HouseholdMember[];
  addMember: (name: string, role?: 'lead' | 'member', phone?: string) => HouseholdMember;
  updateMember: (id: string, updates: Partial<HouseholdMember>) => void;
  deleteMember: (id: string) => void;
  setLeadMember: (id: string) => void;
  paymentMethods: CardMethod[];
  expenses: Expense[];
  toast: ToastNotification | null;
  showToast: (message: string, icon?: string) => void;
  addExpense: (expenseData: Omit<Expense, 'id'>) => Expense;
  deleteExpense: (id: string) => void;
  clearExpensesByMonth: (month?: string) => void;
  addPaymentMethod: (method: Omit<CardMethod, 'id'>) => void;
  updatePaymentMethod: (id: string, updates: Partial<CardMethod>) => void;
  deletePaymentMethod: (id: string) => void;
  setDefaultPayerMethod: (id: string) => void;
  markAllSettled: () => void;
  markDebtSettled: (fromMemberId: string, toMemberId: string) => void;
  calculateSplit: (
    amount: number,
    mode: SplitMode,
    payerId: string,
    pairMemberIds?: [string, string],
    customWeights?: Record<string, number>
  ) => Record<string, number>;
  calculateCardEligibility: (
    card: CardMethod,
    amount: number,
    mcc: string,
    category: string
  ) => {
    isEligible: boolean;
    eligibleAmount: number;
    slippage: number;
    isCapped: boolean;
    remainingHeadroom: number;
    projectedSpend: number;
    message: string;
    adviceType: 'ok' | 'warning' | 'capped' | 'info';
  };
  recommendBestCard: (merchant: string, mcc?: string, amount?: number) => RecommendationResult | null;
  netBalances: {
    memberNets: Record<string, number>;
    debts: { from: string; fromName: string; to: string; toName: string; amount: number }[];
    totalMonthSpend: number;
    totalActiveTransactions: number;
  };
  syncCardSpendWithExpenses: (targetMonth?: string) => void;
  resetCardSpendTracker: () => void;
  clearAllExpenses: () => void;
  syncData: () => void;
  resetAllData: () => void;
  resetToDefaultMethods: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_MEMBERS = 'splitstack_sg_members_v2';
const STORAGE_KEY_METHODS = 'splitstack_sg_methods_v3';
const STORAGE_KEY_EXPENSES = 'splitstack_sg_expenses_v2';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [toast, setToast] = useState<ToastNotification | null>(null);

  // Household Members state (loaded from localStorage or initial)
  const [members, setMembers] = useState<HouseholdMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEMBERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_MEMBERS;
  });

  // Payment Methods state (initializes to 11 Singapore default methods)
  const [paymentMethods, setPaymentMethods] = useState<CardMethod[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_METHODS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 11) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_PAYMENT_METHODS;
  });

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXPENSES);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_EXPENSES;
  });

  // Dynamically derive available months strictly from logged expenses
  const availableMonths = useMemo(() => {
    return getAvailableMonths(expenses);
  }, [expenses]);

  // Selected Month state (defaults to latest month that has logged transactions)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXPENSES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const months = getAvailableMonths(parsed);
          if (months.length > 0) return months[0];
        }
      }
    } catch {
      // fallback
    }
    const initMonths = getAvailableMonths(INITIAL_EXPENSES);
    return initMonths.length > 0 ? initMonths[0] : 'Oct 2024';
  });

  // Track if cloud database is actively connected
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [syncStatusDetails, setSyncStatusDetails] = useState<string>('Initializing cross-device sync...');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  // Cross-device synchronization via Supabase
  const refreshCloudData = useCallback(async () => {
    if (!checkIsConfigured()) {
      setIsCloudSynced(false);
      setSyncStatusDetails('Local Storage Mode • Supabase Not Configured');
      return;
    }

    try {
      const cloudData = await fetchHouseholdData();

      if (cloudData.tablesMissing) {
        setIsCloudSynced(false);
        setSyncStatusDetails('Tables Missing in Supabase • Run schema.sql');
        return;
      }

      if (!cloudData.success) {
        setIsCloudSynced(false);
        setSyncStatusDetails(`Connection Error: ${cloudData.error || 'Unknown'}`);
        return;
      }

      let cloudHasData = false;
      if (cloudData.members && cloudData.members.length > 0) {
        setMembers(cloudData.members);
        cloudHasData = true;
      }
      if (cloudData.paymentMethods && cloudData.paymentMethods.length > 0) {
        setPaymentMethods(cloudData.paymentMethods);
        cloudHasData = true;
      }
      if (cloudData.expenses) {
        setExpenses(cloudData.expenses);
        cloudHasData = true;
      }

      // If cloud has tables but no records yet, seed with CURRENT local state so any progress already made on desktop/phone is preserved in cloud
      if (!cloudHasData) {
        await seedInitialDataToSupabase(members, paymentMethods, expenses);
      }

      setIsCloudSynced(true);
      setSyncStatusDetails('Cloud Database Connected • Desktop & Mobile Synced');
    } catch (err: any) {
      console.warn('Supabase fetch failed:', err);
      setIsCloudSynced(false);
      setSyncStatusDetails('Sync Offline • Using Local Data');
    }
  }, [members, paymentMethods, expenses]);

  // Push local data to cloud
  const pushLocalDataToCloud = async (): Promise<boolean> => {
    const res = await pushAllLocalDataToSupabase(members, paymentMethods, expenses);
    if (res.success) {
      setIsCloudSynced(true);
      setSyncStatusDetails('Local Ledger Pushed to Cloud');
      showToast(`Synced ${expenses.length} expenses to Supabase!`, 'cloud_upload');
      return true;
    } else {
      showToast(`Push failed: ${res.error}`, 'error');
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    async function initSync() {
      await refreshCloudData();

      const client = getSupabaseClient();
      if (!client || !checkIsConfigured()) return;

      try {
        channel = client
          .channel('splitstack-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'household_expenses' },
            async () => {
              const res = await fetchHouseholdData();
              if (isMounted && res.success && res.expenses) {
                setExpenses(res.expenses);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'payment_methods' },
            async () => {
              const res = await fetchHouseholdData();
              if (isMounted && res.success && res.paymentMethods) {
                setPaymentMethods(res.paymentMethods);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'household_members' },
            async () => {
              const res = await fetchHouseholdData();
              if (isMounted && res.success && res.members) {
                setMembers(res.members);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setIsCloudSynced(true);
              setSyncStatusDetails('Supabase Real-Time Active');
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('Supabase realtime channel disconnected, polling enabled.');
            }
          });
      } catch (e) {
        console.warn('Realtime channel subscription error:', e);
      }
    }

    initSync();

    // Mobile / Browser visibility & focus listeners:
    // When user unlocks phone or switches back to tab, immediately re-fetch cloud data!
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCloudData();
      }
    };
    const handleFocus = () => {
      refreshCloudData();
    };
    const handleOnline = () => {
      refreshCloudData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      if (channel) {
        const client = getSupabaseClient();
        client?.removeChannel(channel);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Keep selectedMonth aligned with availableMonths:
  // If the active month was cleared or has no expenses, fall back to newest available month or empty
  useEffect(() => {
    if (availableMonths.length > 0) {
      if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
        setSelectedMonth(availableMonths[0]);
      }
    } else {
      if (selectedMonth !== '') {
        setSelectedMonth('');
      }
    }
  }, [availableMonths, selectedMonth]);

  // LocalStorage persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
    } catch {
      // ignore
    }
  }, [members]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_METHODS, JSON.stringify(paymentMethods));
    } catch {
      // ignore
    }
  }, [paymentMethods]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
    } catch {
      // ignore
    }
  }, [expenses]);

  const showToast = (message: string, icon = 'check_circle') => {
    const id = Date.now().toString();
    setToast({ id, message, icon });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 2800);
  };

  // Member management
  const addMember = (name: string, role: 'lead' | 'member' = 'member', phone = '') => {
    const id = `member-${Date.now()}`;
    const newMember: HouseholdMember = {
      id,
      name,
      role,
      phone,
    };
    setMembers((prev) => [...prev, newMember]);
    saveMemberToSupabase(newMember);
    showToast(`Added ${name} to household!`, 'person_add');
    return newMember;
  };

  const updateMember = (id: string, updates: Partial<HouseholdMember>) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const updated = { ...m, ...updates };
          saveMemberToSupabase(updated);
          return updated;
        }
        return m;
      })
    );
    showToast(`Updated member details.`);
  };

  const deleteMember = (id: string) => {
    if (members.length <= 1) {
      showToast('Cannot delete the only household member!', 'error');
      return;
    }
    const target = members.find((m) => m.id === id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    deleteMemberFromSupabase(id);
    showToast(`Removed ${target?.name || 'member'} from household.`, 'delete');
  };

  const setLeadMember = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        const isLead = m.id === id;
        const updated = { ...m, role: (isLead ? 'lead' : 'member') as 'lead' | 'member' };
        saveMemberToSupabase(updated);
        return updated;
      })
    );
    const chosen = members.find((m) => m.id === id);
    showToast(`${chosen?.name} is now the Lead Payer!`, 'star');
  };

  // Dynamic Cent-Precision Split Engine across dynamic household members
  const calculateSplit = (
    amount: number,
    mode: SplitMode,
    payerId: string,
    pairMemberIds?: [string, string],
    customWeights?: Record<string, number>
  ): Record<string, number> => {
    const cleanAmount = Math.max(0, Number(amount.toFixed(2)));
    const breakdown: Record<string, number> = {};
    const memberCount = members.length;

    if (memberCount === 0) return {};

    if (mode === 'equal') {
      const baseShare = Math.floor((cleanAmount / memberCount) * 100) / 100;
      let allocatedTotal = baseShare * memberCount;
      const remainderCents = Math.round((cleanAmount - allocatedTotal) * 100);

      members.forEach((m) => {
        breakdown[m.id] = baseShare;
      });

      // Distribute any remainder pennies (1 cent at a time) to the payer or first member
      let extra = remainderCents;
      const targetPayer = members.find((m) => m.id === payerId) ? payerId : members[0].id;
      if (extra > 0 && breakdown[targetPayer] !== undefined) {
        breakdown[targetPayer] = Number((breakdown[targetPayer] + extra / 100).toFixed(2));
      }
      return breakdown;
    }

    if (mode === 'pair' && pairMemberIds && pairMemberIds.length === 2) {
      members.forEach((m) => {
        breakdown[m.id] = 0;
      });
      const [m1, m2] = pairMemberIds;
      const half = Math.floor((cleanAmount / 2) * 100) / 100;
      const rem = Math.round((cleanAmount - half * 2) * 100) / 100;

      breakdown[m1] = Number((half + rem).toFixed(2));
      breakdown[m2] = Number(half.toFixed(2));
      return breakdown;
    }

    if (mode === 'custom' && customWeights) {
      let totalWeight = 0;
      members.forEach((m) => {
        totalWeight += customWeights[m.id] || 0;
      });

      if (totalWeight <= 0) {
        members.forEach((m, idx) => {
          breakdown[m.id] = idx === 0 ? cleanAmount : 0;
        });
        return breakdown;
      }

      let allocated = 0;
      members.forEach((m, idx) => {
        if (idx === members.length - 1) {
          breakdown[m.id] = Number((cleanAmount - allocated).toFixed(2));
        } else {
          const share = Math.round(((cleanAmount * (customWeights[m.id] || 0)) / totalWeight) * 100) / 100;
          breakdown[m.id] = share;
          allocated += share;
        }
      });
      return breakdown;
    }

    // Default: all to payer
    members.forEach((m) => {
      breakdown[m.id] = m.id === payerId ? cleanAmount : 0;
    });
    return breakdown;
  };

  // Card eligibility and $5 block checks
  const calculateCardEligibility = (
    card: CardMethod,
    amount: number,
    mcc: string,
    category: string
  ) => {
    let eligibleAmount = amount;
    let slippage = 0;
    if (card.roundingBlock === 5) {
      const blocks = Math.floor(amount / 5);
      eligibleAmount = blocks * 5;
      slippage = Number((amount - eligibleAmount).toFixed(2));
    } else if (card.roundingBlock === 1) {
      const blocks = Math.floor(amount);
      eligibleAmount = blocks;
      slippage = Number((amount - eligibleAmount).toFixed(2));
    }

    const projectedSpend = card.currentSpend + amount;
    const isCapped = card.bonusCap > 0 && card.currentSpend >= card.bonusCap;
    const remainingHeadroom = card.bonusCap > 0 ? Math.max(0, card.bonusCap - card.currentSpend) : 999999;

    let isEligible = true;
    let message = 'Transaction eligible for primary reward rate.';
    let adviceType: 'ok' | 'warning' | 'capped' | 'info' = 'ok';

    if (card.keyExclusions) {
      const lowerEx = card.keyExclusions.toLowerCase();
      const lowerCat = (category + ' ' + mcc).toLowerCase();
      if (
        (lowerEx.includes('airline') && (mcc === '4511' || lowerCat.includes('flight') || lowerCat.includes('scoot'))) ||
        (lowerEx.includes('utilit') && (mcc === '4900' || mcc === '4814' || lowerCat.includes('util')))
      ) {
        isEligible = false;
        message = `MCC ${mcc} (${category}) is excluded under ${card.name} terms. Earns base rate only.`;
        adviceType = 'warning';
      }
    }

    if (isCapped) {
      message = `${card.name} has already reached its bonus cap ($${card.bonusCap}). Further spend yields base ${card.baseRate}. Consider switching card!`;
      adviceType = 'capped';
    } else if (card.bonusCap > 0 && projectedSpend > card.bonusCap) {
      const over = projectedSpend - card.bonusCap;
      message = `This transaction exceeds the monthly cap by $${over.toFixed(2)}. Excess will earn base rate.`;
      adviceType = 'warning';
    } else if (card.minSpendTarget && card.minSpendTarget > 0) {
      if (card.currentSpend < card.minSpendTarget && projectedSpend >= card.minSpendTarget) {
        message = `Awesome! This transaction unlocks the $${card.minSpendTarget} Tier 2 rebate target.`;
        adviceType = 'ok';
      } else if (projectedSpend > card.minSpendTarget) {
        message = `Target threshold ($${card.minSpendTarget}) surpassed. Consider routing to 4.0 MPD cards.`;
        adviceType = 'info';
      }
    }

    return {
      isEligible,
      eligibleAmount,
      slippage,
      isCapped,
      remainingHeadroom,
      projectedSpend,
      message,
      adviceType,
    };
  };

  // Add Expense
  // Helper to compute updated card limits, status tags, and advice based on spend
  const computeCardState = (card: CardMethod, currentSpend: number): CardMethod => {
    const roundedSpend = Number(Math.max(0, currentSpend).toFixed(2));
    const remainingHeadroom = card.bonusCap > 0 ? Math.max(0, card.bonusCap - roundedSpend) : 0;
    const isCapped = card.bonusCap > 0 && roundedSpend >= card.bonusCap;
    const isNear = card.bonusCap > 0 && !isCapped && remainingHeadroom <= 150;

    let statusTag = card.statusTag;
    let statusTagBg = card.statusTagBg;
    let footerAdvice = card.footerAdvice;
    let footerIcon = card.footerIcon;
    let footerType = card.footerType;

    if (card.bonusCap === 0) {
      statusTag = 'Uncapped';
      statusTagBg = '#E5E2DC';
    } else if (isCapped) {
      statusTag = 'Capped Out';
      statusTagBg = '#D46C4E';
      footerAdvice = `Monthly bonus cap ($${card.bonusCap}) reached! Excess spend earns base rate only.`;
      footerIcon = 'block';
      footerType = 'alert';
    } else if (isNear) {
      statusTag = 'Near Limit';
      statusTagBg = '#F9AD6A';
      footerAdvice = `$${remainingHeadroom.toFixed(2)} buffer remaining. Pace your category spend.`;
      footerIcon = 'warning';
      footerType = 'warning';
    } else {
      statusTag = 'Open Buffer';
      statusTagBg = '#43978D';
      footerAdvice = roundedSpend === 0
        ? `Full $${card.bonusCap} bonus cap available • 100% buffer reset.`
        : `$${remainingHeadroom.toFixed(2)} buffer remaining. Prime earner for category spend.`;
      footerIcon = 'verified';
      footerType = 'success';
    }

    return {
      ...card,
      currentSpend: roundedSpend,
      statusTag,
      statusTagBg,
      footerAdvice,
      footerIcon,
      footerType,
    };
  };

  // Automatically keep card spend tracker, limits, and caps in 1-to-1 lockstep with the expenses log for selectedMonth.
  // If expenses are cleared (0 remaining for this month/card), card spend resets to $0.00 and spending cap resets to 100%!
  useEffect(() => {
    setPaymentMethods((prev) =>
      prev.map((card) => {
        const matchingExpenses = selectedMonth
          ? expenses.filter((e) => e.paymentMethodId === card.id && isExpenseInMonth(e, selectedMonth))
          : [];
        const monthSpend = matchingExpenses.reduce((sum, e) => sum + e.amount, 0);
        return computeCardState(card, monthSpend);
      })
    );
  }, [selectedMonth, expenses]);

  // Add Expense
  const addExpense = (expenseData: Omit<Expense, 'id'>) => {
    const id = `exp-${Date.now()}`;
    const newExpense: Expense = {
      ...expenseData,
      id,
    };

    const newMonth = getExpenseMonthKey(newExpense);
    setExpenses((prev) => [newExpense, ...prev]);

    // Save to cloud database for cross-device sync
    saveExpenseToSupabase(newExpense);

    // Automatically switch to the newly logged transaction's month so it appears in the dropdown & views
    if (newMonth && newMonth !== selectedMonth) {
      setSelectedMonth(newMonth);
    }

    showToast(`Logged $${newExpense.amount.toFixed(2)} at ${newExpense.merchant} (${newMonth || 'new cycle'})!`);
    return newExpense;
  };

  // Delete Expense - Recalculates card spend strictly from remaining expenses
  const deleteExpense = (id: string) => {
    const target = expenses.find((e) => e.id === id);
    if (!target) return;

    const remainingExpenses = expenses.filter((e) => e.id !== id);
    setExpenses(remainingExpenses);

    // Delete from cloud database
    deleteExpenseFromSupabase(id);

    const remainingMonths = getAvailableMonths(remainingExpenses);
    if (remainingMonths.length > 0) {
      if (!remainingMonths.includes(selectedMonth)) {
        setSelectedMonth(remainingMonths[0]);
      }
    } else {
      setSelectedMonth('');
    }

    showToast(`Removed transaction: ${target.merchant}. Restored card limit & spend cap!`, 'delete');
  };

  // Clear all logged expenses by month and reset card spend & caps accordingly
  const clearExpensesByMonth = (targetMonth?: string) => {
    const cycle = targetMonth || selectedMonth;
    const toRemove = expenses.filter((e) => isExpenseInMonth(e, cycle));
    const toKeep = expenses.filter((e) => !isExpenseInMonth(e, cycle));

    if (toRemove.length === 0) {
      showToast(`No logged expenses found for ${cycle || 'selected cycle'}.`, 'info');
      return;
    }

    setExpenses(toKeep);

    // Delete cleared month records from cloud database
    clearExpensesFromSupabase(toRemove.map((e) => e.id));

    // If we just removed all expenses for the selected month, update selectedMonth to the next available month
    const remainingMonths = getAvailableMonths(toKeep);
    if (remainingMonths.length > 0) {
      if (cycle === selectedMonth) {
        setSelectedMonth(remainingMonths[0]);
      }
    } else {
      setSelectedMonth('');
    }

    // Immediately reset card spend and caps for this cycle
    setPaymentMethods((prev) =>
      prev.map((card) => {
        const remainingCardSpend = toKeep
          .filter((e) => e.paymentMethodId === card.id && isExpenseInMonth(e, cycle))
          .reduce((sum, e) => sum + e.amount, 0);
        return computeCardState(card, remainingCardSpend);
      })
    );

    showToast(`Cleared all ${toRemove.length} expenses for ${cycle}! All card limits & spending caps reset to 100% accordingly.`, 'delete_sweep');
  };

  // Clear All Expenses across entire ledger and reset all card limits & caps to 100%
  const clearAllExpenses = () => {
    const totalCount = expenses.length;
    const allIds = expenses.map((e) => e.id);
    setExpenses([]);
    setSelectedMonth('');
    setPaymentMethods((prev) =>
      prev.map((card) => computeCardState(card, 0))
    );

    // Delete from cloud database
    clearExpensesFromSupabase(allIds);

    showToast(`Cleared all ${totalCount} expenses! All card limits & spending caps reset to 100% available.`, 'delete_sweep');
  };

  // Match and sync card spend tracker with the expenses log
  const syncCardSpendWithExpenses = (targetMonth?: string) => {
    const cycle = targetMonth || selectedMonth;
    const matchingExpenses = cycle
      ? expenses.filter((e) => isExpenseInMonth(e, cycle))
      : [];
    const totalSpend = matchingExpenses.reduce((sum, e) => sum + e.amount, 0);

    setPaymentMethods((prev) =>
      prev.map((card) => {
        const cardExpenses = matchingExpenses.filter((e) => e.paymentMethodId === card.id);
        const spend = cardExpenses.reduce((sum, e) => sum + e.amount, 0);
        return computeCardState(card, spend);
      })
    );

    if (matchingExpenses.length === 0) {
      showToast(`Expenses log for ${cycle || 'current cycle'} is empty: All card limits & caps reset to 100% ($0.00 spend)!`, 'restart_alt');
    } else {
      showToast(`Card spend tracker matched with ${cycle} expenses log (${matchingExpenses.length} txns, $${totalSpend.toFixed(2)} total spend)!`, 'sync');
    }
  };

  // Reset all card spend tracker limits and caps to $0.00 (100% available)
  const resetCardSpendTracker = () => {
    setPaymentMethods((prev) =>
      prev.map((card) => computeCardState(card, 0))
    );
    showToast('All card spend limits and caps reset to $0.00 (100% available)!', 'restart_alt');
  };

  // Payment Methods operations
  const addPaymentMethod = (method: Omit<CardMethod, 'id'>) => {
    const id = `card-${Date.now()}`;
    const newMethod: CardMethod = {
      ...method,
      id,
    };
    setPaymentMethods((prev) => [...prev, newMethod]);
    savePaymentMethodToSupabase(newMethod);
    showToast(`Added ${newMethod.name} to Household!`, 'add_card');
  };

  const updatePaymentMethod = (id: string, updates: Partial<CardMethod>) => {
    setPaymentMethods((prev) =>
      prev.map((card) => {
        if (card.id === id) {
          const updated = { ...card, ...updates };
          savePaymentMethodToSupabase(updated);
          return updated;
        }
        return card;
      })
    );
    showToast(`Configuration updated.`);
  };

  const deletePaymentMethod = (id: string) => {
    setPaymentMethods((prev) => prev.filter((card) => card.id !== id));
    deletePaymentMethodFromSupabase(id);
    showToast(`Payment method archived.`, 'delete');
  };

  const setDefaultPayerMethod = (id: string) => {
    setPaymentMethods((prev) =>
      prev.map((card) => {
        const isDefault = card.id === id;
        const updated = { ...card, isDefaultPayer: isDefault };
        savePaymentMethodToSupabase(updated);
        return updated;
      })
    );
    const chosen = paymentMethods.find((c) => c.id === id);
    showToast(`${chosen?.name || 'Method'} set as Default Household Payer!`, 'star');
  };

  // Dynamic Settlement computation across all dynamic members for the selected cycle
  const netBalances = useMemo(() => {
    const memberPaid: Record<string, number> = {};
    const memberConsumed: Record<string, number> = {};
    const memberNets: Record<string, number> = {};

    members.forEach((m) => {
      memberPaid[m.id] = 0;
      memberConsumed[m.id] = 0;
      memberNets[m.id] = 0;
    });

    let totalMonthSpend = 0;
    let totalActiveTransactions = 0;

    const targetExpenses = selectedMonth
      ? expenses.filter((e) => isExpenseInMonth(e, selectedMonth))
      : expenses;

    targetExpenses.forEach((e) => {
      if (e.settled) return;
      totalActiveTransactions += 1;
      totalMonthSpend += e.amount;

      if (memberPaid[e.payerId] !== undefined) {
        memberPaid[e.payerId] += e.amount;
      }

      Object.entries(e.splitBreakdown).forEach(([mId, share]) => {
        if (memberConsumed[mId] !== undefined) {
          memberConsumed[mId] += share;
        }
      });
    });

    members.forEach((m) => {
      memberNets[m.id] = Number(((memberPaid[m.id] || 0) - (memberConsumed[m.id] || 0)).toFixed(2));
    });

    // Generate directed debts (who owes whom)
    const debts: { from: string; fromName: string; to: string; toName: string; amount: number }[] = [];

    // Separate debtors (< 0) and creditors (> 0)
    const debtors = members
      .filter((m) => memberNets[m.id] < -0.005)
      .map((m) => ({ id: m.id, name: m.name, debt: Math.abs(memberNets[m.id]) }));

    const creditors = members
      .filter((m) => memberNets[m.id] > 0.005)
      .map((m) => ({ id: m.id, name: m.name, credit: memberNets[m.id] }));

    // Greedy bilateral matching
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      const settleAmt = Math.min(debtor.debt, creditor.credit);

      if (settleAmt > 0.01) {
        debts.push({
          from: debtor.id,
          fromName: debtor.name,
          to: creditor.id,
          toName: creditor.name,
          amount: Number(settleAmt.toFixed(2)),
        });
      }

      debtor.debt -= settleAmt;
      creditor.credit -= settleAmt;

      if (debtor.debt <= 0.01) dIdx++;
      if (creditor.credit <= 0.01) cIdx++;
    }

    return {
      memberNets,
      debts,
      totalMonthSpend: Number(totalMonthSpend.toFixed(2)),
      totalActiveTransactions,
    };
  }, [expenses, members, selectedMonth]);

  const markAllSettled = () => {
    setExpenses((prev) => prev.map((e) => ({ ...e, settled: true })));
    updateExpensesSettledInSupabase(expenses.map((e) => e.id), true);
    showToast('All household balances marked as SETTLED!', 'check_circle');
  };

  const markDebtSettled = (fromMemberId: string, toMemberId: string) => {
    const affectedIds: string[] = [];
    setExpenses((prev) =>
      prev.map((e) => {
        if (
          (e.payerId === toMemberId && (e.splitBreakdown[fromMemberId] || 0) > 0) ||
          (e.payerId === fromMemberId && (e.splitBreakdown[toMemberId] || 0) > 0)
        ) {
          affectedIds.push(e.id);
          return { ...e, settled: true };
        }
        return e;
      })
    );
    if (affectedIds.length > 0) {
      updateExpensesSettledInSupabase(affectedIds, true);
    }
    const fromM = members.find((m) => m.id === fromMemberId)?.name || fromMemberId;
    const toM = members.find((m) => m.id === toMemberId)?.name || toMemberId;
    showToast(`Settled balance between ${fromM} and ${toM}.`, 'verified');
  };

  // SMART CARD RECOMMENDER: Pulls dynamically from the user's added payment methods!
  const recommendBestCard = (merchant: string, mcc?: string, amount = 100): RecommendationResult | null => {
    const result = executeRecommendCard(paymentMethods, merchant, amount);
    if (!result || result.error || !result.topRecommendation) {
      return null;
    }

    const top = result.topRecommendation;
    return {
      card: top.card,
      score: top.score,
      rateLabel: top.card.bonusRate,
      isEligible: top.isEligible,
      reasons: top.reasons,
      warning: top.warning,
      eligibleBlocksAmount: top.eligibleBlocksAmount,
      potentialEarnings: top.potentialEarnings,
      remainingHeadroom: top.remainingHeadroom,
    };
  };

  const syncData = () => {
    syncCardSpendWithExpenses(selectedMonth);
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEY_MEMBERS);
    localStorage.removeItem(STORAGE_KEY_METHODS);
    localStorage.removeItem(STORAGE_KEY_EXPENSES);
    setMembers(INITIAL_MEMBERS);
    setPaymentMethods(INITIAL_PAYMENT_METHODS);
    setExpenses(INITIAL_EXPENSES);
    showToast('Reset to default household state.');
  };

  const resetToDefaultMethods = () => {
    setPaymentMethods(INITIAL_PAYMENT_METHODS);
    try {
      localStorage.setItem(STORAGE_KEY_METHODS, JSON.stringify(INITIAL_PAYMENT_METHODS));
    } catch {
      // ignore
    }
    showToast('Restored default 11 Singapore payment methods!', 'restart_alt');
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedMonth,
        setSelectedMonth,
        availableMonths,
        isCloudSynced,
        syncStatusDetails,
        isSyncModalOpen,
        setIsSyncModalOpen,
        refreshCloudData,
        pushLocalDataToCloud,
        members,
        addMember,
        updateMember,
        deleteMember,
        setLeadMember,
        paymentMethods,
        expenses,
        toast,
        showToast,
        addExpense,
        deleteExpense,
        clearExpensesByMonth,
        clearAllExpenses,
        syncCardSpendWithExpenses,
        resetCardSpendTracker,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        setDefaultPayerMethod,
        markAllSettled,
        markDebtSettled,
        calculateSplit,
        calculateCardEligibility,
        recommendBestCard,
        netBalances,
        syncData,
        resetAllData,
        resetToDefaultMethods,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
