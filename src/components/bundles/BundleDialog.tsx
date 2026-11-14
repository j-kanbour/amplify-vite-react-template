import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, CheckboxField, SelectField, TextAreaField, TextField } from '@aws-amplify/ui-react';
import { LuX } from 'react-icons/lu';
import { PRICE_UNITS, bundleFeatures, type Bundle, type BundleDraft } from '../../data/useBundles';

type Props = {
  /** Open while set: 'new' for a blank form, or the bundle to edit. */
  target: 'new' | Bundle | null;
  onClose: () => void;
  onSave: (draft: BundleDraft) => Promise<void>;
};

type Form = {
  name: string;
  description: string;
  price: string;
  priceUnit: string;
  sessions: string;
  features: string;
  discount: string;
  discountTime: string;
  featured: boolean;
};

const blank: Form = {
  name: '',
  description: '',
  price: '',
  priceUnit: PRICE_UNITS[0],
  sessions: '',
  features: '',
  discount: '',
  discountTime: '',
  featured: false,
};

const fromBundle = (b: Bundle): Form => ({
  name: b.name ?? '',
  description: b.description ?? '',
  price: b.price ?? '',
  priceUnit: b.priceUnit ?? PRICE_UNITS[0],
  sessions: b.sessions ? String(b.sessions) : '',
  features: bundleFeatures(b).join('\n'),
  discount: b.discount ?? '',
  discountTime: b.discountTime ?? '',
  featured: !!b.featured,
});

/** Add or edit a pricing bundle. Admins only; the backend refuses anyone else. */
export default function BundleDialog({ target, onClose, onSave }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Form>(blank);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const open = !!target;
  const editing = target && target !== 'new' ? target : null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setForm(editing ? fromBundle(editing) : blank);
      setFieldErrors({});
      setSaveError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, editing]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!form.name.trim()) errors.name = 'Give the bundle a name';
    const priceText = form.price.trim().replace(/^\$/, '').replace(/,/g, '');
    if (priceText && Number(priceText) < 0) errors.price = 'Price can’t be negative';
    if (form.sessions && !/^\d+$/.test(form.sessions.trim())) errors.sessions = 'Enter a whole number of sessions';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: form.price.trim() ? (Number.isFinite(Number(priceText)) ? priceText : form.price.trim()) : null,
        priceUnit: form.price.trim() ? form.priceUnit : null,
        sessions: form.sessions.trim() ? Number(form.sessions.trim()) : null,
        features: form.features
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        discount: form.discount.trim() || null,
        discountTime: form.discountTime.trim() || null,
        featured: form.featured,
      });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the bundle. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="ts-dialog"
      aria-labelledby="bundle-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="ts-dialog__body" onSubmit={handleSubmit} noValidate>
        <div className="ts-dialog__head">
          <div>
            <h2 id="bundle-dialog-title" className="ts-dialog__title">
              {editing ? 'Edit bundle' : 'Add a bundle'}
            </h2>
            <p className="ts-dialog__sub">What tutors present and parents choose from.</p>
          </div>
          <button type="button" className="ts-dialog__close" onClick={onClose} aria-label="Close">
            <LuX aria-hidden />
          </button>
        </div>

        <TextField
          label="Name"
          placeholder="e.g. Weekly maths, 10-session pack"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          hasError={!!fieldErrors.name}
          errorMessage={fieldErrors.name}
          isRequired
        />
        <TextAreaField
          label="Description"
          placeholder="Who it suits and what's included, in a sentence or two."
          rows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <div className="ts-dialog__row">
          <TextField
            label="Price"
            placeholder="e.g. 45"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            hasError={!!fieldErrors.price}
            errorMessage={fieldErrors.price}
            descriptiveText="Leave blank for “price on enquiry”."
          />
          <SelectField label="Charged" value={form.priceUnit} onChange={(e) => set('priceUnit', e.target.value)}>
            {PRICE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="ts-dialog__row">
          <TextField
            label="Sessions included"
            placeholder="e.g. 10"
            inputMode="numeric"
            value={form.sessions}
            onChange={(e) => set('sessions', e.target.value)}
            hasError={!!fieldErrors.sessions}
            errorMessage={fieldErrors.sessions}
          />
          <CheckboxField
            label="Highlight as most popular"
            name="featured"
            value="yes"
            checked={form.featured}
            onChange={(e) => set('featured', e.target.checked)}
          />
        </div>
        <TextAreaField
          label="What's included"
          descriptiveText="One point per line."
          placeholder={'1-on-1 tutoring\nProgress report each term\nHomework support between sessions'}
          rows={4}
          value={form.features}
          onChange={(e) => set('features', e.target.value)}
        />
        <div className="ts-dialog__row">
          <TextField
            label="Offer"
            placeholder="e.g. 10% off"
            value={form.discount}
            onChange={(e) => set('discount', e.target.value)}
          />
          <TextField
            label="Offer ends"
            placeholder="e.g. until 31 January"
            value={form.discountTime}
            onChange={(e) => set('discountTime', e.target.value)}
          />
        </div>

        {saveError && <Alert variation="error">{saveError}</Alert>}

        <div className="ts-dialog__actions">
          <Button onClick={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button variation="primary" type="submit" isLoading={saving} loadingText="Saving…">
            {editing ? 'Save changes' : 'Add bundle'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
