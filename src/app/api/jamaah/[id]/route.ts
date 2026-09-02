import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jamaah = await DbRepository.getJamaahById(params.id);
    if (!jamaah) {
      return NextResponse.json({ error: 'Jamaah tidak ditemukan' }, { status: 404 });
    }

    const trips = await DbRepository.getJamaahTrips(params.id);
    const allPayments = await DbRepository.getPayments();
    
    // Find all payments linked to this jamaah's trips/invoices
    const participantIds = trips.map(t => t.id);
    const invoiceIds = trips.map(t => t.invoice?.id).filter(Boolean);

    const relevantPayments = allPayments.filter(p => {
      if ((p as any).package_participant_id && participantIds.includes((p as any).package_participant_id)) return true;
      if (p.allocations && p.allocations.some(a => invoiceIds.includes(a.invoice_id))) return true;
      return false;
    });

    // Compute finance summary
    let totalTagihan = 0;
    let totalPaid = 0;
    trips.forEach(t => {
      totalTagihan += t.invoice?.total_amount || t.selling_price || 0;
      totalPaid += t.invoice?.total_paid || 0;
    });
    const totalKekurangan = Math.max(0, totalTagihan - totalPaid);
    const paymentStatus = totalTagihan === 0 ? 'NO_TRIP' : totalKekurangan === 0 ? 'LUNAS' : totalPaid > 0 ? 'SEBAGIAN' : 'BELUM_BAYAR';

    return NextResponse.json({
      ...jamaah,
      trips,
      payments: relevantPayments,
      finance_summary: {
        total_tagihan: totalTagihan,
        total_paid: totalPaid,
        total_outstanding: totalKekurangan,
        status: paymentStatus,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const updated = await DbRepository.updateJamaah(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Jamaah tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await DbRepository.deleteJamaah(params.id);
    if (!success) {
      return NextResponse.json({ error: 'Jamaah tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Data Jamaah berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
