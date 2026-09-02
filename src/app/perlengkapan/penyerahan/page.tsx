'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Download, 
  RefreshCw,
  Send,
  Boxes,
  RotateCcw,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react';
import { 
  Package, 
  PIC, 
  ParticipantEquipmentRow, 
  EquipmentItem, 
  EquipmentVariant 
} from '@/types/database.types';

export default function PenyiapanPenyerahanPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [pics, setPics] = useState<PIC[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [selectedPicId, setSelectedPicId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [missingVariantOnly, setMissingVariantOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [participants, setParticipants] = useState<ParticipantEquipmentRow[]>([]);
  const [masterItems, setMasterItems] = useState<EquipmentItem[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Variant Edit Modal
  const [variantModal, setVariantModal] = useState<{
    show: boolean;
    participant_equipment_id: string;
    item_name: string;
    jamaah_name: string;
    variants: EquipmentVariant[];
    currentVariantId: string | null;
  } | null>(null);

  // Correction Modal
  const [correctionModal, setCorrectionModal] = useState<{
    show: boolean;
    participant_equipment_id: string;
    item_name: string;
    jamaah_name: string;
    expected: number;
    prepared: number;
    handedOver: number;
    targetPrepared: number;
    targetHandedOver: number;
    reason: string;
  } | null>(null);

  const fetchInitial = async () => {
    try {
      setLoading(true);
      const [pkgRes, picRes, masterRes] = await Promise.all([
        fetch('/api/packages'),
        fetch('/api/pics'),
        fetch('/api/equipment/master'),
      ]);

      const pkgData = await pkgRes.json();
      const picData = await picRes.json();
      const masterData = await masterRes.json();

      if (pkgData.packages) {
        setPackages(pkgData.packages);
        if (pkgData.packages.length > 0 && !selectedPkgId) {
          setSelectedPkgId(pkgData.packages[0].id);
        }
      }
      if (picData.pics) setPics(picData.pics);
      if (masterData.items) setMasterItems(masterData.items);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    if (!selectedPkgId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedPicId) params.append('picId', selectedPicId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (missingVariantOnly) params.append('missingVariant', 'true');

      const res = await fetch(`/api/equipment/packages/${selectedPkgId}/participants?${params.toString()}`);
      const data = await res.json();
      if (data.participants) {
        setParticipants(data.participants);
        setSelectedParticipantIds([]);
      }
    } catch (err) {
      console.error('Failed to load participant equipment:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitial();
  }, []);

  useEffect(() => {
    if (selectedPkgId) {
      fetchParticipants();
    }
  }, [selectedPkgId, selectedPicId, statusFilter, missingVariantOnly, searchQuery]);

  // Select all handler
  const handleToggleSelectAll = () => {
    if (selectedParticipantIds.length === participants.length) {
      setSelectedParticipantIds([]);
    } else {
      setSelectedParticipantIds(participants.map(p => p.participant_id));
    }
  };

  const handleToggleSelect = (paxId: string) => {
    if (selectedParticipantIds.includes(paxId)) {
      setSelectedParticipantIds(selectedParticipantIds.filter(id => id !== paxId));
    } else {
      setSelectedParticipantIds([...selectedParticipantIds, paxId]);
    }
  };

  // Bulk Prepare
  const handleBulkPrepare = async () => {
    if (selectedParticipantIds.length === 0 || !selectedPkgId) return;
    try {
      setProcessing(true);
      setMessage(null);
      const res = await fetch(`/api/equipment/packages/${selectedPkgId}/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_ids: selectedParticipantIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal melakukan bulk prepare');
      setMessage({ type: 'success', text: data.message });
      fetchParticipants();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  };

  // Bulk Handover
  const handleBulkHandover = async () => {
    if (selectedParticipantIds.length === 0 || !selectedPkgId) return;
    try {
      setProcessing(true);
      setMessage(null);
      const res = await fetch(`/api/equipment/packages/${selectedPkgId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_ids: selectedParticipantIds,
          notes: 'Bulk serah terima perlengkapan jamaah',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal melakukan bulk handover');
      setMessage({ type: 'success', text: data.message });
      fetchParticipants();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  };

  // Save Variant
  const handleSaveVariant = async (variantId: string | null) => {
    if (!variantModal) return;
    try {
      setProcessing(true);
      const res = await fetch(`/api/equipment/packages/${selectedPkgId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_equipment_id: variantModal.participant_equipment_id,
          variant_id: variantId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan varian');
      setVariantModal(null);
      fetchParticipants();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Save Correction
  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionModal || !correctionModal.reason) return;
    try {
      setProcessing(true);
      const res = await fetch(`/api/equipment/packages/${selectedPkgId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_equipment_id: correctionModal.participant_equipment_id,
          target_prepared: correctionModal.targetPrepared,
          target_handed_over: correctionModal.targetHandedOver,
          reason: correctionModal.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan koreksi');
      setCorrectionModal(null);
      setMessage({ type: 'success', text: 'Koreksi perlengkapan berhasil dicatat dengan riwayat audit.' });
      fetchParticipants();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">Meja Penyiapan & Serah Terima</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola pengisian ukuran seragam, penyiapan barang, dan serah terima perlengkapan jamaah per paket atau rombongan PIC.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedPkgId && (
            <>
              <a
                href={`/api/equipment/export/checklist/${selectedPkgId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm rounded-xl transition shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download Checklist (Excel)</span>
              </a>
              <a
                href={`/api/equipment/export/report/${selectedPkgId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Laporan Lengkap (Excel)</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Paket</label>
            <select
              value={selectedPkgId}
              onChange={(e) => setSelectedPkgId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.package_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Rombongan / PIC</label>
            <select
              value={selectedPicId}
              onChange={(e) => setSelectedPicId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">Semua PIC / Direct</option>
              {pics.map((pic) => (
                <option key={pic.id} value={pic.id}>
                  {pic.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status Jamaah</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="NOT_STARTED">Belum Diproses</option>
              <option value="PREPARING">Sedang Disiapkan</option>
              <option value="READY">Siap Diambil</option>
              <option value="COLLECTED">Sudah Diserahkan</option>
              <option value="NEEDS_REVIEW">Perlu Review (Gender ?)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Cari Jamaah</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nama, Paspor, NIK..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium select-none">
            <input
              type="checkbox"
              checked={missingVariantOnly}
              onChange={(e) => setMissingVariantOnly(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Hanya Tampilkan Jamaah Belum Isi Ukuran
            </span>
          </label>

          <span className="text-slate-500">
            Menampilkan <strong>{participants.length}</strong> Jamaah
          </span>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedParticipantIds.length > 0 && (
        <div className="bg-emerald-950 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold">
              {selectedParticipantIds.length}
            </span>
            <span className="text-sm font-medium text-emerald-100">
              Jamaah Terpilih untuk Aksi Massal:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkPrepare}
              disabled={processing}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Tandai Siap ({selectedParticipantIds.length})</span>
            </button>
            <button
              onClick={handleBulkHandover}
              disabled={processing}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold transition shadow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Serahkan Perlengkapan ({selectedParticipantIds.length})</span>
            </button>
            <button
              onClick={() => setSelectedParticipantIds([])}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Participants Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <button
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            {selectedParticipantIds.length === participants.length && participants.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Pilih Semua ({participants.length})</span>
          </button>
          <span className="text-xs text-slate-400">Gunakan tombol per baris untuk ubah ukuran & serah terima</span>
        </div>

        {participants.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Boxes className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="font-medium text-slate-700">Tidak ada jamaah yang sesuai filter.</p>
            <p className="text-xs text-slate-500 mt-1">Coba ubah filter atau sinkronkan data paket.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Nama Jamaah & Paspor</th>
                  <th className="py-3 px-4">PIC</th>
                  <th className="py-3 px-4">Item Perlengkapan & Ukuran</th>
                  <th className="py-3 px-4 text-center">Progress</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                {participants.map((pax) => {
                  const isSelected = selectedParticipantIds.includes(pax.participant_id);
                  return (
                    <tr key={pax.participant_id} className={`hover:bg-slate-50/60 transition ${isSelected ? 'bg-emerald-50/30' : ''}`}>
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(pax.participant_id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900">
                          {pax.passport_name || pax.jamaah_name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Paspor: {pax.passport_number || '-'}</span>
                          <span>•</span>
                          <span>{pax.gender === 'MALE' ? 'Pria (L)' : pax.gender === 'FEMALE' ? 'Wanita (P)' : 'Gender ?'}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-xs font-medium text-slate-600">
                        {pax.pic_name}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xl">
                          {pax.items.map((it) => {
                            const master = masterItems.find(m => m.id === it.equipment_item_id);
                            const variants = master?.variants || [];

                            return (
                              <div
                                key={it.id}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
                                  it.status === 'SUDAH_DISERAHKAN'
                                    ? 'bg-teal-50 border-teal-200 text-teal-900'
                                    : it.status === 'SIAP'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                    : it.requires_variant && !it.variant_id
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-medium">{it.item_name}</span>

                                {it.requires_variant && (
                                  <button
                                    onClick={() => setVariantModal({
                                      show: true,
                                      participant_equipment_id: it.id,
                                      item_name: it.item_name,
                                      jamaah_name: pax.jamaah_name,
                                      variants,
                                      currentVariantId: it.variant_id || null,
                                    })}
                                    className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${
                                      it.variant_label
                                        ? 'bg-white shadow-xs text-slate-800 border border-slate-300'
                                        : 'bg-amber-600 text-white animate-pulse'
                                    }`}
                                    title="Klik untuk memilih ukuran"
                                  >
                                    {it.variant_label || 'Pilih Size'}
                                  </button>
                                )}

                                <span className="text-[10px] opacity-75">
                                  ({it.quantity_handed_over}/{it.quantity_expected})
                                </span>

                                {/* Quick actions */}
                                {it.status !== 'SUDAH_DISERAHKAN' && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        if (it.requires_variant && !it.variant_id) {
                                          alert('Harap pilih ukuran terlebih dahulu.');
                                          return;
                                        }
                                        if (it.quantity_prepared === 0) {
                                          // Prepare first
                                          await fetch(`/api/equipment/packages/${selectedPkgId}/prepare`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ participant_equipment_id: it.id }),
                                          });
                                        } else {
                                          // Handover
                                          await fetch(`/api/equipment/packages/${selectedPkgId}/handover`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ participant_equipment_id: it.id }),
                                          });
                                        }
                                        fetchParticipants();
                                      } catch (err: any) {
                                        alert(err.message);
                                      }
                                    }}
                                    className="p-0.5 hover:bg-black/10 rounded text-[10px]"
                                    title={it.quantity_prepared === 0 ? 'Tandai Siap' : 'Serahkan Item'}
                                  >
                                    {it.quantity_prepared === 0 ? 'Siapkan' : 'Serahkan'}
                                  </button>
                                )}

                                {/* Correction button */}
                                {(it.quantity_prepared > 0 || it.quantity_handed_over > 0) && (
                                  <button
                                    onClick={() => setCorrectionModal({
                                      show: true,
                                      participant_equipment_id: it.id,
                                      item_name: it.item_name,
                                      jamaah_name: pax.jamaah_name,
                                      expected: it.quantity_expected,
                                      prepared: it.quantity_prepared,
                                      handedOver: it.quantity_handed_over,
                                      targetPrepared: it.quantity_prepared,
                                      targetHandedOver: it.quantity_handed_over,
                                      reason: '',
                                    })}
                                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                                    title="Koreksi jumlah / serah terima"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className="text-xs font-bold text-slate-800">
                          {pax.handed_over_items} / {pax.total_items}
                        </span>
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                          <div
                            className="bg-teal-500 h-full rounded-full"
                            style={{ width: `${pax.total_items > 0 ? (pax.handed_over_items / pax.total_items) * 100 : 0}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        {pax.overall_status === 'COLLECTED' ? (
                          <span className="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-bold">
                            Lengkap
                          </span>
                        ) : pax.overall_status === 'READY' ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                            Siap
                          </span>
                        ) : pax.overall_status === 'PREPARING' ? (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            Proses
                          </span>
                        ) : pax.overall_status === 'NEEDS_REVIEW' ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold">
                            Gender ?
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                            Belum
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sizing Modal */}
      {variantModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Pilih Ukuran / Varian</h3>
            <p className="text-xs text-slate-500 mt-1">
              <strong>{variantModal.item_name}</strong> untuk <strong>{variantModal.jamaah_name}</strong>
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {variantModal.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleSaveVariant(v.id)}
                  disabled={processing}
                  className={`py-3 px-2 rounded-xl text-sm font-bold border transition ${
                    variantModal.currentVariantId === v.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => handleSaveVariant(null)}
                className="text-xs text-rose-600 hover:underline"
              >
                Kosongkan Pilihan
              </button>
              <button
                type="button"
                onClick={() => setVariantModal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correction Modal */}
      {correctionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
              <RotateCcw className="w-5 h-5" />
              <h3>Koreksi Status Perlengkapan</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {correctionModal.item_name} — {correctionModal.jamaah_name}
            </p>

            <form onSubmit={handleSaveCorrection} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Jumlah Disiapkan</label>
                  <input
                    type="number"
                    min="0"
                    max={correctionModal.expected}
                    value={correctionModal.targetPrepared}
                    onChange={(e) => setCorrectionModal({
                      ...correctionModal,
                      targetPrepared: parseInt(e.target.value) || 0,
                    })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Maks: {correctionModal.expected}</span>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Jumlah Diserahkan</label>
                  <input
                    type="number"
                    min="0"
                    max={correctionModal.targetPrepared}
                    value={correctionModal.targetHandedOver}
                    onChange={(e) => setCorrectionModal({
                      ...correctionModal,
                      targetHandedOver: parseInt(e.target.value) || 0,
                    })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Maks: {correctionModal.targetPrepared}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Alasan Koreksi (Wajib Diisi untuk Audit) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Contoh: Barang tercatat diserahkan padahal masih tertinggal di gudang..."
                  value={correctionModal.reason}
                  onChange={(e) => setCorrectionModal({
                    ...correctionModal,
                    reason: e.target.value,
                  })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCorrectionModal(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processing || !correctionModal.reason.trim()}
                  className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {processing ? 'Menyimpan...' : 'Simpan Koreksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
