import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button } from '@aws-amplify/ui-react';
import { LuX } from 'react-icons/lu';
import { client } from '../../data/client';
import type { User } from '../../data/useUsers';

type Props = {
  /** Who to offboard; the dialog is open while this is set. */
  employee: User | null;
  orgName?: string;
  onClose: () => void;
  onOffboarded: () => void;
};

/** Confirms removing an employee from the active org, then does it. */
export default function OffboardDialog({ employee, orgName, onClose, onOffboarded }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const open = !!employee;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Every way of closing ends in the dialog's `close` event, so reset from there
  function handleClose() {
    setSaveError(null);
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setSaveError(null);
    setSubmitting(true);
    try {
      // The org is the caller's active one; the Lambda checks they're its Admin
      const { errors } = await client.mutations.offboardEmployee({ userId: employee.id });
      if (errors?.length) throw new Error(errors[0].message);
      onOffboarded();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not offboard them. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const org = orgName ?? 'your organisation';

  return (
    <dialog
      ref={ref}
      className="ts-dialog"
      aria-labelledby="offboard-title"
      onClose={handleClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="ts-dialog__body" onSubmit={handleSubmit} noValidate>
        <div className="ts-dialog__head">
          <div>
            <h2 id="offboard-title" className="ts-dialog__title">Offboard {employee?.name}?</h2>
            <p className="ts-dialog__sub">They’ll be removed from {org}.</p>
          </div>
          <button type="button" className="ts-dialog__close" onClick={onClose} aria-label="Close">
            <LuX aria-hidden />
          </button>
        </div>

        <ul className="ts-dialog__list">
          <li>They lose access to {org} within 15 minutes.</li>
          <li>They’re unassigned from their students here, and any pending invite is cancelled.</li>
          <li>Their account and any other organisations they belong to aren’t affected.</li>
          <li>To bring them back, send a new invite.</li>
        </ul>

        {saveError && <Alert variation="error">{saveError}</Alert>}

        <div className="ts-dialog__actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variation="destructive" type="submit" isLoading={submitting} loadingText="Offboarding…">
            Offboard
          </Button>
        </div>
      </form>
    </dialog>
  );
}
