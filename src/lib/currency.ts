/**
 * Centralized Indonesian Rupiah Currency Formatting & Parsing
 * 
 * CRITICAL RULE:
 * Database, API, and business logic calculations MUST ALWAYS use raw numeric BIGINT.
 * These formatting utilities are STRICTLY FOR UI DISPLAY ONLY.
 */

export function formatRupiah(amount?: number | bigint | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return 'Rp 0';
  }
  const numeric = Number(amount);
  const formatted = Math.abs(numeric).toLocaleString('id-ID');
  return numeric < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatRupiahWithoutSymbol(amount?: number | bigint | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return '0';
  }
  return Number(amount).toLocaleString('id-ID');
}

/**
 * Formats a numeric or raw string value with Indonesian thousand separators (dots) for UI input fields.
 * e.g., "27500000" -> "27.500.000"
 * e.g., 30000000 -> "30.000.000"
 */
export function formatInputNumber(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return isNaN(num) ? '' : num.toLocaleString('id-ID');
}

export function parseRupiahInput(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return Math.round(value);
  if (!value) return 0;
  // Remove non-digits except minus sign
  const cleaned = String(value).replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export interface ExcelCellNumeric {
  v: number; // Raw Numeric Value for Excel formulas (SUM, AVERAGE, etc.)
  t: 'n';
  z: string; // Excel format string: 'Rp #,##0'
}

/**
 * Prepares raw numeric value for Stage 3 Excel Export with visual currency format
 */
export function toExcelNumeric(amount: number | bigint): ExcelCellNumeric {
  return {
    v: Number(amount),
    t: 'n',
    z: '"Rp "#,##0',
  };
}
