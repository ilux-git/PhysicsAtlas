import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtlas } from '../app/state.tsx';
import { searchAtlas } from '../engines/graph/search.ts';
import { ENTITY_KIND_LABELS, entityShortLabel } from './labels.ts';

export function SearchBox() {
  const { searchIndex, state, dispatch } = useAtlas();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(
    () => searchAtlas(searchIndex, state.query, { limit: 8 }),
    [searchIndex, state.query],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = (id: string): void => {
    dispatch({ type: 'select', id });
    dispatch({ type: 'query', query: '' });
    setOpen(false);
  };

  return (
    <div className="search" ref={containerRef}>
      <input
        className="search-input"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-label="Поиск по атласу: название, символ или формула"
        placeholder="Найти величину, формулу, закон…"
        value={state.query}
        onChange={(event) => {
          dispatch({ type: 'query', query: event.target.value });
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => {
          if (state.query.trim().length > 0) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === 'Enter') {
            const result = results[activeIndex];
            if (result) {
              event.preventDefault();
              choose(result.entity.id);
            }
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && state.query.trim().length > 0 && (
        <div className="search-results" id="search-results" role="listbox" aria-label="Результаты поиска">
          {results.length === 0 ? (
            <p className="search-empty">Ничего не найдено. Попробуйте символ (m) или формулу (F = ma).</p>
          ) : (
            results.map((hit, index) => (
              <button
                key={hit.entity.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`search-result ${index === activeIndex ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(hit.entity.id)}
              >
                <span className={`kind-dot kind-${hit.entity.kind}`} aria-hidden="true" />
                <span className="search-result-name">
                  {hit.entity.name.ru}{' '}
                  <span className="search-result-hint">
                    {ENTITY_KIND_LABELS[hit.entity.kind]} · {entityShortLabel(hit.entity)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}