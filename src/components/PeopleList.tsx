import { useUsers } from '../data/useUsers';

/**
 * Renders whatever User records the backend returns for the signed-in user.
 * Admin: every user in the pool. Tutor / Parent: just their own record.
 * Same component, no role branching; the authorization rules do the work.
 */
export default function PeopleList() {
  const { users, loading } = useUsers();
  if (loading) return <p>Loading people…</p>;

  return (
    <section>
      <h2>People you can see ({users.length})</h2>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.name} — {u.role ?? 'no role'} — {u.email}
          </li>
        ))}
      </ul>
    </section>
  );
}
