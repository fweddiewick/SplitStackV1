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
