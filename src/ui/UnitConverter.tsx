import { useMemo, useState } from 'react';
import { useAtlas } from '../app/state.tsx';
import type { Unit } from '../domain/types.ts';
import { convertUnit, toSI } from '../engines/units.ts';
import { formatNumber } from './labels.ts';

const PRESETS: ReadonlyArray<{ from: string; to: string; label: string }> = [
  { from: 'unit.kilometer', to: 'unit.meter', label: 'км → м' },
  { from: 'unit.kilometer-per-hour', to: 'unit.meter-per-second', label: 'км/ч → м/с' },
  { from: 'unit.kilogram', to: 'unit.gram', label: 'кг → г' },
  { from: 'unit.kilowatt', to: 'unit.watt', label: 'кВт → Вт' },
  { from: 'unit.hour', to: 'unit.second', label: 'ч → с' },
];

const ERROR_LABELS: Record<string, string> = {
  'unknown-unit': 'неизвестная единица',
  'invalid-unit': 'некорректная единица',
  'dimension-mismatch': 'размерности не совпадают',
  'group-mismatch': 'разные группы величин',
  'non-finite': 'нечисловое значение',
};

export function UnitConverter() {
  const { kb } = useAtlas();
  const [fromId, setFromId] = useState('unit.kilometer');
  const [toId, setToId] = useState('unit.meter');
  const [rawValue, setRawValue] = useState('1');

  const units = useMemo(() => new Map(kb.units.map((unit) => [unit.id, unit])), [kb.units]);
  const from = units.get(fromId);
  const to = units.get(toId);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; units: Unit[] }>();
    for (const unit of kb.units) {
      const dimension = kb.dimensions.find((item) => item.id === unit.dimensionId);
      const group = map.get(unit.dimensionId) ?? {
        name: dimension ? dimension.name.ru : unit.dimensionId,
        units: [],
      };
      group.units.push(unit);
      map.set(unit.dimensionId, group);
      group.units.sort((left, right) => left.name.ru.localeCompare(right.name.ru, 'ru'));
    }
    return [...map.values()];
  }, [kb.units, kb.dimensions]);

  const parsedValue = useMemo(() => {
    const text = rawValue.trim().replace(',', '.');
    if (text.length === 0) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }, [rawValue]);

  const result = useMemo(() => {
    if (parsedValue === null) return null;
    return convertUnit(parsedValue, fromId, toId, units);
  }, [parsedValue, fromId, toId, units]);

  const chooseFrom = (unitId: string): void => {
    setFromId(unitId);
    const nextFrom = units.get(unitId);
    const currentTo = units.get(toId);
    const compatible =
      nextFrom &&
      currentTo &&
      nextFrom.dimensionId === currentTo.dimensionId &&
      nextFrom.conversionGroup === currentTo.conversionGroup &&
      nextFrom.id !== currentTo.id;
    if (!compatible && nextFrom) {
      const fallback = kb.units.find(
        (unit) =>
          unit.id !== nextFrom.id &&
          unit.dimensionId === nextFrom.dimensionId &&
          unit.conversionGroup === nextFrom.conversionGroup,
      );
      if (fallback) setToId(fallback.id);
    }
  };

  const unitOptions = (selectedId: string) => (
    <>
      {groups.map((group) => (
        <optgroup key={group.name} label={group.name}>
          {group.units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.symbol} — {unit.name.ru}
            </option>
          ))}
        </optgroup>
      ))}
      {!kb.units.some((unit) => unit.id === selectedId) && (
        <option value={selectedId}>{selectedId}</option>
      )}
    </>
  );

  return (
    <div className="tool">
      <header className="tool-header">
        <h2>Конвертер единиц</h2>
        <p>
          Перевод с проверкой размерности и физической группы величин. Совпадение размерности само по себе не
          делает величины взаимозаменяемыми.
        </p>
      </header>

      <section className="tool-section">
        <div className="converter-grid">
          <label>
            Из
            <select aria-label="Исходная единица" value={fromId} onChange={(event) => chooseFrom(event.target.value)}>
              {unitOptions(fromId)}
            </select>
          </label>
          <label>
            Значение
            <input
              aria-label="Значение для перевода"
              inputMode="decimal"
              value={rawValue}
              onChange={(event) => setRawValue(event.target.value)}
            />
          </label>
          <label>
            В
            <select aria-label="Целевая единица" value={toId} onChange={(event) => setToId(event.target.value)}>
              {unitOptions(toId)}
            </select>
          </label>
        </div>

        <div className="preset-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="entity-chip"
              onClick={() => {
                setFromId(preset.from);
                setToId(preset.to);
                setRawValue('1');
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="tool-section">
        <h3>Результат</h3>
        {parsedValue === null ? (
          <p className="empty-note">Введите числовое значение.</p>
        ) : result === null ? (
          <p className="empty-note">Перевод не выполнен.</p>
        ) : result.ok ? (
          <>
            <p className="conversion-result">
              {formatNumber(parsedValue)} {from?.symbol} ={' '}
              <strong>
                {formatNumber(result.value)} {result.to.symbol}
              </strong>
            </p>
            <p className="section-hint">
              В СИ: {formatNumber(parsedValue)} {result.from.symbol} → {formatNumber(result.siValue)} (базовая
              единица размерности). Обратный пересчёт: (значение в СИ − смещение) / коэффициент.
            </p>
          </>
        ) : (
          <div className="conversion-error">
            <p className="status-badge status-invalid">{ERROR_LABELS[result.code] ?? result.code}</p>
            <p>{result.message}</p>
          </div>
        )}
      </section>

      <section className="tool-section">
        <h3>Параметры единиц</h3>
        <table className="unit-params">
          <thead>
            <tr>
              <th>Единица</th>
              <th>Размерность</th>
              <th>Коэффициент</th>
              <th>Смещение</th>
              <th>Группа</th>
            </tr>
          </thead>
          <tbody>
            {[from, to].map(
              (unit, index) =>
                unit && (
                  <tr key={`${unit.id}-${index}`}>
                    <td>
                      {unit.symbol} ({unit.name.ru})
                    </td>
                    <td>{unit.dimensionId}</td>
                    <td>{formatNumber(unit.factor)}</td>
                    <td>{formatNumber(unit.offset)}</td>
                    <td>{unit.conversionGroup}</td>
                  </tr>
                ),
            )}
          </tbody>
        </table>
        {from && (
          <p className="section-hint">
            Проверка «{from.symbol} → {to?.symbol}»: значение в СИ = {formatNumber(parsedValue ?? 0)} ×{' '}
            {formatNumber(from.factor)} + {formatNumber(from.offset)} ={' '}
            {formatNumber(toSI(parsedValue ?? 0, from))}.
          </p>
        )}
      </section>
    </div>
  );
}