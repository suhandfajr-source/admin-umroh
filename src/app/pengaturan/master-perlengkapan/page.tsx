'use client';

import React, { useEffect, useState } from 'react';
import { 
  Luggage, 
  Plus, 
  Trash2, 
  Edit3, 
  Archive, 
  Boxes, 
  CheckCircle2, 
  AlertCircle,
  Tag
} from 'lucide-react';
import { EquipmentItem, EquipmentCategory, EquipmentVariant } from '@/types/database.types';

export default function MasterPerlengkapanPage() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Item Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState<EquipmentCategory>('BAG');
  const [itemDesc, setItemDesc] = useState('');
  const [requiresVariant, setRequiresVariant] = useState(false);

  // Variant Modal
  const [variantModal, setVariantModal] = useState<{
    item: EquipmentItem;
    variants: EquipmentVariant[];
    newLabel: string;
  } | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/equipment/master');
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load equipment items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch('/api/equipment/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemName,
          category: itemCategory,
          description: itemDesc,
          requires_variant: requiresVariant,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat master perlengkapan');

      setShowItemModal(false);
      setItemName('');
      setItemDesc('');
      setRequiresVariant(false);
      setMessage({ type: 'success', text: 'Master perlengkapan berhasil dibuat.' });
      fetchItems();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveItem = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin mengarsipkan item perlengkapan ini?')) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/equipment/master/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengarsipkan');
      setMessage({ type: 'success', text: 'Item berhasil diarsipkan.' });
      fetchItems();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantModal || !variantModal.newLabel.trim()) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/equipment/master/${variantModal.item.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: variantModal.newLabel.trim(), sort_order: variantModal.variants.length + 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah varian');

      const updatedVariants = [...variantModal.variants, data.variant];
      setVariantModal({ ...variantModal, variants: updatedVariants, newLabel: '' });
      fetchItems();
    } catch (err: any) {
      alert(err.message);
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
              <Luggage className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">Master Perlengkapan & Ukuran</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola katalog master barang, kategori, dan pilihan varian ukuran (S, M, L, XL, XXL, dll.) yang dapat digunakan pada paket Umrah.
          </p>
        </div>

        <button
          onClick={() => setShowItemModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Master Item</span>
        </button>
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

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">Katalog Master Perlengkapan</h2>
          <span className="text-xs text-slate-500">{items.length} Master Item Aktif</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nama Item</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Deskripsi</th>
                <th className="py-3 px-4">Ukuran / Varian</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{item.name}</td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-500">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">{item.category}</span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500">{item.description || '-'}</td>
                  <td className="py-3.5 px-4">
                    {item.requires_variant ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.variants?.map((v) => (
                          <span key={v.id} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded text-xs border border-emerald-200">
                            {v.label}
                          </span>
                        ))}
                        <button
                          onClick={() => setVariantModal({ item, variants: item.variants || [], newLabel: '' })}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition"
                        >
                          + Kelola Size
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Tanpa Varian</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleArchiveItem(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition rounded"
                      title="Arsipkan Master Item"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Master Item */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Tambah Master Perlengkapan</h3>
            <p className="text-xs text-slate-500 mb-5">Tambahkan item perlengkapan baru ke katalog travel.</p>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Nama Item *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jaket Parasut, Kain Ihram..."
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Kategori *</label>
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value as EquipmentCategory)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="BAG">BAG (Tas / Koper)</option>
                  <option value="APPAREL">APPAREL (Baju / Seragam / Batik)</option>
                  <option value="IBADAH">IBADAH (Kain Ihram / Mukena)</option>
                  <option value="IDENTITY">IDENTITY (ID Card / Tali)</option>
                  <option value="DOCUMENT">DOCUMENT (Buku Doa / Panduan)</option>
                  <option value="ACCESSORY">ACCESSORY (Syal / Botol / Bantal)</option>
                  <option value="OTHER">OTHER (Lain-lain)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan spesifikasi item..."
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="requiresVariant"
                  checked={requiresVariant}
                  onChange={(e) => setRequiresVariant(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="requiresVariant" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Item ini membutuhkan pilihan ukuran/varian (contoh: S, M, L, XL)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || !itemName.trim()}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Manage Variants */}
      {variantModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Kelola Varian / Ukuran</h3>
            <p className="text-xs text-slate-500 mb-4">{variantModal.item.name}</p>

            {/* List existing variants */}
            <div className="space-y-2 mb-5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Varian Tersedia</label>
              <div className="flex flex-wrap gap-2">
                {variantModal.variants.map((v) => (
                  <span key={v.id} className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-800">
                    {v.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Add new variant form */}
            <form onSubmit={handleAddVariant} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Tambah ukuran baru (misal: 4XL, 28 Inch)..."
                value={variantModal.newLabel}
                onChange={(e) => setVariantModal({ ...variantModal, newLabel: e.target.value })}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={saving || !variantModal.newLabel.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                + Tambah
              </button>
            </form>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
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
    </div>
  );
}
