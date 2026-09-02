# STAGE 1 — Core Database & Document Intelligence

## Objective
Bangun pondasi utama aplikasi Admin Jamaah Umrah.

Stage ini harus menghasilkan sistem yang sudah bisa:
- Menyimpan master jamaah
- Upload dokumen
- Mengenali jenis dokumen
- Mengekstrak data
- Review hasil ekstraksi
- Mencegah duplicate jamaah
- Membuat paket keberangkatan
- Menghubungkan jamaah ke paket
- Mengelola PIC

---

## 1. Navigation
Gunakan sidebar:

```text
Dashboard

Jamaah
├── Database Jamaah
├── Upload Dokumen
└── Review Dokumen

Paket
├── Daftar Paket
└── Peserta Paket

PIC

Pengaturan
```

---

## 2. UI / UX
Gunakan tampilan:
- Modern
- Clean
- Spacious
- Professional
- Data-oriented
- Desktop-first
- Responsive

Gunakan:
- Sidebar
- Data table
- Badge status
- Drawer / modal untuk quick action
- Search global di navbar
- Empty state yang jelas
- Loading state
- Confirmation dialog

Hindari:
- Grafik berlebihan
- Card terlalu banyak
- UI dekoratif yang tidak membantu pekerjaan admin

---

## 3. Master Jamaah

### Required Fields
- `id`
- `passport_name`
- `passport_number`
- `birth_place`
- `birth_date`
- `passport_issue_place`
- `passport_issue_date`
- `passport_expiry_date`

### Optional Fields
- `ktp_name`
- `nik`
- `kk_number`
- `gender`
- `phone`
- `address`
- `notes`

### Business Rule
Data Paspor adalah data utama untuk kebutuhan perjalanan.

Jika data KTP dan Paspor berbeda:
- Jangan overwrite otomatis
- Simpan keduanya
- Manifest menggunakan data Paspor

---

## 4. Database Jamaah Page

Columns:
- Nama Paspor
- Nomor Paspor
- Tempat / Tanggal Lahir
- Nomor HP
- Paket Aktif
- PIC
- Status Dokumen
- Action

Search:
- Nama
- Nomor Paspor
- NIK
- Nomor KK
- No. HP

Filter:
- Paket
- PIC
- Kelengkapan Dokumen
- Status Paspor

Action:
- View
- Edit
- Upload Document
- Add to Package

---

## 5. Detail Jamaah

Gunakan tab:

### Identity
Data jamaah lengkap.

### Documents
- Paspor
- KTP
- KK
- Vaksin
- Buku Nikah

### Trips
Riwayat seluruh perjalanan jamaah.

Contoh:
```text
2026 — Umroh As Salam
2028 — Umroh Syawal
```

Satu orang hanya memiliki satu Master Jamaah.

---

## 6. Smart Document Upload

Supported:
- JPG
- JPEG
- PNG
- PDF

Admin dapat:
- Upload satu file
- Upload banyak file
- Drag & drop

Jenis dokumen:
- Passport
- KTP
- KK
- Vaksin
- Buku Nikah

Sistem harus mencoba mengklasifikasikan jenis dokumen otomatis.

Admin tetap dapat mengganti hasil klasifikasi.

---

## 7. Passport Extraction

Paspor adalah prioritas utama.

Extract:
- Full Name
- Passport Number
- Place of Birth
- Date of Birth
- Sex
- Place of Issue
- Date of Issue
- Date of Expiry

Jika memungkinkan gunakan MRZ sebagai validasi tambahan.

---

## 8. KTP Extraction

Extract:
- NIK
- Nama
- Tempat Lahir
- Tanggal Lahir
- Jenis Kelamin
- Alamat

Data KTP adalah data pendukung.

---

## 9. KK Extraction

Sistem harus dapat mendeteksi beberapa anggota keluarga dalam satu KK.

Flow:
```text
Upload KK
↓
Extract seluruh anggota keluarga
↓
Tampilkan daftar anggota
↓
Admin pilih siapa yang menjadi jamaah
```

Jangan otomatis membuat seluruh anggota KK sebagai jamaah.

---

## 10. Vaksin & Buku Nikah

Untuk Stage 1:
- Identifikasi jenis dokumen
- Simpan file
- Hubungkan ke jamaah

Ekstraksi data detail belum wajib.

---

## 11. Document Review

Tidak ada hasil OCR / extraction yang langsung disimpan menjadi data final tanpa review admin.

Flow:
```text
Upload
↓
Processing
↓
Classification
↓
Extraction
↓
Needs Review
↓
Admin Confirmation
↓
Save
```

