import { useCallback, useEffect, useState } from 'react';
import { client, type Schema } from './client';

export type Task = Schema['EmployeeTask']['type'];
export type TaskDraft = { title: string; notes: string | null; dueDate: string | null };

const fail = (errors?: { message: string }[]) => {
  if (errors?.length) throw new Error(errors[0].message);
};

/**
 * The tasks on one employee's board in one org. owner is the employee's
 * profileOwner. Only the org's admins and the employee themselves get
 * anything back: the model's auth rules see to that. `tasks` is null while
 * loading.
 */
export function useTasks(owner?: string | null, orgId?: string | null) {
  const [loaded, setLoaded] = useState<{ key: string; tasks?: Task[]; error?: string }>();
  const key = `${owner}/${orgId}`;

  useEffect(() => {
    if (!owner || !orgId) return;
    let current = true;
    (async () => {
      const tasks: Task[] = [];
      let nextToken: string | null | undefined;
      do {
        const page = await client.models.EmployeeTask.listEmployeeTasksByOwner(
          { owner, orgId: { eq: orgId } },
          { nextToken },
        );
        fail(page.errors);
        tasks.push(...page.data);
        nextToken = page.nextToken;
      } while (nextToken);
      if (current) setLoaded({ key, tasks });
    })().catch((err) => {
      if (current) setLoaded({ key, error: err instanceof Error ? err.message : 'Could not load tasks.' });
    });
    return () => {
      current = false;
    };
  }, [owner, orgId, key]);

  // Keyed by board so the last person's tasks never show for the next
  const mine = loaded?.key === key ? loaded : undefined;
  const tasks = mine?.tasks ?? null;

  const setTasks = useCallback(
    (change: (tasks: Task[]) => Task[]) =>
      setLoaded((l) => (l?.key === key && l.tasks ? { ...l, tasks: change(l.tasks) } : l)),
    [key],
  );

  const add = useCallback(
    async (draft: TaskDraft) => {
      if (!owner || !orgId) throw new Error('This employee has no account to add tasks to yet.');
      const { data, errors } = await client.models.EmployeeTask.create({ owner, orgId, ...draft });
      fail(errors);
      if (data) setTasks((ts) => [...ts, data]);
    },
    [owner, orgId, setTasks],
  );

  const update = useCallback(
    async (id: string, changes: Partial<TaskDraft> & { completedAt?: string | null }) => {
      const { data, errors } = await client.models.EmployeeTask.update({ id, ...changes });
      fail(errors);
      if (data) setTasks((ts) => ts.map((t) => (t.id === id ? data : t)));
    },
    [setTasks],
  );

  const remove = useCallback(
    async (id: string) => {
      const { errors } = await client.models.EmployeeTask.delete({ id });
      fail(errors);
      setTasks((ts) => ts.filter((t) => t.id !== id));
    },
    [setTasks],
  );

  return { tasks, error: mine?.error ?? null, add, update, remove };
}
