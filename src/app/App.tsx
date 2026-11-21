import { errorDiagnostics, loadKnowledgeBase } from '../knowledge/index.ts';

const { kb, diagnostics } = loadKnowledgeBase();
const errors = errorDiagnostics(diagnostics);

export function App() {
  return (
    <main className="app">
      <h1>Physics Atlas</h1>
      {kb === null || errors.length > 0 ? (
        <section>
          <h2>База знаний содержит ошибки</h2>
          <ul>
            {diagnostics.map((diagnostic) => (
              <li key={`${diagnostic.code}:${diagnostic.entityId}:${diagnostic.message}`}>
                {diagnostic.message}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p>
          Загружено сущностей: {kb.entities.size}, связей: {kb.edges.length}.
        </p>
      )}
    </main>
  );
}