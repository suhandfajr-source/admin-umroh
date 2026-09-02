import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { RecentActivityService } from '@/lib/intelligence/activity-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20;

  try {
    const activities = await RecentActivityService.getRecentActivities(limit);
    return NextResponse.json({ activities, total: activities.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat timeline aktivitas' }, { status: 500 });
  }
}
