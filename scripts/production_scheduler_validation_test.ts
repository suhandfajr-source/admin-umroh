import { DbRepository } from '../src/lib/repository/db';
import { ExportCleanupService } from '../src/lib/export/cleanup-service';
import { CleanupScheduler } from '../src/lib/export/cleanup-scheduler';
import { verifyCronOrAdminAuth } from '../src/lib/auth/guard';
import { GET as cleanupGetHandler, POST as cleanupPostHandler } from '../src/app/api/exports/cleanup/route';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runProductionSchedulerValidation() {
  console.log('\n========================================================================');
  console.log('🚀 EXECUTING PRODUCTION SCHEDULER & CLEANUP VALIDATION TESTS');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. PRODUCTION SCHEDULER CONFIGURATION VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('--- 1. PRODUCTION SCHEDULER CONFIGURATION ---');

  const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
  const vercelConfigExists = fs.existsSync(vercelJsonPath);
  assert(vercelConfigExists, '1.1: vercel.json exists in project root');

  if (vercelConfigExists) {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    const cronJob = vercelConfig.crons?.find((c: any) => c.path === '/api/exports/cleanup');
    assert(
      !!cronJob && (cronJob.schedule === '0 * * * *' || cronJob.schedule.includes('*')),
      `1.2: Vercel Cron configured for /api/exports/cleanup on schedule '${cronJob?.schedule}'`
    );
  }

  const supabaseCronMigrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260826000004_stage_3_cleanup_cron.sql'
  );
  assert(
    fs.existsSync(supabaseCronMigrationPath),
    '1.3: Supabase pg_cron persistent migration file exists'
  );

  // ---------------------------------------------------------------------------
  // 2. ENDPOINT AUTHENTICATION & ACCESS SECURITY
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. ENDPOINT AUTHENTICATION & ACCESS SECURITY ---');

  process.env.CRON_SECRET = 'super_secret_production_cron_key_9988';

  // 2.1 Unauthorized request with no token / no secret
  const unauthReq = new NextRequest('http://localhost:3000/api/exports/cleanup', {
    method: 'GET',
    headers: new Headers(),
  });
  const unauthRes = await cleanupGetHandler(unauthReq);
  assert(
    unauthRes.status === 401,
    `2.1: Unauthorized GET invocation denied with status ${unauthRes.status}`
  );

  // 2.2 Unauthorized request with wrong secret
  const wrongTokenReq = new NextRequest('http://localhost:3000/api/exports/cleanup', {
    method: 'POST',
    headers: new Headers({
      authorization: 'Bearer wrong_cron_secret_abc',
    }),
  });
  const wrongTokenRes = await cleanupPostHandler(wrongTokenReq);
  assert(
    wrongTokenRes.status === 401,
    `2.2: Wrong Bearer token invocation denied with status ${wrongTokenRes.status}`
  );

  // 2.3 Unauthorized request with inactive admin token
  const inactiveAdminReq = new NextRequest('http://localhost:3000/api/exports/cleanup', {
    method: 'POST',
    headers: new Headers({
      authorization: 'Bearer mock_inactive_token_999',
    }),
  });
  const inactiveAdminRes = await cleanupPostHandler(inactiveAdminReq);
  assert(
    inactiveAdminRes.status === 403,
    `2.3: Inactive admin invocation denied with status ${inactiveAdminRes.status}`
  );

  // 2.4 Authorized CRON_SECRET via Bearer token (Vercel Cron standard)
  const validCronReq = new NextRequest('http://localhost:3000/api/exports/cleanup', {
    method: 'GET',
    headers: new Headers({
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    }),
  });
  const validCronRes = await cleanupGetHandler(validCronReq);
  const cronResJson = await validCronRes.json();
  assert(
    validCronRes.status === 200 && cronResJson.success === true && cronResJson.trigger_source === 'CRON',
    '2.4: Valid CRON_SECRET successfully authorizes GET /api/exports/cleanup'
  );

  // ---------------------------------------------------------------------------
  // 3. PHYSICAL STORAGE & METADATA CLEANUP
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. EXPORT & STAGING STORAGE PHYSICAL CLEANUP ---');

  const mockStorage = new Set<string>([
    'exports/active_report.xlsx',
    'exports/expired_manifest_1.xlsx',
    'exports/expired_zip_2.zip',
    'staging/doc_rejected_old.pdf',
    'staging/doc_abandoned_48h.jpg',
    'jamaah/confirmed_passport.pdf',
  ]);

  const testJobs = [
    { id: 'exp_active', storage_path: 'exports/active_report.xlsx', expires_at: new Date(Date.now() + 86400000).toISOString(), status: 'COMPLETED' },
    { id: 'exp_expired_1', storage_path: 'exports/expired_manifest_1.xlsx', expires_at: new Date(Date.now() - 3600000).toISOString(), status: 'COMPLETED' },
    { id: 'exp_expired_2', storage_path: 'exports/expired_zip_2.zip', expires_at: new Date(Date.now() - 7200000).toISOString(), status: 'EXPIRED' },
  ];

  const testDocs = [
    // Stale rejected upload (> 24h old)
    { id: 'doc_rej', storage_path: 'staging/doc_rejected_old.pdf', uploaded_at: new Date(Date.now() - 90000000).toISOString(), status: 'REJECTED', jamaah_id: null },
    // Stale abandoned staging upload (> 24h old)
    { id: 'doc_abandon', storage_path: 'staging/doc_abandoned_48h.jpg', uploaded_at: new Date(Date.now() - 172800000).toISOString(), status: 'UPLOADED', jamaah_id: null },
    // Active Confirmed Document
    { id: 'doc_conf', storage_path: 'jamaah/confirmed_passport.pdf', uploaded_at: new Date(Date.now() - 200000000).toISOString(), status: 'CONFIRMED', confirmed_at: new Date().toISOString() },
  ];

  const cleanupRes = await ExportCleanupService.executePhysicalCleanup(testJobs, testDocs, mockStorage);

  assert(
    cleanupRes.report.expired_exports_count === 2,
    `3.1: Expired export metadata cleaned (Count = ${cleanupRes.report.expired_exports_count})`
  );
  assert(
    cleanupRes.report.expired_staging_files_count === 2,
    `3.2: Stale staging files cleaned (Count = ${cleanupRes.report.expired_staging_files_count})`
  );
  assert(
    !mockStorage.has('exports/expired_manifest_1.xlsx') && !mockStorage.has('exports/expired_zip_2.zip'),
    '3.3: Expired export physical files physically deleted from storage'
  );
  assert(
    !mockStorage.has('staging/doc_rejected_old.pdf') && !mockStorage.has('staging/doc_abandoned_48h.jpg'),
    '3.4: Stale staging physical files physically deleted from storage'
  );
  assert(
    mockStorage.has('jamaah/confirmed_passport.pdf') && mockStorage.has('exports/active_report.xlsx'),
    '3.5: Active master Jamaah document and non-expired export remain untouched'
  );

  // ---------------------------------------------------------------------------
  // 4. IDEMPOTENCY VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. CLEANUP IDEMPOTENCY ---');

  // Trigger cleanup a second time with remaining active jobs and docs
  const repeatRes = await ExportCleanupService.executePhysicalCleanup(
    cleanupRes.activeJobs,
    cleanupRes.remainingDocs,
    mockStorage
  );

  assert(
    repeatRes.report.expired_exports_count === 0 &&
    repeatRes.report.expired_staging_files_count === 0 &&
    repeatRes.report.deleted_storage_paths.length === 0,
    '4.1: Subsequent cleanup invocation is completely idempotent (0 files cleaned on 2nd run)'
  );

  // ---------------------------------------------------------------------------
  // 5. CONCURRENCY SAFETY VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. CONCURRENT CLEANUP EXECUTION SAFETY ---');

  // Trigger 5 concurrent cleanup requests simultaneously via API handler
  const concurrentPromises = Array.from({ length: 5 }, () => {
    const req = new NextRequest('http://localhost:3000/api/exports/cleanup', {
      method: 'POST',
      headers: new Headers({
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      }),
    });
    return cleanupPostHandler(req);
  });

  const concurrentResults = await Promise.all(concurrentPromises);
  const allSuccessful = concurrentResults.every(res => res.status === 200);

  assert(
    allSuccessful,
    '5.1: 5 concurrent cleanup requests resolved safely with HTTP 200 (no crashes or race corruption)'
  );

  // ---------------------------------------------------------------------------
  // 6. LOCAL DEV IN-PROCESS HELPER INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. LOCAL DEV CLEANUP SCHEDULER INTEGRITY ---');

  CleanupScheduler.stopSchedule();
  CleanupScheduler.startSchedule(1000000, false);
  const schedulerStatus = CleanupScheduler.getStatus();
  assert(
    schedulerStatus.active === true,
    '6.1: Local development CleanupScheduler in-process helper is operational for local simulation'
  );
  CleanupScheduler.stopSchedule();

  // Summary
  console.log('\n========================================================================');
  console.log(`📊 PRODUCTION SCHEDULER VALIDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionSchedulerValidation().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
