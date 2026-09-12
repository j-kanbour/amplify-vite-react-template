import { useUser } from '../context/UserContext';
import OrgCard from '../components/dashboard/OrgCard';
import UsersCard from '../components/dashboard/UsersCard';
import InviteCard from '../components/dashboard/InviteCard';
import StudentsCard from '../components/dashboard/StudentsCard';
import ChildProgressCard from '../components/dashboard/ChildProgressCard';

/**
 * One dashboard for every role. Each card decides for itself whether to render
 * (see src/access.ts), so this page has no role branching.
 *
 *   Admin  → Org, All users, Invite, Students
 *   Tutor  → Org, Students
 *   Parent → Org, Child progress
 */
export default function Dashboard() {
  const { user, loading } = useUser();
  if (loading) return <p>Loading…</p>;

  return (
    <main>
      <h1>Welcome, {user?.name}</h1>
      <OrgCard />
      <UsersCard />
      <InviteCard />
      <StudentsCard />
      <ChildProgressCard />
    </main>
  );
}
