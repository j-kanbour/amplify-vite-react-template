import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import type { Permission } from '../access';

/**
 * Route-level guard. Use for whole pages only one role should reach,
 * so users never land on a page where every component renders null.
 *
 *   <Route element={<RequirePermission permission="users.invite" />}>
 *     <Route path="/invites" element={<Invites />} />
 *   </Route>
 */
export default function RequirePermission({ permission, to = '/' }: { permission: Permission; to?: string }) {
  const { can, loading } = useUser();
  if (loading) return <p>Loading…</p>;
  return can(permission) ? <Outlet /> : <Navigate to={to} replace />;
}
