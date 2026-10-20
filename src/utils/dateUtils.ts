import { Expense } from '../types';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const FULL_MONTH_NAMES: Record<string, string> = {
  january: 'Jan',
  february: 'Feb',
  march: 'Mar',
  april: 'Apr',
  may: 'May',
  june: 'Jun',
  july: 'Jul',
  august: 'Aug',
  september: 'Sep',
  october: 'Oct',
  november: 'Nov',
  december: 'Dec',
};

/**
 * Extracts a normalized month key like "Oct 2024" from an expense record.
 */
export function getExpenseMonthKey(expense: { date?: string; isoDate?: string }): string {
  // 1. Try isoDate (format: YYYY-MM-DD or YYYY-MM)
  if (expense.isoDate && /^\d{4}-\d{2}/.test(expense.isoDate)) {
    const parts = expense.isoDate.split('-');
    const year = parseInt(parts[0], 10);
    const monthNum = parseInt(parts[1], 10);
    if (!isNaN(year) && monthNum >= 1 && monthNum <= 12) {
      return `${MONTH_NAMES[monthNum - 1]} ${year}`;
    }
  }

  // 2. Try parsing expense.date (e.g. "28 Oct 2024", "Oct 28 2024", "October 2024")
  if (expense.date) {
    const trimmed = expense.date.trim();

    // Check for 3-letter month match and 4-digit year
    const match = trimmed.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i) ||
                  trimmed.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i) ||
                  trimmed.match(/(\d{4})[-\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/i);

    if (match) {
      const yearMatch = trimmed.match(/\b(20\d\d)\b/);
      const year = yearMatch ? yearMatch[1] : '';
      for (const m of MONTH_NAMES) {
        if (new RegExp(m, 'i').test(trimmed)) {
          if (year) return `${m} ${year}`;
        }
      }
    }

    // Check full month names like "October 2024"
    for (const [full, short] of Object.entries(FULL_MONTH_NAMES)) {
      if (new RegExp(full, 'i').test(trimmed)) {
        const yearMatch = trimmed.match(/\b(20\d\d)\b/);
        if (yearMatch) return `${short} ${yearMatch[1]}`;
      }
    }

    // Try standard Date parsing
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
  }

  return '';
}

/**
 * Checks whether an expense belongs to the given month key (e.g. "Oct 2024").
 */
export function isExpenseInMonth(expense: { date?: string; isoDate?: string }, monthKey: string): boolean {
  if (!monthKey) return false;
  const key = getExpenseMonthKey(expense);
  return key.toLowerCase() === monthKey.trim().toLowerCase();
}

/**
 * Returns a sorted unique list of month keys (e.g. ['Nov 2024', 'Oct 2024'])
 * that have at least one logged expense, ordered latest month first.
 */
