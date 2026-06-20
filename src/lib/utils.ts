/**
 * Format a number as Myanmar Kyat currency.
 * Example: formatCurrency(1500) => "K 1,500"
 */
export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `K ${formatted}`;
}

/**
 * Format a Date or ISO string as a readable date.
 * Example: "Jan 15, 2024"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a Date or ISO string as a readable date + time.
 * Example: "Jan 15, 2024 02:30 PM"
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Generate a unique invoice number.
 * Format: INV-YYYYMMDD-XXX where XXX is a random 3-digit number.
 * Example: "INV-20240115-483"
 */
export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 900) + 100);
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `INV-${year}${month}${day}-${random}${ms}`;
}

/**
 * Generate a SKU from a category slug.
 * Format: SLUG-XXXXXXXX (8 random hex characters)
 * Example: generateSKU("electronics") => "ELEC-A3F2B1C9"
 */
export function generateSKU(categorySlug: string): string {
  const prefix = categorySlug
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const hex = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join('');
  return `${prefix}-${hex}`;
}

/**
 * Convert a string into a URL-friendly slug.
 * Example: slugify("Hello World!") => "hello-world"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Conditional className utility.
 * Merges class name strings, filtering out falsy values.
 * Example: cn('base', isActive && 'active', isDisabled && 'disabled')
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get initials from a name string.
 * Example: getInitials("Aung Ko") => "AK"
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Calculate tax from an amount and tax rate (percentage).
 * Example: calculateTax(10000, 5) => 500
 */
export function calculateTax(amount: number, taxRate: number): number {
  return Math.round(amount * (taxRate / 100));
}

/**
 * Truncate text to a max length, appending "..." if truncated.
 * Example: truncateText("Hello World", 5) => "Hello..."
 */
export function truncateText(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * Format a number with comma separators.
 * Example: formatNumber(15000) => "15,000"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format a Date to a readable time string (h:mm AM/PM).
 * Example: formatTime(new Date()) => "2:30 PM"
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a Date to a short date string in Myanmar timezone.
 * Example: formatShortDate(new Date()) => "May 23"
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Yangon',
  });
}

/** Myanmar timezone offset: UTC+6:30 = 6.5 hours in milliseconds */
const MYANMAR_OFFSET_MS = 6.5 * 60 * 60 * 1000;

/**
 * Get current date parts in Myanmar timezone (UTC+6:30).
 * Works correctly on Vercel (UTC) and any server timezone.
 */
function getMyanmarDateParts(d?: Date): { year: number; month: number; day: number } {
  const utcMs = (d ?? new Date()).getTime();
  const mmDate = new Date(utcMs + MYANMAR_OFFSET_MS);
  return {
    year: mmDate.getUTCFullYear(),
    month: mmDate.getUTCMonth(),
    day: mmDate.getUTCDate(),
  };
}

/**
 * Get the start and end of the current day in Myanmar timezone (UTC+6:30).
 * Returns UTC Date objects that correspond to Myanmar midnight-to-midnight.
 */
export function getTodayRange(): { start: Date; end: Date } {
  const { year, month, day } = getMyanmarDateParts();
  // Myanmar midnight in UTC = Myanmar midnight - offset
  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - MYANMAR_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - MYANMAR_OFFSET_MS);
  return { start, end };
}

/**
 * Get the date range for the last N days (including today) in Myanmar timezone.
 */
export function getLastNDaysRange(n: number): { start: Date; end: Date } {
  const { year, month, day } = getMyanmarDateParts();
  const endUtc = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - MYANMAR_OFFSET_MS);
  const startDate = new Date(Date.UTC(year, month, day - (n - 1), 0, 0, 0, 0) - MYANMAR_OFFSET_MS);
  return { start: startDate, end: endUtc };
}

/**
 * Generate an array of the last N day labels in Myanmar timezone.
 * Example: getLastNDayLabels(3) => ["May 21", "May 22", "May 23"]
 */
export function getLastNDayLabels(n: number): string[] {
  const labels: string[] = [];
  const { year, month, day } = getMyanmarDateParts();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month, day - i, 12, 0, 0, 0) - MYANMAR_OFFSET_MS);
    labels.push(formatShortDate(d));
  }
  return labels;
}

/**
 * Clamp a number between a min and max value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
