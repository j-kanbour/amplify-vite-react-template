// src/sections/AdminPanel.tsx
import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export default function AdminPanel() {
  const [users, setUsers] = useState<Schema['User']['type'][]>([]);
  useEffect(() => { client.models.User.list().then((r) => setUsers(r.data)); }, []);

  return (
    <section>
      <h2>All users</h2>
      <ul>{users.map((u) => <li key={u.id}>{u.name} — {u.role}</li>)}</ul>
      
    </section>
  );
}