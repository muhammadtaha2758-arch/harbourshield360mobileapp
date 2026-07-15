import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type LogoutConfirmModalProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmModal({ visible, onCancel, onConfirm }: LogoutConfirmModalProps): React.JSX.Element {
  return (
    <ConfirmModal
      visible={visible}
      title="Log out?"
      message="Are you sure you want to sign out?"
      confirmLabel="Log out"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
