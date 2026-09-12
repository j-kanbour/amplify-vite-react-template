import { useUser } from '../../context/UserContext';
import { useUsers } from '../../data/useUsers';

// Gate first so the query below never runs for users who can't see it.
export default function UsersCard() {
  const { can } = useUser();
  if (!can('users.list')) return null;
  return <UsersCardInner />;
}

function UsersCardInner() {
  const { users, loading } = useUsers();
  if (loading) return <p>Loading users…</p>;

  const counts = users.reduce<Record<string, number>>((acc, u) => {
    const role = u.role ?? 'unknown';
    acc[role] = (acc[role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section>
      <h2>All users</h2>
      <ul>
        {Object.entries(counts).map(([role, n]) => (
          <li key={role}>{role}: {n}</li>
        ))}
      </ul>
    </section>
  );
}
