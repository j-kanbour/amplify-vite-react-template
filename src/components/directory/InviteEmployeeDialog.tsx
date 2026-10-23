import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, SelectField, TextAreaField, TextField } from '@aws-amplify/ui-react';
import { LuX } from 'react-icons/lu';
import { validateEmail, validatePhone } from '../../utils/validation';
import { client } from '../../data/client';

const ROLES = ['Admin', 'Tutor'] as const;

const EMPTY = { name: '', email: '', phone: '', role: 'Tutor', message: '', startDate: '' };
type Values = typeof EMPTY;

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Collects the details for an employee invite and emails it. */
export default function InviteEmployeeDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Every way of closing ends in the dialog's `close` event (Escape fires it
  // directly), so clear the form and sync `open` from there
  function handleClose() {
    setValues(EMPTY);
    setErrors({});
    setSendError(null);
    onClose();
  }

  const field = (name: keyof Values) => ({
    name,
    value: values[name],
    hasError: !!errors[name],
    errorMessage: errors[name],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()])) as Values;

    const next: typeof errors = {};
    if (!v.name) next.name = 'Full name is required';
    if (!v.email) next.email = 'Email is required';
    else next.email = validateEmail(v.email) ?? undefined;
    if (v.phone) next.phone = validatePhone(v.phone) ?? undefined;
    if (!v.startDate) next.startDate = 'Start date is required';
    const found = Object.fromEntries(Object.entries(next).filter(([, m]) => m));
    setErrors(found);
    if (Object.keys(found).length) return;

    setSendError(null);
    setSubmitting(true);
    try {
      // The org is the sender's own; the Lambda works it out and checks they're its Admin
      const { errors: sendErrors } = await client.mutations.sendEmployeeInviteEmail({
        email: v.email,
        name: v.name,
        role: v.role,
        phone: v.phone || undefined,
        startDate: v.startDate || undefined,
        message: v.message || undefined,
      });
      if (sendErrors?.length) throw new Error(sendErrors[0].message);
      onClose();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send the invite. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="ts-dialog"
      aria-labelledby="invite-employee-title"
      onClose={handleClose}
      // The form fills the dialog, so a click landing on the dialog itself is on the backdrop
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="ts-dialog__body" onSubmit={handleSubmit} noValidate>
        <div className="ts-dialog__head">
          <div>
            <h2 id="invite-employee-title" className="ts-dialog__title">Invite employee</h2>
            <p className="ts-dialog__sub">They’ll get an email to join your organisation.</p>
          </div>
          <button type="button" className="ts-dialog__close" onClick={onClose} aria-label="Close">
            <LuX aria-hidden />
          </button>
        </div>

        <TextField label="Full name" isRequired autoComplete="off" {...field('name')} />
        <div className="ts-dialog__row">
          <TextField label="Email" type="email" isRequired autoComplete="off" {...field('email')} />
          <TextField label="Phone number" type="tel" placeholder="+61 400 000 000" {...field('phone')} />
        </div>
        <div className="ts-dialog__row">
          <SelectField label="Role" isRequired {...field('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </SelectField>
          <TextField label="Start date" type="date" isRequired {...field('startDate')} />
        </div>
        <TextAreaField
          label="Message"
          descriptiveText="Optional. Included in the invite email."
          rows={3}
          {...field('message')}
        />

        {sendError && <Alert variation="error">{sendError}</Alert>}

        <div className="ts-dialog__actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variation="primary" type="submit" isLoading={submitting} loadingText="Sending…">
            Send invite
          </Button>
        </div>
      </form>
    </dialog>
  );
}
