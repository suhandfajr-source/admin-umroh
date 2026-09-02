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

export function parseRupiahInput(value: string | number): number {
  if (typeof value === 'number') return Math.round(value);
  if (!value) return 0;
  // Remove non-digits except minus sign
  const cleaned = value.replace(/[^0-9-]/g, '');
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
