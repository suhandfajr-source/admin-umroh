import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Memuat data...',
  size = 'md',
  fullScreen = false,
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <Loader2 className={`${sizeMap[size]} text-emerald-600 animate-spin`} />
      {label && <p className="text-sm font-medium text-slate-600">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center">
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
