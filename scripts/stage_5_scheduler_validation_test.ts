import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { POST as postEvaluate, GET as getEvaluate } from '../src/app/api/intelligence/evaluate/route';

async function runStage5SchedulerValidationSuite() {
  console.log('=== STARTING STAGE 5 SCHEDULER & CRON VALIDATION TEST SUITE ===\n');
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

  // Set environment CRON_SECRET for test suite
  process.env.CRON_SECRET = 'umroh-staging-cron-secret-2026';
  const cronSecret = process.env.CRON_SECRET;

  // ---------------------------------------------------------------------------
  // 1. VERIFY VERCEL CRON CONFIGURATION IN VERCEL.JSON
  // ---------------------------------------------------------------------------
  console.log('--- 1. Verifying Vercel Cron Configuration ---');
  const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
  assert(fs.existsSync(vercelJsonPath), 'vercel.json exists in project root');

  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  const cronList = vercelConfig.crons || [];
  const evalCron = cronList.find((c: any) => c.path === '/api/intelligence/evaluate');

  assert(!!evalCron, 'Vercel Cron includes schedule for /api/intelligence/evaluate');
  assert(evalCron?.schedule === '0 * * * *', 'Vercel Cron runs hourly (0 * * * *)');

  // ---------------------------------------------------------------------------
  // 2. TEST CRON SECRET AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing CRON_SECRET Authentication ---');

  // 2.1 Valid Bearer CRON_SECRET
  const reqValidCron = new NextRequest('http://localhost:3000/api/intelligence/evaluate', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${cronSecret}`,
    }
  });
  const resValidCron = await postEvaluate(reqValidCron);
  assert(resValidCron.status === 200, 'POST /api/intelligence/evaluate succeeds with valid CRON_SECRET (200)');
  const jsonValidCron = await resValidCron.json();
  assert(jsonValidCron.success === true, 'Response payload contains success: true');
  assert(jsonValidCron.source === 'CRON', 'Source correctly identifies as CRON');

  // 2.2 GET invocation with CRON_SECRET (Vercel Cron standard)
  const reqGetCron = new NextRequest('http://localhost:3000/api/intelligence/evaluate', {
    method: 'GET',
    headers: {
      'authorization': `Bearer ${cronSecret}`,
    }
  });
  const resGetCron = await getEvaluate(reqGetCron);
  assert(resGetCron.status === 200, 'GET /api/intelligence/evaluate succeeds with CRON_SECRET for Vercel Cron');

  // 2.3 Invalid CRON_SECRET
  const reqInvalidCron = new NextRequest('http://localhost:3000/api/intelligence/evaluate', {
    method: 'POST',
    headers: {
      'authorization': 'Bearer wrong_cron_secret_value_12345',
    }
  });
  const resInvalidCron = await postEvaluate(reqInvalidCron);
  assert(resInvalidCron.status === 401, 'POST /api/intelligence/evaluate rejects invalid CRON_SECRET with 401');

  // 2.4 Unauthenticated
  const reqMissingAuth = new NextRequest('http://localhost:3000/api/intelligence/evaluate', {
    method: 'POST',
    headers: {
      'authorization': 'Bearer unauthenticated',
    }
  });
  const resMissingAuth = await postEvaluate(reqMissingAuth);
  assert(resMissingAuth.status === 401, 'POST /api/intelligence/evaluate rejects missing auth with 401');

  // ---------------------------------------------------------------------------
  // 3. TEST ADMIN MANUAL TRIGGER AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Active Admin Manual Trigger ---');
  const reqAdminTrigger = new NextRequest('http://localhost:3000/api/intelligence/evaluate', {
    method: 'POST',
    headers: {
      'authorization': 'Bearer mock_active_admin_token',
    }
  });
  const resAdminTrigger = await postEvaluate(reqAdminTrigger);
  assert(resAdminTrigger.status === 200, 'POST /api/intelligence/evaluate succeeds with active admin session');
  const jsonAdminTrigger = await resAdminTrigger.json();
  assert(jsonAdminTrigger.source === 'ADMIN', 'Source correctly identifies as ADMIN');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`STAGE 5 SCHEDULER TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage5SchedulerValidationSuite().catch(err => {
  console.error('Fatal error in scheduler validation suite:', err);
  process.exit(1);
});
