export type MemberId = string;

export interface HouseholdMember {
  id: MemberId;
  name: string;
  role: 'lead' | 'member';
  phone?: string;
  avatarUrl?: string;
}

export type MethodType = 'credit' | 'debit' | 'credit+debit' | 'giro' | 'paynow' | 'bank_transfer';
export type CardNetwork = 'Visa' | 'Mastercard' | 'Amex' | 'PayNow' | 'GIRO' | 'NETS';
export type BillingCycleType = 'calendar' | 'statement';

export interface CardMethod {
  id: string;
  badgeCode: string; // e.g. UOB-01, CITI-02
  name: string;
  bank: string;
  memberId: MemberId;
  type: MethodType;
  network: CardNetwork;
  last4: string;
  statusTag: string; // "Tiered Rebate", "Near Limit", "Open Buffer", "Capped Out", "Uncapped"
  statusTagBg: string; // hex or tailwind color
  cardSubtitle: string;
  billingCycleType: BillingCycleType;
  billingCycleDesc: string;
  currentSpend: number;
  bonusCap: number; // 0 if uncapped
  minSpendTarget?: number;
  txnTargetReq?: string;
  maxRebateDesc?: string;
  baseRate: string;
  bonusRate: string;
  roundingBlock: 5 | 1 | 0; // 5 for $5 SGD blocks, 1 for $1, 0 for exact cents
  keyExclusions?: string;
  eligibleModes?: string;
  overflowRate?: string;
  pointsExpiry?: string;
  overseasRate?: string;
  extraBenefit?: string;
  resetInDays?: number;
  footerAdvice: string;
  footerIcon: string;
  footerType: 'success' | 'warning' | 'alert' | 'info';
  eligibleCategories: string[]; // e.g. ['groceries', 'utilities', 'online_food', 'online_shopping', 'dining', 'contactless']
  isDefaultPayer?: boolean;
}

export type SplitMode = 'equal' | 'pair' | 'custom';

export interface Expense {
  id: string;
  date: string; // e.g. "28 Oct 2024"
  isoDate: string; // e.g. "2024-10-28"
  merchant: string;
  mcc: string; // e.g. "5411"
  category: string; // e.g. "Groceries", "Dining", "Utilities", "Online Spend"
  tags: string[];
  amount: number; // in SGD
  payerId: MemberId;
  paymentMethodId: string;
  splitMode: SplitMode;
  splitBreakdown: Record<MemberId, number>; // Maps member id to owed share
  customWeights?: Record<MemberId, number>;
  pairMemberIds?: [MemberId, MemberId]; // For 2-way splits
  notes?: string;
  settled: boolean;
  eligibleBlocksAmount: number;
  rewardEstimated: string;
}

export type TabType = 'dashboard' | 'log' | 'settle' | 'cards' | 'methods';

export interface ToastNotification {
  id: string;
  message: string;
  icon?: string;
}

export interface RecommendationResult {
  card: CardMethod;
  score: number;
  rateLabel: string;
  isEligible: boolean;
  reasons: string[];
  warning?: string;
  eligibleBlocksAmount: number;
  potentialEarnings: string;
  remainingHeadroom: number;
}
