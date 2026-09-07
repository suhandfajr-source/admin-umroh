'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Database, 
  HardDrive, 
  Lock, 
  Cpu, 
  CheckCircle2, 
  Server, 
  FileCode2,
  FileText,
  Save,
  Building2,
  Upload,
  Image as ImageIcon,
  PenTool,
  Trash2,
  Eye,
  Check,
  Download
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { 
  getStoredLetterSettings, 
  saveStoredLetterSettings, 
  LetterSettings,
  formatLetterNumber,
  compressImageFile
} from '@/lib/recommendation-letter';
import { downloadSamplePassportDocxTemplate } from '@/lib/docx-generator';

export default function SettingsPage() {
  const [letterSettings, setLetterSettings] = useState<LetterSettings>(getStoredLetterSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [isUploadingDocx, setIsUploadingDocx] = useState(false);
  const [letterheadImgError, setLetterheadImgError] = useState(false);
  const [signatureImgError, setSignatureImgError] = useState(false);

  useEffect(() => {
    setLetterSettings(getStoredLetterSettings());
  }, []);

  const handleSaveLetterSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated = saveStoredLetterSettings(letterSettings);
    setLetterSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Upload DOCX Master Template
  const handleDocxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setUploadError('File harus berupa dokumen Microsoft Word (.docx)');
      return;
    }

    setIsUploadingDocx(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError('Gagal membaca file .docx');
      setIsUploadingDocx(false);
    };
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const updated = saveStoredLetterSettings({
        customDocxTemplateBase64: base64,
        customDocxTemplateName: file.name,
        hasCustomDocxTemplate: true,
      });
      setLetterSettings(updated);
      setIsUploadingDocx(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveDocx = () => {
    const updated = saveStoredLetterSettings({
      customDocxTemplateBase64: '',
      customDocxTemplateName: '',
      hasCustomDocxTemplate: false,
    });
    setLetterSettings(updated);
  };

  const handleDownloadSampleDocx = async () => {
    try {
      await downloadSamplePassportDocxTemplate();
    } catch (err) {
      console.error('Failed to download sample docx:', err);
    }
  };

  // Upload Letterhead Image (A4 Template) with auto compression
  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploadingLetterhead(true);
    setLetterheadImgError(false);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Format file harus berupa gambar (PNG / JPG / WEBP). File PDF tidak bisa digunakan sebagai gambar template.');
      }
      const compressedBase64 = await compressImageFile(file, 2000, 0.88);
      const updated = saveStoredLetterSettings({
        letterheadImageUrl: compressedBase64,
        hasLetterheadImage: true,
      });
      setLetterSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setUploadError(err?.message || 'Gagal memproses gambar kop surat');
    } finally {
      setIsUploadingLetterhead(false);
      // Reset input value
      e.target.value = '';
    }
  };

  const handleRemoveLetterhead = () => {
    const updated = saveStoredLetterSettings({
      letterheadImageUrl: '',
      hasLetterheadImage: false,
    });
    setLetterSettings(updated);
    setLetterheadImgError(false);
  };

  // Upload Signature Image with auto compression
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploadingSignature(true);
    setSignatureImgError(false);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Format file tanda tangan harus berupa gambar (PNG / JPG / WEBP). Disarankan PNG transparan.');
      }
      const compressedBase64 = await compressImageFile(file, 1000, 0.85);
      const updated = saveStoredLetterSettings({
        signatureImageUrl: compressedBase64,
        hasSignatureImage: true,
        useDigitalSignature: true,
      });
      setLetterSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setUploadError(err?.message || 'Gagal memproses tanda tangan');
    } finally {
      setIsUploadingSignature(false);
      e.target.value = '';
    }
  };

  const handleRemoveSignature = () => {
    const updated = saveStoredLetterSettings({
      signatureImageUrl: '',
      hasSignatureImage: false,
    });
    setLetterSettings(updated);
    setSignatureImgError(false);
  };

  const previewNumber = formatLetterNumber(
    letterSettings.letterNumberFormat,
    letterSettings.lastNumberSequence,
    new Date()
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pengaturan & Status Sistem</h1>
        <p className="text-xs text-slate-500 mt-1">
          Pengaturan template surat resmi, tanda tangan digital, profil travel, dan arsitektur database.
        </p>
      </div>

      {/* Admin Profile Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Profil Admin Operasional</h3>
          </div>
          <Badge variant="success">Active Session</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Nama Admin:</span>
            <span className="font-bold text-slate-800">Super Admin Umroh</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Email Akun:</span>
            <span className="font-mono text-slate-800">admin@travelumroh.com</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Role Otoritas:</span>
            <span className="font-bold text-emerald-700">ADMIN (Master Control)</span>
          </div>
        </div>
      </div>

      {/* DEDICATED CARD: PENGATURAN SURAT REKOMENDASI PASPOR */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Pengaturan Surat Rekomendasi Paspor</h3>
              <p className="text-xs text-slate-500">Upload template gambar kop surat resmi, tanda tangan digital, dan pola penomoran surat.</p>
            </div>
          </div>
          {saveSuccess ? (
            <Badge variant="success">✓ Pengaturan Tersimpan</Badge>
          ) : (
            <Badge variant="neutral">Template Siap Digunakan</Badge>
          )}
        </div>
        {/* Error Alert if upload failed */}
        {uploadError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <span>⚠️ {uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-red-500 hover:text-red-800 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSaveLetterSettings} className="space-y-6 text-xs">
          {/* 1. UPLOAD SLOTS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Slot A: Upload Kop Surat / Template A4 */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    1. Template / Kop Surat (A4)
                  </span>
                  {letterSettings.letterheadImageUrl && !letterheadImgError ? (
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded-full">
                      ✓ File Terpasang
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                      Belum Upload
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Upload file gambar kop surat resmi travel (format PNG / JPG / WEBP). Gambar ini otomatis menjadi latar dokumen saat cetak.
                </p>
              </div>

              {/* Preview Box */}
              <div className="my-2 flex items-center justify-center p-3 bg-white border border-slate-300 rounded-xl min-h-[140px]">
                {isUploadingLetterhead ? (
                  <div className="text-center text-emerald-700 space-y-2">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[11px] font-bold">Mengompres & Memasang Kop...</p>
                  </div>
                ) : letterSettings.letterheadImageUrl && !letterheadImgError ? (
                  <div className="relative group text-center">
                    <img
                      src={letterSettings.letterheadImageUrl}
                      alt="Kop Surat Preview"
                      onError={() => setLetterheadImgError(true)}
                      className="max-h-36 max-w-full rounded shadow-xs border border-slate-200 object-contain mx-auto"
                    />
                    <p className="text-[10px] text-emerald-700 font-bold mt-1.5">
                      ✓ Template Kop Aktif
                    </p>
                  </div>
                ) : letterheadImgError ? (
                  <div className="text-center p-2 text-amber-700 space-y-1">
                    <p className="text-xs font-bold">⚠️ Gambar Tidak Terbaca</p>
                    <p className="text-[10px] text-slate-500">File sebelumnya rusak atau bukan gambar valid (misal: PDF). Silakan klik 'Ganti Kop Surat' dan pilih file gambar JPG/PNG asli.</p>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 space-y-1">
                    <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-[11px] font-medium">Belum ada file kop surat</p>
                    <p className="text-[10px] text-slate-400">Klik tombol di bawah untuk memilih file (JPG/PNG)</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <label className="flex-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold text-center cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{letterSettings.letterheadImageUrl ? 'Ganti Kop Surat' : 'Upload Kop Surat'}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleLetterheadUpload}
                    className="hidden"
                  />
                </label>
                {letterSettings.letterheadImageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLetterhead}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-xl transition-all"
                    title="Hapus Kop Surat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Slot B: Upload Tanda Tangan Direktur */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-emerald-600" />
                    2. Tanda Tangan Digital Direktur
                  </span>
                  {letterSettings.signatureImageUrl && !signatureImgError ? (
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded-full">
                      ✓ File Terpasang
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                      Belum Upload
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Upload file tanda tangan pimpinan / stempel (disarankan format **PNG Transparan**).
                </p>
              </div>

              {/* Preview Box */}
              <div className="my-2 flex items-center justify-center p-3 bg-white border border-slate-300 rounded-xl min-h-[140px]">
                {isUploadingSignature ? (
                  <div className="text-center text-emerald-700 space-y-2">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[11px] font-bold">Memproses Tanda Tangan...</p>
                  </div>
                ) : letterSettings.signatureImageUrl && !signatureImgError ? (
                  <div className="text-center space-y-1">
                    <img
                      src={letterSettings.signatureImageUrl}
                      alt="Tanda Tangan Preview"
                      onError={() => setSignatureImgError(true)}
                      className="max-h-24 max-w-[200px] object-contain mx-auto"
                    />
                    <p className="text-[10px] text-emerald-700 font-bold">
                      ✓ TTD Digital Siap Digunakan
                    </p>
                  </div>
                ) : signatureImgError ? (
                  <div className="text-center p-2 text-amber-700 space-y-1">
                    <p className="text-xs font-bold">⚠️ Gambar TTD Tidak Terbaca</p>
                    <p className="text-[10px] text-slate-500">File rusak atau format tidak cocok. Silakan upload ulang file PNG/JPG tanda tangan.</p>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 space-y-1">
                    <PenTool className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-[11px] font-medium">Belum ada tanda tangan digital</p>
                    <p className="text-[10px] text-slate-400">Klik tombol di bawah untuk memilih file (PNG)</p>
                  </div>
                )}
              </div>

              {/* Action Buttons & Toggle */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="flex-1 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold text-center cursor-pointer shadow-2xs transition-all flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>{letterSettings.signatureImageUrl ? 'Ganti Tanda Tangan' : 'Upload Tanda Tangan'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>
                  {letterSettings.signatureImageUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-xl transition-all"
                      title="Hapus Tanda Tangan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {letterSettings.signatureImageUrl && (
                  <div className="flex items-center justify-between px-1 pt-1">
                    <span className="text-[11px] text-slate-600">Sertakan TTD Digital saat cetak:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={letterSettings.useDigitalSignature}
                        onChange={(e) => setLetterSettings({ ...letterSettings, useDigitalSignature: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Slot C: Master Template Microsoft Word (.docx) */}
          <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/80 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-blue-200/60">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <span className="font-bold text-slate-800 text-xs">
                  3. Master Template Microsoft Word (.docx)
                </span>
              </div>
              {letterSettings.hasCustomDocxTemplate ? (
                <span className="text-[10px] text-blue-700 bg-blue-100 font-bold px-2 py-0.5 rounded-full self-start sm:self-auto">
                  ✓ Template Kustom: {letterSettings.customDocxTemplateName || 'template.docx'}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full self-start sm:self-auto">
                  Template Standar Sistem
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Anda dapat mengunggah file template Microsoft Word (<strong>.docx</strong>) resmi travel Anda lengkap dengan kop surat dan format tabel. Sistem akan otomatis mengisi variabel nama jamaah, NIK, nomor surat, dan tanggal saat diunduh.
            </p>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadSampleDocx}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-700 border border-blue-300 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Download Contoh Template (.docx)</span>
              </button>

              <label className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-2xs transition-all flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>{letterSettings.hasCustomDocxTemplate ? 'Ganti Template (.docx)' : 'Upload Template (.docx)'}</span>
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleDocxUpload}
                  className="hidden"
                />
              </label>

              {letterSettings.hasCustomDocxTemplate && (
                <button
                  type="button"
                  onClick={handleRemoveDocx}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-300 rounded-xl transition-all"
                  title="Hapus dan Kembalikan ke Template Standar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Tag Cheatsheet */}
            <div className="p-3.5 bg-white/95 rounded-xl border border-blue-100 text-[11px] text-slate-600 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Daftar Tag Variabel Microsoft Word (.docx):</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                  ✓ Bebas gunakan tag sesuai kebutuhan template Anda
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">Tag Utama Rekomendasi:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px]">
                  <span className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-blue-900 font-semibold">{'{perihal}'}</span>
                  <span className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-blue-900 font-semibold">{'{kantor_imigrasi}'}</span>
                  <span className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-blue-900 font-semibold">{'{nama_jamaah}'}</span>
                  <span className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-blue-900 font-semibold">{'{tempat_tanggal_lahir}'}</span>
                  <span className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-blue-900 font-semibold">{'{alamat}'}</span>
                  <span className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-blue-900 font-semibold">{'{tanggal_keberangkatan}'}</span>
                  <span className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-blue-900 font-semibold">{'{tanggal_surat}'}</span>
                  <span className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-blue-900 font-semibold">{'{nomor_surat}'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tag Tambahan (Opsional):</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px]">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{'{nik}'}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{'{tempat_lahir}'}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{'{tanggal_lahir}'}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{'{jenis_kelamin}'}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{'{nama_pimpinan}'}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{'{jabatan_pimpinan}'}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{'{nama_travel}'}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{'{kota_surat}'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. NOMOR SURAT PATTERN & DATA PENANDATANGAN */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-800">Pola Nomor Surat & Informasi Penandatangan</span>
              <span className="text-[11px] text-slate-500">
                Preview Nomor: <strong className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{previewNumber}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Pola Format Nomor (Variabel: {'{NO}'}, {'{ROMAN_MONTH}'}, {'{MONTH}'}, {'{YEAR}'})
                </label>
                <input
                  type="text"
                  value={letterSettings.letterNumberFormat}
                  onChange={(e) => setLetterSettings({ ...letterSettings, letterNumberFormat: e.target.value })}
                  placeholder="{NO}/REK-PASPOR/PPIU/{ROMAN_MONTH}/{YEAR}"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nomor Urut Terakhir (Auto Increment)
                </label>
                <input
                  type="number"
                  min="1"
                  value={letterSettings.lastNumberSequence}
                  onChange={(e) => setLetterSettings({ ...letterSettings, lastNumberSequence: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Kota Terbit Surat</label>
                <input
                  type="text"
                  value={letterSettings.city}
                  onChange={(e) => setLetterSettings({ ...letterSettings, city: e.target.value })}
                  placeholder="Bogor"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Nama Pimpinan / Penandatangan</label>
                <input
                  type="text"
                  value={letterSettings.signatoryName}
                  onChange={(e) => setLetterSettings({ ...letterSettings, signatoryName: e.target.value })}
                  placeholder="Nama Direktur"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Jabatan Pimpinan</label>
                <input
                  type="text"
                  value={letterSettings.signatoryRole}
                  onChange={(e) => setLetterSettings({ ...letterSettings, signatoryRole: e.target.value })}
                  placeholder="Direktur Utama"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* SAVE BUTTON */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">
              Perubahan disimpan otomatis di pengaturan aplikasi dan siap digunakan untuk semua jamaah.
            </span>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/20 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </form>
      </div>

      {/* Architecture & TiDB Cloud Database Status */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pemeriksaan Arsitektur Database & Deployment</h3>
              <p className="text-[11px] text-slate-500">Status koneksi TiDB Cloud (Serverless MySQL) dan kesiapan deployment Vercel.</p>
            </div>
          </div>
          <Badge variant="brand">Vercel & TiDB Ready</Badge>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Database Engine: TiDB Cloud (Serverless MySQL 8.0)</p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Skema DDL MySQL tersedia di <code className="font-mono text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded">tidb/schema.sql</code>. Mendukung TLS/SSL port 4000 dan command migrasi cepat <code className="font-mono text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded">npm run migrate:tidb</code>.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Hosting & Serverless Deployment: Vercel Cloud</p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Next.js 14 App Router siap di-deploy langsung ke Vercel dengan menyambungkan repository GitHub dan mengisi environment variable <code className="font-mono text-slate-700 bg-slate-200 px-1 py-0.5 rounded">DATABASE_URL</code>.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Zero-Lag Offline & Development Fallback Store</p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Aplikasi tetap memiliki fallback store di memory & local disk saat komputer offline atau belum terhubung internet, sehingga dev dan uji fungsi tetap berjalan lancar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
