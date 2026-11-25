import { ENTITY_KIND_LABELS, ENTITY_KIND_ORDER } from './labels.ts';

const GROUPS = [
  { id: 'physical', label: 'физические', color: '#4f46e5', dash: '' },
  { id: 'mathematical', label: 'математические', color: '#9333ea', dash: '6 4' },
  { id: 'structural', label: 'структурные', color: '#64748b', dash: '2 4' },
] as const;

export function Legend() {
  return (
    <details className="map-panel legend">
      <summary>Обозначения</summary>
      <div className="legend-grid">
        {ENTITY_KIND_ORDER.map((kind) => (
          <div key={kind} className="legend-item">
            <span className={`legend-shape legend-shape-${kind}`} aria-hidden="true" />
            <span>{ENTITY_KIND_LABELS[kind]}</span>
          </div>
        ))}
      </div>
      <div className="legend-edges">
        {GROUPS.map((group) => (
          <div key={group.id} className="legend-item">
            <svg width="34" height="10" aria-hidden="true">
              <line
                x1="2"
                y1="5"
                x2="32"
                y2="5"
                stroke={group.color}
                strokeWidth="2"
                strokeDasharray={group.dash || undefined}
              />
            </svg>
            <span>{group.label} связи</span>
          </div>
        ))}
      </div>
      <p className="legend-note">
        Направление стрелки показывает смысл связи в модели, а не порядок изучения.
      </p>
    </details>
  );
}