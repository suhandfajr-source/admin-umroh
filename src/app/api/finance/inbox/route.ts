import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { StorageService } from '@/lib/repository/storage.service';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const inbox = await DbRepository.getPaymentInbox();

    const inboxWithSignedUrls = await Promise.all(
      inbox.map(async (p) => {
        if (p.storage_path) {
          const signedUrl = await StorageService.getSignedUrl(p.storage_path, 3600);
          return { ...p, signed_proof_url: signedUrl };
        }
        return p;
      })
    );

    return NextResponse.json(inboxWithSignedUrls);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat Payment Inbox' }, { status: 500 });
  }
}
