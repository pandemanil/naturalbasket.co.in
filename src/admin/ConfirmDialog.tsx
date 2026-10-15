import { useEffect, useRef } from 'react';

export default function ConfirmDialog(props: {
  title: string; message: string; confirmLabel: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onCancel]);
  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onCancel}>
      <div className="modal small" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title">{props.title}</h2>
        <p>{props.message}</p>
        <div className="modal-actions">
          <button ref={cancelRef} className="btn" onClick={props.onCancel} disabled={props.busy}>Cancel</button>
          <button className={props.danger ? 'btn danger' : 'btn primary'} onClick={props.onConfirm} disabled={props.busy}>
            {props.busy ? 'Working…' : props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
