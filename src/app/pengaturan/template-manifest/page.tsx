'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileSpreadsheet, 
  Plus, 
  Settings, 
  ArrowLeft, 
  Check, 
  Star, 
  Trash2, 
  Edit, 
  CheckCircle2,
  Sliders,
  Layers
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { ManifestTemplate, ManifestSystemField } from '@/types/database.types';

const AVAILABLE_SYSTEM_FIELDS: { key: ManifestSystemField; label: string }[] = [
  { key: 'no', label: 'Nomor Urut (1, 2, 3...)' },
  { key: 'passport_name', label: 'Nama Paspor (Sesuai Paspor)' },
  { key: 'passport_number', label: 'Nomor Paspor' },
  { key: 'gender', label: 'Jenis Kelamin (Gender)' },
  { key: 'birth_place', label: 'Tempat Lahir' },
  { key: 'birth_date', label: 'Tanggal Lahir' },
  { key: 'passport_issue_place', label: 'Kantor / Tempat Penerbit Paspor' },
  { key: 'passport_issue_date', label: 'Tanggal Penerbitan Paspor' },
  { key: 'passport_expiry_date', label: 'Tanggal Kadaluarsa Paspor' },
  { key: 'ktp_name', label: 'Nama Sesuai KTP' },
  { key: 'identity_name', label: 'Nama Identitas Master' },
  { key: 'nik', label: 'Nomor Induk Kependudukan (NIK)' },
  { key: 'kk_number', label: 'Nomor Kartu Keluarga (KK)' },
  { key: 'phone', label: 'Nomor Telepon / WhatsApp' },
  { key: 'address', label: 'Alamat Lengkap Jamaah' },
  { key: 'package_name', label: 'Nama Paket Umrah' },
  { key: 'departure_date', label: 'Tanggal Keberangkatan' },
  { key: 'return_date', label: 'Tanggal Kepulangan' },
  { key: 'airline', label: 'Maskapai Penerbangan' },
  { key: 'makkah_hotel', label: 'Hotel Makkah' },
  { key: 'madinah_hotel', label: 'Hotel Madinah' },
  { key: 'pic_name', label: 'Nama PIC / Tour Leader' },
  { key: 'selling_price', label: 'Harga Jual Jamaah' },
  { key: 'b2b_price', label: 'Harga Acuan B2B' },
  { key: 'participant_status', label: 'Status Peserta' },
];

