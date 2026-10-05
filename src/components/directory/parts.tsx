import { useEffect, useState, type ReactNode } from 'react';
import { presignedGet } from '../../data/profileFile';
import { avatarColor, initials } from '../../utils/initials';

/**
 * Initials on a colour that stays the same for each person, or their picture
 * if photo (a key in the profile bucket) has one.
 */
export function Avatar({ id, name, size, photo }: { id: string; name: string; size?: 'lg'; photo?: string }) {
  // Keyed by path so a stale picture never shows while the next one loads
  const [loaded, setLoaded] = useState<{ photo: string; url?: string }>();
  const src = photo && loaded?.photo === photo ? loaded.url : undefined;
  const setSrc = (url?: string) => photo && setLoaded({ photo, url });

  useEffect(() => {
    if (!photo) return;
    let current = true;
    presignedGet(photo).then((url) => current && setLoaded({ photo, url }), () => {});
    return () => {
      current = false;
    };
  }, [photo]);

  return (
    <span
      className={`ts-directory__avatar${size ? ` ts-directory__avatar--${size}` : ''}`}
      style={{ background: avatarColor(id) }}
      aria-hidden
    >
      {src ? (
        // a 403/404 here just means nothing's been uploaded yet
        <img className="ts-directory__avatar-img" src={src} alt="" onError={() => setSrc(undefined)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function Panel({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="ts-directory__panel">
      <div className="ts-directory__panel-head">
        <h3 className="ts-directory__panel-title">{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="ts-directory__empty">
      <span className="ts-directory__empty-icon" aria-hidden>
        {icon}
      </span>
      {children}
    </div>
  );
}

/** Label/value rows, with "Not set" for missing values. */
export function Facts({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="ts-directory__facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || <span className="ts-directory__muted">Not set</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
