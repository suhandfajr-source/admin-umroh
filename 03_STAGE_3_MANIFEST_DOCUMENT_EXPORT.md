# STAGE 3 — Manifest, Dokumen & Export

## Objective
Menghilangkan kebutuhan admin memperbarui manifest secara manual dan memudahkan pengambilan dokumen jamaah secara massal.

---

## 1. Navigation

Tambahkan:

```text
Operasional
├── Manifest
└── Arsip Dokumen

Laporan & Export
├── Manifest
├── Dokumen
└── Pembayaran

Pengaturan
└── Template Manifest
```

---

## 2. Prinsip Manifest

Manifest bukan database terpisah.

Manifest harus selalu di-generate dari:
```text
Master Jamaah
+
Package Participants
+
Package
```

Jika nomor paspor jamaah diperbarui:
- Manifest otomatis menggunakan data terbaru
- Admin tidak perlu edit manifest manual

---

## 3. Manifest Template

Admin dapat membuat template mapping.

Contoh:
```text
Excel Column        System Field

NAME             -> passport_name
PASSPORT NO      -> passport_number
POB              -> birth_place
DOB              -> birth_date
SEX              -> gender
PLACE ISSUE      -> passport_issue_place
DATE ISSUE       -> passport_issue_date
DATE EXPIRED     -> passport_expiry_date
```

---

## 4. Template Upload

Siapkan kemampuan upload template Excel.

Admin memiliki file manifest standar perusahaan.

Sistem harus:
1. Upload template
2. Membaca header
3. Menampilkan mapping field
4. Menyimpan mapping
5. Menggunakan template yang sama saat export

---

## 5. Manifest Preview

Admin memilih:
- Package
- Manifest Template

Tampilkan preview table sebelum download.

Status:
```text
READY
WARNING
ERROR
```

---

## 6. Manifest Validation

Sebelum export, validasi:
- Passport Name
- Passport Number
- Date of Birth
- Place of Birth
- Issue Date
- Expiry Date

Tampilkan:
```text
20 Participants
18 Ready
2 Need Attention
```

Jangan blok seluruh manifest jika hanya satu jamaah bermasalah.

Berikan shortcut:
`Fix Jamaah Data`

---

## 7. Export Manifest

Support:
- XLSX
- CSV optional

Output harus mengikuti template perusahaan.

Gunakan nama file:
```text
MANIFEST_<PACKAGE_NAME>_<DEPARTURE_DATE>.xlsx
```

---

## 8. Arsip Dokumen

Buat halaman pencarian seluruh dokumen.

Search:
- Nama Jamaah
- Passport Number
- NIK
- PIC
- Package

Filter:
- Passport
- KTP
- KK
- Vaksin
- Buku Nikah
- Current / Archived

Action:
- Preview
- Download
- Open Jamaah
- View History

---

## 9. Bulk Document Download

Admin dapat memilih:
- Package
- PIC
- Jenis Dokumen
- Jamaah tertentu

Contoh:
```text
Package: Umroh As Salam

☑ Passport
☐ KTP
☐ KK
☐ Vaksin
☐ Buku Nikah
```

Output:
```text
UMROH_AS_SALAM_PASSPORT.zip
```

---

## 10. File Naming

Rename file dalam ZIP secara otomatis:

```text
01_MUHAMMAD_AHMAD_E1234567.pdf
02_ABDULLAH_E7654321.pdf
03_HASAN_E9876543.pdf
```

Pastikan original file tetap tersimpan.

---

## 11. Checklist Dokumen Package

Di Package Detail tambahkan summary:

```text
Passport      20 / 20
KTP           19 / 20
KK            18 / 20
Vaksin        12 / 20
Buku Nikah     8 / 20
```

Klik angka membuka peserta terkait.

---

## 12. Participant Document Status

Di participant table tampilkan status ringkas:
- Complete
- Incomplete
- Passport Warning

Klik status membuka detail dokumen.

---

## 13. Payment Export

Tambahkan export finance:
- Per Package
- Per PIC
- Per Jamaah

Columns:
- Jamaah
- PIC
- Invoice
- Paid
- Outstanding
- Status

Support:
- XLSX
- CSV optional

---

## 14. Download Center

Optional tetapi direkomendasikan.

Setelah file dibuat, tampilkan:
- File Name
- Generated At
- Type
- Download

Tidak perlu background job kompleks jika belum diperlukan.

---

## 15. Template Tables

### manifest_templates
```text
id
name
template_file_url
field_mapping
created_at
updated_at
```

---

## 16. Definition of Done

Stage 3 selesai jika:
- Template manifest bisa disimpan
- Mapping kolom bisa dibuat
- Manifest otomatis dari database
- Preview manifest tersedia
- Validation warning tersedia
- Manifest bisa download XLSX
- Dokumen dapat dicari
- Dokumen per paket dapat download massal
- ZIP memiliki nama file rapi
- Laporan pembayaran dapat diexport
