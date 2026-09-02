'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Boxes, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Luggage,
  Settings
} from 'lucide-react';
import { Package, EquipmentItem, PackageEquipmentItem, EquipmentApplicability } from '@/types/database.types';

export default function PackageEquipmentSetupPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [masterItems, setMasterItems] = useState<EquipmentItem[]>([]);
  const [configuredItems, setConfiguredItems] = useState<PackageEquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New item modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMasterItemId, setSelectedMasterItemId] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newApplicability, setNewApplicability] = useState<EquipmentApplicability>('ALL');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pkgRes, masterRes] = await Promise.all([
        fetch('/api/packages'),
        fetch('/api/equipment/master'),
      ]);

      const pkgData = await pkgRes.json();
      const masterData = await masterRes.json();

      if (pkgData.packages) {
        setPackages(pkgData.packages);
        if (pkgData.packages.length > 0 && !selectedPkgId) {
          setSelectedPkgId(pkgData.packages[0].id);
        }
      }

      if (masterData.items) {
        setMasterItems(masterData.items);
      }
    } catch (err) {
      console.error('Failed to load package equipment data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackageEquipment = async (pkgId: string) => {
    if (!pkgId) return;
    try {
      const res = await fetch(`/api/equipment/packages/${pkgId}`);
      const data = await res.json();
      if (data.items) {
        setConfiguredItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load package items:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPkgId) {
      fetchPackageEquipment(selectedPkgId);
    }
  }, [selectedPkgId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkgId || !selectedMasterItemId) return;

    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch(`/api/equipment/packages/${selectedPkgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_item_id: selectedMasterItemId,
          quantity_per_pax: newQty,
          applicability: newApplicability,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan perlengkapan');

      setShowAddModal(false);
      setSelectedMasterItemId('');
      setNewQty(1);
      setMessage({ type: 'success', text: 'Item perlengkapan berhasil ditambahkan ke paket & disinkronisasi ke seluruh jamaah.' });
      fetchPackageEquipment(selectedPkgId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!selectedPkgId) return;
    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch(`/api/equipment/packages/${selectedPkgId}/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal sinkronisasi');
      setMessage({ type: 'success', text: data.message || 'Sinkronisasi berhasil.' });
      fetchPackageEquipment(selectedPkgId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Boxes className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">Konfigurasi Perlengkapan Paket</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Tentukan daftar barang yang wajib diterima oleh jamaah pada paket ini beserta aturan gender dan jumlah per orang.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Item Paket</span>
          </button>
          <Link
            href="/pengaturan/master-perlengkapan"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition"
          >
            <Settings className="w-4 h-4" />
            <span>Master Perlengkapan</span>
          </Link>
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

      {/* Package Selector */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pilih Paket:</span>
          <select
            value={selectedPkgId}
            onChange={(e) => setSelectedPkgId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.package_name} ({new Date(pkg.departure_date).toLocaleDateString('id-ID')})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSync}
          disabled={saving}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          title="Sinkronisasi ulang kebutuhan seluruh jamaah"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
          <span>Sinkronkan ke Jamaah</span>
        </button>
      </div>

      {/* Configured Equipment List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">Daftar Perlengkapan Standar Paket</h2>
          <span className="text-xs text-slate-500">{configuredItems.length} Item Dikonfigurasi</span>
        </div>

        {configuredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Luggage className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="font-medium text-slate-700">Belum ada perlengkapan yang dikonfigurasi untuk paket ini.</p>
            <p className="text-xs text-slate-500 mt-1">Klik tombol &ldquo;Tambah Item Paket&rdquo; di atas untuk memilih perlengkapan standar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">No</th>
                  <th className="py-3.5 px-4">Nama Item</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4 text-center">Jumlah Per Pax</th>
                  <th className="py-3.5 px-4 text-center">Berlaku Untuk</th>
                  <th className="py-3.5 px-4 text-center">Butuh Ukuran</th>
                  <th className="py-3.5 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                {configuredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {item.equipment_item?.name || 'Item Perlengkapan'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {item.equipment_item?.category || 'OTHER'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      {item.quantity_per_pax}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.applicability === 'ALL' ? (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">Semua Pax</span>
                      ) : item.applicability === 'MALE' ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">Khusus Pria</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-xs font-semibold">Khusus Wanita</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs">
                      {item.equipment_item?.requires_variant ? (
                        <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded">Wajib Pilih Varian</span>
                      ) : (
                        <span className="text-slate-400">Tanpa Ukuran</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {item.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add Item */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Tambah Perlengkapan Paket</h3>
            <p className="text-xs text-slate-500 mb-5">Pilih master item dan aturan alokasi untuk jamaah paket ini.</p>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pilih Master Item
                </label>
                <select
                  required
                  value={selectedMasterItemId}
                  onChange={(e) => {
                    setSelectedMasterItemId(e.target.value);
                    const selected = masterItems.find(i => i.id === e.target.value);
                    if (selected?.name.toLowerCase().includes('ihram')) {
                      setNewApplicability('MALE');
                    } else if (selected?.name.toLowerCase().includes('mukena')) {
                      setNewApplicability('FEMALE');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pilih Item Perlengkapan --</option>
                  {masterItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category}) {item.requires_variant ? '[Ada Ukuran]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jumlah Per Pax
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Aturan Gender
                  </label>
                  <select
                    value={newApplicability}
                    onChange={(e) => setNewApplicability(e.target.value as EquipmentApplicability)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="ALL">Semua (Pria & Wanita)</option>
                    <option value="MALE">Khusus Pria</option>
                    <option value="FEMALE">Khusus Wanita</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedMasterItemId}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Tambahkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
