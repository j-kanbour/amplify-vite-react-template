import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, SelectField, TextAreaField, TextField } from '@aws-amplify/ui-react';
import { LuUserPlus, LuX } from 'react-icons/lu';
import { validateEmail, validatePhone } from '../../utils/validation';
import { addParent, updateParent, type Parent } from '../../data/useParents';
import { byShowcaseOrder, formatPrice, type Bundle } from '../../data/useBundles';

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  bundleId: '',
  notes: '',
  onboardingMessage: '',
  secondFirstName: '',
  secondLastName: '',
  secondEmail: '',
  secondPhone: '',
  secondAddress: '',
};
type Values = typeof EMPTY;
type Key = keyof Values;

const fromParent = (p: Parent): Values => ({
  firstName: p.firstName,
  lastName: p.lastName,
  email: p.email,
  phone: p.phone ?? '',
  address: p.address ?? '',
  bundleId: p.bundleId ?? '',
  notes: p.notes ?? '',
  onboardingMessage: p.onboardingMessage ?? '',
  secondFirstName: p.secondary?.firstName ?? '',
  secondLastName: p.secondary?.lastName ?? '',
  secondEmail: p.secondary?.email ?? '',
  secondPhone: p.secondary?.phone ?? '',
  secondAddress: p.secondary?.address ?? '',
});

type Props = {
  /** Open while set: 'new' for a blank form, or the parent to edit. */
  target: 'new' | Parent | null;
  onClose: () => void;
  /** The org's bundles to choose from; null while they load. */
  bundles: Bundle[] | null;
  /** Called once saved. emailSent is only set when a parent was added. */
  onSaved: (result: { parentId: string; emailSent?: boolean }) => void;
};

/**
 * Add a parent (and optionally a second parent on the same record), or edit
 * one. Adding emails the parent their details; editing doesn't.
 */
