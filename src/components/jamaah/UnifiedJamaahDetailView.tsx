'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  User, 
  FileText, 
  Plane, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  ExternalLink,
  Receipt,
  CreditCard,
  Eye,
  Edit3,
  Save,
  X,
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { PassportRecommendationModal } from '@/components/documents/PassportRecommendationModal';
import { formatRupiah, parseRupiahInput } from '@/lib/currency';
import { formatJamaahDisplayId } from '@/lib/display-helpers';
import { composeKtpAddress, parseKtpAddress } from '@/lib/address-helpers';

interface UnifiedJamaahDetailViewProps {
  jamaahId: string;
  onClose?: () => void;
  isModal?: boolean;
}

export const UnifiedJamaahDetailView: React.FC<UnifiedJamaahDetailViewProps> = ({
  jamaahId,
  onClose,
  isModal = false,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'identity' | 'manifest' | 'documents' | 'payment'>('identity');
  
  // Passport Recommendation Modal
  const [showPassportRecModal, setShowPassportRecModal] = useState(false);

  // Document Preview Modal
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loadingDocUrl, setLoadingDocUrl] = useState(false);

  // Edit Mode for Data Jamaah
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Input Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payType, setPayType] = useState('CICILAN');
  const [payMethod, setPayMethod] = useState('TRANSFER');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');
  const [selectedTripId, setSelectedTripId] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  const fetchJamaahData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/jamaah/${jamaahId}`);
      if (!res.ok) throw new Error('Gagal memuat profil jamaah');
      const json = await res.json();
      setData(json);
      setEditForm({
        identity_name: json.identity_name || '',
        ktp_name: json.ktp_name || '',
        passport_name: json.passport_name || '',
        nik: json.nik || '',
        kk_number: json.kk_number || '',
        phone: json.phone || '',
        gender: json.gender || 'MALE',
        birth_place: json.birth_place || '',
        birth_date: json.birth_date || '',
        address: json.address || '',
        relationship: json.relationship || '',
        marital_status: json.marital_status || '',
        passport_number: json.passport_number || '',
        passport_issue_place: json.passport_issue_place || '',
        passport_issue_date: json.passport_issue_date || '',
        passport_expiry_date: json.passport_expiry_date || '',
      });
      if (json.trips && json.trips.length > 0) {
        setSelectedTripId(json.trips[0].id);
      }
    } catch (err) {
      console.error('Error fetching jamaah data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jamaahId) fetchJamaahData();
  }, [jamaahId]);

  const handleSaveData = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch(`/api/jamaah/${jamaahId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Gagal menyimpan perubahan');
      await fetchJamaahData();
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDocPreview = async (doc: any) => {
    setPreviewDoc(doc);
    setLoadingDocUrl(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/signed-url`);
      const json = await res.json();
      if (json.signed_url) {
        setPreviewUrl(json.signed_url);
      } else {
        setPreviewUrl(`/api/documents/file?path=${encodeURIComponent(doc.storage_path)}`);
      }
    } catch {
      setPreviewUrl(`/api/documents/file?path=${encodeURIComponent(doc.storage_path)}`);
    } finally {
      setLoadingDocUrl(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseRupiahInput(payAmount);
    if (numAmount <= 0) {
      alert('Masukkan nominal pembayaran yang valid');
      return;
    }

    try {
      setSubmittingPay(true);
      const tripId = selectedTripId || (data?.trips && data.trips.length > 0 ? data.trips[0].id : undefined);
      const trip = data?.trips?.find((t: any) => t.id === tripId);

      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          payment_date: payDate,
          payment_type: payType,
          payment_method: payMethod,
          sender_name: data?.identity_name || data?.passport_name || 'Jamaah',
          notes: payNotes,
          package_participant_id: tripId,
          package_id: trip?.package_id || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal mencatat pembayaran');
      }

      setShowPayModal(false);
      setPayAmount('');
      setPayNotes('');
      await fetchJamaahData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pembayaran');
    } finally {
      setSubmittingPay(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Memuat detail data jamaah..." fullScreen={!isModal} />;
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="font-bold text-slate-700">Data Jamaah Tidak Ditemukan</p>
        <p className="text-xs mt-1">Record jamaah ID {jamaahId} tidak tersedia.</p>
      </div>
    );
  }

  // Documents Lookup
  const docsList: any[] = data.documents || [];
  const docPaspor = docsList.find(d => d.document_type === 'PASSPORT');
  const docKtp = docsList.find(d => d.document_type === 'KTP');
  const docKk = docsList.find(d => d.document_type === 'KK');
  const docVaksin = docsList.find(d => d.document_type === 'VAKSIN');
  const docNikah = docsList.find(d => d.document_type === 'BUKU_NIKAH');

  const coreDocs = [
    { type: 'PASPOR', label: 'Paspor', doc: docPaspor, key: 'PASSPORT' },
    { type: 'KTP', label: 'KTP', doc: docKtp, key: 'KTP' },
    { type: 'KK', label: 'Kartu Keluarga', doc: docKk, key: 'KK' },
    { type: 'VAKSIN', label: 'Sertifikat Vaksin', doc: docVaksin, key: 'VAKSIN' },
    { type: 'BUKU_NIKAH', label: 'Buku Nikah', doc: docNikah, key: 'BUKU_NIKAH' },
  ];

  const fin = data.finance_summary || { total_tagihan: 0, total_paid: 0, total_outstanding: 0, status: 'NO_TRIP' };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {data.passport_name || data.identity_name || data.ktp_name}
            </h1>
            <Badge variant="neutral">ID: {formatJamaahDisplayId(data)}</Badge>
            {data.passport_number && (
              <Badge variant="info">Paspor: {data.passport_number}</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            NIK: {data.nik || '-'} • No. HP: {data.phone || '-'} • Keberangkatan Terdaftar: {data.trips?.length || 0} Program
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPassportRecModal(true)}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all"
            title="Cetak Surat Rekomendasi Pembuatan/Perpanjangan Paspor"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>Rekomendasi Paspor</span>
          </button>
          <Link
            href={`/jamaah/upload?jamaah_id=${data.id}`}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Dokumen</span>
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Canonical Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('identity')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'identity'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>DATA JAMAAH</span>
        </button>

        <button
          onClick={() => setActiveTab('manifest')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'manifest'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Plane className="w-4 h-4" />
          <span>MANIFEST</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'documents'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>DOKUMEN ({docsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payment')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'payment'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>PEMBAYARAN</span>
        </button>
      </div>

      {/* TAB 1: DATA JAMAAH */}
      {activeTab === 'identity' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Informasi Identitas & Kontak</h3>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-1.5 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Data</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                <span>Batal</span>
              </button>
            )}
          </div>

          {!isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-xs">
              <div>
                <p className="text-slate-400 font-medium">ID Jamaah</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{data.id}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">No. HP / WhatsApp</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{data.phone || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Nama Sesuai KTP</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{data.ktp_name || data.identity_name || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Nama Sesuai Paspor</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{data.passport_name || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">NIK (16 Digit)</p>
                <p className="font-bold text-slate-800 font-mono text-sm mt-0.5">{data.nik || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">No. Kartu Keluarga (KK)</p>
                <p className="font-bold text-slate-800 font-mono text-sm mt-0.5">{data.kk_number || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Jenis Kelamin</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {data.gender === 'MALE' ? 'Laki-Laki (M)' : data.gender === 'FEMALE' ? 'Perempuan (F)' : '-'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Tempat, Tanggal Lahir</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {data.birth_place || '-'}, {data.birth_date || '-'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Hubungan / Mahram</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{data.relationship || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Status Pernikahan</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{data.marital_status || '-'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-slate-400 font-medium">Alamat Lengkap</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{data.address || '-'}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveData} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700">Nama Sesuai KTP *</label>
                  <input
                    type="text"
                    required
                    value={editForm.ktp_name || editForm.identity_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, ktp_name: e.target.value, identity_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Nama Sesuai Paspor</label>
                  <input
                    type="text"
                    value={editForm.passport_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, passport_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">NIK (16 Digit)</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={editForm.nik || ''}
                    onChange={(e) => setEditForm({ ...editForm, nik: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">No. HP / WhatsApp</label>
                  <input
                    type="text"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Jenis Kelamin</label>
                  <select
                    value={editForm.gender || 'MALE'}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                  >
                    <option value="MALE">Laki-Laki (M)</option>
                    <option value="FEMALE">Perempuan (F)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Tempat Lahir</label>
                  <input
                    type="text"
                    value={editForm.birth_place || ''}
                    onChange={(e) => setEditForm({ ...editForm, birth_place: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={editForm.birth_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">No. Kartu Keluarga</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={editForm.kk_number || ''}
                    onChange={(e) => setEditForm({ ...editForm, kk_number: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Hubungan / Mahram</label>
                  <input
                    type="text"
                    placeholder="Contoh: Suami, Istri, Anak, Kepala Keluarga"
                    value={editForm.relationship || ''}
                    onChange={(e) => setEditForm({ ...editForm, relationship: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Status Pernikahan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Kawin, Belum Kawin, Cerai Hidup, Cerai Mati"
                    value={editForm.marital_status || ''}
                    onChange={(e) => setEditForm({ ...editForm, marital_status: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                {/* Rincian Alamat KTP */}
                <div className="md:col-span-2 pt-2 border-t border-slate-200">
                  <label className="font-bold text-slate-800 text-xs block mb-2">Rincian Alamat (Sesuai Kolom KTP)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-8">
                      <label className="text-[11px] font-semibold text-slate-600 block">Jalan / Blok / No. Rumah</label>
                      <input
                        type="text"
                        value={parseKtpAddress(editForm.address).street}
                        onChange={(e) => {
                          const current = parseKtpAddress(editForm.address);
                          current.street = e.target.value;
                          setEditForm({ ...editForm, address: composeKtpAddress(current) });
                        }}
                        placeholder="Contoh: Jl. Melati No. 12"
                        className="w-full mt-0.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="text-[11px] font-semibold text-slate-600 block">RT / RW</label>
                      <input
                        type="text"
                        value={parseKtpAddress(editForm.address).rt_rw}
                        onChange={(e) => {
                          const current = parseKtpAddress(editForm.address);
                          current.rt_rw = e.target.value;
                          setEditForm({ ...editForm, address: composeKtpAddress(current) });
                        }}
                        placeholder="000/000"
                        className="w-full mt-0.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="text-[11px] font-semibold text-slate-600 block">Kelurahan / Desa</label>
                      <input
                        type="text"
                        value={parseKtpAddress(editForm.address).kelurahan}
                        onChange={(e) => {
                          const current = parseKtpAddress(editForm.address);
                          current.kelurahan = e.target.value;
                          setEditForm({ ...editForm, address: composeKtpAddress(current) });
                        }}
                        placeholder="Nama Kel/Desa"
                        className="w-full mt-0.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="text-[11px] font-semibold text-slate-600 block">Kecamatan</label>
                      <input
                        type="text"
                        value={parseKtpAddress(editForm.address).kecamatan}
                        onChange={(e) => {
                          const current = parseKtpAddress(editForm.address);
                          current.kecamatan = e.target.value;
                          setEditForm({ ...editForm, address: composeKtpAddress(current) });
                        }}
                        placeholder="Nama Kecamatan"
                        className="w-full mt-0.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="text-[11px] font-semibold text-slate-600 block">Kota / Kabupaten</label>
                      <input
                        type="text"
                        value={parseKtpAddress(editForm.address).city}
                        onChange={(e) => {
                          const current = parseKtpAddress(editForm.address);
                          current.city = e.target.value;
                          setEditForm({ ...editForm, address: composeKtpAddress(current) });
                        }}
                        placeholder="Kota / Kab"
                        className="w-full mt-0.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Format Database Tersimpan:</span>
                    <span className="text-slate-800 font-medium">{editForm.address || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: MANIFEST */}
      {activeTab === 'manifest' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Data Perjalanan & Manifest Penerbangan</h3>
              <p className="text-xs text-slate-500">
                Informasi resmi yang bersumber dari paspor dan dokumen terkonfirmasi untuk tiket & visa.
              </p>
            </div>
            {data.passport_number ? (
              <Badge variant="success">Data Paspor Terkonfirmasi</Badge>
            ) : (
              <Badge variant="warning">Paspor Belum Terdaftar</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Nama Sesuai Paspor</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{data.passport_name || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Nomor Paspor</p>
              <p className="font-bold text-slate-900 font-mono text-sm mt-0.5">{data.passport_number || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Jenis Kelamin (Sex)</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {data.gender === 'MALE' ? 'Laki-Laki (M / Male)' : data.gender === 'FEMALE' ? 'Perempuan (F / Female)' : '-'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Kewarganegaraan</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">INDONESIA</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Tempat Lahir</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{data.birth_place || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Tanggal Lahir (DOB)</p>
              <p className="font-bold text-slate-900 font-mono text-sm mt-0.5">{data.birth_date || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Tempat Dikeluarkan Paspor</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{data.passport_issue_place || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Tanggal Pengeluaran Paspor</p>
              <p className="font-bold text-slate-900 font-mono text-sm mt-0.5">{data.passport_issue_date || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Tanggal Habis Berlaku Paspor</p>
              <p className="font-bold text-slate-900 font-mono text-sm mt-0.5">{data.passport_expiry_date || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">NIK Kependudukan</p>
              <p className="font-bold text-slate-900 font-mono text-sm mt-0.5">{data.nik || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">No. Kartu Keluarga</p>
              <p className="font-bold text-slate-900 font-mono text-sm mt-0.5">{data.kk_number || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">No. Telepon / HP</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{data.phone || '-'}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DOKUMEN */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Status Berkas & Kelengkapan Dokumen</h3>
              <p className="text-xs text-slate-500">Kelola 5 dokumen utama jamaah untuk administrasi dan visa.</p>
            </div>
            <Link
              href={`/jamaah/upload?jamaah_id=${data.id}`}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Dokumen Baru</span>
            </Link>
          </div>

          <div className="space-y-3">
            {coreDocs.map((item) => {
              const isUploaded = !!item.doc;
              return (
                <div
                  key={item.key}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isUploaded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.label}</p>
                      <p className="text-[11px] text-slate-400">
                        {isUploaded ? `${item.doc.original_file_name} • Terkonfirmasi` : 'Belum diunggah ke sistem'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isUploaded ? (
                      <>
                        <Badge variant="success">✓ Sudah Upload</Badge>
                        <button
                          onClick={() => handleOpenDocPreview(item.doc)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat</span>
                        </button>
                        <Link
                          href={`/jamaah/upload?jamaah_id=${data.id}&document_type=${item.key}`}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all"
                        >
                          Ganti
                        </Link>
                      </>
                    ) : (
                      <>
                        <Badge variant="neutral">Belum Upload</Badge>
                        <Link
                          href={`/jamaah/upload?jamaah_id=${data.id}&document_type=${item.key}`}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-all"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Upload</span>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: PEMBAYARAN */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Tagihan</p>
              <p className="text-lg font-black text-slate-900 mt-1">{formatRupiah(fin.total_tagihan)}</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sudah Dibayar</p>
              <p className="text-lg font-black text-emerald-600 mt-1">{formatRupiah(fin.total_paid)}</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Kekurangan</p>
              <p className="text-lg font-black text-rose-600 mt-1">{formatRupiah(fin.total_outstanding)}</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status Pembayaran</p>
              <div className="mt-1">
                {fin.status === 'LUNAS' && <Badge variant="success">LUNAS</Badge>}
                {fin.status === 'SEBAGIAN' && <Badge variant="warning">BELUM LUNAS</Badge>}
                {fin.status === 'BELUM_BAYAR' && <Badge variant="danger">BELUM BAYAR</Badge>}
                {fin.status === 'NO_TRIP' && <Badge variant="neutral">BELUM ADA PAKET</Badge>}
              </div>
            </div>
          </div>

          {/* Action Header */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Riwayat Pembayaran & Transaksi</h3>
                <p className="text-xs text-slate-500">Catatan pembayaran yang telah dialokasikan ke tagihan jamaah ini.</p>
              </div>
              <button
                onClick={() => setShowPayModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Input Pembayaran</span>
              </button>
            </div>

            {/* Transactions Table */}
            {data.payments && data.payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Jenis</th>
                      <th className="py-2.5 px-3 text-right">Nominal</th>
                      <th className="py-2.5 px-3">Metode</th>
                      <th className="py-2.5 px-3">Keterangan</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.payments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono">{p.payment_date}</td>
                        <td className="py-2.5 px-3 font-semibold">{p.payment_type || 'CICILAN'}</td>
                        <td className="py-2.5 px-3 font-bold text-right font-mono text-emerald-600">
                          {formatRupiah(p.amount)}
                        </td>
                        <td className="py-2.5 px-3">{p.payment_method || 'TRANSFER'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{p.notes || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant="success">Berhasil</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Belum ada riwayat pembayaran yang tercatat untuk jamaah ini.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {previewDoc && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={`Pratinjau Dokumen: ${previewDoc.original_file_name}`}
          size="2xl"
        >
          {loadingDocUrl ? (
            <LoadingSpinner label="Menyiapkan berkas pratinjau..." />
          ) : (
            <DocumentViewer
              fileUrl={previewUrl}
              fileName={previewDoc.original_file_name}
              mimeType={previewDoc.mime_type}
            />
          )}
        </Modal>
      )}

      {/* Input Payment Modal */}
      {showPayModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowPayModal(false)}
          title="Input Pembayaran Jamaah"
          size="md"
        >
          <form onSubmit={handleCreatePayment} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700">Nama Jamaah</label>
              <input
                type="text"
                disabled
                value={data.identity_name || data.passport_name || ''}
                className="w-full mt-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700">Pilih Keberangkatan / Paket *</label>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {data.trips && data.trips.length > 0 ? (
                  data.trips.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.package?.name || 'Paket Umrah'} ({t.package?.departure_date || '-'})
                    </option>
                  ))
                ) : (
                  <option value="">Pembayaran Deposit Umum</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700">Tanggal Pembayaran *</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Jenis Pembayaran *</label>
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="DP">DP (Uang Muka)</option>
                  <option value="CICILAN">Cicilan</option>
                  <option value="PELUNASAN">Pelunasan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700">Nominal Pembayaran (Rp) *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 10.000.000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Metode Pembayaran</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="TRANSFER">Transfer Bank</option>
                  <option value="CASH">Tunai (Cash)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700">Catatan / Keterangan</label>
              <input
                type="text"
                placeholder="Misal: Bukti transfer BCA a.n Farid"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingPay}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
              >
                {submittingPay ? 'Menyimpan...' : 'Simpan Pembayaran'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Passport Recommendation Letter Modal */}
      {showPassportRecModal && data && (
        <PassportRecommendationModal
          isOpen={showPassportRecModal}
          onClose={() => setShowPassportRecModal(false)}
          jamaah={data}
        />
      )}
    </div>
  );
};
