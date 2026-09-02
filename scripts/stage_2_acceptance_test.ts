import { DbRepository } from '../src/lib/repository/db';
import { formatRupiah, toExcelNumeric } from '../src/lib/currency';
import { verifyAdminAuth } from '../src/lib/auth/guard';

async function runStage2AcceptanceTests() {
  console.log('================================================================');
  console.log('💰 RUNNING STAGE 2 ACCEPTANCE TESTS — FINANCE JAMAAH');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} — ${detail}`);
      failed++;
    }
  }

  // Setup Base Data
  const pkg = await DbRepository.createPackage({
    package_name: 'Umroh Ramadhan 1448 H',
    departure_date: '2027-03-10',
    return_date: '2027-03-22',
    b2b_price: 26000000,
    reference_price: 30000000,
    quota: 40,
    status: 'OPEN',
  });

  const picUstadz = await DbRepository.createPic('Ustadz Fulan', '081299998888', 'Mitra Jakarta');
  const picRahman = await DbRepository.createPic('Ustadz Rahman', '081277776666', 'Mitra Surabaya');

  const jAhmad = await DbRepository.createJamaah({ identity_name: 'Ahmad Dahlan', phone: '081111111' });
  const jBudi = await DbRepository.createJamaah({ identity_name: 'Budi Santoso', phone: '082222222' });
  const jHasan = await DbRepository.createJamaah({ identity_name: 'Hasan Basri', phone: '083333333' });
  const jUmar = await DbRepository.createJamaah({ identity_name: 'Umar Al Khattab', phone: '084444444' });

  // -----------------------------------------------------------------
  // SCENARIO G: Different Selling Prices per Participant
  // -----------------------------------------------------------------
  console.log('--- SCENARIO G: Different Selling Prices & Backfill ---');
  const partAhmad = await DbRepository.addParticipant(pkg.id, jAhmad.id, picUstadz.id, 26000000, 30000000);
  const partBudi = await DbRepository.addParticipant(pkg.id, jBudi.id, picUstadz.id, 26000000, 31000000);
  const partHasan = await DbRepository.addParticipant(pkg.id, jHasan.id, picUstadz.id, 26000000, 29500000);
  const partUmar = await DbRepository.addParticipant(pkg.id, jUmar.id, picUstadz.id, 26000000, 30000000);

  const invAhmad = await DbRepository.getInvoiceByParticipantId(partAhmad.id);
  const invBudi = await DbRepository.getInvoiceByParticipantId(partBudi.id);
  const invHasan = await DbRepository.getInvoiceByParticipantId(partHasan.id);

  assert(invAhmad?.base_amount === 30000000, 'Ahmad invoice base amount Rp30.000.000');
  assert(invBudi?.base_amount === 31000000, 'Budi invoice base amount Rp31.000.000');
  assert(invHasan?.base_amount === 29500000, 'Hasan invoice base amount Rp29.500.000');
  assert(invAhmad?.status === 'UNPAID', 'Initial invoice status is UNPAID');

  // -----------------------------------------------------------------
  // 1. NEGATIVE & POSITIVE ADJUSTMENT BEHAVIOR TEST
  // -----------------------------------------------------------------
  console.log('\n--- TEST 1: Signed Adjustment Behavior (Positive & Negative) ---');
  const jAdj = await DbRepository.createJamaah({ identity_name: 'Zaid bin Tsabit' });
  const partAdj = await DbRepository.addParticipant(pkg.id, jAdj.id, null, 26000000, 30000000);
  const invAdj = (await DbRepository.getInvoiceByParticipantId(partAdj.id))!;

  // Apply negative adjustment (-500.000)
  const invAfterNegativeAdj = await DbRepository.addInvoiceItem(invAdj.id, {
    type: 'ADJUSTMENT',
    category: 'ADJUSTMENT_ITEM',
    description: 'Koreksi Harga (- Rp 500.000)',
    amount: -500000,
  });
  assert(invAfterNegativeAdj.total_amount === 29500000, 'Negative adjustment decreases invoice: 30jt - 500rb = 29.5jt');

  // Apply positive adjustment (+1.000.000)
  const invAfterPositiveAdj = await DbRepository.addInvoiceItem(invAdj.id, {
    type: 'ADJUSTMENT',
    category: 'ADJUSTMENT_ITEM',
    description: 'Biaya Upgrade (+ Rp 1.000.000)',
    amount: 1000000,
  });
  assert(invAfterPositiveAdj.total_amount === 30500000, 'Positive adjustment increases invoice: 29.5jt + 1jt = 30.5jt');

  // -----------------------------------------------------------------
  // 2. BACKFILL IDEMPOTENCY TEST
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: Existing Participant Backfill Idempotency ---');
  const initialBackfill = DbRepository.ensureInvoiceBackfill();
  assert(initialBackfill === 0, 'No duplicate invoices created on backfill when all participants already have invoices');
  
  // Create another backfill test participant
  const jBackfill = await DbRepository.createJamaah({ identity_name: 'Usman bin Affan' });
  const partBackfill = await DbRepository.addParticipant(pkg.id, jBackfill.id, null, 26000000, 30000000);
  const backfillInv = await DbRepository.getInvoiceByParticipantId(partBackfill.id);
  assert(backfillInv !== null && backfillInv.base_amount === 30000000, 'Backfill created exactly 1 invoice for new participant');

  // Run backfill again
  const secondBackfill = DbRepository.ensureInvoiceBackfill();
  assert(secondBackfill === 0, 'Second backfill run creates 0 invoices (Strictly Idempotent)');

  // -----------------------------------------------------------------
  // SCENARIO A: Simple DP
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO A: Simple DP ---');
  const payDP = await DbRepository.createPayment({
    payment_date: '2026-09-01',
    amount: 5000000,
    sender_name: 'Ahmad Dahlan',
    sender_bank: 'BCA',
    package_id: pkg.id,
    notes: 'Pembayaran DP Umroh Ahmad',
  });

  const allocDP = await DbRepository.allocatePayment(payDP.id, [
    { invoiceId: invAhmad!.id, amount: 5000000 }
  ]);
  assert(allocDP.success === true, 'DP Payment allocated to Ahmad');

  const invAhmadAfterDP = await DbRepository.getInvoiceById(invAhmad!.id);
  assert(invAhmadAfterDP?.total_paid === 5000000, 'Ahmad Total Paid = Rp5.000.000');
  assert(invAhmadAfterDP?.outstanding === 25000000, 'Ahmad Outstanding = Rp25.000.000');
  assert(invAhmadAfterDP?.status === 'PARTIAL', 'Ahmad Status = PARTIAL (Cicilan)');
  assert(formatRupiah(invAhmadAfterDP?.outstanding) === 'Rp 25.000.000', 'UI display format Rp 25.000.000');

  // -----------------------------------------------------------------
  // SCENARIO B: Installments to Paid (Lunas)
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO B: Installments to Paid ---');
  const payCicilan1 = await DbRepository.createPayment({
    payment_date: '2026-10-01',
    amount: 10000000,
    sender_name: 'Ahmad Dahlan',
    sender_bank: 'BCA',
  });
  await DbRepository.allocatePayment(payCicilan1.id, [{ invoiceId: invAhmad!.id, amount: 10000000 }]);

  const payPelunasan = await DbRepository.createPayment({
    payment_date: '2026-11-01',
    amount: 15000000,
    sender_name: 'Ahmad Dahlan',
    sender_bank: 'BCA',
  });
  await DbRepository.allocatePayment(payPelunasan.id, [{ invoiceId: invAhmad!.id, amount: 15000000 }]);

  const invAhmadLunas = await DbRepository.getInvoiceById(invAhmad!.id);
  assert(invAhmadLunas?.total_paid === 30000000, 'Ahmad Total Paid = Rp30.000.000');
  assert(invAhmadLunas?.outstanding === 0, 'Ahmad Outstanding = Rp0');
  assert(invAhmadLunas?.status === 'PAID', 'Ahmad Status = PAID (Lunas)');

  // -----------------------------------------------------------------
  // SCENARIO C: One Payment / Multiple Jamaah Allocation
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO C: One Payment / Multiple Jamaah Allocation ---');
  const payMulti = await DbRepository.createPayment({
    payment_date: '2026-09-15',
    amount: 50000000,
    sender_name: 'Hamba Allah (Transfer Rombongan)',
    sender_bank: 'Mandiri',
  });

  const allocMultiResult = await DbRepository.allocatePayment(payMulti.id, [
    { invoiceId: invBudi!.id, amount: 10000000 },
    { invoiceId: invHasan!.id, amount: 15000000 },
    { invoiceId: (await DbRepository.getInvoiceByParticipantId(partUmar.id))!.id, amount: 25000000 },
  ]);

  assert(allocMultiResult.success === true, '1 Payment distributed across 3 Jamaah');
  const computedPayMulti = await DbRepository.getPaymentById(payMulti.id);
  assert(computedPayMulti?.total_allocated === 50000000, 'Payment total_allocated = Rp50.000.000');
  assert(computedPayMulti?.remaining_unallocated === 0, 'Payment remaining_unallocated = Rp0');
  assert(computedPayMulti?.allocation_status === 'ALLOCATED', 'Payment status = ALLOCATED');

  // -----------------------------------------------------------------
  // SCENARIO D: Partial Allocation
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO D: Partial Allocation ---');
  const payPartial = await DbRepository.createPayment({
    payment_date: '2026-09-20',
    amount: 100000000,
    sender_name: 'Donatur Yayasan',
    sender_bank: 'BSI',
  });

  await DbRepository.allocatePayment(payPartial.id, [
    { invoiceId: invBudi!.id, amount: 20000000 },
    { invoiceId: invHasan!.id, amount: 14500000 },
  ]);

  const computedPartialPay = await DbRepository.getPaymentById(payPartial.id);
  assert(computedPartialPay?.total_allocated === 34500000, 'Partial Payment Allocated = Rp34.500.000');
  assert(computedPartialPay?.remaining_unallocated === 65500000, 'Remaining available = Rp65.500.000');
  assert(computedPartialPay?.allocation_status === 'PARTIALLY_ALLOCATED', 'Status = PARTIALLY_ALLOCATED');

  // -----------------------------------------------------------------
  // SCENARIO E: Unidentified Payment in Payment Inbox
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO E: Payment Inbox ---');
  const payUnknown = await DbRepository.createPayment({
    payment_date: '2026-09-25',
    amount: 20000000,
    sender_name: 'ABDULLAH',
    notes: 'Transfer tanpa keterangan jamaah',
  });

  const inbox = await DbRepository.getPaymentInbox();
  const foundInInbox = inbox.find(p => p.id === payUnknown.id);
  assert(foundInInbox !== undefined, 'Unknown payment appears in Payment Inbox');
  assert(foundInInbox?.allocation_status === 'UNALLOCATED', 'Payment allocation_status = UNALLOCATED');

  // -----------------------------------------------------------------
  // SCENARIO F: PIC Collective Payment & Auto-Distribute
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO F: PIC Collective Payment & Auto-Distribute ---');
  const payPic = await DbRepository.createPayment({
    payment_date: '2026-09-28',
    amount: 60000000,
    sender_name: 'Ustadz Fulan (PIC)',
    pic_id: picUstadz.id,
  });

  const autoPreview = await DbRepository.autoDistributePayment(payPic.id);
  assert(autoPreview.length > 0, `Auto-distribute calculated suggestions for outstanding invoices`);
  const totalSuggested = autoPreview.reduce((sum, item) => sum + item.suggestedAmount, 0);
  assert(totalSuggested <= payPic.amount, 'Auto-distribute total suggestions never exceed payment amount');

  // -----------------------------------------------------------------
  // SCENARIO H: Overpayment Handling
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO H: Overpayment Handling ---');
  const jExtra = await DbRepository.createJamaah({ identity_name: 'Fatimah Az Zahra' });
  const partExtra = await DbRepository.addParticipant(pkg.id, jExtra.id, null, 26000000, 30000000);
  const invExtra = await DbRepository.getInvoiceByParticipantId(partExtra.id);

  const payOver = await DbRepository.createPayment({
    payment_date: '2026-10-05',
    amount: 31000000,
    sender_name: 'Fatimah Az Zahra',
  });
  await DbRepository.allocatePayment(payOver.id, [{ invoiceId: invExtra!.id, amount: 31000000 }]);

  const invExtraComputed = await DbRepository.getInvoiceById(invExtra!.id);
  assert(invExtraComputed?.status === 'OVERPAID', 'Invoice status = OVERPAID');
  assert(invExtraComputed?.overpayment === 1000000, 'Overpayment amount = Rp1.000.000 preserved');
  assert(invExtraComputed?.outstanding === 0, 'Outstanding = 0 when overpaid');

  // -----------------------------------------------------------------
  // SCENARIO I: Cancel Payment
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO I: Cancel Payment ---');
  const payToCancel = await DbRepository.createPayment({
    payment_date: '2026-10-10',
    amount: 5000000,
    sender_name: 'Umar Al Khattab',
  });
  const invUmar = (await DbRepository.getInvoiceByParticipantId(partUmar.id))!;
  await DbRepository.allocatePayment(payToCancel.id, [{ invoiceId: invUmar.id, amount: 5000000 }]);

  const cancelled = await DbRepository.cancelPayment(payToCancel.id, 'Cek mutasi ganda / dibatalkan');
  assert(cancelled.status === 'CANCELLED', 'Payment marked CANCELLED');
  assert(cancelled.cancellation_reason === 'Cek mutasi ganda / dibatalkan', 'Cancellation reason saved');

  const invUmarAfterCancel = await DbRepository.getInvoiceById(invUmar.id);
  assert(invUmarAfterCancel?.total_paid === 25000000, 'Cancelled payment allocation excluded from invoice paid balance');

  // -----------------------------------------------------------------
  // SCENARIO J: Wrong Allocation Correction (Reversal)
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO J: Allocation Reversal ---');
  const payMisallocated = await DbRepository.createPayment({
    payment_date: '2026-10-12',
    amount: 10000000,
    sender_name: 'Budi Santoso',
  });
  const allocMis = await DbRepository.allocatePayment(payMisallocated.id, [{ invoiceId: invUmar.id, amount: 10000000 }]);
  const allocRecord = allocMis.payment.allocations![0];

  const reversed = await DbRepository.reverseAllocation(allocRecord.id, 'Salah alokasi ke Umar, seharusnya Budi');
  assert(reversed === true, 'Allocation reversed');

  await DbRepository.allocatePayment(payMisallocated.id, [{ invoiceId: invBudi!.id, amount: 10000000 }]);
  const payAfterReversal = await DbRepository.getPaymentById(payMisallocated.id);
  assert(payAfterReversal?.total_allocated === 10000000, 'Payment reallocated correctly');

  // -----------------------------------------------------------------
  // SCENARIO L: Concurrency & Over-allocation Protection
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO L: Over-allocation Blocked ---');
  const paySmall = await DbRepository.createPayment({
    payment_date: '2026-10-15',
    amount: 5000000,
    sender_name: 'Test Limit',
  });
  const overAllocAttempt = await DbRepository.allocatePayment(paySmall.id, [
    { invoiceId: invAhmad!.id, amount: 10000000 }
  ]);
  assert(overAllocAttempt.success === false, 'Over-allocation attempt blocked by transactional validation');

  // -----------------------------------------------------------------
  // 3. HARD DELETE PROTECTION & SECURITY TEST
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: Finance Hard Delete Protection & Security ---');
  // Check RLS & Guard
  const reqUnauth = new Request('http://localhost:3005/api/finance/overview', {
    headers: { 'Authorization': 'Bearer unauthenticated' }
  }) as any;
  const unauthCheck = await verifyAdminAuth(reqUnauth);
  assert(unauthCheck.authorized === false, 'Unauthenticated user denied finance read access (401)');

  const reqInactive = new Request('http://localhost:3005/api/finance/payments', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer mock_inactive_token' }
  }) as any;
  const inactiveCheck = await verifyAdminAuth(reqInactive);
  assert(inactiveCheck.authorized === false, 'Inactive admin denied finance mutation access (403)');

  // Hard delete check: DbRepository strictly blocks hard deletion (throws HARD_DELETE_DENIED)
  let paymentDeleteBlocked = false;
  try {
    await (DbRepository as any).deletePayment('pay_123');
  } catch (err: any) {
    if (err.message.includes('HARD_DELETE_DENIED')) paymentDeleteBlocked = true;
  }
  assert(paymentDeleteBlocked === true, 'Direct hard delete of Payment explicitly DENIED');

  let invoiceDeleteBlocked = false;
  try {
    await DbRepository.deleteInvoice('inv_123');
  } catch (err: any) {
    if (err.message.includes('HARD_DELETE_DENIED')) invoiceDeleteBlocked = true;
  }
  assert(invoiceDeleteBlocked === true, 'Direct hard delete on Invoice is strictly DENIED (Non-destructive)');

  let allocDeleteBlocked = false;
  try {
    await DbRepository.deletePaymentAllocation('alloc_123');
  } catch (err: any) {
    if (err.message.includes('HARD_DELETE_DENIED')) allocDeleteBlocked = true;
  }
  assert(allocDeleteBlocked === true, 'Direct hard delete on Allocation is strictly DENIED (Non-destructive)');

  // -----------------------------------------------------------------
  // SCENARIO Q: Dedicated Package Finance Report
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO Q: Package Finance Report (Laporan Keuangan Paket) ---');
  // Create a dedicated package for financial report test: "Umroh 19 Agustus"
  const pkgReport = await DbRepository.createPackage({
    package_name: 'Umroh 19 Agustus',
    departure_date: '2026-08-19',
    return_date: '2026-08-30',
    b2b_price: 27500000,
    reference_price: 30000000,
    quota: 40,
    status: 'OPEN',
  });

  // Add 3 Jamaah under Ust. Fulan (with TL Discount)
  const jR1 = await DbRepository.createJamaah({ identity_name: 'Jamaah Fulan 1' });
  const partR1 = await DbRepository.addParticipant(pkgReport.id, jR1.id, picUstadz.id, 27500000, 30000000);
  const invR1 = (await DbRepository.getInvoiceByParticipantId(partR1.id))!;
  await DbRepository.addInvoiceItem(invR1.id, {
    type: 'DISCOUNT',
    category: 'TL_DISCOUNT',
    description: 'Diskon TL Ust Fulan',
    amount: 1000000,
  });

  const jR2 = await DbRepository.createJamaah({ identity_name: 'Jamaah Fulan 2' });
  const partR2 = await DbRepository.addParticipant(pkgReport.id, jR2.id, picUstadz.id, 27500000, 30000000);
  const invR2 = (await DbRepository.getInvoiceByParticipantId(partR2.id))!;
  await DbRepository.addInvoiceItem(invR2.id, {
    type: 'DISCOUNT',
    category: 'TL_DISCOUNT',
    description: 'Diskon TL Ust Fulan',
    amount: 1000000,
  });

  // Add 2 Jamaah under Ust. Rahman
  const jR3 = await DbRepository.createJamaah({ identity_name: 'Jamaah Rahman 1' });
  const partR3 = await DbRepository.addParticipant(pkgReport.id, jR3.id, picRahman.id, 27500000, 31000000);
  const invR3 = (await DbRepository.getInvoiceByParticipantId(partR3.id))!;

  const jR4 = await DbRepository.createJamaah({ identity_name: 'Jamaah Rahman 2' });
  const partR4 = await DbRepository.addParticipant(pkgReport.id, jR4.id, picRahman.id, 27500000, 31000000);
  const invR4 = (await DbRepository.getInvoiceByParticipantId(partR4.id))!;

  // Add 1 Direct Jamaah
  const jR5 = await DbRepository.createJamaah({ identity_name: 'Jamaah Mandiri' });
  const partR5 = await DbRepository.addParticipant(pkgReport.id, jR5.id, null, 27500000, 30000000);
  const invR5 = (await DbRepository.getInvoiceByParticipantId(partR5.id))!;

  // Record Payments for the Package
  // Payment 1: Ust Fulan pays 29jt for jR1 (Lunas) and 20jt for jR2 (Partial)
  const payR1 = await DbRepository.createPayment({
    payment_date: '2026-08-05',
    amount: 49000000,
    sender_name: 'Ust Fulan Kolektif',
    package_id: pkgReport.id,
    pic_id: picUstadz.id,
  });
  await DbRepository.allocatePayment(payR1.id, [
    { invoiceId: invR1.id, amount: 29000000 },
    { invoiceId: invR2.id, amount: 20000000 },
  ]);

  // Generate Report
  const rep = await DbRepository.getPackageFinanceReport(pkgReport.id);

  assert(rep.registered_pax === 5, 'Report: Registered Pax = 5');
  assert(rep.total_b2b === 5 * 27500000, `Report: Total B2B = Rp${(5 * 27500000).toLocaleString('id-ID')}`);
  assert(rep.total_selling_price === 30000000 + 30000000 + 31000000 + 31000000 + 30000000, 'Report: Total Selling Price = Rp152.000.000');
  assert(rep.total_tl_discount === 2000000, 'Report: Total TL Discount = Rp2.000.000');
  assert(rep.total_net_invoice === 150000000, 'Report: Total Net Invoice = Rp150.000.000');
  assert(rep.total_paid === 49000000, 'Report: Total Paid = Rp49.000.000');
  assert(rep.total_outstanding === 150000000 - 49000000, 'Report: Total Outstanding = Rp101.000.000');
  assert(rep.paid_pax_count === 1, 'Report: Paid Pax Count = 1 (Jamaah Fulan 1)');
  assert(rep.unpaid_pax_count === 4, 'Report: Unpaid/Partial Pax Count = 4');

  // -----------------------------------------------------------------
  // SCENARIO R: PIC / TL Financial Breakdown Test
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO R: PIC / TL Financial Breakdown ---');
  const picFulanGroup = rep.pic_breakdowns.find(p => p.pic_id === picUstadz.id);
  const picRahmanGroup = rep.pic_breakdowns.find(p => p.pic_id === picRahman.id);
  const directGroup = rep.pic_breakdowns.find(p => p.pic_id === null || p.pic_name === 'Direct');

  assert(picFulanGroup?.pax_count === 2, 'PIC Fulan Group Pax = 2');
  assert(picFulanGroup?.total_tl_discount === 2000000, 'PIC Fulan TL Discount = Rp2.000.000');
  assert(picFulanGroup?.total_invoice === 58000000, 'PIC Fulan Net Invoice = Rp58.000.000');
  assert(picFulanGroup?.total_paid === 49000000, 'PIC Fulan Paid = Rp49.000.000');
  assert(picFulanGroup?.total_outstanding === 9000000, 'PIC Fulan Outstanding = Rp9.000.000');

  assert(picRahmanGroup?.pax_count === 2, 'PIC Rahman Group Pax = 2');
  assert(picRahmanGroup?.total_invoice === 62000000, 'PIC Rahman Total Invoice = Rp62.000.000');
  assert(directGroup?.pax_count === 1, 'Direct Group Pax = 1');
  assert(directGroup?.total_invoice === 30000000, 'Direct Group Total Invoice = Rp30.000.000');

  // -----------------------------------------------------------------
  // SCENARIO S: Package Finance Per Pax Detail Test
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO S: Package Finance Per Pax Detail ---');
  const pax1 = rep.pax_details.find(p => p.jamaah_name === 'Jamaah Fulan 1')!;
  assert(pax1.b2b_price === 27500000, 'Pax 1: Raw numeric B2B = 27500000');
  assert(pax1.selling_price === 30000000, 'Pax 1: Raw numeric Selling = 30000000');
  assert(pax1.tl_discount === 1000000, 'Pax 1: Raw numeric TL Discount = 1000000');
  assert(pax1.net_invoice === 29000000, 'Pax 1: Raw numeric Net Invoice = 29000000');
  assert(pax1.total_paid === 29000000, 'Pax 1: Raw numeric Total Paid = 29000000');
  assert(pax1.outstanding === 0, 'Pax 1: Outstanding = 0');
  assert(pax1.status === 'PAID', 'Pax 1: Status = PAID');

  // -----------------------------------------------------------------
  // SCENARIO O: Numeric & Excel Export Readiness
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO O: Numeric & Excel Export Readiness ---');
  const excelObj = toExcelNumeric(pax1.net_invoice);
  assert(typeof excelObj.v === 'number' && excelObj.v === 29000000, 'Excel export value is raw numeric number (29000000)');
  assert(excelObj.z.includes('Rp'), 'Excel visual format string includes "Rp"');

  console.log('\n================================================================');
  console.log(`🏁 STAGE 2 CLOSING TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage2AcceptanceTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
