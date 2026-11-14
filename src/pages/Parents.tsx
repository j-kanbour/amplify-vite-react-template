import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button } from '@aws-amplify/ui-react';
import { LuContact, LuGraduationCap, LuMail, LuNotebookPen, LuPackage, LuPencil, LuPhone, LuTrash, LuUserPlus, LuUsers } from 'react-icons/lu';
import { useUser } from '../context/UserContext';
import Show from '../components/Show';
import DirectoryList from '../components/directory/DirectoryList';
import { Avatar, EmptyState, Facts, Panel } from '../components/directory/parts';
import ParentDialog from '../components/parents/ParentDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { deleteParent, parentName, useParents, type Parent } from '../data/useParents';
import { formatPrice, useBundles, type Bundle } from '../data/useBundles';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'nobundle', label: 'No bundle' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

const EMAIL_PILL: Record<string, { label: string; kind: 'done' | 'pending' }> = {
  sent: { label: 'Welcome email sent', kind: 'done' },
  failed: { label: 'Welcome email failed', kind: 'pending' },
  pending: { label: 'Sending welcome email', kind: 'pending' },
};

/** onEdit and onRemove are left out when the viewer can't do them. */
function ParentDetail({
  parent,
  bundle,
  onEdit,
  onRemove,
}: {
  parent: Parent;
  bundle?: Bundle;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const name = parentName(parent);
  const pill = EMAIL_PILL[parent.emailStatus ?? ''];
  const second = parent.secondary;
  const price = formatPrice(bundle?.price);

  return (
    <div className="ts-directory__detail">
      <section className="ts-directory__panel">
        <div className="ts-directory__hero">
          <Avatar id={parent.id} name={name} size="lg" />
          <div className="ts-directory__hero-text">
            <h2 className="ts-directory__hero-name">{name}</h2>
            <p className="ts-directory__hero-sub">
              {bundle?.name ?? 'No bundle'} · {parent.email}
            </p>
          </div>
          {pill && <span className={`ts-directory__pill ts-directory__pill--${pill.kind}`}>{pill.label}</span>}
        </div>
        <div className="ts-directory__hero-actions">
          <a className="ts-directory__action" href={`mailto:${parent.email}`}>
            <LuMail aria-hidden /> Email
          </a>
          {parent.phone && (
            <a className="ts-directory__action" href={`tel:${parent.phone}`}>
              <LuPhone aria-hidden /> Call
            </a>
          )}
          {onEdit && (
            <button type="button" className="ts-directory__action" onClick={onEdit}>
              <LuPencil aria-hidden /> Edit
            </button>
          )}
          {onRemove && (
            <button type="button" className="ts-directory__action ts-directory__action--danger" onClick={onRemove}>
              <LuTrash aria-hidden /> Remove
            </button>
          )}
        </div>
      </section>

      <div className="ts-directory__grid">
        <Panel title="Contact details">
          <Facts
            rows={[
              ['Full name', name],
              ['Email', <a href={`mailto:${parent.email}`}>{parent.email}</a>],
              ['Phone', parent.phone && <a href={`tel:${parent.phone}`}>{parent.phone}</a>],
              ['Address', parent.address && <span style={{ whiteSpace: 'pre-line' }}>{parent.address}</span>],
              ['Added', formatDate(parent.createdAt)],
            ]}
          />
        </Panel>

        <Panel title="Second parent or guardian">
          {second ? (
            <Facts
              rows={[
                ['Full name', parentName(second)],
                ['Email', second.email && <a href={`mailto:${second.email}`}>{second.email}</a>],
                ['Phone', second.phone && <a href={`tel:${second.phone}`}>{second.phone}</a>],
                ['Address', second.address && <span style={{ whiteSpace: 'pre-line' }}>{second.address}</span>],
              ]}
            />
          ) : (
            <EmptyState icon={<LuUsers />}>No second parent recorded.</EmptyState>
          )}
        </Panel>

        <Panel title="Bundle">
          {bundle ? (
            <Facts
              rows={[
                ['Bundle', bundle.name],
                ['Price', price && `${price}${bundle.priceUnit ? ` ${bundle.priceUnit}` : ''}`],
                ['Sessions', bundle.sessions ? `${bundle.sessions} session${bundle.sessions === 1 ? '' : 's'}` : null],
              ]}
            />
          ) : (
            <EmptyState icon={<LuPackage />}>{parent.bundleId ? 'This bundle is no longer offered.' : 'No bundle chosen yet.'}</EmptyState>
          )}
        </Panel>

        <Panel title="Notes">
          {parent.notes || parent.onboardingMessage ? (
            <Facts
              rows={[
                ['Team notes', parent.notes && <span style={{ whiteSpace: 'pre-line' }}>{parent.notes}</span>],
                ['Onboarding message', parent.onboardingMessage && <span style={{ whiteSpace: 'pre-line' }}>{parent.onboardingMessage}</span>],
              ]}
            />
          ) : (
            <EmptyState icon={<LuNotebookPen />}>No notes yet.</EmptyState>
          )}
        </Panel>

        {/* TODO: link students to the parent (Guardian) */}
        <div className="ts-directory__wide">
          <Panel title="Students">
            <EmptyState icon={<LuGraduationCap />}>No students linked yet.</EmptyState>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Family management: every parent the org works with, with the selected one's details beside the list. Admins and tutors. */
export default function Parents() {
  const { org, can } = useUser();
  const { parents, error, reload } = useParents(org?.id);
  const { bundles } = useBundles(org?.id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [editing, setEditing] = useState<'new' | Parent | null>(null);
  const [removing, setRemoving] = useState<Parent | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'warning'; text: string } | null>(null);
  // Selection lives in the URL so a particular parent can be linked to
  const [params, setParams] = useSearchParams();

  const bundleById = new Map((bundles ?? []).map((b) => [b.id, b]));
  const all = [...(parents ?? [])].sort((a, b) => parentName(a).localeCompare(parentName(b)));
  const q = query.trim().toLowerCase();
  const shown = all.filter(
    (p) =>
      (filter === 'all' || !p.bundleId) &&
      (!q ||
        parentName(p).toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.secondary && parentName(p.secondary).toLowerCase().includes(q))),
  );
  const selected = all.find((p) => p.id === params.get('id')) ?? shown[0] ?? all[0];

  async function handleRemove(p: Parent) {
    await deleteParent(p.id);
    setParams({}, { replace: true });
    setNotice({ kind: 'success', text: `${parentName(p)} has been removed.` });
    reload();
  }

  return (
    <main className="ts-directory">
      <DirectoryList
        noun="parent"
        items={
          parents &&
          shown.map((p) => ({
            id: p.id,
            name: parentName(p),
            sub: bundleById.get(p.bundleId ?? '')?.name ?? p.email,
            tag: p.secondary ? `+ ${p.secondary.firstName}` : undefined,
          }))
        }
        hasAny={all.length > 0}
        selectedId={selected?.id}
        onSelect={(id) => setParams({ id }, { replace: true })}
        query={query}
        onQueryChange={setQuery}
        filters={FILTERS}
        filter={filter}
        onFilterChange={(key) => setFilter(key as FilterKey)}
        error={error}
        actions={
          <Show permission="parents.add">
            <Button variation="primary" size="small" onClick={() => setEditing('new')}>
              <LuUserPlus aria-hidden /> Add new parent
            </Button>
          </Show>
        }
      />

      <div className="ts-directory__detail-col">
        {notice && (
          <Alert variation={notice.kind} isDismissible onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}
        {selected ? (
          <ParentDetail
            // Remount per parent, so nothing carries over between them
            key={selected.id}
            parent={selected}
            bundle={bundleById.get(selected.bundleId ?? '')}
            onEdit={can('parents.edit') ? () => setEditing(selected) : undefined}
            onRemove={can('parents.delete') ? () => setRemoving(selected) : undefined}
          />
        ) : (
          parents !== null && (
            <section className="ts-directory__panel">
              <EmptyState icon={<LuContact />}>Add your first parent to see their details here.</EmptyState>
            </section>
          )
        )}
      </div>

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing ? parentName(removing) : ''}?`}
        description="Their details will be deleted for everyone in your organisation."
        points={[
          'Their contact details, notes and bundle choice are removed.',
          removing?.secondary ? `${parentName(removing.secondary)}’s details go with them.` : null,
          'This can’t be undone; they’d need to be added again.',
        ].filter(Boolean)}
        confirmLabel="Remove parent"
        busyLabel="Removing…"
        onConfirm={() => handleRemove(removing!)}
        onClose={() => setRemoving(null)}
      />
      <ParentDialog
        target={editing}
        bundles={bundles}
        onClose={() => setEditing(null)}
        onSaved={({ parentId, emailSent }) => {
          setNotice(
            emailSent === undefined
              ? { kind: 'success', text: 'Changes saved.' }
              : emailSent
                ? { kind: 'success', text: 'Parent added and their welcome email is on its way.' }
                : { kind: 'warning', text: 'Parent added, but the welcome email couldn’t be sent. Check their address.' },
          );
          setParams({ id: parentId }, { replace: true });
          reload();
        }}
      />
    </main>
  );
}
