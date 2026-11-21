import { useMemo, type ReactNode } from 'react';
import { useAtlas } from '../app/state.tsx';
import { collectQuantityIds } from '../domain/ast.ts';
import {
  BASE_DIMENSIONS,
  LEVEL_LABELS,
  type Condition,
  type Dimension,
  type Equation,
  type Derivation,
  type Entity,
  type Law,
  type Quantity,
  type Unit,
} from '../domain/types.ts';
import { formatDimension } from '../engines/dimensions.ts';
import { equationStatuses, verifyDerivation } from '../engines/equation.ts';
import { AstTree } from './AstView.tsx';
import { EntityChip } from './EntityChip.tsx';
import { Formula } from './Formula.tsx';
import { ENTITY_KIND_LABELS, REVIEW_LABELS, entityShortLabel, formatNumber } from './labels.ts';
import { equationStatusChips, StatusChips, type ChipItem } from './StatusChips.tsx';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="card-section">
      <h3>{title}</h3>
      {hint && <p className="section-hint">{hint}</p>}
      {children}
    </section>
  );
}



function LevelText({ entity }: { entity: Entity }) {
  const { state } = useAtlas();
  const presentation = entity.levelPresentations[state.level];
  if (!presentation) {
    return (
      <p className="level-fallback">
        Отдельного изложения для уровня {LEVEL_LABELS[state.level]} нет; в карточке показаны общие сведения и
        математическая форма.
      </p>
    );
  }
  return (
    <div className="level-text">
      <p>{presentation.summary.ru}</p>
      {presentation.details && <p>{presentation.details.ru}</p>}
      {presentation.mathNote && <p className="math-note">{presentation.mathNote.ru}</p>}
      {presentation.extraLinks && presentation.extraLinks.length > 0 && (
        <div className="extra-links">
          {presentation.extraLinks.map((link) => (
            <EntityChip key={link.targetId} id={link.targetId} note={link.label.ru} />
          ))}
        </div>
      )}
    </div>
  );
}

function conditionConstraint(condition: Condition, entityName: (id: string) => string): string | null {
  const structured = condition.structured;
  if (!structured) return null;
  switch (structured.type) {
    case 'frame':
      return structured.value === 'inertial' ? 'Система отсчёта инерциальна.' : 'Система отсчёта: ' + structured.value;
    case 'constancy':
      return structured.quantityId
        ? `Постоянная величина: ${entityName(structured.quantityId)}.`
        : 'Величина должна быть постоянной.';
    case 'direction':
      return structured.quantityId
        ? `Направление: ${entityName(structured.quantityId)} — ${structured.value ?? 'задано условием'}.`
        : 'Направление задано условием.';
    case 'nonzero':
      return structured.quantityId
        ? `Величина не равна нулю: ${entityName(structured.quantityId)}.`
        : 'Величина не равна нулю.';
    case 'material':
      return `Материал или элемент: ${structured.value ?? 'не уточнён'}.`;
    case 'regime':
      return `Режим: ${structured.value ?? 'не уточнён'}.`;
  }
}

function statusChipsForReview(entity: Entity): ChipItem[] {
  return [
    {
      label: `статус записи: ${REVIEW_LABELS[entity.review.status]}`,
      tone: entity.review.status === 'standard-form' ? 'accent' : 'warning',
      title:
        'Статус описывает происхождение формулировки; независимая физическая экспертиза проекта не проводилась.',
    },
  ];
}



