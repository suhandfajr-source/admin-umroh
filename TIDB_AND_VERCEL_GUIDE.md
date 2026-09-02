# Panduan Lengkap: Integrasi TiDB Cloud (Serverless MySQL) & Deployment Vercel

Panduan ini berisi langkah praktis langkah demi langkah untuk menghubungkan aplikasi **Admin Jamaah Umroh** ke database **TiDB Cloud (Serverless MySQL)** dan melakukan deployment ke **Vercel**.

---

## Langkah 1: Buat Database Gratis di TiDB Cloud

1. Buka website **[https://tidbcloud.com](https://tidbcloud.com)** dan login menggunakan akun Google atau GitHub Anda.
2. Klik tombol **Create Cluster** lalu pilih paket **Serverless (Free - $0/bulan)**:
   - **Cluster Name**: `umroh-admin-db`
   - **Cloud Provider**: AWS
   - **Region**: `Singapore (ap-southeast-1)` *(Pilih region terdekat untuk latensi tercepat)*
3. Klik **Create**.
4. Setelah cluster aktif, buat password database (simpan password tersebut dengan aman).
5. Pada panel **Connect**, pilih metode koneksi **General** atau **Node.js / MySQL CLI**, lalu salin **Connection String**:
   ```text
   mysql://<USERNAME>:<PASSWORD>@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/umroh_admin_db?ssl={"rejectUnauthorized":true}
   ```

---

## Langkah 2: Jalankan Migrasi Skema Tabel ke TiDB

Di komputer lokal Anda, cukup jalankan perintah satu baris berikut untuk membuat seluruh 17 tabel operasional di cluster TiDB:

```bash
DATABASE_URL="mysql://<USERNAME>:<PASSWORD>@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/umroh_admin_db?ssl={\"rejectUnauthorized\":true}" npm run migrate:tidb
```

> **Hasil:** Script akan otomatis membaca file `tidb/schema.sql` dan membuat seluruh tabel master jamaah, paket, invoice, pembayaran, perlengkapan, dan log audit di TiDB Cloud.

---

## Langkah 3: Konfigurasi Lokal (`.env.local`)

Tambahkan connection string ke file `.env.local` Anda agar saat dijalankan di komputer lokal, aplikasi terhubung langsung ke TiDB Cloud:

```env
DATABASE_URL="mysql://<USERNAME>:<PASSWORD>@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/umroh_admin_db?ssl={\"rejectUnauthorized\":true}"
NEXT_PUBLIC_APP_URL="http://localhost:3005"
```

---

## Langkah 4: Deployment ke Vercel

1. Push seluruh project Anda ke repository **GitHub** (misal: `github.com/username/admin-umroh`).
2. Buka **[https://vercel.com](https://vercel.com)** dan login.
3. Klik **Add New...** -> **Project**, lalu pilih repository GitHub project Anda.
4. Pada bagian **Environment Variables**, tambahkan:
   - **Name**: `DATABASE_URL`
   - **Value**: `mysql://<USERNAME>:<PASSWORD>@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/umroh_admin_db?ssl={"rejectUnauthorized":true}`
5. Klik tombol **Deploy**!
6. Dalam 1-2 menit, aplikasi Anda sudah online 24 jam di domain Vercel (misal: `https://admin-umroh.vercel.app`).

---

## Keuntungan Kombinasi Ini:
- 🚀 **Online 24 Jam**: Tidak perlu komputer kantor menyala terus.
- 💾 **Kapasitas Gratis 5 GB**: TiDB Serverless menyediakan 5GB storage gratis selamanya.
- 🔒 **Aman & Terenkripsi**: Koneksi Vercel ke TiDB dilindungi enkripsi SSL/TLS v1.2.
- 📱 **Multi-Device**: Admin bisa buka dari laptop kantor, laptop rumah, maupun smartphone.
