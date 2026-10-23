import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, SelectField } from '@aws-amplify/ui-react';
import { LuX } from 'react-icons/lu';
import { client } from '../../data/client';
import type { User } from '../../data/useUsers';

const ROLES = ['Admin', 'Tutor'] as const;

const ROLE_HINTS: Record<(typeof ROLES)[number], string> = {
  Admin: 'Admins can manage the organisation, invite people and change roles.',
  Tutor: 'Tutors see only the students assigned to them.',
};

type Props = {
  /** Who to change; the dialog is open while this is set. */
  employee: User | null;
  onClose: () => void;
  onChanged: () => void;
};

/** Makes an employee an Admin or a Tutor of the active org. */
export default function ChangeRoleDialog({ employee, onClose, onChanged }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState<string>('Tutor');
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const open = !!employee;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setRole(employee?.role ?? 'Tutor');
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, employee]);

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
      const { errors } = await client.mutations.changeEmployeeRole({ userId: employee.id, role });
      if (errors?.length) throw new Error(errors[0].message);
      onChanged();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not change the role. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="ts-dialog"
      aria-labelledby="change-role-title"
      onClose={handleClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="ts-dialog__body" onSubmit={handleSubmit} noValidate>
        <div className="ts-dialog__head">
          <div>
            <h2 id="change-role-title" className="ts-dialog__title">Change role</h2>
            <p className="ts-dialog__sub">
              {employee ? `${employee.name} is currently ${employee.role === 'Admin' ? 'an Admin' : 'a Tutor'}.` : ''}
            </p>
          </div>
          <button type="button" className="ts-dialog__close" onClick={onClose} aria-label="Close">
            <LuX aria-hidden />
          </button>
        </div>

        <SelectField
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          descriptiveText={ROLE_HINTS[role as (typeof ROLES)[number]]}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </SelectField>

        {saveError && <Alert variation="error">{saveError}</Alert>}

        <div className="ts-dialog__actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variation="primary"
            type="submit"
            isLoading={submitting}
            loadingText="Saving…"
            isDisabled={role === employee?.role}
          >
            Save role
          </Button>
        </div>
      </form>
    </dialog>
  );
}
