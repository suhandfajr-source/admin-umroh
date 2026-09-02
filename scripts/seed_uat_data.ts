import { DbRepository } from '@/lib/repository/db';
import { OperationalAlertEngine } from '@/lib/intelligence/alert-engine';
import { ReadinessService } from '@/lib/intelligence/readiness-service';
import { AuditService } from '@/lib/audit/audit-service';

/**
 * UAT DATASET SEEDER (PRODUCTION-SAFE)
 * 
 * Safely populates a realistic, imperfect UAT dataset covering 3 Umrah packages
 * and 45+ diverse Jamaah profiles to exercise all Stage 1–5 modules.
 */
export async function seedUatData(options: { resetFirst?: boolean } = { resetFirst: true }): Promise<{
  packages: any[];
  jamaahCount: number;
  participantsCount: number;
  invoicesCount: number;
  paymentsCount: number;
  equipmentCount: number;
}> {
  // 1. Strict Environment Safeguard
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production' && !process.env.ALLOW_UAT_SEED_IN_STAGING) {
    throw new Error(
      'CRITICAL SAFEGUARD: UAT Seeder aborted! Running UAT seed scripts against a Production environment is strictly prohibited.'
    );
  }

  console.log('>>> [UAT SEEDER] Initializing Production-Safe UAT Dataset...');

  if (options.resetFirst) {
    DbRepository.resetStore();
    console.log('>>> [UAT SEEDER] Store reset to clean initial state.');
  }

  const now = new Date();
  const dateStr = (daysFromNow: number) => {
    return new Date(now.getTime() + daysFromNow * 86400000).toISOString().split('T')[0];
  };

  // ---------------------------------------------------------------------------
  // 1. CREATE 3 UAT PACKAGES
  // ---------------------------------------------------------------------------
  console.log('>>> [UAT SEEDER] 1. Creating 3 Distinct Departure Packages...');

  // Package A: Departure in 18 days (< 30 days — Urgent / Critical threshold)
  const pkgA = await DbRepository.createPackage({
    package_name: 'UAT PACKAGE A — <30 DAYS (VIP Syawal 1447H)',
    departure_date: dateStr(18),
    duration_days: 9,
    b2b_price: 28000000,
    selling_price: 33000000,
    quota: 40,
    status: 'OPEN',
  });

  // Package B: Departure in 42 days (30–60 days — Warning / Preparation window)
  const pkgB = await DbRepository.createPackage({
    package_name: 'UAT PACKAGE B — 30-60 DAYS (Reguler Dzulqa\'dah)',
    departure_date: dateStr(42),
    duration_days: 12,
    b2b_price: 24000000,
    selling_price: 28500000,
    quota: 45,
    status: 'OPEN',
  });

  // Package C: Departure in 85 days (> 60 days — Early registration window)
  const pkgC = await DbRepository.createPackage({
    package_name: 'UAT PACKAGE C — >60 DAYS (Awal Musim 1448H)',
    departure_date: dateStr(85),
    duration_days: 10,
    b2b_price: 26000000,
    selling_price: 31000000,
    quota: 50,
    status: 'OPEN',
  });

  // Configure Package Equipment Rules
  // Package A has complete equipment rules (Koper, Batik, Tas Paspor, Ihram, Mukena)
  await DbRepository.setPackageEquipment(pkgA.id, [
    { equipment_item_id: 'eq_koper', quantity: 1, is_mandatory: true },
    { equipment_item_id: 'eq_batik', quantity: 1, is_mandatory: true },
    { equipment_item_id: 'eq_tas_paspor', quantity: 1, is_mandatory: true },
    { equipment_item_id: 'eq_ihram', quantity: 1, is_mandatory: true },
    { equipment_item_id: 'eq_mukena', quantity: 1, is_mandatory: true },
  ]);

  // Package B has partial equipment rules (Koper & Batik only)
  await DbRepository.setPackageEquipment(pkgB.id, [
    { equipment_item_id: 'eq_koper', quantity: 1, is_mandatory: true },
    { equipment_item_id: 'eq_batik', quantity: 1, is_mandatory: true },
  ]);

  // Package C has NO equipment configured (exercises NOT_APPLICABLE dimension)

  // ---------------------------------------------------------------------------
  // 2. CREATE PIC / TEAM LEADERS
  // ---------------------------------------------------------------------------
  console.log('>>> [UAT SEEDER] 2. Creating PIC / Team Leaders...');
  const picUstadzHasan = await DbRepository.createPic('Ustadz Hasan Basri (KBIH Al-Ikhlas)', '081234567890', 'Grup KBIH Jawa Barat');
  const picHjFatimah = await DbRepository.createPic('Hj. Fatimah Zahra (Majelis Taklim)', '081987654321', 'Grup Pengajian Jakarta Selatan');

  // ---------------------------------------------------------------------------
  // 3. CREATE JAMAAH & PARTICIPANTS (45+ REALISTIC PROFILES)
  // ---------------------------------------------------------------------------
  console.log('>>> [UAT SEEDER] 3. Seeding Realistic Imperfect Jamaah Profiles...');

  let totalJamaahCreated = 0;
  let totalParticipantsCreated = 0;

  // --- GROUP 1: Package A (<30D) Urgent Travelers (18 Pax) ---
  // 1.1 Complete & Ready Jamaah (Ahmad bin Abdullah)
  const jam1 = await DbRepository.createJamaah({
    identity_name: 'Ahmad Abdullah',
    passport_name: 'AHMAD BIN ABDULLAH',
    passport_number: 'B8172635',
    passport_expiry_date: dateStr(600),
    passport_issue_date: dateStr(-400),
    nik: '3201123456780001',
    birth_date: '1982-05-14',
    birth_place: 'BANDUNG',
    gender: 'MALE',
    phone: '08111222333',
    city: 'Bandung',
  });
  totalJamaahCreated++;
  const part1 = await DbRepository.addParticipant(pkgA.id, jam1.id, undefined, undefined, 33000000);
  totalParticipantsCreated++;

  // Set sizing & fulfillment for Ahmad
  const pe1 = await DbRepository.getParticipantEquipmentByParticipant(part1.id);
  const pe1Batik = pe1.find(p => p.package_equipment_item?.equipment_item_id === 'eq_batik');
  if (pe1Batik) await DbRepository.updateParticipantEquipmentVariant(pe1Batik.id, 'var_batik_xl');
  // Prepare & Handover all items for Ahmad
  for (const pe of pe1) {
    if (pe.package_equipment_item?.equipment_item_id === 'eq_batik') {
      await DbRepository.prepareParticipantEquipment({ id: pe.id, quantity: 1 });
      await DbRepository.handoverParticipantEquipment({ id: pe.id, quantity: 1 });
    } else {
      await DbRepository.prepareParticipantEquipment({ id: pe.id, quantity: 1 });
      await DbRepository.handoverParticipantEquipment({ id: pe.id, quantity: 1 });
    }
  }

  // 1.2 Multi-member Family Household (Keluarga Pak Bambang: 4 Pax via PIC Ustadz Hasan)
  const kkNumberBambang = '3273010101900002';
  const famMembers = [
    { name: 'BAMBANG SOETEDJO', role: 'AYAH', gender: 'MALE' as const, birth: '1975-03-20', passNo: 'A9911221', passExp: dateStr(450), size: 'var_batik_xxl' },
    { name: 'SRI WAHYUNI BINTI KARTO', role: 'IBU', gender: 'FEMALE' as const, birth: '1978-08-12', passNo: 'A9911222', passExp: dateStr(450), size: 'var_batik_m' },
    { name: 'DIMAS PRASETYO', role: 'ANAK', gender: 'MALE' as const, birth: '2005-11-05', passNo: 'A9911223', passExp: dateStr(500), size: 'var_batik_l' },
    { name: 'NADIA RAHMAWATI', role: 'ANAK', gender: 'FEMALE' as const, birth: '2009-02-18', passNo: null, passExp: null, size: 'var_batik_s' }, // Missing passport child
  ];

  for (const fam of famMembers) {
    const j = await DbRepository.createJamaah({
      identity_name: fam.name,
      passport_name: fam.passNo ? fam.name : null,
      passport_number: fam.passNo,
      passport_expiry_date: fam.passExp,
      nik: `3273${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      kk_number: kkNumberBambang,
      birth_date: fam.birth,
      birth_place: 'JAKARTA',
      gender: fam.gender,
      phone: '081288889999',
      city: 'Jakarta',
    });
    totalJamaahCreated++;
    const p = await DbRepository.addParticipant(pkgA.id, j.id, picUstadzHasan.id, undefined, 32000000, `Grup Keluarga Bambang (${fam.role})`);
    totalParticipantsCreated++;

    // Set variant
    const pEquip = await DbRepository.getParticipantEquipmentByParticipant(p.id);
    const batik = pEquip.find(pe => pe.package_equipment_item?.equipment_item_id === 'eq_batik');
    if (batik) await DbRepository.updateParticipantEquipmentVariant(batik.id, fam.size);
  }

  // 1.3 Urgent Missing Passport Pax (Imminent Departure <30d -> CRITICAL Blocker)
  const jamUrgentMissing = await DbRepository.createJamaah({
    identity_name: 'Dedi Kurniawan (KTP Only)',
    nik: '3204123456780005',
    gender: 'MALE',
    phone: '081333444555',
    city: 'Bogor',
  });
  totalJamaahCreated++;
  const partUrgentMissing = await DbRepository.addParticipant(pkgA.id, jamUrgentMissing.id, undefined, undefined, 33000000);
  totalParticipantsCreated++;

  // 1.4 Expiring Passport Pax (<6 Months relative to departure -> CRITICAL / WARNING Blocker)
  const jamExpiring = await DbRepository.createJamaah({
    identity_name: 'Hj. Rohanah',
    passport_name: 'ROHANAH BINTI SOLEH',
    passport_number: 'C1029384',
    passport_expiry_date: dateStr(25), // Expires 7 days after departure (way below 6 months)
    gender: 'FEMALE',
    phone: '081444555666',
    city: 'Depok',
  });
  totalJamaahCreated++;
  const partExpiring = await DbRepository.addParticipant(pkgA.id, jamExpiring.id, undefined, undefined, 33000000);
  totalParticipantsCreated++;

  // 1.5 Missing Apparel Variant Pax (Seragam belum diisi)
  const jamMissingSize = await DbRepository.createJamaah({
    identity_name: 'Agus Setiawan',
    passport_name: 'AGUS SETIAWAN',
    passport_number: 'B7766554',
    passport_expiry_date: dateStr(700),
    gender: 'MALE',
    phone: '081555666777',
    city: 'Tangerang',
  });
  totalJamaahCreated++;
  const partMissingSize = await DbRepository.addParticipant(pkgA.id, jamMissingSize.id, undefined, undefined, 33000000);
  totalParticipantsCreated++;

  // 1.6 Missing Gender Pax (Gender NULL -> Equipment Warning)
  const jamMissingGender = await DbRepository.createJamaah({
    identity_name: 'Nurul Hidayati (Gender Belum Diisi)',
    passport_name: 'NURUL HIDAYATI',
    passport_number: 'B9988771',
    passport_expiry_date: dateStr(700),
    gender: null,
    phone: '081666777888',
  });
  totalJamaahCreated++;
  const partMissingGender = await DbRepository.addParticipant(pkgA.id, jamMissingGender.id, undefined, undefined, 33000000);
  totalParticipantsCreated++;

  // 1.7 Cancelled Participant (Cancelled Pax with historical invoice & preserved equipment)
  const jamCancelled = await DbRepository.createJamaah({
    identity_name: 'Eko Prasetyo (Batal Berangkat)',
    phone: '081777888999',
  });
  totalJamaahCreated++;
  const partCancelled = await DbRepository.addParticipant(pkgA.id, jamCancelled.id, undefined, undefined, 33000000);
  totalParticipantsCreated++;
  await DbRepository.updateParticipantStatus(partCancelled.id, 'CANCELLED');

  // Seed 10 additional standard participants in Package A
  for (let i = 1; i <= 10; i++) {
    const isMale = i % 2 === 0;
    const j = await DbRepository.createJamaah({
      identity_name: `Jamaah Paket A Standard ${i}`,
      passport_name: `JAMAAH A STANDARD ${i}`,
      passport_number: `A80000${i.toString().padStart(2, '0')}`,
      passport_expiry_date: dateStr(800),
      gender: isMale ? 'MALE' : 'FEMALE',
      phone: `08110000${i.toString().padStart(3, '0')}`,
      city: 'Jakarta',
    });
    totalJamaahCreated++;
    const p = await DbRepository.addParticipant(pkgA.id, j.id, undefined, undefined, 33000000);
    totalParticipantsCreated++;

    // Assign sizing
    const pEquip = await DbRepository.getParticipantEquipmentByParticipant(p.id);
    const batik = pEquip.find(pe => pe.package_equipment_item?.equipment_item_id === 'eq_batik');
    if (batik) await DbRepository.updateParticipantEquipmentVariant(batik.id, isMale ? 'var_batik_l' : 'var_batik_m');
  }

  // --- GROUP 2: Package B (30–60D) Moderate Urgency Travelers (15 Pax) ---
  // Seed 15 Pax via PIC Hj. Fatimah
  for (let i = 1; i <= 15; i++) {
    const isMale = i % 3 === 0;
    const hasPassport = i <= 11; // 4 pax missing passport
    const j = await DbRepository.createJamaah({
      identity_name: `Jamaah Majelis Taklim ${i}`,
      passport_name: hasPassport ? `JAMAAH MAJELIS ${i}` : null,
      passport_number: hasPassport ? `B85000${i.toString().padStart(2, '0')}` : null,
      passport_expiry_date: hasPassport ? dateStr(650) : null,
      gender: isMale ? 'MALE' : 'FEMALE',
      phone: `08120000${i.toString().padStart(3, '0')}`,
      city: 'Jakarta Selatan',
    });
    totalJamaahCreated++;
    const p = await DbRepository.addParticipant(pkgB.id, j.id, picHjFatimah.id, undefined, 28000000, 'Grup Majelis Taklim');
    totalParticipantsCreated++;

    if (i <= 8) {
      const pEquip = await DbRepository.getParticipantEquipmentByParticipant(p.id);
      const batik = pEquip.find(pe => pe.package_equipment_item?.equipment_item_id === 'eq_batik');
      if (batik) await DbRepository.updateParticipantEquipmentVariant(batik.id, 'var_batik_l');
    }
  }

  // --- GROUP 3: Package C (>60D) Early Travelers & Repeat Traveler (15 Pax) ---
  // 3.1 Repeat Traveler: Ahmad bin Abdullah (jam1) travelling again on Package C!
  const part1Trip2 = await DbRepository.addParticipant(pkgC.id, jam1.id, undefined, undefined, 30000000, 'Repeat Traveler (Trip 2)');
  totalParticipantsCreated++;

  // Seed 14 additional early registrations in Package C
  for (let i = 2; i <= 15; i++) {
    const isMale = i % 2 === 0;
    const j = await DbRepository.createJamaah({
      identity_name: `Jamaah Early Bird ${i}`,
      passport_name: `JAMAAH EARLY BIRD ${i}`,
      passport_number: `C90000${i.toString().padStart(2, '0')}`,
      passport_expiry_date: dateStr(900),
      gender: isMale ? 'MALE' : 'FEMALE',
      phone: `08130000${i.toString().padStart(3, '0')}`,
      city: 'Surabaya',
    });
    totalJamaahCreated++;
    await DbRepository.addParticipant(pkgC.id, j.id, undefined, undefined, 31000000);
    totalParticipantsCreated++;
  }

  // ---------------------------------------------------------------------------
  // 4. SEED FINANCIAL TRANSACTIONS & PAYMENTS
  // ---------------------------------------------------------------------------
  console.log('>>> [UAT SEEDER] 4. Seeding Financial Invoices, Payments & Allocations...');

  let totalPaymentsCreated = 0;

  // 4.1 Full Payment for Ahmad (part1)
  const inv1 = await DbRepository.getInvoiceByParticipantId(part1.id);
  const pay1 = await DbRepository.createPayment({
    payment_date: dateStr(-10),
    amount: 33000000,
    sender_name: 'Ahmad Abdullah Pelunasan',
    notes: 'Transfer Bank Mandiri Lunas',
  });
  totalPaymentsCreated++;
  await DbRepository.allocatePayment(pay1.id, [{ invoiceId: inv1!.id, amount: 33000000 }]);

  // 4.2 Partial Installment for Bambang Soetedjo
  const invBambang = await DbRepository.getInvoiceByParticipantId(
    (await DbRepository.getParticipants({ packageId: pkgA.id })).find(p => p.jamaah?.identity_name === 'BAMBANG SOETEDJO')!.id
  );
  const payBambangDP = await DbRepository.createPayment({
    payment_date: dateStr(-15),
    amount: 15000000,
    sender_name: 'Bambang Soetedjo DP',
  });
  totalPaymentsCreated++;
  await DbRepository.allocatePayment(payBambangDP.id, [{ invoiceId: invBambang!.id, amount: 15000000 }]);

  // 4.3 Collective PIC Payment from Ustadz Hasan (Rp 60.000.000 distributed across family)
  const familyParts = (await DbRepository.getParticipants({ packageId: pkgA.id })).filter(p => p.pic_id === picUstadzHasan.id);
  const payCollectiveHasan = await DbRepository.createPayment({
    payment_date: dateStr(-5),
    amount: 60000000,
    sender_name: 'KBIH Al-Ikhlas (Ustadz Hasan)',
    notes: 'Transfer Kolektif Tahap 1 Jamaah Keluarga',
  });
  totalPaymentsCreated++;

  const allocList = familyParts.slice(0, 3).map(fp => ({
    invoiceId: fp.invoice!.id,
    amount: 20000000,
  }));
  await DbRepository.allocatePayment(payCollectiveHasan.id, allocList);

  // 4.4 Overpayment Case (Invoice Rp 33.000.000 -> Paid Rp 34.000.000)
  const stdPax1 = (await DbRepository.getParticipants({ packageId: pkgA.id })).find(p => p.jamaah?.identity_name === 'Jamaah Paket A Standard 1')!;
  const payOver = await DbRepository.createPayment({
    payment_date: dateStr(-2),
    amount: 34000000,
    sender_name: 'Transfer Standard 1 Lebih Bayar',
  });
  totalPaymentsCreated++;
  await DbRepository.allocatePayment(payOver.id, [{ invoiceId: stdPax1.invoice!.id, amount: 34000000 }]);

  // 4.5 Payment Inbox: Unallocated Deposits (2 Payments waiting in Inbox)
  const payUnalloc1 = await DbRepository.createPayment({
    payment_date: dateStr(-1),
    amount: 25000000,
    sender_name: 'Hamba Allah Transfer BSI',
    notes: 'Transfer masuk tanpa keterangan nama jamaah',
  });
  totalPaymentsCreated++;

  const payUnalloc2 = await DbRepository.createPayment({
    payment_date: dateStr(0),
    amount: 10000000,
    sender_name: 'BCA Mobile 0812998877',
    notes: 'DP Umroh Mohon Dicek',
  });
  totalPaymentsCreated++;

  // ---------------------------------------------------------------------------
  // 5. EVALUATE OPERATIONAL ALERTS & AUDIT TRAIL
  // ---------------------------------------------------------------------------
  console.log('>>> [UAT SEEDER] 5. Running Operational Alert Engine & Building Audit Trail...');
  await OperationalAlertEngine.evaluate();

  await AuditService.logMutation({
    action: 'SEED_UAT_DATASET',
    entityType: 'SYSTEM',
    entityId: 'uat-seed-1',
    metadata: {
      packages_seeded: 3,
      jamaah_count: totalJamaahCreated,
      participants_count: totalParticipantsCreated,
      payments_count: totalPaymentsCreated,
      environment: env,
    }
  });

  const state = DbRepository.getStoreState();
  console.log('>>> [UAT SEEDER] Dataset Seeded Successfully!');
  console.log(`    Packages: ${state.packages.length}`);
  console.log(`    Master Jamaah: ${state.jamaah.length}`);
  console.log(`    Package Participants: ${state.package_participants.length}`);
  console.log(`    Invoices: ${state.invoices.length}`);
  console.log(`    Payments: ${state.payments.length}`);
  console.log(`    Operational Alerts: ${state.operational_alerts.length}`);
  console.log(`    Audit Logs: ${state.audit_logs.length}`);

  return {
    packages: state.packages,
    jamaahCount: state.jamaah.length,
    participantsCount: state.package_participants.length,
    invoicesCount: state.invoices.length,
    paymentsCount: state.payments.length,
    equipmentCount: state.participant_equipment.length,
  };
}

if (require.main === module) {
  seedUatData().catch(err => {
    console.error('Fatal error seeding UAT data:', err);
    process.exit(1);
  });
}