function QuantityBody({ quantity }: { quantity: Quantity }) {
  const { kb, graph, state, dispatch } = useAtlas();
  const dimension = kb.dimensions.find((item) => item.id === quantity.dimensionId);
  const unitEdges = graph.outgoing.get(quantity.id) ?? [];
  const equations = unitEdges
    .filter((edge) => edge.kind === 'appears_in')
    .map((edge) => kb.entities.get(edge.to))
    .filter((entity): entity is Equation => entity?.kind === 'equation');
  const lawIds = [...new Set(equations.flatMap((equation) => equation.lawRefs))];

  return (
    <>
      <Section title="Величина">
        <div className="quantity-hero">
          <span className="quantity-symbol">{quantity.symbol}</span>
          <span className="quantity-kind">
            {quantity.quantityKind === 'vector' ? 'векторная величина' : 'скалярная величина'}
          </span>
        </div>
        <p>{quantity.definition.ru}</p>
      </Section>

      <Section title={`Изложение: ${LEVEL_LABELS[state.level]}`}>
        <LevelText entity={quantity} />
      </Section>

      <Section title="Размерность">
        {dimension ? (
          <>
            <p>
              <code>{formatDimension(dimension.exponents)}</code>
            </p>
            <EntityChip id={dimension.id} />
          </>
        ) : (
          <p className="missing-entity">{quantity.dimensionId}</p>
        )}
      </Section>

      <Section title="Единицы измерения">
        <ul className="unit-list">
          {quantity.unitIds.map((unitId) => {
            const unit = kb.units.find((item) => item.id === unitId);
            if (!unit) return <li key={unitId}>{unitId}</li>;
            const preferred = unit.id === quantity.preferredUnitId;
            return (
              <li key={unit.id} className={preferred ? 'is-preferred' : ''}>
                <button
                  type="button"
                  className="unit-button"
                  onClick={() => dispatch({ type: 'select', id: unit.id })}
                >
                  <span className="unit-symbol">{unit.symbol}</span>
                  <span>{unit.name.ru}</span>
                  {preferred && <span className="badge">основная</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Где используется" hint="Связи построены из переменных уравнений базы знаний.">
        {equations.length === 0 ? (
          <p className="empty-note">Пока не входит ни в одно уравнение.</p>
        ) : (
          <div className="chips">
            {equations.map((equation) => (
              <EntityChip key={equation.id} id={equation.id} />
            ))}
          </div>
        )}
        {lawIds.length > 0 && (
          <div className="chips">
            {lawIds.map((lawId) => (
              <EntityChip key={lawId} id={lawId} showKind />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}



function EquationBody({ equation }: { equation: Equation }) {
  const { kb, graph, state, dispatch } = useAtlas();
  const statuses = useMemo(
    () => equationStatuses(equation, kb),
    [equation, kb],
  );
  const symbolOf = useMemo(
    () => (id: string) => kb.quantities.find((quantity) => quantity.id === id)?.symbol ?? id,
    [kb.quantities],
  );
  const variableIds = useMemo(
    () => [
      ...new Set([
        ...collectQuantityIds(equation.lhsAst),
        ...collectQuantityIds(equation.rhsAst),
      ]),
    ],
    [equation],
  );
  const conditions = useMemo(
    () =>
      equation.conditionRefs
        .map((id) => kb.conditions.find((condition) => condition.id === id))
        .filter((condition): condition is Condition => condition !== undefined),
    [equation.conditionRefs, kb.conditions],
  );
  const derivations = useMemo(
    () =>
      (graph.outgoing.get(equation.id) ?? [])
        .filter((edge) => edge.kind === 'has_derivation')
        .map((edge) => kb.entities.get(edge.to))
        .filter((entity): entity is Derivation => entity?.kind === 'derivation'),
    [graph, kb, equation.id],
  );
  const derivedFrom = useMemo(
    () =>
      (graph.outgoing.get(equation.id) ?? [])
        .filter((edge) => edge.kind === 'derived_from')
        .map((edge) => kb.entities.get(edge.to))
        .filter((entity): entity is Equation => entity?.kind === 'equation'),
    [graph, kb, equation.id],
  );

  return (
    <>
      <Section title="Формула">
        <Formula latex={equation.displayLatex} block />
        {equation.form.note && <p className="math-note">{equation.form.note.ru}</p>}
        <p className="form-meta">
          {equation.form.kind === 'magnitudes' ? 'запись через модули' : 'векторная запись'} ·{' '}
          <code>{equation.id}</code>
        </p>
      </Section>

      <Section title="Статусы проверки">
        <StatusChips chips={equationStatusChips(statuses)} />
        <p className="caveat">
          Размерностная проверка не заменяет физическую экспертизу. Независимая экспертиза формулировки не
          проводилась; статус описывает происхождение записи.
        </p>
      </Section>

      <Section title="Величины в уравнении">
        <div className="chips">
          {variableIds.map((variableId) => (
            <EntityChip key={variableId} id={variableId} />
          ))}
        </div>
      </Section>

      {equation.alternativeForms.length > 0 && (
        <Section title="Допустимые формы">
          {equation.alternativeForms.map((form) => (
            <div key={form.id} className="alternative-form">
              <Formula latex={form.displayLatex} />
              <p className="section-hint">{form.note.ru}</p>
            </div>
          ))}
        </Section>
      )}

      <Section title="Связанные законы">
        {equation.lawRefs.length === 0 ? (
          <p className="empty-note">Уравнение является определением величины или следствием, а не записью закона.</p>
        ) : (
          <div className="chips">
            {equation.lawRefs.map((lawId) => (
              <EntityChip key={lawId} id={lawId} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Условия применимости" hint="Без подтверждения условий вычислительный путь помечается как условно допустимый.">
        {conditions.length === 0 ? (
          <p className="empty-note">Условия не указаны.</p>
        ) : (
          <ul className="condition-list">
            {conditions.map((condition) => (
              <li key={condition.id}>
                <EntityChip id={condition.id} />
                <p className="condition-summary">
                  {condition.levelPresentations[state.level]?.summary.ru ?? condition.description.ru}
                </p>
                {conditionConstraint(condition, symbolOf) && (
                  <p className="section-hint">{conditionConstraint(condition, symbolOf)}</p>
                )}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => dispatch({ type: 'select', id: condition.id })}
                >
                  Открыть условие
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Выводы и преобразования">
        {derivations.length === 0 && derivedFrom.length === 0 ? (
          <p className="empty-note">Преобразований для этого уравнения нет.</p>
        ) : (
          <div className="chips">
            {derivations.map((derivation) => (
              <EntityChip key={derivation.id} id={derivation.id} />
            ))}
            {derivedFrom.map((source) => (
              <EntityChip
                key={source.id}
                id={source.id}
                note={`выведено из: ${source.name.ru}`}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="AST">
        <details>
          <summary>Машинное представление формулы</summary>
          <AstTree node={equation.lhsAst} symbolOf={symbolOf} />
          <p className="ast-equals">=</p>
          <AstTree node={equation.rhsAst} symbolOf={symbolOf} />
        </details>
      </Section>
    </>
  );
}

function LawBody({ law }: { law: Law }) {
  const { kb, graph, state } = useAtlas();
  const equations = (graph.incoming.get(law.id) ?? [])
    .filter((edge) => edge.kind === 'expresses')
    .map((edge) => kb.entities.get(edge.from))
    .filter((entity): entity is Equation => entity?.kind === 'equation');

  return (
    <>
      <Section title={`Изложение: ${LEVEL_LABELS[state.level]}`}>
        <LevelText entity={law} />
      </Section>
      <Section title="Математические формы">
        {equations.length === 0 ? (
          <p className="empty-note">Уравнения, выражающие закон, не найдены.</p>
        ) : (
          <div className="chips">
            {equations.map((equation) => (
              <EntityChip key={equation.id} id={equation.id} />
            ))}
          </div>
        )}
      </Section>
      <Section title="Условия применимости">
        <div className="chips">
          {law.conditionRefs.map((conditionId) => (
            <EntityChip key={conditionId} id={conditionId} />
          ))}
        </div>
      </Section>
    </>
  );
}

function UnitBody({ unit }: { unit: Unit }) {
  const { kb, graph } = useAtlas();
  const quantities = (graph.incoming.get(unit.id) ?? [])
    .filter((edge) => edge.kind === 'has_unit')
    .map((edge) => kb.entities.get(edge.from))
    .filter((entity): entity is Quantity => entity?.kind === 'quantity');

  return (
    <>
      <Section title="Единица">
        <div className="quantity-hero">
          <span className="quantity-symbol">{unit.symbol}</span>
          <span className="quantity-kind">{unit.name.ru}</span>
        </div>
        <dl className="fact-list">
          <div>
            <dt>Система</dt>
            <dd>{unit.system === 'SI' ? 'СИ' : unit.system === 'accepted' ? 'допустимая вне СИ' : 'внесистемная'}</dd>
          </div>
          <div>
            <dt>Коэффициент к СИ</dt>
            <dd>{formatNumber(unit.factor)}</dd>
          </div>
          {unit.offset !== 0 && (
            <div>
              <dt>Смещение</dt>
              <dd>{formatNumber(unit.offset)}</dd>
            </div>
          )}
          <div>
            <dt>Группа конвертации</dt>
            <dd>{unit.conversionGroup}</dd>
          </div>
        </dl>
      </Section>
      <Section title="Размерность">
        <EntityChip id={unit.dimensionId} />
      </Section>
      <Section title="Величины с этой единицей">
        <div className="chips">
          {quantities.map((quantity) => (
            <EntityChip key={quantity.id} id={quantity.id} />
          ))}
        </div>
      </Section>
      <Section title="Перевод">
        <p className="section-hint">
          Перевод выполняется в инструменте «Конвертер» с проверкой размерности и группы величин.
        </p>
      </Section>
    </>
  );
}

function DimensionBody({ dimension }: { dimension: Dimension }) {
  const { kb, graph } = useAtlas();
  const quantities = (graph.incoming.get(dimension.id) ?? [])
    .filter((edge) => edge.kind === 'has_dimension')
    .map((edge) => kb.entities.get(edge.from))
    .filter((entity): entity is Quantity => entity?.kind === 'quantity');

  return (
    <>
      <Section title="Размерность">
        <p className="dimension-vector">{formatDimension(dimension.exponents)}</p>
        <table className="dimension-table">
          <tbody>
            {BASE_DIMENSIONS.map((base) => (
              <tr key={base}>
                <th scope="row">{base}</th>
                <td>{dimension.exponents[base]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Величины с этой размерностью">
        <div className="chips">
          {quantities.map((quantity) => (
            <EntityChip key={quantity.id} id={quantity.id} />
          ))}
        </div>
      </Section>
    </>
  );
}

function ConditionBody({ condition }: { condition: Condition }) {
  const { kb, graph, state } = useAtlas();
  const symbolOf = (id: string) => kb.quantities.find((quantity) => quantity.id === id)?.symbol ?? id;
  const requiredBy = (graph.incoming.get(condition.id) ?? [])
    .filter((edge) => edge.kind === 'requires_condition')
    .map((edge) => kb.entities.get(edge.from))
    .filter((entity): entity is Entity => entity !== undefined);

  return (
    <>
      <Section title={`Изложение: ${LEVEL_LABELS[state.level]}`}>
        <LevelText entity={condition} />
      </Section>
      {condition.structured && (
        <Section title="Структурное ограничение">
          <p>{conditionConstraint(condition, symbolOf)}</p>
          {condition.structured.quantityId && (
            <EntityChip id={condition.structured.quantityId} />
          )}
        </Section>
      )}
      <Section title="Где требуется">
        <div className="chips">
          {requiredBy.map((entity) => (
            <EntityChip key={entity.id} id={entity.id} />
          ))}
        </div>
      </Section>
    </>
  );
}

function DerivationBody({ derivation }: { derivation: Derivation }) {
  const { kb } = useAtlas();
  const source = kb.equations.find((equation) => equation.id === derivation.sourceEquationId);
  const target = kb.equations.find((equation) => equation.id === derivation.targetEquationId);
  const check = source && target ? verifyDerivation(derivation, source, target, kb) : null;

  return (
    <>
      <Section title="Преобразование">
        <div className="chips">
          <EntityChip id={derivation.sourceEquationId} />
          <span className="arrow-note">→</span>
          <EntityChip id={derivation.targetEquationId} />
        </div>
        <p className="caveat">
          {derivation.verificationStatus === 'verified'
            ? 'Вывод проверен.'
            : 'Структурная проверка: сравнение преобразованной формы с целевым уравнением. Символьного доказательства нет.'}
        </p>
        {check && (
          <p className={check.ok ? 'check-ok' : 'check-fail'}>
            {check.ok ? 'Проверка пройдена: форма совпадает с целевым уравнением.' : check.message}
          </p>
        )}
      </Section>

      <Section title="Шаги">
        <ol className="steps">
          {derivation.steps.map((step) => (
            <li key={step.order}>
              <p className="step-description">{step.description}</p>
              <p className="step-math">
                <Formula latex={step.displayFrom} /> <span aria-label="преобразуется в">→</span>{' '}
                <Formula latex={step.displayTo} />
              </p>
              {step.precondition && <p className="section-hint">Ограничение: {step.precondition}</p>}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Предусловия">
        <div className="chips">
          {derivation.preconditions.map((conditionId) => (
            <EntityChip key={conditionId} id={conditionId} />
          ))}
        </div>
      </Section>
    </>
  );
}

function InspectorBody({ entity }: { entity: Entity }) {
  switch (entity.kind) {
    case 'quantity':
      return <QuantityBody quantity={entity} />;
    case 'equation':
      return <EquationBody equation={entity} />;
    case 'law':
      return <LawBody law={entity} />;
    case 'unit':
      return <UnitBody unit={entity} />;
    case 'dimension':
      return <DimensionBody dimension={entity} />;
    case 'condition':
      return <ConditionBody condition={entity} />;
    case 'derivation':
      return <DerivationBody derivation={entity} />;
  }
}

export function Inspector() {
  const { kb, state } = useAtlas();
  const entity = kb.entities.get(state.selectedId);

  if (!entity) {
    return (
      <div className="inspector">
        <p className="empty-note">Объект «{state.selectedId}» не найден в базе знаний.</p>
      </div>
    );
  }

  const domainNames = entity.domains.map(
    (domainId) => kb.domains.find((domain) => domain.id === domainId)?.name.ru ?? domainId,
  );
  const sources = entity.sources
    .map((sourceId) => kb.sources.find((source) => source.id === sourceId))
    .filter((source) => source !== undefined);

  return (
    <div className="inspector" aria-label="Карточка выбранного объекта">
      <header className="inspector-header">
        <span className={`kind-badge kind-${entity.kind}`}>{ENTITY_KIND_LABELS[entity.kind]}</span>
        <h2>{entity.name.ru}</h2>
        <p className="entity-description">{entity.description.ru}</p>
        <div className="header-meta">
          <StatusChips chips={statusChipsForReview(entity)} />
          {domainNames.length > 0 && <span className="meta-line">{domainNames.join(' · ')}</span>}
        </div>
      </header>

      <div className="inspector-body">
        <InspectorBody entity={entity} />

        <Section title="Источники">
          {sources.length === 0 ? (
            <p className="empty-note">Источники не указаны.</p>
          ) : (
            <ul className="source-list">
              {sources.map((source) => (
                <li key={source.id}>
                  <p className="source-title">{source.title}</p>
                  {source.authors && <p className="source-authors">{source.authors}</p>}
                  {source.note && <p className="section-hint">{source.note.ru}</p>}
                  {source.url && (
                    <a className="source-link" href={source.url} target="_blank" rel="noreferrer">
                      Открыть источник
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <footer className="inspector-footer">
        <span>
          <code>{entity.id}</code> · {entityShortLabel(entity)}
        </span>
      </footer>
    </div>
  );
}