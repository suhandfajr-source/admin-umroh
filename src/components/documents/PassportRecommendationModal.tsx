'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  X, 
  Settings2, 
  RefreshCw, 
  CheckCircle2, 
  Calendar, 
  MapPin, 
  Building2, 
  User, 
  Eye,
  PenTool,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { 
  getStoredLetterSettings, 
  saveStoredLetterSettings, 
  formatLetterNumber, 
  PassportRecommendationLetterData, 
  LetterSettings 
} from '@/lib/recommendation-letter';
import { PassportRecommendationPrintView } from './PassportRecommendationPrintView';

interface PassportRecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  jamaah: any;
}

const COMMON_IMMIGRATION_OFFICES = [
  'Kepala Kantor Imigrasi di Tempat',
  'Kepala Kantor Imigrasi Kelas I Khusus Non TPI Jakarta Selatan',
  'Kepala Kantor Imigrasi Kelas I Non TPI Bogor',
  'Kepala Kantor Imigrasi Kelas I Non TPI Depok',
  'Kepala Kantor Imigrasi Kelas I Non TPI Bekasi',
  'Kepala Kantor Imigrasi Kelas I Non TPI Tangerang',
  'Kepala Kantor Imigrasi Kelas I Khusus TPI Soekarno Hatta',
  'Kepala Kantor Imigrasi Kelas I TPI Jakarta Pusat',
  'Kepala Kantor Imigrasi Kelas I TPI Jakarta Timur',
  'Kepala Kantor Imigrasi Kelas I TPI Jakarta Barat',
  'Kepala Kantor Imigrasi Kelas I TPI Jakarta Utara',
  'Kepala Kantor Imigrasi Kelas I TPI Bandung',
  'Kepala Kantor Imigrasi Kelas I TPI Surabaya',
  'Kepala Kantor Imigrasi Kelas I TPI Semarang',
];

