import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { differenceInDays, parseISO } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const packages = await DbRepository.getPackages();
    const participants = await DbRepository.getParticipants();

    const today = new Date();

    const resumeRows = packages.map((pkg) => {
      const pkgParts = participants.filter(p => p.package_id === pkg.id && !p.deleted_at);
      const paxCount = pkgParts.length;

      let totalTagihan = 0;
      let totalPembayaran = 0;

      pkgParts.forEach(p => {
        const inv = p.invoice;
        const tagihan = inv?.total_amount || p.selling_price || (pkg as any).price_quad || pkg.reference_price || 0;
        const bayar = inv?.total_paid || 0;
        totalTagihan += tagihan;
        totalPembayaran += bayar;
      });

      const totalKekurangan = Math.max(0, totalTagihan - totalPembayaran);

      // Automatic H countdown
      let hValue = '-';
      if (pkg.departure_date) {
        try {
          const depDate = parseISO(pkg.departure_date);
          const diff = differenceInDays(depDate, today);
          if (diff === 0) {
            hValue = 'H';
          } else if (diff > 0) {
            hValue = `H-${diff}`;
          } else {
            hValue = `H+${Math.abs(diff)}`;
          }
        } catch {
          hValue = '-';
        }
      }

      // Configured payment deadline (no hardcoded assumption)
      const tglPelunasan = (pkg as any).payment_deadline || (pkg as any).tanggal_pelunasan || 'Belum Diatur';

      const biayaPerProgram = (pkg as any).price_quad || pkg.reference_price || (paxCount > 0 ? Math.round(totalTagihan / paxCount) : 0);
      const diskonTl = (pkg as any).diskon_tl !== undefined ? Number((pkg as any).diskon_tl) : 0;
      const fee = (pkg as any).fee !== undefined && (pkg as any).fee !== null ? Number((pkg as any).fee) : null;
      const balance = (pkg as any).balance !== undefined && (pkg as any).balance !== null ? Number((pkg as any).balance) : null;

      return {
        id: pkg.id,
        program: pkg.package_name || (pkg as any).name || 'Paket Umrah',
        keberangkatan: pkg.departure_date || '-',
        tanggal_pelunasan: tglPelunasan,
        h_days: hValue,
        pax_terdaftar: paxCount,
        pax_capacity: (pkg as any).capacity || pkg.quota || 0,
        biaya_per_program: biayaPerProgram,
        diskon_tl: diskonTl,
        total_tagihan: totalTagihan,
        total_pembayaran: totalPembayaran,
        total_kekurangan: totalKekurangan,
        fee: fee,
        balance: balance,
        status: pkg.status || 'ACTIVE',
      };
    });

    return NextResponse.json({
      success: true,
      data: resumeRows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, departure_date, payment_deadline, price_quad, capacity } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nama Program Keberangkatan wajib diisi' }, { status: 400 });
    }

    const created = await DbRepository.createPackage({
      package_name: name,
      departure_date: departure_date || new Date().toISOString().split('T')[0],
      reference_price: price_quad ? parseInt(price_quad, 10) : 30000000,
      quota: capacity ? parseInt(capacity, 10) : 45,
      b2b_price: price_quad ? Math.round(parseInt(price_quad, 10) * 0.9) : 27000000,
      airline: 'Garuda Indonesia / Saudia',
      status: 'OPEN',
    });

    return NextResponse.json({ success: true, package: created });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat keberangkatan' }, { status: 500 });
  }
}
