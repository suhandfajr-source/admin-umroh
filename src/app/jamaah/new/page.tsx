'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Save, AlertCircle, MapPin } from 'lucide-react';
import { DuplicateResolutionModal } from '@/components/jamaah/DuplicateResolutionModal';
import { DuplicateMatchDetail } from '@/types/document.types';
import { composeKtpAddress, parseKtpAddress } from '@/lib/address-helpers';

export default function NewJamaahPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    identity_name: '',
    passport_name: '',
    passport_number: '',
    birth_place: '',
    birth_date: '',
    gender: 'MALE',
    passport_issue_place: '',
    passport_issue_date: '',
    passport_expiry_date: '',
    ktp_name: '',
    nik: '',
    kk_number: '',
    phone: '',
    address: '',
    notes: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatchDetail | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.identity_name && !formData.passport_name && !formData.ktp_name) {
      setError('Harap isi Nama Master atau Nama Paspor / KTP.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Run Duplicate Check
      const dupRes = await fetch('/api/jamaah/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: {
            identity_name: formData.identity_name || formData.passport_name || formData.ktp_name,
            passport_name: formData.passport_name,
            passport_number: formData.passport_number,
            ktp_name: formData.ktp_name,
            nik: formData.nik,
            kk_number: formData.kk_number,
            birth_date: formData.birth_date,
          },
        }),
      });

      const dupData = await dupRes.json();
      if (dupData.duplicate) {
        setDuplicateMatch(dupData.duplicate);
        setDuplicateModalOpen(true);
        setLoading(false);
        return;
      }

      // No duplicate, perform save
      await saveJamaah();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data');
      setLoading(false);
    }
  };

  const saveJamaah = async () => {
    const res = await fetch('/api/jamaah', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        identity_name: formData.identity_name || formData.passport_name || formData.ktp_name,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal membuat profil jamaah');
    }

    router.push(`/jamaah/${data.id}`);
  };

  const handleUpdateExisting = async () => {
    if (!duplicateMatch) return;
    setDuplicateModalOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/jamaah/${duplicateMatch.matched_jamaah_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        router.push(`/jamaah/${duplicateMatch.matched_jamaah_id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceCreateNew = async () => {
    setDuplicateModalOpen(false);
    setLoading(true);
    try {
      await saveJamaah();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="flex items-center gap-4">
        <Link
          href="/jamaah"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Registrasi Manual Jamaah</h1>
          <p className="text-xs text-slate-500">
            Form pendaftaran profil Master Jamaah secara manual (Field Paspor bersifat opsional jika belum ada).
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handlePreSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        {/* Master Identity Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Identitas Master Utama</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Lengkap Master (Neutral Person Name) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="identity_name"
              value={formData.identity_name}
              onChange={handleChange}
              placeholder="Contoh: Muhammad Ahmad"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              >
                <option value="MALE">Laki-Laki (Male)</option>
                <option value="FEMALE">Perempuan (Female)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tempat Lahir</label>
              <input
                type="text"
                name="birth_place"
                value={formData.birth_place}
                onChange={handleChange}
                placeholder="JAKARTA"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Lahir</label>
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Travel Identity (Passport) Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span>Identitas Paspor (Primary Travel Identity - Opsional jika belum ada)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Sesuai Paspor</label>
              <input
                type="text"
                name="passport_name"
                value={formData.passport_name}
                onChange={handleChange}
                placeholder="MUHAMMAD AHMAD"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Paspor</label>
              <input
                type="text"
                name="passport_number"
                value={formData.passport_number}
                onChange={handleChange}
                placeholder="E1234567"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tempat Diterbitkan</label>
              <input
                type="text"
                name="passport_issue_place"
                value={formData.passport_issue_place}
                onChange={handleChange}
                placeholder="KANTOR IMIGRASI"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Terbit</label>
              <input
                type="date"
                name="passport_issue_date"
                value={formData.passport_issue_date}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Kadaluarsa</label>
              <input
                type="date"
                name="passport_expiry_date"
                value={formData.passport_expiry_date}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Supporting Identity (KTP / KK / Contact) */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Identitas Pendukung (KTP, KK, Kontak & Domisili)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NIK (KTP)</label>
              <input
                type="text"
                name="nik"
                maxLength={16}
                value={formData.nik}
                onChange={handleChange}
                placeholder="16 digit NIK"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Kartu Keluarga (KK)</label>
              <input
                type="text"
                name="kk_number"
                maxLength={16}
                value={formData.kk_number}
                onChange={handleChange}
                placeholder="16 digit No. KK"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="0812xxxxxxxx"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Rincian Alamat KTP */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Rincian Alamat (Sesuai Kolom KTP)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-8">
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Jalan / Blok / No. Rumah</label>
                <input
                  type="text"
                  value={parseKtpAddress(formData.address).street}
                  onChange={(e) => {
                    const current = parseKtpAddress(formData.address);
                    current.street = e.target.value;
                    setFormData({ ...formData, address: composeKtpAddress(current) });
                  }}
                  placeholder="Contoh: Jl. Melati No. 12 / Kp. Kebon"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">RT / RW</label>
                <input
                  type="text"
                  value={parseKtpAddress(formData.address).rt_rw}
                  onChange={(e) => {
                    const current = parseKtpAddress(formData.address);
                    current.rt_rw = e.target.value;
                    setFormData({ ...formData, address: composeKtpAddress(current) });
                  }}
                  placeholder="000/000"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Kelurahan / Desa</label>
                <input
                  type="text"
                  value={parseKtpAddress(formData.address).kelurahan}
                  onChange={(e) => {
                    const current = parseKtpAddress(formData.address);
                    current.kelurahan = e.target.value;
                    setFormData({ ...formData, address: composeKtpAddress(current) });
                  }}
                  placeholder="Nama Kel/Desa"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Kecamatan</label>
                <input
                  type="text"
                  value={parseKtpAddress(formData.address).kecamatan}
                  onChange={(e) => {
                    const current = parseKtpAddress(formData.address);
                    current.kecamatan = e.target.value;
                    setFormData({ ...formData, address: composeKtpAddress(current) });
                  }}
                  placeholder="Nama Kecamatan"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Kota / Kabupaten</label>
                <input
                  type="text"
                  value={parseKtpAddress(formData.address).city}
                  onChange={(e) => {
                    const current = parseKtpAddress(formData.address);
                    current.city = e.target.value;
                    setFormData({ ...formData, address: composeKtpAddress(current) });
                  }}
                  placeholder="Kota / Kab"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Format Database Tersimpan:</span>
              <span className="text-slate-800 font-medium">{formData.address || '-'}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            href="/jamaah"
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Memvalidasi...' : 'Simpan Master Jamaah'}</span>
          </button>
        </div>
      </form>

      {/* Duplicate Resolution Modal */}
      {duplicateMatch && (
        <DuplicateResolutionModal
          isOpen={duplicateModalOpen}
          onClose={() => setDuplicateModalOpen(false)}
          matchDetail={duplicateMatch}
          newFields={formData}
          onUpdateExisting={handleUpdateExisting}
          onCreateNew={handleForceCreateNew}
        />
      )}
    </div>
  );
}
