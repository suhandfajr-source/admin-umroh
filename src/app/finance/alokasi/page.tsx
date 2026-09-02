'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Split, 
  CreditCard, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Receipt,
  Search,
  ArrowRight,
  RefreshCw,
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRupiah, parseRupiahInput } from '@/lib/currency';
import { Payment, Invoice, PIC, Package } from '@/types/database.types';

function AllocationWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPaymentId = searchParams.get('payment_id') || '';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState(initialPaymentId);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pics, setPics] = useState<PIC[]>([]);
  const [loading, setLoading] = useState(true);

  // Allocation Mode: 'SINGLE' | 'MULTI' | 'PIC'
  const [mode, setMode] = useState<'SINGLE' | 'MULTI' | 'PIC'>('MULTI');
  const [selectedPicFilter, setSelectedPicFilter] = useState('');

  // Allocation Inputs state: Map<invoiceId, inputString>
  const [allocInputs, setAllocInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [payRes, invRes, picRes] = await Promise.all([
          fetch('/api/finance/payments'),
          fetch('/api/finance/invoices'),
          fetch('/api/pics')
        ]);

        if (payRes.ok) {
          const payData = await payRes.json();
          // Filter to non-cancelled payments with remaining unallocated balance
          const available = payData.filter((p: Payment) => p.status !== 'CANCELLED' && p.remaining_unallocated > 0);
          setPayments(available);

          if (initialPaymentId) {
            const found = payData.find((p: Payment) => p.id === initialPaymentId);
            if (found) setSelectedPayment(found);
          } else if (available.length > 0) {
            setSelectedPaymentId(available[0].id);
            setSelectedPayment(available[0]);
          }
        }

        if (invRes.ok) {
          const invData = await invRes.json();
          setInvoices(invData);
        }

        if (picRes.ok) {
          const picData = await picRes.json();
          setPics(picData);
        }
      } catch (err) {
        console.error('Error loading allocation data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [initialPaymentId]);

  const handlePaymentChange = (id: string) => {
    setSelectedPaymentId(id);
    const found = payments.find(p => p.id === id) || null;
    setSelectedPayment(found);
    setAllocInputs({});
    setSuccessMessage(null);
  };

  const handleInputChange = (invoiceId: string, value: string) => {
    setAllocInputs(prev => ({
      ...prev,
      [invoiceId]: value,
    }));
  };

  // Compute total allocation input
  const totalInputAllocated = Object.entries(allocInputs).reduce((sum, [_, val]) => {
    return sum + parseRupiahInput(val);
  }, 0);

  const remainingAfterInput = (selectedPayment?.remaining_unallocated || 0) - totalInputAllocated;
  const isOverAllocated = remainingAfterInput < 0;

  // Auto Distribute Helper
  const handleAutoDistribute = async () => {
    if (!selectedPayment) return;

    try {
      let targetInvoices = filteredInvoices.filter(i => i.outstanding > 0);
      const res = await fetch('/api/finance/auto-distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: selectedPayment.id,
          target_invoice_ids: targetInvoices.map(i => i.id)
        })
      });

      if (res.ok) {
        const preview: { invoiceId: string; suggestedAmount: number }[] = await res.json();
        const newInputs: Record<string, string> = {};
        for (const item of preview) {
          newInputs[item.invoiceId] = item.suggestedAmount.toLocaleString('id-ID');
        }
        setAllocInputs(newInputs);
      }
    } catch (e) {
      console.error('Auto-distribute error:', e);
    }
  };

  // Submit Allocations
  const handleSubmitAllocations = async () => {
    if (!selectedPayment) return;
    if (totalInputAllocated <= 0) {
      alert('Masukkan minimal satu nominal alokasi jamaah');
      return;
    }
    if (isOverAllocated) {
      alert('Total alokasi melebihi sisa dana pembayaran yang tersedia!');
      return;
    }

    try {
      setSubmitting(true);
      const allocationsPayload = Object.entries(allocInputs)
        .map(([invoiceId, val]) => ({
          invoiceId,
          amount: parseRupiahInput(val),
        }))
        .filter(a => a.amount > 0);

      const res = await fetch(`/api/finance/payments/${selectedPayment.id}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: allocationsPayload })
      });

      if (res.ok) {
        const updatedPayment = await res.json();
        setSuccessMessage(`Berhasil mengalokasikan ${formatRupiah(totalInputAllocated)} kepada ${allocationsPayload.length} tagihan jamaah.`);
        setAllocInputs({});
        // Reload fresh data
        const [payRes, invRes] = await Promise.all([
          fetch('/api/finance/payments'),
          fetch('/api/finance/invoices')
        ]);
        if (payRes.ok) {
          const payData = await payRes.json();
          const available = payData.filter((p: Payment) => p.status !== 'CANCELLED' && p.remaining_unallocated > 0);
          setPayments(available);
          const current = payData.find((p: Payment) => p.id === selectedPayment.id) || available[0] || null;
          setSelectedPayment(current);
          if (current) setSelectedPaymentId(current.id);
        }
        if (invRes.ok) {
          setInvoices(await invRes.json());
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Gagal menyimpan alokasi');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter invoices according to Mode & Selection
  let filteredInvoices = invoices.filter(i => {
    // If payment is scoped to package, show only that package
    if (selectedPayment?.package_id && i.participant?.package_id !== selectedPayment.package_id) {
      return false;
    }
    return true;
  });

  if (mode === 'PIC' && selectedPicFilter) {
    filteredInvoices = filteredInvoices.filter(i => i.participant?.pic_id === selectedPicFilter);
  }

  if (loading) {
    return <LoadingSpinner label="Menyiapkan workspace alokasi pembayaran..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Split className="w-7 h-7 text-emerald-600" />
            Workspace Alokasi Pembayaran
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Distribusi 1 transfer pembayaran bank ke tagihan satu atau banyak jamaah, atau rombongan kolektif PIC.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center text-slate-400">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-slate-800 text-base">Tidak Ada Pembayaran yang Perlu Dialokasikan</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Semua transfer masuk sudah teralokasi 100%.</p>
          <Link
            href="/finance/pembayaran"
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Catat Pembayaran Masuk Baru
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Payment Selector & Balance Card */}
          <div className="space-y-4">
            {/* Payment Selection Box */}
            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Pilih Pembayaran Sumber
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Daftar Transfer Belum Selesai</label>
                <select
                  value={selectedPaymentId}
                  onChange={(e) => handlePaymentChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500"
                >
                  {payments.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.payment_date} — {p.sender_name} ({formatRupiah(p.remaining_unallocated)} sisa)
                    </option>
                  ))}
                </select>
              </div>

              {selectedPayment && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Nilai Transfer</span>
                    <span className="font-bold text-slate-900">{formatRupiah(selectedPayment.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Telah Dialokasikan</span>
                    <span className="font-semibold text-emerald-700">{formatRupiah(selectedPayment.total_allocated)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-700">Sisa Dana Tersedia</span>
                    <span className="font-bold text-sm text-emerald-800">{formatRupiah(selectedPayment.remaining_unallocated)}</span>
                  </div>
                  {selectedPayment.notes && (
                    <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                      &ldquo;{selectedPayment.notes}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Live Calculation Summary */}
            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
              <h2 className="font-bold text-slate-900 text-sm">Ringkasan Alokasi</h2>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Input Alokasi</span>
                  <span className="font-bold text-slate-900">{formatRupiah(totalInputAllocated)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-700">Sisa Dana Setelah Alokasi</span>
                  <span className={`font-bold text-sm ${isOverAllocated ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatRupiah(remainingAfterInput)}
                  </span>
                </div>
              </div>

              {isOverAllocated && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Total alokasi melebihi dana tersedia! Kurangi nominal input.</span>
                </div>
              )}

              <button
                onClick={handleSubmitAllocations}
                disabled={submitting || totalInputAllocated <= 0 || isOverAllocated}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-900/20"
              >
                {submitting ? 'Memproses Alokasi...' : 'Simpan & Terapkan Alokasi'}
              </button>
            </div>
          </div>

          {/* Right Column: Roster & Allocation Inputs */}
          <div className="lg:col-span-2 space-y-4">
            {/* Mode Selector & Action Toolbar */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700">
                <button
                  onClick={() => setMode('MULTI')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${mode === 'MULTI' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                >
                  Bebas / Multi-Jamaah
                </button>
                <button
                  onClick={() => setMode('PIC')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${mode === 'PIC' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                >
                  Kolektif PIC
                </button>
              </div>

              <div className="flex items-center gap-2">
                {mode === 'PIC' && (
                  <select
                    value={selectedPicFilter}
                    onChange={(e) => setSelectedPicFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih PIC Rombongan --</option>
                    {pics.map(pic => (
                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                    ))}
                  </select>
                )}

                <button
                  onClick={handleAutoDistribute}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Auto-Distribute (Saran)
                </button>
              </div>
            </div>

            {/* Invoices Table with Allocation Inputs */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Daftar Tagihan Jamaah ({filteredInvoices.length})</span>
                <span className="text-slate-500">Masukkan nominal dana yang dialokasikan</span>
              </div>

              {filteredInvoices.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Tidak ada jamaah yang cocok dengan filter alokasi.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Nama Jamaah & Paket</th>
                        <th className="py-3 px-4 text-right">Total Tagihan</th>
                        <th className="py-3 px-4 text-right">Sudah Dibayar</th>
                        <th className="py-3 px-4 text-right">Sisa Tagihan</th>
                        <th className="py-3 px-4 text-right min-w-[180px]">Nominal Alokasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInvoices.map((inv) => {
                        const currentInput = allocInputs[inv.id] || '';
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-900">
                                {inv.participant?.jamaah?.identity_name || inv.participant?.jamaah?.passport_name || 'Jamaah'}
                              </p>
                              <p className="text-slate-400 text-[11px]">
                                {inv.participant?.package?.package_name || '-'} • PIC: {inv.participant?.pic?.name || 'Langsung'}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-slate-700 whitespace-nowrap">
                              {formatRupiah(inv.total_amount)}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-emerald-700 whitespace-nowrap">
                              {formatRupiah(inv.total_paid)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-rose-700 whitespace-nowrap">
                              {formatRupiah(inv.outstanding)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-slate-400 font-semibold">Rp</span>
                                <input
                                  type="text"
                                  placeholder="0"
                                  value={currentInput}
                                  onChange={(e) => handleInputChange(inv.id, e.target.value)}
                                  className="w-32 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-right focus:bg-white focus:ring-2 focus:ring-emerald-500"
                                />
                                {inv.outstanding > 0 && (
                                  <button
                                    onClick={() => handleInputChange(inv.id, Math.min(selectedPayment?.remaining_unallocated || 0, inv.outstanding).toLocaleString('id-ID'))}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-semibold transition-colors"
                                    title="Alokasikan penuh sesuai sisa tagihan"
                                  >
                                    Max
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentAllocationPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Memuat workspace alokasi..." />}>
      <AllocationWorkspaceContent />
    </Suspense>
  );
}
