/**
 * Calendar-date helpers. All health records are keyed by local calendar date
 * strings (YYYY-MM-DD) so arithmetic never drifts across DST or time zones.
 */
export type ISODate = string;

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Days since epoch for a calendar date, computed in UTC to avoid DST gaps. */
export function toDayNumber(date: ISODate): number {
  if (!isValidISODate(date)) throw new Error(`Invalid date: ${date}`);
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n: number): ISODate {
  const dt = new Date(n * DAY_MS);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(date) + days);
}

export function diffDays(later: ISODate, earlier: ISODate): number {
  return toDayNumber(later) - toDayNumber(earlier);
}

/** Today's date in the device's local time zone. */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function monthMatrix(year: number, month0: number): (ISODate | null)[][] {
  const first = new Date(Date.UTC(year, month0, 1));
  const startWeekday = (first.getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: (ISODate | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const WEEKDAYS = { en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], bn: ['সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি', 'রবি'] };
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

// Display language for dates and numbers. Set by the store whenever settings change.
let dateLang: 'en' | 'bn' = 'en';
export function setDateLanguage(lang: 'en' | 'bn') {
  dateLang = lang;
}

/** A number in the display language's digits. */
export function num(n: number | string): string {
  return dateLang === 'bn' ? String(n).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]) : String(n);
}

export function weekdayInitials(): string[] {
  return WEEKDAYS[dateLang];
}

export function monthName(month0: number): string {
  return dateLang === 'bn' ? MONTHS_BN[month0] : MONTHS_EN[month0];
}

export function formatShort(date: ISODate): string {
  const [, m, d] = date.split('-').map(Number);
  return dateLang === 'bn' ? `${num(d)} ${MONTHS_BN[m - 1]}` : `${MONTHS_SHORT[m - 1]} ${d}`;
}

export function formatLong(date: ISODate): string {
  const [y, m, d] = date.split('-').map(Number);
  return dateLang === 'bn' ? `${num(d)} ${MONTHS_BN[m - 1]} ${num(y)}` : `${MONTHS_EN[m - 1]} ${d}, ${y}`;
}

export function formatRange(start: ISODate, end: ISODate): string {
  if (start === end) return formatShort(start);
  return `${formatShort(start)} – ${formatShort(end)}`;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
