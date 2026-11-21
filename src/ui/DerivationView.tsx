import { useAtlas } from '../app/state.tsx';
import type { Derivation } from '../domain/types.ts';
import { verifyDerivation } from '../engines/equation.ts';
import { EntityChip } from './EntityChip.tsx';
import { Formula } from './Formula.tsx';

function derivationHighlight(derivation: Derivation): { nodes: string[]; edges: string[] } {
  return {
    nodes: [
      derivation.id,
      derivation.sourceEquationId,
      derivation.targetEquationId,
      ...derivation.preconditions,
    ],
    edges: [
      `has_derivation:${derivation.sourceEquationId}->${derivation.id}`,
      `produces:${derivation.id}->${derivation.targetEquationId}`,
      `derived_from:${derivation.targetEquationId}->${derivation.sourceEquationId}`,
    ],
  };
}

export function DerivationView() {
  const { kb, state, dispatch } = useAtlas();
  const entity = kb.entities.get(state.selectedId);

  const list = (
    <div className="tool">
      <header className="tool-header">
        <h2>Вывод формулы</h2>
        <p>
          Выберите вывод или уравнение с преобразованиями. Шаги показывают математические операции и
          ограничения; структурная проверка сравнивает результат с целевым уравнением.
        </p>
      </header>
      <section className="tool-section">
        <h3>{entity?.kind === 'equation' ? 'Выводы этого уравнения' : 'Выводы базы знаний'}</h3>
        {(() => {
          const derivations =
            entity?.kind === 'equation'
              ? kb.derivations.filter(
                  (derivation) =>
                    derivation.sourceEquationId === entity.id ||
                    derivation.targetEquationId === entity.id,
                )
              : kb.derivations;
          if (derivations.length === 0) {
            return <p className="empty-note">Для выбранного объекта выводов нет.</p>;
          }
          return (
            <ul className="equation-picker">
              {derivations.map((derivation) => (
                <li key={derivation.id}>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'select', id: derivation.id })}
                  >
                    <span className="equation-picker-name">{derivation.name.ru}</span>
                    <span className="equation-picker-formula">{derivation.description.ru}</span>
                  </button>
                </li>
              ))}
            </ul>
          );
        })()}
      </section>
    </div>
  );

  if (entity?.kind !== 'derivation') return list;

  const derivation = entity;
  const source = kb.equations.find((equation) => equation.id === derivation.sourceEquationId);
  const target = kb.equations.find((equation) => equation.id === derivation.targetEquationId);
  const check = source && target ? verifyDerivation(derivation, source, target, kb) : null;

  return (
    <div className="tool">
      <header className="tool-header">
        <h2>{derivation.name.ru}</h2>
        <p>{derivation.description.ru}</p>
        <div className="tool-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => {
              dispatch({ type: 'select', id: derivation.sourceEquationId });
              dispatch({ type: 'highlight', highlight: derivationHighlight(derivation) });
            }}
          >
            Показать на карте
          </button>
          <button type="button" className="text-button" onClick={() => dispatch({ type: 'tab', tab: 'card' })}>
            Открыть карточку
          </button>
        </div>
      </header>

      <section className="tool-section">
        <h3>Преобразование</h3>
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
      </section>

      <section className="tool-section">
        <h3>Шаги</h3>
        <ol className="steps">
          {derivation.steps.map((step) => (
            <li key={step.order}>
              <p className="step-description">{step.description}</p>
              <p className="step-math">
                <Formula latex={step.displayFrom} /> <span aria-hidden="true">→</span>{' '}
                <Formula latex={step.displayTo} />
              </p>
              {step.precondition && <p className="section-hint">Ограничение: {step.precondition}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section className="tool-section">
        <h3>Предусловия</h3>
        <div className="chips">
          {derivation.preconditions.map((conditionId) => (
            <EntityChip key={conditionId} id={conditionId} />
          ))}
        </div>
      </section>
    </div>
  );
}