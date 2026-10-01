import { useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Button, TextAreaField, TextField } from '@aws-amplify/ui-react';
import { LuPencil } from 'react-icons/lu';

export type DetailField = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  placeholder?: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  /** Shown but not editable here, e.g. the sign-in email. */
  readOnly?: boolean;
  /** Error message for a non-empty value, or null when it's fine. */
  validate?: (value: string) => string | null;
};

export type DetailValues = Record<string, string | null | undefined>;

type Props = {
  title: string;
  description?: string;
  fields: DetailField[];
  values: DetailValues;
  /** Gets every editable field, trimmed, with empty values as null. */
  onSave: (values: Record<string, string | null>) => Promise<void>;
  /** Extra read-only content under the fields. */
  footer?: ReactNode;
};

/** A card of labelled values with an Edit button that turns it into a form. */
export default function EditableDetails({ title, description, fields, values, onSave, footer }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const editable = fields.filter((f) => !f.readOnly);

  function startEditing() {
    setDraft(Object.fromEntries(editable.map((f) => [f.name, values[f.name] ?? ''])));
    setFieldErrors({});
    setStatus(null);
    setEditing(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned = Object.fromEntries(editable.map((f) => [f.name, (draft[f.name] ?? '').trim()]));

    const errors: Record<string, string> = {};
    for (const f of editable) {
      const v = cleaned[f.name];
      if (!v && f.required) errors[f.name] = `${f.label} is required`;
      else if (v && f.validate) {
        const message = f.validate(v);
        if (message) errors[f.name] = message;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    setStatus(null);
    try {
      await onSave(Object.fromEntries(Object.entries(cleaned).map(([k, v]) => [k, v || null])));
      setEditing(false);
      setStatus({ kind: 'success', message: 'Changes saved.' });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Could not save your changes.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ts-profile__card">
      <div className="ts-profile__card-head">
        <div>
          <h2 className="ts-profile__card-title">{title}</h2>
          {description && <p className="ts-profile__card-sub">{description}</p>}
        </div>
        {!editing && (
          <Button size="small" onClick={startEditing}>
            <LuPencil aria-hidden /> Edit
          </Button>
        )}
      </div>

      {status && (
        <Alert variation={status.kind} isDismissible onDismiss={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}

      {editing ? (
        <form className="ts-profile__form" onSubmit={handleSubmit} noValidate>
          {fields.map((f) => {
            const common = {
              label: f.label,
              placeholder: f.placeholder,
              descriptiveText: f.readOnly ? 'This can’t be changed here.' : f.hint,
              isRequired: f.required,
              isDisabled: f.readOnly || saving,
              hasError: !!fieldErrors[f.name],
              errorMessage: fieldErrors[f.name],
              value: f.readOnly ? values[f.name] ?? '' : draft[f.name] ?? '',
              onChange: (e: { target: { value: string } }) =>
                setDraft((d) => ({ ...d, [f.name]: e.target.value })),
            };
            return f.multiline ? (
              <TextAreaField key={f.name} {...common} rows={3} />
            ) : (
              <TextField key={f.name} {...common} type={f.type ?? 'text'} />
            );
          })}
          <div className="ts-profile__actions">
            <Button variation="primary" type="submit" isLoading={saving} loadingText="Saving…">
              Save changes
            </Button>
            <Button onClick={() => setEditing(false)} isDisabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="ts-profile__details">
          {fields.map((f) => (
            <div key={f.name} className="ts-profile__detail">
              <dt>{f.label}</dt>
              <dd className={values[f.name] ? undefined : 'ts-profile__empty'}>{values[f.name] || 'Not set'}</dd>
            </div>
          ))}
        </dl>
      )}

      {footer}
    </section>
  );
}
