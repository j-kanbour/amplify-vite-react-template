// DEV ONLY. Floating role picker in the top-right corner. See roleOverride.ts.
import { GROUPS } from '../access';
import { useUser } from '../context/UserContext';
import { readGroupOverride, writeGroupOverride } from './roleOverride';

export default function RoleSwitcher() {
  if (!import.meta.env.DEV) return null;
  return <RoleSwitcherInner />;
}

function RoleSwitcherInner() {
  const { realGroups } = useUser();
  const override = readGroupOverride() ?? '';

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    writeGroupOverride(e.target.value || null);
    window.location.reload(); // simplest way to re-run every gated component
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 9999,
        padding: '4px 8px',
        background: override ? '#ffe08a' : '#eee',
        border: '1px solid #999',
        borderRadius: 6,
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
      }}
      title="Dev only: preview the UI as another role. Backend data is still scoped by your real group."
    >
      <label>
        View as{' '}
        <select value={override} onChange={onChange}>
          <option value="">Real ({realGroups.join(', ') || 'none'})</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