export function getAvailableMonths(expenses: Expense[]): string[] {
  const monthMap = new Map<string, number>();

  expenses.forEach((e) => {
    const key = getExpenseMonthKey(e);
    if (key && !monthMap.has(key)) {
      const [mName, yStr] = key.split(' ');
      const mIdx = MONTH_NAMES.indexOf(mName);
      const year = parseInt(yStr, 10);
      const timestamp = new Date(year, mIdx !== -1 ? mIdx : 0, 1).getTime();
      monthMap.set(key, timestamp);
    }
  });

  // Sort descending: latest month first
  return Array.from(monthMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
}

/**
 * Converts a Date or ISO string to display string like "28 Oct 2024".
 */
export function formatDisplayDate(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Converts a display date string like "28 Oct 2024" or date object to ISO "2024-10-28".
 */
export function toIsoDateString(dateInput: Date | string): string {
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return new Date().toISOString().split('T')[0];
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Parse "28 Oct 2024"
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Parses any expense date (isoDate "2024-10-28" or display date "28 Oct 2024") into a Date object.
 */
export function parseExpenseDate(expense: { date?: string; isoDate?: string } | string): Date | null {
  if (!expense) return null;
  const iso = typeof expense === 'string' ? expense : expense.isoDate || expense.date || '';
  if (!iso) return null;

  // 1. Try ISO YYYY-MM-DD
  const isoMatch = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    return new Date(y, m, d, 12, 0, 0);
  }

  // 2. Try Date.parse
  const parsed = Date.parse(iso);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

export interface CardStatementCycleWindow {
  cycleStart: Date;
  cycleEnd: Date;
  nextResetDate: Date;
  resetInDays: number;
  displayRange: string;
  isWithinCycle: (expense: { date?: string; isoDate?: string } | string) => boolean;
}

/**
 * Computes the active statement window, reset date, and days remaining for a card.
 * 
 * Rules:
 * - Calendar Month card (billingCycleType === 'calendar' or startDay === 1):
 *   Resets on the 1st of each month. Cycle is 1st to last day of month.
 * - Statement Date card (billingCycleType === 'statement', e.g. startDay = 15, endDay = 14):
 *   Resets on the statement start day (e.g. 15th) of each month.
 *   Transactions before the start day belong to the previous cycle.
 *   Transactions within [startDay, endDay] belong to the current cycle and count against the bonus cap.
 */
export function getCardStatementCycleWindow(
  card: { billingCycleType?: 'calendar' | 'statement'; statementStartDay?: number; statementEndDay?: number },
  referenceDateInput: Date | string = new Date()
): CardStatementCycleWindow {
  const ref = typeof referenceDateInput === 'string' ? new Date(referenceDateInput) : referenceDateInput;
  const safeRef = isNaN(ref.getTime()) ? new Date() : ref;

  const isCalendar = card.billingCycleType === 'calendar' || !card.statementStartDay || card.statementStartDay === 1;

  if (isCalendar) {
    const year = safeRef.getFullYear();
    const month = safeRef.getMonth();
    const cycleStart = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const cycleEnd = new Date(year, month, lastDay, 23, 59, 59, 999);
    const nextResetDate = new Date(year, month + 1, 1, 0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const now = new Date();
    const baseDate = safeRef.getMonth() === now.getMonth() && safeRef.getFullYear() === now.getFullYear() ? now : safeRef;
    const resetInDays = Math.max(1, Math.ceil((nextResetDate.getTime() - baseDate.getTime()) / msPerDay));

    const mName = MONTH_NAMES[month];
    const displayRange = `1 ${mName} – ${lastDay} ${mName} ${year}`;

    return {
      cycleStart,
      cycleEnd,
      nextResetDate,
      resetInDays,
      displayRange,
      isWithinCycle: (expenseInput) => {
        const d = parseExpenseDate(expenseInput);
        if (!d) return false;
        return d.getTime() >= cycleStart.getTime() && d.getTime() <= cycleEnd.getTime();
      },
    };
  }

  // Custom statement cycle (e.g. 15th of month to 14th of following month)
  const startDay = Math.min(31, Math.max(1, Number(card.statementStartDay) || 15));
  const endDay = card.statementEndDay ? Math.min(31, Math.max(1, Number(card.statementEndDay))) : (startDay === 1 ? 31 : startDay - 1);

  const refYear = safeRef.getFullYear();
  const refMonth = safeRef.getMonth();
  const refDay = safeRef.getDate();

  let cycleStart: Date;
  let cycleEnd: Date;
  let nextResetDate: Date;

  if (refDay >= startDay) {
    // Current cycle began this month on startDay
    const maxStartDayThisMonth = new Date(refYear, refMonth + 1, 0).getDate();
    const actualStartDay = Math.min(startDay, maxStartDayThisMonth);
    cycleStart = new Date(refYear, refMonth, actualStartDay, 0, 0, 0, 0);

    // End is next month on endDay
    const nextMonthYear = refMonth === 11 ? refYear + 1 : refYear;
    const nextMonth = refMonth === 11 ? 0 : refMonth + 1;
    const maxEndDayNextMonth = new Date(nextMonthYear, nextMonth + 1, 0).getDate();
    const actualEndDay = Math.min(endDay, maxEndDayNextMonth);
    cycleEnd = new Date(nextMonthYear, nextMonth, actualEndDay, 23, 59, 59, 999);

    nextResetDate = new Date(nextMonthYear, nextMonth, Math.min(startDay, maxEndDayNextMonth), 0, 0, 0, 0);
  } else {
    // Current cycle began last month on startDay
    const prevMonthYear = refMonth === 0 ? refYear - 1 : refYear;
    const prevMonth = refMonth === 0 ? 11 : refMonth - 1;
    const maxStartDayPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    const actualStartDay = Math.min(startDay, maxStartDayPrevMonth);
    cycleStart = new Date(prevMonthYear, prevMonth, actualStartDay, 0, 0, 0, 0);

    // End is this month on endDay
    const maxEndDayThisMonth = new Date(refYear, refMonth + 1, 0).getDate();
    const actualEndDay = Math.min(endDay, maxEndDayThisMonth);
    cycleEnd = new Date(refYear, refMonth, actualEndDay, 23, 59, 59, 999);

    nextResetDate = new Date(refYear, refMonth, Math.min(startDay, maxEndDayThisMonth), 0, 0, 0, 0);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const now = new Date();
  const resetInDays = Math.max(1, Math.ceil((nextResetDate.getTime() - now.getTime()) / msPerDay));

  const startMonthName = MONTH_NAMES[cycleStart.getMonth()];
  const endMonthName = MONTH_NAMES[cycleEnd.getMonth()];
  const displayRange = `${cycleStart.getDate()} ${startMonthName} – ${cycleEnd.getDate()} ${endMonthName} ${cycleEnd.getFullYear()}`;

  return {
    cycleStart,
    cycleEnd,
    nextResetDate,
    resetInDays,
    displayRange,
    isWithinCycle: (expenseInput) => {
      const d = parseExpenseDate(expenseInput);
      if (!d) return false;
      return d.getTime() >= cycleStart.getTime() && d.getTime() <= cycleEnd.getTime();
    },
  };
}

/**
 * Checks if an expense falls inside a card's statement cycle.
 */
export function isExpenseInCardCycle(
  expense: { date?: string; isoDate?: string },
  card: { billingCycleType?: 'calendar' | 'statement'; statementStartDay?: number; statementEndDay?: number },
  referenceDateInput?: Date | string
): boolean {
  const window = getCardStatementCycleWindow(card, referenceDateInput);
  return window.isWithinCycle(expense);
}
