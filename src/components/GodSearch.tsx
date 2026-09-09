'use client';

import { useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import gods from '@/data/gods.json';
import { GodAvatar } from '@/components/GodAvatar';

/**
 * Header god search.
 *
 * Built as an ARIA 1.2 combobox rather than a bare input + div because the
 * previous version was mouse-only in two ways: the results committed on
 * `onMouseDown`, so a keyboard user could type a query and then had no way to
 * open any of the results, and the input's only name was its placeholder -
 * which vanishes as soon as you type, leaving a screen reader with an unnamed
 * field. Arrow keys move through the list, Enter opens, Escape closes.
 */
export function GodSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return gods.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  const expanded = open && matches.length > 0;

  function goTo(id: string) {
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    router.push(`/gods/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!expanded) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); // otherwise the caret jumps to the end of the field
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((i) => (i + delta + matches.length) % matches.length);
      return;
    }
    if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      goTo(matches[activeIndex].id);
    }
  }

  return (
    <div className="relative w-full max-w-xs">
      <input
        type="text"
        role="combobox"
        aria-label="Buscar dios"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        // Delayed so a click on an option lands before the list unmounts.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="Buscar dios..."
        className="w-full rounded-md border border-ss-line bg-ss-bg-raised px-3 py-1.5 text-sm text-ss-text outline-none focus:border-ss-cyan"
      />

      {/* Announces the result count to screen readers, which otherwise get no
          signal that anything appeared below the field. */}
      <p aria-live="polite" className="sr-only">
        {query.trim() === ''
          ? ''
          : matches.length === 0
            ? 'Ningún dios coincide'
            : `${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'}`}
      </p>

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Resultados"
          className="absolute top-full left-0 z-20 mt-1 w-full overflow-hidden rounded-md border border-ss-line bg-ss-card shadow-lg"
        >
          {matches.map((g, i) => (
            <li
              key={g.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => goTo(g.id)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-ss-text ${
                i === activeIndex ? 'bg-ss-bg-raised' : ''
              }`}
            >
              <GodAvatar iconUrl={g.icon_url} name={g.name} size={24} />
              {g.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