export const PassportRecommendationModal: React.FC<PassportRecommendationModalProps> = ({
  isOpen,
  onClose,
  jamaah,
}) => {
  const [settings, setSettings] = useState<LetterSettings>(getStoredLetterSettings());
  const [showSettingsEdit, setShowSettingsEdit] = useState(false);

  // Admin form inputs
  const [letterNumber, setLetterNumber] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0]);
  const [departureDate, setDepartureDate] = useState('');
  const [immigrationOffice, setImmigrationOffice] = useState(COMMON_IMMIGRATION_OFFICES[0]);
  const [customOffice, setCustomOffice] = useState('');
  const [purpose, setPurpose] = useState<'PEMBUATAN_BARU' | 'PERPANJANGAN_PENGGANTIAN' | 'HALAMAN_PENUH' | 'RUSAK_HILANG'>('PEMBUATAN_BARU');
  
  // Toggles for assets
  const [useUploadedLetterhead, setUseUploadedLetterhead] = useState(true);
  const [useDigitalSignature, setUseDigitalSignature] = useState(true);

  // Signatory override
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryRole, setSignatoryRole] = useState('');
  const [city, setCity] = useState('');

  // Setting pattern edit form
  const [formatPattern, setFormatPattern] = useState('');
  const [nextSeq, setNextSeq] = useState<number>(1);

  // Initialize data on open or jamaah change
  useEffect(() => {
    if (isOpen && jamaah) {
      const currentSettings = getStoredLetterSettings();
      setSettings(currentSettings);
      setUseUploadedLetterhead(!!currentSettings.letterheadImageUrl);
      setUseDigitalSignature(currentSettings.useDigitalSignature && !!currentSettings.signatureImageUrl);
      setSignatoryName(currentSettings.signatoryName || 'Direktur Utama');
      setSignatoryRole(currentSettings.signatoryRole || 'Direktur Utama');
      setCity(currentSettings.city || 'Bogor');
      setFormatPattern(currentSettings.letterNumberFormat);
      setNextSeq(currentSettings.lastNumberSequence);

      // Auto generate letter number
      const autoNum = formatLetterNumber(
        currentSettings.letterNumberFormat,
        currentSettings.lastNumberSequence,
        new Date()
      );
      setLetterNumber(autoNum);

      // Tanggal Keberangkatan default from trip or 30 days from now
      if (jamaah.trips && jamaah.trips.length > 0 && jamaah.trips[0].package?.departure_date) {
        setDepartureDate(jamaah.trips[0].package.departure_date);
      } else if (jamaah.latest_departure) {
        setDepartureDate(jamaah.latest_departure);
      } else {
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);
        setDepartureDate(nextMonth.toISOString().split('T')[0]);
      }

      // Default purpose based on passport existence
      if (jamaah.passport_number) {
        setPurpose('PERPANJANGAN_PENGGANTIAN');
      } else {
        setPurpose('PEMBUATAN_BARU');
      }
    }
  }, [isOpen, jamaah]);

  if (!isOpen || !jamaah) return null;

  const handleRegenerateNumber = (seqOverride?: number) => {
    const seq = seqOverride !== undefined ? seqOverride : nextSeq;
    const lDate = letterDate ? new Date(letterDate) : new Date();
    const generated = formatLetterNumber(formatPattern || settings.letterNumberFormat, seq, lDate);
    setLetterNumber(generated);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveStoredLetterSettings({
      letterNumberFormat: formatPattern,
      lastNumberSequence: Number(nextSeq),
      city,
      signatoryName,
      signatoryRole,
    });
    setSettings(updated);
    setShowSettingsEdit(false);
    handleRegenerateNumber(Number(nextSeq));
  };

  const letterData: PassportRecommendationLetterData = {
    letterNumber: letterNumber || '001/REK-PASPOR/PPIU/IX/2026',
    letterDate: letterDate || new Date().toISOString().split('T')[0],
    departureDate: departureDate || '',
    immigrationOffice: customOffice || immigrationOffice,
    purpose,
    packageName: (jamaah.trips && jamaah.trips[0]?.package?.package_name) || undefined,
    
    // Auto-pulled from KTP/KK/Master
    jamaahName: jamaah.ktp_name || jamaah.identity_name || jamaah.passport_name || 'Jamaah',
    nik: jamaah.nik || undefined,
    kkNumber: jamaah.kk_number || undefined,
    birthPlace: jamaah.birth_place || undefined,
    birthDate: jamaah.birth_date || undefined,
    gender: jamaah.gender || undefined,
    address: jamaah.address || undefined,
    phone: jamaah.phone || undefined,

    // Header & Signature Assets
    letterheadImageUrl: settings.letterheadImageUrl,
    useUploadedLetterhead,
    signatureImageUrl: settings.signatureImageUrl,
    useDigitalSignature,

    // Profile & Signatory
    companyName: settings.companyName,
    companyLegalNumber: settings.companyLegalNumber,
    companyAddress: settings.companyAddress,
    companyPhone: settings.companyPhone,
    companyEmail: settings.companyEmail,
    city: city || settings.city,
    signatoryName: signatoryName || settings.signatoryName,
    signatoryRole: signatoryRole || settings.signatoryRole,
  };

  const handlePrint = () => {
    // Increment sequence for next time
    saveStoredLetterSettings({
      lastNumberSequence: Number(nextSeq) + 1,
    });
    setNextSeq(prev => prev + 1);

    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      {/* Hidden container specifically for clean browser printing */}
      <div className="hidden print:block fixed inset-0 z-[9999] bg-white p-0 m-0">
        <PassportRecommendationPrintView data={letterData} forPrintOnly={true} />
      </div>

      {/* Screen Interactive Modal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden print:hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Cetak Surat Rekomendasi Paspor
              </h2>
              <p className="text-xs text-slate-500">
                Data KTP/KK ditarik otomatis • Admin mengisi nomor, tanggal surat & keberangkatan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsEdit(!showSettingsEdit)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
            >
              <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Format & Info</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Dropdown Accordion */}
        {showSettingsEdit && (
          <div className="bg-emerald-50/70 border-b border-emerald-200 p-4 animate-in slide-in-from-top-2 duration-150">
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-emerald-700" />
                  Pengaturan Format Penomoran & Penandatangan
                </span>
                <span className="text-[11px] text-emerald-800">
                  Variabel: <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">{'{NO}'}</code> (001), <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">{'{ROMAN_MONTH}'}</code> (IX), <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">{'{YEAR}'}</code> (2026)
                </span>
              </div>

              <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 block">Pola Format Nomor Surat</label>
                  <input
                    type="text"
                    value={formatPattern}
                    onChange={(e) => setFormatPattern(e.target.value)}
                    placeholder="{NO}/REK-PASPOR/PPIU/{ROMAN_MONTH}/{YEAR}"
                    className="w-full mt-0.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block">Nomor Urut Terakhir</label>
                  <input
                    type="number"
                    min="1"
                    value={nextSeq}
                    onChange={(e) => setNextSeq(Number(e.target.value))}
                    className="w-full mt-0.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block">Kota Terbit Surat</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bogor"
                    className="w-full mt-0.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block">Nama Pimpinan / TTD</label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    placeholder="Nama Lengkap Penandatangan"
                    className="w-full mt-0.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block">Jabatan Pimpinan</label>
                  <input
                    type="text"
                    value={signatoryRole}
                    onChange={(e) => setSignatoryRole(e.target.value)}
                    placeholder="Direktur Utama"
                    className="w-full mt-0.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSettingsEdit(false)}
                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs"
                  >
                    Simpan Format Default
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Main Body: Two-Column Form & Live Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Controls */}
          <div className="lg:col-span-5 space-y-4">
            {/* Auto Data Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  Data Jamaah (Tersinkron KTP/KK)
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                  Auto Synced
                </span>
              </div>

              <div className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Nama Lengkap:</span>
                  <span className="font-bold text-slate-900 text-right">{letterData.jamaahName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">NIK (KTP):</span>
                  <span className="font-mono text-slate-800 text-right">{letterData.nik || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tempat, Tgl Lahir:</span>
                  <span className="text-slate-800 text-right">
                    {letterData.birthPlace ? `${letterData.birthPlace}, ` : ''}{letterData.birthDate || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Alamat:</span>
                  <span className="text-slate-700 text-right truncate max-w-[200px]" title={letterData.address}>
                    {letterData.address || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Admin Input Fields */}
            <div className="space-y-3.5 text-xs">
              {/* Nomor Surat */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Nomor Surat</label>
                  <button
                    type="button"
                    onClick={() => handleRegenerateNumber()}
                    className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate Ulang</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Contoh: 001/REK-PASPOR/PPIU/IX/2026"
                />
              </div>

              {/* Tanggal Surat & Tanggal Keberangkatan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tanggal Surat
                  </label>
                  <input
                    type="date"
                    value={letterDate}
                    onChange={(e) => {
                      setLetterDate(e.target.value);
                      if (e.target.value) {
                        const generated = formatLetterNumber(
                          formatPattern || settings.letterNumberFormat,
                          nextSeq,
                          new Date(e.target.value)
                        );
                        setLetterNumber(generated);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tanggal Keberangkatan
                  </label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Keperluan Surat */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Keperluan Pengajuan</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="PEMBUATAN_BARU">Pembuatan Paspor Baru (Umrah)</option>
                  <option value="PERPANJANGAN_PENGGANTIAN">Penggantian / Perpanjangan (Habis Masa Berlaku)</option>
                  <option value="HALAMAN_PENUH">Penggantian (Halaman Penuh)</option>
                  <option value="RUSAK_HILANG">Penggantian (Rusak / Hilang)</option>
                </select>
              </div>

              {/* Tujuan Kantor Imigrasi */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tujuan Kantor Imigrasi</label>
                <select
                  value={immigrationOffice}
                  onChange={(e) => {
                    setImmigrationOffice(e.target.value);
                    if (e.target.value !== 'LAINNYA') {
                      setCustomOffice('');
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none mb-1.5"
                >
                  {COMMON_IMMIGRATION_OFFICES.map((office, idx) => (
                    <option key={idx} value={office}>
                      {office}
                    </option>
                  ))}
                  <option value="LAINNYA">+ Ketik Kantor Imigrasi Lainnya...</option>
                </select>

                {immigrationOffice === 'LAINNYA' && (
                  <input
                    type="text"
                    value={customOffice}
                    onChange={(e) => setCustomOffice(e.target.value)}
                    placeholder="Ketik nama kantor imigrasi tujuan..."
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                )}
              </div>

              {/* Opsi Kop & TTD yang Terupload */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800">Opsi Template & Tanda Tangan</span>
                  <a
                    href="/pengaturan"
                    target="_blank"
                    className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1"
                  >
                    <span>Menu Setting Upload</span>
                  </a>
                </div>

                {/* Toggle Kop Gambar */}
                {settings.letterheadImageUrl ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Kop Surat Gambar Upload</span>
                      <span className="text-[10px] text-slate-500">Gunakan file template kop yang tersimpan</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useUploadedLetterhead}
                        onChange={(e) => setUseUploadedLetterhead(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                ) : (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                    Belum ada file Kop Surat yang di-upload di menu <a href="/pengaturan" className="underline font-bold">Pengaturan</a>.
                  </div>
                )}

                {/* Toggle TTD Gambar */}
                {settings.signatureImageUrl ? (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Tanda Tangan Digital</span>
                      <span className="text-[10px] text-slate-500">Sertakan gambar TTD Direktur Utama</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useDigitalSignature}
                        onChange={(e) => setUseDigitalSignature(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                ) : (
                  <div className="p-2 bg-slate-100 rounded-lg text-[11px] text-slate-500">
                    TTD Digital belum di-upload di menu <a href="/pengaturan" className="underline font-bold text-emerald-700">Pengaturan</a> (surat akan dicetak dengan area tanda tangan kosong).
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live A4 Preview Container */}
          <div className="lg:col-span-7 bg-slate-100/80 border border-slate-200 rounded-2xl p-4 overflow-y-auto max-h-[640px] flex justify-center">
            <div className="transform scale-[0.78] sm:scale-[0.84] origin-top">
              <PassportRecommendationPrintView data={letterData} />
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="text-xs text-slate-500">
            <span>Kop: <strong>{useUploadedLetterhead && settings.letterheadImageUrl ? 'Template Gambar' : 'Standar'}</strong> • TTD: <strong>{useDigitalSignature && settings.signatureImageUrl ? 'Digital Terpasang' : 'Stempel Manual'}</strong></span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Print PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
