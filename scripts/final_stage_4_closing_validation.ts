import { DbRepository } from '../src/lib/repository/db';
import { EquipmentApplicability } from '../src/types/database.types';

async function runFinalStage4ClosingValidation() {
  console.log('========================================================================');
  console.log('🔬 EXECUTING FINAL STAGE 4 CLOSING VALIDATION (SCENARIOS Y, X, AB, SECURITY)');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${totalTests}: ${testName}`);
      if (detail) console.error(`         Detail: ${detail}`);
      throw new Error(`Assertion failed: ${testName} - ${detail || ''}`);
    }
  }

  // Reset store for fresh test isolation
  await DbRepository.resetStore();

  // =========================================================================
  // 1. PARTICIPANT CANCELLATION BEHAVIOR (SCENARIO Y)
  // =========================================================================
  console.log('--- 1. PARTICIPANT CANCELLATION BEHAVIOR (SCENARIO Y) ---');

  const pkgY = await DbRepository.createPackage({
    package_name: 'UMROH TEST CANCEL SCENARIO Y',
    departure_date: '2026-12-15',
    arrival_date: '2026-12-25',
    b2b_price: 28000000,
    reference_price: 30000000,
    target_capacity: 40,
  });

  const masterItems = await DbRepository.getEquipmentItems();
  const koperItem = masterItems.find(i => i.name.toLowerCase().includes('koper'))!;
  const batikItem = masterItems.find(i => i.name.toLowerCase().includes('batik'))!;
  const syalItem = await DbRepository.createEquipmentItem({
    name: 'Syal Tambahan Baru',
    category: 'ACCESSORY',
    requires_variant: false,
  });

  // Setup Package Equipment: Koper
  await DbRepository.setPackageEquipment(pkgY.id, [
    { equipment_item_id: koperItem.id, quantity_per_pax: 1, applicability: 'ALL', is_required: true },
  ]);

  // Create Active Participant Ahmad
  const jamaahAhmad = await DbRepository.createJamaah({
    passport_name: 'AHMAD AL-FASIH',
    gender: 'MALE',
    nik: '3201999988880001',
    passport_number: 'Y12345678',
  });

  const partAhmad = await DbRepository.addParticipant(
    pkgY.id,
    jamaahAhmad.id,
    undefined,
    28000000,
    30000000
  );

  // Participant Equipment fulfillment: Prepare & Handover
  const paxEquipListBefore = await DbRepository.getParticipantEquipmentList(pkgY.id);
  const ahmadKoper = paxEquipListBefore[0].items.find(i => i.equipment_item_id === koperItem.id)!;

  await DbRepository.prepareParticipantEquipment({ id: ahmadKoper.id, quantity: 1 });
  await DbRepository.handoverParticipantEquipment({ id: ahmadKoper.id, quantity: 1, notes: 'Penyerahan sebelum cancel' });

  const eventsBeforeCancel = await DbRepository.getParticipantEquipmentEvents(ahmadKoper.id);
  assert(eventsBeforeCancel.length >= 2, 'Ahmad has PREPARED and HANDOVER events before cancellation');

  // Now CANCEL Ahmad (Participant cancellation / deactivation)
  await DbRepository.updateParticipantStatus(partAhmad.id, 'CANCELLED');

  // 1. Historical fulfillment is PRESERVED in repository
  const peRecordAfter = await DbRepository.getParticipantEquipmentById(ahmadKoper.id);
  assert(!!peRecordAfter, 'Historical participant equipment record is PRESERVED in repository');
  assert(peRecordAfter!.quantity_expected === 1, 'Expected quantity 1 preserved');
  assert(peRecordAfter!.quantity_prepared === 1, 'Prepared quantity 1 preserved');
  assert(peRecordAfter!.quantity_handed_over === 1, 'Handed over quantity 1 preserved');

  // 2. Equipment Events PRESERVED
  const eventsAfterCancel = await DbRepository.getParticipantEquipmentEvents(ahmadKoper.id);
  assert(eventsAfterCancel.length === eventsBeforeCancel.length, 'Historical equipment audit events PRESERVED intact');

  // 3. Excluded from active KPI recap
  const recapY = await DbRepository.getPackageEquipmentRecap(pkgY.id);
  assert(recapY.total_active_participants === 0, 'Cancelled participant EXCLUDED from active package KPI total');
  assert(recapY.total_items_needed === 0, 'Total items needed in active recap excludes cancelled participant');

  // 4. Excluded from active Operations / Preparation / Handover Desk
  const deskListActive = await DbRepository.getParticipantEquipmentList(pkgY.id);
  assert(!deskListActive.some(p => p.participant_id === partAhmad.id), 'Cancelled participant EXCLUDED from active Desk list');

  // 5. Excluded from future synchronization & newly added items
  // Add new package equipment: Syal
  await DbRepository.addPackageEquipmentItem(pkgY.id, {
    equipment_item_id: syalItem.id,
    quantity_per_pax: 1,
    applicability: 'ALL',
  });
  await DbRepository.syncPackageParticipantEquipment(pkgY.id);

  // Verify cancelled participant did NOT receive the newly added Syal
  const ahmadAllEquip = await DbRepository.getParticipantEquipmentByParticipant(partAhmad.id);
  assert(!ahmadAllEquip.some(pe => {
    const pkgItem = globalStore.package_equipment_items.find(pi => pi.id === pe.package_equipment_item_id);
    return pkgItem?.equipment_item_id === syalItem.id;
  }), 'Cancelled participant did NOT receive newly added Package Equipment after cancellation');

  // =========================================================================
  // 2. PACKAGE EQUIPMENT QUANTITY RECONCILIATION (SCENARIO X)
  // =========================================================================
  console.log('\n--- 2. PACKAGE EQUIPMENT QUANTITY RECONCILIATION (SCENARIO X) ---');

  const pkgX = await DbRepository.createPackage({
    package_name: 'UMROH RECONCILIATION SCENARIO X',
    departure_date: '2027-01-20',
    arrival_date: '2027-01-30',
    b2b_price: 32000000,
    reference_price: 35000000,
    target_capacity: 40,
  });

  // Setup initial package equipment: quantity_per_pax = 1
  const pkgXItems = await DbRepository.setPackageEquipment(pkgX.id, [
    { equipment_item_id: koperItem.id, quantity_per_pax: 1, applicability: 'ALL' },
  ]);
  const pkgXKoper = pkgXItems[0];

  const jamaahBudi = await DbRepository.createJamaah({
    passport_name: 'BUDI SANTOSO',
    gender: 'MALE',
    nik: '3201999988880002',
    passport_number: 'X98765432',
  });

  const partBudi = await DbRepository.addParticipant(
    pkgX.id,
    jamaahBudi.id,
    undefined,
    32000000,
    35000000
  );

  const budiEquipBefore = await DbRepository.getParticipantEquipmentList(pkgX.id);
  const budiKoper = budiEquipBefore[0].items[0];

  // Prepare 1, Handover 1
  await DbRepository.prepareParticipantEquipment({ id: budiKoper.id, quantity: 1 });
  await DbRepository.handoverParticipantEquipment({ id: budiKoper.id, quantity: 1, notes: 'Penyerahan koper ke-1' });

  const budiKoperBeforeRecon = await DbRepository.getParticipantEquipmentById(budiKoper.id);
  assert(budiKoperBeforeRecon!.quantity_expected === 1, 'Initial expected = 1');
  assert(budiKoperBeforeRecon!.quantity_prepared === 1, 'Initial prepared = 1');
  assert(budiKoperBeforeRecon!.quantity_handed_over === 1, 'Initial handed_over = 1');
  assert(budiKoperBeforeRecon!.status === 'SUDAH_DISERAHKAN', 'Initial status = SUDAH_DISERAHKAN');

  // Change package equipment: quantity_per_pax from 1 to 2
  await DbRepository.updatePackageEquipmentItem(pkgXKoper.id, { quantity_per_pax: 2 });

  const budiKoperAfterRecon = await DbRepository.getParticipantEquipmentById(budiKoper.id);
  assert(budiKoperAfterRecon!.quantity_expected === 2, 'quantity_expected safely updated to 2');
  assert(budiKoperAfterRecon!.quantity_prepared === 1, 'quantity_prepared 1 preserved without deletion');
  assert(budiKoperAfterRecon!.quantity_handed_over === 1, 'quantity_handed_over 1 preserved without deletion');
  assert(budiKoperAfterRecon!.status === 'SEBAGIAN_DISERAHKAN', 'Derived status safely becomes partial (SEBAGIAN_DISERAHKAN)');

  // Run synchronization explicitly (Idempotency check)
  const syncXResult = await DbRepository.syncPackageParticipantEquipment(pkgX.id);
  assert(syncXResult.created_count === 0 && syncXResult.updated_count === 0, 'Subsequent sync run is strictly idempotent (0 changes)');

  const budiKoperAfterRecon2 = await DbRepository.getParticipantEquipmentById(budiKoper.id);
  assert(budiKoperAfterRecon2!.quantity_expected === 2, 'Expected remains 2');
  assert(budiKoperAfterRecon2!.quantity_prepared === 1, 'Prepared remains 1');
  assert(budiKoperAfterRecon2!.quantity_handed_over === 1, 'Handed over remains 1');

  // =========================================================================
  // 3. HISTORICAL PACKAGE ITEM REMOVAL (SCENARIO AB)
  // =========================================================================
  console.log('\n--- 3. HISTORICAL PACKAGE ITEM REMOVAL (SCENARIO AB) ---');

  const pkgAB = await DbRepository.createPackage({
    package_name: 'UMROH REMOVAL SCENARIO AB',
    departure_date: '2027-02-10',
    arrival_date: '2027-02-20',
    b2b_price: 31000000,
    reference_price: 33000000,
    target_capacity: 35,
  });

  // Setup Package Equipment: Batik and Koper
  const pkgABItems = await DbRepository.setPackageEquipment(pkgAB.id, [
    { equipment_item_id: batikItem.id, quantity_per_pax: 1, applicability: 'ALL' },
    { equipment_item_id: koperItem.id, quantity_per_pax: 1, applicability: 'ALL' },
  ]);

  const jamaahHasan = await DbRepository.createJamaah({
    passport_name: 'HASANUDDIN ALI',
    gender: 'MALE',
    nik: '3201999988880003',
  });

  const partHasan = await DbRepository.addParticipant(
    pkgAB.id,
    jamaahHasan.id,
    undefined,
    31000000,
    33000000
  );

  const hasanListBefore = await DbRepository.getParticipantEquipmentList(pkgAB.id);
  const hasanBatik = hasanListBefore[0].items.find(i => i.equipment_item_id === batikItem.id)!;

  // Set variant, prepare, and handover Batik
  const xlVar = batikItem.variants!.find(v => v.label === 'XL')!;
  await DbRepository.updateParticipantEquipmentVariant(hasanBatik.id, xlVar.id, 'admin-1');
  await DbRepository.prepareParticipantEquipment({ id: hasanBatik.id, quantity: 1 });
  await DbRepository.handoverParticipantEquipment({ id: hasanBatik.id, quantity: 1, notes: 'Serah terima batik' });

  const eventsABBefore = await DbRepository.getParticipantEquipmentEvents(hasanBatik.id);
  assert(eventsABBefore.length >= 3, 'Hasan has VARIANT_CHANGED, PREPARED, and HANDOVER events');

  // Now REMOVE Baju Batik from Package Equipment configuration (only keep Koper)
  await DbRepository.setPackageEquipment(pkgAB.id, [
    { equipment_item_id: koperItem.id, quantity_per_pax: 1, applicability: 'ALL' },
  ]);

  // 1. Package Equipment is ARCHIVED (not hard-deleted)
  const allPkgItemsAB = globalStore.package_equipment_items.filter(pi => pi.package_id === pkgAB.id);
  const archivedPkgBatik = allPkgItemsAB.find(pi => pi.equipment_item_id === batikItem.id)!;
  assert(!!archivedPkgBatik.archived_at, 'Package Equipment Baju Batik is ARCHIVED');

  // 2. Historical Participant Equipment is PRESERVED
  const hasanBatikAfter = await DbRepository.getParticipantEquipmentById(hasanBatik.id);
  assert(!!hasanBatikAfter, 'Historical Participant Equipment for Batik is PRESERVED');
  assert(hasanBatikAfter!.quantity_handed_over === 1, 'Handed over quantity 1 preserved');

  // 3. Historical Events PRESERVED
  const eventsABAfter = await DbRepository.getParticipantEquipmentEvents(hasanBatik.id);
  assert(eventsABAfter.length === eventsABBefore.length, 'Historical events PRESERVED in audit log');

  // 4. Removed from active Package Recap & Active Desk
  const recapAB = await DbRepository.getPackageEquipmentRecap(pkgAB.id);
  assert(!recapAB.item_summaries.some(i => i.equipment_item_id === batikItem.id), 'Archived item REMOVED from active Package Recap');

  // =========================================================================
  // 4. DIRECT HARD DELETE PROTECTION
  // =========================================================================
  console.log('\n--- 4. DIRECT HARD DELETE PROTECTION ---');

  // Authenticated Admin attempt to hard-delete participant_equipment with history
  let caughtPEHardDelete = false;
  try {
    await DbRepository.deleteParticipantEquipment(hasanBatik.id);
  } catch (err: any) {
    caughtPEHardDelete = true;
    assert(err.message.includes('Hard delete dilarang'), 'Direct DELETE on participant_equipment with history is DENIED');
  }
  assert(caughtPEHardDelete, 'Enforced hard delete block on participant_equipment');

  // Authenticated Admin attempt to hard-delete Master Item with history
  let caughtMasterHardDelete = false;
  try {
    await DbRepository.deleteEquipmentItem(batikItem.id);
  } catch (err: any) {
    caughtMasterHardDelete = true;
    assert(err.message.includes('Hard delete dilarang'), 'Direct DELETE on Master Equipment with fulfillment history is DENIED');
  }
  assert(caughtMasterHardDelete, 'Enforced hard delete block on master equipment');

  console.log('\n========================================================================');
  console.log(`  ALL ${passedTests} / ${totalTests} CLOSING VALIDATION TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');
}

// Global store accessor helper for validation script
const globalStore = (DbRepository as any).getStoreState ? (DbRepository as any).getStoreState() : (global as any).__DB_STORE__;

runFinalStage4ClosingValidation().catch(err => {
  console.error('\n❌ CLOSING VALIDATION FAILED:', err);
  process.exit(1);
});
