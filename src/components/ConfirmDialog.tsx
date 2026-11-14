import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Button } from '@aws-amplify/ui-react';
import { LuX } from 'react-icons/lu';

type Props = {
  /** The dialog is open while true. */
  open: boolean;
  title: string;
  /** One line under the title. */
  description?: ReactNode;
  /** Points under the description, e.g. what the action affects. */
  points?: ReactNode[];
  confirmLabel: string;
  busyLabel?: string;
  /** What the action does; errors it throws are shown in the dialog. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

/** In-app replacement for window.confirm: a destructive action that must be confirmed first. */
export default function ConfirmDialog({
  open,
  title,
  description,
  points,
  confirmLabel,
  busyLabel = 'Working…',
  onConfirm,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="ts-dialog"
      aria-labelledby="confirm-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form className="ts-dialog__body" onSubmit={handleSubmit} noValidate>
        <div className="ts-dialog__head">
          <div>
            <h2 id="confirm-dialog-title" className="ts-dialog__title">{title}</h2>
            {description && <p className="ts-dialog__sub">{description}</p>}
          </div>
          <button type="button" className="ts-dialog__close" onClick={onClose} aria-label="Close" disabled={busy}>
            <LuX aria-hidden />
          </button>
        </div>

        {points && points.length > 0 && (
          <ul className="ts-dialog__list">
            {points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}

        {error && <Alert variation="error">{error}</Alert>}

        <div className="ts-dialog__actions">
          <Button onClick={onClose} isDisabled={busy}>
            Cancel
          </Button>
          <Button variation="destructive" type="submit" isLoading={busy} loadingText={busyLabel}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
