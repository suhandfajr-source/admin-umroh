/**
 * Address Helpers for Indonesian KTP format
 * Composes granular KTP address fields into a single unified database string
 * and parses unified strings back into granular form inputs.
 */

export interface KtpAddressParts {
  street: string;
  rt_rw: string;
  kelurahan: string;
  kecamatan: string;
  city: string;
  province: string;
}

export function composeKtpAddress(parts: Partial<KtpAddressParts>): string {
  const chunks: string[] = [];

  const street = parts.street?.trim();
  if (street) chunks.push(street);

  const rtRw = parts.rt_rw?.trim();
  if (rtRw) {
    if (rtRw.toUpperCase().startsWith('RT')) {
      chunks.push(rtRw);
    } else {
      chunks.push(`RT/RW ${rtRw}`);
    }
  }

  const kel = parts.kelurahan?.trim();
  if (kel) {
    if (/^(kel|desa)/i.test(kel)) {
      chunks.push(kel);
    } else {
      chunks.push(`Kel. ${kel}`);
    }
  }

  const kec = parts.kecamatan?.trim();
  if (kec) {
    if (/^kec/i.test(kec)) {
      chunks.push(kec);
    } else {
      chunks.push(`Kec. ${kec}`);
    }
  }

  const city = parts.city?.trim();
  if (city) {
    if (/^(kota|kab)/i.test(city)) {
      chunks.push(city);
    } else {
      chunks.push(`Kota/Kab. ${city}`);
    }
  }

  const prov = parts.province?.trim();
  if (prov) {
    chunks.push(prov);
  }

  return chunks.join(', ');
}

export function parseKtpAddress(fullAddress?: string | null): KtpAddressParts {
  const result: KtpAddressParts = {
    street: '',
    rt_rw: '',
    kelurahan: '',
    kecamatan: '',
    city: '',
    province: '',
  };

  if (!fullAddress || !fullAddress.trim()) {
    return result;
  }

  const clean = fullAddress.trim();
  const segments = clean.split(',').map(s => s.trim()).filter(Boolean);

  const remainingSegments: string[] = [];

  for (const seg of segments) {
    const upper = seg.toUpperCase();

    // Check RT/RW
    const rtrwMatch = seg.match(/(?:RT[\/\s]*RW|RT)\s*[:=]?\s*([0-9\/\s-]+)/i);
    if (rtrwMatch && !result.rt_rw) {
      result.rt_rw = rtrwMatch[1].trim();
      continue;
    }

    // Check Kelurahan / Desa
    const kelMatch = seg.match(/(?:Kel(?:urahan)?\.?|Desa)\s*([A-Za-z0-9\s-]+)/i);
    if (kelMatch && !result.kelurahan) {
      result.kelurahan = kelMatch[1].trim();
      continue;
    }

    // Check Kecamatan
    const kecMatch = seg.match(/(?:Kec(?:amatan)?\.?)\s*([A-Za-z0-9\s-]+)/i);
    if (kecMatch && !result.kecamatan) {
      result.kecamatan = kecMatch[1].trim();
      continue;
    }

    // Check Kota / Kabupaten
    const cityMatch = seg.match(/(?:Kota|Kab(?:upaten)?\.?)\s*([A-Za-z0-9\s-]+)/i);
    if (cityMatch && !result.city) {
      result.city = cityMatch[1].trim();
      continue;
    }

    remainingSegments.push(seg);
  }

  if (remainingSegments.length > 0) {
    result.street = remainingSegments[0];
    if (remainingSegments.length > 1 && !result.city) {
      result.city = remainingSegments[1];
    }
    if (remainingSegments.length > 2 && !result.province) {
      result.province = remainingSegments[2];
    }
  }

  return result;
}
