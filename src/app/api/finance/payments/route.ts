import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { StorageService } from '@/lib/repository/storage.service';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { PaymentAllocationStatus, PaymentStatus } from '@/types/database.types';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const { searchParams } = new URL(req.url);
    const packageId = searchParams.get('package_id') || undefined;
    const picId = searchParams.get('pic_id') || undefined;
    const allocationStatus = (searchParams.get('allocation_status') as PaymentAllocationStatus) || undefined;
    const status = (searchParams.get('status') as PaymentStatus) || undefined;
    const search = searchParams.get('search') || undefined;

    const payments = await DbRepository.getPayments({ packageId, picId, allocationStatus, status, search });
    
    // Attach signed URLs for private transfer proofs
    const paymentsWithSignedUrls = await Promise.all(
      payments.map(async (p) => {
        if (p.storage_path) {
          const signedUrl = await StorageService.getSignedUrl(p.storage_path, 3600);
          return { ...p, signed_proof_url: signedUrl };
        }
        return p;
      })
    );

    return NextResponse.json(paymentsWithSignedUrls);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat daftar pembayaran' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const contentType = req.headers.get('content-type') || '';
    let paymentDate = new Date().toISOString().split('T')[0];
    let amount = 0;
    let senderName = '';
    let senderBank = '';
    let packageId: string | undefined;
    let picId: string | undefined;
    let notes = '';
    let storagePath: string | undefined;

    let participantId: string | undefined;
    let invoiceId: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      paymentDate = (formData.get('payment_date') as string) || paymentDate;
      amount = Number(formData.get('amount')) || 0;
      senderName = (formData.get('sender_name') as string) || '';
      senderBank = (formData.get('sender_bank') as string) || '';
      packageId = (formData.get('package_id') as string) || undefined;
      picId = (formData.get('pic_id') as string) || undefined;
      notes = (formData.get('notes') as string) || '';
      participantId = (formData.get('package_participant_id') as string) || (formData.get('participant_id') as string) || undefined;
      invoiceId = (formData.get('invoice_id') as string) || undefined;

      const file = formData.get('proof_file') as File | null;
      if (file && file.size > 0) {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split('.').pop() || 'jpg';
        const targetPath = `payments/proof_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
        const uploadResult = await StorageService.uploadDocument(fileBuffer, targetPath, file.type || 'image/jpeg');
        storagePath = uploadResult.path;
      }
    } else {
      const body = await req.json();
      paymentDate = body.payment_date || paymentDate;
      amount = Number(body.amount) || 0;
      senderName = body.sender_name || '';
      senderBank = body.sender_bank || '';
      packageId = body.package_id || undefined;
      picId = body.pic_id || undefined;
      notes = body.notes || '';
      storagePath = body.storage_path || undefined;
      participantId = body.package_participant_id || body.participant_id || undefined;
      invoiceId = body.invoice_id || undefined;
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Nominal pembayaran harus lebih besar dari 0' }, { status: 400 });
    }
    if (!senderName || !senderName.trim()) {
      return NextResponse.json({ error: 'Nama pengirim wajib diisi' }, { status: 400 });
    }

    // Resolve package_id if participant is provided
    if (participantId && !packageId) {
      const part = await DbRepository.getParticipantById(participantId);
      if (part) {
        packageId = part.package_id;
        if (!picId && part.pic_id) picId = part.pic_id;
      }
    }

    const createdPayment = await DbRepository.createPayment({
      payment_date: paymentDate,
      amount,
      sender_name: senderName.trim(),
      sender_bank: senderBank.trim() || undefined,
      package_id: packageId,
      pic_id: picId,
      storage_path: storagePath,
      notes: notes.trim() || undefined,
      created_by: auth.session?.userId,
    });

    // Auto-allocate to participant/invoice if specified
    if (participantId || invoiceId) {
      let targetInv = invoiceId ? await DbRepository.getInvoiceById(invoiceId) : null;
      if (!targetInv && participantId) {
        targetInv = await DbRepository.getInvoiceByParticipantId(participantId);
      }

      if (targetInv) {
        const allocResult = await DbRepository.allocatePayment(
          createdPayment.id,
          [{ invoiceId: targetInv.id, amount: createdPayment.amount }],
          auth.session?.userId
        );
        if (allocResult.success && allocResult.payment) {
          return NextResponse.json(allocResult.payment);
        }
      }
    }

    return NextResponse.json(createdPayment);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mencatat pembayaran' }, { status: 400 });
  }
}
