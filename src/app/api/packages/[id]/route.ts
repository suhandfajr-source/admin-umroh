import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pkg = await DbRepository.getPackageById(params.id);
    if (!pkg) {
      return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 404 });
    }

    const participants = await DbRepository.getParticipants({ packageId: params.id });
    return NextResponse.json({
      ...pkg,
      participants,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
