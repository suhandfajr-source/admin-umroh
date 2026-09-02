import { NextRequest } from 'next/server';
import { GET as getMasterRoute, POST as postMasterRoute } from '../src/app/api/equipment/master/route';
import { GET as getRecapRoute } from '../src/app/api/equipment/packages/[id]/recap/route';
import { POST as postPrepareRoute } from '../src/app/api/equipment/packages/[id]/prepare/route';
import { POST as postHandoverRoute } from '../src/app/api/equipment/packages/[id]/handover/route';
import { POST as postCorrectRoute } from '../src/app/api/equipment/packages/[id]/correct/route';
import { GET as getReportExportRoute } from '../src/app/api/equipment/export/report/[id]/route';
import { GET as getChecklistExportRoute } from '../src/app/api/equipment/export/checklist/[id]/route';
import { GET as getJamaahHistoryRoute } from '../src/app/api/equipment/jamaah/[id]/route';
import { DbRepository } from '../src/lib/repository/db';

async function runStage4SecurityTests() {
  console.log('================================================================');
  console.log('         STAGE 4: PERLENGKAPAN SECURITY & ACCESS TESTS          ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Security Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Security Test ${totalTests}: ${testName}`);
      if (detail) console.error(`         Detail: ${detail}`);
      throw new Error(`Assertion failed: ${testName} - ${detail || ''}`);
    }
  }

  // Helper to create mock NextRequest
  function createMockRequest(url: string, method: string = 'GET', authHeader?: string, body?: any): NextRequest {
    const headers: Record<string, string> = {};
    if (authHeader) headers['authorization'] = authHeader;
    if (body) headers['content-type'] = 'application/json';

    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // Active Admin Auth Header
  const activeAdminAuth = 'Bearer mock_active_admin_token';

  // Inactive Admin Auth Header
  const inactiveAdminAuth = 'Bearer mock_inactive_token';

  // Unauthenticated Header
  const unauthHeader = 'Bearer unauthenticated';

  const packages = await DbRepository.getPackageList();
  const pkgId = packages[0]?.id || 'mock-pkg-id';

  // 1. Unauthenticated requests must be rejected (401)
  console.log('--- 1. UNAUTHENTICATED ACCESS PROTECTION (401) ---');

  const unauthMasterReq = createMockRequest('http://localhost:3000/api/equipment/master', 'GET', unauthHeader);
  const res1 = await getMasterRoute(unauthMasterReq);
  assert(res1.status === 401, 'Unauthenticated GET /api/equipment/master returns 401');

  const unauthRecapReq = createMockRequest(`http://localhost:3000/api/equipment/packages/${pkgId}/recap`, 'GET', unauthHeader);
  const res2 = await getRecapRoute(unauthRecapReq, { params: { id: pkgId } });
  assert(res2.status === 401, 'Unauthenticated GET /api/equipment/packages/:id/recap returns 401');

  const unauthPrepareReq = createMockRequest(`http://localhost:3000/api/equipment/packages/${pkgId}/prepare`, 'POST', unauthHeader, {});
  const res3 = await postPrepareRoute(unauthPrepareReq, { params: { id: pkgId } });
  assert(res3.status === 401, 'Unauthenticated POST /api/equipment/packages/:id/prepare returns 401');

  const unauthExportReq = createMockRequest(`http://localhost:3000/api/equipment/export/report/${pkgId}`, 'GET', unauthHeader);
  const res4 = await getReportExportRoute(unauthExportReq, { params: { id: pkgId } });
  assert(res4.status === 401, 'Unauthenticated GET /api/equipment/export/report/:id returns 401');

  // 2. Inactive admin must be rejected (403)
  console.log('\n--- 2. INACTIVE ADMIN PROTECTION (403) ---');

  const inactiveMasterReq = createMockRequest('http://localhost:3000/api/equipment/master', 'GET', inactiveAdminAuth);
  const res5 = await getMasterRoute(inactiveMasterReq);
  assert(res5.status === 403, 'Inactive admin GET /api/equipment/master returns 403 Forbidden');

  const inactiveHandoverReq = createMockRequest(`http://localhost:3000/api/equipment/packages/${pkgId}/handover`, 'POST', inactiveAdminAuth, {});
  const res6 = await postHandoverRoute(inactiveHandoverReq, { params: { id: pkgId } });
  assert(res6.status === 403, 'Inactive admin POST /api/equipment/packages/:id/handover returns 403 Forbidden');

  const inactiveCorrectReq = createMockRequest(`http://localhost:3000/api/equipment/packages/${pkgId}/correct`, 'POST', inactiveAdminAuth, {});
  const res7 = await postCorrectRoute(inactiveCorrectReq, { params: { id: pkgId } });
  assert(res7.status === 403, 'Inactive admin POST /api/equipment/packages/:id/correct returns 403 Forbidden');

  // 3. Active admin authorized access (200)
  console.log('\n--- 3. ACTIVE ADMIN AUTHORIZED ACCESS (200) ---');

  const activeMasterReq = createMockRequest('http://localhost:3000/api/equipment/master', 'GET', activeAdminAuth);
  const res8 = await getMasterRoute(activeMasterReq);
  assert(res8.status === 200, 'Active admin GET /api/equipment/master returns 200 OK');

  const activeRecapReq = createMockRequest(`http://localhost:3000/api/equipment/packages/${pkgId}/recap`, 'GET', activeAdminAuth);
  const res9 = await getRecapRoute(activeRecapReq, { params: { id: pkgId } });
  assert(res9.status === 200, 'Active admin GET /api/equipment/packages/:id/recap returns 200 OK');

  const activeChecklistReq = createMockRequest(`http://localhost:3000/api/equipment/export/checklist/${pkgId}`, 'GET', activeAdminAuth);
  const res10 = await getChecklistExportRoute(activeChecklistReq, { params: { id: pkgId } });
  assert(res10.status === 200, 'Active admin GET /api/equipment/export/checklist/:id returns 200 OK');

  // 4. Hard delete security protection
  console.log('\n--- 4. HARD DELETE DATABASE & REPOSITORY PROTECTION ---');

  const masterList = await DbRepository.getEquipmentItems();
  const testMasterItem = masterList[0];

  const testPkg = await DbRepository.createPackage({
    package_name: 'TEST SECURITY PKG',
    departure_date: '2026-12-01',
    arrival_date: '2026-12-10',
    b2b_price: 30000000,
    reference_price: 32000000,
    target_capacity: 45,
  });

  await DbRepository.setPackageEquipment(testPkg.id, [
    { equipment_item_id: testMasterItem.id, quantity_per_pax: 1 },
  ]);

  const testJamaah = await DbRepository.createJamaah({
    passport_name: 'TEST SECURITY USER',
    gender: 'MALE',
    nik: '3201010101019999',
  });

  const testParticipant = await DbRepository.addParticipant(
    testPkg.id,
    testJamaah.id,
    undefined,
    30000000,
    32000000
  );

  const paxEquipList = await DbRepository.getParticipantEquipmentList(testPkg.id);
  const targetPE = paxEquipList[0].items[0];

  // Prepare equipment to establish fulfillment history
  await DbRepository.prepareParticipantEquipment({ id: targetPE.id, quantity: 1 });

  let caughtItemHardDelete = false;
  try {
    await DbRepository.deleteEquipmentItem(testMasterItem.id);
  } catch (err: any) {
    caughtItemHardDelete = true;
    assert(err.message.includes('Hard delete dilarang'), 'Master item hard delete blocked');
  }
  assert(caughtItemHardDelete, 'Master item hard delete protection enforced');

  let caughtParticipantHardDelete = false;
  try {
    await DbRepository.deleteParticipantEquipment(targetPE.id);
  } catch (err: any) {
    caughtParticipantHardDelete = true;
    assert(err.message.includes('Hard delete dilarang'), 'Participant equipment hard delete blocked');
  }
  assert(caughtParticipantHardDelete, 'Participant equipment hard delete protection enforced');

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests} / ${totalTests} SECURITY TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runStage4SecurityTests().catch(err => {
  console.error('\n❌ SECURITY TEST FAILED:', err);
  process.exit(1);
});
