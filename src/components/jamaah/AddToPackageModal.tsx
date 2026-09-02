'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Jamaah, Package, PIC } from '@/types/database.types';
import { Package as PackageIcon, UserCheck, AlertCircle } from 'lucide-react';

interface AddToPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  jamaah: Jamaah;
  onSuccess: () => void;
}

export const AddToPackageModal: React.FC<AddToPackageModalProps> = ({
  isOpen,
  onClose,
  jamaah,
  onSuccess,
}) => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [pics, setPics] = useState<PIC[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedPicId, setSelectedPicId] = useState('');
  const [b2bPrice, setB2bPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      // Fetch packages and PICs
      Promise.all([
        fetch('/api/packages').then(r => r.json()),
        fetch('/api/pics').then(r => r.json()),
      ]).then(([pkgData, picData]) => {
        setPackages(pkgData || []);
        setPics(picData || []);
        if (pkgData && pkgData.length > 0) {
          const first = pkgData[0];
          setSelectedPackageId(first.id);
          setB2bPrice(first.b2b_price);
          setSellingPrice(first.reference_price);
        }
      });
    }
  }, [isOpen]);

  const handlePackageChange = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    const found = packages.find(p => p.id === pkgId);
    if (found) {
      setB2bPrice(found.b2b_price);
      setSellingPrice(found.reference_price);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageId) {
      setError('Silakan pilih paket.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPackageId,
          jamaah_id: jamaah.id,
          pic_id: selectedPicId || null,
          b2b_price: b2bPrice,
          selling_price: sellingPrice,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menambahkan peserta ke paket');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambahkan Jamaah ke Paket Umrah"
      subtitle={`Daftarkan ${jamaah.identity_name || jamaah.passport_name} ke dalam keberangkatan perjalanan.`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Package Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Pilih Paket Keberangkatan <span className="text-rose-500">*</span>
          </label>
          <select
            value={selectedPackageId}
            onChange={(e) => handlePackageChange(e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="">-- Pilih Paket --</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.package_name} (Berangkat: {pkg.departure_date}) - Kuota: {pkg.quota}
              </option>
            ))}
          </select>
        </div>

        {/* PIC Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            PIC / Mitra Penanggung Jawab (Opsional)
          </label>
          <select
            value={selectedPicId}
            onChange={(e) => setSelectedPicId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="">-- Tanpa PIC / Langsung Travel --</option>
            {pics.map((pic) => (
              <option key={pic.id} value={pic.id}>
                {pic.name} {pic.phone ? `(${pic.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Price Inputs */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Harga B2B Paket (Rp)
            </label>
            <input
              type="number"
              value={b2bPrice}
              onChange={(e) => setB2bPrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">{formatRupiah(b2bPrice)}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Harga Jual Jamaah (Rp) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              required
              className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-mono font-bold text-emerald-950 focus:outline-hidden focus:border-emerald-500"
            />
            <span className="text-[10px] text-emerald-600 mt-0.5 block font-semibold">{formatRupiah(sellingPrice)}</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Perjalanan (Opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Contoh: Permintaan kamar khusus, upgrade room, dll."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
          />
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-900/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <UserCheck className="w-4 h-4" />
            <span>{submitting ? 'Menyimpan...' : 'Daftarkan Peserta'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
