'use client';

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar, 
  User, 
  Package as PackageIcon, 
  FileText, 
  Receipt, 
  CreditCard, 
  Luggage, 
  Eye,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { AuditLog } from '@/types/database.types';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (actionFilter !== 'ALL') params.append('action', actionFilter);
      if (entityFilter !== 'ALL') params.append('entityType', entityFilter);
      params.append('limit', '100');

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter]);

  const filteredLogs = logs.filter(l => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      (l.actor_name && l.actor_name.toLowerCase().includes(q)) ||
      (l.jamaah_name && l.jamaah_name.toLowerCase().includes(q)) ||
      (l.package_name && l.package_name.toLowerCase().includes(q)) ||
      l.entity_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <History className="w-7 h-7 text-emerald-600" />
            <span>Audit Trail & Activity Log</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Riwayat seluruh perubahan data, transaksi, verifikasi dokumen, dan aktivitas operasional.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Log</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari aktor, jamaah, ID..."
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="ALL">Semua Aksi (Actions)</option>
            <option value="DOCUMENT_CONFIRMED">DOCUMENT_CONFIRMED</option>
            <option value="PASSPORT_REPLACED">PASSPORT_REPLACED</option>
            <option value="PAYMENT_CREATED">PAYMENT_CREATED</option>
            <option value="PAYMENT_ALLOCATED">PAYMENT_ALLOCATED</option>
            <option value="PAYMENT_CANCELLED">PAYMENT_CANCELLED</option>
            <option value="EQUIPMENT_PREPARED">EQUIPMENT_PREPARED</option>
            <option value="EQUIPMENT_HANDED_OVER">EQUIPMENT_HANDED_OVER</option>
            <option value="MANIFEST_EXPORTED">MANIFEST_EXPORTED</option>
            <option value="DOCUMENT_ZIP_EXPORTED">DOCUMENT_ZIP_EXPORTED</option>
            <option value="ALERT_DISMISSED">ALERT_DISMISSED</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="ALL">Semua Entitas</option>
            <option value="JAMAAH">JAMAAH</option>
            <option value="PAYMENT">PAYMENT</option>
            <option value="PAYMENT_ALLOCATION">PAYMENT_ALLOCATION</option>
            <option value="PARTICIPANT_EQUIPMENT">PARTICIPANT_EQUIPMENT</option>
            <option value="PACKAGE_MANIFEST">PACKAGE_MANIFEST</option>
            <option value="DOCUMENT_ARCHIVE">DOCUMENT_ARCHIVE</option>
            <option value="OPERATIONAL_ALERT">OPERATIONAL_ALERT</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="py-16 text-center">
          <LoadingSpinner size="md" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Tidak Ada Log Audit</h3>
          <p className="text-xs text-slate-500">Belum ada rekaman audit trail untuk filter yang dipilih.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold">
                  <th className="py-3 px-4">Waktu (WIB)</th>
                  <th className="py-3 px-4">Aksi / Event</th>
                  <th className="py-3 px-4">Entitas</th>
                  <th className="py-3 px-4">Konteks Jamaah / Paket</th>
                  <th className="py-3 px-4">Aktor Admin</th>
                  <th className="py-3 px-4 text-right">Detail Diffs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{log.action}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral">{log.entity_type}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      {log.jamaah_name && (
                        <span className="font-bold text-slate-800 block">{log.jamaah_name}</span>
                      )}
                      {log.package_name && (
                        <span className="text-[11px] text-slate-500">{log.package_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.actor_name || 'Admin System'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspeksi</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Diff Inspector Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Inspeksi Audit Trail — ${selectedLog.action}`}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">ID Log:</span>
                <span className="font-mono text-slate-800 font-bold">{selectedLog.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Waktu Mutasi:</span>
                <span className="text-slate-800 font-bold">{new Date(selectedLog.created_at).toLocaleString('id-ID')}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Entitas & ID:</span>
                <span className="text-slate-800 font-bold">{selectedLog.entity_type} ({selectedLog.entity_id})</span>
              </div>
              <div>
                <span className="text-slate-400 block">Aktor:</span>
                <span className="text-slate-800 font-bold">{selectedLog.actor_name || 'Admin'}</span>
              </div>
            </div>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700">Metadata Transaksi:</span>
                <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.before_data && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700">Data Sebelum (Before Snapshot):</span>
                <pre className="p-3 bg-slate-900 text-rose-300 rounded-xl text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.before_data, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.after_data && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700">Data Sesudah (After Snapshot):</span>
                <pre className="p-3 bg-slate-900 text-sky-300 rounded-xl text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.after_data, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
