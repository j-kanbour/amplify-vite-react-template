import { useEffect, useState } from 'react';
import { client, type Schema } from './client';

export type User = Schema['User']['type'];

/**
 * Live list of User records the caller is allowed to see.
 * The backend decides the scope: Admins get everyone, everyone else gets
 * only their own record (owner auth). No frontend filtering needed.
 */
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sub = client.models.User.observeQuery().subscribe({
      next: ({ items }) => {
        setUsers([...items]);
        setLoading(false);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  return { users, loading, createUser, deleteUser };
}

export function createUser(input: { name: string; email: string }) {
  return client.models.User.create(input);
}

export function deleteUser(id: string) {
  return client.models.User.delete({ id });
}
