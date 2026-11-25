import { useAtlas } from '../app/state.tsx';
import { LEVEL_KEYS, LEVEL_LABELS, type LevelKey } from '../domain/types.ts';

export function LevelSwitch() {
  const { state, dispatch } = useAtlas();
  return (
    <div className="level-switch" role="group" aria-label="Школьный уровень">
      {LEVEL_KEYS.map((level: LevelKey) => (
        <button
          key={level}
          type="button"
          className={`level-button ${state.level === level ? 'is-current' : ''}`}
          aria-pressed={state.level === level}
          title={LEVEL_LABELS[level]}
          onClick={() => dispatch({ type: 'level', level })}
        >
          {level === '7-8' ? '7–8' : level === '10-11' ? '10–11' : level}
        </button>
      ))}
    </div>
  );
}

export function DomainPicker() {
  const { kb, state, dispatch } = useAtlas();
  return (
    <label className="domain-picker">
      <span className="sr-only">Раздел физики</span>
      <select
        value={state.domain}
        onChange={(event) => dispatch({ type: 'domain', domain: event.target.value })}
      >
        <option value="all">Все разделы</option>
        {kb.domains.map((domain) => (
          <option key={domain.id} value={domain.id}>
            {domain.name.ru}
          </option>
        ))}
      </select>
    </label>
  );
}