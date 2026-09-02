import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { verifyAdminAuth } from '@/lib/auth/guard';

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const { package_id, template_id, sorting } = body;

    if (!package_id) {
      return NextResponse.json({ error: 'package_id wajib disertakan' }, { status: 400 });
    }

    const validation = await DbRepository.validateManifest(package_id, template_id, sorting);
    return NextResponse.json(validation);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memvalidasi manifest paket' },
      { status: 400 }
    );
  }
}
