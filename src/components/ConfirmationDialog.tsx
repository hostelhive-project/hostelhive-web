import Modal from './Modal';

export function ConfirmationDialog({ open, title, message, onClose, onConfirm, busy = false, confirmLabel = 'Confirm' }: {
  open: boolean; title: string; message: string; onClose: () => void; onConfirm: () => void; busy?: boolean; confirmLabel?: string;
}) {
  return <Modal isOpen={open} onClose={() => { if (!busy) onClose(); }} title={title} description={message}>
    <div className="flex flex-wrap justify-end gap-3">
      <button type="button" disabled={busy} className="auth-secondary-button" onClick={onClose}>Cancel</button>
      <button type="button" disabled={busy} className="auth-secondary-button" onClick={onConfirm}>{busy ? 'Saving...' : confirmLabel}</button>
    </div>
  </Modal>;
}
