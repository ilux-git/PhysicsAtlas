import { useAtlas } from '../app/state.tsx';
import { ENTITY_KIND_LABELS } from './labels.ts';

export function EntityChip({ id, note }: { id: string; note?: string }) {
  const { kb, dispatch } = useAtlas();
  const entity = kb.entities.get(id);
  if (!entity) {
    return <code className="missing-entity">{id}</code>;
  }
  return (
    <button
      type="button"
      className={`entity-chip chip-${entity.kind}`}
      onClick={() => dispatch({ type: 'select', id })}
      title={`${ENTITY_KIND_LABELS[entity.kind]}: ${entity.name.ru}`}
    >
      <span className={`kind-dot kind-${entity.kind}`} aria-hidden="true" />
      {note ?? entity.name.ru}
      {(entity.kind === 'quantity' || entity.kind === 'unit') && (
        <span className="chip-symbol">{entity.symbol}</span>
      )}
    </button>
  );
}