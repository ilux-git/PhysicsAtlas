import { useAtlas } from '../app/state.tsx';
import { collectQuantityIds } from '../domain/ast.ts';
import { AstPair } from './AstView.tsx';
import { EntityChip } from './EntityChip.tsx';
import { Formula } from './Formula.tsx';

export function FormulaExplorer() {
  const { kb, state, dispatch } = useAtlas();
  const entity = kb.entities.get(state.selectedId);

  if (entity?.kind !== 'equation') {
    const equations = [...kb.equations].sort((left, right) =>
      left.name.ru.localeCompare(right.name.ru, 'ru'),
    );
    return (
      <div className="tool">
        <header className="tool-header">
          <h2>Обозреватель формул</h2>
          <p>
            Выберите уравнение на карте, в поиске или в списке ниже: инструмент покажет состав формулы,
            переменные, связи с законами и допустимые формы.
          </p>
        </header>
        <section className="tool-section">
          <h3>Уравнения базы знаний</h3>
          <ul className="equation-picker">
            {equations.map((equation) => (
              <li key={equation.id}>
                <button type="button" onClick={() => dispatch({ type: 'select', id: equation.id })}>
                  <span className="equation-picker-name">{equation.name.ru}</span>
                  <span className="equation-picker-formula">
                    <Formula latex={equation.displayLatex} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  const symbols = new Map(kb.quantities.map((quantity) => [quantity.id, quantity.symbol]));
  const variableIds = [
    ...new Set([
      ...collectQuantityIds(entity.lhsAst),
      ...collectQuantityIds(entity.rhsAst),
    ]),
  ];
  const conditions = entity.conditionRefs
    .map((id) => kb.conditions.find((condition) => condition.id === id))
    .filter((condition) => condition !== undefined);

  return (
    <div className="tool">
      <header className="tool-header">
        <h2>{entity.name.ru}</h2>
        <p>{entity.description.ru}</p>
        <button type="button" className="text-button" onClick={() => dispatch({ type: 'tab', tab: 'card' })}>
          Открыть карточку уравнения
        </button>
      </header>

      <section className="tool-section">
        <h3>Состав уравнения</h3>
        <Formula latex={entity.displayLatex} block />
        {entity.form.note && <p className="math-note">{entity.form.note.ru}</p>}
      </section>

      <section className="tool-section">
        <h3>Переменные</h3>
        <div className="chips">
          {variableIds.map((variableId) => (
            <EntityChip key={variableId} id={variableId} />
          ))}
        </div>
        <p className="section-hint">
          Переменные — канонические величины атласа; формулы ссылаются на них по идентификатору, а не по надписи.
        </p>
      </section>

      <section className="tool-section">
        <h3>Связанные законы</h3>
        {entity.lawRefs.length === 0 ? (
          <p className="empty-note">Уравнение не привязано к закону.</p>
        ) : (
          <div className="chips">
            {entity.lawRefs.map((lawId) => (
              <EntityChip key={lawId} id={lawId} />
            ))}
          </div>
        )}
      </section>

      {entity.alternativeForms.length > 0 && (
        <section className="tool-section">
          <h3>Допустимые формы</h3>
          {entity.alternativeForms.map((form) => (
            <div key={form.id} className="alternative-form">
              <Formula latex={form.displayLatex} />
              <p className="section-hint">{form.note.ru}</p>
            </div>
          ))}
        </section>
      )}

      <section className="tool-section">
        <h3>Условия применимости</h3>
        {conditions.length === 0 ? (
          <p className="empty-note">Условия не указаны.</p>
        ) : (
          <div className="chips">
            {conditions.map((condition) => (
              <EntityChip key={condition.id} id={condition.id} />
            ))}
          </div>
        )}
      </section>

      <section className="tool-section">
        <h3>AST</h3>
        <details>
          <summary>Машинное представление</summary>
          <AstPair lhs={entity.lhsAst} rhs={entity.rhsAst} symbolOf={(id) => symbols.get(id) ?? id} />
        </details>
      </section>
    </div>
  );
}