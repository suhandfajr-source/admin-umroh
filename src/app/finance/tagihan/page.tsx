'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Receipt, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Tag,
  ArrowRight,
  RefreshCw,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRupiah, parseRupiahInput, formatInputNumber } from '@/lib/currency';
import { Invoice, InvoiceItemType, InvoiceStatus, Package } from '@/types/database.types';

function InvoicesContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') as InvoiceStatus | null;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | ''>(initialStatus || '');

  // Selected Invoice Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemType, setItemType] = useState<InvoiceItemType>('CHARGE');
  const [itemDesc, setItemDesc] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [submittingItem, setSubmittingItem] = useState(false);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedPackage) params.set('package_id', selectedPackage);
      if (selectedStatus) params.set('status', selectedStatus);

      const [invRes, pkgRes] = await Promise.all([
        fetch(`/api/finance/invoices?${params.toString()}`),
        fetch('/api/packages')
      ]);

      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(data);
      }
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        setPackages(pkgData);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [selectedPackage, selectedStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadInvoices();
  };

  const openInvoiceDetail = async (inv: Invoice) => {
    try {
      const res = await fetch(`/api/finance/invoices/${inv.id}`);
      if (res.ok) {
        const fresh = await res.json();
        setSelectedInvoice(fresh);
      } else {
        setSelectedInvoice(inv);
      }
    } catch (e) {
      setSelectedInvoice(inv);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !itemDesc.trim() || !itemAmount) return;

    try {
      setSubmittingItem(true);
      const numericAmount = parseRupiahInput(itemAmount);
      const res = await fetch(`/api/finance/invoices/${selectedInvoice.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: itemType,
          description: itemDesc.trim(),
          amount: numericAmount,
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedInvoice(updated);
        setShowItemModal(false);
        setItemDesc('');
        setItemAmount('');
        loadInvoices();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Gagal menambahkan item rincian');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmittingItem(false);
    }
  };

  const renderStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">Lunas</Badge>;
      case 'PARTIAL':
        return <Badge variant="warning">Cicilan</Badge>;
      case 'UNPAID':
        return <Badge variant="danger">Belum Bayar</Badge>;
      case 'OVERPAID':
        return <Badge variant="brand">Lebih Bayar</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-emerald-600" />
            Daftar Tagihan Jamaah
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Kelola tagihan dasar paket, tambahan biaya kamar/handling, diskon PIC, dan status pembayaran jamaah.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Nama Jamaah, Paket, atau PIC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Paket Umrah</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>{pkg.package_name}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Status</option>
              <option value="UNPAID">Belum Bayar</option>
              <option value="PARTIAL">Cicilan</option>
              <option value="PAID">Lunas</option>
              <option value="OVERPAID">Lebih Bayar</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner label="Memuat data tagihan..." />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-base">Tidak ada data tagihan</p>
            <p className="text-xs text-slate-400 mt-1">Pastikan jamaah telah didaftarkan ke paket umrah.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Nama Jamaah</th>
                  <th className="py-3.5 px-4">Paket & PIC</th>
                  <th className="py-3.5 px-4 text-right">Harga Dasar</th>
                  <th className="py-3.5 px-4 text-right">Total Tagihan</th>
                  <th className="py-3.5 px-4 text-right">Sudah Dibayar</th>
                  <th className="py-3.5 px-4 text-right">Sisa Tagihan</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link 
                        href={`/jamaah/${inv.participant?.jamaah_id}`}
                        className="font-bold text-slate-900 hover:text-emerald-600 transition-colors block"
                      >
                        {inv.participant?.jamaah?.identity_name || inv.participant?.jamaah?.passport_name || 'Jamaah'}
                      </Link>
                      {inv.participant?.jamaah?.passport_number && (
                        <p className="text-slate-400 text-[11px] font-mono mt-0.5">
                          {inv.participant.jamaah.passport_number}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <p className="font-medium text-slate-800">{inv.participant?.package?.package_name || '-'}</p>
                      <p className="text-[11px] text-slate-400">PIC: {inv.participant?.pic?.name || 'Langsung'}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600 whitespace-nowrap">
                      {formatRupiah(inv.base_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatRupiah(inv.total_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-700 whitespace-nowrap">
                      {formatRupiah(inv.total_paid)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-700 whitespace-nowrap">
                      {inv.outstanding > 0 ? formatRupiah(inv.outstanding) : (
                        inv.overpayment > 0 ? (
                          <span className="text-purple-700">+{formatRupiah(inv.overpayment)}</span>
                        ) : 'Rp 0'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {renderStatusBadge(inv.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => openInvoiceDetail(inv)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Rincian
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`Rincian Tagihan — ${selectedInvoice.participant?.jamaah?.identity_name || 'Jamaah'}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Header info */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-slate-500 font-medium">Paket Umrah</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedInvoice.participant?.package?.package_name || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">PIC Rombongan</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedInvoice.participant?.pic?.name || 'Langsung'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Status Pembayaran</p>
                <div className="mt-1">{renderStatusBadge(selectedInvoice.status)}</div>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Sisa Tagihan</p>
                <p className="font-bold text-rose-700 text-sm mt-0.5">
                  {selectedInvoice.outstanding > 0 ? formatRupiah(selectedInvoice.outstanding) : (
                    selectedInvoice.overpayment > 0 ? `Lebih ${formatRupiah(selectedInvoice.overpayment)}` : 'Lunas (Rp 0)'
                  )}
                </p>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  Komponen & Rincian Biaya
                </h3>
                <button
                  onClick={() => setShowItemModal(true)}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Biaya / Diskon
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Komponen</th>
                      <th className="py-2.5 px-3">Tipe</th>
                      <th className="py-2.5 px-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">Harga Dasar Paket (Selling Price)</td>
                      <td className="py-2.5 px-3"><Badge variant="neutral">BASE</Badge></td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatRupiah(selectedInvoice.base_amount)}</td>
                    </tr>
                    {selectedInvoice.items && selectedInvoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 text-slate-700">{item.description}</td>
                        <td className="py-2.5 px-3">
                          {item.type === 'CHARGE' && <Badge variant="danger">+ CHARGE</Badge>}
                          {item.type === 'DISCOUNT' && <Badge variant="success">- DISCOUNT</Badge>}
                          {item.type === 'ADJUSTMENT' && <Badge variant="info">ADJUSTMENT</Badge>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                          {item.type === 'DISCOUNT' ? `-${formatRupiah(item.amount)}` : (
                            item.amount < 0 ? `-${formatRupiah(Math.abs(item.amount))}` : `+${formatRupiah(item.amount)}`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3">TOTAL TAGIHAN</td>
                      <td className="py-2.5 px-3 text-right text-sm text-emerald-800">{formatRupiah(selectedInvoice.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payment Allocations History */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                Riwayat Pembayaran Masuk
              </h3>

              {(!selectedInvoice.allocations || selectedInvoice.allocations.length === 0) ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
                  Belum ada pembayaran yang dialokasikan ke tagihan ini.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">ID Pembayaran</th>
                        <th className="py-2.5 px-3">Status Alokasi</th>
                        <th className="py-2.5 px-3 text-right">Nominal Dialokasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.allocations.map((alloc) => (
                        <tr key={alloc.id}>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{alloc.payment_id}</td>
                          <td className="py-2.5 px-3">
                            {alloc.status === 'ACTIVE' ? (
                              <Badge variant="success">Aktif</Badge>
                            ) : (
                              <Badge variant="danger">Dibatalkan</Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {formatRupiah(alloc.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3">TOTAL SUDAH DIBAYAR</td>
                        <td className="py-2.5 px-3 text-right text-sm text-emerald-700">{formatRupiah(selectedInvoice.total_paid)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Invoice Item Sub-Modal */}
      {showItemModal && selectedInvoice && (
        <Modal
          isOpen={showItemModal}
          onClose={() => setShowItemModal(false)}
          title="Tambah Rincian Biaya / Diskon"
          size="md"
        >
          <form onSubmit={handleAddItem} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tipe Penyesuaian</label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              >
                <option value="CHARGE">Biaya Tambahan (+ Penambah Tagihan)</option>
                <option value="DISCOUNT">Diskon (- Pengurang Tagihan)</option>
                <option value="ADJUSTMENT">Koreksi / Penyesuaian Khusus</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Deskripsi Rincian</label>
              <input
                type="text"
                placeholder="Contoh: Upgrade Kamar Double, Handling Bandara, Diskon PIC..."
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nominal (Rupiah)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 1.500.000"
                value={itemAmount}
                onChange={(e) => setItemAmount(formatInputNumber(e.target.value))}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Akan otomatis dihitung secara matematis ke Total Tagihan.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingItem}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm transition-all"
              >
                {submittingItem ? 'Menyimpan...' : 'Simpan Rincian'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Memuat halaman tagihan..." />}>
      <InvoicesContent />
    </Suspense>
  );
}
