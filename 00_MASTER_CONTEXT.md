# MASTER CONTEXT — Sistem Admin Jamaah Umrah

## Tujuan Produk
Membangun aplikasi web internal khusus Admin Travel Umrah untuk mengelola seluruh data jamaah secara terpusat dan mengurangi pekerjaan manual berulang.

Prinsip utama:

> **Input Once, Use Everywhere**

Data yang sudah dimasukkan atau dibaca dari dokumen tidak boleh perlu diketik ulang pada modul lain.

## Masalah Utama yang Ingin Diselesaikan
1. Input data jamaah manual berulang-ulang.
2. Data tersebar di WhatsApp dan Excel.
3. Manifest harus diperbarui berkali-kali.
4. Dokumen lama sulit dicari.
5. Pembayaran sering tidak jelas milik jamaah siapa.
6. Satu PIC dapat membawa banyak jamaah.
7. Satu transfer dapat digunakan untuk pembayaran beberapa jamaah.
8. Jamaah dapat berangkat Umrah berkali-kali dan harus tetap menggunakan satu master profile.

## User
Untuk versi awal, aplikasi hanya digunakan oleh:

- Admin

Tidak perlu portal jamaah, portal agen, portal PIC, atau multi-role permission pada tahap awal.

## Core Flow
```text
Upload Dokumen
    ↓
Document Classification
    ↓
Data Extraction
    ↓
Review Hasil
    ↓
Master Jamaah
    ↓
Masuk Paket
    ↓
PIC
    ↓
Tagihan
    ↓
Pembayaran
    ↓
Manifest / Dokumen / Perlengkapan
```

## Jenis Dokumen
- Paspor
- KTP
- KK
- Sertifikat Vaksin
- Buku Nikah

## Sumber Data Utama
Untuk kebutuhan perjalanan dan manifest:

> **Data Paspor menjadi sumber kebenaran utama.**

Jika nama KTP berbeda dengan nama Paspor, keduanya boleh disimpan, tetapi Nama Paspor digunakan untuk manifest.

## Data Minimal Jamaah
- Nama Paspor
- Nomor Paspor
- Tempat Lahir
- Tanggal Lahir
- Tempat Terbit Paspor
- Tanggal Terbit Paspor
- Tanggal Kadaluarsa Paspor

Data pendukung:
- Nama KTP
- NIK
- Nomor KK
- Jenis Kelamin
- No. HP
- Alamat

## Paket
Minimal menyimpan:
- Nama Paket
- Tanggal Keberangkatan
- Tanggal Kepulangan
- Harga B2B
- Harga Referensi
- Maskapai
- Hotel Makkah
- Hotel Madinah
- Jadwal
- Kuota

## Harga
Satu paket memiliki Harga B2B.

Setiap jamaah dapat memiliki harga jual yang berbeda karena ditentukan oleh PIC.

Contoh:
```text
Harga B2B Paket = Rp27.500.000

Ahmad = Rp30.000.000
Budi  = Rp31.000.000
Hasan = Rp29.500.000
```

## PIC
PIC bukan user aplikasi.

PIC adalah pihak yang membawa atau mengelola sekelompok jamaah.

Satu PIC dapat:
- Memiliki banyak jamaah
- Memiliki jamaah pada lebih dari satu paket
- Melakukan pembayaran kolektif

## Prinsip Master Jamaah
Jamaah tidak boleh dibuat ulang setiap mengikuti perjalanan baru.

```text
MASTER JAMAAH
Muhammad Ahmad
    ├── Umrah 2026
    ├── Umrah 2028
    └── Umrah 2030
```

Gunakan relasi `package_participants` untuk menghubungkan jamaah dengan paket.

## Tahapan Pengembangan
1. Stage 1 — Core Database & Document Intelligence
2. Stage 2 — Finance Jamaah
3. Stage 3 — Manifest, Dokumen & Export
4. Stage 4 — Perlengkapan Jamaah
5. Stage 5 — Dashboard Intelligence & Automation

Kerjakan stage secara berurutan.

Jangan merusak fitur stage sebelumnya ketika membangun stage berikutnya.
