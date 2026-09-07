'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Filter, 
  Search, 
  RefreshCw, 
  ArrowUpRight,
  Package as PackageIcon,
  User,
  Calendar,
  XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { OperationalAlert, Package } from '@/types/database.types';
import { fetchWithCache, invalidateCache } from '@/lib/cache/client-cache';

export default function ActionCenterPage() {
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED'>('OPEN');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [packageFilter, setPackageFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedDismissAlert, setSelectedDismissAlert] = useState<OperationalAlert | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [dismissSubmitting, setDismissSubmitting] = useState(false);

  const fetchAlerts = async (forceRefresh = false) => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (severityFilter !== 'ALL') params.append('severity', severityFilter);
      if (packageFilter !== 'ALL') params.append('packageId', packageFilter);

      const [alertsJson, pkgsJson] = await Promise.all([
        fetchWithCache<{ alerts: OperationalAlert[] }>(`/api/intelligence/actions?${params.toString()}`, {
          forceRefresh,
          onBackgroundUpdate: (fresh) => { if (fresh?.alerts) setAlerts(fresh.alerts); },
        }),
        fetchWithCache<Package[]>('/api/packages', {
          forceRefresh,
          onBackgroundUpdate: (fresh) => { if (fresh) setPackages(fresh); },
        }),
      ]);

      if (alertsJson?.alerts) setAlerts(alertsJson.alerts);
      if (Array.isArray(pkgsJson)) setPackages(pkgsJson);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, categoryFilter, severityFilter, packageFilter]);

  const handleDismiss = async () => {
    if (!selectedDismissAlert || !dismissReason.trim()) return;

    try {
      setDismissSubmitting(true);
      const res = await fetch(`/api/intelligence/alerts/${selectedDismissAlert.id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: dismissReason.trim() }),
      });

      if (res.ok) {
        setSelectedDismissAlert(null);
        setDismissReason('');
        invalidateCache('/api/intelligence/actions');
        await fetchAlerts(true);
      } else {
        const json = await res.json();
        alert(json.error || 'Gagal dismiss alert');
      }
    } catch (err) {
      alert('Terjadi kesalahan');
    } finally {
      setDismissSubmitting(false);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      (a.jamaah_name && a.jamaah_name.toLowerCase().includes(q)) ||
      (a.package_name && a.package_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-emerald-600" />
            <span>Action Center Triage</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pusat penanganan seluruh peringatan dan kendala operasional travel umroh.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
          {(['OPEN', 'RESOLVED', 'DISMISSED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {st === 'OPEN' ? 'Aktif (Open)' : st === 'RESOLVED' ? 'Terselesaikan' : 'Di-dismiss'}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari jamaah, paket, atau isu..."
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="PASSPORT">Paspor & Dokumen</option>
            <option value="FINANCE">Keuangan & Tagihan</option>
            <option value="MANIFEST">Manifest Penerbangan</option>
            <option value="EQUIPMENT">Perlengkapan Jamaah</option>
            <option value="DOCUMENT">Review Dokumen</option>
            <option value="PACKAGE">Paket Keberangkatan</option>
          </select>

          {/* Severity */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="ALL">Semua Severity</option>
            <option value="CRITICAL">Critical (Blocker)</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          {/* Package */}
          <select
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
            className="text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="ALL">Semua Paket</option>
            {packages.map(p => (
              <option key={p.id} value={p.id}>{p.package_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="py-16 text-center">
          <LoadingSpinner size="md" />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Tidak Ada Action Items</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tidak ditemukan peringatan operasional pada filter yang dipilih.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWarning = alert.severity === 'WARNING';

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border bg-white shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isCritical ? 'border-rose-200 hover:border-rose-300' : isWarning ? 'border-amber-200 hover:border-amber-300' : 'border-slate-200'
                }`}
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isCritical ? 'danger' : isWarning ? 'warning' : 'neutral'}>
                      {alert.severity}
                    </Badge>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {alert.category}
                    </span>
                    {alert.package_name && (
                      <span className="text-xs text-slate-600 font-semibold flex items-center gap-1">
                        <PackageIcon className="w-3.5 h-3.5 text-slate-400" />
                        {alert.package_name}
                      </span>
                    )}
                    {alert.jamaah_name && (
                      <span className="text-xs text-slate-600 font-semibold flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {alert.jamaah_name}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-slate-900">{alert.title}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{alert.description}</p>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-3">
                    <span>Terdeteksi: {new Date(alert.first_detected_at).toLocaleString('id-ID')}</span>
                    {alert.reopen_count > 0 && (
                      <span className="text-rose-600 font-bold">Reopened {alert.reopen_count}x</span>
                    )}
                    {alert.dismiss_reason && (
                      <span className="text-amber-700 italic">Alasan dismiss: "{alert.dismiss_reason}"</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {alert.action_url && (
                    <Link
                      href={alert.action_url}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <span>{alert.action_label || 'Tindak Lanjuti'}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {statusFilter === 'OPEN' && !isCritical && (
                    <button
                      onClick={() => {
                        setSelectedDismissAlert(alert);
                        setDismissReason('');
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dismiss Modal */}
      {selectedDismissAlert && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDismissAlert(null)}
          title="Dismiss Peringatan Operasional"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <span className="font-bold block">{selectedDismissAlert.title}</span>
              <p>{selectedDismissAlert.description}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Alasan Dismissal (Wajib Diisi)</label>
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Tulis alasan mengapa isu ini di-dismiss..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedDismissAlert(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={dismissSubmitting || !dismissReason.trim()}
                onClick={handleDismiss}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
              >
                {dismissSubmitting ? 'Memproses...' : 'Konfirmasi Dismiss'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
