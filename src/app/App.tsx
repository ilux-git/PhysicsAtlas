import { useMemo } from 'react';
import { errorDiagnostics, warningDiagnostics, loadKnowledgeBase } from '../knowledge/index.ts';
import type { Diagnostic } from '../domain/types.ts';
import { AtlasProvider } from './state.tsx';
import { Workspace } from './Workspace.tsx';
import './styles.css';

function DiagnosticList({ diagnostics }: { diagnostics: readonly Diagnostic[] }) {
  return (
    <ul className="diagnostic-list">
      {diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.code}-${index}`} className={`diagnostic diagnostic-${diagnostic.severity}`}>
          <code>{diagnostic.code}</code>
          {diagnostic.entityId ? <span className="diagnostic-id"> «{diagnostic.entityId}»</span> : null}
          <p>{diagnostic.message}</p>
        </li>
      ))}
    </ul>
  );
}

export function App() {
  const loaded = useMemo(() => loadKnowledgeBase(), []);
  const errors = errorDiagnostics(loaded.diagnostics);
  const warnings = warningDiagnostics(loaded.diagnostics);

  if (loaded.kb === null || errors.length > 0) {
    return (
      <main className="startup-error">
        <h1>Physics Atlas</h1>
        <h2>База знаний не прошла проверку</h2>
        <p>
          Приложение не запускается, потому что в базе знаний есть ошибки. Их нужно исправить в JSON-файлах и
          повторить проверку командой <code>pnpm validate</code>.
        </p>
        <DiagnosticList diagnostics={[...errors, ...warnings]} />
      </main>
    );
  }

  return (
    <AtlasProvider kb={loaded.kb}>
      <Workspace />
      {warnings.length > 0 && (
        <details className="warning-banner">
          <summary>Предупреждения базы знаний: {warnings.length}</summary>
          <DiagnosticList diagnostics={warnings} />
        </details>
      )}
    </AtlasProvider>
  );
}