'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { UnifiedJamaahDetailView } from './UnifiedJamaahDetailView';

interface UnifiedJamaahDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  jamaahId: string | null;
}

export const UnifiedJamaahDetailModal: React.FC<UnifiedJamaahDetailModalProps> = ({
  isOpen,
  onClose,
  jamaahId,
}) => {
  if (!isOpen || !jamaahId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="2xl"
    >
      <div className="p-1">
        <UnifiedJamaahDetailView
          jamaahId={jamaahId}
          onClose={onClose}
          isModal={true}
        />
      </div>
    </Modal>
  );
};
