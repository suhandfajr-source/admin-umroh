import { differenceInDays, differenceInMonths, parseISO, isPast } from 'date-fns';
import { Jamaah } from '@/types/database.types';

export type PassportHealthStatus = 'MISSING' | 'EXPIRED' | 'EXPIRING_SOON' | 'INCOMPLETE' | 'VALID';

export interface PassportHealthResult {
  status: PassportHealthStatus;
  message: string;
  badgeVariant: 'danger' | 'warning' | 'neutral' | 'success';
  expiryDate?: string;
  daysRemaining?: number;
}

export function evaluatePassportHealth(
  jamaah: Jamaah,
  referenceDepartureDate?: string | null
): PassportHealthResult {
  // 1. Missing Passport
  if (!jamaah.passport_number) {
    return {
      status: 'MISSING',
      message: 'Paspor belum diunggah / belum ada.',
      badgeVariant: 'warning',
    };
  }

  // 2. Incomplete Passport data
  if (!jamaah.passport_expiry_date || !jamaah.passport_issue_date || !jamaah.passport_issue_place) {
    return {
      status: 'INCOMPLETE',
      message: 'Data paspor belum lengkap.',
      badgeVariant: 'warning',
      expiryDate: jamaah.passport_expiry_date || undefined,
    };
  }

  try {
    const expiry = parseISO(jamaah.passport_expiry_date);
    const targetDate = referenceDepartureDate ? parseISO(referenceDepartureDate) : new Date();

    // 3. Expired
    if (isPast(expiry)) {
      return {
        status: 'EXPIRED',
        message: 'Paspor telah melewati masa berlaku (Expired).',
        badgeVariant: 'danger',
        expiryDate: jamaah.passport_expiry_date,
        daysRemaining: differenceInDays(expiry, new Date()),
      };
    }

    // 4. Validity relative to departure date (Minimum 6 months requirement for Umrah travel)
    const monthsRemaining = differenceInMonths(expiry, targetDate);
    const daysRemaining = differenceInDays(expiry, new Date());

    if (monthsRemaining < 6) {
      return {
        status: 'EXPIRING_SOON',
        message: referenceDepartureDate 
          ? `Masa berlaku paspor kurang dari 6 bulan dari tanggal keberangkatan (${monthsRemaining} bulan tersisa).`
          : `Paspor akan habis masa berlaku dalam waktu dekat (${monthsRemaining} bulan).`,
        badgeVariant: 'danger',
        expiryDate: jamaah.passport_expiry_date,
        daysRemaining,
      };
    }

    return {
      status: 'VALID',
      message: `Paspor aktif dan valid (${monthsRemaining} bulan tersisa).`,
      badgeVariant: 'success',
      expiryDate: jamaah.passport_expiry_date,
      daysRemaining,
    };
  } catch (err) {
    return {
      status: 'INCOMPLETE',
      message: 'Format tanggal paspor tidak valid.',
      badgeVariant: 'warning',
    };
  }
}
