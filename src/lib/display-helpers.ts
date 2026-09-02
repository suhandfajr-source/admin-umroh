/**
 * Human-Friendly Display Helpers for Admin Umroh
 * Ensures technical/database IDs (e.g. jam_123, UUIDs) are never exposed to normal operational views.
 */

export function formatJamaahDisplayId(
  jamaahOrId?: { id?: string | null; member_id?: string | null } | string | null,
  indexFallback?: number
): string {
  if (!jamaahOrId) return '-';

  if (typeof jamaahOrId === 'string') {
    const clean = jamaahOrId.trim();
    if (!clean || clean === '-') return '-';
    if (clean.startsWith('WKU-')) return clean;
    if (clean.startsWith('jam_')) {
      const parts = clean.split('_');
      // If structured like jam_123 or jam_timestamp_hash
      if (parts[1] && /^\d+$/.test(parts[1])) {
        const suffix = parts[1].length > 4 ? parts[1].slice(-4) : parts[1].padStart(4, '0');
        return `WKU-${suffix}`;
      }
      const numMatch = clean.match(/\d+/);
      if (numMatch) {
        const lastDigits = numMatch[0].slice(-4);
        return `WKU-${lastDigits.padStart(4, '0')}`;
      }
      return `WKU-${clean.replace('jam_', '').slice(0, 4).toUpperCase()}`;
    }
    return clean;
  }

  if (jamaahOrId.member_id && jamaahOrId.member_id.trim()) {
    return jamaahOrId.member_id;
  }

  if (jamaahOrId.id) {
    const rawId = jamaahOrId.id.trim();
    if (rawId.startsWith('WKU-')) return rawId;
    if (rawId.startsWith('jam_')) {
      const parts = rawId.split('_');
      if (parts[1] && /^\d+$/.test(parts[1])) {
        const suffix = parts[1].length > 4 ? parts[1].slice(-4) : parts[1].padStart(4, '0');
        return `WKU-${suffix}`;
      }
      const numMatch = rawId.match(/\d+/);
      if (numMatch) {
        const lastDigits = numMatch[0].slice(-4);
        return `WKU-${lastDigits.padStart(4, '0')}`;
      }
      return `WKU-${rawId.replace('jam_', '').slice(0, 4).toUpperCase()}`;
    }
    return rawId;
  }

  if (indexFallback !== undefined && indexFallback !== null) {
    return `WKU-${String(indexFallback + 1).padStart(4, '0')}`;
  }

  return '-';
}
