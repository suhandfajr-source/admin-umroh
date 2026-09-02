# STAGE 5 — Dashboard Intelligence & Automation

## Objective
Membuat sistem lebih proaktif membantu admin menemukan masalah, bukan hanya menyimpan data.

Stage ini tidak mengganti workflow stage sebelumnya.

---

## 1. Action Dashboard

Dashboard fokus pada pekerjaan yang perlu ditindaklanjuti.

Section:
```text
Action Required
```

Contoh:
- 7 Passport Missing
- 2 Passport Expiring Soon
- 3 Payments Unallocated
- 4 Jamaah Outstanding
- 6 Equipment Not Collected
- 2 Documents Need Review
- 3 Possible Duplicate Jamaah

Klik setiap item membuka data terkait.

---

## 2. Package Health

Setiap package memiliki health summary:

```text
Participants        20 / 25
Documents Complete  17 / 20
Payments Complete   14 / 20
Equipment Complete  12 / 20
Manifest Ready      18 / 20
```

Gunakan indikator sederhana.

Tidak perlu grafik kompleks.

---

## 3. Passport Intelligence

Warning:
- Missing
- Expired
- Expiring Soon
- Validity risk relative to departure date

Buat setting jumlah bulan validity requirement agar dapat diubah kemudian.

---

## 4. Duplicate Intelligence

Saat data baru masuk, sistem memberi confidence / reason.

Contoh:
```text
Possible Duplicate — High Confidence

Reason:
Same Passport Number
Same DOB
Similar Name
```

Admin tetap menjadi decision maker.

---

## 5. Document Quality Warning

Jika extraction confidence rendah:
- Tandai field
- Jangan auto-confirm
- Masukkan ke Review Queue

Contoh:
```text
Place of Issue — Low Confidence
```

---

## 6. Payment Matching Suggestion

Karena bank integration belum diperlukan, gunakan suggestion sederhana berdasarkan:
- Sender Name
- PIC
- Outstanding Amount
- Recent Package
- Similar Payment Amount

Contoh:
```text
Payment Rp30.000.000
Sender: AHMAD

Possible Match:
Muhammad Ahmad — Outstanding Rp30.000.000
```

Admin harus confirm.

Jangan auto allocate.

---

## 7. Search Improvement

Global Search mendukung:
- Partial Name
- Passport
- NIK
- PIC
- Package
- Phone

Tambahkan recent search optional.

---

## 8. Saved Filters

Admin dapat menyimpan filter:

Contoh:
```text
Belum Lunas — Umroh As Salam
Passport Belum Lengkap
Perlengkapan Belum Diambil
PIC Ustadz Fulan
```

---

## 9. Activity Feed

Tampilkan aktivitas terbaru:

```text
09:12 — Passport Ahmad updated
09:05 — Payment Rp30 juta allocated
08:50 — 5 documents uploaded
08:42 — Hasan added to Umroh As Salam
```

---

## 10. Audit Log

Tambahkan audit log untuk perubahan penting:
- Jamaah updated
- Passport replaced
- Payment edited
- Allocation changed
- Invoice adjustment
- Package participant removed

Fields:
```text
id
user_id
action
entity_type
entity_id
before_data
after_data
created_at
```

---

## 11. Safety / Data Integrity

Untuk aksi sensitif:
- Delete
- Cancel Payment
- Remove Allocation
- Remove Participant

Gunakan confirmation.

Lebih baik soft delete untuk data finansial dan historis.

---

## 12. Dashboard Layout

Prioritas urutan:

1. Action Required
2. Upcoming Departures
3. Finance Summary
4. Document Summary
5. Equipment Summary
6. Recent Activity

Hindari chart yang tidak actionable.

---

## 13. Upcoming Departures

Tampilkan package berdasarkan keberangkatan terdekat.

Contoh:
```text
Umroh As Salam
10 October 2026
20 / 25 Jamaah

Documents: 85%
Paid: 70%
Equipment: 60%
Manifest: 90%
```

---

## 14. Smart Alerts

Alert examples:
- Passport issue
- Missing document
- Unallocated payment
- Overpayment
- Package over quota
- Manifest incomplete
- Equipment incomplete near departure

---

## 15. Optional Future Hooks

Siapkan arsitektur agar nanti mudah menambah:
- WhatsApp notification
- Bank mutation integration
- Online registration form
- Agent portal
- Jamaah portal
- Visa status
- Ticketing
- Rooming list
- Bus allocation
- Mobile app

Jangan implementasikan sekarang.

Hanya pastikan data model tidak menghalangi fitur tersebut.

---

## 16. Definition of Done

Stage 5 selesai jika:
- Dashboard actionable
- Warning dokumen berjalan
- Passport warning berjalan
- Payment suggestion tersedia
- Duplicate warning lebih informatif
- Audit log tersedia
- Recent activity tersedia
- Saved filter tersedia
- Sistem tetap sederhana untuk admin
