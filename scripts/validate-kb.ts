import { errorDiagnostics, loadKnowledgeBase, warningDiagnostics } from '../src/knowledge/index.ts';

const { kb, diagnostics } = loadKnowledgeBase();
const errors = errorDiagnostics(diagnostics);
const warnings = warningDiagnostics(diagnostics);

console.log('Physics Atlas — проверка базы знаний\n');
if (kb) {
  console.log(`Сущностей: ${kb.entities.size}`);
  console.log(`Рёбер: ${kb.edges.length}`);
  console.log(`Разделов: ${kb.domains.length}`);
}
console.log(`Ошибок: ${errors.length}, предупреждений: ${warnings.length}\n`);

const print = (list: typeof diagnostics): void => {
  for (const diagnostic of list) {
    const id = diagnostic.entityId ? ` «${diagnostic.entityId}»` : '';
    console.log(`  [${diagnostic.code}]${id}: ${diagnostic.message}`);
  }
};

if (warnings.length > 0) {
  console.log('Предупреждения:');
  print(warnings);
  console.log('');
}

if (errors.length > 0) {
  console.log('Ошибки:');
  print(errors);
  console.log('');
}

if (errors.length > 0) {
  console.log('Проверка не пройдена.');
  process.exitCode = 1;
} else {
  console.log('Проверка пройдена.');
}