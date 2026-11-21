import { ALL_EDGE_KINDS, ALL_ENTITY_KINDS, useAtlas } from '../app/state.tsx';
import { EDGE_KIND_LABELS, ENTITY_KIND_LABELS } from './labels.ts';

export function FilterPanel() {
  const { state, dispatch } = useAtlas();
  return (
    <details className="map-panel filter-panel" open>
      <summary>Фильтры</summary>
      <fieldset>
        <legend>Типы узлов</legend>
        {ALL_ENTITY_KINDS.map((kind) => (
          <label key={kind} className="check-row">
            <input
              type="checkbox"
              checked={state.filters.nodeKinds.includes(kind)}
              onChange={() => dispatch({ type: 'toggle-node-kind', kind })}
            />
            <span className={`kind-dot kind-${kind}`} aria-hidden="true" />
            {ENTITY_KIND_LABELS[kind]}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Типы связей</legend>
        {ALL_EDGE_KINDS.map((kind) => (
          <label key={kind} className="check-row">
            <input
              type="checkbox"
              checked={state.filters.edgeKinds.includes(kind)}
              onChange={() => dispatch({ type: 'toggle-edge-kind', kind })}
            />
            {EDGE_KIND_LABELS[kind]}
          </label>
        ))}
      </fieldset>
      <label className="radius-row">
        Глубина: {state.radius}
        <input
          type="range"
          min={1}
          max={4}
          step={1}
          value={state.radius}
          onChange={(event) => dispatch({ type: 'radius', radius: Number(event.target.value) })}
        />
      </label>
      <button
        type="button"
        className="link-button"
        onClick={() => dispatch({ type: 'reset-filters' })}
      >
        Сбросить фильтры
      </button>
    </details>
  );
}