import { useMemo } from 'react';
import { useAtlas, type PathConditionDecision, type PathDraft } from '../app/state.tsx';
import type { PathResult } from '../engines/paths/find.ts';
import { findPaths, pathHighlight } from '../engines/paths/find.ts';
import { astToInfix } from '../engines/ast/parse.ts';
import { Formula } from './Formula.tsx';
import { EXPERT_LABELS, FORMULATION_LABELS, formatNumber } from './labels.ts';

const COMPUTATION_LABELS = {
  numeric: 'численный расчёт',
  symbolic: 'символьная цепочка',
  failed: 'расчёт не выполнен',
} as const;

const CONDITIONS_LABELS = {
  'not-required': 'не требуются',
  confirmed: 'подтверждены',
  partial: 'подтверждены частично',
  unconfirmed: 'не подтверждены',
  violated: 'нарушены',
} as const;

const CONDITION_STATUS_LABELS = {
  confirmed: 'подтверждено',
  unconfirmed: 'не проверено',
  violated: 'нарушено',
} as const;

export function FindPathPanel() {
  const { kb, state, dispatch } = useAtlas();
  const draft = state.pathDraft;
  const { targetId, rows, depthLimit, conditionStates } = draft;
  const updateDraft = (patch: Partial<PathDraft>): void => {
    dispatch({ type: 'path-draft', draft: { ...draft, ...patch } });
  };
  const setRows = (
    next:
      | PathDraft['rows']
      | ((current: PathDraft['rows']) => PathDraft['rows']),
  ): void => {
    updateDraft({ rows: typeof next === 'function' ? next(rows) : next });
  };
  const setConditionStates = (
    next:
      | Record<string, PathConditionDecision>
      | ((current: Record<string, PathConditionDecision>) => Record<string, PathConditionDecision>),
  ): void => {
    updateDraft({
      conditionStates: typeof next === 'function' ? next(conditionStates) : next,
    });
  };
  const setTargetId = (next: string): void => updateDraft({ targetId: next });
  const setDepthLimit = (next: number): void => updateDraft({ depthLimit: next });

  const quantities = useMemo(
    () => [...kb.quantities].sort((left, right) => left.name.ru.localeCompare(right.name.ru, 'ru')),
    [kb.quantities],
  );
  const units = useMemo(() => new Map(kb.units.map((unit) => [unit.id, unit])), [kb.units]);
  const symbols = useMemo(
    () => new Map(kb.quantities.map((quantity) => [quantity.id, quantity.symbol])),
    [kb.quantities],
  );

  const values = useMemo(() => {
    const map = new Map<string, { value: number; unitId: string }>();
    for (const row of rows) {
      const parsed = Number(row.value.replace(',', '.'));
      if (row.value.trim().length > 0 && Number.isFinite(parsed)) {
        map.set(row.id, { value: parsed, unitId: row.unitId });
      }
    }
    return map;
  }, [rows]);

  const result = useMemo(
    () =>
      findPaths(kb, {
        targetId,
        knownIds: rows.map((row) => row.id),
        values,
        confirmedConditionIds: Object.entries(conditionStates)
          .filter(([, state]) => state === 'confirmed')
          .map(([id]) => id),
        violatedConditionIds: Object.entries(conditionStates)
          .filter(([, state]) => state === 'violated')
          .map(([id]) => id),
        depthLimit,
        maxPaths: 3,
      }),
    [kb, targetId, rows, values, conditionStates, depthLimit],
  );

  const usedConditions = useMemo(() => {
    const map = new Map<string, PathResult['conditions'][number]>();
    for (const path of result.paths) {
      for (const condition of path.conditions) map.set(condition.condition.id, condition);
    }
    return [...map.values()].sort((left, right) =>
      left.condition.name.ru.localeCompare(right.condition.name.ru, 'ru'),
    );
  }, [result.paths]);

  const target = kb.quantities.find((quantity) => quantity.id === targetId);

  const showOnMap = (path: PathResult): void => {
    dispatch({ type: 'select', id: path.targetId });
    dispatch({ type: 'highlight', highlight: pathHighlight(path) });
  };

  return (
    <div className="tool">
      <header className="tool-header">
        <h2>Поиск вычислительного пути</h2>
        <p>
          Выберите известные величины и целевую величину. Атлас построит цепочку уравнений и покажет
          отдельно: выполнимость вычислений, состояние условий применимости и состояние физической
          экспертизы.
        </p>
      </header>

      <section className="tool-section">
        <h3>Целевая величина</h3>
        <select
          aria-label="Целевая величина"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        >
          {quantities.map((quantity) => (
            <option key={quantity.id} value={quantity.id}>
              {quantity.name.ru} ({quantity.symbol})
            </option>
          ))}
        </select>
        <label className="inline-field">
          Глубина поиска
          <select
            aria-label="Глубина поиска"
            value={depthLimit}
            onChange={(event) => setDepthLimit(Number(event.target.value))}
          >
            {[2, 3, 4].map((depth) => (
              <option key={depth} value={depth}>
                {depth}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="tool-section">
        <h3>Известные величины</h3>
        <p className="section-hint">
          Значения необязательны: без них строится символьная цепочка, с ними — численный расчёт в СИ.
        </p>
        <div className="known-rows">
          {rows.map((row, index) => {
            const quantity = kb.quantities.find((item) => item.id === row.id);
            return (
              <div className="known-row" key={`${row.id}-${index}`}>
                <select
                  aria-label={`Известная величина ${index + 1}`}
                  value={row.id}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const nextQuantity = kb.quantities.find((item) => item.id === nextId);
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              id: nextId,
                              unitId: nextQuantity?.preferredUnitId ?? '',
                            }
                          : item,
                      ),
                    );
                  }}
                >
                  {quantities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name.ru} ({item.symbol})
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Значение ${index + 1}`}
                  inputMode="decimal"
                  placeholder="значение"
                  value={row.value}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value: nextValue } : item,
                      ),
                    );
                  }}
                />
                <select
                  aria-label={`Единица ${index + 1}`}
                  value={row.unitId}
                  onChange={(event) => {
                    const nextUnit = event.target.value;
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, unitId: nextUnit } : item,
                      ),
                    );
                  }}
                >
                  {(quantity?.unitIds ?? []).map((unitId) => {
                    const unit = units.get(unitId);
                    return (
                      <option key={unitId} value={unitId}>
                        {unit?.symbol ?? unitId}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Убрать величину ${index + 1}`}
                  onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            const existing = new Set(rows.map((row) => row.id));
            const next = quantities.find((quantity) => !existing.has(quantity.id));
            if (next) {
              setRows((current) => [
                ...current,
                { id: next.id, value: '', unitId: next.preferredUnitId },
              ]);
            }
          }}
        >
          + Добавить величину
        </button>
      </section>

      {usedConditions.length > 0 && (
        <section className="tool-section">
          <h3>Условия применимости</h3>
          <p className="section-hint">
            Пока условие не подтверждено, условия пути остаются неподтверждёнными. Отметка «нарушено»
            переводит условия в состояние «нарушены».
          </p>
          <div className="condition-statuses">
            {usedConditions.map((entry) => (
              <label key={entry.condition.id} className="condition-status-row">
                <span>{entry.condition.name.ru}</span>
                <select
                  aria-label={`Статус условия «${entry.condition.name.ru}»`}
                  value={conditionStates[entry.condition.id] ?? 'unconfirmed'}
                  onChange={(event) => {
                    const next = event.target.value as PathConditionDecision;
                    setConditionStates((current) => ({ ...current, [entry.condition.id]: next }));
                  }}
                >
                  <option value="unconfirmed">не проверено</option>
                  <option value="confirmed">подтверждено</option>
                  <option value="violated">нарушено</option>
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="tool-section">
        <h3>
          Результат
          {target ? `: ${target.name.ru} (${target.symbol})` : ''}
        </h3>
        {result.paths.length === 0 ? (
          <p className="empty-note">{result.reason}</p>
        ) : (
          <div className="path-list">
            {result.paths.map((path, index) => (
              <article key={path.id} className="path-card">
                <header>
                  <span className="path-rank">путь {index + 1}</span>
                </header>
                <div className="path-statuses" aria-label="Характеристики пути">
                  <span
                    className={`status-chip tone-${path.computation.status === 'failed' ? 'danger' : path.computation.status === 'numeric' ? 'ok' : 'neutral'}`}
                  >
                    вычисления: {COMPUTATION_LABELS[path.computation.status]}
                  </span>
                  <span
                    className={`status-chip tone-${path.conditionsStatus === 'violated' ? 'danger' : path.conditionsStatus === 'confirmed' ? 'ok' : path.conditionsStatus === 'not-required' ? 'neutral' : 'warning'}`}
                  >
                    условия: {CONDITIONS_LABELS[path.conditionsStatus]}
                  </span>
                  <span
                    className={`status-chip tone-${path.review.expert === 'completed' ? 'ok' : path.review.expert === 'rejected' ? 'danger' : 'warning'}`}
                  >
                    экспертиза: {EXPERT_LABELS[path.review.expert]}
                  </span>
                </div>
                <ol className="path-steps">
                  {path.steps.map((step, stepIndex) => {
                    const targetQuantity = kb.quantities.find(
                      (quantity) => quantity.id === step.targetId,
                    );
                    const unit = step.computed ? units.get(step.computed.unitId) : undefined;
                    return (
                      <li key={`${path.id}-${stepIndex}`}>
                        <p className="step-equation">
                          <Formula latex={step.equation.displayLatex} />
                          <span className="step-equation-name">{step.equation.name.ru}</span>
                        </p>
                        <p className="step-expression">
                          {targetQuantity?.symbol ?? step.targetId} ={' '}
                          {astToInfix(step.ast, symbols)}
                        </p>
                        {step.computed && unit && (
                          <p className="step-computed">
                            ≈ {formatNumber(step.computed.value)} {unit.symbol}
                          </p>
                        )}
                        {step.preconditions.length > 0 && (
                          <p className="section-hint">
                            Ограничения: {step.preconditions.map((item) => item.text).join(', ')}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>

                {path.conditions.length > 0 && (
                  <ul className="path-condition-list">
                    {path.conditions.map((condition) => {
                      const sources = condition.requiredBy
                        .map((id) => kb.entities.get(id)?.name.ru ?? id)
                        .join('; ');
                      return (
                        <li key={condition.condition.id}>
                          <span
                            className={`status-chip tone-${condition.status === 'confirmed' ? 'ok' : condition.status === 'violated' ? 'danger' : 'warning'}`}
                          >
                            {condition.condition.name.ru}: {CONDITION_STATUS_LABELS[condition.status]}
                          </span>
                          <span className="condition-attribution">Требуется: {sources}</span>
                          <span className="condition-why">{condition.condition.description.ru}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {path.unverifiedConstraints.length > 0 && (
                  <ul className="path-warnings">
                    {path.unverifiedConstraints.map((constraint) => (
                      <li key={constraint}>{constraint}</li>
                    ))}
                  </ul>
                )}
                {path.computation.messages.length > 0 && (
                  <ul className="path-warnings">
                    {path.computation.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                )}
                {path.review.perEquation.length > 0 && (
                  <details className="path-review">
                    <summary>Формулировки и экспертиза по формулам</summary>
                    <ul>
                      {path.review.perEquation.map((item) => (
                        <li key={item.equationId}>
                          {kb.equations.find((equation) => equation.id === item.equationId)?.name.ru ?? item.equationId}:{' '}
                          {FORMULATION_LABELS[item.formulation]}; экспертиза: {EXPERT_LABELS[item.expert]}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {path.notes.length > 0 && (
                  <ul className="path-notes">
                    {path.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}

                <button type="button" className="text-button" onClick={() => showOnMap(path)}>
                  Показать на карте
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}