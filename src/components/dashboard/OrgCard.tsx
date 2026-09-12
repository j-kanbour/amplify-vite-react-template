import { useUser } from '../../context/UserContext';

export default function OrgCard() {
  const { can, org } = useUser();
  if (!can('org.view')) return null;

  return (
    <section>
      <h2>Organisation</h2>
      <p>{org?.name ?? 'No organisation yet'}</p>
      <p>Plan: {org?.subscription ?? 'free'}</p>
    </section>
  );
}