Review Screen:
- Kiri: preview dokumen
- Kanan: field hasil ekstraksi
- Semua field editable

Action:
- Confirm
- Edit
- Change Document Type
- Link to Existing Jamaah
- Create New Jamaah
- Reject

---

## 12. Document Status

Gunakan status:
```text
UPLOADED
PROCESSING
NEEDS_REVIEW
CONFIRMED
FAILED
```

Jika gagal:
- Retry
- Manual Input
- Re-upload

Dokumen tidak boleh hilang saat OCR gagal.

---

## 13. Duplicate Detection

Prioritas matching:
1. Passport Number
2. NIK
3. Nama + Tanggal Lahir
4. Nomor KK + Nama

Jika kemungkinan duplicate ditemukan:
- Tampilkan data existing
- Tampilkan data baru
- Jangan otomatis create

Action:
- Update Existing Jamaah
- Create New Jamaah
- Cancel

---

## 14. Document History

Jangan overwrite dokumen lama secara permanen.

Contoh:
```text
Passport Lama — Archived
Passport Baru — Current
```

Fields:
- `is_current`
- `uploaded_at`
- `confirmed_at`

---

## 15. Paket Keberangkatan

Fields:
- Package ID
- Nama Paket
- Tanggal Keberangkatan
- Tanggal Kepulangan
- Harga B2B
- Harga Referensi
- Maskapai
- Hotel Makkah
- Hotel Madinah
- Jadwal / Catatan
- Kuota
- Status

Status:
```text
DRAFT
OPEN
FULL
DEPARTED
COMPLETED
CANCELLED
```

---

## 16. Package Participant

Jangan simpan paket langsung di master jamaah.

Gunakan entity:
`package_participants`

Relationship:
```text
jamaah
  ↓
package_participants
  ↓
packages
```

Fields:
- package_id
- jamaah_id
- pic_id
- b2b_price
- selling_price
- participant_status
- notes

Constraint:
```text
UNIQUE(package_id, jamaah_id)
```

---

## 17. Harga

Package memiliki:
- Default B2B Price
- Reference Price

Setiap participant memiliki:
- B2B Price
- Selling Price

Selling Price boleh berbeda antar jamaah.

---

## 18. PIC

PIC bukan user.

Fields:
- id
- name
- phone
- notes

Satu PIC dapat memiliki banyak jamaah.

PIC dapat terkait ke jamaah melalui `package_participants`.

---

## 19. Participant Page

Columns:
- Jamaah
- Passport Number
- PIC
- Selling Price
- Document Status
- Participant Status
- Action

Filter:
- PIC
- Document Status

Search:
- Nama
- Passport Number

---

## 20. Passport Warning

Tampilkan warning jika:
- Paspor belum ada
- Paspor expired
- Paspor akan expired
- Data paspor tidak lengkap

Jika jamaah sudah masuk paket, gunakan tanggal keberangkatan sebagai referensi warning.

---

## 21. Global Search

Navbar harus memiliki global search.

Search:
- Jamaah
- Passport Number
- NIK
- PIC
- Package

Hasil dapat langsung membuka detail data.

---

## 22. Database Minimum

```text
users
jamaah
documents
document_extractions
packages
package_participants
pics
```

### jamaah
```text
id
passport_name
passport_number
birth_place
birth_date
gender
passport_issue_place
passport_issue_date
passport_expiry_date
ktp_name
nik
kk_number
phone
address
notes
created_at
updated_at
```

### documents
```text
id
jamaah_id
document_type
file_url
file_name
status
is_current
uploaded_at
confirmed_at
created_at
updated_at
```

### document_extractions
```text
id
document_id
raw_extraction
extracted_fields
classification_result
review_status
created_at
updated_at
```

### packages
```text
id
package_name
departure_date
return_date
b2b_price
reference_price
airline
makkah_hotel
madinah_hotel
schedule
quota
status
created_at
updated_at
```

### package_participants
```text
id
package_id
jamaah_id
pic_id
b2b_price
selling_price
participant_status
notes
created_at
updated_at
```

### pics
```text
id
name
phone
notes
created_at
updated_at
```

---

## 23. Definition of Done

Stage 1 dianggap selesai ketika:
- Jamaah bisa dibuat dari upload dokumen
- Hasil extraction bisa direview
- Paspor otomatis mengisi data inti
- Duplicate detection berjalan
- Satu jamaah bisa ikut banyak paket
- Paket dapat dibuat
- PIC dapat dibuat
- Jamaah dapat dimasukkan ke paket
- Selling price per jamaah dapat berbeda
- Dokumen tersimpan dan dapat dicari kembali
- Search global berjalan
- Tidak ada data dummy yang menggantikan data real
