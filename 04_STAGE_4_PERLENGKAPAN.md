# STAGE 4 — Perlengkapan Jamaah

## Objective
Tambahkan modul sederhana untuk monitoring perlengkapan jamaah tanpa membuat input terlalu berat.

Detail perlengkapan bersifat optional.

---

## 1. Navigation

Tambahkan:

```text
Perlengkapan
├── Checklist Jamaah
├── Serah Terima
└── Pengaturan Item
```

---

## 2. Prinsip

Admin harus bisa menggunakan modul hanya dengan status sederhana.

Tidak wajib mengisi seluruh item.

Default flow:
```text
Belum Diproses
↓
Disiapkan
↓
Siap Diambil
↓
Sudah Diambil
```

---

## 3. Equipment Status

Gunakan:
```text
NOT_STARTED
PREPARING
READY
COLLECTED
```

---

## 4. Package Equipment Page

Filter by package.

Columns:
- Jamaah
- PIC
- Gender
- Clothing Size
- Status
- Collected At
- Action

Filter:
- PIC
- Status
- Clothing Size

Search:
- Jamaah
- Passport Number

---

## 5. Equipment Detail

Optional fields:
- Ukuran Baju
- Koper
- Tas Selempang
- Kain Ihram
- Mukena
- Buku Panduan
- ID Card
- Item Custom

Jangan jadikan seluruh field mandatory.

---

## 6. Item Configuration

Admin dapat membuat daftar item default.

Fields:
- Item Name
- Category
- Default Quantity
- Gender Rule optional
- Active

Contoh:
```text
Koper — 1
Tas Selempang — 1
Kain Ihram — Male
Mukena — Female
Buku Panduan — 1
ID Card — 1
```

---

## 7. Participant Equipment

Setiap participant dapat memiliki checklist item.

Status item:
```text
PENDING
READY
DELIVERED
NOT_REQUIRED
```

---

## 8. Bulk Action

Admin dapat pilih banyak jamaah.

Action:
- Mark Preparing
- Mark Ready
- Mark Collected
- Set Clothing Size
- Generate Checklist Export

---

## 9. Serah Terima

Saat status menjadi `COLLECTED`, optional capture:
- Collected At
- Received By
- Notes

Tidak perlu tanda tangan digital pada versi awal.

---

## 10. Jamaah Detail

Tambahkan tab Perlengkapan.

Tampilkan:
- Overall Status
- Clothing Size
- Item Checklist
- Collected At

---

## 11. Package Summary

Tambahkan:
```text
Not Started
Preparing
Ready
Collected
```

Contoh:
```text
Collected 18 / 25
```

---

## 12. Equipment Tables

### equipment_items
```text
id
name
category
default_quantity
gender_rule
is_active
created_at
updated_at
```

### participant_equipment
```text
id
package_participant_id
overall_status
clothing_size
collected_at
received_by
notes
created_at
updated_at
```

### participant_equipment_items
```text
id
participant_equipment_id
equipment_item_id
quantity
status
notes
created_at
updated_at
```

---

## 13. Definition of Done

Stage 4 selesai jika:
- Perlengkapan dapat dimonitor per package
- Status dapat diubah
- Detail item optional
- Size dapat disimpan
- Bulk action bekerja
- Serah terima dapat dicatat
- Jamaah detail menampilkan perlengkapan
- Package summary menampilkan progress
