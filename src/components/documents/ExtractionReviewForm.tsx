'use client';

import React, { useState } from 'react';
import { DocumentType } from '@/types/database.types';
import { DocumentExtractionResult, DuplicateMatchDetail, KkFamilyMember, FieldSource, FieldConfidence } from '@/types/document.types';
import { Badge } from '../ui/Badge';
import { KkMembersSelector } from './KkMembersSelector';
import { DuplicateResolutionModal } from '../jamaah/DuplicateResolutionModal';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Save, 
  Sparkles, 
  User, 
  CreditCard, 
  Users, 
  FileText,
  ShieldCheck,
  HelpCircle,
  MapPin
} from 'lucide-react';
import { composeKtpAddress, parseKtpAddress } from '@/lib/address-helpers';

interface ExtractionReviewFormProps {
  documentId: string;
  initialType: DocumentType;
  initialFields: Record<string, any>;
  confidenceScore: number;
  qualityWarnings?: string[];
  onConfirm: (payload: {
    action: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'REJECT';
    targetJamaahId?: string;
    fields: Record<string, any>;
    selectedKkMembers?: KkFamilyMember[];
  }) => Promise<void>;
  onReject: () => Promise<void>;
}

export const ExtractionReviewForm: React.FC<ExtractionReviewFormProps> = ({
  documentId,
  initialType,
  initialFields,
  confidenceScore,
  qualityWarnings = [],
  onConfirm,
  onReject,
}) => {
  const [docType, setDocType] = useState<DocumentType>(initialType || 'PASSPORT');
  const [fields, setFields] = useState<Record<string, any>>({ ...initialFields });
  const [kkMembers, setKkMembers] = useState<KkFamilyMember[]>(initialFields.members || []);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatchDetail | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fieldSources: Record<string, FieldSource> = initialFields.field_sources || {};
  const fieldConfidences: Record<string, FieldConfidence> = initialFields.field_confidences || {};

  const handleFieldChange = (key: string, val: any) => {
    setFields(prev => ({ 
      ...prev, 
      [key]: val,
      field_sources: { ...(prev.field_sources || {}), [key]: 'MANUAL' },
      field_confidences: { ...(prev.field_confidences || {}), [key]: 'HIGH' }
    }));
  };

  const handleToggleKkMember = (index: number) => {
    setKkMembers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  const handleUpdateKkMember = (index: number, updated: Partial<KkFamilyMember>) => {
    setKkMembers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updated };
      return copy;
    });
  };

  const renderFieldBadge = (fieldKey: string, val: any) => {
    const src = (fields.field_sources && fields.field_sources[fieldKey]) || fieldSources[fieldKey];
    const conf = (fields.field_confidences && fields.field_confidences[fieldKey]) || fieldConfidences[fieldKey];

    if (!val) {
      return (
        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
          Belum terbaca yakin
        </span>
      );
    }

    if (src === 'MRZ') {
      return (
        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 flex items-center gap-0.5">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          MRZ
        </span>
      );
    }

    if (src === 'PDF_TEXT') {
      return (
        <span className="text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200 flex items-center gap-0.5">
          ✓ PDF Text
        </span>
      );
    }

    if (src === 'PDF_OCR') {
      return (
        <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200 flex items-center gap-0.5">
          ✓ PDF OCR
        </span>
      );
    }

    if (src === 'OCR_VISUAL' || src === 'OCR_ZONE' || src === 'OCR_TABLE') {
      if (conf === 'LOW') {
        return (
          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
            ⚠ Perlu dicek
          </span>
        );
      }
      return (
        <span className="text-[10px] font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-md border border-sky-200">
          ✓ OCR
        </span>
      );
    }

    if (src === 'MANUAL') {
      return (
        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
          Manual Edit
        </span>
      );
    }

    return null;
  };

  const handlePreSaveCheck = async () => {
    setIsSubmitting(true);
    try {
      // 1. Check duplicate candidate against backend
      const res = await fetch('/api/jamaah/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: {
            identity_name: fields.passport_name || fields.ktp_name || fields.identity_name,
            passport_name: fields.passport_name,
            passport_number: fields.passport_number,
            ktp_name: fields.ktp_name,
            nik: fields.nik,
            kk_number: fields.kk_number,
            birth_date: fields.birth_date,
          },
        }),
      });

      const data = await res.json();
      if (data.duplicate) {
        setDuplicateMatch(data.duplicate);
        setDuplicateModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      // No duplicate: Proceed with standard CREATE_NEW
      await onConfirm({
        action: 'CREATE_NEW',
        fields,
        selectedKkMembers: docType === 'KK' ? kkMembers.filter(m => m.selected) : undefined,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateUpdateExisting = async () => {
    if (!duplicateMatch) return;
    setDuplicateModalOpen(false);
    setIsSubmitting(true);
    try {
      await onConfirm({
        action: 'UPDATE_EXISTING',
        targetJamaahId: duplicateMatch.matched_jamaah_id,
        fields,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateCreateNew = async () => {
    setDuplicateModalOpen(false);
    setIsSubmitting(true);
    try {
      await onConfirm({
        action: 'CREATE_NEW',
        fields,
        selectedKkMembers: docType === 'KK' ? kkMembers.filter(m => m.selected) : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header with Classification & Confidence */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">Hasil Ekstraksi & Review Data</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Periksa dan lengkapi data hasil pembacaan sebelum dikonfirmasi menjadi Master Record.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Confidence:</span>
          <Badge
            variant={confidenceScore >= 80 ? 'success' : confidenceScore >= 50 ? 'warning' : 'danger'}
            size="md"
          >
            {confidenceScore}% Akurat
          </Badge>
        </div>
      </div>

      {/* Quality Warnings if any */}
      {qualityWarnings.length > 0 && (
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Perhatian Kualitas Dokumen</span>
          </div>
          <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5 pl-1">
            {qualityWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Document Type Selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Klasifikasi Jenis Dokumen
        </label>
        <div className="grid grid-cols-5 gap-2">
          {[
            { type: 'PASSPORT', label: 'Paspor', icon: FileText },
            { type: 'KTP', label: 'KTP', icon: CreditCard },
            { type: 'KK', label: 'Kartu Keluarga', icon: Users },
            { type: 'VAKSIN', label: 'Vaksin', icon: FileText },
            { type: 'BUKU_NIKAH', label: 'Buku Nikah', icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            const active = docType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setDocType(item.type as DocumentType)}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all ${
                  active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Fields Editor */}
      <div className="space-y-4 pt-2">
        {docType === 'PASSPORT' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium">
              Data Paspor adalah <strong className="text-emerald-700">Sumber Utama Data Perjalanan</strong> untuk tiket dan manifest.
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Nama Lengkap Sesuai Paspor <span className="text-rose-500">*</span>
                </label>
                {renderFieldBadge('passport_name', fields.passport_name)}
              </div>
              <input
                type="text"
                value={fields.passport_name || ''}
                onChange={(e) => handleFieldChange('passport_name', e.target.value.toUpperCase())}
                placeholder="[ kosong ] Belum terbaca dengan yakin"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase focus:outline-hidden focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Nomor Paspor <span className="text-rose-500">*</span>
                  </label>
                  {renderFieldBadge('passport_number', fields.passport_number)}
                </div>
                <input
                  type="text"
                  value={fields.passport_number || ''}
                  onChange={(e) => handleFieldChange('passport_number', e.target.value.toUpperCase())}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Jenis Kelamin (Sex) <span className="text-rose-500">*</span>
                  </label>
                  {renderFieldBadge('gender', fields.gender)}
                </div>
                <select
                  value={fields.gender || 'MALE'}
                  onChange={(e) => handleFieldChange('gender', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                >
                  <option value="MALE">Laki-Laki (M / Male)</option>
                  <option value="FEMALE">Perempuan (F / Female)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Tempat Lahir <span className="text-rose-500">*</span>
                  </label>
                  {renderFieldBadge('birth_place', fields.birth_place)}
                </div>
                <input
                  type="text"
                  value={fields.birth_place || ''}
                  onChange={(e) => handleFieldChange('birth_place', e.target.value)}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Tanggal Lahir <span className="text-rose-500">*</span>
                  </label>
                  {renderFieldBadge('birth_date', fields.birth_date)}
                </div>
                <input
                  type="date"
                  value={fields.birth_date || ''}
                  onChange={(e) => handleFieldChange('birth_date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Tempat Terbit <span className="text-rose-500">*</span>
                  </label>
                  {renderFieldBadge('passport_issue_place', fields.passport_issue_place)}
                </div>
                <input
                  type="text"
                  value={fields.passport_issue_place || ''}
                  onChange={(e) => handleFieldChange('passport_issue_place', e.target.value)}
                  placeholder="KANTOR IMIGRASI"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Tanggal Terbit <span className="text-rose-500">*</span>
                  </label>
                  {renderFieldBadge('passport_issue_date', fields.passport_issue_date)}
                </div>
                <input
                  type="date"
                  value={fields.passport_issue_date || ''}
                  onChange={(e) => handleFieldChange('passport_issue_date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Tanggal Kadaluarsa <span className="text-rose-500">*</span>
                  </label>
                  {renderFieldBadge('passport_expiry_date', fields.passport_expiry_date)}
                </div>
                <input
                  type="date"
                  value={fields.passport_expiry_date || ''}
                  onChange={(e) => handleFieldChange('passport_expiry_date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {docType === 'KTP' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    NIK (16 Digit) <span className="text-rose-500">*</span>
                  </label>
                  {renderFieldBadge('nik', fields.nik)}
                </div>
                <input
                  type="text"
                  maxLength={16}
                  value={fields.nik || ''}
                  onChange={(e) => handleFieldChange('nik', e.target.value)}
                  placeholder="3171xxxxxxxxxxxx"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Nama Sesuai KTP <span className="text-rose-500">*</span>
                  </label>
                  {renderFieldBadge('ktp_name', fields.ktp_name)}
                </div>
                <input
                  type="text"
                  value={fields.ktp_name || ''}
                  onChange={(e) => handleFieldChange('ktp_name', e.target.value)}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Tempat Lahir</label>
                  {renderFieldBadge('birth_place', fields.birth_place)}
                </div>
                <input
                  type="text"
                  value={fields.birth_place || ''}
                  onChange={(e) => handleFieldChange('birth_place', e.target.value)}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Tanggal Lahir</label>
                  {renderFieldBadge('birth_date', fields.birth_date)}
                </div>
                <input
                  type="date"
                  value={fields.birth_date || ''}
                  onChange={(e) => handleFieldChange('birth_date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Jenis Kelamin</label>
                  {renderFieldBadge('gender', fields.gender)}
                </div>
                <select
                  value={fields.gender || 'MALE'}
                  onChange={(e) => handleFieldChange('gender', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                >
                  <option value="MALE">Laki-Laki</option>
                  <option value="FEMALE">Perempuan</option>
                </select>
              </div>
            </div>

            {/* Rincian Alamat Sesuai Kolom KTP */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Rincian Alamat (Sesuai Kolom KTP)</span>
                </div>
                {renderFieldBadge('address', fields.address)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* 1. Alamat / Jalan / Blok */}
                <div className="sm:col-span-8">
                  <label className="text-[11px] font-semibold text-slate-600 mb-0.5 block">Alamat / Jalan / Blok</label>
                  <input
                    type="text"
                    value={fields.street !== undefined ? fields.street : (parseKtpAddress(fields.address).street || '')}
                    onChange={(e) => {
                      const newStreet = e.target.value;
                      const parsed = parseKtpAddress(fields.address);
                      const current = {
                        street: newStreet,
                        rt_rw: fields.rt_rw !== undefined ? fields.rt_rw : parsed.rt_rw,
                        kelurahan: fields.kelurahan !== undefined ? fields.kelurahan : parsed.kelurahan,
                        kecamatan: fields.kecamatan !== undefined ? fields.kecamatan : parsed.kecamatan,
                        city: fields.city !== undefined ? fields.city : parsed.city,
                        province: fields.province !== undefined ? fields.province : parsed.province,
                      };
                      handleFieldChange('street', newStreet);
                      handleFieldChange('address', composeKtpAddress(current));
                    }}
                    placeholder="Contoh: Jl. Melati No. 12 / Dusun Krajan"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* 2. RT / RW */}
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-semibold text-slate-600 mb-0.5 block">RT / RW</label>
                  <input
                    type="text"
                    value={fields.rt_rw !== undefined ? fields.rt_rw : (parseKtpAddress(fields.address).rt_rw || '')}
                    onChange={(e) => {
                      const newRtRw = e.target.value;
                      const parsed = parseKtpAddress(fields.address);
                      const current = {
                        street: fields.street !== undefined ? fields.street : parsed.street,
                        rt_rw: newRtRw,
                        kelurahan: fields.kelurahan !== undefined ? fields.kelurahan : parsed.kelurahan,
                        kecamatan: fields.kecamatan !== undefined ? fields.kecamatan : parsed.kecamatan,
                        city: fields.city !== undefined ? fields.city : parsed.city,
                        province: fields.province !== undefined ? fields.province : parsed.province,
                      };
                      handleFieldChange('rt_rw', newRtRw);
                      handleFieldChange('address', composeKtpAddress(current));
                    }}
                    placeholder="000/000"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* 3. Kelurahan / Desa */}
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-semibold text-slate-600 mb-0.5 block">Kelurahan / Desa</label>
                  <input
                    type="text"
                    value={fields.kelurahan !== undefined ? fields.kelurahan : (parseKtpAddress(fields.address).kelurahan || '')}
                    onChange={(e) => {
                      const newKel = e.target.value;
                      const parsed = parseKtpAddress(fields.address);
                      const current = {
                        street: fields.street !== undefined ? fields.street : parsed.street,
                        rt_rw: fields.rt_rw !== undefined ? fields.rt_rw : parsed.rt_rw,
                        kelurahan: newKel,
                        kecamatan: fields.kecamatan !== undefined ? fields.kecamatan : parsed.kecamatan,
                        city: fields.city !== undefined ? fields.city : parsed.city,
                        province: fields.province !== undefined ? fields.province : parsed.province,
                      };
                      handleFieldChange('kelurahan', newKel);
                      handleFieldChange('address', composeKtpAddress(current));
                    }}
                    placeholder="Nama Kel/Desa"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* 4. Kecamatan */}
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-semibold text-slate-600 mb-0.5 block">Kecamatan</label>
                  <input
                    type="text"
                    value={fields.kecamatan !== undefined ? fields.kecamatan : (parseKtpAddress(fields.address).kecamatan || '')}
                    onChange={(e) => {
                      const newKec = e.target.value;
                      const parsed = parseKtpAddress(fields.address);
                      const current = {
                        street: fields.street !== undefined ? fields.street : parsed.street,
                        rt_rw: fields.rt_rw !== undefined ? fields.rt_rw : parsed.rt_rw,
                        kelurahan: fields.kelurahan !== undefined ? fields.kelurahan : parsed.kelurahan,
                        kecamatan: newKec,
                        city: fields.city !== undefined ? fields.city : parsed.city,
                        province: fields.province !== undefined ? fields.province : parsed.province,
                      };
                      handleFieldChange('kecamatan', newKec);
                      handleFieldChange('address', composeKtpAddress(current));
                    }}
                    placeholder="Nama Kecamatan"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* 5. Kota / Kabupaten */}
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-semibold text-slate-600 mb-0.5 block">Kota / Kabupaten</label>
                  <input
                    type="text"
                    value={fields.city !== undefined ? fields.city : (parseKtpAddress(fields.address).city || '')}
                    onChange={(e) => {
                      const newCity = e.target.value;
                      const parsed = parseKtpAddress(fields.address);
                      const current = {
                        street: fields.street !== undefined ? fields.street : parsed.street,
                        rt_rw: fields.rt_rw !== undefined ? fields.rt_rw : parsed.rt_rw,
                        kelurahan: fields.kelurahan !== undefined ? fields.kelurahan : parsed.kelurahan,
                        kecamatan: fields.kecamatan !== undefined ? fields.kecamatan : parsed.kecamatan,
                        city: newCity,
                        province: fields.province !== undefined ? fields.province : parsed.province,
                      };
                      handleFieldChange('city', newCity);
                      handleFieldChange('address', composeKtpAddress(current));
                    }}
                    placeholder="Kota / Kab"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Live Preview Unified Database Format */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Alamat Lengkap Tersimpan (Satu Kesatuan Database):</span>
                <span className="font-medium text-slate-800">
                  {fields.address || <span className="text-slate-400 italic">[ Belum ada alamat terisi ]</span>}
                </span>
              </div>
            </div>
          </div>
        )}

        {docType === 'KK' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Nomor Kartu Keluarga (KK)</label>
                  {renderFieldBadge('kk_number', fields.kk_number)}
                </div>
                <input
                  type="text"
                  maxLength={16}
                  value={fields.kk_number || ''}
                  onChange={(e) => handleFieldChange('kk_number', e.target.value)}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Kepala Keluarga</label>
                  {renderFieldBadge('head_of_family', fields.head_of_family)}
                </div>
                <input
                  type="text"
                  value={fields.head_of_family || ''}
                  onChange={(e) => handleFieldChange('head_of_family', e.target.value)}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* KK Multi-Member Selection Table */}
            <KkMembersSelector
              members={kkMembers}
              onToggleMember={handleToggleKkMember}
              onUpdateMember={handleUpdateKkMember}
            />
          </div>
        )}

        {docType === 'VAKSIN' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Penerima Vaksin</label>
                  {renderFieldBadge('recipient_name', fields.recipient_name)}
                </div>
                <input
                  type="text"
                  value={fields.recipient_name || ''}
                  onChange={(e) => handleFieldChange('recipient_name', e.target.value)}
                  placeholder="Contoh: MUHAMMAD AHMAD"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">NIK / ID Sertifikat</label>
                  {renderFieldBadge('nik', fields.nik)}
                </div>
                <input
                  type="text"
                  value={fields.nik || fields.certificate_number || ''}
                  onChange={(e) => handleFieldChange('nik', e.target.value)}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Jenis / Nama Vaksin</label>
                  {renderFieldBadge('vaccine_name', fields.vaccine_name)}
                </div>
                <input
                  type="text"
                  value={fields.vaccine_name || ''}
                  onChange={(e) => handleFieldChange('vaccine_name', e.target.value)}
                  placeholder="Meningitis / COVID-19"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Dosis</label>
                  {renderFieldBadge('dose', fields.dose)}
                </div>
                <input
                  type="text"
                  value={fields.dose || ''}
                  onChange={(e) => handleFieldChange('dose', e.target.value)}
                  placeholder="Dosis 1 / Booster"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Tanggal Vaksinasi</label>
                  {renderFieldBadge('vaccination_date', fields.vaccination_date)}
                </div>
                <input
                  type="date"
                  value={fields.vaccination_date || ''}
                  onChange={(e) => handleFieldChange('vaccination_date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
              <textarea
                value={fields.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                rows={2}
                placeholder="Catatan sertifikat vaksinasi"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>
        )}

        {docType === 'BUKU_NIKAH' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Suami</label>
                  {renderFieldBadge('husband_name', fields.husband_name)}
                </div>
                <input
                  type="text"
                  value={fields.husband_name || ''}
                  onChange={(e) => handleFieldChange('husband_name', e.target.value)}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Istri</label>
                  {renderFieldBadge('wife_name', fields.wife_name)}
                </div>
                <input
                  type="text"
                  value={fields.wife_name || ''}
                  onChange={(e) => handleFieldChange('wife_name', e.target.value)}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">No. Akta Nikah</label>
                  {renderFieldBadge('marriage_number', fields.marriage_number)}
                </div>
                <input
                  type="text"
                  value={fields.marriage_number || ''}
                  onChange={(e) => handleFieldChange('marriage_number', e.target.value)}
                  placeholder="[ kosong ]"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Tanggal Akad Nikah</label>
                  {renderFieldBadge('marriage_date', fields.marriage_date)}
                </div>
                <input
                  type="date"
                  value={fields.marriage_date || ''}
                  onChange={(e) => handleFieldChange('marriage_date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">KUA Penerbit</label>
                  {renderFieldBadge('kua_name', fields.kua_name)}
                </div>
                <input
                  type="text"
                  value={fields.kua_name || ''}
                  onChange={(e) => handleFieldChange('kua_name', e.target.value)}
                  placeholder="KUA Kec. Gambir"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
              <textarea
                value={fields.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                rows={2}
                placeholder="Catatan buku nikah"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>
        )}

        {docType === 'OTHER' && (
          <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-600">
              Dokumen ini akan disimpan sebagai berkas pendukung Master Jamaah. Anda dapat memasukkan catatan tambahan jika diperlukan.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Dokumen</label>
              <textarea
                value={fields.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                rows={2}
                placeholder="Misal: Surat Rekomendasi Kemenag, dll."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Decision Footer */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          onClick={onReject}
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-1.5"
        >
          <XCircle className="w-4 h-4" />
          <span>Tolak Dokumen</span>
        </button>

        <button
          type="button"
          onClick={handlePreSaveCheck}
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/20 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'Menyimpan...' : 'Konfirmasi & Simpan ke Master'}</span>
        </button>
      </div>

      {/* Duplicate Resolution Modal */}
      {duplicateMatch && (
        <DuplicateResolutionModal
          isOpen={duplicateModalOpen}
          onClose={() => setDuplicateModalOpen(false)}
          matchDetail={duplicateMatch}
          newFields={fields}
          onUpdateExisting={handleDuplicateUpdateExisting}
          onCreateNew={handleDuplicateCreateNew}
        />
      )}
    </div>
  );
};
