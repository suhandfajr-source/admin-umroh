'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Package as PackageIcon, 
  PlusCircle, 
  Calendar, 
  Users, 
  Plane, 
  Hotel, 
  ArrowRight,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { Package, PackageStatus } from '@/types/database.types';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

export default function PackagesListPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    package_name: '',
    departure_date: '',
    return_date: '',
    b2b_price: 27500000,
    reference_price: 30000000,
    airline: 'Saudi Airlines',
    makkah_hotel: 'Pullman Zamzam Makkah',
    madinah_hotel: 'Dar Al Taqwa Madinah',
    schedule: 'Program 9 Hari',
    quota: 45,
    status: 'OPEN' as PackageStatus,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/packages');
      const data = await res.json();
      setPackages(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Gagal membuat paket');
      setCreateModalOpen(false);
      fetchPackages();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daftar Paket Keberangkatan</h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola jadwal paket umrah, harga B2B, maskapai, hotel, kuota, dan status keberangkatan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Buat Paket Umrah Baru</span>
        </button>
      </div>

      {/* Package Grid */}
      {loading ? (
        <LoadingSpinner label="Memuat paket keberangkatan..." />
      ) : packages.length === 0 ? (
        <EmptyState
          title="Belum Ada Paket Umrah"
          description="Buat paket keberangkatan pertama Anda untuk mulai mendaftarkan jamaah."
          action={
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Buat Paket Sekarang
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => {
            const quotaPercent = Math.min(100, Math.round(((pkg.participants_count || 0) / pkg.quota) * 100));

            return (
              <div
                key={pkg.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <div className="p-6 space-y-4">
                  {/* Top Status */}
                  <div className="flex items-center justify-between">
                    <Badge variant={pkg.status === 'OPEN' ? 'success' : pkg.status === 'FULL' ? 'warning' : 'neutral'}>
                      {pkg.status}
                    </Badge>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {pkg.schedule || 'Reguler'}
                    </span>
                  </div>

                  {/* Title & Dates */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                      {pkg.package_name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{pkg.departure_date} s/d {pkg.return_date}</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Plane className="w-3.5 h-3.5 text-sky-500" />
                      <span>{pkg.airline || 'Maskapai Belum Ditentukan'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hotel className="w-3.5 h-3.5 text-amber-500" />
                      <span className="truncate">{pkg.makkah_hotel || 'Hotel Makkah'}</span>
                    </div>
                  </div>

                  {/* Pricing Overview */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Harga B2B:</span>
                      <span className="font-mono font-bold text-slate-800">{formatRupiah(pkg.b2b_price)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Harga Referensi:</span>
                      <span className="font-mono font-bold text-emerald-800">{formatRupiah(pkg.reference_price)}</span>
                    </div>
                  </div>

                  {/* Quota Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Kuota Terisi:</span>
                      <span className="font-bold text-slate-800">
                        {pkg.participants_count || 0} / {pkg.quota} Peserta ({quotaPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${quotaPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <Link
                    href={`/paket/${pkg.id}`}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold transition-all"
                  >
                    Kelola Peserta
                  </Link>
                  <Link
                    href={`/paket/${pkg.id}/command-center`}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-2xs transition-all"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Command Center</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Package Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Buat Paket Umrah Baru"
        subtitle="Definisikan jadwal keberangkatan, harga acuan, dan kuota jamaah."
        maxWidth="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Paket Umrah <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.package_name}
              onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
              placeholder="Contoh: Umroh As Salam Awal Musim 1448 H"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Keberangkatan <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.departure_date}
                onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Kepulangan <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.return_date}
                onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Harga Dasar B2B (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                value={formData.b2b_price}
                onChange={(e) => setFormData({ ...formData, b2b_price: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Harga Referensi Jual (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                value={formData.reference_price}
                onChange={(e) => setFormData({ ...formData, reference_price: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-950 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Maskapai</label>
              <input
                type="text"
                value={formData.airline}
                onChange={(e) => setFormData({ ...formData, airline: e.target.value })}
                placeholder="Saudi / Garuda / Lion"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hotel Makkah</label>
              <input
                type="text"
                value={formData.makkah_hotel}
                onChange={(e) => setFormData({ ...formData, makkah_hotel: e.target.value })}
                placeholder="Nama Hotel Makkah"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hotel Madinah</label>
              <input
                type="text"
                value={formData.madinah_hotel}
                onChange={(e) => setFormData({ ...formData, madinah_hotel: e.target.value })}
                placeholder="Nama Hotel Madinah"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kuota Jamaah</label>
              <input
                type="number"
                value={formData.quota}
                onChange={(e) => setFormData({ ...formData, quota: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status Paket</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as PackageStatus })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              >
                <option value="OPEN">OPEN (Pendaftaran Dibuka)</option>
                <option value="DRAFT">DRAFT (Konsep)</option>
                <option value="FULL">FULL (Kuota Penuh)</option>
                <option value="DEPARTED">DEPARTED (Sudah Berangkat)</option>
                <option value="COMPLETED">COMPLETED (Selesai)</option>
                <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-900/20"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Paket Umrah'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
