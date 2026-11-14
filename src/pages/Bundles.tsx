import { useState } from 'react';
import { Alert, Button } from '@aws-amplify/ui-react';
import { LuPackage, LuPencil, LuPlus, LuPresentation, LuPrinter, LuTrash } from 'react-icons/lu';
import { useUser } from '../context/UserContext';
import Show from '../components/Show';
import { EmptyState } from '../components/directory/parts';
import BundleCard from '../components/bundles/BundleCard';
import BundleDialog from '../components/bundles/BundleDialog';
import BundlePresentation from '../components/bundles/BundlePresentation';
import { byShowcaseOrder, useBundles, type Bundle } from '../data/useBundles';

/**
 * The org's pricing options. Admins add and edit them; tutors see the same
 * page read-only. Both can present them full-screen or print them to PDF.
 */
export default function Bundles() {
  const { org, can } = useUser();
  const { bundles, error, add, update, remove } = useBundles(org?.id);
  const [editing, setEditing] = useState<'new' | Bundle | null>(null);
  const [showing, setShowing] = useState<'present' | 'print' | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const canEdit = can('bundles.edit');
  const sorted = bundles ? [...bundles].sort(byShowcaseOrder) : null;

  async function handleRemove(b: Bundle) {
    if (!window.confirm(`Remove "${b.name}"? Tutors will no longer see it.`)) return;
    setRemoveError(null);
    try {
      await remove(b.id);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Could not remove the bundle.');
    }
  }

  return (
    <main className="ts-bundles">
      <div className="ts-bundles__toolbar">
        <p className="ts-bundles__intro">
          {canEdit
            ? 'The pricing options your tutors present to families. Changes show for everyone straight away.'
            : `${org?.name ?? 'Your organisation'}’s pricing options. Present them to a family, or print a copy to hand over.`}
        </p>
        <div className="ts-bundles__buttons">
          <Button size="small" onClick={() => setShowing('print')} isDisabled={!sorted?.length}>
            <LuPrinter aria-hidden /> Print / PDF
          </Button>
          <Button size="small" onClick={() => setShowing('present')} isDisabled={!sorted?.length}>
            <LuPresentation aria-hidden /> Present
          </Button>
          <Show permission="bundles.edit">
            <Button size="small" variation="primary" onClick={() => setEditing('new')}>
              <LuPlus aria-hidden /> Add bundle
            </Button>
          </Show>
        </div>
      </div>

      {error && <Alert variation="error">{error}</Alert>}
      {removeError && <Alert variation="error" isDismissible onDismiss={() => setRemoveError(null)}>{removeError}</Alert>}

      {sorted === null && !error ? (
        <p className="ts-directory__muted">Loading bundles…</p>
      ) : sorted?.length ? (
        <div className="ts-bundles__grid">
          {sorted.map((b) => (
            <BundleCard
              key={b.id}
              bundle={b}
              actions={
                canEdit && (
                  <>
                    <button type="button" className="ts-directory__action" onClick={() => setEditing(b)}>
                      <LuPencil aria-hidden /> Edit
                    </button>
                    <button
                      type="button"
                      className="ts-directory__action ts-directory__action--danger"
                      onClick={() => handleRemove(b)}
                    >
                      <LuTrash aria-hidden /> Remove
                    </button>
                  </>
                )
              }
            />
          ))}
        </div>
      ) : (
        !error && (
          <section className="ts-directory__panel">
            <EmptyState icon={<LuPackage />}>
              {canEdit ? (
                <>
                  No bundles yet. Add your first to give tutors something to present.
                  <Button size="small" variation="primary" onClick={() => setEditing('new')}>
                    <LuPlus aria-hidden /> Add bundle
                  </Button>
                </>
              ) : (
                'No bundles yet. Ask an admin to add some.'
              )}
            </EmptyState>
          </section>
        )
      )}

      <BundleDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSave={(draft) => (editing && editing !== 'new' ? update(editing.id, draft) : add(draft))}
      />
      {showing && sorted && (
        <BundlePresentation bundles={sorted} print={showing === 'print'} onClose={() => setShowing(null)} />
      )}
    </main>
  );
}
