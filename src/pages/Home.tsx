import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import PeopleList from '../components/PeopleList';

/**
 * Same page, same component, different data:
 * PeopleList shows every user to an Admin and only the signed-in user to
 * a Tutor or Parent, because the User model's auth rules scope the query.
 */
export default function Home() {
  const { user, groups, loading } = useUser();
  if (loading) return <p>Loading…</p>;

  return (
    <main>
      <h1>Home</h1>
      <p>Signed in as {user?.name} ({user?.email})</p>
      <p>Group: {groups.join(', ') || 'none yet'}</p>

      <PeopleList />

      <Link to="/dashboard">Go to dashboard</Link>
    </main>
  );
}
