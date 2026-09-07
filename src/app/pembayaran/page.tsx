'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  UploadCloud, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Calendar,
  FileText,
  ExternalLink,
  Split,
  Inbox,
  ArrowRight,
  User,
  UserCheck,
  Edit3,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRupiah, parseRupiahInput } from '@/lib/currency';
import { UnifiedJamaahDetailModal } from '@/components/jamaah/UnifiedJamaahDetailModal';

export default function PembayaranPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [jamaahList, setJamaahList] = useState<any[]>([]);
  const [pics, setPics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedAllocStatus, setSelectedAllocStatus] = useState('');

  // Selected Jamaah for Detail Modal
  const [selectedJamaahId, setSelectedJamaahId] = useState<string | null>(null);

  // Input Payment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [senderType, setSenderType] = useState<'JAMAAH' | 'PIC' | 'MANUAL'>('JAMAAH');
  const [selectedJamaah, setSelectedJamaah] = useState('');
  const [selectedPic, setSelectedPic] = useState('');
  const [manualSenderName, setManualSenderName] = useState('');
  const [payPackageId, setPayPackageId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [amountStr, setAmountStr] = useState('');
  const [payType, setPayType] = useState('CICILAN');
  const [payMethod, setPayMethod] = useState('TRANSFER BCA');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View Proof Modal
  const [proofTarget, setProofTarget] = useState<any>(null);

  // Edit Payment State
  const [editPayment, setEditPayment] = useState<any>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editBank, setEditBank] = useState('');
  const [editPayType, setEditPayType] = useState('CICILAN');
  const [editSenderName, setEditSenderName] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Cancel Payment State
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedPackageId) params.set('package_id', selectedPackageId);

      const [payRes, pkgRes, jamRes, picRes] = await Promise.all([
        fetch(`/api/finance/payments?${params.toString()}`),
        fetch('/api/packages'),
        fetch('/api/jamaah'),
        fetch('/api/pics'),
      ]);

      if (payRes.ok) {
        const payJson = await payRes.json();
        setPayments(payJson || []);
      }
      if (pkgRes.ok) {
        const pkgJson = await pkgRes.json();
        setPackages(pkgJson || []);
      }
      if (jamRes.ok) {
        const jamJson = await jamRes.json();
        setJamaahList(jamJson || []);
      }
      if (picRes.ok) {
        const picJson = await picRes.json();
        setPics(picJson || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPackageId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseRupiahInput(amountStr);
    if (!numAmount || numAmount <= 0) {
      alert('Masukkan nominal pembayaran yang valid');
      return;
    }

    let senderName = '';
    let picIdToSend: string | undefined = undefined;

    if (senderType === 'JAMAAH') {
      const selectedJamObj = jamaahList.find(j => j.id === selectedJamaah);
      senderName = selectedJamObj ? (selectedJamObj.passport_name || selectedJamObj.identity_name || selectedJamObj.ktp_name) : '';
    } else if (senderType === 'PIC') {
      const selectedPicObj = pics.find(p => p.id === selectedPic);
      senderName = selectedPicObj ? `PIC: ${selectedPicObj.name}` : '';
      picIdToSend = selectedPic || undefined;
    } else {
      senderName = manualSenderName.trim();
    }

    if (!senderName) {
      alert('Nama pengirim wajib diisi atau dipilih');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('amount', numAmount.toString());
      formData.append('payment_date', payDate);
      formData.append('sender_name', senderName);
      formData.append('sender_bank', payMethod);
      if (payPackageId) formData.append('package_id', payPackageId);
      if (picIdToSend) formData.append('pic_id', picIdToSend);
      formData.append('notes', `${payType}: ${notes || '-'}`);
      if (proofFile) {
        formData.append('proof_file', proofFile);
      }

      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal menyimpan pembayaran');
      }

      setShowCreateModal(false);
      setAmountStr('');
      setNotes('');
      setManualSenderName('');
      setSelectedJamaah('');
      setSelectedPic('');
      setProofFile(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditPaymentModal = (p: any) => {
    setEditPayment(p);
    setEditNotes(p.notes || '');
    setEditBank(p.sender_bank || 'TRANSFER BCA');
    setEditPayType(p.payment_type || 'CICILAN');
    setEditSenderName(p.sender_name || '');
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPayment) return;

    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/finance/payments/${editPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: editNotes,
          sender_bank: editBank,
          payment_type: editPayType,
          sender_name: editSenderName,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal memperbarui pembayaran');
      }

      setEditPayment(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui transaksi');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!cancelTarget) return;

    setSubmittingCancel(true);
    try {
      const res = await fetch(`/api/finance/payments/${cancelTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellation_reason: cancellationReason || 'Dibatalkan oleh admin',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal menghapus/membatalkan pembayaran');
      }

      setCancelTarget(null);
      setCancellationReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus pembayaran');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    if (selectedType && !p.notes?.includes(selectedType) && p.payment_type !== selectedType) return false;
    if (selectedAllocStatus === 'UNALLOCATED' && p.allocation_status !== 'UNALLOCATED' && p.remaining_unallocated <= 0) return false;
    if (selectedAllocStatus === 'ALLOCATED' && p.remaining_unallocated > 0) return false;
    return true;
  });

  const unallocatedCount = payments.filter(p => p.remaining_unallocated > 0 || p.allocation_status === 'UNALLOCATED').length;
  const unallocatedSum = payments.filter(p => p.remaining_unallocated > 0).reduce((acc, p) => acc + (p.remaining_unallocated || 0), 0);
  const totalNominal = filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pembayaran & Setoran Dana</h1>
          <p className="text-xs text-slate-500 mt-1">
            Riwayat transaksi penerimaan dana, pencatatan deposit umum, dan alokasi ke tagihan jamaah.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/finance/alokasi"
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-2 transition-all"
          >
            <Split className="w-4 h-4" />
            <span>Workspace Alokasi Dana</span>
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Input Pembayaran</span>
          </button>
        </div>
      </div>

      {/* Unallocated Funds Alert Banner */}
      {unallocatedCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-amber-950">
                Ada {unallocatedCount} Pembayaran Deposit Belum Dialokasikan ({formatRupiah(unallocatedSum)})
              </p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Dana ini telah masuk kas travel namun belum memotong tagihan jamaah. Anda dapat membagikannya ke jamaah kapan saja.
              </p>
            </div>
          </div>
          <Link
            href="/finance/alokasi"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-all shrink-0 self-start sm:self-auto"
          >
            <Split className="w-3.5 h-3.5" />
            <span>Alokasikan Dana Sekarang</span>
          </Link>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama pengirim, jamaah, atau catatan transfer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </form>

          {/* Keberangkatan Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Semua Keberangkatan</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.package_name || (pkg as any).name || 'Paket Umrah'} ({pkg.departure_date || '-'})
                </option>
              ))}
            </select>
          </div>

          {/* Status Alokasi Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedAllocStatus}
              onChange={(e) => setSelectedAllocStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Semua Status</option>
              <option value="UNALLOCATED">Belum Dialokasi</option>
              <option value="ALLOCATED">Sudah Teralokasi</option>
            </select>
          </div>

          {/* Jenis Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Semua Jenis</option>
              <option value="DP">DP (Uang Muka)</option>
              <option value="CICILAN">Cicilan</option>
              <option value="PELUNASAN">Pelunasan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="Memuat riwayat pembayaran..." />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="font-bold text-slate-800 text-sm">Belum Ada Riwayat Transaksi</p>
            <p className="text-xs text-slate-400">Gunakan tombol &quot;+ Input Pembayaran&quot; untuk mencatat pembayaran baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold z-10">
                <tr>
                  <th className="py-3 px-3.5 text-center w-12">No</th>
                  <th className="py-3 px-3.5">Tanggal</th>
                  <th className="py-3 px-3.5">Pengirim / Jamaah</th>
                  <th className="py-3 px-3.5">Program / Paket</th>
                  <th className="py-3 px-3.5 text-center">Status Alokasi</th>
                  <th className="py-3 px-3.5 text-right">Nominal Dana</th>
                  <th className="py-3 px-3.5">Metode / Bank</th>
                  <th className="py-3 px-3.5">Catatan</th>
                  <th className="py-3 px-3.5 text-center w-16">Bukti</th>
                  <th className="py-3 px-3.5 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {filteredPayments.map((p, idx) => {
                  const isUnallocated = p.allocation_status === 'UNALLOCATED' || (p.remaining_unallocated && p.remaining_unallocated > 0);
                  const hasJamaah = p.jamaah_name && p.jamaah_name !== 'Belum Terhubung';
                  const targetJamaahId = p.raw_jamaah_id || p.jamaah_id;

                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-slate-50/80 transition-colors group ${hasJamaah ? 'cursor-pointer' : ''}`}
                      onClick={() => hasJamaah && targetJamaahId && setSelectedJamaahId(targetJamaahId)}
                    >
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-medium text-slate-700 whitespace-nowrap">
                        {p.payment_date}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-900 group-hover:text-emerald-700 block">
                          {p.sender_name || (hasJamaah ? p.jamaah_name : 'Pengirim Tanpa Nama')}
                        </span>
                        {hasJamaah && p.jamaah_name !== p.sender_name && (
                          <span className="text-[11px] text-slate-500 block">Jamaah: {p.jamaah_name}</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 truncate max-w-[160px]">
                        {p.package_name || p.package?.package_name || (p.package as any)?.name || (
                          <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md text-[11px]">
                            Deposit Bebas
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {isUnallocated ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            BELUM DIALOKASI ({formatRupiah(p.remaining_unallocated !== undefined ? p.remaining_unallocated : p.amount)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            TERALOKASI PENUH
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                        {formatRupiah(p.amount)}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700">
                        {p.sender_bank || 'Transfer'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 truncate max-w-[160px]">
                        {p.notes || '-'}
                      </td>
                      <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {p.signed_proof_url ? (
                          <button
                            type="button"
                            onClick={() => setProofTarget(p)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all mx-auto"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Bukti</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {isUnallocated ? (
                            <Link
                              href={`/finance/alokasi?payment_id=${p.id}`}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                              title="Alokasikan Dana ke Tagihan Jamaah"
                            >
                              <Split className="w-3.5 h-3.5" />
                              <span>Alokasikan</span>
                            </Link>
                          ) : hasJamaah && targetJamaahId ? (
                            <button
                              type="button"
                              onClick={() => setSelectedJamaahId(targetJamaahId)}
                              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all"
                              title="Lihat Detail Transaksi & Tagihan"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditPaymentModal(p)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Catatan / Bank Transaksi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelTarget(p);
                              setCancellationReason('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus / Batalkan Transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer Stats */}
        {!loading && filteredPayments.length > 0 && (
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Menampilkan {filteredPayments.length} transaksi</span>
            <span className="font-mono font-bold text-slate-800 text-sm">
              Total: {formatRupiah(totalNominal)}
            </span>
          </div>
        )}
      </div>

      {/* Input Payment Modal */}
      {showCreateModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCreateModal(false)}
          title="Input Pembayaran / Setoran Dana"
          size="md"
        >
          <form onSubmit={handleCreatePayment} className="space-y-4 text-xs">
            {/* Sender Type Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Sumber Dana / Pengirim *</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSenderType('JAMAAH')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                    senderType === 'JAMAAH'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Jamaah</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSenderType('PIC')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                    senderType === 'PIC'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>PIC / Agen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSenderType('MANUAL')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                    senderType === 'MANUAL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Manual</span>
                </button>
              </div>
            </div>

            {/* Dynamic Sender Input */}
            {senderType === 'JAMAAH' && (
              <div>
                <select
                  required
                  value={selectedJamaah}
                  onChange={(e) => setSelectedJamaah(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="">-- Pilih Jamaah dari Master Database --</option>
                  {jamaahList.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.passport_name || j.identity_name || j.ktp_name} ({j.member_id || j.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {senderType === 'PIC' && (
              <div>
                <select
                  required
                  value={selectedPic}
                  onChange={(e) => setSelectedPic(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="">-- Pilih PIC / Agen Penyetor --</option>
                  {pics.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone || 'Tanpa Kontak'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {senderType === 'MANUAL' && (
              <div>
                <input
                  type="text"
                  required
                  placeholder="Ketik Nama Pengirim / Nama Perusahaan / Rekening..."
                  value={manualSenderName}
                  onChange={(e) => setManualSenderName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>
            )}

            {/* Program Package Binding */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Program Keberangkatan (Opsional)</label>
              <select
                value={payPackageId}
                onChange={(e) => setPayPackageId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Deposit Bebas / Belum Terikat Paket (Tidak Terdistribusi) --</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.package_name || (pkg as any).name || 'Paket Umrah'} ({pkg.departure_date || '-'})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                💡 Pilih <strong>Deposit Bebas</strong> jika dana ini ingin disimpan terlebih dahulu dan dialokasikan ke jamaah nanti.
              </p>
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
                  <option value="DEPOSIT">Deposit Bebas</option>
                  <option value="DP">DP (Uang Muka)</option>
                  <option value="CICILAN">Cicilan</option>
                  <option value="PELUNASAN">Pelunasan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700">Nominal (Rp) *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 50.000.000"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">Metode / Bank</label>
                <input
                  type="text"
                  placeholder="Misal: TRANSFER BCA / TUNAI"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700">Catatan Transaksi</label>
              <input
                type="text"
                placeholder="Misal: Titipan dana 5 jamaah rombongan Ustadz Toro"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700">Upload Bukti Transfer (Opsional)</label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,.pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setProofFile(e.target.files[0]);
                  }
                }}
                className="w-full mt-1 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-900/20 disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Proof Modal */}
      {proofTarget && (
        <Modal
          isOpen={!!proofTarget}
          onClose={() => setProofTarget(null)}
          title={`Bukti Pembayaran — ${proofTarget.sender_name || 'Transaksi'}`}
          size="lg"
        >
          <div className="space-y-4 text-center">
            {proofTarget.signed_proof_url && (
              <div className="border border-slate-200 rounded-xl p-2 bg-slate-900/5 max-h-[70vh] overflow-auto flex justify-center">
                <img
                  src={proofTarget.signed_proof_url}
                  alt="Bukti Transfer"
                  className="max-h-[60vh] rounded-lg object-contain"
                />
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setProofTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Payment Modal */}
      {editPayment && (
        <Modal
          isOpen={!!editPayment}
          onClose={() => setEditPayment(null)}
          title="Edit Catatan / Bank Transaksi"
          subtitle={`Transaksi Nominal: ${formatRupiah(editPayment.amount)} (${editPayment.allocation_status})`}
          maxWidth="md"
        >
          <form onSubmit={handleUpdatePayment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Pengirim / Pembayar
              </label>
              <input
                type="text"
                value={editSenderName}
                onChange={(e) => setEditSenderName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Metode / Bank
                </label>
                <input
                  type="text"
                  value={editBank}
                  onChange={(e) => setEditBank(e.target.value)}
                  placeholder="TRANSFER BCA / CASH / MANDIRI"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Pembayaran
                </label>
                <select
                  value={editPayType}
                  onChange={(e) => setEditPayType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="DP">DP (Uang Muka)</option>
                  <option value="CICILAN">CICILAN</option>
                  <option value="PELUNASAN">PELUNASAN</option>
                  <option value="DEPOSIT">DEPOSIT UMUM</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Transaksi
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Catatan transaksi..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditPayment(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-900/20"
              >
                {submittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Payment Confirmation Modal */}
      {cancelTarget && (
        <Modal
          isOpen={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          title="Konfirmasi Hapus / Batalkan Transaksi"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800">
                <p className="font-bold">Apakah Anda yakin ingin menghapus transaksi ini?</p>
                <p className="mt-1">
                  Nominal: <strong className="text-rose-950 font-bold font-mono">{formatRupiah(cancelTarget?.amount)}</strong>
                </p>
                <p className="mt-1">
                  Pengirim: <strong className="text-rose-950 font-bold">{cancelTarget?.sender_name || 'Tanpa Nama'}</strong>
                </p>
                <p className="mt-2 text-slate-700 bg-white p-2 rounded-lg border border-slate-200 font-medium">
                  Sistem akan otomatis membatalkan alokasi dana ke invoice jamaah dan menaikkan kembali sisa tagihan/piutang jamaah terkait.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Penghapusan / Pembatalan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Contoh: Salah input nominal / Transaksi dibatalkan oleh bank"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCancelPayment}
                disabled={submittingCancel}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-900/20"
              >
                {submittingCancel ? 'Menghapus...' : 'Ya, Hapus Transaksi'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Unified Jamaah Detail Modal */}
      <UnifiedJamaahDetailModal
        isOpen={!!selectedJamaahId}
        onClose={() => {
          setSelectedJamaahId(null);
          loadData();
        }}
        jamaahId={selectedJamaahId}
      />
    </div>
  );
}
