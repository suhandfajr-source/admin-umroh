import { NextRequest, NextResponse } from 'next/server';
import { DbRepository } from '@/lib/repository/db';
import { detectDuplicate } from '@/lib/duplicate-detector';

export async function POST(req: NextRequest) {
  try {
    const { candidate } = await req.json();
    if (!candidate) {
      return NextResponse.json({ duplicate: null });
    }

    const allJamaah = await DbRepository.getJamaahList();
    const match = detectDuplicate(candidate, allJamaah);

    return NextResponse.json({
      duplicate: match,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
