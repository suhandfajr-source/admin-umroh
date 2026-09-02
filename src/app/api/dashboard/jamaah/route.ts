import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { formatJamaahDisplayId } from '@/lib/display-helpers';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const packageId = searchParams.get('package_id') || '';
    const picId = searchParams.get('pic_id') || '';
    const paymentStatus = searchParams.get('payment_status') || '';
    const docStatus = searchParams.get('doc_status') || '';

    const packages = await DbRepository.getPackages();
    const pics = await DbRepository.getPicList();
    const allParticipants = await DbRepository.getParticipants();
    const filteredParticipants = await DbRepository.getParticipants({ 
      packageId: packageId || undefined,
      picId: picId || undefined,
    });

    const now = new Date();

    // 1. Process Individual Participant Rows
    let rows = filteredParticipants.map((p, idx) => {
      const j = p.jamaah;
      const pkg = p.package;
      const inv = p.invoice;
      const pic = p.pic;

      const totalTagihan = inv?.total_amount || p.selling_price || 0;
      const totalPaid = inv?.total_paid || 0;
      const totalKekurangan = Math.max(0, totalTagihan - totalPaid);

      let payStatus: 'LUNAS' | 'BELUM_LUNAS' | 'BELUM_BAYAR' = 'BELUM_BAYAR';
      if (totalTagihan > 0 && totalKekurangan === 0) {
        payStatus = 'LUNAS';
      } else if (totalPaid > 0) {
        payStatus = 'BELUM_LUNAS';
      }

      // Count core documents (PASSPORT, KTP, KK, VAKSIN, BUKU_NIKAH)
      const docs = j?.documents || [];
      const coreDocTypes = ['PASSPORT', 'KTP', 'KK', 'VAKSIN', 'BUKU_NIKAH'];
      const uploadedCoreCount = coreDocTypes.filter(type => docs.some(d => d.document_type === type)).length;

      return {
        id: p.id,
        participant_id: p.id,
        jamaah_id: j?.id || p.jamaah_id,
        nama_jamaah: j?.passport_name || j?.identity_name || j?.ktp_name || 'Jamaah',
        id_jamaah: formatJamaahDisplayId(j, idx),
        nik: j?.nik || '',
        passport_number: j?.passport_number || '',
        phone: j?.phone || '-',
        keberangkatan: pkg?.package_name ? `${pkg.package_name} (${pkg.departure_date || '-'})` : '-',
        departure_date: pkg?.departure_date || '',
        package_id: pkg?.id || p.package_id,
        package_name: pkg?.package_name || (pkg as any)?.name || '-',
        pic_id: pic?.id || p.pic_id || null,
        pic_name: pic?.name || 'Langsung (Tanpa PIC)',
        total_tagihan: totalTagihan,
        total_pembayaran: totalPaid,
        kekurangan: totalKekurangan,
        status_pembayaran: payStatus,
        dokumen_count: uploadedCoreCount,
        dokumen_label: `${uploadedCoreCount}/5`,
        dokumen_lengkap: uploadedCoreCount >= 5,
        room_type: (p as any).room_type || '-',
      };
    });

    if (search) {
      rows = rows.filter(r => 
        r.nama_jamaah.toLowerCase().includes(search) ||
        r.id_jamaah.toLowerCase().includes(search) ||
        r.nik.toLowerCase().includes(search) ||
        r.passport_number.toLowerCase().includes(search) ||
        r.phone.toLowerCase().includes(search) ||
        r.pic_name.toLowerCase().includes(search) ||
        r.package_name.toLowerCase().includes(search)
      );
    }

    if (paymentStatus) {
      rows = rows.filter(r => r.status_pembayaran === paymentStatus);
    }

    if (docStatus === 'LENGKAP') {
      rows = rows.filter(r => r.dokumen_count >= 5);
    } else if (docStatus === 'BELUM_LENGKAP') {
      rows = rows.filter(r => r.dokumen_count < 5);
    }

    // 2. Executive Global Summary
    const totalTagihanAll = allParticipants.reduce((sum, p) => sum + (p.invoice?.total_amount || p.selling_price || 0), 0);
    const totalTerbayarAll = allParticipants.reduce((sum, p) => sum + (p.invoice?.total_paid || 0), 0);
    const totalKekuranganAll = Math.max(0, totalTagihanAll - totalTerbayarAll);

    const summary = {
      total_jamaah: allParticipants.length,
      total_packages: packages.length,
      total_pics: pics.length,
      total_tagihan: totalTagihanAll,
      total_pembayaran: totalTerbayarAll,
      total_kekurangan: totalKekuranganAll,
      lunas_count: allParticipants.filter(p => p.invoice?.status === 'PAID').length,
      belum_lunas_count: allParticipants.filter(p => p.invoice?.status !== 'PAID').length,
    };

    // 3. Packages Dashboard Breakdown
    const packagesDashboard = packages.map(pkg => {
      const pkgPax = allParticipants.filter(p => p.package_id === pkg.id);
      const pkgTagihan = pkgPax.reduce((sum, p) => sum + (p.invoice?.total_amount || p.selling_price || 0), 0);
      const pkgTerbayar = pkgPax.reduce((sum, p) => sum + (p.invoice?.total_paid || 0), 0);
      const pkgKekurangan = Math.max(0, pkgTagihan - pkgTerbayar);
      const paidPct = pkgTagihan > 0 ? Math.min(100, Math.round((pkgTerbayar / pkgTagihan) * 100)) : 0;
      
      const quota = pkg.quota || 45;
      const occupancyPct = quota > 0 ? Math.min(100, Math.round((pkgPax.length / quota) * 100)) : 0;

      let daysToDeparture: number | null = null;
      if (pkg.departure_date) {
        const depDate = new Date(pkg.departure_date);
        daysToDeparture = Math.ceil((depDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const lunasCount = pkgPax.filter(p => p.invoice?.status === 'PAID').length;
      const docReadyCount = pkgPax.filter(p => {
        const docs = p.jamaah?.documents || [];
        return docs.some(d => d.document_type === 'PASSPORT');
      }).length;

      return {
        id: pkg.id,
        package_name: pkg.package_name || (pkg as any).name || 'Paket Umrah',
        departure_date: pkg.departure_date || '-',
        return_date: pkg.return_date || '-',
        airline: pkg.airline || 'Saudi Airlines',
        makkah_hotel: pkg.makkah_hotel || '-',
        madinah_hotel: pkg.madinah_hotel || '-',
        quota,
        registered_pax: pkgPax.length,
        occupancy_pct: occupancyPct,
        days_to_departure: daysToDeparture,
        total_tagihan: pkgTagihan,
        total_pembayaran: pkgTerbayar,
        total_kekurangan: pkgKekurangan,
        paid_pct: paidPct,
        lunas_count: lunasCount,
        belum_lunas_count: pkgPax.length - lunasCount,
        doc_ready_count: docReadyCount,
        status: pkg.status || 'OPEN',
      };
    });

    // 4. PICs Dashboard Breakdown
    const picsDashboard = pics.map(pic => {
      const picPax = allParticipants.filter(p => p.pic_id === pic.id);
      const picTagihan = picPax.reduce((sum, p) => sum + (p.invoice?.total_amount || p.selling_price || 0), 0);
      const picTerbayar = picPax.reduce((sum, p) => sum + (p.invoice?.total_paid || 0), 0);
      const picKekurangan = Math.max(0, picTagihan - picTerbayar);
      const paidPct = picTagihan > 0 ? Math.min(100, Math.round((picTerbayar / picTagihan) * 100)) : 0;
      const lunasCount = picPax.filter(p => p.invoice?.status === 'PAID').length;

      // Unique packages count
      const distinctPackageIds = new Set(picPax.map(p => p.package_id));

      const participantSummaries = picPax.map(p => {
        const j = p.jamaah;
        const inv = p.invoice;
        const total = inv?.total_amount || p.selling_price || 0;
        const paid = inv?.total_paid || 0;
        return {
          id: p.id,
          jamaah_id: j?.id || p.jamaah_id,
          nama: j?.passport_name || j?.identity_name || j?.ktp_name || 'Jamaah',
          package_name: p.package?.package_name || 'Paket Umrah',
          total_tagihan: total,
          total_paid: paid,
          outstanding: Math.max(0, total - paid),
          status: inv?.status || (total === paid ? 'PAID' : 'UNPAID'),
        };
      });

      return {
        id: pic.id,
        name: pic.name,
        phone: pic.phone || '-',
        notes: pic.notes || '-',
        total_jamaah: picPax.length,
        packages_count: distinctPackageIds.size,
        total_tagihan: picTagihan,
        total_pembayaran: picTerbayar,
        total_kekurangan: picKekurangan,
        paid_pct: paidPct,
        lunas_count: lunasCount,
        belum_lunas_count: picPax.length - lunasCount,
        participants: participantSummaries,
      };
    });

    return NextResponse.json({
      success: true,
      summary,
      total: rows.length,
      packages,
      pics,
      packages_dashboard: packagesDashboard,
      pics_dashboard: picsDashboard,
      data: rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