export default function ManifestTemplateSettingsPage() {
  const [templates, setTemplates] = useState<ManifestTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ManifestTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [worksheetName, setWorksheetName] = useState('Manifest');
  const [headerRow, setHeaderRow] = useState(1);
  const [dataStartRow, setDataStartRow] = useState(2);
  const [isDefault, setIsDefault] = useState(false);
  const [genderFormat, setGenderFormat] = useState<'MF' | 'LP' | 'RAW'>('MF');
  const [fieldMappings, setFieldMappings] = useState<{ col: string; field: ManifestSystemField }[]>([
    { col: 'A', field: 'no' },
    { col: 'B', field: 'passport_name' },
    { col: 'C', field: 'passport_number' },
    { col: 'D', field: 'gender' },
    { col: 'E', field: 'birth_place' },
    { col: 'F', field: 'birth_date' },
    { col: 'G', field: 'passport_issue_place' },
    { col: 'H', field: 'passport_issue_date' },
    { col: 'I', field: 'passport_expiry_date' },
    { col: 'J', field: 'nik' },
    { col: 'K', field: 'phone' },
    { col: 'L', field: 'pic_name' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/manifest/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setWorksheetName('Manifest');
    setHeaderRow(1);
    setDataStartRow(2);
    setIsDefault(false);
    setGenderFormat('MF');
    setFieldMappings([
      { col: 'A', field: 'no' },
      { col: 'B', field: 'passport_name' },
      { col: 'C', field: 'passport_number' },
      { col: 'D', field: 'gender' },
      { col: 'E', field: 'birth_place' },
      { col: 'F', field: 'birth_date' },
      { col: 'G', field: 'passport_issue_place' },
      { col: 'H', field: 'passport_issue_date' },
      { col: 'I', field: 'passport_expiry_date' },
      { col: 'J', field: 'nik' },
      { col: 'K', field: 'phone' },
      { col: 'L', field: 'pic_name' },
    ]);
    setModalOpen(true);
  };

  const openEditModal = (tmpl: ManifestTemplate) => {
    setEditingTemplate(tmpl);
    setTemplateName(tmpl.name);
    setWorksheetName(tmpl.worksheet_name);
    setHeaderRow(tmpl.header_row);
    setDataStartRow(tmpl.data_start_row);
    setIsDefault(tmpl.is_default);

    const mappings = Object.entries(tmpl.field_mapping || {}).map(([col, field]) => ({
      col,
      field,
    }));
    setFieldMappings(mappings.length > 0 ? mappings : [{ col: 'A', field: 'passport_name' }]);

    if (tmpl.value_transformations?.gender?.MALE === 'L') {
      setGenderFormat('LP');
    } else if (tmpl.value_transformations?.gender?.MALE === 'M') {
      setGenderFormat('MF');
    } else {
      setGenderFormat('RAW');
    }

    setModalOpen(true);
  };

  const handleAddColumn = () => {
    const nextCol = String.fromCharCode(65 + fieldMappings.length);
    setFieldMappings([...fieldMappings, { col: nextCol, field: 'passport_name' }]);
  };

  const handleRemoveColumn = (idx: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== idx));
  };

  const handleMappingChange = (idx: number, field: ManifestSystemField) => {
    const updated = [...fieldMappings];
    updated[idx].field = field;
    setFieldMappings(updated);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    setSubmitting(true);
    try {
      const mappingObj: Record<string, ManifestSystemField> = {};
      fieldMappings.forEach(m => {
        if (m.col && m.field) {
          mappingObj[m.col.toUpperCase()] = m.field;
        }
      });

      const valueTransformations: Record<string, Record<string, string>> = {};
      if (genderFormat === 'MF') {
        valueTransformations.gender = { MALE: 'M', FEMALE: 'F' };
      } else if (genderFormat === 'LP') {
        valueTransformations.gender = { MALE: 'L', FEMALE: 'P' };
      }

      const payload = {
        name: templateName.trim(),
        worksheet_name: worksheetName.trim() || 'Manifest',
        header_row: Number(headerRow) || 1,
        data_start_row: Number(dataStartRow) || 2,
        field_mapping: mappingObj,
        value_transformations: valueTransformations,
        is_default: isDefault,
      };

      const url = editingTemplate
        ? `/api/manifest/templates/${editingTemplate.id}`
        : '/api/manifest/templates';
      const method = editingTemplate ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menyimpan template');
      }

      setModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Yakin ingin menghapus template manifest ini?')) return;
    try {
      const res = await fetch(`/api/manifest/templates/${id}`, { method: 'DELETE' });
      if (res.ok) fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Memuat pengaturan template manifest..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/pengaturan"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Sliders className="w-7 h-7 text-emerald-600" />
              Pengaturan Template Manifest
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Konfigurasi format pemetaan kolom Excel maskapai penerbangan untuk ekspor manifest instan.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Template Baru</span>
        </button>
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tmpl) => {
          const mappingKeys = Object.keys(tmpl.field_mapping || {});
          return (
            <div
              key={tmpl.id}
              className={`p-5 bg-white rounded-2xl border shadow-2xs space-y-4 transition-all ${
                tmpl.is_default ? 'border-emerald-300 ring-1 ring-emerald-400/30' : 'border-slate-200/80'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{tmpl.name}</h3>
                    {tmpl.is_default && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Sheet: <strong className="text-slate-700">{tmpl.worksheet_name}</strong> • Header Baris: {tmpl.header_row} • Data Mulai: Baris {tmpl.data_start_row}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(tmpl)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Pemetaan"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {!tmpl.is_default && (
                    <button
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Hapus Template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Column Mapping Preview Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
                  Pemetaan Kolom Terdeteksi ({mappingKeys.length} Kolom):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(tmpl.field_mapping || {}).slice(0, 8).map(([col, fKey]) => (
                    <span
                      key={col}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700 flex items-center gap-1"
                    >
                      <strong className="text-emerald-700">{col}:</strong>
                      <span>{fKey}</span>
                    </span>
                  ))}
                  {mappingKeys.length > 8 && (
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[11px]">
                      +{mappingKeys.length - 8} kolom lainnya
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Template Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTemplate ? 'Edit Template Manifest' : 'Buat Template Manifest Baru'}
        subtitle="Atur nama worksheet dan pemetaan kolom Excel ke data sistem jamaah"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Template <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Manifest Garuda Indonesia, Manifest Saudia Airlines"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Worksheet</label>
              <input
                type="text"
                value={worksheetName}
                onChange={(e) => setWorksheetName(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Baris Header</label>
              <input
                type="number"
                min="1"
                value={headerRow}
                onChange={(e) => setHeaderRow(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Baris Mulai Data</label>
              <input
                type="number"
                min="2"
                value={dataStartRow}
                onChange={(e) => setDataStartRow(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Format Nilai Gender (Jenis Kelamin):</label>
            <select
              value={genderFormat}
              onChange={(e) => setGenderFormat(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            >
              <option value="MF">Internasional (M / F)</option>
              <option value="LP">Indonesia (L / P)</option>
              <option value="RAW">Teks Lengkap (MALE / FEMALE)</option>
            </select>
          </div>

          {/* Column Mappings Builder */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Daftar Pemetaan Kolom Excel:
              </label>
              <button
                type="button"
                onClick={handleAddColumn}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Kolom
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {fieldMappings.map((mapping, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="w-10 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center">
                    {mapping.col}
                  </span>
                  <select
                    value={mapping.field}
                    onChange={(e) => handleMappingChange(idx, e.target.value as ManifestSystemField)}
                    className="flex-1 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    {AVAILABLE_SYSTEM_FIELDS.map(f => (
                      <option key={f.key} value={f.key}>
                        {f.label} ({f.key})
                      </option>
                    ))}
                  </select>
                  {fieldMappings.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveColumn(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefaultCheck"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="isDefaultCheck" className="text-xs font-medium text-slate-700">
              Jadikan template default untuk seluruh paket baru
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Template'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
