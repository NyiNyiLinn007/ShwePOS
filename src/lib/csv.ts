/**
 * RFC 4180 CSV escaping with spreadsheet formula injection neutralization.
 * Prefixes leading formula trigger characters (=, +, -, @, tab, CR) on string
 * values with a single quote so Excel / LibreOffice / Google Sheets cannot
 * execute formulas embedded in customer names, notes, or audit metadata.
 */
const FORMULA_TRIGGER_REGEX = /^[\s]*[=+\-@]|^[\t\r]/;

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '""';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  let str = String(value);
  if (FORMULA_TRIGGER_REGEX.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}
