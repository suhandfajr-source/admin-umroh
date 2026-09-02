import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { formatJamaahDisplayId } from '@/lib/display-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const packageId = params.id;
    const pkg = await DbRepository.getPackageById(packageId);

    if (!pkg) {
      return NextResponse.json({ error: 'Keberangkatan tidak ditemukan' }, { status: 404 });
    }

    const participants = await DbRepository.getParticipants({ packageId });

    let totalTagihan = 0;
    let totalPembayaran = 0;

    const participantRows = participants.map((p, idx) => {
      const j = p.jamaah;
      const inv = p.invoice;
      const programPrice = p.selling_price || (pkg as any).price_quad || pkg.reference_price || 0;
      const diskon = 0;
      const tagihan = inv?.total_amount || programPrice;
      const bayar = inv?.total_paid || 0;
      const kekurangan = Math.max(0, tagihan - bayar);

      totalTagihan += tagihan;
      totalPembayaran += bayar;

      let status: 'LUNAS' | 'BELUM_LUNAS' | 'BELUM_BAYAR' = 'BELUM_BAYAR';
      if (tagihan > 0 && kekurangan === 0) {
        status = 'LUNAS';
      } else if (bayar > 0) {
        status = 'BELUM_LUNAS';
      }

      return {
        no: idx + 1,
        id: p.id,
        participant_id: p.id,
        jamaah_id: j?.id || p.jamaah_id,
        nama_jamaah: j?.passport_name || j?.identity_name || j?.ktp_name || 'Jamaah',
        id_jamaah: formatJamaahDisplayId(j, idx),
        nik: j?.nik || '-',
        phone: j?.phone || '-',
        room_type: (p as any).room_type || 'QUAD',
        harga_program: programPrice,
        diskon: diskon,
        total_tagihan: tagihan,
        total_pembayaran: bayar,
        kekurangan: kekurangan,
        status: status,
      };
    });

    const totalKekurangan = Math.max(0, totalTagihan - totalPembayaran);

    return NextResponse.json({
      success: true,
      departure: {
        id: pkg.id,
        name: pkg.package_name || (pkg as any).name || 'Paket Umrah',
        departure_date: pkg.departure_date || '-',
        payment_deadline: (pkg as any).payment_deadline || 'Belum Diatur',
        capacity: (pkg as any).capacity || pkg.quota || 45,
        fee: (pkg as any).fee !== undefined ? (pkg as any).fee : null,
        balance: (pkg as any).balance !== undefined ? (pkg as any).balance : null,
        pax_count: participants.length,
        total_tagihan: totalTagihan,
        total_pembayaran: totalPembayaran,
        total_kekurangan: totalKekurangan,
      },
      participants: participantRows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const updated = await DbRepository.updatePackage(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Keberangkatan tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, package: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui data keberangkatan' }, { status: 500 });
  }
}
