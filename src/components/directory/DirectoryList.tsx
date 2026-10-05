import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Alert } from '@aws-amplify/ui-react';
import { LuChevronRight, LuSearch } from 'react-icons/lu';
import { Avatar } from './parts';

export type DirectoryItem = {
  id: string;
  name: string;
  sub?: ReactNode;
  tag?: string;
  /** Profile bucket key of their picture, shown instead of initials when set. */
  photo?: string;
};

type Props = {
  /** "employee", "student": used in the search placeholder and messages. */
  noun: string;
  /** Already searched and filtered by the page. null while loading. */
  items: DirectoryItem[] | null;
  /** Whether anyone exists at all, to tell "none yet" from "none match". */
  hasAny: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  filters?: readonly { key: string; label: string }[];
  filter?: string;
  onFilterChange?: (key: string) => void;
  error?: string | null;
  /** Buttons under the search box, e.g. "Invite employee". */
  actions?: ReactNode;
};

/** Left-hand panel of a directory page: search, actions, filters, and the list itself. */
export default function DirectoryList({
  noun,
  items,
  hasAny,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  filters,
  filter,
  onFilterChange,
  error,
  actions,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Up/down arrows move through the list, like a listbox
  function handleListKey(e: KeyboardEvent) {
    if (!items || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    const i = items.findIndex((item) => item.id === selectedId);
    const next = items[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), items.length - 1)];
    if (!next) return;
    onSelect(next.id);
    listRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
  }

  return (
    <aside className="ts-directory__list">
      <label className="ts-directory__search">
        <LuSearch aria-hidden />
        <input
          type="search"
          placeholder={`Find a${/^[aeiou]/i.test(noun) ? 'n' : ''} ${noun}…`}
          aria-label={`Find a ${noun}`}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </label>

      {actions}

      {filters && onFilterChange && (
        <div className="ts-directory__filters" role="group" aria-label={`Filter ${noun}s`}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className="ts-directory__filter"
              aria-pressed={filter === f.key}
              onClick={() => onFilterChange(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {error && <Alert variation="error">{error}</Alert>}
      {items === null ? (
        <p className="ts-directory__muted">Loading {noun}s…</p>
      ) : items.length === 0 ? (
        <p className="ts-directory__muted">{hasAny ? 'No one matches.' : `No ${noun}s yet.`}</p>
      ) : (
        <div className="ts-directory__items" ref={listRef} onKeyDown={handleListKey}>
          {items.map((item) => {
            const active = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                className={`ts-directory__item${active ? ' ts-directory__item--active' : ''}`}
                aria-current={active || undefined}
                data-id={item.id}
                onClick={() => onSelect(item.id)}
              >
                <Avatar id={item.id} name={item.name} photo={item.photo} />
                <span className="ts-directory__item-text">
                  <span className="ts-directory__item-name">
                    {item.name}
                    {item.tag && <span className="ts-directory__you">{item.tag}</span>}
                  </span>
                  {item.sub && <span className="ts-directory__item-sub">{item.sub}</span>}
                </span>
                {active && <LuChevronRight className="ts-directory__item-chevron" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
