import { useState, type FormEvent } from 'react';
import { Alert, Button, TextAreaField, TextField } from '@aws-amplify/ui-react';
import { LuCheck, LuListTodo, LuPencil, LuPlus, LuTrash } from 'react-icons/lu';
import { EmptyState } from '../directory/parts';
import { useTasks, type Task, type TaskDraft } from '../../data/useTasks';

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

const formatDue = (date: string) =>
  new Date(`${date}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Open tasks first, soonest due first (undated last); then done ones, latest first. */
function byBoardOrder(a: Task, b: Task) {
  if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? 1 : -1;
  if (a.completedAt && b.completedAt) return b.completedAt.localeCompare(a.completedAt);
  if (a.dueDate !== b.dueDate) return !a.dueDate ? 1 : !b.dueDate ? -1 : a.dueDate.localeCompare(b.dueDate);
  return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

const message = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

/** Title, notes and due date. Used for adding (empty) and editing (filled). */
function TaskForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Task;
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Give the task a title.');
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), notes: notes.trim() || null, dueDate: dueDate || null });
      if (!initial) {
        setTitle('');
        setNotes('');
        setDueDate('');
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="ts-tasks__form" onSubmit={submit}>
      <TextField
        label="Task"
        labelHidden={!initial}
        placeholder="Add a task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        size="small"
      />
      {(initial || title) && (
        <>
          <TextAreaField
            label="Notes"
            placeholder="Optional"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            size="small"
          />
          <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} size="small" />
        </>
      )}
      {error && <Alert variation="error">{error}</Alert>}
      <div className="ts-tasks__form-actions">
        {onCancel && (
          <Button size="small" onClick={onCancel} isDisabled={saving}>
            Cancel
          </Button>
        )}
        <Button size="small" variation="primary" type="submit" isLoading={saving} loadingText="Saving…">
          {!initial && <LuPlus aria-hidden />} {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function TaskRow({
  task,
  onUpdate,
  onRemove,
}: {
  task: Task;
  onUpdate: (changes: Partial<TaskDraft> & { completedAt?: string | null }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = !!task.completedAt;
  const overdue = !done && !!task.dueDate && task.dueDate < today();

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="ts-tasks__item">
        <TaskForm
          initial={task}
          submitLabel="Save"
          onSubmit={async (draft) => {
            await onUpdate(draft);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={`ts-tasks__item${done ? ' ts-tasks__item--done' : ''}`}>
      <div className="ts-tasks__row">
        <button
          type="button"
          className={`ts-tasks__check${done ? ' ts-tasks__check--done' : ''}`}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          aria-pressed={done}
          disabled={busy}
          onClick={() => run(() => onUpdate({ completedAt: done ? null : new Date().toISOString() }))}
        >
          {done && <LuCheck aria-hidden />}
        </button>
        <span className="ts-tasks__text">
          <span className="ts-tasks__title">{task.title}</span>
          {task.notes && <span className="ts-tasks__notes">{task.notes}</span>}
          {task.dueDate && (
            <span className={`ts-tasks__due${overdue ? ' ts-tasks__due--overdue' : ''}`}>
              {overdue ? 'Overdue · ' : 'Due '}
              {formatDue(task.dueDate)}
            </span>
          )}
        </span>
        <span className="ts-tasks__actions">
          <button
            type="button"
            className="ts-tasks__icon-btn"
            aria-label={`Edit "${task.title}"`}
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            <LuPencil aria-hidden />
          </button>
          <button
            type="button"
            className="ts-tasks__icon-btn ts-tasks__icon-btn--danger"
            aria-label={`Remove "${task.title}"`}
            disabled={busy}
            onClick={() => window.confirm(`Remove "${task.title}"?`) && run(onRemove)}
          >
            <LuTrash aria-hidden />
          </button>
        </span>
      </div>
      {error && <Alert variation="error">{error}</Alert>}
    </li>
  );
}

/**
 * An employee's task board: add, edit, complete and remove. Pass it
 * useTasks(their profileOwner, orgId), so the panel around it can show the
 * count too. Only render it for the employee themselves or an admin of the
 * org; the backend refuses anyone else anyway.
 */
export default function TaskBoard({
  board,
  emptyText = 'No tasks yet.',
}: {
  board: ReturnType<typeof useTasks>;
  emptyText?: string;
}) {
  const { tasks, error, add, update, remove } = board;

  return (
    <div className="ts-tasks">
      {error && <Alert variation="error">{error}</Alert>}
      {tasks === null && !error ? (
        <p className="ts-directory__muted">Loading tasks…</p>
      ) : tasks?.length ? (
        <ul className="ts-tasks__list">
          {[...tasks].sort(byBoardOrder).map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onUpdate={(changes) => update(t.id, changes)}
              onRemove={() => remove(t.id)}
            />
          ))}
        </ul>
      ) : (
        !error && <EmptyState icon={<LuListTodo />}>{emptyText}</EmptyState>
      )}
      <TaskForm submitLabel="Add task" onSubmit={add} />
    </div>
  );
}

/** "2/5 done", for a panel's header. */
export function TaskCount({ tasks }: { tasks: Task[] | null }) {
  if (!tasks?.length) return null;
  const done = tasks.filter((t) => t.completedAt).length;
  return (
    <span className={`ts-directory__pill ts-directory__pill--${done === tasks.length ? 'done' : 'pending'}`}>
      {done}/{tasks.length} done
    </span>
  );
}