export default function ParentDialog({ target, onClose, bundles, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [withSecond, setWithSecond] = useState(false);
  // Until they edit it, the second address follows the first
  const [secondAddressEdited, setSecondAddressEdited] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const open = !!target;
  const editing = target && target !== 'new' ? target : null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setValues(editing ? fromParent(editing) : EMPTY);
      setWithSecond(!!editing?.secondary);
      setSecondAddressEdited(!!editing?.secondary);
      setErrors({});
      setSendError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, editing]);

  const set = (name: Key, value: string) =>
    setValues((v) => {
      const next = { ...v, [name]: value };
      if (name === 'address' && !secondAddressEdited) next.secondAddress = value;
      return next;
    });

  const field = (name: Key) => ({
    name,
    value: values[name],
    hasError: !!errors[name],
    errorMessage: errors[name],
    onChange: (e: { target: { value: string } }) => set(name, e.target.value),
  });

  function addSecond() {
    setValues((v) => ({ ...v, secondAddress: v.address }));
    setSecondAddressEdited(false);
    setWithSecond(true);
  }

  function removeSecond() {
    setValues((v) => ({ ...v, secondFirstName: '', secondLastName: '', secondEmail: '', secondPhone: '', secondAddress: '' }));
    setErrors(({ secondFirstName, secondLastName, secondEmail, secondPhone, secondAddress, ...rest }) => rest);
    setWithSecond(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()])) as Values;

    const next: Partial<Record<Key, string | null>> = {};
    if (!v.firstName) next.firstName = 'First name is required';
    if (!v.lastName) next.lastName = 'Last name is required';
    if (!v.email) next.email = 'Email is required';
    else next.email = validateEmail(v.email);
    if (v.phone) next.phone = validatePhone(v.phone);
    if (withSecond) {
      if (!v.secondFirstName) next.secondFirstName = 'First name is required';
      if (!v.secondLastName) next.secondLastName = 'Last name is required';
      if (v.secondEmail) next.secondEmail = validateEmail(v.secondEmail);
      if (v.secondPhone) next.secondPhone = validatePhone(v.secondPhone);
    }
    const found = Object.fromEntries(Object.entries(next).filter(([, m]) => m)) as Partial<Record<Key, string>>;
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      phone: v.phone || undefined,
      address: v.address || undefined,
      bundleId: v.bundleId || undefined,
      notes: v.notes || undefined,
      onboardingMessage: v.onboardingMessage || undefined,
      ...(withSecond
        ? {
            secondFirstName: v.secondFirstName,
            secondLastName: v.secondLastName,
            secondEmail: v.secondEmail || undefined,
            secondPhone: v.secondPhone || undefined,
            secondAddress: v.secondAddress || undefined,
          }
        : {}),
    };

    setSendError(null);
    setSubmitting(true);
    try {
      onSaved(editing ? await updateParent(editing.id, payload) : await addParent(payload));
      onClose();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not save the parent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const bundleLabel = (b: Bundle) => {
    const price = formatPrice(b.price);
    return price ? `${b.name} — ${price}${b.priceUnit ? ` ${b.priceUnit}` : ''}` : b.name ?? 'Bundle';
  };
  // An edit can keep a bundle that's since been removed from the list
  const missingBundle = editing?.bundleId && bundles && !bundles.some((b) => b.id === editing.bundleId);

  return (
    <dialog
      ref={ref}
      className="ts-dialog"
      aria-labelledby="parent-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="ts-dialog__body" onSubmit={handleSubmit} noValidate>
        <div className="ts-dialog__head">
          <div>
            <h2 id="parent-dialog-title" className="ts-dialog__title">
              {editing ? 'Edit parent' : 'Add parent'}
            </h2>
            <p className="ts-dialog__sub">
              {editing ? 'Changes are saved for your team; the parent isn’t emailed.' : 'They’ll get an email with everything entered here.'}
            </p>
          </div>
          <button type="button" className="ts-dialog__close" onClick={onClose} aria-label="Close">
            <LuX aria-hidden />
          </button>
        </div>

        <div className="ts-dialog__row">
          <TextField label="First name" isRequired autoComplete="off" {...field('firstName')} />
          <TextField label="Last name" isRequired autoComplete="off" {...field('lastName')} />
        </div>
        <div className="ts-dialog__row">
          <TextField label="Email" type="email" isRequired autoComplete="off" {...field('email')} />
          <TextField label="Phone number" type="tel" placeholder="+61 400 000 000" {...field('phone')} />
        </div>
        <TextAreaField label="Address" rows={2} autoComplete="off" {...field('address')} />
        <SelectField
          label="Bundle"
          descriptiveText={bundles?.length === 0 ? 'No bundles set up yet. Admins add them on the Bundles page.' : undefined}
          {...field('bundleId')}
        >
          <option value="">{bundles === null ? 'Loading bundles…' : 'No bundle yet'}</option>
          {missingBundle && <option value={editing!.bundleId!}>Current bundle (no longer offered)</option>}
          {bundles &&
            [...bundles].sort(byShowcaseOrder).map((b) => (
              <option key={b.id} value={b.id}>
                {bundleLabel(b)}
              </option>
            ))}
        </SelectField>
        <TextAreaField
          label="Additional notes"
          descriptiveText="For your team only; not sent to the parent."
          rows={2}
          {...field('notes')}
        />
        <TextAreaField
          label="Onboarding message"
          descriptiveText={editing ? 'What was in their welcome email.' : 'Included at the top of their welcome email.'}
          placeholder="e.g. Lovely to meet you today! Here's everything we talked through…"
          rows={3}
          {...field('onboardingMessage')}
        />

        {withSecond ? (
          <fieldset className="ts-dialog__fieldset ts-dialog__fieldset--stack" aria-label="Second parent or guardian">
            <div className="ts-dialog__head">
              <span className="amplify-label">Second parent or guardian</span>
              <button type="button" className="ts-directory__action" onClick={removeSecond}>
                <LuX aria-hidden /> Remove
              </button>
            </div>
            <p className="ts-dialog__hint">Kept on the same record, so the family stays together.</p>
            <div className="ts-dialog__row">
              <TextField label="First name" isRequired autoComplete="off" {...field('secondFirstName')} />
              <TextField label="Last name" isRequired autoComplete="off" {...field('secondLastName')} />
            </div>
            <div className="ts-dialog__row">
              <TextField label="Email" type="email" autoComplete="off" {...field('secondEmail')} />
              <TextField label="Phone number" type="tel" placeholder="+61 400 000 000" {...field('secondPhone')} />
            </div>
            <TextAreaField
              label="Address"
              descriptiveText={editing ? undefined : 'Pre-filled from above; change it if they live elsewhere.'}
              rows={2}
              autoComplete="off"
              {...field('secondAddress')}
              onChange={(e) => {
                setSecondAddressEdited(true);
                set('secondAddress', e.target.value);
              }}
            />
          </fieldset>
        ) : (
          <div>
            <Button size="small" onClick={addSecond}>
              <LuUserPlus aria-hidden /> Add a second parent or guardian
            </Button>
          </div>
        )}

        {sendError && <Alert variation="error">{sendError}</Alert>}

        <div className="ts-dialog__actions">
          <Button onClick={onClose} isDisabled={submitting}>
            Cancel
          </Button>
          <Button variation="primary" type="submit" isLoading={submitting} loadingText="Saving…">
            {editing ? 'Save changes' : 'Add parent & send email'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
