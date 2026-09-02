import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/guard';
import { DbRepository } from '@/lib/repository/db';
import { OperationalAlertEngine } from '@/lib/intelligence/alert-engine';
import { ReadinessService } from '@/lib/intelligence/readiness-service';
import { RecentActivityService } from '@/lib/intelligence/activity-service';
import { calculateDaysToDeparture } from '@/lib/intelligence/thresholds';
import { DashboardIntelligenceSummary } from '@/types/database.types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    // Run evaluation to ensure live freshness
    await OperationalAlertEngine.evaluate();

    // Fetch aggregate datasets
    const [allPackages, allAlerts, allInvoices, allPayments, activities] = await Promise.all([
      DbRepository.getPackageList(),
      DbRepository.getOperationalAlerts({ status: 'OPEN' }),
      DbRepository.getInvoices(),
      DbRepository.getPayments(),
      RecentActivityService.getRecentActivities(15),
    ]);

    // Filter and sort Upcoming Packages (nearest departure first, exclude past)
    const upcomingPackages = allPackages
      .filter(p => !p.deleted_at && p.status !== 'COMPLETED' && calculateDaysToDeparture(p.departure_date) >= 0)
      .sort((a, b) => new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime());

    // Calculate readiness for each upcoming package
    const packageReadinessList = await Promise.all(
      upcomingPackages.map(async (pkg) => ({
        package: pkg,
        readiness: await ReadinessService.getPackageReadiness(pkg.id),
      }))
    );

    // Compute Global KPIs
    const totalActiveInvoicesAmount = allInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const totalCollectedPaymentsAmount = allInvoices.reduce((sum, inv) => sum + (inv.total_paid || 0), 0);
    const totalOutstandingAmount = allInvoices.reduce((sum, inv) => sum + (inv.outstanding || 0), 0);

    const unallocatedPayments = allPayments.filter(p => p.status !== 'CANCELLED' && p.allocation_status === 'UNALLOCATED');
    const unallocatedAmount = unallocatedPayments.reduce((sum, p) => sum + (p.remaining_unallocated || 0), 0);

    const totalUpcomingPax = packageReadinessList.reduce((sum, item) => sum + item.readiness.total_active_participants, 0);

    const summary: DashboardIntelligenceSummary = {
      kpis: {
        upcoming_packages_count: upcomingPackages.length,
        upcoming_active_pax_count: totalUpcomingPax,
        total_active_invoices_amount: totalActiveInvoicesAmount,
        total_collected_payments_amount: totalCollectedPaymentsAmount,
        total_outstanding_amount: totalOutstandingAmount,
        unallocated_payments_count: unallocatedPayments.length,
        unallocated_payments_amount: unallocatedAmount,
        critical_alerts_count: allAlerts.filter(a => a.severity === 'CRITICAL').length,
        warning_alerts_count: allAlerts.filter(a => a.severity === 'WARNING').length,
        open_alerts_count: allAlerts.length,
      },
      action_required: allAlerts.slice(0, 10),
      upcoming_packages: packageReadinessList,
      recent_activities: activities,
      evaluation_metadata: {
        last_evaluated_at: new Date().toISOString(),
        evaluator_source: 'AGGREGATE_DASHBOARD_SERVICE',
        total_open_alerts: allAlerts.length,
      },
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memuat data dashboard intelligence' }, { status: 500 });
  }
}
