# STAGE 2 — Finance Jamaah

## Objective
Tambahkan modul tagihan dan pembayaran jamaah tanpa merusak struktur Stage 1.

Sistem harus menangani:
- DP
- Cicilan
- Pelunasan
- Satu transfer untuk satu jamaah
- Satu transfer untuk banyak jamaah
- Pembayaran kolektif dari PIC
- Pembayaran yang belum diketahui pemiliknya

---

## 1. Navigation

Tambahkan:

```text
Finance Jamaah
├── Tagihan
├── Pembayaran
├── Alokasi Pembayaran
└── Payment Inbox
```

---

## 2. Prinsip Finance

Pisahkan:

### Payment
Transaksi uang yang masuk.

### Payment Allocation
Pembagian transaksi tersebut ke tagihan jamaah.

Contoh:
```text
Transfer PIC = Rp100.000.000

Allocation:
Ahmad   = Rp30.000.000
Budi    = Rp25.000.000
Hasan   = Rp20.000.000
Fatimah = Rp25.000.000
```

Jangan membuat empat transaksi bank.

Tetap satu `payment`, empat `payment_allocations`.

---

## 3. Invoice / Tagihan

Invoice otomatis dibuat ketika jamaah menjadi package participant.

Base amount:
```text
selling_price
```

Tambahkan item optional:
- Upgrade kamar
- Bagasi
- Handling
- Perlengkapan
- Visa
- Additional Charge
- Discount
- Adjustment

Formula:
```text
Total Invoice =
Selling Price
+ Additional Charges
- Discounts
```

---

## 4. Invoice Fields

```text
id
package_participant_id
base_amount
additional_amount
discount_amount
total_amount
status
created_at
updated_at
```

Status:
```text
UNPAID
PARTIAL
PAID
OVERPAID
```

Status dihitung otomatis.

Jangan dibuat sebagai field manual.

---

## 5. Invoice Items

```text
id
invoice_id
type
description
amount
created_at
```

Type:
```text
CHARGE
DISCOUNT
ADJUSTMENT
```

---

## 6. Payment Input

Fields:
- Tanggal Pembayaran
- Nominal
- Nama Pengirim
- Bank Pengirim optional
- Paket optional
- PIC optional
- Catatan
- Bukti Transfer

Setelah save, admin memilih:

```text
Pembayaran untuk:
○ Satu Jamaah
○ Beberapa Jamaah
○ PIC
○ Belum Diketahui
```

---

## 7. Payment Inbox

Jika belum diketahui pemiliknya, simpan payment tanpa allocation.

Status:
```text
UNALLOCATED
PARTIALLY_ALLOCATED
ALLOCATED
CANCELLED
```

Columns:
- Date
- Sender
- Amount
- Allocated
- Remaining
- Proof
- Status

Action:
- Allocate
- Edit
- View Proof
- Cancel

---

## 8. Payment Allocation

Fields:
```text
id
payment_id
invoice_id
package_participant_id
amount
created_at
```

Rule:
```text
SUM(payment_allocations.amount)
<= payment.amount
```

Jangan izinkan allocation melebihi nilai transaksi.

Tampilkan:
- Total Payment
- Already Allocated
- Remaining to Allocate

---

## 9. PIC Collective Payment

Jika admin memilih PIC:

Tampilkan seluruh jamaah PIC dalam paket terkait.

Columns:
- Jamaah
- Invoice
- Paid
- Outstanding
- Allocation Input

Admin dapat:
- Isi manual
- Auto distribute

Auto distribute optional:
- Urut berdasarkan jamaah
- Maksimal sampai outstanding masing-masing

Admin harus tetap review sebelum confirm.

---

## 10. Payment Status Per Jamaah

Hitung otomatis:

```text
Paid = SUM(payment_allocations.amount)
Outstanding = Invoice Total - Paid
```

Status:
```text
UNPAID: Paid = 0
PARTIAL: 0 < Paid < Invoice
PAID: Paid = Invoice
OVERPAID: Paid > Invoice
```

---

## 11. Jamaah Detail

Tambahkan tab Finance.

Display:
- Total Invoice
- Total Paid
- Outstanding
- Status

History:
- Date
- Payment Amount
- Allocation Amount
- Sender
- Proof

---

## 12. Package Detail Finance Summary

Tambahkan:
- Total Tagihan
- Total Dibayar
- Total Outstanding
- Jumlah Jamaah Lunas
- Jumlah Jamaah Belum Lunas
- Unallocated Payments

---

## 13. PIC Detail Finance

Display:
- Total Jamaah
- Total Invoice
- Total Paid
- Outstanding

Table:
- Jamaah
- Selling Price
- Total Invoice
- Paid
- Outstanding
- Status

---

## 14. Bukti Transfer

Bukti transfer harus:
- Disimpan
- Bisa preview
- Bisa download
- Tidak hilang setelah allocation

Satu bukti transfer terkait ke `payment`, bukan ke setiap jamaah.

---

## 15. Adjustment

Admin boleh menambah:
- Charge
- Discount
- Manual Adjustment

Semua adjustment harus memiliki description.

Contoh:
```text
Single Room + Rp4.000.000
Discount PIC - Rp1.000.000
```

---

## 16. Finance Tables

### invoices
```text
id
package_participant_id
base_amount
additional_amount
discount_amount
total_amount
status
created_at
updated_at
```

### invoice_items
```text
id
invoice_id
type
description
amount
created_at
```

### payments
```text
id
payment_date
amount
sender_name
sender_bank
package_id
pic_id
proof_file_url
notes
allocation_status
created_at
updated_at
```

### payment_allocations
```text
id
payment_id
invoice_id
package_participant_id
amount
created_at
```

---

## 17. Definition of Done

Stage 2 selesai jika:
- Invoice otomatis dibuat dari selling price
- Admin dapat input payment manual
- Bukti transfer bisa upload
- Payment bisa dialokasikan ke satu jamaah
- Payment bisa dialokasikan ke banyak jamaah
- Pembayaran PIC kolektif bekerja
- Payment Inbox bekerja
- Outstanding otomatis dihitung
- Status pembayaran otomatis
- Data Stage 1 tetap berjalan normal
