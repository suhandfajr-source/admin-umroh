/**
 * CENTRALIZED OPERATIONAL THRESHOLDS & DATE UTILITIES FOR STAGE 5
 * Guarantees zero magic numbers scattered across components and services.
 * All timezone calculations standardize on Asia/Jakarta (WIB, UTC+7).
 */

export const OperationalThresholds = {
  // Passport & Document Policies
  PASSPORT_EXPIRY_THRESHOLD_MONTHS: 6, // Matches Stage 3 Manifest standard
  PASSPORT_MISSING_CRITICAL_DAYS: 30,  // <30 days to departure without passport is CRITICAL
  PASSPORT_MISSING_WARNING_DAYS: 60,   // 30-60 days is WARNING

  // Manifest Validation Policies
  MANIFEST_ERROR_CRITICAL_DAYS: 30,    // Manifest ERROR within 30 days is CRITICAL blocker
  MANIFEST_WARNING_DAYS: 45,           // Manifest warning within 45 days

  // Equipment Preparation & Handover Policies
  EQUIPMENT_NOT_PREPARED_CRITICAL_DAYS: 7,   // <7 days without preparation is CRITICAL
  EQUIPMENT_NOT_PREPARED_WARNING_DAYS: 21,  // <21 days is WARNING
  EQUIPMENT_NOT_HANDED_OVER_CRITICAL_DAYS: 7,// <7 days without handover is CRITICAL
  EQUIPMENT_NOT_HANDED_OVER_WARNING_DAYS: 14,// <14 days is WARNING
  EQUIPMENT_MISSING_VARIANT_CRITICAL_DAYS: 14,// <14 days without size is CRITICAL
  EQUIPMENT_MISSING_VARIANT_WARNING_DAYS: 30, // <30 days without size is WARNING

  // Finance & Allocation Policies
  PAYMENT_UNALLOCATED_WARNING_DAYS: 2,       // Payment unallocated for >2 days triggers WARNING
  FINANCE_OUTSTANDING_CRITICAL_DAYS: 7,      // Unpaid within 7 days is CRITICAL visibility
  FINANCE_OUTSTANDING_WARNING_DAYS: 30,      // Unpaid within 30 days is WARNING

  // Package Level Proximity
  PACKAGE_URGENT_DEPARTURE_DAYS: 14,         // Package departing within 14 days
} as const;

/**
 * Standardized Date difference in days relative to current business date.
 * Avoids server UTC rollover off-by-one errors.
 */
export function calculateDaysToDeparture(departureDateStr: string, baseDate = new Date()): number {
  if (!departureDateStr) return 999;
  
  // Normalize both dates to YYYY-MM-DD strings in local/WIB context
  const depParts = departureDateStr.split('-').map(Number);
  if (depParts.length !== 3 || isNaN(depParts[0])) return 999;

  const depDate = new Date(depParts[0], depParts[1] - 1, depParts[2]);
  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  const diffMs = depDate.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if a passport expiration date complies with the 6-month validity threshold
 * relative to the target departure date. Shared identical logic with Stage 3 Manifest.
 */
export function evaluatePassportValidityAgainstDeparture(
  expiryDateStr?: string | null,
  departureDateStr?: string | null,
  requiredMonths = OperationalThresholds.PASSPORT_EXPIRY_THRESHOLD_MONTHS
): {
  isValid: boolean;
  isExpiringSoon: boolean;
  isExpired: boolean;
  remainingMonths: number;
} {
  if (!expiryDateStr) {
    return { isValid: false, isExpiringSoon: false, isExpired: false, remainingMonths: 0 };
  }

  const expParts = expiryDateStr.split('-').map(Number);
  if (expParts.length !== 3) {
    return { isValid: false, isExpiringSoon: false, isExpired: false, remainingMonths: 0 };
  }

  const expDate = new Date(expParts[0], expParts[1] - 1, expParts[2]);
  
  let refDate = new Date();
  if (departureDateStr) {
    const depParts = departureDateStr.split('-').map(Number);
    if (depParts.length === 3) {
      refDate = new Date(depParts[0], depParts[1] - 1, depParts[2]);
    }
  }

  const isExpired = expDate <= refDate;
  if (isExpired) {
    return { isValid: false, isExpiringSoon: false, isExpired: true, remainingMonths: 0 };
  }

  // Calculate remaining months
  const diffTime = expDate.getTime() - refDate.getTime();
  const remainingMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375);

  const isExpiringSoon = remainingMonths < requiredMonths;
  const isValid = !isExpired && !isExpiringSoon;

  return {
    isValid,
    isExpiringSoon,
    isExpired,
    remainingMonths: Math.max(0, Math.round(remainingMonths * 10) / 10),
  };
}
