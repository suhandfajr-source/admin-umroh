import { DbRepository } from '../src/lib/repository/db';
import { EquipmentExportService } from '../src/lib/export/equipment-export';
import ExcelJS from 'exceljs';

async function runStage4AcceptanceTests() {
  console.log('================================================================');
  console.log('       STAGE 4: PERLENGKAPAN JAMAAH ACCEPTANCE TEST SUITE       ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`         Detail: ${detail}`);
      throw new Error(`Assertion failed: ${testName} - ${detail || ''}`);
    }
  }

  // Reset repository state
  await DbRepository.resetStore();
  console.log('>> State reset complete.\n');

  // =========================================================================
  // 1. MASTER EQUIPMENT & VARIANTS
  // =========================================================================
  console.log('--- 1. MASTER EQUIPMENT & VARIANTS ---');

  const masterItems = await DbRepository.getEquipmentItems();
  assert(masterItems.length >= 6, 'Default starter equipment items exist', `Count: ${masterItems.length}`);

  const koperItem = masterItems.find(i => i.name.toLowerCase().includes('koper'))!;
  assert(!!koperItem, 'Koper Bagasi item exists in master');

  const batikItem = masterItems.find(i => i.name.toLowerCase().includes('batik'))!;
  assert(!!batikItem && batikItem.requires_variant, 'Batik item exists and requires variant');
  assert(batikItem.variants && batikItem.variants.length >= 5, 'Batik variants include standard sizes (S, M, L, XL, XXL)');

  // Create custom master item
  const customItem = await DbRepository.createEquipmentItem({
    name: 'Syal Eksklusif Travel',
    category: 'ACCESSORY',
    requires_variant: false,
  });
  assert(!!customItem.id, 'Custom master item created successfully');

  // Variant referential check
  const invalidVariantCheck = await DbRepository.getEquipmentVariants(customItem.id);
  assert(invalidVariantCheck.length === 0, 'New custom item starts with 0 variants');

  // =========================================================================
  // 2. PACKAGE EQUIPMENT SETUP
  // =========================================================================
  console.log('\n--- 2. PACKAGE EQUIPMENT SETUP ---');

  const pkg1 = await DbRepository.createPackage({
    package_name: 'UMROH REGULER AWAL TAHUN 2026',
    departure_date: '2026-11-20',
    arrival_date: '2026-11-30',
    b2b_price: 30000000,
    reference_price: 32000000,
    target_capacity: 45,
  });
  assert(!!pkg1, 'Test Package 1 available');

  // Configure package equipment for pkg1
  const pkgEquipItems = await DbRepository.setPackageEquipment(pkg1.id, [
    {
      equipment_item_id: koperItem.id,
      quantity_per_pax: 1,
      applicability: 'ALL',
      is_required: true,
    },
    {
      equipment_item_id: batikItem.id,
      quantity_per_pax: 1,
      applicability: 'ALL',
      is_required: true,
    },
    {
      equipment_item_id: masterItems.find(i => i.name.toLowerCase().includes('ihram'))!.id,
      quantity_per_pax: 1,
      applicability: 'MALE',
      is_required: true,
    },
    {
      equipment_item_id: masterItems.find(i => i.name.toLowerCase().includes('mukena'))!.id,
      quantity_per_pax: 1,
      applicability: 'FEMALE',
      is_required: true,
    },
  ]);
  assert(pkgEquipItems.length === 4, 'Package 1 configured with 4 equipment rules');

  // =========================================================================
  // 3. IDEMPOTENT SYNC & GENDER APPLICABILITY
  // =========================================================================
  console.log('\n--- 3. IDEMPOTENT SYNC & GENDER APPLICABILITY ---');

  // Create test participants: Male, Female, and Unknown Gender
  const jamaahMale = await DbRepository.createJamaah({
    passport_name: 'AHMAD SUBARJO',
    gender: 'MALE',
    nik: '3201010101010001',
    passport_number: 'A11223344',
  });
  const partMale = await DbRepository.addParticipant(
    pkg1.id,
    jamaahMale.id,
    undefined,
    30000000,
    32000000
  );

  const jamaahFemale = await DbRepository.createJamaah({
    passport_name: 'SITI NURHALIZA',
    gender: 'FEMALE',
    nik: '3201010101010002',
    passport_number: 'B22334455',
  });
  const partFemale = await DbRepository.addParticipant(
    pkg1.id,
    jamaahFemale.id,
    undefined,
    30000000,
    32000000
  );

  const jamaahUnknown = await DbRepository.createJamaah({
    passport_name: 'NURUL HIDAYAH',
    gender: null, // Unknown Gender
    nik: '3201010101010003',
  });
  const partUnknown = await DbRepository.addParticipant(
    pkg1.id,
    jamaahUnknown.id,
    undefined,
    30000000,
    32000000
  );

  // Verify participant equipment automatically synced
  const listPax = await DbRepository.getParticipantEquipmentList(pkg1.id);
  const rowMale = listPax.find(p => p.participant_id === partMale.id)!;
  const rowFemale = listPax.find(p => p.participant_id === partFemale.id)!;
  const rowUnknown = listPax.find(p => p.participant_id === partUnknown.id)!;

  assert(rowMale.items.length === 3, 'Male participant receives 3 items (Koper, Batik, Ihram)');
  assert(rowMale.items.some(i => i.item_name.includes('Ihram')), 'Male participant has Ihram');
  assert(!rowMale.items.some(i => i.item_name.includes('Mukena')), 'Male participant does NOT have Mukena');

  assert(rowFemale.items.length === 3, 'Female participant receives 3 items (Koper, Batik, Mukena)');
  assert(rowFemale.items.some(i => i.item_name.includes('Mukena')), 'Female participant has Mukena');
  assert(!rowFemale.items.some(i => i.item_name.includes('Ihram')), 'Female participant does NOT have Ihram');

  assert(rowUnknown.items.length === 2, 'Unknown gender receives only ALL items (Koper, Batik)');
  assert(rowUnknown.has_gender_warning === true, 'Unknown gender triggers has_gender_warning');
  assert(rowUnknown.overall_status === 'NEEDS_REVIEW', 'Unknown gender overall status is NEEDS_REVIEW');

  // Test updating unknown gender to FEMALE & Resyncing
  await DbRepository.updateJamaah(jamaahUnknown.id, { gender: 'FEMALE' });
  const syncResult = await DbRepository.syncPackageParticipantEquipment(pkg1.id);
  assert(syncResult.created_count === 1, 'Sync creates 1 missing Mukena requirement after gender update');

  const listPaxAfterUpdate = await DbRepository.getParticipantEquipmentList(pkg1.id);
  const rowUpdated = listPaxAfterUpdate.find(p => p.participant_id === partUnknown.id)!;
  assert(rowUpdated.items.length === 3, 'Updated participant now has 3 items');
  assert(rowUpdated.items.some(i => i.item_name.includes('Mukena')), 'Updated participant now has Mukena');
  assert(!rowUpdated.has_gender_warning, 'has_gender_warning cleared after gender resolution');

  // =========================================================================
  // 4. REQUIRED VARIANT ENFORCEMENT & REFERENTIAL CHECK
  // =========================================================================
  console.log('\n--- 4. REQUIRED VARIANT ENFORCEMENT & REFERENTIAL CHECK ---');

  const maleBatik = rowMale.items.find(i => i.item_name.includes('Batik'))!;
  assert(maleBatik.requires_variant === true, 'Batik requires variant');
  assert(maleBatik.variant_id === null, 'Batik variant starts as null');

  // Attempting to prepare without selecting variant must throw error
  let caughtVariantError = false;
  try {
    await DbRepository.prepareParticipantEquipment({
      id: maleBatik.id,
      quantity: 1,
      adminId: 'admin-1',
    });
  } catch (err: any) {
    caughtVariantError = true;
    assert(err.message.includes('NEEDS_VARIANT') || err.message.includes('varian'), 'Preparation blocked when variant is missing');
  }
  assert(caughtVariantError, 'Caught missing variant preparation exception');

  // Set variant for Batik
  const xlVariant = batikItem.variants!.find(v => v.label === 'XL')!;
  const updatedBatik = await DbRepository.updateParticipantEquipmentVariant(maleBatik.id, xlVariant.id, 'admin-1');
  assert(updatedBatik.variant_id === xlVariant.id, 'Variant set to XL');
  assert(updatedBatik.variant_label_snapshot === 'XL', 'Variant label snapshot saved as XL');

  // Foreign variant mismatch test
  let caughtForeignVariant = false;
  try {
    await DbRepository.updateParticipantEquipmentVariant(maleBatik.id, 'foreign-variant-id', 'admin-1');
  } catch (err: any) {
    caughtForeignVariant = true;
  }
  assert(caughtForeignVariant, 'Foreign/non-existent variant assignment is rejected');

  // =========================================================================
  // 5. PREPARATION & HANDOVER LIFECYCLE
  // =========================================================================
  console.log('\n--- 5. PREPARATION & HANDOVER LIFECYCLE ---');

  // Prepare Batik now that variant is set
  const preparedBatik = await DbRepository.prepareParticipantEquipment({
    id: maleBatik.id,
    quantity: 1,
    adminId: 'admin-1',
  });
  assert(preparedBatik.quantity_prepared === 1, 'Batik prepared quantity = 1');
  assert(preparedBatik.status === 'SIAP', 'Batik status is SIAP');

  // Handover Batik
  const handedOverBatik = await DbRepository.handoverParticipantEquipment({
    id: maleBatik.id,
    quantity: 1,
    adminId: 'admin-1',
    notes: 'Diserahkan langsung saat manasik',
  });
  assert(handedOverBatik.quantity_handed_over === 1, 'Batik handed over quantity = 1');
  assert(handedOverBatik.status === 'SUDAH_DISERAHKAN', 'Batik status is SUDAH_DISERAHKAN');

  // Handover cannot exceed prepared
  const maleKoper = rowMale.items.find(i => i.item_name.includes('Koper'))!;
  let caughtExceedHandover = false;
  try {
    await DbRepository.handoverParticipantEquipment({
      id: maleKoper.id,
      quantity: 1, // Prepared is currently 0
      adminId: 'admin-1',
    });
  } catch (err: any) {
    caughtExceedHandover = true;
    assert(err.message.includes('melebihi jumlah yang sudah disiapkan') || err.message.includes('belum disiapkan'), 'Handover cannot exceed prepared');
  }
  assert(caughtExceedHandover, 'Handover exceeding prepared rejected');

  // =========================================================================
  // 6. BULK OPERATIONS & ATOMIC ROLLBACK
  // =========================================================================
  console.log('\n--- 6. BULK OPERATIONS & ATOMIC ROLLBACK ---');

  // Female Batik has no variant yet. Bulk prepare across package should fail atomically
  let caughtBulkFail = false;
  try {
    await DbRepository.bulkPrepareEquipment({
      package_id: pkg1.id,
      adminId: 'admin-1',
    });
  } catch (err: any) {
    caughtBulkFail = true;
    assert(err.message.includes('NEEDS_VARIANT') || err.message.includes('varian'), 'Bulk prepare fails if any participant lacks variant');
  }
  assert(caughtBulkFail, 'Atomic bulk rollback triggered on validation failure');

  // Assign variant for female Batik
  const femaleBatik = rowFemale.items.find(i => i.item_name.includes('Batik'))!;
  const lVariant = batikItem.variants!.find(v => v.label === 'L')!;
  await DbRepository.updateParticipantEquipmentVariant(femaleBatik.id, lVariant.id, 'admin-1');

  // Assign variant for updated unknown Batik
  const updatedUnknownBatik = rowUpdated.items.find(i => i.item_name.includes('Batik'))!;
  const mVariant = batikItem.variants!.find(v => v.label === 'M')!;
  await DbRepository.updateParticipantEquipmentVariant(updatedUnknownBatik.id, mVariant.id, 'admin-1');

  // Now bulk prepare all items in package
  const bulkPrepRes = await DbRepository.bulkPrepareEquipment({
    package_id: pkg1.id,
    adminId: 'admin-1',
  });
  assert(bulkPrepRes.updated_count > 0, 'Bulk prepare succeeded for all eligible items');

  // Bulk handover all items in package
  const bulkHandoverRes = await DbRepository.bulkHandoverEquipment({
    package_id: pkg1.id,
    adminId: 'admin-1',
    notes: 'Bulk serah terima perlengkapan manasik',
  });
  assert(bulkHandoverRes.updated_count > 0, 'Bulk handover succeeded');

  // =========================================================================
  // 7. CONTROLLED CORRECTION WORKFLOW & AUDIT TRAIL
  // =========================================================================
  console.log('\n--- 7. CONTROLLED CORRECTION WORKFLOW & AUDIT TRAIL ---');

  // Attempt correction without reason must fail
  let caughtCorrectionNoReason = false;
  try {
    await DbRepository.correctParticipantEquipment({
      id: maleBatik.id,
      target_prepared: 1,
      target_handed_over: 0,
      reason: '', // Empty reason
      adminId: 'admin-1',
    });
  } catch (err: any) {
    caughtCorrectionNoReason = true;
    assert(err.message.includes('Alasan koreksi wajib diisi'), 'Correction without reason is blocked');
  }
  assert(caughtCorrectionNoReason, 'Caught empty reason error');

  // Valid correction with audit reason
  const corrected = await DbRepository.correctParticipantEquipment({
    id: maleBatik.id,
    target_prepared: 1,
    target_handed_over: 0,
    reason: 'Salah klik serah terima saat manasik belum hadir',
    adminId: 'admin-1',
  });
  assert(corrected.quantity_handed_over === 0, 'Handed over reset to 0');
  assert(corrected.status === 'SIAP', 'Status changed back to SIAP');

  // Verify event log exists
  const events = await DbRepository.getParticipantEquipmentEvents(maleBatik.id);
  const corrEvent = events.find(e => e.event_type === 'CORRECTION');
  assert(!!corrEvent, 'CORRECTION event logged');
  assert(corrEvent?.reason === 'Salah klik serah terima saat manasik belum hadir', 'Audit reason preserved in event');

  // Re-handover for full status test
  await DbRepository.handoverParticipantEquipment({
    id: maleBatik.id,
    quantity: 1,
    adminId: 'admin-1',
  });

  // =========================================================================
  // 8. SAFE RECONCILIATION & ARCHIVAL
  // =========================================================================
  console.log('\n--- 8. SAFE RECONCILIATION & ARCHIVAL ---');

  // Update package equipment rule: Koper from 1 to 2
  const pkgKoperItem = pkgEquipItems.find(i => i.equipment_item_id === koperItem.id)!;
  await DbRepository.updatePackageEquipmentItem(pkgKoperItem.id, { quantity_per_pax: 2 });

  // Resync package
  await DbRepository.syncPackageParticipantEquipment(pkg1.id);

  // Check male koper expected vs handed over
  const maleKoperUpdated = await DbRepository.getParticipantEquipmentById(maleKoper.id);
  assert(maleKoperUpdated!.quantity_expected === 2, 'Koper expected quantity safely increased to 2');
  assert(maleKoperUpdated!.quantity_handed_over === 1, 'Historical handed over quantity 1 preserved');
  assert(maleKoperUpdated!.status === 'SEBAGIAN_DISERAHKAN', 'Status accurately calculated as SEBAGIAN_DISERAHKAN');

  // Hard delete protection on participant equipment
  let caughtHardDelete = false;
  try {
    await DbRepository.deleteParticipantEquipment(maleKoper.id);
  } catch (err: any) {
    caughtHardDelete = true;
    assert(err.message.includes('Hard delete dilarang'), 'Hard delete participant equipment is blocked');
  }
  assert(caughtHardDelete, 'Hard delete protection enforced');

  // =========================================================================
  // 9. MULTI-TRIP SEPARATE FULFILLMENT PER JAMAAH
  // =========================================================================
  console.log('\n--- 9. MULTI-TRIP SEPARATE FULFILLMENT PER JAMAAH ---');

  // Create Package 2
  const pkg2 = await DbRepository.createPackage({
    package_name: 'UMROH RAMADHAN 2027',
    departure_date: '2027-03-15',
    arrival_date: '2027-03-25',
    b2b_price: 35000000,
    reference_price: 38000000,
    target_capacity: 45,
  });

  // Configure package equipment for pkg2
  await DbRepository.setPackageEquipment(pkg2.id, [
    {
      equipment_item_id: koperItem.id,
      quantity_per_pax: 1,
      applicability: 'ALL',
    },
  ]);

  // Add same jamaahMale to Package 2
  const partMaleTrip2 = await DbRepository.addParticipant(
    pkg2.id,
    jamaahMale.id,
    undefined,
    35000000,
    38000000
  );

  // Get multi-trip equipment history for jamaahMale
  const jamaahHistory = await DbRepository.getJamaahEquipmentHistory(jamaahMale.id);
  assert(jamaahHistory.length === 2, 'Jamaah has 2 distinct trip equipment histories');
  assert(jamaahHistory[0].package_id === pkg1.id, 'Trip 1 equipment tracked');
  assert(jamaahHistory[1].package_id === pkg2.id, 'Trip 2 equipment tracked separately');

  // =========================================================================
  // 10. RECAP & SIZING BREAKDOWN MATRIX
  // =========================================================================
  console.log('\n--- 10. RECAP & SIZING BREAKDOWN MATRIX ---');

  const recap = await DbRepository.getPackageEquipmentRecap(pkg1.id);
  assert(recap.total_active_participants === 3, 'Recap reflects 3 active participants');
  assert(recap.male_count === 1, 'Recap male count = 1');
  assert(recap.female_count === 2, 'Recap female count = 2');

  const batikSummary = recap.item_summaries.find(i => i.item_name.includes('Batik'))!;
  assert(batikSummary.total_needed === 3, 'Batik needed = 3');
  assert(batikSummary.variant_breakdown.some(v => v.label === 'XL' && v.qty_needed === 1), 'Batik XL count = 1');
  assert(batikSummary.variant_breakdown.some(v => v.label === 'L' && v.qty_needed === 1), 'Batik L count = 1');
  assert(batikSummary.variant_breakdown.some(v => v.label === 'M' && v.qty_needed === 1), 'Batik M count = 1');

  // =========================================================================
  // 11. EXCEL EXPORTS & NUMERIC CELL TYPES
  // =========================================================================
  console.log('\n--- 11. EXCEL EXPORTS & NUMERIC CELL TYPES ---');

  // Generate 3-sheet operational Excel report
  const excelReport = await EquipmentExportService.generatePackageEquipmentExcel(pkg1.id);
  assert(excelReport.filename.includes('LAPORAN_PERLENGKAPAN'), 'Report filename follows convention');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(excelReport.buffer);

  const wsSummary = wb.getWorksheet('Ringkasan Per Item');
  assert(!!wsSummary, 'Worksheet "Ringkasan Per Item" exists');

  // Verify numeric cell types in Sheet 1 (Row 4, Col 6: Kebutuhan)
  const cellQtyNeeded = wsSummary.getCell('F4');
  assert(typeof cellQtyNeeded.value === 'number', 'Summary Kebutuhan cell is raw NUMERIC', `Type: ${typeof cellQtyNeeded.value}`);

  const wsVariant = wb.getWorksheet('Rekap Varian');
  assert(!!wsVariant, 'Worksheet "Rekap Varian" exists');
  const cellVariantQty = wsVariant.getCell('D3');
  assert(typeof cellVariantQty.value === 'number', 'Variant breakdown Qty cell is raw NUMERIC');

  const wsPax = wb.getWorksheet('Detail Per Pax');
  assert(!!wsPax, 'Worksheet "Detail Per Pax" exists');
  const cellPaxQty = wsPax.getCell('H3');
  assert(typeof cellPaxQty.value === 'number', 'Pax Detail Expected Qty cell is raw NUMERIC');

  // Generate Checklist Excel
  const checklist = await EquipmentExportService.generatePackageChecklistExcel(pkg1.id);
  assert(checklist.filename.includes('CHECKLIST_PERLENGKAPAN'), 'Checklist filename follows convention');

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests} / ${totalTests} ACCEPTANCE TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runStage4AcceptanceTests().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
