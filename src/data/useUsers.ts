import { useEffect, useState } from "react";
import { client, type Schema } from "./client";

export type User = Schema["User"]["type"];

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const sub = client.models.User.observeQuery().subscribe({
      next: ({ items }) => setUsers([...items]),
    });
    return () => sub.unsubscribe();
  }, []);

  return { users, createUser, deleteUser };
}

export function createUser(input: { name: string; email: string }) {
  return client.models.User.create(input);
}

export function deleteUser(id: string) {
  return client.models.User.delete({ id });
}
