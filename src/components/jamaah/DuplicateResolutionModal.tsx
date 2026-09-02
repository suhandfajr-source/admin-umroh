'use client';

import React from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { AlertTriangle, ArrowRight, CheckCircle2, UserCheck, UserPlus, X } from 'lucide-react';
import { DuplicateMatchDetail } from '@/types/document.types';

interface DuplicateResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchDetail: DuplicateMatchDetail;
  newFields: Record<string, any>;
  onUpdateExisting: () => void;
  onCreateNew: () => void;
}

export const DuplicateResolutionModal: React.FC<DuplicateResolutionModalProps> = ({
  isOpen,
  onClose,
  matchDetail,
  newFields,
  onUpdateExisting,
  onCreateNew,
}) => {
  const existing = matchDetail.existing_record;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Peringatan: Kemungkinan Duplikasi Jamaah Ditemukan"
      subtitle="Sistem mendeteksi kecocokan data dengan Master Jamaah yang sudah ada di database."
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Warning Banner */}
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900 mb-0.5">Kecocokan Terdeteksi: {matchDetail.matched_field}</p>
            <p>{matchDetail.reason}</p>
          </div>
        </div>

        {/* Side by Side Comparison Card */}
        <div className="grid grid-cols-2 gap-4">
          {/* Existing Master Profile */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700">Data Master Jamaah Lama</span>
              <Badge variant="neutral">Existing</Badge>
            </div>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Nama Master:</span>
                <span className="font-semibold text-slate-800">{existing.identity_name || existing.passport_name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">No. Paspor:</span>
                <span className="font-mono text-slate-800">{existing.passport_number || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">NIK:</span>
                <span className="font-mono text-slate-800">{existing.nik || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Tempat / Tgl Lahir:</span>
                <span className="text-slate-800">{existing.birth_place || '-'}, {existing.birth_date || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Expiry Paspor Lama:</span>
                <span className="text-slate-800">{existing.passport_expiry_date || '-'}</span>
              </div>
            </div>
          </div>

          {/* New Extraction Data */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
              <span className="text-xs font-bold text-emerald-900">Data Baru dari Dokumen</span>
              <Badge variant="success">Baru</Badge>
            </div>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-emerald-700/70 block text-[10px]">Nama Dokumen:</span>
                <span className="font-semibold text-emerald-950">{newFields.passport_name || newFields.ktp_name || newFields.identity_name || '-'}</span>
              </div>
              <div>
                <span className="text-emerald-700/70 block text-[10px]">No. Paspor Baru:</span>
                <span className="font-mono text-emerald-950 font-semibold">{newFields.passport_number || '-'}</span>
              </div>
              <div>
                <span className="text-emerald-700/70 block text-[10px]">NIK:</span>
                <span className="font-mono text-emerald-950">{newFields.nik || '-'}</span>
              </div>
              <div>
                <span className="text-emerald-700/70 block text-[10px]">Tempat / Tgl Lahir:</span>
                <span className="text-emerald-950">{newFields.birth_place || '-'}, {newFields.birth_date || '-'}</span>
              </div>
              <div>
                <span className="text-emerald-700/70 block text-[10px]">Expiry Paspor Baru:</span>
                <span className="font-semibold text-emerald-950">{newFields.passport_expiry_date || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Decision Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCreateNew}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-4 h-4 text-slate-600" />
              <span>Tetap Buat Master Baru</span>
            </button>

            <button
              type="button"
              onClick={onUpdateExisting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-900/20 flex items-center gap-1.5 transition-all"
            >
              <UserCheck className="w-4 h-4" />
              <span>Update Existing Jamaah (Disarankan)</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
