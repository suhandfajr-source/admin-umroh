'use client';

import React from 'react';
import { KkFamilyMember } from '@/types/document.types';
import { CheckSquare, Square, UserPlus, Users } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface KkMembersSelectorProps {
  members: KkFamilyMember[];
  onToggleMember: (index: number) => void;
  onUpdateMember: (index: number, updated: Partial<KkFamilyMember>) => void;
}

export const KkMembersSelector: React.FC<KkMembersSelectorProps> = ({
  members,
  onToggleMember,
  onUpdateMember,
}) => {
  const selectedCount = members.filter(m => m.selected).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" />
          <h4 className="text-sm font-bold text-slate-800">Daftar Anggota Keluarga ({members.length})</h4>
        </div>
        <Badge variant={selectedCount > 0 ? 'success' : 'neutral'}>
          {selectedCount} dari {members.length} dipilih menjadi Jamaah
        </Badge>
      </div>

      <p className="text-xs text-slate-500">
        Pilih anggota keluarga yang akan dibuatkan Master Profile Jamaah. Anggota yang tidak dicentang tidak akan disimpan sebagai jamaah.
      </p>

      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">Pilih</th>
                <th className="p-3">Nama Lengkap</th>
                <th className="p-3">NIK</th>
                <th className="p-3">Hubungan</th>
                <th className="p-3">Jenis Kelamin</th>
                <th className="p-3">Tanggal Lahir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {members.map((member, idx) => (
                <tr
                  key={member.id || idx}
                  className={`hover:bg-slate-50/80 transition-colors ${member.selected ? 'bg-emerald-50/40' : ''}`}
                >
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleMember(idx)}
                      className="text-emerald-600 focus:outline-hidden"
                    >
                      {member.selected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                      )}
                    </button>
                  </td>
                  <td className="p-3 font-medium text-slate-900">
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => onUpdateMember(idx, { name: e.target.value })}
                      className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-emerald-500 rounded text-xs font-semibold"
                    />
                  </td>
                  <td className="p-3 font-mono">
                    <input
                      type="text"
                      value={member.nik || ''}
                      placeholder="16 digit NIK"
                      onChange={(e) => onUpdateMember(idx, { nik: e.target.value })}
                      className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-emerald-500 rounded text-xs"
                    />
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-medium">
                      {member.relationship || 'Anggota'}
                    </span>
                  </td>
                  <td className="p-3">
                    <select
                      value={member.gender || 'MALE'}
                      onChange={(e) => onUpdateMember(idx, { gender: e.target.value as any })}
                      className="px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-emerald-500 rounded text-xs"
                    >
                      <option value="MALE">Laki-Laki (M)</option>
                      <option value="FEMALE">Perempuan (F)</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={member.birth_date || ''}
                      onChange={(e) => onUpdateMember(idx, { birth_date: e.target.value })}
                      className="px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-emerald-500 rounded text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
