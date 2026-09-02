import { NextRequest } from 'next/server';
import { GET as getDashboard } from '../src/app/api/intelligence/dashboard/route';
import { GET as getActions } from '../src/app/api/intelligence/actions/route';
import { POST as postEvaluate } from '../src/app/api/intelligence/evaluate/route';
import { POST as postDismiss } from '../src/app/api/intelligence/alerts/[id]/dismiss/route';
import { GET as getAudit } from '../src/app/api/audit/route';
import { GET as getActivity } from '../src/app/api/activity/route';
import { DbRepository } from '../src/lib/repository/db';

async function runStage5SecuritySuite() {
  console.log('=== STARTING STAGE 5 INTELLIGENCE SECURITY TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  function createMockRequest(url: string, method = 'GET', authHeader?: string, body?: any): NextRequest {
    const headers: Record<string, string> = {};
    if (authHeader) headers['authorization'] = authHeader;
    if (body) headers['content-type'] = 'application/json';

    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  const unauthHeader = 'Bearer unauthenticated';
  const inactiveAdminAuth = 'Bearer mock_inactive_token';
  const activeAdminAuth = 'Bearer mock_active_admin_token';

  // ---------------------------------------------------------------------------
  // 1. UNAUTHENTICATED (401) ACCESS TESTS
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing Unauthenticated (401) Access ---');
  
  // Dashboard
  const reqDashboardUnauth = createMockRequest('http://localhost:3000/api/intelligence/dashboard', 'GET', unauthHeader);
  const resDashboardUnauth = await getDashboard(reqDashboardUnauth);
  assert(resDashboardUnauth.status === 401, 'GET /api/intelligence/dashboard rejects unauthenticated request with 401');

  // Actions
  const reqActionsUnauth = createMockRequest('http://localhost:3000/api/intelligence/actions', 'GET', unauthHeader);
  const resActionsUnauth = await getActions(reqActionsUnauth);
  assert(resActionsUnauth.status === 401, 'GET /api/intelligence/actions rejects unauthenticated request with 401');

  // Evaluate without Cron Secret or Admin Auth
  const reqEvaluateUnauth = createMockRequest('http://localhost:3000/api/intelligence/evaluate', 'POST', unauthHeader);
  const resEvaluateUnauth = await postEvaluate(reqEvaluateUnauth);
  assert(resEvaluateUnauth.status === 401, 'POST /api/intelligence/evaluate rejects unauthenticated request with 401');

  // Dismiss Alert
  const reqDismissUnauth = createMockRequest('http://localhost:3000/api/intelligence/alerts/alert-1/dismiss', 'POST', unauthHeader, { reason: 'testing' });
  const resDismissUnauth = await postDismiss(reqDismissUnauth, { params: { id: 'alert-1' } });
  assert(resDismissUnauth.status === 401, 'POST /api/intelligence/alerts/[id]/dismiss rejects unauthenticated request with 401');

  // Audit Logs
  const reqAuditUnauth = createMockRequest('http://localhost:3000/api/audit', 'GET', unauthHeader);
  const resAuditUnauth = await getAudit(reqAuditUnauth);
  assert(resAuditUnauth.status === 401, 'GET /api/audit rejects unauthenticated request with 401');

  // Activity Timeline
  const reqActivityUnauth = createMockRequest('http://localhost:3000/api/activity', 'GET', unauthHeader);
  const resActivityUnauth = await getActivity(reqActivityUnauth);
  assert(resActivityUnauth.status === 401, 'GET /api/activity rejects unauthenticated request with 401');

  // ---------------------------------------------------------------------------
  // 2. INACTIVE / NON-ADMIN USER (403) ACCESS TESTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Inactive Admin / Forbidden (403) Access ---');

  const reqDashboardForbidden = createMockRequest('http://localhost:3000/api/intelligence/dashboard', 'GET', inactiveAdminAuth);
  const resDashboardForbidden = await getDashboard(reqDashboardForbidden);
  assert(resDashboardForbidden.status === 403, 'GET /api/intelligence/dashboard returns 403 for inactive user');

  const reqActionsForbidden = createMockRequest('http://localhost:3000/api/intelligence/actions', 'GET', inactiveAdminAuth);
  const resActionsForbidden = await getActions(reqActionsForbidden);
  assert(resActionsForbidden.status === 403, 'GET /api/intelligence/actions returns 403 for inactive user');

  const reqEvaluateForbidden = createMockRequest('http://localhost:3000/api/intelligence/evaluate', 'POST', inactiveAdminAuth);
  const resEvaluateForbidden = await postEvaluate(reqEvaluateForbidden);
  assert(resEvaluateForbidden.status === 403, 'POST /api/intelligence/evaluate returns 403 for inactive user');

  const reqDismissForbidden = createMockRequest('http://localhost:3000/api/intelligence/alerts/alert-1/dismiss', 'POST', inactiveAdminAuth, { reason: 'testing' });
  const resDismissForbidden = await postDismiss(reqDismissForbidden, { params: { id: 'alert-1' } });
  assert(resDismissForbidden.status === 403, 'POST /api/intelligence/alerts/[id]/dismiss returns 403 for inactive user');

  // ---------------------------------------------------------------------------
  // 3. HARD DELETE BLOCKING ON REPOSITORIES
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Direct Database Deletion Security ---');

  let alertDeleteThrew = false;
  try {
    await DbRepository.deleteOperationalAlert('any-alert-id');
  } catch (err: any) {
    alertDeleteThrew = true;
    assert(err.message.includes('Hard delete dilarang'), 'DbRepository.deleteOperationalAlert strictly throws non-destructive error');
  }
  assert(alertDeleteThrew, 'OperationalAlert deletion prevented');

  let auditDeleteThrew = false;
  try {
    await DbRepository.deleteAuditLog('any-audit-id');
  } catch (err: any) {
    auditDeleteThrew = true;
    assert(err.message.includes('Hard delete dilarang'), 'DbRepository.deleteAuditLog strictly throws append-only error');
  }
  assert(auditDeleteThrew, 'AuditLog deletion prevented');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`STAGE 5 SECURITY TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage5SecuritySuite().catch(err => {
  console.error('Fatal error in security suite:', err);
  process.exit(1);
});
